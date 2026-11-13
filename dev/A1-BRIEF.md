# A1-BRIEF · 41 骨架 × 真实 gate 受控池构造规格

> 依据 `dev/GATE-A2-2026-11-13.md` 三问裁决（问 1 / 问 2 为「改」）。A1 用受控假文字，**解耦的是文章内容，不是池本身**。
> 本文件是施工规格，不是已通过测试的声明；所有断言须由 `dev/A1-run.mjs` 实跑才算数。A2 无独立 commit，本文件随刀 A1 入库。

---

## 1. 单个 run 目录

A1 用**一个 run 跑 41 页**（gate 一次报全，几何失败不短路后续页），不建 41 个 run：

```
dev/controlled/a1-41-skeleton-1113/
  work/src/p01.part.html … p41.part.html
  work/src/assets/{s1.png … s9.png, iphone-frame.png}
  work/02-pool.json   work/03-plan.json
  work/qa-report.json work/geometry-digest.json
  out/
  placeholder-map.json
  A1-summary.md
```

入口：`node tools/gate.mjs "<run>/work/src" "<run>/out"`（池与计划按 `work/` 就地读取）。

---

## 2. 骨架 → 计划（layout 不能写 free）

- `recipe` = 骨架首部 `data-recipe`（41 文件全部带）。
- `layout` = 文件名去掉 `.part.html` 后按 `^([a-z]+)(\d+)-(.+)$` 取第三段（如 `phone01-duo-labeled` → `duo-labeled`）。
- **已实证：41/41 的 layout 段都能在 `config/recipes.json` 对应 recipe 的 `layouts` 里精确命中，0 未匹配。** 驱动必须做此断言；未命中即 throw，**不许静默降级写 `"free"`**——写 free 会跳过骨架档几何检查，A1 失去意义。
- `pages[i] = { nn: '01'…'41', recipe, layout, intent: 'A1 受控回归', uses }`。
- **计划声明按骨架实际形态反取（2026-11-13 修订，见 §7），不写死字面值**：
  - `pages[].dark = true` ⟺ 画布根带 `.dark`（实测 2 页：`compare01-v2-dark`、`note01-dark`）；
  - `pages[].issue = true` ⟺ 页眉存在 `.issue`（实测 5 页，全部为封面档）；
  - `meta.brand` = 填充后 41 页 `.brand` textContent 的公共值（实测全 41 页一致：`{{品牌印章字}}{{品牌名称}}{{品牌标语}}` 按规则表填充后逐页相同）；
  - `meta.issue` = 填充后 `.issue` textContent（实测 5 页一致，形如 `刊期年月+刊期号` 的拼接值）。
  - 声明与填充全部由驱动从骨架扫描机械派生，禁止手写；派生后断言各值全页一致，不一致即停（BRIEF 缺陷，回报不自行解释）。
  - ⚠ 防掩盖断言：`issue: true` 的 5 页必须对照 `references/04-recipes.md` 登记卡矩阵逐页核资格——照形态声明只过 gate 账目面，**资格违规不在 gate 职责内**（C1 迁移），必须在驱动里补这道对账。
- `uses` = 本页 `data-from` 反向并集；骨架实测 `multiIdRefs = 0`（无空格分隔多 ID）。

---

## 3. 占位符填充（裁决问 2）

**不复用** `dev/e2-duo-labeled.mjs:11-35` 的 `FILLED`（仅 11 key，覆盖不了 154 个唯一占位符）。复用 `dev/_sc/render-selfcheck.mjs:18-23, 109-117` 的形状规则，按顺序：

| 顺序 | 匹配 | 取值 |
|---|---|---|
| 1 | `{{图N}}` | 按出现序取 `assetSrcs`（`dev/cases/assets/` 的 `s1–s9.png` 循环），写相对路径 `assets/sN.png` |
| 2 | `{{柱高}}` | `BAR_HEIGHTS = [50,100,75,25]` 循环（0–100 整数，L25） |
| 3 | `SHORT_FAKE` 表 10 项 | 逐字取表值 |
| 4 | `/主标题\|标题\|金句文本\|刊期/` | `ph.slice(0,4)` |
| 5 | `/序字\|编号\|序号/` | `'1'` |
| 6 | `/副题\|引言\|说明\|标语\|签名\|署名\|注脚\|注解\|出处\|描述/` | `SENTENCE_FAKE` |
| 7 | 其余 | 占位符名本身作文字 |

- 实测体量：41 文件 / 622 次 `{{}}` / 154 唯一名 / `{{图N}}` 47 处。
- `iphone-frame.png` 与 `s1–s9.png` 从 `dev/cases/assets/` 复制进 `work/src/assets/`（A1 是测试 run，不进生产面引用）。
- **未命中一律 throw，禁止静默留 `{{}}`**（L24 硬错误）。
- 填充明细落 `placeholder-map.json`：`{ file, placeholder, value }` 全量 622 条，供复核。

---

## 4. 池生成（裁决问 1）

**先填充、后建池**，不按 ID 预设固定假文字：

1. 遍历每页所有 `[data-from]`，取该元素可见文本（文本节点拼接；`<br>`、高亮 `span` 视为连续），按 ID 汇总。
2. 同 ID 多文案（跨骨架 31 个、同页 9 页）→ **拼接**为资产 `text`，不取首条、不丢弃。
3. `kind` 一律 `highlights`（`strictKinds = {data, quotes}` 会触发 L15 逐字 ERROR；非 strict 只走 L16 重叠 WARN，且资产 text 与页面同源不会告警）。
4. `evidence` 固定「A1 受控合成文案，用于骨架 gate 回归，不陈述产品事实。」；`source` 固定「本试验定义」。
5. `thesis` 单列 `id:'thesis'`，四字段齐备，ID 不与 197 冲突。
6. **数字约束**：`lint-dom.mjs:246-251` L8 数字集合 + `:283-286` L14 单位，资产 `text` 由页面文案拼接后自动满足；假文字表含 `2026-11`、`第 07 期`、序字 `1`、柱高数字，切勿改用与页面无关的固定句。

---

## 5. 四条加载前断言（缺一不开 gate）

1. 41 页零 `{{` 残留（L24）
2. `union(uses) === Object.keys(pool assets) === 197`（零孤儿；`project.mjs:158` 是 **throw**）
3. 每资产 `id/text/evidence/source` 四字段非空（`collectPoolAssets:48`）
4. 41/41 layout 映射命中（§2）
5. 声明派生一致（§2 修订）：brand/issue 文字全页公共、dark 2 页 / issue 5 页与骨架扫描值吻合、issue 5 页过登记卡矩阵资格对账

---

## 6. 判据与纪律

- 41 页各出 `qa-report.json`；`A1-summary.md` 列每页 `status`、ERROR 规则码、首错文案。
- **失败只登记进批次 C 清单，不当场修**（GAPS-STATUS A1 判据）。
- 必须区分「骨架病」与「受控池构造病」：后者是本 BRIEF 的缺陷，先修 BRIEF 重跑，不得混进骨架病清单——这正是问 1 不按推荐签的原因。
- 跑完不自动清账；`GATE-A2.md`、三份口径文档、本 BRIEF 随刀 A1 一笔 commit。

---

*编制：监工（2026-11-13），随 GATE-A2 裁决下发。施工方按此实现 `dev/A1-run.mjs`；规格与实测冲突时先回报，不自行解释。*

---

## 7. 修订记录

**v1.1（2026-11-13，监工）· §2 计划声明口径：字面值 → 骨架实际形态反取**

- 起因：v1 的 `meta.brand:'A1 受控回归'`、`meta.issue:''`、无 `dark`/`issue` 声明与骨架实际形态冲突，照字面跑必产生 **48 条构造性 L6**（41 brand 不一致 + 5 issue 未声明 + 2 dark 未声明，监工逐页扫描实证），混进骨架病清单——违反本 BRIEF §6 与 GATE-A2 问 1 的同一纪律。
- 裁决：**单轮按实际形态声明**，不跑 strict 字面轮。strict 轮的失败集就是这 48 条声明伪影，可由 `lint-dom.mjs` 静态规则直接推导，且 gate 声明账目面已有受控负例覆盖（`issue-missing-from-skeleton` / `issue-outside-skeleton` 等），再烧一轮 41 页 gate 零信息增量。
- 实测底账：dark 2 页（`compare01-v2-dark`、`note01-dark`）；issue 5 页（全部封面档，槽 = `{{刊期年月}}+{{刊期号}}`）；`{{品牌名称}}` 41/41 全页一致。扫描脚本一次性抽查，驱动实现时必须重新机械派生并断言，不得引用本记录的数字硬编码。
