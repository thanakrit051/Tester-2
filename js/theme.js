/* โหมดสว่าง / มืด
 *
 * ค่าเริ่มต้นคือ 'auto' — ตามการตั้งค่าของเครื่อง (มืดตอนกลางคืนเอง)
 * ครูเลือกบังคับสว่างหรือมืดได้ในหน้าตั้งค่า เก็บไว้ในเครื่องนี้เท่านั้น
 */

import { store } from './storage.js';

const KEY = 'ac.theme';
/* สีแถบบนของเบราว์เซอร์/มือถือ — ต้องเท่ากับ --bar ใน styles.css เสมอ
 * ของเดิมเป็น #ffffff กับ #101211 ซึ่งไม่ตรงกับดีไซน์ทั้งคู่
 * ผลคือบนมือถือมีแถบสีคนละสีคาดอยู่เหนือแถบหัวแอปพอดี */
const BAR = { light: '#0b2b24', dark: '#061210' };

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

/**
 * ทาสีแถบบนของเบราว์เซอร์
 *
 * ในหน้า HTML มี meta theme-color สองอัน แยกด้วย media query
 * เพื่อให้ได้สีถูกตั้งแต่ก่อน JS ทำงาน (กันแถบกะพริบตอนเปิดแอป)
 *
 *   โหมด auto  → ปล่อยให้ media query ตัดสิน แค่ย้ำค่าให้ตรงกับ BAR
 *   บังคับโหมด → media query ช่วยไม่ได้ เพราะครูเลือกสวนกับเครื่องได้
 *                จึงตั้งทุกอันเป็นสีเดียวกัน อันไหนถูกเลือกก็ได้สีที่ถูก
 *
 * ของเดิมเขียนทับอันแรกที่เจอเสมอ พอมี media query สองอันจะกลายเป็น
 * ทับอันของโหมดสว่างด้วยสีของโหมดมืด แล้วสีเพี้ยนทั้งคู่
 */
function paintBar(auto, resolved) {
  const metas = document.querySelectorAll('meta[name="theme-color"]');
  if (!metas.length) {
    const m = document.createElement('meta');
    m.name = 'theme-color';
    m.content = BAR[resolved];
    document.head.append(m);
    return;
  }
  metas.forEach((m) => {
    const q = m.getAttribute('media') || '';
    m.content = (auto && q) ? (q.includes('dark') ? BAR.dark : BAR.light) : BAR[resolved];
  });
}

export function applyTheme() {
  try {
    const t = getTheme();
    const root = document.documentElement;
    if (t === 'auto') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', t);

    paintBar(t === 'auto', resolvedTheme());
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
