---
name: cover-skill-plan
description: 把产品说明、文案与真实截图提炼成小红书或公众号信息卡片，输出 1080×1440 PNG 多页长图与自包含 HTML。当用户要做系列配图、功能介绍、干货或数据卡片、种草图文、截图整理成卡片时使用。不用于网站、PPT、演示文稿或单张 AI 生图封面。
agent_created: true
---

# 信息卡片生成（固定母版制）

版式由母版定死，内容由 AI 申报，出图由脚本完成。生成期不改版式结构、不自造样式。

本文件是生产 SOP 与 AI 行为约束的唯一权威，生产只依赖本文件 + `references/` + `styles/` + `script/`。机器契约见 `references/CONTRACT.md`，与代码冲突时以 `script/render.mjs` 为准。

## 按需读取

| 要做什么 | 读取什么 | 说明 |
|---|---|---|
| 定风格 | `styles/style-picker.md` | 选型动线、语义组与每风格名片 |
| 选母版 | `styles/<风格>/catalog.md` | 按语义组分节的选型牌桌 |
| 填内容 | `styles/<风格>/templates.html` | 槽位键与 repeat 注释（条数、字数的唯一配置点）；键名按 `{{占位符}}` 与 `<img>` 的 `data-layer` 抄，不按 `data-label` 猜 |
| 提炼内容（主张/钩子/主角） | `references/content-refinement.md` | 写 plan 前的强制决策：主张与承诺、要点与主角、钩子文案、品牌来源 |
| 内容纪律（高亮/断行/emoji） | `styles/content-rules.md` | 跨风格共用：写 plan 时的选词、断行与符号决策 |
| 即兴或写新母版 | `styles/<风格>/design-system.md` | 风格规范与即兴补空纪律 |
| 画图形 | `references/FIGURE-GUIDE.md` + `styles/<风格>/design-system.md` | 跨风格机制在前者，风格专属标定在后者「自绘图形」节 |
| 查机器契约 | `references/CONTRACT.md` | 风格无关的机器语义 |
| 识图/选槽/裁切 | `references/IMAGE-WORKFLOW.md` | 图的来源判断与选槽裁切；`crop` 写法查 CONTRACT.md |
| 借壳补空（留白/空框） | `styles/improvisation.md` | 仅当人审发现留白或空框时读 |

只读当前步骤需要的文件；别处文档不作为验收依据。

## 工作流程

1. **任务初始化**：在 agent 临时工作区建 `runs/<日期-主题>/`（gitignore，非交付物），收集文案与图片清单。技能安装目录运行期只读，临时脚本与过程件放运行区。
2. **内容提炼**：整理文案，定页数与每页语义（封面/清单/对比/数据/金句/收尾）。**先按 `references/content-refinement.md` 完成主张、承诺、要点、每页主角与钩子等决策，再填槽**；填入字段时的高亮/断行/符号纪律见 `styles/content-rules.md`。
3. **风格选择**：按 `style-picker.md` 推荐 1-2 种并说明理由，由用户拍板；用户点名则跳过推荐。
4. **识图盘点**：逐张打开看，按 `references/IMAGE-WORKFLOW.md` 判类型，记下主体位置，产出素材清单。此处只识别，不选槽、不定 crop。用户未给图而某页又需要画面时，先按该文档「判断顺序」三选一问清来源（提供素材/自绘/AI 生图），不默认生成。
5. **逐页选母版**：读 `catalog.md`，按语义组选版式，再看素材形态分叉——有截图 → 图槽母版；讲结构 → 图形母版或自画；版式能套但内容撑不满 → 借壳补空（`styles/improvisation.md`）；都装不下 → 回炉按 `references/content-refinement.md` 提炼文案或换母版。**同一页换母版/借壳 ≥2 次仍不收敛 → 停下向用户报告**，不再自行迭代。图的来源与选型见 `references/IMAGE-WORKFLOW.md`。自绘若走 `figure.mjs`，**须先出 PNG 落运行区，再写 plan 引用该路径**。条数与字数从母版 repeat 注释与说明头读取。
6. **定裁切**：图槽已随母版在第 5 步定下（母版「图槽」行写明形态与张数）。按 `references/IMAGE-WORKFLOW.md` 判断哪些图需要裁，只给需要裁的图写 `crop` 选区；**图与槽比例差很多时，先在运行区按槽的 `data-ratio` 预裁出新素材文件再引用**（原图保留、预裁件只落运行区、不进交付）；裁完仍不合适就换图或换母版。裁切只表达「取哪一段」，不做修图级像素加工。
7. **写 plan.json**：`meta.brand` 填整组统一品牌件；每页一条 `layout + fields`；`issue` 逐页填，页码不填；数组字段按 repeat 注释传条目；值允许受控富文本。即兴页写 `layout: "custom/<语义名>"` 并附整页 `markup`——写法与机器禁区见「即兴补空与转正」，主链路页不涉及。
8. **出图与交付**：`node script/render.mjs <任务运行区>/ --delivery=<YYYY-MM-DD-小标题>`。硬校验报错即修 plan 重跑；软告警由人判断；人审 PNG 后交付——**先看 `preview.png` 整篇风格统一**（截图/生图/自绘混用是否割裂），再逐页细看。要进编辑器时加 `--with-editor`。

## 图片与图形来源

每页图的来源判断、选槽、裁切与各自纪律见 `references/IMAGE-WORKFLOW.md`；`crop` 写法见 `references/CONTRACT.md`「图槽」，自绘机制见 `references/FIGURE-GUIDE.md`。**AI 生图必须先问用户、不默认生成；图形不得伪造界面冒充截图。**

## plan.json

```json
{ "style": "tech-blue",
  "delivery": "YYYY-MM-DD-小标题",
  "meta": { "brand": { "logo": "AI", "name": "Feiwan AI Lab", "footer": "Feiwan · AI Lab" } },
  "pages": [
    { "nn": "01", "layout": "N02-dialog-cover",
      "fields": { "issue": "年度盘点", "kicker": "AI 工具", "title": "…", "sub": "…",
                  "note": "…", "n02-img-1": "shots/a.png",
                  "btn-1": "看示例", "btn-2": "拿走 Prompt →" } }
  ] }
```

`pages` 顺序即页序，`nn` 是两位页码；`layout` 取母版 slug——catalog 条目标题后反引号内的名字（如 `N01-shock-cover`），机器真源是 `templates.html` 的 `<section data-layout="…">`，两处须一致。一页一个母版、同一母版可跨页复用。键名照该母版说明头「槽位」行与模板抄：文字槽键 = `{{占位符}}`，图槽键 = `<img>` 的 `data-layer`；数组字段只在该母版有 repeat 注释时出现。标题/金句的高亮选词与断行位置由 AI 按 `styles/content-rules.md` 决策。

**系统槽**：`meta.brand` 填整组统一品牌件（logo/name/footer），逐页只填 `issue`，页码不填；品牌三值篇幅上限见该风格 design-system 组件表，超限须在交付说明里点明并请人确认。其余机器契约见 `references/CONTRACT.md`。

## 执行入口

```sh
node script/figure.mjs <任务运行区>/figures/<名>.html <任务运行区>/assets/<名>.png --style=<风格>   # 图形→PNG，风格必填；公众号封面等任意尺寸单图也走此命令（--width/--height 自定尺寸）
node script/render.mjs <任务运行区>/ --delivery=<YYYY-MM-DD-小标题>   # 出 HTML + PNG 并交付
node script/render.mjs <任务运行区>/ --delivery=<...> --with-editor     # 追加 fields / manifest / assets
node script/render.mjs <任务运行区>/ --delivery=<...> --force           # 复用已存在的交付目录（只覆盖白名单文件）
node script/render.mjs <任务运行区>/ --check-geometry                  # 即兴页几何体检
node script/render.mjs <任务运行区>/ --only=01,03                      # 调试：只刷新指定页，按 plan 的 nn 编号
```

必须显式传的：`--style=<风格>`（figure，图形文件同级无 `style.css` 时必传）、`--check-geometry`（即兴页几何体检，不传不查）、`--with-editor`（编辑器材料，不传不产）、`--force`（交付目录已存在时）。`--delivery` 也可写成 plan.json 的 `delivery` 字段（相对路径按当前工作目录解析），两者同给时 `--delivery` 优先；未指定时只写运行区。**`--only` 是调试开关，不与交付同用**；要刷新 `preview.png` 等跨页聚合件就完整渲染一次。

### 编辑器微调（可选）

`--with-editor` 完整渲染一次（生成 `fields.json` / `editor.manifest.json` / `assets/`），再 `cd <pageApp 仓库>/demo && node pack.mjs "<该目录>"`（可指向任务运行区，或带 `--with-editor` 的交付目录）→ `covers-edit.html`。pageApp 仓库：Windows `D:\AI\pageApp\demo`｜macOS `/Users/shay/Code/AI/pageApp/demo`。**【待开发】** 该命令依赖本机 pageApp 仓库，换环境不可用。`data-fit="contain"` 的槽会被编辑器按 `cover` 渲染，这类槽只放同比例图；已被裁的页重跑 render 即恢复。交接时向用户说明这一点。

## 交付（三级目录）

| 层级 | 位置 | 内容 |
|---|---|---|
| ① 技能安装目录 | 本仓库 | 只读资产与代码，运行期零写入 |
| ② 任务运行区 | agent 临时工作区 `runs/<任务>/` | plan.json、素材、过程件、P 页/PNG、preview、日志、临时脚本 |
| ③ 交付目录 | 用户选中的工作区；无则 agent 默认任务文件夹 | `YYYY-MM-DD-<文章小标题>/`，只含白名单成品 |

白名单 = 每页 `P<nn>-<名>.html` + `P<nn>-<名>.png`（HTML 与 PNG 同名，只是扩展名不同），加 `preview.png`。`plan.json`、素材副本、过程件留运行区。交付页必须自包含、不依赖外链资源，故 `assets/` 与编辑器材料默认不进交付，需要时见「编辑器微调」。

## 即兴补空与转正

- 触发：人审发现留白或空框（版式没问题、内容量撑不满）→ 读 `styles/improvisation.md`，借母版骨架补空，以 `custom/<语义名>` 出图；内容装不下不在此列——回炉按 `references/content-refinement.md` 提炼文案。
- 边界：只用该风格 `style.css` 既有类并遵循其 `design-system.md`；**禁内联样式、禁自造 CSS 变量、禁新类名**。整页 `markup` 的根节点必须是 `.artwork-page`，且同页 `data-layer` 不得重复。
- 几何体检：即兴页还要查排版是否越界，需显式加 `--check-geometry`。
- 转正：**AI 主动负责识别并提出**——同类 `custom/<名>` 反复出现或两次补空仍不满意时，AI 应主动向用户提出转正建议，不等用户开口（AI 有跨任务记忆，是这件事的责任方）。触发判据与转正四步见 `styles/improvisation.md`「边界与转正」，此处不重复。

## 边界

机器只做防呆与字数比对，不判断内容好坏。画面质量由人审 PNG 保证，数字真实性由素材出处与人审保证。

## 运行环境

- **Node ≥ 18**：只用内置模块，零依赖，不需要 `npm install`。
- **本机可定位到 Chrome / Chromium / Edge / Brave 之一**；装在非默认位置时用 `CHROME_PATH`（或 `CHROME_BIN`）显式指定。
