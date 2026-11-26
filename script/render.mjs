#!/usr/bin/env node
/* render.mjs · 实例化器——生产环境固定脚本，不是临时文件
 * 用法：node script/render.mjs <任务工作区>/ [--delivery=<交付目录>] [--with-editor] [--force] [--check-geometry] [--only=N01,N02] [--font-report] [--preflight]
 *   --preflight 是写 plan 后的静态预检：只跑填槽与素材校验，输出「格式 / 图槽比例 / 覆盖 / 完整性 / 版式节奏」后退出，
 *              不启动截图、不写 P 页与交付目录。用它替代「先渲染一遍看看报什么」。详见文件末尾 buildStaticReport。
 *   --font-report 是诊断开关（不进常规出图）：打印每页实际命中字体、三套字体栈的字宽实测，
 *                 并与权重表里的建模值逐族对照（实测≠建模时要能一眼看出原因），见 shared/cdp.mjs fontReport
 *   --only + --font-report = 只读诊断：只写临时 HTML 跑体检、跑完即删；不写 P 页 / PNG / fields.json / manifest / preview.png。
 *     单独 --font-report（无 --only）= 出图时顺带体检；单独 --only（无 --font-report）= 只出指定页到系统临时目录，便于快速看效果。
 *     临时产物不进任务工作区；跨页聚合件（preview / fields / manifest）一律不写。
 * 输入：<任务工作区>/plan.json + 素材图片（相对任务工作区）
 * 目录模型（技能安装目录只读，运行期零写入）：
 *   ① 技能安装目录 = 本文件所在仓库：styles/ + script/，只读资产与代码（开发期文档与施工台账不随生产包分发）
 *   ② 任务工作区 = agent 临时会话目录：只放 plan.json / 素材 / 清单 md；渲染生成物一律不写这里
 *   ③ 系统临时产物目录 = fs.mkdtempSync(os.tmpdir())：P 页 HTML/PNG、preview、fields/manifest/assets 副本；
 *      交付成功、只读诊断或中途出错退出后自动删除，未交付时保留并在终端打印路径
 *   出图倍率：默认 2x（PNG 像素 2160×2880，画布逻辑尺寸仍 1080×1440）——小图位降采样糊的对策；
 *   COVER_DSF=1 可临时回退 1x，见 shared/cdp.mjs createOptions
 *   ④ 交付目录 = 用户选中的工作区（--delivery 或 plan.delivery，写绝对路径，命名 YYYY-MM-DD-<小标题>）：校验+截图全过后按白名单拷贝
 * 交付白名单（默认，编辑器不在默认链路上）：P<nn>-<名>.html + P<nn>-<名>.png + preview.png + assets/（有图才建）
 *   --with-editor 追加：fields.json + editor.manifest.json（仅用户要开编辑器时才走；事后再要可跑 editor-prep 补 manifest）
 * 硬校验（即停）：{{ 残留 / 图片缺失或格式不符 / 根节点与画布 / 文字槽为空（可选槽除外） / plan 字段与槽位对不上 / repeat 区间 / 富文本白名单外标签
 *   / data-sys 白名单外取值 / plan 出现手填 page-no / progress 字段 / 编辑器契约：data-* 取值域与 data-layer 唯一（见 shared/editor.mjs）
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
import os from 'node:os';
import path from 'node:path';
import url from 'node:url';
import { launchBrowser, closeBrowser, withPage, evaluate, captureReadyPage, createOptions, fontReport } from './shared/cdp.mjs';
import { SYS_META_KEY, scanSysTags } from './shared/sys-slots.mjs';
import { rootOf, maskStyleBlocks } from './shared/markup.mjs';
import { resolveInDir, readImage, sniffMime } from './shared/image.mjs';
import { checkMarkerContracts, scanLayerMaps, buildManifest, MANIFEST_DEFAULTS } from './shared/editor.mjs';
import { checkComposed, checkCustomBasics, checkRoleFontSize, checkAllFontSizes, composedNotices } from './composed.mjs';

const ROOT = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..');
// ---------- 素材格式扫描（预检共用，放在最前：写 plan 之前也能单独跑）----------
// 只读文件头 32 字节做魔数嗅探：预检要扫整个工作区，不能把几十 MB 素材全读进内存。
const EXT_MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' };
const IMAGE_SCAN_RE = /\.(png|jpe?g|webp|gif|avif|heic|heif|tiff?|bmp)$/i;

function sniffFileHead(file) {
  let fd;
  try {
    fd = fs.openSync(file, 'r');
    const buf = Buffer.alloc(64);   // ftyp 的 compatible brands 可能排在 32 字节之后
    const n = fs.readSync(fd, buf, 0, 64, 0);
    return sniffMime(buf.subarray(0, n));
  } catch { return null; }
  finally { if (fd !== undefined) { try { fs.closeSync(fd); } catch {} } }
}

// 任务工作区内的图片文件（跳过隐藏目录；包含 figures/ 与预裁件）
function scanWorkspaceImages(dir) {
  const out = [];
  const walk = (d) => {
    let entries;
    try { entries = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (e.name.startsWith('.')) continue;
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (IMAGE_SCAN_RE.test(e.name)) out.push(p);
    }
  };
  walk(dir);
  return out;
}

// 扩展名声明 vs 文件头实际内容。两个入口共用：写 plan 前的格式预检、--preflight 的①表。
function collectFormatIssues(dir) {
  const files = scanWorkspaceImages(dir);
  const bad = [];
  let ok = 0;
  const rel = (f) => path.relative(dir, f).replace(/\\/g, '/');
  for (const f of files) {
    const ext = path.extname(f).toLowerCase();
    const actual = sniffFileHead(f);
    const expect = EXT_MIME[ext];
    if (!expect) {
      if (ext === '.gif' && actual === 'image/gif') { ok++; continue; }   // GIF 母版图槽可自动取首帧
      bad.push({ file: rel(f), msg: actual ? `扩展名 ${ext} 不受支持（实际 ${actual}），须转成 PNG/JPEG/WebP` : `扩展名 ${ext} 不受支持，须转成 PNG/JPEG/WebP` });
      continue;
    }
    if (!actual) { bad.push({ file: rel(f), msg: '文件头无法识别，请重新导出为 PNG/JPEG/WebP' }); continue; }
    if (actual !== expect) {
      bad.push({ file: rel(f), msg: `扩展名声明 ${expect}，实际内容 ${actual}；先转码再引用（render 会直接拒绝）` });
      continue;
    }
    ok++;
  }
  return { files, bad, ok };
}
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
// 静态预检：写 plan 后跑一遍，把「格式 / 图槽比例 / 覆盖 / 完整性 / 版式节奏」提前到出图之前暴露。
// 它不截图、不写产物，因此也不吃 --delivery / --check-geometry（那两项只对成品有意义）。
const PREFLIGHT = argv.includes('--preflight');
// 字体体检：默认关闭（每页要多走一次全量 DOM + 逐文字节点协议往返），只在核对字面/重测字宽时开
const FONT_REPORT = argv.includes('--font-report');
const onlyArg = flagValue('--only');
// 只读体检模式：--only + --font-report 时，只生成临时 HTML 跑字体体检，绝不写正式产物。
// 避免诊断顺带把 fields/manifest/preview 覆盖成单页版、污染正式任务工作区（多页任务工作区尤其明显）。
const DIAG_ONLY = FONT_REPORT && onlyArg !== null;
// --only 同时接受 02 / N02 / P02 三种写法（plan.nn 是两位数字）；显式传空值报错，防止静默退化成全量渲染
let ONLY = null;
if (onlyArg !== null) {
  ONLY = onlyArg.split(',').map((s) => s.trim().replace(/^[NPnp]/, '')).filter(Boolean);
  if (!ONLY.length) fail('--only 不能为空：请写 --only=N01,N02（也接受 02 / P02 写法）');
}
// 编辑器产物（fields.json / editor.manifest.json）按需生成，默认生图链路不产：
//   ① 只有 --with-editor 才写——默认交付就是 P 页 HTML + PNG + preview.png + assets/，编辑器不在默认链路上；
//   ② --only 单页调试不写——这两个是跨页聚合件，单页版会把多页任务工作区的正式版本覆盖掉；
//   ③ 只读体检（DIAG_ONLY）不写——诊断不落任何正式文件。
const EDITOR_OUT = WITH_EDITOR && !ONLY && !DIAG_ONLY;
const deliveryArg = flagValue('--delivery');
// 先解析带值参数，避免把 "--only N01,N02" / "--delivery <路径>" 的值误认成任务目录
const taskArg = argv.find((a, i) => !a.startsWith('--') && !consumedIdx.has(i)) || '';
const taskDir = path.resolve(taskArg || '');

// --preflight 允许没有 plan.json：识图盘点阶段先把「扩展名 vs 实际内容」批量扫一遍（AVIF 改名图在这里现形），
// 不必等到写完 plan 才发现素材读不出来。必须显式给目录——不给就落到当前目录，会把技能仓库当素材扫。
const planFile = taskArg ? path.join(taskDir, 'plan.json') : '';
if (!taskArg || !fs.existsSync(planFile)) {
  if (PREFLIGHT && taskArg && fs.existsSync(taskDir) && fs.statSync(taskDir).isDirectory()) {
    const { files, bad, ok } = collectFormatIssues(taskDir);
    console.log('🔍 预检 --preflight（未找到 plan.json：只验素材格式）\n');
    console.log(`① 素材格式 · ${files.length} 个图片文件，正常 ${ok}，需处理 ${bad.length}`);
    for (const r of bad) console.log(`   ✗ ${r.file} — ${r.msg}`);
    console.log('');
    console.log(bad.length ? '❌ 先转码上面这些素材，再继续识图与写 plan' : '✅ 素材格式全部可用，可以继续识图');
    process.exit(bad.length ? 2 : 0);
  }
  console.error('用法: node script/render.mjs <任务工作区>/ [--delivery=<交付目录>] [--with-editor] [--force] [--check-geometry] [--only=N01,N02] [--preflight]  （任务工作区须含 plan.json；--preflight 可只验素材格式）');
  process.exit(2);
}
const plan = JSON.parse(fs.readFileSync(path.join(taskDir, 'plan.json'), 'utf8'));
const STYLE = plan.style;
if (!STYLE) fail('plan.json 缺 style 字段');

// ---------- 交付目录（安装目录 / 任务工作区 / 系统临时产物 / 交付目录 分离）----------
// --delivery=<路径> 优先；否则读 plan.delivery；都没有则只写系统临时产物、不产出交付目录。
// 相对路径按当前工作目录解析（命令通常在安装目录下执行，故交付请写绝对路径；脚本会拒绝落在安装目录内的交付目录）。
const DELIVERY_RAW = deliveryArg !== null ? deliveryArg : (plan.delivery ? String(plan.delivery) : '');
if (deliveryArg === '') fail('--delivery 不能为空：请写 --delivery=<目录>，或省略该参数只写系统临时产物');
// 只读诊断（--only + --font-report）不产出交付物：忽略 --delivery / plan.delivery，既不报错也不拷贝。
// 否则带 delivery 的正式任务无法就地体检，与「可在正式任务工作区直接跑」的用法矛盾。
// 单独 --only 同样忽略 plan.delivery：调试不该逼人改 plan；显式 --delivery 仍然报错（见下），防止写出半套交付。
// --preflight 与只读诊断一样不产出交付：显式 --delivery 被忽略并提示，不做目录冲突检查
const DELIVERY = (DIAG_ONLY || PREFLIGHT || (ONLY && deliveryArg === null)) ? null : (DELIVERY_RAW ? path.resolve(DELIVERY_RAW) : null);
if (PREFLIGHT && deliveryArg !== null) console.warn('⚠ --preflight 只做静态预检，不产出交付：--delivery 已忽略');
if (DELIVERY && DELIVERY === taskDir) fail('交付目录不能等于任务工作区（过程件与成品必须分开）');
// --only 是调试开关：只出部分页会形成「新页 + 旧页」混装包，故禁止与显式 --delivery 同用。
// 只读诊断（DIAG_ONLY）的 DELIVERY 已在上方置 null，因此不受这道守卫限制。
if (ONLY && deliveryArg !== null && DELIVERY) fail('--only 仅用于调试，不能与显式 --delivery 同用（plan 里的 delivery 会自动忽略）；正式交付请跑完整页数');
if (ONLY && !DIAG_ONLY) console.warn('⚠ --only 是单页调试：只把指定页写到系统临时产物目录，便于快速看效果；preview / fields / manifest 不写，plan 里的 delivery 自动忽略');
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

// 所有渲染生成物写系统临时目录：任务工作区只保留 plan.json / 素材 / 清单 md，不出现 HTML / PNG。
const OUT = fs.mkdtempSync(path.join(os.tmpdir(), 'cover-skill-'));
// 中途失败（fail / 未捕获异常）时收掉半成品临时目录，不留在 /tmp 里堆积；
// 正常「未交付」收尾要把目录留给用户看效果，用 keepOut 豁免。
let keepOut = false;
process.on('exit', () => { if (!keepOut) { try { fs.rmSync(OUT, { recursive: true, force: true }); } catch {} } });
const isInside = (p, dir) => { const r = path.relative(dir, p); return r === '' || (!r.startsWith('..') && !path.isAbsolute(r)); };
if (DELIVERY && isInside(DELIVERY, taskDir)) fail('交付目录不能放在任务工作区内：任务工作区只放 plan/素材，交付目录请另选位置');
// 安装目录运行期只读：相对 --delivery 会在安装目录下解析，误写会把交付物落进技能仓库
if (DELIVERY && isInside(DELIVERY, ROOT)) fail('交付目录不能放在技能安装目录内：请写用户工作区的绝对路径（如 /Users/…/2026-01-01-小标题）');

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
// data-sys 白名单与占位符配对规则在 shared/sys-slots.mjs（与 composed.mjs 的静态校验同一份）。
// 品牌三槽由 meta.brand 注入；page-no 由 render 机械生成；issue 是普通文字槽，不在注入函数内。
// 扫 body 里所有 data-sys 节点做白名单校验；返回计数（供 fields 展开与体检）。
function checkSysTags(body, layout, errors, warns) {
  return scanSysTags(body, layout, errors, warns);
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
      // 注入整段替换节点内容，节点内含子元素会被静默清空——系统槽只准纯文本，硬停
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
// 只产出「assets 相对路径 + crop 样式」，不拼全新 <img> 标签。
// 母版 img 上的 data-slot/data-layer/data-label/data-ratio 是编辑器图层的身份证，
// 必须由 fillSection 在替换 src 时原样保留。
// 魔数嗅探已搬进 shared/image.mjs——母版槽位、custom 内联、静态单跑共用一份。

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

// 路径边界校验的实现在 shared/image.mjs（静态单跑也要用同一份），这里只绑定任务工作区目录。
function resolveInTask(src, where, errors) {
  return resolveInDir(src, taskDir, where, errors);
}

// GIF 预转换会把首帧 PNG 写到系统临时目录；该路径是绝对路径，但仍属受控输出，
// 因此读图时允许「任务工作区输入」与「临时输出」两个根。
function readImageValue(src, where, errors) {
  const abs = path.resolve(taskDir, src);
  if (isInside(abs, taskDir)) return readImage(abs, taskDir, where, errors, { dataUrl: false });
  if (isInside(abs, OUT)) return readImage(abs, OUT, where, errors, { dataUrl: false });
  resolveInDir(src, taskDir, where, errors);   // 越界：复用 shared 的同一句报错
  return null;
}

// 交付素材登记：图片不再内嵌 base64，统一引用 `assets/<文件名>`。
// 同一文件只登记一次；不同目录下的同名文件加 `-2/-3` 后缀，保证 HTML 引用与 assets/ 实际文件一致。
const assetRefs = new Map();   // 绝对路径 → assets/<文件名>
const assetNames = new Set();
function assetRefFor(file) {
  const abs = path.resolve(file);
  const hit = assetRefs.get(abs);
  if (hit) return hit;
  const raw = path.basename(abs);
  // 交付文件名要能安全放进 src：空格/引号/#/?/%/冒号统一换成 -，保留中英文与 ._-。
  const safe = raw.replace(/["'<>&#?%:\\\s]+/g, '-') || 'asset';
  const safeExt = path.extname(safe);
  const base = path.basename(safe, safeExt);
  let name = safe;
  let key = name.toLowerCase();   // macOS 常见大小写不敏感文件系统：Foo.png 与 foo.png 不能共存
  let n = 2;
  while (assetNames.has(key)) { name = `${base}-${n++}${safeExt}`; key = name.toLowerCase(); }
  assetNames.add(key);
  const ref = `assets/${name}`;
  assetRefs.set(abs, ref);
  return ref;
}

function imgValue(v, where, errors, usedFiles, warns) {
  const spec = typeof v === 'string' ? { src: v } : v;
  if (!spec || typeof spec.src !== 'string' || !spec.src) { errors.push(`${where}: 图片值为空`); return null; }
  const img = readImageValue(spec.src, where, errors);
  if (!img) return null;
  usedFiles.push(img.file);
  const buf = img.buf;
  const src = assetRefFor(img.file);
  let cropStyle = null;
  if (spec.crop) {
    const crop = parseCrop(spec.crop);
    if (!crop) { errors.push(`${where}: crop 描述无法解析 "${spec.crop}"（例："下 55%" / "left 30%"）`); return null; }
    if (crop.raw < 5 || crop.raw > 99) warns.push(`${where}: crop "${spec.crop}" 百分比超出有效范围 5–99，已按 ${Math.round(crop.fraction * 100)}% 处理`);
    cropStyle = crop.axis === 'y'
      ? `height:${(100 / crop.fraction).toFixed(1)}%;width:100%;${crop.align === 'end' ? 'bottom:0;top:auto;' : crop.align === 'start' ? 'top:0;bottom:auto;' : 'top:50%;bottom:auto;transform:translateY(-50%);'}`
      : `width:${(100 / crop.fraction).toFixed(1)}%;height:100%;${crop.align === 'end' ? 'right:0;left:auto;' : crop.align === 'start' ? 'left:0;right:auto;' : 'left:50%;right:auto;transform:translateX(-50%);'}`;
  }
  return { src, cropStyle, spec, buf };
}

// custom 页（补空 / 组合）的图：markup 里的 <img src> 写的是相对任务工作区的路径，
// 出图时统一改写成交付目录的 `assets/<文件名>`，由写产物阶段把文件复制到 assets/。
// 复用母版页同一套路径边界与 MIME 校验并登记 usedFiles。
// 无 src / 空 src 的 <img> 直接报错：图槽没有「可省」机制，写了 img 就必须给图；不要图就删掉整个节点。
// <style> 块先换成哨兵再扫：注释里举例的 <img> 不是真图，否则正常书写会被硬停。
function inlineCustomImages(html, where, errors, usedFiles, warns) {
  const { masked, restore } = maskStyleBlocks(html);
  const out = masked.replace(/<img\b[^>]*>/gi, (tag) => {
    if (/\bsrcset\s*=/i.test(tag)) {
      errors.push(`${where}: <img> 不支持 srcset——交付只改写 src，srcset 的多倍图不会被处理；删掉 srcset 只留 src`);
      return tag;
    }
    const m = tag.match(/\bsrc\s*=\s*(["'])([^"']*)\1/i);
    if (!m) { errors.push(`${where}: <img> 缺 src——图槽没有「可省」机制，写了就必须给图；不要图就删掉整个 img 节点`); return tag; }
    const src = m[2].trim();
    if (!src) { errors.push(`${where}: <img> 的 src 为空——填相对任务工作区的图片路径，或删掉整个 img 节点`); return tag; }
    if (/^data:/i.test(src)) {                       // 已内嵌，机器无法校验格式
      warns.push(`${where}: <img src="data:…"> 已内嵌——建议改相对路径，让工具链统一转码、校验并复制进 assets/`);
      return tag;
    }
    if (/^(?:https?:)?\/\//i.test(src)) {
      errors.push(`${where}: <img> 不接受外链 ${src}——把图存到任务工作区再写相对路径`);
      return tag;
    }
    const spec = imgValue({ src }, where, errors, usedFiles, warns);
    if (!spec) return tag;                            // 校验失败已记 error，保留原标签让上层 fail
    return tag.replace(m[0], () => `src="${spec.src}"`);
  });
  return restore(out);
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

// slotReports：图槽静态样本（图尺寸 / 槽声明比例 / 偏差），供 buildStaticReport 汇总。
// 比例判断不在填槽时直接 WARN——同一个结论要同时服务「出图前提示」和「--preflight 表格」，集中算一次。
function fillSection(layout, body, fields, errors, warns, usedFiles, meta, nn, total, slotReports) {
  const placeholders = [...body.matchAll(/\{\{([^}]+)\}\}/g)].map((m) => m[1].trim());
  const names = [...new Set(placeholders)];
  // 占位符 → 所在图层的映射必须在替换前算：替换之后 {{名}} 已被文案顶掉，映射无从谈起。
  // fields.json 的键要用图层 id 而不是占位符名，转写全靠这张表。系统槽映射同源同扫，顺手一起拿。
  const { slots: slotLayerMap, sys: sysLayerMap } = scanLayerMaps(body);
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
        if (v === undefined || v === null || v === '') {
          // 单元内可选槽：母版节点带 data-optional 时留空合法，占位符清空后交给 CSS :empty 隐藏
          if (isOptionalSlot(u.html, ph)) { html = html.split(`{{${ph}}}`).join(''); continue; }
          errors.push(`${layout}: "${u.arr}[${i}].${ph}" 为空`);
          continue;
        }
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

    // 图槽比例采样：优先读母版 img 标签；img 上没写则回退读 .ph-img 容器（规范允许两处任写其一）。
    // 这里只记录事实、不判定，阈值与措辞统一在 buildStaticReport（与渲染后盒形体检同为 15%）。
    const ratioM = origTag.match(/data-ratio="([0-9:]+)"/) || (lastOpen ? lastOpen[0].match(/data-ratio="([0-9:]+)"/) : null);
    if (slotReports && imgSpec.buf) {
      // 复用 imgValue 已读的 buf，避免二次 readFileSync；尺寸头解析 PNG/JPEG/WebP 全支持（imageDims）
      const dims = imageDims(imgSpec.buf);
      if (dims) {
        const fit = (lastOpen && lastOpen[0].match(/data-fit="([^"]*)"/)?.[1] || 'cover').toLowerCase();
        let ratio = null, dev = null;
        if (ratioM) {
          const [rw, rh] = ratioM[1].split(':').map(Number);
          const want = rw / rh;
          if (want > 0) { ratio = ratioM[1]; dev = Math.abs(dims.w / dims.h - want) / want; }
        }
        slotReports.push({ nn, layout, id, ratio, fit, w: dims.w, h: dims.h, dev });
      }
    }

    let newTag = origTag.replace(/\bsrc="[^"]*"/, `src="${imgSpec.src}"`);
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
  const emptySlots = new Map(); // 必填空槽先收集后报：未知键同源合并时能撤掉对应条目（见步骤 5）
  for (const name of remaining) {
    if (name === 'page-no' || name === 'progress') continue;
    consumed.add(name);
    const v = fields[name];
    if (v === undefined || v === null || v === '') {
      // 可选槽（元素带 data-optional）：留空合法，占位符清空，节点变空由 CSS :empty 隐藏（如大数字轻量标题）
      if (isOptionalSlot(body, name)) { body = body.split(`{{${name}}}`).join(''); continue; }
      emptySlots.set(name, true); continue;
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
      // 同源合并：仅当命中槽确实因缺键而空（fields 无此键、且在待报空槽清单里）才把三条并成一条根因；
      // fields 里有此键（拼错+真给了）、或距离太远无建议、或命中的是图槽/repeat 名——一律维持原样，不吞真错误。
      const mergeable = hit && emptySlots.has(hit) && fields[hit] === undefined;
      if (mergeable) {
        emptySlots.delete(hit);
        body = body.split(`{{${hit}}}`).join('');
        errors.push(`${layout}: plan 字段 "${k}" 与母版槽位对不上——是不是 "${hit}"？——${hit} 因此为空、{{${hit}}} 残留，改对键名即可`);
      } else {
        errors.push(`${layout}: plan 字段 "${k}" 与母版槽位对不上${hit ? `——是不是 "${hit}"？` : ''}`);
      }
    }
  }
  for (const name of emptySlots.keys()) errors.push(`${layout}: 槽 "${name}" 为空（必填）`);

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

  // 归档系统槽信息供 fields.json 转写：品牌槽值取 meta，page-no/progress 取机械值；
  // sysLayerMap 给的是「这个系统槽挂在哪个图层上」，键按它写，不按 sys-<值> 猜。
  return { body, unitLayerMaps, slotLayerMap, sysLayerMap, sysTally, pageNoValue: pg.pageNoValue, pageNoHidden: pg.hidden, progressValue: pr.progressValue };
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
// nn 是页码与文件名的主键：只接受 1–99 的整数，且全篇唯一（重复会让两页都按封面隐藏页码）。
const seenNn = new Set();
for (const p of pages) {
  const raw = String(p.nn ?? '').trim();
  if (!/^\d{1,2}$/.test(raw) || raw === '0' || raw === '00') fail(`每页 nn 需为 1–99 的整数：${JSON.stringify(p.nn)}`);
  const nn = raw.padStart(2, '0');
  if (seenNn.has(nn)) fail(`nn 重复：${nn}（每页必须有唯一页码）`);
  seenNn.add(nn);
}
// 手写页的运行时体检（越界/密度/压盖/孤字）是交付前提；不开开关就直接拒绝交付，避免假绿。
const hasCustomPages = pages.some((p) => String(p.layout || '').startsWith('custom/'));
if (DELIVERY && hasCustomPages && !GEOM) fail('任务含手写页（custom/*）：交付必须加 --check-geometry（越界 / 密度 / 压盖 / 孤字；组合页另含全量字号）');
const targets = ONLY ? pages.filter((p) => ONLY.some((o) => String(p.nn || '').padStart(2, '0') === o.padStart(2, '0'))) : pages;
// 部分页号写错时别静默跳过——--only=01,9 会把 9 当成不存在，只出 01，白跑一轮才发现
if (ONLY) {
  const hit = new Set(targets.map((p) => String(p.nn || '').padStart(2, '0')));
  const miss = ONLY.map((o) => o.padStart(2, '0')).filter((o) => !hit.has(o));
  if (miss.length) console.warn(`⚠ --only 里这些页号在 plan 中不存在，已跳过：${miss.join(', ')}`);
}
if (!targets.length) fail('--only 过滤后无页面');

// 字数校验权重来源（诊断，便于换机/降级后核对；不写产物）
console.log(`📏 字宽权重：serif=${WIDTH_SOURCE.serif} / sans=${WIDTH_SOURCE.sans} / mono=${WIDTH_SOURCE.mono} → 取上限 ${ACTIVE_WIDTH.upper}/${ACTIVE_WIDTH.lower}/${ACTIVE_WIDTH.digit}/${ACTIVE_WIDTH.punct}`);

// ---------- GIF 预转换 ----------
// 只处理"老实声明 .gif"的输入：canvas 取第一帧转真 PNG，产物写系统临时目录（<名>.png，重名加 -2 后缀，不在交付白名单），
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
// GIF 预转换阶段就要登记「已消费的源文件」（原 GIF 不在 usedFiles 里，避免覆盖检查误报），
// 因此必须在下面的 GIF 块之前初始化；否则带 GIF 的任务会撞 TDZ。
const consumedSources = new Set();
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
        consumedSources.add(path.resolve(file));   // 覆盖检查按「源文件已消费」处理，不报未引用
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
        // 产物写系统临时目录（不进任务工作区）；同名已存在则加数字后缀并 WARN，避免静默覆盖
        const outBase = path.join(OUT, path.basename(file).replace(/\.gif$/i, ''));
        let suffix = '.png';
        if (fs.existsSync(outBase + suffix)) {
          let n = 2;
          while (fs.existsSync(outBase + `-${n}.png`)) n++;
          suffix = `-${n}.png`;
          console.warn(`⚠ GIF 预转换产物重名：${path.basename(outBase)}.png 已存在，本次产物改写为 ${path.basename(outBase)}${suffix}`);
        }
        const outFile = outBase + suffix;
        fs.writeFileSync(outFile, Buffer.from(dataUrl.slice('data:image/png;base64,'.length), 'base64'));
        for (const ref of refs) {
          if (ref.spec) ref.spec.src = outFile;
          else ref.host[ref.key] = outFile;
        }
        console.log(`   ✅ ${path.basename(outFile)}（${refs.length} 处引用）`);
      }
      // GIF 任务提前启动了浏览器：主循环后续 fail() 直接退出时，closeBrowser 的异步清理走不到。
      // 子进程与临时目录的同步兜底已统一在 cdp.mjs 的 exit hook（所有实例注册），此处无需再挂。
    } catch (e) {
      if (gifInst) await closeBrowser(gifInst).catch(() => {});
      fail(`GIF 首帧转换失败：${(e && e.message) || e}`);
    }
  }
}

const usedFiles = [];
const slotReports = [];       // 图槽静态样本（见 fillSection 注释），供出图前预检与 --preflight 汇总
const allWarns = [];
const built = [];
let composedSeen = false;
let customSeen = false;   // 任一 custom 页（补空 / 组合）——体检提醒按它判，不按组合页
for (const page of targets) {
  const nn = String(page.nn || '').padStart(2, '0');
  if (!nn || nn === '00') fail('每页需 nn 序号');
  // page.name 会拼进 P 页文件名与 manifest，含非法字符会在落盘/拷贝时炸出难查的错误——入口即拦
  if (page.name && /[\\/:*?"<>|]/.test(String(page.name))) fail(`P${nn}: page.name 含文件名非法字符（/ \\ : * ? " < > |）："${page.name}"`);
  // custom 页禁区与根三件套的实现在 script/composed.mjs（checkCustomBasics / CUSTOM_FORBIDDEN_RE），
  // 即兴页与组合页共用一份：正则分组（布局劫持 / 脚本动画标签 / 动效 CSS）与每条缘由的说明也在那里维护。
  // 禁区清单的文档口径见 references/IMPROVISATION.md「四条硬约束」第 3 条，改动须三处同步。
  if (page.layout === 'custom/...' || String(page.layout).startsWith('custom/')) {
    if (!page.markup) fail(`P${nn}: custom 页需 markup`);
    // 根三件套 / 禁区 / 内联样式 / data-layer 唯一：与组合页共用 composed.mjs 的同一份实现。
    // 以前这里各写一套（含 data-size 写死双引号），两个入口的检查集合就会漂——单跑绿、出图红。
    const isComposed = Boolean(page.layoutBase) || /^custom\/composed-/.test(String(page.layout || ''));
    // 补空页没有任何样式通道（连 <style> 块都禁），组合页放行（值走令牌校验）——所以要先判出类型再查。
    checkCustomBasics(page.markup, `P${nn}: custom markup `, { allowStyleBlock: isComposed }).forEach((e) => fail(e));
    if (page.fields && Object.keys(page.fields).length) allWarns.push(`P${nn} · ${page.name || `custom-${nn}`}: fields 对 custom 页无效（custom 页不做槽位填充，文案已写死在 markup；fields.json 不记录）`);
    // 自由组合页（带 layoutBase 或 composed- 命名）额外走一遍静态规则；即兴补空页不经过。
    // 规则见 COMPOSED-MODE §2/§3/§5：layoutBase / 类名词表 / 四件套与禁区 / data-role / 填充声明。
    let customHtml = page.markup;
    // 图片改路径：custom 页的裸路径 <img src="shots/a.png"> 在这里登记并改写为 assets/<文件名>；
    // 无 src / 空 src 硬停。母版页走 fillSection 的 imgValue，本函数复用同一套边界校验。
    {
      const imgErrors = [];
      customHtml = inlineCustomImages(customHtml, `P${nn} · ${page.name || `custom-${nn}`}`, imgErrors, usedFiles, allWarns);
      if (imgErrors.length) {
        console.error(`\n❌ P${nn} · custom 页图片处理失败（即停）：`);
        imgErrors.forEach((e) => console.error('   - ' + e));
        process.exit(1);
      }
    }
    if (isComposed) {
      composedSeen = true;
      const { errors: cErrors, warns: cWarns } = checkComposed({ nn, page, total: pages.length, cssFile: CSS_FILE, baseDir: taskDir });
      if (cErrors.length) {
        console.error(`\n❌ P${nn} · 自由组合页校验失败（即停）：`);
        cErrors.forEach((e) => console.error('   - ' + e));
        process.exit(1);
      }
      allWarns.push(...cWarns);
      // 惰性系统槽注入（COMPOSED-MODE §3）：markup 里写了 data-sys 才填，没写就跳过——
      // 不强迫手写 markup 带槽，但带了就与母版同源，品牌名/页码不再各页各抄一份。
      // 校验对象始终是 plan 里写的 markup；injectPageNo 给封面补的 display:none 发生在校验之后，不算违规内联样式。
      const sysLabel = `${nn} · ${page.name || `custom-${nn}`}`;
      const sErrors = []; const sWarns = [];
      checkSysTags(customHtml, sysLabel, sErrors, sWarns);
      customHtml = injectMeta(customHtml, plan.meta, sysLabel, sErrors);
      customHtml = injectPageNo(customHtml, nn, pages.length, sysLabel, sErrors).body;
      // progress 必须与白名单同步：checkSysTags 放行 data-sys="progress"，这里不注入就会漏成 {{progress}} 残留，
      // 再被残留检查报成「只认系统槽」——白名单说能用、链路不给填，是最难查的那种不一致。
      const ck = assignRandDone(customHtml, nn);
      customHtml = ck.body;
      customHtml = injectProgress(customHtml, ck.done, ck.total, sysLabel, sErrors).body;
      if (sErrors.length) {
        console.error(`\n❌ P${nn} · 自由组合页系统槽注入失败（即停）：`);
        sErrors.forEach((e) => console.error('   - ' + e));
        process.exit(1);
      }
      allWarns.push(...sWarns);
    }
    // 槽位注入跑完仍有 {{}} = 没有填值通道的占位符，原样会印进成品——硬停。
    // 这条检查必须在注入之后，否则合规的 {{page-no}} 会被自己的残留检查误杀。
    // 文案按通道分开：组合页有三条注入通道，补空页一条都没有——写反了会教人写一个必然被拦的占位符。
    if (/\{\{/.test(customHtml)) {
      fail(isComposed
        ? `P${nn}: 组合页 markup 含 {{占位符}} 残留——注入通道只有系统槽（品牌三槽 / {{page-no}} / {{progress}}），其余占位符（如 {{issue}}）在组合页没有填值通道，把文案直接写进 markup`
        : `P${nn}: 补空页 markup 含 {{占位符}} 残留——补空页不做任何槽位填充（{{page-no}} 也不填），把文案直接写进 markup（一个 {{ 都不留），或转正为母版`);
    }
    built.push({ nn, name: page.name || `custom-${nn}`, html: customHtml, custom: true, composed: isComposed, fields: page.fields || {} });
    customSeen = true;
    continue;
  }
  const layout = String(page.layout || '');
  if (!sections.has(layout)) fail(`P${nn}: layout "${layout}" 在 templates.html 中不存在`);
  const fields = page.fields || {};
  const errors = []; const warns = [];
  const { body, unitLayerMaps, slotLayerMap, sysLayerMap, sysTally, pageNoValue, pageNoHidden, progressValue } =
    fillSection(layout, sections.get(layout), fields, errors, warns, usedFiles, plan.meta, nn, pages.length, slotReports);
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
  built.push({ nn, name: page.name || layout, html: masterHtml, custom: false, layout, fields, unitLayerMaps, slotLayerMap, sysLayerMap, sysTally, pageNoValue, pageNoHidden, progressValue });
}

// 编辑器契约：属性取值域 + 图层 id 规则，母版页与手写页都查。
// 违规的后果是打包器抛错（首错即停、一次只报一条），而打包发生在交付之后——出图前拦住，
// 报错才指得出是哪个属性写错，而不是让人对着一个 10MB 的产物页找。
// 这里同时收下每页的图层 id 集（checkMarkerContracts 扫描时本就算出来了），fields 转写与落盘自检直接复用。
for (const b of built) {
  const { errors: mErrors, warns: mWarns, ids } = checkMarkerContracts(b.html, `P${b.nn} · ${b.name}`);
  if (mErrors.length) {
    console.error(`\n❌ P${b.nn} · 编辑器契约校验失败（即停）：`);
    mErrors.forEach((e) => console.error('   - ' + e));
    console.error('   取值域真源见 pageApp《HTML产物交接规范》属性表');
    process.exit(1);
  }
  b.layerIdSet = ids;
  allWarns.push(...mWarns);
}

// 未实现项自曝 + 未开体检提醒：有 custom 页（补空或组合）时每次运行都喊，避免「以为已受约束」（COMPOSED-MODE §7）
if (customSeen) {
  if (composedSeen) allWarns.push(...composedNotices());
  // custom 页的密度/压盖/孤字（组合页还有全量字号）全在 --check-geometry 里；没开等于零体检出图，必须自己喊出来。
  // 补空页同样要密度体检，所以判据用 customSeen 而不是 composedSeen。
  if (!GEOM) allWarns.push(`WARN: 有${composedSeen ? '自由组合' : '手写'}页但未开 --check-geometry——密度 / 压盖 / 标题孤字${composedSeen ? ' / 全量字号' : ''}均未检查，等于零体检出图（交付前补跑 --check-geometry）`);
}

// ---------- 静态预检：出图前把「格式 / 图槽比例 / 覆盖 / 完整性 / 版式节奏」一次说清 ----------
// 背景：填槽阶段本来就能拿到图尺寸与槽声明比例，但旧实现把结论留到最后一行 WARN 才打印，
// 问题在出图中途就存在、却在截图全跑完之后才看见——只能靠再渲染一轮修正。
// 这里统一阈值并集中输出：--preflight 打完即退出；正式出图也会在启动浏览器前先亮风险。
const SLOT_RATIO_WARN = 0.15;      // 与渲染后盒形体检同阈值（IMAGE-WORKFLOW：偏差 ≥15%）
const FILLING_SLOT_WIDE = 2.2;     // 填充型槽没有 data-ratio，只能按图片形态给风险提示
const FILLING_SLOT_TALL = 0.6;
const LAYOUT_RUN_HARD = 3;          // 同一 layout 连续 ≥3 页：--preflight 硬错（2 连放行，兼容上下篇）
const LAYOUT_SHARE_WARN = 0.4;      // 单一 layout 占比 >40%：只 WARN（图集/清单类可天然集中）
const RHYTHM_MIN_PAGES = 6;         // 页数太少时占比没有统计意义

// 版式节奏：只看 plan.pages 的 layout 字符串与顺序，不读 catalog、不认母版名、不区分风格——
// 任何风格（现有或以后新增）都走同一套规则，无需在 render 里加风格分支。
// 连续同版式是精确信号（硬错）；占比是粗信号（只提示，避免误伤图集/清单类）。
function buildRhythmReport() {
  const pages = Array.isArray(plan.pages) ? plan.pages : [];
  const total = pages.length;
  const layouts = pages.map((p) => String(p.layout || ''));
  // `custom/*` 是手写/组合页，按需复用同一结构是正常用法；它们不参与节奏计数。
  // 这是 plan 级约定（CONTRACT 统一定义），不是某个风格的判断。
  const skipLayout = (l) => !l || l.startsWith('custom/');
  const runs = [];
  let start = 0;
  for (let i = 1; i <= total; i++) {
    const prev = layouts[i - 1];
    const cur = i < total ? layouts[i] : null;
    if (i === total || cur !== prev || skipLayout(prev) || skipLayout(cur)) {
      if (!skipLayout(prev) && i - start >= 2) runs.push({ layout: prev, start, len: i - start });
      start = i;
    }
  }
  const hard = ONLY ? [] : runs.filter((r) => r.len >= LAYOUT_RUN_HARD);
  const counts = new Map();
  for (const l of layouts) if (!skipLayout(l)) counts.set(l, (counts.get(l) || 0) + 1);
  const shares = [...counts.entries()]
    .map(([layout, count]) => ({ layout, count, share: total ? count / total : 0 }))
    .sort((a, b) => b.count - a.count);
  const shareWarn = !ONLY && total >= RHYTHM_MIN_PAGES
    ? shares.filter((s) => s.share > LAYOUT_SHARE_WARN)
    : [];
  return { total, runs, hard, shares, shareWarn, skipped: ONLY };
}

function buildStaticReport() {
  const { files, bad: formatBad, ok: formatOk } = collectFormatIssues(taskDir);
  const usedAbs = new Set([...usedFiles, ...consumedSources].map((f) => path.resolve(f)));
  const usedBase = [...new Set(usedFiles.map((f) => path.basename(f)))];
  const rel = (f) => path.relative(taskDir, f).replace(/\\/g, '/');

  // ② 图槽比例：固定比槽按声明值比对；填充型槽按图片形态给风险（无 data-ratio 可对）
  const ratioBad = [];
  let ratioOk = 0;
  for (const s of slotReports) {
    const got = s.w / s.h;
    if (s.ratio && s.dev !== null) {
      if (s.dev >= SLOT_RATIO_WARN) {
        ratioBad.push({ ...s, got, msg: s.fit === 'contain'
          ? `偏差 ${Math.round(s.dev * 100)}%，contain 留白大：换一张贴合比例的图`
          : `偏差 ${Math.round(s.dev * 100)}%，cover 裁切大：按槽预裁或换母版` });
      } else ratioOk++;
    } else if (!s.ratio) {
      if (got > FILLING_SLOT_WIDE || got < FILLING_SLOT_TALL) {
        ratioBad.push({ ...s, got, msg: got > FILLING_SLOT_WIDE
          ? '填充型槽（无 data-ratio）遇到超宽图：横向裁切风险，换固定比槽或预裁'
          : '填充型槽（无 data-ratio）遇到窄竖图：纵向裁切风险，换固定比槽或预裁' });
      } else ratioOk++;
    } else ratioOk++;   // data-ratio 解析异常（如 0:1）也计入已检，避免总数对不上
  }

  // ③ 覆盖：工作区里有、plan 没引用的素材
  const unused = [];
  const derived = [];
  if (!ONLY) {
    for (const f of files) {
      if (usedAbs.has(path.resolve(f))) continue;
      const base = path.basename(f);
      const stem = base.slice(0, base.length - path.extname(base).length);
      // 预裁/转码派生件的原料：文件名是已引用件的词干前缀（如 21-nvidia.webp → 21-nvidia-square.png）
      const isDerived = usedBase.some((b) => b !== base && (b.startsWith(stem + '-') || b.startsWith(stem + '_')));
      (isDerived ? derived : unused).push(rel(f));
    }
  }

  return { files, formatBad, formatOk, ratioBad, ratioOk, unused, derived, slots: slotReports.length, rhythm: buildRhythmReport() };
}

function printStaticReport(rep, full) {
  const customCount = built.filter((b) => b.custom).length;
  const issues = rep.formatBad.length + rep.ratioBad.length + rep.unused.length + rep.rhythm.hard.length;
  if (!full && !issues && !rep.rhythm.shareWarn.length) return;   // 正式出图只在有风险时提示，避免刷屏

  console.log(full
    ? '🔍 预检 --preflight：只跑静态校验（不截图、不产出交付）'
    : '⚠ 出图前静态预检（出图继续，建议先修再跑）');
  console.log('');

  if (full) console.log(`① 素材格式 · 工作区 ${rep.files.length} 个图片文件，正常 ${rep.formatOk}，需处理 ${rep.formatBad.length}`);
  else if (rep.formatBad.length) console.log(`① 素材格式 · ${rep.formatBad.length} 个需处理`);
  for (const r of rep.formatBad) console.log(`   ✗ ${r.file} — ${r.msg}`);

  if (full) console.log(`\n② 图槽比例 · 已检 ${rep.ratioBad.length + rep.ratioOk} 槽（阈值 ${Math.round(SLOT_RATIO_WARN * 100)}%），偏差 ${rep.ratioBad.length} 个`);
  else if (rep.ratioBad.length) console.log(`\n② 图槽比例 · ${rep.ratioBad.length} 个偏差大`);
  for (const r of rep.ratioBad) {
    const slot = r.ratio ? `槽 ${r.ratio}` : '填充型槽（无 data-ratio）';
    console.log(`   ⚠ P${r.nn} ${r.layout} ${r.id} · ${slot} · 图 ${r.w}×${r.h}（${r.got.toFixed(2)}）— ${r.msg}`);
  }

  if (full) console.log(`\n③ 素材覆盖 · 已引用 ${new Set(usedFiles).size} 个，未引用 ${rep.unused.length} 个${ONLY ? '（--only 已跳过覆盖检查）' : ''}`);
  else if (rep.unused.length) console.log(`\n③ 素材覆盖 · ${rep.unused.length} 个未被引用`);
  for (const f of rep.unused) console.log(`   ⚠ ${f} — 未被任何页引用：弃图请写进素材清单，否则补页`);
  if (full && rep.derived.length) console.log(`   ✓ ${rep.derived.length} 个派生源（预裁/转码前原图）已跳过：${rep.derived.join('、')}`);

  if (full) {
    console.log(`\n④ 结构完整性 · 页数 ${built.length}（母版 ${built.length - customCount} / 手写 ${customCount}）· 图槽样本 ${rep.slots} 个${ONLY ? '（--only 只含指定页）' : ''}`);
    console.log('   字段 / repeat / 图槽填报这类硬错会在执行到此之前直接停下，本表只汇报规模。');
    if (customCount) console.log('   ⚠ 手写页的密度 / 压盖 / 越界不在静态预检内：正式出图必须带 --check-geometry。');
  }

  const rhythmIssues = rep.rhythm.hard.length + rep.rhythm.shareWarn.length;
  if (full || rhythmIssues) {
    const r = rep.rhythm;
    const label = (i) => `P${String(plan.pages[i]?.nn || i + 1).padStart(2, '0')}`;
    if (full) {
      const maxRun = r.runs.reduce((m, x) => Math.max(m, x.len), 1);
      console.log(`\n⑤ 版式节奏 · ${r.total} 页 · 最长连续同名 ${maxRun} 页${r.skipped ? '（--only 不参与硬错判定）' : ''}`);
      console.log('   ' + (r.shares.map((s) => `${s.layout || '(空)'}×${s.count}`).join('  ') || '（无页）'));
    } else {
      console.log('\n⑤ 版式节奏');
    }
    const mark = full ? '❌' : '⚠';
    for (const h of r.hard) console.log(`   ${mark} ${h.layout} 连续 ${h.len} 页（${label(h.start)}–${label(h.start + h.len - 1)}）—— 上限 ${LAYOUT_RUN_HARD - 1} 页`);
    for (const s of r.shareWarn) console.log(`   ⚠ ${s.layout} 占比 ${Math.round(s.share * 100)}%（${s.count}/${r.total}）—— 只提示：图集/清单类可天然集中`);
  }

  if (full && allWarns.length) {
    console.log(`\n⑥ 文字与版面类告警 ${allWarns.length} 条（只提示，不拦）：`);
    for (const w of allWarns) console.log('   - ' + w);
  }

  console.log('');
  const advisories = rep.rhythm.shareWarn.length;
  if (issues) console.log(full
    ? `❌ 预检发现 ${issues} 处风险：修完素材 / plan 后重跑，再出图`
    : `⚠ 共 ${issues} 处风险（本次已继续出图；建议修完后重跑）`);
  else if (full && advisories) console.log(`✅ 无阻断项；另有 ${advisories} 条节奏提示（单一版式占比），交人判断`);
  else if (full) console.log('✅ 预检通过：无格式 / 比例 / 覆盖 / 版式节奏风险');
}

const staticReport = buildStaticReport();
printStaticReport(staticReport, PREFLIGHT);
if (PREFLIGHT) {
  console.log('ℹ 预检不产出交付；确认无误后去掉 --preflight 再跑完整出图。');
  // 硬错：素材格式不符会让 render 直接拒绝；连续同版式 ≥3 是设计硬规则。其余只提示。
  const blocking = staticReport.formatBad.length + staticReport.rhythm.hard.length;
  process.exit(blocking ? 2 : 0);
}

// ---------- 写产物 ----------
// 图片统一走 assets/ 相对路径：按登记表把素材复制进去（同名文件已在 assetRefFor 去重）。
// 只读体检也要复制——它的 HTML 同样引用 assets/，否则字体/几何体检会因缺图失真。
// 没用到图片时不建空目录（assets/ 只承载本次引用的素材）。
if (usedFiles.length) {
  fs.mkdirSync(path.join(OUT, 'assets'), { recursive: true });
  for (const [file, ref] of assetRefs) fs.copyFileSync(file, path.join(OUT, ref));
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
  fs.writeFileSync(path.join(OUT, htmlFile), pageHtml);
  b.file = htmlFile;
}

// fields.json（plan 转写：键 = 页面真实 data-layer id，编辑器契约初稿）
// 注：图槽键的值仍是 plan 申报的原值（`{src, crop}` 对象或路径字符串）——编辑器不读 fields.json，届时按 image 图层消费
// repeat 条目短名经 unitLayerMaps 映射为单元元素的 data-layer，并加与克隆体一致的 -2/-3 后缀
// 仅 --with-editor 生成（默认生图交付只给 HTML + PNG + preview.png，不产编辑器契约件）；
// --only 单页调试与只读体检也不写——这两个文件是跨页聚合件，单页版会覆盖多页正式版
if (EDITOR_OUT) {
  // 图槽值统一落到交付区可解析的 `assets/<basename>`（与 editor.manifest.json.assetDirs 对齐）：
  // 素材副本按 basename 平铺在 assets/，plan 里的 `shots/xxx.png` 只存在于任务工作区，交付目录没有 shots/。
  // 两种写法都要改：对象形态 `{src, crop}` 与字符串形态 `"shots/x.png"`。
  // 判据用「绝对路径命中已用素材表」，不靠键名猜槽类型——字符串槽（纯文案）永远命中不了，天然不受影响。
  const assetMap = assetRefs;
  const toAssetRef = (src) => assetMap.get(path.resolve(taskDir, src)) || src;
  const normField = (v) => {
    if (typeof v === 'string') return toAssetRef(v);
    if (v && typeof v === 'object' && typeof v.src === 'string') return { ...v, src: toAssetRef(v.src) };
    return v;
  };
  const pagesOut = [];
  const unmappedKeys = [];
  for (const b of built) {
    const flat = {};
    const ids = b.layerIdSet;   // 契约校验那一轮已扫出，这里不再重扫
    // 只在母版页转写：custom 页没有槽位填充通道，文案写死在 markup 里，fields 对它无效
    if (!b.custom) {
      for (const [k, v] of Object.entries(b.fields)) {
        if (Array.isArray(v)) {
          const map = b.unitLayerMaps?.get(k);
          v.forEach((item, i) => {
            for (const [ik, iv] of Object.entries(item)) {
              const layer = map?.get(ik) || ik;           // 单元内短名 → 该元素的 data-layer
              flat[i === 0 ? layer : `${layer}-${i + 1}`] = normField(iv);
            }
          });
          continue;
        }
        // 键必须是图层的 data-layer id（契约要求键对应源标记），而 plan 的键是 {{占位符}} 名，
        // 两者常不同名（{{issue}} ↔ sys-issue、{{foot-tag}} ↔ n39-foot-1）——不转写就是一堆对不上节点的死键。
        // 图槽没有占位符，plan 的键本来就是图层 id（契约：图槽键 = <img> 的 data-layer）——
        // 查不到占位符映射时退回「键即图层」，否则每个图槽都会被误报成对不上。
        const targets = b.slotLayerMap?.get(k) || (ids.has(k) ? [k] : []);
        if (!targets.length) { unmappedKeys.push(`P${b.nn} · ${k}`); continue; }
        for (const id of targets) flat[id] = normField(v);
      }
      // 系统槽：品牌槽从 meta 展开、页码与进度取机械值。键读节点自带的 data-layer，
      // 不按 `sys-<值>` 拼——拼出来的键在没这么命名图层的母版上指向不存在的图层。
      const brand = plan.meta && plan.meta.brand ? plan.meta.brand : {};
      for (const [sys, key] of Object.entries(SYS_META_KEY)) {
        if (!b.sysTally || !b.sysTally[sys]) continue;
        const val = brand[key];
        if (val === undefined || val === null || val === '') continue;   // meta 缺失则保留母版默认文本，不记
        for (const id of b.sysLayerMap?.get(sys) || []) flat[id] = String(val);
      }
      if (b.sysTally && b.sysTally['page-no']) {
        for (const id of b.sysLayerMap?.get('page-no') || []) flat[id] = b.pageNoValue;   // 封面为 ''，与 display:none 一致
      }
      if (b.sysTally && b.sysTally['progress']) {
        for (const id of b.sysLayerMap?.get('progress') || []) flat[id] = b.progressValue;
      }
    }
    pagesOut.push({ id: `p${b.nn}`, fields: flat });
  }
  if (unmappedKeys.length) {
    allWarns.push(`fields.json: ${unmappedKeys.length} 个 plan 键找不到所在图层（${unmappedKeys.slice(0, 4).join(' / ')}${unmappedKeys.length > 4 ? ' …' : ''}）——这些值不记入契约初稿`);
  }
  // 落盘前自检：每个键都要在页内真有对应图层。契约把「键 = data-layer id」定死了，
  // 键对不上不会报错——pageApp 将来读到这份初稿时静默取不到值，打包期也不会报，只能在这里拦。
  // 普通槽由 slotLayerMap 从同一份 html 推出，天然指得到；真正需要这张网的是 repeat 单元：
  // 短名经 unitLayerMaps 映射，映射缺失时会原样落到键上。
  for (let i = 0; i < pagesOut.length; i++) {
    const pageIds = built[i].layerIdSet;
    const bad = Object.keys(pagesOut[i].fields).filter((k) => !pageIds.has(k));
    if (bad.length) fail(`fields.json · P${built[i].nn}: 键 ${bad.slice(0, 6).join(', ')}${bad.length > 6 ? ' …' : ''} 在页内没有对应图层（编辑器按 data-layer 找节点，键必须等于图层 id）`);
  }
  fs.writeFileSync(path.join(OUT, 'fields.json'), JSON.stringify({ canvas: MANIFEST_DEFAULTS.canvas, pages: pagesOut }, null, 2));
}

// editor.manifest.json（同上：仅 --with-editor 生成，且 --only / 只读体检都不写）
if (EDITOR_OUT) {
  fs.writeFileSync(path.join(OUT, 'editor.manifest.json'), JSON.stringify(buildManifest(
    built.map((b) => ({ file: `P${b.nn}-${b.name}.html`, id: `p${b.nn}`, name: `P${b.nn} · ${b.name}` })),
  ), null, 2));
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
const opts = createOptions({ timeout: 60000 });
const inst = gifInst || await launchBrowser(opts);   // GIF 预转换已启动浏览器时直接复用
try {
  for (const b of built) {
    const file = path.join(OUT, b.file || `P${b.nn}-${b.name}.html`);
    await withPage(inst, 'file:///' + file.replace(/\\/g, '/'), opts, async (ctx) => {
      if (FONT_REPORT) printFontReport(await fontReport(ctx), `P${b.nn}`);
      if (DIAG_ONLY) return;   // 只读体检：不截图、不写 PNG
      const shot = await captureReadyPage(ctx, opts);
      // fail 6 · 主标题字号对位（仅组合页）：必须在 captureReadyPage 之后读——字体回流已稳定，与截图同帧。
      // 为什么读 computedStyle：字号是级联算出来的，`.title` 在 n01 里是 10cqw、在 .mega-hero .hero-text 里是 9.3cqw，
      // 只按类名比表必然误判。换算与容差见 composed.mjs checkRoleFontSize。
      if (b.composed) {
        const roleNodes = await evaluate(ctx.cdp, ctx.sessionId, `(() => {
          const out = [];
          document.querySelectorAll('[data-role]').forEach((el) => {
            const px = parseFloat(getComputedStyle(el).fontSize);
            if (!Number.isFinite(px)) return;
            out.push({ role: el.getAttribute('data-role'), px, tag: el.tagName.toLowerCase(), cls: String(el.getAttribute('class') || '').trim().split(' ')[0] || '' });
          });
          return out;
        })()`);
        const roleErrors = checkRoleFontSize(roleNodes, { cssText, nn: b.nn });
        if (roleErrors.length) {
          console.error(`\n❌ P${b.nn} · 自由组合页主标题字号对位失败（即停）：`);
          roleErrors.forEach((e) => console.error('   - ' + e));
          process.exit(1);
        }
      }
      fs.writeFileSync(path.join(OUT, `P${b.nn}-${b.name}.png`), shot.buffer);
      // 盒形比例诊断（纯读态 WARN）：实测 .ph-img 容器盒 vs 声明 data-ratio。
      // 须在 captureReadyPage 之后测（字体回流已稳定，与截图同帧）；只盯 cover 槽（contain 是留白非裁切）。
      // ⚠ 用 offsetWidth/Height（变换前布局盒）而非 getBoundingClientRect——后者是旋转后 AABB：
      // 旋转母版（如 N38 双屏 ±5deg 倾斜）会把真盒膨胀成更大的假阳性盒（17% 量级）；cover 裁切发生在
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
          // —— 密度：文本节点 + 图文内容。元素 rect 撑满不代表版面有内容——
          // 空 div 撑开、卡片拉高都能让每个盒子「不越界」，但肉眼看到的仍是半页白。
          const content = document.querySelector('.content');
          let dens = null;
          if (content) {
            const cr = content.getBoundingClientRect();
            const walker = document.createTreeWalker(content, NodeFilter.SHOW_TEXT);
            const spans = [];
            let n;
            while ((n = walker.nextNode())) {
              if (!n.textContent.trim()) continue;
              const rg = document.createRange(); rg.selectNodeContents(n);
              for (const rect of rg.getClientRects()) {
                if (rect.height < 1 || rect.width < 1) continue;
                spans.push([rect.top - cr.top, rect.bottom - cr.top]);
              }
            }
            // 图片与内嵌图形同样是版面内容：只数文本会把「小标题 + 大图」页判成欠填。
            // 取 .content 内可见 img / svg 的矩形并入同一套覆盖区间（越界与否不在这里判，另有越界扫描）。
            // 不按 position 排除——绝对定位是正常的排版手段，AI 用它摆图/摆卡片不该被当成"没内容"。
            // 只排除「空的 <svg>」：没有图形子节点的 svg 画面上什么都没有，计入会让
            // 「整页空白 + 一个铺满的空 svg 骨架」算出 100% 跨高，密度检查就白做了。
            // 面积门槛：装饰性小图标（面积 < .content 的 6%）不计。否则在页面底部放一枚 2.4cqw 的
            // 小图标就能把「尾白」压成 0、把「跨越高度」拉满，真正的半页空白被静默放过。
            const contentArea = Math.max(1, cr.width * cr.height);
            for (const el of content.querySelectorAll('img, svg')) {
              const er = el.getBoundingClientRect();
              if (er.width < 1 || er.height < 1) continue;
              if (el.tagName.toLowerCase() === 'svg'
                && !el.querySelector('path,circle,rect,line,polyline,polygon,ellipse,text,image,use')) continue;
              if (er.width * er.height < contentArea * 0.06) continue;
              spans.push([er.top - cr.top, er.bottom - cr.top]);
            }
            if (spans.length) {
              spans.sort((a, b) => a[0] - b[0]);
              const merged = [];
              for (const [t, bt] of spans) {
                const L = merged[merged.length - 1];
                if (L && t <= L[1] + 2) L[1] = Math.max(L[1], bt); else merged.push([t, bt]);
              }
              let covered = 0, maxGap = 0, gapAt = '';
              for (let i = 0; i < merged.length; i++) {
                covered += merged[i][1] - merged[i][0];
                if (i) {
                  const g = merged[i][0] - merged[i - 1][1];
                  if (g > maxGap) { maxGap = g; gapAt = Math.round(merged[i - 1][1]) + '→' + Math.round(merged[i][0]); }
                }
              }
              const H = cr.height;
              const span = merged[merged.length - 1][1] - merged[0][0];
              dens = {
                H: Math.round(H), spanPct: Math.round(span / H * 100),
                coverPct: Math.round(covered / H * 100),
                head: Math.round(merged[0][0]), tail: Math.round(H - merged[merged.length - 1][1]),
                maxGap: Math.round(maxGap), gapAt,
                // 只认画布根上的申报：文档写明「根节点写 data-density="airy"」，任意子元素命中就豁免等于给漏排开后门
                airy: !!document.querySelector('.artwork-page[data-density="airy"]'),
              };
            }
          }
          // —— fail 7 全量字号：遍历所有文本节点，记 computedStyle 字号（px）+ 豁免标记。
          // 三类豁免在 DOM 侧判（要看祖先与 computedStyle）：SVG 内 px 档 / font-size:0 隐藏 / 隐藏节点。
          const fontNodes = [];
          const fw = document.createTreeWalker(page, NodeFilter.SHOW_TEXT);
          let fn;
          while ((fn = fw.nextNode())) {
            if (!fn.textContent.trim()) continue;
            const el = fn.parentElement;
            if (!el) continue;
            const cs = getComputedStyle(el);
            const px = parseFloat(cs.fontSize);
            if (!Number.isFinite(px)) continue;
            const inSvg = !!el.closest('svg');
            const zero = px < 0.5;
            const hidden = cs.visibility === 'hidden' || cs.display === 'none' || el.closest('[hidden]');
            if (inSvg || zero || hidden) continue;          // 三类豁免
            const r = el.getBoundingClientRect();
            if (r.width < 1 || r.height < 1) continue;       // 不可见节点不报
            fontNodes.push({ px, cqw: px / 10.8, tag: el.tagName.toLowerCase(), cls: String(el.className || '').trim().split(/\s+/)[0] || '', text: fn.textContent.trim().slice(0, 24) });
          }

          // —— 压盖：只在 .content 下取「直接承载文本的叶子块」，两两比矩形。
          // 排除：祖先/后代包含、同一块内的相邻文本、装饰层（paper-noise/data-sys 品牌栏不在 content 内）。
          // 阈值：重叠面积 ≥ 较小块的 25% 且两边都 >400px² 才算显著压盖（防字距级微叠误杀）。
          const blocks = [];
          if (content) {
            content.querySelectorAll('*').forEach((el) => {
              if (el.querySelector('*')) return;              // 只取叶子：含子元素的容器跳过（避免父子重复计数）
              const t = (el.textContent || '').trim();
              if (!t) return;
              const cs = getComputedStyle(el);
              if (cs.visibility === 'hidden' || cs.display === 'none') return;
              const r = el.getBoundingClientRect();
              if (r.width < 8 || r.height < 6) return;
              blocks.push({ el, r, t: t.slice(0, 12), cls: String(el.className || '').trim().split(/\s+/)[0] || el.tagName.toLowerCase() });
            });
          }
          const overlaps = [];
          for (let i = 0; i < blocks.length; i++) {
            for (let j = i + 1; j < blocks.length; j++) {
              const a = blocks[i], b = blocks[j];
              if (a.el.contains(b.el) || b.el.contains(a.el)) continue;
              const ox = Math.max(0, Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left));
              const oy = Math.max(0, Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top));
              const area = ox * oy;
              const minArea = Math.min(a.r.width * a.r.height, b.r.width * b.r.height);
              if (area > 400 && minArea > 0 && area / minArea >= 0.25)
                overlaps.push(a.cls + '("' + a.t + '") ∩ ' + b.cls + '("' + b.t + '") = ' + Math.round(area / minArea * 100) + '%');
            }
          }

          // —— 孤字：对每个「块级文本容器」逐字符取行盒，按 top 分组，末行只有 1 个汉字 → 孤字。
          // 关键：跳过 span.hl / span.hl-line 等内联富文本（它们是句子的片段，单独判必然误报），
          // 只判直接承载文字的块级元素；标题类 fail、正文类 WARN（中文正文末行单字很常见，不宜硬拦）。
          const orphans = [];       // 标题类：fail
          const orphanWarns = [];   // 正文类：WARN
          const ow = document.createTreeWalker(content || page, NodeFilter.SHOW_TEXT);
          let on;
          while ((on = ow.nextNode())) {
            const raw = on.textContent || '';
            if (raw.replace(/[\s，。、；：！？·—,.!?;:]/g, '').length < 2) continue;
            const el = on.parentElement;
            if (!el) continue;
            // 内联富文本/行内元素不是独立文本块：其文本属于父块的一行，跳过避免误报
            const tag = el.tagName.toLowerCase();
            if (['span', 'b', 'strong', 'em', 'i', 'a'].includes(tag)) continue;
            if (raw.replace(/[\s，。、；：！？·—,.!?;:]/g, '').length < 4) continue;  // 太短的块不判
            const lines = new Map();
            for (let k = 0; k < raw.length; k++) {
              if (/[\s，。、；：！？·—,.!?;:]/.test(raw[k])) continue;
              const rr = document.createRange(); rr.setStart(on, k); rr.setEnd(on, k + 1);
              for (const rc of rr.getClientRects()) {
                if (rc.height < 1 || rc.width < 1) continue;
                const key = Math.round(rc.top / 4) * 4;
                const cur = lines.get(key) || { chars: 0, last: '' };
                cur.chars++; cur.last = raw[k]; lines.set(key, cur);
              }
            }
            if (lines.size < 2) continue;
            const last = [...lines.values()].sort((x, y) => y.chars - x.chars).pop();
            if (last && last.chars === 1 && /[\u4e00-\u9fa5]/.test(last.last)) {
              const label = (el.className || tag) + ' 末行孤字「' + last.last + '」: "' + raw.trim().slice(0, 30) + '"';
              // 标题 = 带 data-role 或走大字档（computed fontSize ≥ 4cqw）；其余归正文 WARN
              const px = parseFloat(getComputedStyle(el).fontSize) || 0;
              if (el.hasAttribute('data-role') || px >= 4 * 10.8) orphans.push(label);
              else orphanWarns.push(label);
            }
          }

          // —— 塌陷：fine-line 在居中 flex 里会塌成点（宽或高 < 2px 但有内容盒）。
          const collapsed = [];
          document.querySelectorAll('.fine-line').forEach((el) => {
            const r = el.getBoundingClientRect();
            if (r.width < 2 || r.height < 2) collapsed.push('.fine-line @' + Math.round(r.left) + ',' + Math.round(r.top) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height));
          });

          return { overflow: page.scrollWidth > page.clientWidth + 2 || page.scrollHeight > page.clientHeight + 2, bad: bad.slice(0, 8), dens,
                   fontNodes: fontNodes.slice(0, 400), overlaps: overlaps.slice(0, 8), orphans: orphans.slice(0, 8), orphanWarns: orphanWarns.slice(0, 8), collapsed: collapsed.slice(0, 8) };
        })()`);
        if (geo.overflow || geo.bad.length) {
          console.error(`\n❌ P${b.nn} · 画布越界（即停）：overflow=${geo.overflow}${geo.bad.length ? '；越界元素: ' + geo.bad.join(' | ') : ''}`);
          process.exit(1);
        }
        console.log(`✓ P${b.nn} 几何体检通过`);

        // fail 7 · 全量字号扫描（仅组合页）：随 --check-geometry 跑。字号是级联结果，必须读 DOM。
        if (b.composed) {
          const fsErrors = checkAllFontSizes(geo.fontNodes || [], { cssText, nn: b.nn });
          if (fsErrors.length) {
            console.error(`\n❌ P${b.nn} · 全量字号扫描失败（${fsErrors.length} 处，即停）：`);
            fsErrors.slice(0, 12).forEach((e) => console.error('   - ' + e));
            process.exit(1);
          }
        }
        // 压盖（几何判定）：同级文本块显著互相压盖 → fail；存疑的靠阈值已排除。
        if (geo.overlaps && geo.overlaps.length) {
          console.error(`\n❌ P${b.nn} · 元素压盖（即停）：${geo.overlaps.join(' | ')}`);
          process.exit(1);
        }
        // 正文末行孤字：中文正文里常见，WARN 提示人审（不硬拦，防误杀）。
        if (geo.orphanWarns && geo.orphanWarns.length)
          console.warn(`⚠ P${b.nn} 正文末行孤字（人审）: ${geo.orphanWarns.join(' | ')}`);
        // 标题孤字与塌陷：行盒判定，命中即 fail（用户「禁止排版散乱」的机器化）。
        const disorder = [...(geo.orphans || []), ...(geo.collapsed || [])];
        if (disorder.length) {
          console.error(`\n❌ P${b.nn} · 排版散乱（即停）：${disorder.join(' | ')}`);
          process.exit(1);
        }
        // 密度阈值按「肉眼能看出半页白」定：文本跨高 < 70% 或尾白 > 18% 就是欠填；
        // 单个缝隙 > 20% 容器高是「撕裂」（并列布局会让该值偏大，故只告警不拦）。
        // data-density="airy" = 显式声明的刻意留白（封面/金句页），只报数值不告警——
        // 默认要满、留白要申报：不申报的空就是漏排，申报的留白才是设计。
        const d = geo.dens;
        if (d) {
          const tag = `P${b.nn} · 密度`;
          const info = `文本跨高 ${d.spanPct}% · 覆盖率 ${d.coverPct}% · 尾白 ${d.tail}px · 最大空隙 ${d.maxGap}px`;
          if (d.airy) {
            console.log(`📐 ${tag}: ${info}（已声明 airy 留白，不告警）`);
          } else {
            // 欠填 = 禁止大段留白，硬停：几何全过但半页白的假绿不能出图。
            // 三个判据各管一种漏法，缺一不可：
            //   覆盖率 = 内容实际占了多少高度。只看首末跨度会被「首尾各放一个元素、中间全空」骗过
            //     （实测：一行标题 + 底部小图标 → 跨高 101%、覆盖率仅 13%），故以它为主判据。
            //   跨高   = 首末内容是否撑到两端，防「内容全挤在上半页」。
            //   尾白   = 底部是否空着，防「内容堆在顶部、下面半页白」。
            const reasons = [];
            if (d.coverPct < 40) reasons.push(`实际覆盖 ${d.coverPct}%（下限 40%）`);
            if (d.spanPct < 70) reasons.push(`文本跨高 ${d.spanPct}%（下限 70%）`);
            if (d.tail > d.H * 0.18) reasons.push(`尾白 ${d.tail}px（容器 ${d.H}px 的 ${Math.round(d.tail / d.H * 100)}%，上限 18%）`);
            if (reasons.length) {
              console.error(`\n❌ ${tag}: 欠填（即停）——${reasons.join(' · ')}；`
                + `最大空隙 ${d.maxGap}px · 首白 ${d.head}px。`
                + `按 COMPOSED-MODE §4.2 修：换横向结构 > 升字档 > 补次级信息；刻意留白请在根节点写 data-density="airy"`);
              process.exit(1);
            }
            // 撕裂仍 WARN：并列布局天然让最大空隙偏大，硬拦误杀率高，靠人审目检。
            if (d.maxGap > d.H * 0.2)
              console.warn(`⚠ ${tag}: 局部撕裂——最大空隙 ${d.maxGap}px（${d.gapAt}），空白集中在一处，看起来像没排完（人审确认）`);
            console.log(`📐 ${tag}: ${info}`);
          }
        }
      });
    }
    console.log(`📸 P${b.nn} · ${b.name}`);
  }

  // preview.png 总览：跨页聚合件，--only（含只读体检）只跑了部分页，拼图只会把多页总览覆盖成残缺版，故不写
  if (!ONLY) {
    const files = built.map((b) => `P${b.nn}-${b.name}.png`);
    // preview 列数按页数自适应：页少时单页更大，便于直接用 preview 判断版面；
    // 页多时才收成 4 列，避免拼图过高。1 页单列，2–4 页 2 列，5–8 页 3 列，>8 页 4 列。
    const cols = built.length === 1 ? 1
      : built.length <= 4 ? 2
      : built.length <= 8 ? 3
      : 4;
    const gridHtml = `<!doctype html><html><head><meta charset="utf-8"><style>
      body{margin:0;background:#ECEEF3;font-family:sans-serif;padding:16px;}
      .g{display:grid;grid-template-columns:repeat(${cols},1fr);gap:12px;}
      img{width:100%;display:block;border:1px solid #d5d9e0;}
    </style></head><body><div class="g">
      ${files.map((f) => `<img src="file:///${path.join(OUT, f).replace(/\\/g, '/')}">`).join('\n')}
    </div></body></html>`;
    const tmp = path.join(OUT, '_preview.html');
    fs.writeFileSync(tmp, gridHtml);
    await withPage(inst, 'file:///' + tmp.replace(/\\/g, '/'), { ...opts, selector: '.g', waitSelector: '.g' }, async (ctx) => {
      // 截 body 而不是整页：整页按视口高度（1440）出图，页数少时下方会留大片空白
      const shot = await captureReadyPage(ctx, { ...opts, selector: 'body' });
      fs.writeFileSync(path.join(OUT, 'preview.png'), shot.buffer);
    });
    fs.rmSync(tmp);
  }
} finally { await closeBrowser(inst); }

// ---------- 交付：校验 + 截图全部通过后，才按白名单从任务工作区拷贝到交付目录 ----------
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
  // --force 只覆盖白名单，不删旧文件；旧页数比这次多时会留下上次的 P 页，交付物就不再是「本次全量」
  {
    const allowed = new Set(white);
    allowed.add('assets');
    const extra = fs.readdirSync(DELIVERY).filter((f) => !f.startsWith('.') && !allowed.has(f));
    if (extra.length) console.warn(`⚠ 交付目录里有 ${extra.length} 个非本次产物（--force 不删，请人工确认是否该留在交付里）：${extra.slice(0, 8).join(', ')}${extra.length > 8 ? ' …' : ''}`);
  }
  for (const f of white) {
    const src = path.join(OUT, f);
    if (!fs.existsSync(src)) fail(`交付白名单文件缺失：${f}`);
    fs.copyFileSync(src, path.join(DELIVERY, f));
  }
  // assets/ 是默认交付的一部分（HTML 按相对路径引用），与是否开编辑器无关
  const a = path.join(OUT, 'assets');
  if (fs.existsSync(a)) {
    const dstA = path.join(DELIVERY, 'assets');
    fs.mkdirSync(dstA, { recursive: true });
    for (const f of fs.readdirSync(a)) {
      const s = path.join(a, f);
      if (fs.statSync(s).isFile()) fs.copyFileSync(s, path.join(dstA, f));
    }
  }
  delivered = { dir: DELIVERY, count: white.length };
}

if (DIAG_ONLY) {
  fs.rmSync(OUT, { recursive: true, force: true });
  console.log(`\n✅ ${built.length} 页字体体检完毕（只读：未写 P 页/PNG/fields/manifest/preview）`);
  console.log('ℹ 只读体检：本次未出图、未交付（--delivery / plan.delivery 已忽略）');
} else if (delivered) {
  fs.rmSync(OUT, { recursive: true, force: true });
  console.log(`\n✅ ${built.length} 页出图完毕`);
  console.log(`📦 交付目录 → ${delivered.dir}（${delivered.count} 个文件 + assets/；plan.json / 过程件未拷入）`);
  console.log('🧹 系统临时产物已清理；任务工作区只保留 plan.json / 素材 / 清单 md');
} else {
  keepOut = true;   // 未交付的产物留给用户看效果，退出钩子不删
  console.log(`\n✅ ${built.length} 页出图完毕 → ${OUT}（系统临时目录）`);
  console.log('ℹ 未指定 --delivery 或 plan.delivery：产物只留在系统临时区，任务工作区未写入 HTML/PNG');
}
if (EDITOR_OUT) {
  // 必须说清：fields.json 今天没有消费者。页面文案 render 已经写进 HTML，编辑器打开看到的就是最终稿；
  // fields 只是契约件（pageApp T6「读生成期初稿」未落）。不说这句，下一个人会以为改 fields 能改文案。
  console.log('ℹ 编辑器材料：fields.json / editor.manifest.json 已写出；fields.json 当前无消费者（pageApp 仍不读生成期初稿），改文案请改 plan 或页面 HTML');
  console.log('   下一步：cd <pageApp>/demo && node pack.mjs "<交付目录>"，再打开 covers-edit.html');
}
if (allWarns.length) {
  console.log('⚠ 软校验 WARN:');
  allWarns.forEach((w) => console.log('   - ' + w));
}
