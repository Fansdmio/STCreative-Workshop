#!/bin/bash
# StoryShare 创意工坊扩展安装器 (Linux/macOS)
# 使用方法：chmod +x install-extension.sh && ./install-extension.sh

echo ""
echo "=== StoryShare 创意工坊扩展安装器 ==="
echo ""

# 检查是否在仓库根目录
if [ ! -d "st-extension" ]; then
    echo "✗ 错误：请在仓库根目录运行此脚本！"
    echo "  当前目录：$(pwd)"
    exit 1
fi

# 获取 SillyTavern 路径
if [ -z "$1" ]; then
    echo "请输入 SillyTavern 安装路径"
    echo "（例如：/home/user/SillyTavern 或 ~/SillyTavern）"
    echo ""
    read -p "路径: " ST_PATH
else
    ST_PATH="$1"
fi

# 展开 ~ 路径
ST_PATH="${ST_PATH/#\~/$HOME}"

# 检查路径是否存在
if [ ! -d "$ST_PATH" ]; then
    echo ""
    echo "✗ 错误：路径不存在！"
    echo "  输入的路径：$ST_PATH"
    exit 1
fi

# 检查是否是 SillyTavern 目录
if [ ! -f "$ST_PATH/server.js" ]; then
    echo ""
    echo "✗ 警告：这可能不是 SillyTavern 目录（未找到 server.js）"
    read -p "是否继续？(y/N): " continue
    if [ "$continue" != "y" ] && [ "$continue" != "Y" ]; then
        exit 0
    fi
fi

echo ""
echo "SillyTavern 路径: $ST_PATH"
echo ""

# 目标路径
DEST_PATH="$ST_PATH/public/scripts/extensions/third-party/storyshare-workshop"
SOURCE_PATH="$(pwd)/st-extension"

# 创建目录（如果不存在）
THIRD_PARTY_PATH="$ST_PATH/public/scripts/extensions/third-party"
if [ ! -d "$THIRD_PARTY_PATH" ]; then
    echo "创建扩展目录..."
    mkdir -p "$THIRD_PARTY_PATH"
fi

# 删除旧版本
if [ -d "$DEST_PATH" ]; then
    echo "正在删除旧版本..."
    rm -rf "$DEST_PATH"
fi

# 复制文件
echo "正在安装扩展..."
cp -r "$SOURCE_PATH" "$DEST_PATH"

# 验证安装
if [ -f "$DEST_PATH/manifest.json" ]; then
    echo ""
    echo "✓ 扩展安装成功！"
    echo ""
    echo "安装位置："
    echo "  $DEST_PATH"
    echo ""
    echo "下一步："
    echo "  1. 重启 SillyTavern"
    echo "  2. 打开浏览器访问 SillyTavern"
    echo "  3. 点击 Extensions（扩展）图标"
    echo "  4. 找到 'StoryShare 创意工坊' 并展开"
    echo "  5. 配置工坊 URL 后点击 '打开创意工坊'"
    echo ""
else
    echo ""
    echo "✗ 安装失败：文件复制错误"
    echo "  目标路径：$DEST_PATH"
    echo ""
    exit 1
fi
