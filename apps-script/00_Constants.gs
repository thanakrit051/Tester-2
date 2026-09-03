/**
 * AssignCheck V2 — ค่าคงที่และตัวช่วยพื้นฐาน
 * ระบบเก็บข้อมูล: Google Sheet ไฟล์เดียว, 1 ห้อง-วิชา = 1 แท็บ
 */

// ── เวอร์ชัน ────────────────────────────────────────────────
// ⚠️ ต้องตรงกับ APP_VERSION ใน js/version.js
//    ถ้าเลขไม่ตรง หน้าเว็บจะขึ้นแถบเตือนให้ผู้ใช้อัปเดต/Deploy ใหม่
var SERVER_VERSION = '2.9.0';

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
