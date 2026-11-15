# 施工待办 · 固定母版制

> 按序执行；每项有完成判据；完成勾选。规范依据 = `final/01-母版开发与生产手册.md`；编辑器契约 = `D:\AI\pageApp\HTML产物交接规范.md`（v1.9）。

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
- [x] 蒸馏三份文档：`styles/style-picker.md`（tech-blue 首条）· `styles/catalog.md`（tech-blue 段落 32 条目，四栏格式）· `styles/tech-blue/design-system.md`（气质/组件语义表/即兴纪律/反例）
- **判据达成**：结构检查全过（layer 唯一 / 占位符对应 / data-slot 仅 img）；截图逐张目检通过

## T2 · script/render.mjs（实例化器）✅ 2026-11-15

- [x] 输入 `runs/<任务>/plan.json` → 按 layout 从 templates.html 抽 section（custom 页直用 AI markup）
- [x] 填槽 / repeat 数组克隆（校验 ×min-max 区间）/ crop 区域显示 / `frame-img` 槽自动兜底手机框（解码 styles/assets/iphone-frame.b64）
- [x] 图标 SVG 内联（tech-blue v1 无字形图标，机制留待触发）+ style.css 内联（**剥离 @import 行**——pack.mjs 拒绝外链）+ 图片内嵌 dataURL 并落 assets
- [x] 包独立壳写 `P<nn>-<名>.html` → Chrome（script/shared/）逐页截图 1080×1440 → 生成 preview.png 总览
- [x] 生成 `editor.manifest.json`（root/canvas/layerMode:markers/assetDirs/pages[]）+ `fields.json`（plan 转写，键=data-layer id，repeat 项加序号后缀）
- [x] 校验三层：硬（`{{` 残留/图片缺失格式/根节点画布/data-layer 重复/必填槽空/槽位对不上/repeat 区间）· 软（字数超限比对限制注释/裁切量提示）· 即兴页专项（形态校验 + `--check-geometry` 几何体检）
- **判据达成**：三项防呆（缺槽/未知字段/图片缺失）注入即拦；真实文章 8 页全部出图零 ERROR；pageApp `pack.mjs` 冒烟 0 warnings（T3 编辑器链路提前打通）

## T3 · 实物验收（全流程首跑）✅ 2026-11-15（唯一剩余：用户目检 8 张 PNG）

- [x] 一篇真实文章完整走 SOP：选风格 → plan.json → render → 交付目录（runs/2026-11-15-ai工具盘点/：8 页 P*.html + P*.png + assets/ + preview.png，37 文件）
- [x] 编辑器链路验证：pack.mjs 已产出 covers-edit.html（拖拽/改字/换图/导出可用）
- [x] 记录耗时与问题清单：三项防呆注入即拦（_test-bad1/2/3：缺槽/未知字段/图片缺失均正确报错）
- [x] 8 个 P 页零 `<script>`（自包含，可拖编辑器）；P01-P08 完整、命名规范
- [ ] **唯一剩余：用户目检 8 张 PNG**（人审是质量最终把关）
- [x] 完工清理：script/_migrate/（迁移工具与过程报告）已随收工清理；`script/_ref/` 待 render 实跑确认后删除

### 监工复核留痕（2026-11-15 · 监工只读复核，全项通过）

- **T1a**：决策表 527 选择器五级判定（rename 305/base 55/scope 157/hoist 9/drop 1）抽验 ✅；**32/32 像素零差异** ✅；来源与仓外原件字节一致 ✅；禁区零命中 ✅
- **T1b**：data-layer ×379、32 页**页内唯一** ✅；data-slot="image" ×48 全落 `<img>` ✅；零局部 `<style>`（section 内）✅；48 个 ph-img 槽实测尺寸进 data-ratio ✅；repeat 槽 21 处（data-repeat 属性 + 注释区间）
- **T2**：render.mjs 412 行，能力覆盖手册 §5 全表 ✅；无风格硬编码（STYLE_DIR 从 plan 解析）✅；填充顺序与手册 §3.4 一致 ✅
- **四项轻微项处置**：①计数口径 / ②报告"用户()"排版——随收工清理失效销项（报告已删）；③画廊 chrome 豁免已写入手册 §3.2 ✅；④脚本通用性——迁移脚本已清理、render.mjs 本身无硬编码 ✅（迁移工具重建登记于附表）
- **复核中新发现并已修正**：冗余手机框 PNG 删除（与 b64 字节同一，零引用）· 手册 §3.4 纠错（data-slot 禁用于文字元素，文字槽键=data-layer id）· repeat 语法补 data-repeat 属性与克隆后缀规则
- **遗留待用户**：目检 runs/2026-11-15-ai工具盘点/ 的 8 张 PNG——通过即全项目完工

## T4 · paper-journal 激活（后置，独立节点）

- [ ] `styles/paper-journal/masters/` 41 档合并 → templates.html（data-layout + 说明头 + 画廊头部）
- [ ] catalog.md 补 paper-journal 段落（素材：_archive/references/04-recipes.md 20 卡语义）
- [ ] style-notes.md 升级 design-system.md（补组件语义表/几何预算速查——素材：_archive/config/ 两 json）
- [ ] **判据**：paper-journal/ 目录只剩标准三件套 + assets；masters/ 整目录删除

## T5 · 转正管道首跑（随真实使用触发）

- [ ] 首个 `custom/<名>` 出现并复用 ≥2 次 → 走转正流程（手册 §4.2）验证管道可用

---

## 附：可选项（按需立项，不进主线）

| 项 | 触发条件 |
|---|---|
| 图标机制（`data-i` → SVG 映射文件，render 内联） | 母版设计采用字形图标时 |
| `master-starter.html`（新母版起步模板） | 手写新母版频率上升时 |
| figures 代码画图体系 | 需要程序化配图时 |
| `styles/index.html`（多风格顶层画廊入口） | 正式风格 ≥3 个时 |
| 像素级图片裁剪（真改文件，需图像库） | AI 选区精度不足的实际案例出现时 |
