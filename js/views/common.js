/* ชิ้นส่วนที่หลายหน้าใช้ร่วมกัน — เดิมแต่ละหน้าเขียนของตัวเองซ้ำกัน */

import { h, toast, nf } from '../dom.js';
import { state, loadClass, undoLastEdit } from '../state.js';
import { ATT_CODES, BUCKETS } from '../score.js';

/** ปุ่ม "เลิกทำ" แปะท้าย toast — ใช้กับปุ่มที่แก้ทีเดียวหลายคน */
export const undoAction = () => ({
  label: 'เลิกทำ',
  onclick: () => { const n = undoLastEdit(); if (n) toast(`เลิกทำแล้ว · ${n} ช่อง`, 'ok'); }
});

/** จอกว้างแบบคอม (≥ 900px) — ตรงกับจุดตัดใน styles.css */
export const isWide = () => {
  try { return matchMedia('(min-width: 900px)').matches; } catch (e) { return false; }
};

/**
 * โครงหน้าระหว่างรอข้อมูลห้องเรียน — แทนตัวหนังสือ "กำลังโหลดห้องเรียน…" กลางจอว่าง
 * ครูเห็นว่ากำลังจะมีอะไรขึ้นตรงไหน รอ Apps Script 1–3 วินาทีแล้วไม่รู้สึกว่าแอปค้าง
 */
export const loadingPage = () => h('div', { class: 'page' },
  h('div', { class: 'skel', role: 'status', 'aria-busy': 'true', 'aria-label': 'กำลังโหลดห้องเรียน' },
    h('i'), h('i'), h('i'), h('i'), h('i')));

/** "ม.1/1" จากข้อมูลห้อง */
export const roomOf = (c) => [c.grade, c.room].filter(Boolean).join('/');

/**
 * ตัวเลือกห้องเรียน — ใช้ทั้งแถบหัว (คอม) · แถบขาว (มือถือ) · โหมดกรอกรายคน
 * @param onPick เรียกเมื่อเลือกห้องใหม่ (ปกติ = เปิดห้องนั้น)
 */
export function classSelect(onPick = (id) => loadClass(id)) {
  return h('select', {
    'aria-label': 'เลือกห้องเรียน',
    onchange: (e) => onPick(e.target.value)
  }, state.classes.map(c => h('option', { value: c.classId, selected: c.classId === state.classId },
    `${roomOf(c)} · ${c.subject}`)));
}

/** นับการมาเรียนของนักเรียน 1 คน รวมทุกคาบที่เช็คไว้ */
function attCount(sid) {
  const out = { 'ม': 0, 'ส': 0, 'ล': 0, 'ข': 0 };
  const V = state.cls.values || {};
  for (const c of state.cls.columns || []) {
    if (c.kind !== 'ATT') continue;
    const v = String((V[c.key] || {})[sid] ?? '').trim();
    if (ATT_CODES.includes(v)) out[v]++;
  }
  return out;
}

/**
 * ดาวน์โหลดคะแนนทั้งห้องเป็น CSV (เปิดใน Excel / Google Sheets ได้)
 *
 * เดิมมี 2 ปุ่มที่ให้ไฟล์คนละแบบ — หน้ารายงานกับหน้าสรุป SGS คอลัมน์ทับกันเกือบหมด
 * แต่ลำดับและชื่อไฟล์ต่างกัน ครูไม่รู้ว่าต้องใช้ไฟล์ไหน ตอนนี้ทั้งสองปุ่มได้ไฟล์เดียวกันครบทุกคอลัมน์
 * 8 ช่องคะแนนเรียงตามช่องของ SGS (กรอก SGS ไล่ซ้ายไปขวาได้เลย)
 *
 * @param rows ผลจาก computeClass()
 */
export function exportClassCSV(rows) {
  const cls = state.cls;
  const head = ['เลขที่', 'เลขประจำตัว', 'ชื่อ-นามสกุล',
    ...BUCKETS.map(b => `${b.label} (SGS ${b.sgs})`),
    'รวม', 'เกรด', 'มา', 'สาย', 'ลา', 'ขาด', '%เวลาเรียน', 'ค้างตรวจ', 'ส่งช้า', 'หมายเหตุ'];

  const lines = [head, ...rows.map(r => {
    const a = attCount(r.sid);
    return [
      r.no, r.sid, r.name,
      ...BUCKETS.map(b => (r['_has_' + b.id] ? nf(r[b.id]) : '')),
      r.dataN ? nf(r.total) : '', r.grade,
      a['ม'], a['ส'], a['ล'], a['ข'], r.attN ? r.pct + '%' : '',
      r.pending, r.late || 0, r.flag
    ];
  })];

  // BOM นำหน้า ไม่งั้น Excel อ่านภาษาไทยเป็นตัวอักษรเพี้ยน
  const csv = '﻿' + lines.map(l => l.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n');
  const a = h('a', {
    href: URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })),
    download: `คะแนน_${roomOf(cls.meta).replace('/', '-')}_${cls.meta.subject}.csv`
  });
  document.body.append(a); a.click(); a.remove();
  toast('ดาวน์โหลดแล้ว', 'ok');
}
