---
name: cover-skill-plan
description: 把产品说明、文案与真实截图提炼成小红书或公众号信息卡片，输出 1080×1440 PNG 多页长图。用户要做系列配图、功能介绍、干货或数据卡片、种草图文、截图整理成卡片时使用。不用于网站、PPT、演示文稿或单张 AI 生图封面。
argument-hint: <原文素材路径或目录>
---

# 信息卡片生成

**内容由 LLM 判断，页面由 LLM 直接写，工具负责安全检查、构建、几何检查与截图。** 计划只记录页面意图和资产取用，不承担排版。

## 按需读取

| 要做什么 | 读取什么 | 权威边界 |
|---|---|---|
| 理解内容、建池、排页 | [内容提炼](references/01-content-refinement.md) | 内容保真与轻量 JSON 字段 |
| 写源文件、检查、交付 | [总限制](references/02-constraints.md) | 技术输出、安全、骨架与标记契约 |
| 选组件、处理图片 | [组件用法](references/03-components.md) | 选择方法与素材流程，不重复组件实例 |
| 判断视觉气质 | [纸质杂志](references/styles/paper-journal.md) | 风格语义 |
| 复制标准组件 | [组件目录](config/components.json) | `components[id] = {name, description, html, shapes?, placement?}`；`html` 是标准实例示例，不是模板插槽语言；`shapes` 登记呈现形态（供配方 `form` 引用），`placement:"catalogue"` 表示只登记、暂无配方放行 |
| 选页面配方 | [配方目录](config/recipes.json) | `recipes[id] = {name, intent, require?, form?, layouts?, regions: {区域名: {allow, max?}}}`；区域用 `allow`/`max` 限定区内可用组件与上限，配方用 `require`（组件下限：条目为组件 ID 或 ID 组，组内任一即可）与 `form`（形态要求）关联语义，均不锁摆位与条数；`layouts` 登记 2–4 个命名构图骨架，只锁几何（列宽比例、载体宽度档、标题行数、件数、锚点），不锁组件选择与文案 |
| 获取视觉实现 | [风格种子](seed/paper-journal.html) | CSS 视觉值与少量布局原语的唯一执行源 |

只读当前阶段需要的文档和目录条目；文档不另存 HTML/CSS 副本，配方的 `name` 与 `intent` 也只读配方目录。区域是否出现、排列、分组和条目数量由当期内容决定。规则只有上表列出的七项，其余目录不作为规则或验收依据。

> 可选配置：`config/fonts.user.json` 只有 `preferredSystemFont` 一个字段，缺省不影响构建；`seed/fonts/` 是构建输入，无需单独读取。

## 工作流程

1. **读素材**：理解原文，查看要使用的截图，区分事实、推断与待确认信息。是否确认内容、何时确认按用户要求执行；能判断的事直接判断，关键事实缺失才说明或询问。
2. **写内容三件套**：`work/02-pool.json`、`work/03-plan.json`、`work/src/pNN.part.html` 三个产物可以在同一轮写出，**写入顺序不限**——gate 只在运行时要求三件齐备（缺任一直接报错，不降级检查），并对 `data-from ↔ uses ↔ pool` 做三向对账：页面用了计划未列的资产、计划列了页面未用的资产，都会被打回。三个产物的要点：
   - **池**：保留事实证据和来源，适量准备候选表达。没有事实依据就不写成承诺或数据。
   - **计划**：只含 `meta` 和页面的 `nn / recipe / layout / intent / uses`。`recipe` 必须是[配方目录](config/recipes.json)里的 ID，配方 ID 的 `name` 与 `intent` 只读该目录；未知配方、缺 `intent` 或 `uses` 引用池中不存在的资产都会被打回。`layout` 是显式构图决策：配方登记了 `layouts` 时本页必须选一档（如 `A`/`B`/`C`）或明确写 `"free"`（自由构图仍受通用几何规则约束），让目检分辨"刻意自由"与"忘了选档"；配方没有骨架时只能缺省或 `"free"`。列进 `uses` 的资产必须真的被该页 `data-from` 引用。页数与首末页形式由内容和用户目标决定，不凑固定篇幅。
   - **页面**：按目录复制标准组件，替换文案、素材与稳定语义标记，写入 `work/src/pNN.part.html`。使用种子的流式布局原语及必要的当页布局内联 CSS。选了骨架档的页，区域顺序、件数、列宽比例、载体宽度档与标题行数要落在该档区间内（L20 静态查顺序与件数，R14 量几何）；写 `free` 的页不受骨架约束，但仍过通用几何规则。排列变化不需要新增配方；文案实质变化同步更新池和取用关系。`data`/`quotes` 资产的上版文字必须与资产 `text` 逐字一致或取其连续片段，改这类文案先改池；明确标为改写的加 `paraphrase: true`，只降为告警。其余类别允许润色，但文字与资产毫无重叠时会出告警，仍需目检。
3. **检查与看图**：执行下方 gate——`src` 参数必须是 `<run>/work/src`，池与计划按 `work/02-pool.json`、`work/03-plan.json` 就地读取，缺任一文件 gate 直接报错而不是降级检查。gate 一次报全：结构错与几何错同轮收齐，`work/geometry-digest.json` 留下各页区域/载体的实测 cqw 与列宽占比，返修时不用开 PNG 猜尺寸。查看本轮总览，并按需要逐页检查文字、裁切、视觉层次和内容兑现情况。硬错误修复后重查；密度和留白提示由 LLM 判断，不靠虚构内容填满画布。纯结构与文案的返修可先用 `--no-shot` 快查省掉截图，涉及构图与尺寸的改动必须全量重查；多页返修轮可加 `--incremental` 只重测改动页（inputKey 哈希守卫，未变页沿用上一轮实测），但交付前必须跑一次不带 `--incremental` 的全量 gate。返修次数随实际问题决定。
4. **交付**：运行目录 `<run>` 建在交付区之外（临时目录或独立工作目录）；交付时用 `--delivery <目标目录>` 将通过 gate 的 `out/` 里仅三类产物（HTML、PNG、assets/）拷贝到**带版本标识的交付目录**——有用户工作区时放工作区内（如 `期名-日期/` 或用户指定目录），没有时放本次任务的临时交付目录；不覆盖之前交付的目录。`work/`（含 `qa-report.json`、`geometry-digest.json`、`02-pool.json`、`03-plan.json`、`editor.manifest.json` 等中间产物）一律留在运行目录、不进入交付区；说明字体或资源异常及未解决事项。复现时另保存 `work/src/`、内容池、计划及相应种子/目录版本；不要将工作源文件当成可随意删除的缓存。

## 执行入口

以下命令从 skill 目录执行，`<run>` 替换为本次运行目录；路径有空格时保留引号。

```sh
node tools/gate.mjs "<run>/work/src" "<run>/out" --delivery "<交付目录>"
node tools/gate.mjs "<run>/work/src" "<run>/out" --delivery "<交付目录>" --incremental   # 返修轮：只重测改动页，交付前仍须跑一次上面的全量
```

`--delivery` 可选：传了则 gate 成功后自动将 `out/` 中的 `NN.html`、`NN.png`、`assets/` 拷贝到目标目录，**中间产物一律不拷贝**；不传则只写 `out/`，手动挑选交付。

gate 使用一个 Chrome 实例：安全静态解析 → 构建 → 真实几何检查与同页截图，并将 `qa-report.json`、`qa-summary.json`、`geometry-digest.json`、`_sheet.png`、`editor.manifest.json` 写入 `work/`。独立 CLI 与 `--no-shot`、`--shot-only`、`--incremental`、`--plan`、`--pool` 的用途和限制见[总限制](references/02-constraints.md)。失败阻断交付。

这些是执行契约，不是已通过测试的声明；未运行的项目不得写成通过。

## 编辑边界

`editor.manifest.json` 是渲染快照，不是编辑状态，也不是下一次生成的输入；真实编辑器尚未接入。字段含义与约束见[总限制](references/02-constraints.md)的「产物、复现与编辑」。
