#!/usr/bin/env node
/* check-typography.mjs · 字号档位校验器——母版创建规范 §5.3.3 下限红线 + §10「字号档位核对」验收项的机器化
 * 用法：node script/check-typography.mjs [--style=tech-blue] [--file=<style.css 路径>]
 * 规则（与 final/03 §5.3 对应，判定顺序）：
 *   L1 豁免：px 单位（图形页/SVG 走 px 档，§5.3.5）直接放行
 *   L2 档位：cqw 值精确命中 design-system「字号层级」的任一档位（动态解析，不硬编码）
 *   L3 条目区间：label 档 ≤ 值 ≤ body 档（条目密集型说明，§5.3.2）
 *   L4 映射带：§5.3.3 分档表 ≤1.2 / 1.3–2.2 / 2.3–3.8 / 3.9–7.9 / ≥8（标题与私有组件）
 *   其余 = 违规散值，报错退出 1
 * 定向红线：NARRATIVE 清单（叙述型主体说明槽）必须恰为 body 档——防「上收后又被悄悄调小」的回归
 * 已知边界：角色判定只覆盖 NARRATIVE 清单；新母版的说明槽若不在清单内，走 L1–L4 通用带检查
 * （清单维护：新叙述型槽入库时同步追加，与本批 2026-11-21 的 8 个通过槽同源）
 */
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const ROOT = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const arg = (name, dflt) => {
  const i = argv.findIndex((a) => a === name || a.startsWith(name + '='));
  if (i < 0) return dflt;
  return argv[i].startsWith(name + '=') ? argv[i].slice(name.length + 1) : argv[i + 1];
};
const STYLE = arg('--style', 'tech-blue');
const CSS_FILE = arg('--file', path.join(ROOT, 'styles', STYLE, 'style.css'));
const DS_FILE = path.join(ROOT, 'styles', STYLE, 'design-system.md');

// ---- 档位动态解析（真源 = design-system「字号层级」行，与 style.css 双同源）----
const ds = fs.readFileSync(DS_FILE, 'utf8');
const line = ds.split('\n').map((s) => s.trim()).find((l) => l.startsWith('字号层级：'));
if (!line) { console.error('✗ design-system 缺「字号层级：」行：' + DS_FILE); process.exit(2); }
const RUNGS = {};
for (const m of line.matchAll(/([A-Za-z-]+)\s+([\d.]+)cqw/g)) RUNGS[m[1]] = +m[2];
if (!RUNGS.label || !RUNGS.body || Object.keys(RUNGS).length < 6) {
  console.error('✗ 字号层级行解析异常（需含 label/body 等至少 6 档）：' + line); process.exit(2);
}
const ITEM_RANGE = [RUNGS.label, RUNGS.body];           // 条目密集型说明区间（§5.3.2）
const BANDS = [[0, 1.2], [1.3, 2.2], [2.3, 3.8], [3.9, 7.9], [8, Infinity]];  // §5.3.3 映射带
const BAND_TOL = 0.02;  // 带边界容差：分档表是描述性区间（库内 3.81 在 3.8/3.9 缝上 0.01，属既有定版）；0.02 内放行、真漂移（如 3.85/1.25）仍拦

// ---- 叙述型主体说明清单（定向红线：必须恰为 body 档）----
const NARRATIVE = [
  '.n06-para', '.n07-points__text', '.n07-tips__body', '.n19-point .n19-pd',
  '.n22-pins__note', '.n23-msg', '.n28-takeaways__item', '.n37-row-d',
];

// ---- 解析 style.css 全部 font-size 声明 ----
const css = fs.readFileSync(CSS_FILE, 'utf8');
const rules = [];
for (const m of css.matchAll(/([^{}\n][^{}]*)\{([^{}]*)\}/g)) {
  const sel = m[1].replace(/\/\*[\s\S]*?\*\//g, '').trim().replace(/\s+/g, ' ').split('\n').pop().trim();
  const fm = m[2].match(/font-size\s*:\s*([^;}]+)/);
  if (fm) rules.push({ sel, v: fm[1].trim() });
}

// ---- 逐条判定 ----
const near = (a, b) => Math.abs(a - b) < 0.005;
const inBand = (v) => BANDS.some(([lo, hi]) => v >= lo - BAND_TOL && v <= hi + BAND_TOL);
const violations = [];
let pxCount = 0, checked = 0;
for (const { sel, v } of rules) {
  if (/^[\d.]+px$/i.test(v)) { pxCount++; continue; }        // L1 豁免：图形页 px 档
  const cqw = parseFloat(v);
  if (!/^[\d.]+cqw$/.test(v) || Number.isNaN(cqw)) {
    if (cqw === 0) continue;                                  // font-size:0 = 居中特例的隐藏机制（N26/N27 big-num），非排版字号
    violations.push({ sel, v, why: '单位异常（仅认 cqw/px/0=隐藏）' }); continue;
  }
  checked++;
  const narrate = NARRATIVE.includes(sel);
  if (narrate && !near(cqw, RUNGS.body)) violations.push({ sel, v, why: `叙述型主体说明必须恰为 body 档 ${RUNGS.body}cqw（红线 §5.3.3）` });
  if (Object.values(RUNGS).some((r) => near(cqw, r))) continue;   // L2 档位
  if (cqw >= ITEM_RANGE[0] && cqw <= ITEM_RANGE[1]) continue;     // L3 条目区间
  if (inBand(cqw)) continue;                                       // L4 映射带
  if (!violations.some((x) => x.sel === sel && x.v === v)) violations.push({ sel, v, why: '散值——不在档位/条目区间/映射带（§5.3.3）' });
}

// ---- 报告 ----
console.log(`字号档位校验 · ${STYLE}（档位 ${Object.entries(RUNGS).map(([k, v]) => k + '=' + v).join(' ')}）`);
console.log(`声明 ${rules.length} 条：px 豁免 ${pxCount}、cqw 核对 ${checked}、违规 ${violations.length}`);
for (const x of violations) console.log('✗ ' + x.sel.slice(0, 60) + '  ' + x.v + '  — ' + x.why);
if (violations.length) { console.log('\n✗ 存在违规散值，改值或登记豁免后再出图'); process.exit(1); }
console.log('✓ 全部落在档位 / 条目区间 / 映射带 / 豁免内');
