/* AssignCheck V2 — จุดเริ่มต้นแอป: เปลือกหน้าจอ + เราเตอร์ */

import { h, mount, toast } from './dom.js';
import * as api from './api.js';
import { state, subscribe, bootstrap, loadClass, sync, isSyncing, go } from './state.js';
import { auth } from './auth.js';
import { icon } from './icons.js';
import { applyTheme, watchSystemTheme } from './theme.js';

import { viewSetup }      from './views/setup.js';
import { viewHome }       from './views/home.js';
import { viewAttendance } from './views/attendance.js';
import { viewWork }       from './views/work.js';
import { viewSummary }    from './views/summary.js';
import { viewReport }     from './views/report.js';
import { viewSettings }   from './views/settings.js';
import { viewHealth }     from './views/health.js';
import { NEEDS_SERVER, cmpVersion } from './version.js';

const NAV = [
  { id: 'home',    ic: 'home',  label: 'หน้าแรก',   view: viewHome },
  { id: 'att',     ic: 'clock', label: 'เช็คชื่อ',   view: viewAttendance, needClass: true },
  { id: 'work',    ic: 'tasks', label: 'งาน/คะแนน', view: viewWork,       needClass: true },
  { id: 'report',  ic: 'chart', label: 'รายงาน',    view: viewReport,     needClass: true },
  { id: 'summary', ic: 'table', label: 'สรุป SGS',  view: viewSummary,    needClass: true }
];

// หน้าที่ไม่ได้อยู่ในแถบเมนู เข้าจากที่อื่น
const EXTRA_VIEWS = { settings: viewSettings, health: viewHealth };

/**
 * เรื่องที่ต้องเตือนทันที ไม่ควรรอให้ผู้ใช้ไปหาเอง
 * (โค้ดในชีตเก่าคือสาเหตุอันดับ 1 ของอาการคะแนนเพี้ยน)
 */
function topAlert() {
  if (!api.conn.ready) return null;
  const sv = api.serverInfo.version;

  if (api.serverInfo.seen && cmpVersion(sv, NEEDS_SERVER) < 0) {
    return {
      level: 'err',
      text: sv
        ? `โค้ดในชีตเป็นเวอร์ชันเก่า (v${sv}) — คะแนน "ส่งช้า" จะเพี้ยน`
        : 'โค้ดในชีตเป็นเวอร์ชันเก่า — คะแนน "ส่งช้า" จะถูกคิดเป็น 0'
    };
  }
  const sum = ['w_work1','w_quiz1','w_att1','w_mid','w_work2','w_quiz2','w_att2','w_fin']
    .reduce((a, k) => a + (Number(state.config[k]) || 0), 0);
  if (state.config.w_work1 !== undefined && sum !== 100) {
    return { level: 'err', text: `น้ำหนักคะแนนรวม ${sum} ไม่เท่ากับ 100` };
  }
  if (state.classes.length && !String(state.config.mid_date || '').trim()) {
    return { level: 'warn', text: 'ยังไม่ได้ตั้งวันสอบกลางภาค — คะแนนอาจลงผิดช่วง' };
  }
  return null;
}

const app = document.getElementById('app');
const boot = document.getElementById('boot');

/**
 * แสดงข้อผิดพลาดให้เห็นบนหน้าจอ แทนที่จะค้างอยู่ที่หน้าโหลดเงียบ ๆ
 * ครูจะได้อ่านข้อความส่งมาให้ช่วยดูได้ ไม่ต้องเปิด console เอง
 */
function showFatal(err) {
  const msg = String((err && (err.message || err.stack)) || err || 'ไม่ทราบสาเหตุ');
  try { if (boot) boot.remove(); } catch (e) {}
  try { app.hidden = false; } catch (e) {}
  mount(app, h('div', { class: 'page' },
    h('div', { class: 'card' },
      h('div', { style: { fontSize: '17px', fontWeight: '700', marginBottom: '8px' } }, 'เปิดแอปไม่สำเร็จ'),
      h('div', { style: { fontSize: '13.5px', color: 'var(--ink-2)', marginBottom: '12px', lineHeight: '1.6' } },
        'ลองกดโหลดใหม่ก่อน ถ้ายังไม่หาย ให้ส่งข้อความด้านล่างนี้ให้คนดูแลระบบ'),
      h('pre', {
        style: {
          background: 'var(--surface-3)', padding: '11px 13px', borderRadius: '10px',
          fontSize: '12px', whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: '0 0 12px'
        }
      }, msg),
      h('button', { class: 'btn btn-block', onclick: () => location.reload() }, 'โหลดใหม่')
    )));
}

// กันไว้อีกชั้น — พังตรงไหนก็ตาม อย่างน้อยต้องไม่ค้างที่หน้าโหลด
window.addEventListener('error', (e) => {
  if (document.getElementById('boot')) showFatal(e.error || e.message);
});
window.addEventListener('unhandledrejection', (e) => {
  if (document.getElementById('boot')) showFatal(e.reason);
});

// ── เปลือกหน้าจอ ────────────────────────────────────────────

function appbar() {
  const online = navigator.onLine;
  const pending = api.queue.size;
  return h('header', { class: 'appbar' },
    h('div', { class: 'brand' }, 'A'),
    h('div', { style: { flex: '1', minWidth: '0' } },
      h('div', { class: 'appbar-title' }, 'AssignCheck'),
      h('div', { class: 'appbar-sub' },
        state.config.year ? `ปีการศึกษา ${state.config.year} · ภาคเรียนที่ ${state.config.term || '-'}` : 'เช็คชื่อ · เช็คงาน · สรุป SGS')
    ),
    pending > 0 && h('span', { class: 'sync-pill' + (online ? '' : ' off') },
      isSyncing() ? 'กำลังซิงค์…' : `ค้าง ${pending}`),
    !online && h('span', { class: 'sync-pill off' }, 'ออฟไลน์'),
    h('button', {
      class: 'icon-btn', title: 'ซิงค์ข้อมูล', 'aria-label': 'ซิงค์ข้อมูล',
      onclick: async (e) => {
        const s = e.currentTarget.firstElementChild;
        if (s) s.style.animation = 'spin .7s linear infinite';
        await sync({ loud: true });
        await bootstrap({ silent: true });
      }
    }, icon('refresh')),
    h('button', {
      class: 'icon-btn', title: 'ตั้งค่า', 'aria-label': 'ตั้งค่า',
      'data-on': state.view === 'settings' ? '1' : '0',
      onclick: () => go(state.view === 'settings' ? 'home' : 'settings')
    }, icon('gear'))
  );
}

function nav() {
  return h('nav', { class: 'nav' },
    NAV.map(n => h('button', {
      'data-on': state.view === n.id ? '1' : '0',
      'aria-current': state.view === n.id ? 'page' : null,
      onclick: () => {
        if (n.needClass && !state.classId) { toast('เลือกห้องเรียนก่อน'); go('home'); return; }
        go(n.id);
      }
    }, h('span', { class: 'ic' }, icon(n.ic)), h('span', null, n.label)))
  );
}

function classPicker() {
  if (!state.classes.length) return null;
  if (!['att', 'work', 'report', 'summary'].includes(state.view)) return null;
  return h('div', { class: 'class-pick' },
    icon('book'),
    h('select', {
      'aria-label': 'เลือกห้องเรียน',
      value: state.classId,
      onchange: (e) => loadClass(e.target.value)
    }, state.classes.map(c => h('option', { value: c.classId, selected: c.classId === state.classId },
      `${[c.grade, c.room].filter(Boolean).join('/')} · ${c.subject}`)))
  );
}

function render() {
  if (!api.conn.ready) { mount(app, viewSetup()); return; }

  const view = EXTRA_VIEWS[state.view]
    || (NAV.find(n => n.id === state.view) || NAV[0]).view;

  const alert = topAlert();

  mount(app,
    h('div', { class: 'shell' },
      appbar(),
      alert && state.view !== 'health' && h('button', {
        class: 'alert-bar' + (alert.level === 'warn' ? ' warn' : ''),
        onclick: () => go('health')
      }, h('span', null, (alert.level === 'warn' ? '⚠️ ' : '❌ ') + alert.text), h('b', null, 'แก้ ›')),
      nav(),
      classPicker(),
      view()
    )
  );
}

// ── เริ่มทำงาน ──────────────────────────────────────────────

// งานเสริมพวกนี้ห้ามทำให้แอปเปิดไม่ขึ้น ถ้าพังก็แค่ข้ามไป
try { applyTheme(); } catch (e) {}
try { watchSystemTheme(() => render()); } catch (e) {}

subscribe(render);

window.addEventListener('ac:rerender', render);
auth.onChange(render);

// รับลิงก์ย้ายเครื่อง (#c=...) ก่อนอย่างอื่น
try { api.conn.applyTransferFromHash(); } catch (e) {}

// เผื่อเซิร์ฟเวอร์ไม่ตอบเลย — อย่าปล่อยให้หมุนค้างไม่มีที่สิ้นสุด
setTimeout(() => {
  if (document.getElementById('boot')) {
    showFatal(new Error('เชื่อมต่อกับ Google Sheet ไม่สำเร็จภายใน 20 วินาที\n\n' +
      'มักเกิดจาก: โค้ดในชีตยังไม่ได้ Deploy เวอร์ชันใหม่ · ลิงก์ที่เปิดเป็น Deployment เก่า · หรืออินเทอร์เน็ตหลุด'));
  }
}, 20000);

// ── PWA: ใช้ได้เฉพาะตอนเสิร์ฟจากโฮสต์ปกติ ──────────────────
// โหมดที่ Apps Script เสิร์ฟเอง อยู่ใน iframe ปิด ลงทะเบียน service worker ไม่ได้
if (api.MODE === 'remote' && 'serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  state.installPrompt = e;
  render();
});
window.addEventListener('appinstalled', () => { state.installPrompt = null; render(); });

(async function start() {
  try {
    if (api.conn.ready) {
      try {
        await bootstrap();
        const want = api.lastClass.get();
        const pick = state.classes.find(c => c.classId === want) || state.classes[0];
        if (pick) await loadClass(pick.classId);
      } catch (e) {
        if (e instanceof api.ApiError && (e.code === 'AUTH' || e.code === 'FORBIDDEN')) {
          toast(e.message + ' — กรุณาเชื่อมต่อใหม่', 'err', 6000);
          if (e.code === 'AUTH') auth.signOut(); else api.conn.clear();
        }
      }
      sync();
    }
    render();
  } catch (e) {
    showFatal(e);
  } finally {
    // ต้องเอาหน้าโหลดออกเสมอ ไม่ว่าจะเกิดอะไรขึ้น — ค้างที่โลโก้แล้วผู้ใช้ทำอะไรไม่ได้เลย
    boot.remove();
    app.hidden = false;
  }
})();

