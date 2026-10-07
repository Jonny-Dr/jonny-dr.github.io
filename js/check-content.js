const fs = require('fs');
const path = require('path');
const MarkdownParser = require('./markdown-parser');

const ROOT = path.join(__dirname, '..');
const categories = ['ai', 'archives', 'daily', 'project', 'skill'];
const errors = [];
const warnings = [];
const markdownFiles = [];

function walk(dir) {
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
        const fullPath = path.join(dir, entry.name);
        return entry.isDirectory() ? walk(fullPath) : [fullPath];
    });
}

function validDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

for (const category of categories) {
    const mdDir = path.join(ROOT, 'posts', category, 'md');
    for (const file of walk(mdDir).filter(file => file.endsWith('.md'))) {
        markdownFiles.push(file);
        const relative = path.relative(ROOT, file);
        const content = fs.readFileSync(file, 'utf8');
        const startsWithFrontMatter = /^---\r?\n/.test(content);
        if (!startsWithFrontMatter) continue; // Legacy posts without metadata remain supported.
        if (!/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/.test(content)) {
            errors.push(`${relative}: Front Matter 开始标记没有对应的结束标记`);
            continue;
        }

        const block = content.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)[1];
        for (const [index, line] of block.split(/\r?\n/).entries()) {
            if (!line.trim() || /^\s*#/.test(line) || /^\s+-\s+/.test(line)) continue;
            if (!/^[\w-]+:\s*(?:.*)$/.test(line)) errors.push(`${relative}:${index + 2}: 无法识别的 Front Matter 字段行`);
        }
        let meta;
        try { meta = MarkdownParser.extractFrontMatter(content); }
        catch (error) { errors.push(`${relative}: ${error.message}`); continue; }
        if (Object.hasOwn(meta, 'date') && meta.date && !validDate(String(meta.date))) {
            errors.push(`${relative}: date 必须是有效的 YYYY-MM-DD 日期（当前：${meta.date}）`);
        }
        for (const key of ['categories', 'languages', 'tags']) {
            if (Object.hasOwn(meta, key) && !Array.isArray(meta[key])) errors.push(`${relative}: ${key} 必须使用数组格式`);
        }
        if (Object.hasOwn(meta, 'title') && !String(meta.title).trim()) errors.push(`${relative}: title 不能为空`);
    }
}

const generatedCheck = process.argv.includes('--check-generated');
if (generatedCheck) {
    const sourceSet = new Set(markdownFiles.map(file => path.relative(ROOT, file).replace(/\/md\//, '/html/').replace(/\.md$/, '.html')));
    for (const category of categories) {
        const htmlDir = path.join(ROOT, 'posts', category, 'html');
        for (const file of walk(htmlDir).filter(file => file.endsWith('.html'))) {
            const relative = path.relative(ROOT, file);
            if (!sourceSet.has(relative)) warnings.push(`${relative}: 找不到对应的 Markdown 源文件（可能是遗留生成页）`);
        }
    }

    const pageSizes = { ai: 6, daily: 4, project: 6, skill: 6 };
    for (const [category, pageSize] of Object.entries(pageSizes)) {
        const count = markdownFiles.filter(file => file.includes(`${path.sep}${category}${path.sep}md${path.sep}`)).length;
        const expectedPages = Math.max(1, Math.ceil(count / pageSize));
        const pageDir = path.join(ROOT, 'html', category);
        for (const file of walk(pageDir).filter(file => path.basename(file).match(new RegExp(`^${category}(?:-\\d+)?\\.html$`)))) {
            const match = path.basename(file).match(new RegExp(`^${category}(?:-(\\d+))?\\.html$`));
            const pageNumber = match[1] ? Number(match[1]) : 1;
            if (pageNumber > expectedPages) warnings.push(`${path.relative(ROOT, file)}: 超出当前文章数量对应的分页范围（可能是遗留分页）`);
        }
    }

    const htmlFiles = walk(ROOT).filter(file => file.endsWith('.html') && !file.includes(`${path.sep}.git${path.sep}`) && !file.includes(`${path.sep}node_modules${path.sep}`));
    for (const file of htmlFiles) {
        const html = fs.readFileSync(file, 'utf8');
        const attrs = /\b(?:href|src)\s*=\s*(["'])(.*?)\1/gi;
        let match;
        while ((match = attrs.exec(html))) {
            const raw = match[2].trim();
            if (!raw || /^(?:https?:|mailto:|tel:|javascript:|data:|#|\/\/)/i.test(raw) || raw.includes('{{')) continue;
            let pathname;
            try { pathname = decodeURIComponent(raw.split(/[?#]/, 1)[0]); }
            catch { errors.push(`${path.relative(ROOT, file)}: 本地引用包含无效的 URL 编码：${raw}`); continue; }
            if (!pathname) continue;
            const target = pathname.startsWith('/')
                ? path.resolve(ROOT, `.${path.posix.normalize(pathname)}`)
                : path.resolve(path.dirname(file), pathname);
            if (!target.startsWith(ROOT + path.sep) && target !== ROOT) continue;
            if (!fs.existsSync(target)) errors.push(`${path.relative(ROOT, file)}: 本地引用不存在：${raw}`);
        }
    }
}

for (const warning of warnings) console.warn(`⚠ ${warning}`);
if (errors.length) {
    for (const error of errors) console.error(`✗ ${error}`);
    console.error(`内容检查失败：${errors.length} 个错误${warnings.length ? `，${warnings.length} 个提示` : ''}`);
    process.exit(1);
}
console.log(`内容检查通过：扫描 ${markdownFiles.length} 篇 Markdown${generatedCheck ? ' 和生成页面引用' : ''}${warnings.length ? `；发现 ${warnings.length} 个遗留页面提示` : ''}。`);
