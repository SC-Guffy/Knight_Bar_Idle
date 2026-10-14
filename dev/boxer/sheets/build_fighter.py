# 파이터 시트 조립: python -I build_fighter.py  → src/sprites/fighter.png/.json, 미리보기, GIF
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *

CLS = 'fighter'
pal = palette(CLS)
W = os.path.join(HERE, 'work', CLS)
V = lambda n: load(os.path.join(BOX, 'v2', f'fighter-k1-{n}.png'))
G = lambda name, i: load(os.path.join(W, f'{name}-{i}.png'))
T = lambda im, mode='feet', dx=0, dy=0: align(tidy(im, pal), mode, dx, dy)
R = ref(CLS)

A = {}
A['idle'] = dict(frames=[T(G('idle', i)) for i in (1, 2, 3, 4)], fps=6, loop=True)
A['guard'] = dict(frames=[R, bob(R, 46, 1), bob(R, 46, 1), R], fps=8, loop=True)
A['walk'] = dict(frames=[T(G('walk', i), 'ground') for i in range(1, 7)], fps=10, loop=True)
A['dash'] = dict(frames=[T(G('dash', i)) for i in (2, 4)], fps=12, loop=True)
# 잽: 예비(웅크려 당김) → 뻗음 → 뻗음 유지 → 가드 복귀
A['atkA'] = dict(frames=[T(V(16)), T(V(8)), T(V(48)), R], fps=14, loop=False, hit=1)
# 스트레이트: 턱 앞 장전 → 깊게 뻗음 → 유지 → 반쯤 회수
A['atkB'] = dict(frames=[T(V(26)), T(V(18)), T(V(19)), T(V(17))], fps=14, loop=False, hit=1)
A['charge'] = dict(frames=[T(G('charge', i)) for i in (1, 2, 3, 4)], fps=10, loop=True)
A['release'] = dict(frames=[T(V(16)), T(V(52)), T(V(18))], fps=12, loop=False, hit=1)
A['hurt'] = dict(frames=[T(erase(T(G('hurt', 3)), (18, 22, 23, 28))), T(V(41))], fps=12, loop=False)
A['death'] = dict(frames=[T(G('death', i), 'ground') for i in (2, 3, 4, 5, 6)], fps=8, loop=False)
s = T(V(44))
A['sit'] = dict(frames=[s, bob(s, 50, 1)], fps=2, loop=True)

ORDER = ['idle', 'guard', 'walk', 'dash', 'atkA', 'atkB', 'charge', 'release', 'hurt', 'death', 'sit']
if __name__ == '__main__':
    write_sheet(CLS, A, ORDER)
