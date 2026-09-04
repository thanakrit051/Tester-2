/* AssignCheck — เข้าสู่ระบบด้วยบัญชี Google
 *
 * แนวคิด: URL ของ Web App ไม่ใช่ความลับ (ใครเรียกก็ได้ แต่จะถูกปฏิเสธ)
 * ตัวที่ยืนยันว่าเป็นเจ้าของจริงคือ ID token จาก Google ที่ฝั่ง Apps Script
 * เอาไปตรวจกับรายชื่ออีเมลที่อนุญาต
 *
 * ผลลัพธ์: เปลี่ยนเครื่องแล้วแค่ใส่ URL + กดเข้าสู่ระบบด้วย Google ก็ใช้ได้เลย
 * ไม่ต้องจำรหัสลับ
 */

const LS = { token: 'ac.idtoken', profile: 'ac.profile', clientId: 'ac.clientid' };

/* บางเบราว์เซอร์บล็อก localStorage ใน iframe ของ Google แล้วโยน error ทันทีที่แตะ */
const lsGet = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };
const lsDel = (k) => { try { localStorage.removeItem(k); } catch (e) {} };
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
