/* AssignCheck V2 — เครื่องคำนวณคะแนนฝั่งเบราว์เซอร์
 *
 * ⚠️ สูตรในไฟล์นี้ต้องตรงกับ apps-script/03_Score.gs เสมอ
 *    ฝั่งนี้ใช้แสดงผลทันที/ออฟไลน์ · ฝั่ง Apps Script ใช้เขียนลงชีต
 */

export const ATT_CODES = ['ม', 'ส', 'ล', 'ข'];
export const ATT_NAMES = { 'ม': 'มา', 'ส': 'สาย', 'ล': 'ลา', 'ข': 'ขาด' };
export const NOT_SUBMITTED = 'x';
const LATE_PREFIX = 'L';   // ส่งช้า เก็บเป็น "L8" = ส่งช้า ได้ 8 คะแนน

/**
 * อ่านค่าในช่องเช็คงาน/คะแนนสอบ
 *   ''    → none  ยังไม่ตรวจ
 *   'x'   → miss  ไม่ส่ง (0 คะแนน แต่นับในตัวหาร)
 *   'L8'  → late  ส่งช้า ได้ 8
 *   '8'   → ok    ส่งปกติ ได้ 8
 */
export function parseWork(raw) {
  const s = raw === undefined || raw === null ? '' : String(raw).trim();
  if (s === '') return { status: 'none', score: 0 };
  if (s.toLowerCase() === NOT_SUBMITTED) return { status: 'miss', score: 0 };
  const late = /^l/i.test(s);
  const n = Number(late ? s.slice(1) : s);
  if (isNaN(n)) return { status: 'none', score: 0 };
  return { status: late ? 'late' : 'ok', score: n };
}

/** ประกอบค่ากลับไปเก็บในชีต */
export function formatWork(status, score) {
  if (status === 'none') return '';
  if (status === 'miss') return NOT_SUBMITTED;
  return (status === 'late' ? LATE_PREFIX : '') + String(score);
}

export const BUCKETS = [
  { id: 'work1', kind: 'WORK', half: 1, label: 'ส่งงาน',        sgs: 'ช่อง 1',  phase: 1 },
  { id: 'quiz1', kind: 'QUIZ', half: 1, label: 'สอบเก็บคะแนน',  sgs: 'ช่อง 2',  phase: 1 },
  { id: 'att1',  kind: 'ATT',  half: 1, label: 'เข้าเรียน',      sgs: 'ช่อง 3',  phase: 1 },
  { id: 'mid',   kind: 'MID',  half: 1, label: 'สอบกลางภาค',    sgs: 'กลางภาค', phase: 1 },
  { id: 'work2', kind: 'WORK', half: 2, label: 'ส่งงาน',        sgs: 'ช่อง 10', phase: 2 },
  { id: 'quiz2', kind: 'QUIZ', half: 2, label: 'สอบเก็บคะแนน',  sgs: 'ช่อง 11', phase: 2 },
  { id: 'att2',  kind: 'ATT',  half: 2, label: 'เข้าเรียน',      sgs: 'ช่อง 12', phase: 2 },
  { id: 'fin',   kind: 'FIN',  half: 2, label: 'สอบปลายภาค',    sgs: 'ปลายภาค', phase: 2 }
];

const BUCKET_OF = Object.fromEntries(BUCKETS.map(b => [b.kind + '|' + b.half, b.id]));

const n = (v, d = 0) => { const x = Number(v); return isNaN(x) ? d : x; };
const bool = (v) => ['TRUE', 'ใช่', '1', 'YES', 'true'].includes(String(v).trim());

export function settingsFrom(cfg = {}) {
  return {
    weight: {
      work1: n(cfg.w_work1, 10), quiz1: n(cfg.w_quiz1, 10), att1: n(cfg.w_att1, 5),  mid: n(cfg.w_mid, 20),
      work2: n(cfg.w_work2, 10), quiz2: n(cfg.w_quiz2, 10), att2: n(cfg.w_att2, 5),  fin: n(cfg.w_fin, 30)
    },
    attMode: String(cfg.att_mode || 'ratio').toLowerCase(),
    attW: { 'ม': n(cfg['att_w_มา'], 1), 'ส': n(cfg['att_w_สาย'], 0.5), 'ล': n(cfg['att_w_ลา'], 1), 'ข': n(cfg['att_w_ขาด'], 0) },
    attD: { 'ม': 0, 'ส': n(cfg['att_d_สาย'], 0.25), 'ล': n(cfg['att_d_ลา'], 0), 'ข': n(cfg['att_d_ขาด'], 0.5) },
    minPct: n(cfg.att_min_pct, 80),
    countLeave: cfg['att_count_ลา'] === undefined ? true : bool(cfg['att_count_ลา']),
    ungraded: String(cfg.ungraded_mode || 'ignore').toLowerCase(),
    latePenaltyPct: n(cfg.late_penalty_pct, 0),
    digits: n(cfg.round_digits, 0),
    roundMode: String(cfg.round_mode || 'half').toLowerCase(),
    cuts: parseCuts(cfg.grade_cuts)
  };
}

const DEFAULT_CUTS = '80:4,75:3.5,70:3,65:2.5,60:2,55:1.5,50:1,0:0';

/**
 * แปลงข้อความเกณฑ์เกรด "80:4,75:3.5,…" เป็นรายการช่วง
 *
 * ต้องเช็คว่าเป็นตัวเลขจริง ๆ — ของเดิมใช้ n() ที่แปลงค่าที่อ่านไม่ออกเป็น 0
 * แล้วค่อยกรอง isNaN ทีหลัง ซึ่งกรองไม่ออกสักตัวเพราะไม่มีทางเป็น NaN แล้ว
 * ผลคือพิมพ์ผิดตัวเดียว เช่น "8O:4" (ตัว O แทนเลขศูนย์) เกณฑ์นั้นกลายเป็น 0:4
 * นักเรียนที่ได้ 0 คะแนนก็จะได้เกรด 4 กันทั้งห้องโดยไม่มีอะไรเตือน
 */
function parseCuts(s) {
  const good = String(s || DEFAULT_CUTS)
    .split(',')
    .map(p => {
      const [a, b] = p.split(':');
      const raw = String(a ?? '').trim();
      const min = Number(raw);
      const grade = String(b ?? '').trim();
      return { min, grade, ok: raw !== '' && Number.isFinite(min) && grade !== '' };
    })
    .filter(c => c.ok)
    .map(({ min, grade }) => ({ min, grade }));

  // พังทั้งชุด → ใช้เกณฑ์มาตรฐาน ดีกว่าปล่อยให้ตัดเกรดมั่ว
  return (good.length ? good : parseCuts(DEFAULT_CUTS)).sort((a, b) => b.min - a.min);
}

/** ช่วงที่เขียนผิดรูปแบบ — หน้าตรวจสภาพเอาไปเตือนก่อนที่เกรดจะออกผิด */
export function badCuts(s) {
  return String(s ?? '')
    .split(',')
    .map(p => p.trim())
    .filter(p => p !== '' && !/^-?\d+(\.\d+)?\s*:\s*\S+$/.test(p));
}

function roundScore(v, digits, mode) {
  const f = 10 ** digits;
  let x = v * f;
  if (mode === 'up') x = Math.ceil(x - 1e-9);
  else if (mode === 'down') x = Math.floor(x + 1e-9);
  else x = Math.round(x - 1e-9 + 2e-9);
  return x / f;
}

const clampRound = (v, max, S) => Math.max(0, Math.min(max, roundScore(v, S.digits, S.roundMode)));

function gradeOf(total, cuts) {
  for (const c of cuts) if (total >= c.min) return c.grade;
  return '0';
}

/** จัดคอลัมน์เข้าถังตามชนิด+ช่วง */
export function bucketColumns(cls) {
  const out = Object.fromEntries(BUCKETS.map(b => [b.id, []]));
  for (const c of cls.columns || []) {
    const id = BUCKET_OF[c.kind + '|' + c.half];
    if (id) out[id].push(c);
  }
  return out;
}

/**
 * คำนวณคะแนนทั้งห้อง
 * @returns [{ sid, no, name, work1..fin, total, grade, pct, flag, pending }]
 */
export function computeClass(cls, S) {
  const byBucket = bucketColumns(cls);
  const V = cls.values || {};

  return (cls.students || []).map(st => {
    const r = { sid: st.sid, no: st.no, name: st.name };
    let attTotal = 0, attPresent = 0, pending = 0, filled = 0, late = 0, dataN = 0;

    for (const b of BUCKETS) {
      const cols = byBucket[b.id];
      const w = S.weight[b.id];

      if (b.kind === 'ATT') {
        let checked = 0, gained = 0, deducted = 0;
        for (const c of cols) {
          const v = String((V[c.key] || {})[st.sid] ?? '').trim();
          if (!v || !ATT_CODES.includes(v)) continue;
          checked++;
          gained   += S.attW[v] || 0;
          deducted += S.attD[v] || 0;
          attTotal++;
          if (v === 'ม' || v === 'ส' || (v === 'ล' && S.countLeave)) attPresent++;
        }
        // ยังไม่เช็คสักคาบ = ยังไม่มีข้อมูล → 0 (ไม่ใช่ให้เต็มไว้ก่อน)
        const raw = S.attMode === 'deduct' ? Math.max(0, w - deducted) : w * (gained / (checked || 1));
        r[b.id] = checked ? clampRound(raw, w, S) : 0;
        r['_has_' + b.id] = checked > 0;
        if (checked) dataN++;
        continue;
      }

      let got = 0, max = 0, blank = 0;
      for (const c of cols) {
        const full = c.max == null ? 0 : c.max;
        const cell = parseWork((V[c.key] || {})[st.sid]);   // อย่าตั้งชื่อ w ทับน้ำหนักด้านบน
        if (cell.status === 'none') { blank++; if (S.ungraded === 'zero') max += full; continue; }
        max += full; filled++;
        if (cell.status === 'late') late++;
        if (cell.status === 'miss') continue;
        got += cell.score;
      }
      pending += blank;
      r[b.id] = max > 0 ? clampRound(w * (got / max), w, S) : 0;
      r['_has_' + b.id] = max > 0;
      if (max > 0) dataN++;
    }

    r.total = roundScore(BUCKETS.reduce((a, b) => a + r[b.id], 0), S.digits, S.roundMode);
    r.pct = attTotal ? Math.round((attPresent / attTotal) * 1000) / 10 : 100;
    r.attN = attTotal;
    r.dataN = dataN;          // จำนวนช่อง SGS ที่มีข้อมูลจริง (0 = ยังไม่ได้กรอกอะไรเลย)
    r.pending = pending;
    r.late = late;

    // ถือว่าจบเทอมเมื่อกรอกคะแนนปลายภาคของคนนี้แล้ว
    const termDone = byBucket.fin.some(c => String((V[c.key] || {})[st.sid] ?? '').trim() !== '');

    const flags = [];
    const lowTime = attTotal > 0 && r.pct < S.minPct;
    if (lowTime) flags.push(`มส (เวลาเรียน ${r.pct}%)`);
    if (pending > 0) flags.push(`ยังไม่ตรวจ ${pending} รายการ`);
    if (termDone && filled > 0 && pending === 0 && r.total < 50) flags.push('เสี่ยงติด 0');
    r.flag = flags.join(' · ');
    // ยังไม่มีข้อมูลสักช่อง = ยังตัดเกรดไม่ได้ (อย่าโชว์ 0 ให้เข้าใจผิดว่าตก)
    r.grade = dataN === 0 ? '—' : (lowTime ? 'มส' : gradeOf(r.total, S.cuts));
    return r;
  });
}

/** สรุปสถิติการเช็คชื่อรายคาบ (ใช้ในหน้าเช็คชื่อ) */
export function attStats(cls, colKey) {
  const m = (cls.values || {})[colKey] || {};
  const out = { 'ม': 0, 'ส': 0, 'ล': 0, 'ข': 0, blank: 0 };
  for (const st of cls.students || []) {
    const v = String(m[st.sid] ?? '').trim();
    if (ATT_CODES.includes(v)) out[v]++; else out.blank++;
  }
  return out;
}
