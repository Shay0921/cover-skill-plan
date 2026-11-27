// 编辑器契约（pageApp markers 模式）在出图侧的唯一实现：属性取值域校验 + 占位符/系统槽 → 图层映射。
// 取值域真源是 pageApp《HTML产物交接规范》「属性表」；本模块只镜像「出图前必须拦住」的那部分。
// 为什么出图侧要自己查一遍：pack.mjs 打包时才校验，且首错即停、一次只报一条——等它报出来，交付已经做完了。
//
// 扫描口径与 pageApp lib/markers.mjs 逐条对齐（它读哪几条属性、每条的合法值、哪些元素算图层），
// 那边放开一个取值这里才跟着放开。差分测试（同一批 markup 双跑两边）是唯一验收方式，别凭读代码判断。
// 本库只多三处判断：缺 data-label 只 WARN、根节点不得带 data-layer、标记挂在非图层元素上只 WARN。

import { ROOT_SELECTOR, CANVAS } from './canvas.mjs';

// editor.manifest.json 的格式契约：写（render）与查（交付体检）读同一份，别各写一份字面量。
export const MANIFEST_FORMAT = 'pageapp-editor-manifest';
export const MANIFEST_VERSION = 1;
export const MANIFEST_DEFAULTS = { root: ROOT_SELECTOR, canvas: CANVAS, layerMode: 'markers', assetDirs: ['./assets'] };

// 组装 manifest 正文。两个写入点共用：render（出图时 --with-editor）与 editor-prep（事后对已有交付补件）——
// 后者没有 plan、没有 built 数组，只能从文件名反解页序与显示名，公式必须与 render 的逐字一致，
// 否则「重跑出图补的 manifest」与「事后补的 manifest」会差一个字段，体检发现不了、打包器却可能读错。
export function buildManifest(pages) {
  return {
    format: MANIFEST_FORMAT,
    version: MANIFEST_VERSION,
    ...MANIFEST_DEFAULTS,
    pages: pages.map((p) => ({ file: p.file, id: p.id, name: p.name })),
  };
}

const LAYER_TYPES = new Set(['text', 'group', 'image']);
const ID_PATTERN = /^[A-Za-z0-9_-]+$/;
// 取值域真源不在本仓：改这里之前先确认 pageApp 契约与标记实现没变。
const MARKER_ATTRS = ['data-layer', 'data-label', 'data-type', 'data-editable', 'data-group', 'data-slot'];
const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr',
  'circle', 'ellipse', 'line', 'path', 'polygon', 'polyline', 'rect', 'stop', 'use']);
const RAW_TEXT = new Set(['script', 'style']);

// 属性解析：裸属性记 null（"无值"），带引号/无引号的记字符串（空值记 ''）。
// 两者必须分得开——data-editable 裸写与写空串在 pageApp 那边都是 ""（会报错），
// 而 data-group 裸写与写空串它都放行（值是 ""）；本模块据此判断，不靠「有没有这个属性」。
function parseAttrs(str) {
  const out = new Map();
  for (const m of str.matchAll(/([a-zA-Z_:][-a-zA-Z0-9_:.]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g)) {
    out.set(m[1], m[2] ?? m[3] ?? m[4] ?? null);
  }
  return out;
}

// 找标签结尾：必须尊重引号——属性值里出现 > 很常见（data-label="Before > After"），
// 按 [^>]* 收标签会把它截断，后面整段属性被当成正文丢掉（图层直接消失，还不报错）。
function findTagEnd(html, start) {
  let quote = null;
  for (let i = start + 1; i < html.length; i++) {
    const c = html[i];
    if (quote) { if (c === quote) quote = null; }
    else if (c === '"' || c === "'") quote = c;
    else if (c === '>') return i;
  }
  return -1;
}

// 标签扫描（带位置，供图层映射取标签之间的文本）。注释 / doctype / 处理指令跳过，
// <style> / <script> 内容整段跳过——CSS 里的 .a > .b 不是标签，不跳会被拼成假元素。
export function scanTags(html) {
  const out = [];
  let i = 0;
  while (i < html.length) {
    const lt = html.indexOf('<', i);
    if (lt < 0) break;
    if (html.startsWith('<!--', lt)) { const e = html.indexOf('-->', lt + 4); i = e < 0 ? html.length : e + 3; continue; }
    const end = findTagEnd(html, lt);
    if (end < 0) break;
    const raw = html.slice(lt, end + 1);
    if (/^<[!?]/.test(raw)) { i = end + 1; continue; }
    const m = /^<(\/)?\s*([a-zA-Z][\w:-]*)/.exec(raw);
    if (!m) { i = end + 1; continue; }
    const closing = !!m[1];
    const tag = m[2].toLowerCase();
    const selfClosing = /\/\s*>$/.test(raw);
    const attrs = closing ? new Map() : parseAttrs(raw.slice(m[0].length, raw.length - (selfClosing ? 2 : 1)));
    out.push({ tag, closing, selfClosing, attrs, start: lt, end: end + 1 });
    i = end + 1;
    if (!closing && !selfClosing && RAW_TEXT.has(tag)) {
      const close = html.toLowerCase().indexOf(`</${tag}`, i);
      i = close < 0 ? html.length : close;
    }
  }
  return out;
}

// pageApp 的 markedElements 明确跳过 <template> 子树（模板里的图层不算图层）。
// 不剥掉就会多算图层，还会对一段永远不会渲染的标记报错。
function stripTemplates(html) {
  return html.replace(/<template\b[\s\S]*?<\/template\s*>/gi, '');
}

const attrText = (attrs, name) => {
  const v = attrs.get(name);
  return v === null ? name : `${name}="${v}"`;
};

// 属性取值域 + 类型/标签交叉规则。errors 命中即停：这些写法 pageApp 构建期直接抛错，出图等于白做。
// 返回 ids（非空 data-layer 集）——图层映射与交付体检都读它，不再各自扫一遍。
export function checkMarkerContracts(html, label = 'page') {
  const tag = String(label).trim();
  const errors = [];
  const warns = [];
  const all = scanTags(stripTemplates(html)).filter((t) => !t.closing);
  // 根要看「第一个元素」，不是「第一个标签」：组合页允许页内 <style> 且常写在最前，
  // 拿 <style> 当根会让「根不得带 data-layer」这条静默失效（实测漏判过）。
  const root = all.find((t) => !RAW_TEXT.has(t.tag));
  if (root && root.attrs.has('data-layer')) {
    errors.push(`${tag}: 根节点 <${root.tag}> 带了 data-layer——根不是图层，标记它会让整页在编辑器里整体位移`);
  }

  const seen = new Map();
  const noLabel = [];
  const inert = [];   // 挂在没有 data-layer 的元素上：打包器只收带 data-layer 的元素，这些标记不会生效

  for (const { tag: el, attrs } of all) {
    if (!MARKER_ATTRS.some((a) => attrs.has(a))) continue;

    // 先只收集「这个元素自己的问题」，再按它是不是图层决定硬错还是告警——
    // pageApp 根本不看非图层元素上的标记，在那上面硬停就是我们自己造的误杀。
    const hits = [];
    const declared = [];
    if (attrs.has('data-type')) {
      const v = attrs.get('data-type');
      if (!LAYER_TYPES.has(v)) hits.push(`data-type="${v}" 无效（只允许 text / group / image）`);
      else declared.push(['data-type', v]);
    }
    if (attrs.has('data-editable')) {
      const v = attrs.get('data-editable');
      if (v !== 'text') hits.push(`data-editable 必须为 "text"，当前为 ${v === null ? '无值' : `"${v}"`}`);
      else declared.push(['data-editable', 'text']);
    }
    if (attrs.has('data-group')) {
      // pageApp：hasAttr + value !== '' 才报错。裸写与空串在它那边都是 ""，两者都合法。
      const v = attrs.get('data-group');
      if (v !== null && v !== '') hits.push(`data-group 必须无值，当前为 "${v}"`);
      else declared.push(['data-group', 'group']);
    }
    if (attrs.has('data-slot')) {
      const v = attrs.get('data-slot');
      if (v !== 'image') hits.push(`data-slot 必须为 "image"，当前为 ${v === null ? '无值' : `"${v}"`}`);
      else declared.push(['data-slot', 'image']);
    }
    const kinds = new Set(declared.map((d) => d[1]));
    if (kinds.size > 1) hits.push(`类型标记冲突（${declared.map((d) => d[0]).join(' / ')}）——同一个元素只能是一种图层`);

    // 类型与标签的交叉规则：image 只能落 <img>，text 不能落 <img>。
    const kind = declared.length ? declared[0][1] : null;
    if (kind === 'image' && el !== 'img') hits.push(`image 图层必须标在 <img> 上，当前是 <${el}>`);
    if (kind === 'text' && el === 'img') hits.push(`text 图层不能标在 <img> 上`);

    const id = attrs.get('data-layer');
    if (!attrs.has('data-layer')) {
      // 合法取值挂在非图层元素上同样是死标记，不能因为它「没错」就静默吞掉。
      const dead = MARKER_ATTRS.filter((a) => a !== 'data-layer' && attrs.has(a)).map((a) => attrText(attrs, a));
      if (dead.length) inert.push(`<${el}> ${dead.join(' ')}`);
      continue;
    }
    if (id === null) hits.push('data-layer 写了但没有值');
    else if (!id) hits.push('data-layer 为空');
    else if (id !== id.trim()) hits.push(`data-layer 不能带首尾空白："${id}"（构建期不 trim，带空白直接报错）`);
    else if (!ID_PATTERN.test(id)) hits.push(`data-layer 不合法："${id}"（只允许字母、数字、- 和 _）`);

    errors.push(...hits.map((h) => `${tag}: ${h}`));
    if (id) {
      seen.set(id, (seen.get(id) || 0) + 1);
      // 空 label 与没写等价：pageApp 取 trim 后的空串也会回落成 id
      const labelVal = attrs.get('data-label');
      if (!attrs.has('data-label') || labelVal === null || !String(labelVal).trim()) noLabel.push(id);
    }
  }
  for (const [id, n] of seen) if (n > 1) errors.push(`${tag}: data-layer 重复："${id}" 出现 ${n} 次——图层 id 必须全页唯一`);
  if (noLabel.length) {
    const names = [...new Set(noLabel)];
    warns.push(`${tag}: ${names.length} 个图层缺 data-label（${names.slice(0, 4).join(' / ')}${names.length > 4 ? ' …' : ''}）——面板会显示 id 本身，人读着费劲`);
  }
  if (inert.length) {
    warns.push(`${tag}: ${inert.length} 处标记挂在没有 data-layer 的元素上，打包器不会读、等于没写（${inert.slice(0, 3).join(' / ')}）`);
  }
  return { errors, warns, ids: new Set(seen.keys()) };
}

// 一次扫描同时给出两张映射（两者服务的都是 fields.json，拆成两个函数就是同一份 markup 扫两遍）：
//   slots: {{占位符}} → 它所在图层的 data-layer id（同一占位符出现在两处不同图层时两个都记）。
//   sys:   data-sys 值 → 承载它的图层 id。品牌三槽与页码/进度的键从节点上读，不按 `sys-<值>` 拼——
//          拼出来的键在没这么命名图层的母版上会指向不存在的图层，编辑器按 data-layer 找节点，键对不上就等于没填。
export function scanLayerMaps(html) {
  const src = stripTemplates(html);
  const stack = [];
  const slots = new Map();
  const sys = new Map();
  let last = 0;

  const recordText = (text) => {
    if (!text || text.indexOf('{{') < 0) return;
    for (const p of text.matchAll(/\{\{([^}]+)\}\}/g)) {
      const name = p[1].trim();
      let layer = null;
      for (let i = stack.length - 1; i >= 0; i--) if (stack[i].layer) { layer = stack[i].layer; break; }
      const list = slots.get(name) || [];
      if (layer && !list.includes(layer)) list.push(layer);
      slots.set(name, list);
    }
  };

  for (const t of scanTags(src)) {
    if (t.start > last) recordText(src.slice(last, t.start));
    last = t.end;
    if (t.closing) {
      for (let i = stack.length - 1; i >= 0; i--) if (stack[i].tag === t.tag) { stack.length = i; break; }
      continue;
    }
    const sysName = t.attrs.get('data-sys');
    const layer = t.attrs.get('data-layer') || null;
    if (sysName && layer) {
      const list = sys.get(sysName) || [];
      if (!list.includes(layer)) list.push(layer);
      sys.set(sysName, list);
    }
    if (!t.selfClosing && !VOID.has(t.tag)) stack.push({ tag: t.tag, layer });
  }
  if (last < src.length) recordText(src.slice(last));
  return { slots, sys };
}
