const { app, BrowserWindow, shell } = require('electron');
const path = require('path');

app.setName('telegram-custom');
app.setPath('userData', path.join(app.getPath('appData'), 'telegram-custom'));

let mainWindow;

const isDev = process.argv.includes('--dev') || process.env.TG_DEV === '1';
const devUrl = process.env.TG_DEV_URL || 'http://localhost:1234/';

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 400,
    minHeight: 500,
    title: 'Telegram Custom',
    icon: path.join(__dirname, '..', 'public', 'icon-512x512.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs'),
    },
    autoHideMenuBar: true,
  });

  if (isDev) {
    mainWindow.loadURL(devUrl);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = undefined;
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  app.quit();
});

app.on('activate', () => {
  if (!mainWindow) {
    createWindow();
  }
});
