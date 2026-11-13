# A1 · 41 骨架 × 真实 gate 受控池回归（2026-11-13T15:15:01.755Z）

- run: `d:\AI\html2png\mine\cover-skill-plan\dev\controlled\a1-41-skeleton-1113`
- gate 总状态: **failed**（gateError: 无）
- 页级: 39 passed / 2 failed / 共 41
- 统计口径终审: 唯一 ID 197（期望 197）；{{}} 骨架原源 622（期望 622）/ 填充实际 628（repeat 展开会新增槽位）；唯一占位符名 154（期望 154）；跨骨架多占位符名 ID 58（新口径 58）；仅跨文件口径 29（新口径 29）；跨骨架多文案 ID 23（新口径 23）；同页多文案页数 9（期望 9）
- 构造口径: 监工批复按骨架实际形态（dark×2 / issue×5 + meta.issue='2026-11' / 品牌槽咬合 meta.brand）；印章槽填「真」（EXEC-A1fix A）
- 页级变换（EXEC-A1fix C/D 定箱实验）: step01-timeline 展开 ×4（P8）；data04-panel 图1→assets/s10.png（4:3 素材进 ar43 槽）

| nn | skeleton | recipe/layout | status | ERROR 规则 | 分箱初判 | 首错 |
|---|---|---|---|---|---|---|
| 01 | card01-body-aligned.part.html | R-card-01/body-aligned | passed | — | — |  |
| 02 | card01-body-mn.part.html | R-card-01/body-mn | passed | — | — |  |
| 03 | card01-body-stagger.part.html | R-card-01/body-stagger | passed | — | — |  |
| 04 | card01-cover-bleed.part.html | R-card-01/cover-bleed | passed | — | — |  |
| 05 | card01-cover-standard.part.html | R-card-01/cover-standard | passed | — | — |  |
| 06 | card02-centered.part.html | R-card-02/centered | passed | — | — |  |
| 07 | close01-minimal.part.html | R-close-01/minimal | passed | — | — |  |
| 08 | close01-pills-extended.part.html | R-close-01/pills-extended | passed | — | — |  |
| 09 | close01-quote.part.html | R-close-01/quote | passed | — | — |  |
| 10 | close01-standard.part.html | R-close-01/standard | passed | — | — |  |
| 11 | compare01-grid4.part.html | R-compare-01/grid4 | passed | — | — |  |
| 12 | compare01-h2.part.html | R-compare-01/h2 | passed | — | — |  |
| 13 | compare01-v2-dark.part.html | R-compare-01/v2-dark | passed | — | — |  |
| 14 | compare01-v2-vs.part.html | R-compare-01/v2-vs | passed | — | — |  |
| 15 | compare02-shot-ba.part.html | R-compare-02/shot-ba | passed | — | — |  |
| 16 | data01-bars-only.part.html | R-data-01/bars-only | passed | — | — |  |
| 17 | data01-ldr-bars.part.html | R-data-01/ldr-bars | passed | — | — |  |
| 18 | data02-ldr-tailcard.part.html | R-data-02/ldr-tailcard | passed | — | — |  |
| 19 | data04-panel.part.html | R-data-04/panel | failed | R14 | 骨架几何病 | R14: detail-crop-evidence 宽 50.2cqw 超出骨架档 41–46cqw |
| 20 | list01-ck-phone.part.html | R-list-01/ck-phone | failed | R14 | 骨架几何病 | R14: 骨架区域 left 不可见 |
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
| 35 | quote01-annotated.part.html | R-quote-01/annotated | passed | — | — |  |
| 36 | quote01-minimal.part.html | R-quote-01/minimal | passed | — | — |  |
| 37 | step01-timeline.part.html | R-step-01/timeline | passed | — | — |  |
| 38 | wall01-duo-col.part.html | R-wall-01/duo-col | passed | — | — |  |
| 39 | wall01-duo-row.part.html | R-wall-01/duo-row | passed | — | — |  |
| 40 | wall01-quad-fill-bleed.part.html | R-wall-01/quad-fill-bleed | passed | — | — |  |
| 41 | wall01-quad.part.html | R-wall-01/quad | passed | — | — |  |

> 分箱口径：L0/L1/L6/L9/L11/L17-L21/L23/L25=骨架病（静态结构）；L8/L10/L14/L15/L16/L24=构造病（池/计划）；R*=骨架几何病（几何档失配，待监工终审归箱）。失败只登记不修（GATE-A2 §3）。

## 裁决注记（EXEC-A1fix 定箱更新，2026-11-13）

1. **p20 L11 = 骨架病（已修）**：`list01-ck-phone` ck 实落在 `data-region="full"`，R-list-01 regions 原漏登记 full；EXEC-A1fix B 已补 `regions.full allow=[ck,list,text-block]` + 04-recipes 登记卡行，本 run 为修复后复验。
2. **p08/p10/p35 R10（seal）= 构造病（已修待验）**：印文槽占位符名 5 字（收束印章字）把 1:1 印章压成 0.208；EXEC-A1fix A 填充规则 7 补 `/印章/ → '真'`（1 字），本 run 为修复后复验。
3. **p19 R14 = 骨架病实锤（定箱）**：EXEC-A1fix C 换 4:3 素材 s10.png（1280×960）进 ar43 槽后 R14 数值不变（宽 50.2cqw 超 41–46 档），证明 shot 宽度由骨架 CSS 决定、与素材形状无关 → data04-panel 骨架/配方档失配，非构造病。实验证据 `dev/controlled/a1fix-p19-1113/`。
4. **p37 R15 = 构造病实锤（定箱）**：EXEC-A1fix D 手动展开 step ×4（图层 id 加 -N 后缀过 L9，文案用源页长度档）后单页 **PASSED**、R15 消失 → 骨架 `repeat ×4` 注释未被展开是唯一病因，骨架本身无辜；正式修法归 P8（数据驱动 repeat 展开）。实验证据 `dev/controlled/a1fix-p37-1113/`。
5. **跨骨架多占位符名 ID 口径（EXEC-A1fix E2 定谳）**：三种口径实测 58（元素 outerHTML 占位符名去重）/ 29（仅跨 ≥2 骨架文件）/ 23（填充后文案去重）；「31」为编制期静态扫描旧口径失效。逐 ID 明细 `id-stats.json`。
6. **WARN 分布**：R7×27、R9×10；全 run 零 L8/L10/L14/L15/L16/L24——受控池构造面干净。
