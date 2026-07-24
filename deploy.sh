#!/bin/bash

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_step() {
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}▶ $1${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_info() {
    echo -e "${YELLOW}ℹ️  $1${NC}"
}

print_step "🌱 北辰博客一键部署脚本"

print_info "当前目录: $(pwd)"

if [ ! -f "package.json" ]; then
    print_error "未找到 package.json，请确认当前目录是项目根目录"
    exit 1
fi

print_step "1/4 检查依赖"

if [ ! -d "node_modules" ]; then
    print_info "node_modules 不存在，开始安装依赖..."
    npm install
    if [ $? -ne 0 ]; then
        print_error "npm install 失败"
        exit 1
    fi
    print_success "依赖安装完成"
else
    print_success "依赖已安装"
fi

print_step "2/4 迁移图片"

node transfer-images.js
if [ $? -ne 0 ]; then
    print_error "图片迁移失败"
    exit 1
fi
print_success "图片迁移完成"

print_step "3/4 生成页面"

node generate-pagination.js
if [ $? -ne 0 ]; then
    print_error "页面生成失败"
    exit 1
fi
print_success "页面生成完成"

print_step "4/4 提交代码"

git add .
if [ $? -ne 0 ]; then
    print_error "git add 失败"
    exit 1
fi

CHANGES=$(git diff --staged --name-only)
if [ -z "$CHANGES" ]; then
    print_info "没有任何变更，跳过提交"
    echo ""
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}🎉 部署完成！（无变更）${NC}"
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    exit 0
fi

COMMIT_MSG="$1"
if [ -z "$COMMIT_MSG" ]; then
    NEW_FILES=$(git diff --staged --name-only --diff-filter=A 2>/dev/null | grep -E '\.md$' | head -3)
    if [ -n "$NEW_FILES" ]; then
        COMMIT_MSG="更新文章"
        for file in $NEW_FILES; do
            COMMIT_MSG="$COMMIT_MSG, $(basename "$file")"
        done
    else
        COMMIT_MSG="更新博客"
    fi
fi

git commit -m "$COMMIT_MSG"
if [ $? -ne 0 ]; then
    print_error "git commit 失败"
    exit 1
fi
print_success "提交成功: $COMMIT_MSG"

print_info "推送到远程仓库..."
git push origin main
if [ $? -ne 0 ]; then
    print_error "git push 失败"
    exit 1
fi
print_success "推送成功"

echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}🎉 部署完成！${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${YELLOW}ℹ️  GitHub Actions 将自动部署到:${NC}"
echo -e "${BLUE}   https://jonny-dr.github.io${NC}"
echo ""
echo -e "${YELLOW}ℹ️  部署状态查看:${NC}"
echo -e "${BLUE}   https://github.com/jonny-dr/jonny-dr.github.io/actions${NC}"