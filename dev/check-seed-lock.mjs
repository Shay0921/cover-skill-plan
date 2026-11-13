#!/usr/bin/env node
// T8 种子只读锁独立校验（可随时复跑）：
//   ① 真实种子 SHA-256 == 登记基线（readSeedCSS 全链可过）
//   ② 篡改内容 → verifySeedChecksum 必抛（gate FAIL 判据）
// 退出码 0 = 锁工作正常；非 0 = 锁失效或种子漂移。
import { readSeedCSS, verifySeedChecksum } from '../tools/build.mjs';
import { sha256 } from '../tools/project.mjs';
import { SEED_SHA256 } from '../tools/build.mjs';

let failed = 0;
const ok = (name, cond, detail = '') => { console.log(`${cond ? 'PASS' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`); if (!cond) failed = 1; };

try {
  const css = readSeedCSS();
  ok('真实种子过锁（readSeedCSS 全链）', css.length > 1000, `css ${css.length} chars`);
} catch (e) { ok('真实种子过锁（readSeedCSS 全链）', false, e.message); }

try {
  const actual = sha256(await import('node:fs').then(fs => fs.readFileSync(new URL('../seed/paper-journal.html', import.meta.url), 'utf8'))).toUpperCase();
  ok('现行种子 SHA-256 == 登记基线', actual === SEED_SHA256, actual.slice(0, 8) + '…');
} catch (e) { ok('现行种子 SHA-256 == 登记基线', false, e.message); }

for (const [name, tampered] of [
  ['样式微改', '<style>.p-page{color:#000}</style>'],
  ['空串', ''],
]) {
  try { verifySeedChecksum(tampered); ok(`篡改必抛（${name}）`, false, '未抛错！'); }
  catch (e) { ok(`篡改必抛（${name}）`, /种子被改动/.test(e.message), e.message.slice(0, 60)); }
}
process.exit(failed);
