const fs = require('fs');
const path = require('path');

// 项目根目录（本脚本位于 js/ 下）
const ROOT_DIR = path.join(__dirname, '..');

// 读取导航栏模板的函数
function readNavTemplate() {
    const navTemplatePath = path.join(ROOT_DIR, 'templates', 'nav-template.html');
    if (fs.existsSync(navTemplatePath)) {
        return fs.readFileSync(navTemplatePath, 'utf8');
    }
    // 默认导航栏（指向新的子目录结构）
    return `
<nav>
  <a href="./index.html">首页</a>
  <a href="./html/project/project.html">项目</a>
  <a href="./html/skill/skill.html">技术</a>
  <a href="./html/ai/ai.html">AI</a>
  <a href="./html/daily/daily.html">日常</a>
  <a href="./about.html">关于</a>
  <a href="./archives.html">归档</a>
  <a href="https://github.com/" target="_blank" rel="noopener">GitHub</a>
</nav>`;
}

// 更新about.html文件的导航栏
function updateAboutNav() {
    const aboutPath = path.join(ROOT_DIR, 'about.html');
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
