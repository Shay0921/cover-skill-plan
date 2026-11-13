# 配方库（正式入册版 · 读者体验绑定制配方注册表）

> 依据：DEVPLAN §3 阶段 2、§4.3 骨架抽取规则、§4.4 登记卡模板；聚类依据 dev/01-recipe-draft.md（20 条定案，结构冻结生效）。
> **入册状态：2026-11-13 第二道人审闸门关闭，本文件与 41 骨架整体入册生效**；开发痕迹版留存 dev/02-recipe-registry.md。
> 命名：按内容语义（DEVPLAN 阶段 2 补充），R-id 沿用草案。
> 骨架目录：`references/recipes/`（每骨架档一个 `.part.html`，共 41 个）。
> 资产位：`references/assets/`（iphone-frame.png 910×1806；骨架/harness 不得引用 dev 路径）。
> 种子基线：`seed/paper-journal.html`（含布局修饰段）SHA-256 = `98E29FC020A8EBD5A77EA415720F8875CF7209A5B6FFF59638522075AFA5D243`——阶段 4 种子只读校验以此版本为基线。（2026-11-13 变更：P→R 迁移把示例页 `data-recipe` 改为 R-quote-01，校验和随之刷新。）（2026-11-13 阶段A 变更：`.phone.h68` 固定档 → 弹性档 `height:auto;flex:1 1 auto;min-height:63.5cqw;max-height:68cqw` + `.phone-cell:has(> .phone.h68)` 拉伸规则，校验和随之刷新；详见 dev/DIAGNOSIS-h68-overflow-2026-11-13.md §8。）（T8 已挂 gate 构建锁：build.mjs `verifySeedChecksum` 每次构建必校验，种子漂移即 FAIL；独立复跑 `node dev/check-seed-lock.mjs`。）（T9 资产入册：`dev/asset-registry.json` 为唯一台账——b64 内嵌源/PNG 交付位/两份字体 CSS（交付渲染字形源，`inlineSeedFonts` 读取处校验，漂移即拒建）/fonts 树目录级 manifest（108 文件，预览资产）；独立复跑 `node dev/check-asset-registry.mjs`，三锁注入取证 `node dev/check-locks-e2e.mjs`。字体演进 = 种子三处同步纪律：改源 → 刷新台账 → 同步锁。）（2026-11-13 阶段B-seed 变更：`.heading` 规则选择器升特异性为 `.p-page .heading`，修复被后定义 `.region{gap:2.4cqw}` 覆盖的 gap 优先级问题，head 区 gap 恢复设计值 1.4cqw，校验和随之刷新；详见 dev/DIAGNOSIS-h68-overflow-2026-11-13.md §8.6。）（2026-11-14 批次C2 变更：布局修饰段新增 `.inset45` panel 内衬档（来源页 46，批次 C 甲案用户拍板，悬置的"46 紧凑边距是否入种子"人审项就此销账），data04-panel 骨架挂类，校验和随之刷新；施工依据 dev/EXEC-PLAN-batchC-2026-11-13.md C2。）

## 配方总表（20 条 · 语义定名 + 角色资格）

| # | R-id | 语义定名 | 级别 | 角色资格（DEVPLAN §4.2 矩阵） | 来源页 | 骨架文件数 |
|---|---|---|---|---|---|---|
| 1 | R-card-01 | 要点逐张页 | 骨架级 | cover / body | 01,20,21,26,28 | 5 |
| 2 | R-cover-02 | 长标题主张页 | 规格级 | cover | 22 | 0 |
| 3 | R-list-01 | 条目+证据页 | 骨架级 | cover / body | 02,03,05,14 | 4 |
| 4 | R-list-02 | 清单页 | 骨架级 | body | 07,16,17,18,19,29 | 5 |
| 5 | R-card-02 | 居中标注页 | 骨架级 | body | 45 | 1 |
| 6 | R-note-01 | 注解读懂页 | 骨架级 | body | 08,34 | 2 |
| 7 | R-note-02 | 整机解读页 | 骨架级 | body | 44 | 1 |
| 8 | R-wall-01 | 图墙页 | 骨架级 | body | 06,24,25,27 | 4 |
| 9 | R-phone-01 | 多屏并陈页 | 骨架级 | cover / body | 04,32,43 | 3 |
| 10 | R-phone-02 | 独幅大图页 | 规格级 | cover / body（页42 kicker 复用封面 topic，复核中） | 23,42 | 0 |
| 11 | R-data-01 | 口径数据页 | 骨架级 | body | 10,30 | 2 |
| 12 | R-data-02 | 数字亮点页 | 骨架级 | body | 35 | 1 |
| 13 | R-data-03 | 账目核对页 | 规格级 | body | 41 | 0 |
| 14 | R-data-04 | 同板作证页 | 骨架级 | body | 46 | 1 |
| 15 | R-compare-01 | 前后对比页 | 骨架级 | body | 12,37,38,39 | 4 |
| 16 | R-compare-02 | 双窗对照页 | 骨架级 | body | 40 | 1 |
| 17 | R-quote-01 | 金句页 | 骨架级 | body | 11,33 | 2 |
| 18 | R-step-01 | 步骤流程页 | 骨架级 | body | 09 | 1 |
| 19 | R-qa-01 | 答疑页 | 规格级 | body | 13 | 0 |
| 20 | R-close-01 | 收尾页 | 骨架级 | closing | 15,31,36,47 | 4 |

合计：骨架级 16 条 / 规格级 4 条；骨架文件 41 个；47 页覆盖无遗漏无重叠（5+1+4+5+1+2+1+4+3+2+2+1+1+1+4+1+2+1+1+4=47，其中 R-list-02 的 6 页对应 5 文件——满栏/末项卡各有 list 与 ck 两个 markup 档）。

## 登记卡（§4.4 模板 + 阶段 2 新增字段：骨架文件 / 内联净化 / 头部烘焙）

```
配方 R-card-01 · 要点逐张页（骨架级）
├─ intent：左列 3-4 张要点卡纵列、右一只整机；封面档=开篇"这份记录是什么、能怎么用"，body 档=内页"逐张看点"
│   反例：内容无可列卖点 → 改 R-cover-02；无整机 → 改 R-note-01；两侧都要标注 → 改 R-card-02
├─ 来源：{01, 26, 20, 21, 28}
├─ 绑定：卡×3-4(left，stagger 除齐列档) + phone×1(right：锁高 / 封面出血档锁宽)；bottom 可选 text-block；封面档加 issue-line+封面槽位
├─ 锚点：h1、卡×≥3、phone；封面档另需 issue-line；降级条款：无整机 → 右载体改 shot.grow 并归 R-note-01
├─ 密度：卡 3-4 条；字数分流——封面档 t≤12/s≤28、body 档 t≤10/s≤26；fcard 需 ic（mn 档除外）
├─ hl 节奏：封面档 1 处固定 h1 后段/中段（禁落 fcard/sub）；body 档 0-1 处
├─ 耦合约束：标题 ≤1 行；出血档标题不接 sub（结构上不存在）
├─ 对账：封面档 kicker←topic、h1←cover-title、sub←cover-intro；卡 t/s←要点 title/detail；phone←整屏截图；bottom←补充说明
├─ 骨架文件：card01-cover-standard←01 ｜ card01-cover-bleed←26 ｜ card01-body-stagger←20 ｜ card01-body-aligned←21 ｜ card01-body-mn←28
├─ 内联净化：页26 出血为种子 .cover-bleed 行为（照抄类名，无内联）；其余无内联项
└─ 头部烘焙：01/20/21/28 按源页实际 head 照抄；26 无 sub → 出血档骨架结构上无 sub；26 footer 省页码
```

```
配方 R-cover-02 · 长标题主张页（规格级）
├─ intent：标题本身是主张（2-3 行自然折行），左正文短注、右一张局部图；用于素材标题偏长时的开篇
│   反例：标题可压缩到 1 行 → 改 R-card-01 封面档；需要多图 → 改 R-wall-01
├─ 来源：页 22（长标题压力页，3 行实测）
├─ 绑定：text-block×1(left) + shot.natural×1(right)；head=kicker+h1+sub；issue-line 必有
├─ 锚点：issue-line、长 h1、text-block、shot；降级条款：无合适配图 → 右侧改 text-block 并归 R-list-01
├─ 密度：正文 ≤3 句；全页组件仅 2 个
├─ hl 节奏：0-1 处；标题 3 行时禁止加 hl
├─ 耦合约束：⚠️ 本配方唯一允许标题 2-3 行；头部下移，左栏正文 ≤4 行（规格级显式写出）
├─ 对账：h1←cover-title(长版)；text-block←cover-intro 段；shot←局部截图
└─ 变体：无（规格级按规格就地组装）
```

```
配方 R-list-01 · 条目+证据页（骨架级）
├─ intent：左列行式条目（编号/复选/纯行）、右侧一个内容载体（手机/双局部图/正文段）
│   反例：条目 >6 → 改 R-list-02；右侧无载体 → 改 R-list-02
├─ 来源：{05, 14, 02, 03}
├─ 绑定：行式列表×3-4(left|full) + 载体×1 组(right)；head=kicker+h1(+sub)；left flex≤1 / right flex≥1
├─ 区域：条目区登记 left|full（EXEC-A1fix B，2026-11-13：14 源页 ck 实落在 full 区，regions 原漏登记致 gate L11 误报；config regions.full allow=[ck,list,text-block] 与本行同笔入册）；ck-phone 档 order/tracks 已纠偏为 [head,full,right]（批次 C1，2026-11-13：原 order 含 left 与骨架/源页 14 矛盾，A1 digest 实测 share 0.483 落 0.46–0.50）
├─ 锚点：kicker、h1、条目×≥3、右载体；降级条款：条目仅 2 且无图 → 改 R-note-01
├─ 密度：条目 3-4 条；t≤14/d≤30；frow 带 cno 编号、ck 带复选、list 素行
├─ hl 节奏：0-1 处，h1 内（14 实测 0；02/03/05 实测 1）
├─ 耦合约束：标题 ≤1 行；右 phone 锁高 ≤104cqw 上限
├─ 对账：条目 t/d←要点 title/detail；phone←整屏 或 shot←局部×2 或 text-block←正文段
├─ 骨架文件：list01-frow-phone←05 ｜ list01-ck-phone←14 ｜ list01-ck-shots-cover←02 ｜ list01-list-text-cover←03
├─ 内联净化：无内联项
└─ 头部烘焙：02/03 为封面档（issue-line+kicker←topic+h1←cover-title），05/14 为 body 档，均按源页照抄
```

```
配方 R-list-02 · 清单页（骨架级）
├─ intent：整页只做一份清单，条数是内容主角
│   反例：需配图/配机 → 改 R-list-01；条目互为对比 → 改 R-compare-01
├─ 来源：{07, 16, 17, 18, 19, 29}
├─ 绑定：行式列表×3-6(full 满栏)；head=kicker+h1(+sub)
├─ 锚点：kicker、h1、清单×≥3；末项卡变体加锚 fcard×1；收底变体加锚 text-block×1+fcard×1(bottom)
├─ 密度：条目 3-6（6 为上限，⚠️ 仅满栏档；末项卡档实测+自检证实上限 4：17=3、19=4，6 条+末项卡溢出 69.5px）｜fcard≤1
├─ hl 节奏：0-1 处（满栏档实测 0；收底档实测 1 在 h1）
├─ 耦合约束：标题 ≤1 行；条数 ≥5 时条目 d≤24 字
├─ 对账：条目 t/d←清单 title/detail；fcard←补充说明；text-block←边界说明
├─ 骨架文件：list02-full-list←16 ｜ list02-full-ck←18（×3-6 参数化，29 为 6 条实例）｜ list02-tail-card-list←17 ｜ list02-tail-card-ck←19 ｜ list02-boundary←07
├─ 内联净化：无内联项
└─ 头部烘焙：各源页实际 head 照抄
```

```
配方 R-card-02 · 居中标注页（骨架级）
├─ intent：一只手机居中，两侧各两张标注卡指向画面
│   反例：只有单侧标注 → 改 R-note-02；无整机 → 改 R-wall-01
├─ 来源：{45}
├─ 绑定：fcard×2 + phone×1 + fcard×2(left 三栏) + serif×1(bottom)；head=kicker+h1（无 sub）
├─ 锚点：h1、phone 居中、两侧卡各×2、bottom serif；降级条款：标注凑不齐 4 张 → 改 R-note-02
├─ 密度：卡 4 张（2+2）；serif ≤2 句
├─ hl 节奏：1 处，h1 中段
├─ 耦合约束：标题 ≤1 行；phone 75cqw 居中，两侧卡列垂直居中
├─ 对账：fcard t/s←画面标注 title/detail；serif←金句式收束
├─ 骨架文件：card02-centered←45
├─ 内联净化：⚠️ phone height:75cqw → 骨架改挂修饰类 .phone.h75（种子待入册，见净化处置表）；fcard inline padding:1.7cqw → 丢弃，骨架用种子默认；fcard 无 ic → 结构上不带 ic 节点（头部烘焙同原则：不需要就结构上不存在）
└─ 头部烘焙：源页 head 无 sub → 骨架无 sub
```

```
配方 R-note-01 · 注解读懂页（骨架级）
├─ intent：左列 2 条旁注短评、右侧详情卡+局部图并排
│   反例：旁注 >3 → 改 R-card-01；证据是整屏 → 改 R-note-02
├─ 来源：{08, 34}
├─ 绑定：mn×2(left flex.8) + dcard×1 + shot×1(right flex1.2)；bottom 可选 text-block
├─ 锚点：h1、mn×2、dcard、shot；降级条款：无详情卡 → dcard 槽改 text-block 并归 R-list-01
├─ 密度：mn 固定 2；dcard×1；shot×1
├─ hl 节奏：1 处，h1 后段；dark 档允许省略
├─ 耦合约束：标题 ≤1 行；左右 flex 0.8/1.2
├─ 对账：mn←旁注 title/detail；dcard←详情 title/detail；shot←局部截图
├─ 骨架文件：note01-light←08 ｜ note01-dark←34（p-page 加 dark 类）
├─ 内联净化：无内联项
└─ 头部烘焙：按源页实际 head 照抄
```

```
配方 R-note-02 · 整机解读页（骨架级）
├─ intent：整机在左给语境、右侧 2 张详情卡逐条解读 + 底部说明
│   反例：证据是局部图 → 改 R-note-01
├─ 来源：{44}
├─ 绑定：phone×1(left flex1) + text-block×1 + dcard×2(right flex1) + text-block×1(bottom)
├─ 锚点：h1、phone、dcard×2、bottom；降级条款：详情卡仅 1 张 → 并入 R-note-01
├─ 密度：dcard 固定 2
├─ hl 节奏：1 处，h1 前段（全画廊唯一前段落位，本配方专属）
├─ 耦合约束：标题 ≤1 行；左右 flex 1/1
├─ 对账：dcard t/d←详情 title/detail；text-block←语境段/bottom 说明
├─ 骨架文件：note02-phone-dcards←44
├─ 内联净化：⚠️ phone height:75cqw → .phone.h75（待入册）
└─ 头部烘焙：按源页实际 head 照抄
```

```
配方 R-wall-01 · 图墙页（骨架级）
├─ intent：一组局部图按网格排布看全貌；可带底部说明
│   反例：图仅 1 张 → 改 R-phone-02；图是整屏多壳 → 改 R-phone-01
├─ 来源：{06, 27, 24, 25}
├─ 绑定：shot×2-4(wall grid)；bottom 可选 text-block
├─ 锚点：h1、图×2-4（每图 caption）；降级条款：仅 1 图 → R-phone-02
├─ 密度：图 2-4；4 图必须 2×2；双图居中档 max-w 46cqw
├─ hl 节奏：0-1 处（06/24/25 实测 0；27 实测 1）
├─ 耦合约束：标题 ≤1 行；fill 档横跨出血 bleed-x
├─ 对账：shot←局部截图；caption←图注；text-block←说明段
├─ 骨架文件：wall01-quad←06 ｜ wall01-quad-fill-bleed←27 ｜ wall01-duo-row←24 ｜ wall01-duo-col←25
├─ 内联净化：无内联项（bleed-x 为种子类）
└─ 头部烘焙：按源页实际 head 照抄
```

```
配方 R-phone-01 · 多屏并陈页（骨架级）
├─ intent：2-3 只整屏并排，屏与屏对照或演进；每屏可带界面名标签
│   反例：仅 1 屏 → 改 R-phone-02；屏上叠旁注 → 改 R-step-01
├─ 来源：{04, 32, 43}
├─ 绑定：phone×2-3 + 每壳 text-block 标签(可选) + bottom 可选
├─ 锚点：h1、壳×≥2；封面档加 issue-line+封面槽位；降级条款：仅 1 壳 → R-phone-02
├─ 密度：壳 2-3；标签每壳 1 条
├─ hl 节奏：0-1 处（04/43 实测 1 h1 后段；32 实测 1 h1 前段）
├─ 耦合约束：标题 ≤1 行；⚠️ 尺寸三档为显式骨架档（封面版锁高 104 上限 / 标签版 h68 弹性档 max68-min63.5 / 三壳版见净化处置）
├─ 装配纪律：列序=叙事序（主屏在左），装配自查+人审把关（43 号页"先看主屏再看辅屏"为实证）
├─ 后果红线：界面名/标签与壳同层（.phone-cell 内），禁塞进带比例 phone 根内——gate L19 拦截；⚠️ gate 不再强制"每壳必有标签"（C3 退役），漏标签由人审把关
├─ 对账：phone←整屏截图×2-3；标签←界面名；bottom 说明←边界文案（text-block；⚠️ 2026-11-13 设计审计修正：trio 档原误用 serif 金句体，已改回 text-block 与全家族统一——serif 仅属 R-quote-01 金句页，此处不再使用）
├─ 骨架文件：phone01-duo-cover←04 ｜ phone01-duo-labeled←43 ｜ phone01-trio-labeled←32
├─ 内联净化：⚠️ 页43 inline height:68cqw → .phone.h68（已入；2026-11-13 阶段A 由固定档改弹性档 max68/min63.5，触底即内容与配方不匹配→换配方/删文案）；页32 inline width:100%;height:auto → 孤例丢弃，骨架回种子默认锁高，三壳锁宽档降为登记卡变体注记（是否新增 .phone.wide 由阶段 4 种子人审裁决）
└─ 头部烘焙：04 为封面档（issue-line+封面槽位）；32/43 为 body 档；均照抄
```

```
配方 R-phone-02 · 独幅大图页（规格级）
├─ intent：单一画面主体独占版心，一图说尽；bottom 必配说明（对账 text-block←说明）
│   反例：需对照 → 改 R-phone-01 / R-wall-01
├─ 来源：{23, 42}
├─ 绑定：单主体(phone 锁高 / shot.fill hero bleed) + bottom text-block×1
├─ 锚点：主体×1、bottom；降级条款：无大图 → 改 R-cover-02
├─ 密度：主体 1；说明 ≤3 句
├─ hl 节奏：0 处
├─ 耦合约束：带壳档标题允许 2 行（页23 实测，头部压缩特例）；hero 档 ≤1 行
├─ 对账：phone←整屏 或 shot←整幅大图；text-block←说明
├─ 骨架文件：无（规格级）
└─ 头部烘焙：规格级就地组装时按登记卡 head 规格执行
```

```
配方 R-data-01 · 口径数据页（骨架级）
├─ intent：数字档 + 柱图 + 深色口径卡，同一口径的多种表达；可带底部说明
│   反例：无图形只列数字 → 改 R-data-02；数字成账目条目 → 改 R-data-03
├─ 来源：{10, 30}
├─ 绑定：ldr×0-2 + bars×1(2-4柱) + darkcard×1(3行,full) + text-block×1(bottom 可选)
├─ 锚点：h1、bars、darkcard；ldr 可省；降级条款：无图形数据 → R-data-02
├─ 密度：ldr 0-2；bars 2-4 柱；darkcard 3 行
├─ hl 节奏：0-1 处（10 实测 1 h1「口径」；30 实测 0）
├─ 耦合约束：标题 ≤1 行；darkcard 宽 ≤right 区
├─ 对账：ldr←数值 title/detail；bars←分组数值；darkcard←口径行×3
├─ 骨架文件：data01-ldr-bars←10 ｜ data01-bars-only←30（ldr 省略档，结构上无 ldr 节点）
├─ 内联净化：无内联项
└─ 头部烘焙：按源页实际 head 照抄
```

```
配方 R-data-02 · 数字亮点页（骨架级）
├─ intent：三个大数字并列 + 底部一张补充卡
│   反例：需要图形 → 改 R-data-01；数字逐条核对口径 → 改 R-data-03
├─ 来源：{35}
├─ 绑定：ldr×3(full) + fcard×1(bottom, max-w 50cqw) + ghost×1(overlay)
├─ 锚点：h1、ldr×3、fcard、ghost；降级条款：数字仅 2 → 并入 R-data-01 带 ldr 变体
├─ 密度：ldr 固定 3；fcard×1 窄卡
├─ hl 节奏：1 处，h1 后段
├─ 耦合约束：标题 ≤1 行；fcard 不满宽（50cqw 居左）
├─ 对账：ldr←数值 k/d/n/u；fcard←补充说明；ghost←当页主题字
├─ 骨架文件：data02-ldr-tailcard←35
├─ 内联净化：无内联项
└─ 头部烘焙：按源页实际 head 照抄
```

```
配方 R-data-03 · 账目核对页（规格级）
├─ intent：数字账目逐条核对（k/d/n/u 四件套）
│   反例：非数字条目 → 改 R-list-02；需要图形 → 改 R-data-01
├─ 来源：{41}
├─ 绑定：ledger×4(full 满栏)；head=kicker+h1
├─ 锚点：h1、ledger×4；降级条款：无 u 单位 → 条目降级为 ldr 并归 R-data-02
├─ 密度：固定 4 条（3-5 可容忍）
├─ hl 节奏：0 处
├─ 耦合约束：标题 ≤1 行（规格级显式写出）
├─ 对账：ledger k/d/n/u←账目四元组
├─ 骨架文件：无（规格级）
└─ 头部烘焙：kicker+h1，无 sub
```

```
配方 R-data-04 · 同板作证页（骨架级）
├─ intent：面板容器内数字+文字与局部图并排，底部标签行
│   反例：无面板直接并排 → 改 R-note-01；纯数字 → 改 R-data-02
├─ 来源：{46}
├─ 绑定：panel×1(full) 内 ldr×1 + text-block×1 + shot.natural×1；pills×1(3 pill, bottom)
├─ 锚点：h1、panel、ldr、shot、pills；降级条款：shot 缺失 → panel 改双 text-block 并归 R-list-02 收底档
├─ 密度：panel 内组件各 1；pills 3 个
├─ hl 节奏：1 处，h1 后段
├─ 耦合约束：标题 ≤1 行；panel 是全页唯一容器
├─ 对账：ldr←数值；text-block←解读段；shot←局部图；pill←口径标签
├─ 骨架文件：data04-panel←46
├─ 内联净化：panel inline padding → 紧凑档 `.inset45` 入种子并挂类（2026-11-14 批次 C 甲案用户拍板，悬置人审项销账；销账记录见下方净化处置表注）
└─ 头部烘焙：按源页实际 head 照抄
```

```
配方 R-compare-01 · 前后对比页（骨架级）
├─ intent：同一对象 before/after 两态对照；横排、四宫格、竖排、深色四档
│   反例：对象 >2 态 → 改 R-phone-01；对照的是独立图 → 改 R-wall-01
├─ 来源：{12, 37, 38, 39}
├─ 绑定：ba×2-4（各含 ul 3li）+ vs 骑缝标记(竖排档) + bottom（text-block 或 serif）
├─ 锚点：h1、ba×≥2；竖排档加锚 vs；降级条款：无 ul 明细 → ba 降级为双 text-block 并归 R-list-02
├─ 密度：ba 2-4；每 ba 恰 3 li
├─ hl 节奏：1-2 处（12/37 实测 1 在 h1；38/39 实测 2——h1+bottom serif 各一）
├─ 耦合约束：标题 ≤1 行；横排等宽，竖排全宽上下叠
├─ 对账：ba label←阶段名；ul li←变化明细；serif←对照结论
├─ 骨架文件：compare01-h2←12 ｜ compare01-grid4←37 ｜ compare01-v2-vs←38 ｜ compare01-v2-dark←39
├─ 内联净化：无内联项
└─ 头部烘焙：按源页实际 head 照抄
```

```
配方 R-compare-02 · 双窗对照页（骨架级）
├─ intent：每列一张局部图压顶 + 对比卡在下，双列并读
│   反例：无图纯卡 → 改 R-compare-01；图为主 → 改 R-wall-01
├─ 来源：{40}
├─ 绑定：flow-grid 2 列，各列 shot×1(1:1) + ba×1；bottom text-block×1
├─ 锚点：h1、shot×2、ba×2；降级条款：缺一列 → 降为 R-note-01
├─ 密度：固定双列；每列 1 图 1 卡（ul 3li）
├─ hl 节奏：1 处，h1 后段
├─ 耦合约束：标题 ≤1 行；shot 1:1 定高，ba 等宽
├─ 对账：shot←局部图×2；ba←各列对比明细
├─ 骨架文件：compare02-shot-ba←40
├─ 内联净化：⚠️ shot inline aspect-ratio:1/flex:none → 孤例丢弃，骨架挂种子默认；1:1 定高档降为登记卡注记（是否入种子由阶段 4 人审）
└─ 头部烘焙：按源页实际 head 照抄
```

```
配方 R-quote-01 · 金句页（骨架级）
├─ intent：一句主张独占版心（serif 大字），可带解释段与印章
│   反例：句子 >2 行语义 → 改 R-cover-02；需条目 → 改 R-list-02
├─ 来源：{11, 33}
├─ 绑定：quote.hero×1(full) + text-block×1(可选) + seal-lg×1(可选) + ghost×1(overlay)
├─ 锚点：quote.hero 必有；极简档仅 h1+quote+ghost；降级条款：金句与正文混排 → 并入 R-close-01 serif 档
├─ 密度：金句 1 句（≤30 字）；解释段 ≤2 句
├─ hl 节奏：1 处，固定在 quote 文本内；禁止落在 h1
├─ 耦合约束：head 极简；quote 竖直居中；⚠️ 省出处 .source 时连分隔线 .rule 一起省（不为一根线补假出处）——gate 不再强制（C5 迁卡），装配自查+人审把关
├─ 对账：quote←金句文本+source+credit；seal←印章；ghost←主题字
├─ 骨架文件：quote01-annotated←11 ｜ quote01-minimal←33
├─ 内联净化：无内联项
└─ 头部烘焙：11 head=h1+sub（无kicker）；33 head=仅 h1（结构上无 kicker/sub 节点）
```

```
配方 R-step-01 · 步骤流程页（骨架级）
├─ intent：4 步流程沿时间线展开，右侧整机+旁注作证
│   反例：步骤无先后关系 → 改 R-list-02；无流程语义 → 改 R-card-01
├─ 来源：{09}
├─ 绑定：timeline(step×4, flex1) + phone×1 + mn×1(right flex1.2) + ghost×1
├─ 锚点：h1、step×4（脊柱线）、phone、mn；降级条款：无顺序语义 → 改 R-card-01
├─ 密度：step 固定 4（3-5 可容忍）；mn×1
├─ hl 节奏：1 处，h1 后段
├─ 耦合约束：标题 ≤1 行；脊柱线贯穿 step 区
├─ 对账：step←步骤 title/detail；phone←整屏；mn←旁注
├─ 骨架文件：step01-timeline←09
├─ 内联净化：无内联项
└─ 头部烘焙：按源页实际 head 照抄
```

```
配方 R-qa-01 · 答疑页（规格级）
├─ intent：三组问答逐条答疑
│   反例：非问答语义 → 改 R-list-02
├─ 来源：{13}
├─ 绑定：qa×3(full)；head=kicker+h1
├─ 锚点：h1、qa×3；降级条款：仅 2 组 → 并入 R-list-02 满栏档
├─ 密度：固定 3 组（2-4 可容忍）
├─ hl 节奏：1 处，h1 后段
├─ 耦合约束：标题 ≤1 行；qa 等距纵排（规格级显式写出）
├─ 对账：qa q/a←问句/答句
├─ 骨架文件：无（规格级）
└─ 头部烘焙：kicker+h1，无 sub
```

```
配方 R-close-01 · 收尾页（骨架级）
├─ intent：页尾收束：标签行(可选)+条款列+金句(可选)+行动指令；四种繁简档
│   反例：非收束语义（中途章节）→ 改 R-quote-01
├─ 来源：{15, 31, 36, 47}
├─ 绑定：pills×1(0/3/5) + cr×2-3(full) + serif×1(可选) + cta×1(bottom) + seal-lg×1(可选) + ghost×1(可选)
├─ 锚点：cr×≥2、cta 必有；降级条款：无行动指令 → cta 槽改 seal 并归 R-quote-01
├─ 密度：cr 2-3；pills ≤5；cta 1 句
├─ hl 节奏：0-2 处（15/31/36 实测 0-1；47 实测 2——h1+serif 各一）；金句档 hl 固定在 serif 内
├─ 耦合约束：⚠️ 金句档标题允许 2 行（页47 inline-block 手动断行，照抄烘焙）；其余 ≤1 行；页15 的 sub 内 hl 为错例不入骨架
├─ 对账：pill←口径标签；cr←条款 title/detail；serif←金句；cta←行动指令
├─ 骨架文件：close01-standard←15 ｜ close01-pills-extended←31 ｜ close01-minimal←36 ｜ close01-quote←47
├─ 内联净化：⚠️ 页47 标题 inline-block 断行 → 保留（属标题排版语义非几何数值，入注记）；页15 sub 内 hl 移除
└─ 头部烘焙：四档均无 kicker（结构上不存在）；15 有 sub、31/36/47 有 sub，照抄
```

## 内联数值净化处置表（§4.3 强制执行，逐项登记）

| 源页 | 内联样式 | 处置 | 骨架落法 | 待阶段 4 种子人审 |
|---|---|---|---|---|
| 32 | phone `width:100%;height:auto` | 孤例丢弃 | 回种子默认锁高，三壳锁宽降为登记卡注记 | 是否新增 `.phone.wide` 档 |
| 43 | phone `height:68cqw` | 可复用档位 | `.phone.h68` | ✅ 已入种子（2026-11-13 设计期增补） |
| 44 | phone `height:75cqw` | 可复用档位 | `.phone.h75` | ✅ 已入种子（2026-11-13 设计期增补） |
| 45 | phone `height:75cqw` | 可复用档位 | `.phone.h75` | ✅ 同上（与 44 共档） |
| 45 | fcard `padding:1.7cqw` | 孤例丢弃 | 骨架用种子默认 padding | 是否为无 ic 卡新增紧凑档 |
| 46 | panel 内联 padding | 可复用档位 | `.inset45`（padding 4.5/5 + gap 4.5） | ✅ 已入种子（2026-11-14 批次 C 甲案，悬置项销账） |
| 40 | shot `aspect-ratio:1;flex:none` | 孤例丢弃 | 种子默认；1:1 定高档降为注记 | 是否新增 `.shot.sq` 档 |
| 47 | h1 内 inline-block 手动断行 | 保留 | 属标题排版语义非几何数值，随骨架照抄 | 无需 |
| 15 | sub 内 hl span | 移除 | 错例不入骨架 | 无需 |

### ⚠️ 渲染自检新增发现（2026-11-13，待闸门裁决——一次性内联清洗颗粒度不足）

首轮自检（38 PASS / 3 WARN）+ 全量内联审计（47 页逐页比对）证实：一刀切清洗破坏了部分**布局功能性数值**。分类如下：

| 类别 | 内联值 | 出现页 | 影响与建议通道 |
|---|---|---|---|
| A1 全局头距 | head `gap:1.4cqw;padding-top:1.4cqw` | 47/47 全部 | ✅ 2026-11-13 改判：种子 `.heading` 默认值本就含同值（paper-journal.html §33），清洗=去冗余，无差异，无需动作 |
| A2 冗余 | body `min-height:0` | 47/47 全部 | 种子 `.body` 已默认同值，源页内联冗余；无需处理，登记即可 |
| B1 区间隙档 | `gap:0` | 03,05,16,17,18,19,29,41 | ✅ 已落地 `.region.tight`/`.flow-col.tight`（17/19 溢出归零实测） |
| B2 区间隙档 | `gap:1cqw` | 07,13,15,31,35,36 | ✅ 已落地 `.gap1` |
| B3 区间隙档 | `gap:5cqw/4cqw/3.4cqw/1.6cqw/2.2cqw` | 08/34/11、28/33、30、38/39、47 | ✅ 已落地 `.gap5/.gap4/.gap34/.gap16/.gap22` |
| B4 区宽比 | `flex:0.8`/`1.2`、`0.9/1.1`、`1/1.2` | 08/34/46、28、09 | ✅ 已落地 `.w08/.w09/.w11/.w12`（与 `.flow-row>.region` 同特异性靠后置胜出） |
| B5 网格档 | wall `grid-template-*`（2×2/2列/1列2行/3列） | 06,27,24,25,02,32 | ✅ 已落地 `.flow-grid.g22/.g2c/.g1c2r/.g3c` |
| B6 图窗比 | shot `aspect-ratio:1280/960` | 02,22,24,25,34,46 | ✅ 已落地 `.shot>img.ar43`（宿主 img，与源页一致） |
| B7 柱高数据 | bars 柱 `height:50/100/75/25%` | 10,30 | ✅ 已参数化 `style="height:{{柱高}}%"`（数据驱动几何豁免通道；gate 阶段 3 补 0-100 整数边界校验） |
| C1 孤例 | p23 居中、p32 三壳、p40 1:1、p45 卡padding、p46 panel padding | 各 1 页 | p40 改判（见下）；p46 已入种子 `.inset45`（批次 C 甲案）；其余维持登记 |

**p40 1:1 改判（2026-11-13 执行期发现）**：`.shot>img{height:0;flex:1 1 0}` 弹性拉伸依赖容器定高，40 的列高由 ba 卡决定 → 丢弃 1:1 后窗高塌陷为 0（探针实测 img height=0）。该内联是双窗对照档的**结构必需约束**，非可丢弃孤例 → 按裁决 2 保留条目通道转种子 `.shot.sq{aspect-ratio:1/1;flex:none;width:100%}`，骨架挂类。请复核。

📌 裁决方式（供闸门参考）：A 类走种子晋升；B 类走种子修饰类（类名随配方语义，与 recipes.json layouts tracks 对齐后 gate 可校验）；C 类维持登记。**B1 必须在目检通过前解决**（已实测溢出），其余 B 类目检可带差异过闸、入册前补齐。

✅ **闸门裁决已下达（2026-11-13，用户拍板"全部按此执行"）**，全文见 DEVPLAN §4.3"阶段 2 目检闸门裁决记录"。要点：B2-B6 类名**改用几何语义**（不随配方语义，防种子耦合注册表）；B7 走 `{{柱高}}` 数据驱动几何豁免通道 + gate 边界校验；页 26 维持无 sub；harness 修复三处（repeat 回溯 / 资产路径 / 假文字形状）后重渲染，用户复核波及页后闸门关闭。

📌 `.phone.h68` / `.phone.h75` 已于 2026-11-13 走 §4.3 保留条目通道入种子（`seed/paper-journal.html` 第 98-100 行，附来源与波及页注释）；§4.6 的 SHA-256 校验登记待 asset-registry 落地时补录本次种子版本。

### 批次 C2 销账记录（2026-11-14，格式对齐 T7 残余清单）

> `p46-panel-padding`（R-data-04 内联净化悬置项，掉账自阶段 2 入册）：**入种子**——新增 `.inset45`（padding 4.5cqw 5cqw + gap 4.5cqw），data04-panel 骨架挂类，A1 p19 的 R14 载体档失配随档恢复（shot 实测 50.2→43.4cqw 落 [41,46]）。**理由**：观感锚点 = 阶段 2 已目检认可的画廊页 46（源页内联逐字迁移：`padding:4.5cqw 5cqw;gap:4.5cqw`）；config 载体档保持源页派生语义不放宽；与 h68"尊重源页设计意图"同向。**兜底**：R14 载体档 [41,46] + 交付目检。**复发处置**：观感偏差 → 回炉登记卡与种子修饰段，不动 gate。施工依据 dev/EXEC-PLAN-batchC-2026-11-13.md C2；种子 SHA 同步 `98E29FC0…`（build.mjs 常量 + 本文头部登记两处，check-seed-lock 自动跟随）。

## 配方↔类映射总表（裁决 3：gate 凭此引用校验；入册时随登记卡迁移）

| 配方 | 挂类（骨架已落地） |
|---|---|
| R-list-01 | left `tight`（02/03/05 档）｜full `tight`（14 档，骨架条目区实挂 full）；02 档 flow-grid `g1c2r` + img `ar43`×2 |
| R-list-02 | full/flow-col `tight`（16/17/18/19 档）、`gap1`（07 档）；尾卡档 repeat ×3-4（上限注记入骨架注释） |
| R-note-01 | left `w08 gap5` ｜ right `w12`；dark 档 img `ar43` |
| R-note-02 | phone `h75`（已入） |
| R-wall-01 | flow-grid `g22`（06/27）、`g2c`（24）、`g1c2r`（25）；img `ar43`（24/25） |
| R-phone-01 | flow-grid `g3c`（32）；h68 弹性档（43，已入） |
| R-card-01 | mn 档 left `w09 gap4` ｜ right `w11` |
| R-data-01 | full `gap34`（30）；柱 `{{柱高}}`×4/×2（B7 豁免） |
| R-data-02 | full `gap1`；fcard `w50` |
| R-data-04 | flow-col `w08`/`w12`；img `ar43` |
| R-compare-01 | full `gap16`（38/39 档） |
| R-compare-02 | shot `sq`（40 双窗，p40 改判项） |
| R-quote-01 | full `gap5`（11）、`gap4`（33） |
| R-step-01 | right `w12`（09） |
| R-close-01 | full `gap1`（15/31/36）、`gap22`（47） |
| 规格级注记 | R-data-03→`tight`、R-qa-01→`gap1`、R-cover-02→img `ar43`（就地组装时挂） |

## 执行记录（2026-11-13，裁决 8 收尾）

- [x] 种子布局修饰段入 `seed/paper-journal.html`（L211-231：7 组 gap + 4 组宽比 + 4 档网格 + ar43 + sq + w50，附来源页注释）
- [x] 31 个骨架文件挂类完毕（全量复核 bad=0）；柱高参数化 6 处；尾卡档 repeat 上限 ×3-4
- [x] harness v3 三修：① repeat 回溯（含闭合标签误判、lastIndex 死循环、count-1 三处修正；want 改按 data-component 查）② 资产路径 → `../../../out/assets/` + iphone-frame.png 补拷 ③ 假文字形状（序字 1 字/副题整句 16 字/标题族短串）
- [x] 重渲染 **41/41 PASS，0 WARN 0 FAIL**（首轮 38P/3W → 终轮全绿）
- [x] 波及页快检通过：37=四宫格 4 ba、12=双卡 2 ba、40=双 1:1 窗（sq）、26=手机框+截图+期号齐、20/21 sub 可见、17/19 条数 3/4 与源页一致且溢出归零

## 验证核对

- [x] 20 条配方 = 草案定案数；骨架文件 41 个（骨架级 16 条全覆盖，规格级 4 条无骨架）
- [x] 47 页来源覆盖无遗漏无重叠 ✓
- [x] 每张登记卡含 §4.4 全字段 + 骨架文件/内联净化/头部烘焙三新增字段
- [x] 内联净化 9 项逐项登记，数值唯一归属种子（第五几何权威封堵）
- [x] 头部烘焙：无 sub / 无 kicker / 无页码档均为"结构上不存在"，运行期零增删（§4.3 头部烘焙规则）
- [x] 41 骨架逐文件抽取完成（4 批并行 + 复核修复：4 处封面期号参数化、5 处 hl 字面文案参数化，全库 hl 内文均为占位符）
- [x] 渲染自检完成（2026-11-13，harness v2：41/41 渲染 0 失败，38 PASS / 3 WARN；出血白名单修正后 cover-bleed 的 236px=22cqw 设计内出血属误报转 PASS；目检页 dev/_sc/index.html）
- [x] 渲染自检终版（2026-11-13，harness v3 + 种子修饰类落地后：**41/41 PASS，0 WARN 0 FAIL**；目检页 dev/_sc/index.html 已重建）
- [x] 用户复核波及页快检通过（2026-11-13 闸门关闭），41 骨架 + 20 卡 + 种子修饰段整体入册 references/
- [x] 入册检查单：① 种子最新版（含修饰段）SHA-256 已登记（见头部种子基线）；② iphone-frame.png 已迁入 references/assets/，入册产物无 dev 路径引用

### 入册检查单（2026-11-13 用户追加两条，迁移时执行）

1. **种子以最新版（含修饰段）为准登记校验和**——迁移时计算 `seed/paper-journal.html` 的 SHA-256 并登记，阶段 4 的只读校验以此版本为基线
2. **`iphone-frame.png` 随骨架一起迁入 `references/` 对应资产位**，不许留 dev 路径引用（`dev/controlled/.../out/assets/` 与 `dev/cases/assets/` 均不得出现在入册产物中）

<!-- APPEND -->
