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
   - 技术文章: `posts/skill/`
   - 日常文章: `posts/daily/`
   - 归档文章: `posts/archives/`

2. **运行生成脚本**
```bash
node generate-pagination.js
```

3. **推送代码到 GitHub**
```bash
git add .
git commit -m "Add new article"
git push origin main
```

4. **GitHub Actions 自动部署**
   - 代码推送后，GitHub Actions 会自动运行部署流程
   - 部署完成后，访问 `https://jonny-dr.github.io` 查看

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
