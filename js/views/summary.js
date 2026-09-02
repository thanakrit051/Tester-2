/* หน้าสรุปคะแนน — ตารางตรงกับหน้ากรอกของ SGS */

import { h, modal, toast, nf } from '../dom.js';
import { state, emit, settings, recalcOnServer } from '../state.js';
import { computeClass, BUCKETS, bucketColumns, parseWork } from '../score.js';

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
  const out = {};
  for (const st of (cls.students || [])) {
    const m = {};
    for (const b of BUCKETS) {
      if (b.kind === 'ATT') continue;
      let n = 0;
      for (const c of byBucket[b.id]) {
        if (parseWork((V[c.key] || {})[st.sid]).status === 'none') n++;
      }
      m[b.id] = n;
    }
    out[st.sid] = m;
  }
  return out;
}

export function viewSummary() {
  const cls = state.cls;
  if (!cls) return h('div', { class: 'page empty' }, 'ยังไม่ได้เลือกห้องเรียน');
  if (!cls.students.length) {
    return h('div', { class: 'page' }, h('div', { class: 'card empty' },
      h('div', { class: 'empty-icon' }, '👥'), 'ห้องนี้ยังไม่มีรายชื่อนักเรียน'));
  }

  const S = settings();
  const rows = computeClass(cls, S);
  const cols = SGS_COLS.filter(c => ui.phase === 0 || c.phase === ui.phase);
  const issues = checkIssues(rows, S);
  const pend = pendingMap(cls);
  const pendTotal = rows.reduce((a, r) => a + r.pending, 0);

  if (ui.fill) return fillScreen(rows, S, pend);

  return h('div', { class: 'page page-wide' },

    h('div', { class: 'chips' },
      [[0, 'ทั้งปี'], [1, 'ก่อนกลางภาค'], [2, 'หลังกลางภาค']].map(([v, l]) =>
        h('button', { class: 'chip', 'data-on': ui.phase === v ? '1' : '0', onclick: () => { ui.phase = v; emit(); } }, l))
    ),

    // ── แถบพร้อมกรอก + ปุ่มหลัก (ดีไซน์หน้า 05) ──
    h('div', { class: 'card', style: { display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' } },
      h('div', { style: { flex: '1', minWidth: '180px' } },
        h('div', { style: { fontSize: '15px', fontWeight: '700' } }, `พร้อมกรอกลง SGS · ${rows.length} คน`),
        h('div', { style: { fontSize: '12.5px', color: 'var(--ink-2)', marginTop: '2px' } },
          pendTotal > 0
            ? `ยังไม่ตรวจ ${pendTotal} รายการ — ช่องที่กระทบจะมีจุดส้มกำกับ`
            : 'ตรวจครบทุกรายการแล้ว')),
      h('button', { class: 'btn btn-ghost btn-sm', onclick: () => { ui.fill = true; ui.fi = 0; emit(); } }, '⌨️ โหมดกรอกทีละคน'),
      h('button', {
        class: 'btn btn-sm',
        onclick: async (e) => {
          const b = e.currentTarget; b.disabled = true; b.textContent = 'กำลังบันทึก…';
          try { await recalcOnServer(); toast('เขียนลงชีตแล้ว ✅', 'ok'); }
          catch (err) { toast(err.message, 'err', 5000); }
          finally { b.disabled = false; b.textContent = '💾 บันทึกลงชีต'; }
        }
      }, '💾 บันทึกลงชีต')
    ),

    issues.length > 0 && h('div', { class: 'card', style: { background: 'var(--amber-soft)', border: '1px solid color-mix(in srgb, var(--st-late) 32%, transparent)' } },
      h('div', { style: { fontWeight: '700', marginBottom: '6px' } }, '⚠️ ตรวจก่อนกรอก SGS'),
      h('ul', { style: { margin: 0, paddingLeft: '20px', fontSize: '13px', color: 'var(--warn-ink)' } },
        issues.map(t => h('li', null, t)))),

    h('div', { class: 'card card-tight' },
      h('div', { class: 'tablewrap' }, table(rows, cols, S, pend))),

    h('div', { class: 'sgs-note' },
      h('span', { class: 'dot-pend' }, '•'),
      h('span', null, '= ช่องนี้ยังมีงานค้างตรวจ ตัวเลขอาจเปลี่ยน · แตะหัวคอลัมน์เพื่อคัดลอกทั้งช่องไปวางใน SGS')),

    h('div', { class: 'btn-row', style: { marginTop: '10px' } },
      h('button', { class: 'btn btn-ghost btn-sm', onclick: () => copyTable(rows, cols) }, '📋 คัดลอกทั้งตาราง'),
      h('button', { class: 'btn btn-ghost btn-sm', onclick: () => downloadCSV(rows) }, '⬇️ CSV'))
  );
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

/** โหมดกรอกทีละคน — อ่านคะแนน 8 ช่องเรียงตามลำดับที่ SGS ให้กรอก */
function fillScreen(rows, S, pend) {
  if (!rows.length) { ui.fill = false; return h('div', { class: 'page empty' }, 'ไม่มีนักเรียน'); }
  if (ui.fi >= rows.length) ui.fi = 0;
  const r = rows[ui.fi];
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
        h('b', { style: { color: r.grade === 'มส' || r.grade === '0' ? 'var(--st-miss)' : 'var(--ink)' } },
          r.dataN ? nf(r.total) : '—'),
        h('span', {
          class: 'badge ' + (r.grade === 'มส' || r.grade === '0' ? 'r' : 'g'),
          style: { flex: 'none' }
        }, `เกรด ${r.grade}`))
    ),

    h('div', { class: 'pager' },
      h('button', { class: 'btn btn-ghost', disabled: ui.fi === 0, onclick: () => step(-1) }, '‹'),
      h('button', {
        class: 'btn',
        onclick: () => {
          if (ui.fi < rows.length - 1) step(1);
          else { toast('ครบทุกคนแล้ว 🎉', 'ok'); ui.fill = false; emit(); }
        }
      }, ui.fi < rows.length - 1 ? `คนถัดไป · ${rows[ui.fi + 1].name || ''} ›` : 'เสร็จสิ้น'))
  );
}

// ── ตาราง ───────────────────────────────────────────────────

function table(rows, cols, S, pend) {
  return h('table', { class: 'grid' },
    h('thead', null,
      h('tr', { class: 'group' },
        h('th', { class: 'sticky-l c-no' }, '#'),
        h('th', { class: 'sticky-l c-name' }, 'ชื่อ-นามสกุล'),
        cols.map(c => h('th', {
          class: c.cls,
          title: `แตะเพื่อคัดลอกช่องนี้ทั้งห้อง · เต็ม ${S.weight[c.id]}`,
          style: { cursor: 'pointer' },
          onclick: () => copyColumn(rows, c)
        },
          h('div', { style: { fontWeight: '700' } }, c.head),
          h('div', { style: { fontWeight: '400', fontSize: '11px', opacity: '.8' } },
            c.sub || String(S.weight[c.id]))
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
      h('td', {
        class: 'num total',
        style: (r.grade === 'มส' || r.grade === '0') ? { color: 'var(--st-miss)' } : null
      }, r.dataN ? nf(r.total) : '—'),
      h('td', {
        class: 'num',
        style: (r.grade === 'มส' || r.grade === '0') ? { color: 'var(--st-miss)' } : null
      }, r.grade)
    )))
  );
}

/** ช่องที่ยังไม่มีข้อมูลให้ขึ้น “—” ไม่ใช่ 0 (0 แปลว่านักเรียนได้ 0 จริง ๆ) */
const cellText = (r, id) => (r['_has_' + id] ? nf(r[id]) : '—');

// ── คัดลอก / ส่งออก ─────────────────────────────────────────

async function toClipboard(text, msg) {
  try {
    await navigator.clipboard.writeText(text);
    toast(msg, 'ok');
  } catch {
    modal((close) => h('div', null,
      h('h2', null, 'คัดลอกด้วยตัวเอง'),
      h('div', { class: 'hint', style: { marginBottom: '8px' } }, 'เบราว์เซอร์ไม่อนุญาตให้คัดลอกอัตโนมัติ — กดค้างเพื่อเลือกทั้งหมด'),
      h('textarea', { rows: 12, value: text, style: { fontFamily: 'ui-monospace, monospace' } }),
      h('div', { style: { height: '10px' } }),
      h('button', { class: 'btn btn-block', onclick: close }, 'ปิด')
    ));
  }
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

function downloadCSV(rows) {
  const cls = state.cls;
  const head = ['เลขที่', 'เลขประจำตัว', 'ชื่อ-นามสกุล',
    ...SGS_COLS.map(c => c.head + (c.sub ? ` (${c.sub})` : '')),
    'รวม', 'เกรด', '%เวลาเรียน', 'หมายเหตุ'];
  const lines = [head, ...rows.map(r => [
    r.no, r.sid, r.name,
    ...SGS_COLS.map(c => (r['_has_' + c.id] ? nf(r[c.id]) : '')),
    r.dataN ? nf(r.total) : '', r.grade, r.attN ? r.pct + '%' : '', r.flag
  ])];
  const csv = '﻿' + lines.map(l => l.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const a = h('a', {
    href: URL.createObjectURL(blob),
    download: `SGS_${[cls.meta.grade, cls.meta.room].filter(Boolean).join('-')}_${cls.meta.subject}.csv`
  });
  document.body.append(a); a.click(); a.remove();
  toast('ดาวน์โหลดแล้ว', 'ok');
}

// ── ตรวจความพร้อม ───────────────────────────────────────────

function checkIssues(rows, S) {
  const out = [];

  const empty = BUCKETS.filter(b => !rows.some(r => r['_has_' + b.id]));
  if (empty.length === BUCKETS.length) {
    out.push('ห้องนี้ยังไม่ได้กรอกข้อมูลสักช่อง — ตารางจึงขึ้น “—” ทั้งหมด ยังไม่ต้องนำไปกรอก SGS');
  } else {
    for (const b of empty) {
      out.push(`ยังไม่มีข้อมูล "${b.label} ${b.phase === 1 ? 'ก่อนกลางภาค' : 'หลังกลางภาค'}" (SGS ${b.sgs}) — ช่องนี้จะขึ้น “—” จนกว่าจะกรอก`);
    }
  }

  const pending = rows.filter(r => r.pending > 0).length;
  if (pending) out.push(`มีนักเรียน ${pending} คนที่ยังตรวจงานไม่ครบ (โหมดปัจจุบัน: ${S.ungraded === 'zero' ? 'นับเป็น 0' : 'ไม่นำมาคิด'})`);

  const over = rows.filter(r => r.total > 100);
  if (over.length) out.push(`คะแนนรวมเกิน 100 จำนวน ${over.length} คน — ตรวจน้ำหนักคะแนนในหน้าตั้งค่า`);

  const noName = rows.filter(r => !r.name).length;
  if (noName) out.push(`มี ${noName} แถวที่ไม่มีชื่อนักเรียน`);

  return out;
}
