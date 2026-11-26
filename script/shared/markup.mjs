// markup 结构工具（render.mjs 与 composed.mjs 共用，单源）
// 只做「按标签/属性取字符串片段」的机械解析，不做任何内容判断。
import { ROOT_CLASS } from './canvas.mjs';

// 取画布根：按「class 含根类名」扫 <div> 开标签，返回根开标签 + 内部片段
export function rootOf(body) {
  // 不要求 class 是首个属性，也不要求属性值以根类名开头（合规重排不应误停）
  // 已知边界（低危，当前母版不触发）：正则按 > 收标签，若根标签的属性值里出现裸 > 或注释里写 <div> 示例，会误判
  //   → 母版根标签只写 class/data-size，说明头注释不写 <div> 字面量即可
  let rootTag = null; let openEnd = -1;
  for (const m of body.matchAll(/<div\b[^>]*>/g)) {
    const cls = m[0].match(/\bclass\s*=\s*["']([^"']*)["']/);
    if (cls && cls[1].split(/\s+/).includes(ROOT_CLASS)) { rootTag = m[0]; openEnd = m.index + m[0].length - 1; break; }
  }
  if (!rootTag) throw new Error(`画布根缺失：未找到 class 含 ${ROOT_CLASS} 的 <div>`);
  let depth = 1; const re = /<div\b|<\/div>/g; re.lastIndex = openEnd + 1; let mm; let closeStart = -1;
  while ((mm = re.exec(body))) { depth += mm[0] === '</div>' ? -1 : 1; if (!depth) { closeStart = mm.index; break; } }
  if (depth !== 0) throw new Error('根 div 未配对');
  return { rootTag, inner: body.slice(openEnd + 1, closeStart) };
}

// 把 <style> 块换成哨兵，返回 { masked, restore }。
// 为什么需要：页内 CSS 的注释里常举例写 <img class="x" src="shots/a.png"> 或 .foo{…}，
// 直接对整份 markup 扫 class=/<img> 会把注释当真——报「未定义类名 x」「图片不存在」。
// 用哨兵而不是删除，是为了让 restore 原样还原（CSS 块本身要留给令牌校验）。
export function maskStyleBlocks(html) {
  const blocks = [];
  const masked = String(html).replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, (m) => {
    blocks.push(m);
    return `\u0000STYLE${blocks.length - 1}\u0000`;
  });
  return {
    masked,
    restore: (s) => s.replace(/\u0000STYLE(\d+)\u0000/g, (_, i) => blocks[Number(i)] ?? ''),
  };
}
