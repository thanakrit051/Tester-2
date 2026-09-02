/* หน้าแรก — จัดการห้องเรียน/รายวิชา และภาพรวม */

import { h, modal, toast, confirmBox, todayISO } from '../dom.js';
import {
  state, go, loadClass, createClass, updateClassMeta, deleteClass, setStudents, settings
} from '../state.js';
import { computeClass } from '../score.js';

export function viewHome() {
  // ลำดับตามดีไซน์: เปิดแอปมาต้องเห็น "สิ่งที่ต้องทำต่อ" ก่อน
  // แล้วค่อยเป็นรายการห้องไว้สลับ
  return h('div', { class: 'page' },
    state.cls && overviewCard(),

    h('div', { style: { display: 'flex', alignItems: 'center', gap: '12px', margin: '18px 0 12px' } },
      h('div', { style: { fontSize: '15px', fontWeight: '700', flex: '1' } },
        `ห้องเรียนของฉัน · ${state.classes.length} ห้อง-วิชา`),
      h('button', { class: 'btn-dark', onclick: () => openClassForm() }, '+ เพิ่มห้อง')
    ),

    state.classes.length === 0
      ? h('div', { class: 'card empty' },
          h('div', { class: 'empty-icon' }, '📚'),
          h('div', { style: { fontWeight: '600' } }, 'ยังไม่มีห้องเรียน'),
          h('div', { style: { fontSize: '13px', marginBottom: '14px' } },
            'สร้างห้องแรก เช่น "ม.1/1 · คณิตศาสตร์พื้นฐาน"'),
          h('button', { class: 'btn', onclick: () => openClassForm() }, 'สร้างห้องเรียนแรก'))
      : h('div', { class: 'class-grid' }, state.classes.map(classCard))
  );
}

function classCard(c) {
  const active = c.classId === state.classId;
  return h('div', { class: 'class-card', 'data-on': active ? '1' : '0' },
    h('button', {
      style: { display: 'flex', alignItems: 'center', gap: '12px', flex: '1', minWidth: '0', textAlign: 'left' },
      onclick: async () => { await loadClass(c.classId); go('att'); }
    },
      h('div', { class: 'class-avatar' }, [c.grade, c.room].filter(Boolean).join('/') || '—'),
      h('div', { style: { minWidth: '0' } },
        h('div', { class: 'class-name' }, c.subject),
        h('div', { class: 'class-meta' },
          `${c.studentCount || 0} คน${c.subjectCode ? ' · ' + c.subjectCode : ''}`))
    ),
    h('button', {
      class: 'icon-btn', style: { color: 'var(--ink-3)' },
      onclick: () => openClassMenu(c)
    }, '⋯')
  );
}

function overviewCard() {
  const rows = computeClass(state.cls, settings());
  if (!rows.length) {
    return h('div', { class: 'card empty' },
      h('div', { class: 'empty-icon' }, '👥'),
      h('div', { style: { fontWeight: '600', marginBottom: '10px' } }, 'ห้องนี้ยังไม่มีรายชื่อนักเรียน'),
      h('button', { class: 'btn', onclick: () => openRoster(state.cls) }, 'นำเข้ารายชื่อ'));
  }
  const S = settings();
  const risk  = rows.filter(r => r.attN > 0 && r.pct < S.minPct).length;
  const graded = rows.filter(r => r.dataN > 0);
  const avg   = graded.length ? graded.reduce((a, r) => a + r.total, 0) / graded.length : null;
  const zero  = rows.filter(r => r.flag.includes('เสี่ยงติด 0')).length;

  const cls = state.cls;
  const attToday = (cls.columns || []).some(c => c.kind === 'ATT' && c.date === todayISO());

  // ── การ์ดหลัก: ห้องที่เลือกอยู่ + ปุ่มที่ควรกดตอนนี้ ──
  // ไลม์คือปุ่มหลักสีเดียวของแอป จึงมีได้จุดเดียวในหน้าจอ
  const hero = h('div', { class: 'hero' },
    h('div', { class: 'hero-body' },
      h('div', { class: 'hero-kicker' },
        [cls.meta.grade, cls.meta.room].filter(Boolean).join('/') + ' · ' + (cls.meta.subjectCode || 'ห้องที่เลือกอยู่')),
      h('div', { class: 'hero-title' }, cls.meta.subject),
      h('div', { class: 'hero-meta' },
        `${rows.length} คน · ` + (attToday ? 'เช็คชื่อวันนี้แล้ว' : 'ยังไม่ได้เช็คชื่อวันนี้'))),
    h('div', { class: 'hero-actions' },
      h('button', { class: 'btn', onclick: () => go('att') },
        attToday ? 'เปิดหน้าเช็คชื่อ' : '✓ เริ่มเช็คชื่อวันนี้'),
      h('button', { class: 'hero-alt', onclick: () => go('work') }, 'กรอกงาน / คะแนน'))
  );

  // ── สิ่งที่ยังค้าง ──
  const pending = rows.reduce((a, r) => a + r.pending, 0);
  const todos = [];
  if (pending > 0) {
    todos.push({ c: 'var(--st-late)', t: `ยังไม่ตรวจ ${pending} ช่อง`, go: 'work', cta: 'ตรวจ' });
  }
  if (!String(state.config.mid_date || '').trim()) {
    todos.push({ c: 'var(--st-miss)', t: 'ยังไม่ได้ตั้งวันสอบกลางภาค', go: 'settings', cta: 'ตั้งค่า' });
  }
  if (risk > 0) {
    todos.push({ c: 'var(--st-miss)', t: `เสี่ยงติด มส ${risk} คน`, go: 'report', cta: 'ดู' });
  }
  if (!attToday) {
    todos.push({ c: 'var(--accent)', t: 'ยังไม่ได้เช็คชื่อวันนี้', go: 'att', cta: 'เช็ค' });
  }

  return h('div', null,
    hero,

    // ดีไซน์วาง "ค้างอยู่" กับตัวเลขสรุปเคียงกันบน PC · ซ้อนกันบนมือถือ
    h('div', { class: 'home-grid' },
      h('div', { class: 'card' },
        h('div', { style: { fontWeight: '700', fontSize: '14px', marginBottom: '10px' } },
          `ค้างอยู่ · ${[cls.meta.grade, cls.meta.room].filter(Boolean).join('/') || cls.meta.subject}`),
        todos.length === 0
          ? h('div', { style: { fontSize: '13px', color: 'var(--ink-2)' } }, 'ไม่มีอะไรค้าง 🎉')
          : todos.map(t => h('button', { class: 'todo-row', onclick: () => go(t.go) },
              h('i', { style: { background: t.c } }), t.t, h('b', null, t.cta + ' →')))),

      h('div', { class: 'card stats-card' },
        h('div', { class: 'stats' },
          stat('g', rows.length, 'นักเรียน'),
          stat('b', avg === null ? '—' : avg.toFixed(1), 'คะแนนเฉลี่ย'),
          stat('a', risk, 'เสี่ยง มส'),
          stat('r', zero, 'เสี่ยงติด 0')),
        avg === null && h('div', { class: 'hint' },
          'ยังไม่ได้เช็คชื่อหรือกรอกคะแนน — ตัวเลขจะขึ้นเมื่อเริ่มบันทึกข้อมูล'))
    )
  );
}

const stat = (cls, num, lbl) => h('div', { class: 'stat ' + cls },
  h('div', { class: 'stat-num' }, String(num)), h('div', { class: 'stat-lbl' }, lbl));

// ── สร้าง / แก้ไขห้อง ───────────────────────────────────────

function openClassForm(edit) {
  const m = edit || {};
  const subject = h('input', { value: m.subject || '', placeholder: 'เช่น คณิตศาสตร์พื้นฐาน' });
  const code    = h('input', { value: m.subjectCode || '', placeholder: 'เช่น ค21101' });
  const grade   = h('input', { value: m.grade || '', placeholder: 'เช่น ม.1' });
  const room    = h('input', { value: m.room || '', placeholder: 'เช่น 1' });
  const roster  = h('textarea', { rows: 6, placeholder: '61475\tกฤตภาส คงพลอย\n61476\tคมกริช พิลา\n\n(วางจาก Excel ได้เลย หรือใส่แค่ชื่อก็ได้)' });

  modal((close) => {
    const save = h('button', { class: 'btn btn-block' }, edit ? 'บันทึก' : 'สร้างห้องเรียน');
    save.onclick = async () => {
      if (!subject.value.trim()) return toast('กรอกชื่อวิชา', 'err');
      save.disabled = true; save.textContent = 'กำลังบันทึก…';
      const meta = {
        subject: subject.value.trim(), subjectCode: code.value.trim(),
        grade: grade.value.trim(), room: room.value.trim()
      };
      try {
        if (edit) { await updateClassMeta(meta); toast('บันทึกแล้ว', 'ok'); }
        else {
          const students = parseRoster(roster.value);
          await createClass(meta, students);
          toast(`สร้างห้องแล้ว · ${students.length} คน`, 'ok');
        }
        close();
      } catch (e) {
        save.disabled = false; save.textContent = 'ลองใหม่';
        toast(e.message, 'err', 5000);
      }
    };

    return h('div', null,
      h('h2', null, edit ? 'แก้ไขห้องเรียน' : 'เพิ่มห้องเรียน / รายวิชา'),
      h('div', { class: 'field' }, h('label', null, 'ชื่อวิชา *'), subject),
      h('div', { class: 'field-row' },
        h('div', { class: 'field' }, h('label', null, 'รหัสวิชา'), code),
        h('div', { class: 'field' }, h('label', null, 'ระดับชั้น'), grade),
        h('div', { class: 'field' }, h('label', null, 'ห้อง'), room)),
      !edit && h('div', { class: 'field' },
        h('label', null, 'รายชื่อนักเรียน (ไม่ใส่ตอนนี้ก็ได้)'), roster,
        h('div', { class: 'hint' }, 'รองรับ: “เลขที่ ⇥ เลขประจำตัว ⇥ ชื่อ” · “เลขประจำตัว ⇥ ชื่อ” · หรือชื่ออย่างเดียว')),
      !edit && h('div', { class: 'hint', style: { marginBottom: '10px' } },
        '💡 แต่ละห้อง-วิชาจะได้แท็บของตัวเองใน Google Sheet เก็บทั้งเช็คชื่อ คะแนน และสรุปไว้ด้วยกัน'),
      save
    );
  });
}

function openClassMenu(c) {
  modal((close) => h('div', null,
    h('h2', null, c.subject),
    h('div', { style: { color: 'var(--ink-2)', fontSize: '13px', marginBottom: '14px' } },
      `${[c.grade, c.room].filter(Boolean).join('/') || '—'} · ${c.studentCount || 0} คน · แท็บ “${c.sheetName}”`),
    h('div', { style: { display: 'grid', gap: '8px' } },
      h('button', { class: 'btn btn-ghost btn-block', onclick: async () => { close(); await loadClass(c.classId); openRoster(state.cls); } }, '👥 จัดการรายชื่อนักเรียน'),
      h('button', { class: 'btn btn-ghost btn-block', onclick: async () => { close(); await loadClass(c.classId); openClassForm(state.cls.meta); } }, '✏️ แก้ไขข้อมูลห้อง'),
      h('button', {
        class: 'btn btn-danger btn-block',
        onclick: async () => {
          close();
          const ok = await confirmBox('ลบห้องเรียน?',
            `แท็บ “${c.sheetName}” และข้อมูลทั้งหมดในนั้นจะถูกลบถาวร กู้คืนไม่ได้`, 'ลบถาวร');
          if (!ok) return;
          try { await deleteClass(c.classId); toast('ลบแล้ว', 'ok'); }
          catch (e) { toast(e.message, 'err'); }
        }
      }, '🗑 ลบห้องเรียน')
    )
  ));
}

// ── รายชื่อนักเรียน ─────────────────────────────────────────

function openRoster(cls) {
  const initial = (cls.students || [])
    .map(s => [s.no, s.sid, s.name].join('\t')).join('\n');
  const ta = h('textarea', { rows: 14, value: initial, style: { fontFamily: 'ui-monospace, monospace', fontSize: '13px' } });

  modal((close) => {
    const save = h('button', { class: 'btn btn-block' }, 'บันทึกรายชื่อ');
    save.onclick = async () => {
      const students = parseRoster(ta.value);
      if (!students.length) return toast('ไม่มีรายชื่อ', 'err');
      save.disabled = true; save.textContent = 'กำลังบันทึก…';
      try {
        await setStudents(students);
        toast(`บันทึก ${students.length} คนแล้ว`, 'ok');
        close();
      } catch (e) {
        save.disabled = false; save.textContent = 'ลองใหม่';
        toast(e.message, 'err', 5000);
      }
    };
    return h('div', null,
      h('h2', null, 'รายชื่อนักเรียน · ' + cls.meta.subject),
      h('div', { class: 'hint', style: { marginBottom: '8px' } },
        'หนึ่งบรรทัดต่อหนึ่งคน คั่นด้วย Tab หรือ , — วางจาก Excel ได้เลย'),
      ta,
      h('div', { class: 'hint', style: { margin: '8px 0 12px' } },
        '⚠️ คะแนนเดิมจะถูกจับคู่กลับด้วย “เลขประจำตัว” ถ้าเปลี่ยนเลขประจำตัว คะแนนของคนนั้นจะหาย'),
      save
    );
  });
}

/**
 * แปลงข้อความรายชื่อเป็น [{no, sid, name}]
 * รองรับทั้งแบบคั่นด้วย Tab / จุลภาค / เว้นวรรคหลายตัว (วางจาก Excel)
 * และแบบคั่นด้วยเว้นวรรคเดียว เช่น "1 61475 กฤตภาส คงพลอย" (คัดลอกจาก PDF/เว็บ)
 */
function parseRoster(text) {
  return String(text || '').split(/\r?\n/)
    .map(l => l.trim()).filter(Boolean)
    .map((line, i) => {
      let p = line.split(/\t|,|\s{2,}/).map(x => x.trim()).filter(Boolean);

      // ไม่มีตัวคั่นชัดเจน → ดึงเลขที่/เลขประจำตัวที่นำหน้าออกมาเอง
      if (p.length === 1) {
        const tok = line.split(/\s+/);
        const lead = [];
        while (tok.length > 1 && lead.length < 2 && /^\d+$/.test(tok[0])) lead.push(tok.shift());
        p = lead.concat(tok.join(' '));
      }

      if (p.length >= 3 && /^\d{1,3}$/.test(p[0])) return { no: p[0], sid: p[1], name: p.slice(2).join(' ') };
      if (p.length >= 2 && /^\d{3,}$/.test(p[0]))  return { no: String(i + 1), sid: p[0], name: p.slice(1).join(' ') };
      if (p.length >= 2 && /^\d{1,3}$/.test(p[0])) return { no: p[0], sid: '', name: p.slice(1).join(' ') };
      return { no: String(i + 1), sid: '', name: p.join(' ') };
    })
    .map((s, i) => ({ no: s.no || String(i + 1), sid: s.sid || `T${i + 1}`, name: s.name }));
}
