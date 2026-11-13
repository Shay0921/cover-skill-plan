// 阶段 2 自检 harness v2（dev 专用，不属于生产管线）
// 用法: node render-selfcheck.mjs
// v2 修正：repeat 按源页实际条数展开（忠实对照）；h1/quote 槽位用短假文字（守住"标题≤1行"耦合）
import fs from 'node:fs';
import path from 'node:path';
import { createOptions, launchBrowser, closeBrowser, withPage, captureReadyPage, evaluate } from '../../tools/cdp.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const SKILL = path.dirname(ROOT);
const RECIPES = path.join(ROOT, 'recipes');
const GALLERY = path.join(ROOT, 'controlled', 'controlled-composition-1111-1148', 'work', 'src');
const OUT = path.join(ROOT, '_sc');
const seedCss = fs.readFileSync(path.join(SKILL, 'seed', 'paper-journal.html'), 'utf8')
  .match(/<style(?:\s[^>]*)?>([\s\S]*?)<\/style\s*>/i)[1]
  .replace(/@import url\('\.\/(fonts\/[^']+\.css)'\);/g, (_, rel) =>
    `@import url('${'file:///' + path.join(SKILL, 'seed', rel).replace(/\\/g, '/')}');`);

// 短假文字表：命中这些名字的槽位一律用短串，防止标题折行破坏 ≤1 行耦合
const SHORT = /主标题|标题|金句文本|刊期/;
const SHORT_FAKE = { '主标题前段': '一句话', '标题高亮': '高亮', '主标题后段': '收尾', '封面主标题前段': '一句话', '封面高亮词': '高亮', '封面主标题后段': '收尾', '金句文本': '一句值得记住的话', '刊期年月': '2026-11', '刊期号': '第 07 期' };
// v3 修正（裁决 7）：① 假文字按槽位形状给值（序字类→1 字、副题类→整句）；② 资产路径指向画廊 out/assets；③ repeat 注释在母版之后时向前回溯提取母版
const SENTENCE_FAKE = '这是一段占位说明，用于核对折行密度';
const BAR_HEIGHTS = [50, 100, 75, 25]; // 柱高假值按画廊 p30 实测序列，四柱形状对照
const ASSET_PREFIX = '../../../out/assets/'; // 预览页在 work/src/_sc/，资产在 <gallery>/out/assets/
// iphone-frame.png 缺失则从 dev/cases/assets 补一次（修全库手机区空白、26 分割线压手机）
const outAssetsDir = path.join(ROOT, 'controlled', 'controlled-composition-1111-1148', 'out', 'assets');
if (!fs.existsSync(path.join(outAssetsDir, 'iphone-frame.png'))) {
  fs.mkdirSync(outAssetsDir, { recursive: true });
  fs.copyFileSync(path.join(ROOT, 'cases', 'assets', 'iphone-frame.png'), path.join(outAssetsDir, 'iphone-frame.png'));
}

fs.mkdirSync(OUT, { recursive: true });
const files = fs.readdirSync(RECIPES).filter(f => f.endsWith('.part.html')).sort();
const jobs = [];
for (const f of files) {
  const body = fs.readFileSync(path.join(RECIPES, f), 'utf8');
  const head = body.match(/<!-- recipe: ([\w.-]+) \| source: p(\d{2}) \| (.+?) -->/);
  if (!head) { jobs.push({ file: f, error: '缺 recipe 头注释' }); continue; }
  const [, name, nn, label] = head;
  const srcPart = fs.readFileSync(path.join(GALLERY, `p${nn}.part.html`), 'utf8');
  const assetSrcs = [...srcPart.matchAll(/src="(assets\/[^"]+)"/g)].map(m => ASSET_PREFIX + m[1].replace(/^assets\//, ''));
  // 源页组件计数：repeat 展开的忠实条数依据
  const srcCounts = {};
  for (const m of srcPart.matchAll(/data-component="([\w-]+)"/g)) srcCounts[m[1]] = (srcCounts[m[1]] || 0) + 1;

  // 展开 repeat：优先取注释后第一个完整元素为母版；注释后无开元素时向前回溯
  // 注释前最后一个闭合标签并反向配对其开标签（compare 族母版后置写法的根因修复）
  function expandRepeats(text) {
    const re = /<!--\s*repeat\s*×(\d+)(?:-(\d+))?:\s*[^>]*?-->/g;
    let out = '', last = 0, m;
    while ((m = re.exec(text))) {
      out += text.slice(last, m.index);
      const max = m[2] ? +m[2] : +m[1];
      let p = m.index + m[0].length;
      while (/\s/.test(text[p])) p++;
      let tagStart = -1;
      if (text[p] === '<' && text[p + 1] !== '!' && text[p + 1] !== '/') {
        tagStart = p;
      } else {
        const before = text.slice(0, m.index);
        const closeRe = /<\/([\w-]+)\s*>/g;
        let lastClose = null, cm;
        while ((cm = closeRe.exec(before))) lastClose = cm;
        if (lastClose) {
          const tag = lastClose[1];
          const opens = [...before.slice(0, lastClose.index).matchAll(new RegExp(`<(/?)${tag}(\\s[^>]*?)?>`, 'g'))];
          let depth = 0;
          for (let i = opens.length - 1; i >= 0; i--) {
            if (opens[i][1] === '/') { depth++; continue; }
            if (depth === 0) { tagStart = opens[i].index; break; }
            depth--;
          }
        }
      }
      if (tagStart < 0) { out += m[0]; last = m.index + m[0].length; continue; }
      const tag = text.slice(tagStart + 1).split(/[\s>]/)[0];
      const tagRe = new RegExp(`<${tag}(\\s|>)|</${tag}>`, 'g');
      tagRe.lastIndex = tagStart;
      let depth = 0, q = -1, t;
      while ((t = tagRe.exec(text))) {
        depth += t[0].startsWith('</') ? -1 : 1;
        if (depth === 0) { q = t.index + t[0].length; break; }
      }
      if (q < 0) { out += m[0]; last = m.index + m[0].length; continue; }
      const unit = text.slice(tagStart, q);
      // want 按母版元素的 data-component 查源页计数（组件名≠标签名，如 list 行的 tag 是 div）
      const openTag = text.slice(tagStart, text.indexOf('>', tagStart) + 1);
      const comp = openTag.match(/data-component="([^"]+)"/);
      const want = (comp && srcCounts[comp[1]]) ?? max;
      const count = Math.max(1, Math.min(max, want));
      // 回溯分支中母版原件已在 slice(last, m.index) 进入输出，只补 count-1 份
      out += unit.repeat(tagStart >= m.index ? count : count - 1);
      if (tagStart >= m.index) {
        // 母版在注释后：注释被丢弃，从母版尾继续扫描
        last = q;
        re.lastIndex = q;
      } else {
        // 母版在注释前（回溯）：注释原样保留，从注释尾继续扫描，防止重复匹配同一注释
        out += m[0];
        last = m.index + m[0].length;
        re.lastIndex = last;
      }
    }
    out += text.slice(last);
    return out;
  }
  const expanded = expandRepeats(body);
  let imgIdx = 0, barIdx = 0;
  const filled = expanded.replace(/\{\{([^}]+)\}\}/g, (_, ph) => {
    if (/^图\d+$/.test(ph)) return assetSrcs[imgIdx++] ?? 'assets/MISSING.png';
    if (ph === '柱高') return String(BAR_HEIGHTS[barIdx++ % BAR_HEIGHTS.length]);
    if (SHORT_FAKE[ph]) return SHORT_FAKE[ph];
    if (SHORT.test(ph)) return ph.slice(0, 4);
    if (/序字|编号|序号/.test(ph)) return '1';
    if (/副题|引言|说明|标语|签名|署名|注脚|注解|出处|描述/.test(ph)) return SENTENCE_FAKE;
    return ph;
  });
  const html = `<!doctype html>\n<html lang="zh-CN"><head><meta charset="utf-8"><title>${name}</title><style>${seedCss}</style></head>\n<body>\n${filled}\n</body></html>\n`;
  const previewFile = path.join(GALLERY, '_sc', name.replace(/\.part\.html$/, '.html'));
  fs.mkdirSync(path.dirname(previewFile), { recursive: true });
  fs.writeFileSync(previewFile, html);
  jobs.push({ file: f, name, nn, label, previewFile, srcCounts });
}

const opts = createOptions();
const inst = await launchBrowser(opts);
const results = [];
for (const job of jobs) {
  if (job.error) { results.push({ ...job, status: 'FAIL', reason: job.error }); continue; }
  try {
    await withPage(inst, 'file:///' + job.previewFile.replace(/\\/g, '/'), opts, async ctx => {
      const check = await evaluate(ctx.cdp, ctx.sessionId, `(() => {
        const page = document.querySelector('.p-page');
        if (!page) return { fatal: '缺 .p-page' };
        const pr = page.getBoundingClientRect();
        const over = [];
        for (const el of page.querySelectorAll('*')) {
          if (el.closest('[data-bleed],.cover-bleed,.bleed')) continue;
          const r = el.getBoundingClientRect();
          if (r.width === 0 && r.height === 0) continue;
          const dx = Math.max(0, r.right - pr.right - 2, pr.left - r.left - 2);
          const dy = Math.max(0, r.bottom - pr.bottom - 2, pr.top - r.top - 2);
          if (dx > 0 || dy > 0) over.push({ tag: el.tagName, cls: (el.className+'').slice(0,40), dx: +dx.toFixed(1), dy: +dy.toFixed(1) });
          if (over.length >= 5) break;
        }
        const h1 = page.querySelector('.h1');
        return { w: pr.width, h: pr.height, overflow: over, h1Lines: h1 ? Math.round(h1.getBoundingClientRect().height / (parseFloat(getComputedStyle(h1).lineHeight) || parseFloat(getComputedStyle(h1).fontSize) * 1.2)) : null };
      })()`);
      const shot = await captureReadyPage(ctx, opts);
      const pngName = `${job.nn}-${job.name.replace(/\.part\.html$/, '')}.png`;
      fs.writeFileSync(path.join(OUT, pngName), shot.buffer);
      results.push({ ...job, status: (check.overflow?.length || check.fatal) ? 'WARN' : 'PASS', check, png: pngName });
    });
  } catch (e) { results.push({ ...job, status: 'FAIL', reason: e.message }); }
}
await closeBrowser(inst);
fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(results.map(({ previewFile, ...r }) => r), null, 2));
const rows = results.map(r => {
  const srcPng = `../controlled/controlled-composition-1111-1148/out/${r.nn}.png`;
  return `<tr><td>${r.nn}</td><td>${r.name}<br><small>${r.label || ''}</small><br><b style="color:${r.status === 'PASS' ? '#0a0' : r.status === 'WARN' ? '#c80' : '#c00'}">${r.status}</b> ${(r.check?.overflow || []).map(o => `${o.tag}.${o.cls} dy${o.dy}`).join('<br>')} ${r.reason || ''}</td><td><img src="${r.png}" width="360"></td><td><img src="${srcPng}" width="360"></td></tr>`;
}).join('\n');
fs.writeFileSync(path.join(OUT, 'index.html'), `<!doctype html><meta charset="utf-8"><title>阶段2骨架自检 v2 · 骨架渲染 vs 源页</title>
<style>body{font:14px/1.5 system-ui;background:#111;color:#eee}table{border-collapse:collapse}td{border:1px solid #444;padding:6px;vertical-align:top}</style>
<p>左=现行骨架自检（render-selfcheck 现渲，repeat 按源页条数、短假文字、图=画廊资产）；右=11-11 历史归档（controlled-composition-1111-1148，<b>永不改</b>）。逐行目检结构/几何一致性。</p>
<table>${rows}</table>`);
console.log(results.map(r => `${r.status} ${r.nn} ${r.name}${r.reason ? ' :: ' + r.reason : ''}${r.check?.overflow?.length ? ' :: overflow ' + JSON.stringify(r.check.overflow) : ''}${r.check?.h1Lines ? ' :: h1Lines=' + r.check.h1Lines : ''}`).join('\n'));
console.log(`done: ${results.length} files, PASS=${results.filter(r => r.status === 'PASS').length} WARN=${results.filter(r => r.status === 'WARN').length} FAIL=${results.filter(r => r.status === 'FAIL').length}`);
