#!/usr/bin/env node
// Parse source in an offline about:blank target. Never navigate an unchecked file.
import { createOptions, launchBrowser, closeBrowser, withBlank, evaluate } from './cdp.mjs';
import { loadProject, isMain, cli, parseArgs, newReport, saveReport, saveFailureReport, printReport } from './project.mjs';

// Self-contained browser function: real HTML parser, not a regex DOM surrogate.
export function inspectFragmentDOM(html, contract) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const issues = [], images = [];
  const error = (rule, msg) => issues.push({ level: 'ERROR', rule, msg });
  const warn = (rule, msg) => issues.push({ level: 'WARN', rule, msg });
  // 占位符残留（L24）：骨架的 {{槽位}} 只活在配方库；成品页任何位置（文本/属性/注释）残留即 FAIL——渲染与交付前最后一道兜底。
  if (html.includes('{{')) error('L24', '成品页残留占位符 {{…}}：所有槽位必须替换为真实文案或预计算数值，渲染与交付前不允许留空');
  const allowedTags = new Set('div section article main header footer aside nav h1 h2 h3 h4 h5 h6 p span b strong i em u s del ins mark small sub sup br wbr hr ul ol li dl dt dd figure figcaption blockquote q cite abbr time code pre samp kbd table caption colgroup col thead tbody tfoot tr th td img a'.split(' '));
  const allowedAttrs = new Set('id class style title lang dir role hidden alt width height colspan rowspan scope datetime start reversed value decoding loading draggable'.split(' '));
  const cssForbidden = /url\s*\(|image-set\s*\(|expression\s*\(|(?:java|vb)script\s*:|@|\\|[<>]|\b(?:animation|transition)(?:-[a-z]+)?\s*:|(?:^|[;\s])(?:behavior|-moz-binding|content)\s*:/i;
  // 源片段只写相对路径；dataURL 由 build 从 assets/ 生成，手写等于绕过素材登记与来源追溯。
  const safeImage = src => !src.startsWith('data:') && /^assets\/[a-z0-9_\-./\u0080-\uffff ]+\.(?:png|jpe?g|webp|gif|bmp)$/i.test(src) && !src.split('/').some(part => part === '.' || part === '..');
  // 外观的唯一来源是种子：本页 style 只管布局、尺寸、间距、定位、裁切与构图。
  const appearanceProps = /^(?:all|color|background|background-.*|fill|stroke|accent-color|font|font-.*|letter-spacing|line-height|text-decoration(?:-.*)?|text-transform|text-shadow|text-emphasis(?:-.*)?|caret-color|border|border-.*|outline|outline-.*|box-shadow|filter|backdrop-filter|mix-blend-mode|mask(?:-.*)?|column-rule(?:-.*)?|quotes|hyphens|appearance)$/i;
  const layoutProps = new Set(('display flex flex-flow flex-direction flex-wrap flex-grow flex-shrink flex-basis order gap row-gap column-gap ' +
    'grid grid-template grid-template-columns grid-template-rows grid-template-areas grid-area grid-row grid-row-start grid-row-end grid-column grid-column-start grid-column-end ' +
    'align-content align-items align-self justify-content justify-items justify-self place-content place-items place-self ' +
    'width min-width max-width inline-size block-size height min-height max-height aspect-ratio ' +
    'margin margin-top margin-right margin-bottom margin-left margin-block margin-block-start margin-block-end margin-inline margin-inline-start margin-inline-end ' +
    'padding padding-top padding-right padding-bottom padding-left padding-block padding-block-start padding-block-end padding-inline padding-inline-start padding-inline-end ' +
    'position inset inset-block inset-block-start inset-block-end inset-inline inset-inline-start inset-inline-end top right bottom left z-index float clear ' +
    'object-fit object-position overflow overflow-x overflow-y clip-path transform transform-origin transform-style perspective ' +
    'visibility opacity box-sizing cursor white-space word-break word-wrap overflow-wrap text-overflow text-align vertical-align writing-mode direction').split(' '));
  for (const el of [doc.documentElement, doc.head, doc.body, ...doc.querySelectorAll('head *, body *')]) {
    const tag = el.localName;
    if (!['html', 'head', 'body'].includes(tag) && (!allowedTags.has(tag) || el.namespaceURI !== 'http://www.w3.org/1999/xhtml'))
      error('L0', `禁止标签/命名空间: <${tag}>`);
    for (const attr of [...el.attributes]) {
      const name = attr.name.toLowerCase(), value = attr.value;
      if (/^on/i.test(name) || ['srcdoc', 'srcset', 'href', 'xlink:href', 'action', 'formaction', 'background', 'poster', 'ping', 'is', 'autofocus'].includes(name))
        error('L0', `<${tag}> 禁止属性 ${name}`);
      else if (name === 'src') {
        if (tag !== 'img' || !safeImage(value)) error('L0', `不安全的图片来源: ${value.slice(0, 100)}`);
        else images.push(value);
      } else if (!allowedAttrs.has(name) && !/^data-[a-z0-9-]+$/.test(name) && !/^aria-[a-z-]+$/.test(name))
        error('L0', `<${tag}> 未允许属性 ${name}`);
      if (name === 'style') {
        const css = value.replace(/\/\*[\s\S]*?\*\//g, '');
        if (cssForbidden.test(css)) error('L0', '内联 style 包含动态代码、CSS URL、转义或动画');
        if (el.style.position === 'fixed' || /\b\d*(?:\.\d+)?(?:d?v[wh]|s?v[wh]|lv[wh])\b/i.test(css)) error('L0', '静态卡片不使用 fixed 定位或视口单位');
        // CSSOM also normalizes case and comments. Geometry properties remain free.
        for (const property of [...el.style]) {
          if (/^(animation|transition)(-|$)/i.test(property) || cssForbidden.test(el.style.getPropertyValue(property)))
            error('L0', `非静态 CSS: ${property}`);
        }
        // 属性名按作者写的形态判断：CSSOM 会把无法解析的整条声明丢掉，只看它会让拼错的属性静默消失。
        const seen = new Set();
        for (const declaration of css.split(';')) {
          const colon = declaration.indexOf(':');
          if (colon < 0) continue;
          const property = declaration.slice(0, colon).replace(/[\s\u00a0\t]/g, '').toLowerCase();
          if (!property) continue;
          if (property.startsWith('--')) {
            // 任何内联自定义属性都拒绝：种子变量之外的自造变量（含下划线/大小写变体）同样是绕过外观锁的后门。
            if (!seen.has(property)) {
              seen.add(property);
              error('L17', `<${tag}> 用内联 style 声明自定义属性 ${property}：外观取值只由种子给出`);
            }
            continue;
          }
          if (!/^[a-z][a-z0-9-]*$/.test(property) || seen.has(property)) continue;
          seen.add(property);
          if (appearanceProps.test(property)) error('L17', `<${tag}> 用内联 style 覆盖了外观属性 ${property}：颜色、字体、边框与质感只由种子给出，本页只调布局、尺寸、间距、定位、裁切与构图`);
          else if (!layoutProps.has(property)) warn('L18', `<${tag}> 内联 style 的属性 ${property} 不在本页允许的布局清单里，请确认拼写与用途`);
        }
      }
    }
  }
  if (doc.head.children.length) error('L0', '片段不允许 head 内容');
  if (doc.documentElement.attributes.length || doc.body.attributes.length) error('L0', '片段不允许 html/body 属性');
  const roots = [...doc.querySelectorAll('.p-page')];
  if (roots.length !== 1) error('L6', `必须恰有一个 .p-page，实际 ${roots.length}`);
  const root = roots[0];
  if (!root) return { issues, images, body: doc.body.innerHTML };
  if (root.parentElement !== doc.body || doc.body.children.length !== 1 || [...doc.body.childNodes].some(n => n.nodeType === 3 && n.textContent.trim()))
    error('L6', '.p-page 必须是片段唯一顶级元素');
  if (!root.hasAttribute('data-artwork') || root.getAttribute('data-size') !== '1080x1440') error('L6', '缺少 data-artwork / data-size="1080x1440"');
  if (root.getAttribute('data-recipe') !== contract.page.recipe) error('L6', 'data-recipe 与计划页不一致');
  const wantsDark = contract.page.dark === true;
  if (root.classList.contains('dark') !== wantsDark)
    error('L6', wantsDark ? '计划标了 dark，画布根缺少 .dark 配色' : '计划未标 dark，画布根不得带 .dark 配色');
  if (root.hasAttribute('data-layer')) error('L9', '画布根不作为业务图层');
  for (const name of ['brand', 'footer']) {
    if (root.querySelectorAll(`.${name}`).length !== 1) error('L6', `必须恰有一个 .${name} 骨架`);
  }
  for (const el of root.querySelectorAll('.issue')) {
    if (!el.closest('.page-header')) error('L6', '.issue 期号只能放在 .page-header 骨架内');
    if (!el.hasAttribute('data-layer')) error('L9', '.issue 期号缺少 data-layer');
  }
  const issueEl = root.querySelector('.page-header .issue');
  if (root.querySelectorAll('.page-header .issue').length > 1) error('L6', '期号骨架最多一个');
  if (issueEl && !contract.recipe.issue) error('L6', `配方 ${contract.page.recipe} 不是封面系列，页眉不得出现期号`);
  if (contract.recipe.issue) {
    if (typeof contract.meta?.issue === 'string' && contract.meta.issue.trim()) {
      if (!issueEl) error('L6', `计划 meta.issue 为 ${contract.meta.issue}，封面骨架缺少 .issue`);
      else if (!issueEl.textContent.includes(contract.meta.issue)) error('L6', '.issue 与计划 meta.issue 不一致');
    } else if (issueEl?.textContent.trim()) error('L6', '计划未提供 meta.issue，期号骨架不得自行编造文字');
  }
  const brandEl = root.querySelector('.brand');
  if (typeof contract.meta?.brand === 'string' && contract.meta.brand.trim() && brandEl && !brandEl.textContent.includes(contract.meta.brand))
    error('L6', '.brand 与计划 meta.brand 不一致');
  const layers = new Set();
  for (const el of root.querySelectorAll('[data-layer]')) {
    const id = el.getAttribute('data-layer');
    if (!/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(id)) error('L9', `图层 id 必须是明确的英文 kebab-case: ${id}`);
    if (layers.has(id)) error('L9', `重复图层 id: ${id}`);
    layers.add(id);
  }
  const regions = contract.recipe.regions || {};
  // C2 拆分（2026-11-13）：原 L11①"配方未允许区域 / 区域 max"已退役——区域登记与件数上限是配方决策，
  // 归登记卡绑定字段，gate 不复述。allow 数据仍在 config（服务计划加载合法性与下方 L11④ 区域合法性检查）。
  // overlay 锚点唯一：ghost 的 right/bottom 锚的是最近定位祖先，overlay 只有挂在画布根下位置语义才唯一；
  // 落进 main.body 就锚正文区，同一组件 DOM 落点不同视觉位置就不同。
  for (const el of root.querySelectorAll('[data-region="overlay"]'))
    if (el.parentElement !== root) error('L21', 'overlay 区域必须是 .p-page 的直接子级：ghost 的 right/bottom 锚点才唯一，落在正文里会随区域漂移');
  // 出血区配文（L23）：区域挂 .bleed 的出血是合法构图（封面手机、画面页出血都允许），拦的是"整页只剩图"。
  // 配文按目录契约只认 head 或 bottom 区域里的文字叶；出血区内部的图注（figcaption）不算——它是图的附属，不是页面的信息锚点。
  const bleedRegions = [...root.querySelectorAll('[data-region].bleed')];
  if (bleedRegions.length) {
    const hasCaption = ['head', 'bottom'].some(rid => {
      const region = root.querySelector(`[data-region="${rid}"]`);
      if (!region) return false;
      return [...region.querySelectorAll('[data-editable="text"]')].some(el => {
        const hiddenBy = el.closest('[hidden]');
        return !(hiddenBy && (!hiddenBy.style.display || hiddenBy.style.display === 'none')) && !!el.textContent.trim();
      });
    });
    if (!hasCaption)
      error('L23', `出血区域 ${bleedRegions.map(el => el.getAttribute('data-region')).join('/')} 缺少配文：head 或 bottom 至少要有一处标题或说明文字，不允许整页只剩图`);
  }
  // 带比例的 phone 根内禁文字叶（L19，C3 后果化改写 2026-11-13）：锁了高度的壳里塞文字会挤压/压坏画面。
  // R3 只对"溢出"报警，短文字在锁高壳内不溢出 → 静默，本规则是唯一守卫，故不限文字长度一律拦。
  // "多机并排每只要 .phone-cell + 壳下界面名"是配方决策（原 L19 已退役），归属 R-phone-01/R-wall-01 登记卡绑定字段，gate 不复述。
  for (const phone of root.querySelectorAll('[data-component="phone"]')) {
    const h = /(?:^|;)\s*height\s*:\s*([^;]+)/.exec(phone.getAttribute('style') || '')?.[1]?.trim();
    if (!h || h === 'auto') continue; // 高度自适应的壳随内容生长，塞文字无挤压后果
    if (phone.querySelector('[data-editable="text"]'))
      error('L19', `带比例的 phone 根 ${phone.getAttribute('data-layer') || '(无 data-layer)'} 内不得放文字叶：锁高壳内塞文字会挤压画面，界面名应与壳同层（见配方登记卡绑定字段）`);
  }
  // C2 拆分（2026-11-13）：原 L11② require 下限与 ③ form 形态已退役——"这页配不配叫这个配方"的组件/形态承诺
  // 归登记卡绑定字段（装配自查+人审兜底），gate 不复述；整页空兜底由 R12 负责。config 的 require/form 字段删除随独立小批。
  for (const el of root.querySelectorAll('[data-component]')) {
    const id = el.getAttribute('data-component');
    const region = el.closest('[data-region]')?.getAttribute('data-region');
    if (!Object.hasOwn(contract.components, id)) error('L11', `未知组件: ${id}`);
    if (!region || !regions[region]?.allow?.includes(id)) error('L11', `区域 ${region || '(缺少)'} 不允许组件 ${id}`);
    if (!el.hasAttribute('data-layer')) error('L9', `组件 ${id} 缺少 data-layer`);
    if (el.querySelector('[data-layer]') && !el.hasAttribute('data-group')) error('L9', `复合组件 ${id} 缺少 data-group`);
    if (el.parentElement?.closest('[data-component]')) error('L11', `组件 ${id} 不得嵌套在另一组件内`);
  }
  for (const el of root.querySelectorAll('[data-group]')) {
    if (!el.hasAttribute('data-layer')) error('L9', '布局组缺少 data-layer');
  }
  for (const el of root.querySelectorAll('[data-bleed]')) {
    if (!el.hasAttribute('data-component')) error('L1', 'data-bleed 只能声明在显式组件根');
  }
  const exempt = el => {
    const anchor = el.closest('.brand,.footer,.page-header .issue,[data-decoration],[data-numbering]');
    if (!anchor) return false;
    // 骨架免的是"署名身份"，不是整棵子树：页眉的品牌锁定层与页脚的署名/页码之外，文字仍是内容。
    if (anchor.matches('.brand')) return !!el.closest('[data-layer="brand-seal"],[data-layer="brand-name"],[data-layer="brand-tag"]');
    if (anchor.matches('.footer')) return !!el.closest('[data-layer="footer-signature"],[data-layer="page-number"],[data-numbering]');
    return true;
  };
  // 豁免标记只免来源检查，不是任意内容的藏身地：装饰/序号里夹带文字叶或长文案，等于绕过 data-from。
  const EXEMPT_TEXT_MAX = 8;
  for (const el of root.querySelectorAll('[data-decoration]')) {
    if (el.hasAttribute('data-editable') || el.querySelector('[data-editable]')) error('L8', 'data-decoration 不得携带文字叶 data-editable');
    if (el.textContent.trim().length > EXEMPT_TEXT_MAX) error('L8', `data-decoration 文本超过 ${EXEMPT_TEXT_MAX} 字符，业务文案请走组件与 data-from`);
  }
  for (const el of root.querySelectorAll('[data-numbering]'))
    if (el.textContent.trim().length > EXEMPT_TEXT_MAX) error('L8', `data-numbering 只放 ${EXEMPT_TEXT_MAX} 字符内的短序号，业务文案请走组件与 data-from`);
  const references = value => value.split(/[\s,，]+/).filter(Boolean);
  const digits = text => (text.normalize('NFKC').replace(/(\d),(?=\d{3}(?:\D|$))/g, '$1').match(/\d+(?:\.\d+)?/g) || []).map(n => String(Number(n)));
  for (const el of root.querySelectorAll('[data-from]')) {
    const refs = references(el.getAttribute('data-from'));
    if (!refs.length) error('L8', 'data-from 不得为空');
    for (const ref of refs) {
      if (!Object.hasOwn(contract.assets, ref)) error('L8', `pool 不存在资产: ${ref}`);
      else if (!contract.page.uses.includes(ref)) error('L10', `资产 ${ref} 不在本页 uses`);
    }
  }
  // 反向对账：本页 uses 列出的每项资产必须真的被本页 data-from 引用。
  // 没有这条，后补的计划凭记忆列多 uses 不会被发现，"本页取用清单"失去账目意义，
  // 资产也会借未列它的页面暗度陈仓（那页会被 L10 拦，但本页的漂移没人管）。
  const usedRefs = new Set();
  for (const el of root.querySelectorAll('[data-from]'))
    for (const ref of references(el.getAttribute('data-from'))) usedRefs.add(ref);
  for (const ref of contract.page.uses)
    if (!usedRefs.has(ref)) error('L10', `uses 列了资产 ${ref}，但本页没有 data-from 引用它`);
  for (const el of root.querySelectorAll('[data-editable]')) {
    if (el.getAttribute('data-editable') !== 'text') error('L9', '文字叶必须使用 data-editable="text"');
    if (!el.hasAttribute('data-layer')) error('L9', '文字叶缺少 data-layer');
    if (!exempt(el) && !el.hasAttribute('data-from')) error('L8', `文字叶缺少 data-from: ${el.textContent.trim().slice(0, 40)}`);
    // 骨架（品牌锁定层、页脚、期号）本来就不是内容组件，不要求 data-component。
    if (!el.closest('.brand,.footer,.page-header .issue') && !el.closest('[data-component]')) error('L11', '业务文字必须归属显式组件根');
  }
  for (const img of root.querySelectorAll('img')) {
    if (img.getAttribute('data-slot') !== 'image' || !img.hasAttribute('data-layer')) error('L9', '图片缺少 data-slot="image" / data-layer');
    if (!img.hasAttribute('src')) error('L0', '图片缺少 src');
    // 豁免标记不能替图片免掉几何检查：可见性过滤会把 data-decoration 的 <img> 整棵摘掉，
    // 脱离组件根的装饰图因此可以在正文上盖一大块而无人报错，所以图片一律要求组件归属。
    if (!img.closest('[data-component]')) error('L11', '图片必须归属显式组件根：data-decoration 只免来源检查，不豁免几何检查');
  }
  // Walk text nodes, so inline spans and an unmarked sibling cannot disappear
  // behind a regex, nor borrow numbers from a different nested data-from.
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const byAnchor = new Map();
  let text;
  while ((text = walker.nextNode())) {
    if (!text.textContent.trim()) continue;
    const el = text.parentElement;
    // [hidden] 被内联 display 覆盖时文字实际渲染，不再豁免。
    const hiddenBy = el.closest('[hidden]');
    if (exempt(el) || (hiddenBy && (!hiddenBy.style.display || hiddenBy.style.display === 'none'))) continue;
    const editable = el.closest('[data-editable="text"]');
    const anchor = el.closest('[data-from]');
    if (!editable) error('L9', `可见业务文字未标记文字叶: ${text.textContent.trim().slice(0, 40)}`);
    if (!anchor) error('L8', `可见文字没有来源: ${text.textContent.trim().slice(0, 40)}`);
    else byAnchor.set(anchor, (byAnchor.get(anchor) || '') + text.textContent);
  }
  for (const [anchor, text] of byAnchor) {
    const refs = references(anchor.getAttribute('data-from'));
    const allowedNumbers = new Set(refs.flatMap(id => digits(contract.assets[id]?.text || '')));
    for (const number of new Set(digits(text))) if (!allowedNumbers.has(number))
      error('L8', `data-from="${refs.join(' ')}" 的数字 ${number} 不在所属资产中`);
  }
  // L14：数字带单位时，单位必须能在所引资产的 text/evidence 里找到同一数字的对应单位。
  // L15：单来源且资产属于 data/quotes 时，渲染文字必须是资产 text 的逐字或连续片段。
  // L16：其余类别、多来源与标注改写的资产，文字无重叠时只告警，不阻断交付。
  const normalize = s => s.normalize('NFKC').replace(/\s+/g, '')
    .replace(/[，。、；：！？,.;:!?“”‘’（）()《》·—\-…]/g, '');
  const unitPattern = /(\d+(?:\.\d+)?)\s*(%|％|元|条|倍|人|天|次|个|岁|件|台|页|小时|分钟|秒|米|公里|克|千克|毫升|升|万|亿|位|家|款|种|篇|张|场|步|轮|期|年|月|日|单)/g;
  const unitMap = s => {
    const map = new Map();
    for (const hit of s.normalize('NFKC').matchAll(unitPattern)) {
      const key = String(Number(hit[1])), unit = hit[2] === '％' ? '%' : hit[2];
      if (!map.has(key)) map.set(key, new Set());
      map.get(key).add(unit);
    }
    return map;
  };
  const grams = s => { const set = new Set(); for (let i = 0; i + 2 <= s.length; i++) set.add(s.slice(i, i + 2)); return set; };
  const strictKinds = new Set(['data', 'quotes']);
  for (const [anchor, text] of byAnchor) {
    const refs = references(anchor.getAttribute('data-from'));
    const assets = refs.map(id => contract.assets[id]).filter(Boolean);
    const page = normalize(text);
    if (!page || !assets.length) continue;
    const allowed = new Map();
    for (const asset of assets) {
      for (const [n, units] of unitMap(`${asset.textOnly || ''}\n${asset.evidence || ''}`)) {
        if (!allowed.has(n)) allowed.set(n, new Set());
        for (const unit of units) allowed.get(n).add(unit);
      }
    }
    for (const [n, units] of unitMap(text)) {
      const ok = allowed.get(n);
      if (ok && ![...units].some(u => ok.has(u)))
        error('L14', `数字 ${n} 的单位 ${[...units].join('/')} 与所引资产不符（资产为 ${[...ok].join('/')}）：${text.trim().slice(0, 40)}`);
    }
    const asset = assets.length === 1 && strictKinds.has(assets[0].kind) ? assets[0] : null;
    if (asset) {
      const want = normalize(asset.textOnly || '');
      // 页面文字必须是资产 text 本身或其连续片段；资产只是数字时不能反过来当作"页面包含资产"。
      if (!want || (page !== want && !want.includes(page))) {
        const msg = `data-from="${refs.join(' ')}" 的文案与 ${asset.kind} 资产 text 不一致：页面「${text.trim().slice(0, 40)}」／资产「${(asset.textOnly || '').slice(0, 40)}」`;
        if (asset.paraphrase) warn('L15', `${msg}；资产已标注 paraphrase，仅告警`);
        else error('L15', msg);
      }
      continue;
    }
    const overlap = assets.some(a => {
      const t = normalize(a.textOnly || ''), e = normalize(a.evidence || '');
      if ((t && (t.includes(page) || page.includes(t))) || (e && (e.includes(page) || page.includes(e)))) return true;
      const tg = grams(t), eg = grams(e);
      return [...grams(page)].some(g => tg.has(g) || eg.has(g));
    });
    if (!overlap) warn('L16', `data-from="${refs.join(' ')}" 的文案与所引资产没有文字重叠，请目检：${text.trim().slice(0, 40)}`);
  }
  return { issues, images: [...new Set(images)], body: doc.body.innerHTML };
}

export async function lintFragment(inst, project, page, opts = createOptions()) {
  const contract = { page: { recipe: page.recipe, uses: page.uses, dark: page.dark === true, layout: page.layout || null }, recipe: project.recipes.recipes[page.recipe],
    components: project.components.components, assets: project.assets, meta: project.plan.meta || {}, layout: page.layoutSpec || null };
  return withBlank(inst, opts, async ({ cdp, sessionId }) => evaluate(cdp, sessionId,
    `(${inspectFragmentDOM.toString()})(${JSON.stringify(page.source)},${JSON.stringify(contract)})`, { timeoutMs: opts.timeout }));
}
export async function lintProject(inst, project, opts = createOptions()) {
  // 一次报全：静态检查便宜，早停只会把错误挤牙膏式摊到多轮返修；
  // 全部页收集完再交给 prepareBuild 决定是否构建。
  const results = [];
  for (const page of project.pages) {
    const result = await lintFragment(inst, project, page, opts);
    results.push({ nn: page.nn, ...result });
  }
  return results;
}
if (isMain(import.meta.url)) await cli(async () => {
  const { positional, options } = parseArgs(process.argv.slice(2));
  if (positional.length !== 1) throw new Error('用法: node lint-dom.mjs <src> [--plan file] [--pool file] [--json]');
  let project;
  try { project = loadProject(positional[0], undefined, options); }
  catch (error) { printReport(saveFailureReport(positional[0], 'lint', error), options.json); process.exitCode = 1; return; }
  const report = newReport(project, 'lint');
  const opts = createOptions(); let inst;
  try {
    inst = await launchBrowser(opts);
    report.pages = (await lintProject(inst, project, opts)).map(({ body, images, ...result }) => result);
    report.status = report.pages.length === project.pages.length && !report.pages.some(p => p.issues.some(i => i.level === 'ERROR')) ? 'passed' : 'failed';
  } catch (error) { report.status = 'failed'; report.issues.push({ level: 'ERROR', rule: 'L0', msg: error.message }); }
  finally { await closeBrowser(inst); saveReport(project, report); }
  printReport(report, options.json); if (report.status !== 'passed') process.exitCode = 1;
});
