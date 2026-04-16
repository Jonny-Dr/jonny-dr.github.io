# 🌱 北辰的博客

> 用文字记录思考，用代码丈量世界 ✨  
> *个人技术博客 | 分享成长、技术与生活点滴*

[![GitHub Pages](https://img.shields.io/badge/GitHub%20Pages-Deployed-success?logo=github)](https://jonny-dr.github.io)
[![License: CC BY-NC 4.0](https://img.shields.io/badge/License-CC%20BY--NC%204.0-lightgrey.svg)](https://creativecommons.org/licenses/by-nc/4.0/)

---

## ✨ 特性
- 🚀 **静态网站**: 基于原生 HTML、CSS 和 JavaScript 构建
- 🌙 **暗色模式**: 支持深色/浅色主题无缝切换
- 📱 **响应式设计**: 完美适配各种设备屏幕
- ⚡ **高性能**: 静态生成，快速加载
- 🎨 **优雅设计**: 精心设计的 UI，注重用户体验
- 🎵 **背景音乐**: 内置背景音乐播放器，支持控制
- 📝 **Markdown 支持**: 使用 Markdown 编写文章，自动生成 HTML
- 🔧 **自动分页**: 实现各栏目的自动分页功能
- 📁 **模块化结构**: 清晰的目录结构，易于维护

---

## 🛠 技术栈
| 模块       | 工具/技术           |
|------------|---------------------|
| 前端技术   | HTML5, CSS3, JavaScript |
| 部署方式   | GitHub Pages        |
| 自动化部署 | GitHub Actions      |
| Markdown 解析 | 自定义 MarkdownParser 模块 |
| 页面生成   | 自定义 generate-pagination.js 脚本 |

---

## 📁 项目结构

```
├── css/               # 样式文件
│   └── common.css     # 通用样式
├── images/            # 图片资源
│   ├── days/          # 日常图片
│   ├── head/          # 头部背景
│   └── music/         # 背景音乐
├── js/                # JavaScript 文件
│   └── theme.js       # 主题切换和音乐控制
├── posts/             # 文章目录
│   ├── archives/      # 归档文章
│   ├── daily/         # 日常文章
│   └── skill/         # 技术文章
├── templates/         # 页面模板
│   ├── archives-template.html
│   ├── daily-template.html
│   ├── default-template.html
│   ├── index-template.html
│   ├── nav-template.html
│   └── skill-template.html
├── generate-pagination.js  # 页面生成脚本
├── markdown-parser.js      # Markdown 解析模块
├── README.md               # 项目说明
└── *.html                  # 生成的静态页面
```

---

## 🚀 快速开始

### 本地开发

1. **克隆仓库**
```bash
git clone https://github.com/jonny-dr/jonny-dr.github.io.git
cd jonny-dr.github.io
```

2. **启动本地服务器**
```bash
python3 -m http.server 8000
```

3. **访问网站**
打开浏览器访问 `http://localhost:8000`

### 发布新文章

1. **在对应目录创建 Markdown 文件**
   - 技术文章: `posts/skill/md/`
   - 日常文章: `posts/daily/md/`
   - 归档文章: `posts/archives/md/`

2. **（可选）迁移本地图片**
   
   如果使用 Typora 等工具编辑，图片可能保存在本地绝对路径。运行图片迁移工具：
   ```bash
   # 预览模式（查看哪些图片会被迁移）
   node transfer-images.js --dry-run
   
   # 实际执行迁移
   node transfer-images.js
   
   # 只处理特定分类
   node transfer-images.js --category=skill
   ```

3. **运行生成脚本**
```bash
node generate-pagination.js
```

4. **推送代码到 GitHub**
```bash
git add .
git commit -m "Add new article"
git push origin main
```

5. **GitHub Actions 自动部署**
   - 代码推送后，GitHub Actions 会自动运行部署流程
   - 部署完成后，访问 `https://jonny-dr.github.io` 查看

---

## 🛠 工具脚本

### transfer-images.js - 图片迁移工具

**功能**：将 Markdown 文件中引用的本地绝对路径图片（如 Typora 生成的图片）迁移到项目对应的 assets 目录，并自动更新 Markdown 中的图片路径。

**使用场景**：
- 使用 Typora 编辑 Markdown 时，图片默认保存在 `/Users/xxx/Library/Application Support/typora-user-images/`
- 这些本地路径在 GitHub Pages 上无法访问
- 运行此工具自动迁移图片到项目目录

**目录结构**：
```
posts/
  ├── skill/
  │   ├── md/
  │   │   ├── article.md
  │   │   └── assets/          # skill 分类的图片目录
  │   └── html/
  │       └── assets/          # 自动生成，用于 HTML 引用
  ├── daily/
  │   ├── md/
  │   │   └── assets/          # daily 分类的图片目录
  │   └── html/
  └── ...
```

**使用方法**：
```bash
# 预览模式（查看哪些图片会被迁移，不实际执行）
node transfer-images.js --dry-run

# 处理所有分类
node transfer-images.js

# 只处理指定分类
node transfer-images.js --category=skill

# 显示帮助
node transfer-images.js --help
```

**工作流程**：
1. 扫描指定分类下的所有 Markdown 文件
2. 提取其中引用的本地绝对路径图片
3. 将图片复制到对应分类的 `md/assets/` 目录
4. 更新 Markdown 文件中的图片路径为相对路径 `assets/xxx.png`
5. 将图片同步复制到 `html/assets/` 目录供 HTML 文件引用

---

## 📝 文章格式

### Markdown 文章结构

```markdown
---
title: 文章标题
date: 2026-02-12
categories: [分类1, 分类2]
languages: [语言1, 语言2]
originalLink: 原文链接（可选）
excerpt: 文章摘要（可选）
---

## 正文标题

文章内容...

![图片描述](assets/image.png)
```

### 命名规范
- 文件名格式: `YYYY-MM-DD-文章标题.md`
- 例如: `2026-02-12-壁纸分享.md`

---

## 🎨 特色功能

### 主题切换
- 支持亮色/暗色模式
- 自动保存用户偏好
- 平滑过渡动画

### 背景音乐
- 内置背景音乐播放器
- 页面切换时音乐不中断
- 音乐符号图标控制

### Markdown 解析
- 支持 YAML front matter
- 代码语法高亮
- 图片路径自动处理
- 完整的 Markdown 语法支持

### 自动分页
- 各栏目自动分页
- 首页显示最新文章
- 归档页面按年/月分组

---

## 🔧 核心脚本

### generate-pagination.js
- 生成各栏目页面
- 实现分页功能
- 处理文章列表

### markdown-parser.js
- 解析 Markdown 文件
- 提取 front matter
- 转换 Markdown 为 HTML
- 处理图片路径

---

## 📄 许可

本博客采用 [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/) 许可协议。

---

## 🌐 访问地址

- **博客地址**: [https://jonny-dr.github.io](https://jonny-dr.github.io)
- **GitHub 仓库**: [https://github.com/jonny-dr/jonny-dr.github.io](https://github.com/jonny-dr/jonny-dr.github.io)

---

> ✨ 感谢您的访问！希望我的博客能为您带来价值。
