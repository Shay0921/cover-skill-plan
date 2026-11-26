// 图片校验的唯一实现：路径边界 → 存在性 → 扩展名白名单 → 魔数交叉校验。
// 母版槽位（render 的 imgValue）、custom 页内联（render 的 inlineCustomImages）、
// 静态单跑（composed.mjs 的 checkImgTags）都调这里。三个入口共用一份，
// 否则「单跑绿、出图红」会以图片这一项重新长回来。
import fs from 'node:fs';
import path from 'node:path';

const IMAGE_MIME = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
};

// 魔数嗅探：读文件头判真实格式，与扩展名声明的 MIME 交叉校验。
// GIF 伪装成白名单后缀（如改名 .png）会在此被拦——浏览器虽按内容解码能显示，
// 但编辑器 pack.mjs 嗅探内容后整批拒绝。
// AVIF/HEIC 也识别：它们不在白名单里，识别出来只为把「无法识别」升级成确切格式名。
// 典型场景：素材扩展名是 .png、内容实际是 AVIF——不认出来时只能报「无法识别」，认出来才能直接说「转码」。
export function sniffMime(buf) {
  if (buf.length >= 8 && buf.toString('hex', 0, 8) === '89504e470d0a1a0a') return 'image/png';
  if (buf.length >= 3 && buf.toString('hex', 0, 3) === 'ffd8ff') return 'image/jpeg';
  if (buf.length >= 12 && buf.toString('latin1', 0, 4) === 'RIFF' && buf.toString('latin1', 8, 12) === 'WEBP') return 'image/webp';
  if (buf.length >= 4 && buf.toString('latin1', 0, 4) === 'GIF8') return 'image/gif';
  // ISO-BMFF（ftyp）容器：AVIF / HEIC 共用同一段文件头，靠 major brand 区分
  if (buf.length >= 12 && buf.toString('latin1', 4, 8) === 'ftyp') {
    const brand = buf.toString('latin1', 8, 12);
    if (brand === 'avif' || brand === 'avis') return 'image/avif';
    if (['heic', 'heix', 'hevc', 'hevx'].includes(brand)) return 'image/heic';
    // mif1/msf1 是通用容器：AVIF 常把它当 major brand、再在 compatible brands 里声明 avif
    if (brand === 'mif1' || brand === 'msf1') {
      return buf.toString('latin1').includes('avif') ? 'image/avif' : 'image/heif';
    }
  }
  return null;
}

// 图片路径边界校验：src 必须解析在任务工作区内。
// 绝对路径与 ../ 逃逸会把本机任意文件复制进交付 assets/（数据外泄面），入口即拦；
// Windows 盘符差异由 path.relative 天然兼容。越界只认 `..` 本身或 `../` 开头——
// 用 startsWith('..') 会误拦 `..foo.png` / `...png` 这类合法文件名。
export function resolveInDir(src, baseDir, where = '', errors = null) {
  const file = path.resolve(baseDir, src);
  const relToBase = path.relative(baseDir, file);
  if (relToBase === '..' || relToBase.startsWith(`..${path.sep}`) || path.isAbsolute(relToBase)) {
    if (errors) errors.push(`${where}: 图片路径须在任务工作区内（写相对路径，如 shots/a.png）: ${src}`);
    return null;
  }
  return file;
}

// 读图并校验。dataUrl=false 时只验不编码（静态校验不需要 base64，省内存）。
// 返回 { file, buf, mime, dataUrl } 或 null（错误已写进 errors）。
export function readImage(src, baseDir, where = '', errors = [], { dataUrl = true } = {}) {
  const file = resolveInDir(src, baseDir, where, errors);
  if (!file) return null;
  if (!fs.existsSync(file)) { errors.push(`${where}: 图片不存在 ${src}`); return null; }
  const ext = path.extname(file).toLowerCase();
  if (!IMAGE_MIME[ext]) {
    errors.push(`${where}: 图片格式不符（仅 PNG/JPEG/WebP）${src}；请转为 PNG/JPEG/WebP 后重试`);
    return null;
  }
  const buf = fs.readFileSync(file);
  const actual = sniffMime(buf);
  if (actual !== IMAGE_MIME[ext]) {
    errors.push(`${where}: 图片扩展名与内容不符 ${src}（扩展名声明 ${IMAGE_MIME[ext]}，实际内容${actual ? ' ' + actual : '无法识别'}）；请转为 PNG/JPEG/WebP 后重试`);
    return null;
  }
  return {
    file,
    buf,
    mime: IMAGE_MIME[ext],
    dataUrl: dataUrl ? `data:${IMAGE_MIME[ext]};base64,${buf.toString('base64')}` : null,
  };
}

// 静态校验 markup 里的 <img>：无 src / 空 src / 外链 / 文件不存在 / 格式不符。
// 传进来的 markup 必须已用 splitStyleBlocks 剥掉 <style>——注释里举例的 <img> 不是真图。
export function checkImgTags(markup, baseDir, label, errors, warns) {
  for (const m0 of markup.matchAll(/<img\b[^>]*>/gi)) {
    const tag = m0[0];
    // 与 render 口径一致：交付只改写 src，srcset 的多倍图不会被处理，直接拦。
    if (/\bsrcset\s*=/i.test(tag)) {
      errors.push(`${label}<img> 不支持 srcset——交付只改写 src，srcset 的多倍图不会被处理；删掉 srcset 只留 src`);
    }
    const m = tag.match(/\bsrc\s*=\s*(["'])([^"']*)\1/i);
    if (!m) {
      errors.push(`${label}<img> 缺 src——图槽没有「可省」机制，写了就必须给图；不要图就删掉整个 img 节点`);
      continue;
    }
    const src = m[2].trim();
    if (!src) {
      errors.push(`${label}<img> 的 src 为空——填相对任务工作区的图片路径，或删掉整个 img 节点`);
      continue;
    }
    if (/^data:/i.test(src)) {
      warns.push(`${label}<img src="data:…"> 已内嵌——机器无法校验其格式，建议改相对路径让工具链统一转码、校验并复制进 assets/`);
      continue;
    }
    if (/^(?:https?:)?\/\//i.test(src)) {
      errors.push(`${label}<img> 不接受外链 ${src}——把图存到任务工作区再写相对路径`);
      continue;
    }
    readImage(src, baseDir, `${label}<img>`, errors, { dataUrl: false });
  }
}
