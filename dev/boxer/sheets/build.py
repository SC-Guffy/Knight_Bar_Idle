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
    """③ 편집 방식 (2026-10-14): 스트라이커 시트의 고유 프레임 28장 + 챔피언 변형 2장(기합)을 edit-images-v2(edit_with_reference, 기준 = v2fin-champion)로
    챔피언 외형으로 바꿔 같은 자세·같은 프레임 수로 조립한다. eA = 대기·걷기·돌진·잽·스트레이트, eB = 기 모으기·어퍼·피격·쓰러짐·앉기·각성 키."""
    pal, V, G, T, R = kit('champion')
    a = lambda i, **k: T(G('eA', i), **k)
    b = lambda i, **k: T(G('eB', i), **k)
    A = {}
    i1 = a(0)
    A['idle'] = dict(frames=[i1, bob(i1, 46, 1), bob(i1, 46, 1), i1], fps=6, loop=True)
    A['guard'] = dict(frames=[R, bob(R, 46, 1), bob(R, 46, 1), R], fps=8, loop=True)
    A['walk'] = dict(frames=[a(i, mode='ground') for i in range(1, 7)], fps=10, loop=True)
    A['dash'] = dict(frames=[a(7), a(8)], fps=12, loop=True)
    jab, j2, st, s2 = a(9, dx=-3), a(10), a(11, dx=-2), a(12)
    ch = [b(i) for i in range(4)]
    up = b(4)
    A['atkA'] = dict(frames=[shift(bob(R, 46, 1), -1, 0), jab, jab, j2], fps=14, loop=False, hit=1)
    A['atkB'] = dict(frames=[ch[0], st, st, s2], fps=14, loop=False, hit=1)
    A['charge'] = dict(frames=ch, fps=10, loop=True)
    A['release'] = dict(frames=[ch[1], st, st], fps=12, loop=False, hit=1)
    A['skillA'] = dict(frames=[jab, j2, st, s2], fps=14, loop=True, hit=0)
    A['skillB'] = dict(frames=[ch[2], up, up, R], fps=14, loop=False, hit=1)
    fl, ar = b(13), b(14)
    # 각성: 웅크려 모음 → 가슴 펴며 기합 → 두 팔 번쩍 → 유지(들썩) → 유지 → 기합 자세
    A['awaken'] = dict(frames=[ch[3], fl, ar, bob(ar, 46, 1), ar, fl], fps=10, loop=False)
    h = b(5)
    A['hurt'] = dict(frames=[shift(h, -1, 0), h], fps=12, loop=False)
    A['death'] = dict(frames=[b(i, mode='ground') for i in range(6, 11)], fps=8, loop=False)
    A['sit'] = dict(frames=[b(11), b(12)], fps=2, loop=True)
    return A, BASE + ['awaken'] + TAIL, ()


def shrink(im, ratio):
    """키가 큰 키 자세를 기준 키에 맞춰 nearest 로 줄인다 (발 기준 다시 맞춤은 T 에서)."""
    bb = im.getbbox(); c = im.crop(bb)
    c = c.resize((max(1, round(c.width * ratio)), max(1, round(c.height * ratio))), Image.NEAREST)
    o = Image.new('RGBA', (64, 64)); o.alpha_composite(c, (32 - c.width // 2, 59 - c.height)); return o


def tempest():
    """③ 편집 방식: 킥복서 시트 고유 프레임 28장을 edit-images-v2(기준 = v2fin-tempest)로 템페스트 외형으로. 각성 키는 pixen 편집."""
    pal, V, G, T, R = kit('tempest')
    a = lambda i, **k: T(G('eA', i), **k)
    b = lambda i, **k: T(G('eB', i), **k)
    A = {}
    i1, g = a(0), a(14)   # 대기 / 전투 대기(무릎 든 자세 — 기준 그림의 발밑 회오리 없이 다른 프레임과 맞춘다)
    A['idle'] = dict(frames=[i1, bob(i1, 45, 1), bob(i1, 45, 1), i1], fps=6, loop=True)
    A['guard'] = dict(frames=[g, bob(g, 45, 1), bob(g, 45, 1), g], fps=8, loop=True)
    A['walk'] = dict(frames=[a(i, mode='ground') for i in range(1, 7)], fps=10, loop=True)
    A['dash'] = dict(frames=[a(7), a(8)], fps=12, loop=True)
    fr, rd, pu, fl, sp = a(9), a(10), a(11), a(12), a(13)
    ch = [b(i) for i in range(4)]
    A['atkA'] = dict(frames=[g, fr, fr, g], fps=14, loop=False, hit=1)
    A['atkB'] = dict(frames=[ch[0], rd, rd, g], fps=14, loop=False, hit=1)
    A['charge'] = dict(frames=ch, fps=10, loop=True)
    A['release'] = dict(frames=[ch[1], pu, pu], fps=12, loop=False, hit=1)
    A['skillA'] = dict(frames=[ch[2], shift(fl, 0, -6), shift(fl, 0, -10), shift(fl, 0, -5)], fps=14, loop=False, hit=2)
    A['skillB'] = dict(frames=[sp, rd, sp, rd], fps=14, loop=True, hit=1)
    aw = T(G('eC', 0))  # pixen 키(k-awaken)를 40/46 로 줄인 뒤 edit-images-v2 로 다시 칠함
    A['awaken'] = dict(frames=[ch[3], ch[0], aw, bob(aw, 45, 1), aw, g], fps=10, loop=False)
    A['hurt'] = dict(frames=[b(4), b(5)], fps=12, loop=False)
    A['death'] = dict(frames=[b(i, mode='ground') for i in range(6, 11)], fps=8, loop=False)
    A['sit'] = dict(frames=[b(11), b(12)], fps=2, loop=True)
    return A, BASE + ['awaken'] + TAIL, ('atkA', 'atkB', 'skillA', 'skillB')


def regild(im):
    """eB 프레임의 옅은 고리(황갈·흰·크림)를 첫 묶음의 진한 금색 램프로 손으로 다시 칠한다 (PixelLab 호출 없음).
    크림색 칸으로 원을 맞추고(최소제곱), 반지름 ±2.5 띠 안의 고리 색만 바꾼다: 황갈 → 어두운 금, 흰·크림 → 금."""
    im = im.copy(); px = im.load()
    TAN, WHITE, PALE, GOLD, DGOLD = (191, 148, 113), (246, 248, 251), (250, 229, 144), (255, 219, 110), (244, 200, 80)
    pts = [(x, y) for y in range(64) for x in range(64) if px[x, y][3] and px[x, y][:3] == PALE]
    if len(pts) < 8: return im
    # 최소제곱 원 맞춤 (Kasa): [2x 2y 1]·[cx cy c0] = x²+y² 의 정규방정식을 크라메르로 푼다
    rows = [(2 * x, 2 * y, 1.0, x * x + y * y) for x, y in pts]
    M = [[sum(r_[i] * r_[j] for r_ in rows) for j in range(3)] for i in range(3)]
    v = [sum(r_[i] * r_[3] for r_ in rows) for i in range(3)]
    det = lambda m: (m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0])
                     + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]))
    D = det(M)
    sol = [det([[v[i] if j == k else M[i][j] for j in range(3)] for i in range(3)]) / D for k in range(3)]
    cx, cy, c0 = sol; r = (c0 + cx * cx + cy * cy) ** 0.5
    for y in range(64):
        for x in range(64):
            c = px[x, y]
            if not c[3] or c[:3] not in (TAN, WHITE, PALE, GOLD): continue
            if abs(((x - cx) ** 2 + (y - cy) ** 2) ** 0.5 - r) <= 2.5:
                px[x, y] = (DGOLD if c[:3] == TAN else GOLD) + (255,)
    return im


def grandmaster():
    """③ 편집 방식: 기공사 시트 고유 프레임 24장을 edit-images-v2(기준 = v2fin-grandmaster)로 그랜드마스터 외형으로. 등 뒤 고리가 몸과 떨어져 있어 main=False. 각성 키는 pixen 편집."""
    pal, V, G, T, R = kit('grandmaster')
    a = lambda i, **k: T(G('eA', i), main=False, **k)
    b = lambda i, **k: regild(T(G('eB', i), main=False, **k))
    A = {}
    i1 = a(0)
    A['idle'] = dict(frames=[i1, bob(i1, 44, 1), bob(i1, 44, 1), i1], fps=6, loop=True)
    A['guard'] = dict(frames=[R, bob(R, 44, 1), bob(R, 44, 1), R], fps=8, loop=True)
    A['walk'] = dict(frames=[a(i, mode='ground') for i in range(1, 7)], fps=10, loop=True)
    A['dash'] = dict(frames=[a(7), a(8)], fps=12, loop=True)
    pm, db = a(9), a(10)
    ch = [a(i) for i in range(11, 15)]
    bar = b(0)
    A['atkA'] = dict(frames=[ch[0], pm, pm, R], fps=14, loop=False, hit=1)
    A['atkB'] = dict(frames=[ch[1], db, db, R], fps=14, loop=False, hit=1)
    A['charge'] = dict(frames=ch, fps=10, loop=True)
    A['release'] = dict(frames=[ch[2], pm, pm], fps=12, loop=False, hit=1)
    A['skillA'] = dict(frames=[ch[3], db, shift(db, 1, 0), shift(db, 1, 0)], fps=14, loop=False, hit=2)
    A['skillB'] = dict(frames=[bar, bob(bar, 44, 1), bob(bar, 44, 1), bar], fps=14, loop=True, hit=0)
    aw = T(G('k-awaken'), main=False)
    A['awaken'] = dict(frames=[ch[3], ch[0], aw, bob(aw, 44, 1), aw, R], fps=10, loop=False)
    A['hurt'] = dict(frames=[b(1), b(2)], fps=12, loop=False)
    A['death'] = dict(frames=[b(i, mode='ground') for i in range(3, 8)], fps=8, loop=False)
    s = b(8)
    A['sit'] = dict(frames=[s, bob(s, 50, 1)], fps=2, loop=True)
    # eB 프레임은 고리가 옅게(흰색 쪽으로) 나와 자동 head 가 고리 꼭대기를 잡는다 → 같은 자세인 기공사 시트의 점을 그대로 쓴다
    q = json.load(open(os.path.join(ROOT, 'src', 'sprites', 'qigong.json'), encoding='utf-8'))['pts']
    for an in ('skillB', 'hurt', 'death', 'sit'):
        A[an]['pts'] = dict(enumerate(q[an]))
    return A, BASE + ['awaken'] + TAIL, ()


if __name__ == '__main__':
    cls = sys.argv[1]
    A, order, kick = globals()[cls]()
    skip = None
    if cls == 'grandmaster':  # 금빛 고리(노랑 계열)·외곽선은 hand/head 계산에서 뺀다 — 고리 안쪽 몸만 남김
        GOLD = {(244, 200, 80), (250, 229, 144), (255, 210, 87), (255, 219, 110), (11, 13, 20)}
        skip = lambda c: c[:3] in GOLD
    write_sheet(cls, A, order, kick, skip)
