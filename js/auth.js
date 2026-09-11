/* AssignCheck — เข้าสู่ระบบด้วยบัญชี Google
 *
 * แนวคิด: URL ของ Web App ไม่ใช่ความลับ (ใครเรียกก็ได้ แต่จะถูกปฏิเสธ)
 * ตัวที่ยืนยันว่าเป็นเจ้าของจริงคือ ID token จาก Google ที่ฝั่ง Apps Script
 * เอาไปตรวจกับรายชื่ออีเมลที่อนุญาต
 *
 * ตรวจผ่านครั้งแรกแล้ว ชีตจะออก "บัตรผ่าน" ของตัวเองให้ (อายุ 30 วัน ต่ออายุให้เองเมื่อใช้งาน)
 * เพราะ ID token อายุแค่ 1 ชั่วโมง — ดูเหตุผลเต็มที่ issueSession_ ใน apps-script/04_Api.gs
 *
 * ผลลัพธ์: เปลี่ยนเครื่องแล้วแค่ใส่ URL + กดเข้าสู่ระบบด้วย Google ก็ใช้ได้เลย
 * ไม่ต้องจำรหัสลับ และปิดเว็บแล้วเปิดใหม่ไม่ต้องกดซ้ำ
 */

import { store } from './storage.js';

const LS = { token: 'ac.idtoken', session: 'ac.session', profile: 'ac.profile', clientId: 'ac.clientid' };

/* เก็บผ่าน store — บางเบราว์เซอร์บล็อก localStorage ใน iframe ของ Google
 * ของเดิมกลืน error ทิ้ง ทำให้ token ที่เพิ่งได้มาหายทันที แล้ววนให้ล็อกอินซ้ำไม่จบ */
const lsGet = (k) => store.get(k);
const lsSet = (k, v) => store.set(k, v);
const lsDel = (k) => store.del(k);
const GIS_SRC = 'https://accounts.google.com/gsi/client';

let gisReady = null;
let refreshTimer = null;
const listeners = new Set();

/** อ่าน { token, exp } ที่เก็บไว้ — คืน '' ถ้าไม่มีหรือเหลืออายุไม่ถึง 1 นาที */
function readStamped(key) {
  const raw = lsGet(key);
  if (!raw) return { token: '', exp: 0 };
  try {
    const { token, exp } = JSON.parse(raw);
    if (!token || Date.now() > exp - 60_000) return { token: '', exp: 0 };
    return { token, exp };
  } catch { return { token: '', exp: 0 }; }
}

export const auth = {
  get clientId() { return lsGet(LS.clientId) || ''; },
  set clientId(v) { lsSet(LS.clientId, String(v || '').trim()); },

  /** ID token ของ Google (อายุ 1 ชั่วโมง) — ใช้แลกบัตรผ่านจากชีต */
  get token() { return readStamped(LS.token).token; },

  /** บัตรผ่านที่ชีตออกให้ (อายุ 30 วัน) — ตัวที่ทำให้ไม่ต้องล็อกอินใหม่ทุกครั้ง */
  get session() { return readStamped(LS.session).token; },

  /** บัตรผ่านใช้ได้ถึงเมื่อไหร่ (ms) · 0 = ไม่มีบัตร (โค้ดในชีตยังเก่า หรือยังไม่เคยล็อกอิน) */
  get sessionUntil() { return readStamped(LS.session).exp; },

  get profile() {
    try { return JSON.parse(lsGet(LS.profile)) || null; }
    catch { return null; }
  },

  get signedIn() { return !!(this.session || this.token); },

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

  /**
   * เก็บบัตรผ่านที่ชีตส่งกลับมากับคำตอบ
   *
   * ชีตต่ออายุให้วันละครั้ง ถ้าวาดจอใหม่ทุกครั้งที่ได้บัตร ช่องที่ครูกำลังพิมพ์คะแนน
   * จะโดนวาดทับกลางคัน — จึงแจ้งเฉพาะตอนที่สถานะเปลี่ยนจาก "ยังไม่ได้ล็อกอิน" จริง ๆ
   */
  saveSession(s) {
    const exp = Number(s && s.exp);
    if (!s || typeof s.token !== 'string' || !s.token || !(exp > Date.now())) return;
    const was = this.signedIn;
    lsSet(LS.session, JSON.stringify({ token: s.token, exp }));
    if (!was) listeners.forEach(fn => fn());
  },

  /**
   * ชีตไม่รับบัตรผ่าน/token ที่ถืออยู่แล้ว (หมดอายุ · ครูสร้างรหัสลับใหม่) — ทิ้งเฉพาะตัวนั้น
   *
   * ต่างจาก signOut() ตรงที่ยังจำว่าเครื่องนี้เคยล็อกอินด้วยบัญชีไหน และไม่ปิด
   * auto-select ของ Google — ของเดิมเรียก signOut() ตรงนี้ ซึ่งลบ profile ทิ้ง
   * restoreSession จึงหมดทางต่อให้เงียบ ๆ ตั้งแต่ครั้งนั้นเป็นต้นไป ครูต้องกดเองทุกครั้ง
   *
   * ไม่วาดจอใหม่เอง — คนเรียกเป็นคนตัดสินว่าจะลองต่อเงียบ ๆ ก่อน หรือพาไปหน้าเข้าสู่ระบบ
   */
  expire() {
    lsDel(LS.token);
    lsDel(LS.session);
    clearTimeout(refreshTimer);
  },

  signOut() {
    lsDel(LS.token);
    lsDel(LS.session);
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
  refreshTimer = setTimeout(() => {
    /* มีบัตรผ่านจากชีตแล้ว ไม่ต้องขอ ID token ใหม่
     * ถ้าขอ แล้ว Google ล็อกอินให้เองไม่ได้ (มีหลายบัญชี · Safari) กล่อง One Tap
     * จะเด้งขึ้นมากวนกลางหน้าจอทุกชั่วโมงทั้งที่แอปใช้งานได้ปกติ */
    if (auth.session) return;
    silentSignIn().catch(() => {});
  }, wait);
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

/** พยายามขอ ID token ใหม่เงียบ ๆ ผ่าน Google (ใช้ตอนไม่มีบัตรผ่านจากชีต) */
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
 * ต่อเซสชันให้เองตอนเปิดแอป — ทางสำรองเมื่อไม่มีบัตรผ่านจากชีต
 *
 * ปกติบัตรผ่าน 30 วันพอแล้ว ตรงนี้ทำงานเฉพาะตอนที่ไม่มีบัตร:
 * โค้ดในชีตยังเป็นรุ่นก่อน 2.14.0 · ไม่ได้เปิดแอปเกิน 30 วัน · หรือครูสร้างรหัสลับใหม่
 *
 * อย่าพึ่งทางนี้เป็นหลัก — Google ล็อกอินให้เงียบ ๆ ไม่ได้ในหลายกรณีที่เจอบ่อย
 * (Safari/iPhone บล็อกคุกกี้ที่ต้องใช้ · มีหลายบัญชีในเบราว์เซอร์ · พักไว้ 10 นาทีหลังครั้งก่อน)
 * ซึ่งเป็นเหตุผลที่ครูยังเจอหน้าเข้าสู่ระบบแทบทุกครั้งในรุ่นที่มีแต่ทางนี้
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
