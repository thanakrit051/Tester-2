/* หน้าเช็คชื่อ — 2 จังหวะ
 *   จังหวะ 1  เลือกวัน (ปกติกดปุ่มเดียวจบ เพราะเป็นวันนี้)
 *   จังหวะ 2  เช็คชื่อ — เต็มจอ ไม่มีตัวเลือกอะไรมากวน
 *
 * "ช่วง ก่อน/หลังกลางภาค" ระบบคำนวณจากวันสอบกลางภาคให้เอง
 * ไม่ถามครูตอนเช็ค (แก้ได้ในเมนู ⋯ ถ้าจำเป็น)
 */

import { h, toast, todayISO, fmtDate, fmtDayFull, isToday, confirmBox, modal } from '../dom.js';
import { state, emit, ensureColumn, setCells, getCell, deleteColumn, go } from '../state.js';
import { ATT_CODES, ATT_NAMES, attStats } from '../score.js';

const ui = {
  mode: 'list',              // 'list' = เลือกวัน · 'check' = กำลังเช็ค
  date: todayISO(),
  period: 1,
  halfOverride: null,        // ตั้งเองเฉพาะกรณีที่ระบบเดาผิด
  pending: null,             // คาบที่เพิ่งกดเพิ่ม ยังไม่มีข้อมูลในชีต
  onlyBlank: false           // กรองเฉพาะคนที่ยังไม่เช็ค
};

// ── ตัวช่วย ─────────────────────────────────────────────────

function guessHalf(dateISO) {
  const mid = String(state.config.mid_date || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(mid)) return 1;
  return dateISO > mid ? 2 : 1;
}
const halfOf = (dateISO) => ui.halfOverride ?? guessHalf(dateISO);

const keyFor = (dateISO, period) =>
  `ATT|${halfOf(dateISO)}|${dateISO.replace(/-/g, '')}-${period}`;

function periodsOn(dateISO) {
  return (state.cls?.columns || [])
    .filter(c => c.kind === 'ATT' && c.date === dateISO)
    .sort((a, b) => a.period - b.period);
}

/** สรุปทั้งวัน (รวมทุกคาบ) ใช้โชว์ในรายการวัน */
function daySummary(dateISO) {
  const cols = periodsOn(dateISO);
  const acc = { 'ม': 0, 'ส': 0, 'ล': 0, 'ข': 0, blank: 0, periods: cols.length };
  for (const c of cols) {
    const s = attStats(state.cls, c.key);
    for (const k of [...ATT_CODES, 'blank']) acc[k] += s[k];
  }
  return acc;
}

function enterCheck(dateISO, period, { markAllPresent = false } = {}) {
  ui.mode = 'check';
  ui.date = dateISO;
  ui.period = period;
  ui.halfOverride = null;
  ui.pending = null;
  ui.onlyBlank = false;
  if (markAllPresent) {
    const key = keyFor(dateISO, period);
    ensureColumn(colSpecFromKey(key), { quiet: true });
    setCells(state.cls.students.map(s => ({ key, sid: s.sid, value: 'ม' })), { quiet: true });
    toast('ทำเครื่องหมาย "มา" ทุกคนแล้ว — แตะแก้เฉพาะคนที่ไม่ปกติ', 'ok', 3200);
  }
  emit();
}

// ── หน้าเข้าสู่การเช็ค ──────────────────────────────────────

export function viewAttendance() {
  const cls = state.cls;
  if (!cls) return h('div', { class: 'page empty' }, 'ยังไม่ได้เลือกห้องเรียน');
  if (!cls.students.length) {
    return h('div', { class: 'page' }, h('div', { class: 'card empty' },
      h('div', { class: 'empty-icon' }, '👥'), 'ห้องนี้ยังไม่มีรายชื่อนักเรียน'));
  }
  return ui.mode === 'check' ? checkScreen() : dayListScreen();
}

function dayListScreen() {
  const today = todayISO();
  const cols = periodsOn(today);
  const sum = daySummary(today);
  const checked = cols.length > 0 && sum.blank < state.cls.students.length;

  return h('div', { class: 'page' },

    // ── การ์ดวันนี้ — ปุ่มเดียวจบ ──
    h('div', { class: 'card', style: { textAlign: 'center', padding: '18px 14px' } },
      h('div', { style: { fontSize: '12.5px', color: 'var(--ink-2)' } }, 'วันนี้'),
      h('div', { style: { fontSize: '20px', fontWeight: '700', margin: '2px 0 4px' } }, fmtDayFull(today)),
      h('div', { style: { fontSize: '13px', color: checked ? 'var(--green)' : 'var(--ink-3)', marginBottom: '14px' } },
        checked
          ? `เช็คแล้ว ${cols.length > 1 ? cols.length + ' คาบ · ' : ''}มา ${sum['ม']} · สาย ${sum['ส']} · ลา ${sum['ล']} · ขาด ${sum['ข']}`
          : 'ยังไม่ได้เช็คชื่อ'),

      checked
        ? h('div', { class: 'btn-row', style: { justifyContent: 'center' } },
            cols.map(c => h('button', {
              class: 'btn btn-soft',
              onclick: () => enterCheck(today, c.period)
            }, cols.length > 1 ? `แก้ไขคาบ ${c.period}` : 'ดู / แก้ไข')),
            h('button', {
              class: 'btn btn-ghost',
              onclick: () => addPeriod(cols.map(c => c.period), today)
            }, '+ เพิ่มคาบ'))
        : h('div', { style: { display: 'grid', gap: '8px' } },
            h('button', {
              class: 'btn btn-block', style: { padding: '14px', fontSize: '15px' },
              onclick: () => enterCheck(today, 1, { markAllPresent: true })
            }, '✓ เริ่มเช็ค · ทุกคนมา'),
            h('button', {
              class: 'btn btn-ghost btn-block',
              onclick: () => enterCheck(today, 1)
            }, 'เช็คเองทีละคน'))
    ),

    // ── วันอื่น ──
    h('div', { class: 'card', style: { display: 'flex', alignItems: 'center', gap: '10px' } },
      h('span', { style: { fontSize: '13px', color: 'var(--ink-2)', flex: 'none' } }, 'ย้อนไปเช็ควันอื่น'),
      h('input', {
        type: 'date', value: ui.date, style: { flex: '1' },
        onchange: (e) => {
          if (!e.target.value) return;
          const d = e.target.value;
          const p = periodsOn(d);
          enterCheck(d, p.length ? p[0].period : 1);
        }
      })
    ),

    historyCard()
  );
}

function historyCard() {
  const byDate = {};
  for (const c of state.cls.columns) {
    if (c.kind !== 'ATT') continue;
    (byDate[c.date] ||= []).push(c);
  }
  const dates = Object.keys(byDate).sort().reverse();
  const total = state.cls.columns.filter(c => c.kind === 'ATT').length;

  if (!dates.length) {
    return h('div', { class: 'card empty' },
      h('div', { class: 'empty-icon' }, '🗓'),
      h('div', { style: { fontSize: '13px' } },
        'ยังไม่เคยเช็คชื่อห้องนี้', h('br'), 'เช็ควันไหน ระบบจะบันทึกวันนั้นให้เอง วันที่ไม่เช็คไม่ถูกนำมาคิดคะแนน'));
  }

  return h('div', null,
    h('div', { class: 'section-title' }, `ประวัติการเช็ค · ${dates.length} วัน / ${total} คาบ`),
    h('div', { class: 'card card-tight' },
      dates.slice(0, 30).map(d => {
        const cols = byDate[d].sort((a, b) => a.period - b.period);
        const s = daySummary(d);
        return h('div', { class: 'list-row' },
          h('button', {
            style: { display: 'flex', alignItems: 'center', gap: '10px', flex: '1', minWidth: '0', textAlign: 'left' },
            onclick: () => enterCheck(d, cols[0].period)
          },
            h('div', { class: 'list-main' },
              h('div', { class: 'list-title' }, fmtDayFull(d),
                isToday(d) ? h('span', { class: 'badge g', style: { marginLeft: '6px' } }, 'วันนี้') : null),
              h('div', { class: 'list-sub' },
                (cols.length > 1 ? `${cols.length} คาบ · ` : '') +
                `มา ${s['ม']} · สาย ${s['ส']} · ลา ${s['ล']} · ขาด ${s['ข']}` +
                (s.blank ? ` · ยังไม่เช็ค ${s.blank}` : ''))),
            s['ข'] > 0 ? h('span', { class: 'badge r' }, 'ขาด ' + s['ข']) : h('span', { class: 'badge g' }, 'ครบ')
          ),
          h('button', {
            class: 'icon-btn', style: { color: 'var(--ink-3)' }, title: 'แก้ไข / ลบ',
            onclick: () => openDayMenu(d, cols)
          }, '⋯')
        );
      })
    ));
}

/** เมนูแก้ไข/ลบ ของวันหนึ่ง ๆ ในประวัติ */
function openDayMenu(dateISO, cols) {
  modal((close) => h('div', null,
    h('h2', null, fmtDayFull(dateISO)),
    h('div', { class: 'hint', style: { marginBottom: '12px' } },
      cols.length > 1 ? `วันนี้เช็คไว้ ${cols.length} คาบ` : 'เช็คไว้ 1 คาบ'),
    h('div', { style: { display: 'grid', gap: '8px' } },

      ...cols.map(c => h('button', {
        class: 'btn btn-ghost btn-block',
        onclick: () => { close(); enterCheck(dateISO, c.period); }
      }, cols.length > 1 ? `✏️ แก้ไขคาบ ${c.period}` : '✏️ แก้ไขการเช็คชื่อ')),

      h('div', { class: 'sep' }, 'ลบ'),

      ...cols.map(c => h('button', {
        class: 'btn btn-danger btn-block',
        onclick: async () => {
          close();
          const label = cols.length > 1 ? `คาบ ${c.period} ของ ${fmtDate(dateISO)}` : fmtDate(dateISO);
          if (!await confirmBox('ลบการเช็คชื่อ?', `${label} จะถูกลบออกจากชีต และไม่ถูกนำไปคิดคะแนนอีก`, 'ลบ')) return;
          await deleteColumn(c.key);
          toast('ลบแล้ว', 'ok');
        }
      }, cols.length > 1 ? `🗑 ลบคาบ ${c.period}` : '🗑 ลบการเช็คชื่อวันนี้')),

      cols.length > 1 && h('button', {
        class: 'btn btn-danger btn-block',
        onclick: async () => {
          close();
          if (!await confirmBox('ลบทั้งวัน?', `ทั้ง ${cols.length} คาบของ ${fmtDate(dateISO)} จะถูกลบ`, 'ลบทั้งวัน')) return;
          for (const c of cols) await deleteColumn(c.key);
          toast(`ลบ ${cols.length} คาบแล้ว`, 'ok');
        }
      }, `🗑 ลบทั้งวัน (${cols.length} คาบ)`)
    )
  ));
}

// ── หน้ากำลังเช็ค ───────────────────────────────────────────

function checkScreen() {
  const cls = state.cls;
  const onDay = periodsOn(ui.date);
  const available = onDay.map(c => c.period);
  if (ui.pending && ui.pending.date === ui.date && !available.includes(ui.pending.period)) {
    available.push(ui.pending.period);
  }
  if (!available.length) available.push(1);
  available.sort((a, b) => a - b);
  if (!available.includes(ui.period)) ui.period = available[0];

  const key = keyFor(ui.date, ui.period);
  const st = attStats(cls, key);
  const shown = ui.onlyBlank
    ? cls.students.filter(s => !ATT_CODES.includes(String(getCell(key, s.sid) || '')))
    : cls.students;

  return h('div', { class: 'page' },

    // แถบหัว — บาง อ่านชัด ไม่มีตัวเลือกกวน
    h('div', { class: 'card', style: { display: 'flex', alignItems: 'center', gap: '10px' } },
      h('button', { class: 'btn btn-ghost btn-sm', onclick: () => { ui.mode = 'list'; emit(); } }, '‹ วัน'),
      h('div', { style: { flex: '1', minWidth: '0' } },
        h('div', { style: { fontWeight: '700', fontSize: '15px' } },
          fmtDayFull(ui.date), available.length > 1 ? ` · คาบ ${ui.period}` : ''),
        h('div', { style: { fontSize: '11.5px', color: 'var(--ink-3)' } },
          `${halfOf(ui.date) === 1 ? 'ก่อนกลางภาค' : 'หลังกลางภาค'} · ${cls.students.length} คน`)),
      h('button', { class: 'icon-btn', style: { color: 'var(--ink-3)' }, onclick: () => openMenu(available, key) }, '⋯')
    ),

    // สลับคาบ (โผล่เฉพาะวันที่มีหลายคาบ)
    available.length > 1 && h('div', { class: 'chips', style: { marginBottom: '10px' } },
      available.map(pn => h('button', {
        class: 'chip', 'data-on': ui.period === pn ? '1' : '0',
        onclick: () => { ui.period = pn; emit(); }
      }, 'คาบ ' + pn))),

    h('div', { class: 'stats', style: { marginBottom: '10px' } },
      chipStat('g', st['ม'], 'มา'), chipStat('a', st['ส'], 'สาย'),
      chipStat('b', st['ล'], 'ลา'), chipStat('r', st['ข'], 'ขาด')),

    h('div', { class: 'card', style: { padding: '10px 12px' } },
      h('div', { class: 'btn-row' },
        h('button', { class: 'btn btn-soft btn-sm', onclick: () => markAll(key, 'ม') }, '✓ ทุกคนมา'),
        st.blank > 0 && h('button', {
          class: 'btn btn-sm', style: { background: 'var(--amber)', color: '#fff' },
          onclick: () => { ui.onlyBlank = !ui.onlyBlank; emit(); }
        }, ui.onlyBlank ? '↩ แสดงทุกคน' : `⚠ ยังไม่เช็ค ${st.blank} คน`),
        st.blank === 0 && h('span', {
          style: { alignSelf: 'center', fontSize: '12.5px', color: 'var(--green)', fontWeight: '600' }
        }, '✓ เช็คครบทุกคนแล้ว')
      )),

    h('div', { class: 'card card-tight' },
      shown.length
        ? shown.map(s => studentRow(s, key))
        : h('div', { class: 'empty', style: { padding: '26px' } }, 'เช็คครบแล้ว 🎉')),

    h('button', {
      class: 'btn btn-block', style: { marginTop: '4px' },
      onclick: () => { ui.mode = 'list'; ui.onlyBlank = false; emit(); }
    }, 'เสร็จสิ้น')
  );
}

function studentRow(s, key) {
  const cur = String(getCell(key, s.sid) || '');
  return h('div', { class: 'stu-row' },
    h('div', { class: 'stu-no' }, s.no),
    h('div', { style: { flex: '1', minWidth: '0' } },
      h('div', { class: 'stu-name' }, s.name || '—'),
      h('div', { class: 'stu-sid' }, s.sid)),
    h('div', { class: 'att-group' },
      ATT_CODES.map(code => h('button', {
        class: 'att-btn', 'data-code': code, 'data-on': cur === code ? '1' : '0',
        onclick: (e) => {
          const now = String(getCell(key, s.sid) || '');
          const next = now === code ? '' : code;
          ensureColumn(colSpecFromKey(key), { quiet: true });
          setCells([{ key, sid: s.sid, value: next }], { quiet: true });
          const group = e.currentTarget.parentElement;
          [...group.children].forEach(b => { b.dataset.on = (b.dataset.code === next) ? '1' : '0'; });
          refreshStats(key);
        }
      }, ATT_NAMES[code]))
    )
  );
}

// ── เมนู ⋯ เก็บของที่ไม่ค่อยได้ใช้ ──────────────────────────

function openMenu(available, key) {
  const exists = state.cls.columns.some(c => c.key === key);
  const half = halfOf(ui.date);
  const midSet = /^\d{4}-\d{2}-\d{2}$/.test(String(state.config.mid_date || '').trim());

  modal((close) => h('div', null,
    h('h2', null, fmtDayFull(ui.date)),
    h('div', { style: { display: 'grid', gap: '8px' } },

      h('button', {
        class: 'btn btn-ghost btn-block',
        onclick: () => { close(); addPeriod(available, ui.date); }
      }, '➕ เพิ่มคาบของวันนี้'),

      h('div', { style: { fontSize: '12.5px', color: 'var(--ink-2)', marginTop: '6px' } },
        `ช่วงคะแนน: ${half === 1 ? 'ก่อนกลางภาค' : 'หลังกลางภาค'}`,
        midSet ? ' (คำนวณจากวันสอบกลางภาค)' : ' — ยังไม่ได้ตั้งวันสอบกลางภาค'),
      h('div', { class: 'btn-row' },
        h('button', {
          class: 'chip', 'data-on': half === 1 ? '1' : '0', style: { flex: '1' },
          onclick: () => { ui.halfOverride = 1; close(); emit(); }
        }, 'ก่อนกลางภาค'),
        h('button', {
          class: 'chip', 'data-on': half === 2 ? '1' : '0', style: { flex: '1' },
          onclick: () => { ui.halfOverride = 2; close(); emit(); }
        }, 'หลังกลางภาค')),
      !midSet && h('button', {
        class: 'btn btn-soft btn-block btn-sm',
        onclick: () => { close(); go('settings'); }
      }, '⚙️ ไปตั้งวันสอบกลางภาค (ตั้งครั้งเดียวจบ)'),

      exists && h('button', {
        class: 'btn btn-danger btn-block', style: { marginTop: '10px' },
        onclick: async () => {
          close();
          const lbl = available.length > 1 ? `คาบ ${ui.period} ของ${fmtDate(ui.date)}` : fmtDate(ui.date);
          if (!await confirmBox('ลบการเช็คชื่อ?', `ข้อมูลของ ${lbl} จะหายไป`, 'ลบ')) return;
          await deleteColumn(key);
          ui.period = 1; ui.mode = 'list';
          toast('ลบแล้ว', 'ok');
        }
      }, '🗑 ลบการเช็คครั้งนี้')
    )
  ));
}

function addPeriod(used, dateISO) {
  const next = used.length ? Math.max(...used) + 1 : 2;
  const inp = h('input', { type: 'number', min: '1', value: String(next) });
  modal((close) => {
    const ok = h('button', { class: 'btn btn-block' }, 'เพิ่มคาบ');
    ok.onclick = () => {
      const pn = Number(inp.value);
      if (!Number.isInteger(pn) || pn < 1) return toast('เลขคาบต้องเป็นจำนวนเต็มตั้งแต่ 1', 'err');
      if (used.includes(pn)) return toast(`คาบ ${pn} ของวันนี้มีอยู่แล้ว`, 'err');
      ui.pending = { date: dateISO, period: pn };
      close();
      enterCheck(dateISO, pn);
    };
    return h('div', null,
      h('h2', null, 'เพิ่มคาบของ ' + fmtDate(dateISO)),
      h('div', { class: 'field' }, h('label', null, 'คาบที่'), inp,
        h('div', { class: 'hint' },
          used.length ? 'วันนี้เช็คไปแล้ว: คาบ ' + used.join(', ') : 'วันนี้ยังไม่ได้เช็คคาบไหนเลย')),
      h('div', { class: 'hint', style: { marginBottom: '10px' } },
        'ใส่เลขคาบเท่าไหร่ก็ได้ ไม่จำกัด 10 · คาบจะถูกบันทึกเมื่อเริ่มเช็คคนแรก'),
      ok
    );
  });
}

// ── เขียนค่า / รีเฟรช ───────────────────────────────────────

function markAll(key, value) {
  ensureColumn(colSpecFromKey(key), { quiet: true });
  setCells(state.cls.students.map(s => ({ key, sid: s.sid, value })));
  toast('ทำเครื่องหมาย "มา" ทั้งห้อง', 'ok', 1400);
}

function colSpecFromKey(key) {
  const [, half, id] = key.split('|');
  const [d, p] = id.split('-');
  return {
    kind: 'ATT', half: Number(half),
    date: `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`,
    period: Number(p)
  };
}

function refreshStats(key) {
  const st = attStats(state.cls, key);
  const nums = document.querySelectorAll('.page .stats .stat-num');
  const vals = [st['ม'], st['ส'], st['ล'], st['ข']];
  nums.forEach((el, i) => { if (vals[i] !== undefined) el.textContent = String(vals[i]); });
}

const chipStat = (cls, num, lbl) => h('div', { class: 'stat ' + cls },
  h('div', { class: 'stat-num' }, String(num)), h('div', { class: 'stat-lbl' }, lbl));
