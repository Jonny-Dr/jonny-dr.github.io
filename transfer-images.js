#!/usr/bin/env node

/**
 * 图片迁移工具
 * 
 * 功能：将 Markdown 文件中引用的本地绝对路径图片（如 Typora 生成的图片）
 *       迁移到项目对应的 assets 目录，并自动更新 Markdown 中的图片路径
 * 
 * 使用场景：
 * 1. 使用 Typora 等工具编辑 Markdown 时，图片默认保存在本地绝对路径
 * 2. 部署到 GitHub Pages 时，这些本地路径图片无法访问
 * 3. 运行此脚本自动迁移图片到项目目录并更新路径
 * 
 * 目录结构规范：
 * posts/
 *   ├── skill/
 *   │   ├── md/
 *   │   │   ├── article.md
 *   │   │   └── assets/          # skill 分类的图片目录
 *   │   └── html/
 *   ├── daily/
 *   │   ├── md/
 *   │   │   └── assets/          # daily 分类的图片目录
 *   │   └── html/
 *   └── ...
 * 
 * 使用方法：
 * node transfer-images.js [options]
 * 
 * 选项：
 *   --dry-run       预览模式，不实际执行复制和修改操作
 *   --category=xxx  只处理指定分类（如 skill、daily、project）
 *   --help          显示帮助信息
 * 
 * 示例：
 *   node transfer-images.js                    # 处理所有分类
 *   node transfer-images.js --category=skill   # 只处理 skill 分类
 *   node transfer-images.js --dry-run          # 预览模式
 */

const fs = require('fs');
const path = require('path');

// 配置
const CONFIG = {
    // Typora 图片默认存储路径
    typoraImagePath: '/Users/jonny/Library/Application Support/typora-user-images',
    // posts 目录路径
    postsPath: path.join(__dirname, 'posts'),
    // 支持的图片格式
    imageExtensions: ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp'],
    // Markdown 文件扩展名
    markdownExtension: '.md'
};

/**
 * 解析命令行参数
 */
function parseArgs() {
    const args = process.argv.slice(2);
    const options = {
        dryRun: false,
        category: null,
        help: false
    };

    args.forEach(arg => {
        if (arg === '--dry-run') {
            options.dryRun = true;
        } else if (arg.startsWith('--category=')) {
            options.category = arg.split('=')[1];
        } else if (arg === '--help' || arg === '-h') {
            options.help = true;
        }
    });

    return options;
}

/**
 * 显示帮助信息
 */
function showHelp() {
    console.log(`
图片迁移工具

功能：将 Markdown 文件中引用的本地绝对路径图片迁移到项目对应的 assets 目录

使用方法：
  node transfer-images.js [options]

选项：
  --dry-run       预览模式，不实际执行复制和修改操作
  --category=xxx  只处理指定分类（如 skill、daily、project）
  --help, -h      显示帮助信息

示例：
  node transfer-images.js                    # 处理所有分类
  node transfer-images.js --category=skill   # 只处理 skill 分类
  node transfer-images.js --dry-run          # 预览模式

目录结构：
  posts/
    ├── skill/md/assets/     # skill 分类的图片目录
    ├── daily/md/assets/     # daily 分类的图片目录
    └── project/md/assets/   # project 分类的图片目录
`);
}

/**
 * 获取所有分类目录
 */
function getCategories(options) {
    if (options.category) {
        const categoryPath = path.join(CONFIG.postsPath, options.category);
        if (fs.existsSync(categoryPath)) {
            return [options.category];
        } else {
            console.error(`错误：分类 "${options.category}" 不存在`);
            return [];
        }
    }

    // 获取所有分类
    return fs.readdirSync(CONFIG.postsPath)
        .filter(item => {
            const itemPath = path.join(CONFIG.postsPath, item);
            return fs.statSync(itemPath).isDirectory() && 
                   fs.existsSync(path.join(itemPath, 'md'));
        });
}

/**
 * 确保目录存在
 */
function ensureDir(dirPath) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
        console.log(`  创建目录: ${dirPath}`);
    }
}

/**
 * 从 Markdown 内容中提取本地图片路径
 */
function extractLocalImages(content) {
    const images = [];
    
    // 匹配 Markdown 图片语法: ![alt](path)
    const markdownImgRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
    let match;
    while ((match = markdownImgRegex.exec(content)) !== null) {
        const imgPath = match[2];
        // 检查是否是本地绝对路径
        if (imgPath.startsWith('/Users/') || imgPath.startsWith('/home/') || 
            imgPath.startsWith('C:\\') || imgPath.startsWith('D:\\')) {
            images.push({
                originalPath: imgPath,
                alt: match[1],
                match: match[0],
                type: 'markdown'
            });
        }
    }

    // 匹配 HTML img 标签: <img src="path" ...>
    const htmlImgRegex = /<img[^>]+src="([^"]+)"[^>]*>/g;
    while ((match = htmlImgRegex.exec(content)) !== null) {
        const imgPath = match[1];
        // 检查是否是本地绝对路径
        if (imgPath.startsWith('/Users/') || imgPath.startsWith('/home/') || 
            imgPath.startsWith('C:\\') || imgPath.startsWith('D:\\')) {
            images.push({
                originalPath: imgPath,
                match: match[0],
                type: 'html'
            });
        }
    }

    return images;
}

/**
 * 复制图片到 assets 目录
 */
function copyImage(sourcePath, targetDir, options) {
    const fileName = path.basename(sourcePath);
    const targetPath = path.join(targetDir, fileName);

    // 检查源文件是否存在
    if (!fs.existsSync(sourcePath)) {
        console.warn(`  ⚠️  源文件不存在: ${sourcePath}`);
        return null;
    }

    // 如果目标文件已存在，跳过
    if (fs.existsSync(targetPath)) {
        console.log(`  ✓  图片已存在: ${fileName}`);
        return fileName;
    }

    if (options.dryRun) {
        console.log(`  [预览] 将复制: ${fileName}`);
        return fileName;
    }

    try {
        fs.copyFileSync(sourcePath, targetPath);
        console.log(`  ✓  复制图片: ${fileName}`);
        return fileName;
    } catch (error) {
        console.error(`  ✗  复制失败: ${fileName}`, error.message);
        return null;
    }
}

/**
 * 更新 Markdown 内容中的图片路径
 */
function updateImagePaths(content, images, options) {
    let newContent = content;

    images.forEach(img => {
        const fileName = path.basename(img.originalPath);
        const newPath = `assets/${fileName}`;

        if (img.type === 'markdown') {
            // 更新 Markdown 图片语法
            const oldPattern = img.match;
            const newPattern = `![${img.alt}](${newPath})`;
            newContent = newContent.replace(oldPattern, newPattern);
        } else {
            // 更新 HTML img 标签
            const oldPattern = img.match;
            const newPattern = img.match.replace(img.originalPath, newPath);
            newContent = newContent.replace(oldPattern, newPattern);
        }

        if (options.dryRun) {
            console.log(`  [预览] 更新路径: ${path.basename(img.originalPath)} -> ${newPath}`);
        }
    });

    return newContent;
}

/**
 * 处理单个 Markdown 文件
 */
function processMarkdownFile(filePath, assetsDir, options) {
    const fileName = path.basename(filePath);
    console.log(`\n处理文件: ${fileName}`);

    // 读取文件内容
    const content = fs.readFileSync(filePath, 'utf8');

    // 提取本地图片路径
    const images = extractLocalImages(content);

    if (images.length === 0) {
        console.log('  没有需要迁移的本地图片');
        return;
    }

    console.log(`  发现 ${images.length} 个本地图片`);

    // 确保 assets 目录存在
    ensureDir(assetsDir);

    // 复制图片
    let copiedCount = 0;
    images.forEach(img => {
        const result = copyImage(img.originalPath, assetsDir, options);
        if (result) {
            copiedCount++;
        }
    });

    // 更新 Markdown 内容
    const newContent = updateImagePaths(content, images, options);

    // 保存文件
    if (!options.dryRun && newContent !== content) {
        fs.writeFileSync(filePath, newContent, 'utf8');
        console.log(`  ✓  更新文件: ${fileName}`);
    }

    console.log(`  完成: 复制 ${copiedCount}/${images.length} 张图片`);
}

/**
 * 处理单个分类
 */
function processCategory(category, options) {
    const mdPath = path.join(CONFIG.postsPath, category, 'md');
    const assetsPath = path.join(mdPath, 'assets');
    const htmlPath = path.join(CONFIG.postsPath, category, 'html');
    const htmlAssetsPath = path.join(htmlPath, 'assets');

    console.log(`\n${'='.repeat(60)}`);
    console.log(`处理分类: ${category}`);
    console.log(`${'='.repeat(60)}`);

    // 检查 md 目录是否存在
    if (!fs.existsSync(mdPath)) {
        console.log(`跳过: ${category} 没有 md 目录`);
        return;
    }

    // 获取所有 Markdown 文件
    const mdFiles = fs.readdirSync(mdPath)
        .filter(file => file.endsWith(CONFIG.markdownExtension))
        .map(file => path.join(mdPath, file));

    if (mdFiles.length === 0) {
        console.log(`跳过: ${category} 没有 Markdown 文件`);
        return;
    }

    console.log(`找到 ${mdFiles.length} 个 Markdown 文件`);

    // 处理每个 Markdown 文件
    mdFiles.forEach(filePath => {
        processMarkdownFile(filePath, assetsPath, options);
    });

    // 将 assets 复制到 html 目录
    if (fs.existsSync(assetsPath)) {
        const assetFiles = fs.readdirSync(assetsPath)
            .filter(file => {
                const ext = path.extname(file).toLowerCase();
                return CONFIG.imageExtensions.includes(ext);
            });

        if (assetFiles.length > 0) {
            console.log(`\n  同步 assets 到 html 目录...`);
            ensureDir(htmlAssetsPath);

            let copiedToHtml = 0;
            assetFiles.forEach(file => {
                const sourcePath = path.join(assetsPath, file);
                const targetPath = path.join(htmlAssetsPath, file);

                if (!fs.existsSync(targetPath)) {
                    if (!options.dryRun) {
                        fs.copyFileSync(sourcePath, targetPath);
                    }
                    copiedToHtml++;
                    console.log(`    ${options.dryRun ? '[预览]' : '✓'} 同步: ${file}`);
                }
            });

            console.log(`  完成: 同步 ${copiedToHtml} 张图片到 html/assets`);
        }
    }
}

/**
 * 主函数
 */
function main() {
    const options = parseArgs();

    if (options.help) {
        showHelp();
        return;
    }

    console.log(`${'='.repeat(60)}`);
    console.log('图片迁移工具');
    console.log(`${'='.repeat(60)}`);

    if (options.dryRun) {
        console.log('\n⚠️  预览模式：不会实际执行复制和修改操作\n');
    }

    // 获取所有分类
    const categories = getCategories(options);

    if (categories.length === 0) {
        console.log('没有找到需要处理的分类');
        return;
    }

    console.log(`\n将处理以下分类: ${categories.join(', ')}`);

    // 处理每个分类
    categories.forEach(category => {
        processCategory(category, options);
    });

    console.log(`\n${'='.repeat(60)}`);
    console.log('处理完成！');
    console.log(`${'='.repeat(60)}`);

    if (options.dryRun) {
        console.log('\n提示：这是预览模式，实际未执行任何操作。');
        console.log('      去掉 --dry-run 参数以执行实际操作。');
    } else {
        console.log('\n提示：请运行 node generate-pagination.js 重新生成 HTML 文件');
    }
}

// 运行主函数
main();
