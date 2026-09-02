/**
 * รวมหน้าของนักเรียนเป็นไฟล์เดียว → apps-script/Student.html
 * ใช้ styles.css ตัวเดียวกับแอปครู เพื่อให้ธีม/สี/โหมดมืดตรงกันเสมอ
 *
 * รัน:  node tools/build-student.mjs
 * แก้โค้ดที่ student/ เท่านั้น — อย่าแก้ไฟล์ที่ build ออกมา
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
// อ่านแล้วบังคับขึ้นบรรทัดใหม่เป็น LF ให้ตรงกับที่เบราว์เซอร์เห็นในเนื้อ <script>
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8')
  .split(String.fromCharCode(13, 10)).join(String.fromCharCode(10));
const VER = (read('js/version.js').match(/APP_VERSION\s*=\s*'([^']+)'/) || [])[1] || '?';

const html = `<!DOCTYPE html>
<html lang="th">
<head>
<base target="_top">
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#ffffff">
<title>ผลการเรียนของฉัน</title>
<script>try{var t=localStorage.getItem('ac.theme');if(t==='light'||t==='dark')document.documentElement.setAttribute('data-theme',t);}catch(e){}</script>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Thai:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
${read('styles.css')}
${read('student/student.css')}
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

<script>
${read('student/app.js')}
</script>
</body>
</html>
`;

fs.writeFileSync(path.join(root, 'apps-script/Student.html'), html, 'utf8');
console.log(`✅ apps-script/Student.html    ${(html.length / 1024).toFixed(1)} KB`);
