// 画布几何与根选择器的唯一真源：截图视口、editor.manifest.json、即兴页 data-size 校验都读这里。
// 以前 1080×1440 与 `.artwork-page` 分散在 cdp / render / composed / 交付体检四处，
// 改画布要逐个找、漏一处就是「截图裁一半但 manifest 说没问题」这类对不上。
export const CANVAS = { width: 1080, height: 1440 };
export const ROOT_SELECTOR = '.artwork-page';
export const ROOT_CLASS = ROOT_SELECTOR.slice(1);
export const CANVAS_SIZE_ATTR = `${CANVAS.width}x${CANVAS.height}`;
