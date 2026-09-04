/* หน้าเชื่อมต่อครั้งแรก — 2 ขั้น: ใส่ URL แล้วเข้าสู่ระบบด้วย Google */

import { h, toast } from '../dom.js';
import * as api from '../api.js';
import { auth, renderSignInButton } from '../auth.js';

const ui = { step: 1, info: null, busy: false };

export function viewSetup() {
  if (api.conn.url && !ui.info) ui.step = 2;
  return h('div', { class: 'shell' },
    h('header', { class: 'appbar' }, h('div', { class: 'appbar-title' }, 'AssignCheck · เชื่อมต่อ')),
    h('div', { class: 'page', style: { maxWidth: '520px' } },
      ui.step === 1 ? stepUrl() : stepSignIn(),
      helpCard()
    )
  );
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

  return h('div', { class: 'card' },
    h('h2', { style: { margin: '0 0 4px', fontSize: '17px' } }, 'เชื่อมกับ Google Sheet ของคุณ'),
    h('p', { style: { color: 'var(--ink-2)', fontSize: '13.5px', marginTop: 0 } },
      'ข้อมูลทั้งหมดเก็บในชีตของคุณเอง แอปนี้เป็นแค่หน้าจอสำหรับกรอก'),
    h('div', { class: 'field' }, h('label', null, 'URL ของ Web App'), urlIn),
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

  return h('div', { class: 'card' },
    h('h2', { style: { margin: '0 0 4px', fontSize: '17px' } }, 'เข้าสู่ระบบ'),
    h('p', { style: { color: 'var(--ink-2)', fontSize: '13px', marginTop: 0, wordBreak: 'break-all' } },
      api.conn.url),

    auth.clientId
      ? h('div', null,
          h('p', { style: { fontSize: '13.5px' } },
            'ใช้บัญชี Google เดียวกับที่เป็นเจ้าของไฟล์ชีต — เปลี่ยนเครื่องเมื่อไหร่ก็เข้าได้ทันที'),
          gBox)
      : h('div', { style: { background: 'var(--amber-soft)', padding: '11px', borderRadius: '10px', fontSize: '13px' } },
          h('b', null, 'ยังไม่ได้เปิดใช้การเข้าสู่ระบบด้วย Google'), h('br'),
          'ใส่ ', h('code', null, 'oauth_client_id'), ' ในแท็บ ⚙️ ตั้งค่า ของชีต แล้ว Deploy ใหม่ (ดูวิธีด้านล่าง)'),

    h('div', { class: 'sep' }, 'หรือ'),
    h('div', { class: 'field' }, h('label', null, 'รหัสลับ (วิธีสำรอง)'), keyIn),
    keyBtn,
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
