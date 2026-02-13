const fs = require('fs');
const path = require('path');

/**
 * Markdown解析器模块
 * 提供完整的Markdown转HTML功能，支持代码高亮、图片路径处理等
 */
class MarkdownParser {
    /**
     * 解析Markdown文件
     * @param {string} filePath - Markdown文件路径
     * @returns {Object} 解析结果，包含标题、日期、内容等信息
     */
    static parseMarkdown(filePath) {
        const content = fs.readFileSync(filePath, 'utf8');

        // 提取YAML front matter
        const frontMatter = this.extractFrontMatter(content);

        // 移除YAML front matter，只保留文章正文
        const cleanContent = content.replace(/^---[\s\S]*?---/m, '').trim();

        // 提取标题（优先使用front matter中的标题）
        let title = frontMatter.title;
        if (!title) {
            // 尝试从#开头的标题中提取
            const hashTitleMatch = content.match(/^#\s+(.*)$/m);
            if (hashTitleMatch) {
                title = hashTitleMatch[1];
            } else {
                // 如果没有提取到标题，使用文件名作为标题
                const fileName = path.basename(filePath, '.md');
                title = fileName.replace(/-/g, ' ');
            }
        }
        // 确保标题不为空
        if (!title) {
            title = '无标题';
        }

        // 提取日期（优先使用front matter中的日期）
        let date = frontMatter.date || '';
        if (!date) {
            // 尝试从date: 格式中提取
            const dateMatch = content.match(/^date:\s+(\d{4}-\d{2}-\d{2})$/m);
            if (dateMatch) {
                date = dateMatch[1];
            } else {
                // 如果没有提取到日期，从文件名中提取日期
                const fileName = path.basename(filePath, '.md');
                const dateMatchFromFile = fileName.match(/^(\d{4}-\d{2}-\d{2})/);
                if (dateMatchFromFile) {
                    date = dateMatchFromFile[1];
                }
            }
        }

        // 提取类别（优先使用front matter中的类别）
        let categories = frontMatter.categories || [];
        if (!categories.length) {
            const categoryMatch = content.match(/^categories:\s+\[(.*?)\]$/m);
            if (categoryMatch) {
                categories = categoryMatch[1].split(',').map(cat => cat.trim().replace(/['"]/g, ''));
            }
        }

        // 提取语言（优先使用front matter中的语言）
        let languages = frontMatter.languages || [];
        if (!languages.length) {
            const languageMatch = content.match(/^languages:\s+\[(.*?)\]$/m);
            if (languageMatch) {
                languages = languageMatch[1].split(',').map(lang => lang.trim().replace(/['"]/g, ''));
            }
        }

        // 提取原文链接（优先使用front matter中的链接）
        let originalLink = frontMatter.originalLink || '';
        if (!originalLink) {
            const linkMatch = content.match(/^originalLink:\s+([^\n]+)$/m);
            if (linkMatch) {
                originalLink = linkMatch[1].trim();
            }
        }

        // 提取摘要
        let excerpt = frontMatter.excerpt || '';
        if (!excerpt) {
            // 尝试从YAML front matter之后，直到第一个二级标题之前提取
            const yamlContentMatch = content.match(/^---[\s\S]*?---[\s\S]*?(?=^##|$)/m);
            if (yamlContentMatch) {
                excerpt = yamlContentMatch[0].replace(/^---[\s\S]*?---/m, '').trim();
            }

            // 如果没有提取到摘要，使用前100个字符作为摘要
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

    /**
     * 提取YAML front matter
     * @param {string} content - Markdown内容
     * @returns {Object} 解析后的front matter对象
     */
    static extractFrontMatter(content) {
        const frontMatterMatch = content.match(/^---[\s\S]*?---/m);
        if (!frontMatterMatch) {
            return {};
        }

        const frontMatterText = frontMatterMatch[0].replace(/^---|---$/g, '').trim();
        const frontMatter = {};

        // 简单解析YAML格式
        const lines = frontMatterText.split('\n');
        lines.forEach(line => {
            const match = line.match(/^\s*(\w+):\s*(.*)$/);
            if (match) {
                const [, key, value] = match;
                // 处理数组格式，如 categories: [前端, 后端]
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

    /**
     * 将Markdown转换为HTML
     * @param {string} markdown - Markdown内容
     * @param {string} basePath - 基础路径，用于处理图片路径
     * @param {string} markdownPath - Markdown文件路径
     * @param {string} htmlPath - HTML文件路径
     * @returns {string} 转换后的HTML内容
     */
    static markdownToHtml(markdown, basePath = '', markdownPath = '', htmlPath = '') {
        let html = markdown;

        // 转换标题
        html = html.replace(/^#####\s+(.*)$/gm, '<h5>$1</h5>');
        html = html.replace(/^####\s+(.*)$/gm, '<h4>$1</h4>');
        html = html.replace(/^###\s+(.*)$/gm, '<h3>$1</h3>');
        html = html.replace(/^##\s+(.*)$/gm, '<h2>$1</h2>');
        html = html.replace(/^#\s+(.*)$/gm, '<h1>$1</h1>');

        // 转换代码块（带语法高亮）
        html = html.replace(/```(\w+)?\n([\s\S]*?)```/gm, (match, lang, code) => {
            return `<pre><code class="language-${lang || 'plaintext'}">${this.escapeHtml(code)}</code></pre>`;
        });

        // 转换行内代码
        html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

        // 转换图片（处理路径）
        html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (match, alt, imgPath) => {
            // 处理相对路径图片
            if (!imgPath.startsWith('http') && !imgPath.startsWith('https')) {
                // 如果图片路径以assets/开头，使用相对于Markdown文件所在目录的路径
                if (imgPath.startsWith('assets/')) {
                    // 计算从html文件到Markdown文件所在目录的相对路径
                    const mdDir = path.dirname(markdownPath);
                    const htmlDir = path.dirname(htmlPath);
                    const relativePath = path.relative(htmlDir, mdDir).replace(/\\/g, '/') || '.';
                    imgPath = path.join(relativePath, imgPath).replace(/\\/g, '/');
                } else {
                    // 其他相对路径，使用basePath
                    imgPath = path.join(basePath, imgPath).replace(/\\/g, '/');
                }
            }
            return `<img src="${imgPath}" alt="${alt}" class="markdown-image">`;
        });

        // 转换链接
        html = html.replace(/\[([^\]]*)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');

        // 转换粗体
        html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

        // 转换斜体
        html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');

        // 转换无序列表
        html = html.replace(/^-\s+(.*)$/gm, '<li>$1</li>');
        html = html.replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>');

        // 转换有序列表
        html = html.replace(/^\d+\.\s+(.*)$/gm, '<li>$1</li>');
        html = html.replace(/(<li>.*<\/li>)/gs, '<ol>$1</ol>');

        // 转换段落
        html = html.replace(/^(?!<h[1-6]>)(?!<ul>)(?!<ol>)(?!<li>)(?!<pre>)(?!<code>)(.*)$/gm, '<p>$1</p>');

        // 清理多余的空行
        html = html.replace(/\n{3,}/g, '\n\n');

        return html;
    }

    /**
     * 转义HTML特殊字符
     * @param {string} text - 需要转义的文本
     * @returns {string} 转义后的文本
     */
    static escapeHtml(text) {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    /**
     * 移除Markdown标记，只保留纯文本
     * @param {string} markdown - Markdown内容
     * @returns {string} 纯文本内容
     */
    static stripMarkdown(markdown) {
        // 移除代码块
        let text = markdown.replace(/```[\s\S]*?```/g, '');
        // 移除行内代码
        text = text.replace(/`[^`]+`/g, '');
        // 移除图片
        text = text.replace(/!\[[^\]]*\]\([^)]+\)/g, '');
        // 移除链接
        text = text.replace(/\[[^\]]*\]\([^)]+\)/g, '$1');
        // 移除标题标记
        text = text.replace(/^#\s+/gm, '');
        // 移除粗体和斜体标记
        text = text.replace(/\*\*|\*/g, '');
        // 移除列表标记
        text = text.replace(/^-\s+|^\d+\.\s+/gm, '');
        // 移除多余的空行
        text = text.replace(/\n{2,}/g, '\n');

        return text.trim();
    }

    /**
     * 为Markdown文件生成HTML文件
     * @param {string} markdownPath - Markdown文件路径
     * @param {string} htmlPath - 生成的HTML文件路径
     * @param {Object} options - 选项配置
     */
    static generateHtmlFromMarkdown(markdownPath, htmlPath, options = {}) {
        // 解析Markdown文件
        const parsed = this.parseMarkdown(markdownPath);
        const { title, date, categories, languages, originalLink, content } = parsed;

        // 计算基础路径，用于处理图片路径和资源文件路径
        // 计算从html文件到项目根目录的相对路径
        const htmlDir = path.dirname(htmlPath);
        const projectRoot = __dirname; // 项目根目录
        const basePath = path.relative(htmlDir, projectRoot).replace(/\\/g, '/') || '.';

        // 转换Markdown为HTML
        const htmlContent = this.markdownToHtml(content, basePath, markdownPath, htmlPath);

        // 生成导航栏
        const navTemplate = options.navTemplate || this.getDefaultNavTemplate();
        const relativeNav = navTemplate.replace(/href="([^"]+)"/g, (match, href) => {
            if (href.startsWith('http')) {
                return match;
            }
            // 计算相对路径
            const relativePath = path.relative(path.dirname(htmlPath), path.dirname(href)).replace(/\\/g, '/') || '.';
            return `href="${relativePath}/${path.basename(href)}"`;
        });

        // 生成类别和语言标签
        let tagsHtml = '';
        if (categories.length > 0 || languages.length > 0) {
            tagsHtml = `
        <div class="post-tags">
          ${categories.map(cat => `<span class="post-tag category">${cat}</span>`).join(' ')}
          ${languages.map(lang => `<span class="post-tag language">${lang}</span>`).join(' ')}
        </div>`;
        }

        // 生成原文链接
        let originalLinkHtml = '';
        if (originalLink) {
            originalLinkHtml = `
        <div class="post-original-link">
          <strong>原文链接：</strong><a href="${originalLink}" target="_blank" rel="noopener">${originalLink}</a>
        </div>`;
        }

        // 生成HTML模板
        const htmlTemplate = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} | 北辰</title>
  <link rel="stylesheet" href="${basePath}/../css/common.css">
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

  <script src="${basePath}/../js/theme.js"></script>
</body>
</html>
  `;

        // 确保目录存在
        if (!fs.existsSync(htmlDir)) {
            fs.mkdirSync(htmlDir, { recursive: true });
        }

        fs.writeFileSync(htmlPath, htmlTemplate);
        console.log(`Generated HTML file: ${htmlPath}`);
    }

    /**
     * 获取默认导航模板
     * @returns {string} 默认导航模板HTML
     */
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

// 导出模块
module.exports = MarkdownParser;
