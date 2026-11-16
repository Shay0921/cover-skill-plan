#!/usr/bin/env node
/* render.mjs · 实例化器——生产环境固定脚本，不是临时文件
 * 用法：node script/render.mjs <任务运行区>/ [--delivery=<交付目录>] [--with-editor] [--force] [--check-geometry] [--only=N01,N02] [--font-report]
 *   --font-report 是诊断开关（不进常规出图）：打印每页实际命中字体与三套字体栈的字宽实测，见 shared/cdp.mjs fontReport
 *   --only + --font-report = 只读诊断：只写临时 HTML 跑体检、跑完即删；不更新 P 页 / PNG / fields.json / manifest / preview.png。
 *     单独 --font-report（无 --only）= 出图时顺带体检；单独 --only（无 --font-report）= 调试出指定页，两者行为不变。
 * 输入：<任务运行区>/plan.json + 素材图片（相对运行区）
 * 三级目录（技能安装目录只读，运行期零写入）：
 *   ① 技能安装目录 = 本文件所在仓库：styles/ + script/，只读资产与代码（开发期文档与施工台账不随生产包分发）
 *   ② 任务运行区 = agent 临时工作区：plan.json / 素材 / 过程件 / P 页 / PNG / assets / fields / manifest（_preview.html 是拼总览用的临时页，截完即删）
 *   ③ 交付目录 = 用户选中的工作区（--delivery 或 plan.delivery，命名 YYYY-MM-DD-<小标题>）：校验+截图全过后按白名单拷贝
 * 交付白名单（默认）：P<nn>-<名>.html + P<nn>.png + preview.png
 *   --with-editor 追加：fields.json + editor.manifest.json + assets/
 * 硬校验（即停）：{{ 残留 / 图片缺失或格式不符 / 根节点与画布 / data-layer 重复 / 必填槽为空 / plan 字段与槽位对不上 / repeat 区间 / 富文本白名单外标签
 *   文案里的裸 < > 不算标签（"年收入 > 10 万"、"A < B" 照常出图，注入前转义为实体显示）
 * 软校验（WARN）：字数超限（解析说明头"限制"行）/ 图片与槽位比例差异大
 * 即兴页（layout: custom/*）：形态校验 + --check-geometry 几何体检
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
// --only 是调试开关：只出部分页时，preview/manifest/fields 会被单页覆盖（形成新旧混装包），故禁止与交付同用。
// 只读诊断（DIAG_ONLY）的 DELIVERY 已在上方置 null，因此不受这道守卫限制。
if (ONLY && DELIVERY) fail('--only 仅用于运行区调试，不能与 --delivery（或 plan.delivery）同用；正式交付请跑完整页数');
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

// ---------- repeat 区间解析（单元前注释） ----------
function repeatRange(body, unitStart) {
  // 从单元起点向前取「最近一条」repeat 注释，不再限制 400 字符窗口（说明头变长会静默漏校验）
  const before = body.slice(0, unitStart);
  const all = [...before.matchAll(/repeat\s*×(\d+)-(\d+)/g)];
  const m = all[all.length - 1];
  return m ? { min: +m[1], max: +m[2] } : null;
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
const RICH_OK = /<span\s+class=["']hl["']\s*>|<\/span>|<br\s*\/?>|<strong>|<\/strong>/gi;
// 只把「明确的标签形态」判为非法：<name> / </name> / <name attr="v"> / <!doctype> / <?xml?>
//   文案里的裸 < > 不算标签（"年收入 > 10 万"、"A < B"、"x<y 时 5>3"）——
//   标签名后只认「空格 + 字母属性名」（可带 =值），中文/数字跟在 < 后不构成标签。
//   这条判定只决定「要不要报错提示」，安全由 richHtml 转义兜底：即使漏判，也只会显示成文字，不会真变成标签。
const TAG_LOOKING = /<\/?[a-zA-Z][a-zA-Z0-9-]*(?:\s+[a-zA-Z-]+(?:=(?:"[^"]*"|'[^']*'|[^\s<>]+))?)*\s*\/?>|<[!?][^<>]*>/;
function checkRich(value, where, errors) {
  const stripped = value.replace(RICH_OK, '');
  if (!TAG_LOOKING.test(stripped)) return;
  const hit = stripped.match(new RegExp(`[\\s\\S]{0,10}(?:${TAG_LOOKING.source})`));
  errors.push(`${where}: 值含白名单外标签（只允许 span.hl / br / strong），检出错段 "${(hit ? hit[0] : '').trim()}"`);
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

// ---------- 图片处理 ----------
// 只产出「dataURL + crop 样式」，不拼全新 <img> 标签。
// 母版 img 上的 data-slot/data-layer/data-label/data-ratio 是编辑器图层的身份证，
// 必须由 fillSection 在替换 src 时原样保留。
function imgValue(v, where, errors, usedFiles) {
  const spec = typeof v === 'string' ? { src: v } : v;
  if (!spec || typeof spec.src !== 'string' || !spec.src) { errors.push(`${where}: 图片值为空`); return null; }
  const file = path.resolve(taskDir, spec.src);
  const ext = path.extname(file).toLowerCase();
  if (!fs.existsSync(file)) { errors.push(`${where}: 图片不存在 ${spec.src}`); return null; }
  if (!MIME[ext]) { errors.push(`${where}: 图片格式不符（仅 PNG/JPEG/WebP）${spec.src}`); return null; }
  usedFiles.push(file);
  const dataUrl = 'data:' + MIME[ext] + ';base64,' + fs.readFileSync(file).toString('base64');
  let cropStyle = null;
  if (spec.crop) {
    const crop = parseCrop(spec.crop);
    if (!crop) { errors.push(`${where}: crop 描述无法解析 "${spec.crop}"（例："下 55%" / "left 30%"）`); return null; }
    cropStyle = crop.axis === 'y'
      ? `height:${(100 / crop.fraction).toFixed(1)}%;width:100%;${crop.align === 'end' ? 'bottom:0;' : crop.align === 'start' ? 'top:0;' : 'top:50%;transform:translateY(-50%);'}`
      : `width:${(100 / crop.fraction).toFixed(1)}%;height:100%;${crop.align === 'end' ? 'right:0;' : crop.align === 'start' ? 'left:0;' : 'left:50%;transform:translateX(-50%);'}`;
  }
  return { dataUrl, cropStyle, spec };
}
function parseCrop(desc) {
  const m = String(desc).match(/^(上|下|左|右|中)?\s*(\d{1,3})\s*%$/);
  if (m) {
    const axis = ['左', '右'].includes(m[1]) ? 'x' : 'y';
    const align = { 上: 'start', 下: 'end', 左: 'start', 右: 'end', 中: 'center' }[m[1]] || 'end';
    const fraction = Math.min(99, Math.max(5, +m[2])) / 100;
    return { axis, align, fraction };
  }
  const m2 = String(desc).match(/^(left|right|top|bottom|center)\s+(\d{1,3})\s*%$/);
  if (m2) {
    const axis = ['top', 'bottom'].includes(m2[1]) ? 'y' : 'x';
    const align = { top: 'start', bottom: 'end', left: 'start', right: 'end', center: 'center' }[m2[1]];
    return { axis, align, fraction: Math.min(99, Math.max(5, +m2[2])) / 100 };
  }
  return null;
}

// ---------- 填充一个 section ----------
function fillSection(layout, body, fields, errors, warns, usedFiles) {
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

  // 1) repeat 单元（从后往前替换，防位移）
  const units = [];
  {
    const re = /<([a-z0-9]+)\b[^>]*\bdata-repeat="([^"]+)"[^>]*>/g;
    let m;
    while ((m = re.exec(body))) {
      const start = m.index;
      if (units.some((u) => start >= u.start && start < u.end)) continue;
      const end = findUnitEnd(body, start);
      units.push({ start, end, tag: m[1], arr: m[2], html: body.slice(start, end) });
    }
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
    const range = repeatRange(body, u.start);
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
      if (i > 0) html = html.replace(/data-layer="([^"]+)"/g, (_, id) => `data-layer="${id}-${i + 1}"`);
      html = html.replace(/\s*data-repeat="[^"]*"/g, ''); // 克隆件是具体内容，不再携带 repeat 标记
      return html;
    });
    body = body.slice(0, u.start) + rendered.join('\n') + body.slice(u.end);
  }

  // 2) 图槽：只替换 src（+ crop 外包），原 <img> 的 data-slot / data-layer / data-label / data-ratio 全部保留
  //    这些标记是编辑器图层的身份证；父容器补 data-filled 隐藏占位标签。
  for (const id of imgIds) {
    consumed.add(id);
    const v = fields[id];
    if (v === undefined) { errors.push(`${layout}: 图槽 "${id}" 未在 plan 中填报（必填）`); continue; }
    const imgSpec = imgValue(v, `${layout}:${id}`, errors, usedFiles);
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
    if (ratioM && imgSpec.spec.src) {
      const [rw, rh] = ratioM[1].split(':').map(Number);
      try {
        const buf = fs.readFileSync(path.resolve(taskDir, imgSpec.spec.src));
        // 只判 PNG（直接读 IHDR 宽高）；JPEG/WebP 读不到尺寸头，本软校验跳过——比例问题靠人审 PNG
        if (buf.length > 24 && buf.toString('hex', 0, 8) === '89504e470d0a1a0a') {
          const w = buf.readUInt32BE(16), h = buf.readUInt32BE(20);
          const want = rw / rh, got = w / h;
          if (Math.abs(got - want) / want > 0.45) warns.push(`${layout}: 图槽 ${id} 比例差异大（槽 ${ratioM[1]} vs 图 ${w}x${h}），裁切量大，建议 crop`);
        }
      } catch { /* 尺寸读取失败忽略 */ }
    }

    let newTag = origTag.replace(/\bsrc="[^"]*"/, `src="${imgSpec.dataUrl}"`);
    if (imgSpec.cropStyle) {
      newTag = `<span class="ph-img__crop" style="position:absolute;inset:0;overflow:hidden;display:block;">${newTag.replace('<img ', `<img style="position:absolute;object-fit:cover;${imgSpec.cropStyle}" `)}</span>`;
    }

    // 容器开标签补 data-filled（隐藏 .ph-img__label 占位文字）
    let prefix = before;
    if (lastOpen && !/<\/(?:div|span|figure|li|section)\b/i.test(before.slice(lastOpen.index + lastOpen[0].length))) {
      const filled = /\bdata-filled\b/.test(lastOpen[0]) ? lastOpen[0] : lastOpen[0].replace(/>$/, ' data-filled>');
      prefix = before.slice(0, lastOpen.index) + filled + before.slice(lastOpen.index + lastOpen[0].length);
    }
    body = prefix + newTag + body.slice(at + origTag.length);
  }

  // 3) frame-img 手机框（单源内嵌：仅当本页真有手机框槽才读取共享 PNG 现场编码，缺文件即停）
  //    不依赖 class 与 src 的属性顺序：整标签匹配后在标签内替换 src
  if (/<img\b[^>]*\bframe-img\b/.test(body)) {
    const frameSrc = getFrameDataUrl();
    body = body.replace(/<img\b[^>]*>/g, (tag) =>
      /\bframe-img\b/.test(tag) ? tag.replace(/\bsrc="[^"]*"/, `src="${frameSrc}"`) : tag);
  }

  // 4) 文字槽（以 repeat 替换后 body 中残留的 {{}} 为准 = 顶层槽）
  const remaining = [...new Set([...body.matchAll(/\{\{([^}]+)\}\}/g)].map((m) => m[1].trim()))];
  for (const name of remaining) {
    consumed.add(name);
    const v = fields[name];
    if (v === undefined || v === null || v === '') { errors.push(`${layout}: 槽 "${name}" 为空（必填）`); continue; }
    const sv = String(v);
    checkRich(sv, `${layout}:${name}`, errors);
    // 白名单标签保留生效，裸 < > 转义显示（白名单外标签已在 checkRich 硬停）
    body = body.split(`{{${name}}}`).join(richHtml(sv));
  }

  // 5) plan 多余字段
  for (const k of Object.keys(fields)) {
    if (!consumed.has(k)) errors.push(`${layout}: plan 字段 "${k}" 与母版槽位对不上`);
  }

  // 6) {{ 残留 + layer 唯一
  const residual = body.match(/\{\{[^}]*\}\}/g);
  if (residual) errors.push(`${layout}: {{ 占位符残留: ${residual.slice(0, 4).join(' ')}${residual.length > 4 ? ' …' : ''}}`);
  const layers = [...body.matchAll(/data-layer="([^"]+)"/g)].map((m) => m[1]);
  const dup = layers.filter((v, i) => layers.indexOf(v) !== i);
  if (dup.length) errors.push(`${layout}: data-layer 重复 ${[...new Set(dup)].join(',')}`);

  return { body, unitLayerMaps };
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
//   `≤N字`   = 视觉宽度单位（1 单位 ≈ 一个汉字宽）。汉字/全角 = 1；ASCII 大写 0.68、小写 0.55、
//              数字 0.58、半角标点/符号 0.45；空白 0；HTML 标签 0；emoji 等 = 1。
//              建模值 ≥ `--font-report` 三档实测上限（serif 700 / sans 400 / mono 600：大写 ≤0.664、
//              小写 ≤0.534、数字 ≤0.575、半角标点 ≤0.324）——宁可早告警，不放过溢出。
//              这三档之外（如宋 900 / 苹方 600）脚本不测，复现不出来，不作为建模依据。
//              实测可用 `--font-report` 复现（它打印三套栈实测值，判据：建模值 ≥ 实测）；
//              换字体栈或换机器后必须重测，模型只对实测的那三档成立。
// 【旧口径，已注释存档勿引用】建模值逐项 ≥ 本机全部字重实测上限（宋 700/900、苹方 400/600：
//              大写 ≤0.674、小写 ≤0.547、数字 ≤0.576、半角标点 ≤0.332）。
//   `≤N字符` = 实际字符个数（ASCII/数字槽的原始意图，如 big-num≤3字符、app≤14字符）。
//   为何区分：按码点算宽度会让「10 字的英文单词」独占 10 字位（实际只占约 5.2 字宽），
//   而 ASCII 短槽（编号/型号/文件名）要的确实是字符个数，不能被宽度稀释。
const CHAR_TOLERANCE = 0.2;   // 超限 20% 以内不告警（同一字号下偶发换行可接受）
const ASCII_WIDTH = { upper: 0.68, lower: 0.55, digit: 0.58, punct: 0.45 };
const isFullWidth = (ch) => /[\u1100-\u115F\u2E80-\u303F\u3041-\u33FF\u3400-\u4DBF\u4E00-\u9FFF\uA000-\uA4CF\uAC00-\uD7A3\uF900-\uFAFF\uFE10-\uFE6F\uFF01-\uFF60\uFFE0-\uFFE6]/.test(ch);
function charWidth(ch) {
  const code = ch.codePointAt(0);
  if (code <= 0x20 || ch === '\u00a0') return 0;
  if (code < 0x7f) {
    if (code >= 0x41 && code <= 0x5a) return ASCII_WIDTH.upper;
    if (code >= 0x61 && code <= 0x7a) return ASCII_WIDTH.lower;
    if (code >= 0x30 && code <= 0x39) return ASCII_WIDTH.digit;
    return ASCII_WIDTH.punct;
  }
  if (isFullWidth(ch)) return 1;
  return 1;   // emoji / 其他文字符号按一个汉字宽（保守）
}
function stripMarkup(value) {
  return String(value).replace(/<[^>]+>/g, '').replace(/\s+/g, '');
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
    if (fieldKey === key) return true;
    if (fieldKey.split('-')[0] === key) return true;
    if (new RegExp(`^${escapeRe(key)}\\d+$`).test(fieldKey)) return true;
    if (key.includes('*')) return new RegExp(`^${escapeRe(key).replace(/\*/g, '[-0-9]*')}$`).test(fieldKey);
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
  // ① `key≤N行每行≤M字/字符`——行数与单行宽度都要管（code 槽用此写法；它不匹配 ② 的正则，必须单独解析，
  //    否则这条限制会静默失效）
  for (const m of line.matchAll(/([A-Za-z0-9*.-]+)≤(\d+)行每行≤(\d+)(字符|字)/g)) {
    const [, key, maxLines, perLimit, unit] = m;
    const byWidth = unit === '字';
    emit(key, byWidth, +perLimit, (k, v, bw, limit, ceiling) => {
      // 先按 <br> 切行，再剥其余标签——顺序反了会把 br 一起剥掉，多行被当成一行
      const lines = String(v).split(/<br\s*\/?>|\n/i).map((s) => s.replace(/<[^>]+>/g, '').trim()).filter(Boolean);
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
const targets = ONLY ? pages.filter((p) => ONLY.some((o) => (p.nn || '').padStart(2, '0') === o.padStart(2, '0'))) : pages;
if (!targets.length) fail('--only 过滤后无页面');

const usedFiles = [];
const allWarns = [];
const built = [];
for (const page of targets) {
  const nn = String(page.nn || '').padStart(2, '0');
  if (!nn || nn === '00') fail('每页需 nn 序号');
  if (page.layout === 'custom/...' || String(page.layout).startsWith('custom/')) {
    if (!page.markup) fail(`P${nn}: custom 页需 markup`);
    const rootM = page.markup.match(/<div class="artwork-page[^"]*"[^>]*>/);
    if (!rootM || !/data-artwork/.test(rootM[0]) || !/data-size="1080x1440"/.test(rootM[0])) fail(`P${nn}: custom markup 根节点须为 .artwork-page + data-artwork + data-size`);
    const layers = [...page.markup.matchAll(/data-layer="([^"]+)"/g)].map((m) => m[1]);
    const dup = layers.filter((v, i) => layers.indexOf(v) !== i);
    if (dup.length) fail(`P${nn}: custom markup data-layer 重复 ${[...new Set(dup)].join(',')}`);
    if (/position\s*:\s*fixed|@media|<script|animation\s*:|transition\s*:/.test(page.markup)) fail(`P${nn}: custom markup 含禁区属性`);
    built.push({ nn, name: page.name || `custom-${nn}`, html: page.markup, custom: true, fields: page.fields || {} });
    continue;
  }
  const layout = String(page.layout || '');
  if (!sections.has(layout)) fail(`P${nn}: layout "${layout}" 在 templates.html 中不存在`);
  const fields = page.fields || {};
  const errors = []; const warns = [];
  const { body, unitLayerMaps } = fillSection(layout, sections.get(layout), fields, errors, warns, usedFiles);
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
  const { rootTag, inner } = rootOf(body);
  const rootClose = '</div>';
  const masterHtml = `  ${rootTag}\n${inner}\n  ${rootClose}`;
  built.push({ nn, name: page.name || layout, html: masterHtml, custom: false, layout, fields, unitLayerMaps });
}

// ---------- 写产物 ----------
fs.mkdirSync(path.join(taskDir, 'assets'), { recursive: true });
for (const f of new Set(usedFiles)) fs.copyFileSync(f, path.join(taskDir, 'assets', path.basename(f)));

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
// 注：图槽键的值仍为 plan 申报的 {src, crop} 对象——编辑器当前不读 fields.json（T6 未做），届时按 image 图层消费
// repeat 条目短名经 unitLayerMaps 映射为单元元素的 data-layer，并加与克隆体一致的 -2/-3 后缀
// 只读体检不写：诊断只跑 --only 指定页，写了会把多页的 fields/manifest 覆盖成单页版
if (!DIAG_ONLY) {
  // 图槽 src 统一转成交付区可解析的 `assets/<文件名>`：素材副本按 basename 平铺在 assets/，
  // plan 里的 `shots/xxx.png` 只存在于运行区，交付目录没有 shots/（T6 注入时会找不到图）
  const normField = (v) => (v && typeof v === 'object' && typeof v.src === 'string')
    ? { ...v, src: `assets/${path.basename(v.src)}` }
    : v;
  const pagesOut = [];
  for (const b of built) {
    const flat = {};
    for (const [k, v] of Object.entries(b.fields)) {
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
    pagesOut.push({ id: `p${b.nn}`, fields: flat });
  }
  fs.writeFileSync(path.join(taskDir, 'fields.json'), JSON.stringify({ canvas: { width: 1080, height: 1440 }, pages: pagesOut }, null, 2));
}

// editor.manifest.json（只读体检不写，理由同上）
if (!DIAG_ONLY) {
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
    if (w) console.log(`   字宽实测 ${role}(100px)：汉字 ${w.han} · 大写 ${w.upper} · 小写 ${w.lower} · 数字 ${w.digit} · 半角标点 ${w.punct}`);
  }
  for (const warn of rep.warnings) console.warn('   ⚠ ' + warn);
}

// ---------- 截图 ----------
const opts = createOptions({ selector: '.artwork-page', waitSelector: '.artwork-page', timeout: 60000 });
const inst = await launchBrowser(opts);
try {
  for (const b of built) {
    const file = path.join(taskDir, b.file || `P${b.nn}-${b.name}.html`);
    await withPage(inst, 'file:///' + file.replace(/\\/g, '/'), opts, async (ctx) => {
      if (FONT_REPORT) printFontReport(await fontReport(ctx), `P${b.nn}`);
      if (DIAG_ONLY) return;   // 只读体检：不截图、不写 PNG
      const shot = await captureReadyPage(ctx, opts);
      fs.writeFileSync(path.join(taskDir, `P${b.nn}.png`), shot.buffer);
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

  // preview.png 总览（只读体检不生成：--only 只有单页，拼图会覆盖多页运行区的总览）
  if (!DIAG_ONLY) {
    const files = built.map((b) => `P${b.nn}.png`);
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
  for (const b of built) white.push(`P${b.nn}-${b.name}.html`, `P${b.nn}.png`);
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
