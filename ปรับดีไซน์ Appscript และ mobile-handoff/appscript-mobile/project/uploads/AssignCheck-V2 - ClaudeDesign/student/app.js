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

  // ── หน้าแสดงผล ────────────────────────────────────────────
  function show(d) {
    root.replaceChildren(h('div', { class: 'stu-wrap' },
      h('div', { class: 'who' },
        h('div', { class: 'who-av' }, initial(d.name)),
        h('div', { style: { flex: '1', minWidth: '0' } },
          h('div', { class: 'who-name' }, d.name || '—'),
          h('div', { class: 'who-sub' }, 'เลขประจำตัว ' + d.sid)),
        h('button', {
          class: 'btn btn-ghost btn-sm',
          onclick: function () { gate(); }
        }, 'ออก')
      ),

      d.classes.length === 0
        ? h('div', { class: 'card empty' }, 'ยังไม่มีรายวิชาที่บันทึกไว้')
        : d.classes.map(subjectCard),

      h('div', { class: 'tip' },
        'ข้อมูลอัปเดตตามที่ครูบันทึกไว้ · อาจช้ากว่าของจริงไม่กี่นาที',
        h('br'),
        'ถ้าคะแนนไม่ตรง ให้แจ้งครูผู้สอนโดยตรง')
    ));
    window.scrollTo({ top: 0 });
  }

  function subjectCard(c, i) {
    var body = h('div', { class: 'subj-body' },
      // คะแนนที่เก็บได้ — เทียบเฉพาะช่องที่ครูกรอกแล้ว ไม่ใช่ 100 เต็ม
      h('div', { class: 'big' },
        c.outOf > 0
          ? [h('div', { class: 'big-num' }, nf(c.earned), h('small', null, ' / ' + nf(c.outOf))),
             h('div', { class: 'big-lbl' }, 'คะแนนที่เก็บได้ จากส่วนที่ครูกรอกแล้ว (เต็มทั้งปี 100)')]
          : [h('div', { class: 'big-num', style: { color: 'var(--ink-3)' } }, '—'),
             h('div', { class: 'big-lbl' }, 'ครูยังไม่ได้กรอกคะแนนในวิชานี้')]
      ),

      // ── คะแนนรายช่อง ──
      c.buckets.some(function (b) { return b.has; }) && [
        h('div', { class: 'grp' }, 'คะแนนแต่ละส่วน'),
        c.buckets.filter(function (b) { return b.has; }).map(function (b) {
          var pct = b.max > 0 ? Math.max(0, Math.min(100, b.score / b.max * 100)) : 0;
          return h('div', { class: 'meter-row' },
            h('div', { class: 'meter-label' }, b.label,
              h('span', null, b.phase === 1 ? 'ก่อนกลางภาค' : 'หลังกลางภาค')),
            h('div', { class: 'meter-track' }, h('div', { class: 'meter-fill', style: { width: pct + '%' } })),
            h('div', { class: 'meter-val tnum' }, nf(b.score) + '/' + nf(b.max)));
        })
      ],

      // ── งานและข้อสอบ ──
      c.items.length > 0 && [1, 2].map(function (ph) {
        var list = c.items.filter(function (it) { return it.phase === ph; });
        if (!list.length) return null;
        return [
          h('div', { class: 'grp' }, ph === 1 ? 'งานและการสอบ · ก่อนกลางภาค' : 'งานและการสอบ · หลังกลางภาค'),
          list.map(itemRow)
        ];
      }),

      // ── การมาเรียน ──
      c.att.checked > 0 && [
        h('div', { class: 'grp' }, 'การมาเรียน · เช็คแล้ว ' + c.att.checked + ' คาบ'),
        h('div', { class: 'att-grid' },
          box('ok', c.att.present, 'มา'),
          box('late', c.att.late, 'สาย'),
          box('leave', c.att.leave, 'ลา'),
          box('miss', c.att.absent, 'ขาด')),
        c.att.risk && h('div', { class: 'warn' },
          svg(ICON.warn), h('span', null,
            'เวลาเรียนตอนนี้ ' + c.att.pct + '% ซึ่งต่ำกว่าเกณฑ์ ' + c.att.minPct + '% ' +
            'ถ้าถึงปลายภาคยังไม่ถึงเกณฑ์อาจติด มส — รีบคุยกับครูผู้สอน'))
      ]
    );

    var card = h('div', { class: 'card card-tight subj' + (i === 0 ? '' : ' closed') },
      h('button', {
        class: 'subj-head',
        onclick: function (e) { e.currentTarget.parentElement.classList.toggle('closed'); }
      },
        h('span', { class: 'subj-tag' }, [c.grade, c.room].filter(Boolean).join('/') || '—'),
        h('span', { style: { flex: '1', minWidth: '0' } },
          h('span', { class: 'subj-name', style: { display: 'block' } }, c.subject),
          h('span', { class: 'subj-meta', style: { display: 'block' } },
            [c.subjectCode, c.no ? 'เลขที่ ' + c.no : ''].filter(Boolean).join(' · '))),
        svg(ICON.chev, 'ico subj-chev')
      ),
      body
    );
    return card;
  }

  /** ข้อสอบกับงานส่งใช้คำต่างกัน — ให้ตรงกับที่ครูเห็นในระบบ */
  var LABEL = {
    work: { ok: 'ส่งแล้ว', late: 'ส่งช้า', miss: 'ไม่ส่ง', none: 'ยังไม่ตรวจ' },
    exam: { ok: 'สอบแล้ว', late: 'ส่งช้า', miss: 'ยังไม่ได้สอบ', none: 'ยังไม่กรอก' }
  };
  var BADGE = { ok: 'g', late: 'a', miss: 'r', none: 'n' };

  function itemRow(it) {
    var words = it.exam ? LABEL.exam : LABEL.work;
    var got = it.score !== null && it.score !== undefined;
    return h('div', { class: 'item' },
      h('div', { class: 'item-main' },
        h('div', { class: 'item-name' }, it.label),
        it.desc && h('div', { class: 'item-desc' }, it.desc)),
      h('span', { class: 'badge ' + BADGE[it.status] }, words[it.status]),
      h('div', { class: 'item-score' + (got ? '' : ' none') },
        got ? nf(it.score) + '/' + nf(it.max) : '—')
    );
  }

  function box(cls, n, label) {
    return h('div', { class: 'att-box ' + cls },
      h('div', { class: 'att-n' }, String(n)),
      h('div', { class: 'att-l' }, label));
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
