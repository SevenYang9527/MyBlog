// 把 inject-figures.js 注入的 <img> 摘掉，回到纯占位状态（重新抽图后可以再注入）
const fs = require('fs');
const path = require('path');

const SLUGS = ['modular-so', 'urp', 'gpp', 'profiling', 'mobile-perf'];
const RE = /<img src="\.\.\/assets\/figures\/[^"]*" alt="[^"]*" loading="lazy" decoding="async">/g;

let changed = 0;
for (const slug of SLUGS) {
  const dir = path.join(__dirname, '..', 'books', 'src', slug, 'ch');
  if (!fs.existsSync(dir)) continue;
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith('.html')) continue;
    const p = path.join(dir, f);
    const html = fs.readFileSync(p, 'utf8');
    const next = html.replace(RE, '');
    if (next !== html) {
      fs.writeFileSync(p, next, 'utf8');
      changed += 1;
    }
  }
}
console.log(`清理 ${changed} 个文件`);
