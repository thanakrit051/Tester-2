/* AssignCheck V2 — ที่เก็บข้อมูลในเครื่อง พร้อมตัวสำรองในหน่วยความจำ
 *
 * ทำไมต้องมีไฟล์นี้
 * ─────────────────
 * บางเบราว์เซอร์ห้ามแตะ localStorage แล้วโยน error ทันที
 *   · Chrome ที่ปิดคุกกี้ของบุคคลที่สาม เวลาแอปถูกเสิร์ฟใน iframe ของ Apps Script
 *   · Safari โหมดส่วนตัว · โหมดกันการติดตามบางตัว · พื้นที่เก็บเต็ม
 *
 * โค้ดเดิมกลืน error ทิ้งแล้วเดินต่อ ซึ่งดูเหมือนปลอดภัยแต่ไม่ใช่ —
 * "คิวงานที่รอส่งขึ้นชีต" ก็เขียนไม่ลงไปด้วย queue.size จึงเป็น 0 ตลอด
 * ผลคือคะแนนที่ครูกรอกขึ้นบนจอครบทุกช่อง ดูเหมือนบันทึกแล้ว
 * แต่ไม่เคยถูกส่งไปที่ชีตเลย และหายเงียบ ๆ ตอนปิดหน้า
 *
 * ไฟล์นี้จึงสลับไปเก็บในหน่วยความจำแทนเมื่อเขียนลงเครื่องไม่ได้
 * รอบการใช้งานนี้ยังทำงานครบ (ซิงค์ขึ้นชีตได้ตามปกติ)
 * แลกกับการที่ปิดหน้าไปแล้วของที่ยังไม่ได้ส่งจะหาย
 * — แอปจะเตือนครูให้รู้ตัวผ่าน store.persistent
 */

const mem = new Map();          // ค่าที่เขียนลงเครื่องไม่ได้ เก็บไว้ตรงนี้แทน
const gone = new Set();         // คีย์ที่สั่งลบแล้ว แต่ลบออกจากเครื่องจริงไม่ได้
let usingMemory = false;
let reason = '';

function fallback(why) {
  if (usingMemory) return;
  usingMemory = true;
  reason = why;
  console.warn('AssignCheck: เก็บข้อมูลลงเครื่องไม่ได้ (' + why + ') — ใช้หน่วยความจำแทนรอบนี้');
}

/**
 * พื้นที่เต็ม — แคชสร้างใหม่ได้จากชีต แต่คิวที่รอส่งสร้างใหม่ไม่ได้
 * จึงทิ้งแคชเพื่อเปิดทางให้คิวก่อน ค่อยยอมถอยไปหน่วยความจำเป็นทางสุดท้าย
 */
function dropCache(exceptKey) {
  let dropped = false;
  try {
    for (const k of Object.keys(localStorage)) {
      if (k.startsWith('ac.cache.') && k !== exceptKey) { localStorage.removeItem(k); dropped = true; }
    }
  } catch (e) { return false; }
  return dropped;
}

// ลองตั้งแต่ตอนเปิดแอป ดีกว่าไปรู้ตอนครูกรอกคะแนนไปแล้วครึ่งห้อง
try {
  localStorage.setItem('ac.__probe', '1');
  localStorage.removeItem('ac.__probe');
} catch (e) {
  fallback('เบราว์เซอร์ไม่อนุญาต');
}

export const store = {
  /** false = ของที่เขียนรอบนี้อยู่แค่ในแท็บนี้ ปิดหน้าแล้วหาย */
  get persistent() { return !usingMemory; },
  get reason() { return reason; },

  /**
   * หน่วยความจำมาก่อน (ของใหม่สุด) แล้วค่อยตกไปอ่านจากเครื่อง
   * ต้องอ่านทะลุแบบนี้ ไม่งั้นพอเขียนไม่ได้ครั้งเดียว ลิงก์ชีตที่เคยตั้งไว้
   * จะอ่านไม่เจอ แล้วแอปเด้งกลับไปหน้าติดตั้งเหมือนลืมทุกอย่าง
   */
  get(k) {
    if (mem.has(k)) return mem.get(k);
    if (gone.has(k)) return null;
    try { return localStorage.getItem(k); } catch (e) { return null; }
  },

  /** @returns true เสมอเมื่อเก็บได้ (ไม่ว่าจะลงเครื่องหรือหน่วยความจำ) */
  set(k, v) {
    const s = String(v);
    gone.delete(k);
    if (!usingMemory) {
      try { localStorage.setItem(k, s); mem.delete(k); return true; }
      catch (e) {
        if (dropCache(k)) {
          try { localStorage.setItem(k, s); mem.delete(k); return true; } catch (e2) {}
        }
        fallback('พื้นที่เต็มหรือถูกบล็อก');
      }
    }
    mem.set(k, s);
    return true;
  },

  del(k) {
    mem.delete(k);
    gone.add(k);
    // ถ้าลบออกจากเครื่องได้จริงก็ไม่ต้องจำว่า "ลบแล้ว" อีก
    try { localStorage.removeItem(k); gone.delete(k); } catch (e) {}
  },

  keys() {
    const out = new Set(mem.keys());
    try {
      for (const k of Object.keys(localStorage)) if (!gone.has(k)) out.add(k);
    } catch (e) {}
    return [...out];
  }
};
