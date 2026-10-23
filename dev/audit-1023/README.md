# 밸런스 총점검 실험 스크립트 (2026-10-23)

스펙: [docs/specs/balance-audit-1023.md](../../docs/specs/balance-audit-1023.md). 저장소 루트에서 `node dev/audit-1023/<폴더>/<파일>.js` 로 돌린다.

- `guild/` — 기사단. `gb.js` 는 dev/guild-bot.js 복사본에 `DG=off|main|all`(미궁을 누가 도나)·`RUSH=1`(즉시 완료) 추가. `bag.js` 는 가방 Lv 버그 재현(0.30.5 뒤엔 6 유지).
- `reward/` — 보상·비용 역전 계산 a1~a5 (레이드 입장권 대 승리 골드, 성벽 실패 대 소탕, 비전서 수요 등).
- `curve/` — `lifespan-bot --json` 결과 요약: `sum.js <json>`(일별 중앙값), `stall.js <json>`(정체 스테이지·도달일).
- `class/` — 직업·결투. `league2.js`(빌드·레벨별 승률, `RAW=1` 결투 배율 끔), `dps.js`, `rtexp.js`(실시간 world.js 대 simulate: `STG=50 SEC=900 B=a`), `raid.js`, `runes.js`, `zen.js`, `combo.js`, `vsbot.js`.
