/* cover-skill-plan 总预览生成器（v2：载体尺寸封顶，确保完整落在 1080×1440 内）
 * 读取 skill 的 recipes.json，用真实小程序文案 + 9 张截图，
 * 为每种「配方 × 档位」生成一张独立卡片 HTML，并产出可切换的总预览 index.html。
 * 仅用于设计预览；正式出图请用 skill 的 gate 流水线（pool/plan/src 三件齐备）。
 */
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const SKILL = 'C:/Users/Administrator/.workbuddy/skills/cover-skill-plan';
const recipes = JSON.parse(fs.readFileSync(path.join(SKILL, 'config/recipes.json'), 'utf8')).recipes;

/* ---------------- 真实内容池（全部来自 PRD / 项目全景，未编造） ---------------- */
const C = {
  brand: '冲煮咖啡方案', seal: '煮', tag: '微信小程序',
  h1: ['系统化方案管理：创建、收藏、分享你的冲煮方案',
       '多步骤精准计时：环形进度 + 水波纹，误差 ≤0.1 秒',
       '完整冲煮记录：风味标签、五维评分、咖啡因',
       '咖啡豆豆仓：养豆期、赏味期、新鲜度订阅提醒',
       '咖啡人格自测：13 题测出你的八维人格',
       '数据可视化：风味词云、连续天数、年度报告'],
  pains: ['参数记不住，好喝的那一杯总复现不了',
          '多步计时手忙脚乱，一不小心就冲过头',
          '喝了一整年，却说不清自己的口味偏好',
          '豆子放太久，错过最佳赏味期才发现'],
  data: [
    { n: '5',   u: '分包', t: '分包数',   d: '5 个分包按需加载，首屏 ≤ 2 秒' },
    { n: '27',  u: '路由', t: '注册路由', d: '27 条路由覆盖冲煮全流程' },
    { n: '54',  u: 'RPC',  t: '云端函数', d: '54 个 PostgreSQL RPC，聚合减少 90% 传输' },
    { n: '8',   u: '种',   t: '冲泡方法', d: '咖啡因计算器支持 8 种冲泡方法' },
    { n: '400', u: 'mg',   t: '安全摄入', d: '每日咖啡因安全摄入参考值 400mg' },
    { n: '13',  u: '题',   t: '人格问卷', d: '咖啡人格问卷 13 题，八维评分' },
    { n: '30',  u: '个',   t: '方案上限', d: '冲煮方案上限 30 个（白名单豁免）' }
  ],
  quotes: ['好咖啡不是玄学，是把每个参数都认真对待。',
           '记录，是让口味进步最快的方式。'],
  steps: [['称豆磨豆', '按方案设定粉量与研磨度'],
          ['闷蒸', '少量热水润湿粉层，释放二氧化碳'],
          ['分段注水', '计时器自动切换每一步注水'],
          ['完成评价', '记录风味与评分，沉淀成数据']],
  qa: [['需要付费吗？', '核心功能免费，未登录也能本地使用基础功能。'],
       ['数据会丢吗？', '登录后云端同步（Supabase RLS 行级隔离），未登录走本地缓存。'],
       ['支持哪些咖啡？', '手冲、法压、爱乐压、冷萃等 8 种冲泡方法。'],
       ['手机有限制吗？', 'iOS / Android 双端兼容，适配主流机型。']]
};

/* ---------------- 组件构造器（镜像 components.json 标准实例 + data-* 标记） ---------------- */
const h1      = (t,f='h1') => `<h1 class="h1" data-component="h1" data-layer="headline" data-editable="text" data-from="${f}">${t}</h1>`;
const sub     = (t,f='h1') => `<p class="sub" data-component="sub" data-layer="intro" data-editable="text" data-from="${f}">${t}</p>`;
const kicker  = (t,f='h1') => `<p class="kicker" data-component="kicker" data-layer="topic" data-editable="text" data-from="${f}">${t}</p>`;
const fcard   = (ic,t,d,f='h1') => `<article class="fcard" data-component="fcard" data-layer="feature" data-group>
  <p class="ic" data-layer="feature-mark" data-editable="text" data-from="${f}">${ic}</p>
  <div><p class="t" data-layer="feature-title" data-editable="text" data-from="${f}">${t}</p>
  <p class="s" data-layer="feature-detail" data-editable="text" data-from="${f}">${d}</p></div></article>`;
const ck      = (done,t,n,f='h1') => `<div class="ck ${done}" data-component="ck" data-layer="check-item" data-group>
  <span class="box" data-decoration></span>
  <div><p class="t" data-layer="check-title" data-editable="text" data-from="${f}">${t}</p>
  <p class="n" data-layer="check-note" data-editable="text" data-from="${f}">${n}</p></div></div>`;
const list    = (t,d,f='h1') => `<div class="frow" data-component="list" data-layer="list-item" data-group>
  <div><p class="t" data-layer="list-title" data-editable="text" data-from="${f}">${t}</p>
  <p class="d" data-layer="list-detail" data-editable="text" data-from="${f}">${d}</p></div></div>`;
const textBlock = (t,f='h1',muted=false) => `<p class="text-block${muted?' muted':''}" data-component="text-block" data-layer="explanation" data-editable="text" data-from="${f}">${t}</p>`;
const serifQuote = (t,src,f='q1') => `<blockquote class="quote hero" data-component="serif" data-layer="main-quote" data-group>
  <p class="serif" data-layer="quote-text" data-editable="text" data-from="${f}">${t}</p>
  <span class="rule" data-layer="quote-rule" data-decoration></span>
  <p class="source" data-layer="quote-source" data-editable="text" data-from="${f}">${src}</p></blockquote>`;
const cta = (t,f='h1') => `<p class="cta" data-component="cta" data-layer="next-action" data-editable="text" data-from="${f}">${t}</p>`;
/* phone：用 max-width 锁住高度，保证竖屏截图完整落在正文区内（不拉伸、不变形） */
const phone = (img,label,f='h1',maxW=39) => {
  const p = `<div class="phone" data-component="phone" data-layer="evidence-phone" data-group style="width:100%;max-width:${maxW}cqw;height:auto;max-height:none">
    <img class="phone-shot" data-layer="phone-screen" data-slot="image" src="${img}" alt="手机界面">
    <img class="frame-img" data-layer="phone-frame" data-slot="image" data-decoration src="../assets/iphone-frame.png" alt=""></div>`;
  if (label) return `<div class="phone-cell">${p}<p class="text-block" data-component="text-block" data-layer="phone-label" data-editable="text" data-from="${f}">${label}</p></div>`;
  return `<div class="phone-cell">${p}</div>`;
};
/* 单张大图：封顶高度 + contain（完整可见）或 fill（铺满裁切） */
const shotFit = (img,cap,f='h1',h=80,fill=false) => `<figure class="shot${fill?' fill':''}" data-component="shot" data-layer="evidence-shot" data-group style="height:${h}cqw;max-height:${h}cqw">
  <img data-layer="evidence-image" data-slot="image" src="${img}" alt="界面截图" style="object-fit:${fill?'cover':'contain'};object-position:center">
  <figcaption class="cap" data-layer="evidence-caption" data-editable="text" data-from="${f}">${cap}</figcaption></figure>`;
/* 多宫格单元：竖屏截图以 cover 铺满单元，形成紧凑的截图墙 */
const shotCell = (img,cap,f='h1',h=42) => `<figure class="shot fill" data-component="shot" data-layer="evidence-shot" data-group style="height:${h}cqw;max-height:${h}cqw">
  <img data-layer="evidence-image" data-slot="image" src="${img}" alt="界面截图" style="object-fit:cover;object-position:center">
  <figcaption class="cap" data-layer="evidence-caption" data-editable="text" data-from="${f}">${cap}</figcaption></figure>`;
const step = (i,t,d,f='h1') => `<section class="step" data-component="step" data-layer="step-${i}" data-group>
  <span class="num" data-numbering>${String(i).padStart(2,'0')}</span>
  <div><h2 class="t" data-layer="step-action" data-editable="text" data-from="${f}">${t}</h2>
  <p class="d" data-layer="step-detail" data-editable="text" data-from="${f}">${d}</p></div></section>`;
const ldr = (n,u,t,d,f='d1') => `<section class="ldr" data-component="ldr" data-layer="metric-${t}" data-group>
  <p class="n" data-layer="metric-value" data-editable="text" data-from="${f}">${n}<small class="u" data-layer="metric-unit" data-editable="text" data-from="${f}">${u}</small></p>
  <div><h2 class="t" data-layer="metric-name" data-editable="text" data-from="${f}">${t}</h2>
  <p class="d" data-layer="metric-scope" data-editable="text" data-from="${f}">${d}</p></div></section>`;
const ledger = (k,d,n,u,f='d1') => `<div class="ledger" data-component="ledger" data-layer="ledger-${k}" data-group>
  <span class="k" data-layer="ledger-label" data-editable="text" data-from="${f}">${k}</span>
  <p class="d" data-layer="ledger-scope" data-editable="text" data-from="${f}">${d}</p>
  <p class="n" data-layer="ledger-value" data-editable="text" data-from="${f}">${n}<small class="u" data-layer="ledger-unit" data-editable="text" data-from="${f}">${u}</small></p></div>`;
const bars = (title,items,f='d1') => {
  const row = items.map((it,i)=>`<div class="b${it.hi?' hi':''}" style="height:${it.h}%"><span data-layer="chart-value-${i}" data-editable="text" data-from="${f}">${it.v}</span></div>`).join('');
  const labs = items.map((it,i)=>`<span data-layer="chart-label-${i}" data-editable="text" data-from="${f}">${it.l}</span>`).join('');
  return `<figure class="bars" data-component="bars" data-layer="evidence-chart" data-group>
    <figcaption class="bl" data-layer="chart-title" data-editable="text" data-from="${f}">${title}</figcaption>
    <div class="row">${row}</div><div class="labs">${labs}</div></figure>`;
};
const ba = (bt,pts,f='h1') => `<section class="ba ${bt}" data-component="ba" data-layer="comparison-${bt}" data-group>
  <h2 class="bt" data-layer="comparison-heading" data-editable="text" data-from="${f}">${bt==='before'?'凭记忆冲煮':'用方案管理'}</h2>
  <ul>${pts.map(p=>`<li data-layer="comparison-point" data-editable="text" data-from="${f}">${p}</li>`).join('')}</ul></section>`;
const qa = (q,a,i,f='h1') => `<section class="qa" data-component="qa" data-layer="qa-${i}" data-group>
  <h2 class="question" data-layer="question-text" data-editable="text" data-from="${f}">${q}</h2>
  <p class="answer" data-layer="answer-text" data-editable="text" data-from="${f}">${a}</p></section>`;
const mn = (t,d,f='h1') => `<aside class="mn" data-component="mn" data-layer="margin-note" data-group>
  <h2 class="t" data-layer="note-title" data-editable="text" data-from="${f}">${t}</h2>
  <p class="d" data-layer="note-detail" data-editable="text" data-from="${f}">${d}</p></aside>`;
const cr = (k,en,d,f='h1') => `<div class="cr" data-component="cr" data-layer="summary-item" data-group>
  <span class="k" data-layer="summary-label" data-editable="text" data-from="${f}">${k}${en?`<span class="en" data-layer="summary-label-en" data-editable="text" data-from="${f}">${en}</span>`:''}</span>
  <p class="d" data-layer="summary-text" data-editable="text" data-from="${f}">${d}</p></div>`;

/* ---------------- 布局工具 ---------------- */
const twoCol = (L,R,lb=46,rb=50) =>
  `<div class="flow-row"><div class="region" style="flex:0 0 ${lb}%">${L}</div>`+
  `<div class="region" style="flex:0 0 ${rb}%">${R}</div></div>`;
const fullCol = (html) => `<div class="region grow">${html}</div>`;
const fullCentered = (html) => `<div class="region grow justify-center">${html}</div>`;
const overlay = (ch='煮') => `<div class="overlay"><div class="ghost" data-component="ghost" data-layer="background-letter" data-decoration>${ch}</div></div>`;

/* ---------------- 卡片骨架 ---------------- */
function card(recipe, layout, headHtml, bodyHtml, opt={}) {
  const dark = opt.dark ? ' dark' : '';
  const issue = recipe === 'P01'
    ? `<div class="issue" data-layer="issue-line"><span>咖啡图鉴</span><b>第 01 期</b></div>` : '';
  const pageno = opt.noPageno ? '' :
    `<span class="pageno" data-layer="page-number" data-editable="text" data-numbering>01 / 01</span>`;
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">
<link rel="stylesheet" href="../paper-journal.css"><title>${recipe} · ${layout}</title></head>
<body>
<div class="p-page${dark}" data-artwork data-size="1080x1440" data-recipe="${recipe}">
<div class="grain" data-decoration></div><div class="wash" data-decoration></div>
<header class="page-header">
  <div class="brand" data-layer="brand" data-group>
    <span class="seal" data-layer="brand-seal" data-editable="text">${C.seal}</span>
    <div><div class="nm" data-layer="brand-name" data-editable="text">${C.brand}</div>
    <div class="tg" data-layer="brand-tag" data-editable="text">${C.tag}</div></div>
  </div>${issue}
</header>
${headHtml}
<main class="body">${bodyHtml}</main>
${opt.overlay ? overlay(opt.overlay) : ''}
<footer class="footer"><span data-layer="footer-signature" data-editable="text">${C.brand}</span>${pageno}</footer>
</div></body></html>`;
}
const heading = (h1t,subt,k=false) =>
  `<div class="heading" data-region="head">${k?kicker(k):''}${h1t?h1(h1t):''}${subt?sub(subt):''}</div>`;

/* ---------------- 每个配方 × 档位的 body ---------------- */
function build(recipe, layout) {
  switch (recipe) {
    case 'P01': { // 封面
      const head = heading('把每一次冲煮，都变成可复现的方案', '选豆 → 冲煮 → 品鉴 → 记录 → 统计，一套喝懂咖啡的小程序');
      const leftCards = fcard('方','系统化方案管理','创建、收藏、分享你的方案') + fcard('时','多步精准计时','环形进度 + 水波纹');
      const leftText = textBlock('从一只豆子到一杯咖啡，把每一步的参数都留下来，下一次照着冲就行。') + fcard('记','完整记录','风味、评分、咖啡因');
      if (layout==='A') return card(recipe,layout,head,twoCol(leftCards, phone('../assets/s1.png','首页日历')));
      if (layout==='B') return card(recipe,layout,head,twoCol(leftCards, shotFit('../assets/s2.png','完整方案详情', 'h1',80)));
      if (layout==='C') return card(recipe,layout,head,twoCol(leftText, phone('../assets/s3.png','真实界面', 'h1',34), 38, 54), {noPageno:true});
      if (layout==='D') return card(recipe,layout,head,twoCol(leftCards, textBlock('不只是工具，更是你的咖啡成长日记。') + serifQuote(C.quotes[1],'产品主张')));
      break;
    }
    case 'P02': { // 功能分栏
      const head = heading('咖啡冲煮，从此有章法', '方案、计时、记录、分析，一个小程序全包了');
      const cards = C.h1.slice(0,4).map((t,i)=>fcard('ABCDEF'[i], t.split('：')[0], t.split('：')[1]||'')).join('');
      if (layout==='A') return card(recipe,layout,head,twoCol(cards, phone('../assets/s4.png','功能全景')), {overlay:'煮'});
      if (layout==='B') return card(recipe,layout,head,twoCol(phone('../assets/s5.png','主界面','h1',36), cards, 40, 56));
      break;
    }
    case 'P03': { // 截图墙
      const head = heading('真实界面，眼见为实', '从日历到豆仓，核心页面一屏看完');
      if (layout==='A') return card(recipe,layout,head,fullCol(`<div class="flow-grid">${shotCell('../assets/s1.png','首页日历')}${shotCell('../assets/s2.png','方案详情')}${shotCell('../assets/s3.png','计时器')}${shotCell('../assets/s4.png','记录')}</div>`));
      if (layout==='B') return card(recipe,layout,head,fullCol(`<div class="flow-row">${phone('../assets/s5.png','豆仓概览')}${phone('../assets/s6.png','风味轮')}${phone('../assets/s7.png','统计')}</div>`));
      if (layout==='C') return card(recipe,layout,head,fullCol(`<div class="flow-row">${phone('../assets/s8.png','年度报告')}${phone('../assets/s9.png','人格结果')}</div>`));
      if (layout==='D') return card(recipe,layout,head,fullCol(phone('../assets/s1.png','完整首页','h1',42)));
      break;
    }
    case 'P04': { // 清单
      const head = heading('你有没有这些冲煮烦恼？', '把模糊的不适，变成可以解决的具体问题');
      const checks = C.pains.map(p=>ck('done', p, '用系统化方案逐一化解')).join('');
      if (layout==='A') return card(recipe,layout,head,fullCol(checks), {overlay:'困'});
      if (layout==='B') return card(recipe,layout,head,twoCol(checks, phone('../assets/s2.png','对症的方案','h1',41)));
      break;
    }
    case 'P05': { // 旁注详情
      const head = heading('一只豆子的赏味期，怎么算', '养豆期 + 最佳赏味期 + 新鲜度订阅');
      if (layout==='A') return card(recipe,layout,head,twoCol(mn('默认 14 天养豆','烘焙后排气熟成，让风味稳定下来。') + mn('最佳赏味 30 天','养豆结束后的最佳风味窗口。'), shotFit('../assets/s3.png','豆仓新鲜度','h1',100,true), 36, 60));
      if (layout==='B') return card(recipe,layout,head,twoCol(textBlock('豆子不是放越久越好。系统按烘焙日自动推算 5 个阶段：养豆 → 最佳 → 衰退 → 过期，并在关键节点推送提醒。'), phone('../assets/s4.png','新鲜度时间轴','h1',34), 44, 52));
      if (layout==='C') return card(recipe,layout,head,twoCol(phone('../assets/s5.png','豆详情','h1',34), mn('3 段订阅','best_taste / decline / expired 三节点，每日 9:15 推送。')));
      break;
    }
    case 'P06': { // 步骤流
      const head = heading('跟着步骤冲，不会手忙脚乱', '多步骤计时，自动切换、一键暂停');
      const steps = C.steps.map((s,i)=>step(i+1,s[0],s[1])).join('');
      return card(recipe,layout,head,twoCol(`<div class="timeline">${steps}</div>`, phone('../assets/s6.png','计时器','h1',34)), {overlay:'冲'});
    }
    case 'P07': { // 数据账本
      const head = heading('用数据，看懂你的咖啡习惯', '5 分包 · 27 路由 · 54 RPC，工程扎实，体验顺滑');
      const metricCards = [ldr('5','分包','分包数','按需加载，首屏 ≤ 2 秒'),
                           ldr('27','路由','注册路由','覆盖冲煮全流程'),
                           ldr('54','RPC','云端函数','聚合减少 90% 传输')].join('');
      const bar = bars('核心模块完成度',[
        {v:'100',l:'方案',hi:true},{v:'100',l:'计时',hi:true},{v:'100',l:'统计',hi:true},{v:'95',l:'豆仓'}]);
      const ledgers = [ledger('30','个','方案上限','白名单豁免'),
                       ledger('20','袋','咖啡豆上限','库存管理'),
                       ledger('10','条/天','记录上限','每日限流')].join('');
      if (layout==='A') return card(recipe,layout,head,twoCol(metricCards + bar, phone('../assets/s7.png','统计页','h1',35)), {overlay:'数'});
      if (layout==='B') return card(recipe,layout,head,fullCol(metricCards + ledgers));
      if (layout==='C') return card(recipe,layout,head,twoCol(ledgers, phone('../assets/s8.png','年度账单','h1',34)));
      break;
    }
    case 'P08': { // 金句页
      const head = heading('', '', '一句话记住它');
      return card(recipe,layout,head,fullCentered(serifQuote('好咖啡不是玄学，<br>是把每个参数<br><span class="hl">都认真对待</span>。', '产品主张 · brew_guide')));
    }
    case 'P09': { // 对比
      const head = heading('凭记忆冲煮，vs 用方案管理', '同一杯咖啡，两种结果');
      const before = ba('before', ['参数靠脑子记，容易忘','复现全看运气','喝完没有沉淀']);
      const after  = ba('after',  ['参数结构化保存','一键复现好味道','自动积累数据']);
      if (layout==='A') return card(recipe,layout,head,fullCol(`<div class="flow-row">${before}${after}</div>`), {overlay:'比'});
      if (layout==='B') return card(recipe,layout,head,fullCol(`<div class="flow-row">${before}${after}</div><div class="flow-row">${shotCell('../assets/s1.png','凭记忆', 'h1',38)}${shotCell('../assets/s2.png','用方案', 'h1',38)}</div>`));
      break;
    }
    case 'P10': { // 问答
      const head = heading('关于这款小程序，你可能想问', '挑 4 个高频问题，直接回答');
      const items = C.qa.map((q,i)=>qa(q[0],q[1],i+1)).join('');
      return card(recipe,layout,head,fullCol(items), {overlay:'问'});
    }
    case 'P11': { // 画面页
      const head = heading('先看一眼它长什么样', '整屏界面，自己会说话');
      if (layout==='A') return card(recipe,layout,head,fullCentered(shotFit('../assets/s9.png','完整界面','h1',78)));
      if (layout==='B') return card(recipe,layout,head,fullCentered(shotFit('../assets/s9.png','完整界面','h1',64) + textBlock('从选豆、冲煮到记录，一屏看完全流程。')));
      break;
    }
    case 'P12': { // 结尾
      const head = heading('现在，轮到你冲第一杯', '从一个小方案开始，把爱好变成习惯');
      const crs = cr('START','BEGIN','从预设的「粕谷哲 4:6 法」开始，第一次就成功。') +
                  cr('FREE','FREE','未登录也能用，数据本地保存，随时升级云端。') +
                  serifQuote(C.quotes[0], '收尾金句');
      return card(recipe,layout,head,fullCol(crs + cta('打开小程序，冲一杯')), {overlay:'终'});
    }
  }
  return null;
}

/* ---------------- 生成所有组合 ---------------- */
const combos = [];
for (const [rid, r] of Object.entries(recipes)) {
  for (const lid of Object.keys(r.layouts || {})) {
    const html = build(rid, lid);
    if (!html) { console.warn('MISS', rid, lid); continue; }
    const file = `cards/${rid}-${lid}.html`;
    fs.writeFileSync(path.join(ROOT, file), html);
    combos.push({ rid, lid, name: r.name, intent: r.intent, layoutName: r.layouts[lid].name, when: r.layouts[lid].when, file });
  }
}

/* ---------------- 总预览 index.html ---------------- */
const groups = {};
for (const c of combos) (groups[c.rid] ||= []).push(c);
const recipeMeta = {};
for (const [rid, r] of Object.entries(recipes)) recipeMeta[rid] = { name: r.name, intent: r.intent };

const navHtml = Object.entries(groups).map(([rid, items]) => `
  <div class="group" data-rid="${rid}">
    <div class="ghead">${rid} · ${recipeMeta[rid].name}<span class="intent">${recipeMeta[rid].intent}</span></div>
    <div class="gbodies">${items.map(c=>`<button class="navbtn" data-file="${c.file}">${c.lid} · ${c.layoutName}</button>`).join('')}</div>
  </div>`).join('');

const meta0 = combos[0];
const indexHtml = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">
<title>cover-skill-plan · 配方×档位 总预览</title>
<style>
  :root{--paper:#F6EFE3;--ink:#171512;--accent:#C0562F;--muted:#756C5F;}
  *{box-sizing:border-box}
  html,body{margin:0;height:100%;font-family:"PingFang SC","Microsoft YaHei",sans-serif;background:#2a2622;color:var(--ink)}
  .app{display:grid;grid-template-columns:330px 1fr;height:100vh}
  .side{background:#1c1916;color:#e9e1d4;overflow:auto;padding:18px 14px;border-right:1px solid #000}
  .side h1{font-size:16px;margin:0 0 4px;color:#fff}
  .side .sub{font-size:12px;color:#a99e8d;margin:0 0 16px;line-height:1.5}
  .group{margin-bottom:14px}
  .ghead{font-size:13px;font-weight:700;color:#fff;display:flex;flex-direction:column;gap:2px;margin-bottom:6px}
  .ghead .intent{font-size:11px;font-weight:400;color:#9a9082}
  .gbodies{display:flex;flex-wrap:wrap;gap:6px}
  .navbtn{font:inherit;font-size:12px;padding:6px 10px;border:1px solid #4a423a;background:#2e2823;color:#e9e1d4;border-radius:8px;cursor:pointer;transition:.15s}
  .navbtn:hover{background:#3a332c}
  .navbtn.active{background:var(--accent);border-color:var(--accent);color:#fff}
  .main{display:flex;flex-direction:column;overflow:hidden}
  .bar{display:flex;align-items:center;gap:14px;padding:10px 18px;background:#1c1916;color:#e9e1d4;border-bottom:1px solid #000;flex-wrap:wrap}
  .bar .title{font-weight:700;font-size:15px;color:#fff}
  .bar .when{font-size:12px;color:#a99e8d}
  .bar .intent{font-size:12px;color:#c0b39f;margin-left:auto}
  .hint{font-size:11px;color:#8c8273;padding:8px 18px;background:#1c1916}
  .stage-wrap{flex:1;overflow:auto;display:flex;justify-content:center;align-items:flex-start;padding:24px;background:#15120f}
  .stage{width:1080px;height:1440px;transform-origin:top center;flex:none}
  .stage iframe{width:1080px;height:1440px;border:0;border-radius:10px;box-shadow:0 20px 60px rgba(0,0,0,.5)}
</style></head>
<body>
<div class="app">
  <aside class="side">
    <h1>cover-skill-plan 总预览</h1>
    <p class="sub">纸质杂志风 · 1080×1440 · 12 配方 × 各档位。<br>点击左侧任意档位，右侧实时切换单页预览。每个单页都是独立 HTML。</p>
    ${navHtml}
  </aside>
  <section class="main">
    <div class="bar">
      <span class="title" id="barTitle">${meta0.rid} · ${meta0.name}</span>
      <span class="when" id="barWhen">${meta0.layoutName} — ${meta0.when}</span>
      <span class="intent" id="barIntent">${meta0.intent}</span>
    </div>
    <div class="hint">预览用系统衬线兜底，未内嵌 webfont；正式出图请走 skill 的 gate 流水线（pool / plan / src 三件齐备 + 真实素材）。</div>
    <div class="stage-wrap">
      <div class="stage" id="stage"><iframe id="frame" src="${meta0.file}"></iframe></div>
    </div>
  </section>
</div>
<script>
  const combos = ${JSON.stringify(combos)};
  const frame = document.getElementById('frame');
  const stage = document.getElementById('stage');
  const wrap = document.querySelector('.stage-wrap');
  function fit(){ const s = Math.min((wrap.clientWidth-48)/1080, (wrap.clientHeight-48)/1440, 1); stage.style.transform = 'scale('+s+')'; }
  window.addEventListener('resize', fit); fit();
  const btns = document.querySelectorAll('.navbtn');
  btns[0].classList.add('active');
  btns.forEach(b=>b.addEventListener('click',()=>{
    btns.forEach(x=>x.classList.remove('active')); b.classList.add('active');
    const c = combos.find(x=>x.file===b.dataset.file);
    frame.src = c.file;
    document.getElementById('barTitle').textContent = c.rid+' · '+c.name;
    document.getElementById('barWhen').textContent = c.layoutName+' — '+c.when;
    document.getElementById('barIntent').textContent = c.intent;
  }));
</script>
</body></html>`;
fs.writeFileSync(path.join(ROOT, 'index.html'), indexHtml);

console.log('生成卡片数:', combos.length);
console.log('档位清单:', combos.map(c=>`${c.rid}-${c.lid}`).join(' '));
