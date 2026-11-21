# 机器契约（CONTRACT）

> 风格无关的机器契约：槽位命名、系统槽、图槽、repeat、富文本、字数校验、画布根类、即兴页。**只写 AI 与母版必须遵守的语义，不复述脚本实现**；与 `script/render.mjs` 冲突时以代码为准。

## 1. 槽位

**填 plan 认三个锚点**：文字槽的 `fields` 键 = 母版里的 `{{占位符}}` 名；图槽的 `fields` 键 = `<img>` 的 `data-layer` 名（图槽没有占位符）；坐标槽的 `fields` 键 = 元素上的 `data-pin` 名。三者都是英文 kebab-case。

`data-layer` 是编辑器图层 id，与占位符**不必同名**——repeat 单元内改用条目短名（`{{t}}` ↔ `tool-t`），顶层也有带母版前缀的逐页槽（`{{btn-1}}` ↔ `data-layer="n02-btn-1"`）。所以**不要按 `data-layer` 猜键名**，以说明头「槽位」行与模板里的 `{{}}` 为准。`data-label` 是图层面板中文名，不参与键名。

**系统槽**：`data-sys` 取值域六个，`data-layer` 一律 `sys-*`。

| `data-sys` | 值来源 | 写法 |
|---|---|---|
| `brand-logo` / `brand-name` / `footer-id` | `meta.brand` 的 `logo` / `name` / `footer` | 整组统一，一处定义全篇注入，不写逐页 fields；缺键保留母版默认 |
| `issue` | 逐页 `fields.issue` | 每页必填 |
| `page-no` | 按页序机械生成：`nn / 总页数`（总页数 = plan 的 pages 条数，两位补零）；封面页（首页）注入隐藏但图层保留 | 不填 |
| `progress` | 按本页 `data-rand-done` 勾选数机械生成：`done/total`（勾选为确定性伪随机，seed 混入页号，同 plan 重渲结果恒定） | 不填 |

除这六个值外，其余逐页文案都是普通内容槽，不标 `data-sys`。`data-slot` 禁用于文字元素（仅 `<img>`，值恒为 `image`）。机器勾选只发 `data-done` 属性、不认类名——勾选视觉由各风格 CSS 按属性选择器实现。

**fields 键规则**：repeat 数组元素内用条目短名（`n/t/d`…），克隆体的 `data-layer` 带 `-2/-3` 后缀；图槽值 = 相对任务运行区的路径或 `{src, crop}`；坐标槽值 = `{x, y}`（目标点百分比，参照系见「坐标槽」一节，可选）。键与条数均以母版说明头与 repeat 注释为准。

**plan 填写行为（全部硬校验即停，机器不猜不补）**：fields 键与母版槽位对不上（报错点名占位符）、必填槽缺失或空值、repeat 数组为空、图槽路径不存在、图片扩展名与实际内容不符、坐标槽非 `{x,y}` 对象或 x/y 非数值、markup 残留 `{{`——任一命中即停，改 plan 重跑。坐标越界只钳制并 WARN，不即停。**例外**：母版节点标 `data-optional` 的槽（如 big-num / step-num 大数字）允许留空（填 `""`）——占位符清空后节点变空，由各风格 CSS `:empty` 规则自动隐藏，供「数量不是主角」的轻量标题页使用（判据见各风格 design-system「大数字的去留」）。

**富文本白名单**：值内仅 `span.hl`（蓝字，正文小强调）/ `span.hl-line`（蓝字+淡蓝下划线，标题/金句强调）/ `br` / `strong`，其余标签被拒绝。裸 `<` `>` 按文案处理（`5>3`、`A < B` 照常出图），只有完整标签形态（`<b>`、`</span>`、带属性的标签）才算标签；`a<b>c` 这类字母紧贴尖括号的写法会被识别成标签，写成 `a < b`。

**画布根类 `.artwork-page`**：全库唯一机器锚点，母版与即兴页必须用它，不得自造根类名。

## 2. repeat

单元标 `data-repeat="<数组名>"`，单元前注释 `<!-- repeat ×min-max: 克隆规则；条数-字数联动 -->`。单元内占位符用条目键（如 `{{t}}` `{{d}}`）。

容器可打 `data-layer + data-type="group"`（整体可移动）；纯装饰不标 layer。

## 3. 图槽（ph-img）

- 槽位 = `<img class="ph-img__img" data-slot="image" data-layer data-label src="1×1 占位 PNG">`，外层容器带 `.ph-img` + `data-fit`（`cover` 裁切填满 / `contain` 完整显示）。`data-ratio` 写 img 或容器其一，两处都写时以 img 为准，同一图槽只写一处。比值用固定常用比集声明（见各风格 `catalog.md`「图槽约定」），异形槽保留实测比。
- 占位用 1×1 PNG，不用 GIF；容器未填图时显示 `.ph-img__label`，布局与有图一致。
- 手机框是装饰 `<img>`（N04 实物 `class="n04-phone__frame frame-img"`），**机器按 class 含 `frame-img` 识别**并单源注入 `styles/assets/iphone-frame.png`，母版不内嵌框图数据；新母版要手机框必须带 `frame-img` 类，只写样式类名不会被注入。
- 图片格式 PNG/JPEG/WebP；裁切按 `data-fit` 执行，AI 只在 `plan.json` 写 `crop` 选区：方位词 + 百分比，值域 `上/下/左/右/中` 与 `top/bottom/left/right/center` + `N%`（5–99）——**「中」与 `center` 不是同义词**：「中」= 垂直居中的横条带（裁高度方向），`center` = 水平居中的竖条带（裁宽度方向），不同槽比例下两者可见区不同。「下 N%」= 保留图的底部 N%。不写则整图按 `data-fit` 裁切填满。**叠加模型**：`crop` 先把 img 放大成条带（如「下 55%」→ 高 181.8% 贴底），`object-fit:cover` 再在这个放大盒内二次适配裁切——写方位要针对**裁后净可见区**判断，不是原图整体；方位组合拿不准时以出图实测为准。裁切引擎是**中心/方位盲裁**——代码不做主体识别或显著度检测，主体位置由 AI 看图判断后落方位词（判据见 `IMAGE-WORKFLOW.md`「看图与裁图纪律」）；图槽与文案的语义对齐也在该文件核对。`crop` 只应配 **cover** 槽；`contain` 槽**禁止写 crop**——机器不拦截、会被同样注入并破坏整图显示。
- **预裁素材**：文件级比例校验读的是**原图尺寸**，plan 里的 `crop` 不参与该比对。图与槽 `data-ratio` 差很多（盒形/比例 WARN）时，在运行区按目标比例**预裁出新素材文件**再写进 plan（原图保留、预裁件只落运行区、不进交付），不靠拉伸或改版式迁就图。预裁属于素材准备，交付页仍由 CSS 按 `data-fit` 收尾裁切。
- **单通道**：只替换 `<img>` 的 `src`，容器不写 `data-img`、CSS 不写 `--img` 变量。手写 `markup` 内嵌图片时须给容器补 `data-filled`，否则占位标签与图叠在一起。
- 图形页无图槽时，链路靠母版内 SVG 绘制：`data-layer` 落在 `<text>` 上、外层 `<g>` 标 `data-type="group"`，编辑器识别为 text/group。这类页不接受换图。
- **母版内 SVG 绘制纪律**：颜色一律走令牌（`fill:var(--accent)` 等，经 class 设、不写死色值，禁第二个强调色）；几何用 viewBox 单位、不写 cqw/px 混排，靠 `preserveAspectRatio="xMidYMid meet"` 由容器等比缩放；箭头用 `<marker>`，线宽 1–1.5、圆角 10；禁渐变、阴影、动画。节点数固定——SVG 没有流式布局，repeat 克隆的节点会全部叠在同一坐标，步数可变的流程必须走 HTML + flex。

**坐标槽（data-pin）**：钉位可配的母版（N40 浮动标注、N22 标注截图）在目标元素上标 `data-pin="<fields 键>"`，plan 传 `{x, y}` = **要标注的目标点**百分比坐标（0-100，x 从左到右、y 从上到下；AI 看图直接给点，无需手算）。参照系由母版 markup 上的 `data-pin-frame` 声明，render 不认母版名：
- **stage**（N40，默认）：`{x,y}` = 手机内屏截图内功能点位置。render 只算几何：注入 `--pin-x/--pin-y`（换算后的 stage 坐标变量，本母版卡片仅用 y）与 `data-side`（点在左半 → left，右半 → right），呈现形态由母版 CSS 决定——卡片贴同侧外缘、纵向对齐目标点，卡片始终在手机两侧空白，不遮挡截图。同侧两卡的 y 须拉开间隔（标注卡高约 15cqw）：**同侧 y 间距 <18% 机器 WARN（卡片可能重叠）**——消解靠拉开 y 或把其中一张换侧（x 改 ≥50 到右侧 / <50 到左侧，x 值本身不参与呈现、只定侧）；y<10 或 >90 机器 WARN（卡片可能溢出舞台）。
- **percent**（N22）：`{x,y}` = 截图框内目标点位置，render 直接注入 `left/top` 百分比 + transform 居中，钉子中心落在给点上；无变量、无 side。
**可选槽**：不传坐标则保留母版默认钉位，不算缺槽；仅母版页有效，custom 页不走坐标注入。repeat 单元内的坐标槽按克隆后缀在 plan 顶层传（`note-pos`、`note-pos-2`…）；部分条目传、部分不传机器 WARN（钉位形态会不一致）。截图按 `cover` 填入，源图比例明显偏离槽比例时按实际可见区给坐标。

## 4. 字数校验

说明头「限制」行是机器字数校验的解析对象。

- `≤N字` = 视觉宽度（1 单位 = 一个汉字宽）；`≤N字符` = 实际字符数（ASCII 短槽用），两者不同义。`≤A行每行≤M字/字符` 另含行数与单行约束。ASCII 各字符类的宽度权重按实际命中字体查 `script/font-weights.json`；超限在 20% 容差内的不告警。
- 机器解析的两种写法：`KEY≤N字/字符`（总量）与 `KEY≤N行每行≤M字/字符`（行数 + 单行）。**括号写法 `KEY≤N字(2行,每行≤M字)` 的每行部分不参与机器校验**，只作文档说明。
- 品牌三值（`plan.meta.brand.*`）不在 `fields` 里，不进字数软校验，超限靠填写方自查与人审。`issue` 是普通逐页槽（各母版以 `issue≤14字` 声明），照常校验。

## 5. custom 页（即兴页）

`layout` 以 `custom/<语义名>` 开头的页不走母版：整页 HTML 写在 plan 的 `markup` 字段（从最贴近的母版抄骨架改），**不做槽位填充**。机器语义七条，分三档：

**硬停（1–4，命中即停）**

1. `markup` 必填；根节点必须为 `.artwork-page` + `data-artwork` + `data-size="1080x1440"`（根类三件套）。
2. `markup` 内 `{{` 残留即停——文案直接写死，不留占位符。
3. `data-layer` 页内唯一，重复即停。
4. 禁区属性（大小写不敏感，命中即停）：① 布局劫持 `position:fixed` / `@media`；② 脚本与动画标签 `<script>` / `<animate>` 及 SVG 同类 `<animateMotion>` / `<animateTransform>` / `<set>`（含闭合标签与大小写变体）；③ 动效 CSS `animation:` / `transition:`。内联样式、自造类名与 CSS 变量机器不拦，属违规，靠人审把关。

**WARN（5，不停）**

5. `fields` 对 custom 页无效：非空只 WARN 不填充，也不转写进 fields.json（页面里没有这些槽，不记假值）。

**不自动检查（6–7：6 靠人审 / 7 需显式 flag）**

6. 图片不收集素材：`<img src>` 直接 base64 内嵌，容器补 `data-filled` 或删占位标签节点——机器不查，靠人审把关。
7. 几何体检只对 custom 页生效，且需显式 `--check-geometry`；不传该 flag 不体检。

操作路径（何时用、怎么抄、能借什么组件、三条硬约束之外的纪律）见 `styles/improvisation.md`；本节只登记机器语义。

