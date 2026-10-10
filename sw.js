/* AssignCheck — Service Worker
 * เก็บไฟล์แอปไว้ในเครื่อง ให้เปิดใช้ได้แม้ไม่มีเน็ต
 * ข้อมูลนักเรียน/คะแนน ไม่ผ่านที่นี่ (อยู่ใน localStorage + คิวซิงค์ของแอป)
 */

/* ⚠️ ต้องตรงกับ APP_VERSION ใน js/version.js เสมอ
 * ถ้าลืมบวกเลขนี้ แคชเดิมจะไม่ถูกล้าง ครูจะติดอยู่กับโค้ดเก่าไปเรื่อย ๆ
 * และคำเตือน "เวอร์ชันไม่ตรงกัน" ในแอปก็ช่วยไม่ได้ เพราะตัวแอปเองก็เก่า */
const VERSION = 'ac-v3.13.0';

/* ⚠️ ต้องมีครบทุกไฟล์ที่ js/app.js import ถึง (ทั้งทางตรงและทางอ้อม)
 * ขาดไปแม้แต่ไฟล์เดียว = เปิดแอปตอนไม่มีเน็ตแล้วโมดูลโหลดไม่ครบ แอปไม่ขึ้น
 * เช็คได้ด้วย: node tools/check-sw.mjs */
const SHELL = [
  './',
  './index.html',
  './styles.css',
  './config.js',
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
  './js/timetable.js',
  './js/views/timetable.js',
  './js/views/chase.js',
  './js/views/common.js',
  './js/vendor/qrcode.js',
  './js/views/health.js',
  './js/views/setup.js',
  './js/views/home.js',
  './js/views/attendance.js',
  './js/views/work.js',
  './js/views/report.js',
  './js/views/summary.js',
  './js/views/settings.js'
];

/* ลายนิ้วมือของไฟล์ทั้งชุดใน SHELL (ยกเว้น config.js) — tools/check-sw.mjs คำนวณให้
 *
 * แก้ไฟล์ใดก็ตามในชุดนี้แล้ว ค่านี้ต้องเปลี่ยนตาม (รัน node tools/check-sw.mjs --fix)
 * เพราะเบราว์เซอร์รู้ว่ามีโค้ดใหม่จากการที่ไฟล์ sw.js นี้เปลี่ยนเท่านั้น
 * ถ้าแก้โค้ดแต่ sw.js เหมือนเดิมทุกไบต์ เครื่องครูจะไม่มีวันได้ของใหม่ */
const SHELL_HASH = '5fc71121caa423db';

/* ชื่อแคชผูกกับทั้งเลขเวอร์ชันและลายนิ้วมือ ไฟล์เปลี่ยน = ได้แคชชุดใหม่แยกจากของเดิมเสมอ */
const CACHE = VERSION + '-' + SHELL_HASH;

/* ไฟล์ที่ครูแก้เองได้บน GitHub โดยไม่ผ่านเครื่องมือของโปรเจกต์ (ลิงก์ Apps Script)
 * ให้ตามของบนเว็บเสมอ ไม่งั้นแก้ลิงก์แล้วเครื่องเก่าจะไม่เห็นจนกว่าจะออกเวอร์ชันใหม่ */
const LIVE = new Set(['./config.js']);

/* ตอนพัฒนาบนเครื่องตัวเอง ให้โหลดสดเสมอ ไม่ต้องบวกเวอร์ชันทุกครั้งที่แก้ */
const DEV = ['localhost', '127.0.0.1', '[::1]'].includes(self.location.hostname);

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    /* ต้องได้ครบทั้งชุดเท่านั้น — ขาดไฟล์เดียวให้การติดตั้งล้มทั้งก้อน
     *
     * ของเดิมยอมให้บางไฟล์พลาดได้ ผลคือแคชเวอร์ชันใหม่ขาดโมดูล แล้วแอปไปดึงตัวที่ขาด
     * จากเน็ต (หรือเปิดไม่ขึ้นถ้าไม่มีเน็ต) · ล้มทั้งก้อนแปลว่าเครื่องครูใช้ชุดเดิมต่อ
     * แล้วเบราว์เซอร์จะลองติดตั้งใหม่เองรอบหน้าที่เปิดแอป
     *
     * cache: 'reload' = ข้ามแคช HTTP ของเบราว์เซอร์ ไปเอาจากเซิร์ฟเวอร์จริง
     * GitHub Pages บอกให้เก็บไฟล์ไว้ 10 นาที ถ้าไม่ข้าม ชุดใหม่อาจได้ไฟล์เก่าปนมา */
    await cache.addAll(SHELL.map(u => new Request(u, { cache: 'reload' })));
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
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  // อย่าแคชคำขอไป Apps Script หรือโดเมนอื่น — ต้องได้ข้อมูลสดเสมอ
  if (url.origin !== self.location.origin) return;

  const rel = './' + url.pathname.slice(new URL(self.registration.scope).pathname.length);
  const isPage = req.mode === 'navigate';

  if (DEV) { e.respondWith(fromNetwork(req, isPage)); return; }

  if (LIVE.has(rel)) {
    // ตอบจากแคชทันที (ไฟล์นี้บล็อกการวาดหน้า รอเน็ตไม่ได้) แล้วอัปเดตไว้ให้รอบหน้า
    e.respondWith((async () => {
      const cached = await caches.match(req);
      const fresh = fetch(req, { cache: 'no-cache' }).then(async (res) => {
        if (res && res.ok) await (await caches.open(CACHE)).put(req, res.clone());
        return res;
      }).catch(() => null);
      if (cached) { e.waitUntil(fresh); return cached; }
      return (await fresh) || offline();
    })());
    return;
  }

  /* ไฟล์อื่นทั้งหมด: ใช้ของในแคชของเวอร์ชันนี้ ห้ามเขียนทับระหว่างใช้งาน
   *
   * ของเดิมเอาไฟล์ที่เพิ่งโหลดจากเน็ตไปเขียนทับแคชของเวอร์ชันเดิมทุกครั้งที่เปิดแอป
   * หลังขึ้นเวอร์ชันใหม่ แคชเดียวกันจึงมีทั้งโมดูลเก่าและใหม่ปนกัน
   * (ไฟล์ไหนโหลดพลาด หรือเซิร์ฟเวอร์ยังส่งของเก่าค้างอยู่ ก็ค้างเป็นของเก่า)
   * ตอนนี้ของใหม่เข้ามาทางเดียว คือการติดตั้ง sw.js ตัวใหม่ทั้งชุด */
  e.respondWith((async () => {
    const cached = await caches.match(req, { ignoreSearch: isPage });
    return cached || fromNetwork(req, isPage);
  })());
});

async function fromNetwork(req, isPage) {
  try {
    return await fetch(req);
  } catch (err) {
    const cached = await caches.match(req, { ignoreSearch: isPage });
    if (cached) return cached;
    // ออฟไลน์และไม่มีในแคช → ถ้าเป็นการเปิดหน้า ให้ตกกลับไปที่หน้าแอป
    if (isPage) return (await caches.match('./index.html')) || offline();
    return offline();
  }
}

function offline() {
  return new Response('offline', { status: 503, statusText: 'offline' });
}

self.addEventListener('message', (e) => {
  if (e.data === 'skipWaiting') self.skipWaiting();
});
