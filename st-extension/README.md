# StoryShare 创意工坊 SillyTavern 扩展

一个 SillyTavern 扩展，提供弹窗式创意工坊浏览器，支持直接订阅/退订模组并插入世界书。

---

## 功能特性

- ✅ 从 SillyTavern Extensions 面板一键打开创意工坊弹窗
- ✅ 弹窗式浏览器，无需离开 SillyTavern 主界面
- ✅ 订阅模组后**自动插入世界书条目**到本地 SillyTavern
- ✅ 取消订阅后**自动移除**对应条目
- ✅ 自动扫描已安装模组，防止重复安装冲突
- ✅ 支持自定义世界书名称（每个工坊分区独立配置）
- ✅ 实时同步状态，订阅/退订结果即时反馈

---

## 安装方法

### 1. 通过 GitHub URL 安装（推荐）

1. 打开 SillyTavern
2. 进入 **Extensions（扩展）** 面板
3. 点击 **Install Extension（安装扩展）**
4. 输入以下 GitHub URL：

```
https://github.com/AlyceSingle/STCreative-Workshop
```

5. 在 **Branch** 中填写 `main`
6. 在 **Subfolder** 中填写 `st-extension`
7. 点击 **Install**

### 2. 手动安装

1. 下载本目录下的所有文件：
   - `manifest.json`
   - `index.js`
   - `style.css`
   - `README.md`（可选）

2. 将这些文件复制到 SillyTavern 的扩展目录：

```
<SillyTavern 根目录>/public/scripts/extensions/third-party/storyshare-workshop/
```

3. 重启 SillyTavern 或刷新浏览器

---

## 配置使用

### 第一次使用

1. 打开 SillyTavern 后，在 **Extensions（扩展）** 面板中找到 **StoryShare 创意工坊** 折叠栏
2. 点击展开
3. 在 **工坊网址** 输入框中填写你部署的工坊完整 URL，例如：

```
https://your-domain.com/StoryShare/
```

⚠️ **注意**：必须包含 `/StoryShare/` 路径（根据 Vite `base` 配置）

4. 点击 **打开创意工坊** 按钮

### 订阅模组

1. 在弹出的工坊窗口中浏览模组
2. 点击模组卡片进入详情页
3. 点击 **订阅到 ST** 按钮
4. 扩展会自动：
   - 调用 SillyTavern API 加载当前世界书
   - 移除该模组的旧条目（如有）
   - 插入新条目到世界书
   - 刷新世界书编辑器
5. 订阅成功后会显示绿色通知

### 取消订阅

1. 在已订阅的模组详情页点击 **取消订阅**
2. 扩展会自动移除该模组的所有条目
3. 取消成功后会显示绿色通知

### 世界书名称管理

- 每个工坊分区（如 `steampunk`、`chainsaw`）可以配置独立的世界书名称
- 默认名称在 `frontend/src/config/sections.js` 中定义
- 在工坊列表页顶部可以编辑当前世界书名称，修改后会持久化到 localStorage

---

## 技术说明

### 通信协议

扩展和弹窗之间使用 `window.postMessage` 进行跨窗口通信：

**工坊 → 扩展**

| 消息类型 | payload | 说明 |
|---------|---------|------|
| `workshop_ping` | `{}` | 握手请求 |
| `workshop_scan` | `{ worldbookName }` | 扫描已订阅模组 |
| `workshop_subscribe` | `{ packId, packTitle, worldbookName, entries }` | 订阅模组 |
| `workshop_unsubscribe` | `{ packId, worldbookName }` | 取消订阅 |

**扩展 → 工坊**

| 消息类型 | payload | 说明 |
|---------|---------|------|
| `workshop_pong` | `{ connected: true }` | 握手响应 |
| `workshop_scan_result` | `{ success, packIds, entryCountMap }` | 扫描结果 |
| `workshop_subscribe_result` | `{ success, message }` | 订阅结果 |
| `workshop_unsubscribe_result` | `{ success, message, removedCount }` | 退订结果 |

### 安全性

- 扩展验证 `event.source === workshopWindow`（窗口引用）
- 工坊验证 `event.source === window.opener`
- 超时保护：所有请求 5 秒超时

### 条目格式

条目转换为 SillyTavern 的 `FlattenedWorldInfoEntry` 格式，包含：

- 标准字段：`uid`, `comment`, `content`, `key`, `keysecondary`, `position`, `order`, `depth`, `probability` 等
- 自定义标记：`extra.source = 'storyshare_workshop'`, `extra.pack_id` 用于追踪和冲突检测

### 幂等性

- 订阅前会先移除同一 `pack_id` 的所有旧条目
- UID 自动分配，避免冲突（`Math.max(...existingUids) + 1`）

---

## 常见问题

### 1. 点击"打开创意工坊"后没有弹窗

- 检查浏览器弹窗拦截设置，允许 SillyTavern 的弹窗
- 确认工坊网址已正确配置

### 2. 订阅后提示"未连接到 SillyTavern 扩展"

- 关闭工坊弹窗，重新从扩展面板打开
- 检查浏览器控制台是否有跨域错误（应为同源或允许 `*`）

### 3. 订阅成功但世界书编辑器未刷新

- 手动刷新世界书编辑器（关闭重开）
- 或重启 SillyTavern

### 4. 如何更新扩展？

- 通过 GitHub 安装的：在扩展面板点击更新按钮
- 手动安装的：重新下载文件覆盖

---

## 开发者信息

本扩展由 **StoryShare Team** 开发，基于 `SteamPunkStore_demo` 项目。

- 主项目：`https://github.com/AlyceSingle/STCreative-Workshop`
- 扩展版本：`1.0.0`
- 兼容 SillyTavern：`1.12.0+`

---

## License

根据主项目许可协议分发。
