// 把 books/img/<slug>/ 里抽出的插图填进译文片段的 <figure> 占位里。
// 用法: node tools/inject-figures.js [--dry]
//
// 对应规则：一章内的 <figure> 按阅读顺序、插图按页码顺序排，两边数量一致就一对一；
// 插图比占位多时按比例等距取（挑组内面积最大的那张），占位比插图多时多出来的保持纯文字说明。
// 已经填过图的 <figure> 会跳过，可以反复运行。
const fs = require('fs');
const path = require('path');

const siteRoot = path.join(__dirname, '..');
const srcRoot = path.join(siteRoot, 'books', 'src');
const imgRoot = path.join(siteRoot, 'books', 'img');
const dry = process.argv.includes('--dry');

const SLUGS = ['modular-so', 'urp', 'gpp', 'profiling', 'mobile-perf'];
const FIGURE_RE = /<figure>([\s\S]*?)<\/figure>/g;

function loadIndex(slug) {
  const file = path.join(imgRoot, slug, 'index.json');
  if (!fs.existsSync(file)) return [];
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function pickImages(imgs, count) {
  if (count <= 0 || imgs.length === 0) return [];
  if (imgs.length <= count) return imgs.slice();
  // 插图比占位多：按比例等距分组，每组挑面积最大的那张（真插图通常比装饰图大）
  const out = [];
  for (let k = 0; k < count; k += 1) {
    const from = Math.floor((k * imgs.length) / count);
    let to = Math.floor(((k + 1) * imgs.length) / count);
    if (to <= from) to = from + 1;
    const group = imgs.slice(from, Math.min(to, imgs.length));
    if (!group.length) {
      out.push(imgs[Math.min(from, imgs.length - 1)]);
      continue;
    }
    group.sort((a, b) => b.w * b.h - a.w * a.h);
    out.push(group[0]);
  }
  return out;
}

let totalFilled = 0;
const report = [];

for (const slug of SLUGS) {
  const metaFile = path.join(srcRoot, slug, 'meta.json');
  if (!fs.existsSync(metaFile)) continue;
  const meta = JSON.parse(fs.readFileSync(metaFile, 'utf8'));
  const index = loadIndex(slug);

  for (const chapter of meta.chapters) {
    const [from, to] = String(chapter.pages).split('-').map(Number);
    const chapterImgs = index
      .filter((e) => e.page >= from && e.page <= to)
      .sort((a, b) => a.page - b.page || a.file.localeCompare(b.file));
    if (chapterImgs.length === 0) continue;

    // 先把这一章所有片段里的占位收集起来（按阅读顺序）
    const parts = chapter.parts.map((p) => {
      const file = path.join(srcRoot, slug, 'ch', `${p.id}.html`);
      const html = fs.readFileSync(file, 'utf8');
      const blocks = [];
      let m;
      FIGURE_RE.lastIndex = 0;
      while ((m = FIGURE_RE.exec(html)) !== null) {
        blocks.push({ start: m.index, end: m.index + m[0].length, inner: m[1], hasImg: /<img\s/.test(m[1]) });
      }
      return { id: p.id, file, html, blocks };
    });

    const totalFigures = parts.reduce((n, p) => n + p.blocks.length, 0);
    if (totalFigures === 0) continue;
    const chosen = pickImages(chapterImgs, totalFigures);

    let cursor = 0;
    let filled = 0;
    for (const part of parts) {
      if (part.blocks.length === 0) continue;
      let html = part.html;
      // 从后往前替换，避免偏移错乱
      for (let i = part.blocks.length - 1; i >= 0; i -= 1) {
        const block = part.blocks[i];
        const globalIdx = cursor + i;
        const img = chosen[globalIdx];
        if (!img || block.hasImg) continue;
        const src = `../assets/figures/${slug}/${img.file}`;
        const replacement = `<figure><img src="${src}" alt="${(block.inner.match(/<figcaption>([^<]*)/) || [, ''])[1].replace(/[<>"]/g, '')}" loading="lazy" decoding="async">${block.inner}</figure>`;
        html = html.slice(0, block.start) + replacement + html.slice(block.end);
        filled += 1;
      }
      cursor += part.blocks.length;
      if (filled > 0 && !dry) fs.writeFileSync(part.file, html, 'utf8');
    }
    totalFilled += filled;
    report.push(`  ch${chapter.no} p${chapter.pages}: 占位 ${totalFigures} / 插图 ${chapterImgs.length} -> 填入 ${filled}`);
  }
  report.push(`${slug} 完成`);
}

console.log(report.join('\n'));
console.log(`${dry ? '[dry-run] ' : ''}共填入 ${totalFilled} 张插图`);
