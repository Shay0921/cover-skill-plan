# 施工待办 · 固定母版制

> 按序执行；每项有完成判据；完成勾选。**接手先读本文（进度 + 待办 + 复核记录）→ `SKILL.md`（生产 SOP 与机器契约）**；规范依据 = `final/01-母版开发与生产手册.md`（权威层级见其首段），编辑器契约 = pageApp《HTML产物交接规范》v1.9（Win `D:\AI\pageApp\HTML产物交接规范.md`｜mac `/Users/shay/Code/AI/pageApp/HTML产物交接规范.md`）。
> **文档治理**：规范文档只留最终方案、不写历史经过（经过进 `.workbuddy/memory` 日志与本文「复核记录」）；跨文件引用写章节名，不写 § 序号。

---

## T1 · tech-blue 迁移（分两节点交付）

### T1a · 合并与目检 ✅ 2026-11-15
- [x] 从研发区 `coverDemo/ai-covers/`（Win `D:\AI\coverDemo\ai-covers\`｜mac `/Users/shay/Code/AI/coverDemo/ai-covers/`）迁移 N01–N32 → `styles/tech-blue/templates.html`（每母版一个 `<section data-layout="N01-…">`，顶部含画廊三合一头部：语义组导航 + 风格看板 + 母版说明头）
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
- [x] **`data-ratio` 的契约归属已核（2026-11-16）**：pageApp v1.9「属性表」实为 **8 条**（`data-artwork`/`data-size`/`data-layer`/`data-label`/`data-type`/`data-editable`/`data-group`/`data-slot`），**没有** `data-ratio` → 确认是本库扩展。final/03「属性表」已改为 8 条契约属性 + 1 条扩展注记，并写明契约是取值域唯一来源（双系统路径）。若日后要把 `data-ratio` 提交进交接规范，另起一项
- [x] **占位图改 PNG（2026-11-16）**：母版 48 个图槽占位原为 1×1 GIF dataURL，而契约「资源」一节只放行 PNG/JPEG/WebP——实测把 GIF 塞进交付页后 `pack.mjs` 直接抛「内嵌图片类型不受支持：image/gif」，整批打包失败。已全部换成 1×1 白色 PNG：画廊整页截图 md5 与改前一致、8 页出图 9 张 PNG 字节一致
- [x] 包独立壳写 `P<nn>-<名>.html` → Chrome（script/shared/）逐页截图 1080×1440 → 生成 preview.png 总览
- [x] 生成 `editor.manifest.json`（root/canvas/layerMode:markers/assetDirs/pages[]）+ `fields.json`（plan 转写，键=data-layer id，repeat 项加序号后缀）
- [x] 校验三层：硬（`{{` 残留/图片缺失格式/根节点画布/data-layer 重复/必填槽空/槽位对不上/repeat 区间/富文本白名单外**完整标签**——裸 `<` `>` 属文案，注入前转义为实体，不拦）· 软（字数超限比对限制注释/裁切量提示）· 即兴页专项（形态校验 + `--check-geometry` 几何体检）
- [x] **图槽标记保留**：填图只替换 `src`（crop 外包一层），`data-slot="image"/data-layer/data-label/data-ratio` 原样保留、父容器补 `data-filled`；比例软校验改在替换前读母版标签。实证：8 页 11 个图槽全部扫成 `type:image` 图层，pack 0 warnings，编辑器「选择本地图片」可用
- [x] **三级目录分离**：`--delivery` / `plan.delivery`（先写运行区 → 校验+截图全过 → 白名单拷贝 → 不覆盖已有目录，`--force` 重跑）+ `--with-editor` 追加编辑器材料；`--only` 同时接受 `02/N02/P02`；技能安装目录运行期只读
- **判据达成**：三项防呆（缺槽/未知字段/图片缺失）注入即拦；真实文章 8 页全部出图零 ERROR；pageApp `pack.mjs` 冒烟 0 warnings（T3 编辑器链路提前打通）

## T3 · 实物验收（全流程首跑）✅ 2026-11-15（唯一剩余：用户目检 8 张 PNG）

- [x] 一篇真实文章完整走 SOP：选风格 → plan.json → render → 任务运行区出 8 页 P*.html/P*.png/过程件 → 白名单拷贝交付目录（P*.html + P*.png + preview.png）
- [x] 编辑器链路验证：pack.mjs 产出 covers-edit.html（拖拽/改字/换图/导出可用）；**换图实证（以 `2026-11-16-咖啡备忘录` 为准）**：8 页 11 个图槽全部扫成 `type:image` 图层（整页 159 图层），pack 0 warnings。**注意**：`runs/2026-11-15-ai工具盘点/` 里的 P 页是图槽改造前的产物（`<img data-slot="image">` 没有 `data-layer`，编辑器扫不到换图层），只可作历史记录、不能再当链路证据，要用须重跑 render。**2026-11-16 在 mac 上用真 pack.mjs 复跑现行页面复验通过**：`Packed 8 page(s) … (7309 KB, manifest, 0 warning(s))`——manifest 的 `root: .artwork-page` 被正确识别，不再是「待在其他机器复验」
- [x] 三项防呆注入即拦：缺槽 / 未知字段 / 图片缺失均正确报错
- [x] 8 个 P 页零 `<script>`（自包含，可拖编辑器）；P01-P08 完整、命名规范
- [ ] **唯一剩余：用户目检 8 张 PNG**（人审是质量最终把关）。P05 结论条已目检：完整、无溢出、未换行（实测可容约 34 字位），限值定为 ≤26、样例 24 字不再告警；逐键校准方法见 T6
- [x] 完工清理：`script/` 只留生产脚本（`render.mjs` + `shared/find-chrome` + `shared/cdp`），无迁移工具、无退役流水线
- [x] **手机框单源**：`styles/assets/iphone-frame.png` 唯一源（render 读取内嵌 + 画廊 `../assets/` 引用），无 b64 中间件

- [ ] **风格预览图（定版后）**：当前开发阶段不产出；风格定版时由用户按统一文案生成 `styles/<风格>/style-preview.png`，口径见 `styles/style-picker.md`「风格目录构成」

### 复核记录（全项通过）

- **T1a**：32/32 与原版逐像素零差异；来源与仓外原件字节一致；禁区零命中。
- **T1b**：`data-layer` 379 个、32 页页内唯一；`data-slot="image"` 48 个全落 `<img>`；section 内零 `<style>`；repeat 槽 21 处（`data-repeat` 属性 + 注释区间）。
- **T2**：render 能力覆盖手册「render 实例化器规格」全表；无风格目录硬编码（STYLE_DIR 由 plan 解析）；填充顺序与 `fillSection` 实现一致（repeat 后往前 → 图槽 → 手机框 → 顶层文字槽 → 残留校验），见 final/03「图槽结构」。
- **画布根类名 = 跨风格固定契约**（`rootOf` / custom 根校验 / `manifest.root` / 截图 selector 四处都认它），权威定义在 SKILL.md「plan.json 格式」；paper-journal 41 档仍是 `p-page`，T4 激活前必须统一。
- **中文交付路径**：`--delivery` 传中文路径实测跑通，8 页 17 文件正常落盘、无乱码；乱码只会来自 shell 传参编码，不是 render 缺陷。

### 治理教训与误报清单（接手勿重复排查）

- **文档陈述可能领先于代码/资产**：历史上出现过"文档说已实现、代码未落地"（图槽双轨、repeat 命名、图标 SVG）。以实证为准——跑一次 + grep 复核，不照抄文档结论。
- **两套验收清单不是重复，不要再合并**：母版级 = final/03「验收清单」（一张母版能不能入库，写母版时一次性过）；生产级 = final/01「生产验收」（这次生产跑对没有，每次都过）。合成一张必然出现"母版早就验过、这次还得打勾"的假条目。
- `wordWarnings` 的 `headerComments[layout.split('-')[0]]` 取 `N01` 是正常的：说明头格式 `N01 · 标题` 正好匹配；P05 verdict 的 24>22 也确实触发过告警。
- 说明头解析正则每个 layout 只匹配 1 次，无覆盖问题。
- **`data-slot="image"` 在 templates 里出现 49 次 ≠ 49 个图槽**：实测拆解 = 48 个真实 `<img data-slot="image">` + 1 处画廊看板的 HTML 转义说明文字（`&lt;img data-slot="image"&gt;`，templates 行 128），CSS 注释内为 0 个。写计数脚本要排除 HTML 转义文本（`&lt;`/`&gt;`），而不是剥 `/* */`——后者不影响这个计数。
- **交付页里同样不能裸数 `data-slot="image"`**：交付页把 style.css 整段内联进 `<style>`，而 style.css 头部注释与「图槽」小节注释都写着 `data-slot="image"` 字样。P01 实测 5 次出现 = 2 个真图槽 + 3 处注释。要数图槽一律匹配 `<img[^>]*data-slot="image"[^>]*>`。
- **标签数 ≠ 可换图层数，差值本身就是体检项**：`<img data-slot="image">` 若没有 `data-layer`，编辑器 `scanMarkers` 直接跳过（不是报错）。实测 `runs/2026-11-15-ai工具盘点/` 24 个标签只扫出 8 个 image 图层——那批页面是图槽改造前的产物。判「图槽能不能换图」用 `scanMarkers` 数 `type:image`，别数标签。
- `--only` 与 `--delivery` 互斥是预期护栏（防单页产物混进交付包），不是 bug；**例外**：`--only` + `--font-report` = 只读诊断，会忽略 `--delivery` / `plan.delivery`（既不报错也不拷贝），不算违反这条护栏。单独 `--only` 仍受此护栏约束。
- 富文本属性注入（`<span class="hl" onclick=…>`）会被 `checkRich` 拦下；文案里的裸 `<` `>` 不是标签、注入前转义显示（`a<b>c` 例外，写成 `a < b`）。
- **回归比对要看像素，不能只看 md5**：Chrome 的 PNG 编码在「像素完全相同」时也可能给出不同的 deflate 字节流（实测 preview.png 同机同代码重跑，字节差 13 字节、逐像素差 0）。判「无视觉回归」用 `PIL.ImageChops.difference(...).getbbox() is None`；md5 只适合比对**同一进程内**连续产出的文件，跨会话会把编码差异误报成回归。
- **契约文件的路径是双系统的**：同一份 pageApp《HTML产物交接规范》在 Win 是 `D:\AI\pageApp\…`、在 mac 是 `/Users/shay/Code/AI/pageApp/…`。文档里凡写路径都要给两侧，否则换系统开工时第一步就卡住（本库 6 处已统一）。
- **编辑器不校验未知属性**：给图槽多写 `data-ratio`/`data-fit`/`data-filled` 既不会报错也不会被误判成图层（`scanMarkers` 实测），导出 HTML 走 `clone.innerHTML`、只删自己写的 `data-ed-*`，所以扩展属性能原样往返——「本库多加属性会不会破坏编辑器」这个问题不必再查。
- **说明头里中文键与括号值静默失效**：`标题≤10字` 这种中文键、`(2行)` `(2行,每行≤7字)` 这种括号值，render 一律不解析、也不告警（正则只认 ASCII 键）。写说明头照 N10 的实况格式抄，别自创中文键。

## T4 · paper-journal 激活（后置，独立节点）

- [ ] `styles/paper-journal/masters/` 41 档合并 → templates.html（data-layout + 说明头 + 画廊头部）
- [ ] 新建 `styles/paper-journal/catalog.md`（素材：工作区根 `cover-skill-audit/_archive/references/04-recipes.md` 20 卡语义）
- [ ] style-notes.md 升级 design-system.md（补组件语义表/几何预算速查——素材：工作区根 `cover-skill-audit/_archive/config/` 两 json）。当前 style-notes.md 只写风格判断（气质/字体角色/杂志语言），已清死链；激活时并入并删除本文件
- [ ] **合并时统一图槽形态**：41 档 47 个 `<img>` 仍是 `src="{{图}}"` 占位、`data-ratio`/`data-fit` 各 0 处、另带 483 处 `data-from`；按 final/03「图槽结构」改成 1×1 占位 PNG + 占位标签 + `data-fit`/`data-ratio`，`data-from` 去留（编辑器契约无此属性）激活时一并定
- [ ] **合并时统一根类名**：`masters/` 41 档当前画布根是 `p-page`，而 render 固定认 `.artwork-page`（T4 激活前须逐档改名，否则直接报「画布根缺失」；影响面 = 41 个母档 + paper-journal/style.css 12 处选择器，机械替换后 grep 清零验证）
- [ ] **style.css 激活前收尾**（种子 HTML 已还原为纯 CSS，剩两处）：① 文件内 `html,body{margin:0;padding:0;background:#171512}` 是种子页的窗口底色，内联进交付页会把页面底设成深墨——合并时收窄为 `body{margin:0}`；② `.grain/.wash` 用 `z-index:-1` 挂在根节点内，根节点 `isolation:isolate` 已定，合并后逐档截图确认底纹仍可见
- [ ] **判据**：paper-journal/ 目录只剩四个必交文件 + 可选 assets；masters/ 整目录删除；`style-preview.png` 定版后另补

## T5 · 转正管道首跑（随真实使用触发）

- [ ] 首个 `custom/<名>` 出现并复用 ≥2 次 → 走转正流程（手册「受控即兴（三级阶梯）与转正」）验证管道可用


## T6 · 字数限制校准（进行中 · 逐母版实测）

口径见 final/01「就地限制」节（`≤N字` = 视觉宽度、`≤N字符` = 字符个数、两者不同义；权重全表在手册，此处不复述）。

- [x] render 计数改为宽度口径（`字`）：英文不再按 1 字母 = 1 字砍容量（`VSCode` 3.5 字位、10 字母单词 5.0 字位）
- [x] `字符` 写法不再漏检（原先正则只认 `字`，5 类 ASCII 槽限制全部静默失效）——按字符个数校验，保持 ASCII 槽原有校准
- [x] 限制键匹配支持四种写法：同名 / 族名（`th`→th1..th4、`q`→q1、`tab`→tab1..tab3）/ 区间（`c1..c3`）/ 通配（`sm*-label`、`b*-tag`，`*` 只吞序号以免 `c*` 误伤 `cta`）——12 组用例通过
- [x] `键≤A行每行≤M字|字符` 写法（N05 的 `code≤2行每行≤30字符`）：行数 + 单行各自校验；原先整条匹配不上、静默失效。4 组用例通过（合规/超行数/超单行宽/带标签）
- [x] N21 verdict 限值 18 → 26（实测：28 字宽松、34 字几乎贴边，取 26 留余量）。样例 24 字文案不再告警（宽度 18.7）
- [x] **字体体检与字宽实测内建**（`--font-report`）：打印每页实际命中 face、`@font-face` 声明/加载数、三套栈实测字宽；默认关闭不进热路径。实测后字宽模型上调为大写 0.68 / 小写 0.55 / 数字 0.58（原 0.67/0.5/0.57 比苹方实测偏窄 1%–9%），逐项 ≥ 实测上限
- [ ] **先定字体契约**（本机字体栈 / 随包 webfont）——契约未定不做逐键校准：换一次字体，所有实测限值作废。顺序见 final/01「就地限制」重测三步
- [x] **`--font-report` 实测范围与文档声明对齐**（2026-11-16 选方案 ②：文档对齐脚本）：final/01「就地限制」表原来称建模值 ≥ 全部字重上限（宋 700/900、苹方 400/600，0.674/0.547/0.576/0.332），但脚本只实测 serif 700 / sans 400 / mono 600 三档（0.661/0.452/0.469/0.255 与 0.664/0.534/0.575/0.324），900/600 上限复现不出来。现文档与 `render.mjs` 注释都改成三档口径并注明来源，旧表述完整留作 HTML 注释存档；建模值 0.68/0.55/0.58/0.45 仍 ≥ 三档全部实测，安全结论不变。方案 ①（脚本补测宋 900 / 苹方 600）不采用——没必要为不可复现的上限扩脚本；若将来启用 webfont 补了粗体分片，再连字体契约一起重测（见 T6 字体契约项）
- [ ] **32 母版逐键校准**：用真实最长文案试渲染，量每个容器实际能放多少字位，把说明头「限制」行逐条改成实测值（当前多数是估的）。限值绑定**本机字面**（serif→Songti SC / sans→PingFang SC / mono→Menlo，见 final/01「字体策略」实测表），换机出图需复核
- [ ] **`字符` 槽要不要也改宽度**：tag / cat / note / status-* 等 12 个键常放中英混排，当前按字符数校验会误告警；改宽度则 big-num / shot-name 等 ASCII 槽会松动。需目检后统一（二选一，别混着用）
- [ ] **括号内每行限制**（`(2行,每行≤7字)`）仍只人审——要么补机器校验，要么在说明头标注「人审项」
- [ ] **限值键覆盖率自检**：跑任务时若某条限制键匹配不到任何字段（说明头改了槽位名但没改限制），目前静默跳过，考虑加一条 INFO 提示
- [x] **统一 catalog 与 design-system 的「数字口径」（2026-11-16）**：原 catalog 头部允许语义数字、design-system「反例」与 final/03「repeat 规则」却写「catalog 不写数字」，字面打架。已统一为：catalog 可写**选型语义值**（「3-8 条量级」「标题两行内」），**机器配置值**（`repeat ×min-max`、每槽 `≤N字` 精确限值）只在母版注释——catalog 头部 / design-system「反例」/ final/03「repeat 规则」三处措辞对齐

---

## T7 · 编辑器契约同步（触发式，非常驻）

**现状锚点**：编辑器实装 = `pageApp/demo`（2026-11-01 开发版）；契约 v1.9（2026-11-04，只校准表述、未改代码）。母版侧靠 manifest 接入（`root: .artwork-page` + `layerMode: markers`），**母版增加不需要动编辑器**——实测 8 页 11 个图槽全部扫成 `type:image` 图层（整页 159 图层）、`pack.mjs` 0 warning；编辑器扫描不校验未知属性、导出走 `clone.innerHTML` 只删 `data-ed-*`，所以扩展属性只增不改是安全的。

- [ ] **`data-fit` 契约化提案**（可选，非缺陷）：编辑器把适配方式存成自己的图层状态（默认 `cover`），打开页面即给每个 `<img>` 写内联 `object-fit`，覆盖母版的 `data-fit="contain"`（真编辑器实测：裸读 contain → 打开后 computed 变 cover）。**但当前不构成缺陷**：全库唯一 contain 槽是 N29 二维码（86×86，1:1），放 1:1 二维码时 cover 与 contain 渲染完全一致、零损失；两批交付页均未用过该槽。只有塞非等比图才被裁（实测 4:3 进 1:1 槽横向损失 25%）。提案 = pageApp 读容器 `data-fit` 作为「适配方式」初始值（v1.10 候选，优先级低）。在此之前守一条规则：**contain 槽只放与槽同比例（1:1）的图**
- [ ] **契约升版复核**（每次 pageApp 出 v1.x 都跑一遍，约 1 分钟）：① 读契约「契约对照表」，看有没有属性从「未读」→「已读」；② `grep -n "data-" pageApp/demo/lib/markers.mjs` 对照实装读了几条（当前 6 条）；③ `node pack.mjs <运行区>` 要 0 warning。任一条有变化就同步改 final/03「属性表」与「扩展属性与契约的同步关系」两节
- **不提案的**：`data-ratio`（render 自用的比例软校验，编辑器没有消费场景，除非将来做「按槽位预裁」）；`data-filled` / `data-repeat`（render 自己的产物标记，永不进契约）
- **会逼 pageApp 改代码的只有三处**：根类名、manifest 字段、属性取值域（`text/group/image`、`data-group` 无值、`data-slot="image"`）。改这三处前先在本文件记一条，别只改母版

---

## 附：可选项（按需立项，不进主线）

| 项 | 触发条件 |
|---|---|
| 编辑器打包入口可配置化（SKILL.md「编辑器微调」现写死本机 pageApp 绝对路径，生产安装不可用；已标【待开发】） | 技能需要分发/换机运行，或编辑器链路转正时 |
| 图标机制（`data-i` → SVG 映射文件，render 内联） | 母版设计采用字形图标时 |
| `master-starter.html`（新母版起步模板） | 手写新母版频率上升时 |
| 接入 `assets/fonts/` 分片（webfont 自包含） | 需要「跨机字形一致」时。三笔成本：补 700/900 字重分片 → 105 片 base64 内嵌（单页 HTML 到 MB 级）→ **字宽变化使 T6 全部限值作废、必须重校**。所以放在 T6 收尾之后 |
| 编辑器读 `fields.json` 做初稿注入（pageApp 侧，本仓库只产出该文件） | 编辑器要从 plan 初稿起步而不是打开就是成品时。当前无影响：render 已把真实内容烤进每页 HTML |
| figures 代码画图体系 | 需要程序化配图时 |
| `styles/index.html`（多风格顶层画廊入口） | 正式风格 ≥3 个时 |
| 像素级图片裁剪（真改文件，需图像库） | AI 选区精度不足的实际案例出现时 |
