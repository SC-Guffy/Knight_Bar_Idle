const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('bar', {
  setInteractive: (on) => ipcRenderer.send('interactive', on),
  setCampMode: (on) => ipcRenderer.send('camp-mode', on),
  // 창을 화면 전체 높이로 키운다(클릭은 통과). 이 함수가 없으면 옛 앱이라 게임은 하단바 안에서만 그린다
  setOverlay: (on) => ipcRenderer.send('overlay', on),
  // ── 창 API v2 (0.4.0~). 웹 코드에서는 `if (window.bar.api >= 2)` 로 확인하고 쓴다 ──
  api: 2,
  // 이름(key)마다 창 크기·입력을 요청한다. spec 이 null 이면 그 요청을 거둔다. 메인이 모든 요청을 합쳐 창을 정한다.
  //  { height: 'full'(기본) | 하단바 높이 px, cover: 'work'(기본) | 'screen'(작업표시줄·Dock 까지),
  //    focus: 키보드 입력 받기, mouse: 'all' 이면 창 전체가 클릭을 받음(기본은 .interactive 위에서만) }
  setWindow: (key, spec) => ipcRenderer.send('window-request', key, spec || null),
  // 모니터·창 위치 { window, display: { bounds, workArea, scaleFactor }, displays, requests, platform } — 화면 좌표, 논리 px
  getDisplay: () => ipcRenderer.invoke('get-display'),
  onDisplay: (cb) => ipcRenderer.on('display', (_e, d) => cb(d)),   // 창 크기·모니터가 바뀔 때마다
  getCursor: () => ipcRenderer.invoke('cursor'),                     // { x, y (창 기준), screenX, screenY }
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
