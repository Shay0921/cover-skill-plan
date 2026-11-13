#!/usr/bin/env node
// 负例索引是生成物，不是手工账本。每轮 dev/test-controlled.mjs 归档成 dev/controlled/controlled-negative-<时间戳>/
// 之后，把索引的 scope 指过去，跑 `node dev/check-negative-index.mjs --write` 重建；平时不带参数直接运行，
// 它把索引与磁盘夹具目录、套件记录数、每个夹具自己的 qa-report 逐条对账，任何漂移或非零失败即退出码 1。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const indexFile = path.join(here, 'controlled', 'negative-index.json');
const write = process.argv.includes('--write');
const readJSON = file => JSON.parse(fs.readFileSync(file, 'utf8').replace(/^﻿/, ''));

// stage 只回答一件事：这一条实际被哪一层拦下。取第一个 ERROR 的规则码，不做作者意图推断。
// 报告里的 BATCH/INPUT 是管道级的伴随错误，永远排在具体规则码之后判定。
function stageOf(report) {
  if (!report) return 'load'; // 契约级夹具在 loadProject 阶段就被拒绝，从不产生报告
  const issues = [...(report.issues || []), ...(report.pages || []).flatMap(p => p.issues || [])];
  const errors = issues.filter(i => i.level === 'ERROR');
  if (!errors.length) return 'pass'; // 正例对照：gate 通过，最多带 WARN
  // BATCH 是批级外壳，写在 report.issues 里、总是排在页级规则前面，所以先找具体规则码。
  const specific = errors.find(i => /^[LR]\d+$/.test(i.rule));
  if (specific) return specific.rule[0] === 'L' ? 'lint' : 'geometry';
  const msg = errors.map(i => i.msg).join(' ');
  if (/缺少本地素材|格式不一致|手写 dataURL|不安全素材|符号链接/.test(msg)) return 'build';
  if (/无法读取 JSON|plan\.|pages\[\]|meta\.|require|form|孤儿资产|计划外页面|配方|图层|brand|dark/.test(msg)) return 'load';
  return 'pipeline'; // 报告轮转、成品一致性、截图等管道与产物层
}

function collect(scope, name) {
  const work = path.join(scope, name, 'work');
  const reportFile = path.join(work, 'qa-report.json');
  const report = fs.existsSync(reportFile) ? readJSON(reportFile) : null;
  const issues = report ? [...(report.issues || []), ...(report.pages || []).flatMap(p => (p.issues || []).map(i => ({ ...i, nn: p.nn })))] : [];
  const errors = issues.filter(i => i.level === 'ERROR');
  const first = errors.find(i => /^[LR]\d+$/.test(i.rule)) || errors[0];
  return { report, stage: stageOf(report),
    rules: [...new Set(errors.map(i => i.rule))].sort(),
    warnRules: [...new Set(issues.filter(i => i.level === 'WARN').map(i => i.rule))].sort(),
    firstError: first ? `${first.nn ? `p${first.nn} ` : ''}${first.rule}: ${first.msg.slice(0, 90)}` : null,
    status: report?.status ?? 'not-run' };
}

const index = readJSON(indexFile);
const scope = path.join(here, 'controlled', index.scope.split('/').pop());
if (!fs.existsSync(scope)) throw new Error(`索引指向的夹具目录不存在: ${scope}`);
const resultsFile = path.join(scope, 'test-results.json');
if (!fs.existsSync(resultsFile)) throw new Error(`缺少套件结果: ${resultsFile}`);
const suite = readJSON(resultsFile);

const onDisk = new Set(fs.readdirSync(scope).filter(name => fs.statSync(path.join(scope, name)).isDirectory()));
const byName = new Map(suite.results.map(r => [r.name, r]));
const unaccounted = [...onDisk].filter(n => !byName.has(n)).sort();
const unrecorded = [...byName.keys()].filter(n => !onDisk.has(n)).sort();

const fixtures = [...onDisk].sort().map(name => {
  const result = byName.get(name) || {};
  const facts = collect(scope, name);
  // outcome 取自夹具自己的报告状态，不取作者写的 expected 字符串——字符串只作意图注记。
  const rejected = String(result.expected || '').startsWith('loadProject');
  const stage = facts.report ? facts.stage : rejected ? 'load' : 'direct-probe';
  const outcome = facts.status === 'passed' ? 'passed' : facts.status === 'failed' ? 'blocked'
    : rejected ? 'load-rejected' : 'probe'; // probe：不经 gate 的直接探针
  return { dir: name, outcome, stage, passed: result.passed !== false,
    rules: facts.rules, warn_rules: facts.warnRules, first_error: facts.firstError,
    suite_expected: String(result.expected || '').slice(0, 100) || null };
});
const rebuilt = { purpose: index.purpose, generatedAt: new Date().toISOString().slice(0, 10),
  scope: index.scope, suite: { total: suite.total, passed: suite.passed, failed: suite.failed, fontMode: suite.fontMode },
  stages: fixtures.reduce((m, f) => ({ ...m, [f.stage]: (m[f.stage] || 0) + 1 }), {}),
  count: fixtures.length,
  legend: { blocked: 'gate 必须 failed（夹具报告 status=failed）', passed: '正例对照：gate passed，可带 WARN',
    'load-rejected': '契约级夹具在 loadProject 阶段抛错，从不生成报告', probe: '不经 gate 的直接探针（如注册表扩展），没有报告状态',
    'fixture.passed': '每条夹具自己的套件断言是否达成（expected 是否命中），与 outcome 正交：blocked 的夹具 passed 同样可以是 true——它说的是"测试判对了"，不是"gate 通过"', },
  stage_legend: {
    load: '契约加载期拒绝（loadProject 抛错）或报告只带契约级 BATCH 文案，无页级规则码',
    build: 'build 阶段拒绝素材（缺少文件、扩展名与内容不符、手写 dataURL）',
    lint: '静态 DOM 检查 L 系列首先报错',
    geometry: '真实页面几何检查 R 系列首先报错',
    pipeline: '报告轮转、成品一致性、截图等管道与产物层',
    pass: '正例对照：无 ERROR，最多带 WARN',
    'direct-probe': '夹具没有报告：直接调 build/validate 探针注册表扩展，不经 gate',
  },
  fixtures };

const missing = [...onDisk].filter(n => !index.fixtures.some(f => f.dir === n)).sort();
const stale = index.fixtures.filter(f => !onDisk.has(f.dir)).map(f => f.dir).sort();
const drift = write ? [] : index.fixtures.filter(f => {
  const fresh = fixtures.find(x => x.dir === f.dir);
  return !fresh || fresh.stage !== f.stage || fresh.outcome !== f.outcome
    || fresh.rules.join() !== f.rules.join() || fresh.warn_rules.join() !== f.warn_rules.join();
}).map(f => f.dir);

if (write) {
  fs.writeFileSync(indexFile, JSON.stringify(rebuilt, null, 2) + '\n');
  console.log(`WRITE ${indexFile} count=${rebuilt.count} stages=${JSON.stringify(rebuilt.stages)}`);
}
const summary = { scope: index.scope, indexCount: index.count, indexed: index.fixtures.length, onDisk: onDisk.size,
  suite: { total: suite.total, passed: suite.passed, failed: suite.failed },
  missingFromIndex: missing, indexedButAbsent: stale, suiteWithoutFixture: unrecorded, fixtureWithoutSuiteRecord: unaccounted,
  drift: drift.slice(0, 12), driftCount: drift.length };
console.log(JSON.stringify(summary, null, 2));
const invariantBroken = index.count !== index.fixtures.length || index.suite && index.suite.total !== onDisk.size
  || suite.total !== onDisk.size || missing.length || stale.length || unrecorded.length || unaccounted.length || suite.failed;
if (unrecorded.length) console.error(`套件记录多于磁盘夹具：重跑 dev/test-controlled.mjs 后先归档再 --write`);
if (unaccounted.length) console.error(`夹具目录没有对应的套件记录：夹具可能是手工复制来的`);
if (!write && (invariantBroken || drift.length)) process.exitCode = 1;
