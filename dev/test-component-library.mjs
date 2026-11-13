#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from '../tools/project.mjs';
import { gate } from '../tools/gate.mjs';

const base = path.resolve(process.argv[2] || '');
if (!process.argv[2]) throw new Error('用法: node dev/test-component-library.mjs <新的测试目录>');
const src = path.join(base, 'work/src'), out = path.join(base, 'out');
fs.mkdirSync(src, { recursive: true });
const components = JSON.parse(fs.readFileSync(path.join(ROOT, 'config/components.json'))).components;
const recipes = JSON.parse(fs.readFileSync(path.join(ROOT, 'config/recipes.json'))).recipes;
const pages = [], cases = [], catalogue = [];
const inst = (id, prefix) => components[id].html
  .replaceAll('assets/shot.jpg', 'assets/iphone-frame.png')
  .replace(/data-layer="([^"]+)"/g, (_, value) => `data-layer="${prefix}${value}"`);
const regionOf = (spec, comp, exclude) => Object.entries(spec.regions).find(([name, rule]) => rule.allow.includes(comp) && !exclude.includes(name))?.[0];
for (const [id, component] of Object.entries(components)) {
  // placement:"catalogue" 的组件只登记造法，没有任何配方在区域里放行它，构建不出合法标准实例页，本轮只在目录层核对，跳过出图实测。
  if (component.placement === 'catalogue') { catalogue.push(id); continue; }
  const nn = String(pages.length + 1).padStart(2, '0');
  // 挑允许本组件、且配方级 require 连带最少的配方：require 现在挂在配方上，若要求别的组件就得各补一个实例才能构成合法页。
  // require 条目是 id 组时：本组件在组内即已满足，否则任取组内一员作连带（配置校验保证每个成员都有允许区域）。
  let best;
  for (const [recipe, spec] of Object.entries(recipes)) {
    const region = Object.entries(spec.regions).find(([, rule]) => rule.allow.includes(id))?.[0];
    if (!region) continue;
    const collateral = (spec.require || []).flatMap(entry => {
      const group = Array.isArray(entry) ? entry : [entry];
      return group.includes(id) ? [] : [group[0]];
    });
    // 连带数相同时优先无 form 的配方：目录实测的是默认标准实例，带 form 的配方（如 P08 要 serif hero）
    // 默认实例未必满足形态，会构造出非法页；无 form 的配方（如 P12 要 cta）默认实例即可满足。
    const better = !best || collateral.length < best.collateral.length
      || (collateral.length === best.collateral.length && !spec.form && best.spec.form);
    if (better) best = { recipe, spec, region, collateral };
    if (!collateral.length) break;
  }
  if (!best) throw new Error(`组件无允许区域: ${id}`);
  const { recipe, spec, region, collateral } = best;
  // id 自己的区域 + 每个被 require 的组件各占一个允许它的区域；head/overlay 只在需要时才用。
  const spots = [{ region, comp: id }];
  const used = [region];
  for (const comp of collateral) {
    const r = regionOf(spec, comp, used) || regionOf(spec, comp, []);
    used.push(r);
    spots.push({ region: r, comp });
  }
  // R12 要求正文至少一个可见组件：head/overlay 组件的实测页补一个标准 text-block 落在正文区，否则正文为空。
  let filler = null;
  if (!spots.some(s => s.region !== 'head' && s.region !== 'overlay')) {
    filler = 'text-block';
    spots.push({ region: regionOf(spec, filler, []), comp: filler });
  }
  const title = `<h1 class="h1" data-component="h1" data-layer="library-title" data-editable="text" data-from="h1">${component.name}</h1>`;
  const headSpot = spots.find(s => s.region === 'head');
  const overlaySpot = spots.find(s => s.region === 'overlay');
  const head = headSpot ? inst(headSpot.comp, 'head-') : title;
  const body = spots.filter(s => s.region !== 'head' && s.region !== 'overlay')
    .map(s => `<div class="region grow" data-region="${s.region}">${inst(s.comp, s.comp === id ? '' : `${s.comp}-`)}</div>`).join('');
  const overlay = overlaySpot ? `<div class="overlay" data-region="overlay">${inst(overlaySpot.comp, 'overlay-')}</div>` : '';
  // 页眉页脚照种子骨架的署名层写：brand-seal/brand-name/brand-tag 与 footer-signature/page-number。
  // 免检的只有这几层署名身份，收窄后的 lint 不再放过 .brand/.footer 里的其他文字。
  fs.writeFileSync(path.join(src, `p${nn}.part.html`), `<div class="p-page" data-artwork data-size="1080x1440" data-recipe="${recipe}"><header class="page-header"><div class="brand" data-layer="brand" data-group><span class="seal" data-layer="brand-seal" data-editable="text">目</span><div><div class="nm" data-layer="brand-name" data-editable="text">组件目录实测</div></div></div></header><div class="heading" data-region="head">${head}</div><main class="body">${body}</main>${overlay}<footer class="footer"><span data-layer="footer-signature" data-editable="text">标准实例</span><span class="pageno" data-layer="page-number" data-editable="text" data-numbering>${nn}</span></footer></div>`);
  // 目录页只实测单个组件的标准造法，不演示任何骨架档：显式 free 退出骨架几何，仍受通用几何规则约束。
  // uses 按页面实际 data-from 抽取，不写死 ['h1','d1']——L10 已双向对账，列了没用的资产会被打回。
  const pageHtml = fs.readFileSync(path.join(src, `p${nn}.part.html`), 'utf8');
  const usedRefs = [...new Set([...pageHtml.matchAll(/data-from="([^"]+)"/g)].flatMap(m => m[1].split(/[\s,，]+/)).filter(Boolean))];
  pages.push({ nn, recipe, layout: 'free', intent: `实测 ${component.name}（${id}）的标准实例`, uses: usedRefs });
  cases.push({ nn, component: id, recipe, region, collateral, filler });
}
const asset = (id, text) => ({ id, text, evidence: '用于组件契约测试的合成文案与数值，不是产品事实。', source: '组件目录原始示例' });
// d1 是 data 类，L15 要求上版文字是资产 text 的逐字或连续片段。目录里 bars/ldr/ledger 的原始实例
// 仍保留演示文案（"比较口径"、"甲/乙"、"指标名称"、"口径标签"、"180"、"分钟 → 30 分钟"…），
// 所以合成资产把这些片段都按序收进 text，证明标准实例能被真实资产支撑；目录实例的组件名挂 h1 仍只会产生 L16 告警，不阻断。
fs.writeFileSync(path.join(base, 'work/02-pool.json'), JSON.stringify({ thesis: asset('h1', '组件目录标准示例文案'), highlights: [], pains: [], hooks: [], data: [asset('d1', '比较口径 甲50，乙100。指标名称 指标口径与适用范围。口径标签 一句口径说明 180 分钟 → 30 分钟')], quotes: [] }, null, 2));
fs.writeFileSync(path.join(base, 'work/03-plan.json'), JSON.stringify({ meta: { style: 'paper-journal', brand: '组件目录实测', issue: '' }, pages }, null, 2));
// 画廊构建器要求每页一句"演示点"：写清标准实例落在哪个配方哪个区域、require 连带了谁，不是把 intent 换个说法。
fs.writeFileSync(path.join(base, 'work/fixture-notes.json'), JSON.stringify({ pages: cases.map(c => ({
  nn: c.nn,
  target: `${components[c.component].name}（${c.component}）标准实例落在 ${c.recipe} 的 ${c.region} 区`
    + (c.collateral.length ? `；为满足配方下限连带实测 ${c.collateral.map(id => `${components[id].name}（${id}）`).join('、')}` : '；本配方对该组件无连带下限')
    + (c.filler ? '；head 组件页补一个正文 text-block，保证正文区有可见组件（R12）' : ''),
})) }), null, 2);
const report = await gate(src, out, { noShot: true, browserOptions: { block: ['*cdn.jsdelivr.net*'], fontTimeout: 500 } });
const failures = report.pages.filter(p => p.issues.some(i => i.level === 'ERROR'));
fs.writeFileSync(path.join(base, 'component-results.json'), JSON.stringify({ status: report.status, cases, catalogue, failures, report: path.join(base, 'work/qa-report.json') }, null, 2));
console.log(JSON.stringify({ status: report.status, measured: report.pages.filter(p => p.status === 'passed').length, total: cases.length, catalogue, failures, issues: report.issues }, null, 2));
if (report.status !== 'passed') process.exitCode = 1;
