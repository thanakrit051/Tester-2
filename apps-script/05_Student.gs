/**
 * AssignCheck V2 — หน้าดูผลของนักเรียน (เปิดสาธารณะ อ่านอย่างเดียว)
 *
 * ⚠️ ไฟล์นี้เป็นทางเข้าเดียวที่ "ไม่ต้องล็อกอิน" — ทุกอย่างในนี้ต้องปลอดภัยเสมอ
 *    กติกา 3 ข้อที่ห้ามละเมิด:
 *      1. อ่านอย่างเดียว ห้ามเขียนอะไรลงชีตเด็ดขาด
 *      2. คืนข้อมูลของนักเรียน "คนเดียว" ที่กรอกเลขประจำตัวถูกเท่านั้น
 *      3. ห้ามมีคำสั่งที่ไล่ดูรายชื่อทั้งหมดได้ (กัน bot กวาดข้อมูล)
 *
 * ครูปิดหน้านี้ได้ด้วยการตั้ง student_portal = off ในแท็บ ⚙️ ตั้งค่า
 */

var STU_CACHE_SEC = 180;      // แคชผลไว้ 3 นาที — ครูแก้คะแนนแล้วเห็นช้าสุด 3 นาที
var STU_MAX_LOOKUPS = 40;     // จำนวนครั้งที่ค้นได้ต่อ 1 ชั่วโมง (กันไล่สุ่มเลขทีละใบ)

function studentPortalOn_(cfg) {
  return String((cfg || getConfig_()).student_portal || 'on').toLowerCase() !== 'off';
}

/**
 * ทางเข้าหลัก — คืนข้อมูลของนักเรียน 1 คน
 * โยน Error ถ้าไม่พบ (ข้อความเดียวกันเสมอ ไม่บอกว่าเลขนี้มีอยู่จริงไหม)
 */
function studentGet_(sid) {
  sid = String(sid == null ? '' : sid).trim();
  if (!sid) throw new Error('กรอกเลขประจำตัวก่อน');
  if (sid.length > 30) throw new Error('เลขประจำตัวไม่ถูกต้อง');

  var cache = CacheService.getScriptCache();
  var hit = cache.get('stu_' + sid);
  if (hit) return JSON.parse(hit);

  // แคชหมดอายุ → อ่านชีตรอบเดียวแล้วเก็บของนักเรียน "ทุกคน" ไว้
  // คนถัดไปที่เข้ามาจะได้จากแคชทันที ไม่ต้องอ่านชีตซ้ำ
  var all = buildStudentViews_();
  var keys = Object.keys(all);
  for (var i = 0; i < keys.length; i += 40) {
    var chunk = {};
    keys.slice(i, i + 40).forEach(function (k) { chunk['stu_' + k] = JSON.stringify(all[k]); });
    try { cache.putAll(chunk, STU_CACHE_SEC); } catch (e) {}
  }
  if (!all[sid]) throw new Error('ไม่พบเลขประจำตัวนี้ — ลองตรวจตัวเลขอีกครั้ง หรือถามครูผู้สอน');
  return all[sid];
}

/** จำกัดจำนวนครั้งที่ค้นได้ต่อชั่วโมง เพื่อไม่ให้ไล่สุ่มเลขประจำตัวทีละใบ */
function studentRateOk_() {
  var cache = CacheService.getScriptCache();
  var slot = 'rate_' + Math.floor(Date.now() / 3600000);
  var n = Number(cache.get(slot) || 0) + 1;
  cache.put(slot, String(n), 3900);
  return n <= STU_MAX_LOOKUPS * 20;   // เผื่อทั้งโรงเรียนเปิดพร้อมกัน แต่ยังกันบอทกวาด
}

/**
 * อ่านทุกแท็บห้องเรียนครั้งเดียว แล้วสร้างข้อมูลฝั่งนักเรียนของทุกคน
 * @return { "<เลขประจำตัว>": { sid, name, classes: [...] } }
 */
function buildStudentViews_() {
  var cfg = getConfig_();
  var S = scoreSettings_(cfg);
  var out = {};
  var now = new Date().toISOString();

  listClasses_().forEach(function (c) {
    var sh = sheetForClass_(c.classId);
    if (!sh) return;

    var data = readClassBySheet_(sh);
    var res = computeClassScores_(data, S);
    var byBucket = res.buckets;

    res.rows.forEach(function (r, idx) {
      var st = data.students[idx];
      if (!st || !st.sid) return;

      if (!out[st.sid]) out[st.sid] = { sid: st.sid, name: st.name || '', updated: now, classes: [] };
      if (!out[st.sid].name) out[st.sid].name = st.name || '';

      out[st.sid].classes.push(studentClassView_(data, r, st, byBucket, S));
    });
  });

  return out;
}

/** ข้อมูลของนักเรียน 1 คน ในวิชา 1 วิชา */
function studentClassView_(data, r, st, byBucket, S) {
  var V = data.values || {};

  // ── 8 ช่องคะแนนของ SGS ──
  var buckets = BUCKET_ORDER.map(function (id) {
    var b = STU_BUCKET_META[id];
    return {
      id: id, label: b.label, phase: b.phase, sgs: b.sgs,
      score: r[id], max: S.weight[id], has: !!r['_has_' + id]
    };
  });

  // คะแนนที่ครูกรอกแล้วเท่านั้น — ไม่เอาช่องว่างมาถ่วงให้ดูน่าตกใจ
  var earned = 0, outOf = 0;
  buckets.forEach(function (b) { if (b.has) { earned += b.score; outOf += b.max; } });

  // ── การเข้าเรียน ──
  var att = { 'ม': 0, 'ส': 0, 'ล': 0, 'ข': 0, checked: 0 };
  (data.columns || []).forEach(function (c) {
    if (c.kind !== 'ATT') return;
    var v = String((V[c.key] || {})[st.sid] || '').trim();
    if (ATT_CODES.indexOf(v) < 0) return;
    att[v]++; att.checked++;
  });

  // ── งานและข้อสอบรายชิ้น ──
  var items = [];
  BUCKET_ORDER.forEach(function (id) {
    (byBucket[id] || []).forEach(function (c) {
      if (c.kind === 'ATT') return;
      var raw = (V[c.key] || {})[st.sid];
      var w = parseWork_(raw);
      var mark = passMarkOf_(c, S);
      items.push({
        label: c.label || c.id,
        desc: c.desc || '',
        kind: c.kind,
        exam: c.kind !== 'WORK',
        phase: c.half === 2 ? 2 : 1,
        bucket: id,
        max: c.max == null ? 0 : c.max,
        status: w.status,
        score: w.status === 'ok' || w.status === 'late' ? w.score : null,
        // เกณฑ์ผ่านของชิ้นนี้ · null = ครูไม่ได้ตั้งเกณฑ์ไว้ จึงไม่ต้องบอกว่าผ่าน/ไม่ผ่าน
        pass: mark,
        passed: passOf_(c, raw, S)
      });
    });
  });

  return {
    subject: data.meta.subject || '',
    subjectCode: data.meta.subjectCode || '',
    grade: data.meta.grade || '',
    room: data.meta.room || '',
    no: st.no || '',
    buckets: buckets,
    earned: Math.round(earned * 100) / 100,
    outOf: Math.round(outOf * 100) / 100,
    fullTotal: 100,
    att: {
      present: att['ม'], late: att['ส'], leave: att['ล'], absent: att['ข'],
      checked: att.checked, pct: r.pct, minPct: S.minPct,
      risk: att.checked > 0 && r.pct < S.minPct
    },
    items: items,
    pending: r.pending,
    failN: r.failN || 0
  };
}

var STU_BUCKET_META = {
  work1: { label: 'ส่งงาน',       phase: 1, sgs: 'ช่อง 1' },
  quiz1: { label: 'สอบเก็บคะแนน', phase: 1, sgs: 'ช่อง 2' },
  att1:  { label: 'เข้าเรียน',     phase: 1, sgs: 'ช่อง 3' },
  mid:   { label: 'สอบกลางภาค',   phase: 1, sgs: 'กลางภาค' },
  work2: { label: 'ส่งงาน',       phase: 2, sgs: 'ช่อง 10' },
  quiz2: { label: 'สอบเก็บคะแนน', phase: 2, sgs: 'ช่อง 11' },
  att2:  { label: 'เข้าเรียน',     phase: 2, sgs: 'ช่อง 12' },
  fin:   { label: 'สอบปลายภาค',   phase: 2, sgs: 'ปลายภาค' }
};
