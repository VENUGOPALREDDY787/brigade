const { app, BrowserWindow, globalShortcut, ipcMain, screen } = require('electron');
const { spawn } = require('child_process');
const path = require('path');

let mainWindow = null;

// Request single instance lock
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    createWindow();

    const ret = globalShortcut.register('CommandOrControl+Shift+Space', () => {
      toggleWindow();
    });

    if (!ret) {
      console.log('Shortcut registration failed');
    }

    app.on('activate', function () {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 700,
    frame: true,
    transparent: false,
    alwaysOnTop: false,
    skipTaskbar: false,
    resizable: true,
    show: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  mainWindow.loadFile('index.html');
  mainWindow.center();

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });
}

function toggleWindow() {
  if (!mainWindow) return;

  if (mainWindow.isVisible()) {
    mainWindow.hide();
  } else {
    mainWindow.show();
    mainWindow.focus();
  }
}

// IPC listener to execute the actual local Brigade CLI dynamically
ipcMain.on('run-brigade-cli', (event, query) => {
  console.log(`Executing Brigade CLI for query: "${query}"`);
  
  // Spawn "node brigade.mjs agent -m <query>" inside the brigade directory
  const child = spawn('node', ['brigade.mjs', 'agent', '-m', query], {
    cwd: 'D:\\saas\\BRIGADE DESKTOP\\brigade',
    env: { ...process.env, FORCE_COLOR: '1' } // Force color output if supported
  });

  child.stdout.on('data', (data) => {
    event.sender.send('cli-stream-chunk', data.toString());
  });

  child.stderr.on('data', (data) => {
    event.sender.send('cli-stream-chunk', data.toString()); // Pipe stderr too in case of info logs
  });

  child.on('close', (code) => {
    event.sender.send('cli-stream-done', code);
  });
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});
