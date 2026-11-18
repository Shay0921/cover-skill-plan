# 机器契约（CONTRACT）

> 风格无关的机器契约：槽位命名、系统槽、图槽、repeat、富文本、字数校验、画布根类。实现以 `script/render.mjs` 为准。

## 1. 槽位

**内容槽三者同名**：文字槽 `{{槽名}}` = `data-layer` id = `plan.json` 的 `fields` 键，英文 kebab-case。`data-label` 是图层面板中文名，不参与键名。

**系统槽**：`data-sys` 取值域五个，`data-layer` 一律 `sys-*`。

| `data-sys` | 值来源 | 写法 |
|---|---|---|
| `brand-logo` / `brand-name` / `footer-id` | `meta.brand` 的 `logo` / `name` / `footer` | 整组统一，一处定义全篇注入，不写逐页 fields；缺键保留母版默认 |
| `issue` | 逐页 `fields.issue` | 每页必填 |
| `page-no` | render 自动生成 | 不填 |

除这五个值外，其余逐页文案都是普通内容槽，不标 `data-sys`。`data-slot` 禁用于文字元素（仅 `<img>`，值恒为 `image`）。

**fields 键规则**：repeat 数组元素内用条目短名（`n/t/d`…），render 克隆时给 `data-layer` 加 `-2/-3` 后缀；图槽值 = 相对任务运行区的路径或 `{src, crop}`。键与条数均以母版说明头与 repeat 注释为准。

**富文本白名单**：值内仅 `span.hl`（蓝字，正文小强调）/ `span.hl-line`（墨字+蓝下划线，标题/金句强调）/ `br` / `strong`，其余标签被拒绝。裸 `<` `>` 是文案（`5>3`、`A < B` 照常出图），只有完整标签形态（`<b>`、`</span>`、带属性的标签）才按标签处理；`a<b>c` 这类字母包夹尖括号本身就是标签形态，写成 `a < b`。

**画布根类 `.artwork-page`**：全库唯一机器锚点——render 抽页、`editor.manifest.json` 的 `root`、截图 selector 三处都认它；母版与即兴页必须用它，不得自造根类名。

## 2. repeat

单元标 `data-repeat="<数组名>"`，单元前注释 `<!-- repeat ×min-max: 克隆规则；条数-字数联动 -->`。单元内占位符用条目键（如 `{{t}}` `{{d}}`）。

容器可打 `data-layer + data-type="group"`（整体可移动）；纯装饰不标 layer。

## 3. 图槽（ph-img）

- 槽位 = `<img class="ph-img__img" data-slot="image" data-layer data-label src="1×1 占位 PNG">`，外层容器带 `.ph-img` + `data-fit`（`cover` 裁切填满 / `contain` 完整显示）。`data-ratio` 写 img 或容器其一，两处都写时 render 优先读 img，同一图槽只写一处。比值用固定常用比集声明（见各风格 `catalog.md`「图槽约定」），异形槽保留实测比。
- 占位是 1×1 PNG（不用 GIF，GIF dataURL 会让打包器整批失败）；容器未填图时显示 `.ph-img__label`，布局与有图一致。
- render 填图后给容器加 `data-filled` → 占位标签隐藏（`.ph-img[data-filled] .ph-img__label{visibility:hidden}`）。编辑器换图同理。
- 手机框是装饰 `<img>`（如 N04 `.phone__frame`），源 = `styles/assets/iphone-frame.png`，render 现场编码内嵌，母版不内嵌框图数据。
- 图片格式 PNG/JPEG/WebP；裁切由 CSS 按 `data-fit` 执行，AI 只在 `plan.json` 写 `crop` 选区：方向 + 百分比（`"下 55%"` 取图的下半 55%、`"left 30%"`）；不写则整图按 `data-fit` 裁切填满。
- **单通道**：只替换 `<img>` 的 `src`，容器不写 `data-img`、CSS 不写 `--img` 变量。
- 图形页无图槽时，链路靠母版内 SVG 绘制：`data-layer` 落在 `<text>` 上、外层 `<g>` 标 `data-type="group"`，编辑器识别为 text/group。这类页不接受换图。
- **母版内 SVG 绘制纪律**：颜色一律走令牌（`fill:var(--accent)` 等，经 class 设、不写死色值，禁第二个强调色）；几何用 viewBox 单位、不写 cqw/px 混排，靠 `preserveAspectRatio="xMidYMid meet"` 由容器等比缩放；箭头用 `<marker>`，线宽 1–1.5、圆角 10；禁渐变、阴影、动画。节点数固定——SVG 没有流式布局，repeat 克隆的节点会全部叠在同一坐标，步数可变的流程必须走 HTML + flex。

## 4. 字数校验

说明头「限制」行是 render 字数软校验的解析对象。

- `≤N字` = 视觉宽度（1 单位 = 一个汉字宽）；`≤N字符` = 实际字符数（ASCII 短槽用），两者不同义。`≤A行每行≤M字/字符` 另含行数与单行约束。各字符类宽度权重与 20% 容差以 `script/render.mjs` 为准（`--font-report` 可实测本机字面，改字体栈后须重测）。
- 机器解析的两种写法：`KEY≤N字/字符`（总量）与 `KEY≤N行每行≤M字/字符`（行数 + 单行）。**括号写法 `KEY≤N字(2行,每行≤M字)` 的每行部分不参与机器校验**，只作文档说明。
- 品牌三值（`plan.meta.brand.*`）与 `issue` 不进字数软校验，超限靠填写方自查与人审。
