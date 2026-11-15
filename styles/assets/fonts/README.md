# seed/fonts — 字体资产与更换说明

本目录存放风格种子的本地字体（fontsource 分片包）。交付 HTML 不携带字体文件：build 内联种子 CSS 时把分片地址改写为 `local(字体名) + 固定版本 CDN`，系统已装该字体时优先用本地字型，未安装的机器按 `unicode-range` 从 CDN 补齐分片。技术契约见 [02-constraints「静态安全与资源」](../../references/02-constraints.md)。

## 目录结构

```text
seed/fonts/
  <包名>-<字重>.css      每个字体包一份 CSS，首行必须为来源注释
  files/                 全部 woff2 分片，保持 fontsource 原始命名
```

## 硬性契约

每份字体 CSS 的**首行**必须是：

```css
/* fontsource: <包名>@<版本> */
```

build 从这行注释推导交付用的固定版本 CDN 地址；缺失、格式不对、或包名与 CSS 内 `font-family` 推导出的包名不一致，构建直接报错。

## 更换 / 新增字体

1. 从 fontsource 取目标字体对应字重的 `index.css`，删去 woff 条目只留 woff2，写入本目录（命名 `<包名>-<字重>.css`），并按上述格式补首行来源注释。
2. 按 CSS 内 `url(./files/...)` 清单下载全部分片到 `files/`，保持原始文件名。jsdelivr 不可达时可用 `https://registry.npmmirror.com/@fontsource/<包>/<版本>/files/files/<文件名>` 镜像。下载后校验文件以 `wOF2` 签名开头。
3. 在 [种子](../paper-journal.html) 加一行 `@import url('./fonts/<包名>-<字重>.css');`，并按需调整 `--serif-stack` 的族序（浏览器按字符逐族回退：西文/数字命中 Latin 字体，中文自动落到后面的 CJK 字体）。
4. 重跑全量 gate；产物 HTML 中分片 URL 应带注释里登记的版本号。

更换默认字体时旧字体包（CSS + 其分片）一并移除，不保留备用——备选需求走用户配置 `config/fonts.user.json`（见 02-constraints）。
