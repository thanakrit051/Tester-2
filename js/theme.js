/* โหมดสว่าง / มืด
 *
 * ค่าเริ่มต้นคือ 'auto' — ตามการตั้งค่าของเครื่อง (มืดตอนกลางคืนเอง)
 * ครูเลือกบังคับสว่างหรือมืดได้ในหน้าตั้งค่า เก็บไว้ในเครื่องนี้เท่านั้น
 */

import { store } from './storage.js';

const KEY = 'ac.theme';
const BAR = { light: '#ffffff', dark: '#101211' };

/* store สลับไปเก็บในหน่วยความจำให้เองเมื่อเบราว์เซอร์บล็อก localStorage
 * (Chrome ที่ปิดคุกกี้ของบุคคลที่สาม ใน iframe ของ Google)
 * กดสลับโหมดจึงเห็นผลทันทีเสมอ แค่จำข้ามรอบไม่ได้ */
function lsGet(k) { return store.get(k); }
function lsSet(k, v) { store.set(k, v); }
function lsDel(k) { store.del(k); }

export const THEMES = [
  { id: 'auto',  label: 'ตามเครื่อง', ic: 'auto' },
  { id: 'light', label: 'สว่าง',      ic: 'sun'  },
  { id: 'dark',  label: 'มืด',        ic: 'moon' }
];

export function getTheme() {
  const v = lsGet(KEY);
  return v === 'light' || v === 'dark' ? v : 'auto';
}

export function setTheme(v) {
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
