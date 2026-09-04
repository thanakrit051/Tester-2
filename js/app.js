/* AssignCheck V2 — จุดเริ่มต้นแอป: เปลือกหน้าจอ + เราเตอร์ */

import { h, mount, toast, closeTopModal } from './dom.js';
import * as api from './api.js';
import { state, subscribe, bootAll, loadClass, sync, isSyncing, go, pushView } from './state.js';
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
import { APP_VERSION, NEEDS_SERVER, cmpVersion } from './version.js';

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
 * เอาหน้าโหลดออกแล้วโชว์แอป
 *
 * เรียกทันทีที่วาดหน้าได้ครั้งแรก ไม่ใช่รอจนกว่าเน็ตจะตอบ
 * เดิมรอ bootAll() จบก่อนเสมอ ผลคือครูที่มีข้อมูลในเครื่องครบอยู่แล้ว
 * ยังต้องนั่งดูโลโก้หมุน 20 วินาทีตอนสัญญาณไม่ดี แล้วจบด้วยหน้า
 * "เปิดแอปไม่สำเร็จ" ทั้งที่กดใช้งานออฟไลน์ได้ตั้งนานแล้ว
 *
 * ผลพลอยได้: หน้าหมดเวลา 20 วินาทีด้านล่างจะขึ้นเฉพาะตอนที่ยังวาดอะไร
 * ไม่ได้จริง ๆ เท่านั้น ไม่ไปทับของที่ครูใช้งานอยู่
 */
function reveal() {
  const b = document.getElementById('boot');
  if (b) b.remove();
  if (app.hidden) app.hidden = false;
}

let bootDone = false;   // true = ยิงขอข้อมูลรอบแรกจบแล้ว (สำเร็จหรือล้มก็ตาม)

/**
 * มีของให้ดูจริงหรือยัง
 *
 * เปิดหน้าโล่งทันทีตอนที่ยังไม่มีทั้งแคชและคำตอบจากชีต
 * ครูจะเห็น "ยังไม่มีห้องเรียน · สร้างห้องเรียนแรก" ค้างอยู่ 1-3 วินาที
 * (Apps Script ตอบช้าขนาดนั้น) แล้วอาจกดสร้างห้องซ้ำทั้งที่มีอยู่แล้ว
 * — หน้าโหลดหมุน ๆ ยังดีกว่าคำตอบผิดที่ดูเหมือนคำตอบจริง
 */
function readyToShow() {
  if (bootDone) return true;                        // โหลดจบแล้ว ไม่ว่าผลจะเป็นยังไง
  if (!api.conn.ready) return true;                 // หน้าติดตั้ง — ไม่ต้องรอเน็ต
  return state.classes.length > 0 || !!state.cls;   // มีของจากแคชให้ดูแล้ว
}

/* ── รายงานปัญหา ───────────────────────────────────────────
 *
 * เดิมหน้าจอบอกครูว่า "ส่งข้อความนี้ให้คนดูแลระบบ" ซึ่งในทางปฏิบัติไม่มีใครส่ง
 * เพราะต้องพิมพ์เอง คนดูแลจึงไม่รู้เลยว่ามีอะไรพัง จนกว่าจะมีคนโทรมาบ่น
 *
 * ตรงนี้จึงรวบบริบทที่ต้องใช้ไล่ปัญหาไว้ที่เดียว แล้ว
 *   · ส่งขึ้นชีตเงียบ ๆ (ถ้าโค้ดในชีตยังเก่าก็แค่เงียบไป ไม่มีอะไรเสีย)
 *   · มีปุ่มคัดลอกไว้ให้ เผื่อตอนนั้นต่อเน็ตไม่ได้เลย
 */
function problemReport(msg) {
  return [
    'AssignCheck v' + APP_VERSION,
    'หน้าที่ค้างอยู่: ' + state.view,
    'งานค้างในคิว: ' + api.queue.size,
    'ออนไลน์: ' + (navigator.onLine ? 'ใช่' : 'ไม่'),
    'โค้ดในชีต: v' + (api.serverInfo.version || 'ไม่ทราบ'),
    'เบราว์เซอร์: ' + navigator.userAgent,
    '',
    msg
  ].join('\n');
}

let reported = false;

/** ส่งขึ้นชีตครั้งเดียวต่อการเปิดแอปหนึ่งรอบ — ต่อให้พังวนลูปก็ไม่ยิงรัว */
function reportProblem(msg) {
  if (reported) return;
  reported = true;
  try {
    if (!api.conn.ready) return;
    api.call('logError', {
      message: String(msg).slice(0, 1500),
      version: APP_VERSION,
      view: state.view,
      queued: api.queue.size,
      ua: navigator.userAgent
    }).catch(() => {});
  } catch (e) {
    // รายงานปัญหาห้ามกลายเป็นปัญหาเสียเอง
  }
}

/** ปุ่มคัดลอกรายงาน — ครูส่งต่อให้คนดูแลได้ในคลิกเดียว */
function copyReportBtn(msg) {
  return h('button', {
    class: 'btn btn-ghost', style: { flex: '1' },
    onclick: async (e) => {
      const btn = e.currentTarget;
      try {
        await navigator.clipboard.writeText(problemReport(msg));
        btn.textContent = 'คัดลอกแล้ว ✓';
      } catch (err) {
        btn.textContent = 'คัดลอกไม่ได้ — ลากคลุมข้อความด้านบนแทน';
      }
    }
  }, 'คัดลอกรายงาน');
}

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
        'ลองกดโหลดใหม่ก่อน ถ้ายังไม่หาย ให้กดคัดลอกรายงานแล้วส่งให้คนดูแลระบบ'),
      h('pre', {
        style: {
          background: 'var(--surface-3)', padding: '11px 13px', borderRadius: '10px',
          fontSize: '12px', whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: '0 0 12px'
        }
      }, msg),
      h('div', { class: 'btn-row' },
        copyReportBtn(msg),
        h('button', { class: 'btn', style: { flex: '1' }, onclick: () => location.reload() }, 'โหลดใหม่'))
    )));
  reportProblem(msg);
}

// กันไว้อีกชั้น — พังตรงไหนก็ตาม อย่างน้อยต้องไม่ค้างที่หน้าโหลด
window.addEventListener('error', (e) => {
  if (document.getElementById('boot')) showFatal(e.error || e.message);
});
window.addEventListener('unhandledrejection', (e) => {
  if (document.getElementById('boot')) showFatal(e.reason);
});

// ── เปลือกหน้าจอ ────────────────────────────────────────────

/** จอกว้าง = เมนูไปอยู่ในแถบหัวสีเข้ม (ตามดีไซน์ PC) · จอแคบ = เมนูล่างจอ */
const wide = () => {
  try { return matchMedia('(min-width: 900px)').matches; } catch (e) { return false; }
};

/**
 * ป้ายบอกสถานะซิงค์ — แยกออกมาเพราะเปลี่ยนบ่อยกว่าส่วนอื่นของแถบหัวมาก
 * อัปเดตเฉพาะช่องนี้ ไม่ต้องวาดทั้งหน้าใหม่ (กันเคอร์เซอร์เด้งตอนพิมพ์คะแนน)
 */
function syncBits() {
  const online = navigator.onLine;
  const pending = api.queue.size;
  return [
    pending > 0 && h('span', { class: 'sync-pill' + (online ? '' : ' off') },
      isSyncing() ? 'กำลังซิงค์…' : `ค้าง ${pending}`),
    !online && h('span', { class: 'sync-pill off' }, 'ออฟไลน์'),
    // ตัวเลขที่เห็นมาจากสำเนาในเครื่อง ยังไม่ได้คุยกับชีตรอบนี้
    // เดิมมี state.stale แต่ไม่เคยเอามาแสดง ครูจึงแยกไม่ออกว่ากำลังดูของสดหรือของเก่า
    online && state.stale && h('span', {
      class: 'sync-pill off',
      title: 'ยังต่อชีตไม่ได้รอบนี้ — ตัวเลขที่เห็นเป็นสำเนาล่าสุดในเครื่อง'
    }, 'ข้อมูลในเครื่อง')
  ].filter(Boolean);
}

function refreshSyncSlot() {
  const slot = document.querySelector('.appbar .sync-slot');
  if (slot) slot.replaceChildren(...syncBits());
}

/**
 * แถบบาง ๆ ด้านบนจอ บอกว่ากำลังคุยกับชีตอยู่
 *
 * Apps Script ตอบ 1-3 วินาที ถ้าไม่มีอะไรขยับเลยระหว่างนั้น
 * ผู้ใช้จะรู้สึกว่าแอปค้าง มากกว่ารู้สึกว่ากำลังโหลด
 * แตะ DOM ตรง ๆ ไม่ผ่าน render() เพราะสถานะนี้เปลี่ยนถี่มาก
 * และห้ามทำให้ช่องกรอกคะแนนที่ครูพิมพ์อยู่ถูกวาดใหม่
 */
function refreshNetBar() {
  let bar = document.getElementById('netbar');
  if (!bar) {
    bar = h('div', { id: 'netbar', class: 'netbar', 'aria-hidden': 'true' });
    document.body.appendChild(bar);
  }
  bar.dataset.on = api.isBusy() ? '1' : '0';
}

function appbar() {
  return h('header', { class: 'appbar' },
    h('div', { class: 'brand' }, 'A'),
    h('div', { style: wide() ? { minWidth: '0' } : { flex: '1', minWidth: '0' } },
      h('div', { class: 'appbar-title' }, 'AssignCheck'),
      h('div', { class: 'appbar-sub' },
        state.config.year ? `${state.config.year} · เทอม ${state.config.term || '-'}` : 'เช็คชื่อ · เช็คงาน · สรุป SGS')
    ),
    wide() && nav(),
    wide() && classChip(),
    h('span', { class: 'sync-slot' }, ...syncBits()),
    h('button', {
      class: 'icon-btn', title: 'ซิงค์ข้อมูล', 'aria-label': 'ซิงค์ข้อมูล',
      onclick: async (e) => {
        const s = e.currentTarget.firstElementChild;
        if (s) s.style.animation = 'spin .7s linear infinite';
        await sync({ loud: true });
        await bootAll();          // อ่านใหม่ทั้งตั้งค่าและห้องปัจจุบันในรอบเดียว
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

/** PC: ห้องที่เลือกอยู่เป็นชิปในแถบหัวสีเข้ม (ดีไซน์หน้า 02–05) */
function classChip() {
  if (!state.classes.length) return null;
  if (!['att', 'work', 'report', 'summary'].includes(state.view)) return null;
  return h('div', { class: 'class-chip' },
    h('select', {
      'aria-label': 'เลือกห้องเรียน',
      value: state.classId,
      onchange: (e) => loadClass(e.target.value)
    }, state.classes.map(c => h('option', { value: c.classId, selected: c.classId === state.classId },
      `${[c.grade, c.room].filter(Boolean).join('/')} ${c.subject}`)))
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

  // ดีไซน์ให้ "บริบทของหน้า" อยู่ในแถบเข้มบนมือถือ — แถบนั้นจึงมาแทน
  // แถบ AssignCheck ทั่วไป ไม่ใช่ซ้อนกันสองชั้น (บน PC แถบทั่วไปอยู่คงที่)
  const head = (!wide() && typeof view.head === 'function') ? view.head() : null;

  mount(app,
    h('div', { class: 'shell' },
      head || appbar(),
      alert && state.view !== 'health' && h('button', {
        class: 'alert-bar' + (alert.level === 'warn' ? ' warn' : ''),
        onclick: () => go('health')
      }, h('span', null, (alert.level === 'warn' ? '⚠️ ' : '❌ ') + alert.text), h('b', null, 'แก้ ›')),
      !wide() && nav(),
      !head && classPicker(),
      view()
    )
  );

  if (readyToShow()) reveal();
}

/**
 * วาดหน้าจอแบบมีตาข่ายรับ
 *
 * ถ้า view ไหน throw ขึ้นมา (ข้อมูลรูปแบบแปลก · ค่าที่ไม่ได้เผื่อไว้)
 * ของเดิมจะดันขึ้นไปถึงคนที่เรียก emit() ทำให้ปุ่มที่เพิ่งกดพังตามไปด้วย
 * แล้วทุกการกดหลังจากนั้นก็พังซ้ำ — หน้าจอค้างอยู่กับที่ กดอะไรก็ไม่ขยับ
 * และไม่มีข้อความบอกสักคำ ครูจะนึกว่าแอปแฮงก์
 *
 * ตรงนี้จึงกันไว้ให้เหลือหน้าที่มีทางออกเสมอ
 */
function safeRender() {
  try { render(); }
  catch (err) {
    console.error(err);
    try { showBroken(err); } catch (e) { showFatal(err); }
  }
}

/** หน้าจอสำรองตอน view พัง — ยังกลับหน้าแรกหรือไปตั้งค่าได้ */
function showBroken(err) {
  const msg = String((err && (err.message || err.stack)) || err || 'ไม่ทราบสาเหตุ');
  reveal();
  mount(app, h('div', { class: 'page' },
    h('div', { class: 'card' },
      h('div', { style: { fontSize: '17px', fontWeight: '700', marginBottom: '8px' } }, 'หน้านี้เปิดไม่ขึ้น'),
      h('div', { style: { fontSize: '13.5px', color: 'var(--ink-2)', marginBottom: '12px', lineHeight: '1.6' } },
        'ข้อมูลที่กรอกไว้ยังอยู่ครบและยังส่งขึ้นชีตตามปกติ — กลับไปหน้าอื่นแล้วใช้งานต่อได้เลย'),
      h('pre', {
        style: {
          background: 'var(--surface-3)', padding: '11px 13px', borderRadius: '10px',
          fontSize: '12px', whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: '0 0 12px'
        }
      }, msg),
      h('div', { class: 'btn-row' },
        h('button', { class: 'btn', style: { flex: '1' }, onclick: () => go('home') }, 'กลับหน้าแรก'),
        copyReportBtn(msg))
    )));
  reportProblem(msg);
}

// ── เราเตอร์ ────────────────────────────────────────────────

/**
 * ชื่อหน้าที่อ่านจาก URL → หน้าที่เปิดได้จริง (คืน '' ถ้าเปิดไม่ได้)
 *
 * ลิงก์ที่ส่งต่อกันมาอาจชี้หน้าที่ต้องเลือกห้องเรียนก่อน ถ้าปล่อยให้เปิดตรง ๆ
 * view จะ throw แล้วไปโผล่หน้า "หน้านี้เปิดไม่ขึ้น" ทั้งที่แค่ควรเด้งกลับหน้าแรก
 */
function resolveView(id) {
  if (!id) return '';
  if (EXTRA_VIEWS[id]) return id;
  const n = NAV.find(x => x.id === id);
  if (!n) return '';
  if (n.needClass && !state.classId) return '';
  return id;
}

const viewFromHash = () => {
  try { return decodeURIComponent(String(location.hash || '').replace(/^#/, '')); }
  catch (e) { return ''; }
};

window.addEventListener('popstate', (e) => {
  // มีกล่องเปิดค้างอยู่ → ปุ่มย้อนกลับปิดกล่องก่อน (พฤติกรรมที่คนใช้มือถือคาดหวัง)
  // แล้วคืนตำแหน่งในประวัติกลับที่เดิม เพื่อไม่ให้หน้าเปลี่ยนตามไปด้วย
  if (closeTopModal()) { pushView(state.view); return; }

  const want = (e.state && e.state.acView) || viewFromHash() || 'home';
  const ok = resolveView(want) || 'home';
  go(ok, { silent: true });
  if (ok !== want) pushView(ok, true);   // เปิดหน้าที่ขอไม่ได้ → แก้ URL ให้ตรงกับที่เห็นจริง
});

// ── เริ่มทำงาน ──────────────────────────────────────────────

// งานเสริมพวกนี้ห้ามทำให้แอปเปิดไม่ขึ้น ถ้าพังก็แค่ข้ามไป
try { applyTheme(); } catch (e) {}
try { watchSystemTheme(() => safeRender()); } catch (e) {}

subscribe(safeRender);

// สลับ mobile ↔ desktop แล้วต้องวาดใหม่ เพราะเมนูอยู่คนละที่
// ใช้ event ของ media query โดยตรง — เชื่อถือได้กว่าดัก resize
try {
  matchMedia('(min-width: 900px)').addEventListener('change', () => safeRender());
} catch (e) {
  window.addEventListener('resize', () => safeRender());
}

window.addEventListener('ac:rerender', safeRender);
window.addEventListener('ac:sync', refreshSyncSlot);
window.addEventListener('ac:busy', refreshNetBar);
auth.onChange(safeRender);

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
    navigator.serviceWorker.register('./sw.js').then(watchUpdate).catch(() => {});
  });
}

/**
 * มีเวอร์ชันใหม่รออยู่ → บอกครูแล้วให้เลือกจังหวะรีเฟรชเอง
 *
 * คู่กับการที่ sw.js เลิกเรียก skipWaiting() ตอนติดตั้ง
 * ถ้าไม่มีอะไรบอกเลย ครูจะติดอยู่กับโค้ดเก่าจนกว่าจะปิดแท็บแอปให้หมดทุกแท็บ
 */
function watchUpdate(reg) {
  if (!reg) return;

  // รีเฟรชเฉพาะตอนที่ครูกดเองเท่านั้น
  // controllerchange ยิงตอนติดตั้งครั้งแรกด้วย ถ้ารีโหลดทุกครั้งที่ยิง
  // ครูจะโดนหน้าเด้งใหม่ตั้งแต่เปิดแอปครั้งแรกโดยไม่มีเหตุผล
  let wantReload = false;
  try {
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!wantReload) return;
      wantReload = false;
      location.reload();
    });
  } catch (e) {}

  const offer = (worker) => toast('มีเวอร์ชันใหม่พร้อมใช้', '', 12000, {
    label: 'รีเฟรช',
    onclick: () => { wantReload = true; try { worker.postMessage('skipWaiting'); } catch (e) {} }
  });

  // เข้าหน้ามาแล้วเจอของใหม่ค้างรออยู่ตั้งแต่รอบก่อน
  if (reg.waiting && navigator.serviceWorker.controller) offer(reg.waiting);

  reg.addEventListener('updatefound', () => {
    const w = reg.installing;
    if (!w) return;
    w.addEventListener('statechange', () => {
      // มี controller อยู่ = ไม่ใช่การติดตั้งครั้งแรก แปลว่าเป็นของใหม่มาแทนของเก่าจริง
      if (w.state === 'installed' && navigator.serviceWorker.controller) offer(w);
    });
  });
}
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  state.installPrompt = e;
  safeRender();
});
window.addEventListener('appinstalled', () => { state.installPrompt = null; safeRender(); });

(async function start() {
  try {
    if (api.conn.ready) {
      try {
        await bootAll();          // ยิงครั้งเดียวได้ทั้งตั้งค่า รายชื่อห้อง และห้องที่เปิดค้างไว้
      } catch (e) {
        if (e instanceof api.ApiError && (e.code === 'AUTH' || e.code === 'FORBIDDEN')) {
          toast(e.message + ' — กรุณาเชื่อมต่อใหม่', 'err', 6000);
          if (e.code === 'AUTH') auth.signOut(); else api.conn.clear();
        }
      }
      sync();

      // เปิดหน้าตามที่อยู่ใน URL — ต้องหลัง bootAll เพราะก่อนหน้านั้น
      // ยังไม่รู้ว่ามีห้องเรียนค้างไว้ไหม หน้าที่ต้องใช้ห้องจึงตัดสินไม่ได้
      const first = resolveView(viewFromHash()) || 'home';
      state.view = first;
      pushView(first, true);
    }
    safeRender();
  } catch (e) {
    showFatal(e);
  } finally {
    // ต้องเอาหน้าโหลดออกเสมอ ไม่ว่าจะเกิดอะไรขึ้น — ค้างที่โลโก้แล้วผู้ใช้ทำอะไรไม่ได้เลย
    bootDone = true;
    reveal();
  }
})();

