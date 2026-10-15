# 직업 입히기 (와이어프레임 시험 B 단계, PixelLab 0회): 원형 마네킹 프레임 → 그 직업 그림.
#  1) 마네킹 프레임 픽셀을 부위색(mannequin.RAMP)으로 다시 가른다 (애니가 색을 조금 바꿔도 가장 가까운 부위로)
#  2) 머리(투구+장식: 후광·볏·뿔)는 직업 그림에서 통째로 옮긴다 — 마네킹 투구 아랫줄 가운데에 맞춤 (머리는 딱딱하니 따로 놀지 않는다)
#  3) 몸통은 직업 그림 무늬를 같은 이동량으로 옮기고, 못 덮은 곳(팔이 뻗은 자리)은 직업 부위 램프로 칠한다. 바지·장화·장갑·칼날도 램프
#  4) 마네킹에 없는 직업 소품(방패·망토 자락)은 몸통과 같이 옮긴다
#  5) (선택) ComfyUI Z-Image img2img 낮은 denoise 로 한 장 그림처럼 다듬기 → 6) 직업 팔레트 고정·외곽선
#  python -I dress.py <직업> <마네킹 프레임.png> <원형: sword|dual|great> <출력.png> [denoise=0]
import os, sys
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.join(HERE, '..', 'boxer', 'sheets'))
from parts import cap, parts, lum, OUT_C, bands, diff_mask
from mannequin import RAMP, ARCH, make
from common import tidy, components

LINE = 'line'


def crop_cell(im, N):
    fx, fy = N // 2, N - 6
    return im.crop((48 - fx, 88 - fy, 48 - fx + N, 88 - fy + N))


def classify(M):
    """마네킹 프레임 → {(x,y): (부위, 단계 0~2)}"""
    pal = [((c[0], c[1], c[2]), k, i) for k, r in RAMP.items() for i, c in enumerate(r)]
    out = {}; px = M.load()
    for y in range(M.height):
        for x in range(M.width):
            c = px[x, y]
            if c[3] < 128: continue
            if lum(c) < 24: out[x, y] = (LINE, 0); continue
            best = min(pal, key=lambda p: 3 * (p[0][0] - c[0]) ** 2 + 6 * (p[0][1] - c[1]) ** 2 + 2 * (p[0][2] - c[2]) ** 2)
            out[x, y] = (best[1], best[2])
    return out


def ramp_of(colors):
    """직업 부위 색들 → 어두운·중간·밝은 3단 (빈도 가중 3등분의 최빈색)"""
    if not colors: return None
    cs = sorted(colors, key=lum); n = len(cs); out = []
    for a, b in ((0, n // 3), (n // 3, 2 * n // 3), (2 * n // 3, n)):
        seg = cs[a:max(b, a + 1)]
        out.append(max(set(seg), key=seg.count))
    return out


def anchor(pmap, part, W):
    """부위 아랫줄 가운데 (머리·몸통 맞춤 기준)"""
    ps = [p for p, k in pmap.items() if (k[0] if isinstance(k, tuple) else k) == part]
    if not ps: return None
    yb = max(y for _, y in ps); row = [x for x, y in ps if y == yb]
    return ((min(row) + max(row)) / 2, yb)


def big(mask, minc=15):
    """8방향으로 이어진 덩어리 중 minc 칸 이상만"""
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


def solid(mask, G):
    """방패는 볼록하다: 줄마다 왼쪽~오른쪽 끝 사이를 채운다 (뒤 그림과 색이 같아 diff 에서 빠진 칸)"""
    rows = {}
    for x, y in mask: rows.setdefault(y, []).append(x)
    return {(x, y) for y, xs in rows.items() for x in range(min(xs), max(xs) + 1) if G.getpixel((x, y))[3]}


def dress(cls, M, arch, N):
    R = lambda k: Image.open(os.path.join(HERE, 'ref', f'{cls}-{k}.png')).convert('RGBA')
    full, body, wpn = cap(cls, 'noacc')
    dx0, dy0 = 48 - N // 2, 88 - (N - 6)
    inN = lambda p: 0 <= p[0] < N and 0 <= p[1] < N
    C = crop_cell(full, N); Cpx = C.load()
    CP = {(x - dx0, y - dy0): k for (x, y), k in parts(full, body, wpn).items()}
    CP = {p: k for p, k in CP.items() if inN(p)}
    neck, belt, ground = [v - dy0 for v in bands(full)]
    G = R('guard'); Gc = crop_cell(G, N); Gpx = Gc.load()
    sh = solid(big(diff_mask(G, R('nosh'))), G)                  # 방패 (몸 앞). 리그가 방패를 빼면 칼끝이 살짝 움직여 생기는 잔 조각은 버린다
    cape = big(diff_mask(G, R('nocape'))) - sh                   # 망토 (몸 뒤)
    sh = {(x - dx0, y - dy0) for x, y in sh}; cape = {(x - dx0, y - dy0) for x, y in cape}
    base = make(ARCH[arch][0], N); BP = classify(base)
    ramps = {k: ramp_of([Cpx[p] for p, kk in CP.items() if kk == k]) for k in RAMP}
    for k in RAMP:
        if ramps[k] is None: ramps[k] = ramps['torso']
    MP = classify(M)
    ca = anchor({p: k for p, k in CP.items() if p[1] < neck}, 'helm', N)
    ba = anchor(BP, 'helm', N)
    ma = anchor(MP, 'helm', N) or ba
    off = (round(ma[0] - ba[0]), round(ma[1] - ba[1]))     # 기준 프레임 대비 이 프레임의 몸 이동 (몸통 무늬·소품)
    hoff = (round(ma[0] - ca[0]), round(ma[1] - ca[1]))    # 직업 머리 → 이 프레임 투구 자리
    o = Image.new('RGBA', (N, N)); O = o.load()
    mv = lambda p, d: (p[0] + d[0], p[1] + d[1])
    # 망토: 몸 뒤 (빈 칸에만)
    for p in cape:
        q = mv(p, off)
        if inN(q) and q not in MP: O[q] = Gpx[p]
    # 몸: 부위 램프, 몸통은 직업 무늬 우선
    for (x, y), (k, i) in MP.items():
        if k == LINE: O[x, y] = OUT_C; continue
        if k == 'helm': continue
        c = ramps[k][i]
        if k == 'torso':
            q = (x - off[0], y - off[1])
            if CP.get(q) == 'torso': c = Cpx[q]
        O[x, y] = c[:3] + (255,)
    # 방패: 몸 앞 (칼날·장갑은 방패 위)
    for p in sh:
        q = mv(p, off)
        if inN(q) and MP.get(q, (None,))[0] not in ('blade', 'glove'): O[q] = Gpx[p]
    # 머리: 목 위의 칠한 칸(칼날 빼고) + 거기 붙은 외곽선
    head = {p for p, k in CP.items() if p[1] < neck and k not in ('blade', LINE)}
    head |= {p for p, k in CP.items() if k == LINE and p[1] < neck + 1
             and any((p[0] + a, p[1] + b) in head for a in (-1, 0, 1) for b in (-1, 0, 1))}
    for p in head:
        q = mv(p, hoff)
        if inN(q): O[q] = Cpx[p]
    return o, C, ramps


def palette_of(C, extra=()):
    pal = sorted({c for c in (C.get_flattened_data() if hasattr(C, 'get_flattened_data') else C.getdata()) if c[3]})
    if OUT_C not in pal: pal.append(OUT_C)
    return pal


def comfy_pass(im, prompt, denoise, seed=7):
    sys.path.insert(0, os.path.join(HERE, '..', 'comfy'))
    from comfy import gen
    N = im.width; S = 1024 // N
    bg = Image.new('RGBA', im.size, (24, 26, 34, 255)); bg.alpha_composite(im)
    big = bg.convert('RGB').resize((N * S, N * S), Image.NEAREST)
    ims, _ = gen('zimg', 'Pixel art style. ' + prompt + ' Side view facing right, chibi knight game sprite, flat dark background, crisp hard pixels.',
                 seed=seed, w=N * S, h=N * S, denoise=denoise, init=big)
    r = ims[0].resize((N, N), Image.BOX).convert('RGBA')
    # 실루엣은 입힌 그림 그대로 (img2img 는 안쪽 명암만)
    a = im.split()[3]; r.putalpha(a)
    return r


PROMPT = {
    'swordsman': 'A small knight in silver plate armor with a blue tunic, closed helmet with a blue plume, holding a long sword.',
    'paladin': 'A small holy paladin in cream and gold plate armor, golden halo above the helmet, white cape, gold shield with a cross, holding a golden holy sword.',
    'squire': 'A small squire knight in light armor with a red plume, holding a short sword.',
    'archon': 'A small celestial knight in pale blue armor with a golden halo, star shield, holding a starlight sword.',
}


if __name__ == '__main__':
    cls, src, arch, out = sys.argv[1:5]
    den = float(sys.argv[5]) if len(sys.argv) > 5 else 0
    M = Image.open(src).convert('RGBA'); N = M.width
    o, C, _ = dress(cls, M, arch, N)
    pal = palette_of(C)
    if den > 0: o = comfy_pass(o, PROMPT.get(cls, ''), den)
    o = tidy(o, pal, minc=6)
    o.save(out)
    print('saved', out)
