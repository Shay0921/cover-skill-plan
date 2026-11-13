# h68 坏例「删档前 / 删档后」对照表（刀 C 4.2，2026-11-13）

> B-contract 实测留档。删档 = 删除 `R-phone-01.duo-labeled.carriers[0].width`（原 `[32,36]`）。
> 删档前 = 临时把 `width:[32,36]` 写回 config 跑真实管线（hash 守卫还原，还原后 SHA `7d4fa601a7ce` 校验一致）。
> 构造手段与复用点见 `dev/EXEC-PLAN-phaseB-2026-11-13.md §4.2`；口径：`.phone` getBoundingClientRect（px / cqw，1cqw=10.8px）；skew = (w/h)÷(910/1806)。
> 页面模板 = `test-controlled.mjs:333` h68Duo（layout: duo-labeled）；原始数据 `b-contract-h68-matrix-1113.json`，运行目录 `%TEMP%\bcontract-bn\`。

| 编号 | 构造手段 | 阶段 | phoneW (cqw) | phoneH (px) | skew | status | ERROR 规则码 | 定性 |
|---|---|---|---|---|---|---|---|---|
| B-N1 | `h68Duo(短 sub)` 正常基线 | 前 | 34.26 | 734.4 | 1.0 | passed | — | phone 顶格 68cqw cap（734.4px），宽 34.26 落旧档 [32,36] 内，正例基线 |
| B-N1 | 同上 | 后 | 34.26 | 734.4 | 1.0 | passed | — | 与删档前逐像素一致（headH 同 179.4），**删档零涟漪** |
| B-N2 | `h68Duo(sub×8)` head 撑高 | 前 | 32.00 | 685.8 | 1.0 | failed | R1×6（phone/label/frame 越出 wall） | 长文案压矮 wall，phone 触 floor 63.5cqw（685.8px）仍放不下 → R1 区域越界接住，headH 321.2px |
| B-N2 | 同上 | 后 | 32.00 | 685.8 | 1.0 | failed | R1×6（同前，逐条一致） | **删档不翻转**：R1 与 width 档无关，几何后果层照常兜底 |
| B-N3 | `phoneW 30cqw` 模拟误写（非等比证据） | 前 | 30.00 | 643.0 | 1.0 | failed | R14×2（宽 30.0 超出 32–36） | 删档前唯一守卫 = width 档 |
| B-N3 | 同上 | 后 | 30.00 | 643.0 | 1.0 | **passed** | — | **残余静默**：等比缩小（skew=1）R10 不管，无溢出 R1 不触发；按 §8.5.3 走后果化裁决（登记卡/装配自查），**不改夹具凑绿** |
| B-N4 | `phoneW 38cqw` 模拟拉宽过 cap | 前 | 38.00 | 814.5 | 1.0 | failed | R14×2（宽 38.0 超出 32–36） | 删档前唯一守卫 = width 档 |
| B-N4 | 同上 | 后 | 38.00 | 814.5 | 1.0 | **passed** | — | **残余静默**：等比放大（skew=1）未撞 wall 上边界，R10/R1 均静默；同 B-N3 走后果化裁决 |

## 结论（只登记，不裁决）

1. **R1 是 h68 弹性档的真守卫**：B-N2（真实长文案场景）删档前后均被 R1 接住，6 条 ERROR 逐条一致——删 width 档对真实病根零损失。
2. **残余暴露在「内联写死宽度」模拟误写上**：B-N3/B-N4 删档后静默。此前 width 档对这两例的价值 = 拦截 AI 越权内联宽度；此责已按 §8.5.2 v3 归后果化裁决（登记卡约束 + 装配自查），本表只作证据登记。
3. **B-N1/B-N2 删档后均不静默、不翻转**：满足「删档后谁接住」的验收前提——真实场景 R1 接住，基线零漂移。
4. skew 全部 =1.0：B-N3/B-N4 走 `height:auto` 等比路径，未构造非等比失真（R10 管比例失真不管等比缩放，与 §8.5.2 v3 第 1 条修订一致）。

---

*执行：刀 C 4.2（2026-11-13）。运行器：`%TEMP%\bcontract-bn-matrix.mjs`（复用 runBatch 真实管线 + loadRejectTest 同款 mutate/hash-restore 范式）。*
