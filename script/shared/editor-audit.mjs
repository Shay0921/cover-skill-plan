// 交付目录层面的编辑器契约体检（只读）：属性取值域与图层唯一性仍由 shared/editor.mjs 判，
// 这里只加「目录级」的六件事——manifest 是否合规且登记了每一页、fields 键是否落在真图层、
// 每页是否仍带 <style>、pack 前置的页存在性、covers-edit.html 是否过期、缺件时的补救提示。
//
// 为什么单独成模块：事后补件（editor-prep）与只读体检（editor-contract）查的是同一批东西，
// 两边各写一份必然漂移——补件写完自己不复检，就会出现「补完即绿、打包仍红」。
import fs from 'node:fs';
import path from 'node:path';
import { checkMarkerContracts, MANIFEST_FORMAT, MANIFEST_VERSION, MANIFEST_DEFAULTS } from './editor.mjs';

export const PAGE_FILE_RE = /^P(\d+)-(.+)\.html$/i;

// 交付目录里的 P 页（按文件名排序 = 页序）。id 与显示名从文件名反解，
// 与 render 写 manifest 的公式同一套：`P01-<名>.html` → id `p01`、name `P01 · <名>`。
export function listPages(dir) {
  return fs.readdirSync(dir)
    .filter((f) => /^P\d+.*\.html$/i.test(f))
    .sort()
    .map((file) => {
      const m = file.match(PAGE_FILE_RE);
      const nn = m ? m[1] : '';
      const name = m ? m[2] : file.replace(/\.html$/i, '');
      return { file, nn, name, label: nn ? `P${nn} · ${name}` : name };
    });
}

export function auditDelivery(dir) {
  const errors = [];
  const warns = [];
  const pages = listPages(dir);
  const files = pages.map((p) => p.file);
  const ids = new Map();   // P 页文件名 → 图层 id 集

  // 图层 id 集直接取契约校验的返回值：同一份实现只扫一遍，别再拿另一份扫描器算第二遍。
  for (const file of files) {
    const html = fs.readFileSync(path.join(dir, file), 'utf8');
    const r = checkMarkerContracts(html, file);
    errors.push(...r.errors);
    warns.push(...r.warns);
    ids.set(file, r.ids);
    // pack.mjs 每页都要抽 <style> 内联进产物，抽不到直接抛「找不到 <style>」——提前在这里说，
    // 免得手改页之后要等打包器报一条不知道指哪儿错。判据要连标签一起匹配：
    // 只写 /<style\b/ 会把 `<style-disabled>` 这种非标签也当成有样式（`\b` 在 - 前成立）。
    if (!/<style(\s[^>]*)?>/i.test(html)) errors.push(`${file}: 没有 <style> 块——pack.mjs 会抛「找不到 <style>」`);
  }

  // manifest：编辑器靠它找根节点与页序。字段错一处打包就停。
  const manifestFile = path.join(dir, 'editor.manifest.json');
  if (fs.existsSync(manifestFile)) {
    let manifest;
    try {
      manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
    } catch (e) {
      errors.push(`editor.manifest.json 不是合法 JSON：${e.message}`);
    }
    if (manifest) {
      if (manifest.format !== MANIFEST_FORMAT) errors.push(`manifest.format 必须是 ${MANIFEST_FORMAT}，当前为 ${JSON.stringify(manifest.format)}`);
      if (manifest.version !== MANIFEST_VERSION) errors.push(`manifest.version 必须为 ${MANIFEST_VERSION}，当前为 ${JSON.stringify(manifest.version)}`);
      const { canvas } = MANIFEST_DEFAULTS;
      if (!manifest.canvas || manifest.canvas.width !== canvas.width || manifest.canvas.height !== canvas.height) {
        errors.push(`manifest.canvas 必须写成 { "width": ${canvas.width}, "height": ${canvas.height} }`);
      }
      if (manifest.root !== MANIFEST_DEFAULTS.root) errors.push(`manifest.root 必须是 "${MANIFEST_DEFAULTS.root}"，当前为 ${JSON.stringify(manifest.root)}——打包器靠它找画布根，写错整页打不开`);
      const listed = new Set();
      for (const page of Array.isArray(manifest.pages) ? manifest.pages : []) {
        if (!page || typeof page.file !== 'string' || !page.file) { errors.push('manifest.pages[] 缺少 file'); continue; }
        listed.add(page.file);
        if (!fs.existsSync(path.join(dir, page.file))) errors.push(`manifest 指向的页不存在：${page.file}`);
      }
      if (!Array.isArray(manifest.pages) || !manifest.pages.length) errors.push('manifest.pages 必须至少有一页');
      // pack.mjs 只按 manifest.pages 打包，没登记的页会被静默丢掉（不报错、产物里就是少一页）。
      const orphans = files.filter((f) => !listed.has(f));
      if (orphans.length) errors.push(`目录里有未登记进 manifest 的页：${orphans.join(' / ')}——pack.mjs 只打 manifest 里列出的页，这些会被静默丢掉`);
    }
  } else {
    // 实测：没有 manifest 时 pack.mjs 回落到默认 root `.p-page`，逐页报「找不到根节点：.p-page」——
    // 不是「靠扫描目录猜」，是直接打不开。所以措辞必须说清补救动作（补件或重跑出图）。
    warns.push('缺 editor.manifest.json（出图时没加 --with-editor）——pack.mjs 会退回默认 root `.p-page` 并报「找不到根节点」；补件：node script/editor-prep.mjs <交付目录>，或重跑 render 加 --with-editor');
  }

  // fields.json：键必须等于图层 id。对不上不会报错——pageApp 读到这份初稿时静默取不到值。
  const fieldsFile = path.join(dir, 'fields.json');
  if (fs.existsSync(fieldsFile)) {
    let fields;
    try {
      fields = JSON.parse(fs.readFileSync(fieldsFile, 'utf8'));
    } catch (e) {
      errors.push(`fields.json 不是合法 JSON：${e.message}`);
    }
    for (const page of fields && Array.isArray(fields.pages) ? fields.pages : []) {
      const nn = String(page.id || '').replace(/^p/i, '');
      const file = files.find((f) => f.startsWith(`P${nn}-`));
      if (!file) { warns.push(`fields.json 有页 p${nn}，但目录里没有对应的 P${nn}-*.html`); continue; }
      const pageIds = ids.get(file);
      const bad = Object.keys(page.fields || {}).filter((k) => !pageIds.has(k));
      if (bad.length) errors.push(`fields.json · ${file}: 键 ${bad.slice(0, 6).join(', ')}${bad.length > 6 ? ' …' : ''} 在页内没有对应图层`);
    }
  }

  // 打包产物是否过期：covers-edit.html 里塞的是当时那版页面的 HTML，重跑 render 之后它不会自己更新。
  // 留 2 秒容差：整目录拷贝（cp -r / 解压）会把 mtime 刷成同一时刻，毫秒级比较会误报「过期」。
  const SKEW_MS = 2000;
  const packed = path.join(dir, 'covers-edit.html');
  if (fs.existsSync(packed)) {
    const packedAt = fs.statSync(packed).mtimeMs;
    const newer = files.filter((f) => fs.statSync(path.join(dir, f)).mtimeMs > packedAt + SKEW_MS);
    if (newer.length) warns.push(`covers-edit.html 早于 ${newer.join(' / ')}——页已经改过，需重跑打包器再打开编辑器`);
  }

  const layerCount = [...ids.values()].reduce((n, s) => n + s.size, 0);
  return { files, pages, ids, layerCount, errors, warns };
}
