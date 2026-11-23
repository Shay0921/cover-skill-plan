# 编辑器微调（可选路径）

> 只在需要 GUI 改字时走。依赖本机 pageApp 仓库，换环境不可用——**不是通用能力，别当成交付必做步骤**。

## 流程

1. `node script/render.mjs <任务运行区>/ --with-editor` —— 完整渲染一次，额外产出 `fields.json`、`editor.manifest.json`、`assets/`。
2. `cd <pageApp 仓库>/demo && node pack.mjs "<目录>"` —— 目录可指向任务运行区，或带 `--with-editor` 的交付目录；产出 `covers-edit.html`。
3. 浏览器打开 `covers-edit.html` 改字，导出。

pageApp 仓库本机两处：Windows `D:\AI\pageApp\demo`｜macOS `/Users/shay/Code/AI/pageApp/demo`。

## 已知差异（交接时须说明）

编辑器把「图片适配方式」存成自己的图层状态（默认 `cover`），打开页面即给每个 `<img>` 写内联 `object-fit`，覆盖母版的 `data-fit`。

- 有没有损失取决于图与槽是否同比例：全库唯一 `contain` 槽（N29 二维码，1:1）放 1:1 图时两者渲染一致；塞非等比图才会被裁。
- 规则：`contain` 槽只放同比例图。
- 已被裁的页，重跑 render 即恢复。
