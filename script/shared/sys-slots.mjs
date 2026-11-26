// 系统槽契约（data-sys 白名单 + 占位符宿主配对）：render 的注入链路与 composed 的静态校验共用一份。
// 两个入口各写一套的后果已经踩过——CLI 单跑绿、出图红（拼错 data-sys 单跑放行，render 才拦）。
// 品牌三槽由 meta.brand 注入；page-no / progress 由 render 机械生成；
// issue 在白名单内但没有注入通道（母版走 fields，组合页手写文案，留 data-sys 只为编辑器图层）。
const SYS_WHITELIST = new Set(['brand-logo', 'brand-name', 'footer-id', 'issue', 'page-no', 'progress']);
export const SYS_META_KEY = { 'brand-logo': 'logo', 'brand-name': 'name', 'footer-id': 'footer' };

// 机械槽 → 节点内必须出现的占位符。这两个槽的值由 render 生成，占位符是定位锚点。
const SYS_PLACEHOLDER = { 'page-no': '{{page-no}}', progress: '{{progress}}' };

// 扫 markup 里所有 data-sys 节点做白名单校验，返回计数 tally（供 fields 展开与体检）。
// 白名单外的值 = 硬错误（防拼错后静默不填）；同一槽出现多次 = WARN（会全部替换）。
export function scanSysTags(html, label, errors, warns) {
  const tags = [...html.matchAll(/\bdata-sys=(["'])([^"']*)\1/g)].map((m) => m[2]);
  const tally = {};
  for (const v of tags) {
    if (!SYS_WHITELIST.has(v)) errors.push(`${label}: data-sys 白名单外取值 "${v}"（只允许 ${[...SYS_WHITELIST].join('/')}）`);
    tally[v] = (tally[v] || 0) + 1;
  }
  for (const [v, n] of Object.entries(tally)) {
    if (n > 1) warns.push(`${label}: data-sys="${v}" 出现 ${n} 次（>1，将全部替换）`);
  }
  return tally;
}

// 占位符宿主配对：{{page-no}} / {{progress}} 只能写在对应 data-sys 节点内部。
// 挂到别的节点上时注入函数定位不到它，占位符会原样漏进成品（或母版页直接印出来）——
// 在静态阶段就报「挂错位置」，比事后报「{{}} 残留」更能指出真正原因。
// 用「总数 vs 宿主内数」比对，不能只看有没有一个合法宿主：页面本来就有合规节点时，
// 再挂一个孤立的占位符会被 some() 掩盖掉。
export function checkPlaceholderHosts(html, label, errors) {
  for (const [sys, ph] of Object.entries(SYS_PLACEHOLDER)) {
    const total = html.split(ph).length - 1;
    if (!total) continue;
    const re = new RegExp(`<([a-z0-9]+)\\b[^>]*\\bdata-sys=["']${sys}["'][^>]*>([\\s\\S]*?)</\\1>`, 'gi');
    let inside = 0;
    for (const m of html.matchAll(re)) inside += m[2].split(ph).length - 1;
    if (total > inside) {
      errors.push(`${label}: ${ph} 有 ${total - inside} 处未挂在 data-sys="${sys}" 节点内——机械槽的占位符只能放在对应节点里，否则注入定位不到、会原样漏进成品`);
    }
  }
}
