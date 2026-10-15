# 레인저 계열 원형 마네킹 + 직업 입히기 (PixelLab 0회 시안). 검사 계열 dev/sheets-sword/{parts,mannequin,dress}.py 와 같은 방식을 활·석궁에 맞췄다.
#   1) 캡처(8배, capture.js) → 1배 (base.down)
#   2) 마네킹: 장식 없는 검사 몸 + 무기(장궁 / 거대 석궁 / 공성 석궁) 를 부위색으로 칠한다 — 투구·몸통·바지·장화·장갑(손)·무기
#      PixelLab 애니가 이 색을 지키면 프레임마다 부위를 색으로 다시 가를 수 있다
#   3) 입히기: 마네킹 프레임 → 그 직업. 머리(모자·후드·관)는 직업 그림에서 통째로, 몸통 무늬·망토는 같은 이동량으로 옮기고,
#      못 덮은 곳과 바지·장화·손·무기는 직업 부위 램프(3단). 마지막에 직업 팔레트 고정 + 외곽선
#   python -I dev/bowsheets/dress.py   → dev/bowsheets/mq/*.png, dev/review/sheets-bow/mq-*.png·dress-*.png·line-*.png, 실루엣 겹침 sil-iou.json
import os, sys, json
from PIL import Image, ImageOps
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, HERE); sys.path.insert(0, os.path.join(ROOT, 'dev', 'boxer', 'sheets'))
from base import down
from common import tidy
SHOTS = os.path.join(ROOT, 'dev', 'shots'); CAP = os.path.join(HERE, 'cap'); MQ = os.path.join(HERE, 'mq')
REV = os.path.join(ROOT, 'dev', 'review', 'sheets-bow')
OUT_C = (0x0b, 0x0d, 0x14, 255)
lum = lambda c: c[0] * .3 + c[1] * .59 + c[2] * .11
IDS = ['ranger', 'marksman', 'arcaneArcher', 'arbalest', 'deadeye', 'voidArcher', 'siegeMaster']
ARCH = {'ranger': 'mq-bow', 'marksman': 'mq-bow', 'arcaneArcher': 'mq-bow', 'deadeye': 'mq-bow', 'voidArcher': 'mq-bow',
        'arbalest': 'mq-xbow', 'siegeMaster': 'mq-siege'}
TESTS = ['stand', 'p6', 'p13', 'up', 'w0', 'w1']
RAMP = {   # 검사 계열 마네킹과 같은 부위색 (blade → 무기)
    'helm': [(0x4a, 0x52, 0x60), (0x7d, 0x87, 0x98), (0xb8, 0xc0, 0xcc)],
    'torso': [(0x6a, 0x1f, 0x22), (0xa8, 0x32, 0x3a), (0xd9, 0x55, 0x5c)],
    'legs': [(0x22, 0x30, 0x5a), (0x3a, 0x4f, 0x8c), (0x5c, 0x75, 0xb8)],
    'boots': [(0x3a, 0x26, 0x18), (0x5e, 0x3e, 0x26), (0x86, 0x60, 0x3c)],
    'glove': [(0x8a, 0x6a, 0x2a), (0xc9, 0x9a, 0x3a), (0xec, 0xc7, 0x60)],
    'weapon': [(0x8a, 0x96, 0xa8), (0xd0, 0xd8, 0xe4), (0xfa, 0xfc, 0xff)],
}


def load(name):
    p = os.path.join(CAP, name + '.png')
    if not os.path.exists(p):
        os.makedirs(CAP, exist_ok=True)
        down(Image.open(os.path.join(SHOTS, name + '.png')).convert('RGBA'))[0].save(p)
    return Image.open(p).convert('RGBA')


def ground_of(im):
    return im.getbbox()[3] - 1


def parts(full, body, wpn, ground=None):
    """픽셀마다 부위. 띠는 땅에서 잰다 (기존 기사는 다리 높이가 같다): 머리 = 땅-19 위, 몸통 = ~땅-5, 바지, 맨 아래 3줄 장화. 무기 옆 몸 = 손"""
    W, H = full.size; F, B, P = full.load(), body.load(), wpn.load()
    g = ground if ground is not None else ground_of(full); neck, belt = g - 19, g - 5
    out = {}
    for y in range(H):
        for x in range(W):
            c = F[x, y]
            if c[3] == 0: continue
            if lum(c) < 24: out[x, y] = 'line'; continue
            if not B[x, y][3]: out[x, y] = 'weapon'; continue
            nw = any(0 <= x + a < W and 0 <= y + b < H and P[x + a, y + b][3] and not B[x + a, y + b][3] for a in (-1, 0, 1) for b in (-1, 0, 1))
            out[x, y] = 'glove' if nw and y < belt else 'helm' if y < neck else 'torso' if y < belt else 'boots' if y > g - 3 else 'legs'
    return out


def paint(full, part):
    """부위 → 마네킹 램프 (부위 안 밝기 3등분)"""
    F = full.load(); o = Image.new('RGBA', full.size); O = o.load(); groups = {}
    for p, k in part.items(): groups.setdefault(k, []).append(p)
    for k, ps in groups.items():
        if k == 'line':
            for p in ps: O[p] = OUT_C
            continue
        ls = sorted(lum(F[p]) for p in ps); t1, t2 = ls[len(ls) // 3], ls[2 * len(ls) // 3]
        for p in ps:
            L = lum(F[p]); O[p] = RAMP[k][wlevel(L) if k == 'weapon' else 0 if L < t1 else 1 if L < t2 else 2] + (255,)
    return o


# 무기는 재질이 밝기로 갈린다 (활대·몸체 나무 / 쇠 / 시위·빛) — 3등분 대신 고정 밝기 단
wlevel = lambda L: 0 if L < 90 else 1 if L < 200 else 2


def weapon_ramp(colors):
    lv = [[c for c in colors if wlevel(lum(c)) == i] for i in range(3)]
    best = [max(set(l), key=l.count) if l else None for l in lv]
    for i in range(3):
        if best[i] is None: best[i] = next((best[j] for j in sorted(range(3), key=lambda j: abs(j - i)) if best[j]), (128, 128, 128, 255))
    return best


def mannequin(arch, test):
    n = f'{arch}-{test}'; full = load(n + '-noacc')
    g = ground_of(load(f'{arch}-stand-noacc'))        # 걷기 등에서 발이 떠도 띠는 대기 자세 땅으로
    return paint(full, parts(full, load(n + '-body'), load(n + '-wpn'), g))


def classify(M):
    pal = [(c, k, i) for k, r in RAMP.items() for i, c in enumerate(r)]
    out = {}; px = M.load()
    for y in range(M.height):
        for x in range(M.width):
            c = px[x, y]
            if c[3] < 128: continue
            if lum(c) < 24: out[x, y] = ('line', 0); continue
            b = min(pal, key=lambda p: 3 * (p[0][0] - c[0]) ** 2 + 6 * (p[0][1] - c[1]) ** 2 + 2 * (p[0][2] - c[2]) ** 2)
            out[x, y] = (b[1], b[2])
    return out


def ramp_of(colors):
    if not colors: return None
    cs = sorted(colors, key=lum); n = len(cs); out = []
    for a, b in ((0, n // 3), (n // 3, 2 * n // 3), (2 * n // 3, n)):
        seg = cs[a:max(b, a + 1)]; out.append(max(set(seg), key=seg.count))
    return out


def anchor(pm, part):
    ps = [p for p, k in pm.items() if (k[0] if isinstance(k, tuple) else k) == part]
    if not ps: return None
    yb = max(y for _, y in ps); row = [x for x, y in ps if y == yb]
    return ((min(row) + max(row)) / 2, yb)


def big(mask, minc=12):
    left, out = set(mask), set()
    while left:
        st = [left.pop()]; comp = set(st)
        while st:
            x, y = st.pop()
            for a in (-1, 0, 1):
                for b in (-1, 0, 1):
                    q = (x + a, y + b)
                    if q in left: left.discard(q); comp.add(q); st.append(q)
        if len(comp) >= minc: out |= comp
    return out


def dress(cls, M):
    full, noacc, body, wpn = (load(f'c-{cls}-{k}') for k in ('full', 'noacc', 'body', 'wpn'))
    W = full.width; inN = lambda p: 0 <= p[0] < W and 0 <= p[1] < W
    g = ground_of(noacc); neck = g - 19
    CP = parts(noacc, body, wpn); C = noacc.load(); Fp = full.load()
    A, Bn = full.load(), noacc.load()
    cape = big({(x, y) for y in range(W) for x in range(W) if A[x, y][3] and A[x, y] != Bn[x, y]})
    ramps = {k: (weapon_ramp if k == 'weapon' else ramp_of)([C[p] for p, kk in CP.items() if kk == k]) for k in RAMP}
    for k in RAMP:
        if ramps[k] is None: ramps[k] = ramps['torso']
    base = classify(mannequin(ARCH[cls], 'stand')); MP = classify(M)
    ba, ma = anchor(base, 'helm'), anchor(MP, 'helm') or anchor(base, 'helm')
    ca = anchor({p: k for p, k in CP.items() if p[1] < neck}, 'helm')
    off = (round(ma[0] - ba[0]), round(ma[1] - ba[1])); hoff = (round(ma[0] - ca[0]), round(ma[1] - ca[1]))
    o = Image.new('RGBA', (W, W)); O = o.load(); mv = lambda p, d: (p[0] + d[0], p[1] + d[1])
    for p in cape:                                       # 망토 (몸 뒤, 빈 칸에만)
        q = mv(p, off)
        if inN(q) and q not in MP: O[q] = Fp[p]
    for (x, y), (k, i) in MP.items():                    # 몸: 부위 램프, 몸통은 직업 무늬 우선
        if k == 'line': O[x, y] = OUT_C; continue
        if k == 'helm': continue
        c = ramps[k][i]
        if k == 'torso':
            q = (x - off[0], y - off[1])
            if CP.get(q) == 'torso': c = C[q]
        O[x, y] = c[:3] + (255,)
    head = {p for p, k in CP.items() if p[1] < neck and k not in ('weapon', 'line', 'glove')}   # 머리: 목 위 칠한 칸 + 붙은 외곽선
    head |= {p for p, k in CP.items() if k == 'line' and p[1] < neck + 1 and any((p[0] + a, p[1] + b) in head for a in (-1, 0, 1) for b in (-1, 0, 1))}
    for p in head:
        q = mv(p, hoff)
        if inN(q) and MP.get(q, ('',))[0] != 'weapon': O[q] = C[p]
    pal = sorted({c for c in (full.get_flattened_data() if hasattr(full, 'get_flattened_data') else full.getdata()) if c[3]})
    if OUT_C not in pal: pal.append(OUT_C)
    return tidy(o, pal, minc=6)


def mask(im):
    px = im.load()
    return {(x, y) for y in range(im.height) for x in range(im.width) if px[x, y][3]}


def iou(a, b, foot_a, foot_b):
    """발 기준점을 맞춰 겹친 실루엣 IoU"""
    d = (foot_b[0] - foot_a[0], foot_b[1] - foot_a[1]); a = {(x + d[0], y + d[1]) for x, y in a}
    return len(a & b) / max(1, len(a | b))


def tile(ims, S=3, gap=6, bg=(20, 22, 29, 255), mode='color'):
    H = max(i.height for i in ims); o = Image.new('RGBA', (sum(i.width * S + gap for i in ims), H * S), bg); x = 0
    for im in ims:
        if mode == 'gray':
            g = ImageOps.grayscale(im.convert('RGB')).convert('RGBA'); g.putalpha(im.getchannel('A')); im = g
        elif mode == 'sil':
            s = Image.new('RGBA', im.size, (230, 230, 236, 255)); s.putalpha(im.getchannel('A')); im = s
        o.alpha_composite(im.resize((im.width * S, im.height * S), Image.NEAREST), (x, (H - im.height) * S)); x += im.width * S + gap
    return o


def tight(im, foot):
    """줄 세우기용: 발 기준점 둘레 64×56 만 (빈 여백 없이)"""
    return im.crop((foot[0] - 26, foot[1] - 50, foot[0] + 38, foot[1] + 6))


FOOT = lambda c: (58, 116) if c in ('siegeMaster', 'mq-siege') else (42, 86)

if __name__ == '__main__':
    os.makedirs(MQ, exist_ok=True); os.makedirs(REV, exist_ok=True)
    for arch in ('mq-bow', 'mq-xbow', 'mq-siege'):
        fr = [mannequin(arch, t) for t in TESTS]
        for t, im in zip(TESTS, fr): im.save(os.path.join(MQ, f'{arch}-{t}.png'))
        tile([tight(f, FOOT(arch)) for f in fr]).save(os.path.join(REV, f'{arch}.png'))
    rows = {}
    for cls in IDS:
        fr = [dress(cls, Image.open(os.path.join(MQ, f'{ARCH[cls]}-{t}.png')).convert('RGBA')) for t in TESTS]
        for t, im in zip(TESTS, fr): im.save(os.path.join(MQ, f'dress-{cls}-{t}.png'))
        orig = load(f'c-{cls}-full'); rows[cls] = (orig, fr)
        tile([tight(orig, FOOT(cls))] + [tight(f, FOOT(cls)) for f in fr]).save(os.path.join(REV, f'dress-{cls}.png'))
    for mode in ('color', 'gray', 'sil'):
        tile([tight(rows[c][0], FOOT(c)) for c in IDS], mode=mode).save(os.path.join(REV, f'line-orig-{mode}.png'))
        tile([tight(rows[c][1][0], FOOT(c)) for c in IDS], mode=mode).save(os.path.join(REV, f'line-dress-{mode}.png'))
    res = {}
    for kind, idx in (('orig', None), ('dress', 0)):
        M = {c: mask(rows[c][0] if idx is None else rows[c][1][0]) for c in IDS}
        res[kind] = {f'{a}|{b}': round(iou(M[a], M[b], FOOT(a), FOOT(b)), 3) for i, a in enumerate(IDS) for b in IDS[i + 1:]}
    json.dump(res, open(os.path.join(REV, 'sil-iou.json'), 'w'), indent=1)
    for kind in res:
        print(kind, sorted(res[kind].items(), key=lambda kv: -kv[1])[:7])
