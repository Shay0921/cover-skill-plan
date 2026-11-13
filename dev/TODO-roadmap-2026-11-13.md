# 后续执行路线图 TODO（2026-11-13）

> **▶ 当前指针（2026-11-13 更新）：阶段 3 收尾 · 下一步 = T6（gate 瘦身逐刀）**
> - T1/T2/T3/T5 已收口（2026-11-13）：T1 第六轮 183/183；T2 lint 轮全绿；T3 基线重建（scope → `controlled-negative-1113-0853`，count=183，对账全绿）；**T5 L24 已落地**（lint-dom 新增占位符残留检查，正负例 3 条入套件，全套件 186/186，基线重建 count=186、scope → `controlled-negative-1113-0902`、裸跑对账退出码 0）
> - T4 P→R 已全部完成（生产面+dev 副本；新夹具 P 码归零，249 文件携 R 码）
> - T6 起每刀单独 git commit（用户侧操作）；阶段闸门 T7 必须用户确认
> - 🗑 删除裁决（监工已核，2026-11-13）：`controlled-slim-1113-1/` **可整目录删除**——索引已指向 1113-0853、全仓无脚本/文档依赖、内容为新库子集；删后 git 提交一笔。⚠️ 11-11 两个归档（composition-1111-1148 / library-1111-1046）是受保护历史快照，**永不删改**

> **用途**：会话压缩后的新任务启动文档。按顺序执行，每步有完成判据；完成一项勾一项。
> **配套文档**（按需查阅，本文档为唯一执行顺序来源）：
> - `dev/DEVPLAN-recipe-convergence-2026-11-12.md` —— 五阶段总施工图（含全部裁决记录）
> - `dev/constraint-ownership-map.md` —— 阶段 3 产出物 A（33 规则码三分类 + C1-C6 冲突裁决）
> - `dev/config-audit-2026-11-13.md` —— 七维审计 + 批次 A/B 修复方案
> - `references/04-recipes.md` —— 20 张登记卡（规格级配方 require/allow 的唯一锚）
> - `dev/controlled/negative-index.json` —— 回归基线（2026-11-13 T5 后定稿：scope → `controlled-negative-1113-0902`，count=186，对账全绿；T6 每刀以此为回归基准。过渡库 1113-0853 已被 0902 严格超集取代，确认零依赖后可删）
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
- 判据达成：全量回归 0 FAIL

### T2. lint 轮（✅ 2026-11-13）
- [x] lint 层全套随全新夹具套件全量执行：`node dev/test-controlled.mjs dev/controlled/controlled-negative-1113-0853` → 183/183 passed，lint 维度 0 FAIL（lint 拦截面 77 条夹具全部按预期命中）
- 判据达成：0 FAIL，无审计漏项

### T3. 重建负例基线（✅ 2026-11-13）
- [x] `test-controlled.mjs` 现场生成 `controlled-negative-1113-0853`（183 夹具，自然携带 R 码）→ 索引 scope 指向 → `check-negative-index.mjs --write` 重建 → 裸跑对账退出码 0（missing/stale/unrecorded/unaccounted/drift 全零）
- 📌 口径落实：基线数以重建后实际数为准 = **183**（lint77/geometry25/pass36/load36/pipeline5/build3/direct-probe1）；旧"175"口径作废
- ⚠️ 账目差登记：slim-1113-1 内孤儿夹具 `anyof-wall01-phone-only` 不阻塞重建（新库无此差）；删除候选，由用户执行
- 判据达成：索引与夹具一一对应、全绿；此后任何 gate 改动以此为回归基准

### T4. 批次 B：41 骨架 P→R 改码（✅ 已完成，2026-11-13）
- [x] 生产面：`references/recipes/` 41 骨架 + `config/recipes.json` 20 条均已 R 码化（入册时完成）
- [x] dev 副本：`dev/recipes/` 41 骨架按用户裁决（11-13，git 可追溯历史故迁移而非封存）改为对应 R-id，与生产面逐一一致
- [x] ⚠️ `dev/controlled/controlled-composition-1111-1148`（11-11 画廊档案）**不改**——历史快照保真
- [x] 剩余验证项（已随 T3 重建轮完成，2026-11-13）：夹具/索引重建 + 全量回归 183/183；新夹具 P 码归零（249 文件携 R 码）
- 判据达成：grep `data-recipe="P` 在 dev/recipes/ 与 references/recipes/ 均归零 ✅；回归全绿 ✅

### T5. gate 补占位符残留检查（L24）（✅ 2026-11-13）
- [x] `tools/lint-dom.mjs` 新增 L24：成品 HTML 任何位置（文本/属性/注释）含 `{{` 即 ERROR（`inspectFragmentDOM` 入口处对原始 html 串检查）
- [x] 正负例 3 条补入套件：`placeholder-residue-text`（文本残留→L24）、`placeholder-residue-attr`（属性残留→L24）、`placeholder-clean`（干净对照→passed）；全套件重跑 **186/186**，索引重建 count=186、scope → `controlled-negative-1113-0902`，裸跑对账退出码 0
- [x] 约束归属图 §5 缺口表已同步"已落地"
- 判据达成：含占位符的页面被拦（文本/属性两个位置均取证）；干净页通过 ✅

### T6. gate 瘦身逐刀（按 constraint-ownership-map.md §4/§6 顺序）
- [ ] **C3**：L19 后果化改写为"带比例 phone 根内禁文字叶"——实证时必须构造**短文字**负例（R3 对短文字静默，长文字溢出测不出来）
- [ ] **C5**：L22（金句 rule 无 source）迁登记卡，gate 删除；负例 `rule-without-source` 改登记 passed+目检项；R-quote-01 卡绑定字段写明"省出处连 rule 一起省"——已裁决接受残余风险（此路径只剩人眼把关）
- [ ] **C6**：L23 保留，误伤再收窄（预案：hero 出血且 head 也空）
- [ ] 拆分类：L6 账目面留 gate、L11 结构契约留 gate；砍 L11①②③、L20 静态层、R13
- ⚠️ 纪律：**每刀 git 单独 commit**；每刀后全量 175 负例回归，被砍规则的坏例必须仍被后果检查拦住；拦不住 → 回炉后果化改写，不许硬删
- 判据：三分类处置表全部落地 + 回归全绿

### T7. 阶段 3 人审闸门
- [ ] 向用户提交：三分类终表 + 每刀回归记录 → 用户确认后进阶段 4

## 第二部分：阶段 4（种子只读 + 资产入册）

### T8. 种子只读校验
- [ ] gate 新增种子文件校验和比对；基线 = `references/04-recipes.md` 文首已登记的校验和（`5318D18B…D958`，2026-11-13 随 P→R 迁移刷新后的现行版）；✅ 已实测当前 `seed/paper-journal.html` 与该校验和精确一致，无需更新登记
- 判据：任何种子改动 → gate FAIL

### T9. 资产入册
- [ ] `dev/asset-registry.json`：路径/尺寸/比例/校验和（iphone-frame.png 910×1806 等）；gate 校验引用完整性；资产只读引用
- [ ] 入册时 `iphone-frame.png` 迁入 references 对应资产位，不留 dev 路径引用
- 判据：替换/损坏资产 → gate FAIL

### T10. 注入两个负例并补索引
- [ ] "修改种子后运行" → 必须被 T8 拦截
- [ ] "替换资产后运行" → 必须被 T9 拦截
- [ ] 两条补入 negative-index
- 判据：注入即拦 + 回归全绿 → 用户确认进阶段 5

## 第三部分：阶段 5（流程改造 + 全量回归）

### T11. SKILL.md 工作流改序
- [ ] 提炼(pool/plan) → 选配方 → 生成（复制骨架/按规格组装）→ 渲染 → **先给用户看** → 用户要求才批查 gate → 修 FAIL → 交付
- [ ] AI 不再决定组件选谁/条数/排布/宽度——全部收敛进配方设计期

### T12. 驱动文档同步
- [ ] HANDOFF §1 锚点句："AI 从组件中选择不同的组件进行排版" → "AI 选配方排版；组件选择收敛进配方设计期"（MILESTONE §5.5 已预授权）
- [ ] HANDOFF §9 dev 债务核销条目更新（dev/controlled 已还原等）

### T13. 骨架落位 + 批次 C
- [ ] 确认 `dev/recipes/*.part.html` 是否需迁 `references/recipes/`（DEVPLAN 阶段 2 产出物原计划位置）；若迁，同步登记卡"骨架文件"路径
- [ ] 批次 C（标注级，config-audit #7/#8）：R-list-02 boundary 档 repeat 收紧 ×3-4 或登记卡补注；allow 宽松项逐条标注"降级路径/自由槽位"，优先复核 R-data-04 bottom 的 kicker/h1/sub、R-quote-01 full.dcard

### T14. 全量回归验收
- [ ] 豆仓真实素材 7 页完整跑新流程
- [ ] 对照 MILESTONE §5.4 判据逐条验收
- 判据：用户验收 → 配方收敛改造完工

---

## 执行纪律（全程有效）

1. 顺序不可倒：T3 基线未全绿前不许动 gate（T5/T6）；T6 每刀可回滚（git commit）
2. 规格级配方（cover-02/phone-02/qa-01/data-03）require/allow 的唯一锚 = 登记卡绑定行；拆分配方禁止整组继承
3. 改 config 必跑七维自查（config-audit §四）
4. 每个阶段闸门（T7/T10/T14）必须用户确认后才能进下一阶段
5. 遇新问题先回报审计模式（实测 > 文档口径），裁决带回给顾问会话
