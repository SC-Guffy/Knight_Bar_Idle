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
| [build-rush.md](build-rush.md) | 완료 (0.21.1) | 건설 즉시 완료 — 남은 1분당 최고 스테이지 잡몹 골드 ×2.2 (남은 1시간 ≈ 원정 30분 골드) |
| [building-materials-and-training.md](building-materials-and-training.md) | 완료 (0.20.15) | 건물 목재·철광석 비용 Lv8 위로 ×1.5 · 교역 1회 = 다음 건물 비용 10% · 공격력·체력 훈련 배율(훈련 : 장비 ≈ 3:7) |
| [growth-compression.md](growth-compression.md) | 완료 (0.21.0) | 성장 곡선 압축 — 몬스터 ×1.06·×1.04/스테이지(옆 레이드 보스 약 7배), 장비·훈련 배율 같은 비율로, 훈련 : 장비 체감 4 : 6. 경제는 2단계 |
| [gold-trade-and-resource-guide.md](gold-trade-and-resource-guide.md) | 완료 (0.20.14) | 후반 성장 곡선 완화(스테이지 100 부터 몬스터 체력 ×1.19·공격력 ×1.145) · 교역 하루 5+Lv 회·값 ×1.3 · 캠프 재화 6칸 누르면 얻는 곳/쓰는 곳 |
| [admin-token-reissue.md](admin-token-reissue.md) | 완료 | 운영: 관리자 복구 코드 재발급 `POST /api/admin/token` — 옛 코드는 401 `revoked`(기기 기록 안 지움) |
| [art-upgrade.md](art-upgrade.md) | 진행 중 | AI 이미지 생성 → 도트 복원으로 배경·UI·아이콘 퀄업 |
| [ui-icons.md](ui-icons.md) | 완료 | UI·캔버스 이모지 → 14px 직접 도트 아이콘 184종 (`dev/make-icons.js`, 자동 변환) |
| [forge-temper.md](forge-temper.md) | 완료 | 대장간 🔥 담금질대: +20 까지 강화 성공↑·하락↓, +20 이상은 그대로 |
| [skill-mastery-cost.md](skill-mastery-cost.md) | 완료 | 스킬 숙련도 비전서 요구량 차수별(1차 6·2차 10·궁극기 12권/레벨 최대) |
| [ult-separate-mastery.md](ult-separate-mastery.md) | 완료 (0.20.7) | 3차 궁극기를 별도 스킬로 — 1차 스킬 유지(0.20.11 부터 2·3차에서도 원래 위력), 궁극기 숙련도·트리 따로 (mastV 12) |
| [reward-inversion-audit.md](reward-inversion-audit.md) | 완료 (0.20.11) | 보상 역전 전수조사: 탑 입장 소탕분 보장·원정 보스 진행 유실·진화★ 손해·1차 스킬 계승 약화·레이드 보상 눈금·세트 서열·입장권 서버 시각 등 |
| [gear-options.md](gear-options.md) | 완료 (0.20.0) | 장비 강화 구간별 옵션 줄 · 등급 희소성 드랍 개편 · 🎲 재굴림권(재굴림대) |
| [unique-procs.md](unique-procs.md) | 완료 (0.20.0) | 이름 있는 장비·레이드 세트 고유 발동 효과 |
| [training-mentors.md](training-mentors.md) | 보류 — 0.20.6 에 꺼 둠 (`MENTOR_ON`) | 훈련 1차 만렙 50 · 2차 훈련 🎓 교관 수련(교관 5명 × 별 5, 골드 확률 수련 + 마지막 별은 레벨 스케일링 승부). 지금은 훈련 Lv 200 으로 되돌려 둠 |
| [duel-gap-closer.md](duel-gap-closer.md) | 완료 | 돌진기가 사거리 밖에서 달려붙는 이동기 + 직업 체력 근접 ×1.1 · 원거리 ×0.9 — 근접 vs 원거리 손해 보정 |
| [duel-length.md](duel-length.md) | 완료 | 결투 체력 ×2(%회복은 늘리기 전 기준) + 성기사·성좌기사·천마장군 방어·회복 하향 — 스킬 한두 방에 끝나지 않게 |
| [raid-difficulty.md](raid-difficulty.md) | 완료 | 레이드 보스 세기 = 입장 + 9 − 인원 보정 (4인 바로 · AI 파티 +8 · 혼자 +20), 전 보스는 스근하게 |
| [raid-tickets.md](raid-tickets.md) | 완료 (0.20.16) | 레이드 입장권: 매일 자정 5장까지 무료로 채움(=보유 상한), 구매·우편 규칙 |
| [skill-tree-nodes.md](skill-tree-nodes.md) | 완료 | 스킬 트리 오른쪽 노드 저울질: ⏱️ 쿨타임 −40%·💥 치명 +15%·🩸 흡혈 15%·🔥 화상 45% (피해=결투, 쿨타임=사냥·레이드) |
| [protect-scroll-drop.md](protect-scroll-drop.md) | 완료 | 📜 보호 주문서 상점 제거·상자 드롭 전용(원정당 약 0.9장) + 보급품 가격 절반 |
| [reroll-drop.md](reroll-drop.md) | 완료 | 🎲 재굴림권 넉넉히 — 원정 상자마다 12%(원정당 약 1.5장), 레이드 상자·월드 보스 보상 3~5장 확정 |
| [storage-logistics.md](storage-logistics.md) | 완료 | 창고 개편: 창고는 🪵·🪨 비축(12시간분) + Lv5 부터 골드 교역 (하루 2+Lv/5회, 값 ×2씩) |
| [raid-sig-drop.md](raid-sig-drop.md) | 완료 (0.20.9) | 레이드 고유 장비 드랍률 ×3 — 처치 상자당 6~18% (세트 평균 17~50회) |
| [bag-upgrade.md](bag-upgrade.md) | 완료 | 🎒 가방은 여관 안 별도 업그레이드: 무게 10 + 2/Lv, 최대 Lv = 여관 Lv(최대 48), 비용 = 여관 목재의 1/4, 가방 가득 귀환 때만 레드닷 |
