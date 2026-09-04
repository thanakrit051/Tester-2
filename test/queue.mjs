/**
 * ทดสอบคิวงานออฟไลน์ใน js/api.js
 *
 * รัน:  node test/queue.mjs
 *
 * ทำไมต้องมี
 * ──────────
 * นี่คือตรรกะที่ซับซ้อนที่สุดในโปรเจกต์ และเป็นที่เดียวที่พังแล้ว
 * "คะแนนที่ครูกรอกหายไปเงียบ ๆ" — ขึ้นบนจอครบทุกช่อง ดูเหมือนบันทึกแล้ว
 * แต่ไม่เคยไปถึงชีต และไม่มีข้อความบอกสักคำ
 *
 * เคสที่คุมไว้ตรงนี้คือเคสที่เคยพังมาแล้วจริงทั้งหมด
 *   1. กดรัว ๆ แล้วคำสั่งถูกยุบรวม — ค่าล่าสุดต้องชนะ
 *   2. กดแทรกระหว่างที่ก้อนก่อนหน้ากำลังส่งอยู่ — ห้ามยุบเข้าก้อนนั้น
 *      (ก้อนนั้นถูกถ่ายสำเนาไปส่งแล้ว แก้ทีหลังไม่มีผล แต่จะถูกลบทั้งก้อน)
 *   3. ส่งแล้วสำเร็จบางรายการ — ต้องลบเฉพาะที่เซิร์ฟเวอร์ยืนยัน
 *      ของที่ล้มต้องกลับเข้าคิว ไม่ใช่หายไปพร้อมกัน
 *   4. เน็ตหลุดกลางคัน — คิวต้องอยู่ครบ และธง sending ต้องถูกปลด
 */

// ── จำลองสิ่งที่เบราว์เซอร์มีให้ ต้องตั้งก่อน import ─────────
class FakeStorage {
  getItem(k) { return Object.prototype.hasOwnProperty.call(this, k) ? this[k] : null; }
  setItem(k, v) { this[k] = String(v); }
  removeItem(k) { delete this[k]; }
}
globalThis.localStorage = new FakeStorage();
// Node มี navigator ของตัวเองที่เขียนทับตรง ๆ ไม่ได้ (มีแต่ getter)
Object.defineProperty(globalThis, 'navigator', { value: { onLine: true }, configurable: true, writable: true });
globalThis.location = { origin: 'https://x.test', pathname: '/', hash: '', search: '' };
globalThis.window = {
  addEventListener() {},
  removeEventListener() {},
  dispatchEvent() { return true; }
};
globalThis.fetch = () => { throw new Error('เทสต์ยังไม่ได้ตั้ง fetch'); };

const api = await import('../js/api.js');
const { queue, flush, conn, OfflineError } = api;

conn.save('https://example.invalid/exec', 'รหัสลับทดสอบ');

// ── ตัวช่วย ────────────────────────────────────────────────
let checked = 0, fails = 0;
function ok(cond, what) {
  checked++;
  if (!cond) { fails++; console.log('❌ ' + what); }
}
function eq(actual, expected, what) {
  ok(Object.is(actual, expected), what + ' — ได้ ' + JSON.stringify(actual) + ' ควรเป็น ' + JSON.stringify(expected));
}
const cell = (key, sid, value) => ({ key, sid, value });
const reply = (results) => ({
  text: async () => JSON.stringify({ ok: true, data: { results }, version: '9.9.9' })
});
const tick = () => new Promise(r => setTimeout(r, 0));
/** อ่านรายการที่ i แบบไม่ระเบิด — ถ้าไม่มี ให้เทสต์รายงานว่าไม่ผ่าน ไม่ใช่ throw
 *  ทั้งชุดจะได้รันจนจบและเห็นทุกจุดที่พังในรอบเดียว */
const at = (list, i) => list[i] || { payload: { classId: undefined, cells: [{}] } };

// ── 1. กดรัว ๆ ในห้องเดียวกัน ต้องยุบเป็นก้อนเดียว ค่าล่าสุดชนะ ──
queue.clear();
queue.push('setCells', { classId: 'c1', cells: [cell('W|1|a', '01', '5')] });
queue.push('setCells', { classId: 'c1', cells: [cell('W|1|a', '01', '8')] });
queue.push('setCells', { classId: 'c1', cells: [cell('W|1|a', '02', '3')] });
{
  const all = queue.all();
  eq(all.length, 1, 'กดรัวในห้องเดียวกันต้องเหลือก้อนเดียว');
  eq(at(all, 0).payload.cells.length, 2, 'ยุบแล้วต้องเหลือ 2 ช่อง (คนละนักเรียน)');
  const a = at(all, 0).payload.cells.find(c => c.sid === '01');
  eq(a.value, '8', 'ช่องเดิมที่กดซ้ำต้องได้ค่าล่าสุด');
}

// ── 2. คนละห้อง ห้ามยุบรวมกัน ──────────────────────────────
queue.push('setCells', { classId: 'c2', cells: [cell('W|1|a', '01', '7')] });
eq(queue.all().length, 2, 'คนละห้องต้องแยกก้อน');

// ── 3. ห้ามยุบเข้าก้อนที่กำลังส่งอยู่ ────────────────────────
queue.clear();
queue.push('setCells', { classId: 'c1', cells: [cell('W|1|a', '01', '1')] });
queue.mark(queue.all().map(o => o.id), true);
queue.push('setCells', { classId: 'c1', cells: [cell('W|1|a', '01', '2')] });
{
  const all = queue.all();
  eq(all.length, 2, 'กดแทรกตอนก้อนก่อนหน้ากำลังส่ง ต้องเป็นก้อนใหม่');
  eq(at(all, 0).payload.cells[0].value, '1', 'ก้อนที่กำลังส่งต้องไม่ถูกแก้');
  eq(at(all, 1).payload.cells[0].value, '2', 'ค่าที่เพิ่งกดต้องอยู่ในก้อนใหม่');
}

// ── 4. ส่งสำเร็จบางรายการ — ลบเฉพาะที่ยืนยัน ที่เหลือกลับเข้าคิว ──
queue.clear();
queue.push('setCells', { classId: 'c1', cells: [cell('W|1|a', '01', 'สำเร็จ')] });
queue.push('setCells', { classId: 'c2', cells: [cell('W|1|b', '01', 'ล้มเหลว')] });
globalThis.fetch = async () => reply([{ ok: true }, { ok: false, error: 'ชีตติดล็อกชั่วคราว' }]);
{
  const r = await flush();
  eq(r.sent, 1, 'ต้องนับว่าส่งสำเร็จ 1 รายการ');
  eq(r.failed.length, 1, 'ต้องรายงานรายการที่ล้ม 1 รายการ');
  const all = queue.all();
  eq(all.length, 1, 'รายการที่ล้มต้องยังอยู่ในคิว');
  eq(at(all, 0).payload.classId, 'c2', 'รายการที่ค้างต้องเป็นตัวที่เซิร์ฟเวอร์ปฏิเสธ');
  eq(at(all, 0).tries, 1, 'ต้องนับจำนวนครั้งที่ลองส่งแล้วไม่ผ่าน');
  eq(at(all, 0).sending, undefined, 'ธง sending ต้องถูกปลดหลังส่งจบ');
}

// ── 5. เซิร์ฟเวอร์ตอบไม่ครบ — ห้ามถือว่าสำเร็จ ────────────────
queue.clear();
queue.push('setCells', { classId: 'c1', cells: [cell('W|1|a', '01', 'x')] });
queue.push('setCells', { classId: 'c2', cells: [cell('W|1|b', '01', 'y')] });
globalThis.fetch = async () => reply([{ ok: true }]);          // ตอบมาแค่รายการเดียว
{
  const r = await flush();
  eq(r.sent, 1, 'ตอบไม่ครบ ต้องนับสำเร็จเฉพาะที่ยืนยันมา');
  eq(queue.all().length, 1, 'รายการที่ไม่มีคำตอบต้องอยู่ในคิวต่อ');
}

// ── 6. กดแทรกระหว่างรอคำตอบ ต้องไม่หายไปพร้อมก้อนที่ส่ง ────────
// เคสนี้แหละที่เคยทำคะแนนหาย — Apps Script ตอบ 1-3 วินาที
// ครูกดต่อได้อีกหลายครั้งในช่วงนั้น
queue.clear();
queue.push('setCells', { classId: 'c1', cells: [cell('W|1|a', '01', 'ก้อนแรก')] });
{
  let release;
  globalThis.fetch = () => new Promise(res => { release = () => res(reply([{ ok: true }])); });
  const p = flush();
  await tick();
  queue.push('setCells', { classId: 'c1', cells: [cell('W|1|a', '02', 'กดระหว่างรอ')] });
  release();
  await p;
  const all = queue.all();
  eq(all.length, 1, 'ของที่กดระหว่างรอคำตอบต้องยังอยู่');
  eq(at(all, 0).payload.cells[0].value, 'กดระหว่างรอ', 'ต้องเป็นค่าที่กดแทรกเข้ามา ไม่ใช่ก้อนที่ส่งไปแล้ว');
}

// ── 7. ส่งซ้อนกัน — รอบที่สองต้องไม่ยิงซ้ำ ───────────────────
queue.clear();
queue.push('setCells', { classId: 'c1', cells: [cell('W|1|a', '01', 'z')] });
{
  let release, hits = 0;
  globalThis.fetch = () => { hits++; return new Promise(res => { release = () => res(reply([{ ok: true }])); }); };
  const p1 = flush();
  await tick();
  const r2 = await flush();
  eq(r2.skipped, true, 'เรียก flush ซ้อนต้องถูกข้าม');
  release();
  await p1;
  eq(hits, 1, 'ต้องยิงไปเซิร์ฟเวอร์รอบเดียว');
}

// ── 8. เน็ตหลุดกลางคัน — คิวต้องอยู่ครบและปลดธง sending ───────
queue.clear();
queue.push('setCells', { classId: 'c1', cells: [cell('W|1|a', '01', 'ห้ามหาย')] });
globalThis.fetch = () => Promise.reject(new Error('เน็ตหลุด'));
{
  let caught = null;
  try { await flush(); } catch (e) { caught = e; }
  ok(caught instanceof OfflineError, 'เน็ตหลุดต้องโยน OfflineError ให้คนเรียกรู้');
  const all = queue.all();
  eq(all.length, 1, 'เน็ตหลุดแล้วคิวต้องอยู่ครบ');
  eq(at(all, 0).payload.cells[0].value, 'ห้ามหาย', 'ค่าที่ค้างต้องไม่ถูกแตะ');
  eq(at(all, 0).sending, undefined, 'ธง sending ต้องถูกปลด ไม่งั้นของที่กดต่อจะแยกก้อนไปเรื่อย ๆ');
}

// ── 9. ตัวช่วยรายงานงานที่ค้างนาน ───────────────────────────
queue.clear();
queue.push('setCells', { classId: 'c1', cells: [cell('W|1|a', '01', '1')] });
{
  const list = queue.all();
  list[0].tries = 4;
  queue.set(list);
  eq(queue.maxTries(), 4, 'maxTries ต้องคืนจำนวนครั้งที่ล้มมากที่สุด');
  eq(queue.stuck(3).length, 1, 'stuck() ต้องเห็นงานที่ลองแล้วไม่ผ่านตั้งแต่ 3 ครั้ง');
  eq(queue.stuck(5).length, 0, 'stuck() ต้องไม่นับงานที่ยังไม่ถึงเกณฑ์');
}

queue.clear();
if (fails) { console.log('❌ คิวออฟไลน์ไม่ผ่าน ' + fails + ' จุด จาก ' + checked); process.exit(1); }
console.log('✅ คิวออฟไลน์ผ่านครบ (' + checked + ' ข้อ)');
