'use strict';
// 최소 앱 버전 (민클라). 데스크탑 앱(Electron)은 게임 화면을 웹에서 불러오지만 main.js·preload.js 는 설치 때 버전 그대로라,
// 예전 설치본은 여기서 막고 새 설치 파일을 받게 한다. 앱 버전은 Electron 기본 User-Agent 의 "KnightBar/0.5.2" 에서 읽는다.
// 다른 스크립트보다 먼저(<head> 맨 앞) 불러야 한다 — 막히면 문서 나머지를 글자로 삼켜서 나머지 스크립트가 아예 돌지 않는다.
// 서버도 같은 기준으로 막는다 (server/index.js APP_MIN_VERSION) — 두 값을 같이 올린다.
const APP_MIN_VERSION = '0.5.2';
const APP_RELEASES = 'https://github.com/SC-Guffy/Knight_Bar_Idle/releases/latest';

// 로컬 개발 주소에서는 ?fakeapp=0.4.0 으로 예전 앱인 척 막는 화면을 볼 수 있다 (docs/specs/app-min-version.md 확인 방법)
const FAKE_APP = /^(localhost|127\.0\.0\.1|\[::1\])$|\.localhost$|\.test$/.test(location.hostname) ? new URLSearchParams(location.search).get('fakeapp') : null;
const appVersion = FAKE_APP || (() => {
  const m = /KnightBar\/(\d+(?:\.\d+)*)/i.exec(navigator.userAgent);
  return m ? m[1] : null;
})();
// Electron 앱인데 버전을 못 읽으면(이름이 다른 아주 예전 설치본) 예전 것으로 본다
const isApp = !!FAKE_APP || !!window.bar || /Electron\//.test(navigator.userAgent);
function appAtLeast(v, min) {
  const a = String(v || '0').split('.').map((x) => parseInt(x, 10) || 0), b = min.split('.').map((x) => parseInt(x, 10) || 0);
  for (let i = 0; i < Math.max(a.length, b.length); i++) if ((a[i] || 0) !== (b[i] || 0)) return (a[i] || 0) > (b[i] || 0);
  return true;
}

// 막는 화면. net.js 도 서버가 426 app-outdated 를 주면 이걸 부른다
function showAppGate() {
  if (window.top !== window) { try { window.top.showAppGate && window.top.showAppGate(); } catch {} return; }
  if (document.getElementById('appGate')) return;
  window.KB_APP_OUTDATED = true;
  const os = /Windows/i.test(navigator.userAgent) ? 'win' : /Mac/i.test(navigator.userAgent) ? 'mac' : null;
  const dl = (file) => `https://github.com/SC-Guffy/Knight_Bar_Idle/releases/latest/download/${file}`;
  const btns = [
    ['mac', 'KnightBar-mac-arm64.dmg', 'Mac (Apple 칩)'],
    ['mac', 'KnightBar-mac-x64.dmg', 'Mac (Intel)'],
    ['win', 'KnightBar-win-x64.exe', 'Windows'],
  ].filter(([o]) => !os || o === os);
  const btn = 'display:block;padding:11px 14px;border-radius:9px;text-decoration:none;font-weight:700;text-align:center;';
  // 창이 하단바 높이(150px 안팎)로 남아도 쓸 수 있게: 낮으면 제목 + 받기 버튼 한 줄만 (@media max-height)
  const html = `
    <style>@media (max-height: 420px) {
      #appGate { padding: 6px !important; align-items: flex-end !important; }
      #appGate .ag-box { width: auto !important; max-width: 100%; padding: 8px 12px !important; display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
      #appGate .ag-title { font-size: 14px !important; margin: 0 !important; }
      #appGate .ag-hide { display: none !important; }
      #appGate .ag-btns { flex-direction: row !important; flex-wrap: wrap; }
      #appGate .ag-btns a { padding: 6px 10px !important; }
      #appGate #appGateQuit { margin: 0 !important; }
    }</style>
    <div id="appGate" style="position:fixed;inset:0;z-index:2147483647;display:flex;align-items:center;justify-content:center;padding:16px;box-sizing:border-box;
      background:rgba(6,6,12,.82);font:14px/1.6 -apple-system,'Malgun Gothic','Apple SD Gothic Neo',sans-serif;color:#ece8f4;">
      <div class="ag-box" style="width:min(440px,100%);background:#1c1a2a;border:2px solid #4a4566;border-radius:12px;padding:20px 22px;box-sizing:border-box;">
        <div class="ag-title" style="font-size:18px;font-weight:800;margin-bottom:6px;">새 버전 앱을 받아 주세요</div>
        <div class="ag-hide" style="color:#b5afc8;margin-bottom:14px;">지금 설치된 앱(${appVersion ? 'v' + appVersion : '예전 버전'})으로는 더 이상 플레이할 수 없어요.
          아래에서 새 설치 파일(v${APP_MIN_VERSION} 이상)을 받아 덮어 설치하면, 기사·진행 상황은 그대로 이어져요.</div>
        <div class="ag-btns" style="display:flex;flex-direction:column;gap:7px;">
          ${btns.map(([, f, label], i) => `<a href="${dl(f)}" style="${btn}${i === 0 ? 'background:#e8b04a;color:#1a1206;' : 'background:#2c2940;color:#ece8f4;border:1px solid #4a4566;'}">⬇ ${label} 설치 파일 받기</a>`).join('')}
          <a class="ag-hide" href="${APP_RELEASES}" target="_blank" rel="noopener" style="${btn}background:transparent;color:#e8b04a;border:1px solid #4a4566;">다운로드 페이지 열기</a>
        </div>
        <div class="ag-hide" style="color:#8a84a0;font-size:12px;margin-top:12px;word-break:break-all;">브라우저에서 직접 받기: ${APP_RELEASES}</div>
        ${window.bar && window.bar.quit ? '<button id="appGateQuit" style="all:unset;cursor:pointer;display:block;margin:12px auto 0;color:#8a84a0;font-size:12px;">앱 끄기</button>' : ''}
      </div>
    </div>`;
  const mount = () => {
    if (!document.body) document.documentElement.appendChild(document.createElement('body'));
    document.body.style.background = 'transparent';
    document.body.insertAdjacentHTML('beforeend', html);
    const q = document.getElementById('appGateQuit');
    if (q) q.onclick = () => window.bar.quit();
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount); else mount();
  // 앱 창을 화면 전체로 키우고 클릭·키보드를 받게 한다 (창 API v2 가 없는 예전 앱은 예전 통로로)
  const bar = window.bar;
  const grow = () => {
    try {
      if (bar.setWindow) bar.setWindow('app-gate', { height: 'full', mouse: 'all', focus: true });
      else { if (bar.setOverlay) bar.setOverlay(true); if (bar.setCampMode) bar.setCampMode(true); }
      if (bar.setInteractive) bar.setInteractive(true);
    } catch {}
  };
  // 한 번만 요청하면 실제 0.5.1 맥 앱에서 창이 하단바 높이로 남아 안내가 잘렸다 (10-20 사용자 신고) — 떠 있는 동안 계속 다시 요청한다
  if (bar) { grow(); setInterval(grow, 1000); }
}

if (window.top === window && isApp && !appAtLeast(appVersion, APP_MIN_VERSION)) {
  window.KB_APP_OUTDATED = true;
  window.KB_GATE_STOPPED = true;
  // 아래 게임 스크립트·리소스를 더 돌리지 않는다 (게임이 부팅·저장하지 않게). 문서 나머지를 <plaintext> 로 삼켜 글자로만 읽힌다.
  // window.stop() 은 쓰면 안 된다: 문서 읽기가 중간에 끊겨 첫 화면 그리기(ready-to-show)가 안 오고, 그때만 창을 보여 주는 앱(0.5.1 맥)은 창이 끝내 안 뜬다
  document.write('<plaintext style="display:none">');
  showAppGate();
}
