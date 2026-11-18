# 自绘图形规范（Figure Guide）

跨风格通用机制：AI 写图形 HTML → `script/figure.mjs` 渲染成 PNG → 当普通图片填进图槽。风格专属的字号档、圆角、令牌取值见各风格 `design-system.md`；与代码冲突时以 `script/figure.mjs` 为准。什么时候该自绘、什么时候用截图或生图，见 `IMAGE-WORKFLOW.md`。

## 什么时候用

母版内 SVG 只画固定步数的整齐结构。多轨、分支汇合、矩阵这类写不死的形状，按本页内容现画 HTML → 出 PNG → 当普通图片塞进图槽。母版与出图链零改动。反向判据与红线见 `IMAGE-WORKFLOW.md`「路径②」。

## 流程

文件写 `runs/<任务>/figures/<名>.html`，与 `plan.json` 同级；风格目录不放图形样板。

```
node script/figure.mjs <任务运行区>/figures/<名>.html <任务运行区>/assets/<名>.png --style=<风格>
```

- **图形先于 plan 出发，且先定风格**：`--style` 必传（风格名或 style.css 路径，同级无 `style.css` 时不给就报错）；解析不到令牌拒绝出图。
- **自画代价**：文字变像素、交付后不能改字。

## 通用纪律

- **令牌单源**：禁写颜色/字体字面量，只用 `var(--token)`；引用当前风格未声明的令牌直接报错退出。具体令牌清单见该风格 design-system，不假设跨风格同名。
- **字号写 px 档**：图形页无 container，cqw 不可用。具体档位见该风格 design-system「自绘图形」节。
- **画布**：尺寸写死 px，`--width` / `--height` 可覆盖（脚本默认 1600×1200）；输出 `dsf=2`（产物 = 画布 × 2），低于 2 细线发虚。
- **安全区**：横向各留 10%；顶部留角标位（48–60px）。图槽按容器盒形裁切，贴边内容会被切（机制见 `CONTRACT.md`「图槽」）——画布按目标图槽的 `data-ratio` 定比例，别画完才发现和槽对不上（看图与比例判据见 `IMAGE-WORKFLOW.md`「看图与裁图纪律」）。
- **禁**：`<script>`、外链、渐变、阴影、动画、第二个强调色。
