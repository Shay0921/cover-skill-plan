# B-seed 41 图目检抽验记录（2026-11-13）

> 依据：EXEC-PLAN-phaseB §2.2 动作 4。对象 = gap 修复（`.heading` → `.p-page .heading`，head gap 2.4→1.4cqw）重渲后的 `dev/_sc/*.png`。
> 口径：目检对象是**文字与载体**（标题/副题折行、文字溢出、手机裁切、构图完整性），不是像素差异数。
> `pixdiff-bseed-1113.json` 全图 36%–54% 像素变化属 head 收窄 21.6/10.8px 内容整体上移的预期，不构成目检异常。
> 实测基准（render-selfcheck 几何）：41/41 渲染 PASS，h1Lines 全部合规，0 WARN 0 FAIL。

## 抽验清单（9 张 = 计划建议 6 张全验 + 追加 3 张）

| # | 图 | head 收紧 | 标题/副题 | 载体 | 结论 |
|---|---|---|---|---|---|
| 1 | 01-card01-cover-standard | ✅ | 单行不折行、无溢出 | 手机完整未裁切，四要点卡完整 | PASS |
| 2 | 04-phone01-duo-cover | ✅ | 单行 | 双机完整，期号/页脚正常 | PASS |
| 3 | 20-card01-body-stagger | ✅ | 单行 | 交错卡组+手机完整 | PASS |
| 4 | 21-card01-body-aligned | ✅ | 单行 | 四要点卡+手机完整 | PASS |
| 5 | 31-close01-pills-extended | ✅ | 单行 | 标签行/竖排印章字/背景大字正常（上轮 1px 噪声史复核无异常） | PASS |
| 6 | 32-phone01-trio-labeled | ✅ | 单行 | 三机+屏注完整无裁切 | PASS |
| 7 | 43-phone01-duo-labeled（必验） | ✅ | 单行 | 双机+屏注完整落 wall 区；head 实测 230.8px 与画廊源页 43 逐像素一致 | PASS |
| 8 | 44-note02-phone-dcards（必验） | ✅ | 单行 | 手机+双详情卡完整 | PASS |
| 9 | 45-card02-centered（必验） | ✅ | 单行 | h75 手机居中、四标注卡对称无溢出 | PASS |

## 实测数值（_sc 预览口径，1cqw=10.8px）

| 骨架 | head 改前→改后 | gap | body 首区 |
|---|---|---|---|
| 43-phone01-duo-labeled | 252.4 → 230.8px | 25.92 → 15.12px（1.4cqw） | 614.9 → 636.5px |
| 44-note02-phone-dcards | 252.4 → 230.8px | 同上 | 614.9 → 636.5px |
| 45-card02-centered | 179.3 → 168.5px | 同上 | 681.6 → 692.4px |

## 结论

9/9 PASS：head 间距收紧生效、标题/副题无折行、文字无溢出、手机/卡片无裁切、构图不塌。
未发现需停线上报的视觉回归。人审旧图（阶段 0-2，gap=2.4cqw 口径）与新基线的差异已由像素 diff 留档佐证。
