/* ขึ้นภาคเรียนใหม่ — สำรองไฟล์ · ตั้งปี/ภาคเรียน · ล้างคะแนนหรือลบห้องในทีเดียว
 *
 * เดิมครูต้องลบห้องทีละห้อง (ข้อมูลหายถาวร ไม่มีสำรอง) แล้วสร้างใหม่และวางรายชื่อใหม่ทั้งหมด
 * ทั้งที่เทอม 2 ส่วนใหญ่สอนเด็กกลุ่มเดิม · งานจริงทำในชีต (apps-script/09_NewTerm.gs)
 */

import { h, modal, toast, confirmBox } from '../dom.js';
import { state, startNewTerm } from '../state.js';
import * as api from '../api.js';
import { serverSupports } from '../version.js';
import { withIcon } from '../icons.js';
import { parseTimetable, serializeTimetable, hasTimetable, withoutClasses } from '../timetable.js';

const CHOICES = [
  ['reset', 'ล้างคะแนน'],
  ['drop',  'ลบห้อง'],
  ['keep',  'ไม่แตะ']
];

/** ภาคเรียนถัดไป: 1 → 2 ปีเดิม · 2 (หรือ 3) → 1 ปีถัดไป */
function nextTerm(year, term) {
  const y = Number(year), t = Number(term);
  if (t === 1) return { year: String(year || ''), term: '2' };
  return { year: Number.isFinite(y) && y > 0 ? String(y + 1) : '', term: '1' };
}

/** @param {{ setMidDate?: () => void }} opts  setMidDate = ปุ่ม "ตั้งวันสอบกลางภาค" ในหน้าต่างแจ้งผล */
export function openNewTerm({ setMidDate } = {}) {
  if (!serverSupports('newTerm', api.serverInfo)) {
    return toast('โค้ดในชีตยังเป็นรุ่นเก่า ยังไม่มีคำสั่งขึ้นภาคเรียนใหม่ — อัปโค้ดในชีตก่อน (⚙️ ตั้งค่า → ตรวจสภาพระบบ)', 'err', 7000);
  }
  if (!api.net.online) return toast('ต้องต่อเน็ตก่อน — ขั้นตอนนี้ทำในชีตทั้งหมด', 'err');

  const cfg = state.config || {};
  const curYear = String(cfg.year || ''), curTerm = String(cfg.term || '');
  const nx = nextTerm(curYear, curTerm);
  const yearIn = h('input', { value: nx.year, inputmode: 'numeric', placeholder: 'เช่น 2569', 'aria-label': 'ปีการศึกษาใหม่' });
  const termIn = h('input', { value: nx.term, inputmode: 'numeric', placeholder: '1 หรือ 2', 'aria-label': 'ภาคเรียนที่' });

  // ขึ้นเทอม 2 ปีเดิม = เด็กกลุ่มเดิม เก็บรายชื่อไว้ · ขึ้นปีใหม่ = ห้องเปลี่ยน ลบทิ้ง
  const def = nx.term === '2' ? 'reset' : 'drop';
  const roomOf = (c) => `${[c.grade, c.room].filter(Boolean).join('/') || '—'} · ${c.subject}`;
  const picks = state.classes.map(c => {
    const sel = h('select', { 'aria-label': `ทำอะไรกับห้อง ${roomOf(c)}` },
      CHOICES.map(([v, l]) => h('option', { value: v, selected: v === def }, l)));
    sel.dataset.id = c.classId;
    return sel;
  });

  const tt = parseTimetable(cfg.timetable);
  const ttBox = hasTimetable(tt) ? h('input', { type: 'checkbox', checked: true }) : null;

  modal((close) => {
    const go = h('button', { class: 'btn btn-danger btn-block' }, 'ขึ้นภาคเรียนใหม่');

    go.onclick = async () => {
      const year = yearIn.value.trim(), term = termIn.value.trim();
      if (!year || !term) return toast('กรอกปีการศึกษาและภาคเรียนใหม่ให้ครบ', 'err');
      if (year === curYear && term === curTerm) return toast('ปี/ภาคเรียนใหม่ยังตรงกับของเดิม', 'err');

      const reset = picks.filter(s => s.value === 'reset').map(s => s.dataset.id);
      const drop  = picks.filter(s => s.value === 'drop').map(s => s.dataset.id);

      // ตารางสอน: ล้างทั้งหมด (เก็บเวลาคาบไว้ เพราะใช้ทั้งโรงเรียน) หรืออย่างน้อยเอาห้องที่ลบออก
      const config = { mid_date: '', student_summary: 'off' };
      if (ttBox) config.timetable = serializeTimetable(withoutClasses(tt, ttBox.checked ? 'all' : drop));

      const what = [
        reset.length && `ล้างคะแนน ${reset.length} ห้อง (เก็บรายชื่อไว้)`,
        drop.length && `ลบ ${drop.length} ห้อง`
      ].filter(Boolean).join(' · ') || 'ไม่แตะห้องไหนเลย';
      if (!await confirmBox(`ขึ้นภาคเรียนที่ ${term}/${year}?`,
        `${what} — ระบบสำรองทั้งไฟล์ของภาคเรียน ${curTerm || '-'}/${curYear || '-'} ไว้ใน Google Drive ก่อนเสมอ`,
        'ขึ้นภาคเรียนใหม่')) return;

      go.disabled = true;
      go.textContent = 'กำลังสำรองไฟล์และจัดห้อง… (อาจใช้ถึงครึ่งนาที)';
      try {
        const res = await startNewTerm({ year, term, reset, drop, config });
        close();
        done(res, `${curTerm || '-'}/${curYear || '-'}`, `${term}/${year}`, setMidDate);
      } catch (e) {
        go.disabled = false; go.textContent = 'ลองใหม่';
        toast(e.message, 'err', 6000);
      }
    };

    return h('div', null,
      h('h2', null, 'ขึ้นภาคเรียนใหม่'),
      h('div', { class: 'hint', style: { marginTop: '-6px', marginBottom: '12px' } },
        `ตอนนี้: ภาคเรียนที่ ${curTerm || '-'}/${curYear || '-'}`),
      h('div', { class: 'field-row' },
        h('div', { class: 'field' }, h('label', null, 'ปีการศึกษาใหม่'), yearIn),
        h('div', { class: 'field' }, h('label', null, 'ภาคเรียนที่'), termIn)),

      state.classes.length > 0 && h('div', { class: 'field' },
        h('label', null, 'ห้องเรียนเดิม'),
        h('div', { class: 'room-list nt-list' }, state.classes.map((c, i) => h('div', { class: 'room-row' },
          h('span', { class: 'room-main' },
            h('b', null, roomOf(c)),
            h('small', null, `${c.studentCount || 0} คน${c.subjectCode ? ' · ' + c.subjectCode : ''}`)),
          picks[i]))),
        h('div', { class: 'hint' },
          'ล้างคะแนน = เก็บรายชื่อนักเรียนไว้ ลบการเช็คชื่อ งาน และคะแนนทั้งหมด (เหมาะกับเทอม 2 ที่สอนห้องเดิม)')),

      ttBox && h('label', { class: 'room-list nt-check' },
        h('span', { class: 'room-row' }, ttBox,
          h('span', { class: 'room-main' },
            h('b', null, 'ล้างตารางสอนเดิม'),
            h('small', null, 'เก็บเวลาของแต่ละคาบไว้ ตั้งแค่ว่าคาบไหนสอนห้องไหนใหม่')))),

      h('ul', { class: 'nt-notes' },
        h('li', null, 'สำรองทั้งไฟล์ไว้ในโฟลเดอร์ “AssignCheck — ภาคเรียนที่ผ่านมา” ก่อนทำอะไรทุกครั้ง เปิดดู/พิมพ์ย้อนหลังได้'),
        h('li', null, 'ล้างวันสอบกลางภาค และปิดหน้าสรุปผลภาคเรียน (เกรด) ของนักเรียน'),
        h('li', null, 'น้ำหนักคะแนน เกณฑ์ และการตั้งค่าอื่นคงเดิม')),
      go
    );
  });
}

/** แจ้งผล + ลิงก์ไฟล์สำรอง (ครูต้องรู้ว่าของเทอมเก่าไปอยู่ไหน) + ทางไปตั้งวันสอบกลางภาคที่เพิ่งถูกล้าง */
function done(res, from, to, setMidDate) {
  modal((close) => h('div', null,
    h('h2', null, `เริ่มภาคเรียนที่ ${to} แล้ว`),
    h('p', { style: { color: 'var(--ink-2)', marginTop: 0, lineHeight: '1.7' } },
      [res.reset && `ล้างคะแนน ${res.reset} ห้อง`, res.dropped && `ลบ ${res.dropped} ห้อง`].filter(Boolean).join(' · ') ||
        'ไม่ได้แตะห้องไหน',
      h('br'), `ข้อมูลภาคเรียน ${from} เก็บไว้ในไฟล์สำรอง:`),
    res.archive && h('a', {
      class: 'btn btn-ghost btn-block', href: res.archive.url, target: '_blank', rel: 'noopener',
      style: { marginBottom: '8px', textDecoration: 'none' }
    }, withIcon('folder', 'เปิดไฟล์สำรอง')),
    setMidDate && h('button', {
      class: 'btn btn-block', style: { marginBottom: '8px' }, onclick: () => { close(); setMidDate(); }
    }, 'ต่อไป: ตั้งวันสอบกลางภาค'),
    h('button', { class: setMidDate ? 'btn btn-ghost btn-block' : 'btn btn-block', onclick: close },
      setMidDate ? 'ไว้ทีหลัง' : 'เรียบร้อย')
  ));
}
