# 스킬 VFX 퀄업 — 전 직업 전수조사 (시즌6)

- 상태: 초안 (조사표만 만듦, 조사 전)
- 관련 코드:
  - src/skills.js: 공용 연출과 1·2차 스킬 대부분. `skFx`, `impact`
  - src/mage/*.js: 마법사 계열 스킬
  - src/jobs/*.js: 대검전사·랜서·석궁사수 스킬
  - src/ult/*.js: 3차 궁극기
  - src/cuts/*.js, src/motion/*.js: 평타 컷
  - src/classes.js: `WEAPONS` (투사체·궤적 색), `SKILLS`
- 도구: `dev/skills.html` 스킬 시뮬레이터, `cutShot` 컷 스크린샷 ([dev-testing.md](../dev-testing.md)), PixelLab
- 최종 갱신: 2026-10-13

## 목표

전 직업의 스킬과 평타 이펙트를 하나도 빼지 않고 살펴본다. 약한 것부터 PixelLab 기반 도트 VFX로 퀄업한다.
기준은 [art-upgrade.md](art-upgrade.md)의 "AI 티 안 나는, 저해상도지만 고퀄 도트"다.
스킬 하나만 봐도 직업이 떠오르게 한다. 같은 계열 2차 직업끼리도 이펙트 색만 다른 "색깔놀이"는 금지다. 모양·궤적·타격감이 달라야 한다.

## 조사 방법

1. `dev/skills.html` 에서 스킬마다 시전 → 시작·타격·끝 세 장면을 캡처한다 (`dev/vfx-survey/<id>-{a,b,c}.png`).
2. 아래 표에 지금 연출을 한 줄로 적고, 점수와 판정을 매긴다.
   - 점수: 1 = 밋밋하다 / 2 = 괜찮다 / 3 = 이미 좋다.
   - 판정: **교체**(PixelLab 시트로 새로 만듦) / **보강**(기존 코드에 타격·잔상·파편 추가) / **유지**.
   - 메모: 문제점. 예) 타격감 없음, 색만 다름, 화면 흔들림 과함, 투사체가 작음.
3. 점수가 낮은 것부터, 계열 단위로 묶어 패치한다 (로드맵 ⑤).
4. 권투가 7종의 스킬은 처음부터 새 기준으로 만든다. 그래서 이 표에는 넣지 않고 권투가 스펙에서 따로 다룬다.

## 조사표 — 스킬 40종

| 차수 | 직업 | 스킬 (id) | 코드 | 지금 연출 | 점수 | 판정 | 메모 |
|---|---|---|---|---|---|---|---|
| 1차 | 검사 | 강철 베기 (steelCleave) | skills.js | | | | |
| 1차 | 창기사 | 관통 찌르기 (piercingThrust) | skills.js | | | | |
| 1차 | 레인저 | 연사 (rapidFire) | skills.js | | | | |
| 1차 | 마법사 | 마력 폭발 (manaBurst) | mage/manaBurst.js | | | | |
| 2차 | 성기사 | 심판의 일격 (judgment) | skills.js | | | | |
| 2차 | 성기사 | 성역 (sanctuary) | skills.js | | | | |
| 2차 | 검성 | 질풍난무 (gale) | skills.js | | | | |
| 2차 | 검성 | 일섬 (iaido) | skills.js | | | | |
| 2차 | 대검전사 | 대검 횡참 (wideCleave) | jobs/greatswordsman.js | | | | |
| 2차 | 대검전사 | 돌진 격돌 (ramCharge) | jobs/greatswordsman.js | | | | |
| 2차 | 용기병 | 용추락 (dragonFall) | skills.js | | | | |
| 2차 | 용기병 | 용의 숨결 (dragonBreath) | skills.js | | | | |
| 2차 | 할버디어 | 대회전 (whirlwind) | skills.js | | | | |
| 2차 | 할버디어 | 대지 가르기 (earthSplitter) | skills.js | | | | |
| 2차 | 랜서 | 기병 돌격 (cavalryCharge) | jobs/cavalier.js | | | | |
| 2차 | 랜서 | 방패 벽 (shieldWall) | jobs/cavalier.js | | | | |
| 2차 | 저격수 | 헤드샷 (headshot) | skills.js | | | | |
| 2차 | 저격수 | 철갑 관통탄 (armorPiercer) | skills.js | | | | |
| 2차 | 마궁수 | 유도 마탄 (homingBolts) | skills.js | | | | |
| 2차 | 마궁수 | 별빛 화살비 (starfall) | skills.js | | | | |
| 2차 | 석궁사수 | 폭열탄 (blastBolt) | jobs/arbalest.js | | | | |
| 2차 | 석궁사수 | 다연장 사격 (boltStorm) | jobs/arbalest.js | | | | |
| 2차 | 화염술사 | 메테오 (meteor) | mage/meteor.js | | | | |
| 2차 | 화염술사 | 화염 회오리 (flameVortex) | mage/flameVortex.js | | | | |
| 2차 | 빙결술사 | 얼음창 (iceLance) | mage/iceLance.js | | | | |
| 2차 | 빙결술사 | 블리자드 (blizzard) | mage/blizzard.js | | | | |
| 2차 | 뇌전술사 | 연쇄 번개 (chainLightning) | mage/chainLightning.js | | | | |
| 2차 | 뇌전술사 | 낙뢰 (thunderstorm) | mage/thunderstorm.js | | | | |
| 궁극기 | 성좌기사 | 성좌 강림 (starJudgment) | ult/starJudgment.js | | | | |
| 궁극기 | 검신 | 천검 (thousandCuts) | ult/thousandCuts.js | | | | |
| 궁극기 | 파천검왕 | 파천참 (skyBreak) | ult/skyBreak.js | | | | |
| 궁극기 | 용황 | 용황 강림 (dragonEmperor) | ult/dragonEmperor.js | | | | |
| 궁극기 | 전쟁군주 | 천붕 (worldBreaker) | ult/worldBreaker.js | | | | |
| 궁극기 | 천마장군 | 천마군단 (cavalryLegion) | ult/cavalryLegion.js | | | | |
| 궁극기 | 신궁 | 태양 관통 (sunArrow) | ult/sunArrow.js | | | | |
| 궁극기 | 차원궁사 | 차원 붕괴 (dimensionCollapse) | ult/dimensionCollapse.js | | | | |
| 궁극기 | 공성포수 | 대공성포 (siegeBarrage) | ult/siegeBarrage.js | | | | |
| 궁극기 | 대마도사 | 종언의 겁화 (apocalypse) | ult/apocalypse.js | | | | |
| 궁극기 | 빙결의 군주 | 절대영도 (absoluteZero) | ult/absoluteZero.js | | | | |
| 궁극기 | 뇌제 | 뇌제 강림 (thunderJudgment) | ult/thunderJudgment.js | | | | |

## 조사표 — 평타·투사체 (직업 29종)

평타 컷(`cuts/`·`motion/`)과 투사체·궤적(`WEAPONS` 의 `trail`·`arrow`·`splash`·`glow`)을 직업마다 본다.

| 차수 | 직업 | 무기 | 지금 연출 | 점수 | 판정 | 메모 |
|---|---|---|---|---|---|---|
| 견습 | 견습 기사 | 장검 | | | | |
| 1차 | 검사 | 기사검 | | | | |
| 1차 | 창기사 | 창 | | | | |
| 1차 | 레인저 | 단궁 | | | | |
| 1차 | 마법사 | 견습 지팡이 | | | | |
| 2차 | 성기사 | 성검 | | | | |
| 2차 | 검성 | 쌍검 | | | | |
| 2차 | 대검전사 | 대검 | | | | |
| 2차 | 용기병 | 용창 | | | | |
| 2차 | 할버디어 | 할버드 | | | | |
| 2차 | 랜서 | 돌격창 | | | | |
| 2차 | 저격수 | 장궁 | | | | |
| 2차 | 마궁수 | 마력궁 | | | | |
| 2차 | 석궁사수 | 거대 석궁 | | | | |
| 2차 | 화염술사 | 화염 지팡이 | | | | |
| 2차 | 빙결술사 | 서리 지팡이 | | | | |
| 2차 | 뇌전술사 | 뇌전 지팡이 | | | | |
| 3차 | 성좌기사 | 성좌검 | | | | |
| 3차 | 검신 | 월광쌍검 | | | | |
| 3차 | 파천검왕 | 파천대검 | | | | |
| 3차 | 용황 | 용황창 | | | | |
| 3차 | 전쟁군주 | 종말의 도끼창 | | | | |
| 3차 | 천마장군 | 천마창 | | | | |
| 3차 | 신궁 | 태양궁 | | | | |
| 3차 | 차원궁사 | 공허궁 | | | | |
| 3차 | 공성포수 | 공성 석궁 | | | | |
| 3차 | 대마도사 | 겁화의 지팡이 | | | | |
| 3차 | 빙결의 군주 | 빙하의 홀 | | | | |
| 3차 | 뇌제 | 뇌제의 홀 | | | | |

## 공통 개선 후보 (조사하면서 채운다)
- 타격 프레임 정지(`impact` 의 `stop`)와 화면 흔들림 기준을 차수별로 통일할지.
- 피격 파편·잔상을 공용 PixelLab 시트(베기·찌르기·폭발·번개·얼음·빛) 몇 장으로 묶어 재사용할지.
- 숙련도에 따른 이펙트 단계(`MASTERY_VIS`)를 퀄업 뒤에도 유지할지.

## 수용 기준
- [ ] 스킬 40종 + 평타 29종 전부 캡처·점수·판정이 채워졌다 (`dev/vfx-survey/`).
- [ ] 판정이 "교체·보강"인 항목은 바꾼 뒤 전후 비교 캡처가 있다.
- [ ] 같은 1차 계열의 2차 직업끼리 스킬을 나란히 놓았을 때, 색을 빼고 봐도 구분된다.
- [ ] 퀄업 뒤 레이드 4인 전투에서 프레임이 눈에 띄게 떨어지지 않는다 (퀄업 전후 fps 비교).

## 진행 기록
- 2026-10-13: 사용자 결정 "전 직업 전수조사". 스킬 40종·평타 29종 조사표를 만들었다 (코드 위치 매핑까지). 조사는 아직 하지 않았다.

## 남은 일 / 미정
- 조사표 채우기 (로드맵 ⑤, 권투가 PixelLab 파이프라인이 잡힌 뒤 본격 진행).
