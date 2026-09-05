/**
 * ทดสอบว่าสูตรคะแนน 2 ฝั่งให้ผลตรงกัน
 *   js/score.js  (เบราว์เซอร์ — แสดงผลทันที/ออฟไลน์)
 *   apps-script/03_Score.gs  (เขียนลงชีต)
 *
 * รัน:  node test/parity.mjs
 */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { computeClass, settingsFrom } from '../js/score.js';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const gs = path.join(root, 'apps-script');

const src = fs.readFileSync(path.join(gs, '00_Constants.gs'), 'utf8') + '\n' +
            fs.readFileSync(path.join(gs, '03_Score.gs'), 'utf8');
const ctx = { console, SpreadsheetApp: {}, Utilities: {} };
vm.createContext(ctx);
vm.runInContext(src, ctx);

const baseCfg = {
  w_work1: 10, w_quiz1: 10, w_att1: 5, w_mid: 20,
  w_work2: 10, w_quiz2: 10, w_att2: 5, w_fin: 30,
  'att_w_มา': 1, 'att_w_สาย': 0.5, 'att_w_ลา': 1, 'att_w_ขาด': 0,
  'att_d_สาย': 0.25, 'att_d_ลา': 0, 'att_d_ขาด': 0.5,
  att_min_pct: 80, 'att_count_ลา': 'TRUE',
  grade_cuts: '80:4, 75:3.5, 70:3, 65:2.5, 60:2, 55:1.5, 50:1, 0:0'
};

const columns = [
  { key: 'ATT|1|20260801-1', kind: 'ATT',  half: 1, id: '20260801-1', max: null, date: '2026-08-01', period: 1 },
  { key: 'ATT|1|20260802-1', kind: 'ATT',  half: 1, id: '20260802-1', max: null, date: '2026-08-02', period: 1 },
  { key: 'ATT|1|20260803-2', kind: 'ATT',  half: 1, id: '20260803-2', max: null, date: '2026-08-03', period: 2 },
  { key: 'WORK|1|w1',        kind: 'WORK', half: 1, id: 'w1',  label: 'ใบงาน 1', max: 20, pass: 10 },
  { key: 'WORK|1|w2',        kind: 'WORK', half: 1, id: 'w2',  label: 'ใบงาน 2', max: 5, pass: 0 },
  { key: 'QUIZ|1|q1',        kind: 'QUIZ', half: 1, id: 'q1',  label: 'ควิซ 1',  max: 15, pass: 7.5 },
  { key: 'MID|1|mid',        kind: 'MID',  half: 1, id: 'mid', label: 'กลางภาค', max: 40, pass: null },
  { key: 'ATT|2|20261101-1', kind: 'ATT',  half: 2, id: '20261101-1', max: null, date: '2026-11-01', period: 1 },
  { key: 'WORK|2|w3',        kind: 'WORK', half: 2, id: 'w3',  label: 'ใบงาน 3', max: 10 },
  { key: 'QUIZ|2|q2',        kind: 'QUIZ', half: 2, id: 'q2',  label: 'ควิซ 2',  max: 10 },
  { key: 'FIN|2|fin',        kind: 'FIN',  half: 2, id: 'fin', label: 'ปลายภาค', max: 60 }
];

const ATT = ['ม', 'ส', 'ล', 'ข', ''];
const BUCKET_IDS = ['work1', 'quiz1', 'att1', 'mid', 'work2', 'quiz2', 'att2', 'fin'];
const FIELDS = [...BUCKET_IDS, 'total', 'grade', 'pct', 'flag', 'attN', 'dataN', 'failN', 'failed',
  ...BUCKET_IDS.map(b => '_has_' + b)];

const rnd = (seed) => { let s = seed || 1; return () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648; };

let fails = 0, checked = 0;
for (const att_mode of ['ratio', 'deduct'])
for (const ungraded_mode of ['ignore', 'zero'])
for (const round_digits of [0, 1, 2])
for (const round_mode of ['half', 'up', 'down'])
for (const pass_default_pct of ['', 50]) {
  const cfg = { ...baseCfg, att_mode, ungraded_mode, round_digits, round_mode, pass_default_pct };
  const r = rnd(round_digits * 977 + round_mode.length * 131 + att_mode.length * 17 + ungraded_mode.length);

  const students = Array.from({ length: 25 }, (_, i) => ({ no: String(i + 1), sid: 'S' + i, name: 'นักเรียน ' + i }));
  const values = {};
  for (const c of columns) {
    values[c.key] = {};
    for (const st of students) {
      const x = r();
      if (c.kind === 'ATT') { const v = ATT[Math.floor(x * 5)]; if (v) values[c.key][st.sid] = v; }
      else if (x < 0.10) { /* ยังไม่ตรวจ */ }
      else if (x < 0.18) values[c.key][st.sid] = 'x';                                   // ไม่ส่ง
      else if (x < 0.28) values[c.key][st.sid] = 'L' + Math.round(x * c.max * 100) / 100; // ส่งช้า
      else if (x < 0.32) values[c.key][st.sid] = 'l' + Math.round(x * c.max * 100) / 100; // ส่งช้า (ตัวเล็ก)
      else if (x < 0.34) values[c.key][st.sid] = String(Math.round(x * c.max)) ;         // ตัวเลขเป็นสตริง
      else values[c.key][st.sid] = Math.round(x * c.max * 100) / 100;
    }
  }

  const cls = { students, columns, values };
  const a = computeClass(cls, settingsFrom(cfg));
  const b = ctx.computeClassScores_(cls, ctx.scoreSettings_(cfg)).rows;

  for (let i = 0; i < a.length; i++) {
    for (const k of FIELDS) {
      checked++;
      if (String(a[i][k]) !== String(b[i][k])) {
        fails++;
        if (fails <= 10) console.log(`ไม่ตรง [${att_mode}/${ungraded_mode}/${round_digits}/${round_mode}] แถว ${i} ${k}: js=${a[i][k]} gs=${b[i][k]}`);
      }
    }
  }
}

// ── ห้องที่ยังไม่ได้กรอกอะไรเลย ต้องไม่มีคะแนนงอกขึ้นมา ───────
{
  const students = [{ no: '1', sid: 'S0', name: 'ก' }];
  const cases = [
    { name: 'มีคอลัมน์แต่ยังไม่กรอกค่า', cls: { students, columns, values: {} } },
    { name: 'ยังไม่มีคอลัมน์เลย',        cls: { students, columns: [], values: {} } }
  ];
  for (const { name, cls } of cases) {
    const a = computeClass(cls, settingsFrom(baseCfg))[0];
    const b = ctx.computeClassScores_(cls, ctx.scoreSettings_(baseCfg)).rows[0];
    for (const k of FIELDS) {
      checked++;
      if (String(a[k]) !== String(b[k])) { fails++; console.log(`ไม่ตรง [${name}] ${k}: js=${a[k]} gs=${b[k]}`); }
    }
    for (const id of BUCKET_IDS) {
      checked++;
      if (a[id] !== 0 || a['_has_' + id] !== false) { fails++; console.log(`❌ [${name}] ${id} ควรเป็น 0/ไม่มีข้อมูล แต่ได้ ${a[id]}`); }
    }
    checked += 2;
    if (a.total !== 0)  { fails++; console.log(`❌ [${name}] total ควรเป็น 0 แต่ได้ ${a.total}`); }
    if (a.grade !== '—') { fails++; console.log(`❌ [${name}] grade ควรเป็น — แต่ได้ ${a.grade}`); }
  }
}

// ── เกณฑ์เกรดที่เขียนผิดรูปแบบ ───────────────────────────
// เคยพลาดมาแล้วทั้ง 2 ฝั่ง: num_()/n() แปลงค่าที่อ่านไม่ออกเป็น 0 ไปก่อน
// แล้วค่อยกรอง isNaN ซึ่งกรองไม่ออกสักตัว "8O:4" จึงกลายเป็น 0:4
// นักเรียนที่ตกเลยได้เกรด 4 ทั้งห้อง — ชุดทดสอบเดิมใช้แต่ค่าที่ถูก เลยไม่เคยจับได้
{
  const students = [
    { no: '1', sid: 'S0', name: 'ตกทุกอย่าง' },
    { no: '2', sid: 'S1', name: 'ได้เต็ม' }
  ];
  const values = {
    'WORK|1|w1': { S0: '0',  S1: '20' },
    'QUIZ|1|q1': { S0: '0',  S1: '15' },
    'MID|1|mid': { S0: '0',  S1: '40' },
    'WORK|2|w3': { S0: '0',  S1: '10' },
    'QUIZ|2|q2': { S0: '0',  S1: '10' },
    'FIN|2|fin': { S0: '0',  S1: '60' }
  };
  const cls = { students, columns, values };

  const CUTS = [
    ['พิมพ์ตัว O แทนเลขศูนย์', '8O:4,75:3.5,70:3,50:1'],
    ['ขาดเกรดหลังจุดคู่',      '80:4,75:,70:3'],
    ['มีช่องว่างเกิน',          '80:4, ,75:3.5'],
    ['อ่านไม่ออกทั้งชุด',       'xx,yy'],
    ['ว่างเปล่า',              '']
  ];

  for (const [name, cuts] of CUTS) {
    const cfg = { ...baseCfg, grade_cuts: cuts };
    const a = computeClass(cls, settingsFrom(cfg));
    const b = ctx.computeClassScores_(cls, ctx.scoreSettings_(cfg)).rows;
    for (let i = 0; i < a.length; i++) {
      checked++;
      if (String(a[i].grade) !== String(b[i].grade)) {
        fails++;
        console.log(`ไม่ตรง [เกณฑ์เกรด: ${name}] ${a[i].name}: js=${a[i].grade} gs=${b[i].grade}`);
      }
    }
    // คนที่ได้ 0 ทุกช่องต้องไม่หลุดไปได้เกรดสูงเพราะเกณฑ์พิมพ์ผิด
    checked++;
    if (Number(a[0].grade) >= 2) {
      fails++;
      console.log(`❌ [เกณฑ์เกรด: ${name}] คนที่ได้ 0 ทุกช่องกลับได้เกรด ${a[0].grade}`);
    }
  }
}

if (fails) { console.log(`❌ ไม่ตรง ${fails} จุด จาก ${checked}`); process.exit(1); }
console.log(`✅ สูตรคะแนน 2 ฝั่งตรงกันทั้งหมด (${checked} ค่า)`);
