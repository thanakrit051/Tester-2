/* หน้ารายงานผล — สถิติรายห้อง และรายบุคคล
 *
 * สีสถานะใช้ชุดเดียวกับทั้งแอป (ผ่านการตรวจ contrast/ตาบอดสีแล้ว)
 * ทุกกราฟมีตัวเลขกำกับและมีตารางข้อมูลควบเสมอ ไม่สื่อความหมายด้วยสีอย่างเดียว
 */

import { h, toast, fmtDate, nf } from '../dom.js';
import { state, emit, settings, go } from '../state.js';
import { computeClass, parseWork, BUCKETS, ATT_CODES } from '../score.js';

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

export function viewReport() {
  const cls = state.cls;
  if (!cls) {
    return h('div', { class: 'page empty' },
      state.loadingClass ? 'กำลังโหลดห้องเรียน…' : 'ยังไม่ได้เลือกห้องเรียน');
  }
  if (!cls.students.length) {
    return h('div', { class: 'page' }, h('div', { class: 'card empty' },
      h('div', { class: 'empty-icon' }, '👥'), 'ห้องนี้ยังไม่มีรายชื่อนักเรียน'));
  }

  return h('div', { class: 'page' },
    // แท็บ + ปุ่มส่งออก — ดีไซน์วางไว้แถวบนสุด ปุ่มส่งออกชิดขวา
    h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' } },
      h('button', { class: 'chip', 'data-on': ui.tab === 'class' ? '1' : '0', onclick: () => { ui.tab = 'class'; emit(); } }, 'ทั้งห้อง'),
      h('button', { class: 'chip', 'data-on': ui.tab === 'student' ? '1' : '0', onclick: () => { ui.tab = 'student'; emit(); } }, 'รายคน'),
      h('button', {
        class: 'chip', style: { marginLeft: 'auto' },
        onclick: () => exportReport(computeClass(cls, settings()))
      }, '⤓ ออกไฟล์ CSV')
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

  // ตัวเลขสรุปทั้งห้องอยู่หน้าแรกแล้ว หน้านี้จึงเริ่มที่กราฟเลยตามดีไซน์
  return h('div', null,

    // ── สองการ์ดคู่กัน: การมาเรียน · การกระจายเกรด (ดีไซน์หน้า 04) ──
    h('div', { class: 'rep-grid', style: { marginBottom: '12px' } },

      h('div', { class: 'card' },
        h('div', { class: 'rep-head' },
          h('h3', null, 'สัดส่วนการมาเรียน'),
          h('span', null, `${attCols.length} คาบ`)),
        attCols.length === 0
          ? h('div', { class: 'bar-empty' }, 'ยังไม่ได้เช็คชื่อ')
          : h('div', null, stackBar(attSegs, { height: 26 }), legend(attSegs),
              att.blank > 0 && h('div', { class: 'hint' }, `ยังไม่ได้เช็ค ${att.blank} ช่อง`))
      ),

      h('div', { class: 'card' },
        h('div', { class: 'rep-head' },
          h('h3', null, 'การกระจายเกรด'),
          h('span', null, 'ประมาณการ')),
        grades.length === 0
          ? h('div', { class: 'bar-empty' }, 'ยังไม่มีคะแนนพอจะตัดเกรด')
          : h('div', null,
              h('div', { class: 'gradebars' },
                grades.map(x => h('div', { class: 'gcol' },
                  h('div', { class: 'gcol-n' }, String(x.n)),
                  h('div', {
                    // ดีไซน์: เกรด 1 = ส้มเตือน · เกรด 0 กับ มส = แดง
                    class: 'gcol-bar' + ((x.g === 'มส' || x.g === '0') ? ' bad' : (x.g === '1' ? ' warn' : '')),
                    style: { height: Math.round(8 + (x.n / gMax) * 56) + 'px' },
                    title: `เกรด ${x.g} · ${x.n} คน`
                  })))),
              h('div', { class: 'gaxis' }, grades.map(x => h('div', null, x.g))))
      )
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
              Object.entries(WORK_STYLE).map(([, v]) => {
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

    // ── ต้องติดตาม — เรียงตามความเร่งด่วน พื้นหลังบอกระดับ ──
    h('div', { class: 'card' },
      h('div', { class: 'rep-head' },
        h('h3', null, `ต้องติดตาม · ${watch.length} คน`),
        h('span', null, 'เรียงตามความเร่งด่วน')),
      watch.length === 0
        ? h('div', { class: 'empty', style: { padding: '22px' } }, 'ไม่มีใครน่าเป็นห่วง 🎉')
        : watch.map(({ r }) => {
            const bad = r.grade === 'มส' || r.flag.includes('เสี่ยงติด 0');
            const warn = !bad && (r.attN > 0 && r.pct < S.minPct + 5);
            return h('button', {
              class: 'watch-row' + (bad ? ' bad' : (warn ? ' warn' : '')),
              onclick: () => { ui.tab = 'student'; ui.sid = r.sid; emit(); }
            },
              h('div', { class: 'w-name' }, r.name || '—', h('span', null, ` เลขที่ ${r.no}`)),
              r.attN > 0 && h('div', { class: 'w-tag ' + (r.pct < S.minPct ? 'bad' : (warn ? 'warn' : 'dim')) },
                (r.pct < S.minPct ? 'มส · ' : '') + `เวลาเรียน ${nf(r.pct, 0)}%`),
              h('div', { class: 'w-tag ' + (bad ? 'bad' : 'dim') },
                r.pending > 0 ? `ยังไม่ตรวจ ${r.pending} รายการ` : `รวม ${nf(r.total)}`),
              h('span', { class: 'w-go' }, '›'));
          })
    )
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

  // งานที่ยังไม่ส่ง หรือครูยังไม่ได้ตรวจ — เรียงไม่ส่งขึ้นก่อน
  const todo = workColumns()
    .map(c => ({ c, w: parseWork((cls.values[c.key] || {})[r.sid]) }))
    .filter(x => x.w.status === 'miss' || x.w.status === 'none')
    .sort((a, b) => (a.w.status === 'miss' ? 0 : 1) - (b.w.status === 'miss' ? 0 : 1));

  return h('div', null,
    // ── PC: ชื่อ + ค้นหา + เปลี่ยนคน (มือถืออยู่ในแถบเข้มด้านบนแล้ว) ──
    h('div', { class: 'ctxbar' },
      h('div', { style: { flex: '1', minWidth: '0' } },
        h('div', { class: 'ctx-title' }, r.name || '—'),
        h('div', { class: 'ctx-sub' }, `เลขที่ ${r.no}${r.sid ? ' · ' + r.sid : ''}`)),
      h('div', { style: { position: 'relative' } },
        h('input', {
          placeholder: '🔍 ค้นหาชื่อ หรือเลขที่', value: ui.q, style: { minWidth: '210px' },
          oninput: (e) => { ui.q = e.target.value; emit(); }
        }),
        matches.length > 0 && h('div', { class: 'search-hits' },
          matches.slice(0, 6).map(s => h('button', {
            class: 'chip', onclick: () => { ui.sid = s.sid; ui.q = ''; emit(); }
          }, `${s.no}. ${s.name}`)))),
      h('div', { class: 'ctx-end' },
        h('button', { class: 'btn btn-ghost btn-sm', onclick: () => moveStudent(-1, rows) }, '‹'),
        h('button', { class: 'btn btn-ghost btn-sm', onclick: () => moveStudent(1, rows) }, '›'))),

    // เลือกคนได้ตรง ๆ เหมือนโหมดรายคนของหน้างาน/คะแนน
    // เดิมบนมือถือ .ctxbar ถูกซ่อน (max-width:899px) จึงไม่มีทางเปลี่ยนคนเลย
    // ต้องถอยกลับไปหน้าทั้งห้องแล้วเข้ามาใหม่เท่านั้น
    h('div', { class: 'pick2row pc-hide' },
      h('button', {
        class: 'btn btn-ghost btn-sm', 'aria-label': 'คนก่อนหน้า',
        disabled: rows.findIndex(x => x.sid === ui.sid) <= 0,
        onclick: () => moveStudent(-1, rows)
      }, '‹'),
      h('label', { class: 'pickbox grow' },
        h('span', null, 'นักเรียน'),
        h('select', {
          'aria-label': 'เลือกนักเรียน',
          onchange: (e) => { ui.sid = e.target.value; emit(); }
        }, rows.map(x => h('option', { value: x.sid, selected: x.sid === ui.sid },
          `${x.no}. ${x.name || '—'}`)))),
      h('button', {
        class: 'btn btn-ghost btn-sm', 'aria-label': 'คนถัดไป',
        disabled: rows.findIndex(x => x.sid === ui.sid) >= rows.length - 1,
        onclick: () => moveStudent(1, rows)
      }, '›')),

    // ── ธงเตือน — พื้นหลังบอกระดับตามดีไซน์ ──
    r.flag && h('div', {
      class: 'card',
      style: {
        background: r.grade === 'มส' ? 'var(--miss-soft)' : 'var(--late-soft)',
        display: 'flex', gap: '10px', alignItems: 'center', padding: '12px 14px'
      }
    },
      h('div', { style: { fontSize: '13px', fontWeight: '700', color: r.grade === 'มส' ? 'var(--st-miss)' : 'var(--warn-ink)' } },
        r.grade === 'มส' ? 'มส' : '⚠️'),
      h('div', { style: { fontSize: '12.5px', flex: '1', color: r.grade === 'มส' ? 'var(--st-miss)' : 'var(--warn-ink)' } },
        r.attN && r.pct < S.minPct
          ? `เวลาเรียน ${r.pct}% ต่ำกว่าเกณฑ์ ${S.minPct}% · ขาด ${att['ข']} คาบ`
          : r.flag)),

    // ── คะแนน 8 ช่อง — ตารางย่อ 2 คอลัมน์ (ดีไซน์หน้า 04 มือถือ) ──
    h('div', { class: 'card' },
      h('div', { style: { display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '12px' } },
        h('div', { style: { fontSize: '13.5px', fontWeight: '700', flex: '1' } }, 'คะแนน 8 ช่อง'),
        h('div', {
          class: 'tnum',
          style: { fontSize: '20px', fontWeight: '700', color: r.grade === 'มส' || r.grade === '0' ? 'var(--st-miss)' : 'var(--ink)' }
        }, r.dataN ? nf(r.total) : '—'),
        h('div', { style: { fontSize: '12.5px', color: 'var(--ink-2)' } }, `/100 · เกรด ${r.grade}`)),
      h('div', { class: 'score8' },
        BUCKETS.map(b => h('div', { class: 'score8-cell', title: `SGS ช่อง ${b.sgs}` },
          // สอบกลางภาค/ปลายภาคมีครั้งเดียว ไม่ต้องมีเลขช่วงต่อท้าย
          h('span', null, (b.kind === 'MID' || b.kind === 'FIN') ? b.label : `${b.label} ${b.phase}`),
          h('b', { class: r['_has_' + b.id] ? 'tnum' : 'tnum none' },
            r['_has_' + b.id] ? `${nf(r[b.id])}/${S.weight[b.id]}`
              : (b.kind === 'MID' || b.kind === 'FIN' ? 'ยังไม่สอบ' : '—')))))
    ),

    // ── วันที่ขาด/สาย/ลา — ป้ายสั้น ๆ เรียงกัน (ดีไซน์หน้า 04) ──
    att['ข'] + att['ส'] + att['ล'] > 0 && h('div', { class: 'card' },
      h('div', { style: { fontSize: '13.5px', fontWeight: '700', marginBottom: '10px' } },
        `วันที่ขาด / สาย / ลา · ${att['ข'] + att['ส'] + att['ล']} คาบ`),
      h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '6px' } },
        attColumns().map(c => {
          const v = String((cls.values[c.key] || {})[r.sid] ?? '').trim();
          if (!v || v === 'ม') return null;
          return h('span', {
            class: 'daychip',
            style: { background: `var(--${v === 'ข' ? 'miss' : v === 'ส' ? 'late' : 'leave'}-soft)`, color: ATT_STYLE[v].c }
          }, `${fmtDate(c.date)} ค.${c.period} ${ATT_STYLE[v].label}`);
        }))),

    // ── งานที่ยังค้าง ──
    // หน้านี้เป็น "รายงาน" ไม่ใช่หน้ากรอกคะแนน จึงโชว์เฉพาะสิ่งที่ต้องตามต่อ
    // (รายการงานครบทุกชิ้นพร้อมปุ่มกด อยู่ที่ งาน/คะแนน → รายคน)
    todo.length > 0 && h('div', { class: 'card' },
      h('div', { style: { fontSize: '13.5px', fontWeight: '700', marginBottom: '10px' } },
        `งานที่ยังไม่ส่ง / ยังไม่ตรวจ · ${todo.length} ชิ้น`),
      h('div', { style: { display: 'flex', flexDirection: 'column', gap: '7px', fontSize: '13px' } },
        todo.map(({ c, w }) => h('div', { style: { display: 'flex', gap: '10px' } },
          h('span', { style: { flex: '1', minWidth: '0' } }, c.label),
          h('span', { style: { color: w.status === 'miss' ? 'var(--st-miss)' : 'var(--ink-3)', flex: 'none' } },
            statusLabel(w.status, c)))))),

    h('button', {
      class: 'btn btn-ghost btn-block', style: { marginTop: '4px' },
      onclick: () => go('work')
    }, '📝 ไปกรอกงาน / คะแนนของคนนี้')
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
