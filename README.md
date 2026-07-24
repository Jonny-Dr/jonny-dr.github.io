# 🌱 北辰的博客

> 用文字记录思考，用代码丈量世界 ✨  
> *个人技术博客 | 分享成长、技术与生活点滴*

[![GitHub Pages](https://img.shields.io/badge/GitHub%20Pages-Deployed-success?logo=github)](https://jonny-dr.github.io)
[![License: CC BY-NC 4.0](https://img.shields.io/badge/License-CC%20BY--NC%204.0-lightgrey.svg)](https://creativecommons.org/licenses/by-nc/4.0/)

---

## ✨ 特性
- 🚀 **静态网站**: 基于原生 HTML、CSS 和 JavaScript 构建
- 🌙 **暗色模式**: 支持深色/浅色主题无缝切换，自动保存用户偏好
- 📱 **响应式设计**: 完美适配各种设备屏幕
- ⚡ **高性能**: 静态生成，快速加载
- 🎨 **优雅设计**: 精心设计的 UI，注重用户体验
- 🎵 **背景音乐**: 内置背景音乐播放器，页面切换不中断
- 📝 **Markdown 支持**: 使用 marked 库解析，支持完整 GFM 语法
- 🔧 **自动分页**: 各栏目自动分页，归档按年/月分组
- 💬 **评论系统**: 集成 Giscus 评论
- 📁 **模块化结构**: 清晰的目录结构，易于维护

---

## 🛠 技术栈
| 模块       | 工具/技术           |
|------------|---------------------|
| 前端技术   | HTML5, CSS3, JavaScript |
| 部署方式   | GitHub Pages        |
| 自动化部署 | GitHub Actions      |
| Markdown 解析 | marked (npm 库)     |
| 代码高亮   | highlight.js        |
| 评论系统   | Giscus              |

---

## 📁 项目结构

```
├── css/                   # 样式文件
│   └── common.css         # 通用样式（含主题变量）
├── images/                # 图片资源
│   ├── days/              # 日常图片
│   ├── head/              # 头部背景
│   └── music/             # 背景音乐
├── js/                    # JavaScript 文件
│   └── theme.js           # 主题切换、音乐控制、SPA 路由
├── posts/                 # 文章目录
│   ├── archives/          # 归档文章
│   │   ├── md/            # Markdown 源文件
│   │   │   └── assets/    # 文章图片
│   │   └── html/          # 生成的 HTML 文件
│   ├── daily/             # 日常文章
│   ├── project/           # 项目文章
│   └── skill/             # 技术文章
├── templates/             # 页面模板
│   ├── archives-template.html
│   ├── daily-template.html
│   ├── default-template.html
│   ├── index-template.html
│   ├── nav-template.html
│   └── skill-template.html
├── .github/workflows/     # GitHub Actions 配置
│   └── pagination.yml     # 自动部署工作流
├── .gitignore             # Git 忽略配置
├── deploy.sh              # 一键部署脚本
├── generate-pagination.js # 页面生成脚本
├── markdown-parser.js     # Markdown 解析模块（基于 marked）
├── package.json           # npm 依赖配置
├── package-lock.json      # 依赖版本锁定
├── transfer-images.js     # 图片迁移工具
└── README.md              # 项目说明
```

---

## 🚀 快速开始

### 本地开发

1. **克隆仓库**
```bash
git clone https://github.com/jonny-dr/jonny-dr.github.io.git
cd jonny-dr.github.io
```

2. **安装依赖**
```bash
npm install
```

3. **启动本地服务器**
```bash
python3 -m http.server 8000
```

4. **访问网站**
打开浏览器访问 `http://localhost:8000`

### 发布新文章（推荐使用一键部署）

**最简单的方式**：使用 `deploy.sh` 一键部署脚本

```bash
# 给脚本添加执行权限（首次使用）
chmod +x deploy.sh

# 执行一键部署
./deploy.sh
```

**手动部署步骤**：

1. **在对应目录创建 Markdown 文件**
   - 技术文章: `posts/skill/md/`
   - 日常文章: `posts/daily/md/`
   - 项目文章: `posts/project/md/`
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

### deploy.sh - 一键部署脚本

**功能**：一站式完成图片迁移、页面生成、代码提交和推送。

**使用方法**：
```bash
# 给脚本添加执行权限（首次使用）
chmod +x deploy.sh

# 执行一键部署
./deploy.sh

# 自定义提交信息
./deploy.sh "添加新文章：Redis 分布式锁详解"
```

**工作流程**：
1. 检查依赖是否安装
2. 迁移 Markdown 中引用的本地图片到项目目录
3. 生成所有页面的 HTML 文件
4. 自动添加、提交并推送到 GitHub
5. 提示部署完成

### transfer-images.js - 图片迁移工具

**功能**：将 Markdown 文件中引用的本地绝对路径图片（如 Typora 生成的图片）迁移到项目对应的 assets 目录，并自动更新 Markdown 中的图片路径。

**使用方法**：
```bash
# 预览模式（查看哪些图片会被迁移，不实际执行）
node transfer-images.js --dry-run

# 处理所有分类
node transfer-images.js

# 只处理指定分类
node transfer-images.js --category=skill

# 指定 Typora 图片路径
node transfer-images.js --typora-path=~/Pictures/Typora

# 显示帮助
node transfer-images.js --help
```

**配置方式**（优先级从高到低）：
1. 命令行参数: `--typora-path=/path/to/images`
2. 环境变量: `TYPORA_IMAGE_PATH=/path/to/images`
3. `.env` 文件: `TYPORA_IMAGE_PATH=/path/to/images`
4. 自动检测（支持 macOS、Windows、Linux）

### generate-pagination.js - 页面生成脚本

**功能**：扫描所有 Markdown 文件，生成栏目分页页面和文章详情页面。

**使用方法**：
```bash
node generate-pagination.js
```

**生成内容**：
- 首页: `index.html`
- 技术栏目: `skill.html`, `skill-2.html`, ...
- 日常栏目: `daily.html`, `daily-2.html`, ...
- 项目栏目: `project.html`, `project-2.html`, ...
- 归档栏目: `archives.html`, `archives-2.html`, ...
- 文章详情: `posts/{category}/html/*.html`

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

### 支持的 Markdown 特性
- ✅ 标题层级（# - ######）
- ✅ 代码块（带语法高亮）
- ✅ 表格（GFM 语法）
- ✅ 列表（有序/无序/任务列表）
- ✅ 引用块
- ✅ 加粗/斜体/删除线
- ✅ 图片（支持本地 assets 路径）
- ✅ 链接（自动添加 target="_blank"）
- ✅ 水平分割线
- ✅ YAML Front Matter

---

## 🎨 特色功能

### 主题切换
- 支持亮色/暗色模式
- 自动检测系统偏好
- 自动保存用户选择到 localStorage
- 平滑过渡动画

### 背景音乐
- 内置背景音乐播放器
- 页面切换时音乐不中断（SPA 效果）
- 音乐播放状态自动保存
- 支持暂停/播放控制

### SPA 路由
- 页面切换无刷新
- 保留音乐播放状态
- 自动重新初始化 highlight.js 和 Giscus

### 评论系统
- 集成 Giscus（基于 GitHub Discussions）
- 支持表情反应
- 支持深色/浅色主题适配

---

## 🔧 环境配置

### .gitignore

项目已配置 `.gitignore`，忽略以下文件：
- `node_modules/` - npm 依赖目录
- `.env` - 环境变量配置
- `.DS_Store` - macOS 系统文件
- `Thumbs.db` - Windows 系统文件
- `*.log` - 日志文件
- `*.tmp` - 临时文件

### package.json

项目依赖：
- `marked`: Markdown 解析库（v18+）

### GitHub Actions

自动部署工作流：
- 触发条件: 推送到 main/master 分支，且修改了 posts/ 或相关脚本
- 流程: Checkout → Setup Node.js → npm install → 生成页面 → Commit → Push → Deploy

---

## 📄 许可

本博客采用 [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/) 许可协议。

---

## 🌐 访问地址

- **博客地址**: [https://jonny-dr.github.io](https://jonny-dr.github.io)
- **GitHub 仓库**: [https://github.com/jonny-dr/jonny-dr.github.io](https://github.com/jonny-dr/jonny-dr.github.io)

---

> ✨ 感谢您的访问！希望我的博客能为您带来价值。