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
                } else {
                    // 文件名中没有日期，使用当前日期
                    const now = new Date();
                    date = now.toISOString().split('T')[0];
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

        // 转换水平分隔线 (--- 或 *** 或 ___)
        html = html.replace(/^[\s]*[-]{3,}[\s]*$/gm, '<hr class="markdown-hr">');
        html = html.replace(/^[\s]*[*]{3,}[\s]*$/gm, '<hr class="markdown-hr">');
        html = html.replace(/^[\s]*[_]{3,}[\s]*$/gm, '<hr class="markdown-hr">');

        // 转换代码块（带语法高亮）- 支持 ``` 和 ~~~ 两种格式
        html = html.replace(/```(\w+)?\n([\s\S]*?)```/gm, (match, lang, code) => {
            return `<pre><code class="language-${lang || 'plaintext'}">${this.escapeHtml(code)}</code></pre>`;
        });
        html = html.replace(/~~~(\w+)?\n([\s\S]*?)~~~/gm, (match, lang, code) => {
            return `<pre><code class="language-${lang || 'plaintext'}">${this.escapeHtml(code)}</code></pre>`;
        });

        // 转换行内代码
        html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

        // 转换图片（处理路径）- 支持 HTML img 标签中的 src 属性
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

        // 处理 HTML img 标签中的本地路径（如 Typora 生成的绝对路径）
        html = html.replace(/<img([^>]+)src="([^"]+)"([^>]*)>/g, (match, before, imgPath, after) => {
            // 如果是绝对路径（如 /Users/xxx/...），尝试转换为相对路径或占位符
            if (imgPath.startsWith('/Users/') || imgPath.startsWith('/home/') || imgPath.startsWith('C:\\')) {
                // 提取文件名作为 alt 文本
                const fileName = imgPath.split('/').pop().split('\\').pop();
                return `<div class="image-placeholder" style="padding: 2rem; background: var(--card-bg); border: 2px dashed var(--border); border-radius: 8px; text-align: center; color: #888; margin: 1rem 0;">\n                    <div style="font-size: 2rem; margin-bottom: 0.5rem;">🖼️</div>\n                    <div>图片: ${fileName}</div>\n                    <div style="font-size: 0.85rem; margin-top: 0.5rem;">(本地路径图片无法显示)</div>\n                </div>`;
            }
            return match;
        });

        // 转换链接
        html = html.replace(/\[([^\]]*)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');

        // 转换表格
        html = this.convertTables(html);

        // 转换标题（注意：要在处理完表格之后再处理标题，避免表格分隔符被误识别）
        html = html.replace(/^#####\s+(.*)$/gm, '<h5>$1</h5>');
        html = html.replace(/^####\s+(.*)$/gm, '<h4>$1</h4>');
        html = html.replace(/^###\s+(.*)$/gm, '<h3>$1</h3>');
        html = html.replace(/^##\s+(.*)$/gm, '<h2>$1</h2>');
        html = html.replace(/^#\s+(.*)$/gm, '<h1>$1</h1>');

        // 转换引用块
        html = this.convertBlockquotes(html);

        // 转换任务列表
        html = this.convertTaskLists(html);

        // 转换粗体 (**text**)
        html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

        // 转换斜体 (*text*) - 但要避免匹配到已经处理的 **
        html = html.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>');

        // 转换删除线 (~~text~~)
        html = html.replace(/~~([^~]+)~~/g, '<del>$1</del>');

        // 转换无序列表
        html = this.convertUnorderedLists(html);

        // 转换有序列表
        html = this.convertOrderedLists(html);

        // 转换段落（跳过已转换的HTML标签）
        html = html.replace(/^(?!<[a-zA-Z])(?!<\/)(?!<h[1-6]>)(?!<ul>)(?!<ol>)(?!<li>)(?!<pre>)(?!<code>)(?!<table>)(?!<thead>)(?!<tbody>)(?!<tr>)(?!<th>)(?!<td>)(?!<blockquote>)(?!<hr)(?!<div)(?!<img)(.+)$/gm, '<p>$1</p>');

        // 清理空的段落标签
        html = html.replace(/<p>\s*<\/p>/g, '');

        // 清理多余的空行
        html = html.replace(/\n{3,}/g, '\n\n');

        return html;
    }

    /**
     * 转换Markdown表格为HTML表格
     * @param {string} html - 包含Markdown表格的内容
     * @returns {string} 转换后的HTML
     */
    static convertTables(html) {
        // 按行分割处理
        const lines = html.split('\n');
        const result = [];
        let i = 0;

        while (i < lines.length) {
            const line = lines[i];
            
            // 检查是否是表格开始（包含 | 的行）
            if (line.includes('|') && i + 1 < lines.length && lines[i + 1].includes('|') && lines[i + 1].match(/\|[-:\|\s]+\|/)) {
                // 找到表格的所有行
                const tableLines = [];
                tableLines.push(line);
                i++;
                
                // 添加分隔行
                if (i < lines.length) {
                    tableLines.push(lines[i]);
                    i++;
                }
                
                // 添加数据行
                while (i < lines.length && lines[i].includes('|')) {
                    tableLines.push(lines[i]);
                    i++;
                }

                // 解析表格
                const tableHtml = this.parseTableLines(tableLines);
                result.push(tableHtml);
            } else {
                result.push(line);
                i++;
            }
        }

        return result.join('\n');
    }

    /**
     * 解析表格行并生成HTML表格
     * @param {Array} lines - 表格行数组
     * @returns {string} HTML表格
     */
    static parseTableLines(lines) {
        if (lines.length < 2) return lines.join('\n');

        // 解析表头
        const headerLine = lines[0];
        const headers = headerLine.split('|').filter(cell => cell.trim() !== '').map(cell => cell.trim());

        // 解析数据行（从第三行开始，跳过表头和分隔行）
        const dataRows = [];
        for (let i = 2; i < lines.length; i++) {
            const cells = lines[i].split('|').filter(cell => cell.trim() !== '').map(cell => cell.trim());
            if (cells.length > 0) {
                dataRows.push(cells);
            }
        }

        // 生成HTML表格
        let tableHtml = '<table class="markdown-table">\n<thead>\n<tr>';
        headers.forEach(header => {
            tableHtml += `<th>${header}</th>`;
        });
        tableHtml += '</tr>\n</thead>\n<tbody>\n';

        dataRows.forEach(row => {
            tableHtml += '<tr>';
            row.forEach((cell) => {
                const cellContent = cell || '&nbsp;';
                tableHtml += `<td>${cellContent}</td>`;
            });
            for (let i = row.length; i < headers.length; i++) {
                tableHtml += '<td>&nbsp;</td>';
            }
            tableHtml += '</tr>\n';
        });

        tableHtml += '</tbody>\n</table>';
        return tableHtml;
    }

    /**
     * 转换引用块
     * @param {string} html - 包含引用块的内容
     * @returns {string} 转换后的HTML
     */
    static convertBlockquotes(html) {
        const lines = html.split('\n');
        const result = [];
        let inBlockquote = false;
        let blockquoteContent = [];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const blockquoteMatch = line.match(/^>\s?(.*)$/);

            if (blockquoteMatch) {
                if (!inBlockquote) {
                    inBlockquote = true;
                    blockquoteContent = [];
                }
                blockquoteContent.push(blockquoteMatch[1]);
            } else {
                if (inBlockquote) {
                    result.push('<blockquote class="markdown-blockquote">' + blockquoteContent.join('<br>') + '</blockquote>');
                    inBlockquote = false;
                    blockquoteContent = [];
                }
                result.push(line);
            }
        }

        // 处理未闭合的引用块
        if (inBlockquote) {
            result.push('<blockquote class="markdown-blockquote">' + blockquoteContent.join('<br>') + '</blockquote>');
        }

        return result.join('\n');
    }

    /**
     * 转换任务列表
     * @param {string} html - 包含任务列表的内容
     * @returns {string} 转换后的HTML
     */
    static convertTaskLists(html) {
        // 转换已完成的任务 - [x]
        html = html.replace(/^\s*-\s*\[x\]\s+(.*)$/gim, '<li class="task-list-item"><input type="checkbox" checked disabled> $1</li>');
        // 转换未完成的任务 - [ ]
        html = html.replace(/^\s*-\s*\[\s*\]\s+(.*)$/gim, '<li class="task-list-item"><input type="checkbox" disabled> $1</li>');
        return html;
    }

    /**
     * 转换无序列表
     * @param {string} html - 包含无序列表的内容
     * @returns {string} 转换后的HTML
     */
    static convertUnorderedLists(html) {
        const lines = html.split('\n');
        const result = [];
        let inList = false;
        let listItems = [];
        let currentItemContent = [];
        let lastWasListMarker = false;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            // 匹配无序列表项开始（排除任务列表）- 支持 - 后面跟空格的情况
            const listMatch = line.match(/^(\s*)-\s*(.*)$/);
            const isTaskList = line.match(/^\s*-\s*\[[\sx]\]/i);

            if (listMatch && !isTaskList) {
                const content = listMatch[2];
                
                // 如果之前已经在列表中，先保存当前项
                if (inList && currentItemContent.length > 0 && !lastWasListMarker) {
                    listItems.push(currentItemContent.join('\n'));
                    currentItemContent = [];
                }
                
                if (!inList) {
                    inList = true;
                    listItems = [];
                }
                
                // 检查是否是空标记（如 "- " 后面没有内容）
                if (content.trim() === '') {
                    lastWasListMarker = true;
                    // 不开始新项，等待下一行内容
                    if (currentItemContent.length === 0) {
                        currentItemContent = [];
                    }
                } else {
                    lastWasListMarker = false;
                    // 开始新的列表项，包含内容
                    currentItemContent = [content];
                }
            } else if (inList) {
                // 检查是否是空行（列表项之间的分隔）或缩进内容（列表项的延续）
                if (line.trim() === '') {
                    // 空行，如果之前有内容则保存，否则忽略
                    if (currentItemContent.length > 0 && currentItemContent.join('').trim() !== '') {
                        // 只有在下一行不是列表标记时才保存
                        if (i + 1 < lines.length && !lines[i + 1].match(/^\s*-\s*/)) {
                            listItems.push(currentItemContent.join('\n'));
                            currentItemContent = [];
                            lastWasListMarker = false;
                        }
                    }
                } else if (line.match(/^\s{2,}/) || lastWasListMarker) {
                    // 缩进的内容，属于当前列表项
                    currentItemContent.push(line.trim());
                    lastWasListMarker = false;
                } else {
                    // 非列表内容，结束列表
                    if (currentItemContent.length > 0) {
                        listItems.push(currentItemContent.join('\n'));
                    }
                    result.push('<ul class="markdown-list">');
                    listItems.forEach(item => {
                        if (item.trim() !== '') {
                            result.push(`<li>${item}</li>`);
                        }
                    });
                    result.push('</ul>');
                    inList = false;
                    listItems = [];
                    currentItemContent = [];
                    lastWasListMarker = false;
                    result.push(line);
                }
            } else {
                result.push(line);
            }
        }

        // 处理未闭合的列表
        if (inList) {
            if (currentItemContent.length > 0) {
                listItems.push(currentItemContent.join('\n'));
            }
            result.push('<ul class="markdown-list">');
            listItems.forEach(item => {
                if (item.trim() !== '') {
                    result.push(`<li>${item}</li>`);
                }
            });
            result.push('</ul>');
        }

        return result.join('\n');
    }

    /**
     * 转换有序列表
     * @param {string} html - 包含有序列表的内容
     * @returns {string} 转换后的HTML
     */
    static convertOrderedLists(html) {
        const lines = html.split('\n');
        const result = [];
        let inList = false;
        let listItems = [];
        let currentItemContent = [];
        let lastWasListMarker = false;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            // 匹配有序列表项开始
            const listMatch = line.match(/^(\s*)\d+\.\s*(.*)$/);

            if (listMatch) {
                const content = listMatch[2];
                
                // 如果之前已经在列表中，先保存当前项
                if (inList && currentItemContent.length > 0 && !lastWasListMarker) {
                    listItems.push(currentItemContent.join('\n'));
                    currentItemContent = [];
                }
                
                if (!inList) {
                    inList = true;
                    listItems = [];
                }
                
                // 检查是否是空标记（如 "1. " 后面没有内容）
                if (content.trim() === '') {
                    lastWasListMarker = true;
                    if (currentItemContent.length === 0) {
                        currentItemContent = [];
                    }
                } else {
                    lastWasListMarker = false;
                    currentItemContent = [content];
                }
            } else if (inList) {
                // 检查是否是空行（列表项之间的分隔）或缩进内容（列表项的延续）
                if (line.trim() === '') {
                    // 空行，如果之前有内容则保存，否则忽略
                    if (currentItemContent.length > 0 && currentItemContent.join('').trim() !== '') {
                        // 只有在下一行不是列表标记时才保存
                        if (i + 1 < lines.length && !lines[i + 1].match(/^\s*\d+\.\s*/)) {
                            listItems.push(currentItemContent.join('\n'));
                            currentItemContent = [];
                            lastWasListMarker = false;
                        }
                    }
                } else if (line.match(/^\s{2,}/) || lastWasListMarker) {
                    // 缩进的内容，属于当前列表项
                    currentItemContent.push(line.trim());
                    lastWasListMarker = false;
                } else {
                    // 非列表内容，结束列表
                    if (currentItemContent.length > 0) {
                        listItems.push(currentItemContent.join('\n'));
                    }
                    result.push('<ol class="markdown-ordered-list">');
                    listItems.forEach(item => {
                        if (item.trim() !== '') {
                            result.push(`<li>${item}</li>`);
                        }
                    });
                    result.push('</ol>');
                    inList = false;
                    listItems = [];
                    currentItemContent = [];
                    lastWasListMarker = false;
                    result.push(line);
                }
            } else {
                result.push(line);
            }
        }

        // 处理未闭合的列表
        if (inList) {
            if (currentItemContent.length > 0) {
                listItems.push(currentItemContent.join('\n'));
            }
            result.push('<ol class="markdown-ordered-list">');
            listItems.forEach(item => {
                if (item.trim() !== '') {
                    result.push(`<li>${item}</li>`);
                }
            });
            result.push('</ol>');
        }

        return result.join('\n');
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
    /* 暗黑模式下的代码块样式 */
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
    /* Markdown 表格样式 */
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
    /* 引用块样式 */
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
    /* 水平分隔线样式 */
    .post-body hr.markdown-hr {
      border: none;
      height: 2px;
      background: linear-gradient(to right, transparent, var(--border), transparent);
      margin: 2rem 0;
    }
    /* 任务列表样式 */
    .post-body li.task-list-item {
      list-style: none;
      margin-left: -1.5rem;
    }
    .post-body li.task-list-item input[type="checkbox"] {
      margin-right: 0.5rem;
      cursor: default;
    }
    /* 图片占位符样式 */
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
    
    <!-- 评论区 -->
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
