# 디자인 시안 (스펙 "기준 그림 = 새로 다시 그린 직업 디자인", PixelLab 0회): ComfyUI Z-Image + 픽셀 LoRA 로 성기사·검사를
#  그림체 방향 3가지(A 2.5등신 지금 비율 · B 3등신 · C 4등신 날렵)로 뽑고, 게임 크기(키 35 · 46 · 52px = 1 · 1.3 · 1.5배)로 줄인다.
#  실행 (ComfyUI 가상환경 파이썬, 서버 8188):
#    C:\AI\ComfyUI\.venv\Scripts\python.exe -I -B dev/sheets-sword/design.py gen [방향 ...]   → design/raw/<cls>-<방향>-<seed>.png (1024)
#    ... design.py shrink                                                                     → design/px/<cls>-<방향>-<seed>-h<키>.png
#  큐: 한 번에 8장 이하 (다른 세션과 GPU 공유)
import os, sys, json, time
import numpy as np
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', 'comfy'))
D = os.path.join(HERE, 'design'); RAW = os.path.join(D, 'raw'); PX = os.path.join(D, 'px')
OUT_C = (0x0b, 0x0d, 0x14)

STYLE = ('Pixel art style. One single full-body 2D game character sprite, side view, facing right, standing in a ready combat stance, '
         '{who} {body} Plain flat light gray background, nothing else. Crisp clean hard pixels, bold dark outline, limited palette, '
         'clear readable silhouette, light from the upper right.')
WHO = {
    'paladin': 'A holy paladin knight in cream white and gold plate armor, a golden halo floating above a crested helmet with a visor, '
               'a gold kite shield with a cross on the left arm, a golden longsword in the right hand, a short white cape.',
    'swordsman': 'A swordsman knight in polished silver plate armor with a royal blue tabard, a blue plume on a visored helmet, '
                 'a short blue cape, a steel longsword in the right hand.',
}
WHO.update({
    'blademaster': 'A dual-wielding blade master in sleek black lacquered armor with crimson trim, a horned black helmet with a red eye slit, '
                   'a long red scarf flowing behind, a slim crimson katana in each hand.',
    'greatswordsman': 'A rugged greatsword warrior with spiky black hair and a scarred face, dark iron armor with orange-brown leather, '
                      'bare muscular arms, a huge heavy dark iron greatsword resting on the shoulder, gripped with both hands.',
})
# 재시안 (로드맵: 검성은 덩어리·얼굴 안 보임, 대검전사는 실사 비율) — 검사·성기사와 같은 밝기·대비
WHO_R = {
    'blademaster': 'A dual-wielding blade master in charcoal gray lacquered armor with bright crimson trim, a horned helmet with a glowing red eye slit, '
                   'a long bright red scarf flowing behind, holding two slim crimson katanas, one in each hand, both blades clearly visible. '
                   'Bright rim light on the armor edges, high contrast, readable on a dark background.',
    'greatswordsman': 'A stylized game hero greatsword warrior with spiky black hair and a confident face, steel shoulder plates and brown leather armor '
                      'with bright orange accents, a huge greatsword with a wide steel blade resting on his right shoulder, gripped with both hands. '
                      'Bright rim light on the armor edges, high contrast, readable on a dark background.',
}
# 새로 그리기 (2026-10-17 사용자: "기존 비주얼을 따라갈 필요 없이 컨셉에만 알맞게") — 직업 이름·역할·무기만 보고, 지금 스프라이트는 안 쓴다.
#  밑그림은 직업과 무관한 3등신 회색 마네킹(design/mannequin-3h.png, 48칸 격자) — 비율·옆모습·큰 도트만 잡아 준다
STYLE_N = ('Pixel art style. One single full-body 2D side-scroller game character sprite, about 48 pixels tall, big chunky pixels, '
           '3 heads tall stylized proportions with a large head, strict side profile facing right, standing in a ready stance. '
           '{who} Simple clean shading with 3 tones per material, bright readable colors, bold 1-pixel dark outline, '
           'plain flat light gray background, nothing else.')
WHO_N = {
    'swordsman': 'A young swordsman knight: polished silver half-plate armor over a royal blue tunic, a visored helmet with a blue plume, a short blue cape, a straight steel longsword held forward in the right hand.',
    'paladin': 'A holy paladin: white and cream plate armor with gold trim, a glowing golden halo floating above the helmet, a gold kite shield with a white cross on the left arm, a golden longsword in the right hand.',
    'blademaster': 'A sword saint dual wielder: black and crimson samurai armor, a horned kabuto helmet with a red visor slit, a long red scarf flowing behind, two curved katanas, one in each hand, blades bright silver with red edge.',
    'greatswordsman': 'A greatsword berserker: spiky dark hair, rugged face, steel pauldrons and brown leather armor with orange accents, a huge wide steel greatsword resting on the right shoulder, gripped with both hands.',
}
# 2차 (비평 반영): 46칸에서 머리가 작아 보여 마네킹 머리를 키움(22/48), 어두운 몸은 짙은 남회색 3단, 다리 짧고 굵게
STYLE_N2 = ('Pixel art style. One single full-body 2D side-scroller game character sprite, big chunky pixels, '
            'super deformed chibi with an oversized head about one third of the total height, short stocky body, short thick legs, '
            'strict side profile facing right, standing in a ready stance. {who} Flat cel shading with exactly 3 tones per material '
            '(light, mid, shadow), no dithering, no noise, no scattered highlight pixels, bright readable colors, bold 1-pixel dark outline, '
            'plain flat light gray background, nothing else.')
WHO_N2 = {
    'swordsman': 'A young swordsman knight: bright polished silver plate armor (light gray, not blue), a big visored helmet with one clear horizontal visor slit and a blue plume, a royal blue tabard, a short blue cape darker than the tabard, a straight steel longsword held forward in the right hand.',
    'paladin': 'A holy paladin: white plate armor with cream mid tones and gold trim on the chest and shoulders, a golden halo ring floating above the big helmet, a white kite shield with a gold rim and a gold cross on the left arm, a golden longsword in the right hand.',
    'blademaster': 'A sword saint dual wielder: dark slate blue-gray samurai armor plates (not pure black) laced with bright crimson cords, a big horned kabuto helmet with a red visor slit, a long red scarf flowing behind, two curved katanas with gold guards, one held forward low and one held up behind.',
    'greatswordsman': 'A greatsword berserker: big head with spiky black hair, steel pauldrons, mid-brown leather armor with a few wide orange bands, a huge greatsword with a very wide steel blade resting on the right shoulder, both fists on the hilt in front of the chest.',
}
DIRS = {
    'A': 'Cute chibi proportions, about 2.5 heads tall, big helmet, short legs, compact body.',
    'B': 'Stylized proportions about 3 heads tall, slightly bigger head than real, sturdy body, medium legs.',
    'C': 'Heroic slender proportions about 4 heads tall, long legs, broad shoulders, narrow waist, elegant pose.',
}
SEEDS = [11, 23, 37, 51]
HEIGHTS = [35, 46, 52]


def init_img(cls):
    """A 방향 밑그림: 지금 게임 스프라이트(96칸)를 연회색 바탕에 크게"""
    im = Image.open(os.path.join(HERE, 'ref', f'{cls}-guard.png')).convert('RGBA')
    bb = im.getbbox(); im = im.crop((bb[0] - 6, bb[1] - 6, bb[2] + 6, bb[3] + 6))
    s = 900 // max(im.size); im = im.resize((im.width * s, im.height * s), Image.NEAREST)
    bg = Image.new('RGBA', (1024, 1024), (200, 200, 204, 255)); bg.alpha_composite(im, ((1024 - im.width) // 2, (1024 - im.height) // 2))
    return bg.convert('RGB')


# 2차 시도: 등신은 밑그림으로 강제 — 지금 스프라이트의 머리는 두고 목 아래(몸·다리)만 세로로 늘린 그림을 높은 denoise 로 다시 그린다
STRETCH = {'A2': (1.0, 0.82), 'B2': (1.5, 0.82), 'C2': (2.1, 0.85), 'R': (1.5, 0.82)}      # (목 아래 늘림, denoise)
DIRS.update({'A2': DIRS['A'], 'B2': DIRS['B'], 'C2': DIRS['C'], 'R': DIRS['B'], 'S': DIRS['B'], 'N': DIRS['B'], 'N2': DIRS['B']})


def init_stretch(cls, f):
    im = Image.open(os.path.join(HERE, 'ref', f'{cls}-guard.png')).convert('RGBA')
    bb = im.getbbox(); im = im.crop(bb)
    neck = (88 - bb[1]) - 19                       # parts.bands: 목 = 땅 - 19
    head, body = im.crop((0, 0, im.width, neck)), im.crop((0, neck, im.width, im.height))
    body = body.resize((body.width, round(body.height * f)), Image.NEAREST)
    st = Image.new('RGBA', (im.width, head.height + body.height)); st.alpha_composite(head); st.alpha_composite(body, (0, head.height))
    s = 900 / max(st.size); st = st.resize((round(st.width * s), round(st.height * s)), Image.NEAREST)
    bg = Image.new('RGBA', (1024, 1024), (200, 200, 204, 255)); bg.alpha_composite(st, ((1024 - st.width) // 2, (1024 - st.height) // 2))
    return bg.convert('RGB')


def gen(dirs):
    from comfy import gen as G
    os.makedirs(RAW, exist_ok=True)
    for cls in (CLS_ONLY or (WHO_N if dirs in (['N'], ['N2']) else WHO)):
        for dk in dirs:
            todo = [s for s in SEEDS if not os.path.exists(os.path.join(RAW, f'{cls}-{dk}-{s}.png'))]
            for s in todo:
                prompt = STYLE.format(who=(WHO_R if dk == 'R' else WHO)[cls], body=DIRS[dk])
                if dk == 'N2':
                    init = Image.open(os.path.join(D, 'mannequin-3h-b.png')).convert('RGB')
                    ims, dt = G('zimg', STYLE_N2.format(who=WHO_N2[cls]), seed=s, denoise=0.92, init=init)
                elif dk == 'N':          # 컨셉만 보고 새로: 직업 무관 3등신 마네킹 밑그림
                    init = Image.open(os.path.join(D, 'mannequin-3h.png')).convert('RGB')
                    ims, dt = G('zimg', STYLE_N.format(who=WHO_N[cls]), seed=s, denoise=0.92, init=init)
                elif dk == 'S':          # 같은 비율·밝기: 형태가 좋은 검사 B2-11 원본을 밑그림으로, 직업만 바꿔 그린다
                    init = Image.open(os.path.join(RAW, 'swordsman-B2-11.png')).convert('RGB')
                    ims, dt = G('zimg', STYLE.format(who=WHO_R[cls], body=DIRS['B']), seed=s, denoise=0.88, init=init)
                elif dk in STRETCH:
                    f, dn = STRETCH[dk]
                    ims, dt = G('zimg', prompt, seed=s, denoise=dn, init=init_stretch(cls, f))
                elif dk == 'A':
                    ims, dt = G('zimg', prompt, seed=s, denoise=0.68, init=init_img(cls))
                else:
                    ims, dt = G('zimg', prompt, seed=s)
                ims[0].save(os.path.join(RAW, f'{cls}-{dk}-{s}.png'))
                print(cls, dk, s, f'{dt:.1f}s', flush=True)


def fg(im, thr=40):
    a = np.asarray(im.convert('RGB')).astype(np.float32)
    border = np.concatenate([a[0], a[-1], a[:, 0], a[:, -1]]); bgc = np.median(border, axis=0)
    m = np.sqrt(((a - bgc) ** 2).sum(-1)) > thr
    return a, m


def shrink(im, H, ncol=20):
    """1024 그림 → 키 H px 도트: 바탕 떼기 → 상자 → 칸마다 덮인 비율 0.5 이상만, 색은 칸 안 최빈(뭉개짐 방지) → 색 줄이기 → 외곽선"""
    a, m = fg(im)
    ys, xs = np.nonzero(m)
    if len(xs) == 0: return None
    y0, y1 = np.percentile(ys, [0.3, 99.9]); x0, x1 = np.percentile(xs, [0.3, 99.7])
    y0, y1, x0, x1 = int(y0), int(y1) + 1, int(x0), int(x1) + 1
    cell = (y1 - y0) / H
    W = int(np.ceil((x1 - x0) / cell))
    out = np.zeros((H, W, 4), np.uint8)
    q = (a // 24).astype(np.int32)      # 최빈 고를 때 비슷한 색 묶기
    for j in range(H):
        for i in range(W):
            ya, yb = int(y0 + j * cell), int(y0 + (j + 1) * cell); xa, xb = int(x0 + i * cell), int(x0 + (i + 1) * cell)
            mm = m[ya:yb, xa:xb]
            if mm.size == 0 or mm.mean() < 0.5: continue
            cs = a[ya:yb, xa:xb][mm]; key = q[ya:yb, xa:xb][mm]
            kk = key[:, 0] * 10000 + key[:, 1] * 100 + key[:, 2]
            vals, cnt = np.unique(kk, return_counts=True); best = vals[cnt.argmax()]
            out[j, i, :3] = cs[kk == best].mean(0); out[j, i, 3] = 255
    img = Image.fromarray(out, 'RGBA')
    # 색 줄이기 (투명 제외)
    rgb = img.convert('RGB').quantize(colors=ncol, method=Image.Quantize.MEDIANCUT).convert('RGB')
    r = rgb.convert('RGBA'); r.putalpha(img.split()[3])
    # 외곽선: 아주 어두운 칸은 외곽선 색으로, 바깥 가장자리에 1칸
    P = r.load(); Wd, Hd = r.size
    for y in range(Hd):
        for x in range(Wd):
            c = P[x, y]
            if c[3] and c[0] * .3 + c[1] * .59 + c[2] * .11 < 40: P[x, y] = OUT_C + (255,)
    add = [(x, y) for y in range(Hd) for x in range(Wd) if not P[x, y][3] and any(0 <= x + dx < Wd and 0 <= y + dy < Hd and P[x + dx, y + dy][3] and P[x + dx, y + dy][:3] != OUT_C for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))]
    o = Image.new('RGBA', (Wd + 2, Hd + 2)); o.alpha_composite(r, (1, 1)); P = o.load()
    for x, y in add: P[x + 1, y + 1] = OUT_C + (255,)
    for x in range(Wd + 2):
        for y in range(Hd + 2):
            if not P[x, y][3] and any(0 <= x + dx < Wd + 2 and 0 <= y + dy < Hd + 2 and P[x + dx, y + dy][3] and P[x + dx, y + dy][:3] != OUT_C for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                P[x, y] = OUT_C + (255,)
    return o


def shrink_all():
    os.makedirs(PX, exist_ok=True)
    for f in sorted(os.listdir(RAW)):
        if not f.endswith('.png'): continue
        im = Image.open(os.path.join(RAW, f))
        for H in HEIGHTS:
            o = shrink(im, H)
            if o is not None: o.save(os.path.join(PX, f[:-4] + f'-h{H}.png'))
    print('shrunk', len(os.listdir(PX)))


CLS_ONLY = [c for c in os.environ.get('DESIGN_CLS', '').split(',') if c]


if __name__ == '__main__':
    if sys.argv[1] == 'gen': gen(sys.argv[2:] or list(DIRS))
    elif sys.argv[1] == 'shrink': shrink_all()
