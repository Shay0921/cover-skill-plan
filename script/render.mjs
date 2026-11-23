#!/usr/bin/env node
/* render.mjs · 实例化器——生产环境固定脚本，不是临时文件
 * 用法：node script/render.mjs <任务运行区>/ [--delivery=<交付目录>] [--with-editor] [--force] [--check-geometry] [--only=N01,N02] [--font-report]
 *   --font-report 是诊断开关（不进常规出图）：打印每页实际命中字体、三套字体栈的字宽实测，
 *                 并与权重表里的建模值逐族对照（实测≠建模时要能一眼看出原因），见 shared/cdp.mjs fontReport
 *   --only + --font-report = 只读诊断：只写临时 HTML 跑体检、跑完即删；不更新 P 页 / PNG / fields.json / manifest / preview.png。
 *     单独 --font-report（无 --only）= 出图时顺带体检；单独 --only（无 --font-report）= 只更新指定页的 P 页 HTML / PNG，
 *     preview.png 与编辑器契约件（fields / manifest）一律不动——这三个是跨页聚合件，残缺版会覆盖运行区里的正式版。
 * 输入：<任务运行区>/plan.json + 素材图片（相对运行区）
 * 三级目录（技能安装目录只读，运行期零写入）：
 *   ① 技能安装目录 = 本文件所在仓库：styles/ + script/，只读资产与代码（开发期文档与施工台账不随生产包分发）
 *   ② 任务运行区 = agent 临时工作区：plan.json / 素材 / 过程件 / P 页 / PNG / assets / 日志（fields.json 与 editor.manifest.json 仅 --with-editor 时生成）；_preview.html 是拼总览用的临时页，截完即删
 *   出图倍率：默认 2x（PNG 像素 2160×2880，画布逻辑尺寸仍 1080×1440）——小图位降采样糊的对策；
 *   COVER_DSF=1 可临时回退 1x，见 shared/cdp.mjs createOptions
 *   ③ 交付目录 = 用户选中的工作区（--delivery 或 plan.delivery，命名 YYYY-MM-DD-<小标题>）：校验+截图全过后按白名单拷贝
 * 交付白名单（默认，编辑器不在默认链路上）：P<nn>-<名>.html + P<nn>-<名>.png + preview.png
 *   --with-editor 追加：fields.json + editor.manifest.json + assets/（仅用户要开编辑器时才走）
 * 硬校验（即停）：{{ 残留 / 图片缺失或格式不符 / 根节点与画布 / data-layer 重复 / 必填槽为空 / plan 字段与槽位对不上 / repeat 区间 / 富文本白名单外标签
 *   / data-sys 白名单外取值 / plan 出现手填 page-no / progress 字段
 *   文案里的裸 < > 不算标签（"年收入 > 10 万"、"A < B" 照常出图，注入前转义为实体显示）
 * 软校验（WARN）：字数超限（解析说明头"限制"行）/ 图片与槽位比例差异大 / crop 百分比超界（clamp 到 5–99）
 * 即兴页（layout: custom/*）：形态校验 + --check-geometry 几何体检
 * 动态槽位：按 data-sys 注入，与风格/class 无关——
 *   brand-logo/brand-name/footer-id 来自 plan.meta.brand（整组统一，meta 缺失保留母版默认）；
 *   page-no 由 render 按页序机械生成 nn / 总页数（总页数取 plan.pages.length，与 --only 无关），封面 nn=01 注入 display:none 保留图层；
 *   progress 由 render 按本页伪随机勾选数机械生成 done/total（勾选分配见 assignRandDone，同 plan 可复现）；
 *   issue 与按钮是普通 {{占位符}}，走 per-page fields，无需新逻辑。
 */
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import { launchBrowser, closeBrowser, withPage, evaluate, captureReadyPage, createOptions, fontReport } from './shared/cdp.mjs';

const ROOT = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const consumedIdx = new Set();
function flagValue(name) {
  const i = argv.findIndex((a) => a === name || a.startsWith(name + '='));
  if (i < 0) return null;
  consumedIdx.add(i);
  if (argv[i].startsWith(name + '=')) return argv[i].slice(name.length + 1);
  if (argv[i + 1] && !argv[i + 1].startsWith('--')) { consumedIdx.add(i + 1); return argv[i + 1]; }
  return '';
}
const GEOM = argv.includes('--check-geometry');
const FORCE = argv.includes('--force');
const WITH_EDITOR = argv.includes('--with-editor');
// 字体体检：默认关闭（每页要多走一次全量 DOM + 逐文字节点协议往返），只在核对字面/重测字宽时开
const FONT_REPORT = argv.includes('--font-report');
const onlyArg = flagValue('--only');
// 只读体检模式：--only + --font-report 时，只生成临时 HTML 跑字体体检，绝不写正式产物。
// 避免诊断顺带把 fields/manifest/preview 覆盖成单页版、污染正式运行区（多页运行区尤其明显）。
const DIAG_ONLY = FONT_REPORT && onlyArg !== null;
// --only 同时接受 02 / N02 / P02 三种写法（plan.nn 是两位数字）；显式传空值报错，防止静默退化成全量渲染
let ONLY = null;
if (onlyArg !== null) {
  ONLY = onlyArg.split(',').map((s) => s.trim().replace(/^[NPnp]/, '')).filter(Boolean);
  if (!ONLY.length) fail('--only 不能为空：请写 --only=N01,N02（也接受 02 / P02 写法）');
}
// 编辑器产物（fields.json / editor.manifest.json）按需生成，默认生图链路不产：
//   ① 只有 --with-editor 才写——默认交付就是 P 页 HTML + PNG + preview.png，编辑器不在默认链路上；
//   ② --only 单页调试不写——这两个是跨页聚合件，单页版会把多页运行区的正式版本覆盖掉；
//   ③ 只读体检（DIAG_ONLY）不写——诊断不落任何正式文件。
const EDITOR_OUT = WITH_EDITOR && !ONLY && !DIAG_ONLY;
const deliveryArg = flagValue('--delivery');
// 先解析带值参数，避免把 "--only N01,N02" / "--delivery <路径>" 的值误认成任务目录
const taskDir = path.resolve(argv.find((a, i) => !a.startsWith('--') && !consumedIdx.has(i)) || '');

if (!taskDir || !fs.existsSync(path.join(taskDir, 'plan.json'))) {
  console.error('用法: node script/render.mjs <任务运行区>/ [--delivery=<交付目录>] [--with-editor] [--force] [--check-geometry] [--only=N01,N02]  （运行区须含 plan.json）');
  process.exit(2);
}
const plan = JSON.parse(fs.readFileSync(path.join(taskDir, 'plan.json'), 'utf8'));
const STYLE = plan.style;
if (!STYLE) fail('plan.json 缺 style 字段');

// ---------- 交付目录（三级分离）----------
// --delivery=<路径> 优先；否则读 plan.delivery；都没有则只写任务运行区、不产出交付目录。
// 相对路径按当前工作目录解析（用户选中的工作区）；脚本不会自动改名，目录由调用方按 YYYY-MM-DD-<小标题> 命名。
const DELIVERY_RAW = deliveryArg !== null ? deliveryArg : (plan.delivery ? String(plan.delivery) : '');
if (deliveryArg === '') fail('--delivery 不能为空：请写 --delivery=<目录>，或省略该参数只写运行区');
// 只读诊断（--only + --font-report）不产出交付物：忽略 --delivery / plan.delivery，既不报错也不拷贝。
// 否则带 delivery 的正式任务无法就地体检，与「可在正式运行区直接跑」的用法矛盾。
const DELIVERY = DIAG_ONLY ? null : (DELIVERY_RAW ? path.resolve(DELIVERY_RAW) : null);
if (DELIVERY && DELIVERY === taskDir) fail('交付目录不能等于任务运行区（过程件与成品必须分开）');
// --only 是调试开关：只出部分页会形成「新页 + 旧页」混装包，故禁止与交付同用。
// 只读诊断（DIAG_ONLY）的 DELIVERY 已在上方置 null，因此不受这道守卫限制。
if (ONLY && DELIVERY) fail('--only 仅用于运行区调试，不能与 --delivery（或 plan.delivery）同用；正式交付请跑完整页数');
if (ONLY && !DIAG_ONLY) console.warn('⚠ --only 是单页调试：只更新指定页的 HTML / PNG；preview.png' + (WITH_EDITOR ? ' 与 fields.json / editor.manifest.json' : '') + ' 保持原样（这些是跨页聚合件，需完整渲染才刷新）');
// 开工前先挡掉目录冲突，避免整轮截图跑完才报错（拷贝阶段再查一次，防并发期间被别的任务占用）
if (DELIVERY && fs.existsSync(DELIVERY)) {
  if (!fs.statSync(DELIVERY).isDirectory()) fail(`交付路径已存在但不是目录：${DELIVERY}`);
  if (!FORCE && fs.readdirSync(DELIVERY).length)
    fail(`交付目录已存在且非空：${DELIVERY}\n  重跑同一任务请加 --force（只覆盖白名单文件，不删其它内容），或换一个目录名`);
}
const STYLE_DIR = path.join(ROOT, 'styles', STYLE);
const TPL = path.join(STYLE_DIR, 'templates.html');
const CSS_FILE = path.join(STYLE_DIR, 'style.css');
for (const f of [TPL, CSS_FILE]) if (!fs.existsSync(f)) fail(`风格文件缺失: ${f}`);

const MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' };

function fail(msg) { console.error('❌ ' + msg); process.exit(1); }
const rel = (p) => path.relative(ROOT, p).replace(/\\/g, '/');

// ---------- 抽 section ----------
function extractSections(tplText) {
  const map = new Map();
  const re = /<section data-layout="([^"]+)">([\s\S]*?)<\/section>/g;
  let m;
  while ((m = re.exec(tplText))) map.set(m[1], m[2]);
  return map;
}
function rootOf(body) {
  // 按「class 含 artwork-page」扫 <div> 开标签：不要求 class 是首个属性，也不要求属性值以 artwork-page 开头
  // 已知边界（低危，当前母版不触发）：正则按 > 收标签，若根标签的属性值里出现裸 > 或注释里写 <div> 示例，会误判
  //   → 母版根标签只写 class/data-size，说明头注释不写 <div> 字面量即可
  let rootTag = null; let openEnd = -1;
  for (const m of body.matchAll(/<div\b[^>]*>/g)) {
    const cls = m[0].match(/\bclass\s*=\s*["']([^"']*)["']/);
    if (cls && cls[1].split(/\s+/).includes('artwork-page')) { rootTag = m[0]; openEnd = m.index + m[0].length - 1; break; }
  }
  if (!rootTag) throw new Error('画布根缺失：未找到 class 含 artwork-page 的 <div>');
  let depth = 1; const re = /<div\b|<\/div>/g; re.lastIndex = openEnd + 1; let mm; let closeStart = -1;
  while ((mm = re.exec(body))) { depth += mm[0] === '</div>' ? -1 : 1; if (!depth) { closeStart = mm.index; break; } }
  if (depth !== 0) throw new Error('根 div 未配对');
  return { rootTag, inner: body.slice(openEnd + 1, closeStart) };
}

// ---------- repeat 区间解析（注释↔单元按序配对） ----------
// 归属规则：第 i 条 repeat ×N-M 注释（文档顺序）配第 i 个 data-repeat 单元，一一配对、不向前搜索
// ——向前取最近注释会让漏写注释的单元串用上一条的区间（误拦或放过都有可能）；距离窗口则
// 说明头一变长就漏配、太长救不了漏写，两种都拦不住。数量不齐 / 注释落在对应单元之后 → fillSection 硬报错。
function collectRepeatRanges(body) {
  return [...body.matchAll(/repeat\s*×(\d+)-(\d+)/g)].map((m) => ({ at: m.index, min: +m[1], max: +m[2] }));
}
function findUnitEnd(body, start) {
  const tagM = body.slice(start).match(/^<([a-z0-9]+)\b/i);
  const tag = tagM[1];
  const re = new RegExp(`<${tag}\\b|</${tag}>`, 'gi');
  re.lastIndex = start + 1;
  let depth = 1, mm;
  while ((mm = re.exec(body))) { depth += mm[0].startsWith('</') ? -1 : 1; if (!depth) return mm.index + mm[0].length; }
  throw new Error('repeat 单元未闭合');
}

// ---------- 富文本校验与转义 ----------
// 白名单标签（双/单引号都认，允许标签内尾空格；hl 也是唯一带属性的白名单标签）
const RICH_OK = /<span\s+class=["']hl-line["']\s*>|<span\s+class=["']hl["']\s*>|<\/span>|<br\s*\/?>|<strong>|<\/strong>/gi;
// 只把「明确的标签形态」判为非法：<name> / </name> / <name attr="v"> / <!doctype> / <?xml?>
//   文案里的裸 < > 不算标签（"年收入 > 10 万"、"A < B"、"x<y 时 5>3"）——
//   标签名后只认「空格 + 字母属性名」（可带 =值），中文/数字跟在 < 后不构成标签。
//   这条判定只决定「要不要报错提示」，安全由 richHtml 转义兜底：即使漏判，也只会显示成文字，不会真变成标签。
const TAG_LOOKING = /<\/?[a-zA-Z][a-zA-Z0-9-]*(?:\s+[a-zA-Z-]+(?:=(?:"[^"]*"|'[^']*'|[^\s<>]+))?)*\s*\/?>|<[!?][^<>]*>/;
function checkRich(value, where, errors) {
  const stripped = value.replace(RICH_OK, '');
  if (!TAG_LOOKING.test(stripped)) return;
  const hit = stripped.match(new RegExp(`[\\s\\S]{0,10}(?:${TAG_LOOKING.source})`));
  errors.push(`${where}: 值含白名单外标签（只允许 span.hl / span.hl-line / br / strong），检出错段 "${(hit ? hit[0] : '').trim()}"`);
}
// 注入前转义：白名单标签原样保留，其余 & < > 转实体（已存在的实体不二次转义）。
// 哨兵用私用区 U+E000/U+E001：正文不会出现，也不与字体/CSS 混淆。
function richHtml(value) {
  const keep = [];
  const held = value.replace(RICH_OK, (m) => `\uE000${keep.push(m) - 1}\uE001`);
  const esc = held
    .replace(/&(?!amp;|lt;|gt;|quot;|apos;|#\d+;|#x[0-9a-fA-F]+;)/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return esc.replace(/\uE000(\d+)\uE001/g, (_, i) => keep[+i]);
}

// ---------- 动态槽位（meta 品牌 + 页码）----------
// data-sys 白名单：只认这些值；出现白名单外取值 = 硬错误即停（防拼错静默不填）。
// 品牌三槽由 meta.brand 注入；page-no 由 render 机械生成；issue 是普通 {{占位符}} 走 fields，不在注入函数内。
const SYS_WHITELIST = new Set(['brand-logo', 'brand-name', 'footer-id', 'issue', 'page-no', 'progress']);
const SYS_META_KEY = { 'brand-logo': 'logo', 'brand-name': 'name', 'footer-id': 'footer' };

// 扫 body 里所有 data-sys 节点做白名单校验；返回计数（供 fields 展开与体检）。
// 白名单外的值 → 硬错误（防拼错静默不填）；同一 data-sys 出现多次 → WARN 幂等替换。
function checkSysTags(body, layout, errors, warns) {
  const tags = [...body.matchAll(/\bdata-sys=(["'])([^"']*)\1/g)].map((m) => m[2]);
  const tally = {};
  for (const v of tags) {
    if (!SYS_WHITELIST.has(v)) errors.push(`${layout}: data-sys 白名单外取值 "${v}"（只允许 ${[...SYS_WHITELIST].join('/')}）`);
    tally[v] = (tally[v] || 0) + 1;
  }
  for (const [v, n] of Object.entries(tally)) {
    if (n > 1) warns.push(`${layout}: data-sys="${v}" 出现 ${n} 次（>1，将全部替换）`);
  }
  return tally;
}

// 步骤 0 · 品牌全局注入：用 plan.meta.brand.* 覆盖 data-sys=brand-logo/name/footer-id 节点的整段文本。
// 只替换标签内的文本内容，保留节点所有属性（data-sys/data-layer/data-editable/class 等）。
// meta 缺失的键跳过（保留母版默认文本，向后兼容旧 plan）。富文本按 checkRich 白名单校验后注入。
function injectMeta(body, meta, layout, errors) {
  const brand = meta && typeof meta.brand === 'object' ? meta.brand : null;
  if (!brand) return body;
  let out = body;
  for (const sys of Object.keys(SYS_META_KEY)) {
    const val = brand[SYS_META_KEY[sys]];
    if (val === undefined || val === null || val === '') continue;   // 缺失保留默认
    const sv = String(val);
    checkRich(sv, `${layout}:meta.brand.${SYS_META_KEY[sys]}`, errors);
    const replacement = richHtml(sv);
    // 节点可能跨行；匹配 <tag ...data-sys="sys"...> 到其闭合标签，只换中间文本。
    // 用函数式 replace，逐节点处理（同一 sys 多次出现幂等全覆盖）。
    out = out.replace(/(<([a-z0-9]+)\b[^>]*\bdata-sys=(["'])([^"']*)\3[^>]*>)([\s\S]*?)(<\/\2>)/gi, (full, open, tag, _q, sysVal, inner, close) => {
      if (sysVal !== sys) return full;
      // R9：注入整段替换节点内容，节点内含子元素会被静默清空——系统槽只准纯文本，硬停
      if (/<[a-z0-9!]/i.test(inner)) fail(`母版 ${layout}: data-sys="${sysVal}" 系统槽节点内含子元素——系统槽只准纯文本（注入会整段替换并清空子元素）`);
      return open + replacement + close;
    });
  }
  return out;
}

// 步骤 6 · 页码注入/隐藏：扫 data-sys="page-no" 节点。
// 非封面：把 {{page-no}} 换为 `nn / 总页数`（总页数取 plan.pages.length，与 --only 无关）。
// 封面（nn==="01"）：文本置空 + 注入 style="display:none"，不删节点（编辑器 markers 模式仍能扫到图层）。
// 返回 { body, pageNoValue, hidden }，pageNoValue 供 fields.json 转写用。
function injectPageNo(body, nn, total, layout, errors) {
  const hidden = nn === '01';
  const value = hidden ? '' : `${nn} / ${String(total).padStart(2, '0')}`;
  let found = false;
  const out = body.replace(/(<([a-z0-9]+)\b[^>]*\bdata-sys=["']page-no["'][^>]*>)([\s\S]*?)(<\/\2>)/gi, (full, open, tag, inner, close) => {
    found = true;
    if (!/\{\{page-no\}\}/.test(inner)) {
      errors.push(`${layout}: data-sys="page-no" 节点内未找到 {{page-no}} 占位符（节点内容="${inner.trim()}"）`);
    }
    let newInner = inner.replace(/\{\{page-no\}\}/g, hidden ? '' : value);
    let newOpen = open;
    if (hidden) {
      if (/\bstyle="([^"]*)"/.test(newOpen)) {
        newOpen = newOpen.replace(/\bstyle="([^"]*)"/, (_, s) => `style="${s}${/display\s*:/.test(s) ? '' : ';display:none'}"`);
      } else {
        newOpen = newOpen.replace(/>$/, ' style="display:none">');
      }
    }
    return newOpen + newInner + close;
  });
  return { body: out, pageNoValue: value, hidden, found };
}

// 步骤 6.5 · 清单伪随机勾选（data-rand-done）：确定性分配 data-done="1"。
// seed 混入页号与条目序——同 plan 每次渲染结果恒定，目检基准与 --only 重渲不漂移；比例约六成。
// 机器只发属性、不认类名：勾选视觉由各风格 CSS 按属性选择器实现（tech-blue: .n12-checklist__item[data-done]）。
function assignRandDone(body, nn) {
  let i = 0, done = 0, total = 0;
  const out = body.replace(/(<([a-z0-9]+)\b[^>]*\bdata-rand-done\b[^>]*>)/gi, (full, open) => {
    total++;
    let h = 2166136261;
    const s = `${nn}:${i++}`;
    for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
    if (((h >>> 0) % 100) < 60) { done++; return open.slice(0, -1) + ' data-done="1">'; }
    return open;
  });
  return { body: out, done, total };
}

// 步骤 6.6 · 清单进度注入（data-sys="progress"）：文本由 render 按勾选数机械生成 done/total。
// plan 手填 progress 属违规（同 page-no）；节点内须有 {{progress}} 占位符。
function injectProgress(body, done, total, layout, errors) {
  const value = `${done}/${total}`;
  let found = false;
  const out = body.replace(/(<([a-z0-9]+)\b[^>]*\bdata-sys=["']progress["'][^>]*>)([\s\S]*?)(<\/\2>)/gi, (full, open, tag, inner, close) => {
    found = true;
    if (!/\{\{progress\}\}/.test(inner)) {
      errors.push(`${layout}: data-sys="progress" 节点内未找到 {{progress}} 占位符（节点内容="${inner.trim()}"）`);
    }
    return open + inner.replace(/\{\{progress\}\}/g, value) + close;
  });
  return { body: out, progressValue: value, found };
}

// ---------- 图片处理 ----------
// 只产出「dataURL + crop 样式」，不拼全新 <img> 标签。
// 母版 img 上的 data-slot/data-layer/data-label/data-ratio 是编辑器图层的身份证，
// 必须由 fillSection 在替换 src 时原样保留。
// 魔数嗅探：读文件头判真实格式，与扩展名声明的 MIME 交叉校验。
// GIF 伪装成白名单后缀（如改名 .png）会在此被拦——浏览器虽按内容解码能显示，但编辑器 pack.mjs 嗅探内容后整批拒绝。
function sniffMime(buf) {
  if (buf.length >= 8 && buf.toString('hex', 0, 8) === '89504e470d0a1a0a') return 'image/png';
  if (buf.length >= 3 && buf.toString('hex', 0, 3) === 'ffd8ff') return 'image/jpeg';
  if (buf.length >= 12 && buf.toString('latin1', 0, 4) === 'RIFF' && buf.toString('latin1', 8, 12) === 'WEBP') return 'image/webp';
  if (buf.length >= 4 && buf.toString('latin1', 0, 4) === 'GIF8') return 'image/gif';
  return null;
}

// 读 EXIF IFD0 的 orientation tag（0x0112，SHORT 内联值）；读不到/结构异常一律返回 0。
// 只走 TIFF 头最简路径，不改写任何字节——纯读。
function exifOrientation(buf, start, end) {
  try {
    if (end - start < 8) return 0;
    const le = buf.toString('latin1', start, start + 2) === 'II';
    const u16 = (p) => (le ? buf.readUInt16LE(p) : buf.readUInt16BE(p));
    if (u16(start + 2) !== 0x2A) return 0;
    const ifd = start + (le ? buf.readUInt32LE(start + 4) : buf.readUInt32BE(start + 4));
    if (ifd + 2 > end) return 0;
    const n = u16(ifd);
    for (let i = 0; i < n; i++) {
      const e = ifd + 2 + i * 12;
      if (e + 12 > end) return 0;
      if (u16(e) === 0x0112) return u16(e + 8);
    }
    return 0;
  } catch { return 0; }
}

// 图片尺寸头解析：PNG 读 IHDR 固定偏移；JPEG 扫 SOF marker 段（跳过 DHT/JPG/DAC 非几何段）；
// WebP 按 VP8X / VP8(lossy) / VP8L(lossless) 三子格式各读一次偏移。读不出返回 null——调用方跳过软校验、
// 保持静默，不硬停（尺寸信息只喂 WARN，解析失败不升级为错误）。
// JPEG 额外读 APP1 EXIF 的 orientation：值 5–8 = 拍摄时相机竖持、浏览器按 EXIF 旋转显示，
// 存储宽高须交换——否则竖拍照片的比例 WARN 拿存储尺寸算反。
function imageDims(buf) {
  if (buf.length >= 24 && buf.toString('hex', 0, 8) === '89504e470d0a1a0a')
    return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
  if (buf.length >= 3 && buf[0] === 0xFF && buf[1] === 0xD8) {
    let o = 2, orientation = 0;
    while (o + 9 < buf.length) {
      if (buf[o] !== 0xFF) { o++; continue; }
      const m = buf[o + 1];
      if (m === 0xFF || m === 0x00) { o++; continue; }                       // 填充字节
      if (m === 0xD8 || (m >= 0xD0 && m <= 0xD7) || m === 0x01) { o += 2; continue; } // 独立 marker
      const segLen = buf.readUInt16BE(o + 2);
      if (m === 0xE1 && segLen >= 8 && buf.toString('latin1', o + 4, o + 10) === 'Exif\u0000\u0000') {
        const v = exifOrientation(buf, o + 10, o + 2 + segLen);
        if (v >= 1 && v <= 8) orientation = v;   // 0=本段无 orientation tag，不清掉先前合法值（防多 Exif APP1 覆盖）
      }
      if (m >= 0xC0 && m <= 0xCF && m !== 0xC4 && m !== 0xC8 && m !== 0xCC) { // SOF 几何段
        const w = buf.readUInt16BE(o + 7), h = buf.readUInt16BE(o + 5);
        return orientation >= 5 && orientation <= 8 ? { w: h, h: w } : { w, h };
      }
      o += 2 + segLen;                                                       // 跳过段体
    }
    return null;
  }
  if (buf.length >= 30 && buf.toString('latin1', 8, 12) === 'WEBP') {
    const cc = buf.toString('latin1', 12, 16);
    if (cc === 'VP8X') return { w: buf.readUIntLE(24, 3) + 1, h: buf.readUIntLE(27, 3) + 1 };
    if (cc === 'VP8 ' && buf[23] === 0x9D && buf[24] === 0x01 && buf[25] === 0x2A)
      return { w: buf.readUIntLE(26, 2) & 0x3FFF, h: buf.readUIntLE(28, 2) & 0x3FFF };
    if (cc === 'VP8L' && buf[20] === 0x2F) {
      const bits = buf.readUIntLE(21, 4);
      return { w: (bits & 0x3FFF) + 1, h: ((bits >>> 14) & 0x3FFF) + 1 };
    }
  }
  return null;
}

// 图片路径边界校验：plan 的 src 必须解析在任务运行区内。
// 绝对路径与 ../ 逃逸会把本机任意文件 base64 内嵌进交付 HTML（数据外泄面），入口即拦；
// Windows 盘符差异由 path.relative 天然兼容。越界只认 `..` 本身或 `../` 开头——
// 用 startsWith('..') 会误拦 `..foo.png` / `...png` 这类合法文件名。
function resolveInTask(src, where, errors) {
  const file = path.resolve(taskDir, src);
  const relToTask = path.relative(taskDir, file);
  if (relToTask === '..' || relToTask.startsWith(`..${path.sep}`) || path.isAbsolute(relToTask)) {
    if (errors) errors.push(`${where}: 图片路径须在任务运行区内（写相对路径，如 shots/a.png）: ${src}`);
    return null;
  }
  return file;
}

function imgValue(v, where, errors, usedFiles, warns) {
  const spec = typeof v === 'string' ? { src: v } : v;
  if (!spec || typeof spec.src !== 'string' || !spec.src) { errors.push(`${where}: 图片值为空`); return null; }
  const file = resolveInTask(spec.src, where, errors);
  if (!file) return null;
  const ext = path.extname(file).toLowerCase();
  if (!fs.existsSync(file)) { errors.push(`${where}: 图片不存在 ${spec.src}`); return null; }
  if (!MIME[ext]) { errors.push(`${where}: 图片格式不符（仅 PNG/JPEG/WebP）${spec.src}；请转为 PNG/JPEG/WebP 后重试`); return null; }
  const buf = fs.readFileSync(file);
  const actual = sniffMime(buf);
  if (actual !== MIME[ext]) {
    errors.push(`${where}: 图片扩展名与内容不符 ${spec.src}（扩展名声明 ${MIME[ext]}，实际内容${actual ? ' ' + actual : '无法识别'}）；请转为 PNG/JPEG/WebP 后重试`);
    return null;
  }
  usedFiles.push(file);
  const dataUrl = 'data:' + MIME[ext] + ';base64,' + buf.toString('base64');
  let cropStyle = null;
  if (spec.crop) {
    const crop = parseCrop(spec.crop);
    if (!crop) { errors.push(`${where}: crop 描述无法解析 "${spec.crop}"（例："下 55%" / "left 30%"）`); return null; }
    if (crop.raw < 5 || crop.raw > 99) warns.push(`${where}: crop "${spec.crop}" 百分比超出有效范围 5–99，已按 ${Math.round(crop.fraction * 100)}% 处理`);
    cropStyle = crop.axis === 'y'
      ? `height:${(100 / crop.fraction).toFixed(1)}%;width:100%;${crop.align === 'end' ? 'bottom:0;top:auto;' : crop.align === 'start' ? 'top:0;bottom:auto;' : 'top:50%;bottom:auto;transform:translateY(-50%);'}`
      : `width:${(100 / crop.fraction).toFixed(1)}%;height:100%;${crop.align === 'end' ? 'right:0;left:auto;' : crop.align === 'start' ? 'left:0;right:auto;' : 'left:50%;right:auto;transform:translateX(-50%);'}`;
  }
  return { dataUrl, cropStyle, spec, buf };
}
function parseCrop(desc) {
  const m = String(desc).match(/^(上|下|左|右|中)?\s*(\d{1,3})\s*%$/);
  if (m) {
    const axis = ['左', '右'].includes(m[1]) ? 'x' : 'y';
    const align = { 上: 'start', 下: 'end', 左: 'start', 右: 'end', 中: 'center' }[m[1]] || 'end';
    const fraction = Math.min(99, Math.max(5, +m[2])) / 100;
    return { axis, align, fraction, raw: +m[2] };
  }
  const m2 = String(desc).match(/^(left|right|top|bottom|center)\s+(\d{1,3})\s*%$/);
  if (m2) {
    const axis = ['top', 'bottom'].includes(m2[1]) ? 'y' : 'x';
    const align = { top: 'start', bottom: 'end', left: 'start', right: 'end', center: 'center' }[m2[1]];
    return { axis, align, fraction: Math.min(99, Math.max(5, +m2[2])) / 100, raw: +m2[2] };
  }
  return null;
}

// ---------- 填充一个 section ----------
// 可选槽判定：{{name}} 首次出现处最近的未闭合开标签带 data-optional 属性
// （母版大数字等标了 data-optional 的槽：plan 留空不算错，占位符清空后由 CSS :empty 隐藏）
function isOptionalSlot(body, name) {
  const at = body.indexOf(`{{${name}}}`);
  if (at < 0) return false;
  const opens = [...body.slice(0, at).matchAll(/<([a-z0-9]+)\b[^>]*>/g)];
  const last = opens[opens.length - 1];
  return !!(last && /\bdata-optional\b/.test(last[0]));
}

// ---------- 未知字段最近匹配 ----------
// plan 键名打错时报「是不是 "X"？」，AI 不必回文档猜键名。候选 = 本母版全部合法槽位
// （文字占位符 + repeat 数组名 + 图槽 data-layer）。编辑距离 ≤2 才建议，差太远不猜、维持原报错。
function editDistance(a, b) {
  const m = a.length, n = b.length;
  if (Math.abs(m - n) > 2) return 3; // 超出建议阈值，早退省算
  const dp = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return dp[m][n];
}
function nearestSlot(k, candidates) {
  let best = null, bestD = 3;
  for (const c of candidates) {
    const d = editDistance(k, c);
    if (d < bestD) { bestD = d; best = c; }
  }
  return bestD <= 2 ? best : null;
}

function fillSection(layout, body, fields, errors, warns, usedFiles, meta, nn, total) {
  const placeholders = [...body.matchAll(/\{\{([^}]+)\}\}/g)].map((m) => m[1].trim());
  const names = [...new Set(placeholders)];
  const repeatNames = [...body.matchAll(/data-repeat="([^"]+)"/g)].map((m) => m[1]);
  // 图槽识别不依赖属性顺序：扫全部 <img> 标签，标签内同时有 data-slot="image" 与 data-layer 才算图槽
  const imgIds = [];
  for (const m of body.matchAll(/<img\b[^>]*>/g)) {
    if (!/data-slot="image"/.test(m[0])) continue;
    const lm = m[0].match(/data-layer="([^"]+)"/);
    if (!lm) { errors.push(`${layout}: 图槽 <img data-slot="image"> 缺 data-layer（render 无法把 plan 图键对应到该槽；编辑器仍会按 img 推断成 image 图层）`); continue; }
    imgIds.push(lm[1]);
  }
  const consumed = new Set();

  // 0) 动态槽位：白名单校验 + 品牌注入（最先，先于 repeat/图槽/文字槽）
  const sysTally = checkSysTags(body, layout, errors, warns);
  body = injectMeta(body, meta, layout, errors);

  // 1) repeat 单元（从后往前替换，防位移）
  const units = [];
  {
    const re = /<([a-z0-9]+)\b[^>]*\bdata-repeat="([^"]+)"[^>]*>/g;
    let m;
    while ((m = re.exec(body))) {
      const start = m.index;
      if (units.some((u) => start >= u.start && start < u.end)) continue;
      const end = findUnitEnd(body, start);
      units.push({ idx: units.length, start, end, tag: m[1], arr: m[2], html: body.slice(start, end) });
    }
  }
  // 注释↔单元按序配对。数量不齐 = 母版漏写/多写注释，硬报错；
  // 配齐时第 i 个单元（文档顺序）用第 i 条注释的 ×min-max 校验条数，另查「注释须在单元之前」。
  const repeatRanges = collectRepeatRanges(body);
  const rangesPaired = repeatRanges.length === units.length
    && repeatRanges.every((r, i) => r.at < units[i].start);
  if (!rangesPaired) {
    errors.push(`${layout}: repeat ×N-M 注释 ${repeatRanges.length} 条与 data-repeat 单元 ${units.length} 个不按序一一对应——每条注释按文档顺序配一个单元且须写在单元之前，请逐单元核对注释`);
  }
  // repeat 单元的「条目短名 → 真实 data-layer id」映射，供 fields.json 转写为编辑器契约初稿
  const unitLayerMaps = new Map();
  for (const u of units) {
    const map = new Map();
    const phs = [...new Set([...u.html.matchAll(/\{\{([^}]+)\}\}/g)].map((x) => x[1].trim()))];
    for (const p of phs) {
      const at = u.html.indexOf(`{{${p}}}`);
      const opens = [...u.html.slice(0, at).matchAll(/<([a-z0-9]+)\b[^>]*>/g)];
      const last = opens[opens.length - 1];
      const lm = last ? last[0].match(/data-layer="([^"]+)"/) : null;
      if (lm) map.set(p, lm[1]);
    }
    unitLayerMaps.set(u.arr, map);
  }
  for (const u of units.reverse()) {
    consumed.add(u.arr);
    const arr = fields[u.arr];
    if (!Array.isArray(arr) || arr.length === 0) { errors.push(`${layout}: repeat 数组 "${u.arr}" 缺失或为空`); continue; }
    const range = rangesPaired ? repeatRanges[u.idx] : null;
    if (range && (arr.length < range.min || arr.length > range.max)) {
      errors.push(`${layout}: repeat "${u.arr}" 条数 ${arr.length} 超出 ×${range.min}-${range.max}`);
      continue;
    }
    const unitPh = [...u.html.matchAll(/\{\{([^}]+)\}\}/g)].map((m) => m[1].trim());
    const unitLayers = [...u.html.matchAll(/data-layer="([^"]+)"/g)].map((m) => m[1]);
    const rendered = arr.map((item, i) => {
      if (typeof item !== 'object' || item === null) { errors.push(`${layout}: "${u.arr}[${i}]" 必须是对象`); return ''; }
      for (const k of Object.keys(item)) if (!unitPh.includes(k)) errors.push(`${layout}: "${u.arr}[${i}].${k}" 与母版槽位对不上（单元占位符：${unitPh.join(', ')}）`);
      let html = u.html;
      for (const ph of unitPh) {
        const v = item[ph];
        if (v === undefined || v === null || v === '') errors.push(`${layout}: "${u.arr}[${i}].${ph}" 为空`);
        const sv = String(v ?? '');
        checkRich(sv, `${layout}:${u.arr}[${i}].${ph}`, errors);
        // 白名单标签保留生效，裸 < > 转义显示（"A < B" 不会变成半个标签）
        html = html.split(`{{${ph}}}`).join(richHtml(sv));
      }
      if (i > 0) html = html.replace(/data-layer="([^"]+)"/g, (_, id) => `data-layer="${id}-${i + 1}"`)
        .replace(/\bdata-pin="([^"]+)"/g, (_, id) => `data-pin="${id}-${i + 1}"`); // 坐标槽随克隆加后缀，与 data-layer 同规则
      html = html.replace(/\s*data-repeat="[^"]*"/g, ''); // 克隆件是具体内容，不带 repeat 标记
      return html;
    });
    body = body.slice(0, u.start) + rendered.join('\n') + body.slice(u.end);
  }

  // 1.5) repeat 克隆体内的图槽：克隆体 data-layer 带数字后缀（基础键 ∈ 原 imgIds），补进 imgIds 一起走必填填充
  {
    const baseIds = new Set(imgIds);
    for (const m of body.matchAll(/<img\b[^>]*>/g)) {
      if (!/data-slot="image"/.test(m[0])) continue;
      const lm = m[0].match(/data-layer="([^"]+)"/);
      if (!lm || baseIds.has(lm[1])) continue;
      const base = lm[1].replace(/-\d+$/, '');
      if (baseIds.has(base)) imgIds.push(lm[1]);
    }
  }

  // 1.6) 坐标槽：元素带 data-pin="<fields 键>"（钉位可配母版，如 N40 浮动标注卡）。
  //      repeat 克隆体的 data-pin 已在步骤 1 随 data-layer 加 -2/-3 后缀，这里按后缀键分别收集。
  const pinIds = [];
  {
    const seen = new Set();
    for (const m of body.matchAll(/\bdata-pin="([^"]+)"/g)) {
      const id = m[1];
      if (seen.has(id)) { errors.push(`${layout}: 坐标槽 data-pin="${id}" 页内重复（须唯一）`); continue; }
      seen.add(id); pinIds.push(id);
    }
  }

  // 2) 图槽：只替换 src（+ crop 外包），原 <img> 的 data-slot / data-layer / data-label / data-ratio 全部保留
  //    这些标记是编辑器图层的身份证；父容器补 data-filled 隐藏占位标签。
  for (const id of imgIds) {
    consumed.add(id);
    const v = fields[id];
    if (v === undefined) { errors.push(`${layout}: 图槽 "${id}" 未在 plan 中填报（必填）`); continue; }
    const imgSpec = imgValue(v, `${layout}:${id}`, errors, usedFiles, warns);
    if (!imgSpec) continue;

    // 标签定位不依赖属性顺序（class 是否首个属性、data-* 相对位置都不限定）
    const tagRe = new RegExp(`<img\\b[^>]*data-layer="${id}"[^>]*>`);
    const tagM = body.match(tagRe);
    if (!tagM) { errors.push(`${layout}: 图槽 ${id} 标签定位失败`); continue; }
    const origTag = tagM[0];

    // 先定位包裹容器（最近一个 .ph-img 开标签）：data-filled 与容器级 data-ratio 回退都要用
    const at = body.indexOf(origTag);
    const before = body.slice(0, at);
    const opens = [...before.matchAll(/<([a-z0-9]+)\b[^>]*\bclass="[^"]*\bph-img\b[^"]*"[^>]*>/g)];
    const lastOpen = opens[opens.length - 1];

    // ratio 软校验：优先读母版 img 标签；img 上没写则回退读 .ph-img 容器（规范允许两处任写其一）
    const ratioM = origTag.match(/data-ratio="([0-9:]+)"/) || (lastOpen ? lastOpen[0].match(/data-ratio="([0-9:]+)"/) : null);
    if (ratioM && imgSpec.spec.src && imgSpec.buf) {
      const [rw, rh] = ratioM[1].split(':').map(Number);
      // 复用 imgValue 已读的 buf，避免二次 readFileSync
      // 尺寸头解析 PNG/JPEG/WebP 全支持（imageDims）；GIF 预转换成真 PNG 后才走到这里
      const dims = imageDims(imgSpec.buf);
      if (dims) {
        const want = rw / rh, got = dims.w / dims.h;
        if (Math.abs(got - want) / want > 0.45) {
          // 措辞按 data-fit 分流：cover 差异=裁切量大；contain 差异=留白量大，不裁切
          const fit = (lastOpen && lastOpen[0].match(/data-fit="([^"]*)"/)?.[1] || 'cover').toLowerCase();
          warns.push(`${layout}: 图槽 ${id} 比例差异大（槽 ${ratioM[1]} vs 图 ${dims.w}x${dims.h}），${fit === 'contain' ? 'contain 留白量大，核对槽声明或换图' : 'cover 裁切量大，建议 crop'}`);
        }
      }
    }

    let newTag = origTag.replace(/\bsrc="[^"]*"/, `src="${imgSpec.dataUrl}"`);
    if (imgSpec.cropStyle) {
      // 危险边界：contain 槽（整图完整显示）与 crop 互斥——crop 会把槽放大成条带再强制 cover，
      // 毁掉整图显示且无提示，命中即 fail，二选一。
      const fitAttr = (lastOpen && lastOpen[0].match(/\bdata-fit="([^"]*)"/)?.[1] || 'cover').toLowerCase();
      if (fitAttr === 'contain') {
        errors.push(`${layout}: 图槽 ${id} 声明 data-fit="contain"（整图完整显示）但 plan 写了 crop——两者互斥（crop 会把该槽放大成条带再 cover，毁掉整图显示）；二选一：去掉 crop，或确认要裁切后改槽为 cover`);
      } else {
        newTag = `<span class="ph-img__crop" style="position:absolute;inset:0;overflow:hidden;display:block;">${newTag.replace('<img ', `<img style="position:absolute;object-fit:cover;${imgSpec.cropStyle}" `)}</span>`;
      }
    }

    // 容器开标签补 data-filled（隐藏 .ph-img__label 占位文字）
    let prefix = before;
    if (lastOpen && !/<\/(?:div|span|figure|li|section)\b/i.test(before.slice(lastOpen.index + lastOpen[0].length))) {
      const filled = /\bdata-filled\b/.test(lastOpen[0]) ? lastOpen[0] : lastOpen[0].replace(/>$/, ' data-filled>');
      prefix = before.slice(0, lastOpen.index) + filled + before.slice(lastOpen.index + lastOpen[0].length);
    }
    body = prefix + newTag + body.slice(at + origTag.length);
  }

  // 2.5) 坐标槽注入：元素带 data-pin="<fields 键>"，plan 传 {x, y}（0-100 百分比，AI 看图给出）。
  //      参照系由母版 markup 上的 data-pin-frame 声明，render 不认母版名：
  //      · stage（默认）＝手机内屏截图内的功能点 → 注入 CSS 变量 --pin-x/--pin-y（stage 中心 +
  //        内屏 38.98×84.26cqw 换算）与 data-side；呈现形态（卡片旁置对齐）全由母版
  //        CSS 消费变量完成，render 只算几何。几何常数来自 style.css 共享段：N40 phone 宽 46cqw、
  //        内屏 w84.73% h92.30%、frame 1806/910，内屏中心≈stage 中心（flex 居中，边距差 <0.1%）。
  //      · percent＝宿主定位容器（如截图框）内的目标点 → 直接注入 left/top 百分比 + transform
  //        居中，元素钉在给点上；无变量、无 side。
  //      不传坐标 → 跳过注入，元素保持母版默认形态；坐标槽是可选槽，不填不算缺槽。
  let pinInjected = 0, pinMissing = 0;
  const sidePins = []; // stage 型钉位 {id, side, y}：同侧重叠检测用（如 N40 浮动标注卡）
  for (const id of pinIds) {
    consumed.add(id);
    const v = fields[id];
    if (v === undefined || v === null) { pinMissing++; continue; }
    pinInjected++;
    if (typeof v !== 'object' || Array.isArray(v) || !Number.isFinite(Number(v.x)) || !Number.isFinite(Number(v.y))) {
      errors.push(`${layout}: 坐标槽 "${id}" 必须是 {x: 0-100, y: 0-100} 对象`); continue;
    }
    const x = Number(v.x), y = Number(v.y);
    if (x < 0 || x > 100 || y < 0 || y > 100) warns.push(`${layout}: 坐标槽 "${id}" 的 x/y 超出 0-100，已钳制到边界`);
    const cx = Math.max(0, Math.min(100, x)), cy = Math.max(0, Math.min(100, y));
    const tagRe = new RegExp(`<([a-z0-9]+)\\b[^>]*\\bdata-pin="${id}"[^>]*>`);
    const tagM = body.match(tagRe);
    if (!tagM) { errors.push(`${layout}: 坐标槽 "${id}" 元素定位失败`); continue; }
    const orig = tagM[0];
    let pinStyle; let extraAttr;
    if (/data-pin-frame="percent"/.test(orig)) {
      pinStyle = `left:${cx.toFixed(2)}%;top:${cy.toFixed(2)}%;right:auto;bottom:auto;transform:translate(-50%,-50%);`;
      extraAttr = 'data-pinned="1"';
    } else {
      const nx = (cx / 100 - 0.5).toFixed(4);
      const ny = (cy / 100 - 0.5).toFixed(4);
      pinStyle = `--pin-x:calc(50% + (${nx}) * 38.98cqw);--pin-y:calc(50% + (${ny}) * 84.26cqw);`;
      if (y < 10 || y > 90) warns.push(`${layout}: 坐标槽 "${id}" 的 y=${Math.round(y)} 过贴上下边，标注卡可能溢出舞台（建议 y 在 10-90）`);
      extraAttr = `data-pinned="1" data-side="${x < 50 ? 'left' : 'right'}"`;
      sidePins.push({ id, side: x < 50 ? 'left' : 'right', y: cy });
    }
    const tagged = /\bstyle="([^"]*)"/.test(orig)
      ? orig.replace(/\bstyle="([^"]*)"/, (_, s) => `style="${s};${pinStyle}"`).replace(/>$/, ` ${extraAttr}>`)
      : orig.replace(/>$/, ` ${extraAttr} style="${pinStyle}">`);
    body = body.replace(orig, tagged);
  }
  if (pinInjected > 0 && pinMissing > 0) {
    warns.push(`${layout}: 坐标槽部分传入（${pinInjected} 注入 / ${pinMissing} 未传）——钉位形态将不一致，建议全部传入或全部不传`);
  }
  // 同侧卡片重叠检测（stage 型钉位，如 N40 浮动标注卡）：同侧两卡 y 间距 <18%（卡高约 15cqw，母版 CSS 标定）→ WARN。
  // 卡片贴 side 外缘、纵向对齐 y，重叠只能靠拉开 y 或换侧（x ≥50→right / <50→left）消解，机器只提示不改动。
  for (let i = 0; i < sidePins.length; i++) {
    for (let j = i + 1; j < sidePins.length; j++) {
      const a = sidePins[i], b = sidePins[j];
      const gap = Math.abs(a.y - b.y);
      if (a.side === b.side && gap < 18) {
        warns.push(`${layout}: 同侧(${a.side})标注卡 "${a.id}" 与 "${b.id}" y 间距 ${gap.toFixed(0)}% < 18%，卡片可能重叠——拉开 y 或把其中一张换侧（x 改 ≥50 到右侧 / <50 到左侧）`);
      }
    }
  }

  // 3) frame-img 手机框（单源内嵌：仅当本页真有手机框槽才读取共享 PNG 现场编码，缺文件即停）
  //    不依赖 class 与 src 的属性顺序：整标签匹配后在标签内替换 src
  if (/<img\b[^>]*\bframe-img\b/.test(body)) {
    const frameSrc = getFrameDataUrl();
    body = body.replace(/<img\b[^>]*>/g, (tag) =>
      /\bframe-img\b/.test(tag) ? tag.replace(/\bsrc="[^"]*"/, `src="${frameSrc}"`) : tag);
  }

  // 4) 文字槽（以 repeat 替换后 body 中残留的 {{}} 为准 = 顶层槽）
  //    page-no / progress 是机械槽，不读 fields，留给步骤 6/6.6 单独注入；此处跳过避免误报"为空"。
  const remaining = [...new Set([...body.matchAll(/\{\{([^}]+)\}\}/g)].map((m) => m[1].trim()))];
  for (const name of remaining) {
    if (name === 'page-no' || name === 'progress') continue;
    consumed.add(name);
    const v = fields[name];
    if (v === undefined || v === null || v === '') {
      // 可选槽（元素带 data-optional）：留空合法，占位符清空，节点变空由 CSS :empty 隐藏（如大数字轻量标题）
      if (isOptionalSlot(body, name)) { body = body.split(`{{${name}}}`).join(''); continue; }
      errors.push(`${layout}: 槽 "${name}" 为空（必填）`); continue;
    }
    const sv = String(v);
    checkRich(sv, `${layout}:${name}`, errors);
    // 白名单标签保留生效，裸 < > 转义显示（白名单外标签已在 checkRich 硬停）
    body = body.split(`{{${name}}}`).join(richHtml(sv));
  }

  // 5) plan 多余字段。page-no 是机械槽：plan 手填属违规（页码只由 render 生成），给专门提示并计入 consumed 防止重复报错。
  if (Object.prototype.hasOwnProperty.call(fields, 'page-no')) {
    errors.push(`${layout}: plan 禁止手填 page-no 字段（页码由 render 按页序机械生成，格式 nn / 总页数、封面 nn=01 隐藏；契约见 references/CONTRACT.md 系统槽）`);
    consumed.add('page-no');
  }
  if (Object.prototype.hasOwnProperty.call(fields, 'progress')) {
    errors.push(`${layout}: plan 禁止手填 progress 字段（清单进度由 render 按伪随机勾选数机械生成 done/total；契约见 references/CONTRACT.md 系统槽）`);
    consumed.add('progress');
  }
  for (const k of Object.keys(fields)) {
    if (!consumed.has(k)) {
      // 对未知键做一次最近匹配，直接告诉正确键名（候选含已消费槽，打错系统槽名也能纠）
      const hit = nearestSlot(k, [...new Set([...names, ...repeatNames, ...imgIds, ...consumed])]);
      errors.push(`${layout}: plan 字段 "${k}" 与母版槽位对不上${hit ? `——是不是 "${hit}"？` : ''}`);
    }
  }

  // 6) 页码注入/隐藏（残留校验之前）：总页数取 plan.pages.length，与 --only 无关
  const pg = injectPageNo(body, nn, total, layout, errors);
  body = pg.body;
  if (sysTally['page-no'] && !pg.found) errors.push(`${layout}: 母版有 data-sys="page-no" 但注入定位失败`);

  // 6.5/6.6) 清单伪随机勾选 + 进度注入（同在残留校验之前）
  const ck = assignRandDone(body, nn);
  body = ck.body;
  const pr = injectProgress(body, ck.done, ck.total, layout, errors);
  body = pr.body;
  if (sysTally['progress'] && !pr.found) errors.push(`${layout}: 母版有 data-sys="progress" 但注入定位失败`);

  // 7) {{ 残留 + layer 唯一
  const residual = body.match(/\{\{[^}]*\}\}/g);
  if (residual) errors.push(`${layout}: {{ 占位符残留: ${residual.slice(0, 4).join(' ')}${residual.length > 4 ? ' …' : ''}}`);
  const layers = [...body.matchAll(/data-layer="([^"]+)"/g)].map((m) => m[1]);
  const dup = layers.filter((v, i) => layers.indexOf(v) !== i);
  if (dup.length) errors.push(`${layout}: data-layer 重复 ${[...new Set(dup)].join(',')}`);

  // 归档系统槽信息供 fields.json 转写：品牌槽值取 meta，page-no/progress 取机械值
  return { body, unitLayerMaps, sysTally, pageNoValue: pg.pageNoValue, pageNoHidden: pg.hidden, progressValue: pr.progressValue };
}
let _frame = null;
function getFrameDataUrl() {
  if (!_frame) {
    const f = path.join(ROOT, 'styles/assets/iphone-frame.png');
    if (!fs.existsSync(f)) fail(`手机框资产缺失：${f}\n  该文件是 render 必需资产，请确认已纳入版本库（git add）`);
    try { _frame = 'data:image/png;base64,' + fs.readFileSync(f).toString('base64'); }
    catch (e) { fail(`手机框资产读取失败：${f}\n  ${e.message}`); }
  }
  return _frame;
}

// ---------- 字数软校验（解析说明头"限制"行） ----------
// 计数口径（母版说明头「限制」行的两种写法）：
//   `≤N字`   = 视觉宽度单位（1 单位 ≈ 一个汉字宽）。汉字/全角 = 1；ASCII 四类宽度由 script/font-weights.json
//              按「当前实际命中字体」查表决定（见下方 ACTIVE_WIDTH）；空白 0；HTML 标签 0；emoji 等 = 1。
//              权重表缺失或无命中时退回内置兜底（见 FALLBACK_WIDTH，现值 0.71/0.61/0.62/0.61；
//              兜底须 ≥ 任何可能命中字体的上限）。宁可早告警，不放过溢出。
//              换字体/换机 → 重跑 `node script/font-weights.mjs` 刷新权重表；`--font-report` 可核对命中 face。
//   `≤N字符` = 实际字符个数（ASCII/数字槽的原始意图，如 big-num≤3字符、app≤14字符）。
//   为何区分：按码点算宽度会让「10 字的英文单词」独占 10 字位（实际只占约 5.2 字宽），
//   而 ASCII 短槽（编号/型号/文件名）要的确实是字符个数，不能被宽度稀释。
const CHAR_TOLERANCE = 0.2;   // 超限 20% 以内不告警（同一字号下偶发换行可接受）
// 内置兜底权重（权重表缺失/损坏时的最后防线）。
// 判据：兜底必须 ≥ **任何可能命中字体、任何字重档**的实测上限，否则缺表时会低估宽度、让本该告警的文案静默通过。
// 现值按 26 字母全量采样、覆盖两档与全部候选族：微软雅黑 700 档大写 0.7048 为最高项（mac PingFang SC 700 0.6839、
// Songti SC 700 0.6712、等宽族 0.6021 均低于它），取 0.71 留余量；数字最高为雅黑 700 档 0.6167，取 0.62；
// 小写与半角标点由等宽族主导（Menlo 0.6021），取 0.61。改字体栈时若引入更宽的字面，这里要跟着抬。
const FALLBACK_WIDTH = { upper: 0.71, lower: 0.61, digit: 0.62, punct: 0.61 };

// 字宽权重表（script/font-weights.json，由 script/font-weights.mjs 生成；换字体/换机后重跑该脚本）。
// 为什么不用浏览器运行时探测：字数校验发生在填槽阶段、浏览器尚未启动；且「装没装某套字体」是机器属性、
// 「某套字体的字宽」是字体属性——前者由本表 platforms 记、后者由 weights 记，换机只补 platforms，不必重测已有族。
// 取用语义：CSS 三栈各自按声明顺序找第一个「本平台真装且有实测权重」的族——
//   serif 走各平台系统宋体（mac Songti / win SimSun）、sans 走苹方/雅黑、mono 走 Menlo/Consolas；
//   每族先在自身 400/700 两档里逐类取大（二档制两档都在用、真 Bold 面 advance 更宽，只量 400 会低估 bold），
//   再三套命中字体每类取上限。全部按实际命中查表，换机/换字重字体时权重自动跟着变，无需装任何字体文件。
let ACTIVE_WIDTH = { ...FALLBACK_WIDTH };
let WIDTH_SOURCE = { serif: '内置兜底', sans: '内置兜底', mono: '内置兜底' };
let ROLE_WIDTH = { serif: null, sans: null, mono: null };
try {
  const wf = path.join(ROOT, 'script', 'font-weights.json');
  // 表不在要明说：兜底是小写/数字/标点都偏宽的保守值，这次的字数校验会比平时更严
  if (!fs.existsSync(wf)) {
    const f = FALLBACK_WIDTH;
    console.warn(`⚠ 未找到 script/font-weights.json：本次用内置兜底 ${f.upper}/${f.lower}/${f.digit}/${f.punct} 校验字宽（偏保守）；换字体或换机后请重跑 node script/font-weights.mjs`);
  }
  if (fs.existsSync(wf)) {
    const table = JSON.parse(fs.readFileSync(wf, 'utf8'));
    const cssText = fs.readFileSync(CSS_FILE, 'utf8');
    // 解析 :root 里 --serif/--sans/--mono 的字体族声明顺序（去掉引号和关键字 serif/sans-serif/monospace）
    const roleStack = (role) => {
      const m = cssText.match(new RegExp('--' + role + '\\s*:\\s*([^;]+);'));
      if (!m) return [];
      return m[1].split(',').map((s) => s.trim().replace(/^["']|["']$/g, ''))
        .filter((s) => s && !/^(serif|sans-serif|monospace)$/.test(s));
    };
    const generics = { serif: 'serif', sans: 'sans-serif', mono: 'monospace' };
    // 跨平台累积表取用判据：该族「在本机平台真装」且有实测权重。
    // 老表（没有 platforms 字段）退回 installed 判定，保证旧表仍可用。
    const PLAT = process.platform;
    const usableOnThisMachine = (p) => {
      if (!p || !p.weights) return false;
      if (p.platforms && typeof p.platforms === 'object') return p.platforms[PLAT] === true;
      return !!p.installed;
    };
    const pick = (role) => {
      for (const fam of roleStack(role)) {
        // 精确名或 family 首词匹配（表里 key = 完整族名，栈里也是完整族名）
        const p = table.profiles?.[fam];
        if (!usableOnThisMachine(p)) continue;
        // 表 weights = { "400": {...}, "700": {...} }（二档制全档位）：两档逐类取大——
        // 真 Bold 面 advance 可能比 400 宽（实测 PingFang SC 大写 0.6689→0.6839、Songti SC 0.6625→0.6712），
        // 建模必须覆盖实际渲染会用到的最宽档，宁可早告警、不放过溢出
        const w = {};
        for (const cat of ['upper', 'lower', 'digit', 'punct']) {
          const vals = ['400', '700'].map((t) => p.weights[t]?.[cat]).filter((v) => typeof v === 'number');
          if (vals.length) w[cat] = Math.max(...vals);
        }
        return { fam, w };
      }
      return null;
    };
    const picked = { serif: pick('serif'), sans: pick('sans'), mono: pick('mono') };
    const cats = ['upper', 'lower', 'digit', 'punct'];
    // 三套命中字体每类取上限：宁可早告警，不放过溢出（与旧模型口径一致）
    for (const cat of cats) {
      const vals = Object.values(picked).filter(Boolean).map((p) => p.w[cat]).filter((v) => typeof v === 'number');
      if (vals.length) ACTIVE_WIDTH[cat] = Math.max(...vals);
    }
    for (const role of ['serif', 'sans', 'mono']) {
      WIDTH_SOURCE[role] = picked[role]?.fam || generics[role] + '(未装/回退)';
      ROLE_WIDTH[role] = picked[role]?.w || null;   // 仅供 --font-report 打印「建模值」对照
    }
    // 兜底自检：表里的值一旦超过内置兜底，说明兜底已过期——表缺失时会低估宽度、静默漏报超限。
    // 这里不自动抬高兜底（兜底是常量，不该被数据反向改写），只把漂移喊出来，由人改常量。
    for (const cat of cats) {
      if (ACTIVE_WIDTH[cat] > FALLBACK_WIDTH[cat]) {
        console.warn(`⚠ 字宽权重表 ${cat}=${ACTIVE_WIDTH[cat]} 已超过内置兜底 ${FALLBACK_WIDTH[cat]}：表缺失/损坏时会低估宽度、漏报超限。请同步提高 render.mjs 的 FALLBACK_WIDTH`);
      }
    }
  }
} catch (e) {
  // 权重表损坏不该让整个出图崩掉——退回兜底并提示
  console.warn('⚠ 字宽权重表读取失败，使用内置兜底：' + (e && e.message));
}
const isFullWidth = (ch) => /[\u1100-\u115F\u2E80-\u303F\u3041-\u33FF\u3400-\u4DBF\u4E00-\u9FFF\uA000-\uA4CF\uAC00-\uD7A3\uF900-\uFAFF\uFE10-\uFE6F\uFF01-\uFF60\uFFE0-\uFFE6]/.test(ch);
function charWidth(ch) {
  const code = ch.codePointAt(0);
  if (code <= 0x20 || ch === '\u00a0') return 0;
  if (code < 0x7f) {
    if (code >= 0x41 && code <= 0x5a) return ACTIVE_WIDTH.upper;
    if (code >= 0x61 && code <= 0x7a) return ACTIVE_WIDTH.lower;
    if (code >= 0x30 && code <= 0x39) return ACTIVE_WIDTH.digit;
    return ACTIVE_WIDTH.punct;
  }
  if (isFullWidth(ch)) return 1;
  return 1;   // emoji / 其他文字符号按一个汉字宽（保守）
}
function stripMarkup(value) {
  // 只剥「标签形态」的片段，与 checkRich 的 TAG_LOOKING 同口径：
  // 裸尖括号（"A < B > C"）会被 richHtml 转义成可见文字，属可见字符——按标签剥掉会少算字数、漏报超限
  return String(value).replace(/<[^>]+>/g, (m) => (TAG_LOOKING.test(m) ? '' : m)).replace(/\s+/g, '');
}
function countWidth(value) {
  let sum = 0;
  for (const ch of stripMarkup(value)) sum += charWidth(ch);
  return Math.round(sum * 10) / 10;
}
function countChars(value) {
  return Array.from(stripMarkup(value)).length;
}
// 限制键 → 实际字段键的四种命名写法都要认，否则该条限制静默失效：
//   ① 同名：`verdict` → verdict
//   ② 族名：`th` → th1..th4、`q` → q1/q2、`tab` → tab1..tab3（键名 + 数字）
//   ③ 区间：`c1..c3` → c1/c2/c3（与说明头「槽位」行同一记号）
//   ④ 通配：`sm*-label` → sm1-label、`b*-tag` → b1-tag（`*` 只吞序号，不吞字母，避免 `c*` 误伤 `cta`）
const escapeRe = (s) => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
function expandLimitKey(key) {
  const m = key.match(/^([A-Za-z]+)(\d+)\.\.([A-Za-z]+)(\d+)$/);
  if (!m) return [key];
  const out = [];
  for (let i = +m[2]; i <= +m[4]; i++) out.push(`${m[1]}${i}`);
  return out;
}
function matchesLimit(fieldKey, limitKey) {
  return expandLimitKey(limitKey).some((key) => {
    // 通配键必须最先分流：`*` 不被 escapeRe 转义，若落入下方 `^key\d+$` 分支会构造出
    // `^*-head\d+$` 这类以 * 开头的非法正则直接抛 SyntaxError（`*-` 开头必崩、字母前缀如
    // `r*-label` 虽合法但语义错乱）——通配走专用匹配，其余键才走同名/族名/区间。
    if (key.includes('*')) return new RegExp(`^${escapeRe(key).replace(/\*/g, '[-0-9]*')}$`).test(fieldKey);
    if (fieldKey === key) return true;
    if (fieldKey.split('-')[0] === key) return true;
    if (new RegExp(`^${escapeRe(key)}\\d+$`).test(fieldKey)) return true;
    return false;
  });
}
function wordWarnings(headerText, filledValues, layout, warns) {
  if (!headerText) return;
  const line = headerText.split('\n').map((s) => s.trim()).find((l) => l.startsWith('限制：'));
  if (!line) return;
  const emit = (key, byWidth, limit, msg) => {
    const ceiling = limit + Math.ceil(limit * CHAR_TOLERANCE);
    for (const k of Object.keys(filledValues).filter((k) => matchesLimit(k, key))) {
      const v = filledValues[k];
      if (typeof v !== 'string') continue;
      msg(k, v, byWidth, limit, ceiling);
    }
  };
  const cmp = (n, ceiling) => n > ceiling;
  // ① `key≤N行每行≤M字/字符`——行数与单行宽度都要管（紧连写法，当前母版未使用；它不匹配 ② 的正则，
  //    若未来某槽需要行数+单行双重校验用此写法，删除此分支会使该写法静默失效）
  for (const m of line.matchAll(/([A-Za-z0-9*.-]+)≤(\d+)行每行≤(\d+)(字符|字)/g)) {
    const [, key, maxLines, perLimit, unit] = m;
    const byWidth = unit === '字';
    emit(key, byWidth, +perLimit, (k, v, bw, limit, ceiling) => {
      // 先按 <br> 切行，再剥其余标签——顺序反了会把 br 一起剥掉，多行被当成一行
      const lines = String(v).split(/<br\s*\/?>|\n/i).map((s) => s.replace(/<[^>]+>/g, (m) => (TAG_LOOKING.test(m) ? '' : m)).trim()).filter(Boolean);
      if (lines.length > +maxLines) warns.push(`${layout}: "${k}" ${lines.length} 行超限（≤${maxLines} 行），可能溢出`);
      lines.forEach((ln, i) => {
        const n = bw ? countWidth(ln) : countChars(ln);
        if (cmp(n, ceiling)) warns.push(`${layout}: "${k}" 第 ${i + 1} 行${bw ? `宽度 ${n}` : `字符数 ${n}`} 超限（每行≤${limit}${bw ? ' 字位' : ' 字符'}），可能溢出`);
      });
    });
  }
  // ② `key≤N字/字符`——单槽总量。`字` 走视觉宽度、`字符` 走实际字符数，两条口径不同但都要解析
  for (const m of line.matchAll(/([A-Za-z0-9*.-]+)≤(\d+)(字符|字)/g)) {
    const byWidth = m[3] === '字';
    emit(m[1], byWidth, +m[2], (k, v, bw, limit, ceiling) => {
      const n = bw ? countWidth(v) : countChars(v);
      if (!cmp(n, ceiling)) return;
      warns.push(bw
        ? `${layout}: "${k}" 宽度 ${n} 超限（≤${limit} 字位，容差上限 ${ceiling}），可能溢出`
        : `${layout}: "${k}" 字符数 ${n} 超限（≤${limit} 字符，容差上限 ${ceiling}），可能溢出`);
    });
  }
}

// ---------- 主流程 ----------
const sections = extractSections(fs.readFileSync(TPL, 'utf8'));
const cssText = fs.readFileSync(CSS_FILE, 'utf8');
const headerComments = {};
{
  const re = /<!--\s*=+\s*(N\d+[^=]*?)\s*=+\s*([\s\S]*?)-->/g;
  const tpl = fs.readFileSync(TPL, 'utf8');
  let m;
  while ((m = re.exec(tpl))) headerComments[m[1].trim().split(/\s+/)[0]] = m[2];
}

const pages = plan.pages || [];
if (!pages.length) fail('plan.json 无页面');
const targets = ONLY ? pages.filter((p) => ONLY.some((o) => String(p.nn || '').padStart(2, '0') === o.padStart(2, '0'))) : pages;
if (!targets.length) fail('--only 过滤后无页面');

// 字数校验权重来源（诊断，便于换机/降级后核对；不写产物）
console.log(`📏 字宽权重：serif=${WIDTH_SOURCE.serif} / sans=${WIDTH_SOURCE.sans} / mono=${WIDTH_SOURCE.mono} → 取上限 ${ACTIVE_WIDTH.upper}/${ACTIVE_WIDTH.lower}/${ACTIVE_WIDTH.digit}/${ACTIVE_WIDTH.punct}`);

// ---------- GIF 预转换 ----------
// 只处理"老实声明 .gif"的输入：canvas 取第一帧转真 PNG，产物写任务运行区（.gif.png 后缀，不在交付白名单），
// plan 内 src 原地改写指向新文件 → 主循环与 imgValue 走既有 PNG 通道，零改动。
// 扩展名与内容不符的伪装（如 GIF 改名 .png）不由本 pass 处理，仍由 imgValue 魔数校验硬停。
// 收集 fields 里的图片引用。契约两种形态都收（SKILL「图槽值=相对路径或 {src, crop}」）：
// 对象形态记 spec 本体（改 spec.src 即生效）；字符串简写形态记宿主对象与键（改 host[key] 即生效）。
// 缺字符串分支时，字符串引用的 GIF 走不到预转换、在 imgValue 被白名单硬停，与"老实声明 .gif 可自动转"的口径矛盾。
function collectImageSpecs(v, out = []) {
  if (Array.isArray(v)) { v.forEach((item) => collectImageSpecs(item, out)); return out; }
  if (v && typeof v === 'object') {
    if (typeof v.src === 'string' && v.src) out.push({ spec: v });
    for (const [key, val] of Object.entries(v)) {
      if (key === 'src') continue;   // spec 对象的 src 已按 {spec} 记录，防双记双写
      if (typeof val === 'string' && val && path.extname(val).toLowerCase() === '.gif') out.push({ host: v, key });
      else if (val && typeof val === 'object') collectImageSpecs(val, out);
    }
  }
  return out;
}

let gifInst = null;   // 转换用浏览器实例；截图阶段复用，避免二次启动
{
  const byFile = new Map();   // 绝对路径 → 引用该文件的记录列表：同一 GIF 可被多槽引用，转换一次、全部改写
  for (const ref of collectImageSpecs(targets.map((p) => p.fields || {}))) {
    const src = ref.spec ? ref.spec.src : ref.host[ref.key];
    const file = resolveInTask(src, null, null);
    if (!file) continue;   // 越界路径不在预转换阶段读文件——交给 imgValue 硬报错（带完整槽位上下文）
    if (path.extname(file).toLowerCase() !== '.gif' || !fs.existsSync(file)) continue;
    if (!byFile.has(file)) byFile.set(file, []);
    byFile.get(file).push(ref);
  }
  if (byFile.size) {
    console.log(`🖼 检测到 ${byFile.size} 个 GIF 输入，取首帧转 PNG…`);
    try {
      gifInst = await launchBrowser(createOptions({ width: 256, height: 256, dsf: 1 }));
      for (const [file, refs] of byFile) {
        const gifB64 = fs.readFileSync(file).toString('base64');
        const dataUrl = await withPage(gifInst, 'about:blank',
          { width: 256, height: 256, dsf: 1, timeout: 20000, fontTimeout: 1000 },
          async (ctx) => evaluate(ctx.cdp, ctx.sessionId, `(async () => {
            const img = new Image();
            img.src = 'data:image/gif;base64,${gifB64}';
            await img.decode();
            const c = document.createElement('canvas');
            c.width = img.naturalWidth; c.height = img.naturalHeight;
            c.getContext('2d').drawImage(img, 0, 0);
            return c.toDataURL('image/png');
          })()`, { awaitPromise: true, timeoutMs: 20000 }));
        if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/png;base64,'))
          throw new Error(`未得到 PNG dataURL（Got ${typeof dataUrl}）`);
        // 产物名固定为 <file>.png，同名已存在则加数字后缀并 WARN，避免静默覆盖
        let suffix = '.png';
        if (fs.existsSync(file + suffix)) {
          let n = 2;
          while (fs.existsSync(file + `-${n}.png`)) n++;
          suffix = `-${n}.png`;
          console.warn(`⚠ GIF 预转换产物重名：${path.basename(file)}.png 已存在，本次产物改写为 ${path.basename(file)}${suffix}`);
        }
        fs.writeFileSync(file + suffix, Buffer.from(dataUrl.slice('data:image/png;base64,'.length), 'base64'));
        for (const ref of refs) {
          if (ref.spec) ref.spec.src = ref.spec.src + suffix;
          else ref.host[ref.key] = ref.host[ref.key] + suffix;
        }
        console.log(`   ✅ ${refs[0].spec ? refs[0].spec.src : refs[0].host[refs[0].key]}（${refs.length} 处引用）`);
      }
      // GIF 任务提前启动了浏览器：若主循环后续 fail() 直接退出，closeBrowser 的异步清理走不到——
      // 同步 exit 兜底杀子进程并删临时目录，防 Chrome 进程/目录泄漏（正常路径仍由 finally closeBrowser 收尾）
      const leaked = gifInst;
      process.on('exit', () => {
        try { leaked.child.kill('SIGKILL'); } catch { /* already exited */ }
        try { fs.rmSync(leaked.userDataDir, { recursive: true, force: true }); } catch { /* busy */ }
      });
    } catch (e) {
      if (gifInst) await closeBrowser(gifInst).catch(() => {});
      fail(`GIF 首帧转换失败：${(e && e.message) || e}`);
    }
  }
}

const usedFiles = [];
const allWarns = [];
const built = [];
for (const page of targets) {
  const nn = String(page.nn || '').padStart(2, '0');
  if (!nn || nn === '00') fail('每页需 nn 序号');
  // page.name 会拼进 P 页文件名与 manifest，含非法字符会在落盘/拷贝时炸出难查的错误——入口即拦
  if (page.name && /[\\/:*?"<>|]/.test(String(page.name))) fail(`P${nn}: page.name 含文件名非法字符（/ \\ : * ? " < > |）："${page.name}"`);
  // custom 页禁区正则（i：HTML 标签/属性/媒体查询大小写不敏感，<SCRIPT>/@MEDIA/POSITION:FIXED 同样生效）
  // 分三组，全覆盖不开口子：
  //   ① 布局劫持：position:fixed、@media（响应断点会让静态卡片随屏漂移）
  //   ② 脚本/动画标签：<script>、<animate> 及 SVG 同类 <animateMotion>/<animateTransform>/<set>
  //      —— 标签后加 \b 边界，<scriptData> 这类同名前缀不会误伤；<\s* 容忍 < script 空格
  //   ③ 动效 CSS：animation / transition（静态交付页不该有自主动效）
  // 禁区清单与每条缘由见 styles/improvisation.md「三条硬约束」第 3 条；此处是实现，改动须同步该节。
  const CUSTOM_FORBIDDEN_RE = /position\s*:\s*fixed|@media|<\s*\/?\s*(?:script|animate|animatetransform|animatemotion|set)\b|animation\s*:|transition\s*:/i;
  if (page.layout === 'custom/...' || String(page.layout).startsWith('custom/')) {
    if (!page.markup) fail(`P${nn}: custom 页需 markup`);
    // 根节点校验复用 rootOf 单源（按 class 分词判含 artwork-page，属性顺序无关）；
    // 不照抄旧严格正则（那要求 class 是首个属性且值以 artwork-page 开头，合规重排会被误停）
    let rootTag = null;
    try { rootTag = rootOf(page.markup).rootTag; }
    catch (e) { fail(`P${nn}: custom markup 根节点异常：${e.message}`); }
    if (!rootTag || !/data-artwork/.test(rootTag) || !/data-size="1080x1440"/.test(rootTag)) fail(`P${nn}: custom markup 根节点须为 .artwork-page + data-artwork + data-size`);
    const layers = [...page.markup.matchAll(/data-layer="([^"]+)"/g)].map((m) => m[1]);
    const dup = layers.filter((v, i) => layers.indexOf(v) !== i);
    if (dup.length) fail(`P${nn}: custom markup data-layer 重复 ${[...new Set(dup)].join(',')}`);
    if (CUSTOM_FORBIDDEN_RE.test(page.markup)) fail(`P${nn}: custom markup 含禁区属性（布局劫持 / 脚本动画标签 / 动效 CSS，大小写不敏感）`);
    // T13：custom 页不做槽位填充，{{}} 残留会原样印进成品——硬停；fields 对 custom 页无效，只提醒
    if (/\{\{/.test(page.markup)) fail(`P${nn}: custom markup 含 {{占位符}} 残留——custom 页不做槽位填充，把文案直接写进 markup（一个 {{ 都不留），或转正为母版`);
    if (page.fields && Object.keys(page.fields).length) allWarns.push(`P${nn} · ${page.name || `custom-${nn}`}: fields 对 custom 页无效（custom 页不做槽位填充，文案已写死在 markup；fields.json 不记录）`);
    built.push({ nn, name: page.name || `custom-${nn}`, html: page.markup, custom: true, fields: page.fields || {} });
    continue;
  }
  const layout = String(page.layout || '');
  if (!sections.has(layout)) fail(`P${nn}: layout "${layout}" 在 templates.html 中不存在`);
  const fields = page.fields || {};
  const errors = []; const warns = [];
  const { body, unitLayerMaps, sysTally, pageNoValue, pageNoHidden, progressValue } =
    fillSection(layout, sections.get(layout), fields, errors, warns, usedFiles, plan.meta, nn, pages.length);
  if (errors.length) {
    console.error(`\n❌ P${nn} · ${layout} 校验失败（即停）：`);
    errors.forEach((e) => console.error('   - ' + e));
    process.exit(1);
  }
  // 字数软校验要覆盖 repeat 条目：说明头的「限制」行可能写单元短名（n/t/d），
  // 只传顶层 fields 会让这类键静默失效；这里把数组展开成与克隆体一致的短名（-2/-3 后缀）。
  const wordFields = {};
  for (const [k, v] of Object.entries(fields)) {
    if (Array.isArray(v)) v.forEach((item, i) => {
      if (!item || typeof item !== 'object') return;
      for (const [ik, iv] of Object.entries(item)) wordFields[i === 0 ? ik : `${ik}-${i + 1}`] = iv;
    });
    else wordFields[k] = v;
  }
  wordWarnings(headerComments[layout.split('-')[0]], wordFields, `P${nn}`, warns);
  allWarns.push(...warns);
  // 母版页 rootOf 与 custom 分支同样包 try/catch——画布根损坏时给友好 fail，不抛裸堆栈
  let rootTag, inner;
  try { ({ rootTag, inner } = rootOf(body)); }
  catch (e) { fail(`P${nn}: 母版 "${layout}" 画布根异常：${e.message}`); }
  const rootClose = '</div>';
  const masterHtml = `  ${rootTag}\n${inner}\n  ${rootClose}`;
  built.push({ nn, name: page.name || layout, html: masterHtml, custom: false, layout, fields, unitLayerMaps, sysTally, pageNoValue, pageNoHidden, progressValue });
}

// ---------- 写产物 ----------
// 只读体检不建 assets、不拷素材副本（与「只读」口径一致：诊断不消费图片文件）
// 没用到图片时不建空目录（assets/ 只承载用了的素材副本；图形产物由 figure.mjs 自己建目录写 figures/）
if (!DIAG_ONLY && usedFiles.length) {
  fs.mkdirSync(path.join(taskDir, 'assets'), { recursive: true });
  for (const f of new Set(usedFiles)) fs.copyFileSync(f, path.join(taskDir, 'assets', path.basename(f)));
}

// 交付页 CSS：防御性剥离 @import 行（默认字体策略为本机字体栈，源 CSS 已不含外链；编辑器打包器拒绝外链）
const cssInline = cssText.split('\n').filter((l) => !/^\s*@import\b/.test(l)).join('\n');

for (const b of built) {
  const pageHtml = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<title>P${b.nn} · ${b.name}</title>
<style>
${cssInline}
</style>
</head>
<body>
${b.html}
</body>
</html>
`;
  // 只读体检走临时 HTML（跑完即删），不覆盖正式 P 页；其余流程照旧写正式文件
  const htmlFile = DIAG_ONLY ? `_diag-P${b.nn}.html` : `P${b.nn}-${b.name}.html`;
  fs.writeFileSync(path.join(taskDir, htmlFile), pageHtml);
  b.file = htmlFile;
}

// fields.json（plan 转写：键 = 页面真实 data-layer id，编辑器契约初稿）
// 注：图槽键的值仍是 plan 申报的原值（`{src, crop}` 对象或路径字符串）——编辑器当前不读 fields.json（T6 未做），届时按 image 图层消费
// repeat 条目短名经 unitLayerMaps 映射为单元元素的 data-layer，并加与克隆体一致的 -2/-3 后缀
// 仅 --with-editor 生成（默认生图交付只给 HTML + PNG + preview.png，不产编辑器契约件）；
// --only 单页调试与只读体检也不写——这两个文件是跨页聚合件，单页版会覆盖多页正式版
if (EDITOR_OUT) {
  // 图槽值统一落到交付区可解析的 `assets/<basename>`（与 editor.manifest.json.assetDirs 对齐）：
  // 素材副本按 basename 平铺在 assets/，plan 里的 `shots/xxx.png` 只存在于运行区，交付目录没有 shots/。
  // 两种写法都要改：对象形态 `{src, crop}` 与字符串形态 `"shots/x.png"`。
  // 判据用「绝对路径命中已用素材表」，不靠键名猜槽类型——字符串槽（纯文案）永远命中不了，天然不受影响。
  const assetMap = new Map();
  for (const f of new Set(usedFiles)) assetMap.set(path.resolve(f), `assets/${path.basename(f)}`);
  const toAssetRef = (src) => assetMap.get(path.resolve(taskDir, src)) || src;
  const normField = (v) => {
    if (typeof v === 'string') return toAssetRef(v);
    if (v && typeof v === 'object' && typeof v.src === 'string') return { ...v, src: toAssetRef(v.src) };
    return v;
  };
  const pagesOut = [];
  for (const b of built) {
    const flat = {};
    // custom 页不做槽位填充，plan.fields 对它无效——不转写，避免 fields.json 记页面里不存在的值
    for (const [k, v] of Object.entries(b.custom ? {} : b.fields)) {
      if (Array.isArray(v)) {
        const map = b.unitLayerMaps?.get(k);
        v.forEach((item, i) => {
          for (const [ik, iv] of Object.entries(item)) {
            const layer = map?.get(ik) || ik;           // 单元内短名 → 该元素的 data-layer
            flat[i === 0 ? layer : `${layer}-${i + 1}`] = normField(iv);
          }
        });
      } else flat[k] = normField(v);
    }
    // 系统槽：品牌槽从 meta 展开、页码取机械值，仅当该页母版确有对应 data-sys 槽时写入，
    // 保证 fields.json 与页面可见内容一致、编辑器打开即见当前值（meta 缺失则该槽保留母版默认，不写）。
    if (!b.custom && b.sysTally) {
      const brand = plan.meta && plan.meta.brand ? plan.meta.brand : {};
      for (const [sys, key] of Object.entries(SYS_META_KEY)) {
        if (b.sysTally[sys] && brand[key] !== undefined && brand[key] !== null && brand[key] !== '') {
          flat[`sys-${sys}`] = String(brand[key]);
        }
      }
      if (b.sysTally['page-no']) flat['sys-page-no'] = b.pageNoValue;   // 封面为 ''，与 display:none 一致
      if (b.sysTally['progress']) flat['sys-progress'] = b.progressValue;
    }
    pagesOut.push({ id: `p${b.nn}`, fields: flat });
  }
  fs.writeFileSync(path.join(taskDir, 'fields.json'), JSON.stringify({ canvas: { width: 1080, height: 1440 }, pages: pagesOut }, null, 2));
}

// editor.manifest.json（同上：仅 --with-editor 生成，且 --only / 只读体检都不写）
if (EDITOR_OUT) {
  fs.writeFileSync(path.join(taskDir, 'editor.manifest.json'), JSON.stringify({
    format: 'pageapp-editor-manifest', version: 1,
    root: '.artwork-page', canvas: { width: 1080, height: 1440 }, layerMode: 'markers',
    assetDirs: ['./assets'],
    pages: built.map((b) => ({ file: `P${b.nn}-${b.name}.html`, id: `p${b.nn}`, name: `P${b.nn} · ${b.name}` })),
  }, null, 2));
}

// ---------- 字体体检输出（--font-report）----------
function printFontReport(rep, tag) {
  console.log(`🔎 ${tag} 字体体检：document.fonts=${rep.status}；@font-face 声明 ${rep.faces.length} 个（加载成功 ${rep.loadedFaces}）`);
  const tally = new Map();
  for (const a of rep.actual) tally.set(a.face, (tally.get(a.face) || 0) + 1);
  console.log('   实际命中 face：' + ([...tally].map(([f, n]) => `${f}×${n}`).join(' · ') || '未读到'));
  for (const role of ['serif', 'sans', 'mono']) {
    const w = rep.widths?.[role];
    for (const t of ['400', '700']) {
      if (w?.[t]) console.log(`   字宽实测 ${role}(${t},100px)：汉字 ${w[t].han} · 大写 ${w[t].upper} · 小写 ${w[t].lower} · 数字 ${w[t].digit} · 半角标点 ${w[t].punct}`);
    }
    const m = ROLE_WIDTH[role];
    if (m) console.log(`   建模值  ${role}（${WIDTH_SOURCE[role]}，两档取大）：大写 ${m.upper} · 小写 ${m.lower} · 数字 ${m.digit} · 半角标点 ${m.punct}`);
  }
  for (const warn of rep.warnings) console.warn('   ⚠ ' + warn);
}

// ---------- 截图 ----------
const opts = createOptions({ selector: '.artwork-page', waitSelector: '.artwork-page', timeout: 60000 });
const inst = gifInst || await launchBrowser(opts);   // GIF 预转换已启动浏览器时直接复用
try {
  for (const b of built) {
    const file = path.join(taskDir, b.file || `P${b.nn}-${b.name}.html`);
    await withPage(inst, 'file:///' + file.replace(/\\/g, '/'), opts, async (ctx) => {
      if (FONT_REPORT) printFontReport(await fontReport(ctx), `P${b.nn}`);
      if (DIAG_ONLY) return;   // 只读体检：不截图、不写 PNG
      const shot = await captureReadyPage(ctx, opts);
      fs.writeFileSync(path.join(taskDir, `P${b.nn}-${b.name}.png`), shot.buffer);
      // 盒形比例诊断（纯读态 WARN）：实测 .ph-img 容器盒 vs 声明 data-ratio。
      // 须在 captureReadyPage 之后测（字体回流已稳定，与截图同帧）；只盯 cover 槽（contain 是留白非裁切）。
      // ⚠ 用 offsetWidth/Height（变换前布局盒）而非 getBoundingClientRect——后者是旋转后 AABB：
      // N04 后手机 rotate(-6deg) 会把 329x714 的真盒膨胀成 402x744（假阳性 17%）；cover 裁切发生在
      // 元素自身坐标系，旋转不改变裁切量，布局盒才是正确参照。比例是尺度不变量，页面整体 scale 无影响。
      const boxes = await evaluate(ctx.cdp, ctx.sessionId, `(() => {
        const out = [];
        document.querySelectorAll('[data-slot="image"]').forEach((img) => {
          const box = img.closest('.ph-img');
          if (!box) return;
          if ((box.getAttribute('data-fit') || '').toLowerCase() !== 'cover') return;
          const ratio = img.getAttribute('data-ratio') || box.getAttribute('data-ratio');
          if (!ratio || !/^[0-9]+:[0-9]+$/.test(ratio)) return;
          const w = box.offsetWidth, h = box.offsetHeight;
          if (w < 8 || h < 8) return;
          const [rw, rh] = ratio.split(':').map(Number);
          if (!rw || !rh) return;
          const want = rw / rh;
          out.push({ id: img.getAttribute('data-layer') || '?', ratio, dev: Math.abs(w / h - want) / want, w, h });
        });
        return out;
      })()`);
      if (boxes.length) {
        const bad = boxes.filter((c) => c.dev >= 0.15);
        for (const c of bad)
          console.warn(`⚠ P${b.nn} · ${b.name}: 图槽 ${c.id} 盒形比例偏差大（声明 ${c.ratio} vs 实测盒 ${c.w}x${c.h}，偏差 ${Math.round(c.dev * 100)}%），cover 裁切量大——核对声明值或加 crop`);
        console.log(`📐 P${b.nn} 盒形比例: ${boxes.length} 槽 cover · 最大偏差 ${Math.round(Math.max(...boxes.map((c) => c.dev)) * 100)}%`);
      }
    });
    if (DIAG_ONLY) { fs.rmSync(file); continue; }   // 临时 HTML 跑完即删，不做几何/出图日志
    if (b.custom && GEOM) {
      await withPage(inst, 'file:///' + file.replace(/\\/g, '/'), opts, async (ctx) => {
        const geo = await evaluate(ctx.cdp, ctx.sessionId, `(() => {
          const page = document.querySelector('.artwork-page');
          const pr = page.getBoundingClientRect();
          const bad = [];
          page.querySelectorAll('*').forEach((el) => {
            const r = el.getBoundingClientRect();
            if (r.width === 0 && r.height === 0) return;
            if (r.right > pr.right + 2 || r.bottom > pr.bottom + 2 || r.left < pr.left - 2 || r.top < pr.top - 2)
              bad.push(el.tagName + '.' + String(el.className).split(' ')[0] + ' @' + Math.round(r.right - pr.right) + ',' + Math.round(r.bottom - pr.bottom));
          });
          return { overflow: page.scrollWidth > page.clientWidth + 2 || page.scrollHeight > page.clientHeight + 2, bad: bad.slice(0, 8) };
        })()`);
        if (geo.overflow || geo.bad.length) console.warn(`⚠ P${b.nn} 几何体检: overflow=${geo.overflow} 越界元素: ${geo.bad.join(' | ') || '无'}`);
        else console.log(`✓ P${b.nn} 几何体检通过`);
      });
    }
    console.log(`📸 P${b.nn} · ${b.name}`);
  }

  // preview.png 总览：跨页聚合件，--only（含只读体检）只跑了部分页，拼图只会把多页总览覆盖成残缺版，故不写
  if (!ONLY) {
    const files = built.map((b) => `P${b.nn}-${b.name}.png`);
    const gridHtml = `<!doctype html><html><head><meta charset="utf-8"><style>
      body{margin:0;background:#ECEEF3;font-family:sans-serif;padding:16px;}
      .g{display:grid;grid-template-columns:repeat(${Math.min(4, built.length)},1fr);gap:12px;}
      img{width:100%;display:block;border:1px solid #d5d9e0;}
    </style></head><body><div class="g">
      ${files.map((f) => `<img src="file:///${path.join(taskDir, f).replace(/\\/g, '/')}">`).join('\n')}
    </div></body></html>`;
    const tmp = path.join(taskDir, '_preview.html');
    fs.writeFileSync(tmp, gridHtml);
    await withPage(inst, 'file:///' + tmp.replace(/\\/g, '/'), { ...opts, selector: '.g', waitSelector: '.g' }, async (ctx) => {
      // 截 body 而不是整页：整页按视口高度（1440）出图，页数少时下方会留大片空白
      const shot = await captureReadyPage(ctx, { ...opts, selector: 'body' });
      fs.writeFileSync(path.join(taskDir, 'preview.png'), shot.buffer);
    });
    fs.rmSync(tmp);
  }
} finally { await closeBrowser(inst); }

// ---------- 交付：校验 + 截图全部通过后，才按白名单从运行区拷贝到交付目录 ----------
let delivered = null;
if (DELIVERY) {
  if (!FORCE && fs.existsSync(DELIVERY) && fs.readdirSync(DELIVERY).length) {
    fail(`交付目录已存在且非空：${DELIVERY}\n  重跑同一任务请加 --force（只覆盖白名单文件，不删其它内容），或换一个目录名`);
  }
  fs.mkdirSync(DELIVERY, { recursive: true });
  const white = [];
  for (const b of built) white.push(`P${b.nn}-${b.name}.html`, `P${b.nn}-${b.name}.png`);
  white.push('preview.png');
  if (WITH_EDITOR) white.push('fields.json', 'editor.manifest.json');
  for (const f of white) {
    const src = path.join(taskDir, f);
    if (!fs.existsSync(src)) fail(`交付白名单文件缺失：${f}`);
    fs.copyFileSync(src, path.join(DELIVERY, f));
  }
  if (WITH_EDITOR) {
    // 逐文件拷贝（不用 fs.cpSync：该调用在本环境会令进程静默退出 127）
    const a = path.join(taskDir, 'assets');
    if (fs.existsSync(a)) {
      const dstA = path.join(DELIVERY, 'assets');
      fs.mkdirSync(dstA, { recursive: true });
      for (const f of fs.readdirSync(a)) {
        const s = path.join(a, f);
        if (fs.statSync(s).isFile()) fs.copyFileSync(s, path.join(dstA, f));
      }
    }
  }
  delivered = { dir: DELIVERY, count: white.length };
}

if (DIAG_ONLY) console.log(`\n✅ ${built.length} 页字体体检完毕（只读：未写 P 页/PNG/fields/manifest/preview）`);
else console.log(`\n✅ ${built.length} 页出图完毕 → ${rel(taskDir)}（任务运行区）`);
if (DIAG_ONLY) console.log('ℹ 只读体检：本次未出图、未交付（--delivery / plan.delivery 已忽略）');
else if (delivered) console.log(`📦 交付目录 → ${delivered.dir}（${delivered.count} 个文件${WITH_EDITOR ? ' + assets/' : ''}；plan.json / 过程件未拷入）`);
else console.log('ℹ 未指定 --delivery 或 plan.delivery：本次只写任务运行区，未生成交付目录');
if (allWarns.length) {
  console.log('⚠ 软校验 WARN:');
  allWarns.forEach((w) => console.log('   - ' + w));
}
