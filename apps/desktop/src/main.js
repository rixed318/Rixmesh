import { app, BrowserWindow, Menu, dialog, ipcMain, shell } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import http from 'node:http';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../../..');

let mainWindow = null;
let serverProcess = null;
const SERVER_PORT = process.env.PORT || 4100;
const SERVER_URL = `http://127.0.0.1:${SERVER_PORT}`;

function isServerRunning(port) {
  return new Promise((resolve) => {
    const req = http.get(`http://127.0.0.1:${port}/api/roles`, (res) => {
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(500, () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function startServerDaemon() {
  const alreadyRunning = await isServerRunning(SERVER_PORT);
  if (alreadyRunning) {
    console.log(`[RixMesh Desktop] Attached to existing server on ${SERVER_URL}`);
    return;
  }

  const serverScript = path.join(ROOT_DIR, 'apps', 'server', 'src', 'index.ts');
  console.log(`[RixMesh Desktop] Spawning server daemon at ${serverScript}...`);

  serverProcess = spawn('npx', ['tsx', serverScript], {
    cwd: ROOT_DIR,
    stdio: 'inherit',
    env: { ...process.env, PORT: String(SERVER_PORT), DEVOS_HOST: '127.0.0.1' },
  });

  serverProcess.on('error', (err) => {
    console.error('[RixMesh Desktop] Server daemon error:', err);
  });

  // Poll until server is responding
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 200));
    if (await isServerRunning(SERVER_PORT)) {
      console.log(`[RixMesh Desktop] Server daemon responding on ${SERVER_URL}`);
      return;
    }
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1080,
    minHeight: 700,
    title: 'RixMesh Studio',
    backgroundColor: '#0d1117',
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  mainWindow.loadURL(SERVER_URL);

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  createMenu();
}

function createMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Open Git Repository...',
          accelerator: 'CmdOrCtrl+O',
          click: async () => {
            const { filePaths } = await dialog.showOpenDialog(mainWindow, {
              properties: ['openDirectory'],
              title: 'Select Git Repository',
            });
            if (filePaths && filePaths[0]) {
              mainWindow.webContents.send('selected-project-path', filePaths[0]);
            }
          },
        },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    {
      label: 'Edit',
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
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'RixMesh Architecture Docs',
          click: () => {
            shell.openExternal('https://github.com/rixed318/Rixmesh/blob/main/docs/architecture/ARCHITECTURE.md');
          },
        },
        {
          label: 'GitHub Repository',
          click: () => {
            shell.openExternal('https://github.com/rixed318/Rixmesh');
          },
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

app.whenReady().then(async () => {
  await startServerDaemon();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  if (serverProcess) {
    console.log('[RixMesh Desktop] Terminating embedded server daemon...');
    serverProcess.kill('SIGTERM');
    serverProcess = null;
  }
});
