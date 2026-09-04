/* หน้ารายงานผล — สถิติรายห้อง และรายบุคคล
 *
 * สีสถานะใช้ชุดเดียวกับทั้งแอป (ผ่านการตรวจ contrast/ตาบอดสีแล้ว)
 * ทุกกราฟมีตัวเลขกำกับและมีตารางข้อมูลควบเสมอ ไม่สื่อความหมายด้วยสีอย่างเดียว
 */

import { h, toast, fmtDate, fmtDayFull, nf, modal } from '../dom.js';
import { state, emit, settings } from '../state.js';
import { computeClass, bucketColumns, parseWork, BUCKETS, ATT_CODES, ATT_NAMES } from '../score.js';

const ui = { tab: 'class', sid: null, q: '' };

// สถานะ → สี + ชื่อ (ใช้ร่วมกันทั้งหน้า)
// สีอ่านจากตัวแปรใน styles.css เพื่อให้โหมดมืดเปลี่ยนตามได้เอง
// ทั้ง 2 ชุดผ่านเครื่องตรวจตาบอดสีแล้ว — แก้ค่าเมื่อไหร่ต้องรันตรวจซ้ำ
const ATT_STYLE = {
  'ม': { c: 'var(--st-ok)',    t: 'var(--on-ok)',    label: 'มา' },
  'ส': { c: 'var(--st-late)',  t: 'var(--on-late)',  label: 'สาย' },
  'ล': { c: 'var(--st-leave)', t: 'var(--on-leave)', label: 'ลา' },
  'ข': { c: 'var(--st-miss)',  t: 'var(--on-miss)',  label: 'ขาด' }
};
const WORK_STYLE = {
  ok:   { c: 'var(--st-ok)',   t: 'var(--on-ok)',   label: 'ส่ง',        exam: 'สอบแล้ว' },
  late: { c: 'var(--st-late)', t: 'var(--on-late)', label: 'ส่งช้า',     exam: 'ส่งช้า' },
  miss: { c: 'var(--st-miss)', t: 'var(--on-miss)', label: 'ไม่ส่ง',     exam: 'ยังไม่ได้สอบ' },
  none: { c: 'var(--st-none)', t: 'var(--ink)',     label: 'ยังไม่ตรวจ', exam: 'ยังไม่กรอก' }
};

/** ข้อสอบ (สอบเก็บคะแนน/กลางภาค/ปลายภาค) เรียกสถานะคนละคำกับงานส่ง */
const isExam = (col) => col && col.kind !== 'WORK';
const statusLabel = (k, col) => (isExam(col) ? WORK_STYLE[k].exam : WORK_STYLE[k].label);
const BADGE_CLASS = { ok: 'g', late: 'a', miss: 'r', none: 'n' };

export function viewReport() {
  const cls = state.cls;
  if (!cls) return h('div', { class: 'page empty' }, 'ยังไม่ได้เลือกห้องเรียน');
  if (!cls.students.length) {
    return h('div', { class: 'page' }, h('div', { class: 'card empty' },
      h('div', { class: 'empty-icon' }, '👥'), 'ห้องนี้ยังไม่มีรายชื่อนักเรียน'));
  }

  return h('div', { class: 'page' },
    h('div', { class: 'chips' },
      h('button', { class: 'chip', 'data-on': ui.tab === 'class' ? '1' : '0', onclick: () => { ui.tab = 'class'; emit(); } }, '🏫 ทั้งห้อง'),
      h('button', { class: 'chip', 'data-on': ui.tab === 'student' ? '1' : '0', onclick: () => { ui.tab = 'student'; emit(); } }, '👤 รายคน')
    ),
    ui.tab === 'class' ? classReport() : studentReport()
  );
}

// ── ตัวช่วยรวมข้อมูล ────────────────────────────────────────

function attColumns() {
  return (state.cls.columns || []).filter(c => c.kind === 'ATT')
    .sort((a, b) => (a.date + String(a.period).padStart(3, '0')).localeCompare(b.date + String(b.period).padStart(3, '0')));
}

function workColumns() {
  return (state.cls.columns || []).filter(c => ['WORK', 'QUIZ', 'MID', 'FIN'].includes(c.kind));
}

/** นับสถานะการมาเรียนของนักเรียนคนหนึ่ง (หรือทั้งห้องถ้าไม่ระบุ sid) */
function attCount(sid) {
  const out = { 'ม': 0, 'ส': 0, 'ล': 0, 'ข': 0, blank: 0 };
  const V = state.cls.values || {};
  for (const c of attColumns()) {
    const list = sid ? [sid] : state.cls.students.map(s => s.sid);
    for (const id of list) {
      const v = String((V[c.key] || {})[id] ?? '').trim();
      if (ATT_CODES.includes(v)) out[v]++; else out.blank++;
    }
  }
  return out;
}

function workCount(col, sid) {
  const out = { ok: 0, late: 0, miss: 0, none: 0 };
  const m = (state.cls.values || {})[col.key] || {};
  const list = sid ? [sid] : state.cls.students.map(s => s.sid);
  for (const id of list) out[parseWork(m[id]).status]++;
  return out;
}

// ── ชิ้นส่วนกราฟ (แถบสัดส่วน + ตัวเลขกำกับ + คำอธิบายสี) ────

/** segs: [{ key, n, c, label }] */
function stackBar(segs, { height = 22 } = {}) {
  const total = segs.reduce((a, s) => a + s.n, 0);
  if (!total) return h('div', { class: 'bar-empty' }, 'ยังไม่มีข้อมูล');
  return h('div', { class: 'stackbar', style: { height: height + 'px' } },
    segs.filter(s => s.n > 0).map(s => {
      const pct = s.n / total * 100;
      return h('div', {
        class: 'stackseg',
        style: { width: pct + '%', background: s.c, color: s.t || '#fff' },
        title: `${s.label} ${s.n} (${nf(pct, 0)}%)`
      }, pct >= 11 ? h('span', null, String(s.n)) : null);
    })
  );
}

function legend(segs) {
  const total = segs.reduce((a, s) => a + s.n, 0) || 1;
  return h('div', { class: 'legend' },
    segs.map(s => h('span', { class: 'legend-item' },
      h('i', { style: { background: s.c } }),
      `${s.label} ${s.n}`,
      h('b', null, ` ${nf(s.n / total * 100, 0)}%`)
    ))
  );
}

/** แถบค่าเดียวเทียบเต็ม — ใช้กับคะแนนรายถัง (สีเดียว ไล่ตามขนาด) */
function meter(value, max, { label, sub, none } = {}) {
  const pct = none || max <= 0 ? 0 : Math.max(0, Math.min(100, value / max * 100));
  return h('div', { class: 'meter-row' },
    h('div', { class: 'meter-label' }, label, sub && h('span', null, sub)),
    h('div', { class: 'meter-track' }, h('div', { class: 'meter-fill', style: { width: pct + '%' } })),
    h('div', { class: 'meter-val tnum', style: none ? { color: 'var(--ink-3)' } : null },
      none ? `—/${max}` : `${nf(value)}/${max}`)
  );
}

// ── รายงานทั้งห้อง ──────────────────────────────────────────

function classReport() {
  const cls = state.cls;
  const S = settings();
  const rows = computeClass(cls, S);
  const att = attCount(null);
  const attCols = attColumns();
  const wCols = workColumns();

  // นับเฉพาะคนที่มีข้อมูลจริง — ยังไม่กรอกต้องขึ้น “—” ไม่ใช่ตัวเลขลอย ๆ
  const graded = rows.filter(r => r.dataN > 0);
  const withAtt = rows.filter(r => r.attN > 0);
  const avg = graded.length ? graded.reduce((a, r) => a + r.total, 0) / graded.length : null;
  const avgPct = withAtt.length ? withAtt.reduce((a, r) => a + r.pct, 0) / withAtt.length : null;
  const risk = rows.filter(r => r.grade === 'มส');
  const pendingTotal = rows.reduce((a, r) => a + r.pending, 0);

  const attSegs = ATT_CODES.map(k => ({ key: k, n: att[k], c: ATT_STYLE[k].c, t: ATT_STYLE[k].t, label: ATT_STYLE[k].label }));

  // การกระจายเกรด
  const gradeOrder = ['4', '3.5', '3', '2.5', '2', '1.5', '1', '0', 'มส'];
  const gCount = {};
  rows.forEach(r => { gCount[r.grade] = (gCount[r.grade] || 0) + 1; });
  const grades = gradeOrder.filter(g => gCount[g]).map(g => ({ g, n: gCount[g] }));
  const gMax = Math.max(...grades.map(x => x.n), 1);

  // ผู้ที่ต้องติดตาม
  const watch = graded
    .map(r => ({ r, score: (r.grade === 'มส' ? 1000 : 0) + r.pending * 10 + Math.max(0, 60 - r.total) }))
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 12);

  return h('div', null,
    h('div', { class: 'stats', style: { marginBottom: '12px' } },
      stat('g', rows.length, 'นักเรียน'),
      stat('b', avg === null ? '—' : nf(avg, 1), 'คะแนนเฉลี่ย'),
      stat(avgPct !== null && avgPct < S.minPct ? 'r' : 'g',
        avgPct === null ? '—' : nf(avgPct, 1) + '%', 'เวลาเรียนเฉลี่ย'),
      stat(risk.length ? 'r' : 'g', risk.length, 'เสี่ยง มส')
    ),

    // ── การมาเรียน ──
    h('div', { class: 'card' },
      h('div', { class: 'rep-head' },
        h('h3', null, '🕐 การมาเรียนทั้งห้อง'),
        h('span', null, `${attCols.length} คาบ`)),
      attCols.length === 0
        ? h('div', { class: 'bar-empty' }, 'ยังไม่ได้เช็คชื่อ')
        : h('div', null, stackBar(attSegs), legend(attSegs),
            att.blank > 0 && h('div', { class: 'hint' }, `ยังไม่ได้เช็ค ${att.blank} ช่อง`))
    ),

    // ── การส่งงาน รายชิ้น ──
    h('div', { class: 'card' },
      h('div', { class: 'rep-head' },
        h('h3', null, '📝 การส่งงานรายชิ้น'),
        h('span', null, `${wCols.length} รายการ`)),
      wCols.length === 0
        ? h('div', { class: 'bar-empty' }, 'ยังไม่มีรายการงาน/สอบ')
        : h('div', null,
            h('div', { class: 'legend', style: { marginBottom: '8px' } },
              Object.entries(WORK_STYLE).map(([k, v]) => {
                const hasWork = wCols.some(c => !isExam(c)), hasExam = wCols.some(isExam);
                const txt = hasWork && hasExam && v.label !== v.exam
                  ? `${v.label} / ${v.exam}` : (hasExam && !hasWork ? v.exam : v.label);
                return h('span', { class: 'legend-item' }, h('i', { style: { background: v.c } }), txt);
              })),
            wCols.map(c => {
              const t = workCount(c);
              const segs = ['ok', 'late', 'miss', 'none'].map(k =>
                ({ key: k, n: t[k], c: WORK_STYLE[k].c, t: WORK_STYLE[k].t, label: statusLabel(k, c) }));
              return h('div', { class: 'multi-row' },
                h('div', { class: 'multi-label' }, c.label,
                  h('span', null, bucketName(c))),
                stackBar(segs, { height: 18 }));
            }))
    ),

    // ── การกระจายเกรด ──
    h('div', { class: 'card' },
      h('div', { class: 'rep-head' }, h('h3', null, '🎓 การกระจายเกรด (ประมาณการ)')),
      h('div', { class: 'hint', style: { marginTop: 0, marginBottom: '10px' } },
        'คิดจากข้อมูลที่กรอกแล้วเท่านั้น จะเปลี่ยนเมื่อกรอกครบทั้งเทอม'),
      grades.map(x => h('div', { class: 'meter-row' },
        h('div', { class: 'meter-label', style: { width: '46px' } }, 'เกรด ' + x.g),
        h('div', { class: 'meter-track' },
          h('div', {
            class: 'meter-fill',
            style: { width: (x.n / gMax * 100) + '%', background: x.g === 'มส' ? 'var(--st-miss)' : null }
          })),
        h('div', { class: 'meter-val tnum' }, x.n + ' คน')))
    ),

    // ── ต้องติดตาม ──
    h('div', { class: 'card card-tight' },
      h('div', { class: 'card-head' }, h('h2', null, '⚠️ นักเรียนที่ต้องติดตาม')),
      watch.length === 0
        ? h('div', { class: 'empty', style: { padding: '22px' } }, 'ไม่มีใครน่าเป็นห่วง 🎉')
        : watch.map(({ r }) => h('button', {
            class: 'list-row',
            onclick: () => { ui.tab = 'student'; ui.sid = r.sid; emit(); }
          },
            h('div', { class: 'stu-no' }, r.no),
            h('div', { class: 'list-main' },
              h('div', { class: 'list-title' }, r.name),
              h('div', { class: 'list-sub', style: { color: 'var(--red)' } }, r.flag || 'คะแนนต่ำ')),
            h('div', { class: 'tnum', style: { fontWeight: '700' } }, nf(r.total)),
            h('span', { class: 'list-chevron' }, '›')))
    ),

    h('button', { class: 'btn btn-ghost btn-block', onclick: () => exportReport(rows) }, '⬇️ ดาวน์โหลดรายงานเป็น CSV')
  );
}

function bucketName(c) {
  const b = BUCKETS.find(x => x.kind === c.kind && x.half === c.half);
  if (!b) return '';
  return `${b.label} · ${b.phase === 1 ? 'ก่อนกลางภาค' : 'หลังกลางภาค'} · เต็ม ${c.max}`;
}

// ── รายงานรายคน ────────────────────────────────────────────

function studentReport() {
  const cls = state.cls;
  const S = settings();
  const rows = computeClass(cls, S);
  if (!ui.sid || !rows.some(r => r.sid === ui.sid)) ui.sid = rows[0].sid;
  const r = rows.find(x => x.sid === ui.sid);

  const q = ui.q.trim().toLowerCase();
  const matches = q
    ? cls.students.filter(s => s.name.toLowerCase().includes(q) || String(s.no) === q || s.sid.includes(q))
    : [];

  const att = attCount(r.sid);
  const attSegs = ATT_CODES.map(k => ({ key: k, n: att[k], c: ATT_STYLE[k].c, t: ATT_STYLE[k].t, label: ATT_STYLE[k].label }));
  const byBucket = bucketColumns(cls);

  return h('div', null,
    // ── ค้นหา / เลือกคน ──
    h('div', { class: 'card' },
      h('div', { style: { display: 'flex', gap: '8px' } },
        h('button', { class: 'btn btn-ghost btn-sm', onclick: () => moveStudent(-1, rows) }, '‹'),
        h('input', {
          placeholder: 'ค้นหาชื่อ หรือ เลขที่…', value: ui.q,
          oninput: (e) => { ui.q = e.target.value; emit(); }
        }),
        h('button', { class: 'btn btn-ghost btn-sm', onclick: () => moveStudent(1, rows) }, '›')),
      matches.length > 0 && h('div', { class: 'search-hits' },
        matches.slice(0, 8).map(s => h('button', {
          class: 'chip', onclick: () => { ui.sid = s.sid; ui.q = ''; emit(); }
        }, `${s.no}. ${s.name}`)))
    ),

    // ── หัวข้อมูลนักเรียน ──
    h('div', { class: 'card', style: { textAlign: 'center' } },
      h('div', { style: { fontSize: '12.5px', color: 'var(--ink-2)' } }, `เลขที่ ${r.no} · ${r.sid}`),
      h('div', { style: { fontSize: '18px', fontWeight: '700', margin: '2px 0 8px' } }, r.name),
      h('div', { style: { display: 'flex', justifyContent: 'center', gap: '22px' } },
        h('div', null,
          h('div', {
            style: {
              fontSize: '30px', fontWeight: '700', lineHeight: '1',
              color: r.dataN ? 'var(--green)' : 'var(--ink-3)'
            }
          }, r.dataN ? nf(r.total) : '—'),
          h('div', { class: 'stat-lbl' }, 'คะแนนรวม /100')),
        h('div', null,
          h('div', { style: { fontSize: '30px', fontWeight: '700', lineHeight: '1', color: r.grade === 'มส' ? 'var(--red)' : 'var(--ink)' } }, r.grade),
          h('div', { class: 'stat-lbl' }, 'เกรด (ประมาณการ)'))),
      r.flag && h('div', { style: { marginTop: '10px', color: 'var(--red)', fontSize: '13px', fontWeight: '600' } }, '⚠️ ' + r.flag)
    ),

    // ── คะแนน 8 ช่อง ──
    h('div', { class: 'card' },
      h('div', { class: 'rep-head' }, h('h3', null, '📊 คะแนนรายช่อง (ตรงกับ SGS)')),
      BUCKETS.map(b => meter(r[b.id], S.weight[b.id], {
        label: b.label,
        sub: `${b.phase === 1 ? 'ก่อน' : 'หลัง'}กลางภาค · SGS ${b.sgs}`,
        none: !r['_has_' + b.id]
      }))
    ),

    // ── การมาเรียน ──
    h('div', { class: 'card' },
      h('div', { class: 'rep-head' },
        h('h3', null, '🕐 การมาเรียน'),
        h('span', { style: { color: r.attN && r.pct < S.minPct ? 'var(--red)' : 'var(--green)', fontWeight: '700' } },
          r.attN ? r.pct + '%' : '—')),
      attColumns().length === 0
        ? h('div', { class: 'bar-empty' }, 'ยังไม่ได้เช็คชื่อ')
        : h('div', null, stackBar(attSegs), legend(attSegs),
            att['ข'] + att['ส'] + att['ล'] > 0 && h('details', { class: 'rep-details' },
              h('summary', null, `ดูวันที่ไม่ปกติ (${att['ข'] + att['ส'] + att['ล']} คาบ)`),
              attColumns().map(c => {
                const v = String((cls.values[c.key] || {})[r.sid] ?? '').trim();
                if (!v || v === 'ม') return null;
                return h('div', { class: 'rep-line' },
                  h('span', null, fmtDayFull(c.date) + (c.period > 1 ? ` · คาบ ${c.period}` : '')),
                  h('span', { style: { color: ATT_STYLE[v].c, fontWeight: '700' } }, ATT_STYLE[v].label));
              })))
    ),

    // ── งานรายชิ้น ──
    h('div', { class: 'card card-tight' },
      h('div', { class: 'card-head' }, h('h2', null, '📝 งานและคะแนนรายชิ้น')),
      workColumns().length === 0
        ? h('div', { class: 'empty', style: { padding: '22px' } }, 'ยังไม่มีรายการงาน/สอบ')
        : BUCKETS.filter(b => b.kind !== 'ATT').map(b => {
            const cols = byBucket[b.id];
            if (!cols.length) return null;
            return h('div', null,
              h('div', { class: 'sub-head' }, `${b.label} · ${b.phase === 1 ? 'ก่อนกลางภาค' : 'หลังกลางภาค'}`),
              cols.map(c => {
                const w = parseWork((cls.values[c.key] || {})[r.sid]);
                const stl = WORK_STYLE[w.status];
                return h('div', { class: 'list-row' },
                  h('div', { class: 'list-main' },
                    h('div', { class: 'list-title' }, c.label),
                    c.desc && h('div', { class: 'list-sub' }, c.desc)),
                  h('span', { class: 'badge ' + BADGE_CLASS[w.status] }, statusLabel(w.status, c)),
                  h('div', { class: 'tnum', style: { width: '58px', textAlign: 'right', fontWeight: '600' } },
                    w.status === 'none' ? '—' : `${nf(w.score)}/${c.max}`));
              }));
          })
    )
  );
}

function moveStudent(delta, rows) {
  const i = rows.findIndex(r => r.sid === ui.sid);
  const next = rows[(i + delta + rows.length) % rows.length];
  ui.sid = next.sid; ui.q = '';
  emit();
}

// ── ส่งออก ──────────────────────────────────────────────────

function exportReport(rows) {
  const cls = state.cls;
  const att = {};
  cls.students.forEach(s => { att[s.sid] = attCount(s.sid); });

  const head = ['เลขที่', 'เลขประจำตัว', 'ชื่อ-นามสกุล',
    'มา', 'สาย', 'ลา', 'ขาด', '%เวลาเรียน',
    ...BUCKETS.map(b => `${b.label} (SGS ${b.sgs})`),
    'รวม', 'เกรด', 'ค้างตรวจ', 'ส่งช้า', 'หมายเหตุ'];

  const lines = [head, ...rows.map(r => [
    r.no, r.sid, r.name,
    att[r.sid]['ม'], att[r.sid]['ส'], att[r.sid]['ล'], att[r.sid]['ข'], r.attN ? r.pct + '%' : '',
    ...BUCKETS.map(b => (r['_has_' + b.id] ? nf(r[b.id]) : '')),
    r.dataN ? nf(r.total) : '', r.grade, r.pending, r.late || 0, r.flag
  ])];

  const csv = '﻿' + lines.map(l => l.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const a = h('a', {
    href: URL.createObjectURL(blob),
    download: `รายงาน_${[cls.meta.grade, cls.meta.room].filter(Boolean).join('-')}_${cls.meta.subject}.csv`
  });
  document.body.append(a); a.click(); a.remove();
  toast('ดาวน์โหลดแล้ว', 'ok');
}

const stat = (c, num, lbl) => h('div', { class: 'stat ' + c },
  h('div', { class: 'stat-num' }, String(num)), h('div', { class: 'stat-lbl' }, lbl));
