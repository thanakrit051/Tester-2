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
  busy: false,
  stale: false,           // true = ข้อมูลมาจากแคช ยังไม่ได้ซิงค์
  webAppUrl: '',          // ลิงก์เปิดแอป (โหมด Apps Script เสิร์ฟเอง)
  user: null,             // บัญชีที่กำลังใช้งาน { email, name }
  installPrompt: null
};

const subs = new Set();
export function subscribe(fn) { subs.add(fn); return () => subs.delete(fn); }
export function emit() { subs.forEach(fn => fn()); }

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

// ── โหลดข้อมูล ──────────────────────────────────────────────

export async function bootstrap({ silent = false } = {}) {
  const cached = api.cache.get('bootstrap');
  if (cached) { state.config = cached.config || {}; state.classes = cached.classes || []; state.stale = true; emit(); }
  if (!api.conn.ready) return;

  try {
    const data = await api.call('bootstrap');
    state.config = data.config || {};
    state.classes = data.classes || [];
    state.webAppUrl = data.webAppUrl || '';
    state.user = api.serverInfo.user || null;
    state.stale = false;
    api.cache.set('bootstrap', data);
    emit();
  } catch (e) {
    if (!silent && !(e instanceof api.OfflineError)) toast(e.message, 'err');
    if (e instanceof api.ApiError && e.code === 'AUTH') throw e;
  }
}

export async function loadClass(classId, { force = false } = {}) {
  if (!classId) { state.cls = null; state.classId = ''; emit(); return; }
  state.classId = classId;
  api.lastClass.set(classId);

  const cached = api.cache.get('class.' + classId);
  if (cached) { state.cls = cached; state.stale = true; emit(); }
  if (!force && cached && !api.net.online) return;

  try {
    state.busy = true; emit();
    const data = await api.call('getClass', { classId });
    data.columns = sortColumns(data.columns || []);
    state.cls = data;
    state.stale = false;
    api.cache.set('class.' + classId, data);
  } catch (e) {
    if (!(e instanceof api.OfflineError)) toast(e.message, 'err');
    if (!cached) state.cls = null;
  } finally {
    state.busy = false; emit();
  }
}

function persistClass() {
  if (state.cls) api.cache.set('class.' + state.classId, state.cls);
}

// ── สร้าง/แก้ไขโครงสร้าง (ต้องออนไลน์) ─────────────────────

export async function createClass(meta, students) {
  const data = await api.call('createClass', { meta, students });
  await bootstrap({ silent: true });
  data.columns = sortColumns(data.columns || []);
  state.cls = data; state.classId = data.meta.classId;
  api.lastClass.set(state.classId);
  persistClass(); emit();
  return data;
}

export async function updateClassMeta(meta) {
  await api.call('updateClassMeta', { classId: state.classId, meta });
  await bootstrap({ silent: true });
  await loadClass(state.classId, { force: true });
}

export async function deleteClass(classId) {
  await api.call('deleteClass', { classId });
  api.cache.del('class.' + classId);
  if (state.classId === classId) { state.classId = ''; state.cls = null; }
  await bootstrap({ silent: true });
  emit();
}

export async function setStudents(students) {
  const data = await api.call('setStudents', { classId: state.classId, students });
  data.columns = sortColumns(data.columns || []);
  state.cls = data; persistClass();
  await bootstrap({ silent: true });
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
 * cells: [{ key, sid, value }]
 * quiet = true → ไม่วาดหน้าใหม่ (ให้ view อัปเดต DOM เองเพื่อความลื่น)
 */
export function setCells(cells, { quiet = false } = {}) {
  if (!cells.length || !state.cls) return;
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

export function getCell(key, sid) {
  return (state.cls?.values?.[key] || {})[sid] ?? '';
}

// ── ซิงค์ ───────────────────────────────────────────────────

let syncTimer = null;
function scheduleSync(ms = 1800) {
  clearTimeout(syncTimer);
  syncTimer = setTimeout(() => sync(), ms);
}

let syncing = false;
export async function sync({ loud = false } = {}) {
  if (syncing || !api.conn.ready) return;
  if (!api.queue.size) { if (loud) toast('ข้อมูลตรงกันแล้ว', 'ok'); return; }
  syncing = true; emit();
  try {
    const res = await api.flush();
    if (res.failed?.length) {
      toast(`ซิงค์ไม่สำเร็จ ${res.failed.length} รายการ: ${res.failed[0].error}`, 'err', 5000);
    } else if (loud) {
      toast(`ซิงค์แล้ว ${res.sent} รายการ`, 'ok');
    }
  } catch (e) {
    if (loud) toast(e instanceof api.OfflineError ? 'ยังออฟไลน์ — เก็บไว้ก่อน' : e.message, 'err');
  } finally {
    syncing = false; emit();
  }
}

export const isSyncing = () => syncing;

/** คำนวณคะแนนสรุปแล้วเขียนลงชีต */
export async function recalcOnServer() {
  await sync();
  const res = await api.call('recalc', { classId: state.classId });
  return res.rows;
}

export async function saveConfig(entries) {
  const cfg = await api.call('saveConfig', { entries });
  state.config = cfg;
  const boot = api.cache.get('bootstrap') || {};
  api.cache.set('bootstrap', { ...boot, config: cfg });
  emit();
}

// ซิงค์อัตโนมัติเมื่อกลับมาออนไลน์
api.net.onChange(() => { if (navigator.onLine) sync(); emit(); });
window.addEventListener('visibilitychange', () => { if (!document.hidden) sync(); });
