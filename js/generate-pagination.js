const fs = require('fs');
const path = require('path');
const MarkdownParser = require('./markdown-parser');

// 项目根目录（本脚本位于 js/ 下，根目录是其上一级）
const ROOT_DIR = path.join(__dirname, '..');
const generatedArticles = new Set();

// 为Markdown文件生成HTML文件的函数
function generateHtmlFromMarkdown(markdownPath, htmlPath) {
    if (generatedArticles.has(htmlPath)) return;
    // 根据详情页位置计算到项目根目录的相对路径。
    const htmlDir = path.dirname(htmlPath);
    const basePath = path.relative(htmlDir, ROOT_DIR).replace(/\\/g, '/') || '.';
    // 使用新的MarkdownParser模块生成HTML
    MarkdownParser.generateHtmlFromMarkdown(markdownPath, htmlPath, {
        navTemplate: readNavTemplate(basePath + '/')
    });
    generatedArticles.add(htmlPath);
}

// 页面配置
const pageConfigs = [
    {
        name: 'index',
        title: '🌱 博客首页 | 北辰',
        icon: '🌱',
        headerTitle: '北辰的博客',
        headerSubtitle: '记录思考，分享成长 | 一个热爱技术的探索者',
        contentClass: 'post-list',
        itemClass: 'post-item',
        itemTitleClass: 'post-title',
        itemDateClass: 'post-date',
        itemExcerptClass: 'post-excerpt',
        postsPerPage: 5,
        directory: 'posts/index',
        outputDir: '.',
        basePath: './'
    },
    {
        name: 'project',
        title: '☘️ 个人项目 | 北辰',
        icon: '☘️',
        headerTitle: '个人项目',
        headerSubtitle: '分享我开发的项目和技术实践',
        contentClass: 'project-container',
        itemClass: 'project-card',
        itemTitleClass: 'project-title',
        itemDateClass: '',
        itemExcerptClass: 'project-desc',
        postsPerPage: 6,
        directory: 'posts/project',
        outputDir: 'html/project',
        basePath: '../../'
    },
    {
        name: 'skill',
        title: '🍀 技术 | 北辰',
        icon: '🍀',
        headerTitle: '技术',
        headerSubtitle: '技术分享与实践 | 前端、后端、运维等',
        contentClass: 'skill-container',
        itemClass: 'skill-card',
        itemTitleClass: 'skill-title',
        itemDateClass: 'skill-date',
        itemExcerptClass: 'skill-excerpt',
        postsPerPage: 6,
        directory: 'posts/skill',
        outputDir: 'html/skill',
        basePath: '../../'
    },
    {
        name: 'ai',
        title: '🧠 AI | 北辰',
        icon: '🧠',
        headerTitle: '人工智能',
        headerSubtitle: '深度学习 | 神经网络 | 模型微调与部署 | RAG',
        contentClass: 'ai-container',
        itemClass: 'skill-card',
        itemTitleClass: 'skill-title',
        itemDateClass: 'skill-date',
        itemExcerptClass: 'skill-excerpt',
        postsPerPage: 6,
        directory: 'posts/ai',
        outputDir: 'html/ai',
        basePath: '../../'
    },
    {
        name: 'daily',
        title: '✨ 日常 | 北辰',
        icon: '✨',
        headerTitle: '日常',
        headerSubtitle: '生活点滴记录 | 感悟与思考',
        contentClass: 'daily-container',
        itemClass: 'daily-item',
        itemTitleClass: 'daily-title',
        itemDateClass: 'daily-date',
        itemExcerptClass: 'daily-content',
        postsPerPage: 4,
        directory: 'posts/daily',
        outputDir: 'html/daily',
        basePath: '../../'
    },

    {
        name: 'archives',
        title: '☕️ 文章归档 | 北辰',
        icon: '☕️',
        headerTitle: '文章归档',
        headerSubtitle: '按时间整理的历史文章与学习笔记',
        contentClass: 'archives-container',
        itemClass: 'archives-item',
        itemTitleClass: 'archives-title',
        itemDateClass: 'archives-date',
        itemExcerptClass: 'archives-excerpt',
        postsPerPage: 10,
        directory: 'posts/archives',
        outputDir: '.',
        basePath: './'
    }
];

// 确保所有必要的目录都存在
pageConfigs.forEach(config => {
    const dirPath = path.join(ROOT_DIR, config.directory);
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
        console.log(`Created directory: ${config.directory}`);
    }
    const mdSubDir = path.join(dirPath, 'md');
    const htmlSubDir = path.join(dirPath, 'html');
    if (!fs.existsSync(mdSubDir)) {
        fs.mkdirSync(mdSubDir, { recursive: true });
        console.log(`Created directory: ${config.directory}/md`);
    }
    if (!fs.existsSync(htmlSubDir)) {
        fs.mkdirSync(htmlSubDir, { recursive: true });
        console.log(`Created directory: ${config.directory}/html`);
    }
    if (config.outputDir && config.outputDir !== '.') {
        const outputPath = path.join(ROOT_DIR, config.outputDir);
        if (!fs.existsSync(outputPath)) {
            fs.mkdirSync(outputPath, { recursive: true });
            console.log(`Created output directory: ${config.outputDir}`);
        }
    }
});

const skillCategorySlugs = {
    'Java 与 JVM': 'java-jvm',
    '数据库': 'database',
    '缓存与中间件': 'middleware',
    '分布式与微服务': 'distributed',
    '架构与工程': 'architecture',
    'AI 工程': 'ai-engineering'
};

const aiCategorySlugs = {
    '深度学习基础': 'deep-learning',
    'Transformer 与模型架构': 'model-architecture',
    '提示学习与模型微调': 'fine-tuning',
    '推理与部署': 'inference',
    'RAG 与智能体': 'rag-agents'
};

function getSortedPosts(moduleName) {
    const mdDir = path.join(ROOT_DIR, 'posts', moduleName, 'md');
    return fs.readdirSync(mdDir)
        .filter(file => file.endsWith('.md'))
        .map(file => {
            const markdownPath = path.join(mdDir, file);
            return { file, path: `posts/${moduleName}`, parsed: MarkdownParser.parseMarkdown(markdownPath) };
        })
        .sort((a, b) => (b.parsed.date || '1970-01-01').localeCompare(a.parsed.date || '1970-01-01'));
}

function renderArticleCards(posts, basePath, headingLevel = 2) {
    return posts.map(item => {
        const { title, date, primaryCategory, categories, tags, languages, excerpt } = item.parsed || MarkdownParser.parseMarkdown(path.join(ROOT_DIR, item.path, 'md', item.file));
        const cleanTitle = title || item.file.replace('.md', '').replace(/-/g, ' ');
        const displayCategory = primaryCategory || categories[0] || '';
        return `
      <article class="article-card skill-card">
        <div class="skill-header">
          <h${headingLevel} class="skill-title"><a href="${basePath}${item.path}/html/${item.file.replace('.md', '.html')}">${MarkdownParser.escapeHtml(cleanTitle)}</a></h${headingLevel}>
        </div>
        <div class="skill-excerpt">${MarkdownParser.escapeHtml(excerpt || '暂无摘要，阅读全文了解详情。')}</div>
        <div class="skill-meta">
            ${date ? `<div class="skill-meta-item"><time datetime="${date}">${date}</time></div>` : ''}
            ${displayCategory ? `<div class="skill-meta-item"><span class="label">类别：</span><span>${MarkdownParser.escapeHtml(displayCategory)}</span></div>` : ''}
            ${languages.length ? `<div class="skill-meta-item"><span class="label">语言：</span><span>${MarkdownParser.escapeHtml(languages.join(' · '))}</span></div>` : ''}
        </div>
        <div class="skill-card-footer">
          ${tags.length ? `<div class="skill-tags">${tags.map(tag => `<span class="skill-tag">${MarkdownParser.escapeHtml(tag)}</span>`).join(' ')}</div>` : ''}
          <a href="${basePath}${item.path}/html/${item.file.replace('.md', '.html')}" class="skill-read-more" aria-label="阅读全文：${MarkdownParser.escapeHtml(cleanTitle)}">阅读全文 →</a>
        </div>
      </article>`;
    }).join('');
}

function renderArchiveGroups(posts, basePath) {
    const years = new Map();
    for (const item of posts) {
        const year = item.parsed.date.slice(0, 4);
        const month = item.parsed.date.slice(5, 7);
        if (!years.has(year)) years.set(year, new Map());
        const months = years.get(year);
        if (!months.has(month)) months.set(month, []);
        months.get(month).push(item);
    }
    return [...years].map(([year, months]) => `
    <section class="archive-year-group" aria-labelledby="archive-${year}">
      <h2 class="archive-year" id="archive-${year}">${year} 年</h2>
      ${[...months].map(([month, monthPosts]) => `
      <section class="archive-month-group" aria-labelledby="archive-${year}-${month}">
        <h3 class="archive-month" id="archive-${year}-${month}">${Number(month)} 月 <span>${monthPosts.length} 篇</span></h3>
        ${renderArticleCards(monthPosts, basePath, 4)}
      </section>`).join('')}
    </section>`).join('');
}

function renderCategoryNavigation(moduleName, activeCategory = '') {
    const categories = Object.entries(moduleName === 'ai' ? aiCategorySlugs : skillCategorySlugs);
    const posts = getSortedPosts(moduleName);
    const counts = posts.reduce((result, item) => {
        const category = item.parsed.primaryCategory || item.parsed.categories[0];
        result[category] = (result[category] || 0) + 1;
        return result;
    }, {});
    return `<nav class="skill-category-nav" aria-label="${moduleName === 'ai' ? 'AI' : '技术'}文章分类">
      <a href="${moduleName}.html"${activeCategory ? '' : ' class="active" aria-current="page"'}>全部 <span class="category-count">${posts.length}</span></a>
      ${categories.map(([name, slug]) => `<a href="category-${slug}.html"${activeCategory === name ? ' class="active" aria-current="page"' : ''}>${name} <span class="category-count">${counts[name] || 0}</span></a>`).join('')}
    </nav>`;
}

function generateCategoryPages(moduleName) {
    const basePath = '../../';
    const template = readTemplate(moduleName);
    const posts = getSortedPosts(moduleName);
    const categorySlugs = moduleName === 'ai' ? aiCategorySlugs : skillCategorySlugs;
    const icon = moduleName === 'ai' ? '🧠' : '🍀';
    let count = 0;
    for (const [category, slug] of Object.entries(categorySlugs)) {
        const categoryPosts = posts.filter(item => (item.parsed.primaryCategory || item.parsed.categories[0]) === category);
        const html = renderTemplate(template, {
            title: `${icon} ${category} | 北辰`,
            icon,
            headerTitle: category,
            headerSubtitle: `${moduleName === 'ai' ? 'AI' : '技术'}文章 · ${categoryPosts.length} 篇`,
            categoryNavigation: renderCategoryNavigation(moduleName, category),
            listSummary: '',
            contentClass: `${moduleName}-container`,
            content: categoryPosts.length ? renderArticleCards(categoryPosts, basePath) : '<p>暂无文章</p>',
            pagination: ''
        }, basePath);
        fs.writeFileSync(path.join(ROOT_DIR, 'html', moduleName, `category-${slug}.html`), html);
        console.log(`Generated ${moduleName}/category-${slug}.html`);
        count++;
    }
    return count;
}

// 生成页面函数
function generatePage(pageConfig) {
    const { name, title, icon, headerTitle, headerSubtitle, contentClass, postsPerPage, directory, outputDir, basePath } = pageConfig;

    // 读取目录下的所有文章
    let allMarkdownFiles = [];

    if (name === 'index') {
        // 首页从所有栏目中获取最新文章，但排除归档目录
        const allDirs = ['posts/project', 'posts/daily', 'posts/index', 'posts/skill', 'posts/ai'];
        allDirs.forEach(dir => {
            const mdDir = path.join(ROOT_DIR, dir, 'md');
            if (fs.existsSync(mdDir)) {
                const files = fs.readdirSync(mdDir);
                const mdFiles = files.filter(file => file.endsWith('.md')).map(file => {
                    return {
                        file,
                        path: dir
                    };
                });
                allMarkdownFiles = allMarkdownFiles.concat(mdFiles);
            }
        });
    } else {
        // 其他页面从对应目录获取文章
        const mdDir = path.join(ROOT_DIR, directory, 'md');
        if (!fs.existsSync(mdDir)) {
            console.log(`Directory ${mdDir} does not exist. Skipping ${name} page.`);
            return 0;
        }

        const files = fs.readdirSync(mdDir);
        allMarkdownFiles = files.filter(file => file.endsWith('.md')).map(file => {
            return {
                file,
                path: directory
            };
        });
    }

    // 按日期排序（最新在前）
    // 首先为每个文件解析日期
    allMarkdownFiles.forEach(item => {
        const markdownPath = path.join(ROOT_DIR, item.path, 'md', item.file);
        const parsed = MarkdownParser.parseMarkdown(markdownPath);
        item.parsed = parsed;
        item.parsedDate = parsed.date;
    });
    
    allMarkdownFiles.sort((a, b) => {
        // 使用解析后的日期进行排序
        const dateA = a.parsedDate || '1970-01-01';
        const dateB = b.parsedDate || '1970-01-01';
        return dateB.localeCompare(dateA);
    });

    // 为每个Markdown文件生成HTML文件
    allMarkdownFiles.forEach(item => {
        const markdownPath = path.join(ROOT_DIR, item.path, 'md', item.file);
        const htmlPath = path.join(ROOT_DIR, item.path, 'html', item.file.replace('.md', '.html'));
        generateHtmlFromMarkdown(markdownPath, htmlPath);
    });

    // 打印调试信息
    console.log(`Processing ${name} page:`);
    console.log(`- Directory: ${directory}`);
    console.log(`- Found ${allMarkdownFiles.length} Markdown files`);
    allMarkdownFiles.forEach(file => {
        console.log(`  - ${file.file}`);
    });

    const listSummary = ['project', 'daily', 'archives'].includes(name)
        ? `<div class="listing-summary"><p>${name === 'archives' ? '归档文章' : '全部文章'} <span>${allMarkdownFiles.length} 篇</span></p><span>最新发布在前</span></div>`
        : '';

    // 如果没有Markdown文件，生成对应模板的页面（空状态）
    if (allMarkdownFiles.length === 0) {
        let template;
        if (name === 'index') {
            // 首页使用专用模板
            template = readTemplate('index');
        } else {
            // 优先使用栏目专属模板，不存在则回退到 default
            template = readTemplate(name) || readTemplate('default');
        }

        if (template) {
            const emptyContent = `
    <div class="empty-container" style="text-align: center; padding: 4rem 1rem;">
      <div style="font-size: 4rem; margin-bottom: 1.5rem; color: var(--primary); opacity: 0.7;">📝</div>
      <h2 style="font-size: 1.8rem; margin-bottom: 1rem; color: var(--text);">暂无文章</h2>
      <p style="font-size: 1.1rem; margin-bottom: 2rem; color: #888;">内容正在整理中，敬请期待...</p>
      <a href="${basePath}index.html" style="display: inline-block; padding: 0.8rem 1.8rem; background: var(--primary); color: white; border-radius: 8px; text-decoration: none; font-weight: 500; transition: var(--transition);">返回首页</a>
    </div>`;
            const renderedHtml = renderTemplate(template, {
                title: title,
                icon: icon,
                headerTitle: headerTitle,
                headerSubtitle: headerSubtitle,
                categoryNavigation: ['skill', 'ai'].includes(name) ? renderCategoryNavigation(name) : '',
                listSummary,
                articleCount: allMarkdownFiles.length,
                content: emptyContent,
                contentClass: contentClass,
                pagination: ''
            }, basePath);
            const filename = `${name}.html`;
            fs.writeFileSync(path.join(ROOT_DIR, outputDir, filename), renderedHtml);
            console.log(`Generated default page: ${filename}`);
        }
        return 0;
    }

    // 计算总页数
    const totalPages = name === 'index' ? 1 : Math.ceil(allMarkdownFiles.length / postsPerPage);

    // 生成分页文件
    for (let page = 1; page <= totalPages; page++) {
        const start = (page - 1) * postsPerPage;
        const end = name === 'index' ? allMarkdownFiles.length : start + postsPerPage;
        const currentPosts = allMarkdownFiles.slice(start, end);

        // 生成内容部分
        let contentHtml = '';
        switch (name) {
            case 'index':
                contentHtml = renderArticleCards(currentPosts.slice(0, postsPerPage), basePath, 3);
                break;
            case 'archives':
                contentHtml = renderArchiveGroups(currentPosts, basePath);
                break;
            default:
                contentHtml = renderArticleCards(currentPosts, basePath);
                break;
        }

        // 生成分页部分
        let paginationHtml = '';
        if (name !== 'index' && totalPages > 1) {
            paginationHtml = `
  <div class="pagination">
    ${Array.from({ length: totalPages }, (_, i) => {
        const pageNumber = i + 1;
        return `<a href="${name}${pageNumber === 1 ? '' : '-' + pageNumber}.html" class="page-link ${pageNumber === page ? 'active' : ''}" aria-label="第 ${pageNumber} 页"${pageNumber === page ? ' aria-current="page"' : ''}>${pageNumber}</a>`;
    }).join('')}
  </div>
`;
        }

        // 读取对应栏目的模板
        let template = readTemplate(name);
        if (!template) {
            // 如果没有对应栏目的模板，使用默认模板
            template = readTemplate('default');
        }

        if (template) {
            const renderedHtml = renderTemplate(template, {
                title: title,
                icon: icon,
                headerTitle: headerTitle,
                headerSubtitle: headerSubtitle,
                categoryNavigation: ['skill', 'ai'].includes(name) ? renderCategoryNavigation(name) : '',
                listSummary,
                articleCount: allMarkdownFiles.length,
                content: contentHtml,
                contentClass: contentClass,
                pagination: paginationHtml
            }, basePath);

            const filename = page === 1 ? `${name}.html` : `${name}-${page}.html`;
            fs.writeFileSync(path.join(ROOT_DIR, outputDir, filename), renderedHtml);
            console.log(`Generated ${name}/${filename}`);
        }
    }

    return totalPages;
}

// 读取模板文件的函数
function readTemplate(templateName) {
    const templatePath = path.join(ROOT_DIR, 'templates', `${templateName}-template.html`);
    if (fs.existsSync(templatePath)) {
        return fs.readFileSync(templatePath, 'utf8');
    }
    return null;
}

// 读取导航栏模板的函数
function readNavTemplate(basePath) {
    basePath = basePath || './';
    const navTemplatePath = path.join(ROOT_DIR, 'templates', 'nav-template.html');
    if (fs.existsSync(navTemplatePath)) {
        let navTemplate = fs.readFileSync(navTemplatePath, 'utf8');
        navTemplate = navTemplate.replace(/\{\{basePath\}\}/g, basePath);
        return navTemplate;
    }
    // 默认导航栏
    return `
<nav>
  <a href="${basePath}index.html">首页</a>
  <a href="${basePath}html/project/project.html">项目</a>
  <a href="${basePath}html/skill/skill.html">技术</a>
  <a href="${basePath}html/ai/ai.html">AI</a>
  <a href="${basePath}html/daily/daily.html">日常</a>
  <a href="${basePath}about.html">关于</a>
  <a href="${basePath}archives.html">归档</a>
  <a href="https://github.com/" target="_blank" rel="noopener">GitHub</a>
</nav>`;
}

// 渲染模板的函数
function renderTemplate(template, data, basePath) {
    let rendered = template;
    basePath = basePath || './';

    // 添加导航栏
    const navTemplate = readNavTemplate(basePath);
    rendered = rendered.replace(/\{\{nav\}\}/g, navTemplate);
    
    // 添加技术栈
    const skillsTemplate = readTemplate('skills');
    if (skillsTemplate) {
        rendered = rendered.replace(/\{\{skills\}\}/g, skillsTemplate);
    }

    // 替换 {{basePath}}
    rendered = rendered.replace(/\{\{basePath\}\}/g, basePath);
    
    // 添加其他数据
    Object.keys(data).forEach(key => {
        const regex = new RegExp(`\\{\\{${key}\\}\}`, 'g');
        rendered = rendered.replace(regex, () => data[key]);
    });

    // 处理条件语法 {{content ? 'none' : 'block'}}
    rendered = rendered.replace(/\{\{([^}]+) \? ([^}]+) : ([^}]+)\}\}/g, (match, condition, trueValue, falseValue) => {
        const value = data[condition.trim()];
        const result = value ? trueValue : falseValue;
        return result.replace(/['"]/g, '');
    });

    // 获取音乐文件夹中的所有音频文件
    const musicDir = path.join(ROOT_DIR, 'images', 'music');
    let musicFiles = [];
    if (fs.existsSync(musicDir)) {
        musicFiles = fs.readdirSync(musicDir)
            .filter(file => file.endsWith('.mp3') || file.endsWith('.wav') || file.endsWith('.ogg'))
            .map(file => `${basePath}images/music/${file}`);
    }
    
    // 添加背景音乐标签和音乐列表
    // 音乐路径使用绝对路径 /images/music/，因为根目录的资源都是通过 / 访问的
    const absoluteMusicFiles = musicFiles.map(f => f.replace(/^\.?\/?/, '/'));
    const musicConfig = `
  <script>
    window.musicFiles = ${JSON.stringify(absoluteMusicFiles)};
  </script>
  <audio id="backgroundMusic" src="${absoluteMusicFiles[0] || '/images/music/background.mp3'}" autoplay muted loop></audio>
`;
    // 注入音乐配置：在 theme.js 引用前添加音乐标签
    const themeJsTag = `<script src="${basePath}js/theme.js"></script>`;
    if (rendered.includes(themeJsTag)) {
        rendered = rendered.replace(themeJsTag, `${musicConfig}  ${themeJsTag}`);
    }

    return MarkdownParser.versionAssets(rendered.replace(/^[ \t]+$/gm, ''));
}

// 为每个页面生成分页
let totalGenerated = 0;
pageConfigs.forEach(config => {
    const pages = generatePage(config);
    totalGenerated += pages;
});
totalGenerated += generateCategoryPages('skill');
totalGenerated += generateCategoryPages('ai');

console.log(`\nGenerated ${totalGenerated} pagination pages in total.`);

// 后处理：更新 about.html 中的技术栈
console.log('\nProcessing about.html...');
const aboutPath = path.join(ROOT_DIR, 'about.html');
if (fs.existsSync(aboutPath)) {
    let aboutHtml = fs.readFileSync(aboutPath, 'utf8');
    aboutHtml = aboutHtml.replace(
        /<!-- NAV_START -->[\\s\\S]*?<!-- NAV_END -->/,
        () => `<!-- NAV_START -->\n    ${readNavTemplate('./')}\n    <!-- NAV_END -->`
    );
    const skillsTemplate = readTemplate('skills');
    if (skillsTemplate) {
        // 使用标记注释来定位替换位置
        aboutHtml = aboutHtml.replace(
            /<!-- SKILLS_START -->[\s\S]*?<!-- SKILLS_END -->/,
            `<!-- SKILLS_START -->\n        ${skillsTemplate}\n        <!-- SKILLS_END -->`
        );
    }
    
    fs.writeFileSync(aboutPath, MarkdownParser.versionAssets(aboutHtml));
    console.log('Updated about.html with shared skills');
} else {
    console.log('about.html not found, skipping');
}
