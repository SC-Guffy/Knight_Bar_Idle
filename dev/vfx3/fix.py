# ⑤-3 텍스처 정리 도구 (PixelLab 호출 없음)
#   python -I dev/vfx3/fix.py undark <in> <out> [thr=70]       어두운 칸(밝기 thr 미만)을 모두 지우고 바깥 외곽선을 다시 두른다 (어두운 배경판 제거)
#   python -I dev/vfx3/fix.py unbg <in> <out>                  모서리 색과 비슷한 칸을 테두리에서부터 지운다 (불투명 바탕판 제거)
#   python -I dev/vfx3/fix.py lines <in> <out>                 격자선만 남긴다 (f14: 자홍 선 = r-g 큰 칸)
#   python -I dev/vfx3/fix.py rot <in> <out> <deg>             nearest 회전 (캔버스 크기 유지)
#   python -I dev/vfx3/fix.py sheet <out> [--min n] f0 f1 ...  프레임 → 가로 시트 (같은 크기, 반투명·작은 덩어리 지움)
import sys, os
from collections import deque
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pl3 import outline, OUTLINE


def lum(c): return 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2]


def undark(im, thr):
    px = im.load(); w, h = im.size
    for y in range(h):
        for x in range(w):
            if px[x, y][3] and lum(px[x, y]) < thr: px[x, y] = (0, 0, 0, 0)
    return outline(im)


def unbg(im):
    px = im.load(); w, h = im.size
    # 바탕판 색들: 테두리 칸에 가장 많은 색 몇 가지 (바탕판이 두세 단 명암일 때가 있다)
    from collections import Counter
    border = Counter(px[x, y][:3] for x in range(w) for y in (0, h - 1) if px[x, y][3])
    border.update(px[x, y][:3] for y in range(h) for x in (0, w - 1) if px[x, y][3])
    bgs = [c for c, n in border.most_common(6) if n >= 2]
    near = lambda c: c[3] and any(abs(c[0] - b[0]) + abs(c[1] - b[1]) + abs(c[2] - b[2]) < 24 for b in bgs)
    q = deque((x, y) for x in range(w) for y in (0, h - 1)); q.extend((x, y) for y in range(h) for x in (0, w - 1)); seen = set()
    while q:
        p = q.popleft()
        if p in seen or not (0 <= p[0] < w and 0 <= p[1] < h): continue
        seen.add(p)
        if near(px[p]) or not px[p][3]:
            px[p] = (0, 0, 0, 0); q.extend(((p[0] + 1, p[1]), (p[0] - 1, p[1]), (p[0], p[1] + 1), (p[0], p[1] - 1)))
    return im


def lines(im):
    px = im.load(); w, h = im.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if not (a and r - g > 25 and r > 60): px[x, y] = (0, 0, 0, 0)
            else: px[x, y] = (min(255, r * 2), min(255, g * 2), min(255, b * 2), 255)
    return im


def clean(im, mn):
    px = im.load(); w, h = im.size
    for y in range(h):
        for x in range(w):
            if px[x, y][3] < 128: px[x, y] = (0, 0, 0, 0)
    seen = set()
    for y in range(h):
        for x in range(w):
            if px[x, y][3] and (x, y) not in seen:
                st = [(x, y)]; seen.add((x, y)); c = []
                while st:
                    a, b = st.pop(); c.append((a, b))
                    for dx in (-1, 0, 1):
                        for dy in (-1, 0, 1):
                            n = (a + dx, b + dy)
                            if 0 <= n[0] < w and 0 <= n[1] < h and n not in seen and px[n][3]: seen.add(n); st.append(n)
                if len(c) < mn:
                    for p in c: px[p] = (0, 0, 0, 0)
    return im


if __name__ == '__main__':
    a = sys.argv[1:]; cmd = a[0]
    if cmd == 'sheet':
        out = a[1]; rest = a[2:]; mn = 3
        if rest and rest[0] == '--min': mn = int(rest[1]); rest = rest[2:]
        fr = [clean(Image.open(f).convert('RGBA'), mn) for f in rest]
        W, H = fr[0].size
        sh = Image.new('RGBA', (W * len(fr), H))
        for i, f in enumerate(fr): sh.alpha_composite(f.resize((W, H), Image.NEAREST) if f.size != (W, H) else f, (i * W, 0))
        sh.save(out); print('sheet', out, len(fr), 'frames', W, 'x', H)
    else:
        im = Image.open(a[1]).convert('RGBA')
        if cmd == 'undark': im = undark(im, int(a[3]) if len(a) > 3 else 70)
        elif cmd == 'unbg': im = unbg(im)
        elif cmd == 'lines': im = lines(im)
        elif cmd == 'rot': im = im.rotate(float(a[3]), Image.NEAREST)
        im.save(a[2]); print(cmd, a[2])
