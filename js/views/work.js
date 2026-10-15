/* หน้ากรอกงานและคะแนนสอบ (ส่งงาน · สอบเก็บคะแนน · กลางภาค · ปลายภาค) */

import { h, modal, toast, confirmBox, nf, matchStudent } from '../dom.js';
import { icon, withIcon } from '../icons.js';
import { openCopyList } from './chase.js';
import { undoAction, classSelect, loadingPage } from './common.js';
import { state, emit, loadClass, ensureColumn, setCells, getCell, deleteColumn, updateColumn, settings, addColumnToMany } from '../state.js';
import { BUCKETS, NOT_SUBMITTED, RETAKE_KINDS, parseWork, formatWork, formatRetake, passMarkOf, passOf, blankMissCols, effectiveRaw } from '../score.js';
import { serverInfo } from '../api.js';
import { serverSupports } from '../version.js';

/**
 * ดีไซน์แยก "ชนิดของคะแนน" กับ "ช่วง" ออกจากกัน (หน้า 03)
 * แถวบนเลือกชนิด 4 อย่าง · มุมขวาเลือกช่วง ก่อน/หลังกลางภาค
 * รวมกันได้ 8 ถัง เท่ากับ 8 ช่องของ SGS เหมือนเดิม
 * กลางภาค/ปลายภาคมีช่วงเดียว จึงบังคับช่วงให้เอง
 */
/* ic = ไอคอนเส้นใน js/icons.js (ชุดเดียวกับแถบเมนู)
 * ของเดิมใช้อีโมจิบนปุ่ม ซึ่งแต่ละเครื่องวาดไม่เหมือนกันและไม่เข้ากับไอคอนส่วนอื่นของแอป */
const KINDS = [
  { kind: 'WORK', ic: 'doc',    label: 'ส่งงาน' },
  { kind: 'QUIZ', ic: 'pencil', label: 'สอบเก็บ' },
  { kind: 'MID',  ic: 'exam',   label: 'กลางภาค', fixed: 1 },
  { kind: 'FIN',  ic: 'flag',   label: 'ปลายภาค', fixed: 2 }
];

const ui = {
  kind: 'WORK',      // ชนิดคะแนนที่เลือกอยู่
  phase: 1,          // ช่วง 1 = ก่อนกลางภาค · 2 = หลังกลางภาค
  open: null,        // key ของชิ้นงานที่กำลังกรอก (โหมดรายชิ้นงาน)
  by: 'item',        // 'item' = กรอกทีละชิ้นงาน · 'student' = กรอกทีละคน
  si: 0,             // ลำดับนักเรียนในโหมดรายคน
  q: ''              // คำค้น "ไปที่เลขที่/ชื่อ" ในหน้ากรอก
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
 * กลางภาค/ปลายภาคสอบครั้งเดียว — ไม่ต้องให้ครูกด "เพิ่มรายการ" เอง
 * รหัสคงที่ (MID|1|mid · FIN|2|fin) ทุกเครื่องจึงชี้ช่องเดียวกัน
 * เปิดพร้อมกัน 2 เครื่องก็ไม่เกิดช่องซ้ำ (ฝั่งชีตเจอรหัสเดิมจะแก้ช่องเดิม ไม่เพิ่มใหม่)
 */
const FIXED_EXAM = {
  MID: { id: 'mid', label: 'สอบกลางภาค', max: 20 },
  FIN: { id: 'fin', label: 'สอบปลายภาค', max: 30 }
};
const isFixedKind = (kind) => !!kindOf(kind).fixed;

/**
 * เปิดช่องสอบกลาง/ปลายภาคของห้องนี้ — ยังไม่มีก็สร้างให้เลย
 * คะแนนเต็มตั้งเท่าน้ำหนักใน SGS กรอกคะแนนที่สอบได้ลงไปตรง ๆ ไม่ต้องเทียบสัดส่วน
 * (แก้คะแนนเต็มทีหลังได้จากเมนู ⋯ ถ้าข้อสอบจริงเต็มไม่เท่านี้)
 */
function openFixedExam() {
  const b = curBucket();
  const have = columnsIn(b.id)[0];
  if (have) { ui.open = have.key; return; }
  const f = FIXED_EXAM[b.kind];
  const max = Number(settings().weight[b.id]) || f.max;
  ui.open = ensureColumn({ kind: b.kind, half: b.half, id: f.id, label: f.label, max }, { quiet: true }).key;
}

/**
 * ข้อสอบ (สอบเก็บคะแนน / กลางภาค / ปลายภาค) ใช้คำต่างจากงานส่ง
 * และไม่มีสถานะ "ส่งช้า" — สอบแล้วก็คือสอบแล้ว
 */
const isExam = (col) => col && col.kind !== 'WORK';

const words = (col) => (isExam(col)
  ? { done: 'สอบแล้ว', miss: 'ยังไม่ได้สอบ', missShort: 'ยังไม่สอบ',
      bulk: 'ให้เต็มทุกคน', bulkToast: 'ให้คะแนนเต็มทั้งห้อง',
      fill: 'ให้เต็ม', fillToast: 'ให้คะแนนเต็ม', over: 'ให้เต็มทุกคน ทับคะแนนเดิม' }
  : { done: 'ส่งแล้ว', miss: 'ไม่ส่ง', missShort: 'ไม่ส่ง',
      bulk: 'ส่งครบทุกคน', bulkToast: 'ให้ "ส่ง" เต็มทั้งห้อง',
      fill: 'ให้ส่งครบ', fillToast: 'ให้ "ส่ง" เต็ม', over: 'ให้ส่งครบทุกคน ทับคะแนนเดิม' });

/* ── ปุ่มลัดทั้งห้อง ──────────────────────────────────────────
 * เติมคะแนนเต็มเฉพาะคนที่ยังว่าง ไม่แตะช่องที่ครูกรอกไว้แล้ว
 * ของเดิมเขียนเต็มทับทุกคน — ใบงานที่ตรวจไปแล้ว 18 คนถูกทับหมดในแตะเดียว
 * เหลือแค่ปุ่มเลิกทำใน toast ไม่กี่วินาที ขณะที่ปุ่ม "ล้าง" ข้าง ๆ ยังถามยืนยัน
 * ช่อง x / ยังไม่สอบ ที่ครูกดไว้เองไม่นับว่าว่าง
 * "ทับทุกคน" ยังทำได้จากเมนู ⋯ แต่ต้องยืนยันก่อน และไม่แตะช่องสอบซ่อม (เก็บคะแนนเดิมไว้ในช่อง) */
function blankSids(col) {
  const vals = state.cls.values[col.key] || {};
  return state.cls.students.filter(s => parseWork(vals[s.sid]).status === 'none').map(s => s.sid);
}

function overwriteSids(col) {
  const vals = state.cls.values[col.key] || {};
  return state.cls.students.filter(s => {
    const w = parseWork(vals[s.sid]);
    return w.status !== 'none' && !w.retake && String(vals[s.sid]).trim() !== String(col.max);
  }).map(s => s.sid);
}

/** ทุกคนยังว่าง = ปุ่มเดิม "ส่งครบทุกคน (10)" · ตรวจไปบ้างแล้ว = บอกจำนวนที่จะเติมจริง
 * ใช้คำว่า "ยังว่าง" ไม่ใช่ "ที่เหลือ" — คนที่ครูกดไม่ส่ง (x) ไว้เองนับอยู่ใน "ยังไม่ส่ง" แต่ปุ่มนี้ไม่แตะ */
const fillLabel = (col, n) => (n >= state.cls.students.length
  ? `${words(col).bulk} (${col.max})`
  : `ยังว่าง ${n} คน · ${words(col).fill}`);

function fillBlanks(col) {
  const sids = blankSids(col);
  if (!sids.length) return;
  const W = words(col);
  setCells(sids.map(sid => ({ key: col.key, sid, value: col.max })));
  toast(sids.length >= state.cls.students.length ? W.bulkToast : `${W.fillToast} ${sids.length} คนที่ยังว่าง`,
    'ok', 1400, undoAction());
}

async function fillAll(col) {
  const over = overwriteSids(col);
  if (!over.length) return fillBlanks(col);
  const W = words(col);
  const blank = blankSids(col);
  if (!await confirmBox(`${W.over}?`,
    `คะแนนที่กรอกไว้แล้ว ${over.length} คนจะถูกเปลี่ยนเป็น ${col.max} เต็ม`
    + (blank.length ? ` · ถ้าแค่อยากเติม ${blank.length} คนที่ยังว่าง ใช้ปุ่ม "ยังว่าง ${blank.length} คน · ${W.fill}" แทน` : ''),
    'ทับทั้งหมด')) return;
  setCells([...blank, ...over].map(sid => ({ key: col.key, sid, value: col.max })));
  toast(`${W.bulkToast} · ทับ ${over.length} คน`, 'ok', 1400, undoAction());
}

function columnsIn(bucketId) {
  const b = bucketOf(bucketId);
  return (state.cls?.columns || [])
    .filter(c => c.kind === b.kind && c.half === b.half)
    .sort((a, b2) => String(a.id).localeCompare(String(b2.id)));
}

export function viewWork() {
  const cls = state.cls;
  if (!cls) {
    return state.loadingClass ? loadingPage() : h('div', { class: 'page empty' }, 'ยังไม่ได้เลือกห้องเรียน');
  }
  if (!cls.students.length) {
    return h('div', { class: 'page' }, h('div', { class: 'card empty' },
      h('div', { class: 'empty-icon' }, icon('users')), 'ห้องนี้ยังไม่มีรายชื่อนักเรียน'));
  }
  const col = openCol();
  if (!col) return listScreen();
  return ui.by === 'student' ? studentScreen(col) : gradeScreen(col);
}

/** หน้าย่อย = ชิ้นงานที่เปิดกรอกอยู่ — ปุ่มย้อนกลับของเครื่องพากลับรายการงาน (ดู syncRoute ใน app.js) */
viewWork.route = {
  get: () => (ui.open ? 'i/' + ui.open : ''),
  set: (sub) => { ui.open = sub.startsWith('i/') ? sub.slice(2) : null; }
};

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
  const s = curStudent();
  const byStudent = ui.by === 'student';

  /* แถบหัวเหลือ 2 แถว: ชื่อ + สลับรายชิ้นงาน/รายคน (ผู้ใช้ใช้ทั้งคู่ รายคนบ่อยกว่า — ต้องเห็นตลอด)
   *  · เลือกชิ้นงาน = แตะที่ชื่อชิ้นงาน — เดิมเป็นกล่องอีกแถวที่เขียนชื่อชิ้นงานซ้ำกับแถวบน
   *  · ⋯ = เมนูของชิ้นนี้ (ให้เต็มที่ยังว่าง · ตามงาน · วางจาก Excel · ล้าง · แก้ไข · ลบ)
   *    แทนการ์ดปุ่มลัด 3 ปุ่มที่เคยคั่นระหว่างแถบหัวกับรายชื่อ (สูง 116px เพราะตัดเป็น 2 บรรทัด) */
  return h('header', { class: 'pagehead' },
    h('div', { class: 'ph-row' },
      h('button', { class: 'ph-back', 'aria-label': 'กลับ', onclick: () => { ui.open = null; emit(); } }, icon('back')),
      h('div', { class: 'ph-grow' },
        byStudent
          ? h('div', { class: 'ph-title' }, s.name || '—')
          : h('button', {
              class: 'ph-title ph-title-pick', 'aria-haspopup': 'dialog',
              'aria-label': `${col.label} · เปลี่ยนชิ้นงาน`, onclick: () => openItemPicker(col)
            }, h('span', null, col.label), icon('down', 'ico ico-sm')),
        h('div', { class: 'ph-sub' }, byStudent
          ? `เลขที่ ${s.no}${s.sid ? ' · ' + s.sid : ''} · ${[cls.meta.grade, cls.meta.room].filter(Boolean).join('/')}`
          // คะแนนเต็มขึ้นก่อน — แถบแคบลงเพราะมีปุ่ม ⋯ ถ้าถูกตัดท้ายต้องเหลือเลขที่ใช้กรอกจริง
          : `เต็ม ${col.max} · ${b ? b.label : ''} · ${col.half === 1 ? 'ก่อนกลางภาค' : 'หลังกลางภาค'}`)),
      h('div', { class: 'ph-badge', 'data-prog': '1' },
        byStudent ? `${ui.si + 1}/${cls.students.length}` : `${t.done}/${t.total}`),
      !byStudent && h('button', {
        class: 'ph-back', 'aria-label': 'ตัวเลือกของชิ้นนี้', onclick: () => openItemMenu(col)
      }, icon('more'))
    ),
    modeSeg('ph-seg')
  );
};

/**
 * แถวเลือกชนิดคะแนน + ช่วง (ดีไซน์หน้า 03 แถวบนสุด)
 *
 * กดแท็บไหน = ไปหน้าภาพรวมของถังนั้นเสมอ (รายการชิ้นงาน / สรุปการสอบ) แล้วค่อยเลือกกรอก
 * เดิมแท็บกลางภาค/ปลายภาคเด้งเข้าหน้ากรอกคะแนนทันที และในหน้ากรอก แท็บอื่นก็พาไปกรอกชิ้นแรกเลย
 * ครูแค่อยากดูภาพรวมก็โดนพาไปหน้ากรอก ต้องกดย้อนกลับเอง
 */
function bucketBar() {
  const S = settings();
  const fixed = kindOf(ui.kind).fixed;

  const jump = () => { ui.open = null; emit(); };

  // ถังคะแนนมี 4 อันตายตัว จึงวางเป็นตาราง 4 ช่องเท่ากันให้เห็นครบในครั้งเดียว
  // ของเดิมเป็นแถวเลื่อนแนวนอน ซึ่งตัดคำว่า "กลางภาค" ทิ้งไว้ที่ขอบจอ
  // และไม่มีอะไรบอกว่าเลื่อนได้ ครูจึงไม่รู้ว่ามีถังที่ 4 อยู่
  return h('div', { class: 'kind-bar' },
    h('div', { class: 'kind-grid' }, KINDS.map(k => {
      const b = BUCKETS.find(x => x.kind === k.kind && x.half === (k.fixed || ui.phase));
      const w = b ? S.weight[b.id] : 0;
      return h('button', {
        class: 'kind-cell', 'data-on': ui.kind === k.kind ? '1' : '0',
        'aria-label': `${k.label} · ${w} คะแนน`, title: `${k.label} · คิดเป็น ${w} คะแนนจาก 100`,
        onclick: () => { ui.kind = k.kind; jump(); }
      },
        h('span', { class: 'kc-ic' }, icon(k.ic)),
        h('span', { class: 'kc-label' }, k.label),
        h('span', { class: 'kc-w' }, b ? S.weight[b.id] : 0));
    })),

    // ช่วงมีแค่ 2 ตัวเลือก — ปุ่มคู่อ่านง่ายและกดได้เร็วกว่า select
    // ถังกลางภาค/ปลายภาคผูกช่วงไว้ตายตัวอยู่แล้ว จึงหรี่ลงและกดไม่ได้
    h('div', { class: 'phase-seg', 'data-off': fixed ? '1' : '0' },
      h('span', { class: 'ps-label' }, 'ช่วง'),
      h('div', { class: 'ps-btns', role: 'group', 'aria-label': 'ช่วงคะแนน' },
        [[1, 'ก่อนกลางภาค'], [2, 'หลังกลางภาค']].map(([v, label]) => h('button', {
          'data-on': curPhase() === v ? '1' : '0',
          disabled: !!fixed,
          'aria-pressed': curPhase() === v ? 'true' : 'false',
          onclick: () => { if (fixed) return; ui.phase = v; jump(); }
        }, label))))
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
        onclick: () => {
          ui.kind = k.kind; close();
          if (k.fixed) { openFixedExam(); emit(); return; }
          openItemPicker(cur);
        }
      }, icon(k.ic), k.label))),
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
      !isFixedKind(ui.kind) &&
        h('button', { class: 'btn btn-soft btn-block', onclick: () => { close(); openItemForm(); } }, '+ เพิ่มรายการ'),
      h('div', { class: 'sep' }, 'จัดการชิ้นนี้'),
      h('button', { class: 'btn btn-ghost btn-block', onclick: () => { close(); openItemMenu(cur); } }, withIcon('edit', 'แก้ไข / รายละเอียด / ลบ')),
      h('button', { class: 'btn btn-ghost btn-block', onclick: () => { close(); openPaste(cur); } }, withIcon('paste', 'วางคะแนนจาก Excel')))
  ));
}

// ── หน้ารายการ ──────────────────────────────────────────────

function listScreen() {
  const S = settings();
  const cols = columnsIn(curBucket().id);
  const b = curBucket();
  const totalMax = cols.reduce((a, c) => a + (c.max || 0), 0);

  // กลางภาค/ปลายภาค: สอบครั้งเดียว ไม่มีปุ่มเพิ่ม · ยังไม่มีช่องก็กดกรอกได้เลย (สร้างให้ตอนกด)
  if (isFixedKind(b.kind)) {
    return h('div', { class: 'page' },
      bucketBar(),
      h('div', { class: 'card' },
        h('div', { style: { fontWeight: '700' } }, b.label),
        h('div', { style: { fontSize: 'var(--fs-sm)', color: 'var(--ink-2)' } },
          `สอบครั้งเดียว · คิดเป็น ${S.weight[b.id]} คะแนนใน SGS ${b.sgs}`)),
      cols.length
        ? h('div', { class: 'card card-tight' }, cols.map(itemRow))
        : h('div', { class: 'card empty' },
            h('div', { class: 'empty-icon' }, icon(kindOf(b.kind).ic)),
            h('div', null, `ยังไม่ได้กรอกคะแนน${b.label}`),
            h('button', {
              class: 'btn', style: { marginTop: '12px' },
              onclick: () => { openFixedExam(); emit(); }
            }, 'กรอกคะแนน'))
    );
  }

  return h('div', { class: 'page' },
    bucketBar(),

    h('div', { class: 'card', style: { display: 'flex', alignItems: 'center', gap: '10px' } },
      h('div', { style: { flex: '1' } },
        h('div', { style: { fontWeight: '700' } }, `${b.label} · ${b.phase === 1 ? 'ก่อนกลางภาค' : 'หลังกลางภาค'}`),
        h('div', { style: { fontSize: 'var(--fs-sm)', color: 'var(--ink-2)' } },
          `${cols.length} รายการ · รวม ${totalMax} คะแนน · คิดเป็น ${S.weight[curBucket().id]} คะแนนใน SGS ${b.sgs}`)),
      h('button', { class: 'btn btn-soft btn-sm', onclick: () => openItemForm() }, withIcon('plus', 'เพิ่ม'))
    ),

    cols.length === 0
      ? h('div', { class: 'card empty' },
          h('div', { class: 'empty-icon' }, icon('doc')),
          h('div', null, `ยังไม่มีรายการใน "${b.label}"`),
          h('div', { style: { fontSize: 'var(--fs-sm)', marginBottom: '12px' } },
            'เพิ่มกี่ชิ้นก็ได้ คะแนนเต็มเท่าไหร่ก็ได้ ระบบเทียบสัดส่วนให้อัตโนมัติ'),
          h('button', { class: 'btn', onclick: () => openItemForm() }, 'เพิ่มรายการแรก'))
      : h('div', { class: 'card card-tight' }, cols.map(itemRow))
  );
}

function tally(col) {
  const vals = state.cls.values[col.key] || {};
  const t = { ok: 0, late: 0, miss: 0, none: 0, retake: 0, total: state.cls.students.length };
  for (const s of state.cls.students) {
    const w = parseWork(vals[s.sid]);
    t[w.status]++;
    if (w.retake) t.retake++;     // นับรวมใน ok ด้วย (สอบแล้ว) — ตัวนี้แค่บอกว่ามีกี่คนที่มาจากสอบซ่อม
  }
  /* ตัวนับเดียวที่ทุกจุดในหน้านี้ใช้ — แถบหัว · รายการชิ้นงาน · แถบความคืบหน้า · ป้ายค้าง
   * งานส่ง: done = ส่งแล้ว (ส่ง + ช้า) · left = ยังไม่ส่ง (ช่องว่าง + x ที่เคยกดไว้ก่อนเลิกมีปุ่มไม่ส่ง)
   * ข้อสอบ: done = คนที่เข้าสอบจริง · left = ยังไม่ได้กรอก (คนขาดสอบนับแยกใน miss) */
  t.done = isExam(col) ? t.ok : t.ok + t.late;
  t.left = isExam(col) ? t.none : t.none + t.miss;
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
          isExam(col) && t.miss > 0 ? ` · ${words(col).miss} ${t.miss}` : '',
          t.retake > 0 ? ` · สอบซ่อม ${t.retake}` : ''),
        // ความคืบหน้าแบบเห็นปราดเดียว — ตัวเลข 18/20 ต้องอ่าน แถบไม่ต้อง
        h('div', { class: 'mini-prog', 'aria-hidden': 'true' },
          h('i', { style: { width: (t.total ? Math.round((t.total - t.left) / t.total * 100) : 0) + '%' } }))),
      t.left === 0
        ? h('span', { class: 'badge g' }, 'ครบ')
        // งานที่ยังไม่ได้ตรวจของใครเลย ยังไม่นับใครเป็นไม่ส่ง (ตรงกับ blankMissCols ใน score.js)
        : !isExam(col) && t.none === t.total
          ? h('span', { class: 'badge a' }, 'ยังไม่ตรวจ')
          : h('span', { class: 'badge a' }, `${isExam(col) ? 'ค้าง' : 'ยังไม่ส่ง'} ${t.left}`)
    ),
    h('button', {
      class: 'icon-btn', style: { color: 'var(--ink-3)' }, title: 'แก้ไข / ลบ', 'aria-label': 'แก้ไข / ลบ',
      onclick: () => openItemMenu(col)
    }, icon('more'))
  );
}

// ── หน้ากรอกคะแนน ───────────────────────────────────────────

/** คะแนนที่ได้เมื่อกดปุ่ม "ส่งช้า" (หักตาม % ในหน้าตั้งค่า) */
function lateScore(col) {
  const pct = settings().latePenaltyPct || 0;
  return Math.max(0, Math.round(col.max * (1 - pct / 100) * 100) / 100);
}

/** ประเภทที่มีปุ่มสอบซ่อม (ดู RETAKE_KINDS ใน js/score.js) */
const canRetake = (col) => !!col && RETAKE_KINDS.includes(col.kind);

/** คะแนนครั้งแรกของช่องสอบซ่อม ในรูปที่อ่านรู้เรื่อง */
const origText = (w) => (w.orig === null ? 'ขาดสอบ' : nf(w.orig));

/** หน้าปุ่มสอบซ่อม — ตอนเปิดอยู่ต้องเห็นคะแนนเดิมบนปุ่มเลย ไม่ต้องกดเข้าไปดู */
const retakeFace = (w) => (w.retake
  ? [h('span', null, 'ซ่อมแล้ว'), h('small', null, 'เดิม ' + origText(w))]
  : ['สอบซ่อม']);

const statusBtnsOf = (col) => (isExam(col)
  ? [{ st: 'ok',   label: 'สอบแล้ว',  cls: 'ok',   title: 'สอบแล้ว — กรอกคะแนนที่ได้ในช่องขวา' },
     { st: 'miss', label: 'ยังไม่สอบ', cls: 'miss', title: 'ยังไม่ได้สอบ / ขาดสอบ — คิดเป็น 0 คะแนน' },
     ...(canRetake(col)
       ? [{ st: 'retake', label: 'สอบซ่อม', cls: 'retake', title: 'บันทึกคะแนนสอบซ่อม — ระบบเก็บคะแนนครั้งแรกไว้ให้ด้วย' }]
       : [])]
  /* งานส่งไม่มีปุ่ม "ไม่ส่ง" — ยังไม่ส่งก็คือยังไม่ได้เช็ค (ช่องว่าง) ไม่ต้องกดอะไร
   * ช่อง x ที่เคยกดไว้ก่อนหน้ายังอ่านได้ตามเดิม (ช่องคะแนนขึ้น "ไม่ส่ง" สีแดง) */
  : [{ st: 'ok',   label: 'ส่ง',    cls: 'ok' },
     { st: 'late', label: 'ช้า',    cls: 'late' }]);

/**
 * แถวกรอกหนึ่งช่อง (นักเรียน 1 คน × ชิ้นงาน 1 ชิ้น)
 * ใช้ร่วมกันทั้งโหมดรายชิ้นงานและรายคน — เขียนค่าแล้วอัปเดตเฉพาะแถวนี้
 * (วาดใหม่ทั้งหน้าแล้วเคอร์เซอร์หลุด และสะดุดตอนกดรัว)
 *
 * @param head โหนดฝั่งซ้ายของแถว ต่างกันตามโหมด (เลขที่+ชื่อ หรือ ชื่องาน+กำหนดส่ง)
 * @param nextInput ฟังก์ชันหาช่องถัดไปตอนกด Enter
 * @param prevInput ฟังก์ชันหาช่องก่อนหน้าตอนกด Shift+Enter
 */
function scoreRow(col, s, { head, nextInput, prevInput } = {}) {
  const W = words(col);

  /* ค่าที่ใช้ไม่ได้ (เกินเต็ม · ติดลบ · ไม่ใช่ตัวเลข) = ไม่บันทึก ช่องแดงค้างพร้อมบอกเหตุใต้แถว
   * เดิมเกินเต็มถูกปัดเป็นคะแนนเต็มเงียบ ๆ (มีแค่ toast) — พิมพ์ 77 แทน 7 ในงานเต็ม 10
   * นักเรียนได้ 10 ไปเลย · มือถือจอแคบซ่อน "/เต็ม" ไว้ด้วย ครูไม่ทันเห็น
   * และพิมพ์ตัวอักษรพลาดเคยล้างคะแนนเดิมทิ้ง */
  const norm = (v) => String(v).trim().replace(',', '.');   // แป้นบางเครื่องให้จุลภาคแทนจุดทศนิยม
  const problem = (v) => {
    if (v === '') return '';
    const n = Number(v);
    if (!isFinite(n)) return `พิมพ์ได้เฉพาะตัวเลข 0–${col.max} — ยังไม่ได้บันทึก`;
    if (n > col.max) return `เกินคะแนนเต็ม ${col.max} — ยังไม่ได้บันทึก`;
    if (n < 0) return 'คะแนนติดลบไม่ได้ — ยังไม่ได้บันทึก';
    return '';
  };
  const errEl = h('div', { class: 'score-err', role: 'alert', hidden: true });
  const showErr = (msg) => {
    errEl.textContent = msg;
    errEl.hidden = !msg;
    inp.classList.toggle('bad', !!msg);
    if (msg) inp.setAttribute('aria-invalid', 'true'); else inp.removeAttribute('aria-invalid');
  };

  // ต่ำกว่าเกณฑ์ผ่าน = ขึ้นสีแดงทันทีตอนกรอก ครูจะได้เห็นว่าใครต้องซ่อมโดยไม่ต้องไปเปิดรายงาน
  const mark = passMarkOf(col, settings());

  // ค่า · สี · ปุ่มที่ติด ตั้งใน paint() ที่เดียวท้ายฟังก์ชัน (ทั้งตอนสร้างและหลังแก้ทุกครั้ง)
  const inp = h('input', {
    class: 'score-inp',
    type: 'text', inputmode: 'decimal', autocomplete: 'off', enterkeyhint: 'next',
    'aria-label': `คะแนน ${s.name || 'เลขที่ ' + s.no} · ${col.label} (เต็ม ${col.max})`,
    onkeydown: (e) => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      // ค่าผิดอยู่ = ไม่ให้ข้ามไปช่องอื่น (ข้ามไปแล้วจะลืมว่าแถวนี้ยังไม่ได้บันทึก)
      const msg = problem(norm(inp.value));
      if (msg) { showErr(msg); inp.select(); return; }
      const n = e.shiftKey ? (prevInput && prevInput()) : (nextInput && nextInput());
      if (n) { n.focus(); n.select(); }
    },
    oninput: () => { if (inp.classList.contains('bad') && !problem(norm(inp.value))) showErr(''); },
    onchange: (e) => {
      const v = norm(e.target.value);
      if (v === '') { showErr(''); return apply('none'); }
      const msg = problem(v);
      if (msg) return showErr(msg);
      showErr('');
      const n = Number(v);
      e.target.value = String(n);
      const now = parseWork(getCell(col.key, s.sid));
      // ช่องที่เป็นสอบซ่อม: พิมพ์แก้ = แก้คะแนนซ่อม คะแนนครั้งแรกต้องอยู่ที่เดิม
      if (now.retake) return write(formatRetake(n, now.orig));
      // พิมพ์คะแนนเองแล้วยังคงสถานะ "ส่งช้า" ไว้ถ้าเคยตั้งไว้
      apply(now.status === 'late' ? 'late' : 'ok', n);
    }
  });

  const btns = statusBtnsOf(col).map(b => h('button', {
    class: 'st-btn ' + b.cls, 'data-st': b.st,
    title: b.title || (b.st === 'late' ? `ส่งช้า (ได้ ${lateScore(col)}/${col.max})` : b.label),
    onclick: () => {
      const now = parseWork(getCell(col.key, s.sid));
      /* ช่องที่ซ่อมแล้ว กดปุ่มไหนก็เปิดกล่องสอบซ่อม ไม่เขียนทับทันที
       * กด "สอบแล้ว" พลาดทีเดียว คะแนนครั้งแรกกับคะแนนซ่อมจะหายพร้อมกัน
       * (ในกล่องมีปุ่มยกเลิกสอบซ่อมให้อยู่แล้ว ถ้าตั้งใจจะเอาออกจริง) */
      if (b.st === 'retake' || now.retake) return openRetake(col, s, paint);
      apply(now.status === b.st ? 'none' : b.st);
    }
  }, b.label));

  const group = h('div', { class: 'st-group' }, btns);

  function write(value) {
    setCells([{ key: col.key, sid: s.sid, value }], { quiet: true });
    paint();
    refreshProgress(col);
  }

  function apply(status, score) {
    let sc = score;
    if (status === 'ok'   && sc === undefined) sc = col.max;
    if (status === 'late' && sc === undefined) sc = lateScore(col);
    write(formatWork(status, sc));
  }

  /** วาดแถวนี้ให้ตรงกับค่าในช่องตอนนี้ — อ่านจาก state ทุกครั้ง ไม่จำสถานะไว้ในปุ่ม */
  function paint() {
    const raw = getCell(col.key, s.sid);
    const w = parseWork(raw);
    const st = w.retake ? 'retake' : w.status;
    const scored = w.status === 'ok' || w.status === 'late';
    btns.forEach(b => {
      b.dataset.on = b.dataset.st === st ? '1' : '0';
      b.setAttribute('aria-pressed', b.dataset.on === '1' ? 'true' : 'false');   // โปรแกรมอ่านจอรู้ว่าปุ่มไหนติดอยู่
      if (b.dataset.st === 'retake') b.replaceChildren(...retakeFace(w));
    });
    inp.value = scored ? String(w.score) : '';
    inp.placeholder = w.status === 'miss' ? W.missShort : '';
    inp.title = w.retake ? `คะแนนสอบซ่อม · ครั้งแรก ${origText(w)}` : '';
    inp.classList.toggle('miss', w.status === 'miss');
    inp.classList.toggle('filled', scored);
    inp.classList.toggle('retake', !!w.retake);
    inp.classList.toggle('below', passOf(col, raw, settings()) === false);
    showErr('');
  }

  // มือถือ: ฝั่งซ้าย+คะแนนบรรทัดบน · ปุ่มสถานะบรรทัดล่าง (ข้อสอบ 3 ปุ่มวางบรรทัดเดียวไม่พอ)
  // งานส่งเหลือ 2 ปุ่ม CSS จัดขึ้นบรรทัดเดียวกับชื่อให้ (.work-list.st2) · PC เป็นตาราง 4 คอลัมน์
  const row = h('div', { class: 'work-row', 'data-sid': s.sid },
    h('div', { class: 'work-head' },
      head || null,
      h('div', { class: 'score-cell' }, inp,
        h('span', { class: 'score-max', title: mark === null ? null : `ผ่านที่ ${mark}` },
          '/' + col.max + (mark === null ? '' : ` · ผ่าน ${mark}`)))),
    group,
    errEl
  );
  paint();
  row.__input = inp;
  return row;
}

/**
 * กล่องบันทึกคะแนนสอบซ่อม
 *
 * ช่องคะแนนครั้งแรกเติมค่าที่อยู่ในช่องตอนนี้ไว้ให้ แต่แก้ได้ — ครูบางคนพิมพ์คะแนนซ่อมทับลงช่องไปก่อน
 * แล้วค่อยนึกได้ว่าต้องกดปุ่ม ถ้าล็อกไว้ คะแนนครั้งแรกที่ถูกทับไปแล้วจะไม่มีทางใส่คืน
 *
 * @param done วาดแถวที่กดมาใหม่ (ไม่วาดทั้งหน้า — ช่องที่ครูพิมพ์ค้างไว้แถวอื่นจะไม่หลุด)
 */
function openRetake(col, s, done) {
  // ชีตรุ่นเก่าอ่าน "R15/6" ไม่ออก จะนับเป็นยังไม่ตรวจแล้วคะแนนสรุปของคนนี้หายจากชีต
  if (!serverSupports('retake', serverInfo)) {
    return toast('โค้ดในชีตยังเป็นรุ่นเก่า อ่านคะแนนสอบซ่อมไม่ออก — อัปโค้ดในชีตก่อน (ตั้งค่า → ตรวจสภาพระบบ)', 'err', 7000);
  }

  const w = parseWork(getCell(col.key, s.sid));
  const mark = passMarkOf(col, settings());
  const first = w.retake ? w.orig : ((w.status === 'ok' || w.status === 'late') ? w.score : null);
  const numInput = (value, placeholder) => h('input', {
    type: 'text', inputmode: 'decimal', autocomplete: 'off',
    value: value === null ? '' : String(value), placeholder
  });
  const origIn = numInput(first, 'เว้นว่าง = ขาดสอบ');
  const againIn = numInput(w.retake ? w.score : null, `0–${col.max}`);

  /** อ่านช่องตัวเลข · ว่าง = null · นอกช่วงคะแนน = โยนข้อความให้ครูอ่าน */
  const readNum = (el, what) => {
    const v = el.value.trim().replace(',', '.');
    if (v === '') return null;
    const n = Number(v);
    if (!isFinite(n) || n < 0 || n > col.max) throw new Error(`${what}ต้องอยู่ระหว่าง 0–${col.max}`);
    return n;
  };

  const commit = (value, msg, close) => {
    setCells([{ key: col.key, sid: s.sid, value }], { quiet: true });
    close();
    done();
    refreshProgress(col);
    toast(msg, 'ok', 2600, undoAction());
  };

  modal((close) => {
    const save = h('button', { class: 'btn btn-block' }, 'บันทึกคะแนนสอบซ่อม');
    save.onclick = () => {
      let o, r;
      try { o = readNum(origIn, 'คะแนนครั้งแรก'); r = readNum(againIn, 'คะแนนสอบซ่อม'); }
      catch (e) { return toast(e.message, 'err'); }
      if (r === null) return toast('กรอกคะแนนสอบซ่อมก่อน', 'err');
      const short = mark !== null && r < mark ? ` · ยังไม่ถึงเกณฑ์ผ่าน ${nf(mark)}` : '';
      commit(formatRetake(r, o), `บันทึกสอบซ่อมแล้ว · ${s.name || 'เลขที่ ' + s.no}${short}`, close);
    };

    return h('div', null,
      h('h2', null, 'สอบซ่อม · ' + col.label),
      h('div', { class: 'hint', style: { marginBottom: '12px' } },
        `${s.no}. ${s.name || '—'} · เต็ม ${col.max}` + (mark === null ? '' : ` · เกณฑ์ผ่าน ${nf(mark)}`)),
      h('div', { class: 'field' }, h('label', null, 'คะแนนครั้งแรก'), origIn,
        h('div', { class: 'hint' },
          'เก็บไว้ให้ดูเท่านั้น ไม่นำไปคิดคะแนน · ถ้าเผลอพิมพ์คะแนนซ่อมทับช่องไปแล้ว แก้ตรงนี้กลับเป็นคะแนนครั้งแรกได้')),
      h('div', { class: 'field' }, h('label', null, 'คะแนนสอบซ่อม *'), againIn,
        h('div', { class: 'hint' }, 'ใช้คะแนนนี้คิดคะแนนสรุปและเกรดตามที่กรอกจริง')),
      save,
      w.retake && h('button', {
        class: 'btn btn-ghost btn-block', style: { marginTop: '8px' },
        onclick: () => commit(w.orig === null ? NOT_SUBMITTED : String(w.orig),
          'ยกเลิกสอบซ่อมแล้ว · กลับไปใช้คะแนนครั้งแรก', close)
      }, `ยกเลิกสอบซ่อม · กลับไปใช้คะแนนครั้งแรก (${origText(w)})`)
    );
  });
  setTimeout(() => { try { againIn.focus(); } catch (e) {} }, 60);
}

function gradeScreen(col) {
  const students = state.cls.students;
  const rows = [];
  const find = findBox(rows);
  students.forEach((s, i) => {
    rows.push(scoreRow(col, s, {
      head: [h('div', { class: 'stu-no' }, s.no), h('div', { class: 'work-name' }, s.name || '—')],
      nextInput: () => {
        /* กำลังค้นหาอยู่ = ครูหยิบกระดาษทีละแผ่นแบบไม่เรียงเลขที่
         * กด Enter แล้วกลับไปช่องค้นหาที่ล้างแล้ว พร้อมพิมพ์เลขที่ของแผ่นถัดไปเลย */
        if (ui.q.trim()) return find.reset();
        return rows.slice(i + 1).find(r => !r.hidden)?.__input;
      },
      prevInput: () => rows.slice(0, i).reverse().find(r => !r.hidden)?.__input
    }));
    rows[i].hidden = !matchStudent(s, ui.q);
  });

  const W = words(col);
  const nBlank = blankSids(col).length;
  const siblings = columnsIn(curBucket().id);

  return h('div', { class: 'page' },

    // ── ถัง (PC) — ดีไซน์วางไว้แถวบนสุด ──
    h('div', { class: 'pc-only-block' }, bucketBar()),

    // ── ชิ้นงานในถังนี้ (PC) ──
    h('div', { class: 'item-bar' },
      siblings.map(c => h('button', {
        class: 'item-pill', 'data-on': c.key === col.key ? '1' : '0',
        onclick: () => { ui.open = c.key; emit(); }
      }, `${c.label} · เต็ม ${c.max}`)),
      !isFixedKind(col.kind) && h('button', { class: 'item-pill add', onclick: () => openItemForm() }, withIcon('plus', 'เพิ่มงาน')),
      // "ตามงาน" อยู่ในเมนู ⋯ แล้ว — เดิมซ้ำกันสองที่ เพิ่มปุ่มบนแถวที่แน่นอยู่แล้ว
      h('button', {
        class: 'icon-btn', style: { marginLeft: 'auto' },
        title: 'ตัวเลือกของชิ้นนี้ (ตามงาน · วางจาก Excel · ล้าง · ลบ)', 'aria-label': 'ตัวเลือกของชิ้นนี้', onclick: () => openItemMenu(col)
      }, icon('more'))
    ),

    // ── หัวเรื่องชิ้นงาน + ความคืบหน้า (PC · มือถืออยู่ในแถบเข้มแล้ว) ──
    h('div', { class: 'ctxbar' },
      h('div', { style: { flex: '1', minWidth: '0' } },
        h('div', { class: 'ctx-title' }, col.label),
        h('div', { class: 'ctx-sub', id: 'grade-progress' }, progressText(col)),
        // ปุ่มเดียวทั้งบอกสถานะและพาไปแก้ — เดิมแยก "รายละเอียด" กับป้าย "นักเรียนเห็น" เป็นสองชิ้นติดกัน
        h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '8px' } },
          h('button', { class: (col.desc ? 'tag-on' : 'tag-off') + ' tag-act', onclick: () => openItemForm(col) },
            col.desc
              ? withIcon('eye', 'นักเรียนเห็นคำสั่ง · แก้ไข')
              : withIcon('eyeOff', 'ยังไม่มีคำสั่งให้นักเรียนอ่าน · เพิ่ม'))),
        col.desc && h('div', {
          style: { fontSize: 'var(--fs-sm)', color: 'var(--ink-2)', marginTop: '5px', whiteSpace: 'pre-wrap' }
        }, col.desc)),
      modeSeg('seg seg-inline'),
      h('div', { style: { textAlign: 'right', flex: 'none' } },
        h('div', { style: { fontSize: 'var(--fs-sm)', color: 'var(--ink-2)' } }, W.done),
        h('div', { class: 'tnum', id: 'grade-count', style: { fontSize: 'var(--fs-xl)', fontWeight: '700' } },
          `${tally(col).done} / ${tally(col).total}`)),
      h('div', { style: { width: '180px', flex: 'none' } }, progressBar(col))
    ),

    find.el,
    h('div', { class: 'kbd-hint pc-only-block' },
      h('kbd', null, 'Enter'), ' ช่องถัดไป · ', h('kbd', null, 'Shift'), '+', h('kbd', null, 'Enter'), ' ย้อน · ',
      h('kbd', null, '/'), ' ไปที่เลขที่ · ', h('kbd', null, 'Ctrl'), '+', h('kbd', null, 'Z'), ' เลิกทำ'),

    // ── รายชื่อ: มือถือ = การ์ดใบละคน · PC = ตาราง 4 คอลัมน์ ──
    h('div', { class: 'work-list' + (isExam(col) ? '' : ' st2') },
      h('div', { class: 'work-thead' },
        h('div', null, 'เลขที่'), h('div', null, 'ชื่อ-นามสกุล'),
        h('div', null, isExam(col) ? 'สถานะการสอบ' : 'สถานะการส่ง'), h('div', null, 'คะแนน')),
      rows),

    // ── ท้ายรายชื่อ (มือถือ): กรอกคนที่ไม่ปกติไล่ลงมาจนสุด แล้วเติมที่เหลือทีเดียว ──
    // จังหวะเดียวกับ "ที่เหลือมา" ในหน้าเช็คชื่อ · ตรวจครบแล้วซ่อน · บน PC อยู่ในเมนู ⋯
    h('div', { class: 'list-end pc-hide' },
      h('button', {
        class: 'btn btn-soft btn-block fill-blank', hidden: !nBlank,
        onclick: () => fillBlanks(col)
      }, withIcon('check', h('span', { 'data-fill': '' }, fillLabel(col, nBlank)))))
  );
}

/**
 * ช่อง "ไปที่เลขที่ / ชื่อ" ของหน้ากรอก
 *
 * ตรวจงานจริงกระดาษไม่ได้เรียงเลขที่ ครูต้องเลื่อนหาคนในรายชื่อ 40 คนทุกแผ่น
 * พิมพ์เลขที่แล้ว Enter = กระโดดไปช่องคะแนนของคนนั้นเลย
 * กรองด้วยการซ่อนแถว ไม่วาดหน้าใหม่ แป้นพิมพ์มือถือจึงไม่หุบระหว่างพิมพ์
 */
function findBox(rows) {
  const input = h('input', {
    type: 'search', value: ui.q, placeholder: 'ไปที่เลขที่ หรือชื่อ',
    'aria-label': 'ไปที่นักเรียน', enterkeyhint: 'go', autocomplete: 'off',
    oninput: (e) => { ui.q = e.target.value; apply(); },
    onkeydown: (e) => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      const first = rows.find(r => !r.hidden);
      if (first) { first.__input.focus(); first.__input.select(); }
    }
  });
  const clearBtn = h('button', {
    class: 'find-clear', 'aria-label': 'ล้างคำค้น', hidden: !ui.q,
    onclick: () => { reset(); }
  }, icon('close'));
  const none = h('div', { class: 'card empty att-nomatch', hidden: true }, 'ไม่พบนักเรียนที่ค้นหา');

  function apply() {
    const bySid = new Map(state.cls.students.map(s => [String(s.sid), s]));
    let shown = 0;
    rows.forEach(r => {
      const s = bySid.get(r.dataset.sid);
      r.hidden = !(s && matchStudent(s, ui.q));
      if (!r.hidden) shown++;
    });
    none.hidden = shown > 0 || !ui.q.trim();
    clearBtn.hidden = !ui.q;
  }
  function reset() {
    ui.q = ''; input.value = ''; apply();
    input.focus();
    return null;    // ให้ตัวเรียก (Enter ในช่องคะแนน) ไม่ต้องย้ายโฟกัสต่อ
  }
  return {
    el: h('div', null, h('label', { class: 'find-box' }, icon('search'), input, clearBtn), none),
    reset
  };
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

  // สรุปของถังนี้เฉพาะคนนี้ — คิดคะแนนกติกาเดียวกับ computeClass (งานที่เริ่มตรวจแล้ว ช่องว่าง = ไม่ส่ง)
  const mb = blankMissCols(cls);
  let got = 0, max = 0, done = 0;
  for (const c of cols) {
    const w = parseWork(effectiveRaw(getCell(c.key, s.sid), mb[c.key]));
    // นับเหมือน tally(): งานส่ง = ส่ง/ช้า · ข้อสอบ = เข้าสอบ
    if (w.status === 'ok' || (w.status === 'late' && !isExam(c))) done++;
    if (w.status === 'none') { if (S.ungraded === 'zero') max += c.max; continue; }
    max += c.max;
    if (w.status !== 'miss') got += w.score;
  }
  const bucketScore = max > 0 ? Math.round((S.weight[curBucket().id] * got / max) * 100) / 100 : null;

  const rows = [];
  cols.forEach((c, i) => {
    rows.push(scoreRow(c, s, {
      head: h('div', { style: { flex: '1', minWidth: '0' } },
        h('div', { class: 'work-name', style: { fontSize: 'var(--fs-md)' } }, c.label),
        h('div', { class: 'stu-sid' }, `เต็ม ${c.max}${c.desc ? ' · ' + c.desc : ''}`)),
      // ช่องสุดท้ายของคนนี้ กด Enter = ไปคนถัดไปเลย ไม่ต้องเอื้อมไปกดปุ่ม ›
      nextInput: () => {
        if (rows[i + 1]) return rows[i + 1].__input;
        if (ui.si < cls.students.length - 1) {
          step(1);
          setTimeout(() => { const n = document.querySelector('.work-list .score-inp'); if (n) { n.focus(); n.select(); } }, 30);
        }
        return null;
      },
      prevInput: () => rows[i - 1] && rows[i - 1].__input
    }));
  });

  const step = (d) => { ui.si = Math.min(cls.students.length - 1, Math.max(0, ui.si + d)); emit(); };

  return h('div', { class: 'page' },

    h('div', { class: 'pc-only-block' }, bucketBar()),

    h('div', { class: 'ctxbar' },
      h('div', { style: { flex: '1', minWidth: '0' } },
        h('div', { class: 'ctx-title' }, s.name || '—'),
        h('div', { class: 'ctx-sub' }, `เลขที่ ${s.no}${s.sid ? ' · ' + s.sid : ''} · คนที่ ${ui.si + 1} จาก ${cls.students.length}`)),
      modeSeg('seg seg-inline'),
      h('div', { class: 'ctx-end' },
        h('button', { class: 'btn btn-ghost btn-sm', disabled: ui.si === 0, 'aria-label': 'คนก่อนหน้า', onclick: () => step(-1) }, icon('back')),
        h('button', { class: 'btn btn-ghost btn-sm', disabled: ui.si >= cls.students.length - 1, 'aria-label': 'คนถัดไป', onclick: () => step(1) }, icon('next')))),

    // เลือกห้อง แล้วเลือกคน — เลื่อนหาเร็วกว่าพิมพ์ชื่อ โดยเฉพาะบนมือถือ
    h('div', { class: 'pick2row' },
      h('label', { class: 'pickbox' },
        h('span', null, 'ห้อง'),
        classSelect(async (id) => {
          ui.si = 0;
          await loadClass(id);
          // คอลัมน์ของห้องเดิมใช้กับห้องใหม่ไม่ได้ ต้องชี้ไปชิ้นแรกของถังเดิมในห้องใหม่
          const first = columnsIn(curBucket().id)[0];
          ui.open = first ? first.key : null;
          emit();
        })),

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
        h('div', { style: { fontSize: 'var(--fs-sm)', color: 'var(--ink-2)' } },
          `${b.label} · ${b.phase === 1 ? 'ก่อนกลางภาค' : 'หลังกลางภาค'}`),
        h('div', { style: { fontSize: 'var(--fs-xs)', color: 'var(--ink-3)', marginTop: '1px' } },
          `${words(col).done} ${done} จาก ${cols.length} ชิ้น`)),
      h('div', { style: { textAlign: 'right' } },
        h('div', { class: 'tnum', style: { fontSize: 'var(--fs-xl)', fontWeight: '700' } },
          bucketScore === null ? '—' : nf(bucketScore)),
        h('div', { style: { fontSize: 'var(--fs-xs)', color: 'var(--ink-2)' } }, '/' + S.weight[curBucket().id]))),

    h('div', { class: 'work-list by-student' + (isExam(col) ? '' : ' st2') }, rows),

    h('div', { class: 'pager' },
      h('button', { class: 'btn btn-ghost', disabled: ui.si === 0, 'aria-label': 'คนก่อนหน้า', onclick: () => step(-1) }, icon('back')),
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
       ...(isExam(col)
         ? [`${W.miss} ${t.miss}`, `ยังไม่ตรวจ ${t.left}`]
         : [`ยังไม่ส่ง ${t.left}`])].filter(Boolean).join(' · '))
  );
}

function progressText(col) {
  const t = tally(col);
  const vals = state.cls.values[col.key] || {};
  const scored = [];
  for (const s of state.cls.students) {
    const w = parseWork(vals[s.sid]);
    // เฉลี่ยต้องคิดจากคนกลุ่มเดียวกับตัวเลขที่โชว์ข้าง ๆ (done) — คนที่ส่ง/เข้าสอบแล้วเท่านั้น
    if (w.status === 'ok' || w.status === 'late') scored.push(w.score);
  }
  const avg = scored.length ? scored.reduce((a, b) => a + b, 0) / scored.length : 0;
  const W = words(col);
  return `เต็ม ${col.max} · ${W.done} ${t.done}/${t.total}`
    + (t.late ? ` · ช้า ${t.late}` : '')
    + (isExam(col) && t.miss ? ` · ${W.miss} ${t.miss}` : '')
    + (t.retake ? ` · สอบซ่อม ${t.retake}` : '')
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

  // ปุ่ม "ยังว่าง N คน · ให้ส่งครบ" — จำนวนต้องลดตามที่ครูกรอกไปทีละคน ไม่งั้นป้ายโกหก
  const fill = document.querySelector('.fill-blank');
  if (fill) {
    const n = blankSids(col).length;
    fill.hidden = !n;
    const label = fill.querySelector('[data-fill]');
    if (label) label.textContent = fillLabel(col, n);
  }
}

// ── เพิ่ม / แก้ไขรายการ ─────────────────────────────────────

/** คำอธิบายใต้ช่องเกณฑ์ผ่าน — บอกด้วยว่าเว้นว่างแล้วจะเกิดอะไร */
function passHint(max) {
  const base = 'ได้เท่านี้ขึ้นไปถือว่าผ่าน · ต่ำกว่านี้ช่องคะแนนจะขึ้นสีแดง และไปโผล่ในรายชื่อคนต้องซ่อม';
  const pct = settings().passPct;
  if (pct == null) return base + ' · เว้นว่าง = ไม่ตรวจรายการนี้';
  const mark = Math.round(max * pct / 100 * 100) / 100;
  return `${base} · เว้นว่าง = ใช้ค่าตั้งต้น ${pct}% ของคะแนนเต็ม (${mark} คะแนน)`;
}

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
  const pass  = h('input', {
    type: 'number', min: '0', step: 'any',
    value: String(edit?.pass ?? ''),     // null/undefined = ยังไม่ได้ตั้งเกณฑ์ → ช่องว่าง
    placeholder: 'เว้นว่าง = ไม่ตรวจ'
  });

  // เพิ่มลงห้องอื่นด้วย — เฉพาะตอนเพิ่มใหม่ (แก้ไขยังทำทีละห้องเหมือนเดิม)
  const rooms = edit ? null : roomPicker(() => {
    const n = rooms.picked().length + 1;
    save.textContent = n > 1 ? `เพิ่มลง ${n} ห้อง` : 'เพิ่มรายการ';
  });
  let save;

  modal((close) => {
    save = h('button', { class: 'btn btn-block' }, edit ? 'บันทึก' : 'เพิ่มรายการ');
    if (rooms) rooms.refresh();
    save.onclick = async () => {
      const l = label.value.trim(), m = Number(max.value), d = desc.value.trim();
      if (!l) return toast('ตั้งชื่อรายการก่อน', 'err');
      if (!(m > 0)) return toast('คะแนนเต็มต้องมากกว่า 0', 'err');

      // ช่องว่าง = ไม่ตั้งเกณฑ์ · ส่ง '' ไปให้ฝั่งชีตล้างค่าเดิมทิ้ง
      const praw = pass.value.trim();
      let p = '';
      if (praw !== '') {
        p = Number(praw);
        if (!isFinite(p) || p < 0) return toast('เกณฑ์ผ่านต้องเป็นตัวเลขไม่ติดลบ', 'err');
        if (p > m) return toast(`เกณฑ์ผ่าน (${p}) มากกว่าคะแนนเต็ม (${m}) — ไม่มีใครผ่านได้เลย`, 'err');
      }

      try {
        if (edit) await updateColumn(edit.key, { label: l, max: m, desc: d, pass: p });
        else {
          const others = rooms ? rooms.picked() : [];
          ui.open = addColumnToMany({ kind: b.kind, half: b.half, label: l, max: m, desc: d, pass: p }, others);
          if (others.length) toast(`เพิ่ม "${l}" ลง ${others.length + 1} ห้องแล้ว`, 'ok', 2600);
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
      h('div', { class: 'field' }, h('label', null, 'เกณฑ์ผ่าน (คะแนนดิบ)'), pass,
        h('div', { class: 'hint' }, passHint(Number(max.value) || 0))),
      rooms && rooms.el,
      save
    );
  });
}

/**
 * รายการห้องให้ติ๊กว่าจะเพิ่มชิ้นงานนี้ลงห้องไหนบ้าง
 *
 * ห้องที่สอนวิชาเดียวกัน (รหัสวิชาตรงกัน หรือชื่อวิชาตรงกันถ้าไม่มีรหัส) ติ๊กไว้ให้เลย
 * — เกือบทุกครั้งครูให้งานชิ้นเดียวกันทุกห้องที่สอนวิชานั้น
 * ห้องวิชาอื่นซ่อนไว้ กดเปิดดูได้ (นาน ๆ ครั้งถึงจะใช้ และติ๊กพลาดแล้วต้องไปลบทีละห้อง)
 */
function roomPicker(onChange) {
  const me = state.classes.find(c => c.classId === state.classId) || state.cls?.meta || {};
  const others = state.classes.filter(c => c.classId !== state.classId);
  if (!others.length) return null;

  const code = String(me.subjectCode || '').trim();
  const sameSubject = (c) => code
    ? String(c.subjectCode || '').trim() === code
    : String(c.subject || '').trim() === String(me.subject || '').trim();
  const same = others.filter(sameSubject);
  const rest = others.filter(c => !sameSubject(c));

  const boxes = [];
  const item = (c, on) => {
    const cb = h('input', { type: 'checkbox', checked: on, onchange: () => onChange() });
    cb.dataset.id = c.classId;
    boxes.push(cb);
    return h('label', { class: 'room-row' }, cb,
      h('span', { class: 'room-main' },
        h('b', null, `${[c.grade, c.room].filter(Boolean).join('/') || '—'} · ${c.subject}`),
        h('small', null, `${c.studentCount || 0} คน${c.subjectCode ? ' · ' + c.subjectCode : ''}`)),
      on && h('span', { class: 'room-tag' }, 'วิชาเดียวกัน'));
  };

  const restBox = rest.length ? h('div', { class: 'room-list', hidden: true }, rest.map(c => item(c, false))) : null;
  const el = h('div', { class: 'field room-pick' },
    h('label', null, 'เพิ่มลงห้องไหนบ้าง'),
    h('div', { class: 'room-list' },
      h('label', { class: 'room-row', 'data-me': '1' },
        h('input', { type: 'checkbox', checked: true, disabled: true }),
        h('span', { class: 'room-main' },
          h('b', null, `${[me.grade, me.room].filter(Boolean).join('/') || '—'} · ${me.subject || ''}`),
          h('small', null, 'ห้องที่เปิดอยู่')),
        h('span', { class: 'room-tag', 'data-me': '1' }, 'ห้องนี้')),
      same.map(c => item(c, true))),
    restBox && h('button', {
      type: 'button', class: 'room-more', 'aria-expanded': 'false',
      onclick: (e) => {
        restBox.hidden = !restBox.hidden;
        e.currentTarget.setAttribute('aria-expanded', String(!restBox.hidden));
        e.currentTarget.textContent = (restBox.hidden ? '▸ ' : '▾ ') + `ห้องวิชาอื่น (${rest.length})`;
      }
    }, `▸ ห้องวิชาอื่น (${rest.length})`),
    restBox,
    h('div', { class: 'hint' }, 'ชื่อ คะแนนเต็ม และเกณฑ์ผ่านเหมือนกันทุกห้อง · แก้แยกรายห้องทีหลังได้'));

  return {
    el,
    picked: () => boxes.filter(b => b.checked).map(b => b.dataset.id),
    refresh: onChange
  };
}

/** ตามงานชิ้นนี้ — รายชื่อคนที่ยังไม่ส่ง / ยังไม่ผ่านเกณฑ์ เป็นข้อความพร้อมวางในไลน์ */
function chase(col) {
  const S = settings();
  const meta = state.cls.meta;
  const room = [meta.grade, meta.room].filter(Boolean).join('/');
  const mark = passMarkOf(col, S);

  const missing = [], failing = [];
  let unchecked = 0;
  for (const s of state.cls.students) {
    const raw = getCell(col.key, s.sid);
    const w = parseWork(raw);
    if (w.status === 'none' || w.status === 'miss') {
      missing.push({ no: s.no, name: s.name });
      if (w.status === 'none') unchecked++;
    } else if (mark !== null && passOf(col, raw, S) === false) {
      failing.push({ no: s.no, name: s.name, extra: `${nf(w.score)}/${col.max}` });
    }
  }

  openCopyList({
    title: 'ตามงาน · ' + col.label,
    sub: `${room ? room + ' · ' : ''}${meta.subject} · เต็ม ${col.max}`,
    topic: `${col.label} · ${room ? room + ' ' : ''}${meta.subject}`,
    groups: [
      {
        id: 'miss', label: isExam(col) ? 'ยังไม่สอบ' : 'ยังไม่ส่ง', people: missing,
        head: (n) => `${isExam(col) ? 'ยังไม่ได้สอบ' : 'ยังไม่ส่ง'} ${n} คน`,
        // ข้อสอบ: ช่องว่างอาจสอบแล้วแต่ครูยังไม่ได้กรอก — เตือนก่อนประกาศชื่อในกลุ่ม
        // (งานส่ง ช่องว่างคือยังไม่ส่งอยู่แล้ว ไม่ต้องเตือน)
        note: isExam(col) && unchecked
          ? `รวม ${unchecked} คนที่ยังไม่ได้กรอกคะแนน — ถ้ากรอกยังไม่ครบ กรอกก่อนแล้วค่อยคัดลอก` : ''
      },
      {
        id: 'fail', label: 'ยังไม่ผ่าน', people: failing, names: false,
        head: (n) => `ยังไม่ผ่านเกณฑ์ ${n} คน (ต่ำกว่า ${nf(mark)}/${col.max}) แก้แล้วส่งใหม่ได้`
      }
    ].filter(g => g.id !== 'fail' || mark !== null)
  });
}

function openItemMenu(col) {
  const t = tally(col);
  const nBlank = blankSids(col).length;
  const nOver = overwriteSids(col).length;
  modal((close) => h('div', null,
    h('h2', null, col.label),
    h('div', { class: 'hint', style: { marginBottom: '12px' } },
      `เต็ม ${col.max} · ${words(col).done} ${t.done}/${t.total}`),
    /* จัดเป็น 3 กลุ่ม (กรอก · ส่งต่อ · จัดการ) — เดิมเรียง 7–8 ปุ่มหน้าตาเหมือนกันหมด
     * "ล้างคะแนน" ปนอยู่กลางปุ่มกรอกทั่วไป · ของที่ย้อนไม่ได้อยู่ท้ายสุดเสมอ */
    h('div', { class: 'menu-list' },
      h('div', { class: 'menu-sep' }, 'กรอกคะแนน'),
      // เปิดจากในหน้ากรอกของชิ้นนี้เอง (⋯ บนแถบหัว) ไม่ต้องมีปุ่มพาไปหน้าที่อยู่แล้ว
      ui.open !== col.key && h('button', { class: 'btn btn-ghost btn-block', onclick: () => { close(); ui.open = col.key; emit(); } }, withIcon('doc', 'กรอกคะแนน')),
      h('button', { class: 'btn btn-ghost btn-block', onclick: () => { close(); openPaste(col); } }, withIcon('paste', 'วางคะแนนจาก Excel')),
      nBlank > 0 && h('button', {
        class: 'btn btn-ghost btn-block',
        onclick: () => { close(); fillBlanks(col); }
      }, withIcon('check', fillLabel(col, nBlank))),
      nOver > 0 && h('button', {
        class: 'btn btn-ghost btn-block',
        onclick: () => { close(); fillAll(col); }
      }, withIcon('check', `${words(col).over}…`)),
      h('div', { class: 'menu-sep' }, 'ส่งต่อ'),
      h('button', { class: 'btn btn-ghost btn-block', onclick: () => { close(); chase(col); } }, withIcon('megaphone', 'ตามงาน · คัดลอกรายชื่อไปไลน์')),
      h('div', { class: 'menu-sep' }, 'จัดการ'),
      h('button', { class: 'btn btn-ghost btn-block', onclick: () => { close(); openItemForm(col); } }, withIcon('edit', 'แก้ไขชื่อ / รายละเอียด / คะแนนเต็ม')),
      h('button', {
        class: 'btn btn-ghost btn-block is-danger',
        onclick: async () => {
          close();
          if (!await confirmBox('ล้างคะแนน?', 'คะแนนของรายการนี้จะถูกลบทั้งห้อง', 'ล้าง')) return;
          setCells(state.cls.students.map(s => ({ key: col.key, sid: s.sid, value: '' })));
          toast('ล้างคะแนนแล้ว', 'ok', 1400, undoAction());
        }
      }, withIcon('broom', 'ล้างคะแนนทั้งรายการ')),
      // สอบกลาง/ปลายภาคช่องเดียว ลบไปก็ถูกสร้างใหม่ตอนเปิดครั้งหน้า — ให้ลบได้เฉพาะช่องที่เกินมา
      // (ห้องที่สร้างไว้ก่อนมีช่องตายตัว อาจมีหลายช่อง)
      (!isFixedKind(col.kind) ||
        state.cls.columns.filter(c => c.kind === col.kind && c.half === col.half).length > 1) &&
      h('button', {
        class: 'btn btn-danger btn-block',
        onclick: async () => {
          close();
          if (!await confirmBox('ลบรายการนี้?', `“${col.label}” และคะแนนทั้งหมดจะถูกลบ`, 'ลบ')) return;
          ui.open = null;
          await deleteColumn(col.key);
          toast('ลบแล้ว', 'ok');
        }
      }, withIcon('trash', 'ลบรายการ'))
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
  const err = h('div', { class: 'score-err', role: 'alert', hidden: true });
  modal((close) => {
    const save = h('button', { class: 'btn btn-block' }, 'นำเข้าคะแนน');
    save.onclick = () => {
      const lines = ta.value.split(/\r?\n/).map(s => s.trim());
      const cells = [];
      // บรรทัดที่เกินเต็ม/อ่านไม่ออก — เดิมปัดเป็นเต็มหรือข้ามเงียบ ๆ ตอนนี้ไม่นำเข้าเลยจนกว่าจะแก้
      const bad = [];
      const inRange = (x) => isFinite(x) && x >= 0 && x <= col.max;
      state.cls.students.forEach((s, i) => {
        if (i >= lines.length) return;
        const raw = lines[i];
        if (raw === '' || raw === '-') { cells.push({ key: col.key, sid: s.sid, value: '' }); return; }
        if (/^x$|^ไม่ส่ง$|^ขาดสอบ$|^ไม่ได้สอบ$/i.test(raw)) { cells.push({ key: col.key, sid: s.sid, value: NOT_SUBMITTED }); return; }
        const rt = parseWork(raw);
        if (rt.retake) {
          if (!canRetake(col)) return;             // รายการนี้ไม่มีสอบซ่อม — ข้ามบรรทัดนี้ ไม่เดาให้
          if (!inRange(rt.score) || (rt.orig !== null && !inRange(rt.orig))) { bad.push(i + 1); return; }
          cells.push({ key: col.key, sid: s.sid, value: formatRetake(rt.score, rt.orig) });
          return;
        }
        const late = /^(l|ช้า)/i.test(raw);
        const n = Number(raw.replace(/^(l|ช้า)\s*/i, '').replace(',', '.'));
        if (!inRange(n)) { bad.push(i + 1); return; }
        cells.push({ key: col.key, sid: s.sid, value: formatWork(late ? 'late' : 'ok', n) });
      });
      if (bad.length) {
        err.textContent = `บรรทัด ${bad.slice(0, 8).join(', ')}${bad.length > 8 ? ' …' : ''} เกินคะแนนเต็ม ${col.max} หรืออ่านไม่ออก — แก้แล้วกดนำเข้าอีกครั้ง (ยังไม่ได้นำเข้าอะไร)`;
        err.hidden = false;
        return;
      }
      setCells(cells);
      toast(`นำเข้า ${cells.length} รายการ`, 'ok', 2400, undoAction());
      close();
    };
    return h('div', null,
      h('h2', null, 'วางคะแนนจาก Excel'),
      h('div', { class: 'hint', style: { marginBottom: '8px' } },
        `เรียงตามลำดับเลขที่ในรายชื่อ (${state.cls.students.length} คน)`,
        h('br'),
        exam
          ? ['ตัวเลข = คะแนนที่สอบได้ · ', h('code', null, 'x'), ' = ยังไม่ได้สอบ · เว้นว่าง = ยังไม่กรอก',
             canRetake(col) && [' · ', h('code', null, 'R15/6'), ' = สอบซ่อมได้ 15 (ครั้งแรก 6)']]
          : ['ตัวเลข = ส่ง · ', h('code', null, 'L7'), ' = ส่งช้าได้ 7 · ',
             h('code', null, 'x'), ' = ไม่ส่ง · เว้นว่าง = ยังไม่ตรวจ']),
      ta, err, h('div', { style: { height: '10px' } }), save
    );
  });
}
