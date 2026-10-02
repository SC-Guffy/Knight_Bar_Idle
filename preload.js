const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('bar', {
  setInteractive: (on) => ipcRenderer.send('interactive', on),
  setCampMode: (on) => ipcRenderer.send('camp-mode', on),
  // 창을 화면 전체 높이로 키운다(클릭은 통과). 이 함수가 없으면 옛 앱이라 게임은 하단바 안에서만 그린다
  setOverlay: (on) => ipcRenderer.send('overlay', on),
  setTrayTitle: (text) => ipcRenderer.send('tray-title', text),
  onReset: (cb) => ipcRenderer.on('reset', () => cb()),
  onSettings: (cb) => ipcRenderer.on('settings', (_e, s) => cb(s)),
  setAccount: (nick) => ipcRenderer.send('account', nick),
  onSwitchAccount: (cb) => ipcRenderer.on('switch-account', () => cb()),
  onFlush: (cb) => ipcRenderer.on('flush', () => cb()),
  flushed: () => ipcRenderer.send('flushed'),
  quit: () => ipcRenderer.send('quit'),
  reload: () => ipcRenderer.send('reload'),
});
