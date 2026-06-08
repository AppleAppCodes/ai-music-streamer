import { app, BrowserWindow, Menu, shell } from 'electron';
import path from 'node:path';
import { autoUpdater } from 'electron-updater';

const YORIAX_URL = process.env.YORIAX_DESKTOP_URL || 'https://www.yoriax.com';
const YORIAX_HOSTS = new Set(['www.yoriax.com', 'yoriax.com']);
const AUTH_HOSTS = new Set([
  'accounts.google.com',
  'eiqelhjugiwckvxyixyh.supabase.co',
]);

let mainWindow: BrowserWindow | null = null;

function isAllowedAppUrl(rawUrl: string) {
  try {
    const url = new URL(rawUrl);
    if (url.protocol !== 'https:') return false;
    return YORIAX_HOSTS.has(url.hostname) || AUTH_HOSTS.has(url.hostname);
  } catch {
    return false;
  }
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 1040,
    minHeight: 680,
    backgroundColor: '#050505',
    titleBarStyle: 'hiddenInset',
    title: 'YORIAX',
    show: false,
    icon: path.join(__dirname, '../assets/icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      autoplayPolicy: 'no-user-gesture-required',
    },
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isAllowedAppUrl(url)) {
      mainWindow?.loadURL(url);
    } else {
      void shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (isAllowedAppUrl(url)) return;
    event.preventDefault();
    void shell.openExternal(url);
  });

  mainWindow.webContents.session.setPermissionRequestHandler((_webContents, _permission, callback) => {
    callback(false);
  });

  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow?.webContents.insertCSS(`
      body { -webkit-app-region: drag; }
      a, button, input, textarea, select, [role="button"], [tabindex="0"], .no-drag { -webkit-app-region: no-drag; }
      .w-52.bg-black { padding-top: 44px !important; }
      /* Hide 'Für dich' feed since it's meant for mobile */
      a[href="/feed"] { display: none !important; }
    `);
  });

  void mainWindow.loadURL(YORIAX_URL);
}

function createMenu() {
  const isMac = process.platform === 'darwin';

  const template: Electron.MenuItemConstructorOptions[] = [
    ...(isMac
      ? [{
          label: app.name,
          submenu: [
            { role: 'about' as const },
            { type: 'separator' as const },
            { role: 'services' as const },
            { type: 'separator' as const },
            { role: 'hide' as const },
            { role: 'hideOthers' as const },
            { role: 'unhide' as const },
            { type: 'separator' as const },
            { role: 'quit' as const },
          ],
        }]
      : []),
    {
      label: 'YORIAX',
      submenu: [
        {
          label: 'Startseite',
          accelerator: 'CmdOrCtrl+H',
          click: () => mainWindow?.loadURL(YORIAX_URL),
        },
        { role: 'reload' },
        { role: 'forceReload' },
        { type: 'separator' },
        { role: 'toggleDevTools' },
      ],
    },
    {
      label: 'Bearbeiten',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'Fenster',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        ...(isMac
          ? [
              { type: 'separator' as const },
              { role: 'front' as const },
            ]
          : [{ role: 'close' as const }]),
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

app.setName('YORIAX');

app.whenReady().then(() => {
  createMenu();
  createMainWindow();
  
  // Check for updates silently in the background
  autoUpdater.checkForUpdatesAndNotify();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
