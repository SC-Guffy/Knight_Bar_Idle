# 로컬 계획: a.png(기본 연산 결과) -> 목표 픽셀 -> workbench patch_pixels 목록
import sys, json, numpy as np
from PIL import Image
a = np.asarray(Image.open(sys.argv[1]).convert('RGBA')).copy()
FADE = int(sys.argv[3]) if len(sys.argv) > 3 else 4
N=(14,28,84); b=(1,62,180); B=(14,106,206); n=(2,30,145); k=(2,10,98); W=(1,254,246)
cyan = {(0,253,236),(1,254,246),(1,249,245),(0,199,223)}
blues = {b,B,n,k}
out = a.copy(); H=48; FW=96
STX=(int(sys.argv[4]),int(sys.argv[5]),int(sys.argv[6])) if len(sys.argv)>6 else (14,30,48)
STARS = {0:[(22,8),(40,10)], 1:[(25,9),(45,11)], 2:[(23,8),(44,10)], 3:[(26,9),(42,11)], 4:[(24,8),(46,10)]}
changes=[]
for i in range(5):
    f = out[:, i*FW:(i+1)*FW]
    op = f[...,3] >= 24
    for x in range(FW):
        col = [tuple(f[y,x,:3]) if op[y,x] else None for y in range(H)]
        ys = [y for y in range(H) if col[y] in cyan]
        yc = ys[0] if ys else H
        for y in range(yc):
            c = col[y]
            if c in blues:
                f[y,x,:3] = b if y >= yc - FADE else N
        # 몸통 안 진한 줄 밝히기
        for y in range(yc, H):
            c = col[y]
            if c in (n, k): f[y,x,:3] = B
    # 별: 사방이 남색인 자리, 가로로 고르게 3곳 (프레임마다 반짝임 크기 교대)
    op = f[...,3] >= 24
    isN = op & np.all(f[...,:3] == N, -1)
    ok = isN.copy()
    for dy,dx in ((-1,0),(1,0),(0,-1),(0,1),(-2,0),(2,0),(0,-2),(0,2)):
        ok &= np.roll(np.roll(isN,dy,0),dx,1)
    cand = list(zip(*np.nonzero(ok)))
    picks=[]
    for cx in (STX[0], STX[1], STX[2]):
        cs = sorted(cand, key=lambda p: abs(p[1]-cx) + 0.3*abs(p[0]-8))
        if cs and abs(cs[0][1]-cx) <= 6: picks.append(cs[0])
    for j,(y,x) in enumerate(picks):
        big = (i + j) % 2 == 0
        f[y,x,:3] = W
        if big:
            for dy,dx in ((-1,0),(1,0),(0,-1),(0,1)): f[y+dy,x+dx,:3] = W
    print(i, picks, file=sys.stderr)
Image.fromarray(out).save(sys.argv[2])
