// (비교용) 안 H-B 📜 보호 주문서 수급 늘리기 — 레이드 처치 상자 주문서 확률 0.06 → P_RAID (기본 0.5), 원정 상자 가중치 60 → P_W (기본 60 = 그대로)
//  docs/specs/currency-surplus-1023.md · 쓰는 법: node dev/currency-bot.js --patch dev/audit-1023/patches/surplus-h-protect.js
var P_RAID = typeof P_RAID === 'number' ? P_RAID : 0.5, P_W = typeof P_W === 'number' ? P_W : 60;
RARE_DROP.raid.protect = P_RAID;
SUPPLIES.protect.w = P_W;
