#!/usr/bin/env node
// One browser: offline DOM lint -> build -> geometry -> same-target capture.
import { runBatch } from './pipeline.mjs';
import { isMain, cli, parseArgs, printReport } from './project.mjs';

export async function gate(srcDir, outDir, options = {}) {
  return runBatch({ ...options, srcDir, outDir, mode: options['shot-only'] || options.shotOnly ? 'shot' : 'gate' });
}
if (isMain(import.meta.url)) await cli(async () => {
  const { positional, options } = parseArgs(process.argv.slice(2));
  if (positional.length !== 2 || (options['no-shot'] && options['shot-only']))
    throw new Error('用法: node gate.mjs <src> <out> [--no-shot|--shot-only] [--incremental] [--plan file] [--pool file]');
  const report = await gate(positional[0], positional[1], options);
  printReport(report, options.json);
  if (report.status !== 'passed') process.exitCode = 1;
});
