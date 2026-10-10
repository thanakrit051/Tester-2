/* ตั้งตารางสอน — กล่องแก้ไขตารางรายสัปดาห์
 *
 * ทำครั้งเดียวตอนต้นเทอม แล้วหน้าแรกจะรู้เองว่าตอนนี้ครูต้องสอนห้องไหน คาบอะไร
 * (ตรรกะอยู่ใน js/timetable.js · ค่าเก็บในแท็บ ⚙️ ตั้งค่า ของชีต ใช้ได้ทุกเครื่อง)
 */

import { h, modal, mount, toast } from '../dom.js';
import { state, saveConfig } from '../state.js';
import {
  DAYS, MAX_PERIODS, parseTimetable, serializeTimetable, weeklyCount, toMin, fromMin
} from '../timetable.js';

/** ตารางสอนที่ตั้งไว้ตอนนี้ (อ่านจากค่าตั้งค่าล่าสุดเสมอ) */
export const readTimetable = () => parseTimetable(state.config.timetable);

const classLabel = (c) => `${[c.grade, c.room].filter(Boolean).join('/') || '—'} · ${c.subject}`;

export function openTimetableEditor() {
  if (!state.classes.length) return toast('สร้างห้องเรียนก่อน แล้วค่อยตั้งตารางสอน', 'err');

  // แก้บนสำเนา — กดปิดโดยไม่บันทึกต้องไม่มีอะไรเปลี่ยน
  const tt = readTimetable();
  const today = new Date().getDay();
  const ui = { day: today >= 1 && today <= 5 ? today : 1, times: false, saving: false };
  const known = new Set(state.classes.map(c => c.classId));

  modal((close) => {
    const body = h('div');

    const slotsOf = (d) => (tt.days[d] ||= {});
    const countOf = (d) => Object.values(tt.days[d] || {}).filter(id => id && known.has(id)).length;

    function render() {
      const day = slotsOf(ui.day);
      const dayInfo = DAYS.find(x => x.d === ui.day);

      const rows = [];
      tt.times.forEach(([start, end], i) => {
        const p = i + 1;
        // ช่วงพักยาว (เช่นพักกลางวัน) คั่นไว้ให้เห็นว่าเช้า/บ่ายแยกกันตรงไหน
        if (i > 0 && toMin(start) - toMin(tt.times[i - 1][1]) >= 30) {
          rows.push(h('div', { class: 'tt-break' }, `พัก ${tt.times[i - 1][1]}–${start}`));
        }
        const sel = h('select', {
          'aria-label': `${dayInfo.name} คาบ ${p}`,
          'data-set': day[p] && known.has(day[p]) ? '1' : '0',
          onchange: (e) => {
            if (e.target.value) day[p] = e.target.value; else delete day[p];
            render();
          }
        },
          h('option', { value: '' }, 'ว่าง — ไม่มีสอน'),
          state.classes.map(c => h('option', { value: c.classId, selected: day[p] === c.classId }, classLabel(c))));

        rows.push(h('div', { class: 'tt-row' },
          h('div', { class: 'tt-when' },
            h('b', null, `คาบ ${p}`),
            ui.times
              ? h('span', { class: 'tt-times' },
                  timeInput(start, (v) => { tt.times[i][0] = v; }), '–',
                  timeInput(end, (v) => { tt.times[i][1] = v; }))
              : h('span', null, `${start}–${end}`)),
          sel));
      });

      mount(body,
        h('h2', null, 'ตารางสอน'),
        h('div', { class: 'hint', style: { marginTop: '-6px', marginBottom: '12px' } },
          `ตั้งครั้งเดียว หน้าแรกจะบอกว่าตอนนี้สอนห้องไหน · ${weeklyCount(tt)} คาบ/สัปดาห์`),

        h('div', { class: 'tt-days', role: 'tablist', 'aria-label': 'วัน' },
          DAYS.map(d => h('button', {
            role: 'tab', 'aria-selected': d.d === ui.day ? 'true' : 'false',
            'data-on': d.d === ui.day ? '1' : '0',
            onclick: () => { ui.day = d.d; render(); }
          }, h('b', null, d.short), h('small', null, `${countOf(d.d)} คาบ`)))),

        h('div', { class: 'tt-tools' },
          h('b', null, dayInfo.name),
          ui.day !== 1 && h('button', {
            class: 'btn btn-ghost btn-sm',
            onclick: () => { tt.days[ui.day] = { ...(tt.days[1] || {}) }; render(); }
          }, 'คัดลอกจากวันจันทร์'),
          h('button', {
            class: 'btn btn-ghost btn-sm', 'aria-pressed': ui.times ? 'true' : 'false',
            onclick: () => { ui.times = !ui.times; render(); }
          }, ui.times ? 'เสร็จ' : 'ตั้งเวลาคาบ')),

        h('div', { class: 'tt-list' }, rows),

        ui.times && h('div', { class: 'btn-row', style: { marginTop: '8px' } },
          tt.times.length < MAX_PERIODS && h('button', {
            class: 'btn btn-soft btn-sm', style: { flex: '1' },
            onclick: () => {
              const last = tt.times[tt.times.length - 1];
              const s = toMin(last[1]);
              tt.times.push([fromMin(s), fromMin(s + 50)]);
              render();
            }
          }, '+ เพิ่มคาบ'),
          tt.times.length > 1 && h('button', {
            class: 'btn btn-ghost btn-sm', style: { flex: '1' },
            onclick: () => {
              const p = tt.times.length;
              tt.times.pop();
              for (const d of Object.values(tt.days)) delete d[p];
              render();
            }
          }, `ลบคาบ ${tt.times.length}`)),

        h('div', { class: 'hint', style: { margin: '10px 0' } },
          'เวลาคาบใช้เหมือนกันทุกวัน · เก็บไว้ในชีต แท็บ ⚙️ ตั้งค่า เปิดเครื่องไหนก็เห็นตารางเดียวกัน'),

        h('button', {
          class: 'btn btn-block', disabled: ui.saving,
          onclick: async () => {
            const bad = tt.times.findIndex(([s, e]) => isNaN(toMin(s)) || isNaN(toMin(e)) || toMin(e) <= toMin(s));
            if (bad >= 0) return toast(`เวลาคาบ ${bad + 1} ไม่ถูกต้อง (เวลาเลิกต้องหลังเวลาเริ่ม)`, 'err');
            ui.saving = true; render();
            try {
              await saveConfig({ timetable: serializeTimetable(tt) });
              toast('บันทึกตารางสอนแล้ว', 'ok');
              close();
            } catch (e) {
              ui.saving = false; render();
              toast('บันทึกไม่สำเร็จ: ' + e.message, 'err', 5000);
            }
          }
        }, ui.saving ? 'กำลังบันทึก…' : 'บันทึกตารางสอน')
      );
    }

    render();
    return body;
  });
}

function timeInput(value, set) {
  return h('input', {
    type: 'time', value, class: 'tt-time', required: true,
    onchange: (e) => { if (e.target.value) set(e.target.value); }
  });
}
