/**
 * AssignCheck V2 — ขึ้นภาคเรียนใหม่
 *
 * ทำไมต้องมี: ห้อง 1 ห้อง = 1 แท็บ เก็บทั้งรายชื่อ เช็คชื่อ และคะแนนรวมกัน
 * ขึ้นเทอมใหม่ครูต้องไล่ลบห้องทีละห้อง (ข้อมูลหายถาวร) แล้วสร้างใหม่ วางรายชื่อใหม่
 * ทั้งที่เทอม 2 ส่วนใหญ่สอนเด็กกลุ่มเดิม และปีการศึกษา/ภาคเรียนในหน้าตั้งค่าเป็นแค่ป้าย
 *
 * คำสั่งเดียวทำให้ครบ เรียงตามนี้เสมอ
 *   1. สำรองทั้งไฟล์ไว้ในโฟลเดอร์ "AssignCheck — ภาคเรียนที่ผ่านมา" (ไม่ลบทิ้งอัตโนมัติ
 *      ต่างจากสำรองรายสัปดาห์ที่เก็บแค่ BACKUP_KEEP ก้อน) — สำรองไม่ผ่าน = ไม่แตะอะไรเลย
 *   2. เขียนค่าตั้งค่าของภาคเรียนใหม่ (ปี · ภาคเรียน · ล้างวันสอบกลางภาค ฯลฯ)
 *   3. จัดห้องตามที่ครูเลือกทีละห้อง
 *        reset = เก็บรายชื่อไว้ ล้างเช็คชื่อ/งาน/คะแนนทั้งหมด (รหัสห้องเดิม ตารางสอนยังชี้ถูก)
 *        drop  = ลบแท็บทิ้ง
 *        ห้องที่ไม่ได้ส่งมา = ไม่แตะ
 */

var TERM_FOLDER_NAME = 'AssignCheck — ภาคเรียนที่ผ่านมา';

/** ค่าตั้งค่าที่หน้าเว็บส่งมาได้ในคำสั่งนี้ — กันไม่ให้ใช้ช่องนี้แก้ค่าอื่นแบบไม่ตั้งใจ */
var NEW_TERM_KEYS_ = ['year', 'term', 'mid_date', 'student_summary', 'timetable'];

/**
 * @param p { year, term, reset: [classId], drop: [classId], config: { mid_date, ... } }
 * @return { archive: { name, url }, reset: n, dropped: n }
 *
 * ลำดับตั้งใจให้ "ทำซ้ำได้" ถ้าพังกลางทาง (หมดเวลา · Drive ขัดข้อง) แล้วครูกดใหม่
 *   · ปี/ภาคเรียนเขียนเป็นอย่างสุดท้าย — รอบที่กดซ้ำจึงยังตั้งชื่อไฟล์สำรองด้วยภาคเรียนเดิมถูก
 *   · ห้องที่ล้างไปแล้วล้างซ้ำได้ (ว่างอยู่แล้ว) · ห้องที่ลบไปแล้วข้ามไป ไม่ฟ้องว่าหาไม่เจอ
 */
function newTerm_(p) {
  var year = String(p.year == null ? '' : p.year).trim();
  var term = String(p.term == null ? '' : p.term).trim();
  if (!year || !term) throw new Error('กรอกปีการศึกษาและภาคเรียนใหม่ให้ครบ');

  var reset = uniqIds_(p.reset);
  var drop = uniqIds_(p.drop);
  if (reset.some(function (id) { return drop.indexOf(id) >= 0; })) {
    throw new Error('ห้องเดียวกันถูกเลือกทั้ง "ล้างคะแนน" และ "ลบ"');
  }

  // หาแท็บให้ครบก่อนลงมือ — ห้องที่จะล้างหาไม่เจอสักห้อง = ไม่ทำอะไรเลย (ไม่ใช่ทำไปครึ่ง ๆ กลาง ๆ)
  var resetSheets = reset.map(requireSheet_);
  var dropSheets = drop.map(sheetForClass_);          // null = ลบไปแล้ว (รอบก่อนพังกลางทาง)

  var old = getConfig_();
  var archive = archiveTerm_(old.term, old.year);

  resetSheets.forEach(function (sh) { resetClassSheet_(sh, year, term); });
  drop.forEach(function (id, i) {
    if (dropSheets[i]) ss_().deleteSheet(dropSheets[i]);
    delete SHEET_FOR_CLASS_MEMO_[id];
    removeClassRow_(id);
  });

  var entries = p.config || {};
  NEW_TERM_KEYS_.forEach(function (k) {
    if (k === 'year') return setConfigValue_(k, year);
    if (k === 'term') return setConfigValue_(k, term);
    if (entries[k] !== undefined) setConfigValue_(k, entries[k]);
  });

  return {
    archive: { name: archive.getName(), url: archive.getUrl() },
    reset: reset.length,
    dropped: drop.length
  };
}

/** รหัสห้องไม่ซ้ำ ไม่ว่าง — ล้างห้องเดียวกัน 2 รอบในคำสั่งเดียว รอบที่ 2 จะไปจับแท็บที่ลบไปแล้ว */
function uniqIds_(list) {
  var seen = {};
  return (list || []).map(String).filter(function (id) {
    if (!id || seen[id]) return false;
    seen[id] = true;
    return true;
  });
}

/** สำเนาทั้งไฟล์ของภาคเรียนที่กำลังจะปิด — ไว้เปิดดู/พิมพ์ย้อนหลัง */
function archiveTerm_(term, year) {
  var file = DriveApp.getFileById(ss_().getId());
  var parents = file.getParents();
  var parent = parents.hasNext() ? parents.next() : DriveApp.getRootFolder();
  var it = parent.getFoldersByName(TERM_FOLDER_NAME);
  var folder = it.hasNext() ? it.next() : parent.createFolder(TERM_FOLDER_NAME);

  var label = (term || year) ? 'ภาคเรียนที่ ' + (term || '-') + '/' + (year || '-') : 'ภาคเรียนก่อน';
  var stamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Asia/Bangkok', 'yyyy-MM-dd');
  return file.makeCopy(label + ' (ปิด ' + stamp + ') — ' + file.getName(), folder);
}

/**
 * ล้างทุกอย่างในแท็บ เหลือรายชื่อนักเรียน — รหัสห้อง ชื่อแท็บ และตำแหน่งแท็บคงเดิม
 *
 * สร้างแท็บใหม่แทนการลบคอลัมน์ทีละคอลัมน์ เพราะได้รูปแบบสะอาดเหมือนห้องที่สร้างใหม่
 * (ไม่มีกฎตรวจข้อมูล/โน้ต/การผสานเซลล์ของคอลัมน์เก่าค้าง) และเร็วกว่ามากเมื่อมีหลายสิบคาบ
 * สร้างตัวใหม่ให้เสร็จก่อนค่อยลบตัวเก่า — พังกลางทาง แท็บเดิมยังอยู่ครบ
 */
function resetClassSheet_(sh, year, term) {
  var ss = ss_();
  var d = readClassBySheet_(sh);
  var meta = d.meta;
  meta.teacher = meta.teacher || getConfig_().teacher || '';
  meta.year = year;
  meta.term = term;
  meta.status = 'ใช้งาน';

  var name = sh.getName();
  var fresh = ss.insertSheet(safeSheetName_(name + ' ใหม่'), sh.getIndex() - 1);
  initClassLayout_(fresh, meta);
  if (d.students.length) setStudents_(fresh, d.students);

  ss.deleteSheet(sh);
  fresh.setName(name);
  meta.sheetName = name;
  SHEET_FOR_CLASS_MEMO_[meta.classId] = fresh;
  upsertClassRow_(meta, d.students.length);
}
