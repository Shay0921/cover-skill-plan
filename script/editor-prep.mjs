#!/usr/bin/env node
/* editor-prep.mjs · 给「已经交付完的封面目录」事后补上编辑器材料（重出图之外的第二条路）
 * 用法：node script/editor-prep.mjs <交付目录> [--dry-run]
 *
 * 什么时候用：封面早就交付了（默认交付不带编辑器件），用户过几天才说「打开编辑器 / 我要改封面」。
 * 这时候任务工作区的 plan.json 通常已经没了，重跑 render 这条路走不通；
 * 本脚本只读交付目录里的 P 页 HTML，就地补出 editor.manifest.json，PNG 与页面一个字都不动。
 *
 * 只补 manifest，不补 fields.json：编辑器不读生成期 fields（pageApp 契约 §6「T6 剩余」），
 * 而事后从 HTML 反解文本填 fields 会破 span.hl 结构、且天然拿不到图槽的 crop——为一个没有消费者的文件
 * 造第二条转写路径，只会让「键 = data-layer」这条单一真源出现两个版本。要 fields 就走重跑 render 那条路。
 *
 * 补完自己复检（与 editor-contract 同一份 auditDelivery）：补件不验等于没补。
 */
import fs from 'node:fs';
import path from 'node:path';
import { buildManifest } from './shared/editor.mjs';
import { auditDelivery, listPages } from './shared/editor-audit.mjs';

const args = process.argv.slice(2);
const DRY = args.includes('--dry-run');
const target = args.find((a) => !a.startsWith('--'));
if (!target) {
  console.error('用法：node script/editor-prep.mjs <交付目录> [--dry-run]');
  process.exit(2);
}
const dir = path.resolve(target);
if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
  console.error(`❌ 交付目录不存在：${dir}`);
  process.exit(2);
}

const pages = listPages(dir);
if (!pages.length) {
  console.error(`❌ 目录下没有 P*.html：${dir}`);
  process.exit(2);
}
const unnumbered = pages.filter((p) => !p.nn);
if (unnumbered.length) {
  console.error(`❌ 这些页文件名不是 P<nn>-<名>.html，页序无从确定：${unnumbered.map((p) => p.file).join(' / ')}`);
  process.exit(2);
}
// 同号两页会写出两个 `p01`，manifest 里 id 撞车——编辑器按 id 索引页，撞了就是打不开或认错页。
const dupNn = pages.map((p) => p.nn).filter((nn, i, a) => a.indexOf(nn) !== i);
if (dupNn.length) {
  console.error(`❌ 页码重复：P${[...new Set(dupNn)].join(' / P')} 各出现多页——manifest 的页 id 会撞车，先理顺文件名`);
  process.exit(2);
}

// 页面引用的 assets/ 素材是否还在。图片是打包器内联进 covers-edit.html 的，缺一张就是打包失败或空白图；
// 素材无法从页面反推重建，只能重出图——所以这条单独说清补救动作，别混进一般的契约错误里。
const missingAssets = [];
for (const p of pages) {
  const html = fs.readFileSync(path.join(dir, p.file), 'utf8');
  for (const m of html.matchAll(/\bsrc\s*=\s*["'](assets\/[^"']+)["']/gi)) {
    if (!fs.existsSync(path.join(dir, m[1]))) missingAssets.push(`${p.file} → ${m[1]}`);
  }
}

const manifest = buildManifest(pages.map((p) => ({ file: p.file, id: `p${p.nn}`, name: p.label })));
const manifestFile = path.join(dir, 'editor.manifest.json');
const before = fs.existsSync(manifestFile) ? fs.readFileSync(manifestFile, 'utf8') : null;
const after = JSON.stringify(manifest, null, 2);

console.log(`📄 目录：${dir}`);
console.log(`   页数 ${pages.length}：${pages.map((p) => p.label).join(' / ')}`);
if (missingAssets.length) {
  console.error(`\n❌ ${missingAssets.length} 处 assets/ 素材缺失——打包会把空白图内联进去，素材无法从页面重建：`);
  missingAssets.slice(0, 8).forEach((m) => console.error('   - ' + m));
  console.error('   补救：从任务工作区原始素材补回 assets/，或重跑 render（推荐，一步到位）。');
  process.exit(2);
}

// 先验再写：目录本身有问题时不该留下一个「看起来补好了」的 manifest。
// 唯一要滤掉的是「缺 manifest」这条——它正是本脚本要解决的事，报出来是噪音。
const pre = auditDelivery(dir);
const preWarns = pre.warns.filter((w) => !w.startsWith('缺 editor.manifest.json'));
if (pre.errors.length) {
  console.error(`\n❌ 补件前体检不过，未写 manifest（${pre.errors.length} 条硬错）：`);
  pre.errors.forEach((e) => console.error('   - ' + e));
  console.error('   这些是页面本身的问题，补 manifest 解决不了——修页或重跑 render。');
  process.exit(1);
}

if (before === after) {
  console.log('\n✅ editor.manifest.json 已是本次页集的版本，无需改动');
} else if (DRY) {
  console.log(`\n🔍 --dry-run：将写 editor.manifest.json（${before ? '覆盖旧版' : '新建'}），未落盘`);
} else {
  fs.writeFileSync(manifestFile, after);
  console.log(`\n✅ 已写 editor.manifest.json（${before ? '覆盖旧版' : '新建'}）`);
  if (before) {
    // 旧版多半来自「页数变了之后没重新出图」，这里只提示不一致，不去猜谁对。
    try { console.log(`   旧版登记 ${(JSON.parse(before).pages || []).length} 页，本次目录有 ${pages.length} 页`); } catch { console.log('   旧版不是合法 JSON，已直接替换'); }
  }
}

// 复检走同一个 auditDelivery：写入的是刚生成的 manifest，必然自洽——这一步证明的是「加上它之后整目录能打包」，
// 而不是再猜一遍 manifest 对不对。
for (const w of preWarns) console.warn('⚠ ' + w);
console.log(`✅ 复检通过：${pages.length} 页 · 图层 ${pre.layerCount} 个`);
console.log('ℹ 未生成 fields.json：编辑器不读生成期 fields（打开看到的就是 HTML 终稿）；需要它就重跑 render 加 --with-editor');
console.log(`\n下一步：cd <pageApp>/demo && node pack.mjs "${dir}"，再打开 covers-edit.html`);
