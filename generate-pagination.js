const fs = require('fs');
const path = require('path');
const MarkdownParser = require('./markdown-parser');

// 为Markdown文件生成HTML文件的函数
function generateHtmlFromMarkdown(markdownPath, htmlPath) {
    // 使用新的MarkdownParser模块生成HTML
    MarkdownParser.generateHtmlFromMarkdown(markdownPath, htmlPath, {
        navTemplate: readNavTemplate()
    });
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
        directory: 'posts/index'
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
        directory: 'posts/project'
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
        directory: 'posts/skill'
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
        directory: 'posts/daily'
    },

    {
        name: 'archives',
        title: '☕️ 文章归档 | 北辰',
        icon: '☕️',
        headerTitle: '文章归档',
        headerSubtitle: '所有文章的历史记录',
        contentClass: 'archives-container',
        itemClass: 'archives-item',
        itemTitleClass: 'archives-title',
        itemDateClass: 'archives-date',
        itemExcerptClass: 'archives-excerpt',
        postsPerPage: 10,
        directory: 'posts/archives'
    }
];

// 确保所有必要的目录都存在
pageConfigs.forEach(config => {
    const dirPath = path.join(__dirname, config.directory);
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
        console.log(`Created directory: ${config.directory}`);
    }
});

// 生成页面函数
function generatePage(pageConfig) {
    const { name, title, icon, headerTitle, headerSubtitle, contentClass, itemClass, itemTitleClass, itemDateClass, itemExcerptClass, postsPerPage, directory } = pageConfig;

    // 读取目录下的所有文章
    let postsDir = path.join(__dirname, directory);
    let allMarkdownFiles = [];

    if (name === 'index') {
        // 首页从所有栏目中获取最新文章，但排除归档目录
        const allDirs = ['posts/project', 'posts/daily', 'posts/index', 'posts/skill'];
        allDirs.forEach(dir => {
            const mdDir = path.join(__dirname, dir, 'md');
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
        const mdDir = path.join(__dirname, directory, 'md');
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
        const markdownPath = path.join(__dirname, item.path, 'md', item.file);
        const parsed = MarkdownParser.parseMarkdown(markdownPath);
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
        const markdownPath = path.join(__dirname, item.path, 'md', item.file);
        const htmlPath = path.join(__dirname, item.path, 'html', item.file.replace('.md', '.html'));
        generateHtmlFromMarkdown(markdownPath, htmlPath);
    });

    // 打印调试信息
    console.log(`Processing ${name} page:`);
    console.log(`- Directory: ${directory}`);
    console.log(`- Found ${allMarkdownFiles.length} Markdown files`);
    allMarkdownFiles.forEach(file => {
        console.log(`  - ${file.file}`);
    });

    // 如果没有Markdown文件，生成对应模板的页面
    if (allMarkdownFiles.length === 0) {
        let template;
        if (name === 'index') {
            // 首页使用专用模板
            template = readTemplate('index');
        } else {
            // 其他页面使用默认模板
            template = readTemplate('default');
        }

        if (template) {
            const renderedHtml = renderTemplate(template, {
                title: title,
                icon: icon,
                headerTitle: headerTitle,
                headerSubtitle: headerSubtitle,
                content: '',
                contentClass: contentClass
            });
            const filename = `${name}.html`;
            fs.writeFileSync(filename, renderedHtml);
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
                // 首页的特殊处理
                if (currentPosts.length > 0) {
                    // 最多显示6条内容
                    const maxPosts = 6;
                    const displayPosts = currentPosts.slice(0, maxPosts);
                    const hasMorePosts = currentPosts.length > maxPosts;

                    // 生成文章卡片
                    const postCards = displayPosts.map((item, index) => {
                        // 检查是否是第六条且有更多文章
                        if (hasMorePosts && index === maxPosts - 1) {
                            // 第六条显示更多内容
                            return `
      <div class="post-card" style="cursor: pointer;" onclick="alert('详情请看具体栏目');">
        <h3 class="post-title" style="color: var(--primary);">查看更多文章 →</h3>
        <div class="post-date">共 ${currentPosts.length} 篇文章</div>
        <p class="post-excerpt">还有 ${currentPosts.length - maxPosts + 1} 篇文章未显示，详情请查看具体栏目。</p>
        <div class="post-link" style="color: var(--primary); font-weight: 600;">点击查看 →</div>
      </div>
      `;
                        } else {
                            // 正常显示文章
                            const markdownPath = path.join(__dirname, item.path, 'md', item.file);
                            const { title: postTitle, date: postDate, excerpt } = MarkdownParser.parseMarkdown(markdownPath);
                            const cleanTitle = postTitle || item.file.replace('.md', '').replace(/-/g, ' ');
                            // 使用解析后的日期，如果没有则使用当前日期
                            const displayDate = postDate || item.parsedDate;

                            return `
      <div class="post-card">
        <h3 class="post-title"><a href="${item.path}/html/${item.file.replace('.md', '.html')}" style="color: var(--primary); text-decoration: none;">${cleanTitle}</a></h3>
        <div class="post-date">${displayDate}</div>
        <p class="post-excerpt">${excerpt || '这里是文章摘要...'}</p>
        <a href="${item.path}/html/${item.file.replace('.md', '.html')}" class="post-link">阅读更多 →</a>
      </div>
      `;
                        }
                    }).join('');

                    contentHtml = `
    <div class="posts-grid">
      ${postCards}
    </div>`;
                } else {
                    contentHtml = `
    <div class="empty-container" style="text-align: center; padding: 4rem 1rem;">
      <div style="font-size: 4rem; margin-bottom: 1.5rem; color: var(--primary); opacity: 0.7;">📝</div>
      <h2 style="font-size: 1.8rem; margin-bottom: 1rem; color: var(--text);">暂无文章</h2>
      <p style="font-size: 1.1rem; margin-bottom: 2rem; color: #888;">博客刚起步，正在准备精彩内容，敬请期待！</p>
      <a href="archives.html" style="display: inline-block; padding: 0.8rem 1.8rem; background: var(--primary); color: white; border-radius: 8px; text-decoration: none; font-weight: 500; transition: var(--transition);">浏览归档</a>
    </div>`;
                }
                break;
            case 'archives':
                // 归档栏目的特殊处理：按年份和月份分组
                const groupedPosts = {};

                // 按年份和月份分组文章
                currentPosts.forEach(item => {
                    const markdownPath = path.join(__dirname, item.path, 'md', item.file);
                    const { title: postTitle, date: postDate } = MarkdownParser.parseMarkdown(markdownPath);
                    const cleanTitle = postTitle || item.file.replace('.md', '').replace(/-/g, ' ');

                    // 使用解析后的日期
                    const postDateStr = postDate || item.parsedDate;
                    const year = postDateStr.substring(0, 4);
                    const month = postDateStr.substring(5, 7);

                    if (!groupedPosts[year]) {
                        groupedPosts[year] = {};
                    }
                    if (!groupedPosts[year][month]) {
                        groupedPosts[year][month] = [];
                    }

                    groupedPosts[year][month].push({
                        post: item.file,
                        title: cleanTitle,
                        date: postDateStr,
                        path: `${item.path}/${item.file.replace('.md', '.html')}`
                    });
                });

                // 生成按年份和月份分组的 HTML
                contentHtml = '';
                Object.keys(groupedPosts).sort((a, b) => b.localeCompare(a)).forEach(year => {
                    contentHtml += `
    <div class="archive-year-container">
      <div class="archive-year-decoration"></div>
      <div class="archive-year">${year}年</div>
    </div>`;

                    Object.keys(groupedPosts[year]).sort((a, b) => b.localeCompare(a)).forEach(month => {
                        const monthPosts = groupedPosts[year][month];
                        contentHtml += `
    <div class="archive-month">
      ${parseInt(month)}月 <span class="count">${monthPosts.length}</span>
    </div>
    <ul class="archive-list">`;

                        monthPosts.forEach(postItem => {
                            // 确保路径指向html目录
                            const htmlPath = postItem.path.replace(/\.md$/, '.html').replace(/^(posts\/[^\/]+)\//, '$1/html/');
                            contentHtml += `
      <li class="archive-item">
        <div class="archive-title"><a href="${htmlPath}" style="color: var(--primary); text-decoration: none;">${postItem.title}</a></div>
        <div class="archive-date">${postItem.date}</div>
      </li>`;
                        });

                        contentHtml += `
    </ul>`;
                    });
                });
                break;
            case 'skill':
                // 技术栏目的特殊处理
                contentHtml = currentPosts.map(item => {
                    const markdownPath = path.join(__dirname, item.path, 'md', item.file);
                    const { title: postTitle, date: postDate, categories, languages, excerpt } = MarkdownParser.parseMarkdown(markdownPath);
                    const cleanTitle = postTitle || item.file.replace('.md', '').replace(/-/g, ' ');

                    let itemHtml = `
      <article class="${itemClass}">
        <div class="skill-header">
          <h2 class="${itemTitleClass}"><a href="${item.path}/html/${item.file.replace('.md', '.html')}" style="color: var(--primary); text-decoration: none;">${cleanTitle}</a></h2>
          <div class="skill-meta">`;

                    if (itemDateClass && postDate) {
                        itemHtml += `
            <div class="skill-meta-item">
              <span class="label">日期：</span>
              <span>${postDate || item.parsedDate}</span>
            </div>`;
                    }

                    if (categories.length > 0) {
                        itemHtml += `
            <div class="skill-meta-item">
              <span class="label">类别：</span>
              <span>${categories.join(' · ')}</span>
            </div>`;
                    }

                    if (languages.length > 0) {
                        itemHtml += `
            <div class="skill-meta-item">
              <span class="label">语言：</span>
              <span>${languages.join(' · ')}</span>
            </div>`;
                    }

                    itemHtml += `
          </div>`;

                    if (categories.length > 0 || languages.length > 0) {
                        itemHtml += `
          <div class="skill-tags">
            ${categories.map(cat => `<span class="skill-tag">${cat}</span>`).join(' ')}
            ${languages.map(lang => `<span class="skill-tag">${lang}</span>`).join(' ')}
          </div>`;
                    }

                    itemHtml += `
        </div>
        <div class="${itemExcerptClass}">
          ${excerpt || '这里是文章摘要...'}
        </div>
        <a href="${item.path}/html/${item.file.replace('.md', '.html')}" class="skill-read-more">阅读更多 →</a>
      </article>
      `;

                    return itemHtml;
                }).join('');
                break;
            default:
                // 其他栏目的默认处理
                contentHtml = currentPosts.map(item => {
                    const markdownPath = path.join(__dirname, item.path, 'md', item.file);
                    const { title: postTitle, date: postDate, excerpt } = MarkdownParser.parseMarkdown(markdownPath);
                    const cleanTitle = postTitle || item.file.replace('.md', '').replace(/-/g, ' ');

                    let itemHtml = `
      <article class="${itemClass}">
        <h2 class="${itemTitleClass}"><a href="${item.path}/html/${item.file.replace('.md', '.html')}" style="color: var(--primary); text-decoration: none;">${cleanTitle}</a></h2>`;

                    if (itemDateClass) {
                        itemHtml += `
        <div class="${itemDateClass}">${postDate || item.parsedDate}</div>`;
                    }

                    itemHtml += `
        <div class="${itemExcerptClass}">
          ${excerpt || '这里是文章摘要...'}
        </div>
        <a href="${item.path}/html/${item.file.replace('.md', '.html')}" class="${name}-read-more">阅读更多 →</a>
      </article>
      `;

                    return itemHtml;
                }).join('');
                break;
        }

        // 生成分页部分
        let paginationHtml = '';
        if (name !== 'index' && totalPages > 1) {
            paginationHtml = `
  <div class="pagination">
    ${Array.from({ length: totalPages }, (_, i) => {
        const pageNumber = i + 1;
        return `<a href="${name}${pageNumber === 1 ? '' : '-' + pageNumber}.html" class="page-link ${pageNumber === page ? 'active' : ''}">${pageNumber}</a>`;
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
            // 渲染模板
            const renderedHtml = renderTemplate(template, {
                title: title,
                icon: icon,
                headerTitle: headerTitle,
                headerSubtitle: headerSubtitle,
                content: contentHtml,
                contentClass: contentClass,
                pagination: paginationHtml
            });

            // 写入文件
            const filename = page === 1 ? `${name}.html` : `${name}-${page}.html`;
            fs.writeFileSync(filename, renderedHtml);
            console.log(`Generated ${filename}`);
        }
    }

    return totalPages;
}

// 读取模板文件的函数
function readTemplate(templateName) {
    const templatePath = path.join(__dirname, 'templates', `${templateName}-template.html`);
    if (fs.existsSync(templatePath)) {
        return fs.readFileSync(templatePath, 'utf8');
    }
    return null;
}

// 读取导航栏模板的函数
function readNavTemplate() {
    const navTemplatePath = path.join(__dirname, 'templates', 'nav-template.html');
    if (fs.existsSync(navTemplatePath)) {
        return fs.readFileSync(navTemplatePath, 'utf8');
    }
    // 默认导航栏
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

// 渲染模板的函数
function renderTemplate(template, data) {
    let rendered = template;
    // 添加导航栏
    const navTemplate = readNavTemplate();
    rendered = rendered.replace(/\{\{nav\}\}/g, navTemplate);
    // 添加其他数据
    Object.keys(data).forEach(key => {
        const regex = new RegExp(`\\{\\{${key}\\}\}`, 'g');
        rendered = rendered.replace(regex, data[key]);
    });

    // 处理条件语法 {{content ? 'none' : 'block'}}
    rendered = rendered.replace(/\{\{([^}]+) \? ([^}]+) : ([^}]+)\}\}/g, (match, condition, trueValue, falseValue) => {
        const value = data[condition.trim()];
        // 移除返回值中的引号
        const result = value ? trueValue : falseValue;
        return result.replace(/['"]/g, '');
    });

    return rendered;
}

// 为每个页面生成分页
let totalGenerated = 0;
pageConfigs.forEach(config => {
    const pages = generatePage(config);
    totalGenerated += pages;
});

// 修改GitHub Actions配置文件，确保它能提交所有生成的HTML文件
const workflowPath = path.join(__dirname, '.github', 'workflows', 'pagination.yml');
if (fs.existsSync(workflowPath)) {
    let workflowContent = fs.readFileSync(workflowPath, 'utf8');
    workflowContent = workflowContent.replace(/git add index.html index-\*.html.*?/g, 'git add index.html index-*.html project.html project-*.html skill.html skill-*.html daily.html daily-*.html archives.html archives-*.html posts/**/*.html ');
    fs.writeFileSync(workflowPath, workflowContent);
    console.log('Updated GitHub Actions workflow file');
}

console.log(`\nGenerated ${totalGenerated} pagination pages in total.`);
