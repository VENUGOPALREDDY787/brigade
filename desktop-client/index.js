const { app, BrowserWindow, globalShortcut, ipcMain, screen } = require('electron');
const path = require('path');

let mainWindow = null;

function createWindow() {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;

  // Initial window size
  const windowWidth = 720;
  const windowHeight = 480;

  mainWindow = new BrowserWindow({
    width: windowWidth,
    height: windowHeight,
    x: Math.round((screenWidth - windowWidth) / 2),
    y: Math.round(screenHeight * 0.15), // Show it near the top of the screen
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    show: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  mainWindow.loadFile('index.html');

  // Hide the window when it loses focus (blur)
  mainWindow.on('blur', () => {
    hideWindow();
  });
}

function toggleWindow() {
  if (!mainWindow) return;

  if (mainWindow.isVisible() && mainWindow.isFocused()) {
    hideWindow();
  } else {
    showWindow();
  }
}

function showWindow() {
  if (!mainWindow) return;
  mainWindow.show();
  mainWindow.focus();
  mainWindow.webContents.send('window-shown');
}

function hideWindow() {
  if (!mainWindow) return;
  mainWindow.hide();
  mainWindow.webContents.send('window-hidden');
}

app.whenReady().then(() => {
  createWindow();

  // Register global shortcut Ctrl+Shift+Space
  const ret = globalShortcut.register('CommandOrControl+Shift+Space', () => {
    toggleWindow();
  });

  if (!ret) {
    console.log('Registration failed');
  }

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// IPC listeners from renderer
ipcMain.on('hide-window', () => {
  hideWindow();
});

// IPC listener to dynamically change height based on UI content
ipcMain.on('set-height', (event, height) => {
  if (mainWindow) {
    const bounds = mainWindow.getBounds();
    mainWindow.setBounds({
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: height
    });
  }
});

app.on('will-quit', () => {
  // Unregister all shortcuts
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});
