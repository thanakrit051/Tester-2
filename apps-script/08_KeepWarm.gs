/**
 * AssignCheck — ปลุกระบบไว้ช่วงเวลาเรียน
 *
 * ทำไมต้องมี: ถ้าไม่มีใครเรียกสคริปต์สักพัก Google จะพักเครื่องที่รันโค้ดไว้
 * คำขอแรกหลังจากนั้นต้องรอเปิดเครื่องใหม่ + เปิดไฟล์ชีตใหม่ ช้ากว่าปกติหลายวินาที
 * ครูเจอทุกเช้าตอนเปิดแอปครั้งแรก และทุกครั้งที่เว้นช่วงไปนาน ๆ ระหว่างวัน
 *
 * ทริกเกอร์นี้เรียกสคริปต์ทุก 10 นาที ให้เปิดไฟล์ชีตอ่านค่าเบา ๆ ไว้
 * นอกเวลาเรียน (เย็น กลางคืน เสาร์-อาทิตย์) ออกทันทีโดยไม่แตะชีต
 *
 * โควตา: รอบละไม่ถึง 1 วินาที × 144 รอบ/วัน ≈ 2 นาที จากโควตา 90 นาที/วัน ของบัญชีฟรี
 *
 * ติดตั้งให้เองตอนกด "🚀 ติดตั้ง / ซ่อมแซมโครงสร้าง" และครั้งแรกที่แอปเรียกเข้ามา
 * หลังอัปโค้ด (ดู ensureWarmOnce_) — ไม่ต้องตั้งอะไรเพิ่ม
 */

/* ⚠️ ห้ามลงท้ายด้วย _ — ทริกเกอร์เรียกฟังก์ชันส่วนตัวไม่ได้ (ดูหมายเหตุใน 06_Backup.gs) */
var WARM_TRIGGER_FN = 'keepWarm';
var WARM_ONCE_KEY_ = 'warm_trigger_v1';

/** จ-ศ 06:30–16:30 ตามเวลาไทย */
function inSchoolHours_(date) {
  var parts = Utilities.formatDate(date || new Date(), 'Asia/Bangkok', 'u H m').split(' ');
  var day = Number(parts[0]);                      // 1 = จันทร์ … 7 = อาทิตย์
  var min = Number(parts[1]) * 60 + Number(parts[2]);
  return day >= 1 && day <= 5 && min >= 6 * 60 + 30 && min <= 16 * 60 + 30;
}

/** ทริกเกอร์เรียกอันนี้ — ห้ามพังจนกระทบงานอื่นของสคริปต์ */
function keepWarm() {
  if (!inSchoolHours_()) return;
  try {
    getConfig_();
    listClasses_();
  } catch (err) {
    console.error('ปลุกระบบไม่สำเร็จ: ' + err);
  }
}

function warmTriggerOn_() {
  try {
    return ScriptApp.getProjectTriggers().some(function (t) {
      return t.getHandlerFunction() === WARM_TRIGGER_FN;
    });
  } catch (e) {
    return false;
  }
}

/** ติดตั้งทริกเกอร์ทุก 10 นาที — เรียกซ้ำได้ ไม่สร้างซ้ำ */
function ensureWarmTrigger_() {
  if (warmTriggerOn_()) return;
  ScriptApp.newTrigger(WARM_TRIGGER_FN).timeBased().everyMinutes(10).create();
}

/**
 * ติดตั้งให้ครั้งเดียวหลังอัปโค้ด โดยไม่ต้องรอครูกดซ่อมแซมโครงสร้าง
 *
 * ครูส่วนใหญ่วางโค้ดใหม่แล้ว Deploy เลย ไม่ได้กลับไปกดเมนูในชีต
 * ถ้ารอให้กดเอง ฟีเจอร์นี้จะไม่เคยเปิดเลยสำหรับคนส่วนใหญ่
 * ล้มก็ไม่เป็นไร (เช่นยังไม่ได้อนุญาตสิทธิ์) — จดว่าลองแล้ว ไม่ลองซ้ำทุกคำขอ
 */
function ensureWarmOnce_() {
  var props = PropertiesService.getScriptProperties();
  if (props.getProperty(WARM_ONCE_KEY_)) return;
  props.setProperty(WARM_ONCE_KEY_, new Date().toISOString());
  try { ensureWarmTrigger_(); } catch (e) { console.error('ตั้งทริกเกอร์ปลุกระบบไม่สำเร็จ: ' + e); }
}
