# 룬 아이콘 (32×32 PixelLab 룬석)

- 상태: **배포됨 0.29.2** (2026-10-20 사용자 확인 "좋아, 배포해줘") (2026-10-20 사용자: "스킬 개편에 맞춰 아이콘 쌈뽕하게, PixelLab 윤허")
- 상위: [skill-runes.md](skill-runes.md) (룬 25종) · [skill-redesign.md](skill-redesign.md)
- 관련 코드: `dev/rune-icons/` (생성·정리 스크립트, 원본) → `src/skin/runes.png` (32×32 칸 시트) · `src/skin/tree7.css` (`.rn`) · `src/rune.js` (`RUNE_CELLS`·`runeArt`) · `src/tree7-ui.js` (`runeChip`) · `src/ui.js` (`lootIconHtml`)
- 검토 페이지: `dev/review/rune-icons.html`
- 최종 갱신: 2026-10-20

## 목표
룬이 지금은 이모지를 다른 것과 돌려 쓴다 (🗡️ 처형·만검, 🔥 겁화·광란 겹침) → 0.29 개편의 새 얼굴인데 정체가 없다.
룬마다 **고유 룬석 그림**을 둬서 주머니·룬 칸·상자 결과에서 "뭐가 나왔나"가 한눈에 보이고 줍는 맛이 나게 한다.

## 규칙
- 크기 32×32, PixelLab `create-image-pixen` 으로 직접 32칸 생성 (ComfyUI 는 32칸 축소 시 1도트 디테일이 뭉개져 이번엔 안 씀 — art-upgrade.md 시험 결과).
- 틀(실루엣)로 종류를 나눈다:
  - **범용 14종**: 둥근 판석(회청색 돌) + 새긴 문양이 룬 색으로 빛남.
  - **모양 4종**: 세로로 긴 육각 결정 (판석과 다른 윤곽).
  - **전설 7종**: 금테 두른 부적/메달형, 문양 더 크고 화려.
- 문양은 효과 그대로, 서로 겹치지 않게 ([색깔놀이 금지](../../CLAUDE.md)): 처형 = 단두 도끼 · 거인 사냥 = 금 간 왕관 · 선봉 = 깃발 · 일기토 = 한 자루 칼과 결투 표식 · 겁화 = 번지는 불꽃 · 출혈 = 핏방울 · 과부하 = 번개 · 가속 = 소용돌이 화살 · 약점 = 금 간 방패 · 재장전 = 원형 화살 · 속사 = 바람 깃털 · 연결 = 사슬 고리 · 확장 = 바깥 화살 둘 · 관통 = 꿰뚫는 화살 / 한 번 더 = 겹친 칼 둘 · 잔상 = 유령 그림자 · 파열 = 별 폭발 · 난무 = 회오리 / 시간의 검 = 모래시계+칼 · 광란 = 불타는 주먹 · 무한 = ∞ · 메아리 = 그림자 사람 · 만검 = 부채꼴 칼들 · 사거리 = 초승달 · 선(禪) = 음양.
- 등급은 그림에 넣지 않는다 — 칸 테두리 색(`GRADES[g].color`)과 영웅·전설 은은한 빛은 CSS.
- 화면: 룬 칸·주머니·합치기 버튼·상자 결과 카드에 1배 32px (`runeArt(r)` → `<i class="rn">`, 테두리 = 1px 등급색 drop-shadow, 전설은 빛 4px 더). 옛 `.gem` 색 마름모는 칩에서 뺐다. 토스트·설명 글 속 이모지(`runeIcon`)는 그대로.
- 실제 결과 틀: 모양 4종은 육각 대신 **별꼴 결정**으로 나왔고(판석·메달과 더 잘 갈려서 채택), 문양은 아래 "진행 기록"의 최종 프롬프트(`dev/rune-icons/prompts.py`).

## 생성 계획 (유료)
- 상한 **80회** (2026-10-20 사용자 승인 — 계정 바닥 300 아래로 내려가는 것 허용). 시작 잔량 275 → 195 아래로는 호출하지 않는다.
- 순서: 스타일 시험 3장(판석·결정·전설 하나씩) → 틀 확정 → 나머지 22장 → 검수(pixel-critic 기준 3+/평균 3.5) → 불합격만 다시 (장당 최대 2번 더).
- 셈: 응답 usage 합, `dev/rune-icons/usage.md`.

## 수용 기준
- [x] 25종 모두 그림이 있고 `RUNE_DEF`·`RUNE_LEG` 의 id 와 칸이 맞는다 (`RUNE_CELLS` = build.py `CELLS`, 주머니 25개 = `.rn` 25개)
- [x] 흑백으로 봐도 범용·모양·전설 세 틀이 구분되고, 같은 틀 안 문양이 서로 겹치지 않는다 (pixel-critic 검수: 세 틀 구분·중복 없음, 묶음 평균 약 3.9)
- [x] 스킬 탭 룬 칸·주머니·합치기·상자 결과에 그림이 나오고 등급 테두리 색이 맞다, 콘솔 에러 없음 (오프라인 서버 포트 오류만)
- [x] PixelLab 사용 합 80 이하 — **51회** (`dev/rune-icons/usage.md`)

## 확인 방법
- `preview_start knight-bar-web` (8765) → 로드 전 localStorage `knight-bar-accounts` = `{"active":"테스트","list":{"테스트":"local-test-token"}}` → `http://localhost:8765/index.html?server=http://127.0.0.1:9&guild=0`, 9초 뒤 콘솔:
  `S.cls='swordsaint'; S.level=150; S.best=S.stage=8; S.gold=1e9; S.tomes=60; S.skm={}; S.runes=[]; S.t7={v:4, pick:false, rk:{slash:4, slash_look:3, gale:4, gale_look:3, whirl:2, whirl_look:1, iaido:3, iaido_look:1, ult:4, ult_look:2}, eq:['gale','whirl','steelCleave','iaido'], slots:4, use:{}}; t7S(); Object.keys(RUNE_DEF).forEach((id,i)=>runeAdd({id, g: RUNE_DEF[id].shape ? 2+(i%2) : i%4})); RUNE_LEG_IDS.forEach(id=>runeAdd({id,g:4})); for (const [sk,id] of [['gale','frenzy'],['gale','twin'],['iaido','exec'],['steelCleave','boss'],['steelCleave','crowd']]) runeSocket(sk, S.runes.findIndex(r=>r.id===id)); campOpen=false; openCamp('char'); campTab='char'; charUi.sub='skill'; renderCamp()`
  → 스킬 카드 룬 칸 · 아래 룬 주머니 25종.
- 검토 페이지 `http://localhost:8765/dev/review/rune-icons.html` (1배 줄·흑백·밝은 바탕·이모지 전후 4배). 검수 시트 `dev/rune-icons/qa-sheet.png`.
- 다시 굽기: `dev/rune-icons/picks.json` 고친 뒤 `python dev/rune-icons/build.py`.

## 진행 기록
- 2026-10-20: 스펙 작성. 범위 룬 25종, PixelLab 상한 80 (사용자 선택). 시작 잔량 275.
- 2026-10-20: 시험 3장 → 틀 확정 → 22장 → 판석 문양이 "고리+사선"으로 뭉쳐 9장 + 결정이 작아 4장 + 잔영 다시 → pixel-critic 검수(약점 regen, 출혈·속사·관통·확장 fix) → 다시 뽑기 2번. 합 **51회**, 잔량 275 → 224 (다른 세션 사용 포함).
  - 프롬프트 교훈: 판석에 "rune symbol" 이라 쓰면 둥근 고리 문양만 나온다 → "big bold pictogram, NO circle, NO ring" + 구체적 사물. 어두운 색(어두운 빨강·보라)은 판석 명도와 같아 1배에서 묻힌다 → "bright … much brighter than the stone".
  - 확장은 세 번 다 뜻이 약해(1차 괄호 모양 채택, 검수 pass) 남은 약점. 연결·확장, 만검·심검이 1배에서 조금 비슷하다는 검수 메모.
- 코드: src/rune.js `RUNE_CELLS`·`runeArt` · tree7-ui.js `runeChip`·합치기 버튼 · ui.js `lootIconHtml` · tree7.css `.rn`.

## 남은 일
- ~~사용자 확인 → 커밋·배포~~ 0.29.2 배포 (2026-10-20).
- (선택) 확장 룬 다시 뽑기, 스킬 카드 아이콘 32×32 (다음 달 PixelLab 초기화 뒤, 약 140개).
