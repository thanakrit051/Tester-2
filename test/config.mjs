/**
 * ทดสอบการอ่าน/เขียนค่าในแท็บ ⚙️ ตั้งค่า — apps-script/01_Setup.gs
 *
 * รัน:  node test/config.mjs
 *
 * ทำไมต้องมี: ค่าตั้งค่าเดินทางไกลกว่าที่คิด
 *   ช่องกรอกในเว็บ → JSON → เซลล์ในชีต → getValues() → JSON → ฝั่งเว็บอีกรอบ
 * ระหว่างทาง Google Sheets "ช่วย" ตีความชนิดข้อมูลให้เอง ซึ่งทำให้ค่าที่เขียนลงไป
 * กับค่าที่อ่านกลับมาคนละชนิดกันได้ โดยไม่มี error สักตัว
 *
 * ของจริงที่เคยพลาด: ตั้งวันสอบกลางภาคแล้วขึ้นว่า "บันทึกแล้ว" แต่ช่องวันที่ว่างเปล่า
 * เพราะ '2026-10-01' ถูกแปลงเป็นชนิดวันที่ แล้วอ่านกลับมาเป็น Date
 * ซึ่ง JSON แปลงต่อเป็น ISO ที่มีเวลาติดมา ฝั่งเว็บจึงมองว่ารูปแบบไม่ถูก
 */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const gs = path.join(root, 'apps-script');

const TZ = 'Asia/Bangkok';

/* ── จำลองเฉพาะของที่ 01_Setup.gs เรียกใช้จริง ──
 * Utilities.formatDate ของจริงรับเขตเวลาแล้วจัดรูปแบบให้
 * ตรงนี้ทำเท่าที่ทดสอบต้องใช้: yyyy-MM-dd ตามเขตเวลาที่ส่งมา */
const ctx = {
  console,
  SpreadsheetApp: {},
  Utilities: {
    formatDate(d, tz, fmt) {
      if (fmt !== 'yyyy-MM-dd') throw new Error('ชุดทดสอบรองรับเฉพาะ yyyy-MM-dd');
      const s = new Intl.DateTimeFormat('en-CA', {
        timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit'
      }).format(d);
      return s;   // en-CA ให้รูปแบบ YYYY-MM-DD อยู่แล้ว
    },
    getUuid: () => 'test-uuid'
  }
};
vm.createContext(ctx);
vm.runInContext(
  fs.readFileSync(path.join(gs, '00_Constants.gs'), 'utf8') + '\n' +
  fs.readFileSync(path.join(gs, '01_Setup.gs'), 'utf8'), ctx);

// ss_() ของจริงคุยกับ SpreadsheetApp — ที่นี่ต้องการแค่เขตเวลา
ctx.ss_ = () => ({ getSpreadsheetTimeZone: () => TZ });

let fail = 0, pass = 0;
function eq(name, got, want) {
  const a = JSON.stringify(got), b = JSON.stringify(want);
  if (a === b) { pass++; return; }
  fail++;
  console.log('  ✗ ' + name + '\n      ได้: ' + a + '\n      ควรได้: ' + b);
}

// ── 1. ค่าที่ Sheets แปลงเป็นชนิดวันที่ ต้องกลับมาเป็น YYYY-MM-DD ──
{
  // เที่ยงคืนตามเวลาไทยของวันที่ 1 ต.ค. 2026 = 17:00Z ของวันที่ 30 ก.ย.
  // ถ้าเผลอจัดรูปแบบด้วย UTC จะได้ '2026-09-30' คือเพี้ยนไป 1 วัน
  const midnightBangkok = new Date('2026-09-30T17:00:00.000Z');
  eq('วันที่ในชีต → ข้อความ (ตามเขตเวลาไทย)',
    ctx.normalizeConfigValue_(midnightBangkok), '2026-10-01');

  // เผื่อกรณีที่ชีตเก็บเวลาอื่นในวันเดียวกัน ต้องได้วันเดิมไม่เลื่อน
  eq('เที่ยงวันของวันเดียวกัน ต้องได้วันเดิม',
    ctx.normalizeConfigValue_(new Date('2026-10-01T05:00:00.000Z')), '2026-10-01');

  eq('ผลลัพธ์ผ่านรูปแบบที่ฝั่งเว็บตรวจ',
    /^\d{4}-\d{2}-\d{2}$/.test(ctx.normalizeConfigValue_(midnightBangkok)), true);
}

// ── 2. ค่าชนิดอื่นต้องไม่ถูกแตะ ──────────────────────────────
{
  eq('ข้อความอยู่เหมือนเดิม', ctx.normalizeConfigValue_('2026-10-01'), '2026-10-01');
  eq('เกณฑ์เกรดอยู่เหมือนเดิม',
    ctx.normalizeConfigValue_('80:4, 75:3.5, 0:0'), '80:4, 75:3.5, 0:0');
  eq('ตัวเลขอยู่เหมือนเดิม', ctx.normalizeConfigValue_(2568), 2568);
  eq('ศูนย์ต้องไม่กลายเป็นค่าว่าง', ctx.normalizeConfigValue_(0), 0);
  eq('ค่าว่างอยู่เหมือนเดิม', ctx.normalizeConfigValue_(''), '');
  eq('บูลีนอยู่เหมือนเดิม', ctx.normalizeConfigValue_(true), true);
  eq('วันที่เสียต้องไม่พ่น NaN ออกไป', ctx.normalizeConfigValue_(new Date('ไม่ใช่วันที่')), '');
}

// ── 3. เขียนวันที่ลงชีตต้องบังคับเป็นข้อความ ────────────────
// ถ้าไม่บังคับ Sheets จะแปลงชนิดให้เองอีก แล้ววนกลับไปเป็นปัญหาเดิม
{
  const calls = [];
  const cell = {
    setNumberFormat(f) { calls.push(['format', f]); return cell; },
    setValue(v) { calls.push(['value', v]); return cell; }
  };
  ctx.writeConfigCell_(cell, '2026-10-01');
  eq('วันที่ → ตั้งรูปแบบเป็นข้อความก่อนเขียน',
    calls, [['format', '@'], ['value', '2026-10-01']]);

  const calls2 = [];
  const cell2 = {
    setNumberFormat(f) { calls2.push(['format', f]); return cell2; },
    setValue(v) { calls2.push(['value', v]); return cell2; }
  };
  ctx.writeConfigCell_(cell2, '80:4, 75:3.5');
  eq('ค่าอื่นไม่ต้องยุ่งกับรูปแบบเซลล์', calls2, [['value', '80:4, 75:3.5']]);
}

if (fail) {
  console.error('\n❌ การอ่าน/เขียนค่าตั้งค่าไม่ผ่าน ' + fail + ' ข้อ');
  process.exit(1);
}
console.log('✅ การอ่าน/เขียนค่าตั้งค่าผ่านครบ (' + pass + ' ข้อ)');
