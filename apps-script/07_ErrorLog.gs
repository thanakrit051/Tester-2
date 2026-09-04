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
