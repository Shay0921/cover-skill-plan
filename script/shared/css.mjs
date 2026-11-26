// CSS 机械解析工具（composed.mjs 与页面级 CSS 校验共用，单源）
// 只做字符串级解析，不做规则判断。

// 整块剥掉 at-rule（@media / @supports / @layer / @keyframes …），含配对花括号。
// 为什么必须整块剥：`([^{}]+)\{` 只跳过 at-rule 头部，花括号一进内部，`.in-media{}`
// 就被当成共享类收进词表；组合页禁用 at-rule，这类名进了词表就是「写了也永不生效」的假授权。
// @import / @charset 这类无块语句吃到分号为止。
function stripAtRules(css) {
  let out = ''; let i = 0;
  for (;;) {
    const at = css.indexOf('@', i);
    if (at === -1) { out += css.slice(i); break; }
    out += css.slice(i, at);
    let j = at;
    while (j < css.length && css[j] !== '{' && css[j] !== ';') j++;
    if (j >= css.length || css[j] === ';') { i = j + 1; continue; }  // 无块 at-rule
    let depth = 0; let k = j;
    for (; k < css.length; k++) {
      if (css[k] === '{') depth++;
      else if (css[k] === '}' && --depth === 0) { k++; break; }
    }
    i = k;                                                            // 整块丢掉
  }
  return out;
}

// 去注释 + 剥 at-rule，供逐声明扫描使用。
export function plainCss(cssText) {
  return stripAtRules(cssText.replace(/\/\*[\s\S]*?\*\//g, ''));
}

// 提取 :root 里定义的令牌名集合（两个 :root 块都要收：色板/间距/行高在第一个，字号在第二个）。
export function collectTokenNames(cssText) {
  const out = new Set();
  for (const m of plainCss(cssText).matchAll(/:root\s*\{([^}]*)\}/g)) {
    for (const d of m[1].matchAll(/(--[\w-]+)\s*:/g)) out.add(d[1]);
  }
  return out;
}

// 从页面级 CSS 提取自造类名（只认类选择器）。
// 刻意不剥 at-rule：禁区检查会单独拦 @media 等，这里若剥掉，块内类名会被误报「未定义类名」，
// 一个违规只该报一条准确的错，不该连带出误导性的第二条。
export function collectCssClasses(cssText) {
  const out = new Set();
  const raw = cssText.replace(/\/\*[\s\S]*?\*\//g, '');
  for (const m of raw.matchAll(/([^{}]+)\{/g)) {
    for (const one of m[1].split(',')) {
      const sel = one.trim();
      if (!sel || sel.includes('%')) continue;
      for (const c of sel.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)) out.add(c[1]);
    }
  }
  return out;
}

// 逐声明扫描：返回 [{ prop, value, sel }]。只扫花括号里的 `prop: value;`，
// 不解析嵌套（页面级 CSS 禁 at-rule，故无嵌套）；选择器取最近一个 `{` 之前的片段。
export function scanDeclarations(cssText) {
  const out = [];
  const css = plainCss(cssText);
  for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const sel = m[1].trim().replace(/\s+/g, ' ');
    for (const d of m[2].split(';')) {
      const i = d.indexOf(':');
      if (i <= 0) continue;
      const prop = d.slice(0, i).trim().toLowerCase();
      const value = d.slice(i + 1).trim();
      if (!prop || !value) continue;
      out.push({ sel, prop, value });
    }
  }
  return out;
}
