# 2·3차 시트 조립: python -I build.py <cls>  → src/sprites/<cls>.png/.json, 미리보기, GIF
#   G(name, i) = work/<cls>/<name>-<i>.png (animate / pixen 결과), V(n) = v2 변형, R = 기준 그림 (v2fin)
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from common import *

BASE = ['idle', 'guard', 'walk', 'dash', 'atkA', 'atkB', 'charge', 'release', 'skillA', 'skillB']
TAIL = ['hurt', 'death', 'sit']
VSRC = {'striker': 'striker_g'}


def kit(cls):
    pal = palette(cls)
    W = os.path.join(HERE, 'work', cls)
    vs = VSRC.get(cls, cls)
    V = lambda n: load(os.path.join(BOX, 'v2', f'{vs}-k1-{n}.png'))
    G = lambda name, i=1: load(os.path.join(W, f'{name}-{i}.png'))
    def T(im, mode='feet', dx=0, dy=0, main=True, drop=None):
        return align(tidy(im, pal, main=main, drop=drop), mode, dx, dy)
    return pal, V, G, T, ref(cls)


def striker():
    pal, V, G, T, R = kit('striker')
    A = {}
    i1 = T(G('idle', 1))
    A['idle'] = dict(frames=[i1, bob(i1, 46, 1), bob(i1, 46, 1), i1], fps=6, loop=True)
    A['guard'] = dict(frames=[R, bob(R, 46, 1), bob(R, 46, 1), R], fps=8, loop=True)
    A['walk'] = dict(frames=[T(G('walk', i), 'ground') for i in range(1, 7)], fps=10, loop=True)
    A['dash'] = dict(frames=[T(G('dash', i)) for i in (3, 4)], fps=12, loop=True)
    jab, st, up = T(G('k-jab'), dx=-3), T(G('k-straight'), dx=-2), T(G('k-upper2'))  # 주먹이 프레임 밖으로 잘리지 않게 왼쪽으로
    A['atkA'] = dict(frames=[shift(bob(R, 46, 1), -1, 0), jab, jab, T(V(47))], fps=14, loop=False, hit=1)
    A['atkB'] = dict(frames=[T(G('charge', 1)), st, st, T(V(39))], fps=14, loop=False, hit=1)
    A['charge'] = dict(frames=[T(G('charge', i)) for i in (1, 2, 3, 4)], fps=10, loop=True)
    A['release'] = dict(frames=[T(G('charge', 2)), st, st], fps=12, loop=False, hit=1)
    # 빠른 연타 (반복): 잽 → 회수 → 스트레이트 → 회수
    A['skillA'] = dict(frames=[jab, T(V(47)), st, T(V(39))], fps=14, loop=True, hit=0)
    # 어퍼컷: 웅크림 → 솟구침 → 유지 → 가드
    A['skillB'] = dict(frames=[T(G('charge', 3)), up, up, R], fps=14, loop=False, hit=1)
    h = T(G('hurt', 1))
    A['hurt'] = dict(frames=[shift(h, -1, 0), h], fps=12, loop=False)
    A['death'] = dict(frames=[T(G('death', i), 'ground') for i in (2, 3, 4, 5, 6)], fps=8, loop=False)
    A['sit'] = dict(frames=[T(G('sit', 3)), T(G('sit', 4))], fps=2, loop=True)
    return A, BASE + TAIL, ()


def kickboxer():
    pal, V, G, T, R = kit('kickboxer')
    A = {}
    i1 = T(G('idle', 1))
    A['idle'] = dict(frames=[i1, bob(i1, 45, 1), bob(i1, 45, 1), i1], fps=6, loop=True)
    A['guard'] = dict(frames=[R, bob(R, 45, 1), bob(R, 45, 1), R], fps=8, loop=True)
    A['walk'] = dict(frames=[T(G('walk', i), 'ground') for i in range(1, 7)], fps=10, loop=True)
    A['dash'] = dict(frames=[T(G('dash', i)) for i in (3, 4)], fps=12, loop=True)
    fr, rd, fl, sp = T(G('k-front')), T(G('k-round')), T(G('k-fly')), T(G('k-spin'))
    # 앞차기: 무릎 든 기준 자세 → 뻗음 → 유지 → 복귀
    A['atkA'] = dict(frames=[R, fr, fr, R], fps=14, loop=False, hit=1)
    A['atkB'] = dict(frames=[T(G('charge', 1)), rd, rd, R], fps=14, loop=False, hit=1)
    A['charge'] = dict(frames=[T(G('charge', i)) for i in (1, 2, 3, 4)], fps=10, loop=True)
    A['release'] = dict(frames=[T(G('charge', 2)), T(V(48)), T(V(48))], fps=12, loop=False, hit=1)
    # 날아 차기: 웅크림 → 공중(그림을 위로) → 최고점 차기 → 내려옴
    A['skillA'] = dict(frames=[T(G('charge', 3)), shift(fl, 0, -6), shift(fl, 0, -10), shift(fl, 0, -5)], fps=14, loop=False, hit=2)
    # 회전 발차기 (반복): 등 돌림 → 뻗음
    A['skillB'] = dict(frames=[sp, rd, sp, rd], fps=14, loop=True, hit=1)
    A['hurt'] = dict(frames=[T(G('hurt', 3)), T(G('hurt', 4))], fps=12, loop=False)
    A['death'] = dict(frames=[T(G('death', i), 'ground') for i in (2, 3, 4, 5, 6)], fps=8, loop=False)
    A['sit'] = dict(frames=[T(G('sit', 3)), T(G('sit', 4))], fps=2, loop=True)
    return A, BASE + TAIL, ('atkA', 'atkB', 'skillA', 'skillB')


def qigong():
    pal, V, G, T, R = kit('qigong')
    A = {}
    i1 = T(G('idle', 1))
    A['idle'] = dict(frames=[i1, bob(i1, 44, 1), bob(i1, 44, 1), i1], fps=6, loop=True)
    A['guard'] = dict(frames=[R, bob(R, 44, 1), bob(R, 44, 1), R], fps=8, loop=True)
    A['walk'] = dict(frames=[T(G('walk', i), 'ground') for i in range(1, 7)], fps=10, loop=True)
    A['dash'] = dict(frames=[T(G('dash', i)) for i in (3, 4)], fps=12, loop=True)
    pm, db, bar = T(G('k-palm')), T(G('k-double')), T(G('k-barrier'))
    ch = [T(G('charge', i)) for i in (1, 2, 3, 4)]
    # 한 손 장타: 당김 → 뻗음 → 유지 → 기준 자세
    A['atkA'] = dict(frames=[ch[0], pm, pm, R], fps=14, loop=False, hit=1)
    # 쌍장: 허리로 당김 → 두 손 뻗음 → 유지 → 기준 자세
    A['atkB'] = dict(frames=[ch[1], db, db, R], fps=14, loop=False, hit=1)
    A['charge'] = dict(frames=ch, fps=10, loop=True)
    A['release'] = dict(frames=[ch[2], pm, pm], fps=12, loop=False, hit=1)
    # 장풍 밀기: 웅크려 모음 → 두 손 앞으로 → 밀어붙임(앞으로 1칸) → 유지
    A['skillA'] = dict(frames=[ch[3], db, shift(db, 1, 0), shift(db, 1, 0)], fps=14, loop=False, hit=2)
    # 기막 자세 (반복): 두 손 모아 막 — 살짝 들썩
    A['skillB'] = dict(frames=[bar, bob(bar, 44, 1), bob(bar, 44, 1), bar], fps=14, loop=True, hit=0)
    A['hurt'] = dict(frames=[T(G('hurt', 1)), T(G('hurt', 2))], fps=12, loop=False)
    A['death'] = dict(frames=[T(G('death', i), 'ground') for i in (2, 3, 4, 5, 6)], fps=8, loop=False)
    s = T(G('k-sit'))
    A['sit'] = dict(frames=[s, bob(s, 50, 1)], fps=2, loop=True)
    return A, BASE + TAIL, ()


def champion():
    """PixelLab 상한에 닿아 walk 만 animate 로 뽑고 나머지는 v2 변형 64장(champion-k1)에서 조립 (2026-10-14)."""
    pal, V, G, T, R = kit('champion')
    A = {}
    i1 = T(V(9))
    A['idle'] = dict(frames=[i1, bob(i1, 46, 1), bob(i1, 46, 1), i1], fps=6, loop=True)
    A['guard'] = dict(frames=[R, bob(R, 46, 1), bob(R, 46, 1), R], fps=8, loop=True)
    A['walk'] = dict(frames=[T(G('walk', i), 'ground') for i in range(1, 7)], fps=10, loop=True)
    A['dash'] = dict(frames=[T(V(29)), T(V(30))], fps=12, loop=True)
    cr, jab, jab2, st, up1, up2, low = T(V(12)), T(V(23)), T(V(25)), T(V(27)), T(V(33)), T(V(34)), T(V(42))
    A['atkA'] = dict(frames=[cr, jab, jab, R], fps=14, loop=False, hit=1)
    A['atkB'] = dict(frames=[cr, st, st, jab2], fps=14, loop=False, hit=1)
    A['charge'] = dict(frames=[cr, bob(cr, 46, 1), cr, bob(cr, 46, 1)], fps=10, loop=True)
    A['release'] = dict(frames=[cr, st, st], fps=12, loop=False, hit=1)
    A['skillA'] = dict(frames=[jab, T(V(21)), jab2, st], fps=14, loop=True, hit=0)
    A['skillB'] = dict(frames=[low, up1, up2, R], fps=14, loop=False, hit=1)
    fl, ar = T(V(51)), T(V(54))
    A['awaken'] = dict(frames=[cr, fl, ar, bob(ar, 46, 1), ar, fl], fps=10, loop=False)
    h = T(V(45))
    A['hurt'] = dict(frames=[shift(h, -1, 0), h], fps=12, loop=False)
    A['death'] = dict(frames=[h, T(V(46)), T(V(47)), T(V(15)), T(V(15))], fps=8, loop=False)
    s = T(V(47))
    A['sit'] = dict(frames=[s, bob(s, 50, 1)], fps=2, loop=True)
    return A, BASE + ['awaken'] + TAIL, ()


if __name__ == '__main__':
    cls = sys.argv[1]
    A, order, kick = globals()[cls]()
    write_sheet(cls, A, order, kick)
