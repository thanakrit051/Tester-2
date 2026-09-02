/* หน้ากรอกงานและคะแนนสอบ (ส่งงาน · สอบเก็บคะแนน · กลางภาค · ปลายภาค) */

import { h, modal, toast, confirmBox, nf } from '../dom.js';
import { state, emit, loadClass, ensureColumn, setCells, getCell, deleteColumn, updateColumn, settings } from '../state.js';
import { BUCKETS, NOT_SUBMITTED, parseWork, formatWork } from '../score.js';

/**
 * ดีไซน์แยก "ชนิดของคะแนน" กับ "ช่วง" ออกจากกัน (หน้า 03)
 * แถวบนเลือกชนิด 4 อย่าง · มุมขวาเลือกช่วง ก่อน/หลังกลางภาค
 * รวมกันได้ 8 ถัง เท่ากับ 8 ช่องของ SGS เหมือนเดิม
 * กลางภาค/ปลายภาคมีช่วงเดียว จึงบังคับช่วงให้เอง
 */
const KINDS = [
  { kind: 'WORK', ic: '📝', label: 'ส่งงาน' },
  { kind: 'QUIZ', ic: '✍️', label: 'สอบเก็บ' },
  { kind: 'MID',  ic: '📄', label: 'กลางภาค', fixed: 1 },
  { kind: 'FIN',  ic: '📕', label: 'ปลายภาค', fixed: 2 }
];

const ui = {
  kind: 'WORK',      // ชนิดคะแนนที่เลือกอยู่
  phase: 1,          // ช่วง 1 = ก่อนกลางภาค · 2 = หลังกลางภาค
  open: null,        // key ของชิ้นงานที่กำลังกรอก (โหมดรายชิ้นงาน)
  by: 'item',        // 'item' = กรอกทีละชิ้นงาน · 'student' = กรอกทีละคน
  si: 0              // ลำดับนักเรียนในโหมดรายคน
};

const kindOf = (k) => KINDS.find(x => x.kind === k) || KINDS[0];
/** ช่วงที่ใช้จริง — ชนิดที่มีช่วงเดียวจะไม่สนใจปุ่มเลือกช่วง */
const curPhase = () => kindOf(ui.kind).fixed || ui.phase;
/** ถังที่เลือกอยู่ (ชนิด × ช่วง) */
const curBucket = () => BUCKETS.find(b => b.kind === ui.kind && b.half === curPhase()) || BUCKETS[0];

/** ให้แถวชนิด/ช่วงตรงกับชิ้นงานที่เปิดอยู่ */
function syncTo(col) {
  ui.kind = col.kind;
  if (!kindOf(col.kind).fixed) ui.phase = col.half;
}

const bucketOf = (id) => BUCKETS.find(b => b.id === id);

/**
 * ข้อสอบ (สอบเก็บคะแนน / กลางภาค / ปลายภาค) ใช้คำต่างจากงานส่ง
 * และไม่มีสถานะ "ส่งช้า" — สอบแล้วก็คือสอบแล้ว
 */
const isExam = (col) => col && col.kind !== 'WORK';

const words = (col) => (isExam(col)
  ? { done: 'สอบแล้ว', miss: 'ยังไม่ได้สอบ', missShort: 'ยังไม่สอบ',
      bulk: 'ให้เต็มทุกคน', bulkToast: 'ให้คะแนนเต็มทั้งห้อง' }
  : { done: 'ตรวจแล้ว', miss: 'ไม่ส่ง', missShort: 'ไม่ส่ง',
      bulk: 'ส่งครบทุกคน', bulkToast: 'ให้ "ส่ง" เต็มทั้งห้อง' });

function columnsIn(bucketId) {
  const b = bucketOf(bucketId);
  return (state.cls?.columns || [])
    .filter(c => c.kind === b.kind && c.half === b.half)
    .sort((a, b2) => String(a.id).localeCompare(String(b2.id)));
}

export function viewWork() {
  const cls = state.cls;
  if (!cls) return h('div', { class: 'page empty' }, 'ยังไม่ได้เลือกห้องเรียน');
  if (!cls.students.length) {
    return h('div', { class: 'page' }, h('div', { class: 'card empty' },
      h('div', { class: 'empty-icon' }, '👥'), 'ห้องนี้ยังไม่มีรายชื่อนักเรียน'));
  }
  const col = openCol();
  if (!col) return listScreen();
  return ui.by === 'student' ? studentScreen(col) : gradeScreen(col);
}

/** นักเรียนที่กำลังกรอกอยู่ในโหมดรายคน */
function curStudent() {
  const list = state.cls.students;
  if (ui.si >= list.length) ui.si = 0;
  return list[ui.si];
}

/** ชิ้นงานที่กำลังกรอกอยู่ (ถ้ามี) — ใช้ทั้งแถบหัวและตัวหน้า */
function openCol() {
  if (!ui.open) return null;
  const col = (state.cls.columns || []).find(c => c.key === ui.open);
  if (!col) { ui.open = null; return null; }
  syncTo(col);          // แถวชนิด/ช่วงต้องชี้ตรงกับชิ้นที่เปิดอยู่เสมอ
  return col;
}

/** แถบหัวสีเข้มของหน้านี้ (มือถือ) — ชื่อชิ้นงาน · ความคืบหน้า · สลับชิ้นงาน */
viewWork.head = function () {
  const cls = state.cls;
  if (!cls || !cls.students.length) return null;
  const col = openCol();
  if (!col) return null;

  const b = BUCKETS.find(x => x.kind === col.kind && x.half === col.half);
  const t = tally(col);
  const siblings = (cls.columns || []).filter(c => c.kind === col.kind && c.half === col.half);
  const s = curStudent();
  const byStudent = ui.by === 'student';

  return h('header', { class: 'pagehead' },
    h('div', { class: 'ph-row' },
      h('button', { class: 'ph-back', 'aria-label': 'กลับ', onclick: () => { ui.open = null; emit(); } }, '‹'),
      h('div', { class: 'ph-grow' },
        h('div', { class: 'ph-title' }, byStudent ? (s.name || '—') : col.label),
        h('div', { class: 'ph-sub' }, byStudent
          ? `เลขที่ ${s.no}${s.sid ? ' · ' + s.sid : ''} · ${[cls.meta.grade, cls.meta.room].filter(Boolean).join('/')}`
          : `${b ? b.label : ''} · ${col.half === 1 ? 'ก่อนกลางภาค' : 'หลังกลางภาค'} · เต็ม ${col.max}`)),
      h('div', { class: 'ph-badge', 'data-prog': '1' },
        byStudent ? `${ui.si + 1}/${cls.students.length}` : `${t.done}/${t.total}`)
    ),
    modeSeg('ph-seg'),
    !byStudent && h('button', { class: 'ph-box', onclick: () => openItemPicker(col) },
      h('b', null, col.label),
      h('span', null, `${siblings.length} ชิ้นในถังนี้`),
      h('i', null, '⌄'))
  );
};

/**
 * แถวเลือกชนิดคะแนน + ช่วง (ดีไซน์หน้า 03 แถวบนสุด)
 * @param openFirst true = ย้ายไปกรอกชิ้นแรกของถังใหม่ทันที (ใช้ตอนอยู่ในหน้ากรอก)
 */
function bucketBar(openFirst) {
  const S = settings();
  const fixed = kindOf(ui.kind).fixed;

  const jump = () => {
    if (!openFirst) { emit(); return; }
    const first = columnsIn(curBucket().id)[0];
    ui.open = first ? first.key : null;
    emit();
  };

  return h('div', { class: 'kind-bar' },
    h('div', { class: 'kind-scroll' }, KINDS.map(k => {
      const b = BUCKETS.find(x => x.kind === k.kind && x.half === (k.fixed || ui.phase));
      return h('button', {
        class: 'kind-pill', 'data-on': ui.kind === k.kind ? '1' : '0',
        onclick: () => { ui.kind = k.kind; jump(); }
      }, `${k.ic} ${k.label}`, h('span', null, ' · ' + (b ? S.weight[b.id] : 0)));
    })),
    h('label', { class: 'phase-pick', 'data-off': fixed ? '1' : '0' },
      h('span', null, 'ช่วง:'),
      h('select', {
        'aria-label': 'ช่วงคะแนน', disabled: !!fixed,
        onchange: (e) => { ui.phase = Number(e.target.value); jump(); }
      },
        h('option', { value: '1', selected: curPhase() === 1 }, 'ก่อนกลางภาค'),
        h('option', { value: '2', selected: curPhase() === 2 }, 'หลังกลางภาค')))
  );
}

/** สลับ รายชิ้นงาน ↔ รายคน (ดีไซน์หน้า 03 / 03b) */
function modeSeg(cls) {
  const set = (v) => { ui.by = v; emit(); };
  return h('div', { class: cls },
    h('button', { 'data-on': ui.by === 'item' ? '1' : '0', onclick: () => set('item') }, 'รายชิ้นงาน'),
    h('button', { 'data-on': ui.by === 'student' ? '1' : '0', onclick: () => set('student') }, 'รายคน'));
}

/** แผ่นเลือกชิ้นงาน (มือถือ) — แทนแถวชิปที่ดีไซน์ใช้บน PC */
function openItemPicker(cur) {
  const cols = columnsIn(curBucket().id);
  modal((close) => h('div', null,
    h('h2', null, 'เลือกสิ่งที่จะกรอก'),
    h('div', { class: 'chips', style: { marginBottom: '10px' } },
      KINDS.map(k => h('button', {
        class: 'chip', 'data-on': ui.kind === k.kind ? '1' : '0',
        onclick: () => { ui.kind = k.kind; close(); openItemPicker(cur); }
      }, `${k.ic} ${k.label}`))),
    !kindOf(ui.kind).fixed && h('div', { class: 'chips', style: { marginBottom: '10px' } },
      [[1, 'ก่อนกลางภาค'], [2, 'หลังกลางภาค']].map(([v, l]) => h('button', {
        class: 'chip', 'data-on': curPhase() === v ? '1' : '0',
        onclick: () => { ui.phase = v; close(); openItemPicker(cur); }
      }, l))),
    h('div', { style: { display: 'grid', gap: '8px' } },
      cols.map(c => h('button', {
        class: 'btn btn-ghost btn-block',
        style: c.key === cur.key ? { borderColor: 'var(--accent)', color: 'var(--accent-ink)' } : null,
        onclick: () => { close(); ui.open = c.key; emit(); }
      }, `${c.label} · เต็ม ${c.max}`)),
      h('button', { class: 'btn btn-soft btn-block', onclick: () => { close(); openItemForm(); } }, '+ เพิ่มรายการ'),
      h('div', { class: 'sep' }, 'จัดการชิ้นนี้'),
      h('button', { class: 'btn btn-ghost btn-block', onclick: () => { close(); openItemMenu(cur); } }, '✏️ แก้ไข / รายละเอียด / ลบ'),
      h('button', { class: 'btn btn-ghost btn-block', onclick: () => { close(); openPaste(cur); } }, '📋 วางคะแนนจาก Excel'))
  ));
}

// ── หน้ารายการ ──────────────────────────────────────────────

function listScreen() {
  const S = settings();
  const cols = columnsIn(curBucket().id);
  const b = curBucket();
  const totalMax = cols.reduce((a, c) => a + (c.max || 0), 0);

  return h('div', { class: 'page' },
    bucketBar(false),

    h('div', { class: 'card', style: { display: 'flex', alignItems: 'center', gap: '10px' } },
      h('div', { style: { flex: '1' } },
        h('div', { style: { fontWeight: '700' } }, `${b.label} · ${b.phase === 1 ? 'ก่อนกลางภาค' : 'หลังกลางภาค'}`),
        h('div', { style: { fontSize: '12.5px', color: 'var(--ink-2)' } },
          `${cols.length} รายการ · คะแนนดิบรวม ${totalMax} → เทียบเป็น ${S.weight[curBucket().id]} คะแนน (SGS ${b.sgs})`)),
      h('button', { class: 'btn btn-soft btn-sm', onclick: () => openItemForm() }, '+ เพิ่ม')
    ),

    cols.length === 0
      ? h('div', { class: 'card empty' },
          h('div', { class: 'empty-icon' }, '📝'),
          h('div', null, `ยังไม่มีรายการใน "${b.label}"`),
          h('div', { style: { fontSize: '13px', marginBottom: '12px' } },
            'เพิ่มกี่ชิ้นก็ได้ คะแนนเต็มเท่าไหร่ก็ได้ ระบบเทียบสัดส่วนให้อัตโนมัติ'),
          h('button', { class: 'btn', onclick: () => openItemForm() }, 'เพิ่มรายการแรก'))
      : h('div', { class: 'card card-tight' }, cols.map(itemRow))
  );
}

function tally(col) {
  const vals = state.cls.values[col.key] || {};
  const t = { ok: 0, late: 0, miss: 0, none: 0, total: state.cls.students.length };
  for (const s of state.cls.students) t[parseWork(vals[s.sid]).status]++;
  // งานส่ง: "ตรวจแล้ว" = ดูครบทุกคนแล้ว (รวมคนไม่ส่ง)
  // ข้อสอบ: "สอบแล้ว" = คนที่เข้าสอบจริง ไม่รวมคนที่ยังไม่ได้สอบ
  t.done = isExam(col) ? t.ok : t.total - t.none;
  return t;
}

function itemRow(col) {
  const t = tally(col);
  return h('div', { class: 'list-row' },
    h('button', {
      style: { display: 'flex', alignItems: 'center', gap: '10px', flex: '1', minWidth: '0', textAlign: 'left' },
      onclick: () => { ui.open = col.key; emit(); }
    },
      h('div', { class: 'list-main' },
        h('div', { class: 'list-title' }, col.label),
        col.desc && h('div', {
          class: 'list-sub',
          style: { color: 'var(--ink-3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }
        }, col.desc),
        h('div', { class: 'list-sub' },
          `เต็ม ${col.max} · ${words(col).done} ${t.done}/${t.total}`,
          t.late > 0 ? ` · ส่งช้า ${t.late}` : '',
          t.miss > 0 ? ` · ${words(col).miss} ${t.miss}` : '')),
      t.none === 0
        ? h('span', { class: 'badge g' }, 'ครบ')
        : h('span', { class: 'badge a' }, `ค้าง ${t.none}`)
    ),
    h('button', {
      class: 'icon-btn', style: { color: 'var(--ink-3)' }, title: 'แก้ไข / ลบ',
      onclick: () => openItemMenu(col)
    }, '⋯')
  );
}

// ── หน้ากรอกคะแนน ───────────────────────────────────────────

/** คะแนนที่ได้เมื่อกดปุ่ม "ส่งช้า" (หักตาม % ในหน้าตั้งค่า) */
function lateScore(col) {
  const pct = settings().latePenaltyPct || 0;
  return Math.max(0, Math.round(col.max * (1 - pct / 100) * 100) / 100);
}

const statusBtnsOf = (col) => (isExam(col)
  ? [{ st: 'ok',   label: 'สอบแล้ว',  cls: 'ok',   title: 'สอบแล้ว — กรอกคะแนนที่ได้ในช่องขวา' },
     { st: 'miss', label: 'ยังไม่สอบ', cls: 'miss', title: 'ยังไม่ได้สอบ / ขาดสอบ — คิดเป็น 0 คะแนน' }]
  : [{ st: 'ok',   label: 'ส่ง',    cls: 'ok' },
     { st: 'late', label: 'ช้า',    cls: 'late' },
     { st: 'miss', label: 'ไม่ส่ง', cls: 'miss' }]);

/**
 * แถวกรอกหนึ่งช่อง (นักเรียน 1 คน × ชิ้นงาน 1 ชิ้น)
 * ใช้ร่วมกันทั้งโหมดรายชิ้นงานและรายคน — เขียนค่าแล้วอัปเดตเฉพาะแถวนี้
 * (วาดใหม่ทั้งหน้าแล้วเคอร์เซอร์หลุด และสะดุดตอนกดรัว)
 *
 * @param head โหนดฝั่งซ้ายของแถว ต่างกันตามโหมด (เลขที่+ชื่อ หรือ ชื่องาน+กำหนดส่ง)
 * @param nextInput ฟังก์ชันหาช่องถัดไปตอนกด Enter
 */
function scoreRow(col, s, { head, nextInput } = {}) {
  const W = words(col);
  const cur = parseWork(getCell(col.key, s.sid));

  const inp = h('input', {
    class: 'score-inp' + (cur.status === 'miss' ? ' miss' : (cur.status !== 'none' ? ' filled' : '')),
    type: 'number', inputmode: 'decimal', min: '0', max: String(col.max), step: 'any',
    value: (cur.status === 'ok' || cur.status === 'late') ? String(cur.score) : '',
    placeholder: cur.status === 'miss' ? W.missShort : '',
    onkeydown: (e) => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      const n = nextInput && nextInput();
      if (n) { n.focus(); n.select(); }
    },
    onchange: (e) => {
      let v = e.target.value.trim();
      if (v === '') return apply('none');
      let n = Number(v);
      if (isNaN(n)) { e.target.value = ''; return apply('none'); }
      if (n > col.max) { toast(`เกินคะแนนเต็ม (${col.max})`, 'err'); n = col.max; }
      if (n < 0) n = 0;
      e.target.value = String(n);
      // พิมพ์คะแนนเองแล้วยังคงสถานะ "ส่งช้า" ไว้ถ้าเคยตั้งไว้
      apply(read() === 'late' ? 'late' : 'ok', n);
    }
  });

  const btns = statusBtnsOf(col).map(b => h('button', {
    class: 'st-btn ' + b.cls, 'data-st': b.st, 'data-on': cur.status === b.st ? '1' : '0',
    title: b.title || (b.st === 'late' ? `ส่งช้า (ได้ ${lateScore(col)}/${col.max})` : b.label),
    onclick: () => apply(read() === b.st ? 'none' : b.st)
  }, b.label));

  const group = h('div', { class: 'st-group' }, btns);
  const read = () => (btns.find(b => b.dataset.on === '1') || {}).dataset?.st || 'none';

  function apply(status, score) {
    let sc = score;
    if (status === 'ok'   && sc === undefined) sc = col.max;
    if (status === 'late' && sc === undefined) sc = lateScore(col);
    setCells([{ key: col.key, sid: s.sid, value: formatWork(status, sc) }], { quiet: true });

    btns.forEach(b => { b.dataset.on = (b.dataset.st === status) ? '1' : '0'; });
    inp.value = (status === 'ok' || status === 'late') ? String(sc) : '';
    inp.placeholder = status === 'miss' ? W.missShort : '';
    inp.classList.toggle('miss', status === 'miss');
    inp.classList.toggle('filled', status === 'ok' || status === 'late');
    refreshProgress(col);
  }

  // ฝั่งซ้าย+คะแนนบรรทัดบน · ปุ่มสถานะเต็มความกว้างบรรทัดล่าง
  // (แบบเดิมยัดทุกอย่างบรรทัดเดียว ชื่อนักเรียนเลยถูกบีบจนอ่านไม่ออกบนมือถือ)
  const row = h('div', { class: 'work-row' },
    h('div', { class: 'work-head' },
      head || null,
      h('div', { class: 'score-cell' }, inp, h('span', { class: 'score-max' }, '/' + col.max))),
    group
  );
  row.__input = inp;
  return row;
}

function gradeScreen(col) {
  const students = state.cls.students;
  const rows = [];
  students.forEach((s, i) => {
    rows.push(scoreRow(col, s, {
      head: [h('div', { class: 'stu-no' }, s.no), h('div', { class: 'work-name' }, s.name || '—')],
      nextInput: () => rows[i + 1] && rows[i + 1].__input
    }));
  });

  const W = words(col);
  const b = curBucket();
  const siblings = columnsIn(curBucket().id);

  return h('div', { class: 'page' },

    // ── ถัง (PC) — ดีไซน์วางไว้แถวบนสุด ──
    h('div', { class: 'pc-only-block' }, bucketBar(true)),

    // ── ชิ้นงานในถังนี้ (PC) ──
    h('div', { class: 'item-bar' },
      siblings.map(c => h('button', {
        class: 'item-pill', 'data-on': c.key === col.key ? '1' : '0',
        onclick: () => { ui.open = c.key; emit(); }
      }, `${c.label} · เต็ม ${c.max}`)),
      h('button', { class: 'item-pill add', onclick: () => openItemForm() }, '+ เพิ่มงาน'),
      h('div', { style: { marginLeft: 'auto', display: 'flex', gap: '8px' } },
        h('button', { class: 'btn btn-ghost btn-sm', onclick: () => openPaste(col) }, '📋 วางจาก Excel'),
        h('button', { class: 'icon-btn', title: 'ตัวเลือกเพิ่มเติม', onclick: () => openItemMenu(col) }, '⋯'))
    ),

    // ── หัวเรื่องชิ้นงาน + ความคืบหน้า (PC · มือถืออยู่ในแถบเข้มแล้ว) ──
    h('div', { class: 'ctxbar' },
      h('div', { style: { flex: '1', minWidth: '0' } },
        h('div', { class: 'ctx-title' }, col.label),
        h('div', { class: 'ctx-sub', id: 'grade-progress' }, progressText(col)),
        h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '8px' } },
          h('button', { class: 'tagbtn', onclick: () => openItemForm(col) },
            isExam(col) ? '✎ รายละเอียดการสอบ' : '✎ รายละเอียดงาน'),
          col.desc
            ? h('span', { class: 'tag-on' }, '👁 นักเรียนเห็น')
            : h('span', { class: 'tag-off' }, '👁 ยังไม่มีคำสั่งให้นักเรียนอ่าน')),
        col.desc && h('div', {
          style: { fontSize: '12.5px', color: 'var(--ink-2)', marginTop: '5px', whiteSpace: 'pre-wrap' }
        }, col.desc)),
      modeSeg('seg seg-inline'),
      h('div', { style: { textAlign: 'right', flex: 'none' } },
        h('div', { style: { fontSize: '12.5px', color: 'var(--ink-2)' } }, W.done),
        h('div', { class: 'tnum', id: 'grade-count', style: { fontSize: '19px', fontWeight: '700' } },
          `${tally(col).done} / ${tally(col).total}`)),
      h('div', { style: { width: '180px', flex: 'none' } }, progressBar(col))
    ),

    // ── ปุ่มลัดทั้งห้อง (มือถือ — บน PC อยู่ในเมนู ⋯ ของแถบชิ้นงาน) ──
    h('div', { class: 'card pc-hide', style: { padding: '10px 12px' } },
      h('div', { class: 'btn-row' },
        h('button', {
          class: 'btn btn-soft btn-sm',
          onclick: () => {
            setCells(state.cls.students.map(s => ({ key: col.key, sid: s.sid, value: col.max })));
            toast(W.bulkToast, 'ok', 1400);
          }
        }, `✓ ${W.bulk} (${col.max})`),
        h('button', {
          class: 'btn btn-ghost btn-sm',
          onclick: async () => {
            if (!await confirmBox('ล้างคะแนน?', 'คะแนนของรายการนี้จะถูกลบทั้งห้อง', 'ล้าง')) return;
            setCells(state.cls.students.map(s => ({ key: col.key, sid: s.sid, value: '' })));
          }
        }, '↺ ล้าง')
      )),

    // ── รายชื่อ: มือถือ = การ์ดใบละคน · PC = ตาราง 4 คอลัมน์ ──
    h('div', { class: 'work-list' },
      h('div', { class: 'work-thead' },
        h('div', null, 'เลขที่'), h('div', null, 'ชื่อ-นามสกุล'),
        h('div', null, isExam(col) ? 'สถานะการสอบ' : 'สถานะการส่ง'), h('div', null, 'คะแนน')),
      rows)
  );
}

/**
 * โหมดกรอกทีละคน (ดีไซน์หน้า 03b)
 * เห็นทุกชิ้นในถังของนักเรียนคนเดียว — ใช้ตอนตามเก็บงานค้างรายคน
 */
function studentScreen(col) {
  const cls = state.cls;
  const s = curStudent();
  const cols = columnsIn(curBucket().id);
  const b = curBucket();
  const S = settings();

  // สรุปของถังนี้เฉพาะคนนี้
  let got = 0, max = 0, graded = 0;
  for (const c of cols) {
    const w = parseWork(getCell(c.key, s.sid));
    if (w.status === 'none') { if (S.ungraded === 'zero') max += c.max; continue; }
    graded++; max += c.max;
    if (w.status !== 'miss') got += w.score;
  }
  const bucketScore = max > 0 ? Math.round((S.weight[curBucket().id] * got / max) * 100) / 100 : null;

  const rows = [];
  cols.forEach((c, i) => {
    rows.push(scoreRow(c, s, {
      head: h('div', { style: { flex: '1', minWidth: '0' } },
        h('div', { class: 'work-name', style: { fontSize: '14.5px' } }, c.label),
        h('div', { class: 'stu-sid' }, `เต็ม ${c.max}${c.desc ? ' · ' + c.desc : ''}`)),
      nextInput: () => rows[i + 1] && rows[i + 1].__input
    }));
  });

  const step = (d) => { ui.si = Math.min(cls.students.length - 1, Math.max(0, ui.si + d)); emit(); };

  return h('div', { class: 'page' },

    h('div', { class: 'pc-only-block' }, bucketBar(true)),

    h('div', { class: 'ctxbar' },
      h('div', { style: { flex: '1', minWidth: '0' } },
        h('div', { class: 'ctx-title' }, s.name || '—'),
        h('div', { class: 'ctx-sub' }, `เลขที่ ${s.no}${s.sid ? ' · ' + s.sid : ''} · คนที่ ${ui.si + 1} จาก ${cls.students.length}`)),
      modeSeg('seg seg-inline'),
      h('div', { class: 'ctx-end' },
        h('button', { class: 'btn btn-ghost btn-sm', disabled: ui.si === 0, onclick: () => step(-1) }, '‹'),
        h('button', { class: 'btn btn-ghost btn-sm', disabled: ui.si >= cls.students.length - 1, onclick: () => step(1) }, '›'))),

    // เลือกห้อง แล้วเลือกคน — เลื่อนหาเร็วกว่าพิมพ์ชื่อ โดยเฉพาะบนมือถือ
    h('div', { class: 'pick2row' },
      h('label', { class: 'pickbox' },
        h('span', null, 'ห้อง'),
        h('select', {
          'aria-label': 'เลือกห้องเรียน',
          onchange: async (e) => {
            ui.si = 0;
            await loadClass(e.target.value);
            // คอลัมน์ของห้องเดิมใช้กับห้องใหม่ไม่ได้ ต้องชี้ไปชิ้นแรกของถังเดิมในห้องใหม่
            const first = columnsIn(curBucket().id)[0];
            ui.open = first ? first.key : null;
            emit();
          }
        }, state.classes.map(c => h('option', {
          value: c.classId, selected: c.classId === state.classId
        }, `${[c.grade, c.room].filter(Boolean).join('/')} · ${c.subject}`)))),

      h('label', { class: 'pickbox grow' },
        h('span', null, 'นักเรียน'),
        h('select', {
          'aria-label': 'เลือกนักเรียน',
          onchange: (e) => { ui.si = Number(e.target.value); emit(); }
        }, cls.students.map((x, i) => h('option', {
          value: String(i), selected: i === ui.si
        }, `${x.no}. ${x.name || '—'}`))))
    ),

    // สรุปคะแนนถังนี้ของคนนี้
    h('div', { class: 'card', style: { display: 'flex', alignItems: 'center', gap: '10px' } },
      h('div', { style: { flex: '1' } },
        h('div', { style: { fontSize: '13px', color: 'var(--ink-2)' } },
          `${b.label} · ${b.phase === 1 ? 'ก่อนกลางภาค' : 'หลังกลางภาค'}`),
        h('div', { style: { fontSize: '12px', color: 'var(--ink-3)', marginTop: '1px' } },
          `${words(col).done} ${graded} จาก ${cols.length} ชิ้น`)),
      h('div', { style: { textAlign: 'right' } },
        h('div', { class: 'tnum', style: { fontSize: '19px', fontWeight: '700' } },
          bucketScore === null ? '—' : nf(bucketScore)),
        h('div', { style: { fontSize: '11.5px', color: 'var(--ink-2)' } }, '/' + S.weight[curBucket().id]))),

    h('div', { class: 'work-list by-student' }, rows),

    h('div', { class: 'pager' },
      h('button', { class: 'btn btn-ghost', disabled: ui.si === 0, onclick: () => step(-1) }, '‹'),
      h('button', {
        class: 'btn',
        disabled: ui.si >= cls.students.length - 1,
        onclick: () => step(1)
      }, ui.si < cls.students.length - 1
        ? `คนถัดไป · ${cls.students[ui.si + 1].name || ''} ›`
        : 'คนสุดท้ายแล้ว'))
  );
}

/** แถบสัดส่วน ส่ง/ช้า/ไม่ส่ง — ที่เหลือคือยังไม่ตรวจ (พื้นหลังราง) */
function progressBar(col) {
  const t = tally(col);
  const pct = (n) => (t.total ? (n / t.total) * 100 : 0) + '%';
  const W = words(col);
  return h('div', null,
    h('div', { class: 'prog-track' },
      t.ok   > 0 && h('i', { class: 'prog-seg', style: { width: pct(t.ok),   background: 'var(--st-ok)' } }),
      t.late > 0 && h('i', { class: 'prog-seg', style: { width: pct(t.late), background: 'var(--st-late)' } }),
      t.miss > 0 && h('i', { class: 'prog-seg', style: { width: pct(t.miss), background: 'var(--st-miss)' } })),
    h('div', { class: 'prog-note' },
      [`${isExam(col) ? 'สอบ' : 'ส่ง'} ${t.ok}`,
       t.late ? `ช้า ${t.late}` : null,
       `${W.miss} ${t.miss}`,
       `ยังไม่ตรวจ ${t.none}`].filter(Boolean).join(' · '))
  );
}

function progressText(col) {
  const t = tally(col);
  const vals = state.cls.values[col.key] || {};
  const exam = isExam(col);
  const scored = [];
  for (const s of state.cls.students) {
    const w = parseWork(vals[s.sid]);
    // เฉลี่ยต้องคิดจากคนกลุ่มเดียวกับตัวเลขที่โชว์ข้าง ๆ
    // ข้อสอบ = เฉพาะคนที่เข้าสอบ · งานส่ง = ทุกคนที่ตรวจแล้ว (คนไม่ส่งนับเป็น 0)
    if (exam ? w.status === 'ok' || w.status === 'late' : w.status !== 'none') scored.push(w.score);
  }
  const avg = scored.length ? scored.reduce((a, b) => a + b, 0) / scored.length : 0;
  const W = words(col);
  return `เต็ม ${col.max} · ${W.done} ${t.done}/${t.total}`
    + (t.late ? ` · ช้า ${t.late}` : '')
    + (t.miss ? ` · ${W.miss} ${t.miss}` : '')
    + (scored.length ? ` · เฉลี่ย ${nf(avg, 1)}` : '');
}

/** อัปเดตตัวเลขทุกจุดหลังกดหนึ่งครั้ง แทนการวาดรายชื่อทั้งห้องใหม่ */
function refreshProgress(col) {
  const t = tally(col);
  const el = document.getElementById('grade-progress');
  if (el) el.textContent = progressText(col);

  const cnt = document.getElementById('grade-count');
  if (cnt) cnt.textContent = `${t.done} / ${t.total}`;

  const badge = document.querySelector('.pagehead .ph-badge[data-prog]');
  if (badge) badge.textContent = `${t.done}/${t.total}`;

  const bar = document.querySelector('.ctxbar .prog-track');
  if (bar && bar.parentElement) bar.parentElement.replaceWith(progressBar(col));
}

// ── เพิ่ม / แก้ไขรายการ ─────────────────────────────────────

function openItemForm(edit) {
  const b = curBucket();
  const exam = b.kind !== 'WORK';
  const label = h('input', {
    value: edit?.label || '',
    placeholder: exam ? 'เช่น สอบเก็บคะแนนบทที่ 1' : 'เช่น ใบงานที่ 1 เรื่องเศษส่วน'
  });
  const desc  = h('textarea', {
    rows: 3, value: edit?.desc || '',
    placeholder: exam
      ? 'เช่น สอบบทที่ 1–2 · ปรนัย 20 ข้อ · สอบวันศุกร์ที่ 15 คาบ 3'
      : 'เช่น ทำข้อ 1–10 หน้า 42 ส่งท้ายคาบวันศุกร์ · เขียนมือเท่านั้น'
  });
  const max   = h('input', { type: 'number', min: '1', value: String(edit?.max ?? (b.kind === 'MID' ? 20 : b.kind === 'FIN' ? 30 : 10)) });

  modal((close) => {
    const save = h('button', { class: 'btn btn-block' }, edit ? 'บันทึก' : 'เพิ่มรายการ');
    save.onclick = async () => {
      const l = label.value.trim(), m = Number(max.value), d = desc.value.trim();
      if (!l) return toast('ตั้งชื่อรายการก่อน', 'err');
      if (!(m > 0)) return toast('คะแนนเต็มต้องมากกว่า 0', 'err');
      try {
        if (edit) await updateColumn(edit.key, { label: l, max: m, desc: d });
        else {
          const { key } = ensureColumn({ kind: b.kind, half: b.half, label: l, max: m, desc: d });
          ui.open = key;
        }
        close(); emit();
      } catch (e) { toast(e.message, 'err'); }
    };
    return h('div', null,
      h('h2', null, edit ? 'แก้ไขรายการ' : `เพิ่ม${b.label} · ${b.phase === 1 ? 'ก่อนกลางภาค' : 'หลังกลางภาค'}`),
      h('div', { class: 'field' }, h('label', null, 'ชื่อรายการ *'), label),
      h('div', { class: 'field' }, h('label', null, exam ? 'รายละเอียดการสอบ' : 'รายละเอียดงาน'), desc,
        h('div', { class: 'hint' }, 'เก็บเป็นโน้ตบนหัวคอลัมน์ในชีต เอาเมาส์ชี้ก็เห็น')),
      h('div', { class: 'field' }, h('label', null, 'คะแนนเต็ม (คะแนนดิบ)'), max,
        h('div', { class: 'hint' },
          `ใส่คะแนนเต็มจริงได้เลย ระบบจะเทียบสัดส่วนเป็น ${settings().weight[curBucket().id]} คะแนนของ SGS ให้เอง`)),
      save
    );
  });
}

function openItemMenu(col) {
  const t = tally(col);
  modal((close) => h('div', null,
    h('h2', null, col.label),
    h('div', { class: 'hint', style: { marginBottom: '12px' } },
      `เต็ม ${col.max} · ${words(col).done} ${t.done}/${t.total}`),
    h('div', { style: { display: 'grid', gap: '8px' } },
      h('button', { class: 'btn btn-ghost btn-block', onclick: () => { close(); ui.open = col.key; emit(); } }, '📝 กรอกคะแนน'),
      h('button', { class: 'btn btn-ghost btn-block', onclick: () => { close(); openItemForm(col); } }, '✏️ แก้ไขชื่อ / รายละเอียด / คะแนนเต็ม'),
      h('button', {
        class: 'btn btn-ghost btn-block',
        onclick: () => {
          close();
          setCells(state.cls.students.map(s => ({ key: col.key, sid: s.sid, value: col.max })));
          toast(words(col).bulkToast, 'ok', 1400);
        }
      }, `✓ ${words(col).bulk} (${col.max})`),
      h('button', {
        class: 'btn btn-ghost btn-block',
        onclick: async () => {
          close();
          if (!await confirmBox('ล้างคะแนน?', 'คะแนนของรายการนี้จะถูกลบทั้งห้อง', 'ล้าง')) return;
          setCells(state.cls.students.map(s => ({ key: col.key, sid: s.sid, value: '' })));
        }
      }, '↺ ล้างคะแนนทั้งรายการ'),
      h('button', {
        class: 'btn btn-danger btn-block',
        onclick: async () => {
          close();
          if (!await confirmBox('ลบรายการนี้?', `“${col.label}” และคะแนนทั้งหมดจะถูกลบ`, 'ลบ')) return;
          ui.open = null;
          await deleteColumn(col.key);
          toast('ลบแล้ว', 'ok');
        }
      }, '🗑 ลบรายการ')
    )
  ));
}

/** วางคะแนนทั้งคอลัมน์จาก Excel — เรียงตามลำดับเลขที่ในรายชื่อ */
function openPaste(col) {
  const exam = isExam(col);
  const ta = h('textarea', {
    rows: 10, placeholder: exam ? '18\n20\nx\n15.5\n…' : '8\n10\nx\nL7\n7.5\n…',
    style: { fontFamily: 'ui-monospace, monospace' }
  });
  modal((close) => {
    const save = h('button', { class: 'btn btn-block' }, 'นำเข้าคะแนน');
    save.onclick = () => {
      const lines = ta.value.split(/\r?\n/).map(s => s.trim());
      const cells = [];
      state.cls.students.forEach((s, i) => {
        if (i >= lines.length) return;
        const raw = lines[i];
        if (raw === '' || raw === '-') { cells.push({ key: col.key, sid: s.sid, value: '' }); return; }
        if (/^x$|^ไม่ส่ง$|^ขาดสอบ$|^ไม่ได้สอบ$/i.test(raw)) { cells.push({ key: col.key, sid: s.sid, value: NOT_SUBMITTED }); return; }
        const late = /^(l|ช้า)/i.test(raw);
        const n = Number(raw.replace(/^(l|ช้า)\s*/i, ''));
        if (isNaN(n)) return;
        const clamped = Math.max(0, Math.min(col.max, n));
        cells.push({ key: col.key, sid: s.sid, value: formatWork(late ? 'late' : 'ok', clamped) });
      });
      setCells(cells);
      toast(`นำเข้า ${cells.length} รายการ`, 'ok');
      close();
    };
    return h('div', null,
      h('h2', null, 'วางคะแนนจาก Excel'),
      h('div', { class: 'hint', style: { marginBottom: '8px' } },
        `เรียงตามลำดับเลขที่ในรายชื่อ (${state.cls.students.length} คน)`,
        h('br'),
        exam
          ? ['ตัวเลข = คะแนนที่สอบได้ · ', h('code', null, 'x'), ' = ยังไม่ได้สอบ · เว้นว่าง = ยังไม่กรอก']
          : ['ตัวเลข = ส่ง · ', h('code', null, 'L7'), ' = ส่งช้าได้ 7 · ',
             h('code', null, 'x'), ' = ไม่ส่ง · เว้นว่าง = ยังไม่ตรวจ']),
      ta, h('div', { style: { height: '10px' } }), save
    );
  });
}
