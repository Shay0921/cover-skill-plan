# Spec · 阶段 2 目检闸门裁决执行（DEVPLAN §4.3 裁决记录 8 条，2026-11-13）

> 输入：DEVPLAN §4.3"阶段 2 目检闸门裁决记录"（用户拍板"全部按此执行"）。
> 前置状态：裁决 1（A1）、5（C1）、6（页26）已由用户登记完毕，无动作；h68/h75 已入种子且骨架已挂类；registry A1 行已更正。
> 本 spec 覆盖剩余执行项：裁决 2/3/4/7/8。

## 1. 种子新增布局修饰类（裁决 2 + 3）

**文件**：`seed/paper-journal.html`，新增段插在 `.qa .answer`（L205）之后、`</style>` 之前（后置保证同特异性胜出）。

```css
/* 布局修饰档（2026-11-13 设计期增补：画廊 47 页内联几何净化迁移；几何语义命名，
   配方↔类映射住 dev/02-recipe-registry.md 登记卡，gate 凭该引用校验） */
/* 区间隙档：覆盖 .region/.flow-col 默认 2.4cqw（来源页 03/05/14/16/17/18/19/29/41 | 07/13/15/31/35/36 | 38/39 | 47 | 30 | 28/33 | 08/11/34） */
.region.tight,.flow-col.tight{gap:0;}
.region.gap1,.flow-col.gap1{gap:1cqw;}
.region.gap16,.flow-col.gap16{gap:1.6cqw;}
.region.gap22,.flow-col.gap22{gap:2.2cqw;}
.region.gap34,.flow-col.gap34{gap:3.4cqw;}
.region.gap4,.flow-col.gap4{gap:4cqw;}
.region.gap5,.flow-col.gap5{gap:5cqw;}
/* 栏宽比档：与 .flow-row>.region{flex:1 1 0} 同特异性靠后置胜出（来源页 08/34、28、09、46） */
.region.w08,.flow-col.w08{flex:0.8 1 0;}
.region.w09,.flow-col.w09{flex:0.9 1 0;}
.region.w11,.flow-col.w11{flex:1.1 1 0;}
.region.w12,.flow-col.w12{flex:1.2 1 0;}
/* 图墙网格档（来源页 06/27 | 24 | 25/02 | 32） */
.flow-grid.g22{grid-template-rows:repeat(2,minmax(0,1fr));}
.flow-grid.g2c{grid-template-rows:auto;align-content:center;}
.flow-grid.g1c2r{grid-template-columns:minmax(0,1fr);grid-template-rows:repeat(2,auto);align-content:center;max-width:46cqw;margin-inline:auto;}
.flow-grid.g3c{grid-template-columns:repeat(3,minmax(0,1fr));align-content:center;}
/* 局部图 4:3 窗比（来源页 02/22/24/25/34/46；挂在 .shot>img 上，与源页宿主一致） */
.shot>img.ar43{aspect-ratio:1280/960;}
/* 窄卡档（来源页 35） */
.fcard.w50{max-width:50cqw;}
```

依据（已核实的源页内联宿主）：gap 类挂 `.region`/`.flow-col`；flex 比挂 flow-row 子级 region 或 flow-col.grow；grid 档挂 `.flow-grid.grow`；ar43 全部在 `<img>` 上。

## 2. 骨架挂类（裁决 3：配方↔类映射入登记卡）

| 骨架文件 | 挂类 |
|---|---|
| list01-ck-shots-cover | left region +`tight`；flow-grid +`g1c2r`；img×2 +`ar43` |
| list01-list-text-cover | left region +`tight` |
| list01-frow-phone | left region +`tight` |
| list01-ck-phone | full region +`tight`（源页 flex:1 冗余不补） |
| wall01-quad / wall01-quad-fill-bleed | flow-grid +`g22` |
| wall01-duo-row | flow-grid +`g2c`；img×2 +`ar43` |
| wall01-duo-col | flow-grid +`g1c2r`；img×2 +`ar43` |
| list02-boundary | full region +`gap1` |
| list02-full-list / list02-full-ck | full region +`tight` |
| list02-tail-card-list / list02-tail-card-ck | flow-col +`tight` |
| note01-light / note01-dark | left region +`w08 gap5`；right region +`w12` |
| step01-timeline | right region +`w12`（源页左 flex:1 冗余不补） |
| quote01-annotated | full region +`gap5` |
| quote01-minimal | full region +`gap4` |
| card01-body-mn | left region +`w09 gap4`；right region +`w11` |
| data01-bars-only | full region +`gap34`；柱 4 根改 `style="height:{{柱高}}%"`（50/100/75/25） |
| data01-ldr-bars | 柱 2 根改 `style="height:{{柱高}}%"`（50/100） |
| data02-ldr-tailcard | full region +`gap1`；fcard +`w50` |
| compare01-v2-vs / compare01-v2-dark | full region +`gap16` |
| close01-standard / -minimal / -pills-extended | full region +`gap1` |
| close01-quote | full region +`gap22` |
| phone01-trio-labeled | flow-grid +`g3c` |
| data04-panel | flow-col×2 +`w08`/`w12`；img +`ar43`（panel padding 维持孤例丢弃） |

规格级登记卡补注记（就地组装时挂类）：R-data-03→`tight`、R-qa-01→`gap1`、R-cover-02→img `ar43`。

## 3. B7 柱高参数化（裁决 4）

- 柱 `<div class="b">` 内联 `height:N%` → `style="height:{{柱高}}%"`，属"数据驱动几何"合法新类别
- R-data-01 登记卡加豁免注记：值由内容规划期从数据预计算（0-100 整数）；gate 校验边界（非空、0≤v≤100）——gate 校验项在阶段 3 落地，登记卡现在只记约束

## 4. harness 三修（裁决 7，`dev/_sc/render-selfcheck.mjs`）

1. **repeat 向前回溯**：`expandRepeats` 中注释后无开元素（`text[p]!=='<'` 或为另一注释）时，向前回溯 `m.index` 之前最后一个闭合标签 `</tag>`，反向配对找到其开标签作为母版起点，再按现有配对逻辑提取（修 compare 族 37/12/40 只渲染 1 格）
2. **资产路径**：填图时把 `assets/` 前缀改写为 `../../out/assets/`（预览页在 `work/src/_sc/`，画廊资产在 `out/assets/`）；若 `out/assets/` 缺 `iphone-frame.png` 则从 `dev/cases/assets/` 复制一次（修手机区空白、26 分割线压手机）
3. **假文字按槽位形状**：新增形状规则——`/序字|编号|序号/`→`'1'`（1 个字）；`/副题|引言|说明|标语|签名|署名|注脚|注解|出处|描述/`→整句占位串；其余维持现有 SHORT_FAKE 精确表 + ph 原文（修"全是单字"与 21 底部叠字）

## 5. 重渲染 + 波及页核对（裁决 8）

重跑 `node dev/_sc/render-selfcheck.mjs`，产出 41 档并排目检页 `dev/_sc/index.html`；重点核对裁决点名的波及页：**37/12/40 段数恢复（repeat 修复）、20/21 sub 可见、26 分割线不再压手机（资产修复）、17/19 溢出归零（tight）**；其余档位几何与源页一致（gap/flex/grid/ar43 类生效）。

## 6. registry 同步更新（`dev/02-recipe-registry.md`）

- 净化处置表 B1-B6 行补"已落地类名"列；B7 行补豁免注记
- 各登记卡"内联净化"字段追加配方↔类映射（如 R-note-01：`w08+gap5 ｜ w12`）
- 验证核对表勾选更新；用户复核通过后本文件与 41 骨架整体入册 `references/`（闸门关闭动作，待用户确认后执行）

## 验证口径

- 种子：语法仅追加不改既有行；grep 旧内联值在骨架中归零（`style="height:{{柱高}}%"` 除外）
- harness：41/41 渲染 0 FAIL；report.json 中 17/19 溢出归零；37/12/40 组件计数与源页一致
- 目检：波及页与源页 PNG 并排无结构性差异
