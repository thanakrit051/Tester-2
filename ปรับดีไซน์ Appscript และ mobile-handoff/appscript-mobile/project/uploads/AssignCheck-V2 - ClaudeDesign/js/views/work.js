/* หน้ากรอกงานและคะแนนสอบ (ส่งงาน · สอบเก็บคะแนน · กลางภาค · ปลายภาค) */

import { h, modal, toast, confirmBox, nf } from '../dom.js';
import { state, emit, ensureColumn, setCells, getCell, deleteColumn, updateColumn, settings } from '../state.js';
import { BUCKETS, NOT_SUBMITTED, parseWork, formatWork } from '../score.js';

const ui = { bucket: 'work1', open: null };

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
  if (ui.open) {
    const col = cls.columns.find(c => c.key === ui.open);
    if (col) return gradeScreen(col);
    ui.open = null;
  }
  return listScreen();
}

// ── หน้ารายการ ──────────────────────────────────────────────

function listScreen() {
  const S = settings();
  const cols = columnsIn(ui.bucket);
  const b = bucketOf(ui.bucket);
  const totalMax = cols.reduce((a, c) => a + (c.max || 0), 0);

  return h('div', { class: 'page' },
    h('div', { class: 'chips' },
      BUCKETS.filter(x => x.kind !== 'ATT').map(x => h('button', {
        class: 'chip', 'data-on': ui.bucket === x.id ? '1' : '0',
        onclick: () => { ui.bucket = x.id; emit(); }
      }, `${x.phase === 1 ? '①' : '②'} ${x.label}`))
    ),

    h('div', { class: 'card', style: { display: 'flex', alignItems: 'center', gap: '10px' } },
      h('div', { style: { flex: '1' } },
        h('div', { style: { fontWeight: '700' } }, `${b.label} · ${b.phase === 1 ? 'ก่อนกลางภาค' : 'หลังกลางภาค'}`),
        h('div', { style: { fontSize: '12.5px', color: 'var(--ink-2)' } },
          `${cols.length} รายการ · คะแนนดิบรวม ${totalMax} → เทียบเป็น ${S.weight[ui.bucket]} คะแนน (SGS ${b.sgs})`)),
      h('button', { class: 'btn btn-sm', onclick: () => openItemForm() }, '+ เพิ่ม')
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

function gradeScreen(col) {
  const students = state.cls.students;
  const inputs = [];
  const W = words(col);

  const rows = students.map((s, i) => {
    const cur = parseWork(getCell(col.key, s.sid));

    const inp = h('input', {
      class: 'score-inp' + (cur.status === 'miss' ? ' miss' : (cur.status !== 'none' ? ' filled' : '')),
      type: 'number', inputmode: 'decimal', min: '0', max: String(col.max), step: 'any',
      value: (cur.status === 'ok' || cur.status === 'late') ? String(cur.score) : '',
      placeholder: cur.status === 'miss' ? W.missShort : '',
      onkeydown: (e) => {
        if (e.key === 'Enter') { e.preventDefault(); inputs[i + 1]?.focus(); inputs[i + 1]?.select(); }
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
    inputs.push(inp);

    const btns = statusBtnsOf(col).map(b => h('button', {
      class: 'st-btn ' + b.cls, 'data-st': b.st, 'data-on': cur.status === b.st ? '1' : '0',
      title: b.title || (b.st === 'late' ? `ส่งช้า (ได้ ${lateScore(col)}/${col.max})` : b.label),
      onclick: () => apply(read() === b.st ? 'none' : b.st)
    }, b.label));

    const group = h('div', { class: 'st-group' }, btns);
    const read = () => (btns.find(b => b.dataset.on === '1') || {}).dataset?.st || 'none';

    /** เขียนสถานะ+คะแนน แล้วอัปเดตเฉพาะแถวนี้ */
    function apply(status, score) {
      let sc = score;
      if (status === 'ok'   && sc === undefined) sc = col.max;
      if (status === 'late' && sc === undefined) sc = lateScore(col);
      const value = formatWork(status, sc);
      setCells([{ key: col.key, sid: s.sid, value }], { quiet: true });

      btns.forEach(b => { b.dataset.on = (b.dataset.st === status) ? '1' : '0'; });
      inp.value = (status === 'ok' || status === 'late') ? String(sc) : '';
      inp.placeholder = status === 'miss' ? W.missShort : '';
      inp.classList.toggle('miss', status === 'miss');
      inp.classList.toggle('filled', status === 'ok' || status === 'late');
      refreshProgress(col);
    }

    return h('div', { class: 'stu-row' },
      h('div', { class: 'stu-no' }, s.no),
      h('div', { style: { flex: '1', minWidth: '0' } },
        h('div', { class: 'stu-name' }, s.name || '—'),
        h('div', { class: 'stu-sid' }, s.sid)),
      group,
      h('div', { class: 'score-cell' }, inp, h('span', { class: 'score-max' }, '/' + col.max))
    );
  });

  return h('div', { class: 'page' },
    h('div', { class: 'card' },
      h('div', { style: { display: 'flex', alignItems: 'center', gap: '10px' } },
        h('button', { class: 'btn btn-ghost btn-sm', onclick: () => { ui.open = null; emit(); } }, '‹ กลับ'),
        h('div', { style: { flex: '1', minWidth: '0' } },
          h('div', { style: { fontWeight: '700', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, col.label),
          h('div', { id: 'grade-progress', style: { fontSize: '12.5px', color: 'var(--ink-2)' } }, progressText(col))),
        h('button', { class: 'icon-btn', style: { color: 'var(--ink-3)' }, onclick: () => openItemMenu(col) }, '⋯')
      ),
      col.desc && h('div', {
        style: {
          marginTop: '10px', padding: '9px 11px', borderRadius: '10px',
          background: 'var(--green-soft)', fontSize: '13px', whiteSpace: 'pre-wrap'
        }
      }, col.desc)
    ),

    h('div', { class: 'card', style: { padding: '10px 12px' } },
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
        }, '↺ ล้าง'),
        h('button', { class: 'btn btn-ghost btn-sm', onclick: () => openPaste(col) }, '📋 วางจาก Excel')
      )),

    h('div', { class: 'card card-tight' }, rows)
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

function refreshProgress(col) {
  const el = document.getElementById('grade-progress');
  if (el) el.textContent = progressText(col);
}

// ── เพิ่ม / แก้ไขรายการ ─────────────────────────────────────

function openItemForm(edit) {
  const b = bucketOf(ui.bucket);
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
          `ใส่คะแนนเต็มจริงได้เลย ระบบจะเทียบสัดส่วนเป็น ${settings().weight[ui.bucket]} คะแนนของ SGS ให้เอง`)),
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
