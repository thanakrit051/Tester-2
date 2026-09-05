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
    'https://ชื่อคุณ.github.io/ชื่อ-repo/</code><br>' +
    '<span style="font-size:12.5px">ต้องเป็นโฟลเดอร์ที่มี <b>styles.css</b> กับ <b>app.bundle.js</b> อยู่จริง<br>' +
    'ถ้า push ทั้งโปรเจกต์ขึ้น GitHub ให้ลงท้ายด้วย <b>/docs/</b></span><br><br>' +
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

  var action = String(req.action || '');
  var pl = req.payload || {};
  if (user) pl.__user = user;

  /* คำสั่งที่อ่านอย่างเดียว ไม่ต้องเข้าคิวรอ lock
   *
   * ของเดิมทุกคำขอไปคว้า lock ตัวเดียวกันหมด เวลาครูกรอกคะแนนแล้วกดเปิดห้องอื่น
   * ต่อทันที คำสั่ง "อ่าน" จะต้องยืนรอคำสั่ง "เขียน" ที่แอปส่งเบื้องหลังให้เสร็จก่อน
   * = รอ 2 เด้ง 4-6 วินาที ทั้งที่การอ่านไม่ได้แก้อะไรในชีตเลย
   *
   * แลกกับการที่ค่าที่อ่านได้อาจเก่ากว่าคำสั่งเขียนที่ยังส่งไม่ถึงเสี้ยววินาที
   * ฝั่งเว็บกันไว้แล้วด้วยการทับค่าที่ยังค้างคิวลงไป (withPending ใน js/state.js)
   */
  if (readOnlyReq_(action, pl)) return run_(action, pl, cfg, user);

  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(25000);
  } catch (err) {
    return json_({ ok: false, error: 'ระบบกำลังบันทึกข้อมูลอื่นอยู่ กรุณาลองใหม่' });
  }

  try {
    return run_(action, pl, cfg, user);
  } finally {
    lock.releaseLock();
  }
}

/** คำสั่งที่ไม่แตะข้อมูลในชีตเลย */
var READ_ONLY_ACTIONS_ = { ping: true, bootstrap: true, getClass: true };

/** batch นับเป็น "อ่านอย่างเดียว" ต่อเมื่อทุกคำสั่งข้างในอ่านอย่างเดียวทั้งหมด
 *  (ตอนเปิดแอปยิง batch ของ bootstrap + getClass ซึ่งเข้าเงื่อนไขนี้พอดี) */
function readOnlyReq_(action, p) {
  if (READ_ONLY_ACTIONS_[action]) return true;
  if (action !== 'batch') return false;
  var ops = (p && p.ops) || [];
  if (!ops.length) return false;
  for (var i = 0; i < ops.length; i++) {
    if (!READ_ONLY_ACTIONS_[String((ops[i] && ops[i].action) || '')]) return false;
  }
  return true;
}

function run_(action, pl, cfg, user) {
  try {
    return json_({ ok: true, data: dispatch_(action, pl, cfg), user: user, version: SERVER_VERSION });
  } catch (err) {
    console.error(err);
    return json_({ ok: false, error: String(err && err.message ? err.message : err) });
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
      delete SHEET_FOR_CLASS_MEMO_[p.classId];   // อยู่ใน batch เดียวกันแล้วเรียกซ้ำ จะได้ไม่ได้แท็บที่ลบไปแล้ว
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
