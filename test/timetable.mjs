/**
 * ตรวจตรรกะตารางสอน (js/timetable.js)
 *
 * รัน:  node test/timetable.mjs   (preflight เรียกให้เอง)
 *
 * ทำไมต้องมี: หน้าแรกตัดสินจากตรงนี้ว่า "ตอนนี้" ครูต้องสอนห้องไหน
 * ถ้าเลือกผิดคาบ ครูกดปุ่มเดียวแล้วไปเช็คชื่อผิดห้องโดยไม่ทันสังเกต
 * และค่าในชีตครูแก้มือได้ — อ่านค่าเพี้ยนแล้วต้องไม่พังทั้งหน้าแรก
 */
import {
  parseTimetable, serializeTimetable, currentSlot, slotsOn, toMin, fromMin,
  hasTimetable, weeklyCount, emptyTimetable, withoutClasses, isJoined, blockOf, periodText
} from '../js/timetable.js';

let n = 0;
const fails = [];
function eq(name, got, want) {
  n++;
  const a = JSON.stringify(got), b = JSON.stringify(want);
  if (a !== b) fails.push(`${name}\n     ได้   ${a}\n     ควรได้ ${b}`);
}

// ── เวลา ──
eq('toMin', toMin('08:30'), 510);
eq('toMin ชั่วโมงหลักเดียว', toMin('8:05'), 485);
eq('toMin รูปแบบผิด', Number.isNaN(toMin('25:00')), true);
eq('fromMin', fromMin(965), '16:05');

// ── อ่านค่าที่เพี้ยน ──
eq('ค่าว่าง = ตารางว่าง', hasTimetable(parseTimetable('')), false);
eq('JSON พัง = ตารางว่าง', hasTimetable(parseTimetable('{oops')), false);
eq('ไม่ใช่ object', hasTimetable(parseTimetable(42)), false);
eq('ตัดคาบเกินจำนวนเวลาทิ้ง',
  parseTimetable({ times: [['08:00', '09:00']], days: { 1: { 1: 'A', 5: 'B' } } }).days, { 1: { 1: 'A' } });
eq('เวลาเพี้ยนใช้ค่าตั้งต้น',
  parseTimetable({ times: [['xx', '09:20']], days: {} }).times[0], ['08:30', '09:20']);
eq('วันเสาร์/อาทิตย์ไม่อ่าน',
  parseTimetable({ days: { 0: { 1: 'A' }, 6: { 1: 'A' }, 2: { 1: 'B' } } }).days, { 2: { 1: 'B' } });

// ── บันทึกแล้วอ่านกลับได้เหมือนเดิม ──
const tt = emptyTimetable();
tt.days = { 1: { 1: 'M11', 2: 'M12', 5: '' }, 3: { 4: 'M33' } };
const back = parseTimetable(serializeTimetable(tt));
eq('ไปกลับ: ทิ้งช่องว่าง', back.days, { 1: { 1: 'M11', 2: 'M12' }, 3: { 4: 'M33' } });
eq('นับคาบต่อสัปดาห์', weeklyCount(back), 3);

// ── คาบของวัน ──
const known = new Set(['M11', 'M12']);
eq('ข้ามห้องที่ถูกลบ', slotsOn(back, 3, known).length, 0);
eq('เรียงตามเวลา', slotsOn(back, 1).map(s => s.period), [1, 2]);

// ── ตอนนี้คาบไหน (จันทร์ 2026-10-12) ──
const at = (hhmm) => { const d = new Date(2026, 9, 12); d.setHours(...hhmm.split(':').map(Number)); return d; };
const pick = (hhmm) => { const r = currentSlot(back, at(hhmm)); return r && [r.state, r.slot.period, r.left ?? r.until]; };

eq('ก่อนเข้าเรียน = คาบถัดไป', pick('07:50'), ['next', 1, 40]);
eq('ระหว่างคาบ 1', pick('08:40'), ['now', 1, 40]);
eq('ต่อคาบ 2 พอดี', pick('09:20'), ['now', 2, 50]);
eq('คาบ 2 เพิ่งจบ 5 นาที ยังนับเป็นตอนนี้', pick('10:15'), ['now', 2, 0]);
eq('เลยมา 10 นาที = ไม่มีคาบเหลือ', pick('10:20'), null);
eq('วันอังคารไม่มีคาบ', currentSlot(back, new Date(2026, 9, 13, 9, 0)), null);

// คาบติดกัน: คาบที่เพิ่งจบต้องไม่บังคาบถัดไปที่กำลังจะเริ่ม
const back2 = parseTimetable({ times: [['08:30', '09:20'], ['09:25', '10:15']], days: { 1: { 1: 'A', 2: 'B' } } });
const r2 = currentSlot(back2, at('09:22'));
eq('พักสั้น ๆ ระหว่างคาบ = โชว์คาบถัดไป', r2 && [r2.state, r2.slot.classId], ['next', 'B']);

// ── ขึ้นภาคเรียนใหม่: เอาห้องออกจากตาราง ──
const tt3 = parseTimetable({ times: [['08:00', '09:00'], ['09:00', '10:00']], days: { 1: { 1: 'A', 2: 'B' }, 3: { 2: 'B' } } });
eq('เอาห้องที่ลบออก วันที่เหลือแต่ห้องนั้นหายทั้งวัน', withoutClasses(tt3, ['B']).days, { 1: { 1: 'A' } });
eq('ล้างทั้งหมด เวลาคาบยังอยู่', [withoutClasses(tt3, 'all').days, withoutClasses(tt3, 'all').times], [{}, [['08:00', '09:00'], ['09:00', '10:00']]]);
eq('ไม่ลบห้องไหน ตารางเหมือนเดิม', withoutClasses(tt3, []).days, tt3.days);
eq('ไม่แก้ตารางต้นฉบับ', tt3.days[1], { 1: 'A', 2: 'B' });
eq('อ่านกลับจากชีตได้เท่าเดิม', parseTimetable(serializeTimetable(withoutClasses(tt3, ['A']))).days, { 1: { 2: 'B' }, 3: { 2: 'B' } });

// ── คาบคู่ เช็คชื่อรวมกัน ──
const T4 = [['08:30', '09:20'], ['09:20', '10:10'], ['10:10', '11:00'], ['11:00', '11:50']];
const jt = parseTimetable({ times: T4, days: { 1: { 1: 'A', 2: 'A', 3: 'A', 4: 'B' } }, join: { 1: [2, 3, 4] } });
eq('รวมได้เฉพาะห้องเดียวกัน (คาบ 4 คนละห้อง ทิ้ง)', jt.join, { 1: [2, 3] });
eq('ชุดของคาบกลาง = ทั้งชุด', blockOf(jt, 1, 2), [1, 2, 3]);
eq('คาบที่ไม่ได้รวม = ตัวเอง', blockOf(jt, 1, 4), [4]);
eq('ข้อความคาบ', [periodText([3, 4]), periodText([2])], ['3–4', '2']);
eq('คาบคู่นับเป็นช่องเดียว', slotsOn(jt, 1).map(s => [s.period, s.periods, s.start, s.end]),
  [[1, [1, 2, 3], '08:30', '11:00'], [4, [4], '11:00', '11:50']]);
eq('จำนวนคาบ/สัปดาห์ยังนับทุกคาบ', weeklyCount(jt), 4);
const jr = currentSlot(jt, at('09:40'));
eq('กลางคาบคู่ = ตอนนี้ทั้งชุด เหลือถึงท้ายชุด', jr && [jr.state, jr.slot.period, jr.left], ['now', 1, 80]);

const jt2 = parseTimetable(serializeTimetable(jt));
eq('ไปกลับ: การรวมคาบยังอยู่', jt2.join, { 1: [2, 3] });
jt2.days[1][2] = 'C';
eq('เปลี่ยนห้องคาบหนึ่ง การรวมที่ติดคาบนั้นหลุดเอง', [isJoined(jt2, 1, 2), isJoined(jt2, 1, 3)], [false, false]);
eq('บันทึกแล้วไม่เก็บการรวมที่ใช้ไม่ได้', JSON.parse(serializeTimetable(jt2)).join, undefined);
eq('ไม่มีการรวม = ไม่เขียน join ลงชีต', 'join' in JSON.parse(serializeTimetable(back)), false);
eq('join เพี้ยนไม่พัง', parseTimetable({ times: T4, days: { 1: { 1: 'A', 2: 'A' } }, join: { 1: 'x', 2: [9] } }).join, {});
eq('ขึ้นภาคใหม่ เอาห้องออก การรวมของห้องนั้นหายด้วย', withoutClasses(jt, ['A']).join, {});
eq('ขึ้นภาคใหม่ ห้องที่เหลือยังรวมคาบอยู่', withoutClasses(jt, ['B']).join, { 1: [2, 3] });

if (fails.length) {
  console.error(`❌ ตารางสอน: ไม่ผ่าน ${fails.length} จาก ${n} ข้อ`);
  fails.forEach(f => console.error('   · ' + f));
  process.exit(1);
}
console.log(`✅ ตารางสอนผ่านครบ (${n} ข้อ)`);
