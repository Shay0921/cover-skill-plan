# cover-skill-plan 开发报告（当前状态）

日期：2026-11-11。对象：`mine/cover-skill-plan`。本文描述 skill 的**当前状态**：交付面、检查器契约、能力边界、证据链与已修复的缺陷登记。历史轮次过程叙述已按维护者要求清除；缺陷只保留"遇到过的 bug"及其修复结论。规则语义的唯一事实源是 `references/02-constraints.md`，本文不复制第二份——只写勘误性补充与结论。

## 1. 结论

**生产可用：无遗留代码缺陷、无冗余、无历史残留。** 负例套件 171/171 全过、索引对账 drift 0；构图 47 页与组件库 25 页带 shot 全量重跑通过（0 ERROR，本轮在本机 Windows 复核，见 §10）。本轮新增构图骨架层（`recipes.layouts` + plan `layout` 选档）与构图不变量硬错误（L20/L21/L22、R14/R15/R16/R18），并把返修提速落地：一次报全 + 几何数字摘要 + `--incremental` 哈希守卫沿用（见 §10）。经审阅遗留的全部历史拍板项（#8–#18、B1–B6、C 组）均已闭环；P11 画面页配方与 ledger 账行组件已落地并纳入基线；背景大字逐页语义化、中心机页与数据×画面证据卡、双机页与左机右卡页已入基线（见 §7.6）。当前无待拍板项。（**本轮第二次更新，见 §11**：其余 6 配方骨架补齐至 12/12、负例扩至 175/175、构图 47/47 复核通过；组件库复核暴露一处先前轮次遗留的 nn24 form 缺陷，经拍板以构造器 form 感知选档修复，组件库 25/25。）

## 2. 交付面与分工

```text
素材 → 内容池 02-pool.json + 轻量计划 03-plan.json
              ↓ LLM 选择、写作、排列
     work/src/pNN.part.html（工作源文件）
              ↓ gate
     禁网空白 Target 内 DOMParser 安全解析 → 构建
              ↓ 同一个 Chrome 实例
     字体/图片就绪 → 几何检查 → 同一 Target 截图
              ↓ 全批成功才发布
     out/ + work/qa-report.json
```

| 文件 | 唯一职责 |
|---|---|
| `SKILL.md` | 运行入口、阶段顺序、按需读取；引用七项（含 `references/styles/paper-journal.md`） |
| `references/01-content-refinement.md` | 内容保真、内容池、轻量计划字段 |
| `references/02-constraints.md` | 输出、安全、标记与检查接口（规则唯一事实源） |
| `references/03-components.md` | 组件选择方法与素材流程 |
| `references/styles/paper-journal.md` | 视觉语义 |
| `config/components.json` | 26 个组件的名称、说明、标准实例 |
| `config/recipes.json` | P01–P12 的意图、区域、allow/require/max/form |
| `seed/paper-journal.html` | 视觉 CSS、画布骨架、流式布局原语 |

执行链：`gate` / `build` / `lint-dom` / `validate` / `shot-all` 共用 `pipeline`、`project`、`cdp`；独立命令是同一条链的分段入口。`find-chrome` 是库模块（无 CLI 入口，文档未承诺独立命令）。

## 3. 检查器契约概览

完整规则表以 [02-constraints.md](../references/02-constraints.md) 为准。当前拦截面：

- **静态（lint，禁网 DOMParser 阶段）**：L0 安全（标签/属性/危险 URL/路径段穿越/CSS URL）、L6 期号·dark·brand 与计划一致、L8 数字与豁免标记内容边界、L9 图层身份、L10 资产来源双向对账（正向 data-from 引用必须在 plan uses 里；反向 uses 列了必须真的被 data-from 引用）、L11 区域 allow/require/max/form、L14 数字单位绑定、L15 data/quotes 渲染文字严格比对、L16 润色提示、L17 内联自定义属性禁（任何 `--*`，含大小写与下划线变体）、L18 拼错属性告警（厂商前缀 `-webkit-*` 等为有意兼容、不告警）、L19 phone 组件 cell+caption 配对锁、L20 骨架区域顺序/件数/tracks 区域存在、L21 overlay 区域必须是画布根直接子级、L22 金句保留 `.rule` 却省 `.source`、L23 出血区域没有配文（head/bottom 至少一处文字叶，区内图注不作数）。
- **几何（validate，真实渲染后）**：R0 骨架 brand/footer、R1 越界、R2 遮挡、R7 密度提示（WARN）、R9 比例空白带（WARN）、R10 声明比例被压窄、R11 img 加载却 0 宽高、R12 `main.body` 无可见组件硬错误、R13 require/form 命中但不可见硬错误、R14 骨架几何越档（列宽占比 ±0.01 / 标题行数 / 载体宽度档 ±0.5cqw / 锚点载体可见，仅选了骨架档的页）、R15 时间线步内拉伸余量 >12cqw、R16 `data-bleed` 未贴到出血边、R18 向下出血页脚折行。
- **加载期（project）**：`require ⊆ allow`、孤儿资产拒（`thesis.id` 豁免）、空 brand 拒、`dark` 非布尔拒、`max` 写到 allow 之外拒、require 空组/组员未 allow 拒、`layouts` schema 与引用合法性（区域/组件存在、carriers/anchor 被该区 allow 接纳、区间合法）、`layouts: null` 归入空对象报错（原会以 TypeError 崩溃）、plan `layout` 选档纪律（有骨架必须选一档或 `free`，无骨架只能缺省或 `free`）。
- **豁免清单（精确范围）**：`.brand` 三图层、`.footer` 的署名与页码、`.issue` 整棵——`.issue` 整棵免检是刻意的（期号常带话术），静态只锁 `meta.issue` 一致 + 留在页眉，话术由目检把关。

## 4. 检查器不保证的事（能力边界）

1. 不是自动审美保证——回归与正例只证明已覆盖的情况，新内容仍需看图。
2. 不是事实真实性证明——工具核对引用关系与数字/单位/引语归属，不能验证证据本身真实。
3. 不是任意 HTML 的万能视觉校验——故意伪装组件、复杂像素遮挡仍需人工审查。
4. 不是完全离线交付——图片内嵌，webfont 是网络依赖；加载失败须核对实际 face 与版式。
5. 不是编辑器集成——manifest 是画布坐标快照，不回放编辑状态。
6. 比例检查只认声明值——未声明 `aspect-ratio` 的手写窗口不会被拦（R10/R9 局限）。
7. webfont 只按 400 字重使用——需要粗体衬线必须引入对应字重的 fontsource CSS，不得靠浏览器合成假粗体；sans 族 700/900 走系统字体真实字重。
8. 并发语义——同一 `work/` 目录由 `work/.qa-lock` 独占（O_EXCL）：活锁直接拒绝、残锁自动接管、锁在报告落盘后释放；批处理语义下排队不如拒绝诚实。

## 5. 证据链现状

`dev/controlled/` 每类一套。构图与组件库归档目录为 macOS 时期渲染（2026-11-11 上午）；**本轮在本机用新代码带 shot 复核了同一套构图 47 页与组件库 25 页（47/47、25/25，0 ERROR），并新增骨架覆盖率回归，结果见 §10 与 `dev/layout-coverage.json`**。负例基线已扩到 171（含骨架与构图不变量负例）（**本轮第二次扩至 175，组件库复核为 25/25，见 §11**）（**本轮再扩至 180：新增 L10 反向 uses-listed-but-unused + L23 出血配文 3 例 + layout-null-value 加固探针，见 §11**）：

| 目录 | 内容 | 结果 |
|---|---|---|
| `controlled-composition-1111-1148/` | 构图 47 页正例 + 画廊（index.html / gallery-desktop.png）+ 实验验证 | **47/47 passed、0 ERROR**；实验 29 断言全过；浏览器交互 22 检查全过（FONT、R7 已知常态告警） |
| `controlled-library-1111-1046/` | 组件库 25 页（26 组件减 vrt）+ 画廊 index.html | **25/25 passed、0 ERROR**；画廊与构图画廊同一构建器（配方筛选按钮带语义名、卡片标"实测哪个组件落在哪个配方哪个区域"） |
| `controlled-negative-1111-1730/` | 负例套件 171 夹具 test-results.json（含骨架 L20/R14、构图不变量 L21/L22/R15/R16/R18 与 plan layout 加载拒） | **171/171 passed** |
| `controlled-negative-1111-2251/` | 负例套件 175 夹具（本轮第二次新增 4 例：P11 出血占比 R14、P09 图窗件数 L20、P08/P12 整幅档正例对照） | **175/175 passed** |
| `controlled-negative-1112-1100/` | 负例套件 180 夹具（本轮第三次新增 5 例：L10 反向 uses-listed-but-unused 拒 + L23 出血配文 3 例 成对 + layout-null-value 加载期拒；同时画廊夹具 uses 改为按页面 data-from 自动抽取，修掉"写死 uses:['h1','d1']"的账目漂移） | **180/180 passed**（当前基线，见 §11） |
| `negative-index.json` | 对账索引（scope 指向负例行） | `check-negative-index.mjs` 对账 **drift 0** |

组件库 25 页不是漏测：26 个组件中 `vrt`（竖排标签）标记 `placement:"catalogue"`，没有任何配方在区域里放行它、构建不出合法页，只登记造法、不参与出图实测（`test-component-library.mjs` 顶部注释即此设计）。

素材源 `skill-tests/assets/` 是 `create-controlled-fixtures.mjs` 的 INPUT，重跑依赖它，勿删。

## 6. 复现

从 skill 目录执行。**重跑必须写入新目录**——构造器不接受写死的历史路径，不带参数直接抛用法错误。

```sh
# 1. 负例套件（180 夹具，产出 test-results.json）
node dev/test-controlled.mjs <新目录>
# 2. 组件库 25 页（noShot 校验 + 带 shot gate + 画廊）
node dev/test-component-library.mjs <新目录> && node tools/gate.mjs <新目录>/work/src <新目录>/out
node dev/build-experiment-gallery.mjs <新目录>   # 组件库与构图共用画廊构建器（要求 fixture-notes.json）
# 3. 构图 47 页
node dev/create-controlled-fixtures.mjs <新目录> && node tools/gate.mjs <新目录>/work/src <新目录>/out
# 5. 构图后续（实验断言 + 画廊 + 浏览器交互检查）
node dev/verify-experiment.mjs <新目录>
node dev/build-experiment-gallery.mjs <新目录>
node dev/serve-controlled.mjs <新目录> 4173 &   # 后台起本地服务（跨文档换色需 http://）
node dev/test-experiment-browser.mjs <新目录> http://127.0.0.1:4173
# 4. 收尾：归档命名 controlled-negative-<时间戳> 后改索引 scope，重建索引
node dev/check-negative-index.mjs --write
```

独立 CLI（`build` / `--no-shot` / `--shot-only`）用于定位问题或分段执行。**lint 与 gate 一次报全**：枚举全部计划页、同轮收齐结构错与几何错；gate 用部分构建（lint 失败页不构建、错误留报告，其余页继续到几何层，几何失败也不短路后续页），`validate`/`shot` 仍是全有或全无。`FAILED n/N 页` 的 n 是已枚举页数（一次报全下等于 N），逐页明细以 `qa-report.json` 为准、实测数字以 `geometry-digest.json` 为准。返修轮可加 `--incremental` 只重测改动页（inputKey 哈希守卫，交付前仍须跑一次不带它的全量 gate）。合页/删页/改页号后重跑必须换新输出目录（工具不代删历史产物）。

骨架覆盖率回归（不启动浏览器，回放既有 qa-report 的实测几何判定 L20/R14，落档 `dev/layout-coverage.json`）：

```sh
node dev/check-layout-coverage.mjs <workDir> [<workDir>...]   # 如画廊 work + 豆仓 work
```

## 7. 遇到过的 bug 与缺陷（全部已修复或定性）

### 7.1 检查器静默通道（最严重一类：文档承诺了代码没做到的事）

| 缺陷 | 现象与根因 | 修复 |
|---|---|---|
| S1 整页正文消失仍 passed | `main.body` 整棵隐藏（`display:none`/`opacity:0`）后 gate 全绿并交付 PNG：`visible()` 过滤后集合为空，R0 只查 brand/footer，R11 只救 img 一维为 0 | 新增 **R12**（正文无可见组件=ERROR）与 **R13**（require/form 命中但不可见=ERROR），23 组"注入拦+对照不拦"成对探针验证 |
| S2 豁免标记绕过 | `data-decoration` 夹带 `data-editable`/长文本、`data-numbering` 超长、`[hidden]` 被内联 `display:block` 覆盖——豁免连数字校验一起跳过 | B2 内容边界（decoration 禁 editable 文字叶、≤8 字符；numbering ≤8；hidden 被 inline 覆盖不再豁免） |
| B6 来源链只验数字 | 资产"甲 50 元乙 100 元"，页面编"提升 50 倍"挂同一资产 → PASSED（探针实证） | **L14** 单位绑定（数字+单位须在资产同数字后出现）、**L15** data/quotes 严格比对（`paraphrase:true` 降 WARN）、**L16** 其余无重叠 WARN；刻意保守：多来源沿用数字并集、严格类允许"资产 text 的连续片段" |
| brand 不比对 | `meta.brand` 与画布品牌任意不符 → PASSED（期号却逐字比对） | B3：画布 `.brand` textContent 必须包含 `meta.brand`，否则 L6 |
| 孤儿资产无强制 | "孤儿禁令"纯文档承诺，`project.mjs` 只查 uses→池单向 | B4：池中未被任何页引用的资产加载即拒 |
| R10 序列化 NaN | Chrome 把 `aspectRatio` 序列化为 `"910 / 1806"`，按空白拆分得 NaN | 按 `/` 拆分逐段转数；`aspect-ratio-crushed` 负例确认触发 |
| `.shot>img` 覆盖内联高度 | `height:0;flex:1` 类名规则盖过内联测试高度，R9 打不中 | 负例加 `flex:none` 后命中；规则按实际渲染比例判断，不依赖类名 |

### 7.2 布局与素材缺陷

| 缺陷 | 修复 |
|---|---|
| 手机壳在窄区被静默压扁（实测 0.4865 vs 壳 0.5039） | 新增 R10；页面两栏比例改 1.1/0.9 |
| 手机墙 4 只无界面名且超可读范围 | `max:{phone:3}` + `.phone-cell` 界面名（文字在壳根外，避免压壳体触发 R10）；夹具改 3 只 |
| contain 空白带被当边框/空白混淆 | 默认 `.shot` 窗口底色描边删除，只留 `inset` 变体；R9 WARN 记录每框 `fit/boxed` |
| 整屏截图素材走 `.shot` 窗口 | `asset_meta` 标记整屏素材禁止 `.shot`，强制带壳载体 |
| 方形 `square` 形态与种子 CSS 冲突致 img 高 0 | 生成侧窗口本体写比例/flex；检查侧新增 R11 |
| 深色页背景纯平（`.wash` 只有浅色处理） | 种子补 `.dark .grain` 暖色点纹理与 `.dark .wash` 左上暖光+底部压暗 |
| 期号出现在全部配方 | `issue:true` 只归 P01；L6/L9 强制"计划没给不许写、写了必须一致且在页眉内" |
| 清单与浮动卡紧贴（区域 gap:0） | 清单自套 `flow-col gap:0`，卡片由 `.region` 默认间距分开（实测 25.91px） |
| CDP 总览 base64 超时（31 页内联连续两次超时） | 总览改普通图片引用 + `file://` 导航等待解码 |
| `fcard` 图标全是占位「＋」 | 图标改从标题提炼的单字并带来源标记 |

### 7.3 安全与解析

| 缺陷 | 修复 |
|---|---|
| 路径检查未匹配 `assets..` 形式穿越 | 按路径段拒绝 `.`/`..`；穿越负例明确命中 |
| CSS `content` 检查误伤 `justify-content` | 改属性边界匹配，补合法内联布局正例 |
| 原子组件被误要求 `data-group` | 仅含子图层的复合组件要求分组 |
| Windows 下 `find-chrome` 空环境变量拼出非法路径（三根×三浏览器共 9 候选逻辑） | 根目录逐个 `filter(Boolean)`；Chromium 仅环境变量回退（02-constraints.md 已注明） |

### 7.4 文档-代码矛盾与旧债定性

| 缺陷 | 处置 |
|---|---|
| S3：「缺高亮不报错」与 P08 `form` 强制相矛盾 | 文档限定到标题区；配方 `form` 点名时引语内必须一处 `.hl`（L11） |
| S4 冷启动陷阱群（style 块、图片 src 契约、`meta.brand/issue` 恒存在、候选/孤儿互斥、换目录规则、浏览器前提、`<style>` 拒绝） | 九条纯文档修复落地（02/01/03）；纯文字页冷启动 hand-author 首轮即 PASSED 实证文档够用 |
| `find-chrome.mjs` 头注释引用不存在的 `measure.mjs`/`shot.mjs` | 注释清理 |
| 种子 4 条死规则（`.span-all` 等）+ 示例页真实署名期号 | 删除；示例页换中性占位 |
| `.p-page.dark` 被误判死代码 | 实测在用，补进骨架说明与布局原语清单 |
| B11「build 不处理 font-weight」旧债 | **销债**：fontsource CSS 的 @font-face 自带 `font-weight:400` 描述符且 build 原样保留；全库 serif 使用均为 400；700/900 全在系统字体族。防未来约束入 02-constraints.md §4.7 |
| L18 厂商前缀误承诺（文档称会告警，守卫实为静默跳过） | 文档改为"拼错属性才告警；厂商前缀是有意兼容" |
| L17 名称与实现不符（实为禁任何内联 `--*`，且下划线变体曾漏） | 正则补齐变体；文案改为"禁止声明自定义属性" |
| `layoutProps` 白名单缺口（`margin-block` 等真实布局属性误报 L18）+ 幻影属性（`inset-top` 等非真实 CSS） | 补 6 名、删 4 个幻影、去重；纯减误报 |
| `qaSummary` 死导入、`stale-png-protection` 夹具缺 cell+caption（R2 取证丢失）、两条 phone-wall 夹具报错混杂 | 已修：夹具补齐后报错收敛为只剩 L19；lint 67→66、geometry 15→16 桶迁移即凭证 |
| 并发无锁（同 work 目录双跑互踩报告） | `work/.qa-lock` O_EXCL；活锁拒绝/残锁接管/真实竞争三项实测，报告零污染 |

### 7.5 P11 画面页与账行落地轮（2026-11-10）

| 缺陷 | 修复与结论 |
|---|---|
| 出血负边距挂在图窗（`.shot.bleed`）上，组件几何越出所属区域被 R1 拦截 | **架构级结论：出血是区域级布局档**——种子新增 `.region.bleed`（区域整体左右贴画布边），出血区内的图窗用 `fill` 铺满；组件几何仍留在区域内，不触发越界。规则已入 03-components.md，原语清单已入 02-constraints.md；出血区域必须配标题或说明文字，不允许整页只剩图 |
| 新组件 ledger 进 P07 只改了区域 `allow`，未同步配方 `require` | 账行页只有 ledger 时触发 `L11 P07 要求本页至少放一个 bars/ldr`。修复：P07 require 改为 `[["bars","ldr","ledger"]]`。**新增组件承载配方语义时，require 与 allow 必须一起改** |
| 负例套件与构图构造器共用同一输出目录 | `test-controlled.mjs` 会重建目录，删掉了构图侧的 `03-plan.json`，gate 报 ENOENT。"重跑必须换新目录"的规则同样适用于**套件之间**：负例与构图各写独立目录 |
| P11 配方区域缺 `full` 的 allow | 三列窗格页把 text-block 图注放 full 区被 L11 拒。修复：P11 补 `"full":{"allow":["shot","text-block"]}` |
| 三列窗格页图窗与图注组件同 key，触发 L9 重复图层 id | 注释组件 key 加 `-note` 后缀；构造器惯例：同页同素材的伴生文字一律另起 key |
| 组件库 d1 合成资产不含 ledger 演示文案，25 页全部 L15 | 沿用当年 bars/ldr 的处理惯例：d1 text 追加"口径标签 一句口径说明 180 分钟 → 30 分钟"片段 |
| 追加页排在 P12 收尾页之后：画廊页序 P12 → P07/P11，收尾页失去收尾语义 | 页序重排：P12 record-closing 挪到 p44，P09 竖排组与 P07/P11 新页依次前移（38–43）。第一次只改页码参数没挪 page() 调用位置，画廊仍按数组顺序把 44 排在 37 与 38 之间——**`page()` 调用顺序就是页序，改页序必须整体挪动调用块**，收尾页固定写在文件末尾（构造器已加注释）。另：`verify-experiment.mjs` 与 `test-experiment-browser.mjs` 存在硬编码页码断言，改页序必须同步两处脚本（本次已同步） |
| 三列窗格页图栅格挂 `.grow` 被拉伸：单行 auto 聚顶、注释被推到页底，中间拉出大片空洞 | 去掉图栅格 `.grow`，图与注作为整体随区域 `justify-center` 居中，留白上下对称。**栅格拉伸只对多行 `1fr` 有意义，单行 auto 栅格挂 `.grow` 只会把空洞留在自己的底部** |

### 7.6 版式扩展与骨架语义轮（2026-11-11）

| 缺陷 | 修复与结论 |
|---|---|
| 负例期望串落后于配方：`anyof-p07-missing` 期望 `bars/ldr（任一）`，而 P07 require 上一轮加入 ledger 后报错串实为 `bars/ldr/ledger（任一）`，套件稳定 134/135 | 期望串同步为 `bars/ldr/ledger（任一）`。**改配方 require 文案后必须全局搜负例期望串**（报错串由 require 条目动态拼接，期望串却是手写的） |
| 证据卡第一版把 `background/border/border-radius/box-shadow` 写进内联 style，被自家 L17 整批拦下（质感属性只由种子给出） | 种子新增 `.panel` 原语（底色/描边/圆角/阴影），页面只用类名+布局属性（padding/gap/flex）。**做新样式先问质感归种子还是归页面**，与出血归区域同一级的架构结论 |
| 证据卡第二版容器挂 `.grow` 拉伸：卡内上下大片空洞 | 卡不拉伸、只包内容（compact panel），区域 `justify-center` 居中，留白留在卡外；左列 flex 从 0.7 回调 0.8，避免 ldr 名称竖排断行 |
| 双机页（43 页）同区放 2 只 phone 被 L19 拦下：同区多只手机每只必须包 `.phone-cell` 且壳下有界面名 | 用 `phone(spec,{label:true})` 生成 cell+界面名；L19 挡住的不只是漏图注，还强制"多壳并排必须逐只署名"的版式契约。双机页底部说明收成一行（bottom ~101px→~50px）给 wall 区让出手机加界面名的高度 |
| 47 页标题按 `\u200B` 零宽空格断行无效：CJK 相邻字符间天然都是断点，浏览器贪心取最晚断点，ZWSP 永远输给"再多放一个字"，结果仍按宽度在"收/束"中间乱断 | `marked()` 把 `\u200B` 后的整段包成 `display:inline-block`（布局属性允许内联），整块不可内断才会在指定位置掉行；verify 加断言锁"断点标记存在 + 标题实际两行"。**语义断行要靠不可内断的整块，不靠零宽字符** |
| 中心机页 ±2.5cqw 列级错落目检反馈"像没对齐而非错落"：小幅偏移两头的观感都不占，反而牺牲整齐感 | 左右两列改回首卡对齐；verify 断言同步改为对齐锁（y 差 ≤1px）。**错落要有意义必须偏得明显（≥5cqw 级）或配合高低差更大的卡，小幅错落不如对齐** |
| 双机页两壳一高一低目检反馈"大小不一、又没水平居中" | 改为两壳等大 68cqw、同一水平线，flow-row 加 `justify-center` 水平居中；标题/说明/高亮词同步去掉"错落、一高一低"字样，verify 断言锁等大 + 同水平 + 组心对 wall 居中（≤20px）。**页面文案（标题/说明）必须与实际版式行为一致，改版式时要全文搜相关措辞** |
| 左机右卡页手机 70cqw 目检偏小；同类排查全 47 页手机"区域填充率"后，确认中心机页 73cqw（92%，余 73px）是唯一同款问题——09 页 85% 是旁注共列、32 页 79% 是三联墙刻意缩小 | 44/45 页手机统一为高度驱动 75cqw（≈宽 38cqw，left 区 R1 上限附近）；**同级版式的整屏手机应同级大小，排查工具是 qa-report 的 phone rect ÷ 区域 rect 高** |
| 画廊配方筛选按钮按"首次出现"排序，P12 排在 P11 前 | `build-experiment-gallery.mjs` 改按配方 ID 数字序排序（P01→P12）；组件库画廊同构建器自动一致 |
| 中心机页手机按 38cqw 宽驱动时高 815px，区域只有 798px，R1 上下越出；手机窄时卡片说明又出现单字孤行 | 三个约束叠加定稿：**手机以高度驱动**（现为 75cqw≈宽 38cqw，R1 是区域高度先顶死的，宽度诉求要折算成高度写）、**整页省引题行**给区域让高度、**fcard 本页省去 ic 圆标**并收窄内边距换文字宽度；第四张卡说明换本页专用 11 字短句（`anchor-supplement-detail`），避免在「产品」中间断行。**宽手机 + 窄侧列的版式，文案长度要按侧列实宽逐句核对** |
| 数据×画面证据卡下方空、页面缺收束 | bottom 区加 pills 三枚（P11 bottom 已放行，对应 ref-7 的标签行）；skill 无独立 button 组件，行动入口用 `.cta`（P11 未放行）、标签行用 `.pills`，两者职责不同不混用 |

本轮同批落地（非缺陷）：背景大字逐页语义化（`ornament-<页>` 逐页资产，两字换 `.two` 档贴右缘与印章重叠，废除"为印章让位错开"的旧决定）；`.seal` 支持整体换成 logo 图（`.seal.logo` + 内嵌 `data-slot="image"` 的 `<img>`，文档入 02-constraints.md）；P11 full 区放行 `ldr`；43 页新增"中心机+环绕标注卡"（P02）；44 页重做为"数据×画面证据卡"（P11，替代与手机墙雷同的三列窗格）；44 页新增"双机等大并排"（P03，吸收 ref-5）、45 页新增"左机右卡"（P05，吸收 ref-4，配方为此放行 P05 left 区 phone）；文案 `\u200B` 语义断点机制入 `marked()`（47 页演示）。构图 45→47 页，45/46/47 页页号随新页顺延。

### 7.7 闭合轮：出血配文缺口 + L10 反向对账 + layout null 加固（2026-11-12）

| 缺陷 | 修复与结论 |
|---|---|
| `.region.bleed` 出血区域"必须配一处标题或说明文字，不允许整页只剩图"——03-components.md 明确承诺，lint-dom.mjs/validate.mjs **零规则拦截**。R12 只查正文有可见组件，`shot` 本身就算可见组件。与历史最严重的 S1 同性质：**文档承诺了、代码没做到** | 新增 **L23**（lint-dom.mjs）：区域挂 `.bleed` 时，head 或 bottom 至少要有一个可见文字叶；出血区内部的图注不作数（它是图的附属，不是页面信息锚点）。成对负例探针：`bleed-region-without-caption`（拒）/ `bleed-region-head-caption` 与 `bleed-region-bottom-caption`（对照放行）。出血本身仍然合法——封面手机出血、画面页出血不受影响 |
| L10 只有正向（data-from 必须在 uses 里），**反向缺口**：uses 列了资产、页面却没用也没人拦。LLM 后补计划凭记忆列多、或者账目漂移，静默通过 | 新增 **L10 反向**：uses 列了、页面没有任何 data-from 引用 → 打回。画廊夹具原写死 `uses:['h1','d1']`，新规则上线后 25 页全红——不是误伤，是夹具账目确实漂移（很多页根本没引用 d1）。已修为按页面实际 data-from 自动抽取，**反向规则同时修掉了夹具的隐式账目漂移** |
| 配方写 `layouts: null` 会让 `Object.entries(null)` 抛 TypeError，不可读崩溃 | 归入"空对象"报错：`layouts: null` 和 `layouts: {}` 统一给出"要么不写，要么至少给一个骨架档"的清晰错误。加载期 schema 层拦，不进渲染 |
| pool → plan → HTML 三步串行强制顺序被质疑"增加 LLM 思考负担"——诊断报告里那次 30 分钟的运行里，"规划内容池"这步占了约 1/4 的轮次 | 改为**顺序不限**：三个文件同一轮写出即可，gate 只在运行时要求齐备 + 三向对账。**不是砍掉 pool/data-from，是砍掉顺序强制**——防编造校验（L14/L15/L16）一根没砍，砍掉的只是"先单独想一轮内容池"的规划步骤 |

本轮同批落地（非缺陷）：SKILL.md 工作流从 6 步合并为 4 步；pipeline.mjs 新增 `--delivery <目标目录>`，gate 成功后自动把 out 里仅三类产物（HTML、PNG、assets/）拷贝到指定交付目录，work/ 中间产物一律不进交付区；负例基线 175→180，画廊回归 25/25，索引 drift 0。

## 8. 环境与注记

- 跨平台：归档目录含 macOS 与 Windows 两个时期的执行路径，按档案读；本轮（§10）实测在本机（Node v20.14.0，Chrome headless via CDP）。
- `dev/` 含本报告、9 个复现脚本与 `controlled/` 证据目录。重跑一律写入新目录再归档；当前负例基线以 §5 表为准（`controlled-negative-1111-1730`，171），被取代的 `controlled-negative-1111-1046`（135）作为历史保留、不参与本轮判定。（**本轮第二次更新**：当前基线为 `controlled-negative-1111-2251`，175，1730 转为历史，见 §11。）（**本轮第三次更新**：当前基线为 `controlled-negative-1112-1100`，180，2251 转为历史，见 §11。）
- 版式参考图（小红书 7 张）存档于 `dev/controlled/reference-shots/`，见 §9 索引。

## 9. 版式参考图索引

2026-11-11 目检吸收的小红书 App 介绍图，原文件存档于 `dev/controlled/reference-shots/`（逐字节复制，仅作版式参照，素材内容与本 skill 的咖啡素材无关）：

| 文件 | 版式要点 | 吸收去向 |
|---|---|---|
| `ref-1-text-left-phone-right.jpg` | 左侧标题+多段短文，右侧单只大手机 | 对照 24 页（row 版式） |
| `ref-2-anchor-phone-surround-cards.jpg` | 中心手机，四周浮动标注卡（含角标胶囊） | 45 页中心机+环绕标注卡（P02） |
| `ref-3-title-list-bleed-phone.jpg` | 巨号标题+左下列表卡+右下角出血手机 | 印证 26 页出血方向 |
| `ref-4-phone-left-notes-right.jpg` | 左侧深色整机，右侧标题+三要点卡 | 45 页左机右卡（P05） |
| `ref-5-duo-phone-stagger.jpg` | 两只倾斜手机并排+两侧标注卡+底部图标行 | 44 页双机等大并排（P03，倾斜/错落按目检反馈舍弃） |
| `ref-6-center-phone-lockscreen-closing.jpg` | 中心锁屏手机+左右标注卡+底部两行收束 | 45 页中心机页的收束句来源 |
| `ref-7-number-plus-evidence-card.jpg` | 巨号数字与排行榜截图并排+顶部 pills | 44 页数据×画面证据卡（P11） |

## 10. 构图骨架与返修提速（2026-11-11 本轮）

**要解决的两个问题**：(1) 人工扩画廊没问题，但模型自主生成时布局乱套、组件乱用（豆仓管理-2026-11-11 即此类）；(2) 校验→重写→校验循环让 6–8 页配图耗时半小时以上。

**机制：契约管语义，骨架管几何，两层独立。**

- 骨架登记在 `recipes[id].layouts`（命名档，区间数值来自画廊实测几何校准）：`order`（区域顺序，`?` 可缺省）、`tracks`（区域宽占正文宽比例）、`headline`（标题行数区间）、`carriers`（载体宽度档，数值区间如 `[52,54]`，单位隐含 cqw，不写单位字符串）、`counts`（件数区间）、`anchor`（锚点载体）。当前 6 条配方带档：P01 A/B/C/D、P02 A/B、P03 A/B/C/D、P05 A/B/C、P06 A、P07 A/B/C；其余配方无骨架。（**已过期**：本轮第二次已补齐其余 6 配方，12/12 带档，见 §11。）
- plan `pages[].layout` 显式选档或写 `free`（与 `dark` 同一纪律：分辨刻意自由与忘了选档）；有骨架不选档加载即拒。骨架只锁几何区间，组件选择与文案仍由内容决定，`free` 页不豁免语义契约。
- 检查分两层：静态 **L20**（区域顺序/件数/tracks 区域存在）+ 渲染 **R14**（列宽占比 ±0.01、标题行数、载体宽度 ±0.5cqw、锚点载体可见）。
- 新增构图不变量硬错误（均带实际失败的负例）：**L21** overlay 必须是画布根直接子级（ghost 锚点才唯一）、**L22** 金句省出处时连 `.rule` 一起省、**R15** 时间线步内拉伸余量 >12cqw、**R16** `data-bleed` 必须真贴到出血边、**R18** 向下出血页脚必须单行。
- 种子吸收：`.heading` 统一 gap（47/47 通用修正）；新增 `.text-block.muted` 弱档，给 L17 封死内联改色改字后一条合法的次要说明降档通道。组件目录补登变体 `shapes`（shot natural/fill/inset、mn lead、ba before/after、ck done、text-block muted），变体选择写进 plan intent 供目检核对。

**返修提速（三管齐下）**：一次报全（lint+gate 枚举全部页、同轮收齐结构错与几何错，gate 部分构建）省掉挤牙膏式多轮；`geometry-digest.json` 给实测 cqw/列宽占比，返修不用开 PNG 猜尺寸；`--incremental` 按 inputKey 哈希守卫沿用未变页的实测与截图，只重测改动页（交付前仍须全量）。

**本轮回归（本机 Windows，Node v20.14.0，Chrome headless via CDP；跑在 `.tmp-skeleton` 临时副本上，永久证据为 negative-1730 目录 + `dev/layout-coverage.json` + 本节）**：

| 套件 | 结果 |
|---|---|
| 负例套件 | **171/171 passed**，索引对账 drift 0 |
| 构图 47 页（带 shot 全量） | **47/47 passed，0 ERROR**（R7/FONT 常态告警） |
| 组件库 25 页（带 shot 全量） | **25/25 passed，0 ERROR** |
| 豆仓 7 页（带 shot 全量） | p04（P07/C）、p07（P12）**passed**；p01 拒（R14 标题 2≠1 行 + 载体 46∉52–54cqw + R16 未贴出血边）、p02 拒（L21）、p03 拒（L22）、p05 拒（L20 step 3∉4–6）、p06 拒（L21）——自主生成的乱版被拦下，好页放行 |
| 骨架覆盖率 | 画廊 **26/26** 个有骨架档的页命中至少一档；豆仓 p01 几何**无任何档可落**（乱版证据）、p04 命中 C；p03/p05 lint 失败未构建故无实测几何（如实标注） |

**耗时实测（画廊 47 页，带 shot）**：

| 轮次 | 耗时 | 说明 |
|---|---|---|
| 全量 gate | **45.1s** | 47 页全部导航测量 + 截图 + 联系表 |
| `--incremental` 无改动 | **15.4s** | 47/47 沿用，只跑 lint+build，不导航不截图 |
| `--incremental` 改 1 页 | **22.1s** | 46 沿用 + p20 重测重拍 |
| 组件库 25 页全量 | 20.3s | 对照 |
| 豆仓 7 页全量 | 7.6s | 对照 |

单页返修轮从 45s 降到 22s（约省一半）；7 页笔记全量 gate 本身仅约 7.6s。半小时级耗时的主因是模型重写循环而非 gate：骨架前置防乱版减少返修轮数，一次报全每轮收齐错误，增量再压低每轮成本。

## 11. 其余 6 配方骨架补齐（2026-11-11 本轮第二次）

**承接 §10**：§10 给前 6 配方（P01/P02/P03/P05/P06/P07）建了骨架档，其余 6 配方当时无档。本轮按同一画廊实测校准流程补齐 P04/P08/P09/P10/P11/P12，**12/12 配方全部带档**。§10「其余配方无骨架」已过期，以本节为准；§1/§5/§8 的负例基线 171 也扩至 175（见下）。

**新增骨架档**（区间数值来自画廊对应页实测几何，逐页经 `evalLayout` 验证命中；单样本配方只立一档，不臆造第二档）：

| 配方 | 档 | 几何要点 | 校准画廊页 |
|---|---|---|---|
| P04 清单 | A 整幅清单 | full 占比 0.98–1.0、标题 1 行 | p07/16/17/18/19/29 |
| P04 清单 | B 清单 + 右机 | full/right 各 0.46–0.50、右机 39–44cqw、标题 1 行 | p14 |
| P08 金句 | A 整幅金句 | full 0.98–1.0、标题 1 行（单样本档） | p11/33 |
| P09 对比 | A 整幅对比 | full 0.98–1.0、标题 1 行 | p12/37/38/39 |
| P09 对比 | B 对比 + 双图窗 | full 0.98–1.0、shot 件数 2–2、图窗 40–45cqw、标题 1 行 | p40 |
| P10 问答 | A 整幅问答 | full 0.98–1.0、标题 1 行（单样本档） | p13 |
| P11 画面 | A 出血画面 | hero 占比 1.10–1.18（左右出血）、shot 96–104cqw、标题 1 行 | p42 |
| P11 画面 | B 整幅图窗 | full 0.98–1.0、shot 41–46cqw、标题 1 行 | p46 |
| P12 结尾 | A 整幅收束 | full 0.98–1.0、标题 1–2 行（p47 实测 H2，故上限取 2） | p15/31/36/47 |

**本轮回归**（本机 Windows，Node v20.14.0，Chrome headless via CDP；跑在 `.tmp-tier6` 临时副本，永久证据为 `controlled-negative-1111-2251` 目录 + `dev/layout-coverage.json` + 本节）：

| 套件 | 结果 |
|---|---|
| 负例套件 | **175/175 passed**，索引对账 **drift 0**。新增 4 例：`skeleton-bleed-share`（P11/A，hero 占比 1.0∉1.10–1.18 → R14，取证占比 >1 的出血档）、`skeleton-shot-counts`（P09/B，1 只 shot∉2–2 → L20）、`skeleton-quote-tier`（P08/A 整幅金句正例对照）、`skeleton-closing-tier`（P12/A 整幅收束正例对照） |
| 构图 47 页（带 shot 全量） | **47/47 passed，0 ERROR**（46.3s；R7/FONT 常态告警） |
| 骨架覆盖率 | 画廊 **47/47** 命中至少一档；豆仓 **2/7**（p04/p07），乱版页 01/02/03/05/06 无档可落 |
| 豆仓 7 页（带 shot 全量） | p04（P07/C）、p07（P12/free）**passed**；p01 拒（R14 标题 2≠1 行 + 载体 46∉52–54cqw + R16 未贴出血边）、p02 拒（L21）、p03 拒（L22）、p05 拒（L20 step 3∉4–6）、p06 拒（L21）——拒绝模式与 §10 完全一致；p02/P04、p06/P08 虽已带档但计划写 free，仍由构图不变量 L21 拦下，证明 free 不豁免语义与构图契约 |
| 组件库 25 页（noShot + 带 shot） | **25/25 passed，0 ERROR**：nn24（seal-lg）经构造器 form 感知选档改落 P12 后通过（先前轮次遗留缺陷，本轮已修，见下） |

**组件库构造器的两处修正（均已落地，25/25）**：
- layout 必填适配：12 配方全部带档后 `pages[].layout` 在加载期成为必填，组件库构造器原先不写 layout 会让 25 页全部加载即拒。给 `dev/test-component-library.mjs` 每页补 `layout:'free'`——目录页只实测单组件标准造法，刻意自由构图、不演示骨架档，仍受通用几何约束。
- form 感知平局裁决（修 nn24，经拍板）：补 free 后 nn24 仍失败——它是 seal-lg 的标准实例页，构造器按「连带最少」把它落在 P08 并连带一个 serif 实例；P08 要求 serif 呈现形态 hero，而目录默认 serif 实例现为 `class="quote"`（无 hero），故 L11。**根因是先前轮次把 serif 默认实例从 `quote hero` 改成 `quote`**（`controlled-library-1111-1046` 归档里 nn24 用 `quote hero` 通过）；form 是配方级检查、与 layout 无关，**不是本轮骨架引入**，生产检查器行为正确（P08 缺 hero 金句就该拒）。修法取「连带数相同时优先无 form 的配方」：在 `dev/test-component-library.mjs` 选档循环加平局裁决，seal-lg 由 P08（require serif、form hero）改落 P12（require cta、无 form），连带 cta 默认实例即满足。逐组件模拟确认**仅 seal-lg 一例选档变化**，其余 24 组件落点不变；`config/components.json` 未改（保留先前 serif 默认实例的设计意图）。修复后组件库 noShot + 带 shot 均 **25/25**。

**耗时**（本机实测）：画廊 47 页全量 gate 首轮 **46.3s**（§10 为 45.1s，同量级），form 修复后 gallery3 复核仍 **47/47**（qa-summary 计时 27.5s）；组件库修复后 noShot **8.6s** + 带 shot **15.0s**（修复前 13.1s/14.4s）；豆仓 7 页全量约 7.6s（§10）。

## 12. 目检画廊补骨架档标注 + 版本核对（2026-11-12）

**承接 §11**：用户问「12 配方共多少骨架、HTML 在哪」，并指出我先指的永久归档 `controlled-composition-1111-1148/index.html` 是旧版。**实测核对归档 vs gallery3**：页面源片段（去首行运行目录注释）**47/47 逐字相同**——骨架档是从这些页的实测几何校准提取的几何契约，并未重画页面 HTML；但**种子 CSS 不同**（out/01.html `<style>` 125965→126592 字符，本轮吸收 `.heading` 间距 / `.text-block.muted` 弱档等修正），**plan 骨架字段归档 0/47 vs gallery3 47/47**。故归档画廊确为带档前旧版（旧种子 + 无档旧计划），当前骨架版是 gallery3。

**构建器增强**：给 `dev/build-experiment-gallery.mjs` 加骨架档标注——卡片棕色徽章「X 档 · 档名」、配方摘要列该配方各档、「全部」摘要计骨架总档数；`layout:'free'` 页标「自由构图」，归档旧计划无 layout 时徽章留空（向后兼容）。用 gallery3 生成当前版画廊 `.tmp-tier6/gallery3/index.html`。

**浏览器实测**（CDP，面板隐藏故无截图，以 DOM 脚本核验）：47 卡片 + 47 骨架徽章；筛选 P01→6 页（A/B/C/D 四档）、P07→4 页（A/B/B/B，确无 C）、重置→47；「全部」摘要「47 张 · 12 配方 · 骨架 26 档」；控制台 **0 错误 0 警告**；PNG 47/47 齐全（隐藏面板下懒加载未触发，naturalWidth=0 非坏图）。

**骨架总数与覆盖**：**26 档 / 12 配方**（P01×4、P02×2、P03×4、P04×2、P05×3、P06×1、P07×3、P08×1、P09×2、P10×1、P11×2、P12×1）。26 档中 **25 档有画廊渲染页**，**P07/C（两栏·账行+手机）画廊无 dedicated 页，由豆仓 p04 覆盖**（`.tmp-tier6/coffee/out/04.html`，P07/C gate passed）。档→页答案键见 `dev/create-controlled-fixtures.mjs` 的 `LAYOUT_BY_NN`。
