const fs = require('fs');
const path = require('path');

// 解析Markdown文件内容的函数
function parseMarkdown(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    
    // 提取标题（支持YAML front matter格式）
    let title = '无标题';
    const yamlTitleMatch = content.match(/^---[\s\S]*?title:\s+([^\n]+)[\s\S]*?---/m);
    if (yamlTitleMatch) {
        title = yamlTitleMatch[1].trim();
    } else {
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
    
    // 提取日期（支持YAML front matter格式）
    let date = '';
    const yamlDateMatch = content.match(/^---[\s\S]*?date:\s+(\d{4}-\d{2}-\d{2})[\s\S]*?---/m);
    if (yamlDateMatch) {
        date = yamlDateMatch[1];
    } else {
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
    
    // 提取摘要（假设摘要在YAML front matter之后，直到第一个二级标题之前）
    let excerpt = '';
    const yamlContentMatch = content.match(/^---[\s\S]*?---[\s\S]*?(?=^##|$)/m);
    if (yamlContentMatch) {
        excerpt = yamlContentMatch[0].replace(/^---[\s\S]*?---/m, '').trim();
    }
    
    // 如果没有提取到摘要，使用前100个字符作为摘要
    if (!excerpt) {
        const cleanContent = content.replace(/^---[\s\S]*?---/m, '').replace(/^#\s+.*$/m, '').trim();
        excerpt = cleanContent.substring(0, 100) + (cleanContent.length > 100 ? '...' : '');
    }
    
    // 移除YAML front matter，只保留文章正文
    const cleanContent = content.replace(/^---[\s\S]*?---/m, '').trim();
    
    return { title, date, excerpt, content: cleanContent };
}

// 将Markdown转换为HTML的函数（简单实现）
function markdownToHtml(markdown) {
    // 转换标题
    let html = markdown.replace(/^###\s+(.*)$/gm, '<h3>$1</h3>');
    html = html.replace(/^##\s+(.*)$/gm, '<h2>$1</h2>');
    html = html.replace(/^#\s+(.*)$/gm, '<h1>$1</h1>');
    
    // 转换段落
    html = html.replace(/^(?!<h[1-6]>)(.*)$/gm, '<p>$1</p>');
    
    // 转换链接
    html = html.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2">$1</a>');
    
    // 转换粗体
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    
    // 转换斜体
    html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
    
    return html;
}

// 为Markdown文件生成HTML文件的函数
function generateHtmlFromMarkdown(markdownPath, htmlPath) {
    const { title, date, content } = parseMarkdown(markdownPath);
    const htmlContent = markdownToHtml(content);
    
    const htmlTemplate = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} | 北辰</title>
  <link rel="stylesheet" href="../../css/common.css">
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
    }
    .post-body {
      margin-bottom: 2rem;
    }
    .post-body h2 {
      font-size: 1.8rem;
      margin: 2rem 0 1rem;
      color: var(--primary);
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
    @media (max-width: 768px) {
      .post-content {
        padding: 0 1rem;
      }
      .post-header h1 {
        font-size: 1.8rem;
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

  <header>
    <h1>📝 北辰的博客</h1>
    <p class="subtitle">记录思考，分享成长 | 一个热爱技术的探索者</p>
    <nav>
      <a href="../../index.html">首页</a>
      <a href="../../project.html">项目</a>
      <a href="../../about.html">关于</a>
      <a href="../../archives.html">归档</a>
      <a href="../../daily.html">日常</a>
      <a href="https://github.com/" target="_blank" rel="noopener">GitHub</a>
    </nav>
  </header>

  <main class="post-content">
    <article>
      <div class="post-header">
        <h1>${title}</h1>
        ${date ? `<div class="post-meta">发布日期：${date}</div>` : ''}
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

  <script src="../../js/theme.js"></script>
</body>
</html>
  `;
    
    // 确保目录存在
    const htmlDir = path.dirname(htmlPath);
    if (!fs.existsSync(htmlDir)) {
        fs.mkdirSync(htmlDir, { recursive: true });
    }
    
    fs.writeFileSync(htmlPath, htmlTemplate);
    console.log(`Generated HTML file: ${htmlPath}`);
}

// 页面配置
const pageConfigs = [
    {
        name: 'index',
        title: '📝 博客首页 | 北辰',
        headerTitle: '📝 北辰的博客',
        headerSubtitle: '记录思考，分享成长 | 一个热爱技术的探索者',
        contentClass: 'post-list',
        itemClass: 'post-item',
        itemTitleClass: 'post-title',
        itemDateClass: 'post-date',
        itemExcerptClass: 'post-excerpt',
        postsPerPage: 5,
        directory: '_posts/blog'
    },
    {
        name: 'project',
        title: '☕️ 个人项目 | 北辰',
        headerTitle: '☕️ 个人项目',
        headerSubtitle: '分享我开发的项目和技术实践',
        contentClass: 'project-container',
        itemClass: 'project-card',
        itemTitleClass: 'project-title',
        itemDateClass: '',
        itemExcerptClass: 'project-desc',
        postsPerPage: 6,
        directory: '_posts/blog'
    },
    {
        name: 'daily',
        title: '✨ 日常 | 北辰',
        headerTitle: '✨ 日常',
        headerSubtitle: '生活点滴记录 | 感悟与思考',
        contentClass: 'daily-container',
        itemClass: 'daily-item',
        itemTitleClass: 'daily-title',
        itemDateClass: 'daily-date',
        itemExcerptClass: 'daily-content',
        postsPerPage: 4,
        directory: '_posts/blog'
    }
];

// 生成页面函数
function generatePage(pageConfig) {
    const { name, title, headerTitle, headerSubtitle, contentClass, itemClass, itemTitleClass, itemDateClass, itemExcerptClass, postsPerPage, directory } = pageConfig;

    // 读取目录下的所有文章
    const postsDir = path.join(__dirname, directory);
    if (!fs.existsSync(postsDir)) {
        console.log(`Directory ${directory} does not exist. Skipping ${name} page.`);
        return 0;
    }

    const files = fs.readdirSync(postsDir);
    const markdownFiles = files.filter(file => file.endsWith('.md'));

    // 按日期排序（最新在前）
    markdownFiles.sort((a, b) => {
        const dateA = a.substring(0, 10);
        const dateB = b.substring(0, 10);
        return dateB.localeCompare(dateA);
    });

    // 计算总页数
    const totalPages = Math.ceil(markdownFiles.length / postsPerPage);

    // 为每个Markdown文件生成HTML文件
    markdownFiles.forEach(post => {
        const markdownPath = path.join(postsDir, post);
        const htmlPath = path.join(__dirname, directory, post.replace('.md', '.html'));
        generateHtmlFromMarkdown(markdownPath, htmlPath);
    });



    // 生成分页文件
    for (let page = 1; page <= totalPages; page++) {
        const start = (page - 1) * postsPerPage;
        const end = start + postsPerPage;
        const currentPosts = markdownFiles.slice(start, end);

        // 生成页面内容
        const htmlContent = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <link rel="stylesheet" href="css/common.css">
  <style>
    .${contentClass} {
      max-width: 800px;
      margin: 0 auto;
    }
    .${itemClass} {
      background: var(--card-bg);
      border-radius: 12px;
      padding: 1.5rem;
      margin-bottom: 1.8rem;
      border: 1px solid var(--border);
      box-shadow: var(--shadow);
      transition: var(--transition);
    }
    .${itemClass}:hover {
      transform: translateY(-3px);
      box-shadow: 0 5px 20px rgba(0,0,0,0.1);
    }
    .${itemTitleClass} {
      font-size: 1.6rem;
      margin-bottom: 0.8rem;
      color: var(--primary);
      font-weight: 600;
    }
    ${itemDateClass ? `.${itemDateClass} {
      color: #888;
      font-size: 0.95rem;
      margin-bottom: 0.5rem;
    }` : ''}
    .${itemExcerptClass} {
      line-height: 1.7;
      color: #555;
    }
    @media (max-width: 768px) {
      .${contentClass} { padding: 0 1rem; }
    }
  </style>
</head>
<body>
  <button class="theme-toggle" id="themeToggle" aria-label="切换主题">
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
    </svg>
  </button>

  <header>
    <h1>${headerTitle}</h1>
    <p class="subtitle">${headerSubtitle}</p>
    <nav>
      <a href="index.html">首页</a>
      <a href="project.html">项目</a>
      <a href="about.html">关于</a>
      <a href="archives.html">归档</a>
      <a href="daily.html">日常</a>
      <a href="https://github.com/" target="_blank" rel="noopener">GitHub</a>
    </nav>
  </header>

  <main class="${contentClass}">
    ${currentPosts.map(post => {
        const markdownPath = path.join(postsDir, post);
        const { title: postTitle, date: postDate, excerpt } = parseMarkdown(markdownPath);
        const cleanTitle = postTitle || post.replace('.md', '').replace(/-/g, ' ');
        
        let itemHtml = `
      <article class="${itemClass}">
        <h2 class="${itemTitleClass}"><a href="${directory}/${post.replace('.md', '.html')}" style="color: var(--primary); text-decoration: none;">${cleanTitle}</a></h2>`;
        
        if (itemDateClass) {
            itemHtml += `
        <div class="${itemDateClass}">${postDate || post.substring(0, 10)}</div>`;
        }
        
        itemHtml += `
        <div class="${itemExcerptClass}">
          ${excerpt || '这里是文章摘要...'}
        </div>
      </article>
      `;
        
        return itemHtml;
    }).join('')}
  </main>

  <div class="pagination">
    ${Array.from({ length: totalPages }, (_, i) => {
        const pageNumber = i + 1;
        return `<a href="${name}${pageNumber === 1 ? '' : '-' + pageNumber}.html" class="page-link ${pageNumber === page ? 'active' : ''}">${pageNumber}</a>`;
    }).join('')}
  </div>

  <footer>
    <p>© 2026 北辰 · 保持好奇，持续成长</p>
    <p style="margin-top: 6px; font-size: 0.9rem; color: #aaa;">
      本博客采用 <a href="https://creativecommons.org/licenses/by-nc/4.0/" style="color: var(--primary);">CC BY-NC 4.0</a> 许可 | 
      源码托管于 <a href="https://github.com/" style="color: var(--primary);">GitHub</a>
    </p>
  </footer>

  <script src="js/theme.js"></script>
</body>
</html>
  `;

    // 写入文件
    const filename = page === 1 ? `${name}.html` : `${name}-${page}.html`;
    fs.writeFileSync(filename, htmlContent);
    console.log(`Generated ${filename}`);
  }

  return totalPages;
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
    workflowContent = workflowContent.replace(/git add index.html index-\*.html.*?/g, 'git add index.html index-*.html project.html project-*.html daily.html daily-*.html _posts/**/*.html ');
    fs.writeFileSync(workflowPath, workflowContent);
    console.log('Updated GitHub Actions workflow file');
}

console.log(`\nGenerated ${totalGenerated} pagination pages in total.`);
