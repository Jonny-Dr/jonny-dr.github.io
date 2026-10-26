# 北辰的博客

记录后端开发、AI 工程、项目实践与日常思考的个人静态博客。

- 网站：[jonny-dr.github.io](https://jonny-dr.github.io)
- 仓库：[Jonny-Dr/jonny-dr.github.io](https://github.com/Jonny-Dr/jonny-dr.github.io)
- 操作速查：[use-flow.txt](use-flow.txt)

## 项目概览

项目使用原生 HTML、CSS、JavaScript 与 Node.js 自建生成脚本。文章以 Markdown 文件维护，生成后的 HTML 随源码一起提交，由 GitHub Actions 发布到 GitHub Pages。

```text
编写 Markdown / 修改模板、样式
              ↓
本地图片迁移（如需要）
              ↓
检查文章 → 生成页面 → 检查生成结果
              ↓
本地浏览 → 提交并推送
              ↓
GitHub Actions 构建 → 上传构建产物 → GitHub Pages 发布
```

当前首页、关于、技术、AI、项目、日常和归档使用统一的横幅、内容宽度、卡片与按钮。技术和 AI 支持主分类导航；归档按年月分组。主题偏好保存在本地，站内链接通过 JavaScript 切换页面并更新导航状态。文章页集成 highlight.js 和 Giscus，相关资源需要联网加载。

## 环境与本地运行

需要 Node.js 20 或更高版本、npm 和 Git；`deploy.sh` 需要 Bash。以下本地预览方式还需要 Python 3。Windows 可在 Git Bash 或 WSL 中使用部署脚本。

```bash
git clone https://github.com/Jonny-Dr/jonny-dr.github.io.git
cd jonny-dr.github.io
npm ci
npm run build:site
python3 -m http.server 8000
```

打开 [本地首页](http://localhost:8000/)。预览服务器在前台运行，停止时按 `Ctrl+C`；也可以另开终端继续操作。修改文章或模板后需要重新构建，再刷新页面。请通过 HTTP 服务器预览，以便站内页面切换正常工作。

npm 当前唯一直接依赖是 `marked`（`^18.0.7`），具体安装版本由 `package-lock.json` 锁定。

## 目录与文件职责

```text
.
├── index.html                     # 生成的首页
├── about.html                     # 手工维护介绍；构建同步导航、技术栈和资源版本
├── archives.html                  # 生成的归档入口
├── html/{skill,ai,project,daily}/  # 生成的栏目、分页和分类页面
├── posts/
│   ├── skill/                     # 技术文章
│   ├── ai/                        # AI 文章
│   ├── project/                   # 项目实践
│   ├── daily/                     # 日常文章
│   ├── archives/                  # 独立维护的归档文章
│   └── index/                     # 可选首页来源，生成器会创建 md/html 目录
│       # 各文章模块使用 md/*.md、md/assets/ 和 html/*.html
├── templates/
│   ├── index-template.html        # 首页布局
│   ├── skill-template.html        # 技术栏目与分类页
│   ├── ai-template.html           # AI 栏目与分类页
│   ├── daily-template.html        # 日常栏目
│   ├── archives-template.html     # 归档布局
│   ├── default-template.html      # 项目栏目使用的回退模板
│   ├── nav-template.html          # 公共导航
│   └── skills-template.html       # 首页与关于页共享的技术栈内容
├── css/common.css                 # 全站主题、卡片、按钮及响应式样式
├── js/
│   ├── generate-pagination.js     # 页面配置、文章汇总、卡片和分页生成
│   ├── markdown-parser.js         # 头部信息解析、Markdown 转换、详情页及资源版本
│   ├── check-content.js           # 内容、栏目分页和本地引用检查
│   ├── theme.js                   # 主题、站内跳转、音乐、返回顶部及文章交互初始化
│   ├── transfer-images.js         # 本地图片迁移工具
│   └── update-about-nav.js        # 旧导航占位符工具，当前日常构建无需单独运行
├── images/                        # 背景、头像、日常图片及音乐
├── .github/workflows/pagination.yml
├── deploy.sh
├── package.json / package-lock.json
├── use-flow.txt
└── README.md
```

`posts/` 中还保留了空目录、压缩包或配套资料；它们不等同于已配置的文章栏目。技术与 AI 的规范文档分别位于 [技术文章规范](posts/skill/CONTENT_GUIDE.md) 和 [AI 文章规范](posts/ai/CONTENT_GUIDE.md)。

## 栏目、入口与分页

| 页面 | Markdown 来源 | 生成入口 | 展示规则 |
| --- | --- | --- | --- |
| 首页 | project、daily、index、skill、ai | `index.html` | 按日期倒序，展示最新 5 篇 |
| 技术 | `posts/skill/md/` | `html/skill/skill.html` | 每页 6 篇，另有 6 个分类页 |
| AI | `posts/ai/md/` | `html/ai/ai.html` | 每页 6 篇，另有 5 个分类页 |
| 项目 | `posts/project/md/` | `html/project/project.html` | 每页 6 篇 |
| 日常 | `posts/daily/md/` | `html/daily/daily.html` | 每页 4 篇 |
| 归档 | `posts/archives/md/` | `archives.html` | 每页 10 篇，页内按年月分组 |
| 关于 | `about.html` | `about.html` | 介绍、共享技术栈、联系方式 |

第二页起使用 `skill-2.html`、`ai-2.html` 等名称；归档分页位于根目录，如 `archives-2.html`。技术和 AI 的分类页面位于各自栏目目录，名称为 `category-<分类标识>.html`，目前不分页。

归档只读取自己的源目录，不会自动汇总全站文章，也不参与首页最新文章列表。文章详情输出到 `posts/<模块>/html/<原文件名>.html`。

## 编写与整理文章

### 文件位置和头部信息

文件名使用 `YYYY-MM-DD-标题.md`，直接放在对应模块的 `md/` 下。当前生成器不递归读取 Markdown 子目录；分类通过元信息表达。

```markdown
---
title: Redis 分布式锁实践
date: 2026-10-26
category: 缓存与中间件
tags: [Redis, 分布式锁, 高可用]
languages: [Java]
excerpt: 说明锁的获取、续期、释放及故障处理方式。
---

# Redis 分布式锁实践

正文内容。

![示意图](assets/redis-lock.png)
```

| 字段 | 用途 |
| --- | --- |
| `title` | 文章标题，新文章应显式填写 |
| `date` | 显示和排序日期，使用有效的 `YYYY-MM-DD` |
| `category` | 一个主分类，技术与 AI 必须使用对应规范中的名称 |
| `tags` | 主题标签数组，至少 1 个，通常 2～5 个 |
| `languages` | 可选的语言或技术数组 |
| `excerpt` | 卡片摘要，建议填写简短纯文本 |
| `categories` | 兼容旧文章的分类数组；展示优先使用 `category` |
| `originalLink` | 可选的原文链接 |

新文章统一填写 `title`、`date`、`category`、`tags` 和 `excerpt`。AI 校验要求提供头部信息、合法主分类与非空标签；技术文章提供头部信息时也会检查主分类和标签。其他历史无头部文章仍兼容，标题和日期可从正文、文件名回退，摘要可从正文提取。

头部信息是自定义解析器实现，并非完整 YAML。建议使用上述简单字段及行内数组；也支持缩进列表数组。摘要优先使用单行，避免复杂嵌套或多行结构造成校验不兼容。

`date` 控制显示和排序，不会按日期延迟发布。文件名决定详情页地址；单独修改 `date` 不会重命名 URL。

### 技术和 AI 主分类

- 技术：Java 与 JVM、数据库、缓存与中间件、分布式与微服务、架构与工程、AI 工程。
- AI：深度学习基础、Transformer 与模型架构、提示学习与模型微调、推理与部署、RAG 与智能体。

跨主题文章选择一个主要分类，其余主题放入标签。标签目前用于展示，不会自动生成标签检索页。

仅调整分类时修改 `category`，文章留在原模块。要改变所属模块，需要移动 Markdown 和依赖的图片资源，再构建并检查引用。重命名或移动会改变文章 URL，应同时检查站内链接及旧地址的访问需求。

### 本地图片

推荐将图片保存在 `posts/<模块>/md/assets/`，正文使用 `assets/文件名.png`。使用 Typora 等编辑器产生本机绝对路径时，可先预览再迁移：

```bash
node js/transfer-images.js --dry-run --category=skill
node js/transfer-images.js --category=skill
# AI 文章改为 --category=ai；省略 --category 会扫描带 md 目录的模块
```

工具复制图片、更新 Markdown 中的绝对路径，并按需同步图片到 `html/assets/`。迁移后检查缺失源文件提示及实际图片显示；`--dry-run` 不复制图片、不改写文章，但可能创建资产目录。

如需指定 Typora 路径：

```bash
node js/transfer-images.js --typora-path="/path/to/typora-images"
```

路径配置优先级为命令行参数、`TYPORA_IMAGE_PATH` 环境变量、根目录 `.env`、常见系统路径自动检测。`.env` 和 `node_modules/` 已被 Git 忽略。

## 构建、检查与发布

### 常用命令

| 命令 | 行为 |
| --- | --- |
| `npm ci` | 按锁文件安装依赖，首次运行或依赖变更后使用 |
| `npm run check:content` | 只检查文章元信息 |
| `npm run build:site` | 校验文章 → 生成页面 → 检查本地引用和栏目分页 |
| `node js/check-content.js --check-generated` | 检查已有生成结果，不重新生成 |
| `./deploy.sh --check` | 图片迁移预览、构建和检查；不提交、不推送 |
| `./deploy.sh` | 图片迁移、构建、暂存全部改动、提交并推送当前分支 |
| `./deploy.sh "更新说明"` | 使用指定的提交信息完成发布流程 |

`node js/generate-pagination.js` 只执行生成，日常应使用 `npm run build:site`，以包含生成前后的检查。`./deploy.sh --check` 会更新生成 HTML，不会实际迁移绝对路径图片；需要迁移时先单独运行图片工具，或在正式发布时由部署脚本执行。

### 推荐发布流程

```bash
# 编写文章或修改页面源文件后
./deploy.sh --check
python3 -m http.server 8000

# 在浏览器检查后，另开终端或停止服务器再发布
git status --short
./deploy.sh "更新文章与页面"
```

脚本会自动定位自身所在的项目目录，检查 Node.js、npm 和 Git；缺少 `node_modules/` 时使用 `npm ci`。构建失败会停止提交推送；没有文件改动时仍会尝试推送已有提交。脚本会暂存项目全部改动，发布前应确认 `git status` 中的内容。

首次执行如遇权限问题，可运行 `chmod +x deploy.sh`，或使用 `bash deploy.sh`。脚本推送当前分支，自动部署只监听 `main` 和 `master`。

### 手动提交与推送

完成图片迁移、构建与预览后，也可以手动操作：

```bash
git add -A
git commit -m "更新文章与页面"
git push origin main
```

已经提交、仅需上传时直接执行 `git push origin main`。

### GitHub Actions

工作流位于 [.github/workflows/pagination.yml](.github/workflows/pagination.yml)。推送到 `main` / `master` 且命中文章、模板、样式、脚本、资源或相关配置路径时触发，也支持 `workflow_dispatch` 手动运行。

工作流使用 Node.js 20、`npm ci` 和完整构建命令；如生成文件有变化会提交回仓库，再从同一构建工作目录上传 Pages 产物，部署任务使用该产物发布。

推送成功代表代码已上传，线上是否发布成功以 [Actions 运行结果](https://github.com/Jonny-Dr/jonny-dr.github.io/actions) 为准。仅修改 `README.md` 或 `use-flow.txt` 不会触发当前路径过滤规则；需要重发网站时可在 Actions 手动运行工作流。

## 页面与样式维护

| 调整内容 | 修改位置 |
| --- | --- |
| 首页布局 | `templates/index-template.html` |
| 关于页介绍与联系方式 | `about.html` |
| 公共导航 | `templates/nav-template.html` |
| 首页与关于页技术栈 | `templates/skills-template.html` |
| 技术、AI、项目、日常、归档布局 | 对应栏目模板；项目使用 `default-template.html` |
| 卡片、分类导航、主题与移动布局 | `css/common.css` |
| 卡片内容、分页数量与分类名称映射 | `js/generate-pagination.js` |
| 文章详情布局及 Markdown 转换 | `js/markdown-parser.js` |
| 跳转、主题及交互行为 | `js/theme.js` |

构建会替换 `about.html` 中 `NAV_START/NAV_END` 和 `SKILLS_START/SKILLS_END` 标记内的共享内容，保留这些标记。旧的 `update-about-nav.js` 仅识别 `{{nav}}` 占位符，当前关于页的导航由正常构建同步。

新增技术或 AI 主分类时，需要同时更新生成器中的分类映射、`check-content.js` 中的合法分类集合，以及对应 `CONTENT_GUIDE.md`，然后重新构建。

修改公共 CSS 或交互脚本后也要构建：生成器会按照文件内容更新资源版本参数。大量 HTML 只因公共资源版本变化而一起更新，是正常现象。直接修改生成 HTML 会在下次构建时被覆盖；关于页手工维护区除外。

## 常见问题与当前边界

- 新文章未显示：检查模块、文件扩展名和目录层级；文章必须直接位于已配置模块的 `md/` 下，再运行完整构建。
- 分类显示不正确：核对 `category` 的完整名称；模块归属由目录决定，分类页不支持把文章自动移到其他模块。
- 图片缺失：先检查源图片和 `assets/` 引用，实际迁移后重新构建，并在文章详情页查看。
- 构建通过但页面显示异常：本地检查主要覆盖元信息、栏目分页和 HTML 本地引用，不检测外链可用性、全部锚点或视觉与交互效果，仍需浏览器预览。
- 删除或移动文章后有遗留提示：旧详情 HTML 和多余分页不会自动删除。确认旧链接是否需要保留或重定向后，再人工处理并重新检查。
- 推送成功但网站没更新：查看 Actions 的触发条件与运行结果，再刷新浏览器缓存。远端新增了自动生成提交时，应先同步分支再继续修改。
- Markdown 使用 marked 的 GFM 解析，支持表格、任务列表、代码块等；没有独立的 Mermaid 渲染流程，不应假定 Mermaid 代码块会显示为图形。

## 许可

博客内容采用 [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/) 许可。
