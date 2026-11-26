# tech-blue · 组件语义词表

> 供自由组合页（`custom/composed-*` + `layoutBase`）选用。**真源**是 `style.css` 共享段 + `design-system.md` §1/§2 + `templates.html` 实际骨架：本文只是「按语义找部件」的索引，类名、字号、结构与真源冲突时以 `style.css` 为准，发现冲突改本文不改 CSS（类名词表由 `script/composed.mjs` 现场派生，不手抄）。
> **范围**：只登记**不挂母版类也生效**的共享类；母版专属类不进词表——自由组合页原样搬用会静默失效。
> **自包含**：本文不指向仓库外文件；运行规则见 `references/COMPOSED-MODE.md`。

## 0. 怎么用

1. 先定这页的语义角色（封面 / 清单 / 对比 / 数据 / 金句 / 收尾），再按「语义 → 部件」表挑组件。**组件的三个来源**（详见 `references/COMPOSED-MODE.md` §5）：① 下表共享类直接用；② 复制现有母版组件的结构——把它的专属类名改成自造名、样式在页内 `<style>` 重写（值走令牌）；③ 完全自造。原样搬用母版专属类名不行（本页无其 CSS 定义），但复制结构本身完全合法。
2. 从下表复制骨架，把文案写死——**只有注入通道认的两个占位符可留：页码节点里的 `{{page-no}}`、清单进度节点里的 `{{progress}}`**，其余 `{{` 一律不留。尺寸交给 `layoutBase` 的 `.content` 骨架与 flex/grid 弹性。品牌三槽与两个机械槽建议带 `data-sys`（`brand-logo` / `brand-name` / `footer-id` / `page-no` / `progress`），render 会按 `plan.meta.brand`、页序与勾选数自动填，不写就保留你手写的字面量。
3. 给主标题加 `data-role="page-title"`（第 1 页用 `cover-title`），**每页有且只有一个**——字号档校验靠它定位。
4. 组合完先跑 `node script/composed.mjs <任务工作区>/plan.json` 自检（静态规则、通用项、页面级令牌），再按 `references/COMPOSED-MODE.md`「校验与自检」逐页过出图后的清单。根三件套、类名定义、填充声明、`data-sys` 拼写与占位符、页内 CSS 令牌由机器校验并报出具体位置，不在此枚举。

**字数一栏是起稿量级估算**（按 1080 画布、6.6cqw 边距、内容宽约 86.8cqw 折算），**不是机器校验线**；精确上限只在母版说明头，自由组合页靠几何体检 + 目检。

### 0.1 `data-role` 属性约定（不是类名，不影响样式）

`data-role` 只服务字号档校验：机器从它得知「这个节点是什么角色」，再比对该角色应有的字号档。它**不进词表派生、不参与类名白名单**。

| 值 | 强制 | 绑定字号 | 用途 |
|---|---|---|---|
| `cover-title` | 第 1 页必填（唯一） | `--fs-10` | 封面主标题 |
| `page-title` | 中间页必填（唯一，与 `page-title-compact` 二选一）；末页可与 `closing-quote` 二选一 | `--fs-9-3` | 页面主标题 |
| `page-title-compact` | 同上，密集页用它 | `--fs-7-2` | 条目多、正文重、或一页要塞两三个块时：标题降一档，把高度让给内容 |
| `closing-quote` | 末页可选（与 `page-title` 二选一） | `--fs-9-3`（与页标题同档） | 收尾金句 / 原文引用 |
| `body` | 可选 | `--fs-2-5` | 叙述正文 |
| `label` | 可选 | `--fs-2` | 标签 / 眉标 / 等宽小字 |
| `num` | 可选 | `--fs-13`（`num-large`）；大数字 / 步骤数字自带类即可，不必标 role | 大数字 |

**`page-title` 还是 `page-title-compact`**：一页只有两三块、留白偏多 → `page-title`；条目四条以上、或正文段落占了一半高度 → `page-title-compact`。用 9.3 撑满密页的标题会挤掉正文，反而更容易撞压盖和密度硬检。

**本表不写值**：`style.css :root` 是唯一真源，令牌名「值即名」（`--fs-9-3` 就是 9.3cqw）。校验器从令牌名反解档位、再读节点的 computedStyle 实测比对（容差 ±0.05cqw），**改档只改 `:root`，这张表和代码都不用动**。

只强制主标题：主标题错档由机器硬拦（`render.mjs` 在截图会话里读 computedStyle，错档即停）；正文 / 标签的裸字号已被页面级令牌校验拦死，合法令牌但错档的节点由全量字号扫描兜底，逐个标 `data-role` 边际收益低。

---

## 1. 画布与骨架

| 语义 | 类 / 属性 | 骨架要点 | 字数 |
|---|---|---|---|
| 画布根 | `.artwork-page` + `data-artwork` + `data-size="1080x1440"` | 唯一根；flex 纵列；`container-type:size`；自带 `overflow:hidden`。深底变体加 `.dark` | — |
| 网格底纹 | `.paper-noise` | `<div class="paper-noise"></div>`，永远第一个子元素，`z-index:0` | — |
| 顶栏 | `.brand-top` | `.left > .logo > .ph`（logo 字）+ `.brand-name`；`.right` 放期号。logo 与品牌名带 `data-sys="brand-logo"` / `"brand-name"` 则由 render 注入，不带则保留手写值 | logo ≤2 字符；品牌名 ≤12 字；期号 ≤14 字 |
| 分界线 | `.after-hero` | `<div class="after-hero"></div>`，2px 墨色，左右 6.6cqw；仅在有超大标题时放在 `.content` 前 | — |
| 主内容区 | `.content` | **无共享 CSS 定义**——布局由根的 `layoutBase` 类提供（见 `references/COMPOSED-MODE.md` §3）。校验器按派生法会把它判成私有类，故列白名单显式豁免（机器会报，见同文 §7） | — |
| 页脚 | `.pg-footer` | 两个 `<span>`：署名（`data-sys="footer-id"`）+ `.page-no`（`data-sys="page-no"`，节点内写 `{{page-no}}`）。只放这两项；封面 `nn=01` 由 render 自动置空并隐藏页码，不必手删节点 | 署名 ≤24 字；页码由机器生成为 `NN / 总页数` |

## 2. 字级（大标题必须衬线）

| 语义 | 类 | 字号 | 单行量级 |
|---|---|---|---|
| 超大标题 | `.title-xl` | 10cqw | 约 8–9 字 |
| 大标题 | `.title-lg` | 7.2cqw | 约 12 字 |
| 中标题 | `.title-md` | 4.9cqw | 约 18 字 |
| 大数字 | `.num-large` | 13cqw | 2–3 位 |
| 正文 | `.body-text` | 2.5cqw | 约 34 字（叙述型正文的唯一档） |
| 等宽小字 | `.mono-text` | 2cqw | 约 40 字（与 label 同档，靠等宽字体区分） |
| 标签 | `.label` | 2cqw | 短标（字距 .28em，别写长句） |
| 页内眉标 | `.hero__tag` | 2cqw | 短标 |
| 页码字级 | `.page-no` | 2cqw | 固定 7 字符 |

> `.mega-hero .title` 与 `.step-title` 是固定 9.3cqw 的特例，不属于上表通用字级；用它们时连同父组件一起复制。

## 3. 强调四式与高亮

| 语义 | 类 | 骨架 / 用法 |
|---|---|---|
| 正文小强调 | `.accent-word` / `span.hl` | 蓝字；tips、要点、Prompt 关键词 |
| 标题金句强调 | `span.hl-line` | 蓝字 + 底部淡蓝条；跨行按行盒绘制，圆角落首尾；**不要包 `<strong>`** |
| 蓝底白字 | `.accent-bg` | `<span class="accent-bg">…</span>`，小徽章 |
| 短强调线 | `.accent-line` | 6cqw × 2px 蓝线 |
| 墨底白字 | `.ink-bg` | 与 `.accent-bg` 同构，反色版 |

高亮标签白名单只有 `span.hl` / `span.hl-line` / `br` / `strong`；别引入 `<em>` 或其他标签做强调。

## 4. 弱结构

| 语义 | 类 | 用法 |
|---|---|---|
| 极细分割线 | `.fine-line` | 1px 淡线，块级 |
| 细边框 | `.fine-border` | 1px 边、直角（圆角 0） |
| 浅卡片 | `.fine-card` | 淡底、直角、padding 3cqw |

圆角只允许 `.4 / .8 / 1.4cqw` 三级令牌；胶囊、圆形沿用既有实现，不自造新档。

### 4.1 填充机制两枚类

| 语义 | 类 | 定义 | 用法 |
|---|---|---|---|
| 均分拉伸 | `.fill-grow` | `flex:1;min-height:0;` | flex 纵列里让某块吃掉剩余高度 |
| 收尾沉底 | `.fill-sink` | `margin-top:auto;` | 把末块推到页底 |

两枚类定义在 `style.css` 共享段，派生词表自动收录。**用法按骨架分档**：顶对齐纵列必须声明一枚，否则内容堆顶、肚底留白；居中骨架与网格骨架各有天然机制，写了反而破坏版面——校验器按所选骨架判定并告警。规则见 `references/COMPOSED-MODE.md`「填充」。

## 5. 内容组件（可直接组合）

### 5.1 页头 Hero

```html
<div class="mega-hero">
  <div class="mh-row">
    <div class="big-num">6</div>            <!-- 可删；数量不是主角时去掉整节点 -->
    <div class="hero-text">
      <span class="tag">今日关键事</span>   <!-- 可删；≤12字，white-space:nowrap -->
      <div class="title">标题写在这里</div>
    </div>
  </div>
  <div class="sub">副题一行</div>            <!-- 是 mega-hero 的直接子元素，不在 hero-text 内 -->
</div>
```

- `.big-num` 25.9cqw，`.tag` 蓝底白字，`.title` 9.3cqw，`.sub` 2.5cqw。
- 大数字去留判据见 `design-system.md` §5；去掉后标题侧自动 `flex:1` 占满整行。
- 一句话说不出数量卖点（「6 条速览」这种）就删掉 `.big-num`。

### 5.2 提示条 Callout

```html
<div class="callout">
  <div class="callout__icon">i</div>
  <div class="callout__body">
    <div class="callout__head">· TIP ·</div>
    <div class="callout__text">补充说明写这里</div>
  </div>
</div>
```

- 白底细线 + 蓝色圆形图标；默认满宽（`width:100%`，无 max-width 上限）。
- `.callout__head` 2cqw 等宽蓝字，`.callout__text` 2cqw。
- `callout strong` 有定义（墨色加粗），可在 text 内用 `<strong>`。

### 5.3 胶囊 Pill（CTA / 步骤条）

```html
<div class="pill"><span class="num">01</span>免费领取</div>
<div class="pill pill--fill">立即进入</div>
```

- `.pill` 描边白底，`.pill--fill` 墨底白字；`.num` 是序号位，**必须挂在胶囊内层**，不能单独用。
- 可横排成「步骤 / 权益」条；文字 2cqw。

### 5.4 感谢 / 金句收尾

```html
<div class="thanks">
  <div class="thanks__rule"></div>
  <div class="thanks__quote">金句写这里</div>     <!-- 9.3cqw，单行约 10 字 -->
  <div class="thanks__sub">补充一句</div>          <!-- 2.5cqw 衬线斜体 -->
  <div class="cta-bar">
    <span class="cta-bar__label">· FOLLOW ·</span>
    <span class="cta-bar__text">关注我，持续更新</span>
  </div>
</div>
```

- `.thanks` 自身 `flex:1` 居中；`.thanks__rule` 8cqw 蓝线；`.cta-bar__label` 1.5cqw，`.cta-bar__text` 2.5cqw。
- 金句断行要手动安排均衡两行，避免末行孤字。

### 5.5 步骤标题（大 step 数字）

```html
<div class="step-num">3</div>
<div class="step-title-wrap">
  <div class="step-title">这一步的标题</div>
</div>
```

- `.step-num` 23.8cqw，`.step-title` 9.3cqw；`.step-num:empty` 与 `.big-num:empty` 都会自动隐藏。

## 6. 图片槽（唯一合法写法）

```html
<div class="ph-img" data-fit="cover">
  <img class="ph-img__img" src="shots/a.png"
       data-slot="image" data-layer="唯一id" data-label="图 01"
       data-ratio="16:9" alt="">
  <span class="ph-img__label">IMG · 1280 × 720</span>
</div>
```

- **图片写相对任务工作区的路径**（`<img src="shots/a.png">`），出图时自动复制进交付 `assets/` 并把 src 改写为 `assets/<文件名>`；写了 img 就必须给图，无 src 硬停。
- `<img>` 绝对定位铺满容器；`data-fit="cover"` 裁切填满，`contain` 完整显示。
- 有图后给容器补 `data-filled`，或删掉 `.ph-img__label`，否则占位文字浮在图上。
- **容器尺寸没有共享定义**：宽高由 `layoutBase` 的网格 / flex 决定，或写在所在单元容器内；词表不提供「万能图框」。
- `data-ratio` 用常用比（清单唯一收在 `references/CONTRACT.md`「图槽 crop」，此处不复制）；图与槽比例差很多时先预裁。

### 图片卡（带占位与角标）

```html
<div class="img-card ph-img" data-fit="cover">
  <img class="ph-img__img" src="shots/b.png" data-slot="image" data-layer="img-1" data-ratio="3:4" alt="">
  <div class="placeholder ph-img__label">IMG · 01</div>
  <div class="corner-num">01</div>
</div>
```

## 7. 条件可用（有代价，不默认）

| 家族 | 类 | 条件 |
|---|---|---|
| 手机展示 | `.pm-content` / `.pm-hero` / `.pm-hero--c` / `.pm-kicker` / `.pm-title` / `.pm-sub` / `.pm-stage` / `.pm-phone` / `.pm-frame` / `.pm-screen` / `.pm-card` / `.pm-foot` / `.pm-chip` | 需要 frame 图（render 内嵌 `styles/assets/iphone-frame.png`）、内屏槽 46:99，且 `.pm-screen .ph` 已定义。只在确实展示 App 竖屏时用；不配手机截图就不要借这族 |

## 8. 明确不可用

| 项 | 原因 |
|---|---|
| `.num-list` | 专属段实现：两套母版的样式完全分叉（flex 行 vs grid 四列，子类 `t/d` vs `name/desc`），**没有共享定义**，不进共享词表 |
| 原样搬用母版专属类 | 专属段需对应根类，本页根上只有 `layoutBase` 一个母版类，原样搬来拿不到 CSS 定义会静默失效（校验器硬拦）。**可复制其结构**：改自造类名 + 页内 `<style>` 定义 + 值走令牌，见 §0 与 `COMPOSED-MODE.md` §5 |
| 裸 `.content` | 无共享 CSS，必须靠 `layoutBase` |
| 无页面级定义的类名 / 内联样式 / 自造变量 | 风格一致性红线。无定义类名与内联 `style="…"` 由 `script/composed.mjs` 硬拦；自造 `var()` 由 `script/page-css.mjs` 查令牌存在性 |
| 自造类（有页内 `<style>` 定义） | 组合页合法：`custom/composed-*` 可在 markup 带一个 `<style>` 块自定义组件，类须在块内有定义；视觉值只走令牌，布局属性自由 |
