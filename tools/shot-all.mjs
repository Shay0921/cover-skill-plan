#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { withBlank, evaluate, captureReadyPage } from './cdp.mjs';
import { isMain, cli, parseArgs, printReport } from './project.mjs';

// Build the contact sheet exclusively from this run's PNG buffers, never by
// scanning output files. The buffers go to a throwaway directory so the page
// streams them from disk instead of carrying a multi-megabyte base64 document
// through the already-loaded browser process.
export async function captureSheet(inst, captures, options, columns = 4) {
  if (!captures.length) throw new Error('没有本次截图，不能生成总览');
  if (!Number.isInteger(columns) || columns < 1 || columns > 12) throw new Error('列数必须是 1–12 的整数');
  const cols = Math.min(columns, captures.length), cell = 260, gap = 12;
  const width = cols * (cell + gap) + gap;
  const height = Math.ceil(captures.length / cols) * (Math.ceil(cell * 4 / 3) + 24 + gap) + gap;
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
    *{box-sizing:border-box}html,body{margin:0;width:${width}px;min-height:${height}px;background:#181715}
    body{display:grid;grid-template-columns:repeat(${cols},${cell}px);gap:${gap}px;padding:${gap}px;align-content:start;font:12px/24px sans-serif;color:#ccc}
    figure{margin:0}img{display:block;width:${cell}px;height:${cell * 4 / 3}px}figcaption{height:24px}
    </style></head><body>${captures.map(p => `<figure><img src="${p.nn}.png" alt=""><figcaption>${p.nn}</figcaption></figure>`).join('')}</body></html>`;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cover-sheet-'));
  try {
    for (const { nn, buffer } of captures) fs.writeFileSync(path.join(dir, `${nn}.png`), buffer);
    const sheetFile = path.join(dir, 'sheet.html');
    fs.writeFileSync(sheetFile, html);
    // Navigation is awaited here rather than through withPage: withPage calls
    // Page.stopLoading, which would cancel thumbnails still decoding.
    return await withBlank(inst, { ...options, width, height, selector: null, waitSelector: null }, async ctx => {
      const navigation = await ctx.cdp.send('Page.navigate', { url: pathToFileURL(sheetFile).href }, ctx.sessionId, options.timeout);
      if (navigation.errorText) throw new Error(`总览页面加载失败: ${navigation.errorText}`);
      await evaluate(ctx.cdp, ctx.sessionId, `(() => {
        const start = Date.now();
        return new Promise(resolve => {
          const wait = () => document.readyState === 'complete' || Date.now() - start > 10000
            ? resolve(Promise.all([...document.images].map(i => i.decode().catch(() => null)))) : setTimeout(wait, 50);
          wait();
        });
      })()`, { awaitPromise: true, timeoutMs: Math.max(options.timeout || 30000, 120000) });
      return captureReadyPage(ctx, { ...options, selector: null });
    }, { offline: false }); // This generated document contains only this run's data: PNGs.
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}
export async function shotBatch(outDir, options = {}) {
  const { runBatch } = await import('./pipeline.mjs');
  return runBatch({ ...options, outDir, mode: 'shot' });
}
if (isMain(import.meta.url)) await cli(async () => {
  const { positional, options } = parseArgs(process.argv.slice(2));
  if (positional.length < 1 || positional.length > 2) throw new Error('用法: node shot-all.mjs <out> [列数] [--src src] [--plan file] [--pool file]');
  const report = await shotBatch(positional[0], { ...options, cols: Number(options.cols || positional[1] || 4) });
  printReport(report, options.json); if (report.status !== 'passed') process.exitCode = 1;
});
