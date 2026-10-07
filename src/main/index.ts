import { app, shell, BrowserWindow } from 'electron'
import { join } from 'path'
import { globalConfigStore } from './config/store'
import { registerIpcHandlers } from './ipc/handlers'

// Linux desktop stability: disable hardware acceleration if needed or add fallback flags
if (process.platform === 'linux') {
  app.disableHardwareAcceleration()
  app.commandLine.appendSwitch('no-sandbox')
}

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1380,
    height: 880,
    minWidth: 1080,
    minHeight: 700,
    show: false,
    autoHideMenuBar: true,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#0c0a09',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  // Ensure directories in ~/.explosion/
  globalConfigStore.ensureDirectories()
  globalConfigStore.loadConfig()

  // Register IPC handlers
  registerIpcHandlers()

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
