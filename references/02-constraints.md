# 技术输出、安全与标记契约

内容字段见[内容提炼](01-content-refinement.md)，标准实例只读[组件目录](../config/components.json)，CSS 视觉值及布局原语只读[风格种子](../seed/paper-journal.html)。本文定义源文件、检查和交付的技术边界，不另设排版引擎。

## 源文件与画布

- LLM 直接编写并修改 `work/src/pNN.part.html`。它是应保存的工作源文件，也是裸片段：恰一个 `.p-page` 顶级元素，不带 doctype 与 html/head/body 包装；包含画布骨架、组件 DOM、语义标记及必要的当页布局内联 CSS（载体与写法见「骨架与布局」）。
- 每个源文件有一个 `.p-page[data-artwork][data-size="1080x1440"]` 根；固定画布为 **1080×1440**，根不带 `data-layer`。尺寸、背景与容器设置由种子实现，不依赖浏览器窗口大小。
- `build` 将源文件与种子 CSS 合成为可独立打开的 `out/NN.html`。工作源文件不含完整成品样式时，不以直接打开它的结果评价版式；它仍然可编辑、可用于复现。
- 卡面新增文字使用 DOM 文本，不将正文画进图片、canvas、SVG 文本或伪元素。真实截图保留原貌，不重画其中的 UI。

## 骨架与布局

画布中的自然流顺序：

```text
.p-page[data-artwork][data-size="1080x1440"][data-recipe=PNN]
  .grain / .wash        纹理与氛围装饰层，各页固定，带 data-decoration
  .page-header
    .brand              .seal / .nm / .tg，图层 ID：brand-seal / brand-name / brand-tag
    .issue              图层 ID：issue-line，仅计划声明 issue 的页面出现（资格归登记卡矩阵）
  .heading[data-region="head"]   （使用标题区时）
  main.body
    布局容器与 .region[data-region]
  .footer               footer-signature 与 .pageno（图层 ID：page-number；右下出血页可省）
```

根上的 `data-recipe` 必须等于本页计划 `pages[].recipe` 的配方 ID，不一致就是错误。深浅配色是本页的一个开关：计划写 `dark: true`，画布根就必须带 `.dark`；计划省略该字段，画布根不得带；写 `dark: false` 在计划加载阶段就被拒绝——检查器只认"true 或缺省"两种取值，留 `false` 进来等于允许计划与画布各说一套。两个方向的不匹配都是错误，因为它是同一骨架下的配色变体——只换配色变量和纹理/氛围层的取值，不改结构与标记，也不是配方，更不是另一套风格。`.page-header` 一定放品牌；期号资格唯一归登记卡矩阵（04-recipes 封面档），计划按卡在 `pages[].issue: true` 声明（只认 true 或缺省，写 false 在加载期被拒，与 dark 同纪律），未声明的页面画布上不得有 `.issue`。期号文字取自计划的 `meta.issue`：计划没有给就不写，写了就必须与该字段一致、留在页眉内、最多一个，并带自己的 `data-layer`（骨架示例用 `issue-line`）；缺写、编造、写错、放到骨架外、未声明却出现都按错误处理。标题区使用 `.heading`，`main.body` 占去页眉、标题和页脚后的剩余高度，`.footer` 在自然流中收尾，不以固定坐标压在正文上。

**骨架免检的是"署名身份"，不是整棵子树**：`meta.brand` 禁止空字符串或纯空白（加载期即拒绝，没有品牌就写当期真实署名），`.brand` 的文字必须包含它，L6 双向比对；免 `data-from` 的只有 `.brand` 的三个登记图层 `brand-seal` / `brand-name` / `brand-tag`、页脚的 `footer-signature` 与 `.pageno`（`page-number`、`data-numbering`）、以及 `.page-header .issue`（期号整棵免检是刻意的：期号文案常带宣传话术，静态检查只锁定它与 `meta.issue` 一致、留在页眉内，话术是否得当由目检把关）。写在它们旁边的口号、卖点、网址、"关注公众号"之类仍是内容，缺 `data-from` 按 L8 报错——把这类文字塞进 `.brand` 或 `.footer` 里躲来源检查是检查器明确拒绝的写法。品牌印章支持整体换成 logo 图：`.seal` 内放带 `data-slot="image"` 与自有 `data-layer`（如 `brand-logo`）的 `<img>`，`.seal` 加 `.logo` 类去掉底色与内描边，此时不再有 `brand-seal` 文字层。

- 布局原语：`.flow-row`、`.flow-col`、`.flow-grid`，以及 `.grow`、`.justify-between`、`.justify-center`、`.align-center`、`.stagger`；边缘出血用 `.bleed-left`、`.bleed-right`、`.bleed-x`、`.bleed-bottom`，封面右下那一只整屏用 `.cover-bleed`，画面页区域整体左右贴边用区域上的 `.bleed`（用法约束见[组件选择](03-components.md)）。步骤需要一条贯穿的脊柱时用 `.timeline`，它写在区域自己的类上。具体实现与取值只在种子中维护。
- 正文内可组合、嵌套布局容器，布局容器内放区域，区域内也可用布局容器组织组件。区域名取自本页配方；组件归属其最近的区域，并须在该区 `allow` 内。区域不是固定矩形，也没有每区只能放一个组件的限制。（C2 拆分第五刀收尾：区域级 `max` 字段已随 config 删除，件数上限归登记卡绑定字段。）
- "这页配不配叫这个配方"的组件下限、可互换载体组与形态要求，由配方登记卡绑定字段承载（见 [04-recipes.md](04-recipes.md)），装配自查+人审兜底，整页不可见仍由 R12 兜底。C2 拆分第五刀（2026-11-13）已把 config 的配方级 `require`/`form` 字段与对应加载期 schema 校验整体删除；区域级 `require` 保留禁入绊线（防回归注入，加载即拒绝）。登记卡 R-quote-01 的形态语义以绑定行为准（`quote.hero×1`，骨架 markup 已实体化 hero，目录 `shapes` 提供造法）；`marked`/`split` 为 shapes 目录登记的装配自由档——"卡没绑的即自由"，登记卡是唯一权威。
- 整屏截图一律走 `phone` 载体；并排数量的数字上限按登记卡绑定字段登记，不是全局常数。图注不能塞进 `.phone` 根内：锁高（`style` 里 inline `height` 非 `auto`）的壳自带素材比例，塞进文字叶会挤压、压坏画面。这条由静态检查 **L19** 执行——锁高的 `phone` 根内不得出现任何 `data-editable="text"` 文字叶，不限文字长度一律拦（R3 溢出检查对短文字静默，L19 是唯一守卫）。多机并排时每只包在 `.phone-cell` 内、cell 里配 `text-block` 界面名，是配方登记卡的绑定纪律，装配自查+人审把关（C3 起 gate 不再强制）——少了壳外这一行，读的人分不清哪只是哪个界面。
- 布局容器和区域不是内容组件。组件之间不嵌套；图片的 caption 是该图片组件内部结构，不另套一个组件。
- 区域只回答一件事：`allow`（这区允许哪些组件）。区域可省略，也不设"这一区必须出现"的要求；空的区域宁可不写。
- 允许当页内联 CSS 调整 grid/flex、间距、尺寸、图片裁切和位置；用浏览器自然排版，不在生成期预计算每个条目的坐标。内联 CSS 只指元素的 `style=` 属性：`<style>` 标签、head 内容、html/body 属性都会被静态检查 L0 拒绝。完整骨架可照[风格种子](../seed/paper-journal.html)的 body 抄写（`.p-page` 根、grain/wash、page-header、heading、main.body、footer），再换成本页内容。
- 不用布局覆盖任意重画组件的颜色、字体、边框、阴影等外观；不引入新字体。稳定视觉值沿用种子，必要的实例尺寸与构图调整属于本页布局。这条现在由静态检查 **L17** 执行：本页 `style` 里出现外观属性（`color`、`background*`、`font*`、`letter-spacing`、`line-height`、`text-decoration*`、`text-transform`、`text-shadow`、`text-emphasis*`、`border*`、`outline*`、`box-shadow`、`column-rule*`、`filter`、`backdrop-filter`、`mix-blend-mode`、`mask*`、`accent-color`、`caret-color`、`quotes`、`hyphens`、`fill`、`stroke`、`appearance`、`all`）或改写 `--种子变量`（检查器拦的是**任何**内联自定义属性，含自造变量与大小写变体）都是硬错误；**允许**的是布局、尺寸、间距、定位、裁切与构图：`display`／`flex*`／`grid*`／`gap`／`row-gap`／`column-gap`／`align-*`／`justify-*`／`place-*`／`order`、`width`/`height`/`min-*`/`max-*`/`inline-size`/`block-size`/`aspect-ratio`、`margin*`/`padding*`、`position`/`inset*`/`top`/`left`/`right`/`bottom`/`z-index`/`float`/`clear`、`object-fit`/`object-position`/`overflow*`/`clip-path`、`transform*`/`perspective`、`box-sizing`、`visibility`/`opacity`，以及 `white-space`/`word-break`/`word-wrap`/`overflow-wrap`/`text-overflow`/`text-align`/`vertical-align`/`writing-mode`/`direction`/`cursor` 这些折行、对齐与盒模型控制。两份清单都不在的属性名（拼错的）出 **L18 告警**：它可能整条被浏览器丢掉，检查器不替它猜意图，但也不阻断交付；带厂商前缀的属性（`-webkit-*` 等）是有意的兼容写法，不告警也不拦截。

## 构图骨架（layouts）

契约管语义（这页配不配叫这个配方、文字有没有来源），骨架管几何（这页摆得稳不稳）。两层独立：选了骨架不改变组件选择与文案的自由，写 `free` 也不豁免语义契约。

- **登记在配方**：`recipes[id].layouts` 是命名骨架档（如 `A`/`B`/`C`/`D`，档数按配方），每档 `{name, when, order, tracks, headline, carriers?, anchor?}`。区间数值来自实测几何的校准；加载期只校验 schema 与引用合法性（区域/组件存在、`carriers`/`anchor` 组件被该区 `allow` 接纳、区间在合法范围），不校验页面。`carriers`/`anchor` 只允许几何载体组件（`phone`/`shot`/`step`/`bars`）：锁内容组件的宽度会让骨架变成内容模板，写了就在加载期拒绝；内容组件的取舍仍归区域 `allow` 与本页内容。（`counts` 字段已随 C2 拆分第五刀删除，件数归登记卡绑定字段。）`when` 同守这条边界：只描述几何条件、素材前提与区域角色，不点名内容组件、不复述全局检查规则。
  - `order`：区域自然流顺序，`"区域?"` 表示可缺省；只约束列出的区域，未列出的不参与排序。
  - `tracks`：`[{region, share:[min,max]}]`，`share` 是该区域宽占**正文宽度**的比例（上限 1.2 容纳出血墙）。`tracks` 与 `headline` 必填、不能为空。
  - `headline`：主标题行数整数区间 `[min,max]`（1–8）。
  - `carriers`：`[{component, region, width:[min,max]}]`，载体宽度档。`width` 是**数值区间**（如 `[52,54]`，单位隐含 cqw，不写单位字符串），合法范围 1–108。
  - ~~`counts`~~：已随 C2 拆分第五刀（2026-11-13）从 config 删除——件数区间归登记卡绑定字段；件数缺/超的几何后果由 R14 接住。**config 只锁几何**：内容组件件数由本页内容定，上限归登记卡。
  - `anchor`：`{region, carrier:[ids]}`，锚点区域必须有一个可见载体锚定行高，避免步骤/文字被拉成洞。
- **选档在计划**：`pages[].layout` 写档 ID 或 `"free"`。配方有 `layouts` 时本页必须显式选一档或写 `free`（与 `dark` 同一纪律：让目检分辨"刻意自由"与"忘了选档"）；配方没有骨架时只能缺省或 `free`。写错在计划加载阶段直接拒绝。
- **检查只剩渲染层 R14**（C2/C4 拆分起，静态 L20 已退役——order/tracks 存在性照抄骨架不可能违反，counts 件数归登记卡）：R14 量列宽占比（±0.01）、标题行数、载体宽度档（±0.5cqw）、锚点载体可见。`free` 页不进 R14，仍受其余通用几何规则约束。骨架是区间不是固定坐标：落在区间内即可，不预计算每个条目位置。
- 哪几条配方带骨架、各档名称与 `when` 以[配方目录](../config/recipes.json)为准，本文不登记清单。

## 标记契约

标记由 LLM 在写源文件时填写，目录实例中的演示值须替换为当期值。

| 标记 | 放置与含义 |
|---|---|
| `data-component="phone"` | 组件根，值为目录组件 ID；其他组件同理 |
| `data-layer="evidence-phone"` | 图层稳定语义 ID，页内唯一；不放在画布根 |
| `data-group` | 复合组件或需要整体记录的布局组；组也有自己的 `data-layer` |
| `data-editable="text"` | 最小的完整文本字段，同时标 `data-layer`；含行内高亮时标在承载整句的父元素，不把整张卡当一个文本字段 |
| `data-from="h1"` | 普通内容文本的池内资产 ID，可用空格分隔多个；须存在于池中且被本页 `uses` 引用 |
| `data-slot="image"` | 标在实际 `<img>` 上，并给图片自己的 `data-layer`，不标在手机壳容器上 |
| `data-numbering` | 页码、步骤号等结构序号，文本限 8 字符内的短序号，不是数据证据；超长即错误 |
| `data-decoration` | 纯装饰图形或短字符，文本不超过 8 字符、不得携带 `data-editable` 文字叶；不能用来绕过正文的来源或安全检查。它也不替 `<img>` 豁免几何检查：装饰图仍须归属显式组件根（缺了按 L11），照常参与越界、压字与遮挡判定——标记只说明"这层不是内容"，不说明它可以盖住内容 |
| `data-oneline` | 仅当该文本确实必须单行时声明；实际折行就是错误，不因类名为 `.t` 一律添加 |
| `data-bleed` | 只标在组件根，声明画布边缘的意图出血；不豁免内部区域越界、压字或遮挡。声明的组件必须真的贴到所在区域的对应出血边（**R16**），否则只是借豁免在画布内飘 |
| `data-label` | 可选的中文图层说明，不作为身份标识 |

典型复合组件根同时具有 `data-component="phone" data-layer="evidence-phone" data-group`；普通文本具有 `data-editable="text" data-layer="benefit-title" data-from="h1"`；图片具有 `data-slot="image" data-layer="evidence-screen"`。

**来源不是只查数字**：标题、说明、标签、图注、引文和号召等普通内容都要 `data-from`，包括不含数字的文字。骨架署名、期号和结构编号可免；统计数字、事实结论不能冒充编号。改文案时同时维护池与 `uses`，不把其他资产里的相同数字当作本句证据。`uses` 与 `data-from` 双向对账（L10）：页面引用的资产必须在 `uses` 里，`uses` 列的资产也必须真被本页引用——后补计划时凭记忆列多的 `uses` 同样会被打回。

复制骨架不等于继承来源：骨架预置的 `data-from` ID 与池资产 ID 同一命名空间，池里没有该 ID、或本页 `uses` 未列，L8/L10 照常打回。骨架的 `{{占位符}}` 只用于换文案、素材与柱高，必须全量替换（L24 拦残留），不得借它新增组件、增删图层或改几何。

来源校验分三级，按每个 `data-from` 锚点独立进行；比对前先做 NFKC 归一并去掉空白与标点，`<br>`、高亮 `span` 等由文本节点拼接后视为连续文字：

- **数字与单位（L14，全部类别）**：页面文字里的数字若紧跟单位（元、条、倍、% 等），该单位必须能在所引资产 `text` 或 `evidence` 的同一数字后找到；无单位数字继续比对数字集合。单位表是常用量词的有限枚举，中文数字与未登记单位不触发 L14，仍靠 L8 与目检。
- **数据、引语逐字（L15）**：锚点只挂一个 `data` 或 `quotes` 资产时，渲染文字必须等于资产 `text` 或是它的连续片段，拆字段、图标字与高亮都按连续片段处理。资产带 `paraphrase: true` 表示已明确标注的改写，不符时降为告警。
- **其余只告警（L16）**：`highlights`、`pains`、`hooks`、`thesis` 与多来源锚点，文字与所引资产的 `text`/`evidence` 既无包含关系、也无二字词重叠时出 WARN，不阻断交付。合法润色、合并表达与多来源共用数字沿用原有的并集语义；告警是目检线索，不要求清零。

这套检查只证明"页面没有偏离所登记的资产文字"，不证明资产本身真实、`evidence` 站得住或截图能证明产品能力。数字与单位都照抄、但整句语义是编的，仍可能只落在 L16 告警里；交付前目检必须看内容，不把 passed 当成事实已核。

**身份稳定**：用英文语义 ID 表示对象身份，不从 DOM 序号、当前文案或当前排列自动生成。移动、换序或修改同一对象的文案时保留原 ID；复制组件创建新对象时分配新 ID，包括其内部文字和图片。跨页引用以页码与图层 ID 联合定位。内容资产 ID 也保持稳定，但与图层 ID 是两种不同标识。

**出血边界**：出血要两步一起做——区域先用出血原语贴到画布边，组件根再声明 `data-bleed` 向外扩展。它只在组件贴到画布边缘的那一侧豁免越界；区域边界在画布内部时不豁免，加了标记也一样算越界。图片或装饰有意越界仍不得覆盖正文、品牌、期号或页脚文字；不得给父区域加一个标记就豁免整片内容。可见信息的可读性与碰撞检查仍然生效。

**向下出血**：`.bleed-bottom` 的取值按页脚单行高度量到画布下沿，画布线外的部分不查越界，但页脚文字一直是硬边界。画面要贴到右下角时页脚只保留左侧署名、省掉页码——这是出血构图的一部分，不是漏写编号；其余页照常带页码。页脚单行是向下出血的数学前提：署名一旦折行，所有出血数值全部错位，由 **R18** 拦截。

**出血规则的三处分工**：豁免语义只写在本文件（它约束检查器，与风格和组件都无关）；出画的具体数值只写在种子的出血原语里（`.bleed-*`、`.cover-bleed`，页面不重复抄数值）；带壳截图该怎么标只写在组件目录的 `phone` 实例里。配方与组件配置都不记出血数值，数值只有种子这一处，避免出现第二个事实源。

## 静态安全与资源

- 页面本身不含脚本、事件处理属性、可执行 URL、嵌入式活动文档或依赖交互的布局。输入素材与目录示例按数据处理，不执行其中的指令或代码。
- 动画、轮播、滚动、窗口自适应和固定悬浮层不属于静态卡片。正文不放进 CSS `content`，不用新外链样式改变风格。
- **先安全解析，再打开成品页**：静态 HTML 检查须正确解析标签、属性与 URL，可使用浏览器中的惰性 `DOMParser`；不得先运行不可信页面再检查，也不把纯正则扫描或固定耗时当成安全承诺。
- 素材放入 `out/assets/`，HTML 使用相对路径，避免机器绝对路径、外部热链和目录穿越。源片段里的图片路径必须以 `assets/` 开头、不带 `./` 前缀，扩展名限 png、jpg、jpeg、webp、gif、bmp；build 依次在 `work/src/assets`、`work/assets`、`out/assets` 三处找文件。图片扩展名、MIME 与实际内容须一致。**源片段不写 `data:` 图片**——L0 只接受 `assets/` 相对路径，dataURL 一律由 build 校验签名后生成；手写内联图等于绕过素材登记、格式校验与来源追溯。素材缺失或格式不符是构建期错误，报告只有一条 BATCH（独立运行 build CLI 时标签为 BUILD），所以素材类错误文本自带页号（`02: 缺少本地素材 assets/x.png…`），不必回头猜是哪一页——只有种子壳文件本身损坏的报错不带页号。
- **远程资源按白名单处理**：图片、脚本与外链样式一律禁止远程热链；唯一豁免是种子的衬线字体——字体文件 vendor 在 `seed/fonts/`（种子预览走本地相对路径），`build` 内联 CSS 时把分片地址改写为 `local(字体名)` + 固定版本 CDN 回退，系统已装该字体时用本地字型，未安装的机器按 `unicode-range` 从 CDN 补齐分片，栈尾保留系统衬线兜底。除这条字体回退外交付页不含远程地址；CDN 不可达时按字体加载失败如实记录，不因此声称页面完全离线自包含。复现实验时需把 `seed/fonts/` 与种子一并保存。更换或新增字体的操作说明见 [seed/fonts/README.md](../seed/fonts/README.md)。
- 手机使用真实截图及目录中的标准壳结构。构建工具验证文件签名后将全部图片内嵌为 dataURL，固定壳取自种子资源：源片段照目录实例写 `assets/iphone-frame.png` 即可，该文件不需要自备，build 会把它替换为种子内置壳；源片段仍写相对路径，保留原素材供追溯与替换，不手工伪造 dataURL 内容。
- 等待字体与图片加载后才测量和截图。网络字体失败须如实记录加载或回退情况；单一 Chrome 实例不能保证字体加载成功，也不能保证整批自动统一为某种宋体。回退影响可读性或版式时处理后重查。`@font-face` 按 `unicode-range` 分片，未命中的分片停在 `unloaded` 属正常，此时 `document.fonts.status` 照样是 `loaded` 而文字其实全部走了系统回退；每页报告写 `fonts.loadedFaces`（成功加载的分片数），声明了分片却一个都没成功时出 `WARN FONT`，看到它就该核对 `fonts.actual` 里的真实 face。
- **用户首选字体（可选配置）**：`config/fonts.user.json` 是给使用者的唯一可改配置，不存在时构建原样通过。格式为 `{"preferredSystemFont": "字体名"}`；build 把该字体插到种子 `--serif-stack` 栈首，交付页在本机装有这款字体时优先使用它，缺失时继续走 Noto Serif SC 与系统衬线回退。字体名限普通字符（引号与反斜杠直接构建失败）；注意替换效果只出现在装有该字体的机器上，交付前按实际字体核对版式。
- **字重约束**：webfont（fontsource 引入的 serif 族）只按 400 字重使用——种子里每个 `@font-face` 的描述符只登记了 400，build 内嵌时原样保留；页面需要粗体衬线时必须先在种子引入对应字重的 fontsource CSS，而不是靠浏览器合成假粗体。sans 族的 700/900 走系统字体真实字重，不受此限。

## 执行接口

从 skill 目录执行；`<run>` 是本次运行目录。运行前提：**Node ≥ 20**（工具用 ESM、`Object.hasOwn` 与 `crypto.randomUUID()`）；本机装有 Chrome、Chromium、Edge 或 Brave 之一（检查与截图共用一个实例）；探测不到时用环境变量 `CHROME_PATH` 或 `CHROME_BIN` 指定可执行文件路径。Windows 下探测覆盖 `ProgramFiles`、`ProgramFiles(x86)` 与 `LocalAppData` 三个根目录下的 Chrome、Edge、Brave。

```sh
node tools/gate.mjs "<run>/work/src" "<run>/out"
node tools/gate.mjs "<run>/work/src" "<run>/out" --no-shot
node tools/gate.mjs "<run>/work/src" "<run>/out" --shot-only
node tools/gate.mjs "<run>/work/src" "<run>/out" --incremental
```

计划与内容池按 `<run>/work/03-plan.json`、`<run>/work/02-pool.json` 就地读取——文件名带序号只是默认约定，不存在配套的 `01-*`；文件放在别处时用 `--plan` / `--pool` 指定。两者缺任一个，gate 直接报错，不会退化成只查 HTML。池、计划与源页面的**写入顺序不限**（可同一轮写出），gate 只在运行时要求齐备与账目一致。`src` 参数必须是 `<run>/work/src`，工作目录由它的父级推出。

全量 gate 的职责顺序：安全静态 HTML 解析 → `build` → 在一个 Chrome 实例中完成真实几何检查和同页截图 → 写报告与快照。每页的检查与截图使用同一已加载页面状态；工具探针不等于允许源页面携带脚本。

- 全量输出：`out/NN.html`、`out/NN.png`，以及 `work/qa-report.json`、`work/qa-summary.json`、`work/geometry-digest.json`、`work/_sheet.png`、`work/editor.manifest.json`。`qa-summary.json` 是随每轮报告同步生成的轻量总视图（runId、状态、各页 status 与 ERROR/WARN 计数），用于快速定位问题页；证据与完整坐标仍以 `qa-report.json` 为准。`geometry-digest.json` 是几何数字摘要：每页区域与载体的实测 cqw 尺寸、列宽占比、空白带与错误列表，失败或不截图时也写出，返修轮不用开 PNG 猜尺寸；不截图的轮次（gate `--no-shot` 或独立 `validate`，非 `--json`）还会把它打印到控制台。
- 报告轮转：同一 work 目录重复运行时，上一轮 `qa-report.json` 会先备份为 `work/qa-report.prev.json` 再被本轮覆盖（只保留一份上一轮）。历史证据以 `qa-report.json` 内的 `runId` 为准；更早的轮次不被保留。**并发被拒**：同一 work 目录同一时刻只允许一轮运行，工具以 `work/.qa-lock` 独占——持锁进程还活着时第二轮直接报错而不是排队；持有进程已死的残锁会被下一轮自动接管。loadProject 阶段抛错（池/计划读不到、plan 契约不合法）时，兜底报告同样走统一保存函数，旧报告先被备份，`qa-report.json` 与 `qa-summary.json` 永远是合法 JSON。
- `--no-shot` 保留安全、构建与几何检查，跳过截图。该轮不能作为 PNG 已更新的证据；交付前须对最终源文件运行全量 gate。
- `--shot-only` 只补截图：不重写 `out/NN.html`，但会先确认现有 HTML 与当前源文件一致，静态 lint、字体就绪等待与几何检查照常执行，通过后才截图。它省的是 build，不是检查，也不能替代一次全量 gate。
- **一次报全（lint 与 gate）**：静态检查便宜，早停只会把错误挤牙膏式摊到多轮返修，所以 lint 与 gate 都枚举全部计划页、同轮收齐结构错与几何错。gate 用部分构建：lint 失败的页不构建、错误留在报告里，其余页继续到几何层；几何失败也不短路后续页，只给通过的页截图。`validate`/`shot` 仍是全有或全无（任一页 lint 失败即不构建）。汇总行 `FAILED x/y 页` 的 x 是已枚举页数、y 是计划页数，一次报全下两者相等；失败页清单见 `qa-summary.json`。
- `--incremental` 是返修轮的提速档：每页算一个 `inputKey`（源片段哈希 + 构建产物哈希 + 本页 recipe/layout/uses/dark + 全局 meta + 组件/配方配置哈希），上一轮该页 `passed` 且 `inputKey` 全同、图层快照仍在时，沿用上一轮实测与截图，不重新导航测量；lint 仍每页重跑。带截图的增量轮还要求盘上 PNG 与上一轮哈希一致，否则该页重测重拍。它不能用于 `--shot-only`（交付重拍必须全量），增量轮不生成联系表（只含重拍页会误导目检），并出一条 BATCH 告警提醒**交付前必须跑一次不带 `--incremental` 的全量 gate**。
- 失败即阻断交付。安全解析、构建或检查未完成都不能当作通过；目录里已存在的图和报告不参与本轮判定。但 gate/build 起步时若输出目录里出现非本次计划页的编号 HTML/PNG 即报错，工具不会代删历史产物：合页、删页或改页号后重跑请换一个新的输出目录。用户要求试验报告时，记录实际命令、输入与环境、各类结果、失败及修复、未验证项；几何负例必须确实失败，也不引用尚未生成的报告。

独立 CLI 保留，用于定位问题或分段执行：

```sh
node tools/lint-dom.mjs "<run>/work/src"
node tools/build.mjs "<run>/work/src" "<run>/out"
node tools/validate.mjs "<run>/out"
node tools/shot-all.mjs "<run>/out"
```

独立截图不是检查通过的证明，独立命令也不能代替最终版本的全量交付检查。实现、字体环境或资源尚未核实时，明确标为未验证，不宣称已达成上述契约。

## 几何检查与目检

| 性质 | 处理 |
|---|---|
| 非意图越界、正文或骨架文字被遮挡、文字裁切/撑破、声明单行却折行、必需图片失效、组件声明的宽高比被区域压窄 | 硬错误，阻断交付；对应负例应实际失败 |
| 素材已加载、窗口也在，但 `<img>` 量出 0 宽或 0 高（画面塌陷，R11） | 硬错误，阻断交付；这种元素会被可见性过滤从其余几何检查里摘掉，不单独报错就静默通过。比例与 flex 写在窗口本体（`figure`）上，不要把 `<img>` 某一维钉成 0 |
| 正文整体不可见（`main.body` 内没有可见组件，R12） | 硬错误，阻断交付；整棵子树隐藏会让其余几何规则免检，R12 在可见性过滤之后兜底。C2 拆分起原 R13（require/form 全部不可见）已随之退役：单组件隐藏若是页内唯一可见组件，同样被 R12 接住；组件内的隐藏形态无几何后果，归登记卡与目检 |
| 骨架几何越档（列宽占比/标题行数/载体宽度档/锚点载体，R14）、时间线步内拉伸余量 >12cqw（R15）、声明 `data-bleed` 却没贴到出血边（R16）、向下出血页脚折行（R18） | 硬错误，阻断交付；对应负例应实际失败。这些是构图不变量，不是密度提示：R15/R16/R18 对所有页生效，R14 只约束选了骨架档的页（`free` 页的标题行数仍只是参考信息） |
| 测量探针没有执行、页面未加载、输出不完整 | 检查失败，先定位环境或构建问题，不以空报告通过 |
| 密度、留白、标题行数、可能过度裁切、等比窗口与素材比例不符形成的空白带 | 参考信息，由 LLM 结合内容和画面判断，不一律返修 |

先处理真实溢出与遮挡，再判断构图。可调整布局、换允许组件、合理裁切，或同步精简内容；需要时合页或拆页。比例被压窄与空白带同样靠布局和载体解决，不靠任意缩字、拉伸素材、补底色补边框、虚假证据和装饰堆积把提示消掉；具体换区域、换窗口形态或换载体见[组件用法](03-components.md)。

总览用于检查整组节奏；逐页图用于查看局部可读性、图注和裁切，两者都可以看。返修没有固定轮次；修复后重跑受影响检查，最终输出必须与通过检查的当前 HTML 一致。

**检查器不保证的事**：gate 的 passed 只覆盖标记契约、来源分级校验、可见元素的几何与图片加载，不代表内容已核。以下仍由 LLM 判断并在目检时确认：散文润色是否保真（其余类别只按文字重叠告警，不逐字比对）、`asset_meta` 是否登记、图注与截图能否互证、截图 UI 是否被重画、图层 ID 跨页跨轮是否稳定、证据本身是否真实。品牌文字与 `meta.brand` 不一致（L6）、`meta.brand` 为空或 `dark: false`（计划加载即拒绝）、池内孤儿资产（加载即拒绝）、骨架 `carriers`/`anchor` 写内容组件（加载即拒绝）、区域写 `require`（加载即拒绝，禁入绊线）、正文整体不可见（R12）、豁免标记夹带文字叶或长文案（L8）、页脚或品牌里非署名图层的文字缺 `data-from`（L8）、内联 `style` 覆盖外观属性或改写种子变量（L17）、锁高 `phone` 根内塞文字叶（L19）、多机每壳漏界面名（人审项，C3 起 gate 不再强制，见配方登记卡绑定纪律）、件数缺/超越载体档（R14 实测接住；区域顺序交换渲染等价，归装配自查与登记卡，C2/C4 起 L20 静态层退役）、overlay 区域不是画布根直接子级（L21）、省出处却保留分隔线 `.rule`（人审项，C5 起 gate 不再拦，见登记卡 R-quote-01 耦合约束）、出血区域没有配文（L23）、图片脱离显式组件根（含 `data-decoration` 的图片，L11）、数字与单位不符（L14）、`data`/`quotes` 文案与资产 `text` 不符（L15）、骨架几何越档（R14）、时间线步内拉伸余量 >12cqw（R15）、`data-bleed` 未贴到出血边（R16）、向下出血页脚折行（R18）都已是硬错误；文字与所引资产毫无重叠（L16）、内联出现两份清单之外的属性名（L18）、`@font-face` 声明了分片却一个都没加载成功（FONT）只告警不阻断。局部隐藏元素仍会被几何检查整棵跳过，`[hidden]` 被内联 `display` 覆盖时按可见文字处理、不再豁免来源检查。不得用隐藏样式或豁免标记承载正文、假数据或编造结论；目检必须确认正文真的在画面上。

## 产物、复现与编辑

```text
<run>/
  work/
    02-pool.json
    03-plan.json
    src/pNN.part.html
    qa-report.json
    qa-summary.json
    geometry-digest.json
    _sheet.png
    editor.manifest.json
  out/
    NN.html
    NN.png
    assets/
```

**运行目录 `<run>` 是工作区，不是交付区**：它建在用户交付目录之外（临时目录或独立工作目录）。交付把 `out/` 的内容放进**带版本标识的交付目录**（如 `期名-日期/`，或用户指定的目录）——用户选了工作区就放工作区内，没有就用本次任务的临时交付目录；每轮交付各占一个目录，不覆盖历史交付。交付区只应出现 HTML、PNG 与 `assets/`；`work/`（池、计划、源片段、QA 报告与快照）留在运行目录里，不随交付进入交付区。**交付 `out/` 的 HTML 源页、PNG 与素材，不只给图片。** 若需要重新生成或复现实验，另保存 `work/src/`、池、计划、素材来源及使用的种子/目录版本；检查报告和环境记录也应随复现材料保留。`work/` 不是无价值缓存，不自动删除——它只是不放在交付区。

`editor.manifest.json` 只描述本轮渲染快照：画布坐标、图层身份及 `parentLayer` 父子关系。它不承诺交互能力，不作为位置锁定或自动重排的输入。真实编辑器尚未接入；未来编辑面对当前 HTML，生成流程与编辑流程解耦，不承诺拖拽后重新生成能保留编辑结果。

直接修改 `out/` 可用于后续编辑，但之后从 `work/src/` 构建会覆盖它；需要持续生成时同步回工作源文件并重查。交付说明区分源文件、成品、诊断快照与实际测试结果。
