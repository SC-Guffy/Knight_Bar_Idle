# 창기사 계열 디자인 시안 v5 (검수 루프 2차, PixelLab 0회). 1차(v4) 16장 합격 0 — 공통 원인: 창 1~2px · 어두운 한 톤 · 체형 가이드 약함.
#  1) 직업별 3등신 도트 마네킹 가이드 (할버디어 어깨 = 엉덩이 1.6배·잘록한 허리 / 용기병 곧은 자세·작은 날개·가는 꼬리 / 랜서 방패)
#     가이드에 무기를 굵게 그려 손이 무기를 쥐는 자리를 잡게 한다. denoise 0.85.
#  2) 생성 뒤 1024 원본에서 몸 높이(공용 shrink.body_bounds)로 도트 한 칸 u = 몸 키/46 를 구하고, 코드로 그린 무기를 u 칸 격자로
#     같은 자리(가이드 손 점·각도)에 덧그린 뒤 46칸으로 줄인다 → 줄인 뒤 자루가 정확히 3px, 날·깃발·도끼날·원뿔 랜스도 굵게 남는다.
#     모델이 그린 가는 무기는 덮이거나, 남으면 검수가 잡는다 (손 픽셀 수정 없음 — 사용자 방침 "에이전트로 생성→검수→수리 반복").
#  C:\AI\ComfyUI\.venv\Scripts\python.exe -I -B design5.py gen [직업 ...]  → design/raw/<직업>5-<시드>.png
#  ... design5.py shrink → design/px/<직업>5-<시드>-h46.png   ·   design5.py guides → out/guide5-<직업>.png
import os, sys, math
from PIL import Image, ImageDraw
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE); sys.path.insert(0, os.path.join(HERE, '..', 'sheets-common'))
import design as D                     # STYLE·BODY·RAW·PX·SEEDS
from shrink import body_bounds, shrink_body
RAW, PX, H = D.RAW, D.PX, 46
BG = (200, 200, 204); OUTL = (20, 22, 30)
T0, F0 = 170, 870                      # 가이드 정수리·발바닥 (1024)
HH = (F0 - T0) / 3                     # 머리 높이 (3등신)
CX = 470
GRIP = (CX + HH * 0.62, T0 + HH * 1.48)  # 가이드 앞손 (무기 쥐는 자리)

LIGHT = ' Bright lighting with clear highlights on armor edges, three-tone shading, not dark, not monochrome.'
SPEC = {
    'lancer': dict(sh=1.0, waist=0.9, wings=False, tail=False, shield=False, cape=True, wpn='spear', ang=-62,
        who='A young lancer knight warrior, proud upright stance with chest out, a polished bright steel breastplate and large round steel '
            'shoulder pauldrons over a forest green surcoat, an open-faced steel sallet helmet with a green plume, a short green cape ending '
            'above the knees, steel gauntlets and greaves, gripping a thick wooden spear in the front hand.' + LIGHT),
    'dragoon': dict(sh=1.05, waist=0.85, wings=True, tail=True, shield=False, cape=False, wpn='dragon', ang=-70,
        who='A humanoid dragon knight warrior standing tall with a straight back, a helmet shaped like a dragon skull with a long snout, white '
            'fangs, glowing yellow eyes and two long horns swept straight back, deep purple scale armor with bright lavender scale highlights, '
            'a pale cream belly plate, small bat-wing cape folded behind the shoulders (smaller than the body), a thin dragon tail behind the '
            'legs, gripping a thick dragon spear in the front hand. Not a gargoyle, not a beetle, not crouching.' + LIGHT),
    'halberdier': dict(sh=1.6, waist=0.7, wings=False, tail=False, shield=False, cape=False, wpn='halberd', ang=-84,
        who='A heavy halberdier warrior with a V-shaped inverted triangle torso: huge square steel pauldrons much wider than the hips, a broad '
            'chest plate, a narrow waist cinched by a thick belt with a bright buckle, flat stomach, thick armored arms, straight legs, a bright '
            'orange surcoat hanging straight in front, a steel bucket helmet with one horizontal eye slit, standing upright, gripping a thick '
            'halberd held vertically beside the body. Not fat, no round belly, no flared skirt.' + LIGHT),
    'cavalier': dict(sh=1.1, waist=0.85, wings=False, tail=False, shield=True, cape=False, wpn='lance', ang=-12,
        who='A cavalry lancer knight with a big helmet head and chibi proportions, a crested steel helmet with a tall bright red feather plume, '
            'a bright royal blue surcoat over polished silver plate armor, a red heraldic kite shield on the far arm, gripping a huge thick '
            'conical jousting lance pointing forward.' + LIGHT),
}


def mannequin(spec):
    """직업별 3등신 도트 마네킹 (16px 칸, 외곽선, 위 밝고 아래 어두움) + 굵은 무기 자리"""
    B = 16; W = 1024 // B; t, f, hh, cx = T0 // B, F0 // B, HH / B, CX / B
    c = {}

    def box(x0, y0, x1, y1, col):
        for y in range(int(y0), int(round(y1))):
            for x in range(int(x0), int(round(x1))): c[(x, y)] = col
    lite, mid, dark, deep = (178, 179, 190), (140, 141, 152), (104, 105, 118), (80, 80, 94)
    sw = 0.52 * spec['sh']                                                    # 어깨 반폭 (머리 높이 배수)
    if spec['wings']:                                                         # 작은 날개: 어깨 뒤 위로
        for i in range(int(hh * 0.9)):
            box(cx - sw * hh - i * 0.7, t + hh * 0.9 - i * 0.5, cx - sw * hh + 1 - i * 0.2, t + hh * 1.5 - i * 0.3, deep)
    if spec['cape']: box(cx - sw * hh - 1, t + hh * 1.0, cx - 0.1 * hh, t + hh * 2.45, deep)
    if spec['shield']: box(cx - sw * hh - hh * 0.35, t + hh * 1.0, cx - sw * hh + hh * 0.25, t + hh * 2.2, (120, 60, 60))
    for y in range(t, int(t + hh)):                                           # 머리
        for x in range(int(cx - hh * 0.62), int(cx + hh * 0.62) + 1):
            if ((x - cx) / (hh * 0.57)) ** 2 + ((y - t - hh / 2) / (hh / 2)) ** 2 <= 1: c[(x, y)] = lite if y < t + hh * 0.45 else mid
    box(cx - sw * hh, t + hh * 0.98, cx + sw * hh, t + hh * 1.45, lite)       # 어깨·가슴
    wv = 0.5 * spec['waist']
    for k in range(int(hh * 0.55)):                                           # 가슴 → 허리 (좁아짐)
        r = sw - (sw - wv) * k / (hh * 0.55)
        box(cx - r * hh, t + hh * 1.45 + k, cx + r * hh, t + hh * 1.45 + k + 1, mid)
    box(cx - wv * hh, t + hh * 2.0, cx + wv * hh, t + hh * 2.08, deep)         # 벨트
    box(cx - 0.42 * hh, t + hh * 2.08, cx - 0.06 * hh, f, dark)               # 뒷다리
    box(cx + 0.06 * hh, t + hh * 2.08, cx + 0.42 * hh, f, mid)                # 앞다리
    if spec['tail']:
        for i in range(int(hh * 0.8)): c[(int(cx - 0.45 * hh - i), int(f - hh * 0.3 + i * 0.25))] = deep
    gx, gy = GRIP[0] / B, GRIP[1] / B                                         # 앞팔 (어깨 → 손)
    for i in range(10):
        x = cx + sw * hh * 0.6 + (gx - cx - sw * hh * 0.6) * i / 9; y = t + hh * 1.1 + (gy - t - hh * 1.1) * i / 9
        box(x - 1, y - 1, x + 1, y + 1, mid)
    box(gx - 1, gy - 1, gx + 1.2, gy + 1.2, lite)                              # 주먹
    im = Image.new('RGB', (W, W), BG); P = im.load()
    for (x, y), col in c.items():
        if 0 <= x < W and 0 <= y < W: P[x, y] = col
    for (x, y) in list(c):
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            q = (x + dx, y + dy)
            if q not in c and 0 <= q[0] < W and 0 <= q[1] < W: P[q] = OUTL
    im = im.resize((1024, 1024), Image.NEAREST)
    draw_weapon(im, spec['wpn'], GRIP, spec['ang'], u=HH * 3 / H, guide=True)  # 가이드에도 같은 무기를 굵게
    return im


def _poly_line(d, p0, p1, w, col):
    a = math.atan2(p1[1] - p0[1], p1[0] - p0[0]); nx, ny = -math.sin(a) * w / 2, math.cos(a) * w / 2
    d.polygon([(p0[0] + nx, p0[1] + ny), (p1[0] + nx, p1[1] + ny), (p1[0] - nx, p1[1] - ny), (p0[0] - nx, p0[1] - ny)], fill=col)


def draw_weapon(im, kind, grip, ang, u, guide=False):
    """u = 도트 한 칸 (1024 기준). 자루 3칸(외곽선 1 + 속 1 + 외곽선 1), 날·깃발·도끼날·원뿔 랜스를 u 격자 크기로"""
    d = ImageDraw.Draw(im); a = math.radians(ang); ca, sa = math.cos(a), math.sin(a)
    P = lambda t, n=0: (grip[0] + ca * t * u - sa * n * u, grip[1] + sa * t * u + ca * n * u)
    COL = {'spear': ((58, 38, 22), (168, 116, 62), (226, 232, 240), (120, 128, 140)),
           'dragon': ((40, 24, 64), (122, 90, 176), (238, 230, 255), (150, 120, 210)),
           'halberd': ((48, 36, 24), (140, 100, 56), (226, 230, 238), (118, 124, 136)),
           'lance': ((40, 44, 56), (230, 234, 242), (250, 252, 255), (200, 50, 50))}
    out, core, steel, steel2 = COL[kind]
    if kind in ('spear', 'dragon', 'halberd'):
        back, front = (-10, 30) if kind != 'halberd' else (-14, 26)
        _poly_line(d, P(back), P(front), 3 * u, out); _poly_line(d, P(back + 0.5), P(front - 0.5), 1 * u, core)
        if kind == 'spear':
            d.polygon([P(front + 7), P(front + 1, 2), P(front - 1), P(front + 1, -2)], fill=out)
            d.polygon([P(front + 6), P(front + 1.5, 1.2), P(front), P(front + 1.5, -1.2)], fill=steel)
            if not guide:      # 창날 바로 아래 녹색 제비꼬리 깃발
                d.polygon([P(front - 2, 1.5), P(front - 2, 6), P(front - 4, 4.5), P(front - 6, 6), P(front - 6, 1.5)], fill=(30, 70, 40))
                d.polygon([P(front - 2.6, 2.1), P(front - 2.6, 5), P(front - 4, 4), P(front - 5.4, 5), P(front - 5.4, 2.1)], fill=(70, 150, 80))
        elif kind == 'dragon':  # 용 이빨 톱니 창날
            pts = [P(front + 9)] + [P(front + 8 - i * 1.6, (2.5 if i % 2 == 0 else 1.5)) for i in range(5)] + [P(front - 1)] + \
                  [P(front + 8 - i * 1.6, -(2.5 if i % 2 == 0 else 1.5)) for i in reversed(range(5))]
            d.polygon(pts, fill=out)
            d.polygon([P(front + 8), P(front + 1, 1.3), P(front), P(front + 1, -1.3)], fill=steel)
        else:                   # 할버드: 위 창끝 · 앞 도끼날 · 뒤 갈고리
            d.polygon([P(front + 6), P(front + 1, 1.5), P(front - 0.5), P(front + 1, -1.5)], fill=out)
            d.polygon([P(front + 5), P(front + 1.2, 0.8), P(front), P(front + 1.2, -0.8)], fill=steel)
            d.polygon([P(front - 1, -1.5), P(front + 1, -6.5), P(front - 3, -8), P(front - 7, -6.5), P(front - 6, -1.5)], fill=out)
            d.polygon([P(front - 1.6, -2.2), P(front + 0.2, -6), P(front - 3, -7.2), P(front - 6.2, -6), P(front - 5.4, -2.2)], fill=steel)
            d.polygon([P(front - 4.6, -6.6), P(front - 1, -6.6), P(front - 3, -7.2)], fill=steel2)
            d.polygon([P(front - 1.5, 1.5), P(front - 2.5, 4.5), P(front - 4, 3.5), P(front - 4.5, 1.5)], fill=out)
    else:                       # 랜스: 손 뒤 짧은 자루, 손 앞 둥근 보호대, 밑동 7칸 → 끝 2칸 원뿔
        _poly_line(d, P(-6), P(1), 3 * u, out); _poly_line(d, P(-5.5), P(0.5), 1 * u, (110, 80, 50))
        d.polygon([P(2, 3.6), P(32, 1.0), P(33.5, 0), P(32, -1.0), P(2, -3.6)], fill=out)
        d.polygon([P(2.5, 2.7), P(31.5, 0.4), P(31.5, -0.4), P(2.5, -2.7)], fill=steel)
        if not guide:
            for k in range(4):  # 빨강 띠
                t0 = 6 + k * 6.5; r0 = 2.7 - (t0 - 2.5) * 2.3 / 29; r1 = 2.7 - (t0 + 2 - 2.5) * 2.3 / 29
                d.polygon([P(t0, r0), P(t0 + 2, r1), P(t0 + 2, -r1), P(t0, -r0)], fill=steel2)
        g = P(1.2)
        d.ellipse([g[0] - 4.6 * u, g[1] - 4.6 * u, g[0] + 4.6 * u, g[1] + 4.6 * u], fill=out)
        d.ellipse([g[0] - 3.6 * u, g[1] - 3.6 * u, g[0] + 3.6 * u, g[1] + 3.6 * u], fill=(190, 196, 210))
        d.ellipse([g[0] - 1.6 * u, g[1] - 2.8 * u, g[0] + 0.4 * u, g[1] - 1.2 * u], fill=(250, 252, 255))


def gen(classes, seeds=None):
    sys.path.insert(0, os.path.join(HERE, '..', 'comfy'))
    from comfy import gen as G
    for cls in classes:
        gd = mannequin(SPEC[cls]); gd.save(os.path.join(RAW, f'_guide5-{cls}.png'))
        for s in seeds or D.SEEDS:
            out = os.path.join(RAW, f'{cls}5-{s}.png')
            if os.path.exists(out): continue
            ims, dt = G('zimg', D.SW.STYLE.format(who=SPEC[cls]['who'], body=D.BODY), seed=s, denoise=0.85, init=gd)
            ims[0].save(out); print(cls, 'v5', s, f'{dt:.1f}s', flush=True)


def finish(name):
    """생성 원본 → 몸 높이로 u → 무기 덧그리기(가이드 손 점·각도를 실제 몸 높이 비율로 옮김) → 46칸"""
    cls = name.split('5-')[0]; spec = SPEC[cls]
    im = Image.open(os.path.join(RAW, name + '.png')).convert('RGB')
    top, foot = body_bounds(im) or (T0, F0)
    u = (foot - top) / H
    sc = (foot - top) / (F0 - T0); grip = (CX + (GRIP[0] - CX) * sc, top + (GRIP[1] - T0) * sc)
    w = im.copy(); draw_weapon(w, spec['wpn'], grip, spec['ang'], u)
    return shrink_body(w, top, foot, H)


if __name__ == '__main__':
    if sys.argv[1] == 'gen': gen(sys.argv[2:] or list(SPEC))
    elif sys.argv[1] == 'guides':
        for c in SPEC: mannequin(SPEC[c]).resize((256, 256)).save(os.path.join(HERE, 'out', f'guide5-{c}.png'))
    elif sys.argv[1] == 'shrink0':            # 무기 덧그리기 없이 (형태로 후보 고르기용 — 로드맵: 명암·도트다움은 정리 뒤에 본다)
        for f in sorted(os.listdir(RAW)):
            if f.endswith('.png') and '5-' in f and not f.startswith('_'):
                im = Image.open(os.path.join(RAW, f)).convert('RGB'); top, foot = body_bounds(im) or (T0, F0)
                o = shrink_body(im, top, foot, H); n = f[:-4].replace('5-', '5n-'); o.save(os.path.join(PX, n + f'-h{H}.png')); print(n, o.size)
    elif sys.argv[1] == 'shrink':
        for f in sorted(os.listdir(RAW)):
            if f.endswith('.png') and '5-' in f and not f.startswith('_'):
                o = finish(f[:-4]); o.save(os.path.join(PX, f[:-4] + f'-h{H}.png')); print(f[:-4], o.size)
