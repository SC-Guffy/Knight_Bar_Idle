# 최소 앱 버전 (민클라)

상태: 구현·배포 (2026-10-20, 게임 0.27.10 · 최소 앱 0.5.1 → 0.27.11 에서 0.5.2) — 사용자 확인 대기

## 목표
지금 버전이 아닌 클라이언트는 플레이할 수 없게 막고, 데스크탑 앱 예전 설치본은 새 설치 파일 받는 곳으로 보낸다.

## 규칙
- **앱 설치본**: Electron 기본 User-Agent 의 `KnightBar/<앱 버전>` 으로 판별. `APP_MIN_VERSION`(0.5.2) 미만, 또는 Electron 인데 버전을 못 읽으면 예전 것으로 본다.
  - 웹 (`src/app-gate.js`, `index.html`·`guild.html` `<head>` 맨 앞): 막히면 `window.stop()` 으로 게임 스크립트를 아예 안 불러오고(부팅·저장 없음) 전체 화면 안내를 띄운다. 창은 `setWindow('app-gate', full·mouse all·focus)` (v2 없는 예전 앱은 `setOverlay`+`setCampMode`).
    안내: OS 에 맞는 설치 파일 직접 받기(releases/latest/download/…), 다운로드 페이지(releases/latest) 열기, 앱 끄기.
  - 서버 (`server/index.js` `APP_MIN_VERSION`, `appOutdated`): `/api/admin/` 을 뺀 모든 API 가 426 `code: app-outdated`. 웹을 못 불러와 앱 안 낡은 파일로 열린 경우도 서버에서 막히고, 그 426 으로 다시 불러오면 웹 → 안내 화면.
  - 새 웹 코드의 `net.js` 는 426 `app-outdated` 를 받으면 새로 고치지 않고 안내 화면을 띄운다.
- **게임 코드(웹)**: `SAVE_MIN_VERSION`·`RAID_MIN_VERSION` 을 지금 `GAME_VERSION`(0.27.10)으로. 예전 탭은 426 → 저장 후 새로 고침(기존 동작).
- 다음에 다시 막을 때: 앱은 `src/app-gate.js` 와 `server/index.js` 의 `APP_MIN_VERSION` 을 같이 올리고, 웹은 `SAVE_MIN_VERSION`(+필요하면 `RAID_MIN_VERSION`)을 올린다.

## 수용 기준
- [x] `?fakeapp=0.5.0`(로컬) → 게임 스크립트 1개만 불러오고(`S` 없음) 안내 화면
- [x] `?fakeapp=0.5.1` → 평소대로 부팅, 안내 없음
- [x] `guild.html?fakeapp=0.4.0` → 기사 iframe 0개, 안내 화면
- [x] 서버: UA `KnightBar/0.5.0`·버전 없는 Electron → 426 app-outdated, `KnightBar/0.5.1`·일반 브라우저 → 200
- [ ] 실제 예전 앱(0.5.0)에서 안내 화면이 클릭되고 설치 파일 저장 창이 뜨는지 (앱 실행 금지라 사용자 확인 필요)

- [x] 0.27.11: 최소 앱 0.5.2 (Google 로그인 팝업이 게임 창 뒤에 깔리던 문제 수정본) — `?fakeapp=0.5.1` → 안내 화면, `?fakeapp=0.5.2` → 평소대로

## 확인 방법
`preview_start gate-web` → http://localhost:9053/index.html?fakeapp=0.5.0 (기사단은 `guild.html?fakeapp=0.4.0`). `fakeapp` 은 로컬 개발 주소에서만 먹는다.

## 남은 일 / 주의
- **최소 앱을 올릴 때는 그 버전 설치 파일을 Releases(latest)에 먼저 올린 뒤 푸시한다.** 안내 화면의 받기 버튼이 releases/latest 를 가리켜서, 순서가 바뀌면 예전 설치 파일을 다시 받아 계속 막힌다.
- 앱에 `setWindowOpenHandler` 가 없어 "다운로드 페이지 열기"는 앱 안 새 창으로 열린다(시스템 브라우저 아님). 설치 파일 버튼은 같은 창에서 내려받기라 Electron 기본 저장 창이 뜬다.
