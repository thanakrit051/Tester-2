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

export function mount(el, ...children) { clear(el); add(el, children); linkLabels(el); return el; }

/**
 * ผูก <label> ที่วางติดหน้าช่องกรอก (ไม่ได้ครอบช่องไว้) เข้ากับช่องนั้น
 *
 * ฟอร์มทั้งแอปเขียนแบบ h('label', null, 'ชื่อวิชา *'), input — เห็นติดกันบนจอ
 * แต่เบราว์เซอร์ไม่รู้ว่าเป็นคู่กัน โปรแกรมอ่านหน้าจออ่านแค่ "ช่องแก้ไขข้อความ" ไม่บอกว่าช่องอะไร
 * และแตะที่ชื่อช่องก็ไม่โฟกัสช่อง (วัดได้ราว 25 ช่อง 2026-10-14)
 * แก้ที่เดียวตรงนี้แทนการไล่ใส่ for ทีละฟอร์ม — mount() กับ modal() เรียกให้ทุกครั้ง
 */
let labelSeq = 0;
export function linkLabels(root) {
  for (const lb of root.querySelectorAll('label:not([for])')) {
    if (lb.control) continue;                       // ครอบช่องไว้เองแล้ว
    let el = lb.nextElementSibling;
    if (el && !/^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName)) {
      // ช่องที่มีหน่วยต่อท้าย (div ครอบ input + "คะแนน") — ผูกเฉพาะเมื่อข้างในมีช่องเดียว
      const inner = el.querySelectorAll('input,select,textarea');
      el = inner.length === 1 ? inner[0] : null;
    }
    if (!el || el.labels?.length) continue;
    if (!el.id) el.id = 'fld-' + (++labelSeq);
    lb.htmlFor = el.id;
  }
}

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
  // ข้อผิดพลาดต้องอยู่ให้อ่านทัน — 2.4 วิ อ่านข้อความไทยยาว ๆ ไม่จบ และโปรแกรมอ่านหน้าจออ่านไม่ทัน
  if (kind === 'err') ms = Math.max(ms, 6000);
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
  linkLabels(box);
  // ชื่อกล่องให้โปรแกรมอ่านหน้าจออ่านตอนเปิด — เดิมประกาศแค่ "กล่องโต้ตอบ"
  const title = box.querySelector('h2');
  if (title) { if (!title.id) title.id = 'dlg-' + (++labelSeq); box.setAttribute('aria-labelledby', title.id); }
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

// ── คลิปบอร์ด ───────────────────────────────────────────────

/**
 * คัดลอกข้อความ — คืน true เมื่อสำเร็จ
 *
 * ใช้ตัวนี้ตัวเดียวทั้งแอป เดิมแต่ละปุ่มเรียก navigator.clipboard เอง
 * ซึ่งใช้ไม่ได้ในเบราว์เซอร์เก่า, หน้าที่ไม่ใช่ https และบางเบราว์เซอร์ในแอปไลน์
 * ตรงนี้ลองวิธีมาตรฐานก่อน ไม่ได้ค่อยตกไปใช้วิธีเลือกข้อความแล้วสั่งคัดลอก
 */
export async function copyText(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(text); return true; }
  } catch (e) { /* ตกไปใช้วิธีสำรอง */ }
  try {
    const ta = h('textarea', { value: text, readonly: true, style: { position: 'fixed', top: '-1000px', opacity: '0' } });
    document.body.append(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  } catch (e) { return false; }
}

// ── พิมพ์ ───────────────────────────────────────────────────

/**
 * พิมพ์เฉพาะเนื้อหาที่ส่งมา ไม่ใช่ทั้งหน้าจอแอป
 *
 * วางเนื้อหาไว้ใน #print-area แล้วซ่อนอย่างอื่นทั้งหมดตอนพิมพ์ (ดู @media print ใน styles.css)
 * พิมพ์เสร็จหรือกดยกเลิกแล้วเก็บกวาดคืนเอง
 *
 * @param landscape true = กระดาษแนวนอน (ใบเช็คชื่อมีหลายคอลัมน์วันที่)
 * @param fit       selector ของ "แผ่น" ที่ต้องอยู่ในหน้าเดียว (เช่น '.slip') — ยาวเกินหน้า = ย่อลงให้พอดี
 *                  ไม่ย่อเกิน 70% (เล็กกว่านั้นอ่านยาก ปล่อยขึ้นหน้าใหม่ดีกว่า)
 */
let clearPrint = null;   // เก็บกวาดงานพิมพ์รอบก่อน (ถ้ายังค้างอยู่)

export function printPage(content, { title = '', landscape = false, fit = '' } = {}) {
  if (clearPrint) clearPrint();
  const area = h('div', { id: 'print-area' }, content);
  const page = h('style', null, `@page { size: A4 ${landscape ? 'landscape' : 'portrait'}; margin: 10mm; }`);
  const oldTitle = document.title;

  const done = () => {
    window.removeEventListener('afterprint', waitForReturn);
    window.removeEventListener('pointerdown', done, true);
    window.removeEventListener('keydown', done, true);
    area.remove(); page.remove();
    document.body.classList.remove('printing');
    document.title = oldTitle;
    clearPrint = null;
  };
  // อย่าเก็บกวาดทันทีที่ afterprint มา — Chrome บน Android/มือถือยิง afterprint ทันทีที่เรียก print()
  // ก่อนระบบจะวาดหน้าพิมพ์เสร็จ เนื้อหาที่เตรียมไว้จึงหายไปก่อน แล้วพิมพ์หน้าจอแอปออกมาแทน (2-3 หน้า)
  // รอให้ครูกลับมาแตะ/กดปุ่มในแอปก่อนค่อยเก็บ — ระหว่างนั้นบนจอมองไม่เห็นอะไร (#print-area ซ่อนบนจอเสมอ)
  const waitForReturn = () => {
    window.removeEventListener('afterprint', waitForReturn);
    window.addEventListener('pointerdown', done, true);
    window.addEventListener('keydown', done, true);
  };
  clearPrint = done;

  document.head.append(page);
  document.body.append(area);
  if (fit) fitToPage(area, fit, landscape);
  document.body.classList.add('printing');
  if (title) document.title = title;          // ชื่อไฟล์ตอนเลือก "บันทึกเป็น PDF"
  window.addEventListener('afterprint', waitForReturn);
  // ให้เบราว์เซอร์วาดเนื้อหาใหม่ก่อนเปิดหน้าพิมพ์ ไม่งั้นบางเครื่องพิมพ์ออกมาเป็นหน้าเปล่า
  setTimeout(() => { try { window.print(); } catch (e) { done(); } }, 60);
}

/**
 * ย่อแต่ละแผ่นให้จบในหน้าเดียว — วัดความสูงจริงบนจอ (วางนอกจอ กว้างเท่าพื้นที่พิมพ์) ก่อนเปิดหน้าพิมพ์
 * ข้อมูลจริงแต่ละคนยาวไม่เท่ากัน (ขาดหลายวัน · งานค้างหลายชิ้น) ความสูงตายตัวจึงล้นไปหน้า 2 ได้
 */
function fitToPage(area, selector, landscape) {
  const mm = 96 / 25.4;
  // A4 ลบขอบ 10mm สองด้าน · เผื่ออีก 12mm — Safari บน iPhone/iPad ใช้ขอบกระดาษของตัวเองกว้างกว่า @page
  const avail = ((landscape ? 190 : 277) - 12) * mm;
  area.style.setProperty('--pw', landscape ? '277mm' : '190mm');
  area.classList.add('measure');
  area.querySelectorAll(selector).forEach(el => {
    el.style.zoom = '';
    const tall = el.offsetHeight;
    if (tall > avail) el.style.zoom = String(Math.max(0.7, Math.floor((avail / tall) * 100) / 100));
  });
  area.classList.remove('measure');
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

/**
 * ตรงกับคำค้นไหม — ใช้ในช่องค้นหาของหน้าเช็คชื่อและหน้ากรอกคะแนน
 *   พิมพ์ตัวเลขล้วน = หาเลขที่ตรงตัว หรือเลขประจำตัวที่มีเลขนี้อยู่
 *   (ครูพิมพ์ "3" ต้องได้เลขที่ 3 คนเดียว ไม่ใช่ทุกคนที่มีเลข 3 ในเลขประจำตัว)
 *   พิมพ์ตัวอักษร = หาในชื่อ
 */
export function matchStudent(s, q) {
  const k = String(q || '').trim();
  if (!k) return true;
  if (/^\d+$/.test(k)) {
    return String(s.no) === k || (k.length >= 3 && String(s.sid || '').includes(k));
  }
  return String(s.name || '').toLowerCase().includes(k.toLowerCase());
}

export function nf(v, digits = 2) {
  const n = Number(v);
  if (isNaN(n)) return String(v ?? '');
  return String(Math.round(n * 10 ** digits) / 10 ** digits);
}
