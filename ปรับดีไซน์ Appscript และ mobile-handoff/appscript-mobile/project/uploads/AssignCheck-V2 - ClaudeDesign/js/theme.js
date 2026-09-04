/* โหมดสว่าง / มืด
 *
 * ค่าเริ่มต้นคือ 'auto' — ตามการตั้งค่าของเครื่อง (มืดตอนกลางคืนเอง)
 * ครูเลือกบังคับสว่างหรือมืดได้ในหน้าตั้งค่า เก็บไว้ในเครื่องนี้เท่านั้น
 */

const KEY = 'ac.theme';
const BAR = { light: '#ffffff', dark: '#101211' };

/* บางเบราว์เซอร์บล็อก localStorage ใน iframe ของ Google (Chrome ที่ปิดคุกกี้ของบุคคลที่สาม)
 * แล้วโยน error ทันทีที่แตะ — ต้องกันไว้ ไม่งั้นแอปตายตั้งแต่ยังไม่ทันวาดหน้าจอ */
function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
function lsDel(k) { try { localStorage.removeItem(k); } catch (e) {} }

// เก็บไว้ในหน่วยความจำด้วย — ถ้าเครื่องบันทึกลงเครื่องไม่ได้
// อย่างน้อยกดสลับโหมดแล้วต้องเปลี่ยนให้เห็นในรอบนี้ ไม่ใช่กดแล้วเงียบ
let mem = null;

export const THEMES = [
  { id: 'auto',  label: 'ตามเครื่อง', ic: 'auto' },
  { id: 'light', label: 'สว่าง',      ic: 'sun'  },
  { id: 'dark',  label: 'มืด',        ic: 'moon' }
];

export function getTheme() {
  const v = lsGet(KEY) || mem;
  return v === 'light' || v === 'dark' ? v : 'auto';
}

export function setTheme(v) {
  mem = v === 'auto' ? null : v;
  if (v === 'auto') lsDel(KEY);
  else lsSet(KEY, v);
  applyTheme();
}

function darkQuery() {
  try { return matchMedia('(prefers-color-scheme: dark)'); } catch (e) { return null; }
}

/** โหมดที่กำลังแสดงจริง (คลี่ 'auto' ออกเป็น light/dark แล้ว) */
export function resolvedTheme() {
  const t = getTheme();
  if (t !== 'auto') return t;
  const q = darkQuery();
  return q && q.matches ? 'dark' : 'light';
}

export function applyTheme() {
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
export function watchSystemTheme(onChange) {
  const q = darkQuery();
  if (!q || !q.addEventListener) return;
  q.addEventListener('change', () => {
    if (getTheme() === 'auto') { applyTheme(); onChange && onChange(); }
  });
}
