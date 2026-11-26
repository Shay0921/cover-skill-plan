// 自由组合页静态校验（layout: custom/composed-* + layoutBase）
// 定位：custom/ 下两条路都查——有 layoutBase 的走本模块组合页规则（checkComposed），
//   无 layoutBase 的走 checkCustomBasics（根三件套 / 禁区 / 内联 style / data-layer 唯一）。
//   图片两边都查，且与 render 同源（shared/image.mjs 的 checkImgTags）——否则「单跑绿、出图红」
//   会从图片这一项重新长回来。系统槽的静态检查在 checkComposed 内部（scanSysTags）。
// 边界：本模块只做 markup / plan 字符串级检查。字号档（需 computedStyle）属 CDP 阶段，
//   不在这里假装校验——未实现项由 composedNotices() 一次性自曝（见 COMPOSED-MODE §7）。
// 规则真源：references/COMPOSED-MODE.md §2/§3/§4/§5/§6/§7；文档与代码冲突时先改文档再改这里。

import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import { rootOf, maskStyleBlocks } from './shared/markup.mjs';
import { checkImgTags } from './shared/image.mjs';
import { plainCss, scanDeclarations } from './shared/css.mjs';
import { scanSysTags, checkPlaceholderHosts } from './shared/sys-slots.mjs';
import { extractPageCss, checkPageCss } from './page-css.mjs';

// 已实测副作用、可作 layoutBase 的骨架（COMPOSED-MODE §2）。必须是常量而不是推导：
// style.css 里有 `.nNN .content` 的骨架 29 个，其中 18 个未做副作用实测，按「有 .content 即可」推导会静默放行。
export const LAYOUT_BASES = ['n01', 'n10', 'n11', 'n12', 'n14', 'n15', 'n18', 'n20', 'n21', 'n23', 'n24'];

// 结构类白名单。`.content` 在 style.css 里没有裸定义（32 条 `.nNN .content` 规则，覆盖 29 个骨架），
// 派生法会把它判成私有类；四件套又强制它存在，故必须显式豁免。
const STRUCT_CLASSES = ['artwork-page', 'paper-noise', 'brand-top', 'after-hero', 'content', 'pg-footer'];

// 填充两枚类：定义在 style.css 共享段（.fill-grow / .fill-sink），与 COMPOSED-MODE §4.1 同步。
// 只在本模块内消费（render 不需要这份表），不 export——多一个导出就多一条没人维护的对外契约。
const COMPOSED_FILL_CLASSES = ['fill-grow', 'fill-sink'];

// 骨架类型决定「要不要填充声明」，三档（按 `.nNN .content` 的实际规则分类，勿凭直觉）：
//   center = 有 justify-content:center，内容天然居中、上下留白是设计意图 → 不要求，写了反而破坏居中
//   column = flex 纵列且顶对齐，内容少就堆在顶部 → 必须声明填充
//   grid   = 行高 1fr 均分 → 不要求；写 .fill-grow 是空操作（flex 不作用于 grid item）
const SKELETON_KIND = {
  n01: 'center',
  n11: 'column', n12: 'column', n14: 'column', n20: 'column', n21: 'column', n23: 'column', n24: 'column',
  n10: 'grid', n15: 'grid', n18: 'grid',
};

// 取指定类的元素在 markup 里的「第一层子元素」：class 列表 + 子树是否有内容。
// 为什么要真解析一层：判断「flex:1 是不是写在 .content 的直系子元素上」——
// 横排里的 .rd-arm{flex:1} 是等分，写在同一份 CSS 里，只看「有没有 flex:1」会把它当成纵向填充放行。
const VOID_TAGS = new Set(['img', 'br', 'hr', 'input', 'source', 'path', 'circle', 'rect', 'line', 'polyline', 'polygon', 'use', 'stop', 'ellipse']);
function directChildrenOf(markup, cls) {
  const tagRe = /<(\/?)([a-zA-Z][\w:-]*)((?:"[^"]*"|'[^']*'|[^>"'])*?)(\/?)>/g;
  const clsOf = (attrs) => ((/class\s*=\s*["']([^"']*)["']/.exec(attrs) || [, ''])[1]).trim().split(/\s+/).filter(Boolean);
  let m; let depth = 0; let started = false; let cur = null; let lastEnd = 0;
  const out = [];
  while ((m = tagRe.exec(markup))) {
    const closing = !!m[1]; const tag = m[2].toLowerCase(); const attrs = m[3]; const selfClose = !!m[4];
    const gap = markup.slice(lastEnd, m.index);
    lastEnd = tagRe.lastIndex;
    if (started && cur && gap.trim()) cur.hasContent = true;   // 标签之间的文本算内容
    if (!started) {
      if (!closing && clsOf(attrs).includes(cls)) { started = true; depth = 1; }
      continue;
    }
    if (closing) {
      depth--;
      if (depth === 1) { out.push(cur); cur = null; }
      else if (depth === 0) { if (cur) out.push(cur); break; }
      continue;
    }
    if (VOID_TAGS.has(tag) || selfClose) {
      if (depth === 1) out.push({ cls: clsOf(attrs), hasContent: true });
      else if (cur) cur.hasContent = true;
      continue;
    }
    if (depth === 1) {
      if (cur) out.push(cur);
      cur = { cls: clsOf(attrs), hasContent: false };
    } else if (cur) cur.hasContent = true;
    depth++;
  }
  if (cur) out.push(cur);
  return out;
}

// 某类名在页内 CSS 里是否带 flex:1 / flex-grow:1（选择器整条命中该类，避免 .a .b 误伤）。
// 走 shared/css 的声明级解析，不另写一套花括号扫描——同一份 CSS 只该有一个解析器。
function classGrows(css, cls) {
  const selRe = new RegExp(`\\.${cls}(?![\\w-])`);
  return scanDeclarations(css).some((d) => selRe.test(d.sel)
    && (d.prop === 'flex' || d.prop === 'flex-grow') && /^1\b/.test(d.value));
}

// data-role 合法值（components.md §0.1）。只校验「值合法 + 主标题唯一且档位匹配」，不强制全页标注。
// page-title-compact 是密集页变体：内容多、条目密时标题走 7.2 档，别硬撑 9.3 把正文挤出去。
const ROLES = ['cover-title', 'page-title', 'page-title-compact', 'closing-quote', 'body', 'label', 'num'];
const TITLE_ROLES = ['cover-title', 'page-title', 'page-title-compact', 'closing-quote'];

// 强制角色 → 字号令牌（components.md §0.1）。**只写令牌名，不写值**——令牌「值即名」
// （--fs-9-3 就是 9.3cqw），值从名字反解、再回查 :root 有没有这个令牌，改档时这里不用跟着改。
// 反过来若把 10 / 9.3 抄进来，就成了第二真源，改档后校验器会拿旧值误杀。
const ROLE_TOKEN = {
  'cover-title': '--fs-10',
  'page-title': '--fs-9-3',
  'page-title-compact': '--fs-7-2',
  'closing-quote': '--fs-9-3',
};

// 容差 ±0.05cqw（≈0.54px）：cqw↔px 是 10.8 倍线性关系，浏览器不给浮点留更大空间。
const ROLE_FS_TOLERANCE = 0.05;

// 「值即名」反解：`--fs-9-3` → 9.3、`--fs-10` → 10；不合规则返回 null。
// 档位反解只此一处——派生档集与角色对位都调它，不在两处各写一遍正则。
function tierOfToken(token) {
  const m = /^--fs-([0-9]+(?:-[0-9]+)?)$/.exec(token);
  if (!m) return null;
  const v = Number(m[1].replace(/-/g, '.'));
  return Number.isFinite(v) ? v : null;
}

// fail 7 · 全量字号扫描：节点 computedStyle 字号 ∈ :root 的 18 档关闭集。
// 档位从 CSS 现场派生（不抄数字），注释里的豁免单独列；只想拿「字号档」这一类，不碰行高等。
function collectFontSizeTiers(cssText) {
  const tiers = new Set();
  for (const block of cssText.match(/:root\s*\{([^}]*)\}/g) || []) {
    for (const m of block.matchAll(/(--fs-[\w-]+)\s*:/g)) {
      const v = tierOfToken(m[1]);
      if (v !== null) tiers.add(v);
    }
  }
  return [...tiers].sort((a, b) => b - a);
}

// 判定全量扫描结果。items = [{ cqw, tag, cls, text, exempt }]（来自 render 的 evaluate）。
// exempt 由 evaluate 按三类豁免打标：svgPx / zero / meta，这里直接跳过——豁免判据留在 DOM 侧，
// 因为它要看祖先与 computedStyle，字符串侧判不了。返回违规列表（WARN 级由调用方决定）。
// 容差与角色对位统一 ±0.05cqw：设计系统声明 cqw 是关闭集、必须精确命中，
// 容差放宽到 0.12 会把 3.1cqw 当成 3 档（3.3% 误差）放行，与「关闭集」自相矛盾。
export function checkAllFontSizes(items, { cssText, nn = '' } = {}) {
  const tiers = collectFontSizeTiers(cssText);
  if (!tiers.length) return [`P${nn} style.css :root 未派生出字号档，无法做全量扫描（换风格须先建 --fs-* 档）`];
  const errors = [];
  const prefix = nn ? `P${nn} · ` : '';
  for (const it of items) {
    if (it.exempt) continue;
    if (!Number.isFinite(it.cqw)) continue;
    const hit = tiers.some((t) => Math.abs(t - it.cqw) <= ROLE_FS_TOLERANCE);
    if (!hit) {
      const txt = String(it.text || '').trim().slice(0, 18);
      errors.push(`${prefix}字号 ${it.cqw.toFixed(2)}cqw 不在档位集（<${it.tag}${it.cls ? ` class="${it.cls}"` : ''}> "${txt}"）——`
        + `页内 CSS 用了集外值或继承了浏览器默认字号；改用 var(--fs-*) 档位（${tiers.length} 档见 style.css :root）`);
    }
  }
  return errors;
}

// fail 6 · 主标题字号对位（CDP 实测）。items = [{ role, px, tag, cls }]，来自 render 的 evaluate。
// 为什么必须读 computedStyle：字号是继承 + 级联算出来的，`.title` 在 `.n01` 里是 10cqw、
// 在 `.mega-hero .hero-text` 里是 9.3cqw，只按类名比表必然误判。
export function checkRoleFontSize(items, { cssText, nn = '' } = {}) {
  const errors = [];
  const prefix = nn ? `P${nn} · ` : '';
  for (const it of items) {
    const token = ROLE_TOKEN[it.role];
    if (!token) continue;                       // 非强制角色（body/label/num）不查：边际收益低，见 components.md §0.1
    if (!new RegExp(`${token}\\s*:`).test(cssText)) {
      errors.push(`${prefix}${token} 在 style.css :root 中不存在——角色 ${it.role} 的档位无法定位（换风格后须先补该令牌）`);
      continue;
    }
    const want = tierOfToken(token);
    if (want === null) { errors.push(`${prefix}令牌名不合「值即名」规则，无法反解档位：${token}`); continue; }
    const got = it.px / 10.8;                   // 1080 画布：cqw × 10.8 = px
    if (Math.abs(got - want) > ROLE_FS_TOLERANCE) {
      errors.push(`${prefix}主标题 ${it.role} 字号 ${got.toFixed(2)}cqw（${it.px}px）≠ 应有 ${want}cqw（${token}）`
        + `——节点 <${it.tag}${it.cls ? ` class="${it.cls}"` : ''}> 用错了类？主标题必须用走 ${token} 的那个共享类`);
    }
  }
  return errors;
}

let cachedCss = { key: '', text: '' };
function readCss(cssFile) {
  const key = `${cssFile}:${fs.statSync(cssFile).mtimeMs}`;
  if (cachedCss.key !== key) cachedCss = { key, text: fs.readFileSync(cssFile, 'utf8') };
  return cachedCss.text;
}

// 派生共享词表：只认「整条选择器里没有 .nNN 类」的类名（挂着母版类的规则一律视为专属段）。
// 不用 `n\d\d-` 前缀启发式——它漏判 `.n01 .item` 的 item 这类作用域私有泛名。
function deriveSharedClasses(cssText) {
  const css = plainCss(cssText);  const out = new Set();
  for (const m of css.matchAll(/([^{}]+)\{/g)) {
    const block = m[1];
    if (block.trim().startsWith('@')) continue;   // 兜底：剥完仍有残留 at-rule 头部
    for (const one of block.split(',')) {
      const sel = one.trim();
      if (!sel || sel.includes('%')) continue; // 跳过 keyframes 帧选择器
      const classes = [...sel.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)].map((x) => x[1]);
      if (!classes.length) continue;
      if (classes.some((c) => /^n\d\d/.test(c))) continue; // 专属段：需要母版根才命中
      classes.forEach((c) => out.add(c));
    }
  }
  return out;
}

function classTokens(html) {
  const out = [];
  // 先剥 <style>：CSS 注释里举例写的 <img class="x"> 不是页面实际用的类，
  // 直接扫整份 markup 会把它当「未定义类名」误杀正常书写。
  const { masked } = maskStyleBlocks(html);
  for (const m of masked.matchAll(/\bclass\s*=\s*["']([^"']*)["']/g)) {
    for (const t of m[1].split(/\s+/)) if (t) out.push(t);
  }
  return out;
}

// custom 页通用禁区（即兴页与组合页都要过）。单源放这里，render 与 CLI 都调同一份——
// 两个入口各写一份正则，迟早会出现「单跑绿、出图红」的假绿。
export const CUSTOM_FORBIDDEN_RE = /position\s*:\s*fixed|@media|@import|@font-face|url\s*\(|<\s*\/?\s*(?:script|animate|animatetransform|animatemotion|set)\b|animation\s*:|transition\s*:/i;

// 通用硬检查：根三件套 + 禁区属性 + 内联样式 + data-layer 页内唯一。
// render 对所有 custom 页调用，CLI 经 checkComposed 调用——同一份实现，两个入口不许各写一套。
// allowStyleBlock：组合页有页内 <style>（视觉值走令牌校验），补空页连 <style> 块都禁——
// 「只用 style.css 既有类」是补空页的硬约束，靠人审会漏，所以并进这里。
export function checkCustomBasics(markup, label = '', { allowStyleBlock = false } = {}) {
  const errors = [];
  let rootTag = null;
  try { rootTag = rootOf(markup).rootTag; }
  catch (e) { return [`${label}根节点异常：${e.message}`]; }
  if (!/data-artwork/.test(rootTag)) errors.push(`${label}根节点缺 data-artwork`);
  // 属性值允许单双引号与等号两侧空白：判档与 render 的宽松实现保持一致
  if (!/data-size\s*=\s*["']1080x1440["']/.test(rootTag)) errors.push(`${label}根节点缺 data-size="1080x1440"`);
  // 报出具体命中的那一小段，别只说「含禁区属性」——否则 @import / url() 这类新增命中项
  // 只给一句笼统提示，写的人不知道是哪一条
  const forbidden = markup.match(CUSTOM_FORBIDDEN_RE);
  if (forbidden) errors.push(`${label}含禁区属性：${forbidden[0].trim()}（布局劫持 position:fixed / @media / 脚本动画标签 / 动效 CSS）`);
  // 单双引号都认：手写 markup 用 ' 也合法，只认双引号会让 'dup' 两处静默通过
  const layers = [...markup.matchAll(/data-layer\s*=\s*(["'])([^"']+)\1/g)].map((m) => m[2]);
  const dup = layers.filter((v, i) => layers.indexOf(v) !== i);
  if (dup.length) errors.push(`${label}data-layer 重复 ${[...new Set(dup)].join(',')}`);
  // 内联样式两类都禁：组合页该写进页内 <style>（好让令牌校验一处扫完），补空页根本没有样式通道。
  if (/<[a-zA-Z][^>]*\sstyle\s*=\s*["']/i.test(markup)) {
    errors.push(allowStyleBlock
      ? `${label}禁内联 style="…"——样式统一写进页内 <style> 块，令牌校验才扫得到`
      : `${label}禁内联 style="…"——补空页只能用 style.css 既有类，不能写样式`);
  }
  if (!allowStyleBlock && /<\s*style\b/i.test(markup)) {
    errors.push(`${label}补空页禁页内 <style> 块——要自己写样式就走自由组合（custom/composed-<名> + layoutBase），别在补空页开样式通道`);
  }
  return errors;
}

// custom 页（补空 / 组合）通用静态检查：根三件套 + 禁区 + data-layer + 图片。
// 供单跑入口对补空页使用；组合页由 checkComposed 自己调这两段（它还要跑组合页专属规则）。
// 图片检查必须跟着走：补空页也可能带图，只查根三件套会让「单跑绿、出图红」重现。
export function checkCustomPage(markup, { baseDir = '', label = '', allowStyleBlock = false } = {}) {
  const errors = checkCustomBasics(markup, label, { allowStyleBlock });
  const warns = [];
  if (baseDir) {
    const { masked } = maskStyleBlocks(markup);
    checkImgTags(masked, baseDir, label, errors, warns);
  } else {
    warns.push(`${label}WARN: [未启用] 图片检查——调用方未提供任务工作区目录（baseDir）`);
  }
  return { errors, warns };
}

// issue 槽的提示整篇只报一次（每页同质重复是噪音）；模块级标志，在同一进程的逐页校验间保持。
let issueNoticeShown = false;

export function checkComposed({ nn, page, total, cssFile, baseDir = '' }) {
  const errors = [];
  const warns = [];
  const markup = String(page.markup || '');
  const layout = String(page.layout || '');
  const base = page.layoutBase ? String(page.layoutBase) : '';
  // —— 系统槽（与 render 注入链路同一份实现）：data-sys 白名单 + 占位符宿主配对 ——
  // 必须放在 fail 1 之前：缺 layoutBase 会 early return，放后面就漏查。
  // 单跑 CLI 与 render 出图检查集合相等，是「两入口各写一套」的历史教训。
  // 重复槽的 WARN 由 render 统一报（这里只收 errors，避免同一提示打两遍）。
  {
    const sErrors = []; const sWarns = [];
    scanSysTags(markup, `P${nn}`, sErrors, sWarns);
    checkPlaceholderHosts(markup, `P${nn}`, sErrors);
    errors.push(...sErrors);
    // issue 在白名单里但没有注入通道：组合页的 data-sys="issue" 只是编辑器图层标记，
    // 值不会从 plan 填进去。这是知识性提示、不是每页的错，整篇只提示一次，避免刷屏。
    if (!issueNoticeShown && /\bdata-sys\s*=\s*["']issue["']/i.test(markup)) {
      issueNoticeShown = true;
      warns.push('data-sys="issue" 在组合页没有注入通道——它只是图层标记，期号文案要直接写进 markup（本篇不再重复提示）');
    }
  }

  // —— fail 1：layoutBase 必填、在已实测集合内、与根类一致 ——
  if (!base) {
    errors.push('缺 layoutBase：自由组合页必须声明 layoutBase（借哪个母版的 .content 骨架）。注意 layout 用了 custom/composed- 前缀就按组合页判，漏 layoutBase 不会退回即兴补空——补 layoutBase，或把 layout 改成 custom/<名> 明确走补空');
    return { errors, warns };
  }
  if (!LAYOUT_BASES.includes(base)) {
    errors.push(`layoutBase "${base}" 不在已实测骨架集合内（${LAYOUT_BASES.join(' / ')}）——style.css 里有 .content 的骨架更多，但未做副作用实测的不放行`);
  }
  if (!/^custom\/composed-/.test(layout)) {
    warns.push(`layout "${layout}" 带 layoutBase 但未用 custom/composed-<语义名> 命名——判档看 layoutBase 与 composed- 前缀，命名本身不额外加严，但占比统计与人读靠它`);
  }

  let rootTag; let inner;
  try { ({ rootTag, inner } = rootOf(markup)); }
  catch (e) { errors.push(`markup 根节点异常：${e.message}`); return { errors, warns }; }

  // 根三件套（data-artwork / data-size）由 fail 3 的 checkCustomBasics 统一报，这里不重复——
  // 与 render 走同一份判定，避免「单跑过、出图停」。
  const rootCls = (rootTag.match(/\bclass\s*=\s*["']([^"']*)["']/) || [, ''])[1].split(/\s+/).filter(Boolean);
  const rootMasters = rootCls.filter((c) => /^n\d\d$/.test(c));
  if (rootMasters.length !== 1) errors.push(`根上必须恰有一个母版类（即 layoutBase），实际 ${rootMasters.length} 个：${rootMasters.join(', ') || '无'}`);
  else if (rootMasters[0] !== base) errors.push(`layoutBase "${base}" 与根类 "${rootMasters[0]}" 不一致（根类决定实际骨架，两者必须同一）`);

  // 骨架存在性交叉：常量按 tech-blue 写死，换风格必须重建常量表，否则整套规则会静默放行
  const cssText = readCss(cssFile);
  const css = cssText.replace(/\/\*[\s\S]*?\*\//g, '');
  if (!LAYOUT_BASES.some((b) => new RegExp(`\\.${b}\\s+\\.content\\b`).test(css))) {
    errors.push(`当前 style.css 里没有任何已实测骨架（.nNN .content）——本风格的 layoutBase 常量表尚未建立，自由组合通道不可用`);
  } else if (base && !new RegExp(`\\.${base}\\s+\\.content\\b`).test(css)) {
    errors.push(`layoutBase "${base}" 在当前 style.css 里没有 .${base} .content 骨架`);
  }

  // —— fail 2：类名白名单（派生词表 ∪ 结构类 ∪ 根 layoutBase ∪ 页面级自造类）——
  // 组合页可自带 <style> 造组件：自造类只要在页内 CSS 有定义就放行；视觉值是否合规由 fail 3 的令牌校验管。
  // 母版专属类（n<nn>-）仍禁：那等于抄回固定母版，与「自造组件」是两回事。
  // 根上的母版类一并放行：它与 layoutBase 的一致性由 fail 1 单独报，不该再被当成「词表外类名」重复轰炸。
  const pageCssBlocks = extractPageCss(markup);
  const pageCss = pageCssBlocks.join('\n');
  const pageCheck = checkPageCss(pageCss, cssText);
  const pageClasses = pageCheck.classes;
  const shared = deriveSharedClasses(cssText);
  const allowed = new Set([...shared, ...STRUCT_CLASSES, base, ...rootMasters, ...pageClasses]);
  const used = classTokens(markup);
  const badScoped = [...new Set(used.filter((c) => /^n\d\d-/.test(c)))];
  const badUnknown = [...new Set(used.filter((c) => !allowed.has(c) && !/^n\d\d-/.test(c)))];
  if (badScoped.length) errors.push(`原样搬用了母版专属类（n<nn>- 前缀）：${badScoped.join(', ')}——本页根上只有 layoutBase 一个母版类，原样搬来拿不到它的 CSS 定义会静默失效。复制母版组件的结构是允许的：把类名改成自造名，在页内 <style> 用令牌重写样式即可（见 COMPOSED-MODE.md §5；fail 2 只拦无定义的类名，不是禁止复制）`);
  if (badUnknown.length) errors.push(`未定义类名：${badUnknown.join(', ')}——自造类必须在页内 <style> 有定义，或在 style.css 共享段有裸定义并登记 components.md`);

  // —— fail 3：四件套 / 禁区 / 标注唯一 ——
  // 禁区、内联样式与 data-layer 用 checkCustomBasics（与 render 同一份实现），否则单跑会「绿着出坏图」。
  // 组合页放行页内 <style>（下面的令牌校验扫它），补空页不放行——两者的样式通道不同。
  errors.push(...checkCustomBasics(markup, '', { allowStyleBlock: true }));
  // 图片：与 render 同源（shared/image.mjs 的 checkImgTags）。静态单跑跳过这一项的话，
  // 「路径打错 / 图没拷进任务工作区」要到出图才炸，而 §7 恰恰教人先单跑静态部分。
  // 剥 <style> 再扫：注释里举例的 <img> 不是真图。
  if (baseDir) {
    const { masked } = maskStyleBlocks(markup);
    checkImgTags(masked, baseDir, '', errors, warns);
  } else {
    // 不传任务工作区就查不了图。静默跳过等于「检查看似在、实际没跑」——自曝，别让人误以为已受约束。
    warns.push('WARN: [未启用] 图片检查——调用方未提供任务工作区目录（baseDir），本次只查了 markup 结构');
  }
  for (const cls of ['paper-noise', 'brand-top', 'content', 'pg-footer']) {
    if (!used.includes(cls)) errors.push(`四件套缺 .${cls}`);
  }
  if (used.filter((c) => c === 'content').length > 1) errors.push('.content 只能有一个（骨架由 root 上的 layoutBase 提供）');
  const idx = (cls) => markup.search(new RegExp(`class\\s*=\\s*["'][^"']*\\b${cls}\\b`));
  const order = ['paper-noise', 'brand-top', 'content', 'pg-footer'].map((c) => [c, idx(c)]);
  for (let i = 1; i < order.length; i++) {
    const [prev, pi] = order[i - 1]; const [cur, ci] = order[i];
    if (pi >= 0 && ci >= 0 && pi > ci) errors.push(`四件套顺序错：.${cur} 在 .${prev} 之前（应为 paper-noise → brand-top → content → pg-footer）`);
  }
  // 页面级 <style> 放行，但视觉值必须过令牌关闭集（fail 3 的一部分）。
  // 内联 style="…" 由上面的 checkCustomBasics 统一拦，不在这里重复查。
  // 禁区（position:fixed / @media / 动效 / 脚本标签）由上面的 checkCustomBasics 对整份 markup 扫，含块内内容。
  errors.push(...pageCheck.errors.map((e) => `页面 CSS 令牌违规：${e}`));

  // 占位符：组合页只有两条注入通道，其余 {{…}} 在注入后必成残留（那时报错会指向「系统槽」，
  // 与真正的原因错位）。在这里先按名字拦一次，单跑与出图都能指到具体占位符。
  const placeholders = [...new Set([...markup.matchAll(/\{\{([^}]*)\}\}/g)].map((m) => m[1].trim()))];
  const notInjectable = placeholders.filter((p) => p !== 'page-no' && p !== 'progress');
  if (notInjectable.length) errors.push(`非注入占位符：${notInjectable.map((p) => `{{${p}}}`).join(' ')}——组合页只填 {{page-no}} / {{progress}}（且须在对应 data-sys 节点内），其余直接写文案`);

  // —— fail 8：编辑器标注（收窄口径）——
  // 母版是「所有文本都标 data-layer + data-editable」，但组合页 markup 是 AI 现写的，全量标注成本高且
  // 编辑器 pack.mjs 只认有 data-layer 的节点。故只强制两类最该可编辑的节点：
  //   ① 系统槽（data-sys=...）——注入链路已认它，标注后品牌/期号/页码可在编辑器里改；
  //   ② 主标题（data-role=cover-title/page-title/closing-quote）——最高频改字对象。
  // 其余文本节点不强制（写了 data-layer 就必须唯一，已由 checkCustomBasics 查）。
  const editableNodes = [...markup.matchAll(/<([a-z0-9]+)\b([^>]*)>/gi)].filter((m) => /\bdata-(sys|role)\s*=/.test(m[2]));
  for (const m of editableNodes) {
    const attrs = m[2];
    const kind = /\bdata-sys\s*=/.test(attrs) ? 'data-sys' : 'data-role';
    const hasLayer = /\bdata-layer\s*=\s*["'][^"']+["']/.test(attrs);
    const hasEditable = /\bdata-editable\s*=\s*["']text["']/.test(attrs);
    if (!hasLayer) errors.push(`fail 8: <${m[1]}> 带 ${kind} 却缺 data-layer——编辑器认不到该图层，改字会失效`);
    else if (!hasEditable) errors.push(`fail 8: <${m[1]}> 带 ${kind} 却缺 data-editable="text"——编辑器认到图层但不可编辑`);
  }

  // —— fail 4：data-role 值与主标题唯一 ——
  const roles = [...markup.matchAll(/data-role\s*=\s*["']([^"']*)["']/g)].map((m) => m[1]);
  const unknownRoles = [...new Set(roles.filter((r) => !ROLES.includes(r)))];
  if (unknownRoles.length) errors.push(`data-role 取值非法：${unknownRoles.join(', ')}（合法值 ${ROLES.join(' / ')}）`);
  const titles = roles.filter((r) => TITLE_ROLES.includes(r));
  const isLast = nn === String(total).padStart(2, '0');
  // 单页同时是封面又是末页：一刀切成 cover-title 会把单页金句卡（closing-quote）误拦，
  // 故单页三种主标题角色都放行；多页仍按封面/末页/中间页各自收紧。
  const expect = total === 1 ? ['cover-title', 'page-title', 'page-title-compact', 'closing-quote']
    : nn === '01' ? ['cover-title']
      : isLast ? ['page-title', 'page-title-compact', 'closing-quote']
        : ['page-title', 'page-title-compact'];
  if (titles.length !== 1) {
    errors.push(`每页必须有且只有一个主标题 data-role（${expect.join(' 或 ')}），实际 ${titles.length} 个${titles.length ? `：${titles.join(', ')}` : ''}`);
  } else if (!expect.includes(titles[0])) {
    errors.push(`本页主标题角色应为 ${expect.join(' 或 ')}，实际 "${titles[0]}"——字号档靠它定位，错角色必然错档`);
  }

  // —— fail 5：填充机制（只有顶对齐的 flex 纵列需要；居中与 grid 各有天然机制）——
  // 页面级 CSS 通道放开后，填充有三种写法：
  //   ① 共享类 .fill-grow / .fill-sink；
  //   ② 页内 CSS 直接写 margin-top:auto（沉底，无歧义）；
  //   ③ .content 的直系子元素自己写 flex:1 且子树非空——让「装内容的容器」吸收剩余空间。
  // 原有的 data-fill="grow|sink" 标记已删除：它只认标记、不校验页内 CSS 是否真写了 flex:1，
  // 于是浏览器里零效果的写法也能过检。一个永不生效的通道比没有更危险——AI 会以为自己填了。
  // ④ 是排版上最该走的一条，早期版本漏了它，结果「主容器撑满」被拦、而「末尾塞个空 div」被放行，
  // 正好奖励了假填充。裸 flex:1 只在 .content 直系子元素这一层算数：横排里的 .rd-arm{flex:1} 是等分。
  const fills = used.filter((c) => COMPOSED_FILL_CLASSES.includes(c));
  const cssSink = /margin-top\s*:\s*auto/i.test(pageCss);
  const contentKids = directChildrenOf(markup, 'content');
  const grewKid = contentKids.find((k) => k.hasContent && k.cls.some((c) => classGrows(pageCss, c)));
  const cssFill = cssSink || Boolean(grewKid);
  if (/data-fill\s*=/i.test(markup)) {
    warns.push('data-fill 标记已停用（它不产生任何布局效果）——改用共享类 .fill-grow / .fill-sink，或让 .content 的直系子元素自己 flex:1');
  }
  const kind = SKELETON_KIND[base];
  if (!fills.length && !cssFill && kind === 'column') {
    errors.push(`未声明填充机制：${base} 是顶对齐的 flex 纵列，内容少时全堆在顶部。三种合法写法：`
      + `.fill-grow/.fill-sink 类、页内 CSS 写 margin-top:auto，或让 .content 的直系子元素自己 flex:1（推荐：容器吸收，不要新增空节点）`);
  }
  // 空节点撑开：只 WARN 不拦。共享填充类与自造空壳都算——两者都是「加了填充但没买到版面」，
  // 区别在建议：共享类是官方 API（该让它包住内容），自造壳该改用共享类。混成一条提示会指错修法。
  const hollow = contentKids.filter((k) => !k.hasContent && k.cls.length
    && k.cls.some((c) => classGrows(pageCss, c) || COMPOSED_FILL_CLASSES.includes(c)));
  const hollowShared = hollow.filter((k) => k.cls.some((c) => COMPOSED_FILL_CLASSES.includes(c)));
  const hollowCustom = hollow.filter((k) => !hollowShared.includes(k));
  if (hollowShared.length) {
    warns.push(`填充节点是空的（.${hollowShared.map((k) => k.cls.join('.')).join(' / .')}）：空 .fill-grow 只把页脚顶到底，撑不出内容——`
      + '内容偏少就改结构 / 升字档 / 补次级信息；有内容要铺满时让这个填充节点包住它');
  }
  if (hollowCustom.length) {
    warns.push(`自造空壳撑开（.${hollowCustom.map((k) => k.cls.join('.')).join(' / .')}）：改用共享类 .fill-grow / .fill-sink，`
      + '或把 flex:1 挪到装内容的容器上——空壳只推位置，不让版面变满');
  }
  if (fills.length && kind === 'center') {
    warns.push(`${base} 的 .content 是居中骨架（justify-content:center），再写 .fill-* 会把居中顶歪——内容少就让它居中，别拿填充类的 margin-top:auto 兜`);
  }
  if (fills.includes('fill-grow') && kind === 'grid') {
    warns.push('.fill-grow 在 grid 骨架里是空操作（flex 不作用于 grid item）——grid 行高已 1fr 均分，可直接删');
  }
  if (fills.includes('fill-grow') && fills.includes('fill-sink')) warns.push('同时用了 .fill-grow 与 .fill-sink——一页只该选一种填充策略，混用会互相抵消');

  return { errors, warns };
}

// 未实现项自曝（每次运行输出一次）。放一个永远 pass 的检查比没有更危险——它让人误以为已受约束。
// 只剩字数越档这一条确实没查（组合页无说明头，机器无精确上限可比对）。
export function composedNotices() {
  return [
    'WARN: [未启用] 字数越档——组合页无母版说明头，机器没有精确字数上限可比对；靠几何体检 + 人审收口（COMPOSED-MODE §7）',
  ];
}

// ---------- 独立运行（调规则时不必出图）----------
// node script/composed.mjs <plan.json> [--css=styles/tech-blue/style.css]
if (process.argv[1] && import.meta.url === url.pathToFileURL(path.resolve(process.argv[1])).href) {
  const planFile = process.argv[2];
  if (!planFile) {
    console.error('用法：node script/composed.mjs <任务工作区>/plan.json [--css=styles/<风格>/style.css]');
    process.exit(2);
  }
  const plan = JSON.parse(fs.readFileSync(planFile, 'utf8'));
  const cssArg = (process.argv.find((a) => a.startsWith('--css=')) || '').slice(6);
  const cssFile = cssArg
    ? path.resolve(cssArg)
    : path.join(path.dirname(url.fileURLToPath(import.meta.url)), '..', 'styles', plan.style || 'tech-blue', 'style.css');
  const pages = plan.pages || [];
  const total = pages.length;
  // 图片路径相对任务工作区，任务工作区 = plan.json 所在目录（与 render 的 taskDir 一致）
  const baseDir = path.dirname(path.resolve(planFile));
  let bad = 0; let composedSeen = 0; let customSeen = 0;
  for (const page of pages) {
    const nn = String(page.nn || '').padStart(2, '0');
    const layout = String(page.layout || '');
    // 母版页不归本工具管；custom/ 页分两类，两类都要查——补空页的「禁内联样式 / 禁 <style> 块」
    // 只靠人审会漏，而它恰恰是规则更严的一类。以前这里直接 continue 跳过补空页，等于单跑全放行。
    if (!layout.startsWith('custom/')) continue;
    customSeen++;
    const isComposed = Boolean(page.layoutBase) || /^custom\/composed-/.test(layout);
    let errors; let warns;
    if (isComposed) {
      composedSeen++;
      ({ errors, warns } = checkComposed({ nn, page, total, cssFile, baseDir }));
    } else {
      ({ errors, warns } = checkCustomPage(String(page.markup || ''), { baseDir, label: `P${nn}: custom markup ` }));
    }
    if (errors.length || warns.length) console.log(`\nP${nn} · ${page.layout}${page.layoutBase ? ` (${page.layoutBase})` : ''}`);
    errors.forEach((e) => console.log('  ❌ ' + e));
    warns.forEach((w) => console.log('  ⚠ ' + w));
    bad += errors.length;
  }
  // 0 页时不能打「0 页，硬错 0 条」——那读起来像「检查通过」，实际是一条规则都没跑。
  if (customSeen) {
    console.log(`\n手写页 ${customSeen} 页（其中自由组合 ${composedSeen} 页），硬错 ${bad} 条`);
    if (composedSeen) composedNotices().forEach((n) => console.log(n));
  } else {
    console.log('\n本 plan 没有手写页（layout 不以 custom/ 开头），custom 页静态规则未参与');
  }
  process.exit(bad ? 1 : 0);
}
