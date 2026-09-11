/**
 * ทดสอบบัตรผ่านของแอป (จำการเข้าสู่ระบบ 30 วัน)
 *   apps-script/04_Api.gs  issueSession_ · verifySession_ · handle_
 *   js/api.js + js/auth.js  การเก็บ/ต่ออายุ/ทิ้งบัตรฝั่งหน้าเว็บ
 *
 * รัน:  node test/session.mjs
 *
 * ทำไมต้องมี: นี่คือประตูหน้าบ้านของข้อมูลคะแนนทั้งหมด
 * พลาดไปทางหนึ่ง = คนนอกเข้าได้ · พลาดอีกทาง = ครูโดนเตะไปหน้าเข้าสู่ระบบ
 * ทุกครั้งที่เปิดเว็บ (อาการที่บัตรผ่านเกิดมาเพื่อแก้)
 */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const gs = path.join(root, 'apps-script');
const DAY = 24 * 60 * 60 * 1000;

let checked = 0, fails = 0;
function ok(cond, what) {
  checked++;
  if (!cond) { fails++; console.log('❌ ' + what); }
}
function eq(actual, expected, what) {
  ok(Object.is(actual, expected), what + ' — ได้ ' + JSON.stringify(actual) + ' ควรเป็น ' + JSON.stringify(expected));
}

// ══ ฝั่งชีต ═══════════════════════════════════════════════════

/* Utilities ของ Google คืน byte เป็นอาร์เรย์ตัวเลข — จำลองด้วย crypto ของ Node */
const bytes = (d) => typeof d === 'string' ? Buffer.from(d, 'utf8') : Buffer.from(Array.from(d, b => b & 255));

let tokeninfo = null;   // คำตอบของ Google สำหรับ ID token ที่ส่งมา · null = token ใช้ไม่ได้
let askedGoogle = 0;
const cfg = {
  apiKey: 'k-เดิม',
  oauth_client_id: 'cid.apps.googleusercontent.com',
  allowed_emails: 'kru@school.ac.th, t2@school.ac.th',
  year: '2569', term: '1'
};

const ctx = {
  console,
  Utilities: {
    DigestAlgorithm: { SHA_256: 'sha256' },
    computeDigest: (_alg, s) => [...crypto.createHash('sha256').update(bytes(s)).digest()],
    computeHmacSha256Signature: (v, k) => [...crypto.createHmac('sha256', bytes(k)).update(bytes(v)).digest()],
    base64EncodeWebSafe: (d) => bytes(d).toString('base64').replace(/\+/g, '-').replace(/\//g, '_'),
    base64DecodeWebSafe: (s) => {
      if (!/^[A-Za-z0-9_=-]*$/.test(s)) throw new Error('Could not decode string.');
      return [...Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64')];
    },
    newBlob: (b) => ({ getDataAsString: () => bytes(b).toString('utf8') })
  },
  CacheService: { getScriptCache: () => ({ get: () => null, put() {} }) },
  UrlFetchApp: {
    fetch() {
      askedGoogle++;
      return tokeninfo
        ? { getResponseCode: () => 200, getContentText: () => JSON.stringify(tokeninfo) }
        : { getResponseCode: () => 400, getContentText: () => '{"error":"invalid_token"}' };
    }
  },
  Session: { getEffectiveUser: () => ({ getEmail: () => 'kru@school.ac.th' }) },
  ContentService: {
    MimeType: { JSON: 'json' },
    createTextOutput: (s) => ({ setMimeType() { return this; }, getContent: () => s })
  },
  LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
  getConfig_: () => cfg
};
vm.createContext(ctx);
vm.runInContext(
  fs.readFileSync(path.join(gs, '00_Constants.gs'), 'utf8') + '\n' +
  fs.readFileSync(path.join(gs, '04_Api.gs'), 'utf8'), ctx);

const send = (req) => JSON.parse(ctx.handle_(req, false).getContent());
const googleSays = (email) => ({
  aud: cfg.oauth_client_id, email, email_verified: 'true', name: 'ครูทดสอบ',
  exp: String(Math.floor(Date.now() / 1000) + 3600)
});
/** ทำบัตรเองด้วยกุญแจที่กำหนด — จำลองบัตรเก่า · หมดอายุ · ปลอม */
const forge = (email, exp, apiKey = cfg.apiKey) => {
  const body = 'v1.' + exp + '.' + ctx.Utilities.base64EncodeWebSafe(email);
  return body + '.' + ctx.sessionSig_(body, { apiKey });
};

// 1) ล็อกอินด้วย Google ครั้งแรก → ได้บัตร 30 วัน
tokeninfo = googleSays('Kru@School.ac.th');
let r = send({ idToken: 'google-id-token', action: 'ping' });
eq(r.ok, true, 'ID token ที่ถูกต้องต้องผ่าน');
ok(r.session && typeof r.session.token === 'string', 'ผ่านด้วย ID token แล้วต้องได้บัตรผ่านกลับมา');
ok(r.session && Math.abs(r.session.exp - (Date.now() + 30 * DAY)) < 60_000, 'บัตรผ่านต้องอายุ 30 วัน');
const card = r.session ? r.session.token : '';

// 2) ปิดเว็บไปข้ามวัน: ID token หมดอายุแล้ว เหลือแต่บัตร — อาการเดิมคือเด้งไปหน้าเข้าสู่ระบบ
tokeninfo = null;
askedGoogle = 0;
r = send({ session: card, idToken: '', action: 'ping' });
eq(r.ok, true, 'มีแต่บัตรผ่าน (ID token หมดแล้ว) ต้องเข้าได้');
eq(r.user && r.user.email, 'kru@school.ac.th', 'ต้องรู้ว่าเป็นใครจากบัตร (ตัวพิมพ์เล็กเสมอ)');
eq(askedGoogle, 0, 'ตรวจบัตรต้องไม่ยิงไปถาม Google');
eq(r.session, undefined, 'บัตรเพิ่งออก ไม่ต้องออกใบใหม่ทุกคำขอ');

// 3) ใบที่ถืออยู่ออกมาเกิน 1 วัน → ต่ออายุให้
r = send({ session: forge('kru@school.ac.th', Date.now() + 20 * DAY), action: 'ping' });
eq(r.ok, true, 'บัตรที่ยังเหลืออายุ 20 วันต้องใช้ได้');
ok(r.session && r.session.exp > Date.now() + 29 * DAY, 'บัตรที่ออกมาเกิน 1 วันต้องได้ใบใหม่อายุเต็ม');

// 4) บัตรที่ต้องไม่ผ่าน
function denied(session, what) {
  const x = send({ session, action: 'ping' });
  eq(x.ok, false, what + ' ต้องไม่ผ่าน');
  eq(x.code, 'AUTH', what + ' ต้องตอบ AUTH (หน้าเว็บจะทิ้งบัตรแล้วพาไปเข้าสู่ระบบ)');
  eq(x.session, undefined, what + ' ต้องไม่ได้บัตรใหม่');
}
const [v1, exp1, email1, sig1] = card.split('.');
denied(forge('kru@school.ac.th', Date.now() - 1000), 'บัตรหมดอายุ');
denied([v1, exp1, email1, (sig1.startsWith('A') ? 'B' : 'A') + sig1.slice(1)].join('.'), 'บัตรที่แก้ลายเซ็น');
denied([v1, exp1, ctx.Utilities.base64EncodeWebSafe('t2@school.ac.th'), sig1].join('.'), 'บัตรที่สลับอีเมลเป็นคนอื่น');
denied([v1, String(Date.now() + 3650 * DAY), email1, sig1].join('.'), 'บัตรที่ต่อวันหมดอายุเอง');
denied(forge('kru@school.ac.th', Date.now() + DAY, 'กุญแจที่เดาเอา'), 'บัตรที่เซ็นด้วยกุญแจอื่น');
denied('v1.abc', 'บัตรรูปแบบเพี้ยน');
denied('v2.' + exp1 + '.' + email1 + '.' + sig1, 'บัตรรุ่นที่ไม่รู้จัก');

// 5) เจ้าของเอาอีเมลออกจาก allowed_emails → บัตรของคนนั้นใช้ไม่ได้ทันที
const card2 = forge('t2@school.ac.th', Date.now() + 30 * DAY);
eq(send({ session: card2, action: 'ping' }).ok, true, 'ครูคนที่ 2 ที่อยู่ใน allowed_emails ต้องเข้าได้');
cfg.allowed_emails = 'kru@school.ac.th';
r = send({ session: card2, action: 'ping' });
eq(r.ok, false, 'เอาอีเมลออกจาก allowed_emails แล้ว บัตรที่ออกไปก่อนหน้าต้องใช้ไม่ได้ทันที');
eq(r.code, 'FORBIDDEN', 'บัตรแท้แต่หมดสิทธิ์ ต้องตอบ FORBIDDEN (ล็อกอินใหม่ด้วยบัญชีเดิมก็ไม่ช่วย)');

// 6) สร้างรหัสลับใหม่ → บัตรทุกใบใช้ไม่ได้ (ออกจากระบบทุกเครื่อง)
cfg.apiKey = 'k-ใหม่';
denied(card, 'บัตรที่ออกก่อนสร้างรหัสลับใหม่');

// 7) บัตรใช้ไม่ได้ แต่ยังมีทางอื่นที่ถูกต้อง → ต้องไม่ล็อกครูออก
r = send({ session: card, key: 'k-ใหม่', action: 'ping' });
eq(r.ok, true, 'บัตรใช้ไม่ได้แต่รหัสลับถูก ต้องยังเข้าได้');
eq(r.session, undefined, 'เข้าด้วยรหัสลับ ไม่ต้องออกบัตร');

tokeninfo = googleSays('kru@school.ac.th');
r = send({ session: card, idToken: 'google-id-token-2', action: 'ping' });
eq(r.ok, true, 'บัตรใช้ไม่ได้แต่ ID token ยังดี ต้องเข้าได้');
ok(r.session && r.session.token !== card, 'แล้วต้องได้บัตรใบใหม่');
tokeninfo = null;
eq(r.session && send({ session: r.session.token, action: 'ping' }).ok, true, 'บัตรใบใหม่ต้องใช้กับรหัสลับใหม่ได้จริง');

// 8) ไม่มีอะไรเลย
r = send({ action: 'ping' });
eq(r.code, 'AUTH', 'ไม่แนบอะไรมาต้องตอบ AUTH');
eq(r.error, 'ยังไม่ได้เข้าสู่ระบบ', 'ไม่แนบอะไรมา ข้อความต้องไม่บอกว่า "หมดอายุ"');

// ══ ฝั่งหน้าเว็บ ═══════════════════════════════════════════════

// จำลองสิ่งที่เบราว์เซอร์มีให้ (ถ้าเทสอื่นที่รันก่อนหน้าตั้งไว้แล้วก็ใช้ของเดิม)
class FakeStorage {
  getItem(k) { return Object.prototype.hasOwnProperty.call(this, k) ? this[k] : null; }
  setItem(k, v) { this[k] = String(v); }
  removeItem(k) { delete this[k]; }
}
globalThis.localStorage ??= new FakeStorage();
globalThis.window ??= { addEventListener() {}, removeEventListener() {}, dispatchEvent() { return true; } };
globalThis.location ??= { origin: 'https://x.test', pathname: '/', hash: '', search: '' };
if (!globalThis.navigator || !('onLine' in globalThis.navigator)) {
  Object.defineProperty(globalThis, 'navigator', { value: { onLine: true }, configurable: true, writable: true });
}

const api = await import('../js/api.js');
const { auth } = await import('../js/auth.js');
const { store } = await import('../js/storage.js');

api.conn.save('https://example.invalid/exec', 'k-ใหม่');
store.del('ac.session');
store.del('ac.idtoken');
store.set('ac.profile', JSON.stringify({ email: 'kru@school.ac.th', name: 'ครูทดสอบ' }));

let sent = null, reply = null;
globalThis.fetch = async (_url, opts) => {
  sent = JSON.parse(opts.body);
  return { text: async () => JSON.stringify(reply) };
};
let renders = 0;
const stopListening = auth.onChange(() => renders++);

reply = { ok: true, data: {}, version: '2.14.0', session: { token: 'บัตร-1', exp: Date.now() + 30 * DAY } };
await api.call('ping');
eq(auth.session, 'บัตร-1', 'บัตรที่ชีตส่งมาต้องถูกเก็บ');
eq(auth.signedIn, true, 'มีบัตรแล้วต้องนับว่าเข้าสู่ระบบอยู่ แม้ไม่มี ID token');
eq(renders, 1, 'ได้บัตรครั้งแรก (จากที่ยังไม่ได้เข้าสู่ระบบ) ต้องแจ้งให้วาดจอใหม่');

reply = { ok: true, data: {}, version: '2.14.0' };
await api.call('ping');
eq(sent && sent.session, 'บัตร-1', 'คำขอถัดไปต้องแนบบัตรไปด้วย');

reply = { ok: true, data: {}, version: '2.14.0', session: { token: 'บัตร-2', exp: Date.now() + 31 * DAY } };
await api.call('ping');
eq(auth.session, 'บัตร-2', 'ชีตต่ออายุให้ ต้องเก็บใบใหม่แทน');
eq(renders, 1, 'ต่ออายุบัตรระหว่างใช้งานต้องไม่วาดจอใหม่ (ช่องที่ครูกำลังพิมพ์คะแนนจะโดนทับ)');

auth.saveSession({ token: 'บัตรหมดอายุ', exp: Date.now() - 1 });
eq(auth.session, 'บัตร-2', 'บัตรที่หมดอายุแล้วต้องไม่ถูกเก็บทับใบที่ยังดี');

reply = { ok: false, code: 'AUTH', error: 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่', version: '2.14.0' };
let threw = null;
try { await api.call('ping'); } catch (e) { threw = e; }
eq(threw && threw.code, 'AUTH', 'ชีตปฏิเสธ ต้องโยน AUTH ให้คนเรียกรู้');
eq(auth.session, '', 'ชีตปฏิเสธบัตรแล้ว ต้องทิ้งบัตรในเครื่อง (ไม่งั้นยิงของที่ใช้ไม่ได้ซ้ำไม่จบ)');
eq(auth.profile && auth.profile.email, 'kru@school.ac.th',
  'ทิ้งบัตรแล้วต้องยังจำบัญชีไว้ — ไม่งั้นต่อเซสชันเงียบ ๆ ไม่ได้อีกเลย');

store.set('ac.session', JSON.stringify({ token: 'ใกล้หมด', exp: Date.now() + 30_000 }));
eq(auth.session, '', 'บัตรที่เหลืออายุไม่ถึง 1 นาทีต้องถือว่าหมดแล้ว');

stopListening();
store.set('ac.session', JSON.stringify({ token: 'บัตร-3', exp: Date.now() + DAY }));
auth.signOut();
eq(store.get('ac.session'), null, 'ออกจากระบบต้องลบบัตรด้วย');

if (fails) {
  console.log(`\n❌ บัตรผ่าน (จำการเข้าสู่ระบบ): ไม่ผ่าน ${fails} จาก ${checked} ข้อ`);
  process.exit(1);
}
console.log(`✅ บัตรผ่าน (จำการเข้าสู่ระบบ) ถูกต้องทั้ง ${checked} ข้อ`);
