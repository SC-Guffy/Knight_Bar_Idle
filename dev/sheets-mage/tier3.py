# 마법사 계열 3차 = 2차 시트 편집 (로드맵 승인 2026-10-17 안 B: usage 0, 안 되면 그 직업만 안 A 재생성)
#  2차 후처리 결과(skel/<2차>/<A|B>-body/, -pose.json = 지팡이 덧그리기 전 몸·손 점·각도)에
#  3차 소품(왕관·뿔·견갑·고리)을 프레임 관절(req-*.json keypoints)에 맞춰 붙이고, 옷 색을 3차 램프로 바꾸고, 3차 지팡이(게임 캡처 1.5배)를 덧그린다.
#  소품은 머리 기울기(목→눈 가운데)·어깨 기울기(어깨→팔꿈치)를 기준 자세 대비로 따라 돌린다 (공용 wpn.rotsprite).
#  python -I -B tier3.py <3차 cls>   → skel/<3차>/<A|B>-wpn/0..14.png, -tips.json, post-<A|B>.png (줄: 2차 / 3차)
import os, sys, json, math
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, os.path.join(ROOT, 'dev', 'sheets-common')); sys.path.insert(0, HERE)
from wpn import WeaponSprite, overlay, rotsprite

O = (11, 13, 20)


def outline(px):
    """{(x,y): 색} 둘레에 외곽선 칸을 더한다"""
    out = dict(px)
    for (x, y) in px:
        for a, b in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            q = (x + a, y + b)
            if q not in px: out[q] = O + (255,)
    return out


def to_img(px, pad=2):
    xs = [p[0] for p in px]; ys = [p[1] for p in px]; x0, y0 = min(xs) - pad, min(ys) - pad
    im = Image.new('RGBA', (max(xs) - x0 + pad + 1, max(ys) - y0 + pad + 1)); P = im.load()
    for (x, y), c in px.items(): P[x - x0, y - y0] = c
    return im, (-x0, -y0)       # 원점(0,0)이 그림의 어디인지


def spikes(spec, band=None, cols=None):
    """얼음·번개 결정 뾰족 묶음. spec = [(가운데 x, 높이, 밑 너비)] — 밑이 y=0, 위로 자람(음수 y).
    cols = (밝은 끝, 밝음, 가운데, 그늘) · band = (x0, x1, 두께) 아래 띠"""
    tip, li, mid, dk = [c + (255,) for c in cols]; px = {}
    for cx, h, w in spec:
        for k in range(h):
            y = -k; half = max(0, round((w - 1) / 2 * (1 - k / h)))
            for x in range(cx - half, cx + half + 1):
                c = tip if k >= h - 2 else (dk if x < cx - half + 1 and half > 0 else (li if x >= cx else mid))
                px[(x, y)] = c
    if band:
        x0, x1, t = band
        for y in range(1, t + 1):
            for x in range(x0, x1 + 1): px[(x, y)] = (li if y == 1 else mid) if (x - x0) % 4 else tip
    return outline(px)


# ── 3차 설정 ──
CONF = {
    'frostlord': dict(
        src='cryomancer',
        # 옷 램프: 빙결술사 하늘·파랑 → 흰·은빛 얼음 (짙은 남색은 그대로 두어 외곽 대비 유지)
        recolor={(45, 109, 174): (112, 158, 204), (64, 148, 202): (156, 202, 232), (79, 167, 217): (196, 230, 246),
                 (76, 130, 186): (128, 170, 212), (72, 112, 159): (96, 136, 184), (99, 133, 173): (140, 172, 206),
                 (124, 165, 194): (176, 206, 228), (143, 178, 203): (204, 226, 240)},
        # 왕관: 후드 꼭대기에 얹는 뾰족 얼음 결정 (가운데가 가장 높다) · 기준 자세에서 정수리 기준 (dx, dy)
        crown=dict(spec=[(0, 4, 3), (3, 6, 3), (6, 9, 5), (9, 6, 3), (12, 4, 3)], band=(0, 12, 2), off=(-6, 1),
                   cols=((255, 255, 255), (200, 239, 243), (120, 190, 230), (40, 80, 150))),
        # 견갑: 앞 어깨에 위·뒤로 솟는 결정 셋 (뒤 어깨는 몸 뒤에)
        pauldron=dict(spec=[(0, 5, 3), (3, 8, 5), (7, 5, 3)], off=(-4, -2),
                      cols=((255, 255, 255), (200, 239, 243), (120, 190, 230), (40, 80, 150))),
        staff=1.5,
    ),
}


def head_anchor(body, kp):
    """정수리: 머리 관절(귀·눈) 가운데 x ±7 칸에서 가장 위 칸"""
    hx = sum(kp[k][0] for k in ('RIGHT EAR', 'LEFT EAR', 'RIGHT EYE', 'LEFT EYE')) / 4
    B = body.load(); W, H = body.size
    for y in range(H):
        xs = [x for x in range(int(hx - 7), int(hx + 8)) if 0 <= x < W and B[x, y][3]]
        if xs: return (sum(xs) / len(xs), y)
    return (hx, 0)


def ang(a, b): return math.degrees(math.atan2(b[1] - a[1], b[0] - a[0]))


def paste(dst, im, piv, at, deg, over=True):
    """im 을 piv 점 기준으로 deg 만큼 돌려 dst 의 at 에 놓는다. over=False 면 이미 칠한 칸은 건드리지 않는다(몸 뒤)"""
    r, p = rotsprite(im, deg, piv) if abs(deg) > 1 else (im, piv)
    x0, y0 = round(at[0] - p[0]), round(at[1] - p[1]); R = r.load(); D = dst.load()
    for y in range(r.height):
        for x in range(r.width):
            c = R[x, y]
            if c[3] and 0 <= x0 + x < dst.width and 0 <= y0 + y < dst.height and (over or not D[x0 + x, y0 + y][3]): D[x0 + x, y0 + y] = c


def build(cls):
    C = CONF[cls]; src = os.path.join(HERE, 'skel', C['src']); d = os.path.join(HERE, 'skel', cls); os.makedirs(d, exist_ok=True)
    import mannequin as MQ
    g0 = MQ.staff_sprite(cls, MQ.parts(cls)[1]); k = C['staff']
    ws = WeaponSprite(g0.img.resize((round(g0.img.width * k), round(g0.img.height * k)), Image.NEAREST), (g0.grip[0] * k, g0.grip[1] * k), g0.ang)
    WI = ws.img.load()
    ltip = max(((x - ws.grip[0]) * math.cos(ws.ang) + (y - ws.grip[1]) * math.sin(ws.ang)) for y in range(ws.img.height) for x in range(ws.img.width) if WI[x, y][3])
    crown, cpiv = to_img(spikes(C['crown']['spec'], C['crown'].get('band'), C['crown']['cols']))
    paul, ppiv = to_img(spikes(C['pauldron']['spec'], None, C['pauldron']['cols']))
    for part in 'AB':
        req = json.load(open(os.path.join(src, f'req-{part}.json'))); poses = json.load(open(os.path.join(src, f'{part}-pose.json')))
        KP = [{q['label']: (q['x'] * 96, q['y'] * 96) for q in f} for f in req['keypoints']]
        if part == 'A': KP[0] = KP[14]
        base = KP[14] if part == 'A' else KP[0]
        h_base = ang(base['NECK'], ((base['RIGHT EYE'][0] + base['LEFT EYE'][0]) / 2, (base['RIGHT EYE'][1] + base['LEFT EYE'][1]) / 2))
        s_base = ang(base['RIGHT SHOULDER'], base['RIGHT ELBOW'])
        out_d = os.path.join(d, f'{part}-wpn'); os.makedirs(out_d, exist_ok=True); tips = []; rows = []
        for i in range(15):
            body = Image.open(os.path.join(src, f'{part}-body', f'{i}.png')).convert('RGBA'); kp = KP[i]; pz = poses[i]
            B = body.load()
            for y in range(96):
                for x in range(96):
                    c = B[x, y]
                    if c[3] and c[:3] in C['recolor']: B[x, y] = C['recolor'][c[:3]] + (255,)
            eye = ((kp['RIGHT EYE'][0] + kp['LEFT EYE'][0]) / 2, (kp['RIGHT EYE'][1] + kp['LEFT EYE'][1]) / 2)
            dh = ang(kp['NECK'], eye) - h_base; dh = (dh + 180) % 360 - 180
            ds = ang(kp['RIGHT SHOULDER'], kp['RIGHT ELBOW']) - s_base; ds = (ds + 180) % 360 - 180
            ds = max(-50, min(50, ds * 0.5))      # 견갑은 팔을 반만 따라간다 (어깨에 붙은 판)
            fr = Image.new('RGBA', (96, 96))
            # 몸 뒤: 뒤 어깨 견갑
            paste(fr, paul, (ppiv[0] - C['pauldron']['off'][0], ppiv[1] - C['pauldron']['off'][1]), kp['LEFT SHOULDER'], ds)
            fr.alpha_composite(body)
            # 몸 앞: 왕관 · 앞 어깨 견갑
            top = head_anchor(body, kp)
            paste(fr, crown, (cpiv[0] - C['crown']['off'][0], cpiv[1] - C['crown']['off'][1]), top, dh)
            paste(fr, paul, (ppiv[0] - C['pauldron']['off'][0], ppiv[1] - C['pauldron']['off'][1]), kp['RIGHT SHOULDER'], ds)
            g, a = pz['g'], pz['a']; t = (g[0] + 20 * math.cos(a), g[1] + 20 * math.sin(a))
            o = overlay(fr, set(), g, t, ws, front=[tuple(p) for p in pz['front']])
            O_ = o.load(); F = body.load(); foot = body.getbbox()[3] - 1
            for y in range(foot + 1, 96):
                for x in range(96):
                    if O_[x, y][3] and not F[x, y][3]: O_[x, y] = (0, 0, 0, 0)
            o.save(os.path.join(out_d, f'{i}.png')); tips.append([round(g[0] + ltip * math.cos(a)), round(g[1] + ltip * math.sin(a))])
            rows.append((Image.open(os.path.join(src, f'{part}-wpn', f'{i}.png')).convert('RGBA'), o))
        json.dump(tips, open(os.path.join(d, f'{part}-tips.json'), 'w'))
        S = 3; W = 96 * S; mont = Image.new('RGBA', (W * 15, W * 2), (24, 26, 34, 255))
        for i, (a2, a3) in enumerate(rows):
            mont.alpha_composite(a2.resize((W, W), Image.NEAREST), (i * W, 0)); mont.alpha_composite(a3.resize((W, W), Image.NEAREST), (i * W, W))
        mont.save(os.path.join(d, f'post-{part}.png'))
    print('tier3', cls)


if __name__ == '__main__':
    build(sys.argv[1])
