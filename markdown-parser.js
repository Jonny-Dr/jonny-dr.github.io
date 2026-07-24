const fs = require('fs');
const path = require('path');
const { marked } = require('marked');

marked.setOptions({
    gfm: true,
    breaks: true,
    headerIds: true,
    mangle: false,
    sanitize: false
});

class MarkdownParser {
    static parseMarkdown(filePath) {
        const content = fs.readFileSync(filePath, 'utf8');

        const frontMatter = this.extractFrontMatter(content);

        const cleanContent = content.replace(/^---[\s\S]*?---/m, '').trim();

        let title = frontMatter.title;
        if (!title) {
            const hashTitleMatch = content.match(/^#\s+(.*)$/m);
            if (hashTitleMatch) {
                title = hashTitleMatch[1];
            } else {
                const fileName = path.basename(filePath, '.md');
                title = fileName.replace(/-/g, ' ');
            }
        }
        if (!title) {
            title = '无标题';
        }

        let date = frontMatter.date || '';
        if (!date) {
            const dateMatch = content.match(/^date:\s+(\d{4}-\d{2}-\d{2})$/m);
            if (dateMatch) {
                date = dateMatch[1];
            } else {
                const fileName = path.basename(filePath, '.md');
                const dateMatchFromFile = fileName.match(/^(\d{4}-\d{2}-\d{2})/);
                if (dateMatchFromFile) {
                    date = dateMatchFromFile[1];
                } else {
                    const now = new Date();
                    date = now.toISOString().split('T')[0];
                }
            }
        }

        let categories = frontMatter.categories || [];
        if (!categories.length) {
            const categoryMatch = content.match(/^categories:\s+\[(.*?)\]$/m);
            if (categoryMatch) {
                categories = categoryMatch[1].split(',').map(cat => cat.trim().replace(/['"]/g, ''));
            }
        }

        let languages = frontMatter.languages || [];
        if (!languages.length) {
            const languageMatch = content.match(/^languages:\s+\[(.*?)\]$/m);
            if (languageMatch) {
                languages = languageMatch[1].split(',').map(lang => lang.trim().replace(/['"]/g, ''));
            }
        }

        let originalLink = frontMatter.originalLink || '';
        if (!originalLink) {
            const linkMatch = content.match(/^originalLink:\s+([^\n]+)$/m);
            if (linkMatch) {
                originalLink = linkMatch[1].trim();
            }
        }

        let excerpt = frontMatter.excerpt || '';
        if (!excerpt) {
            const yamlContentMatch = content.match(/^---[\s\S]*?---[\s\S]*?(?=^##|$)/m);
            if (yamlContentMatch) {
                excerpt = yamlContentMatch[0].replace(/^---[\s\S]*?---/m, '').trim();
            }

            if (!excerpt) {
                const plainText = this.stripMarkdown(cleanContent).substring(0, 100);
                excerpt = plainText + (plainText.length > 100 ? '...' : '');
            }
        }

        return {
            title,
            date,
            categories,
            languages,
            originalLink,
            excerpt,
            content: cleanContent,
            frontMatter
        };
    }

    static extractFrontMatter(content) {
        const frontMatterMatch = content.match(/^---[\s\S]*?---/m);
        if (!frontMatterMatch) {
            return {};
        }

        const frontMatterText = frontMatterMatch[0].replace(/^---|---$/g, '').trim();
        const frontMatter = {};

        const lines = frontMatterText.split('\n');
        lines.forEach(line => {
            const match = line.match(/^\s*(\w+):\s*(.*)$/);
            if (match) {
                const [, key, value] = match;
                if (value.startsWith('[') && value.endsWith(']')) {
                    frontMatter[key] = value
                        .substring(1, value.length - 1)
                        .split(',')
                        .map(item => item.trim().replace(/['"]/g, ''));
                } else {
                    frontMatter[key] = value.trim().replace(/['"]/g, '');
                }
            }
        });

        return frontMatter;
    }

    static markdownToHtml(markdown, basePath = '', markdownPath = '', htmlPath = '') {
        let html = marked.parse(markdown);

        if (markdownPath && htmlPath) {
            const mdDir = path.dirname(markdownPath);
            const htmlDir = path.dirname(htmlPath);
            const relativePath = path.relative(htmlDir, mdDir).replace(/\\/g, '/') || '.';

            html = html.replace(/<img([^>]+)src="assets\/([^"]+)"([^>]*)>/g, (match, before, fileName, after) => {
                return `<img${before}src="${relativePath}/assets/${fileName}"${after}>`;
            });

            html = html.replace(/<img([^>]+)src="([^"]+)"([^>]*)>/g, (match, before, imgPath, after) => {
                if (!imgPath.startsWith('http') && !imgPath.startsWith('https') && !imgPath.startsWith('/')) {
                    return `<img${before}src="${basePath}/${imgPath}"${after}>`;
                }
                return match;
            });
        }

        html = html.replace(/<img([^>]+)src="([^"]+)"([^>]*)>/g, (match, before, imgPath, after) => {
            if (imgPath.startsWith('/Users/') || imgPath.startsWith('/home/') || 
                imgPath.startsWith('C:\\') || imgPath.startsWith('D:\\')) {
                const fileName = imgPath.split('/').pop().split('\\').pop();
                return `<div class="image-placeholder" style="padding: 2rem; background: var(--card-bg); border: 2px dashed var(--border); border-radius: 8px; text-align: center; color: #888; margin: 1rem 0;">\n                    <div style="font-size: 2rem; margin-bottom: 0.5rem;">🖼️</div>\n                    <div>图片: ${fileName}</div>\n                    <div style="font-size: 0.85rem; margin-top: 0.5rem;">(本地路径图片无法显示)</div>\n                </div>`;
            }
            return match;
        });

        html = html.replace(/<pre><code>/g, '<pre><code class="language-plaintext">');
        html = html.replace(/<table>/g, '<table class="markdown-table">');
        html = html.replace(/<blockquote>/g, '<blockquote class="markdown-blockquote">');
        html = html.replace(/<hr>/g, '<hr class="markdown-hr">');
        html = html.replace(/<ul>/g, '<ul class="markdown-list">');
        html = html.replace(/<ol>/g, '<ol class="markdown-ordered-list">');

        html = html.replace(/\n{3,}/g, '\n\n');

        return html;
    }

    static escapeHtml(text) {
        if (typeof text !== 'string') text = String(text);
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    static stripMarkdown(markdown) {
        let text = markdown.replace(/```[\s\S]*?```/g, '');
        text = text.replace(/`[^`]+`/g, '');
        text = text.replace(/!\[[^\]]*\]\([^)]+\)/g, '');
        text = text.replace(/\[[^\]]*\]\([^)]+\)/g, '$1');
        text = text.replace(/^#\s+/gm, '');
        text = text.replace(/\*\*|\*/g, '');
        text = text.replace(/^-\s+|^\d+\.\s+/gm, '');
        text = text.replace(/\n{2,}/g, '\n');

        return text.trim();
    }

    static generateHtmlFromMarkdown(markdownPath, htmlPath, options = {}) {
        const parsed = this.parseMarkdown(markdownPath);
        const { title, date, categories, languages, originalLink, content } = parsed;

        const htmlDir = path.dirname(htmlPath);
        const projectRoot = __dirname;
        const basePath = path.relative(htmlDir, projectRoot).replace(/\\/g, '/') || '.';

        const htmlContent = this.markdownToHtml(content, basePath, markdownPath, htmlPath);

        const navTemplate = options.navTemplate || this.getDefaultNavTemplate();
        const relativeNav = navTemplate.replace(/href="([^"]+)"/g, (match, href) => {
            if (href.startsWith('http')) {
                return match;
            }
            const relativePath = path.relative(path.dirname(htmlPath), path.dirname(href)).replace(/\\/g, '/') || '.';
            return `href="${relativePath}/${path.basename(href)}"`;
        });

        let tagsHtml = '';
        if (categories.length > 0 || languages.length > 0) {
            tagsHtml = `
        <div class="post-tags">
          ${categories.map(cat => `<span class="post-tag category">${cat}</span>`).join(' ')}
          ${languages.map(lang => `<span class="post-tag language">${lang}</span>`).join(' ')}
        </div>`;
        }

        let originalLinkHtml = '';
        if (originalLink) {
            originalLinkHtml = `
        <div class="post-original-link">
          <strong>原文链接：</strong><a href="${originalLink}" target="_blank" rel="noopener">${originalLink}</a>
        </div>`;
        }

        const htmlTemplate = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} | 北辰</title>
  <link rel="stylesheet" href="${basePath}/css/common.css">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.7.0/styles/github.min.css">
  <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.7.0/highlight.min.js"></script>
  <script>hljs.highlightAll();</script>
  <style>
    .post-content {
      max-width: 800px;
      margin: 0 auto;
      line-height: 1.8;
    }
    .post-header {
      margin-bottom: 2rem;
      padding-bottom: 1rem;
      border-bottom: 1px solid var(--border);
    }
    .post-header h1 {
      font-size: 2.2rem;
      margin-bottom: 1rem;
      color: var(--primary);
    }
    .post-meta {
      color: #888;
      font-size: 0.95rem;
      margin-bottom: 1rem;
    }
    .post-tags {
      display: flex;
      flex-wrap: wrap;
      gap: 0.8rem;
      margin-bottom: 1rem;
    }
    .post-tag {
      background: rgba(67, 97, 238, 0.1);
      color: var(--primary);
      padding: 0.5rem 1rem;
      border-radius: 15px;
      font-size: 0.9rem;
      font-weight: 600;
    }
    .post-tag.category {
      background: rgba(72, 187, 120, 0.1);
      color: #48bb78;
    }
    .post-tag.language {
      background: rgba(237, 137, 54, 0.1);
      color: #ed8936;
    }
    .post-body {
      margin-bottom: 2rem;
    }
    .post-body h2 {
      font-size: 1.8rem;
      margin: 2rem 0 1rem;
      color: var(--primary);
      padding-bottom: 0.5rem;
      border-bottom: 1px solid var(--border);
    }
    .post-body h3 {
      font-size: 1.4rem;
      margin: 1.5rem 0 0.8rem;
      color: var(--primary);
    }
    .post-body h4 {
      font-size: 1.2rem;
      margin: 1.2rem 0 0.6rem;
      color: var(--primary);
    }
    .post-body h5 {
      font-size: 1.1rem;
      margin: 1rem 0 0.5rem;
      color: var(--text);
    }
    .post-body p {
      margin-bottom: 1.2rem;
    }
    .post-body a {
      color: var(--primary);
      text-decoration: none;
    }
    .post-body a:hover {
      text-decoration: underline;
    }
    .post-body ul,
    .post-body ol {
      margin: 1rem 0 1.5rem 1.5rem;
    }
    .post-body li {
      margin-bottom: 0.5rem;
    }
    .post-body pre {
      background: #f8f9fa;
      color: #333333;
      padding: 1.5rem;
      border-radius: 8px;
      overflow-x: auto;
      margin: 1.5rem 0;
      border: 1px solid var(--border);
    }
    .post-body code {
      font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
      font-size: 0.9rem;
    }
    .post-body pre code {
      background: none;
      padding: 0;
    }
    [data-theme="dark"] .post-body pre {
      background: #1e1e1e;
      color: #e6e6e6;
    }
    [data-theme="dark"] .post-body code {
      color: #e6e6e6;
    }
    .post-body img {
      max-width: 100%;
      height: auto;
      border-radius: 8px;
      margin: 1.5rem 0;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }
    .post-original-link {
      margin-top: 2rem;
      padding-top: 1rem;
      border-top: 1px dashed var(--border);
      color: #6c757d;
    }
    .post-original-link a {
      color: var(--primary);
      text-decoration: none;
    }
    .post-original-link a:hover {
      text-decoration: underline;
    }
    .post-body table.markdown-table {
      width: 100%;
      border-collapse: collapse;
      margin: 1.5rem 0;
      font-size: 0.95rem;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      border-radius: 8px;
      overflow: hidden;
    }
    .post-body table.markdown-table thead {
      background: linear-gradient(135deg, var(--primary), #3a0ca3);
      color: white;
    }
    .post-body table.markdown-table th {
      padding: 1rem;
      text-align: left;
      font-weight: 600;
      border: none;
    }
    .post-body table.markdown-table td {
      padding: 0.8rem 1rem;
      border-bottom: 1px solid var(--border);
      border-right: 1px solid var(--border);
    }
    .post-body table.markdown-table td:last-child {
      border-right: none;
    }
    .post-body table.markdown-table tbody tr:nth-child(even) {
      background: rgba(67, 97, 238, 0.03);
    }
    .post-body table.markdown-table tbody tr:hover {
      background: rgba(67, 97, 238, 0.08);
    }
    [data-theme="dark"] .post-body table.markdown-table {
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
    }
    [data-theme="dark"] .post-body table.markdown-table tbody tr:nth-child(even) {
      background: rgba(255, 255, 255, 0.03);
    }
    [data-theme="dark"] .post-body table.markdown-table tbody tr:hover {
      background: rgba(255, 255, 255, 0.06);
    }
    .post-body blockquote.markdown-blockquote {
      border-left: 4px solid var(--primary);
      padding: 1rem 1.5rem;
      margin: 1.5rem 0;
      background: rgba(67, 97, 238, 0.05);
      border-radius: 0 8px 8px 0;
      font-style: italic;
      color: #666;
    }
    [data-theme="dark"] .post-body blockquote.markdown-blockquote {
      background: rgba(255, 255, 255, 0.05);
      color: #aaa;
    }
    .post-body hr.markdown-hr {
      border: none;
      height: 2px;
      background: linear-gradient(to right, transparent, var(--border), transparent);
      margin: 2rem 0;
    }
    .post-body li.task-list-item {
      list-style: none;
      margin-left: -1.5rem;
    }
    .post-body li.task-list-item input[type="checkbox"] {
      margin-right: 0.5rem;
      cursor: default;
    }
    .post-body .image-placeholder {
      transition: var(--transition);
    }
    .post-body .image-placeholder:hover {
      border-color: var(--primary) !important;
      background: rgba(67, 97, 238, 0.05) !important;
    }
    @media (max-width: 768px) {
      .post-content {
        padding: 0 1rem;
      }
      .post-header h1 {
        font-size: 1.8rem;
      }
      .post-tags {
        gap: 0.5rem;
      }
      .post-tag {
        padding: 0.4rem 0.8rem;
        font-size: 0.8rem;
      }
      .post-body pre {
        padding: 1rem;
      }
      .post-body table.markdown-table {
        font-size: 0.85rem;
      }
      .post-body table.markdown-table th,
      .post-body table.markdown-table td {
        padding: 0.6rem 0.8rem;
      }
    }
  </style>
</head>
<body>
  <button class="theme-toggle" id="themeToggle" aria-label="切换主题">
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
    </svg>
  </button>

  <button class="music-toggle" id="musicToggle" aria-label="控制音乐">
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg>
  </button>

  <header>
    <h1>🌱 北辰的博客</h1>
    <p class="subtitle">记录思考，分享成长 | 一个热爱技术的探索者</p>
    ${relativeNav}
  </header>

  <main class="post-content">
    <article>
      <div class="post-header">
        <h1>${title}</h1>
        ${date ? `<div class="post-meta">发布日期：${date}</div>` : ''}
        ${tagsHtml}
        ${originalLinkHtml}
      </div>
      <div class="post-body">
        ${htmlContent}
      </div>
    </article>
    
    <div id="comments" style="max-width: 800px; margin: 3rem auto; padding: 0 1rem;">
      <div style="width: 100%; height: 1px; background: linear-gradient(to right, transparent, var(--border), transparent); margin-bottom: 2rem;"></div>
      <h3 style="margin-bottom: 1.5rem; color: var(--primary);">💬 评论区</h3>
      <script src="https://giscus.app/client.js" 
           data-repo="jonny-dr/jonny-dr.github.io" 
           data-repo-id="R_kgDORKkzfg" 
           data-category="Announcements" 
           data-category-id="DIC_kwDORKkzfs4C2Wdq" 
           data-mapping="pathname" 
           data-strict="0" 
           data-reactions-enabled="1" 
           data-emit-metadata="0" 
           data-input-position="bottom" 
           data-theme="preferred_color_scheme" 
           data-lang="zh-CN" 
           crossorigin="anonymous" 
           async> 
     </script>
    </div>
  </main>

  <footer>
    <p>© 2026 北辰 · 保持好奇，持续成长</p>
    <p style="margin-top: 6px; font-size: 0.9rem; color: #aaa;">
      本博客采用 <a href="https://creativecommons.org/licenses/by-nc/4.0/" style="color: var(--primary);">CC BY-NC 4.0</a> 许可 | 
      源码托管于 <a href="https://github.com/" style="color: var(--primary);">GitHub</a>
    </p>
  </footer>

  <button class="back-to-top" id="backToTop" aria-label="回到顶部">
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="m18 15-6-6-6 6"/>
    </svg>
  </button>

  <script src="${basePath}/js/theme.js"></script>
</body>
</html>
  `;

        if (!fs.existsSync(htmlDir)) {
            fs.mkdirSync(htmlDir, { recursive: true });
        }

        fs.writeFileSync(htmlPath, htmlTemplate);
        console.log(`Generated HTML file: ${htmlPath}`);
    }

    static getDefaultNavTemplate() {
        return `
<nav>
  <a href="index.html">首页</a>
  <a href="project.html">项目</a>
  <a href="skill.html">技术</a>
  <a href="daily.html">日常</a>
  <a href="about.html">关于</a>
  <a href="archives.html">归档</a>
  <a href="https://github.com/" target="_blank" rel="noopener">GitHub</a>
</nav>`;
    }
}

module.exports = MarkdownParser;