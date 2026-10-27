// 把 books/src/<slug>/ 里的译文/考据片段构建成静态子站，输出到本站 source/books/ 下
// 用法: node tools/build-books.js [slug]
// 之后: npx hexo clean && npx hexo generate
const fs = require('fs');
const path = require('path');

const siteRoot = path.join(__dirname, '..');
const srcRoot = path.join(siteRoot, 'books', 'src');
const outRoot = path.join(siteRoot, 'source', 'books');
const themeDir = path.join(siteRoot, 'books', 'theme');
const HUB = '../../series/';

function esc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// 官方电子书与“技术讲义考据”共用一套构建器，只替换少量称谓。
function labels(book) {
  const notes = book.kind === 'notes';
  return {
    kicker: book.kicker || (notes ? '技术讲义 · 逐条考据' : 'UNITY 官方电子书 · 中文译文'),
    foot: book.foot_note || (notes ? '技术讲义 · 逐条考据' : 'Unity 官方电子书 · 中文译文'),
    pageLabel: book.source_pages_label || (notes ? '原讲义页数' : '原书页数'),
    sourceLine:
      book.source_line ||
      `${notes ? '原讲义' : '原书'} ${book.pages} 页 · 共 ${book.chapters.length} 章`,
    bookLabel: book.book_label || (notes ? '讲义' : '书籍'),
    partLabel: book.part_label || (notes ? '已整理片段' : '已译片段')
  };
}

// 给表格套一层横向滚动容器，窄屏下不撑破正文
function wrapTables(html) {
  return html.replace(/<table(\s[^>]*)?>[\s\S]*?<\/table>/g, (m) => `<div class="table-wrap">${m}</div>`);
}

function copyTheme() {
  const dir = path.join(outRoot, 'assets');
  fs.mkdirSync(dir, { recursive: true });
  for (const f of ['book.css', 'book.js']) {
    fs.copyFileSync(path.join(themeDir, f), path.join(dir, f));
  }
}

// 把 books/img/<slug>/*.webp 复制成 source/books/assets/figures/<slug>/
function copyFigures(slug) {
  const src = path.join(siteRoot, 'books', 'img', slug);
  const dst = path.join(outRoot, 'assets', 'figures', slug);
  if (!fs.existsSync(src)) return 0;
  fs.rmSync(dst, { recursive: true, force: true });
  fs.mkdirSync(dst, { recursive: true });
  let n = 0;
  for (const f of fs.readdirSync(src)) {
    if (!f.endsWith('.webp')) continue;
    fs.copyFileSync(path.join(src, f), path.join(dst, f));
    n += 1;
  }
  return n;
}

function shell(opts) {
  const { book, title, sidebar, body, pager, isIndex } = opts;
  const L = labels(book);
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(book.subtitle_zh)}">
<link rel="stylesheet" href="../assets/book.css">
</head>
<body>
<a class="hub-bar" href="${HUB}">← 回到知识站</a>
<div class="layout">
  <aside class="sidebar">
    <div class="book-name">${esc(book.title_zh)}</div>
    <div class="book-en">${esc(book.title_en)}</div>
    <nav>
      <div class="nav-title">目录</div>
      <ol>
        <li><a href="index.html">封面与目录</a></li>
${sidebar}
      </ol>
    </nav>
    <div class="side-foot">
      ${esc(L.foot)}<br>
      ${esc(L.sourceLine)}
      <button class="theme-btn" type="button">☾ 深色模式</button>
    </div>
  </aside>
  <div class="main">
    <div class="progress"><span></span></div>
    ${isIndex ? '' : pager}
    ${body}
  </div>
</div>
<script src="../assets/book.js"></script>
</body>
</html>
`;
}

function build(slug) {
  const dir = path.join(srcRoot, slug);
  const meta = JSON.parse(fs.readFileSync(path.join(dir, 'meta.json'), 'utf8'));
  const outDir = path.join(outRoot, slug);
  fs.mkdirSync(outDir, { recursive: true });

  // 展平章节（长章节被拆成 1/2 两段）
  const units = [];
  for (const ch of meta.chapters) {
    for (const part of ch.parts) {
      const file = path.join(dir, 'ch', part.id + '.html');
      units.push({ ...part, ch, file, ready: fs.existsSync(file) });
    }
  }
  const ready = units.filter((u) => u.ready);
  if (!ready.length) {
    console.log(`[${slug}] 还没有任何片段，跳过`);
    return { slug, units: units.length, built: 0 };
  }

  meta.pages = meta.book_pages || '';
  const L = labels(meta);

  const sidebarFor = (currentId) =>
    units
      .map((u) => {
        const label = u.ch.parts.length > 1 ? u.title_zh : u.ch.title_zh;
        const cls = u.ready ? '' : ' class="pending"';
        return `      <li><a href="ch-${u.id}.html"${cls}>${esc(label)}</a></li>`;
      })
      .join('\n');

  // 封面页
  const tocRows = meta.chapters
    .map((ch) => {
      const first = ch.parts.find((p) => fs.existsSync(path.join(dir, 'ch', p.id + '.html')));
      if (!first) return '';
      return `      <li><a href="ch-${first.id}.html"><span class="no">${String(ch.no).padStart(2, '0')}</span><span class="tt">${esc(
        ch.title_zh
      )}<span class="en">${esc(ch.title_en)}</span></span><span class="pg">p.${esc(ch.pages)}</span></a></li>`;
    })
    .filter(Boolean)
    .join('\n');

  const coverBody = `  <div class="cover">
    <div class="kicker">${esc(L.kicker)}</div>
    <h1>${esc(meta.title_zh)}</h1>
    <div class="en">${esc(meta.title_en)}</div>
    <div class="sub">${esc(meta.subtitle_zh)}</div>
    <div class="stats">
      <div><b>${meta.chapters.length}</b><span>章</span></div>
      <div><b>${esc(meta.book_pages || '-')}</b><span>${esc(L.pageLabel)}</span></div>
      <div><b>${ready.length}</b><span>${esc(L.partLabel)}</span></div>
    </div>
  </div>
  <div class="toc">
    <h2>目录</h2>
    <ol>
${tocRows}
    </ol>
  </div>`;

  fs.writeFileSync(
    path.join(outDir, 'index.html'),
    shell({ book: meta, title: meta.title_zh + ' · ' + L.bookLabel, sidebar: sidebarFor(null), body: coverBody, isIndex: true }),
    'utf8'
  );

  // 章节页
  const order = units.map((u) => u.id);
  for (const u of ready) {
    const idx = order.indexOf(u.id);
    const prev = units[idx - 1];
    const next = units[idx + 1];
    const pager = `  <div class="topbar">
    <div class="chapter-no">${String(u.ch.no).padStart(2, '0')} · ${esc(u.ch.title_zh)}</div>
    <div class="pager">${prev && prev.ready ? `<a href="ch-${prev.id}.html">← 上一节</a>` : ''}${
      next && next.ready ? `<a href="ch-${next.id}.html">下一节 →</a>` : ''
    }</div>
  </div>`;
    const content = wrapTables(fs.readFileSync(u.file, 'utf8'));
    const body = `  <article class="content">
${content}
  </article>
  <div class="prevnext">
    ${prev && prev.ready ? `<a href="ch-${prev.id}.html"><span class="dir">← 上一节</span>${esc(prev.title_zh)}</a>` : '<span class="empty"></span>'}
    ${next && next.ready ? `<a href="ch-${next.id}.html"><span class="dir">下一节 →</span>${esc(next.title_zh)}</a>` : '<span class="empty"></span>'}
  </div>`;
    fs.writeFileSync(
      path.join(outDir, `ch-${u.id}.html`),
      shell({ book: meta, title: `${u.title_zh} · ${meta.title_zh}`, sidebar: sidebarFor(u.id), body, pager, isIndex: false }),
      'utf8'
    );
  }

  const figures = copyFigures(slug);
  console.log(`[${slug}] 构建 ${ready.length}/${units.length} 个片段 -> ${path.relative(siteRoot, outDir)}${figures ? `（插图 ${figures} 张）` : ''}`);
  return { slug, units: units.length, built: ready.length };
}

copyTheme();
const only = process.argv[2];
const slugs = only
  ? [only]
  : fs
      .readdirSync(srcRoot)
      .filter((d) => fs.existsSync(path.join(srcRoot, d, 'meta.json')));
let total = 0;
let done = 0;
for (const s of slugs) {
  const r = build(s);
  total += r.units;
  done += r.built;
}
console.log(`合计 ${done}/${total} 个片段`);
