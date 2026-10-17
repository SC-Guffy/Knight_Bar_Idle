# 새 시트 수용 기준 측정 (전수조사 기준을 파이썬으로 근사): python dev/vfx6/measure.py <sheet.png> <frames> [...]
#  edge  = 둘레(투명에 닿은) 픽셀 중 밝기 0.25 미만 비율 (기준 0.15 미만)
#  strip = 로더(vfxQuantize)가 외곽선으로 벗겨 낼 픽셀 비율 — 거의 무채색이고 아주 어두운 픽셀 (기준 10% 미만)
#  crumb = 프레임당 4픽셀 이하 덩어리 수 평균 (기준 1 이하)
import sys
from PIL import Image

def measure(path, n):
    im = Image.open(path).convert('RGBA'); W, H = im.size; fw = W // n; p = im.load()
    op = lambda x, y: 0 <= x < W and 0 <= y < H and p[x, y][3] >= 24
    edge = dark = ink = tot = 0; crumbs = 0
    for f in range(n):
        seen = set()
        for y in range(H):
            for x in range(f * fw, (f + 1) * fw):
                if not op(x, y): continue
                r, g, b, _ = p[x, y]; l = (0.3 * r + 0.59 * g + 0.11 * b) / 255; tot += 1
                if max(r, g, b) < 48 and max(r, g, b) - min(r, g, b) < 28: ink += 1
                if any(not op(x + dx, y + dy) for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                    edge += 1; dark += l < 0.25
                if (x, y) in seen: continue
                st, comp = [(x, y)], 0; seen.add((x, y))
                while st:
                    cx, cy = st.pop(); comp += 1
                    for dx in (-1, 0, 1):
                        for dy in (-1, 0, 1):
                            q = (cx + dx, cy + dy)
                            if f * fw <= q[0] < (f + 1) * fw and q not in seen and op(*q):
                                seen.add(q); st.append(q)
                crumbs += comp <= 4
    e, s, c = dark / max(edge, 1), ink / max(tot, 1), crumbs / n
    ok = e < 0.15 and s < 0.10 and c <= 1
    print('%-28s %dx%d x%d  edge %.2f  strip %.1f%%  crumb %.1f  %s' % (path, fw, H, n, e, s * 100, c, 'OK' if ok else 'FAIL'))
    return ok

if __name__ == '__main__':
    a = sys.argv[1:]
    for i in range(0, len(a), 2):
        measure(a[i], int(a[i + 1]))
