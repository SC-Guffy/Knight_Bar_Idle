# 스킬 카드 아이콘 (32×32 PixelLab, 차수별 테두리)

- 상태: **배포됨 0.29.3** (2026-10-21 사용자 지시로 확인 전 배포 — 일어나서 확인) (2026-10-21 사용자: "스킬카드 아이콘 해야지" — 110개 전부, PixelLab 상한 150, 차수별 테두리)
- 상위: [skill-redesign.md](skill-redesign.md) · [skill-mastery-s7.md](skill-mastery-s7.md) (스킬 카드) · 앞 작업 [rune-icons.md](rune-icons.md)
- 관련 코드: `dev/skill-icons/` (`prompts.py` 장면 · `gen.py` 생성 · `frame.py` 테두리 · `build.py` 시트, `picks.json` 고른 원본, `raw/`) → `src/skin/skill-icons.png` (32×32, 16열) + `src/skin/skill-icons.css` (생성물, `.ski-<ic>` 칸 위치) · index.html (css 연결) · src/tree7-ui.js `t7SkIcon` (카드·장착 칸 4곳)
- 검토 페이지: `dev/review/skill-icons.html`
- 최종 갱신: 2026-10-21

## 목표
스킬 탭 카드·장착 칸의 아이콘이 12×12 손도트를 28px 로 키운 것이라, 새로 단 32×32 룬석 옆에서 작고 밋밋하다.
카드에 나오는 스킬 110개(1차 공용 5 + 15줄기 × 2차 2 · 새 스킬 4 · 궁극기 1)에 **기술 장면이 보이는 32×32 배지**를 단다.

## 규칙
- 그림: PixelLab `create-image-pixen` 32×32, **칸을 꽉 채운 장면**(바탕 칠함, 테두리 없음). 스킬 설명의 모티프 그대로 (무기·속성·모양: 투사체 부채꼴 / 몸 둘레 회전 / 한 줄 관통 / 사방 폭발 / 궁극기 장면).
- 줄기마다 바탕·속성 색 하나 (검성 강청·벚꽃, 파천검왕 핏빛, 성좌기사 성광 금, 천마장군 하늘·금, 용황 보라 불, 전쟁군주 용암·바위, 공성포수 청동·화약, 신궁 태양 금, 차원궁사 공허 보라, 뇌제 청백 번개, 대마도사 불, 빙결 얼음, 챔피언 붉은 강철, 템페스트 바람 초록, 그랜드마스터 청록 기).
- **테두리는 스크립트가 덧그린다** (AI 가 그리면 장마다 달라서): 바깥 2px 를 덮는다.
  - 1차: 짙은 철테 (회색 2단) · 2차·새 스킬: 은테 (밝은 은 + 그늘, 위·왼쪽 밝음) · 궁극기: 금테 + 네 모서리 장식 점.
  - 룬(둥근 판석·별꼴·메달)과 틀부터 다르다 = 네모 배지.
- [색깔놀이 금지](../../CLAUDE.md): 같은 줄기 안 7개는 모티프(물건·움직임)가 달라야 하고, 다른 줄기의 같은 칸(예: 모든 wave)도 무기·물건이 달라야 한다.
- 화면: 스킬 카드·장착 칸 아이콘을 28px → 32px 1배로. 전투 화면 작은 아이콘(14px, `SKILL_CP`)·트리 노드는 그대로.
- 구현: `t7SkIcon(id)` = `<i class="ski ski-<id>"><canvas data-t7icon></canvas></i>`. 생성 CSS 에 그 id 칸이 있으면 배지를 보이고 안의 캔버스를 숨긴다 → 그림이 없는 새 스킬은 옛 12×12 도트가 그대로 나온다(빈칸 안 생김). 잠긴 카드는 흑백.

## 생성 계획 (유료)
- 상한 **150회** (2026-10-21 사용자 승인). 시작 잔량 224 → **74 아래로는 호출하지 않는다**.
- 순서: 검성 8개 시험 → 결·테두리 확인 → 나머지 102개 → pixel-critic 검수(Sonnet, 묶어서) → 불합격만 다시 (예비 약 30).
- 셈: 응답 usage 합, `dev/skill-icons/usage.md`.

## 수용 기준
- [x] 110개 모두 그림이 있고 카드·장착 칸이 줄기마다 맞는 그림을 쓴다 — 15줄기마다 스킬 탭을 그려 `.ski` 배경 없는 것 0, 예외 0. 110개 `ski-<ic>` 규칙 전부 있음
- [x] 차수 셋(철·은·금)이 테두리로 한눈에 갈린다, 룬과 헷갈리지 않는다 (pixel-critic: 테두리 합격)
- [ ] 같은 줄기 7개, 줄기 사이 같은 칸이 모티프로 갈린다 (검수 시트·흑백) — **일부 미달**, 아래 "남은 일"
- [ ] pixel-critic 검수 합격선(모든 항목 3+, 평균 3.5) — 묶음 평균 약 3.5·항목 3+ 이지만 판정 **fix** (줄기 안 비슷한 칸). 상한이 다 차서 가장 심한 6칸만 다시 뽑음
- [x] 콘솔 에러 없음, PixelLab 합 150 이하 — **150회** (`dev/skill-icons/usage.md`)

## 진행 기록
- 2026-10-21: 스펙 작성. 카드 아이콘 110개 집계(SKM_SLOTS × T7_LINES 의 `ic`), 잔량 224.
- 2026-10-21: 검성 8 시험(8회) → 질풍난무·일섬 등 4장이 'X자 칼 두 자루' 구도로 겹쳐 다시(4) → 나머지 102(102) → 공성포수·전쟁군주·신궁·빙결 등에서 X자·방사형 폭발이 반복돼 26장 구도 지정해 다시(26) → 남은 X자 4장 다시(4). 합 144회, 잔량 224 → 82.
- 2026-10-21: pixel-critic 검수 = fix (테두리 합격, 15줄 중 약 8줄에서 줄기 안 칸이 1배 흑백에서 비슷: 뇌제·챔피언 가장 심함, 공성포수·신궁·빙결·대마도사·템페스트·그랜드마스터·성좌기사·차원궁사). 남은 6회로 챔피언 연타 러시·맹호 난타·사방 권격, 뇌제 뇌전 구체, 공성포수 파성 꿰뚫기를 바꿈(신궁 관통 선회는 다시 뽑아도 폭발형이라 원래 것 유지). **합 150회, 잔량 74 (바닥 도달)**.
  - 프롬프트 교훈: 장면 아이콘은 그냥 두면 'X자 교차 무기 / 가운데 방사형 폭발'로 쏠린다. "side view, flying to the right, a figure at the left …" 처럼 **구도와 방향을 문장으로 지정**하고 "no symmetric radial burst, avoid an X shaped composition" 을 붙이면 갈린다.
- 2026-10-21: 사용자 "자고 올 테니 웹 반영(main 푸시)까지 끝내 두고 결과만 보고" → 0.29.3 배포.

## 확인 방법
- `preview_start knight-bar-web` (8765) → 로드 전 localStorage `knight-bar-accounts` = `{"active":"테스트","list":{"테스트":"local-test-token"}}` → `http://localhost:8765/index.html?server=http://127.0.0.1:9&guild=0`, 9초 뒤 콘솔 (줄기는 S.cls 로 바꾼다, 예 'swordsaint'·'grandmaster'):
  `S.cls='swordsaint'; S.level=150; S.best=S.stage=8; S.skm={}; S.runes=[]; S.t7={v:4,pick:false,rk:{slash:4,slash_look:3,gale:4,gale_look:3,iaido:3,iaido_look:1,wave:2,whirl:2,flash:2,storm:2,ult:4,ult_look:2},eq:['gale','iaido'],slots:4,use:{}}; t7S(); campOpen=false; openCamp('char'); campTab='char'; charUi.sub='skill'; renderCamp()`
- 검토 페이지 `http://localhost:8765/dev/review/skill-icons.html` (15줄기 × 8칸 표, 2배·흑백 토글). 검수 시트 `dev/skill-icons/qa-sheet.png`.
- 다시 굽기: `picks.json` 고친 뒤 `cd dev/skill-icons && python build.py`.

## 남은 일
- 사용자 확인 (배포 뒤).
- PixelLab 초기화(11월 14일 무렵) 뒤 2차 다듬기 — 검수에서 걸린 칸, 예상 약 20~30회:
  - 뇌제: 2차 연타·한방·사방 폭발이 모두 파란 번개 지글거림 · 섬뢰가 1차 마력 폭발(지팡이)과 비슷
  - 신궁: 관통 선회 ↔ 광휘 화살비 (둘 다 금빛 별폭발)
  - 빙결: 눈보라 폭풍 ↔ 절대영도 (둘 다 눈꽃)
  - 대마도사: 화염탄·불꽃 고리·불길 폭풍 (주황 방사형 셋)
  - 공성포수: 회전 포대(X자)·어두운 갈색 덩어리 · 성좌기사 심판의 일격 ↔ 별빛 폭풍 · 차원궁사 유도 마탄 ↔ 마탄 궤도 · 템페스트 인물 자세 반복 · 그랜드마스터 기막 ↔ 기공 폭풍
  - 어두운 줄(파천검왕·챔피언·공성포수·전쟁군주)은 흑백에서 뭉개짐 → 프롬프트에 "bright highlights, much brighter subject than background".
  - 방법: 구도·방향을 문장으로 지정 (진행 기록 교훈). 검수 시트 `dev/skill-icons/qa-sheet.png`.
