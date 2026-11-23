# tech-blue · design-system.md

> tech-blue 风格规范：气质 / 设计令牌 / 组件语义表 / 自绘图形 / 即兴纪律 / 反例。

## 0. 一句话气质

安静的杂志感科技蓝：纯白底铺 40px 极淡网格，深墨衬线大标题，全库只有一个强调色 #2563EB，等宽小字做标签与页码。

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
| `--accent` | #2563EB | 唯一强调色（blue-600）；语义/装饰常量除外（N25 降幅色、窗口红绿灯、N24 编辑器图标与代码高亮色） |
| `--accent-deep` | #1D4ED8 | 强调深版 |
| `--ink-bg` / `--ink-paper` | #0D0D12 / #ECECF2 | 深底变体（N30） |
| `--serif` | 系统衬线栈 | 标题（大标题唯一选择） |
| `--sans` | 系统无衬线栈 | 正文 |
| `--mono` | 系统等宽栈 | 标签/页码/代码/等宽原文（写中文时汉字走回退） |
| 圆角 | .4 / .8 / 1.4cqw 三级 | 徽章 / 卡片 / 窗口 |

层级区分靠字距/颜色/字号，等宽标签尤甚。

字号层级：title-xl 9.94cqw · title-lg 7.18cqw · title-md 4.9cqw · num-large 12.96cqw · body 2.51cqw · label 1.98cqw · mono 1.85cqw · big-num 25.92cqw。

**字号豁免清单（2026-11-21 目检定版）**——以下允许低于字级档位，属机械 meta / 装饰 / 定版特例：机械 meta（页码、期号 1.72cqw；时间戳、序号 1.42–1.72cqw）；纯装饰（窗口 chrome、占位标签、分隔点 1.17–1.56cqw）；N40 ≥7 卡压缩态（1.3–2.05cqw，卡宽同步收窄 16.5cqw）；图形页 px 档（见 §3）；用户定版特例（N18 角标签 1.8cqw）。条目密集型说明（清单 d/desc、表格值、标注卡说明等）定版于 1.98–2.51cqw 区间，真源 = style.css，改动须过目检；叙述型主体说明一律 body 档 2.51cqw。

画布：1080×1440（3:4），边距 6.6cqw，`.artwork-page` 自带 `container-type:size`，cqw 全库可用。

## 2. 画布骨架与共享组件（style.css 共享段词汇表）

| 组件 | 语义 | 用法 |
|---|---|---|
| `.artwork-page` | 画布根 | 每母版唯一；深底加 `.dark`；根上另有 `n<nn>` 标记类与 `data-artwork data-size` |
| `.paper-noise` | 40px 网格底纹 | 装饰，永远第一个子元素 |
| `.brand-top` | 顶部品牌栏（logo 方块 + 品牌名 + 右侧期号） | 风格身份件，值由 `plan.meta.brand.*` 与逐页 `issue` 注入。篇幅：logo ≤2 字符、品牌名 ≤12 字 |
| `.mega-hero` | 超大数字 Hero（big-num + tag + title + sub） | 清单类页头；`.sub` 全宽副题。title 字号全库通用页统一 9.3cqw；每行字数随 big-num 位数变——单数字 8 字位、双数字 6 字位（写进母版说明头「限制」行）。封面、结尾与 N26/N27 居中变体不适用 |
| `.mega-hero .tag` | 标题上方徽标（蓝底白字胶囊，`white-space:nowrap`） | 位于 `.hero-text` 内、独立成行、紧跟 `.title` 之上；限值 `tag≤12字`（设计规则，非容量线） |
| `.after-hero` | 2px 墨色粗分割线 | hero 与内容的分界 |
| `.pg-footer` | 底部页码条（署名 + 右侧页码） | 署名由 `plan.meta.brand.footer` 注入；页码按页序生成（封面隐藏）。篇幅：署名 ≤24 字；页码固定 7 字符。页脚只允许这两个元素，不加第三个内容槽 |
| `.num-list` | 编号条目列表 | N10/N11 清单骨架 |
| `.img-card` + `.ph-img` | 图片占位卡 | 结构与换图机制见 `references/CONTRACT.md`「图槽」 |
| `.callout` | 底部补充说明条（白底细线 + 圆形图标） | 提示/Tip |
| `.pill` / `.pill--fill` | 悬浮胶囊（描边 / 墨底两式，`.num` 是序号位） | 即兴词汇，当前母版未使用。CTA 组合：`<span class="pill"><span class="num">01</span>免费领取</span>`、`<span class="pill pill--fill">立即进入</span>`；可排成一行做「步骤/权益」横条 |
| `.fine-line` / `.fine-border` / `.fine-card` | 极细分割线/边框/卡片 | 弱结构 |
| `.accent-word` / `.accent-bg` / `.accent-line` / `.ink-bg` | 强调四式 | 关键词变色 / 蓝底白字 / 短横线 / 墨底白字 |
| `.hl` / `.hl-line` | 富文本两种高亮 | `.hl` = 蓝字，正文小强调；`.hl-line` = 蓝字 + 淡蓝条，标题/金句强调，不用 strong 包裹。条是元素自身背景渐变的底部 38%（`color-mix` 取 `--accent` 三成透明，字条同蓝仍可读），跨行时按各自行盒绘制、不错位，圆角落在整段首行左/末行右、断行处直角。用哪个由母版说明头声明（N07 另有浅蓝底变体；N30 深底字为白、条实色，N31 浅底条更淡）。可用标签见 `references/CONTRACT.md`「富文本白名单」 |
| `.title-xl/lg/md`、`.num-large`、`.body-text`、`.mono-text`、`.label` | 字级工具类 | 即兴时直接用 |
| `.pm-content` / `.pm-hero` / `.pm-hero--c` / `.pm-kicker` / `.pm-title` / `.pm-sub` | 手机展示家族页头 | N37-N40 共用；`.pm-title` 用 8.64cqw（对齐 N04 手机封面标题私值，介于 title-lg 与 title-xl 之间）。`--c` 为居中变体 |
| `.pm-phone` / `.pm-frame` / `.pm-screen` | 手机单元（壳压图） | N37-N40 共用，与 N04 同构：`frame-img` 装饰框（render 单源内嵌 `styles/assets/iphone-frame.png`）+ 内屏开口 7.58%/3.82%/84.73%/92.30%，`border-radius:10px` 盖住露角；内屏图槽 46:99 cover |
| `.pm-card` / `.pm-foot` / `.pm-chip` | 标注卡 / 底部贯穿说明条 / 胶囊 | 家族共用弱结构；`.pm-foot` 两端细线 + 中央 `.pm-chip` |

> 本表是共享段词表，不是母版用量的镜像。当前母版未使用的类（`.pill`、`.title-xl`、`.accent-bg`、`.ink-bg`、`.fine-card` 等）仍是可用的即兴补空词汇（style.css 已有实现），照常可用。

> 专属段类要覆盖共享段属性，必须带共享段前缀。共享段规则多是「父类 + 子类」两段（`.brand-top .right`），专属段写单类（`.n26-limited`）会被压掉且无报错；要覆盖就写成 `.brand-top .right.n26-limited`。

> 品牌三值（logo/品牌名/署名）按表中篇幅自查；篇幅按本风格栏宽标定，不跨风格沿用。

## 3. 自绘图形（tech-blue 专属标定）

通用机制（何时自绘、figure.mjs 流程、令牌单源、px 档、安全区、禁项）见 `references/FIGURE-GUIDE.md`；来源判断见 `references/IMAGE-WORKFLOW.md`。这里只给本风格的具体取值——换风格不要沿用。

- 令牌单源：只写本风格「设计令牌」节声明的令牌（`--paper` / `--paper-deep` / `--ink` / `--ink-soft` / `--muted` / `--accent` / `--line` / `--line-strong` / `--serif` / `--sans` / `--mono`）。不假设别的风格同名。
- 字号 px 档（图形页无 container，cqw 不可用；档位是本风格标定）：

  | 用途 | 字号 | 字体 / 处理 |
  |---|---|---|
  | 版头小字（左上/右上说明） | 21 | mono，字距 .14em，`--ink-soft` / `--muted` |
  | 轨 / 分组标签 | 26 | sans 粗体，前缀编号用 mono 20 |
  | 组内小标签（英文短词） | 18 | mono，字距 .12em，`--accent` |
  | 节点标题 | 39–41 | serif 粗体，行高 1.15 |
  | 说明句 | 26 | sans，行高 1.2，`--ink-soft` |
  | 汇总条（深底反白） | 31 | sans，`--paper` 字色 |
  | 序号圆 | 18 | mono，43px 圆、1.5px 描边 |

- 线宽与圆角：细线 1px、卡片 1px 边框 + 圆角 14、序号圆 1.5px 描边，圆角不超 14；箭头用 CSS 三角或 `<marker>`，三角 5×7。

## 4. 即兴补空纪律（借壳补空）

- 母版能套但留白/空框难看时，借母版骨架补空：触发、做法与硬约束见 `styles/improvisation.md`；本节只立风格纪律。
- 只用 style.css 既有类；根结构照抄母版：`.artwork-page.n<nn>` + `.paper-noise` + `.brand-top` + 内容 + `.pg-footer`。
- 禁：内联样式、自造 CSS 变量、新类名、`<style>`、vh/vw、position:fixed、@media、动画/过渡。
- cqw 优先于 px（画布内自适应）；间距用 0.4/0.8/1.4/2/3/6.6 的既有节奏。
- 版式自适应用 flex/grid 弹性（`flex:1` 均分），不做固定高度堆叠。
- 即兴页 layout 登记 `custom/<语义名>`；几何体检需显式 `--check-geometry`（仅 custom 页）；同名 custom 累计 ≥2 次走转正管道（`SKILL.md`「即兴补空与转正」）。

## 5. 大数字的去留（big-num / step-num）

带大数字的母版默认显示大数字，但**大数字不是必填宿命**——它只在「数量本身是这页主角」时才留。

- **判据**：能否用一句话把数量说成卖点——「6 条速览」「7 倍增长」「3 步搞定」？能 → 留大数字；不能（这一页讲的是一个主张、一张图、一组对比，数字只是条数的机械统计）→ 走轻量标题，去掉大数字。
- **决策权**：由 AI 在选母版/写 plan 时按判据判断，**人审可否决**（人审说去掉就去掉，不辩论）。不逐页问用户——这属于内容判断，不是需要用户拍板的风格选择。
- **实现**：big-num / step-num 槽已标 `data-optional`（2026-11-21 起）——**plan 里填 `""` 即自动隐藏**，标题侧 `flex:1` 占满整行、按实际宽度断行（字数校验只卡总量，与数字无关），不再需要走 L2 删元素；机器契约见 `references/CONTRACT.md`「plan 填写行为」。**例外**：N26 的 `n26-center-price` / N27 的 `n27-center-no-num` 是写死的居中特例——不可填，只可借其写法、不可照抄成可填槽。
- **判据自检**：去掉大数字后标题若显得空、撑不起整行 → 说明这一页本就该有数量主角，改回留数字，或换一个本就无数字的母版（封面 N01-N04、结尾 N28-N31）。

## 6. 反例

- 引入第二个强调色（红/绿/紫）；强调色只用 `--accent`（blue-600），深版 `--accent-deep`。
- 卡片一律大圆角；卡片/面板/窗口圆角只按三级令牌（.4 / .8 / 1.4cqw），胶囊、圆形等特殊形态沿用既有实现值，不自造新档。
- 用无衬线粗体当大标题；大标题必须用衬线（`--serif`）。
- 用 per-page `fields` 逐页填品牌名/logo/页脚署名；品牌三值走顶层 `plan.meta.brand.*`，期号 `issue` 逐页填，页码禁止手填。
- 图槽塞 `<div style="background:url()">`；图槽必须走 `<img data-slot="image">`。
- 把 `repeat ×min-max`、每槽 `≤N字` 精确限值写进 catalog；精确限值只在母版注释与说明头，catalog 只写选型量级语义。
- 内容迁就版式大改文案；冲突时回炉内容提炼，规则见 `references/content-refinement.md`。
