# 约束归属映射（阶段 3 产出物 A）

> 依据：DEVPLAN-recipe-convergence-2026-11-12.md §3 阶段 3、§4.5 瘦身判据、§4.6 种子只读。
> 方法：逐条登记现存约束"现在住哪几层 → 收敛后唯一归属层"；映射到两处以上即冲突项，逐条裁决。
> 纪律：本文档先于 gate-slimming.md（产出物 B）产出；B 只执行本文的裁决，不重开归属争论。
> 状态：2026-11-13 初稿，待用户复核后移交 B 执行。

---

## 0. 事实基线（先于一切裁决的账目澄清）

执行本映射前实测发现三处账目漂移，**裁决均以实测为准**：

| # | 事实 | 来源 | 影响 |
|---|---|---|---|
| F1 | 41 个入册骨架 `data-recipe` **仍是 P 码**（P01–P12），与 `config/recipes.json` 一致 | grep `references/recipes/*.part.html` 实测 41/41 | DEVPLAN §3"入册时统一改 R 码"的用户裁决**未执行**。P→R 迁移（骨架 41 处 + recipes.json 12 条 + negative-index + 受控套件 + 登记卡残留引用）是阶段 3 同批任务 |
| F2 | 负例索引实际登记 **175 条**（lint74/geometry25/pass35/load32/pipeline5/build3/direct-probe1），HANDOFF 的"183/183"是历史口径 | `negative-index.json` suite.total=175；HANDOFF §126 记 183 | 一切"183 负例回归"表述按 **175 现行基线**执行；B 开工第一步重跑 `test-controlled.mjs` 重建夹具库 + `check-negative-index.mjs --write` 重建索引，以重建后的实际数为准 |
| F3 | 索引指向的夹具目录 `controlled-negative-1111-2251` **已被清理**，磁盘只剩两个旧库（library-1111-1046 / composition-1111-1148） | 实测 `dev/controlled/` 目录 | 索引当前不可对账；夹具由 `test-controlled.mjs` 现场生成，回归前必须先重跑套件 |

规则码实存口径：L 系 **17 个码**（L0,L1,L6,L8,L9,L10,L11,L14,L15,L16,L17,L18,L19,L20,L21,L22,L23）、R 系 **16 个码**（R0–R4,R7–R16,R18），另有 FONT/BUILD/BATCH 管道码。DEVPLAN"43 条"为写作时口径；**B 的处置单位 = 规则码**（33 码 + 3 管道码），同码内个别检查点分道处置的在下表逐行注明。

---

## 1. 约束现住的九层

| 层代号 | 位置 | 性质 |
|---|---|---|
| **L-gate** | `tools/lint-dom.mjs` | 静态 DOM 检查（浏览器 DOMParser，不导航不可信页） |
| **R-gate** | `tools/validate.mjs` | 真实渲染几何检查（1080×1440 实测） |
| **LOAD** | `tools/project.mjs` loadProject | 契约加载期拒绝（抛错，不出报告） |
| **BUILD** | `tools/build.mjs` | 素材签名/内嵌/种子壳构建期校验 |
| **CFG-recipe** | `config/recipes.json`（P01–P12） | 旧配方配置：regions.allow/max、require、form、layouts（order/tracks/headline/carriers/counts/anchor）、issue |
| **CFG-comp** | `config/components.json`（26 组件） | 组件目录：shapes 形态选择器、区域 allow 交叉 |
| **DOC** | `references/02-constraints.md`、`references/03-components.md` | 规则文档化（gate 行为的说明书） |
| **CARD** | `references/04-recipes.md` 登记卡（20 条 R 配方） | 新规格层：绑定（组件×条数×区域）、锚点、密度、hl 节奏、耦合约束、对账、降级条款、角色资格矩阵 |
| **SKELETON** | `references/recipes/*.part.html`（41 骨架） | 结构天然承载：组件选择、区域、排布、修饰类已锁死 |

收敛目标态（DEVPLAN §4.5.5，全文裁决的唯一标尺）：

> **gate = 后果检查（溢出/碰撞/密度/最小字号）+ 来源对账（pool/uses/data-from/quotes 逐字）+ 种子/资产完整性 + 占位符残留；不含任何条数/排布/组件选择类检查。**
> 条数类 → 配方登记卡（CARD）；排布类 → 骨架文件（SKELETON）天然承载；配方已锁决策的复述检查 → 砍。

---

## 2. L 系逐条映射（17 码）

| 规则码 | 内容 | 现住层 | 收敛后唯一归属 | 裁决 | 说明 |
|---|---|---|---|---|---|
| **L0** | 标签/属性白名单、src 安全、禁动态 CSS/视口单位/fixed、禁 head、禁 html/body 属性 | L-gate + DOC | **L-gate** | **保留** | 安全边界与静态卡片前提，与配方决策无关。DOC 同步保留说明 |
| **L1** | data-bleed 只能声明在组件根 | L-gate + DOC | **L-gate** | **保留** | 豁免机制完整性：放错位置会让 R1/R16 的 bleed 判定失真（后果前置条件） |
| **L6** | ① `.p-page` 恰一/唯一顶级/data-artwork/data-size ② brand/footer 恰一 ③ data-recipe 与计划一致 ④ dark 类与计划一致 ⑤ issue：位置/data-layer/恰一/封面资格/文字对账 ⑥ brand 文字对账 | L-gate + LOAD(meta.brand 非空) + CFG-recipe(issue 字段) + CARD(角色矩阵) | ①②③④⑥ → **L-gate**；⑤ 的"封面资格" → **CARD**（资格矩阵已收拢），⑤ 的"文字对账" → **L-gate** | **拆分**：主体保留；封面资格判断待 P→R 迁移后随 CFG-recipe 的 issue 字段迁入登记卡。⚠️ 冲突项 C1 | 资格判断现住两处（CFG-recipe.issue 布尔 + 04-recipes 角色矩阵），收敛后矩阵是唯一裁决者；gate 只查"计划里声明了 issue 就必须出现且逐字一致"（账目，不是资格） |
| **L8** | 来源对账：data-from 非空/pool 存在/uses 在册/文字叶必有来源/数字逐字对账/豁免标记不带文案 | L-gate + DOC | **L-gate** | **保留** | 来源对账核心，DEVPLAN 保留类明文。数字对账、豁免反绕全在此码 |
| **L9** | 图层契约：data-layer 格式/唯一/必有；data-group；data-editable="text"；data-slot | L-gate + DOC | **L-gate** | **保留** | 机器契约（editor.manifest / geometry-digest 的坐标依据），非配方决策 |
| **L10** | uses 双向对账（data-from ⊆ uses 且 uses ⊆ data-from） | L-gate + DOC | **L-gate** | **保留** | 账目闭环，防资产暗度陈仓 |
| **L11** | ① 区域 allow + 区域 max ② require 下限 ③ form 形态 ④ 组件存在性/区域合法性/禁嵌套/必须归组件根 | L-gate + CFG-recipe + CFG-comp + DOC | ①②③ → **CARD**（P→R 迁移后）④ → **L-gate** | **拆分（本次瘦身核心）**：①②③ 是"组件选择+条数+形态"类——骨架级配方已由 SKELETON 锁死、规格级由登记卡绑定字段锁死，gate 检查它们是复述已锁决策。④ 是结构契约保留。⚠️ 冲突项 C2 | ①②③ 迁移的代价与安全网见 §4-C2；R13 随动 |
| **L14** | 数字单位与所引资产一致 | L-gate + DOC | **L-gate** | **保留** | 来源对账细粒度 |
| **L15** | data/quotes 单来源文案与资产 text 逐字（paraphrase 告警） | L-gate + DOC | **L-gate** | **保留** | 来源对账逐字核心，DEVPLAN 明文 |
| **L16** | 其余类别无文字重叠 → WARN | L-gate + DOC | **L-gate** | **保留** | WARN 性质，配合目检 |
| **L17** | 内联 style 禁覆盖外观属性/禁自造 CSS 变量 | L-gate + DOC | **L-gate** | **保留** | 外观唯一来源是种子——即"种子完整性"的页面侧守卫，DEVPLAN 保留类 |
| **L18** | 布局清单外属性名 → WARN | L-gate | **L-gate** | **保留** | WARN，拼写兜底 |
| **L19** | 同区 ≥2 只 phone 必须各有 .phone-cell + 界面名 text-block | L-gate + DOC | 候选：**CARD 绑定字段** + 后果化 | **冲突项 C3，倾向后果化改写** | 现规则复述"多机并排每只要界面名"的配方决策；但砍后坏例（图注塞进带比例 phone 根 → 压坏画面）R10/R3 未必接得住。B 阶段负例实证：接得住 → 砍；接不住 → 改写为"带比例的 phone 根内不得有文字叶"（结构后果，与构图无关） |
| **L20** | 骨架档：order 区域存在与顺序、tracks 区域存在、counts 件数区间 | L-gate + CFG-recipe.layouts + SKELETON | order/tracks 存在性 → **SKELETON**（天然承载，gate 检查属复述）；counts → **CARD** | **砍 + 迁移**：⚠️ 冲突项 C4 | 照抄骨架不可能违反 order/tracks；违反即"手改骨架"——那是 C4 裁决的 R14 渲染层职责，静态层再查一遍是双住。counts 是条数类迁登记卡 |
| **L21** | overlay 区域必须是 .p-page 直接子级 | L-gate | **L-gate** | **保留** | ghost 定位锚点唯一性是几何正确性前提（锚错祖先 = 位置漂移），属后果前置 |
| **L22** | 金句组保留 .rule 却省 .source → ERROR | L-gate + DOC | **CARD 绑定字段** | **冲突项 C5，倾向迁移** | 复述"省出处连 rule 一起省"的单配方决策（只管 serif 组件）；无溢出/碰撞后果，保留层拦不住也不需要拦。迁登记卡 quote 配方绑定字段 |
| **L23** | 出血区域缺配文（head/bottom 无文字叶）→ ERROR | L-gate + DOC | 候选：**CARD** | **冲突项 C6，倾向保留** | "整页只剩图"是读者体验后果（无信息锚点），R12 只查 main.body 接不住 hero 出血页；跨多条配方（R-card-01 封面出血/R-phone-02/R-wall-01），非单配方决策。B 负例实证后定 |
| **FONT** | @font-face 声明分片全部未加载 → WARN | R-gate(validate) + DOC | **R-gate** | **保留** | 环境如实记录 |

---

## 3. R 系逐条映射（16 码）

| 规则码 | 内容 | 现住层 | 收敛后唯一归属 | 裁决 | 说明 |
|---|---|---|---|---|---|
| **R0** | 画布 1080×1440；brand/footer 可见且有文字 | R-gate + BUILD(种子壳) | **R-gate** | **保留** | 种子完整性/骨架身份 |
| **R1** | 越出画布/越出区域/进 footer 保护区/压 brand·footer 文字 | R-gate + DOC | **R-gate** | **保留** | 后果检查核心 |
| **R2** | 独立组件重叠/文字互压/文字被外部媒体遮挡 | R-gate + DOC | **R-gate** | **保留** | 碰撞后果核心 |
| **R3** | 文字横向溢出/被裁切 | R-gate + DOC | **R-gate** | **保留** | 溢出后果核心 |
| **R4** | 图片未加载/损坏 | R-gate + BUILD(签名) | **R-gate** | **保留** | 后果（BUILD 拦伪造，R4 拦加载失败，互补不重复） |
| **R7** | 四分带留白 >216px → WARN | R-gate + DOC | **R-gate** | **保留** | 密度 WARN，DEVPLAN 保留类明文"仅供目检" |
| **R8** | 声明 data-oneline 却折行 | R-gate + SKELETON(修饰类) + CARD | **R-gate** | **保留** | 声明承诺被打破 = 后果；谁声明（骨架/CARD）不重要，违反即交付风险 |
| **R9** | contain 留白严重失配 → WARN | R-gate + DOC | **R-gate** | **保留** | WARN 构图提示 |
| **R10** | 声明 aspect-ratio 被压 | R-gate + SKELETON + CFG-comp | **R-gate** | **保留** | 比例被压是布局错误后果 |
| **R11** | img 量出 0 宽/高（塌陷） | R-gate + DOC | **R-gate** | **保留** | 可见性过滤盲区兜底 |
| **R12** | main.body 无可见组件 | R-gate + DOC | **R-gate** | **保留** | 子树隐藏免检的兜底 |
| **R13** | 配方 require/form 全部不可见 | R-gate + CFG-recipe | 随 L11①②③ → **CARD**（退役） | **冲突项 C2 随动：倾向退役** | 它只服务 require/form 的可见性面。骨架级照抄骨架必有该组件（结构性保证）；规格级无 require。若保留 require 于 CARD 且 gate 不再读，R13 无输入即退役。B 负例实证 |
| **R14** | 骨架档渲染校验：列宽占比/标题行数/载体宽度档/锚点载体 | R-gate + CFG-recipe.layouts + SKELETON | **R-gate**（改写：渲染层骨架完整性守卫） | **保留但收窄**：⚠️ 冲突项 C4 + B7 落地 | 静态层（L20）砍掉后，"手改骨架数值"只剩这层能拦——保留。收窄与改写：① carriers/counts/anchor 已在 LOAD 层拒绝内容组件（白名单负例 3 条），保持；② **B7 裁决落地：bars 柱高走数据驱动几何豁免 + gate 对柱高参数做 0–100 整数校验**（阶段 2 已参数化 .bars 柱高，本阶段把校验接进 LOAD 层）；③ headline 行数保留（内容×骨架的耦合后果，49 分钟病根 1 的对策） |
| **R15** | 时间线步内拉伸余量 >12cqw | R-gate + DOC | **R-gate** | **保留** | 构图不变量（空洞后果），DEVPLAN 明文保留 |
| **R16** | 声明 data-bleed 未贴到出血边 | R-gate + DOC | **R-gate** | **保留** | 声明不实 = 后果（借豁免在画布内飘） |
| **R18** | 页脚折行破坏 --bleed-edge 数学前提 | R-gate + SKELETON | **R-gate** | **保留** | 出血几何的正确性前提 |
| **BUILD/BATCH** | 素材签名/扩展名/手写 dataURL/轮转/锁/输出目录 | BUILD + pipeline | **BUILD** | **保留** | 素材登记与来源追溯 |

---

## 4. 冲突项逐条裁决（C1–C6）

### C1 封面期号资格（issue）
- **现住两处**：CFG-recipe `issue:true`（P01）+ 04-recipes 角色资格矩阵（cover/closing 资格封闭枚举）。
- **裁决**：矩阵是唯一裁决者（DEVPLAN §4.2 已定"AI 全程不做角色判断"）。gate 的 L6 只保留账目面："计划声明了 issue → 必须出现且与 meta.issue 逐字一致；计划没声明 → 不得出现"。P→R 迁移时 issue 资格随登记卡走，CFG-recipe 的 issue 字段迁入 CARD 封面档规格。
- **验证**：负例 `issue-on-non-cover` 类在新 gate 下仍 FAIL（L6 账目面拦截）。

### C2 条数/形态/组件选择的三重登记（本次瘦身核心）
- **现住三处**：CFG-recipe（regions.max / require / form / counts）+ L-gate（L11①②③ + L20 counts）+ R-gate（R13）。
- **裁决**：收敛到 **CARD 唯一归属**。
  - 骨架级配方（16 条 41 骨架）：组件选择、区域、条数区间已由骨架文件结构性锁死——AI 照抄骨架，gate 检查 allow/max/require/form/counts 是对已锁决策的复述，**全部迁出 gate**。
  - 规格级配方（4 条）：无骨架，条数/组件约束写在登记卡绑定字段，由 LLM 组装时遵守 + 人审兜底——gate 同样不查（DEVPLAN 目标态明文"不含条数/组件选择类检查"）。
  - gate 保留 L11④（组件存在性/区域合法性/禁嵌套/归组件根）——这是组件制度本身，不是任何一条配方的决策。
  - R13 退役（无输入）；若 B 负例实证规格级组装需要最低可见性兜底，R12 已覆盖"整页空"，不回炉 R13。
- **安全网**：P→R 迁移同批改 recipes.json 后，CFG-recipe 仅保留区域 allow/几何骨架数据（服务 LOAD 层合法性 + R14），require/form/counts 字段删除；对应负例子集（L11/R13 类）改由"后果检查仍拦的"重新登记预期，拦不住的坏例回炉后果化。

### C3 多机界面名（L19）
- **现住两处**：L-gate + DOC + 各多机配方登记卡绑定字段（R-wall-01/R-phone-01 隐含）。
- **裁决**：倾向**后果化改写**——"带比例的 phone 根内不得含文字叶"（压坏画面是几何后果，与配方的'界面名'决策解耦）。原 L19 退役。B 阶段以 `phone-cell-*` 负例子集实证：R10/R3/改写后规则三者必须仍全拦。

### C4 骨架复述的双层检查（L20 + R14）
- **现住两层**：静态层 L20（order/tracks 存在性/counts）+ 渲染层 R14（列宽/行数/载体档/锚点）检查同一批骨架锁定值。
- **裁决**：静态层**砍**（照抄骨架不可能违反；违反 = 手改骨架，属渲染结果问题），渲染层 R14 **保留**为唯一守卫（实测才量得出 cqw 偏差）。counts 迁 CARD。R14 按 B7 落地数据驱动柱高豁免。
- **验证**：`layout-order-*` 类负例改由"手改骨架 → R14 越档"的等价坏例登记，仍 FAIL。

### C5 金句分隔线（L22）
- **裁决**：**迁移**——单组件单配方决策，无几何后果。迁 R-quote-01 登记卡绑定字段："省出处时连 rule 一起省"。gate 砍。负例 `rule-without-source` 预期改为 passed（目检项），登记卡标注。
- ⚠️ 此条从 ERROR 降为登记卡文字，属"拦不住也不再拦"的显式接受项，用户复核时重点确认。

### C6 出血配文（L23）
- **裁决**：**保留**——跨配方读者体验后果（整页只剩图），R12 接不住 hero 出血页。若 B 负例发现误伤（合法纯画面页），回炉为"hero 出血且 head 也空"的收窄版。

---

## 5. 保留类的缺口登记

| 缺口 | 现状 | 处置 |
|---|---|---|
| **占位符残留检查** | **不存在**——DEVPLAN 保留类明文要求"成品 HTML 残留 `{{` 即 FAIL"（2026-11-12 用户裁决），现行 gate 无此规则 | B 阶段新增（建议规则码 L24）：成品 HTML/最终渲染文本含 `{{` 即 ERROR；负例补入索引 |
| **最小字号检查** | 不存在。种子锁字号 + R3 溢出兜底 | B 阶段裁决是否需要：默认不新增（种子完整性 L17 已堵字号改写入口），登记即可 |
| **种子只读校验** | 不存在（阶段 4 任务，此处只登记接口） | 阶段 4：SHA-256 比对入 asset-registry，基线 = 04-recipes.md 头部登记值 `5318D18B…D958`（2026-11-13 随 P→R 迁移刷新） |

---

## 6. 移交 B 的处置清单（预标汇总，B 只执行 + 负例实证）

| 处置 | 规则码 |
|---|---|
| **保留**（不动） | L0 L1 L6(主体) L8 L9 L10 L11④ L14 L15 L16 L17 L18 L21 L23* FONT R0 R1 R2 R3 R4 R7 R8 R9 R10 R11 R12 R14(收窄+B7) R15 R16 R18 BUILD/BATCH |
| **拆分** | L6（资格面→CARD）、L11（①②③→CARD，④留） |
| **迁移** | L11①②③、L20 counts、L22 → CARD |
| **砍** | L11①②③的 gate 检查、L20（order/tracks 存在性）、R13 |
| **后果化改写候选** | L19（C3） |
| **新增** | L24 占位符残留；LOAD 层柱高 0–100 整数校验（B7） |
| **前置同批** | F1 P→R 全链迁移（41 骨架 + recipes.json + 受控套件 + 索引 + 登记卡残留）；F2/F3 重建夹具库与索引 |

*L23 标注：C6 保留倾向，B 负例实证后可收窄。

执行顺序（不可倒）：F1 迁移 → 重建索引跑通 175 基线 → 按上表逐条砍/迁（每条跑一次全量负例）→ 拦不住的回炉后果化 → 产出 gate-slimming.md 终稿。
