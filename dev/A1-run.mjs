// A1 驱动：41 骨架 × 真实 gate 受控池构造（规格：dev/A1-BRIEF.md）
// 用法: node dev/A1-run.mjs
// 2026-11-13 监工批复的规格偏差（骨架实际形态口径，BRIEF diff 建议随回报提出）：
//   ① dark 骨架（compare01-v2-dark / note01-dark）→ pages[].dark:true，否则 L6 构造性误报 ×2；
//   ② 带 .issue 的 5 张封面档 → pages[].issue:true + meta.issue='2026-11'（.issue 内即 {{刊期年月}}），
//      否则 L6 构造性误报 ×5（BRIEF 原文 issue:'' 会让 5 页必然报错）；
//   ③ 品牌槽特殊填充 {{品牌名称}}→'A1 受控回归'、{{品牌印章字}}→'A1'，否则 meta.brand 不在 .brand
//      文字里，L6 构造性误报 ×41。
import fs from 'node:fs';
import path from 'node:path';
import { gate } from '../tools/gate.mjs';
import { createOptions, launchBrowser, closeBrowser, withBlank, evaluate } from '../tools/cdp.mjs';
import { readJSON } from '../tools/project.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const RECIPES_DIR = path.join(ROOT, 'dev', 'recipes');
const ASSETS_SRC = path.join(ROOT, 'dev', 'cases', 'assets');
const RUN = path.join(ROOT, 'dev', 'controlled', 'a1-41-skeleton-1113');
const SRC = path.join(RUN, 'work', 'src');
const OUT = path.join(RUN, 'out');

// 假文字形状规则（复用 dev/_sc/render-selfcheck.mjs:18-23）
const SHORT = /主标题|标题|金句文本|刊期/;
const SHORT_FAKE = { '主标题前段': '一句话', '标题高亮': '高亮', '主标题后段': '收尾', '封面主标题前段': '一句话', '封面高亮词': '高亮', '封面主标题后段': '收尾', '金句文本': '一句值得记住的话', '刊期年月': '2026-11', '刊期号': '第 07 期' };
// 监工批复的构造口径补充：品牌槽必须与 meta.brand 互相咬合（L6 校验 .brand 包含 meta.brand）
const BRAND_FAKE = { '品牌印章字': 'A1', '品牌名称': 'A1 受控回归' };
const SENTENCE_FAKE = '这是一段占位说明，用于核对折行密度';
const BAR_HEIGHTS = [50, 100, 75, 25];
const ASSET_SRCS = ['s1.png', 's2.png', 's3.png', 's4.png', 's5.png', 's6.png', 's7.png', 's8.png', 's9.png']
  .map(f => `assets/${f}`);
const EVIDENCE = 'A1 受控合成文案，用于骨架 gate 回归，不陈述产品事实。';
const SOURCE = '本试验定义';
const EXPECT = { uniqueIds: 197, placeholderHits: 622, uniquePlaceholderNames: 154 };

// 统计口径终审项（GATE-A2：A1 全量运行即终审）：跨骨架多文案 ID / 同页多文案 ID 页数
let crossFileMultiTextIds = new Set();
let samePageMultiTextPages = new Set();

function fillPlaceholders(body, file, map) {
  let imgIdx = 0, barIdx = 0;
  return body.replace(/\{\{([^}]+)\}\}/g, (_, ph) => {
    let value;
    if (/^图\d+$/.test(ph)) value = ASSET_SRCS[imgIdx++ % ASSET_SRCS.length] ?? (() => { throw new Error(`${file}: 图槽越界 ${ph}`); })();
    else if (ph === '柱高') value = String(BAR_HEIGHTS[barIdx++ % BAR_HEIGHTS.length]);
    else if (SHORT_FAKE[ph]) value = SHORT_FAKE[ph];
    else if (BRAND_FAKE[ph]) value = BRAND_FAKE[ph];
    else if (SHORT.test(ph)) value = ph.slice(0, 4);
    else if (/序字|编号|序号/.test(ph)) value = '1';
    else if (/副题|引言|说明|标语|签名|署名|注脚|注解|出处|描述/.test(ph)) value = SENTENCE_FAKE;
    else value = ph; // 其余 → 占位符名本身
    map.push({ file, placeholder: ph, value });
    return value;
  });
}

// 浏览器内真实 DOMParser 抽取：filled 取 data-from 引用与可见文本；raw 取每 ID 的占位符名（监工 31 口径）
const EXTRACT_FN = `
  (rawHtml, filledHtml) => {
    const doc = new DOMParser().parseFromString(filledHtml, 'text/html');
    const refs = [], texts = [];
    for (const el of doc.querySelectorAll('[data-from]')) {
      const id = el.getAttribute('data-from');
      refs.push(id);
      const t = (el.textContent || '').replace(/\\s+/g, ' ').trim();
      if (t) texts.push({ id, text: t });
    }
    const rawDoc = new DOMParser().parseFromString(rawHtml, 'text/html');
    const phNames = [];
    for (const el of rawDoc.querySelectorAll('[data-from]')) {
      const id = el.getAttribute('data-from');
      for (const m of el.outerHTML.matchAll(/\\{\\{([^}]+)\\}\\}/g)) phNames.push({ id, ph: m[1] });
    }
    return { refs, texts, phNames, rootClass: doc.querySelector('.p-page')?.className || '',
             hasIssue: !!doc.querySelector('.page-header .issue') };
  }`;

const main = async () => {
  // 0. 全新 run 目录（gate 的 assertOutputPages 拒绝历史产物）
  fs.rmSync(path.join(RUN, 'work'), { recursive: true, force: true });
  fs.rmSync(path.join(RUN, 'out'), { recursive: true, force: true });
  fs.mkdirSync(path.join(SRC, 'assets'), { recursive: true });
  fs.mkdirSync(OUT, { recursive: true });
  for (const f of fs.readdirSync(ASSETS_SRC)) fs.copyFileSync(path.join(ASSETS_SRC, f), path.join(SRC, 'assets', f));

  const recipes = readJSON(path.join(ROOT, 'config', 'recipes.json')).recipes;
  const files = fs.readdirSync(RECIPES_DIR).filter(f => f.endsWith('.part.html')).sort();
  if (files.length !== 41) throw new Error(`骨架应为 41 个，实际 ${files.length}`);

  // 1. 填充 + 计划构造信息采集（dark / issue 按骨架实际形态）
  const placeholderMap = [];
  const pages = [];
  for (const [i, file] of files.entries()) {
    const nn = String(i + 1).padStart(2, '0');
    const raw = fs.readFileSync(path.join(RECIPES_DIR, file), 'utf8');
    const recipe = raw.match(/data-recipe="([^"]+)"/)?.[1];
    if (!recipe) throw new Error(`${file}: 缺 data-recipe`);
    const m = /^([a-z]+)(\d+)-(.+)\.part\.html$/.exec(file);
    if (!m) throw new Error(`${file}: 文件名不合 ^([a-z]+)(\\d+)-(.+)$`);
    const layout = m[3];
    // 断言 4：layout 必须在配方 layouts 精确命中，不许降级 free
    const layoutIds = Object.keys(recipes[recipe]?.layouts || {});
    if (!layoutIds.includes(layout))
      throw new Error(`${file}: layout "${layout}" 不在配方 ${recipe} 的 layouts [${layoutIds.join(', ')}]，拒绝写 free`);
    const filled = fillPlaceholders(raw, file, placeholderMap);
    if (filled.includes('{{')) throw new Error(`${file}: 填充后仍有 {{ 残留`); // 断言 1（逐文件）
    fs.writeFileSync(path.join(SRC, `p${nn}.part.html`), filled);
    const page = { nn, recipe, layout, intent: 'A1 受控回归', skeleton: file, uses: [] };
    if (/(^|")p-page[^"]*\bdark/.test(raw.match(/<div class="p-page[^"]*"/)?.[0] || '')) page.dark = true;
    if (/class="[^"]*\bissue\b/.test(raw)) page.issue = true; // 骨架实际形态：.issue 在 page-header 内（lint 会复核位置）
    pages.push({ page, raw, filled });
  }

  // 2. 浏览器抽取 data-from 引用与文案（先填充、后建池）
  const opts = createOptions({ noSandbox: true });
  const inst = await launchBrowser(opts);
  const idTexts = new Map(); // id -> Set(去重文案)
  const idPhNames = new Map(); // id -> Set(去重占位符名)（监工 31 口径）
  try {
    for (const { page, raw, filled } of pages) {
      const ext = await withBlank(inst, opts, ({ cdp, sessionId }) =>
        evaluate(cdp, sessionId, `(${EXTRACT_FN})(${JSON.stringify(raw)},${JSON.stringify(filled)})`, { timeoutMs: opts.timeout }));
      const usedRefs = [...new Set(ext.refs)];
      if (!usedRefs.length) throw new Error(`${page.skeleton}: 无 data-from 引用`);
      page.uses = usedRefs;
      if (!!page.dark !== /\bdark\b/.test(ext.rootClass)) throw new Error(`${page.skeleton}: dark 声明与骨架根类不一致`);
      if ((page.issue === true) !== ext.hasIssue) throw new Error(`${page.skeleton}: issue 声明与骨架 .issue 不一致`);
      // 同页多文案统计：同 ID 在本页出现 ≥2 种不同文案
      const perId = new Map();
      for (const t of ext.texts) {
        if (!perId.has(t.id)) perId.set(t.id, new Set());
        perId.get(t.id).add(t.text);
      }
      for (const [id, set] of perId) {
        if (set.size > 1) samePageMultiTextPages.add(page.nn);
        if (!idTexts.has(id)) idTexts.set(id, new Set());
        for (const t of set) idTexts.get(id).add(t);
      }
      // 监工 31 口径：ID 对应的占位符名集合（跨骨架聚合）
      for (const { id, ph } of ext.phNames || []) {
        if (!idPhNames.has(id)) idPhNames.set(id, new Set());
        idPhNames.get(id).add(ph);
      }
    }
  } finally { await closeBrowser(inst); }

  // 跨骨架多文案统计
  for (const [id, set] of idTexts) if (set.size > 1) crossFileMultiTextIds.add(id);
  const crossFileMultiPhIds = new Set([...idPhNames.entries()].filter(([, s]) => s.size > 1).map(([id]) => id));

  const unionUses = [...new Set(pages.flatMap(p => p.page.uses))].sort();

  // 3. 池生成（裁决问 1：kind 一律 highlights；thesis 单列）
  // 纯图片槽 ID（只出现在 img[data-from]、无可见文案）也要入池（L8 查 pool 存在性），
  // 兜底 text 不含数字（L8 安全），且无页面文字锚点不会进入 L15/L16 评估。
  const noTextIds = unionUses.filter(id => !idTexts.has(id));
  const highlights = [...idTexts.entries()].map(([id, set]) => ({
    id, text: [...set].join('\n'), evidence: EVIDENCE, source: SOURCE,
  }));
  for (const id of noTextIds)
    highlights.push({ id, text: `A1 受控图像槽位 ${id}`.replace(/[0-9]/g, '') || 'A1 受控图像槽位', evidence: EVIDENCE, source: SOURCE });
  for (const a of highlights) // 断言 3：四字段非空
    if (!a.id.trim() || !a.text.trim()) throw new Error(`资产 ${a.id} 四字段存在空值`);
  const pool = { thesis: { id: 'thesis', text: 'A1 受控回归', evidence: EVIDENCE, source: SOURCE },
    highlights, pains: [], hooks: [], data: [], quotes: [] };

  // 4. 四条加载前断言
  const assetIds = highlights.map(a => a.id).sort();
  const sameSet = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);
  if (unionUses.length !== EXPECT.uniqueIds || !sameSet(unionUses, assetIds))
    throw new Error(`断言2失败: union(uses)=${unionUses.length} vs assets=${assetIds.length} vs 期望 ${EXPECT.uniqueIds}（零孤儿要求三者全等）`);
  // meta.issue 咬合：声明 issue 的页，.issue 填充文字必须含 meta.issue
  const meta = { style: 'paper-journal', brand: 'A1 受控回归', issue: '2026-11' };
  const plan = { meta, pages: pages.map(p => {
    const out = { nn: p.page.nn, recipe: p.page.recipe, layout: p.page.layout, intent: p.page.intent, uses: p.page.uses };
    if (p.page.dark) out.dark = true;
    if (p.page.issue) out.issue = true;
    return out;
  }) };

  fs.writeFileSync(path.join(RUN, 'work', '02-pool.json'), JSON.stringify(pool, null, 2) + '\n');
  fs.writeFileSync(path.join(RUN, 'work', '03-plan.json'), JSON.stringify(plan, null, 2) + '\n');
  fs.writeFileSync(path.join(RUN, 'placeholder-map.json'), JSON.stringify(placeholderMap, null, 2) + '\n');

  // 统计口径终审对照
  const phHits = placeholderMap.length;
  const phNames = new Set(placeholderMap.map(e => e.placeholder)).size;
  const stats = { uniqueIds: assetIds.length, placeholderHits: phHits, uniquePlaceholderNames: phNames,
    crossFileMultiTextIds: crossFileMultiTextIds.size, crossFileMultiPhIds: crossFileMultiPhIds.size,
    samePageMultiTextPages: samePageMultiTextPages.size,
    expect: EXPECT, statsNote: { crossFileTextIdsExpect: 31, crossFilePhIdsExpect: 31, samePagePagesExpect: 9 } };

  // 5. 真实 gate 全链（几何失败不短路；runBatch 末尾对失败页 throw，报告已落盘）
  let gateError = null, report = null;
  try { report = await gate(SRC, OUT); } catch (e) { gateError = e.message; }
  if (!report) { try { report = readJSON(path.join(RUN, 'work', 'qa-report.json')); } catch { /* 兜底报告由 runBatch 落盘 */ } }

  // 6. A1-summary.md
  const qr = report || {};
  const pageRows = (qr.pages || []).map(p => {
    const errs = (p.issues || []).filter(i => i.level === 'ERROR');
    const first = errs[0];
    return { nn: p.nn, status: p.status, rules: errs.map(e => e.rule), first: first ? `${first.rule}: ${first.msg}` : '' };
  });
  const passed = pageRows.filter(r => r.status === 'passed').length;
  const failed = pageRows.filter(r => r.status === 'failed').length;
  const skeletonBox = ['L0', 'L1', 'L6', 'L9', 'L11', 'L17', 'L18', 'L19', 'L21', 'L23', 'L25'];
  const poolBox = ['L8', 'L10', 'L14', 'L15', 'L16', 'L24'];
  const binOf = rule => skeletonBox.includes(rule) ? '骨架病' : poolBox.includes(rule) ? '构造病' : /^R\d+$/.test(rule) ? '骨架几何病' : '待判';
  const lines = [];
  lines.push('# A1 · 41 骨架 × 真实 gate 受控池回归（' + new Date().toISOString() + '）');
  lines.push('');
  lines.push(`- run: \`${RUN}\``);
  lines.push(`- gate 总状态: **${qr.status || 'unknown'}**（gateError: ${gateError || '无'}）`);
  lines.push(`- 页级: ${passed} passed / ${failed} failed / 共 ${pageRows.length}`);
  lines.push(`- 统计口径终审: 唯一 ID ${stats.uniqueIds}（期望 ${EXPECT.uniqueIds}）；{{}} 出现 ${stats.placeholderHits}（期望 ${EXPECT.placeholderHits}）；唯一占位符名 ${stats.uniquePlaceholderNames}（期望 ${EXPECT.uniquePlaceholderNames}）；跨骨架多占位符名 ID ${stats.crossFileMultiPhIds}（监工实测 31）；跨骨架多文案 ID ${stats.crossFileMultiTextIds}（文案口径，填充后同形文案会并拢，≤31 属预期）；同页多文案页数 ${stats.samePageMultiTextPages}（监工实测 9）`);
  lines.push(`- 构造口径: 监工批复按骨架实际形态（dark×2 / issue×5 + meta.issue='2026-11' / 品牌槽咬合 meta.brand）；BRIEF diff 建议随回报提出`);
  lines.push('');
  lines.push('| nn | skeleton | recipe/layout | status | ERROR 规则 | 分箱初判 | 首错 |');
  lines.push('|---|---|---|---|---|---|---|');
  for (const r of pageRows) {
    const pg = pages.find(x => x.page.nn === r.nn)?.page;
    const bins = [...new Set(r.rules.map(binOf))].join('/') || '—';
    lines.push(`| ${r.nn} | ${pg?.skeleton || ''} | ${pg?.recipe}/${pg?.layout} | ${r.status} | ${r.rules.join(',') || '—'} | ${bins} | ${r.first.replace(/\|/g, '\\|').slice(0, 120)} |`);
  }
  lines.push('');
  lines.push('> 分箱口径：L0/L1/L6/L9/L11/L17-L21/L23/L25=骨架病（静态结构）；L8/L10/L14/L15/L16/L24=构造病（池/计划）；R*=骨架几何病（几何档失配，待监工终审归箱）。失败只登记不修（GATE-A2 §3）。');
  fs.writeFileSync(path.join(RUN, 'A1-summary.md'), lines.join('\n') + '\n');
  fs.writeFileSync(path.join(RUN, 'stats.json'), JSON.stringify(stats, null, 2) + '\n');

  console.log(`A1 done: ${passed} passed / ${failed} failed (gate status=${qr.status}, gateError=${gateError || 'none'})`);
  console.log(`stats: IDs=${stats.uniqueIds}/197, phHits=${stats.placeholderHits}/622, phNames=${stats.uniquePlaceholderNames}/154, crossFilePh=${stats.crossFileMultiPhIds}/31, crossFileText=${stats.crossFileMultiTextIds}/<=31, samePagePages=${stats.samePageMultiTextPages}/9`);
  console.log(`summary: ${path.join(RUN, 'A1-summary.md')}`);
};

await main();
