/**
 * รวมไฟล์ ES module ทั้งหมดเป็นสคริปต์เดียว → dist/app.bundle.js
 * และสร้าง apps-script/Index.html ตัวเล็ก ๆ ที่ไปโหลดไฟล์นั้นจาก GitHub Pages
 *
 * รัน:  node tools/build-webapp.mjs
 *
 * ทำไมถึงไม่ฝังโค้ดไว้ในไฟล์ HTML เหมือนเดิม:
 *   ตัวแก้ไขของ Apps Script รับไฟล์ยาว ๆ ได้ไม่ครบ ตัวอักษรหายไปเงียบ ๆ นับพันตัว
 *   (เจอของจริง: วาง 153,291 ได้จริง 143,909 แล้วแอปเปิดไม่ขึ้นโดยไม่มีคำเตือน)
 *   ตอนนี้ Index.html เหลือไม่ถึง 4,000 ตัวอักษร จึงไม่มีทางขาด
 *
 * แก้โค้ดที่ js/ เหมือนเดิมเสมอ — อย่าแก้ไฟล์ที่ build ออกมา
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const ENTRY = 'js/app.js';

const read = (id) => fs.readFileSync(path.join(root, id), 'utf8');
const norm = (p) => p.split(path.sep).join('/');
const LF = String.fromCharCode(10);
const fix = (s) => s.split(String.fromCharCode(13, 10)).join(LF);

/** แปลง import/export ของโมดูลหนึ่งให้อยู่ในรูปฟังก์ชันโรงงาน */
function transform(id, src) {
  const dir = path.posix.dirname(id);
  const deps = [];

  let out = src.replace(
    /^import\s+(?:\*\s+as\s+([A-Za-z0-9_$]+)|\{([\s\S]*?)\})\s+from\s+['"](.+?)['"];?/gm,
    (_, ns, named, spec) => {
      const dep = norm(path.posix.normalize(path.posix.join(dir, spec)));
      deps.push(dep);
      if (ns) return `const ${ns} = __req(${JSON.stringify(dep)});`;
      const names = named.split(',').map(s => s.trim()).filter(Boolean).join(', ');
      return `const { ${names} } = __req(${JSON.stringify(dep)});`;
    }
  );

  // import ที่ไม่มีตัวแปร เช่น import './x.js'
  out = out.replace(/^import\s+['"](.+?)['"];?/gm, (_, spec) => {
    const dep = norm(path.posix.normalize(path.posix.join(dir, spec)));
    deps.push(dep);
    return `__req(${JSON.stringify(dep)});`;
  });

  const names = [];
  out = out.replace(
    /^export\s+(async\s+function|function|const|let|var|class)\s+([A-Za-z0-9_$]+)/gm,
    (_, kind, name) => { names.push(name); return `${kind} ${name}`; }
  );

  if (out.match(/^export\s/m)) {
    throw new Error(`${id}: มีรูปแบบ export ที่ตัวรวมยังไม่รองรับ — ${out.match(/^export.*/m)[0]}`);
  }
  if (names.length) out += `\n__exp(exports, { ${names.join(', ')} });\n`;
  return { code: out, deps: [...new Set(deps)] };
}

// ── ไล่กราฟ dependency ──────────────────────────────────────
const modules = new Map();
(function walk(id) {
  if (modules.has(id)) return;
  const t = transform(id, read(id));
  modules.set(id, t);
  t.deps.forEach(walk);
})(ENTRY);

const bundle = fix(`/* สร้างอัตโนมัติจาก tools/build-webapp.mjs — อย่าแก้ไฟล์นี้โดยตรง */
(function () {
  'use strict';
  var __defs = {}, __cache = {};
  function __req(id) {
    if (__cache[id]) return __cache[id];
    if (!__defs[id]) throw new Error('ไม่พบโมดูล ' + id);
    var exports = {};
    __cache[id] = exports;            // ใส่ก่อนรัน เพื่อรองรับการอ้างอิงวน
    __defs[id](exports, __req);
    return exports;
  }
  function __exp(exports, obj) { for (var k in obj) exports[k] = obj[k]; }

${[...modules.entries()].map(([id, m]) =>
  `  __defs[${JSON.stringify(id)}] = function (exports, __req) {\n${m.code}\n  };`
).join('\n\n')}

  __req(${JSON.stringify(ENTRY)});
  window.__acRunning = true;          // บอกตัวตรวจอาการว่าเริ่มแอปสำเร็จแล้ว
})();
`);

fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
fs.writeFileSync(path.join(root, 'dist/app.bundle.js'), bundle, 'utf8');

// ── หน้า HTML ตัวเล็กสำหรับ Apps Script ─────────────────────
const VER = (read('js/version.js').match(/APP_VERSION\s*=\s*'([^']+)'/) || [])[1] || '?';

/* CSS แกนกลาง — ฝังไว้ในไฟล์เสมอ เผื่อโหลดจาก GitHub ไม่ได้
   จะได้ยังอ่านหน้าจอโหลดและข้อความแจ้งเตือนออก ไม่ใช่หน้าขาวโล่ง */
const coreCss = [
  ":root{--bg:#eef2f0;--ink:#0b2b24;--ink2:#5b6b66;--ink3:#8b9a95;--line:#dde5e2;--accent:#0d7d6e;--lime:#c7f04a}",
  '@media(prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#081513;--ink:#e8f1ee;--ink2:#a3b8b2;--ink3:#7d938d;--line:#1f3a35;--accent:#2ba695}}',
  '[data-theme="dark"]{--bg:#081513;--ink:#e8f1ee;--ink2:#a3b8b2;--ink3:#7d938d;--line:#1f3a35;--accent:#2ba695}',
  "html,body{margin:0;background:var(--bg);color:var(--ink);font-family:'Anuphan','IBM Plex Sans Thai',system-ui,sans-serif;line-height:1.55}",
  ".boot{position:fixed;inset:0;display:grid;place-content:center;justify-items:center;gap:16px;background:var(--bg);z-index:999;text-align:center;padding:0 20px}",
  ".boot-mark{width:66px;height:66px;border-radius:20px;background:var(--lime,#c7f04a);color:#0b2b24;font-size:30px;font-weight:700;display:grid;place-content:center;position:relative}",
  ".boot-mark span{position:absolute;right:-6px;bottom:-6px;width:28px;height:28px;border-radius:50%;background:#0b2b24;color:#c7f04a;font-size:14px;display:grid;place-content:center}",
  ".boot-title{font-weight:700;font-size:19px}",
  ".boot-ver{font-size:11.5px;color:var(--ink3);margin-top:-8px}",
  ".boot-spin{width:22px;height:22px;border-radius:50%;border:2.5px solid var(--line);border-top-color:var(--accent);animation:spin .7s linear infinite}",
  "@keyframes spin{to{transform:rotate(360deg)}}"
].join('\n');

/* ตัวตรวจอาการ — อยู่นอกไฟล์โค้ดหลัก จึงยังทำงานแม้โค้ดหลักโหลดไม่ขึ้น
   แยกให้ออกว่าติดเพราะ "โค้ด" หรือ "หน้าตา" หรือ "ที่อยู่ผิด" */
const guard = [
  '<script>',
  'window.__acErr = null;',
  "window.addEventListener('error', function (e) {",
  '  if (!window.__acErr && e.message) window.__acErr = String(e.message);',
  '}, true);',
  'setTimeout(function () {',
  "  var b = document.getElementById('boot');",
  '  if (!b || window.__acRunning) return;',
  "  var src = (document.getElementById('ac-js') || {}).src || '';",
  "  var base = src.split('app.bundle.js')[0];",
  "  var cssOk = !!getComputedStyle(document.documentElement).getPropertyValue('--st-ok').trim();",
  '  var why;',
  '  if (!window.__acJsOk) {',
  "    why = 'โหลดไฟล์โค้ดจาก GitHub ไม่สำเร็จ<br><br>'",
  "        + 'ตรวจว่ามีไฟล์ <b>app.bundle.js</b> อยู่ที่<br>'",
  '        + \'<code style="font-size:11.5px;word-break:break-all">\' + base + \'</code>\'',
  "        + '<br><br>แก้ที่อยู่ได้ในชีต แท็บ ⚙️ ตั้งค่า → <code>assets_url</code>';",
  '  } else if (!cssOk) {',
  "    why = 'โหลดไฟล์หน้าตา (styles.css) ไม่สำเร็จ<br>ตรวจว่าอัปไฟล์ styles.css ขึ้น GitHub แล้วหรือยัง';",
  '  } else if (window.__acErr) {',
  "    why = 'โค้ดมีข้อผิดพลาด<br><code style=\"font-size:12px\">' + window.__acErr + '</code>';",
  '  } else {',
  "    why = 'เชื่อมต่อกับ Google Sheet ไม่สำเร็จ<br>ลองโหลดหน้านี้ใหม่อีกครั้ง';",
  '  }',
  '  b.innerHTML = \'<div style="max-width:420px"><div style="font-size:17px;font-weight:700;margin-bottom:10px">\'',
  '    + \'เปิดแอปไม่สำเร็จ</div><div style="font-size:13.5px;color:var(--ink2);line-height:1.9">\' + why + \'</div>\'',
  '    + \'<div style="font-size:11.5px;color:var(--ink3);margin-top:14px">v' + VER + '</div></div>\';',
  '}, 8000);',
  '',
  '// โหลด CSS ไม่ได้ = แอปใช้ได้แต่หน้าตาเพี้ยน ต้องบอกให้รู้ ไม่ใช่ปล่อยให้งงเอง',
  'setTimeout(function () {',
  "  if (getComputedStyle(document.documentElement).getPropertyValue('--st-ok').trim()) return;",
  "  var d = document.createElement('div');",
  "  d.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:9999;background:#fdf1e0;'",
  "    + 'color:#a35700;font:600 13px system-ui,sans-serif;padding:9px 12px;text-align:center';",
  "  d.textContent = 'โหลดไฟล์หน้าตา (styles.css) ไม่สำเร็จ — ใช้งานได้แต่หน้าตาจะเพี้ยน';",
  '  document.body.appendChild(d);',
  '}, 3000);',
  '</script>'
].join('\n');

const html = `<!DOCTYPE html>
<html lang="th">
<head>
<base target="_top">
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#ffffff">
<title>AssignCheck</title>
<script>try{var t=localStorage.getItem('ac.theme');if(t==='light'||t==='dark')document.documentElement.setAttribute('data-theme',t);}catch(e){}</script>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Anuphan:wght@400;500;600;700&family=IBM+Plex+Sans+Thai:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
${coreCss}
</style>
<link rel="stylesheet" href="<?!= assets ?>styles.css?v=${VER}">
</head>
<body>

<div id="boot" class="boot">
  <div class="boot-mark">A<span>&#10003;</span></div>
  <div class="boot-title">AssignCheck</div>
  <div class="boot-ver">v${VER}</div>
  <div class="boot-spin"></div>
</div>

<div id="app" hidden></div>
<div id="toasts" class="toasts"></div>
<div id="modal-root"></div>

${guard}
<script id="ac-js" src="<?!= assets ?>app.bundle.js?v=${VER}" onload="window.__acJsOk=true"></script>
</body>
</html>
`;

fs.writeFileSync(path.join(root, 'apps-script/Index.html'), html, 'utf8');

console.log(`✅ รวม ${modules.size} โมดูล`);
console.log(`   dist/app.bundle.js        ${bundle.length.toLocaleString()} ตัวอักษร  (ขึ้น GitHub)`);
console.log(`   apps-script/Index.html    ${html.length.toLocaleString()} ตัวอักษร  (วางใน Apps Script)`);
