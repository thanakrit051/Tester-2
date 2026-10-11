/**
 * ทดสอบขึ้นภาคเรียนใหม่ — apps-script/09_NewTerm.gs → newTerm_
 *
 * รัน:  node test/newterm.mjs
 *
 * ทำไมต้องมี: เป็นคำสั่งเดียวในระบบที่ลบข้อมูลทีละหลายห้อง พลาดแล้วกู้คืนได้ทางเดียวคือไฟล์สำรอง
 * จึงต้องแน่ใจว่า
 *   1. สำรองไฟล์ก่อนแตะอะไรเสมอ — สำรองไม่ผ่าน = ไม่มีอะไรเปลี่ยน
 *   2. ห้องที่จะล้างหาไม่เจอ = ไม่ทำอะไรเลย (ไม่ใช่ลบไปครึ่งหนึ่งแล้วพัง)
 *      กดซ้ำหลังพังกลางทางได้ — ห้องที่ลบไปแล้วข้ามไป · ชื่อไฟล์สำรองยังเป็นภาคเรียนเดิม
 *   3. "ล้างคะแนน" เก็บรายชื่อ รหัสห้อง ชื่อแท็บ และตำแหน่งแท็บไว้ครบ เหลือแค่บล็อกสรุป
 *   4. "ลบห้อง" ลบทั้งแท็บและแถวในสารบัญ ห้องที่ไม่ได้เลือกไม่ถูกแตะ
 */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const gs = path.join(root, 'apps-script');

// ── ชีตจำลอง: เก็บแค่ค่าในช่อง · คำสั่งจัดรูปแบบรับแล้วไม่ทำอะไร ──────────
function makeSheet(name) {
  const grid = [];
  let maxRows = 60, maxCols = 30;
  const at = (r, c) => (grid[r - 1] && grid[r - 1][c - 1] !== undefined) ? grid[r - 1][c - 1] : '';
  const put = (r, c, v) => { while (grid.length < r) grid.push([]); grid[r - 1][c - 1] = v; };
  const edge = () => {
    let lr = 0, lc = 0;
    grid.forEach((row, i) => row.forEach((v, j) => {
      if (v === '' || v === undefined) return;
      lr = Math.max(lr, i + 1); lc = Math.max(lc, j + 1);
    }));
    return { lr, lc };
  };
  const chain = (self) => new Proxy(self, { get: (t, k) => (k in t ? t[k] : () => chain(self)) });

  const sh = {
    name,
    getName: () => sh.name,
    setName: (n) => { sh.name = n; return sh; },
    getLastRow: () => edge().lr,
    getLastColumn: () => edge().lc,
    getMaxRows: () => maxRows,
    getMaxColumns: () => maxCols,
    insertColumnsAfter: (_c, n) => { maxCols += n; return sh; },
    insertRowsAfter: (_r, n) => { maxRows += n; return sh; },
    clear: () => { grid.length = 0; return sh; },
    getRange(r, c, nr = 1, nc = 1) {
      const grab = (pick) => Array.from({ length: nr }, (_, i) => Array.from({ length: nc }, (_, j) => pick(r + i, c + j)));
      const range = {
        getValues: () => grab(at),
        getValue: () => at(r, c),
        getNotes: () => grab(() => ''),
        setValues(v) { for (let i = 0; i < nr; i++) for (let j = 0; j < nc; j++) put(r + i, c + j, v[i][j]); return chain(range); },
        setValue(v) { return range.setValues([[v]]); },
        clearContent() { return range.setValues(grab(() => '')); }
      };
      return chain(range);
    }
  };
  return chain(sh);
}

function makeSpreadsheet() {
  const sheets = [];
  const ss = {
    sheets,
    getId: () => 'FILE1',
    getSheets: () => sheets.slice(),
    getSheetByName: (n) => sheets.find(s => s.getName() === n) || null,
    insertSheet(n, index) {
      const s = makeSheet(n);
      if (index === undefined) sheets.push(s); else sheets.splice(index, 0, s);
      s.getIndex = () => sheets.indexOf(s) + 1;
      return s;
    },
    deleteSheet(s) { sheets.splice(sheets.indexOf(s), 1); }
  };
  return ss;
}

// ── โหลดโค้ดฝั่งชีต (01_Setup.gs ไม่โหลด — จำลองสารบัญกับค่าตั้งค่าเอง) ─────
function setup({ archiveFails = false } = {}) {
  const ss = makeSpreadsheet();
  const log = [];
  const config = { year: '2568', term: '1', teacher: 'ครูเอ', mid_date: '2025-08-01', apiKey: 'k' };
  const index = [];                                   // สารบัญ 🏫 ห้องเรียน

  const ctx = {
    console,
    SpreadsheetApp: { getActiveSpreadsheet: () => ss, BorderStyle: { SOLID: 1, SOLID_MEDIUM: 2 },
      newDataValidation: () => new Proxy({}, { get: () => function () { return this; } }) },
    Utilities: { getUuid: () => 'abcdef12-0000-0000-0000-000000000000', formatDate: () => '2026-10-11' },
    Session: { getScriptTimeZone: () => 'Asia/Bangkok' },
    DriveApp: {
      getFileById: () => ({
        getName: () => 'AssignCheck',
        getParents: () => ({ hasNext: () => false }),
        makeCopy(name) {
          if (archiveFails) throw new Error('Drive เต็ม');
          log.push('archive');
          return { getName: () => name, getUrl: () => 'https://drive/copy' };
        }
      }),
      getRootFolder: () => ({
        getFoldersByName: () => ({ hasNext: () => false }),
        createFolder: (n) => ({ name: n })
      })
    },
    getConfig_: () => ({ ...config }),
    setConfigValue_: (k, v) => { log.push('config:' + k); config[k] = v; },
    listClasses_: () => index.slice(),
    upsertClassRow_: (meta, n) => {
      const i = index.findIndex(x => x.classId === meta.classId);
      const row = { classId: meta.classId, sheetName: meta.sheetName, studentCount: n };
      if (i >= 0) index[i] = row; else index.push(row);
    },
    removeClassRow_: (id) => { log.push('unindex:' + id); const i = index.findIndex(x => x.classId === id); if (i >= 0) index.splice(i, 1); },
    requireSheet_: (id) => { const s = ctx.sheetForClass_(id); if (!s) throw new Error('ไม่พบห้องเรียน: ' + id); return s; }
  };
  vm.createContext(ctx);
  vm.runInContext(['00_Constants.gs', '02_ClassSheet.gs', '09_NewTerm.gs']
    .map(f => fs.readFileSync(path.join(gs, f), 'utf8')).join('\n'), ctx);
  return { ss, ctx, log, config, index };
}

/** สร้างห้องด้วยโค้ดจริง แล้วกรอกเช็คชื่อกับคะแนนลงไป */
function seed(ctx, meta, students) {
  const d = ctx.createClass_(meta, students);
  const sh = ctx.sheetForClass_(d.meta.classId);
  ctx.ensureColumn_(sh, 'ATT|1|20250601-1', '1 มิ.ย.', '');
  ctx.ensureColumn_(sh, 'WORK|1|w1', 'ใบงาน 1', 10, 'ทำข้อ 1-5', 5);
  ctx.writeCells_(sh, students.map(s => ({ key: 'ATT|1|20250601-1', sid: s.sid, value: 'ม' }))
    .concat(students.map(s => ({ key: 'WORK|1|w1', sid: s.sid, value: 8 }))));
  return d.meta.classId;
}

let fail = 0, pass = 0;
function eq(name, got, want) {
  const a = JSON.stringify(got), b = JSON.stringify(want);
  if (a === b) { pass++; return; }
  fail++;
  console.log('  ✗ ' + name + '\n      ได้: ' + a + '\n      ควรได้: ' + b);
}
function throws(name, fn, re) {
  try { fn(); } catch (e) { if (re.test(String(e.message))) { pass++; return; } fail++; console.log('  ✗ ' + name + ' — error ผิด: ' + e.message); return; }
  fail++; console.log('  ✗ ' + name + ' — ควร throw แต่ไม่');
}

const KIDS = [{ no: '1', sid: '101', name: 'กฤต' }, { no: '2', sid: '102', name: 'ขวัญ' }, { no: '3', sid: '103', name: 'คิม' }];

// ── 1. ล้างคะแนน + ลบ + ไม่แตะ ในคำสั่งเดียว ─────────────────────────────
{
  const { ss, ctx, log, config, index } = setup();
  ctx.uid_ = (() => { let n = 0; return (p) => p + 'id' + (++n); })();
  const a = seed(ctx, { subject: 'คณิต', grade: 'ม.1', room: '1' }, KIDS);
  const b = seed(ctx, { subject: 'วิทย์', grade: 'ม.2', room: '3' }, KIDS.slice(0, 2));
  const c = seed(ctx, { subject: 'ไทย', grade: 'ม.3', room: '2' }, KIDS.slice(0, 1));
  const order = ss.sheets.map(s => s.getName());
  log.length = 0;

  const res = ctx.newTerm_({ year: '2568', term: '2', reset: [a], drop: [b],
    config: { mid_date: '', student_summary: 'off', apiKey: 'แฮก', w_mid: 99 } });

  eq('สำรองก่อนทำอย่างอื่น', log[0], 'archive');
  eq('ปี/ภาคเรียนเขียนหลังจัดห้องเสร็จ (กดซ้ำแล้วชื่อไฟล์สำรองยังถูก)',
    log.indexOf('unindex:' + b) < log.indexOf('config:year'), true);
  eq('ผลลัพธ์', [res.reset, res.dropped, res.archive.url], [1, 1, 'https://drive/copy']);
  eq('ชื่อไฟล์สำรองบอกภาคเรียนเดิม', /^ภาคเรียนที่ 1\/2568/.test(res.archive.name), true);
  eq('ตั้งปี/ภาคเรียนใหม่', [config.year, config.term, config.mid_date, config.student_summary], ['2568', '2', '', 'off']);
  eq('ค่าที่ไม่อยู่ในรายการ ห้ามเขียน', [config.apiKey, config.w_mid], ['k', undefined]);

  // ห้องที่ล้างคะแนน
  const sa = ctx.sheetForClass_(a);
  const da = ctx.readClassBySheet_(sa);
  eq('ล้างคะแนน: รายชื่อครบ', da.students, KIDS);
  eq('ล้างคะแนน: เหลือแต่คอลัมน์สรุป', da.columns.every(x => x.kind === 'SUM'), true);
  eq('ล้างคะแนน: ไม่มีค่าค้าง', Object.values(da.values).every(m => Object.keys(m).length === 0), true);
  eq('ล้างคะแนน: ข้อมูลห้องเดิม', [da.meta.classId, da.meta.subject, da.meta.grade, String(da.meta.room)], [a, 'คณิต', 'ม.1', '1']);
  eq('ล้างคะแนน: ปี/เทอมในแถว 2 เป็นของใหม่', [String(da.meta.year), String(da.meta.term)], ['2568', '2']);
  eq('ล้างคะแนน: ชื่อแท็บเดิม ตำแหน่งเดิม', ss.sheets[0].getName(), order[0]);
  eq('ล้างคะแนน: สารบัญชี้แท็บเดิม จำนวนคนถูก',
    index.find(x => x.classId === a), { classId: a, sheetName: order[0], studentCount: 3 });

  // ห้องที่ลบ
  eq('ลบ: แท็บหาย', ctx.sheetForClass_(b), null);
  eq('ลบ: ออกจากสารบัญ', index.some(x => x.classId === b), false);

  // ห้องที่ไม่แตะ
  const dc = ctx.readClassBySheet_(ctx.sheetForClass_(c));
  eq('ไม่แตะ: คะแนนอยู่ครบ', dc.values['WORK|1|w1'], { 101: 8 });
  eq('ไม่แตะ: ปี/เทอมเดิม', String(dc.meta.term), '1');
  eq('เหลือ 2 แท็บ ลำดับเดิม', ss.sheets.map(s => s.getName()), [order[0], order[2]]);
}

// ── 2. สำรองไม่ผ่าน = ไม่มีอะไรเปลี่ยน ──────────────────────────────────
{
  const { ss, ctx, config } = setup({ archiveFails: true });
  ctx.uid_ = (() => { let n = 0; return (p) => p + 'id' + (++n); })();
  const a = seed(ctx, { subject: 'คณิต' }, KIDS);
  throws('สำรองไม่ผ่าน → error', () => ctx.newTerm_({ year: '2569', term: '1', drop: [a] }), /Drive/);
  eq('สำรองไม่ผ่าน: ห้องยังอยู่', ss.sheets.length, 1);
  eq('สำรองไม่ผ่าน: ปี/เทอมไม่เปลี่ยน', [config.year, config.term], ['2568', '1']);
}

// ── 3. รหัสห้องผิด / ห้องซ้ำ 2 ตัวเลือก / ไม่กรอกปี = ไม่ทำอะไรเลย ─────────
{
  const { ss, ctx, log } = setup();
  ctx.uid_ = (() => { let n = 0; return (p) => p + 'id' + (++n); })();
  const a = seed(ctx, { subject: 'คณิต' }, KIDS);
  log.length = 0;
  // ห้องที่จะล้างหาไม่เจอ = หยุดก่อนลบห้องอื่น (ห้องที่จะลบหาไม่เจอ = ลบไปแล้ว ข้ามได้ ดูข้อ 4)
  throws('รหัสห้องที่จะล้างผิด', () => ctx.newTerm_({ year: '2569', term: '1', reset: ['nope'], drop: [a] }), /ไม่พบห้องเรียน/);
  throws('ห้องเดียวกันทั้งล้างและลบ', () => ctx.newTerm_({ year: '2569', term: '1', reset: [a], drop: [a] }), /ทั้ง/);
  throws('ไม่กรอกปี', () => ctx.newTerm_({ year: ' ', term: '1' }), /ปีการศึกษา/);
  eq('ไม่มีอะไรถูกแตะ', [log.length, ss.sheets.length, ctx.readClassBySheet_(ss.sheets[0]).values['WORK|1|w1']],
    [0, 1, { 101: 8, 102: 8, 103: 8 }]);
}

// ── 4. กดซ้ำหลังพังกลางทาง — ห้องที่ลบไปแล้วต้องไม่ทำให้ทั้งคำสั่งล้ม · รหัสซ้ำไม่ล้างซ้ำ ──
{
  const { ss, ctx, config, index } = setup();
  ctx.uid_ = (() => { let n = 0; return (p) => p + 'id' + (++n); })();
  const a = seed(ctx, { subject: 'คณิต' }, KIDS);
  const b = seed(ctx, { subject: 'วิทย์' }, KIDS);
  // รอบแรกลบ b ไปแล้ว แต่พังก่อนเขียนปี/ภาคเรียน
  ss.deleteSheet(ctx.sheetForClass_(b));
  delete ctx.SHEET_FOR_CLASS_MEMO_[b];
  const res = ctx.newTerm_({ year: '2568', term: '2', reset: [a, a], drop: [b] });
  eq('กดซ้ำ: สำเร็จ', [res.reset, res.dropped], [1, 1]);
  eq('กดซ้ำ: ชื่อไฟล์สำรองยังเป็นภาคเรียนเดิม', /^ภาคเรียนที่ 1\/2568/.test(res.archive.name), true);
  eq('กดซ้ำ: ห้องที่ลบออกจากสารบัญ', index.some(x => x.classId === b), false);
  eq('กดซ้ำ: ห้องที่ล้างเหลือแท็บเดียว รายชื่อครบ',
    [ss.sheets.length, ctx.readClassBySheet_(ctx.sheetForClass_(a)).students.length], [1, 3]);
  eq('กดซ้ำ: ภาคเรียนใหม่', config.term, '2');
}

if (fail) {
  console.log(`\n❌ ขึ้นภาคเรียนใหม่ ไม่ผ่าน ${fail} ข้อ (ผ่าน ${pass})`);
  process.exit(1);
}
console.log(`✅ ขึ้นภาคเรียนใหม่ผ่านครบ (${pass} ข้อ)`);
