# 自由组合页规范（`custom/` + `layoutBase`）

> **状态：已拍板（形态 B / 护栏 fail 为主），未接入。** `SKILL.md` 未引用本文，`script/render.mjs` 尚未实现 `layoutBase` 分支。本文件登记规则，当前生产不按它执行；按它写的 plan 目前不会受校验。
> **定位**：继「现成母版」「即兴补空 `custom/`」之后的第三条版式来源。**自由的是结构组合，不是视觉语言**——结构可以自己拼，token / 字级 / 类名 / 禁区一律不放开。
> **自包含**：本文件内联副作用表、校验清单与填充契约，**不指向仓库外文件**。决策留档在 dev 区，生产文档不反向引用。
> **称谓**：本通道全称「自由组合」，缩写 `composed-`（仅用于 `layout` 命名），**不叫「受控通道」**——机器分不清它与即兴补空，边界靠规范与人审守。

## 1. 什么时候用

| 情况 | 走哪条路 |
|---|---|
| 有母版语义匹配、内容装得下 | 现成母版（默认） |
| 母版语义匹配，但条目少、留白或空框难看 | 即兴补空（`styles/improvisation.md`，`layout: custom/<名>`，无 `layoutBase`） |
| **37 个母版语义都不匹配，但风格内现成组件够用** | **自由组合（本文，`layout: custom/composed-<语义名>` + `layoutBase`）** |
| 内容装不下 | 回炉 `references/CONTENT-REFINEMENT.md` 重提炼，不是换版式能解决的 |
| 需要专属 CSS / 动画 / 响应式 | 不在本通道；这是母版开发，不是内容生产 |

一页一判定。整篇自由组合超过一半时，先怀疑内容提炼出了问题，或该转正成新母版。

**战略定位（决定何时才该用它）**：母版在清单 / 对比 / 时间线 / 展示等形态上更稳，本通道不重复建设。它专攻母版做不到的一件事：**原文完整引用的密度**——引用型原文装不进母版固定槽位。页面模式库见 §8。

## 2. 提交形态

```json
{ "nn": "03", "name": "两栏要点对比",
  "layout": "custom/composed-two-column-brief",
  "layoutBase": "n15",
  "markup": "<div class=\"artwork-page n15\" data-artwork data-size=\"1080x1440\">…</div>" }
```

- `layout`：`custom/composed-<语义名>`。`composed-` 前缀是**人读标记**（便于 grep 统计自由组合页占比），机器判档只认 `layoutBase` 有无。语义名小写连字符，描述**版式结构**（如 `two-column-brief`），不写内容主题、不写页码。**本约束只针对 `layout` 字段，不针对交付文件名**。
- `layoutBase`：**必填**，且必须与 markup 根上的母版类一致（机器交叉校验，不一致 fail）。这是本通道与即兴补空唯一的分档依据。
- `markup`：整页 HTML 字符串，文案写死，**一个 `{{` 都不留**（与即兴补空同，不做槽位填充）。
- **不写 `fields`**：写了不生效，机器 WARN。
- **命名自检**：`layout` 与 `layoutBase` 说的是同一件事的两个维度——前者说「这是什么版式」，后者说「借谁的 `.content` 骨架」。两者不一致（如 `three-column-brief` 配 `n15` 两列 grid）属于自相矛盾，机器交叉校验会拦。

## 3. 页面四件套（缺一不可）

```
<div class="artwork-page <layoutBase>" data-artwork data-size="1080x1440">
  <div class="paper-noise"></div>        <!-- 网格底纹，永远第一个子元素 -->
  <div class="brand-top">…</div>          <!-- logo / 品牌名 / 期号 -->
  <div class="after-hero"></div>          <!-- 可选：有超大标题时才加 -->
  <div class="content">…</div>            <!-- 主内容区，布局由 layoutBase 决定 -->
  <div class="pg-footer">…</div>          <!-- 署名 / 页码 -->
</div>
```

- 根三件套：`artwork-page` 类 + `data-artwork` + `data-size="1080x1440"`；**根上只挂一个母版类**（即 `layoutBase`）。
- **品牌三值 / 期号 / 页码：按「接入后」写，即由 render 注入**（与母版页一致）：
  - 品牌块三槽必须带 `data-sys="brand-logo"` / `"brand-name"` / `"footer-id"`，值从 `plan.meta.brand` 展开，markup 里可先写占位值。
  - `issue` 走 fields、页码走页码逻辑（`NN / 总页数`），**都不写 `data-sys`**。第 1 页（`nn=01`）把页码节点整个删掉。
  - **接入前过渡态**：render 现在跳过 custom 页（不注入），写得手写。接入后手写值会被注入覆盖——故现在就按接入后写，不要依赖手写。
- `data-layer` 页内唯一；富文本只认 `span.hl` / `span.hl-line` / `br` / `strong`。
- **主标题必须带 `data-role`**：每页有且只有一个 `data-role="page-title"`（第 1 页用 `cover-title`）。这是字号档校验的唯一抓手（§9 fail 5），不标则无法判断该节点该用哪一档。

## 4. 关键约束：`.content` 没有共享 CSS

`style.css` 里 `.content` 本身没有定义（约 25 条全是 `.nNN .content`），**裸 `.content` 不会撑满、不会分栏、页脚不会贴底**。解决办法：给根挂一个母版类，只借它提供的 `.content` 骨架。

| `layoutBase` | `.content` 提供的骨架 | 适合 |
|---|---|---|
| `n12` / `n14` / `n26` | flex 纵列，gap 1.8 / 2.6 / 2.6cqw | 要点、清单、纵向堆叠 |
| `n20` / `n21` | flex 纵列，gap 3cqw（n20 另带 `position:relative`） | 对比、需要定位标注 |
| `n23` / `n24` | flex 纵列，gap 2 / 1.2cqw | 紧凑叙述、演示 |
| `n11` | flex 纵列，无 gap | 靠子类自带边框分隔的清单 |
| `n15` | grid 两列等宽，gap 1.4cqw | 双栏、2×2 |
| `n18` | grid `2fr 1fr 1fr` × 2 行，gap 1cqw | Bento / 不等宽网格 |
| `n10` | grid `1fr 1.1fr`，gap 5.5cqw | 左文右图 |

### 4.1 副作用实测表（选定前必查，替代「挂后目检」）

借根类会连带其**所有根作用域规则**，不只是 `.content`。下表逐条实测（选择器为锚点，行号会漂移）：

| `layoutBase` | 骨架 | 副作用 |
|---|---|---|
| n11 | 纵列 | `.n11 .num-list` 家族在借用 num-list 类时才命中——该类见 §5 禁用清单，合规页不命中 |
| n12 / n21 / n23 / n24 | 纵列 | 零（额外规则全挂 `n<nn>-` 前缀子类，本通道禁前缀类，不命中） |
| n18 | 2fr 1fr 1fr ×2 行 | 零（`.n18 .n18-g .label` 需 `.n18-g` 私有类才命中） |
| n15 | 两列 grid gap 1.4 | 零（`.n15 .card .ph-img` 需 `.card` 类）；**行高 auto 无填充机制，文字卡会底部沉空** |
| n20 | 纵列 gap 3 + relative | **`.n20 .callout` 被强制 `grid-column:1/-1;max-width:100%;width:100%;margin-bottom:1cqw`**——通栏化是静默的 |
| n10 | 1fr 1.1fr | `.n10 .img-card` 多 `min-height:0`（无害） |
| n14 | 纵列 2.6 | **`.n14 .mega-hero .tag` 背景变墨色**（`background:var(--ink)`），不是 accent 蓝 |
| n30 | ⚠ 无 `.content` 骨架（模板用 `.thanks`），**不可作 layoutBase**；本行只记副作用 | **仅在根同时带 `.dark` 时**才命中 `.artwork-page.n30.dark` 系列（15 条，改品牌区 / 页脚 / thanks 全家配色）。**不加 `.dark` 是安全的**：浅色分支有 6 条 `.n30:not(.dark)`（tag / quote / sub / cta-bar / label / text），品牌区 / 页脚沿用浅色默认。别按「n30 天生有毒」理解 |
| n01 | 居中纵列 | **裸 `.title` 在非 mega-hero 结构下吃 `.n01 .title` = 11.34cqw；`.mega-hero .hero-text .title`（9.3cqw，特异性 0,3,0）结构对时可压住** |

**中文引用类内容禁用非等宽列骨架**：n18 的 2fr 列把「自我反驳」挤成孤字（实跑踩坑）。中期方向是建中性骨架（c-1col / c-2col / c-3col / c-bento），列宽按最窄列 ≥ 4 汉字、内置填充机制——届时不再依赖 `layoutBase`。

**未实测项**：`n26` 只在 §4 主表登记了骨架，**尚未做副作用实测**（不在上表）。借它当 `layoutBase` 前必须自行目检一次：查 `grep -n '\.n26 ' style.css` 的执行结果里有无作用于共享类的规则。宁可换一个已实测的骨架，也不要在未实测的根类上起稿。

### 4.2 使用规则

1. **只借 `.content` 骨架**。不要照抄该母版的专属组件（`n<nn>-` 前缀类），否则等于又用回固定母版，本通道失去意义。
2. 一个根只挂一个母版类；挂两个会得到互相打架的专属规则。
3. 选 `layoutBase` 前先查 §4.1 表，不必每次目检重试。
4. **填充机制必须显式声明**（见 §4.3）。
5. 若将来 `style.css` 增加共享骨架类，再改为不依赖 `layoutBase`（属母版开发，本文不含）。

### 4.3 填充契约（阻断项：当前无合规写法）

页面三段论：**头（brand-top / mega-hero / after-hero，固定）+ 肚（`.content`，flex:1 弹性）+ 脚（pg-footer，固定）**。自由度与风险全在肚子上。母版防肚底留白只有两种机制可用：

1. **均分拉伸**：块 `flex:1` / grid `1fr` 行均分内容区
2. **收尾沉底**：末块 `margin-top:auto`

**契约：每个自由组合页必须显式声明其一（拉伸或沉底），未声明 = fail。**

**当前无法合规表达**：内联 `style` 被禁、词表无填充类、`style.css` 无 `[data-fill]` 规则，`flex:1` / `margin-top:auto` 只存在于母版私有段。校验器没有可查标准。**前置**：在 `style.css` 共享段加两枚类并登记词表——

```css
.fill-grow{flex:1;min-height:0;}
.fill-sink{margin-top:auto;}
```

在此之前，「填充机制已声明」这条 fail **不得声称已生效**；校验器必须以 `WARN: [未启用] 填充机制校验（缺 .fill-grow/.fill-sink）` 自曝。

**内容量偏少时的合法手段是升字档**（把引用原文提到更大的档），不是多写文案凑高度；内容迁就排版是反方向。

## 5. 组件使用纪律

- **只能用 `styles/tech-blue/components.md` 登记的共享类**。词表外的类名一律不许出现（含 `n<nn>-` 专属类）。
- 间距只用既有节奏：0.4 / 0.8 / 1.4 / 2 / 3 / 6.6cqw；尺寸用 cqw，不用 vw/vh/px 硬值。
- 字号只用 `design-system.md` §1 的档位或豁免清单；叙述型正文走 body 档 2.51cqw。
- 强调色只有 `--accent` / `--accent-deep`；令牌只用设计令牌表内的，不自造变量。
- 大标题必须衬线（`--serif`）；不用无衬线粗体当大标题。
- 富文本高亮：标题/金句用 `span.hl-line`，正文小强调用 `span.hl`。
- **分隔判据**：块有边界（`fine-card` / `callout` 自带底色边框）→ 只用空隙（gap 限三档）；裸文本块才用线（`fine-line` 的语义是「替代边界」，不是装饰）。

**明确不可用**：`.num-list`（N10/N11 两套分叉实现，无共享定义）、任何 `n<nn>-` 前缀类、裸 `.content`、自造类 / 内联样式 / 自造变量。

## 6. 禁区

机器已硬拦（custom 通道现有）：`position:fixed`、`@media`、`<script>` / `<animate>` 系标签、`animation:` / `transition:`、`{{` 残留、`data-layer` 重复。

机器接入后硬拦（fail 级，见 §9）：

- 内联 `style="…"`、`<style>` 块。
- 自造 CSS 变量、`var(--x)` 不在令牌表内。
- 词表外的新类名、`n<nn>-` 专属类。
- 未声明填充机制（§4.3 前置完成后生效）。
- 主标题缺 `data-role` 或字号不命中映射档。
- 手绘 SVG 塞样式（要图走 `references/FIGURE-GUIDE.md` 出 PNG）。

## 7. 图与字数

- **图必须 base64 内嵌进 `<img src="data:image/…;base64,…">`**：本通道不收集素材、不写 `assets/`。
- 图槽写法：`<img class="ph-img__img" data-slot="image" data-layer="唯一id" data-ratio="…">`，容器 `.ph-img` 加 `data-filled` 或删掉 `.ph-img__label`，否则占位文字浮在图上。
- **图槽没有「可省」机制**：只要 markup 里存在 `<img data-slot="image" data-layer>`，plan 就必须给值（`图槽 "<id>" 未在 plan 中填报（必填）`）。要无图形态就别写 img 节点，别指望留空。
- **没有字数说明头可依**：字数按 `components.md` 各部件估算上限起稿，靠几何体检 + 目检收口；越档只 WARN 不拦。
- **代价须知（本通道破了项目第一条地基）**：字数规则的唯一数据源本是母版 `templates.html` 说明头；自由组合页没有说明头，机器无精确上限可比对。这是接受本通道就该认的代价，不是待修 bug。

## 8. 页面模式库

新布局创新收窄为「模式创新」：想试新布局先做成模式、单页验证入库，**不在交付页上即兴**。逐页即兴的直接后果已实测——同一组内容里 P05 用线分隔、P06 用空隙，视觉策略不一致。

首批模式（围绕原文引用型内容）：

| 模式 | 结构 | 状态 |
|---|---|---|
| `quote-review` | 组标题 + 原文引用块（等宽体）+ 点评卡 | 2026-11-23 实跑验证过形态，**未正式登记** |
| `pair-deep` | 等宽两列，各承载一条完整指令（原文 + 点评 + 动作） | **未登记** |
| `summary-flow` | 链路总结页（N33 能力但槽位自由） | **未登记** |

**入库标准**：单页目检通过 + 校验器零告警 + 填充机制与分隔判据已声明。

**现状如实**：7 页样板的 `layout` 已用语义名（`composed-quote-cover` / `composed-two-prompt-cards` / `composed-question-chain` / `composed-thinking-pair` / `composed-code-reading` / `composed-retro-loop` / `composed-quote-ending`），可作素材；但三个模式零登记，模式库仍是空账。**在模式入库前，新页只能参照已有 7 页的形态，不许再造新结构。**

## 9. 校验清单（接入时实现，已拍板分级）

**分级依据**：按「机器可判定 vs 需审美」分，不按「结构 vs 经验」分。「填充是否声明」能 fail（只问有没有）；「该不该拉伸」只能 WARN（要审美）。

**fail（可枚举、可判定，违规即停）**：

1. `layoutBase` 交叉校验：必须出现在根 class 里，且根上有且只有一个 `n\d\d`。
2. **类名白名单**：全 markup 类名 ⊆（自动派生共享词表 ∪ 结构类白名单 `artwork-page` / `paper-noise` / `brand-top` / `after-hero` / `content` / `pg-footer` ∪ 根 layoutBase 类）。`.content` 必须显式豁免（无裸定义，派生法会判成私有）。不用「`n\d\d-` 前缀」启发式——它漏判 `.n01 .item` 的 `item` 这类作用域私有泛名。
3. 四件套齐全、禁区正则、`{{` 残留、`data-layer` 唯一。
4. 填充机制声明——**前置**：§4.3 两枚类先落地。
5. 字号档（两段）：① 全量文本节点 computedStyle 字号 ∈ `design-system` §1 档位集合；② 主标题（`data-role="page-title"` / `"cover-title"`）字号命中映射档（page-title 9.3 / cover-title 11.34cqw）。**前置**：11.34cqw 先登记进 §1。须走 CDP `evaluate` 读 DOM，**不能用正则**（`span.hl` 嵌套会破结构）。
6. 编辑器标注：可编辑文本带 `data-layer`（唯一）+ `data-editable="text"`；品牌块带 `data-sys` 三槽。

**WARN（需审美，不误杀）**：填充是否恰当 / 塌陷组合黑名单（`fine-line` 在居中 flex 塌成点）/ 孤字检测 / 字数越档。

**两条纪律**：

- **未启用项必须自曝**：因前置未落地而未启用的 fail，每次运行输出 `WARN: [未启用] <项名>（缺 <前置>）`。放一个永远 pass 的 fail 比没有更危险——它让人误以为已受约束。
- **实现优先级**：六条 fail 里只有**第 2 项（类名白名单 + 派生法）是本通道新增价值**，且它是唯一能挡住「偷偷用专属类退回抄母版」的检查。顺序：**派生法 + 白名单 → 未启用自曝 → 其余 fail**。

## 10. 出图与转正

```sh
node script/render.mjs <运行区>/ --delivery=<YYYY-MM-DD-小标题>   # 接入后：自由组合页几何体检默认开启
```

- 交付白名单不变：每页 HTML + PNG，加 `preview.png`；plan、素材、过程件留运行区。
- **不可复现已发生**：7 页样板的 `plan.json` 不在交付目录（符合白名单），只在运行区 `runs/2026-11-23-Agent指令10句-composed/`，运行区随用随清——交付页跨任务不可重建。**转正（或主动留存 plan 副本）是唯一复用出口。**
- **转正**：同一 `custom/composed-<语义名>` 在 ≥2 个任务中出现，或同一页改两版仍不满意 → AI 主动向用户提出转正为正式母版，复用 `styles/improvisation.md`「转正四步」（说明头七字段 + section + CSS + catalog，再目检与真实任务回归）。本通道不提供自动计数。

## 11. 与即兴补空的区别

| | 即兴补空 | 自由组合 |
|---|---|---|
| `layout` | `custom/<名>` | `custom/composed-<语义名>` |
| `layoutBase` | **不填** | **必填** |
| 触发 | 母版能套，只是装不满 | 母版语义都不匹配 |
| 骨架 | 抄某一母版整页 | 四件套自拼 + `layoutBase` 提供 `.content` 骨架 |
| 组件 | 抄来的专属类可保留 | 只用共享词表，禁专属类 |
| 几何体检 | 需显式 `--check-geometry` | 接入后默认开启 |
| 转正 | 同类补空 ≥2 次 | 同类版式 ≥2 次 |

**分档是自觉开关**：机器只能读 `layoutBase` 有无，分不清 markup 实质。不填 `layoutBase` 就退回即兴补空、专属类随便用——所以本通道的边界靠规范与评审守，不靠机器守。
