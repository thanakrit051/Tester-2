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
    ['🔗 URL เว็บแอป (Apps Script)', url]
  ];

  sh.getRange(1, 1, rows.length, 2).setValues(rows.map(function (r) {
    return [r[0] || '', r[1] || ''];
  }));

  sh.getRange(1, 1).setFontSize(16).setFontWeight('bold').setFontColor('#1b5e20');

  // เน้นแถวหัวข้อ (แถวที่มีข้อความคอลัมน์เดียว) และแถวรหัสลับ — คำนวณจากข้อมูลจริง
  for (var i = 1; i < rows.length; i++) {
    var isHeading = rows[i][0] && !rows[i][1] && /^[🧭📁🚀🔑🔗⚠️]/.test(rows[i][0]);
    if (isHeading) sh.getRange(i + 1, 1, 1, 2).setFontWeight('bold').setBackground('#e8f5e9');
    if (rows[i][1] === apiKey) sh.getRange(i + 1, 2).setFontFamily('Courier New').setBackground('#fff3e0');
  }
  sh.setColumnWidth(1, 200);
  sh.setColumnWidth(2, 700);
  sh.getRange(1, 1, rows.length, 2).setVerticalAlignment('middle').setWrap(true);
  sh.setHiddenGridlines(true);
  return sh;
}
