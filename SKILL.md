---
name: cover-skill-plan
description: 用于把产品说明、文案与真实截图整理成小红书或公众号信息卡片，产出 1080×1440 多页长图与 HTML（图片随 assets/ 交付）；当用户要做系列配图、功能介绍、干货或数据卡片、种草图文、截图整理成卡片时使用。不用于网站、PPT、演示文稿或单张 AI 生图封面。
agent_created: true
---

# 信息卡片生成（固定母版制）

母版与样式表只读不改；AI 定内容、选版式、填字，出图交给脚本。

**术语**：全篇「编辑器」专指 pageApp 封面编辑器（`references/EDITOR.md`），非代码编辑器；用户说「打开编辑器 / 面板改字 / 改封面」一律走该文件。

**路径锚点**：下文 `$SKILL_DIR` = 本文件所在目录（技能根），`$RUN` = 本次任务工作区（agent 临时会话目录，只放 `plan.json` / 素材 / 清单 md），`$TMP` = 本次会话的系统临时目录（渲染中间件落点，脚本自建自删）。所有 `node script/...` 命令都在 `$SKILL_DIR` 下执行；命令参数写绝对路径（脚本按当前目录解析），只有 `plan.json` 内的素材路径相对任务工作区。

**临时目录统一**：渲染前先把 `TMP` / `TEMP` / `TMPDIR` 三个环境变量指向**同一个**会话临时目录（如系统临时区下的 `cover-skill-<任务名>`），别让 Chrome / Node / 脚本各写各的。**所有临时物只认这一处**，交付确认后整目录删除。调试脚本、测试渲染、对比产物都落这里，不落 `$RUN`、不落技能安装目录。

每页版式有三条路，按"为什么套不进去"选（判定见工作流程第 5 步）：

- **现成母版**：有匹配、填得满——默认走这条，照槽位填。
- **即兴补空**：母版对，但槽撑不满，又得保留它的私有结构——借它的骨架补空。
- **自由组合**：没匹配或装不下——AI 在当前风格里自己排版，组件可复制现有结构，也可自造。

**全母版快路径**：catalog 里每页都能找到匹配母版、槽位也装得下时，后两条不用走——`COMPOSED-MODE.md`、`components.md`、`style.css`、`design-system.md` 一律不必打开，只读 catalog 与 `templates.html` 说明头即可。确认某页确实装不下，再回来读对应文档。**注意**：快路径成立的前提是"装得下"——过完第 5 步末尾的反例清单才算数，别把结构性留白、跨组雷同当成"装得下"放过。

后两条出 `custom/` 页，共用一套手写页硬检与几何体检（`--check-geometry`）；自由组合另走令牌约束，规则真源是 `references/COMPOSED-MODE.md`。机器契约见 `references/CONTRACT.md`；契约与代码说的不一致时，以 `script/render.mjs` 为准（字号值、槽位条数分别以 `style.css`、`templates.html` 说明头为准）。

## 先读什么

按步骤读，只读当前这步要用的；别处文档不作为验收依据：

- 定主张、承诺、每页主角、钩子 → `references/CONTENT-REFINEMENT.md`（**写 plan 前必做**）；填字段的选词、断行、符号 → `styles/content-rules.md`
- 定风格 → `styles/style-picker.md`；选母版 → `styles/<风格>/catalog.md`；槽位键与条数 → `styles/<风格>/templates.html`（**条数、字数的唯一来源**）
- 看图、选槽、裁图 → `references/IMAGE-WORKFLOW.md`
- 手写页 → `references/IMPROVISATION.md`（补空）、`references/COMPOSED-MODE.md` + `styles/<风格>/components.md`（组合，类名真源仍是 `style.css`）；字号与自绘标定 → `styles/<风格>/design-system.md`
- 画图形 → 跨风格机制 `references/FIGURE-GUIDE.md`，风格专属标定 `styles/<风格>/design-system.md`「自绘图形」节
- 机器契约 → `references/CONTRACT.md`；GUI 改字 → `references/EDITOR.md`（本机 pageApp 依赖，非通用）

## 工作流程

一共八步。只有这三种情况停下来问用户，其余自行决定并在交付说明里交代：

| 什么时候 | 问什么 | 用户没空 / 无人值守时 |
|---|---|---|
| 第 3 步 | 风格推荐 1–2 种，要哪套 | 取推荐第一项，交付说明注明「风格按推荐取」 |
| 第 4 步 | 这页要画面但没图：用户提供 / 自绘 / AI 生图 | 留占位、在交付说明列缺素材，**不默认生图** |
| 第 5 步 | 同一页换两版版式仍不满意 | 停下报告，不试第三版 |

3 页以内的小任务可把第 2 步和第 7 步合成一次做完（边定骨架边写文案），不必走满两个来回。

1. **建任务工作区**：在 agent 临时会话目录建本次工作目录，只放 `plan.json`、素材、清单 md；素材入库按 `IMAGE-WORKFLOW.md`。渲染生成物由脚本写到系统临时目录并自动清理，**安装目录运行期只读、不在工作区手写 HTML/PNG**。
2. **定内容骨架**：按 `CONTENT-REFINEMENT.md` 定主张、承诺、要点、每页主角和钩子——**先不写成品文案**（字数上限要等第 5 步定了母版才拿得到）。定死**页数、页序和每页一句话主张**；素材只决定"这页用什么图"，**不决定有几页**——图多于页选主图、图少于页允许无图页。
3. **定风格**：按 `style-picker.md` 推荐 1-2 种并说理由，用户拍板；点名了就跳过。
4. **识图盘点**：按 `IMAGE-WORKFLOW.md`「先验格式再逐张看图」挑出异常格式并转码，逐张判类型、记主体位置，列素材清单。清单的「语义与去向」只写**候选**（讲什么、大概进哪类槽），具体落哪个槽等第 5 步定了母版再回填。没图而这页要画面时按上方表格问清来源，不默认生成、不画假界面冒充截图。
5. **逐页定版式**：按本页主角在 `catalog.md` 找语义匹配的母版，再分叉：

   ```
   有匹配的母版？
     是 → 槽位填得满 → 现成母版
         撑不满 → 必须保留私有结构（专属类 / 手机展示族 / 专属图形）？
                   是 → 即兴补空（custom/<名>，无 layoutBase）
                   否 → 自由组合
     否 → 自由组合
   装不下（任何分支）→ 回炉 CONTENT-REFINEMENT.md 重提炼，不换版式硬塞
   ```

   **命中同类第一眼匹配后，必须在该类里再横比一轮再定**——catalog 关键条目已写「同类横比」判据（结尾 / 流程 / 术语族），别停在语义匹配的第一行。判据只给方向，最终按本页内容特征选；条数以母版说明头为准（如 N41 固定 4 张，不能填 2/3）。

   整篇节奏按 `CONTRACT.md`「整篇版式节奏」核对。**整篇定完后过一遍反例清单**，命中任一就回炉重选，别用"全母版快路径"替它开绿灯：

   - 某页出现**结构性留白**（网格末位落单、卡片被 flex 拉高而内部空一半）——换条数或换母版；
   - 同一形态**跨页或跨组雷同**（两组结尾都用 N28、两页链路都用 N33）——至少一处换母版且内容形态跟着变；
   - 内容有**专属结构**（真实对话框、多轨流程、步数≠4）而母版只能降级表达——走组合页；
   - 想要的效果 catalog 里**没有任何母版的「适合」覆盖**——走组合页。

   前两条说明"装得下"判错了，后两条说明快路径不成立——这时才回头读 `COMPOSED-MODE.md` / `components.md`。四条都不命中才维持现成母版。

   自由组合按 `COMPOSED-MODE.md` 和 `components.md` 在当前风格里自排，出图过 `--check-geometry` 并逐页目检；有截图走图槽母版，讲结构走图形母版或 `figure.mjs` 出 PNG 落 `figures/`。同一页换两版仍不满意就停下报告。
6. **定裁切**：槽位随版式在第 5 步定了。按 `IMAGE-WORKFLOW.md` 判断哪些图要裁、只给要裁的写 `crop`；比例差得多时按槽的 `data-ratio` 预裁新素材再引用（原图保留、交付只带被引用的预裁件）。裁切语义与预裁判据见 `CONTRACT.md` §2；裁完仍不合适就换图或换母版，不靠调 `crop` 硬凑。
7. **写文案 + plan.json**：写 JSON 前先把「页码 → 一句话主张 → 母版 → 图片/无图」落成对照表（不落盘），核对总页数与第 2 步一致——漏图、错槽、临时加页在这张表上暴露，不用等 render。图与槽比例、素材存在性由 `--preflight` 报，不必手核。母版定了才知道条数和字数，文案也在这一步写：选词/断行/高亮按 `content-rules.md`，条数与字数上限照母版说明头的 repeat 注释和「限制」行。plan 写法见下节，系统槽见下方，其余见 `CONTRACT.md`；手写页不写 `fields`。
8. **出图与自检交付**：先跑 `--preflight` 改完再出图（它替代试渲染），命令与开关见下节。**custom 页必须带 `--check-geometry`，不能省**。硬错修 plan 重跑；**同一处错修两次还不过就停下**，贴报错和那段 plan 问人，别连着试第五次。WARN 由人判断。出图后按「完成后自检」逐页过，最后按「交付说明」四项汇报。

## plan.json

```json
{ "style": "<风格名，如 tech-blue>",
  "delivery": "<用户工作区绝对路径>/YYYY-MM-DD-<小标题>",
  "meta": { "brand": { "logo": "<品牌标记>", "name": "<品牌名>", "footer": "<署名>" } },
  "pages": [
    { "nn": "01", "layout": "<母版 slug>",
      "fields": { "issue": "<期号或栏目>", "kicker": "<眉标>", "title": "<主标题>", "sub": "<副标题>",
                  "<图槽键>": "shots/a.png", "<文字槽键>": "<按说明头字数写>" } }
  ] }
```

**品牌三值必须填本次真实主体**——上面是占位符，不许原样留在 plan 里，更不许抄母版内置默认值（`Feiwan AI Lab` 那组）：照抄等于注入没发生，整篇会显示成母版品牌。纯版式测试时自拟一组明显不同的测试值。

`pages` 顺序即页序，`nn` 是两位页码；`layout` 取母版 slug（catalog 条目标题后反引号里的名字，真源是 `templates.html` 的 `<section data-layout="…">`）。一页一个母版，同一母版可跨页复用，节奏按 `CONTRACT.md`「整篇版式节奏」。键名、系统槽、repeat 与富文本规则见 `CONTRACT.md`；高亮选词和断行位置按 `content-rules.md` 定。

**系统槽**：品牌三值篇幅上限见该风格 design-system 组件表，超了在交付说明里点明并请人确认；其余系统槽语义见 `CONTRACT.md`「键名与系统槽」。

## 命令

```sh
node script/figure.mjs <任务工作区>/figures/<名>.html <任务工作区>/figures/<名>.png --style=<风格>   # 图形/单图→PNG，风格必填
node script/render.mjs <任务工作区>/ --preflight                                  # 静态预检：格式 / 图槽比例 / 覆盖 / 完整性 / 版式节奏；无 plan.json 时只验格式
node script/render.mjs <任务工作区>/ --delivery=<工作区绝对路径>/2026-01-01-小标题  # 出 HTML + PNG + assets 并交付
node script/render.mjs <任务工作区>/ --delivery=<绝对路径> --with-editor  # 追加编辑器材料 fields.json / editor.manifest.json；fields 当前无消费者，见 EDITOR.md
node script/render.mjs <任务工作区>/ --delivery=<绝对路径> --force       # 复用已存在交付目录（只覆盖白名单文件）
node script/render.mjs <任务工作区>/ --check-geometry               # 手写页越界扫描 + 组合页硬检（母版页不查）
node script/render.mjs <任务工作区>/ --only=01,03                   # 调试：只出指定页到系统临时目录
node script/render.mjs <任务工作区>/ --only=01 --font-report         # 只读体检：跑完即删
node script/editor-contract.mjs <交付目录>                          # 只读体检：交付还能不能打包进编辑器（缺 manifest 只告警，不代写）
node script/editor-prep.mjs <交付目录>                              # 事后补件：plan 已丢时给已有交付补 editor.manifest.json，不重出图
```

开关**都要显式传**，没有默认开启的；`--style` 给 figure 必传（图形文件父目录已有 `style.css` 时可省）。**交付目录写绝对路径**：命令都在安装目录下执行，写相对名会落进技能仓库，脚本会拒。`--delivery` 与 plan 的 `delivery` 都给时以命令行为准，都不给则只在系统临时目录出图、不产交付目录。

`--preflight` 与 `--check-geometry` 的查项、阈值、退出码见 `CONTRACT.md`「两层体检」与「整篇版式节奏」。只有两处命令行为需要提前知道：没有 `plan.json` 时 `--preflight` 只验素材格式（识图前批量挑异常格式）；`--only` 刷新 `preview.png` 这类跨页件要完整跑一次。`--font-report` 是换字体/换机器时的诊断。

## 交付

四级目录（两张用户可见，两张不进用户视野）：

| 层级 | 位置 | 内容 |
|---|---|---|
| ① 安装目录 | 本仓库 | 只读资产与代码，运行期零写入 |
| ② 任务工作区 | agent 临时会话目录 | 只放 `plan.json`、素材（含 `figures/` 图形件）、清单 md；成品 P 页 HTML / PNG 不放这里 |
| ③ 系统临时产物目录 | 脚本用 `fs.mkdtemp(os.tmpdir())` 自建 | P 页 HTML / PNG、preview、assets 副本、fields / manifest（按需）；交付成功、只读诊断或中途出错退出后自动删除，未交付的正常出图保留并打印路径 |
| ④ 交付目录 | 用户选中的工作区（绝对路径；不给则不产交付目录） | `<YYYY-MM-DD>-<小标题>/`：**页成品 HTML + PNG + `preview.png` + `assets/`**；`--with-editor` 再追加 `fields.json` / `editor.manifest.json` |

`plan.json`、素材、过程件都留任务工作区；渲染中间件由脚本管，**不在交付目录外散落 html/png**。`preview.png` 是整篇总览拼图，供人审第一眼，不是发布页；页 HTML 引用同目录 `assets/`（CSS 内联），交付目录须整体移动/分享。**交付确认后清理两处**：任务工作区（`$RUN`）整体删除——素材多为硬链接，删它不影响源图；会话临时目录（`$TMP`）整目录删除——调试脚本与测试渲染都在这里，别留成散落的 `_tmp/`。删前确认交付目录已自带 `assets/` 和编辑器产物。

**编辑器材料按需产出**：默认交付只给上表那四样，不预埋 `fields.json` / `editor.manifest.json`；用户提出 GUI 改字时才走 `references/EDITOR.md`。按现场二选一：

- `plan.json` 与素材还在 → `render … --with-editor --force`（顺带补 `fields.json`）；
- 任务工作区已清 → `node script/editor-prep.mjs <交付目录>`（只补 `editor.manifest.json`）。

两条之后均接 `node <pageApp>/demo/pack.mjs "<交付目录>"` 产出 `covers-edit.html`。入口选择、文件差异与改字边界以 `EDITOR.md` 为准。

**交付说明**：交付时固定汇报四项，缺一项说明原因——

1. **版式清单**：每页用了哪个母版 slug，哪几页是手写页（补空 / 组合），为什么走那条路。
2. **WARN 清单**：`render` 打出的软告警原样列出，逐条标明「已处理 / 接受风险 / 待确认」及理由。
3. **缺素材清单**：哪页的图槽还空着、需要什么图（尺寸与内容），以及暂用占位的影响。
4. **转正提案**：有值得收进母版的形态就在这里提（见下节），没有就写「无」。

## 手写页与转正

手写页 = 即兴补空 + 自由组合，按工作流程第 5 步分叉：

| | 即兴补空 | 自由组合 |
|---|---|---|
| `layout` | `custom/<名>`（无 `layoutBase`） | `custom/composed-<语义名>` + `layoutBase` |
| 组件 | 借该母版整页骨架，只用 `style.css` 既有类；**没有样式通道**（内联 `style=` 与页内 `<style>` 块机器硬拦） | 共享类 + 复制母版结构（改自造类名）+ 完全自造；页内 `<style>` 放行，视觉值走令牌（`COMPOSED-MODE.md` §5） |
| 规则真源 | `references/IMPROVISATION.md`「硬约束」 | `references/COMPOSED-MODE.md` |

两类的机器检查与 `--check-geometry` 查项见 `CONTRACT.md` §4/§5，两类都要显式加该开关。

**转正**：手写页用得顺、值得收进母版时，把提案写进交付说明第 4 项（三种页皆然）。**不要假设自己记得上次用了什么**——技能不做自动计数，靠 AI 凭跨任务判断主动提出，不要求用户先发现。判据与转正四步见 `references/IMPROVISATION.md`「边界与转正」；入库动作由人执行，AI 只出提案。

## 完成后自检

出图后逐页过，任一不过就修 plan 重跑。机器项已由 `--preflight` / `--check-geometry` 收口；人工项：`preview.png` 整篇风格统一、内容事实成立（`CONTENT-REFINEMENT.md` §5）。custom 页机器查不出的目检项与修法在 `COMPOSED-MODE.md` §7「校验与自检」。

## 边界

机器只做防呆和字数比对，不判断内容好坏。画面质量由人审 PNG 保证，数字真实性由素材出处与人审保证。

## 运行环境

- **Node ≥ 18**：只用内置模块，零依赖，不用 `npm install`。
- **本机要有 Chrome / Chromium / Edge / Brave 之一**：非默认位置时用 `CHROME_PATH`（或 `CHROME_BIN`）指定。
