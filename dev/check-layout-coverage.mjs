#!/usr/bin/env node
// 骨架覆盖率回归：不启动浏览器，直接用既有 qa-report 的实测几何回放 L20/R14 的判定，
// 验证画廊页都能落进至少一个骨架档、问题页落在档外。判定口径与检查器保持一致：
// share ±0.01、载体宽度 ±0.5cqw、行数按种子 h1 行高（8cqw × 1.18）折算。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ROOT, readJSON } from '../tools/project.mjs';

const CQ = 10.8, H1_LINE = 8 * CQ * 1.18;

export function pageFacts(reportPage) {
  const regions = reportPage.regions || [];
  const layers = reportPage.layers || [];
  const bodyW = regions.find(r => r.id === 'head')?.rect.w || null;
  const h1 = layers.find(l => l.component === 'h1');
  return { regions, layers, bodyW,
    regionIds: regions.map(r => r.id),
    headlineLines: h1 ? Math.round(h1.rect.h / H1_LINE) : null,
    carriersOf: (comp, region) => layers.filter(l => l.component === comp && l.region === region && l.visible),
    countOf: comp => layers.filter(l => l.component === comp).length };
}

export function evalLayout(layout, f) {
  const failures = [];
  const wanted = layout.order.map(e => e.replace(/\?$/, ''));
  const optional = new Set(layout.order.filter(e => e.endsWith('?')).map(e => e.slice(0, -1)));
  for (const rid of wanted)
    if (!f.regionIds.includes(rid) && !optional.has(rid)) failures.push(`缺区域 ${rid}`);
  const seq = f.regionIds.filter(rid => wanted.includes(rid));
  let cursor = -1;
  for (const rid of seq) {
    const at = wanted.indexOf(rid);
    if (at < cursor) { failures.push(`区域顺序 ${seq.join('→')} ≠ ${wanted.join('→')}`); break; }
    cursor = at;
  }
  for (const track of layout.tracks || []) {
    const region = f.regions.find(r => r.id === track.region);
    if (!region) { failures.push(`tracks 缺区域 ${track.region}`); continue; }
    if (!f.bodyW) continue;
    const share = region.rect.w / f.bodyW;
    if (share < track.share[0] - 0.01 || share > track.share[1] + 0.01)
      failures.push(`${track.region} 占比 ${(share * 100).toFixed(1)}% ∉ ${(track.share[0] * 100).toFixed(0)}–${(track.share[1] * 100).toFixed(0)}%`);
  }
  if (layout.headline) {
    if (f.headlineLines == null) failures.push('无可见 h1');
    else if (f.headlineLines < layout.headline[0] || f.headlineLines > layout.headline[1])
      failures.push(`标题 ${f.headlineLines} 行 ∉ ${layout.headline[0]}–${layout.headline[1]}`);
  }
  for (const carrier of layout.carriers || []) {
    const owners = f.carriersOf(carrier.component, carrier.region);
    if (!owners.length) { failures.push(`${carrier.region} 无可见 ${carrier.component}`); continue; }
    for (const el of owners) {
      const w = el.rect.w / CQ;
      if (w < carrier.width[0] - 0.5 || w > carrier.width[1] + 0.5)
        failures.push(`${el.id} 宽 ${w.toFixed(1)} ∉ ${carrier.width[0]}–${carrier.width[1]}cqw`);
    }
  }
  for (const [comp, [min, max]] of Object.entries(layout.counts || {})) {
    const count = f.countOf(comp);
    if (count < min || count > max) failures.push(`${comp} ${count} 个 ∉ ${min}–${max}`);
  }
  if (layout.anchor) {
    const hit = layout.anchor.carrier.some(comp => f.carriersOf(comp, layout.anchor.region).length);
    if (!hit) failures.push(`锚点 ${layout.anchor.region} 无 ${layout.anchor.carrier.join('/')} 载体`);
  }
  return { ok: !failures.length, failures };
}

export function coverage(workDir, recipes) {
  const plan = readJSON(path.join(workDir, '03-plan.json'));
  const report = readJSON(path.join(workDir, 'qa-report.json'));
  const pages = [];
  for (const pg of plan.pages) {
    const recipe = recipes.recipes[pg.recipe];
    const measured = report.pages.find(p => p.nn === pg.nn);
    const entry = { nn: pg.nn, recipe: pg.recipe, hasLayouts: !!recipe.layouts };
    if (!recipe.layouts) { pages.push(entry); continue; }
    if (!measured?.regions) { entry.error = '报告缺少实测几何'; pages.push(entry); continue; }
    const f = pageFacts(measured);
    entry.headlineLines = f.headlineLines;
    entry.layouts = Object.fromEntries(Object.entries(recipe.layouts).map(([lid, layout]) => [lid, evalLayout(layout, f)]));
    entry.matched = Object.entries(entry.layouts).filter(([, r]) => r.ok).map(([lid]) => lid);
    pages.push(entry);
  }
  const scoped = pages.filter(p => p.hasLayouts);
  return { work: workDir, pages,
    totals: { pages: pages.length, withLayouts: scoped.length,
      matched: scoped.filter(p => p.matched?.length).length,
      unmatched: scoped.filter(p => !p.matched?.length).map(p => p.nn) } };
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const dirs = process.argv.slice(2).filter(a => !a.startsWith('--'));
  if (!dirs.length) { console.error('用法: node dev/check-layout-coverage.mjs <workDir> [<workDir>...]'); process.exit(1); }
  const recipes = readJSON(path.join(ROOT, 'config/recipes.json'));
  const results = dirs.map(dir => coverage(path.resolve(dir), recipes));
  for (const result of results) {
    console.log(`\n=== ${result.work} ===`);
    for (const p of result.pages) {
      if (!p.hasLayouts) { console.log(`p${p.nn} ${p.recipe} （无骨架档）`); continue; }
      if (p.error) { console.log(`p${p.nn} ${p.recipe} ${p.error}`); continue; }
      if (p.matched.length) console.log(`p${p.nn} ${p.recipe} H${p.headlineLines} → 命中 ${p.matched.join('/')}`);
      else {
        console.log(`p${p.nn} ${p.recipe} H${p.headlineLines} → 无命中`);
        for (const [lid, r] of Object.entries(p.layouts)) console.log(`   ${lid}: ${r.failures.join('；')}`);
      }
    }
    const t = result.totals;
    console.log(`小计: ${t.matched}/${t.withLayouts} 个有骨架档的页命中至少一档（共 ${t.pages} 页）${t.unmatched.length ? `；未命中: ${t.unmatched.join(',')}` : ''}`);
  }
  const outFile = path.join(ROOT, 'dev/layout-coverage.json');
  fs.writeFileSync(outFile, JSON.stringify({ generatedAt: new Date().toISOString(), results }, null, 2) + '\n');
  console.log(`\n落档: ${outFile}`);
}