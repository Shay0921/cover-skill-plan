# 画廊逐页盘点（阶段 0 产出物）

> 来源：`dev/controlled/controlled-composition-1111-1148/`（47/47 passed，2026-11-11，现行契约架构作者级产物）
> 依据：结构以 `work/src/pNN.part.html` 的 data 属性为准；标题行数以 `out/NN.png` 头部实测；PNG 仅做目检对照。
> 字段：页号｜配方｜区域结构｜组件×条数｜hl 位置与数量｜标题行数｜phone 行为｜特殊变体
>
> 区域枚举（来自源码实测）：`head` / `left` / `right` / `full` / `bottom` / `wall` / `hero` / `overlay`；页面公共件：`page-header`（brand）、`footer`（署名+页码）、装饰 `grain`/`wash`。
> phone 行为：种子 CSS `.phone{height:100%;max-height:104cqw}` = **锁高**；`.cover-bleed>.phone{width:100%;height:auto}` = **锁宽出血**。

## 盘点表（47 行）

| 页 | 配方 | 区域结构（实际分区） | 组件×条数 | hl 位置与数量 | 标题行数 | phone 行为 | 特殊变体 |
|---|---|---|---|---|---|---|---|
| 01 | P01 | head(kicker+h1+sub) / left / right | fcard×3(left,stagger) + phone×1(right) | h1 后段「多种组合」×1 | 1 | 锁高 | issue-line 有；封面 |
| 02 | P01 | head / left / right | ck×4(left) + shot.natural×2(right,flow-grid 1列2行 max-w 46cqw) | h1 后段×1 | 1 | 无phone | issue-line 有；封面文字复用 |
| 03 | P01 | head / left / right | list(frow)×3(left，data-component="list") + text-block×1(right) | h1 后段×1 | 1 | 无phone | issue-line 有；纯文字封面变体 |
| 04 | P01 | head / left / right / bottom | phone×1(left) + phone×1(right) + text-block×1(bottom) | h1 后段×1 | 1 | 双壳均锁高 | issue-line 有；双壳对照 |
| 05 | P02 | head / left / right | frow×3(left，data-component="frow"，cno 编号) + phone×1(right) | h1 后段「并排」×1 | 1 | 锁高 | — |
| 06 | P03 | head / wall / bottom | shot.grow×4(wall，grid 2×2) + text-block×1(bottom) | 无 | 1 | 无phone | 2×2 图墙 |
| 07 | P04 | head / full / bottom | ck×3 + text-block×1(full) + fcard×1(bottom) | h1 后段「边界」×1 | 1 | 无phone | — |
| 08 | P05 | head / left(flex.8) / right(flex1.2) / bottom | mn×2(left) + dcard×1 + shot.grow×1(right) + text-block×1(bottom) | h1 后段「留下注解」×1 | 1 | 无phone | — |
| 09 | P06 | head / full(timeline flex1) / right(flex1.2) / overlay | step×4(timeline) + phone×1 + mn×1(right) + ghost(overlay) | h1 后段「一页内容」×1 | 1 | 锁高 | 单实例①；步骤时间线+旁注 |
| 10 | P07 | head / left / right / bottom | ldr×2(left) + bars×1(2柱) + darkcard×1(3行)(right) + text-block×1(bottom) | h1 后段「口径」×1 | 1 | 无phone | — |
| 11 | P08 | head(h1+sub 无kicker) / full / bottom / overlay | quote.hero×1 + text-block×1(full) + seal-lg×1(bottom) + ghost「句」 | quote 内「让证据留下」×1 | 1 | 无phone | 金句页 |
| 12 | P09 | head / full / bottom | ba×2(before/after，各 ul×3li，flow-row) + text-block×1(bottom) | h1 后段「并列看」×1 | 1 | 无phone | 前后对比卡 |
| 13 | P10 | head / full | qa×3(full) | h1 后段「疑问」×1 | 1 | 无phone | 单实例②；纯问答页 |
| 14 | P04 | head / full(flex1) / right | ck×4(full) + phone×1(right) | 无 | 1 | 锁高 | 清单+壳 |
| 15 | P12 | head(h1+sub 无kicker) / full / bottom | pills×1(3 pill) + cr×3(full) + cta×1 + seal-lg×1(bottom) | ⚠️ hl 在 **sub** 内「可追溯性」×1（非常规位） | 1 | 无phone | 收尾页；hl 位置破例 |
| 16 | P04 | head / full | list(frow)×4(full) | 无 | 1 | 无phone | 纯清单 |
| 17 | P04 | head / full | flow-col: list×3 + fcard×1(full) | 无 | 1 | 无phone | 对照页：整列 vs 末项卡 |
| 18 | P04 | head / full | ck×5(full) | 无 | 1 | 无phone | 纯复选 |
| 19 | P04 | head / full | flow-col: ck×4 + fcard×1(full) | 无 | 1 | 无phone | 对照页：整列 vs 末项卡 |
| 20 | P02 | head / left / right / bottom | fcard×4(left,**stagger**) + phone×1(right) + text-block×1(bottom) | 无 | 1 | 锁高 | 「错落」臂；与 21 对照 |
| 21 | P02 | head / left / right / bottom | fcard×4(left,无stagger=齐列) + phone×1(right) + text-block×1(bottom) | 无 | 1 | 锁高 | 「齐列」臂；与 20 对照 |
| 22 | P01 | head(长标题) / left / right | text-block×1(left) + shot.natural×1(right) | 无 | **3**（长标题自然折行） | 无phone | 长标题压力页；issue-line 有 |
| 23 | P03 | head / wall / bottom | phone×1(wall,flow-col 居中) + text-block×1(bottom) | 无 | **2** | 锁高 | 整屏竖图独占 |
| 24 | P03 | head / wall | shot.natural×2(wall，grid 2列横排) | 无 | 1 | 无phone | 与 25 同图换排列（横） |
| 25 | P03 | head / wall | shot.natural×2(wall，grid 1列2行居中 max-w 46cqw) | 无 | 1 | 无phone | 与 24 同图换排列（纵） |
| 26 | P01 | head(kicker+h1 **无sub**) / left / right | fcard×4(left,stagger) + phone×1(right,**cover-bleed**,data-bleed) | h1 中段「出血」×1 | 1 | **锁宽出血**（cover-bleed） | footer 省页码；出血封面 |
| 27 | P03 | head / wall(**bleed-x**) / bottom | shot.fill×4(wall，grid 2×2 铺满裁切) + text-block×1(bottom) | h1 后段「再谈裁切」×1 | 1 | 无phone | 横向出血图墙 |
| 28 | P05 | head / left(flex.9) / right(flex1.1) | mn.lead×4(left) + phone×1(right) | h1 后段「一整屏」×1 | 1 | 锁高 | 无bottom |
| 29 | P04 | head / full | ck×6(full) | 无 | 1 | 无phone | 条数压力页（6条） |
| 30 | P07 | head / full / bottom | bars×1(4柱) + darkcard×1(3行)(full) + text-block×1(bottom) | 无 | 1 | 无phone | bars 4柱变体 |
| 31 | P12 | head(h1+sub 无kicker) / full / bottom / overlay | pills×1(**5** pill) + cr×2(full) + cta + seal-lg(bottom) + ghost「收束」(two 两字) | 无 | 1 | 无phone | 收尾页 pills 加多变体 |
| 32 | P03 | head / wall / bottom | phone×3(wall，phone-cell 每壳带 text-block 标签，inline style width:100%;height:auto) + serif×1(bottom) | h1 前段「三只壳」×1 | 1 | 3壳**锁宽**（内联覆盖锁高） | 多壳并排；⚠️ 唯一内联改 phone 尺寸的页 |
| 33 | P08 | head(**仅h1** 无kicker无sub) / full / overlay | quote.hero×1(含 rule 装饰 + source + credit) + ghost「章」 | quote 内「这一页说话」×1 | 1 | 无phone | 金句页极简变体 |
| 34 | P05 | head / left(flex.8) / right(flex1.2) | mn×2(left) + dcard×1 + shot.natural×1(right) | 无 | 1 | 无phone | **dark 深色底变体**（p08 映射）；无bottom |
| 35 | P07 | head / full / bottom / overlay | ldr×3(full) + fcard×1(max-w 50cqw)(bottom) + ghost「数」 | h1 后段「一份口径」×1 | 1 | 无phone | ldr 3条变体 |
| 36 | P12 | head(h1+sub 无kicker) / full / bottom / overlay | cr×3(full) + cta×1(bottom) + ghost「录」 | 无 | 1 | 无phone | 收尾页极简变体（无pills无seal） |
| 37 | P09 | head / full / bottom | ba×4(full，grid 2×2，各 ul×3li) + text-block×1(bottom) | h1 后段「四段选择」×1 | 1 | 无phone | ba×4 双组对照变体 |
| 38 | P09 | head / full / bottom | ba.before×1 + **vs 骑缝标记** + ba.after×1(竖排) + serif×1(bottom) | h1「竖着读」×1 + bottom serif「同一组选择」×1 = **2** | 1 | 无phone | 竖排对比（与12同内容换排列） |
| 39 | P09 | head / full / bottom | 同 38 完全同构 | 同 38 = 2 | 1 | 无phone | **dark 深色底变体**（内容与38逐字相同） |
| 40 | P09 | head / full / bottom | shot×2(1:1，inline aspect-ratio,flex:none) + ba×2(full，两列各 shot+ba 叠放) + text-block×1(bottom) | h1 后段「两种窗口」×1 | 1 | 无phone | 图+对比卡复合页 |
| 41 | P07 | head / full | ledger×4(full，每条 k/d/n/u 四件套) | 无 | 1 | 无phone | 账目页；ledger 为组件库独有组件 |
| 42 | P11 | head(kicker=封面topic「咖啡记录素材演示」) / **hero(bleed)** / bottom | shot.fill×1(hero，整幅左右出血) + text-block×1(bottom) | 无 | 1 | 无phone | ⚠️ 区域名 **hero**（盘点中新发现的第7种 region 枚举）；大图出血页 |
| 43 | P03 | head / wall / bottom | phone×2(wall，phone-cell 带标签，inline height:68cqw;width:auto) + text-block×1(bottom) | h1 后段「并排」×1 | 1 | 2壳**锁高68cqw**（inline 指定） | 双壳等大并排 |
| 44 | P05 | head / left(flex1) / right(flex1) / bottom | phone×1(left，inline height:75cqw 锁高) + text-block×1 + dcard×2(right) + text-block×1(bottom) | h1 前段「整机」×1 | 1 | 锁高75cqw（inline） | 壳+详情卡 |
| 45 | P02 | head(kicker+h1 **无sub**) / left / bottom | fcard×2 + phone×1(height:75cqw) + fcard×2(left，phone 居中两侧标注卡；fcard **无ic图标**，inline padding:1.7cqw) + serif×1(bottom) | h1 中段「居中」×1 | 1 | 锁高75cqw（inline） | ⚠️ fcard 简化结构+内联 padding；「标注在两侧」三栏复合 |
| 46 | P11 | head / full / bottom | **panel** 容器(inline padding): ldr×1 + text-block×1 + shot.natural×1 (full)；pills×1(3 pill)(bottom) | h1 后段「并排」×1 | 1 | 无phone | panel 面板容器变体 |
| 47 | P12 | head(h1+sub 无kicker) / full / bottom / overlay | cr×3 + serif×1(金句)(full) + cta×1(bottom) + ghost「结」 | h1 第二行「一句收束」×1 + serif「留下来源」×1 = **2** | **2**（h1 内 inline-block 手动断行） | 无phone | 收尾+金句复合页 |

## 阶段 0 结论与初步标注

### 配方分布核对（与 DEVPLAN §2 一致）

P01×6（01 02 03 04 22 26）｜P02×4（05 20 21 45）｜P03×7（06 23 24 25 27 32 43）｜P04×7（07 14 16 17 18 19 29）｜P05×4（08 28 34 44）｜P06×1（09）｜P07×4（10 30 35 41）｜P08×2（11 33）｜P09×5（12 37 38 39 40）｜P10×1（13）｜P11×2（42 46）｜P12×4（15 31 36 47）——合计 47 ✓

### P06/P10 单实例初步标注（阶段 1 正式裁决）

- **P06（页09）**：步骤时间线（step×4 timeline）+ phone + mn 旁注 + ghost。读者体验=「逐步流程」。⚠️ 初步意见：结构与其它页差异大（timeline 脊柱线为独有布局类），归并不容易；但右侧 phone+mn 与 P05「旁注+证据」有语义重叠。→ 先试归并，不合脚则独立成配方（骨架级）。
- **P10（页13）**：纯 qa×3 问答页，无图无 bottom。读者体验=「答疑」。结构极简（1 组件×3），→ 按判据 §4.2-5 大概率降为**规格级**。

### 盘点发现的结构性事实（供阶段 1/2 使用）

1. **hl 节奏**：47 页中 30 页 hl×1（绝大多数在 h1 后段/中段）；页38/39/47 为 hl×2（h1+收尾金句各一）；14 页 hl×0（多为对照页/清单页/深色页）；页15 hl 落在 **sub** 内（唯一破例）。
2. **标题行数**：45 页 1 行；页22=3 行（长标题压力页）、页23=2 行（整屏竖图压缩头部）、页47=2 行（inline-block 手动断行）。
3. **对照臂普遍存在**：p20/21（错落vs齐列）、p24/25（横vs纵）、p16vs17、p18vs19（整列vs末项卡）、p38/39（浅vs深）——同一内容换排列是画廊的实验方法本身。聚类时「同配方变体」候选集中在此。
4. **dark 变体**：页34（P05）、页39（P09），p-page 加 `dark` 类，仅换种子配色变量。
5. **phone 尺寸行为实测汇总**：默认锁高（页01/04/05/09/14/20/21/23/26/28）；出血锁宽（页26 cover-bleed）；多壳锁宽（页32，inline width:100%，**全画廊唯一内联覆盖锁高的页面**）；inline 指定高度（页43=68cqw、页44/45=75cqw——同一「锁高」语义的不同档位）。
6. **region 枚举实测**：head / left / right / full / bottom / wall / hero / overlay（`wall` 为图墙区、`hero` 仅页42使用；DEVPLAN §0 字段示例中的 left/right 只是子集）。
7. **组件命名不一致**（阶段 3 约束归属时需处理）：frow 在页03/16/17 记 `data-component="list"`，在页05 记 `"frow"`；serif 在页11/33 记 `"serif"`（组件名）同时是 class 名。
8. **issue-line（期刊号）只出现在 P01 封面族**（页01-04、22、26）；页26 footer 省略页码（出血页特例）。
9. **overlay ghost**（背景大字）出现在页09/11/31/33/35/36/47 共 7 页，字数为 1-2 字，`ghost two` 为两字档。
10. **关键压力页**（配方边界证据，聚类时优先裁决）：页22（长标题）、页29（ck×6 条数上限）、页30（bars 4柱）、页31（pills 5个）、页37（ba×4）、页32（多壳锁宽）、页42（hero 出血）。

### 自检

- [x] 47 行齐全（01-47 无遗漏）
- [x] 每行与 `out/NN.png` 目检一致（头区域裁剪拼图逐页核对标题行数与 hl 位置；`_sheet.png` 全览核对整体布局）
- [x] P06/P10 已做初步标注
- [x] 结构以 part.html data 属性为准，PNG 仅对照
