# 직업 스프라이트 시트 — PixelLab 사용 기록

시작 잔량: 1769.0 (상한: 자기 호출 180회, 계정 잔량 1340 아래면 멈춤)

| # | 직업 | 엔드포인트 | 목적 | 사용 | 누적(자기) | 계정 잔량 |
|---|---|---|---|---|---|---|
| 1 | fighter | `/animate-with-text-v3` | idle: standing relaxed idle, breathing slowly, chest rises and fal | 2.0 | 2.0 | 1767.0 |
| 2 | fighter | `/animate-with-text-v3` | walk: side view walk cycle to the right, legs clearly cross and al | 3.0 | 5.0 | 1763.0 |
| 3 | fighter | `/animate-with-text-v3` | charge: side view, crouches low in a wide stance and pulls both fist | 1.0 | 6.0 | 1762.0 |
| 4 | fighter | `/animate-with-text-v3` | death: side view, gets knocked out: staggers backward, knees buckle | 4.0 | 10.0 | 1758.0 |
| 5 | fighter | `/animate-with-text-v3` | hurt: side view, gets hit hard in the face and recoils, head and u | 2.0 | 12.0 | 1756.0 |
| 6 | fighter | `/animate-with-text-v3` | dash: side view, sprints forward to the right very fast, torso lea | 4.0 | 16.0 | 1751.0 |
| 7 | striker | `/animate-with-text-v3` | idle: side view, body keeps facing right, heavyweight boxer with h | 3.0 | 19.0 | 1748.0 |
| 8 | striker | `/animate-with-text-v3` | walk: side view, body keeps facing right, heavyweight boxer with h | 1.0 | 20.0 | 1747.0 |
| 9 | striker | `/animate-with-text-v3` | dash: side view, body keeps facing right, heavyweight boxer with h | 4.0 | 24.0 | 1743.0 |
| 10 | striker | `/animate-with-text-v3` | charge: side view, body keeps facing right, heavyweight boxer with h | 3.0 | 27.0 | 1740.0 |
| 11 | striker | `/animate-with-text-v3` | hurt: side view, body keeps facing right, heavyweight boxer with h | 3.0 | 30.0 | 1735.0 |
| 12 | striker | `/animate-with-text-v3` | death: side view, body keeps facing right, heavyweight boxer with h | 4.0 | 34.0 | 1731.0 |
| 13 | striker | `/animate-with-text-v3` | sit: side view, body keeps facing right, heavyweight boxer with h | 11.0 | 45.0 | 1720.0 |

> 참고: 계정을 이펙트 생성 세션이 동시에 쓰므로 "사용"(호출 전후 잔량 차이)에는 남의 사용분이 섞여 크게 잡힌다(예: #13 의 11). 연속 실측에서 animate 1회 = 약 1 이 확인되어(#3), #14 부터는 명목 비용(animate 1, pixen 1)을 함께 적고 상한 180 은 명목 누적으로 센다. #1~13 명목 = 13. 앱 재시작 때 striker hurt 1회가 결과 저장 전에 끊겼을 수 있다(잔량 1740→1738).

| # | 직업 | 엔드포인트 | 목적 | 사용(실측, 명목) | 누적(실측, 명목) | 계정 잔량 |
|---|---|---|---|---|---|---|
| 14 | striker | `/edit-image-pixen` | k-jab: same boxer in side view facing right, throwing a jab: the fr | 8.0 | 53.0 | 1705.0 |
| 15 | striker | `/edit-image-pixen` | k-straight: same boxer in side view facing right, throwing a long straig | 8.0 | 61.0 | 1696.0 |
| 16 | striker | `/edit-image-pixen` | k-upper: same boxer in side view facing right, throwing an uppercut:  | 7.0 | 68.0 | 1688.0 |
| 17 | striker | `/edit-image-pixen` | k-upper2: same boxer in side view facing right, rising uppercut punch: | 12.0 | 80.0 | 1671.0 |

> 확인(#18): 응답의 `usage` 가 `{'type': 'generations', 'generations': 1.0}` 이다 — pixen 편집 1회 = 1. 잔량 차이(12)는 동시에 돌던 이펙트 세션 몫이다. #19 부터 "명목" 칸은 응답 usage 값이다.

| # | 직업 | 엔드포인트 | 목적 | 사용(실측, 명목) | 누적(실측, 명목) | 계정 잔량 |
|---|---|---|---|---|---|---|
| 18 | kickboxer | `/animate-with-text-v3` | idle: side view, body keeps facing right, lean kickboxer with a lo | 16.0 | 96.0 | 1646.0 |
| 19 | kickboxer | `/animate-with-text-v3` | walk: side view, body keeps facing right, lean kickboxer with a lo | 17.0 | 113.0 | 1628.0 |
| 20 | kickboxer | `/animate-with-text-v3` | dash: side view, body keeps facing right, lean kickboxer with a lo | 10.0 | 123.0 | 1618.0 |
| 21 | kickboxer | `/animate-with-text-v3` | charge: side view, body keeps facing right, lean kickboxer with a lo | 24.0 | 147.0 | 1594.0 |
| 22 | kickboxer | `/animate-with-text-v3` | hurt: side view, body keeps facing right, lean kickboxer with a lo | 19.0 | 166.0 | 1575.0 |
| 23 | kickboxer | `/animate-with-text-v3` | death: side view, body keeps facing right, lean kickboxer with a lo | 24.0 | 190.0 | 1551.0 |
| 24 | kickboxer | `/animate-with-text-v3` | sit: side view, body keeps facing right, lean kickboxer with a lo | 23.0 / 1.0 | 213.0 / 24.0 | 1528.0 |
| 25 | kickboxer | `/edit-image-pixen` | k-front: same kickboxer in side view facing right, front push kick: s | 9.0 / 1.0 | 222.0 / 25.0 | 1516.0 |
| 26 | kickboxer | `/edit-image-pixen` | k-round: same kickboxer in side view facing right, high roundhouse ki | 8.0 / 1.0 | 230.0 / 26.0 | 1508.0 |
| 27 | kickboxer | `/edit-image-pixen` | k-fly: same kickboxer in side view facing right, flying jump kick i | 7.0 / 1.0 | 237.0 / 27.0 | 1501.0 |
| 28 | kickboxer | `/edit-image-pixen` | k-spin: same kickboxer in side view, spinning back kick mid-turn: bo | 13.0 / 1.0 | 250.0 / 28.0 | 1487.0 |
| 29 | qigong | `/animate-with-text-v3` | idle: side view, body keeps facing right, qigong martial artist in | 9.0 / 1.0 | 259.0 / 29.0 | 1474.0 |
| 30 | qigong | `/animate-with-text-v3` | walk: side view, body keeps facing right, qigong martial artist in | 25.0 / 1.0 | 284.0 / 30.0 | 1449.0 |
| 31 | qigong | `/animate-with-text-v3` | dash: side view, body keeps facing right, qigong martial artist in | 27.0 / 1.0 | 311.0 / 31.0 | 1422.0 |
| 32 | qigong | `/animate-with-text-v3` | charge: side view, body keeps facing right, qigong martial artist in | 8.0 / 1.0 | 319.0 / 32.0 | 1414.0 |
| 33 | qigong | `/animate-with-text-v3` | hurt: side view, body keeps facing right, qigong martial artist in | 12.0 / 1.0 | 331.0 / 33.0 | 1401.0 |
| 34 | qigong | `/animate-with-text-v3` | death: side view, body keeps facing right, qigong martial artist in | 16.0 / 1.0 | 347.0 / 34.0 | 1385.0 |
| 35 | qigong | `/animate-with-text-v3` | sit: side view, body keeps facing right, qigong martial artist in | 12.0 / 1.0 | 359.0 / 35.0 | 1373.0 |
| 36 | qigong | `/edit-image-pixen` | k-palm: same martial artist in side view facing right, palm strike:  | 7.0 / 1.0 | 366.0 / 36.0 | 1365.0 |
| 37 | qigong | `/edit-image-pixen` | k-double: same martial artist in side view facing right, double palm p | 3.0 / 1.0 | 369.0 / 37.0 | 1360.0 |
| 38 | qigong | `/edit-image-pixen` | k-barrier: same martial artist in side view facing right, defensive qi  | 7.0 / 1.0 | 376.0 / 38.0 | 1352.0 |
| 39 | qigong | `/edit-image-pixen` | k-sit: same martial artist in side view facing right, sitting cross | 3.0 / 1.0 | 379.0 / 39.0 | 1349.0 |
| 40 | champion | `/animate-with-text-v3` | walk: side view, body keeps facing right, champion boxer with gold | 5.0 / 1.0 | 384.0 / 40.0 | 1340.0 |

## 정리 (2026-10-14, 코디네이터 지시로 중단)

- 자기 호출 40회(응답 `usage` 기준 각 1 = 명목 40) + 앱 재시작 때 끊긴 striker hurt 1회 추정 = **약 41회**. 상한 180회 안.
- 시작 잔량 1,769 → 끝 잔량 1,340 (계정 전체 −429). 차이의 대부분(약 388)은 같은 계정을 동시에 쓴 이펙트 세션 몫이다. 내 호출 하나가 걸리는 1~5분 동안 다른 세션이 생성해서 "호출 전후 잔량 차"가 10~27씩 잡혔다. 응답 본문의 `usage` 는 animate·pixen 모두 매번 1.0 이었다.
- 계정 잔량이 하한 1,340 에 닿아(#40 직후) 멈췄다. tempest·grandmaster walk 는 호출하지 않았다(STOP).
