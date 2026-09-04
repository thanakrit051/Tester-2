/**
 * ตั้งค่า ESLint — ตรวจโค้ดทั้ง 3 สภาพแวดล้อมที่โปรเจกต์นี้มี
 *
 *   js/ · student/     รันในเบราว์เซอร์ เป็น ES module
 *   tools/ · test/     รันด้วย Node
 *   apps-script/*.gs   รันบนเซิร์ฟเวอร์ของ Google เป็นสคริปต์ธรรมดา (ไม่ใช่ module)
 *                      และใช้ตัวแปรกลางของ Google ที่ ESLint ไม่รู้จักเอง
 *
 * รัน:  npm run lint
 *
 * ไฟล์ที่ build ออกมา (dist/ docs/ apps-script/ALL-IN-ONE.gs) ไม่ต้องตรวจ
 * เพราะเป็นสำเนาของต้นทางที่ตรวจไปแล้ว
 */
import js from '@eslint/js';
import globals from 'globals';
import { defineConfig, globalIgnores } from 'eslint/config';

/** ตัวแปรกลางของ Google Apps Script ที่โค้ดฝั่งชีตเรียกใช้ */
const appsScriptGlobals = {
  SpreadsheetApp: 'readonly',
  HtmlService: 'readonly',
  ContentService: 'readonly',
  PropertiesService: 'readonly',
  CacheService: 'readonly',
  LockService: 'readonly',
  UrlFetchApp: 'readonly',
  Utilities: 'readonly',
  Session: 'readonly',
  ScriptApp: 'readonly',
  DriveApp: 'readonly',
  Logger: 'readonly',
  Browser: 'readonly',
  console: 'readonly'
};

export default defineConfig([
  globalIgnores([
    'dist/**',
    'docs/**',
    'node_modules/**',
    'apps-script/Index.html',
    'dev/**'                       // หน้าทดลองดูดีไซน์ ไม่ได้ deploy
  ]),

  // ── โค้ดที่รันในเบราว์เซอร์ ────────────────────────────────
  {
    files: ['js/**/*.js', 'student/**/*.js', 'sw.js'],
    extends: [js.configs.recommended],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.serviceworker,
        google: 'readonly'          // มีเฉพาะตอน Apps Script เสิร์ฟหน้าเว็บเอง
      }
    },
    rules: {
      // จับ catch ที่เขียนไว้เฉย ๆ ไม่ได้ใช้ตัวแปร — โปรเจกต์นี้ใช้ท่านี้ตั้งใจ
      // ignoreRestSiblings = ยอมให้ { a, b, ...rest } ใช้ตัดฟิลด์ทิ้งได้
      'no-unused-vars': ['error', { caughtErrors: 'none', argsIgnorePattern: '^_', ignoreRestSiblings: true }],
      // catch ที่เว้นว่างไว้เป็นท่าประจำของโปรเจกต์นี้ — ตั้งใจกลืน error
      // ที่ไม่ควรทำให้ทั้งแอปพัง (localStorage ถูกบล็อก ฯลฯ)
      'no-empty': ['error', { allowEmptyCatch: true }],
      eqeqeq: ['error', 'smart']
    }
  },

  // ── โมดูลฝั่งเบราว์เซอร์เท่านั้น: บังคับสไตล์ใหม่ ──────────
  // student/app.js กับ sw.js จงใจเขียนสไตล์เดิม (ES5) จึงไม่รวมในบล็อกนี้
  {
    files: ['js/**/*.js'],
    rules: {
      'no-var': 'error',
      'prefer-const': 'warn'
    }
  },

  // ── สคริปต์ build / เทสต์ (Node) ───────────────────────────
  {
    files: ['tools/**/*.mjs', 'test/**/*.mjs'],
    extends: [js.configs.recommended],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: { ...globals.node }
    },
    rules: {
      'no-unused-vars': ['error', { caughtErrors: 'none', argsIgnorePattern: '^_', ignoreRestSiblings: true }],
      eqeqeq: ['error', 'smart'],
      'no-var': 'error'
    }
  },

  // ── โค้ดฝั่ง Google Sheet ──────────────────────────────────
  // จงใจไม่ห้าม var เพราะ Apps Script รันบนเอนจินที่เขียนสไตล์นี้มาแต่เดิม
  // และไฟล์เหล่านี้ต้องวางลงตัวแก้ไขของ Google ได้ตรง ๆ
  {
    files: ['apps-script/**/*.gs'],
    extends: [js.configs.recommended],
    languageOptions: {
      ecmaVersion: 2019,
      sourceType: 'script',
      globals: appsScriptGlobals
    },
    rules: {
      // vars:'local' = ไม่ตรวจตัวแปร/ฟังก์ชันระดับบนสุด
      // เพราะบน Apps Script มันคือ global ที่ไฟล์อื่นเรียกใช้ และ Google เรียกเอง
      // (onOpen, doGet, doPost, apiCall และเมนูต่าง ๆ)
      'no-unused-vars': ['error', { caughtErrors: 'none', args: 'none', vars: 'local' }],
      'no-empty': ['error', { allowEmptyCatch: true }],
      eqeqeq: ['error', 'smart'],
      // ไฟล์ .gs แต่ละไฟล์เรียกฟังก์ชันของไฟล์อื่นได้จริง เพราะ Apps Script
      // เอาทุกไฟล์มาต่อกันเป็นสโคปเดียว ตรวจทีละไฟล์จึงเห็นเป็น "ไม่รู้จัก" ไปหมด
      // การตรวจของจริงอยู่ที่บล็อกถัดไป ซึ่งตรวจไฟล์ที่ต่อกันแล้ว
      'no-undef': 'off'
    }
  },

  // ── ตรวจ "ทั้งโปรแกรม" ของฝั่งชีต ──────────────────────────
  //
  // ALL-IN-ONE.gs คือไฟล์ 0X_*.gs ทั้งหมดต่อกัน = สโคปเดียวกับที่ Google รันจริง
  // ตรงนี้จึงเป็นที่เดียวที่ no-undef มีความหมาย — จับพิมพ์ชื่อฟังก์ชันผิดข้ามไฟล์ได้
  //
  // ⚠️ ถ้าที่นี่ฟ้อง ให้ไปแก้ที่ไฟล์ต้นทาง 0X_*.gs แล้วรัน node tools/bundle.mjs ใหม่
  //    อย่าแก้ ALL-IN-ONE.gs ตรง ๆ
  {
    files: ['apps-script/ALL-IN-ONE.gs'],
    languageOptions: {
      ecmaVersion: 2019,
      sourceType: 'script',
      globals: appsScriptGlobals
    },
    rules: { 'no-undef': 'error' }
  }
]);
