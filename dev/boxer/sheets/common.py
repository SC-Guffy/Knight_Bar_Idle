# 시트 제작 공통: 프레임 정리(팔레트 스냅·외곽선·찌꺼기 제거·발 맞춤), 손 다듬기 도구, 시트·미리보기·GIF 쓰기.
import os, json
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
BOX = os.path.dirname(HERE)
ROOT = os.path.dirname(os.path.dirname(BOX))
OUT_C = (0x0b, 0x0d, 0x14, 255)
lum = lambda c: (c[0] * 3 + c[1] * 6 + c[2]) / 10
FOOT = (32, 58)


def pixels(im):
    return list(im.get_flattened_data()) if hasattr(im, 'get_flattened_data') else list(im.getdata())


def ref(cls):
    return Image.open(os.path.join(BOX, f'v2fin-{cls}.png')).convert('RGBA')


def palette(cls, extra=()):
    pal = sorted({c for c in pixels(ref(cls)) if c[3]})
    if OUT_C not in pal: pal.append(OUT_C)
    for c in extra:
        if c not in pal: pal.append(c)
    return pal


def _near(c, pal, cache):
    k = c[:3]
    if k in cache: return cache[k]
    best = min(pal, key=lambda p: 3 * (p[0] - c[0]) ** 2 + 6 * (p[1] - c[1]) ** 2 + 2 * (p[2] - c[2]) ** 2)
    cache[k] = best; return best


def load(path):
    im = Image.open(path).convert('RGBA')
    if im.size != (64, 64):  # 42×42 변형 → 64 캔버스 (발 맞춤은 나중에)
        o = Image.new('RGBA', (64, 64)); o.paste(im, ((64 - im.width) // 2, 58 - im.height + 1)); im = o
    return im


def components(im):
    w, h = im.size; px = im.load(); seen = set(); comps = []
    for y in range(h):
        for x in range(w):
            if px[x, y][3] and (x, y) not in seen:
                st = [(x, y)]; seen.add((x, y)); comp = []
                while st:
                    a, b = st.pop(); comp.append((a, b))
                    for dx in (-1, 0, 1):
                        for dy in (-1, 0, 1):
                            q = (a + dx, b + dy)
                            if 0 <= q[0] < w and 0 <= q[1] < h and q not in seen and px[q][3]:
                                seen.add(q); st.append(q)
                comps.append(comp)
    return comps


def tidy(im, pal, minc=12, outline=True, main=False, drop=None):
    """반투명 정리 → 팔레트 스냅 → 작은 찌꺼기 제거 → 외곽선 통일."""
    im = im.copy(); w, h = im.size; px = im.load(); cache = {}
    for y in range(h):
        for x in range(w):
            c = px[x, y]
            if c[3] < 128 or (drop and drop(c)): px[x, y] = (0, 0, 0, 0)
            else: px[x, y] = _near(c, pal, cache)
    comps = components(im)
    if comps:
        big = max(len(c) for c in comps)
        for c in comps:
            if len(c) < big and (len(c) < minc or main):
                for p in c: px[p] = (0, 0, 0, 0)
    if outline:
        edge = lambda x, y: any(not (0 <= x + dx < w and 0 <= y + dy < h) or px[x + dx, y + dy][3] == 0 for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))
        dark, lit = [], []
        for y in range(h):
            for x in range(w):
                if px[x, y][3] and edge(x, y): (dark if lum(px[x, y]) < 70 else lit).append((x, y))
        for p in dark: px[p] = OUT_C
        add = set()
        for x, y in lit:
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                if 0 <= x + dx < w and 0 <= y + dy < h and px[x + dx, y + dy][3] == 0: add.add((x + dx, y + dy))
        for p in add: px[p] = OUT_C
    return im


def shift(im, dx, dy):
    o = Image.new('RGBA', im.size); o.paste(im, (dx, dy)); return o


def feet_offset(im):
    bb = im.getbbox(); px = im.load()
    feet = [x for x in range(im.width) if px[x, bb[3] - 1][3]]
    fx = (feet[0] + feet[-1]) // 2
    return FOOT[0] - fx, FOOT[1] - (bb[3] - 1)


def align(im, mode='feet', dx=0, dy=0):
    if mode == 'feet':
        ox, oy = feet_offset(im)
    elif mode == 'ground':  # 가로는 그대로, 바닥만 y=58
        ox, oy = 0, FOOT[1] - (im.getbbox()[3] - 1)
    else:
        ox, oy = 0, 0
    return shift(im, ox + dx, oy + dy)


def bob(im, cut, d):
    """cut 위쪽 줄을 d 만큼 아래로 (숨쉬기·들썩임). 허리 줄이 윗몸에 덮인다."""
    o = Image.new('RGBA', im.size)
    o.paste(im.crop((0, cut, im.width, im.height)), (0, cut))
    up = im.crop((0, 0, im.width, cut))
    if d >= 0:
        o.alpha_composite(up, (0, d))
    else:
        o.alpha_composite(up.crop((0, -d, im.width, cut)), (0, 0))
    return o


def paste_part(dst, src, box, to=None, under=False):
    """src 의 box 영역 불투명 칸을 dst 의 to(왼쪽 위) 에 덮는다 (under=True 면 dst 뒤에 깐다)."""
    part = src.crop(box); to = to or box[:2]
    if under:
        o = Image.new('RGBA', dst.size); o.alpha_composite(part, to); o.alpha_composite(dst); return o
    o = dst.copy(); o.alpha_composite(part, to); return o


def erase(im, box):
    o = im.copy(); ImageDraw.Draw(o).rectangle(box, fill=(0, 0, 0, 0)); return o


def pts_of(im, kick=False):
    px = im.load(); bb = im.getbbox()
    top = bb[1]; xs = [x for x in range(64) if px[x, top][3]]
    head = [sum(xs) // len(xs), top]
    ylim = 64 if kick else min(52, bb[3] - 4)
    best = None
    for x in range(63, -1, -1):
        for y in range(top + 6, ylim):
            if px[x, y][3]: best = (x, y); break
        if best: break
    if best is None: best = (bb[2] - 1, (bb[1] + bb[3]) // 2)
    x = best[0]; ys = [y for y in range(top + 6, ylim) if px[x, y][3]]
    hand = [x, (ys[0] + ys[-1]) // 2 if ys else best[1]]
    return hand + head


def write_sheet(cls, anims, order, kick_anims=()):
    """anims: {name: {'frames': [Image], 'fps', 'loop', 'hit'?}} → src/sprites/<cls>.png/.json + 미리보기 + GIF."""
    n = max(len(anims[a]['frames']) for a in order)
    sheet = Image.new('RGBA', (64 * n, 64 * len(order)))
    meta = {'anims': {}, 'pts': {}}
    for r, a in enumerate(order):
        A = anims[a]
        for k, f in enumerate(A['frames']): sheet.alpha_composite(f, (64 * k, 64 * r))
        m = {'row': r, 'frames': len(A['frames']), 'fps': A['fps'], 'loop': A['loop']}
        if 'hit' in A: m['hit'] = A['hit']
        meta['anims'][a] = m
        auto = [pts_of(f, kick=a in kick_anims) for f in A['frames']]
        for k, p in (A.get('pts') or {}).items(): auto[k] = p
        meta['pts'][a] = auto
    sp = os.path.join(ROOT, 'src', 'sprites'); os.makedirs(sp, exist_ok=True)
    sheet.save(os.path.join(sp, f'{cls}.png'))
    with open(os.path.join(sp, f'{cls}.json'), 'w', encoding='utf-8') as f:
        f.write('{"w": 64, "h": 64, "foot": [32, 58],\n "anims": {\n')
        f.write(',\n'.join(f'  "{a}": {json.dumps(meta["anims"][a])}' for a in order))
        f.write('\n },\n "pts": {\n')
        f.write(',\n'.join(f'  "{a}": {json.dumps(meta["pts"][a])}' for a in order))
        f.write('\n }\n}\n')
    # 미리보기 4배 + 라벨 + hand(빨강)·head(파랑) 점
    S = 4; L = 80
    pv = Image.new('RGBA', (L + 64 * n * S, 64 * len(order) * S), (20, 22, 29, 255))
    pv.alpha_composite(sheet.resize((sheet.width * S, sheet.height * S), Image.NEAREST), (L, 0))
    d = ImageDraw.Draw(pv)
    for r, a in enumerate(order):
        A = meta['anims'][a]
        d.text((4, r * 64 * S + 8), a, fill=(255, 220, 90))
        d.text((4, r * 64 * S + 22), f"{A['frames']}f {A['fps']}fps" + (f" hit{A['hit']}" if 'hit' in A else ''), fill=(170, 170, 190))
        d.line([(L, r * 64 * S), (pv.width, r * 64 * S)], fill=(50, 52, 64))
        for k, p in enumerate(meta['pts'][a]):
            ox, oy = L + k * 64 * S, r * 64 * S
            d.rectangle([ox + p[0] * S, oy + p[1] * S, ox + p[0] * S + 3, oy + p[1] * S + 3], outline=(255, 60, 60))
            d.rectangle([ox + p[2] * S, oy + p[3] * S, ox + p[2] * S + 3, oy + p[3] * S + 3], outline=(80, 160, 255))
            d.line([(ox + 30 * S, oy + 59 * S), (ox + 34 * S, oy + 59 * S)], fill=(90, 90, 110))
    pv.save(os.path.join(HERE, f'{cls}-preview.png'))
    gd = os.path.join(HERE, 'gif'); os.makedirs(gd, exist_ok=True)
    for a in order:
        A = anims[a]; fr = []
        for f in A['frames']:
            b = Image.new('RGBA', (64, 64), (0x14, 0x16, 0x1d, 255)); b.alpha_composite(f)
            fr.append(b.convert('RGB').resize((256, 256), Image.NEAREST))
        dur = [round(1000 / A['fps'])] * len(fr)
        if not A['loop']: dur[-1] += 400
        if len(fr) == 1: fr.append(fr[0]); dur.append(dur[0])
        fr[0].save(os.path.join(gd, f'{cls}-{a}.gif'), save_all=True, append_images=fr[1:], duration=dur, loop=0, disposal=1)
    px = pixels(sheet)
    cols = {c for c in px if c[3]}
    alphas = {c[3] for c in px}
    print(cls, 'sheet', sheet.size, 'colors', len(cols), 'alphas', sorted(alphas))
    return meta
