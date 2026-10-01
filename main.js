const { app, BrowserWindow, screen, ipcMain, Tray, Menu, nativeImage, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

// 앱 이름(productName)이 바뀌어도 세이브·계정이 있는 폴더는 그대로 쓴다
app.setPath('userData', path.join(app.getPath('appData'), 'knight-bar'));

const BAR_HEIGHT = 150;
const settingsPath = () => path.join(app.getPath('userData'), 'settings.json');

let win = null;
let tray = null;
let campOpen = false;   // 캠프 창이 열리면 창을 화면 전체로 키운다
let settings = { displayId: null, overDock: false, showGround: true, hudRight: false, serverUrl: '' };
let accountName = null;   // 렌더러가 알려 주는 현재 기사 닉네임
let quitting = false;

function loadSettings() {
  try { Object.assign(settings, JSON.parse(fs.readFileSync(settingsPath(), 'utf8'))); } catch {}
}
function saveSettings() {
  try { fs.writeFileSync(settingsPath(), JSON.stringify(settings)); } catch {}
}

function targetDisplay() {
  return screen.getAllDisplays().find(d => d.id === settings.displayId) || screen.getPrimaryDisplay();
}

// 선택한 모니터의 하단에 창을 붙인다. overDock=true면 Dock 위에 겹쳐서 화면 맨 아래.
function place() {
  if (!win) return;
  const d = targetDisplay();
  const area = settings.overDock ? d.bounds : d.workArea;
  const h = campOpen ? area.height : BAR_HEIGHT;
  win.setBounds({ x: area.x, y: area.y + area.height - h, width: area.width, height: h });
  win.setAlwaysOnTop(true, settings.overDock ? 'screen-saver' : 'floating');
}

function createWindow() {
  win = new BrowserWindow({
    width: 800,
    height: BAR_HEIGHT,
    transparent: true,
    backgroundColor: '#00000000',
    frame: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    hasShadow: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    acceptFirstMouse: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      backgroundThrottling: false,
    },
  });

  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  // 기본은 클릭 통과. forward:true 로 마우스 이동은 계속 받아서 HUD hover 를 감지한다.
  win.setIgnoreMouseEvents(true, { forward: true });
  place();

  loadGame();
  win.once('ready-to-show', () => win.showInactive());
  // 게임을 다시 불러올 때마다(새 버전 반영, 웹 실패 → 로컬) 설정을 다시 보낸다
  win.webContents.on('did-finish-load', () => win.webContents.send('settings', settings));

  // 개발용: KB_SNAPSHOT=경로 로 실행하면 몇 초 뒤 창을 PNG 로 저장하고 콘솔 로그를 출력
  if (process.env.KB_SNAPSHOT) {
    win.webContents.on('console-message', (e) => console.log('[renderer]', e.message));
    setTimeout(async () => {
      const img = await win.webContents.capturePage();
      fs.writeFileSync(process.env.KB_SNAPSHOT, img.toPNG());
      console.log('snapshot saved', win.getBounds());
    }, Number(process.env.KB_SNAPSHOT_DELAY || 8000));
  }
  // 개발용: KB_EVAL='자바스크립트' 로 로드 1초 뒤 렌더러에서 실행 (UI 상태를 만들어 캡처할 때)
  if (process.env.KB_EVAL) {
    win.webContents.once('did-finish-load', () => setTimeout(() => {
      win.webContents.executeJavaScript(process.env.KB_EVAL).then((r) => console.log('[eval]', r), (e) => console.log('[eval]', e.message));
    }, 1000));
  }
}

// 게임 화면은 웹(GitHub Pages)에서 불러온다. 그래서 게임 코드 업데이트는 푸시만 하면 앱에도 반영되고,
// 앱을 다시 빌드하는 건 main.js / preload.js 를 바꿀 때뿐이다. 웹을 못 불러오면 앱에 들어 있는 파일로 연다.
// 개발(npm start)에서는 고친 코드를 바로 보도록 로컬 파일을 연다. KB_WEB=주소 로 웹 주소를 지정할 수 있다.
const WEB_URL = process.env.KB_WEB || (app.isPackaged ? 'https://sc-guffy.github.io/Knight_Bar_Idle/' : '');
const LOAD_TIMEOUT = 15000;

function gameQuery() {
  // 서버 주소: KB_SERVER 환경 변수 > settings.json 의 serverUrl > 렌더러 기본값(net.js)
  return { speed: process.env.KB_SPEED || '1', server: process.env.KB_SERVER || settings.serverUrl || '' };
}

function loadLocal() {
  win.loadFile('index.html', { query: gameQuery() });
}

async function loadGame() {
  if (!WEB_URL) return loadLocal();
  await migrateLocalStorage();
  await win.webContents.session.clearCache();   // 항상 최신 게임 코드를 받는다
  const url = new URL(WEB_URL);
  for (const [k, v] of Object.entries(gameQuery())) url.searchParams.set(k, v);

  let settled = false;
  const fallback = () => {
    if (settled || !win || win.isDestroyed()) return;
    settled = true;
    clearTimeout(timer);
    win.webContents.removeListener('did-fail-load', onFail);
    loadLocal();
  };
  const onFail = (_e, code, _desc, _url, isMainFrame) => { if (isMainFrame && code !== -3) fallback(); };
  win.webContents.on('did-fail-load', onFail);
  const timer = setTimeout(fallback, LOAD_TIMEOUT);
  win.webContents.once('did-finish-load', () => {
    settled = true;
    clearTimeout(timer);
    win.webContents.removeListener('did-fail-load', onFail);
  });
  win.loadURL(url.toString()).catch(() => {});
}

// 예전 앱은 로컬 파일(file://)에서 게임을 열어서 세이브·계정이 그쪽 localStorage 에 있다.
// 웹 주소로 처음 열기 전에 한 번 옮긴다. 웹 쪽에 이미 있는 값은 덮어쓰지 않는다.
function withPage(loader, js) {
  return new Promise((resolve) => {
    const w = new BrowserWindow({ show: false });
    const done = (v) => { if (!w.isDestroyed()) w.destroy(); resolve(v); };
    w.webContents.once('did-fail-load', (_e, code) => { if (code !== -3) done(null); });
    w.webContents.once('did-finish-load', () => w.webContents.executeJavaScript(js).then(done, () => done(null)));
    setTimeout(() => done(null), LOAD_TIMEOUT);
    loader(w).catch(() => done(null));
  });
}
async function migrateLocalStorage() {
  if (settings.migratedToWeb) return;
  const dump = await withPage((w) => w.loadFile('store.html'), 'JSON.stringify(Object.assign({}, localStorage))');
  if (dump == null) return;
  if (dump !== '{}') {
    const ok = await withPage((w) => w.loadURL(new URL('store.html', WEB_URL).toString()),
      `(() => { const d = ${dump}; for (const k in d) if (localStorage.getItem(k) == null) localStorage.setItem(k, d[k]); return true; })()`);
    if (!ok) return;   // 웹을 못 열었으면 다음 실행 때 다시 시도
  }
  settings.migratedToWeb = true;
  saveSettings();
}

function trayIcon() {
  // 16x16 검 아이콘 (템플릿 이미지라 메뉴바 다크/라이트에 맞게 색이 바뀜)
  const rows = [
    '..............##',
    '.............###',
    '............###.',
    '...........###..',
    '..........###...',
    '.........###....',
    '........###.....',
    '.......###......',
    '..#...###.......',
    '..##.###........',
    '...####.........',
    '....##..........',
    '...####.........',
    '..##..##........',
    '.##.............',
    '##..............',
  ];
  const size = 16;
  const buf = Buffer.alloc(size * size * 4);
  rows.forEach((row, y) => [...row].forEach((ch, x) => {
    if (ch === '#') buf.writeUInt32LE(0xff000000, (y * size + x) * 4); // BGRA: 불투명 검정
  }));
  const img = nativeImage.createFromBitmap(buf, { width: size, height: size });
  img.setTemplateImage(true);
  return img;
}

function buildMenu() {
  const displays = screen.getAllDisplays();
  const current = targetDisplay();
  const menu = Menu.buildFromTemplate([
    { label: `⚔️ 기사 키우기 (v${app.getVersion()})`, enabled: false },
    { label: accountName ? `👤 ${accountName}` : '👤 계정 없음', enabled: false },
    { label: '계정 변경…', click: () => { win.showInactive(); win.webContents.send('switch-account'); } },
    { type: 'separator' },
    {
      label: win && win.isVisible() ? '숨기기' : '보이기',
      click: () => { win.isVisible() ? win.hide() : win.showInactive(); buildMenu(); },
    },
    {
      label: '모니터',
      submenu: displays.map((d, i) => ({
        label: `모니터 ${i + 1} (${d.size.width}×${d.size.height})${d.id === screen.getPrimaryDisplay().id ? ' · 주 모니터' : ''}`,
        type: 'radio',
        checked: d.id === current.id,
        click: () => { settings.displayId = d.id; saveSettings(); place(); },
      })),
    },
    {
      label: 'Dock 위에 겹쳐서 맨 아래에 표시',
      type: 'checkbox',
      checked: settings.overDock,
      click: (item) => { settings.overDock = item.checked; saveSettings(); place(); },
    },
    {
      label: '바닥(풀밭) 표시',
      type: 'checkbox',
      checked: settings.showGround,
      click: (item) => { settings.showGround = item.checked; saveSettings(); win.webContents.send('settings', settings); },
    },
    {
      label: 'HUD 오른쪽에 두기',
      type: 'checkbox',
      checked: settings.hudRight,
      click: (item) => { settings.hudRight = item.checked; saveSettings(); win.webContents.send('settings', settings); },
    },
    { type: 'separator' },
    {
      label: '진행 초기화…',
      click: async () => {
        const { response } = await dialog.showMessageBox({
          type: 'warning',
          buttons: ['취소', '초기화'],
          defaultId: 0,
          message: '모든 진행 상황을 초기화할까요?',
          detail: `${accountName ? `${accountName}의 ` : ''}레벨, 골드, 강화, 스테이지가 모두 처음으로 돌아갑니다. 닉네임과 결투 기록은 유지됩니다.`,
        });
        if (response === 1) win.webContents.send('reset');
      },
    },
    { label: '종료', click: () => app.quit() },
  ]);
  tray.setContextMenu(menu);
}

// 개발용: KB_USER_DATA=경로 로 세이브/설정을 별도 폴더에 둔다 (테스트가 실제 세이브를 건드리지 않게)
if (process.env.KB_USER_DATA) app.setPath('userData', process.env.KB_USER_DATA);

app.whenReady().then(() => {
  if (process.platform === 'darwin') app.dock.hide();
  loadSettings();
  createWindow();

  tray = new Tray(trayIcon());
  tray.setToolTip('기사 키우기');
  buildMenu();
  tray.on('mouse-down', buildMenu);

  const refresh = () => { place(); buildMenu(); };
  screen.on('display-metrics-changed', refresh);
  screen.on('display-added', refresh);
  screen.on('display-removed', refresh);

  ipcMain.on('interactive', (_e, on) => {
    if (win && !campOpen) win.setIgnoreMouseEvents(!on, { forward: true });
  });
  ipcMain.on('camp-mode', (_e, on) => {
    if (!win) return;
    campOpen = on;
    place();
    if (on) {
      win.setIgnoreMouseEvents(false);
      app.focus({ steal: true });
      win.focus();
    } else {
      win.setIgnoreMouseEvents(true, { forward: true });
      win.blur();
    }
  });
  ipcMain.on('quit', () => app.quit());
  // 렌더러가 새 게임 버전을 발견하면 캐시를 비우고 다시 불러온다
  ipcMain.on('reload', () => { if (win && !win.isDestroyed()) loadGame(); });
  ipcMain.on('tray-title', (_e, text) => {
    if (tray) tray.setTitle(text);
  });
  ipcMain.on('account', (_e, nick) => {
    accountName = nick;
    if (tray) tray.setToolTip(`기사 키우기 — ${nick}`);
  });
});

// 끄기 전에 렌더러가 서버에 마지막 세이브를 올릴 시간을 준다 (최대 3초)
app.on('before-quit', (e) => {
  if (quitting || !win || win.isDestroyed()) return;
  e.preventDefault();
  quitting = true;
  const done = () => app.quit();
  ipcMain.once('flushed', done);
  setTimeout(done, 3000);
  win.webContents.send('flush');
});

app.on('window-all-closed', () => app.quit());
