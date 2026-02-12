const fs = require('fs');
const path = require('path');

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

// 更新about.html文件的导航栏
function updateAboutNav() {
    const aboutPath = path.join(__dirname, 'about.html');
    if (!fs.existsSync(aboutPath)) {
        console.log('about.html file not found');
        return;
    }
    
    let content = fs.readFileSync(aboutPath, 'utf8');
    const navTemplate = readNavTemplate();
    
    // 替换{{nav}}占位符
    if (content.includes('{{nav}}')) {
        content = content.replace(/\{\{nav\}\}/g, navTemplate);
        fs.writeFileSync(aboutPath, content);
        console.log('Updated navigation in about.html');
    } else {
        console.log('{{nav}} placeholder not found in about.html');
    }
}

// 执行更新
updateAboutNav();
