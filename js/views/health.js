/* หน้า "ตรวจสอบระบบ" — บอกว่าตอนนี้พร้อมใช้แค่ไหน และเหลืออะไรต้องทำ
 *
 * ทุกข้อที่ไม่ผ่านต้องบอก 3 อย่างเสมอ: เกิดอะไรขึ้น · กระทบอะไร · แก้ยังไง
 */

import { h, toast, modal } from '../dom.js';
import { state, emit, go, settings, sync } from '../state.js';
import * as api from '../api.js';
import { auth } from '../auth.js';
import { APP_VERSION, NEEDS_SERVER, cmpVersion, FEATURES } from '../version.js';
import { badCuts } from '../score.js';

/** ข้อความสรุปหัวหน้า — ใช้ทั้งแถบเข้ม (มือถือ) และแถบบริบท (PC) */
function summary(items) {
  const bad = items.filter(i => i.level === 'err').length;
  const warn = items.filter(i => i.level === 'warn').length;
  if (bad) return { tone: 'bad', title: `ต้องแก้ ${bad} เรื่อง`, sub: 'ทำตามรายการด้านล่างจากบนลงล่าง' };
  if (warn) return { tone: 'warn', title: `ใช้ได้ · ควรตั้งอีก ${warn} เรื่อง`, sub: 'ไม่เร่ง แต่ตั้งไว้แล้วคะแนนจะแม่นขึ้น' };
  return { tone: 'ok', title: 'พร้อมใช้งานครบทุกอย่าง', sub: 'ระบบตรวจตัวเองทุกครั้งที่เปิดหน้านี้' };
}

/** แถบหัวสีเข้ม (มือถือ) */
viewHealth.head = function () {
  const s = summary(runChecks());
  return h('header', { class: 'pagehead' },
    h('div', { class: 'ph-row' },
      h('button', { class: 'ph-back', 'aria-label': 'กลับ', onclick: () => go('settings') }, '‹'),
      h('div', { class: 'ph-grow' },
        h('div', { class: 'ph-title' }, 'ตรวจสอบระบบ'),
        h('div', { class: 'ph-sub' }, s.title)))
  );
};

const GROUPS = [
  { level: 'err',  label: 'ต้องแก้ก่อน' },
  { level: 'warn', label: 'ควรตั้งค่าเพิ่ม' },
  { level: 'ok',   label: 'ผ่านแล้ว' }
];

export function viewHealth() {
  const items = runChecks();
  const s = summary(items);

  return h('div', { class: 'page', style: { maxWidth: '720px' } },

    h('div', { class: 'ctxbar' },
      h('div', { style: { flex: '1', minWidth: '0' } },
        h('div', { class: 'ctx-title' }, 'ตรวจสอบระบบ'),
        h('div', { class: 'ctx-sub' }, s.sub)),
      h('span', { class: 'badge ' + { bad: 'r', warn: 'a', ok: 'g' }[s.tone] }, s.title)),

    // มือถือ: แถบเข้มบอกหัวข้อแล้ว เหลือแค่คำอธิบายสั้น ๆ
    h('div', { class: 'hint pc-hide', style: { margin: '0 2px 12px' } }, s.sub),

    GROUPS.map(g => {
      const list = items.filter(i => i.level === g.level);
      if (!list.length) return null;
      return h('div', { style: { marginBottom: '14px' } },
        h('div', { class: 'section-title' }, `${g.label} · ${list.length}`),
        h('div', { class: 'card card-tight' }, list.map(checkRow)));
    }),

    h('div', { style: { textAlign: 'center', color: 'var(--ink-3)', fontSize: '11.5px', padding: '6px 0 14px' } },
      `หน้าเว็บ v${APP_VERSION} · โค้ดในชีต v${api.serverInfo.version || 'ไม่ทราบ'}`)
  );
}

function checkRow(c) {
  return h('div', { class: 'check-row', 'data-level': c.level },
    h('span', { class: 'check-dot' }),
    h('div', { style: { flex: '1', minWidth: '0' } },
      h('div', { class: 'check-title' }, c.title),
      h('div', { class: 'check-sub' }, c.detail),
      c.fix && h('div', { class: 'check-fix' }, c.fix),
      // ปุ่มในหน้านี้ไม่ใช้สีไลม์ — ไลม์สงวนไว้ให้ปุ่มหลักหนึ่งเดียวของแต่ละหน้า
      c.action && h('button', {
        class: 'btn btn-soft btn-sm', style: { marginTop: '9px' },
        onclick: c.action.run
      }, c.action.label))
  );
}

// ── รายการตรวจ ──────────────────────────────────────────────

function runChecks() {
  const out = [];
  const S = settings();
  const sv = api.serverInfo.version;

  const embedded = api.MODE === 'embedded';

  // 1) การเชื่อมต่อ
  if (embedded) {
    out.push({
      level: 'ok', title: 'Apps Script เสิร์ฟหน้าเว็บเอง',
      detail: 'ไม่ต้องตั้ง URL ไม่ต้องมีรหัสลับ ไม่ต้องเปิดคอมค้าง'
    });
  } else if (!api.conn.url) {
    out.push({ level: 'err', title: 'ยังไม่ได้เชื่อมกับ Google Sheet', detail: 'แอปยังไม่รู้ว่าจะเก็บข้อมูลที่ไหน',
      fix: 'ตั้งค่า → ตัดการเชื่อมต่อ แล้วใส่ URL ใหม่' });
  } else if (!api.serverInfo.seen) {
    out.push({ level: 'warn', title: 'ยังไม่ได้คุยกับชีตในรอบนี้', detail: 'อาจออฟไลน์อยู่ หรือ URL เปลี่ยน',
      fix: 'กดปุ่มด้านล่างเพื่อทดสอบ',
      action: { label: 'ทดสอบการเชื่อมต่อ', run: testConn } });
  } else {
    out.push({ level: 'ok', title: 'เชื่อมกับ Google Sheet ได้', detail: shortUrl(api.conn.url) });
  }

  // 2) เวอร์ชันโค้ดในชีต — สาเหตุอันดับ 1 ของอาการ "กรอกแล้วคะแนนเพี้ยน"
  if (api.serverInfo.seen) {
    const cmp = cmpVersion(sv, NEEDS_SERVER);
    if (!sv) {
      out.push({
        level: 'err', title: 'โค้ดในชีตเป็นเวอร์ชันเก่า (ก่อน 2.2)',
        detail: 'ชีตยังไม่รายงานเวอร์ชันกลับมา แปลว่ายังไม่ได้วางโค้ดใหม่หรือยังไม่ได้ Deploy',
        fix: 'วางไฟล์ ALL-IN-ONE.gs ทับ → Deploy → Manage deployments → ✏️ → New version',
        action: { label: 'ดูวิธีทีละขั้น', run: showUpdateSteps }
      });
    } else if (cmp < 0) {
      const missing = FEATURES.filter(f => cmpVersion(sv, f.since) < 0);
      out.push({
        level: 'err', title: `โค้ดในชีตเก่ากว่าหน้าเว็บ (v${sv} < v${NEEDS_SERVER})`,
        detail: 'ฟีเจอร์ที่จะเพี้ยน: ' + (missing.map(f => f.name).join(' · ') || '—'),
        fix: 'Deploy โค้ดใหม่ก่อนใช้ฟีเจอร์เหล่านี้',
        action: { label: 'ดูวิธีทีละขั้น', run: showUpdateSteps }
      });
    } else if (cmp > 0) {
      out.push({ level: 'warn', title: `โค้ดในชีตใหม่กว่าหน้าเว็บ (v${sv})`, detail: 'หน้าเว็บอาจยังไม่รองรับของใหม่',
        fix: 'รีเฟรชหน้าเว็บ (Ctrl+Shift+R)' });
    } else {
      out.push({ level: 'ok', title: `โค้ดในชีตตรงกับหน้าเว็บ (v${sv})`, detail: 'ทุกฟีเจอร์ทำงานครบ' });
    }
  }

  // 3) วิธียืนยันตัวตน
  if (embedded) {
    const email = state.user?.email || api.serverInfo.user?.email;
    out.push({
      level: email ? 'ok' : 'warn',
      title: email ? `เข้าสู่ระบบเป็น ${email}` : 'ยังอ่านบัญชีผู้ใช้ไม่ได้',
      detail: email
        ? 'Google ตรวจให้ก่อนเข้าหน้าเว็บ ไม่ต้องใช้รหัสผ่านของแอป — เปลี่ยนเครื่องได้ทันที'
        : 'ปกติจะขึ้นหลังโหลดข้อมูลเสร็จ ถ้าไม่ขึ้นให้ตรวจว่า Deploy ตั้งเป็น "Anyone with a Google account"',
      action: email ? null : { label: 'ทดสอบการเชื่อมต่อ', run: testConn }
    });
  } else if (auth.signedIn) {
    out.push({ level: 'ok', title: 'เข้าสู่ระบบด้วยบัญชี Google', detail: auth.profile?.email || '',
      fix: null });
  } else if (api.conn.key) {
    out.push({
      level: 'warn', title: 'ยังใช้รหัสลับอยู่',
      detail: 'ใช้งานได้ปกติ แต่ย้ายเครื่องต้องพิมพ์รหัสใหม่ทุกครั้ง',
      fix: 'ถ้าจะใช้หลายเครื่อง แนะนำเปิดล็อกอิน Google (ตั้งค่า oauth_client_id ในชีต)',
      action: { label: '📱 คัดลอกลิงก์ย้ายเครื่อง', run: copyTransfer }
    });
  } else {
    out.push({ level: 'err', title: 'ยังไม่ได้ยืนยันตัวตน', detail: 'ยังบันทึกข้อมูลไม่ได้', fix: 'เชื่อมต่อใหม่ในหน้าตั้งค่า' });
  }

  // 4) ห้องเรียน
  if (!state.classes.length) {
    out.push({ level: 'err', title: 'ยังไม่มีห้องเรียน', detail: 'ต้องมีอย่างน้อย 1 ห้องถึงจะเช็คชื่อได้',
      fix: 'หน้าแรก → + เพิ่มห้อง',
      action: { label: 'ไปหน้าแรก', run: () => go('home') } });
  } else {
    const empty = state.classes.filter(c => !c.studentCount).length;
    out.push({
      level: empty ? 'warn' : 'ok',
      title: `มี ${state.classes.length} ห้อง-วิชา`,
      detail: empty ? `${empty} ห้องยังไม่มีรายชื่อนักเรียน` : 'มีรายชื่อนักเรียนครบทุกห้อง',
      fix: empty ? 'หน้าแรก → ⋯ → จัดการรายชื่อนักเรียน' : null
    });
  }

  // 5) วันสอบกลางภาค
  const mid = String(state.config.mid_date || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(mid)) {
    out.push({
      level: 'warn', title: 'ยังไม่ได้ตั้งวันสอบกลางภาค',
      detail: 'ตอนนี้ระบบเดาว่าทุกวันอยู่ "ก่อนกลางภาค" — พอเลยกลางภาคไปแล้วคะแนนจะลงผิดช่อง',
      fix: 'ตั้งครั้งเดียวจบ ใช้ได้ทั้งเทอม',
      action: { label: '⚙️ ไปตั้งค่า', run: () => go('settings') }
    });
  } else {
    out.push({ level: 'ok', title: 'ตั้งวันสอบกลางภาคแล้ว', detail: mid + ' — ระบบแยกช่วงให้อัตโนมัติ' });
  }

  // 6) น้ำหนักคะแนนรวม 100
  const sum = ['work1', 'quiz1', 'att1', 'mid', 'work2', 'quiz2', 'att2', 'fin']
    .reduce((a, k) => a + (S.weight[k] || 0), 0);
  out.push(sum === 100
    ? { level: 'ok', title: 'น้ำหนักคะแนนรวม 100 พอดี', detail: '10+10+5+20 · 10+10+5+30' }
    : { level: 'err', title: `น้ำหนักคะแนนรวม ${sum} ไม่เท่ากับ 100`, detail: 'คะแนนที่กรอกลง SGS จะไม่ตรง',
        fix: 'ตั้งค่า → น้ำหนักคะแนน', action: { label: '⚙️ ไปแก้', run: () => go('settings') } });

  // 7) เกณฑ์เกรดเขียนถูกรูปแบบไหม
  const cutErr = badCuts(state.config.grade_cuts);
  if (cutErr.length) {
    out.push({
      level: 'err',
      title: `เกณฑ์เกรดเขียนผิดรูปแบบ ${cutErr.length} ช่วง`,
      detail: `ช่วงที่อ่านไม่ออก: ${cutErr.join(' · ')} — ระบบข้ามช่วงนี้ไป เกรดที่ออกมาจะไม่ตรงกับที่ตั้งใจ`,
      fix: 'เขียนเป็น คะแนน:เกรด คั่นด้วยจุลภาค เช่น 80:4,75:3.5,70:3 (ระวังพิมพ์ตัว O แทนเลข 0)',
      action: { label: '⚙️ ไปแก้', run: () => go('settings') }
    });
  }

  // 8) เก็บข้อมูลลงเครื่องได้ไหม — ถ้าไม่ได้คือเรื่องใหญ่ที่สุดในหน้านี้
  if (!api.storagePersistent()) {
    out.push({
      level: 'err',
      title: 'เบราว์เซอร์ไม่ยอมให้เก็บข้อมูลลงเครื่อง',
      detail: 'ตอนนี้เก็บไว้ในหน่วยความจำแทน — ใช้งานได้ปกติและส่งขึ้นชีตได้ '
            + 'แต่ถ้าปิดแท็บหรือโหลดหน้าใหม่ตอนยังไม่มีเน็ต ของที่ยังไม่ได้ส่งจะหาย',
      fix: 'เปิดแอปจากลิงก์ GitHub Pages โดยตรง (ไม่ผ่าน iframe) หรือเปิดคุกกี้ของบุคคลที่สามให้ google.com · '
         + 'ระหว่างนี้ให้กดซิงค์ก่อนปิดหน้าทุกครั้ง',
      action: api.queue.size ? { label: '⟳ ส่งขึ้นชีตเดี๋ยวนี้', run: () => sync({ loud: true }) } : null
    });
  }

  // 9) งานที่ส่งไม่ผ่านซ้ำ ๆ — ยังอยู่ในคิว แต่ครูควรรู้ว่าไม่ได้ไปถึงชีต
  const stuck = api.queue.stuck();
  if (stuck.length) {
    out.push({
      level: 'err',
      title: `มี ${stuck.length} รายการส่งไม่ผ่านหลายรอบแล้ว`,
      detail: 'ยังเก็บไว้ให้ครบ ไม่ได้หายไปไหน และระบบยังลองส่งใหม่ให้เรื่อย ๆ',
      fix: 'มักเป็นเพราะโค้ดในชีตเป็นเวอร์ชันเก่า หรือห้อง/คอลัมน์ถูกลบไปแล้ว — ตรวจ 2 อย่างนี้ก่อน',
      action: { label: '⟳ ลองส่งอีกครั้ง', run: () => sync({ loud: true }) }
    });
  }

  // 10) ข้อมูลค้างส่ง
  const q = api.queue.size;
  if (q > 0) {
    out.push({
      level: navigator.onLine ? 'warn' : 'ok',
      title: `มีข้อมูลรอส่งขึ้นชีต ${q} รายการ`,
      detail: navigator.onLine ? 'ปกติจะส่งเองภายในไม่กี่วินาที' : 'ออฟไลน์อยู่ — เก็บไว้ในเครื่องแล้ว ปลอดภัย',
      fix: navigator.onLine ? 'ถ้าค้างนาน ให้กดซิงค์เอง' : 'พอมีเน็ตจะส่งให้อัตโนมัติ',
      action: navigator.onLine ? { label: '⟳ ซิงค์เดี๋ยวนี้', run: () => sync({ loud: true }) } : null
    });
  } else {
    out.push({ level: 'ok', title: 'ข้อมูลตรงกับชีตแล้ว', detail: 'ไม่มีอะไรค้างส่ง' });
  }

  // 11) พร้อมใช้ออฟไลน์ / ติดตั้งเป็นแอป
  const standalone = window.matchMedia?.('(display-mode: standalone)').matches;
  if (embedded) {
    out.push({
      level: 'warn', title: 'เปิดแอปตอนไม่มีเน็ตไม่ได้',
      detail: 'ข้อแลกของการให้ Apps Script เสิร์ฟเอง — แต่ถ้าเปิดแอปค้างไว้แล้วสัญญาณหลุด ยังเช็คชื่อต่อได้ ข้อมูลจะส่งเองเมื่อสัญญาณกลับมา',
      fix: 'เปิดแอปตอนเริ่มคาบ แล้วอย่าปิดหน้าจนกว่าจะเช็คเสร็จ'
    });
  } else if (standalone) {
    out.push({ level: 'ok', title: 'ติดตั้งเป็นแอปแล้ว', detail: 'เปิดจากหน้าจอโฮมได้ ใช้ออฟไลน์ได้' });
  } else if (state.installPrompt) {
    out.push({
      level: 'warn', title: 'ยังไม่ได้ติดตั้งเป็นแอป',
      detail: 'ติดตั้งแล้วจะเปิดเร็วขึ้นและใช้ตอนไม่มีเน็ตได้',
      action: { label: '⬇️ ติดตั้งเลย', run: async () => {
        const e = state.installPrompt; state.installPrompt = null;
        e.prompt(); await e.userChoice; emit();
      } }
    });
  } else {
    out.push({
      level: 'ok', title: 'เก็บไฟล์แอปไว้ในเครื่องแล้ว',
      detail: navigator.serviceWorker?.controller ? 'เปิดใช้ได้แม้ไม่มีเน็ต' : 'กำลังเตรียม — รีเฟรชอีกครั้งจะพร้อม'
    });
  }

  // 12) เปิดจากที่ไหน
  if (embedded) {
    out.push({
      level: 'ok', title: 'เปิดได้จากทุกเครื่องด้วยลิงก์เดียว',
      detail: 'มือถือเปิดลิงก์เดิมแล้วกด "เพิ่มลงในหน้าจอหลัก" ได้เลย',
      action: { label: '🔗 ดูลิงก์เปิดแอป', run: () => go('settings') }
    });
  } else if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
    out.push({
      level: 'warn', title: 'ตอนนี้เปิดจากคอมเครื่องนี้เท่านั้น',
      detail: 'มือถือในห้องเรียนจะเปิดไม่ได้ และต้องเปิด เปิดแอป.bat ค้างไว้',
      fix: 'อัปโหลดขึ้น GitHub Pages เพื่อให้ได้ลิงก์ถาวรที่เปิดจากมือถือได้'
    });
  } else {
    out.push({ level: 'ok', title: 'เปิดจากอินเทอร์เน็ตได้', detail: location.origin });
  }

  return out;
}

// ── ตัวช่วย ─────────────────────────────────────────────────

const shortUrl = (u) => u.replace(/^https:\/\/script\.google\.com\/macros\/s\//, '…/').slice(0, 46) + '…';

async function testConn() {
  try {
    await api.call('ping');
    toast('เชื่อมต่อได้ปกติ ✅', 'ok');
  } catch (e) {
    toast(e.message, 'err', 6000);
  }
  emit();
}

async function copyTransfer() {
  try {
    await navigator.clipboard.writeText(api.conn.transferLink());
    toast('คัดลอกลิงก์แล้ว — เปิดลิงก์นี้บนเครื่องใหม่', 'ok', 4000);
  } catch { toast('คัดลอกไม่ได้ ลองที่ ตั้งค่า → ย้ายไปเครื่องอื่น', 'err'); }
}

function showUpdateSteps() {
  modal((close) => h('div', null,
    h('h2', null, '🔄 อัปเดตโค้ดในชีต'),
    h('ol', { style: { paddingLeft: '20px', fontSize: '14px', lineHeight: '2' } },
      h('li', null, 'เปิดชีต → ', h('b', null, 'ส่วนขยาย → Apps Script')),
      h('li', null, 'คลิกในช่องโค้ด กด ', h('b', null, 'Ctrl+A'), ' แล้ววางไฟล์ ',
        h('code', null, 'ALL-IN-ONE.gs'), ' ทับ'),
      h('li', null, 'กด ', h('b', null, 'Ctrl+S'), ' บันทึก'),
      h('li', null, h('b', null, 'Deploy → Manage deployments')),
      h('li', null, 'กดรูปดินสอ ✏️ → ช่อง ', h('b', null, 'Version'), ' เลือก ',
        h('b', null, 'New version'), ' → ', h('b', null, 'Deploy'))
    ),
    h('div', {
      style: { background: 'var(--amber-soft)', padding: '11px', borderRadius: '10px', fontSize: '13px', margin: '4px 0 14px' }
    }, h('b', null, 'ข้อ 5 สำคัญที่สุด'), ' — ถ้าแค่กด Ctrl+S แล้วไม่ Deploy โค้ดใหม่จะยังไม่ถูกใช้งาน'),
    h('button', { class: 'btn btn-block', onclick: async () => { close(); await testConn(); } }, 'ทำเสร็จแล้ว — ตรวจอีกครั้ง')
  ));
}
