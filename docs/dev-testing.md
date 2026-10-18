# 로컬 테스트 방법

Claude Code 내장 브라우저(browser pane) 기준이다. 경로는 저장소 루트(`Knight_Bar_Idle/`) 기준.

## 웹 게임 띄우기 (오프라인)

- 정적 서버: `.claude/launch.json` 의 `knight-bar-web-2` (저장소 루트를 8766에서 제공) 를 `preview_start` 로 띄운다. 상위 폴더 `knight_bar/.claude/launch.json` 에도 `knight-bar-web` (8765) 이 있다.
  - "Port … is in use by another chat's dev server" 라고 거부되면, 그 서버가 같은 파일을 제공하므로 `preview_start { url: 'http://localhost:<포트>/index.html?server=http://127.0.0.1:9' }` 로 연다.
  - 등록은 남아 있는데 실제로는 응답이 없으면 Bash에서 직접 띄운다: `python -m http.server 8766 &` (저장소 루트에서). 끝나면 netstat/taskkill로 정리한다.
- 주소: `index.html?server=http://127.0.0.1:9` (닿지 않는 서버 → 오프라인 모드). **진짜 서버에 가짜 토큰을 쓰지 말 것**: `gone` 응답이 오고 로컬 계정 목록이 지워진다.
- 첫 로드 전에 localStorage `knight-bar-accounts` = `{"active":"테스트","list":{"테스트":"local-test-token"}}` 를 넣어 닉네임 창을 건너뛴다. 로드 후 약 8초 기다렸다가(enterAccount 서버 호출이 끝나도록) 상태를 만진다.
- **캐시 주의**: `src/*.js` 를 고친 뒤 그냥 새로고침하면 옛 스크립트가 나온다. `await fetch('src/ui.js', {cache:'reload'})` (core.js 등 고친 파일 모두) → `location.reload()` 하고, 새로 추가한 심볼(`typeof 새함수`)로 새 코드인지 확인한다.
- 오프라인 모드는 서버 시각을 모른다(`srvClock.known = false`) → 창고 비축·하루 초기화·우편이 멈춘다. 확인하려면 콘솔에서 `setServerTime(Date.now())`.
- javascript_tool 에서 전역 재할당(`startCast = fn`)은 조용히 무시된다. `window.startCast = fn` 으로 쓴다. 속성 변경(`S.phase = ...`)은 된다.
- 숨겨진 브라우저 창은 rAF가 멈춘다. "몇 초 기다렸다 스크린샷" 방식은 거의 진행되지 않는다.
  화면 갱신도 멈춰서 DOM 을 바꿔도 스크린샷이 옛 화면일 수 있다 → `tabs_select` 로 탭을 앞으로 가져온 뒤 찍는다.

## 재료의 미궁 (= "보스러쉬", `src/dungeon.js` `startDungeon`)

1. 위처럼 오프라인으로 띄운다.
2. `simulate` 를 `S.phase === 'dungeon'` 일 때 건너뛰도록 패치한다 (`window.simulate = ...`). 숨은 창에서 dt가 5초를 넘으면 simulate → `endDungeon('offline')` 으로 끝나 버린다.
3. 진입:
   ```js
   S.phase='camp'; S.best=S.stage=30; S.train.atk=15; S.train.hp=15; S.train.def=10; S.dg.tixUsed=0; S.hp=stats().maxHp; startDungeon(); closeCamp(); beginDungeonView(); save(); renderHud();
   ```

## 캠프 UI 빠른 상태

```js
S.phase='camp'; S.stones=5000; S.mats.mana=5000; S.mats.ore=5000; S.gold=1e5; S.bld.forge=10; S.forge.enchant=5; openCamp(); campTab='town'; townUi.sel='forge'; renderCamp();
```
- 장비: `rollLoot(g, 30, false)` 를 `k==='gear'` 가 나올 때까지 반복 → `claimLoot` + `equipGear`.
- 스킬 탭:
  ```js
  S.phase='camp'; S.cls='paladin'; S.level=70; S.tomes=1; S.mast={}; S.tree={}; skillSel=null; openCamp(); campTab='char'; charUi.sub='skill'; renderCamp();
  ```
  빨간 점 확인: `[...document.querySelectorAll('.skchip')].map(b=>b.classList.contains('rd'))`, `campDots().skill`.
- 계정이 없으면 `openCamp()` 가 조용히 아무것도 안 한다 (위 localStorage 필요).

## 스킬·평타 시뮬레이터 (`dev/skills.html`)

- 계정이 필요 없다. `http://localhost:<포트>/dev/skills.html`.
- `window.skillTest = { state, setClass(id), setStage(0..3), cast(skillId), step(sec) }`. `step(1/60)` 반복 = 프레임마다 tick + render 라서 그리기 에러도 드러난다. 시간은 대기 대신 `step()` 으로 진행한다.
- 전체 점검 루프: 직업마다 `setClass` → 스킬마다 `setStage(st)` (★ 노드도 `S.tree` 에 반영됨) → `cast(id)` → `step(1/60)` × (dur + 1.5초, ward 스킬은 + ward.dur).
- 버튼은 접근성 이름이 없다: `[...document.querySelectorAll('button')].find(b => b.textContent.includes('단계 순회')).click()`.
- 스킬·직업을 추가·변경하면 위 루프로 예외가 없는지 확인하고, 절정 순간을 `step()` 으로 맞춰 스크린샷한다. 끝나면 페이지를 "단계 순회"에 둔다.
- 여러 에이전트가 동시에 쓸 때는 각자 `tabs_create` 로 탭을 따로 연다.
- 주소로 바로 열기: `dev/skills.html?cls=<직업 id>&skill=<스킬 id>&stage=<0~3>` 는 그 스킬만 반복 재생한다(전 직업 순회를 켜면 풀림). 평타는 `?mode=basic&cls=<직업 id>`. 검토 페이지(`dev/review/*.html`)의 ▶ 링크가 이것을 쓴다.
- 하단바 양 끝 밝기 측정·전후 캡처: `dev/skills.html?patch=vfx-edge-probe` → 콘솔 `probeAll()` (궁극기 뺀 스킬마다 양 끝 40px 밝기 최대 변화, 기준 ±0.05), `snapAt`·`snapBasic`·`snapBurst`(평타 섬광 4배 확대)·`snapDuel`(결투 재생) — 사용법은 `dev/review/vfx-edge-probe.js` 머리 주석, 결과는 [specs/vfx-rule-fixes.md](specs/vfx-rule-fixes.md). 수신기 포트는 인자로 바꿀 수 있다(다른 세션과 8798 이 겹칠 때).
- 스킬 VFX 장면 캡처(시작·타격·끝, 피해 숫자 없이): `#c` 캔버스를 `toDataURL` 로 `127.0.0.1:8798/save` 에 보낸다. 프레임 고르는 규칙과 스크립트 요지는 [specs/skill-vfx.md](specs/skill-vfx.md) "캡처 재현". 숨은 창에서는 아주 느리니 `tabs_select` 로 앞에 둔다.

### 컷 스크린샷 저장

- `window.cutStrip(직업 id, 동작 번호)`, `window.cutShot(이름, 항목, {cols, scale, cw, ch})`.
- cutShot 은 `127.0.0.1:8798/save?name=` 으로 PNG를 보낸다. 받는 쪽은 `python -I dev/shot-recv.py dev/shots` (세션마다 다시 띄운다). 결과는 `dev/shots/<이름>.png` (git 제외).

## 도전의 탑 무리 시뮬레이터 (`dev/tower-pack-sim.js`)

- `dev/skills.html` 을 연 뒤 콘솔(javascript_tool)에서 불러온다. 테스트 페이지 루프를 멈추고 게임 `update(1/60)` 을 직접 돌려 탑 전투를 잰다 ([specs/tower-packs.md](specs/tower-packs.md)).
  ```js
  await new Promise((ok) => { const s = document.createElement('script'); s.src = 'tower-pack-sim.js?t=' + Date.now(); s.onload = ok; document.body.appendChild(s); });
  towerSim.compare([...towerSim.TIER2, ...towerSim.TIER3], { pack: {} }, { curve: 'real', seeds: 8 })
  ```
- 무리는 게임이 직접 낸다(`towerPack`·`towerMonsters`). 기준선 `elite` 는 `window.towerPack = () => 1` 로 잰다. 옛 실험용 `pack: { pack: (f) => n, hpShare }` 옵션도 남아 있다.
- 결과는 직업별 "정예만" 평균 최고 층과 설정별 차이 표다. `curve: 'fine'` 은 보스 없이 층 간격을 잘게(체력 ×1.08/칸) 쪼개 작은 차이를 본다.
- javascript_tool 은 한 번에 30초쯤 넘으면 끊긴다. 직업 12종 × 12회 × 설정 하나씩 나눠 부른다 (결과는 `towerSim.res` 에 쌓이고 `towerSim.table(직업들, [설정 이름], curve)` 로 다시 볼 수 있다).
- 페이지의 `towerMonster`·`towerBossFloor`·`towerPack`·`save` 를 덮어쓰므로 끝나면 페이지를 새로고침한다.
- 실제 게임에서 무리 층을 바로 보는 스니펫(`towerTest(13)`)은 [specs/tower-packs.md](specs/tower-packs.md) "확인 방법".

## UI 도트 아이콘 (`dev/icons.html`)

- `node dev/make-icons.js` 로 `src/skin/icons.png`·`icons.css` 를 다시 만든 뒤 `http://localhost:<포트>/dev/icons.html` — 이모지와 도트 아이콘을 1×·2×·4×, 캠프 탭 줄 견본으로 비교한다.
- 그림만 크게 볼 때는 브라우저 없이 `python -I dev/icon-preview.py dev/shots/pv.png [이름 ...]` → Read 로 PNG 를 본다 (6배 + 1배 사본).
- 스크린샷을 1:1 로 보려면 `resize_window {width: 800, height: 600}` (기본 창은 축소되어 도트가 뭉개져 보인다). 끝나면 `preset: 'desktop'`.

## UI 버튼 상태 견본 (`dev/ui-buttons.html`)

- 계정이 필요 없다. `index.html` 기본 스타일 + `src/skin/pixel.css` 를 불러와 버튼 종류 × 평상시/hover/눌림을 한 화면에 보여준다 (`:hover`/`:active` 규칙을 `.is-hover`/`.is-active` 로 복제).
- 전후 비교: 고치기 전 CSS 를 `src/skin/` 안에 임시 이름으로 복사해 두고 `?css=<그 이름>` 으로 연다 (상대 경로 SVG 가 그대로 풀린다). 끝나면 복사본을 지운다.
- 스크린샷이 패널 크기에 맞춰 축소되면 도트가 뭉개진다. 뷰포트를 패널보다 작게(예: 800 폭) 잡아 1:1 로 찍는다.

## 진짜 로컬 서버 (`server/`)

- Node가 PATH에 없으면 VS Code에 내장된 Node(v20)를 쓴다: `ELECTRON_RUN_AS_NODE=1 "/c/Users/qudal/AppData/Local/Programs/Microsoft VS Code/Code.exe" script.js` (PC마다 경로가 다를 수 있다).
- `server/` 에서 `PORT=3123 DATA_DIR=<스크래치>/data BOT_TICK_MS=3000 <node> index.js` (파일 저장소, pg 불필요) → `index.html?server=http://localhost:3123`.
- 테스트 계정: curl `POST /api/accounts` 에 **ASCII 닉네임**을 쓴다 (Windows curl 인자에서 한글이 깨진다). 받은 토큰을 로드 전에 localStorage `knight-bar-accounts` 에 넣는다.

## 기사단 (1단계, `guild.html`, [specs/guild.md](specs/guild.md))

- 켜기: `index.html?guild=1` (끄기 `?guild=0`). 웹만 — Electron(`window.bar`)에선 무시된다. 켜져 있으면 `guild.html` 로 넘어가 기사단 이름 → 지금 계정이 기사1.
- 새 기사를 만들려면 진짜 로컬 서버가 필요하다(위 "진짜 로컬 서버"): `index.html?server=http://localhost:<서버 포트>&guild=1`. 오프라인 주소(`127.0.0.1:9`)면 기사 만들기만 안 되고 나머지는 된다.
- 바깥 페이지 콘솔: `guild`(저장 내용) · `shared`(공용 상태) · `frames[i].win`(기사 i 의 게임 창, `frames[i].win.guildS` = S) · `guildHost.slot('닉', true)` · `renderSlots()`. 회관 Lv 바로 바꾸기: `shared.bld.hall = 10; renderSlots()`.
- 처음부터: 바깥 페이지 콘솔 `localStorage.removeItem('knight-bar-guild')` 후 새로 고침.
- **2단계(서버 기사단)**: 서버를 `GOOGLE_FAKE=1` 로 띄우고(`cd server && PORT=3792 DATA_DIR=<스크래치>/srv GOOGLE_FAKE=1 node index.js`) `index.html?server=http://localhost:3792&guild=1&fakegoogle=1` → 로그인 화면의 "가짜 Google 로그인"에 아무 이름(같은 이름 = 같은 Google 계정). 손님·기기 연결 코드도 같은 화면.
  - 서버 API 점검: `P=3792 node dev/guild-server-test.mjs` (서버를 새로 띄운 직후 — IP 당 한 시간 5개 제한).
  - "다른 기기"는 저장소가 따로인 창이 필요하다: CDP `Target.createBrowserContext` 로 만든 창, 또는 다른 브라우저 프로필. 같은 창의 새 탭은 localStorage 를 같이 써서 같은 기기로 보인다.
  - 기사단 토큰을 지우면 로그인 화면부터: 바깥 페이지 콘솔 `localStorage.removeItem('knight-bar-guild-token')`.
  - 3단계(공용 상태 서버 저장) 브라우저 점검: `node dev/guild-shared-test.mjs` (두 창으로 이어 받기·시계 조작·오프라인). 공용 상태 운영 기록: 서버를 `ADMIN_KEY=<아무 값>` 으로 띄우고 `/api/admin/audit?guild=기사단이름&kind=guild-snap` (헤더 `X-Admin-Key`).
  - 4단계(기사단 효과): `node dev/guild-fx-test.js` (규칙 점검) · `HALL_FIRST=1 node dev/guild-bot.js --days 7 --seeds 5` (기사 1명 vs 5명, 조절값은 파일 머리 주석). 회관 효과 표를 여러 계열로 보려면 바깥 페이지 콘솔에서 `guildHost.roster = () => ({ list: [{ nick, cls, lv }…], rev: 999 })` 후 회관 열기.
  - 숨은 기사의 레이드(대기방 유지·바로 정산·레드닷): `node dev/guild-raid-test.mjs`. 게임 함수는 iframe CSP·`const` 라 바깥에서 못 부르므로 `data-action` 버튼을 잠깐 만들어 눌러서 움직인다.
  - 5단계(기사 이름 바꾸기·삭제·기사단 이름): `node dev/guild-manage-test.mjs`. 서버는 `ACCOUNT_PER_HOUR=50` 으로 띄운다(기사를 여럿 만듦).
  - 점검용 Chrome 은 `--headless=new` 로 띄우는 게 낫다(보이는 창은 사용자 화면에 떠서 닫히거나 연결이 끊긴다). headless 에서도 rAF 가 돈다. 프레임 측정만 보이는 창으로.
  - Electron 중계는 가짜 `bar` 로 본다: 로드 전에 맨 위 창에만 `window.bar = { 호출을 기록하는 함수들 }` 를 넣는다(CDP `Page.addScriptToEvaluateOnNewDocument`, `window === window.top` 일 때만).
- 숨은 창은 rAF 가 멈춘다 → 프레임·진행 확인은 보이는 Chrome(`dev/guild-measure.mjs` 머리 주석의 실행 인자)에서.

## 기사단 시제품 (`dev/guild-spike.html`, [specs/guild.md](specs/guild.md))

- 주소: `http://localhost:<포트>/dev/guild-spike.html?n=3` (n = 기사 수 1~5). 기사마다 `index.html?server=http://127.0.0.1:9&char=기사N` iframe 을 띄운다(오프라인 전용). `&reset=1` 이면 시제품 기사 세이브·공용 재화를 지우고 새로 시작.
- 오른쪽 위 **시험 상태 넣기** (= 콘솔 `preset()`): 기사1 탑 · 기사2 원정 · 기사3 미궁 · 기사4 성벽 · 기사5 원정, 공용 🪙 +100만. 왼쪽 위 슬롯 칩으로 전환.
- 상태 보기: 콘솔 `gS(frames[0])` (그 기사의 S), `frames[0].win.guildDbg` (clock·knight.x·몬스터 수).
- 숨은 브라우저 창은 rAF 가 멈춘다 → 자동 측정은 `&drive=mc` (MessageChannel 로 약 60/s 구동). 프레임 수치는 실제로 보이는 창에서 rAF 로 잰 것만 믿는다.
- 실제 화면 rAF 측정: `dev/guild-measure.mjs` (머리 주석대로 보이는 Chrome 을 디버그 포트로 띄우고 `node dev/guild-measure.mjs 5 shot.png 30`). 앱 Browser 패널이 숨어 있으면 rAF 가 0 이라 못 잰다. 기사 수별 rAF 간격·`guildStep` 합계·GC 뒤 JS 힙을 출력.
