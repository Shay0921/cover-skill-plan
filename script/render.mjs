#!/usr/bin/env node
/* render.mjs · 实例化器（final/01 手册 §5）
 * 用法：node script/render.mjs runs/<任务>/ [--check-geometry] [--only N01,N02]
 * 输入：runs/<任务>/plan.json + 素材图片（相对任务目录）
 * 输出（任务目录内）：P<nn>-<名>.html + P<nn>.png + preview.png + assets/ + editor.manifest.json + fields.json
 * 硬校验（即停）：{{ 残留 / 图片缺失或格式不符 / 根节点与画布 / data-layer 重复 / 必填槽为空 / plan 字段与槽位对不上 / repeat 区间
 * 软校验（WARN）：字数超限（解析说明头"限制"行）/ 图片与槽位比例差异大
 * 即兴页（layout: custom/*）：形态校验 + --check-geometry 几何体检
 */
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import { launchBrowser, closeBrowser, withPage, evaluate, captureReadyPage, createOptions } from './shared/cdp.mjs';

const ROOT = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const taskDir = path.resolve(argv.find((a) => !a.startsWith('--')) || '');
const GEOM = argv.includes('--check-geometry');
const onlyArg = (argv.find((a) => a.startsWith('--only')) || '').split('=')[1];
const ONLY = onlyArg ? onlyArg.split(',').map((s) => s.trim()) : null;

if (!taskDir || !fs.existsSync(path.join(taskDir, 'plan.json'))) {
  console.error('用法: node script/render.mjs runs/<任务>/ [--check-geometry] [--only N01,N02]  （任务目录须含 plan.json）');
  process.exit(2);
}
const plan = JSON.parse(fs.readFileSync(path.join(taskDir, 'plan.json'), 'utf8'));
const STYLE = plan.style;
if (!STYLE) fail('plan.json 缺 style 字段');
const STYLE_DIR = path.join(ROOT, 'styles', STYLE);
const TPL = path.join(STYLE_DIR, 'templates.html');
const CSS_FILE = path.join(STYLE_DIR, 'style.css');
for (const f of [TPL, CSS_FILE]) if (!fs.existsSync(f)) fail(`风格文件缺失: ${f}`);

const MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' };
const OUT_PAGES = [];

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
  const openEnd = body.indexOf('>', body.indexOf('<div class="ai-page'));
  if (openEnd < 0) throw new Error('画布根缺失');
  const rootTag = body.slice(0, openEnd + 1).match(/<div class="ai-page[^"]*"[^>]*>/)[0];
  let depth = 1; const re = /<div\b|<\/div>/g; re.lastIndex = openEnd + 1; let mm; let closeStart = -1;
  while ((mm = re.exec(body))) { depth += mm[0] === '</div>' ? -1 : 1; if (!depth) { closeStart = mm.index; break; } }
  if (depth !== 0) throw new Error('根 div 未配对');
  return { rootTag, inner: body.slice(openEnd + 1, closeStart) };
}

// ---------- repeat 区间解析（单元前注释） ----------
function repeatRange(body, unitStart) {
  const before = body.slice(Math.max(0, unitStart - 400), unitStart);
  const m = before.match(/repeat\s*×(\d+)-(\d+)/);
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

// ---------- 富文本校验 ----------
const RICH_OK = /<span class="hl">|<\/span>|<br\s*\/?>|<strong>|<\/strong>/gi;
function checkRich(value, where, errors) {
  const stripped = value.replace(RICH_OK, '');
  if (/[<>]/.test(stripped)) errors.push(`${where}: 值含白名单外标签（只允许 span.hl / br / strong）`);
}
function escText(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

// ---------- 图片处理 ----------
function imgValue(v, where, errors, usedFiles) {
  const spec = typeof v === 'string' ? { src: v } : v;
  if (!spec || typeof spec.src !== 'string' || !spec.src) { errors.push(`${where}: 图片值为空`); return null; }
  const file = path.resolve(taskDir, spec.src);
  const ext = path.extname(file).toLowerCase();
  if (!fs.existsSync(file)) { errors.push(`${where}: 图片不存在 ${spec.src}`); return null; }
  if (!MIME[ext]) { errors.push(`${where}: 图片格式不符（仅 PNG/JPEG/WebP）${spec.src}`); return null; }
  usedFiles.push(file);
  let html = `<img class="ph-img__img" src="${'data:' + MIME[ext] + ';base64,' + fs.readFileSync(file).toString('base64')}" alt="">`;
  if (spec.crop) {
    const crop = parseCrop(spec.crop);
    if (!crop) { errors.push(`${where}: crop 描述无法解析 "${spec.crop}"（例："下 55%" / "left 30%"）`); return null; }
    const style = crop.axis === 'y'
      ? `height:${(100 / crop.fraction).toFixed(1)}%;width:100%;${crop.align === 'end' ? 'bottom:0;' : crop.align === 'start' ? 'top:0;' : 'top:50%;transform:translateY(-50%);'}`
      : `width:${(100 / crop.fraction).toFixed(1)}%;height:100%;${crop.align === 'end' ? 'right:0;' : crop.align === 'start' ? 'left:0;' : 'left:50%;transform:translateX(-50%);'}`;
    html = `<span class="ph-img__crop" style="position:absolute;inset:0;overflow:hidden;display:block;">${html.replace('<img ', `<img style="position:absolute;object-fit:cover;${style}" `)}</span>`;
  }
  return html;
}
function parseCrop(desc) {
  const m = String(desc).match(/^(上|下|左|右|中)?\s*(\d{1,3})\s*%$/);
  if (m) {
    const axis = ['上', '下'].includes(m[1]) || (!m[1] && false) ? 'y' : ['左', '右'].includes(m[1]) ? 'x' : 'y';
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
  const imgIds = [...body.matchAll(/data-slot="image"[^>]*data-layer="([^"]+)"/g)].map((m) => m[1]);
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
        // checkRich 已拦下白名单外标签，此处原样注入（富文本 br/strong/span.hl 生效）
        html = html.split(`{{${ph}}}`).join(sv);
      }
      if (i > 0) html = html.replace(/data-layer="([^"]+)"/g, (_, id) => `data-layer="${id}-${i + 1}"`);
      html = html.replace(/\s*data-repeat="[^"]*"/g, ''); // 克隆件是具体内容，不再携带 repeat 标记
      return html;
    });
    body = body.slice(0, u.start) + rendered.join('\n') + body.slice(u.end);
  }

  // 2) 图片槽
  for (const id of imgIds) {
    consumed.add(id);
    const v = fields[id];
    if (v === undefined) { errors.push(`${layout}: 图槽 "${id}" 未在 plan 中填报（必填）`); continue; }
    const html = imgValue(v, `${layout}:${id}`, errors, usedFiles);
    if (!html) continue;
    // 定位该 img 的完整标签并替换
    const tagRe = new RegExp(`<img class="ph-img__img"[^>]*data-layer="${id}"[^>]*>`);
    if (!tagRe.test(body)) { errors.push(`${layout}: 图槽 ${id} 标签定位失败`); continue; }
    body = body.replace(tagRe, html);
    // ratio 软校验
    const vSpec = typeof v === 'string' ? { src: v } : v;
    const ratioM = body.match(new RegExp(`data-layer="${id}"[^>]*data-ratio="([0-9:]+)"`)) || body.match(new RegExp(`data-ratio="([0-9:]+)"[^>]*data-layer="${id}"`));
    if (ratioM && vSpec && vSpec.src) {
      const [rw, rh] = ratioM[1].split(':').map(Number);
      try {
        const buf = fs.readFileSync(path.resolve(taskDir, vSpec.src));
        // PNG 尺寸直接读 IHDR；JPEG/WebP 交给 Chrome 阶段
        if (buf.length > 24 && buf.toString('hex', 0, 8) === '89504e470d0a1a0a') {
          const w = buf.readUInt32BE(16), h = buf.readUInt32BE(20);
          const want = rw / rh, got = w / h;
          if (Math.abs(got - want) / want > 0.45) warns.push(`${layout}: 图槽 ${id} 比例差异大（槽 ${ratioM[1]} vs 图 ${w}x${h}），裁切量大，建议 crop`);
        }
      } catch { /* 尺寸读取失败忽略 */ }
    }
  }

  // 3) frame-img 兜底（手机框）
  const frameB64 = getFrameB64();
  body = body.replace(/(<img\b[^>]*class="[^"]*\bframe-img\b[^"]*"[^>]*?)\bsrc="[^"]*"/g, `$1src="${frameB64}"`);

  // 4) 文字槽（以 repeat 替换后 body 中残留的 {{}} 为准 = 顶层槽）
  const remaining = [...new Set([...body.matchAll(/\{\{([^}]+)\}\}/g)].map((m) => m[1].trim()))];
  for (const name of remaining) {
    consumed.add(name);
    const v = fields[name];
    if (v === undefined || v === null || v === '') { errors.push(`${layout}: 槽 "${name}" 为空（必填）`); continue; }
    const sv = String(v);
    checkRich(sv, `${layout}:${name}`, errors);
    // 校验通过后原样注入（富文本生效；白名单外标签已在 checkRich 硬停）
    body = body.split(`{{${name}}}`).join(sv);
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

  return { body, warns };
}
let _frame = null;
function getFrameB64() {
  if (!_frame) {
    const f = path.join(ROOT, 'styles/assets/iphone-frame.b64');
    _frame = fs.readFileSync(f, 'utf8').trim();
  }
  return _frame;
}

// ---------- 字数软校验（解析说明头"限制"行） ----------
function wordWarnings(headerText, filledValues, layout, warns) {
  if (!headerText) return;
  const line = headerText.split('\n').map((s) => s.trim()).find((l) => l.startsWith('限制：'));
  if (!line) return;
  for (const m of line.matchAll(/([A-Za-z0-9*-]+)≤(\d+)字/g)) {
    const key = m[1].replace(/\*$/, '');
    const candidates = Object.keys(filledValues).filter((k) => k === key || k.split('-')[0] === key || (key.endsWith('*') && k.slice(0, -1) && k.slice(0, -1) === key.slice(0, -1)));
    for (const k of candidates) {
      const v = filledValues[k];
      if (typeof v !== 'string') continue;
      const cjk = v.replace(/<[^>]+>/g, '').replace(/\s+/g, '');
      if (cjk.length > +m[2] + Math.ceil(+m[2] * 0.2)) warns.push(`${layout}: "${k}" 字数 ${cjk.length} 超限（≤${m[2]}），可能溢出`);
    }
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
    const rootM = page.markup.match(/<div class="ai-page[^"]*"[^>]*>/);
    if (!rootM || !/data-artwork/.test(rootM[0]) || !/data-size="1080x1440"/.test(rootM[0])) fail(`P${nn}: custom markup 根节点须为 .ai-page + data-artwork + data-size`);
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
  const { body } = fillSection(layout, sections.get(layout), fields, errors, warns, usedFiles);
  if (errors.length) {
    console.error(`\n❌ P${nn} · ${layout} 校验失败（即停）：`);
    errors.forEach((e) => console.error('   - ' + e));
    process.exit(1);
  }
  wordWarnings(headerComments[layout.split('-')[0]], fields, `P${nn}`, warns);
  allWarns.push(...warns);
  const { rootTag, inner } = rootOf(body);
  const rootClose = '</div>';
  const masterHtml = `  ${rootTag}\n${inner}\n  ${rootClose}`;
  built.push({ nn, name: page.name || layout, html: masterHtml, custom: false, layout, fields });
}

// ---------- 写产物 ----------
fs.mkdirSync(path.join(taskDir, 'assets'), { recursive: true });
for (const f of new Set(usedFiles)) fs.copyFileSync(f, path.join(taskDir, 'assets', path.basename(f)));

// 交付页 CSS：剥离 @import 行（pageApp pack.mjs 拒绝外链；交付走本机字体栈，见手册 §3.7。画廊保留屏显增强）
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
  fs.writeFileSync(path.join(taskDir, `P${b.nn}-${b.name}.html`), pageHtml);
}

// fields.json（plan 转写：键 = data-layer id）
{
  const pagesOut = [];
  for (const b of built) {
    const flat = {};
    for (const [k, v] of Object.entries(b.fields)) {
      if (Array.isArray(v)) {
        v.forEach((item, i) => {
          for (const [ik, iv] of Object.entries(item)) flat[i === 0 ? ik : `${ik}-${i + 1}`] = iv;
        });
      } else flat[k] = v;
    }
    pagesOut.push({ id: `p${b.nn}`, fields: flat });
  }
  fs.writeFileSync(path.join(taskDir, 'fields.json'), JSON.stringify({ canvas: { width: 1080, height: 1440 }, pages: pagesOut }, null, 2));
}

// editor.manifest.json
{
  fs.writeFileSync(path.join(taskDir, 'editor.manifest.json'), JSON.stringify({
    format: 'pageapp-editor-manifest', version: 1,
    root: '.ai-page', canvas: { width: 1080, height: 1440 }, layerMode: 'markers',
    assetDirs: ['./assets'],
    pages: built.map((b) => ({ file: `P${b.nn}-${b.name}.html`, id: `p${b.nn}`, name: `P${b.nn} · ${b.name}` })),
  }, null, 2));
}

// ---------- 截图 ----------
const opts = createOptions({ selector: '.ai-page', waitSelector: '.ai-page', timeout: 60000 });
const inst = await launchBrowser(opts);
try {
  for (const b of built) {
    const file = path.join(taskDir, `P${b.nn}-${b.name}.html`);
    await withPage(inst, 'file:///' + file.replace(/\\/g, '/'), opts, async (ctx) => {
      const shot = await captureReadyPage(ctx, opts);
      fs.writeFileSync(path.join(taskDir, `P${b.nn}.png`), shot.buffer);
    });
    if (b.custom && GEOM) {
      await withPage(inst, 'file:///' + file.replace(/\\/g, '/'), opts, async (ctx) => {
        const geo = await evaluate(ctx.cdp, ctx.sessionId, `(() => {
          const page = document.querySelector('.ai-page');
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

  // preview.png 总览
  {
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
    const cols = Math.min(4, built.length);
    const rows = Math.ceil(built.length / cols);
    await withPage(inst, 'file:///' + tmp.replace(/\\/g, '/'), { ...opts, selector: '.g', waitSelector: '.g' }, async (ctx) => {
      const shot = await captureReadyPage(ctx, { ...opts, selector: null });
      fs.writeFileSync(path.join(taskDir, 'preview.png'), shot.buffer);
    });
    fs.rmSync(tmp);
  }
} finally { await closeBrowser(inst); }

console.log(`\n✅ ${built.length} 页出图完毕 → ${rel(taskDir)}`);
if (allWarns.length) {
  console.log('⚠ 软校验 WARN:');
  allWarns.forEach((w) => console.log('   - ' + w));
}
