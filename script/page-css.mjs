// 页面级 CSS 视觉令牌校验（自由组合页自造组件时使用）
// 定位：组合页放开 <style> 块与自造类，但视觉规范不放开——所有视觉值必须命中 style.css :root 关闭集。
// 真源：令牌集合从 style.css :root 现场派生（不抄档位清单）；改档只改 :root，本模块不用动。
// 边界：只查「视觉值是否令牌化」，不查审美/几何/字数；那几项仍靠 --check-geometry + 人审。

import { collectTokenNames, collectCssClasses, scanDeclarations } from './shared/css.mjs';

// 从 markup 抽出页面级 <style> 块内容（允许多个，合并检查；禁区由 composed 的 CUSTOM_FORBIDDEN_RE 另查）。
export function extractPageCss(markup) {
  const blocks = [];
  for (const m of String(markup).matchAll(/<\s*style\b[^>]*>([\s\S]*?)<\/\s*style\s*>/gi)) {
    blocks.push(m[1]);
  }
  return blocks;
}

// 按属性族决定「值必须长什么样」。规则均从 tokenNames 现场核对，不硬编码档位。
//   color-*: 色板令牌（--paper/--ink/--accent/...）或 var(--on-dark-*)
//   font-size: --fs-*；line-height: --lh-*；letter-spacing: --ls-*
//   border-radius: --radius-*；gap/margin/padding: --space-*（或 auto / 0 这类非尺寸关键字）
// 白名单关键字（auto/none/inherit/currentColor/transparent/0）不算裸值。
const KEYWORDS = /^(auto|none|inherit|initial|unset|currentColor|transparent|normal|0|solid|dashed|dotted|flex|hidden|visible|absolute|relative|static|sticky|center|left|right|top|bottom|start|end|wrap|nowrap|column|row|block|inline(-block|-flex)?|grid|table|cover|contain|bold|lighter|italic|underline|uppercase|lowercase|capitalize)$/i;

// 裸色值：`#hex` / `rgb()` / `hsl()` / `color()` / 具名色。判定前先剥 var()——
// 否则 `background: var(--paper) #fff` 只要含一个 var() 就整条放行（老写法 color 分支就有这个洞）。
const BARE_COLOR_RE = /#[0-9a-f]{3,8}\b|\b(?:rgb|rgba|hsl|hsla|color)\s*\(|\b(?:red|blue|green|white|black|gray|grey|orange|purple|yellow|pink|teal|navy|gold|silver)\b/i;
const bareColor = (value) => BARE_COLOR_RE.test(value.replace(/var\(\s*--[\w-]+\s*\)/g, ' '));

function tokenFamily(prop) {
  if (/^font-size$/.test(prop)) return '--fs-';
  if (/^line-height$/.test(prop)) return '--lh-';
  if (/^letter-spacing$/.test(prop)) return '--ls-';
  if (/^border(-top|-right|-bottom|-left)?-radius$|^border-radius$/.test(prop)) return '--radius-';
  if (/^(gap|row-gap|column-gap|margin(-top|-right|-bottom|-left)?|padding(-top|-right|-bottom|-left)?)$/.test(prop)) return '--space-';
  if (/^(color|background|background-color|border(-top|-right|-bottom|-left)?-color|outline-color|fill|stroke|text-decoration-color)$/.test(prop)) return 'color';
  // 简写属性会藏颜色：border:1px solid #ddd、box-shadow:…rgba()、outline:… 只查 border-color 会整条放过。
  // 这类属性只强制其中的颜色令牌化，宽度/偏移不强制（母版惯例允许 1px 细线）。
  if (/^(border|border-(top|right|bottom|left)|outline|box-shadow|text-shadow|text-decoration)$/.test(prop)) return 'shorthand';
  if (/^font(-family)?$/.test(prop)) return 'font';
  return null;
}

// 剥掉 calc(...) 整段（支持嵌套括号，如 calc(var(--x) * 2)），返回剩余文本 + 每个 calc 的内层内容。
// 不能用 /calc\(([^()]*)\)/g —— var() 自带括号，简单正则匹配不到，calc 仍会被切词误杀。
function peelCalc(value) {
  const s = String(value);
  const bodies = [];
  let out = '';
  let i = 0;
  while (i < s.length) {
    const m = /calc\s*\(/i.exec(s.slice(i));
    if (!m) { out += s.slice(i); break; }
    const start = i + m.index;
    out += s.slice(i, start);
    let depth = 0;
    let j = start + m[0].length - 1;          // 指向 '('
    for (; j < s.length; j++) {
      if (s[j] === '(') depth++;
      else if (s[j] === ')' && --depth === 0) break;
    }
    if (j >= s.length) { out += s.slice(start); break; }   // 未闭合，原样保留交给后面的裸值检查
    bodies.push(s.slice(start + m[0].length, j));
    out += '§CALC§';
    i = j + 1;
  }
  return { stripped: out, bodies };
}

// 把一个声明值切成「词」，判断每个词是否合规。值可能是 `var(--fs-10)`、`calc(...)`、多值简写。
function checkValue({ prop, value, sel }, family, tokenNames, errors) {
  const original = value;
  value = String(value).replace(/\s*!important\s*$/i, '');   // !important 不参与令牌判定，避免误报成裸值
  const where = `${sel} { ${prop}: ${original}; }`;
  const fail = (why) => errors.push(`${where} —— ${why}`);

  // 任意 var() 引用的令牌都必须存在（防拼错令牌名静默失效）
  for (const m of value.matchAll(/var\(\s*(--[\w-]+)/g)) {
    if (!tokenNames.has(m[1])) fail(`引用了不存在的令牌 ${m[1]}`);
  }

  if (!family) return;                       // 布局属性（display/flex/grid/position…）自由，不查
  if (/^(0|auto|none|inherit|initial|unset)$/i.test(value.trim())) return;
  // 字号只认档位：calc 派生在静态阶段看似合法，出图时却不在 18 档集里 → 单跑绿、出图红。
  if (family === '--fs-' && /calc\s*\(/i.test(value)) { fail('font-size 必须直接使用 var(--fs-*) 档位，不许用 calc 派生'); return; }

  if (family === 'color') {
    if (bareColor(value)) fail(`裸色值要改成色板令牌（如 var(--accent) / var(--ink)）`);
    return;
  }
  if (family === 'font') {
    // font 简写会把字号/行高一起写进来，绕开 --fs-* / --lh-* 档位校验（静态绿、出图红）
    if (/^font$/.test(prop)) { fail('别用 font 简写（字号/行高会绕过档位校验），拆成 font-size / line-height / font-family 分开写'); return; }
    // 字体族必须用字体栈令牌或系统字体栈变量；引号里的字体名（"Songti SC"）只在 :root 允许
    if (/[\"']/.test(value) && !/var\(--(?:serif|sans|mono)\)/.test(value)) fail(`字体族要写 var(--serif) / var(--sans) / var(--mono)，不在页面里指定字体名`);
    return;
  }
  if (family === 'shorthand') {
    // 只查颜色：宽度/偏移不强制（母版惯例允许 1px 细线），transparent 与 var(--*) 放行。
    if (bareColor(value)) fail(`简写属性里的颜色要改成色板令牌（如 var(--line) / var(--accent)），不许写裸色值`);
    return;
  }

  // 尺寸族：每个「词」要么是 var(--<family>)、要么是允许的关键字/数字零；裸 cqw/px/em/% 一律拦
  const sizeFamily = family; // '--fs-' / '--lh-' / '--ls-' / '--radius-' / '--space-'
  // 圆形例外：border-radius:50% / 100% 是「形状」写法（圆点、胶囊端头），不是圆角档位，
  // 与 --radius-* 的尺寸档不在一个维度；只放行这两个精确值，其他裸百分比仍拦。
  const shapeOnly = sizeFamily === '--radius-' && /^(?:50%|100%)$/.test(value.trim());
  if (shapeOnly) return;   // 令牌存在性已在函数开头统一查过，这里不重复
  // calc(...) 整体是一个合法表达式：先剥掉再切词，否则 calc( / * / 2) 会被当裸值。
  // 内层出现写死尺寸（10px / 3cqw）仍然拦；百分比放行——它是相对计算（calc(50% - var(--space-1))
  // 这类胶囊圆角、calc(100% - var(--space-4)) 这类占满减间距），不是绕开档位写死视觉值。
  const { stripped, bodies } = peelCalc(value);
  const bareUnit = /(?<![\w-])\d*\.?\d+(?:px|cqw|em|rem|vw|vh)(?![\w-])/i;
  for (const b of bodies) if (bareUnit.test(b)) fail(`calc 里出现写死的尺寸 "${b.trim()}"——尺寸要由 var(--${sizeFamily.slice(2)}*) 组合，别混裸单位`);
  const parts = stripped.replace(/var\(\s*(--[\w-]+)\s*\)/g, ' §VAR§ ').split(/\s+/).filter(Boolean);
  const varsInValue = [...value.matchAll(/var\(\s*(--[\w-]+)/g)].map((m) => m[1]);
  for (const p of parts) {
    if (p === '§VAR§' || p === '§CALC§') continue;
    if (KEYWORDS.test(p)) continue;
    if (/^0(?:\.0+)?$/.test(p)) continue;
    // 变量存在但族不对也拦
    fail(`${sizeFamily.slice(2, -1)} 族的裸值 "${p}" 要改成 --${sizeFamily.slice(2)}* 的某个档位令牌（见 style.css :root），不许写裸值`);
  }
  for (const v of varsInValue) {
    if (!v.startsWith(sizeFamily)) fail(`${prop} 用了 ${v}，本属性只认 --${sizeFamily.slice(2)}* 档位令牌`);
  }
}

// 主校验：pageCss = 页面 <style> 合并文本；cssText = style.css 全文（拿令牌集合）
export function checkPageCss(pageCss, cssText) {
  const errors = [];
  if (!pageCss || !pageCss.trim()) return { errors, classes: new Set() };
  const tokenNames = collectTokenNames(cssText);
  const decls = scanDeclarations(pageCss);
  for (const d of decls) {
    const family = tokenFamily(d.prop);
    checkValue(d, family, tokenNames, errors);
  }
  return { errors, classes: collectCssClasses(pageCss) };
}
