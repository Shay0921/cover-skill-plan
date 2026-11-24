# tech-blue · 组件语义词表

> **状态：已拍板（形态 B / 护栏 fail 为主），未接入。** 供自由组合页（`custom/composed-*` + `layoutBase`）选用；`SKILL.md` 未引用本文，当前生产不按它验收。
> **真源**：`styles/tech-blue/style.css` 共享段 + `design-system.md` §1/§2 + `templates.html` 实际骨架。本文只是把「按语义找部件」的索引建起来；**类名、字号、结构与真源冲突时以 `style.css` 为准**，发现冲突应修本文，不改 CSS。
> **范围**：只登记**不挂母版类也生效**的共享类。`n<nn>-` 前缀的专属类不进词表——自由组合页禁用。
> **自包含**：本文不指向仓库外文件；运行规则见 `references/COMPOSED-MODE.md`。

## 0. 怎么用

1. 先定这页的语义角色（封面 / 清单 / 对比 / 数据 / 金句 / 收尾），再按「语义 → 部件」表挑组件。
2. 从下表复制骨架，把文案写死（**不留 `{{`**），尺寸交给 `layoutBase` 的 `.content` 骨架与 flex/grid 弹性。
3. 给主标题加 `data-role="page-title"`（第 1 页用 `cover-title`），**每页有且只有一个**——字号档校验靠它定位。
4. 组合完检查四件事：根三件套齐全、每个 `data-layer` 页内唯一、没有词表外的类名、填充机制已用 `.fill-grow` / `.fill-sink` 声明。

**字数一栏是起稿量级估算**（按 1080 画布、6.6cqw 边距、内容宽约 86.8cqw 折算），**不是机器校验线**；精确上限只在母版说明头，自由组合页靠几何体检 + 目检。

### 0.1 `data-role` 属性约定（不是类名，不影响样式）

`data-role` 只服务字号档校验：机器从它得知「这个节点是什么角色」，再比对该角色应有的字号档。它**不进词表派生、不参与类名白名单**。

| 值 | 强制 | 绑定字号 | 用途 |
|---|---|---|---|
| `cover-title` | 第 1 页必填（唯一） | 11.34cqw（待登记进 §1） | 封面主标题 |
| `page-title` | 非第 1 页必填（唯一） | 9.3cqw | 页面主标题 |
| `body` | 可选 | 2.51cqw | 叙述正文 |
| `label` | 可选 | 1.98cqw | 标签 / 眉标 |
| `quote` | 可选 | 等宽体独立档 | 原文引用块 |
| `num` | 可选 | 12.96cqw | 大数字 |

只强制主标题：主标题错档是最高频翻车（2026-11-23 已发生一次）；正文 / 标签的自造字号已被「全量字号 ∈ §1 档位集合」这条挡住，逐个标 `data-role` 边际收益低。

---

## 1. 画布与骨架

| 语义 | 类 / 属性 | 骨架要点 | 字数 |
|---|---|---|---|
| 画布根 | `.artwork-page` + `data-artwork` + `data-size="1080x1440"` | 唯一根；flex 纵列；`container-type:size`；自带 `overflow:hidden`。深底变体加 `.dark` | — |
| 网格底纹 | `.paper-noise` | `<div class="paper-noise"></div>`，永远第一个子元素，`z-index:0` | — |
| 顶栏 | `.brand-top` | `.left > .logo > .ph`（logo 字）+ `.brand-name`；`.right` 放期号。手写值 | logo ≤2 字符；品牌名 ≤12 字；期号 ≤14 字 |
| 分界线 | `.after-hero` | `<div class="after-hero"></div>`，2px 墨色，左右 6.6cqw；仅在有超大标题时放在 `.content` 前 | — |
| 主内容区 | `.content` | **无共享 CSS 定义**——布局由根的 `layoutBase` 类提供（见 `references/COMPOSED-MODE.md` §4）。校验器按派生法会把它判成私有类，故列白名单显式豁免（见同文件 §9 fail 第 2 项） | — |
| 页脚 | `.pg-footer` | 两个 `<span>`：署名 + `.page-no`。只放这两项；封面删页码节点 | 署名 ≤24 字；页码固定 `NN / 总页数` |

## 2. 字级（大标题必须衬线）

| 语义 | 类 | 字号 | 单行量级 |
|---|---|---|---|
| 超大标题 | `.title-xl` | 9.94cqw | 约 8–9 字 |
| 大标题 | `.title-lg` | 7.18cqw | 约 12 字 |
| 中标题 | `.title-md` | 4.9cqw | 约 18 字 |
| 大数字 | `.num-large` | 12.96cqw | 2–3 位 |
| 正文 | `.body-text` | 2.51cqw | 约 34 字（叙述型正文的唯一档） |
| 等宽小字 | `.mono-text` | 1.85cqw | 约 40 字 |
| 标签 | `.label` | 1.98cqw | 短标（字距 .28em，别写长句） |
| 页内眉标 | `.hero__tag` | 1.85cqw | 短标 |
| 页码字级 | `.page-no` | 1.72cqw | 固定 7 字符 |

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

### 4.1 填充机制两枚类（阻断项 · 尚未加进 style.css）

| 语义 | 类 | 定义 | 用法 |
|---|---|---|---|
| 均分拉伸 | `.fill-grow` | `flex:1;min-height:0;` | 内容块等分内容区高度 |
| 收尾沉底 | `.fill-sink` | `margin-top:auto;` | 末块推到页底 |

**现状**：两枚类在 `style.css` 与本文均 0 命中（截至 2026-11-24）。自由组合页的「填充机制必须声明」这条 fail 因此**无法写出**——内联 `style` 被禁，没有类就没有合规写法。

**落地动作**：加入 `style.css` 共享段 → 本文转正（去掉「尚未加进」）→ 7 页样板回改验证 → 校验器才能把此条从 `[未启用]` 转为生效。

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

- `.big-num` 25.92cqw，`.tag` 蓝底白字，`.title` 9.3cqw，`.sub` 2.51cqw。
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

- 白底细线 + 蓝色圆形图标；`max-width:78cqw`。
- `.callout__head` 1.56cqw 等宽蓝字，`.callout__text` 1.98cqw。
- `callout strong` 有定义（墨色加粗），可在 text 内用 `<strong>`。

### 5.3 胶囊 Pill（CTA / 步骤条）

```html
<div class="pill"><span class="num">01</span>免费领取</div>
<div class="pill pill--fill">立即进入</div>
```

- `.pill` 描边白底，`.pill--fill` 墨底白字；`.num` 是序号位，**必须挂在胶囊内层**，不能单独用。
- 可横排成「步骤 / 权益」条；文字 1.85cqw。

### 5.4 感谢 / 金句收尾

```html
<div class="thanks">
  <div class="thanks__rule"></div>
  <div class="thanks__quote">金句写这里</div>     <!-- 9.07cqw，单行约 10 字 -->
  <div class="thanks__sub">补充一句</div>          <!-- 2.64cqw 衬线斜体 -->
  <div class="cta-bar">
    <span class="cta-bar__label">· FOLLOW ·</span>
    <span class="cta-bar__text">关注我，持续更新</span>
  </div>
</div>
```

- `.thanks` 自身 `flex:1` 居中；`.thanks__rule` 8cqw 蓝线；`.cta-bar__label` 1.43cqw，`.cta-bar__text` 2.64cqw。
- 金句断行要手动安排均衡两行，避免末行孤字。

### 5.5 步骤标题（大 step 数字）

```html
<div class="step-num">3</div>
<div class="step-title-wrap">
  <div class="step-title">这一步的标题</div>
</div>
```

- `.step-num` 23.76cqw，`.step-title` 9.3cqw；`.step-num:empty` 与 `.big-num:empty` 都会自动隐藏。

## 6. 图片槽（唯一合法写法）

```html
<div class="ph-img" data-fit="cover">
  <img class="ph-img__img" src="data:image/png;base64,…"
       data-slot="image" data-layer="唯一id" data-label="图 01"
       data-ratio="16:9" alt="">
  <span class="ph-img__label">IMG · 1280 × 720</span>
</div>
```

- **图片必须 base64 内嵌**（`custom/composed-*` 页不收集素材、不产 `assets/`）。
- `<img>` 绝对定位铺满容器；`data-fit="cover"` 裁切填满，`contain` 完整显示。
- 有图后给容器补 `data-filled`，或删掉 `.ph-img__label`，否则占位文字浮在图上。
- **容器尺寸没有共享定义**：宽高由 `layoutBase` 的网格 / flex 决定，或写在所在单元容器内；词表不提供「万能图框」。
- `data-ratio` 用常用比（16:9 / 16:10 / 4:3 / 3:2 / 1:1 / 4:5 / 3:4 / 2:3 / 9:16）；图与槽比例差很多时先预裁。

### 图片卡（带占位与角标）

```html
<div class="img-card ph-img" data-fit="cover">
  <img class="ph-img__img" src="data:image/png;base64,…" data-slot="image" data-layer="img-1" data-ratio="3:4" alt="">
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
| `.num-list` | CSS 注释明确为专属段实现：N10/N11 样式完全分叉（flex 行 vs grid 四列，子类 `t/d` vs `name/desc`），**没有共享定义**。`design-system.md` §2 原误列进共享表，**已修正为表下注记**（DESIGN-HANDOVER 2026-11-23 批次，见该文件 §7）；两处现已一致，不要再按旧状态说「待修订」 |
| 任何 `n<nn>-` 前缀类 | 专属段，需要对应根类；`custom/composed-*` 页禁用（根上的 `layoutBase` 只用来取 `.content` 骨架） |
| 裸 `.content` | 无共享 CSS，必须靠 `layoutBase` |
| 自造类 / 内联样式 / 自造变量 | 风格一致性红线，机器尚未拦，人审把关 |
