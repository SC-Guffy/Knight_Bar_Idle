# 키 자세 평타 → 시트 프레임 (로드맵 승인 2026-10-18, 검사 12단계 B 방식): work/<cls>/key-<atk>-<k>-<v>.png (64칸 발 32,60)
#  → frames/<cls>/atkA-*, atkB-* (128칸, 발 = build.py CELL) 로 바꾸고 대기·걷기는 그대로 둔다. 걷기에서 지적된 프레임은 WALK_DROP 으로 뺀다.
#  시전 줄 = 새 평타 프레임 중 무기 각도(실루엣 열기 나머지 = 가는 구조로 직선 맞춤, 몸에서 먼 끝 쪽)가 cast val 에 가장 가까운 것.
#  모델이 창까지 몸과 같이 그린 그림만 쓴다 (코드 덧그리기 없음).
#   python -I -B key_assemble.py <cls>
import os, sys, json, math, glob, shutil
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE); sys.path.insert(0, os.path.join(HERE, '..', 'sheets-common'))
import build as B
from spear_keys import ATK
from wpn import line_fit

# 평타 프레임 순서: 'src' = 합격 정지 그림, 숫자 = 키 번호, (키, 안) 으로 안(0/1) 지정 가능
SEQ = {'default': [4, 1, 2, 3, 3, 4]}   # 원본(정지 그림)은 키와 인상이 달라 뺀다 — 마무리 키(대기 자세)로 시작·끝 (용황 시험 교훈)
# 용황: 합격 정지 그림(검은 머리)과 pixen 키(금발) 인상이 달라 원본을 빼고, 잘 나온 찌르기 키2 를 새 기준(dragonlord-key2-src64)으로 재편집한 대기·준비를 쓴다
#  (검수 k1 3.00: 얼굴·머리색 튐, 준비 키 발치 꼬리 모양). 재편집 '들기'는 창이 두 자루라 안 씀
SEQ_CLS = {'dragonlord': {'thrust': ['key-ready', 'key-windup', 'dragonlord-key2-src64', 3, 3, 'key-ready'],
                          'slam': ['key-ready', 2, 2, 3, 3, 'key-ready']}}
WALK_DROP = {'warlord': [4, 6], 'dragoon': [2]}                      # 검사 세션 점검: 전쟁군주 walk5·7, 용기병 walk3 (1부터 센 번호)


def key_img(cls, atk, k):
    if k == 'src': return Image.open(os.path.join(HERE, 'skel', f'{cls}-key-src64.png')).convert('RGBA')
    if isinstance(k, str):                                   # 이름 붙은 키: work/<cls>/<이름>-0.png (재편집분) 또는 skel/<이름>.png
        for p in (os.path.join(HERE, 'work', cls, f'{k}-0.png'), os.path.join(HERE, 'skel', f'{k}.png')):
            if os.path.exists(p): return Image.open(p).convert('RGBA')
        return None
    kk, v = (k if isinstance(k, tuple) else (k, 0))
    for vv in (v, 1 - v):
        p = os.path.join(HERE, 'work', cls, f'key-{atk}-{kk}-{vv}.png')
        if os.path.exists(p): return Image.open(p).convert('RGBA')
    return None


def to_cell(cls, im):
    """64칸(발 32,60) → 128칸 발 = CELL. 발 = 맨 아래 줄 가운데로 다시 잰다 (pixen 이 몸을 옮기기도 한다)"""
    S, (fx, fy) = B.CELL[cls]; bb = im.getbbox(); P = im.load()
    cx = 32                       # 가로는 64칸 가운데 고정 (pixen 이 캐릭터 자리를 대체로 지킨다 — 발 구간으로 재면 돌진·타격 자세에서 몸이 칸 밖으로 밀렸다)
    o = Image.new('RGBA', (S, S)); o.alpha_composite(im, (fx - cx, fy - (bb[3] - 1))); return o


def wpn_angle(im):
    """가는 구조(실루엣 열기 나머지)로 무기 직선 → 몸 가운데에서 먼 끝 쪽 각도(라디안)"""
    P = im.load(); W, H = im.size
    M = {(x, y) for y in range(H) for x in range(W) if P[x, y][3]}
    if not M: return 0.0
    ero = {(x, y) for (x, y) in M if all((x + u, y + v) in M for u in range(-2, 3) for v in range(-2, 3))}
    op = {(x + u, y + v) for (x, y) in ero for u in range(-2, 3) for v in range(-2, 3)}
    fy0 = max(y for _, y in M); thin = [p for p in M if p not in op and p[1] < fy0 - 4]
    if len(thin) < 8: return 0.0
    c, d, inl = line_fit(thin, tol=1.2)
    bx = sum(x for x, _ in M) / len(M); by = sum(y for _, y in M) / len(M)
    far = max(inl, key=lambda p: math.dist(p, (bx, by)))
    if (far[0] - c[0]) * d[0] + (far[1] - c[1]) * d[1] < 0: d = (-d[0], -d[1])
    return math.atan2(d[1], d[0])


def run(cls):
    dst = os.path.join(HERE, 'frames', cls)
    for f in glob.glob(os.path.join(dst, 'atk*.png')) + glob.glob(os.path.join(dst, 'cast*')): os.remove(f)
    cand = []
    for row, atk in zip(('atkA', 'atkB'), ATK[cls]):
        seq = SEQ_CLS.get(cls, {}).get(atk, SEQ['default'])
        for n, k in enumerate(seq):
            im = key_img(cls, atk, k)
            if im is None: im = key_img(cls, atk, 'src')
            f = to_cell(cls, im); f.save(os.path.join(dst, f'{row}-{n}.png')); cand.append((wpn_angle(f), f))
    if cls in WALK_DROP:
        ws = sorted(glob.glob(os.path.join(dst, 'walk-*.png')), key=lambda p: int(p.rsplit('-', 1)[1][:-4]))
        keep = [Image.open(p).convert('RGBA') for i, p in enumerate(ws) if i not in WALK_DROP[cls]]
        for p in ws: os.remove(p)
        for i, im in enumerate(keep): im.save(os.path.join(dst, f'walk-{i}.png'))
    k_ = B.KIND(cls); vals = B.CAST[k_]['val']; wrap = B.CAST[k_]['wrap']; T = 2 * math.pi
    dist = (lambda a, v: abs((((a - v + math.pi) % T) + T) % T - math.pi)) if wrap else (lambda a, v: abs(a - v))
    picks = []
    for n, v in enumerate(vals):
        a, f = min(cand, key=lambda c: dist(c[0], v)); f.save(os.path.join(dst, f'cast-{n}.png')); picks.append((round(v, 2), round(a, 2)))
    from pix import reduce
    fs = sorted(f for f in os.listdir(dst) if f.endswith('.png')); ims = [Image.open(os.path.join(dst, f)).convert('RGBA') for f in fs]
    st = Image.new('RGBA', (128 * len(ims), 128))
    for k, im in enumerate(ims): st.alpha_composite(im, (k * 128, 0))
    st = reduce(st, 22)
    for k, f in enumerate(fs): st.crop((k * 128, 0, (k + 1) * 128, 128)).save(os.path.join(dst, f))
    json.dump({'val': vals, 'wrap': wrap, 'picked': picks, 'src': 'key_assemble'}, open(os.path.join(dst, 'cast.json'), 'w', encoding='utf-8'))
    print(cls, 'cast', picks)


if __name__ == '__main__':
    run(sys.argv[1])
