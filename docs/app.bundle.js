/* สร้างอัตโนมัติจาก tools/build-webapp.mjs — อย่าแก้ไฟล์นี้โดยตรง */
(function () {
  'use strict';
  var __defs = {}, __cache = {};
  function __req(id) {
    if (__cache[id]) return __cache[id];
    if (!__defs[id]) throw new Error('ไม่พบโมดูล ' + id);
    var exports = {};
    __cache[id] = exports;            // ใส่ก่อนรัน เพื่อรองรับการอ้างอิงวน
    __defs[id](exports, __req);
    return exports;
  }
  function __exp(exports, obj) { for (var k in obj) exports[k] = obj[k]; }

  __defs["js/app.js"] = function (exports, __req) {
/* AssignCheck V2 — จุดเริ่มต้นแอป: เปลือกหน้าจอ + เราเตอร์ */

const { h, mount, toast } = __req("js/dom.js");
const api = __req("js/api.js");
const { state, subscribe, bootAll, loadClass, sync, isSyncing, go } = __req("js/state.js");
const { auth } = __req("js/auth.js");
const { icon } = __req("js/icons.js");
const { applyTheme, watchSystemTheme } = __req("js/theme.js");

const { viewSetup } = __req("js/views/setup.js");
const { viewHome } = __req("js/views/home.js");
const { viewAttendance } = __req("js/views/attendance.js");
const { viewWork } = __req("js/views/work.js");
const { viewSummary } = __req("js/views/summary.js");
const { viewReport } = __req("js/views/report.js");
const { viewSettings } = __req("js/views/settings.js");
const { viewHealth } = __req("js/views/health.js");
const { NEEDS_SERVER, cmpVersion } = __req("js/version.js");

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
        h('button', { class: 'btn btn-ghost', style: { flex: '1' }, onclick: () => location.reload() }, 'โหลดใหม่'))
    )));
}

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
    navigator.serviceWorker.register('./sw.js').catch(() => {});
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


  };

  __defs["js/dom.js"] = function (exports, __req) {
/* AssignCheck V2 — ตัวช่วย DOM ขนาดเล็ก (ไม่มี framework) */

/**
 * สร้าง element
 *   h('div', { class:'card', onclick: fn }, 'ข้อความ', h('b', null, 'ตัวหนา'))
 * รับ null/false/undefined ใน children ได้ (จะถูกข้าม)
 */
function h(tag, props, ...children) {
  const el = document.createElement(tag);
  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (v === null || v === undefined || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (k === 'html') el.innerHTML = v;
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else if (k === 'value' || k === 'checked' || k === 'disabled' || k === 'hidden') el[k] = v;
      else el.setAttribute(k, v === true ? '' : v);
    }
  }
  add(el, children);
  return el;
}

function add(el, kids) {
  for (const c of kids) {
    if (c === null || c === undefined || c === false || c === true) continue;
    if (Array.isArray(c)) add(el, c);
    else el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}

function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); return el; }

function mount(el, ...children) { clear(el); add(el, children); return el; }

// ── Toast ───────────────────────────────────────────────────
function toast(msg, kind = '', ms = 2400) {
  const root = document.getElementById('toasts');
  const t = h('div', { class: 'toast ' + kind }, msg);
  root.append(t);
  setTimeout(() => {
    t.style.transition = 'opacity .2s'; t.style.opacity = '0';
    setTimeout(() => t.remove(), 220);
  }, ms);
}

// ── Modal ───────────────────────────────────────────────────
/**
 * เปิดกล่องโต้ตอบ
 * builder(close) ต้องคืน element ที่จะใส่ในกล่อง
 */
function modal(builder) {
  const root = document.getElementById('modal-root');
  const back = h('div', { class: 'modal-back' });
  const close = () => { back.remove(); document.body.style.overflow = ''; };
  const box = h('div', { class: 'modal', onclick: (e) => e.stopPropagation() });
  back.addEventListener('click', close);
  box.append(builder(close));
  back.append(box);
  root.append(back);
  document.body.style.overflow = 'hidden';
  const first = box.querySelector('input,select,textarea');
  if (first) setTimeout(() => first.focus(), 60);
  return close;
}

function confirmBox(title, message, confirmLabel = 'ยืนยัน') {
  return new Promise((resolve) => {
    modal((close) => h('div', null,
      h('h2', null, title),
      h('p', { style: { color: 'var(--ink-2)', marginTop: 0 } }, message),
      h('div', { class: 'btn-row', style: { marginTop: '14px' } },
        h('button', { class: 'btn btn-ghost', style: { flex: '1' }, onclick: () => { close(); resolve(false); } }, 'ยกเลิก'),
        h('button', { class: 'btn btn-danger', style: { flex: '1' }, onclick: () => { close(); resolve(true); } }, confirmLabel)
      )
    ));
  });
}

// ── ฟอร์แมต ─────────────────────────────────────────────────
const TH_MONTH = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
const TH_DAY = ['อาทิตย์','จันทร์','อังคาร','พุธ','พฤหัสบดี','ศุกร์','เสาร์'];

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function fmtDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} ${TH_MONTH[m - 1]} ${(y + 543) % 100}`;
}

/** "ศุกร์ 7 ส.ค. 69" — ใส่ชื่อวันเพื่อให้ครูมั่นใจว่าเลือกวันถูก */
function fmtDayFull(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  const dow = TH_DAY[new Date(iso + 'T00:00:00').getDay()];
  return `${dow} ${d} ${TH_MONTH[m - 1]} ${(y + 543) % 100}`;
}

function isToday(iso) { return iso === todayISO(); }

function nf(v, digits = 2) {
  const n = Number(v);
  if (isNaN(n)) return String(v ?? '');
  return String(Math.round(n * 10 ** digits) / 10 ** digits);
}

__exp(exports, { h, clear, mount, toast, modal, confirmBox, todayISO, fmtDate, fmtDayFull, isToday, nf });

  };

  __defs["js/api.js"] = function (exports, __req) {
/* AssignCheck V2 — ตัวเชื่อม Apps Script + คิวงานออฟไลน์ */

const { auth } = __req("js/auth.js");
const { store } = __req("js/storage.js");

const LS = {
  url:   'ac.url',
  key:   'ac.key',
  queue: 'ac.queue',
  cache: 'ac.cache.',
  lastClass: 'ac.lastClass'
};

/* เก็บผ่าน store — ถ้าเบราว์เซอร์บล็อก localStorage มันจะสลับไปใช้หน่วยความจำให้เอง
 * สำคัญมากกับคิวงาน เพราะถ้าเขียนไม่ลงแล้วเงียบ คะแนนที่ครูกรอกจะไม่ถูกส่งขึ้นชีตเลย */
const lsGet = (k) => store.get(k);
const lsSet = (k, v) => store.set(k, v);
const lsDel = (k) => store.del(k);
const lsKeys = () => store.keys();

/** true = ข้อมูลถูกเก็บลงเครื่องจริง · false = อยู่แค่ในแท็บนี้ ปิดแล้วหาย */
const storagePersistent = () => store.persistent;

/**
 * โหมดการทำงาน
 *   'embedded' = หน้าเว็บถูกเสิร์ฟโดย Apps Script เอง — คุยผ่าน google.script.run
 *                Google บังคับล็อกอินให้แล้ว ไม่ต้องมี URL/รหัสลับ
 *   'remote'   = หน้าเว็บอยู่คนละที่ (GitHub Pages / localhost) — คุยผ่าน fetch
 */
const MODE = (typeof google !== 'undefined' && google.script && google.script.run)
  ? 'embedded' : 'remote';

const conn = {
  get url() { return lsGet(LS.url) || ''; },
  get key() { return lsGet(LS.key) || ''; },
  /** พร้อมใช้เมื่อมี URL และมีวิธียืนยันตัวตนอย่างน้อย 1 อย่าง */
  get ready() { return MODE === 'embedded' || !!(this.url && (this.key || auth.signedIn)); },
  get method() {
    if (MODE === 'embedded') return 'embedded';
    return auth.signedIn ? 'google' : (this.key ? 'key' : 'none');
  },
  save(url, key) {
    lsSet(LS.url, String(url || '').trim());
    if (key !== undefined) lsSet(LS.key, String(key || '').trim());
  },
  clear() {
    lsDel(LS.url);
    lsDel(LS.key);
    auth.signOut();
  },

  /** ถามข้อมูลสาธารณะจากปลายทาง (ไม่ต้องยืนยันตัวตน) เพื่อรู้ Client ID */
  async probe(url) {
    const u = String(url).trim();
    const res = await fetch(u + (u.includes('?') ? '&' : '?') + 'api=1', { method: 'GET', redirect: 'follow' });
    const text = await res.text();
    try { return JSON.parse(text); }
    catch { throw new ApiError('URL ไม่ถูกต้อง หรือ Deploy ยังไม่ได้ตั้ง "Who has access: Anyone"'); }
  },

  /** ลิงก์ย้ายเครื่อง — เปิดบนเครื่องใหม่แล้วเชื่อมต่อให้อัตโนมัติ */
  transferLink() {
    const payload = btoa(unescape(encodeURIComponent(JSON.stringify({
      u: this.url, k: this.key, c: auth.clientId
    }))));
    return location.origin + location.pathname + '#c=' + payload;
  },

  /** อ่านลิงก์ย้ายเครื่องจาก URL (เรียกตอนเปิดแอป) */
  applyTransferFromHash() {
    const m = location.hash.match(/#c=([A-Za-z0-9+/=]+)/);
    if (!m) return false;
    try {
      const d = JSON.parse(decodeURIComponent(escape(atob(m[1]))));
      if (!d.u) return false;
      this.save(d.u, d.k || '');
      if (d.c) auth.clientId = d.c;
      history.replaceState(null, '', location.pathname);
      return true;
    } catch { return false; }
  }
};

// ── แคช (เก็บสำเนาไว้ใช้ตอนออฟไลน์) ────────────────────────
const cache = {
  get(name) {
    try { return JSON.parse(lsGet(LS.cache + name)); }
    catch { return null; }
  },
  set(name, value) {
    if (!lsSet(LS.cache + name, JSON.stringify(value))) console.warn('เก็บแคชไม่ได้');
  },
  del(name) { lsDel(LS.cache + name); },
  clearAll() {
    lsKeys().filter(k => k.startsWith(LS.cache)).forEach(lsDel);
  }
};

const lastClass = {
  get() { return lsGet(LS.lastClass) || ''; },
  set(id) { lsSet(LS.lastClass, id || ''); }
};

// ── เรียก API ───────────────────────────────────────────────
class ApiError extends Error {
  constructor(message, code) { super(message); this.code = code; }
}
class OfflineError extends Error {}

/**
 * ยิงคำสั่งไปที่ Apps Script
 * ใช้ Content-Type: text/plain เพื่อเลี่ยง CORS preflight
 */
/** ส่งคำขอออกไป — เลือกช่องทางตามโหมด คืนค่าเป็นข้อความดิบ */
function post(body) {
  if (MODE === 'embedded') {
    return new Promise((resolve, reject) => {
      google.script.run
        .withSuccessHandler(resolve)
        .withFailureHandler((err) => reject(new OfflineError(err && err.message || 'เรียกเซิร์ฟเวอร์ไม่สำเร็จ')))
        .apiCall(JSON.stringify(body));
    });
  }
  return fetch(conn.url, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(body),
    redirect: 'follow'
  }).then(r => r.text(), () => { throw new OfflineError('เชื่อมต่อไม่ได้'); });
}

/**
 * มีคำขอค้างอยู่กี่รายการ — ใช้โชว์แถบกำลังโหลด
 *
 * Apps Script ตอบ 1-3 วินาที ถ้าไม่มีอะไรขยับบนจอเลยระหว่างนั้น
 * ผู้ใช้จะรู้สึกว่าแอปค้าง ไม่ใช่แค่ช้า (ของเดิมมี state.busy แต่ไม่มีใครอ่าน)
 */
let inflight = 0;
const isBusy = () => inflight > 0;
function setBusy(delta) {
  inflight = Math.max(0, inflight + delta);
  try { window.dispatchEvent(new CustomEvent('ac:busy')); } catch (e) {}
}

async function call(action, payload = {}) {
  if (!conn.ready) throw new ApiError('ยังไม่ได้เชื่อมต่อกับ Google Sheet', 'NOCONN');

  // ส่งข้อมูลยืนยันตัวตนไปทั้ง 2 แบบ ฝั่งเซิร์ฟเวอร์รับอันไหนก็ได้ที่ผ่าน
  setBusy(1);
  let text;
  try { text = await post({ key: conn.key, idToken: auth.token, action, payload }); }
  finally { setBusy(-1); }

  let body;
  try { body = JSON.parse(text); }
  catch {
    throw new ApiError(
      text.includes('<!DOCTYPE') || text.includes('Google Drive')
        ? 'URL ไม่ถูกต้อง หรือ Deploy ยังไม่ได้ตั้ง "Who has access: Anyone"'
        : 'ตอบกลับผิดรูปแบบ'
    );
  }
  // จำเวอร์ชันของโค้ดฝั่งชีตไว้ เพื่อเตือนเมื่อยังไม่ได้ Deploy ตัวใหม่
  serverInfo.version = body.version || '';
  serverInfo.seen = true;
  if (body.user) serverInfo.user = body.user;

  if (!body.ok) throw new ApiError(body.error || 'เกิดข้อผิดพลาด', body.code);
  return body.data;
}

/** ข้อมูลของปลายทางที่รู้จากคำตอบล่าสุด */
const serverInfo = { version: '', seen: false, user: null };

// ── คิวงานออฟไลน์ ──────────────────────────────────────────
const queue = {
  all() {
    try { return JSON.parse(lsGet(LS.queue)) || []; }
    catch { return []; }
  },
  set(list) { lsSet(LS.queue, JSON.stringify(list)); },
  get size() { return this.all().length; },

  /**
   * ต่อคิว — รวมคำสั่ง setCells ของห้องเดียวกันเข้าด้วยกันเพื่อลดจำนวน request
   *
   * ห้ามรวมเข้ากับก้อนที่กำลังส่งอยู่ (sending)
   * ก้อนนั้นถูกถ่ายสำเนาไปทำ request แล้ว แก้ทีหลังไม่มีผลกับสิ่งที่ส่งออกไป
   * แต่ตอนส่งเสร็จมันจะถูกลบทั้งก้อน — สิ่งที่เพิ่งกดจะหายเงียบ ๆ
   * (Apps Script ตอบ 1–3 วินาที ช่วงนี้ครูกดต่อได้อีกหลายครั้ง)
   */
  push(action, payload) {
    const list = this.all();
    if (action === 'setCells') {
      const last = list[list.length - 1];
      if (last && !last.sending && last.action === 'setCells' && last.payload.classId === payload.classId) {
        const map = new Map(last.payload.cells.map(c => [c.key + '\0' + c.sid, c]));
        for (const c of payload.cells) map.set(c.key + '\0' + c.sid, c);
        last.payload.cells = [...map.values()];
        this.set(list);
        return;
      }
    }
    list.push({ id: Date.now() + '-' + Math.random().toString(36).slice(2, 7), action, payload });
    this.set(list);
  },

  /** ปักธงว่ากำลังส่งอยู่ / ปลดธงเมื่อส่งไม่สำเร็จ */
  mark(ids, sending) {
    const set = new Set(ids);
    const list = this.all();
    for (const o of list) if (set.has(o.id)) { if (sending) o.sending = true; else delete o.sending; }
    this.set(list);
  },

  /** จำนวนครั้งที่งานในคิวถูกส่งแล้วไม่ผ่านมากที่สุด — ใช้ถ่างจังหวะลองใหม่ */
  maxTries() { return this.all().reduce((a, o) => Math.max(a, o.tries || 0), 0); },

  /** งานที่ลองส่งซ้ำหลายรอบแล้วยังไม่ผ่าน — เอาไปแสดงในหน้าตรวจสภาพ */
  stuck(min = 3) { return this.all().filter(o => (o.tries || 0) >= min); },

  clear() { this.set([]); }
};

let flushing = false;

/** ส่งงานค้างทั้งหมดเป็น batch เดียว */
async function flush() {
  if (flushing) return { skipped: true };
  const ops = queue.all();
  if (!ops.length) return { sent: 0 };
  if (!conn.ready) return { sent: 0 };

  flushing = true;
  // ปักธงก่อนยิง เพื่อไม่ให้สิ่งที่กดระหว่างรอคำตอบถูกรวมเข้าก้อนนี้แล้วหายไปพร้อมกัน
  queue.mark(ops.map(o => o.id), true);
  try {
    const res = await call('batch', { ops: ops.map(o => ({ action: o.action, payload: o.payload })) });
    const results = res.results || [];

    // ลบออกจากคิวเฉพาะงานที่เซิร์ฟเวอร์ยืนยันว่าสำเร็จ
    // ของเดิมลบทั้งก้อนรวมงานที่ล้มเหลวด้วย — คะแนนช่องนั้นหายถาวรทั้งที่ยังไม่ได้ลงชีต
    // (พลาดรอบเดียวเพราะชีตติดล็อกชั่วคราว ก็เสียข้อมูลแล้ว)
    const okIds = new Set();
    const failed = [];
    ops.forEach((o, i) => {
      const r = results[i];
      if (r && r.ok) { okIds.add(o.id); return; }
      failed.push({ ...o, error: (r && r.error) || 'เซิร์ฟเวอร์ตอบกลับไม่ครบ' });
    });

    // งานที่ยังไม่ผ่านต้องกลับไปอยู่หน้าคิว เพื่อรักษาลำดับก่อน-หลังของการแก้ค่า
    const retry = failed.map(({ error, sending, ...o }) => ({ ...o, tries: (o.tries || 0) + 1 }));
    const sentIds = new Set(ops.map(o => o.id));
    const fresh = queue.all().filter(o => !sentIds.has(o.id));   // ของที่เพิ่งกดระหว่างรอคำตอบ
    queue.set([...retry, ...fresh]);

    return { sent: okIds.size, failed };
  } catch (e) {
    queue.mark(ops.map(o => o.id), false);   // ส่งไม่สำเร็จ ให้กลับไปรวมกับของใหม่ได้ตามเดิม
    throw e;
  } finally {
    flushing = false;
  }
}

// ── สถานะออนไลน์ ───────────────────────────────────────────
const listeners = new Set();
const net = {
  get online() { return navigator.onLine; },
  onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  emit() { listeners.forEach(fn => fn()); }
};
window.addEventListener('online',  () => net.emit());
window.addEventListener('offline', () => net.emit());

__exp(exports, { storagePersistent, MODE, conn, cache, lastClass, ApiError, OfflineError, isBusy, call, serverInfo, queue, flush, net });

  };

  __defs["js/auth.js"] = function (exports, __req) {
/* AssignCheck — เข้าสู่ระบบด้วยบัญชี Google
 *
 * แนวคิด: URL ของ Web App ไม่ใช่ความลับ (ใครเรียกก็ได้ แต่จะถูกปฏิเสธ)
 * ตัวที่ยืนยันว่าเป็นเจ้าของจริงคือ ID token จาก Google ที่ฝั่ง Apps Script
 * เอาไปตรวจกับรายชื่ออีเมลที่อนุญาต
 *
 * ผลลัพธ์: เปลี่ยนเครื่องแล้วแค่ใส่ URL + กดเข้าสู่ระบบด้วย Google ก็ใช้ได้เลย
 * ไม่ต้องจำรหัสลับ
 */

const { store } = __req("js/storage.js");

const LS = { token: 'ac.idtoken', profile: 'ac.profile', clientId: 'ac.clientid' };

/* เก็บผ่าน store — บางเบราว์เซอร์บล็อก localStorage ใน iframe ของ Google
 * ของเดิมกลืน error ทิ้ง ทำให้ token ที่เพิ่งได้มาหายทันที แล้ววนให้ล็อกอินซ้ำไม่จบ */
const lsGet = (k) => store.get(k);
const lsSet = (k, v) => store.set(k, v);
const lsDel = (k) => store.del(k);
const GIS_SRC = 'https://accounts.google.com/gsi/client';

let gisReady = null;
let refreshTimer = null;
const listeners = new Set();

const auth = {
  get clientId() { return lsGet(LS.clientId) || ''; },
  set clientId(v) { lsSet(LS.clientId, String(v || '').trim()); },

  get token() {
    const raw = lsGet(LS.token);
    if (!raw) return '';
    try {
      const { token, exp } = JSON.parse(raw);
      if (!token || Date.now() > exp - 60_000) return '';   // เหลือน้อยกว่า 1 นาที ถือว่าหมดอายุ
      return token;
    } catch { return ''; }
  },

  get profile() {
    try { return JSON.parse(lsGet(LS.profile)) || null; }
    catch { return null; }
  },

  get signedIn() { return !!this.token; },

  save(token) {
    const p = decodeJwt(token);
    if (!p) return null;
    lsSet(LS.token, JSON.stringify({ token, exp: p.exp * 1000 }));
    const profile = { email: p.email, name: p.name || p.email, picture: p.picture || '' };
    lsSet(LS.profile, JSON.stringify(profile));
    scheduleRefresh(p.exp * 1000);
    listeners.forEach(fn => fn());
    return profile;
  },

  signOut() {
    lsDel(LS.token);
    lsDel(LS.profile);
    clearTimeout(refreshTimer);
    try { window.google?.accounts?.id?.disableAutoSelect(); } catch {}
    listeners.forEach(fn => fn());
  },

  onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }
};

/** อ่านข้อมูลใน JWT (ไม่ได้ตรวจลายเซ็น — ฝั่ง Apps Script เป็นคนตรวจ) */
function decodeJwt(t) {
  try {
    const b = t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(decodeURIComponent(escape(atob(b))));
  } catch { return null; }
}

function scheduleRefresh(expMs) {
  clearTimeout(refreshTimer);
  const wait = Math.max(30_000, expMs - Date.now() - 5 * 60_000);   // ต่ออายุก่อนหมด 5 นาที
  refreshTimer = setTimeout(() => { silentSignIn().catch(() => {}); }, wait);
}

/** โหลดสคริปต์ Google Identity Services ครั้งเดียว */
function loadGIS() {
  if (gisReady) return gisReady;
  gisReady = new Promise((resolve, reject) => {
    if (window.google?.accounts?.id) return resolve(window.google);
    const s = document.createElement('script');
    s.src = GIS_SRC; s.async = true; s.defer = true;
    s.onload = () => resolve(window.google);
    s.onerror = () => reject(new Error('โหลด Google Sign-In ไม่ได้ (ตรวจอินเทอร์เน็ต)'));
    document.head.append(s);
  });
  return gisReady;
}

let initialised = false;
async function initGIS(onToken) {
  const g = await loadGIS();
  if (!auth.clientId) throw new Error('ยังไม่ได้ตั้ง Google Client ID');
  if (!initialised) {
    g.accounts.id.initialize({
      client_id: auth.clientId,
      callback: (res) => { if (res?.credential) onToken(res.credential); },
      auto_select: true,
      use_fedcm_for_prompt: true
    });
    initialised = true;
  }
  return g;
}

/** วางปุ่ม "Sign in with Google" ของจริงลงใน element */
async function renderSignInButton(el, { onSignedIn } = {}) {
  const g = await initGIS((token) => {
    const p = auth.save(token);
    if (p && onSignedIn) onSignedIn(p);
  });
  el.replaceChildren();
  g.accounts.id.renderButton(el, {
    theme: 'outline', size: 'large', shape: 'pill',
    text: 'signin_with', locale: 'th', width: 280
  });
  try { g.accounts.id.prompt(); } catch {}
}

/** พยายามต่ออายุ token เงียบ ๆ (ใช้ตอนใกล้หมดอายุ หรือโดนปฏิเสธ) */
function silentSignIn() {
  return new Promise((resolve, reject) => {
    initGIS((token) => { auth.save(token); resolve(true); })
      .then((g) => {
        g.accounts.id.prompt((n) => {
          if (n.isNotDisplayed?.() || n.isSkippedMoment?.()) reject(new Error('ต้องกดเข้าสู่ระบบใหม่'));
        });
      })
      .catch(reject);
    setTimeout(() => reject(new Error('หมดเวลารอ')), 12_000);
  });
}

__exp(exports, { auth, renderSignInButton });

  };

  __defs["js/storage.js"] = function (exports, __req) {
/* AssignCheck V2 — ที่เก็บข้อมูลในเครื่อง พร้อมตัวสำรองในหน่วยความจำ
 *
 * ทำไมต้องมีไฟล์นี้
 * ─────────────────
 * บางเบราว์เซอร์ห้ามแตะ localStorage แล้วโยน error ทันที
 *   · Chrome ที่ปิดคุกกี้ของบุคคลที่สาม เวลาแอปถูกเสิร์ฟใน iframe ของ Apps Script
 *   · Safari โหมดส่วนตัว · โหมดกันการติดตามบางตัว · พื้นที่เก็บเต็ม
 *
 * โค้ดเดิมกลืน error ทิ้งแล้วเดินต่อ ซึ่งดูเหมือนปลอดภัยแต่ไม่ใช่ —
 * "คิวงานที่รอส่งขึ้นชีต" ก็เขียนไม่ลงไปด้วย queue.size จึงเป็น 0 ตลอด
 * ผลคือคะแนนที่ครูกรอกขึ้นบนจอครบทุกช่อง ดูเหมือนบันทึกแล้ว
 * แต่ไม่เคยถูกส่งไปที่ชีตเลย และหายเงียบ ๆ ตอนปิดหน้า
 *
 * ไฟล์นี้จึงสลับไปเก็บในหน่วยความจำแทนเมื่อเขียนลงเครื่องไม่ได้
 * รอบการใช้งานนี้ยังทำงานครบ (ซิงค์ขึ้นชีตได้ตามปกติ)
 * แลกกับการที่ปิดหน้าไปแล้วของที่ยังไม่ได้ส่งจะหาย
 * — แอปจะเตือนครูให้รู้ตัวผ่าน store.persistent
 */

const mem = new Map();          // ค่าที่เขียนลงเครื่องไม่ได้ เก็บไว้ตรงนี้แทน
const gone = new Set();         // คีย์ที่สั่งลบแล้ว แต่ลบออกจากเครื่องจริงไม่ได้
let usingMemory = false;
let reason = '';

function fallback(why) {
  if (usingMemory) return;
  usingMemory = true;
  reason = why;
  console.warn('AssignCheck: เก็บข้อมูลลงเครื่องไม่ได้ (' + why + ') — ใช้หน่วยความจำแทนรอบนี้');
}

/**
 * พื้นที่เต็ม — แคชสร้างใหม่ได้จากชีต แต่คิวที่รอส่งสร้างใหม่ไม่ได้
 * จึงทิ้งแคชเพื่อเปิดทางให้คิวก่อน ค่อยยอมถอยไปหน่วยความจำเป็นทางสุดท้าย
 */
function dropCache(exceptKey) {
  let dropped = false;
  try {
    for (const k of Object.keys(localStorage)) {
      if (k.startsWith('ac.cache.') && k !== exceptKey) { localStorage.removeItem(k); dropped = true; }
    }
  } catch (e) { return false; }
  return dropped;
}

// ลองตั้งแต่ตอนเปิดแอป ดีกว่าไปรู้ตอนครูกรอกคะแนนไปแล้วครึ่งห้อง
try {
  localStorage.setItem('ac.__probe', '1');
  localStorage.removeItem('ac.__probe');
} catch (e) {
  fallback('เบราว์เซอร์ไม่อนุญาต');
}

const store = {
  /** false = ของที่เขียนรอบนี้อยู่แค่ในแท็บนี้ ปิดหน้าแล้วหาย */
  get persistent() { return !usingMemory; },
  get reason() { return reason; },

  /**
   * หน่วยความจำมาก่อน (ของใหม่สุด) แล้วค่อยตกไปอ่านจากเครื่อง
   * ต้องอ่านทะลุแบบนี้ ไม่งั้นพอเขียนไม่ได้ครั้งเดียว ลิงก์ชีตที่เคยตั้งไว้
   * จะอ่านไม่เจอ แล้วแอปเด้งกลับไปหน้าติดตั้งเหมือนลืมทุกอย่าง
   */
  get(k) {
    if (mem.has(k)) return mem.get(k);
    if (gone.has(k)) return null;
    try { return localStorage.getItem(k); } catch (e) { return null; }
  },

  /** @returns true เสมอเมื่อเก็บได้ (ไม่ว่าจะลงเครื่องหรือหน่วยความจำ) */
  set(k, v) {
    const s = String(v);
    gone.delete(k);
    if (!usingMemory) {
      try { localStorage.setItem(k, s); mem.delete(k); return true; }
      catch (e) {
        if (dropCache(k)) {
          try { localStorage.setItem(k, s); mem.delete(k); return true; } catch (e2) {}
        }
        fallback('พื้นที่เต็มหรือถูกบล็อก');
      }
    }
    mem.set(k, s);
    return true;
  },

  del(k) {
    mem.delete(k);
    gone.add(k);
    // ถ้าลบออกจากเครื่องได้จริงก็ไม่ต้องจำว่า "ลบแล้ว" อีก
    try { localStorage.removeItem(k); gone.delete(k); } catch (e) {}
  },

  keys() {
    const out = new Set(mem.keys());
    try {
      for (const k of Object.keys(localStorage)) if (!gone.has(k)) out.add(k);
    } catch (e) {}
    return [...out];
  }
};

__exp(exports, { store });

  };

  __defs["js/state.js"] = function (exports, __req) {
/* AssignCheck V2 — สถานะแอป + การอ่าน/เขียนข้อมูล (optimistic + ออฟไลน์) */

const api = __req("js/api.js");
const { toast } = __req("js/dom.js");
const { settingsFrom } = __req("js/score.js");

const state = {
  config: {},
  classes: [],
  classId: '',
  cls: null,
  view: 'home',
  stale: false,           // true = ข้อมูลมาจากแคช ยังไม่ได้ซิงค์
  webAppUrl: '',          // ลิงก์เปิดแอป (โหมด Apps Script เสิร์ฟเอง)
  user: null,             // บัญชีที่กำลังใช้งาน { email, name }
  installPrompt: null
};

const subs = new Set();
function subscribe(fn) { subs.add(fn); return () => subs.delete(fn); }

/**
 * แจ้งให้หน้าจอวาดใหม่
 * ห่อ try ไว้เพราะคนเรียก emit() ส่วนใหญ่คือฟังก์ชันที่เพิ่งบันทึกข้อมูลเสร็จ
 * ถ้าการวาดหน้าพังแล้วดันขึ้นมาถึงตรงนี้ การบันทึกจะดูเหมือนล้มไปด้วย
 * ทั้งที่ค่าลงคิวเรียบร้อยแล้ว
 */
function emit() {
  subs.forEach(fn => { try { fn(); } catch (e) { console.error(e); } });
}

function settings() { return settingsFrom(state.config); }

/** เปลี่ยนหน้า */
function go(view) {
  if (state.view === view) return;
  state.view = view;
  window.scrollTo({ top: 0 });
  emit();
}

// ── ลำดับบล็อกซ้าย→ขวา (ให้ตรงกับชีต) ──────────────────────
const BLOCK_ORDER = ['ATT|1', 'WORK|1', 'QUIZ|1', 'MID|1', 'ATT|2', 'WORK|2', 'QUIZ|2', 'FIN|2', 'SUM|0'];
const blockIdx = (c) => {
  const i = BLOCK_ORDER.indexOf(c.kind + '|' + (c.kind === 'SUM' ? 0 : c.half));
  return i < 0 ? 99 : i;
};

function sortColumns(cols) {
  return cols.slice().sort((a, b) => blockIdx(a) - blockIdx(b) || String(a.id).localeCompare(String(b.id)));
}

/**
 * รับประกันรูปร่างของข้อมูลห้องเรียนก่อนเอาไปใช้
 *
 * ทุกหน้าจออ่าน cls.students / cls.columns / cls.values ตรง ๆ โดยไม่กันค่าว่าง
 * ถ้าได้ก้อนที่ไม่ครบ (แคชจากแอปเวอร์ชันเก่า · เขียนค้างตอนพื้นที่เต็ม ·
 * ชีตตอบไม่ครบ) หน้าจอจะพังทุกครั้งที่เปิด และเพราะแคชอยู่ในเครื่องถาวร
 * มันจะพังซ้ำทุกครั้งจนกว่าจะล้างข้อมูลเว็บทิ้งเอง — ครูแก้เองไม่ได้
 *
 * กันไว้ที่จุดเดียวตรงนี้ ดีกว่าไปไล่ใส่ ?? [] ทุกบรรทัดใน 8 ไฟล์
 */
function normalizeClass(d) {
  if (!d || typeof d !== 'object') return null;
  return {
    ...d,
    meta: (d.meta && typeof d.meta === 'object') ? d.meta : {},
    students: Array.isArray(d.students) ? d.students : [],
    columns: sortColumns(Array.isArray(d.columns) ? d.columns : []),
    values: (d.values && typeof d.values === 'object') ? d.values : {}
  };
}

// ── โหลดข้อมูล ──────────────────────────────────────────────

/**
 * โหลดทุกอย่างที่ต้องใช้ตอนเปิดแอปด้วยการยิงครั้งเดียว
 *
 * เดิมยิง 2 รอบเรียงกัน (bootstrap แล้วค่อย getClass) ซึ่งช้าเป็นเท่าตัว
 * เพราะ Apps Script ตอบรอบละ 1–3 วินาที · ห้องที่จะเปิดรู้ล่วงหน้าจากเครื่องอยู่แล้ว
 * จึงขอพร้อมกันไปเลยผ่านคำสั่ง batch ที่ฝั่งชีตมีอยู่แล้ว
 */
async function bootAll() {
  const want = api.lastClass.get();

  // วาดจากแคชก่อน ผู้ใช้จะได้เห็นของทันทีระหว่างรอเน็ต
  const cachedBoot = api.cache.get('bootstrap');
  if (cachedBoot) {
    state.config = cachedBoot.config || {};
    state.classes = cachedBoot.classes || [];
    state.stale = true;
  }
  const cachedCls = want ? api.cache.get('class.' + want) : null;
  if (cachedCls) { state.cls = normalizeClass(cachedCls); state.classId = want; state.stale = true; }
  if (cachedBoot || cachedCls) emit();

  if (!api.conn.ready) return;

  const ops = [{ action: 'bootstrap', payload: {} }];
  if (want) ops.push({ action: 'getClass', payload: { classId: want } });

  let res;
  try {
    res = await api.call('batch', { ops });
  } catch (e) {
    if (!(e instanceof api.OfflineError)) toast(e.message, 'err');
    if (e instanceof api.ApiError && e.code === 'AUTH') throw e;
    return;
  }

  const list = res.results || [];
  const boot = list[0];
  if (boot && boot.ok) applyBootstrap(boot.data || {});

  const got = list[1];
  if (got && got.ok && got.data) {
    const d = got.data;
    state.cls = normalizeClass(d);
    state.classId = want;
    api.cache.set('class.' + want, state.cls);
  }
  emit();

  // ห้องที่จำไว้ถูกลบไปแล้ว หรือยังไม่เคยเลือกห้อง → เปิดห้องแรกให้
  const okClass = state.classes.some(c => c.classId === state.classId);
  if (!okClass) {
    const first = state.classes[0];
    if (first) await loadClass(first.classId);
    else { state.cls = null; state.classId = ''; emit(); }
  }
}

async function loadClass(classId, { force = false } = {}) {
  if (!classId) { state.cls = null; state.classId = ''; emit(); return; }
  state.classId = classId;
  api.lastClass.set(classId);

  const cached = api.cache.get('class.' + classId);
  if (cached) { state.cls = normalizeClass(cached); state.stale = true; emit(); }
  if (!force && cached && !api.net.online) return;

  try {
    const data = await api.call('getClass', { classId });
    state.cls = normalizeClass(data);
    state.stale = false;
    api.cache.set('class.' + classId, state.cls);
  } catch (e) {
    if (!(e instanceof api.OfflineError)) toast(e.message, 'err');
    if (!cached) state.cls = null;
  } finally {
    emit();
  }
}

function persistClass() {
  if (state.cls) api.cache.set('class.' + state.classId, state.cls);
}

// ── สร้าง/แก้ไขโครงสร้าง (ต้องออนไลน์) ─────────────────────

/**
 * เอาผลของคำสั่ง bootstrap ไปใส่ state (ใช้ร่วมกันหลายที่)
 */
function applyBootstrap(d) {
  if (!d) return;
  state.config = d.config || {};
  state.classes = d.classes || [];
  state.webAppUrl = d.webAppUrl || '';
  state.user = api.serverInfo.user || null;
  state.stale = false;
  api.cache.set('bootstrap', d);
}

/**
 * ยิงหลายคำสั่งในรอบเดียว แล้วคืนผลเป็นอาเรย์
 *
 * Apps Script ตอบรอบละ 1-3 วินาที การยิงเรียงกันจึงคูณเวลารอตรง ๆ
 * ของเดิม "แก้ไขข้อมูลห้อง" ยิง 3 รอบต่อกัน (updateClassMeta → bootstrap
 * → getClass) ครูต้องรอ 3-9 วินาทีกว่าจะได้หน้าจอกลับมา
 * ฝั่งชีตรันคำสั่งใน batch เรียงตามลำดับให้อยู่แล้ว รวมได้เลย
 *
 * @param ops [{ action, payload }]
 * @param failMsg ข้อความเมื่อคำสั่งแรก (คำสั่งหลัก) ไม่ผ่าน
 */
async function batchCall(ops, failMsg) {
  const res = await api.call('batch', { ops });
  const list = res.results || [];
  const main = list[0];
  if (!main || !main.ok) throw new api.ApiError((main && main.error) || failMsg);
  return list;
}

async function createClass(meta, students) {
  const [made, boot] = await batchCall([
    { action: 'createClass', payload: { meta, students } },
    { action: 'bootstrap',   payload: {} }
  ], 'สร้างห้องเรียนไม่สำเร็จ');

  if (boot && boot.ok) applyBootstrap(boot.data);
  state.cls = normalizeClass(made.data);
  state.classId = state.cls.meta.classId;
  api.lastClass.set(state.classId);
  persistClass(); emit();
  return made.data;
}

async function updateClassMeta(meta) {
  const [, boot, got] = await batchCall([
    { action: 'updateClassMeta', payload: { classId: state.classId, meta } },
    { action: 'bootstrap',       payload: {} },
    { action: 'getClass',        payload: { classId: state.classId } }
  ], 'บันทึกข้อมูลห้องไม่สำเร็จ');

  if (boot && boot.ok) applyBootstrap(boot.data);
  if (got && got.ok && got.data) {
    state.cls = normalizeClass(got.data);
    state.stale = false;
    persistClass();
  }
  emit();
}

async function deleteClass(classId) {
  const [, boot] = await batchCall([
    { action: 'deleteClass', payload: { classId } },
    { action: 'bootstrap',   payload: {} }
  ], 'ลบห้องเรียนไม่สำเร็จ');

  api.cache.del('class.' + classId);
  if (state.classId === classId) { state.classId = ''; state.cls = null; }
  if (boot && boot.ok) applyBootstrap(boot.data);
  emit();
}

async function setStudents(students) {
  const [set, boot] = await batchCall([
    { action: 'setStudents', payload: { classId: state.classId, students } },
    { action: 'bootstrap',   payload: {} }
  ], 'บันทึกรายชื่อนักเรียนไม่สำเร็จ');

  state.cls = normalizeClass(set.data); persistClass();
  if (boot && boot.ok) applyBootstrap(boot.data);
  emit();
}

// ── คอลัมน์ (คาบเรียน / ชิ้นงาน / ข้อสอบ) ───────────────────

const uid = (p) => p + Math.random().toString(36).slice(2, 10);

/**
 * สร้างรหัสคอลัมน์ฝั่งเบราว์เซอร์ให้ตรงกับที่ Apps Script จะสร้าง
 * ทำให้เพิ่มคอลัมน์ตอนออฟไลน์แล้วซิงค์ทีหลังได้โดยไม่ซ้ำ
 */
function makeColumnSpec(p) {
  const kind = String(p.kind).toUpperCase();
  let half = Number(p.half) || 1;
  if (kind === 'MID') half = 1;
  if (kind === 'FIN') half = 2;

  if (kind === 'ATT') {
    const d = String(p.date).replace(/-/g, '');
    const period = Number(p.period) || 1;
    const id = `${d}-${period}`;
    const [, mm, dd] = String(p.date).split('-');
    return {
      key: `ATT|${half}|${id}`, kind, half, id, max: null,
      label: `${dd}/${mm}\nคาบ ${period}`, date: p.date, period,
      payload: { kind, half, date: p.date, period }
    };
  }

  const id = p.id || uid(kind[0].toLowerCase());
  const max = Number(p.max) || 0;
  const desc = String(p.desc || '');
  return {
    key: `${kind}|${half}|${id}`, kind, half, id, max, label: p.label, desc,
    payload: { kind, half, id, label: p.label, max, desc }
  };
}

/**
 * เพิ่มคอลัมน์ (ใช้ได้ทั้งออนไลน์และออฟไลน์)
 * @returns { key, created }
 */
function ensureColumn(p, { quiet = false } = {}) {
  const spec = makeColumnSpec(p);
  if (!state.cls) throw new Error('ยังไม่ได้เลือกห้องเรียน');

  if (state.cls.columns.some(c => c.key === spec.key)) return { key: spec.key, created: false };

  const { payload, ...col } = spec;
  state.cls.columns = sortColumns([...state.cls.columns, col]);
  state.cls.values[spec.key] = state.cls.values[spec.key] || {};
  persistClass();
  api.queue.push('addColumn', { classId: state.classId, ...payload });
  scheduleSync();
  if (!quiet) emit();
  return { key: spec.key, created: true };
}

async function updateColumn(key, patch) {
  const col = state.cls.columns.find(c => c.key === key);
  if (col) { Object.assign(col, patch); persistClass(); emit(); }
  api.queue.push('updateColumn', { classId: state.classId, key, ...patch });
  await sync();
}

async function deleteColumn(key) {
  state.cls.columns = state.cls.columns.filter(c => c.key !== key);
  delete state.cls.values[key];
  persistClass(); emit();
  api.queue.push('deleteColumn', { classId: state.classId, key });
  await sync();
}

// ── เขียนค่า (optimistic เสมอ) ──────────────────────────────

/**
 * cells: [{ key, sid, value }]
 * quiet = true → ไม่วาดหน้าใหม่ (ให้ view อัปเดต DOM เองเพื่อความลื่น)
 */
function setCells(cells, { quiet = false } = {}) {
  if (!cells.length || !state.cls) return;
  for (const c of cells) {
    if (!state.cls.values[c.key]) state.cls.values[c.key] = {};
    if (c.value === '' || c.value === null || c.value === undefined) delete state.cls.values[c.key][c.sid];
    else state.cls.values[c.key][c.sid] = c.value;
  }
  persistClass();
  api.queue.push('setCells', { classId: state.classId, cells });
  scheduleSync();
  if (!quiet) emit();
}

function getCell(key, sid) {
  return (state.cls?.values?.[key] || {})[sid] ?? '';
}

// ── ซิงค์ ───────────────────────────────────────────────────

let syncTimer = null;
/** ส่งขึ้นชีตเร็วขึ้น — คำสั่งของห้องเดียวกันถูกรวมเป็นก้อนเดียวอยู่แล้ว จึงไม่เปลืองรอบ */
function scheduleSync(ms = 600) {
  clearTimeout(syncTimer);
  syncTimer = setTimeout(() => sync(), ms);
}

/**
 * สถานะซิงค์เปลี่ยนบ่อยมาก ถ้าสั่ง emit() จะวาดทั้งหน้าใหม่
 * ครูที่กำลังพิมพ์คะแนนอยู่จะโดนเคอร์เซอร์เด้ง — จึงบอกเฉพาะแถบหัวให้ไปอัปเดตเอง
 */
function syncChanged() {
  try { window.dispatchEvent(new CustomEvent('ac:sync')); } catch (e) {}
}

let syncing = false;
let syncFails = 0;      // ส่งไม่ผ่านติดกันกี่รอบ (รวมกรณีออฟไลน์ที่ยังไม่ทันนับ tries)

async function sync({ loud = false } = {}) {
  if (syncing || !api.conn.ready) return;
  if (!api.queue.size) { if (loud) toast('ข้อมูลตรงกันแล้ว', 'ok'); syncFails = 0; return; }
  syncing = true; syncChanged();
  try {
    const res = await api.flush();
    if (res.failed?.length) {
      syncFails++;
      // ของที่ส่งไม่ผ่านยังอยู่ในคิว จะลองใหม่ให้เอง — บอกให้ครูรู้ว่ายังไม่หาย
      toast(`ยังส่งไม่ได้ ${res.failed.length} รายการ (เก็บไว้ให้แล้ว จะลองใหม่): ${res.failed[0].error}`, 'err', 5000);
    } else {
      syncFails = 0;
      if (loud) toast(`ซิงค์แล้ว ${res.sent} รายการ`, 'ok');
    }
  } catch (e) {
    syncFails++;
    if (loud) toast(e instanceof api.OfflineError ? 'ยังออฟไลน์ — เก็บไว้ก่อน' : e.message, 'err');
  } finally {
    syncing = false; syncChanged();
    // ของที่เพิ่งกดระหว่างกำลังส่งอยู่ ต้องไม่ค้างคิวรอจนกว่าจะกดครั้งถัดไป
    if (api.queue.size) scheduleSync(retryDelay());
  }
}

/**
 * รอนานขึ้นเรื่อย ๆ เมื่อส่งไม่ผ่านซ้ำ ๆ
 * ถ้าลองใหม่ทุก 400 มิลลิวินาทีตลอด ตอนออฟไลน์หรือชีตมีปัญหา
 * แอปจะวนยิงไม่หยุด กินแบตและโดน Apps Script ปฏิเสธเพราะเรียกถี่เกิน
 */
function retryDelay() {
  const n = Math.max(api.queue.maxTries(), syncFails);
  if (!n) return 400;                              // ยังไม่เคยพลาด — ส่งของใหม่ให้ไว
  return Math.min(60_000, 2000 * 2 ** (n - 1));    // 2s → 4s → 8s … สูงสุด 1 นาที
}

const isSyncing = () => syncing;

/** คำนวณคะแนนสรุปแล้วเขียนลงชีต */
async function recalcOnServer() {
  await sync();
  const res = await api.call('recalc', { classId: state.classId });
  return res.rows;
}

async function saveConfig(entries) {
  const cfg = await api.call('saveConfig', { entries });
  state.config = cfg;
  const boot = api.cache.get('bootstrap') || {};
  api.cache.set('bootstrap', { ...boot, config: cfg });
  emit();
}

// ซิงค์อัตโนมัติเมื่อกลับมาออนไลน์
api.net.onChange(() => { if (navigator.onLine) sync(); emit(); });
window.addEventListener('visibilitychange', () => { if (!document.hidden) sync(); });

__exp(exports, { state, subscribe, emit, settings, go, bootAll, loadClass, createClass, updateClassMeta, deleteClass, setStudents, ensureColumn, updateColumn, deleteColumn, setCells, getCell, sync, isSyncing, recalcOnServer, saveConfig });

  };

  __defs["js/score.js"] = function (exports, __req) {
/* AssignCheck V2 — เครื่องคำนวณคะแนนฝั่งเบราว์เซอร์
 *
 * ⚠️ สูตรในไฟล์นี้ต้องตรงกับ apps-script/03_Score.gs เสมอ
 *    ฝั่งนี้ใช้แสดงผลทันที/ออฟไลน์ · ฝั่ง Apps Script ใช้เขียนลงชีต
 */

const ATT_CODES = ['ม', 'ส', 'ล', 'ข'];
const ATT_NAMES = { 'ม': 'มา', 'ส': 'สาย', 'ล': 'ลา', 'ข': 'ขาด' };
const NOT_SUBMITTED = 'x';
const LATE_PREFIX = 'L';   // ส่งช้า เก็บเป็น "L8" = ส่งช้า ได้ 8 คะแนน

/**
 * อ่านค่าในช่องเช็คงาน/คะแนนสอบ
 *   ''    → none  ยังไม่ตรวจ
 *   'x'   → miss  ไม่ส่ง (0 คะแนน แต่นับในตัวหาร)
 *   'L8'  → late  ส่งช้า ได้ 8
 *   '8'   → ok    ส่งปกติ ได้ 8
 */
function parseWork(raw) {
  const s = raw === undefined || raw === null ? '' : String(raw).trim();
  if (s === '') return { status: 'none', score: 0 };
  if (s.toLowerCase() === NOT_SUBMITTED) return { status: 'miss', score: 0 };
  const late = /^l/i.test(s);
  const n = Number(late ? s.slice(1) : s);
  if (isNaN(n)) return { status: 'none', score: 0 };
  return { status: late ? 'late' : 'ok', score: n };
}

/** ประกอบค่ากลับไปเก็บในชีต */
function formatWork(status, score) {
  if (status === 'none') return '';
  if (status === 'miss') return NOT_SUBMITTED;
  return (status === 'late' ? LATE_PREFIX : '') + String(score);
}

const BUCKETS = [
  { id: 'work1', kind: 'WORK', half: 1, label: 'ส่งงาน',        sgs: 'ช่อง 1',  phase: 1 },
  { id: 'quiz1', kind: 'QUIZ', half: 1, label: 'สอบเก็บคะแนน',  sgs: 'ช่อง 2',  phase: 1 },
  { id: 'att1',  kind: 'ATT',  half: 1, label: 'เข้าเรียน',      sgs: 'ช่อง 3',  phase: 1 },
  { id: 'mid',   kind: 'MID',  half: 1, label: 'สอบกลางภาค',    sgs: 'กลางภาค', phase: 1 },
  { id: 'work2', kind: 'WORK', half: 2, label: 'ส่งงาน',        sgs: 'ช่อง 10', phase: 2 },
  { id: 'quiz2', kind: 'QUIZ', half: 2, label: 'สอบเก็บคะแนน',  sgs: 'ช่อง 11', phase: 2 },
  { id: 'att2',  kind: 'ATT',  half: 2, label: 'เข้าเรียน',      sgs: 'ช่อง 12', phase: 2 },
  { id: 'fin',   kind: 'FIN',  half: 2, label: 'สอบปลายภาค',    sgs: 'ปลายภาค', phase: 2 }
];

const BUCKET_OF = Object.fromEntries(BUCKETS.map(b => [b.kind + '|' + b.half, b.id]));

const n = (v, d = 0) => { const x = Number(v); return isNaN(x) ? d : x; };
const bool = (v) => ['TRUE', 'ใช่', '1', 'YES', 'true'].includes(String(v).trim());

function settingsFrom(cfg = {}) {
  return {
    weight: {
      work1: n(cfg.w_work1, 10), quiz1: n(cfg.w_quiz1, 10), att1: n(cfg.w_att1, 5),  mid: n(cfg.w_mid, 20),
      work2: n(cfg.w_work2, 10), quiz2: n(cfg.w_quiz2, 10), att2: n(cfg.w_att2, 5),  fin: n(cfg.w_fin, 30)
    },
    attMode: String(cfg.att_mode || 'ratio').toLowerCase(),
    attW: { 'ม': n(cfg['att_w_มา'], 1), 'ส': n(cfg['att_w_สาย'], 0.5), 'ล': n(cfg['att_w_ลา'], 1), 'ข': n(cfg['att_w_ขาด'], 0) },
    attD: { 'ม': 0, 'ส': n(cfg['att_d_สาย'], 0.25), 'ล': n(cfg['att_d_ลา'], 0), 'ข': n(cfg['att_d_ขาด'], 0.5) },
    minPct: n(cfg.att_min_pct, 80),
    countLeave: cfg['att_count_ลา'] === undefined ? true : bool(cfg['att_count_ลา']),
    ungraded: String(cfg.ungraded_mode || 'ignore').toLowerCase(),
    latePenaltyPct: n(cfg.late_penalty_pct, 0),
    digits: n(cfg.round_digits, 0),
    roundMode: String(cfg.round_mode || 'half').toLowerCase(),
    cuts: parseCuts(cfg.grade_cuts)
  };
}

const DEFAULT_CUTS = '80:4,75:3.5,70:3,65:2.5,60:2,55:1.5,50:1,0:0';

/**
 * แปลงข้อความเกณฑ์เกรด "80:4,75:3.5,…" เป็นรายการช่วง
 *
 * ต้องเช็คว่าเป็นตัวเลขจริง ๆ — ของเดิมใช้ n() ที่แปลงค่าที่อ่านไม่ออกเป็น 0
 * แล้วค่อยกรอง isNaN ทีหลัง ซึ่งกรองไม่ออกสักตัวเพราะไม่มีทางเป็น NaN แล้ว
 * ผลคือพิมพ์ผิดตัวเดียว เช่น "8O:4" (ตัว O แทนเลขศูนย์) เกณฑ์นั้นกลายเป็น 0:4
 * นักเรียนที่ได้ 0 คะแนนก็จะได้เกรด 4 กันทั้งห้องโดยไม่มีอะไรเตือน
 */
function parseCuts(s) {
  const good = String(s || DEFAULT_CUTS)
    .split(',')
    .map(p => {
      const [a, b] = p.split(':');
      const raw = String(a ?? '').trim();
      const min = Number(raw);
      const grade = String(b ?? '').trim();
      return { min, grade, ok: raw !== '' && Number.isFinite(min) && grade !== '' };
    })
    .filter(c => c.ok)
    .map(({ min, grade }) => ({ min, grade }));

  // พังทั้งชุด → ใช้เกณฑ์มาตรฐาน ดีกว่าปล่อยให้ตัดเกรดมั่ว
  return (good.length ? good : parseCuts(DEFAULT_CUTS)).sort((a, b) => b.min - a.min);
}

/** ช่วงที่เขียนผิดรูปแบบ — หน้าตรวจสภาพเอาไปเตือนก่อนที่เกรดจะออกผิด */
function badCuts(s) {
  return String(s ?? '')
    .split(',')
    .map(p => p.trim())
    .filter(p => p !== '' && !/^-?\d+(\.\d+)?\s*:\s*\S+$/.test(p));
}

function roundScore(v, digits, mode) {
  const f = 10 ** digits;
  let x = v * f;
  if (mode === 'up') x = Math.ceil(x - 1e-9);
  else if (mode === 'down') x = Math.floor(x + 1e-9);
  else x = Math.round(x - 1e-9 + 2e-9);
  return x / f;
}

const clampRound = (v, max, S) => Math.max(0, Math.min(max, roundScore(v, S.digits, S.roundMode)));

function gradeOf(total, cuts) {
  for (const c of cuts) if (total >= c.min) return c.grade;
  return '0';
}

/** จัดคอลัมน์เข้าถังตามชนิด+ช่วง */
function bucketColumns(cls) {
  const out = Object.fromEntries(BUCKETS.map(b => [b.id, []]));
  for (const c of cls.columns || []) {
    const id = BUCKET_OF[c.kind + '|' + c.half];
    if (id) out[id].push(c);
  }
  return out;
}

/**
 * คำนวณคะแนนทั้งห้อง
 * @returns [{ sid, no, name, work1..fin, total, grade, pct, flag, pending }]
 */
function computeClass(cls, S) {
  const byBucket = bucketColumns(cls);
  const V = cls.values || {};

  return (cls.students || []).map(st => {
    const r = { sid: st.sid, no: st.no, name: st.name };
    let attTotal = 0, attPresent = 0, pending = 0, filled = 0, late = 0, dataN = 0;

    for (const b of BUCKETS) {
      const cols = byBucket[b.id];
      const w = S.weight[b.id];

      if (b.kind === 'ATT') {
        let checked = 0, gained = 0, deducted = 0;
        for (const c of cols) {
          const v = String((V[c.key] || {})[st.sid] ?? '').trim();
          if (!v || !ATT_CODES.includes(v)) continue;
          checked++;
          gained   += S.attW[v] || 0;
          deducted += S.attD[v] || 0;
          attTotal++;
          if (v === 'ม' || v === 'ส' || (v === 'ล' && S.countLeave)) attPresent++;
        }
        // ยังไม่เช็คสักคาบ = ยังไม่มีข้อมูล → 0 (ไม่ใช่ให้เต็มไว้ก่อน)
        const raw = S.attMode === 'deduct' ? Math.max(0, w - deducted) : w * (gained / (checked || 1));
        r[b.id] = checked ? clampRound(raw, w, S) : 0;
        r['_has_' + b.id] = checked > 0;
        if (checked) dataN++;
        continue;
      }

      let got = 0, max = 0, blank = 0;
      for (const c of cols) {
        const full = c.max == null ? 0 : c.max;
        const cell = parseWork((V[c.key] || {})[st.sid]);   // อย่าตั้งชื่อ w ทับน้ำหนักด้านบน
        if (cell.status === 'none') { blank++; if (S.ungraded === 'zero') max += full; continue; }
        max += full; filled++;
        if (cell.status === 'late') late++;
        if (cell.status === 'miss') continue;
        got += cell.score;
      }
      pending += blank;
      r[b.id] = max > 0 ? clampRound(w * (got / max), w, S) : 0;
      r['_has_' + b.id] = max > 0;
      if (max > 0) dataN++;
    }

    r.total = roundScore(BUCKETS.reduce((a, b) => a + r[b.id], 0), S.digits, S.roundMode);
    r.pct = attTotal ? Math.round((attPresent / attTotal) * 1000) / 10 : 100;
    r.attN = attTotal;
    r.dataN = dataN;          // จำนวนช่อง SGS ที่มีข้อมูลจริง (0 = ยังไม่ได้กรอกอะไรเลย)
    r.pending = pending;
    r.late = late;

    // ถือว่าจบเทอมเมื่อกรอกคะแนนปลายภาคของคนนี้แล้ว
    const termDone = byBucket.fin.some(c => String((V[c.key] || {})[st.sid] ?? '').trim() !== '');

    const flags = [];
    const lowTime = attTotal > 0 && r.pct < S.minPct;
    if (lowTime) flags.push(`มส (เวลาเรียน ${r.pct}%)`);
    if (pending > 0) flags.push(`ยังไม่ตรวจ ${pending} รายการ`);
    if (termDone && filled > 0 && pending === 0 && r.total < 50) flags.push('เสี่ยงติด 0');
    r.flag = flags.join(' · ');
    // ยังไม่มีข้อมูลสักช่อง = ยังตัดเกรดไม่ได้ (อย่าโชว์ 0 ให้เข้าใจผิดว่าตก)
    r.grade = dataN === 0 ? '—' : (lowTime ? 'มส' : gradeOf(r.total, S.cuts));
    return r;
  });
}

/** สรุปสถิติการเช็คชื่อรายคาบ (ใช้ในหน้าเช็คชื่อ) */
function attStats(cls, colKey) {
  const m = (cls.values || {})[colKey] || {};
  const out = { 'ม': 0, 'ส': 0, 'ล': 0, 'ข': 0, blank: 0 };
  for (const st of cls.students || []) {
    const v = String(m[st.sid] ?? '').trim();
    if (ATT_CODES.includes(v)) out[v]++; else out.blank++;
  }
  return out;
}

__exp(exports, { ATT_CODES, ATT_NAMES, NOT_SUBMITTED, parseWork, formatWork, BUCKETS, settingsFrom, badCuts, bucketColumns, computeClass, attStats });

  };

  __defs["js/icons.js"] = function (exports, __req) {
/* ไอคอนเส้น (SVG ฝังในโค้ด — ไม่ต้องโหลดจากภายนอก ใช้ตอนออฟไลน์ได้)
 *
 * ใช้กับ "โครงหน้าจอ" เท่านั้น (แถบเมนู แถบบน ตัวเลือกธีม)
 * ส่วนหน้าจอว่างเปล่ายังใช้อีโมจิ เพราะให้ความรู้สึกเป็นมิตรกว่า
 */

const P = {
  home:     '<path d="M3 10.2 12 3l9 7.2"/><path d="M5.5 9.4V20a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1V9.4"/>',
  clock:    '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.2V12l3.2 1.9"/>',
  tasks:    '<path d="M9 4.5h6v2H9z"/><path d="M15 5.5h3a1 1 0 0 1 1 1V20a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6.5a1 1 0 0 1 1-1h3"/><path d="m9 13.5 2 2 4-4"/>',
  chart:    '<path d="M4 3.5V20h16"/><path d="M8 20v-5.5"/><path d="M12.5 20V9"/><path d="M17 20v-8"/>',
  table:    '<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><path d="M3.5 9.5h17M3.5 14.5h17M9.5 9.5v10"/>',
  refresh:  '<path d="M20.5 12a8.5 8.5 0 1 1-2.5-6"/><path d="M20.5 4.5V10H15"/>',
  gear:     '<circle cx="12" cy="12" r="3.1"/><path d="M18.9 14.3a1.5 1.5 0 0 0 .3 1.7l.1.1a1.9 1.9 0 1 1-2.7 2.7l-.1-.1a1.5 1.5 0 0 0-1.7-.3 1.5 1.5 0 0 0-.9 1.4v.2a1.9 1.9 0 1 1-3.8 0v-.1a1.5 1.5 0 0 0-1-1.4 1.5 1.5 0 0 0-1.7.3l-.1.1a1.9 1.9 0 1 1-2.7-2.7l.1-.1a1.5 1.5 0 0 0 .3-1.7 1.5 1.5 0 0 0-1.4-.9h-.2a1.9 1.9 0 1 1 0-3.8h.1a1.5 1.5 0 0 0 1.4-1 1.5 1.5 0 0 0-.3-1.7l-.1-.1a1.9 1.9 0 1 1 2.7-2.7l.1.1a1.5 1.5 0 0 0 1.7.3h.1a1.5 1.5 0 0 0 .9-1.4v-.2a1.9 1.9 0 1 1 3.8 0v.1a1.5 1.5 0 0 0 .9 1.4 1.5 1.5 0 0 0 1.7-.3l.1-.1a1.9 1.9 0 1 1 2.7 2.7l-.1.1a1.5 1.5 0 0 0-.3 1.7v.1a1.5 1.5 0 0 0 1.4.9h.2a1.9 1.9 0 1 1 0 3.8h-.1a1.5 1.5 0 0 0-1.4.9z"/>',
  book:     '<path d="M5 4.8A1.8 1.8 0 0 1 6.8 3H19v18H6.8A1.8 1.8 0 0 1 5 19.2z"/><path d="M5 17.2h14"/>',
  sun:      '<circle cx="12" cy="12" r="3.8"/><path d="M12 2.2v2.4M12 19.4v2.4M4.5 4.5 6.2 6.2M17.8 17.8l1.7 1.7M2.2 12h2.4M19.4 12h2.4M4.5 19.5 6.2 17.8M17.8 6.2l1.7-1.7"/>',
  moon:     '<path d="M20.2 14.6A8.6 8.6 0 0 1 9.4 3.8a8.6 8.6 0 1 0 10.8 10.8z"/>',
  auto:     '<rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8.5 21h7M12 17v4"/>'
};

/** คืน element <svg> ที่ใช้สีตามข้อความรอบ ๆ (currentColor) */
function icon(name, cls = 'ico') {
  const box = document.createElement('span');
  box.innerHTML =
    `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" ` +
    `stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">` +
    (P[name] || '') + '</svg>';
  return box.firstElementChild;
}

__exp(exports, { icon });

  };

  __defs["js/theme.js"] = function (exports, __req) {
/* โหมดสว่าง / มืด
 *
 * ค่าเริ่มต้นคือ 'auto' — ตามการตั้งค่าของเครื่อง (มืดตอนกลางคืนเอง)
 * ครูเลือกบังคับสว่างหรือมืดได้ในหน้าตั้งค่า เก็บไว้ในเครื่องนี้เท่านั้น
 */

const { store } = __req("js/storage.js");

const KEY = 'ac.theme';
const BAR = { light: '#ffffff', dark: '#101211' };

/* store สลับไปเก็บในหน่วยความจำให้เองเมื่อเบราว์เซอร์บล็อก localStorage
 * (Chrome ที่ปิดคุกกี้ของบุคคลที่สาม ใน iframe ของ Google)
 * กดสลับโหมดจึงเห็นผลทันทีเสมอ แค่จำข้ามรอบไม่ได้ */
function lsGet(k) { return store.get(k); }
function lsSet(k, v) { store.set(k, v); }
function lsDel(k) { store.del(k); }

const THEMES = [
  { id: 'auto',  label: 'ตามเครื่อง', ic: 'auto' },
  { id: 'light', label: 'สว่าง',      ic: 'sun'  },
  { id: 'dark',  label: 'มืด',        ic: 'moon' }
];

function getTheme() {
  const v = lsGet(KEY);
  return v === 'light' || v === 'dark' ? v : 'auto';
}

function setTheme(v) {
  if (v === 'auto') lsDel(KEY);
  else lsSet(KEY, v);
  applyTheme();
}

function darkQuery() {
  try { return matchMedia('(prefers-color-scheme: dark)'); } catch (e) { return null; }
}

/** โหมดที่กำลังแสดงจริง (คลี่ 'auto' ออกเป็น light/dark แล้ว) */
function resolvedTheme() {
  const t = getTheme();
  if (t !== 'auto') return t;
  const q = darkQuery();
  return q && q.matches ? 'dark' : 'light';
}

function applyTheme() {
  try {
    const t = getTheme();
    const root = document.documentElement;
    if (t === 'auto') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', t);

    let meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'theme-color';
      document.head.append(meta);
    }
    meta.content = BAR[resolvedTheme()];
  } catch (e) {
    // ธีมเป็นเรื่องความสวยงาม ห้ามทำให้ทั้งแอปเปิดไม่ขึ้น
  }
}

/** เครื่องสลับโหมดเองตอนอยู่ 'auto' → วาดใหม่ให้ตรง */
function watchSystemTheme(onChange) {
  const q = darkQuery();
  if (!q || !q.addEventListener) return;
  q.addEventListener('change', () => {
    if (getTheme() === 'auto') { applyTheme(); onChange && onChange(); }
  });
}

__exp(exports, { THEMES, getTheme, setTheme, resolvedTheme, applyTheme, watchSystemTheme });

  };

  __defs["js/views/setup.js"] = function (exports, __req) {
/* หน้าเชื่อมต่อครั้งแรก — 2 ขั้น: ใส่ URL แล้วเข้าสู่ระบบด้วย Google */

const { h, toast } = __req("js/dom.js");
const api = __req("js/api.js");
const { auth, renderSignInButton } = __req("js/auth.js");

const ui = { step: 1, info: null, busy: false, method: 'google' };  // method = วิธียืนยันตัวตนที่เลือกอยู่

function viewSetup() {
  if (api.conn.url && !ui.info) ui.step = 2;

  // ดีไซน์หน้า 07: พื้นเข้มเต็มจอ + แผ่นขาวลอยขึ้นมา เห็นความคืบหน้าตลอด
  return h('div', { class: 'setup-screen' },
    h('div', { class: 'setup-brand' },
      h('div', { class: 'mark' }, 'A'),
      h('h1', null, 'AssignCheck'),
      h('p', null, 'เช็คชื่อ · เช็คงาน · สรุปคะแนน SGS',
        h('br'), 'เชื่อมกับ Google Sheet ของคุณครั้งเดียว ใช้ได้ทุกเครื่อง')),
    h('div', { class: 'setup-sheet' },
      stepper(),
      ui.step === 1 ? stepUrl() : stepSignIn(),
      helpCard()
    )
  );
}

/** แถบ 3 ขั้น — ขั้นที่ผ่านแล้วเป็นเครื่องหมายถูกสีเขียว */
function stepper() {
  const STEPS = ['วางโค้ดในชีต', 'เชื่อมต่อ', 'สร้างห้องแรก'];
  const cur = ui.step === 1 ? 1 : 2;   // ขั้นที่กำลังทำอยู่ตอนนี้
  const out = [];
  STEPS.forEach((label, i) => {
    const n = i + 1;
    const done = n < cur, now = n === cur;
    if (i > 0) out.push(h('div', { class: 'step-line' + (n <= cur ? ' done' : '') }));
    out.push(h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
      h('div', { class: 'step-dot' + (done ? ' done' : (now ? ' now' : '')) }, done ? '✓' : String(n)),
      h('span', { class: 'step-name' + (done || now ? ' on' : '') }, label)));
  });
  return h('div', { class: 'stepper' }, out);
}

// ── ขั้นที่ 1: URL ──────────────────────────────────────────

function stepUrl() {
  const urlIn = h('input', {
    type: 'url', placeholder: 'https://script.google.com/macros/s/.../exec',
    value: api.conn.url
  });
  const btn = h('button', { class: 'btn btn-block' }, 'ถัดไป');

  btn.onclick = async () => {
    const url = urlIn.value.trim();
    if (!/^https:\/\/script\.google\.com\/macros\/s\/.+\/exec/.test(url)) {
      return toast('URL ต้องลงท้ายด้วย /exec', 'err');
    }
    btn.disabled = true; btn.textContent = 'กำลังตรวจสอบ…';
    try {
      const info = await api.conn.probe(url);
      api.conn.save(url);
      if (info.clientId) auth.clientId = info.clientId;
      ui.info = info; ui.step = 2;
      render();
    } catch (e) {
      btn.disabled = false; btn.textContent = 'ถัดไป';
      toast(e.message, 'err', 6000);
    }
  };

  urlIn.classList.add('setup-mono');

  return h('div', null,
    h('div', { class: 'setup-h' }, 'เชื่อมต่อกับ Web App ของคุณ'),
    h('div', { class: 'setup-p' },
      'คัดลอก Web app URL จาก Apps Script (Deploy → New deployment → Web app · Anyone)',
      h('br'), 'ข้อมูลทั้งหมดเก็บในชีตของคุณเอง แอปนี้เป็นแค่หน้าจอสำหรับกรอก'),
    h('div', { class: 'field', style: { marginTop: '14px' } },
      h('label', null, 'Web app URL'), urlIn,
      h('div', { class: 'hint' }, 'ต้องเป็นลิงก์ที่ลงท้ายด้วย /exec')),
    btn
  );
}

// ── ขั้นที่ 2: เข้าสู่ระบบ ──────────────────────────────────

function stepSignIn() {
  const info = ui.info;
  const gBox = h('div', { style: { display: 'flex', justifyContent: 'center', minHeight: '48px' } },
    h('div', { class: 'boot-spin' }));

  if (auth.clientId) {
    renderSignInButton(gBox, {
      onSignedIn: async (p) => {
        try {
          await api.call('ping');
          toast(`ยินดีต้อนรับ ${p.name}`, 'ok');
          location.reload();
        } catch (e) {
          auth.signOut();
          toast(e.message, 'err', 7000);
          render();
        }
      }
    }).catch(e => {
      gBox.replaceChildren(h('div', { class: 'hint' }, e.message));
    });
  }

  const keyIn = h('input', { type: 'text', placeholder: 'รหัสลับจากแท็บ 📖 วิธีใช้' });
  const keyBtn = h('button', { class: 'btn btn-ghost btn-block' }, 'เชื่อมด้วยรหัสลับแทน');
  keyBtn.onclick = async () => {
    const k = keyIn.value.trim();
    if (!k) return toast('กรอกรหัสลับ', 'err');
    keyBtn.disabled = true; keyBtn.textContent = 'กำลังตรวจสอบ…';
    api.conn.save(api.conn.url, k);
    try {
      await api.call('ping');
      toast('เชื่อมต่อสำเร็จ 🎉', 'ok');
      location.reload();
    } catch (e) {
      api.conn.save(api.conn.url, '');
      keyBtn.disabled = false; keyBtn.textContent = 'เชื่อมด้วยรหัสลับแทน';
      toast(e.message, 'err', 6000);
    }
  };

  keyIn.classList.add('setup-mono');

  return h('div', null,
    h('div', { class: 'setup-h' }, 'ยืนยันตัวตนแล้วเริ่มใช้งาน'),
    h('div', { class: 'setup-p', style: { wordBreak: 'break-all' } },
      'เชื่อมกับ ', h('span', { class: 'setup-mono' }, api.conn.url)),

    // เลือกวิธียืนยันตัวตน — ดีไซน์วางเป็นการ์ด 2 ใบเทียบกัน
    h('div', { class: 'field', style: { marginTop: '14px' } },
      h('label', null, 'วิธียืนยันตัวตน'),
      h('div', { class: 'pick2' },
        h('button', { 'data-on': ui.method === 'google' ? '1' : '0', onclick: () => { ui.method = 'google'; render(); } },
          h('b', null, 'บัญชี Google'),
          h('span', null, 'แนะนำ · ใช้ได้หลายเครื่อง ไม่ต้องจำรหัส')),
        h('button', { 'data-on': ui.method === 'key' ? '1' : '0', onclick: () => { ui.method = 'key'; render(); } },
          h('b', null, 'รหัสลับ'),
          h('span', null, 'เริ่มเร็วสุด เหมาะกับเครื่องเดียว')))),

    ui.method === 'google'
      ? (auth.clientId
          ? h('div', null,
              h('div', { class: 'setup-p', style: { marginBottom: '10px' } },
                'ใช้บัญชี Google เดียวกับที่เป็นเจ้าของไฟล์ชีต — เปลี่ยนเครื่องเมื่อไหร่ก็เข้าได้ทันที'),
              gBox)
          : h('div', { style: { background: 'var(--amber-soft)', padding: '11px 13px', borderRadius: '11px', fontSize: '13px', color: 'var(--warn-ink)', lineHeight: '1.6' } },
              h('b', null, 'ยังไม่ได้เปิดใช้การเข้าสู่ระบบด้วย Google'), h('br'),
              'ใส่ ', h('code', null, 'oauth_client_id'), ' ในแท็บ ⚙️ ตั้งค่า ของชีต แล้ว Deploy ใหม่ (ดูวิธีด้านล่าง)',
              h('br'), 'หรือเลือก "รหัสลับ" ด้านบนเพื่อเริ่มใช้ก่อน'))
      : h('div', null,
          h('div', { class: 'field' },
            h('label', null, 'รหัสลับ'), keyIn,
            h('div', { class: 'hint' }, 'อยู่ในแท็บ 📖 วิธีใช้ ของชีต')),
          keyBtn),

    h('button', {
      class: 'btn btn-ghost btn-block btn-sm', style: { marginTop: '8px' },
      onclick: () => { ui.step = 1; ui.info = null; render(); }
    }, '‹ เปลี่ยน URL')
  );
}

function helpCard() {
  return h('details', { class: 'card' },
    h('summary', { style: { fontWeight: '700', cursor: 'pointer' } }, '📋 ขั้นตอนติดตั้ง (ทำครั้งเดียว)'),
    h('ol', { style: { paddingLeft: '20px', fontSize: '13.5px', lineHeight: '1.85', color: 'var(--ink-2)' } },
      h('li', null, 'สร้าง Google Sheet ใหม่ → ', h('b', null, 'ส่วนขยาย → Apps Script')),
      h('li', null, 'วางไฟล์ ', h('code', null, 'ALL-IN-ONE.gs'), ' ทับโค้ดเดิม แล้วบันทึก'),
      h('li', null, 'กลับไปที่ชีต รีเฟรช → เมนู ', h('b', null, '📗 AssignCheck → 🚀 ติดตั้ง')),
      h('li', null, 'Apps Script → ', h('b', null, 'Deploy → New deployment → Web app'), h('br'),
        'Execute as: ', h('b', null, 'Me'), ' · Who has access: ', h('b', null, 'Anyone')),
      h('li', null, 'คัดลอก Web app URL มาใส่ด้านบน')
    ),
    h('div', { style: { fontWeight: '700', marginTop: '10px', fontSize: '13.5px' } }, '🔐 เปิดใช้เข้าสู่ระบบด้วย Google'),
    h('ol', { style: { paddingLeft: '20px', fontSize: '13.5px', lineHeight: '1.85', color: 'var(--ink-2)' } },
      h('li', null, 'ไปที่ ', h('code', null, 'console.cloud.google.com'), ' → สร้างโปรเจกต์'),
      h('li', null, h('b', null, 'APIs & Services → OAuth consent screen'), ' → External → ใส่ชื่อแอปกับอีเมล'),
      h('li', null, h('b', null, 'Credentials → Create credentials → OAuth client ID'), ' → Web application'),
      h('li', null, 'ใส่ ', h('b', null, 'Authorized JavaScript origins'), ' ให้ครบทุกที่ที่จะเปิดแอป เช่น',
        h('br'), h('code', null, 'http://localhost:5599'), h('br'),
        h('code', null, 'https://ชื่อคุณ.github.io')),
      h('li', null, 'คัดลอก ', h('b', null, 'Client ID'), ' ไปใส่ช่อง ', h('code', null, 'oauth_client_id'),
        ' ในแท็บ ⚙️ ตั้งค่า ของชีต')
    )
  );
}

function render() {
  const ev = new CustomEvent('ac:rerender');
  window.dispatchEvent(ev);
}

__exp(exports, { viewSetup });

  };

  __defs["js/views/home.js"] = function (exports, __req) {
/* หน้าแรก — จัดการห้องเรียน/รายวิชา และภาพรวม */

const { h, modal, toast, confirmBox, todayISO } = __req("js/dom.js");
const { state, go, loadClass, createClass, updateClassMeta, deleteClass, setStudents, settings } = __req("js/state.js");
const { computeClass } = __req("js/score.js");

function viewHome() {
  // ลำดับตามดีไซน์: เปิดแอปมาต้องเห็น "สิ่งที่ต้องทำต่อ" ก่อน
  // แล้วค่อยเป็นรายการห้องไว้สลับ
  return h('div', { class: 'page' },
    state.cls && overviewCard(),

    h('div', { style: { display: 'flex', alignItems: 'center', gap: '12px', margin: '18px 0 12px' } },
      h('div', { style: { fontSize: '15px', fontWeight: '700', flex: '1' } },
        `ห้องเรียนของฉัน · ${state.classes.length} ห้อง-วิชา`),
      h('button', { class: 'btn-dark', onclick: () => openClassForm() }, '+ เพิ่มห้อง')
    ),

    state.classes.length === 0
      ? h('div', { class: 'card empty' },
          h('div', { class: 'empty-icon' }, '📚'),
          h('div', { style: { fontWeight: '600' } }, 'ยังไม่มีห้องเรียน'),
          h('div', { style: { fontSize: '13px', marginBottom: '14px' } },
            'สร้างห้องแรก เช่น "ม.1/1 · คณิตศาสตร์พื้นฐาน"'),
          h('button', { class: 'btn', onclick: () => openClassForm() }, 'สร้างห้องเรียนแรก'))
      : h('div', { class: 'class-grid' }, state.classes.map(classCard))
  );
}

function classCard(c) {
  const active = c.classId === state.classId;
  return h('div', { class: 'class-card', 'data-on': active ? '1' : '0' },
    h('button', {
      style: { display: 'flex', alignItems: 'center', gap: '12px', flex: '1', minWidth: '0', textAlign: 'left' },
      onclick: async () => { await loadClass(c.classId); go('att'); }
    },
      h('div', { class: 'class-avatar' }, [c.grade, c.room].filter(Boolean).join('/') || '—'),
      h('div', { style: { minWidth: '0' } },
        h('div', { class: 'class-name' }, c.subject),
        h('div', { class: 'class-meta' },
          `${c.studentCount || 0} คน${c.subjectCode ? ' · ' + c.subjectCode : ''}`))
    ),
    h('button', {
      class: 'icon-btn', style: { color: 'var(--ink-3)' },
      onclick: () => openClassMenu(c)
    }, '⋯')
  );
}

function overviewCard() {
  const rows = computeClass(state.cls, settings());
  if (!rows.length) {
    return h('div', { class: 'card empty' },
      h('div', { class: 'empty-icon' }, '👥'),
      h('div', { style: { fontWeight: '600', marginBottom: '10px' } }, 'ห้องนี้ยังไม่มีรายชื่อนักเรียน'),
      h('button', { class: 'btn', onclick: () => openRoster(state.cls) }, 'นำเข้ารายชื่อ'));
  }
  const S = settings();
  const risk  = rows.filter(r => r.attN > 0 && r.pct < S.minPct).length;
  const graded = rows.filter(r => r.dataN > 0);
  const avg   = graded.length ? graded.reduce((a, r) => a + r.total, 0) / graded.length : null;
  const zero  = rows.filter(r => r.flag.includes('เสี่ยงติด 0')).length;

  const cls = state.cls;
  const attToday = (cls.columns || []).some(c => c.kind === 'ATT' && c.date === todayISO());

  // ── การ์ดหลัก: ห้องที่เลือกอยู่ + ปุ่มที่ควรกดตอนนี้ ──
  // ไลม์คือปุ่มหลักสีเดียวของแอป จึงมีได้จุดเดียวในหน้าจอ
  const hero = h('div', { class: 'hero' },
    h('div', { class: 'hero-body' },
      h('div', { class: 'hero-kicker' },
        [cls.meta.grade, cls.meta.room].filter(Boolean).join('/') + ' · ' + (cls.meta.subjectCode || 'ห้องที่เลือกอยู่')),
      h('div', { class: 'hero-title' }, cls.meta.subject),
      h('div', { class: 'hero-meta' },
        `${rows.length} คน · ` + (attToday ? 'เช็คชื่อวันนี้แล้ว' : 'ยังไม่ได้เช็คชื่อวันนี้'))),
    h('div', { class: 'hero-actions' },
      h('button', { class: 'btn', onclick: () => go('att') },
        attToday ? 'เปิดหน้าเช็คชื่อ' : '✓ เริ่มเช็คชื่อวันนี้'),
      h('button', { class: 'hero-alt', onclick: () => go('work') }, 'กรอกงาน / คะแนน'))
  );

  // ── สิ่งที่ยังค้าง ──
  const pending = rows.reduce((a, r) => a + r.pending, 0);
  const todos = [];
  if (pending > 0) {
    todos.push({ c: 'var(--st-late)', t: `ยังไม่ตรวจ ${pending} ช่อง`, go: 'work', cta: 'ตรวจ' });
  }
  if (!String(state.config.mid_date || '').trim()) {
    todos.push({ c: 'var(--st-miss)', t: 'ยังไม่ได้ตั้งวันสอบกลางภาค', go: 'settings', cta: 'ตั้งค่า' });
  }
  if (risk > 0) {
    todos.push({ c: 'var(--st-miss)', t: `เสี่ยงติด มส ${risk} คน`, go: 'report', cta: 'ดู' });
  }
  if (!attToday) {
    todos.push({ c: 'var(--accent)', t: 'ยังไม่ได้เช็คชื่อวันนี้', go: 'att', cta: 'เช็ค' });
  }

  return h('div', null,
    hero,

    // ดีไซน์วาง "ค้างอยู่" กับตัวเลขสรุปเคียงกันบน PC · ซ้อนกันบนมือถือ
    h('div', { class: 'home-grid' },
      h('div', { class: 'card' },
        h('div', { style: { fontWeight: '700', fontSize: '14px', marginBottom: '10px' } },
          `ค้างอยู่ · ${[cls.meta.grade, cls.meta.room].filter(Boolean).join('/') || cls.meta.subject}`),
        todos.length === 0
          ? h('div', { style: { fontSize: '13px', color: 'var(--ink-2)' } }, 'ไม่มีอะไรค้าง 🎉')
          : todos.map(t => h('button', { class: 'todo-row', onclick: () => go(t.go) },
              h('i', { style: { background: t.c } }), t.t, h('b', null, t.cta + ' →')))),

      h('div', { class: 'card stats-card' },
        h('div', { class: 'stats' },
          stat('g', rows.length, 'นักเรียน'),
          stat('b', avg === null ? '—' : avg.toFixed(1), 'คะแนนเฉลี่ย'),
          stat('a', risk, 'เสี่ยง มส'),
          stat('r', zero, 'เสี่ยงติด 0')),
        avg === null && h('div', { class: 'hint' },
          'ยังไม่ได้เช็คชื่อหรือกรอกคะแนน — ตัวเลขจะขึ้นเมื่อเริ่มบันทึกข้อมูล'))
    )
  );
}

const stat = (cls, num, lbl) => h('div', { class: 'stat ' + cls },
  h('div', { class: 'stat-num' }, String(num)), h('div', { class: 'stat-lbl' }, lbl));

// ── สร้าง / แก้ไขห้อง ───────────────────────────────────────

function openClassForm(edit) {
  const m = edit || {};
  const subject = h('input', { value: m.subject || '', placeholder: 'เช่น คณิตศาสตร์พื้นฐาน' });
  const code    = h('input', { value: m.subjectCode || '', placeholder: 'เช่น ค21101' });
  const grade   = h('input', { value: m.grade || '', placeholder: 'เช่น ม.1' });
  const room    = h('input', { value: m.room || '', placeholder: 'เช่น 1' });
  const roster  = h('textarea', { rows: 6, placeholder: '61475\tกฤตภาส คงพลอย\n61476\tคมกริช พิลา\n\n(วางจาก Excel ได้เลย หรือใส่แค่ชื่อก็ได้)' });

  modal((close) => {
    const save = h('button', { class: 'btn btn-block' }, edit ? 'บันทึก' : 'สร้างห้องเรียน');
    save.onclick = async () => {
      if (!subject.value.trim()) return toast('กรอกชื่อวิชา', 'err');
      save.disabled = true; save.textContent = 'กำลังบันทึก…';
      const meta = {
        subject: subject.value.trim(), subjectCode: code.value.trim(),
        grade: grade.value.trim(), room: room.value.trim()
      };
      try {
        if (edit) { await updateClassMeta(meta); toast('บันทึกแล้ว', 'ok'); }
        else {
          const students = parseRoster(roster.value);
          await createClass(meta, students);
          toast(`สร้างห้องแล้ว · ${students.length} คน`, 'ok');
        }
        close();
      } catch (e) {
        save.disabled = false; save.textContent = 'ลองใหม่';
        toast(e.message, 'err', 5000);
      }
    };

    return h('div', null,
      h('h2', null, edit ? 'แก้ไขห้องเรียน' : 'เพิ่มห้องเรียน / รายวิชา'),
      h('div', { class: 'field' }, h('label', null, 'ชื่อวิชา *'), subject),
      h('div', { class: 'field-row' },
        h('div', { class: 'field' }, h('label', null, 'รหัสวิชา'), code),
        h('div', { class: 'field' }, h('label', null, 'ระดับชั้น'), grade),
        h('div', { class: 'field' }, h('label', null, 'ห้อง'), room)),
      !edit && h('div', { class: 'field' },
        h('label', null, 'รายชื่อนักเรียน (ไม่ใส่ตอนนี้ก็ได้)'), roster,
        h('div', { class: 'hint' }, 'รองรับ: “เลขที่ ⇥ เลขประจำตัว ⇥ ชื่อ” · “เลขประจำตัว ⇥ ชื่อ” · หรือชื่ออย่างเดียว')),
      !edit && h('div', { class: 'hint', style: { marginBottom: '10px' } },
        '💡 แต่ละห้อง-วิชาจะได้แท็บของตัวเองใน Google Sheet เก็บทั้งเช็คชื่อ คะแนน และสรุปไว้ด้วยกัน'),
      save
    );
  });
}

function openClassMenu(c) {
  modal((close) => h('div', null,
    h('h2', null, c.subject),
    h('div', { style: { color: 'var(--ink-2)', fontSize: '13px', marginBottom: '14px' } },
      `${[c.grade, c.room].filter(Boolean).join('/') || '—'} · ${c.studentCount || 0} คน · แท็บ “${c.sheetName}”`),
    h('div', { style: { display: 'grid', gap: '8px' } },
      h('button', { class: 'btn btn-ghost btn-block', onclick: async () => { close(); await loadClass(c.classId); openRoster(state.cls); } }, '👥 จัดการรายชื่อนักเรียน'),
      h('button', { class: 'btn btn-ghost btn-block', onclick: async () => { close(); await loadClass(c.classId); openClassForm(state.cls.meta); } }, '✏️ แก้ไขข้อมูลห้อง'),
      h('button', {
        class: 'btn btn-danger btn-block',
        onclick: async () => {
          close();
          const ok = await confirmBox('ลบห้องเรียน?',
            `แท็บ “${c.sheetName}” และข้อมูลทั้งหมดในนั้นจะถูกลบถาวร กู้คืนไม่ได้`, 'ลบถาวร');
          if (!ok) return;
          try { await deleteClass(c.classId); toast('ลบแล้ว', 'ok'); }
          catch (e) { toast(e.message, 'err'); }
        }
      }, '🗑 ลบห้องเรียน')
    )
  ));
}

// ── รายชื่อนักเรียน ─────────────────────────────────────────

function openRoster(cls) {
  const initial = (cls.students || [])
    .map(s => [s.no, s.sid, s.name].join('\t')).join('\n');
  const ta = h('textarea', { rows: 14, value: initial, style: { fontFamily: 'ui-monospace, monospace', fontSize: '13px' } });

  modal((close) => {
    const save = h('button', { class: 'btn btn-block' }, 'บันทึกรายชื่อ');
    save.onclick = async () => {
      const students = parseRoster(ta.value);
      if (!students.length) return toast('ไม่มีรายชื่อ', 'err');
      save.disabled = true; save.textContent = 'กำลังบันทึก…';
      try {
        await setStudents(students);
        toast(`บันทึก ${students.length} คนแล้ว`, 'ok');
        close();
      } catch (e) {
        save.disabled = false; save.textContent = 'ลองใหม่';
        toast(e.message, 'err', 5000);
      }
    };
    return h('div', null,
      h('h2', null, 'รายชื่อนักเรียน · ' + cls.meta.subject),
      h('div', { class: 'hint', style: { marginBottom: '8px' } },
        'หนึ่งบรรทัดต่อหนึ่งคน คั่นด้วย Tab หรือ , — วางจาก Excel ได้เลย'),
      ta,
      h('div', { class: 'hint', style: { margin: '8px 0 12px' } },
        '⚠️ คะแนนเดิมจะถูกจับคู่กลับด้วย “เลขประจำตัว” ถ้าเปลี่ยนเลขประจำตัว คะแนนของคนนั้นจะหาย'),
      save
    );
  });
}

/**
 * แปลงข้อความรายชื่อเป็น [{no, sid, name}]
 * รองรับทั้งแบบคั่นด้วย Tab / จุลภาค / เว้นวรรคหลายตัว (วางจาก Excel)
 * และแบบคั่นด้วยเว้นวรรคเดียว เช่น "1 61475 กฤตภาส คงพลอย" (คัดลอกจาก PDF/เว็บ)
 */
function parseRoster(text) {
  return String(text || '').split(/\r?\n/)
    .map(l => l.trim()).filter(Boolean)
    .map((line, i) => {
      let p = line.split(/\t|,|\s{2,}/).map(x => x.trim()).filter(Boolean);

      // ไม่มีตัวคั่นชัดเจน → ดึงเลขที่/เลขประจำตัวที่นำหน้าออกมาเอง
      if (p.length === 1) {
        const tok = line.split(/\s+/);
        const lead = [];
        while (tok.length > 1 && lead.length < 2 && /^\d+$/.test(tok[0])) lead.push(tok.shift());
        p = lead.concat(tok.join(' '));
      }

      if (p.length >= 3 && /^\d{1,3}$/.test(p[0])) return { no: p[0], sid: p[1], name: p.slice(2).join(' ') };
      if (p.length >= 2 && /^\d{3,}$/.test(p[0]))  return { no: String(i + 1), sid: p[0], name: p.slice(1).join(' ') };
      if (p.length >= 2 && /^\d{1,3}$/.test(p[0])) return { no: p[0], sid: '', name: p.slice(1).join(' ') };
      return { no: String(i + 1), sid: '', name: p.join(' ') };
    })
    .map((s, i) => ({ no: s.no || String(i + 1), sid: s.sid || `T${i + 1}`, name: s.name }));
}

__exp(exports, { viewHome });

  };

  __defs["js/views/attendance.js"] = function (exports, __req) {
/* หน้าเช็คชื่อ — 2 จังหวะ
 *   จังหวะ 1  เลือกวัน (ปกติกดปุ่มเดียวจบ เพราะเป็นวันนี้)
 *   จังหวะ 2  เช็คชื่อ — เต็มจอ ไม่มีตัวเลือกอะไรมากวน
 *
 * "ช่วง ก่อน/หลังกลางภาค" ระบบคำนวณจากวันสอบกลางภาคให้เอง
 * ไม่ถามครูตอนเช็ค (แก้ได้ในเมนู ⋯ ถ้าจำเป็น)
 */

const { h, toast, todayISO, fmtDate, fmtDayFull, isToday, confirmBox, modal } = __req("js/dom.js");
const { state, emit, ensureColumn, setCells, getCell, deleteColumn, go } = __req("js/state.js");
const { ATT_CODES, ATT_NAMES, attStats } = __req("js/score.js");

const ui = {
  // ดีไซน์ให้แตะ "เช็คชื่อ" แล้วเข้าหน้าเช็คของวันนี้เลย ไม่ต้องผ่านหน้าเลือกวัน
  // (หน้าเลือกวัน/ประวัติ ยังเข้าได้จากปุ่ม ‹ มุมซ้ายบน)
  mode: 'check',             // 'list' = เลือกวัน · 'check' = กำลังเช็ค
  date: todayISO(),
  period: 1,
  halfOverride: null,        // ตั้งเองเฉพาะกรณีที่ระบบเดาผิด
  pending: null,             // คาบที่เพิ่งกดเพิ่ม ยังไม่มีข้อมูลในชีต
  onlyBlank: false           // กรองเฉพาะคนที่ยังไม่เช็ค
};

// ── ตัวช่วย ─────────────────────────────────────────────────

function guessHalf(dateISO) {
  const mid = String(state.config.mid_date || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(mid)) return 1;
  return dateISO > mid ? 2 : 1;
}
const halfOf = (dateISO) => ui.halfOverride ?? guessHalf(dateISO);

const keyFor = (dateISO, period) =>
  `ATT|${halfOf(dateISO)}|${dateISO.replace(/-/g, '')}-${period}`;

function periodsOn(dateISO) {
  return (state.cls?.columns || [])
    .filter(c => c.kind === 'ATT' && c.date === dateISO)
    .sort((a, b) => a.period - b.period);
}

/** สรุปทั้งวัน (รวมทุกคาบ) ใช้โชว์ในรายการวัน */
function daySummary(dateISO) {
  const cols = periodsOn(dateISO);
  const acc = { 'ม': 0, 'ส': 0, 'ล': 0, 'ข': 0, blank: 0, periods: cols.length };
  for (const c of cols) {
    const s = attStats(state.cls, c.key);
    for (const k of [...ATT_CODES, 'blank']) acc[k] += s[k];
  }
  return acc;
}

function enterCheck(dateISO, period, { markAllPresent = false } = {}) {
  ui.mode = 'check';
  ui.date = dateISO;
  ui.period = period;
  ui.halfOverride = null;
  ui.pending = null;
  ui.onlyBlank = false;
  if (markAllPresent) {
    const key = keyFor(dateISO, period);
    ensureColumn(colSpecFromKey(key), { quiet: true });
    setCells(state.cls.students.map(s => ({ key, sid: s.sid, value: 'ม' })), { quiet: true });
    toast('ทำเครื่องหมาย "มา" ทุกคนแล้ว — แตะแก้เฉพาะคนที่ไม่ปกติ', 'ok', 3200);
  }
  emit();
}

// ── หน้าเข้าสู่การเช็ค ──────────────────────────────────────

function viewAttendance() {
  const cls = state.cls;
  if (!cls) return h('div', { class: 'page empty' }, 'ยังไม่ได้เลือกห้องเรียน');
  if (!cls.students.length) {
    return h('div', { class: 'page' }, h('div', { class: 'card empty' },
      h('div', { class: 'empty-icon' }, '👥'), 'ห้องนี้ยังไม่มีรายชื่อนักเรียน'));
  }
  return ui.mode === 'check' ? checkScreen() : dayListScreen();
}

/**
 * คาบที่มีของวันที่เลือก + สถิติของคาบปัจจุบัน
 * ใช้ร่วมกันระหว่างแถบหัว (มือถือ) กับตัวหน้า — ต้องได้ค่าเดียวกันเสมอ
 */
function resolve() {
  const cls = state.cls;
  const onDay = periodsOn(ui.date);
  const available = onDay.map(c => c.period);
  if (ui.pending && ui.pending.date === ui.date && !available.includes(ui.pending.period)) {
    available.push(ui.pending.period);
  }
  if (!available.length) available.push(1);
  available.sort((a, b) => a - b);
  if (!available.includes(ui.period)) ui.period = available[0];

  const key = keyFor(ui.date, ui.period);
  return { cls, available, key, st: attStats(cls, key) };
}

/** เลื่อนไปวันก่อนหน้า/ถัดไป (ปุ่ม ‹ › ในดีไซน์หน้า PC) */
function stepDay(delta) {
  const d = new Date(ui.date + 'T00:00:00');
  d.setDate(d.getDate() + delta);
  const iso = d.toISOString().slice(0, 10);
  const p = periodsOn(iso);
  ui.date = iso;
  ui.period = p.length ? p[0].period : 1;
  ui.pending = null;
  ui.onlyBlank = false;
  emit();
}

/** แถบหัวสีเข้มของหน้านี้ (มือถือ) — วันที่ · คาบ · ตัวนับ · ปุ่มหลัก */
viewAttendance.head = function () {
  const cls = state.cls;
  if (!cls || !cls.students.length) return null;

  // หน้าประวัติ — แถบหัวบางกว่า มีแค่ชื่อหน้ากับทางกลับ
  if (ui.mode !== 'check') {
    const total = (cls.columns || []).filter(c => c.kind === 'ATT').length;
    return h('header', { class: 'pagehead' },
      h('div', { class: 'ph-row' },
        h('button', {
          class: 'ph-back', 'aria-label': 'กลับไปเช็ควันนี้',
          onclick: () => enterCheck(todayISO(), periodsOn(todayISO())[0]?.period || 1)
        }, '‹'),
        h('div', { class: 'ph-grow' },
          h('div', { class: 'ph-title' }, 'ประวัติการเช็คชื่อ'),
          h('div', { class: 'ph-sub' },
            `${[cls.meta.grade, cls.meta.room].filter(Boolean).join('/')} ${cls.meta.subject} · ${total} คาบ`))));
  }

  const { available, key, st } = resolve();
  const done = cls.students.length - st.blank;

  return h('header', { class: 'pagehead' },
    h('div', { class: 'ph-row' },
      h('button', { class: 'ph-back', 'aria-label': 'กลับ', onclick: () => { ui.mode = 'list'; emit(); } }, '‹'),
      h('div', { class: 'ph-grow' },
        h('div', { class: 'ph-title' },
          fmtDate(ui.date) + (available.length > 1 ? ` · คาบ ${ui.period}` : '')),
        h('div', { class: 'ph-sub' },
          `${[cls.meta.grade, cls.meta.room].filter(Boolean).join('/')} ${cls.meta.subject}`)),
      h('div', { class: 'ph-badge' }, `${done}/${cls.students.length}`),
      h('button', { class: 'ph-back', 'aria-label': 'ตัวเลือกเพิ่มเติม', onclick: () => openMenu(available, key) }, '⋯')
    ),
    // คาบเรียนใช้ dropdown — จำนวนคาบไม่จำกัด ถ้าเรียงเป็นชิปจะกินที่แถบหัว
    // ไปเรื่อย ๆ ตามจำนวนคาบ และหาคาบที่ต้องการยากขึ้นเมื่อมีหลายคาบ
    available.length > 1 && h('div', { class: 'ph-chips' },
      h('label', { class: 'ph-pick' },
        h('span', null, 'คาบ'),
        h('select', {
          'aria-label': 'เลือกคาบเรียน',
          onchange: (e) => { ui.period = Number(e.target.value); ui.onlyBlank = false; emit(); }
        }, available.map(pn => h('option', {
          value: String(pn), selected: pn === ui.period
        }, String(pn))))),
      h('button', { class: 'ph-chip add', onclick: () => addPeriod(available, ui.date) }, '+ เพิ่มคาบ')
    ),
    h('div', { class: 'ph-actions' },
      h('button', { class: 'ph-main', onclick: () => markAll(key, 'ม') }, '✓ ทุกคนมา'),
      st.blank > 0
        ? h('button', {
            class: 'ph-side', 'data-on': ui.onlyBlank ? '1' : '0',
            onclick: () => { ui.onlyBlank = !ui.onlyBlank; emit(); }
          }, ui.onlyBlank ? 'แสดงทุกคน' : `ยังว่าง ${st.blank}`)
        : h('div', { class: 'ph-side' }, 'ครบแล้ว')
    )
  );
};

function dayListScreen() {
  const today = todayISO();
  const cols = periodsOn(today);
  const sum = daySummary(today);
  const checked = cols.length > 0 && sum.blank < state.cls.students.length;

  return h('div', { class: 'page' },

    // PC: หัวหน้าจอ + ทางกลับ (มือถืออยู่ในแถบเข้มแล้ว)
    h('div', { class: 'ctxbar' },
      h('button', {
        class: 'ctx-step', 'aria-label': 'กลับไปเช็ควันนี้',
        onclick: () => enterCheck(today, cols[0]?.period || 1)
      }, '‹'),
      h('div', { style: { flex: '1', minWidth: '0' } },
        h('div', { class: 'ctx-title' }, 'ประวัติการเช็คชื่อ'),
        h('div', { class: 'ctx-sub' },
          checked
            ? `วันนี้เช็คแล้ว · มา ${sum['ม']} · สาย ${sum['ส']} · ลา ${sum['ล']} · ขาด ${sum['ข']}`
            : 'วันนี้ยังไม่ได้เช็คชื่อ')),
      h('div', { class: 'ctx-end' },
        h('button', { class: 'btn', onclick: () => enterCheck(today, cols[0]?.period || 1) },
          checked ? 'เช็คชื่อวันนี้ต่อ' : '✓ เริ่มเช็คชื่อวันนี้'))),

    // ── ย้อนไปวันอื่น ──
    h('div', { class: 'card', style: { display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' } },
      h('span', { style: { fontSize: '13px', color: 'var(--ink-2)', flex: 'none' } }, 'ย้อนไปเช็ควันอื่น'),
      h('input', {
        type: 'date', value: ui.date, style: { flex: '1', minWidth: '160px' },
        onchange: (e) => {
          if (!e.target.value) return;
          const d = e.target.value;
          const p = periodsOn(d);
          enterCheck(d, p.length ? p[0].period : 1);
        }
      }),
      // มือถือไม่มีปุ่มหลักในแถบบริบท จึงใส่ไว้ตรงนี้แทน
      h('button', {
        class: 'btn pc-hide', style: { flexBasis: '100%' },
        onclick: () => enterCheck(today, cols[0]?.period || 1)
      }, checked ? 'เช็คชื่อวันนี้ต่อ' : '✓ เริ่มเช็คชื่อวันนี้')
    ),

    historyCard()
  );
}

function historyCard() {
  const byDate = {};
  for (const c of state.cls.columns) {
    if (c.kind !== 'ATT') continue;
    (byDate[c.date] ||= []).push(c);
  }
  const dates = Object.keys(byDate).sort().reverse();
  const total = state.cls.columns.filter(c => c.kind === 'ATT').length;

  if (!dates.length) {
    return h('div', { class: 'card empty' },
      h('div', { class: 'empty-icon' }, '🗓'),
      h('div', { style: { fontSize: '13px' } },
        'ยังไม่เคยเช็คชื่อห้องนี้', h('br'), 'เช็ควันไหน ระบบจะบันทึกวันนั้นให้เอง วันที่ไม่เช็คไม่ถูกนำมาคิดคะแนน'));
  }

  return h('div', null,
    h('div', { class: 'section-title' }, `ประวัติการเช็ค · ${dates.length} วัน / ${total} คาบ`),
    h('div', { class: 'card card-tight' },
      dates.slice(0, 30).map(d => {
        const cols = byDate[d].sort((a, b) => a.period - b.period);
        const s = daySummary(d);
        return h('div', { class: 'list-row' },
          h('button', {
            style: { display: 'flex', alignItems: 'center', gap: '10px', flex: '1', minWidth: '0', textAlign: 'left' },
            onclick: () => enterCheck(d, cols[0].period)
          },
            h('div', { class: 'list-main' },
              h('div', { class: 'list-title' }, fmtDayFull(d),
                isToday(d) ? h('span', { class: 'badge g', style: { marginLeft: '6px' } }, 'วันนี้') : null),
              h('div', { class: 'list-sub' },
                (cols.length > 1 ? `${cols.length} คาบ · ` : '') +
                `มา ${s['ม']} · สาย ${s['ส']} · ลา ${s['ล']} · ขาด ${s['ข']}` +
                (s.blank ? ` · ยังไม่เช็ค ${s.blank}` : ''))),
            s['ข'] > 0 ? h('span', { class: 'badge r' }, 'ขาด ' + s['ข']) : h('span', { class: 'badge g' }, 'ครบ')
          ),
          h('button', {
            class: 'icon-btn', style: { color: 'var(--ink-3)' }, title: 'แก้ไข / ลบ',
            onclick: () => openDayMenu(d, cols)
          }, '⋯')
        );
      })
    ));
}

/** เมนูแก้ไข/ลบ ของวันหนึ่ง ๆ ในประวัติ */
function openDayMenu(dateISO, cols) {
  modal((close) => h('div', null,
    h('h2', null, fmtDayFull(dateISO)),
    h('div', { class: 'hint', style: { marginBottom: '12px' } },
      cols.length > 1 ? `วันนี้เช็คไว้ ${cols.length} คาบ` : 'เช็คไว้ 1 คาบ'),
    h('div', { style: { display: 'grid', gap: '8px' } },

      ...cols.map(c => h('button', {
        class: 'btn btn-ghost btn-block',
        onclick: () => { close(); enterCheck(dateISO, c.period); }
      }, cols.length > 1 ? `✏️ แก้ไขคาบ ${c.period}` : '✏️ แก้ไขการเช็คชื่อ')),

      h('div', { class: 'sep' }, 'ลบ'),

      ...cols.map(c => h('button', {
        class: 'btn btn-danger btn-block',
        onclick: async () => {
          close();
          const label = cols.length > 1 ? `คาบ ${c.period} ของ ${fmtDate(dateISO)}` : fmtDate(dateISO);
          if (!await confirmBox('ลบการเช็คชื่อ?', `${label} จะถูกลบออกจากชีต และไม่ถูกนำไปคิดคะแนนอีก`, 'ลบ')) return;
          await deleteColumn(c.key);
          toast('ลบแล้ว', 'ok');
        }
      }, cols.length > 1 ? `🗑 ลบคาบ ${c.period}` : '🗑 ลบการเช็คชื่อวันนี้')),

      cols.length > 1 && h('button', {
        class: 'btn btn-danger btn-block',
        onclick: async () => {
          close();
          if (!await confirmBox('ลบทั้งวัน?', `ทั้ง ${cols.length} คาบของ ${fmtDate(dateISO)} จะถูกลบ`, 'ลบทั้งวัน')) return;
          for (const c of cols) await deleteColumn(c.key);
          toast(`ลบ ${cols.length} คาบแล้ว`, 'ok');
        }
      }, `🗑 ลบทั้งวัน (${cols.length} คาบ)`)
    )
  ));
}

// ── หน้ากำลังเช็ค ───────────────────────────────────────────

function checkScreen() {
  const { cls, available, key, st } = resolve();
  const total = cls.students.length;
  const done = total - st.blank;
  const odd = st['ส'] + st['ล'] + st['ข'];
  const shown = ui.onlyBlank
    ? cls.students.filter(s => !ATT_CODES.includes(String(getCell(key, s.sid) || '')))
    : cls.students;

  return h('div', { class: 'page' },

    // ── PC: บริบทของหน้าเป็นการ์ดขาว (มือถืออยู่ในแถบเข้มด้านบนแล้ว) ──
    h('div', { class: 'ctxbar' },
      h('button', { class: 'ctx-step', 'aria-label': 'วันก่อนหน้า', onclick: () => stepDay(-1) }, '‹'),
      h('div', null,
        h('div', { class: 'ctx-title' }, fmtDayFull(ui.date)),
        h('div', { class: 'ctx-sub' },
          `${halfOf(ui.date) === 1 ? 'ก่อนกลางภาค' : 'หลังกลางภาค'} · แก้ช่วงได้ในเมนู ⋯`)),
      h('button', { class: 'ctx-step', 'aria-label': 'วันถัดไป', onclick: () => stepDay(1) }, '›'),

      h('div', { class: 'ph-chips', style: { marginTop: '0', gap: '6px' } },
        available.length > 1 && h('label', { class: 'pickbox' },
          h('span', null, 'คาบ'),
          h('select', {
            'aria-label': 'เลือกคาบเรียน',
            onchange: (e) => { ui.period = Number(e.target.value); ui.onlyBlank = false; emit(); }
          }, available.map(pn => h('option', {
            value: String(pn), selected: pn === ui.period
          }, String(pn))))),
        h('button', { class: 'chip', onclick: () => addPeriod(available, ui.date) }, '+ เพิ่มคาบ')),

      h('div', { class: 'ctx-end' },
        h('span', { class: 'tnum', 'data-t': 'done', style: { fontSize: '13px', color: 'var(--ink-2)' } },
          `เช็คแล้ว ${done}/${total}`),
        h('button', { class: 'btn btn-sm', onclick: () => markAll(key, 'ม') }, '✓ ทุกคนมา'),
        h('button', { class: 'icon-btn', onclick: () => openMenu(available, key) }, '⋯'))
    ),

    // ── แถวกรอง + ตัวนับ (ตามดีไซน์ วางอยู่เหนือรายชื่อ) ──
    h('div', { class: 'filter-row', style: { display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '10px' } },
      h('button', {
        class: 'chip', 'data-on': ui.onlyBlank ? '0' : '1',
        onclick: () => { ui.onlyBlank = false; emit(); }
      }, `ทั้งหมด ${total}`),
      h('button', {
        class: 'chip', 'data-on': ui.onlyBlank ? '1' : '0',
        onclick: () => { ui.onlyBlank = st.blank > 0 ? !ui.onlyBlank : false; emit(); }
      }, h('span', { 'data-t': 'blank' }, `ยังว่าง ${st.blank}`)),
      h('span', { class: 'chip' }, h('span', { 'data-t': 'odd' }, `ไม่ปกติ ${odd}`)),
      h('div', { class: 'tally', style: { marginLeft: 'auto' } },
        h('b', { class: 't-ok', 'data-t': 'ม' }, `มา ${st['ม']}`),
        h('b', { class: 't-late', 'data-t': 'ส' }, `สาย ${st['ส']}`),
        h('b', { class: 't-leave', 'data-t': 'ล' }, `ลา ${st['ล']}`),
        h('b', { class: 't-miss', 'data-t': 'ข' }, `ขาด ${st['ข']}`))
    ),

    h('div', { class: 'att-list' },
      shown.length
        ? shown.map(s => studentRow(s, key))
        : h('div', { class: 'card empty', style: { padding: '26px' } }, 'เช็คครบแล้ว 🎉')),

    h('div', { class: 'done-bar' },
      h('div', { class: 'done-note' },
        'บันทึกอัตโนมัติทุกครั้งที่แตะ · ออฟไลน์ก็เช็คได้ ระบบส่งให้เมื่อมีเน็ต'),
      h('button', {
        class: 'btn btn-solid',
        onclick: () => { ui.mode = 'list'; ui.onlyBlank = false; emit(); }
      }, 'เสร็จสิ้น · บันทึกแล้ว'))
  );
}

function studentRow(s, key) {
  const cur = String(getCell(key, s.sid) || '');
  return h('div', { class: 'stu-row' },
    h('div', { style: { flex: '1', minWidth: '0' } },
      h('div', { class: 'stu-name' }, s.name || '—'),
      h('div', { class: 'stu-sid' }, `เลขที่ ${s.no}${s.sid ? ' · ' + s.sid : ''}`)),
    h('div', { class: 'att-group' },
      ATT_CODES.map(code => h('button', {
        class: 'att-btn', 'data-code': code, 'data-on': cur === code ? '1' : '0',
        title: ATT_NAMES[code], 'aria-label': ATT_NAMES[code],
        onclick: (e) => {
          const now = String(getCell(key, s.sid) || '');
          const next = now === code ? '' : code;
          ensureColumn(colSpecFromKey(key), { quiet: true });
          setCells([{ key, sid: s.sid, value: next }], { quiet: true });
          const group = e.currentTarget.parentElement;
          [...group.children].forEach(b => { b.dataset.on = (b.dataset.code === next) ? '1' : '0'; });
          refreshStats(key);
        }
      }, code))
    )
  );
}

// ── เมนู ⋯ เก็บของที่ไม่ค่อยได้ใช้ ──────────────────────────

function openMenu(available, key) {
  const exists = state.cls.columns.some(c => c.key === key);
  const half = halfOf(ui.date);
  const midSet = /^\d{4}-\d{2}-\d{2}$/.test(String(state.config.mid_date || '').trim());

  modal((close) => h('div', null,
    h('h2', null, fmtDayFull(ui.date)),
    h('div', { style: { display: 'grid', gap: '8px' } },

      h('button', {
        class: 'btn btn-ghost btn-block',
        onclick: () => { close(); addPeriod(available, ui.date); }
      }, '➕ เพิ่มคาบของวันนี้'),

      // บน PC ไม่มีปุ่ม ‹ แบบมือถือ ทางเข้าหน้าประวัติจึงต้องอยู่ในเมนูนี้
      h('button', {
        class: 'btn btn-ghost btn-block',
        onclick: () => { close(); ui.mode = 'list'; emit(); }
      }, '🗓 ประวัติการเช็ค / เลือกวันอื่น'),

      h('div', { style: { fontSize: '12.5px', color: 'var(--ink-2)', marginTop: '6px' } },
        `ช่วงคะแนน: ${half === 1 ? 'ก่อนกลางภาค' : 'หลังกลางภาค'}`,
        midSet ? ' (คำนวณจากวันสอบกลางภาค)' : ' — ยังไม่ได้ตั้งวันสอบกลางภาค'),
      h('div', { class: 'btn-row' },
        h('button', {
          class: 'chip', 'data-on': half === 1 ? '1' : '0', style: { flex: '1' },
          onclick: () => { ui.halfOverride = 1; close(); emit(); }
        }, 'ก่อนกลางภาค'),
        h('button', {
          class: 'chip', 'data-on': half === 2 ? '1' : '0', style: { flex: '1' },
          onclick: () => { ui.halfOverride = 2; close(); emit(); }
        }, 'หลังกลางภาค')),
      !midSet && h('button', {
        class: 'btn btn-soft btn-block btn-sm',
        onclick: () => { close(); go('settings'); }
      }, '⚙️ ไปตั้งวันสอบกลางภาค (ตั้งครั้งเดียวจบ)'),

      exists && h('button', {
        class: 'btn btn-danger btn-block', style: { marginTop: '10px' },
        onclick: async () => {
          close();
          const lbl = available.length > 1 ? `คาบ ${ui.period} ของ${fmtDate(ui.date)}` : fmtDate(ui.date);
          if (!await confirmBox('ลบการเช็คชื่อ?', `ข้อมูลของ ${lbl} จะหายไป`, 'ลบ')) return;
          await deleteColumn(key);
          ui.period = 1; ui.mode = 'list';
          toast('ลบแล้ว', 'ok');
        }
      }, '🗑 ลบการเช็คครั้งนี้')
    )
  ));
}

function addPeriod(used, dateISO) {
  const next = used.length ? Math.max(...used) + 1 : 2;
  const inp = h('input', { type: 'number', min: '1', value: String(next) });
  modal((close) => {
    const ok = h('button', { class: 'btn btn-block' }, 'เพิ่มคาบ');
    ok.onclick = () => {
      const pn = Number(inp.value);
      if (!Number.isInteger(pn) || pn < 1) return toast('เลขคาบต้องเป็นจำนวนเต็มตั้งแต่ 1', 'err');
      if (used.includes(pn)) return toast(`คาบ ${pn} ของวันนี้มีอยู่แล้ว`, 'err');
      ui.pending = { date: dateISO, period: pn };
      close();
      enterCheck(dateISO, pn);
    };
    return h('div', null,
      h('h2', null, 'เพิ่มคาบของ ' + fmtDate(dateISO)),
      h('div', { class: 'field' }, h('label', null, 'คาบที่'), inp,
        h('div', { class: 'hint' },
          used.length ? 'วันนี้เช็คไปแล้ว: คาบ ' + used.join(', ') : 'วันนี้ยังไม่ได้เช็คคาบไหนเลย')),
      h('div', { class: 'hint', style: { marginBottom: '10px' } },
        'ใส่เลขคาบเท่าไหร่ก็ได้ ไม่จำกัด 10 · คาบจะถูกบันทึกเมื่อเริ่มเช็คคนแรก'),
      ok
    );
  });
}

// ── เขียนค่า / รีเฟรช ───────────────────────────────────────

function markAll(key, value) {
  ensureColumn(colSpecFromKey(key), { quiet: true });
  setCells(state.cls.students.map(s => ({ key, sid: s.sid, value })));
  toast('ทำเครื่องหมาย "มา" ทั้งห้อง', 'ok', 1400);
}

function colSpecFromKey(key) {
  const [, half, id] = key.split('|');
  const [d, p] = id.split('-');
  return {
    kind: 'ATT', half: Number(half),
    date: `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`,
    period: Number(p)
  };
}

/**
 * อัปเดตตัวเลขทุกจุดหลังแตะปุ่มหนึ่งครั้ง — ทำเองแทนการวาดหน้าใหม่ทั้งหน้า
 * เพราะรายชื่อ 40 คนวาดใหม่ทุกครั้งแล้วสะดุดตอนกดรัว
 */
function refreshStats(key) {
  const st = attStats(state.cls, key);
  const total = state.cls.students.length;
  const set = (sel, text) => { const el = document.querySelector(sel); if (el) el.textContent = text; };

  for (const [code, name] of Object.entries(ATT_NAMES)) {
    set(`[data-t="${code}"]`, `${name} ${st[code]}`);
  }
  set('[data-t="blank"]', `ยังว่าง ${st.blank}`);
  set('[data-t="odd"]', `ไม่ปกติ ${st['ส'] + st['ล'] + st['ข']}`);
  set('[data-t="done"]', `เช็คแล้ว ${total - st.blank}/${total}`);
  set('.pagehead .ph-badge', `${total - st.blank}/${total}`);

  const side = document.querySelector('.pagehead .ph-side');
  if (side && !ui.onlyBlank) side.textContent = st.blank > 0 ? `ยังว่าง ${st.blank}` : 'ครบแล้ว';
}

__exp(exports, { viewAttendance });

  };

  __defs["js/views/work.js"] = function (exports, __req) {
/* หน้ากรอกงานและคะแนนสอบ (ส่งงาน · สอบเก็บคะแนน · กลางภาค · ปลายภาค) */

const { h, modal, toast, confirmBox, nf } = __req("js/dom.js");
const { state, emit, loadClass, ensureColumn, setCells, getCell, deleteColumn, updateColumn, settings } = __req("js/state.js");
const { BUCKETS, NOT_SUBMITTED, parseWork, formatWork } = __req("js/score.js");

/**
 * ดีไซน์แยก "ชนิดของคะแนน" กับ "ช่วง" ออกจากกัน (หน้า 03)
 * แถวบนเลือกชนิด 4 อย่าง · มุมขวาเลือกช่วง ก่อน/หลังกลางภาค
 * รวมกันได้ 8 ถัง เท่ากับ 8 ช่องของ SGS เหมือนเดิม
 * กลางภาค/ปลายภาคมีช่วงเดียว จึงบังคับช่วงให้เอง
 */
const KINDS = [
  { kind: 'WORK', ic: '📝', label: 'ส่งงาน' },
  { kind: 'QUIZ', ic: '✍️', label: 'สอบเก็บ' },
  { kind: 'MID',  ic: '📄', label: 'กลางภาค', fixed: 1 },
  { kind: 'FIN',  ic: '📕', label: 'ปลายภาค', fixed: 2 }
];

const ui = {
  kind: 'WORK',      // ชนิดคะแนนที่เลือกอยู่
  phase: 1,          // ช่วง 1 = ก่อนกลางภาค · 2 = หลังกลางภาค
  open: null,        // key ของชิ้นงานที่กำลังกรอก (โหมดรายชิ้นงาน)
  by: 'item',        // 'item' = กรอกทีละชิ้นงาน · 'student' = กรอกทีละคน
  si: 0              // ลำดับนักเรียนในโหมดรายคน
};

const kindOf = (k) => KINDS.find(x => x.kind === k) || KINDS[0];
/** ช่วงที่ใช้จริง — ชนิดที่มีช่วงเดียวจะไม่สนใจปุ่มเลือกช่วง */
const curPhase = () => kindOf(ui.kind).fixed || ui.phase;
/** ถังที่เลือกอยู่ (ชนิด × ช่วง) */
const curBucket = () => BUCKETS.find(b => b.kind === ui.kind && b.half === curPhase()) || BUCKETS[0];

/** ให้แถวชนิด/ช่วงตรงกับชิ้นงานที่เปิดอยู่ */
function syncTo(col) {
  ui.kind = col.kind;
  if (!kindOf(col.kind).fixed) ui.phase = col.half;
}

const bucketOf = (id) => BUCKETS.find(b => b.id === id);

/**
 * ข้อสอบ (สอบเก็บคะแนน / กลางภาค / ปลายภาค) ใช้คำต่างจากงานส่ง
 * และไม่มีสถานะ "ส่งช้า" — สอบแล้วก็คือสอบแล้ว
 */
const isExam = (col) => col && col.kind !== 'WORK';

const words = (col) => (isExam(col)
  ? { done: 'สอบแล้ว', miss: 'ยังไม่ได้สอบ', missShort: 'ยังไม่สอบ',
      bulk: 'ให้เต็มทุกคน', bulkToast: 'ให้คะแนนเต็มทั้งห้อง' }
  : { done: 'ตรวจแล้ว', miss: 'ไม่ส่ง', missShort: 'ไม่ส่ง',
      bulk: 'ส่งครบทุกคน', bulkToast: 'ให้ "ส่ง" เต็มทั้งห้อง' });

function columnsIn(bucketId) {
  const b = bucketOf(bucketId);
  return (state.cls?.columns || [])
    .filter(c => c.kind === b.kind && c.half === b.half)
    .sort((a, b2) => String(a.id).localeCompare(String(b2.id)));
}

function viewWork() {
  const cls = state.cls;
  if (!cls) return h('div', { class: 'page empty' }, 'ยังไม่ได้เลือกห้องเรียน');
  if (!cls.students.length) {
    return h('div', { class: 'page' }, h('div', { class: 'card empty' },
      h('div', { class: 'empty-icon' }, '👥'), 'ห้องนี้ยังไม่มีรายชื่อนักเรียน'));
  }
  const col = openCol();
  if (!col) return listScreen();
  return ui.by === 'student' ? studentScreen(col) : gradeScreen(col);
}

/** นักเรียนที่กำลังกรอกอยู่ในโหมดรายคน */
function curStudent() {
  const list = state.cls.students;
  if (ui.si >= list.length) ui.si = 0;
  return list[ui.si];
}

/** ชิ้นงานที่กำลังกรอกอยู่ (ถ้ามี) — ใช้ทั้งแถบหัวและตัวหน้า */
function openCol() {
  if (!ui.open) return null;
  const col = (state.cls.columns || []).find(c => c.key === ui.open);
  if (!col) { ui.open = null; return null; }
  syncTo(col);          // แถวชนิด/ช่วงต้องชี้ตรงกับชิ้นที่เปิดอยู่เสมอ
  return col;
}

/** แถบหัวสีเข้มของหน้านี้ (มือถือ) — ชื่อชิ้นงาน · ความคืบหน้า · สลับชิ้นงาน */
viewWork.head = function () {
  const cls = state.cls;
  if (!cls || !cls.students.length) return null;
  const col = openCol();
  if (!col) return null;

  const b = BUCKETS.find(x => x.kind === col.kind && x.half === col.half);
  const t = tally(col);
  const siblings = (cls.columns || []).filter(c => c.kind === col.kind && c.half === col.half);
  const s = curStudent();
  const byStudent = ui.by === 'student';

  return h('header', { class: 'pagehead' },
    h('div', { class: 'ph-row' },
      h('button', { class: 'ph-back', 'aria-label': 'กลับ', onclick: () => { ui.open = null; emit(); } }, '‹'),
      h('div', { class: 'ph-grow' },
        h('div', { class: 'ph-title' }, byStudent ? (s.name || '—') : col.label),
        h('div', { class: 'ph-sub' }, byStudent
          ? `เลขที่ ${s.no}${s.sid ? ' · ' + s.sid : ''} · ${[cls.meta.grade, cls.meta.room].filter(Boolean).join('/')}`
          : `${b ? b.label : ''} · ${col.half === 1 ? 'ก่อนกลางภาค' : 'หลังกลางภาค'} · เต็ม ${col.max}`)),
      h('div', { class: 'ph-badge', 'data-prog': '1' },
        byStudent ? `${ui.si + 1}/${cls.students.length}` : `${t.done}/${t.total}`)
    ),
    modeSeg('ph-seg'),
    !byStudent && h('button', { class: 'ph-box', onclick: () => openItemPicker(col) },
      h('b', null, col.label),
      h('span', null, `${siblings.length} ชิ้นในถังนี้`),
      h('i', null, '⌄'))
  );
};

/**
 * แถวเลือกชนิดคะแนน + ช่วง (ดีไซน์หน้า 03 แถวบนสุด)
 * @param openFirst true = ย้ายไปกรอกชิ้นแรกของถังใหม่ทันที (ใช้ตอนอยู่ในหน้ากรอก)
 */
function bucketBar(openFirst) {
  const S = settings();
  const fixed = kindOf(ui.kind).fixed;

  const jump = () => {
    if (!openFirst) { emit(); return; }
    const first = columnsIn(curBucket().id)[0];
    ui.open = first ? first.key : null;
    emit();
  };

  // ถังคะแนนมี 4 อันตายตัว จึงวางเป็นตาราง 4 ช่องเท่ากันให้เห็นครบในครั้งเดียว
  // ของเดิมเป็นแถวเลื่อนแนวนอน ซึ่งตัดคำว่า "กลางภาค" ทิ้งไว้ที่ขอบจอ
  // และไม่มีอะไรบอกว่าเลื่อนได้ ครูจึงไม่รู้ว่ามีถังที่ 4 อยู่
  return h('div', { class: 'kind-bar' },
    h('div', { class: 'kind-grid' }, KINDS.map(k => {
      const b = BUCKETS.find(x => x.kind === k.kind && x.half === (k.fixed || ui.phase));
      return h('button', {
        class: 'kind-cell', 'data-on': ui.kind === k.kind ? '1' : '0',
        onclick: () => { ui.kind = k.kind; jump(); }
      },
        h('span', { class: 'kc-ic' }, k.ic),
        h('span', { class: 'kc-label' }, k.label),
        h('span', { class: 'kc-w' }, b ? S.weight[b.id] : 0));
    })),

    // ช่วงมีแค่ 2 ตัวเลือก — ปุ่มคู่อ่านง่ายและกดได้เร็วกว่า select
    // ถังกลางภาค/ปลายภาคผูกช่วงไว้ตายตัวอยู่แล้ว จึงหรี่ลงและกดไม่ได้
    h('div', { class: 'phase-seg', 'data-off': fixed ? '1' : '0' },
      h('span', { class: 'ps-label' }, 'ช่วง'),
      h('div', { class: 'ps-btns', role: 'group', 'aria-label': 'ช่วงคะแนน' },
        [[1, 'ก่อนกลางภาค'], [2, 'หลังกลางภาค']].map(([v, label]) => h('button', {
          'data-on': curPhase() === v ? '1' : '0',
          disabled: !!fixed,
          'aria-pressed': curPhase() === v ? 'true' : 'false',
          onclick: () => { if (fixed) return; ui.phase = v; jump(); }
        }, label))))
  );
}

/** สลับ รายชิ้นงาน ↔ รายคน (ดีไซน์หน้า 03 / 03b) */
function modeSeg(cls) {
  const set = (v) => { ui.by = v; emit(); };
  return h('div', { class: cls },
    h('button', { 'data-on': ui.by === 'item' ? '1' : '0', onclick: () => set('item') }, 'รายชิ้นงาน'),
    h('button', { 'data-on': ui.by === 'student' ? '1' : '0', onclick: () => set('student') }, 'รายคน'));
}

/** แผ่นเลือกชิ้นงาน (มือถือ) — แทนแถวชิปที่ดีไซน์ใช้บน PC */
function openItemPicker(cur) {
  const cols = columnsIn(curBucket().id);
  modal((close) => h('div', null,
    h('h2', null, 'เลือกสิ่งที่จะกรอก'),
    h('div', { class: 'chips', style: { marginBottom: '10px' } },
      KINDS.map(k => h('button', {
        class: 'chip', 'data-on': ui.kind === k.kind ? '1' : '0',
        onclick: () => { ui.kind = k.kind; close(); openItemPicker(cur); }
      }, `${k.ic} ${k.label}`))),
    !kindOf(ui.kind).fixed && h('div', { class: 'chips', style: { marginBottom: '10px' } },
      [[1, 'ก่อนกลางภาค'], [2, 'หลังกลางภาค']].map(([v, l]) => h('button', {
        class: 'chip', 'data-on': curPhase() === v ? '1' : '0',
        onclick: () => { ui.phase = v; close(); openItemPicker(cur); }
      }, l))),
    h('div', { style: { display: 'grid', gap: '8px' } },
      cols.map(c => h('button', {
        class: 'btn btn-ghost btn-block',
        style: c.key === cur.key ? { borderColor: 'var(--accent)', color: 'var(--accent-ink)' } : null,
        onclick: () => { close(); ui.open = c.key; emit(); }
      }, `${c.label} · เต็ม ${c.max}`)),
      h('button', { class: 'btn btn-soft btn-block', onclick: () => { close(); openItemForm(); } }, '+ เพิ่มรายการ'),
      h('div', { class: 'sep' }, 'จัดการชิ้นนี้'),
      h('button', { class: 'btn btn-ghost btn-block', onclick: () => { close(); openItemMenu(cur); } }, '✏️ แก้ไข / รายละเอียด / ลบ'),
      h('button', { class: 'btn btn-ghost btn-block', onclick: () => { close(); openPaste(cur); } }, '📋 วางคะแนนจาก Excel'))
  ));
}

// ── หน้ารายการ ──────────────────────────────────────────────

function listScreen() {
  const S = settings();
  const cols = columnsIn(curBucket().id);
  const b = curBucket();
  const totalMax = cols.reduce((a, c) => a + (c.max || 0), 0);

  return h('div', { class: 'page' },
    bucketBar(false),

    h('div', { class: 'card', style: { display: 'flex', alignItems: 'center', gap: '10px' } },
      h('div', { style: { flex: '1' } },
        h('div', { style: { fontWeight: '700' } }, `${b.label} · ${b.phase === 1 ? 'ก่อนกลางภาค' : 'หลังกลางภาค'}`),
        h('div', { style: { fontSize: '12.5px', color: 'var(--ink-2)' } },
          `${cols.length} รายการ · คะแนนดิบรวม ${totalMax} → เทียบเป็น ${S.weight[curBucket().id]} คะแนน (SGS ${b.sgs})`)),
      h('button', { class: 'btn btn-soft btn-sm', onclick: () => openItemForm() }, '+ เพิ่ม')
    ),

    cols.length === 0
      ? h('div', { class: 'card empty' },
          h('div', { class: 'empty-icon' }, '📝'),
          h('div', null, `ยังไม่มีรายการใน "${b.label}"`),
          h('div', { style: { fontSize: '13px', marginBottom: '12px' } },
            'เพิ่มกี่ชิ้นก็ได้ คะแนนเต็มเท่าไหร่ก็ได้ ระบบเทียบสัดส่วนให้อัตโนมัติ'),
          h('button', { class: 'btn', onclick: () => openItemForm() }, 'เพิ่มรายการแรก'))
      : h('div', { class: 'card card-tight' }, cols.map(itemRow))
  );
}

function tally(col) {
  const vals = state.cls.values[col.key] || {};
  const t = { ok: 0, late: 0, miss: 0, none: 0, total: state.cls.students.length };
  for (const s of state.cls.students) t[parseWork(vals[s.sid]).status]++;
  // งานส่ง: "ตรวจแล้ว" = ดูครบทุกคนแล้ว (รวมคนไม่ส่ง)
  // ข้อสอบ: "สอบแล้ว" = คนที่เข้าสอบจริง ไม่รวมคนที่ยังไม่ได้สอบ
  t.done = isExam(col) ? t.ok : t.total - t.none;
  return t;
}

function itemRow(col) {
  const t = tally(col);
  return h('div', { class: 'list-row' },
    h('button', {
      style: { display: 'flex', alignItems: 'center', gap: '10px', flex: '1', minWidth: '0', textAlign: 'left' },
      onclick: () => { ui.open = col.key; emit(); }
    },
      h('div', { class: 'list-main' },
        h('div', { class: 'list-title' }, col.label),
        col.desc && h('div', {
          class: 'list-sub',
          style: { color: 'var(--ink-3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }
        }, col.desc),
        h('div', { class: 'list-sub' },
          `เต็ม ${col.max} · ${words(col).done} ${t.done}/${t.total}`,
          t.late > 0 ? ` · ส่งช้า ${t.late}` : '',
          t.miss > 0 ? ` · ${words(col).miss} ${t.miss}` : '')),
      t.none === 0
        ? h('span', { class: 'badge g' }, 'ครบ')
        : h('span', { class: 'badge a' }, `ค้าง ${t.none}`)
    ),
    h('button', {
      class: 'icon-btn', style: { color: 'var(--ink-3)' }, title: 'แก้ไข / ลบ',
      onclick: () => openItemMenu(col)
    }, '⋯')
  );
}

// ── หน้ากรอกคะแนน ───────────────────────────────────────────

/** คะแนนที่ได้เมื่อกดปุ่ม "ส่งช้า" (หักตาม % ในหน้าตั้งค่า) */
function lateScore(col) {
  const pct = settings().latePenaltyPct || 0;
  return Math.max(0, Math.round(col.max * (1 - pct / 100) * 100) / 100);
}

const statusBtnsOf = (col) => (isExam(col)
  ? [{ st: 'ok',   label: 'สอบแล้ว',  cls: 'ok',   title: 'สอบแล้ว — กรอกคะแนนที่ได้ในช่องขวา' },
     { st: 'miss', label: 'ยังไม่สอบ', cls: 'miss', title: 'ยังไม่ได้สอบ / ขาดสอบ — คิดเป็น 0 คะแนน' }]
  : [{ st: 'ok',   label: 'ส่ง',    cls: 'ok' },
     { st: 'late', label: 'ช้า',    cls: 'late' },
     { st: 'miss', label: 'ไม่ส่ง', cls: 'miss' }]);

/**
 * แถวกรอกหนึ่งช่อง (นักเรียน 1 คน × ชิ้นงาน 1 ชิ้น)
 * ใช้ร่วมกันทั้งโหมดรายชิ้นงานและรายคน — เขียนค่าแล้วอัปเดตเฉพาะแถวนี้
 * (วาดใหม่ทั้งหน้าแล้วเคอร์เซอร์หลุด และสะดุดตอนกดรัว)
 *
 * @param head โหนดฝั่งซ้ายของแถว ต่างกันตามโหมด (เลขที่+ชื่อ หรือ ชื่องาน+กำหนดส่ง)
 * @param nextInput ฟังก์ชันหาช่องถัดไปตอนกด Enter
 */
function scoreRow(col, s, { head, nextInput } = {}) {
  const W = words(col);
  const cur = parseWork(getCell(col.key, s.sid));

  const inp = h('input', {
    class: 'score-inp' + (cur.status === 'miss' ? ' miss' : (cur.status !== 'none' ? ' filled' : '')),
    type: 'number', inputmode: 'decimal', min: '0', max: String(col.max), step: 'any',
    value: (cur.status === 'ok' || cur.status === 'late') ? String(cur.score) : '',
    placeholder: cur.status === 'miss' ? W.missShort : '',
    onkeydown: (e) => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      const n = nextInput && nextInput();
      if (n) { n.focus(); n.select(); }
    },
    onchange: (e) => {
      let v = e.target.value.trim();
      if (v === '') return apply('none');
      let n = Number(v);
      if (isNaN(n)) { e.target.value = ''; return apply('none'); }
      if (n > col.max) { toast(`เกินคะแนนเต็ม (${col.max})`, 'err'); n = col.max; }
      if (n < 0) n = 0;
      e.target.value = String(n);
      // พิมพ์คะแนนเองแล้วยังคงสถานะ "ส่งช้า" ไว้ถ้าเคยตั้งไว้
      apply(read() === 'late' ? 'late' : 'ok', n);
    }
  });

  const btns = statusBtnsOf(col).map(b => h('button', {
    class: 'st-btn ' + b.cls, 'data-st': b.st, 'data-on': cur.status === b.st ? '1' : '0',
    title: b.title || (b.st === 'late' ? `ส่งช้า (ได้ ${lateScore(col)}/${col.max})` : b.label),
    onclick: () => apply(read() === b.st ? 'none' : b.st)
  }, b.label));

  const group = h('div', { class: 'st-group' }, btns);
  const read = () => (btns.find(b => b.dataset.on === '1') || {}).dataset?.st || 'none';

  function apply(status, score) {
    let sc = score;
    if (status === 'ok'   && sc === undefined) sc = col.max;
    if (status === 'late' && sc === undefined) sc = lateScore(col);
    setCells([{ key: col.key, sid: s.sid, value: formatWork(status, sc) }], { quiet: true });

    btns.forEach(b => { b.dataset.on = (b.dataset.st === status) ? '1' : '0'; });
    inp.value = (status === 'ok' || status === 'late') ? String(sc) : '';
    inp.placeholder = status === 'miss' ? W.missShort : '';
    inp.classList.toggle('miss', status === 'miss');
    inp.classList.toggle('filled', status === 'ok' || status === 'late');
    refreshProgress(col);
  }

  // ฝั่งซ้าย+คะแนนบรรทัดบน · ปุ่มสถานะเต็มความกว้างบรรทัดล่าง
  // (แบบเดิมยัดทุกอย่างบรรทัดเดียว ชื่อนักเรียนเลยถูกบีบจนอ่านไม่ออกบนมือถือ)
  const row = h('div', { class: 'work-row' },
    h('div', { class: 'work-head' },
      head || null,
      h('div', { class: 'score-cell' }, inp, h('span', { class: 'score-max' }, '/' + col.max))),
    group
  );
  row.__input = inp;
  return row;
}

function gradeScreen(col) {
  const students = state.cls.students;
  const rows = [];
  students.forEach((s, i) => {
    rows.push(scoreRow(col, s, {
      head: [h('div', { class: 'stu-no' }, s.no), h('div', { class: 'work-name' }, s.name || '—')],
      nextInput: () => rows[i + 1] && rows[i + 1].__input
    }));
  });

  const W = words(col);
  const b = curBucket();
  const siblings = columnsIn(curBucket().id);

  return h('div', { class: 'page' },

    // ── ถัง (PC) — ดีไซน์วางไว้แถวบนสุด ──
    h('div', { class: 'pc-only-block' }, bucketBar(true)),

    // ── ชิ้นงานในถังนี้ (PC) ──
    h('div', { class: 'item-bar' },
      siblings.map(c => h('button', {
        class: 'item-pill', 'data-on': c.key === col.key ? '1' : '0',
        onclick: () => { ui.open = c.key; emit(); }
      }, `${c.label} · เต็ม ${c.max}`)),
      h('button', { class: 'item-pill add', onclick: () => openItemForm() }, '+ เพิ่มงาน'),
      h('div', { style: { marginLeft: 'auto', display: 'flex', gap: '8px' } },
        h('button', { class: 'btn btn-ghost btn-sm', onclick: () => openPaste(col) }, '📋 วางจาก Excel'),
        h('button', { class: 'icon-btn', title: 'ตัวเลือกเพิ่มเติม', onclick: () => openItemMenu(col) }, '⋯'))
    ),

    // ── หัวเรื่องชิ้นงาน + ความคืบหน้า (PC · มือถืออยู่ในแถบเข้มแล้ว) ──
    h('div', { class: 'ctxbar' },
      h('div', { style: { flex: '1', minWidth: '0' } },
        h('div', { class: 'ctx-title' }, col.label),
        h('div', { class: 'ctx-sub', id: 'grade-progress' }, progressText(col)),
        h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '8px' } },
          h('button', { class: 'tagbtn', onclick: () => openItemForm(col) },
            isExam(col) ? '✎ รายละเอียดการสอบ' : '✎ รายละเอียดงาน'),
          col.desc
            ? h('span', { class: 'tag-on' }, '👁 นักเรียนเห็น')
            : h('span', { class: 'tag-off' }, '👁 ยังไม่มีคำสั่งให้นักเรียนอ่าน')),
        col.desc && h('div', {
          style: { fontSize: '12.5px', color: 'var(--ink-2)', marginTop: '5px', whiteSpace: 'pre-wrap' }
        }, col.desc)),
      modeSeg('seg seg-inline'),
      h('div', { style: { textAlign: 'right', flex: 'none' } },
        h('div', { style: { fontSize: '12.5px', color: 'var(--ink-2)' } }, W.done),
        h('div', { class: 'tnum', id: 'grade-count', style: { fontSize: '19px', fontWeight: '700' } },
          `${tally(col).done} / ${tally(col).total}`)),
      h('div', { style: { width: '180px', flex: 'none' } }, progressBar(col))
    ),

    // ── ปุ่มลัดทั้งห้อง (มือถือ — บน PC อยู่ในเมนู ⋯ ของแถบชิ้นงาน) ──
    h('div', { class: 'card pc-hide', style: { padding: '10px 12px' } },
      h('div', { class: 'btn-row' },
        h('button', {
          class: 'btn btn-soft btn-sm',
          onclick: () => {
            setCells(state.cls.students.map(s => ({ key: col.key, sid: s.sid, value: col.max })));
            toast(W.bulkToast, 'ok', 1400);
          }
        }, `✓ ${W.bulk} (${col.max})`),
        h('button', {
          class: 'btn btn-ghost btn-sm',
          onclick: async () => {
            if (!await confirmBox('ล้างคะแนน?', 'คะแนนของรายการนี้จะถูกลบทั้งห้อง', 'ล้าง')) return;
            setCells(state.cls.students.map(s => ({ key: col.key, sid: s.sid, value: '' })));
          }
        }, '↺ ล้าง')
      )),

    // ── รายชื่อ: มือถือ = การ์ดใบละคน · PC = ตาราง 4 คอลัมน์ ──
    h('div', { class: 'work-list' },
      h('div', { class: 'work-thead' },
        h('div', null, 'เลขที่'), h('div', null, 'ชื่อ-นามสกุล'),
        h('div', null, isExam(col) ? 'สถานะการสอบ' : 'สถานะการส่ง'), h('div', null, 'คะแนน')),
      rows)
  );
}

/**
 * โหมดกรอกทีละคน (ดีไซน์หน้า 03b)
 * เห็นทุกชิ้นในถังของนักเรียนคนเดียว — ใช้ตอนตามเก็บงานค้างรายคน
 */
function studentScreen(col) {
  const cls = state.cls;
  const s = curStudent();
  const cols = columnsIn(curBucket().id);
  const b = curBucket();
  const S = settings();

  // สรุปของถังนี้เฉพาะคนนี้
  let got = 0, max = 0, graded = 0;
  for (const c of cols) {
    const w = parseWork(getCell(c.key, s.sid));
    if (w.status === 'none') { if (S.ungraded === 'zero') max += c.max; continue; }
    graded++; max += c.max;
    if (w.status !== 'miss') got += w.score;
  }
  const bucketScore = max > 0 ? Math.round((S.weight[curBucket().id] * got / max) * 100) / 100 : null;

  const rows = [];
  cols.forEach((c, i) => {
    rows.push(scoreRow(c, s, {
      head: h('div', { style: { flex: '1', minWidth: '0' } },
        h('div', { class: 'work-name', style: { fontSize: '14.5px' } }, c.label),
        h('div', { class: 'stu-sid' }, `เต็ม ${c.max}${c.desc ? ' · ' + c.desc : ''}`)),
      nextInput: () => rows[i + 1] && rows[i + 1].__input
    }));
  });

  const step = (d) => { ui.si = Math.min(cls.students.length - 1, Math.max(0, ui.si + d)); emit(); };

  return h('div', { class: 'page' },

    h('div', { class: 'pc-only-block' }, bucketBar(true)),

    h('div', { class: 'ctxbar' },
      h('div', { style: { flex: '1', minWidth: '0' } },
        h('div', { class: 'ctx-title' }, s.name || '—'),
        h('div', { class: 'ctx-sub' }, `เลขที่ ${s.no}${s.sid ? ' · ' + s.sid : ''} · คนที่ ${ui.si + 1} จาก ${cls.students.length}`)),
      modeSeg('seg seg-inline'),
      h('div', { class: 'ctx-end' },
        h('button', { class: 'btn btn-ghost btn-sm', disabled: ui.si === 0, onclick: () => step(-1) }, '‹'),
        h('button', { class: 'btn btn-ghost btn-sm', disabled: ui.si >= cls.students.length - 1, onclick: () => step(1) }, '›'))),

    // เลือกห้อง แล้วเลือกคน — เลื่อนหาเร็วกว่าพิมพ์ชื่อ โดยเฉพาะบนมือถือ
    h('div', { class: 'pick2row' },
      h('label', { class: 'pickbox' },
        h('span', null, 'ห้อง'),
        h('select', {
          'aria-label': 'เลือกห้องเรียน',
          onchange: async (e) => {
            ui.si = 0;
            await loadClass(e.target.value);
            // คอลัมน์ของห้องเดิมใช้กับห้องใหม่ไม่ได้ ต้องชี้ไปชิ้นแรกของถังเดิมในห้องใหม่
            const first = columnsIn(curBucket().id)[0];
            ui.open = first ? first.key : null;
            emit();
          }
        }, state.classes.map(c => h('option', {
          value: c.classId, selected: c.classId === state.classId
        }, `${[c.grade, c.room].filter(Boolean).join('/')} · ${c.subject}`)))),

      h('label', { class: 'pickbox grow' },
        h('span', null, 'นักเรียน'),
        h('select', {
          'aria-label': 'เลือกนักเรียน',
          onchange: (e) => { ui.si = Number(e.target.value); emit(); }
        }, cls.students.map((x, i) => h('option', {
          value: String(i), selected: i === ui.si
        }, `${x.no}. ${x.name || '—'}`))))
    ),

    // สรุปคะแนนถังนี้ของคนนี้
    h('div', { class: 'card', style: { display: 'flex', alignItems: 'center', gap: '10px' } },
      h('div', { style: { flex: '1' } },
        h('div', { style: { fontSize: '13px', color: 'var(--ink-2)' } },
          `${b.label} · ${b.phase === 1 ? 'ก่อนกลางภาค' : 'หลังกลางภาค'}`),
        h('div', { style: { fontSize: '12px', color: 'var(--ink-3)', marginTop: '1px' } },
          `${words(col).done} ${graded} จาก ${cols.length} ชิ้น`)),
      h('div', { style: { textAlign: 'right' } },
        h('div', { class: 'tnum', style: { fontSize: '19px', fontWeight: '700' } },
          bucketScore === null ? '—' : nf(bucketScore)),
        h('div', { style: { fontSize: '11.5px', color: 'var(--ink-2)' } }, '/' + S.weight[curBucket().id]))),

    h('div', { class: 'work-list by-student' }, rows),

    h('div', { class: 'pager' },
      h('button', { class: 'btn btn-ghost', disabled: ui.si === 0, onclick: () => step(-1) }, '‹'),
      h('button', {
        class: 'btn',
        disabled: ui.si >= cls.students.length - 1,
        onclick: () => step(1)
      }, ui.si < cls.students.length - 1
        ? `คนถัดไป · ${cls.students[ui.si + 1].name || ''} ›`
        : 'คนสุดท้ายแล้ว'))
  );
}

/** แถบสัดส่วน ส่ง/ช้า/ไม่ส่ง — ที่เหลือคือยังไม่ตรวจ (พื้นหลังราง) */
function progressBar(col) {
  const t = tally(col);
  const pct = (n) => (t.total ? (n / t.total) * 100 : 0) + '%';
  const W = words(col);
  return h('div', null,
    h('div', { class: 'prog-track' },
      t.ok   > 0 && h('i', { class: 'prog-seg', style: { width: pct(t.ok),   background: 'var(--st-ok)' } }),
      t.late > 0 && h('i', { class: 'prog-seg', style: { width: pct(t.late), background: 'var(--st-late)' } }),
      t.miss > 0 && h('i', { class: 'prog-seg', style: { width: pct(t.miss), background: 'var(--st-miss)' } })),
    h('div', { class: 'prog-note' },
      [`${isExam(col) ? 'สอบ' : 'ส่ง'} ${t.ok}`,
       t.late ? `ช้า ${t.late}` : null,
       `${W.miss} ${t.miss}`,
       `ยังไม่ตรวจ ${t.none}`].filter(Boolean).join(' · '))
  );
}

function progressText(col) {
  const t = tally(col);
  const vals = state.cls.values[col.key] || {};
  const exam = isExam(col);
  const scored = [];
  for (const s of state.cls.students) {
    const w = parseWork(vals[s.sid]);
    // เฉลี่ยต้องคิดจากคนกลุ่มเดียวกับตัวเลขที่โชว์ข้าง ๆ
    // ข้อสอบ = เฉพาะคนที่เข้าสอบ · งานส่ง = ทุกคนที่ตรวจแล้ว (คนไม่ส่งนับเป็น 0)
    if (exam ? w.status === 'ok' || w.status === 'late' : w.status !== 'none') scored.push(w.score);
  }
  const avg = scored.length ? scored.reduce((a, b) => a + b, 0) / scored.length : 0;
  const W = words(col);
  return `เต็ม ${col.max} · ${W.done} ${t.done}/${t.total}`
    + (t.late ? ` · ช้า ${t.late}` : '')
    + (t.miss ? ` · ${W.miss} ${t.miss}` : '')
    + (scored.length ? ` · เฉลี่ย ${nf(avg, 1)}` : '');
}

/** อัปเดตตัวเลขทุกจุดหลังกดหนึ่งครั้ง แทนการวาดรายชื่อทั้งห้องใหม่ */
function refreshProgress(col) {
  const t = tally(col);
  const el = document.getElementById('grade-progress');
  if (el) el.textContent = progressText(col);

  const cnt = document.getElementById('grade-count');
  if (cnt) cnt.textContent = `${t.done} / ${t.total}`;

  const badge = document.querySelector('.pagehead .ph-badge[data-prog]');
  if (badge) badge.textContent = `${t.done}/${t.total}`;

  const bar = document.querySelector('.ctxbar .prog-track');
  if (bar && bar.parentElement) bar.parentElement.replaceWith(progressBar(col));
}

// ── เพิ่ม / แก้ไขรายการ ─────────────────────────────────────

function openItemForm(edit) {
  const b = curBucket();
  const exam = b.kind !== 'WORK';
  const label = h('input', {
    value: edit?.label || '',
    placeholder: exam ? 'เช่น สอบเก็บคะแนนบทที่ 1' : 'เช่น ใบงานที่ 1 เรื่องเศษส่วน'
  });
  const desc  = h('textarea', {
    rows: 3, value: edit?.desc || '',
    placeholder: exam
      ? 'เช่น สอบบทที่ 1–2 · ปรนัย 20 ข้อ · สอบวันศุกร์ที่ 15 คาบ 3'
      : 'เช่น ทำข้อ 1–10 หน้า 42 ส่งท้ายคาบวันศุกร์ · เขียนมือเท่านั้น'
  });
  const max   = h('input', { type: 'number', min: '1', value: String(edit?.max ?? (b.kind === 'MID' ? 20 : b.kind === 'FIN' ? 30 : 10)) });

  modal((close) => {
    const save = h('button', { class: 'btn btn-block' }, edit ? 'บันทึก' : 'เพิ่มรายการ');
    save.onclick = async () => {
      const l = label.value.trim(), m = Number(max.value), d = desc.value.trim();
      if (!l) return toast('ตั้งชื่อรายการก่อน', 'err');
      if (!(m > 0)) return toast('คะแนนเต็มต้องมากกว่า 0', 'err');
      try {
        if (edit) await updateColumn(edit.key, { label: l, max: m, desc: d });
        else {
          const { key } = ensureColumn({ kind: b.kind, half: b.half, label: l, max: m, desc: d });
          ui.open = key;
        }
        close(); emit();
      } catch (e) { toast(e.message, 'err'); }
    };
    return h('div', null,
      h('h2', null, edit ? 'แก้ไขรายการ' : `เพิ่ม${b.label} · ${b.phase === 1 ? 'ก่อนกลางภาค' : 'หลังกลางภาค'}`),
      h('div', { class: 'field' }, h('label', null, 'ชื่อรายการ *'), label),
      h('div', { class: 'field' }, h('label', null, exam ? 'รายละเอียดการสอบ' : 'รายละเอียดงาน'), desc,
        h('div', { class: 'hint' }, 'เก็บเป็นโน้ตบนหัวคอลัมน์ในชีต เอาเมาส์ชี้ก็เห็น')),
      h('div', { class: 'field' }, h('label', null, 'คะแนนเต็ม (คะแนนดิบ)'), max,
        h('div', { class: 'hint' },
          `ใส่คะแนนเต็มจริงได้เลย ระบบจะเทียบสัดส่วนเป็น ${settings().weight[curBucket().id]} คะแนนของ SGS ให้เอง`)),
      save
    );
  });
}

function openItemMenu(col) {
  const t = tally(col);
  modal((close) => h('div', null,
    h('h2', null, col.label),
    h('div', { class: 'hint', style: { marginBottom: '12px' } },
      `เต็ม ${col.max} · ${words(col).done} ${t.done}/${t.total}`),
    h('div', { style: { display: 'grid', gap: '8px' } },
      h('button', { class: 'btn btn-ghost btn-block', onclick: () => { close(); ui.open = col.key; emit(); } }, '📝 กรอกคะแนน'),
      h('button', { class: 'btn btn-ghost btn-block', onclick: () => { close(); openItemForm(col); } }, '✏️ แก้ไขชื่อ / รายละเอียด / คะแนนเต็ม'),
      h('button', {
        class: 'btn btn-ghost btn-block',
        onclick: () => {
          close();
          setCells(state.cls.students.map(s => ({ key: col.key, sid: s.sid, value: col.max })));
          toast(words(col).bulkToast, 'ok', 1400);
        }
      }, `✓ ${words(col).bulk} (${col.max})`),
      h('button', {
        class: 'btn btn-ghost btn-block',
        onclick: async () => {
          close();
          if (!await confirmBox('ล้างคะแนน?', 'คะแนนของรายการนี้จะถูกลบทั้งห้อง', 'ล้าง')) return;
          setCells(state.cls.students.map(s => ({ key: col.key, sid: s.sid, value: '' })));
        }
      }, '↺ ล้างคะแนนทั้งรายการ'),
      h('button', {
        class: 'btn btn-danger btn-block',
        onclick: async () => {
          close();
          if (!await confirmBox('ลบรายการนี้?', `“${col.label}” และคะแนนทั้งหมดจะถูกลบ`, 'ลบ')) return;
          ui.open = null;
          await deleteColumn(col.key);
          toast('ลบแล้ว', 'ok');
        }
      }, '🗑 ลบรายการ')
    )
  ));
}

/** วางคะแนนทั้งคอลัมน์จาก Excel — เรียงตามลำดับเลขที่ในรายชื่อ */
function openPaste(col) {
  const exam = isExam(col);
  const ta = h('textarea', {
    rows: 10, placeholder: exam ? '18\n20\nx\n15.5\n…' : '8\n10\nx\nL7\n7.5\n…',
    style: { fontFamily: 'ui-monospace, monospace' }
  });
  modal((close) => {
    const save = h('button', { class: 'btn btn-block' }, 'นำเข้าคะแนน');
    save.onclick = () => {
      const lines = ta.value.split(/\r?\n/).map(s => s.trim());
      const cells = [];
      state.cls.students.forEach((s, i) => {
        if (i >= lines.length) return;
        const raw = lines[i];
        if (raw === '' || raw === '-') { cells.push({ key: col.key, sid: s.sid, value: '' }); return; }
        if (/^x$|^ไม่ส่ง$|^ขาดสอบ$|^ไม่ได้สอบ$/i.test(raw)) { cells.push({ key: col.key, sid: s.sid, value: NOT_SUBMITTED }); return; }
        const late = /^(l|ช้า)/i.test(raw);
        const n = Number(raw.replace(/^(l|ช้า)\s*/i, ''));
        if (isNaN(n)) return;
        const clamped = Math.max(0, Math.min(col.max, n));
        cells.push({ key: col.key, sid: s.sid, value: formatWork(late ? 'late' : 'ok', clamped) });
      });
      setCells(cells);
      toast(`นำเข้า ${cells.length} รายการ`, 'ok');
      close();
    };
    return h('div', null,
      h('h2', null, 'วางคะแนนจาก Excel'),
      h('div', { class: 'hint', style: { marginBottom: '8px' } },
        `เรียงตามลำดับเลขที่ในรายชื่อ (${state.cls.students.length} คน)`,
        h('br'),
        exam
          ? ['ตัวเลข = คะแนนที่สอบได้ · ', h('code', null, 'x'), ' = ยังไม่ได้สอบ · เว้นว่าง = ยังไม่กรอก']
          : ['ตัวเลข = ส่ง · ', h('code', null, 'L7'), ' = ส่งช้าได้ 7 · ',
             h('code', null, 'x'), ' = ไม่ส่ง · เว้นว่าง = ยังไม่ตรวจ']),
      ta, h('div', { style: { height: '10px' } }), save
    );
  });
}

__exp(exports, { viewWork });

  };

  __defs["js/views/summary.js"] = function (exports, __req) {
/* หน้าสรุปคะแนน — ตารางตรงกับหน้ากรอกของ SGS */

const { h, modal, toast, nf } = __req("js/dom.js");
const { state, emit, settings, recalcOnServer } = __req("js/state.js");
const { computeClass, BUCKETS, bucketColumns, parseWork } = __req("js/score.js");

const ui = { phase: 0, fill: false, fi: 0 };   // phase 0 = ทั้งหมด · fill = โหมดกรอกทีละคน

const SGS_COLS = [
  { id: 'work1', head: '1',        sub: 'งาน1',   phase: 1, cls: 'h4' },
  { id: 'quiz1', head: '2',        sub: 'สอบ1',   phase: 1, cls: 'h4' },
  { id: 'att1',  head: '3',        sub: 'เรียน1', phase: 1, cls: 'h4' },
  { id: 'mid',   head: 'กลาง',     sub: '',       phase: 1, cls: 'h1' },
  { id: 'work2', head: '10',       sub: 'งาน2',   phase: 2, cls: 'h4' },
  { id: 'quiz2', head: '11',       sub: 'สอบ2',   phase: 2, cls: 'h4' },
  { id: 'att2',  head: '12',       sub: 'เรียน2', phase: 2, cls: 'h4' },
  { id: 'fin',   head: 'ปลาย',     sub: '',       phase: 2, cls: 'h1' }
];

/** ชื่อเต็มของแต่ละช่อง ใช้ในโหมดกรอกทีละคน (ดีไซน์หน้า 05 มือถือ) */
const FULL_LABEL = {
  work1: 'ส่งงาน ก่อนกลางภาค',  quiz1: 'สอบเก็บ ก่อนกลางภาค',  att1: 'เข้าเรียน ก่อนกลางภาค',
  mid:   'สอบกลางภาค',
  work2: 'ส่งงาน หลังกลางภาค',  quiz2: 'สอบเก็บ หลังกลางภาค',  att2: 'เข้าเรียน หลังกลางภาค',
  fin:   'สอบปลายภาค'
};

/**
 * จำนวนงานที่ยังไม่ตรวจ แยกรายคน-รายช่อง
 * ใช้ติด "จุดส้ม" บอกว่าตัวเลขในช่องนั้นยังเปลี่ยนได้ (ตามดีไซน์)
 */
function pendingMap(cls) {
  const byBucket = bucketColumns(cls);
  const V = cls.values || {};
  const out = {};
  for (const st of (cls.students || [])) {
    const m = {};
    for (const b of BUCKETS) {
      if (b.kind === 'ATT') continue;
      let n = 0;
      for (const c of byBucket[b.id]) {
        if (parseWork((V[c.key] || {})[st.sid]).status === 'none') n++;
      }
      m[b.id] = n;
    }
    out[st.sid] = m;
  }
  return out;
}

function viewSummary() {
  const cls = state.cls;
  if (!cls) return h('div', { class: 'page empty' }, 'ยังไม่ได้เลือกห้องเรียน');
  if (!cls.students.length) {
    return h('div', { class: 'page' }, h('div', { class: 'card empty' },
      h('div', { class: 'empty-icon' }, '👥'), 'ห้องนี้ยังไม่มีรายชื่อนักเรียน'));
  }

  const S = settings();
  const rows = computeClass(cls, S);
  const cols = SGS_COLS.filter(c => ui.phase === 0 || c.phase === ui.phase);
  const issues = checkIssues(rows, S);
  const pend = pendingMap(cls);
  const pendTotal = rows.reduce((a, r) => a + r.pending, 0);

  if (ui.fill) return fillScreen(rows, S, pend);

  return h('div', { class: 'page page-wide' },

    h('div', { class: 'chips' },
      [[0, 'ทั้งปี'], [1, 'ก่อนกลางภาค'], [2, 'หลังกลางภาค']].map(([v, l]) =>
        h('button', { class: 'chip', 'data-on': ui.phase === v ? '1' : '0', onclick: () => { ui.phase = v; emit(); } }, l))
    ),

    // ── แถบพร้อมกรอก + ปุ่มหลัก (ดีไซน์หน้า 05) ──
    h('div', { class: 'card', style: { display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' } },
      h('div', { style: { flex: '1', minWidth: '180px' } },
        h('div', { style: { fontSize: '15px', fontWeight: '700' } }, `พร้อมกรอกลง SGS · ${rows.length} คน`),
        h('div', { style: { fontSize: '12.5px', color: 'var(--ink-2)', marginTop: '2px' } },
          pendTotal > 0
            ? `ยังไม่ตรวจ ${pendTotal} รายการ — ช่องที่กระทบจะมีจุดส้มกำกับ`
            : 'ตรวจครบทุกรายการแล้ว')),
      h('button', { class: 'btn btn-ghost btn-sm', onclick: () => { ui.fill = true; ui.fi = 0; emit(); } }, '⌨️ โหมดกรอกทีละคน'),
      h('button', {
        class: 'btn btn-sm',
        onclick: async (e) => {
          const b = e.currentTarget; b.disabled = true; b.textContent = 'กำลังบันทึก…';
          try { await recalcOnServer(); toast('เขียนลงชีตแล้ว ✅', 'ok'); }
          catch (err) { toast(err.message, 'err', 5000); }
          finally { b.disabled = false; b.textContent = '💾 บันทึกลงชีต'; }
        }
      }, '💾 บันทึกลงชีต')
    ),

    issues.length > 0 && h('div', { class: 'card', style: { background: 'var(--amber-soft)', border: '1px solid color-mix(in srgb, var(--st-late) 32%, transparent)' } },
      h('div', { style: { fontWeight: '700', marginBottom: '6px' } }, '⚠️ ตรวจก่อนกรอก SGS'),
      h('ul', { style: { margin: 0, paddingLeft: '20px', fontSize: '13px', color: 'var(--warn-ink)' } },
        issues.map(t => h('li', null, t)))),

    h('div', { class: 'card card-tight' },
      h('div', { class: 'tablewrap' }, table(rows, cols, S, pend))),

    h('div', { class: 'sgs-note' },
      h('span', { class: 'dot-pend' }, '•'),
      h('span', null, '= ช่องนี้ยังมีงานค้างตรวจ ตัวเลขอาจเปลี่ยน · แตะหัวคอลัมน์เพื่อคัดลอกทั้งช่องไปวางใน SGS')),

    h('div', { class: 'btn-row', style: { marginTop: '10px' } },
      h('button', { class: 'btn btn-ghost btn-sm', onclick: () => copyTable(rows, cols) }, '📋 คัดลอกทั้งตาราง'),
      h('button', { class: 'btn btn-ghost btn-sm', onclick: () => downloadCSV(rows) }, '⬇️ CSV'))
  );
}

/** แถบหัวสีเข้ม — มีเฉพาะตอนอยู่ในโหมดกรอกทีละคน (ดีไซน์ 05 มือถือ) */
viewSummary.head = function () {
  const cls = state.cls;
  if (!cls || !cls.students.length || !ui.fill) return null;
  const rows = computeClass(cls, settings());
  if (ui.fi >= rows.length) ui.fi = 0;

  return h('header', { class: 'pagehead' },
    h('div', { class: 'ph-row' },
      h('div', { class: 'ph-grow' },
        h('div', { class: 'ph-title' }, 'โหมดกรอก SGS'),
        h('div', { class: 'ph-sub' },
          `${[cls.meta.grade, cls.meta.room].filter(Boolean).join('/')} · คนที่ ${ui.fi + 1} จาก ${rows.length}`)),
      h('button', { class: 'ph-badge', onclick: () => { ui.fill = false; emit(); } }, 'ออก')
    )
  );
};

/** โหมดกรอกทีละคน — อ่านคะแนน 8 ช่องเรียงตามลำดับที่ SGS ให้กรอก */
function fillScreen(rows, S, pend) {
  if (!rows.length) { ui.fill = false; return h('div', { class: 'page empty' }, 'ไม่มีนักเรียน'); }
  if (ui.fi >= rows.length) ui.fi = 0;
  const r = rows[ui.fi];
  const step = (d) => { ui.fi = Math.min(rows.length - 1, Math.max(0, ui.fi + d)); emit(); };

  return h('div', { class: 'page' },
    h('div', { class: 'ctxbar' },
      h('div', { style: { flex: '1' } },
        h('div', { class: 'ctx-title' }, 'โหมดกรอก SGS'),
        h('div', { class: 'ctx-sub' }, `คนที่ ${ui.fi + 1} จาก ${rows.length}`)),
      h('button', { class: 'btn btn-ghost btn-sm', onclick: () => { ui.fill = false; emit(); } }, 'ออกจากโหมดนี้')),

    h('div', { class: 'fill-card' },
      h('div', { class: 'fill-sid' }, `เลขที่ ${r.no}${r.sid ? ' · เลขประจำตัว ' + r.sid : ''}`),
      h('div', { class: 'fill-name' }, r.name || '—'),

      SGS_COLS.map(c => {
        const exam = c.id === 'mid' || c.id === 'fin';
        const p = (pend[r.sid] || {})[c.id] || 0;
        return h('div', { class: 'sgs-row' + (exam ? ' exam' : '') },
          h('span', { class: 'sgs-no' }, exam ? (c.id === 'mid' ? 'กล' : 'ปล') : c.head),
          h('span', { class: 'sgs-lbl' }, FULL_LABEL[c.id]),
          h('b', { class: 'sgs-val' }, cellText(r, c.id), p > 0 && h('span', { class: 'dot-pend' }, '•')));
      }),

      h('div', { class: 'fill-total' },
        h('span', null, 'รวม · เกรด'),
        h('b', { style: { color: r.grade === 'มส' || r.grade === '0' ? 'var(--st-miss)' : 'var(--ink)' } },
          r.dataN ? nf(r.total) : '—'),
        h('span', {
          class: 'badge ' + (r.grade === 'มส' || r.grade === '0' ? 'r' : 'g'),
          style: { flex: 'none' }
        }, `เกรด ${r.grade}`))
    ),

    h('div', { class: 'pager' },
      h('button', { class: 'btn btn-ghost', disabled: ui.fi === 0, onclick: () => step(-1) }, '‹'),
      h('button', {
        class: 'btn',
        onclick: () => {
          if (ui.fi < rows.length - 1) step(1);
          else { toast('ครบทุกคนแล้ว 🎉', 'ok'); ui.fill = false; emit(); }
        }
      }, ui.fi < rows.length - 1 ? `คนถัดไป · ${rows[ui.fi + 1].name || ''} ›` : 'เสร็จสิ้น'))
  );
}

// ── ตาราง ───────────────────────────────────────────────────

function table(rows, cols, S, pend) {
  return h('table', { class: 'grid' },
    h('thead', null,
      h('tr', { class: 'group' },
        h('th', { class: 'sticky-l c-no' }, '#'),
        h('th', { class: 'sticky-l c-name' }, 'ชื่อ-นามสกุล'),
        cols.map(c => h('th', {
          class: c.cls,
          title: `แตะเพื่อคัดลอกช่องนี้ทั้งห้อง · เต็ม ${S.weight[c.id]}`,
          style: { cursor: 'pointer' },
          onclick: () => copyColumn(rows, c)
        },
          h('div', { style: { fontWeight: '700' } }, c.head),
          h('div', { style: { fontWeight: '400', fontSize: '11px', opacity: '.8' } },
            c.sub || String(S.weight[c.id]))
        )),
        h('th', { class: 'h-total' }, 'รวม'),
        h('th', { class: 'h1' }, 'เกรด')
      )
    ),
    h('tbody', null, rows.map(r => h('tr', null,
      h('td', { class: 'sticky-l c-no num' }, r.no),
      h('td', {
        class: 'sticky-l c-name',
        title: r.flag || null
      },
        r.name,
        r.grade === 'มส' && h('span', { class: 'badge r', style: { marginLeft: '6px' } }, 'มส')),
      cols.map(c => {
        const p = (pend[r.sid] || {})[c.id] || 0;
        return h('td', { class: 'num', style: r['_has_' + c.id] ? null : { color: 'var(--ink-3)' } },
          cellText(r, c.id), p > 0 && h('span', { class: 'dot-pend' }, '•'));
      }),
      h('td', {
        class: 'num total',
        style: (r.grade === 'มส' || r.grade === '0') ? { color: 'var(--st-miss)' } : null
      }, r.dataN ? nf(r.total) : '—'),
      h('td', {
        class: 'num',
        style: (r.grade === 'มส' || r.grade === '0') ? { color: 'var(--st-miss)' } : null
      }, r.grade)
    )))
  );
}

/** ช่องที่ยังไม่มีข้อมูลให้ขึ้น “—” ไม่ใช่ 0 (0 แปลว่านักเรียนได้ 0 จริง ๆ) */
const cellText = (r, id) => (r['_has_' + id] ? nf(r[id]) : '—');

// ── คัดลอก / ส่งออก ─────────────────────────────────────────

async function toClipboard(text, msg) {
  try {
    await navigator.clipboard.writeText(text);
    toast(msg, 'ok');
  } catch {
    modal((close) => h('div', null,
      h('h2', null, 'คัดลอกด้วยตัวเอง'),
      h('div', { class: 'hint', style: { marginBottom: '8px' } }, 'เบราว์เซอร์ไม่อนุญาตให้คัดลอกอัตโนมัติ — กดค้างเพื่อเลือกทั้งหมด'),
      h('textarea', { rows: 12, value: text, style: { fontFamily: 'ui-monospace, monospace' } }),
      h('div', { style: { height: '10px' } }),
      h('button', { class: 'btn btn-block', onclick: close }, 'ปิด')
    ));
  }
}

function copyColumn(rows, col) {
  // ช่องที่ยังไม่มีข้อมูล คัดลอกเป็นค่าว่าง — กัน 0 หลุดไปลง SGS
  const has = rows.filter(r => r['_has_' + col.id]).length;
  if (!has) return toast(`ช่อง "${col.head}" ยังไม่มีข้อมูล — ยังไม่ต้องคัดลอก`, 'err', 4000);
  const text = rows.map(r => (r['_has_' + col.id] ? nf(r[col.id]) : '')).join('\n');
  toClipboard(text, has === rows.length
    ? `คัดลอกช่อง "${col.head}" แล้ว ${rows.length} ค่า`
    : `คัดลอกช่อง "${col.head}" แล้ว — มี ${rows.length - has} คนที่ยังไม่มีข้อมูล (เว้นว่างไว้)`);
}

function copyTable(rows, cols) {
  const head = ['เลขที่', 'ชื่อ-นามสกุล', ...cols.map(c => c.head), 'รวม'].join('\t');
  const body = rows.map(r => [r.no, r.name,
    ...cols.map(c => (r['_has_' + c.id] ? nf(r[c.id]) : '')),
    r.dataN ? nf(r.total) : ''].join('\t'));
  toClipboard([head, ...body].join('\n'), 'คัดลอกทั้งตารางแล้ว');
}

function downloadCSV(rows) {
  const cls = state.cls;
  const head = ['เลขที่', 'เลขประจำตัว', 'ชื่อ-นามสกุล',
    ...SGS_COLS.map(c => c.head + (c.sub ? ` (${c.sub})` : '')),
    'รวม', 'เกรด', '%เวลาเรียน', 'หมายเหตุ'];
  const lines = [head, ...rows.map(r => [
    r.no, r.sid, r.name,
    ...SGS_COLS.map(c => (r['_has_' + c.id] ? nf(r[c.id]) : '')),
    r.dataN ? nf(r.total) : '', r.grade, r.attN ? r.pct + '%' : '', r.flag
  ])];
  const csv = '﻿' + lines.map(l => l.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const a = h('a', {
    href: URL.createObjectURL(blob),
    download: `SGS_${[cls.meta.grade, cls.meta.room].filter(Boolean).join('-')}_${cls.meta.subject}.csv`
  });
  document.body.append(a); a.click(); a.remove();
  toast('ดาวน์โหลดแล้ว', 'ok');
}

// ── ตรวจความพร้อม ───────────────────────────────────────────

function checkIssues(rows, S) {
  const out = [];

  const empty = BUCKETS.filter(b => !rows.some(r => r['_has_' + b.id]));
  if (empty.length === BUCKETS.length) {
    out.push('ห้องนี้ยังไม่ได้กรอกข้อมูลสักช่อง — ตารางจึงขึ้น “—” ทั้งหมด ยังไม่ต้องนำไปกรอก SGS');
  } else {
    for (const b of empty) {
      out.push(`ยังไม่มีข้อมูล "${b.label} ${b.phase === 1 ? 'ก่อนกลางภาค' : 'หลังกลางภาค'}" (SGS ${b.sgs}) — ช่องนี้จะขึ้น “—” จนกว่าจะกรอก`);
    }
  }

  const pending = rows.filter(r => r.pending > 0).length;
  if (pending) out.push(`มีนักเรียน ${pending} คนที่ยังตรวจงานไม่ครบ (โหมดปัจจุบัน: ${S.ungraded === 'zero' ? 'นับเป็น 0' : 'ไม่นำมาคิด'})`);

  const over = rows.filter(r => r.total > 100);
  if (over.length) out.push(`คะแนนรวมเกิน 100 จำนวน ${over.length} คน — ตรวจน้ำหนักคะแนนในหน้าตั้งค่า`);

  const noName = rows.filter(r => !r.name).length;
  if (noName) out.push(`มี ${noName} แถวที่ไม่มีชื่อนักเรียน`);

  return out;
}

__exp(exports, { viewSummary });

  };

  __defs["js/views/report.js"] = function (exports, __req) {
/* หน้ารายงานผล — สถิติรายห้อง และรายบุคคล
 *
 * สีสถานะใช้ชุดเดียวกับทั้งแอป (ผ่านการตรวจ contrast/ตาบอดสีแล้ว)
 * ทุกกราฟมีตัวเลขกำกับและมีตารางข้อมูลควบเสมอ ไม่สื่อความหมายด้วยสีอย่างเดียว
 */

const { h, toast, fmtDate, nf } = __req("js/dom.js");
const { state, emit, settings, go } = __req("js/state.js");
const { computeClass, parseWork, BUCKETS, ATT_CODES } = __req("js/score.js");

const ui = { tab: 'class', sid: null, q: '' };

// สถานะ → สี + ชื่อ (ใช้ร่วมกันทั้งหน้า)
// สีอ่านจากตัวแปรใน styles.css เพื่อให้โหมดมืดเปลี่ยนตามได้เอง
// ทั้ง 2 ชุดผ่านเครื่องตรวจตาบอดสีแล้ว — แก้ค่าเมื่อไหร่ต้องรันตรวจซ้ำ
const ATT_STYLE = {
  'ม': { c: 'var(--st-ok)',    t: 'var(--on-ok)',    label: 'มา' },
  'ส': { c: 'var(--st-late)',  t: 'var(--on-late)',  label: 'สาย' },
  'ล': { c: 'var(--st-leave)', t: 'var(--on-leave)', label: 'ลา' },
  'ข': { c: 'var(--st-miss)',  t: 'var(--on-miss)',  label: 'ขาด' }
};
const WORK_STYLE = {
  ok:   { c: 'var(--st-ok)',   t: 'var(--on-ok)',   label: 'ส่ง',        exam: 'สอบแล้ว' },
  late: { c: 'var(--st-late)', t: 'var(--on-late)', label: 'ส่งช้า',     exam: 'ส่งช้า' },
  miss: { c: 'var(--st-miss)', t: 'var(--on-miss)', label: 'ไม่ส่ง',     exam: 'ยังไม่ได้สอบ' },
  none: { c: 'var(--st-none)', t: 'var(--ink)',     label: 'ยังไม่ตรวจ', exam: 'ยังไม่กรอก' }
};

/** ข้อสอบ (สอบเก็บคะแนน/กลางภาค/ปลายภาค) เรียกสถานะคนละคำกับงานส่ง */
const isExam = (col) => col && col.kind !== 'WORK';
const statusLabel = (k, col) => (isExam(col) ? WORK_STYLE[k].exam : WORK_STYLE[k].label);

function viewReport() {
  const cls = state.cls;
  if (!cls) return h('div', { class: 'page empty' }, 'ยังไม่ได้เลือกห้องเรียน');
  if (!cls.students.length) {
    return h('div', { class: 'page' }, h('div', { class: 'card empty' },
      h('div', { class: 'empty-icon' }, '👥'), 'ห้องนี้ยังไม่มีรายชื่อนักเรียน'));
  }

  return h('div', { class: 'page' },
    // แท็บ + ปุ่มส่งออก — ดีไซน์วางไว้แถวบนสุด ปุ่มส่งออกชิดขวา
    h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' } },
      h('button', { class: 'chip', 'data-on': ui.tab === 'class' ? '1' : '0', onclick: () => { ui.tab = 'class'; emit(); } }, 'ทั้งห้อง'),
      h('button', { class: 'chip', 'data-on': ui.tab === 'student' ? '1' : '0', onclick: () => { ui.tab = 'student'; emit(); } }, 'รายคน'),
      h('button', {
        class: 'chip', style: { marginLeft: 'auto' },
        onclick: () => exportReport(computeClass(cls, settings()))
      }, '⤓ ออกไฟล์ CSV')
    ),
    ui.tab === 'class' ? classReport() : studentReport()
  );
}

const wide = () => { try { return matchMedia('(min-width: 900px)').matches; } catch (e) { return false; } };

// ── ตัวช่วยรวมข้อมูล ────────────────────────────────────────

function attColumns() {
  return (state.cls.columns || []).filter(c => c.kind === 'ATT')
    .sort((a, b) => (a.date + String(a.period).padStart(3, '0')).localeCompare(b.date + String(b.period).padStart(3, '0')));
}

function workColumns() {
  return (state.cls.columns || []).filter(c => ['WORK', 'QUIZ', 'MID', 'FIN'].includes(c.kind));
}

/** นับสถานะการมาเรียนของนักเรียนคนหนึ่ง (หรือทั้งห้องถ้าไม่ระบุ sid) */
function attCount(sid) {
  const out = { 'ม': 0, 'ส': 0, 'ล': 0, 'ข': 0, blank: 0 };
  const V = state.cls.values || {};
  for (const c of attColumns()) {
    const list = sid ? [sid] : state.cls.students.map(s => s.sid);
    for (const id of list) {
      const v = String((V[c.key] || {})[id] ?? '').trim();
      if (ATT_CODES.includes(v)) out[v]++; else out.blank++;
    }
  }
  return out;
}

function workCount(col, sid) {
  const out = { ok: 0, late: 0, miss: 0, none: 0 };
  const m = (state.cls.values || {})[col.key] || {};
  const list = sid ? [sid] : state.cls.students.map(s => s.sid);
  for (const id of list) out[parseWork(m[id]).status]++;
  return out;
}

// ── ชิ้นส่วนกราฟ (แถบสัดส่วน + ตัวเลขกำกับ + คำอธิบายสี) ────

/** segs: [{ key, n, c, label }] */
function stackBar(segs, { height = 22 } = {}) {
  const total = segs.reduce((a, s) => a + s.n, 0);
  if (!total) return h('div', { class: 'bar-empty' }, 'ยังไม่มีข้อมูล');
  return h('div', { class: 'stackbar', style: { height: height + 'px' } },
    segs.filter(s => s.n > 0).map(s => {
      const pct = s.n / total * 100;
      return h('div', {
        class: 'stackseg',
        style: { width: pct + '%', background: s.c, color: s.t || '#fff' },
        title: `${s.label} ${s.n} (${nf(pct, 0)}%)`
      }, pct >= 11 ? h('span', null, String(s.n)) : null);
    })
  );
}

function legend(segs) {
  const total = segs.reduce((a, s) => a + s.n, 0) || 1;
  return h('div', { class: 'legend' },
    segs.map(s => h('span', { class: 'legend-item' },
      h('i', { style: { background: s.c } }),
      `${s.label} ${s.n}`,
      h('b', null, ` ${nf(s.n / total * 100, 0)}%`)
    ))
  );
}

// ── รายงานทั้งห้อง ──────────────────────────────────────────

function classReport() {
  const cls = state.cls;
  const S = settings();
  const rows = computeClass(cls, S);
  const att = attCount(null);
  const attCols = attColumns();
  const wCols = workColumns();

  // นับเฉพาะคนที่มีข้อมูลจริง — ยังไม่กรอกต้องขึ้น “—” ไม่ใช่ตัวเลขลอย ๆ
  const graded = rows.filter(r => r.dataN > 0);

  const attSegs = ATT_CODES.map(k => ({ key: k, n: att[k], c: ATT_STYLE[k].c, t: ATT_STYLE[k].t, label: ATT_STYLE[k].label }));

  // การกระจายเกรด
  const gradeOrder = ['4', '3.5', '3', '2.5', '2', '1.5', '1', '0', 'มส'];
  const gCount = {};
  rows.forEach(r => { gCount[r.grade] = (gCount[r.grade] || 0) + 1; });
  const grades = gradeOrder.filter(g => gCount[g]).map(g => ({ g, n: gCount[g] }));
  const gMax = Math.max(...grades.map(x => x.n), 1);

  // ผู้ที่ต้องติดตาม
  const watch = graded
    .map(r => ({ r, score: (r.grade === 'มส' ? 1000 : 0) + r.pending * 10 + Math.max(0, 60 - r.total) }))
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 12);

  // ตัวเลขสรุปทั้งห้องอยู่หน้าแรกแล้ว หน้านี้จึงเริ่มที่กราฟเลยตามดีไซน์
  return h('div', null,

    // ── สองการ์ดคู่กัน: การมาเรียน · การกระจายเกรด (ดีไซน์หน้า 04) ──
    h('div', { class: 'rep-grid', style: { marginBottom: '12px' } },

      h('div', { class: 'card' },
        h('div', { class: 'rep-head' },
          h('h3', null, 'สัดส่วนการมาเรียน'),
          h('span', null, `${attCols.length} คาบ`)),
        attCols.length === 0
          ? h('div', { class: 'bar-empty' }, 'ยังไม่ได้เช็คชื่อ')
          : h('div', null, stackBar(attSegs, { height: 26 }), legend(attSegs),
              att.blank > 0 && h('div', { class: 'hint' }, `ยังไม่ได้เช็ค ${att.blank} ช่อง`))
      ),

      h('div', { class: 'card' },
        h('div', { class: 'rep-head' },
          h('h3', null, 'การกระจายเกรด'),
          h('span', null, 'ประมาณการ')),
        grades.length === 0
          ? h('div', { class: 'bar-empty' }, 'ยังไม่มีคะแนนพอจะตัดเกรด')
          : h('div', null,
              h('div', { class: 'gradebars' },
                grades.map(x => h('div', { class: 'gcol' },
                  h('div', { class: 'gcol-n' }, String(x.n)),
                  h('div', {
                    // ดีไซน์: เกรด 1 = ส้มเตือน · เกรด 0 กับ มส = แดง
                    class: 'gcol-bar' + ((x.g === 'มส' || x.g === '0') ? ' bad' : (x.g === '1' ? ' warn' : '')),
                    style: { height: Math.round(8 + (x.n / gMax) * 56) + 'px' },
                    title: `เกรด ${x.g} · ${x.n} คน`
                  })))),
              h('div', { class: 'gaxis' }, grades.map(x => h('div', null, x.g))))
      )
    ),

    // ── การส่งงาน รายชิ้น ──
    h('div', { class: 'card' },
      h('div', { class: 'rep-head' },
        h('h3', null, '📝 การส่งงานรายชิ้น'),
        h('span', null, `${wCols.length} รายการ`)),
      wCols.length === 0
        ? h('div', { class: 'bar-empty' }, 'ยังไม่มีรายการงาน/สอบ')
        : h('div', null,
            h('div', { class: 'legend', style: { marginBottom: '8px' } },
              Object.entries(WORK_STYLE).map(([k, v]) => {
                const hasWork = wCols.some(c => !isExam(c)), hasExam = wCols.some(isExam);
                const txt = hasWork && hasExam && v.label !== v.exam
                  ? `${v.label} / ${v.exam}` : (hasExam && !hasWork ? v.exam : v.label);
                return h('span', { class: 'legend-item' }, h('i', { style: { background: v.c } }), txt);
              })),
            wCols.map(c => {
              const t = workCount(c);
              const segs = ['ok', 'late', 'miss', 'none'].map(k =>
                ({ key: k, n: t[k], c: WORK_STYLE[k].c, t: WORK_STYLE[k].t, label: statusLabel(k, c) }));
              return h('div', { class: 'multi-row' },
                h('div', { class: 'multi-label' }, c.label,
                  h('span', null, bucketName(c))),
                stackBar(segs, { height: 18 }));
            }))
    ),

    // ── ต้องติดตาม — เรียงตามความเร่งด่วน พื้นหลังบอกระดับ ──
    h('div', { class: 'card' },
      h('div', { class: 'rep-head' },
        h('h3', null, `ต้องติดตาม · ${watch.length} คน`),
        h('span', null, 'เรียงตามความเร่งด่วน')),
      watch.length === 0
        ? h('div', { class: 'empty', style: { padding: '22px' } }, 'ไม่มีใครน่าเป็นห่วง 🎉')
        : watch.map(({ r }) => {
            const bad = r.grade === 'มส' || r.flag.includes('เสี่ยงติด 0');
            const warn = !bad && (r.attN > 0 && r.pct < S.minPct + 5);
            return h('button', {
              class: 'watch-row' + (bad ? ' bad' : (warn ? ' warn' : '')),
              onclick: () => { ui.tab = 'student'; ui.sid = r.sid; emit(); }
            },
              h('div', { class: 'w-name' }, r.name || '—', h('span', null, ` เลขที่ ${r.no}`)),
              r.attN > 0 && h('div', { class: 'w-tag ' + (r.pct < S.minPct ? 'bad' : (warn ? 'warn' : 'dim')) },
                (r.pct < S.minPct ? 'มส · ' : '') + `เวลาเรียน ${nf(r.pct, 0)}%`),
              h('div', { class: 'w-tag ' + (bad ? 'bad' : 'dim') },
                r.pending > 0 ? `ยังไม่ตรวจ ${r.pending} รายการ` : `รวม ${nf(r.total)}`),
              h('span', { class: 'w-go' }, '›'));
          })
    )
  );
}

function bucketName(c) {
  const b = BUCKETS.find(x => x.kind === c.kind && x.half === c.half);
  if (!b) return '';
  return `${b.label} · ${b.phase === 1 ? 'ก่อนกลางภาค' : 'หลังกลางภาค'} · เต็ม ${c.max}`;
}

// ── รายงานรายคน ────────────────────────────────────────────

function studentReport() {
  const cls = state.cls;
  const S = settings();
  const rows = computeClass(cls, S);
  if (!ui.sid || !rows.some(r => r.sid === ui.sid)) ui.sid = rows[0].sid;
  const r = rows.find(x => x.sid === ui.sid);

  const q = ui.q.trim().toLowerCase();
  const matches = q
    ? cls.students.filter(s => s.name.toLowerCase().includes(q) || String(s.no) === q || s.sid.includes(q))
    : [];

  const att = attCount(r.sid);

  // งานที่ยังไม่ส่ง หรือครูยังไม่ได้ตรวจ — เรียงไม่ส่งขึ้นก่อน
  const todo = workColumns()
    .map(c => ({ c, w: parseWork((cls.values[c.key] || {})[r.sid]) }))
    .filter(x => x.w.status === 'miss' || x.w.status === 'none')
    .sort((a, b) => (a.w.status === 'miss' ? 0 : 1) - (b.w.status === 'miss' ? 0 : 1));

  return h('div', null,
    // ── PC: ชื่อ + ค้นหา + เปลี่ยนคน (มือถืออยู่ในแถบเข้มด้านบนแล้ว) ──
    h('div', { class: 'ctxbar' },
      h('div', { style: { flex: '1', minWidth: '0' } },
        h('div', { class: 'ctx-title' }, r.name || '—'),
        h('div', { class: 'ctx-sub' }, `เลขที่ ${r.no}${r.sid ? ' · ' + r.sid : ''}`)),
      h('div', { style: { position: 'relative' } },
        h('input', {
          placeholder: '🔍 ค้นหาชื่อ หรือเลขที่', value: ui.q, style: { minWidth: '210px' },
          oninput: (e) => { ui.q = e.target.value; emit(); }
        }),
        matches.length > 0 && h('div', { class: 'search-hits' },
          matches.slice(0, 6).map(s => h('button', {
            class: 'chip', onclick: () => { ui.sid = s.sid; ui.q = ''; emit(); }
          }, `${s.no}. ${s.name}`)))),
      h('div', { class: 'ctx-end' },
        h('button', { class: 'btn btn-ghost btn-sm', onclick: () => moveStudent(-1, rows) }, '‹'),
        h('button', { class: 'btn btn-ghost btn-sm', onclick: () => moveStudent(1, rows) }, '›'))),

    // เลือกคนได้ตรง ๆ เหมือนโหมดรายคนของหน้างาน/คะแนน
    // เดิมบนมือถือ .ctxbar ถูกซ่อน (max-width:899px) จึงไม่มีทางเปลี่ยนคนเลย
    // ต้องถอยกลับไปหน้าทั้งห้องแล้วเข้ามาใหม่เท่านั้น
    h('div', { class: 'pick2row pc-hide' },
      h('button', {
        class: 'btn btn-ghost btn-sm', 'aria-label': 'คนก่อนหน้า',
        disabled: rows.findIndex(x => x.sid === ui.sid) <= 0,
        onclick: () => moveStudent(-1, rows)
      }, '‹'),
      h('label', { class: 'pickbox grow' },
        h('span', null, 'นักเรียน'),
        h('select', {
          'aria-label': 'เลือกนักเรียน',
          onchange: (e) => { ui.sid = e.target.value; emit(); }
        }, rows.map(x => h('option', { value: x.sid, selected: x.sid === ui.sid },
          `${x.no}. ${x.name || '—'}`)))),
      h('button', {
        class: 'btn btn-ghost btn-sm', 'aria-label': 'คนถัดไป',
        disabled: rows.findIndex(x => x.sid === ui.sid) >= rows.length - 1,
        onclick: () => moveStudent(1, rows)
      }, '›')),

    // ── ธงเตือน — พื้นหลังบอกระดับตามดีไซน์ ──
    r.flag && h('div', {
      class: 'card',
      style: {
        background: r.grade === 'มส' ? 'var(--miss-soft)' : 'var(--late-soft)',
        display: 'flex', gap: '10px', alignItems: 'center', padding: '12px 14px'
      }
    },
      h('div', { style: { fontSize: '13px', fontWeight: '700', color: r.grade === 'มส' ? 'var(--st-miss)' : 'var(--warn-ink)' } },
        r.grade === 'มส' ? 'มส' : '⚠️'),
      h('div', { style: { fontSize: '12.5px', flex: '1', color: r.grade === 'มส' ? 'var(--st-miss)' : 'var(--warn-ink)' } },
        r.attN && r.pct < S.minPct
          ? `เวลาเรียน ${r.pct}% ต่ำกว่าเกณฑ์ ${S.minPct}% · ขาด ${att['ข']} คาบ`
          : r.flag)),

    // ── คะแนน 8 ช่อง — ตารางย่อ 2 คอลัมน์ (ดีไซน์หน้า 04 มือถือ) ──
    h('div', { class: 'card' },
      h('div', { style: { display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '12px' } },
        h('div', { style: { fontSize: '13.5px', fontWeight: '700', flex: '1' } }, 'คะแนน 8 ช่อง'),
        h('div', {
          class: 'tnum',
          style: { fontSize: '20px', fontWeight: '700', color: r.grade === 'มส' || r.grade === '0' ? 'var(--st-miss)' : 'var(--ink)' }
        }, r.dataN ? nf(r.total) : '—'),
        h('div', { style: { fontSize: '12.5px', color: 'var(--ink-2)' } }, `/100 · เกรด ${r.grade}`)),
      h('div', { class: 'score8' },
        BUCKETS.map(b => h('div', { class: 'score8-cell', title: `SGS ช่อง ${b.sgs}` },
          // สอบกลางภาค/ปลายภาคมีครั้งเดียว ไม่ต้องมีเลขช่วงต่อท้าย
          h('span', null, (b.kind === 'MID' || b.kind === 'FIN') ? b.label : `${b.label} ${b.phase}`),
          h('b', { class: r['_has_' + b.id] ? 'tnum' : 'tnum none' },
            r['_has_' + b.id] ? `${nf(r[b.id])}/${S.weight[b.id]}`
              : (b.kind === 'MID' || b.kind === 'FIN' ? 'ยังไม่สอบ' : '—')))))
    ),

    // ── วันที่ขาด/สาย/ลา — ป้ายสั้น ๆ เรียงกัน (ดีไซน์หน้า 04) ──
    att['ข'] + att['ส'] + att['ล'] > 0 && h('div', { class: 'card' },
      h('div', { style: { fontSize: '13.5px', fontWeight: '700', marginBottom: '10px' } },
        `วันที่ขาด / สาย / ลา · ${att['ข'] + att['ส'] + att['ล']} คาบ`),
      h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '6px' } },
        attColumns().map(c => {
          const v = String((cls.values[c.key] || {})[r.sid] ?? '').trim();
          if (!v || v === 'ม') return null;
          return h('span', {
            class: 'daychip',
            style: { background: `var(--${v === 'ข' ? 'miss' : v === 'ส' ? 'late' : 'leave'}-soft)`, color: ATT_STYLE[v].c }
          }, `${fmtDate(c.date)} ค.${c.period} ${ATT_STYLE[v].label}`);
        }))),

    // ── งานที่ยังค้าง ──
    // หน้านี้เป็น "รายงาน" ไม่ใช่หน้ากรอกคะแนน จึงโชว์เฉพาะสิ่งที่ต้องตามต่อ
    // (รายการงานครบทุกชิ้นพร้อมปุ่มกด อยู่ที่ งาน/คะแนน → รายคน)
    todo.length > 0 && h('div', { class: 'card' },
      h('div', { style: { fontSize: '13.5px', fontWeight: '700', marginBottom: '10px' } },
        `งานที่ยังไม่ส่ง / ยังไม่ตรวจ · ${todo.length} ชิ้น`),
      h('div', { style: { display: 'flex', flexDirection: 'column', gap: '7px', fontSize: '13px' } },
        todo.map(({ c, w }) => h('div', { style: { display: 'flex', gap: '10px' } },
          h('span', { style: { flex: '1', minWidth: '0' } }, c.label),
          h('span', { style: { color: w.status === 'miss' ? 'var(--st-miss)' : 'var(--ink-3)', flex: 'none' } },
            statusLabel(w.status, c)))))),

    h('button', {
      class: 'btn btn-ghost btn-block', style: { marginTop: '4px' },
      onclick: () => go('work')
    }, '📝 ไปกรอกงาน / คะแนนของคนนี้')
  );
}

function moveStudent(delta, rows) {
  const i = rows.findIndex(r => r.sid === ui.sid);
  const next = rows[(i + delta + rows.length) % rows.length];
  ui.sid = next.sid; ui.q = '';
  emit();
}

// ── ส่งออก ──────────────────────────────────────────────────

function exportReport(rows) {
  const cls = state.cls;
  const att = {};
  cls.students.forEach(s => { att[s.sid] = attCount(s.sid); });

  const head = ['เลขที่', 'เลขประจำตัว', 'ชื่อ-นามสกุล',
    'มา', 'สาย', 'ลา', 'ขาด', '%เวลาเรียน',
    ...BUCKETS.map(b => `${b.label} (SGS ${b.sgs})`),
    'รวม', 'เกรด', 'ค้างตรวจ', 'ส่งช้า', 'หมายเหตุ'];

  const lines = [head, ...rows.map(r => [
    r.no, r.sid, r.name,
    att[r.sid]['ม'], att[r.sid]['ส'], att[r.sid]['ล'], att[r.sid]['ข'], r.attN ? r.pct + '%' : '',
    ...BUCKETS.map(b => (r['_has_' + b.id] ? nf(r[b.id]) : '')),
    r.dataN ? nf(r.total) : '', r.grade, r.pending, r.late || 0, r.flag
  ])];

  const csv = '﻿' + lines.map(l => l.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const a = h('a', {
    href: URL.createObjectURL(blob),
    download: `รายงาน_${[cls.meta.grade, cls.meta.room].filter(Boolean).join('-')}_${cls.meta.subject}.csv`
  });
  document.body.append(a); a.click(); a.remove();
  toast('ดาวน์โหลดแล้ว', 'ok');
}

__exp(exports, { viewReport });

  };

  __defs["js/views/settings.js"] = function (exports, __req) {
/* หน้าตั้งค่า — จัดเป็น 5 กลุ่มตามดีไซน์หน้า 06
 *   PC     เมนูซ้ายค้างไว้ เนื้อหาขวาเปลี่ยนตามกลุ่มที่เลือก
 *   มือถือ  หน้าแรกเป็นสรุป + รายการ 5 กลุ่ม กดแล้วเข้าไปในกลุ่มนั้น
 *
 * ทุกช่องบันทึกอัตโนมัติเมื่อแก้เสร็จ (เหตุการณ์ change ไม่ใช่ทุกตัวอักษร)
 * ครูจะได้ไม่ต้องจำว่ากดบันทึกหรือยัง — ดีไซน์ยึดข้อนี้เป็นหลัก
 */

const { h, toast, confirmBox, modal } = __req("js/dom.js");
const { state, saveConfig, sync, bootAll, go, emit } = __req("js/state.js");
const api = __req("js/api.js");
const { auth } = __req("js/auth.js");
const { icon } = __req("js/icons.js");
const { THEMES, getTheme, setTheme } = __req("js/theme.js");

const SECTIONS = [
  { id: 'score', label: 'การคิดคะแนน' },
  { id: 'att',   label: 'การเช็คชื่อ' },
  { id: 'acct',  label: 'บัญชีและการเชื่อมต่อ' },
  { id: 'data',  label: 'ข้อมูลและการสำรอง' },
  { id: 'about', label: 'เกี่ยวกับระบบ' }
];

/** ช่อง 8 ช่องของ SGS พร้อมสีในแถบสัดส่วน */
const WEIGHTS = [
  { k: 'w_work1', label: '1 · ส่งงาน (ก่อน)',   c: 'var(--accent)' },
  { k: 'w_quiz1', label: '2 · สอบเก็บ (ก่อน)',  c: 'var(--accent-2)' },
  { k: 'w_att1',  label: '3 · เข้าเรียน (ก่อน)', c: 'var(--hero)' },
  { k: 'w_mid',   label: 'กลางภาค',             c: 'var(--ink)' },
  { k: 'w_work2', label: '10 · ส่งงาน (หลัง)',  c: 'var(--accent)' },
  { k: 'w_quiz2', label: '11 · สอบเก็บ (หลัง)', c: 'var(--accent-2)' },
  { k: 'w_att2',  label: '12 · เข้าเรียน (หลัง)', c: 'var(--hero)' },
  { k: 'w_fin',   label: 'ปลายภาค',             c: 'var(--ink)' }
];

const ui = { sec: null, savedAt: '' };   // sec = null → มือถือแสดงหน้าสรุป

const cfg = (k, d = '') => (state.config[k] ?? d);
const num = (k) => Number(state.config[k]) || 0;
const weightSum = () => WEIGHTS.reduce((a, w) => a + num(w.k), 0);
const midSet = () => /^\d{4}-\d{2}-\d{2}$/.test(String(cfg('mid_date')).trim());

/** บันทึกทีละช่อง ทันทีที่แก้เสร็จ */
async function put(k, v) {
  try {
    await saveConfig({ [k]: v });
    ui.savedAt = new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
    const el = document.querySelector('[data-savedat]');
    if (el) el.textContent = 'ล่าสุด ' + ui.savedAt + ' น.';
  } catch (e) {
    toast(e.message, 'err', 5000);
  }
}

// ── ชิ้นส่วนที่ใช้ซ้ำ ────────────────────────────────────────

/** แถวตั้งค่า 1 บรรทัด: ชื่อ + คำอธิบาย ทางซ้าย · ตัวควบคุมทางขวา */
const row = (name, desc, ctl, bad) => h('div', { class: 'set-row' },
  h('div', null,
    h('div', { class: 'set-name' }, name),
    desc && h('div', { class: 'set-desc' + (bad ? ' bad' : '') }, desc)),
  h('div', { class: 'set-ctl' }, ctl));

const numInput = (k, { step, suffix, width } = {}) => [
  h('input', {
    type: 'number', step: step || '1', value: String(cfg(k)),
    style: width ? { width } : null,
    onchange: (e) => put(k, e.target.value)
  }),
  suffix && h('span', { style: { fontSize: '13.5px', color: 'var(--ink-2)' } }, suffix)
];

const selectInput = (k, options) => h('select', {
  value: String(cfg(k)),
  onchange: (e) => put(k, e.target.value)
}, options.map(([v, l]) => h('option', { value: v, selected: String(cfg(k)) === v }, l)));

/** ตัวเลือก 2 ทางแบบปุ่มคู่ (ดีไซน์ใช้แทน select ในกติกาหลัก) */
const segInput = (k, options) => h('div', { class: 'seg seg-inline' },
  options.map(([v, l]) => h('button', {
    'data-on': String(cfg(k)) === v ? '1' : '0',
    onclick: () => { put(k, v); state.config[k] = v; emit(); }
  }, l)));

// ── กลุ่มที่ 1: การคิดคะแนน ─────────────────────────────────

function secScore() {
  const sum = weightSum();
  return [
    h('div', { class: 'card' },
      h('div', { style: { display: 'flex', alignItems: 'baseline', gap: '10px', marginBottom: '4px' } },
        h('div', { style: { fontSize: '17px', fontWeight: '700', flex: '1' } }, 'น้ำหนักคะแนน 8 ช่อง'),
        h('div', { class: sum === 100 ? 'set-ok' : 'set-bad' },
          sum === 100 ? 'รวม 100 ✓' : `รวม ${sum} ✕`)),
      h('div', { style: { fontSize: '12.5px', color: 'var(--ink-2)' } },
        'ต้องรวมได้ 100 พอดี ระบบเตือนทันทีถ้าเกินหรือขาด'),
      h('div', { class: 'weightbar' },
        WEIGHTS.map(w => num(w.k) > 0 &&
          h('i', { style: { width: (num(w.k) / Math.max(sum, 1) * 100) + '%', background: w.c }, title: `${w.label} ${num(w.k)}` }))),
      h('div', { class: 'wgrid' },
        WEIGHTS.map(w => h('div', { class: 'wcell' },
          h('label', null, w.label),
          h('input', {
            type: 'number', min: '0', value: String(num(w.k)),
            onchange: (e) => { state.config[w.k] = e.target.value; put(w.k, e.target.value); emit(); }
          }))))
    ),

    h('div', { class: 'card' },
      h('div', { style: { fontSize: '17px', fontWeight: '700', marginBottom: '4px' } }, 'กติกาการคิดคะแนน'),
      row('งานที่ยังไม่ตรวจ', 'ช่องว่างในบล็อกส่งงาน/สอบ จะถูกนับยังไง',
        segInput('ungraded_mode', [['ignore', 'ไม่นับ'], ['zero', 'นับเป็น 0']])),
      row('หักคะแนนงานส่งช้า', 'หักจากคะแนนเต็มของงานชิ้นนั้น ตอนกดปุ่ม "ช้า"',
        numInput('late_penalty_pct', { step: '5', suffix: '%' })),
      row('การปัดเศษ', 'ใช้กับคะแนนทุกช่องก่อนแสดงและก่อนเขียนลงชีต',
        [selectInput('round_digits', [['0', 'จำนวนเต็ม'], ['1', 'ทศนิยม 1 ตำแหน่ง'], ['2', 'ทศนิยม 2 ตำแหน่ง']]),
         selectInput('round_mode', [['half', 'ปัดครึ่งขึ้น'], ['up', 'ปัดขึ้นเสมอ'], ['down', 'ปัดลงเสมอ']])]),
      row('เกณฑ์เกรด', 'รูปแบบ คะแนน:เกรด คั่นด้วยจุลภาค',
        h('input', {
          value: String(cfg('grade_cuts')), style: { minWidth: '260px' },
          onchange: (e) => put('grade_cuts', e.target.value)
        })),
      row('วันสอบกลางภาค',
        midSet() ? 'ใช้แยกว่าคาบที่เช็คอยู่ช่วงก่อนหรือหลังกลางภาค'
                 : 'ยังไม่ได้ตั้ง — ระบบยังแยกช่วงก่อน/หลังกลางภาคไม่ได้',
        h('input', {
          type: 'date', value: String(cfg('mid_date')),
          style: midSet() ? null : { borderColor: 'var(--st-miss)', color: 'var(--st-miss)' },
          onchange: (e) => { state.config.mid_date = e.target.value; put('mid_date', e.target.value); emit(); }
        }),
        !midSet())
    ),

    h('div', { class: 'card' },
      h('div', { style: { fontSize: '17px', fontWeight: '700', marginBottom: '4px' } }, 'ข้อมูลรายวิชา'),
      row('ปีการศึกษา', null, h('input', { value: String(cfg('year')), onchange: (e) => put('year', e.target.value) })),
      row('ภาคเรียนที่', null, h('input', { value: String(cfg('term')), onchange: (e) => put('term', e.target.value) })),
      row('ชื่อครูผู้สอน', null, h('input', { value: String(cfg('teacher')), style: { minWidth: '200px' }, onchange: (e) => put('teacher', e.target.value) }))
    )
  ];
}

// ── กลุ่มที่ 2: การเช็คชื่อ ─────────────────────────────────

function secAtt() {
  const ratio = String(cfg('att_mode', 'ratio')) !== 'deduct';
  const w = num('w_att1') || 5;
  return [
    h('div', { class: 'card' },
      h('div', { style: { fontSize: '17px', fontWeight: '700', marginBottom: '4px' } }, 'การเช็คชื่อ'),
      row('วิธีคิดคะแนนเข้าเรียน',
        h('span', null,
          h('b', null, 'ตามสัดส่วน'), ` ${w} × (มา ${cfg('att_w_มา', 1)} · สาย ${cfg('att_w_สาย', 0.5)} · ลา ${cfg('att_w_ลา', 1)} · ขาด 0) ÷ คาบที่เช็ค`,
          h('br'),
          h('b', null, 'หักรายครั้ง'), ` ${w} − (สาย×${cfg('att_d_สาย', 0.25)} + ขาด×${cfg('att_d_ขาด', 0.5)})`),
        segInput('att_mode', [['ratio', 'ตามสัดส่วน'], ['deduct', 'หักรายครั้ง']])),
      row('เกณฑ์เวลาเรียนขั้นต่ำ (มส)', 'ต่ำกว่านี้ระบบติดธง "มส" ให้อัตโนมัติ',
        numInput('att_min_pct', { suffix: '%' })),
      row('นับ "ลา" เป็นเวลาเรียน', 'ผลต่อการคิด % เวลาเรียน ไม่ใช่คะแนน',
        segInput('att_count_ลา', [['TRUE', 'นับ'], ['FALSE', 'ไม่นับ']]))
    ),

    h('div', { class: 'card' },
      h('div', { style: { fontSize: '17px', fontWeight: '700', marginBottom: '4px' } },
        ratio ? 'น้ำหนักของโหมดสัดส่วน' : 'คะแนนที่หักของโหมดหักรายครั้ง'),
      ratio
        ? [row('น้ำหนักเมื่อ "สาย"', 'มา = 1 เสมอ', numInput('att_w_สาย', { step: '0.1' })),
           row('น้ำหนักเมื่อ "ลา"', 'ลาป่วย/ลากิจที่ครูอนุญาต', numInput('att_w_ลา', { step: '0.1' }))]
        : [row('หักต่อการสาย 1 คาบ', null, numInput('att_d_สาย', { step: '0.05' })),
           row('หักต่อการขาด 1 คาบ', null, numInput('att_d_ขาด', { step: '0.05' }))]
    )
  ];
}

// ── กลุ่มที่ 3: บัญชีและการเชื่อมต่อ ────────────────────────

function secAcct() {
  const p = auth.profile || state.user || api.serverInfo.user;
  const pending = api.queue.size;

  return [
    h('div', { class: 'card' },
      h('div', { style: { fontSize: '17px', fontWeight: '700', marginBottom: '12px' } }, 'บัญชีที่ใช้อยู่'),
      p
        ? h('div', { style: { display: 'flex', alignItems: 'center', gap: '11px', marginBottom: '12px' } },
            p.picture
              ? h('img', { src: p.picture, alt: '', style: { width: '40px', height: '40px', borderRadius: '50%' } })
              : h('div', { class: 'class-avatar' }, (p.name || '?')[0]),
            h('div', { style: { flex: '1', minWidth: '0' } },
              h('div', { style: { fontWeight: '700', overflow: 'hidden', textOverflow: 'ellipsis' } }, p.name),
              h('div', { style: { fontSize: '12.5px', color: 'var(--ink-2)', wordBreak: 'break-all' } }, p.email)),
            h('span', { class: 'badge g' }, 'เชื่อมแล้ว'))
        : h('div', { style: { fontSize: '13px', color: 'var(--ink-2)', marginBottom: '10px' } },
            api.conn.method === 'key'
              ? 'ตอนนี้เชื่อมด้วยรหัสลับ — เปลี่ยนไปใช้บัญชี Google จะย้ายเครื่องได้ง่ายกว่า'
              : 'ยังไม่ได้เข้าสู่ระบบ'),

      api.MODE === 'embedded' && h('div',
        { style: { fontSize: '12.5px', color: 'var(--ink-2)', marginBottom: '10px', lineHeight: '1.6' } },
        'Google เป็นคนตรวจสอบให้ก่อนเปิดหน้านี้ ไม่ต้องใช้รหัสผ่านของแอป', h('br'),
        'อยากสลับบัญชี → ออกจากบัญชี Google ในเบราว์เซอร์ แล้วเปิดลิงก์แอปใหม่'),

      h('div', { class: 'btn-row' },
        h('button', { class: 'btn btn-soft btn-sm', onclick: showTransfer },
          api.MODE === 'embedded' ? '🔗 ลิงก์เปิดแอป' : '📱 ย้ายไปเครื่องอื่น'),
        state.installPrompt && h('button', {
          class: 'btn btn-sm',
          onclick: async () => {
            const e = state.installPrompt;
            state.installPrompt = null;
            e.prompt(); await e.userChoice;
          }
        }, '⬇️ ติดตั้งเป็นแอป'),
        p && api.MODE === 'remote' && h('button', {
          class: 'btn btn-ghost btn-sm',
          onclick: async () => {
            if (!await confirmBox('ออกจากระบบ?', 'ข้อมูลที่ยังไม่ได้ซิงค์จะยังอยู่ในเครื่อง', 'ออกจากระบบ')) return;
            await sync();
            auth.signOut(); location.reload();
          }
        }, 'ออกจากระบบ'))
    ),

    h('div', { class: 'card' },
      h('div', { style: { fontSize: '17px', fontWeight: '700', marginBottom: '12px' } }, 'การเชื่อมต่อกับชีต'),
      api.MODE === 'remote' && h('div',
        { style: { fontSize: '12.5px', color: 'var(--ink-2)', wordBreak: 'break-all', marginBottom: '10px' } },
        h('b', null, 'Web App: '), api.conn.url || '—'),
      h('div', { style: { fontSize: '13px', marginBottom: '12px' } },
        navigator.onLine ? h('span', { class: 'badge g' }, 'ออนไลน์') : h('span', { class: 'badge a' }, 'ออฟไลน์'),
        ' ',
        pending > 0 ? h('span', { class: 'badge a' }, `มีข้อมูลค้างส่ง ${pending} รายการ`)
                    : h('span', { class: 'badge g' }, 'ข้อมูลตรงกันแล้ว')),
      h('div', { class: 'btn-row' },
        h('button', { class: 'btn btn-soft btn-sm', onclick: () => sync({ loud: true }) }, '⟳ ซิงค์เดี๋ยวนี้'),
        api.MODE === 'remote' && h('button', {
          class: 'btn btn-danger btn-sm',
          onclick: async () => {
            if (!await confirmBox('ตัดการเชื่อมต่อ?', 'ต้องกรอก URL และรหัสลับใหม่อีกครั้ง', 'ตัดการเชื่อมต่อ')) return;
            api.conn.clear(); api.cache.clearAll(); location.reload();
          }
        }, 'ตัดการเชื่อมต่อ'))
    ),

    h('div', { class: 'card' },
      h('div', { style: { fontSize: '17px', fontWeight: '700', marginBottom: '6px' } }, 'หน้าให้นักเรียนดูผล'),
      h('div', { style: { fontSize: '13px', color: 'var(--ink-2)', marginBottom: '10px', lineHeight: '1.6' } },
        'นักเรียนกรอกเลขประจำตัวแล้วเห็นงาน คะแนน และการมาเรียนของตัวเอง', h('br'),
        'ดูได้อย่างเดียว แก้อะไรไม่ได้ และเห็นเฉพาะข้อมูลของตัวเอง'),
      row('เปิดหน้าให้นักเรียนดู', 'ปิดแล้วลิงก์ของนักเรียนจะใช้ไม่ได้ทันที',
        segInput('student_portal', [['on', 'เปิด'], ['off', 'ปิด']])),
      h('div', { class: 'btn-row', style: { marginTop: '12px' } },
        h('button', { class: 'btn btn-soft btn-sm', onclick: showStudentLink }, '🎒 ลิงก์สำหรับนักเรียน'),
        h('button', { class: 'btn btn-ghost btn-sm', onclick: showStudentHowTo }, '❓ ต้อง Deploy เพิ่มยังไง'))
    )
  ];
}

// ── กลุ่มที่ 4: ข้อมูลและการสำรอง ───────────────────────────

function secData() {
  const pending = api.queue.size;
  return [
    h('div', { class: 'card' },
      h('div', { style: { fontSize: '17px', fontWeight: '700', marginBottom: '6px' } }, 'ข้อมูลและการสำรอง'),
      h('div', { style: { fontSize: '12.5px', color: 'var(--ink-2)', marginBottom: '12px', lineHeight: '1.6' } },
        'ต้นฉบับของข้อมูลอยู่ใน Google Sheet ของคุณเสมอ — เครื่องนี้เก็บแค่สำเนาไว้ใช้ตอนไม่มีเน็ต'),
      row('ข้อมูลค้างส่ง',
        pending > 0 ? 'จะส่งให้เองเมื่อมีเน็ต หรือกดซิงค์เดี๋ยวนี้ก็ได้' : 'ส่งครบแล้ว ไม่มีอะไรค้าง',
        h('span', { class: pending > 0 ? 'badge a' : 'badge g' },
          pending > 0 ? `${pending} รายการ` : 'ครบแล้ว'), pending > 0),
      row('โหลดข้อมูลใหม่จากชีต', 'ใช้เมื่อไปแก้ในชีตโดยตรงแล้วอยากให้แอปเห็น',
        h('button', {
          class: 'btn btn-ghost btn-sm',
          onclick: async () => { await bootAll(); toast('โหลดใหม่แล้ว', 'ok'); }
        }, '↓ โหลดใหม่')),
      row('ล้างสำเนาในเครื่อง', 'ไม่กระทบข้อมูลในชีต แต่ต้องต่อเน็ตเพื่อโหลดใหม่',
        h('button', {
          class: 'btn btn-ghost btn-sm',
          onclick: async () => {
            if (pending > 0 && !await confirmBox('ยังมีข้อมูลค้างส่ง',
              `มี ${pending} รายการที่ยังไม่ได้บันทึกลง Google Sheet ถ้าล้างแคชตอนนี้ข้อมูลจะหาย`, 'ล้างทิ้ง')) return;
            api.cache.clearAll(); api.queue.clear();
            toast('ล้างแคชแล้ว'); location.reload();
          }
        }, '🧹 ล้างแคช'))
    )
  ];
}

// ── กลุ่มที่ 5: เกี่ยวกับระบบ ───────────────────────────────

function secAbout() {
  return [
    h('div', { class: 'card' },
      h('div', { style: { fontSize: '17px', fontWeight: '700', marginBottom: '6px' } }, 'เกี่ยวกับระบบ'),
      row('ธีม', '"ตามเครื่อง" จะสลับเป็นโหมดมืดเองตามการตั้งค่าของโทรศัพท์',
        h('div', { class: 'seg seg-inline' },
          THEMES.map(t => h('button', {
            'data-on': getTheme() === t.id ? '1' : '0',
            onclick: () => { setTheme(t.id); emit(); }
          }, icon(t.ic, 'ico ico-sm'), t.label)))),
      row('เวอร์ชันโค้ดในชีต',
        api.serverInfo.seen ? 'อ่านจากคำตอบล่าสุดของเซิร์ฟเวอร์' : 'ยังไม่เคยได้รับคำตอบจากเซิร์ฟเวอร์',
        h('span', { class: 'badge n' }, api.serverInfo.version ? 'v' + api.serverInfo.version : '—')),
      row('ตรวจสอบระบบ', 'ดูว่าตอนนี้พร้อมใช้แค่ไหน และเหลืออะไรต้องทำ',
        h('button', { class: 'btn btn-soft btn-sm', onclick: () => go('health') }, '🩺 เปิดหน้าตรวจสอบ'))
    ),
    h('div', { style: { textAlign: 'center', color: 'var(--ink-3)', fontSize: '12px', padding: '16px 0 6px' } },
      'AssignCheck V2 · ข้อมูลทั้งหมดอยู่ใน Google Sheet ของคุณเอง')
  ];
}

const BUILD = { score: secScore, att: secAtt, acct: secAcct, data: secData, about: secAbout };

/** คำอธิบายสั้น ๆ ใต้ชื่อกลุ่มในรายการของมือถือ */
function summaryOf(id) {
  const pending = api.queue.size;
  switch (id) {
    case 'score': return { t: `งานค้างตรวจ · หักส่งช้า ${num('late_penalty_pct')}% · ปัดเศษ`, c: null };
    case 'att':   return { t: `${String(cfg('att_mode', 'ratio')) === 'deduct' ? 'หักรายครั้ง' : 'ตามสัดส่วน'} · เกณฑ์ มส ${num('att_min_pct')}%`, c: null };
    case 'acct': {
      const p = auth.profile || state.user || api.serverInfo.user;
      return p ? { t: 'เชื่อมแล้ว · ' + p.email, c: 'var(--st-ok)' } : { t: 'ยังไม่ได้เข้าสู่ระบบ', c: 'var(--st-late)' };
    }
    case 'data':  return pending > 0
      ? { t: `ค้างส่ง ${pending} รายการ`, c: 'var(--st-late)' }
      : { t: 'ข้อมูลตรงกันแล้ว', c: null };
    default:      return { t: `โค้ดในชีต ${api.serverInfo.version ? 'v' + api.serverInfo.version : '—'}`, c: null };
  }
}

// ── ตัวหน้า ─────────────────────────────────────────────────

/** แถบหัวสีเข้ม (มือถือ) — มีปุ่มย้อนกลับเมื่ออยู่ในกลุ่มใดกลุ่มหนึ่ง */
viewSettings.head = function () {
  const inSec = !!ui.sec;
  return h('header', { class: 'pagehead' },
    h('div', { class: 'ph-row' },
      h('button', {
        class: 'ph-back', 'aria-label': 'กลับ',
        onclick: () => { if (inSec) { ui.sec = null; emit(); } else go('home'); }
      }, '‹'),
      h('div', { class: 'ph-grow' },
        h('div', { class: 'ph-title' }, inSec ? SECTIONS.find(s => s.id === ui.sec).label : 'ตั้งค่า'),
        h('div', { class: 'ph-sub', 'data-savedat': '1' },
          ui.savedAt ? 'ล่าสุด ' + ui.savedAt + ' น.' : 'บันทึกอัตโนมัติทุกครั้งที่แก้')))
  );
};

function viewSettings() {
  const wide = (() => { try { return matchMedia('(min-width: 900px)').matches; } catch (e) { return false; } })();
  const sec = ui.sec || (wide ? 'score' : null);

  // มือถือ + ยังไม่ได้เลือกกลุ่ม → หน้าสรุปตามดีไซน์ 06 มือถือ
  if (!wide && !sec) return mobileIndex();

  return h('div', { class: 'page' },
    h('div', { class: 'set-layout' },
      h('div', { class: 'set-nav' },
        SECTIONS.map(s => h('button', {
          'data-on': sec === s.id ? '1' : '0',
          onclick: () => { ui.sec = s.id; emit(); }
        }, s.label)),
        h('div', { class: 'set-note' },
          'แก้แล้วบันทึกอัตโนมัติ',
          h('br'),
          h('span', { 'data-savedat': '1', style: { color: 'var(--ink-2)' } },
            ui.savedAt ? 'ล่าสุด ' + ui.savedAt + ' น.' : 'ยังไม่ได้แก้อะไร'))),
      h('div', null, BUILD[sec]())
    )
  );
}

/** หน้าสรุปของมือถือ — การ์ดน้ำหนักคะแนน + เตือน + รายการ 5 กลุ่ม */
function mobileIndex() {
  const sum = weightSum();
  return h('div', { class: 'page' },

    h('div', { class: 'card' },
      h('div', { style: { display: 'flex', alignItems: 'baseline', gap: '8px' } },
        h('div', { style: { flex: '1', fontSize: '14.5px', fontWeight: '700' } }, 'น้ำหนักคะแนน'),
        h('div', { class: sum === 100 ? 'set-ok' : 'set-bad' },
          sum === 100 ? 'รวม 100 ✓' : `รวม ${sum} ✕`)),
      h('div', { class: 'weightbar', style: { height: '10px', margin: '10px 0' } },
        WEIGHTS.map(w => num(w.k) > 0 &&
          h('i', { style: { width: (num(w.k) / Math.max(sum, 1) * 100) + '%', background: w.c } }))),
      h('button', {
        class: 'todo-row', style: { padding: '0' },
        onclick: () => { ui.sec = 'score'; emit(); }
      },
        h('span', { style: { fontSize: '13px', color: 'var(--ink-2)' } },
          `ส่งงาน ${num('w_work1') + num('w_work2')} · สอบเก็บ ${num('w_quiz1') + num('w_quiz2')} · เข้าเรียน ${num('w_att1') + num('w_att2')} · สอบ ${num('w_mid') + num('w_fin')}`),
        h('b', null, 'แก้ ›'))
    ),

    !midSet() && h('button', {
      class: 'card',
      style: { background: 'var(--miss-soft)', display: 'flex', alignItems: 'center', gap: '10px', width: '100%', textAlign: 'left' },
      onclick: () => { ui.sec = 'score'; emit(); }
    },
      h('div', { style: { flex: '1' } },
        h('div', { class: 'set-name' }, 'ยังไม่ได้ตั้งวันสอบกลางภาค'),
        h('div', { style: { fontSize: '12.5px', color: 'var(--st-miss)', marginTop: '2px' } }, 'คะแนนอาจลงผิดช่วง')),
      h('span', {
        style: { padding: '9px 14px', borderRadius: '11px', background: 'var(--st-miss)', color: 'var(--on-miss)', fontSize: '13px', fontWeight: '600' }
      }, 'ตั้งเลย')),

    h('div', { class: 'card card-tight' },
      SECTIONS.map(s => {
        const sm = summaryOf(s.id);
        return h('button', {
          class: 'list-row',
          onclick: () => { ui.sec = s.id; emit(); }
        },
          h('div', { class: 'list-main' },
            h('div', { class: 'list-title' }, s.label),
            h('div', { class: 'list-sub', style: sm.c ? { color: sm.c } : null }, sm.t)),
          h('span', { class: 'list-chevron' }, '›'));
      })),

    h('div', { class: 'card' },
      row('ธีม', 'ตามเครื่อง / สว่าง / มืด',
        h('div', { class: 'seg seg-inline' },
          THEMES.map(t => h('button', {
            'data-on': getTheme() === t.id ? '1' : '0',
            onclick: () => { setTheme(t.id); emit(); }
          }, icon(t.ic, 'ico ico-sm'), t.label))))),

    h('div', { class: 'btn-row' },
      state.installPrompt && h('button', {
        class: 'btn btn-ghost btn-sm', style: { flex: '1' },
        onclick: async () => {
          const e = state.installPrompt;
          state.installPrompt = null;
          e.prompt(); await e.userChoice;
        }
      }, '⬇️ ติดตั้งเป็นแอป'),
      h('button', { class: 'btn btn-ghost btn-sm', style: { flex: '1' }, onclick: showTransfer },
        api.MODE === 'embedded' ? '🔗 ลิงก์เปิดแอป' : '📱 ย้ายไปเครื่องอื่น'))
  );
}

/** ลิงก์หน้าดูผลของนักเรียน — ต้องมาจาก Deployment ที่ตั้งเป็น "Anyone" */
function showStudentLink() {
  const base = state.webAppUrl || api.conn.url || '';
  if (!base) return toast('ยังอ่านลิงก์ไม่ได้ — กด ⟳ ซิงค์ก่อนแล้วลองใหม่', 'err');
  const link = base + (base.includes('?') ? '&' : '?') + 'page=student';

  modal((close) => h('div', null,
    h('h2', null, '🎒 ลิงก์สำหรับนักเรียน'),
    h('div', { class: 'hint', style: { marginBottom: '10px' } },
      'แปะไว้ในกลุ่มไลน์ห้อง หรือทำเป็น QR ติดหน้าห้องก็ได้'),
    h('textarea', {
      rows: 4, value: link, readonly: true,
      style: { fontFamily: 'ui-monospace, monospace', fontSize: '11.5px' },
      onclick: (e) => e.target.select()
    }),
    h('div', { style: { height: '10px' } }),
    h('button', {
      class: 'btn btn-block',
      onclick: async () => {
        try { await navigator.clipboard.writeText(link); toast('คัดลอกลิงก์แล้ว', 'ok'); close(); }
        catch { toast('กดค้างที่ข้อความเพื่อคัดลอก'); }
      }
    }, 'คัดลอกลิงก์'),
    h('div', {
      class: 'hint',
      style: { marginTop: '10px', background: 'var(--amber-soft)', color: 'var(--warn-ink)', padding: '10px 12px', borderRadius: '10px' }
    },
      '⚠️ ลิงก์นี้จะใช้ได้ก็ต่อเมื่อสร้าง Deployment ตัวที่ 2 แบบ "Anyone" แล้วเท่านั้น',
      h('br'), 'ถ้าใช้ลิงก์ของครู นักเรียนจะโดน Google ขอให้ล็อกอินแล้วเข้าไม่ได้ — กดปุ่ม "ต้อง Deploy เพิ่มยังไง" ดูขั้นตอน')
  ));
}

function showStudentHowTo() {
  const step = (n, title, body) => h('div', { style: { display: 'flex', gap: '11px', marginBottom: '14px' } },
    h('div', {
      style: {
        width: '26px', height: '26px', borderRadius: '50%', flex: 'none',
        background: 'var(--accent)', color: 'var(--on-accent)',
        display: 'grid', placeContent: 'center', fontSize: '13px', fontWeight: '700'
      }
    }, String(n)),
    h('div', { style: { flex: '1' } },
      h('div', { style: { fontWeight: '600', fontSize: '14px' } }, title),
      h('div', { style: { fontSize: '12.5px', color: 'var(--ink-2)', lineHeight: '1.6' } }, body)));

  modal((close) => h('div', null,
    h('h2', null, 'สร้างลิงก์ให้นักเรียน'),
    h('div', { class: 'hint', style: { marginBottom: '14px' } },
      'ทำครั้งเดียวจบ — ลิงก์ของครูกับของนักเรียนต้องแยกกัน เพราะสิทธิ์เข้าถึงต่างกัน'),
    step(1, 'เปิด Apps Script', 'ในชีต → ส่วนขยาย → Apps Script'),
    step(2, 'Deploy → New deployment', 'เลือกชนิด Web app (อย่ากดแก้ตัวเดิม — ต้องสร้าง "ตัวใหม่")'),
    step(3, 'ตั้งค่า 2 ช่อง', 'Execute as: Me · Who has access: Anyone (ไม่ใช่ "Anyone with a Google account")'),
    step(4, 'คัดลอก URL ที่ได้', 'จะเป็นคนละลิงก์กับของครู — เก็บไว้ใช้กับนักเรียน'),
    step(5, 'ต่อท้ายด้วย ?page=student', 'เช่น https://script.google.com/.../exec?page=student'),
    h('div', {
      style: { background: 'var(--accent-soft)', color: 'var(--accent-ink)', padding: '11px 13px', borderRadius: '10px', fontSize: '12.5px', lineHeight: '1.6' }
    },
      'ลิงก์ของครูยังใช้เหมือนเดิมทุกอย่าง คนที่ไม่ใช่ครูเปิดลิงก์นักเรียนได้แค่หน้าดูผล ',
      'กรอกเลขประจำตัวถูกถึงจะเห็น และเห็นทีละคนเท่านั้น'),
    h('div', { style: { height: '12px' } }),
    h('button', { class: 'btn btn-block', onclick: close }, 'เข้าใจแล้ว')
  ));
}

/** ลิงก์สำหรับเปิดแอปบนเครื่องอื่น */
function showTransfer() {
  const embedded = api.MODE === 'embedded';
  const link = embedded ? (state.webAppUrl || '') : api.conn.transferLink();

  if (embedded && !link) {
    return toast('ยังอ่านลิงก์ไม่ได้ — กด ⟳ ซิงค์ก่อนแล้วลองใหม่', 'err');
  }

  modal((close) => h('div', null,
    h('h2', null, embedded ? '🔗 ลิงก์เปิดแอป' : '📱 ย้ายไปใช้บนเครื่องอื่น'),
    h('div', { class: 'hint', style: { marginBottom: '10px' } },
      embedded
        ? 'เปิดลิงก์นี้บนมือถือหรือเครื่องอื่นได้เลย — Google จะให้ล็อกอินก่อน แล้วเข้าใช้ได้ทันที'
        : 'ส่งลิงก์นี้ไปเปิดบนเครื่องใหม่ (ไลน์หาตัวเอง / อีเมล) แล้วระบบจะตั้งค่าให้อัตโนมัติ'),
    h('textarea', {
      rows: 4, value: link, readonly: true,
      style: { fontFamily: 'ui-monospace, monospace', fontSize: '11.5px' },
      onclick: (e) => e.target.select()
    }),
    h('div', { style: { height: '10px' } }),
    h('button', {
      class: 'btn btn-block',
      onclick: async () => {
        try { await navigator.clipboard.writeText(link); toast('คัดลอกลิงก์แล้ว', 'ok'); close(); }
        catch { toast('กดค้างที่ข้อความเพื่อคัดลอก'); }
      }
    }, 'คัดลอกลิงก์'),
    h('div', { class: 'hint', style: { marginTop: '10px' } },
      embedded
        ? '💡 บนมือถือ เปิดลิงก์แล้วกด "เพิ่มลงในหน้าจอหลัก" จะเปิดได้เหมือนแอป'
        : '⚠️ ลิงก์นี้มีสิทธิ์เข้าถึงข้อมูลทั้งหมด อย่าส่งให้คนอื่นหรือโพสต์สาธารณะ')
  ));
}

__exp(exports, { viewSettings });

  };

  __defs["js/views/health.js"] = function (exports, __req) {
/* หน้า "ตรวจสอบระบบ" — บอกว่าตอนนี้พร้อมใช้แค่ไหน และเหลืออะไรต้องทำ
 *
 * ทุกข้อที่ไม่ผ่านต้องบอก 3 อย่างเสมอ: เกิดอะไรขึ้น · กระทบอะไร · แก้ยังไง
 */

const { h, toast, modal } = __req("js/dom.js");
const { state, emit, go, settings, sync } = __req("js/state.js");
const api = __req("js/api.js");
const { auth } = __req("js/auth.js");
const { APP_VERSION, NEEDS_SERVER, cmpVersion, FEATURES } = __req("js/version.js");
const { badCuts } = __req("js/score.js");

/** ข้อความสรุปหัวหน้า — ใช้ทั้งแถบเข้ม (มือถือ) และแถบบริบท (PC) */
function summary(items) {
  const bad = items.filter(i => i.level === 'err').length;
  const warn = items.filter(i => i.level === 'warn').length;
  if (bad) return { tone: 'bad', title: `ต้องแก้ ${bad} เรื่อง`, sub: 'ทำตามรายการด้านล่างจากบนลงล่าง' };
  if (warn) return { tone: 'warn', title: `ใช้ได้ · ควรตั้งอีก ${warn} เรื่อง`, sub: 'ไม่เร่ง แต่ตั้งไว้แล้วคะแนนจะแม่นขึ้น' };
  return { tone: 'ok', title: 'พร้อมใช้งานครบทุกอย่าง', sub: 'ระบบตรวจตัวเองทุกครั้งที่เปิดหน้านี้' };
}

/** แถบหัวสีเข้ม (มือถือ) */
viewHealth.head = function () {
  const s = summary(runChecks());
  return h('header', { class: 'pagehead' },
    h('div', { class: 'ph-row' },
      h('button', { class: 'ph-back', 'aria-label': 'กลับ', onclick: () => go('settings') }, '‹'),
      h('div', { class: 'ph-grow' },
        h('div', { class: 'ph-title' }, 'ตรวจสอบระบบ'),
        h('div', { class: 'ph-sub' }, s.title)))
  );
};

const GROUPS = [
  { level: 'err',  label: 'ต้องแก้ก่อน' },
  { level: 'warn', label: 'ควรตั้งค่าเพิ่ม' },
  { level: 'ok',   label: 'ผ่านแล้ว' }
];

function viewHealth() {
  const items = runChecks();
  const s = summary(items);

  return h('div', { class: 'page', style: { maxWidth: '720px' } },

    h('div', { class: 'ctxbar' },
      h('div', { style: { flex: '1', minWidth: '0' } },
        h('div', { class: 'ctx-title' }, 'ตรวจสอบระบบ'),
        h('div', { class: 'ctx-sub' }, s.sub)),
      h('span', { class: 'badge ' + { bad: 'r', warn: 'a', ok: 'g' }[s.tone] }, s.title)),

    // มือถือ: แถบเข้มบอกหัวข้อแล้ว เหลือแค่คำอธิบายสั้น ๆ
    h('div', { class: 'hint pc-hide', style: { margin: '0 2px 12px' } }, s.sub),

    GROUPS.map(g => {
      const list = items.filter(i => i.level === g.level);
      if (!list.length) return null;
      return h('div', { style: { marginBottom: '14px' } },
        h('div', { class: 'section-title' }, `${g.label} · ${list.length}`),
        h('div', { class: 'card card-tight' }, list.map(checkRow)));
    }),

    h('div', { style: { textAlign: 'center', color: 'var(--ink-3)', fontSize: '11.5px', padding: '6px 0 14px' } },
      `หน้าเว็บ v${APP_VERSION} · โค้ดในชีต v${api.serverInfo.version || 'ไม่ทราบ'}`)
  );
}

function checkRow(c) {
  return h('div', { class: 'check-row', 'data-level': c.level },
    h('span', { class: 'check-dot' }),
    h('div', { style: { flex: '1', minWidth: '0' } },
      h('div', { class: 'check-title' }, c.title),
      h('div', { class: 'check-sub' }, c.detail),
      c.fix && h('div', { class: 'check-fix' }, c.fix),
      // ปุ่มในหน้านี้ไม่ใช้สีไลม์ — ไลม์สงวนไว้ให้ปุ่มหลักหนึ่งเดียวของแต่ละหน้า
      c.action && h('button', {
        class: 'btn btn-soft btn-sm', style: { marginTop: '9px' },
        onclick: c.action.run
      }, c.action.label))
  );
}

// ── รายการตรวจ ──────────────────────────────────────────────

function runChecks() {
  const out = [];
  const S = settings();
  const sv = api.serverInfo.version;

  const embedded = api.MODE === 'embedded';

  // 1) การเชื่อมต่อ
  if (embedded) {
    out.push({
      level: 'ok', title: 'Apps Script เสิร์ฟหน้าเว็บเอง',
      detail: 'ไม่ต้องตั้ง URL ไม่ต้องมีรหัสลับ ไม่ต้องเปิดคอมค้าง'
    });
  } else if (!api.conn.url) {
    out.push({ level: 'err', title: 'ยังไม่ได้เชื่อมกับ Google Sheet', detail: 'แอปยังไม่รู้ว่าจะเก็บข้อมูลที่ไหน',
      fix: 'ตั้งค่า → ตัดการเชื่อมต่อ แล้วใส่ URL ใหม่' });
  } else if (!api.serverInfo.seen) {
    out.push({ level: 'warn', title: 'ยังไม่ได้คุยกับชีตในรอบนี้', detail: 'อาจออฟไลน์อยู่ หรือ URL เปลี่ยน',
      fix: 'กดปุ่มด้านล่างเพื่อทดสอบ',
      action: { label: 'ทดสอบการเชื่อมต่อ', run: testConn } });
  } else {
    out.push({ level: 'ok', title: 'เชื่อมกับ Google Sheet ได้', detail: shortUrl(api.conn.url) });
  }

  // 2) เวอร์ชันโค้ดในชีต — สาเหตุอันดับ 1 ของอาการ "กรอกแล้วคะแนนเพี้ยน"
  if (api.serverInfo.seen) {
    const cmp = cmpVersion(sv, NEEDS_SERVER);
    if (!sv) {
      out.push({
        level: 'err', title: 'โค้ดในชีตเป็นเวอร์ชันเก่า (ก่อน 2.2)',
        detail: 'ชีตยังไม่รายงานเวอร์ชันกลับมา แปลว่ายังไม่ได้วางโค้ดใหม่หรือยังไม่ได้ Deploy',
        fix: 'วางไฟล์ ALL-IN-ONE.gs ทับ → Deploy → Manage deployments → ✏️ → New version',
        action: { label: 'ดูวิธีทีละขั้น', run: showUpdateSteps }
      });
    } else if (cmp < 0) {
      const missing = FEATURES.filter(f => cmpVersion(sv, f.since) < 0);
      out.push({
        level: 'err', title: `โค้ดในชีตเก่ากว่าหน้าเว็บ (v${sv} < v${NEEDS_SERVER})`,
        detail: 'ฟีเจอร์ที่จะเพี้ยน: ' + (missing.map(f => f.name).join(' · ') || '—'),
        fix: 'Deploy โค้ดใหม่ก่อนใช้ฟีเจอร์เหล่านี้',
        action: { label: 'ดูวิธีทีละขั้น', run: showUpdateSteps }
      });
    } else if (cmp > 0) {
      out.push({ level: 'warn', title: `โค้ดในชีตใหม่กว่าหน้าเว็บ (v${sv})`, detail: 'หน้าเว็บอาจยังไม่รองรับของใหม่',
        fix: 'รีเฟรชหน้าเว็บ (Ctrl+Shift+R)' });
    } else {
      out.push({ level: 'ok', title: `โค้ดในชีตตรงกับหน้าเว็บ (v${sv})`, detail: 'ทุกฟีเจอร์ทำงานครบ' });
    }
  }

  // 3) วิธียืนยันตัวตน
  if (embedded) {
    const email = state.user?.email || api.serverInfo.user?.email;
    out.push({
      level: email ? 'ok' : 'warn',
      title: email ? `เข้าสู่ระบบเป็น ${email}` : 'ยังอ่านบัญชีผู้ใช้ไม่ได้',
      detail: email
        ? 'Google ตรวจให้ก่อนเข้าหน้าเว็บ ไม่ต้องใช้รหัสผ่านของแอป — เปลี่ยนเครื่องได้ทันที'
        : 'ปกติจะขึ้นหลังโหลดข้อมูลเสร็จ ถ้าไม่ขึ้นให้ตรวจว่า Deploy ตั้งเป็น "Anyone with a Google account"',
      action: email ? null : { label: 'ทดสอบการเชื่อมต่อ', run: testConn }
    });
  } else if (auth.signedIn) {
    out.push({ level: 'ok', title: 'เข้าสู่ระบบด้วยบัญชี Google', detail: auth.profile?.email || '',
      fix: null });
  } else if (api.conn.key) {
    out.push({
      level: 'warn', title: 'ยังใช้รหัสลับอยู่',
      detail: 'ใช้งานได้ปกติ แต่ย้ายเครื่องต้องพิมพ์รหัสใหม่ทุกครั้ง',
      fix: 'ถ้าจะใช้หลายเครื่อง แนะนำเปิดล็อกอิน Google (ตั้งค่า oauth_client_id ในชีต)',
      action: { label: '📱 คัดลอกลิงก์ย้ายเครื่อง', run: copyTransfer }
    });
  } else {
    out.push({ level: 'err', title: 'ยังไม่ได้ยืนยันตัวตน', detail: 'ยังบันทึกข้อมูลไม่ได้', fix: 'เชื่อมต่อใหม่ในหน้าตั้งค่า' });
  }

  // 4) ห้องเรียน
  if (!state.classes.length) {
    out.push({ level: 'err', title: 'ยังไม่มีห้องเรียน', detail: 'ต้องมีอย่างน้อย 1 ห้องถึงจะเช็คชื่อได้',
      fix: 'หน้าแรก → + เพิ่มห้อง',
      action: { label: 'ไปหน้าแรก', run: () => go('home') } });
  } else {
    const empty = state.classes.filter(c => !c.studentCount).length;
    out.push({
      level: empty ? 'warn' : 'ok',
      title: `มี ${state.classes.length} ห้อง-วิชา`,
      detail: empty ? `${empty} ห้องยังไม่มีรายชื่อนักเรียน` : 'มีรายชื่อนักเรียนครบทุกห้อง',
      fix: empty ? 'หน้าแรก → ⋯ → จัดการรายชื่อนักเรียน' : null
    });
  }

  // 5) วันสอบกลางภาค
  const mid = String(state.config.mid_date || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(mid)) {
    out.push({
      level: 'warn', title: 'ยังไม่ได้ตั้งวันสอบกลางภาค',
      detail: 'ตอนนี้ระบบเดาว่าทุกวันอยู่ "ก่อนกลางภาค" — พอเลยกลางภาคไปแล้วคะแนนจะลงผิดช่อง',
      fix: 'ตั้งครั้งเดียวจบ ใช้ได้ทั้งเทอม',
      action: { label: '⚙️ ไปตั้งค่า', run: () => go('settings') }
    });
  } else {
    out.push({ level: 'ok', title: 'ตั้งวันสอบกลางภาคแล้ว', detail: mid + ' — ระบบแยกช่วงให้อัตโนมัติ' });
  }

  // 6) น้ำหนักคะแนนรวม 100
  const sum = ['work1', 'quiz1', 'att1', 'mid', 'work2', 'quiz2', 'att2', 'fin']
    .reduce((a, k) => a + (S.weight[k] || 0), 0);
  out.push(sum === 100
    ? { level: 'ok', title: 'น้ำหนักคะแนนรวม 100 พอดี', detail: '10+10+5+20 · 10+10+5+30' }
    : { level: 'err', title: `น้ำหนักคะแนนรวม ${sum} ไม่เท่ากับ 100`, detail: 'คะแนนที่กรอกลง SGS จะไม่ตรง',
        fix: 'ตั้งค่า → น้ำหนักคะแนน', action: { label: '⚙️ ไปแก้', run: () => go('settings') } });

  // 7) เกณฑ์เกรดเขียนถูกรูปแบบไหม
  const cutErr = badCuts(state.config.grade_cuts);
  if (cutErr.length) {
    out.push({
      level: 'err',
      title: `เกณฑ์เกรดเขียนผิดรูปแบบ ${cutErr.length} ช่วง`,
      detail: `ช่วงที่อ่านไม่ออก: ${cutErr.join(' · ')} — ระบบข้ามช่วงนี้ไป เกรดที่ออกมาจะไม่ตรงกับที่ตั้งใจ`,
      fix: 'เขียนเป็น คะแนน:เกรด คั่นด้วยจุลภาค เช่น 80:4,75:3.5,70:3 (ระวังพิมพ์ตัว O แทนเลข 0)',
      action: { label: '⚙️ ไปแก้', run: () => go('settings') }
    });
  }

  // 8) เก็บข้อมูลลงเครื่องได้ไหม — ถ้าไม่ได้คือเรื่องใหญ่ที่สุดในหน้านี้
  if (!api.storagePersistent()) {
    out.push({
      level: 'err',
      title: 'เบราว์เซอร์ไม่ยอมให้เก็บข้อมูลลงเครื่อง',
      detail: 'ตอนนี้เก็บไว้ในหน่วยความจำแทน — ใช้งานได้ปกติและส่งขึ้นชีตได้ '
            + 'แต่ถ้าปิดแท็บหรือโหลดหน้าใหม่ตอนยังไม่มีเน็ต ของที่ยังไม่ได้ส่งจะหาย',
      fix: 'เปิดแอปจากลิงก์ GitHub Pages โดยตรง (ไม่ผ่าน iframe) หรือเปิดคุกกี้ของบุคคลที่สามให้ google.com · '
         + 'ระหว่างนี้ให้กดซิงค์ก่อนปิดหน้าทุกครั้ง',
      action: api.queue.size ? { label: '⟳ ส่งขึ้นชีตเดี๋ยวนี้', run: () => sync({ loud: true }) } : null
    });
  }

  // 9) งานที่ส่งไม่ผ่านซ้ำ ๆ — ยังอยู่ในคิว แต่ครูควรรู้ว่าไม่ได้ไปถึงชีต
  const stuck = api.queue.stuck();
  if (stuck.length) {
    out.push({
      level: 'err',
      title: `มี ${stuck.length} รายการส่งไม่ผ่านหลายรอบแล้ว`,
      detail: 'ยังเก็บไว้ให้ครบ ไม่ได้หายไปไหน และระบบยังลองส่งใหม่ให้เรื่อย ๆ',
      fix: 'มักเป็นเพราะโค้ดในชีตเป็นเวอร์ชันเก่า หรือห้อง/คอลัมน์ถูกลบไปแล้ว — ตรวจ 2 อย่างนี้ก่อน',
      action: { label: '⟳ ลองส่งอีกครั้ง', run: () => sync({ loud: true }) }
    });
  }

  // 10) ข้อมูลค้างส่ง
  const q = api.queue.size;
  if (q > 0) {
    out.push({
      level: navigator.onLine ? 'warn' : 'ok',
      title: `มีข้อมูลรอส่งขึ้นชีต ${q} รายการ`,
      detail: navigator.onLine ? 'ปกติจะส่งเองภายในไม่กี่วินาที' : 'ออฟไลน์อยู่ — เก็บไว้ในเครื่องแล้ว ปลอดภัย',
      fix: navigator.onLine ? 'ถ้าค้างนาน ให้กดซิงค์เอง' : 'พอมีเน็ตจะส่งให้อัตโนมัติ',
      action: navigator.onLine ? { label: '⟳ ซิงค์เดี๋ยวนี้', run: () => sync({ loud: true }) } : null
    });
  } else {
    out.push({ level: 'ok', title: 'ข้อมูลตรงกับชีตแล้ว', detail: 'ไม่มีอะไรค้างส่ง' });
  }

  // 11) พร้อมใช้ออฟไลน์ / ติดตั้งเป็นแอป
  const standalone = window.matchMedia?.('(display-mode: standalone)').matches;
  if (embedded) {
    out.push({
      level: 'warn', title: 'เปิดแอปตอนไม่มีเน็ตไม่ได้',
      detail: 'ข้อแลกของการให้ Apps Script เสิร์ฟเอง — แต่ถ้าเปิดแอปค้างไว้แล้วสัญญาณหลุด ยังเช็คชื่อต่อได้ ข้อมูลจะส่งเองเมื่อสัญญาณกลับมา',
      fix: 'เปิดแอปตอนเริ่มคาบ แล้วอย่าปิดหน้าจนกว่าจะเช็คเสร็จ'
    });
  } else if (standalone) {
    out.push({ level: 'ok', title: 'ติดตั้งเป็นแอปแล้ว', detail: 'เปิดจากหน้าจอโฮมได้ ใช้ออฟไลน์ได้' });
  } else if (state.installPrompt) {
    out.push({
      level: 'warn', title: 'ยังไม่ได้ติดตั้งเป็นแอป',
      detail: 'ติดตั้งแล้วจะเปิดเร็วขึ้นและใช้ตอนไม่มีเน็ตได้',
      action: { label: '⬇️ ติดตั้งเลย', run: async () => {
        const e = state.installPrompt; state.installPrompt = null;
        e.prompt(); await e.userChoice; emit();
      } }
    });
  } else {
    out.push({
      level: 'ok', title: 'เก็บไฟล์แอปไว้ในเครื่องแล้ว',
      detail: navigator.serviceWorker?.controller ? 'เปิดใช้ได้แม้ไม่มีเน็ต' : 'กำลังเตรียม — รีเฟรชอีกครั้งจะพร้อม'
    });
  }

  // 12) เปิดจากที่ไหน
  if (embedded) {
    out.push({
      level: 'ok', title: 'เปิดได้จากทุกเครื่องด้วยลิงก์เดียว',
      detail: 'มือถือเปิดลิงก์เดิมแล้วกด "เพิ่มลงในหน้าจอหลัก" ได้เลย',
      action: { label: '🔗 ดูลิงก์เปิดแอป', run: () => go('settings') }
    });
  } else if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
    out.push({
      level: 'warn', title: 'ตอนนี้เปิดจากคอมเครื่องนี้เท่านั้น',
      detail: 'มือถือในห้องเรียนจะเปิดไม่ได้ และต้องเปิด เปิดแอป.bat ค้างไว้',
      fix: 'อัปโหลดขึ้น GitHub Pages เพื่อให้ได้ลิงก์ถาวรที่เปิดจากมือถือได้'
    });
  } else {
    out.push({ level: 'ok', title: 'เปิดจากอินเทอร์เน็ตได้', detail: location.origin });
  }

  return out;
}

// ── ตัวช่วย ─────────────────────────────────────────────────

const shortUrl = (u) => u.replace(/^https:\/\/script\.google\.com\/macros\/s\//, '…/').slice(0, 46) + '…';

async function testConn() {
  try {
    await api.call('ping');
    toast('เชื่อมต่อได้ปกติ ✅', 'ok');
  } catch (e) {
    toast(e.message, 'err', 6000);
  }
  emit();
}

async function copyTransfer() {
  try {
    await navigator.clipboard.writeText(api.conn.transferLink());
    toast('คัดลอกลิงก์แล้ว — เปิดลิงก์นี้บนเครื่องใหม่', 'ok', 4000);
  } catch { toast('คัดลอกไม่ได้ ลองที่ ตั้งค่า → ย้ายไปเครื่องอื่น', 'err'); }
}

function showUpdateSteps() {
  modal((close) => h('div', null,
    h('h2', null, '🔄 อัปเดตโค้ดในชีต'),
    h('ol', { style: { paddingLeft: '20px', fontSize: '14px', lineHeight: '2' } },
      h('li', null, 'เปิดชีต → ', h('b', null, 'ส่วนขยาย → Apps Script')),
      h('li', null, 'คลิกในช่องโค้ด กด ', h('b', null, 'Ctrl+A'), ' แล้ววางไฟล์ ',
        h('code', null, 'ALL-IN-ONE.gs'), ' ทับ'),
      h('li', null, 'กด ', h('b', null, 'Ctrl+S'), ' บันทึก'),
      h('li', null, h('b', null, 'Deploy → Manage deployments')),
      h('li', null, 'กดรูปดินสอ ✏️ → ช่อง ', h('b', null, 'Version'), ' เลือก ',
        h('b', null, 'New version'), ' → ', h('b', null, 'Deploy'))
    ),
    h('div', {
      style: { background: 'var(--amber-soft)', padding: '11px', borderRadius: '10px', fontSize: '13px', margin: '4px 0 14px' }
    }, h('b', null, 'ข้อ 5 สำคัญที่สุด'), ' — ถ้าแค่กด Ctrl+S แล้วไม่ Deploy โค้ดใหม่จะยังไม่ถูกใช้งาน'),
    h('button', { class: 'btn btn-block', onclick: async () => { close(); await testConn(); } }, 'ทำเสร็จแล้ว — ตรวจอีกครั้ง')
  ));
}

__exp(exports, { viewHealth });

  };

  __defs["js/version.js"] = function (exports, __req) {
/* เวอร์ชันของแอป — ใช้ตรวจว่าโค้ดในชีตกับหน้าเว็บตรงกันไหม
 *
 * ⚠️ เวลาแก้โค้ดที่กระทบทั้ง 2 ฝั่ง ให้บวกเลขนี้ และแก้ SERVER_VERSION
 *    ใน apps-script/00_Constants.gs ให้ตรงกันด้วย
 */
const APP_VERSION = '3.0.1';

/** เวอร์ชันต่ำสุดของฝั่งชีตที่หน้าเว็บนี้ทำงานด้วยได้ครบทุกฟีเจอร์ */
const NEEDS_SERVER = '2.8.0';

/** เทียบเวอร์ชันแบบ semver ง่าย ๆ — คืน -1 / 0 / 1 */
function cmpVersion(a, b) {
  const pa = String(a || '0').split('.').map(Number);
  const pb = String(b || '0').split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    const x = pa[i] || 0, y = pb[i] || 0;
    if (x !== y) return x < y ? -1 : 1;
  }
  return 0;
}

/** ฟีเจอร์ที่ต้องใช้โค้ดฝั่งชีตเวอร์ชันไหน — ใช้เตือนแบบเจาะจง */
const FEATURES = [
  { since: '2.2.0', name: 'ปุ่ม "ส่งช้า"', why: 'ถ้าโค้ดเก่า คะแนนงานที่กดส่งช้าจะถูกคิดเป็น 0 ในชีต' },
  { since: '2.2.0', name: 'รายละเอียดงาน', why: 'รายละเอียดจะไม่ถูกบันทึกลงชีต' },
  { since: '2.3.0', name: 'เข้าสู่ระบบด้วย Google', why: 'ต้องใช้โค้ดใหม่ในการตรวจบัญชี' },
  { since: '2.4.0', name: 'ช่องที่ยังไม่กรอกขึ้น "—"', why: 'ถ้าโค้ดเก่า ชีตจะยังให้คะแนนเข้าเรียนเต็มทั้งที่ยังไม่ได้เช็คชื่อ' },
  { since: '2.6.0', name: 'หน้าให้นักเรียนดูผล', why: 'ต้องใช้โค้ดใหม่ (ไฟล์ 05_Student.gs) นักเรียนจะเปิดหน้าไม่ได้' }
];

__exp(exports, { APP_VERSION, NEEDS_SERVER, cmpVersion, FEATURES });

  };

  __req("js/app.js");
  window.__acRunning = true;          // บอกตัวตรวจอาการว่าเริ่มแอปสำเร็จแล้ว
})();
