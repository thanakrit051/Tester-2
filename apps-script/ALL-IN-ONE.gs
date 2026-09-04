/* ═══════════════════════════════════════════════════════════════════
   AssignCheck V2 — รวมทุกไฟล์ไว้ในไฟล์เดียว (วางครั้งเดียวจบ)
   ───────────────────────────────────────────────────────────────────
   วิธีใช้
     1. เปิด Google Sheet → เมนู "ส่วนขยาย (Extensions) → Apps Script"
     2. ลบโค้ดเดิมใน Code.gs ให้หมด แล้ววางไฟล์นี้ทั้งไฟล์
     3. กดบันทึก (Ctrl+S)
     4. กลับไปที่ Sheet แล้วรีเฟรชหน้า → จะเห็นเมนู "📗 AssignCheck"
     5. กดเมนู 📗 AssignCheck → 🚀 ติดตั้ง / ซ่อมแซมโครงสร้าง

   ⚠️ ไฟล์นี้สร้างจากการรวมไฟล์ในโฟลเดอร์ apps-script/ อัตโนมัติ
      ถ้าจะแก้โค้ด ให้แก้ที่ไฟล์ต้นทางแล้วรันใหม่: node tools/bundle.mjs
   ═══════════════════════════════════════════════════════════════════ */


/* ══════ 00_Constants.gs ══════ */

/**
 * AssignCheck V2 — ค่าคงที่และตัวช่วยพื้นฐาน
 * ระบบเก็บข้อมูล: Google Sheet ไฟล์เดียว, 1 ห้อง-วิชา = 1 แท็บ
 */

// ── เวอร์ชัน ────────────────────────────────────────────────
// ⚠️ ต้องตรงกับ APP_VERSION ใน js/version.js
//    ถ้าเลขไม่ตรง หน้าเว็บจะขึ้นแถบเตือนให้ผู้ใช้อัปเดต/Deploy ใหม่
var SERVER_VERSION = '2.10.0';

// ── ชื่อแท็บระบบ ────────────────────────────────────────────
var SHEET_CONFIG  = '⚙️ ตั้งค่า';
var SHEET_CLASSES = '🏫 ห้องเรียน';
var SHEET_HELP    = '📖 วิธีใช้';

// ── โครงแถวของแท็บห้องเรียน ────────────────────────────────
var R_TITLE = 1;   // แถวหัวเรื่อง (คนอ่าน)
var R_META  = 2;   // แถวข้อมูลระบบ (ซ่อน)
var R_GROUP = 3;   // แถวหัวกลุ่ม สีพื้น (คนอ่าน)
var R_KEY   = 4;   // แถวรหัสคอลัมน์ (ซ่อน)
var R_LABEL = 5;   // แถวชื่อคอลัมน์ (คนอ่าน)
var R_MAX   = 6;   // แถวคะแนนเต็ม (คนอ่าน)
var R_DATA  = 7;   // แถวแรกของข้อมูลนักเรียน

var C_NO   = 1;    // A เลขที่
var C_SID  = 2;    // B เลขประจำตัว
var C_NAME = 3;    // C ชื่อ-นามสกุล
var C_FIRST = 4;   // D คอลัมน์ข้อมูลแรก

// ── ลำดับบล็อกซ้าย → ขวา ───────────────────────────────────
// kind|half ใช้เป็นตัวจัดลำดับ คอลัมน์ใหม่จะถูกแทรกท้ายบล็อกของตัวเอง
var BLOCKS = [
  { kind: 'ATT',  half: 1, title: '🕐 เช็คชื่อ · ก่อนกลางภาค',        color: '#d7e3fc', bucket: 'att1'  },
  { kind: 'WORK', half: 1, title: '📝 ส่งงาน · ก่อนกลางภาค',          color: '#d4edda', bucket: 'work1' },
  { kind: 'QUIZ', half: 1, title: '✍️ สอบเก็บคะแนน · ก่อนกลางภาค',   color: '#fff3cd', bucket: 'quiz1' },
  { kind: 'MID',  half: 1, title: '📄 สอบกลางภาค',                    color: '#f8d7da', bucket: 'mid'   },
  { kind: 'ATT',  half: 2, title: '🕐 เช็คชื่อ · หลังกลางภาค',        color: '#c9d9fa', bucket: 'att2'  },
  { kind: 'WORK', half: 2, title: '📝 ส่งงาน · หลังกลางภาค',          color: '#c3e6cb', bucket: 'work2' },
  { kind: 'QUIZ', half: 2, title: '✍️ สอบเก็บคะแนน · หลังกลางภาค',   color: '#ffeaa7', bucket: 'quiz2' },
  { kind: 'FIN',  half: 2, title: '📕 สอบปลายภาค',                    color: '#f5c6cb', bucket: 'fin'   },
  { kind: 'SUM',  half: 0, title: '📊 สรุปคะแนนสำหรับกรอก SGS',       color: '#e2d4f7', bucket: null    }
];

// คอลัมน์ในบล็อกสรุป (เรียงตามลำดับคอลัมน์จริงในหน้า SGS)
var SUM_COLS = [
  { key: 'SUM|0|work1', label: 'SGS ช่อง 1\nส่งงาน',        max: 10  },
  { key: 'SUM|0|quiz1', label: 'SGS ช่อง 2\nสอบเก็บคะแนน',  max: 10  },
  { key: 'SUM|0|att1',  label: 'SGS ช่อง 3\nเข้าเรียน',      max: 5   },
  { key: 'SUM|0|mid',   label: 'SGS กลางภาค',                max: 20  },
  { key: 'SUM|0|work2', label: 'SGS ช่อง 10\nส่งงาน',        max: 10  },
  { key: 'SUM|0|quiz2', label: 'SGS ช่อง 11\nสอบเก็บคะแนน',  max: 10  },
  { key: 'SUM|0|att2',  label: 'SGS ช่อง 12\nเข้าเรียน',      max: 5   },
  { key: 'SUM|0|fin',   label: 'SGS ปลายภาค',                max: 30  },
  { key: 'SUM|0|total', label: 'รวม',                         max: 100 },
  { key: 'SUM|0|grade', label: 'เกรด',                        max: ''  },
  { key: 'SUM|0|pct',   label: '% เวลาเรียน',                 max: ''  },
  { key: 'SUM|0|flag',  label: 'หมายเหตุ',                    max: ''  }
];

// ── รหัสสถานะการเข้าเรียน (เก็บในชีตเป็นตัวอักษรไทยตัวเดียว) ──
var ATT_CODES = ['ม', 'ส', 'ล', 'ข'];   // มา / สาย / ลา / ขาด
var ATT_NAMES = { 'ม': 'มา', 'ส': 'สาย', 'ล': 'ลา', 'ข': 'ขาด' };

// ── รหัสสถานะการส่งงาน (บันทึกคู่กับคะแนนในเซลล์เดียว) ─────
//   เซลล์ว่าง = ยังไม่ตรวจ | 'x' = ไม่ส่ง | '8' = ส่ง ได้ 8 | 'L8' = ส่งช้า ได้ 8
var NOT_SUBMITTED = 'x';
var LATE_PREFIX   = 'L';

/** อ่านค่าในช่องเช็คงาน — ต้องตรงกับ parseWork ใน js/score.js */
function parseWork_(raw) {
  var s = (raw === undefined || raw === null) ? '' : String(raw).trim();
  if (s === '') return { status: 'none', score: 0 };
  if (s.toLowerCase() === NOT_SUBMITTED) return { status: 'miss', score: 0 };
  var late = /^l/i.test(s);
  var n = Number(late ? s.slice(1) : s);
  if (isNaN(n)) return { status: 'none', score: 0 };
  return { status: late ? 'late' : 'ok', score: n };
}

// ── ค่าตั้งต้นของ ⚙️ ตั้งค่า ────────────────────────────────
var CONFIG_DEFAULTS = [
  ['หมวด', 'คีย์', 'ค่า', 'คำอธิบาย'],
  ['ทั่วไป', 'year',        '2568', 'ปีการศึกษา'],
  ['ทั่วไป', 'term',        '1',    'ภาคเรียนที่'],
  ['ทั่วไป', 'teacher',     '',     'ชื่อครูผู้สอน'],
  ['ทั่วไป', 'apiKey',      '',     'รหัสลับสำรองสำหรับเชื่อมเว็บแอป (สร้างอัตโนมัติ ห้ามเผยแพร่)'],
  ['บัญชี Google', 'oauth_client_id', '', 'OAuth Client ID สำหรับปุ่ม "เข้าสู่ระบบด้วย Google" (เปิดเผยได้ ไม่ใช่ความลับ)'],
  ['บัญชี Google', 'allowed_emails',  '', 'อีเมลที่อนุญาต คั่นด้วยจุลภาค — เว้นว่าง = เฉพาะเจ้าของไฟล์นี้'],
  ['ทั่วไป', 'mid_date',    '',     'วันสอบกลางภาค (YYYY-MM-DD) — ใช้เดาว่าวันที่เช็คชื่ออยู่ช่วงก่อนหรือหลังกลางภาค'],
  ['ทั่วไป', 'student_portal', 'on', 'หน้าให้นักเรียนดูผลตัวเอง: on = เปิด | off = ปิด'],
  ['ทั่วไป', 'assets_url',     '',   'ที่อยู่ไฟล์หน้าตาบน GitHub Pages เช่น https://ชื่อคุณ.github.io/assigncheck/'],

  ['น้ำหนักคะแนน', 'w_work1', '10', 'ส่งงาน ก่อนกลางภาค → SGS ช่อง 1'],
  ['น้ำหนักคะแนน', 'w_quiz1', '10', 'สอบเก็บคะแนน ก่อนกลางภาค → SGS ช่อง 2'],
  ['น้ำหนักคะแนน', 'w_att1',  '5',  'เข้าเรียน ก่อนกลางภาค → SGS ช่อง 3'],
  ['น้ำหนักคะแนน', 'w_mid',   '20', 'สอบกลางภาค → SGS กลางภาค'],
  ['น้ำหนักคะแนน', 'w_work2', '10', 'ส่งงาน หลังกลางภาค → SGS ช่อง 10'],
  ['น้ำหนักคะแนน', 'w_quiz2', '10', 'สอบเก็บคะแนน หลังกลางภาค → SGS ช่อง 11'],
  ['น้ำหนักคะแนน', 'w_att2',  '5',  'เข้าเรียน หลังกลางภาค → SGS ช่อง 12'],
  ['น้ำหนักคะแนน', 'w_fin',   '30', 'สอบปลายภาค → SGS ปลายภาค'],

  ['การเข้าเรียน', 'att_mode',   'ratio', 'ratio = คิดตามสัดส่วน | deduct = หักคะแนนจากเต็ม'],
  ['การเข้าเรียน', 'att_w_มา',   '1',    'โหมด ratio: น้ำหนักเมื่อ "มา"'],
  ['การเข้าเรียน', 'att_w_สาย',  '0.5',  'โหมด ratio: น้ำหนักเมื่อ "สาย"'],
  ['การเข้าเรียน', 'att_w_ลา',   '1',    'โหมด ratio: น้ำหนักเมื่อ "ลา"'],
  ['การเข้าเรียน', 'att_w_ขาด',  '0',    'โหมด ratio: น้ำหนักเมื่อ "ขาด"'],
  ['การเข้าเรียน', 'att_d_สาย',  '0.25', 'โหมด deduct: หักกี่คะแนนต่อการมาสาย 1 คาบ'],
  ['การเข้าเรียน', 'att_d_ลา',   '0',    'โหมด deduct: หักกี่คะแนนต่อการลา 1 คาบ'],
  ['การเข้าเรียน', 'att_d_ขาด',  '0.5',  'โหมด deduct: หักกี่คะแนนต่อการขาด 1 คาบ'],
  ['การเข้าเรียน', 'att_min_pct','80',   'เวลาเรียนขั้นต่ำ (%) ถ้าต่ำกว่านี้ติดธง "มส"'],
  ['การเข้าเรียน', 'att_count_ลา','TRUE','นับ "ลา" เป็นเวลาเรียนในการคิด % หรือไม่'],

  ['การให้คะแนน', 'ungraded_mode', 'ignore', 'ช่องที่ยังไม่ตรวจ (ว่าง): ignore = ไม่นำมาคิด | zero = นับเป็น 0 คะแนน'],
  ['การให้คะแนน', 'late_penalty_pct', '0', 'ส่งช้าหักกี่ % ของคะแนนเต็ม (0 = ไม่หัก) ระบบหักให้ตอนกดปุ่ม "ส่งช้า"'],

  ['การปัดเศษ', 'round_digits', '0',    'ทศนิยมของคะแนนสรุป (0, 1 หรือ 2)'],
  ['การปัดเศษ', 'round_mode',   'half', 'half = ปัดครึ่งขึ้น | up = ปัดขึ้น | down = ปัดลง'],

  ['เกรด', 'grade_cuts', '80:4, 75:3.5, 70:3, 65:2.5, 60:2, 55:1.5, 50:1, 0:0', 'เกณฑ์คะแนนรวม:เกรด']
];

// ── ตัวช่วยทั่วไป ───────────────────────────────────────────
function ss_() { return SpreadsheetApp.getActiveSpreadsheet(); }

function uid_(prefix) {
  return prefix + Utilities.getUuid().replace(/-/g, '').substring(0, 8);
}

function blockIndex_(kind, half) {
  for (var i = 0; i < BLOCKS.length; i++) {
    if (BLOCKS[i].kind === kind && (BLOCKS[i].kind === 'SUM' || BLOCKS[i].half === half)) return i;
  }
  return -1;
}

/** แยกรหัสคอลัมน์ "KIND|HALF|ID" */
function parseKey_(key) {
  if (!key) return null;
  var p = String(key).split('|');
  if (p.length < 3) return null;
  return { kind: p[0], half: Number(p[1]), id: p.slice(2).join('|'), key: String(key) };
}

function makeKey_(kind, half, id) { return kind + '|' + half + '|' + id; }

/** แปลง id ของคาบเรียน "20260807-2" → { date:'2026-08-07', period:2 } */
function parseAttId_(id) {
  var m = String(id).match(/^(\d{4})(\d{2})(\d{2})-(\d+)$/);
  if (!m) return null;
  return { date: m[1] + '-' + m[2] + '-' + m[3], period: Number(m[4]) };
}

/** คาบแรกของวันแสดงแค่วันที่ · คาบที่ 2 ขึ้นไปค่อยบอกเลขคาบ */
function attLabel_(id) {
  var a = parseAttId_(id);
  if (!a) return id;
  var d = a.date.split('-');
  return d[2] + '/' + d[1] + (a.period > 1 ? '\nคาบ ' + a.period : '');
}

function num_(v, dflt) {
  var n = Number(v);
  return isNaN(n) ? (dflt === undefined ? 0 : dflt) : n;
}

function bool_(v) {
  var s = String(v).trim().toUpperCase();
  return s === 'TRUE' || s === 'ใช่' || s === '1' || s === 'YES';
}


/* ══════ 01_Setup.gs ══════ */

/**
 * AssignCheck V2 — ติดตั้งครั้งแรก และเมนูใน Google Sheet
 */

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('📗 AssignCheck')
    .addItem('🚀 ติดตั้ง / ซ่อมแซมโครงสร้าง', 'setupWorkbook')
    .addItem('🔑 สร้างรหัสลับใหม่ (API Key)', 'regenerateApiKey')
    .addSeparator()
    .addItem('📊 คำนวณคะแนนสรุปแท็บนี้', 'recalcActiveSheet')
    .addItem('📊 คำนวณคะแนนสรุปทุกห้อง', 'recalcAllClasses')
    .addSeparator()
    .addItem('💾 สำรองไฟล์นี้เดี๋ยวนี้', 'backupNowMenu')
    .addToUi();
}

/** สร้างแท็บระบบทั้งหมด — เรียกซ้ำได้ ไม่ลบข้อมูลเดิม */
function setupWorkbook() {
  var ss = ss_();
  ensureConfigSheet_(ss);
  ensureClassesSheet_(ss);

  // สร้างรหัสลับก่อน เพื่อให้แท็บวิธีใช้แสดงรหัสได้ตั้งแต่รอบแรก
  if (!getConfig_().apiKey) {
    setConfigValue_('apiKey', Utilities.getUuid().replace(/-/g, ''));
    SpreadsheetApp.flush();
  }

  // ตั้งสำรองไฟล์อัตโนมัติทุกสัปดาห์ — เรียกซ้ำได้ ไม่สร้างทริกเกอร์ซ้ำ
  try { ensureAutoBackupTrigger_(); } catch (e) { console.error('ตั้งสำรองอัตโนมัติไม่สำเร็จ: ' + e); }

  ensureHelpSheet_(ss);

  // จัดลำดับแท็บระบบไว้หน้าสุด
  [SHEET_HELP, SHEET_CLASSES, SHEET_CONFIG].forEach(function (n) {
    var sh = ss.getSheetByName(n);
    if (sh) { ss.setActiveSheet(sh); ss.moveActiveSheet(1); }
  });
  ss.setActiveSheet(ss.getSheetByName(SHEET_HELP));

  try {
    SpreadsheetApp.getUi().alert('ติดตั้งเรียบร้อย ✅\n\nดูขั้นตอนถัดไปได้ที่แท็บ "' + SHEET_HELP + '"');
  } catch (e) { /* เรียกจากสคริปต์ ไม่มี UI */ }
}

function regenerateApiKey() {
  var k = Utilities.getUuid().replace(/-/g, '');
  setConfigValue_('apiKey', k);
  SpreadsheetApp.flush();
  ensureHelpSheet_(ss_());
  try {
    SpreadsheetApp.getUi().alert('รหัสลับใหม่:\n\n' + k + '\n\nอย่าลืมไปอัปเดตในเว็บแอปด้วย');
  } catch (e) {}
  return k;
}

// ── ⚙️ ตั้งค่า ──────────────────────────────────────────────
function ensureConfigSheet_(ss) {
  var sh = ss.getSheetByName(SHEET_CONFIG);
  if (!sh) {
    sh = ss.insertSheet(SHEET_CONFIG);
    sh.getRange(1, 1, CONFIG_DEFAULTS.length, 4).setValues(CONFIG_DEFAULTS);
  } else {
    // เติมเฉพาะคีย์ที่ยังไม่มี (ไม่ทับค่าที่ครูแก้ไว้)
    var have = {};
    var last = sh.getLastRow();
    if (last > 1) {
      sh.getRange(2, 2, last - 1, 1).getValues().forEach(function (r) { have[r[0]] = true; });
    }
    var add = CONFIG_DEFAULTS.slice(1).filter(function (r) { return !have[r[1]]; });
    if (add.length) sh.getRange(sh.getLastRow() + 1, 1, add.length, 4).setValues(add);
  }

  sh.setFrozenRows(1);
  sh.getRange(1, 1, 1, 4)
    .setBackground('#37474f').setFontColor('#ffffff').setFontWeight('bold');
  sh.setColumnWidth(1, 130);
  sh.setColumnWidth(2, 130);
  sh.setColumnWidth(3, 180);
  sh.setColumnWidth(4, 460);
  sh.getRange(1, 1, sh.getMaxRows(), 4).setVerticalAlignment('middle');
  sh.getRange(2, 4, sh.getMaxRows() - 1, 1).setFontColor('#78909c').setWrap(true);
  sh.getRange(2, 3, sh.getMaxRows() - 1, 1).setBackground('#fffde7');
  return sh;
}

function getConfig_() {
  var sh = ss_().getSheetByName(SHEET_CONFIG);
  var out = {};
  if (!sh || sh.getLastRow() < 2) return out;
  sh.getRange(2, 2, sh.getLastRow() - 1, 2).getValues().forEach(function (r) {
    if (r[0] !== '') out[String(r[0]).trim()] = r[1];
  });
  return out;
}

function setConfigValue_(key, value) {
  var sh = ss_().getSheetByName(SHEET_CONFIG);
  var last = sh.getLastRow();
  var keys = sh.getRange(2, 2, Math.max(last - 1, 1), 1).getValues();
  for (var i = 0; i < keys.length; i++) {
    if (String(keys[i][0]).trim() === key) {
      sh.getRange(i + 2, 3).setValue(value);
      return;
    }
  }
  sh.getRange(last + 1, 1, 1, 3).setValues([['เพิ่มเติม', key, value]]);
}

// ── 🏫 ห้องเรียน (สารบัญ) ───────────────────────────────────
var CLASSES_HEADER = ['รหัสห้อง', 'ชื่อวิชา', 'รหัสวิชา', 'ระดับชั้น', 'ห้อง',
                      'ชื่อแท็บ', 'จำนวน นร.', 'อัปเดตล่าสุด', 'สถานะ'];

function ensureClassesSheet_(ss) {
  var sh = ss.getSheetByName(SHEET_CLASSES);
  if (!sh) {
    sh = ss.insertSheet(SHEET_CLASSES);
    sh.getRange(1, 1, 1, CLASSES_HEADER.length).setValues([CLASSES_HEADER]);
  }
  sh.setFrozenRows(1);
  sh.getRange(1, 1, 1, CLASSES_HEADER.length)
    .setBackground('#1b5e20').setFontColor('#ffffff').setFontWeight('bold');
  sh.setColumnWidth(1, 110);
  sh.setColumnWidth(2, 220);
  sh.setColumnWidth(6, 240);
  sh.setColumnWidth(8, 160);
  return sh;
}

/** เขียนแถวสารบัญของห้อง (สร้างใหม่ถ้ายังไม่มี) */
function upsertClassRow_(meta, studentCount) {
  var sh = ensureClassesSheet_(ss_());
  var last = sh.getLastRow();
  var row = -1;
  if (last > 1) {
    var ids = sh.getRange(2, 1, last - 1, 1).getValues();
    for (var i = 0; i < ids.length; i++) {
      if (String(ids[i][0]) === meta.classId) { row = i + 2; break; }
    }
  }
  if (row < 0) row = last + 1;
  sh.getRange(row, 1, 1, CLASSES_HEADER.length).setValues([[
    meta.classId, meta.subject, meta.subjectCode || '', meta.grade || '', meta.room || '',
    meta.sheetName, studentCount, new Date(), meta.status || 'ใช้งาน'
  ]]);
  sh.getRange(row, 8).setNumberFormat('dd/MM/yyyy HH:mm');
}

function removeClassRow_(classId) {
  var sh = ss_().getSheetByName(SHEET_CLASSES);
  if (!sh || sh.getLastRow() < 2) return;
  var ids = sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues();
  for (var i = ids.length - 1; i >= 0; i--) {
    if (String(ids[i][0]) === classId) sh.deleteRow(i + 2);
  }
}

function listClasses_() {
  var sh = ss_().getSheetByName(SHEET_CLASSES);
  if (!sh || sh.getLastRow() < 2) return [];
  return sh.getRange(2, 1, sh.getLastRow() - 1, CLASSES_HEADER.length).getValues()
    .filter(function (r) { return r[0] !== ''; })
    .map(function (r) {
      return {
        classId: String(r[0]), subject: r[1], subjectCode: r[2], grade: r[3], room: r[4],
        sheetName: r[5], studentCount: num_(r[6]),
        updatedAt: r[7] ? new Date(r[7]).toISOString() : null,
        status: r[8] || 'ใช้งาน'
      };
    });
}

// ── 📖 วิธีใช้ ──────────────────────────────────────────────
function ensureHelpSheet_(ss) {
  var sh = ss.getSheetByName(SHEET_HELP);
  if (!sh) sh = ss.insertSheet(SHEET_HELP);
  sh.clear();

  var apiKey = getConfig_().apiKey || '(กดเมนู 📗 AssignCheck → ติดตั้ง เพื่อสร้าง)';
  var url = '(คัดลอกจาก Apps Script → Deploy → Web app URL)';
  var rows = [
    ['📗 AssignCheck — ระบบเช็คชื่อ เช็คงาน และสรุปคะแนนเข้า SGS'],
    [''],
    ['ไฟล์นี้คือ "ฐานข้อมูล" ทั้งหมดของระบบ ทุกอย่างอยู่ในไฟล์เดียวนี้'],
    [''],
    ['📁 แท็บในไฟล์นี้'],
    ['⚙️ ตั้งค่า', 'น้ำหนักคะแนน กติกาเช็คชื่อ การปัดเศษ และรหัสลับเชื่อมเว็บแอป'],
    ['🏫 ห้องเรียน', 'สารบัญห้อง/วิชาทั้งหมด — ห้ามแก้ด้วยมือ ระบบเขียนให้เอง'],
    ['ห้อง-วิชา ต่างๆ', '1 ห้อง-วิชา = 1 แท็บ เก็บทั้งรายชื่อ เช็คชื่อ คะแนน และสรุปไว้ในแท็บเดียว'],
    [''],
    ['🧭 อ่านแท็บห้องเรียนยังไง — ไล่จากซ้ายไปขวา'],
    ['คอลัมน์ A–C', 'เลขที่ · เลขประจำตัว · ชื่อ-นามสกุล (ตรึงไว้ให้เลื่อนตาม)'],
    ['บล็อกสีฟ้า', '🕐 เช็คชื่อ — 1 คอลัมน์ = 1 คาบเรียน (ม=มา ส=สาย ล=ลา ข=ขาด)'],
    ['บล็อกสีเขียว', '📝 ส่งงาน — 1 คอลัมน์ = 1 ชิ้นงาน (ตัวเลข=คะแนน, x=ไม่ส่ง, ว่าง=ยังไม่ตรวจ)'],
    ['บล็อกสีเหลือง', '✍️ สอบเก็บคะแนน — 1 คอลัมน์ = 1 ครั้ง'],
    ['บล็อกสีแดง', '📄 สอบกลางภาค / 📕 สอบปลายภาค'],
    ['บล็อกสีม่วง', '📊 สรุปคะแนน 8 ช่องตรงกับหน้า SGS พอดี — คัดลอกไปวางได้เลย'],
    ['', 'ครบ 4 บล็อกแรก = ก่อนกลางภาค, 4 บล็อกถัดไป = หลังกลางภาค'],
    [''],
    ['⚠️ แถวที่ 2 และแถวที่ 4 ถูกซ่อนไว้ เป็นข้อมูลระบบ อย่าลบหรือแก้'],
    [''],
    ['🚀 ขั้นตอนติดตั้ง'],
    ['1', 'เมนู 📗 AssignCheck → 🚀 ติดตั้ง / ซ่อมแซมโครงสร้าง (ทำแล้ว ✅)'],
    ['2', 'Apps Script → Deploy → New deployment → ประเภท "Web app"'],
    ['', '   Execute as: Me   |   Who has access: Anyone   → คัดลอก URL ที่ได้'],
    ['3', 'เปิดเว็บแอปบน GitHub Pages → วาง URL + รหัสลับด้านล่าง → เชื่อมต่อ'],
    [''],
    ['🔑 รหัสลับ (API Key) — เก็บเป็นความลับ ห้ามแชร์ไฟล์นี้แบบสาธารณะ'],
    ['', apiKey],
    [''],
    ['🔗 URL เว็บแอป (Apps Script)', url],
    [''],
    ['🗄️ สำรองข้อมูล'],
    ['อัตโนมัติ', 'สำเนาทั้งไฟล์ทุกวันอาทิตย์ตี 3 เก็บ ' + BACKUP_KEEP + ' ก้อนล่าสุด — ดูใน Google Drive โฟลเดอร์ "' + BACKUP_FOLDER_NAME + '"'],
    ['สำรองเอง', 'เมนู 📗 AssignCheck → 💾 สำรองไฟล์นี้เดี๋ยวนี้ (ทำก่อนแก้อะไรใหญ่ ๆ ได้)'],
    ['กู้คืน', 'เปิดไฟล์สำรองที่ต้องการ → Deploy เป็น Web app ใหม่ (URL จะเปลี่ยน ต้องอัปเดตในเว็บแอปด้วย)']
  ];

  sh.getRange(1, 1, rows.length, 2).setValues(rows.map(function (r) {
    return [r[0] || '', r[1] || ''];
  }));

  sh.getRange(1, 1).setFontSize(16).setFontWeight('bold').setFontColor('#1b5e20');

  // เน้นแถวหัวข้อ (แถวที่มีข้อความคอลัมน์เดียว) และแถวรหัสลับ — คำนวณจากข้อมูลจริง
  for (var i = 1; i < rows.length; i++) {
    var isHeading = rows[i][0] && !rows[i][1] && /^(🧭|📁|🚀|🔑|🔗|⚠️|🗄️)/u.test(rows[i][0]);
    if (isHeading) sh.getRange(i + 1, 1, 1, 2).setFontWeight('bold').setBackground('#e8f5e9');
    if (rows[i][1] === apiKey) sh.getRange(i + 1, 2).setFontFamily('Courier New').setBackground('#fff3e0');
  }
  sh.setColumnWidth(1, 200);
  sh.setColumnWidth(2, 700);
  sh.getRange(1, 1, rows.length, 2).setVerticalAlignment('middle').setWrap(true);
  sh.setHiddenGridlines(true);
  return sh;
}


/* ══════ 02_ClassSheet.gs ══════ */

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
 *   แถว 7+ ข้อมูลนักเรียน
 *
 *   A เลขที่ | B เลขประจำตัว | C ชื่อ-นามสกุล | D.. บล็อกข้อมูลเรียงซ้าย→ขวา
 */

var BLOCK_SOFT = {
  'ATT|1': '#eef3fd', 'WORK|1': '#edf7f0', 'QUIZ|1': '#fffaeb', 'MID|1': '#fdeeef',
  'ATT|2': '#e9effc', 'WORK|2': '#e8f4ec', 'QUIZ|2': '#fff7e0', 'FIN|2': '#fce9eb',
  'SUM|0': '#f4edfc'
};

function softColor_(kind, half) { return BLOCK_SOFT[kind + '|' + (kind === 'SUM' ? 0 : half)] || '#f5f5f5'; }

// ── หา / สร้างแท็บห้องเรียน ─────────────────────────────────

function sheetForClass_(classId) {
  var ss = ss_();
  var sheets = ss.getSheets();
  for (var i = 0; i < sheets.length; i++) {
    var sh = sheets[i];
    var n = sh.getName();
    if (n === SHEET_CONFIG || n === SHEET_CLASSES || n === SHEET_HELP) continue;
    if (sh.getMaxRows() < R_DATA) continue;
    if (String(sh.getRange(R_META, 1).getValue()) === classId) return sh;
  }
  return null;
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

  // บล็อกสรุป (สร้างครั้งเดียว อยู่ขวาสุดเสมอ)
  for (var i = 0; i < SUM_COLS.length; i++) {
    writeColumnHeader_(sh, C_FIRST + i, SUM_COLS[i].key, SUM_COLS[i].label, SUM_COLS[i].max);
  }

  sh.setFrozenRows(R_MAX);
  sh.setFrozenColumns(3);
  sh.setColumnWidth(1, 48);
  sh.setColumnWidth(2, 90);
  sh.setColumnWidth(3, 190);
  sh.setRowHeight(R_TITLE, 30);
  sh.setRowHeight(R_GROUP, 26);
  sh.setRowHeight(R_LABEL, 42);
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
  var keys   = sh.getRange(R_KEY,   C_FIRST, 1, n).getValues()[0];
  var labels = sh.getRange(R_LABEL, C_FIRST, 1, n).getValues()[0];
  var notes  = sh.getRange(R_LABEL, C_FIRST, 1, n).getNotes()[0];   // รายละเอียดงาน
  var maxes  = sh.getRange(R_MAX,   C_FIRST, 1, n).getValues()[0];
  var out = [];
  for (var i = 0; i < n; i++) {
    var p = parseKey_(keys[i]);
    if (!p) continue;
    out.push({
      key: p.key, kind: p.kind, half: p.half, id: p.id,
      label: String(labels[i]), desc: String(notes[i] || ''),
      max: maxes[i] === '' ? null : num_(maxes[i]),
      col: C_FIRST + i
    });
  }
  return out;
}

function writeColumnHeader_(sh, col, key, label, max, desc) {
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
function ensureColumn_(sh, key, label, max, desc) {
  var p = parseKey_(key);
  if (!p) throw new Error('รหัสคอลัมน์ไม่ถูกต้อง: ' + key);

  var cols = columnsOf_(sh);
  for (var i = 0; i < cols.length; i++) if (cols[i].key === key) {
    if (label != null) sh.getRange(R_LABEL, cols[i].col).setValue(label);
    if (max != null)   sh.getRange(R_MAX,   cols[i].col).setValue(max);
    if (desc != null)  sh.getRange(R_LABEL, cols[i].col).setNote(String(desc) || null);
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

  writeColumnHeader_(sh, insertAt, key, label || p.id, max, desc);
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

function readClassBySheet_(sh) {
  var m = sh.getRange(R_META, 1, 1, 8).getValues()[0];
  var meta = {
    classId: String(m[0]), subject: m[1], subjectCode: m[2], grade: m[3], room: m[4],
    teacher: m[5], year: m[6], term: m[7], sheetName: sh.getName()
  };
  var students = studentsOf_(sh);
  var cols = columnsOf_(sh);
  var values = {};

  if (students.length && cols.length) {
    var lastCol = sh.getLastColumn();
    var grid = sh.getRange(R_DATA, C_FIRST, students.length, lastCol - C_FIRST + 1).getValues();
    cols.forEach(function (c) {
      var m2 = {};
      for (var i = 0; i < students.length; i++) {
        var v = grid[i][c.col - C_FIRST];
        if (v !== '' && v !== null) m2[students[i].sid] = v;
      }
      values[c.key] = m2;
    });
  }

  return {
    meta: meta,
    students: students.map(function (s) { return { no: s.no, sid: s.sid, name: s.name }; }),
    columns: cols.map(function (c) {
      var o = { key: c.key, kind: c.kind, half: c.half, id: c.id, label: c.label, desc: c.desc || '', max: c.max };
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


/* ══════ 03_Score.gs ══════ */

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
    digits: num_(cfg.round_digits, 0),
    roundMode: String(cfg.round_mode || 'half').toLowerCase(),
    cuts: parseCuts_(cfg.grade_cuts)
  };
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
        var w = parseWork_((data.values[c.key] || {})[st.sid]);
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

    // ถือว่าจบเทอมเมื่อกรอกคะแนนปลายภาคของคนนี้แล้ว
    var termDone = byBucket.fin.some(function (c) {
      return String((data.values[c.key] || {})[st.sid] || '').trim() !== '';
    });

    var flags = [];
    if (attStat.total > 0 && r.pct < S.minPct) flags.push('มส (เวลาเรียน ' + r.pct + '%)');
    if (pending > 0) flags.push('ยังไม่ตรวจ ' + pending + ' รายการ');
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
  var data = readClassBySheet_(sh);
  var S = scoreSettings_(getConfig_());
  var res = computeClassScores_(data, S);

  // ให้แน่ใจว่าคอลัมน์สรุปมีครบ (กรณีไฟล์เก่า)
  SUM_COLS.forEach(function (sc) { ensureColumn_(sh, sc.key, sc.label, sc.max); });

  var colOf = {};
  columnsOf_(sh).forEach(function (c) { if (c.kind === 'SUM') colOf[c.id] = c.col; });

  if (res.rows.length) {
    var order = ['work1', 'quiz1', 'att1', 'mid', 'work2', 'quiz2', 'att2', 'fin', 'total', 'grade', 'pct', 'flag'];
    order.forEach(function (id) {
      var col = colOf[id];
      if (!col) return;
      var vals = res.rows.map(function (r) {
        // ช่องที่ยังไม่มีข้อมูล ปล่อยว่างไว้ อย่าเขียน 0 ให้เข้าใจผิดว่าได้ 0 คะแนน
        if (BUCKET_ORDER.indexOf(id) >= 0) return r['_has_' + id] ? r[id] : '';
        if (id === 'total') return r.dataN ? r.total : '';
        if (id === 'pct')   return r.attN ? r.pct + '%' : '';
        return r[id] === undefined ? '' : r[id];
      });
      sh.getRange(R_DATA, col, vals.length, 1).setValues(vals.map(function (v) { return [v]; }));
    });
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


/* ══════ 04_Api.gs ══════ */

/**
 * AssignCheck V2 — Web API (เว็บแอปบน GitHub Pages เรียกเข้ามาที่นี่)
 *
 * เรียกด้วย POST เท่านั้น และตั้ง Content-Type เป็น text/plain
 * เพื่อเลี่ยง CORS preflight ที่ Apps Script ตอบไม่ได้
 *
 *   body = { key: "<apiKey>", action: "<ชื่อคำสั่ง>", payload: {...} }
 */

/**
 * ข้อมูลสาธารณะ — ไม่มีความลับ ใช้ให้เครื่องใหม่รู้ว่าต้องล็อกอินด้วย Client ID ไหน
 * (Google Client ID ถูกออกแบบมาให้เปิดเผยได้อยู่แล้ว)
 */
/**
 * เปิด URL นี้ = ได้หน้าเว็บแอปเลย (ไม่ต้องมีโฮสต์ภายนอก)
 * ต่อท้าย ?api=1 ถ้าต้องการข้อมูลแบบ JSON (ใช้ตอนเปิดจากโฮสต์อื่น)
 */
/**
 * ต่อไฟล์ย่อยกลับเป็นก้อนเดียว — เรียกจากเทมเพลตด้วย <?!= include('Js1') ?>
 * (โค้ดหน้าเว็บถูกหั่นเป็นไฟล์เล็ก เพราะตัวแก้ไขของ Apps Script วางไฟล์ยาวได้ไม่ครบ)
 */
function include(name) {
  return HtmlService.createHtmlOutputFromFile(name).getContent();
}

/**
 * ที่อยู่ของไฟล์หน้าตา/โค้ดหน้าเว็บ (โฮสต์ไว้บน GitHub Pages)
 *
 * เก็บไว้ในชีตแทนที่จะฝังในไฟล์ HTML เพราะ
 *   1. ย้ายที่อยู่ได้โดยไม่ต้องวางไฟล์ใหม่
 *   2. ไฟล์ Index.html เล็กมาก จึงวางลง Apps Script ได้ครบเสมอ
 *      (ปัญหาที่เจอ: ไฟล์ยาว ๆ วางแล้วตัวอักษรหายไปเงียบ ๆ นับพันตัว)
 */
function assetsBase_(cfg) {
  var u = String((cfg || getConfig_()).assets_url || '').trim();
  if (!u) return '';
  if (u.indexOf('https://') !== 0) return '';          // อนุญาตเฉพาะ https
  if (u.charAt(u.length - 1) !== '/') u += '/';
  return u.replace(/["'<>\s]/g, '');                   // กันอักขระที่ทำให้แท็กเพี้ยน
}

/** หน้าบอกวิธีตั้งค่า ตอนที่ยังไม่ได้ใส่ assets_url */
function setupNeededPage_() {
  return HtmlService.createHtmlOutput(
    '<div style="font-family:system-ui,sans-serif;max-width:460px;margin:60px auto;padding:0 20px;' +
    'line-height:1.8;color:#56635d">' +
    '<div style="font-size:19px;font-weight:700;color:#131917;margin-bottom:10px">ยังตั้งค่าไม่ครบ</div>' +
    '<div style="font-size:14px">หน้าเว็บนี้โหลดหน้าตาและโค้ดจาก GitHub Pages ' +
    'แต่ยังไม่ได้บอกว่าอยู่ที่ไหน</div>' +
    '<div style="font-size:14px;margin-top:16px"><b style="color:#131917">วิธีแก้</b><br>' +
    'เปิด Google Sheet → แท็บ <b>⚙️ ตั้งค่า</b> → หาแถว <code>assets_url</code><br>' +
    'ใส่ที่อยู่ GitHub Pages ของคุณ เช่น<br>' +
    '<code style="background:#eef1ef;padding:3px 7px;border-radius:6px;display:inline-block;margin-top:6px">' +
    'https://ชื่อคุณ.github.io/assigncheck/</code><br><br>' +
    'แล้วรีเฟรชหน้านี้ (ไม่ต้อง Deploy ใหม่)</div></div>')
    .setTitle('AssignCheck — ตั้งค่า');
}

function doGet(e) {
  var p = (e && e.parameter) || {};
  if (p.api === '1') return apiInfo_();

  // ?page=student = หน้าให้นักเรียนดูผลตัวเอง (ถ้าย้ายไป GitHub แล้วจะไม่มีไฟล์นี้)
  if (p.page === 'student' || p.s === '1') {
    try {
      return HtmlService.createHtmlOutputFromFile('Student')
        .setTitle('ผลการเรียนของฉัน')
        .addMetaTag('viewport', 'width=device-width, initial-scale=1, viewport-fit=cover')
        .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
    } catch (err) {
      return HtmlService.createHtmlOutput(
        '<div style="font-family:sans-serif;text-align:center;padding:60px 20px;color:#56635d">' +
        '<div style="font-size:17px;font-weight:700;color:#131917">ไม่พบหน้าของนักเรียนในที่นี้</div>' +
        '<div style="margin-top:8px;font-size:13.5px">หน้าสำหรับนักเรียนถูกย้ายไปไว้ที่ GitHub Pages แล้ว ' +
        'ให้ใช้ลิงก์นั้นแทน</div></div>');
    }
  }

  var assets = assetsBase_(getConfig_());
  if (!assets) return setupNeededPage_();

  var t = HtmlService.createTemplateFromFile('Index');
  t.assets = assets;
  return t.evaluate()
    .setTitle('AssignCheck')
    // หน้านี้อยู่ใน iframe ของ Google แท็บจึงไม่อ่าน <link rel="icon"> ในไฟล์
    // ต้องบอกทางนี้ทางเดียว ไม่งั้นครูเห็นไอคอน Google Drive บนแท็บ
    .setFaviconUrl(assets + 'icons/favicon-32.png')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, viewport-fit=cover')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function apiInfo_() {
  var cfg = getConfig_();
  return json_({
    ok: true,
    service: 'AssignCheck V2',
    version: SERVER_VERSION,
    time: new Date().toISOString(),
    clientId: String(cfg.oauth_client_id || ''),
    googleSignIn: !!String(cfg.oauth_client_id || '').trim()
  });
}

/**
 * ตรวจ ID token จาก Google แล้วเทียบกับรายชื่ออีเมลที่อนุญาต
 * ผลลัพธ์ถูกแคชไว้ เพื่อไม่ต้องยิงออกเน็ตทุกคำขอ (ช้า)
 */
function verifyIdToken_(idToken, cfg) {
  if (!idToken) return null;

  var cache = CacheService.getScriptCache();
  var ck = 'idt_' + Utilities.base64EncodeWebSafe(
    Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, idToken));
  var hit = cache.get(ck);
  if (hit) return JSON.parse(hit);

  var resp = UrlFetchApp.fetch(
    'https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(idToken),
    { muteHttpExceptions: true });
  if (resp.getResponseCode() !== 200) return null;

  var info;
  try { info = JSON.parse(resp.getContentText()); } catch (e) { return null; }

  var clientId = String(cfg.oauth_client_id || '').trim();
  if (!clientId) throw new Error('ยังไม่ได้ตั้ง oauth_client_id ในแท็บ ⚙️ ตั้งค่า');
  if (String(info.aud) !== clientId) return null;
  if (String(info.email_verified) !== 'true') return null;

  var expMs = Number(info.exp) * 1000;
  if (!(expMs > Date.now())) return null;

  var email = String(info.email || '').toLowerCase();
  if (!isAllowedEmail_(email, cfg)) throw new Error('บัญชี ' + email + ' ไม่มีสิทธิ์ใช้ไฟล์นี้');

  var user = { email: email, name: info.name || email };
  var ttl = Math.max(60, Math.min(1800, Math.floor((expMs - Date.now()) / 1000) - 60));
  cache.put(ck, JSON.stringify(user), ttl);
  return user;
}

/** ว่างไว้ = อนุญาตเฉพาะเจ้าของไฟล์ (คนที่ deploy) */
function isAllowedEmail_(email, cfg) {
  var raw = String(cfg.allowed_emails || '').trim();
  if (!raw) {
    var owner = '';
    try { owner = String(Session.getEffectiveUser().getEmail() || '').toLowerCase(); } catch (e) {}
    return !owner || owner === email;
  }
  return raw.toLowerCase().split(/[,\s;]+/).filter(String).indexOf(email) >= 0;
}

/**
 * ทางเข้าสำหรับหน้าเว็บที่ Apps Script เสิร์ฟเอง (google.script.run)
 * ผู้ใช้ผ่านหน้าล็อกอินของ Google มาแล้ว จึงรู้อีเมลได้เลย ไม่ต้องใช้รหัสลับ
 */
function apiCall(bodyJson) {
  var req;
  try { req = JSON.parse(bodyJson || '{}'); }
  catch (err) { return JSON.stringify({ ok: false, error: 'อ่านคำขอไม่ได้' }); }
  return handle_(req, true).getContent();
}

function doPost(e) {
  var req;
  try {
    req = JSON.parse((e && e.postData && e.postData.contents) || '{}');
  } catch (err) {
    return json_({ ok: false, error: 'อ่านคำขอไม่ได้ (JSON ไม่ถูกต้อง)' });
  }
  return handle_(req, false);
}

/** อีเมลของผู้ใช้ที่กำลังเปิดหน้าเว็บอยู่ (โหมด Apps Script เสิร์ฟเอง) */
function activeEmail_() {
  var email = '';
  try { email = String(Session.getActiveUser().getEmail() || '').toLowerCase(); } catch (e) {}
  return email;
}

function handle_(req, embedded) {

  var cfg = getConfig_();
  if (!cfg.apiKey) return json_({ ok: false, error: 'ยังไม่ได้ติดตั้ง — เปิด Sheet แล้วกดเมนู 📗 AssignCheck → ติดตั้ง' });

  // ── ทางเข้าของนักเรียน: เปิดสาธารณะโดยตั้งใจ ──────────────
  // อ่านอย่างเดียว · คืนข้อมูลคนเดียว · ไม่แตะชีต (ดูกติกาใน 05_Student.gs)
  if (String(req.action || '') === 'studentGet') {
    if (!studentPortalOn_(cfg)) {
      return json_({ ok: false, error: 'ครูปิดหน้าดูผลของนักเรียนไว้อยู่' });
    }
    if (!studentRateOk_()) {
      return json_({ ok: false, error: 'มีการค้นหาถี่เกินไป กรุณาลองใหม่ในอีกสักครู่' });
    }
    try {
      var sview = studentGet_((req.payload || {}).sid);
      return json_({ ok: true, data: sview, version: SERVER_VERSION });
    } catch (serr) {
      return json_({ ok: false, error: String(serr && serr.message ? serr.message : serr) });
    }
  }

  // ผ่านได้ 3 ทาง เรียงตามความสะดวก
  //   1) เปิดจากหน้าเว็บที่ Apps Script เสิร์ฟเอง — Google ล็อกอินให้แล้ว
  //   2) ID token จาก Google Sign-In (กรณีเปิดจากโฮสต์ภายนอก)
  //   3) รหัสลับ (วิธีสำรอง)
  var user;

  if (embedded) {
    var email = activeEmail_();
    if (!email) {
      return json_({
        ok: false, code: 'AUTH',
        error: 'ระบุตัวตนไม่ได้ — ตั้ง Deploy เป็น "Who has access: Anyone with a Google account" แล้ว Deploy ใหม่'
      });
    }
    if (!isAllowedEmail_(email, cfg)) {
      return json_({ ok: false, code: 'FORBIDDEN', error: 'บัญชี ' + email + ' ไม่มีสิทธิ์ใช้ไฟล์นี้' });
    }
    user = { email: email, name: email };
  } else {
    try {
      user = verifyIdToken_(req.idToken, cfg);
    } catch (err) {
      return json_({ ok: false, error: String(err.message || err), code: 'FORBIDDEN' });
    }
    if (!user && String(req.key || '') !== String(cfg.apiKey)) {
      return json_({
        ok: false, code: 'AUTH',
        error: req.idToken ? 'เซสชัน Google หมดอายุ กรุณาเข้าสู่ระบบใหม่' : 'ยังไม่ได้เข้าสู่ระบบ'
      });
    }
  }

  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(25000);
  } catch (err) {
    return json_({ ok: false, error: 'ระบบกำลังบันทึกข้อมูลอื่นอยู่ กรุณาลองใหม่' });
  }

  try {
    var pl = req.payload || {};
    if (user) pl.__user = user;
    var result = dispatch_(String(req.action || ''), pl, cfg);
    return json_({ ok: true, data: result, user: user, version: SERVER_VERSION });
  } catch (err) {
    console.error(err);
    return json_({ ok: false, error: String(err && err.message ? err.message : err) });
  } finally {
    lock.releaseLock();
  }
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ── ตัวกระจายคำสั่ง ─────────────────────────────────────────

function dispatch_(action, p, cfg) {
  switch (action) {

    case 'ping':
      return { year: cfg.year, term: cfg.term, teacher: cfg.teacher, user: p.__user || null };

    case 'bootstrap': {
      var appUrl = '';
      try { appUrl = ScriptApp.getService().getUrl() || ''; } catch (e) {}
      return { config: publicConfig_(cfg), classes: listClasses_(), webAppUrl: appUrl };
    }

    case 'saveConfig': {
      Object.keys(p.entries || {}).forEach(function (k) {
        if (k === 'apiKey') return;                       // ห้ามแก้รหัสลับผ่าน API
        setConfigValue_(k, p.entries[k]);
      });
      return publicConfig_(getConfig_());
    }

    // ── ห้องเรียน ───────────────────────────────────────────
    case 'getClass':
      return readClass_(p.classId);

    case 'createClass':
      return createClass_(p.meta || {}, normalizeStudents_(p.students || []));

    case 'updateClassMeta': {
      var sh = requireSheet_(p.classId);
      var cur = sh.getRange(R_META, 1, 1, 8).getValues()[0];
      var m = p.meta || {};
      var next = [
        cur[0],
        m.subject !== undefined ? m.subject : cur[1],
        m.subjectCode !== undefined ? m.subjectCode : cur[2],
        m.grade !== undefined ? m.grade : cur[3],
        m.room !== undefined ? m.room : cur[4],
        m.teacher !== undefined ? m.teacher : cur[5],
        m.year !== undefined ? m.year : cur[6],
        m.term !== undefined ? m.term : cur[7]
      ];
      sh.getRange(R_META, 1, 1, 8).setValues([next]);
      sh.getRange(R_TITLE, 1).setValue(
        '📘 ' + next[1] + ((next[3] || next[4]) ? '  ·  ' + [next[3], next[4]].filter(String).join('/') : '')
      );
      if (m.renameSheet !== false) {
        var want = buildSheetName_({ subject: next[1], grade: next[3], room: next[4] });
        if (want !== sh.getName()) sh.setName(safeSheetName_(want));
      }
      var data = readClassBySheet_(sh);
      upsertClassRow_(data.meta, data.students.length);
      return data.meta;
    }

    case 'deleteClass': {
      var sh2 = requireSheet_(p.classId);
      ss_().deleteSheet(sh2);
      removeClassRow_(p.classId);
      return { deleted: p.classId };
    }

    // ── นักเรียน ────────────────────────────────────────────
    case 'setStudents': {
      var sh3 = requireSheet_(p.classId);
      setStudents_(sh3, normalizeStudents_(p.students || []));
      var d3 = readClassBySheet_(sh3);
      upsertClassRow_(d3.meta, d3.students.length);
      return d3;
    }

    // ── คอลัมน์ (คาบเรียน / ชิ้นงาน / ข้อสอบ) ───────────────
    case 'addColumn': {
      var sh4 = requireSheet_(p.classId);
      var spec = columnSpec_(p);
      ensureColumn_(sh4, spec.key, spec.label, spec.max, spec.desc);
      return readClassBySheet_(sh4);
    }

    case 'updateColumn': {
      var sh5 = requireSheet_(p.classId);
      var cols5 = columnsOf_(sh5);
      var hit = cols5.filter(function (c) { return c.key === p.key; })[0];
      if (!hit) throw new Error('ไม่พบคอลัมน์: ' + p.key);
      if (p.label !== undefined) sh5.getRange(R_LABEL, hit.col).setValue(p.label);
      if (p.max !== undefined)   sh5.getRange(R_MAX,   hit.col).setValue(p.max);
      if (p.desc !== undefined)  sh5.getRange(R_LABEL, hit.col).setNote(String(p.desc) || null);
      if (p.max !== undefined) recalcClass_(p.classId);   // เปลี่ยนคะแนนเต็ม = คะแนนสรุปเปลี่ยนตาม
      return readClassBySheet_(sh5);
    }

    case 'deleteColumn': {
      var sh6 = requireSheet_(p.classId);
      deleteColumn_(sh6, p.key);
      recalcClass_(p.classId);        // ลบแล้วต้องคิดใหม่ ไม่งั้นคะแนนเดิมค้างอยู่ในชีต
      return readClassBySheet_(sh6);
    }

    // ── บันทึกค่า ───────────────────────────────────────────
    case 'setCells': {
      var sh7 = requireSheet_(p.classId);
      var n = writeCells_(sh7, p.cells || []);
      var out = { written: n };
      if (p.recalc) out.summary = recalcClass_(p.classId).rows;
      return out;
    }

    /**
     * ส่งงานค้างจากโหมดออฟไลน์เป็นชุดเดียว
     * ops: [{ action, payload }]  ทำตามลำดับ ข้ามตัวที่พัง แล้วรายงานกลับ
     */
    case 'batch': {
      var results = [];
      (p.ops || []).forEach(function (op, i) {
        try {
          results.push({ i: i, ok: true, data: dispatch_(op.action, op.payload || {}, cfg) });
        } catch (err) {
          results.push({ i: i, ok: false, error: String(err && err.message ? err.message : err) });
        }
      });
      return { results: results };
    }

    // ── สรุป ────────────────────────────────────────────────
    case 'recalc':
      return recalcClass_(p.classId);

    case 'recalcAll':
      return listClasses_().map(function (c) {
        try { return { classId: c.classId, ok: true, rows: recalcClass_(c.classId).rows.length }; }
        catch (err) { return { classId: c.classId, ok: false, error: String(err) }; }
      });

    // รายงานปัญหาจากเครื่องครู — ยิงแล้วลืม ไม่คืนอะไรที่แอปต้องใช้
    // (ดู 07_ErrorLog.gs · แท็บจะถูกสร้างต่อเมื่อมีปัญหาเกิดขึ้นจริง)
    case 'logError':
      return logClientError_(p, p.__user || null);

    default:
      throw new Error('ไม่รู้จักคำสั่ง: ' + action);
  }
}

// ── ตัวช่วยของ API ──────────────────────────────────────────

function requireSheet_(classId) {
  var sh = sheetForClass_(classId);
  if (!sh) throw new Error('ไม่พบห้องเรียน: ' + classId);
  return sh;
}

function publicConfig_(cfg) {
  var out = {};
  Object.keys(cfg).forEach(function (k) { if (k !== 'apiKey') out[k] = cfg[k]; });
  return out;
}

function normalizeStudents_(list) {
  var seen = {};
  return list.map(function (s, i) {
    var sid = String(s.sid == null ? '' : s.sid).trim() || ('T' + (i + 1));
    while (seen[sid]) sid = sid + '_';           // กันเลขประจำตัวซ้ำ
    seen[sid] = true;
    return {
      no: String(s.no == null || s.no === '' ? (i + 1) : s.no).trim(),
      sid: sid,
      name: String(s.name == null ? '' : s.name).trim()
    };
  });
}

/**
 * แปลง payload เป็นรหัส/ชื่อ/คะแนนเต็มของคอลัมน์
 *   ATT  → ต้องมี date (YYYY-MM-DD) และ period
 *   WORK/QUIZ/MID/FIN → ต้องมี label และ max
 */
function columnSpec_(p) {
  var kind = String(p.kind || '').toUpperCase();
  var half = num_(p.half, 1);
  if (kind === 'MID') half = 1;
  if (kind === 'FIN') half = 2;

  if (kind === 'ATT') {
    var d = String(p.date || '').replace(/-/g, '');
    var period = num_(p.period, 1);
    if (!/^\d{8}$/.test(d)) throw new Error('รูปแบบวันที่ไม่ถูกต้อง (ต้องเป็น YYYY-MM-DD)');
    if (period < 1) throw new Error('เลขคาบต้องมากกว่า 0');
    var id = d + '-' + period;
    return { key: makeKey_('ATT', half, id), label: attLabel_(id), max: '', desc: '' };
  }

  if (['WORK', 'QUIZ', 'MID', 'FIN'].indexOf(kind) < 0) throw new Error('ประเภทคอลัมน์ไม่ถูกต้อง: ' + kind);
  var id2 = String(p.id || '').trim() || uid_(kind.charAt(0).toLowerCase());
  var label = String(p.label || '').trim();
  if (!label) throw new Error('กรุณาตั้งชื่อรายการ');
  var max = num_(p.max, 10);
  if (max <= 0) throw new Error('คะแนนเต็มต้องมากกว่า 0');
  return { key: makeKey_(kind, half, id2), label: label, max: max, desc: String(p.desc || '') };
}


/* ══════ 05_Student.gs ══════ */

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
      var w = parseWork_((V[c.key] || {})[st.sid]);
      items.push({
        label: c.label || c.id,
        desc: c.desc || '',
        kind: c.kind,
        exam: c.kind !== 'WORK',
        phase: c.half === 2 ? 2 : 1,
        bucket: id,
        max: c.max == null ? 0 : c.max,
        status: w.status,
        score: w.status === 'ok' || w.status === 'late' ? w.score : null
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
    pending: r.pending
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


/* ══════ 06_Backup.gs ══════ */

/**
 * AssignCheck V2 — สำรองไฟล์อัตโนมัติ
 *
 * ทำไมต้องมี: ข้อมูลจริงทั้งหมดอยู่ใน Google Sheet ไฟล์เดียว ไม่มีฐานข้อมูล
 * สำรอง — ถ้าไฟล์เสีย ถูกลบผิด หรือมีคนแก้พลาดจนพังทั้งไฟล์ Google เก็บ
 * Version History ให้อยู่แล้วแต่กู้ยาก (ต้องรู้ว่าจะย้อนไปช่วงไหน)
 * ไฟล์นี้จึงทำสำเนาทั้งไฟล์แยกไว้ต่างหากเป็นระยะ กู้คืนได้ง่ายแค่เปิดไฟล์สำรอง
 *
 *   BACKUP_KEEP  ก้อนล่าสุด — เกินกว่านี้ลบก้อนเก่าสุดทิ้งอัตโนมัติ
 *
 * ติดตั้งทริกเกอร์อัตโนมัติทุกครั้งที่กด "🚀 ติดตั้ง / ซ่อมแซมโครงสร้าง"
 * (ดู setupWorkbook() ใน 01_Setup.gs) — ไม่ต้องตั้งอะไรเพิ่ม
 */

var BACKUP_FOLDER_NAME = 'AssignCheck — สำรองข้อมูล';
var BACKUP_KEEP = 8;                 // ทุกสัปดาห์ ~2 เดือนย้อนหลัง
var BACKUP_TRIGGER_FN = 'scheduledBackup_';

/** สำเนาไฟล์นี้ทั้งไฟล์ไปไว้ในโฟลเดอร์สำรอง แล้วลบก้อนเก่าสุดถ้าเกิน BACKUP_KEEP */
function backupNow_() {
  var file = DriveApp.getFileById(ss_().getId());
  var parents = file.getParents();
  var parent = parents.hasNext() ? parents.next() : DriveApp.getRootFolder();
  var folder = getOrCreateBackupFolder_(parent);

  var stamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Asia/Bangkok', 'yyyy-MM-dd HH:mm');
  var copy = file.makeCopy('สำรอง ' + stamp + ' — ' + file.getName(), folder);
  pruneBackups_(folder);
  return copy;
}

/** หาโฟลเดอร์สำรองในที่เดียวกับไฟล์ต้นฉบับ สร้างใหม่ถ้ายังไม่มี */
function getOrCreateBackupFolder_(parent) {
  var it = parent.getFoldersByName(BACKUP_FOLDER_NAME);
  if (it.hasNext()) return it.next();
  return parent.createFolder(BACKUP_FOLDER_NAME);
}

/** เหลือไว้แค่ก้อนล่าสุด BACKUP_KEEP ก้อน ก้อนเก่ากว่านั้นย้ายลงถังขยะ */
function pruneBackups_(folder) {
  var files = [];
  var it = folder.getFiles();
  while (it.hasNext()) files.push(it.next());
  if (files.length <= BACKUP_KEEP) return;

  files.sort(function (a, b) { return b.getDateCreated() - a.getDateCreated(); });
  files.slice(BACKUP_KEEP).forEach(function (f) { f.setTrashed(true); });
}

/** เมนู "💾 สำรองไฟล์นี้เดี๋ยวนี้" — ทำก่อนจะแก้อะไรใหญ่ ๆ เอง */
function backupNowMenu() {
  try {
    var copy = backupNow_();
    SpreadsheetApp.getUi().alert(
      'สำรองแล้ว ✅\n\n' + copy.getName() +
      '\n\nอยู่ในโฟลเดอร์เดียวกับไฟล์นี้ ในโฟลเดอร์ "' + BACKUP_FOLDER_NAME + '"');
  } catch (err) {
    SpreadsheetApp.getUi().alert('สำรองไม่สำเร็จ: ' + String(err && err.message ? err.message : err));
  }
}

/** ติดตั้งทริกเกอร์รายสัปดาห์ — เรียกซ้ำได้ ไม่สร้างซ้ำ */
function ensureAutoBackupTrigger_() {
  var exists = ScriptApp.getProjectTriggers().some(function (t) {
    return t.getHandlerFunction() === BACKUP_TRIGGER_FN;
  });
  if (exists) return;
  ScriptApp.newTrigger(BACKUP_TRIGGER_FN)
    .timeBased()
    .onWeekDay(ScriptApp.WeekDay.SUNDAY)
    .atHour(3)
    .create();
}

/** ทริกเกอร์เรียกอันนี้ — ห้ามให้พังจนกระทบงานอื่นของสคริปต์ */
function scheduledBackup_() {
  try { backupNow_(); } catch (err) { console.error('สำรองอัตโนมัติล้มเหลว: ' + err); }
}


/* ══════ 07_ErrorLog.gs ══════ */

/**
 * AssignCheck V2 — บันทึกปัญหาที่เกิดขึ้นบนเครื่องครู
 *
 * ทำไมต้องมี
 * ──────────
 * เดิมเวลาแอปเปิดไม่ขึ้นที่เครื่องครู หน้าจอจะบอกให้ "ส่งข้อความนี้ให้คนดูแลระบบ"
 * ซึ่งดีกว่าค้างเงียบ ๆ มาก แต่ในทางปฏิบัติครูไม่ส่ง เพราะต้องพิมพ์เอง
 * คนดูแลจึงไม่มีทางรู้เลยว่ามีอะไรพัง จนกว่าจะมีคนโทรมาบ่น
 *
 * ไฟล์นี้เปิดทางให้แอปส่งรายงานขึ้นมาเก็บในชีตเองเงียบ ๆ
 * แท็บจะถูกสร้างต่อเมื่อมีปัญหาเกิดขึ้นจริงเท่านั้น — ไฟล์ที่ใช้งานปกติจะไม่มีแท็บนี้
 *
 * กติกา
 *   · เก็บแค่ ERRLOG_KEEP แถวล่าสุด แถวใหม่อยู่บนสุด
 *   · จำกัดจำนวนครั้งต่อชั่วโมง กันแอปที่พังวนลูปยิงรัวจนชีตบวม
 *   · ตัดข้อความยาว ๆ ทิ้ง ไม่ให้เซลล์เดียวกินพื้นที่ทั้งไฟล์
 */

var ERRLOG_SHEET = '🐞 บันทึกปัญหา';
var ERRLOG_KEEP = 200;             // แถวที่เก็บไว้
var ERRLOG_MAX_PER_HOUR = 60;      // ทั้งระบบรวมกัน
var ERRLOG_MAX_LEN = 1500;         // ตัวอักษรต่อช่อง

var ERRLOG_HEAD = ['เวลา', 'ผู้ใช้', 'เวอร์ชันแอป', 'หน้าที่ค้างอยู่', 'งานค้างในคิว', 'เบราว์เซอร์', 'ข้อความ'];

function errLogSheet_() {
  var ss = ss_();
  var sh = ss.getSheetByName(ERRLOG_SHEET);
  if (sh) return sh;

  sh = ss.insertSheet(ERRLOG_SHEET);
  sh.getRange(1, 1, 1, ERRLOG_HEAD.length).setValues([ERRLOG_HEAD])
    .setFontWeight('bold').setBackground('#f4f7f6');
  sh.setFrozenRows(1);
  sh.setColumnWidth(1, 145);   // เวลา
  sh.setColumnWidth(2, 190);   // ผู้ใช้
  sh.setColumnWidth(3, 90);    // เวอร์ชัน
  sh.setColumnWidth(4, 110);   // หน้า
  sh.setColumnWidth(5, 100);   // คิว
  sh.setColumnWidth(6, 260);   // เบราว์เซอร์
  sh.setColumnWidth(7, 520);   // ข้อความ
  return sh;
}

/** จำกัดจำนวนรายงานต่อชั่วโมง — แอปที่พังวนลูปยิงได้เป็นร้อยครั้งต่อนาที */
function errLogRateOk_() {
  var cache = CacheService.getScriptCache();
  var slot = 'errlog_' + Math.floor(Date.now() / 3600000);
  var n = Number(cache.get(slot) || 0) + 1;
  cache.put(slot, String(n), 3900);
  return n <= ERRLOG_MAX_PER_HOUR;
}

var errLogCut_ = function (v) {
  return String(v == null ? '' : v).slice(0, ERRLOG_MAX_LEN);
};

/**
 * รับรายงานจากหน้าเว็บ
 * คืน { ok: true } เสมอเมื่อรับได้ — ฝั่งแอปไม่ต้องสนใจผลลัพธ์
 */
function logClientError_(p, user) {
  if (!errLogRateOk_()) return { ok: false, reason: 'ถี่เกินไป' };

  var sh = errLogSheet_();
  var row = [
    Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Asia/Bangkok', 'yyyy-MM-dd HH:mm:ss'),
    errLogCut_(user && user.email ? user.email : '—'),
    errLogCut_(p.version),
    errLogCut_(p.view),
    Number(p.queued) || 0,
    errLogCut_(p.ua),
    errLogCut_(p.message)
  ];

  // แถวใหม่อยู่บนสุด จะได้เห็นของล่าสุดทันทีที่เปิดแท็บ
  sh.insertRowBefore(2);
  sh.getRange(2, 1, 1, row.length).setValues([row]);

  var extra = sh.getLastRow() - 1 - ERRLOG_KEEP;
  if (extra > 0) sh.deleteRows(2 + ERRLOG_KEEP, extra);

  return { ok: true };
}
