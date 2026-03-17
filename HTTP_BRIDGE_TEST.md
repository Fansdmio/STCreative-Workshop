# HTTP 桥接测试指南

## ✅ 实现状态

### 已完成
- ✅ 后端 HTTP 桥接 API (`backend/routes/st-bridge.js`)
- ✅ 工坊前端 HTTP 轮询 (`frontend/src/stores/workshop.js`)
- ✅ 扩展 HTTP 命令发送 (`STCreation/index.js`)
- ✅ 所有代码已推送到 GitHub

### 仓库链接
- **主项目**: https://github.com/AlyceSingle/STCreative-Workshop
- **扩展仓库**: https://github.com/AlyceSingle/STCreation

---

## 🚀 测试步骤

### 1. 启动后端服务器

```bash
cd D:\Code\SteamPunkStore_demo\backend
npm run dev
```

**验证后端运行**：
```bash
# 浏览器访问
http://localhost:3000/api/st-bridge/ping
```
应看到：
```json
{
  "success": true,
  "pendingCommands": 0,
  "pendingResponses": 0
}
```

---

### 2. 启动前端开发服务器

```bash
cd D:\Code\SteamPunkStore_demo\frontend
npm run dev
```

应看到前端运行在 `http://localhost:5173`

---

### 3. 在 SillyTavern 中安装扩展

#### 方法 A：从 GitHub 安装（推荐）
1. 打开 SillyTavern
2. 进入 **Extensions** 面板
3. **卸载旧版本**（如果已安装）
4. 点击 "Install Extension from URL"
5. 输入：`https://github.com/AlyceSingle/STCreation`
6. 等待安装完成
7. **刷新页面**（F5）

#### 方法 B：本地安装
```powershell
# PowerShell
cd D:\Code\SteamPunkStore_demo
.\install-extension.ps1
```
然后刷新 SillyTavern 页面。

---

### 4. 配置工坊 URL

在 SillyTavern Extensions 面板中找到 **StoryShare 创意工坊** 设置：

1. 展开设置面板
2. 在"工坊网址"输入：`http://localhost:5173/workshop`
3. 点击输入框外保存

---

### 5. 打开工坊并测试连接

1. 点击"打开创意工坊"按钮
2. 新窗口应该打开工坊页面

#### 预期结果

##### ✅ SillyTavern 主窗口（F12 → Console）
```
[StoryShare Workshop] 扩展已加载
[StoryShare Workshop] 发送 HTTP 命令: ping
[StoryShare Workshop] 命令已发送: cmd_1_1234567890
[StoryShare Workshop] 收到响应: {success: true, connected: true}
[StoryShare Workshop] HTTP 连接已建立
```

##### ✅ SillyTavern 右上角
应看到绿色 toast 提示：**"工坊已连接"**

##### ✅ 工坊窗口（F12 → Console）
```
[Workshop] 初始化 ST 扩展模式...
[Workshop] 启动 HTTP 轮询...
[Workshop] HTTP 轮询已启动
[Workshop] 收到 HTTP 命令: {id: "cmd_1_1234567890", type: "ping", ...}
[Workshop] 处理命令: ping cmd_1_1234567890
[Workshop] 已连接到 ST 扩展（HTTP）
[Workshop] 已提交命令结果: cmd_1_1234567890
```

##### ✅ 工坊页面顶部
应显示绿色徽章：**✅ 已连接到 SillyTavern 扩展**

---

### 6. 测试订阅功能

1. 在工坊中浏览任意 Pack
2. 点击"订阅"按钮
3. 在 SillyTavern 中打开 **World Info** 编辑器
4. 检查是否出现新的条目，标注来源为 `storyshare_workshop`

---

## 🐛 故障排查

### 问题 1: 后端 404 错误

**症状**：访问 `/api/st-bridge/ping` 返回 404

**解决**：
```bash
# 检查 backend/server.js 是否注册了路由
cd D:\Code\SteamPunkStore_demo
grep "st-bridge" backend/server.js
```
应看到：
```javascript
const stBridgeRouter = require('./routes/st-bridge');
app.use('/api/st-bridge', stBridgeRouter);
```

如果没有，重启后端服务器。

---

### 问题 2: 扩展未发送 HTTP 命令

**症状**：SillyTavern 控制台没有"发送 HTTP 命令"日志

**原因**：
- 扩展未正确安装
- 工坊 URL 配置错误

**解决**：
1. 卸载扩展并**刷新页面**
2. 重新从 GitHub 安装
3. 再次**刷新页面**
4. 验证工坊 URL 格式：`http://localhost:5173/workshop`（不要有多余斜杠）

---

### 问题 3: 工坊未启动 HTTP 轮询

**症状**：工坊控制台没有"启动 HTTP 轮询"日志

**原因**：工坊页面未检测到扩展模式

**解决**：
1. 确保工坊是通过"打开创意工坊"按钮打开的（URL 应包含 `?st_extension=true`）
2. 检查 URL：`http://localhost:5173/workshop?st_extension=true`
3. 手动在 URL 中添加 `?st_extension=true` 并刷新

---

### 问题 4: 轮询超时

**症状**：扩展报告"等待响应超时（30秒）"

**原因**：
- 工坊未启动轮询
- 网络请求被阻止（防火墙/代理）

**检查**：
```bash
# 浏览器访问
http://localhost:3000/api/st-bridge/poll
```
应该等待 25 秒后返回：
```json
{"success": true, "command": null}
```

---

### 问题 5: CORS 错误

**症状**：浏览器控制台显示 CORS 错误

**解决**：
确保后端已启用 CORS：
```javascript
// backend/server.js
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:8000'],
  credentials: true,
}));
```

---

## 📊 HTTP 桥接工作原理

```
┌─────────────────┐         ┌──────────────┐         ┌─────────────┐
│  ST 扩展        │         │  后端桥接    │         │  工坊前端   │
│  (index.js)     │         │ (st-bridge)  │         │ (workshop)  │
└─────────────────┘         └──────────────┘         └─────────────┘
         │                         │                         │
         │ POST /command           │                         │
         ├────────────────────────>│                         │
         │ {type: 'ping'}          │                         │
         │                         │                         │
         │<────────────────────────┤                         │
         │ {commandId: 'cmd_1'}    │                         │
         │                         │                         │
         │                         │    GET /poll (25s)      │
         │                         │<────────────────────────┤
         │                         │                         │
         │                         ├────────────────────────>│
         │                         │ {command: {...}}        │
         │                         │                         │
         │                         │   POST /response        │
         │                         │<────────────────────────┤
         │                         │ {commandId, result}     │
         │                         │                         │
         │ GET /response/cmd_1     │                         │
         ├────────────────────────>│                         │
         │                         │                         │
         │<────────────────────────┤                         │
         │ {success: true, ...}    │                         │
         │                         │                         │
```

### 关键参数
- **扩展轮询间隔**：1 秒
- **扩展超时**：30 秒
- **工坊长轮询**：25 秒
- **命令自动清理**：30 秒
- **响应自动清理**：60 秒

---

## 🎯 下一步优化（可选）

1. **添加重连机制**：轮询断开后自动重试
2. **使用 Redis**：生产环境替代内存队列
3. **命令优先级**：ping 优先于其他命令
4. **批处理**：一次轮询返回多个命令
5. **连接状态指示器**：实时显示延迟和队列长度
6. **多窗口支持**：允许同时打开多个工坊实例

---

## 📝 相关文档

- [扩展安装指南](./INSTALL_EXTENSION.md)
- [扩展开发文档](./ST_EXTENSION.md)
- [项目架构](./AGENTS.md)
- [部署指南](./DEPLOY.md)
