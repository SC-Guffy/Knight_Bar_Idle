# 마법사 계열 시트 한 번에 (0회 — PixelLab 원형 애니가 나온 뒤): 원형 프레임 → 7종 입히기 → cast 키 자세 고르기 → 시트 조립
#  python -I -B pipeline.py [--src work/mq] [--out ../../src/sprites] [--fake]
#   --src: 원형 애니 프레임 <동작>-<i>.png (batch_mq.py 결과). PixelLab 이 첫 프레임을 같이 돌려주면(프레임 수 + 1장) 첫 장은 뺀다
#   --fake: 원형 애니 대신 각도 시험 가짜 프레임(마네킹 지팡이만 돌림)으로 끝까지 돌려 본다 → 출력 stub-fake/ (게임 연결 시험용)
#  cast: 프레임마다 지팡이 각도(손 점→끝)를 재서 키 자세 bowA(−1.4·−0.7·−0.2·0.7·1.2)의 지팡이 각도(staffAngle = −1.25 + 1.6·bowA)에
#        가장 가까운 프레임을 고른다 → cast.key = 'bowA', cast.val = 키 자세 값
import os, sys, math, re, json, shutil
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE); sys.path.insert(0, os.path.join(HERE, '..', 'sheets-common'))
import mannequin as m
import build
from wpn import grip_tip

KEYS = [-1.4, -0.7, -0.2, 0.7, 1.2]
MOVES = ['idle', 'walk', 'atkA', 'atkB', 'cast']
FC = {'idle': 4, 'walk': 8, 'atkA': 4, 'atkB': 4, 'cast': 8}
RAMP_PAL = [c + (255,) for r in m.RAMP.values() for c in r] + [m.OUT_C]


def frames(src, name):
    fs = sorted((f for f in os.listdir(src) if re.fullmatch(rf'{name}-\d+\.png', f)), key=lambda f: int(f.rsplit('-', 1)[1][:-4]))
    ims = [Image.open(os.path.join(src, f)).convert('RGBA') for f in fs]
    if len(ims) == FC[name] + 1: ims = ims[1:]                  # 첫 프레임(입력) 사본은 뺀다
    out = []
    for im in ims:
        if im.size != (96, 96):                                 # 칸이 다르면 발 바닥 가운데를 맞춰 96 칸에
            o = Image.new('RGBA', (96, 96)); bb = im.getbbox()
            o.paste(im, (build.FOOT[0] - (bb[0] + bb[2]) // 2, build.FOOT[1] - bb[3] + 1)); im = o
        out.append(keep_main(build.tidy(im, RAMP_PAL)))         # 부위색으로 고정 (애니가 색을 조금 바꿔도) + 몸과 떨어진 덩어리(애니가 멋대로 그린 빛) 버림
    return out


def keep_main(im):
    """8방향으로 이어진 가장 큰 덩어리만 남긴다. 몸에 붙은 빛줄기는 구슬색으로 잡혀 지팡이 덧그리기 때 지워진다"""
    px = im.load(); W, H = im.size; seen = set(); comps = []
    for y in range(H):
        for x in range(W):
            if px[x, y][3] and (x, y) not in seen:
                st, c = [(x, y)], []; seen.add((x, y))
                while st:
                    p = st.pop(); c.append(p)
                    for a in (-1, 0, 1):
                        for b in (-1, 0, 1):
                            q = (p[0] + a, p[1] + b)
                            if 0 <= q[0] < W and 0 <= q[1] < H and q not in seen and px[q][3]: seen.add(q); st.append(q)
                comps.append(c)
    big = max(comps, key=len) if comps else []
    for c in comps:
        if c is not big:
            for p in c: px[p] = (0, 0, 0, 0)
    return im


def staff_angle(F):
    mask, stray, glove, g, t = m.staff_grip(m.classify(F))
    if len(mask) < 6: return None
    return math.atan2(t[1] - g[1], t[0] - g[0])


def pick_cast(fr):
    angs = [staff_angle(F) for F in fr]
    out = []
    for b in KEYS:
        want = -1.25 + 1.6 * b
        i = min((i for i, a in enumerate(angs) if a is not None), key=lambda i: abs(math.atan2(math.sin(angs[i] - want), math.cos(angs[i] - want))))
        out.append(fr[i])
    return out, angs


def fake():
    """각도 시험 가짜 프레임: 마네킹 지팡이만 돌림 (팔은 그대로) — 연결 시험용"""
    import angle_test as at
    base = at.base
    A = {'idle': [at.M] * 4, 'walk': [at.M] * 8, 'atkA': [at.frame(d) for d in (base, -40, -10, -10)],
         'atkB': [at.frame(d) for d in (-150, -100, 20, 40)], 'cast': [at.frame(d) for d in (-160, -136, -100, -90, -30, -8, 20, 38)]}
    return A


def main():
    a = sys.argv
    fk = '--fake' in a
    src = a[a.index('--src') + 1] if '--src' in a else os.path.join(HERE, 'work', 'mq')
    out = a[a.index('--out') + 1] if '--out' in a else (os.path.join(HERE, 'stub-fake') if fk else os.path.join(HERE, '..', '..', 'src', 'sprites'))
    A = fake() if fk else {k: frames(src, k) for k in MOVES}
    A['cast'], angs = pick_cast(A['cast'])
    print('cast 지팡이 각도(도):', [None if x is None else round(math.degrees(x)) for x in angs])
    head = m.electro_head()
    for cls in m.IDS:
        d = os.path.join(HERE, 'work', cls, 'pick'); shutil.rmtree(d, ignore_errors=True); os.makedirs(d)
        for k, fr in A.items():
            for i, F in enumerate(fr):
                m.dress(cls, F, head_img=head if cls == 'electromancer' else None).save(os.path.join(d, f'{k}-{i}.png'))
        build.build(cls, d, out, KEYS)


if __name__ == '__main__':
    main()
