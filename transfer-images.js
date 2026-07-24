#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

function getTyporaImagePath() {
    if (process.env.TYPORA_IMAGE_PATH) {
        return process.env.TYPORA_IMAGE_PATH;
    }

    const envFile = path.join(__dirname, '.env');
    if (fs.existsSync(envFile)) {
        const envContent = fs.readFileSync(envFile, 'utf8');
        const match = envContent.match(/TYPORA_IMAGE_PATH=(.+)/);
        if (match) {
            return match[1].trim();
        }
    }

    const homeDir = process.env.HOME || process.env.USERPROFILE;
    if (homeDir) {
        const macPath = path.join(homeDir, 'Library', 'Application Support', 'typora-user-images');
        if (fs.existsSync(macPath)) {
            return macPath;
        }

        const winPath = path.join(homeDir, 'AppData', 'Roaming', 'Typora', 'typora-user-images');
        if (fs.existsSync(winPath)) {
            return winPath;
        }

        const linuxPath = path.join(homeDir, '.config', 'typora', 'typora-user-images');
        if (fs.existsSync(linuxPath)) {
            return linuxPath;
        }

        return macPath;
    }

    return '/Users/jonny/Library/Application Support/typora-user-images';
}

const CONFIG = {
    typoraImagePath: getTyporaImagePath(),
    postsPath: path.join(__dirname, 'posts'),
    imageExtensions: ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp'],
    markdownExtension: '.md'
};

function parseArgs() {
    const args = process.argv.slice(2);
    const options = {
        dryRun: false,
        category: null,
        help: false,
        typoraPath: null
    };

    args.forEach(arg => {
        if (arg === '--dry-run') {
            options.dryRun = true;
        } else if (arg.startsWith('--category=')) {
            options.category = arg.split('=')[1];
        } else if (arg.startsWith('--typora-path=')) {
            options.typoraPath = arg.split('=')[1];
        } else if (arg === '--help' || arg === '-h') {
            options.help = true;
        }
    });

    return options;
}

function showHelp() {
    console.log(`
图片迁移工具

功能：将 Markdown 文件中引用的本地绝对路径图片迁移到项目对应的 assets 目录

使用方法：
  node transfer-images.js [options]

选项：
  --dry-run           预览模式，不实际执行复制和修改操作
  --category=xxx      只处理指定分类（如 skill、daily、project）
  --typora-path=xxx   指定 Typora 图片存储路径（覆盖默认配置）
  --help, -h          显示帮助信息

配置方式（优先级从高到低）：
  1. 命令行参数: --typora-path=/path/to/images
  2. 环境变量: TYPORA_IMAGE_PATH=/path/to/images
  3. .env 文件: TYPORA_IMAGE_PATH=/path/to/images
  4. 自动检测: 根据操作系统自动检测常见路径
  5. 默认值: /Users/jonny/Library/Application Support/typora-user-images

示例：
  node transfer-images.js                    # 处理所有分类
  node transfer-images.js --category=skill   # 只处理 skill 分类
  node transfer-images.js --dry-run          # 预览模式
  node transfer-images.js --typora-path=~/Pictures/Typora # 指定路径
  TYPORA_IMAGE_PATH=~/Pictures/Typora node transfer-images.js # 通过环境变量

目录结构：
  posts/
    ├── skill/md/assets/     # skill 分类的图片目录
    ├── daily/md/assets/     # daily 分类的图片目录
    └── project/md/assets/   # project 分类的图片目录
`);
}

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

    return fs.readdirSync(CONFIG.postsPath)
        .filter(item => {
            const itemPath = path.join(CONFIG.postsPath, item);
            return fs.statSync(itemPath).isDirectory() && 
                   fs.existsSync(path.join(itemPath, 'md'));
        });
}

function ensureDir(dirPath) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
        console.log(`  创建目录: ${dirPath}`);
    }
}

function extractLocalImages(content) {
    const images = [];
    
    const markdownImgRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
    let match;
    while ((match = markdownImgRegex.exec(content)) !== null) {
        const imgPath = match[2];
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

    const htmlImgRegex = /<img[^>]+src="([^"]+)"[^>]*>/g;
    while ((match = htmlImgRegex.exec(content)) !== null) {
        const imgPath = match[1];
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

function copyImage(sourcePath, targetDir, options) {
    const fileName = path.basename(sourcePath);
    const targetPath = path.join(targetDir, fileName);

    if (!fs.existsSync(sourcePath)) {
        console.warn(`  ⚠️  源文件不存在: ${sourcePath}`);
        return null;
    }

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

function updateImagePaths(content, images, options) {
    let newContent = content;

    images.forEach(img => {
        const fileName = path.basename(img.originalPath);
        const newPath = `assets/${fileName}`;

        if (img.type === 'markdown') {
            const oldPattern = img.match;
            const newPattern = `![${img.alt}](${newPath})`;
            newContent = newContent.replace(oldPattern, newPattern);
        } else {
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

function processMarkdownFile(filePath, assetsDir, options) {
    const fileName = path.basename(filePath);
    console.log(`\n处理文件: ${fileName}`);

    const content = fs.readFileSync(filePath, 'utf8');

    const images = extractLocalImages(content);

    if (images.length === 0) {
        console.log('  没有需要迁移的本地图片');
        return;
    }

    console.log(`  发现 ${images.length} 个本地图片`);

    ensureDir(assetsDir);

    let copiedCount = 0;
    images.forEach(img => {
        const result = copyImage(img.originalPath, assetsDir, options);
        if (result) {
            copiedCount++;
        }
    });

    const newContent = updateImagePaths(content, images, options);

    if (!options.dryRun && newContent !== content) {
        fs.writeFileSync(filePath, newContent, 'utf8');
        console.log(`  ✓  更新文件: ${fileName}`);
    }

    console.log(`  完成: 复制 ${copiedCount}/${images.length} 张图片`);
}

function processCategory(category, options) {
    const mdPath = path.join(CONFIG.postsPath, category, 'md');
    const assetsPath = path.join(mdPath, 'assets');
    const htmlPath = path.join(CONFIG.postsPath, category, 'html');
    const htmlAssetsPath = path.join(htmlPath, 'assets');

    console.log(`\n${'='.repeat(60)}`);
    console.log(`处理分类: ${category}`);
    console.log(`${'='.repeat(60)}`);

    if (!fs.existsSync(mdPath)) {
        console.log(`跳过: ${category} 没有 md 目录`);
        return;
    }

    const mdFiles = fs.readdirSync(mdPath)
        .filter(file => file.endsWith(CONFIG.markdownExtension))
        .map(file => path.join(mdPath, file));

    if (mdFiles.length === 0) {
        console.log(`跳过: ${category} 没有 Markdown 文件`);
        return;
    }

    console.log(`找到 ${mdFiles.length} 个 Markdown 文件`);

    mdFiles.forEach(filePath => {
        processMarkdownFile(filePath, assetsPath, options);
    });

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

function main() {
    const options = parseArgs();

    if (options.help) {
        showHelp();
        return;
    }

    if (options.typoraPath) {
        CONFIG.typoraImagePath = options.typoraPath.replace('~', process.env.HOME || process.env.USERPROFILE);
    }

    console.log(`${'='.repeat(60)}`);
    console.log('图片迁移工具');
    console.log(`${'='.repeat(60)}`);
    console.log(`当前 Typora 图片路径: ${CONFIG.typoraImagePath}`);

    if (!fs.existsSync(CONFIG.typoraImagePath)) {
        console.warn(`\n⚠️  警告：Typora 图片路径不存在，请检查配置！`);
        console.log(`  使用方式: node transfer-images.js --typora-path=/path/to/your/images`);
    }

    if (options.dryRun) {
        console.log('\n⚠️  预览模式：不会实际执行复制和修改操作\n');
    }

    const categories = getCategories(options);

    if (categories.length === 0) {
        console.log('没有找到需要处理的分类');
        return;
    }

    console.log(`\n将处理以下分类: ${categories.join(', ')}`);

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

main();