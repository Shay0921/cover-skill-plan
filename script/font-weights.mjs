#!/usr/bin/env node
/* font-weights.mjs · 字宽权重表生成器（维护脚本：换字体/换机后重跑，不在出图链路上）
 * 用法：
 *   node script/font-weights.mjs                       # 量默认 7 套候选字体 → 合并写入 script/font-weights.json
 *   node script/font-weights.mjs --families="A,B"      # 指定字体族名（含空格用引号，逗号分隔）
 *   node script/font-weights.mjs --dry                 # 只打印不写文件
 *   node script/font-weights.mjs --json                # 以 JSON 输出（便于管道）
 *
 * 原理：真浏览器 canvas measureText 逐字符量 em 比例（和 render 字数校验同一口径），
 *       并用 CDP getPlatformFontsForNode 报每个**候选族**的「实际命中 face」——写死的字体名
 *       不一定真命中（装没装、回退到谁），所以表里同时存 requested 与 matched。
 *       零依赖，复用 shared/cdp.mjs 的 Chrome 桥。
 * 为什么用 file:// 页面而不是 data: 页：实测两者命中与字宽完全一致（同机同 Chrome）。
 *       选 file:// 是为了与出图页同构（同一个 document origin 语义），且日后若探针需要带 @font-face
 *       的相对 url，data: 页没有 base URL、解析不到。
 *
 * 输出 script/font-weights.json：**跨平台累积表**——key = 字体族名，value = 字宽权重 + 平台标记。
 *   weights 是「字体属性」不是「机器属性」：实测过就永久保留，不被别的平台重跑抹掉；
 *   platforms 记「该族在各平台是否真装」（`{darwin:true, win32:false}`），render 按 process.platform 决定用哪个族。
 *   合并语义：本机没装的族只把 `platforms[本平台]` 记为 false，换机重跑即补齐。
 * 与 weightSource、本次探测的 installed/matched/measuredOn 同存，顶层记 generatedAt / generatedOn。
 * render.mjs 出图时**不探测**字体，而是按 CSS 三栈的声明顺序，取第一个「本平台真装且有实测权重」的族；
 * 表里没有可用项则回退到内置兜底值（偏宽，只会多报不会漏报）。
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import url from 'node:url';
import { launchBrowser, closeBrowser, withPage, evaluate, createOptions, WIDTH_SAMPLES } from './shared/cdp.mjs';
import { ROOT_CLASS } from './shared/canvas.mjs';

const ROOT = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'script', 'font-weights.json');
// 本次探测所在平台：写进 platforms 映射与顶层 generatedOn，供 render 按 process.platform 取族
const PLAT = process.platform;
// 无 platforms 字段的旧表：只能按「installed=true ⇒ 生成它的那个平台装过」推断归属，
// 否则那批实测会失去平台标记、在两边都不被取用。
const LEGACY_PLATFORM = 'darwin';
let prevReport = null;
try { if (fs.existsSync(OUT)) prevReport = JSON.parse(fs.readFileSync(OUT, 'utf8')); } catch { prevReport = null; }
const prevProfiles = prevReport?.profiles || {};
const argv = process.argv.slice(2);
const arg = (name, dflt) => {
  const i = argv.findIndex((a) => a === name || a.startsWith(name + '='));
  if (i < 0) return dflt;
  if (argv[i].startsWith(name + '=')) return argv[i].slice(name.length + 1);
  return argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : dflt;
};
const DRY = argv.includes('--dry');
const JSON_OUT = argv.includes('--json');
const familiesRaw = arg('--families', '');

// 默认探测清单：CSS 三栈里出现的全部族名。
//   --serif = Songti SC / SimSun / 宋体（各平台系统宋体，随系统自带）；
//   --sans  = PingFang SC / Microsoft YaHei；--mono = Menlo / Consolas。
//   render 的 pick() 只认栈内族名；本机没装的字体 installed=false、不参与校验，
//   换机后重跑本脚本会自动实测转正。
const DEFAULT_FAMILIES = [
  'Songti SC', 'SimSun', '宋体',                  // serif 栈（系统宋体）
  'PingFang SC', 'Microsoft YaHei',               // sans 栈（系统默认）
  'Menlo', 'Consolas',                            // mono 栈（系统默认）
];
const families = familiesRaw ? familiesRaw.split(',').map((s) => s.trim()).filter(Boolean) : DEFAULT_FAMILIES;

// 采样串：本文件不自己定义，直接 import shared/cdp.mjs 导出的 WIDTH_SAMPLES——
// 出图期体检（render --font-report → cdp.fontReport）用的就是这一组。
// W/m 单列是因为它们是「最宽大写/最宽小写」——模型取的是 26 字母平均值，W 才是真正的上界，
// 全大写标题（如「WWW」）会突破平均值模型，这是「单值模型」的已知代价，写进表里备查。
const SAMPLES = WIDTH_SAMPLES;
const PROBE_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'cover-font-'));
const PROBE_HTML = path.join(PROBE_DIR, '_font-probe.html');

function buildProbeHtml() {
  const rows = families.map((f, i) =>
    `<div class="probe" data-i="${i}" style="font:400 100px &quot;${f.replace(/"/g, '')}&quot;;">中文ABC测试Wm 0123</div>`).join('\n');
  return `<!doctype html><html><head><meta charset="utf-8"></head><body><div class="${ROOT_CLASS}">${rows}</div></body></html>`;
}

const opts = createOptions({ width: 900, height: 300, dsf: 1 });
const inst = await launchBrowser(opts);
let report;
try {
  fs.writeFileSync(PROBE_HTML, buildProbeHtml(), 'utf8');
  await withPage(inst, url.pathToFileURL(PROBE_HTML).href, opts, async (ctx) => {
    // 量宽：每个 family 用 canvas 直接指定族名量（不依赖 DOM 行的 class）。
    // 字重二档制：全库只有 400（不写）与 700（bold）两档字重，且真 Bold 面
    // advance 与 400 不同（Songti SC upper 0.6625→0.6712、PingFang SC 0.6689→0.6839 实测）——
    // 只量 400 会低估 bold 文本宽度、破「建模 ≥ 实测」不变量，所以两档都量，render 取较大值。
    const widths = await evaluate(ctx.cdp, ctx.sessionId, `(() => {
      const c = document.createElement('canvas').getContext('2d');
      const m = (font, text) => {
        c.font = font;
        let s = 0;
        for (const ch of text) s += c.measureText(ch).width;
        return +(s / [...text].length / 100).toFixed(4);
      };
      const families = ${JSON.stringify(families)};
      const samples = ${JSON.stringify(SAMPLES)};
      const out = {};
      for (const f of families) {
        out[f] = {};
        for (const wt of [400, 700]) {
          const font = wt + ' 100px "' + f.replace(/"/g, '') + '"';
          const w = {};
          for (const [k, text] of Object.entries(samples)) w[k] = m(font, text);
          w.W = m(font, 'W');
          w.m = m(font, 'm');
          out[f][wt] = w;
        }
      }
      return out;
    })()`);;

    // 命中检测：探针行上问 CDP 实际渲染 face，判断字体是否真装（没装会回退到别的族）
    const { root } = await ctx.cdp.send('DOM.getDocument', { depth: -1 }, ctx.sessionId);
    const acc = [];
    const walk = (n) => {
      if (n.nodeType === 1) {
        const a = n.attributes || [];
        let idx = null;
        for (let i = 0; i < a.length; i += 2) if (a[i] === 'data-i') idx = a[i + 1];
        if (idx !== null) acc.push({ id: n.nodeId, idx: +idx });
      }
      for (const ch of n.children || []) walk(ch);
    };
    walk(root);
    await ctx.cdp.send('CSS.enable', {}, ctx.sessionId);
    const matched = {};
    for (const n of acc) {
      const { fonts } = await ctx.cdp.send('CSS.getPlatformFontsForNode', { nodeId: n.id }, ctx.sessionId);
      matched[families[n.idx]] = fonts.map((f) => f.familyName).join('+') || '(none)';
    }

    // 先继承旧表：缩范围时未探测的族原样保留，避免表变小；未缩范围时等价于空操作
    const profiles = { ...prevProfiles };
    // 「真装」判据：CDP 报的某个实际 face 与请求族名同名（或带 -Regular / Bold 之类后缀）。
    // 不能用「首词包含」——名字相近的两个族会因首词相同而互相误判为已装，
    // 于是把回退字体的宽度当成该族权重写进表里。
    const isInstalled = (family, faceList) => {
      const target = family.toLowerCase();
      return String(faceList || '').split('+').map((s) => s.trim().toLowerCase())
        .some((s) => s === target || s.startsWith(target + '-') || s.startsWith(target + ' '));
    };
    for (const f of families) {
      const installed = isInstalled(f, matched[f]);
      const prev = prevProfiles[f] || {};
      // 平台归属：无 platforms 的旧表里 installed=true 的族按 LEGACY_PLATFORM 归属
      const prevPlatforms = (prev.platforms && typeof prev.platforms === 'object')
        ? prev.platforms
        : (prev.installed ? { [LEGACY_PLATFORM]: true } : {});
      // measuredOn 缺失时按 platforms 里第一个 true 的平台回填（老表迁移与手工改表都能自愈），否则打印不出权重来源
      const prevMeasuredOn = prev.measuredOn || (prev.weights ? Object.keys(prevPlatforms).find((k) => prevPlatforms[k]) || null : null);
      profiles[f] = {
        requested: f,
        matched: matched[f] || '(unknown)',
        // 本次探测结论：本机是否真装（人读 / 打印用；取用与否看 platforms[当前平台]）
        installed,
        // 跨平台累积：平台 → 该平台是否真装。本次结论覆盖本平台那一格，别的平台原样保留
        platforms: { ...prevPlatforms, [PLAT]: installed },
        measuredOn: installed ? PLAT : (prevMeasuredOn || null),
        // 只信任「本机真装时」量到的 canvas 实测值：没装时 canvas 量的是回退字体宽度，绝不能当本字体权重。
        // 但没装 ≠ 抹掉旧值——weights 是字体属性，保留原平台的实测（merge 语义），由 platforms 决定谁用得上。
        // weights 含 400/700 两档（二档制），render 逐类取两档较大值做建模值（保守，宁可早告警）
        weights: installed ? widths[f] : (prev.weights || null),
        weightSource: installed ? 'canvas(本机实测·400/700 两档)' : (prev.weightSource || null),
      };
    }
    report = {
      generatedAt: new Date().toISOString(),
      generatedOn: PLAT,
      note: '跨平台累积表。weights = canvas measureText 实测 em 比例（含 400/700 两档，二档制；W/m 为最宽大写/小写），属「字体属性」，实测过就保留、不被别的平台重跑抹掉；platforms = 该族在各平台是否真装。render 按 CSS 栈顺序取第一个 platforms[本平台]=true 且有 weights 的族，逐类取两档较大值；无可用项时用内置兜底（偏宽，只多报不漏报）。installed/matched/measuredOn 是「最近一次探测」的结论，供人读与排查。',
      samples: Object.fromEntries(Object.entries(SAMPLES).map(([k, v]) => [k, v.length + ' chars'])),
      profiles,
    };
  });
} finally {
  await closeBrowser(inst);
  fs.rmSync(PROBE_DIR, { recursive: true, force: true });
}

if (JSON_OUT) {
  console.log(JSON.stringify(report, null, 2));
} else {
  // 终端列宽按「显示宽度」算（汉字占 2 列）：直接用 padEnd 会按 code unit 计，
  // 中文表头与族名两行对不齐，数值列还会粘连（0.34461.047）。
  const dw = (s) => [...String(s)].reduce((n, ch) => n + (/[\u1100-\uFFFF]/.test(ch) ? 2 : 1), 0);
  const padR = (s, n) => String(s) + ' '.repeat(Math.max(0, n - dw(s)));
  console.log('字宽权重表（em 比例，越小越窄；400/700 两档 = 二档制全档位）：');
  console.log('  ' + padR('字体', 22) + padR('档', 5) + padR('汉字', 6) + padR('大写', 8) + padR('小写', 8) + padR('数字', 8) + padR('标点', 8) + padR('W', 8) + 'm');
  for (const [f, p] of Object.entries(report.profiles)) {
    // ✓ 本机真装（本次实测）· ◦ 本机未装但表里留有别的平台实测（合并保留）· ↩ 无任何实测
    const mark = p.installed ? '✓' : (p.weights ? '◦' : '↩');
    for (const wt of ['400', '700']) {
      const w = p.installed && p.weights?.[wt];
      const cells = w
        ? padR(w.han, 6) + padR(w.upper, 8) + padR(w.lower, 8) + padR(w.digit, 8) + padR(w.punct, 8) + padR(w.W, 8) + w.m
        : (wt === '400' ? (p.weights ? `(本机未装，保留 ${p.measuredOn || '其他平台'} 实测)` : '(无实测，权重为空)') : '');
      if (!w && wt === '700') continue;
      console.log('  ' + padR(mark + f, 22) + padR(wt, 5) + cells);
    }
  }
  console.log('\n  ✓=本机真装（本次实测）◦=本机未装但保留其他平台实测 ↩=从无实测；render 只取 ✓ 且建模值 = 两档逐类取大');
}

if (!DRY && !JSON_OUT) {
  fs.writeFileSync(OUT, JSON.stringify(report, null, 2), 'utf8');
  console.log(`\n✅ 已写入 ${path.relative(ROOT, OUT)}`);
} else if (!DRY) {
  fs.writeFileSync(OUT, JSON.stringify(report, null, 2), 'utf8');
}
