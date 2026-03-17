# StoryShare 创意工坊扩展安装器 (Windows)
# 使用方法：右键 → 使用 PowerShell 运行

param(
    [string]$SillyTavernPath = ""
)

Write-Host ""
Write-Host "=== StoryShare 创意工坊扩展安装器 ===" -ForegroundColor Cyan
Write-Host ""

# 检查是否在仓库根目录
if (-not (Test-Path "st-extension")) {
    Write-Host "✗ 错误：请在仓库根目录运行此脚本！" -ForegroundColor Red
    Write-Host "  当前目录：$PWD" -ForegroundColor Yellow
    Read-Host "按回车键退出"
    exit 1
}

# 获取 SillyTavern 路径
if (-not $SillyTavernPath) {
    Write-Host "请输入 SillyTavern 安装路径" -ForegroundColor Yellow
    Write-Host "（例如：C:\SillyTavern 或 D:\AI\SillyTavern）" -ForegroundColor Gray
    Write-Host ""
    $SillyTavernPath = Read-Host "路径"
}

# 去除引号
$SillyTavernPath = $SillyTavernPath.Trim('"')

# 检查路径是否存在
if (-not (Test-Path $SillyTavernPath)) {
    Write-Host ""
    Write-Host "✗ 错误：路径不存在！" -ForegroundColor Red
    Write-Host "  输入的路径：$SillyTavernPath" -ForegroundColor Yellow
    Read-Host "按回车键退出"
    exit 1
}

# 检查是否是 SillyTavern 目录
$serverPath = Join-Path $SillyTavernPath "server.js"
if (-not (Test-Path $serverPath)) {
    Write-Host ""
    Write-Host "✗ 警告：这可能不是 SillyTavern 目录（未找到 server.js）" -ForegroundColor Yellow
    $continue = Read-Host "是否继续？(y/N)"
    if ($continue -ne "y" -and $continue -ne "Y") {
        exit 0
    }
}

Write-Host ""
Write-Host "SillyTavern 路径: $SillyTavernPath" -ForegroundColor Green
Write-Host ""

# 目标路径
$destPath = Join-Path $SillyTavernPath "public\scripts\extensions\third-party\storyshare-workshop"
$sourcePath = Join-Path $PSScriptRoot "st-extension"

# 创建目录（如果不存在）
$thirdPartyPath = Join-Path $SillyTavernPath "public\scripts\extensions\third-party"
if (-not (Test-Path $thirdPartyPath)) {
    Write-Host "创建扩展目录..." -ForegroundColor Yellow
    New-Item -ItemType Directory -Path $thirdPartyPath -Force | Out-Null
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
    Write-Host "安装位置：" -ForegroundColor Cyan
    Write-Host "  $destPath" -ForegroundColor Gray
    Write-Host ""
    Write-Host "下一步：" -ForegroundColor Cyan
    Write-Host "  1. 重启 SillyTavern（关闭后重新启动）" -ForegroundColor White
    Write-Host "  2. 打开浏览器访问 SillyTavern" -ForegroundColor White
    Write-Host "  3. 点击 Extensions（扩展）图标" -ForegroundColor White
    Write-Host "  4. 找到 'StoryShare 创意工坊' 并展开" -ForegroundColor White
    Write-Host "  5. 配置工坊 URL 后点击 '打开创意工坊'" -ForegroundColor White
    Write-Host ""
} else {
    Write-Host ""
    Write-Host "✗ 安装失败：文件复制错误" -ForegroundColor Red
    Write-Host "  目标路径：$destPath" -ForegroundColor Yellow
    Write-Host ""
    exit 1
}

Read-Host "按回车键退出"
