# 스펙 문서

기능마다 파일 하나. 파일 이름은 영문 kebab-case (`art-upgrade.md`, `boss-rush.md`).
스펙은 "지금 게임이 어떻게 동작해야 하는가"의 기준이다. 코드와 스펙이 다르면 둘 중 하나가 틀린 것이니 맞춘다.

## 절차

1. 관련 스펙을 찾는다 (`docs/specs/` 목록, 아래 색인).
2. 없으면 아래 양식으로 새로 쓰고, 있으면 고친다. 상태는 `초안`.
3. 새 기능이나 규칙·밸런스 변경이면 요지를 사용자에게 보여주고 확인받는다 → 상태 `확정`.
4. 구현 → 수용 기준을 하나씩 검증한다.
5. 진행 기록·남은 일을 갱신한다. 다 끝나면 상태 `완료` (이후 바뀌면 다시 `확정`→`완료`).

## 양식

```markdown
# <기능 이름>

- 상태: 초안 | 확정 | 진행 중 | 완료
- 관련 코드: src/xxx.js (주요 함수), ...
- 최종 갱신: YYYY-MM-DD

## 목표
왜 만드는가, 플레이어가 느껴야 하는 것.

## 규칙
동작 규칙. 숫자(수치·확률·쿨다운·비용)는 구체적으로 적는다.

## UI
화면에 무엇이 어떻게 보이는가.

## 수용 기준
- [ ] 확인 가능한 문장으로. 각 항목에 확인 방법(테스트 페이지, 콘솔 스니펫, 스크린샷)을 붙인다.

## 진행 기록
- YYYY-MM-DD: 한 일, 결정한 것과 이유.

## 남은 일 / 미정
- 다음 세션이 이어서 할 일, 사용자에게 물어봐야 할 것.
```

## 색인

| 스펙 | 상태 | 내용 |
|---|---|---|
| [guild.md](guild.md) | 초안 | **기사단 (시즌7)** — 기사 여러 명 동시 육성(슬롯 2→5, 🛡️ 기사단 회관), 모든 콘텐츠 동시 진행(기사마다 iframe 검증안), 입장권 기사별, 계열 효과·따라잡기, Google 로그인 + Electron 연결 코드. 공용 범위 안 A/B 미정 (검토 `dev/review/guild.html`) |
| [currency-roles.md](currency-roles.md) | 구현 (0.23.2) | 재화 역할 지도 — 재화마다 얻는 곳·쓰는 곳. 💎 마력석 = 고강화(+10~)·전직 전용(건물·시설·레이드 입장권에서 뺌, 강화 마력석 ×3) · 🪨 대장간 시설 철광석 ×0.5 · 💠 강화 강화석 ×1.5 (`dev/currency-bot.js`, 검토 `dev/review/currency-roles.html`) |
| [dungeon-reward-buff.md](dungeon-reward-buff.md) | 완료 (0.22.3) | 재료의 미궁 보상 ×2(강화석 ×3) · 강화 비용에서 🪨 철광석 제외 (검토 `dev/review/dungeon-buff.html`) |
| [build-rush.md](build-rush.md) | 완료 (0.21.1) | 건설 즉시 완료 — 남은 1분당 최고 스테이지 잡몹 골드 ×2.2 (남은 1시간 ≈ 원정 30분 골드) |
| [building-materials-and-training.md](building-materials-and-training.md) | 완료 (0.20.15) | 건물 목재·철광석 비용 Lv8 위로 ×1.5 · 교역 1회 = 다음 건물 비용 10% · 공격력·체력 훈련 배율(훈련 : 장비 ≈ 3:7) |
| [growth-compression.md](growth-compression.md) | 완료 (0.21.0) | 성장 곡선 압축 — 몬스터 ×1.06·×1.04/스테이지(옆 레이드 보스 약 7배), 장비·훈련 배율 같은 비율로, 훈련 : 장비 체감 4 : 6. 경제는 2단계 |
| [gold-trade-and-resource-guide.md](gold-trade-and-resource-guide.md) | 완료 (0.20.14) | 후반 성장 곡선 완화(스테이지 100 부터 몬스터 체력 ×1.19·공격력 ×1.145) · 교역 하루 5+Lv 회·값 ×1.3 · 캠프 재화 6칸 누르면 얻는 곳/쓰는 곳 |
| [admin-token-reissue.md](admin-token-reissue.md) | 완료 | 운영: 관리자 복구 코드 재발급 `POST /api/admin/token` — 옛 코드는 401 `revoked`(기기 기록 안 지움) |
| [roadmap.md](roadmap.md) | 방향 확정 | **패치 로드맵** — 시즌6(권투가·성벽 지키기·교관 재가동·강화 +30·자잘이) · 시즌7~(암살자·사무라이·해머전사·스킬 룬). "결정 사항" 표가 기준, 항목별 스펙은 착수 때 따로 |
| [enhance-30.md](enhance-30.md) | 구현 끝 (season6, 배포 전) | ⚒️ 강화 최대 +30: +16~25 초기화 절반 · +26~30 성공 15→11%·하락 30%·초기화 4% (주문서 구간) · 비용·배율 식 그대로(+30 ×1.52, 0.21.0 압축식 — 압축 전 ×8.2) · 옵션 줄 일반 0~초월·태초 6(+30 에서 6번째) · 태초 값 배율 2.0 · gearV 9 이행 (검토 `dev/review/enhance-30.html`) |
| [castle-defense.md](castle-defense.md) | 진행 중 — 구현 끝, 배포 전 | 🏰 성벽 지키기 (시즌6 서브 콘텐츠): 스테이지 40 해금 · 1~100단계(적 = 스테이지 20+2L) · 10웨이브(5·10 보스) · 기사가 막고 쓰러진 동안만 성벽이 맞음 · 🧱 성벽돌 업그레이드 6종(전부 약 10일) · 📕 수련의 서 하루 10~13권 · 성벽 위 교관 · 입장권 하루 3장+골드 구매·소탕 (검토 `dev/review/castle-defense.html`) |
| [tower-packs.md](tower-packs.md) | 확정 | 도전의 탑 무리 층: 끝자리 3·6·9층은 정예 무리 3마리(마리당 체력 정예 ×0.4·공격 ×1), 광폭화·보상·소탕 그대로 (`dev/tower-pack-sim.js`, 검토 `dev/review/tower-packs.html`) |
| [ticket-buy.md](ticket-buy.md) | 확정 | 탑·미궁 입장권 골드 추가 구매 — 둘 다 골드만(탑 마력석 제거), ×0.5→1→2→3.5→6 이후 ×1.7, 산 입장권 5장까지. 미궁 기준값 몹 골드 ×600(사냥 1시간치). 검토 `dev/review/ticket-buy.html` |
| [boxer-class.md](boxer-class.md) | 확정 (구현 전) | 신규 계열 **파이터** 7종(스트라이커·킥복서·기공사 → 챔피언·템페스트·그랜드마스터) — 쿨타임 대신 기 게이지(주 기술) + 투지(물려받은 기술·Lv70·궁극기), 2차마다 채우는 법이 다름, 통짜 스프라이트 시트·이펙트 텍스처 48장, 기준 그림 7:3 v2 (검토 `dev/review/boxer.html`) |
| [legacy-class-sheets.md](legacy-class-sheets.md) | 확정 (구현 전) | 기존 직업 29종 통짜 스프라이트 시트 전환 — 칸 64/96/128, 계열 4개 동시, 포즈=PixelLab 애니(기준 그림 = 지금 스프라이트), 3차는 2차 편집, ComfyUI 는 보조, 계열 170회, SHEET_ON 되돌리기 |
| [skill-vfx.md](skill-vfx.md) | 확정 (명중 분리판, 퀄업 구현 전) | 스킬 VFX 퀄업 — 스킬 40종 + 평타 29종 전수조사 · 이펙트 그림은 전부 PixelLab 텍스처 167장(무기 궤적 15·평타 명중 직업마다 29·투사체 12·공용 배경 7·스킬 본체 43·궁극기 21·스킬 명중 스킬마다 40, 약 740회) · ⑤-0 검흔 시험 · 정지·흔들림 기준 · 계열별 패치 순서 (검토 `dev/review/skill-vfx.html`) |
| [vfx-rule-fixes.md](vfx-rule-fixes.md) | 확정 (0.21, 구현 전) | 2차 스킬 ★★★ 하단바 전체 섬광 11곳 → 타격 지점 둘레로 · 공허궁 꼬리 색 · 3차 타격 섬광 색 · 결투·레이드 원거리 평타 모양 |
| [pixel-qa.md](pixel-qa.md) | 진행 중 (블라인드 6/6, 합격선 조정 대기) | 도트 품질 검수 에이전트 — 게임 로더 그대로 거친 모습 → 규격 검사 → 자동 지표(경보·근거) → Claude 비평 서브에이전트(채점표 7항목, pass/fix/regen) + 사용자 판정 취향 기록. 보정: 지표만으로 탈락 6장 중 4장, 오경보 16% (검토 `dev/review/pixel-qa.html`) |
| [art-upgrade.md](art-upgrade.md) | 진행 중 | AI 이미지 생성 → 도트 복원으로 배경·UI·아이콘 퀄업 |
| [ui-icons.md](ui-icons.md) | 완료 | UI·캔버스 이모지 → 14px 직접 도트 아이콘 184종 (`dev/make-icons.js`, 자동 변환) |
| [forge-temper.md](forge-temper.md) | 완료 | 대장간 🔥 담금질대: +20 까지 강화 성공↑·하락↓, +20 이상은 그대로 |
| [skill-mastery-cost.md](skill-mastery-cost.md) | 완료 | 스킬 숙련도 비전서 요구량 차수별(1차 6·2차 10·궁극기 12권/레벨 최대) |
| [ult-separate-mastery.md](ult-separate-mastery.md) | 완료 (0.20.7) | 3차 궁극기를 별도 스킬로 — 1차 스킬 유지(0.20.11 부터 2·3차에서도 원래 위력), 궁극기 숙련도·트리 따로 (mastV 12) |
| [reward-inversion-audit.md](reward-inversion-audit.md) | 완료 (0.20.11) | 보상 역전 전수조사: 탑 입장 소탕분 보장·원정 보스 진행 유실·진화★ 손해·1차 스킬 계승 약화·레이드 보상 눈금·세트 서열·입장권 서버 시각 등 |
| [gear-options.md](gear-options.md) | 완료 (0.20.0) | 장비 강화 구간별 옵션 줄 · 등급 희소성 드랍 개편 · 🎲 재굴림권(재굴림대) |
| [unique-procs.md](unique-procs.md) | 완료 (0.20.0) | 이름 있는 장비·레이드 세트 고유 발동 효과 |
| [training-mentors.md](training-mentors.md) | 확정 (10-13, 시즌6 재가동 — 구현 전, 지금 코드는 `MENTOR_ON = false`) | 🎓 교관 수련 재가동: 교관 5명 × 별 5, ★1~4 📕 수련의 서 확정 상승(11/16/22/28/33 = 110권 ≈ 무료 10일, 골드 없음) · ★5 교관 승부 무료 하루 3회 · 최고 스테이지 40 에서 열림 · 1차 훈련 Lv 200 유지 · 훈련장 아래 🎯/🎓 탭 · 0.22.4 별 달면 스탯 전후 표시(사용자 확인). 검토 `dev/review/mentors.html` |
| [duel-gap-closer.md](duel-gap-closer.md) | 완료 | 돌진기가 사거리 밖에서 달려붙는 이동기 + 직업 체력 근접 ×1.1 · 원거리 ×0.9 — 근접 vs 원거리 손해 보정 |
| [duel-length.md](duel-length.md) | 완료 | 결투 체력 ×2(%회복은 늘리기 전 기준) + 성기사·성좌기사·천마장군 방어·회복 하향 — 스킬 한두 방에 끝나지 않게 |
| [raid-difficulty.md](raid-difficulty.md) | 완료 | 레이드 보스 세기 = 입장 + 9 − 인원 보정 (4인 바로 · AI 파티 +8 · 혼자 +20), 전 보스는 스근하게 |
| [raid-tickets.md](raid-tickets.md) | 완료 (0.20.16) | 레이드 입장권: 매일 자정 5장까지 무료로 채움(=보유 상한), 구매·우편 규칙 |
| [skill-build-tree.md](skill-build-tree.md) | 초안 (시즌7) | 스킬 빌드 트리: 레벨업마다 🌟 포인트, 직업 안 갈래 3개·변형·키스톤·융합·궁극기 변형, 장착 칸 1→4, 10·20칸 보스 벽, 비전서 없앰. 레퍼런스 9게임. 검토 `dev/review/skill-build-tree.html` |
| [skill-tree-all.md](skill-tree-all.md) | 0.27.0 공개 · 14줄기 전용 연출·아이콘 impl-tree7-fx (검수 93/98) | 시즌7 스킬 빌드 트리 15줄기 전체 — 칸 틀·줄기 데이터·자동 찍기·결투 배율·측정 |
| [skill-tree-swordsaint.md](skill-tree-swordsaint.md) | 진행 중 — 1~5단계 구현, 6단계 사용자 시험 차례 (impl-skill-tree) | 위 트리를 검사→검성→검신 한 줄기에 먼저 구현하는 스펙 — 노드 표·구현 방식·보스 벽 1~120 배치·봇 `--build`·작업 순서 |
| [skill-tree-nodes.md](skill-tree-nodes.md) | 완료 | 스킬 트리 오른쪽 노드 저울질: ⏱️ 쿨타임 −40%·💥 치명 +15%·🩸 흡혈 15%·🔥 화상 45% (피해=결투, 쿨타임=사냥·레이드) |
| [protect-scroll-drop.md](protect-scroll-drop.md) | 완료 | 📜 보호 주문서 상점 제거·상자 드롭 전용(원정당 약 0.9장) + 보급품 가격 절반 |
| [reroll-drop.md](reroll-drop.md) | 완료 | 🎲 재굴림권 넉넉히 — 원정 상자마다 12%(원정당 약 1.5장), 레이드 상자·월드 보스 보상 3~5장 확정 |
| [storage-logistics.md](storage-logistics.md) | 완료 | 창고 개편: 창고는 🪵·🪨 비축(12시간분) + Lv5 부터 골드 교역 (하루 2+Lv/5회, 값 ×2씩) |
| [raid-sig-drop.md](raid-sig-drop.md) | 완료 (0.20.9) | 레이드 고유 장비 드랍률 ×3 — 처치 상자당 6~18% (세트 평균 17~50회) |
| [bag-upgrade.md](bag-upgrade.md) | 완료 | 🎒 가방은 여관 안 별도 업그레이드: 무게 10 + 2/Lv, 최대 Lv = 여관 Lv(최대 48), 비용 = 여관 목재의 1/4, 가방 가득 귀환 때만 레드닷 |
