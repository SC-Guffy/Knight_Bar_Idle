# 권투가 VFX 텍스처 PixelLab 사용 기록

시작 잔량 1769 (2026-10-14). 한 줄 = 호출 1번. 잔량은 다른 작업(캐릭터 시트)과 같은 계정이라 전후 차이에 남의 호출이 섞일 수 있다.

| 이름 | 엔드포인트 | 회수 | 잔량 전 → 후 |
|---|---|---|---|
| xw1a | create-image-pixen | 1 | 1769.0 → 1768.0 |
| xw1b | create-image-pixen | 1 | 1768.0 → 1766.0 |
| xh1a | create-image-pixen | 1 | 1766.0 → 1765.0 |
| xh1b | create-image-pixen | 1 | 1765.0 → 1765.0 |
| xh1 | animate-with-text-v3 | 1 | 1764.0 → 1761.0 |
| xh1r | animate-with-text-v3 | 1 | 1761.0 → 1760.0 |
| xe01a | create-image-pixen | 1 | 1760.0 → 1759.0 |
| xe01b | create-image-pixen | 1 | 1759.0 → 1757.0 |
| xe01 | animate-with-text-v3 | 1 | 1757.0 → 1755.0 |
| xe01r | animate-with-text-v3 | 1 | 1755.0 → 1754.0 |
| xe02a | create-image-pixen | 1 | 1754.0 → 1753.0 |
| xe02b | create-image-pixen | 1 | 1753.0 → 1751.0 |
| xe02 | animate-with-text-v3 | 1 | 1751.0 → 1750.0 |
| xk01a | create-image-pixen | 1 | 1750.0 → 1749.0 |
| xk01 | animate-with-text-v3 | 1 | 1749.0 → 1747.0 |
| xw2a | create-image-pixen | 1 | 1747.0 → 1745.0 |
| xw3a | create-image-pixen | 1 | 1745.0 → 1744.0 |
| xw4a | create-image-pixen | 1 | 1744.0 → 1742.0 |
| xw2b | create-image-pixen | 1 | 1742.0 → 1742.0 |
| xw4b | create-image-pixen | 1 | 1741.0 → 1739.0 |
| xw2c | create-image-pixen | 1 | 1738.0 → 1737.0 |
| xw4c | create-image-pixen | 1 | 1737.0 → 1737.0 |
| xw3f | create-image-pixen | 1 | 1736.0 → 1734.0 |
| xh2a | create-image-pixen | 1 | 1734.0 → 1733.0 |
| xh4a | create-image-pixen | 1 | 1733.0 → 1732.0 |
| xh6a | create-image-pixen | 1 | 1732.0 → 1730.0 |
| xh2 | animate-with-text-v3 | 1 | 1730.0 → 1715.0 |
| xh4 | animate-with-text-v3 | 1 | 1715.0 → 1699.0 |
| xh6 | animate-with-text-v3 | 1 | 1699.0 → 1684.0 |
| xh2b | create-image-pixen | 1 | 1666.0 → 1612.0 |
| xh2r | animate-with-text-v3 | 1 | 1611.0 → 1599.0 |
| xp1a | create-image-pixen | 1 | 1595.0 → 1584.0 |
| xe10a | create-image-pixen | 1 | 1582.0 → 1579.0 |
| xe03a | create-image-pixen | 1 | 1579.0 → 1545.0 |
| xe04a | create-image-pixen | 1 | 1545.0 → 1539.0 |
| xp1 | animate-with-text-v3 | 1 | 1536.0 → 1519.0 |
| xe10 | animate-with-text-v3 | 1 | 1519.0 → 1499.0 |
| xe03 | animate-with-text-v3 | 1 | 1499.0 → 1476.0 |
| xe04 | animate-with-text-v3 | 1 | 1476.0 → 1467.0 |
| xe05a | create-image-pixen | 1 | 1462.0 → 1459.0 |
| xe07a | create-image-pixen | 1 | 1458.0 → 1453.0 |
| xe08a | create-image-pixen | 1 | 1453.0 → 1447.0 |
| xe12a | create-image-pixen | 1 | 1446.0 → 1440.0 |
| xe05 | animate-with-text-v3 | 1 | 1436.0 → 1419.0 |
| xe07 | animate-with-text-v3 | 1 | 1419.0 → 1410.0 |
| xe08 | animate-with-text-v3 | 1 | 1410.0 → 1399.0 |
| xe12 | animate-with-text-v3 | 1 | 1399.0 → 1376.0 |
| xe14a | create-image-pixen | 1 | 1372.0 → 1367.0 |
| xe14 | animate-with-text-v3 | 1 | 1367.0 → 1361.0 |
| xe15a | create-image-pixen | 1 | 1360.0 → 1356.0 |
| xe15 | animate-with-text-v3 | 1 | 1352.0 → 1348.0 |

## 요약 (2026-10-14 멈춤)

- 내 호출 51회 (키 그림 31 + 애니 20). 파이터 15, 2차 36.
- 계정 잔량 1769 → 1345. 차이 424 중 약 373 은 같은 계정의 다른 작업(캐릭터 시트) 몫. 잔량 하한 1,340 직전이라 멈춤.

## 2차 진행 (2026-10-14, 새 규칙: 잔량 차이로 셈, 몫 최대 90, 계정 1,069 전에 멈춤)

시작 잔량 1341.

| 이름 | 엔드포인트 | 회수 | 잔량 전 → 후 |
|---|---|---|---|
| xe16a | create-image-pixen | 1 | 1340.0 → 1338.0 |
| xe16 | animate-with-text-v3 | 1 | 1338.0 → 1334.0 |
