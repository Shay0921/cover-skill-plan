#!/usr/bin/env node
/**
 * figure.mjs — 图形栅格化器
 *
 * 用法：
 *   node script/figure.mjs <figure.html> <out.png> --style=<风格名>|<style.css 路径> [--selector=#figure] [--dsf=2]
 *
 * 定位：把「按这页内容现画的图形 HTML」截成 PNG，产物落 assets/，随后作为**普通图片**走任意图槽。
 *   图形没有可复用资产层——每次按内容现写一份，属**任务产物**，写 runs/<任务>/figures/ 随 plan.json 留档。
 *   画法与数值（画布、安全区、px 字号档、线宽圆角）见 styles/<风格>/design-system.md「自绘图形」节。
 *
 * 为什么要有这一步：
 *   render 的图槽只认 PNG / JPEG / WebP，`<img data-slot="image">` 只换 src。
 *   SVG 源码不能经 plan 的 fields 传（富文本白名单仅 span.hl / br / strong，传 <svg> 即硬停）。
 *   栅格化之后，AI 画的图形与用户截的图在 render 眼里完全同权——母版一行不用改。
 *
 * 令牌单源（本脚本存在的第二个理由）：
 *   图形 HTML 不写颜色/字体字面量，只写 var(--token)；样式来自**已选定的风格**。
 *   运行时抽该风格 style.css 的 `:root{}` 注入到 head 末尾，于是
 *   ① style.css 改令牌，图形跟着变，零双写漂移；
 *   ② 同一画法搬到另一个风格：配色自动跟随，但字号 / 字距 / 线宽 / 圆角是该风格的视觉决定，
 *      必须重校——**颜色是令牌化的，节奏不是**。
 *   用到该风格未声明的令牌 → 直接报错退出（否则 var() 取空会静默变透明，出图只是"变丑"，极难查）。
 *   **风格是必填项**：解析不到 style.css 就拒绝出图。
 *   文件里一个 var() 都没有（纯字面量 HTML，如说明图）时跳过注入、不要求风格。
 *
 * 文件自带 :root 怎么办：
 *   那份 :root 只是「直接在浏览器打开也能看」的快照，不是令牌源；注入的 style.css :root
 *   落在它之后、同名覆盖，配色永远跟 style.css 走。两者不一致时打 WARN 提示更新快照。
 *
 * 代价（必须知道）：
 *   文字变像素，交付后不可编辑、不能改字重试。要能改字只能走图形母版（如 N33）：
 *   即「SVG 写在母版里 + 节点文字做成槽」。
 *
 * 画法必须遵守（详见 styles/<风格>/design-system.md「自绘图形」节）：
 *   ① 画布尺寸固定、写死 px（图形不是流式版面；字号也只能用 px 档，cqw 在图形页不可用）；
 *   ② 横向 10% 安全区、顶部 48–60px 角标位——图槽 cover 会按容器裁切；
 *   ③ dsf≥2，否则细线发虚。
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchBrowser, closeBrowser, withPage, captureReadyPage, evaluate, createOptions } from './shared/cdp.mjs';

const SCRIPT_ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));  // 仓库根：--style=<风格名> 相对于它解析

const argv = process.argv.slice(2);
const flags = {};
const pos = [];
for (const a of argv) {
  const m = /^--([^=]+)(?:=(.*))?$/.exec(a);
  if (m) flags[m[1]] = m[2] === undefined ? true : m[2];
  else pos.push(a);
}

const [htmlPath, outPath] = pos;
if (!htmlPath || !outPath) {
  console.error('用法：node script/figure.mjs <figure.html> <out.png> [--style=<风格名>|styles/<风格>/style.css] [--selector=#figure] [--dsf=2] [--width=1600] [--height=1200] [--no-tokens]');
  process.exit(1);
}

const html = path.resolve(htmlPath);
const out = path.resolve(outPath);
if (!fs.existsSync(html)) { console.error(`✗ 找不到图形文件：${html}`); process.exit(1); }
fs.mkdirSync(path.dirname(out), { recursive: true });

// 抽第一个 :root{...}（花括号配对，不靠行匹配：paper-journal 的 :root 与后续规则同行）
function extractRoot(css) {
  const m = /(^|\n)\s*:root\s*\{/.exec(css);
  if (!m) return null;
  const start = css.indexOf('{', m.index) + 1;
  let depth = 1, i = start;
  while (i < css.length && depth > 0) {
    const c = css[i];
    if (c === '{') depth++;
    else if (c === '}') depth--;
    i++;
  }
  return depth === 0 ? css.slice(m.index, i) : null;
}

// :root 块 → Map（值截到 ; 或 } 为止，行尾注释不进值）
function parseTokens(block) {
  const map = new Map();
  if (!block) return map;
  for (const m of block.matchAll(/(--[\w-]+)\s*:\s*([^;}]+)/g)) {
    map.set(m[1], m[2].trim().replace(/\s+/g, ' '));
  }
  return map;
}

// 注入令牌：取最后一个「真实」</head>——文件头注释里常会写到这个标签名，
// 用 replace(/<\/head>/i 取第一个会把 <style> 塞进注释里（静默失效，曾踩过一次）
function injectTokens(doc, rootCss) {
  const tag = `<style id="__style_tokens__">\n${rootCss}\n</style>\n`;
  const idxs = [...doc.matchAll(/<\/head\s*>/gi)].map((m) => m.index);
  if (!idxs.length) return tag + doc;
  const bodyAt = doc.search(/<body[\s>]/i);
  const before = bodyAt === -1 ? idxs : idxs.filter((i) => i < bodyAt);
  const at = (before.length ? before : idxs).pop();
  return doc.slice(0, at) + tag + doc.slice(at);
}

// 风格解析：--style=tech-blue | --style=styles/tech-blue/style.css | 退化：文件同级有 style.css 就用它
function resolveStyle(v) {
  if (!v) return null;
  if (!v.includes('/') && !v.includes('\\')) {
    const byName = path.join(SCRIPT_ROOT, 'styles', v, 'style.css');   // 与 cwd 无关
    if (fs.existsSync(byName)) return byName;
    return null;
  }
  const p = path.resolve(v);
  return fs.existsSync(p) ? p : null;
}

const stylePath = resolveStyle(flags.style)
  || (fs.existsSync(path.join(path.dirname(html), '..', 'style.css'))
    ? path.join(path.dirname(html), '..', 'style.css')
    : null);

const docSrc = fs.readFileSync(html, 'utf8');
const usedTokens = new Set([...docSrc.matchAll(/var\(\s*(--[\w-]+)/g)].map((m) => m[1]));

let tmpHtml = html;
let expectTokens = null;   // 注入成功时记下图形引用的令牌，截图前在真实浏览器里逐个验值
if (flags['no-tokens']) {
  console.warn('⚠ --no-tokens：不注入 style.css，直接用文件自带的令牌出图（等同「浏览器直接打开」的样子，调试用）');
} else if (usedTokens.size === 0) {
  // 纯字面量颜色的 HTML（普通说明图，非令牌化图形）：不涉令牌，无需风格
  console.log('· 该文件未引用 var() 令牌，跳过注入');
} else if (!stylePath) {
  console.error('✗ 没解析到图形所属风格的 style.css —— 图形必须带风格，拒绝出图。');
  console.error('  顺序上先定风格（SKILL 八步第 1 步），再按该风格画图形：令牌、字体、配色都来自 style.css。');
  console.error('  修法：显式指定风格 → --style=tech-blue（等价于 styles/tech-blue/style.css）');
  console.error('  只想看这份文件本身长什么样：加 --no-tokens（不注入，用文件自带的兜底令牌）。');
  process.exit(1);
} else {
  const sourceCss = fs.readFileSync(stylePath, 'utf8');
  const rootCss = extractRoot(sourceCss);
  if (!rootCss) { console.error(`✗ ${stylePath} 里没有 :root{} 令牌块`); process.exit(1); }

  const doc = docSrc;
  const declared = parseTokens(rootCss);
  const used = usedTokens;
  const missing = [...used].filter((v) => !declared.has(v));
  if (missing.length) {
    console.error(`✗ 图形引用了该风格未声明的令牌：${missing.join(' / ')}`);
    console.error(`  样式源：${path.relative(process.cwd(), stylePath)}（共 ${declared.size} 个令牌）`);
    console.error('  修法：换成本风格已有令牌，或把令牌补进该风格 style.css 的 :root。不要写死颜色字面量。');
    process.exit(1);
  }

  // 文件自带 :root（浏览器直开用的快照）与 style.css 漂移 → WARN，不报错
  const own = parseTokens(extractRoot(doc));
  const drift = [...own].filter(([k, v]) => declared.has(k) && declared.get(k) !== v).map(([k]) => k);
  if (drift.length) {
    console.warn(`⚠ 文件自带兜底令牌与 ${path.basename(path.dirname(stylePath))}/style.css 不一致：${drift.join(' / ')}`);
    console.warn('  不影响出图（注入值在后面、同名覆盖），但「直接打开看」会和真实出图有差。建议更新兜底快照。');
  }

  const injected = injectTokens(doc, rootCss);
  tmpHtml = path.join(os.tmpdir(), `figure-${process.pid}-${path.basename(html)}`);
  fs.writeFileSync(tmpHtml, injected);
  console.log(`· 令牌注入 ${path.relative(process.cwd(), stylePath)}（声明 ${declared.size} 个，图形引用 ${used.size} 个）`);
  expectTokens = [...used];
}

const selector = flags.selector || '#figure';
const opts = createOptions({
  selector,
  waitSelector: selector,
  width: Number(flags.width || 1600),
  height: Number(flags.height || 1200),
  dsf: Number(flags.dsf || 2),
  timeout: 60000,
});

const inst = await launchBrowser(opts);
try {
  await withPage(inst, 'file:///' + tmpHtml.replace(/\\/g, '/'), opts, async (ctx) => {
    // 截前在真实浏览器里验值：注入块若被注释/未闭合吞掉，此处立刻暴露，不会静默出一张没上色的图
    if (expectTokens) {
      const probe = await evaluate(ctx.cdp, ctx.sessionId, `(() => {
        const s = getComputedStyle(document.documentElement);
        const names = ${JSON.stringify(expectTokens)};
        return { empty: names.filter((n) => !s.getPropertyValue(n).trim()) };
      })()`);
      if (probe.empty.length) {
        throw new Error(`✗ 注入的令牌在页面里解析为空：${probe.empty.join(' / ')}\n  常见原因：<style> 被塞进 HTML 注释、标签未闭合、或 :root 块不完整。`);
      }
    }
    const shot = await captureReadyPage(ctx, opts);
    fs.writeFileSync(out, shot.buffer);
    const kb = (shot.bytes / 1024).toFixed(0);
    console.log(`✓ ${path.relative(process.cwd(), out)}  ${shot.width}×${shot.height}  ${kb} KB  (${selector} @${opts.dsf}x)`);
  });
} catch (e) {
  console.error(e && e.message ? e.message : e);
  process.exitCode = 1;
} finally {
  await closeBrowser(inst);
  if (tmpHtml !== html) { try { fs.rmSync(tmpHtml, { force: true }); } catch { /* tmp */ } }
}
