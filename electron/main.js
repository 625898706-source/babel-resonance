/* ============================================================================
 * electron/main.js —— Electron 主进程（打包成独立 EXE）
 * ----------------------------------------------------------------------------
 * 作用：新建一个原生窗口，加载 Vite 打包产物 dist/index.html。
 * 关键点：本游戏用 Phaser 在运行时通过 XHR 加载图片/音频（file:// 下会被同源限制），
 *        因此这里关闭 webSecurity，让本地资源能正常加载（自包含小游戏，风险可接受）。
 *        同时关闭自动播放策略限制，保证 BGM 能正常响起。
 * ========================================================================== */

const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

// 允许无用户手势也能播放音频（对自包含游戏友好；游戏本身也保留"点击开始"手势）
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 720,
    minWidth: 960,
    minHeight: 600,
    backgroundColor: '#0a0b0d',
    autoHideMenuBar: true,
    frame: false,          // 无 Windows 标题栏/边框（配合全屏，画面直接铺满屏幕）
    fullscreen: true,      // ★ 启动即全屏（盖住任务栏；不显示 Windows 底框）
    show: false,
    webPreferences: {
      // 本地自包含游戏：允许 file:// 下 XHR 加载图片/音频
      webSecurity: false,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // F11 切换全屏 / Esc 退出全屏 / Ctrl+Q 退出游戏（无边框窗口没有系统关闭键）
  try {
    win.webContents.on('before-input-event', (e, input) => {
      if (input.type !== 'keyDown') return;
      if (input.key === 'F11') { win.setFullScreen(!win.isFullScreen()); e.preventDefault(); }
      else if (input.key === 'Escape' && win.isFullScreen()) { win.setFullScreen(false); e.preventDefault(); }
      else if ((input.control || input.meta) && (input.key === 'q' || input.key === 'Q')) { app.quit(); e.preventDefault(); }
    });
  } catch (e) {}

  // 渲染进程 console / 报错 捕获到日志（排障用；正常玩家可无视）
  try {
    const logFile = 'C:\\Users\\Administrator\\Desktop\\英语集成战略\\_renderer.log';
    const log = (s) => { try { fs.appendFileSync(logFile, s + '\n'); } catch (e) {} };
    win.webContents.on('console-message', (e, level, message, line, sourceId) => {
      log('[' + level + '] ' + message + '  (' + sourceId + ':' + line + ')');
    });
    win.webContents.on('render-process-gone', (e, details) => {
      log('[render-process-gone] ' + JSON.stringify(details));
    });
    win.webContents.on('did-fail-load', (e, code, desc) => {
      log('[did-fail-load] ' + code + ' ' + desc);
    });
    log('--- session start ---');
  } catch (e) {}

  win.setMenuBarVisibility(false);
  const index = path.join(__dirname, '..', 'dist', 'index.html');
  win.loadFile(index);
  win.once('ready-to-show', () => win.show());
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
