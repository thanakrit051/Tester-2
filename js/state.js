/* AssignCheck V2 — สถานะแอป + การอ่าน/เขียนข้อมูล (optimistic + ออฟไลน์) */

import * as api from './api.js';
import { toast } from './dom.js';
import { settingsFrom } from './score.js';

export const state = {
  config: {},
  classes: [],
  classId: '',
  cls: null,
  view: 'home',
  stale: false,           // true = ข้อมูลมาจากแคช ยังไม่ได้ซิงค์
  webAppUrl: '',          // ลิงก์เปิดแอป (โหมด Apps Script เสิร์ฟเอง)
  user: null,             // บัญชีที่กำลังใช้งาน { email, name }
  installPrompt: null
};

const subs = new Set();
export function subscribe(fn) { subs.add(fn); return () => subs.delete(fn); }

/**
 * แจ้งให้หน้าจอวาดใหม่
 * ห่อ try ไว้เพราะคนเรียก emit() ส่วนใหญ่คือฟังก์ชันที่เพิ่งบันทึกข้อมูลเสร็จ
 * ถ้าการวาดหน้าพังแล้วดันขึ้นมาถึงตรงนี้ การบันทึกจะดูเหมือนล้มไปด้วย
 * ทั้งที่ค่าลงคิวเรียบร้อยแล้ว
 */
function emitNow() {
  subs.forEach(fn => { try { fn(); } catch (e) { console.error(e); } });
}

/* ── กันไม่ให้การวาดหน้าใหม่ไปทำลายช่องที่ผู้ใช้กำลังกรอกอยู่ ──
 *
 * render() ล้าง DOM ทิ้งทั้งหน้าแล้วสร้างใหม่ ถ้ามันทำงานตอนที่ผู้ใช้
 * คาเคอร์เซอร์อยู่ในช่องไหน ช่องนั้นจะถูกแทนที่ด้วย element ตัวใหม่
 *   · ช่องข้อความ/ตัวเลข → เคอร์เซอร์เด้ง แป้นพิมพ์บนมือถือปิดเอง
 *   · <input type="date"> → ปฏิทินของเครื่องเกาะกับ element เดิมอยู่
 *     พอ element หาย ปฏิทินก็ปิดตัวเอง = ตั้งวันไม่ได้เลย
 *
 * iOS Safari ทำให้เห็นชัดที่สุด เพราะพอเปิดปฏิทินมันจะเซ็ตวันปัจจุบัน
 * แล้วยิง change ทันทีตั้งแต่ผู้ใช้ยังไม่ได้เลือกอะไร การวาดใหม่จึงเกิดขึ้น
 * ตอนปฏิทินเพิ่งกางออกมา — อาการคือ "ปฏิทินขึ้นแล้วปิดเอง"
 *
 * เดิมไล่แก้เป็นช่อง ๆ ซึ่งไม่จบ เพราะอะไรก็เรียก emit() ได้
 * จึงกันที่ต้นทางแทน: ระหว่างที่ปฏิทิน/นาฬิกาของเครื่องกางอยู่ ให้พัก
 * การวาดไว้ก่อน แล้วค่อยวาดตอนออกจากช่อง
 *
 * จงใจจำกัดไว้แค่ช่องที่มีหน้าต่างของระบบเกาะอยู่เท่านั้น
 * ถ้าพักการวาดให้ทุกช่องที่โฟกัส แล้วมีอะไรทำให้โฟกัสค้าง
 * ทั้งแอปจะหยุดอัปเดตไปเลย ซึ่งแย่กว่าอาการเดิมมาก
 * ช่องข้อความ/ตัวเลขแก้ที่ต้นทางไปแล้ว (บันทึกแบบ quiet + อัปเดต DOM เอง)
 */
const PICKER_TYPES = ['date', 'time', 'datetime-local', 'month', 'week'];
let pending = false;

/** ปฏิทิน/นาฬิกาของเครื่องกางอยู่ไหม */
const pickerOpen = () => {
  try {
    const el = document.activeElement;
    if (!el || el.tagName !== 'INPUT') return false;
    if (!PICKER_TYPES.includes(el.type)) return false;
    const app = document.getElementById('app');
    return !!(app && app.contains(el));
  } catch (e) { return false; }
};

let pendingSince = 0;

export function emit() {
  if (pickerOpen()) {
    if (!pending) pendingSince = Date.now();
    pending = true;
    return;
  }
  pending = false;
  emitNow();
}

/** ปฏิทินปิดแล้ว — ถ้ามีการวาดที่พักไว้ ค่อยทำตอนนี้ */
function flushPending() {
  if (!pending) return;
  // รอให้โฟกัสไปนิ่งก่อน กันกรณีย้ายจากช่องหนึ่งไปอีกช่องหนึ่ง
  setTimeout(() => { if (pending && !pickerOpen()) { pending = false; emitNow(); } }, 0);
}
try {
  document.addEventListener('focusout', flushPending, true);
  // ตาข่ายรับ: ผู้ใช้แตะหรือพิมพ์ที่อื่นเมื่อไหร่ ต้องไม่มีอะไรค้างอยู่
  document.addEventListener('click', flushPending, true);
  document.addEventListener('keydown', flushPending, true);
  document.addEventListener('visibilitychange', flushPending);

  // ตาข่ายชั้นสุดท้าย — เผื่อปฏิทินปิดไปโดยไม่ยิง event ที่เราดักไว้
  // (บางเบราว์เซอร์บนมือถือทำแบบนั้น) เช็คเบา ๆ วินาทีละครั้ง
  //
  // มีเพดานเวลาด้วย: ถ้าค้างเกิน 8 วินาทีให้วาดเลยไม่ว่าจะยังโฟกัสอยู่ไหม
  // เพราะถ้าโฟกัสค้างอยู่ในช่องด้วยเหตุอะไรก็ตาม แอปจะหยุดอัปเดตไปเรื่อย ๆ
  // ซึ่งแย่กว่าปฏิทินถูกปิดมาก — 8 วินาทีนานพอสำหรับการเลือกวันตามปกติ
  setInterval(() => {
    if (!pending) return;
    if (!pickerOpen() || Date.now() - pendingSince > 8000) { pending = false; emitNow(); }
  }, 1000);
} catch (e) {}

export function settings() { return settingsFrom(state.config); }

/** เปลี่ยนหน้า */
export function go(view) {
  if (state.view === view) return;
  state.view = view;
  window.scrollTo({ top: 0 });
  emit();
}

// ── ลำดับบล็อกซ้าย→ขวา (ให้ตรงกับชีต) ──────────────────────
const BLOCK_ORDER = ['ATT|1', 'WORK|1', 'QUIZ|1', 'MID|1', 'ATT|2', 'WORK|2', 'QUIZ|2', 'FIN|2', 'SUM|0'];
const blockIdx = (c) => {
  const i = BLOCK_ORDER.indexOf(c.kind + '|' + (c.kind === 'SUM' ? 0 : c.half));
  return i < 0 ? 99 : i;
};

function sortColumns(cols) {
  return cols.slice().sort((a, b) => blockIdx(a) - blockIdx(b) || String(a.id).localeCompare(String(b.id)));
}

/**
 * รับประกันรูปร่างของข้อมูลห้องเรียนก่อนเอาไปใช้
 *
 * ทุกหน้าจออ่าน cls.students / cls.columns / cls.values ตรง ๆ โดยไม่กันค่าว่าง
 * ถ้าได้ก้อนที่ไม่ครบ (แคชจากแอปเวอร์ชันเก่า · เขียนค้างตอนพื้นที่เต็ม ·
 * ชีตตอบไม่ครบ) หน้าจอจะพังทุกครั้งที่เปิด และเพราะแคชอยู่ในเครื่องถาวร
 * มันจะพังซ้ำทุกครั้งจนกว่าจะล้างข้อมูลเว็บทิ้งเอง — ครูแก้เองไม่ได้
 *
 * กันไว้ที่จุดเดียวตรงนี้ ดีกว่าไปไล่ใส่ ?? [] ทุกบรรทัดใน 8 ไฟล์
 */
function normalizeClass(d) {
  if (!d || typeof d !== 'object') return null;
  return {
    ...d,
    meta: (d.meta && typeof d.meta === 'object') ? d.meta : {},
    students: Array.isArray(d.students) ? d.students : [],
    columns: sortColumns(Array.isArray(d.columns) ? d.columns : []),
    values: (d.values && typeof d.values === 'object') ? d.values : {}
  };
}

// ── โหลดข้อมูล ──────────────────────────────────────────────

/**
 * โหลดทุกอย่างที่ต้องใช้ตอนเปิดแอปด้วยการยิงครั้งเดียว
 *
 * เดิมยิง 2 รอบเรียงกัน (bootstrap แล้วค่อย getClass) ซึ่งช้าเป็นเท่าตัว
 * เพราะ Apps Script ตอบรอบละ 1–3 วินาที · ห้องที่จะเปิดรู้ล่วงหน้าจากเครื่องอยู่แล้ว
 * จึงขอพร้อมกันไปเลยผ่านคำสั่ง batch ที่ฝั่งชีตมีอยู่แล้ว
 */
export async function bootAll() {
  const want = api.lastClass.get();

  // วาดจากแคชก่อน ผู้ใช้จะได้เห็นของทันทีระหว่างรอเน็ต
  const cachedBoot = api.cache.get('bootstrap');
  if (cachedBoot) {
    state.config = cachedBoot.config || {};
    state.classes = cachedBoot.classes || [];
    state.stale = true;
  }
  const cachedCls = want ? api.cache.get('class.' + want) : null;
  if (cachedCls) { state.cls = normalizeClass(cachedCls); state.classId = want; state.stale = true; }
  if (cachedBoot || cachedCls) emit();

  if (!api.conn.ready) return;

  const ops = [{ action: 'bootstrap', payload: {} }];
  if (want) ops.push({ action: 'getClass', payload: { classId: want } });

  let res;
  try {
    res = await api.call('batch', { ops });
  } catch (e) {
    if (!(e instanceof api.OfflineError)) toast(e.message, 'err');
    if (e instanceof api.ApiError && e.code === 'AUTH') throw e;
    return;
  }

  const list = res.results || [];
  const boot = list[0];
  if (boot && boot.ok) applyBootstrap(boot.data || {});

  const got = list[1];
  if (got && got.ok && got.data) {
    const d = got.data;
    state.cls = normalizeClass(d);
    state.classId = want;
    api.cache.set('class.' + want, state.cls);
  }
  emit();

  // ห้องที่จำไว้ถูกลบไปแล้ว หรือยังไม่เคยเลือกห้อง → เปิดห้องแรกให้
  const okClass = state.classes.some(c => c.classId === state.classId);
  if (!okClass) {
    const first = state.classes[0];
    if (first) await loadClass(first.classId);
    else { state.cls = null; state.classId = ''; emit(); }
  }
}

export async function loadClass(classId, { force = false } = {}) {
  if (!classId) { state.cls = null; state.classId = ''; emit(); return; }
  state.classId = classId;
  api.lastClass.set(classId);

  const cached = api.cache.get('class.' + classId);
  if (cached) { state.cls = normalizeClass(cached); state.stale = true; emit(); }
  if (!force && cached && !api.net.online) return;

  try {
    const data = await api.call('getClass', { classId });
    state.cls = normalizeClass(data);
    state.stale = false;
    api.cache.set('class.' + classId, state.cls);
  } catch (e) {
    if (!(e instanceof api.OfflineError)) toast(e.message, 'err');
    if (!cached) state.cls = null;
  } finally {
    emit();
  }
}

function persistClass() {
  if (state.cls) api.cache.set('class.' + state.classId, state.cls);
}

// ── สร้าง/แก้ไขโครงสร้าง (ต้องออนไลน์) ─────────────────────

/**
 * เอาผลของคำสั่ง bootstrap ไปใส่ state (ใช้ร่วมกันหลายที่)
 */
function applyBootstrap(d) {
  if (!d) return;
  state.config = d.config || {};
  state.classes = d.classes || [];
  state.webAppUrl = d.webAppUrl || '';
  state.user = api.serverInfo.user || null;
  state.stale = false;
  api.cache.set('bootstrap', d);
}

/**
 * ยิงหลายคำสั่งในรอบเดียว แล้วคืนผลเป็นอาเรย์
 *
 * Apps Script ตอบรอบละ 1-3 วินาที การยิงเรียงกันจึงคูณเวลารอตรง ๆ
 * ของเดิม "แก้ไขข้อมูลห้อง" ยิง 3 รอบต่อกัน (updateClassMeta → bootstrap
 * → getClass) ครูต้องรอ 3-9 วินาทีกว่าจะได้หน้าจอกลับมา
 * ฝั่งชีตรันคำสั่งใน batch เรียงตามลำดับให้อยู่แล้ว รวมได้เลย
 *
 * @param ops [{ action, payload }]
 * @param failMsg ข้อความเมื่อคำสั่งแรก (คำสั่งหลัก) ไม่ผ่าน
 */
async function batchCall(ops, failMsg) {
  const res = await api.call('batch', { ops });
  const list = res.results || [];
  const main = list[0];
  if (!main || !main.ok) throw new api.ApiError((main && main.error) || failMsg);
  return list;
}

export async function createClass(meta, students) {
  const [made, boot] = await batchCall([
    { action: 'createClass', payload: { meta, students } },
    { action: 'bootstrap',   payload: {} }
  ], 'สร้างห้องเรียนไม่สำเร็จ');

  if (boot && boot.ok) applyBootstrap(boot.data);
  state.cls = normalizeClass(made.data);
  state.classId = state.cls.meta.classId;
  api.lastClass.set(state.classId);
  persistClass(); emit();
  return made.data;
}

export async function updateClassMeta(meta) {
  const [, boot, got] = await batchCall([
    { action: 'updateClassMeta', payload: { classId: state.classId, meta } },
    { action: 'bootstrap',       payload: {} },
    { action: 'getClass',        payload: { classId: state.classId } }
  ], 'บันทึกข้อมูลห้องไม่สำเร็จ');

  if (boot && boot.ok) applyBootstrap(boot.data);
  if (got && got.ok && got.data) {
    state.cls = normalizeClass(got.data);
    state.stale = false;
    persistClass();
  }
  emit();
}

export async function deleteClass(classId) {
  const [, boot] = await batchCall([
    { action: 'deleteClass', payload: { classId } },
    { action: 'bootstrap',   payload: {} }
  ], 'ลบห้องเรียนไม่สำเร็จ');

  api.cache.del('class.' + classId);
  if (state.classId === classId) { state.classId = ''; state.cls = null; }
  if (boot && boot.ok) applyBootstrap(boot.data);
  emit();
}

export async function setStudents(students) {
  const [set, boot] = await batchCall([
    { action: 'setStudents', payload: { classId: state.classId, students } },
    { action: 'bootstrap',   payload: {} }
  ], 'บันทึกรายชื่อนักเรียนไม่สำเร็จ');

  state.cls = normalizeClass(set.data); persistClass();
  if (boot && boot.ok) applyBootstrap(boot.data);
  emit();
}

// ── คอลัมน์ (คาบเรียน / ชิ้นงาน / ข้อสอบ) ───────────────────

const uid = (p) => p + Math.random().toString(36).slice(2, 10);

/**
 * สร้างรหัสคอลัมน์ฝั่งเบราว์เซอร์ให้ตรงกับที่ Apps Script จะสร้าง
 * ทำให้เพิ่มคอลัมน์ตอนออฟไลน์แล้วซิงค์ทีหลังได้โดยไม่ซ้ำ
 */
function makeColumnSpec(p) {
  const kind = String(p.kind).toUpperCase();
  let half = Number(p.half) || 1;
  if (kind === 'MID') half = 1;
  if (kind === 'FIN') half = 2;

  if (kind === 'ATT') {
    const d = String(p.date).replace(/-/g, '');
    const period = Number(p.period) || 1;
    const id = `${d}-${period}`;
    const [, mm, dd] = String(p.date).split('-');
    return {
      key: `ATT|${half}|${id}`, kind, half, id, max: null,
      label: `${dd}/${mm}\nคาบ ${period}`, date: p.date, period,
      payload: { kind, half, date: p.date, period }
    };
  }

  const id = p.id || uid(kind[0].toLowerCase());
  const max = Number(p.max) || 0;
  const desc = String(p.desc || '');
  return {
    key: `${kind}|${half}|${id}`, kind, half, id, max, label: p.label, desc,
    payload: { kind, half, id, label: p.label, max, desc }
  };
}

/**
 * เพิ่มคอลัมน์ (ใช้ได้ทั้งออนไลน์และออฟไลน์)
 * @returns { key, created }
 */
export function ensureColumn(p, { quiet = false } = {}) {
  const spec = makeColumnSpec(p);
  if (!state.cls) throw new Error('ยังไม่ได้เลือกห้องเรียน');

  if (state.cls.columns.some(c => c.key === spec.key)) return { key: spec.key, created: false };

  const { payload, ...col } = spec;
  state.cls.columns = sortColumns([...state.cls.columns, col]);
  state.cls.values[spec.key] = state.cls.values[spec.key] || {};
  persistClass();
  api.queue.push('addColumn', { classId: state.classId, ...payload });
  scheduleSync();
  if (!quiet) emit();
  return { key: spec.key, created: true };
}

export async function updateColumn(key, patch) {
  const col = state.cls.columns.find(c => c.key === key);
  if (col) { Object.assign(col, patch); persistClass(); emit(); }
  api.queue.push('updateColumn', { classId: state.classId, key, ...patch });
  await sync();
}

export async function deleteColumn(key) {
  state.cls.columns = state.cls.columns.filter(c => c.key !== key);
  delete state.cls.values[key];
  persistClass(); emit();
  api.queue.push('deleteColumn', { classId: state.classId, key });
  await sync();
}

// ── เขียนค่า (optimistic เสมอ) ──────────────────────────────

/**
 * ประวัติแก้ไข (เลิกทำ) — เก็บเฉพาะรอบเปิดแอปนี้ ปิดหน้าแล้วหาย
 *
 * จุดเสี่ยงพลาดสุดคือปุ่ม "แก้ทีเดียวทั้งคอลัมน์/ทั้งวัน" (✓ ทุกคนมา,
 * ตั้งเต็มทั้งห้อง, ล้างคะแนน, วางจาก Excel) เพราะย้อนกลับด้วยมือไม่ไหว
 * ช่องเดียวไม่บันทึกไว้ใช้เพราะกดปุ่มเดิมซ้ำ = ยกเลิกอยู่แล้ว (ดู work.js/attendance.js)
 */
const HISTORY_MAX = 20;
let history = [];   // [{ classId, cells: [{ key, sid, prev }] }]

/**
 * cells: [{ key, sid, value }]
 * quiet = true → ไม่วาดหน้าใหม่ (ให้ view อัปเดต DOM เองเพื่อความลื่น)
 */
export function setCells(cells, { quiet = false } = {}) {
  if (!cells.length || !state.cls) return;

  history.push({
    classId: state.classId,
    cells: cells.map(c => ({ key: c.key, sid: c.sid, prev: (state.cls.values[c.key] || {})[c.sid] ?? '' }))
  });
  if (history.length > HISTORY_MAX) history.shift();

  for (const c of cells) {
    if (!state.cls.values[c.key]) state.cls.values[c.key] = {};
    if (c.value === '' || c.value === null || c.value === undefined) delete state.cls.values[c.key][c.sid];
    else state.cls.values[c.key][c.sid] = c.value;
  }
  persistClass();
  api.queue.push('setCells', { classId: state.classId, cells });
  scheduleSync();
  if (!quiet) emit();
}

/**
 * ย้อนการแก้ไขครั้งล่าสุดของห้องที่เปิดอยู่ (ค้นจากท้ายสุดของประวัติ
 * เผื่อสลับห้องไปมาระหว่างที่ยังไม่ปิดแอป) — เรียกจากปุ่ม "เลิกทำ" ใน toast
 * @returns จำนวนช่องที่ย้อนกลับ · 0 = ไม่มีอะไรให้ย้อน
 */
export function undoLastEdit() {
  const i = history.map(h => h.classId).lastIndexOf(state.classId);
  if (i < 0) return 0;
  const h = history.splice(i, 1)[0];
  setCells(h.cells.map(c => ({ key: c.key, sid: c.sid, value: c.prev })));
  return h.cells.length;
}

export function getCell(key, sid) {
  return (state.cls?.values?.[key] || {})[sid] ?? '';
}

// ── ซิงค์ ───────────────────────────────────────────────────

let syncTimer = null;
/** ส่งขึ้นชีตเร็วขึ้น — คำสั่งของห้องเดียวกันถูกรวมเป็นก้อนเดียวอยู่แล้ว จึงไม่เปลืองรอบ */
function scheduleSync(ms = 600) {
  clearTimeout(syncTimer);
  syncTimer = setTimeout(() => sync(), ms);
}

/**
 * สถานะซิงค์เปลี่ยนบ่อยมาก ถ้าสั่ง emit() จะวาดทั้งหน้าใหม่
 * ครูที่กำลังพิมพ์คะแนนอยู่จะโดนเคอร์เซอร์เด้ง — จึงบอกเฉพาะแถบหัวให้ไปอัปเดตเอง
 */
function syncChanged() {
  try { window.dispatchEvent(new CustomEvent('ac:sync')); } catch (e) {}
}

let syncing = false;
let syncFails = 0;      // ส่งไม่ผ่านติดกันกี่รอบ (รวมกรณีออฟไลน์ที่ยังไม่ทันนับ tries)

export async function sync({ loud = false } = {}) {
  if (syncing || !api.conn.ready) return;
  if (!api.queue.size) { if (loud) toast('ข้อมูลตรงกันแล้ว', 'ok'); syncFails = 0; return; }
  syncing = true; syncChanged();
  try {
    const res = await api.flush();
    if (res.failed?.length) {
      syncFails++;
      // ของที่ส่งไม่ผ่านยังอยู่ในคิว จะลองใหม่ให้เอง — บอกให้ครูรู้ว่ายังไม่หาย
      toast(`ยังส่งไม่ได้ ${res.failed.length} รายการ (เก็บไว้ให้แล้ว จะลองใหม่): ${res.failed[0].error}`, 'err', 5000);
    } else {
      syncFails = 0;
      if (loud) toast(`ซิงค์แล้ว ${res.sent} รายการ`, 'ok');
    }
  } catch (e) {
    syncFails++;
    if (loud) toast(e instanceof api.OfflineError ? 'ยังออฟไลน์ — เก็บไว้ก่อน' : e.message, 'err');
  } finally {
    syncing = false; syncChanged();
    // ของที่เพิ่งกดระหว่างกำลังส่งอยู่ ต้องไม่ค้างคิวรอจนกว่าจะกดครั้งถัดไป
    if (api.queue.size) scheduleSync(retryDelay());
  }
}

/**
 * รอนานขึ้นเรื่อย ๆ เมื่อส่งไม่ผ่านซ้ำ ๆ
 * ถ้าลองใหม่ทุก 400 มิลลิวินาทีตลอด ตอนออฟไลน์หรือชีตมีปัญหา
 * แอปจะวนยิงไม่หยุด กินแบตและโดน Apps Script ปฏิเสธเพราะเรียกถี่เกิน
 */
function retryDelay() {
  const n = Math.max(api.queue.maxTries(), syncFails);
  if (!n) return 400;                              // ยังไม่เคยพลาด — ส่งของใหม่ให้ไว
  return Math.min(60_000, 2000 * 2 ** (n - 1));    // 2s → 4s → 8s … สูงสุด 1 นาที
}

export const isSyncing = () => syncing;

/** คำนวณคะแนนสรุปแล้วเขียนลงชีต */
export async function recalcOnServer() {
  await sync();
  const res = await api.call('recalc', { classId: state.classId });
  return res.rows;
}

/**
 * @param quiet true = บันทึกแล้วไม่วาดหน้าใหม่
 *   ใช้ตอนที่ครูยังอยู่ในช่องกรอก การวาดใหม่จะทำลาย element ที่โฟกัสอยู่
 *   ซึ่งกับ <input type="date"> แปลว่าปฏิทินที่เปิดค้างอยู่ถูกปิดทิ้งกลางคัน
 */
export async function saveConfig(entries, { quiet = false } = {}) {
  const cfg = await api.call('saveConfig', { entries });
  state.config = cfg;
  const boot = api.cache.get('bootstrap') || {};
  api.cache.set('bootstrap', { ...boot, config: cfg });
  if (!quiet) emit();
}

// ซิงค์อัตโนมัติเมื่อกลับมาออนไลน์
api.net.onChange(() => { if (navigator.onLine) sync(); emit(); });
window.addEventListener('visibilitychange', () => { if (!document.hidden) sync(); });
