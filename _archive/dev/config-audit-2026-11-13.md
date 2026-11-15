# 配方配置全量审计与修复方案（2026-11-13，严格模式）

> 触发：阶段 3 迁移期 LOAD 层连续报错（"一轮只曝一个"）。经七维全量对账后一次性清债。
> 方法：config/recipes.json × references/04-recipes.md 登记卡 × dev/recipes/ 41 骨架，三方逐条对账。
> 状态：待用户确认后执行；本文档为 B 阶段回归重跑前的唯一修复依据。

## 一、七维对账结果总览

| 维度 | 结论 |
|---|---|
| 1 require↔登记卡 | ❌ 4 处残留（#2 #3 #4 #5），病根同源：旧 P 族拆分时 OR 组整组复制 |
| 2 allow↔登记卡 | 反向全过；正向 1 处实害牵连（随 #2/#3 修），其余宽松项标注级（#8） |
| 3 allow↔骨架实查 | ✅ 41 文件全过，无组件落在 order 区域 allow 之外（lint 层不会炸） |
| 4 form↔require | ✅ 全过（唯一用户 R-quote-01） |
| 5 order/tracks↔骨架 | ❌ 1 处（#6 R-compare-01 两档漏 bottom） |
| 6 counts↔骨架条数 | ✅ 全包含（附注 #7 boundary 档 repeat 收紧建议） |
| 7 码一致性 | ❌ 全局硬伤（#1 P 码未改写）；文件名↔layout↔登记卡三方 41/41 一致 |

## 二、问题清单（按严重度）

| # | 配方 | 维度 | 现状 | 依据（04-recipes.md） | 修法 |
|---|---|---|---|---|---|
| 1 | 41 骨架全部 | 7 | `data-recipe` 仍为 P01-P12，且同配方各档混用（R-card-01 混 P01/P02/P05 等） | 总表 L12-33 | 全部改写为对应 R-id（同配方统一）；⚠️ 11-11 画廊档案（dev/controlled/controlled-composition-1111-1148）**不改**，保持历史快照 |
| 2 | R-data-03 | 1+2 | require [["bars","ldr","ledger"]] 残留；full.allow 被迫塞 bars/ldr | 绑定 ledger×4（L233-234） | require→[["ledger"]]；full.allow→["ledger","text-block"] |
| 3 | R-data-02 | 1+2 | require 同残留；full.allow 的 bars/ledger/darkcard 无依据 | 绑定 ldr×3+fcard+ghost（L217-218） | require→[["ldr"]]；full.allow 去 bars/ledger/darkcard |
| 4 | R-phone-01 | 1 | require OR 组的 shot 无依据（允许纯图窗页冒充多屏并陈页） | 绑定 phone×2-3（L170-171） | require→[["phone"]]；allow 中 shot 项标注或收敛 |
| 5 | R-wall-01 | 1 | require OR 组的 phone 无依据 | 绑定 shot×2-4（L154）；反例"整屏多壳→R-phone-01" | require→[["shot"]]；wall.allow 的 phone 标注或收敛 |
| 6 | R-compare-01 | 5 | h2/grid4 档 order=[head,full]，骨架实有 bottom 区 | 绑定 bottom（L264） | 两档 order 补 "bottom?" |
| 7 | R-list-02 | 6 注 | boundary 档 repeat ×3-6，登记卡 6 条上限仅指满栏档 | 密度 L92 | 骨架注释收紧 ×3-4 或登记卡补注 |
| 8 | 多条 | 2 标注 | allow 宽松项无绑定依据（通用件模板化遗留） | 各卡绑定行 | 入册人审时逐条标注"降级路径/自由槽位"；优先复核 R-data-04 bottom 的 kicker/h1/sub、R-quote-01 full.dcard |

## 三、修复批次与验证顺序（不可倒）

1. **批次 A（config 一次改完）**：#2 #3 #4 #5 #6 —— 严禁再"修一个跑一轮"
2. **批次 B（P→R 改写）**：41 骨架 data-recipe → R 码；夹具/索引重建后自然携带 R 码；11-11 画廊档案不动（出处证据链）
3. **验证**：全量回归（LOAD 应零错）→ lint 轮（维度 3 已预检，理论零炸）→ 全绿后 `check-negative-index.mjs --write` 重建基线 → 才继续 gate 逐刀瘦身（每刀全量负例 + git 单独 commit）
4. **批次 C（标注级）**：#7 #8 不阻塞回归，登记入册人审时处理

## 四、防再发

- 七维对账固化为 config 变更自查清单；**规格级配方（无骨架）require/allow 的唯一锚是登记卡"绑定/锚点"行**——骨架引用对它们不可用
- 拆分配方时 require/allow 必须按子配方登记卡重新裁剪，禁止整组继承
