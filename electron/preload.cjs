const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  isElectron: true,
  getVersion: () => ipcRenderer.invoke('app:version'),
  minimize: () => ipcRenderer.send('window:minimize'),
  maximize: () => ipcRenderer.send('window:maximize'),
  close: () => ipcRenderer.send('window:close'),
  printPage: () => ipcRenderer.send('window:print'),
  openExternal: (url) => ipcRenderer.send('shell:openExternal', url),
  backup: {
    status: () => ipcRenderer.invoke('backup:status'),
    create: () => ipcRenderer.invoke('backup:create'),
    restore: () => ipcRenderer.invoke('backup:restore'),
    openFolder: () => ipcRenderer.invoke('backup:openFolder')
  }
});
