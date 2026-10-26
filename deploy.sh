#!/bin/bash

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_step() { printf '\n%b▶ %s%b\n' "$BLUE" "$1" "$NC"; }
print_success() { printf '%b✓ %s%b\n' "$GREEN" "$1" "$NC"; }
print_error() { printf '%b✗ %s%b\n' "$RED" "$1" "$NC" >&2; }
print_info() { printf '%bℹ %s%b\n' "$YELLOW" "$1" "$NC"; }

CHECK_ONLY=false
COMMIT_MSG=""
for argument in "$@"; do
    case "$argument" in
        --check) CHECK_ONLY=true ;;
        --help|-h)
            printf '%s\n' '用法：./deploy.sh [提交信息] [--check]' '  --check  预览图片迁移并生成、检查页面，不提交、不推送'
            exit 0
            ;;
        --*) print_error "未知参数：$argument"; exit 1 ;;
        *)
            if [ -n "$COMMIT_MSG" ]; then
                print_error "提交信息请使用引号包成一个参数"
                exit 1
            fi
            COMMIT_MSG="$argument"
            ;;
    esac
done

# 从任意目录调用时，都在脚本所属的项目根目录执行。
DEPLOY_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$DEPLOY_ROOT"

print_step "北辰博客一键部署"
print_info "项目目录：$DEPLOY_ROOT"

for dependency in node npm git; do
    if ! command -v "$dependency" >/dev/null 2>&1; then
        print_error "缺少必要工具：$dependency"
        exit 1
    fi
done
if [ ! -f package.json ] || [ ! -f package-lock.json ]; then
    print_error "未找到 package.json 或 package-lock.json"
    exit 1
fi

if [ "$CHECK_ONLY" = false ]; then
    if ! DEPLOY_BRANCH="$(git symbolic-ref --quiet --short HEAD)"; then
        print_error "当前没有可推送的分支，请先切换到正常分支"
        exit 1
    fi
fi

print_step "1/4 检查依赖"
if [ ! -d node_modules ]; then
    if ! npm ci; then
        print_error "依赖安装失败"
        exit 1
    fi
fi
print_success "依赖已就绪"

print_step "2/4 迁移图片"
if [ "$CHECK_ONLY" = true ]; then
    if ! node js/transfer-images.js --dry-run; then
        print_error "图片迁移预览失败"
        exit 1
    fi
elif ! node js/transfer-images.js; then
    print_error "图片迁移失败"
    exit 1
fi

print_step "3/4 生成与检查页面"
if ! npm run build:site; then
    print_error "页面构建或内容检查失败，已停止部署"
    exit 1
fi

if [ "$CHECK_ONLY" = true ]; then
    print_success "本地检查完成，生成页面已更新"
    exit 0
fi

print_step "4/4 提交并推送"
if ! git add -A -- .; then
    print_error "暂存文件失败"
    exit 1
fi

if git diff --cached --quiet; then
    print_info "没有文件变更，继续推送已有提交"
else
    if [ -z "$COMMIT_MSG" ]; then
        NEW_ARTICLE_COUNT=0
        while IFS= read -r -d '' article; do
            if [ "$NEW_ARTICLE_COUNT" -eq 0 ]; then COMMIT_MSG="更新文章"; fi
            COMMIT_MSG="${COMMIT_MSG}，${article##*/}"
            NEW_ARTICLE_COUNT=$((NEW_ARTICLE_COUNT + 1))
            if [ "$NEW_ARTICLE_COUNT" -ge 3 ]; then break; fi
        done < <(git -c core.quotepath=false diff --cached --name-only --diff-filter=A -z -- '*.md')
        COMMIT_MSG="${COMMIT_MSG:-更新博客}"
    fi
    if ! git commit -m "$COMMIT_MSG"; then
        print_error "提交失败"
        exit 1
    fi
    print_success "提交成功：$COMMIT_MSG"
fi

if ! git push origin "$DEPLOY_BRANCH"; then
    print_error "推送失败，请处理网络、权限或远端分支冲突后重试"
    exit 1
fi
print_success "推送完成：$DEPLOY_BRANCH"

case "$DEPLOY_BRANCH" in
    main|master)
        print_info "GitHub Actions 将继续构建并发布，线上结果请查看 Actions"
        print_info "https://github.com/jonny-dr/jonny-dr.github.io/actions"
        ;;
    *) print_info "当前分支已推送；自动发布工作流仅监听 main/master" ;;
esac
