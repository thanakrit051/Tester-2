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
/* ⚠️ ห้ามลงท้ายชื่อนี้ด้วย _ เด็ดขาด
 * Apps Script ถือว่าฟังก์ชันที่ลงท้ายด้วย _ เป็นฟังก์ชันส่วนตัว ทริกเกอร์เรียกไม่ได้
 * และไม่โผล่ในรายการให้เลือกตอนตั้งทริกเกอร์เองด้วย
 * ของเดิมเป็น 'scheduledBackup_' จึงตั้งทริกเกอร์ไม่สำเร็จมาตลอดโดยไม่มีอะไรบอก */
var BACKUP_TRIGGER_FN = 'scheduledBackup';
var BACKUP_TRIGGER_FN_OLD = 'scheduledBackup_';   // ชื่อเดิมที่ใช้ไม่ได้ — ไว้ตามเก็บกวาด

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

/** ตอนนี้มีทริกเกอร์สำรองอัตโนมัติอยู่จริงไหม — ใช้รายงานผลตามความจริง */
function autoBackupOn_() {
  try {
    return ScriptApp.getProjectTriggers().some(function (t) {
      return t.getHandlerFunction() === BACKUP_TRIGGER_FN;
    });
  } catch (e) {
    return false;
  }
}

/** ติดตั้งทริกเกอร์รายสัปดาห์ — เรียกซ้ำได้ ไม่สร้างซ้ำ */
function ensureAutoBackupTrigger_() {
  var triggers = ScriptApp.getProjectTriggers();

  // เก็บกวาดทริกเกอร์ที่ชี้ไปชื่อเดิมซึ่งเรียกไม่ได้ ถ้าเผลอสร้างค้างไว้
  triggers.forEach(function (t) {
    if (t.getHandlerFunction() === BACKUP_TRIGGER_FN_OLD) ScriptApp.deleteTrigger(t);
  });

  var exists = triggers.some(function (t) {
    return t.getHandlerFunction() === BACKUP_TRIGGER_FN;
  });
  if (exists) return;
  ScriptApp.newTrigger(BACKUP_TRIGGER_FN)
    .timeBased()
    .onWeekDay(ScriptApp.WeekDay.SUNDAY)
    .atHour(3)
    .create();
}

/**
 * ทริกเกอร์เรียกอันนี้ — ห้ามให้พังจนกระทบงานอื่นของสคริปต์
 * ชื่อต้องไม่ลงท้ายด้วย _ ไม่งั้นทริกเกอร์เรียกไม่ได้ (ดูหมายเหตุที่ BACKUP_TRIGGER_FN)
 */
function scheduledBackup() {
  try { backupNow_(); } catch (err) { console.error('สำรองอัตโนมัติล้มเหลว: ' + err); }
}
