# 검성 14차 97번 (2차: 쌍검 다시 그림)(검사 N2-23 init 색 바꿈 + denoise 0.86) 46칸 수리 (스크립트, PixelLab 0): 비평 n14-s3 "뿔이 금 초승달이 아님"
#  + 검사에서 넘어온 망토(왼쪽 아래 검은 덩어리·붉은 끝)를 지워 실루엣을 검사와 떼고 검정 덩어리를 없앤다
#  python -I -B fix_bm14.py → design/pl2/fix-blademaster-n14.png, design/_bm14-fix-x8.png
import os
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__)); D = os.path.join(HERE, 'design')
OUT = (8, 12, 20, 255); GL, GM, GD = (252, 222, 110, 255), (232, 180, 60, 255), (176, 122, 36, 255)
q = lambda c: tuple(v // 8 * 8 for v in c[:3])
if __name__ == '__main__':
    src = Image.open(os.path.join(D, 'px', 'blademaster-N14-97-h46.png')).convert('RGBA'); im = src.copy(); P = im.load(); W, H = im.size
    for y in range(0, 11):                                    # 뿔 → 금 3단
        for x in list(range(9, 16)) + list(range(29, 35)):
            c = q(P[x, y]) if P[x, y][3] else None
            if c == (200, 200, 192): P[x, y] = GL
            elif c == (144, 128, 136): P[x, y] = GD
            elif c == (208, 40, 40): P[x, y] = GM
    for y in range(24, 44):                                   # 망토 지우기
        for x in range(0, 11):
            P[x, y] = (0, 0, 0, 0)
    add = [(x, y) for y in range(24, 44) for x in range(0, 13) if not P[x, y][3] and any(0 <= x + a < W and P[x + a, y + b][3] and P[x + a, y + b][:3] != OUT[:3] for a, b in ((1, 0), (0, 1), (0, -1)))]
    for p in add: P[p] = OUT
    # 2차 (비평 n14-f B: 쌍검이 1도트 선이라 안 읽힘 / 로드맵: IoU 0.6 아래로) → 앞손 가로 칼을 지우고 앞위로 치켜든 2칸 카타나, 아래 칼은 날등 한 줄 더
    import math
    LIT, MID, DRK, GOLD = (248, 248, 248, 255), (176, 186, 210, 255), (72, 88, 128, 255), (232, 180, 60, 255)
    for y in range(31, 36):
        for x in range(31, W):
            if P[x, y][3]: P[x, y] = (0, 0, 0, 0)
    g = (29, 33); a = math.radians(-58); u = (math.cos(a), math.sin(a)); n = (-u[1], u[0]); pts = {}
    for t in range(2, 19):
        cv = 0.012 * t * t                                  # 곡도: 끝으로 갈수록 등 쪽으로 휨
        for sd, col in ((0, LIT), (1, MID)):
            x, y = round(g[0] + u[0] * t + n[0] * (sd + cv)), round(g[1] + u[1] * t + n[1] * (sd + cv))
            if 0 <= x < W and 0 <= y < H: pts[(x, y)] = col
    for sd in (-1, 0, 1, 2): pts[(round(g[0] + u[0] * 1.5 + n[0] * sd), round(g[1] + u[1] * 1.5 + n[1] * sd))] = GOLD
    for p_, c in pts.items(): P[p_] = c
    for (x, y) in list(pts):
        for a2, b2 in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            q2 = (x + a2, y + b2)
            if 0 <= q2[0] < W and 0 <= q2[1] < H and q2 not in pts and not P[q2][3]: P[q2] = OUT
    for y in range(36, 45):                                   # 아래 칼: 흰 날 바로 아래 칸에 날등(어두운 청) 한 줄
        for x in range(15, W):
            if q(P[x, y]) == (248, 248, 248) and y + 1 < H and (not P[x, y + 1][3] or P[x, y + 1][:3] == OUT[:3]):
                P[x, y + 1] = DRK
    im.save(os.path.join(D, 'pl2', 'fix-blademaster-n14.png'))
    S = 8; b = Image.new('RGBA', ((W * 2 + 6) * S, H * S), (38, 40, 50, 255))
    b.alpha_composite(src.resize((W * S, H * S), Image.NEAREST)); b.alpha_composite(im.resize((W * S, H * S), Image.NEAREST), ((W + 6) * S, 0))
    b.save(os.path.join(D, '_bm14-fix-x8.png')); print('ok')
