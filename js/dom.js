/* AssignCheck V2 — ตัวช่วย DOM ขนาดเล็ก (ไม่มี framework) */

/**
 * สร้าง element
 *   h('div', { class:'card', onclick: fn }, 'ข้อความ', h('b', null, 'ตัวหนา'))
 * รับ null/false/undefined ใน children ได้ (จะถูกข้าม)
 */
export function h(tag, props, ...children) {
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

export function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); return el; }

export function mount(el, ...children) { clear(el); add(el, children); return el; }

// ── Toast ───────────────────────────────────────────────────
/**
 * action = { label, onclick } → เพิ่มปุ่มเล็กในตัว toast (ใช้กับ "เลิกทำ")
 * มี action แล้วปล่อยอยู่นานขึ้นเป็นพิเศษ ให้เวลาอ่านและกดทัน
 */
export function toast(msg, kind = '', ms = 2400, action = null) {
  const root = document.getElementById('toasts');
  const remove = () => {
    t.style.transition = 'opacity .2s'; t.style.opacity = '0';
    setTimeout(() => t.remove(), 220);
  };
  const t = h('div', { class: 'toast ' + kind },
    h('span', null, msg),
    action && h('button', {
      class: 'toast-action',
      onclick: () => { action.onclick(); remove(); }
    }, action.label)
  );
  root.append(t);
  setTimeout(remove, action ? Math.max(ms, 5000) : ms);
}

// ── Modal ───────────────────────────────────────────────────

/* กล่องที่เปิดค้างอยู่ เรียงจากล่างขึ้นบน
 * ซ้อนกันได้จริง เพราะ confirmBox ถูกเรียกจากในปุ่มของกล่องอื่นหลายที่
 * (เช่น "ลบการเช็คชื่อ?" ที่เด้งจากในกล่องแก้คาบ) */
const modalStack = [];

/**
 * ปิดกล่องบนสุด — คืน true ถ้ามีกล่องให้ปิดจริง
 * ใช้ให้ปุ่มย้อนกลับของเครื่องปิดกล่องแทนที่จะเปลี่ยนหน้าทั้งหน้า
 */
export function closeTopModal() {
  const top = modalStack[modalStack.length - 1];
  if (!top) return false;
  top();
  return true;
}

const FOCUSABLE = [
  'a[href]', 'button:not([disabled])', 'input:not([disabled])',
  'select:not([disabled])', 'textarea:not([disabled])', '[tabindex]:not([tabindex="-1"])'
].join(',');

/** เฉพาะตัวที่มองเห็นจริง — ตัวที่ถูกซ่อนอยู่ห้ามรับโฟกัส */
function focusables(box) {
  return [...box.querySelectorAll(FOCUSABLE)].filter(el => el.getClientRects().length > 0);
}

/**
 * เปิดกล่องโต้ตอบ
 * builder(close) ต้องคืน element ที่จะใส่ในกล่อง
 *
 * ของเดิมปิดได้ทางเดียวคือคลิกฉากหลัง — คนที่ใช้คีย์บอร์ดจึงออกจากกล่องไม่ได้เลย
 * และกด Tab แล้วโฟกัสหลุดไปอยู่ปุ่มด้านหลังกล่องซึ่งมองไม่เห็น
 * ตอนนี้ปิดด้วย Esc ได้ · Tab วนอยู่ในกล่อง · ปิดแล้วโฟกัสกลับไปที่ปุ่มที่เปิดมัน
 */
export function modal(builder) {
  const root = document.getElementById('modal-root');
  const prevFocus = document.activeElement;
  const back = h('div', { class: 'modal-back' });
  const box = h('div', {
    class: 'modal', role: 'dialog', 'aria-modal': 'true', tabindex: '-1',
    onclick: (e) => e.stopPropagation()
  });

  let closed = false;
  const close = () => {
    if (closed) return;            // กันปิดซ้ำ (กด Esc พร้อมคลิกฉากหลัง ฯลฯ)
    closed = true;
    const i = modalStack.indexOf(close);
    if (i >= 0) modalStack.splice(i, 1);
    back.remove();
    document.removeEventListener('keydown', onKey, true);
    if (!modalStack.length) document.body.style.overflow = '';
    // คืนโฟกัสให้ปุ่มที่เปิดกล่องนี้ — ถ้าปุ่มนั้นถูกวาดใหม่ไปแล้วก็แค่ไม่มีอะไรเกิดขึ้น
    try { if (prevFocus && prevFocus.focus) prevFocus.focus(); } catch (e) {}
  };

  function onKey(e) {
    if (modalStack[modalStack.length - 1] !== close) return;   // ไม่ใช่กล่องบนสุด
    if (e.key === 'Escape') { e.preventDefault(); close(); return; }
    if (e.key !== 'Tab') return;
    const f = focusables(box);
    if (!f.length) { e.preventDefault(); box.focus(); return; }
    const first = f[0], last = f[f.length - 1];
    const here = document.activeElement;
    if (e.shiftKey && (here === first || !box.contains(here))) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && here === last) { e.preventDefault(); first.focus(); }
  }

  back.addEventListener('click', () => close());
  box.append(builder(close));
  back.append(box);
  root.append(back);
  modalStack.push(close);
  document.body.style.overflow = 'hidden';
  document.addEventListener('keydown', onKey, true);

  const first = box.querySelector('input,select,textarea');
  setTimeout(() => (first || box).focus(), 60);
  return close;
}

export function confirmBox(title, message, confirmLabel = 'ยืนยัน') {
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

export function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function fmtDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} ${TH_MONTH[m - 1]} ${(y + 543) % 100}`;
}

/** "ศุกร์ 7 ส.ค. 69" — ใส่ชื่อวันเพื่อให้ครูมั่นใจว่าเลือกวันถูก */
export function fmtDayFull(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  const dow = TH_DAY[new Date(iso + 'T00:00:00').getDay()];
  return `${dow} ${d} ${TH_MONTH[m - 1]} ${(y + 543) % 100}`;
}

export function isToday(iso) { return iso === todayISO(); }

export function nf(v, digits = 2) {
  const n = Number(v);
  if (isNaN(n)) return String(v ?? '');
  return String(Math.round(n * 10 ** digits) / 10 ** digits);
}
