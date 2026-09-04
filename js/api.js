/* AssignCheck V2 — ตัวเชื่อม Apps Script + คิวงานออฟไลน์ */

import { auth } from './auth.js';
import { store } from './storage.js';

const LS = {
  url:   'ac.url',
  key:   'ac.key',
  queue: 'ac.queue',
  cache: 'ac.cache.',
  lastClass: 'ac.lastClass'
};

/* เก็บผ่าน store — ถ้าเบราว์เซอร์บล็อก localStorage มันจะสลับไปใช้หน่วยความจำให้เอง
 * สำคัญมากกับคิวงาน เพราะถ้าเขียนไม่ลงแล้วเงียบ คะแนนที่ครูกรอกจะไม่ถูกส่งขึ้นชีตเลย */
const lsGet = (k) => store.get(k);
const lsSet = (k, v) => store.set(k, v);
const lsDel = (k) => store.del(k);
const lsKeys = () => store.keys();

/** true = ข้อมูลถูกเก็บลงเครื่องจริง · false = อยู่แค่ในแท็บนี้ ปิดแล้วหาย */
export const storagePersistent = () => store.persistent;

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

/**
 * มีคำขอค้างอยู่กี่รายการ — ใช้โชว์แถบกำลังโหลด
 *
 * Apps Script ตอบ 1-3 วินาที ถ้าไม่มีอะไรขยับบนจอเลยระหว่างนั้น
 * ผู้ใช้จะรู้สึกว่าแอปค้าง ไม่ใช่แค่ช้า (ของเดิมมี state.busy แต่ไม่มีใครอ่าน)
 */
let inflight = 0;
export const isBusy = () => inflight > 0;
function setBusy(delta) {
  inflight = Math.max(0, inflight + delta);
  try { window.dispatchEvent(new CustomEvent('ac:busy')); } catch (e) {}
}

/**
 * @param opts.quiet true = งานเบื้องหลังที่ครูไม่ได้สั่ง (เช่นโหลดห้องอื่นเผื่อไว้)
 *                   อย่าให้ขึ้นแถบ "กำลังโหลด" ไม่งั้นแอปจะดูเหมือนทำงานค้าง
 *                   อยู่หลายวินาทีทั้งที่หน้าจอพร้อมใช้แล้ว
 */
export async function call(action, payload = {}, { quiet = false } = {}) {
  if (!conn.ready) throw new ApiError('ยังไม่ได้เชื่อมต่อกับ Google Sheet', 'NOCONN');

  // ส่งข้อมูลยืนยันตัวตนไปทั้ง 2 แบบ ฝั่งเซิร์ฟเวอร์รับอันไหนก็ได้ที่ผ่าน
  if (!quiet) setBusy(1);
  let text;
  try { text = await post({ key: conn.key, idToken: auth.token, action, payload }); }
  finally { if (!quiet) setBusy(-1); }

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

  /**
   * ต่อคิว — รวมคำสั่ง setCells ของห้องเดียวกันเข้าด้วยกันเพื่อลดจำนวน request
   *
   * ห้ามรวมเข้ากับก้อนที่กำลังส่งอยู่ (sending)
   * ก้อนนั้นถูกถ่ายสำเนาไปทำ request แล้ว แก้ทีหลังไม่มีผลกับสิ่งที่ส่งออกไป
   * แต่ตอนส่งเสร็จมันจะถูกลบทั้งก้อน — สิ่งที่เพิ่งกดจะหายเงียบ ๆ
   * (Apps Script ตอบ 1–3 วินาที ช่วงนี้ครูกดต่อได้อีกหลายครั้ง)
   */
  push(action, payload) {
    const list = this.all();
    if (action === 'setCells') {
      const last = list[list.length - 1];
      if (last && !last.sending && last.action === 'setCells' && last.payload.classId === payload.classId) {
        const map = new Map(last.payload.cells.map(c => [c.key + '\0' + c.sid, c]));
        for (const c of payload.cells) map.set(c.key + '\0' + c.sid, c);
        last.payload.cells = [...map.values()];
        this.set(list);
        return;
      }
    }
    list.push({ id: Date.now() + '-' + Math.random().toString(36).slice(2, 7), action, payload });
    this.set(list);
  },

  /** ปักธงว่ากำลังส่งอยู่ / ปลดธงเมื่อส่งไม่สำเร็จ */
  mark(ids, sending) {
    const set = new Set(ids);
    const list = this.all();
    for (const o of list) if (set.has(o.id)) { if (sending) o.sending = true; else delete o.sending; }
    this.set(list);
  },

  /** จำนวนครั้งที่งานในคิวถูกส่งแล้วไม่ผ่านมากที่สุด — ใช้ถ่างจังหวะลองใหม่ */
  maxTries() { return this.all().reduce((a, o) => Math.max(a, o.tries || 0), 0); },

  /** งานที่ลองส่งซ้ำหลายรอบแล้วยังไม่ผ่าน — เอาไปแสดงในหน้าตรวจสภาพ */
  stuck(min = 3) { return this.all().filter(o => (o.tries || 0) >= min); },

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
  // ปักธงก่อนยิง เพื่อไม่ให้สิ่งที่กดระหว่างรอคำตอบถูกรวมเข้าก้อนนี้แล้วหายไปพร้อมกัน
  queue.mark(ops.map(o => o.id), true);
  try {
    const res = await call('batch', { ops: ops.map(o => ({ action: o.action, payload: o.payload })) });
    const results = res.results || [];

    // ลบออกจากคิวเฉพาะงานที่เซิร์ฟเวอร์ยืนยันว่าสำเร็จ
    // ของเดิมลบทั้งก้อนรวมงานที่ล้มเหลวด้วย — คะแนนช่องนั้นหายถาวรทั้งที่ยังไม่ได้ลงชีต
    // (พลาดรอบเดียวเพราะชีตติดล็อกชั่วคราว ก็เสียข้อมูลแล้ว)
    const okIds = new Set();
    const failed = [];
    ops.forEach((o, i) => {
      const r = results[i];
      if (r && r.ok) { okIds.add(o.id); return; }
      failed.push({ ...o, error: (r && r.error) || 'เซิร์ฟเวอร์ตอบกลับไม่ครบ' });
    });

    // งานที่ยังไม่ผ่านต้องกลับไปอยู่หน้าคิว เพื่อรักษาลำดับก่อน-หลังของการแก้ค่า
    const retry = failed.map(({ error, sending, ...o }) => ({ ...o, tries: (o.tries || 0) + 1 }));
    const sentIds = new Set(ops.map(o => o.id));
    const fresh = queue.all().filter(o => !sentIds.has(o.id));   // ของที่เพิ่งกดระหว่างรอคำตอบ
    queue.set([...retry, ...fresh]);

    return { sent: okIds.size, failed };
  } catch (e) {
    queue.mark(ops.map(o => o.id), false);   // ส่งไม่สำเร็จ ให้กลับไปรวมกับของใหม่ได้ตามเดิม
    throw e;
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
