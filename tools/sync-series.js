// 把两个独立小站同步成知识站的"子站"（挂载到 source/ 下，随 hexo generate 一起发布）
// 用法:  node tools/sync-series.js
// 之后:  npx hexo clean && npx hexo generate
//
// 源目录不写死在代码里：
//   - 本机配置放 tools/series-sources.json（已 gitignore，不会被提交）
//   - 或者只给一个环境变量 SERIES_SOURCES='{"unity-graphics":"...","gpp-unity":"..."}'
//   - 模板见 tools/series-sources.example.json
//
// 同步时会做两件事：
//   1. 只捞发布产物（源站里的 build.js / content/ / _build/*.py 不发布）
//   2. 给每个页面注入一条「← 回到知识站」的返回条（源站文件不改，重跑也不会重复注入）
const fs = require('fs');
const path = require('path');

const siteRoot = path.join(__dirname, '..');
const CONFIG_FILE = path.join(__dirname, 'series-sources.json');

const SERIES = [
  {
    name: 'unity-graphics',
    include: (entry) => entry.isDirectory() ? entry.name === 'assets' : entry.name.endsWith('.html')
  },
  {
    name: 'gpp-unity',
    include: (entry) => ['assets', 'pattern'].includes(entry.name) || entry.name === 'index.html'
  }
];

function loadSources() {
  if (process.env.SERIES_SOURCES) {
    try {
      return JSON.parse(process.env.SERIES_SOURCES);
    } catch (e) {
      throw new Error('环境变量 SERIES_SOURCES 不是合法 JSON: ' + e.message);
    }
  }
  if (!fs.existsSync(CONFIG_FILE)) {
    throw new Error(
      '缺少 tools/series-sources.json。\n' +
      '把 tools/series-sources.example.json 复制一份、改名成 series-sources.json，\n' +
      '然后把两个子站源目录的绝对路径填进去（这个文件不会进仓库）。'
    );
  }
  try {
    return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
  } catch (e) {
    throw new Error('tools/series-sources.json 解析失败: ' + e.message);
  }
}

// 返回条：颜色用 inherit + 半透明边框，浅色/深色主题都不用改
const BACK_LINK = '<a href="%URL%" data-hub-link style="display:block;padding:7px 16px;' +
  'font:500 12px/1.5 system-ui,-apple-system,\'Segoe UI\',sans-serif;color:inherit;opacity:.72;' +
  'text-decoration:none;box-shadow:inset 0 -1px 0 rgba(128,128,128,.28)">← 回到知识站</a>';

// 页面在子站里的层级决定返回链接的相对深度
function backLinkFor(file, dest) {
  const depth = path.relative(dest, path.dirname(file)).split(path.sep).filter(Boolean).length;
  const url = '../'.repeat(depth + 1) + 'series/';
  return BACK_LINK.replace('%URL%', url);
}

function copyDir(srcDir, destDir, include) {
  fs.mkdirSync(destDir, { recursive: true });
  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    if (!include(entry)) continue;
    const from = path.join(srcDir, entry.name);
    const to = path.join(destDir, entry.name);
    if (entry.isDirectory()) copyDir(from, to, () => true);
    else fs.copyFileSync(from, to);
  }
}

function injectBackLink(file, dest) {
  const html = fs.readFileSync(file, 'utf8');
  if (html.includes('data-hub-link')) return false;
  if (!/<body[^>]*>/i.test(html)) return false;
  fs.writeFileSync(file, html.replace(/<body([^>]*)>/i, (m) => m + '\n' + backLinkFor(file, dest)), 'utf8');
  return true;
}

function walkHtml(dir, dest, fn) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walkHtml(p, dest, fn);
    else if (entry.name.endsWith('.html')) fn(p);
  }
}

const SOURCES = loadSources();

for (const item of SERIES) {
  const src = SOURCES[item.name];
  const dest = path.join(siteRoot, 'source', item.name);
  if (!src) {
    console.warn(`[skip] series-sources.json 里没有配置 ${item.name}`);
    continue;
  }
  if (!fs.existsSync(src)) {
    console.warn(`[skip] 源目录不存在: ${src}`);
    continue;
  }
  copyDir(src, dest, item.include);

  let patched = 0;
  walkHtml(dest, dest, (file) => { if (injectBackLink(file, dest)) patched += 1; });
  console.log(`[ok] ${item.name} -> source/${item.name}（注入返回条 ${patched} 页）`);
}

console.log('\n同步完成。记得改完内容在源站跑各自的 build，然后：\n  npx hexo clean && npx hexo generate');
