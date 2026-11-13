#!/usr/bin/env node
// The part.html is the source of truth. Build only adds trusted seed CSS and
// embeds raster files; it never expands components or rewrites source files.
import fs from 'node:fs';
import path from 'node:path';
import { createOptions, launchBrowser, closeBrowser, withBlank, evaluate } from './cdp.mjs';
import { lintProject } from './lint-dom.mjs';
import { ROOT, sha256, loadProject, assertOutputPages, isMain, cli, parseArgs, newReport, saveReport, saveFailureReport, printReport } from './project.mjs';

// T8 种子只读锁（2026-11-13）：种子是只读基线，任何改动都会改变派生产物的样式与几何前提。
// 基线 = references/04-recipes.md 文首登记值（P→R 迁移后刷新版）。有意演进种子时三处同步：
// 改种子 → 刷新 04-recipes.md 登记校验和 → 更新本常量，缺一 gate 即 FAIL。
export const SEED_SHA256 = '5318D18B7DA6C0ED3DB8395858751E5D524137A14CB97F037B0EDC870003D958';

/** 校验种子内容是否与登记基线一致；不一致即抛错（gate 拒绝构建）。 */
export function verifySeedChecksum(html) {
  const actual = sha256(html).toUpperCase();
  if (actual !== SEED_SHA256)
    throw new Error(`种子被改动：SHA-256 ${actual.slice(0, 8)}… ≠ 登记基线 ${SEED_SHA256.slice(0, 8)}…，gate 拒绝构建（T8 种子只读锁）。如为有意演进：改种子 → 刷新 04-recipes.md 登记 → 同步 build.mjs 常量，三处一致。`);
  return actual;
}

export function readSeedCSS() {
  const seed = fs.readFileSync(path.join(ROOT, 'seed/paper-journal.html'), 'utf8');
  verifySeedChecksum(seed);
  const match = seed.match(/<style(?:\s[^>]*)?>([\s\S]*?)<\/style\s*>/i);
  if (!match) throw new Error('seed 中缺少 CSS');
  return match[1];
}
// Fixed-version CDN mirror of the vendored fontsource packages, used only by
// delivered HTML. Each seed/fonts/*.css must start with a header comment
// `/* fontsource: <package>@<version> */` identifying its source release; the
// CDN URL is derived from it, so swapping a font never touches this file.
function fontCdn(header, rel) {
  const match = header.match(/^\/\* fontsource: ([\w.-]+)@(\d+\.\d+\.\d+) \*\/$/);
  if (!match) throw new Error(`种子字体 CSS 缺少「fontsource: 包@版本」头注释: ${rel}`);
  return `https://cdn.jsdelivr.net/npm/@fontsource/${match[1]}@${match[2]}/files`;
}
// Delivered HTML never carries font files. Seed CSS keeps relative paths for
// seed preview; before inlining, local subset URLs are rewritten to
// local(<family>) + fixed-version CDN, so an installed system face wins and
// missing subsets fall back to the CDN.
function inlineSeedFonts(css) {
  return css.replace(/@import url\('\.\/(fonts\/[^']+\.css)'\);/g, (_, rel) => {
    const file = fs.readFileSync(path.join(ROOT, 'seed', rel), 'utf8');
    if (/url\(\s*['"]?https?:/i.test(file)) throw new Error(`种子字体 CSS 不允许远程地址: ${rel}`);
    if (!file.includes('./files/')) throw new Error(`种子字体 CSS 缺少本地分片引用: ${rel}`);
    const family = file.match(/font-family:\s*'([^']+)'/)?.[1];
    if (!family) throw new Error(`种子字体 CSS 缺少 font-family: ${rel}`);
    const header = file.match(/^[^\n]*\n/)?.[0]?.trim() ?? '';
    const cdn = fontCdn(header, rel);
    const pkg = family.toLowerCase().replace(/\s+/g, '-');
    if (!cdn.includes(`/${pkg}@`)) throw new Error(`种子字体 CSS 的 fontsource 包名与 font-family「${family}」不一致: ${rel}`);
    return file.replace(/url\(\.\/files\/([^)]+\.woff2)\)/g, `local('${family}'), url('${cdn}/$1')`);
  });
}
// Optional user config: config/fonts.user.json = {"preferredSystemFont": "字体名"}.
// Prepends the font to --serif-stack (appended last so it wins the cascade).
function applyDeliveryFontPolicy(css) {
  const delivered = inlineSeedFonts(css);
  const file = path.join(ROOT, 'config/fonts.user.json');
  if (!fs.existsSync(file)) return delivered;
  let cfg;
  try { cfg = JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (error) { throw new Error(`fonts.user.json 不是合法 JSON: ${error.message}`); }
  const name = typeof cfg.preferredSystemFont === 'string' ? cfg.preferredSystemFont.trim() : '';
  if (!name) throw new Error('fonts.user.json 的 preferredSystemFont 必须是非空字符串');
  if (/['"\\]/.test(name)) throw new Error(`fonts.user.json 字体名含非法字符: ${name}`);
  const base = css.match(/--serif-stack:([^;]+);/)?.[1];
  if (!base) throw new Error('种子缺少 --serif-stack 定义，无法注入首选系统字体');
  return `${delivered}\n:root{--serif-stack:'${name}',${base.trim()};}`;
}
function rasterMime(buffer) {
  if (buffer.subarray(0, 8).toString('hex') === '89504e470d0a1a0a') return 'image/png';
  if (buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255) return 'image/jpeg';
  if (/^GIF8[79]a/.test(buffer.subarray(0, 6).toString())) return 'image/gif';
  if (buffer.subarray(0, 4).toString() === 'RIFF' && buffer.subarray(8, 12).toString() === 'WEBP') return 'image/webp';
  if (buffer.subarray(0, 2).toString() === 'BM') return 'image/bmp';
  throw new Error('素材不是真实 PNG/JPEG/WebP/GIF/BMP；拒绝 SVG 或伪装文件');
}
// 手机壳是种子自带的固定资源，源片段只写 `assets/iphone-frame.png`；
// 除此之外 dataURL 只能由本函数从 assets/ 的真实文件生成，手写等于绕过素材登记。
function seedFrame() {
  const src = fs.readFileSync(path.join(ROOT, 'seed/iphone-frame.b64'), 'utf8').trim();
  const match = src.match(/^data:(image\/(?:png|jpeg|webp|gif|bmp));base64,([a-z0-9+/]+={0,2})$/i);
  if (!match) throw new Error('seed/iphone-frame.b64 不是安全 raster dataURL');
  const buffer = Buffer.from(match[2], 'base64');
  if (rasterMime(buffer) !== match[1].toLowerCase()) throw new Error('seed/iphone-frame.b64 类型与实际文件签名不一致');
  return src;
}
export function embedAsset(project, src, nn) {
  const at = nn ? `${nn}: ` : '';
  if (src === 'assets/iphone-frame.png') return seedFrame();
  if (src.startsWith('data:')) throw new Error(`${at}源片段不允许手写 dataURL 图片：素材放 assets/ 并保留来源，由 build 内嵌`);
  if (!src.startsWith('assets/') || src.split('/').some(v => v === '..' || v === '.') || /[%\\:?#\x00-\x1f]/.test(src))
    throw new Error(`${at}不安全素材路径: ${src}`);
  const relative = src.slice(7);
  for (const base of [path.join(project.src, 'assets'), path.join(project.work, 'assets'), path.join(project.out, 'assets')]) {
    const file = path.join(base, relative);
    if (!fs.existsSync(file)) continue;
    const realBase = fs.realpathSync(base), realFile = fs.realpathSync(file);
    const rel = path.relative(realBase, realFile);
    if (rel.startsWith('..') || path.isAbsolute(rel)) throw new Error(`${at}素材符号链接越出 assets: ${file}`);
    const buffer = fs.readFileSync(realFile);
    const mime = rasterMime(buffer);
    const expected = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.bmp': 'image/bmp' }[path.extname(file).toLowerCase()];
    if (mime !== expected) throw new Error(`${at}素材扩展名与实际格式不一致: ${src}`);
    return `data:${mime};base64,${buffer.toString('base64')}`;
  }
  throw new Error(`${at}缺少本地素材 ${src}；检查 src/assets、work/assets 或 out/assets`);
}
export function composeHTML(css, body, nn) {
  return `<!doctype html>\n<html lang="zh-CN">\n<head>\n<meta charset="utf-8">\n<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline' https:; font-src data: https:; base-uri 'none'; form-action 'none'">\n<title>${nn}</title>\n<style>${css}</style>\n</head>\n<body>\n${body.trim()}\n</body>\n</html>\n`;
}
// Results must cover the entire current plan. The default always runs lint.
// partial=true（gate 的一次报全）：结构失败的页不构建、错误留在 lint 结果里，
// 其余页照常构建测量，一轮收齐 lint 与几何两层错误；默认仍是全有或全无。
export async function prepareBuild(inst, project, opts = createOptions(), checked = null, { partial = false } = {}) {
  assertOutputPages(project);
  const lint = checked || await lintProject(inst, project, opts);
  if (lint.length !== project.pages.length || (!partial && lint.some(p => p.issues.some(i => i.level === 'ERROR')))) {
    const error = new Error('片段结构/安全检查失败，未构建任何页面'); error.lint = lint; throw error;
  }
  const css = applyDeliveryFontPolicy(readSeedCSS()), prepared = [];
  for (const pg of project.pages) {
    const result = lint.find(p => p.nn === pg.nn);
    if (!result) throw new Error(`缺少 lint 结果: ${pg.nn}`);
    if (result.issues.some(i => i.level === 'ERROR')) continue;
    const assets = Object.fromEntries(result.images.map(src => [src, embedAsset(project, src, pg.nn)]));
    const body = await withBlank(inst, opts, async ({ cdp, sessionId }) => evaluate(cdp, sessionId, `(() => {
      const doc = new DOMParser().parseFromString(${JSON.stringify(result.body)},'text/html');
      const assets = ${JSON.stringify(assets)};
      for (const img of doc.querySelectorAll('img')) img.setAttribute('src',assets[img.getAttribute('src')]);
      return doc.body.innerHTML;
    })()`));
    const html = composeHTML(css, body, pg.nn);
    prepared.push({ nn: pg.nn, html, htmlHash: sha256(html), sourceHash: pg.sourceHash, issues: result.issues });
  }
  return prepared;
}
export function writeBuild(project, prepared) {
  assertOutputPages(project);
  fs.mkdirSync(project.out, { recursive: true });
  for (const compiled of prepared) {
    const pg = project.pages.find(p => p.nn === compiled.nn);
    if (!pg) throw new Error(`构建出现计划外页: ${compiled.nn}`);
    fs.writeFileSync(pg.htmlFile, compiled.html);
  }
}
export function assertCurrentHTML(project, prepared) {
  // 部分构建（gate 一次报全）只校验已构建页；完整构建仍要求全部计划页 HTML 在场。
  assertOutputPages(project, prepared.length === project.pages.length);
  for (const compiled of prepared) {
    const pg = project.pages.find(p => p.nn === compiled.nn);
    if (!pg || fs.readFileSync(pg.htmlFile, 'utf8') !== compiled.html)
      throw new Error(`当前 HTML 与已校验源片段/素材/seed 不一致: ${pg?.htmlFile || compiled.nn}；请重新 build/gate，不得复用旧成功结果`);
  }
}
export async function buildProject(inst, project, opts = createOptions()) {
  const prepared = await prepareBuild(inst, project, opts);
  writeBuild(project, prepared); return prepared;
}
if (isMain(import.meta.url)) await cli(async () => {
  const { positional, options } = parseArgs(process.argv.slice(2));
  if (positional.length !== 2) throw new Error('用法: node build.mjs <src> <out> [--plan file] [--pool file]');
  let project;
  try { project = loadProject(...positional, options); }
  catch (error) { printReport(saveFailureReport(positional[0], 'build', error), options.json); process.exitCode = 1; return; }
  const report = newReport(project, 'build');
  const opts = createOptions(); let inst;
  try {
    inst = await launchBrowser(opts);
    report.pages = (await buildProject(inst, project, opts)).map(({ html, ...page }) => page);
    report.status = 'passed'; report.artifacts.html = project.pages.map(p => p.htmlFile);
  } catch (error) {
    report.status = 'failed'; report.issues.push({ level: 'ERROR', rule: 'BUILD', msg: error.message });
    if (error.lint) report.pages = error.lint.map(({ body, images, ...page }) => page);
  } finally { await closeBrowser(inst); saveReport(project, report); }
  printReport(report, options.json); if (report.status !== 'passed') process.exitCode = 1;
});
