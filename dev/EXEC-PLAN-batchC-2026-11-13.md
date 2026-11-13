# 批次 C 施工单 · p19 甲案 + p20 纠偏 + A1 终跑收口（2026-11-13）

> **状态：用户已拍板（2026-11-13 深夜）：p19 走甲案（种子紧凑档）。本单为监工编制的执行方案，执行方照此施工；与本单冲突的旧口径一律先回报、不自行解释。**
>
> **执行状态（2026-11-14 执行方补记）：三刀全部落地——C1 `94b0097`（p20 纠偏：--only=20 passed、share 0.483、184/184 基线 1114-0000、七维留痕在 commit body）→ C2 `c961760`（p19 甲案：SHA `98E29FC0…` 三处同步、--only=19 passed、shot 43.3cqw、e2e 8/8、基线 1114-0006、pixdiff 仅 p19 实质变化 28.68%、目检 3 张）→ C3 本笔（A1 终态 41/41 零 ERROR + 中间态清扫 + 账目 + 施工单入库）。判据全落；C3 hash 见收口笔。**
>
> 依据：用户拍板记录（本会话）+ 监工 A1fix 复核结论（p19/p20 三方解剖）+ `dev/controlled/a1-41-skeleton-1113/work/geometry-digest.json` 实测 + `dev/EXEC-A1fix-2026-11-13.md` 定箱结论 + `dev/DIAGNOSIS-h68-overflow-2026-11-13.md`（h68 先例与纪律）。
>
> 三刀三 commit：**C1（p20 config 纠偏）→ C2（p19 甲案种子刀）→ C3（A1 终跑 + 账目 + 文档清扫）**。顺序不可倒的理由：C1 便宜独立先落账；C2 动种子是重仪式刀，其后紧跟终跑收口。

---

## 0. 实测底账（本单全部数值的来源）

| 项 | 实测值 | 来源 |
|---|---|---|
| p19 full 区宽 | 86.8cqw；shot 实测 50.2cqw（超 [41,46] 档） | A1 digest p19 |
| p19 现状算术 | `(86.8 − 默认 gap 3) × 0.6(w12) = 50.28 ≈ 50.2` | seed L45 `.flow-row{gap:3cqw}` + digest |
| p19 甲案算术 | `(86.8 − padding 10 − gap 4.5) × 0.6 = 43.38` → 落 [41,46] 中位 | 源页 46 内联 `padding:4.5cqw 5cqw;gap:4.5cqw` |
| 素材形状假设 | 已证伪：换 4:3 素材 s10 后 R14 数值一字不变 | `dev/controlled/a1fix-p19-1113/` |
| p20 实测 | full/right 各 41.9cqw、share **0.483**；phone right 41.4cqw **在 [39,44] 档内** | A1 digest p20 |
| p20 病根 | 骨架区域 `{head,full,right}` 与源页 14 **逐字一致**（head=kicker/h1/sub、full=ck×4、right=phone）；config `layouts.ck-phone` 的 `order=[head,left,right]`+tracks left/right 为聚类期 schema 写错 | 骨架/源页 grep 对照 |
| 悬置项出处 | `references/04-recipes.md` R-data-04 卡内联净化行 + dev/02-recipe-registry.md 净化表 L361：「panel inline padding → 孤例丢弃……46 的紧凑边距是否入种子由阶段 4 人审」——**该人审项掉账，从未裁决** | 登记卡原文 |
| 用户拍板 | 2026-11-13 甲案（种子紧凑档），监工推荐同向；理由：观感锚点=已目检认可的画廊页 46；config 档位保持源页派生语义；悬置项按原设计意图关闭 | 本单前言 |
| 种子插入位 | 布局修饰段 w08/w12 块（L221–224）之后，独立注释组；`.flow-row` L45 先定义，修饰段后定义胜出（gap 3→4.5 覆盖成立） | seed L45/L218–224 实读 |
| 类名占用 | `.inset45` 未被占用（现有 `.shot.inset>img` 是另一复合选择器，不冲突） | grep 实证 |
| 实验开关 | `dev/A1-run.mjs` `PAGE_TRANSFORMS`（p19→s10、p37 展开 ×4）**保留至 P8 机制化**——提前清理 = p37 立即退回 R15 失败 | EXEC-A1fix D + GAPS P8 |

---

## C1 · p20 config 纠偏（纯 config，两文件）

### 动作

1. `config/recipes.json` → `R-list-01.layouts.ck-phone`，三处：
   - `order`: `["head","left","right"]` → **`["head","full","right"]`**
   - `tracks`: left/right 两列 → **`[{"region":"full","share":[0.46,0.50]},{"region":"right","share":[0.46,0.50]}]`**（实测 0.483 居中；沿用原 0.46–0.50 区间宽度惯例）
   - `when`: "源页 14：左列复选条目，右整屏机互证" → **"源页 14：通栏复选条目，右整屏机互证"**（原"左列"与骨架矛盾）
   - `headline [1,1]`、`carriers phone right [39,44]` **不动**（实测 41.4 在档）
2. `references/04-recipes.md` R-list-01 卡：ck-phone 相关行与上述一致化（EXEC-A1fix B 已补的"通栏区"行核对措辞）。
3. **七维自查**（config-audit §四）逐维留痕写入回报：require↔卡（本配方无 require）/allow↔卡/allow↔骨架（ck 已在 full.allow，EXEC-A1fix B 已落）/form↔require（N/A）/order·tracks↔骨架（本次纠偏对象，C1 后应全过）/counts↔条数（已退役）/码一致性。
4. R14 夹具核对：grep `dev/controlled/negative-index.json` 含 `R-list-01` 或 `ck-phone` 的夹具，逐条核对 first_error 是否依赖旧 schema——预期零依赖零翻转，核对表留档（B-contract 4.3 同款格式）。

### 判据

- `node dev/A1-run.mjs --only=20` → **passed**（R14 "left 不可见" 消失；full/right share 实测落 0.46–0.50）。
- 全量负例新基线目录（`controlled-negative-1113-<HHMM>`）→ 索引 scope 切换 → `--write` → 裸跑对账 **exit 0**；三锁复跑零涟漪。
- `git diff config/recipes.json` 仅 ck-phone 一个 layout 对象内的字段。

### commit

```
批次C1：R-list-01 ck-phone 布局档纠偏（order/tracks/when 对齐骨架与源页14，实测 share 0.483）
```

---

## C2 · p19 甲案种子紧凑档（种子刀，参照 B-seed 仪式量）

### 动作（按序）

1. `seed/paper-journal.html` 布局修饰段（L224 w12 之后）新增独立组：
   ```css
   /* panel 内衬档（来源页 46；批次 C 甲案 2026-11-13 用户拍板：padding 4.5/5 + gap 4.5 恢复源页观感） */
   .inset45{padding:4.5cqw 5cqw;gap:4.5cqw;}
   ```
   只加类，**不动 `.panel` 默认值**（其余 40 骨架零引用零涟漪）。
2. `dev/recipes/data04-panel.part.html` **和** `references/recipes/data04-panel.part.html`（**两副本必须同步改**）：`<div class="flow-row align-center panel">` → `<div class="flow-row align-center panel inset45">`。
3. **SHA 三处同步**：重算 seed SHA-256 → `tools/build.mjs` 基线常量 + `references/04-recipes.md` 文首登记行（现值 `E11C9E1E…` 两处替换）。
4. `references/04-recipes.md` R-data-04 卡内联净化行改判，并追加销账记录（格式对齐 T7 残余清单）：
   - 行文字："panel inline padding → 孤例丢弃（待人审）" → "**紧凑档 `.inset45` 入种子（2026-11-13 批次 C 用户拍板甲案，悬置项销账）**"
   - 销账记录：决策（入种子）；理由（保住阶段 2 已目检认可的画廊观感 + config 档位保持源页派生语义，与 h68"尊重源页设计意图"同向）；兜底（R14 [41,46] 档 + 交付目检）；复发处置（观感偏差 → 回炉登记卡与种子修饰段，不动 gate）。
5. `dev/_sc` 41 图重渲 + pixdiff 留档 + 目检抽验 ≥3 张（**p19 必看**：panel 内衬出现、shot ≈43.4cqw 落档、文字列无挤压；其余 40 张预期像素不变——1px 级 grain/wash 噪声按 31 号先例记环境漂移）。
6. 门禁：三锁自检 + **`dev/check-locks-e2e.mjs` 必跑**（动了种子，注入取证 8/8）+ 全量负例新基线 + 索引 `--write` + 裸跑对账 exit 0。

### 判据

- `node dev/A1-run.mjs --only=19` → **passed**，digest shot 宽 **43.4±0.5cqw**。
- `check-seed-lock` 新 SHA 全 4 项 PASS；`check-locks-e2e` **8/8**；对账 exit 0。
- 41 张 pixdiff：仅 p19 实质变化。

### commit

```
批次C2：p19 甲案——种子 .inset45 panel 紧凑档 + SHA 三处同步 + R-data-04 悬置项销账
```

---

## C3 · A1 终跑收口 + 账目 + 文档清扫

### 动作

1. `node dev/A1-run.mjs` 全量重跑 → **预期 41/41 passed**。`A1-summary.md` 终态更新：p19/p20 行标"批次 C 已修复销单"+ 对应 commit 号；⚠ **`PAGE_TRANSFORMS` 两实验开关保留**（P8 机制化前清理即 p37 退回 R15 失败）。
2. 文档 rider（全部 doc-only）：
   - `dev/spec/tasks.md` 头部注记："阶段 0–4 已完成，本表为历史执行清单，不再逐项勾选"。
   - `references/04-recipes.md` 全文扫"待入册 / 待阶段 4 人审 / 复核中"中间态字样，逐条销账或改判；其中 **R-phone-02「页 42 资格复核中」**：执行方提交页 42 `kicker←topic` 封面槽位用法证据（源页 markup 截取）→ 监工复核 → 落定案文字。
   - R-card-02 卡内联净化注记补一条销账：页 45 fcard `padding:1.7cqw` 悬项 → "维持丢弃（A1 p06 实证 passed，无几何后果）"。
3. 账目同步：GAPS（A1 终态 41/41、p19/p20 销单、批次 C 三刀 hash）/TODO（指针推进）/EXEC-PLAN-phaseB 总表（补三刀 hash）。

### 判据

- A1 终态 **41/41 passed**、零 ERROR（WARN R7/R9 维持只登记）；三锁 + 对账 exit 0。
- `git status` 干净。

### commit

```
批次C3：A1 终跑 41/41 + p19/p20 销单 + 中间态字样清扫 + 账目同步
```

---

## 明确不进本批（登记在案，防 scope 蔓延）

| 项 | 处置 | 理由 |
|---|---|---|
| **C4 · h75 card02 弹性化** | **独立下一刀，推荐 T14 前择机**；note02 **不需要**（R14 下限即其设计守卫，GATE-B 第 4 项定性） | 证据已实锤（`h75-stress-1113` card02-long R1×2 横排锁高真实溢出），修法沿 h68 弹性范式但结构不同（无 `.phone-cell`，`:has` 选择器需另设计）——必须独立定案参数 + 独立种子刀，与本批回退面隔离 |
| **P8 机制化** | C4 之后或 T14 之后（纯驱动层，不挡 T14） | repeat ×N 注释解析展开 / 素材按 ar 形状映射 / fill 密度档按登记卡 / 届时才清理 `PAGE_TRANSFORMS` |
| config `name`/`intent` 第二副本去重 | 单独小刀 | 动 `loadProject` schema，牵连面另评 |
| R9×10 / R7×27 WARN | 维持只登记，T14 一并观察 | 已在案，无硬判据 |
| 多来源 `data-from` 稀释 L15 / quote.hero 跨配方 | T7 残余清单维持登记 | 历史遗留，未被收敛覆盖 |

---

## 硬纪律（沿用，全程有效）

1. 三刀三 commit，逐文件精确 `git add`，**禁 `git add -A`**；`.workbuddy/` 不入库不删除。
2. 每刀后全量负例 + 索引对账 exit 0；归档不回改（修订一律追加）。
3. 改 config 跑七维自查并留痕；改 seed 走三处同步 + SHA 重算 + e2e 注入取证。
4. 实测 > 文档口径；判据先跑再写，**不得改 expected 凑绿**；不预判。
5. 失败只登记：C1–C3 施工中若冒出新失败页，登记后回报监工，**不顺手修**。
6. 回退：单刀 `git revert <该刀 commit>`；C2 若三锁/回归不过，整刀回退重做第 5 步目检。
7. 本施工单随 C3 入库；完成后在本文头部状态行补三刀 commit hash，不改已完成刀正文。

---

## 闸门

C3 完成 → **监工实证复核**（重点：SHA 三处一致、e2e 8/8、41 重渲 pixdiff 仅 p19、A1 终态 41/41、七维自查留痕）→ 用户拍板收口 → **T14 豆仓 7 页真实素材验收**（MILESTONE §5.4 四判据 + 计时/轮次记录）。

*编制：监工（2026-11-13 深夜）。执行中与本单冲突或发现本单未覆盖的事实，先回报，不自行解释。*
