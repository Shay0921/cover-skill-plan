# 后续执行路线图 TODO（2026-11-13）

> **▶ 当前指针（2026-11-13 更新）：T6 五刀全部落地 · 下一步 = T7 人审闸门（阶段 3 收口，材料见指针末行，待用户复核）**
>
> - T1–T5 已收口；T6 已落五刀：**C3**（L19 后果化，0917）+ **C5**（L22 迁卡，0934）+ **C6**（L23 复核保留，1028）+ **拆分类**（L11①②③/L20/R13 砍，1103）+ **config 独立小批**（四字段 28 处删除 + 加载期校验随删 + 10 条 loadReject 退役，1220）；当前套件 **178/178**，基线 scope → `controlled-negative-1113-1220`，对账退出码 0
> - 第五刀账目修正：loadReject 退役实为 **10 条**（批复清单 9 条漏数 `component-shapes-need-directory`——form-shape 校验的目录侧孪生，实测空转后补退）；`require-belongs-to-recipe` 区域绊线保留改 pattern；外科手术式删字段（git diff 证明改动行 100% 四字段，R14 输入面原样）；七维自查：require↔卡/allow↔卡/allow↔骨架/form↔require/order-tracks↔骨架/counts↔条数/码一致性——四字段相关维度随删除 N/A，allow 与骨架零触碰，coverage 机械复核经 178 全绿套件覆盖
> - pipeline digest 的 counts 为输出标签，已核非消费面（批复条件 2，免复查）
> - **批次 C 登记（骨架修复，gate 阶段 3 范围外）**：① duo-labeled h68 溢出定性单（E2 实锤：真实管线 R1 ×6，证据 `dev/e2-duo-h68-1113` + 驱动脚本 `dev/e2-duo-labeled.mjs`）；② 修复决策（h68 降档 or 登记卡加"head 极简"适用条件）待批次 C 裁决，归阶段 4 种子人审；③ 修复后 `dev/_sc` 43 号重渲 + 真实管线复验销单
> - **T7 闸门材料清单**：六刀 commit 链（待 git 按刀补提）+ 基线轨迹（0440 始 183 → 0853/0902/0915/0917/0928/0934/0951/1010/1028/1057/1103/1131 → **1220 = 178**）+ 残余接受清单（skeleton-order-wrong-sequence 镜像构图、form-shape-invisible 隐藏形态，均有人审/登记卡兜底）+ B–E 销账记录 + E2 定性结论（duo-labeled h68 骨架实锤 R1×6，批次 C 已登记）
> - 账目修正（2026-11-13）：`phone-count-over-cap` 定层 R1→**R10**（同区挤压致声明比例失真 skew>1%；R10=比例失真、R1=越界，实测定性），夹具/归属图/TODO 三处同步，基线重建 1131
> - 残余裁决已落地（2026-11-13）：R-phone-01 卡新增装配纪律"列序=叙事序（主屏在左）"；T14 预登记"7 页逐页对照登记卡 hl 节奏"（form-shape-invisible 残余保险丝）；`_sc` 整批重渲 + index 列头注明"右=11-11 历史归档（永不改）"
> - 附属项已清（2026-11-13）：R-phone-02 卡 intent 统一"bottom 必配"（C6 张力裁决）；`dev/_sc` 41 张骨架预览整批重渲（41/41 PASS，32 号不一致与 43 号坏快照已消）
> - T4 P→R 已全部完成（生产面+dev 副本；新夹具 P 码归零，249 文件携 R 码）
> - ⚠️ T6 各刀改动待 git 按刀单独 commit（用户侧）：`tools/lint-dom.mjs`、`tools/validate.mjs`（R13）、`dev/test-controlled.mjs`、`references/04-recipes.md`（R-phone-01/R-quote-01/R-phone-02 卡）、`references/02-constraints.md`（L19/L22/L20/R13/max 口径）、归属图/TODO、归档 0917/0934/1028/1057/1103
> - 阶段闸门 T7 必须用户确认
> - 🗑 删除裁决（监工已核，2026-11-13）：`controlled-slim-1113-1/` **可整目录删除**——索引已指向 1113-0853、全仓无脚本/文档依赖、内容为新库子集；删后 git 提交一笔。⚠️ 11-11 两个归档（composition-1111-1148 / library-1111-1046）是受保护历史快照，**永不删改**

> **用途**：会话压缩后的新任务启动文档。按顺序执行，每步有完成判据；完成一项勾一项。  
> **配套文档**（按需查阅，本文档为唯一执行顺序来源）：
>
> - `dev/DEVPLAN-recipe-convergence-2026-11-12.md` —— 五阶段总施工图（含全部裁决记录）
> - `dev/constraint-ownership-map.md` —— 阶段 3 产出物 A（33 规则码三分类 + C1-C6 冲突裁决）
> - `dev/config-audit-2026-11-13.md` —— 七维审计 + 批次 A/B 修复方案
> - `references/04-recipes.md` —— 20 张登记卡（规格级配方 require/allow 的唯一锚）
> - `dev/controlled/negative-index.json` —— 回归基线（2026-11-13 T6-C3 后：scope → `controlled-negative-1113-0917`，count=188，对账全绿；后续每刀以此为回归基准。过期库 1113-0853 / 1113-0902 / 1113-0915（中途失败品）均已被 0917 取代，确认后可删）
> - `dev/MILESTONE-PENDULUM-2026-11-12.md` —— 论证档案（阶段 5 验收看 §5.4）

## 当前进度快照（勿重做）

- ✅ 阶段 0/1/2 完成：盘点、20 条配方、41 骨架、登记卡入册 `references/04-recipes.md`，阶段 2 闸门已关
- ✅ 阶段 3 产出物 A（constraint-ownership-map.md）完成；C3/C5/C6 已裁决（按 A 文档执行 + F1 范围扣除 11-11 画廊档案）
- ✅ 审计完成：七维对账 8 项问题清单（见 config-audit）
- ✅ 批次 A（config 6 处）已改完并 delta 复核：data-02→[["ldr"]]、data-03→[["ledger"]]、phone-01→[["phone"]]、wall-01→[["shot"]]、compare-01 补 bottom?
- ✅ 第六轮回归收口：`controlled-slim-1113-1/test-results.json`（11-13 01:54）183/183 全部符合预期
- ✅ 批次 B 生产面（11-13 01:53）：config/recipes.json 20 条 R-id 化 + references/recipes/ 41 骨架 R 码化，与登记卡三方一致
- ✅ 批次 B dev 副本（11-13 用户裁决"迁移而非封存"，git 可追溯历史）：dev/recipes/ 41 骨架 data-recipe P→R 改写完成，实测 dev↔生产逐一一致、P 码归零；11-11 画廊档案（controlled-composition-1111-1148）按原裁决不动

---

## 第一部分：阶段 3 收尾（约束归属映射 → gate 瘦身）

### T1. 第六轮回归收口（✅ 2026-11-13 01:54）

- [x] 第六轮全绿：`controlled-slim-1113-1/test-results.json` 183/183 全部符合预期 → 进入 T2
- [ ] 判据达成：全量回归 0 FAIL

### T2. lint 轮（✅ 2026-11-13）

- [x] lint 层全套随全新夹具套件全量执行：`node dev/test-controlled.mjs dev/controlled/controlled-negative-1113-0853` → 183/183 passed，lint 维度 0 FAIL（lint 拦截面 77 条夹具全部按预期命中）
- [ ] 判据达成：0 FAIL，无审计漏项

### T3. 重建负例基线（✅ 2026-11-13）

- [x] `test-controlled.mjs` 现场生成 `controlled-negative-1113-0853`（183 夹具，自然携带 R 码）→ 索引 scope 指向 → `check-negative-index.mjs --write` 重建 → 裸跑对账退出码 0（missing/stale/unrecorded/unaccounted/drift 全零）
- [ ] 📌 口径落实：基线数以重建后实际数为准 = **183**（lint77/geometry25/pass36/load36/pipeline5/build3/direct-probe1）；旧"175"口径作废
- [ ] ⚠️ 账目差登记：slim-1113-1 内孤儿夹具 `anyof-wall01-phone-only` 不阻塞重建（新库无此差）；删除候选，由用户执行
- [ ] 判据达成：索引与夹具一一对应、全绿；此后任何 gate 改动以此为回归基准

### T4. 批次 B：41 骨架 P→R 改码（✅ 已完成，2026-11-13）

- [x] 生产面：`references/recipes/` 41 骨架 + `config/recipes.json` 20 条均已 R 码化（入册时完成）
- [x] dev 副本：`dev/recipes/` 41 骨架按用户裁决（11-13，git 可追溯历史故迁移而非封存）改为对应 R-id，与生产面逐一一致
- [x] ⚠️ `dev/controlled/controlled-composition-1111-1148`（11-11 画廊档案）**不改**——历史快照保真
- [x] 剩余验证项（已随 T3 重建轮完成，2026-11-13）：夹具/索引重建 + 全量回归 183/183；新夹具 P 码归零（249 文件携 R 码）
- [ ] 判据达成：grep `data-recipe="P` 在 dev/recipes/ 与 references/recipes/ 均归零 ✅；回归全绿 ✅

### T5. gate 补占位符残留检查（L24）（✅ 2026-11-13）

- [x] `tools/lint-dom.mjs` 新增 L24：成品 HTML 任何位置（文本/属性/注释）含 `{{` 即 ERROR（`inspectFragmentDOM` 入口处对原始 html 串检查）
- [x] 正负例 3 条补入套件：`placeholder-residue-text`（文本残留→L24）、`placeholder-residue-attr`（属性残留→L24）、`placeholder-clean`（干净对照→passed）；全套件重跑 **186/186**，索引重建 count=186、scope → `controlled-negative-1113-0902`，裸跑对账退出码 0
- [x] 约束归属图 §5 缺口表已同步"已落地"
- [ ] 判据达成：含占位符的页面被拦（文本/属性两个位置均取证）；干净页通过 ✅

### T6. gate 瘦身逐刀（按 constraint-ownership-map.md §4/§6 顺序）

- [x] **C3**（✅ 2026-11-13）：L19 后果化改写落地——原"多机 .phone-cell + 界面名"退役归 R-phone-01 卡；gate 改为"带比例（锁高）phone 根内禁文字叶"。实证 4 例：`phone-root-short-text`（短文字，新 L19 唯一守卫）、`phone-auto-height-text`（auto 壳放行对照）、`phone-wall-without-cell`（**R1 后果层接住**）、`phone-wall-without-caption`（真实形态放行归卡人审）。套件 188/188，基线 scope → `controlled-negative-1113-0917`，对账退出码 0
- [x] **C5**（✅ 2026-11-13）：L22 迁卡落地——gate 删除检查块；`quote-rule-without-source` 改登记 passed+目检项（实证放行，无几何/账目后果）；R-quote-01 卡耦合约束写明"省出处连 rule 一起省，装配自查+人审把关"。套件 188/188，基线 scope → `controlled-negative-1113-0934`，对账退出码 0
- [x] **C6**（✅ 2026-11-13）：L23 复核通过，**保留原样未收窄**——误伤探测不成立：登记卡无"无 head/bottom 文字"的合法出血页（R-wall-01 锚点 h1；R-phone-02 绑定 bottom×1；封面出血必有 issue-line+h1）。夹具矩阵完备（3 例），结论固化夹具注释。⚠️ 顺带发现：R-phone-02 卡"可带底部说明" vs 绑定 bottom×1 口径张力，待用户裁决。套件 188/188，基线 scope → `controlled-negative-1113-1028`，对账退出码 0
- [x] **拆分类（✅ 2026-11-13 T6 第四刀）**：L6 账目面留 gate、L11④ 结构契约留 gate（实证：disallowed-region 落 L195）；砍 L11①②③、L20 静态层、R13。18 条夹具重登记，实测校准：缺省类→passed+目检（组件选择归卡）、隐藏类→R12 兜底、件数越界→R14/R10、缺区域→R14；显式接受残余 2 项（列序交换渲染等价、组件内隐藏形态）。套件 188/188，基线 scope → `controlled-negative-1113-1103`，对账退出码 0
- [ ] ⚠️ 纪律：**每刀 git 单独 commit**；每刀后全量负例回归（当前基线 188），被砍规则的坏例必须仍被后果检查拦住；拦不住 → 回炉后果化改写，不许硬删
- [ ] 判据：三分类处置表全部落地 + 回归全绿

### T7. 阶段 3 人审闸门

- [ ] 向用户提交：三分类终表 + 每刀回归记录 → 用户确认后进阶段 4

## 第二部分：阶段 4（种子只读 + 资产入册）

### T8. 种子只读校验

- [ ] gate 新增种子文件校验和比对；基线 = `references/04-recipes.md` 文首已登记的校验和（`5318D18B…D958`，2026-11-13 随 P→R 迁移刷新后的现行版）；✅ 已实测当前 `seed/paper-journal.html` 与该校验和精确一致，无需更新登记
- [ ] 判据：任何种子改动 → gate FAIL

### T9. 资产入册

- [ ] `dev/asset-registry.json`：路径/尺寸/比例/校验和（iphone-frame.png 910×1806 等）；gate 校验引用完整性；资产只读引用
- [ ] 入册时 `iphone-frame.png` 迁入 references 对应资产位，不留 dev 路径引用
- [ ] 判据：替换/损坏资产 → gate FAIL

### T10. 注入两个负例并补索引

- [ ] "修改种子后运行" → 必须被 T8 拦截
- [ ] "替换资产后运行" → 必须被 T9 拦截
- [ ] 两条补入 negative-index
- [ ] 判据：注入即拦 + 回归全绿 → 用户确认进阶段 5

## 第三部分：阶段 5（流程改造 + 全量回归）

### T11. SKILL.md 工作流改序

- [ ] 提炼(pool/plan) → 选配方 → 生成（复制骨架/按规格组装）→ 渲染 → **先给用户看** → 用户要求才批查 gate → 修 FAIL → 交付
- [ ] AI 不再决定组件选谁/条数/排布/宽度——全部收敛进配方设计期

### T12. 驱动文档同步

- [ ] HANDOFF §1 锚点句："AI 从组件中选择不同的组件进行排版" → "AI 选配方排版；组件选择收敛进配方设计期"（MILESTONE §5.5 已预授权）
- [ ] HANDOFF §9 dev 债务核销条目更新（dev/controlled 已还原等）
- [x] ✅ 已完成（2026-11-13 T6-C3/C5 连锁，提前落地）：`references/02-constraints.md`（L35 新 L19 锁高壳禁文字叶、L155 检查器清单换 L19/L22 为人审项）与 `references/03-components.md`（L14 去"L22 拦截"、L44 重写）L19/L22 口径已同步——阶段 5 通读时**只需复核，勿重复改动**

### T13. 骨架落位 + 批次 C

- [ ] 确认 `dev/recipes/*.part.html` 是否需迁 `references/recipes/`（DEVPLAN 阶段 2 产出物原计划位置）；若迁，同步登记卡"骨架文件"路径
- [ ] 批次 C（标注级，config-audit #7/#8）：R-list-02 boundary 档 repeat 收紧 ×3-4 或登记卡补注；allow 宽松项逐条标注"降级路径/自由槽位"，优先复核 R-data-04 bottom 的 kicker/h1/sub、R-quote-01 full.dcard

### T14. 全量回归验收

- [ ] 豆仓真实素材 7 页完整跑新流程
- [ ] 7 页真实素材逐页对照登记卡 hl 节奏（T14 预登记，2026-11-13：`form-shape-invisible` 残余的保险丝——gate 不拦组件内隐藏形态，hl 节奏靠逐页人审；02-constraints"检查器不保证的事"已预注册此残余）
- [ ] 对照 MILESTONE §5.4 判据逐条验收
- [ ] 判据：用户验收 → 配方收敛改造完工

---

## 执行纪律（全程有效）

1. 顺序不可倒：T3 基线未全绿前不许动 gate（T5/T6）；T6 每刀可回滚（git commit）
2. 规格级配方（cover-02/phone-02/qa-01/data-03）require/allow 的唯一锚 = 登记卡绑定行；拆分配方禁止整组继承
3. 改 config 必跑七维自查（config-audit §四）
4. 每个阶段闸门（T7/T10/T14）必须用户确认后才能进下一阶段
5. 遇新问题先回报审计模式（实测 > 文档口径），裁决带回给顾问会话
