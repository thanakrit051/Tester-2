/**
 * ทดสอบตัวอ่านแท็บห้องเรียน — apps-script/02_ClassSheet.gs → readClassBySheet_
 *
 * รัน:  node test/classsheet.mjs
 *
 * ทำไมต้องมี: คำสั่งนี้ถูกเรียกบ่อยที่สุดในระบบ (เปิดแอป · สลับห้อง ·
 * หลังบันทึกทุกครั้ง) และเป็นจุดเดียวที่แปลง "ตารางในชีต" เป็น "ข้อมูลที่ทุกหน้าใช้"
 * ถ้าอ่านเลื่อนไปแถวเดียว คะแนนจะไปโผล่ผิดคน โดยหน้าจอไม่มีอะไรเตือนเลย
 *
 * ตรวจ 2 อย่าง
 *   1. อ่านได้ถูกต้อง — รวมถึงกรณีมีแถวว่างคั่นกลางรายชื่อ
 *   2. คุยกับชีตไม่เกินที่ควร — Apps Script คิดเวลาตามจำนวนครั้งที่เรียก
 *      ไม่ใช่ตามปริมาณข้อมูล การเผลอกลับไปอ่านทีละแถวจึงช้าลงทันทีโดยไม่มีใครรู้
 */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const gs = path.join(root, 'apps-script');
const ctx = { console, SpreadsheetApp: {}, Utilities: {} };
vm.createContext(ctx);
vm.runInContext(
  fs.readFileSync(path.join(gs, '00_Constants.gs'), 'utf8') + '\n' +
  fs.readFileSync(path.join(gs, '02_ClassSheet.gs'), 'utf8'), ctx);

const R_META = 2, R_KEY = 4, R_LABEL = 5, R_MAX = 6;

/* ── ชีตจำลอง ──────────────────────────────────────────────
 * ชีตจริงมีแถว/คอลัมน์ว่างเผื่อไว้เสมอ (initClassLayout_ จองไว้ 30 คอลัมน์)
 * จึงต้องจำลองให้ใหญ่กว่าข้อมูลจริง ไม่งั้นจะไปจับ bug ที่ไม่มีอยู่จริง */
function makeSheet(grid, notes, name = '5/1 · คณิตศาสตร์') {
  const maxRows = Math.max(grid.length, 50);
  const maxCols = Math.max(30, ...grid.map(r => r.length));
  const at = (r, c) => (grid[r - 1] && grid[r - 1][c - 1] !== undefined) ? grid[r - 1][c - 1] : '';

  let lastRow = 0, lastCol = 0;
  for (let r = 1; r <= maxRows; r++) {
    for (let c = 1; c <= maxCols; c++) {
      if (at(r, c) === '') continue;
      if (r > lastRow) lastRow = r;
      if (c > lastCol) lastCol = c;
    }
  }

  let calls = 0;
  return {
    calls: () => calls,
    getName: () => name,
    getLastRow: () => lastRow,
    getLastColumn: () => lastCol,
    getMaxRows: () => maxRows,
    getMaxColumns: () => maxCols,
    getRange(r, c, nr = 1, nc = 1) {
      if (r < 1 || c < 1 || r + nr - 1 > maxRows || c + nc - 1 > maxCols) {
        throw new Error('ขอช่วงเกินขอบชีต: r=' + r + ' c=' + c + ' nr=' + nr + ' nc=' + nc);
      }
      const grab = (pick) => {
        calls++;
        const out = [];
        for (let i = 0; i < nr; i++) {
          const row = [];
          for (let j = 0; j < nc; j++) row.push(pick(r + i, c + j));
          out.push(row);
        }
        return out;
      };
      return {
        getValues: () => grab(at),
        getValue: () => { calls++; return at(r, c); },
        getNotes: () => grab((rr, cc) => (rr === R_LABEL && notes) ? (notes[cc - 1] || '') : '')
      };
    }
  };
}

/** ประกอบตารางในชีตจากรายชื่อ + คอลัมน์ (holes = แทรกแถวว่างก่อนนักเรียนลำดับนั้น) */
function build({ students, cols, holes = [] }) {
  const width = Math.max(3 + cols.length, 8);   // แถวข้อมูลระบบกินถึงคอลัมน์ H เสมอ
  const g = Array.from({ length: R_MAX + students.length + holes.length }, () => Array(width).fill(''));
  g[0][0] = '📘 คณิตศาสตร์ · ม.5/1';
  ['C1234abcd', 'คณิตศาสตร์', 'ค21101', 'ม.5', '1', 'ครูเอ', '2568', '1']
    .forEach((v, i) => { g[R_META - 1][i] = v; });
  ['NO', 'SID', 'NAME'].forEach((k, i) => { g[R_KEY - 1][i] = k; });
  ['เลขที่', 'เลขประจำตัว', 'ชื่อ-นามสกุล'].forEach((k, i) => { g[R_LABEL - 1][i] = k; });
  cols.forEach((c, i) => {
    g[R_KEY - 1][3 + i] = c.key;
    g[R_LABEL - 1][3 + i] = c.label;
    g[R_MAX - 1][3 + i] = c.max;
  });
  let r = R_MAX;
  students.forEach((s, si) => {
    if (holes.includes(si)) r++;
    g[r][0] = s.no; g[r][1] = s.sid; g[r][2] = s.name;
    cols.forEach((c, i) => { g[r][3 + i] = s.vals[i] === undefined ? '' : s.vals[i]; });
    r++;
  });
  return { grid: g, notes: ['', '', '', ...cols.map(c => c.desc || '')] };
}

let fail = 0, pass = 0;
// เงียบตอนผ่าน — preflight รันหลายชุดต่อกัน ถ้าทุกชุดพ่นทีละบรรทัดจะกลบชุดที่ไม่ผ่าน
function eq(name, got, want) {
  const a = JSON.stringify(got), b = JSON.stringify(want);
  if (a === b) { pass++; return; }
  fail++;
  console.log('  ✗ ' + name + '\n      ได้: ' + a + '\n      ควรได้: ' + b);
}

// ── 1. อ่านห้องปกติ ────────────────────────────────────────
{
  const { grid, notes } = build({
    students: [
      { no: '1', sid: '10001', name: 'สมชาย ใจดี',      vals: ['ม', 8, 'L7', 18] },
      { no: '2', sid: '10002', name: 'สมหญิง รักเรียน', vals: ['ส', 'x', 10, ''] },
      { no: '3', sid: '10003', name: 'มานี มีนา',       vals: ['', '', '', 0] }
    ],
    cols: [
      { key: 'ATT|1|20260807-1', label: '07/08',   max: '' },
      { key: 'WORK|1|w1',        label: 'ใบงาน 1', max: 10, desc: 'ส่งในคาบ' },
      { key: 'WORK|1|w2',        label: 'ใบงาน 2', max: 10 },
      { key: 'MID|1|mid',        label: 'กลางภาค', max: 20 }
    ]
  });
  const sh = makeSheet(grid, notes);
  const d = ctx.readClassBySheet_(sh);

  eq('ข้อมูลระบบ', d.meta, {
    classId: 'C1234abcd', subject: 'คณิตศาสตร์', subjectCode: 'ค21101', grade: 'ม.5',
    room: '1', teacher: 'ครูเอ', year: '2568', term: '1', sheetName: '5/1 · คณิตศาสตร์'
  });
  eq('รายชื่อ', d.students.map(s => s.sid), ['10001', '10002', '10003']);
  eq('คะแนนเต็ม (ว่าง = null)', d.columns.map(c => c.max), [null, 10, 10, 20]);
  eq('รายละเอียดงานจากโน้ต', d.columns[1].desc, 'ส่งในคาบ');
  eq('คาบเรียนถอดวันที่ออกมาได้', [d.columns[0].date, d.columns[0].period], ['2026-08-07', 1]);
  eq('ค่าเช็คชื่อ', d.values['ATT|1|20260807-1'], { 10001: 'ม', 10002: 'ส' });
  eq('ค่างาน (ส่งช้า/ไม่ส่ง เก็บดิบไว้)', d.values['WORK|1|w1'], { 10001: 8, 10002: 'x' });
  eq('ศูนย์ต้องไม่ถูกทิ้งเหมือนช่องว่าง', d.values['MID|1|mid'], { 10001: 18, 10003: 0 });
  eq('เรียกชีตไม่เกิน 4 ครั้ง', sh.calls() <= 4, true);
}

// ── 2. มีแถวว่างคั่นกลางรายชื่อ ────────────────────────────
// เคยพลาดมาแล้ว: ของเดิมนับแถวข้อมูลแบบต่อเนื่องจาก R_DATA ทั้งที่รายชื่อ
// อาจไม่ติดกัน คะแนนของคนหลังแถวว่างจึงเลื่อนไปสวมของคนอื่นเงียบ ๆ
{
  const { grid, notes } = build({
    students: [
      { no: '1', sid: '20001', name: 'ก', vals: ['ม', 5] },
      { no: '2', sid: '20002', name: 'ข', vals: ['ข', 6] },
      { no: '3', sid: '20003', name: 'ค', vals: ['ล', 7] }
    ],
    cols: [
      { key: 'ATT|2|20261201-2', label: '01/12', max: '' },
      { key: 'WORK|2|w9',        label: 'งาน',   max: 10 }
    ],
    holes: [1, 2]
  });
  const d = ctx.readClassBySheet_(makeSheet(grid, notes));
  eq('รายชื่อข้ามแถวว่าง', d.students.map(s => s.sid), ['20001', '20002', '20003']);
  eq('คะแนนยังตรงคนเดิม', d.values['WORK|2|w9'], { 20001: 5, 20002: 6, 20003: 7 });
  eq('เช็คชื่อยังตรงคนเดิม', d.values['ATT|2|20261201-2'], { 20001: 'ม', 20002: 'ข', 20003: 'ล' });
}

// ── 3. ห้องว่าง / รหัสคอลัมน์เสีย ───────────────────────────
{
  const empty = build({ students: [], cols: [{ key: 'WORK|1|w1', label: 'งาน', max: 10 }] });
  const d1 = ctx.readClassBySheet_(makeSheet(empty.grid, empty.notes));
  eq('ห้องที่ยังไม่มีนักเรียน', [d1.students.length, d1.columns.length], [0, 1]);

  const junk = build({
    students: [{ no: '1', sid: '4001', name: 'จ', vals: [1, 2, 3] }],
    cols: [
      { key: 'WORK|1|ok',   label: 'ดี',  max: 10 },
      { key: 'ขยะ',         label: 'พัง', max: 5 },
      { key: 'SUM|0|total', label: 'รวม', max: 100 }
    ]
  });
  const d2 = ctx.readClassBySheet_(makeSheet(junk.grid, junk.notes));
  eq('ข้ามคอลัมน์ที่รหัสอ่านไม่ออก', d2.columns.map(c => c.key), ['WORK|1|ok', 'SUM|0|total']);
  eq('ค่าไม่เลื่อนตามคอลัมน์ที่ข้าม', d2.values['SUM|0|total'], { 4001: 3 });
}

if (fail) {
  console.error('\n❌ ตัวอ่านแท็บห้องเรียนไม่ผ่าน ' + fail + ' ข้อ');
  process.exit(1);
}
console.log('✅ ตัวอ่านแท็บห้องเรียนผ่านครบ (' + pass + ' ข้อ)');
