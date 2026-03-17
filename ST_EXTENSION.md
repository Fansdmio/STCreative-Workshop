# StoryShare 创意工坊 - SillyTavern 扩展

[![安装](https://img.shields.io/badge/SillyTavern-安装扩展-orange)](https://github.com/AlyceSingle/storyshare-workshop-extension)

> ⚠️ **注意**：SillyTavern 扩展已迁移到独立仓库，请访问：
> 
> **https://github.com/AlyceSingle/storyshare-workshop-extension**

---

## 本仓库安装方法（手动安装）

如果你想从本仓库手动安装扩展：

### Windows 用户

1. **下载安装脚本**
   - 下载 [`install-extension.ps1`](./install-extension.ps1)
   
2. **运行安装脚本**
   ```powershell
   # 右键 install-extension.ps1 → 使用 PowerShell 运行
   # 或在 PowerShell 中执行：
   .\install-extension.ps1
   ```

3. **输入 SillyTavern 路径**
   ```
   例如：C:\SillyTavern
   ```

4. **重启 SillyTavern**

### Linux/macOS 用户

```bash
# 1. 克隆仓库
git clone https://github.com/AlyceSingle/STCreative-Workshop.git
cd STCreative-Workshop

# 2. 运行安装脚本
chmod +x install-extension.sh
./install-extension.sh /path/to/SillyTavern

# 3. 重启 SillyTavern
```

---

## 推荐：使用独立扩展仓库

为了避免下载整个项目（包括前端、后端代码），我们提供了一个**只包含扩展文件**的独立仓库：

👉 **https://github.com/AlyceSingle/storyshare-workshop-extension**

在 SillyTavern 中安装：

```
Repository URL: https://github.com/AlyceSingle/storyshare-workshop-extension
Branch: main
Subfolder: (留空)
```

---

## 扩展功能

- ✅ 从 SillyTavern 一键打开创意工坊弹窗
- ✅ 订阅模组自动插入世界书条目
- ✅ 取消订阅自动移除条目
- ✅ 自动扫描已安装模组，防止冲突
- ✅ 支持自定义世界书名称

详细文档请查看 [`st-extension/README.md`](./st-extension/README.md)
