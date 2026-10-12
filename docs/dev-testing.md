# 로컬 테스트 방법

Claude Code 내장 브라우저(browser pane) 기준이다. 경로는 저장소 루트(`Knight_Bar_Idle/`) 기준.

## 웹 게임 띄우기 (오프라인)

- 정적 서버: `.claude/launch.json` 의 `knight-bar-web-2` (저장소 루트를 8766에서 제공) 를 `preview_start` 로 띄운다. 상위 폴더 `knight_bar/.claude/launch.json` 에도 `knight-bar-web` (8765) 이 있다.
  - "Port … is in use by another chat's dev server" 라고 거부되면, 그 서버가 같은 파일을 제공하므로 `preview_start { url: 'http://localhost:<포트>/index.html?server=http://127.0.0.1:9' }` 로 연다.
  - 등록은 남아 있는데 실제로는 응답이 없으면 Bash에서 직접 띄운다: `python -m http.server 8766 &` (저장소 루트에서). 끝나면 netstat/taskkill로 정리한다.
- 주소: `index.html?server=http://127.0.0.1:9` (닿지 않는 서버 → 오프라인 모드). **진짜 서버에 가짜 토큰을 쓰지 말 것**: `gone` 응답이 오고 로컬 계정 목록이 지워진다.
- 첫 로드 전에 localStorage `knight-bar-accounts` = `{"active":"테스트","list":{"테스트":"local-test-token"}}` 를 넣어 닉네임 창을 건너뛴다. 로드 후 약 8초 기다렸다가(enterAccount 서버 호출이 끝나도록) 상태를 만진다.
- **캐시 주의**: `src/*.js` 를 고친 뒤 그냥 새로고침하면 옛 스크립트가 나온다. `await fetch('src/ui.js', {cache:'reload'})` (core.js 등 고친 파일 모두) → `location.reload()` 하고, 새로 추가한 심볼(`typeof 새함수`)로 새 코드인지 확인한다.
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

### 컷 스크린샷 저장

- `window.cutStrip(직업 id, 동작 번호)`, `window.cutShot(이름, 항목, {cols, scale, cw, ch})`.
- cutShot 은 `127.0.0.1:8798/save?name=` 으로 PNG를 보낸다. 받는 쪽은 `python -I dev/shot-recv.py dev/shots` (세션마다 다시 띄운다). 결과는 `dev/shots/<이름>.png` (git 제외).

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
