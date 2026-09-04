/**
 * ทดสอบการโหลดห้องเรียนใน js/state.js
 *
 * รัน:  node test/state.mjs
 *
 * ทำไมต้องมี
 * ──────────
 * ฝั่งชีตเลิกจับ lock ตอน "อ่าน" แล้ว (04_Api.gs) เพื่อไม่ให้การเปิดห้อง
 * ต้องยืนรอคำสั่งเขียนที่แอปส่งเบื้องหลังให้เสร็จก่อน แลกมาด้วยความเสี่ยงว่า
 * คำสั่งอ่านจะแซงคำสั่งเขียนที่ยังส่งไม่ถึง แล้วเอาค่าเก่ามาทับจอ
 * = ช่องที่ครูเพิ่งกดหายไปต่อหน้า ทั้งที่ยังอยู่ในคิวและกำลังจะถูกเขียนจริง
 *
 * เคสที่คุมไว้ตรงนี้
 *   1. มีแคช → ต้องวาดทันทีตั้งแต่ยังไม่ได้ยิงเน็ต
 *   2. ของจากชีตมาทับ → ค่าที่ยังค้างคิวต้องอยู่ครบ
 *   3. เปิดห้องที่ยังไม่มีแคช → ต้องล้างของห้องเดิมทิ้ง ไม่ใช่โชว์ค้างไว้
 */

// ── จำลองสิ่งที่เบราว์เซอร์มีให้ ต้องตั้งก่อน import ─────────
// จงใจไม่ประกาศ document — state.js จะข้ามการผูก event listener
// (รวมถึง setInterval ที่จะค้างจนเทสต์ไม่ยอมจบ) ไปเองอย่างปลอดภัย
class FakeStorage {
  getItem(k) { return Object.prototype.hasOwnProperty.call(this, k) ? this[k] : null; }
  setItem(k, v) { this[k] = String(v); }
  removeItem(k) { delete this[k]; }
}
globalThis.localStorage = new FakeStorage();
Object.defineProperty(globalThis, 'navigator', { value: { onLine: true }, configurable: true, writable: true });
globalThis.location = { origin: 'https://x.test', pathname: '/', hash: '', search: '' };
globalThis.window = {
  addEventListener() {},
  removeEventListener() {},
  dispatchEvent() { return true; },
  history: { state: null, pushState() {}, replaceState() {} }
};

let reply = null;                                   // ข้อมูลที่ "ชีต" จะตอบกลับมา
let waitForTest = null;                             // ค้างคำตอบไว้จนกว่าเทสต์จะสั่งปล่อย
globalThis.fetch = async () => {
  if (waitForTest) await waitForTest;
  return { text: async () => JSON.stringify({ ok: true, data: reply, version: '2.11.0' }) };
};

const api = await import('../js/api.js');
const { state, loadClass } = await import('../js/state.js');

api.conn.save('https://script.google.com/macros/s/x/exec', 'KEY');

// ── ตัวช่วย ─────────────────────────────────────────────────
const clsOf = (values) => ({
  meta: { classId: 'C1', subject: 'คณิตศาสตร์' },
  students: [{ no: 1, sid: '001', name: 'สมชาย' }, { no: 2, sid: '002', name: 'สมหญิง' }],
  columns: [{ key: 'ATT|1|A1', kind: 'ATT', half: 1, id: 'A1', label: 'คาบ 1', max: 0 }],
  values
});

let pass = 0;
const ok = (cond, name) => {
  if (cond) { pass++; return; }
  console.error('❌ ' + name);
  process.exit(1);
};

// ── 1. มีแคชแล้วต้องวาดทันที ไม่ต้องรอเน็ต ──────────────────
api.cache.set('class.C1', clsOf({ 'ATT|1|A1': { '001': 'ม' } }));
reply = clsOf({ 'ATT|1|A1': { '001': 'ม' } });

let release;
waitForTest = new Promise((r) => { release = r; });
const loading = loadClass('C1');
ok(state.cls !== null, 'มีแคชแต่จอยังว่างระหว่างรอเน็ต');
ok(state.cls.values['ATT|1|A1']['001'] === 'ม', 'ค่าจากแคชไม่ถูกวาด');
ok(state.stale === true, 'ไม่ได้ปักธงว่าข้อมูลมาจากแคช');
ok(state.loadingClass === 'C1', 'ไม่ได้บอกว่ากำลังโหลดห้องไหนอยู่');
release();
await loading;
ok(state.loadingClass === '', 'โหลดเสร็จแล้วแต่ยังค้างสถานะกำลังโหลด');
ok(state.stale === false, 'ได้ข้อมูลสดแล้วแต่ยังบอกว่าเป็นของเก่า');

// ── 2. ของที่ยังค้างคิวต้องไม่ถูกของจากชีตทับหาย ────────────
// จำลอง: ครูเพิ่งกดเช็คชื่อคนที่ 002 คำสั่งยังอยู่ในคิว
// แล้วคำสั่งอ่านแซงไปถึงชีตก่อน ชีตจึงตอบกลับมาโดยยังไม่มีค่านั้น
api.queue.push('setCells', { classId: 'C1', cells: [{ key: 'ATT|1|A1', sid: '002', value: 'ล' }] });
reply = clsOf({ 'ATT|1|A1': { '001': 'ม' } });
waitForTest = null;
await loadClass('C1', { force: true });
ok(state.cls.values['ATT|1|A1']['002'] === 'ล', 'ค่าที่ยังค้างคิวหายไปตอนข้อมูลจากชีตมาทับ');
ok(state.cls.values['ATT|1|A1']['001'] === 'ม', 'ค่าที่ชีตยืนยันแล้วหายไป');

// ค่าที่ค้างคิวต้องติดไปกับแคชด้วย ไม่งั้นเปิดใหม่ตอนออฟไลน์แล้วหาย
ok(api.cache.get('class.C1').values['ATT|1|A1']['002'] === 'ล', 'แคชที่เขียนทับไม่มีค่าที่ค้างคิว');

// ── 3. เปิดห้องที่ยังไม่มีแคช ต้องไม่โชว์ของห้องเดิมค้างไว้ ──
reply = { ...clsOf({}), meta: { classId: 'C2', subject: 'วิทย์' } };
waitForTest = new Promise((r) => { release = r; });
const loading2 = loadClass('C2');
ok(state.cls === null, 'เปิดห้องที่ไม่มีแคชแล้วยังโชว์รายชื่อห้องเดิมค้างอยู่');
ok(state.loadingClass === 'C2', 'ไม่ได้บอกว่ากำลังโหลดห้องใหม่');
release();
await loading2;
ok(state.cls.meta.classId === 'C2', 'โหลดห้องใหม่เสร็จแล้วแต่ข้อมูลไม่ใช่ห้องนั้น');

console.log(`✅ การโหลดห้องเรียนผ่านครบ (${pass} ข้อ)`);
