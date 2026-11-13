#!/usr/bin/env node
// T9 资产入册独立校验（可随时复跑，退出码 0 = 台账与磁盘一致）：
//   ① 台账每条资产存在且 SHA-256 精确一致
//   ② 不变量：b64 解码 == PNG 字节级同一；PNG IHDR 尺寸 == 台账登记
//   ③ 入册产物零 dev 路径引用（扫描 references/ seed/ tools/ 文本文件）
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { ROOT } from '../tools/project.mjs';
import { verifyAssetChecksum } from '../tools/build.mjs';

const registry = JSON.parse(fs.readFileSync(path.join(ROOT, 'dev/asset-registry.json'), 'utf8'));
let failed = 0;
const ok = (name, cond, detail = '') => { console.log(`${cond ? 'PASS' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`); if (!cond) failed = 1; };
const sha = b => crypto.createHash('sha256').update(b).digest('hex').toUpperCase();
const byPath = Object.fromEntries(registry.assets.map(a => [a.path, a]));

for (const asset of registry.assets) {
  const p = path.join(ROOT, asset.path);
  try {
    const buf = fs.readFileSync(p);
    verifyAssetChecksum(asset.path, buf);
    ok(`存在且校验和一致 ${asset.path}`, true, sha(buf).slice(0, 8) + '…');
  } catch (e) { ok(`存在且校验和一致 ${asset.path}`, false, e.message.slice(0, 90)); }
}

// 不变量：b64 ↔ PNG 字节级同一 + PNG 尺寸
try {
  const raw = fs.readFileSync(path.join(ROOT, 'seed/iphone-frame.b64'), 'utf8').trim();
  const b64 = Buffer.from(raw.match(/^data:image\/png;base64,([A-Za-z0-9+/=]+)$/)[1], 'base64');
  const png = fs.readFileSync(path.join(ROOT, 'references/assets/iphone-frame.png'));
  ok('不变量：b64 解码 == PNG 字节级同一', b64.equals(png), `${b64.length} bytes`);
  const w = png.readUInt32BE(16), h = png.readUInt32BE(20);
  const entry = byPath['references/assets/iphone-frame.png'];
  ok('不变量：PNG IHDR 尺寸 == 台账登记', w === entry.width && h === entry.height, `${w}×${h}`);
} catch (e) { ok('不变量：b64↔PNG / IHDR 尺寸', false, e.message.slice(0, 90)); }

// 入册产物零 dev 路径引用
const { scope, extensions, pattern } = registry.forbiddenDevRefScan;
const re = new RegExp(pattern);
let scanned = 0, hits = [];
const walk = d => { for (const e of fs.readdirSync(d, { withFileTypes: true })) {
  const p = path.join(d, e.name);
  if (e.isDirectory()) walk(p);
  else if (extensions.includes(path.extname(e.name))) {
    scanned++;
    if (re.test(fs.readFileSync(p, 'utf8'))) hits.push(path.relative(ROOT, p));
  }
} };
for (const dir of scope) walk(path.join(ROOT, dir));
ok(`入册产物零 dev 路径引用（扫描 ${scanned} 个文本文件）`, hits.length === 0, hits.join(', ') || 'clean');

process.exit(failed);
