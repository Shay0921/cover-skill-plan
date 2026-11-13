// E2 定性（临时脚本，跑完即删）：duo-labeled h68 溢出——真实管线渲染一轮，判 harness 预览差异 or 骨架实锤
import fs from 'node:fs';
import path from 'node:path';
import { runBatch } from '../tools/pipeline.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const base = path.join(ROOT, 'dev', 'e2-tmp-duo');
const src = path.join(base, 'work/src'), out = path.join(base, 'out');
fs.rmSync(base, { recursive: true, force: true });
fs.mkdirSync(src, { recursive: true }); fs.mkdirSync(out, { recursive: true });
fs.cpSync(path.join(ROOT, 'dev/cases/assets'), path.join(src, 'assets'), { recursive: true });

// 骨架按 _sc 同款逻辑实例化：占位符→短假文字/画廊资产；h68 结构原样保留
let body = fs.readFileSync(path.join(ROOT, 'dev/recipes/phone01-duo-labeled.part.html'), 'utf8');
const FILLED = {
  '品牌印章字': '豆仓', '品牌名称': '豆仓手记', '品牌标语': '看清每一步',
  '主题行': '真实使用 7 天', '标题前段': '两屏看清', '标题高亮': '主流程', '标题后段': '',
  '副题': '先看主屏再看辅屏', '屏注': '概览页', '边界说明': '两边是同一库存的两个视角',
  '页脚署名': '豆仓手记'
};
let imgIdx = 0;
const IMGS = ['assets/s1.png', 'assets/iphone-frame.png', 'assets/s2.png', 'assets/iphone-frame.png'];
body = body.replace(/\{\{([^}]+)\}\}/g, (_, ph) => /^图\d+$/.test(ph) ? IMGS[imgIdx++] : FILLED[ph] ?? ph);

const asset = (id, text) => ({ id, text, evidence: 'E2 定性用合成短句，不陈述产品事实。', source: '本试验定义' });
const pool = {
  thesis: asset('h1', '两屏看清主流程'),
  highlights: [], pains: [], hooks: [], quotes: [],
  data: [
    asset('brand-seal', '豆仓'),
    asset('brand-name', '豆仓手记'),
    asset('brand-tag', '看清每一步'),
    asset('topic-proof', '真实使用 7 天'),
    asset('duo-phone-headline', '两屏看清主流程'),
    asset('duo-phone-intro', '先看主屏再看辅屏'),
    asset('overview-caption', '概览页'),
    asset('shelf-caption', '概览页'),
    asset('duo-phone-note', '两边是同一库存的两个视角')
  ]
};
const plan = {
  meta: { style: 'paper-journal', brand: '豆仓手记', issue: '' },
  pages: [{
    nn: '01', recipe: 'R-phone-01', layout: 'duo-labeled', intent: 'E2 h68 溢出定性',
    uses: ['brand-seal', 'brand-name', 'brand-tag', 'topic-proof', 'duo-phone-headline', 'duo-phone-intro', 'overview-caption', 'shelf-caption', 'duo-phone-note']
  }]
};
fs.writeFileSync(path.join(base, 'work/03-plan.json'), JSON.stringify(plan, null, 2));
fs.writeFileSync(path.join(base, 'work/02-pool.json'), JSON.stringify(pool, null, 2));
fs.writeFileSync(path.join(src, 'p01.part.html'), body);

const report = await runBatch({ srcDir: src, outDir: out, mode: 'gate' });
const errs = report.pages.flatMap(p => p.issues || []).filter(i => i.level === 'ERROR');
console.log('STATUS:', report.status);
console.log('ERRORS:', JSON.stringify(errs.map(e => `${e.rule}: ${e.msg}`), null, 1));
console.log('PNG:', fs.existsSync(path.join(out, '01.png')) ? path.join(out, '01.png') : '(failed, no shot)');
