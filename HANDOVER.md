# HANDOVER · 交接文档

> 给接手人/下一次会话的最小上下文。规范以 [final/01-母版开发与生产手册.md](final/01-母版开发与生产手册.md) + [final/03-母版创建规范.md](final/03-母版创建规范.md) 为准；进度以 [TODO.md](TODO.md) 为准；本文只写**现状、下一步、待拍板**。

---

## 现状（一句话）

tech-blue 风格已可跑通：32 张母版（templates.html 仓库=画廊）+ style.css 双段制 + catalog.md 选型牌桌 + design-system.md 风格规范 + render.mjs 实例化器。样例任务 8 页零 ERROR、pack 0 warnings、8 个图槽全部可换图；**尚未人审真实素材排版，paper-journal 未激活，T4/T6 未做**。**三级目录已分离**：技能安装目录只读 / 任务运行区（agent 临时工作区）/ 交付目录（用户工作区白名单成品）。当前为开发阶段：所有 preview.png 都是任务级总览产物，只存在于 `runs/` 下；风格级预览图尚未产出（定版后由用户统一生成）。

## 关键文件地图

| 位置 | 是什么 |
|---|---|
| `SKILL.md` | 生产技能说明书（AI 跑任务时按它走八步 SOP；跨风格机器契约的权威定义处） |
| `TODO.md` | 施工台账（T1a/T1b/T2 已勾；T3 剩用户目检；T4 paper-journal、T5 转正管道未启动） |
| `styles/style-picker.md` | 定风格入口（选型动线 + 各风格名片） |
| `styles/tech-blue/` | 风格目录（构成权威清单见 `styles/style-picker.md`）；共享资产另在 `styles/assets/` |
| `styles/assets/` | 跨风格共享：iphone-frame.png（手机框唯一源：render 内嵌 + 画廊 ../assets/ 引用）+ fonts/ |
| `script/render.mjs` + `script/shared/` | **生产环境固定脚本**：实例化器 + Chrome 桥（不是临时文件） |
| `script/_ref/` | 上一代流水线退役脚本（build/pipeline/validate，零引用、不可运行），**施工参考，T3 完工后删除** |
| `runs/` | 任务运行区 = agent 临时工作区（gitignore）；`runs/2026-11-15-ai工具盘点/` = 全链路验证样例（8 页 HTML+PNG+preview+manifest+fields，**2026-11-16 已用现行代码重渲**：根类 `.artwork-page`、`manifest.root`、fields 图槽 src 均已同步）。**不是交付物**。旧编辑器包已更名 `covers-edit.STALE-ai-page.html`（改名前的产物，勿作现行对照，需重新 pack） |
| `<交付目录>/` | 仓外：用户选中的工作区（无则 agent 默认任务文件夹），`YYYY-MM-DD-<小标题>/`，只含白名单成品；由 `--delivery` 或 plan.delivery 指定 |

## 下一步 · T3 实物验收（只差用户动手）

1. **拿一篇真文章走一遍 SOP**（SKILL.md 八步）：定风格 → 盘点识别 → 选母版 → 图片×槽位匹配 → 写 plan.json → render（带 `--delivery=<YYYY-MM-DD-小标题>`）→ 人审 PNG → 交付。可直接拿 `runs/2026-11-15-ai工具盘点/` 当样例对照；过程件留运行区，成品进交付目录。
2. **实测编辑器**：在有 pageApp 的机器上 `node pack.mjs "runs/2026-11-15-ai工具盘点"`（或指向带 `--with-editor` 的交付目录）重新打包出 `covers-edit.html`，再双击试拖拽 / 改字 / 换图 / 导出 PNG（pageApp 契约 v1.9）。换图槽已实证：8 页共 8 个 `type:image` 图层，选中后「选择本地图片」可替换。⚠ 目录里现存的 `covers-edit.STALE-ai-page.html` 是根类改名前的旧包（352 处 `ai-page`、无 `n02-img-1`），只能当历史件看。
3. 两项都过 → **删 `script/_ref/`** → 项目主线完工（T4 paper-journal 激活、T5 转正管道为后续独立节点）。

### 两个提醒（易误判）

1. **P05 横评页 verdict 字数 24 超上限 18**（render 软告警，非错误）——已登记 TODO T3，等用户目检时定：改文案至合规，或确认无溢出后回调说明头与 catalog 的限制值。
2. **N26/N27 的 hero 大数字位置是空的**——刻意设计（中心价格/无数字制式），不是漏填。

## 手机框单源（已落地）

手机框只有一份文件：`styles/assets/iphone-frame.png`。两个消费方、两种吃法——

- **render**（node）：读 PNG 现场编码成 dataURL 内嵌进交付页（N04 等手机壳母版的 `frame-img` 槽单源内嵌）；
- **画廊**（file:// 双击打开的静态 HTML）：浏览器禁止网页读取本地其他文件，只能以 `<img src="../assets/iphone-frame.png">` 直接引用。

**数据流边界（已实证）**：PNG 文件本体**只存在于仓库**（画廊引用），**不进交付目录**——交付页内嵌 dataURL（文件名零出现）；运行区 `assets/` 只是 plan 申报的用户素材副本，默认不进交付（`--with-editor` 才追加）；编辑器模式同理（covers-edit.html 单文件全内嵌）。**交付物（默认白名单）= P\*.html + P\*.png + preview.png**，plan.json 与所有过程件留任务运行区。

新增风格若做手机壳母版，markup 里写 `<img class="… frame-img" src="../assets/iphone-frame.png">` 即可，无需任何脚本改动。

## 编辑器边界（谁做的什么）

- **编辑器本体 = `D:\AI\pageApp\` 项目**（独立开发线，有自己的里程碑；本仓库不开发编辑器）。`covers-edit.html` 由 pageApp 现成的通用打包器 `pageApp/demo/pack.mjs` 产出：读交付目录的 `editor.manifest.json` → 把每页 `data-layer` 标记扫成图层表 → 内联 CSS/图片 → 拼装单文件编辑器。
- **本仓库只产出进场材料**：render.mjs 在**任务运行区**生成 `editor.manifest.json` + `fields.json`（同一份数据两种身份）；默认不进交付区，`--with-editor` 才随交付目录追加。pack.mjs 可直接指向任务运行区（那里有全套材料）。
- **pageApp 侧未做**：T6（编辑器读取 fields.json 作初稿注入）。当前无影响——render 已把真实内容烤进每页 HTML，编辑器打开即见成品。
- `script/_ref/` = 上一代流水线的退役脚本（build/pipeline/validate，纯参考、已不可运行、零引用），T3 完工即删。

## 生产包边界与引用规约（2026-11-16 定）

- **生产环境只含** `SKILL.md` + `styles/`（含 style-picker.md）+ `script/`；`final/`、本文件、TODO 是开发期治理文档，不随生产包分发。
- 生产文件（SKILL.md、styles/**、script/**）不得引用治理文档的路径或 § 序号。跨风格机器契约的权威定义处：根类 `.artwork-page` 与命名两层 → **SKILL.md「plan.json 格式」**；风格目录构成 → **styles/style-picker.md「风格目录构成」**；图槽契约与即兴纪律 → 各风格 design-system.md。
- 跨文件引用一律写章节名，不写 § 序号（防插节断链）；§ 序号仅限单文件内部引用。

## 环境备注

- node 实测 v22.22.2；Chrome 由 `script/shared/find-chrome.mjs` 自动定位（或设 CHROME_PATH）。
- render 用法：`node script/render.mjs <任务运行区>/ [--delivery=<交付目录>] [--with-editor] [--force] [--check-geometry] [--only=N01,N02]`（相对路径按 cwd 解析）；`--only` 是调试开关，与 `--delivery` / `plan.delivery` 互斥。硬校验即停项：缺槽 / 未知字段 / 图片缺失或格式不符 / 图槽 img 缺 data-layer / `{{` 残留 / data-layer 重复 / repeat 区间越界 / 交付目录已存在且非空或不是目录或等于任务运行区 / `--delivery` 空值 / `--only` 空值或与交付互斥 / 手机框资产缺失。
- 编辑器打包：`cd /d/AI/pageApp/demo && node pack.mjs "<含 manifest 的目录>"`（任务运行区或带 `--with-editor` 的交付目录；默认本机字体栈、源 CSS 无外链，render 仍保留剥离 @import 的防御逻辑）。此命令写死本机 pageApp 绝对路径，生产安装不可用——待开发项已登记 TODO 附表，SKILL.md 对应处已标【待开发】。
- 多会话并行施工：动手前先查并发执行方与 TODO 台账，规范文档只留最终方案（不写历史经过）。
