/* AssignCheck — หน้าดูผลของนักเรียน
 *
 * เล็ก จบในไฟล์เดียว ไม่มีโมดูล เพราะหน้านี้ทำอย่างเดียวคือ "ดู"
 * คุยกับเซิร์ฟเวอร์ด้วยคำสั่งเดียว: studentGet
 */
(function () {
  'use strict';

  // ── ตัวช่วยสร้าง DOM ──────────────────────────────────────
  function h(tag, props) {
    var el = document.createElement(tag);
    if (props) {
      for (var k in props) {
        var v = props[k];
        if (v === null || v === undefined || v === false) continue;
        if (k === 'class') el.className = v;
        else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
        else if (k === 'html') el.innerHTML = v;
        else if (k.slice(0, 2) === 'on' && typeof v === 'function') el.addEventListener(k.slice(2), v);
        else if (k === 'value' || k === 'disabled') el[k] = v;
        else el.setAttribute(k, v === true ? '' : v);
      }
    }
    for (var i = 2; i < arguments.length; i++) add(el, arguments[i]);
    return el;
  }
  function add(el, c) {
    if (c === null || c === undefined || c === false || c === true) return;
    if (Array.isArray(c)) { c.forEach(function (x) { add(el, x); }); return; }
    el.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  function svg(d, cls) {
    var box = document.createElement('span');
    box.innerHTML = '<svg class="' + (cls || 'ico') + '" viewBox="0 0 24 24" fill="none" ' +
      'stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" ' +
      'aria-hidden="true">' + d + '</svg>';
    return box.firstElementChild;
  }
  var ICON = {
    book: '<path d="M3 4h6a3 3 0 0 1 3 3v13a2.5 2.5 0 0 0-2.5-2.5H3z"/><path d="M21 4h-6a3 3 0 0 0-3 3v13a2.5 2.5 0 0 1 2.5-2.5H21z"/>',
    chev: '<path d="m6 9 6 6 6-6"/>',
    right: '<path d="m9 6 6 6-6 6"/>',
    share: '<path d="M12 15V3"/><path d="m7 8 5-5 5 5"/><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/>',
    save: '<path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/>',
    refresh: '<path d="M20 11a8 8 0 1 0-2.34 5.66"/><path d="M20 4v7h-7"/>',
    wifiOff: '<path d="M2 8.8a15 15 0 0 1 4.2-2.6"/><path d="M10.7 5.1A15 15 0 0 1 22 8.8"/><path d="M5 12.6a10 10 0 0 1 5.2-2.5"/><path d="M16.9 11.2A10 10 0 0 1 19 12.6"/><path d="M8.5 16.4a5 5 0 0 1 7 0"/><path d="M12 20h.01"/><path d="m3 3 18 18"/>',
    left: '<path d="m15 6-6 6 6 6"/>',
    out: '<path d="M10 4.5H6A1.5 1.5 0 0 0 4.5 6v12A1.5 1.5 0 0 0 6 19.5h4"/><path d="M20 12H9.5"/><path d="m16 8 4 4-4 4"/>',
    alert: '<circle cx="12" cy="12" r="9"/><path d="M12 7.5v5"/><path d="M12 16.5h.01"/>',
    doc: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M9 13h6"/><path d="M9 17h4"/>',
    pen: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
    cal: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4"/><path d="M8 3v4"/><path d="M3 10h18"/><path d="m9 15 2 2 4-4"/>',
    lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    warn: '<path d="M12 9v4.5"/><path d="M12 17h.01"/><path d="M10.3 3.9 2.5 17.4A2 2 0 0 0 4.2 20.5h15.6a2 2 0 0 0 1.7-3.1L13.7 3.9a2 2 0 0 0-3.4 0z"/>'
  };
  var nf = function (n) { return String(Math.round(Number(n) * 100) / 100); };

  // ── เรียกเซิร์ฟเวอร์ ──────────────────────────────────────
  //
  // หน้านี้อยู่บน GitHub Pages (docs/) คุยผ่าน fetch ไปที่ URL ใน config.js
  //
  // ที่ต้องส่งเป็น text/plain เพราะถ้าใช้ application/json เบราว์เซอร์จะยิง
  // preflight (OPTIONS) ก่อน ซึ่ง Apps Script ตอบไม่ได้ แล้วจะติด CORS
  function parseRes(raw, resolve, reject) {
    var res;
    // อ่านไม่ออก = มักเป็นหน้า error ของ Google ตอนระบบสะดุด — ให้ลองใหม่ได้แบบเน็ตหลุด
    try { res = JSON.parse(raw); } catch (e) { reject(netErr('ระบบตอบกลับผิดปกติ — ลองใหม่อีกครั้ง')); return; }
    if (res && res.ok) resolve(res.data);
    else reject(new Error((res && res.error) || 'เกิดข้อผิดพลาด'));
  }

  function ask(sid) {
    var body = JSON.stringify({ action: 'studentGet', payload: { sid: sid } });

    return new Promise(function (resolve, reject) {
      var url = String(window.AC_API || '').trim();
      if (!url) {
        reject(new Error('ยังไม่ได้ตั้งค่าที่อยู่ของระบบ — ครูต้องใส่ลิงก์ Apps Script ในไฟล์ config.js'));
        return;
      }
      fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: body,
        redirect: 'follow'
      })
        .then(function (r) { return r.text(); })
        .then(function (raw) { parseRes(raw, resolve, reject); })
        .catch(function () { reject(netErr('ตรวจอินเทอร์เน็ตแล้วลองใหม่อีกครั้ง')); });
    });
  }

  /** ปัญหาการเชื่อมต่อ (ลองใหม่ได้) ต่างจากคำตอบของระบบ เช่น ไม่พบเลขประจำตัว (ต้องแก้เลข) */
  function netErr(msg) {
    var e = new Error(msg);
    e.net = true;
    return e;
  }

  // ── หน้ากรอกเลขประจำตัว ───────────────────────────────────
  var root = document.getElementById('app');

  /* เลขที่ "จำไว้" — เปิดหน้าครั้งหน้าเข้าดูผลเลย ไม่ต้องกรอกใหม่
   * จำเฉพาะตอนนักเรียนติ๊กเอง (ปิดไว้ก่อน) และกด "ออก" แล้วลืมทันที
   * เพราะหน้านี้ใช้เลขประจำตัวอย่างเดียว — บนเครื่องห้องคอมหรือมือถือเพื่อน
   * ถ้าจำเลขค้างไว้ คนถัดไปกดปุ่มเดียวก็เห็นคะแนนของคนก่อน
   * ac.stu.last คือคีย์รุ่นก่อนที่จำทุกเครื่องโดยไม่ถาม — ลบทิ้ง ไม่ย้ายมาเป็นเลขที่จำไว้ */
  var KEEP = 'ac.stu.keep';
  var saved = {
    get: function () { try { return localStorage.getItem(KEEP) || ''; } catch (e) { return ''; } },
    set: function (sid) { try { localStorage.setItem(KEEP, sid); } catch (e) { /* โหมดส่วนตัว */ } },
    del: function () { try { localStorage.removeItem(KEEP); } catch (e) { /* โหมดส่วนตัว */ } }
  };
  try { localStorage.removeItem('ac.stu.last'); } catch (e) { /* โหมดส่วนตัว */ }

  function gate(errMsg, sidValue) {
    var input = h('input', {
      type: 'text', inputmode: 'numeric', autocomplete: 'off',
      placeholder: '00000', maxlength: '20', 'aria-label': 'เลขประจำตัวนักเรียน',
      value: sidValue || ''
    });
    var keep = h('input', { type: 'checkbox' });
    var btn = h('button', { class: 'btn btn-block', type: 'submit' }, 'ดูผลของฉัน');

    var form = h('form', {
      onsubmit: function (e) {
        e.preventDefault();
        var sid = input.value.trim();
        if (!sid) { input.focus(); return; }
        enter(sid, keep.checked);
      }
    }, input,
      h('label', { class: 'gate-keep' }, keep,
        h('span', null, 'จำเลขไว้ในเครื่องนี้', h('small', null, 'ติ๊กเฉพาะเครื่องของตัวเอง'))),
      btn);

    root.replaceChildren(h('div', { class: 'gate page-enter' },
      h('div', { class: 'gate-mark' }, svg(ICON.book)),
      h('div', null,
        h('h1', null, 'ผลการเรียนของฉัน'),
        h('p', null, 'กรอกเลขประจำตัวนักเรียนเพื่อดูงาน คะแนน และการมาเรียน')),
      errMsg ? h('div', { class: 'err', role: 'alert' }, errMsg) : null,
      form,
      h('div', { class: 'foot' }, 'เห็นเฉพาะข้อมูลของตัวเอง · ดูอย่างเดียว แก้ไขไม่ได้')
    ));
    setTimeout(function () { input.focus(); input.select(); }, 80);
  }

  /** ไปดึงผลของเลขนี้ — โครงหน้าระหว่างรอ · เน็ตหลุดขึ้นหน้าลองใหม่ · ระบบตอบว่าไม่พบ กลับไปแก้เลข */
  function enter(sid, keep) {
    loading();
    ask(sid).then(function (data) {
      if (keep) saved.set(sid);
      VIEW.sid = sid;
      VIEW.cur = 0; VIEW.mode = 'subject';
      show(data);
    }).catch(function (err) {
      if (err.net) offline(err.message, sid, keep);
      else gate(err.message, sid);
    });
  }

  /** เชื่อมต่อไม่ได้ — ลองใหม่ด้วยเลขเดิมได้ทันที ไม่ต้องกรอกใหม่ */
  function offline(msg, sid, keep) {
    root.replaceChildren(h('div', { class: 'gate page-enter' },
      h('div', { class: 'gate-mark off' }, svg(ICON.wifiOff)),
      h('div', null,
        h('h1', null, 'เชื่อมต่อไม่ได้'),
        h('p', null, msg)),
      h('div', { class: 'gate-acts' },
        h('button', { class: 'btn btn-block', onclick: function () { enter(sid, keep); } },
          svg(ICON.refresh), 'ลองใหม่'),
        h('button', { class: 'btn btn-ghost btn-block', onclick: function () { saved.del(); gate(); } },
          'ใช้เลขประจำตัวอื่น'))));
  }

  /** ออก = ลืมเลขที่จำไว้ด้วย คนถัดไปที่ใช้เครื่องนี้ต้องกรอกเลขของตัวเอง */
  function signOut() {
    saved.del();
    VIEW.data = null; VIEW.sid = '';
    gate();
  }

  /** โหลดข้อมูลใหม่โดยอยู่หน้าเดิม (วิชาเดิม แท็บเดิม) */
  function refresh(btn) {
    if (!VIEW.sid || btn.disabled) return;
    btn.disabled = true;
    btn.classList.add('spinning');
    ask(VIEW.sid).then(function (data) {
      show(data);
      toast('อัปเดตข้อมูลแล้ว');
    }).catch(function (err) {
      btn.disabled = false;
      btn.classList.remove('spinning');
      toast(err.net ? 'อัปเดตไม่ได้ — ' + err.message : err.message, true);
    });
  }

  function toast(msg, bad) {
    var box = document.querySelector('.stu-toasts') || document.body.appendChild(h('div', { class: 'stu-toasts', role: 'status' }));
    var t = h('div', { class: 'toast' + (bad ? ' err' : '') }, msg);
    box.replaceChildren(t);
    setTimeout(function () { if (t.parentNode) t.remove(); }, 2600);
  }

  /** ปุ่มบนแถบเข้ม: (แชร์) + โหลดใหม่ — onShare มีเฉพาะหน้ารายวิชา
   *  "ออก" ย้ายไปท้ายหน้า (stuOut) — เดิมอยู่ติดปุ่มแชร์ นิ้วพลาดนิดเดียวก็ถูกเด้งไปกรอกเลขใหม่ */
  function heroActs(onShare) {
    var re = h('button', { class: 'hero-icon', type: 'button', 'aria-label': 'โหลดข้อมูลใหม่', title: 'โหลดข้อมูลใหม่' },
      svg(ICON.refresh));
    re.addEventListener('click', function () { refresh(re); });
    return h('div', { class: 'hero-acts' },
      onShare && h('button', {
        class: 'hero-icon', type: 'button', 'aria-label': 'แชร์ผลวิชานี้เป็นรูป', title: 'แชร์เป็นรูป',
        onclick: onShare
      }, svg(ICON.share)),
      re);
  }

  /** ท้ายหน้า: ดูของเลขไหนอยู่ + ปุ่มออก (ลืมเลขในเครื่องนี้ด้วย — เครื่องที่ใช้ร่วมกันต้องกดก่อนส่งต่อ) */
  function stuOut() {
    return h('div', { class: 'stu-out' },
      h('span', null, 'กำลังดูของเลขประจำตัว ', h('b', { class: 'tnum' }, VIEW.sid || '—')),
      h('button', { class: 'btn btn-ghost', type: 'button', onclick: signOut }, svg(ICON.out), 'ออก'));
  }

  /** ระหว่างรอเซิร์ฟเวอร์: โครงหน้าแทนหน้ากรอกเลขที่ค้างนิ่ง — รู้ว่ากดแล้วและกำลังมา */
  function loading() {
    root.replaceChildren(
      h('header', { class: 'stu-hero skel-hero' }, h('i'), h('i'), h('i')),
      h('div', { class: 'stu-wrap' }, h('div', { class: 'skel' }, h('i'), h('i'), h('i'))));
  }

  /** ข้อสอบกับงานส่งใช้คำต่างกัน — ให้ตรงกับที่ครูเห็นในระบบ */
  var LABEL = {
    work: { ok: 'ส่งแล้ว', late: 'ส่งช้า', miss: 'ไม่ส่ง', none: 'ยังไม่ตรวจ' },
    exam: { ok: 'สอบแล้ว', late: 'ส่งช้า', miss: 'ยังไม่ได้สอบ', none: 'ยังไม่กรอก' }
  };


  // ── หน้าแสดงผล ───────────────────────────────────────────
  //
  // วิชาละหนึ่งหน้า: แถบเข้มบอกว่ากำลังดูวิชาไหน ได้คะแนนสะสมเท่าไหร่
  // แล้วไล่ลงตามลำดับเวลาของภาคเรียน — ก่อนกลางภาค → สอบกลางภาค → หลังกลางภาค → สอบปลายภาค
  //
  // mode: 'subject' = ดูทีละวิชา · 'summary' = สรุปคะแนนรวม+เกรดทุกวิชาในหน้าเดียว
  // open: การ์ดครึ่งภาคที่กางอยู่ (จำไว้ตอนสลับวิชา)
  // sid: เลขที่กำลังดูอยู่ (ใช้ตอนกดโหลดใหม่)
  var VIEW = { data: null, sid: '', cur: 0, mode: 'subject', open: { 1: true, 2: true } };

  /* ครูเปิด/ปิดหน้าสรุปผลได้แยกจากการดูคะแนน (student_summary ในแท็บ ⚙️ ตั้งค่า)
   * ปิดอยู่ ชีตไม่ส่งคะแนนรวม/เกรดมาเลย — ตรงนี้แค่ไม่โชว์ปุ่มให้กดเข้าหน้าว่าง
   * summary ไม่มีมาเลย = โค้ดในชีตรุ่นก่อนมีสวิตช์นี้ ให้ทำงานแบบเดิม */
  var summaryOn = function () { return !VIEW.data || VIEW.data.summary !== false; };

  /* คะแนนสอบกลางภาค/ปลายภาคที่ครูยังปิดไว้ (student_mid / student_fin)
   * ชีตตัดคะแนนออกมาแล้ว ช่องนั้นมาพร้อม hidden: true — ตรงนี้แค่วาดเป็นช่องล็อก
   * hidden ไม่มีมาเลย = ชีตรุ่นก่อนมีสวิตช์นี้ = เห็นทุกส่วน */
  var EXAM = { mid: 'สอบกลางภาค', fin: 'สอบปลายภาค' };
  var isExam = function (id) { return id === 'mid' || id === 'fin'; };
  var lockedOf = function (c) {
    return c.buckets.filter(function (b) { return b.hidden; }).map(function (b) { return b.id; });
  };

  function show(d) {
    VIEW.data = d;
    if (VIEW.cur >= d.classes.length) VIEW.cur = 0;
    if (!summaryOn()) VIEW.mode = 'subject';
    draw();
  }

  /** ปุ่มสลับ รายวิชา / สรุปผล — อยู่ตำแหน่งเดียวกันทั้ง 2 หน้า กดสลับไปมาได้ทันที */
  function modeSwitch() {
    if (!summaryOn()) return null;
    return h('div', { class: 'seg stu-seg', role: 'tablist' },
      [['subject', 'รายวิชา'], ['summary', 'สรุปผลภาคเรียน']].map(function (m) {
        return h('button', {
          role: 'tab', id: 'tab-' + m[0], 'aria-controls': 'stu-panel',
          'aria-selected': VIEW.mode === m[0] ? 'true' : 'false',
          'data-on': VIEW.mode === m[0] ? '1' : '0',
          onclick: function () { VIEW.mode = m[0]; draw(); }
        }, m[1]);
      }));
  }

  /** เนื้อหาใต้แท็บ รายวิชา / สรุปผล — ผูกกับแท็บให้โปรแกรมอ่านหน้าจอรู้ว่าแท็บไหนเปิดอยู่ */
  function panelProps() {
    var tabbed = summaryOn();
    return { class: 'stu-wrap page-enter', id: 'stu-panel',
      role: tabbed ? 'tabpanel' : null, 'aria-labelledby': tabbed ? 'tab-' + VIEW.mode : null };
  }

  function draw() {
    var d = VIEW.data;
    if (!d.classes.length) {
      root.replaceChildren(h('div', { class: 'stu-wrap' },
        h('div', { class: 'card empty' }, 'ยังไม่มีรายวิชาที่บันทึกไว้'),
        h('button', { class: 'btn btn-ghost btn-block', onclick: signOut }, 'ออก')));
      return;
    }
    if (VIEW.mode === 'summary' && summaryOn()) { drawSummary(d); return; }
    var c = d.classes[VIEW.cur];

    root.replaceChildren(
      hero(d, c),
      h('div', panelProps(),
        modeSwitch(),
        todoCard(c),
        phaseCard(c, 1),
        examCard(c, 'mid'),
        phaseCard(c, 2),
        examCard(c, 'fin'),

        h('div', { class: 'tip' },
          'แตะงานแต่ละชิ้นเพื่อดูคำสั่งจากครู · ข้อมูลอัปเดตตามที่ครูบันทึก' +
          ' · ถ้าคะแนนไม่ตรง แจ้งครูประจำวิชา'),
        stuOut()
      ));
    window.scrollTo({ top: 0 });
    centerPill();
  }

  /** แถบปุ่มวิชาถูกสร้างใหม่ทุกครั้งที่สลับวิชา (กลับไปชิดซ้าย) — เลื่อนให้ปุ่มที่เลือกอยู่กลางแถบ
   *  คำนวณ scrollLeft เอง ไม่ใช้ scrollIntoView เพราะมันเลื่อนทั้งหน้าในแนวตั้งด้วย */
  function centerPill() {
    var nav = root.querySelector('.hero-subj');
    var pill = nav && nav.querySelector('[aria-current="true"]');
    if (!pill) return;
    var n = nav.getBoundingClientRect(), p = pill.getBoundingClientRect();
    nav.scrollLeft += (p.left - n.left) - (n.width - p.width) / 2;
  }

  // ── ส่วนประกอบคะแนน (ใช้ทั้งหน้ารายวิชาและหน้าสรุปผล) ─────────
  //
  // คะแนน 100 ของแต่ละวิชาแบ่งเป็น 2 ครึ่ง ครึ่งละ 4 ส่วน (ตรงกับช่องใน SGS)
  // เด็กถามบ่อยสุดว่า "ครึ่งแรกได้เท่าไหร่ ขาดตรงไหน" — หน้านี้จึงจัดตามครึ่งภาคก่อน
  // สอบกลางภาค/ปลายภาคแยกออกมาเป็นการ์ดของตัวเอง เพราะครูประกาศคนละจังหวะกับคะแนนเก็บ

  var PHASE_NAME = { 1: 'ก่อนกลางภาค', 2: 'หลังกลางภาค' };

  /** ตัวเลข "ได้/เต็ม" — ช่องที่ยังไม่มีคะแนนโชว์ขีด ไม่ใช่ 0 (0 = ตรวจแล้วได้ 0) */
  function fraction(has, got, max, cls) {
    return h('span', { class: 'frac tnum' + (has ? '' : ' none') + (cls ? ' ' + cls : '') },
      h('b', null, has ? nf(got) : '—'), h('small', null, '/' + nf(max)));
  }

  /** แถบความคืบหน้าของส่วนย่อย — ยังไม่มีคะแนนก็โชว์รางเปล่า ให้รู้ว่ามีส่วนนี้รออยู่ */
  function bar(cls, has, got, max) {
    var w = has && max > 0 ? Math.max(0, Math.min(100, got / max * 100)) : 0;
    return h('div', { class: cls }, h('i', { style: { width: w + '%' } }));
  }

  /**
   * การ์ดครึ่งภาค — หัวการ์ดกดหุบ/กางได้ บอกคะแนนเก็บของครึ่งนี้ แล้วไล่ทีละส่วน
   *
   * นับเฉพาะคะแนนเก็บ (งาน · สอบเก็บ · เข้าเรียน) ไม่รวมสอบกลาง/ปลายภาค
   * เพราะสอบมีการ์ดของตัวเองอยู่ถัดไป — ถ้ารวมไว้ด้วย เด็กบวกทุกการ์ดแล้วได้เกินคะแนนสะสม
   * (นับสอบซ้ำ 2 รอบ) · ตอนนี้ ครึ่งแรก + สอบกลาง + ครึ่งหลัง + สอบปลาย = คะแนนสะสมพอดี
   */
  function phaseCard(c, phase) {
    var buckets = c.buckets.filter(function (b) { return b.phase === phase && !isExam(b.id); });
    var p = { got: 0, max: 0, any: false }, checked = 0;
    buckets.forEach(function (b) {
      p.max += Number(b.max) || 0;
      if (b.has) { p.got += Number(b.score) || 0; checked += Number(b.max) || 0; p.any = true; }
    });
    p.got = Math.round(p.got * 100) / 100;
    var open = VIEW.open[phase] !== false;

    // หุบ/กางด้วยการสลับคลาสตรง ๆ ไม่วาดหน้าใหม่ — จอจะได้ไม่เด้งกลับขึ้นบนสุด
    var head = h('button', {
      class: 'phase-h', type: 'button', 'aria-expanded': open ? 'true' : 'false',
      onclick: function () {
        var now = !sec.classList.toggle('shut');
        VIEW.open[phase] = now;
        head.setAttribute('aria-expanded', now ? 'true' : 'false');
      }
    },
      h('div', { style: { flex: '1', minWidth: '0' } },
        h('div', { class: 'phase-name' }, PHASE_NAME[phase]),
        h('div', { class: 'phase-sub' },
          p.any ? 'ตรวจแล้ว ' + nf(checked) + ' จาก ' + nf(p.max) + ' คะแนน' : 'ยังไม่มีคะแนนในครึ่งนี้')),
      fraction(p.any, p.got, p.max, 'lg'),
      svg(ICON.chev, 'ico phase-chev'));

    var sec = h('section', { class: 'card phase' + (open ? '' : ' shut') },
      head,
      h('div', { class: 'bks' }, buckets.map(function (b) { return bucketBlock(c, b); })));
    return sec;
  }

  /** ส่วนย่อย 1 ส่วน (เช่น ส่งงาน ครึ่งแรก) + รายการชิ้นงานที่อยู่ในส่วนนี้ */
  function bucketBlock(c, b) {
    var items = c.items.filter(function (it) { return it.bucket === b.id; });
    var isAtt = b.id === 'att1' || b.id === 'att2';
    // ไม่มีรายการแต่มีคะแนน = ครูกรอกคะแนนรวมของส่วนนี้ตรง ๆ ไม่ได้แยกเป็นชิ้น
    var sub = isAtt ? 'คิดจากการมาเรียน'
      : items.length ? items.length + ' รายการ'
      : b.has ? 'ครูให้คะแนนรวมของส่วนนี้'
      : 'ครูยังไม่ได้เพิ่มรายการ';

    // หัวข้อต้องเด่นกว่ารายการย่อย: ไอคอนประจำส่วน + ตัวใหญ่ · รายการเยื้องเข้าไปใต้ชื่อหัวข้อ
    var ico = isAtt ? ICON.cal : /^quiz/.test(b.id) ? ICON.pen : ICON.doc;
    return h('div', { class: 'bk' + (b.has ? '' : ' nodata') },
      h('div', { class: 'bk-h' },
        h('span', { class: 'bk-ico' }, svg(ico)),
        h('div', { style: { flex: '1', minWidth: '0' } },
          h('div', { class: 'bk-name' }, b.label),
          h('div', { class: 'bk-sub' }, sub)),
        fraction(b.has, b.score, b.max)),
      bar('bk-bar', b.has, b.score, Number(b.max) || 0),
      items.length > 0 && h('div', { class: 'rows' }, items.map(function (it) {
        return it.exam ? examRow(it) : workRow(it, c);
      })));
  }

  /**
   * การ์ดสอบกลางภาค/ปลายภาค — 3 แบบ
   *   ล็อก     ครูยังปิดคะแนนส่วนนี้ (กรอบเส้นประ + กุญแจ)
   *   รอ       เปิดให้ดูแล้วแต่ยังไม่มีคะแนน
   *   ประกาศ   การ์ดสีเข้ม ตัวเลขใหญ่
   */
  function examCard(c, id) {
    var b = c.buckets.filter(function (x) { return x.id === id; })[0];
    if (!b || !(Number(b.max) > 0)) return null;   // ครูตั้งน้ำหนักส่วนนี้เป็น 0
    var items = c.items.filter(function (it) { return it.bucket === id; });

    if (b.hidden) {
      return h('section', { class: 'exam lock' },
        h('div', { class: 'exam-h' }, svg(ICON.lock), h('b', null, EXAM[id]), fraction(false, 0, b.max)),
        h('p', null, 'ครูยังไม่เปิดให้ดูคะแนนส่วนนี้'),
        h('small', null, 'ยังไม่นับรวมในคะแนนสะสมด้านบน · จะขึ้นเองเมื่อครูประกาศ'));
    }
    if (!b.has) {
      return h('section', { class: 'exam wait' },
        h('div', { class: 'exam-h' }, h('b', null, EXAM[id]), fraction(false, 0, b.max)),
        h('p', null, !items.length ? 'ครูยังไม่ได้เพิ่มรายการ'
          : items[0].status === 'miss' ? LABEL.exam.miss : 'ยังไม่มีคะแนน · รอครูประกาศ'));
    }

    var pct = Math.round(b.score / b.max * 100);
    var one = items.length === 1 ? items[0] : null;
    return h('section', { class: 'exam' },
      h('div', { class: 'exam-h' }, h('b', null, EXAM[id]), h('span', { class: 'exam-tag' }, 'ประกาศแล้ว')),
      h('div', { class: 'exam-score' },
        h('div', { class: 'exam-big tnum' }, h('b', null, nf(b.score)), h('span', null, '/ ' + nf(b.max))),
        h('span', { class: 'tnum' }, 'คิดเป็น ' + pct + '%')),
      bar('exam-bar', true, b.score, Number(b.max)),
      one ? ((one.retake || one.passed != null) && h('div', null, retakeTag(one), passTag(one)))
        : items.length > 1 && h('div', { class: 'rows' }, items.map(examRow)));
  }

  /**
   * กล่อง "ต้องจัดการ" บนสุดของวิชา — รวมทุกเรื่องที่นักเรียนต้องลงมือเอง
   * (งานไม่ส่ง · ไม่ผ่านเกณฑ์ · เวลาเรียนต่ำกว่าเกณฑ์) ไม่ต้องไล่หาในรายการยาว
   * เรื่องที่รอครู (ยังไม่ตรวจ) ไม่อยู่ในนี้ — นักเรียนทำอะไรไม่ได้ · ไม่มีอะไรค้าง = ไม่โชว์กล่อง
   */
  /** ชิ้นงาน/สอบเก็บที่นักเรียนต้องลงมือ (ไม่ส่ง · ไม่ผ่านเกณฑ์) — หน้าสรุปใช้นับ "งานค้าง" ด้วย */
  function todoItems(c) {
    return c.items.filter(function (it) {
      if (it.hidden || isExam(it.bucket)) return false;
      return (!it.exam && it.status === 'miss') || it.passed === false;
    });
  }

  function todoCard(c) {
    var rows = [];
    var a = c.att || {};
    if (a.risk) {
      rows.push(h('div', { class: 'todo-item static' },
        svg(ICON.cal),
        h('div', { class: 'todo-main' },
          h('b', null, 'เวลาเรียน ' + a.pct + '% · เกณฑ์ ' + a.minPct + '%'),
          h('span', null, 'ถ้าถึงปลายภาคยังไม่ถึงเกณฑ์อาจติด มส — รีบคุยกับครูผู้สอน'))));
    }
    todoItems(c).forEach(function (it) {
      var miss = !it.exam && it.status === 'miss';
      var why = miss ? 'ยังไม่ส่ง · ตอนนี้นับ 0 จาก ' + nf(it.max)
        : 'ได้ ' + nf(it.score) + ' · ต้องได้ ' + nf(it.pass) + ' ถึงผ่านเกณฑ์';
      var body = [svg(it.exam ? ICON.pen : ICON.doc),
        h('div', { class: 'todo-main' }, h('b', null, it.label), h('span', null, why))];
      rows.push(it.exam
        ? h('div', { class: 'todo-item static' }, body)
        : h('button', { class: 'todo-item', type: 'button', onclick: function () { detail(it, c); } },
            body, svg(ICON.right, 'ico todo-go')));
    });
    if (!rows.length) return null;
    return h('section', { class: 'todo' },
      h('div', { class: 'todo-h' }, svg(ICON.alert),
        h('b', null, 'ต้องจัดการ'), h('span', { class: 'todo-n tnum' }, rows.length + ' เรื่อง')),
      rows);
  }

  // ── หน้าสรุปผลภาคเรียน ──────────────────────────────────
  //
  // นักเรียนอยากรู้ 2 อย่าง: "ได้รวมเท่าไหร่จาก 100" กับ "ได้เกรดอะไร"
  //
  // ระหว่างภาคเรียน คะแนนรวมยังไม่ถึง 100 เกรดที่คิดจากคะแนนตอนนั้นจึงต่ำกว่าจริงเสมอ
  // ครูเลือกให้โชว์เกรด ณ ตอนนั้นไปเลย แต่ต้องบอกให้ชัดว่ายังเปลี่ยนได้ และยังรอเก็บอีกเท่าไหร่
  // ยกเว้นวิชาที่ครูยังปิดคะแนนสอบอยู่ — ชีตไม่ส่งเกรดมา (กันเดาคะแนนสอบ) ขึ้นว่า "รอ"

  /** คะแนนรวม — โค้ดในชีตรุ่นก่อน 2.15.0 ไม่ส่ง total มา ก็รวมช่องที่เห็นเอง (ต่างกันแค่การปัดเศษ) */
  function totalOf(c) {
    if (typeof c.total === 'number') return c.total;
    var t = 0;
    c.buckets.forEach(function (b) { if (b.has) t += Number(b.score) || 0; });
    return Math.round(t * 100) / 100;
  }

  /** คะแนนเต็มที่นักเรียนเห็นได้ — 100 ลบส่วนที่ครูยังปิดไว้ */
  function fullOf(c) {
    var t = 0;
    c.buckets.forEach(function (b) { if (!b.hidden) t += Number(b.max) || 0; });
    return Math.round(t * 100) / 100;
  }

  /** สีของเกรด: ดี · น่าห่วง · ตก/มส */
  function letterTone(g) {
    if (g === 'มส' || g === '0') return 'bad';
    var n = Number(g);
    if (isNaN(n)) return 'dim';
    return n <= 1.5 ? 'warn' : 'ok';
  }

  function drawSummary(d) {
    var list = d.classes;
    var done = list.filter(function (c) { return c.termDone; }).length;
    var risk = list.filter(function (c) {
      var g = gradeOf(c).letter;
      return g === 'มส' || g === '0' || (c.att && c.att.risk);
    }).length;
    var owe = list.reduce(function (n, c) { return n + todoItems(c).length; }, 0);
    var many = list.length > 1;

    // ตัวเลข 3 ช่องบนแถบเข้ม = เรื่องที่นักเรียนอยากรู้ ไม่ใช่สถานะฝั่งครู (เดิมเป็น "สอบกลางภาค เปิดให้ดู")
    root.replaceChildren(
      h('header', { class: 'stu-hero' },
        h('div', { class: 'hero-row' },
          h('div', { style: { flex: '1', minWidth: '0' } },
            h('div', { class: 'hero-kick' }, 'สรุปผลการเรียน · ' + list.length + ' วิชา'),
            h('div', { class: 'hero-name', role: 'heading', 'aria-level': '1' }, d.name || '—')),
          heroActs()),
        h('div', { class: 'hero-mini' },
          mini('งานค้าง', owe ? owe + ' ชิ้น' : 'ไม่มี', owe ? 'bad' : ''),
          mini('ต้องระวัง', risk ? risk + ' วิชา' : 'ไม่มี', risk ? 'bad' : ''),
          mini('จบภาคแล้ว', done + '/' + list.length))),

      h('div', panelProps(),
        modeSwitch(),
        many && overviewCard(list),
        many && h('div', { class: 'sec-h' }, 'รายละเอียดแต่ละวิชา'),
        list.map(function (c, i) { return summaryCard(c, i, many); }),
        h('div', { class: 'tip' },
          'คะแนนรวมเต็ม 100 ต่อวิชา · เกรดคิดตามเกณฑ์ที่ครูตั้งไว้' +
          (done < list.length ? ' · วิชาที่ยังไม่จบภาคเรียน เกรดยังเปลี่ยนได้' : '')),
        stuOut()
      ));
    window.scrollTo({ top: 0 });
  }

  /**
   * เกรดที่จะโชว์ + สีของมัน
   *   ครูยังปิดคะแนนสอบ → "รอ" · ยังไม่มีคะแนน หรือชีตรุ่นเก่าไม่ส่งเกรดมา → ขีด
   *   ยังไม่จบภาค → เกรดประมาณ (est) คิดจากคะแนนที่ตรวจแล้ว — เกรดจริงคิดจากเต็ม 100
   *   ซึ่งกลางภาคยังไงก็ต่ำ (ปลายภาค 30 คะแนนยังว่าง) คนที่ทำได้ 88% เลยเห็นเกรด 2
   *   ชีตก่อน 2.21.0 ไม่ส่ง projLetter มา → ขีดไว้ก่อน ดีกว่าโชว์เกรดที่ทำให้ตกใจเปล่า ๆ
   */
  function gradeOf(c) {
    var hasLetter = c.letter !== undefined && c.letter !== null && c.letter !== '';
    var noData = !(c.outOf > 0);
    var locked = lockedOf(c).length > 0;
    if (locked && !noData) return { letter: 'รอ', tone: 'wait', has: false, noData: false, locked: true };
    if (!noData && hasLetter && !c.termDone && String(c.letter) !== 'มส') {
      var p = c.projLetter, hasP = p !== undefined && p !== null && p !== '';
      // ยังเป็นค่าประมาณ — 0 ใช้สีเตือน ไม่ใช่สีตก
      var tone = !hasP ? 'dim' : String(p) === '0' ? 'warn' : letterTone(String(p));
      return { letter: hasP ? String(p) : '—', tone: tone, has: hasP, noData: false, locked: false, est: true };
    }
    var letter = noData || !hasLetter ? '—' : String(c.letter);
    return { letter: letter, tone: noData || !hasLetter ? 'dim' : letterTone(letter), has: hasLetter, noData: noData, locked: false };
  }

  /**
   * ตารางภาพรวม — ทุกวิชาในจอเดียว แบบใบรายงานผล
   * เด็กส่วนใหญ่อยากรู้แค่ "วิชาไหนได้เท่าไหร่" ก่อน — แตะแถวแล้วเข้าหน้ารายวิชานั้นเลย
   * (เดิมเลื่อนลงไปการ์ดด้านล่าง ซึ่งโชว์เลขชุดเดิมซ้ำ)
   */
  function overviewCard(list) {
    return h('div', { class: 'card ov' },
      h('div', { class: 'ov-row ov-head' },
        h('span', { class: 'ov-subj' }, 'รายวิชา'),
        h('span', { class: 'ov-total' }, 'คะแนน'),
        h('span', { class: 'ov-grade' }, 'เกรด'),
        h('span')),
      list.map(function (c, i) {
        var g = gradeOf(c);
        return h('button', {
          class: 'ov-row', type: 'button',
          onclick: function () { VIEW.cur = i; VIEW.mode = 'subject'; draw(); }
        },
          h('span', { class: 'ov-subj' },
            h('b', null, c.subject || '—'),
            h('small', null, g.noData ? 'ยังไม่มีคะแนน'
              : g.locked ? 'รอครูประกาศคะแนนสอบ'
              : c.termDone ? 'จบภาคเรียนแล้ว' : g.has ? 'เกรดประมาณ' : 'ยังไม่จบภาค')),
          h('span', { class: 'ov-total tnum' }, g.noData ? '—' : nf(totalOf(c)),
            !g.noData && h('small', null, '/' + nf(fullOf(c)))),
          h('span', { class: 'ov-grade' }, h('i', { class: 'gpill ' + g.tone }, (g.est && g.has ? '≈' : '') + g.letter)),
          svg(ICON.right, 'ico ov-go'));
      }));
  }

  /** กล่อง 1 ช่วงของภาคเรียนในการ์ดสรุป — ก่อนกลาง · กลางภาค · หลังกลาง · ปลายภาค */
  var STEPS = [
    ['ก่อนกลาง', ['work1', 'quiz1', 'att1']],
    ['กลางภาค', ['mid']],
    ['หลังกลาง', ['work2', 'quiz2', 'att2']],
    ['ปลายภาค', ['fin']]
  ];

  /** รวมคะแนนของช่วงหนึ่ง — ใช้ทั้งการ์ดสรุปและรูปสตอรี่ */
  function stepData(c, ids) {
    var s = { got: 0, max: 0, any: false, hidden: true, exam: ids.length === 1 && isExam(ids[0]) };
    c.buckets.forEach(function (b) {
      if (ids.indexOf(b.id) < 0) return;
      s.max += Number(b.max) || 0;
      if (!b.hidden) s.hidden = false;
      if (b.has) { s.got += Number(b.score) || 0; s.any = true; }
    });
    s.got = Math.round(s.got * 100) / 100;
    return s;
  }

  function stepBox(c, label, ids) {
    var s = stepData(c, ids);
    return h('div', { class: 'step' + (s.hidden ? ' lock' : s.exam && s.any ? ' ex' : '') },
      h('span', null, label),
      fraction(s.any, s.got, s.max));
  }

  /**
   * การ์ดสรุป 1 วิชา
   * compact: มีตารางภาพรวมอยู่ด้านบนแล้ว (หลายวิชา) — ไม่ต้องโชว์คะแนนรวม/เกรดตัวใหญ่ซ้ำ
   * เหลือที่ตารางไม่มี: คะแนนแยก 4 ช่วง + ข้อความว่าเลขนี้นิ่งแล้วหรือยังเปลี่ยนได้
   */
  function summaryCard(c, i, compact) {
    var total = totalOf(c);
    var g = gradeOf(c);
    var noData = g.noData;
    var locked = lockedOf(c);
    var left = Math.max(0, 100 - Math.min(100, Number(c.outOf) || 0));

    // ป้ายสถานะข้างคะแนนรวม — บอกก่อนเลยว่าเลขนี้ "นิ่งแล้ว" หรือ "ยังขยับได้"
    // วิชาที่ล็อกคะแนนสอบอยู่ ช่องเกรด "รอ" บอกไว้แล้ว ไม่ต้องมีป้ายซ้ำ
    var status = noData || g.locked ? null
      : g.letter === 'มส' ? h('span', { class: 'st-pill bad' }, 'ติด มส')
      : c.termDone && !(c.pending > 0) ? h('span', { class: 'st-pill ok' }, 'จบภาคเรียนแล้ว')
      : c.termDone ? h('span', { class: 'st-pill warn' }, 'รอครูตรวจ')
      : h('span', { class: 'st-pill' }, 'ยังไม่จบภาค');

    var note = null;
    if (noData) note = h('div', { class: 'sum-note' }, 'ครูยังไม่ได้กรอกคะแนนในวิชานี้');
    else if (g.locked) {
      note = h('div', { class: 'sum-note lock' }, svg(ICON.lock),
        h('span', null, 'ครูยังไม่เปิดคะแนน' + locked.map(function (id) { return EXAM[id]; }).join('และ') +
          ' เกรดจะขึ้นเมื่อครูประกาศ — คะแนนที่เห็นตอนนี้ยังไม่รวมส่วนนั้น'));
    } else if (g.letter === 'มส') {
      note = h('div', { class: 'sum-note bad' },
        'เวลาเรียน ' + c.att.pct + '% ต่ำกว่าเกณฑ์ ' + c.att.minPct + '% — รีบคุยกับครูผู้สอน');
    } else if (!c.termDone) {
      note = h('div', { class: 'sum-note' }, g.has
        ? 'ได้ ' + nf(c.earned) + ' จาก ' + nf(c.outOf) + ' คะแนนที่ตรวจแล้ว (' + Math.round(c.earned / c.outOf * 100) + '%)'
          + ' — ถ้ารักษาระดับนี้ได้ จบภาคจะได้ราวเกรด ' + g.letter + ' · ยังมีคะแนนรอเก็บอีก ' + nf(left) + ' คะแนน'
        : 'ยังมีคะแนนรอเก็บอีก ' + nf(left) + ' คะแนน — เกรดจะขึ้นเมื่อจบภาคเรียน');
    } else if (c.pending > 0) {
      note = h('div', { class: 'sum-note warn' },
        'ครูยังตรวจไม่ครบ ' + c.pending + ' รายการ — คะแนนและเกรดอาจเปลี่ยนได้');
    }

    return h('section', { class: 'card sum-card' + (compact ? ' compact' : ''), id: 'sum-' + i },
      h('div', { class: 'sum-top' },
        h('div', { style: { flex: '1', minWidth: '0' } },
          h('div', { class: 'sum-subj' }, c.subject || '—'),
          h('div', { class: 'sum-code' },
            [c.subjectCode, [c.grade, c.room].filter(Boolean).join('/')].filter(Boolean).join(' · ') || ' ')),
        compact ? status : h('div', { class: 'sum-grade ' + g.tone },
          h('span', null, g.est ? 'เกรดประมาณ' : 'เกรด'),
          h('b', null, g.locked ? '—' : g.letter))),

      !compact && h('div', { class: 'sum-total' },
        h('b', { class: 'tnum' }, noData ? '—' : nf(total)),
        h('span', null, '/' + nf(fullOf(c)) + ' คะแนน'),
        status),

      !noData && h('div', { class: 'steps' },
        stepBox(c, 'ก่อนกลาง', ['work1', 'quiz1', 'att1']),
        stepBox(c, 'กลางภาค', ['mid']),
        stepBox(c, 'หลังกลาง', ['work2', 'quiz2', 'att2']),
        stepBox(c, 'ปลายภาค', ['fin'])),

      note,
      !noData && !g.has && !g.locked && !g.est && h('div', { class: 'sum-note' },
        'ระบบของครูยังไม่ได้อัปเดต จึงยังแสดงเกรดไม่ได้ (คะแนนรวมถูกต้อง)'),

      h('button', {
        class: 'sum-more', type: 'button',
        onclick: function () { VIEW.cur = i; VIEW.mode = 'subject'; draw(); }
      }, 'ดูงานและคะแนนสอบรายชิ้น', svg(ICON.right))
    );
  }

  /** แถบเข้มบนสุด — ชื่อ เลือกวิชา คะแนนสะสม และเวลาเรียน */
  function hero(d, c) {
    var many = d.classes.length > 1;
    var kick = [[c.grade, c.room].filter(Boolean).join('/'), c.no ? 'เลขที่ ' + c.no : '',
      many ? '' : c.subject].filter(Boolean).join(' · ');

    return h('header', { class: 'stu-hero' },
      h('div', { class: 'hero-row' },
        h('div', { style: { flex: '1', minWidth: '0' } },
          h('div', { class: 'hero-kick' }, kick || ' '),
          h('div', { class: 'hero-name', role: 'heading', 'aria-level': '1' }, d.name || '—')),
        heroActs(function () { shareSheet(d, c); })),

      many && h('nav', { class: 'hero-subj', 'aria-label': 'เลือกรายวิชา' },
        d.classes.map(function (x, i) {
          return h('button', {
            class: 'subj-pill', type: 'button', 'aria-current': i === VIEW.cur ? 'true' : null,
            onclick: function () { VIEW.cur = i; draw(); }
          }, x.subject || '—');
        })),

      // ตัวหารเป็นคะแนนเต็มทั้งวิชา (100 ลบส่วนที่ครูยังปิด) — เลขเดียวกับหน้าสรุปผล
      // ส่วนที่ตรวจแล้วบอกด้วยแถบ 2 ชั้น: สีมะนาว = ได้ · สีจาง = ตรวจแล้ว · ราง = ยังไม่ถึง
      h('div', { class: 'hero-score' },
        h('div', { style: { flex: '1', minWidth: '0' } },
          h('div', { class: 'hero-lbl' }, 'คะแนนสะสม'),
          h('div', { class: 'hero-big tnum' },
            h('b', null, c.outOf > 0 ? nf(c.earned) : '—'),
            h('span', null, '/ ' + nf(fullOf(c))))),
        h('div', { class: 'hero-att' + (c.att && c.att.risk ? ' risk' : '') },
          // ต่ำกว่าเกณฑ์ต้องบอกด้วยคำ ไม่ใช่แค่ขอบสีแดง (คนตาบอดสีแยกไม่ออก)
          h('span', null, c.att && c.att.risk ? 'เวลาเรียนต่ำ' : 'เวลาเรียน'),
          h('b', { class: 'tnum' }, c.att && c.att.checked > 0 ? c.att.pct + '%' : '—'))),
      heroBar(c));
  }

  function heroBar(c) {
    var full = fullOf(c) || 100;
    var pct = function (n) { return Math.max(0, Math.min(100, (Number(n) || 0) / full * 100)) + '%'; };
    var done = c.outOf > 0 && c.outOf >= full;
    var locked = lockedOf(c).map(function (id) { return EXAM[id]; });
    if (done && locked.length) done = false;
    return h('div', { class: 'hero-prog' },
      h('div', { class: 'hero-track' },
        h('i', { class: 'chk', style: { width: pct(c.outOf) } }),
        h('i', { class: 'got', style: { width: pct(c.outOf > 0 ? c.earned : 0) } })),
      h('div', { class: 'hero-lbl tnum' }, !(c.outOf > 0) ? 'ครูยังไม่ได้กรอกคะแนนในวิชานี้'
        : done ? 'ตรวจครบทุกส่วนแล้ว'
        : c.outOf >= full ? 'ตรวจครบส่วนที่เปิดให้ดูแล้ว · ' + locked.join('และ') + 'รอครูประกาศ'
        : 'ตรวจแล้ว ' + nf(c.outOf) + ' จาก ' + nf(full) + ' คะแนน · รอเก็บอีก ' + nf(full - c.outOf)));
  }

  // ── แชร์ผลวิชาเป็นรูปสตอรี่ (1080×1920) ─────────────────────
  //
  // วาดเองบน canvas ไม่พึ่งไลบรารี (หน้านี้จบในไฟล์เดียว)
  // หน้าตาแบบการ์ดสรุปผลที่คนแชร์ลงสตอรี่: วลีสั้น ๆ + ตัวเลขใหญ่ + ตราเกรด + ไทม์ไลน์ภาคเรียน + ไฮไลต์
  // ใส่เฉพาะสิ่งที่นักเรียนอยากอวด ไม่ใส่เลขประจำตัว/เลขที่ · ชื่อเลือกเอาออกได้
  // เกรดขึ้นเฉพาะตอนชีตส่ง letter มา (ครูเปิดหน้าสรุปผล) และไม่ได้ปิดคะแนนสอบ — กติกาเดียวกับหน้าสรุป
  // ขอบบน/ล่างราว 250px ไอจีเอาชื่อบัญชีกับช่องตอบกลับมาทับ — เนื้อหาจริงอยู่ระหว่าง y 250–1670

  var STORY_FONT = 'Anuphan, "IBM Plex Sans Thai", system-ui, sans-serif';

  /** ธีมของรูป — สีตายตัว (รูปต้องหน้าตาเดียวกันไม่ว่าเครื่องจะตั้งโหมดมืดหรือไม่) */
  var STORY_THEMES = {
    forest: {
      name: 'เขียวมะนาว', bg: ['#0e3a30', '#06201b'], glow: ['rgba(20,149,132,.45)', 'rgba(199,240,74,.12)'],
      card: 'rgba(255,255,255,.07)', track: 'rgba(255,255,255,.13)', ink: '#ffffff', ink2: '#a9c6bd',
      accent: '#c7f04a', onAccent: '#0b2b24', bad: '#ff9db5'
    },
    paper: {
      name: 'กระดาษ', bg: ['#f6f1e7', '#ece4d4'], glow: ['rgba(13,125,110,.12)', 'rgba(245,158,66,.12)'],
      card: '#ffffff', track: '#e3dccd', ink: '#10261f', ink2: '#6b746f',
      accent: '#0d7d6e', onAccent: '#ffffff', bad: '#be123c'
    },
    sunset: {
      name: 'พระอาทิตย์ตก', bg: ['#40207a', '#e0526a'], glow: ['rgba(255,190,90,.55)', 'rgba(90,60,200,.35)'],
      card: 'rgba(255,255,255,.14)', track: 'rgba(255,255,255,.24)', ink: '#ffffff', ink2: 'rgba(255,255,255,.8)',
      accent: '#fff1a8', onAccent: '#40207a', bad: '#ffd1dc'
    }
  };
  var STORY_KEY = 'ac.stu.story';

  /** ไอคอนเส้นสำหรับวาดบน canvas (ตาราง 24×24 เหมือนไอคอนบนหน้าจอ · คั่นแต่ละเส้นด้วย |) */
  var STORY_ICON = {
    doc: 'M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z|M14 3v5h5|M9 13h6|M9 17h4',
    star: 'M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z',
    cal: 'M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z|M16 3v4|M8 3v4|M3 10h18|M9 15l2 2 4-4',
    pen: 'M12 20h9|M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z'
  };

  /** รอฟอนต์ก่อนวาด ไม่งั้นรูปแรกออกมาเป็นฟอนต์ระบบ — โหลดไม่ขึ้นก็วาดต่อด้วยฟอนต์ระบบ */
  function storyFonts() {
    if (!document.fonts || !document.fonts.load) return Promise.resolve();
    return Promise.all(['500 40px ', '600 40px ', '700 40px '].map(function (w) {
      return document.fonts.load(w + STORY_FONT, 'ผลการเรียน 0123');
    })).catch(function () { /* ใช้ฟอนต์ระบบ */ });
  }

  /** ตัดข้อความยาวเป็นหลายบรรทัด — ภาษาไทยไม่มีเว้นวรรค ตัดตามคำด้วย Intl.Segmenter (ไม่มีก็ตัดตามช่องว่าง) */
  function storyWrap(x, text, weight, sizes, maxW, maxRows) {
    var parts = window.Intl && Intl.Segmenter
      ? Array.from(new Intl.Segmenter('th', { granularity: 'word' }).segment(text), function (s) { return s.segment; })
      : text.split(/(\s+)/);
    var rows, size;
    for (var i = 0; i < sizes.length; i++) {
      size = sizes[i];
      x.font = weight + ' ' + size + 'px ' + STORY_FONT;
      rows = [''];
      parts.forEach(function (p) {
        var cur = rows[rows.length - 1];
        if (cur && x.measureText(cur + p).width > maxW) rows.push(p.trim());
        else rows[rows.length - 1] = cur + p;
      });
      if (rows.length <= maxRows) return { size: size, rows: rows };
    }
    rows = rows.slice(0, maxRows);
    rows[maxRows - 1] = rows[maxRows - 1].replace(/.$/, '') + '…';
    return { size: size, rows: rows };
  }

  function storyBox(x, X, Y, W, H, r) {
    r = Math.min(r, W / 2, H / 2);
    x.beginPath();
    x.moveTo(X + r, Y);
    x.arcTo(X + W, Y, X + W, Y + H, r);
    x.arcTo(X + W, Y + H, X, Y + H, r);
    x.arcTo(X, Y + H, X, Y, r);
    x.arcTo(X, Y, X + W, Y, r);
    x.closePath();
  }

  function storyIcon(x, name, X, Y, size, color) {
    x.save();
    x.translate(X, Y); x.scale(size / 24, size / 24);
    x.lineWidth = 2; x.lineCap = 'round'; x.lineJoin = 'round'; x.strokeStyle = color;
    STORY_ICON[name].split('|').forEach(function (p) { x.stroke(new Path2D(p)); });
    x.restore();
  }

  /** วลีหัวรูป — คิดจากสัดส่วนคะแนนที่ได้ ในส่วนที่ครูตรวจแล้ว (ไม่ใช่จาก 100 ซึ่งกลางภาคยังไงก็ต่ำ) */
  function storyCheer(c) {
    if (!(c.outOf > 0)) return 'รอครูกรอกคะแนน';
    var r = c.earned / c.outOf;
    return r >= 0.8 ? 'ทำได้ยอดเยี่ยม' : r >= 0.7 ? 'ทำได้ดีมาก' : r >= 0.6 ? 'กำลังไปได้สวย'
      : r >= 0.5 ? 'อีกนิดเดียว สู้ต่อ' : 'ยังเก็บคะแนนได้อีกเยอะ';
  }

  /**
   * ไฮไลต์ 3 แถว — เลือกเรื่องที่มีข้อมูล
   *   ส่งงาน (ส่งแล้ว/ที่ครูตรวจแล้ว) · สอบใหญ่ที่ได้ % ดีที่สุด (ไม่มีก็สอบเก็บเฉลี่ย) · การมาเรียน
   * เวลาเรียนต่ำกว่าเกณฑ์ไม่ใส่ — รูปนี้มีไว้อวด เรื่องที่ต้องแก้อยู่ในกล่อง "ต้องจัดการ" แล้ว
   */
  function storyHighlights(c) {
    var out = [];
    var works = c.items.filter(function (it) { return !it.exam && !it.hidden && it.status !== 'none'; });
    if (works.length) {
      var sent = works.filter(function (it) { return it.status === 'ok' || it.status === 'late'; }).length;
      out.push({ ico: 'doc', l: 'ส่งงาน', v: sent + '/' + works.length,
        note: sent === works.length ? 'ครบทุกชิ้น' : 'จากงานที่ครูตรวจแล้ว', good: sent === works.length });
    }
    var best = null;
    ['mid', 'fin'].forEach(function (id) {
      var s = stepData(c, [id]);
      if (s.hidden || !s.any || !(s.max > 0)) return;
      var pct = s.got / s.max;
      if (!best || pct > best.pct) best = { pct: pct, l: EXAM[id], v: nf(s.got) + '/' + nf(s.max) };
    });
    if (best) {
      out.push({ ico: 'star', l: best.l, v: best.v, note: 'ได้ ' + Math.round(best.pct * 100) + '%', good: best.pct >= 0.8 });
    } else {
      var q = c.items.filter(function (it) {
        return it.exam && !it.hidden && !isExam(it.bucket) && it.score !== null && it.score !== undefined && it.max > 0;
      });
      if (q.length) {
        var avg = q.reduce(function (n, it) { return n + it.score / it.max; }, 0) / q.length;
        out.push({ ico: 'pen', l: 'สอบเก็บ', v: Math.round(avg * 100) + '%', note: 'เฉลี่ย ' + q.length + ' ครั้ง', good: avg >= 0.8 });
      }
    }
    var a = c.att || {};
    if (a.checked > 0 && !a.risk) {
      out.push({ ico: 'cal', l: 'มาเรียน', v: a.pct + '%', note: 'ผ่านเกณฑ์แล้ว', good: a.pct >= 90 });
    }
    return out.slice(0, 3);
  }

  /** วาดรูปของวิชา c — คืน canvas */
  function drawStory(d, c, opt) {
    var T = STORY_THEMES[opt.theme] || STORY_THEMES.forest;
    var W = 1080, H = 1920, pad = 84, inner = W - pad * 2;
    var cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    var x = cv.getContext('2d');
    var F = function (w, px) { return w + ' ' + px + 'px ' + STORY_FONT; };
    var text = function (s, X, Y, font, color, align) {
      x.font = font; x.fillStyle = color; x.textAlign = align || 'left'; x.fillText(s, X, Y);
      return x.measureText(s).width;
    };

    // พื้นไล่สีเฉียง + แสง 2 จุด
    var bg = x.createLinearGradient(0, 0, W * 0.4, H);
    bg.addColorStop(0, T.bg[0]); bg.addColorStop(1, T.bg[1]);
    x.fillStyle = bg; x.fillRect(0, 0, W, H);
    [[W - 60, 380, 760, T.glow[0]], [40, 1640, 720, T.glow[1]]].forEach(function (g) {
      var gr = x.createRadialGradient(g[0], g[1], 0, g[0], g[1], g[2]);
      gr.addColorStop(0, g[3]); gr.addColorStop(1, 'rgba(0,0,0,0)');
      x.fillStyle = gr; x.fillRect(0, 0, W, H);
    });
    x.textBaseline = 'alphabetic';

    // ── แถวบน: ป้าย + วันที่
    x.font = F(700, 28);
    var tag = 'ผลการเรียน', tagW = x.measureText(tag).width + 76;
    storyBox(x, pad, 236, tagW, 60, 30); x.fillStyle = T.card; x.fill();
    x.beginPath(); x.arc(pad + 32, 266, 9, 0, Math.PI * 2); x.fillStyle = T.accent; x.fill();
    text(tag, pad + 54, 276, F(700, 28), T.ink);
    var date = new Date().toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
    text(date, W - pad, 276, F(500, 28), T.ink2, 'right');

    // ── ชื่อวิชา
    var sub = storyWrap(x, c.subject || '—', 700, [92, 80, 68], inner, 2);
    var y = 360 + sub.size * 0.9;
    sub.rows.forEach(function (row, i) { text(row, pad, y + i * sub.size * 1.18, F(700, sub.size), T.ink); });
    y += (sub.rows.length - 1) * sub.size * 1.18;
    var meta = [c.subjectCode, [c.grade, c.room].filter(Boolean).join('/')].filter(Boolean).join(' · ');
    if (meta) text(meta, pad, y + 62, F(500, 36), T.ink2);

    // ── วลี + คะแนนตัวใหญ่ (ตำแหน่งตายตัว ชื่อวิชา 1 หรือ 2 บรรทัดก็ไม่ดันลงมา)
    var full = fullOf(c) || 100, has = c.outOf > 0;
    text(storyCheer(c), pad, 730, F(700, 46), T.accent);
    text('คะแนนสะสม', pad, 790, F(500, 32), T.ink2);
    var big = has ? nf(c.earned) : '—', size = 250;
    x.font = F(700, size);
    while (size > 160 && x.measureText(big).width > 520) { size -= 10; x.font = F(700, size); }
    var bw = text(big, pad - 6, 790 + size * 0.86, F(700, size), T.ink);
    text('/' + nf(full), pad + bw + 8, 790 + size * 0.86, F(600, 64), T.ink2);

    // ตราเกรด — วงกลมเอียงแบบสติกเกอร์ · ไม่มีเกรดให้โชว์ = บอกว่าตรวจไปแล้วกี่ %
    // ยังไม่จบภาค ไม่ใส่เกรดประมาณลงรูป — รูปถูกส่งต่อไปถึงคนที่ไม่รู้ว่าเป็นค่าประมาณ
    // โชว์ "ทำได้ xx%" ของส่วนที่ตรวจแล้วแทน (ตัวเดียวกับที่ใช้เลือกวลีหัวรูป)
    var g = gradeOf(c);
    var showGrade = g.has && !g.locked && !g.noData && !g.est;
    var showRate = !showGrade && g.est && has;
    var sx = W - pad - 128, sy = 900, sr = 128;
    x.save();
    x.translate(sx, sy); x.rotate(-0.16);
    x.beginPath(); x.arc(0, 0, sr, 0, Math.PI * 2);
    x.fillStyle = showGrade && g.tone === 'bad' ? T.bad : T.accent; x.fill();
    x.setLineDash([6, 8]); x.lineWidth = 3; x.strokeStyle = T.onAccent;
    x.beginPath(); x.arc(0, 0, sr - 16, 0, Math.PI * 2); x.stroke(); x.setLineDash([]);
    if (showGrade) {
      text('เกรด', 0, -36, F(700, 25), T.onAccent, 'center');
      text(g.letter, 0, 62, F(700, g.letter.length > 2 ? 76 : 104), T.onAccent, 'center');
    } else if (showRate) {
      text('ทำได้', 0, -30, F(700, 28), T.onAccent, 'center');
      text(Math.round(Math.min(1, c.earned / c.outOf) * 100) + '%', 0, 52, F(700, 76), T.onAccent, 'center');
    } else {
      text('ตรวจแล้ว', 0, -30, F(700, 28), T.onAccent, 'center');
      text(has ? Math.round(Math.min(1, c.outOf / full) * 100) + '%' : '—', 0, 52, F(700, 76), T.onAccent, 'center');
    }
    x.restore();

    // ── ไทม์ไลน์ภาคเรียน: 4 ท่อนกว้างตามคะแนนเต็มของแต่ละช่วง เติมสีตามที่ได้
    var ty = 1112, gap = 14, steps = STEPS.map(function (st) { return { label: st[0], s: stepData(c, st[1]) }; });
    var maxSum = steps.reduce(function (n, st) { return n + (st.s.max || 0); }, 0) || 1;
    var avail = inner - gap * (steps.length - 1), bx = pad;
    text('ตลอดภาคเรียน', pad, ty - 34, F(600, 30), T.ink2);
    steps.forEach(function (st) {
      var s = st.s, w = Math.max(120, avail * (s.max || 0) / maxSum);
      if (bx + w > pad + inner) w = pad + inner - bx;
      storyBox(x, bx, ty, w, 26, 13);
      if (s.hidden) {
        x.setLineDash([10, 8]); x.lineWidth = 3; x.strokeStyle = T.track; x.stroke(); x.setLineDash([]);
      } else {
        x.fillStyle = T.track; x.fill();
        if (s.any && s.max > 0) {
          storyBox(x, bx, ty, Math.max(26, w * Math.min(1, s.got / s.max)), 26, 13);
          x.fillStyle = T.accent; x.fill();
        }
      }
      text(st.label, bx, ty + 70, F(600, 28), T.ink2);
      if (s.hidden) text('รอประกาศ', bx, ty + 114, F(600, 30), T.ink2);
      else {
        var vw = text(s.any ? nf(s.got) : '—', bx, ty + 116, F(700, 42), T.ink);
        text('/' + nf(s.max), bx + vw + 4, ty + 116, F(600, 26), T.ink2);
      }
      bx += w + gap;
    });

    // ── ไฮไลต์
    var hl = storyHighlights(c), hy = 1300, rh = 112;
    hl.forEach(function (r, i) {
      var top = hy + i * (rh + 14);
      storyBox(x, pad, top, inner, rh, 32); x.fillStyle = T.card; x.fill();
      storyBox(x, pad + 18, top + 18, 76, 76, 22); x.fillStyle = T.accent; x.fill();
      storyIcon(x, r.ico, pad + 32, top + 32, 48, T.onAccent);
      text(r.l, pad + 118, top + 52, F(700, 34), T.ink);
      text(r.note, pad + 118, top + 90, F(500, 26), T.ink2);
      text(r.v, pad + inner - 28, top + 74, F(700, 52), r.good ? T.accent : T.ink, 'right');
    });

    // ── ท้ายรูป: ชื่อ (เลือกเอาออกได้) · ชื่อระบบ
    var fy = 1664;
    if (opt.withName && d.name) text(d.name, pad, fy, F(700, 36), T.ink);
    text('AssignCheck', W - pad, fy, F(600, 26), T.ink2, 'right');
    return cv;
  }

  /**
   * หน้าตัวอย่างก่อนแชร์ — วาดรูปให้เสร็จก่อน แล้วค่อยให้กดแชร์
   * Safari ยอมเปิดเมนูแชร์เฉพาะตอนที่ผู้ใช้เพิ่งแตะ — ถ้าแตะแล้วไปรอวาดรูป/โหลดฟอนต์ก่อน เมนูจะไม่ขึ้น
   */
  function shareSheet(d, c) {
    var file = null, url = null;
    var theme = (function () { try { return localStorage.getItem(STORY_KEY) || 'forest'; } catch (e) { return 'forest'; } })();
    if (!STORY_THEMES[theme]) theme = 'forest';

    var img = h('img', { class: 'story-img', alt: 'ตัวอย่างรูปผลวิชา ' + (c.subject || '') });
    var frame = h('div', { class: 'story-frame busy' }, img);
    var nameChk = h('input', { type: 'checkbox', checked: true });
    var hint = h('p', { class: 'hint' }, 'รูปขนาด 1080×1920 พอดีสตอรี่ไอจี · กดแชร์แล้วเลือก Instagram → สตอรี่');
    var shareBtn = h('button', { class: 'btn btn-block', type: 'button', disabled: true },
      svg(ICON.share), 'แชร์ลงสตอรี่');
    var saveBtn = h('button', { class: 'btn btn-ghost btn-block', type: 'button', disabled: true },
      svg(ICON.save), 'บันทึกรูป');

    // เลือกธีม — วงกลมสีของแต่ละธีม จำธีมที่เลือกไว้ใช้ครั้งหน้า
    var swatches = Object.keys(STORY_THEMES).map(function (k) {
      var T = STORY_THEMES[k];
      return h('button', {
        class: 'story-theme', type: 'button', 'data-k': k, title: T.name, 'aria-label': 'ธีม' + T.name,
        'aria-pressed': k === theme ? 'true' : 'false',
        style: { background: 'linear-gradient(135deg,' + T.bg[0] + ' 0 55%,' + T.accent + ' 55% 100%)' },
        onclick: function () {
          if (theme === k) return;
          theme = k;
          try { localStorage.setItem(STORY_KEY, k); } catch (e) { /* โหมดส่วนตัว */ }
          swatches.forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-k') === k ? 'true' : 'false'); });
          render();
        }
      });
    });

    var busy = 0;   // กดสลับธีมรัว ๆ ใช้แค่รูปของครั้งล่าสุด
    function render() {
      var my = ++busy;
      frame.classList.add('busy');
      shareBtn.disabled = saveBtn.disabled = true;
      return storyFonts().then(function () {
        return new Promise(function (ok) {
          drawStory(d, c, { withName: nameChk.checked, theme: theme }).toBlob(ok, 'image/png');
        });
      }).then(function (blob) {
        if (my !== busy) return;
        if (!blob) throw new Error('สร้างรูปไม่สำเร็จ');
        if (url) URL.revokeObjectURL(url);
        url = URL.createObjectURL(blob);
        file = new File([blob], 'assigncheck-' + Date.now() + '.png', { type: 'image/png' });
        img.src = url;
        frame.classList.remove('busy');
        // แชร์ไฟล์ได้เฉพาะมือถือ/เบราว์เซอร์ที่รองรับ — คอมส่วนใหญ่เหลือปุ่มบันทึกรูปอย่างเดียว
        shareBtn.hidden = !(navigator.canShare && navigator.canShare({ files: [file] }));
        // แชร์ตรงไม่ได้ (คอม / เบราว์เซอร์ในแอปบางตัว) — บันทึกรูปกลายเป็นปุ่มหลัก และบอกทางไปไอจีให้ตรงกับปุ่มที่มี
        saveBtn.classList.toggle('btn-ghost', !shareBtn.hidden);
        hint.textContent = shareBtn.hidden
          ? 'รูปขนาด 1080×1920 พอดีสตอรี่ไอจี · กดบันทึกรูป แล้วเปิดไอจี → สตอรี่ → เลือกรูปนี้'
          : 'รูปขนาด 1080×1920 พอดีสตอรี่ไอจี · กดแชร์แล้วเลือก Instagram → สตอรี่';
        shareBtn.disabled = saveBtn.disabled = false;
      }).catch(function (e) {
        close();
        toast(e.message || 'สร้างรูปไม่สำเร็จ', true);
      });
    }

    shareBtn.addEventListener('click', function () {
      if (!file) return;
      navigator.share({ files: [file] }).catch(function (e) {
        if (e && e.name !== 'AbortError') toast('แชร์ไม่สำเร็จ — ลองกดบันทึกรูปแทน', true);
      });
    });
    saveBtn.addEventListener('click', function () {
      if (!url) return;
      var a = h('a', { href: url, download: file.name });
      document.body.appendChild(a); a.click(); a.remove();
      toast('บันทึกรูปแล้ว');
    });
    nameChk.addEventListener('change', render);

    var back = h('div', { class: 'modal-back', onclick: function (e) { if (e.target === back) close(); } },
      h('div', { class: 'modal story-sheet', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'แชร์ผลวิชาเป็นรูป' },
        h('h2', null, 'แชร์ผลวิชานี้'),
        frame,
        h('div', { class: 'story-opts' },
          h('div', { class: 'story-themes', role: 'group', 'aria-label': 'เลือกสีของรูป' }, swatches),
          h('label', { class: 'gate-keep story-opt' }, nameChk, h('span', null, 'ใส่ชื่อในรูป'))),
        h('div', { class: 'story-acts' }, shareBtn, saveBtn),
        hint,
        h('button', { class: 'story-close', type: 'button', onclick: function () { close(); } }, 'ปิด')));

    function onKey(e) { if (e.key === 'Escape') close(); }
    function close() {
      busy++;
      document.removeEventListener('keydown', onKey);
      back.remove();
      if (url) { URL.revokeObjectURL(url); url = null; }
    }
    document.addEventListener('keydown', onKey);
    document.body.appendChild(back);
    render();
  }

  function mini(label, value, tone) {
    return h('div', { class: 'mini' + (tone ? ' ' + tone : '') },
      h('div', { class: 'mini-l' }, label),
      h('div', { class: 'mini-v tnum' }, value));
  }

  /** สีบอกว่าใครต้องทำอะไร (มีตัวหนังสือกำกับเสมอ)
   *   แดง = นักเรียนต้องลงมือ · เส้นประ/เทา = รอครู · ปกติ = เรียบร้อย
   *   "ยังไม่ตรวจ" เคยเป็นสีส้ม ดูเหมือนนักเรียนทำผิด ทั้งที่รอครูอยู่ */
  var TONE = { miss: 'bad', none: 'wait', ok: '', late: '' };

  /**
   * ป้ายผ่าน/ไม่ผ่านเกณฑ์ — คืน null เมื่อครูไม่ได้ตั้งเกณฑ์ไว้
   * (it.passed เป็น null ได้ 2 กรณี: ไม่ได้ตั้งเกณฑ์ หรือครูยังไม่ตรวจ)
   */
  function passTag(it) {
    if (it.passed === true) return h('span', { class: 'pass-tag ok' }, 'ผ่านเกณฑ์');
    if (it.passed === false) return h('span', { class: 'pass-tag bad' }, 'ไม่ผ่านเกณฑ์ · ต้องได้ ' + nf(it.pass));
    return null;
  }

  /** ป้ายสอบซ่อม — บอกคะแนนครั้งแรกไว้ด้วย (ครูเลือกให้นักเรียนเห็น) */
  function retakeTag(it) {
    if (!it.retake) return null;
    var first = it.orig === null || it.orig === undefined ? 'ขาดสอบ' : nf(it.orig) + '/' + nf(it.max);
    return h('span', { class: 'pass-tag retake' }, 'สอบซ่อม · ครั้งแรก ' + first);
  }

  /** แถวงาน 1 ชิ้น — กดดูคำสั่งจากครูได้ (ครึ่งภาคบอกไว้ที่หัวการ์ดแล้ว ไม่ต้องซ้ำ) */
  function workRow(it, c) {
    var words = LABEL.work;
    var got = it.score !== null && it.score !== undefined;
    var sub = [it.status === 'late' && got ? 'ส่งช้า' : '', it.desc ? 'มีคำสั่งจากครู' : '']
      .filter(Boolean).join(' · ');
    return h('button', {
      class: 'srow ' + (TONE[it.status] || ''),
      onclick: function () { detail(it, c); }
    },
      h('div', { style: { flex: '1', minWidth: '0' } },
        h('div', { class: 'srow-name' }, it.label),
        sub && h('div', { class: 'srow-sub' }, sub),
        passTag(it)),
      h('div', { class: 'srow-tag ' + (TONE[it.status] || 'ok') },
        got ? nf(it.score) + '/' + nf(it.max) : words[it.status]),
      svg(ICON.right, 'ico srow-go')
    );
  }

  function examRow(it) {
    var got = it.score !== null && it.score !== undefined;
    return h('div', { class: 'srow static' + (got ? '' : ' dim') },
      h('div', { style: { flex: '1', minWidth: '0' } },
        h('div', { class: 'srow-name' }, it.label),
        !got && h('div', { class: 'srow-sub' }, LABEL.exam[it.status]),
        retakeTag(it),
        passTag(it)),
      h('div', { class: 'srow-tag ' + (got ? 'ok' : 'none') },
        got ? nf(it.score) + '/' + nf(it.max) : '—/' + nf(it.max)));
  }

  // ── หน้ารายละเอียดงาน (ดีไซน์หน้า 08b) ────────────────────

  function detail(it, c) {
    var got = it.score !== null && it.score !== undefined;
    var tone = TONE[it.status] || '';
    var STATUS_TEXT = {
      ok:   ['ครูตรวจแล้ว', 'ได้ ' + (got ? nf(it.score) + ' จาก ' + nf(it.max) : '—') + ' คะแนน'],
      late: ['ส่งช้า — ครูตรวจแล้ว', 'ได้ ' + (got ? nf(it.score) + ' จาก ' + nf(it.max) : '—') + ' คะแนน หลังหักส่งช้าแล้ว'],
      miss: ['ยังไม่ส่ง', 'ตอนนี้นับเป็น 0 คะแนน — คุยกับครูถ้ายังส่งได้'],
      none: ['ครูยังไม่ได้ตรวจ', 'ยังไม่มีคะแนนในช่องนี้']
    }[it.status];

    root.replaceChildren(
      h('div', { class: 'stu-hero' },
        h('div', { class: 'hero-row' },
          h('button', { class: 'hero-back', 'aria-label': 'กลับ', onclick: function () { draw(); } }, svg(ICON.left)),
          h('div', { class: 'hero-kick', style: { flex: '1' } },
            (it.exam ? 'การสอบ' : 'ส่งงาน') + ' · ' + (it.phase === 1 ? 'ก่อนกลางภาค' : 'หลังกลางภาค'))),
        h('div', { class: 'hero-name', role: 'heading', 'aria-level': '1', style: { marginTop: '10px' } }, it.label),
        h('div', { class: 'hero-mini' },
          mini('วิชา', c.subject),
          mini('คะแนนเต็ม', nf(it.max)),
          (it.pass === null || it.pass === undefined) ? null : mini('เกณฑ์ผ่าน', nf(it.pass)))),

      h('div', { class: 'stu-wrap page-enter' },
        h('div', { class: 'note ' + tone },
          h('div', { style: { flex: '1' } },
            h('b', null, STATUS_TEXT[0]),
            h('span', null, STATUS_TEXT[1]))),

        it.desc && h('div', { class: 'card' },
          h('div', { class: 'card-h' }, h('b', null, 'คำสั่งจากครู')),
          h('div', { class: 'prose' }, it.desc)),

        h('div', { class: 'tip' },
          'หน้านี้อ่านอย่างเดียว · ส่งงานที่ครูด้วยตนเองเหมือนเดิม')
      ));
    window.scrollTo({ top: 0 });
  }

  // ── เริ่ม ──────────────────────────────────────────────────
  function unboot() {
    var b = document.getElementById('boot');
    if (b) b.remove();
    if (root) root.hidden = false;
  }
  // พังตรงไหนก็ตาม ต้องไม่ค้างอยู่ที่หน้าโหลด
  window.addEventListener('error', function (e) {
    if (!document.getElementById('boot')) return;
    unboot();
    root.replaceChildren(h('div', { class: 'gate' },
      h('div', { class: 'err' }, 'เปิดหน้านี้ไม่สำเร็จ — ' + ((e && e.message) || 'ไม่ทราบสาเหตุ')),
      h('button', { class: 'btn', onclick: function () { location.reload(); } }, 'โหลดใหม่')));
  });

  try {
    var kept = saved.get();
    if (kept) enter(kept, true); else gate();
  } finally { unboot(); }
})();
