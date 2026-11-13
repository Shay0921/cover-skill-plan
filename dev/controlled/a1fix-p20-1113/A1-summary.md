# A1 · 单页重跑 p20（EXEC-A1fix 定箱实验）（2026-11-13T15:59:58.036Z）

- run: `D:\AI\html2png\mine\cover-skill-plan\dev\controlled\a1fix-p20-1113`
- gate 总状态: **passed**（gateError: 无）
- 页级: 1 passed / 0 failed / 共 1
- 统计口径终审: 唯一 ID 9（期望 197）；{{}} 骨架原源 622（期望 622）/ 填充实际 628（repeat 展开会新增槽位）；唯一占位符名 154（期望 154）；跨骨架多占位符名 ID 58（新口径 58）；仅跨文件口径 29（新口径 29）；跨骨架多文案 ID 23（新口径 23）；同页多文案页数 9（期望 9）
- 构造口径: 监工批复按骨架实际形态（dark×2 / issue×5 + meta.issue='2026-11' / 品牌槽咬合 meta.brand）；印章槽填「真」（EXEC-A1fix A）

| nn | skeleton | recipe/layout | status | ERROR 规则 | 分箱初判 | 首错 |
|---|---|---|---|---|---|---|
| 20 | list01-ck-phone.part.html | R-list-01/ck-phone | passed | — | — |  |

> 分箱口径：L0/L1/L6/L9/L11/L17-L21/L23/L25=骨架病（静态结构）；L8/L10/L14/L15/L16/L24=构造病（池/计划）；R*=骨架几何病（几何档失配，待监工终审归箱）。失败只登记不修（GATE-A2 §3）。

## 裁决注记（EXEC-A1fix 定箱更新，2026-11-13）

1. **p20 L11 = 骨架病（已修）**：`list01-ck-phone` ck 实落在 `data-region="full"`，R-list-01 regions 原漏登记 full；EXEC-A1fix B 已补 `regions.full allow=[ck,list,text-block]` + 04-recipes 登记卡行，本 run 为修复后复验。
2. **p08/p10/p35 R10（seal）= 构造病（已修待验）**：印文槽占位符名 5 字（收束印章字）把 1:1 印章压成 0.208；EXEC-A1fix A 填充规则 7 补 `/印章/ → '真'`（1 字），本 run 为修复后复验。
3. **p19 R14 = 骨架病实锤（定箱）**：EXEC-A1fix C 换 4:3 素材 s10.png（1280×960）进 ar43 槽后 R14 数值不变（宽 50.2cqw 超 41–46 档），证明 shot 宽度由骨架 CSS 决定、与素材形状无关 → data04-panel 骨架/配方档失配，非构造病。实验证据 `dev/controlled/a1fix-p19-1113/`。
4. **p37 R15 = 构造病实锤（定箱）**：EXEC-A1fix D 手动展开 step ×4（图层 id 加 -N 后缀过 L9，文案用源页长度档）后单页 **PASSED**、R15 消失 → 骨架 `repeat ×4` 注释未被展开是唯一病因，骨架本身无辜；正式修法归 P8（数据驱动 repeat 展开）。实验证据 `dev/controlled/a1fix-p37-1113/`。
5. **跨骨架多占位符名 ID 口径（EXEC-A1fix E2 定谳）**：三种口径实测 58（元素 outerHTML 占位符名去重）/ 29（仅跨 ≥2 骨架文件）/ 23（填充后文案去重）；「31」为编制期静态扫描旧口径失效。逐 ID 明细 `id-stats.json`。
6. **WARN 分布**：无；全 run 零 L8/L10/L14/L15/L16/L24——受控池构造面干净。
