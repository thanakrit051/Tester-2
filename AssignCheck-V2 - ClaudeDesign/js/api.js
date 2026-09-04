/* AssignCheck V2 — ตัวเชื่อม Apps Script + คิวงานออฟไลน์ */

import { auth } from './auth.js';

const LS = {
  url:   'ac.url',
  key:   'ac.key',
  queue: 'ac.queue',
  cache: 'ac.cache.',
  lastClass: 'ac.lastClass'
};

/* เบราว์เซอร์บางตัวบล็อก localStorage ใน iframe ของ Google แล้วโยน error ทันทีที่แตะ
 * ถ้าเก็บไม่ได้ก็ให้ทำงานต่อได้ (แค่เสียความสามารถใช้งานออฟไลน์) ห้ามพังทั้งแอป */
const lsGet = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } };
const lsDel = (k) => { try { localStorage.removeItem(k); } catch (e) {} };
const lsKeys = () => { try { return Object.keys(localStorage); } catch (e) { return []; } };

/**
 * โหมดการทำงาน
 *   'embedded' = หน้าเว็บถูกเสิร์ฟโดย Apps Script เอง — คุยผ่าน google.script.run
 *                Google บังคับล็อกอินให้แล้ว ไม่ต้องมี URL/รหัสลับ
 *   'remote'   = หน้าเว็บอยู่คนละที่ (GitHub Pages / localhost) — คุยผ่าน fetch
 */
export const MODE = (typeof google !== 'undefined' && google.script && google.script.run)
  ? 'embedded' : 'remote';

export const conn = {
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
export const cache = {
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

export const lastClass = {
  get() { return lsGet(LS.lastClass) || ''; },
  set(id) { lsSet(LS.lastClass, id || ''); }
};

// ── เรียก API ───────────────────────────────────────────────
export class ApiError extends Error {
  constructor(message, code) { super(message); this.code = code; }
}
export class OfflineError extends Error {}

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

export async function call(action, payload = {}) {
  if (!conn.ready) throw new ApiError('ยังไม่ได้เชื่อมต่อกับ Google Sheet', 'NOCONN');

  // ส่งข้อมูลยืนยันตัวตนไปทั้ง 2 แบบ ฝั่งเซิร์ฟเวอร์รับอันไหนก็ได้ที่ผ่าน
  const text = await post({ key: conn.key, idToken: auth.token, action, payload });

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
export const serverInfo = { version: '', seen: false, user: null };

// ── คิวงานออฟไลน์ ──────────────────────────────────────────
export const queue = {
  all() {
    try { return JSON.parse(lsGet(LS.queue)) || []; }
    catch { return []; }
  },
  set(list) { lsSet(LS.queue, JSON.stringify(list)); },
  get size() { return this.all().length; },

  /** ต่อคิว — รวมคำสั่ง setCells ของห้องเดียวกันเข้าด้วยกันเพื่อลดจำนวน request */
  push(action, payload) {
    const list = this.all();
    if (action === 'setCells') {
      const last = list[list.length - 1];
      if (last && last.action === 'setCells' && last.payload.classId === payload.classId) {
        const map = new Map(last.payload.cells.map(c => [c.key + ' ' + c.sid, c]));
        for (const c of payload.cells) map.set(c.key + ' ' + c.sid, c);
        last.payload.cells = [...map.values()];
        this.set(list);
        return;
      }
    }
    list.push({ id: Date.now() + '-' + Math.random().toString(36).slice(2, 7), action, payload });
    this.set(list);
  },

  clear() { this.set([]); }
};

let flushing = false;

/** ส่งงานค้างทั้งหมดเป็น batch เดียว */
export async function flush() {
  if (flushing) return { skipped: true };
  const ops = queue.all();
  if (!ops.length) return { sent: 0 };
  if (!conn.ready) return { sent: 0 };

  flushing = true;
  try {
    const res = await call('batch', { ops: ops.map(o => ({ action: o.action, payload: o.payload })) });
    const failed = [];
    (res.results || []).forEach((r, i) => { if (!r.ok) failed.push({ ...ops[i], error: r.error }); });

    // เอาเฉพาะงานที่เข้ามาใหม่ระหว่างส่งไว้ในคิว
    const now = queue.all();
    const sentIds = new Set(ops.map(o => o.id));
    queue.set(now.filter(o => !sentIds.has(o.id)));

    return { sent: ops.length - failed.length, failed };
  } finally {
    flushing = false;
  }
}

// ── สถานะออนไลน์ ───────────────────────────────────────────
const listeners = new Set();
export const net = {
  get online() { return navigator.onLine; },
  onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  emit() { listeners.forEach(fn => fn()); }
};
window.addEventListener('online',  () => net.emit());
window.addEventListener('offline', () => net.emit());
