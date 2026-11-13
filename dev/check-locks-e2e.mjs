#!/usr/bin/env node
// T10 锁注入 e2e（可随时复跑，退出码 0 = 双锁在构建链真实消费点上拦截有效）：
//   ① 篡改 seed/paper-journal.html 一个字节 → readSeedCSS() 必抛"种子被改动"
//      （readSeedCSS = prepareBuild L136 的真实消费点，构建必经）
//   ② 篡改 seed/iphone-frame.b64 → embedAsset('assets/iphone-frame.png') 必抛"资产校验和不符"
//      （embedAsset L105 → seedFrame = prepareBuild L141 的真实消费点，凡引用手机壳必经）
//   ③ 对照：未篡改时两消费点照常放行（锁不误伤）
// 守卫：finally 无条件还原 + 字节级复原校验。
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from '../tools/project.mjs';
import { readSeedCSS, embedAsset, applyDeliveryFontPolicy } from '../tools/build.mjs';

const SEED = path.join(ROOT, 'seed/paper-journal.html');
const B64 = path.join(ROOT, 'seed/iphone-frame.b64');
const seedOrig = fs.readFileSync(SEED, 'utf8');
const b64Orig = fs.readFileSync(B64, 'utf8');

let failed = 0;
const ok = (name, cond, detail = '') => { console.log(`${cond ? 'PASS' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`); if (!cond) failed = 1; };
const call = fn => { try { return { v: fn() }; } catch (e) { return { e }; } };

// ③ 对照：未篡改放行
const c1 = call(() => readSeedCSS());
ok('对照：种子未篡改 → readSeedCSS 放行', !!c1.v && c1.v.length > 1000, `css ${c1.v ? c1.v.length : 0} chars`);
const c2 = call(() => embedAsset({ src: ROOT, work: ROOT, out: ROOT }, 'assets/iphone-frame.png', 1));
ok('对照：资产未篡改 → embedAsset 放行', !!c2.v && c2.v.startsWith('data:image/png;base64,'));

try {
  // ① T8：种子漂移（buildProject 会在 prepareBuild→readSeedCSS 处拒建）
  fs.writeFileSync(SEED, seedOrig + '<!--t10-tamper-->');
  const r = call(() => readSeedCSS());
  ok('T8 拦截：种子漂移 → 构建期拒建', !!r.e && /种子被改动/.test(r.e.message), r.e ? r.e.message.slice(0, 72) : '未抛错');
} finally {
  fs.writeFileSync(SEED, seedOrig);
}
try {
  // ② T9：资产漂移（prepareBuild→embedAsset→seedFrame 处拒建）
  fs.writeFileSync(B64, b64Orig.replace('data:image/png;base64,', 'data:image/png;base64,AAAA'));
  const r = call(() => embedAsset({ src: ROOT, work: ROOT, out: ROOT }, 'assets/iphone-frame.png', 1));
  ok('T9 拦截：资产漂移 → 构建期拒建', !!r.e && /资产校验和不符/.test(r.e.message), r.e ? r.e.message.slice(0, 72) : '未抛错');
} finally {
  fs.writeFileSync(B64, b64Orig);
}
try {
  // ②' T9 补遗：字体 CSS 漂移（prepareBuild→applyDeliveryFontPolicy→inlineSeedFonts 处拒建）
  const fontCss = path.join(ROOT, 'seed/fonts/playfair-display-400.css');
  const fontOrig = fs.readFileSync(fontCss, 'utf8');
  try {
    fs.writeFileSync(fontCss, fontOrig.replace('playfair-display@5.3.0', 'playfair-display@9.9.9'));
    const r = call(() => applyDeliveryFontPolicy(readSeedCSS())); // prepareBuild L136 同款表达式，真实消费链
    ok('T9 拦截：字体 CSS 漂移 → 构建期拒建', !!r.e && /资产校验和不符/.test(r.e.message), r.e ? r.e.message.slice(0, 72) : '未抛错');
  } finally {
    fs.writeFileSync(fontCss, fontOrig);
    ok('还原：字体 CSS 字节级复原', fs.readFileSync(fontCss, 'utf8') === fontOrig);
  }
} catch { /* 守卫在内部 finally */ }

// 还原完整性
ok('还原：种子字节级复原', fs.readFileSync(SEED, 'utf8') === seedOrig);
ok('还原：资产字节级复原', fs.readFileSync(B64, 'utf8') === b64Orig);
process.exit(failed);
