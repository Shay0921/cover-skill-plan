# A1 · 41 骨架 × 真实 gate 受控池回归（2026-11-13T14:28:58.860Z）

- run: `d:\AI\html2png\mine\cover-skill-plan\dev\controlled\a1-41-skeleton-1113`
- gate 总状态: **failed**（gateError: 无）
- 页级: 35 passed / 6 failed / 共 41
- 统计口径终审: 唯一 ID 197（期望 197）；{{}} 出现 622（期望 622）；唯一占位符名 154（期望 154）；跨骨架多占位符名 ID 58（监工实测 31）；跨骨架多文案 ID 23（文案口径，填充后同形文案会并拢，≤31 属预期）；同页多文案页数 9（监工实测 9）
- 构造口径: 监工批复按骨架实际形态（dark×2 / issue×5 + meta.issue='2026-11' / 品牌槽咬合 meta.brand）；BRIEF diff 建议随回报提出

| nn | skeleton | recipe/layout | status | ERROR 规则 | 分箱初判 | 首错 |
|---|---|---|---|---|---|---|
| 01 | card01-body-aligned.part.html | R-card-01/body-aligned | passed | — | — |  |
| 02 | card01-body-mn.part.html | R-card-01/body-mn | passed | — | — |  |
| 03 | card01-body-stagger.part.html | R-card-01/body-stagger | passed | — | — |  |
| 04 | card01-cover-bleed.part.html | R-card-01/cover-bleed | passed | — | — |  |
| 05 | card01-cover-standard.part.html | R-card-01/cover-standard | passed | — | — |  |
| 06 | card02-centered.part.html | R-card-02/centered | passed | — | — |  |
| 07 | close01-minimal.part.html | R-close-01/minimal | passed | — | — |  |
| 08 | close01-pills-extended.part.html | R-close-01/pills-extended | failed | R10 | 骨架几何病 | R10: closing-tags-seal 声明比例 1/1 被压成 0.208（相差 380.0%） |
| 09 | close01-quote.part.html | R-close-01/quote | passed | — | — |  |
| 10 | close01-standard.part.html | R-close-01/standard | failed | R10 | 骨架几何病 | R10: closing-seal 声明比例 1/1 被压成 0.208（相差 380.0%） |
| 11 | compare01-grid4.part.html | R-compare-01/grid4 | passed | — | — |  |
| 12 | compare01-h2.part.html | R-compare-01/h2 | passed | — | — |  |
| 13 | compare01-v2-dark.part.html | R-compare-01/v2-dark | passed | — | — |  |
| 14 | compare01-v2-vs.part.html | R-compare-01/v2-vs | passed | — | — |  |
| 15 | compare02-shot-ba.part.html | R-compare-02/shot-ba | passed | — | — |  |
| 16 | data01-bars-only.part.html | R-data-01/bars-only | passed | — | — |  |
| 17 | data01-ldr-bars.part.html | R-data-01/ldr-bars | passed | — | — |  |
| 18 | data02-ldr-tailcard.part.html | R-data-02/ldr-tailcard | passed | — | — |  |
| 19 | data04-panel.part.html | R-data-04/panel | failed | R14 | 骨架几何病 | R14: detail-crop-evidence 宽 50.2cqw 超出骨架档 41–46cqw |
| 20 | list01-ck-phone.part.html | R-list-01/ck-phone | failed | L11 | 骨架病 | L11: 区域 full 不允许组件 ck |
| 21 | list01-ck-shots-cover.part.html | R-list-01/ck-shots-cover | passed | — | — |  |
| 22 | list01-frow-phone.part.html | R-list-01/frow-phone | passed | — | — |  |
| 23 | list01-list-text-cover.part.html | R-list-01/list-text-cover | passed | — | — |  |
| 24 | list02-boundary.part.html | R-list-02/boundary | passed | — | — |  |
| 25 | list02-full-ck.part.html | R-list-02/full-ck | passed | — | — |  |
| 26 | list02-full-list.part.html | R-list-02/full-list | passed | — | — |  |
| 27 | list02-tail-card-ck.part.html | R-list-02/tail-card-ck | passed | — | — |  |
| 28 | list02-tail-card-list.part.html | R-list-02/tail-card-list | passed | — | — |  |
| 29 | note01-dark.part.html | R-note-01/dark | passed | — | — |  |
| 30 | note01-light.part.html | R-note-01/light | passed | — | — |  |
| 31 | note02-phone-dcards.part.html | R-note-02/phone-dcards | passed | — | — |  |
| 32 | phone01-duo-cover.part.html | R-phone-01/duo-cover | passed | — | — |  |
| 33 | phone01-duo-labeled.part.html | R-phone-01/duo-labeled | passed | — | — |  |
| 34 | phone01-trio-labeled.part.html | R-phone-01/trio-labeled | passed | — | — |  |
| 35 | quote01-annotated.part.html | R-quote-01/annotated | failed | R10 | 骨架几何病 | R10: closing-seal 声明比例 1/1 被压成 0.208（相差 380.0%） |
| 36 | quote01-minimal.part.html | R-quote-01/minimal | passed | — | — |  |
| 37 | step01-timeline.part.html | R-step-01/timeline | failed | R15 | 骨架几何病 | R15: 时间线步骤 inspect-material 内部拉伸余量 71.0cqw（>12cqw）：内容撑不满行高 |
| 38 | wall01-duo-col.part.html | R-wall-01/duo-col | passed | — | — |  |
| 39 | wall01-duo-row.part.html | R-wall-01/duo-row | passed | — | — |  |
| 40 | wall01-quad-fill-bleed.part.html | R-wall-01/quad-fill-bleed | passed | — | — |  |
| 41 | wall01-quad.part.html | R-wall-01/quad | passed | — | — |  |

> 分箱口径：L0/L1/L6/L9/L11/L17-L21/L23/L25=骨架病（静态结构）；L8/L10/L14/L15/L16/L24=构造病（池/计划）；R*=骨架几何病（几何档失配，待监工终审归箱）。失败只登记不修（GATE-A2 §3）。

## 裁决注记（施工方初判，待监工终审）

1. **p20 L11 = 骨架病实锤**：`list01-ck-phone.part.html` L7 把 ck 列放进 `data-region="full"`，但 R-list-01 区域表只有 head/left/right/bottom（full 是 R-list-02 的区域）。骨架区域归属错置，非构造病。
2. **p08/p10/p35 R10（seal 比例 0.208）疑似构造病**：`closing-seal`/`closing-tags-seal` 是方形印章槽，真实印文 1-2 字；A1 填充规则 7 落的是 4 字占位符名，长文字把 1:1 印章压扁。需监工裁决「假文字形状病（修填充表重跑）」还是「骨架病」。
3. **p37 R15（步骤拉伸余量 71cqw）疑似构造病同源**：步骤标题/说明按假文字规则取短值，可能撑不满时间线行高；真实文案长度未复现验证。
4. **p19 R14（50.2cqw 超 41–46 档）**：shot 宽度受同排假文字长度影响的可能存在，待监工裁决归箱。
5. **跨骨架多占位符名 ID 口径差**：本驱动实测三种口径——按元素 outerHTML 占位符名（含嵌套 span/alt）=58；仅跨文件（≥2 骨架）=29；按填充后文案去重=23。监工实测 31 无法在以上口径直接复现，逐 ID 明细见 `id-stats.json`，请监工复核口径后定谳。
6. **WARN 分布**：R7×26、R9×11，全部页零 L8/L10/L14/L15/L16/L24——受控池构造面干净，失败清单不含构造噪声（除上述 R 系疑点外）。
