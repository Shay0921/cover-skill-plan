# 施工待办 · 固定母版制

> 按序执行；每项有完成判据；完成勾选。规范依据 = `final/01-母版开发与生产手册.md`；编辑器契约 = `D:\AI\pageApp\HTML产物交接规范.md`（v1.9）；**接手先读 `HANDOVER.md`（现状/下一步/待拍板）**。

---

## T1 · tech-blue 迁移（分两节点交付）

### T1a · 合并与目检 ✅ 2026-11-15
- [x] 从 `D:\AI\coverDemo\ai-covers\` 迁移 N01–N32 → `styles/tech-blue/templates.html`（每母版一个 `<section data-layout="N01-…">`，顶部含画廊三合一头部：语义组导航 + 风格看板 + 母版说明头）
- [x] `styles/tech-blue/style.css` = tokens.css 升级为双段制（共享词汇段 + 母版专属段，专属类前缀 `n01-` 等；删除全部母版局部 `<style>`）
- [x] 词汇上收：逐母版整理局部 style——相同类上收共享段、真专属前缀化进专属段
- **判据达成**：32 张与原版逐像素全一致（坏点=0）；style.css 零重复定义；画廊体检全过（32 section / 32 说明卡 / 10 锚点 / 零破图）

### T1b · 标记与蒸馏 ✅ 2026-11-15
- [x] 32 母版打标记：`data-layer`（唯一 kebab-case）/`data-label`/`data-editable="text"`（文字叶子）/`data-group`（容器）/`data-slot="image"`（仅 img；48 个 ph-img 槽已加实图层 `<img class="ph-img__img">`）
- [x] repeat 槽补注释（唯一配置点）：`<!-- repeat ×min-max: 克隆规则；条数-字数联动 -->`；各 section 补就地限制注释（字数/hl/图槽比例）；母版内联样式全部收编为类
- [x] 蒸馏三份文档：`styles/style-picker.md`（选型动线+目录约定+语义组名+tech-blue 名片）· `styles/tech-blue/catalog.md`（32 条目四栏牌桌）· `styles/tech-blue/design-system.md`（风格规范）。**2026-11-15 拍板：catalog 随风格走，公共总目录裁撤**（SKILL.md/手册/TODO 已同步改引）
- **判据达成**：结构检查全过（layer 唯一 / 占位符对应 / data-slot 仅 img）；截图逐张目检通过

## T2 · script/render.mjs（实例化器）✅ 2026-11-15

- [x] 输入 `runs/<任务>/plan.json` → 按 layout 从 templates.html 抽 section（custom 页直用 AI markup）
- [x] 填槽 / repeat 数组克隆（校验 ×min-max 区间）/ crop 区域显示 / `frame-img` 槽单源内嵌手机框（读取 styles/assets/iphone-frame.png 现场编码，缺文件即停）
- [x] style.css 内联（默认本机字体栈、源 CSS 无 @import；render 保留防御性剥离，编辑器打包器拒绝外链）+ 图片内嵌 dataURL 并落 assets
- [ ] 图标 SVG 内联：**未实现**（tech-blue v1 无字形图标，render 无此逻辑；需要时按附表「图标机制」立项）
- [x] 包独立壳写 `P<nn>-<名>.html` → Chrome（script/shared/）逐页截图 1080×1440 → 生成 preview.png 总览
- [x] 生成 `editor.manifest.json`（root/canvas/layerMode:markers/assetDirs/pages[]）+ `fields.json`（plan 转写，键=data-layer id，repeat 项加序号后缀）
- [x] 校验三层：硬（`{{` 残留/图片缺失格式/根节点画布/data-layer 重复/必填槽空/槽位对不上/repeat 区间）· 软（字数超限比对限制注释/裁切量提示）· 即兴页专项（形态校验 + `--check-geometry` 几何体检）
- [x] **图槽标记保留**：填图只替换 `src`（crop 外包一层），`data-slot="image"/data-layer/data-label/data-ratio` 原样保留、父容器补 `data-filled`；比例软校验改在替换前读母版标签。实证：8 页 8 个图槽全部扫成 `type:image` 图层，pack 0 warnings，编辑器「选择本地图片」可用
- [x] **三级目录分离**：`--delivery` / `plan.delivery`（先写运行区 → 校验+截图全过 → 白名单拷贝 → 不覆盖已有目录，`--force` 重跑）+ `--with-editor` 追加编辑器材料；`--only` 同时接受 `02/N02/P02`；技能安装目录运行期只读
- **判据达成**：三项防呆（缺槽/未知字段/图片缺失）注入即拦；真实文章 8 页全部出图零 ERROR；pageApp `pack.mjs` 冒烟 0 warnings（T3 编辑器链路提前打通）

## T3 · 实物验收（全流程首跑）✅ 2026-11-15（唯一剩余：用户目检 8 张 PNG）

- [x] 一篇真实文章完整走 SOP：选风格 → plan.json → render → 任务运行区出 8 页 P*.html/P*.png/过程件 → 白名单拷贝交付目录（P*.html + P*.png + preview.png）
- [x] 编辑器链路验证：pack.mjs 产出 covers-edit.html（拖拽/改字/换图/导出可用）；**换图实证**：8 页共 8 个图槽全部扫成 `type:image` 图层，pack 0 warnings
  - 2026-11-16 复核：该目录里留存的编辑器包是根类改名**之前**的产物（352 处 `ai-page`、查不到 `n02-img-1`），已改名 `covers-edit.STALE-ai-page.html`；8 页 P 页已用现行代码重渲，换图实证需在 pageApp 机器重新 `pack.mjs` 复验
- [x] 记录耗时与问题清单：三项防呆注入即拦（_test-bad1/2/3：缺槽/未知字段/图片缺失均正确报错）
- [x] 8 个 P 页零 `<script>`（自包含，可拖编辑器）；P01-P08 完整、命名规范
- [ ] **唯一剩余：用户目检 8 张 PNG**（人审是质量最终把关）。P05 verdict 字数已定：限值 18 → 26（实测 28 字仍单行不溢出，取 26 留余量），样例 24 字文案不再告警
  - 2026-11-16 目检 `runs/2026-11-15-ai工具盘点/P05.png`：结论条完整、无溢出、未换行（黑色条实测可容约 34 字位）；已按用户拍板定 ≤26，校准方法见 T6
- [x] 完工清理：script/_migrate/（迁移工具与过程报告）已随收工清理；`script/_ref/` 待 render 实跑确认后删除
- [x] **并发冲突处置（2026-11-15 晚）**：监工会话将 styles/tech-blue/assets/ 当零引用冗余删除，但 templates.html 有 2 处 `src="assets/iphone-frame.png"`（画廊显示用）→ 已从唯一源 styles/assets/iphone-frame.b64 解码还原 PNG（64255 字节，字节同一）。**口径终版**：手机框单源 = styles/assets/iphone-frame.png（render 读取内嵌 + 画廊 ../assets/ 引用）；b64 已删除

- [ ] **风格预览图（定版后）**：当前开发阶段不产出；风格定版时由用户按统一文案生成 `styles/<风格>/style-preview.png`，口径见 `styles/style-picker.md`「风格目录构成」

### 监工复核留痕（2026-11-15 · 监工只读复核，全项通过）

- **T1a**：决策表 527 选择器五级判定（rename 305/base 55/scope 157/hoist 9/drop 1）抽验 ✅；**32/32 像素零差异** ✅；来源与仓外原件字节一致 ✅；禁区零命中 ✅
- **T1b**：data-layer ×379、32 页**页内唯一** ✅；data-slot="image" ×48 全落 `<img>` ✅；零局部 `<style>`（section 内）✅；48 个 ph-img 槽实测尺寸进 data-ratio ✅；repeat 槽 21 处（data-repeat 属性 + 注释区间）
- **T2**：render.mjs 能力覆盖手册「render 实例化器规格」全表 ✅；无风格目录硬编码（STYLE_DIR 从 plan 解析）✅；填充顺序与手册「槽位与 repeat」一致 ✅（行数不再登记：脚本持续演进，硬写行数必然过期）
  - **复核补记**：画布根类名是固定契约（rootOf / custom 根校验 / manifest.root / 截图 selector 四处），非风格可配项；2026-11-16 由 `.ai-page` 统一更名为 `.artwork-page`（全风格通用，权威定义在 SKILL.md「plan.json 格式」）；paper-journal 41 档仍用 `p-page`，T4 激活前必须统一，否则崩。
- **四项轻微项处置**：①计数口径 / ②报告"用户()"排版——随收工清理失效销项（报告已删）；③画廊 chrome 豁免已写入手册「CSS 纪律」✅；④脚本通用性——迁移脚本已清理、render.mjs 本身无硬编码 ✅（迁移工具重建登记于附表）
- **复核中新发现并已修正**：冗余手机框 PNG 删除（与 b64 字节同一，零引用）· 手册「槽位与 repeat」纠错（data-slot 禁用于文字元素，文字槽键=data-layer id）· repeat 语法补 data-repeat 属性与克隆后缀规则
- **遗留待用户**：目检 runs/2026-11-15-ai工具盘点/ 的 8 张 PNG——通过即全项目完工

## T4 · paper-journal 激活（后置，独立节点）

- [ ] `styles/paper-journal/masters/` 41 档合并 → templates.html（data-layout + 说明头 + 画廊头部）
- [ ] 新建 `styles/paper-journal/catalog.md`（素材：_archive/references/04-recipes.md 20 卡语义）
- [ ] style-notes.md 升级 design-system.md（补组件语义表/几何预算速查——素材：_archive/config/ 两 json）
- [ ] **合并时统一根类名**：`masters/` 41 档当前画布根是 `p-page`，而 render 固定认 `.artwork-page`（T4 激活前须逐档改名，否则直接报「画布根缺失」；影响面 = 41 个母档 + paper-journal/style.css 12 处选择器，机械替换后 grep 清零验证）
- [ ] **判据**：paper-journal/ 目录只剩四个必交文件 + 可选 assets；masters/ 整目录删除；`style-preview.png` 定版后另补

## T5 · 转正管道首跑（随真实使用触发）

- [ ] 首个 `custom/<名>` 出现并复用 ≥2 次 → 走转正流程（手册「受控即兴（三级阶梯）与转正」）验证管道可用


## T6 · 字数限制校准（进行中 · 逐母版实测）

口径已在 final/01 §3.5 定死：1 字 = 1 个字符位（汉字/字母/数字/标点各 1，`VSCode` 算 6；空格与换行不计；标签不计；emoji 计 1）；`≤N字` 与 `≤N字符` 同义；容差 20%。

- [x] render 计数改为字符位口径（原先 `length` 把 emoji 算 2 位）+ `字符` 写法不再漏检（原先正则只认 `字`，5 类 ASCII 槽限制全部静默失效）
- [x] 限制键匹配支持四种写法：同名 / 族名（`th`→th1..th4、`q`→q1、`tab`→tab1..tab3）/ 区间（`c1..c3`）/ 通配（`sm*-label`、`b*-tag`，`*` 只吞序号以免 `c*` 误伤 `cta`）——12 组用例通过
- [x] N21 verdict 限值 18 → 26（实测：28 字宽松、34 字几乎贴边，取 26 留余量）。样例 24 字文案不再告警
- [ ] **32 母版逐键校准**：用真实最长文案试渲染，量每个容器实际能放多少字位，把说明头「限制」行逐条改成实测值（当前多数是估的）
- [ ] **每行限制**（`(2行,每行≤7字)`）目前只人审、不机器校验——要么补机器校验，要么在说明头标注「人审项」
- [ ] **限值键覆盖率自检**：跑任务时若某条限制键匹配不到任何字段（说明头改了槽位名但没改限制），目前静默跳过，考虑加一条 INFO 提示

---

## 附：可选项（按需立项，不进主线）

| 项 | 触发条件 |
|---|---|
| 编辑器打包入口可配置化（SKILL.md「编辑器微调」现写死本机 pageApp 绝对路径，生产安装不可用；已标【待开发】） | 技能需要分发/换机运行，或编辑器链路转正时 |
| 图标机制（`data-i` → SVG 映射文件，render 内联） | 母版设计采用字形图标时 |
| `master-starter.html`（新母版起步模板） | 手写新母版频率上升时 |
| figures 代码画图体系 | 需要程序化配图时 |
| `styles/index.html`（多风格顶层画廊入口） | 正式风格 ≥3 个时 |
| 像素级图片裁剪（真改文件，需图像库） | AI 选区精度不足的实际案例出现时 |
