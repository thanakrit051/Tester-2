/* หน้าเชื่อมต่อครั้งแรก — 2 ขั้น: ใส่ URL แล้วเข้าสู่ระบบด้วย Google */

import { h, toast } from '../dom.js';
import * as api from '../api.js';
import { auth, renderSignInButton } from '../auth.js';

const ui = { step: 1, info: null, busy: false, method: 'google' };  // method = วิธียืนยันตัวตนที่เลือกอยู่

export function viewSetup() {
  if (api.conn.url && !ui.info) ui.step = 2;

  // ดีไซน์หน้า 07: พื้นเข้มเต็มจอ + แผ่นขาวลอยขึ้นมา เห็นความคืบหน้าตลอด
  return h('div', { class: 'setup-screen' },
    h('div', { class: 'setup-brand' },
      h('div', { class: 'mark' }, 'A'),
      h('h1', null, 'AssignCheck'),
      h('p', null, 'เช็คชื่อ · เช็คงาน · สรุปคะแนน SGS',
        h('br'), 'เชื่อมกับ Google Sheet ของคุณครั้งเดียว ใช้ได้ทุกเครื่อง')),
    h('div', { class: 'setup-sheet' },
      stepper(),
      ui.step === 1 ? stepUrl() : stepSignIn(),
      helpCard()
    )
  );
}

/** แถบ 3 ขั้น — ขั้นที่ผ่านแล้วเป็นเครื่องหมายถูกสีเขียว */
function stepper() {
  const STEPS = ['วางโค้ดในชีต', 'เชื่อมต่อ', 'สร้างห้องแรก'];
  const cur = ui.step === 1 ? 1 : 2;   // ขั้นที่กำลังทำอยู่ตอนนี้
  const out = [];
  STEPS.forEach((label, i) => {
    const n = i + 1;
    const done = n < cur, now = n === cur;
    if (i > 0) out.push(h('div', { class: 'step-line' + (n <= cur ? ' done' : '') }));
    out.push(h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
      h('div', { class: 'step-dot' + (done ? ' done' : (now ? ' now' : '')) }, done ? '✓' : String(n)),
      h('span', { class: 'step-name' + (done || now ? ' on' : '') }, label)));
  });
  return h('div', { class: 'stepper' }, out);
}

// ── ขั้นที่ 1: URL ──────────────────────────────────────────

function stepUrl() {
  const urlIn = h('input', {
    type: 'url', placeholder: 'https://script.google.com/macros/s/.../exec',
    value: api.conn.url
  });
  const btn = h('button', { class: 'btn btn-block' }, 'ถัดไป');

  btn.onclick = async () => {
    const url = urlIn.value.trim();
    if (!/^https:\/\/script\.google\.com\/macros\/s\/.+\/exec/.test(url)) {
      return toast('URL ต้องลงท้ายด้วย /exec', 'err');
    }
    btn.disabled = true; btn.textContent = 'กำลังตรวจสอบ…';
    try {
      const info = await api.conn.probe(url);
      api.conn.save(url);
      if (info.clientId) auth.clientId = info.clientId;
      ui.info = info; ui.step = 2;
      render();
    } catch (e) {
      btn.disabled = false; btn.textContent = 'ถัดไป';
      toast(e.message, 'err', 6000);
    }
  };

  urlIn.classList.add('setup-mono');

  return h('div', null,
    h('div', { class: 'setup-h' }, 'เชื่อมต่อกับ Web App ของคุณ'),
    h('div', { class: 'setup-p' },
      'คัดลอก Web app URL จาก Apps Script (Deploy → New deployment → Web app · Anyone)',
      h('br'), 'ข้อมูลทั้งหมดเก็บในชีตของคุณเอง แอปนี้เป็นแค่หน้าจอสำหรับกรอก'),
    h('div', { class: 'field', style: { marginTop: '14px' } },
      h('label', null, 'Web app URL'), urlIn,
      h('div', { class: 'hint' }, 'ต้องเป็นลิงก์ที่ลงท้ายด้วย /exec')),
    btn
  );
}

// ── ขั้นที่ 2: เข้าสู่ระบบ ──────────────────────────────────

function stepSignIn() {
  const info = ui.info;
  const gBox = h('div', { style: { display: 'flex', justifyContent: 'center', minHeight: '48px' } },
    h('div', { class: 'boot-spin' }));

  if (auth.clientId) {
    renderSignInButton(gBox, {
      onSignedIn: async (p) => {
        try {
          await api.call('ping');
          toast(`ยินดีต้อนรับ ${p.name}`, 'ok');
          location.reload();
        } catch (e) {
          auth.signOut();
          toast(e.message, 'err', 7000);
          render();
        }
      }
    }).catch(e => {
      gBox.replaceChildren(h('div', { class: 'hint' }, e.message));
    });
  }

  const keyIn = h('input', { type: 'text', placeholder: 'รหัสลับจากแท็บ 📖 วิธีใช้' });
  const keyBtn = h('button', { class: 'btn btn-ghost btn-block' }, 'เชื่อมด้วยรหัสลับแทน');
  keyBtn.onclick = async () => {
    const k = keyIn.value.trim();
    if (!k) return toast('กรอกรหัสลับ', 'err');
    keyBtn.disabled = true; keyBtn.textContent = 'กำลังตรวจสอบ…';
    api.conn.save(api.conn.url, k);
    try {
      await api.call('ping');
      toast('เชื่อมต่อสำเร็จ 🎉', 'ok');
      location.reload();
    } catch (e) {
      api.conn.save(api.conn.url, '');
      keyBtn.disabled = false; keyBtn.textContent = 'เชื่อมด้วยรหัสลับแทน';
      toast(e.message, 'err', 6000);
    }
  };

  keyIn.classList.add('setup-mono');

  return h('div', null,
    h('div', { class: 'setup-h' }, 'ยืนยันตัวตนแล้วเริ่มใช้งาน'),
    h('div', { class: 'setup-p', style: { wordBreak: 'break-all' } },
      'เชื่อมกับ ', h('span', { class: 'setup-mono' }, api.conn.url)),

    // เลือกวิธียืนยันตัวตน — ดีไซน์วางเป็นการ์ด 2 ใบเทียบกัน
    h('div', { class: 'field', style: { marginTop: '14px' } },
      h('label', null, 'วิธียืนยันตัวตน'),
      h('div', { class: 'pick2' },
        h('button', { 'data-on': ui.method === 'google' ? '1' : '0', onclick: () => { ui.method = 'google'; render(); } },
          h('b', null, 'บัญชี Google'),
          h('span', null, 'แนะนำ · ใช้ได้หลายเครื่อง ไม่ต้องจำรหัส')),
        h('button', { 'data-on': ui.method === 'key' ? '1' : '0', onclick: () => { ui.method = 'key'; render(); } },
          h('b', null, 'รหัสลับ'),
          h('span', null, 'เริ่มเร็วสุด เหมาะกับเครื่องเดียว')))),

    ui.method === 'google'
      ? (auth.clientId
          ? h('div', null,
              h('div', { class: 'setup-p', style: { marginBottom: '10px' } },
                'ใช้บัญชี Google เดียวกับที่เป็นเจ้าของไฟล์ชีต — เปลี่ยนเครื่องเมื่อไหร่ก็เข้าได้ทันที'),
              gBox)
          : h('div', { style: { background: 'var(--amber-soft)', padding: '11px 13px', borderRadius: '11px', fontSize: '13px', color: 'var(--warn-ink)', lineHeight: '1.6' } },
              h('b', null, 'ยังไม่ได้เปิดใช้การเข้าสู่ระบบด้วย Google'), h('br'),
              'ใส่ ', h('code', null, 'oauth_client_id'), ' ในแท็บ ⚙️ ตั้งค่า ของชีต แล้ว Deploy ใหม่ (ดูวิธีด้านล่าง)',
              h('br'), 'หรือเลือก "รหัสลับ" ด้านบนเพื่อเริ่มใช้ก่อน'))
      : h('div', null,
          h('div', { class: 'field' },
            h('label', null, 'รหัสลับ'), keyIn,
            h('div', { class: 'hint' }, 'อยู่ในแท็บ 📖 วิธีใช้ ของชีต')),
          keyBtn),

    h('button', {
      class: 'btn btn-ghost btn-block btn-sm', style: { marginTop: '8px' },
      onclick: () => { ui.step = 1; ui.info = null; render(); }
    }, '‹ เปลี่ยน URL')
  );
}

function helpCard() {
  return h('details', { class: 'card' },
    h('summary', { style: { fontWeight: '700', cursor: 'pointer' } }, '📋 ขั้นตอนติดตั้ง (ทำครั้งเดียว)'),
    h('ol', { style: { paddingLeft: '20px', fontSize: '13.5px', lineHeight: '1.85', color: 'var(--ink-2)' } },
      h('li', null, 'สร้าง Google Sheet ใหม่ → ', h('b', null, 'ส่วนขยาย → Apps Script')),
      h('li', null, 'วางไฟล์ ', h('code', null, 'ALL-IN-ONE.gs'), ' ทับโค้ดเดิม แล้วบันทึก'),
      h('li', null, 'กลับไปที่ชีต รีเฟรช → เมนู ', h('b', null, '📗 AssignCheck → 🚀 ติดตั้ง')),
      h('li', null, 'Apps Script → ', h('b', null, 'Deploy → New deployment → Web app'), h('br'),
        'Execute as: ', h('b', null, 'Me'), ' · Who has access: ', h('b', null, 'Anyone')),
      h('li', null, 'คัดลอก Web app URL มาใส่ด้านบน')
    ),
    h('div', { style: { fontWeight: '700', marginTop: '10px', fontSize: '13.5px' } }, '🔐 เปิดใช้เข้าสู่ระบบด้วย Google'),
    h('ol', { style: { paddingLeft: '20px', fontSize: '13.5px', lineHeight: '1.85', color: 'var(--ink-2)' } },
      h('li', null, 'ไปที่ ', h('code', null, 'console.cloud.google.com'), ' → สร้างโปรเจกต์'),
      h('li', null, h('b', null, 'APIs & Services → OAuth consent screen'), ' → External → ใส่ชื่อแอปกับอีเมล'),
      h('li', null, h('b', null, 'Credentials → Create credentials → OAuth client ID'), ' → Web application'),
      h('li', null, 'ใส่ ', h('b', null, 'Authorized JavaScript origins'), ' ให้ครบทุกที่ที่จะเปิดแอป เช่น',
        h('br'), h('code', null, 'http://localhost:5599'), h('br'),
        h('code', null, 'https://ชื่อคุณ.github.io')),
      h('li', null, 'คัดลอก ', h('b', null, 'Client ID'), ' ไปใส่ช่อง ', h('code', null, 'oauth_client_id'),
        ' ในแท็บ ⚙️ ตั้งค่า ของชีต')
    )
  );
}

function render() {
  const ev = new CustomEvent('ac:rerender');
  window.dispatchEvent(ev);
}
