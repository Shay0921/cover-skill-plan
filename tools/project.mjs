// Shared plan, source and artifact bookkeeping. No rendering or template expansion.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
// 入口判定必须兼容符号链接/挂载路径：Node 会把模块路径解析成 realpath，
// 而 argv[1] 仍是调用方写的链接路径（如 ~/.agents/skills 下的挂载入口），
// 只比 argv[1] 会让 CLI 在链接路径下静默跳过（exit 0、无输出、无产物）。
export const isMain = url => {
  if (!process.argv[1]) return false;
  const resolved = path.resolve(process.argv[1]);
  if (pathToFileURL(resolved).href === url) return true;
  try { return pathToFileURL(fs.realpathSync(resolved)).href === url; }
  catch { return false; }
};
export function readJSON(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '')); }
  catch (error) { throw new Error(`无法读取 JSON ${file}: ${error.message}`); }
}
export function parseArgs(args) {
  const positional = [], options = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (!arg.startsWith('--')) { positional.push(arg); continue; }
    const [key, ...rest] = arg.slice(2).split('=');
    if (['no-shot', 'shot-only', 'json', 'incremental'].includes(key)) options[key] = true;
    else if (['src', 'plan', 'pool', 'cols', 'delivery'].includes(key)) {
      const value = rest.length ? rest.join('=') : args[++i];
      if (!value || value.startsWith('--')) throw new Error(`缺少 --${key} 参数`);
      options[key] = value;
    } else throw new Error(`未知参数: ${arg}`);
  }
  return { positional, options };
}

export function collectPoolAssets(pool) {
  const assets = Object.create(null);
  const entries = [[pool.thesis, 'thesis']];
  for (const field of ['highlights', 'pains', 'hooks', 'data', 'quotes']) {
    if (!Array.isArray(pool[field])) throw new Error(`pool.${field} 必须是数组`);
    entries.push(...pool[field].map(asset => [asset, field]));
  }
  for (const [asset, kind] of entries) {
    if (!asset || ['id', 'text', 'evidence', 'source'].some(k => typeof asset[k] !== 'string' || !asset[k].trim()))
      throw new Error('每个内容资产必须包含非空 id / text / evidence / source');
    if (Object.hasOwn(assets, asset.id)) throw new Error(`pool 资产 id 重复: ${asset.id}`);
    // Filenames and other assets must not legitimize this asset's numbers.
    // text 保持合并形态供既有的数字集合校验使用；分级文本比对只读 textOnly / evidence / kind。
    assets[asset.id] = { id: asset.id, text: `${asset.text}\n${asset.evidence}`,
      textOnly: asset.text, evidence: asset.evidence, kind, paraphrase: asset.paraphrase === true };
  }
  return assets;
}

// 构图骨架只锁几何：列宽比例、载体宽度档、标题行数、锚点。组件选择、件数与文案仍由内容/登记卡决定。
// 区间数值必须来自实测几何的校准；加载期只校验 schema 与引用合法性，不校验页面。
const interval = (v, lo, hi) => Array.isArray(v) && v.length === 2 && v.every(n => typeof n === 'number' && isFinite(n)) && v[0] >= lo && v[1] >= v[0] && v[1] <= hi;
// 能进 carriers/anchor 的只有几何载体组件：锁内容组件的宽度，骨架就变成了内容模板。
// counts 字段已随 C2 拆分删除（件数归登记卡绑定字段）；pipeline digest 里的 counts 是测量输出标签，非消费面。
const GEOMETRY_DRIVERS = new Set(['phone', 'shot', 'step', 'bars']);
function validateRecipeLayouts(id, recipe, catalog) {
  if (recipe.layouts === undefined) return;
  // null 与空串同罪：写了个空值说明作者没想清楚，按"空对象"给出与缺档一致的报错，而不是让 Object.entries 抛 TypeError。
  const regions = recipe.regions || {}, entries = Object.entries(recipe.layouts || {});
  if (!entries.length) throw new Error(`配方 ${id} 的 layouts 是空对象：要么不写，要么至少给一个骨架档`);
  for (const [lid, layout] of entries) {
    const at = `配方 ${id} 骨架 ${lid}`;
    if (!layout || typeof layout.name !== 'string' || !layout.name.trim() || typeof layout.when !== 'string' || !layout.when.trim())
      throw new Error(`${at} 缺少 name/when`);
    if (!Array.isArray(layout.order) || !layout.order.length) throw new Error(`${at} 的 order 不能为空`);
    for (const entry of layout.order) {
      const rid = typeof entry === 'string' ? entry.replace(/\?$/, '') : '';
      if (!rid || !Object.hasOwn(regions, rid)) throw new Error(`${at} 的 order 引用了未知区域: ${entry}`);
    }
    if (!Array.isArray(layout.tracks) || !layout.tracks.length) throw new Error(`${at} 的 tracks 不能为空`);
    for (const track of layout.tracks) {
      if (!Object.hasOwn(regions, track?.region || '')) throw new Error(`${at} 的 tracks 引用了未知区域: ${track?.region}`);
      // 上限 1.2 容纳出血墙（区域宽可略超正文）；share 是相对正文宽度的比例。
      if (!interval(track.share, 0.05, 1.2)) throw new Error(`${at} 的 tracks.share 必须是 [0.05,1.2] 内的比例区间: ${JSON.stringify(track.share)}`);
    }
    if (!interval(layout.headline, 1, 8) || !layout.headline.every(Number.isInteger)) throw new Error(`${at} 的 headline 必须是整数行数区间`);
    for (const carrier of layout.carriers || []) {
      if (!Object.hasOwn(catalog, carrier?.component || '')) throw new Error(`${at} 的 carriers 引用了未知组件: ${carrier?.component}`);
      if (!GEOMETRY_DRIVERS.has(carrier.component)) throw new Error(`${at} 的 carriers 只能锁定几何载体组件（phone/shot/step/bars）: ${carrier.component}`);
      if (!regions[carrier.region]?.allow?.includes(carrier.component)) throw new Error(`${at} 的 carriers 组件 ${carrier.component} 不被区域 ${carrier.region} 允许`);
      if (!interval(carrier.width, 1, 108)) throw new Error(`${at} 的 carriers.width 必须是 [1,108]cqw 内的宽度区间`);
    }
    if (layout.anchor) {
      if (!Object.hasOwn(regions, layout.anchor.region || '')) throw new Error(`${at} 的 anchor 引用了未知区域: ${layout.anchor.region}`);
      if (!Array.isArray(layout.anchor.carrier) || !layout.anchor.carrier.length || layout.anchor.carrier.some(c => !regions[layout.anchor.region]?.allow?.includes(c)))
        throw new Error(`${at} 的 anchor.carrier 必须是锚点区域允许的组件`);
      if (layout.anchor.carrier.some(c => !GEOMETRY_DRIVERS.has(c)))
        throw new Error(`${at} 的 anchor.carrier 只能锁定几何载体组件（phone/shot/step/bars）`);
    }
  }
}

export function loadProject(srcDir, outDir, options = {}) {
  const src = path.resolve(srcDir);
  const work = path.dirname(src);
  const out = path.resolve(outDir || path.join(work, '..', 'out'));
  const planPath = path.resolve(options.plan || path.join(work, '03-plan.json'));
  const poolPath = path.resolve(options.pool || path.join(work, '02-pool.json'));
  const plan = readJSON(planPath), pool = readJSON(poolPath);
  const components = readJSON(path.join(ROOT, 'config/components.json'));
  const recipes = readJSON(path.join(ROOT, 'config/recipes.json'));
  if (components.version !== 3 || recipes.version !== 3 || !components.components || !recipes.recipes)
    throw new Error('需要 version:3 的 components/recipes 配置');
  if (components.style !== recipes.style) throw new Error('组件与配方 style 不一致');
  for (const [id, recipe] of Object.entries(recipes.recipes)) {
    for (const [region, spec] of Object.entries(recipe.regions || {})) {
      // 区域级 require 禁入绊线（防回归注入）：组件下限归登记卡绑定字段，区域只管允许。
      if (spec.require) throw new Error(`配方 ${id} 区域 ${region} 仍写着 require：组件下限归登记卡，区域只管允许`);
    }
    validateRecipeLayouts(id, recipe, components.components);
  }
  if (plan.meta?.style !== components.style || typeof plan.meta?.brand !== 'string' || typeof plan.meta?.issue !== 'string')
    throw new Error('plan.meta 必须包含匹配的 style 以及 brand / issue 字符串');
  // 空 brand 会让 L6 的比对整条跳过，画布 .brand 又有字，R0 也不报错：两头都静默，所以在加载期就拒绝。
  if (!plan.meta.brand.trim()) throw new Error('plan.meta.brand 不能是空字符串或纯空白：没有品牌就写当期真实署名');
  if (!Array.isArray(plan.pages) || !plan.pages.length) throw new Error('plan.pages 不能为空');
  const assets = collectPoolAssets(pool), seen = new Set();
  const pages = plan.pages.map(pg => {
    const raw = String(pg?.nn ?? '');
    if (!/^\d{2}$/.test(raw) || +raw < 1) throw new Error(`页号须为两位正整数: ${raw}`);
    const nn = String(+raw).padStart(2, '0');
    if (seen.has(nn)) throw new Error(`plan 页号重复: ${nn}`);
    seen.add(nn);
    if (!Object.hasOwn(recipes.recipes, pg.recipe)) throw new Error(`${nn}: 未知配方 ${pg.recipe}`);
    if (typeof pg.intent !== 'string' || !pg.intent.trim()) throw new Error(`${nn}: 缺少 intent`);
    if (!Array.isArray(pg.uses) || pg.uses.some(id => typeof id !== 'string' || !Object.hasOwn(assets, id)))
      throw new Error(`${nn}: uses 必须是 pool 中精确的资产 id 数组`);
    // 只认 true 或省略：写 false 与省略在检查器里是两条路径（画布根带不带 .dark），留 `false` 进来等于允许计划自相矛盾。
    if ('dark' in pg && pg.dark !== true) throw new Error(`${nn}: pages[].dark 只能是 true 或缺省`);
    // 期号声明同一纪律（C1 迁移，2026-11-13）：资格唯一归登记卡矩阵，计划按卡声明；gate 只查账目面。
    if ('issue' in pg && pg.issue !== true) throw new Error(`${nn}: pages[].issue 只能是 true 或缺省`);
    // 骨架是显式决策：有骨架档的配方必须选档或明确写 free（自由构图仍受通用几何规则约束），
    // 让目检能分辨"刻意自由"与"忘了选档"，与 dark 同一纪律。
    const recipe = recipes.recipes[pg.recipe], layoutIds = Object.keys(recipe.layouts || {});
    if (layoutIds.length) {
      if (typeof pg.layout !== 'string' || !(pg.layout === 'free' || Object.hasOwn(recipe.layouts, pg.layout)))
        throw new Error(`${nn}: 配方 ${pg.recipe} 有构图骨架 ${layoutIds.join('/')}，pages[].layout 必须显式选一档或 "free"`);
    } else if (pg.layout !== undefined && pg.layout !== 'free')
      throw new Error(`${nn}: 配方 ${pg.recipe} 没有登记骨架，pages[].layout 只能缺省或 "free"`);
    const file = path.join(src, `p${nn}.part.html`);
    if (!fs.existsSync(file)) throw new Error(`缺少计划页源文件: ${file}`);
    const source = fs.readFileSync(file, 'utf8');
    return { ...pg, nn, file, source, sourceHash: sha256(source), htmlFile: path.join(out, `${nn}.html`), pngFile: path.join(out, `${nn}.png`),
      layoutSpec: pg.layout && pg.layout !== 'free' ? recipe.layouts[pg.layout] : null };
  });
  const sourceNames = new Set(pages.map(p => path.basename(p.file)));
  const extras = fs.readdirSync(src).filter(f => /^p\d+(?:\.part)?\.html$/i.test(f) && !sourceNames.has(f));
  if (extras.length) throw new Error(`源目录含计划外页面: ${extras.join(', ')}`);
  const used = new Set(pages.flatMap(p => p.uses));
  const orphans = Object.keys(assets).filter(aid => aid !== pool.thesis.id && !used.has(aid));
  if (orphans.length) throw new Error(`池里存在未被任何页面引用的资产: ${orphans.join(', ')}；删掉或给它找到用法`);
  return { src, work, out, planPath, poolPath, plan, pool, assets, pages, components, recipes, style: components.style,
    inputHash: sha256(JSON.stringify({ plan, pool, components, recipes, sources: pages.map(p => [p.nn, p.sourceHash]) })) };
}

export function assertOutputPages(project, requireHTML = false) {
  if (!fs.existsSync(project.out)) {
    if (requireHTML) throw new Error(`输出目录不存在: ${project.out}`);
    return;
  }
  const allowed = new Set(project.pages.flatMap(p => [`${p.nn}.html`, `${p.nn}.png`]));
  const extras = fs.readdirSync(project.out).filter(f => /^\d+\.(?:html|png)$/i.test(f) && !allowed.has(f));
  if (extras.length) throw new Error(`输出目录含非本次计划页 ${extras.join(', ')}；请使用新输出目录，工具不会删除历史产物: ${project.out}`);
  if (requireHTML) for (const pg of project.pages) {
    if (!fs.existsSync(pg.htmlFile)) throw new Error(`缺少当前计划 HTML: ${pg.htmlFile}`);
  }
}
export function reportPath(project) { return path.join(project.work, 'qa-report.json'); }
export function newReport(project, mode) {
  return { version: 2, runId: crypto.randomUUID(), startedAt: new Date().toISOString(), mode, status: 'running',
    inputHash: project.inputHash, plan: project.planPath, src: project.src, out: project.out,
    expectedPages: project.pages.map(p => p.nn), pages: [], issues: [], artifacts: {} };
}
// Lightweight summary view derived from the full report on every save.
// qa-report.json stays the evidence of record; qa-summary.json answers
// "which page, what state, what went wrong" without opening the big file.
export function qaSummary(report, project = null) {
  // recipe lives on project.pages (plan pages spread), not on report pages.
  const recipes = new Map((Array.isArray(project?.pages) ? project.pages : []).map(p => [p.nn, p.recipe]));
  const pages = (report.pages || []).map(p => ({
    nn: p.nn, recipe: recipes.get(p.nn) || null, status: p.status || 'pending',
    errors: (p.issues || []).filter(i => i.level === 'ERROR').length,
    warnings: (p.issues || []).filter(i => i.level === 'WARN').length,
    errorMessages: (p.issues || []).filter(i => i.level === 'ERROR').map(i => `${i.rule}: ${i.msg}`),
  }));
  return {
    version: 1, runId: report.runId, mode: report.mode, status: report.status,
    startedAt: report.startedAt, updatedAt: report.updatedAt,
    expectedPages: report.expectedPages?.length ?? 0,
    measuredPages: pages.length,
    passedPages: pages.filter(p => p.status === 'passed').length,
    failedPages: pages.filter(p => p.status === 'failed').length,
    runIssues: (report.issues || []).map(i => `${i.level} ${i.rule}: ${i.msg}`),
    pages,
  };
}
const rotatedRunIds = new Set();
export function saveReport(project, report) {
  report.updatedAt = new Date().toISOString();
  const file = reportPath(project);
  // Rotate the previous run's report aside before overwriting. Pipeline saves
  // progress several times per run, so only rotate when the on-disk report
  // belongs to a different runId — prev always holds the last distinct run.
  if (fs.existsSync(file)) {
    try {
      const prevRunId = JSON.parse(fs.readFileSync(file, 'utf8')).runId;
      if (prevRunId && prevRunId !== report.runId && !rotatedRunIds.has(prevRunId)) {
        fs.copyFileSync(file, path.join(project.work, 'qa-report.prev.json'));
        rotatedRunIds.add(prevRunId);
      }
    } catch {
      // Unreadable/legacy report: rotate it aside so it is not destroyed.
      fs.copyFileSync(file, path.join(project.work, 'qa-report.prev.json'));
    }
  }
  fs.writeFileSync(file, JSON.stringify(report, null, 2) + '\n');
  fs.writeFileSync(path.join(project.work, 'qa-summary.json'), JSON.stringify(qaSummary(report, project), null, 2) + '\n');
}
export function saveFailureReport(srcDir, mode, error) {
  const report = { version: 2, runId: crypto.randomUUID(), mode, status: 'failed', startedAt: new Date().toISOString(),
    expectedPages: [], pages: [], artifacts: {}, issues: [{ level: 'ERROR', rule: 'INPUT', msg: error.message }] };
  const work = path.dirname(path.resolve(srcDir));
  if (fs.existsSync(work)) saveReport({ work }, report);
  return report;
}
export function printReport(report, asJSON = false) {
  if (asJSON) { console.log(JSON.stringify(report, null, 2)); return; }
  for (const issue of [...(report.issues || []), ...(report.pages || []).flatMap(p => (p.issues || []).map(i => ({ page: p.nn, ...i })))])
    console.log(`${issue.level} ${issue.page || ''} ${issue.rule || ''} ${issue.msg}`);
  console.log(`${report.status.toUpperCase()} ${report.pages?.length || 0}/${report.expectedPages?.length || 0} 页 (${report.mode})`);
}
export async function cli(main) {
  try { await main(); } catch (error) { console.error(`ERROR ${error.message}`); process.exitCode = 1; }
}
