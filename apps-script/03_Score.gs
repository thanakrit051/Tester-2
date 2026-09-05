/**
 * AssignCheck V2 — เครื่องคำนวณคะแนนสรุปเข้า SGS
 *
 * ถังคะแนน 8 ถัง = 8 ช่องในหน้า SGS
 *   ก่อนกลางภาค : work1(10) quiz1(10) att1(5)  mid(20)
 *   หลังกลางภาค : work2(10) quiz2(10) att2(5)  fin(30)
 */

var BUCKET_OF = {
  'WORK|1': 'work1', 'QUIZ|1': 'quiz1', 'ATT|1': 'att1', 'MID|1': 'mid',
  'WORK|2': 'work2', 'QUIZ|2': 'quiz2', 'ATT|2': 'att2', 'FIN|2': 'fin'
};
var BUCKET_ORDER = ['work1', 'quiz1', 'att1', 'mid', 'work2', 'quiz2', 'att2', 'fin'];

function scoreSettings_(cfg) {
  return {
    weight: {
      work1: num_(cfg.w_work1, 10), quiz1: num_(cfg.w_quiz1, 10), att1: num_(cfg.w_att1, 5),  mid: num_(cfg.w_mid, 20),
      work2: num_(cfg.w_work2, 10), quiz2: num_(cfg.w_quiz2, 10), att2: num_(cfg.w_att2, 5),  fin: num_(cfg.w_fin, 30)
    },
    attMode: String(cfg.att_mode || 'ratio').toLowerCase(),
    attW: { 'ม': num_(cfg['att_w_มา'], 1), 'ส': num_(cfg['att_w_สาย'], 0.5), 'ล': num_(cfg['att_w_ลา'], 1), 'ข': num_(cfg['att_w_ขาด'], 0) },
    attD: { 'ม': 0, 'ส': num_(cfg['att_d_สาย'], 0.25), 'ล': num_(cfg['att_d_ลา'], 0), 'ข': num_(cfg['att_d_ขาด'], 0.5) },
    minPct: num_(cfg.att_min_pct, 80),
    countLeave: cfg['att_count_ลา'] === undefined ? true : bool_(cfg['att_count_ลา']),
    ungraded: String(cfg.ungraded_mode || 'ignore').toLowerCase(),
    // เกณฑ์ผ่านตั้งต้น (% ของคะแนนเต็ม) — ว่าง/อ่านไม่ออก = null คือไม่ตรวจอะไรเลย
    // ต้องเป็น null ไม่ใช่ 0 เพราะ 0 แปลว่า "ผ่านหมดทุกคน" ซึ่งคนละเรื่องกับ "ไม่ตรวจ"
    passPct: passPct_(cfg.pass_default_pct),
    digits: num_(cfg.round_digits, 0),
    roundMode: String(cfg.round_mode || 'half').toLowerCase(),
    cuts: parseCuts_(cfg.grade_cuts)
  };
}

/** อ่านเกณฑ์ผ่านตั้งต้น — คืน null เมื่อว่างหรืออ่านไม่ออก (คนละความหมายกับ 0)
 *  ⚠️ ต้องตรงกับ settingsFrom().passPct ใน js/score.js เสมอ */
function passPct_(v) {
  var s = String(v === undefined || v === null ? '' : v).trim();
  if (s === '') return null;
  var x = Number(s);
  return isNaN(x) ? null : x;
}

/**
 * เกณฑ์ผ่านของรายการนี้ — คืน null เมื่อไม่ต้องตรวจ
 *
 * เก็บเป็นคะแนนดิบ ไม่ใช่ % เพื่อให้ครูอ่านเทียบกับคะแนนเต็มในแถวเหนือมันได้ทันที
 * ลำดับ: เกณฑ์ของรายการนั้นเอง → ค่าตั้งต้นเป็น % จาก ⚙️ ตั้งค่า → ไม่ตรวจ
 *
 * ⚠️ ต้องตรงกับ passMarkOf() ใน js/score.js เสมอ (test/parity.mjs คุมไว้)
 */
function passMarkOf_(c, S) {
  if (!c || c.kind === 'ATT' || c.kind === 'SUM') return null;
  if (c.pass !== null && c.pass !== undefined && c.pass !== '') {
    var p = Number(c.pass);
    return isNaN(p) ? null : p;
  }
  var full = c.max == null ? 0 : Number(c.max);
  if (S == null || S.passPct == null || !(full > 0)) return null;
  return full * S.passPct / 100;
}

/**
 * นักเรียนคนนี้ผ่านเกณฑ์ของรายการนี้ไหม
 * true = ผ่าน · false = ไม่ผ่าน · null = ตัดสินไม่ได้ (ไม่ได้ตั้งเกณฑ์ หรือยังไม่ตรวจ)
 *
 * "ยังไม่ตรวจ" ต้องไม่นับเป็นไม่ผ่าน ไม่งั้นวันแรกที่สร้างข้อสอบ ทั้งห้องจะติดธงทันที
 * ส่วน "ไม่ส่ง" (x) นับเป็น 0 คะแนน = ไม่ผ่าน ซึ่งตรงกับความจริง
 *
 * ⚠️ ต้องตรงกับ passOf() ใน js/score.js เสมอ
 */
function passOf_(c, raw, S) {
  var mark = passMarkOf_(c, S);
  if (mark === null) return null;
  var w = parseWork_(raw);
  if (w.status === 'none') return null;
  return w.score >= mark;
}

var DEFAULT_CUTS_ = '80:4,75:3.5,70:3,65:2.5,60:2,55:1.5,50:1,0:0';

/**
 * แปลงข้อความเกณฑ์เกรด "80:4,75:3.5,…" เป็นรายการช่วง
 *
 * ต้องเช็คว่าเป็นตัวเลขจริง ๆ — ของเดิมใช้ num_() ที่แปลงค่าที่อ่านไม่ออกเป็น 0
 * แล้วค่อยกรอง isNaN ทีหลัง ซึ่งกรองไม่ออกสักตัวเพราะไม่มีทางเป็น NaN แล้ว
 * ผลคือพิมพ์ผิดตัวเดียว เช่น "8O:4" (ตัว O แทนเลขศูนย์) เกณฑ์นั้นกลายเป็น 0:4
 * นักเรียนที่ได้ 0 คะแนนก็จะได้เกรด 4 กันทั้งห้องโดยไม่มีอะไรเตือน
 *
 * ⚠️ ต้องตรงกับ parseCuts() ใน js/score.js เสมอ (test/parity.mjs คุมไว้)
 */
function parseCuts_(s) {
  var good = String(s || DEFAULT_CUTS_)
    .split(',').map(function (p) {
      var kv = p.split(':');
      var raw = String(kv[0] === undefined || kv[0] === null ? '' : kv[0]).trim();
      var min = Number(raw);
      var grade = String(kv[1] === undefined || kv[1] === null ? '' : kv[1]).trim();
      return { min: min, grade: grade, ok: raw !== '' && isFinite(min) && grade !== '' };
    }).filter(function (c) { return c.ok; })
      .map(function (c) { return { min: c.min, grade: c.grade }; });

  // พังทั้งชุด → ใช้เกณฑ์มาตรฐาน ดีกว่าปล่อยให้ตัดเกรดมั่ว
  var out = good.length ? good : parseCuts_(DEFAULT_CUTS_);
  out.sort(function (a, b) { return b.min - a.min; });
  return out;
}

function roundScore_(v, digits, mode) {
  var f = Math.pow(10, digits);
  var x = v * f;
  if (mode === 'up')   x = Math.ceil(x - 1e-9);
  else if (mode === 'down') x = Math.floor(x + 1e-9);
  else x = Math.round(x - 1e-9 + (x >= 0 ? 2e-9 : 0));
  return x / f;
}

/**
 * คำนวณคะแนนของทั้งห้อง
 * @return { rows: [{ sid, no, name, work1..fin, total, grade, pct, flag }], columnsPerBucket }
 */
function computeClassScores_(data, settings) {
  var S = settings;
  var byBucket = {};
  BUCKET_ORDER.forEach(function (b) { byBucket[b] = []; });
  data.columns.forEach(function (c) {
    var b = BUCKET_OF[c.kind + '|' + c.half];
    if (b) byBucket[b].push(c);
  });

  var rows = data.students.map(function (st) {
    var r = { sid: st.sid, no: st.no, name: st.name };
    var attStat = { total: 0, present: 0, missing: 0 };
    var pending = 0, filled = 0, late = 0, dataN = 0;
    var failed = [];   // ชื่อรายการที่คนนี้สอบไม่ผ่านเกณฑ์ (เรียงซ้าย→ขวาตามชีต)

    BUCKET_ORDER.forEach(function (b) {
      var cols = byBucket[b];
      var w = S.weight[b];

      if (b === 'att1' || b === 'att2') {
        var checked = 0, gained = 0, deducted = 0;
        cols.forEach(function (c) {
          var v = String((data.values[c.key] || {})[st.sid] || '').trim();
          if (!v || ATT_CODES.indexOf(v) < 0) return;      // ยังไม่ได้เช็คคาบนี้
          checked++;
          gained   += S.attW[v] || 0;
          deducted += S.attD[v] || 0;
          attStat.total++;
          if (v === 'ม' || v === 'ส' || (v === 'ล' && S.countLeave)) attStat.present++;
        });
        // ยังไม่เช็คสักคาบ = ยังไม่มีข้อมูล → 0 (ไม่ใช่ให้เต็มไว้ก่อน)
        var raw = S.attMode === 'deduct' ? Math.max(0, w - deducted) : w * (gained / (checked || 1));
        r[b] = checked ? clampRound_(raw, w, S) : 0;
        r['_has_' + b] = checked > 0;
        r['_' + b + '_n'] = checked;
        if (checked) dataN++;
        return;
      }

      var got = 0, max = 0, blank = 0;
      cols.forEach(function (c) {
        var full = c.max == null ? 0 : c.max;
        var raw = (data.values[c.key] || {})[st.sid];
        var w = parseWork_(raw);
        if (passOf_(c, raw, S) === false) failed.push(c.label || c.id);
        if (w.status === 'none') {
          blank++;
          if (S.ungraded === 'zero') max += full;             // นับเป็น 0 คะแนน
          return;                                            // ignore = ไม่นับในตัวหาร
        }
        max += full; filled++;
        if (w.status === 'late') late++;
        if (w.status === 'miss') return;                      // ไม่ส่ง = 0 คะแนน
        got += w.score;
      });
      pending += blank;
      r[b] = max > 0 ? clampRound_(w * (got / max), w, S) : 0;
      r['_has_' + b] = max > 0;
      r['_' + b + '_n'] = cols.length - blank;
      r['_' + b + '_of'] = cols.length;
      if (max > 0) dataN++;
    });

    r.total = BUCKET_ORDER.reduce(function (a, b) { return a + r[b]; }, 0);
    r.total = roundScore_(r.total, S.digits, S.roundMode);
    r.pct = attStat.total ? Math.round(attStat.present / attStat.total * 1000) / 10 : 100;
    r.attN = attStat.total;
    r.dataN = dataN;          // จำนวนช่อง SGS ที่มีข้อมูลจริง (0 = ยังไม่ได้กรอกอะไรเลย)
    r.pending = pending;
    r.late = late;
    r.failed = failed;
    r.failN = failed.length;

    // ถือว่าจบเทอมเมื่อกรอกคะแนนปลายภาคของคนนี้แล้ว
    var termDone = byBucket.fin.some(function (c) {
      return String((data.values[c.key] || {})[st.sid] || '').trim() !== '';
    });

    var flags = [];
    if (attStat.total > 0 && r.pct < S.minPct) flags.push('มส (เวลาเรียน ' + r.pct + '%)');
    if (pending > 0) flags.push('ยังไม่ตรวจ ' + pending + ' รายการ');
    if (failed.length) flags.push('ไม่ผ่านเกณฑ์ ' + failed.length + ' รายการ (' + failed.join(', ') + ')');
    if (termDone && filled > 0 && pending === 0 && r.total < 50) flags.push('เสี่ยงติด 0');
    r.flag = flags.join(' · ');
    // ยังไม่มีข้อมูลสักช่อง = ยังตัดเกรดไม่ได้ (อย่าโชว์ 0 ให้เข้าใจผิดว่าตก)
    if (dataN === 0) r.grade = '—';
    else if (attStat.total > 0 && r.pct < S.minPct) r.grade = 'มส';
    else r.grade = gradeOf_(r.total, S.cuts);

    return r;
  });

  return { rows: rows, buckets: byBucket };
}

function clampRound_(v, max, S) {
  var x = roundScore_(v, S.digits, S.roundMode);
  return Math.max(0, Math.min(max, x));
}

function gradeOf_(total, cuts) {
  for (var i = 0; i < cuts.length; i++) if (total >= cuts[i].min) return cuts[i].grade;
  return '0';
}

/** คำนวณแล้วเขียนกลับลงบล็อกสรุปในแท็บ */
function recalcClass_(classId) {
  var sh = sheetForClass_(classId);
  if (!sh) throw new Error('ไม่พบห้องเรียน: ' + classId);
  ensureLayout_(sh);   // คำนวณแล้วต้องเขียนคะแนนสรุปลงแถวนักเรียน ต้องอัปโครงก่อน
  var data = readClassBySheet_(sh);
  var S = scoreSettings_(getConfig_());
  var res = computeClassScores_(data, S);

  /* ให้แน่ใจว่าคอลัมน์สรุปมีครบ (กรณีไฟล์เก่า)
   *
   * ต้องเช็คก่อนว่าขาดจริงไหม แล้วค่อยเรียก ensureColumn_ เฉพาะตัวที่ขาด
   * ของเดิมยิงครบทั้ง 12 ตัวทุกครั้ง และ ensureColumn_ แต่ละครั้งอ่านหัวคอลัมน์
   * ทั้งแท็บใหม่หมดแล้วเขียนทับชื่อ/คะแนนเต็มซ้ำของเดิม — คุยกับ Google ~80 รอบ
   * ต่อการคำนวณ 1 ครั้ง ทั้งที่แทบทุกครั้งไม่มีอะไรขาดเลย
   *
   * นี่คือคำสั่งที่ตามหลังการกรอกคะแนนทุกครั้ง (setCells + recalc)
   * จึงเป็นต้นเหตุหลักที่ครูรู้สึกว่า "กดแล้วรอ"
   */
  var colOf = {};
  var cols0 = columnsOf_(sh);
  cols0.forEach(function (c) { if (c.kind === 'SUM') colOf[c.id] = c.col; });

  var missing = SUM_COLS.filter(function (sc) { return !colOf[parseKey_(sc.key).id]; });
  if (missing.length) {
    missing.forEach(function (sc) { ensureColumn_(sh, sc.key, sc.label, sc.max); });
    colOf = {};
    columnsOf_(sh).forEach(function (c) { if (c.kind === 'SUM') colOf[c.id] = c.col; });
  }

  if (res.rows.length) {
    var order = ['work1', 'quiz1', 'att1', 'mid', 'work2', 'quiz2', 'att2', 'fin', 'total', 'grade', 'pct', 'flag'];
    var cellOf = function (r, id) {
      // ช่องที่ยังไม่มีข้อมูล ปล่อยว่างไว้ อย่าเขียน 0 ให้เข้าใจผิดว่าได้ 0 คะแนน
      if (BUCKET_ORDER.indexOf(id) >= 0) return r['_has_' + id] ? r[id] : '';
      if (id === 'total') return r.dataN ? r.total : '';
      if (id === 'pct')   return r.attN ? r.pct + '%' : '';
      return r[id] === undefined ? '' : r[id];
    };

    /* บล็อกสรุปอยู่ขวาสุดและเรียงตาม SUM_COLS เสมอ (ensureColumn_ แทรกคอลัมน์อื่น
     * ไว้ก่อนหน้ามันเสมอ) จึงเขียนรวดเดียวได้ — 1 รอบแทน 12 รอบ
     * ถ้าไฟล์เก่าเรียงไม่ตรง ก็ถอยไปเขียนทีละคอลัมน์เหมือนเดิม ไม่เสี่ยงเขียนผิดช่อง */
    var run = order.filter(function (id) { return !!colOf[id]; });
    var solid = run.length === order.length && run.every(function (id, i) {
      return colOf[id] === colOf[run[0]] + i;
    });

    if (solid) {
      sh.getRange(R_DATA, colOf[run[0]], res.rows.length, run.length).setValues(
        res.rows.map(function (r) {
          return run.map(function (id) { return cellOf(r, id); });
        }));
    } else {
      run.forEach(function (id) {
        sh.getRange(R_DATA, colOf[id], res.rows.length, 1).setValues(
          res.rows.map(function (r) { return [cellOf(r, id)]; }));
      });
    }

    var flagCol = colOf['flag'];
    if (flagCol) sh.getRange(R_DATA, flagCol, res.rows.length, 1)
      .setFontSize(9).setFontColor('#c62828').setHorizontalAlignment('left');
  }

  upsertClassRow_(data.meta, data.students.length);
  SpreadsheetApp.flush();
  return { meta: data.meta, rows: res.rows };
}

// ── เรียกจากเมนู ────────────────────────────────────────────

function recalcActiveSheet() {
  var sh = ss_().getActiveSheet();
  var cid = String(sh.getRange(R_META, 1).getValue());
  if (!cid) { SpreadsheetApp.getUi().alert('แท็บนี้ไม่ใช่แท็บห้องเรียน'); return; }
  recalcClass_(cid);
  SpreadsheetApp.getUi().alert('คำนวณคะแนนสรุปเรียบร้อย ✅');
}

function recalcAllClasses() {
  var list = listClasses_();
  list.forEach(function (c) {
    try { recalcClass_(c.classId); } catch (e) { console.error(c.classId, e); }
  });
  try { SpreadsheetApp.getUi().alert('คำนวณครบ ' + list.length + ' ห้องแล้ว ✅'); } catch (e) {}
}
