# 批次 C1 · ck-phone 档纠偏的负例依赖核对表（2026-11-14）

> 施工依据：`dev/EXEC-PLAN-batchC-2026-11-13.md` C1 第 4 步（B-contract 4.3 同款格式）。
> 核对对象：`config/recipes.json` `R-list-01.layouts.ck-phone`（order/tracks/when 三字段纠偏，headline/carriers 不动）。

## 核对方法与结果

对 `dev/controlled/negative-index.json`（基线 2128，184 条）全量扫描 `R-list-01` 与 `ck-phone` 字样：

- **命中 0 条**——没有任何夹具的 `first_error` 依赖 ck-phone 档的旧 schema（order=[head,left,right] / tracks=left+right）。
- 预期成立：该档此前从未被负例覆盖（p20 的 R14「left 不可见」是 A1 全量回归新挖出的骨架/档失配，不在受控套件内）。

## 结论

**零依赖、零翻转**：纠偏不会使任何既有负例的预期翻转；无夹具需要重登记。纠偏后的正向证据由 `dev/controlled/a1fix-p20-1113/`（单页重跑 passed，share 0.483 ∈ [0.46,0.50]、phone 41.4 ∈ [39,44]）承载。

| 项 | 结果 |
|---|---|
| 扫描范围 | 184 夹具（negative-index 2128） |
| 依赖旧 schema 夹具 | 0 |
| 预期翻转 | 0 |
| 新基线 | `controlled-negative-1114-0000`（C1 全量重跑，**184/184 passed 实测零涟漪**） |
