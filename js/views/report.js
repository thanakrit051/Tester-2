/* หน้ารายงานผล — สถิติรายห้อง และรายบุคคล
 *
 * สีสถานะใช้ชุดเดียวกับทั้งแอป (ผ่านการตรวจ contrast/ตาบอดสีแล้ว)
 * ทุกกราฟมีตัวเลขกำกับและมีตารางข้อมูลควบเสมอ ไม่สื่อความหมายด้วยสีอย่างเดียว
 */

import { h, toast, fmtDate, nf } from '../dom.js';
import { state, emit, settings, go, sync, refreshClass, fetchedAt } from '../state.js';
import * as api from '../api.js';
import { computeClass, parseWork, BUCKETS, ATT_CODES, passMarkOf, passOf } from '../score.js';

/* tab:    'class' ภาพรวม · 'follow' ตามงาน (ใครยังค้างชิ้นไหน) · 'student' รายคน
 * follow: ตัวกรองของแท็บตามงาน · phase: 0 ทั้งเทอม / 1 ก่อนกลางภาค / 2 หลังกลางภาค
 * focus:  คีย์รายการที่กดมาจากภาพรวม — โชว์ชิ้นเดียว ('' = ทุกชิ้น) */
const ui = { tab: 'class', sid: null, q: '', follow: 'all', phase: 0, focus: '' };

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
      h('button', { class: 'chip', 'data-on': ui.tab === 'class' ? '1' : '0', onclick: () => { ui.tab = 'class'; emit(); } }, 'ภาพรวม'),
      h('button', { class: 'chip', 'data-on': ui.tab === 'follow' ? '1' : '0', onclick: () => { ui.tab = 'follow'; ui.focus = ''; emit(); } }, 'ตามงาน'),
      h('button', { class: 'chip', 'data-on': ui.tab === 'student' ? '1' : '0', onclick: () => { ui.tab = 'student'; emit(); } }, 'รายคน'),
      h('button', {
        class: 'chip', style: { marginLeft: 'auto' },
        onclick: () => exportReport(computeClass(cls, settings()))
      }, '⤓ CSV')
    ),
    freshness(),
    ui.tab === 'class' ? classReport() : ui.tab === 'follow' ? followReport() : studentReport()
  );
}

/**
 * บอกว่าตัวเลขในหน้านี้เป็นของเมื่อไหร่ + ปุ่มดึงใหม่
 *
 * ครูเช็คชื่อจากมือถือแล้วมาเปิดรายงานบนคอม (หรือกลับมาที่แอปที่เปิดค้างไว้ทั้งคาบ)
 * หน้านี้เคยโชว์ข้อมูลชุดที่โหลดไว้ตอนเปิดแอปโดยไม่บอกอะไร = "รายงานไม่ตรงกับที่เช็ค"
 * ตอนนี้แอปดึงใหม่ให้เองเมื่อเปิดหน้านี้ แต่ต้องให้ครูเห็นด้วยว่าเป็นของเมื่อไหร่
 */
function freshness() {
  const at = fetchedAt(state.classId);
  const busy = state.loadingClass === state.classId;
  const pend = api.queue.size;
  return h('div', { class: 'rep-fresh' },
    h('span', null,
      busy ? 'กำลังดึงข้อมูลล่าสุดจากชีต…'
        : at ? `ข้อมูลจากชีตเมื่อ ${new Date(at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น.`
          : 'ข้อมูลที่เก็บไว้ในเครื่อง',
      pend > 0 && !busy ? ` · รอส่งขึ้นชีตอีก ${pend} รายการ (นับรวมในหน้านี้แล้ว)` : ''),
    h('button', {
      class: 'rep-fresh-btn', disabled: busy,
      onclick: async () => { await sync(); await refreshClass({ force: true, loud: true }); }
    }, '↻ ดึงใหม่'));
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
    .map(r => ({ r, score: (r.grade === 'มส' ? 1000 : 0) + r.pending * 10 + r.failN * 25 + Math.max(0, 60 - r.total) }))
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 12);

  // ยอดค้างรวมทุกชิ้น — รายชื่อเต็มอยู่แท็บ "ตามงาน" ตรงนี้บอกแค่ว่ามีให้ตามกี่ราย
  const owe = { miss: 0, fix: 0, none: 0 };
  for (const c of wCols) {
    const g = followOf(c, S);
    owe.miss += g.miss.length;
    owe.fix += g.fix.length + g.refail.length;
    if (!g.untouched) owe.none += g.none.length;
  }

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
            // กดแถวไหน = ไปดูรายชื่อคนที่ยังค้างของชิ้นนั้นในแท็บ "ตามงาน"
            wCols.map(c => {
              const t = workCount(c);
              const segs = ['ok', 'late', 'miss', 'none'].map(k =>
                ({ key: k, n: t[k], c: WORK_STYLE[k].c, t: WORK_STYLE[k].t, label: statusLabel(k, c) }));
              return h('button', {
                class: 'multi-row multi-btn', title: 'ดูรายชื่อคนที่ยังค้างของรายการนี้',
                onclick: () => { ui.tab = 'follow'; ui.focus = c.key; ui.follow = 'all'; emit(); window.scrollTo({ top: 0 }); }
              },
                h('div', { class: 'multi-label' }, c.label,
                  h('span', null, bucketName(c) + ' ›')),
                stackBar(segs, { height: 18 }));
            }))
    ),

    // ── ยอดค้างรวม → ไปแท็บตามงาน ──
    (owe.miss + owe.fix + owe.none) > 0 && h('button', {
      class: 'card owe-card',
      onclick: () => { ui.tab = 'follow'; ui.focus = ''; emit(); window.scrollTo({ top: 0 }); }
    },
      h('div', { class: 'owe-body' },
        h('b', null, 'ยังต้องตามอยู่'),
        h('div', { class: 'owe-tags' },
          owe.miss > 0 && h('span', { class: 'bad' }, `ไม่ส่ง / ขาดสอบ ${owe.miss}`),
          owe.fix > 0 && h('span', { class: 'bad' }, `ต้องซ่อม ${owe.fix}`),
          owe.none > 0 && h('span', { class: 'dim' }, `ยังไม่ตรวจ ${owe.none}`))),
      h('span', { class: 'owe-go' }, 'ดูรายชื่อ ›')),

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
              r.failN > 0 && h('div', { class: 'w-tag bad' }, `ไม่ผ่าน ${r.failN} รายการ`),
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

// ── ตามงาน: ใครยังค้างชิ้นไหน ──────────────────────────────
//
// ครูขอมาตรง ๆ ว่า "งาน 1 เหลือใครบ้าง ใครยังไม่ได้สอบซ่อม เอาเป็นรายชื่อมาเลย"
// หน้าภาพรวมตอบได้แค่เป็นแถบสัดส่วน ต้องกดไล่ทีละคนในแท็บรายคนเอาเอง
// จึงจัดตาม "ชิ้นงาน" (ไม่ใช่ตามนักเรียน) เพราะการตามงาน/เรียกซ่อมทำทีละชิ้น ทีละกลุ่ม
// แล้วมีปุ่มคัดลอกรายชื่อไปวางในกลุ่มไลน์ของห้องได้เลย

/** กลุ่มที่ต้องตาม — เรียงจากเร่งสุด · คำเรียกของงานกับข้อสอบต่างกันให้ตรงกับที่ครูใช้ */
const FOLLOW = [
  { id: 'miss',   work: 'ยังไม่ส่ง',                 exam: 'ขาดสอบ',                    tone: 'bad' },
  { id: 'fix',    work: 'ได้ต่ำกว่าเกณฑ์',           exam: 'ไม่ผ่านเกณฑ์ · ยังไม่ได้สอบซ่อม', tone: 'bad' },
  { id: 'refail', work: 'แก้แล้วยังไม่ผ่าน',         exam: 'สอบซ่อมแล้ว ยังไม่ผ่าน',     tone: 'warn' },
  { id: 'none',   work: 'ยังไม่ตรวจ',                exam: 'ยังไม่กรอกคะแนน',           tone: 'dim' }
];
const FILTERS = [
  { id: 'all',  label: 'ทั้งหมด',           has: ['miss', 'fix', 'refail', 'none'] },
  { id: 'miss', label: 'ไม่ส่ง / ขาดสอบ',  has: ['miss'] },
  { id: 'fix',  label: 'ต้องซ่อม',          has: ['fix', 'refail'] },
  { id: 'none', label: 'ยังไม่ตรวจ',        has: ['none'] }
];

/**
 * แยกนักเรียนของรายการนี้เป็นกลุ่มที่ต้องตาม
 * "ไม่ส่ง" ไม่ถูกนับซ้ำในกลุ่มไม่ผ่านเกณฑ์ (x = 0 คะแนน ซึ่งไม่ผ่านอยู่แล้ว แต่ต้องตามคนละแบบ)
 * untouched = ทั้งห้องยังว่างอยู่ — รายการที่เพิ่งสร้าง ไม่ต้องไล่ชื่อทั้งห้องให้รก
 */
function followOf(col, S) {
  const cls = state.cls;
  const V = cls.values[col.key] || {};
  const g = { miss: [], fix: [], refail: [], none: [], fixed: 0 };
  for (const st of cls.students) {
    const raw = V[st.sid];
    const w = parseWork(raw);
    if (w.status === 'miss') { g.miss.push({ st, w }); continue; }
    if (w.status === 'none') { g.none.push({ st, w }); continue; }
    const p = passOf(col, raw, S);
    if (p === false) (w.retake ? g.refail : g.fix).push({ st, w });
    else if (p === true && w.retake) g.fixed++;
  }
  g.untouched = cls.students.length > 0 && g.none.length === cls.students.length;
  return g;
}

function followReport() {
  const S = settings();
  const f = FILTERS.find(x => x.id === ui.follow) || FILTERS[0];

  let cols = workColumns();
  const focus = ui.focus && cols.find(c => c.key === ui.focus);
  if (focus) cols = [focus];
  else if (ui.phase) cols = cols.filter(c => (c.half === 2 ? 2 : 1) === ui.phase);

  const items = cols.map(c => {
    const g = followOf(c, S);
    const groups = FOLLOW
      .filter(k => f.has.includes(k.id))
      .map(k => ({ k, list: g[k.id] }))
      // รายการที่ยังไม่ได้เริ่มตรวจเลย: ไม่ไล่ชื่อทั้งห้อง บอกบรรทัดเดียวพอ
      .filter(x => x.list.length && !(x.k.id === 'none' && g.untouched));
    return { c, g, groups };
  });
  const open = items.filter(x => x.groups.length || (x.g.untouched && f.has.includes('none')));
  const clear = items.filter(x => !open.includes(x));

  // นับบนชิปตัวกรอง — ครูรู้ก่อนกดว่ากลุ่มไหนมีอะไรให้ตามบ้าง
  const countFor = (flt) => items.reduce((a, x) => a + flt.has.reduce((b, id) =>
    b + ((id === 'none' && x.g.untouched) ? 0 : x.g[id].length), 0), 0);

  return h('div', null,
    h('div', { class: 'follow-bar' },
      focus
        ? h('button', { class: 'chip', onclick: () => { ui.focus = ''; emit(); } }, '‹ ทุกรายการ')
        : h('div', { class: 'seg seg-inline', role: 'group', 'aria-label': 'ช่วงภาคเรียน' },
            [[0, 'ทั้งเทอม'], [1, 'ก่อนกลางภาค'], [2, 'หลังกลางภาค']].map(([v, t]) => h('button', {
              'data-on': ui.phase === v ? '1' : '0', onclick: () => { ui.phase = v; emit(); }
            }, t)))),
    h('div', { class: 'chips' },
      FILTERS.map(x => h('button', {
        class: 'chip', 'data-on': ui.follow === x.id ? '1' : '0',
        onclick: () => { ui.follow = x.id; emit(); }
      }, `${x.label} ${countFor(x)}`))),

    cols.length === 0
      ? h('div', { class: 'card empty' }, 'ยังไม่มีรายการงาน/สอบในช่วงนี้')
      : open.length === 0
        ? h('div', { class: 'card empty', style: { padding: '26px' } }, 'ไม่มีใครค้างในหมวดนี้ 🎉')
        : open.map(({ c, g, groups }) => followCard(c, g, groups, S)),

    // ชิ้นที่ครบแล้ว — บอกไว้บรรทัดเดียว จะได้รู้ว่าไม่ได้หายไปไหน
    clear.length > 0 && !focus && h('div', { class: 'hint', style: { margin: '4px 2px 12px' } },
      `✓ ไม่มีใครค้าง (${f.label}) · ${clear.map(x => x.c.label).join(' · ')}`)
  );
}

function followCard(c, g, groups, S) {
  const exam = isExam(c);
  const mark = passMarkOf(c, S);
  const cls = state.cls;

  const chip = ({ st, w }, tone) => h('button', {
    class: 'fail-chip ' + tone,
    title: st.name + (w.retake ? ` · ซ่อมได้ ${nf(w.score)} (ครั้งแรก ${w.orig === null ? 'ขาดสอบ' : nf(w.orig)})` : ''),
    onclick: () => { ui.tab = 'student'; ui.sid = st.sid; emit(); window.scrollTo({ top: 0 }); }
  },
    h('span', null, `${st.no}. ${st.name || '—'}`),
    (w.status === 'ok' || w.status === 'late') && h('b', null, (w.retake ? 'ซ่อม ' : '') + nf(w.score)));

  const copy = async () => {
    const room = [cls.meta.grade, cls.meta.room].filter(Boolean).join('/');
    const text = [
      `${c.label} · ${[room, cls.meta.subject].filter(Boolean).join(' ')}`,
      ...groups.flatMap(({ k, list }) => [
        '',
        `${exam ? k.exam : k.work} (${list.length} คน)`,
        ...list.map(({ st }) => `${st.no}. ${st.name || '—'}`)
      ])
    ].join('\n');
    try { await navigator.clipboard.writeText(text); toast('คัดลอกรายชื่อแล้ว — วางในไลน์ได้เลย', 'ok'); }
    catch (e) { toast('คัดลอกไม่ได้ในเบราว์เซอร์นี้', 'err'); }
  };

  return h('div', { class: 'card follow-card' },
    h('div', { class: 'rep-head' },
      h('h3', null, c.label),
      groups.length > 0 && h('button', { class: 'rep-fresh-btn', onclick: copy }, '⧉ คัดลอกรายชื่อ')),
    h('div', { class: 'follow-meta' },
      bucketName(c)
        + (mark !== null ? ` · ผ่านที่ ${nf(mark)}` : '')
        + (g.fixed ? ` · ซ่อมผ่านแล้ว ${g.fixed} คน` : '')),
    g.untouched && (ui.follow === 'all' || ui.follow === 'none') && h('div', { class: 'follow-empty' },
      exam ? 'ยังไม่ได้กรอกคะแนนใครเลย' : 'ยังไม่ได้ตรวจของใครเลย'),
    groups.map(({ k, list }) => h('div', { class: 'fail-group' },
      h('div', { class: 'fail-head' },
        h('b', { class: 'tone-' + k.tone }, exam ? k.exam : k.work),
        h('span', null, `${list.length} คน`)),
      h('div', { class: 'fail-names' }, list.map(x => chip(x, k.tone)))))
  );
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
