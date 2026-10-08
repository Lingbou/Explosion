import { app, shell, BrowserWindow, nativeImage } from 'electron'
import { join } from 'path'
import * as fs from 'fs'
import { globalConfigStore } from './config/store'
import { registerIpcHandlers } from './ipc/handlers'

// Linux desktop stability: disable hardware acceleration if needed or add fallback flags
if (process.platform === 'linux') {
  app.disableHardwareAcceleration()
  app.commandLine.appendSwitch('no-sandbox')
}

let mainWindow: BrowserWindow | null = null

function getAppIconPath(): string | undefined {
  const candidatePaths = [
    join(__dirname, '../../resources/icon.png'),
    join(__dirname, '../resources/icon.png'),
    join(process.cwd(), 'resources/icon.png'),
    join(app.getAppPath(), 'resources/icon.png')
  ]
  for (const cand of candidatePaths) {
    if (fs.existsSync(cand)) {
      return cand
    }
  }
  return undefined
}

function createWindow(): void {
  const iconPath = getAppIconPath()

  mainWindow = new BrowserWindow({
    width: 1380,
    height: 880,
    minWidth: 1080,
    minHeight: 700,
    show: false,
    autoHideMenuBar: true,
    title: 'Explosion - 现代小说创作工作台',
    ...(process.platform === 'darwin' ? { titleBarStyle: 'hiddenInset' } : {}),
    backgroundColor: '#fbfbfa',
    ...(iconPath ? { icon: iconPath } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  // Explicitly apply nativeImage icon for Linux X11/Wayland window managers
  if (iconPath && process.platform === 'linux') {
    try {
      const img = nativeImage.createFromPath(iconPath)
      if (!img.isEmpty()) {
        mainWindow.setIcon(img)
      }
    } catch {
      // ignore
    }
  }

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
