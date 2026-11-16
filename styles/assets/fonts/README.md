# fonts/ · 本地字体分片（当前未接入）

本目录存放 fontsource 的 woff2 分片包与对应 CSS（`noto-serif-sc-400.css`、`playfair-display-400.css`），保留作后续 webfont 可选增强的原料。

## 当前状态

- 默认字体策略是**本机字体栈**：`styles/<风格>/style.css` 的 `--serif/--sans/--mono` 直接声明本机字体族，不引 CDN、不加载 webfont、不做 base64 内嵌。
- 本目录当前**零引用**：画廊、交付页、编辑器均不读取这些文件。
- **只有 400 单字重**（Noto Serif SC 101 片 = 97 个中文 unicode-range 分片 + 4 个西文子集；Playfair Display 4 片；合计 105 片）；母版标题用 700/900，直接接入会缺粗体，必须先补字重分片。
- CSS 内 `url(./files/...)` 是相对路径，且编辑器打包器拒绝外链。日后启用 webfont 需同时解决交付页内嵌与字重对应，不能只加一行 `@import`。

## 目录结构

```text
styles/assets/fonts/
  <包名>-<字重>.css   fontsource 分片声明（首行为来源注释）
  files/              全部 woff2 分片，保持 fontsource 原始命名
```
