/* AssignCheck — Service Worker
 * เก็บไฟล์แอปไว้ในเครื่อง ให้เปิดใช้ได้แม้ไม่มีเน็ต
 * ข้อมูลนักเรียน/คะแนน ไม่ผ่านที่นี่ (อยู่ใน localStorage + คิวซิงค์ของแอป)
 */

const VERSION = 'ac-v2-3-0';
const SHELL = [
  './',
  './index.html',
  './styles.css',
  './manifest.webmanifest',
  './js/app.js',
  './js/api.js',
  './js/state.js',
  './js/score.js',
  './js/dom.js',
  './js/auth.js',
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
    self.skipWaiting();
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
        caches.open(VERSION).then(c => c.put(req, res.clone()));
      }
      return res;
    }).catch(() => null);

    // มีในแคช → ตอบทันที แล้วอัปเดตเบื้องหลัง
    if (cached) { network; return cached; }
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
