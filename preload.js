const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('bar', {
  setInteractive: (on) => ipcRenderer.send('interactive', on),
  setCampMode: (on) => ipcRenderer.send('camp-mode', on),
  setTrayTitle: (text) => ipcRenderer.send('tray-title', text),
  onReset: (cb) => ipcRenderer.on('reset', () => cb()),
  onSettings: (cb) => ipcRenderer.on('settings', (_e, s) => cb(s)),
  setAccount: (nick) => ipcRenderer.send('account', nick),
  onSwitchAccount: (cb) => ipcRenderer.on('switch-account', () => cb()),
  onFlush: (cb) => ipcRenderer.on('flush', () => cb()),
  flushed: () => ipcRenderer.send('flushed'),
  quit: () => ipcRenderer.send('quit'),
  reload: () => ipcRenderer.send('reload'),
  setGameVersion: (v) => ipcRenderer.send('game-version', v),
});
