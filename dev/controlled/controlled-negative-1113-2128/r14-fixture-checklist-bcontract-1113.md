# 11 条 R14 夹具核对表（刀 C 4.3，2026-11-13）

> B-contract 删 `R-phone-01.duo-labeled [32,36]` 后逐条核对：是否依赖 width 字段、删档后是否翻转。
> 归档目录：本目录（`controlled-negative-1113-2128/`，基线 2140 → 2128）；核对依据 `negative-index.json`（scope 2140）first_error + 本次 2128 回归实测。
> **实证结论：11 条全部不翻转**（2128 回归 184/184 全绿，与 EXEC-PLAN §0 预判一致）。夹具本体零改动。

| # | 夹具 | 依赖 width 字段 | width 档归属 | 删档影响 | 2128 实测 |
|---|---|---|---|---|---|
| 1 | skeleton-anchor-missing | 否（tracks/share 类） | — | 无 | PASS（R14 首错不翻） |
| 2 | skeleton-bleed-share | 否（share 类） | — | 无 | PASS |
| 3 | skeleton-carrier-missing | 否（owners.length 缺席检查，validate.mjs:99 未动） | — | 无 | PASS |
| 4 | skeleton-carrier-width | **是** | `36–42` = R-list-01.frow-phone（**未删，保留**） | 无 | PASS（`宽 30.0cqw 超出骨架档 36–42` 不翻） |
| 5 | skeleton-counts-over | 否（首错缺 h1，非 width） | — | 无 | PASS |
| 6 | skeleton-counts-under | 否（首错缺 h1，非 width） | — | 无 | PASS |
| 7 | skeleton-headline-lines | 否（headline 行数） | — | 无 | PASS |
| 8 | skeleton-order-missing-region | 否（order/区域可见性） | — | 无 | PASS |
| 9 | skeleton-share-out-of-range | 否（share 类） | — | 无 | PASS |
| 10 | skeleton-shot-counts | **是** | `40–45` = R-compare-02.shot-ba（**未删，保留**） | 无 | PASS（`宽 86.8cqw 超出骨架档 40–45` 不翻） |
| 11 | skeleton-tracks-missing-region | 否（tracks 类） | — | 无 | PASS |

补充：11 条无一引用 duo-labeled 旧档 `[32,36]`；依赖 width 字段的仅 #4/#10 两条，其档位属未删除配方。R14 的「width 缺省跳过」新分支（validate.mjs:102）只在 carrier 无 width 时生效，对全部 11 条零路径影响。

---

*执行：刀 C 4.3（2026-11-13）。不重登记——本表即核对留档，夹具与 expected 零改动。*
