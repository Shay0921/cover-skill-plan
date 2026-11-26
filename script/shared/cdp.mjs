// Chrome 调试桥（零依赖 · CDP over pipe）：一个批次复用一个 browser 进程，每页新建一个 target，截完即关。
// 调用方：script/render.mjs（createOptions / launchBrowser / withPage / captureReadyPage / closeBrowser
//         / evaluate / fontReport）、script/font-weights.mjs（量宽生成权重表）。
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { findChrome } from './find-chrome.mjs';

export function createOptions(overrides = {}) {
  // 出图倍率：默认 2x——1x 下屏内截图等小图位只有 ~366 物理像素宽，
  // 3.5 倍一步降采样双线性插值必然糊。2x 后 PNG 为
  // 2160×2880，小图位细节可读。COVER_DSF=1 可临时回退 1x；GIF 预转换显式传 dsf:1 不受影响。
  return { width: 1080, height: 1440, dsf: +(process.env.COVER_DSF || 2), selector: '.artwork-page', waitSelector: '.artwork-page',
    timeout: 30000, fontTimeout: 5000, noSandbox: false, ...overrides,
    chrome: overrides.chrome || findChrome() };
}
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

// process.exit 不走 finally，异步 closeBrowser 到不了——被 exit 打断时 Chrome 子进程与 cover-cdp-* 目录会残留。
// 这里为所有活跃实例装一个同步兜底：进程退出时 kill 子进程组 + 删临时目录。只装一次，实例增删走集合。
const liveInstances = new Set();
let exitHookInstalled = false;
function installExitHook() {
  if (exitHookInstalled) return;
  exitHookInstalled = true;
  process.on('exit', () => {
    for (const inst of liveInstances) {
      const alive = inst.child.exitCode === null && inst.child.signalCode === null;
      if (alive && inst.child.pid) {
        if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(inst.child.pid), '/T', '/F'], { stdio: 'ignore' });
        else { try { process.kill(-inst.child.pid, 'SIGKILL'); } catch { /* 已退出 */ } }
      }
      try { fs.rmSync(inst.userDataDir, { recursive: true, force: true }); } catch { /* 目录被占用，交给下次系统清理 */ }
    }
  });
}

class CdpPipe {
  constructor(write, read) {
    this.write = write; this.buffer = Buffer.alloc(0); this.nextId = 1; this.pending = new Map(); this.closed = false;
    read.on('data', chunk => {
      this.buffer = Buffer.concat([this.buffer, chunk]);
      let end;
      while ((end = this.buffer.indexOf(0)) !== -1) {
        const raw = this.buffer.subarray(0, end).toString('utf8'); this.buffer = this.buffer.subarray(end + 1);
        let message; try { message = JSON.parse(raw); } catch { continue; }
        const item = this.pending.get(message.id); if (!item) continue;
        this.pending.delete(message.id); clearTimeout(item.timer);
        if (message.error) item.reject(new Error(message.error.message)); else item.resolve(message.result);
      }
    });
    read.on('close', () => this.close());
    read.on('error', error => this.close(error)); write.on('error', error => this.close(error));
  }
  send(method, params = {}, sessionId, timeout = 30000) {
    if (this.closed) return Promise.reject(new Error('Chrome CDP 连接已关闭'));
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.pending.delete(id); reject(new Error(`CDP 超时: ${method}`)); }, timeout);
      this.pending.set(id, { resolve, reject, timer });
      this.write.write(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }) + '\0');
    });
  }
  close(error = new Error('Chrome CDP 连接已关闭')) {
    this.closed = true;
    for (const item of this.pending.values()) { clearTimeout(item.timer); item.reject(error); }
    this.pending.clear();
  }
}

export async function launchBrowser(opts = createOptions()) {
  try {
    return await launchOnce(opts);
  } catch (error) {
    // 受限环境（容器 / root / CI / macOS 沙箱）里 Chrome 建不了 renderer 沙箱会直接退出，
    // 表现是调试管道秒关（SIGTRAP），stderr 全是 crashpad 噪声、看不到 "No usable sandbox"。
    // 但「进程根本没起来」（路径错 / 无执行权限）重试毫无意义，只会把真实原因说成沙箱问题。
    const spawnFailed = ['ENOENT', 'EACCES', 'ENOTDIR'].includes(error.code)
      || /\bspawn\b[\s\S]*(ENOENT|EACCES|ENOTDIR)/.test(error.message);
    if (spawnFailed || opts.noSandbox) throw error;
    console.warn('⚠ Chrome 首次启动失败（疑似受限环境无法建 renderer），自动加 --no-sandbox 重试一次');
    try {
      return await launchOnce({ ...opts, noSandbox: true });
    } catch (retryError) {
      // 两次错误都要留：只报重试那条会把真实原因（如 profile 锁、页面级崩溃）藏掉
      throw new Error(`Chrome 启动失败（已含 --no-sandbox 重试）\n[首次] ${error.message}\n[重试] ${retryError.message}`);
    }
  }
}

async function launchOnce(opts) {
  if (!opts.chrome) throw new Error('找不到 Chrome/Edge；可设置 CHROME_PATH / CHROME_BIN');
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cover-cdp-'));
  const args = ['--headless=new', '--remote-debugging-pipe', '--no-first-run', '--no-default-browser-check',
    '--disable-background-networking', '--disable-breakpad', '--disable-component-update', '--disable-default-apps',
    '--disable-extensions', '--disable-sync', '--metrics-recording-only', '--mute-audio', '--hide-scrollbars',
    '--disable-dev-shm-usage', `--force-device-scale-factor=${opts.dsf}`, `--user-data-dir=${userDataDir}`];
  if (opts.noSandbox) args.push('--no-sandbox', '--disable-setuid-sandbox');
  args.push('about:blank');
  const child = spawn(opts.chrome, args, { detached: process.platform !== 'win32', stdio: ['ignore', 'ignore', 'pipe', 'pipe', 'pipe'] });
  const cdp = new CdpPipe(child.stdio[3], child.stdio[4]);
  const inst = { child, cdp, userDataDir, stderr: '' };
  liveInstances.add(inst); installExitHook();
  child.stderr.on('data', chunk => { inst.stderr = (inst.stderr + chunk).slice(-6000); });
  child.on('error', error => cdp.close(error));
  try {
    await cdp.send('Browser.getVersion', {}, undefined, 10000);
    // 冒烟：browser 进程活着不代表 renderer 起得来。受限环境里建 target 能用，但一导航 renderer 就被沙箱杀掉，
    // 管道秒关、stderr 只有 crashpad 噪声。这里必须真导航 + 真求值（固定 sleep 在快慢机上都不靠谱），
    // 失败就抛给 launchBrowser 统一降级重试。
    const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' }, undefined, 15000);
    const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true }, undefined, 10000);
    await cdp.send('Page.enable', {}, sessionId, 10000);
    await cdp.send('Page.navigate', { url: 'data:text/html,<html><body>ok</body></html>' }, sessionId, 15000);
    let alive = false;
    for (let i = 0; i < 20 && !alive && !cdp.closed; i++) {
      try { alive = (await evaluate(cdp, sessionId, 'document.body?document.body.textContent.trim():""', { timeoutMs: 2000 })) === 'ok'; } catch { /* renderer 未起 */ }
      if (!alive) await delay(100);
    }
    try { await cdp.send('Target.closeTarget', { targetId }, undefined, 5000); } catch { /* 管道已关时忽略 */ }
    if (!alive) throw new Error(cdp.closed ? 'Chrome CDP 连接已关闭（renderer 被沙箱杀掉）' : 'renderer 冒烟超时：导航后无响应');
    return inst;
  } catch (error) {
    await closeBrowser(inst);
    const wrapped = new Error(`${error.message}\n${inst.stderr}`);
    if (error.code) wrapped.code = error.code;   // 保留 ENOENT/EACCES，供 launchBrowser 判断是否值得重试
    throw wrapped;
  }
}

export async function closeBrowser(inst) {
  if (!inst) return;
  liveInstances.delete(inst);
  try { await inst.cdp.send('Browser.close', {}, undefined, 2000); } catch { /* already closed */ }
  inst.cdp.close();
  if (inst.child.exitCode === null && inst.child.signalCode === null)
    await Promise.race([new Promise(resolve => inst.child.once('exit', resolve)), delay(2000)]);
  if (inst.child.exitCode === null && inst.child.signalCode === null && inst.child.pid) {
    if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(inst.child.pid), '/T', '/F'], { stdio: 'ignore' });
    else { try { process.kill(-inst.child.pid, 'SIGKILL'); } catch { /* exited */ } }
  }
  try { fs.rmSync(inst.userDataDir, { recursive: true, force: true }); } catch { /* temporary OS lock */ }
}

export async function evaluate(cdp, sessionId, expression, options = {}) {
  const result = await cdp.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: !!options.awaitPromise }, sessionId, options.timeoutMs || 30000);
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
  return result.result?.value;
}

// 在独立 target 里打开一页，等到「文档就绪 + 字体稳定 + 图片 decode 完」再交给回调；
// 回调返回即关 target（截图、量尺寸都在这一个 target 里做，避免字体在两次渲染间换 face）。
export async function withPage(inst, navUrl, opts, fn) {
  const { cdp } = inst;
  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
  try {
    const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
    await cdp.send('Page.enable', {}, sessionId);
    await cdp.send('Runtime.enable', {}, sessionId);
    await cdp.send('Emulation.setDeviceMetricsOverride',
      { width: opts.width, height: opts.height, deviceScaleFactor: opts.dsf, mobile: false }, sessionId);
    const ctx = { cdp, sessionId, targetId };
    const navigation = await cdp.send('Page.navigate', { url: navUrl }, sessionId, opts.timeout);
    if (navigation.errorText) throw new Error(`页面加载失败: ${navigation.errorText}`);
    await evaluate(cdp, sessionId, `(async () => {
      const start=Date.now(), limit=${Math.min(opts.timeout, 10000)};
      while(document.readyState!=='complete' && Date.now()-start<limit) await new Promise(r=>setTimeout(r,50));
      void document.body?.offsetHeight;
      await Promise.race([document.fonts.ready,new Promise(r=>setTimeout(r,${opts.fontTimeout}))]);
      await Promise.race([Promise.all([...document.images].map(i=>i.decode().catch(()=>null))),new Promise(r=>setTimeout(r,4000))]);
    })()`, { awaitPromise: true, timeoutMs: opts.timeout });
    // 停掉迟到的网络响应，防止字体在测量与截图之间换 face
    await cdp.send('Page.stopLoading', {}, sessionId);
    await evaluate(cdp, sessionId, 'new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))', { awaitPromise: true });
    if (opts.waitSelector && !await evaluate(cdp, sessionId, `!!document.querySelector(${JSON.stringify(opts.waitSelector)})`))
      throw new Error(`找不到 ${opts.waitSelector}`);
    return await fn(ctx);
  } finally {
    try { await cdp.send('Target.closeTarget', { targetId }, undefined, 2000); } catch { /* closed */ }
  }
}

// 字宽采样串（单一来源）：本文件的 fontReport 用它量宽，script/font-weights.mjs 反过来 import 它
// 生成字宽权重表。为什么定义在这里、而不是各写一份：两处采样集不同（大写 26 字母 vs 6 字母）时，
// 同一台机器、同一款字体会量出 0.705 与 0.69 两个数，核对时被误判成「某处算错了」。
// 方向是「生成器依赖本文件」，不是「本文件依赖生成器」——cdp 仍是自包含的 Chrome 桥。
export const WIDTH_SAMPLES = {
  han: '中文测试字体大小宽高标题正文说明数据报告功能',
  upper: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  lower: 'abcdefghijklmnopqrstuvwxyz',
  digit: '0123456789',
  punct: '!,.:;?()[]/-',
};

// 字体体检（按需诊断，**不在每页热路径**：只有 render --font-report 才会调用）。
// 回答三件事：
//   ① 声明了 @font-face 却一个 face 都没加载？——此时 document.fonts.status 照样是 loaded，
//      文字其实全走系统回退。当前所有页面都不声明 @font-face（本机字体栈方案），这条恒为 0，
//      是留给「将来若重新接入 webfont」的守门，不是现存故障。
//   ② 每个文字层实际由哪个 face 渲染？——CSS.getPlatformFontsForNode 逐节点问 Chrome，
//      用于换机出图前核对「声明栈 → 真实命中」，以及交付页字形回退排查。
//   ③ 三套字体栈的字宽实测？——`≤N字` 的宽度模型绑定运行机器字面：本报告打印的是实测值，
//      与 render.mjs 查权重表得到的建模值（ACTIVE_WIDTH 与 --font-report 的「建模值」行）直接比，
//      建模值必须 ≥ 实测、越接近越紧；换字体或换机后重跑本报告即可判断模型是否仍偏保守。
// 成本：一次 DOM.getDocument(depth:-1) + 逐文字节点协议往返；默认关闭时零开销。
export async function fontReport({ cdp, sessionId }) {
  const declared = await evaluate(cdp, sessionId, `(() => ({
    status: document.fonts.status,
    faces: [...document.fonts].map(f => ({ family: f.family, weight: f.weight, status: f.status })),
  }))()`);
  const report = { status: declared.status, faces: declared.faces, loadedFaces: 0, actual: [], widths: {}, warnings: [] };
  report.loadedFaces = declared.faces.filter((f) => f.status === 'loaded').length;
  if (declared.status !== 'loaded') report.warnings.push(`document.fonts 状态 ${declared.status}：字体尚未就绪，实际字形可能中途换 face`);
  if (declared.faces.length && !report.loadedFaces)
    report.warnings.push(`@font-face 声明 ${declared.faces.length} 个、加载成功 0 个：文字按系统回退渲染，核对下方实际 face`);
  try {
    await cdp.send('DOM.enable', {}, sessionId);
    await cdp.send('CSS.enable', {}, sessionId);
    const { root } = await cdp.send('DOM.getDocument', { depth: -1 }, sessionId);
    const nodes = [];
    const walk = (node) => {
      const attrs = node.attributes || [];
      // 只问「直接含非空文本子节点」的元素：纯容器问了也是空结果，白付协议往返
      if (node.nodeType === 1 && !['STYLE', 'TITLE', 'SCRIPT'].includes(node.nodeName)
        && node.children?.some((c) => c.nodeType === 3 && c.nodeValue.trim())) {
        let layer = null;
        for (let i = 0; i < attrs.length; i += 2) if (attrs[i] === 'data-layer') layer = attrs[i + 1];
        nodes.push({ nodeId: node.nodeId, layer, tag: node.nodeName });
      }
      for (const child of node.children || []) walk(child);
    };
    walk(root);
    for (const node of nodes) {
      const { fonts } = await cdp.send('CSS.getPlatformFontsForNode', { nodeId: node.nodeId }, sessionId);
      if (fonts.length) report.actual.push({ layer: node.layer, tag: node.tag, face: fonts.map((f) => f.familyName).join('+') });
    }
  } catch (error) { report.warnings.push(`读不到实际 face：${error.message}`); }
  if (!report.actual.length) report.warnings.push('未读到任何实际 face（页面无文字层，或 CSS 域不可用）');
  try {
    // 用页面自身的字体栈量字宽：canvas measureText 逐字符，除以字号得 em 比例。
    // 采样串用本文件的 WIDTH_SAMPLES（与 font-weights.mjs 同一组），否则两边数字对不上。
    // 字重二档制：全库只有 400/700 两档，且真 Bold 面 advance 与 400 不同
    // （实测 Songti SC 大写 0.6625→0.6712、PingFang SC 0.6689→0.6839）——两档都量，
    // 与权重表的 {400,700} 两档逐项对照；实测 > 建模 = 该重跑权重表的有效信号，不是 bug。
    // mono 是等宽体、两档恒同值，可兼作测量管线的自检锚点。
    report.widths = await evaluate(cdp, sessionId, `(() => {
      const cs = getComputedStyle(document.documentElement);
      const stack = (name, fallback) => (cs.getPropertyValue(name) || '').trim() || fallback;
      const ctx = document.createElement('canvas').getContext('2d');
      const avg = (font, text) => { ctx.font = font; let sum = 0; for (const ch of text) sum += ctx.measureText(ch).width; return +(sum / [...text].length / 100).toFixed(4); };
      const samples = ${JSON.stringify(WIDTH_SAMPLES)};
      const out = {};
      for (const [role, family] of [['serif', stack('--serif', 'serif')], ['sans', stack('--sans', 'sans-serif')], ['mono', stack('--mono', 'monospace')]]) {
        out[role] = {};
        for (const wt of [400, 700]) {
          const font = wt + ' 100px ' + family;
          const w = { weight: wt };
          for (const [k, text] of Object.entries(samples)) w[k] = avg(font, text);
          out[role][wt] = w;
        }
      }
      return out;
    })()`);;
  } catch (error) { report.warnings.push(`字宽实测失败：${error.message}`); }
  return report;
}

export async function captureReadyPage({ cdp, sessionId }, opts = createOptions()) {
  const area = await evaluate(cdp, sessionId, opts.selector ? `(() => {
    const e=document.querySelector(${JSON.stringify(opts.selector)});if(!e)return null;
    const r=e.getBoundingClientRect();return {x:r.x+scrollX,y:r.y+scrollY,width:r.width,height:r.height};
  })()` : '({x:0,y:0,width:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight})');
  if (!area || area.width <= 0 || area.height <= 0) throw new Error('截图区域不存在或为空');
  const shot = await cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: true, captureBeyondViewport: true,
    clip: { ...area, scale: 1 } }, sessionId, opts.timeout);
  const buffer = Buffer.from(shot.data, 'base64');
  if (buffer.length < 24 || buffer.toString('hex', 0, 8) !== '89504e470d0a1a0a') throw new Error('Chrome 未返回有效 PNG');
  return { buffer, width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20), bytes: buffer.length };
}
