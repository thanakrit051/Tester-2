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
/**
 * เปิดกล่องโต้ตอบ
 * builder(close) ต้องคืน element ที่จะใส่ในกล่อง
 */
export function modal(builder) {
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
