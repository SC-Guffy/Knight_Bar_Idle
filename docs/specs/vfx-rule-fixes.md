# 스킬 연출 규칙 위반·평타 버그 수정 (0.21 자잘이)

- 상태: 진행 중 — 구현 끝, 배포 전 (2026-10-14, 브랜치 `impl-vfxfix` → `season6`, 사용자 확인 대기)
- 관련 코드:
  - src/skills.js: `dimBand`(:1055), 규칙 주석(:22-24), gale `timeStopFx`(:1532), iaido `bloodMoonFx`(:1588), headshot 조준경(:2161), starfall `nightSkyFx`(:2349)
  - src/jobs/greatswordsman.js(:136, 144, 229, 238), src/jobs/cavalier.js(:221), src/jobs/arbalest.js(:196, 274)
  - src/mage/chainLightning.js(:129, 137), src/mage/thunderstorm.js(:115, 127)
  - src/classes.js `WEAPONS` (voidBow·moonBlades·wyrmSpear·sunBow), src/motion/legacy.js(:239-245), src/world.js `drawAtkFx`(:2072)·`drawShots`(:2704)·결투(:3169)·레이드(:4209)
- 출처: [skill-vfx.md](skill-vfx.md) 전수조사에서 나온 항목 중 PixelLab 과 상관없는 작은 수정. 사용자가 0.21 로 옮기기로 했다 (2026-10-13).
- 확인 방법: 검토 페이지 `dev/review/vfx-rule-fixes.html` (전후 캡처·밝기 표·▶ 재생 링크). 밝기 다시 재기: `dev/skills.html?patch=vfx-edge-probe` → 콘솔 `probeAll()`.
- 최종 갱신: 2026-10-14

## 목표

게임은 바탕화면 위 하단바에 떠 있다. 그래서 궁극기 말고는 하단바 전체를 번쩍이거나 어둡게 하지 않는다는 규칙이 있다(`skills.js:22-24`). 그런데 2차 스킬 ★★★ 11곳이 이 규칙을 어기고 하단바 전체를 덮는다. 이것을 타격 지점 둘레로 줄인다.
같이, 평타에서 보이는 작은 버그 3건을 고친다. 규칙·수치는 바뀌지 않는다 (연출만).

## 규칙

### 1. 하단바 전체 섬광·어둡게 하기 → 국소 연출로 (11곳)

| 스킬 | 위치 | 지금 | 바꾼 뒤 |
|---|---|---|---|
| 질풍난무 ★★★ (gale) | skills.js:1532 `timeStopFx` | 하단바 전체 붉은 어둠 α0.62 | 시전자~대상 구간 ±60px 안만 어둡게, 가장자리 24px 는 서서히 0 |
| 일섬 ★★★ (iaido) | skills.js:1588 `bloodMoonFx` | 하단바 전체 어둠 α0.55 | 달 둘레 반경 110px 원형 어둠 (가장자리 서서히) |
| 헤드샷 ★★★ (headshot) | skills.js:2161 조준경 | 하단바 전체 청회색 α0.5 | 조준경 바깥 반경 120px 까지만 어둡게 (조준경 비네트) |
| 별빛 화살비 ★★★ (starfall) | skills.js:2349 `nightSkyFx` | 하단바 전체 밤하늘 | 대상 x ±120px 구간에만 밤하늘, 좌우 32px 는 서서히 0 |
| 대검 횡참 ★★★ (wideCleave) | greatswordsman.js:136, 144 | 전체 어둠 α0.28 + 흰 섬광 α0.5 | 어둠은 시전자~대상 구간만, 섬광은 낙하 지점 반경 90px |
| 돌진 격돌 ★★★ (ramCharge) | greatswordsman.js:229, 238 | 전체 어둠 α0.25 + 흰 섬광 α0.6 | 같음 (내려찍는 지점 반경 90px) |
| 기병 돌격 ★★★ (cavalryCharge) | cavalier.js:221 | 전체 청색 섬광 α0.45 | 충격파 지점 반경 90px |
| 폭열탄 ★★★ (blastBolt) | arbalest.js:196 | 전체 흰 섬광 α0.7 | 착탄 지점 반경 100px |
| 다연장 사격 ★★★ (boltStorm) | arbalest.js:274 | 전체 흰 섬광 α0.4 | 마지막 살 착탄 지점 반경 80px |
| 연쇄 번개 ★★★ (chainLightning) | chainLightning.js:129, 137 | 전체 어둠 α0.38 + 흰 섬광 α0.75 | 어둠은 손~대상 구간, 섬광은 움켜쥐는 지점 반경 100px |
| 낙뢰 ★★★ (thunderstorm) | thunderstorm.js:115, 127 | 전체 어둠 α0.45 + 흰 섬광 α0.85 | 어둠은 구름 아래 구간, 섬광은 기둥 번개 지점 반경 100px |

- 공용 도구 두 개를 `skills.js` 에 새로 둔다 (`dimBand` 옆):
  - `localFlash(x, y, r, alpha, rgb)`: 원형 radial 섬광. 바깥 30% 는 0 으로 서서히 줄어든다.
  - `dimSpan(x0, x1, alpha, rgb, feather = 24)`: 가로 구간 [x0, x1] 만 하단바 높이로 덮는다. 좌우 feather px 는 서서히 0.
- 알파 최댓값·지속 시간은 지금 값을 그대로 쓴다. 범위만 줄인다.
- 이 두 도구는 **임시**다. [CLAUDE.md](../../CLAUDE.md) 지침상 섬광 그림은 PixelLab 텍스처로 그린다. 0.21 은 범위를 줄이는 규칙 위반 수정만 하고, 섬광 그림은 VFX 퀄업([skill-vfx.md](skill-vfx.md) ⑤)의 성광·폭발 시트가 생기면 그것으로 바꾼다. `dimSpan` 의 어둡게 하기는 그림이 아니라 화면 덮개라 그대로 남긴다.
- 헤드샷은 조준경 원 바깥 고리만 어둡게 하는 `scopeVignette(x, y, r, R, alpha, rgb)` 를 `scopeFx` 옆에 따로 둔다 (조준경 안은 밝게 남는다). 별빛 화살비는 밤하늘 그림(그라데이션·별·오로라) 자체를 대상 ±120px 로 줄였다 (4px 세로 띠마다 가장자리 알파).
- 결투·레이드에서도 같은 함수를 쓴다 (`dimBand` 를 쓰는 곳만 바꾸므로 따로 손댈 것 없음).
- 궁극기(src/ult/*.js)의 `dimBand` 는 규칙상 허용이라 이번에 건드리지 않는다.

### 2. 평타 버그 3건

1. **공허궁 꼬리 색**: `WEAPONS.voidBow.arrow` 에 `rgb` 가 없어서 마력탄 꼬리가 기본값 청록(`world.js:2729`)으로 나온다 → `rgb: '255,138,255'` (탄 색 `#ff8aff` 와 같은 값)를 넣는다.
2. **3차 타격 섬광 색 상속**: 3차 무기는 2차 무기의 연속기 배열을 그대로 쓴다(`legacy.js:239-245`). 그래서 모션에 박힌 `burst` 섬광 색이 2차 색으로 나와 잔상 색과 어긋난다.
   - `WEAPONS` 에 선택 필드 `burstRgb` 를 두고, `drawAtkFx`(`world.js:2083`)가 섬광 색을 `w.burstRgb || mo.burst[1]` 로 고른다. 크기·시점은 그대로.
   - 값: 월광쌍검 `'255,90,130'` (잔상과 같은 분홍), 용황창 `'255,120,220'`, 태양궁 `'255,230,120'`.
3. **결투·레이드 원거리 평타**: 무기와 상관없이 `arrow.color` 12×2 막대로만 그린다(`world.js:3169`, `:4209`).
   - `drawShots`(`world.js:2704`)에서 투사체 한 발을 그리는 부분을 `drawProjectile(sh)` 로 떼어 내고, 원정·결투·레이드가 같은 함수를 쓴다. 꼬리(trail)·번개 출발점(ox, oy)이 필요해서 인자는 원정의 shot 모양 `{ w, x, y, a, trail, ox, oy }` 이다. 결투·레이드는 `flightShot(w, x0, x, y, dir)` 로 이 모양을 만든다 (꼬리 = 최근 8자리, 6px 간격). 번개(bolt)·얼음(ice)·마력탄(magic)·화살·쇠뇌 살이 결투·레이드에서도 같은 모양으로 보인다.
   - 날아가는 시간(0.14초)과 판정은 그대로다. 그리기만 바꾼다.

## UI

화면 요소가 새로 생기지 않는다. 바뀐 11개 스킬은 섬광·어둠이 타격 지점 둘레에만 생기고, 하단바 양 끝(바탕화면과 맞닿은 곳)은 그대로 보인다.

## 수용 기준
- [x] 11개 스킬 ★★★ 시전 동안 하단바 양 끝 40px 의 평균 밝기 변화가 시전 전 대비 ±0.05 이하다 — `dev/skills.html?cls=<직업>&skill=<id>&stage=3` 에서 [skill-vfx.md](skill-vfx.md) "캡처 재현" 방식으로 프레임마다 양 끝 40px 밝기를 기록 (궁극기 12종은 검사 대상 아님).
  - 결과: 11곳 최대 0.023 (고치기 전 0.18~0.37). 궁극기 제외 28종 모두 0.031 이하 (`dev/review/vfx-rule-fixes/edge-probe.json`, 무대 폭 549 게임 px).
- [x] 11개 스킬의 전후 b·c 장면 캡처가 있다 (`dev/vfx-survey/<id>-b-after.png`). 검토 페이지 `dev/review/vfx-rule-fixes.html` 에 전후가 나란히 보인다 (b = 고치기 전 가장 많이 덮이던 프레임, c = 그 0.4초 뒤. 전후 같은 프레임. `-before` 도 같이 넣었다).
- [x] 공허궁 평타 꼬리가 자홍색이다 — `dev/skills.html?mode=basic&cls=voidArcher` 캡처 (`dev/review/vfx-rule-fixes/basic-voidArcher-{before,after}.png`).
- [x] 검신·용황·신궁 평타의 타격 섬광 색이 잔상 색과 같다 — 같은 방식으로 세 직업 평타 캡처 (섬광이 작아 `snapBurst` 로 섬광 둘레를 4배 확대: `vfx-rule-fixes/burst-*.png`).
- [x] 결투·레이드에서 원거리 직업 평타가 원정과 같은 모양(번개·얼음·마력탄·화살·살)이다 — 결투 화면에서 뇌전술사·빙결술사·마궁수·저격수·석궁사수를 상대로 캡처 (`simulateDuel` 결과를 평타만 남겨 `vfx-rule-fixes/duel-sample.json` 으로 재생, `snapDuel`). 레이드는 같은 함수를 쓰고 화면 캡처는 하지 않았다.
- [x] 스킬 40종 전체 점검 루프(`dev-testing.md` 스킬 시뮬레이터)에서 예외가 없다. — 40종 × 숙련 4단계 160회, 예외 0건.

## 진행 기록
- 2026-10-13: [skill-vfx.md](skill-vfx.md) 전수조사에서 나온 하단바 섬광 규칙 위반 11곳과 평타 버그 3건을, 사용자 결정으로 VFX 퀄업(⑤-0)에서 떼어 0.21 자잘이로 옮겼다. 스펙만 썼고 구현은 아직이다.
- 2026-10-14: 구현 (worktree `impl-vfxfix`, 포트 8833). 11곳을 `localFlash`·`dimSpan`·`scopeVignette` 로 바꾸고 별빛 화살비 밤하늘을 대상 둘레로 줄였다. 평타 버그 3건 수정 (`voidBow.arrow.rgb`, `burstRgb` 3종, `drawProjectile`·`flightShot`). 측정·캡처 도구 `dev/review/vfx-edge-probe.js` (`?patch=vfx-edge-probe`: `probe`·`probeAll`·`snapAt`·`snapBasic`·`snapBurst`·`snapDuel`) 와 검토 페이지 `dev/review/vfx-rule-fixes.html` 를 만들었다. "전" 캡처는 origin/season6 를 따로 띄워 같은 도구로 찍었다. 수용 기준 6개 모두 확인.

## 남은 일 / 미정
- 사용자 확인 → 0.21 배포 때 상태 '완료'. ([skill-vfx.md](skill-vfx.md) 4번·버그 절에는 '구현 끝, 배포 전'으로 표시해 두었다.)
- `localFlash` 는 매끈한 radial gradient 원이라 VFX 퀄업(⑤)에서 스킬별 K 명중 시트로 바꾼다 (코드 주석에 자리 표시). `dimSpan`·`scopeVignette` 는 덮개라 남긴다.
- 3차 근접 평타 섬광은 무기 끝에 아주 작게(반경 6~20px) 나와 눈에 잘 띄지 않는다 — 색만 고쳤고 크기는 스펙 범위 밖. 평타 타격감은 ⑤ 의 H 시트에서 다룬다.
- 검토 중 본 기존 문제(이번 범위 밖): `dev/skills.html` 이 배경 그림을 `dev/src/bg/*.png` 로 찾아 404 가 난다.
