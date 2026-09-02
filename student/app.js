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
    warn: '<path d="M12 9v4.5"/><path d="M12 17h.01"/><path d="M10.3 3.9 2.5 17.4A2 2 0 0 0 4.2 20.5h15.6a2 2 0 0 0 1.7-3.1L13.7 3.9a2 2 0 0 0-3.4 0z"/>'
  };
  var nf = function (n) { return String(Math.round(Number(n) * 100) / 100); };

  /** ตัวย่อบนวงกลม — ตัดคำนำหน้า (เด็กชาย/นางสาว/ด.ช.) ออกก่อน ไม่งั้นได้ "เ" ทุกคน */
  function initial(name) {
    var s = String(name || '').replace(/^(เด็กชาย|เด็กหญิง|นางสาว|นาง|นาย|ด\.ช\.|ด\.ญ\.|น\.ส\.)\s*/, '').trim();
    return (s || String(name || '?').trim() || '?').charAt(0);
  }

  // ── เรียกเซิร์ฟเวอร์ ──────────────────────────────────────
  //
  // หน้านี้ทำงานได้ 2 ที่ โดยไม่ต้องแก้โค้ด
  //   1. Apps Script เสิร์ฟเอง  → คุยผ่าน google.script.run
  //   2. GitHub Pages           → คุยผ่าน fetch ไปที่ URL ใน config.js
  //
  // ที่ต้องส่งเป็น text/plain เพราะถ้าใช้ application/json เบราว์เซอร์จะยิง
  // preflight (OPTIONS) ก่อน ซึ่ง Apps Script ตอบไม่ได้ แล้วจะติด CORS
  var EMBEDDED = !!(window.google && google.script && google.script.run);

  function parseRes(raw, resolve, reject) {
    var res;
    try { res = JSON.parse(raw); } catch (e) { reject(new Error('อ่านคำตอบจากเซิร์ฟเวอร์ไม่ได้')); return; }
    if (res && res.ok) resolve(res.data);
    else reject(new Error((res && res.error) || 'เกิดข้อผิดพลาด'));
  }

  function ask(sid) {
    var body = JSON.stringify({ action: 'studentGet', payload: { sid: sid } });

    return new Promise(function (resolve, reject) {
      if (EMBEDDED) {
        google.script.run
          .withSuccessHandler(function (raw) { parseRes(raw, resolve, reject); })
          .withFailureHandler(function (err) {
            reject(new Error((err && err.message) || 'เชื่อมต่อไม่ได้ ลองใหม่อีกครั้ง'));
          })
          .apiCall(body);
        return;
      }

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
        .catch(function () { reject(new Error('เชื่อมต่อไม่ได้ — ตรวจอินเทอร์เน็ตแล้วลองใหม่')); });
    });
  }

  // ── หน้ากรอกเลขประจำตัว ───────────────────────────────────
  var root = document.getElementById('app');
  var LAST = 'ac.stu.last';

  function gate(errMsg) {
    var input = h('input', {
      type: 'text', inputmode: 'numeric', autocomplete: 'off',
      placeholder: '00000', maxlength: '20',
      value: (function () { try { return localStorage.getItem(LAST) || ''; } catch (e) { return ''; } })()
    });
    var btn = h('button', { class: 'btn btn-block', type: 'submit' }, 'ดูผลของฉัน');

    var form = h('form', {
      onsubmit: function (e) {
        e.preventDefault();
        var sid = input.value.trim();
        if (!sid) { input.focus(); return; }
        btn.disabled = true; btn.textContent = 'กำลังค้นหา…';
        ask(sid).then(function (data) {
          try { localStorage.setItem(LAST, sid); } catch (e2) {}
          show(data);
        }).catch(function (err) {
          gate(err.message);
        });
      }
    }, input, btn);

    root.replaceChildren(h('div', { class: 'gate' },
      h('div', { class: 'gate-mark' }, svg(ICON.book)),
      h('div', null,
        h('h1', null, 'ผลการเรียนของฉัน'),
        h('p', null, 'กรอกเลขประจำตัวนักเรียนเพื่อดูงาน คะแนน และการมาเรียน')),
      errMsg ? h('div', { class: 'err', style: { maxWidth: '340px', margin: '0 auto', width: '100%' } }, errMsg) : null,
      form,
      h('div', { class: 'foot' }, 'เห็นเฉพาะข้อมูลของตัวเอง · ดูอย่างเดียว แก้ไขไม่ได้')
    ));
    setTimeout(function () { input.focus(); input.select(); }, 80);
  }

  /** ข้อสอบกับงานส่งใช้คำต่างกัน — ให้ตรงกับที่ครูเห็นในระบบ */
  var LABEL = {
    work: { ok: 'ส่งแล้ว', late: 'ส่งช้า', miss: 'ไม่ส่ง', none: 'ยังไม่ตรวจ' },
    exam: { ok: 'สอบแล้ว', late: 'ส่งช้า', miss: 'ยังไม่ได้สอบ', none: 'ยังไม่กรอก' }
  };


  // ── หน้าแสดงผล (ดีไซน์หน้า 08) ────────────────────────────
  //
  // ดีไซน์วางหน้านี้เป็น "วิชาละหนึ่งหน้า" — แถบเข้มบอกว่ากำลังดูวิชาไหน
  // ได้คะแนนสะสมเท่าไหร่ แล้วค่อยไล่รายการงานกับคะแนนสอบข้างล่าง
  var VIEW = { data: null, cur: 0 };

  function show(d) {
    VIEW.data = d;
    if (VIEW.cur >= d.classes.length) VIEW.cur = 0;
    draw();
  }

  function draw() {
    var d = VIEW.data;
    if (!d.classes.length) {
      root.replaceChildren(h('div', { class: 'stu-wrap' },
        h('div', { class: 'card empty' }, 'ยังไม่มีรายวิชาที่บันทึกไว้')));
      return;
    }
    var c = d.classes[VIEW.cur];

    root.replaceChildren(
      hero(d, c),
      h('div', { class: 'stu-wrap' },
        d.classes.length > 1 && h('div', { class: 'chips' },
          d.classes.map(function (x, i) {
            return h('button', {
              class: 'chip', 'data-on': i === VIEW.cur ? '1' : '0',
              onclick: function () { VIEW.cur = i; draw(); window.scrollTo({ top: 0 }); }
            }, x.subject);
          })),

        workCard(c),
        examCard(c),
        c.att.risk && h('div', { class: 'warn' },
          svg(ICON.warn), h('span', null,
            'เวลาเรียนตอนนี้ ' + c.att.pct + '% ต่ำกว่าเกณฑ์ ' + c.att.minPct + '% ' +
            'ถ้าถึงปลายภาคยังไม่ถึงเกณฑ์อาจติด มส — รีบคุยกับครูผู้สอน')),

        h('div', { class: 'tip' },
          'ข้อมูลอัปเดตตามที่ครูบันทึกไว้ · ถ้าคะแนนไม่ตรง แจ้งครูประจำวิชา')
      ));
    window.scrollTo({ top: 0 });
  }

  /** แถบเข้มบนสุด — วิชา ชื่อ คะแนนสะสม และสรุป 3 ก้อน */
  function hero(d, c) {
    var sum = function (ids) {
      var got = 0, max = 0, any = false;
      c.buckets.forEach(function (b) {
        if (ids.indexOf(b.id) < 0 || !b.has) return;
        got += b.score; max += b.max; any = true;
      });
      return any ? nf(got) + '/' + nf(max) : '—';
    };

    return h('div', { class: 'stu-hero' },
      h('div', { class: 'hero-row' },
        h('div', { style: { flex: '1', minWidth: '0' } },
          h('div', { class: 'hero-kick' },
            [[c.grade, c.room].filter(Boolean).join('/'), c.subject].filter(Boolean).join(' · ')),
          h('div', { class: 'hero-name' }, d.name || '—')),
        h('button', { class: 'hero-out', onclick: function () { gate(); } }, 'ออก')),

      h('div', { class: 'hero-score' },
        h('b', null, c.outOf > 0 ? nf(c.earned) : '—'),
        h('span', null, c.outOf > 0
          ? 'คะแนนสะสม · เต็ม ' + nf(c.outOf) + ' ที่ตรวจแล้ว'
          : 'ครูยังไม่ได้กรอกคะแนนในวิชานี้')),

      h('div', { class: 'hero-mini' },
        mini('ส่งงาน', sum(['work1', 'work2'])),
        mini('สอบเก็บ', sum(['quiz1', 'quiz2'])),
        mini('สอบใหญ่', sum(['mid', 'fin'])))
    );
  }

  function mini(label, value) {
    return h('div', { class: 'mini' },
      h('div', { class: 'mini-l' }, label),
      h('div', { class: 'mini-v tnum' }, value));
  }

  /** สีพื้นของแถว บอกสถานะโดยไม่ต้องอ่านตัวหนังสือก่อน (แต่มีตัวหนังสือกำกับเสมอ) */
  var TONE = { miss: 'bad', none: 'warn', ok: '', late: '' };

  function workCard(c) {
    var list = c.items.filter(function (it) { return !it.exam; });
    if (!list.length) return null;
    return h('div', { class: 'card' },
      h('div', { class: 'card-h' },
        h('b', null, 'รายการงาน'),
        h('span', null, 'กดที่ชื่องานเพื่อดูคำสั่งจากครู')),
      h('div', { class: 'rows' }, list.map(function (it) { return workRow(it, c); }))
    );
  }

  function workRow(it, c) {
    var words = LABEL.work;
    var got = it.score !== null && it.score !== undefined;
    return h('button', {
      class: 'srow ' + (TONE[it.status] || ''),
      onclick: function () { detail(it, c); }
    },
      h('div', { style: { flex: '1', minWidth: '0' } },
        h('div', { class: 'srow-name' }, it.label),
        h('div', { class: 'srow-sub' },
          (it.phase === 1 ? 'ก่อนกลางภาค' : 'หลังกลางภาค') +
          (it.desc ? ' · มีคำสั่งจากครู' : ''))),
      h('div', { class: 'srow-tag ' + (TONE[it.status] || 'ok') },
        got ? nf(it.score) + '/' + nf(it.max) : words[it.status]),
      h('span', { class: 'srow-go' }, '›')
    );
  }

  function examCard(c) {
    var list = c.items.filter(function (it) { return it.exam; });
    if (!list.length) return null;
    return h('div', { class: 'card' },
      h('div', { class: 'card-h' }, h('b', null, 'คะแนนสอบ')),
      h('div', { class: 'rows' }, list.map(function (it) {
        var got = it.score !== null && it.score !== undefined;
        var big = it.kind === 'MID' || it.kind === 'FIN';
        return h('div', { class: 'srow static' + (big ? ' hi' : '') + (got ? '' : ' dim') },
          h('div', { style: { flex: '1', minWidth: '0' } },
            h('div', { class: 'srow-name', style: big ? { fontWeight: '600' } : null }, it.label),
            h('div', { class: 'srow-sub' },
              got ? (it.phase === 1 ? 'ก่อนกลางภาค' : 'หลังกลางภาค')
                  : LABEL.exam[it.status])),
          h('div', { class: 'srow-tag ' + (big ? 'accent' : 'ok') },
            got ? nf(it.score) + '/' + nf(it.max) : '—/' + nf(it.max)));
      }))
    );
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
          h('button', { class: 'hero-back', onclick: function () { draw(); } }, '‹'),
          h('div', { class: 'hero-kick', style: { flex: '1' } },
            (it.exam ? 'การสอบ' : 'ส่งงาน') + ' · ' + (it.phase === 1 ? 'ก่อนกลางภาค' : 'หลังกลางภาค'))),
        h('div', { class: 'hero-name', style: { marginTop: '10px' } }, it.label),
        h('div', { class: 'hero-mini' },
          mini('วิชา', c.subject),
          mini('คะแนนเต็ม', nf(it.max)))),

      h('div', { class: 'stu-wrap' },
        h('div', { class: 'note ' + tone },
          h('div', { style: { flex: '1' } },
            h('b', null, STATUS_TEXT[0]),
            h('span', null, STATUS_TEXT[1]))),

        it.desc && h('div', { class: 'card' },
          h('div', { class: 'card-h' }, h('b', null, 'คำสั่งจากครู')),
          h('div', { class: 'prose' }, it.desc)),

        h('div', { class: 'card' },
          h('div', { class: 'card-h' }, h('b', null, 'เกณฑ์การให้คะแนน')),
          h('div', { class: 'rules' },
            rule(it.exam ? 'เข้าสอบ' : 'ส่งตรงเวลา', 'เต็ม ' + nf(it.max), ''),
            !it.exam && rule('ส่งช้า', 'ครูหักตามที่ตั้งไว้ในระบบ', 't-warn'),
            rule(it.exam ? 'ไม่ได้สอบ' : 'ไม่ส่ง', '0 คะแนน', 't-dim'))),

        h('div', { class: 'tip' },
          'หน้านี้อ่านอย่างเดียว · ส่งงานที่ครูด้วยตนเองเหมือนเดิม')
      ));
    window.scrollTo({ top: 0 });
  }

  function rule(a, b, tone) {
    return h('div', { class: 'rule' },
      h('span', { style: { flex: '1' } }, a),
      h('span', { class: tone || '' }, b));
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

  try { gate(); } finally { unboot(); }
})();
