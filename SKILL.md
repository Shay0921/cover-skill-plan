---
name: cover-skill-plan
description: 把产品说明、文案与真实截图提炼成小红书或公众号信息卡片，输出 1080×1440 PNG 多页长图与自包含 HTML。当用户要做系列配图、功能介绍、干货或数据卡片、种草图文、截图整理成卡片时使用。不用于网站、PPT、演示文稿或单张 AI 生图封面。
agent_created: true
---

# 信息卡片生成（固定母版制）

版式由母版定死，内容由 AI 申报，出图由脚本完成：读素材 → 选风格 → 按 catalog 选母版 → 写 plan.json → render 出 HTML + PNG → 人审 → 交付 →（可选）编辑器微调。母版覆盖不了时用受控即兴，同一形态用顺两次转正入库。生成期不改版式结构、不自造样式。

本文件是生产 SOP 的唯一权威；机器契约（画布根类、槽位命名、系统槽、图槽、repeat、字数校验）见 `references/CONTRACT.md`，实现以 `script/render.mjs` 为准。生产只依赖本文件 + `references/` + `styles/` + `script/`。

## 按需读取

| 要做什么 | 读取什么 | 说明 |
|---|---|---|
| 定风格 | `styles/style-picker.md` | 选型动线 + 风格目录构成定义 + 语义组名 + 每风格一行名片（气质/适合/反例/目录） |
| 选母版 | `styles/<风格>/catalog.md` | 按语义组分节的四栏牌桌（适合/不适合/可以变+字数语义） |
| 填内容 | `styles/<风格>/templates.html` | 选中母版的槽位（文字槽 = `{{槽名}}` = data-layer id；图槽 = data-layer id）与 repeat 注释（条数、字数联动的唯一配置点） |
| 即兴或写新母版 | `styles/<风格>/design-system.md` | 气质/tokens/组件表/自绘图形/即兴纪律/反例 |
| 画图形（多轨/分支/矩阵） | `styles/<风格>/design-system.md` §3 + `script/figure.mjs` | 图形页无 container，字号写 px 档、颜色只写 `var()`；写到 `runs/<任务>/figures/` 出 PNG 后当普通图片进图槽 |
| 查机器契约（槽位/系统槽/图槽/repeat/字数校验） | `references/CONTRACT.md` | 风格无关的机器语义；实现以 `script/render.mjs` 为准 |

只读当前步骤需要的文件。视觉值在 `style.css`，选型语义在 catalog，风格规范在 design-system，机器契约在 references/，别处文档不作为验收依据。

## 工作流程（八步）

1. **任务初始化**：在 agent 临时工作区建 `runs/<日期-主题>/`（gitignore，非交付物），收集文案与图片清单。技能安装目录运行期只读，临时脚本与过程件放运行区。
2. **内容提炼**：整理文案，定页数与每页语义（封面/清单/对比/数据/金句/收尾）。**可润色不可编造**——数字与承诺必须有素材出处。
3. **风格选择**：按 `style-picker.md` 推荐 1-2 种并说明理由，由用户拍板；用户点名则跳过推荐。
4. **素材盘点**：逐张按四类归档（手机截图/窗口截图/干净图/杂乱图），产出素材清单。此处只分类，不定处理决策。
5. **逐页选母版**：读 `catalog.md`，按语义组与四栏选版式，再看素材形态分叉——有截图 → 图槽母版；讲结构 → 图形母版或图槽 + 自画（见「截图 vs 图形」）；都装不下 → 受控即兴（见文末）。条数与字数从母版 repeat 注释与说明头读取。
6. **图片×槽位匹配**：手机截图 → 手机壳槽（框由 render 内嵌）；窗口截图 → 窗口槽（原图自带边框用无边框槽）；干净图 → 直接用；杂乱图 → 读图选区写 `crop`。不符则换槽或换母版。裁切由 CSS 完成，不做像素级编辑。
7. **写 plan.json**：`meta.brand` 填整组统一品牌件；每页一条 `layout + fields`；`issue` 逐页填，页码不填；数组字段按 repeat 注释传条目；值允许受控富文本；即兴页写 `layout: "custom/<语义名>"` 并附整页 `markup`。
8. **出图与交付**：`node script/render.mjs <任务运行区>/ --delivery=<YYYY-MM-DD-小标题>`。报错即修 plan 重跑，软告警由人判断；人审 PNG 后交付。要进编辑器时加 `--with-editor`。

## 截图 vs 图形

同一语义组里「图槽母版」和「图形母版」都有，一个是证据，一个是结构，不能互相顶替：

- **有可用截图 → 图槽母版**；要证明「真东西长这样」→ 截图，要解释「它们之间什么关系」→ 图形。
- **反向判据**：把这张图换成纯文字表格，信息会不会丢？会丢 → 截图；不会丢 → 图形。
- **红线**：图形不得伪造界面——禁止用 SVG/CSS 画假窗口、假对话框、假数据面板冒充截图。

**图形怎么落地**：固定 3/4/5 步的整齐结构 → 图形母版（SVG 在母版里、节点字是文字槽，可改）；形状定不下来（多轨/分支汇合/矩阵）→ 图槽母版 + 自画一张图：按 design-system §3 的画布、安全区、px 字号档、线宽圆角规则，在 `runs/<任务>/figures/` 写图形 HTML，`node script/figure.mjs` 出 PNG 后当普通图片填槽。自画代价是文字变像素、交付后不能改字。**图形必须先于 plan 出发**，且先定风格——颜色与字体全部来自该风格 `style.css`。

**截图不合格时**（杂乱/含隐私/分辨率低/与语义无关）：先 `crop` 与换槽，不因「不好看」改画图形顶替；确实与本页语义无关就换图形或纯文字母版，把截图挪到展示类页面。

## plan.json

```json
{ "style": "tech-blue",
  "delivery": "YYYY-MM-DD-小标题",
  "meta": { "brand": { "logo": "AI", "name": "AI Efficiency Lab", "footer": "aiefficiencylab.cn" } },
  "pages": [
    { "nn": "01", "layout": "N02-dialog-cover",
      "fields": { "issue": "年度盘点", "title": "…", "n02-img-1": "shots/a.png",
                  "btn-1": "看示例", "btn-2": "拿走 Prompt →",
                  "items": [ {"num":"01","t":"…","d":"…"} ] } }
  ] }
```

`pages` 顺序即页序，`nn` 是两位页码；`layout` 取 `catalog.md` 的母版名，一页一个母版、同一母版可跨页复用。

**系统槽**：`meta.brand` 填整组统一品牌件（logo/name/footer），逐页只填 `issue`，页码不填；品牌三值篇幅上限见该风格 design-system 组件表，超限须在交付说明里点明并请人确认。槽位命名、fields 键规则、图槽 `crop` 写法、富文本白名单、限值口径、画布根类 `.artwork-page` 的机器契约统一见 `references/CONTRACT.md`。

## 执行入口

```sh
node script/figure.mjs <任务运行区>/figures/<名>.html <任务运行区>/assets/<名>.png --style=<风格>   # 图形→PNG，风格必填
node script/render.mjs <任务运行区>/ --delivery=<YYYY-MM-DD-小标题>   # 出 HTML + PNG 并交付
node script/render.mjs <任务运行区>/ --delivery=<...> --with-editor     # 追加 fields / manifest / assets
node script/render.mjs <任务运行区>/ --delivery=<...> --force           # 复用已存在的交付目录（只覆盖白名单文件）
node script/render.mjs <任务运行区>/ --check-geometry                  # 即兴页几何体检
node script/render.mjs <任务运行区>/ --only=01,03                      # 调试：只刷新指定页，按 plan 的 nn 编号
```

`--delivery` 也可写成 plan.json 的 `delivery` 字段（相对路径按当前工作目录解析）；未指定时只写运行区。`--only` 只用于调试、不与交付同用；跨页聚合件要刷新就完整渲染一次。

### 编辑器微调（可选）

`--with-editor` 完整渲染一次（生成 `fields.json` / `editor.manifest.json` / `assets/`），再 `cd <pageApp 仓库>/demo && node pack.mjs "<该目录>"`（可指向任务运行区，或带 `--with-editor` 的交付目录）→ `covers-edit.html`。pageApp 仓库：Windows `D:\AI\pageApp\demo`｜macOS `/Users/shay/Code/AI/pageApp/demo`。**【待开发】** 该命令依赖本机 pageApp 仓库，换环境不可用。`data-fit="contain"` 的槽会被编辑器按 `cover` 渲染，这类槽只放同比例图；已被裁的页重跑 render 即恢复。交接时向用户说明这一点。

## 交付（三级目录）

| 层级 | 位置 | 内容 |
|---|---|---|
| ① 技能安装目录 | 本仓库 | 只读资产与代码，运行期零写入 |
| ② 任务运行区 | agent 临时工作区 `runs/<任务>/` | plan.json、素材、过程件、P 页/PNG、preview、日志、临时脚本 |
| ③ 交付目录 | 用户选中的工作区；无则 agent 默认任务文件夹 | `YYYY-MM-DD-<文章小标题>/`，只含白名单成品 |

白名单 = 每页 `P<nn>-<名>.html` + `P<nn>.png`，加 `preview.png`（当次总览拼图）。`plan.json`、素材副本、过程件留运行区。交付页自包含（CSS 内联、图片 dataURL 内嵌），故 `assets/` 与编辑器材料默认不进交付，需要时见「编辑器微调」。

## 受控即兴与转正

- 即兴边界：只用该风格 `style.css` 既有类并遵循其 `design-system.md`；禁内联样式、禁自造 CSS 变量、禁新类名（新类 = 风格演进 = 用户过目）。
- 几何体检：即兴页还要查排版是否越界，需显式加 `--check-geometry`（仅对 custom 页执行）。
- 转正：同一 `custom/<名>` 累计 ≥2 次或两次即兴仍不满意 → 提示用户入库 → 按母版结构重整（槽位标记 / 占位符 / 说明头限制行）→ 目检 + 一次真实任务回归。转正不是复制粘贴当次产物。

## 边界

机器只做防呆（残留 / 缺失 / 重复）与字数比对；画面质量由人审 PNG 保证，数字真实性由提炼纪律与人审保证。

## 运行环境

- **Node ≥ 18**：脚本只用内置模块，零依赖，不需要 `npm install`。
- **Chrome / Chromium / Edge / Brave 任一**：`script/shared/find-chrome.mjs` 先看 `CHROME_PATH` / `CHROME_BIN`，再探各平台默认安装路径。
- **字体零安装、全程离线**：不联网、不随包字体文件、不 `@import`、不引 CDN；字体由 `style.css` 指向系统默认，字数校验自动完成。换机后先目检首张 PNG 再批量出。
