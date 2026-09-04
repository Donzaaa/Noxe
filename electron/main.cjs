const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, dialog, Notification, shell, clipboard } = require('electron');
const path = require('path');
const fs = require('fs');

const isDev = process.env.NODE_ENV === 'development';
const userDataPath = app.getPath('userData');
const notesFilePath = path.join(userDataPath, 'notes.json');
const settingsFilePath = path.join(userDataPath, 'settings.json');
const chatFilePath = path.join(userDataPath, 'chat.json');

app.setAppUserModelId('com.noxe.chat'); // Required for Windows notifications
app.disableHardwareAcceleration(); // Prevents GPU crash on transparent window in Windows

let mainWindow;
let tray = null;

function createWindow() {
  const iconPath = path.join(__dirname, '../icon.ico');

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
    transparent: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
    },
    titleBarStyle: 'hidden',
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5833');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // Hide the window instead of closing it when the user clicks 'X'
  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });
}

const { initTor, updateTorSecurityState } = require('./tor-manager.cjs');

app.whenReady().then(() => {
  createWindow();
  initTor(mainWindow);
  
  // Load initial security state
  try {
    if (fs.existsSync(chatFilePath)) {
      const data = JSON.parse(fs.readFileSync(chatFilePath, 'utf-8'));
      const allowRequests = !!data.allowIncomingRequests;
      const blockedContacts = data.blockedContacts || [];
      const acceptedContacts = (data.contacts || []).map(c => c.id);
      updateTorSecurityState(allowRequests, blockedContacts, acceptedContacts);
    }
  } catch (e) { console.error(e); }

  // Try to load icon.png, otherwise use fallback
  let icon;
  const trayIconPath = path.join(__dirname, '../icon.ico');
  if (fs.existsSync(trayIconPath)) {
    icon = nativeImage.createFromPath(trayIconPath);
  } else {
    const iconData = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAAXNSR0IArs4c6QAAAGVJREFUOE9jZKAQMFKon2HUAAaM/3HwGf/j4z/y8S0GxgR0G1iQxHApRsXjIyg41sQh2IDBgyEGk+UxBgy/ceO6G6ti2Y2F2QG/8RlAzACigxEiKxL3J2E9QRpD2I2EaAypoNkAADb6G590n4lGAAAAAElFTkSuQmCC';
    icon = nativeImage.createFromDataURL(iconData);
  }
  
  tray = new Tray(icon);
  
  const contextMenu = Menu.buildFromTemplate([
    { label: 'Mostra Noxe', click: () => mainWindow.show() },
    { type: 'separator' },
    { label: 'Esci', click: () => { app.isQuitting = true; app.quit(); } }
  ]);
  
  tray.setToolTip('Noxe');
  tray.setContextMenu(contextMenu);
  
  tray.on('click', () => {
    if (mainWindow.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow.show();
    }
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    } else {
      mainWindow.show();
    }
  });
});

app.on('before-quit', () => {
  app.isQuitting = true;
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC handlers for notes persistence
ipcMain.handle('load-notes', () => {
  try {
    if (fs.existsSync(notesFilePath)) {
      const data = fs.readFileSync(notesFilePath, 'utf-8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Failed to load notes:', error);
  }
  return [];
});

ipcMain.handle('save-notes', (event, notes) => {
  try {
    fs.writeFileSync(notesFilePath, JSON.stringify(notes, null, 2));
    return true;
  } catch (error) {
    console.error('Failed to save notes:', error);
    return false;
  }
});

ipcMain.handle('toggle-always-on-top', (event, isAlwaysOnTop) => {
  if (mainWindow) {
    mainWindow.setAlwaysOnTop(isAlwaysOnTop);
  }
});

ipcMain.handle('window-minimize', () => {
  if (mainWindow) mainWindow.minimize();
});

ipcMain.handle('window-maximize', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  }
});

ipcMain.handle('window-close', () => {
  if (mainWindow) {
    mainWindow.hide(); // App hides instead of quitting per existing logic
  }
});

// Settings & Custom Background IPCs
ipcMain.handle('load-settings', () => {
  try {
    if (fs.existsSync(settingsFilePath)) {
      const data = fs.readFileSync(settingsFilePath, 'utf-8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Failed to load settings:', error);
  }
  return { theme: 'theme-glass', customBg: '' };
});

ipcMain.handle('save-settings', (event, settings) => {
  try {
    fs.writeFileSync(settingsFilePath, JSON.stringify(settings, null, 2));
    return true;
  } catch (error) {
    console.error('Failed to save settings:', error);
    return false;
  }
});

ipcMain.handle('select-image', async () => {
  if (!mainWindow) return null;
  
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Seleziona immagine di sfondo',
    properties: ['openFile'],
    filters: [
      { name: 'Immagini', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp'] }
    ]
  });
  
  if (!result.canceled && result.filePaths.length > 0) {
    const filePath = result.filePaths[0];
    try {
      const bitmap = fs.readFileSync(filePath);
      const base64 = Buffer.from(bitmap).toString('base64');
      const ext = path.extname(filePath).substring(1);
      return `data:image/${ext || 'png'};base64,${base64}`;
    } catch (error) {
      console.error('Failed to read image:', error);
    }
  }
  return null;
});

ipcMain.handle('show-notification', (event, title, body) => {
  const notification = new Notification({
    title: title,
    body: body,
    icon: path.join(__dirname, '../icon.png')
  });
  
  notification.on('click', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });

  notification.show();
});

// Chat data persistence
ipcMain.handle('load-chat-data', () => {
  try {
    if (fs.existsSync(chatFilePath)) {
      const data = fs.readFileSync(chatFilePath, 'utf-8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Failed to load chat data:', error);
  }
  return null;
});

ipcMain.handle('save-chat-data', (event, data) => {
  try {
    fs.writeFileSync(chatFilePath, JSON.stringify(data, null, 2));
    
    if (data) {
       const allowRequests = !!data.allowIncomingRequests;
       const blockedContacts = data.blockedContacts || [];
       const acceptedContacts = (data.contacts || []).map(c => c.id);
       updateTorSecurityState(allowRequests, blockedContacts, acceptedContacts);
    }
    
    return true;
  } catch (error) {
    console.error('Failed to save chat data:', error);
    return false;
  }
});

ipcMain.handle('open-external', (event, url) => {
  shell.openExternal(url);
});

ipcMain.handle('copy-to-clipboard', (event, text) => {
  clipboard.writeText(text);
});
