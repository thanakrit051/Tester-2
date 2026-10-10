/**
 * สร้างโฟลเดอร์ docs/ สำหรับ GitHub Pages — หน้าให้นักเรียนดูผล
 *
 * รัน:  node tools/build-pages.mjs
 *
 * ได้ไฟล์
 *   docs/index.html      หน้านักเรียน (ไม่ต้องแก้)
 *   docs/config.js       ใส่ลิงก์ Apps Script ตรงนี้ที่เดียว
 *   docs/icons/          ไอคอน
 *
 * หน้าครูไม่ต้อง build — GitHub Pages เสิร์ฟ index.html + js/ ที่รากโปรเจกต์ตรง ๆ
 *
 * แยก config ออกมา เพราะเวลาอัปเดตหน้าเว็บจะได้ทับ index.html ได้เลย
 * โดยไม่ต้องกลัวว่าลิงก์ที่ตั้งไว้จะหาย
 */
import './preflight.mjs';   // ไม่ผ่าน = ไม่ build (ข้ามด้วย --skip-checks)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { transformSync } from 'esbuild';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8')
  .split(String.fromCharCode(13, 10)).join(String.fromCharCode(10));

/* ย่อหน้านักเรียนก่อนขึ้นเว็บ — ตัดคอมเมนต์กับช่องว่างออก (คอมเมนต์ภาษาไทยกินที่ 3 ไบต์ต่อตัวอักษร)
 * หน้านี้ไม่มี service worker นักเรียนโหลดใหม่ทุกครั้งที่เปิด ยิ่งเล็กยิ่งเปิดเร็วบนเน็ตมือถือ
 *
 * target ล็อกไว้ที่ไวยากรณ์รุ่นเดียวกับต้นฉบับ ไม่งั้นตัวย่ออาจเปลี่ยนเป็นไวยากรณ์ใหม่กว่า
 * (เช่น a = a || b → a ||= b) ที่ iPad/มือถือรุ่นเก่าในโรงเรียนอ่านไม่ออก */
const minJs = (code) => transformSync(code, { minify: true, target: 'es2020', charset: 'utf8' }).code;
const minCss = (code) => transformSync(code, { loader: 'css', minify: true, target: ['safari14', 'chrome90', 'firefox90'], charset: 'utf8' }).code;

const VER = (read('js/version.js').match(/APP_VERSION\s*=\s*'([^']+)'/) || [])[1] || '?';

const html = `<!DOCTYPE html>
<html lang="th">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#0b2b24" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#061210" media="(prefers-color-scheme: dark)">
<meta name="robots" content="noindex">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black">
<meta name="apple-mobile-web-app-title" content="ผลการเรียน">
<title>ผลการเรียนของฉัน</title>
<link rel="icon" href="./icons/favicon.ico">
<link rel="icon" href="./icons/icon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="./icons/apple-touch-icon.png">
<script>try{var t=localStorage.getItem('ac.theme');if(t==='light'||t==='dark'){document.documentElement.setAttribute('data-theme',t);var c=t==='dark'?'#061210':'#0b2b24',m=document.querySelectorAll('meta[name="theme-color"]');for(var i=0;i<m.length;i++)m[i].content=c;}}catch(e){}</script>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<!-- โหลดฟอนต์แบบไม่บล็อกการวาดหน้า
     ของเดิมเป็น <link rel="stylesheet"> ธรรมดา เบราว์เซอร์จะไม่วาดอะไรเลย
     จนกว่าจะโหลด CSS ก้อนนี้จาก Google เสร็จ (2 ตระกูล × 4 น้ำหนัก)
     เน็ตโรงเรียนช้า ๆ ทีก็ค้างที่จอขาวไปหลายวินาทีทั้งที่แอปพร้อมแล้ว
     media="print" ทำให้ไม่บล็อก แล้วสลับเป็น all ตอนโหลดเสร็จ
     ระหว่างนั้นใช้ฟอนต์ระบบไปก่อน (มีใน font-family อยู่แล้ว) -->
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Anuphan:wght@400;500;600;700&family=IBM+Plex+Sans+Thai:wght@400;500;600;700&display=swap" media="print" onload="this.media='all';this.onload=null">
<noscript><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Anuphan:wght@400;500;600;700&family=IBM+Plex+Sans+Thai:wght@400;500;600;700&display=swap"></noscript>
<style>
${minCss(read('styles.css') + read('student/student.css'))}
</style>
</head>
<body>

<div id="boot" class="boot">
  <div class="boot-mark">A<span>✓</span></div>
  <div class="boot-title">ผลการเรียนของฉัน</div>
  <div class="boot-ver">v${VER}</div>
  <div class="boot-spin"></div>
</div>

<div id="app" hidden></div>

<script src="./config.js"></script>
<script>
${minJs(read('student/app.js'))}
</script>
</body>
</html>
`;

const config = `/* ══════════════════════════════════════════════════════════
   ตั้งค่าที่เดียว — วางลิงก์ Apps Script ของคุณลงในเครื่องหมายคำพูด

   เอาลิงก์มาจากไหน:
     Apps Script → Deploy → Manage deployments
     → เลือกอันที่ตั้ง Who has access เป็น "Anyone"
     → คัดลอก Web app URL (ลงท้ายด้วย /exec)

   ⚠️ ต้องเป็น deployment ที่ตั้งเป็น "Anyone" เท่านั้น
      ถ้าใช้ลิงก์ของครู นักเรียนจะเปิดไม่ได้
   ══════════════════════════════════════════════════════════ */

window.AC_API = '';
`;

const docs = path.join(root, 'docs');
fs.mkdirSync(docs, { recursive: true });
fs.writeFileSync(path.join(docs, 'index.html'), html, 'utf8');

// อย่าทับ config เดิม ไม่งั้นลิงก์ที่ครูตั้งไว้จะหายทุกครั้งที่ build
const cfgPath = path.join(docs, 'config.js');
if (!fs.existsSync(cfgPath)) fs.writeFileSync(cfgPath, config, 'utf8');

// บอก GitHub Pages ว่าไม่ต้องเอา Jekyll มาประมวลผล
fs.writeFileSync(path.join(docs, '.nojekyll'), '', 'utf8');

// เก็บกวาดไฟล์ที่เคยสร้างไว้ให้โหมด Apps Script เสิร์ฟหน้าครู (เลิกใช้แล้วตั้งแต่ 3.14)
for (const old of ['styles.css', 'app.bundle.js']) fs.rmSync(path.join(docs, old), { force: true });

// ไอคอนต้องมาอยู่ใต้ docs/ ด้วย — หน้านักเรียนอ้าง ./icons/ ตรง ๆ
fs.cpSync(path.join(root, 'icons'), path.join(docs, 'icons'), {
  recursive: true,
  filter: (src) => !src.endsWith('.md')   // README ของโฟลเดอร์ไอคอนไม่ต้องขึ้นเว็บ
});

console.log(`✅ docs/index.html      ${(html.length / 1024).toFixed(1)} KB   หน้านักเรียน`);
console.log(`   docs/config.js       ${fs.existsSync(cfgPath) ? 'มีอยู่แล้ว (ไม่ทับ)' : 'สร้างใหม่'}`);
console.log(`   docs/icons/          ${fs.readdirSync(path.join(docs, 'icons')).length} ไฟล์   ไอคอน`);
