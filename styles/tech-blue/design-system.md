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
| `--mono` | JetBrains Mono + 黑体族回退 | 标签/页码/代码/等宽原文（含中文时汉字走回退） |
| 圆角 | .4 / .8 / 1.4cqw 三级 | 徽章 / 卡片 / 窗口 |

字号层级：title-xl 9.94cqw≈107px · title-lg 7.18≈78 · title-md 4.9≈53 · num-large 12.96≈140 · body 2.51≈27 · label 1.98≈21 · mono 1.85≈20 · big-num 25.92≈280（N10 加大到 30.24）。
画布：1080×1440（3:4），边距 6.6cqw≈71px，`.artwork-page` 自带 `container-type:size`（cqw 全库可用、多 section 互不干扰）。

## 2. 画布骨架与共享组件（style.css 共享段词汇表）

| 组件 | 语义 | 用法 |
|---|---|---|
| `.artwork-page` | 画布根 | 每母版唯一；深底加 `.dark`；根上另有 `n<nn>` 标记类与 `data-artwork data-size` |
| `.paper-noise` | 40px 网格底纹 | 装饰，永远第一个子元素 |
| `.brand-top` | 顶部品牌栏（logo 方块 + 品牌名 + 右侧期号） | **风格身份件，meta 可配置**：logo 字/品牌名由 `plan.meta.brand.*` 整组注入（`data-sys="brand-logo"/"brand-name"`），期号按页填 `issue`（`data-sys="issue"`）；见动态槽位规范。**篇幅：logo ≤2 字符、品牌名 ≤12 字** |
| `.mega-hero` | 超大数字 Hero（big-num + tag + title + sub） | 封面/清单类页头；`.sub` 全宽副题 |
| `.after-hero` | 2px 墨色粗分割线 | hero 与内容的分界 |
| `.pg-footer` | 底部页码条（署名 + 内联脚注 + 右侧页码） | 左侧署名由 `meta.brand.footer` 注入（`data-sys="footer-id"`）；右侧页码由 render 机械生成（`data-sys="page-no"`，封面隐藏），见动态槽位规范。**篇幅：署名 ≤24 字；页码固定 7 字符**（`nn / 总页数`，三位数页数才 8），由 render 生成、不设限值 |
| `.pg-footer .foot-note` | 页脚内联脚注（仅 N13/N26 使用） | 内容槽 `data-layer="foot-note"`（plan 逐页填）；`margin-left:auto` 贴右、与页码留 4.5cqw，**页码仍在最右端**。⚠️ 不得把 `.page-no` 类复用给脚注——那会顶掉页码位；脚注与页码是页脚里的两个独立元素 |
| `.num-list` | 编号条目列表 | N10/N11 清单骨架 |
| `.img-card` + `.ph-img` | 图片占位卡 | 见 §3 图槽契约 |
| `.callout` | 底部补充说明条（白底细线 + 圆形图标） | 提示/Tip |
| `.pill` / `.pill--fill` | 悬浮胶囊（描边 / 墨底两式，`.num` 是序号位） | 即兴词汇，当前母版未使用。CTA 组合：`<span class="pill"><span class="num">01</span>免费领取</span>`、`<span class="pill pill--fill">立即进入</span>`；可排成一行做「步骤/权益」横条 |
| `.fine-line` / `.fine-border` / `.fine-card` | 极细分割线/边框/卡片 | 弱结构 |
| `.accent-word` / `.accent-bg` / `.accent-line` / `.ink-bg` | 强调四式 | 关键词变色 / 蓝底白字 / 短横线 / 墨底白字 |
| `.hl` | 富文本高亮（白名单） | 通用=变蓝；N01/N28/N30 的块状 .hl 在各自作用域 |
| `.title-xl/lg/md`、`.num-large`、`.body-text`、`.mono-text`、`.label` | 字级工具类 | 即兴时直接用 |

> **本表是共享段词表，不是母版用量的镜像。** 表里有、当前母版没用的类（`.pill`、`.title-xl`、`.accent-bg`、`.ink-bg`、`.fine-card` 等）是**刻意保留的 L3 即兴词汇**：能组合出母版没覆盖的版式，且已在 style.css 里有实现。判断"能不能删"只有两条——① 不在本表也不在任何说明头 → 死代码该删；② 在本表 → 删了就等于收回即兴能力，不能当冗余清理。

> **专属段类要覆盖共享段属性，必须带共享段前缀。** 共享段规则多是「父类 + 子类」两段（`.brand-top .right` 特异性 0,2,0），专属段若写单类（`.n26-limited` 0,1,0）就会被压掉——写好的 `color` 永不生效，且不报错、只能靠肉眼发现。要覆盖就补前缀，写成 `.brand-top .right.n26-limited`。已知事故：N26 限时胶囊的 `color:var(--accent)` 自建库起从未生效，胶囊一直是灰字蓝框（2026-11-16 修）。

> **品牌三槽的篇幅上限怎么用**：`.brand-top` 的 logo/品牌名与 `.pg-footer` 的署名来自 `meta.brand`，不进 render 字数软校验（原因见动态槽位规范「A 类为什么不做机器校验」）——超限不报错，靠填写方自查 + 人审把关。表中数字按**本风格栏宽实测**标定（13 字品牌名、26 字符署名仍单行，各留边际），换风格须按自己栏宽重测，**不要跨风格沿用**。

## 3. 图槽契约（ph-img 机制）

- 槽位 = `<img class="ph-img__img" data-slot="image" data-layer data-label src="1×1 占位 PNG">`，外层容器带 `.ph-img` + `data-fit`（**cover** 裁切填满 / **contain** 完整显示）。`data-ratio`（槽位比例声明）写 img 或容器任写其一、render 都认，但**同一图槽只写一处**（两处都写时 render 优先读 img）。比值按**固定常用比集**声明（比集与写入口径的唯一权威 = catalog.md「图槽约定」——图槽按 data-fit 裁切填满、不拉伸，比例声明只服务选图判断，盒形零头偏差由裁切吸收），异形槽保留实测比。
- 占位是 1×1 PNG（**不是 GIF**：GIF dataURL 会让打包器整批失败），容器此时显示占位标签（`.ph-img__label`），布局与有图完全一致；render/编辑器换图直接改 img 的 src。
- render 填图后给容器加 `data-filled` → 占位标签自动隐藏（`.ph-img[data-filled] .ph-img__label{visibility:hidden}`）。
- 手机框：`frame-img` 类装饰 `<img>`（如 N04 `.phone__frame`），源 = `styles/assets/iphone-frame.png`（render 现场编码内嵌；画廊以 `../assets/` 直接引用），母版不内嵌框图数据。
- 图片格式 PNG/JPEG/WebP；裁切由 CSS 机械执行，AI 只在 plan.json 写 `crop` 选区描述。
- **单通道**：只有「替换 `<img>` 的 src」一条路径；容器不写 `data-img`、CSS 不写 `--img` 变量。`data-fit` 是真生效的 CSS（cover/contain），保留。
- **图形页没有图槽**（N33）：流程链路由母版内 SVG 直接绘制，节点文字是普通文字槽——`data-layer` 落在 `<text>` 上、外层 `<g>` 标 `data-type="group"`，编辑器扫图层时识别为 text/group（实测 23 层全可选中）。这类页**不接受换图**，把截图塞进来属误用。
- **SVG 绘制纪律**：颜色一律走令牌（`fill:var(--accent)` 等，经 class 设、不写死色值，禁第二个强调色）；几何用 viewBox 单位、不写 cqw/px 混排，靠 `preserveAspectRatio="xMidYMid meet"` 由容器等比缩放；箭头用 `<marker>`，线宽 1–1.5、圆角 10 与卡片体系对齐；**禁渐变、阴影、动画**（同 §6 反例）。节点数固定——SVG 没有流式布局，`repeat` 克隆的节点会全部叠在同一坐标（实测结论，克隆体共用同一 markup 且 SVG 无流式布局模型），步数可变的流程必须走 HTML + flex。

### 3.1 自绘图形（`figure.mjs` 出 PNG 走图槽 · **不设样板库**）

母版内 SVG 只能画「固定 N 步的整齐结构」。多轨、分支汇合、矩阵这类形状预先写不死的图，走另一条：**按这页内容现画一张 HTML → `script/figure.mjs` 出 PNG → 落 `assets/` → 当普通图片塞进任意图槽**。render 零改动，母版一行不用改。

**文件在哪**：`runs/<任务>/figures/<名>.html`，与 `plan.json` 同级、随运行区留档。**风格目录里不放图形样板**——一段固定内容的 HTML 指不出"下一张该改什么"，放进去只会被当成可复用资产；真正可复用的是本节规则 + `style.css` 令牌 + `templates.html` 的画廊词汇（卡片 / 细线 / mono 标签 / 衬线标题的写法）。每次画图 = 读这三样 + 这页的内容，从零写一份。

- **什么时候走这条**：形状写不死（多轨 / 分支汇合 / 矩阵）→ 现画；固定 3/4/5 步线性、且文字交付后还要改 → 图形母版（N33）。判据同 SKILL.md「截图 vs 图形」。
- **顺序先于一切**：先定风格（SKILL 第 1 步）→ 再画图。`figure.mjs` 必须拿到 `--style=<风格>`（或文件同目录有 style.css），解析不到就**拒绝出图**（没有令牌的图等于没上色）。
- **令牌单源**：禁写颜色/字体字面量，只用 `var(--token)`；引用本风格未声明的令牌**直接报错退出**（否则 `var()` 取空会静默变透明，出图只是"变丑"）。可用令牌 = 本风格 `:root` 声明的那些，常用：`--paper` / `--paper-deep` / `--ink` / `--ink-soft` / `--muted` / `--accent` / `--line` / `--line-strong` / `--serif` / `--sans` / `--mono`。**不要假设别的风格同名**——paper-journal 就没有 `--paper-deep` / `--ink-soft` / `--mono`。
- **字号必须写 px 档**：图形页是独立页面、**没有 container**，`cqw` 不可用（母版那套 9.94cqw≈107 的字阶搬不过来）。本风格的图形字号档（与母版字号同比例标定）：

  | 用途 | 字号 | 字体 / 处理 |
  |---|---|---|
  | 版头小字（左上/右上说明） | 21 | mono，字距 .14em，`--ink-soft` / `--muted` |
  | 轨 / 分组标签 | 26 | sans 700，前缀编号用 mono 20 |
  | 组内小标签（英文短词） | 18 | mono，字距 .12em，`--accent` |
  | 节点标题 | 39–41 | serif 700，行高 1.15 |
  | 说明句 | 26 | sans，行高 1.2，`--ink-soft` |
  | 汇总条（深底反白） | 31 | sans，`--paper` 字色 |
  | 序号圆 | 18 | mono，43px 圆、1.5px 描边 |

- **画布**：尺寸写死 px（图形不是流式版面），不写 cqw。默认 1500×1000（3:2）。
- **安全区**：横向各留 10%（x=150..1350 / 1500）、顶部留 48–60px 给 `img-tag` 角标。图槽 `cover` 按容器**真实**盒形裁切，而 `data-ratio` 只是手写声明：`.n19-hero-img` 是 `flex:1`，实测 937.5×754.7 = **1.242**，声明却写 3:2 → 横向裁掉约 17%。图形贴边必被切。
- **线宽与圆角**：细线 1px（`--line` / `--line-strong`）、卡片 1px 边框 + 圆角 14、序号圆 1.5px 描边；与 N33 的 rx 10 同级，不超 14。箭头用 CSS 三角或 `<marker>`，三角 5×7。
- **输出**：`dsf=2`（细线不发虚），产物尺寸 = 画布 × 2。
- **禁**：`<script>`、外链、渐变/阴影/动画、第二个强调色（同 §6）。

## 4. 槽位与 repeat 契约

- **内容槽三者同名**：文字槽 `{{槽名}}` = `data-layer` id = plan.json 的 fields 键（英文 kebab-case；`data-label` 是图层面板中文名，不参与键名）。**系统槽不套这条**：`data-layer` 一律 `sys-*`，A 类无占位符、值来自 `plan.meta.brand`，B/C 类占位符与 plan 键同名但 layer 带前缀；`data-sys` 取值域（`brand-logo` / `brand-name` / `footer-id` / `issue` / `page-no` 五值）与注入行为以 `script/render.mjs` 实现为准。**data-slot 禁用于文字元素**（仅 `<img>`，值恒为 "image"）。
- 文字元素**不打 data-slot**（编辑器契约：data-slot="image" 仅落 `<img>`）。
- 容器可打 `data-layer + data-type="group"`（可整体移动）；纯装饰不标 layer。
- **repeat**：单元标 `data-repeat="<数组名>"`，单元前注释 `<!-- repeat ×min-max: 克隆规则；条数-字数联动 -->`（全库唯一数值配置点）；单元内占位符用条目键（如 `{{t}}` `{{d}}`），render 克隆时给 data-layer 加序号后缀。
- 富文本白名单：值内仅 `span.hl` / `br` / `strong`；其余标签会被拒绝。裸 `<` `>` 是文案（`5>3`、`A < B`），render 注入前转义，不算标签。
- 就地限制：说明头"限制"行是 render 字数软校验的解析对象，写实测值。`≤N字` = 视觉宽度（1 = 一个汉字宽），`≤N字符` = 实际字符个数（ASCII 短槽用），两者不同义；各字符类的宽度权重与 20% 容差以 `script/render.mjs` 实现为准（`--font-report` 可实测本机字面，改字体栈后须重测）；`code≤2行每行≤30字符` 这类写法会校验行数与单行。

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
- ❌ 在 plan 里用 per-page `fields` 逐页填品牌名/logo/页脚署名——它们是整组统一的风格身份件，走顶层 `plan.meta.brand.*`（一处定义、全篇注入）；期号 `issue` 才是逐页槽。页码禁止手填，由 render 机械生成。
- ❌ 图槽塞 `<div style="background:url()">`——必须走 `<img data-slot="image">`。背景图既不是编辑器图层（换不了图），render 也认不出图槽（plan 图键报「与母版槽位对不上」）。
- ❌ 把**机器配置值**写进 catalog——`repeat ×min-max`、每槽 `≤N字` 精确限值只在母版注释；catalog 只写选型判断用的量级语义（如「适合 3-8 条」「标题两行内」）。
- ❌ 内容迁就版式大改文案——回炉内容提炼，不是即兴能解决的事。

## 7. 文件与字体

- 风格目录构成见 `styles/style-picker.md`（全库唯一权威定义）；其中 `style-preview.png` 的产出时机与是否必交也在该文件，本节不复述。共享资产在 `styles/assets/`，不属于任何单个风格目录。
- 字体：默认本机字体栈，`style.css` 不引 CDN / 不加载 webfont；`--serif/--sans/--mono` 首项为本机字体名，命中即用、未装按栈回退。画廊、交付页与编辑器导出字形一致（编辑器导出 PNG 只认本机已装字体与 base64 内嵌）。
