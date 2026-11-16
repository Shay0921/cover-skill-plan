# tech-blue · design-system.md

> **tech-blue 风格规范**：气质 / 设计令牌 / 组件语义表 / 图槽与标记契约 / 即兴纪律 / 反例。
> **何时读我**：改风格、写新母版、受控即兴（L3）时必读；日常选型看本目录 catalog.md，填表看母版说明头。
> 与 style.css / templates.html 看板同源同步：改 token 三处一起改。

## 0. 一句话气质

**安静的杂志感科技蓝**：纯白底铺 40px 极淡网格，深墨衬线大标题，全库只有一个强调色 #2563EB——它出现的地方就是重点。等宽小字做标签与页码，像一本排版严谨的技术杂志。

## 1. 设计令牌（与 style.css :root 同源）

| 令牌 | 值 | 语义 |
|---|---|---|
| `--paper` | #FFFFFF | 页面底 |
| `--paper-deep` | #F4F5F7 | 卡片/反差层 |
| `--ink` | #0D1117 | 主标题/核心（近纯黑） |
| `--ink-soft` | #484F58 | 正文/次标题 |
| `--muted` | #8B93A1 | 次要文字 |
| `--dim` | #C5CBD6 | 最弱文字/装饰 |
| `--line` / `--line-strong` | rgba(13,17,23,.07/.14) | 极淡/常规分割线 |
| `--accent` | #2563EB | **唯一强调色**（blue-600） |
| `--accent-deep` | #1D4ED8 | 强调深版 |
| `--ink-bg` / `--ink-paper` | #0D0D12 / #ECECF2 | 深底变体（N30） |
| `--serif` | Noto Serif SC / 宋体族 | 标题（700/900） |
| `--sans` | Noto Sans SC / 雅黑族 | 正文 |
| `--mono` | JetBrains Mono | 标签/页码/代码 |
| 圆角 | .4 / .8 / 1.4cqw 三级 | 徽章 / 卡片 / 窗口 |

字号层级：title-xl 7.2cqw≈78px · title-lg 5.2≈56 · title-md 3.6≈39 · num-large 12≈130 · body 1.9≈21 · label 1.5≈16 · mono 1.4≈15 · big-num 24≈259（N10 加大到 28）。
画布：1080×1440（3:4），边距 6.6cqw≈71px，`.artwork-page` 自带 `container-type:size`（cqw 全库可用、多 section 互不干扰）。

## 2. 画布骨架与共享组件（style.css 共享段词汇表）

| 组件 | 语义 | 用法 |
|---|---|---|
| `.artwork-page` | 画布根 | 每母版唯一；深底加 `.dark`；根上另有 `n<nn>` 标记类与 `data-artwork data-size` |
| `.paper-noise` | 40px 网格底纹 | 装饰，永远第一个子元素 |
| `.brand-top` | 顶部品牌栏（logo 方块 + 品牌名 + 右侧期号） | **风格身份静态件**，不随内容改 |
| `.mega-hero` | 超大数字 Hero（big-num + tag + title + sub） | 封面/清单类页头；`.sub` 全宽副题 |
| `.after-hero` | 2px 墨色粗分割线 | hero 与内容的分界 |
| `.pg-footer` | 底部页码条（域名 + 右侧页码/母版名） | 静态件；页码槽用 `.page-no` |
| `.num-list` | 编号条目列表 | N10/N11 清单骨架 |
| `.img-card` + `.ph-img` | 图片占位卡 | 见 §3 图槽契约 |
| `.callout` | 底部补充说明条（白底细线 + 圆形图标） | 提示/Tip |
| `.pill` / `.pill--fill` | 悬浮胶囊（描边 / 墨底两式，`.num` 是序号位） | 即兴词汇，当前 32 母版未使用。CTA 组合：`<span class="pill"><span class="num">01</span>免费领取</span>`、`<span class="pill pill--fill">立即进入</span>`；可排成一行做「步骤/权益」横条 |
| `.fine-line` / `.fine-border` / `.fine-card` | 极细分割线/边框/卡片 | 弱结构 |
| `.accent-word` / `.accent-bg` / `.accent-line` / `.ink-bg` | 强调四式 | 关键词变色 / 蓝底白字 / 短横线 / 墨底白字 |
| `.hl` | 富文本高亮（白名单） | 通用=变蓝；N01/N28/N30 的块状 .hl 在各自作用域 |
| `.title-xl/lg/md`、`.num-large`、`.body-text`、`.mono-text`、`.label` | 字级工具类 | 即兴时直接用 |

> **本表是共享段词表，不是 32 母版用量的镜像。** 表里有、当前母版没用的类（`.pill`、`.title-xl`、`.accent-bg`、`.ink-bg`、`.fine-card` 等）是**刻意保留的 L3 即兴词汇**：能组合出母版没覆盖的版式，且已在 style.css 里有实现。判断"能不能删"只有两条——① 不在本表也不在任何说明头 → 死代码该删；② 在本表 → 删了就等于收回即兴能力，不能当冗余清理。

## 3. 图槽契约（ph-img 机制）

- 槽位 = `<img class="ph-img__img" data-slot="image" data-layer data-label src="1×1 占位 PNG">`，外层容器带 `.ph-img` + `data-fit`（**cover** 裁切填满 / **contain** 完整显示）。`data-ratio`（槽位比例声明）写 img 或容器任写其一、render 都认，但**同一图槽只写一处**（两处都写时 render 优先读 img）。
- 占位是 1×1 PNG（**不是 GIF**：GIF dataURL 会让打包器整批失败），容器此时显示占位标签（`.ph-img__label`），布局与有图完全一致；render/编辑器换图直接改 img 的 src。
- render 填图后给容器加 `data-filled` → 占位标签自动隐藏（`.ph-img[data-filled] .ph-img__label{visibility:hidden}`）。
- 手机框：`frame-img` 类装饰 `<img>`（如 N04 `.phone__frame`），源 = `styles/assets/iphone-frame.png`（render 现场编码内嵌；画廊以 `../assets/` 直接引用），母版不内嵌框图数据。
- 图片格式 PNG/JPEG/WebP；裁切由 CSS 机械执行，AI 只在 plan.json 写 `crop` 选区描述。
- **单通道**：只有「替换 `<img>` 的 src」一条路径；容器不写 `data-img`、CSS 不写 `--img` 变量。`data-fit` 是真生效的 CSS（cover/contain），保留。

## 4. 槽位与 repeat 契约

- **三处同名**：文字槽 `{{槽名}}` = `data-layer` id = plan.json 的 fields 键（英文 kebab-case；`data-label` 是图层面板中文名，不参与键名）。**data-slot 禁用于文字元素**（仅 `<img>`，值恒为 "image"）。
- 文字元素**不打 data-slot**（编辑器契约：data-slot="image" 仅落 `<img>`）。
- 容器可打 `data-layer + data-type="group"`（可整体移动）；纯装饰不标 layer。
- **repeat**：单元标 `data-repeat="<数组名>"`，单元前注释 `<!-- repeat ×min-max: 克隆规则；条数-字数联动 -->`（全库唯一数值配置点）；单元内占位符用条目键（如 `{{t}}` `{{d}}`），render 克隆时给 data-layer 加序号后缀。
- 富文本白名单：值内仅 `span.hl` / `br` / `strong`；其余标签会被拒绝。裸 `<` `>` 是文案（`5>3`、`A < B`），render 注入前转义，不算标签。
- 就地限制：说明头"限制"行是 render 字数软校验的解析对象，写实测值。`≤N字` 按视觉宽度（1 = 一个汉字宽，英文大写 0.68 / 小写 0.55 / 数字 0.58 / 半角标点 0.45，逐项 ≥ 本机实测上限），`≤N字符` 按实际字符个数（ASCII 短槽用）；`code≤2行每行≤30字符` 这类写法会校验行数与单行。

## 5. 受控即兴纪律（L3）

- 只用 style.css **既有类**组合整页；根结构照抄：`.artwork-page.n<nn>` + `.paper-noise` + `.brand-top` + 内容 + `.pg-footer`。
- **禁**：内联样式、自造 CSS 变量、新类名、`<style>`、vh/vw、position:fixed、@media、动画/过渡。
- cqw 优先于 px（画布内自适应）；间距用 0.4/0.8/1.4/2/3/6.6 的既有节奏。
- 版式自适应用 flex/grid 弹性（`flex:1` 均分），不做固定高度堆叠。
- 即兴页 layout 登记 `custom/<语义名>`，过形态校验；几何体检需显式 `--check-geometry`（仅 custom 页）；同名 custom 累计 ≥2 次走转正管道（SKILL.md「受控即兴与转正」）。

## 6. 反例（这条街别这么走）

- ❌ 引入第二个强调色（红/绿/紫）——本风格的克制感全靠"只有蓝"。
- ❌ 圆角滥用（卡片一律大圆角）——本风格是直角+极细线，圆角只按三级令牌。
- ❌ 用无衬线粗体当大标题——标题必须是衬线（`--serif`）。
- ❌ 把 brand-top / pg-footer 当内容改——那是风格身份件；页码用 `.page-no` 槽。
- ❌ 图槽塞 `<div style="background:url()">`——必须走 `<img data-slot="image">`。背景图既不是编辑器图层（换不了图），render 也认不出图槽（plan 图键报「与母版槽位对不上」）。
- ❌ 把**机器配置值**写进 catalog——`repeat ×min-max`、每槽 `≤N字` 精确限值只在母版注释；catalog 只写选型判断用的量级语义（如「适合 3-8 条」「标题两行内」）。
- ❌ 内容迁就版式大改文案——回炉内容提炼，不是即兴能解决的事。

## 7. 文件与字体

- 风格目录构成见 `styles/style-picker.md`（全库唯一权威定义）；其中 `style-preview.png` 的产出时机与是否必交也在该文件，本节不复述。共享资产在 `styles/assets/`，不属于任何单个风格目录。
- 字体：默认本机字体栈，`style.css` 不引 CDN / 不加载 webfont；`--serif/--sans/--mono` 首项为本机字体名，命中即用、未装按栈回退。画廊、交付页与编辑器导出字形一致（编辑器导出 PNG 只认本机已装字体与 base64 内嵌）。
