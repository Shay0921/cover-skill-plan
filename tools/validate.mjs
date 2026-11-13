#!/usr/bin/env node
import { evaluate, fontState } from './cdp.mjs';
import { isMain, cli, parseArgs, printReport } from './project.mjs';

// Self-contained browser probe. Business roles come from data markers; the
// optional contract only re-checks recipe floors and shapes for visibility.
export function measureDOM(contract) {
  const page = document.querySelector('.p-page');
  if (!page) return { issues: [{ level: 'ERROR', rule: 'R0', msg: '找不到 .p-page' }] };
  const P = page.getBoundingClientRect(), issues = [];
  const issue = (rule, msg, detail, level = 'ERROR') => issues.push({ level, rule, msg, ...detail });
  const id = el => el.getAttribute('data-layer') || el.getAttribute('data-region') || el.localName;
  const box = r => ({ x: r.left - P.left, y: r.top - P.top, w: r.width, h: r.height });
  const rect = el => el.getBoundingClientRect();
  const shown = el => {
    for (let node = el; node; node = node.parentElement) {
      const cs = getComputedStyle(node);
      if (cs.display === 'none' || cs.visibility === 'hidden' || cs.visibility === 'collapse' || +cs.opacity === 0) return false;
    }
    return true;
  };
  const visible = el => {
    if (!shown(el)) return false;
    const r = rect(el); return r.width > 0 && r.height > 0;
  };
  const decoration = el => !!el.closest('[data-decoration]');
  const related = (a, b) => a.contains(b) || b.contains(a);
  const intersection = (a, b) => ({ w: Math.min(a.right, b.right) - Math.max(a.left, b.left), h: Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) });
  const overlap = (a, b) => { const o = intersection(a, b); return o.w > 2 && o.h > 2; };
  const outside = (a, b) => ({ left: a.left < b.left - 2, right: a.right > b.right + 2, top: a.top < b.top - 2, bottom: a.bottom > b.bottom + 2 });
  const any = sides => Object.values(sides).some(Boolean);
  if (Math.abs(P.width - 1080) > 0.5 || Math.abs(P.height - 1440) > 0.5)
    issue('R0', `实际画布 ${P.width}×${P.height}，必须 1080×1440`);
  const components = [...page.querySelectorAll('[data-component]')].filter(el => visible(el) && !decoration(el));
  const texts = [...page.querySelectorAll('[data-editable="text"]')].filter(el => visible(el) && !decoration(el));
  // Gather media independently, before applying any text-leaf filtering.
  const images = [...page.querySelectorAll('img')];
  const media = images.filter(el => visible(el) && !decoration(el));
  // 装饰标记只说明"这层不是内容"，不说明它可以压住内容：壳层、贴花这类真实占位的图片
  // 仍然参与越界与遮挡检查，否则一张 data-decoration 大图就能盖掉整段正文而无人报错。
  const decoMedia = images.filter(el => visible(el) && decoration(el) && el.closest('[data-component]'));
  const textRects = (el, own = true) => {
    const result = [], walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walk.nextNode())) {
      if (!node.textContent.trim() || !visible(node.parentElement)) continue;
      if (own && node.parentElement.closest('[data-editable="text"]') !== el) continue;
      if (node.parentElement.closest('[data-decoration]')) continue;
      const range = document.createRange(); range.selectNodeContents(node);
      result.push(...[...range.getClientRects()].filter(r => r.width > 0 && r.height > 0));
    }
    return result;
  };
  const textInfo = texts.map(el => ({ el, rects: textRects(el) }));
  const footer = page.querySelector('.footer'), brand = page.querySelector('.brand');
  for (const [name, el] of [['brand', brand], ['footer', footer]]) {
    if (!el || !visible(el) || !el.textContent.trim()) issue('R0', `骨架 ${name} 不可见或无署名/编号文字`);
    else if (any(outside(rect(el), P))) issue('R1', `骨架 ${name} 越出画布`);
  }
  // 整棵子树隐藏时 visible() 会把正文全部摘掉，几何其余规则全免检；
  // 这里在过滤之后兜底：正文区域没有可见组件就是硬错误。
  const bodyEl = page.querySelector('main.body');
  const bodyComponents = bodyEl ? components.filter(el => bodyEl.contains(el)) : [];
  if (!bodyEl || !bodyComponents.length)
    issue('R12', '正文为空或不可见：main.body 内没有可见组件', { body: bodyEl ? box(rect(bodyEl)) : null });
  if (contract?.recipe) {
    for (const entry of contract.recipe.require || []) {
      const group = Array.isArray(entry) ? entry : [entry];
      const owners = [...page.querySelectorAll('[data-component]')].filter(el => group.includes(el.getAttribute('data-component')));
      if (owners.length && !owners.some(el => shown(el) && !decoration(el)))
        issue('R13', `配方要求的 ${group.join('/')} 全部不可见`, { components: group });
    }
    for (const [comp, shapes] of Object.entries(contract.recipe.form || {})) {
      for (const shape of shapes) {
        const spec = contract.components?.[comp]?.shapes?.[shape];
        if (!spec) continue;
        const owners = [...page.querySelectorAll(`[data-component="${comp}"]`)];
        const hit = owners.some(el => (el.matches(spec.selector) ? [el] : [...el.querySelectorAll(spec.selector)]).some(n => shown(n) && !decoration(n)));
        if (owners.length && !hit) issue('R13', `配方要求的 ${comp} 形态 ${shape} 没有可见命中`, { component: comp, shape });
      }
    }
  }
  // 构图骨架（几何部分）：列宽比例、标题行数、载体宽度档、锚点载体。
  // 区间来自实测校准；free 页不进入本段，仍受其余通用几何规则约束。
  const layout = contract?.layout;
  if (layout) {
    const CQ = P.width / 100;
    const regionEl = rid => page.querySelector(`[data-region="${rid}"]`);
    const bodyW = bodyEl ? rect(bodyEl).width : 0;
    for (const track of layout.tracks || []) {
      const el = regionEl(track.region);
      if (!el || !visible(el)) { issue('R14', `骨架区域 ${track.region} 不可见`, { region: track.region }); continue; }
      if (!(bodyW > 0)) continue;
      const share = rect(el).width / bodyW;
      if (share < track.share[0] - 0.01 || share > track.share[1] + 0.01)
        issue('R14', `区域 ${track.region} 列宽占比 ${(share * 100).toFixed(1)}% 超出骨架区间 ${(track.share[0] * 100).toFixed(0)}–${(track.share[1] * 100).toFixed(0)}%`,
          { region: track.region, share: +share.toFixed(3), want: track.share, hint: '调 flow-row 子列的 flex/宽度，先保载体宽度档再让文字列收缩' });
    }
    const h1 = page.querySelector('.heading h1');
    if (layout.headline) {
      if (!h1 || !visible(h1)) issue('R14', '骨架要求可见的主标题 h1', {});
      else {
        const cs = getComputedStyle(h1);
        const lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.18;
        const lines = Math.round(rect(h1).height / lh);
        if (lines < layout.headline[0] || lines > layout.headline[1])
          issue('R14', `主标题实际 ${lines} 行，骨架要求 ${layout.headline[0]}–${layout.headline[1]} 行`,
            { lines, want: layout.headline, hint: '断行是排版决定：用 <br> 在语义停顿显式分行，或换行数预算匹配的骨架档' });
      }
    }
    for (const carrier of layout.carriers || []) {
      const region = regionEl(carrier.region);
      const owners = region ? [...region.querySelectorAll(`[data-component="${carrier.component}"]`)].filter(el => visible(el) && !decoration(el)) : [];
      if (!owners.length) { issue('R14', `骨架要求区域 ${carrier.region} 有可见的 ${carrier.component}`, { component: carrier.component, region: carrier.region }); continue; }
      for (const el of owners) {
        const w = rect(el).width / CQ;
        if (w < carrier.width[0] - 0.5 || w > carrier.width[1] + 0.5)
          issue('R14', `${id(el)} 宽 ${w.toFixed(1)}cqw 超出骨架档 ${carrier.width[0]}–${carrier.width[1]}cqw`,
            { layer: id(el), widthCqw: +w.toFixed(1), want: carrier.width, hint: '先保载体宽度档，再让文字列收缩；不要反过来压主体' });
      }
    }
    if (layout.anchor) {
      const region = regionEl(layout.anchor.region);
      const hit = region && layout.anchor.carrier.some(comp => [...region.querySelectorAll(`[data-component="${comp}"]`)].some(el => visible(el) && !decoration(el)));
      if (!hit) issue('R14', `锚点区域 ${layout.anchor.region} 没有可见的 ${layout.anchor.carrier.join('/')} 载体：行高失去锚点，步骤/文字会被拉成洞`,
        { region: layout.anchor.region, carriers: layout.anchor.carrier });
    }
  }
  const protectedText = [brand, footer].filter(Boolean).flatMap(el => textRects(el, false).map(r => ({ el, r })));
  const boundsNodes = [...new Set([...components, ...texts, ...media, ...decoMedia])];
  for (const el of boundsNodes) {
    if (el.closest('.brand,.footer')) continue;
    const r = rect(el), component = el.closest('[data-component]');
    const bleed = component?.hasAttribute('data-bleed') && (el === component || !any(outside(r, rect(component))));
    if (!bleed && any(outside(r, P))) issue('R1', `${id(el)} 越出画布`, { layer: id(el), bounds: box(r) });
    const region = el.closest('[data-region]');    if (region) {
      const R = rect(region), sides = outside(r, R);
      // A region reaching the canvas edge may contain explicit canvas bleed;
      // interior region boundaries are never waived by data-bleed.
      if (bleed) {
        if (R.left <= P.left) sides.left = false;
        if (R.right >= P.right) sides.right = false;
        if (R.top <= P.top) sides.top = false;
        if (R.bottom >= P.bottom) sides.bottom = false;
      }
      if (any(sides)) issue('R1', `${id(el)} 越出所属区域 ${region.getAttribute('data-region')}`, { layer: id(el), sides });
    }
    // Intended bleed may cross the footer band; the protected text below still may not.
    if (!bleed && footer && visible(footer) && overlap(r, rect(footer)))
      issue('R1', `${id(el)} 进入实际 footer 保护区`, { layer: id(el), footer: box(rect(footer)) });
    for (const protectedItem of protectedText) if (overlap(r, protectedItem.r)) {
      issue('R1', `${id(el)} 覆盖 ${protectedItem.el === brand ? 'brand' : 'footer'} 文字（data-bleed 不豁免）`, { layer: id(el) }); break;
    }
  }
  // Components are the primary collision bodies. DOM containment is composition,
  // not collision; geometric containment between independent components IS one.
  for (let i = 0; i < components.length; i++) for (let j = i + 1; j < components.length; j++) {
    const a = components[i], b = components[j];
    if (!related(a, b) && overlap(rect(a), rect(b))) issue('R2', `独立组件重叠: ${id(a)} ↔ ${id(b)}`, { a: id(a), b: id(b), kind: 'component' });
  }
  for (let i = 0; i < textInfo.length; i++) for (let j = i + 1; j < textInfo.length; j++) {
    const a = textInfo[i], b = textInfo[j];
    if (a.rects.some(A => b.rects.some(B => overlap(A, B)))) issue('R2', `文字互压: ${id(a.el)} ↔ ${id(b.el)}`, { a: id(a.el), b: id(b.el), kind: 'text' });
  }
  for (const { el, rects } of textInfo) {
    const cs = getComputedStyle(el), r = rect(el);
    if ((el.clientWidth > 0 && el.scrollWidth > el.clientWidth + 2) || rects.some(t => t.left < r.left - 2 || t.right > r.right + 2))
      issue('R3', `文字横向溢出: ${id(el)}`, { layer: id(el) });
    for (let ancestor = el; ancestor; ancestor = ancestor.parentElement) {
      const acs = getComputedStyle(ancestor), a = rect(ancestor);
      const clipX = ['hidden', 'clip', 'scroll', 'auto'].includes(acs.overflowX), clipY = ['hidden', 'clip', 'scroll', 'auto'].includes(acs.overflowY);
      if (rects.some(t => (clipX && (t.left < a.left - 2 || t.right > a.right + 2)) || (clipY && (t.top < a.top - 2 || t.bottom > a.bottom + 2)))) {
        issue('R3', `文字被 ${id(ancestor)} 裁切: ${id(el)}`, { layer: id(el) }); break;
      }
      if (ancestor === page) break;
    }
    const lineTops = [];
    for (const t of [...rects].sort((a, b) => a.top - b.top)) {
      const center = (t.top + t.bottom) / 2;
      if (!lineTops.some(y => Math.abs(y - center) < Math.max(3, parseFloat(cs.fontSize) * 0.45))) lineTops.push(center);
    }
    if (el.hasAttribute('data-oneline') && lineTops.length > 1) issue('R8', `明确单行文字折为 ${lineTops.length} 行: ${id(el)}`);
    for (const img of [...media, ...decoMedia]) {
      if (related(el, img)) continue;
      const owner = el.closest('[data-component]'), imageOwner = img.closest('[data-component]');
      if (owner && imageOwner && (owner === imageOwner || related(owner, imageOwner))) continue;
      if (rects.some(t => overlap(t, rect(img)))) issue('R2', `文字被外部媒体遮挡: ${id(el)} ↔ ${id(img)}`, { a: id(el), b: id(img), kind: 'text-media' });
    }
  }
  // data-oneline may live on a wrapping text box instead of the editable leaf.
  for (const el of page.querySelectorAll('[data-oneline]:not([data-editable="text"])')) {
    if (!visible(el)) continue;
    const centers = [], size = parseFloat(getComputedStyle(el).fontSize);
    for (const r of textRects(el, false)) {
      const y = (r.top + r.bottom) / 2;
      if (!centers.some(c => Math.abs(c - y) < Math.max(3, size * 0.45))) centers.push(y);
    }
    if (centers.length > 1) issue('R8', `明确单行容器折为 ${centers.length} 行: ${id(el)}`);
  }
  for (const img of images) {
    if (!img.complete || !img.naturalWidth || !img.naturalHeight) issue('R4', `图片未加载/损坏: ${id(img)}`, { layer: id(img) });
  }
  // 画面塌陷：素材加载了、窗口也可见，但 <img> 自己量出 0 宽或 0 高，等于这一格根本没出图。
  // 这样的元素会被 visible() 从其余几何检查里摘掉，不单独报错就会静默通过。
  for (const img of images) {
    if (decoration(img) || !img.naturalWidth || !img.naturalHeight) continue;
    const owner = img.closest('[data-component]');
    if (!owner || !visible(owner)) continue;
    const r = rect(img);
    if (r.width < 1 || r.height < 1) issue('R11', `画面塌陷为 ${Math.round(r.width)}×${Math.round(r.height)}: ${id(img)}`,
      { layer: id(img), box: box(r), hint: '比例与 flex 要写在窗口本体上，不要写死 <img> 的某一维为 0' });
  }
  // Letterboxing is a composition hint, not a failure: the same raster can be
  // framed, cropped or carried by a taller container on the current page.
  for (const img of media) {
    if (!img.naturalWidth || !img.naturalHeight) continue;
    const r = rect(img), ratio = r.width / r.height, natural = img.naturalWidth / img.naturalHeight;
    if (!isFinite(ratio) || ratio <= 0) continue;
    const skew = Math.max(ratio / natural, natural / ratio);
    if (getComputedStyle(img).objectFit === 'contain' && skew > 1.5) issue('R9',
      `整图窗口留白明显：${id(img)} 素材 ${img.naturalWidth}×${img.naturalHeight}，容器比例与素材相差 ${skew.toFixed(2)} 倍`,
      { layer: id(img), box: box(r), natural: { w: img.naturalWidth, h: img.naturalHeight }, hint: ratio < natural ? '加高或减宽，或换 fill' : '竖向整屏素材可改带壳载体或减高' }, 'WARN');
  }
  const frames = media.map(img => { const cs = getComputedStyle(img); return { layer: id(img), fit: cs.objectFit,
    boxed: parseFloat(cs.borderTopWidth) > 0 || (cs.backgroundImage !== 'none' || (cs.backgroundColor !== 'transparent' && cs.backgroundColor !== 'rgba(0, 0, 0, 0)')) }; });
  // A component that declares aspect-ratio must keep it. Region width or height
  // that squeezes it is a layout error, not something to hide by stretching.
  for (const el of [...components, ...media]) {
    const declared = getComputedStyle(el).aspectRatio;
    if (!declared || declared === 'auto') continue;
    const [dw, dh] = declared.split('/').map(part => Number(part)), r = rect(el);
    if (!(dw > 0 && dh > 0 && r.width > 0 && r.height > 0)) continue;
    const skew = Math.max((r.width / r.height) / (dw / dh), (dw / dh) / (r.width / r.height));
    if (skew > 1.01) issue('R10', `${id(el)} 声明比例 ${dw}/${dh} 被压成 ${(r.width / r.height).toFixed(3)}（相差 ${((skew - 1) * 100).toFixed(1)}%）`,
      { layer: id(el), box: box(r), hint: '区域过窄或过矮：换更宽/更高的区域或减少同区内容，不要靠拉伸素材' });
  }
  // 时间线拉伸洞：行高被 flex 撑开而步骤内容跟不上时，步内出现大片空洞。
  // 12cqw 已含 padding 与行距余量，超过即构图问题（加步骤或同行放载体锚行高）。
  for (const timeline of page.querySelectorAll('.timeline')) {
    if (!visible(timeline)) continue;
    for (const step of timeline.querySelectorAll(':scope > .step')) {
      if (!visible(step)) continue;
      const r = rect(step);
      const content = [...textRects(step, false), ...[...step.querySelectorAll('img')].filter(visible).map(rect)];
      if (!content.length) continue;
      const top = Math.min(...content.map(c => c.top)), bottom = Math.max(...content.map(c => c.bottom));
      const slack = r.height - (bottom - top);
      if (slack > 12 * P.width / 100)
        issue('R15', `时间线步骤 ${id(step)} 内部拉伸余量 ${(slack / (P.width / 100)).toFixed(1)}cqw（>12cqw）：内容撑不满行高`,
          { layer: id(step), slackCqw: +(slack / (P.width / 100)).toFixed(1), hint: '增加步骤，或在同行放 phone/shot 载体锚定行高；不要让时间线独占满高行' });
    }
  }
  // data-bleed 是声明不是豁免：声明出血的组件必须真的贴到对应出血边，否则只是借豁免在画布内飘。
  // 边别跟随区域的出血类；顶边出血沿用封面机制，不在此检查。
  for (const el of page.querySelectorAll('[data-bleed]')) {
    if (!visible(el) || decoration(el)) continue;
    const region = el.closest('[data-region]');
    if (!region) continue;
    const cls = region.classList, r = rect(el), R = rect(region), sides = {};
    if (cls.contains('bleed-right') || cls.contains('bleed-x') || cls.contains('cover-bleed')) sides.right = Math.abs(r.right - R.right) > 2;
    if (cls.contains('bleed-left') || cls.contains('bleed-x')) sides.left = Math.abs(r.left - R.left) > 2;
    if (cls.contains('bleed-bottom') || cls.contains('cover-bleed')) sides.bottom = r.bottom < R.bottom - 2;
    if (any(sides)) issue('R16', `${id(el)} 声明 data-bleed 但没有贴到出血边`, { layer: id(el), sides, region: region.getAttribute('data-region') });
  }
  // --bleed-edge 的数学前提是单行页脚：署名一旦折行，所有向下出血的数值全部错位，在这里拦住。
  if (footer && visible(footer)) {
    const centers = [], size = parseFloat(getComputedStyle(footer).fontSize);
    for (const r of textRects(footer, false)) {
      const y = (r.top + r.bottom) / 2;
      if (!centers.some(c => Math.abs(c - y) < Math.max(3, size * 0.45))) centers.push(y);
    }
    if (centers.length > 1) issue('R18', `页脚文字折为 ${centers.length} 行：向下出血（--bleed-edge）的单行前提被破坏`, { lines: centers.length });
  }
  const bands = Array.from({ length: 4 }, (_, i) => {
    const top = P.top + i * P.height / 4, bottom = top + P.height / 4;
    const intervals = [...textInfo.flatMap(t => t.rects), ...media.map(rect)].map(r => [Math.max(top, r.top), Math.min(bottom, r.bottom)]).filter(([a, b]) => b > a).sort((a, b) => a[0] - b[0]);
    let cursor = top, covered = 0;
    for (const [a, b] of intervals) { if (b > cursor) { covered += b - Math.max(a, cursor); cursor = b; } }
    return { band: i + 1, coveredPx: covered, emptyPx: bottom - top - covered };
  });
  if (bands.some(b => b.emptyPx > 216)) issue('R7', '留白/密度仅供人工目检，不作为失败条件', { bands }, 'WARN');
  const layers = [...page.querySelectorAll('[data-layer]')].map(el => {
    const parent = el.parentElement?.closest('[data-layer]');
    const region = el.closest('[data-region]');
    return { id: el.getAttribute('data-layer'), tag: el.localName, component: el.getAttribute('data-component'),
      group: el.hasAttribute('data-group'), parentLayer: parent?.getAttribute('data-layer') || null,
      region: region?.getAttribute('data-region') || null, coordinateReference: 'canvas-top-left', units: 'px',
      rect: box(rect(el)), visible: visible(el), editable: el.getAttribute('data-editable'), slot: el.getAttribute('data-slot'), from: el.getAttribute('data-from') };
  });
  return { issues, canvas: { w: P.width, h: P.height }, footer: footer ? box(rect(footer)) : null, frames,
    regions: [...page.querySelectorAll('[data-region]')].map(el => ({ id: el.getAttribute('data-region'), rect: box(rect(el)) })),
    layers, bands, counts: { components: components.length, texts: texts.length, images: images.length } };
}
export const PROBE = `(${measureDOM.toString()})()`;
export async function validateReadyPage(ctx, contract) {
  const measured = await evaluate(ctx.cdp, ctx.sessionId, contract ? `(${measureDOM.toString()})(${JSON.stringify(contract)})` : PROBE);
  const fonts = ctx.fonts || await fontState(ctx);
  for (const msg of fonts.warnings) measured.issues.push({ level: 'WARN', rule: 'FONT', msg });
  return { ...measured, fonts };
}
export async function validateBatch(outDir, options = {}) {
  const { runBatch } = await import('./pipeline.mjs');
  return runBatch({ ...options, outDir, mode: 'validate' });
}
if (isMain(import.meta.url)) await cli(async () => {
  const { positional, options } = parseArgs(process.argv.slice(2));
  if (positional.length !== 1) throw new Error('用法: node validate.mjs <out> [--src src] [--plan file] [--pool file] [--json]');
  const report = await validateBatch(positional[0], options);
  printReport(report, options.json); if (report.status !== 'passed') process.exitCode = 1;
});
