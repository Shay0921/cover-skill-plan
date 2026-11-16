---
name: cover-skill-plan
description: 把产品说明、文案与真实截图提炼成小红书或公众号信息卡片，输出 1080×1440 PNG 多页长图（附可进编辑器的 HTML）。用户要做系列配图、功能介绍、干货或数据卡片、种草图文、截图整理成卡片时使用。不用于网站、PPT、演示文稿或单张 AI 生图封面。
argument-hint: <原文素材路径或目录>
---

# 信息卡片生成（固定母版制）

> **权威声明**：本文件是生产 SOP 与跨风格机器契约（画布根类 `.artwork-page`、槽位命名、系统槽、运行环境）的唯一权威。生产环境只依赖本文件 + `styles/` + `script/`，不引用任何开发期文档（治理文档与施工台账在仓库外开发目录，生产零依赖）。

**版式由母版定死，内容由 AI 申报，出图由脚本完成**：AI 读素材 → 选风格 → 依该风格 catalog.md 选母版 → 写 plan.json → render 实例化出 HTML+PNG → 人审 → 交付 →（可选）编辑器微调。母版覆盖不了时允许**受控即兴**（只用该风格 style.css 的既有类），同一形态用顺两次建议转正入库。生成期不改版式结构、不自造样式。

## 按需读取

| 要做什么 | 读取什么 | 说明 |
|---|---|---|
| 定风格 | `styles/style-picker.md` | 公用·一份：选型动线 + 风格目录构成的权威定义 + 语义组名 + 每风格一行名片（气质/适合/反例/目录） |
| 选母版 | `styles/<风格>/catalog.md` | 每风格一份：按语义组分节的四栏牌桌（适合/不适合/可以变+字数语义） |
| 填内容 | `styles/<风格>/templates.html` | 选中母版的槽位（文字={{槽名}}=data-layer id；图槽=data-layer id）与 **repeat 注释=条数与字数联动的唯一配置点** |
| 即兴或写新母版 | `styles/<风格>/design-system.md` | 风格规范：气质/tokens/组件表/图槽与标记契约/即兴纪律/反例——即兴只准用该风格 style.css 的既有类 |
| 画图形（多轨/分支/矩阵） | `styles/<风格>/design-system.md` §3.1 + `script/figure.mjs` | 图形页没有 container，字号必须写 px 档、颜色只写 `var()`；写到 `runs/<任务>/figures/<名>.html` → 出 PNG → 当普通图片进图槽 |
| 出图 | `script/render.mjs` | 自动：填槽/克隆 repeat/手机框内嵌/CSS 内联/三层校验/截图/总览图 |

只读当前阶段需要的文件；母版的视觉值全部在 style.css，规则语义全部在 catalog 与 design-system，别处文档不作为验收依据。

## 工作流程（八步 · v2.1）

1. **任务初始化**：在 agent 临时工作区建任务运行区 `runs/<日期-主题>/`（gitignore，非交付物），收集素材（文案 + 图片清单）。技能安装目录运行期只读，临时脚本与过程件都放运行区。
2. **内容提炼**：整理/提炼/升格文案，定页数与每页语义（封面/清单/对比/数据/金句/收尾…）。**纪律：可润色不可编造**——数字与承诺必须有素材出处。
3. **风格选择**：读 `style-picker.md` 推荐 1-2 种并说明理由，用户拍板；用户点名则跳过推荐。
4. **素材盘点与识别**：按图片决策表逐张做资产属性分类（手机截图/窗口截图/干净图/杂乱图），产出素材清单。**此处只分类，不定处理决策**。
5. **逐页选母版**：读 `styles/<风格>/catalog.md`，按语义组+四栏选版式；**同组内先按「素材形态」分叉**——这页有可用截图就选图槽母版，没截图或要讲的是结构（几步、什么关系）就选图形母版（如 N33 内置 SVG 流程，见「截图 vs 图形」）；**形状定不下来（多轨 / 分支汇合 / 矩阵）时改用图槽母版 + 自己画一张图**——按该风格 `design-system.md` §3.1 的规则（画布、安全区、px 字号档、线宽圆角）与 `style.css` 令牌，在 `runs/<任务>/figures/` 现写一份图形 HTML，`node script/figure.mjs <运行区>/figures/<名>.html <运行区>/assets/<名>.png --style=<风格>` 出 PNG，再当普通图片填进图槽。**图形必须先于写 plan 出发**，否则 plan 里的图键指向一个还不存在的文件；输入含 ④ 的素材类型分布（有手机截图的页才考虑手机壳母版）；精确条数与字数从选中母版的 repeat 注释与说明头读取。
6. **图片×槽位匹配**：母版定完后再落地处理决策——手机截图→手机壳槽（框由 render 自动内嵌）/窗口截图→窗口槽（原图自带边框用无边框槽）/干净图→直接用/杂乱图→AI 读图选区写 `crop`；不符→换槽或换母版。**裁切由 CSS 机械完成，AI 不做像素级编辑**。
7. **写 plan.json**：顶层 `meta.brand` 填整组统一的品牌身份件（logo 字/品牌名/页脚署名，一处定义全篇注入）；每页一条 `layout + fields`，fields 键=母版槽位（**文字槽={{槽名}}=data-layer id；图槽=图槽的 data-layer id**，值=相对路径或 `{src, crop}`）——期号 `issue` 逐页填，**页码不填**（自动生成）；条目传数组（render 按 repeat 注释克隆）；字段值允许受控富文本（仅 `span.hl`/`br`/`strong`），文案里的裸 `<` `>`（"年收入 > 10 万"、"A < B"）原样写即可，render 注入前转义显示；即兴页写 `layout: "custom/<语义名>"` 并附整页 markup。
8. **跑 render → 三层校验（硬校验 → 软告警 → 即兴页专项）→ 交付**：`node script/render.mjs <任务运行区>/ --delivery=<YYYY-MM-DD-小标题>`；硬错误（槽位残留/图片缺失/标记重复）即停修 plan 重跑；软告警（字数超限/裁切量大）人决定；脚本先写运行区，校验与截图全过后才按白名单拷进交付目录（`P*.html` + `P*.png` + `preview.png`），人审 PNG 后交付。临时脚本、plan.json、过程件一律留运行区，技能安装目录只读。

## 截图 vs 图形（配图类型判据）

同一语义组里常有"图槽母版"和"图形母版"两种承载。**一个是证据，一个是结构，不能互相顶替**：

| 顺序 | 判断 | 结论 |
|---|---|---|
| ① 素材 | 用户给了能用的截图吗？ | 有 → 图槽母版（截图进图槽） |
| ② 意图 | 这页要"证明真东西长这样"，还是"解释它们之间什么关系"？ | 证明 → 截图；解释 → 图形 |
| ③ 红线 | — | **图形不得伪造界面**：禁止用 SVG/CSS 画假窗口、假对话框、假数据面板去冒充截图 |

**反向判据**（拿不准时用）：把这张图换成一张纯文字表格，信息会不会丢？

- 会丢（必须看到真实界面才成立）→ 截图
- 不会丢（文字本可以说清，图形只是更好读）→ 图形

**图形怎么落地**（两条路，按「交付后还要不要改字」分）：固定 3/4/5 步的整齐结构 → **图形母版**（N33，SVG 画在母版里、节点字是文字槽，可改）；形状定不下来（多轨 / 分支汇合 / 矩阵）→ **自己画一张图**（按该风格 design-system §3.1 现写图形 HTML 存运行区，`script/figure.mjs` 出 PNG，走普通图槽）——代价是文字变像素，交付后只能整张换、不能改字。两条路都**先有风格再画**：图形的颜色/字体全部来自该风格 style.css，`figure.mjs` 不给风格拒绝出图。

**截图不合格时**（杂乱 / 含隐私 / 分辨率低 / 与这页语义无关）：先剪裁（`crop`）与换槽，**不要因为"图不好看"就改画图形顶替**；若截图确实与本页语义无关，本页改走图形或纯文字母版，把截图挪到「展示」类页面单独出现。


## plan.json 格式

```json
{ "style": "tech-blue",
  "delivery": "2026-11-15-ai工具盘点",
  "meta": { "brand": { "logo": "AI", "name": "AI Efficiency Lab", "footer": "aiefficiencylab.cn" } },
  "pages": [
    { "nn": "01", "layout": "N02-dialog-cover",
      "fields": { "issue": "年度盘点", "title": "…", "n02-img-1": "shots/a.png",
                  "btn-1": "看示例", "btn-2": "拿走 Prompt →",
                  "items": [ {"num":"01","t":"…","d":"…"} ] } }
  ] }
```

**系统槽（跨风格机器契约，风格无关）**：`meta.brand` 是整组统一的品牌身份件（`logo` logo 字 / `name` 品牌名 / `footer` 页脚署名），一处定义、全篇注入，**不写进逐页 fields**；`meta` 整块可选，缺哪个键就保留母版默认。`fields.issue` = 逐页期号/栏目名，每页必填。**页码不填**（自动生成）。品牌三值的篇幅受品牌栏/页脚宽度约束，上限见所选风格 `design-system.md` 的组件表，超出须在交付说明里点明并请人确认。**`data-sys` 只登记系统槽**：A 类品牌三件（`meta.brand` 注入）+ B 类期号 `issue`（逐页 fields）+ B′ 类页码 `page-no`（自动生成），白名单固定五个值。其余逐页文案——按钮 `btn-*`、标题、副题——都是**普通文本槽**，与 `title`/`sub` 同一待遇（母版说明头登记键、plan 按名填、缺了即停），走 `{{槽名}}` ↔ `data-layer` 的常规路径，**不标 `data-sys`**。

`fields` 的键分两类：内容槽 = `{{槽名}}` = `data-layer` id（图槽同理）；repeat 数组元素内用**条目短名**（`n/t/d`…），clone 时由 render 加序号后缀。系统槽不套这条——A 类不进 fields、layer 带 `sys-` 前缀；B 类与内容槽同名但 layer 也带 `sys-`；C 类（按钮 `btn-*` 等逐页文案）**就是内容槽**，`data-layer` 用母版前缀（如 `n02-btn-1`），不标 `data-sys`。这是全库统一契约，与风格无关——换风格只换视觉资产，不自定命名规范。值允许受控富文本（`span.hl`/`br`/`strong`），**裸 `<`/`>` 是文案不是标签**：写 "5>3 倍提升"、"A < B"、"x<y 时" 直接出图，render 注入前转义；只有形如 `<b>`、`<div class="…">`、`</span>` 的完整标签才硬停（报错附检出错段）。唯一要注意的是 `a<b>c` 这种字母包夹尖括号——它本身就是合法标签形态，请写成 `a < b`。即兴页 `layout` 写 `custom/<名>`、`markup` 字段附整页 HTML。`delivery` 可选，等价于 `--delivery`，命名 `YYYY-MM-DD-<文章小标题>`。

**画布根类 `.artwork-page`（全库唯一权威机器锚点，本节即定义处）**：与风格无关——render 的 `rootOf()`、`editor.manifest.json` 的 `root`、Chrome 截图 selector 都认它；所有风格的母版与即兴页必须用它，不得自造根类名。命名与根节点 `data-artwork` 属性对齐，指"一张 AI 生成的作品卡片页"，不是某个风格的标记。

## 执行入口

```sh
node script/figure.mjs <任务运行区>/figures/<名>.html <任务运行区>/assets/<名>.png --style=<风格>   # 图形→PNG；注入该风格 :root 令牌，风格必填、用到未声明令牌即报错退出
node script/render.mjs <任务运行区>/ --delivery=<YYYY-MM-DD-小标题>   # 实例化+校验+截图+交付
node script/render.mjs <任务运行区>/ --delivery=<...> --with-editor     # 交付区追加 fields/manifest/assets
node script/render.mjs <任务运行区>/ --check-geometry                    # 即兴页几何体检
node script/render.mjs <任务运行区>/ --only=N01,N02                     # 调试：只出指定页（也接受 02 / P02）
node script/render.mjs <任务运行区>/ --only=N01 --font-report           # 只读诊断：打印该页命中字体 + 三套栈字宽；不写任何产物（P页/PNG/fields/manifest/preview 全不动）；plan 自带的 delivery 也会被忽略
node script/render.mjs <任务运行区>/ --delivery=<...> --force            # 重跑：允许覆盖已有交付目录
```

`--delivery` 也可写成 plan.json 的 `delivery` 字段（相对路径按当前工作目录解析）；未指定时只写运行区、不产出交付目录。`--only` 是**调试开关，仅写运行区**，与 `--delivery` / `plan.delivery` 互斥（防止交付目录残留旧页、preview/manifest/fields 被单页覆盖）——正式交付一律跑完整页数。

## 运行环境

- **Node ≥ 18**（实测 v22）：脚本只用内置模块，零依赖、不需要 `npm install`。
- **Chrome / Chromium / Edge / Brave 任一**：`script/shared/find-chrome.mjs` 先看环境变量 `CHROME_PATH` / `CHROME_BIN`，再探各平台默认安装路径。受限环境（容器 / root / CI / macOS 沙箱）首次启动会失败，脚本自动加 `--no-sandbox` 重试一次；真起不来会同时报两次原因。
- **全程离线**：不联网、不下载字体（本机字体栈）。字形与字宽由运行机器的已装字体决定，换机出图需目检并用 `--font-report` 核对。

编辑器微调（可选）：`cd <pageApp 仓库>/demo && node pack.mjs "<含 manifest 的目录>"`（可指向任务运行区，或带 `--with-editor` 的交付目录）→ `covers-edit.html`。pageApp 仓库本机两处：Windows `D:\AI\pageApp\demo`｜macOS `/Users/shay/Code/AI/pageApp/demo`。**【待开发】** 该命令依赖本机 pageApp 仓库，换环境（生产安装）不可用；待改造为随技能分发的可配置打包入口后移除此标记。**已知差异**：编辑器按自己的「适配方式」（默认填满裁切）重写图片的 `object-fit`，母版里 `data-fit="contain"` 的槽打开后即按 `cover` 渲染——**只在图与槽比例不同时才会看出裁切**（同比例则渲染一致、无差异）。对策：contain 槽只放与槽同比例（1:1）的图；已因塞了非等比图被裁的页，重跑 render 即恢复。交接时要向用户说明。

## 交付（三级目录）

| 层级 | 位置 | 内容 |
|---|---|---|
| ① 技能安装目录 | 本仓库 | 只读资产与代码；运行期零写入 |
| ② 任务运行区 | agent 临时工作区 `runs/<任务>/` | plan.json、素材、过程件、P 页/PNG、preview、fields、manifest、日志、临时脚本 |
| ③ 交付目录 | 用户选中的工作区；无则 agent 默认任务文件夹 | `YYYY-MM-DD-<文章小标题>/`，只含白名单成品 |

白名单 = `P01-封面.html`、`P01.png`、…、`preview.png`（当次总览拼图）。`plan.json`、素材副本、过程件一律留运行区。**校验与截图全部通过后**才拷贝；目标目录已存在且非空即停（同一任务重跑加 `--force`）。交付页 HTML 自包含（CSS 内联、图片 dataURL 内嵌），故 `assets/` 只是素材副本，默认不进交付；日后接编辑器时用 `--with-editor` 追加 `fields.json` / `editor.manifest.json` / `assets/`。

## 受控即兴与转正

- 即兴边界：只用该风格 style.css 既有类 + 遵循其 design-system.md；禁内联样式、禁自造 CSS 变量、禁新类名（新类=风格演进=用户过目）。
- 校验升级：即兴页必过形态校验（根节点 / 禁区属性 / data-layer 唯一）；几何体检需显式加 `--check-geometry`，仅对 custom 页执行。
- 转正：同一 `custom/<名>` 累计 ≥2 次 → 提示用户入库 → 按母版规范重整（标记/占位符/限制注释）→ 目检+一次真实任务回归。转正不是复制粘贴当次产物。
- 同一内容即兴两次不满意 → 走转正，不无限即兴。

## 边界

机器只做防呆（残留/缺失/重复）与字数比对；**画面质量最终由人审 PNG 保证**；数字真实性靠"提炼纪律+人审"，无机器对账；字体默认走本机字体栈（源 CSS 不引外链；编辑器导出 PNG 只认本机已装字体与 base64 内嵌），规则见各风格 design-system.md。这些是执行契约，不是已通过测试的声明。
