/**
 * AssignCheck V2 — โครงสร้างแท็บห้องเรียน (1 ห้อง-วิชา = 1 แท็บ)
 *
 * เลย์เอาต์
 *   แถว 1  หัวเรื่อง (คนอ่าน)
 *   แถว 2  ข้อมูลระบบ  ← ซ่อน
 *   แถว 3  หัวกลุ่ม สีพื้นแยกบล็อก (คนอ่าน)
 *   แถว 4  รหัสคอลัมน์ KIND|HALF|ID  ← ซ่อน
 *   แถว 5  ชื่อคอลัมน์ (คนอ่าน)
 *   แถว 6  คะแนนเต็ม
 *   แถว 7  เกณฑ์ผ่าน (ว่าง = ไม่ตรวจ)
 *   แถว 8+ ข้อมูลนักเรียน
 *
 *   A เลขที่ | B เลขประจำตัว | C ชื่อ-นามสกุล | D.. บล็อกข้อมูลเรียงซ้าย→ขวา
 *
 * ⚠️ แถว 7 เพิ่มเข้ามาทีหลัง ชีตที่สร้างก่อนหน้านั้นข้อมูลนักเรียนเริ่มที่แถว 7
 *    ตัวอ่านรองรับทั้ง 2 แบบ · คำสั่งเขียนจะเรียก ensureLayout_ อัปโครงให้ก่อนเสมอ
 */

var BLOCK_SOFT = {
  'ATT|1': '#eef3fd', 'WORK|1': '#edf7f0', 'QUIZ|1': '#fffaeb', 'MID|1': '#fdeeef',
  'ATT|2': '#e9effc', 'WORK|2': '#e8f4ec', 'QUIZ|2': '#fff7e0', 'FIN|2': '#fce9eb',
  'SUM|0': '#f4edfc'
};

function softColor_(kind, half) { return BLOCK_SOFT[kind + '|' + (kind === 'SUM' ? 0 : half)] || '#f5f5f5'; }

// ── หา / สร้างแท็บห้องเรียน ─────────────────────────────────

/**
 * หาแท็บของห้องเรียนจากรหัสห้อง
 *
 * ถามสารบัญ 🏫 ห้องเรียน ก่อนเสมอ (อ่านครั้งเดียว แล้วจำไว้ทั้งคำขอ)
 * ของเดิมไล่เปิดทุกแท็บแล้วอ่านเซลล์ทีละใบ = ครูที่มี 8 ห้องเสียเวลาไปฟรี ๆ
 * 8 รอบต่อ "ทุกคำสั่งที่แตะห้องเรียน" ซึ่งรวมถึงการกดเช็คชื่อทีละคน
 *
 * ยังเหลือการไล่ดูทุกแท็บไว้เป็นทางสำรอง เผื่อสารบัญเพี้ยน/ครูเปลี่ยนชื่อแท็บเอง
 */
var SHEET_FOR_CLASS_MEMO_ = {};

function sheetForClass_(classId) {
  if (!classId) return null;
  var hit = SHEET_FOR_CLASS_MEMO_[classId];
  if (hit) return hit;

  var ss = ss_();

  // 1) ทางลัด — สารบัญบอกชื่อแท็บไว้แล้ว (ยังต้องตรวจว่าใช่ห้องนั้นจริง)
  var idx = listClasses_();
  for (var k = 0; k < idx.length; k++) {
    if (String(idx[k].classId) !== classId) continue;
    var byName = idx[k].sheetName ? ss.getSheetByName(String(idx[k].sheetName)) : null;
    if (byName && byName.getMaxRows() >= R_DATA &&
        String(byName.getRange(R_META, 1).getValue()) === classId) {
      SHEET_FOR_CLASS_MEMO_[classId] = byName;
      return byName;
    }
    break;
  }

  // 2) ทางสำรอง — ไล่ดูทุกแท็บ
  var sheets = ss.getSheets();
  for (var i = 0; i < sheets.length; i++) {
    var sh = sheets[i];
    var n = sh.getName();
    if (n === SHEET_CONFIG || n === SHEET_CLASSES || n === SHEET_HELP) continue;
    if (sh.getMaxRows() < R_DATA) continue;
    if (String(sh.getRange(R_META, 1).getValue()) === classId) {
      SHEET_FOR_CLASS_MEMO_[classId] = sh;
      return sh;
    }
  }
  return null;
}

// ── โครงแถว: รองรับชีตรุ่นก่อนที่ยังไม่มีแถวเกณฑ์ผ่าน ──────

var PASS_MARK_ = 'เกณฑ์ผ่าน →';   // ป้ายในคอลัมน์ C ของแถวเกณฑ์ผ่าน — ใช้เป็นตัวบอกว่าชีตอัปโครงแล้ว

/**
 * ชีตแท็บนี้มีแถวเกณฑ์ผ่านหรือยัง
 *
 * ชีตรุ่นก่อนข้อมูลนักเรียนเริ่มที่แถว 7 · รุ่นใหม่แถว 7 เป็นเกณฑ์ผ่าน ข้อมูลเริ่มแถว 8
 * แยกด้วยป้ายในคอลัมน์ C ประกอบกับคอลัมน์ A ที่ต้องว่าง (รุ่นเก่าแถว 7 คือ นร. คนแรก
 * ซึ่งคอลัมน์ A มีเลขที่อยู่เสมอ) จึงไม่มีทางสับสนกับชื่อนักเรียนที่บังเอิญพ้องกัน
 *
 * @param head ตารางแถว 1..R_DATA ที่อ่านมาแล้ว (ถ้ามี จะได้ไม่ต้องอ่านชีตซ้ำ)
 */
function hasPassRow_(sh, head) {
  var a, c;
  if (head && head[R_PASS - 1]) {
    a = head[R_PASS - 1][C_NO - 1];
    c = head[R_PASS - 1][C_NAME - 1];
  } else {
    var row = sh.getRange(R_PASS, 1, 1, 3).getValues()[0];
    a = row[C_NO - 1]; c = row[C_NAME - 1];
  }
  return String(a).trim() === '' && String(c).trim() === PASS_MARK_;
}

/**
 * อัปโครงชีตให้มีแถวเกณฑ์ผ่าน — เรียกซ้ำได้ ไม่ทำอะไรถ้ามีอยู่แล้ว
 *
 * ⚠️ เรียกได้เฉพาะในคำสั่งที่ถือ lock อยู่ (คำสั่งเขียน) เท่านั้น
 *    คำสั่งอ่านไม่จับ lock ถ้าไปแทรกแถวตอนนั้นจะชนกับการเขียนที่ทำอยู่พร้อมกัน
 *    ฝั่งอ่านใช้วิธีรองรับทั้ง 2 โครงแทน (ดู readClassBySheet_)
 */
function ensureLayout_(sh) {
  if (hasPassRow_(sh)) return false;

  sh.insertRowBefore(R_PASS);        // ข้อมูลนักเรียนเลื่อนลงให้เองทั้งก้อน
  sh.getRange(R_PASS, 1, 1, 3).setValues([['', '', PASS_MARK_]])
    .setFontColor('#78909c').setFontSize(9)
    .setHorizontalAlignment('right').setBackground('#eceff1');
  sh.setFrozenRows(R_PASS);
  sh.setRowHeight(R_PASS, 20);
  return true;
}

function safeSheetName_(name) {
  var n = String(name).replace(/[[\]]/g, '').trim().substring(0, 95);
  if (!n) n = 'ห้องเรียน';
  var ss = ss_(), base = n, i = 2;
  while (ss.getSheetByName(n)) { n = base + ' (' + (i++) + ')'; }
  return n;
}

function buildSheetName_(meta) {
  var left = [meta.grade, meta.room].filter(String).join('/');
  return (left ? left + ' · ' : '') + (meta.subject || 'วิชาใหม่');
}

/**
 * สร้างห้องเรียนใหม่
 * meta: { subject, subjectCode, grade, room, teacher }
 * students: [{ no, sid, name }]
 */
function createClass_(meta, students) {
  var ss = ss_();
  var classId = uid_('C');
  var sheetName = safeSheetName_(buildSheetName_(meta));
  var sh = ss.insertSheet(sheetName);

  var cfg = getConfig_();
  var full = {
    classId: classId, subject: meta.subject || 'วิชาใหม่', subjectCode: meta.subjectCode || '',
    grade: meta.grade || '', room: meta.room || '',
    teacher: meta.teacher || cfg.teacher || '', year: cfg.year || '', term: cfg.term || '',
    sheetName: sheetName, status: 'ใช้งาน'
  };

  initClassLayout_(sh, full);
  if (students && students.length) setStudents_(sh, students);
  upsertClassRow_(full, students ? students.length : 0);
  return readClassBySheet_(sh);
}

function initClassLayout_(sh, meta) {
  sh.clear();
  if (sh.getMaxColumns() < 30) sh.insertColumnsAfter(sh.getMaxColumns(), 30 - sh.getMaxColumns());

  // แถว 1 — หัวเรื่อง
  sh.getRange(R_TITLE, 1, 1, 3).merge()
    .setValue('📘 ' + meta.subject + (meta.grade || meta.room ? '  ·  ' + [meta.grade, meta.room].filter(String).join('/') : ''))
    .setFontSize(13).setFontWeight('bold').setFontColor('#ffffff')
    .setBackground('#263238').setVerticalAlignment('middle');

  // แถว 2 — ข้อมูลระบบ (ซ่อน)
  sh.getRange(R_META, 1, 1, 8).setValues([[
    meta.classId, meta.subject, meta.subjectCode, meta.grade, meta.room,
    meta.teacher, meta.year, meta.term
  ]]);

  // หัวคอลัมน์คงที่ A–C
  sh.getRange(R_GROUP, 1, 1, 3).merge()
    .setValue('👤 ข้อมูลนักเรียน').setBackground('#cfd8dc')
    .setFontWeight('bold').setHorizontalAlignment('center');
  sh.getRange(R_KEY, 1, 1, 3).setValues([['NO', 'SID', 'NAME']]);
  sh.getRange(R_LABEL, 1, 1, 3).setValues([['เลขที่', 'เลขประจำตัว', 'ชื่อ-นามสกุล']])
    .setFontWeight('bold').setBackground('#eceff1');
  sh.getRange(R_MAX, 1, 1, 3).setValues([['', '', 'คะแนนเต็ม →']])
    .setFontColor('#78909c').setHorizontalAlignment('right').setBackground('#eceff1');
  sh.getRange(R_PASS, 1, 1, 3).setValues([['', '', PASS_MARK_]])
    .setFontColor('#78909c').setFontSize(9)
    .setHorizontalAlignment('right').setBackground('#eceff1');

  // บล็อกสรุป (สร้างครั้งเดียว อยู่ขวาสุดเสมอ)
  for (var i = 0; i < SUM_COLS.length; i++) {
    writeColumnHeader_(sh, C_FIRST + i, SUM_COLS[i].key, SUM_COLS[i].label, SUM_COLS[i].max);
  }

  sh.setFrozenRows(R_PASS);
  sh.setFrozenColumns(3);
  sh.setColumnWidth(1, 48);
  sh.setColumnWidth(2, 90);
  sh.setColumnWidth(3, 190);
  sh.setRowHeight(R_TITLE, 30);
  sh.setRowHeight(R_GROUP, 26);
  sh.setRowHeight(R_LABEL, 42);
  sh.setRowHeight(R_PASS, 20);
  sh.hideRows(R_META);
  sh.hideRows(R_KEY);
  sh.setHiddenGridlines(true);
  refreshGroupRow_(sh);
  return sh;
}

// ── คอลัมน์ ─────────────────────────────────────────────────

function columnsOf_(sh) {
  var lastCol = sh.getLastColumn();
  if (lastCol < C_FIRST) return [];
  var n = lastCol - C_FIRST + 1;
  // แถว 4-7 ติดกัน จึงขอทีเดียวได้ (เดิมขอทีละแถว = คุยกับ Google เกินจำเป็น)
  var hasPass = hasPassRow_(sh);
  var head   = sh.getRange(R_KEY, C_FIRST, (hasPass ? R_PASS : R_MAX) - R_KEY + 1, n).getValues();
  var keys   = head[0];
  var labels = head[R_LABEL - R_KEY];
  var maxes  = head[R_MAX - R_KEY];
  var passes = hasPass ? head[R_PASS - R_KEY] : [];
  var notes  = sh.getRange(R_LABEL, C_FIRST, 1, n).getNotes()[0];   // รายละเอียดงาน
  var out = [];
  for (var i = 0; i < n; i++) {
    var p = parseKey_(keys[i]);
    if (!p) continue;
    out.push({
      key: p.key, kind: p.kind, half: p.half, id: p.id,
      label: String(labels[i]), desc: String(notes[i] || ''),
      max: maxes[i] === '' ? null : num_(maxes[i]),
      pass: (passes[i] === undefined || passes[i] === '') ? null : num_(passes[i]),
      col: C_FIRST + i
    });
  }
  return out;
}

function writeColumnHeader_(sh, col, key, label, max, desc, pass) {
  var p = parseKey_(key);
  var soft = softColor_(p.kind, p.half);
  sh.getRange(R_KEY, col).setValue(key);
  sh.getRange(R_LABEL, col).setValue(label)
    .setFontWeight('bold').setFontSize(9).setWrap(true)
    .setHorizontalAlignment('center').setVerticalAlignment('middle')
    .setBackground(soft)
    .setNote(desc ? String(desc) : null);       // รายละเอียดงาน — เอาเมาส์ชี้ที่หัวคอลัมน์แล้วเห็น
  sh.getRange(R_MAX, col).setValue(max === '' || max == null ? '' : max)
    .setFontColor('#546e7a').setFontSize(9)
    .setHorizontalAlignment('center').setBackground(soft);
  // เกณฑ์ผ่านของรายการนี้ — ว่าง = ไม่ตรวจ (หรือใช้ค่าตั้งต้นจาก ⚙️ ตั้งค่า ถ้าตั้งไว้)
  sh.getRange(R_PASS, col).setValue(pass === '' || pass == null ? '' : pass)
    .setFontColor('#c62828').setFontSize(9)
    .setHorizontalAlignment('center').setBackground(soft);

  var body = sh.getRange(R_DATA, col, Math.max(sh.getMaxRows() - R_DATA + 1, 1), 1);
  body.setHorizontalAlignment('center').setVerticalAlignment('middle').setFontSize(10);

  if (p.kind === 'ATT') {
    sh.setColumnWidth(col, 46);
    body.setDataValidation(
      SpreadsheetApp.newDataValidation().requireValueInList(ATT_CODES, true)
        .setAllowInvalid(false).build()
    );
  } else if (p.kind === 'SUM') {
    sh.setColumnWidth(col, p.id === 'flag' ? 150 : 68);
    if (p.id === 'total') body.setFontWeight('bold');
  } else {
    sh.setColumnWidth(col, 76);
    body.setNumberFormat('0.##');
  }
}

/** คืนดัชนีคอลัมน์ของ key — สร้างใหม่ถ้ายังไม่มี */
function ensureColumn_(sh, key, label, max, desc, pass) {
  var p = parseKey_(key);
  if (!p) throw new Error('รหัสคอลัมน์ไม่ถูกต้อง: ' + key);

  ensureLayout_(sh);   // ต้องมีแถวเกณฑ์ผ่านก่อน ไม่งั้นเขียนไปตกบนหัวนักเรียนคนแรก

  var cols = columnsOf_(sh);
  for (var i = 0; i < cols.length; i++) if (cols[i].key === key) {
    if (label != null) sh.getRange(R_LABEL, cols[i].col).setValue(label);
    if (max != null)   sh.getRange(R_MAX,   cols[i].col).setValue(max);
    if (desc != null)  sh.getRange(R_LABEL, cols[i].col).setNote(String(desc) || null);
    // '' = สั่งล้างเกณฑ์ทิ้ง · null/undefined = ไม่ได้สั่งอะไร ปล่อยของเดิมไว้
    if (pass !== null && pass !== undefined) {
      sh.getRange(R_PASS, cols[i].col).setValue(pass === '' ? '' : pass);
    }
    return cols[i].col;
  }

  var bi = blockIndex_(p.kind, p.half);
  var insertAt = C_FIRST;
  for (var j = 0; j < cols.length; j++) {
    if (blockIndex_(cols[j].kind, cols[j].half) <= bi) insertAt = cols[j].col + 1;
  }

  if (insertAt > sh.getMaxColumns()) sh.insertColumnAfter(sh.getMaxColumns());
  else sh.insertColumnBefore(insertAt);

  // ล้างรูปแบบที่ติดมาจากคอลัมน์ข้างเคียง
  sh.getRange(1, insertAt, sh.getMaxRows(), 1).clear({ contentsOnly: false })
    .setDataValidation(null).setBackground(null).setFontColor(null).setFontWeight('normal');

  writeColumnHeader_(sh, insertAt, key, label || p.id, max, desc, pass);
  refreshGroupRow_(sh);
  return insertAt;
}

function deleteColumn_(sh, key) {
  var cols = columnsOf_(sh);
  for (var i = 0; i < cols.length; i++) {
    if (cols[i].key === key) {
      if (cols[i].kind === 'SUM') throw new Error('ลบคอลัมน์สรุปไม่ได้');
      sh.deleteColumn(cols[i].col);
      refreshGroupRow_(sh);
      return true;
    }
  }
  return false;
}

/** วาดแถบหัวกลุ่มใหม่ทั้งแถว ให้สีและชื่อบล็อกตรงกับคอลัมน์ปัจจุบัน */
function refreshGroupRow_(sh) {
  var lastCol = Math.max(sh.getLastColumn(), C_FIRST);
  var span = lastCol - C_FIRST + 1;
  var range = sh.getRange(R_GROUP, C_FIRST, 1, span);
  range.breakApart();
  range.clearContent().setBackground('#ffffff').setBorder(false, false, false, false, false, false);

  var cols = columnsOf_(sh);
  if (!cols.length) return;

  // จัดกลุ่มคอลัมน์ที่ติดกันและอยู่บล็อกเดียวกันเป็นแถบเดียว
  var runStart = 0;
  for (var i = 1; i <= cols.length; i++) {
    var sameBlock = i < cols.length &&
      blockIndex_(cols[i].kind, cols[i].half) === blockIndex_(cols[runStart].kind, cols[runStart].half) &&
      cols[i].col === cols[i - 1].col + 1;
    if (sameBlock) continue;
    paintGroup_(sh, cols[runStart], cols[i - 1].col);
    runStart = i;
  }
}

function paintGroup_(sh, firstCol, lastColIdx) {
  var b = BLOCKS[blockIndex_(firstCol.kind, firstCol.half)];
  if (!b) return;
  var r = sh.getRange(R_GROUP, firstCol.col, 1, lastColIdx - firstCol.col + 1);
  if (lastColIdx > firstCol.col) r.merge();
  r.setValue(b.title)
    .setBackground(b.color).setFontWeight('bold').setFontSize(10)
    .setHorizontalAlignment('center').setVerticalAlignment('middle')
    .setBorder(true, true, true, true, false, false, '#ffffff', SpreadsheetApp.BorderStyle.SOLID_MEDIUM);
}

// ── นักเรียน ────────────────────────────────────────────────

function studentsOf_(sh) {
  var lastRow = sh.getLastRow();
  if (lastRow < R_DATA) return [];
  var vals = sh.getRange(R_DATA, C_NO, lastRow - R_DATA + 1, 3).getValues();
  var out = [];
  for (var i = 0; i < vals.length; i++) {
    if (String(vals[i][2]).trim() === '' && String(vals[i][1]).trim() === '') continue;
    out.push({
      no: String(vals[i][0]), sid: String(vals[i][1]), name: String(vals[i][2]),
      row: R_DATA + i
    });
  }
  return out;
}

/** เขียนทับรายชื่อทั้งหมด (ข้อมูลคะแนนเดิมจะถูกย้ายตาม sid) */
function setStudents_(sh, students) {
  ensureLayout_(sh);   // ต้องรู้แถวเริ่มข้อมูลที่ถูกต้องก่อนเขียนทับรายชื่อ
  var old = studentsOf_(sh);
  var cols = columnsOf_(sh).filter(function (c) { return c.kind !== 'SUM'; });

  // เก็บค่าเดิมไว้ตาม sid
  var keep = {};
  if (old.length && cols.length) {
    var lastCol = sh.getLastColumn();
    var grid = sh.getRange(R_DATA, C_FIRST, old.length, lastCol - C_FIRST + 1).getValues();
    old.forEach(function (s, i) {
      keep[s.sid] = {};
      cols.forEach(function (c) { keep[s.sid][c.key] = grid[i][c.col - C_FIRST]; });
    });
  }

  // ล้างเฉพาะช่วงแถวที่เคยมีข้อมูลจริง — อย่ากวาดถึงท้ายชีต (ช้ามากเมื่อชีตมี 1000 แถว)
  var clearRows = Math.max(old.length, students.length);
  if (clearRows > 0) {
    sh.getRange(R_DATA, 1, clearRows, Math.max(sh.getLastColumn(), 3)).clearContent();
  }

  var need = R_DATA + students.length - 1;
  if (need > sh.getMaxRows()) sh.insertRowsAfter(sh.getMaxRows(), need - sh.getMaxRows());
  if (!students.length) return;

  var rows = students.map(function (s, i) {
    return [s.no || (i + 1), s.sid || ('T' + (i + 1)), s.name || ''];
  });
  sh.getRange(R_DATA, 1, rows.length, 3).setValues(rows);
  sh.getRange(R_DATA, C_NO, rows.length, 1).setHorizontalAlignment('center');
  sh.getRange(R_DATA, C_SID, rows.length, 1).setHorizontalAlignment('center').setNumberFormat('@');
  sh.getRange(R_DATA, 1, rows.length, 3).setBackground('#fafafa');

  // คืนค่าคะแนนเดิมของ sid ที่ยังอยู่
  if (cols.length) {
    var width = sh.getLastColumn() - C_FIRST + 1;
    var grid2 = [];
    for (var i = 0; i < rows.length; i++) {
      var row = new Array(width).fill('');
      var prev = keep[String(rows[i][1])];
      if (prev) cols.forEach(function (c) { row[c.col - C_FIRST] = prev[c.key] === undefined ? '' : prev[c.key]; });
      grid2.push(row);
    }
    sh.getRange(R_DATA, C_FIRST, grid2.length, width).setValues(grid2);
  }

  // จัดรูปแบบรายแถวเฉพาะตอนจำนวนนักเรียนเปลี่ยน — เป็นขั้นตอนที่ช้าที่สุดของฟังก์ชันนี้
  if (rows.length !== old.length) applyBanding_(sh, rows.length);
}

function applyBanding_(sh, count) {
  if (count < 1) return;
  sh.getRange(R_DATA, 1, count, Math.max(sh.getLastColumn(), 3))
    .setBorder(null, null, true, null, null, true, '#e0e0e0', SpreadsheetApp.BorderStyle.SOLID);
  sh.setRowHeights(R_DATA, count, 24);
}

// ── อ่านห้องเรียนทั้งแท็บ ───────────────────────────────────

/**
 * อ่านทั้งแท็บด้วยการเรียกชีตครั้งเดียว
 *
 * ของเดิมอ่านทีละส่วน (ข้อมูลระบบ · รายชื่อ · รหัสคอลัมน์ · ชื่อคอลัมน์ ·
 * โน้ต · คะแนนเต็ม · ตารางค่า) = คุยกับ Google 7-9 รอบต่อการเปิดห้อง 1 ครั้ง
 * ซึ่งเป็นคำสั่งที่ถูกเรียกบ่อยที่สุดในระบบ (เปิดแอป · สลับห้อง · หลังบันทึกทุกครั้ง)
 *
 * ตอนนี้ขอตารางทั้งผืนทีเดียวแล้วแยกเอาเองในหน่วยความจำ เหลือ 2 รอบ
 * (ค่า + โน้ตของแถวชื่อคอลัมน์ ซึ่งขอรวมกับค่าไม่ได้)
 */
function readClassBySheet_(sh) {
  var lastRow = Math.max(sh.getLastRow(), R_PASS);
  var lastCol = Math.max(sh.getLastColumn(), Math.min(8, sh.getMaxColumns()));
  var grid = sh.getRange(1, 1, lastRow, lastCol).getValues();

  /* ชีตรุ่นก่อนไม่มีแถวเกณฑ์ผ่าน ข้อมูลนักเรียนจึงเริ่มเร็วกว่า 1 แถว
   * ตรงนี้ต้องรองรับทั้ง 2 แบบ เพราะคำสั่งอ่านไม่จับ lock จะไปแทรกแถวเองไม่ได้
   * (คำสั่งเขียนจะอัปโครงให้เองผ่าน ensureLayout_ แล้วอาการนี้จะหายไปเอง) */
  var hasPass = hasPassRow_(sh, grid);
  var dataRow = hasPass ? R_DATA : R_PASS;

  var m = grid[R_META - 1];
  var meta = {
    classId: String(m[0] || ''), subject: m[1], subjectCode: m[2], grade: m[3], room: m[4],
    teacher: m[5], year: m[6], term: m[7], sheetName: sh.getName()
  };

  // รายชื่อ — ข้ามแถวที่ทั้งเลขประจำตัวและชื่อว่าง (เกณฑ์เดียวกับ studentsOf_)
  var students = [];
  for (var r = dataRow - 1; r < grid.length; r++) {
    var row = grid[r];
    if (String(row[C_SID - 1]).trim() === '' && String(row[C_NAME - 1]).trim() === '') continue;
    students.push({
      no: String(row[C_NO - 1]), sid: String(row[C_SID - 1]), name: String(row[C_NAME - 1]),
      row: r + 1
    });
  }

  // คอลัมน์ — โน้ต (รายละเอียดงาน) อยู่คนละชั้นกับค่า ต้องขอแยก
  var n = lastCol - C_FIRST + 1;
  var notes = n > 0 ? sh.getRange(R_LABEL, C_FIRST, 1, n).getNotes()[0] : [];
  var cols = [];
  for (var i = 0; i < n; i++) {
    var p = parseKey_(grid[R_KEY - 1][C_FIRST - 1 + i]);
    if (!p) continue;
    var mx = grid[R_MAX - 1][C_FIRST - 1 + i];
    var ps = hasPass ? grid[R_PASS - 1][C_FIRST - 1 + i] : '';
    cols.push({
      key: p.key, kind: p.kind, half: p.half, id: p.id,
      label: String(grid[R_LABEL - 1][C_FIRST - 1 + i]),
      desc: String(notes[i] || ''),
      max: mx === '' ? null : num_(mx),
      pass: (ps === '' || ps === null || ps === undefined) ? null : num_(ps),
      col: C_FIRST + i
    });
  }

  var values = {};
  cols.forEach(function (c) {
    var m2 = {};
    for (var j = 0; j < students.length; j++) {
      var v = grid[students[j].row - 1][c.col - 1];
      if (v !== '' && v !== null) m2[students[j].sid] = v;
    }
    values[c.key] = m2;
  });

  return {
    meta: meta,
    students: students.map(function (s) { return { no: s.no, sid: s.sid, name: s.name }; }),
    columns: cols.map(function (c) {
      var o = { key: c.key, kind: c.kind, half: c.half, id: c.id, label: c.label, desc: c.desc || '', max: c.max, pass: c.pass };
      if (c.kind === 'ATT') {
        var a = parseAttId_(c.id);
        if (a) { o.date = a.date; o.period = a.period; }
      }
      return o;
    }),
    values: values
  };
}

function readClass_(classId) {
  var sh = sheetForClass_(classId);
  if (!sh) throw new Error('ไม่พบห้องเรียน: ' + classId);
  return readClassBySheet_(sh);
}

// ── เขียนค่าเป็นชุด ─────────────────────────────────────────

/** cells: [{ key, sid, value }] — value '' หรือ null = ล้างค่า */
function writeCells_(sh, cells) {
  if (!cells || !cells.length) return 0;
  ensureLayout_(sh);   // ชีตรุ่นเก่าแถวเลื่อนไป 1 ถ้าไม่อัปก่อน คะแนนจะลงผิดแถว
  var students = studentsOf_(sh);
  var rowOf = {};
  students.forEach(function (s) { rowOf[s.sid] = s.row; });

  var colOf = {};
  columnsOf_(sh).forEach(function (c) { colOf[c.key] = c.col; });

  // จัดกลุ่มตามคอลัมน์ แล้วเขียนทีละคอลัมน์เป็นช่วงเดียว
  var byCol = {};
  cells.forEach(function (c) {
    var col = colOf[c.key];
    var row = rowOf[String(c.sid)];
    if (!col || !row) return;
    if (!byCol[col]) byCol[col] = [];
    byCol[col].push({ row: row, value: (c.value === null || c.value === undefined) ? '' : c.value });
  });

  var written = 0;
  var first = R_DATA, count = students.length;
  Object.keys(byCol).forEach(function (col) {
    var range = sh.getRange(first, Number(col), count, 1);
    var cur = range.getValues();
    byCol[col].forEach(function (u) { cur[u.row - first][0] = u.value; written++; });
    range.setValues(cur);
  });
  return written;
}
