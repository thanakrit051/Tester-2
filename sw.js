/* AssignCheck — Service Worker
 * เก็บไฟล์แอปไว้ในเครื่อง ให้เปิดใช้ได้แม้ไม่มีเน็ต
 * ข้อมูลนักเรียน/คะแนน ไม่ผ่านที่นี่ (อยู่ใน localStorage + คิวซิงค์ของแอป)
 */

/* ⚠️ ต้องตรงกับ APP_VERSION ใน js/version.js เสมอ
 * ถ้าลืมบวกเลขนี้ แคชเดิมจะไม่ถูกล้าง ครูจะติดอยู่กับโค้ดเก่าไปเรื่อย ๆ
 * และคำเตือน "เวอร์ชันไม่ตรงกัน" ในแอปก็ช่วยไม่ได้ เพราะตัวแอปเองก็เก่า */
const VERSION = 'ac-v3.4.0';

/* ⚠️ ต้องมีครบทุกไฟล์ที่ js/app.js import ถึง (ทั้งทางตรงและทางอ้อม)
 * ขาดไปแม้แต่ไฟล์เดียว = เปิดแอปตอนไม่มีเน็ตแล้วโมดูลโหลดไม่ครบ แอปไม่ขึ้น
 * เช็คได้ด้วย: node tools/check-sw.mjs */
const SHELL = [
  './',
  './index.html',
  './styles.css',
  './manifest.webmanifest',
  './icons/icon.svg',
  './icons/favicon.ico',
  './icons/apple-touch-icon.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-192-maskable.png',
  './icons/icon-512-maskable.png',
  './js/app.js',
  './js/api.js',
  './js/state.js',
  './js/score.js',
  './js/dom.js',
  './js/auth.js',
  './js/icons.js',
  './js/theme.js',
  './js/storage.js',
  './js/version.js',
  './js/views/health.js',
  './js/views/setup.js',
  './js/views/home.js',
  './js/views/attendance.js',
  './js/views/work.js',
  './js/views/report.js',
  './js/views/summary.js',
  './js/views/settings.js'
];

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(VERSION);
    // ใช้ทีละไฟล์ ถ้าไฟล์ใดพลาดจะไม่ทำให้ทั้งชุดล้ม
    await Promise.all(SHELL.map(u => cache.add(u).catch(() => {})));
    // จงใจไม่เรียก skipWaiting() ตรงนี้
    //
    // ของเดิมสลับไปใช้โค้ดใหม่ทันทีที่ดาวน์โหลดเสร็จ ซึ่งเกิดขึ้นได้ระหว่างที่
    // ครูกำลังกรอกคะแนนอยู่ — โมดูลที่โหลดไปแล้วเป็นของเก่า แต่ไฟล์ที่ขอเพิ่ม
    // หลังจากนั้นเป็นของใหม่ ปนกันแล้วพังแบบหาสาเหตุไม่เจอ
    //
    // ตอนนี้รอไว้เฉย ๆ แล้วให้แอปขึ้นแถบ "มีเวอร์ชันใหม่" ให้ครูเลือกจังหวะเอง
    // (แอปส่งข้อความ skipWaiting มาที่ตัวรับข้างล่างสุดของไฟล์นี้)
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  // อย่าแคชคำขอไป Apps Script หรือโดเมนอื่น — ต้องได้ข้อมูลสดเสมอ
  if (url.origin !== self.location.origin) return;

  e.respondWith((async () => {
    const cached = await caches.match(req);
    const network = fetch(req).then((res) => {
      if (res && res.status === 200 && res.type === 'basic') {
        caches.open(VERSION).then(c => c.put(req, res.clone())).catch(() => {});
      }
      return res;
    }).catch(() => null);

    // มีในแคช → ตอบทันที แล้วอัปเดตเบื้องหลัง
    if (cached) { void network; return cached; }   // ปล่อยให้อัปเดตเบื้องหลังต่อไป
    const res = await network;
    if (res) return res;
    // ออฟไลน์และไม่มีในแคช → ถ้าเป็นการเปิดหน้า ให้ตกกลับไปที่หน้าแอป
    if (req.mode === 'navigate') return caches.match('./index.html');
    return new Response('offline', { status: 503, statusText: 'offline' });
  })());
});

self.addEventListener('message', (e) => {
  if (e.data === 'skipWaiting') self.skipWaiting();
});
