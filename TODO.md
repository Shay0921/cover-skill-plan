# 施工待办 · 固定母版制

> 按序执行；每项有完成判据；完成勾选。规范依据 = `final/01-母版开发与生产手册.md`；编辑器契约 = `D:\AI\pageApp\HTML产物交接规范.md`（v1.9）。

---

## T1 · tech-blue 迁移（分两节点交付）

### T1a · 合并与目检
- [ ] 从 `D:\AI\coverDemo\ai-covers\` 迁移 N01–N32 → `styles/tech-blue/templates.html`（每母版一个 `<section data-layout="N01-…">`，顶部含画廊三合一头部：语义组导航 + 风格看板 + 母版说明头）
- [ ] `styles/tech-blue/style.css` = tokens.css 升级为双段制（共享词汇段 + 母版专属段，专属类前缀 `n01-` 等；删除全部母版局部 `<style>`）
- [ ] 词汇上收：逐母版整理局部 style——相同类上收共享段、真专属前缀化进专属段
- **判据**：浏览器打开 templates.html，32 版式无变形、无类名串扰（抽验 ≥6 张逐像素比对原版）；style.css 无重复定义

### T1b · 标记与蒸馏
- [ ] 32 母版打标记：`data-layer`（唯一 kebab-case）/`data-label`/`data-editable="text"`（文字叶子）/`data-group`（容器）/`data-slot="image"`（仅 img）
- [ ] repeat 槽补注释（唯一配置点）：`<!-- repeat ×min-max: 克隆规则；条数-字数联动 -->`；各 section 补就地限制注释（字数/hl/图槽比例）
- [ ] 蒸馏三份文档：`styles/style-picker.md`（tech-blue 首条）· `styles/catalog.md`（tech-blue 段落 32 条目，四栏格式）· `styles/tech-blue/design-system.md`（气质/组件语义表/即兴纪律/反例）
- **判据**：手册 §7 自检清单全部通过；catalog 与母版说明头同源一致

## T2 · script/render.mjs（实例化器）

- [ ] 输入 `runs/<任务>/plan.json` → 按 layout 从 templates.html 抽 section（custom 页直用 AI markup）
- [ ] 填槽 / repeat 数组克隆（校验 ×min-max 区间）/ crop 区域显示 / `frame-img` 槽自动兜底手机框（解码 styles/assets/iphone-frame.b64）
- [ ] 图标 SVG 内联（若母版采用字形图标）+ style.css 内联 + 图片内嵌或落 assets
- [ ] 包独立壳写 `P<nn>-<名>.html` → Chrome（script/shared/）逐页截图 1080×1440 → 生成 preview.png 总览
- [ ] 生成 `editor.manifest.json`（root/canvas/layerMode:markers/assetDirs/pages[]）+ `fields.json`（plan 转写）
- [ ] 校验三层：硬（`{{` 残留/图片缺失格式/根节点画布/data-layer 重复/必填槽空/槽位对不上）· 软（字数超限比对限制注释/裁切量提示）· 即兴页专项（形态校验 + `--check-geometry`，裁自 script/_ref/validate.mjs R1/R2/R3）
- **判据**：三项防呆注入即拦；单篇真实文章 6-8 页全部出图零 ERROR

## T3 · 实物验收（全流程首跑）

- [ ] 一篇真实文章完整走 SOP 七步：选风格 → plan.json → render → 人审 PNG → 交付目录
- [ ] 编辑器链路验证：`node pack.mjs "<交付目录>"` → covers-edit.html 拖拽/改字/换图/导出
- [ ] 记录耗时与问题清单（问题只登记，按手册纪律处置）
- **判据**：交付目录 = 标准包；用户目检通过
- [ ] 完工清理：删除 `script/_ref/`（三件参考已裁剪完毕）与 tools 残留引用核对

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
