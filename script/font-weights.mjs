#!/usr/bin/env node
/* font-weights.mjs · 字宽权重表生成器（维护脚本：换字体/换机后重跑，不在出图链路上）
 * 用法：
 *   node script/font-weights.mjs                       # 量默认 8 套候选字体 → 写 script/font-weights.json
 *   node script/font-weights.mjs --families="A,B"      # 指定字体族名（含空格用引号，逗号分隔）
 *   node script/font-weights.mjs --dry                 # 只打印不写文件
 *   node script/font-weights.mjs --json                # 以 JSON 输出（便于管道）
 *
 * 原理：真浏览器 canvas measureText 逐字符量 em 比例（和 render 字数校验同一口径），
 *       并用 CDP getPlatformFontsForNode 报每个**候选族**的「实际命中 face」——写死的字体名
 *       不一定真命中（装没装、回退到谁），所以表里同时存 requested 与 matched。
 *       零依赖，复用 shared/cdp.mjs 的 Chrome 桥。
 * 为什么用 file:// 页面而不是 data: 页：2026-11-18 实测两者命中与字宽完全一致（同机同 Chrome），
 *       选 file:// 是为了与出图页同构（同一个 document origin 语义），且日后若探针需要带 @font-face
 *       的相对 url，data: 页没有 base URL、解析不到；与「data: 页字体解析异常」的旧说法无关。
 *
 * 输出 script/font-weights.json：key = 字体族名，value = requested/matched/installed + 字宽五类×400/700 两档（另存 W/m 上界）
 * 与 weightSource，顶层另记 generatedAt。
 * render.mjs 出图时**不探测**字体，而是按 CSS 三栈的声明顺序，从本表取第一个 installed=true 的字体权重；
 * 表里没有可用的则回退到内置兜底值。
 */
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import { launchBrowser, closeBrowser, withPage, evaluate, createOptions, WIDTH_SAMPLES } from './shared/cdp.mjs';

const ROOT = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'script', 'font-weights.json');
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
const PROBE_HTML = path.join(path.dirname(url.fileURLToPath(import.meta.url)), '..', 'runs', '_font-probe.html');

function buildProbeHtml() {
  const rows = families.map((f, i) =>
    `<div class="probe" data-i="${i}" style="font:400 100px &quot;${f.replace(/"/g, '')}&quot;;">中文ABC测试Wm 0123</div>`).join('\n');
  return `<!doctype html><html><head><meta charset="utf-8"></head><body><div class="artwork-page">${rows}</div></body></html>`;
}

const opts = createOptions({ width: 900, height: 300, dsf: 1 });
const inst = await launchBrowser(opts);
let report;
try {
  fs.mkdirSync(path.dirname(PROBE_HTML), { recursive: true });
  fs.writeFileSync(PROBE_HTML, buildProbeHtml(), 'utf8');
  await withPage(inst, url.pathToFileURL(PROBE_HTML).href, opts, async (ctx) => {
    // 量宽：每个 family 用 canvas 直接指定族名量（不依赖 DOM 行的 class）。
    // 二档制（2026-11-18 定案）：全库只有 400（不写）与 700（bold）两档字重，且真 Bold 面
    // advance 与 400 不同（Songti SC upper 0.6625→0.6712、PingFang SC 0.6689→0.6839，2026-11-18 实测）——
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

    const profiles = {};
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
      profiles[f] = {
        requested: f,
        matched: matched[f] || '(unknown)',
        // 只信任本机真装的 canvas 实测值：没装时 canvas 量到的是回退字体宽度，绝不能当本字体权重。
        // 没装的字体 weights 置 null、不参与 render 校验；换机重跑本脚本会自动实测转正。
        installed,
        // weights 含 400/700 两档（二档制），render 逐类取两档较大值做建模值（保守，宁可早告警）
        weights: installed ? widths[f] : null,
        weightSource: installed ? 'canvas(本机实测·400/700 两档)' : null,
      };
    }
    report = {
      generatedAt: new Date().toISOString(),
      note: 'canvas measureText 实测 em 比例，weights 含 400/700 两档（二档制）；W/m 为最宽大写/小写。render 按 CSS 栈顺序查表（只认 installed=true）、逐类取两档较大值；无可用时用内置兜底。installed=false 条目 weights=null，不参与本机校验。',
      samples: Object.fromEntries(Object.entries(SAMPLES).map(([k, v]) => [k, v.length + ' chars'])),
      profiles,
    };
  });
} finally {
  await closeBrowser(inst);
  try { fs.unlinkSync(PROBE_HTML); } catch { /* ignore */ }
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
    const mark = p.installed ? '✓' : '↩';
    for (const wt of ['400', '700']) {
      const w = p.installed && p.weights?.[wt];
      const cells = w
        ? padR(w.han, 6) + padR(w.upper, 8) + padR(w.lower, 8) + padR(w.digit, 8) + padR(w.punct, 8) + padR(w.W, 8) + w.m
        : (wt === '400' ? '(未装，无权重)' : '');
      if (!w && wt === '700') continue;
      console.log('  ' + padR(mark + f, 22) + padR(wt, 5) + cells);
    }
  }
  console.log('\n  ✓=本机真装（face 名匹配，参与校验） ↩=未装/回退（weights=null，不参与本机校验）；render 建模值 = 两档逐类取大');
}

if (!DRY && !JSON_OUT) {
  fs.writeFileSync(OUT, JSON.stringify(report, null, 2), 'utf8');
  console.log(`\n✅ 已写入 ${path.relative(ROOT, OUT)}`);
} else if (!DRY) {
  fs.writeFileSync(OUT, JSON.stringify(report, null, 2), 'utf8');
}
