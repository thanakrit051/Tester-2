/* หน้าตั้งค่า — น้ำหนักคะแนน กติกาเช็คชื่อ และการเชื่อมต่อ */

import { h, toast, confirmBox, modal } from '../dom.js';
import { state, saveConfig, sync, bootstrap, go, emit } from '../state.js';
import * as api from '../api.js';
import { auth } from '../auth.js';
import { icon } from '../icons.js';
import { THEMES, getTheme, setTheme } from '../theme.js';

const FIELDS = [
  { group: 'ทั่วไป', items: [
    { k: 'year',     label: 'ปีการศึกษา' },
    { k: 'term',     label: 'ภาคเรียนที่' },
    { k: 'teacher',  label: 'ชื่อครูผู้สอน' },
    { k: 'mid_date', label: 'วันสอบกลางภาค', type: 'date',
      hint: 'ใช้เดาว่าวันที่เช็คชื่ออยู่ช่วงก่อนหรือหลังกลางภาค' }
  ]},
  { group: 'น้ำหนักคะแนน → ช่องใน SGS', items: [
    { k: 'w_work1', label: 'ช่อง 1 · ส่งงาน (ก่อนกลางภาค)',       type: 'number' },
    { k: 'w_quiz1', label: 'ช่อง 2 · สอบเก็บคะแนน (ก่อนกลางภาค)', type: 'number' },
    { k: 'w_att1',  label: 'ช่อง 3 · เข้าเรียน (ก่อนกลางภาค)',     type: 'number' },
    { k: 'w_mid',   label: 'กลางภาค',                              type: 'number' },
    { k: 'w_work2', label: 'ช่อง 10 · ส่งงาน (หลังกลางภาค)',       type: 'number' },
    { k: 'w_quiz2', label: 'ช่อง 11 · สอบเก็บคะแนน (หลังกลางภาค)', type: 'number' },
    { k: 'w_att2',  label: 'ช่อง 12 · เข้าเรียน (หลังกลางภาค)',    type: 'number' },
    { k: 'w_fin',   label: 'ปลายภาค',                              type: 'number' }
  ]},
  { group: 'การเข้าเรียน', items: [
    { k: 'att_mode', label: 'วิธีคิดคะแนน', type: 'select',
      options: [['ratio', 'คิดตามสัดส่วนคาบที่มา'], ['deduct', 'หักคะแนนจากเต็ม']] },
    { k: 'att_w_สาย',  label: 'โหมดสัดส่วน — น้ำหนักเมื่อ "สาย"', type: 'number', step: '0.1' },
    { k: 'att_w_ลา',   label: 'โหมดสัดส่วน — น้ำหนักเมื่อ "ลา"',  type: 'number', step: '0.1' },
    { k: 'att_d_สาย',  label: 'โหมดหักคะแนน — หักต่อการสาย 1 คาบ', type: 'number', step: '0.05' },
    { k: 'att_d_ขาด',  label: 'โหมดหักคะแนน — หักต่อการขาด 1 คาบ', type: 'number', step: '0.05' },
    { k: 'att_min_pct', label: 'เวลาเรียนขั้นต่ำ (%) ก่อนติด มส', type: 'number' },
    { k: 'att_count_ลา', label: 'นับ "ลา" เป็นเวลาเรียน', type: 'select',
      options: [['TRUE', 'นับ'], ['FALSE', 'ไม่นับ']] }
  ]},
  { group: 'การให้คะแนนและการปัดเศษ', items: [
    { k: 'ungraded_mode', label: 'ช่องที่ยังไม่ตรวจ', type: 'select',
      options: [['ignore', 'ไม่นำมาคิด (เหมาะระหว่างเทอม)'], ['zero', 'นับเป็น 0 คะแนน (ตอนตัดเกรด)']] },
    { k: 'late_penalty_pct', label: 'ส่งช้าหักกี่ % ของคะแนนเต็ม', type: 'number', step: '5',
      hint: '0 = ไม่หัก · ระบบหักให้อัตโนมัติตอนกดปุ่ม "ช้า" แก้คะแนนเองทีหลังได้' },
    { k: 'round_digits', label: 'ทศนิยมของคะแนนสรุป', type: 'select',
      options: [['0', 'จำนวนเต็ม'], ['1', '1 ตำแหน่ง'], ['2', '2 ตำแหน่ง']] },
    { k: 'round_mode', label: 'วิธีปัดเศษ', type: 'select',
      options: [['half', 'ปัดครึ่งขึ้น'], ['up', 'ปัดขึ้นเสมอ'], ['down', 'ปัดลงเสมอ']] },
    { k: 'grade_cuts', label: 'เกณฑ์เกรด (คะแนน:เกรด)',
      hint: 'เช่น 80:4, 75:3.5, 70:3, 65:2.5, 60:2, 55:1.5, 50:1, 0:0' }
  ]}
];

export function viewSettings() {
  const inputs = {};

  const groups = FIELDS.map(g => h('div', null,
    h('div', { class: 'section-title' }, g.group),
    h('div', { class: 'card' }, g.items.map(f => {
      const val = state.config[f.k] ?? '';
      let el;
      if (f.type === 'select') {
        el = h('select', { value: String(val) },
          f.options.map(([v, l]) => h('option', { value: v, selected: String(val) === v }, l)));
      } else {
        el = h('input', { type: f.type || 'text', step: f.step, value: String(val) });
      }
      inputs[f.k] = el;
      return h('div', { class: 'field' }, h('label', null, f.label), el,
        f.hint && h('div', { class: 'hint' }, f.hint));
    }))
  ));

  const saveBtn = h('button', { class: 'btn btn-block' }, '💾 บันทึกการตั้งค่า');
  saveBtn.onclick = async () => {
    const entries = {};
    for (const [k, el] of Object.entries(inputs)) entries[k] = el.value;
    const sum = ['w_work1', 'w_quiz1', 'w_att1', 'w_mid', 'w_work2', 'w_quiz2', 'w_att2', 'w_fin']
      .reduce((a, k) => a + (Number(entries[k]) || 0), 0);
    if (sum !== 100) {
      const ok = await confirmBox('น้ำหนักคะแนนรวม ' + sum + ' ไม่เท่ากับ 100',
        'SGS ปกติรวมได้ 100 คะแนนพอดี ต้องการบันทึกต่อไหม?', 'บันทึกต่อ');
      if (!ok) return;
    }
    saveBtn.disabled = true; saveBtn.textContent = 'กำลังบันทึก…';
    try { await saveConfig(entries); toast('บันทึกแล้ว', 'ok'); }
    catch (e) { toast(e.message, 'err', 5000); }
    finally { saveBtn.disabled = false; saveBtn.textContent = '💾 บันทึกการตั้งค่า'; }
  };

  const pending = api.queue.size;

  // บัญชีที่ใช้อยู่ — โหมด embedded ได้มาจากเซิร์ฟเวอร์ โหมด remote ได้จาก Google Sign-In
  const p = auth.profile || state.user || api.serverInfo.user;

  return h('div', { class: 'page' },

    h('button', {
      class: 'card', style: { display: 'flex', alignItems: 'center', gap: '11px', width: '100%', textAlign: 'left' },
      onclick: () => go('health')
    },
      h('span', { style: { fontSize: '22px' } }, '🩺'),
      h('div', { style: { flex: '1' } },
        h('div', { style: { fontWeight: '700' } }, 'ตรวจสอบระบบ'),
        h('div', { style: { fontSize: '12.5px', color: 'var(--ink-2)' } },
          'ดูว่าตอนนี้พร้อมใช้แค่ไหน และเหลืออะไรต้องทำ')),
      h('span', { class: 'list-chevron' }, '›')),

    // ── หน้าของนักเรียน ──
    h('div', { class: 'section-title' }, 'หน้าให้นักเรียนดูผล'),
    h('div', { class: 'card' },
      h('div', { style: { fontSize: '13px', color: 'var(--ink-2)', marginBottom: '10px', lineHeight: '1.6' } },
        'นักเรียนกรอกเลขประจำตัวแล้วเห็นงาน คะแนน และการมาเรียนของตัวเอง',
        h('br'), 'ดูได้อย่างเดียว แก้อะไรไม่ได้ และเห็นเฉพาะข้อมูลของตัวเอง'),
      h('div', { class: 'btn-row' },
        h('button', { class: 'btn btn-soft btn-sm', onclick: showStudentLink }, '🎒 ลิงก์สำหรับนักเรียน'),
        h('button', { class: 'btn btn-ghost btn-sm', onclick: showStudentHowTo }, '❓ ต้อง Deploy เพิ่มยังไง')),
      h('div', { class: 'hint' },
        'ปิดหน้านี้ได้ที่ช่อง student_portal ในหัวข้อ "ทั่วไป" ด้านล่าง (on = เปิด · off = ปิด)')),

    // ── หน้าตา ──
    h('div', { class: 'section-title' }, 'หน้าตา'),
    h('div', { class: 'card' },
      h('div', { class: 'seg' },
        THEMES.map(t => h('button', {
          'data-on': getTheme() === t.id ? '1' : '0',
          onclick: () => { setTheme(t.id); emit(); }
        }, icon(t.ic, 'ico ico-sm'), t.label))),
      h('div', { class: 'hint' }, '“ตามเครื่อง” จะสลับเป็นโหมดมืดเองตามการตั้งค่าของโทรศัพท์')),

    // ── บัญชีผู้ใช้ ──
    h('div', { class: 'section-title' }, 'บัญชีและอุปกรณ์'),
    h('div', { class: 'card' },
      p
        ? h('div', { style: { display: 'flex', alignItems: 'center', gap: '11px', marginBottom: '12px' } },
            p.picture
              ? h('img', { src: p.picture, alt: '', style: { width: '40px', height: '40px', borderRadius: '50%' } })
              : h('div', { class: 'class-avatar' }, (p.name || '?')[0]),
            h('div', { style: { flex: '1', minWidth: '0' } },
              h('div', { style: { fontWeight: '700', overflow: 'hidden', textOverflow: 'ellipsis' } }, p.name),
              h('div', { style: { fontSize: '12.5px', color: 'var(--ink-2)', wordBreak: 'break-all' } }, p.email)),
            h('span', { class: 'badge g' }, 'เข้าสู่ระบบแล้ว'))
        : h('div', { style: { fontSize: '13px', color: 'var(--ink-2)', marginBottom: '10px' } },
            api.conn.method === 'key'
              ? 'ตอนนี้เชื่อมด้วยรหัสลับ — เปลี่ยนไปใช้บัญชี Google จะย้ายเครื่องได้ง่ายกว่า'
              : 'ยังไม่ได้เข้าสู่ระบบ'),

      api.MODE === 'embedded' && h('div', {
        style: { fontSize: '12.5px', color: 'var(--ink-2)', marginBottom: '10px', lineHeight: '1.6' }
      },
        'Google เป็นคนตรวจสอบให้ก่อนเปิดหน้านี้ ไม่ต้องใช้รหัสผ่านของแอป',
        h('br'),
        'อยากสลับบัญชี → ออกจากบัญชี Google ในเบราว์เซอร์ แล้วเปิดลิงก์แอปใหม่'),

      h('div', { class: 'btn-row' },
        h('button', { class: 'btn btn-soft btn-sm', onclick: showTransfer },
          api.MODE === 'embedded' ? '🔗 ลิงก์เปิดแอป' : '📱 ย้ายไปเครื่องอื่น'),
        state.installPrompt && h('button', {
          class: 'btn btn-sm',
          onclick: async () => {
            const e = state.installPrompt;
            state.installPrompt = null;
            e.prompt(); await e.userChoice;
          }
        }, '⬇️ ติดตั้งเป็นแอป'),
        p && api.MODE === 'remote' && h('button', {
          class: 'btn btn-ghost btn-sm',
          onclick: async () => {
            if (!await confirmBox('ออกจากระบบ?', 'ข้อมูลที่ยังไม่ได้ซิงค์จะยังอยู่ในเครื่อง', 'ออกจากระบบ')) return;
            await sync();
            auth.signOut(); location.reload();
          }
        }, 'ออกจากระบบ'))
    ),

    groups,
    saveBtn,

    h('div', { class: 'section-title' }, 'การเชื่อมต่อ'),
    h('div', { class: 'card' },
      api.MODE === 'remote' && h('div', { style: { fontSize: '13px', color: 'var(--ink-2)', wordBreak: 'break-all', marginBottom: '10px' } },
        h('b', null, 'Web App: '), api.conn.url || '—'),
      h('div', { style: { fontSize: '13px', marginBottom: '12px' } },
        navigator.onLine ? h('span', { class: 'badge g' }, 'ออนไลน์') : h('span', { class: 'badge a' }, 'ออฟไลน์'),
        ' ',
        pending > 0 ? h('span', { class: 'badge a' }, `มีข้อมูลค้างส่ง ${pending} รายการ`)
                    : h('span', { class: 'badge g' }, 'ข้อมูลตรงกันแล้ว')),
      h('div', { class: 'btn-row' },
        h('button', { class: 'btn btn-soft btn-sm', onclick: () => sync({ loud: true }) }, '⟳ ซิงค์เดี๋ยวนี้'),
        h('button', { class: 'btn btn-ghost btn-sm', onclick: async () => { await bootstrap(); toast('โหลดใหม่แล้ว', 'ok'); } }, '↓ โหลดข้อมูลใหม่'),
        h('button', {
          class: 'btn btn-ghost btn-sm',
          onclick: async () => {
            if (pending > 0 && !await confirmBox('ยังมีข้อมูลค้างส่ง',
              `มี ${pending} รายการที่ยังไม่ได้บันทึกลง Google Sheet ถ้าล้างแคชตอนนี้ข้อมูลจะหาย`, 'ล้างทิ้ง')) return;
            api.cache.clearAll(); api.queue.clear();
            toast('ล้างแคชแล้ว'); location.reload();
          }
        }, '🧹 ล้างแคช'),
        api.MODE === 'remote' && h('button', {
          class: 'btn btn-danger btn-sm',
          onclick: async () => {
            if (!await confirmBox('ตัดการเชื่อมต่อ?', 'ต้องกรอก URL และรหัสลับใหม่อีกครั้ง', 'ตัดการเชื่อมต่อ')) return;
            api.conn.clear(); api.cache.clearAll(); location.reload();
          }
        }, 'ตัดการเชื่อมต่อ')
      )),

    h('div', { style: { textAlign: 'center', color: 'var(--ink-3)', fontSize: '12px', padding: '20px 0 6px' } },
      'AssignCheck V2 · ข้อมูลทั้งหมดอยู่ใน Google Sheet ของคุณเอง')
  );
}

/** ลิงก์หน้าดูผลของนักเรียน — ต้องมาจาก Deployment ที่ตั้งเป็น "Anyone" */
function showStudentLink() {
  const base = state.webAppUrl || api.conn.url || '';
  if (!base) return toast('ยังอ่านลิงก์ไม่ได้ — กด ⟳ ซิงค์ก่อนแล้วลองใหม่', 'err');
  const link = base + (base.includes('?') ? '&' : '?') + 'page=student';

  modal((close) => h('div', null,
    h('h2', null, '🎒 ลิงก์สำหรับนักเรียน'),
    h('div', { class: 'hint', style: { marginBottom: '10px' } },
      'แปะไว้ในกลุ่มไลน์ห้อง หรือทำเป็น QR ติดหน้าห้องก็ได้'),
    h('textarea', {
      rows: 4, value: link, readonly: true,
      style: { fontFamily: 'ui-monospace, monospace', fontSize: '11.5px' },
      onclick: (e) => e.target.select()
    }),
    h('div', { style: { height: '10px' } }),
    h('button', {
      class: 'btn btn-block',
      onclick: async () => {
        try { await navigator.clipboard.writeText(link); toast('คัดลอกลิงก์แล้ว', 'ok'); close(); }
        catch { toast('กดค้างที่ข้อความเพื่อคัดลอก'); }
      }
    }, 'คัดลอกลิงก์'),
    h('div', {
      class: 'hint',
      style: { marginTop: '10px', background: 'var(--amber-soft)', color: 'var(--warn-ink)', padding: '10px 12px', borderRadius: '10px' }
    },
      '⚠️ ลิงก์นี้จะใช้ได้ก็ต่อเมื่อสร้าง Deployment ตัวที่ 2 แบบ "Anyone" แล้วเท่านั้น',
      h('br'), 'ถ้าใช้ลิงก์ของครู นักเรียนจะโดน Google ขอให้ล็อกอินแล้วเข้าไม่ได้ — กดปุ่ม "ต้อง Deploy เพิ่มยังไง" ดูขั้นตอน')
  ));
}

function showStudentHowTo() {
  const step = (n, title, body) => h('div', { style: { display: 'flex', gap: '11px', marginBottom: '14px' } },
    h('div', {
      style: {
        width: '26px', height: '26px', borderRadius: '50%', flex: 'none',
        background: 'var(--accent)', color: 'var(--on-accent)',
        display: 'grid', placeContent: 'center', fontSize: '13px', fontWeight: '700'
      }
    }, String(n)),
    h('div', { style: { flex: '1' } },
      h('div', { style: { fontWeight: '600', fontSize: '14px' } }, title),
      h('div', { style: { fontSize: '12.5px', color: 'var(--ink-2)', lineHeight: '1.6' } }, body)));

  modal((close) => h('div', null,
    h('h2', null, 'สร้างลิงก์ให้นักเรียน'),
    h('div', { class: 'hint', style: { marginBottom: '14px' } },
      'ทำครั้งเดียวจบ — ลิงก์ของครูกับของนักเรียนต้องแยกกัน เพราะสิทธิ์เข้าถึงต่างกัน'),
    step(1, 'เปิด Apps Script', 'ในชีต → ส่วนขยาย → Apps Script'),
    step(2, 'Deploy → New deployment', 'เลือกชนิด Web app (อย่ากดแก้ตัวเดิม — ต้องสร้าง "ตัวใหม่")'),
    step(3, 'ตั้งค่า 2 ช่อง', 'Execute as: Me · Who has access: Anyone (ไม่ใช่ "Anyone with a Google account")'),
    step(4, 'คัดลอก URL ที่ได้', 'จะเป็นคนละลิงก์กับของครู — เก็บไว้ใช้กับนักเรียน'),
    step(5, 'ต่อท้ายด้วย ?page=student', 'เช่น https://script.google.com/.../exec?page=student'),
    h('div', {
      style: { background: 'var(--accent-soft)', color: 'var(--accent-ink)', padding: '11px 13px', borderRadius: '10px', fontSize: '12.5px', lineHeight: '1.6' }
    },
      'ลิงก์ของครูยังใช้เหมือนเดิมทุกอย่าง คนที่ไม่ใช่ครูเปิดลิงก์นักเรียนได้แค่หน้าดูผล ',
      'กรอกเลขประจำตัวถูกถึงจะเห็น และเห็นทีละคนเท่านั้น'),
    h('div', { style: { height: '12px' } }),
    h('button', { class: 'btn btn-block', onclick: close }, 'เข้าใจแล้ว')
  ));
}

/** ลิงก์สำหรับเปิดแอปบนเครื่องอื่น */
function showTransfer() {
  const embedded = api.MODE === 'embedded';
  const link = embedded ? (state.webAppUrl || '') : api.conn.transferLink();

  if (embedded && !link) {
    return toast('ยังอ่านลิงก์ไม่ได้ — กด ⟳ ซิงค์ก่อนแล้วลองใหม่', 'err');
  }

  modal((close) => h('div', null,
    h('h2', null, embedded ? '🔗 ลิงก์เปิดแอป' : '📱 ย้ายไปใช้บนเครื่องอื่น'),
    h('div', { class: 'hint', style: { marginBottom: '10px' } },
      embedded
        ? 'เปิดลิงก์นี้บนมือถือหรือเครื่องอื่นได้เลย — Google จะให้ล็อกอินก่อน แล้วเข้าใช้ได้ทันที'
        : 'ส่งลิงก์นี้ไปเปิดบนเครื่องใหม่ (ไลน์หาตัวเอง / อีเมล) แล้วระบบจะตั้งค่าให้อัตโนมัติ'),
    h('textarea', {
      rows: 4, value: link, readonly: true,
      style: { fontFamily: 'ui-monospace, monospace', fontSize: '11.5px' },
      onclick: (e) => e.target.select()
    }),
    h('div', { style: { height: '10px' } }),
    h('button', {
      class: 'btn btn-block',
      onclick: async () => {
        try { await navigator.clipboard.writeText(link); toast('คัดลอกลิงก์แล้ว', 'ok'); close(); }
        catch { toast('กดค้างที่ข้อความเพื่อคัดลอก'); }
      }
    }, 'คัดลอกลิงก์'),
    h('div', { class: 'hint', style: { marginTop: '10px' } },
      embedded
        ? '💡 บนมือถือ เปิดลิงก์แล้วกด "เพิ่มลงในหน้าจอหลัก" จะเปิดได้เหมือนแอป'
        : '⚠️ ลิงก์นี้มีสิทธิ์เข้าถึงข้อมูลทั้งหมด อย่าส่งให้คนอื่นหรือโพสต์สาธารณะ')
  ));
}
