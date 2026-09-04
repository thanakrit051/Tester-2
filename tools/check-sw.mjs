/**
 * ตรวจว่า sw.js เก็บไฟล์ครบตามที่แอปต้องใช้จริง
 *
 * รัน:  node tools/check-sw.mjs
 *
 * ทำไมต้องมี: รายชื่อไฟล์ใน sw.js เขียนด้วยมือ พอเพิ่มโมดูลใหม่แล้วลืมใส่
 * แอปจะยังทำงานปกติทุกอย่างตอนมีเน็ต (เพราะโหลดสด) แต่พอเปิดตอนไม่มีเน็ต
 * โมดูลจะขาด แล้วแอปไม่ขึ้นเลย — เป็นบั๊กที่หลุดง่ายที่สุดของโปรเจกต์นี้
 * และเจอตอนอยู่หน้าห้องพอดี
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

/** ไล่ตาม import ทั้งหมดจาก js/app.js */
function moduleGraph(entry) {
  const seen = new Set();
  const walk = (rel) => {
    if (seen.has(rel)) return;
    seen.add(rel);
    const src = read(rel);
    for (const m of src.matchAll(/from\s+'(\.[^']+)'/g)) {
      walk(path.posix.normalize(path.posix.join(path.posix.dirname(rel), m[1])));
    }
  };
  walk(entry);
  return seen;
}

const sw = read('sw.js');
const shell = new Set([...sw.matchAll(/'\.\/([^']*)'/g)].map(m => m[1]).filter(Boolean));
const needed = moduleGraph('js/app.js');

const missing = [...needed].filter(f => !shell.has(f)).sort();

// เวอร์ชันของ sw ต้องขยับตาม APP_VERSION ไม่งั้นแคชเก่าไม่ถูกล้าง
const appVer = (read('js/version.js').match(/APP_VERSION\s*=\s*'([^']+)'/) || [])[1];
const swVer  = (sw.match(/VERSION\s*=\s*'ac-v([^']+)'/) || [])[1];

// เลขใน package.json ต้องตรงด้วย ไม่งั้นคนอ่านโปรเจกต์จะเห็นเวอร์ชันคนละตัวกับที่ครูใช้จริง
const pkgVer = JSON.parse(read('package.json')).version;

let bad = false;
if (missing.length) {
  bad = true;
  console.error('❌ sw.js ขาดไฟล์ที่แอปต้องใช้ ' + missing.length + ' ไฟล์ (เปิดตอนไม่มีเน็ตจะไม่ขึ้น):');
  missing.forEach(f => console.error('   · ./' + f));
}
if (appVer !== swVer) {
  bad = true;
  console.error(`❌ เวอร์ชันไม่ตรงกัน — APP_VERSION=${appVer} แต่ sw.js เป็น ac-v${swVer}`);
  console.error(`   แก้ sw.js เป็น  const VERSION = 'ac-v${appVer}';  ไม่งั้นเครื่องครูจะยังใช้โค้ดเก่า`);
}

if (appVer !== pkgVer) {
  bad = true;
  console.error(`❌ เวอร์ชันไม่ตรงกัน — APP_VERSION=${appVer} แต่ package.json เป็น ${pkgVer}`);
}

if (bad) process.exit(1);
console.log(`✅ sw.js ครบ ${needed.size} ไฟล์ · เวอร์ชันตรงกันที่ ${appVer} (js/version.js · sw.js · package.json)`);
