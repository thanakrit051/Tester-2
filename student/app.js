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
  //
  // mode: 'subject' = ดูทีละวิชา (หน้าเดิม) · 'summary' = สรุปคะแนนรวม+เกรดทุกวิชาในหน้าเดียว
  var VIEW = { data: null, cur: 0, mode: 'subject' };

  /* ครูเปิด/ปิดหน้าสรุปผลได้แยกจากการดูคะแนน (student_summary ในแท็บ ⚙️ ตั้งค่า)
   * ปิดอยู่ ชีตไม่ส่งคะแนนรวม/เกรดมาเลย — ตรงนี้แค่ไม่โชว์ปุ่มให้กดเข้าหน้าว่าง
   * summary ไม่มีมาเลย = โค้ดในชีตรุ่นก่อนมีสวิตช์นี้ ให้ทำงานแบบเดิม */
  var summaryOn = function () { return !VIEW.data || VIEW.data.summary !== false; };

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
          role: 'tab', 'aria-selected': VIEW.mode === m[0] ? 'true' : 'false',
          'data-on': VIEW.mode === m[0] ? '1' : '0',
          onclick: function () { VIEW.mode = m[0]; draw(); }
        }, m[1]);
      }));
  }

  function draw() {
    var d = VIEW.data;
    if (!d.classes.length) {
      root.replaceChildren(h('div', { class: 'stu-wrap' },
        h('div', { class: 'card empty' }, 'ยังไม่มีรายวิชาที่บันทึกไว้')));
      return;
    }
    if (VIEW.mode === 'summary' && summaryOn()) { drawSummary(d); return; }
    var c = d.classes[VIEW.cur];

    root.replaceChildren(
      hero(d, c),
      h('div', { class: 'stu-wrap' },
        modeSwitch(),
        d.classes.length > 1 && h('div', { class: 'chips' },
          d.classes.map(function (x, i) {
            return h('button', {
              class: 'chip', 'data-on': i === VIEW.cur ? '1' : '0',
              onclick: function () { VIEW.cur = i; draw(); window.scrollTo({ top: 0 }); }
            }, x.subject);
          })),

        phaseCard(c, 1),
        phaseCard(c, 2),
        attWarn(c),

        h('div', { class: 'tip' },
          'คะแนนแต่ละชิ้นเป็นคะแนนเต็มของชิ้นนั้น ระบบรวมแล้วคิดเป็นคะแนนของแต่ละส่วน' +
          ' · ข้อมูลอัปเดตตามที่ครูบันทึกไว้ · ถ้าคะแนนไม่ตรง แจ้งครูประจำวิชา')
      ));
    window.scrollTo({ top: 0 });
  }

  // ── ส่วนประกอบคะแนน (ใช้ทั้งหน้ารายวิชาและหน้าสรุปผล) ─────────
  //
  // คะแนน 100 ของแต่ละวิชาแบ่งเป็น 2 ครึ่ง ครึ่งละ 4 ส่วน (ตรงกับช่องใน SGS)
  // เด็กถามบ่อยสุดว่า "ครึ่งแรกได้เท่าไหร่ ขาดตรงไหน" — หน้านี้จึงจัดตามครึ่งภาคก่อน
  // แล้วค่อยไล่ส่วนย่อย ไม่ใช่แยกตาม "งาน/สอบ" แบบเดิม

  var PHASE_NAME = { 1: 'ก่อนกลางภาค', 2: 'หลังกลางภาค' };
  var SHORT = { work1: 'ส่งงาน', work2: 'ส่งงาน', quiz1: 'สอบเก็บ', quiz2: 'สอบเก็บ',
    att1: 'เข้าเรียน', att2: 'เข้าเรียน', mid: 'กลางภาค', fin: 'ปลายภาค' };

  /**
   * แถบคะแนน 3 สี: ได้แล้ว · ไม่ได้ (ตรวจแล้วแต่ไม่ได้คะแนน) · ยังไม่ได้เก็บ
   * ความกว้างคิดเป็น % ของ full
   */
  function scoreBar(got, lost, left, full, cls) {
    var pct = function (n) { return full > 0 ? (n / full * 100) + '%' : '0'; };
    return h('div', {
      class: 'sum-bar' + (cls ? ' ' + cls : ''), role: 'img',
      'aria-label': 'ได้ ' + nf(got) + ' · ไม่ได้ ' + nf(lost) + ' · ยังไม่เก็บ ' + nf(left) + ' จาก ' + nf(full)
    },
      got > 0 && h('i', { class: 'got', style: { width: pct(got) } }),
      lost > 0 && h('i', { class: 'lost', style: { width: pct(lost) } }),
      left > 0 && h('i', { class: 'left', style: { width: pct(left) } }));
  }

  /** ตัวเลข "ได้/เต็ม" — ช่องที่ยังไม่มีคะแนนโชว์ขีด ไม่ใช่ 0 (0 = ตรวจแล้วได้ 0) */
  function fraction(has, got, max, cls) {
    return h('span', { class: 'frac tnum' + (has ? '' : ' none') + (cls ? ' ' + cls : '') },
      h('b', null, has ? nf(got) : '—'), h('small', null, '/' + nf(max)));
  }

  /** การ์ดครึ่งภาค — หัวการ์ดบอกคะแนนรวมของครึ่งนี้ แล้วไล่ทีละส่วน */
  function phaseCard(c, phase) {
    var p = phaseSum(c, phase);
    var buckets = c.buckets.filter(function (b) { return b.phase === phase; });
    var checked = 0;
    buckets.forEach(function (b) { if (b.has) checked += Number(b.max) || 0; });

    return h('section', { class: 'card phase p' + phase },
      h('div', { class: 'phase-h' },
        h('span', { class: 'phase-no' }, String(phase)),
        h('div', { style: { flex: '1', minWidth: '0' } },
          h('div', { class: 'phase-name' }, PHASE_NAME[phase]),
          h('div', { class: 'phase-sub' },
            p.any ? 'เก็บคะแนนแล้ว ' + nf(checked) + ' จาก ' + nf(p.max) : 'ยังไม่มีคะแนนในครึ่งนี้')),
        fraction(p.any, p.got, p.max, 'lg')),

      h('div', { class: 'bks' }, buckets.map(function (b) { return bucketBlock(c, b); })));
  }

  /** ส่วนย่อย 1 ส่วน (เช่น ส่งงาน ครึ่งแรก) + รายการชิ้นงานที่อยู่ในส่วนนี้ */
  function bucketBlock(c, b) {
    var items = c.items.filter(function (it) { return it.bucket === b.id; });
    var isAtt = b.id === 'att1' || b.id === 'att2';
    var sub = isAtt ? 'คิดจากการมาเรียน'
      : items.length ? items.length + ' รายการ'
      : 'ครูยังไม่ได้เพิ่มรายการ';

    // สอบกลางภาค/ปลายภาคมักมีชิ้นเดียวชื่อซ้ำกับหัวข้อ — ไม่ต้องโชว์แถวซ้ำ
    // เว้นแต่มีป้ายสอบซ่อม/เกณฑ์ผ่านที่ต้องบอก
    var one = items.length === 1 && items[0];
    if (one && one.exam && (b.id === 'mid' || b.id === 'fin') && !one.retake && one.passed == null) {
      sub = one.score !== null && one.score !== undefined ? 'สอบแล้ว' : LABEL.exam[one.status];
      items = [];
    }

    return h('div', { class: 'bk' + (b.has ? '' : ' nodata') },
      h('div', { class: 'bk-h' },
        h('div', { style: { flex: '1', minWidth: '0' } },
          h('div', { class: 'bk-name' }, b.label),
          h('div', { class: 'bk-sub' }, sub)),
        fraction(b.has, b.score, b.max)),
      items.length > 0 && h('div', { class: 'rows' }, items.map(function (it) {
        return it.exam ? examRow(it) : workRow(it, c);
      })));
  }

  /** เตือนเรื่องเวลาเรียน — โชว์เฉพาะตอนต่ำกว่าเกณฑ์ (ตัวเลข % อยู่บนแถบเข้มแล้ว) */
  function attWarn(c) {
    var a = c.att || {};
    if (!a.risk) return null;
    return h('div', { class: 'risk-warn' },
      svg(ICON.warn), h('span', null,
        'เวลาเรียนตอนนี้ ' + a.pct + '% ต่ำกว่าเกณฑ์ ' + a.minPct + '% ' +
        'ถ้าถึงปลายภาคยังไม่ถึงเกณฑ์อาจติด มส — รีบคุยกับครูผู้สอน'));
  }

  // ── หน้าสรุปผลภาคเรียน ──────────────────────────────────
  //
  // นักเรียนอยากรู้ 2 อย่าง: "ได้รวมเท่าไหร่จาก 100" กับ "ได้เกรดอะไร"
  // หน้ารายวิชาตอบแค่คะแนนสะสมเทียบกับที่ตรวจแล้ว ต้องกดทีละวิชาแล้วบวกเอง
  //
  // ระหว่างภาคเรียน คะแนนรวมยังไม่ถึง 100 เกรดที่คิดจากคะแนนตอนนั้นจึงต่ำกว่าจริงเสมอ
  // ต้องบอกให้ชัดว่ายังเปลี่ยนได้ และยังมีคะแนนรอเก็บอีกเท่าไหร่ ไม่งั้นเด็กตกใจเปล่า ๆ

  /** คะแนนรวม /100 — โค้ดในชีตรุ่นก่อน 2.15.0 ไม่ส่ง total มา ก็รวม 8 ช่องเอง (ต่างกันแค่การปัดเศษ) */
  function totalOf(c) {
    if (typeof c.total === 'number') return c.total;
    var t = 0;
    c.buckets.forEach(function (b) { if (b.has) t += Number(b.score) || 0; });
    return Math.round(t * 100) / 100;
  }

  /** สีของเกรด: ดี · น่าห่วง · ตก/มส */
  function letterTone(g) {
    if (g === 'มส' || g === '0') return 'bad';
    var n = Number(g);
    if (isNaN(n)) return 'dim';
    return n <= 1.5 ? 'warn' : 'ok';
  }

  function phaseSum(c, phase) {
    var got = 0, max = 0, any = false;
    c.buckets.forEach(function (b) {
      if (b.phase !== phase) return;
      max += Number(b.max) || 0;
      if (b.has) { got += Number(b.score) || 0; any = true; }
    });
    return { got: Math.round(got * 100) / 100, max: max, any: any };
  }

  function drawSummary(d) {
    var list = d.classes;
    var done = list.filter(function (c) { return c.termDone; }).length;
    var risk = list.filter(function (c) {
      return c.letter === 'มส' || c.letter === '0' || (c.att && c.att.risk);
    }).length;

    root.replaceChildren(
      h('div', { class: 'stu-hero' },
        h('div', { class: 'hero-row' },
          h('div', { style: { flex: '1', minWidth: '0' } },
            h('div', { class: 'hero-kick' }, 'สรุปผลการเรียน · ' + list.length + ' วิชา'),
            h('div', { class: 'hero-name' }, d.name || '—')),
          h('button', { class: 'hero-out', onclick: function () { gate(); } }, 'ออก')),
        h('div', { class: 'hero-mini' },
          mini('รายวิชา', String(list.length)),
          mini('จบภาคเรียนแล้ว', done + '/' + list.length),
          mini('ต้องระวัง', risk ? risk + ' วิชา' : 'ไม่มี'))),

      h('div', { class: 'stu-wrap' },
        modeSwitch(),
        list.length > 1 && overviewCard(list),
        list.map(function (c, i) { return summaryCard(c, i); }),
        h('div', { class: 'tip' },
          'คะแนนรวมเต็ม 100 ต่อวิชา · เกรดคิดตามเกณฑ์ที่ครูตั้งไว้' +
          (done < list.length ? ' · วิชาที่ยังไม่จบภาคเรียน เกรดยังเปลี่ยนได้' : ''))
      ));
    window.scrollTo({ top: 0 });
  }

  /** เกรดที่จะโชว์ + สีของมัน — วิชาที่ยังไม่มีคะแนน หรือชีตรุ่นเก่าไม่ส่งเกรดมา ให้เป็นขีด */
  function gradeOf(c) {
    var hasLetter = c.letter !== undefined && c.letter !== null && c.letter !== '';
    var noData = !(c.outOf > 0);
    var letter = noData || !hasLetter ? '—' : String(c.letter);
    return { letter: letter, tone: noData || !hasLetter ? 'dim' : letterTone(letter), has: hasLetter, noData: noData };
  }

  /**
   * ตารางภาพรวม — ทุกวิชาในจอเดียว แบบใบรายงานผล
   * เด็กส่วนใหญ่อยากรู้แค่ "วิชาไหนได้เท่าไหร่" ก่อน รายละเอียดค่อยเลื่อนลงไปดู
   */
  function overviewCard(list) {
    return h('div', { class: 'card ov' },
      h('div', { class: 'ov-row ov-head' },
        h('span', { class: 'ov-subj' }, 'รายวิชา'),
        h('span', { class: 'ov-total' }, 'คะแนน'),
        h('span', { class: 'ov-grade' }, 'เกรด')),
      list.map(function (c, i) {
        var g = gradeOf(c);
        return h('button', {
          class: 'ov-row',
          onclick: function () {
            var el = document.getElementById('sum-' + i);
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        },
          h('span', { class: 'ov-subj' },
            h('b', null, c.subject || '—'),
            h('small', null, g.noData ? 'ยังไม่มีคะแนน' : c.termDone ? 'จบภาคเรียนแล้ว' : 'ยังไม่จบภาค')),
          h('span', { class: 'ov-total tnum' }, g.noData ? '—' : nf(totalOf(c))),
          h('span', { class: 'ov-grade' }, h('i', { class: 'gpill ' + g.tone }, g.letter)));
      }));
  }

  function summaryCard(c, i) {
    var total = totalOf(c);
    var g = gradeOf(c);
    var noData = g.noData;

    // แถบ 100 คะแนน: ได้แล้ว · ไม่ได้ (ตรวจแล้วแต่ไม่ได้คะแนน) · ยังไม่ได้เก็บ
    var outOf = Math.min(100, Number(c.outOf) || 0);
    var got = Math.max(0, Math.min(outOf, total));
    var lost = Math.max(0, outOf - got);
    var left = Math.max(0, 100 - outOf);

    // ป้ายสถานะข้างคะแนนรวม — บอกก่อนเลยว่าเลขนี้ "นิ่งแล้ว" หรือ "ยังขยับได้"
    var status = noData ? null
      : g.letter === 'มส' ? h('span', { class: 'st-pill bad' }, 'ติด มส')
      : c.termDone && !(c.pending > 0) ? h('span', { class: 'st-pill ok' }, 'จบภาคเรียนแล้ว')
      : c.termDone ? h('span', { class: 'st-pill warn' }, 'รอครูตรวจ')
      : h('span', { class: 'st-pill' }, 'ยังไม่จบภาค');

    var note = null;
    if (noData) note = h('div', { class: 'sum-note' }, 'ครูยังไม่ได้กรอกคะแนนในวิชานี้');
    else if (g.letter === 'มส') {
      note = h('div', { class: 'sum-note bad' },
        'เวลาเรียน ' + c.att.pct + '% ต่ำกว่าเกณฑ์ ' + c.att.minPct + '% — รีบคุยกับครูผู้สอน');
    } else if (!c.termDone) {
      note = h('div', { class: 'sum-note' },
        'ยังมีคะแนนรอเก็บอีก ' + nf(left) + ' คะแนน — เกรดนี้คิดจากคะแนนตอนนี้ เปลี่ยนได้อีก');
    } else if (c.pending > 0) {
      note = h('div', { class: 'sum-note warn' },
        'ครูยังตรวจไม่ครบ ' + c.pending + ' รายการ — คะแนนและเกรดอาจเปลี่ยนได้');
    }

    return h('section', { class: 'card sum-card', id: 'sum-' + i },
      h('div', { class: 'sum-top' },
        h('div', { style: { flex: '1', minWidth: '0' } },
          h('div', { class: 'sum-subj' }, c.subject || '—'),
          h('div', { class: 'sum-code' },
            [c.subjectCode, [c.grade, c.room].filter(Boolean).join('/')].filter(Boolean).join(' · ') || ' ')),
        h('div', { class: 'sum-grade ' + g.tone },
          h('span', null, 'เกรด'),
          h('b', null, g.letter))),

      h('div', { class: 'sum-total' },
        h('b', { class: 'tnum' }, noData ? '—' : nf(total)),
        h('span', null, '/100 คะแนน'),
        status),

      !noData && scoreBar(got, lost, left, 100),
      !noData && h('div', { class: 'sum-legend' },
        h('span', null, h('i', { class: 'got' }), 'ได้ ' + nf(got)),
        lost > 0 && h('span', null, h('i', { class: 'lost' }), 'ไม่ได้ ' + nf(lost)),
        left > 0 && h('span', null, h('i', { class: 'left' }), 'ยังไม่เก็บ ' + nf(left))),

      !noData && h('div', { class: 'split' }, [1, 2].map(function (ph) { return splitCol(c, ph); })),

      note,
      !noData && !g.has && h('div', { class: 'sum-note' },
        'ระบบของครูยังไม่ได้อัปเดต จึงยังแสดงเกรดไม่ได้ (คะแนนรวมถูกต้อง)'),

      h('button', {
        class: 'sum-more',
        onclick: function () { VIEW.cur = i; VIEW.mode = 'subject'; draw(); }
      }, 'ดูรายการงานและคะแนนสอบ', h('span', null, '›'))
    );
  }

  /** คอลัมน์ครึ่งภาคในหน้าสรุป — คะแนนรวมของครึ่งนั้น แล้วไล่ 4 ส่วนย่อย */
  function splitCol(c, phase) {
    var p = phaseSum(c, phase);
    return h('div', { class: 'split-col p' + phase },
      h('div', { class: 'split-h' },
        h('span', null, PHASE_NAME[phase]),
        fraction(p.any, p.got, p.max)),
      c.buckets.filter(function (b) { return b.phase === phase; }).map(function (b) {
        return h('div', { class: 'split-row' },
          h('span', null, SHORT[b.id] || b.label),
          fraction(b.has, b.score, b.max));
      }));
  }

  /** แถบเข้มบนสุด — วิชา ชื่อ คะแนนสะสม และคะแนนแยกครึ่งภาค */
  function hero(d, c) {
    var half = function (phase) {
      var p = phaseSum(c, phase);
      return p.any ? nf(p.got) + '/' + nf(p.max) : '—/' + nf(p.max);
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
        mini('ก่อนกลางภาค', half(1)),
        mini('หลังกลางภาค', half(2)),
        mini('เวลาเรียน', c.att && c.att.checked > 0 ? c.att.pct + '%' : '—'))
    );
  }

  function mini(label, value) {
    return h('div', { class: 'mini' },
      h('div', { class: 'mini-l' }, label),
      h('div', { class: 'mini-v tnum' }, value));
  }

  /** สีพื้นของแถว บอกสถานะโดยไม่ต้องอ่านตัวหนังสือก่อน (แต่มีตัวหนังสือกำกับเสมอ) */
  var TONE = { miss: 'bad', none: 'warn', ok: '', late: '' };

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
      h('span', { class: 'srow-go' }, '›')
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
          h('button', { class: 'hero-back', onclick: function () { draw(); } }, '‹'),
          h('div', { class: 'hero-kick', style: { flex: '1' } },
            (it.exam ? 'การสอบ' : 'ส่งงาน') + ' · ' + (it.phase === 1 ? 'ก่อนกลางภาค' : 'หลังกลางภาค'))),
        h('div', { class: 'hero-name', style: { marginTop: '10px' } }, it.label),
        h('div', { class: 'hero-mini' },
          mini('วิชา', c.subject),
          mini('คะแนนเต็ม', nf(it.max)),
          (it.pass === null || it.pass === undefined) ? null : mini('เกณฑ์ผ่าน', nf(it.pass)))),

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
