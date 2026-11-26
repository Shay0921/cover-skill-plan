#!/usr/bin/env node
/* editor-contract.mjs · 交付目录的编辑器契约体检（只读，不出图、不补件）
 * 用法：node script/editor-contract.mjs <交付目录>
 *
 * 什么时候用：交付目录被人动过（手改 P 页、编辑器导出件放回、重跑 render 之后），
 * 想在不重新出图的前提下确认「还能不能打包进编辑器」。
 * 缺 editor.manifest.json 时这里只告警、不代写——写入是另一个动作（script/editor-prep.mjs），
 * 体检保持只读，才不会出现「跑个体检把交付改了」。
 *
 * 判定逻辑在 shared/editor-audit.mjs：补件脚本写完自己也要复检同一套，两处一份实现。
 */
import fs from 'node:fs';
import path from 'node:path';
import { auditDelivery } from './shared/editor-audit.mjs';

const target = process.argv[2];
if (!target) {
  console.error('用法：node script/editor-contract.mjs <交付目录>');
  process.exit(2);
}
const dir = path.resolve(target);
if (!fs.existsSync(dir)) {
  console.error(`❌ 目录不存在：${dir}`);
  process.exit(2);
}
if (!fs.readdirSync(dir).some((f) => /^P\d+.*\.html$/i.test(f))) {
  console.error(`❌ 目录下没有 P*.html：${dir}`);
  process.exit(2);
}

const { files, layerCount, errors, warns } = auditDelivery(dir);

for (const w of warns) console.warn('⚠ ' + w);
if (errors.length) {
  console.error(`\n❌ 编辑器契约 ${errors.length} 条硬错（打包会失败）：`);
  errors.forEach((e) => console.error('   - ' + e));
  process.exit(1);
}
console.log(`\n✅ ${files.length} 页通过编辑器契约体检（图层 ${layerCount} 个，${warns.length} 条告警）`);
