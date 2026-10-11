/* ตารางสอนของครู — ตรรกะล้วน ไม่แตะหน้าจอ (ทดสอบใน test/timetable.mjs)
 *
 * เก็บเป็นข้อความ JSON ในแท็บ ⚙️ ตั้งค่า ของชีต (คีย์ timetable) จึงใช้ได้ทุกเครื่อง
 * และไม่ต้องอัปโค้ดฝั่งชีต — คำสั่ง saveConfig รับคีย์ใหม่ได้อยู่แล้ว
 *
 *   { "v": 1,
 *     "times": [["08:30","09:20"], ...],      ← เวลาของคาบ 1, 2, 3, … ใช้ทุกวันเหมือนกัน
 *     "days":  { "1": { "2": "<classId>" } } ← วันจันทร์ (1) คาบ 2 สอนห้องไหน
 *   }
 *
 * วันใช้เลขแบบ Date.getDay(): 1 = จันทร์ … 5 = ศุกร์
 */

export const DEFAULT_TIMES = [
  ['08:30', '09:20'], ['09:20', '10:10'], ['10:10', '11:00'], ['11:00', '11:50'],
  ['13:00', '13:50'], ['13:50', '14:40'], ['14:40', '15:30'], ['15:30', '16:20']
];

export const MAX_PERIODS = 12;

export const DAYS = [
  { d: 1, short: 'จ',  name: 'วันจันทร์' },
  { d: 2, short: 'อ',  name: 'วันอังคาร' },
  { d: 3, short: 'พ',  name: 'วันพุธ' },
  { d: 4, short: 'พฤ', name: 'วันพฤหัสบดี' },
  { d: 5, short: 'ศ',  name: 'วันศุกร์' }
];

const TIME_RE = /^([01]?\d|2[0-3]):([0-5]\d)$/;

/** "08:30" → 510 · รูปแบบผิด = NaN */
export function toMin(hhmm) {
  const m = TIME_RE.exec(String(hhmm || '').trim());
  return m ? Number(m[1]) * 60 + Number(m[2]) : NaN;
}

/** 510 → "08:30" */
export function fromMin(min) {
  const m = ((Math.round(min) % 1440) + 1440) % 1440;
  return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
}

export function emptyTimetable() {
  return { v: 1, times: DEFAULT_TIMES.map(t => t.slice()), days: {} };
}

/**
 * อ่านค่าจากชีต — อะไรที่อ่านไม่ออกให้ได้ตารางว่าง ไม่ใช่ throw
 * (ครูอาจไปแก้ช่องนี้ในชีตเองจนรูปแบบเพี้ยน ไม่ควรทำให้หน้าแรกเปิดไม่ขึ้น)
 */
export function parseTimetable(raw) {
  const out = emptyTimetable();
  let d = raw;
  if (typeof raw === 'string') {
    if (!raw.trim()) return out;
    try { d = JSON.parse(raw); } catch (e) { return out; }
  }
  if (!d || typeof d !== 'object') return out;

  if (Array.isArray(d.times) && d.times.length) {
    const times = d.times.slice(0, MAX_PERIODS).map((t, i) => {
      const s = Array.isArray(t) ? t : [];
      const fb = DEFAULT_TIMES[i] || DEFAULT_TIMES[DEFAULT_TIMES.length - 1];
      return [isNaN(toMin(s[0])) ? fb[0] : String(s[0]).trim(), isNaN(toMin(s[1])) ? fb[1] : String(s[1]).trim()];
    });
    out.times = times;
  }

  if (d.days && typeof d.days === 'object') {
    for (const day of DAYS) {
      const src = d.days[day.d] || d.days[String(day.d)];
      if (!src || typeof src !== 'object') continue;
      const dst = {};
      for (const [p, id] of Object.entries(src)) {
        const n = Number(p);
        if (Number.isInteger(n) && n >= 1 && n <= out.times.length && id) dst[n] = String(id);
      }
      if (Object.keys(dst).length) out.days[day.d] = dst;
    }
  }
  return out;
}

export function serializeTimetable(tt) {
  const days = {};
  for (const [d, slots] of Object.entries(tt.days || {})) {
    const keep = {};
    for (const [p, id] of Object.entries(slots || {})) if (id) keep[p] = id;
    if (Object.keys(keep).length) days[d] = keep;
  }
  return JSON.stringify({ v: 1, times: tt.times, days });
}

/** มีคาบที่ระบุห้องไว้อย่างน้อยหนึ่งคาบไหม */
export function hasTimetable(tt) {
  return Object.values(tt.days || {}).some(s => Object.values(s || {}).some(Boolean));
}

/**
 * ตารางเดิมที่เอาห้องออก — ใช้ตอนขึ้นภาคเรียนใหม่ (js/views/newterm.js)
 * @param ids ห้องที่จะเอาออก · 'all' = ล้างทุกคาบ
 * เวลาของแต่ละคาบเก็บไว้เสมอ เพราะเป็นเวลาของทั้งโรงเรียน ไม่ได้ผูกกับห้อง
 */
export function withoutClasses(tt, ids) {
  const days = {};
  if (ids !== 'all') {
    const drop = new Set(ids);
    for (const [d, slots] of Object.entries(tt.days || {})) {
      const keep = Object.fromEntries(Object.entries(slots || {}).filter(([, id]) => id && !drop.has(id)));
      if (Object.keys(keep).length) days[d] = keep;
    }
  }
  return { v: 1, times: tt.times.map(t => t.slice()), days };
}

/** จำนวนคาบสอนต่อสัปดาห์ */
export function weeklyCount(tt) {
  return Object.values(tt.days || {}).reduce((a, s) => a + Object.values(s || {}).filter(Boolean).length, 0);
}

/**
 * คาบสอนของวันหนึ่ง เรียงตามเวลา
 * @param known ชุด classId ที่ยังมีอยู่จริง — ห้องที่ถูกลบไปแล้วไม่ต้องโชว์
 */
export function slotsOn(tt, dow, known) {
  const day = (tt.days || {})[dow] || {};
  return Object.entries(day)
    .map(([p, classId]) => {
      const period = Number(p);
      const t = tt.times[period - 1] || [];
      return { period, classId, start: t[0], end: t[1], s: toMin(t[0]), e: toMin(t[1]) };
    })
    .filter(x => x.classId && !isNaN(x.s) && !isNaN(x.e) && (!known || known.has(x.classId)))
    .sort((a, b) => a.s - b.s || a.period - b.period);
}

/**
 * ตอนนี้ควรโชว์คาบไหนบนหน้าแรก
 *   { slot, state: 'now',  left }   กำลังสอนอยู่ · left = เหลือกี่นาที · pct = ผ่านไปกี่ %
 *   { slot, state: 'next', until }  คาบถัดไปของวันนี้ · until = อีกกี่นาที
 *   null                            วันนี้ไม่มีคาบเหลือแล้ว / ไม่ได้ตั้งตาราง
 *
 * คาบที่เพิ่งจบไม่เกิน 10 นาทียังนับเป็น "ตอนนี้" — ครูมักเปิดแอปเช็คชื่อตอนท้ายคาบ
 * หรือคาบถัดไปเป็นคาบว่าง ถ้าเด้งไปคาบอื่นทันทีที่หมดเวลาจะหาคาบที่เพิ่งสอนไม่เจอ
 */
export function currentSlot(tt, date, known) {
  const slots = slotsOn(tt, date.getDay(), known);
  if (!slots.length) return null;
  const t = date.getHours() * 60 + date.getMinutes();
  const GRACE = 10;

  const now = slots.find(x => t >= x.s && t < x.e);
  if (now) return { slot: now, state: 'now', left: now.e - t, pct: Math.round((t - now.s) / Math.max(1, now.e - now.s) * 100) };

  const next = slots.find(x => x.s > t);
  const justEnded = slots.filter(x => t >= x.e && t < x.e + GRACE).pop();
  if (justEnded && !(next && next.s - t <= GRACE)) return { slot: justEnded, state: 'now', left: 0, pct: 100 };

  if (next) return { slot: next, state: 'next', until: next.s - t };
  return null;
}
