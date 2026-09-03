/* หน้าเช็คชื่อ — 2 จังหวะ
 *   จังหวะ 1  เลือกวัน (ปกติกดปุ่มเดียวจบ เพราะเป็นวันนี้)
 *   จังหวะ 2  เช็คชื่อ — เต็มจอ ไม่มีตัวเลือกอะไรมากวน
 *
 * "ช่วง ก่อน/หลังกลางภาค" ระบบคำนวณจากวันสอบกลางภาคให้เอง
 * ไม่ถามครูตอนเช็ค (แก้ได้ในเมนู ⋯ ถ้าจำเป็น)
 */

import { h, toast, todayISO, fmtDate, fmtDayFull, isToday, confirmBox, modal } from '../dom.js';
import { state, emit, ensureColumn, setCells, getCell, deleteColumn, go, undoLastEdit } from '../state.js';
import { ATT_CODES, ATT_NAMES, attStats } from '../score.js';

/** ปุ่ม "เลิกทำ" แปะท้าย toast — ใช้กับปุ่มที่แก้ทีเดียวหลายคน */
const undoAction = () => ({
  label: 'เลิกทำ',
  onclick: () => { const n = undoLastEdit(); if (n) toast(`เลิกทำแล้ว · ${n} ช่อง`, 'ok'); }
});

const ui = {
  // ดีไซน์ให้แตะ "เช็คชื่อ" แล้วเข้าหน้าเช็คของวันนี้เลย ไม่ต้องผ่านหน้าเลือกวัน
  // (หน้าเลือกวัน/ประวัติ ยังเข้าได้จากปุ่ม ‹ มุมซ้ายบน)
  mode: 'check',             // 'list' = เลือกวัน · 'check' = กำลังเช็ค
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
    toast('ทำเครื่องหมาย "มา" ทุกคนแล้ว — แตะแก้เฉพาะคนที่ไม่ปกติ', 'ok', 3200, undoAction());
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

/**
 * คาบที่มีของวันที่เลือก + สถิติของคาบปัจจุบัน
 * ใช้ร่วมกันระหว่างแถบหัว (มือถือ) กับตัวหน้า — ต้องได้ค่าเดียวกันเสมอ
 */
function resolve() {
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
  return { cls, available, key, st: attStats(cls, key) };
}

/** เลื่อนไปวันก่อนหน้า/ถัดไป (ปุ่ม ‹ › ในดีไซน์หน้า PC) */
function stepDay(delta) {
  const d = new Date(ui.date + 'T00:00:00');
  d.setDate(d.getDate() + delta);
  const iso = d.toISOString().slice(0, 10);
  const p = periodsOn(iso);
  ui.date = iso;
  ui.period = p.length ? p[0].period : 1;
  ui.pending = null;
  ui.onlyBlank = false;
  emit();
}

/** แถบหัวสีเข้มของหน้านี้ (มือถือ) — วันที่ · คาบ · ตัวนับ · ปุ่มหลัก */
viewAttendance.head = function () {
  const cls = state.cls;
  if (!cls || !cls.students.length) return null;

  // หน้าประวัติ — แถบหัวบางกว่า มีแค่ชื่อหน้ากับทางกลับ
  if (ui.mode !== 'check') {
    const total = (cls.columns || []).filter(c => c.kind === 'ATT').length;
    return h('header', { class: 'pagehead' },
      h('div', { class: 'ph-row' },
        h('button', {
          class: 'ph-back', 'aria-label': 'กลับไปเช็ควันนี้',
          onclick: () => enterCheck(todayISO(), periodsOn(todayISO())[0]?.period || 1)
        }, '‹'),
        h('div', { class: 'ph-grow' },
          h('div', { class: 'ph-title' }, 'ประวัติการเช็คชื่อ'),
          h('div', { class: 'ph-sub' },
            `${[cls.meta.grade, cls.meta.room].filter(Boolean).join('/')} ${cls.meta.subject} · ${total} คาบ`))));
  }

  const { available, key, st } = resolve();
  const done = cls.students.length - st.blank;

  return h('header', { class: 'pagehead' },
    h('div', { class: 'ph-row' },
      h('button', { class: 'ph-back', 'aria-label': 'กลับ', onclick: () => { ui.mode = 'list'; emit(); } }, '‹'),
      h('div', { class: 'ph-grow' },
        h('div', { class: 'ph-title' },
          fmtDate(ui.date) + (available.length > 1 ? ` · คาบ ${ui.period}` : '')),
        h('div', { class: 'ph-sub' },
          `${[cls.meta.grade, cls.meta.room].filter(Boolean).join('/')} ${cls.meta.subject}`)),
      h('div', { class: 'ph-badge' }, `${done}/${cls.students.length}`),
      h('button', { class: 'ph-back', 'aria-label': 'ตัวเลือกเพิ่มเติม', onclick: () => openMenu(available, key) }, '⋯')
    ),
    // คาบเรียนใช้ dropdown — จำนวนคาบไม่จำกัด ถ้าเรียงเป็นชิปจะกินที่แถบหัว
    // ไปเรื่อย ๆ ตามจำนวนคาบ และหาคาบที่ต้องการยากขึ้นเมื่อมีหลายคาบ
    available.length > 1 && h('div', { class: 'ph-chips' },
      h('label', { class: 'ph-pick' },
        h('span', null, 'คาบ'),
        h('select', {
          'aria-label': 'เลือกคาบเรียน',
          onchange: (e) => { ui.period = Number(e.target.value); ui.onlyBlank = false; emit(); }
        }, available.map(pn => h('option', {
          value: String(pn), selected: pn === ui.period
        }, String(pn))))),
      h('button', { class: 'ph-chip add', onclick: () => addPeriod(available, ui.date) }, '+ เพิ่มคาบ')
    ),
    h('div', { class: 'ph-actions' },
      h('button', { class: 'ph-main', onclick: () => markAll(key, 'ม') }, '✓ ทุกคนมา'),
      st.blank > 0
        ? h('button', {
            class: 'ph-side', 'data-on': ui.onlyBlank ? '1' : '0',
            onclick: () => { ui.onlyBlank = !ui.onlyBlank; emit(); }
          }, ui.onlyBlank ? 'แสดงทุกคน' : `ยังว่าง ${st.blank}`)
        : h('div', { class: 'ph-side' }, 'ครบแล้ว')
    )
  );
};

function dayListScreen() {
  const today = todayISO();
  const cols = periodsOn(today);
  const sum = daySummary(today);
  const checked = cols.length > 0 && sum.blank < state.cls.students.length;

  return h('div', { class: 'page' },

    // PC: หัวหน้าจอ + ทางกลับ (มือถืออยู่ในแถบเข้มแล้ว)
    h('div', { class: 'ctxbar' },
      h('button', {
        class: 'ctx-step', 'aria-label': 'กลับไปเช็ควันนี้',
        onclick: () => enterCheck(today, cols[0]?.period || 1)
      }, '‹'),
      h('div', { style: { flex: '1', minWidth: '0' } },
        h('div', { class: 'ctx-title' }, 'ประวัติการเช็คชื่อ'),
        h('div', { class: 'ctx-sub' },
          checked
            ? `วันนี้เช็คแล้ว · มา ${sum['ม']} · สาย ${sum['ส']} · ลา ${sum['ล']} · ขาด ${sum['ข']}`
            : 'วันนี้ยังไม่ได้เช็คชื่อ')),
      h('div', { class: 'ctx-end' },
        h('button', { class: 'btn', onclick: () => enterCheck(today, cols[0]?.period || 1) },
          checked ? 'เช็คชื่อวันนี้ต่อ' : '✓ เริ่มเช็คชื่อวันนี้'))),

    // ── ย้อนไปวันอื่น ──
    h('div', { class: 'card', style: { display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' } },
      h('span', { style: { fontSize: '13px', color: 'var(--ink-2)', flex: 'none' } }, 'ย้อนไปเช็ควันอื่น'),
      h('input', {
        type: 'date', value: ui.date, style: { flex: '1', minWidth: '160px' },
        onchange: (e) => {
          if (!e.target.value) return;
          const d = e.target.value;
          const p = periodsOn(d);
          enterCheck(d, p.length ? p[0].period : 1);
        }
      }),
      // มือถือไม่มีปุ่มหลักในแถบบริบท จึงใส่ไว้ตรงนี้แทน
      h('button', {
        class: 'btn pc-hide', style: { flexBasis: '100%' },
        onclick: () => enterCheck(today, cols[0]?.period || 1)
      }, checked ? 'เช็คชื่อวันนี้ต่อ' : '✓ เริ่มเช็คชื่อวันนี้')
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
  const { cls, available, key, st } = resolve();
  const total = cls.students.length;
  const done = total - st.blank;
  const odd = st['ส'] + st['ล'] + st['ข'];
  const shown = ui.onlyBlank
    ? cls.students.filter(s => !ATT_CODES.includes(String(getCell(key, s.sid) || '')))
    : cls.students;

  return h('div', { class: 'page' },

    // ── PC: บริบทของหน้าเป็นการ์ดขาว (มือถืออยู่ในแถบเข้มด้านบนแล้ว) ──
    h('div', { class: 'ctxbar' },
      h('button', { class: 'ctx-step', 'aria-label': 'วันก่อนหน้า', onclick: () => stepDay(-1) }, '‹'),
      h('div', null,
        h('div', { class: 'ctx-title' }, fmtDayFull(ui.date)),
        h('div', { class: 'ctx-sub' },
          `${halfOf(ui.date) === 1 ? 'ก่อนกลางภาค' : 'หลังกลางภาค'} · แก้ช่วงได้ในเมนู ⋯`)),
      h('button', { class: 'ctx-step', 'aria-label': 'วันถัดไป', onclick: () => stepDay(1) }, '›'),

      h('div', { class: 'ph-chips', style: { marginTop: '0', gap: '6px' } },
        available.length > 1 && h('label', { class: 'pickbox' },
          h('span', null, 'คาบ'),
          h('select', {
            'aria-label': 'เลือกคาบเรียน',
            onchange: (e) => { ui.period = Number(e.target.value); ui.onlyBlank = false; emit(); }
          }, available.map(pn => h('option', {
            value: String(pn), selected: pn === ui.period
          }, String(pn))))),
        h('button', { class: 'chip', onclick: () => addPeriod(available, ui.date) }, '+ เพิ่มคาบ')),

      h('div', { class: 'ctx-end' },
        h('span', { class: 'tnum', 'data-t': 'done', style: { fontSize: '13px', color: 'var(--ink-2)' } },
          `เช็คแล้ว ${done}/${total}`),
        h('button', { class: 'btn btn-sm', onclick: () => markAll(key, 'ม') }, '✓ ทุกคนมา'),
        h('button', { class: 'icon-btn', onclick: () => openMenu(available, key) }, '⋯'))
    ),

    // ── แถวกรอง + ตัวนับ (ตามดีไซน์ วางอยู่เหนือรายชื่อ) ──
    h('div', { class: 'filter-row', style: { display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '10px' } },
      h('button', {
        class: 'chip', 'data-on': ui.onlyBlank ? '0' : '1',
        onclick: () => { ui.onlyBlank = false; emit(); }
      }, `ทั้งหมด ${total}`),
      h('button', {
        class: 'chip', 'data-on': ui.onlyBlank ? '1' : '0',
        onclick: () => { ui.onlyBlank = st.blank > 0 ? !ui.onlyBlank : false; emit(); }
      }, h('span', { 'data-t': 'blank' }, `ยังว่าง ${st.blank}`)),
      h('span', { class: 'chip' }, h('span', { 'data-t': 'odd' }, `ไม่ปกติ ${odd}`)),
      h('div', { class: 'tally', style: { marginLeft: 'auto' } },
        h('b', { class: 't-ok', 'data-t': 'ม' }, `มา ${st['ม']}`),
        h('b', { class: 't-late', 'data-t': 'ส' }, `สาย ${st['ส']}`),
        h('b', { class: 't-leave', 'data-t': 'ล' }, `ลา ${st['ล']}`),
        h('b', { class: 't-miss', 'data-t': 'ข' }, `ขาด ${st['ข']}`))
    ),

    h('div', { class: 'att-list' },
      shown.length
        ? shown.map(s => studentRow(s, key))
        : h('div', { class: 'card empty', style: { padding: '26px' } }, 'เช็คครบแล้ว 🎉')),

    h('div', { class: 'done-bar' },
      h('div', { class: 'done-note' },
        'บันทึกอัตโนมัติทุกครั้งที่แตะ · ออฟไลน์ก็เช็คได้ ระบบส่งให้เมื่อมีเน็ต'),
      h('button', {
        class: 'btn btn-solid',
        onclick: () => { ui.mode = 'list'; ui.onlyBlank = false; emit(); }
      }, 'เสร็จสิ้น · บันทึกแล้ว'))
  );
}

function studentRow(s, key) {
  const cur = String(getCell(key, s.sid) || '');
  return h('div', { class: 'stu-row' },
    h('div', { style: { flex: '1', minWidth: '0' } },
      h('div', { class: 'stu-name' }, s.name || '—'),
      h('div', { class: 'stu-sid' }, `เลขที่ ${s.no}${s.sid ? ' · ' + s.sid : ''}`)),
    h('div', { class: 'att-group' },
      ATT_CODES.map(code => h('button', {
        class: 'att-btn', 'data-code': code, 'data-on': cur === code ? '1' : '0',
        title: ATT_NAMES[code], 'aria-label': ATT_NAMES[code],
        onclick: (e) => {
          const now = String(getCell(key, s.sid) || '');
          const next = now === code ? '' : code;
          ensureColumn(colSpecFromKey(key), { quiet: true });
          setCells([{ key, sid: s.sid, value: next }], { quiet: true });
          const group = e.currentTarget.parentElement;
          [...group.children].forEach(b => { b.dataset.on = (b.dataset.code === next) ? '1' : '0'; });
          refreshStats(key);
        }
      }, code))
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

      // บน PC ไม่มีปุ่ม ‹ แบบมือถือ ทางเข้าหน้าประวัติจึงต้องอยู่ในเมนูนี้
      h('button', {
        class: 'btn btn-ghost btn-block',
        onclick: () => { close(); ui.mode = 'list'; emit(); }
      }, '🗓 ประวัติการเช็ค / เลือกวันอื่น'),

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
  toast('ทำเครื่องหมาย "มา" ทั้งห้อง', 'ok', 1400, undoAction());
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

/**
 * อัปเดตตัวเลขทุกจุดหลังแตะปุ่มหนึ่งครั้ง — ทำเองแทนการวาดหน้าใหม่ทั้งหน้า
 * เพราะรายชื่อ 40 คนวาดใหม่ทุกครั้งแล้วสะดุดตอนกดรัว
 */
function refreshStats(key) {
  const st = attStats(state.cls, key);
  const total = state.cls.students.length;
  const set = (sel, text) => { const el = document.querySelector(sel); if (el) el.textContent = text; };

  for (const [code, name] of Object.entries(ATT_NAMES)) {
    set(`[data-t="${code}"]`, `${name} ${st[code]}`);
  }
  set('[data-t="blank"]', `ยังว่าง ${st.blank}`);
  set('[data-t="odd"]', `ไม่ปกติ ${st['ส'] + st['ล'] + st['ข']}`);
  set('[data-t="done"]', `เช็คแล้ว ${total - st.blank}/${total}`);
  set('.pagehead .ph-badge', `${total - st.blank}/${total}`);

  const side = document.querySelector('.pagehead .ph-side');
  if (side && !ui.onlyBlank) side.textContent = st.blank > 0 ? `ยังว่าง ${st.blank}` : 'ครบแล้ว';
}
