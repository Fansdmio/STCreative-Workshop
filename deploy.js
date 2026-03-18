import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 配置区域
const SSH_CONFIG = {
  host: 'lkm',
  user: 'root',
  port: 22
};

const PATHS = {
  frontendDist: join(__dirname, 'frontend', 'dist'),
  backendDir: join(__dirname, 'backend'),
  remoteNginxPath: '/usr/share/nginx/html',
  remoteFrontendName: 'STCreativeWorkshop',
  remoteBackendPath: '/root/st-project',
  remoteBackendName: 'backend'
};

const SERVICE_NAME = 'STCreativeWorkshop.service';

// 工具函数
function runCommand(command) {
  try {
    execSync(command, { stdio: 'pipe', cwd: __dirname });
  } catch (error) {
    console.error(`[错误] 命令执行失败: ${error.message}`);
    process.exit(1);
  }
}

function getSshConnection() {
  return `${SSH_CONFIG.user}@${SSH_CONFIG.host}`;
}

function getTimestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
}

// 构建前端
function buildFrontend() {
  console.log('[前端] 开始构建...');
  runCommand('cd frontend && npm run build');
  
  if (!existsSync(PATHS.frontendDist)) {
    console.error('[错误] 前端构建失败: dist 目录不存在');
    process.exit(1);
  }
  console.log('[前端] 构建完成');
}

// 部署前端
function deployFrontend() {
  console.log('[前端] 开始部署');
  
  buildFrontend();
  
  const sshConn = getSshConnection();
  const remotePath = `${PATHS.remoteNginxPath}/${PATHS.remoteFrontendName}`;
  const backupPath = `${remotePath}.backup.${getTimestamp()}`;
  
  runCommand(`ssh ${sshConn} "if [ -d ${remotePath} ]; then mv ${remotePath} ${backupPath}; fi"`);
  runCommand(`ssh ${sshConn} "mkdir -p ${PATHS.remoteNginxPath}"`);
  runCommand(`scp -r "${PATHS.frontendDist}" ${sshConn}:${remotePath}`);
  runCommand(`ssh ${sshConn} "chown -R www-data:www-data ${remotePath} && chmod -R 755 ${remotePath}"`);
  
  console.log('[前端] 部署完成');
}

// 部署后端
function deployBackend() {
  console.log('[后端] 开始部署');
  
  const sshConn = getSshConnection();
  const remotePath = `${PATHS.remoteBackendPath}/${PATHS.remoteBackendName}`;
  const backupPath = `${remotePath}.backup.${getTimestamp()}`;
  const tempBackupDir = `/tmp/stcw-backup-${getTimestamp()}`;
  
  runCommand(`ssh ${sshConn} "systemctl stop ${SERVICE_NAME} || true"`);
  runCommand(`ssh ${sshConn} "if [ -d ${remotePath} ]; then cp -r ${remotePath} ${backupPath}; fi"`);
  runCommand(`ssh ${sshConn} "mkdir -p ${tempBackupDir} && if [ -f ${remotePath}/.env ]; then cp ${remotePath}/.env ${tempBackupDir}/.env; fi && if [ -f ${remotePath}/db/stories.db ]; then cp ${remotePath}/db/stories.db ${tempBackupDir}/stories.db; fi"`);
  runCommand(`ssh ${sshConn} "mkdir -p ${PATHS.remoteBackendPath}"`);
  runCommand(`ssh ${sshConn} "if [ -d ${remotePath} ]; then rm -rf ${remotePath}/*; fi"`);
  runCommand(`scp -r "${PATHS.backendDir}"/* ${sshConn}:${remotePath}/`);
  runCommand(`ssh ${sshConn} "if [ -f ${tempBackupDir}/.env ]; then cp ${tempBackupDir}/.env ${remotePath}/.env; fi && if [ -f ${tempBackupDir}/stories.db ]; then mkdir -p ${remotePath}/db && cp ${tempBackupDir}/stories.db ${remotePath}/db/stories.db; fi && rm -rf ${tempBackupDir}"`);
  runCommand(`ssh ${sshConn} "rm -f ${remotePath}/.env.example"`);
  
  console.log('[后端] 安装依赖中...');
  runCommand(`ssh ${sshConn} "cd ${remotePath} && npm install --production"`);
  
  runCommand(`ssh ${sshConn} "systemctl start ${SERVICE_NAME}"`);
  
  console.log('[后端] 部署完成');
}

// 部署全部
function deployAll() {
  console.log('[全部] 开始部署');
  deployFrontend();
  deployBackend();
  console.log('[全部] 部署完成');
}

// 显示帮助信息
function showHelp() {
  console.log(`
部署脚本使用说明

用法:
  npm run deploy              默认部署前端
  npm run deploy frontend     部署前端
  npm run deploy backend      部署后端
  npm run deploy all          部署全部
  npm run deploy help         显示帮助信息

配置:
  请在 deploy.js 文件顶部修改 SSH_CONFIG 配置
  - host: 服务器 IP 地址
  - user: SSH 用户名 (默认 root)
  - port: SSH 端口 (默认 22)

注意事项:
  - 确保本地已配置 SSH 密钥免密登录
  - 前端会自动构建后上传
  - 后端会自动备份 .env 和 stories.db
  - 部署前会自动备份服务器上的旧版本
  `);
}

// 主程序
function main() {
  const target = process.argv[2] || 'frontend';
  
  if (SSH_CONFIG.host === '你的服务器IP') {
    console.error('[错误] 请先在 deploy.js 中配置 SSH_CONFIG.host');
    process.exit(1);
  }
  
  console.log(`[部署] 目标: ${target}`);
  
  switch (target.toLowerCase()) {
    case 'frontend':
      deployFrontend();
      break;
    case 'backend':
      deployBackend();
      break;
    case 'all':
      deployAll();
      break;
    case 'help':
    case '--help':
    case '-h':
      showHelp();
      break;
    default:
      console.error(`[错误] 未知的部署目标: ${target}`);
      showHelp();
      process.exit(1);
  }
}

main();
