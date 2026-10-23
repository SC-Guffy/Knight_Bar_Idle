# 기사단 재료의 미궁 입장권 공용화

- 상태: 완료 (0.30.7, 사용자 확인 10-23) — 안 1 · 보너스 없음
- 관련 코드: src/dungeon.js (`dgFreeTickets`·`useDgTicket`·`dgTicketsBoughtToday`·`buyDgTicket`·`freshDungeon`), src/guild.js (`freshShared`·`bindShared`), server/index.js (`sanitizeShared`), dev/guild-bot.js
- 관련 스펙: [balance-audit-1023.md](balance-audit-1023.md) 항목 A, [guild.md](guild.md) (공용 범위 안 A), [guild-price-base.md](guild-price-base.md), [dungeon-slot-roles.md](dungeon-slot-roles.md)
- 최종 갱신: 2026-10-23

## 문제

재료의 미궁 🪵 목재·🪨 철광석 보상은 **공용 마을 건물 비용**을 기준으로 정해진다(`dgUnitValue` → `dgNextBuildCost`). 그래서 어느 기사가 돌든 양이 같다. 그런데 입장권은 기사마다 따로다.
- 무료 3장·구매 횟수(가격 단계)가 기사별이다.
- 난이도는 그 기사 전투력에 맞춰지므로 누구나 보스 7~8마리를 잡는다.

결과(점검 봇 7일, 기사 5명):

| 누가 미궁을 도나 | 판 수 | 미궁 목재 | 회관 Lv14 |
|---|---|---|---|
| 본캐만 | 21 | 1.64e5 | 5.0일 |
| 전원 | 87 | **8.9e5 (5.4배)** | 3.2일 |

- 기사는 10명까지 두고 캠프에서 슬롯을 갈아 끼울 수 있어서 하루 최대 30판(혼자 3판)이다.
- 새 기사는 0.5시간이면 스테이지 15(미궁 열림)에 닿는다. 만들고 지우기를 반복하면 무료 3판이 계속 생긴다(추정).
- guild.md 의 공용 경제 전제("목재·철광석은 기사 수만큼 늘지 않는다")가 깨진다.

## 목표

- 기사단이 미궁에서 얻는 🪵🪨 이 기사 수에 비례해 늘지 않는다. 혼자 하는 사람과 같은 양.
- 기사를 새로 만들거나 지워서 미궁 판 수가 늘지 않는다.

## 규칙 — 안 1 (확정): 미궁 입장권을 기사단 공용으로

1. 기사단 모드면 미궁 입장권 기록 5개를 공용 상태 `shared.dg` 에 둔다: `tixDay`·`tixUsed`(오늘 쓴 무료) · `tixExtra`(산 입장권) · `buyDay`·`bought`(오늘 산 장수).
   - 기사의 `S.dg` 에 getter 로 묶는다(골드·마을처럼, 기사 세이브엔 안 들어감). 최고 기록·퍼펙트·진행 중인 판(`best`·`perfects`·`run`·`last`)은 기사별 그대로.
2. 무료 입장권은 기사단 전체에 **하루 3장**(`DG_TICKETS`, 혼자와 같음). 어느 기사든 쓴다.
3. 구매 가격 단계(0.5→1→2→3.5→6→×1.7)도 기사단 전체에 하나. 가격 기준은 이미 `priceBest()`(기사단 최고 스테이지).
4. 이행: 기사 세이브에 남아 있던 산 입장권(`tixExtra`)은 처음 기사단에 붙을 때 공용으로 더한다. 기사 세이브의 `S.dg.tixMoved = 1` 로 한 번만. 오늘 쓴 무료 수는 옮기지 않는다(공용은 0에서 시작 → 업데이트 날 하루만 최대 3판 더).
5. 기사단을 안 쓰면 지금과 같다.

### 안 2 (안 고름): 입장권은 기사별 그대로, 🪵🪨 만 기사단 하루 3판분

- 기사단에서 오늘 4판째부터는 슬롯의 🪵🪨 칸이 💰 골드 칸으로 바뀐다(📖 은 그대로).
- 부캐도 미궁을 즐길 수 있다. 다만 바뀐 💰 은 쓸 곳이 거의 없어서(점검 C — 골드 잉여) 부캐 미궁은 사실상 📖 만 남는다. 슬롯 그림·확률 표시도 고쳐야 해서 할 일이 많다.

## UI

- 미궁 입장권 표시(`n/3`)와 구매 버튼은 지금 그대로. 값만 기사단 공용을 보여 준다.
- 기사단 모드일 때 도전 탭 미궁 카드 입장권 줄 끝에 "(기사단 공용)".

## 수용 기준

- [x] 기사단: 본캐가 미궁 3판(실제 `dg-start`→`dg-retreat`)을 돌면 부캐 화면도 무료 0/3. 부캐가 1장 사면 본캐도 오늘 산 장수 1 → 두 화면 다음 가격 같음(16.4T) — 게임 화면(기사 2명, 로컬 서버)
- [x] 부캐가 산 입장권을 본캐가 본다(`tixExtra` 1)
- [x] 새 기사를 만들어도 무료 입장권이 다시 생기지 않는다 (node 시험: 새 기사 `dgFreeTickets()` = 0)
- [x] 이행: 산 입장권 2장 가진 옛 세이브 → 공용 +2, 저장한 세이브엔 `tixExtra` 없음, 다시 불러와도 2 그대로 (node 시험)
- [x] 서버가 공용 상태 `dg` 를 저장·돌려주고 모르는 키는 버린다 (`dev/guild-server-test.mjs` 전부 통과)
- [x] 기사단 끔: 코드 경로가 그대로(바인딩은 `GUILD_HOST` 일 때만)
- [x] 점검 봇 7일·3시드(`TRADE_MAIN_ONLY=1 HALL_FIRST=1`): `DG=all` 미궁 21판·목재 7.8e4 = `DG=main` 21판·6.4e4 수준 (바꾸기 전 `DG=all` 87판·8.9e5)

## 확인 방법

1. `preview_start price-server`(3794) · `preview_start price-review`(9077) → http://localhost:9077/index.html?server=http://localhost:3794&guild=1&fakegoogle=1 → 가짜 Google 로그인 → 기사단·기사 2명(회관 "새 기사").
2. 바깥 페이지 콘솔에서 `shared.dg` 를 보며, 기사 1 캠프 → 도전 → 미궁을 3번 들어갔다 나오면 기사 2 미궁 카드도 `0/3 (기사단 공용)`.
3. node 시험(이행·새 기사): 스크래치 `ab/dgshare.js` 를 `dev/audit-1023/guild/dgshare.js` 로 옮겨 둠 — `node dev/audit-1023/guild/dgshare.js`.

## 진행 기록

- 2026-10-23: 사용자 확정(안 1, 보너스 없음) → 구현 0.30.7. `guild.js` `freshShared.dg`·`bindShared`(S.dg 5개 getter + `tixMoved` 이행), `server/index.js` `sanitizeShared.dg`, 미궁 카드 "(기사단 공용)", guild-bot·점검 봇도 같은 바인딩.
- 2026-10-23: 총점검 항목 A 로 스펙 작성. 안 1 추천.

## 남은 일 / 미정

- 없음.
