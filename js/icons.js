/* ไอคอนเส้น (SVG ฝังในโค้ด — ไม่ต้องโหลดจากภายนอก ใช้ตอนออฟไลน์ได้)
 *
 * ใช้กับโครงหน้าจอและปุ่มคำสั่งทุกปุ่ม — ชุดเดียวกันทั้งแอป
 * ไม่ใช้อีโมจิแทนไอคอนแล้ว (หน้าตาต่างกันทุกเครื่อง เส้นไม่เข้าชุด) — เหลือเฉพาะชื่อแท็บ/เมนูในชีตที่มีอีโมจิจริง
 */

const P = {
  home:     '<path d="M3 10.2 12 3l9 7.2"/><path d="M5.5 9.4V20a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1V9.4"/>',
  clock:    '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.2V12l3.2 1.9"/>',
  tasks:    '<path d="M9 4.5h6v2H9z"/><path d="M15 5.5h3a1 1 0 0 1 1 1V20a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6.5a1 1 0 0 1 1-1h3"/><path d="m9 13.5 2 2 4-4"/>',
  chart:    '<path d="M4 3.5V20h16"/><path d="M8 20v-5.5"/><path d="M12.5 20V9"/><path d="M17 20v-8"/>',
  table:    '<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><path d="M3.5 9.5h17M3.5 14.5h17M9.5 9.5v10"/>',
  refresh:  '<path d="M20.5 12a8.5 8.5 0 1 1-2.5-6"/><path d="M20.5 4.5V10H15"/>',
  gear:     '<circle cx="12" cy="12" r="3.1"/><path d="M18.9 14.3a1.5 1.5 0 0 0 .3 1.7l.1.1a1.9 1.9 0 1 1-2.7 2.7l-.1-.1a1.5 1.5 0 0 0-1.7-.3 1.5 1.5 0 0 0-.9 1.4v.2a1.9 1.9 0 1 1-3.8 0v-.1a1.5 1.5 0 0 0-1-1.4 1.5 1.5 0 0 0-1.7.3l-.1.1a1.9 1.9 0 1 1-2.7-2.7l.1-.1a1.5 1.5 0 0 0 .3-1.7 1.5 1.5 0 0 0-1.4-.9h-.2a1.9 1.9 0 1 1 0-3.8h.1a1.5 1.5 0 0 0 1.4-1 1.5 1.5 0 0 0-.3-1.7l-.1-.1a1.9 1.9 0 1 1 2.7-2.7l.1.1a1.5 1.5 0 0 0 1.7.3h.1a1.5 1.5 0 0 0 .9-1.4v-.2a1.9 1.9 0 1 1 3.8 0v.1a1.5 1.5 0 0 0 .9 1.4 1.5 1.5 0 0 0 1.7-.3l.1-.1a1.9 1.9 0 1 1 2.7 2.7l-.1.1a1.5 1.5 0 0 0-.3 1.7v.1a1.5 1.5 0 0 0 1.4.9h.2a1.9 1.9 0 1 1 0 3.8h-.1a1.5 1.5 0 0 0-1.4.9z"/>',
  book:     '<path d="M5 4.8A1.8 1.8 0 0 1 6.8 3H19v18H6.8A1.8 1.8 0 0 1 5 19.2z"/><path d="M5 17.2h14"/>',
  sun:      '<circle cx="12" cy="12" r="3.8"/><path d="M12 2.2v2.4M12 19.4v2.4M4.5 4.5 6.2 6.2M17.8 17.8l1.7 1.7M2.2 12h2.4M19.4 12h2.4M4.5 19.5 6.2 17.8M17.8 6.2l1.7-1.7"/>',
  moon:     '<path d="M20.2 14.6A8.6 8.6 0 0 1 9.4 3.8a8.6 8.6 0 1 0 10.8 10.8z"/>',
  auto:     '<rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8.5 21h7M12 17v4"/>',
  search:   '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.4-4.4"/>',
  // ถังคะแนน 4 ชนิดในหน้างาน/คะแนน
  doc:      '<path d="M14 3.5H7a1.5 1.5 0 0 0-1.5 1.5v14A1.5 1.5 0 0 0 7 20.5h10a1.5 1.5 0 0 0 1.5-1.5V8z"/><path d="M14 3.5V8h4.5"/><path d="M9 12.5h6M9 16h4"/>',
  pencil:   '<path d="M4.5 19.5h4l10-10a2.1 2.1 0 0 0-4-4l-10 10z"/><path d="m13.5 6.5 4 4"/>',
  exam:     '<rect x="4.5" y="3.5" width="15" height="17" rx="1.5"/><path d="M8.5 8.5h7M8.5 12h7M8.5 15.5h4"/>',
  flag:     '<path d="M5.5 21V4"/><path d="M5.5 4.5h11l-2.2 4 2.2 4h-11"/>',
  close:    '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>',
  // ปุ่มคำสั่ง — แทนอีโมจิ/อักขระพิเศษที่แต่ละเครื่องวาดไม่เหมือนกัน
  back:     '<path d="m14.5 5.5-6.5 6.5 6.5 6.5"/>',
  next:     '<path d="m9.5 5.5 6.5 6.5-6.5 6.5"/>',
  down:     '<path d="m6 9.5 6 6 6-6"/>',
  more:     '<circle cx="5.5" cy="12" r=".9" fill="currentColor"/><circle cx="12" cy="12" r=".9" fill="currentColor"/><circle cx="18.5" cy="12" r=".9" fill="currentColor"/>',
  check:    '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  plus:     '<path d="M12 5v14M5 12h14"/>',
  download: '<path d="M12 4v11"/><path d="m7.5 10.5 4.5 4.5 4.5-4.5"/><path d="M5 19.5h14"/>',
  paste:    '<rect x="5.5" y="4.5" width="13" height="16" rx="1.5"/><path d="M9 4.5V3.5h6v1"/><path d="M9 10h6M9 13.5h6M9 17h3.5"/>',
  copy:     '<rect x="8.5" y="8.5" width="11" height="11" rx="1.5"/><path d="M15.5 8.5V6A1.5 1.5 0 0 0 14 4.5H6A1.5 1.5 0 0 0 4.5 6v8A1.5 1.5 0 0 0 6 15.5h2.5"/>',
  megaphone:'<path d="M4 10v4a1 1 0 0 0 1 1h2l8 4.5v-15L7 9H5a1 1 0 0 0-1 1z"/><path d="M18.5 9a4 4 0 0 1 0 6"/>',
  printer:  '<path d="M7 9V3.5h10V9"/><rect x="3.5" y="9" width="17" height="8" rx="1.5"/><path d="M7 14.5h10v6H7z"/>',
  trash:    '<path d="M4.5 7h15"/><path d="M9.5 7V4.5h5V7"/><path d="M6.5 7l1 13h9l1-13"/>',
  edit:     '<path d="M4.5 19.5h4l10-10a2.1 2.1 0 0 0-4-4l-10 10z"/>',
  eye:      '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.8"/>',
  eyeOff:   '<path d="M4 4l16 16"/><path d="M10 6a9 9 0 0 1 2-.5C18 5.5 21.5 12 21.5 12a16 16 0 0 1-2.6 3.4M14.1 14.2A2.8 2.8 0 0 1 9.8 9.9M6.6 7.4C3.9 9.3 2.5 12 2.5 12S6 18.5 12 18.5a9 9 0 0 0 4-.9"/>',
  shuffle:  '<path d="M3.5 7h3.5c4 0 6 10 10 10h3.5"/><path d="M3.5 17h3.5c1.4 0 2.6-1.2 3.6-2.8M13.4 9.8C14.4 8.2 15.6 7 17 7h3.5"/><path d="m18 4.5 2.5 2.5L18 9.5M18 14.5l2.5 2.5-2.5 2.5"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  users:    '<circle cx="9" cy="8.5" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M15.5 5.2a3.5 3.5 0 0 1 0 6.6M18 14.5a6.5 6.5 0 0 1 3.5 5.5"/>',
  phone:    '<rect x="6.5" y="2.5" width="11" height="19" rx="2.5"/><path d="M10.5 18.5h3"/>',
  qr:       '<rect x="3.5" y="3.5" width="6.5" height="6.5" rx="1"/><rect x="14" y="3.5" width="6.5" height="6.5" rx="1"/><rect x="3.5" y="14" width="6.5" height="6.5" rx="1"/><path d="M14 14h2.5v2.5H14zM18 18h2.5v2.5H18zM14 18.5v2M18.5 14h2"/>',
  login:    '<path d="M14 4.5h4a1.5 1.5 0 0 1 1.5 1.5v12a1.5 1.5 0 0 1-1.5 1.5h-4"/><path d="M3.5 12h11"/><path d="m11 8 4 4-4 4"/>',
  install:  '<rect x="5.5" y="2.5" width="13" height="19" rx="2.5"/><path d="M12 7v7.5"/><path d="m9 11.5 3 3 3-3"/>',
  broom:    '<path d="M19.5 4.5 13 11"/><path d="M8.5 11.5c2-1 4-.8 5 .2s1.2 3-.2 5L9 21l-6-6z"/><path d="m6 18 2-2"/>',
  pulse:    '<path d="M3 12h4l2.5-6 4 12 2.5-6h5"/>',
  save:     '<path d="M5 3.5h11l3.5 3.5V19a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 19V5A1.5 1.5 0 0 1 5 3.5z"/><path d="M7.5 3.5v5h8v-5M7.5 20.5v-6h9v6"/>',
  undo:     '<path d="M8.5 5 4 9.5 8.5 14"/><path d="M4 9.5h10a6 6 0 0 1 0 12h-3"/>',
  alert:    '<path d="M10.3 4.2 2.9 17.5A2 2 0 0 0 4.6 20.5h14.8a2 2 0 0 0 1.7-3L13.7 4.2a2 2 0 0 0-3.4 0z"/><path d="M12 9.5v4.2"/><circle cx="12" cy="16.9" r=".9" fill="currentColor"/>',
  folder:   '<path d="M3.5 6.5A1.5 1.5 0 0 1 5 5h4.5l2 2.5H19a1.5 1.5 0 0 1 1.5 1.5v9A1.5 1.5 0 0 1 19 19.5H5A1.5 1.5 0 0 1 3.5 18z"/>'
};

/** คืน element <svg> ที่ใช้สีตามข้อความรอบ ๆ (currentColor) */
export function icon(name, cls = 'ico') {
  const box = document.createElement('span');
  box.innerHTML =
    `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" ` +
    `stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">` +
    (P[name] || '') + '</svg>';
  return box.firstElementChild;
}

/** ไอคอนเล็กนำหน้าข้อความบนปุ่ม — ใช้แทนอีโมจิ เช่น h('button', …, ...withIcon('trash', 'ลบ')) */
export const withIcon = (name, label) => [icon(name, 'ico ico-sm'), label];
