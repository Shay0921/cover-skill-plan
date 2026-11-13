# Tasks · 阶段 2 裁决执行（按 DEVPLAN §4.3 裁决 8 收尾顺序）

> ⚠ 状态注记（2026-11-14 批次 C3）：阶段 0–4 已全部完成收口，本表为**历史执行清单存档**，不再逐项勾选；实际收口记录见 `dev/TODO-roadmap-2026-11-13.md` 指针段与 `dev/GAPS-STATUS-2026-11-13.md` 快照。

> 顺序不可颠倒（裁决 8 原文顺序）。前置：spec.md 已批准。

## T1 种子补 B1-B6 类
- [ ] `seed/paper-journal.html` 追加布局修饰段（spec §1，插在 L205 `.qa .answer` 后）
- [ ] 验证：种子既有行零改动（仅追加），新类名与 spec §1 逐一一致

## T2 骨架挂类（24 个文件）
- [ ] 按 spec §2 表逐文件挂类（gap×7 组、flex×5 组、grid×6、ar43×7 img、w50×1）
- [ ] B7：data01-bars-only / data01-ldr-bars 柱高改 `style="height:{{柱高}}%"`
- [ ] 验证：`grep -c 'style="' dev/recipes/*.part.html` → 仅 6 处柱高豁免残留

## T3 harness 三修
- [ ] ① expandRepeats 向前回溯母版（spec §4.1 逻辑）
- [ ] ② 资产路径 `assets/` → `../../out/assets/`；缺 iphone-frame.png 则从 dev/cases/assets/ 复制
- [ ] ③ 假文字形状规则（序字类 1 字 / 副题类整句）
- [ ] 语法验证：`node --check dev/_sc/render-selfcheck.mjs`

## T4 重渲染 + 自检核对
- [ ] `node dev/_sc/render-selfcheck.mjs` → 41/41 渲染
- [ ] report.json：17/19 溢出归零；37/12/40 计数=源页；无新增 FAIL
- [ ] 重建 `dev/_sc/index.html` 并排目检页

## T5 registry 同步
- [ ] 净化处置表 B1-B7 行更新（类名落地 + B7 豁免注记）
- [ ] 各登记卡"内联净化"字段补配方↔类映射；规格级 3 卡补挂类注记（data-03/qa-01/cover-02）
- [ ] 验证核对表勾选更新

## T6 提交用户复核（强制闸门，裁决 8）
- [ ] 向用户提交：dev/_sc/index.html + 波及页清单（37/12/40、20/21、26、17/19）+ registry diff 摘要
- [ ] 用户确认后：02-recipe-registry.md + 41 骨架 + 种子类整体入册 references/（闸门关闭）

## T7（闸门后）阶段 3 开工前确认
- [ ] 确认 `dev/controlled/negative-index.json`（183 负例）在位
