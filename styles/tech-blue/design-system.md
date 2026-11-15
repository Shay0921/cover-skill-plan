# tech-blue · design-system.md

> **风格语义与即兴纪律**。选型看 catalog.md；填充规则看各母版说明头与 repeat 注释；受控即兴（L3）必读本文件。
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
画布：1080×1440（3:4），边距 6.6cqw≈71px，`.ai-page` 自带 `container-type:size`（cqw 全库可用、多 section 互不干扰）。

## 2. 画布骨架与共享组件（style.css 共享段词汇表）

| 组件 | 语义 | 用法 |
|---|---|---|
| `.ai-page` | 画布根 | 每母版唯一；深底加 `.dark`；根上另有 `n<nn>` 标记类与 `data-artwork data-size` |
| `.paper-noise` | 40px 网格底纹 | 装饰，永远第一个子元素 |
| `.brand-top` | 顶部品牌栏（logo 方块 + 品牌名 + 右侧期号） | **风格身份静态件**，不随内容改 |
| `.mega-hero` | 超大数字 Hero（big-num + tag + title + sub） | 封面/清单类页头；`.sub` 全宽副题 |
| `.after-hero` | 2px 墨色粗分割线 | hero 与内容的分界 |
| `.pg-footer` | 底部页码条（域名 + 右侧页码/母版名） | 静态件；页码槽用 `.page-no` |
| `.num-list` | 编号条目列表 | N10/N11 清单骨架 |
| `.img-card` + `.ph-img` | 图片占位卡 | 见 §3 图槽契约 |
| `.callout` | 底部补充说明条（白底细线 + 圆形图标） | 提示/Tip |
| `.pill` / `.pill--fill` | 悬浮按钮组 | 少量 CTA 母版 |
| `.fine-line` / `.fine-border` / `.fine-card` | 极细分割线/边框/卡片 | 弱结构 |
| `.accent-word` / `.accent-bg` / `.accent-line` / `.ink-bg` | 强调四式 | 关键词变色 / 蓝底白字 / 短横线 / 墨底白字 |
| `.hl` | 富文本高亮（白名单） | 通用=变蓝；N01/N28/N30 的块状 .hl 在各自作用域 |
| `.title-xl/lg/md`、`.num-large`、`.body-text`、`.mono-text`、`.label` | 字级工具类 | 即兴时直接用 |

## 3. 图槽契约（ph-img 机制）

- 槽位 = `<img class="ph-img__img" data-slot="image" data-layer data-label data-ratio src="1×1 透明 GIF">`，外层容器带 `.ph-img` + `data-fit`（**cover** 裁切填满 / **contain** 完整显示）。
- 空 src（透明 GIF）时容器显示占位标签（`.ph-img__label`），布局与有图完全一致；render/编辑器换图直接改 img 的 src。
- render 填图后给容器加 `data-filled` → 占位标签自动隐藏（`.ph-img[data-filled] .ph-img__label{visibility:hidden}`）。
- 兼容旧通道：容器 `data-img` + CSS 变量 `--img` 注入仍有效（`[data-img="N17-03"]{--img:url(…)}`），img 存在时覆盖其上。
- 手机框：`frame-img` 类装饰 `<img>`（如 N04 `.phone__frame`），render 从 `styles/assets/iphone-frame.b64` 解码兜底，母版不内嵌框图数据。
- 图片格式 PNG/JPEG/WebP；裁切由 CSS 机械执行，AI 只在 plan.json 写 `crop` 选区描述。

## 4. 槽位与 repeat 契约

- **三处同名**：文字槽 `{{槽名}}` = `data-layer` id = plan.json 的 fields 键（英文 kebab-case；`data-label` 是图层面板中文名）。
- 文字元素**不打 data-slot**（pageApp 契约：data-slot="image" 仅落 `<img>`）。
- 容器可打 `data-layer + data-type="group"`（可整体移动）；纯装饰不标 layer。
- **repeat**：单元标 `data-repeat="<数组名>"`，单元前注释 `<!-- repeat ×min-max: 克隆规则；条数-字数联动 -->`（全库唯一数值配置点）；单元内占位符用条目键（如 `{{t}}` `{{d}}`），render 克隆时给 data-layer 加序号后缀。
- 富文本白名单：值内仅 `span.hl` / `br` / `strong`；其余标签会被拒绝。
- 就地限制：说明头"限制"行是 render 字数软校验的解析对象（"≤N字"），写实测值。

## 5. 受控即兴纪律（L3）

- 只用 style.css **既有类**组合整页；根结构照抄：`.ai-page.n<nn>` + `.paper-noise` + `.brand-top` + 内容 + `.pg-footer`。
- **禁**：内联样式、自造 CSS 变量、新类名、`<style>`、vh/vw、position:fixed、@media、动画/过渡。
- cqw 优先于 px（画布内自适应）；间距用 0.4/0.8/1.4/2/3/6.6 的既有节奏。
- 版式自适应用 flex/grid 弹性（`flex:1` 均分），不做固定高度堆叠。
- 即兴页 layout 登记 `custom/<语义名>`，过形态校验 + 几何体检；同名 custom 累计 ≥2 次走转正管道（final/01 §4.2）。

## 6. 反例（这条街别这么走）

- ❌ 引入第二个强调色（红/绿/紫）——本风格的克制感全靠"只有蓝"。
- ❌ 圆角滥用（卡片一律大圆角）——本风格是直角+极细线，圆角只按三级令牌。
- ❌ 用无衬线粗体当大标题——标题必须是衬线（`--serif`）。
- ❌ 把 brand-top / pg-footer 当内容改——那是风格身份件；页码用 `.page-no` 槽。
- ❌ 图槽塞 `<div style="background:url()">`——必须走 `<img data-slot="image">`，否则编辑器换不了图。
- ❌ repeat 区间写在 catalog——catalog 只写语义，数值只在母版注释。
- ❌ 内容迁就版式大改文案——回炉内容提炼，不是即兴能解决的事。

## 7. 文件与字体

- 三件套：`style.css`（双段制：共享基座+上收 / 母版专属）· `templates.html`（仓库=画廊=看板）· 本文件。
- 字体：中文本机栈（编辑器导 PNG 安全）；Google Fonts @import 仅屏显增强，CDN 字体导 PNG 会回退到本地栈（Noto→宋体/雅黑族），排版已按回退态校过。
