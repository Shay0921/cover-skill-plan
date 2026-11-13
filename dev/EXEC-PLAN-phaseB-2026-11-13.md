# 阶段 B 收口 → T14 可执行施工图（2026-11-13）

> **状态：待用户批准。批准前不改任何代码、不提交任何 commit。**
>
> 本文件只给「改什么、跑什么、什么算过、怎么提交」。技术定案依据 `dev/DIAGNOSIS-h68-overflow-2026-11-13.md §8.5`，路线 `dev/TODO-roadmap-2026-11-13.md`，状态台账 `dev/GAPS-STATUS-2026-11-13.md`。执行口径以本文件为准；技术裁决仍以 DIAGNOSIS 为准，冲突时先回报、不自行解释。
>
> 来源：2026-11-13 监工逐字实证复核，推翻原方案三条技术断言（拉宽/压窄守卫方向、坏例构造手段、A1 不接池）。

---

## 0. 实测底账（本方案全部断言的来源）

| 项            | 实测值                                                                                                                                                                       | 证据                                                                  |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| git 位置       | HEAD `6f1663a`，44 个 `M`、4 个 `??`                                                                                                                                          | `git status --short`                                                |
| B-seed 施工    | seed L33 `.heading` → `.p-page .heading`（gap 优先级修复）；SHA `7771E1EA…` → `E11C9E1E…`；`build.mjs` + `04-recipes.md` 三处同步                                                      | `git diff`，3 文件各 1 行                                                |
| 41 图重渲       | 已完成，逐图像素差留档                                                                                                                                                               | `dev/_sc/pixdiff-bseed-1113.json`                                   |
| 2140 回归      | `total 184 / passed 184 / failed 0`（2026-11-13T11:47Z）                                                                                                                    | `dev/controlled/controlled-negative-1113-2140/test-results.json`    |
| 负例索引         | `scope=…1905`、`count=184` —— **未切 2140**                                                                                                                                  | `dev/controlled/negative-index.json`                                |
| 三锁           | 种子 / 资产台账 / 索引对账全绿，新 SHA 已生效                                                                                                                                              | `dev/check-*.mjs`                                                   |
| h75 压测       | card02-long `failed R1×2`；card02-short `passed`；note02-long `failed R14（宽 33.8 超出 36–40）`、r1Count=0；note02-short `passed`                                                 | `dev/h75-stress-tmp/stress-report.json` + 4 份 `work/qa-report.json` |
| h68 等比可达宽度   | `63.5–68cqw 高 × 910/1806 = 32.0–34.3cqw 宽`；`max-height` 封顶使拉宽不溢出 wall                                                                                                     | `seed/paper-journal.html:97/101`                                    |
| R10 覆盖面      | `validate.mjs:34/211-220` 取全部 `[data-component]`（含 `.phone`），`skew>1.01` 判 ERROR，**只管比例失真，不管等比压缩**                                                                        | 代码 + note02-long 实测 R10 静默                                          |
| 11 条 R14 夹具  | 无一条依赖 `duo-labeled [32,36]`：`skeleton-carrier-width` 用 `frow-phone [36,42]`、`skeleton-shot-counts` 用 `shot-ba [40,45]`、两条 `counts-*` 首错是缺 h1，其余是 tracks/anchor/headline 类 | `negative-index.json` fixtures                                      |
| 池约束          | `project.mjs:105-107` 强制读 02-pool/03-plan；`:134` 校验 `uses` 必须命中池；`lint-dom.mjs:201-216` 双向对账 `data-from ↔ assets ↔ uses`；`:272-293` 逐字比文案                                 | 代码                                                                  |
| 骨架体量         | 41 骨架 / 483 处 `data-from` / 197 唯一 ID / 622 次 `{{}}` / 154 唯一占位符名                                                                                                         | 全文扫描                                                                |
| `.gitignore` | 已存在且 tracked，**不含** `.workbuddy/` 规则                                                                                                                                      | 文件                                                                  |

---

## 1. 分刀总表

| 刀       | 内容              | 前置        | 完成判据                                                           | commit                                                                   |
| ------- | --------------- | --------- | -------------------------------------------------------------- | ------------------------------------------------------------------------ |
| **S**   | B-seed 收尾（主体笔）  | —         | 索引 2140 对账 exit 0、41 图目检留痕、stress 正名 + gitignore 入册、旧 SHA 标注失效 | 1 笔（`8eb6d27`，2026-11-13 21:11:33）                                          |
| **G**   | 用户闸门（6 项）       | S         | 逐项答复 + 监工复核，落 `dev/GATE-B-2026-11-13.md`                       | 无（六项全按推荐通过；用户答复 21:21，监工复核签字 22:00 补，记录随刀 C 入库） |
| **C**   | B-contract      | G 通过      | h68 坏例删档前后对照表 + 全量回归全绿 + v3 修订记录入库                             | 1 笔（`c210241`，2026-11-13 21:31:22；套件 `controlled-negative-1113-2128` 184/184）                               |
| **A2**  | 池契约拍板（三问）       | C         | 用户授权监工代拍，裁决落 `dev/GATE-A2-2026-11-13.md`                                                         | 无                                                                        |
| **A1**  | 41 骨架 × 真实 gate | A2        | 41 页 qa-report + 失败清单（只登记不修）                                   | 1 笔（`46f6c60`，2026-11-13；35 passed / 6 failed，6 页失败只登记进批次 C 清单，见 `dev/controlled/a1-41-skeleton-1113/A1-summary.md`）                                   |
| **A1fix** | A1 定箱收尾（EXEC-A1fix-2026-11-13） | A1 回报 | seal「真」/ R-list-01 补 full / p19·p37 双定箱 / 31→58/29/23 口径定谳 / P8 立项；全量重跑 39 passed / 2 failed（p19 R14、p20 R14 均骨架病只登记）；三锁绿 + drift=0 | 1 笔（`caaef53`，2026-11-13；29 文件）                                   |
| **A3**  | 驱动文档范式同步        | A1        | 四文件旧术语归零、与 SKILL 六步对齐                                          | 1 笔（`b7dacf4`，2026-11-13；4 文件 14±14 行纯改写，旧术语 grep 归零，纯文档零代码回归，三锁+对账零涟漪）                                   |
| **批次C** | p19 甲案 + p20 纠偏 + A1 终跑收尾 | A3（用户拍板 p19 甲案） | 判据见 `EXEC-PLAN-batchC-2026-11-13.md`；A1 终态 41/41 | 3 笔（C1 `94b0097` / C2 `c961760` / C3 本笔）                                   |
| **T14** | 豆仓 7 页验收        | 批次C 收口 + 用户闸门 | 用户验收                                                           | —                                                                        |

顺序不可倒。闸门 G 未过不得动 `config/` 与 gate 代码。

---

## 2. 刀 S · B-seed 收尾（主体笔）

### 2.1 顺序修正

`.gitignore` 与 stress 正名**提前到本笔**，不再放收尾笔。理由：主体笔要 commit 压测产物，若当时目录仍是临时名，会把 `h75-stress-tmp/` 固化进历史、收尾笔再 rename；且 `git add` 有纳入 `.workbuddy/` 的风险。

### 2.2 动作清单（按序）

1. `.gitignore` 追加 `.workbuddy/`。**只忽略、不删除目录**——该目录是本地会话数据。
2. `dev/h75-stress-tmp/` → `dev/h75-stress-1113/`。保留四 case 的 `work/qa-report.json`、`geometry-digest.json`、`02-pool.json`、`03-plan.json`、`src/p01.part.html` 与 `stress-report.json`；重复资产副本按 `dev/e2-duo-h68-1113/` 同款口径保留（不在这刀裁剪）。
3. `stress-report.json` 补 meta：`seedSha = E11C9E1E…`、生成时间、口径定义（测量元素 = `.phone`；单位 px / cqw；`headH/bodyH/phoneH` 定义；R1/R14 计数来源 = qa-report 的 ERROR 列表）。
4. **41 图目检抽验**：打开 `dev/_sc/index.html`，抽验 ≥6 张（建议 01 / 04 / 20 / 32 / 43 / 45），逐张记录「head 间距收紧 / 无文字溢出 / 手机未裁切」，写入 `dev/_sc/bseed-visual-check-1113.md`。`pixdiff-bseed-1113.json` 显示全图 36%–54% 像素变化属 gap 修复预期，目检对象是**文字与载体**，不是像素数。
5. **索引切 2140**：先改 `negative-index.json` 的 `scope` → `dev/controlled/controlled-negative-1113-2140`，再 `--write`。顺序不可倒——脚本从索引自身 scope 取套件目录，先 `--write` 会对 1905 空转。
6. **旧 SHA 残留**：`grep -rn "7771E1EA" --exclude-dir=.git .`，把 `GAPS-STATUS` L17/L82、`TODO-roadmap` L134 的状态表述标为「阶段 A 基线，已被 B-seed 的 `E11C9E1E…` 取代」。历史行保留原值 + 失效注，**不涂改归档**。
7. 账目同步：`GAPS-STATUS` 快照（种子基线 / 索引 scope / 工作区）、`TODO-roadmap` 指针段、`DIAGNOSIS §8.5.1` 的 v3 修订记录可起草但**结论留空待闸门 G**。

### 2.3 命令与判据

```sh
cd D:/AI/html2png/mine/cover-skill-plan
node dev/check-seed-lock.mjs
node dev/check-asset-registry.mjs
node dev/check-locks-e2e.mjs
# 改 scope 之后：
node dev/check-negative-index.mjs --write
node dev/check-negative-index.mjs          # 裸跑必须 exit 0
```

判据：`check-negative-index` 输出 `indexCount=184 / onDisk=184 / driftCount=0 / missingFromIndex=[] / indexedButAbsent=[] / suite.failed=0`，退出码 0；三锁全 PASS；`git status` 中 `.workbuddy/` 与 `h75-stress-tmp/` 不再出现。

### 2.4 commit

`git add` **逐文件精确列出**（41 PNG + `seed/` + `tools/build.mjs` + `references/04-recipes.md` + `negative-index.json` + 2140 归档 + `h75-stress-1113/` + `pixdiff-bseed-1113.json` + 目检记录 + 账目文档 + `.gitignore`），**禁止 `git add -A`**。

```
B-seed：gap 优先级修复 + SHA E11C9E1E + 41 图重渲 + 基线 2140 全绿 + h75 压测入册
```

---

## 3. 闸门 G · 用户确认 6 项（缺一不进刀 C）

| # | 待确认                               | 依据                                                                             | 推荐值                                                                                                                          |
| - | --------------------------------- | ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| 1 | 修订 DIAGNOSIS §8.5.2 **第 1 条**     | 「R10 已覆盖」被证伪：note02-long 810→724px 等比压缩、skew≈1、R10 静默、唯一 ERROR 是 R14           | 改为「R10 只覆盖**比例失真**，不覆盖等比压缩；等比压缩下限由 R14 承担（h75 两条），h68 弹性档由 floor/cap 钳制 + R10 共同承担」                                          |
| 2 | 修订 §8.5.2 **第 2 条**：删 3 条 → 删 1 条 | 压测证明两条 h75 的 width 仍有守卫价值                                                      | 只删 `R-phone-01.duo-labeled [32,36]`；`card02-centered [36,40]`、`note02-phone-dcards [36,40]` 保留                               |
| 3 | 四组压测用例入册                          | 「镜像债挂账」目前无守卫证据                                                                 | card02-long → 负例（R1×2）、note02-long → 负例（R14）、两 short → 基线正例                                                                  |
| 4 | h75 两条**分别定性**                    | 打包挂账会把因果记错                                                                     | card02 = 横排锁高致 R1 真实溢出，与 width 档无关，弹性化另立项；note02 = 纵排可缩致 R14 下限是唯一守卫，width 档保留                                               |
| 5 | 复测口径写死                            | 734.4（68cqw cap）/ 685.8（63.5cqw floor）/ 702.8（§8.3 真实管线）/ 685.8（B-seed 报告）四值冲突 | 统一为 `.phone.h68` 的 `getBoundingClientRect().height`（px），同时记 `phoneW = height × 910/1806`；不预设 `:has` 失效；偏离 >2px 先查 gap 与字体再定性 |
| 6 | A6 追认                             | 曾是「待用户拍板」三件之一                                                                  | **用户拍板**「维持已完工销单」+ 监工复核；不由监工单方追认                                                                                             |

**闸门记录**：答复原文、时间、监工复核结论写入 `dev/GATE-B-2026-11-13.md`。v2 的两条修订以「修订记录 v3」**追加**到 DIAGNOSIS §8.5.1，v2 原文不覆盖（归档不回改）。

---

## 4. 刀 C · B-contract

### 4.1 五步（顺序不可倒）

|   |   |   |
| - | - | - |

1. `tools/validate.mjs:102` → `if (carrier.width && (w < carrier.width[0] - 0.5 || w > carrier.width[1] + 0.5))`。`owners.length` 的「载体缺席」检查（:99）不动；width 存在时的越界判词与 hint 原样保留。
2. `tools/project.mjs:89` → `if (carrier.width !== undefined && !interval(carrier.width, 1, 108)) throw …`。`interval(undefined,…)` 当前返回 false 会直接 throw，**必须先改**；width 存在时的 `[1,108]` 合法性校验保留。
3. `config/recipes.json` 的 `R-phone-01.duo-labeled.carriers[0]`：**删 `width` 字段，保留 `component/region`**（保住「区域 wall 必须有可见 phone」）。其余 18 条 width 一字不动。`git diff --stat` 必须是 1 行 1 字段删除。
4. 夹具（4.2 / 4.3）。
5. 全量回归：新目录 `controlled-negative-1113-<HHMM>` → 改 scope → `--write` → 裸跑对账；三锁零涟漪。

### 4.2 真验收物：h68 坏例「删档前 / 删档后」对照

**不是 184 全绿**。全绿只证明没砸坏旧东西；本刀要证明删掉宽度档之后谁接住。

前提：h68 的 `.phone` 宽度是高度派生量（`aspect-ratio:910/1806; width:auto`），不能靠内联 `width` 造等比场景。因此坏例分**两种手段分开登记**，禁止混用下结论：

| 编号   | 构造手段                  | 模拟什么                                | 复用点                                       |
| ---- | --------------------- | ----------------------------------- | ----------------------------------------- |
| B-N1 | `h68Duo(短 sub)`       | 正常文案基线（phone 顶格 68cqw）              | `test-controlled.mjs:333`                 |
| B-N2 | `h68Duo(sub ×5~8)`    | 长文案撑高 head → phone 触底 floor 63.5cqw | 同上；现有 `h68-duo-long-head` 是**正例**，需另造坏例方向 |
| B-N3 | `phoneW(id, '30cqw')` | AI 越权写死内联宽度（历史病根，显式标注为「模拟误写」而非等比证据） | `test-controlled.mjs:304`                 |
| B-N4 | `phoneW(id, '38cqw')` | 同上，拉宽过 cap                          | 同上                                        |

每条**删档前、删档后各跑一次**，结果表现场填写（**不预判**）：

| 编号   | 阶段    | phoneW (cqw) | phoneH (px) | skew | status | ERROR 规则码 | 定性 |
| ---- | ----- | ------------ | ----------- | ---- | ------ | --------- | -- |
| B-N1 | 前 / 后 |              |             |      |        |           |    |
| B-N2 | 前 / 后 |              |             |      |        |           |    |
| B-N3 | 前 / 后 |              |             |      |        |           |    |
| B-N4 | 前 / 后 |              |             |      |        |           |    |

定性只允许实测后写：接住（哪条规则）/ 静默（走后果化裁决）/ WARN / 显式接受残余。若 B-N1/B-N2 删档后静默，按 §8.5.3 走残余裁决，**不得改夹具 `expected` 去凑绿**。对照表命名 `dev/controlled/b-contract-h68-matrix-1113.md`。

### 4.3 11 条 R14 夹具：核对，不重登记

逐条核对 `negative-index.json` 里 11 条 R14 夹具的 `first_error`，出一张「是否依赖 width 字段 / 删档后是否翻转」核对表，附在归档目录。实证预期 **11 条全部不翻转**，没有可重登记的内容；夹具本体不动。

### 4.4 四组压测入册（闸门第 3 项落地）

把 `h75-stress-1113/` 四 case 的 qa-report 结论登记进 DIAGNOSIS §8.5.2 v3 修订记录与 GAPS-STATUS 挂账条；card02-long / note02-long 作为**已知遗留的守卫证据**入负例清单，不在 184 受控套件内强行造夹具。

### 4.5 判据与 commit

- 第 1、2 步后：`node -e` 直接对「无 width 的 carrier」调 `loadProject` 不抛。
- 第 3 步后：41 骨架零 diff；`git diff config/recipes.json` 只 1 行。
- 第 5 步：`N/N passed`、对账 exit 0、三锁全绿。
- message：`B-contract：删 duo-labeled 宽度镜像 + width 缺省放行 + h68 删档前后对照`

---

## 5. 刀 A2 → 刀 A1

### 5.1 A2 三问（用户拍板，先于 A1）

> **⚠ 本节表格的「推荐」列已于 2026-11-13 21:45 被 A2 实证复核部分推翻，执行以 §5.1-R 为准。原表原值保留不涂改（归档不回改）。**

A1 **无法「不接内容池」**：`project.mjs:105-107` 强制读 pool/plan，`lint-dom.mjs:201-216` 双向对账，`project.mjs:134` 校验 uses 必须命中池。A1 必须构造**受控池契约**；解耦的只有真实文章内容，不是池本身。

| # | 问题                                       | 推荐                                                                                              |
| - | ---------------------------------------- | ----------------------------------------------------------------------------------------------- |
| 1 | 骨架的 197 个唯一 `data-from` ID 是否即池资产 ID？    | 是，骨架 ID 即池 ID，A1 按 ID 生成假文字资产                                                                   |
| 2 | 622 次 / 154 个唯一 `{{占位符}}` → 197 资产的映射规则？ | 沿用 `dev/e2-duo-labeled.mjs:11-35` 范式：`{{图N}}` → 资产文件名，其余按中文占位符名 → 假文字表；映射表逐项落 `dev/A1-BRIEF.md` |
| 3 | 41 页 `uses` 怎么生成？                        | 由每页骨架实际出现的 `data-from` ID 集合反向生成，不手写                                                            |

#### 5.1-R 修订记录（2026-11-13 21:45，监工 A2 实证复核）

| # | 裁决 | 现行执行口径 | 实证依据 |
|---|---|---|---|
| 1 | **改**（原推荐失效） | ID 命名空间沿用（骨架 ID 即池 ID），但**不按 ID 反推文案**：先按形状规则填充页面，资产 `text` 由该 ID 在本页实际上版文字反向拼接；`kind` 一律落 `highlights`/`pains`/`hooks`（非 strict，避开 L15 逐字 ERROR） | 197 ID 中 31 个跨骨架对应多占位符、9 页同页同 ID 多文案；`lint-dom.mjs:270` `strictKinds={data,quotes}`。⚠ 失效注（EXEC-A1fix E2，2026-11-13 监工 22:34 复核）：「31」为编制期静态扫描旧口径，A1 全量实跑实测三种口径 **58**（元素 outerHTML 占位符名去重，含嵌套 span/alt）/ **29**（仅跨 ≥2 骨架文件）/ **23**（填充后文案去重），以 58/29/23 取代；逐 ID 明细 `dev/controlled/a1-41-skeleton-1113/id-stats.json`。三口径下裁决结论不变（同 ID 多形状文案槽成立） |
| 2 | **改**（原推荐失效） | 不复用 `dev/e2-duo-labeled.mjs:11-35`（`FILLED` 仅 11 key），改复用 `dev/_sc/render-selfcheck.mjs:18-23,109-117` 形状规则；`{{图N}}` → `dev/cases/assets/` s1–s9，`{{柱高}}` → `BAR_HEIGHTS`；未命中即 throw，不许静默留 `{{}}` | 154 唯一占位符 / 622 次出现；`references/assets/` 仅 1 个 png；L24 拦残留、L25 需 0–100 整数 |
| 3 | **按推荐 + 3 条硬约束** | `uses` 取本页 `data-from` 并集反向生成；断言 `union(uses) === Object.keys(assets) === 197`（零孤儿，`project.mjs:158` 是 throw）；每资产 `id/text/evidence/source` 四字段非空；41/41 layout 精确命中，不许降级写 `"free"` | 实测 0 未匹配；`collectPoolAssets:48` |

**裁决主体**：用户授权监工逐项代拍（非执行方自裁），全文见 `dev/GATE-A2-2026-11-13.md`。原表第 1、2 问的推荐值是我编制本方案时未做代码实证所致，**错在方案，不在照方案施工的执行方**。

拍板后同步 `SKILL.md §3`、`references/01-content-refinement.md`、`references/02-constraints.md` 的口径说明；**不动 gate 代码逻辑**。三份文档已于 21:45 同步，随刀 A1 入库。其中 `SKILL.md`「先按这些 ID 把资产建齐再写页面」描述的是**正常运行期**工作流；A1 受控池是测试特例，按 §5.1-R 的「先填页面 → 再反推资产 text」顺序执行，不得照字面照搬。

### 5.2 `dev/A1-BRIEF.md` 必备内容

受控池生成脚本入口、197 ID 清单来源、154 占位符→假文字映射表（按 §5.1-R 的形状规则，非 e2 `FILLED`）、41 页 uses 生成方式、gate 命令、失败判据（qa-report status / ERROR 规则码）、「只登记不修」纪律。缺任一不得开工。

**当前状态**：`dev/A1-BRIEF.md` 已落盘（89 行，随刀 A1 入库），含单 run 目录、`placeholder-map.json` 全量 622 条、形状规则表、池反向生成算法、四条加载前断言（零残留 / 零孤儿 / 四字段齐备 / `union(uses)=197`）、41/41 layout 命中断言。`dev/A1-run.mjs` 驱动**尚未实现**，A1 未开工。

### 5.3 命令与判据

```sh
# dev/A1-run.mjs 为本刀新建驱动（当前不存在），41 骨架 → 受控池 + 计划 → 完整 gate 全链
node dev/A1-run.mjs
node tools/gate.mjs "<run>/work/src" "<run>/out" \
  --plan "<run>/work/03-plan.json" --pool "<run>/work/02-pool.json"
```

判据：41 页各出 `qa-report.json`；汇总表列每页 status 与 ERROR 规则码；失败者**只登记进批次 C 清单，不当场修**；产物归档 `dev/controlled/a1-41-skeleton-1113/`。

---

## 6. 刀 A3 · 驱动文档同步（T14 前必须）

逐段过四份：`references/01-content-refinement.md`（L94/98/102-104）、`references/02-constraints.md`（L43/50/151）、`references/03-components.md`（L7/10/15/18）、`config/components.json`（serif description）。把「LLM 决定组件/顺序/件数」「按 allow 圈候选」「L22 拦截」旧范式换成「配方设计期定死」。

判据：旧术语 `grep` 归零；与 `SKILL.md` 六步流程逐条对齐；纯文档改动、无代码回归。T11 已同步的 L19/L22 口径只需复核，勿重复改。

---

## 7. T14 入口条件（本方案不含执行）

A3 完成 + 用户闸门 → 豆仓 7 页真实素材跑新流程 → 逐页对照登记卡 hl 节奏 → 对照 `MILESTONE §5.4` 逐项核销，含计时/轮次记录与「未达标只修配方内容」的防摆锤路径。`--preview` 仍后置，T14 实测后凭数据立项。

---

## 8. 硬纪律

1. 每刀单独 commit，禁止 `git add -A`；`.workbuddy/` 不入库、**不删除**。
2. 归档不回改；11-11 两历史快照永不删改；v2 原文保留，修订以 v3 追加。
3. T7 / T10 / T14 与本方案闸门 G 必须用户确认，闸门记录落文件。
4. 改 config 必跑七维自查；改 seed 必三处同步 + SHA 重算。
5. 实测 > 文档口径；守卫结果**先跑再定性**，不预判、不改 expected 凑绿。
6. 回退：单刀 `git revert <该刀 commit>` 即可，不影响前后刀；刀 C 第 5 步若 N/N 不过，回退整刀并重做 4.2 对照表。

---

*编制：监工（2026-11-13 20:55）。每刀完成后在本文件第 1 节总表补 commit hash，不改动已完成刀的正文。*

