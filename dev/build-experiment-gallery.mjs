#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { readJSON, ROOT } from '../tools/project.mjs';

const base = path.resolve(process.argv[2] || '');
if (!process.argv[2]) throw new Error('用法: node dev/build-experiment-gallery.mjs <已通过 gate 的试验目录>');
const plan = JSON.parse(fs.readFileSync(path.join(base, 'work/03-plan.json')));
const qa = JSON.parse(fs.readFileSync(path.join(base, 'work/qa-report.json')));
if (qa.status !== 'passed' || qa.artifacts.png?.length !== plan.pages.length) throw new Error('需要本轮完整 gate 成功及全部 PNG');
// 演示点注记由夹具生成器写出：卡片要说清"这一页在演示什么"，不能只把 intent 换一种说法。
const notes = JSON.parse(fs.readFileSync(path.join(base, 'work/fixture-notes.json')));
const noteByPage = new Map(notes.pages.map(n => [n.nn, n]));
if (noteByPage.size !== plan.pages.length || plan.pages.some(p => !noteByPage.get(p.nn)?.target))
  throw new Error('fixture-notes.json 与本轮计划页不一一对应，每张卡片都要有演示点');
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
// 配方筛选按 ID 数字序排列（P01→P12），不按首次出现——首次出现顺序会跟着页序漂移。
const recipes = [...new Set(plan.pages.map(p => p.recipe))]
  .sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)));
// 计数行光说"显示几张"没有语义：这一屏属于哪个配方、配方给这些页下了什么硬性下限，要写在同一行。
const { components: catalogue } = readJSON(path.join(ROOT, 'config/components.json'));
const { recipes: allRecipes } = readJSON(path.join(ROOT, 'config/recipes.json'));
const compName = id => catalogue[id]?.name || id;
// 骨架档现在是 plan 必填字段：卡片要标出本页落在哪一档，自由构图页标 free。归档旧计划无 layout 时留空。
const tierLabel = p => {
  if (p.layout === 'free') return '自由构图';
  const t = allRecipes[p.recipe]?.layouts?.[p.layout];
  return t ? `${p.layout} 档 · ${t.name}` : '';
};
const summaryOf = recipe => {
  if (recipe === '全部') {
    const floors = recipes.filter(r => allRecipes[r].require?.length).length;
    const tiers = recipes.reduce((n, r) => n + Object.keys(allRecipes[r].layouts || {}).length, 0);
    return `${plan.pages.length} 张实际出图 · ${recipes.length} 个配方 · 骨架 ${tiers} 档 · 深色配色 ${plan.pages.filter(p => p.dark === true).length} 张 · 带组件下限的配方 ${floors} 个`;
  }
  const spec = allRecipes[recipe], pages = plan.pages.filter(p => p.recipe === recipe);
  const dark = pages.filter(p => p.dark === true).length;
  // require 条目：字符串逐一点名；id 组写成"名/名（任一）"，浏览器验收按同一份名单核对。
  const requireParts = (spec.require || []).map(entry => Array.isArray(entry)
    ? `至少放一个 ${entry.map(compName).join('/')}（任一）`
    : `至少各放一个 ${compName(entry)}`);
  const tierList = Object.entries(spec.layouts || {}).map(([lid, t]) => `${lid} ${t.name}`);
  const parts = [`${spec.name}：${spec.intent}`,
    requireParts.length ? `每页${requireParts.join('；')}` : '无组件下限，各区只给允许范围与数量上限',
    ...Object.entries(spec.form || {}).map(([comp, shapes]) => `${compName(comp)}须呈${shapes.map(s => `${s}（${catalogue[comp]?.shapes?.[s]?.desc || s}）`).join('、')}`),
    tierList.length ? `骨架档 ${tierList.join(' / ')}` : '无骨架档',
    `本筛 ${pages.length} 张${dark ? `（深色对照 ${dark} 张）` : ''}`];
  return parts.join(' · ');
};
const summaries = JSON.stringify(Object.fromEntries(['全部', ...recipes].map(r => [r, summaryOf(r)]))).replace(/</g, '\\u003c');
const filters = ['全部', ...recipes].map((r, i) => `<button type="button" data-filter="${esc(r)}" aria-pressed="${i === 0}">${esc(r === '全部' ? '全部' : `${r} · ${allRecipes[r].name}`)}</button>`).join('');
const cards = plan.pages.map(p => {
  const demo = noteByPage.get(p.nn);
  const tier = tierLabel(p);
  return `<article data-recipe="${esc(p.recipe)}" data-layout="${esc(p.layout || '')}" data-html="out/${esc(p.nn)}.html"><div class="preview"><a class="still" href="out/${esc(p.nn)}.html" target="_blank" rel="noopener"><img src="out/${esc(p.nn)}.png" alt="${esc(p.intent)}" loading="lazy" width="1080" height="1440"></a></div><div class="label"><span>${esc(p.nn)} · ${esc(p.recipe)}${p.dark ? ' · 深色配色' : ''}</span><a href="out/${esc(p.nn)}.png" target="_blank" rel="noopener">PNG</a></div>${tier ? `<div class="tier">${esc(tier)}</div>` : ''}<h2>${esc(p.intent)}</h2><p class="demo"><b>演示</b>${esc(demo.target)}</p></article>`;
}).join('\n');

// 画廊只展示本轮实际出图，不再挂旧模板参照区；旧模板目录已于 2026-11-08 清理。
fs.writeFileSync(path.join(base, 'index.html'), `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>受控组合试验 · paper-journal</title><style>
:root{color-scheme:light;font-family:"Microsoft YaHei",sans-serif;color:#29251e;background:#ece7de}*{box-sizing:border-box}body{margin:0;padding:44px 5vw}header,main,footer{max-width:1100px;margin:auto}small{letter-spacing:.16em;color:#9c4e31}h1{font-size:clamp(28px,4vw,48px);margin:12px 0}p{line-height:1.8;color:#746c62}nav{display:flex;gap:8px;flex-wrap:wrap;margin:28px 0 12px}button{border:1px solid #c9c0b2;background:transparent;border-radius:100px;padding:9px 15px;color:inherit;cursor:pointer}button[aria-pressed=true]{background:#29251e;color:#fff;border-color:#29251e}button:focus-visible,a:focus-visible{outline:3px solid #c0562f;outline-offset:3px}#count{font-size:13px;color:#756c5f;margin-bottom:6px}#count-note{line-height:1.7;color:#5f5850;margin:0 0 24px;max-width:72ch}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:30px}article{min-width:0}article[data-recipe][hidden]{display:none}img{display:block;width:100%;height:auto}.preview .still{display:block}
.preview{position:relative;aspect-ratio:3/4;overflow:hidden;box-shadow:0 8px 25px #17151218;border-radius:5px}
.preview iframe{position:absolute;left:0;top:0;width:1080px;height:1440px;border:0;transform-origin:0 0;transform:scale(var(--k,.23));visibility:hidden}
.demo{font-size:12px;line-height:1.7;margin:2px 0 0;color:#5f5850}.demo b{display:inline-block;font-weight:600;color:#8b4a31;margin-right:6px;letter-spacing:.08em}
.tier{display:inline-block;margin-top:8px;font-size:12px;font-weight:600;color:#fff;background:#8b4a31;padding:3px 11px;border-radius:100px;letter-spacing:.03em}
.live iframe{visibility:visible}.live .still{visibility:hidden}
#theme{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:0 0 10px}#theme b{font-size:13px;font-weight:500;color:#756c5f}
#theme-note{font-size:13px;margin:0 0 18px}code{font-size:.92em;background:#dcd5c8;padding:1px 5px;border-radius:4px}
.preview[data-blocked]::after{content:'跨文档换色被浏览器拦截：请用本地服务打开画廊';position:absolute;left:0;right:0;bottom:0;padding:10px;background:#29251ecc;color:#fff;font-size:12px}.label{display:flex;justify-content:space-between;align-items:center;margin-top:14px;font-size:12px;color:#8b4a31}.label a{color:inherit}h2{font-size:14px;line-height:1.8;font-weight:500;margin:6px 0}footer{margin:40px auto 0;border-top:1px solid #c9c0b2;padding-top:20px;font-size:12px;color:#746c62}footer a{color:inherit}
</style></head><body><header><small>PAPER JOURNAL / CONTROLLED COMPOSITION</small><h1>固定风格，不固定表达。</h1><p>${plan.pages.length} 张实际出图，覆盖 ${recipes.length} 个配方。每张卡片下方写着我这一页要演示什么：组件替换、条数增减、分组与排列、配色开关。配方给下限（<code>require</code>）、形态（<code>form</code>）与骨架档（<code>layouts</code>）；卡片上的棕色徽章是本页落定的骨架档，摆位细节仍由本页内容决定。点击卡片打开对应 HTML，用上方按钮筛选同一配方。<br>这是布局与检查机制试验，不是产品宣传稿；合成数字仅用于图表测试。</p><nav aria-label="配方筛选">${filters}</nav><nav id="theme" aria-label="配色切换"><b>配色</b><button type="button" data-theme="light" aria-pressed="true">浅色 · PNG 实图</button><button type="button" data-theme="dark" aria-pressed="false">深色 · 实时 HTML</button></nav><p id="theme-note" hidden>深色只作用于这一列实时 HTML（给画布根加 <code>.dark</code>，与计划里 <code>dark:true</code> 走同一组种子变量）；PNG 仍是 gate 通过时的浅色实图，不会被改写。用 <code>file://</code> 打开时浏览器禁止跨文档换色，请改用 <code>node dev/serve-controlled.mjs</code> 起本地服务。</p><div id="count" role="status"></div><div id="count-note" role="status"></div></header><main>${cards}</main><footer>本轮 gate：${esc(qa.runId)} · <a href="work/qa-report.json">检查报告</a> · <a href="work/editor.manifest.json">坐标快照</a> · <a href="work/_sheet.png">完整总览</a><p>坐标快照不是可拖拽编辑器；字体加载状态与实际使用字体记录在检查报告中。</p></footer><script>
const buttons=[...document.querySelectorAll('[data-filter]')],cards=[...document.querySelectorAll('article[data-recipe]')],themeButtons=[...document.querySelectorAll('[data-theme]')];const SUM=${summaries};let theme='light';
const rescale=()=>{for(const card of cards){const box=card.querySelector('.preview');if(box)card.style.setProperty('--k',String(box.clientWidth/1080));}};
function paint(card){const box=card.querySelector('.preview');if(!box)return;
 if(theme==='dark'&&!card.hidden){if(!box.querySelector('iframe')&&!box.dataset.blocked){const frame=document.createElement('iframe');frame.title=card.dataset.html+' 深色实时预览';frame.loading='lazy';frame.src=card.dataset.html;frame.addEventListener('load',()=>{try{frame.contentDocument.querySelector('[data-artwork]').classList.add('dark');}catch{box.dataset.blocked='1';box.classList.remove('live');frame.remove();}});box.append(frame);}box.classList.add('live');}
 else box.classList.remove('live');}
function setTheme(value){theme=value;for(const button of themeButtons)button.setAttribute('aria-pressed',String(button.dataset.theme===value));document.querySelector('#theme-note').hidden=value==='light';for(const card of cards)paint(card);rescale();}
function filter(value){let count=0;for(const card of cards){card.hidden=value!=='全部'&&card.dataset.recipe!==value;if(!card.hidden)count++;paint(card);}for(const button of buttons)button.setAttribute('aria-pressed',String(button.dataset.filter===value));document.querySelector('#count').textContent='显示 '+count+' / '+cards.length+' 张';document.querySelector('#count-note').textContent=SUM[value]||'';rescale();}
for(const button of buttons)button.addEventListener('click',()=>filter(button.dataset.filter));
for(const button of themeButtons)button.addEventListener('click',()=>setTheme(button.dataset.theme));
new ResizeObserver(rescale).observe(document.querySelector('main'));
filter('全部');
</script></body></html>`);
console.log(path.join(base, 'index.html'));
