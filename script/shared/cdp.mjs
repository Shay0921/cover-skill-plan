// Zero-dependency CDP pipe. One browser per batch; font cache sharing is NOT a
// guarantee of identical font selection. Every measured page records real faces.
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { findChrome } from './find-chrome.mjs';

export function createOptions(overrides = {}) {
  return { width: 1080, height: 1440, dsf: 1, selector: '.artwork-page', waitSelector: '.artwork-page',
    timeout: 30000, fontTimeout: 5000, noSandbox: false, block: [], ...overrides,
    chrome: overrides.chrome || findChrome() };
}
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
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
  if (!opts.chrome) throw new Error('找不到 Chrome/Edge；可设置 CHROME_PATH / CHROME_BIN');
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cover-cdp-'));
  const args = ['--headless=new', '--remote-debugging-pipe', '--no-first-run', '--no-default-browser-check',
    '--disable-background-networking', '--disable-breakpad', '--disable-component-update', '--disable-default-apps',
    '--disable-extensions', '--disable-sync', '--metrics-recording-only', '--mute-audio', '--hide-scrollbars',
    '--disable-dev-shm-usage', '--force-device-scale-factor=1', `--user-data-dir=${userDataDir}`];
  if (opts.noSandbox) args.push('--no-sandbox', '--disable-setuid-sandbox');
  args.push('about:blank');
  const child = spawn(opts.chrome, args, { detached: process.platform !== 'win32', stdio: ['ignore', 'ignore', 'pipe', 'pipe', 'pipe'] });
  const cdp = new CdpPipe(child.stdio[3], child.stdio[4]);
  const inst = { child, cdp, userDataDir, stderr: '' };
  child.stderr.on('data', chunk => { inst.stderr = (inst.stderr + chunk).slice(-6000); });
  child.on('error', error => cdp.close(error));
  try { await cdp.send('Browser.getVersion', {}, undefined, 10000); return inst; }
  catch (error) { await closeBrowser(inst); throw new Error(`${error.message}\n${inst.stderr}`); }
}
export async function closeBrowser(inst) {
  if (!inst) return;
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

// Parsing runs in a separate about:blank target. Blocking all requests happens
// before DOMParser sees any source; the inert parsed document is never attached.
export async function withBlank(inst, opts, fn, { offline = true } = {}) {
  const { cdp } = inst;
  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
  try {
    const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
    await cdp.send('Page.enable', {}, sessionId);
    await cdp.send('Runtime.enable', {}, sessionId);
    await cdp.send('Network.enable', {}, sessionId);
    await cdp.send('Network.setBlockedURLs', { urls: offline ? ['*'] : opts.block || [] }, sessionId);
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: opts.width, height: opts.height, deviceScaleFactor: opts.dsf, mobile: false }, sessionId);
    return await fn({ cdp, sessionId, targetId });
  } finally {
    try { await cdp.send('Target.closeTarget', { targetId }, undefined, 2000); } catch { /* closed */ }
  }
}

export async function fontState({ cdp, sessionId }) {
  const result = await evaluate(cdp, sessionId, `(() => ({status:document.fonts.status,
    faces:[...document.fonts].map(f=>({family:f.family,style:f.style,weight:f.weight,status:f.status})),
    requested:[...new Set([...document.querySelectorAll('[data-editable="text"],.brand,.footer')].map(e=>getComputedStyle(e).fontFamily))]}))()`);
  result.actual = []; result.warnings = [];
  try {
    await cdp.send('DOM.enable', {}, sessionId); await cdp.send('CSS.enable', {}, sessionId);
    const { root } = await cdp.send('DOM.getDocument', { depth: -1 }, sessionId);
    const nodes = [];
    const walk = node => {
      const attrs = Object.fromEntries(Array.from({ length: (node.attributes || []).length / 2 }, (_, i) => [node.attributes[i * 2], node.attributes[i * 2 + 1]]));
      if (node.nodeType === 1 && node.children?.some(child => child.nodeType === 3 && child.nodeValue.trim()))
        nodes.push({ nodeId: node.nodeId, layer: attrs['data-layer'] || null, tag: node.nodeName });
      for (const child of node.children || []) walk(child);
    };
    walk(root);
    for (const node of nodes) {
      if (['STYLE', 'TITLE', 'SCRIPT'].includes(node.tag)) continue;
      const { fonts } = await cdp.send('CSS.getPlatformFontsForNode', { nodeId: node.nodeId }, sessionId);
      if (fonts.length) result.actual.push({ layer: node.layer, tag: node.tag, fonts });
    }
  } catch (error) { result.warnings.push(`无法读取实际字体 face: ${error.message}`); }
  if (result.status !== 'loaded' || result.faces.some(f => f.status === 'error' || f.status === 'loading'))
    result.warnings.push('部分字体未加载成功；实际 face 见 actual，不声明任何特定系统回退字体');
  // 未命中的 unicode-range 分片停在 unloaded 属正常；但"声明了却一个都没 loaded"时
  // document.fonts.status 照样是 loaded，文字其实全走系统回退，这种静默必须进报告。
  result.loadedFaces = result.faces.filter(f => f.status === 'loaded').length;
  if (result.faces.length && !result.loadedFaces)
    result.warnings.push(`@font-face 声明 ${result.faces.length} 个分片，加载成功 0 个：文字按系统回退渲染，请按 fonts.actual 核对实际字体`);
  return result;
}

export async function withPage(inst, navUrl, opts, fn) {
  return withBlank(inst, opts, async ctx => {
    const { cdp, sessionId } = ctx;
    const navigation = await cdp.send('Page.navigate', { url: navUrl }, sessionId, opts.timeout);
    if (navigation.errorText) throw new Error(`页面加载失败: ${navigation.errorText}`);
    const readiness = await evaluate(cdp, sessionId, `(async () => {
      const start=Date.now(), limit=${Math.min(opts.timeout, 10000)};
      while(document.readyState!=='complete' && Date.now()-start<limit) await new Promise(r=>setTimeout(r,50));
      const loaded=document.readyState==='complete';
      void document.body?.offsetHeight;
      await Promise.race([document.fonts.ready,new Promise(r=>setTimeout(r,${opts.fontTimeout}))]);
      await Promise.race([Promise.all([...document.images].map(i=>i.decode().catch(()=>null))),new Promise(r=>setTimeout(r,4000))]);
      return {loaded,fontStatus:document.fonts.status};
    })()`, { awaitPromise: true, timeoutMs: opts.timeout });
    // Stop late network responses from swapping font faces between measurement
    // and capture. This is per-target stabilization, not a batch fallback claim.
    await cdp.send('Page.stopLoading', {}, sessionId);
    await evaluate(cdp, sessionId, 'new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))', { awaitPromise: true });
    if (opts.waitSelector && !await evaluate(cdp, sessionId, `!!document.querySelector(${JSON.stringify(opts.waitSelector)})`))
      throw new Error(`找不到 ${opts.waitSelector}`);
    ctx.readiness = readiness;
    ctx.fonts = await fontState(ctx);
    if (!readiness.loaded) ctx.fonts.warnings.push('页面 load 未完成，已停止剩余加载；测量和截图复用此 Target');
    return fn(ctx);
  }, { offline: false });
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
