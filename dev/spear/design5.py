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


WCOL = {'spear': ((58, 38, 22), (168, 116, 62), (226, 232, 240), (120, 128, 140)),
        'dragon': ((40, 24, 64), (122, 90, 176), (238, 230, 255), (150, 120, 210)),
        'halberd': ((48, 36, 24), (140, 100, 56), (226, 230, 238), (118, 124, 136)),
        'lance': ((40, 44, 56), (160, 168, 186), (238, 242, 250), (48, 84, 178)),
        'glance': ((52, 38, 14), (206, 160, 60), (250, 230, 150), (150, 104, 30))}     # 천마장군 금 랜스 (돌격창 강화형)     # 은색 금속 + 파란 손잡이·보호대 (로드맵: 사탕 줄무늬 → 금속)


def _poly_line(d, p0, p1, w, col):
    a = math.atan2(p1[1] - p0[1], p1[0] - p0[0]); nx, ny = -math.sin(a) * w / 2, math.cos(a) * w / 2
    d.polygon([(p0[0] + nx, p0[1] + ny), (p1[0] + nx, p1[1] + ny), (p1[0] - nx, p1[1] - ny), (p0[0] - nx, p0[1] - ny)], fill=col)


def draw_weapon(im, kind, grip, ang, u, guide=False):
    """u = 도트 한 칸 (1024 기준). 자루 3칸(외곽선 1 + 속 1 + 외곽선 1), 날·깃발·도끼날·원뿔 랜스를 u 격자 크기로"""
    d = ImageDraw.Draw(im); a = math.radians(ang); ca, sa = math.cos(a), math.sin(a)
    P = lambda t, n=0: (grip[0] + ca * t * u - sa * n * u, grip[1] + sa * t * u + ca * n * u)
    out, core, steel, steel2 = WCOL[kind]
    if kind in ('spear', 'dragon', 'halberd'):
        back, front = (-10, 30) if kind != 'halberd' else (-14, 26)
        sw = 4 if kind in ('spear', 'dragon') else 3   # 창기사·용기병 자루: 검수 r2·r3 "약 2px 로 보임" → 4칸(속 2칸)
        _poly_line(d, P(back), P(front), sw * u, out); _poly_line(d, P(back + 0.5), P(front - 0.5), (sw - 2) * u, core)
        if kind == 'spear':
            d.polygon([P(front + 7), P(front + 1, 2), P(front - 1), P(front + 1, -2)], fill=out)
            d.polygon([P(front + 6), P(front + 1.5, 1.2), P(front), P(front + 1.5, -1.2)], fill=steel)
            if not guide:      # 창날 바로 아래 녹색 제비꼬리 깃발
                d.polygon([P(front - 1.5, 1.5), P(front - 1.5, 8), P(front - 4.5, 5.8), P(front - 7.5, 8), P(front - 7.5, 1.5)], fill=(24, 60, 34))      # 검수 r2: 안 읽힘 → 크게·밝게
                d.polygon([P(front - 2.1, 2.1), P(front - 2.1, 7), P(front - 4.5, 5.2), P(front - 6.9, 7), P(front - 6.9, 2.1)], fill=(84, 186, 92))
                d.polygon([P(front - 2.1, 2.1), P(front - 2.1, 3.1), P(front - 6.9, 3.1), P(front - 6.9, 2.1)], fill=(150, 226, 140))
        elif kind == 'dragon':  # 용 이빨 톱니 창날
            pts = [P(front + 9)] + [P(front + 8 - i * 1.6, (2.5 if i % 2 == 0 else 1.5)) for i in range(5)] + [P(front - 1)] + \
                  [P(front + 8 - i * 1.6, -(2.5 if i % 2 == 0 else 1.5)) for i in reversed(range(5))]
            d.polygon(pts, fill=out)
            d.polygon([P(front + 8), P(front + 1, 1.3), P(front), P(front + 1, -1.3)], fill=steel)
        else:                   # 할버드: 위 창끝 · 앞 도끼날 · 뒤 갈고리
            d.polygon([P(front + 8), P(front + 1, 2.0), P(front - 0.5), P(front + 1, -2.0)], fill=out)        # 위 창끝 8칸 · 폭 3칸
            d.polygon([P(front + 7), P(front + 1.2, 1.2), P(front), P(front + 1.2, -1.2)], fill=steel2)
            d.line([P(front + 6.5, 0.3), P(front + 1.5, 0.6)], fill=steel, width=max(1, int(u * 0.9)))
            arc = lambda r, k: [P(front - 3.5 + r * math.sin(math.pi * i / k) * 0 + (r * math.cos(math.pi * (i / k - 0.5))) * 0.0 - 3.5 + 3.5 * math.cos(math.pi * (i / k - 0.5)) * 0, -1.2) for i in range(1)]
            # 반달 도끼날 3단 명암 (검수: "명암 없는 흰 반원이라 깃발·막대사탕처럼"): 어두운 테 → 중간 강철 → 날 쪽 밝은 띠 → 날 끝 흰 1줄
            R = lambda r1, r2, off: [P(front - 3.5 + r1 * math.sin(math.pi * (i / 12 - 0.5)), off + r2 * math.cos(math.pi * (i / 12 - 0.5))) for i in range(13)]
            d.polygon([P(front + 3.7, 1.2)] + R(7.0, 9.8, 1.2) + [P(front - 10.7, 1.2)], fill=out)
            d.polygon([P(front + 1.9, 1.6)] + R(6.0, 8.6, 1.6) + [P(front - 8.9, 1.6)], fill=steel2)
            d.polygon(R(6.0, 8.6, 1.6)[2:11] + list(reversed(R(4.6, 6.2, 1.6)[2:11])), fill=steel)
            d.line(R(5.8, 8.4, 1.6)[3:10], fill=(255, 255, 255), width=max(1, int(u * 0.9)))
            d.polygon([P(front - 1.2, -1.5), P(front - 1.6, -5.5), P(front - 2.8, -6.0), P(front - 5.2, -1.5)], fill=out)   # 뒤 갈고리 3×4칸
            d.polygon([P(front - 1.8, -1.9), P(front - 2.0, -4.6), P(front - 2.6, -4.9), P(front - 4.4, -1.9)], fill=steel2)
    else:                       # 랜스: 손 뒤 짧은 자루, 손 앞 둥근 보호대, 밑동 7칸 → 끝 2칸 원뿔
        _poly_line(d, P(-6), P(1), 3 * u, out); _poly_line(d, P(-5.5), P(0.5), 1 * u, (110, 80, 50))
        # 원뿔: 밑동 7칸 → 중간까지 5칸 유지 → 끝 몇 칸에서만 좁아짐 (검수 "앞쪽 절반이 빨리 가늘어져 점선처럼")
        # 검수(2026-10-17 r2): 흰 한 톤 날이 칼·광선처럼 → 밑동 9칸으로 굵게, 은 3단(아랫면 그늘 · 중간 은 · 위 1줄 하이라이트)
        d.polygon([P(2, 4.6), P(18, 3.6), P(28, 2.4), P(33.5, 0), P(28, -2.4), P(18, -3.6), P(2, -4.6)], fill=out)
        d.polygon([P(2.5, 3.7), P(18, 2.7), P(27.5, 1.6), P(32.6, 0.5), P(32.6, -0.5), P(27.5, -1.6), P(18, -2.7), P(2.5, -3.7)], fill=steel)   # 중간 은
        d.polygon([P(3, 3.7), P(18, 2.7), P(27.5, 1.5), P(27.5, 0.9), P(18, 1.9), P(3, 2.7)], fill=(236, 240, 248))                         # 위 하이라이트 1줄
        if not guide:
            # 은색 원뿔 명암: 아래쪽 그늘 1줄 (위 흰 하이라이트는 위에서 그림) — 사탕 줄무늬는 뺐다 (로드맵 2026-10-17)
            rad = lambda t: 3.7 - (t - 2.5) * 1.0 / 15.5 if t <= 18 else 2.7 - (t - 18) * 1.1 / 9.5
            d.polygon([P(2.5, -rad(2.5)), P(18, -rad(18)), P(27.5, -rad(27.5)), P(27.5, -rad(27.5) + 0.9), P(18, -rad(18) + 1.5), P(2.5, -rad(2.5) + 1.8)], fill=(96, 104, 124))
            _poly_line(d, P(-6), P(1), 3 * u, out); _poly_line(d, P(-5.5), P(0.5), 1 * u, steel2)      # 파란 손잡이
        g = P(1.2)
        d.ellipse([g[0] - 5.6 * u, g[1] - 5.6 * u, g[0] + 5.6 * u, g[1] + 5.6 * u], fill=out)        # 보호대가 날보다 확실히 크게 (코등이로 안 읽히게)
        d.ellipse([g[0] - 4.6 * u, g[1] - 4.6 * u, g[0] + 4.6 * u, g[1] + 4.6 * u], fill=steel2 if not guide else (190, 196, 210))   # 파란 보호대
        d.ellipse([g[0] - 1.6 * u, g[1] - 2.8 * u, g[0] + 0.4 * u, g[1] - 1.2 * u], fill=(120, 160, 236))


# 창기사 v6 (검수 regen: "갑옷 면이 돌 얼룩, 투구·둥근 어깨·녹색이 안 섬") — 프롬프트만 바꿔 같은 가이드로 다시
SPEC['lancer6'] = dict(SPEC['lancer'], who=(
    'A young lancer knight warrior, proud upright stance with chest out, clean flat polished steel plate armor with large smooth shading '
    'planes and a few crisp highlights, big rounded steel shoulder pauldrons, a closed knight great helm with a dark horizontal visor slit '
    'and a small green plume, a forest green tabard over the breastplate down to the knees, a short green cape, gripping a thick wooden '
    'spear in the front hand. Smooth metal, not stone, not rock texture, not mottled, no hood.' + LIGHT))


# 용기병 v7 (사용자 확정 2026-10-17 "사람기사로가야해" — v6 은 용인간으로 읽힘): 사람 기사 + 용 머리 모양 투구, 꼬리 없음
SPEC['dragoon7'] = dict(SPEC['dragoon'], tail=False, who=(
    'A human knight in purple plate armor engraved with a dragon scale pattern, wearing a closed helmet shaped like a dragon head: a long '
    'snout visor with small fangs and two horns swept back, glowing yellow eye slits, a human face hidden inside the helmet, a dark purple '
    'cloth cape cut in the shape of bat wings hanging from the shoulders, steel gauntlets, human legs in steel greaves and armored boots, '
    'standing upright like a soldier, gripping a thick dragon spear in the front hand. A human knight, not a lizard man, no tail, not a beast.'
    + LIGHT))

# v7 4장이 모두 용 머리(용인간)로 나왔다 — '용 머리' 단어를 빼고 사람 기사 투구 + 용 장식으로
SPEC['dragoon8'] = dict(SPEC['dragoon7'], who=(
    'A human knight soldier in a closed great helm with a T-shaped visor slit, a small dragon crest on top of the helmet and two short '
    'curved horns at the sides, the helmet has a human head shape, purple steel plate armor with a scale pattern on the chest, round '
    'pauldrons, a tattered dark purple cloth cape with a jagged bat wing edge, steel greaves and boots, standing straight, gripping a long '
    'spear. Ordinary human body proportions, no tail, no snout, no animal head.' + LIGHT))
SPEC['dragoon9'] = dict(SPEC['dragoon7'], who=(
    'A medieval human knight, a dragoon soldier, wearing a horned purple armet helmet with a pointed visor and yellow eye slits, a scale '
    'mail chest plate, layered purple plate armor, a short dark cape whose hem is cut like dragon wings, steel boots, upright heroic stance, '
    'holding a long purple spear. A man in armor, human helmet, no tail, no lizard features.' + LIGHT))

# v10: 형태 1위 dragoon8-11(뿔 투구·날개 망토·3등신 사람 기사)을 바탕으로 0.55 다시 그리기 — 보라 비늘 판금·짧은 용 주둥이 면갑
SPEC['dragoon10'] = dict(SPEC['dragoon7'], base='dragoon8-11', den=0.55, who=(
    'A chibi human knight in a closed steel helmet with a short dragon snout shaped visor, two curved horns and a yellow eye slit, '
    'deep purple plate armor with a lavender dragon scale pattern on the chest and pauldrons, a dark purple bat wing shaped cloth cape, '
    'steel greaves and boots, standing straight, holding a long purple spear. Human knight, no tail.' + LIGHT))

# v11 (검수 r2 공통 "3등신 아닌 6등신 사실 비율", 용기병 "용 투구 특징 없음"): 큰 머리 3등신 치비 문구를 앞에 박고 직업 특징 강조
CHIBI = ('Chibi 3-heads-tall proportions: a big head as tall as the torso, short sturdy torso, short legs, clearly visible neck guard '
         'between head and body, side view facing right. ')
SPEC['lancer11'] = dict(SPEC['lancer'], who=CHIBI + (
    'A young lancer knight, proud upright stance, a big rounded steel knight helmet with a visor slit and a small green plume, big round '
    'steel pauldrons, a bright forest green tabard covering the chest and hanging to the knees, a short green cape, holding a thick wooden '
    'spear with a small green swallowtail pennant under the spearhead.' + LIGHT))
SPEC['dragoon11'] = dict(SPEC['dragoon7'], who=CHIBI + (
    'A human dragoon knight wearing a big dragon helmet: the visor juts forward like a short dragon snout with two small white fangs, a '
    'yellow glowing eye slit, two long horns curving backward from the back of the helmet; purple plate armor with lavender scale pattern '
    'highlights, a dark indigo bat wing shaped cloth cape behind the shoulders, steel boots, standing straight, holding a long purple '
    'dragon spear. Human knight body, no tail.' + LIGHT))
SPEC['halberdier11'] = dict(SPEC['halberdier'], who=CHIBI + (
    'A heavy halberdier, a big steel bucket helmet with one horizontal eye slit, huge square steel pauldrons much wider than the hips, '
    'inverted triangle torso, narrow waist with a thick belt and bright buckle, a bright orange cloth tabard hanging over the thighs to '
    'the knees, steel greaves, holding a thick halberd vertically with a big crescent axe blade. Not fat, no round belly.' + LIGHT))
SPEC['cavalier11'] = dict(SPEC['cavalier'], who=CHIBI + (
    'A cavalry lancer knight, a big crested steel helmet with a tall bright red feather plume, a bright royal blue surcoat over silver plate '
    'armor, a red heraldic kite shield on the far arm, holding a huge thick conical silver jousting lance with a round blue vamplate '
    'pointing forward.' + LIGHT))

# v12 (검수 r3: 창기사 "얼굴 없는 회색 덩어리 골렘", 용기병 "면갑·얼굴 없는 뿔 머리 = 가고일") — 그림체 B 기준(마법사·레인저)은 얼굴이 보인다 → 얼굴이 트인 투구
SPEC['lancer12'] = dict(SPEC['lancer'], who=CHIBI + (
    'A young lancer knight with a visible human face: big round eyes and a determined expression under an open-faced steel sallet helmet '
    'with cheek guards and a small green plume, a bright forest green tabard over a polished silver breastplate hanging to the knees, '
    'small round steel pauldrons, a short green cape behind, proud upright stance with chest out, holding a thick wooden spear with a '
    'small green swallowtail pennant under the spearhead.' + LIGHT))
SPEC['dragoon12'] = dict(SPEC['dragoon7'], who=CHIBI + (
    'A human dragoon knight with a visible human face: the helmet is shaped like a dragon head whose upper jaw with small fangs juts '
    'forward over the forehead like a visor brim, the young human face with a stern expression is clearly visible under it, two horns '
    'curve backward from the helmet, a yellow gem on the brow; purple plate armor with lavender scale pattern, a dark indigo cloth cape '
    'with a jagged bat wing hem hanging from the shoulders, steel boots, standing straight, holding a long purple dragon spear. Human '
    'knight, no tail.' + LIGHT))

# 3차 (2026-10-17 로드맵 승인): 2차 합격 디자인을 잇고 3등신·얼굴 보이는 투구 (닫힌 투구는 46px 에서 덩어리)
SPEC['dragonlord13'] = dict(SPEC['dragoon7'], who=CHIBI + (
    'A human dragon lord knight king with a visible young human face: a golden dragon crown helmet whose upper jaw juts over the forehead, '
    'four golden horns sweeping backward, a stern face under it; ornate deep purple and gold plate armor with lavender scale highlights, '
    'a large double-layered bat wing shaped royal cloth cape in purple and crimson, gold trim, standing proudly, holding a long golden '
    'dragon spear with a jagged fang blade. Human knight, no tail.' + LIGHT))
SPEC['warlord13'] = dict(SPEC['halberdier'], who=CHIBI + (
    'A heavy warlord knight with a visible stern human face under a black iron helmet with two big curved bull horns and a half face mask '
    'covering only the mouth, huge spiked black iron pauldrons much wider than the hips, blackened copper plate armor, a narrow belted '
    'waist, a tattered blood red cape, standing upright holding a huge thick axe halberd vertically with a big crescent axe blade. Not fat.' + LIGHT))
SPEC['skyGeneral13'] = dict(SPEC['cavalier'], wpn='glance', who=CHIBI + (
    'A heavenly sky general knight with a visible young human face: a white and gold winged helmet with two small white feather wings at '
    'the sides, a thin golden halo ring floating behind the head, white and gold plate armor, a sky blue cape, a large round gold-rimmed '
    'white tower shield on the far arm, holding a huge thick conical golden jousting lance pointing forward.' + LIGHT))


def gen(classes, seeds=None):
    sys.path.insert(0, os.path.join(HERE, '..', 'comfy'))
    from comfy import gen as G
    for cls in classes:
        gd = mannequin(SPEC[cls]) if 'base' not in SPEC[cls] else Image.open(os.path.join(RAW, SPEC[cls]['base'] + '.png')).convert('RGB')
        gd.save(os.path.join(RAW, f'_guide5-{cls}.png'))
        for s in seeds or D.SEEDS:
            out = os.path.join(RAW, f'{cls}5-{s}.png' if not cls[-1].isdigit() else f'{cls}-{s}.png')
            if os.path.exists(out): continue
            ims, dt = G('zimg', D.SW.STYLE.format(who=SPEC[cls]['who'], body=D.BODY), seed=s, denoise=SPEC[cls].get('den', 0.85), init=gd)
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
