/**
 * รวมไฟล์ .gs ทั้งหมดเป็น apps-script/ALL-IN-ONE.gs ไฟล์เดียว
 * เพื่อให้วางลง Apps Script ครั้งเดียวจบ
 *
 * รัน:  node tools/bundle.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const dir = path.join(root, 'apps-script');
const OUT = 'ALL-IN-ONE.gs';

const files = fs.readdirSync(dir)
  .filter(f => f.endsWith('.gs') && f !== OUT)
  .sort();

const header = `/* ═══════════════════════════════════════════════════════════════════
   AssignCheck V2 — รวมทุกไฟล์ไว้ในไฟล์เดียว (วางครั้งเดียวจบ)
   ───────────────────────────────────────────────────────────────────
   วิธีใช้
     1. เปิด Google Sheet → เมนู "ส่วนขยาย (Extensions) → Apps Script"
     2. ลบโค้ดเดิมใน Code.gs ให้หมด แล้ววางไฟล์นี้ทั้งไฟล์
     3. กดบันทึก (Ctrl+S)
     4. กลับไปที่ Sheet แล้วรีเฟรชหน้า → จะเห็นเมนู "📗 AssignCheck"
     5. กดเมนู 📗 AssignCheck → 🚀 ติดตั้ง / ซ่อมแซมโครงสร้าง

   ⚠️ ไฟล์นี้สร้างจากการรวมไฟล์ในโฟลเดอร์ apps-script/ อัตโนมัติ
      ถ้าจะแก้โค้ด ให้แก้ที่ไฟล์ต้นทางแล้วรันใหม่: node tools/bundle.mjs
   ═══════════════════════════════════════════════════════════════════ */
`;

const body = files
  .map(f => `\n\n/* ══════ ${f} ══════ */\n\n` + fs.readFileSync(path.join(dir, f), 'utf8'))
  .join('');

fs.writeFileSync(path.join(dir, OUT), header + body, 'utf8');
console.log(`✅ รวม ${files.length} ไฟล์ → apps-script/${OUT}`);
console.log('   ' + files.join(', '));
