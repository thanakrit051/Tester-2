/* หน้าสรุปคะแนน — ตารางตรงกับหน้ากรอกของ SGS */

import { h, modal, toast, nf, printPage, copyText } from '../dom.js';
import { state, emit, settings, recalcOnServer } from '../state.js';
import { computeClass, gradeNow, BUCKETS, bucketColumns, parseWork, blankMissCols, effectiveRaw } from '../score.js';
import { exportClassCSV, loadingPage } from './common.js';
import { icon, withIcon } from '../icons.js';

const ui = { phase: 0, fill: false, fi: 0 };   // phase 0 = ทั้งหมด · fill = โหมดกรอกทีละคน

const SGS_COLS = [
  { id: 'work1', head: '1',        sub: 'งาน1',   phase: 1, cls: 'h4' },
  { id: 'quiz1', head: '2',        sub: 'สอบ1',   phase: 1, cls: 'h4' },
  { id: 'att1',  head: '3',        sub: 'เรียน1', phase: 1, cls: 'h4' },
  { id: 'mid',   head: 'กลาง',     sub: '',       phase: 1, cls: 'h1' },
  { id: 'work2', head: '10',       sub: 'งาน2',   phase: 2, cls: 'h4' },
  { id: 'quiz2', head: '11',       sub: 'สอบ2',   phase: 2, cls: 'h4' },
  { id: 'att2',  head: '12',       sub: 'เรียน2', phase: 2, cls: 'h4' },
  { id: 'fin',   head: 'ปลาย',     sub: '',       phase: 2, cls: 'h1' }
];

/** ชื่อเต็มของแต่ละช่อง ใช้ในโหมดกรอกทีละคน (ดีไซน์หน้า 05 มือถือ) */
const FULL_LABEL = {
  work1: 'ส่งงาน ก่อนกลางภาค',  quiz1: 'สอบเก็บ ก่อนกลางภาค',  att1: 'เข้าเรียน ก่อนกลางภาค',
  mid:   'สอบกลางภาค',
  work2: 'ส่งงาน หลังกลางภาค',  quiz2: 'สอบเก็บ หลังกลางภาค',  att2: 'เข้าเรียน หลังกลางภาค',
  fin:   'สอบปลายภาค'
};

/**
 * จำนวนงานที่ยังไม่ตรวจ แยกรายคน-รายช่อง
 * ใช้ติด "จุดส้ม" บอกว่าตัวเลขในช่องนั้นยังเปลี่ยนได้ (ตามดีไซน์)
 */
function pendingMap(cls) {
  const byBucket = bucketColumns(cls);
  const V = cls.values || {};
  const mb = blankMissCols(cls);   // งานที่เริ่มตรวจแล้ว ช่องว่าง = ไม่ส่ง (0 คะแนน) ไม่ใช่งานค้างตรวจ
  const out = {};
  for (const st of (cls.students || [])) {
    const m = {};
    for (const b of BUCKETS) {
      if (b.kind === 'ATT') continue;
      let n = 0;
      for (const c of byBucket[b.id]) {
        if (parseWork(effectiveRaw((V[c.key] || {})[st.sid], mb[c.key])).status === 'none') n++;
      }
      m[b.id] = n;
    }
    out[st.sid] = m;
  }
  return out;
}

export function viewSummary() {
  const cls = state.cls;
  if (!cls) {
    return state.loadingClass ? loadingPage() : h('div', { class: 'page empty' }, 'ยังไม่ได้เลือกห้องเรียน');
  }
  if (!cls.students.length) {
    return h('div', { class: 'page' }, h('div', { class: 'card empty' },
      h('div', { class: 'empty-icon' }, icon('users')), 'ห้องนี้ยังไม่มีรายชื่อนักเรียน'));
  }

  const S = settings();
  const rows = computeClass(cls, S);
  const cols = SGS_COLS.filter(c => ui.phase === 0 || c.phase === ui.phase);
  const pend = pendingMap(cls);
  const pendTotal = rows.reduce((a, r) => a + r.pending, 0);
  const anyEst = rows.some(r => r.dataN > 0 && gradeNow(r).est);

  if (ui.fill) return fillScreen(rows, S, pend);

  return h('div', { class: 'page page-wide' },

    h('div', { class: 'chips', role: 'group', 'aria-label': 'ช่วงที่แสดง' },
      [[0, 'ทั้งปี'], [1, 'ก่อนกลางภาค'], [2, 'หลังกลางภาค']].map(([v, l]) =>
        h('button', { class: 'chip', 'data-on': ui.phase === v ? '1' : '0', onclick: () => { ui.phase = v; emit(); } }, l))
    ),

    // ── แถบพร้อมกรอก + ปุ่มหลัก (ดีไซน์หน้า 05) ──
    h('div', { class: 'card', style: { display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' } },
      h('div', { style: { flex: '1', minWidth: '180px' } },
        // "พร้อมกรอก" เฉพาะตอนพร้อมจริง — เดิมขึ้นตลอด แม้บรรทัดถัดไปจะบอกว่ายังไม่ตรวจอีก 27 ช่อง
        h('div', { style: { fontSize: 'var(--fs-base)', fontWeight: '700' } },
          pendTotal === 0 && !anyEst ? `พร้อมกรอกลง SGS · ${rows.length} คน` : `สรุปคะแนนสำหรับ SGS · ${rows.length} คน`),
        h('div', { style: { fontSize: 'var(--fs-sm)', color: 'var(--ink-2)', marginTop: '2px' } },
          [pendTotal > 0 ? `ยังไม่ได้ตรวจ ${pendTotal} ช่องคะแนน — ช่องที่กระทบมีจุดส้มกำกับ` : 'ตรวจครบทุกรายการแล้ว',
           anyEst ? 'เกรดเป็นค่าประมาณจนกว่าจะกรอกคะแนนปลายภาค' : ''].filter(Boolean).join(' · '))),
      h('button', { class: 'btn btn-ghost btn-sm', onclick: () => { ui.fill = true; ui.fi = 0; emit(); } }, withIcon('users', 'โหมดกรอกทีละคน')),
      // ไม่ใช่ไลม์ — แอปบันทึกลงชีตเองอยู่แล้ว ปุ่มนี้แค่สั่งชีตคิดสรุปใหม่ ไม่ใช่สิ่งที่ต้องกดทุกครั้ง
      // ชื่อเดิม "บันทึกลงชีต" ทำให้ครูเข้าใจว่าต้องกดบันทึกเอง ไม่งั้นข้อมูลไม่ขึ้นชีต
      h('button', {
        class: 'btn btn-ghost btn-sm', title: 'ข้อมูลขึ้นชีตเองทุกครั้งที่กรอก — ปุ่มนี้สั่งให้แผ่นสรุปในชีตคำนวณใหม่ทันที',
        onclick: async (e) => {
          const b = e.currentTarget; b.disabled = true; b.textContent = 'กำลังคำนวณ…';
          try { await recalcOnServer(); toast('แผ่นสรุปในชีตคำนวณใหม่แล้ว', 'ok'); }
          catch (err) { toast(err.message, 'err', 5000); }
          finally { b.disabled = false; b.replaceChildren(...withIcon('refresh', 'คำนวณสรุปในชีตใหม่')); }
        }
      }, withIcon('refresh', 'คำนวณสรุปในชีตใหม่'))
    ),

    h('div', { class: 'card card-tight' },
      h('div', { class: 'tablewrap' }, table(rows, cols, S, pend))),

    h('div', { class: 'sgs-note' },
      h('span', { class: 'dot-pend' }, '•'),
      h('span', null, '= ช่องนี้ยังมีงานค้างตรวจ ตัวเลขอาจเปลี่ยน · แตะหัวคอลัมน์เพื่อคัดลอกทั้งช่องไปวางใน SGS'
        + (anyEst ? ' · ≈ = เกรดประมาณจากคะแนนที่ตรวจแล้ว (ยังไม่มีปลายภาค)' : ''))),

    h('div', { class: 'btn-row', style: { marginTop: '10px' } },
      h('button', { class: 'btn btn-ghost btn-sm', onclick: () => copyTable(rows, cols) }, withIcon('copy', 'คัดลอกทั้งตาราง')),
      h('button', { class: 'btn btn-ghost btn-sm', onclick: () => exportClassCSV(rows) }, withIcon('download', 'CSV')),
      h('button', { class: 'btn btn-ghost btn-sm', onclick: () => printSummary(rows, cols, S, pend) }, withIcon('printer', 'พิมพ์')))
  );
}

/**
 * พิมพ์ตารางสรุป SGS — ส่งฝ่ายวิชาการ / แนบเซ็นรับรอง
 * ใช้ตารางชุดเดียวกับบนจอ แต่ตัดปุ่ม/การคลิกออก และใส่หัวกระดาษบอกห้อง/ภาคเรียน
 */
function printSummary(rows, cols, S, pend) {
  const meta = state.cls.meta;
  const room = [meta.grade, meta.room].filter(Boolean).join('/');
  const cfg = state.config || {};
  const t = table(rows, cols, S, pend);
  t.classList.add('print-grid');
  t.querySelectorAll('[title]').forEach(el => el.removeAttribute('title'));
  printPage([
    h('div', { class: 'print-head' },
      h('b', null, `สรุปคะแนน SGS · ${room ? room + ' · ' : ''}${meta.subject}${meta.subjectCode ? ' (' + meta.subjectCode + ')' : ''}`),
      h('span', null, [`ภาคเรียนที่ ${cfg.term || '—'}/${cfg.year || '—'}`, cfg.teacher ? 'ครู ' + cfg.teacher : '', `${rows.length} คน`]
        .filter(Boolean).join(' · '))),
    t,
    h('div', { class: 'print-foot' },
      h('span', null, 'พิมพ์จาก AssignCheck · ' + new Date().toLocaleDateString('th-TH', { dateStyle: 'long' })),
      h('span', null, 'ลงชื่อ ................................................ ครูผู้สอน'))
  ], { title: `สรุป SGS ${room} ${meta.subject}`, landscape: true });
}

/** แถบหัวสีเข้ม — มีเฉพาะตอนอยู่ในโหมดกรอกทีละคน (ดีไซน์ 05 มือถือ) */
viewSummary.head = function () {
  const cls = state.cls;
  if (!cls || !cls.students.length || !ui.fill) return null;
  const rows = computeClass(cls, settings());
  if (ui.fi >= rows.length) ui.fi = 0;

  return h('header', { class: 'pagehead' },
    h('div', { class: 'ph-row' },
      h('div', { class: 'ph-grow' },
        h('div', { class: 'ph-title' }, 'โหมดกรอก SGS'),
        h('div', { class: 'ph-sub' },
          `${[cls.meta.grade, cls.meta.room].filter(Boolean).join('/')} · คนที่ ${ui.fi + 1} จาก ${rows.length}`)),
      h('button', { class: 'ph-badge', onclick: () => { ui.fill = false; emit(); } }, 'ออก')
    )
  );
};

/** หน้าย่อย = โหมดกรอกทีละคน — ปุ่มย้อนกลับของเครื่องออกจากโหมดนี้ (ดู syncRoute ใน app.js) */
viewSummary.route = {
  get: () => (ui.fill ? 'fill' : ''),
  set: (sub) => { ui.fill = sub === 'fill'; }
};

/** โหมดกรอกทีละคน — อ่านคะแนน 8 ช่องเรียงตามลำดับที่ SGS ให้กรอก */
function fillScreen(rows, S, pend) {
  if (!rows.length) { ui.fill = false; return h('div', { class: 'page empty' }, 'ไม่มีนักเรียน'); }
  if (ui.fi >= rows.length) ui.fi = 0;
  const r = rows[ui.fi];
  const now = gradeNow(r);
  const step = (d) => { ui.fi = Math.min(rows.length - 1, Math.max(0, ui.fi + d)); emit(); };

  return h('div', { class: 'page' },
    h('div', { class: 'ctxbar' },
      h('div', { style: { flex: '1' } },
        h('div', { class: 'ctx-title' }, 'โหมดกรอก SGS'),
        h('div', { class: 'ctx-sub' }, `คนที่ ${ui.fi + 1} จาก ${rows.length}`)),
      h('button', { class: 'btn btn-ghost btn-sm', onclick: () => { ui.fill = false; emit(); } }, 'ออกจากโหมดนี้')),

    h('div', { class: 'fill-card' },
      h('div', { class: 'fill-sid' }, `เลขที่ ${r.no}${r.sid ? ' · เลขประจำตัว ' + r.sid : ''}`),
      h('div', { class: 'fill-name' }, r.name || '—'),

      SGS_COLS.map(c => {
        const exam = c.id === 'mid' || c.id === 'fin';
        const p = (pend[r.sid] || {})[c.id] || 0;
        return h('div', { class: 'sgs-row' + (exam ? ' exam' : '') },
          h('span', { class: 'sgs-no' }, exam ? (c.id === 'mid' ? 'กล' : 'ปล') : c.head),
          h('span', { class: 'sgs-lbl' }, FULL_LABEL[c.id]),
          h('b', { class: 'sgs-val' }, cellText(r, c.id), p > 0 && h('span', { class: 'dot-pend' }, '•')));
      }),

      h('div', { class: 'fill-total' },
        h('span', null, 'รวม · เกรด'),
        h('b', { style: { color: !now.est && (r.grade === 'มส' || r.grade === '0') ? 'var(--st-miss)' : 'var(--ink)' } },
          r.dataN ? nf(r.total) : '—'),
        h('span', {
          class: 'badge ' + (now.est ? 'n' : (r.grade === 'มส' || r.grade === '0' ? 'r' : 'g')),
          style: { flex: 'none' },
          title: now.est ? `ได้ ${nf(r.proj, 0)}% ของคะแนนที่ตรวจแล้ว · ยังไม่มีคะแนนปลายภาค` : null
        }, now.est ? `เกรดประมาณ ${now.g}` : `เกรด ${r.grade}`))
    ),

    h('div', { class: 'pager' },
      h('button', { class: 'btn btn-ghost', disabled: ui.fi === 0, 'aria-label': 'คนก่อนหน้า', onclick: () => step(-1) }, icon('back')),
      h('button', {
        class: 'btn',
        onclick: () => {
          if (ui.fi < rows.length - 1) step(1);
          else { toast('ครบทุกคนแล้ว', 'ok'); ui.fill = false; emit(); }
        }
      }, ui.fi < rows.length - 1 ? `คนถัดไป · ${rows[ui.fi + 1].name || ''} ›` : 'เสร็จสิ้น'))
  );
}

// ── ตาราง ───────────────────────────────────────────────────

/**
 * ช่องรวม + เกรดท้ายแถว — ยังไม่จบภาคเกรดขึ้นเป็น "≈3" สีจาง (ประมาณจากคะแนนที่ตรวจแล้ว)
 * ช่องรวมยังเป็นเลขจริงเต็ม 100 ที่ต้องลง SGS แต่ไม่ทาแดงตอนยังไม่จบภาค — ต่ำเพราะปลายภาคยังว่าง ไม่ใช่ตก
 */
function gradeCells(r) {
  const now = gradeNow(r);
  const bad = !now.est && (r.grade === 'มส' || r.grade === '0');
  return [
    h('td', { class: 'num total', style: bad ? { color: 'var(--st-miss)' } : null }, r.dataN ? nf(r.total) : '—'),
    now.est
      ? h('td', {
          class: 'num', style: { color: 'var(--ink-2)' },
          title: `เกรดประมาณ · ได้ ${nf(r.proj, 0)}% ของคะแนนที่ตรวจแล้ว`
        }, '≈' + now.g)
      : h('td', { class: 'num', style: bad ? { color: 'var(--st-miss)' } : null }, r.grade)
  ];
}

function table(rows, cols, S, pend) {
  return h('table', { class: 'grid' },
    h('thead', null,
      h('tr', { class: 'group' },
        h('th', { class: 'sticky-l c-no' }, '#'),
        h('th', { class: 'sticky-l c-name' }, 'ชื่อ-นามสกุล'),
        // ปุ่มจริงในหัวคอลัมน์ — เดิมคลิกที่ th ได้อย่างเดียว กด Tab ไปไม่ถึง โปรแกรมอ่านหน้าจอไม่รู้ว่ากดได้
        cols.map(c => h('th', { class: c.cls, scope: 'col' },
          h('button', {
            class: 'th-copy',
            title: `แตะเพื่อคัดลอกช่องนี้ทั้งห้อง · เต็ม ${S.weight[c.id]}`,
            'aria-label': `คัดลอกช่อง ${c.head}${c.sub ? ' ' + c.sub : ''} ทั้งห้อง (เต็ม ${S.weight[c.id]})`,
            onclick: () => copyColumn(rows, c)
          },
            h('div', { style: { fontWeight: '700' } }, c.head),
            h('div', { style: { fontWeight: '400', fontSize: 'var(--fs-2xs)', opacity: '.8' } },
              c.sub || String(S.weight[c.id])))
        )),
        h('th', { class: 'h-total' }, 'รวม'),
        h('th', { class: 'h1' }, 'เกรด')
      )
    ),
    h('tbody', null, rows.map(r => h('tr', null,
      h('td', { class: 'sticky-l c-no num' }, r.no),
      h('td', {
        class: 'sticky-l c-name',
        title: r.flag || null
      },
        r.name,
        r.grade === 'มส' && h('span', { class: 'badge r', style: { marginLeft: '6px' } }, 'มส')),
      cols.map(c => {
        const p = (pend[r.sid] || {})[c.id] || 0;
        return h('td', { class: 'num', style: r['_has_' + c.id] ? null : { color: 'var(--ink-3)' } },
          cellText(r, c.id), p > 0 && h('span', { class: 'dot-pend' }, '•'));
      }),
      gradeCells(r)
    )))
  );
}

/** ช่องที่ยังไม่มีข้อมูลให้ขึ้น “—” ไม่ใช่ 0 (0 แปลว่านักเรียนได้ 0 จริง ๆ) */
const cellText = (r, id) => (r['_has_' + id] ? nf(r[id]) : '—');

// ── คัดลอก / ส่งออก ─────────────────────────────────────────

async function toClipboard(text, msg) {
  if (await copyText(text)) { toast(msg, 'ok'); return; }
  // คัดลอกอัตโนมัติไม่ได้ทั้งสองวิธี — เปิดกล่องให้ครูเลือกข้อความแล้วคัดลอกเอง
  modal((close) => h('div', null,
    h('h2', null, 'คัดลอกด้วยตัวเอง'),
    h('div', { class: 'hint', style: { marginBottom: '8px' } }, 'เบราว์เซอร์ไม่อนุญาตให้คัดลอกอัตโนมัติ — กดค้างเพื่อเลือกทั้งหมด'),
    h('textarea', { rows: 12, value: text, style: { fontFamily: 'ui-monospace, monospace' } }),
    h('div', { style: { height: '10px' } }),
    h('button', { class: 'btn btn-ghost btn-block', onclick: close }, 'ปิด')
  ));
}

function copyColumn(rows, col) {
  // ช่องที่ยังไม่มีข้อมูล คัดลอกเป็นค่าว่าง — กัน 0 หลุดไปลง SGS
  const has = rows.filter(r => r['_has_' + col.id]).length;
  if (!has) return toast(`ช่อง "${col.head}" ยังไม่มีข้อมูล — ยังไม่ต้องคัดลอก`, 'err', 4000);
  const text = rows.map(r => (r['_has_' + col.id] ? nf(r[col.id]) : '')).join('\n');
  toClipboard(text, has === rows.length
    ? `คัดลอกช่อง "${col.head}" แล้ว ${rows.length} ค่า`
    : `คัดลอกช่อง "${col.head}" แล้ว — มี ${rows.length - has} คนที่ยังไม่มีข้อมูล (เว้นว่างไว้)`);
}

function copyTable(rows, cols) {
  const head = ['เลขที่', 'ชื่อ-นามสกุล', ...cols.map(c => c.head), 'รวม'].join('\t');
  const body = rows.map(r => [r.no, r.name,
    ...cols.map(c => (r['_has_' + c.id] ? nf(r[c.id]) : '')),
    r.dataN ? nf(r.total) : ''].join('\t'));
  toClipboard([head, ...body].join('\n'), 'คัดลอกทั้งตารางแล้ว');
}

