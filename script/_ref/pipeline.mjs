// Batch transaction coordinator shared by gate, validate and shot-all.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { createOptions, launchBrowser, closeBrowser, withPage, captureReadyPage, fontState, evaluate } from './cdp.mjs';
import { loadProject, assertOutputPages, newReport, saveReport, sha256, readJSON, reportPath } from './project.mjs';
import { prepareBuild, writeBuild, assertCurrentHTML } from './build.mjs';
import { lintProject } from './lint-dom.mjs';
import { validateReadyPage, PROBE } from './validate.mjs';
import { captureSheet } from './shot-all.mjs';

// 并发锁：同一 work 目录同时只允许一轮运行——两轮并发会互踩 qa-report.json / qa-report.prev.json
// 的轮转契约。持有进程已死（残锁）时接管；活着的锁直接拒绝，不排队，排队会掩盖调用方的并发 bug。
// 实现约定：锁是常驻状态文件（释放写 pid:0，不 unlink）。好处有二——① 避免每轮 churn 删文件；
// ② 连续批量轮次（如负例套件 179 例）不触发环境批量删除防护。原子性由首轮 wx 独占创建保证，
// 只有「接管残留锁」这一罕见路径用覆盖写，竞态窗口与「上个进程已死」绑定，代价可接受。
function acquireLock(work) {
  fs.mkdirSync(work, { recursive: true });
  const file = path.join(work, '.qa-lock');
  for (let attempt = 0; ; attempt++) {
    try {
      fs.writeFileSync(file, JSON.stringify({ pid: process.pid, at: new Date().toISOString() }), { flag: 'wx' });
      return file;
    } catch (error) {
      if (error.code !== 'EEXIST' || attempt >= 5) throw new Error(`无法获取运行锁 ${file}: ${error.message}`);
      let holder = null;
      try { holder = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { /* 空壳或损坏的锁按残锁处理 */ }
      const pid = holder?.pid;
      let alive = false;
      if (Number.isInteger(pid) && pid > 0 && pid !== process.pid) {
        try { process.kill(pid, 0); alive = true; } catch (e) { alive = e.code === 'EPERM'; }
      }
      if (alive) throw new Error(`work 目录正被另一轮运行占用（pid ${pid}，${holder?.at || '未知时间'}）：并发写会互踩报告轮转，请等它结束；确认无并发后可删除 ${file}`);
      // 残锁（pid=0、无 pid、或上个进程已死）→ 覆盖写接管，不 unlink。
      try { fs.writeFileSync(file, JSON.stringify({ pid: process.pid, at: new Date().toISOString() })); return file; } catch { /* 竞态下对方先接管，下一轮重试 */ }
    }
  }
}

export async function runBatch(options) {
  const mode = options.mode || 'gate';
  const outDir = path.resolve(options.outDir);
  const srcDir = path.resolve(options.srcDir || options.src || path.join(path.dirname(outDir), 'work', 'src'));
  const lockFile = acquireLock(path.dirname(srcDir));
  let project, report, inst = options.inst;
  const ownsBrowser = !inst;
  try {
    project = loadProject(srcDir, outDir, options);
    report = newReport(project, mode);
    // 增量 carry-over 必须在轮转前读上一轮报告；只认页级 passed 且 inputKey 全同的页。
    const incremental = !!options.incremental;
    if (incremental && mode === 'shot') throw new Error('--incremental 不能用于 shot 模式：交付重拍必须全量');
    let prevReport = null;
    if (incremental) { try { prevReport = readJSON(reportPath(project)); } catch { prevReport = null; } }
    saveReport(project, report); // Old success artifacts cannot represent a running/failed run.
    assertOutputPages(project, mode !== 'gate');
    const opts = createOptions(options.browserOptions || {});
    if (!inst) inst = await launchBrowser(opts);
    // gate 一次报全：lint 失败的页不构建但错误入报告，其余页继续到几何层，
    // 一轮同时收齐结构错误与几何错误；validate/shot 仍是全有或全无。
    const lint = await lintProject(inst, project, opts);
    const prepared = await prepareBuild(inst, project, opts, lint, { partial: mode === 'gate' });
    report.pages = project.pages.map(pg => {
      const built = prepared.find(p => p.nn === pg.nn);
      if (built) { const { html, ...rest } = built; return { ...rest, status: 'lint-passed' }; }
      return { nn: pg.nn, sourceHash: pg.sourceHash, issues: lint.find(p => p.nn === pg.nn)?.issues || [], status: 'failed' };
    });
    if (mode === 'gate') writeBuild(project, prepared);
    assertCurrentHTML(project, prepared);
    const shouldShot = mode === 'shot' || (mode === 'gate' && !options.noShot && !options['no-shot']);
    // inputKey：源片段 + 构建产物（seed/素材）+ 本页契约 + 全局配置，任一变化即重测。
    // lint 仍每页重跑（便宜）；carry-over 只省导航测量与截图。
    const configHash = sha256(JSON.stringify({ components: project.components, recipes: project.recipes }));
    const inputKeyOf = (pg, htmlHash) => sha256(JSON.stringify({ sourceHash: pg.sourceHash, htmlHash,
      recipe: pg.recipe, layout: pg.layout || null, uses: pg.uses, dark: pg.dark === true, meta: project.plan.meta, configHash }));
    let carriedCount = 0;
    if (incremental && prevReport?.pages) for (const pg of project.pages) {
      const index = report.pages.findIndex(p => p.nn === pg.nn);
      const input = prepared.find(p => p.nn === pg.nn);
      if (!input || report.pages[index].status !== 'lint-passed') continue;
      const key = inputKeyOf(pg, input.htmlHash);
      const prev = prevReport.pages.find(p => p.nn === pg.nn);
      if (!prev || prev.status !== 'passed' || prev.inputKey !== key || !prev.layers) continue;
      if (shouldShot) {
        // 带截图的增量轮：盘上 PNG 必须仍与上一轮哈希一致，否则该页重测重拍。
        let pngOk = false;
        try { pngOk = !!prev.pngHash && fs.existsSync(pg.pngFile) && sha256(fs.readFileSync(pg.pngFile)) === prev.pngHash; } catch { pngOk = false; }
        if (!pngOk) continue;
      }
      const result = report.pages[index];
      for (const field of ['canvas', 'footer', 'frames', 'regions', 'layers', 'bands', 'counts', 'fonts', 'pngHash', 'pngBytes'])
        if (prev[field] !== undefined) result[field] = prev[field];
      // 上一轮几何层 WARN（R7/R9/FONT）随几何一起沿用；本轮 lint WARN 已在 issues 里。
      result.issues = [...(result.issues || []), ...(prev.issues || []).filter(i => i.level === 'WARN' && /^(?:R\d+|FONT)$/.test(i.rule))];
      result.status = 'passed'; result.carried = true; result.inputKey = key;
      carriedCount++;
    }
    const captures = [];
    for (const pg of project.pages) {
      const index = report.pages.findIndex(p => p.nn === pg.nn);
      const input = prepared.find(p => p.nn === pg.nn);
      if (!input) { saveReport(project, report); continue; } // lint 失败页：错误已在报告，不导航
      if (report.pages[index].carried) { saveReport(project, report); continue; } // 增量沿用页：不导航不重拍
      // Recheck immediately before navigating. An edited output is never loaded.
      if (sha256(fs.readFileSync(pg.htmlFile)) !== input.htmlHash) throw new Error(`导航前 HTML 已变化: ${pg.htmlFile}`);
      await withPage(inst, pathToFileURL(pg.htmlFile).href, opts, async ctx => {
        const measured = await validateReadyPage(ctx, { recipe: project.recipes.recipes[pg.recipe], components: project.components.components, layout: pg.layoutSpec || null });
        // 合并而非覆盖：lint 阶段的 WARN 必须留在同一份交付报告里，几何 issues 不能把它顶掉。
        const result = { ...report.pages[index], ...measured,
          issues: [...(report.pages[index].issues || []), ...(measured.issues || [])], status: 'measured',
          inputKey: inputKeyOf(pg, input.htmlHash) };
        report.pages[index] = result;
        // 一次报全：几何失败不短路后续页，一轮收齐全部错误；只给通过的页截图。
        if (result.issues.some(i => i.level === 'ERROR')) { result.status = 'failed'; return; }
        if (shouldShot) {
          const shot = await captureReadyPage(ctx, opts);
          if (shot.width !== 1080 || shot.height !== 1440) throw new Error(`${pg.nn} PNG 尺寸 ${shot.width}×${shot.height} 不正确`);
          const after = await evaluate(ctx.cdp, ctx.sessionId, PROBE);
          const afterFonts = await fontState(ctx);
          if (JSON.stringify(after.layers) !== JSON.stringify(measured.layers) || JSON.stringify(afterFonts.actual) !== JSON.stringify(measured.fonts.actual))
            throw new Error(`${pg.nn} 截图期间字体或几何变化，拒绝发布；请重跑`);
          captures.push({ nn: pg.nn, ...shot });
          result.pngHash = sha256(shot.buffer); result.pngBytes = shot.bytes;
        }
        result.status = 'passed';
      });
      saveReport(project, report);
    }
    // 几何数字摘要：失败/不截图时也留下实测数字，返修轮不用开 PNG 猜尺寸。
    // share 以 head 区域宽为正文宽基准（两者 margin-inline 同源）；cqw 按 1080 画布折算。
    const CQ = 10.8;
    const digest = { version: 1, runId: report.runId, units: { rect: 'cqw', share: '占正文宽度比例' },
      pages: report.pages.filter(p => p.regions).map(p => {
        const bodyW = p.regions.find(r => r.id === 'head')?.rect.w || null;
        return { nn: p.nn, status: p.status,
          regions: p.regions.map(r => ({ id: r.id, wCqw: +(r.rect.w / CQ).toFixed(1), hCqw: +(r.rect.h / CQ).toFixed(1), share: bodyW ? +(r.rect.w / bodyW).toFixed(3) : null })),
          carriers: (p.layers || []).filter(l => ['phone', 'shot'].includes(l.component) && l.visible)
            .map(l => ({ layer: l.id, component: l.component, region: l.region, wCqw: +(l.rect.w / CQ).toFixed(1), hCqw: +(l.rect.h / CQ).toFixed(1) })),
          bands: p.bands,
          errors: (p.issues || []).filter(i => i.level === 'ERROR').map(i => `${i.rule}: ${i.msg}`) };
      }) };
    const digestPath = path.join(project.work, 'geometry-digest.json');
    fs.writeFileSync(digestPath, JSON.stringify(digest, null, 2) + '\n');
    report.artifacts.digest = { path: digestPath };
    if (!shouldShot && !options.json) {
      console.log('—— 几何数字摘要（cqw / 列宽占比）——');
      for (const d of digest.pages) {
        console.log(`p${d.nn} [${d.status}] 区域: ${d.regions.map(r => `${r.id}=${r.wCqw}×${r.hCqw}${r.share != null ? `(${(r.share * 100).toFixed(0)}%)` : ''}`).join(' ')}`);
        if (d.carriers.length) console.log(`   载体: ${d.carriers.map(c => `${c.layer}=${c.wCqw}×${c.hCqw}@${c.region}`).join(' ')}`);
        console.log(`   空白带px: ${d.bands.map(b => Math.round(b.emptyPx)).join('/')}`);
      }
    }
    const failedPages = report.pages.filter(p => p.status === 'failed').map(p => p.nn);
    if (failedPages.length) throw new Error(`几何检查失败页: ${failedPages.join(', ')}；全部页错误见 qa-summary.json，实测数字见 geometry-digest.json`);
    if (report.pages.length !== project.pages.length || report.pages.some(p => p.status !== 'passed')) throw new Error('当前计划页未全部通过');
    // 应重拍数 = 本轮新通过的页（沿用页不重拍，失败页不拍）。
    if (shouldShot && captures.length !== report.pages.filter(p => p.status === 'passed' && !p.carried).length) throw new Error('当前计划页未全部重新截图');
    let sheet;
    // 增量轮的联系表只含重拍页，会误导目检：不生成；完整联系表属于交付全量轮。
    if (shouldShot && !incremental) sheet = await captureSheet(inst, captures, opts, Number(options.cols || 4));
    // Compare actual fonts, without pretending that sharing a browser enforces
    // one fallback family. Different script coverage can legitimately vary.
    report.fontPolicy = 'Per-target bounded wait + stopLoading; actual platform faces recorded. No batch fallback guarantee.';
    report.issues.push({ level: 'WARN', rule: 'FONT', msg: '同进程不保证整批字体一致；各页 fonts.actual / faces 已记录，请核对实际 face' });
    if (carriedCount) report.issues.push({ level: 'WARN', rule: 'BATCH', msg: `增量轮：${carriedCount} 页沿用上一轮实测（inputKey 守卫）；交付前必须跑一次不带 --incremental 的全量 gate` });
    const manifest = {
      version: 2, runId: report.runId, inputHash: report.inputHash, style: project.style,
      generatedBy: `tools/${mode === 'gate' ? 'gate' : mode === 'shot' ? 'shot-all' : 'validate'}.mjs`,
      coordinateReference: 'canvas-top-left', units: 'px',
      note: '实际渲染坐标快照；parentLayer 表示 DOM 祖先关系。非编辑器接入承诺，不回放 locked=geom。',
      pages: report.pages.map(p => ({ nn: p.nn, file: `${p.nn}.html`, htmlHash: p.htmlHash, sourceHash: p.sourceHash,
        ...(shouldShot ? { pngHash: p.pngHash } : {}), ...(p.carried ? { carried: true } : {}), canvas: p.canvas, layers: p.layers, fonts: p.fonts }))
    };
    // Only successful buffers are published. No numeric files or old user
    // artifacts are deleted. Existing success artifacts remain historical if a
    // later run fails; qa-report runId/status is the authoritative run outcome.
    assertOutputPages(project);
    for (const capture of captures) fs.writeFileSync(path.join(project.out, `${capture.nn}.png`), capture.buffer);
    const manifestPath = path.join(project.work, 'editor.manifest.json');
    if (sheet) {
      const sheetPath = path.join(project.work, '_sheet.png');
      fs.writeFileSync(sheetPath, sheet.buffer);
      report.artifacts.sheet = { path: sheetPath, sha256: sha256(sheet.buffer) };
    }
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
    report.artifacts.manifest = { path: manifestPath, runId: report.runId };
    report.artifacts.html = project.pages.map(p => p.htmlFile);
    report.artifacts.png = shouldShot ? project.pages.map(p => p.pngFile) : [];
    // --delivery：将 out 目录中仅用户需要的三类产物（HTML、PNG、assets/）拷贝到指定交付目录。
    // work/ 里的 qa-report、geometry-digest、plan、pool 等中间产物一律留在运行目录，不进入交付物。
    if (options.delivery) {
      const targetDir = path.resolve(options.delivery);
      fs.mkdirSync(targetDir, { recursive: true });
      for (const f of fs.readdirSync(project.out)) {
        const srcFile = path.join(project.out, f);
        const destFile = path.join(targetDir, f);
        const stat = fs.statSync(srcFile);
        if (stat.isDirectory() && f === 'assets') fs.cpSync(srcFile, destFile, { recursive: true });
        else if (/^\d+\.(?:html|png)$/i.test(f)) fs.copyFileSync(srcFile, destFile);
      }
      report.artifacts.delivery = { path: targetDir };
    }
    report.status = 'passed';
  } catch (error) {
    if (!report) {
      // Input errors throw before newReport; the fallback report still needs a
      // runId so qa-report/qa-summary stay consistent with the rotation contract.
      report = { version: 2, runId: crypto.randomUUID(), mode, status: 'failed', startedAt: new Date().toISOString(), expectedPages: [], pages: [], issues: [], artifacts: {} };
    }
    report.status = 'failed'; report.artifacts = {};
    report.issues.push({ level: 'ERROR', rule: 'BATCH', msg: error.message });
    if (error.lint) report.pages = error.lint.map(({ body, images, ...p }) => ({ ...p, status: 'failed' }));
  } finally {
    if (ownsBrowser) await closeBrowser(inst);
    // 输入错误时没有 project，但 work 目录仍由 src 的父级推出：兜底报告一样走 saveReport，
    // 轮转 qa-report.prev.json 与 qa-summary.json 才是承诺的契约，而不是只有成功路径才有。
    if (project) saveReport(project, report);
    else {
      const work = path.dirname(srcDir);
      if (fs.existsSync(work)) saveReport({ work }, report);
    }
    // 锁最后释放：报告写完后才允许下一轮进入，否则存在两轮同写报告的窗口。
    // 释放写 pid:0 标记而非删文件，规避连续轮次的批量删除防护。
    try { fs.writeFileSync(lockFile, JSON.stringify({ pid: 0, at: new Date().toISOString() })); } catch { /* work 目录可能已被清理 */ }
  }
  return report;
}
