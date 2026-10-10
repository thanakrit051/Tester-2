/* ตามงาน / ตามตัว — คัดลอกรายชื่อเป็นข้อความไปวางในกลุ่มไลน์ห้อง
 *
 * ครูไทยส่วนใหญ่ตามงานผ่านกลุ่มไลน์ ของเดิมต้องเปิดรายชื่อแล้วพิมพ์ใหม่ทีละคน
 * ตรงนี้ไม่ต่อระบบอะไรกับ LINE เลย — แค่สร้างข้อความให้แล้วคัดลอก/แชร์
 * (มือถือมีปุ่มแชร์ของเครื่อง เลือกไลน์ได้ตรง ๆ)
 *
 * openCopyList({
 *   title: 'ตามงาน · ใบงานที่ 3',
 *   sub:   'ม.1/1 · เต็ม 10',
 *   topic: 'ใบงานที่ 3 · ม.1/1 คณิตศาสตร์',          ← บรรทัดแรกของข้อความ
 *   groups: [{ id, label, head: (n) => 'ยังไม่ส่ง 3 คน', people: [{ no, name, extra }],
 *              names: true, note: 'คำเตือนใต้ตัวเลือก' }]
 * })
 */

import { h, modal, mount, toast, copyText } from '../dom.js';
import { store } from '../storage.js';

const NOTE_KEY = 'ac.chaseNote';

export function openCopyList({ title, sub, topic, groups }) {
  const usable = groups.filter(g => g.people.length);
  if (!usable.length) return toast('ไม่มีใครค้างแล้ว 🎉', 'ok');

  const ui = {
    gid: usable[0].id,
    names: {},                                  // ใส่ชื่อไหม — แยกตามกลุ่ม
    note: store.get(NOTE_KEY) ?? 'ส่งได้ที่ครูภายในสัปดาห์นี้'
  };
  usable.forEach(g => { ui.names[g.id] = g.names !== false; });

  const message = () => {
    const g = usable.find(x => x.id === ui.gid);
    const lines = g.people.map(p =>
      `• เลขที่ ${p.no}` + (ui.names[g.id] && p.name ? ` ${p.name}` : '') + (p.extra ? ` (${p.extra})` : ''));
    return [`[ตามงาน] ${topic}`, g.head(g.people.length), ...lines, ui.note.trim()].filter(Boolean).join('\n');
  };

  modal((close) => {
    const body = h('div');

    function render() {
      const g = usable.find(x => x.id === ui.gid);
      const preview = h('div', { class: 'chase-msg' }, message());
      const noteIn = h('input', {
        value: ui.note, placeholder: 'ข้อความท้าย (ไม่ใส่ก็ได้)', 'aria-label': 'ข้อความท้าย',
        oninput: (e) => { ui.note = e.target.value; store.set(NOTE_KEY, ui.note); preview.textContent = message(); }
      });

      mount(body,
        h('h2', null, title),
        sub && h('div', { class: 'hint', style: { marginTop: '-6px', marginBottom: '12px' } }, sub),

        usable.length > 1 && h('div', { class: 'dense-seg', role: 'group', 'aria-label': 'เลือกกลุ่ม' },
          usable.map(x => h('button', {
            'data-on': x.id === ui.gid ? '1' : '0', 'aria-pressed': x.id === ui.gid ? 'true' : 'false',
            onclick: () => { ui.gid = x.id; render(); }
          }, `${x.label} (${x.people.length})`))),

        h('label', { class: 'chase-opt' },
          h('input', {
            type: 'checkbox', checked: ui.names[g.id],
            onchange: (e) => { ui.names[g.id] = e.target.checked; render(); }
          }),
          h('span', null,
            h('b', null, 'ใส่ชื่อนักเรียนด้วย'),
            h('small', null, 'ไม่ติ๊ก = บอกแค่เลขที่ · เหมาะกับกลุ่มที่มีผู้ปกครองอยู่ด้วย'))),
        g.note && h('div', { class: 'hint', style: { margin: '0 0 8px' } }, g.note),

        h('div', { class: 'field', style: { marginBottom: '8px' } }, noteIn),
        preview,

        h('div', { class: 'btn-row', style: { marginTop: '12px' } },
          h('button', {
            class: 'btn', style: { flex: '1' },
            onclick: async () => {
              if (await copyText(message())) { toast('คัดลอกแล้ว — ไปวางในกลุ่มไลน์ได้เลย', 'ok', 3000); close(); }
              else toast('คัดลอกไม่สำเร็จ — กดค้างที่ข้อความแล้วเลือกคัดลอกเองได้', 'err', 5000);
            }
          }, 'คัดลอกข้อความ'),
          canShare() && h('button', {
            class: 'btn btn-ghost', style: { flex: '1' },
            onclick: async () => {
              try { await navigator.share({ text: message() }); close(); }
              catch (e) { /* ครูกดยกเลิกหน้าแชร์ — ไม่ต้องบอกอะไร */ }
            }
          }, 'แชร์…'))
      );
    }

    render();
    return body;
  });
}

const canShare = () => { try { return typeof navigator.share === 'function'; } catch (e) { return false; } };

