/* หน้าตั้งค่า — จัดเป็น 5 กลุ่มตามดีไซน์หน้า 06
 *   PC     เมนูซ้ายค้างไว้ เนื้อหาขวาเปลี่ยนตามกลุ่มที่เลือก
 *   มือถือ  หน้าแรกเป็นสรุป + รายการ 5 กลุ่ม กดแล้วเข้าไปในกลุ่มนั้น
 *
 * ทุกช่องบันทึกอัตโนมัติเมื่อแก้เสร็จ (เหตุการณ์ change ไม่ใช่ทุกตัวอักษร)
 * ครูจะได้ไม่ต้องจำว่ากดบันทึกหรือยัง — ดีไซน์ยึดข้อนี้เป็นหลัก
 */

import { h, toast, confirmBox, modal, printPage, copyText } from '../dom.js';
import { qrcode } from '../vendor/qrcode.js';
import { state, saveConfig, sync, bootAll, go, emit } from '../state.js';
import * as api from '../api.js';
import { auth, renderSignInButton } from '../auth.js';
import { icon, withIcon } from '../icons.js';
import { THEMES, getTheme, setTheme } from '../theme.js';
import { readTimetable, openTimetableEditor } from './timetable.js';
import { weeklyCount } from '../timetable.js';
import { isWide } from './common.js';
import { openNewTerm } from './newterm.js';

const SECTIONS = [
  { id: 'score', label: 'การคิดคะแนน' },
  { id: 'att',   label: 'การเช็คชื่อ' },
  { id: 'acct',  label: 'บัญชีและการเชื่อมต่อ' },
  { id: 'data',  label: 'ข้อมูลและการสำรอง' },
  { id: 'about', label: 'เกี่ยวกับระบบ' }
];

/** ช่อง 8 ช่องของ SGS พร้อมสีในแถบสัดส่วน */
const WEIGHTS = [
  { k: 'w_work1', label: '1 · ส่งงาน (ก่อน)',   c: 'var(--accent)' },
  { k: 'w_quiz1', label: '2 · สอบเก็บ (ก่อน)',  c: 'var(--accent-2)' },
  { k: 'w_att1',  label: '3 · เข้าเรียน (ก่อน)', c: 'var(--hero)' },
  { k: 'w_mid',   label: 'กลางภาค',             c: 'var(--ink)' },
  { k: 'w_work2', label: '10 · ส่งงาน (หลัง)',  c: 'var(--accent)' },
  { k: 'w_quiz2', label: '11 · สอบเก็บ (หลัง)', c: 'var(--accent-2)' },
  { k: 'w_att2',  label: '12 · เข้าเรียน (หลัง)', c: 'var(--hero)' },
  { k: 'w_fin',   label: 'ปลายภาค',             c: 'var(--ink)' }
];

const ui = { sec: null, savedAt: '' };   // sec = null → มือถือแสดงหน้าสรุป

const cfg = (k, d = '') => (state.config[k] ?? d);
const num = (k) => Number(state.config[k]) || 0;
const weightSum = () => WEIGHTS.reduce((a, w) => a + num(w.k), 0);
const midSet = () => /^\d{4}-\d{2}-\d{2}$/.test(String(cfg('mid_date')).trim());

/** พาไปช่องวันสอบกลางภาค — ขึ้นภาคเรียนใหม่แล้วช่องนี้ถูกล้าง เป็นสิ่งแรกที่ครูต้องตั้ง */
function setMidDate() {
  ui.sec = 'score';
  emit();
  requestAnimationFrame(() => {
    const el = document.querySelector('[data-k="mid_date"]');
    if (!el) return;
    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    el.focus({ preventScroll: true });
  });
}

/** บันทึกทีละช่อง ทันทีที่แก้เสร็จ */
async function put(k, v, opts) {
  try {
    await saveConfig({ [k]: v }, opts);
    ui.savedAt = new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
    const el = document.querySelector('[data-savedat]');
    if (el) el.textContent = 'ล่าสุด ' + ui.savedAt + ' น.';
    // หน้านี้บันทึกอัตโนมัติ ไม่มีปุ่มบันทึก — ป้ายเล็ก ๆ ในแถบหัวคนมองไม่เห็น
    // จึงต้องมีข้อความยืนยันให้ชัด ไม่งั้นครูจะไม่รู้ว่าที่แก้ไปมีผลแล้ว
    toast('บันทึกแล้ว', 'ok', 1400);
  } catch (e) {
    toast(e.message, 'err', 5000);
  }
}

/**
 * อัปเดตป้ายผลรวมกับแถบสีน้ำหนักคะแนน โดยไม่วาดหน้าใหม่
 */
function refreshWeightCard(el) {
  const card = el.closest('.card');
  if (!card) return;
  const sum = weightSum();
  const badge = card.querySelector('[data-wsum]');
  if (badge) {
    badge.textContent = sum === 100 ? 'รวม 100 ✓' : `รวม ${sum} ✕`;
    badge.className = sum === 100 ? 'set-ok' : 'set-bad';
  }
  const bar = card.querySelector('[data-wbar]');
  if (bar) {
    bar.replaceChildren(...WEIGHTS.filter(w => num(w.k) > 0).map(w =>
      h('i', { style: { width: (num(w.k) / Math.max(sum, 1) * 100) + '%', background: w.c },
               title: `${w.label} ${num(w.k)}` })));
  }
}

/**
 * อัปเดตแถว "วันสอบกลางภาค" ตรง ๆ โดยไม่วาดหน้าใหม่
 * เพื่อไม่ให้ input ที่ปฏิทินของเครื่องเกาะอยู่ถูกทำลาย
 */
function refreshMidDateRow(el) {
  const ok = midSet();
  el.style.borderColor = ok ? '' : 'var(--st-miss)';
  el.style.color = ok ? '' : 'var(--st-miss)';
  const row = el.closest('.set-row');
  const desc = row && row.querySelector('[data-desc]');
  if (desc) {
    desc.textContent = ok
      ? 'ใช้แยกว่าคาบที่เช็คอยู่ช่วงก่อนหรือหลังกลางภาค'
      : 'ยังไม่ได้ตั้ง — ระบบยังแยกช่วงก่อน/หลังกลางภาคไม่ได้';
    desc.classList.toggle('bad', !ok);
  }
}

// ── ชิ้นส่วนที่ใช้ซ้ำ ────────────────────────────────────────

/** แถวตั้งค่า 1 บรรทัด: ชื่อ + คำอธิบาย ทางซ้าย · ตัวควบคุมทางขวา */
const row = (name, desc, ctl, bad) => {
  const box = h('div', { class: 'set-ctl' }, ctl);
  // ช่องกรอกในแถวตั้งค่าไม่มี <label> — ใช้ชื่อแถวเป็นชื่อช่อง (เฉพาะแถวที่มีช่องเดียว)
  const fields = box.querySelectorAll('input,select,textarea');
  if (fields.length === 1 && typeof name === 'string' && !fields[0].getAttribute('aria-label')) {
    fields[0].setAttribute('aria-label', name);
  }
  return h('div', { class: 'set-row' },
    h('div', null,
      h('div', { class: 'set-name' }, name),
      desc && h('div', { class: 'set-desc' + (bad ? ' bad' : ''), 'data-desc': '1' }, desc)),
    box);
};

const numInput = (k, { step, suffix, width } = {}) => [
  h('input', {
    type: 'number', step: step || '1', value: String(cfg(k)),
    style: width ? { width } : null,
    onchange: (e) => put(k, e.target.value)
  }),
  suffix && h('span', { style: { fontSize: 'var(--fs-md)', color: 'var(--ink-2)' } }, suffix)
];

const selectInput = (k, options) => h('select', {
  value: String(cfg(k)),
  onchange: (e) => put(k, e.target.value)
}, options.map(([v, l]) => h('option', { value: v, selected: String(cfg(k)) === v }, l)));

/** ตัวเลือก 2 ทางแบบปุ่มคู่ (ดีไซน์ใช้แทน select ในกติกาหลัก) */
// d = ค่าที่ชีตใช้เมื่อยังไม่มีแถวนั้น (ชีตที่ติดตั้งก่อนมีคีย์นี้) — ไม่งั้นไม่มีปุ่มไหนติดเลย
const segInput = (k, options, d = '') => h('div', { class: 'seg seg-inline' },
  options.map(([v, l]) => h('button', {
    'data-on': String(cfg(k, d)).toLowerCase() === v ? '1' : '0',
    onclick: () => { put(k, v); state.config[k] = v; emit(); }
  }, l)));

// ── กลุ่มที่ 1: การคิดคะแนน ─────────────────────────────────

function secScore() {
  const sum = weightSum();
  return [
    h('div', { class: 'card' },
      h('div', { style: { display: 'flex', alignItems: 'baseline', gap: '10px', marginBottom: '4px' } },
        h('div', { style: { fontSize: 'var(--fs-lg)', fontWeight: '700', flex: '1' } }, 'น้ำหนักคะแนน 8 ช่อง'),
        h('div', { class: sum === 100 ? 'set-ok' : 'set-bad', 'data-wsum': '1' },
          sum === 100 ? 'รวม 100 ✓' : `รวม ${sum} ✕`)),
      h('div', { style: { fontSize: 'var(--fs-sm)', color: 'var(--ink-2)' } },
        'ต้องรวมได้ 100 พอดี ระบบเตือนทันทีถ้าเกินหรือขาด'),
      h('div', { class: 'weightbar', 'data-wbar': '1' },
        WEIGHTS.map(w => num(w.k) > 0 &&
          h('i', { style: { width: (num(w.k) / Math.max(sum, 1) * 100) + '%', background: w.c }, title: `${w.label} ${num(w.k)}` }))),
      h('div', { class: 'wgrid' },
        WEIGHTS.map(w => h('div', { class: 'wcell' },
          h('label', null, w.label),
          h('input', {
            type: 'number', min: '0', value: String(num(w.k)),
            // เหตุผลเดียวกับช่องวันสอบกลางภาค — วาดหน้าใหม่แล้วช่องที่เพิ่งแก้
            // ถูกสร้างใหม่ ตำแหน่ง scroll กระโดด และบนมือถือแป้นพิมพ์ปิดเอง
            // จึงบันทึกเงียบ ๆ แล้วอัปเดตเฉพาะป้ายผลรวมกับแถบสีในการ์ดนี้
            onchange: async (e) => {
              state.config[w.k] = e.target.value;
              await put(w.k, e.target.value, { quiet: true });
              refreshWeightCard(e.target);
              emit();
            }
          }))))
    ),

    h('div', { class: 'card' },
      h('div', { style: { fontSize: 'var(--fs-lg)', fontWeight: '700', marginBottom: '4px' } }, 'กติกาการคิดคะแนน'),
      row('ช่องที่ยังไม่ตรวจ', 'ข้อสอบที่ยังไม่กรอกคะแนน และงานที่ยังไม่ได้ตรวจของใครเลย (งานที่เริ่มตรวจแล้ว ช่องว่าง = ไม่ส่ง นับ 0 เสมอ)',
        segInput('ungraded_mode', [['ignore', 'ไม่นับ'], ['zero', 'นับเป็น 0']])),
      row('หักคะแนนงานส่งช้า', 'หักจากคะแนนเต็มของงานชิ้นนั้น ตอนกดปุ่ม "ช้า"',
        numInput('late_penalty_pct', { step: '5', suffix: '%' })),
      row('การปัดเศษ', 'ใช้กับคะแนนทุกช่องก่อนแสดงและก่อนเขียนลงชีต',
        [selectInput('round_digits', [['0', 'จำนวนเต็ม'], ['1', 'ทศนิยม 1 ตำแหน่ง'], ['2', 'ทศนิยม 2 ตำแหน่ง']]),
         selectInput('round_mode', [['half', 'ปัดครึ่งขึ้น'], ['up', 'ปัดขึ้นเสมอ'], ['down', 'ปัดลงเสมอ']])]
          .map((el, i) => { el.setAttribute('aria-label', i ? 'วิธีปัดเศษ' : 'ปัดเศษกี่ตำแหน่ง'); return el; })),
      row('เกณฑ์เกรด', 'รูปแบบ คะแนน:เกรด คั่นด้วยจุลภาค',
        h('input', {
          value: String(cfg('grade_cuts')), style: { minWidth: '260px' },
          onchange: (e) => put('grade_cuts', e.target.value)
        })),
      row('วันสอบกลางภาค',
        midSet() ? 'ใช้แยกว่าคาบที่เช็คอยู่ช่วงก่อนหรือหลังกลางภาค'
                 : 'ยังไม่ได้ตั้ง — ระบบยังแยกช่วงก่อน/หลังกลางภาคไม่ได้',
        h('input', {
          type: 'date', value: String(cfg('mid_date')), 'data-k': 'mid_date', 'aria-label': 'วันสอบกลางภาค',
          style: midSet() ? null : { borderColor: 'var(--st-miss)', color: 'var(--st-miss)' },
          // ⚠️ ห้ามวาดหน้าใหม่จากช่องนี้เด็ดขาด
          //
          // render() ล้าง DOM ทิ้งทั้งหน้าแล้วสร้างใหม่ input ตัวที่ปฏิทินของ
          // เครื่องเกาะอยู่จึงหายไป ปฏิทินเลยปิดตัวเอง = กดตั้งวันแล้วเด้งออก
          //
          // เคยแก้ด้วยการเช็คโฟกัสก่อนวาดใหม่ แต่ยังไม่พอ —
          // Android ส่วนใหญ่ย้ายโฟกัสออกจาก input ตั้งแต่ตอนเปิดปฏิทิน
          // พอ change ยิง โฟกัสจึงไม่ได้อยู่ที่ช่องแล้ว โค้ดเลยวาดใหม่ทันที
          // ทั้งที่ปฏิทินยังกางอยู่ อาการเด้งออกจึงยังเหมือนเดิม
          //
          // จึงบันทึกเงียบ ๆ แล้วแก้เฉพาะข้อความกับกรอบในแถวนี้เอง
          // ส่วนแถบเตือนด้านบนจะอัปเดตตอนออกจากหน้านี้ (กดย้อนกลับก็วาดใหม่อยู่แล้ว)
          onchange: async (e) => {
            const el = e.target;
            state.config.mid_date = el.value;
            await put('mid_date', el.value, { quiet: true });
            refreshMidDateRow(el);
            // ให้แถบเตือนด้านบนอัปเดตด้วย — emit() จะถูกพักไว้เองถ้าปฏิทิน
            // ยังกางอยู่ แล้วค่อยวาดตอนปิด จึงไม่ไปปิดปฏิทินกลางคัน
            emit();
          }
        }),
        !midSet())
    ),

    h('div', { class: 'card' },
      h('div', { style: { fontSize: 'var(--fs-lg)', fontWeight: '700', marginBottom: '4px' } }, 'ข้อมูลรายวิชา'),
      row('ปีการศึกษา', null, h('input', { value: String(cfg('year')), onchange: (e) => put('year', e.target.value) })),
      row('ภาคเรียนที่', null, h('input', { value: String(cfg('term')), onchange: (e) => put('term', e.target.value) })),
      row('ชื่อครูผู้สอน', null, h('input', { value: String(cfg('teacher')), style: { minWidth: '200px' }, onchange: (e) => put('teacher', e.target.value) })),
      // แก้ปี/ภาคเรียนข้างบนเปลี่ยนแค่ป้าย — ปุ่มนี้จัดห้องให้ด้วย (สำรอง · ล้างคะแนน · ลบห้อง)
      row('ขึ้นภาคเรียนใหม่', 'สำรองข้อมูลเทอมนี้ไว้ แล้วล้างคะแนนหรือลบห้องเดิมในทีเดียว',
        h('button', { class: 'btn btn-soft btn-sm', onclick: () => openNewTerm({ setMidDate }) }, 'เริ่มภาคเรียนใหม่…'))
    )
  ];
}

// ── กลุ่มที่ 2: การเช็คชื่อ ─────────────────────────────────

function secAtt() {
  const ratio = String(cfg('att_mode', 'ratio')) !== 'deduct';
  const w = num('w_att1') || 5;
  return [
    h('div', { class: 'card' },
      h('div', { style: { fontSize: 'var(--fs-lg)', fontWeight: '700', marginBottom: '4px' } }, 'การเช็คชื่อ'),
      row('วิธีคิดคะแนนเข้าเรียน',
        h('span', null,
          h('b', null, 'ตามสัดส่วน'), ` ${w} × (มา ${cfg('att_w_มา', 1)} · สาย ${cfg('att_w_สาย', 0.5)} · ลา ${cfg('att_w_ลา', 1)} · ขาด 0) ÷ คาบที่เช็ค`,
          h('br'),
          h('b', null, 'หักรายครั้ง'), ` ${w} − (สาย×${cfg('att_d_สาย', 0.25)} + ขาด×${cfg('att_d_ขาด', 0.5)})`),
        segInput('att_mode', [['ratio', 'ตามสัดส่วน'], ['deduct', 'หักรายครั้ง']])),
      row('เกณฑ์เวลาเรียนขั้นต่ำ (มส)', 'ต่ำกว่านี้ระบบติดธง "มส" ให้อัตโนมัติ',
        numInput('att_min_pct', { suffix: '%' })),
      row('นับ "ลา" เป็นเวลาเรียน', 'ผลต่อการคิด % เวลาเรียน ไม่ใช่คะแนน',
        segInput('att_count_ลา', [['TRUE', 'นับ'], ['FALSE', 'ไม่นับ']])),
      ttRow()
    ),

    h('div', { class: 'card' },
      h('div', { style: { fontSize: 'var(--fs-lg)', fontWeight: '700', marginBottom: '4px' } },
        ratio ? 'น้ำหนักของโหมดสัดส่วน' : 'คะแนนที่หักของโหมดหักรายครั้ง'),
      ratio
        ? [row('น้ำหนักเมื่อ "สาย"', 'มา = 1 เสมอ', numInput('att_w_สาย', { step: '0.1' })),
           row('น้ำหนักเมื่อ "ลา"', 'ลาป่วย/ลากิจที่ครูอนุญาต', numInput('att_w_ลา', { step: '0.1' }))]
        : [row('หักต่อการสาย 1 คาบ', null, numInput('att_d_สาย', { step: '0.05' })),
           row('หักต่อการขาด 1 คาบ', null, numInput('att_d_ขาด', { step: '0.05' }))]
    )
  ];
}

/** ตารางสอน — หน้าแรกใช้บอกว่าตอนนี้สอนห้องไหน (ดู js/views/timetable.js) */
function ttRow() {
  const n = weeklyCount(readTimetable());
  return row('ตารางสอน',
    n ? `ตั้งไว้ ${n} คาบ/สัปดาห์ · หน้าแรกบอกว่าตอนนี้สอนห้องไหน` : 'ตั้งครั้งเดียว หน้าแรกจะบอกว่าตอนนี้ต้องสอนห้องไหน',
    h('button', { class: 'btn btn-soft btn-sm', onclick: openTimetableEditor }, n ? 'แก้ตารางสอน' : 'ตั้งตารางสอน'));
}

// ── กลุ่มที่ 3: บัญชีและการเชื่อมต่อ ────────────────────────

function secAcct() {
  const p = auth.profile || state.user || api.serverInfo.user;
  const pending = api.queue.size;

  return [
    h('div', { class: 'card' },
      h('div', { style: { fontSize: 'var(--fs-lg)', fontWeight: '700', marginBottom: '12px' } }, 'บัญชีที่ใช้อยู่'),
      p
        ? h('div', { style: { display: 'flex', alignItems: 'center', gap: '11px', marginBottom: '12px' } },
            p.picture
              ? h('img', { src: p.picture, alt: '', style: { width: '40px', height: '40px', borderRadius: '50%' } })
              : h('div', { class: 'class-avatar' }, (p.name || '?')[0]),
            h('div', { style: { flex: '1', minWidth: '0' } },
              h('div', { style: { fontWeight: '700', overflow: 'hidden', textOverflow: 'ellipsis' } }, p.name),
              h('div', { style: { fontSize: 'var(--fs-sm)', color: 'var(--ink-2)', wordBreak: 'break-all' } }, p.email)),
            h('span', { class: 'badge g' }, 'เชื่อมแล้ว'))
        : h('div', { style: { fontSize: 'var(--fs-sm)', color: 'var(--ink-2)', marginBottom: '10px' } },
            api.conn.method === 'key'
              ? 'ตอนนี้เชื่อมด้วยรหัสลับ — เปลี่ยนไปใช้บัญชี Google จะย้ายเครื่องได้ง่ายกว่า'
              : 'ยังไม่ได้เข้าสู่ระบบ'),

      h('div', { class: 'btn-row' },
        h('button', { class: 'btn btn-soft btn-sm', onclick: showTransfer }, withIcon('phone', 'ย้ายไปเครื่องอื่น')),
        !auth.signedIn && h('button', {
          class: 'btn btn-soft btn-sm',
          onclick: (e) => switchToGoogle(e.currentTarget)
        }, withIcon('login', 'เข้าสู่ระบบด้วย Google')),
        state.installPrompt && h('button', {
          class: 'btn btn-soft btn-sm',
          onclick: async () => {
            const e = state.installPrompt;
            state.installPrompt = null;
            e.prompt(); await e.userChoice;
          }
        }, withIcon('install', 'ติดตั้งเป็นแอป')),
        p && h('button', {
          class: 'btn btn-ghost btn-sm',
          onclick: async () => {
            if (!await confirmBox('ออกจากระบบ?', 'ข้อมูลที่ยังไม่ได้ซิงค์จะยังอยู่ในเครื่อง', 'ออกจากระบบ')) return;
            await sync();
            auth.signOut(); location.reload();
          }
        }, 'ออกจากระบบ'))
    ),

    h('div', { class: 'card' },
      h('div', { style: { fontSize: 'var(--fs-lg)', fontWeight: '700', marginBottom: '12px' } }, 'การเชื่อมต่อกับชีต'),
      h('div',
        { style: { fontSize: 'var(--fs-sm)', color: 'var(--ink-2)', wordBreak: 'break-all', marginBottom: '10px' } },
        h('b', null, 'Web App: '), api.conn.url || '—'),
      h('div', { style: { fontSize: 'var(--fs-sm)', marginBottom: '12px' } },
        navigator.onLine ? h('span', { class: 'badge g' }, 'ออนไลน์') : h('span', { class: 'badge a' }, 'ออฟไลน์'),
        ' ',
        pending > 0 ? h('span', { class: 'badge a' }, `มีข้อมูลค้างส่ง ${pending} รายการ`)
                    : h('span', { class: 'badge g' }, 'ข้อมูลตรงกันแล้ว')),
      h('div', { class: 'btn-row' },
        h('button', { class: 'btn btn-soft btn-sm', onclick: () => sync({ loud: true }) }, '⟳ ซิงค์เดี๋ยวนี้'),
        h('button', {
          class: 'btn btn-danger btn-sm',
          onclick: async () => {
            if (!await confirmBox('ตัดการเชื่อมต่อ?', 'ต้องยืนยันตัวตนใหม่อีกครั้ง และแคชในเครื่องนี้จะถูกล้าง', 'ตัดการเชื่อมต่อ')) return;
            api.conn.clear(); api.cache.clearAll(); location.reload();
          }
        }, 'ตัดการเชื่อมต่อ'))
    ),

    h('div', { class: 'card' },
      h('div', { style: { fontSize: 'var(--fs-lg)', fontWeight: '700', marginBottom: '6px' } }, 'หน้าให้นักเรียนดูผล'),
      h('div', { style: { fontSize: 'var(--fs-sm)', color: 'var(--ink-2)', marginBottom: '10px', lineHeight: '1.6' } },
        'นักเรียนกรอกเลขประจำตัวแล้วเห็นงาน คะแนน และการมาเรียนของตัวเอง', h('br'),
        'ดูได้อย่างเดียว แก้อะไรไม่ได้ และเห็นเฉพาะข้อมูลของตัวเอง'),
      row('เปิดหน้าให้นักเรียนดู', 'ปิดแล้วลิงก์ของนักเรียนจะใช้ไม่ได้ทันที',
        segInput('student_portal', [['on', 'เปิด'], ['off', 'ปิด']], 'on')),
      // ประกาศคะแนนสอบตามจังหวะของครู — ปิดไว้ ชีตไม่ส่งคะแนนส่วนนั้นออกมาเลย (05_Student.gs)
      row('คะแนนสอบกลางภาค', 'ปิดไว้ นักเรียนเห็นช่องสอบกลางภาคแบบล็อก และคะแนนสะสมไม่รวมส่วนนี้',
        segInput('student_mid', [['on', 'เปิด'], ['off', 'ปิด']], 'on')),
      row('คะแนนสอบปลายภาค', 'เปิดเมื่อพร้อมประกาศ · ใช้กับทุกวิชาทุกห้อง',
        segInput('student_fin', [['on', 'เปิด'], ['off', 'ปิด']], 'on')),
      // แยกจากสวิตช์ข้างบน: ให้ดูคะแนนรายชิ้นได้ทั้งเทอม แต่ประกาศเกรดเมื่อพร้อม
      row('ให้ดูสรุปผลภาคเรียน', 'คะแนนรวม /100 และเกรดทุกวิชา · ถ้ายังปิดคะแนนสอบส่วนใดอยู่ เกรดจะขึ้นว่า “รอ” · ปิดไว้นักเรียนยังดูงานและคะแนนรายชิ้นได้ตามปกติ',
        segInput('student_summary', [['on', 'เปิด'], ['off', 'ปิด']], 'off')),
      h('div', { class: 'btn-row', style: { marginTop: '12px' } },
        h('button', { class: 'btn btn-soft btn-sm', onclick: showStudentLink }, withIcon('qr', 'ลิงก์ / QR สำหรับนักเรียน')))
    )
  ];
}

// ── กลุ่มที่ 4: ข้อมูลและการสำรอง ───────────────────────────

function secData() {
  const pending = api.queue.size;
  return [
    h('div', { class: 'card' },
      h('div', { style: { fontSize: 'var(--fs-lg)', fontWeight: '700', marginBottom: '6px' } }, 'ข้อมูลและการสำรอง'),
      h('div', { style: { fontSize: 'var(--fs-sm)', color: 'var(--ink-2)', marginBottom: '12px', lineHeight: '1.6' } },
        'ต้นฉบับของข้อมูลอยู่ใน Google Sheet ของคุณเสมอ — เครื่องนี้เก็บแค่สำเนาไว้ใช้ตอนไม่มีเน็ต'),
      row('ข้อมูลค้างส่ง',
        pending > 0 ? 'จะส่งให้เองเมื่อมีเน็ต หรือกดซิงค์เดี๋ยวนี้ก็ได้' : 'ส่งครบแล้ว ไม่มีอะไรค้าง',
        h('span', { class: pending > 0 ? 'badge a' : 'badge g' },
          pending > 0 ? `${pending} รายการ` : 'ครบแล้ว'), pending > 0),
      row('โหลดข้อมูลใหม่จากชีต', 'ใช้เมื่อไปแก้ในชีตโดยตรงแล้วอยากให้แอปเห็น',
        h('button', {
          class: 'btn btn-ghost btn-sm',
          onclick: async () => { await bootAll(); toast('โหลดใหม่แล้ว', 'ok'); }
        }, withIcon('refresh', 'โหลดใหม่'))),
      row('ล้างสำเนาในเครื่อง', 'ไม่กระทบข้อมูลในชีต แต่ต้องต่อเน็ตเพื่อโหลดใหม่',
        h('button', {
          class: 'btn btn-ghost btn-sm',
          onclick: async () => {
            if (pending > 0 && !await confirmBox('ยังมีข้อมูลค้างส่ง',
              `มี ${pending} รายการที่ยังไม่ได้บันทึกลง Google Sheet ถ้าล้างแคชตอนนี้ข้อมูลจะหาย`, 'ล้างทิ้ง')) return;
            api.cache.clearAll(); api.queue.clear();
            toast('ล้างแคชแล้ว'); location.reload();
          }
        }, withIcon('broom', 'ล้างแคช')))
    )
  ];
}

// ── กลุ่มที่ 5: เกี่ยวกับระบบ ───────────────────────────────

function secAbout() {
  return [
    h('div', { class: 'card' },
      h('div', { style: { fontSize: 'var(--fs-lg)', fontWeight: '700', marginBottom: '6px' } }, 'เกี่ยวกับระบบ'),
      row('ธีม', '"ตามเครื่อง" จะสลับเป็นโหมดมืดเองตามการตั้งค่าของโทรศัพท์',
        h('div', { class: 'seg seg-inline' },
          THEMES.map(t => h('button', {
            'data-on': getTheme() === t.id ? '1' : '0',
            onclick: () => { setTheme(t.id); emit(); }
          }, icon(t.ic, 'ico ico-sm'), t.label)))),
      row('เวอร์ชันโค้ดในชีต',
        api.serverInfo.seen ? 'อ่านจากคำตอบล่าสุดของเซิร์ฟเวอร์' : 'ยังไม่เคยได้รับคำตอบจากเซิร์ฟเวอร์',
        h('span', { class: 'badge n' }, api.serverInfo.version ? 'v' + api.serverInfo.version : '—')),
      row('ตรวจสอบระบบ', 'ดูว่าตอนนี้พร้อมใช้แค่ไหน และเหลืออะไรต้องทำ',
        h('button', { class: 'btn btn-soft btn-sm', onclick: () => go('health') }, withIcon('pulse', 'เปิดหน้าตรวจสอบ')))
    ),
    h('div', { style: { textAlign: 'center', color: 'var(--ink-3)', fontSize: 'var(--fs-xs)', padding: '16px 0 6px' } },
      'AssignCheck V2 · ข้อมูลทั้งหมดอยู่ใน Google Sheet ของคุณเอง')
  ];
}

const BUILD = { score: secScore, att: secAtt, acct: secAcct, data: secData, about: secAbout };

/** คำอธิบายสั้น ๆ ใต้ชื่อกลุ่มในรายการของมือถือ */
function summaryOf(id) {
  const pending = api.queue.size;
  switch (id) {
    case 'score': return { t: `งานค้างตรวจ · หักส่งช้า ${num('late_penalty_pct')}% · ปัดเศษ`, c: null };
    case 'att':   return { t: `${String(cfg('att_mode', 'ratio')) === 'deduct' ? 'หักรายครั้ง' : 'ตามสัดส่วน'} · เกณฑ์ มส ${num('att_min_pct')}%`, c: null };
    case 'acct': {
      const p = auth.profile || state.user || api.serverInfo.user;
      return p ? { t: 'เชื่อมแล้ว · ' + p.email, c: 'var(--st-ok)' } : { t: 'ยังไม่ได้เข้าสู่ระบบ', c: 'var(--st-late)' };
    }
    case 'data':  return pending > 0
      ? { t: `ค้างส่ง ${pending} รายการ`, c: 'var(--st-late)' }
      : { t: 'ข้อมูลตรงกันแล้ว', c: null };
    default:      return { t: `โค้ดในชีต ${api.serverInfo.version ? 'v' + api.serverInfo.version : '—'}`, c: null };
  }
}

// ── ตัวหน้า ─────────────────────────────────────────────────

/** แถบหัวสีเข้ม (มือถือ) — มีปุ่มย้อนกลับเมื่ออยู่ในกลุ่มใดกลุ่มหนึ่ง */
viewSettings.head = function () {
  const inSec = !!ui.sec;
  return h('header', { class: 'pagehead' },
    h('div', { class: 'ph-row' },
      h('button', {
        class: 'ph-back', 'aria-label': 'กลับ',
        onclick: () => { if (inSec) { ui.sec = null; emit(); } else go('home'); }
      }, icon('back')),
      h('div', { class: 'ph-grow' },
        h('div', { class: 'ph-title' }, inSec ? SECTIONS.find(s => s.id === ui.sec).label : 'ตั้งค่า'),
        h('div', { class: 'ph-sub', 'data-savedat': '1' },
          ui.savedAt ? 'ล่าสุด ' + ui.savedAt + ' น.' : 'บันทึกอัตโนมัติทุกครั้งที่แก้')))
  );
};

export function viewSettings() {
  const wide = isWide();
  const sec = ui.sec || (wide ? 'score' : null);

  // มือถือ + ยังไม่ได้เลือกกลุ่ม → หน้าสรุปตามดีไซน์ 06 มือถือ
  if (!wide && !sec) return mobileIndex();

  return h('div', { class: 'page' },
    h('div', { class: 'set-layout' },
      h('div', { class: 'set-nav' },
        SECTIONS.map(s => h('button', {
          'data-on': sec === s.id ? '1' : '0',
          onclick: () => { ui.sec = s.id; emit(); }
        }, s.label)),
        h('div', { class: 'set-note' },
          'แก้แล้วบันทึกอัตโนมัติ',
          h('br'),
          h('span', { 'data-savedat': '1', style: { color: 'var(--ink-2)' } },
            ui.savedAt ? 'ล่าสุด ' + ui.savedAt + ' น.' : 'ยังไม่ได้แก้อะไร'))),
      h('div', null, BUILD[sec]())
    )
  );
}

/** หน้าสรุปของมือถือ — การ์ดน้ำหนักคะแนน + เตือน + รายการ 5 กลุ่ม */
function mobileIndex() {
  const sum = weightSum();
  return h('div', { class: 'page' },

    h('div', { class: 'card' },
      h('div', { style: { display: 'flex', alignItems: 'baseline', gap: '8px' } },
        h('div', { style: { flex: '1', fontSize: 'var(--fs-md)', fontWeight: '700' } }, 'น้ำหนักคะแนน'),
        h('div', { class: sum === 100 ? 'set-ok' : 'set-bad' },
          sum === 100 ? 'รวม 100 ✓' : `รวม ${sum} ✕`)),
      h('div', { class: 'weightbar', style: { height: '10px', margin: '10px 0' } },
        WEIGHTS.map(w => num(w.k) > 0 &&
          h('i', { style: { width: (num(w.k) / Math.max(sum, 1) * 100) + '%', background: w.c } }))),
      h('button', {
        class: 'todo-row', style: { padding: '0' },
        onclick: () => { ui.sec = 'score'; emit(); }
      },
        h('span', { style: { fontSize: 'var(--fs-sm)', color: 'var(--ink-2)' } },
          `ส่งงาน ${num('w_work1') + num('w_work2')} · สอบเก็บ ${num('w_quiz1') + num('w_quiz2')} · เข้าเรียน ${num('w_att1') + num('w_att2')} · สอบ ${num('w_mid') + num('w_fin')}`),
        h('b', null, 'แก้ ›'))
    ),

    !midSet() && h('button', {
      class: 'card',
      style: { background: 'var(--miss-soft)', display: 'flex', alignItems: 'center', gap: '10px', width: '100%', textAlign: 'left' },
      onclick: () => { ui.sec = 'score'; emit(); }
    },
      h('div', { style: { flex: '1' } },
        h('div', { class: 'set-name' }, 'ยังไม่ได้ตั้งวันสอบกลางภาค'),
        h('div', { style: { fontSize: 'var(--fs-sm)', color: 'var(--st-miss)', marginTop: '2px' } }, 'คะแนนอาจลงผิดช่วง')),
      h('span', {
        style: { padding: '9px 14px', borderRadius: 'var(--r-1)', background: 'var(--st-miss)', color: 'var(--on-miss)', fontSize: 'var(--fs-sm)', fontWeight: '600' }
      }, 'ตั้งเลย')),

    h('div', { class: 'card card-tight' },
      SECTIONS.map(s => {
        const sm = summaryOf(s.id);
        return h('button', {
          class: 'list-row',
          onclick: () => { ui.sec = s.id; emit(); }
        },
          h('div', { class: 'list-main' },
            h('div', { class: 'list-title' }, s.label),
            h('div', { class: 'list-sub', style: sm.c ? { color: sm.c } : null }, sm.t)),
          h('span', { class: 'list-chevron' }, '›'));
      })),

    h('div', { class: 'card' }, ttRow()),

    h('div', { class: 'btn-row' },
      state.installPrompt && h('button', {
        class: 'btn btn-ghost btn-sm', style: { flex: '1' },
        onclick: async () => {
          const e = state.installPrompt;
          state.installPrompt = null;
          e.prompt(); await e.userChoice;
        }
      }, withIcon('install', 'ติดตั้งเป็นแอป')),
      h('button', { class: 'btn btn-ghost btn-sm', style: { flex: '1' }, onclick: showTransfer }, withIcon('phone', 'ย้ายไปเครื่องอื่น')))
  );
}

/**
 * ลิงก์หน้าดูผลของนักเรียน — อยู่ในโฟลเดอร์ docs/ ข้างหน้าครูบน GitHub Pages
 *
 * เดิมต่อ ?page=student ท้ายลิงก์ Apps Script ซึ่งหน้านั้นถูกย้ายมา GitHub นานแล้ว
 * นักเรียนที่เปิดลิงก์เดิมเจอแค่ "ไม่พบหน้าของนักเรียน" (QR/โปสเตอร์ก็ชี้ไปที่เดียวกัน)
 * สร้างจากที่อยู่ของหน้าครูที่เปิดอยู่ จึงถูกเสมอไม่ว่า repo จะชื่ออะไร
 */
const studentPageUrl = () => {
  let dir = location.pathname;
  // "/Tester-2" (ไม่มี / ปิดท้าย และไม่ใช่ชื่อไฟล์) = โฟลเดอร์ ต้องเติม / ไม่งั้น docs/ ไปต่อผิดชั้น
  if (!dir.endsWith('/') && !/\.[a-z0-9]+$/i.test(dir)) dir += '/';
  return new URL('docs/', location.origin + dir).href;
};

function showStudentLink() {
  const link = studentPageUrl();

  modal((close) => h('div', null,
    h('h2', null, 'ลิงก์สำหรับนักเรียน'),
    h('div', { class: 'hint', style: { marginBottom: '10px' } },
      'แปะไว้ในกลุ่มไลน์ห้อง หรือพิมพ์ QR ติดหน้าห้องให้นักเรียนสแกน'),
    h('div', { class: 'qr-box', html: qrSvg(link) }),
    h('button', {
      class: 'btn btn-ghost btn-block', style: { marginBottom: '10px' },
      onclick: () => { close(); printQrPoster(link); }
    }, withIcon('printer', 'พิมพ์ QR ติดหน้าห้อง (A4)')),
    h('textarea', {
      rows: 4, value: link, readonly: true,
      style: { fontFamily: 'ui-monospace, monospace', fontSize: 'var(--fs-xs)' },
      onclick: (e) => e.target.select()
    }),
    h('div', { style: { height: '10px' } }),
    h('button', {
      class: 'btn btn-block',
      onclick: async () => {
        if (await copyText(link)) { toast('คัดลอกลิงก์แล้ว', 'ok'); close(); }
        else toast('กดค้างที่ข้อความเพื่อคัดลอก');
      }
    }, 'คัดลอกลิงก์'),
    h('div', { class: 'hint', style: { marginTop: '10px' } },
      'นักเรียนกรอกเลขประจำตัวแล้วเห็นเฉพาะข้อมูลของตัวเอง · ปิดหน้านี้ได้ที่สวิตช์ "เปิดหน้าให้นักเรียนดู" ด้านบน')
  ));
}

/**
 * QR ของลิงก์ เป็น SVG — สร้างในเครื่องด้วย js/vendor/qrcode.js
 * ไม่ส่งลิงก์ไปให้เว็บสร้าง QR ภายนอก (ไม่ต้องมีเน็ต และลิงก์ไม่รั่วไปที่อื่น)
 * ระดับแก้ผิด M: สแกนติดแม้กระดาษยับ/แสงสะท้อนนิดหน่อย โดย QR ไม่แน่นเกินไป
 */
function qrSvg(text) {
  const q = qrcode(0, 'M');
  q.addData(text);
  q.make();
  return q.createSvgTag({ cellSize: 4, margin: 8, scalable: true, title: 'QR ลิงก์หน้าดูผลของนักเรียน' });
}

/** โปสเตอร์ A4 ติดหน้าห้อง — QR ใหญ่ + วิธีใช้สั้น ๆ */
function printQrPoster(link) {
  const cfg = state.config || {};
  printPage(h('div', { class: 'qr-poster' },
    h('div', { class: 'qr-poster-title' }, 'ดูคะแนนของตัวเอง'),
    h('div', { class: 'qr-poster-sub' },
      [cfg.teacher ? 'ครู' + cfg.teacher : '', `ภาคเรียนที่ ${cfg.term || '—'}/${cfg.year || '—'}`].filter(Boolean).join(' · ')),
    h('div', { class: 'qr-poster-code', html: qrSvg(link) }),
    h('ol', { class: 'qr-poster-steps' },
      h('li', null, 'เปิดกล้องมือถือ แล้วสแกน QR นี้'),
      h('li', null, 'กรอกเลขประจำตัวนักเรียน'),
      h('li', null, 'ดูคะแนนเก็บ งานที่ยังไม่ส่ง และเวลาเรียนได้เลย')),
    h('div', { class: 'qr-poster-link' }, link)
  ), { title: 'QR ดูคะแนน' });
}

/**
 * สลับจาก "เชื่อมด้วยรหัสลับ" มาเป็นบัญชี Google โดยไม่ต้องตัดการเชื่อมต่อ
 *
 * ตัวเลือกนี้เคยมีแค่ในหน้าติดตั้งครั้งแรก ซึ่งอ่าน oauth_client_id จากชีต
 * ตอนกรอก URL ครั้งเดียวแล้วเก็บใส่เครื่องไว้ ครูที่เชื่อมด้วยรหัสลับไปก่อน
 * แล้วเพิ่งมาเปิด Google Sign-In ทีหลังจึงไม่มีทางสลับเลย นอกจากกด
 * "ตัดการเชื่อมต่อ" ทิ้งทั้งหมดแล้วตั้งใหม่ — ซึ่งล้างแคชทั้งเครื่องไปด้วย
 *
 * ที่นี่จึงไปถาม oauth_client_id จากชีตสด ๆ อีกครั้งก่อนเปิดหน้าล็อกอิน
 */
async function switchToGoogle(btn) {
  const label = btn.textContent;
  btn.disabled = true; btn.textContent = 'กำลังตรวจสอบ…';
  try {
    if (!auth.clientId) {
      const info = await api.conn.probe(api.conn.url);
      if (!info || !info.clientId) {
        throw new Error('ชีตยังไม่ได้ตั้ง oauth_client_id — ใส่ในแท็บ ⚙️ ตั้งค่า ของชีตก่อน');
      }
      auth.clientId = info.clientId;
    }
  } catch (e) {
    return toast(e.message, 'err', 7000);
  } finally {
    btn.disabled = false; btn.textContent = label;
  }

  modal((close) => {
    const box = h('div', { style: { display: 'flex', justifyContent: 'center', minHeight: '48px' } },
      h('div', { class: 'boot-spin' }));

    renderSignInButton(box, {
      onSignedIn: async (p) => {
        try {
          await api.call('ping');           // ให้ชีตยืนยันก่อนว่าบัญชีนี้มีสิทธิ์จริง
          close();
          toast(`เข้าสู่ระบบเป็น ${p.name} แล้ว`, 'ok');
          location.reload();
        } catch (e) {
          auth.signOut();                   // บัญชีไม่ผ่าน — อย่าค้าง token ที่ใช้ไม่ได้ไว้
          toast(e.message, 'err', 7000);
        }
      }
    }).catch(e => box.replaceChildren(h('div', { class: 'hint' }, e.message)));

    return h('div', null,
      h('h2', null, 'เข้าสู่ระบบด้วย Google'),
      h('div', { class: 'hint', style: { marginBottom: '12px' } },
        'ใช้บัญชีเดียวกับที่เป็นเจ้าของไฟล์ชีต (หรืออีเมลที่อยู่ใน ',
        h('code', null, 'allowed_emails'), ')', h('br'),
        'รหัสลับที่กรอกไว้ยังอยู่เหมือนเดิม ใช้เป็นตัวสำรองได้ต่อ'),
      box);
  });
}

/** ลิงก์สำหรับเปิดแอปบนเครื่องอื่น */
function showTransfer() {
  const link = api.conn.transferLink();

  modal((close) => h('div', null,
    h('h2', null, 'ย้ายไปใช้บนเครื่องอื่น'),
    h('div', { class: 'hint', style: { marginBottom: '10px' } },
      'ส่งลิงก์นี้ไปเปิดบนเครื่องใหม่ (ไลน์หาตัวเอง / อีเมล) แล้วระบบจะตั้งค่าให้อัตโนมัติ'),
    h('textarea', {
      rows: 4, value: link, readonly: true,
      style: { fontFamily: 'ui-monospace, monospace', fontSize: 'var(--fs-xs)' },
      onclick: (e) => e.target.select()
    }),
    h('div', { style: { height: '10px' } }),
    h('button', {
      class: 'btn btn-block',
      onclick: async () => {
        if (await copyText(link)) { toast('คัดลอกลิงก์แล้ว', 'ok'); close(); }
        else toast('กดค้างที่ข้อความเพื่อคัดลอก');
      }
    }, 'คัดลอกลิงก์'),
    h('div', { class: 'hint hint-warn', style: { marginTop: '10px' } },
      icon('alert', 'ico ico-sm'), 'ลิงก์นี้มีสิทธิ์เข้าถึงข้อมูลทั้งหมด อย่าส่งให้คนอื่นหรือโพสต์สาธารณะ')
  ));
}
