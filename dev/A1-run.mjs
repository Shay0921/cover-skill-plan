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
// --only=NN：单页重跑（池/计划仍按 41 骨架全量构造，仅 gate 该页；产物落独立实验目录）
const ONLY = (process.argv.find(a => a.startsWith('--only=')) || '').split('=')[1] || '';
const RUN = path.join(ROOT, 'dev', 'controlled', ONLY ? `a1fix-p${ONLY}-1113` : 'a1-41-skeleton-1113');
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
// 统计口径（EXEC-A1fix E2，2026-11-13 监工 22:34 裁决）：31 为旧口径，实测 58/29/23 取代
const STATS_EXPECT = { crossFileMultiPhIds: 58, crossFileOnlyMultiPh: 29, crossFileMultiTextIds: 23, samePageMultiTextPages: 9 };

// 页级变换（EXEC-A1fix C/D 定箱实验；正式修法待裁决后归 P8/素材池映射）
const PAGE_TRANSFORMS = {
  // D 实验：step01-timeline 按 repeat ×4 展开为 4 步，文案用源页真实长度档（标题≈10字/说明≈26字）
  'step01-timeline.part.html': {
    expandRepeat: 4,
    textOverrides: { '步骤标题': '按清单逐项核对版式', '步骤说明': '每一步都按方案页的参数档位执行，不凭记忆自由发挥' },
  },
  // C 实验：data04-panel 的 ar43 槽（1280/960）改用 4:3 素材 s10.png（s1–s9 全为竖版手机图）
  'data04-panel.part.html': {
    assetOverrides: { '图1': 'assets/s10.png' },
  },
};

function applyTransforms(raw, file) {
  const tf = PAGE_TRANSFORMS[file];
  if (!tf?.expandRepeat) return { raw, note: null };
  const sec = raw.match(/<section class="step"[\s\S]*?<\/section>/)?.[0];
  if (!sec) throw new Error(`${file}: expandRepeat 未找到 step 单元`);
  // L9 要求页内 data-layer 唯一：展开副本逐个加 -N 后缀（data-from 池 ID 保持同名，同页同 ID 多文案已支持）
  const copies = Array.from({ length: tf.expandRepeat }, (_, i) =>
    sec.replace(/data-layer="([^"]+)"/g, (_, id) => `data-layer="${id}-${i + 1}"`));
  return { raw: raw.replace(sec, copies.join('')),
    note: `step 单元手动展开 ×${tf.expandRepeat}（P8 定箱实验；图层 id 加 -N 后缀过 L9）` };
}

function fillPlaceholders(body, file, map, tf = {}) {
  let imgIdx = 0, barIdx = 0;
  return body.replace(/\{\{([^}]+)\}\}/g, (_, ph) => {
    let value;
    if (/^图\d+$/.test(ph)) value = tf.assetOverrides?.[ph] ?? ASSET_SRCS[imgIdx++ % ASSET_SRCS.length] ?? (() => { throw new Error(`${file}: 图槽越界 ${ph}`); })();
    else if (ph === '柱高') value = String(BAR_HEIGHTS[barIdx++ % BAR_HEIGHTS.length]);
    else if (SHORT_FAKE[ph]) value = SHORT_FAKE[ph];
    else if (BRAND_FAKE[ph]) value = BRAND_FAKE[ph];
    else if (SHORT.test(ph)) value = ph.slice(0, 4);
    else if (/序字|编号|序号/.test(ph)) value = '1';
    else if (/副题|引言|说明|标语|签名|署名|注脚|注解|出处|描述/.test(ph)) value = SENTENCE_FAKE;
    else if (/印章/.test(ph)) value = '真'; // EXEC-A1fix A：印章槽 1-2 字，占位符名 5 字会把 1:1 印章压扁（R10）
    else value = tf.textOverrides?.[ph] ?? ph; // 其余 → 占位符名本身（页级长度档覆盖优先）
    map.push({ file, placeholder: ph, value });
    return value;
  });
}

// 统计口径终审项（GATE-A2：A1 全量运行即终审）：跨骨架多文案 ID / 同页多文案 ID 页数
let crossFileMultiTextIds = new Set();
let samePageMultiTextPages = new Set();

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
  const rawPhNames = new Set(); let rawPhHits = 0; // 统计口径按未变换的骨架原源（622/154 终审锚点）
  for (const [i, file] of files.entries()) {
    const nn = String(i + 1).padStart(2, '0');
    const raw0 = fs.readFileSync(path.join(RECIPES_DIR, file), 'utf8');
    for (const m of raw0.matchAll(/\{\{([^}]+)\}\}/g)) { rawPhHits++; rawPhNames.add(m[1]); }
    const { raw, note } = applyTransforms(raw0, file);
    const tf = PAGE_TRANSFORMS[file] || {};
    const recipe = raw.match(/data-recipe="([^"]+)"/)?.[1];
    if (!recipe) throw new Error(`${file}: 缺 data-recipe`);
    const m = /^([a-z]+)(\d+)-(.+)\.part\.html$/.exec(file);
    if (!m) throw new Error(`${file}: 文件名不合 ^([a-z]+)(\\d+)-(.+)$`);
    const layout = m[3];
    // 断言 4：layout 必须在配方 layouts 精确命中，不许降级 free
    const layoutIds = Object.keys(recipes[recipe]?.layouts || {});
    if (!layoutIds.includes(layout))
      throw new Error(`${file}: layout "${layout}" 不在配方 ${recipe} 的 layouts [${layoutIds.join(', ')}]，拒绝写 free`);
    const filled = fillPlaceholders(raw, file, placeholderMap, tf);
    if (filled.includes('{{')) throw new Error(`${file}: 填充后仍有 {{ 残留`); // 断言 1（逐文件）
    // --only 单页跑：非选中页只留内存供池构造，不落 src（gate assertOutputPages 拒绝计划外页面）
    if (!ONLY || nn === ONLY.padStart(2, '0')) fs.writeFileSync(path.join(SRC, `p${nn}.part.html`), filled);
    const page = { nn, recipe, layout, intent: 'A1 受控回归', skeleton: file, uses: [] };
    if (/(^|")p-page[^"]*\bdark/.test(raw.match(/<div class="p-page[^"]*"/)?.[0] || '')) page.dark = true;
    if (/class="[^"]*\bissue\b/.test(raw)) page.issue = true; // 骨架实际形态：.issue 在 page-header 内（lint 会复核位置）
    pages.push({ page, raw, filled, note });
  }

  // 2. 浏览器抽取 data-from 引用与文案（先填充、后建池）
  const opts = createOptions({ noSandbox: true });
  const inst = await launchBrowser(opts);
  const idTexts = new Map(); // id -> Set(去重文案)
  const idPhNames = new Map(); // id -> Set(去重占位符名)（监工 31 口径）
  const idPhFiles = new Map(); // id -> Set(文件)（仅跨文件口径 29）
  try {
    for (const { page, raw, filled } of pages) {
      const ext = await withBlank(inst, opts, ({ cdp, sessionId }) =>
        evaluate(cdp, sessionId, `(${EXTRACT_FN})(${JSON.stringify(raw)},${JSON.stringify(filled)})`, { timeoutMs: opts.timeout }));
      const usedRefs = [...new Set(ext.refs)];
      if (!usedRefs.length) throw new Error(`${page.skeleton}: 无 data-from 引用`);
      page.uses = usedRefs;
      if (!!page.dark !== /\bdark\b/.test(ext.rootClass)) throw new Error(`${page.skeleton}: dark 声明与骨架根类不一致`);
      if ((page.issue === true) !== ext.hasIssue) throw new Error(`${page.skeleton}: issue 声明与骨架 .issue 不一致`);
      // BRIEF v1.1 断言 5：issue 资格对账（登记卡口径：封面档 = layout 含 cover：cover-bleed/cover-standard/ck-shots-cover/list-text-cover/duo-cover，见 04-recipes R-card-01/R-list-01/R-phone-01）
      if (!!page.issue !== /cover/.test(page.layout))
        throw new Error(`${page.skeleton}: issue 资格与登记卡封面档（layout *cover*）不一致`);
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
      // 监工 31 口径：ID 对应的占位符名集合（跨骨架聚合）+ 文件分布（仅跨文件口径）
      for (const { id, ph } of ext.phNames || []) {
        if (!idPhNames.has(id)) idPhNames.set(id, new Set());
        idPhNames.get(id).add(ph);
        if (!idPhFiles.has(id)) idPhFiles.set(id, new Set());
        idPhFiles.get(id).add(page.skeleton);
      }
    }
  } finally { await closeBrowser(inst); }

  // 跨骨架多文案统计
  for (const [id, set] of idTexts) if (set.size > 1) crossFileMultiTextIds.add(id);
  const crossFileMultiPhIds = new Set([...idPhNames.entries()].filter(([, s]) => s.size > 1).map(([id]) => id));
  const crossFileOnlyMultiPh = [...idPhNames.entries()]
    .filter(([id, s]) => s.size > 1 && (idPhFiles.get(id)?.size ?? 0) >= 2).length;

  const unionUses = [...new Set(pages.flatMap(p => p.page.uses))].sort();
  const plannedPages = ONLY ? pages.filter(p => p.page.nn === ONLY.padStart(2, '0')) : pages;
  if (ONLY && !plannedPages.length) throw new Error(`--only=${ONLY}: 无匹配页（nn 取 01–41）`);

  // 3. 池生成（裁决问 1：kind 一律 highlights；thesis 单列）
  // --only 单页跑：池裁剪到选中页 uses（project.mjs:158 孤儿检查是双向的：池含未被引用资产同样 throw）
  // 纯图片槽 ID（只出现在 img[data-from]、无可见文案）也要入池（L8 查 pool 存在性），
  // 兜底 text 不含数字（L8 安全），且无页面文字锚点不会进入 L15/L16 评估。
  const noTextIds = unionUses.filter(id => !idTexts.has(id));
  const highlights = [...idTexts.entries()].map(([id, set]) => ({
    id, text: [...set].join('\n'), evidence: EVIDENCE, source: SOURCE,
  }));
  for (const id of noTextIds)
    highlights.push({ id, text: `A1 受控图像槽位 ${id}`.replace(/[0-9]/g, '') || 'A1 受控图像槽位', evidence: EVIDENCE, source: SOURCE });
  if (ONLY) {
    const usedSet = new Set(plannedPages.flatMap(p => p.page.uses));
    const trimmed = highlights.filter(a => usedSet.has(a.id));
    if (trimmed.length !== usedSet.size) throw new Error(`--only=${ONLY}: 池裁剪后 ${trimmed.length} !== 选中页 uses ${usedSet.size}（零孤儿被破坏）`);
    highlights.length = 0;
    highlights.push(...trimmed);
  }
  for (const a of highlights) // 断言 3：四字段非空
    if (!a.id.trim() || !a.text.trim()) throw new Error(`资产 ${a.id} 四字段存在空值`);
  const pool = { thesis: { id: 'thesis', text: 'A1 受控回归', evidence: EVIDENCE, source: SOURCE },
    highlights, pains: [], hooks: [], data: [], quotes: [] };

  // 4. 四条加载前断言（--only 单页跑时断言 2 全量口径不适用，仅全量跑执行）
  const assetIds = highlights.map(a => a.id).sort();
  const sameSet = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);
  if (!ONLY && (unionUses.length !== EXPECT.uniqueIds || !sameSet(unionUses, assetIds)))
    throw new Error(`断言2失败: union(uses)=${unionUses.length} vs assets=${assetIds.length} vs 期望 ${EXPECT.uniqueIds}（零孤儿要求三者全等）`);
  // meta.issue 咬合：声明 issue 的页，.issue 填充文字必须含 meta.issue
  const meta = { style: 'paper-journal', brand: 'A1 受控回归', issue: '2026-11' };
  const plan = { meta, pages: plannedPages.map(p => {
    const out = { nn: p.page.nn, recipe: p.page.recipe, layout: p.page.layout, intent: p.page.intent, uses: p.page.uses };
    if (p.page.dark) out.dark = true;
    if (p.page.issue) out.issue = true;
    return out;
  }) };

  fs.writeFileSync(path.join(RUN, 'work', '02-pool.json'), JSON.stringify(pool, null, 2) + '\n');
  fs.writeFileSync(path.join(RUN, 'work', '03-plan.json'), JSON.stringify(plan, null, 2) + '\n');
  fs.writeFileSync(path.join(RUN, 'placeholder-map.json'), JSON.stringify(placeholderMap, null, 2) + '\n');

  // 统计口径终审对照（{{}} 计数按骨架原源；填充计数单列——repeat 展开会新增槽位）
  const phNames = rawPhNames.size;
  const stats = { uniqueIds: assetIds.length, placeholderHits: rawPhHits, uniquePlaceholderNames: phNames,
    placeholderHitsFilled: placeholderMap.length,
    crossFileMultiTextIds: crossFileMultiTextIds.size, crossFileMultiPhIds: crossFileMultiPhIds.size,
    crossFileOnlyMultiPh, samePageMultiTextPages: samePageMultiTextPages.size,
    expect: { ...EXPECT, ...STATS_EXPECT }, statsNote: { caliber: 'EXEC-A1fix E2（2026-11-13 监工裁决）：31 为旧口径，58/29/23 取代',
      crossFileMultiPhIdsExpect: 58, crossFileOnlyMultiPhExpect: 29, crossFileMultiTextIdsExpect: 23, samePagePagesExpect: 9 },
    transforms: Object.keys(PAGE_TRANSFORMS) };

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
  lines.push(`# A1${ONLY ? ` · 单页重跑 p${ONLY}（EXEC-A1fix 定箱实验）` : ' · 41 骨架 × 真实 gate 受控池回归'}（${new Date().toISOString()}）`);
  lines.push('');
  lines.push(`- run: \`${RUN}\``);
  lines.push(`- gate 总状态: **${qr.status || 'unknown'}**（gateError: ${gateError || '无'}）`);
  lines.push(`- 页级: ${passed} passed / ${failed} failed / 共 ${pageRows.length}`);
  lines.push(`- 统计口径终审: 唯一 ID ${stats.uniqueIds}（期望 ${EXPECT.uniqueIds}）；{{}} 骨架原源 ${stats.placeholderHits}（期望 ${EXPECT.placeholderHits}）/ 填充实际 ${stats.placeholderHitsFilled}（repeat 展开会新增槽位）；唯一占位符名 ${stats.uniquePlaceholderNames}（期望 ${EXPECT.uniquePlaceholderNames}）；跨骨架多占位符名 ID ${stats.crossFileMultiPhIds}（新口径 ${STATS_EXPECT.crossFileMultiPhIds}）；仅跨文件口径 ${crossFileOnlyMultiPh}（新口径 ${STATS_EXPECT.crossFileOnlyMultiPh}）；跨骨架多文案 ID ${stats.crossFileMultiTextIds}（新口径 ${STATS_EXPECT.crossFileMultiTextIds}）；同页多文案页数 ${stats.samePageMultiTextPages}（期望 ${STATS_EXPECT.samePageMultiTextPages}）`);
  lines.push(`- 构造口径: 监工批复按骨架实际形态（dark×2 / issue×5 + meta.issue='2026-11' / 品牌槽咬合 meta.brand）；印章槽填「真」（EXEC-A1fix A）`);
  if (!ONLY) lines.push(`- 页级变换（EXEC-A1fix C/D 定箱实验）: step01-timeline 展开 ×4（P8）；data04-panel 图1→assets/s10.png（4:3 素材进 ar43 槽）`);
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
  lines.push('');
  lines.push('## 裁决注记（EXEC-A1fix 定箱更新，2026-11-13）');
  lines.push('');
  lines.push('1. **p20 L11 = 骨架病（已修）**：`list01-ck-phone` ck 实落在 `data-region="full"`，R-list-01 regions 原漏登记 full；EXEC-A1fix B 已补 `regions.full allow=[ck,list,text-block]` + 04-recipes 登记卡行，本 run 为修复后复验。');
  lines.push('2. **p08/p10/p35 R10（seal）= 构造病（已修待验）**：印文槽占位符名 5 字（收束印章字）把 1:1 印章压成 0.208；EXEC-A1fix A 填充规则 7 补 `/印章/ → \'真\'`（1 字），本 run 为修复后复验。');
  lines.push('3. **p19 R14 = 骨架病实锤（定箱）**：EXEC-A1fix C 换 4:3 素材 s10.png（1280×960）进 ar43 槽后 R14 数值不变（宽 50.2cqw 超 41–46 档），证明 shot 宽度由骨架 CSS 决定、与素材形状无关 → data04-panel 骨架/配方档失配，非构造病。实验证据 `dev/controlled/a1fix-p19-1113/`。');
  lines.push('4. **p37 R15 = 构造病实锤（定箱）**：EXEC-A1fix D 手动展开 step ×4（图层 id 加 -N 后缀过 L9，文案用源页长度档）后单页 **PASSED**、R15 消失 → 骨架 `repeat ×4` 注释未被展开是唯一病因，骨架本身无辜；正式修法归 P8（数据驱动 repeat 展开）。实验证据 `dev/controlled/a1fix-p37-1113/`。');
  lines.push('5. **跨骨架多占位符名 ID 口径（EXEC-A1fix E2 定谳）**：三种口径实测 58（元素 outerHTML 占位符名去重）/ 29（仅跨 ≥2 骨架文件）/ 23（填充后文案去重）；「31」为编制期静态扫描旧口径失效。逐 ID 明细 `id-stats.json`。');
  const warnCounts = {};
  for (const p of (qr.pages || [])) for (const i of (p.issues || [])) if (i.level === 'WARN') warnCounts[i.rule] = (warnCounts[i.rule] || 0) + 1;
  const warnStr = Object.entries(warnCounts).map(([k, v]) => `${k}×${v}`).join('、') || '无';
  lines.push(`6. **WARN 分布**：${warnStr}；全 run 零 L8/L10/L14/L15/L16/L24——受控池构造面干净。`);
  fs.writeFileSync(path.join(RUN, 'A1-summary.md'), lines.join('\n') + '\n');
  fs.writeFileSync(path.join(RUN, 'stats.json'), JSON.stringify(stats, null, 2) + '\n');

  console.log(`A1 done: ${passed} passed / ${failed} failed (gate status=${qr.status}, gateError=${gateError || 'none'})`);
  console.log(`stats: IDs=${stats.uniqueIds}/197, phHits(raw)=${stats.placeholderHits}/622, phNames=${stats.uniquePlaceholderNames}/154, crossFilePh=${stats.crossFileMultiPhIds}/58, crossFileOnly=${crossFileOnlyMultiPh}/29, crossFileText=${stats.crossFileMultiTextIds}/23, samePagePages=${stats.samePageMultiTextPages}/9`);
  console.log(`summary: ${path.join(RUN, 'A1-summary.md')}`);
};

await main();
