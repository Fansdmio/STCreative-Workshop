# SillyTavern 扩展安装指南

由于 SillyTavern 的 GitHub 安装器不支持子目录安装，请使用以下方法安装扩展。

---

## 方法一：手动复制文件（推荐，最简单）

### Windows 用户

1. **下载仓库**
   - 访问 https://github.com/AlyceSingle/STCreative-Workshop
   - 点击绿色 **Code** 按钮 → **Download ZIP**
   - 解压到任意位置

2. **复制扩展文件**
   
   打开 PowerShell，执行以下命令（替换路径）：
   
   ```powershell
   # 修改这两个路径
   $sourcePath = "C:\Downloads\STCreative-Workshop-main\st-extension"
   $stPath = "C:\SillyTavern"
   
   # 复制文件
   $destPath = "$stPath\public\scripts\extensions\third-party\storyshare-workshop"
   Remove-Item -Recurse -Force $destPath -ErrorAction SilentlyContinue
   Copy-Item -Recurse $sourcePath $destPath
   
   Write-Host "✓ 扩展安装完成！重启 SillyTavern 即可使用" -ForegroundColor Green
   ```

3. **重启 SillyTavern**

### Linux/macOS 用户

```bash
# 1. 克隆仓库
cd ~
git clone https://github.com/AlyceSingle/STCreative-Workshop.git

# 2. 复制扩展文件到 SillyTavern
ST_PATH="/path/to/SillyTavern"  # 修改为你的 ST 路径
rm -rf "$ST_PATH/public/scripts/extensions/third-party/storyshare-workshop"
cp -r ~/STCreative-Workshop/st-extension "$ST_PATH/public/scripts/extensions/third-party/storyshare-workshop"

echo "✓ 扩展安装完成！"

# 3. 重启 SillyTavern
```

---

## 方法二：使用 Git（适合开发者）

```bash
# 1. 进入 SillyTavern 扩展目录
cd /path/to/SillyTavern/public/scripts/extensions/third-party/

# 2. 克隆仓库并只保留 st-extension 内容
git clone --depth 1 --filter=blob:none --sparse https://github.com/AlyceSingle/STCreative-Workshop.git temp-workshop
cd temp-workshop
git sparse-checkout set st-extension

# 3. 移动文件到正确位置
mv st-extension ../storyshare-workshop
cd ..
rm -rf temp-workshop

# 4. 重启 SillyTavern
```

---

## 方法三：一键安装脚本

### Windows (install-extension.ps1)

将此脚本保存到仓库根目录，双击运行：

```powershell
# install-extension.ps1
param(
    [string]$SillyTavernPath = "C:\SillyTavern"
)

Write-Host "=== StoryShare 创意工坊扩展安装器 ===" -ForegroundColor Cyan
Write-Host ""

# 检查 SillyTavern 路径
if (-not (Test-Path $SillyTavernPath)) {
    $SillyTavernPath = Read-Host "请输入 SillyTavern 安装路径"
    if (-not (Test-Path $SillyTavernPath)) {
        Write-Host "✗ 错误：路径不存在！" -ForegroundColor Red
        exit 1
    }
}

Write-Host "SillyTavern 路径: $SillyTavernPath" -ForegroundColor Yellow

# 目标路径
$destPath = Join-Path $SillyTavernPath "public\scripts\extensions\third-party\storyshare-workshop"
$sourcePath = Join-Path $PSScriptRoot "st-extension"

# 检查源文件
if (-not (Test-Path $sourcePath)) {
    Write-Host "✗ 错误：未找到 st-extension 目录！" -ForegroundColor Red
    exit 1
}

# 删除旧版本
if (Test-Path $destPath) {
    Write-Host "正在删除旧版本..." -ForegroundColor Yellow
    Remove-Item -Recurse -Force $destPath
}

# 复制文件
Write-Host "正在安装扩展..." -ForegroundColor Yellow
Copy-Item -Recurse $sourcePath $destPath

# 验证安装
if (Test-Path (Join-Path $destPath "manifest.json")) {
    Write-Host ""
    Write-Host "✓ 扩展安装成功！" -ForegroundColor Green
    Write-Host ""
    Write-Host "下一步：" -ForegroundColor Cyan
    Write-Host "1. 重启 SillyTavern" -ForegroundColor White
    Write-Host "2. 打开 Extensions 面板" -ForegroundColor White
    Write-Host "3. 找到 'StoryShare 创意工坊' 并配置工坊 URL" -ForegroundColor White
    Write-Host ""
} else {
    Write-Host "✗ 安装失败：文件复制错误" -ForegroundColor Red
    exit 1
}

Read-Host "按回车键退出"
```

### Linux/macOS (install-extension.sh)

```bash
#!/bin/bash

echo "=== StoryShare 创意工坊扩展安装器 ==="
echo ""

# 默认 SillyTavern 路径
ST_PATH="${1:-$HOME/SillyTavern}"

# 检查路径
if [ ! -d "$ST_PATH" ]; then
    read -p "请输入 SillyTavern 安装路径: " ST_PATH
    if [ ! -d "$ST_PATH" ]; then
        echo "✗ 错误：路径不存在！"
        exit 1
    fi
fi

echo "SillyTavern 路径: $ST_PATH"

# 目标路径
DEST_PATH="$ST_PATH/public/scripts/extensions/third-party/storyshare-workshop"
SOURCE_PATH="$(cd "$(dirname "$0")" && pwd)/st-extension"

# 检查源文件
if [ ! -d "$SOURCE_PATH" ]; then
    echo "✗ 错误：未找到 st-extension 目录！"
    exit 1
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
    echo "下一步："
    echo "1. 重启 SillyTavern"
    echo "2. 打开 Extensions 面板"
    echo "3. 找到 'StoryShare 创意工坊' 并配置工坊 URL"
    echo ""
else
    echo "✗ 安装失败：文件复制错误"
    exit 1
fi
```

---

## 验证安装

安装完成后，检查以下文件是否存在：

```
SillyTavern/public/scripts/extensions/third-party/storyshare-workshop/
├── manifest.json    ✓
├── index.js         ✓
├── style.css        ✓
└── README.md        ✓
```

重启 SillyTavern 后，在 **Extensions** 面板应该能看到：

```
📦 StoryShare 创意工坊
```

---

## 配置和使用

1. 展开 **StoryShare 创意工坊** 折叠栏
2. 在 **工坊网址** 输入框填写：
   ```
   https://your-domain.com/StoryShare/
   ```
3. 点击 **打开创意工坊** 按钮

详细使用说明请查看 `st-extension/README.md`
