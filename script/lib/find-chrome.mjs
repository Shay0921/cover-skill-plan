#!/usr/bin/env node
/**
 * find-chrome.mjs —— 跨平台探测本机 Chrome / Chromium / Edge / Brave，供 cdp.mjs 使用。
 * 探测顺序：环境变量 CHROME_PATH / CHROME_BIN → 平台默认安装路径。
 */

import fs from 'node:fs';

function isExecutableFile(file) {
  try {
    if (!fs.statSync(file).isFile()) return false;
    if (process.platform !== 'win32') fs.accessSync(file, fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

/** 返回首个可执行文件路径；找不到返回 null。 */
export function findChrome() {
  const candidates = [];
  if (process.env.CHROME_PATH) candidates.push(process.env.CHROME_PATH);
  if (process.env.CHROME_BIN) candidates.push(process.env.CHROME_BIN);

  if (process.platform === 'darwin') {
    candidates.push(
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
      '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
      '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary'
    );
  } else if (process.platform === 'win32') {
    const pf = process.env['ProgramFiles'] || 'C:\\Program Files';
    const pf86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
    // 空的 LocalAppData 会拼出 `\Google\...` 这种驱动器相对路径，先滤掉；三种浏览器都探系统级与用户级。
    const roots = [pf, pf86, process.env['LocalAppData']].filter(Boolean);
    for (const app of ['\\Google\\Chrome\\Application\\chrome.exe', '\\Microsoft\\Edge\\Application\\msedge.exe', '\\BraveSoftware\\Brave-Browser\\Application\\brave.exe'])
      for (const root of roots) candidates.push(root + app);
  } else {
    candidates.push(
      '/usr/bin/google-chrome',
      '/usr/bin/google-chrome-stable',
      '/usr/bin/chromium',
      '/usr/bin/chromium-browser',
      '/snap/bin/chromium',
      '/opt/google/chrome/chrome',
      '/usr/bin/brave-browser',
      '/usr/bin/microsoft-edge'
    );
  }

  for (const p of candidates) {
    if (p && isExecutableFile(p)) return p;
  }
  return null;
}
