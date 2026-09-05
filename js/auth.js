/* AssignCheck — เข้าสู่ระบบด้วยบัญชี Google
 *
 * แนวคิด: URL ของ Web App ไม่ใช่ความลับ (ใครเรียกก็ได้ แต่จะถูกปฏิเสธ)
 * ตัวที่ยืนยันว่าเป็นเจ้าของจริงคือ ID token จาก Google ที่ฝั่ง Apps Script
 * เอาไปตรวจกับรายชื่ออีเมลที่อนุญาต
 *
 * ผลลัพธ์: เปลี่ยนเครื่องแล้วแค่ใส่ URL + กดเข้าสู่ระบบด้วย Google ก็ใช้ได้เลย
 * ไม่ต้องจำรหัสลับ
 */

import { store } from './storage.js';

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

export const auth = {
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

/* ตัวรับ token ปัจจุบัน — เก็บไว้นอก initialize() โดยตั้งใจ
 *
 * initialize() เรียกได้ครั้งเดียว (เรียกซ้ำ Google ไม่รับ callback ใหม่)
 * ของเดิมจึงล็อก callback ของ "คนที่เรียกก่อน" ไว้ตลอด แปลว่าถ้าการต่ออายุ
 * เงียบ ๆ ทำงานก่อน ปุ่ม "เข้าสู่ระบบด้วย Google" ที่กดทีหลังจะบันทึก token ได้
 * แต่ onSignedIn ไม่ถูกเรียก — หน้าเข้าสู่ระบบค้างอยู่กับที่ทั้งที่ล็อกอินผ่านแล้ว */
let tokenCb = null;

async function initGIS(onToken) {
  const g = await loadGIS();
  if (!auth.clientId) throw new Error('ยังไม่ได้ตั้ง Google Client ID');
  tokenCb = onToken;
  if (!initialised) {
    g.accounts.id.initialize({
      client_id: auth.clientId,
      callback: (res) => { if (res?.credential && tokenCb) tokenCb(res.credential); },
      auto_select: true,
      use_fedcm_for_prompt: true
    });
    initialised = true;
  }
  return g;
}

/** วางปุ่ม "Sign in with Google" ของจริงลงใน element */
export async function renderSignInButton(el, { onSignedIn } = {}) {
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
function silentSignIn(timeout = 12_000) {
  return new Promise((resolve, reject) => {
    initGIS((token) => { auth.save(token); resolve(true); })
      .then((g) => {
        g.accounts.id.prompt((n) => {
          if (n.isNotDisplayed?.() || n.isSkippedMoment?.()) reject(new Error('ต้องกดเข้าสู่ระบบใหม่'));
        });
      })
      .catch(reject);
    setTimeout(() => reject(new Error('หมดเวลารอ')), timeout);
  });
}

/**
 * ต่อเซสชันให้เองตอนเปิดแอป — ครูจะได้ไม่ต้องกดเข้าสู่ระบบใหม่ทุกครั้ง
 *
 * ID token ของ Google อายุแค่ 1 ชั่วโมง ของเดิมมีแต่ตัวตั้งเวลาต่ออายุ
 * ซึ่งทำงานเฉพาะตอนแท็บเปิดค้างอยู่ พอปิดแท็บแล้วกลับมาเปิดใหม่วันรุ่งขึ้น
 * token หมดอายุไปแล้ว conn.ready จึงเป็น false = เด้งไปหน้าเข้าสู่ระบบทุกเช้า
 * ทั้งที่บัญชี Google ในเบราว์เซอร์ยังล็อกอินอยู่และเคยกดอนุญาตไปแล้ว
 *
 * ขอใหม่เงียบ ๆ ก่อน (auto_select ทำให้ไม่มีอะไรเด้งขึ้นมาถ้าเคยอนุญาตแล้ว)
 * ถ้าไม่ได้ค่อยไปหน้าเข้าสู่ระบบตามเดิม
 *
 * @param timeout อย่าตั้งนาน — ระหว่างนี้แอปยังค้างอยู่ที่หน้าโหลด
 * @returns true = ได้ token ใหม่แล้ว
 */
export function restoreSession({ timeout = 4000 } = {}) {
  if (auth.signedIn) return Promise.resolve(true);
  // ไม่เคยล็อกอินด้วย Google จากเครื่องนี้ → ไม่มีอะไรให้ต่อ อย่าไปหน่วงเวลาเปิดแอป
  if (!auth.clientId || !auth.profile) return Promise.resolve(false);
  return silentSignIn(timeout).then(() => true, () => false);
}

/* กลับมาที่แท็บแล้วเจอว่า token หมดอายุระหว่างที่พับไว้ → ต่อให้เลย
 * ตัวตั้งเวลาใน scheduleRefresh พึ่งไม่ได้ เพราะเบราว์เซอร์หยุด timer
 * ของแท็บที่ไม่ได้ใช้งาน (มือถือหนักสุด) กว่าจะรู้ตัวก็ตอนกดแล้วขึ้นว่าหมดสิทธิ์ */
try {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    if (auth.signedIn || !auth.clientId || !auth.profile) return;
    restoreSession({ timeout: 8000 }).catch(() => {});
  });
} catch { /* ไม่มี document (เช่นตอนรันเทส) — ข้ามไป */ }
