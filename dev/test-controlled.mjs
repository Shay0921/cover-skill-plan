#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { createOptions, launchBrowser, closeBrowser, withPage, evaluate } from '../tools/cdp.mjs';
import { runBatch } from '../tools/pipeline.mjs';
import { loadProject, sha256, ROOT } from '../tools/project.mjs';
import { prepareBuild, writeBuild } from '../tools/build.mjs';
import { validateReadyPage } from '../tools/validate.mjs';

const base = path.resolve(process.argv[2] || '');
if (!process.argv[2]) throw new Error('用法: node dev/test-controlled.mjs <新的测试目录>');
fs.mkdirSync(base, { recursive: true });
const opts = createOptions({ block: ['*cdn.jsdelivr.net*'], fontTimeout: 500 });
const pool = {
  thesis: { id: 'h1', text: '受控组件试验。清楚表达。真实素材。保留来源。', evidence: '用于本地组合和检查测试的人工合成文本，不陈述产品事实。', source: '本试验定义' },
  highlights: [], pains: [], hooks: [], data: [], quotes: []
};
// 基座默认 layout:'free'：既有负例只取证语义与通用几何，不受骨架约束；骨架负例在 configure 里显式选档。
const plan = { meta: { style: 'paper-journal', brand: '组合实验', issue: '' }, pages: [{ nn: '01', recipe: 'R-card-01', layout: 'free', intent: '验证检查器', uses: ['h1'] }] };
const text = (id, value = '清楚表达', attrs = '') => `<p class="text-block" data-component="text-block" data-layer="${id}" data-editable="text" data-from="h1" ${attrs}>${value}</p>`;
const phone = id => `<div class="phone" data-component="phone" data-layer="${id}" data-group style="position:absolute;left:0;top:0;width:30cqw;height:59.54cqw"><img class="phone-shot" data-slot="image" data-layer="${id}-screen" src="assets/iphone-frame.png" alt="测试图"><img class="frame-img" data-slot="image" data-layer="${id}-frame" data-decoration src="assets/iphone-frame.png" alt=""></div>`;
const wrap = (body = text('main-copy'), heading = '受控组件试验') => `<div class="p-page" data-artwork data-size="1080x1440" data-recipe="R-card-01"><header class="page-header"><div class="brand" data-layer="brand" data-group><span class="nm" data-layer="brand-name" data-editable="text">组合实验</span></div></header><div class="heading" data-region="head"><h1 class="h1" data-component="h1" data-layer="headline" data-editable="text" data-from="h1">${heading}</h1></div><main class="body"><div class="region grow" data-region="right">${body}</div></main><footer class="footer"><span data-layer="footer-signature" data-editable="text">组合实验</span><span data-numbering>01 / 01</span></footer></div>`;
const baseline = wrap();
const withIssue = (html, value, attrs = 'data-layer="issue-line"') =>
  html.replace('</div></header>', `</div><div class="issue" ${attrs}>${value}</div></header>`);
const withIssueInBody = (html, value) => html.replace('</main>', `<div class="issue" data-layer="issue-line">${value}</div></main>`);
const phoneCell = (id, caption = false) => `<div class="phone-cell">${withPhoneStyle(id)}${caption ? text(`${id}-label`, '豆仓概览') : ''}</div>`;
const withPhoneStyle = id => `<div class="phone" data-component="phone" data-layer="${id}" data-group style="width:100%;height:auto"><img class="phone-shot" data-slot="image" data-layer="${id}-screen" src="assets/iphone-frame.png" alt=""><img class="frame-img" data-slot="image" data-layer="${id}-frame" data-decoration src="assets/iphone-frame.png" alt=""></div>`;
const wallPage = (n, caption = true, cell = true) => `<div class="p-page" data-artwork data-size="1080x1440" data-recipe="R-phone-01"><header class="page-header"><div class="brand" data-layer="brand" data-group><span class="nm" data-layer="brand-name" data-editable="text">组合实验</span></div></header><main class="body"><div class="region grow" data-region="wall"><div class="flow-grid grow" style="grid-template-columns:repeat(${n},minmax(0,1fr));align-content:center">${Array.from({ length: n }, (_, i) => cell ? phoneCell(`wall-phone-${i + 1}`, caption) : withPhoneStyle(`wall-phone-${i + 1}`) + (caption ? text(`wall-phone-${i + 1}-label`, '豆仓概览') : '')).join('')}</div></div></main><footer class="footer"><span data-layer="footer-signature" data-editable="text">组合实验</span><span data-numbering>01 / 01</span></footer></div>`;
const withPhone = (id, width, height) => wrap(`<div class="phone" data-component="phone" data-layer="${id}" data-group style="position:absolute;left:0;top:0;width:${width};height:${height}"><img class="phone-shot" data-slot="image" data-layer="${id}-screen" src="assets/iphone-frame.png" alt=""><img class="frame-img" data-slot="image" data-layer="${id}-frame" data-decoration src="assets/iphone-frame.png" alt=""></div>`);
const pageIn = (recipe, region, body) => wrap(body).replace('data-recipe="R-card-01"', `data-recipe="${recipe}"`).replace('data-region="right"', `data-region="${region}"`);
const darkHtml = html => html.replace('<div class="p-page"', '<div class="p-page dark"');
const serifBlock = '<p class="serif" data-component="serif" data-layer="quote-a" data-editable="text" data-from="h1">受控组件试验</p>';
const stepBlock = '<div class="step" data-component="step" data-layer="step-a" data-group><span class="num" data-layer="step-a-order" data-editable="text" data-from="h1" data-numbering>01</span><div><h2 class="t" data-layer="step-a-title" data-editable="text" data-from="h1">查看素材</h2><p class="d" data-layer="step-a-detail" data-editable="text" data-from="h1">清楚表达</p></div></div>';
// 金句组按组件目录登记的三种形态构造，测试可以逐项抽掉其中一项。
const quoteGroup = ({ hero = true, hl = true, br = true, src = true } = {}) => `<blockquote class="quote${hero ? ' hero' : ''}" data-component="serif" data-layer="quote-a" data-group><p class="serif" data-layer="quote-a-text" data-editable="text" data-from="h1">受控组件${br ? '<br>' : ''}试验${hl ? '<span class="hl">留在这里</span>' : '。'}</p><span class="rule" data-layer="quote-a-rule" data-decoration></span>${src ? '<p class="source" data-layer="quote-a-source" data-editable="text" data-from="h1">清楚表达</p>' : ''}<p class="credit" data-layer="quote-a-credit" data-editable="text" data-from="h1">保留来源</p></blockquote>`;
const baBlocks = ['before', 'after'].map(v => `<section class="ba ${v}" data-component="ba" data-layer="ba-${v}" data-group><h2 class="bt" data-layer="ba-${v}-heading" data-editable="text" data-from="h1">一种选择</h2><ul><li data-layer="ba-${v}-point" data-editable="text" data-from="h1">清楚表达</li></ul></section>`).join('');
const qaBlock = '<section class="qa" data-component="qa" data-layer="reader-question" data-group><h2 class="question" data-layer="question-text" data-editable="text" data-from="h1">读者真正关心什么？</h2><p class="answer" data-layer="answer-text" data-editable="text" data-from="h1">给出有依据的回答。</p></section>';
const ctaBlock = '<p class="cta" data-component="cta" data-layer="next-action" data-editable="text" data-from="h1">从一个小步骤开始</p>';
const results = [];
function fixture(name, html = baseline, change) {
  const dir = path.join(base, name), work = path.join(dir, 'work'), src = path.join(work, 'src'), out = path.join(dir, 'out');
  fs.mkdirSync(src, { recursive: true }); fs.mkdirSync(out, { recursive: true });
  const p = structuredClone(plan), content = structuredClone(pool);
  if (change) change(p, content);
  fs.writeFileSync(path.join(work, '03-plan.json'), JSON.stringify(p, null, 2));
  fs.writeFileSync(path.join(work, '02-pool.json'), JSON.stringify(content, null, 2));
  fs.writeFileSync(path.join(src, 'p01.part.html'), html);
  return { dir, src, out };
}
const inst = await launchBrowser(opts);
async function test(name, html, expected, configure, extra) {
  const f = fixture(name, html, configure);
  if (extra) extra(f);
  const report = await runBatch({ srcDir: f.src, outDir: f.out, inst, browserOptions: opts, noShot: true });
  const errors = [...report.issues, ...report.pages.flatMap(p => p.issues || [])].filter(i => i.level === 'ERROR');
  const pass = expected === null ? report.status === 'passed' : report.status === 'failed' && errors.some(i => `${i.rule} ${i.msg}`.includes(expected));
  results.push({ name, passed: pass, expected: expected || 'passed', status: report.status, errors });
  console.log(`${pass ? 'PASS' : 'FAIL'} ${name}${pass ? '' : ' ' + JSON.stringify(errors)}`);
  return { f, report };
}
// Warnings never block publishing; they must still be produced by the checker.
async function testWarn(name, html, expected, extra, configure) {
  const f = fixture(name, html, configure);
  if (extra) extra(f);
  const report = await runBatch({ srcDir: f.src, outDir: f.out, inst, browserOptions: opts, noShot: true });
  const warnings = [...report.issues, ...report.pages.flatMap(p => p.issues || [])].filter(i => i.level === 'WARN');
  const pass = report.status === 'passed' && warnings.some(i => `${i.rule} ${i.msg}`.includes(expected));
  results.push({ name, passed: pass, expected: `WARN ${expected}`, status: report.status, warnings });
  console.log(`${pass ? 'PASS' : 'FAIL'} ${name}${pass ? '' : ' ' + JSON.stringify(warnings)}`);
}
// 契约级拒绝发生在 loadProject，而不是页面检查：抛出即整个批次中断。
function loadRejectTest(name, html, pattern, configure, mutate, configFile) {
  const f = fixture(name, html, configure);
  const file = configFile ? path.join(ROOT, configFile) : null;
  const before = file ? fs.readFileSync(file, 'utf8') : '';
  const hash = file ? sha256(Buffer.from(before)) : '';
  let message = '';
  try {
    if (file) fs.writeFileSync(file, mutate(before));
    try { loadProject(f.src, f.out); } catch (error) { message = error.message; }
  } finally {
    if (file) {
      fs.writeFileSync(file, before);
      if (sha256(fs.readFileSync(file)) !== hash) throw new Error(`${configFile} 未还原到 ${hash}`);
    }
  }
  const passed = pattern.test(message);
  results.push({ name, passed, expected: `loadProject 拒绝：${pattern.source}`, message, restoredHash: hash.slice(0, 12) });
  console.log(`${passed ? 'PASS' : 'FAIL'} ${name} ${JSON.stringify(message)}`);
}
try {
  await test('atomic-component', baseline, null);
  await test('inline-flex-layout', wrap(text('main-copy', '清楚表达', 'style="display:flex;justify-content:center;align-content:start"')), null);
  await test('natural-wrap', wrap(text('main-copy', '保留来源。'.repeat(12))), null);
  await test('no-heading-region', baseline.replace(/<div class="heading"[\s\S]*?<\/h1><\/div>/, ''), null);
  await test('script', baseline.replace('</main>', '<script>throw new Error("must not run")</script></main>'), 'L0');
  await test('event-attribute', baseline.replace('class="body"', 'class="body" onclick="void(0)"'), 'L0');
  await test('encoded-url', wrap('<img data-slot="image" data-layer="bad-image" src="jav&#x61;script:void(0)">'), 'L0');
  await test('srcdoc', baseline.replace('</main>', '<iframe srcdoc="test"></iframe></main>'), 'L0');
  await test('css-url', wrap(text('main-copy', '清楚表达', 'style="background-image:url(https://example.invalid/no)"')), 'L0');
  await test('css-escaped-url', wrap(text('main-copy', '清楚表达', 'style="background:u\\72l(https://example.invalid/no)"')), 'L0');
  await test('active-svg', baseline.replace('</main>', '<svg><script>void(0)</script></svg></main>'), 'L0');
  await test('traversal', wrap('<img data-slot="image" data-layer="bad-image" src="assets/../private.png">'), 'L0');
  await test('fixed-position', wrap(text('main-copy', '清楚表达', 'style="position:fixed;top:0"')), 'L0');
  await test('missing-provenance', baseline.replace('data-from="h1" >清楚表达', '>清楚表达'), 'L8');
  await test('unknown-source', baseline.replace('data-from="h1" >清楚表达', 'data-from="missing">清楚表达'), 'L8');
  // 孤儿检查落地后，池里非 thesis 资产必须被某页 uses 引用；L10 改用"thesis 不在本页 uses"取证（thesis 豁免孤儿检查）。
  await test('unused-source', baseline, 'L10', p => { p.pages[0].uses = []; });
  await test('unsupported-number', wrap(text('main-copy', '提升999倍')), 'L8');
  await test('duplicate-id', wrap(text('main-copy') + text('main-copy')), 'L9');
  await test('disallowed-component', baseline.replace('data-component="text-block"', 'data-component="qa"'), 'L11');
  await test('disallowed-region', baseline.replace('data-region="right"', 'data-region="wall"'), 'L11');
  await test('nested-components', wrap(`<div data-component="text-block" data-layer="outer" data-group>${text('main-copy')}</div>`), 'L11');
  // 手机都带 .phone-cell 与界面名，让这一例只取证 R2（L19 已在 lint 阶段短路，会顶掉几何检查）。
  await test('two-overlapping-phones', wrap(`<div class="phone-cell">${phone('phone-a')}${text('phone-a-label', '界面甲')}</div><div class="phone-cell">${phone('phone-b')}${text('phone-b-label', '界面乙')}</div>`), 'R2');
  await test('overlapping-text', wrap(text('copy-a', '清楚表达', 'style="position:absolute;top:0;left:0"') + text('copy-b', '真实素材', 'style="position:absolute;top:0;left:0"')), 'R2');
  await test('text-clipped', wrap(text('main-copy', '保留来源。'.repeat(12), 'style="height:2cqw;overflow:hidden"')), 'R3');
  await test('oneline-wrap', wrap(text('main-copy', '保留来源。'.repeat(12), 'data-oneline')), 'R8');
  await test('region-overflow', wrap(text('main-copy', '清楚表达', 'style="position:absolute;top:-10cqw"')), 'R1');
  await test('footer-covered', wrap(text('main-copy', '清楚表达', 'style="position:absolute;bottom:-12cqw"')), 'R1');
  await test('missing-image', wrap('<figure class="shot" data-component="shot" data-layer="missing-shot" data-group><img data-slot="image" data-layer="missing-image" src="assets/missing.png" alt=""></figure>'), '缺少本地素材');
  await test('corrupt-image', wrap('<figure class="shot" data-component="shot" data-layer="corrupt-shot" data-group><img data-slot="image" data-layer="corrupt-image" src="assets/corrupt.png" alt=""></figure>'), 'R4', null, f => {
    fs.mkdirSync(path.join(f.out, 'assets'), { recursive: true });
    fs.writeFileSync(path.join(f.out, 'assets/corrupt.png'), Buffer.from('89504e470d0a1a0a00000000', 'hex'));
  });
  await test('format-mismatch', wrap('<figure class="shot" data-component="shot" data-layer="format-shot" data-group><img data-slot="image" data-layer="format-image" src="assets/fake.jpg" alt=""></figure>'), '扩展名', null, f => {
    fs.mkdirSync(path.join(f.out, 'assets'), { recursive: true });
    fs.writeFileSync(path.join(f.out, 'assets/fake.jpg'), Buffer.from('89504e470d0a1a0a00000000', 'hex'));
  });
  await test('stale-output', baseline, '非本次计划页', null, f => fs.writeFileSync(path.join(f.out, '99.html'), 'historical-do-not-delete'));
  await test('unplanned-source', baseline, '计划外页面', null, f => fs.writeFileSync(path.join(f.src, 'p99.part.html'), baseline));
  await test('missing-plan-page', baseline, '缺少计划页', p => p.pages.push({ ...p.pages[0], nn: '02' }));
  await test('duplicate-plan-page', baseline, '页号重复', p => p.pages.push({ ...p.pages[0] }));
  await test('wrong-style', baseline, 'meta', p => p.meta.style = 'unknown');
  await test('missing-evidence', baseline, 'evidence', (_p, content) => delete content.thesis.evidence);
  const needIssue = p => { p.meta.issue = '第 07 期'; };
  await test('issue-missing-from-skeleton', baseline, 'L6', needIssue);
  await test('issue-mismatch', withIssue(baseline, '第 08 期'), 'L6', needIssue);
  await test('issue-fabricated', withIssue(baseline, '第 07 期'), 'L6');
  await test('issue-outside-skeleton', withIssueInBody(baseline, '第 07 期'), 'L6', needIssue);
  await test('issue-without-layer', withIssue(baseline, '第 07 期', ''), 'L9', needIssue);
  const asInner = p => { p.pages[0].recipe = 'R-note-01'; };
  const innerHtml = baseline.replace('data-recipe="R-card-01"', 'data-recipe="R-note-01"');
  await test('issue-on-inner-page', withIssue(innerHtml, '第 07 期'), '封面系列', p => { asInner(p); p.meta.issue = '第 07 期'; });
  await test('inner-page-without-issue', innerHtml, null, asInner);
  const overlayBlock = '<div class="region" data-region="overlay"><div class="ghost" data-component="ghost" data-layer="background-letter" data-decoration>试</div></div>';
  const ghostHtml = html => html.replace('</footer>', `</footer>${overlayBlock}`);
  const ghostInBody = html => html.replace('</main>', `${overlayBlock}</main>`);
  await test('ghost-on-cover', ghostHtml(baseline), 'L11');
  await test('ghost-on-inner-page', ghostHtml(innerHtml), null, asInner);
  await test('overlay-inside-body', ghostInBody(innerHtml), 'overlay 区域必须是 .p-page 的直接子级', asInner);
  const asWall = p => { p.pages[0].recipe = 'R-phone-01'; };
  await test('phone-count-over-cap', wallPage(4), '最多 3 个', asWall);
  await test('phone-count-at-cap', wallPage(3), null, asWall);
  await test('aspect-ratio-crushed', withPhone('crushed-phone', '30cqw', '40cqw'), 'R10');
  // require / form 都挂在配方级：require 说"这页少了它就不配叫这个配方"，form 说"它得长成组件目录登记过的样子"，两者都不锁摆位、不锁条数。
  const asRecipe = recipe => p => { p.pages[0].recipe = recipe; };
  const requireCases = [
    ['R-step-01', 'step', stepBlock, 'full'],
    ['R-quote-01', 'serif', quoteGroup(), 'full'],
    ['R-compare-01', 'ba', baBlocks, 'full'],
    ['R-qa-01', 'qa', qaBlock, 'full'],
    ['R-close-01', 'cta', ctaBlock, 'full']
  ];
  for (const [recipe, comp, block, region] of requireCases) {
    await test(`require-${comp}-missing`, pageIn(recipe, region, text('main-copy')), `要求本页至少放一个 ${comp}`, asRecipe(recipe));
    await test(`require-${comp}-present`, pageIn(recipe, region, block), null, asRecipe(recipe));
  }
  // 同一配方的另一个允许区域同样满足下限，证明 require 只管这页有没有，不管它摆在哪。
  await test('require-any-allowed-region', pageIn('R-close-01', 'bottom', ctaBlock), null, asRecipe('R-close-01'));
  // any-of 组：组内任一即可。四个带组配方各取证缺失；R-wall-01 审计 #5 收窄为 [["shot"]]，
  // phone-only 由"另一种满足方式"反转为负例；整组不可见取证改走 R-phone-01（require [["phone"]] 同为组形式）。
  await test('anyof-card02-missing', pageIn('R-card-02', 'left', text('main-copy')), 'fcard/phone（任一）', asRecipe('R-card-02'));
  await test('anyof-wall01-missing', pageIn('R-wall-01', 'wall', text('main-copy')), 'shot（任一）', asRecipe('R-wall-01'));
  await test('anyof-list02-missing', pageIn('R-list-02', 'full', text('main-copy')), 'ck/list（任一）', asRecipe('R-list-02'));
  await test('anyof-data01-missing', pageIn('R-data-01', 'full', text('main-copy')), 'bars/ldr/ledger（任一）', asRecipe('R-data-01'));
  await test('wall01-phone-only-rejected', pageIn('R-wall-01', 'wall', `<div class="flow-grid grow" style="grid-template-columns:repeat(3,minmax(0,1fr));align-content:center">${phoneCell('wall-phone-1', true)}</div>`), 'shot（任一）', asRecipe('R-wall-01'));
  await test('anyof-wall01-shot-only', pageIn('R-wall-01', 'wall', '<figure class="shot" data-component="shot" data-layer="wall-shot" data-group><img data-slot="image" data-layer="wall-shot-img" style="flex:none;width:30cqw;height:auto;object-fit:contain" src="assets/iphone-frame.png" alt=""><figcaption class="cap" data-layer="wall-shot-cap" data-editable="text" data-from="h1">清楚表达</figcaption></figure>'), null, asRecipe('R-wall-01'));
  await test('anyof-group-invisible', pageIn('R-phone-01', 'wall', withPhoneStyle('wall-phone-1').replace('class="phone"', 'class="phone" style="opacity:0"')), 'R13', asRecipe('R-phone-01'));
  // form 逐个形态取证：缺哪一项报哪一项；裸 p.serif 立不起整页金句。
  const asP08 = asRecipe('R-quote-01');
  await test('form-hero-missing', pageIn('R-quote-01', 'full', quoteGroup({ hero: false })), '呈现形态 hero', asP08);
  await test('form-marked-missing', pageIn('R-quote-01', 'full', quoteGroup({ hl: false })), '呈现形态 marked', asP08);
  await test('form-split-missing', pageIn('R-quote-01', 'full', quoteGroup({ br: false })), '呈现形态 split', asP08);
  await test('form-plain-serif', pageIn('R-quote-01', 'full', serifBlock), '呈现形态 hero', asP08);
  // B1–B5 加固：隐藏正文与不可见下限兜底、豁免标记的内容边界、品牌与计划一致。
  await test('hidden-body', baseline.replace('<main class="body">', '<main class="body" style="display:none">'), 'R12');
  await test('decoration-with-text-leaf', wrap(text('main-copy') + '<div data-decoration data-layer="deco-smuggle"><span data-editable="text" data-layer="smuggled" data-from="h1">清楚表达</span></div>'), '不得携带文字叶');
  await test('decoration-long-text', wrap(text('main-copy') + '<div data-decoration data-layer="deco-long">超过八个字符的装饰文案</div>'), 'data-decoration 文本超过');
  await test('numbering-long-text', wrap(text('main-copy') + '<span data-numbering data-layer="num-long">超过八个字符的序号文案</span>'), 'data-numbering 只放');
  await test('hidden-display-override', wrap(text('main-copy') + '<div hidden style="display:block">未标记的隐藏文字</div>'), 'L9');
  await test('hidden-without-override', wrap(text('main-copy') + '<div hidden>未标记的隐藏文字</div>'), null);
  await test('brand-mismatch', baseline.replace('data-layer="brand-name" data-editable="text">组合实验', 'data-layer="brand-name" data-editable="text">别的品牌'), '.brand 与计划 meta.brand 不一致');
  await test('require-invisible', pageIn('R-step-01', 'full', stepBlock.replace('class="step"', 'class="step" style="opacity:0"')), 'R13', asRecipe('R-step-01'));
  await test('form-shape-invisible', pageIn('R-quote-01', 'full', quoteGroup().replace('<span class="hl">', '<span class="hl" style="display:none">')), 'R13', asP08);
  // dark 只是同一风格下的配色开关：计划与画布根类必须互相印证。
  await test('dark-class-without-plan', darkHtml(baseline), 'L6');
  await test('dark-plan-without-class', baseline, '缺少 .dark', p => { p.pages[0].dark = true; });
  await test('dark-flag-and-class-agree', darkHtml(baseline), null, p => { p.pages[0].dark = true; });
  // B6 分级文本比对：数字＋单位绑定（L14，跨类别硬错误）、data/quotes 逐字（L15）、其余文本只告警（L16）。
  // 成对取证：编造被拦，逐字/连续片段/合法润色/多来源照常通过。
  const dataPool = (extra = {}) => (p, content) => {
    content.data.push({ id: 'd1', text: '甲功能 50 元，乙功能 100 元', evidence: '原文：甲功能 50 元，乙功能 100 元。', source: '受控测试用例', ...extra });
    p.pages[0].uses = ['h1', 'd1'];
  };
  const quotePool = (extra = {}) => (p, content) => {
    content.quotes.push({ id: 'q1', text: '让表达改变，让证据留下。', evidence: '原文如此。', source: '受控测试用例', ...extra });
    p.pages[0].uses = ['h1', 'q1'];
  };
  const numericHighlight = (p, content) => {
    content.highlights.push({ id: 'n1', text: '共 50 元', evidence: '原文：共 50 元。', source: '受控测试用例' });
    p.pages[0].uses = ['h1', 'n1'];
  };
  const from = (value, ids) => wrap(text('main-copy', value).replace('data-from="h1"', `data-from="${ids}"`));
  await test('b6-fabricated-unit-and-prose', from('效率提升 50 倍', 'd1'), 'L14', dataPool());
  await test('b6-data-mismatch-reported', from('效率提升 50 倍', 'd1'), 'L15', dataPool());
  await test('b6-data-literal', from('甲功能 50 元，乙功能 100 元', 'd1'), null, dataPool());
  await test('b6-data-substring', from('甲功能 50 元', 'd1'), null, dataPool());
  await test('b6-quote-literal', from('让表达改变，让证据留下。', 'q1'), null, quotePool());
  await test('b6-quote-fabricated', from('效率提升十倍', 'q1'), 'L15', quotePool());
  await testWarn('b6-quote-paraphrase-marked', from('换一种说法写这句', 'q1'), 'L15', null, quotePool({ paraphrase: true }));
  await testWarn('b6-prose-polish-warn', wrap(text('main-copy', '完全不相干的另一句话')), 'L16');
  await test('b6-unit-mismatch-on-prose', from('提升 50 倍', 'n1'), 'L14', numericHighlight);
  await test('b6-unit-match-on-prose', from('共 50 元', 'n1'), null, numericHighlight);
  await test('b6-multi-source-no-strict', from('甲功能 50 元', 'd1 n1'), null, (p, content) => {
    dataPool()(p, content); numericHighlight(p, content); p.pages[0].uses = ['h1', 'd1', 'n1'];
  });
  // uses 反向对账（L10）：计划列了页面没用的资产会被打回；写入顺序自由化后，
  // 这是"先写页面后补计划"场景的主要漂移防线。对照：b6-data-literal 等用例 uses 与页面互证通过。
  await test('uses-listed-but-unused', baseline, 'uses 列了资产 d1', (p, content) => {
    content.data.push({ id: 'd1', text: '甲功能 50 元，乙功能 100 元', evidence: '原文：甲功能 50 元，乙功能 100 元。', source: '受控测试用例' });
    p.pages[0].uses = ['h1', 'd1'];
  });
  loadRejectTest('dark-not-boolean', baseline, /dark 只能是 true 或缺省/, p => { p.pages[0].dark = 'yes'; });
  // 契约自检：配方写错时项目加载必须直接拒绝，不允许把矛盾留给页面检查兜底。
  loadRejectTest('require-must-be-allowed', baseline, /require 写了任何区域都没允许的组件/, undefined,
    source => source.replace('"require":["step"]', '"require":["vrt"]'), 'config/recipes.json');
  loadRejectTest('require-belongs-to-recipe', baseline, /仍写着 require：组件下限在配方级/, undefined,
    source => source.replace('"full":{"allow":["step","list","ck","fcard","text-block"]}', '"full":{"allow":["step","list","ck","fcard","text-block"],"require":["step"]}'), 'config/recipes.json');
  loadRejectTest('form-needs-require', baseline, /form 写了不在 require 中的组件/, undefined,
    source => source.replace('"require":["serif"],"form":', '"form":'), 'config/recipes.json');
  loadRejectTest('form-shape-must-exist', baseline, /组件目录没有登记这条 shapes/, undefined,
    source => source.replace('"serif":["hero","marked","split"]', '"serif":["hero","fancy"]'), 'config/recipes.json');
  loadRejectTest('component-shapes-need-directory', baseline, /组件目录没有登记这条 shapes/, undefined,
    source => source.replace('"shapes":{"hero"', '"unused":{"hero"'), 'config/components.json');
  // 孤儿资产与 any-of 组的配置层拒绝：加载即失败，不留给页面检查。
  loadRejectTest('orphan-pool-asset', baseline, /池里存在未被任何页面引用的资产/, (_p, content) => content.highlights.push({ id: 'orphan', text: '没人用的文案', evidence: '负例注入', source: '本试验定义' }));
  loadRejectTest('require-group-empty', baseline, /require 组不能为空/, undefined,
    source => source.replace('"require":[["fcard","phone"]]', '"require":[[]]'), 'config/recipes.json');
  loadRejectTest('require-group-member-must-be-allowed', baseline, /任何区域都没允许的组件 vrt/, undefined,
    source => source.replace('"require":[["fcard","phone"]]', '"require":[["fcard","vrt"]]'), 'config/recipes.json');
  loadRejectTest('require-group-member-must-be-string', baseline, /任何区域都没允许的组件 42/, undefined,
    source => source.replace('"require":[["fcard","phone"]]', '"require":[["fcard",42]]'), 'config/recipes.json');
  await test('bleed-inside-interior-region', wrap(`<div class="phone" data-component="phone" data-layer="interior-bleed" data-bleed data-group style="position:absolute;left:0;top:0;width:30cqw;height:59.54cqw;margin-left:-20cqw"><img class="phone-shot" data-slot="image" data-layer="interior-screen" src="assets/iphone-frame.png" alt=""><img class="frame-img" data-slot="image" data-layer="interior-frame" data-decoration src="assets/iphone-frame.png" alt=""></div>`), 'R1');
  // A1：骨架豁免只覆盖"署名身份"层，页脚口号与品牌里的额外文字仍是内容，必须溯源。
  await test('footer-slogan-untracked', baseline.replace('</footer>', '<span data-layer="footer-slogan" data-editable="text">全网最低价</span></footer>'), 'L8');
  await test('footer-slogan-sourced', baseline.replace('</footer>', '<span data-layer="footer-slogan" data-editable="text" data-from="h1">清楚表达</span></footer>'), null);
  await test('brand-extra-text-untracked', baseline.replace('</div></header>', '<div data-layer="brand-slogan" data-editable="text">全网最低价</div></header>'), 'L8');
  // A2（L17/L18）：外观属性与种子变量由种子给出，本页 style 覆盖即硬错误；未登记的属性名只告警。
  const appearance = { color: '#f00', background: '#0f0', 'background-color': '#0f0', 'font-family': "'宋体'", 'font-size': '5cqw',
    'font-weight': '700', border: '1px solid', 'border-radius': '2cqw', 'box-shadow': '0 0 2px', 'text-shadow': '0 1px 0' };
  for (const [property, value] of Object.entries(appearance))
    await test(`appearance-${property}`, wrap(text('main-copy', '清楚表达', `style="${property}:${value}"`)), 'L17');
  await test('appearance-seed-variable', wrap(text('main-copy', '清楚表达', 'style="--paper:#0f0"')), 'L17');
  await testWarn('inline-unknown-property', wrap(text('main-copy', '清楚表达', 'style="mrgin-top:2cqw"')), 'L18');
  // B6（L19）：同区并排多只手机，每只都要有 .phone-cell 与壳下的界面名。
  // 计划必须写 R-phone-01（wall 区允许 phone/text-block，asWall 见上）：夹具基座先合配方契约，L19 才是唯一拦截理由。
  await test('phone-wall-without-caption', wallPage(2, false), 'L19', asWall);
  await test('phone-wall-without-cell', wallPage(2, true, false), 'L19', asWall);
  // B8：源片段只写 assets/ 相对路径，手写 dataURL 绕过素材登记与来源追溯。
  await test('source-dataurl-image', wrap('<figure class="shot" data-component="shot" data-layer="du-shot" data-group><img data-slot="image" data-layer="du-image" src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==" alt=""></figure>'), 'L0');
  // C14：data-decoration 不能替图片豁免检查——脱离组件根的直接拒绝，在组件内的照样参与越界检查。
  await test('decoration-image-outside-component', wrap(text('main-copy') + '<img data-slot="image" data-layer="loose-deco" data-decoration src="assets/iphone-frame.png" alt="">'), 'L11');
  await test('decoration-image-out-of-bounds', wrap('<figure class="shot" data-component="shot" data-layer="oo-shot" data-group style="position:absolute;left:0;bottom:0;width:20cqw;height:20cqw"><img data-slot="image" data-layer="oo-image" data-decoration src="assets/deco.jpg" alt="" style="position:absolute;left:-10cqw;bottom:0;width:90cqw;height:20cqw;object-fit:cover"></figure>'), 'R1', null, f => {
    fs.mkdirSync(path.join(f.out, 'assets'), { recursive: true });
    fs.copyFileSync(path.resolve(ROOT, '../../skill-tests/assets/shot-overview.jpg'), path.join(f.out, 'assets', 'deco.jpg'));
  });
  // C13：素材缺失的错误必须说清是哪一页，否则批量里只能靠猜。
  await test('missing-image-names-page', baseline, '02: 缺少本地素材', p => p.pages.push({ ...p.pages[0], nn: '02' }), f => fs.writeFileSync(path.join(f.src, 'p02.part.html'),
    wrap('<figure class="shot" data-component="shot" data-layer="m2-shot" data-group><img data-slot="image" data-layer="m2-image" src="assets/nope.png" alt=""></figure>')));
  // A5/B7：plan 契约里两个"看着合法其实静默"的取值在加载期就拒绝。
  loadRejectTest('brand-empty', baseline, /brand 不能是空字符串/, p => { p.meta.brand = ''; });
  loadRejectTest('dark-false-rejected', baseline, /dark 只能是 true 或缺省/, p => { p.pages[0].dark = false; });
  await testWarn('letterboxed-tall-asset', wrap('<figure class="shot" data-component="shot" data-layer="wide-shot" data-group><img data-slot="image" data-layer="wide-image" style="flex:none;width:30cqw;height:12cqw;object-fit:contain" src="assets/tall.jpg" alt=""></figure>'), 'R9', f => {
    fs.mkdirSync(path.join(f.out, 'assets'), { recursive: true });
    fs.copyFileSync(path.resolve(ROOT, '../../skill-tests/assets/shot-overview.jpg'), path.join(f.out, 'assets', 'tall.jpg'));
  });
  // 画面塌陷：素材加载了、窗口也在，但 <img> 量出 0 高。它会被 visible() 摘掉，必须单独报错。
  await test('collapsed-image', wrap('<figure class="shot" data-component="shot" data-layer="flat-shot" data-group><img data-slot="image" data-layer="flat-image" style="aspect-ratio:1/1;flex:none;width:100%;height:0" src="assets/flat.jpg" alt=""><figcaption class="cap" data-layer="flat-caption" data-editable="text" data-from="h1">清楚表达</figcaption></figure>'), 'R11', null, f => {
    fs.mkdirSync(path.join(f.out, 'assets'), { recursive: true });
    fs.copyFileSync(path.resolve(ROOT, '../../skill-tests/assets/shot-overview.jpg'), path.join(f.out, 'assets', 'flat.jpg'));
  });
  // ── 构图骨架（L20/R14）与构图不变量（R15/R16/R18）──
  // L21/L22 不立项：画廊单机无图注（p01/p05/p09/p14/p26/p28/p45）与 cover-bleed 区内无文字（p26）
  // 都是合法构图——多机图注已由 L19 覆盖，出血"是否真贴边"已由 R16 覆盖，再立 caption 规则会误伤画廊。
  const asLayout = (recipe, layout) => p => { p.pages[0].recipe = recipe; p.pages[0].layout = layout; };
  const phoneW = (id, w) => `<div class="phone" data-component="phone" data-layer="${id}" data-group style="width:${w};height:auto"><img class="phone-shot" data-slot="image" data-layer="${id}-screen" src="assets/iphone-frame.png" alt=""><img class="frame-img" data-slot="image" data-layer="${id}-frame" data-decoration src="assets/iphone-frame.png" alt=""></div>`;
  const bleedPhone = (id, w) => phoneW(id, w).replace('data-group', 'data-group data-bleed');
  const colPage = (left, right, { recipe = 'R-card-01', heading = '受控组件试验', leftId = 'left', leftClass = 'region', rightClass = 'region', leftStyle = '', rightStyle = '', swap = false, pageno = true } = {}) => {
    const L = `<div class="${leftClass}" data-region="${leftId}" style="${leftStyle}">${left}</div>`;
    const R = `<div class="${rightClass}" data-region="right" style="${rightStyle}">${right}</div>`;
    return `<div class="p-page" data-artwork data-size="1080x1440" data-recipe="${recipe}"><header class="page-header"><div class="brand" data-layer="brand" data-group><span class="nm" data-layer="brand-name" data-editable="text">组合实验</span></div></header><div class="heading" data-region="head"><h1 class="h1" data-component="h1" data-layer="headline" data-editable="text" data-from="h1">${heading}</h1></div><main class="body"><div class="flow-row grow">${swap ? R + L : L + R}</div></main><footer class="footer"><span data-layer="footer-signature" data-editable="text">组合实验</span>${pageno ? '<span data-numbering>01 / 01</span>' : ''}</footer></div>`;
  };
  // 标题行数负例改走 R-list-01 双栏档（无 counts/carrier 干扰项）：frow-phone 档 headline [1,1]。
  // 空盒复选取证（审计 #2 后 ck 只被 R-card-01 left / R-list 系允许）：ck 挪进左栏，colPage 定义之后才能用。
  await test('empty-checkbox', colPage('<div class="ck" data-component="ck" data-layer="check" data-group><span class="box" data-decoration></span><p class="t" data-layer="check-copy" data-editable="text" data-from="h1">保留来源</p></div>', text('main-copy')), null);
  const stepN = (id, detail) => `<section class="step" data-component="step" data-layer="${id}" data-group><span class="num" data-layer="${id}-order" data-editable="text" data-from="h1" data-numbering>01</span><div><h2 class="t" data-layer="${id}-title" data-editable="text" data-from="h1">查看素材</h2><p class="d" data-layer="${id}-detail" data-editable="text" data-from="h1">${detail}</p></div></section>`;
  const mnBlock = '<aside class="mn" data-component="mn" data-layer="side-note" data-group><h2 class="t" data-layer="side-note-title" data-editable="text" data-from="h1">示例不是教程</h2><p class="d" data-layer="side-note-detail" data-editable="text" data-from="h1">清楚表达</p></aside>';
  const timelinePage = (n, detail) => colPage(Array.from({ length: n }, (_, i) => stepN(`step-${i + 1}`, detail)).join(''), mnBlock, { recipe: 'R-step-01', leftId: 'full', leftClass: 'region grow timeline', leftStyle: 'flex:1', rightStyle: 'flex:1' });
  const shotBlock = (w = '42cqw') => `<figure class="shot" data-component="shot" data-layer="evidence-shot" data-group><img data-slot="image" data-layer="evidence-shot-img" style="flex:none;width:${w};height:auto;object-fit:contain" src="assets/iphone-frame.png" alt=""><figcaption class="cap" data-layer="evidence-shot-cap" data-editable="text" data-from="h1">清楚表达</figcaption></figure>`;
  // L20 静态骨架：缺区域、区域乱序、锁宽区域缺席、件数越界。
  // asLayout 只改 plan，页面 data-recipe 必须同步改写，否则 L6 不一致先炸、几何档校验被跳过（1113 第五轮教训）。
  const asListPage = html => html.replace('data-recipe="R-card-01"', 'data-recipe="R-list-01"');
  await test('skeleton-order-missing-region', asListPage(wrap()), '要求区域 left，本页没有', asLayout('R-list-01', 'frow-phone'));
  await test('skeleton-tracks-missing-region', asListPage(wrap()), '锁了区域 left 的列宽，本页没有该区域', asLayout('R-list-01', 'frow-phone'));
  await test('skeleton-order-wrong-sequence', colPage(text('main-copy'), phoneW('right-phone', '41cqw'), { recipe: 'R-list-01', swap: true }), '要求区域顺序', asLayout('R-list-01', 'frow-phone'));
  await test('skeleton-counts-under', wallPage(2), '要求 phone 3–3 个，实际 2 个', asLayout('R-phone-01', 'trio-labeled'));
  await test('skeleton-counts-over', wallPage(3), '要求 phone 2–2 个，实际 3 个', asLayout('R-phone-01', 'duo-labeled'));
  // R14 几何骨架：列宽占比、载体宽度档、载体缺席、标题行数、锚点缺席。
  await test('skeleton-share-out-of-range', colPage(text('main-copy'), text('side-copy'), { recipe: 'R-list-01', leftStyle: 'flex:1.4' }), '区域 left 列宽占比', asLayout('R-list-01', 'list-text-cover'));
  await test('skeleton-carrier-width', colPage(text('main-copy'), phoneW('right-phone', '30cqw'), { recipe: 'R-list-01' }), '宽 30.0cqw 超出骨架档', asLayout('R-list-01', 'frow-phone'));
  await test('skeleton-carrier-missing', colPage(text('main-copy'), text('side-copy'), { recipe: 'R-list-01' }), '骨架要求区域 right 有可见的 phone', asLayout('R-list-01', 'frow-phone'));
  await test('skeleton-headline-lines', colPage(text('main-copy'), phoneW('right-phone', '41cqw'), { recipe: 'R-list-01', heading: '受控组件<br>试验第三行<br>再来一行' }), '主标题实际 3 行，骨架要求 1–1 行', asLayout('R-list-01', 'frow-phone'));
  await test('skeleton-headline-at-cap', colPage(text('main-copy'), phoneW('right-phone', '41cqw'), { recipe: 'R-list-01' }), null, asLayout('R-list-01', 'frow-phone'));
  await test('skeleton-anchor-missing', timelinePage(4, '清楚表达。'.repeat(6)), '锚点区域 right 没有可见的', asLayout('R-step-01', 'timeline'));
  // 其余配方骨架档：出血档要求 hero 列宽占比 >1（左右出血），普通满宽区域占比 1.0 落档外（R-phone-02）；
  // 双图窗档锁 shot 件数，只放一只即报（R-compare-02）；整幅金句/收束档无载体约束，满宽单组件照常命中（R-quote-01/R-close-01）。
  await test('skeleton-bleed-share', pageIn('R-phone-02', 'hero', shotBlock()), '列宽占比', asLayout('R-phone-02', 'hero-bleed'));
  await test('skeleton-shot-counts', pageIn('R-compare-02', 'full', baBlocks + shotBlock()), '要求 shot 2–2 个', asLayout('R-compare-02', 'shot-ba'));
  await test('skeleton-quote-tier', pageIn('R-quote-01', 'full', quoteGroup()), null, asLayout('R-quote-01', 'annotated'));
  await test('skeleton-closing-tier', pageIn('R-close-01', 'full', ctaBlock), null, asLayout('R-close-01', 'standard'));
  // R15 时间线内部拉伸：少步骤+短内容撑不满行高即报；内容撑满时不报（与有没有手机无关，量的是内容填充）。
  await test('timeline-stretched-slack', timelinePage(3, '清楚表达'), '内部拉伸余量', asLayout('R-step-01', 'free'));
  await test('timeline-content-fills', timelinePage(4, '清楚表达。'.repeat(6)), null, asLayout('R-step-01', 'free'));
  // R16 出血贴边：声明 data-bleed 却没贴到出血边即报；直接子级满宽手机真贴边则通过。
  // 出血机向下伸出画布，页脚只留左侧署名（同画廊 p26）：右侧页码会被出血机盖住，触发 R1。
  await test('bleed-not-touching-edge', colPage(text('main-copy'), `<div>${bleedPhone('bleed-phone', '40cqw')}</div>`, { rightClass: 'region cover-bleed', pageno: false }), '声明 data-bleed 但没有贴到出血边', asLayout('R-card-01', 'free'));
  await test('bleed-touching-edge', colPage(text('main-copy'), bleedPhone('bleed-phone', '100%'), { rightClass: 'region cover-bleed', pageno: false }), null, asLayout('R-card-01', 'free'));
  // R18 页脚单行：署名折行破坏向下出血的单行前提。
  await test('footer-wraps-two-lines', baseline.replace('data-layer="footer-signature" data-editable="text">组合实验', `data-layer="footer-signature" data-editable="text">${'组合实验'.repeat(30)}`), '页脚文字折为');
  // L22 装饰线依赖出处：保 rule 省 source 即报；rule+source 齐全的金句组照常通过（require-serif-present 已覆盖）。
  await test('quote-rule-without-source', pageIn('R-quote-01', 'full', quoteGroup({ src: false })), '保留了分隔线 .rule 却省了出处', asP08);
  // L23 出血区配文：区域挂 .bleed 的出血本身合法（封面手机出血、画面页出血都允许），拦的是"整页只剩图"——
  // head 或 bottom 至少要有一处标题或说明文字；出血区内部的 figcaption 是图的附属，不作数。recipe 用 R-phone-02 + layout free，
  // 让 L23 成为唯一拦截理由（free 不进 L20/R14）。control 证明 head 配文与 bottom 配文都解拦。
  const bleedPage = caption =>
    `<div class="p-page" data-artwork data-size="1080x1440" data-recipe="R-phone-02"><header class="page-header"><div class="brand" data-layer="brand" data-group><span class="nm" data-layer="brand-name" data-editable="text">组合实验</span></div></header>${caption ? '<div class="heading" data-region="head"><h1 class="h1" data-component="h1" data-layer="headline" data-editable="text" data-from="h1">受控组件试验</h1></div>' : ''}<main class="body"><div class="region bleed grow" data-region="hero"><figure class="shot" data-component="shot" data-layer="bleed-shot" data-group><img data-slot="image" data-layer="bleed-shot-img" style="flex:none;width:30cqw;height:auto;object-fit:contain" src="assets/iphone-frame.png" alt=""><figcaption class="cap" data-layer="bleed-shot-cap" data-editable="text" data-from="h1">清楚表达</figcaption></figure></div></main><footer class="footer"><span data-layer="footer-signature" data-editable="text">组合实验</span><span data-numbering>01 / 01</span></footer></div>`;
  await test('bleed-region-without-caption', bleedPage(false), 'L23', asRecipe('R-phone-02'));
  await test('bleed-region-head-caption', bleedPage(true), null, asRecipe('R-phone-02'));
  await test('bleed-region-bottom-caption', bleedPage(false).replace('</main>', `<div class="region" data-region="bottom">${text('bottom-note')}</div></main>`), null, asRecipe('R-phone-02'));
  // 占位符残留（L24）：骨架的 {{槽位}} 只活在配方库，成品页任何位置残留即 FAIL；control 证明替换干净即解拦。
  await test('placeholder-residue-text', wrap(text('h1', '标题{{卖点}}')), 'L24');
  await test('placeholder-residue-attr', wrap(text('h1', '正常文案', 'data-note="{{预留}}"')), 'L24');
  await test('placeholder-clean', wrap(text('h1', '全部替换完成')), null);
  // text-block 弱档是 L17 之下的合法降档通道：class 切档不被外观拦截，照常通过。
  await test('text-block-muted-tier', wrap(text('main-copy').replace('class="text-block"', 'class="text-block muted"')), null);
  // 骨架 schema 与 plan 选档的加载期拒绝：契约写错直接中断，不留给页面检查。
  loadRejectTest('layout-required-when-tiered', baseline, /pages\[\]\.layout 必须显式选一档/, p => { delete p.pages[0].layout; });
  loadRejectTest('layout-unknown-tier', baseline, /pages\[\]\.layout 必须显式选一档/, p => { p.pages[0].layout = 'Z'; });
  loadRejectTest('layout-on-untiered-recipe', baseline, /没有登记骨架/, p => { p.pages[0].recipe = 'R-cover-02'; p.pages[0].layout = 'A'; },
    source => { const j = JSON.parse(source); delete j.recipes['R-cover-02'].layouts; return JSON.stringify(j); }, 'config/recipes.json');
  loadRejectTest('layout-empty-object', baseline, /layouts 是空对象/, undefined,
    source => { const j = JSON.parse(source); j.recipes['R-quote-01'].layouts = {}; return JSON.stringify(j); }, 'config/recipes.json');
  loadRejectTest('layout-null-value', baseline, /layouts 是空对象/, undefined,
    source => { const j = JSON.parse(source); j.recipes['R-quote-01'].layouts = null; return JSON.stringify(j); }, 'config/recipes.json');
  loadRejectTest('layout-name-missing', baseline, /缺少 name\/when/, undefined,
    source => source.replace('"cover-standard":{"name":"等分两栏 · 右机满高","when"', '"cover-standard":{"when"'), 'config/recipes.json');
  loadRejectTest('layout-order-empty', baseline, /order 不能为空/, undefined,
    source => source.replace('"order":["head","left","right"]', '"order":[]'), 'config/recipes.json');
  loadRejectTest('layout-order-unknown-region', baseline, /order 引用了未知区域/, undefined,
    source => source.replace('"order":["head","left","right"]', '"order":["head","left","nowhere"]'), 'config/recipes.json');
  loadRejectTest('layout-tracks-empty', baseline, /tracks 不能为空/, undefined,
    source => source.replace('"tracks":[{"region":"left","share":[0.46,0.50]},{"region":"right","share":[0.46,0.50]}],"headline":[1,1]', '"tracks":[],"headline":[1,1]'), 'config/recipes.json');
  loadRejectTest('layout-share-out-of-range', baseline, /tracks\.share 必须是/, undefined,
    source => source.replace('"share":[0.46,0.50]', '"share":[0.46,1.50]'), 'config/recipes.json');
  loadRejectTest('layout-headline-non-integer', baseline, /headline 必须是整数行数区间/, undefined,
    source => source.replace('"headline":[1,2]', '"headline":[1,2.5]'), 'config/recipes.json');
  loadRejectTest('layout-carrier-unknown-component', baseline, /carriers 引用了未知组件/, undefined,
    source => source.replace('"component":"phone","region":"right","width":[40,42]', '"component":"zzz","region":"right","width":[40,42]'), 'config/recipes.json');
  loadRejectTest('layout-carrier-region-disallowed', baseline, /不被区域 head 允许/, undefined,
    source => source.replace('"component":"phone","region":"right","width":[40,42]', '"component":"phone","region":"head","width":[40,42]'), 'config/recipes.json');
  loadRejectTest('layout-carrier-width-out-of-range', baseline, /carriers\.width 必须是/, undefined,
    source => source.replace('"component":"phone","region":"right","width":[40,42]', '"component":"phone","region":"right","width":[40,200]'), 'config/recipes.json');
  loadRejectTest('layout-counts-unknown-component', baseline, /counts 引用了未知组件/, undefined,
    source => source.replace('"counts":{"phone":[3,3]}', '"counts":{"zzz":[3,3]}'), 'config/recipes.json');
  loadRejectTest('layout-counts-non-integer', baseline, /counts\.step 必须是整数件数区间/, undefined,
    source => source.replace('"counts":{"step":[4,6]}', '"counts":{"step":[4,6.5]}'), 'config/recipes.json');
  loadRejectTest('layout-anchor-unknown-region', baseline, /anchor 引用了未知区域/, undefined,
    source => source.replace('"anchor":{"region":"right"', '"anchor":{"region":"nowhere"'), 'config/recipes.json');
  loadRejectTest('layout-anchor-carrier-disallowed', baseline, /anchor\.carrier 必须是锚点区域允许的组件/, undefined,
    source => source.replace('"carrier":["phone","shot"]', '"carrier":["vrt"]'), 'config/recipes.json');
  // 白名单守卫：内容组件即使被区域允许、也在目录里，也不能进 carriers/counts/anchor——档只锁几何。
  loadRejectTest('layout-carrier-content-component', baseline, /carriers 只能锁定几何载体组件/, undefined,
    source => source.replace('"component":"phone","region":"right","width":[40,42]', '"component":"fcard","region":"right","width":[40,42]'), 'config/recipes.json');
  loadRejectTest('layout-counts-content-component', baseline, /counts 只能锁定几何载体组件/, undefined,
    source => source.replace('"counts":{"phone":[3,3]}', '"counts":{"fcard":[2,3]}'), 'config/recipes.json');
  loadRejectTest('layout-anchor-content-component', baseline, /anchor\.carrier 只能锁定几何载体组件/, undefined,
    source => source.replace('"carrier":["phone","shot"]', '"carrier":["mn"]'), 'config/recipes.json');
  const f = fixture('stale-png-protection');
  const first = await runBatch({ srcDir: f.src, outDir: f.out, inst, browserOptions: opts });
  assert.equal(first.status, 'passed');
  const png = path.join(f.out, '01.png'), hash = sha256(fs.readFileSync(png));
  // 两只手机各自带 .phone-cell 与界面名（合 L19 契约），让这一例像 two-overlapping-phones 一样只取证 R2。
  fs.writeFileSync(path.join(f.src, 'p01.part.html'), wrap(`<div class="phone-cell">${phone('phone-a')}${text('phone-a-label', '界面甲')}</div><div class="phone-cell">${phone('phone-b')}${text('phone-b-label', '界面乙')}</div>`));
  const failed = await runBatch({ srcDir: f.src, outDir: f.out, inst, browserOptions: opts });
  results.push({ name: 'stale-png-protection', passed: failed.status === 'failed' && sha256(fs.readFileSync(png)) === hash && !Object.keys(failed.artifacts).length, expected: 'old PNG retained as historical, failed report has no deliverables', status: failed.status });
  const edited = fixture('edited-output');
  await runBatch({ srcDir: edited.src, outDir: edited.out, inst, browserOptions: opts, noShot: true });
  fs.appendFileSync(path.join(edited.out, '01.html'), '<script>void(0)</script>');
  const checked = await runBatch({ srcDir: edited.src, outDir: edited.out, mode: 'shot', inst, browserOptions: opts });
  results.push({ name: 'edited-output', passed: checked.status === 'failed' && checked.issues.some(i => i.msg.includes('不一致')), expected: 'edited HTML rejected before navigation', status: checked.status });
  // A3+A4：输入错误发生在 newReport 之前，兜底报告仍要走 saveReport 的轮转，并且不能依赖全局 crypto。
  const rotated = fixture('input-error-rotation');
  const work = path.dirname(rotated.src), reportFile = path.join(work, 'qa-report.json');
  assert.equal((await runBatch({ srcDir: rotated.src, outDir: rotated.out, inst, browserOptions: opts, noShot: true })).status, 'passed');
  const firstHash = sha256(fs.readFileSync(reportFile));
  fs.rmSync(path.join(work, '02-pool.json'));
  const savedCrypto = globalThis.crypto;
  let broken = null, brokenError = null;
  try {
    delete globalThis.crypto; // Node < 19 没有全局 crypto：模块必须自带 import。
    broken = await runBatch({ srcDir: rotated.src, outDir: rotated.out, inst, browserOptions: opts, noShot: true });
  } catch (error) { brokenError = error; } finally { globalThis.crypto = savedCrypto; }
  const prevFile = path.join(work, 'qa-report.prev.json');
  results.push({ name: 'input-error-rotation', status: broken?.status,
    passed: !brokenError && broken?.status === 'failed' && sha256(fs.readFileSync(prevFile)) === firstHash
      && JSON.parse(fs.readFileSync(reportFile, 'utf8')).status === 'failed'
      && fs.existsSync(path.join(work, 'qa-summary.json')),
    expected: '输入错误轮转上一轮报告并写出合法 JSON（不因缺少全局 crypto 抛错）', error: brokenError?.message });
  console.log(`${results.at(-1).passed ? 'PASS' : 'FAIL'} input-error-rotation ${JSON.stringify(results.at(-1).error || broken?.issues)}`);
  const identity = fixture('insert-reorder-remove');
  const objects = { alpha: '清楚表达', beta: '真实素材', gamma: '保留来源', delta: '受控组件试验' };
  const variants = [['alpha', 'beta', 'gamma'], ['alpha', 'delta', 'beta', 'gamma'], ['gamma', 'alpha', 'delta', 'beta'], ['gamma', 'alpha', 'beta']];
  for (const order of variants) {
    fs.writeFileSync(path.join(identity.src, 'p01.part.html'), wrap(order.map(id => text(id, objects[id])).join('')));
    const report = await runBatch({ srcDir: identity.src, outDir: identity.out, inst, browserOptions: opts, noShot: true });
    assert.equal(report.status, 'passed');
    const actual = await withPage(inst, pathToFileURL(path.join(identity.out, '01.html')).href, opts, ctx => evaluate(ctx.cdp, ctx.sessionId, 'Object.fromEntries([...document.querySelectorAll(".body [data-editable]")].map(e=>[e.dataset.layer,e.textContent]))'));
    assert.deepEqual(actual, Object.fromEntries(order.map(id => [id, objects[id]])));
  }
  results.push({ name: 'insert-reorder-remove', passed: true, expected: 'authored semantic IDs remain attached to the same text across four source variants', variants });
  const extension = fixture('new-component', baseline.replace('data-component="text-block"', 'data-component="test-callout"'));
  const project = loadProject(extension.src, extension.out);
  project.components.components['test-callout'] = { name: '测试扩展', description: '复用现有文本外观的新普通组件', html: text('main-copy') };
  project.recipes.recipes['R-card-01'].regions.right.allow.push('test-callout');
  fs.writeFileSync(path.join(extension.dir, 'extended-components.json'), JSON.stringify(project.components, null, 2));
  fs.writeFileSync(path.join(extension.dir, 'extended-recipes.json'), JSON.stringify(project.recipes, null, 2));
  const prepared = await prepareBuild(inst, project, opts);
  writeBuild(project, prepared);
  const measured = await withPage(inst, pathToFileURL(project.pages[0].htmlFile).href, opts, validateReadyPage);
  results.push({ name: 'new-component', passed: !measured.issues.some(i => i.level === 'ERROR'), expected: 'isolated registry and allow extension; no checker edit', issues: measured.issues });
} catch (error) {
  results.push({ name: 'harness-error', passed: false, error: error.message });
} finally {
  await closeBrowser(inst);
  const report = { generatedAt: new Date().toISOString(), fontMode: 'CDN blocked intentionally: system-font geometric regression, not production font evidence', total: results.length, passed: results.filter(r => r.passed).length, failed: results.filter(r => !r.passed).length, results };
  fs.writeFileSync(path.join(base, 'test-results.json'), JSON.stringify(report, null, 2));
  console.log(`RESULT ${report.passed}/${report.total} passed`);
  if (report.failed) process.exitCode = 1;
}
