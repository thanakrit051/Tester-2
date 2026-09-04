/* หน้าสรุปคะแนน — ตารางตรงกับหน้ากรอกของ SGS */

import { h, modal, toast, nf } from '../dom.js';
import { state, emit, settings, recalcOnServer } from '../state.js';
import { computeClass, BUCKETS } from '../score.js';

const ui = { phase: 0 };   // 0 = ทั้งหมด, 1 = ก่อนกลางภาค, 2 = หลังกลางภาค

const SGS_COLS = [
  { id: 'work1', head: '1',        sub: 'ส่งงาน',       phase: 1, cls: 'h1' },
  { id: 'quiz1', head: '2',        sub: 'สอบเก็บ',      phase: 1, cls: 'h1' },
  { id: 'att1',  head: '3',        sub: 'เข้าเรียน',    phase: 1, cls: 'h1' },
  { id: 'mid',   head: 'กลางภาค',  sub: '',             phase: 1, cls: 'h4' },
  { id: 'work2', head: '10',       sub: 'ส่งงาน',       phase: 2, cls: 'h2' },
  { id: 'quiz2', head: '11',       sub: 'สอบเก็บ',      phase: 2, cls: 'h2' },
  { id: 'att2',  head: '12',       sub: 'เข้าเรียน',    phase: 2, cls: 'h2' },
  { id: 'fin',   head: 'ปลายภาค',  sub: '',             phase: 2, cls: 'h4' }
];

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

  return h('div', { class: 'page page-wide' },

    h('div', { class: 'chips' },
      [[0, 'ทั้งปี'], [1, 'ก่อนกลางภาค'], [2, 'หลังกลางภาค']].map(([v, l]) =>
        h('button', { class: 'chip', 'data-on': ui.phase === v ? '1' : '0', onclick: () => { ui.phase = v; emit(); } }, l))
    ),

    issues.length > 0 && h('div', { class: 'card', style: { background: 'var(--amber-soft)', border: '1px solid color-mix(in srgb, var(--st-late) 32%, transparent)' } },
      h('div', { style: { fontWeight: '700', marginBottom: '6px' } }, '⚠️ ตรวจก่อนกรอก SGS'),
      h('ul', { style: { margin: 0, paddingLeft: '20px', fontSize: '13px', color: 'var(--warn-ink)' } },
        issues.map(t => h('li', null, t)))),

    h('div', { class: 'card', style: { padding: '10px 12px' } },
      h('div', { class: 'btn-row' },
        h('button', { class: 'btn btn-sm', onclick: () => openFillMode(rows, cols) }, '⌨️ โหมดกรอก SGS'),
        h('button', { class: 'btn btn-soft btn-sm', onclick: () => copyTable(rows, cols) }, '📋 คัดลอกทั้งตาราง'),
        h('button', { class: 'btn btn-ghost btn-sm', onclick: () => downloadCSV(rows) }, '⬇️ CSV'),
        h('button', {
          class: 'btn btn-ghost btn-sm',
          onclick: async (e) => {
            const b = e.currentTarget; b.disabled = true; b.textContent = 'กำลังบันทึก…';
            try { await recalcOnServer(); toast('เขียนลงชีตแล้ว ✅', 'ok'); }
            catch (err) { toast(err.message, 'err', 5000); }
            finally { b.disabled = false; b.textContent = '💾 บันทึกลงชีต'; }
          }
        }, '💾 บันทึกลงชีต')
      ),
      h('div', { class: 'hint', style: { marginTop: '8px' } },
        'แตะหัวคอลัมน์เพื่อคัดลอกคะแนนช่องนั้นทั้งห้อง (เรียงตามเลขที่) แล้วนำไปวางใน SGS')
    ),

    h('div', { class: 'card card-tight' },
      h('div', { class: 'tablewrap' }, table(rows, cols, S)))
  );
}

// ── ตาราง ───────────────────────────────────────────────────

function table(rows, cols, S) {
  const groups = [];
  if (ui.phase !== 2) groups.push({ label: 'ก่อนกลางภาค (45 คะแนน)', span: cols.filter(c => c.phase === 1).length, cls: 'h1' });
  if (ui.phase !== 1) groups.push({ label: 'หลังกลางภาค (55 คะแนน)', span: cols.filter(c => c.phase === 2).length, cls: 'h2' });

  return h('table', { class: 'grid' },
    h('thead', null,
      h('tr', { class: 'group' },
        h('th', { class: 'sticky-l', colspan: '2' }, 'นักเรียน'),
        groups.map(g => h('th', { class: g.cls, colspan: String(g.span) }, g.label)),
        h('th', { class: 'h5', colspan: '3' }, 'สรุป')
      ),
      h('tr', null,
        h('th', { class: 'sticky-l' }, 'เลขที่'),
        h('th', { class: 'sticky-l', style: { left: '52px' } }, 'ชื่อ-นามสกุล'),
        cols.map(c => h('th', {
          title: 'แตะเพื่อคัดลอกคอลัมน์นี้',
          style: { cursor: 'pointer' },
          onclick: () => copyColumn(rows, c)
        },
          h('div', { style: { fontWeight: '700' } }, c.head),
          h('div', { style: { fontWeight: '400', color: 'var(--ink-3)', fontSize: '10px' } },
            c.sub || `เต็ม ${S.weight[c.id]}`),
          h('div', { style: { fontSize: '9px', color: 'var(--green)' } }, '⧉ คัดลอก')
        )),
        h('th', null, 'รวม'), h('th', null, 'เกรด'), h('th', null, 'หมายเหตุ')
      )
    ),
    h('tbody', null, rows.map(r => h('tr', null,
      h('td', { class: 'sticky-l num' }, r.no),
      h('td', { class: 'sticky-l', style: { left: '52px', minWidth: '150px' } }, r.name),
      cols.map(c => h('td', { class: 'num', style: r['_has_' + c.id] ? null : { color: 'var(--ink-3)' } }, cellText(r, c.id))),
      h('td', { class: 'num total' }, r.dataN ? nf(r.total) : '—'),
      h('td', { class: 'num' }, r.grade),
      h('td', { style: { fontSize: '11px', color: 'var(--red)', textAlign: 'left', whiteSpace: 'normal', minWidth: '150px' } }, r.flag)
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

// ── โหมดกรอกทีละคน (สำหรับ SGS ที่วางทั้งคอลัมน์ไม่ได้) ────

function openFillMode(rows, cols) {
  let ci = 0, ri = 0;
  modal((close) => {
    const box = h('div');
    const draw = () => {
      const col = cols[ci], r = rows[ri];
      box.replaceChildren(
        h('h2', null, `กรอก SGS · ช่อง "${col.head}"${col.sub ? ' (' + col.sub + ')' : ''}`),
        h('div', { class: 'chips', style: { marginBottom: '8px' } },
          cols.map((c, i) => h('button', {
            class: 'chip', 'data-on': i === ci ? '1' : '0',
            onclick: () => { ci = i; ri = 0; draw(); }
          }, c.head))),
        h('div', {
          style: {
            background: 'var(--green-soft)', borderRadius: '14px', padding: '22px 16px',
            textAlign: 'center', margin: '10px 0'
          }
        },
          h('div', { style: { fontSize: '13px', color: 'var(--ink-2)' } }, `เลขที่ ${r.no}`),
          h('div', { style: { fontSize: '15px', fontWeight: '600', marginBottom: '6px' } }, r.name),
          h('div', {
            style: {
              fontSize: '54px', fontWeight: '700', lineHeight: '1',
              color: r['_has_' + col.id] ? 'var(--green)' : 'var(--ink-3)'
            }
          }, cellText(r, col.id)),
          h('div', { style: { fontSize: '12px', color: 'var(--ink-3)', marginTop: '6px' } },
            `${ri + 1} / ${rows.length}`)),
        h('div', { class: 'btn-row' },
          h('button', { class: 'btn btn-ghost', style: { flex: '1' }, disabled: ri === 0, onclick: () => { ri--; draw(); } }, '‹ ก่อนหน้า'),
          h('button', {
            class: 'btn', style: { flex: '2' },
            onclick: () => {
              if (ri < rows.length - 1) { ri++; draw(); }
              else if (ci < cols.length - 1) { ci++; ri = 0; draw(); toast('ไปช่องถัดไป', 'ok', 1200); }
              else { toast('ครบทุกช่องแล้ว 🎉', 'ok'); close(); }
            }
          }, 'ถัดไป ›')),
        h('button', { class: 'btn btn-ghost btn-block', style: { marginTop: '8px' }, onclick: close }, 'ปิด')
      );
    };
    draw();
    return box;
  });
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
