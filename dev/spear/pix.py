# 창기사 계열 기준 그림 정리 (로드맵 승인 2026-10-17: PixelLab image-to-pixelart 256→64 fixer, 직업당 1회·재시도 0, + 검사 세션 polish.py).
#  ComfyUI 원본은 1024 에서 도트 한 칸이 6~7px(키 약 120칸)이라 46칸으로 직접 줄이면 명암·디테일이 섞인다(검사 세션 분석).
#  prep: 원본에서 몸 높이(공용 shrink.body_bounds)를 재서, 64 출력에서 몸 키가 46칸이 되도록 정사각형으로 잘라 256 으로 → work/pl/<이름>-256.png
#  (PixelLab 호출은 plx.py pixelart — 세션이 직접 부른다) → post: 바탕 떼기 → polish(14색·외톨이 점·1px 외곽선·위 테) → work/pl/<이름>-polish.png
#   C:\AI\ComfyUI\.venv\Scripts\python.exe -I -B pix.py prep <원본 이름 ...>      (예: lancer5-11)
#   ... pix.py post <원본 이름 ...>
import os, sys, importlib.util
import numpy as np
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, os.path.join(HERE, '..', 'sheets-common')); sys.path.insert(0, HERE)
from shrink import body_bounds, _SW
RAW = os.path.join(HERE, 'design', 'raw'); PL = os.path.join(HERE, 'work', 'pl'); os.makedirs(PL, exist_ok=True)
_sp = importlib.util.spec_from_file_location('sw_polish', os.path.join(HERE, '..', 'sheets-sword', 'polish.py'))
POL = importlib.util.module_from_spec(_sp); _sp.loader.exec_module(POL)
BODY, OUTN = 46, 64
import re


def parse(name):
    """'lancer5-51' → ('lancer', 'lancer'), 'lancer6-51' → ('lancer', 'lancer6') : (직업 = 작업 폴더·수리 키, design5.SPEC 키)"""
    m = re.match(r'([A-Za-z]+)(\d+)-', name); return m.group(1), (m.group(1) if m.group(2) == '5' else m.group(1) + m.group(2))
# 정리본 검수 fix 판정에 따른 수리 단계 (fix.py)
#  창기사: v6 정리본은 갑옷이 이미 매끈해 tidy·green 이 오히려 하이라이트를 지운다 (v5 51 에만 썼다)
#  할버디어: surcoat_up 은 허리에 주황 네모 조각처럼 붙어 뺐다
FIX = {'lancer': ('surcoat_green',),          # 검수 r2: 녹색 없음
       'dragoon': ('purple_plate',),          # v8 사람 기사(dragoon8-11): 은 → 보라 판금. tidy·belly 는 v6 용인간용
       'halberdier': ('surcoat_orange', 'tabard', 'shoulders'),   # tabard: 반바지처럼 갈린 주황 → 한 장 서코트 (로드맵 2026-10-17)
       'cavalier': ('surcoat_blue', 'red_up')}
# v11 3등신 재정리본 (SPEC 키별): 이미 색이 맞아 수리가 적다. 용기병만 은→보라 판금
FIX.update({'dragonlord13': ('plate_flat', 'purple_split'), 'warlord13': ('red_cape',), 'skyGeneral13': ('plate_flat', 'gold_shield'),   # 3차
            'lancer12': ('green_up', 'plate_flat', 'surcoat_green'), 'dragoon12': ('plate_flat', 'purple_split'),   # plate_flat: 검수 r4 점박이 잡음
             'lancer11': ('green_up',), 'dragoon11': ('purple_light',), 'halberdier11': (), 'cavalier11': ('surcoat_blue',)})   # 정리본 녹색·파랑이 탁하고 작다
# 무기를 얹은 뒤 하는 수리: 용기병 노란 눈 (무기 색을 빼야 머리 앞 끝을 찾는다)
AFTER = {'dragoon': ('eye_after',), 'dragonlord': ('gold_debris',)}
FIST = set()             # v6 정리본은 쥔 손이 보임


def frame(name):
    """원본 → (자른 상자 x0, y0, 변 S). 몸 키 = 46/64 · S, 발바닥은 아래에서 4/64 · S 위"""
    im = Image.open(os.path.join(RAW, name + '.png')).convert('RGB')
    top, foot = body_bounds(im)
    S = (foot - top) * OUTN / BODY
    _, m = _SW.fg(im); cols = np.nonzero(m[top:foot + 1].any(0))[0]
    cx = (cols.min() + cols.max()) / 2
    y1 = foot + 4 * S / OUTN; y0 = y1 - S; x0 = cx - S / 2
    return im, (x0, y0, S)


def prep(name):
    im, (x0, y0, S) = frame(name)
    a = np.asarray(im); bg = tuple(int(v) for v in np.median(np.concatenate([a[0], a[-1], a[:, 0], a[:, -1]]), axis=0))
    big = Image.new('RGB', (2048, 2048), bg); big.paste(im, (512, 512))                     # 상자가 원본 밖으로 나가도 되게 바탕색으로 넓힌다
    c = big.crop((round(x0 + 512), round(y0 + 512), round(x0 + 512 + S), round(y0 + 512 + S))).resize((256, 256), Image.LANCZOS)
    p = os.path.join(PL, f'{name}-256.png'); c.save(p)
    print(name, 'box', [round(x0), round(y0), round(S)], '->', p)


def grip64(name):
    """가이드 손 점·각도(design5.SPEC) → 64 출력 좌표 (자르기 상자 기준)"""
    import design5 as D5
    _, cls = parse(name); im, (x0, y0, S) = frame(name)
    top, foot = body_bounds(im); sc = (foot - top) / (D5.F0 - D5.T0)
    g = (D5.CX + (D5.GRIP[0] - D5.CX) * sc, top + (D5.GRIP[1] - D5.T0) * sc)
    return ((g[0] - x0) / S * OUTN, (g[1] - y0) / S * OUTN), D5.SPEC[cls]['ang'], D5.SPEC[cls]['wpn']


def wpnfix(im, name, off):
    """정리본(64 → 자르기 off) 무기 바꾸기: 기대 직선 근처 칸으로 직선을 맞추고(공용 wpn.line_fit), 모델 무기 칸을 지운 뒤
    같은 직선에 코드 무기(design5.draw_weapon, 8배로 그려 칸 가운데 표본)를 얹는다. 자루 3px·창날·깃발·도끼날·원뿔 랜스"""
    import math, design5 as D5
    from wpn import line_fit, near_line, fill_holes
    (gx, gy), ang, kind = grip64(name); gx -= off[0]; gy -= off[1]
    a = math.radians(ang); d = (math.cos(a), math.sin(a)); P = im.load(); W, H = im.size
    pts = [(x, y) for y in range(H) for x in range(W) if P[x, y][3]]
    near = near_line(pts, (gx, gy), d, 3.0, 3, 60)                     # 손에서 앞쪽(무기 쪽)만
    c, dd, inl = line_fit(near, tol=1.2) if len(near) >= 6 else (None, None, [])
    if len(inl) >= 6:
        if dd[0] * d[0] + dd[1] * d[1] < 0: dd = (-dd[0], -dd[1])
        t = (gx - c[0]) * dd[0] + (gy - c[1]) * dd[1]; gx, gy = c[0] + dd[0] * t, c[1] + dd[1] * t       # 손 점을 맞춘 직선 위로
        ang = math.degrees(math.atan2(dd[1], dd[0]))
        erase = set(near_line(pts, (gx, gy), dd, 2.5, 3, 60))        # 모델 무기 (손 앞) — 1.6 이면 원래 창대가 옆에 한 줄 남았다
        for p in erase: P[p] = (0, 0, 0, 0)
        fill_holes(im, erase)
    # 코드 무기: 큰 캔버스에 8배로 그려 칸 가운데 표본 → 바탕(투명) 위 무기 칸만 덮는다
    M = 40; Z = 8
    big = Image.new('RGB', ((W + 2 * M) * Z, (H + 2 * M) * Z), (255, 0, 255))
    D5.draw_weapon(big, kind, ((gx + M + 0.5) * Z, (gy + M + 0.5) * Z), ang, Z)
    BP = big.load()
    o = Image.new('RGBA', (W + 2 * M, H + 2 * M)); o.alpha_composite(im, (M, M)); O = o.load()
    for y in range(H + 2 * M):
        for x in range(W + 2 * M):
            c_ = BP[x * Z + Z // 2, y * Z + Z // 2]
            if c_ != (255, 0, 255): O[x, y] = c_ + (255,)
    bb = o.getbbox()
    return o.crop(bb), (gx + M - bb[0], gy + M - bb[1])


def reduce(im, n):
    """색 줄이기 (v11): 가장 적게 쓰인 색을 가장 가까운 색에 합치기를 n 색까지 — median-cut 은 작은 색 영역(빨간 볏·파랑 서코트·녹색 깃발)을
    회색 덩어리에 섞어 지웠다. 비슷한 색끼리 먼저 합쳐지므로 작아도 뚜렷한 색 영역은 남는다"""
    from collections import Counter
    im = im.copy(); P = im.load(); W, H = im.size
    cnt = Counter(P[x, y][:3] for y in range(H) for x in range(W) if P[x, y][3])
    rep = {c: c for c in cnt}
    ch = lambda c: max(c) - min(c)
    d2 = lambda a, b: 3 * (a[0] - b[0]) ** 2 + 4 * (a[1] - b[1]) ** 2 + 2 * (a[2] - b[2]) ** 2 + 12 * (ch(a) - ch(b)) ** 2   # 채도 차 벌점: 유채색이 회색에 먹히지 않게
    skin = lambda c: c[0] > 150 and c[0] - c[2] > 30 and c[1] > 100 and c[0] - c[1] < 70     # 얼굴 살색: 칸이 적어도 합칠 차례를 늦춘다 (창기사 v12 얼굴이 사라졌다)
    wt = lambda c: cnt[c] * (6 if skin(c) else 1)
    while len(cnt) > n:
        c = min(cnt, key=wt); k = cnt.pop(c)
        t = min(cnt, key=lambda o: d2(c, o)); cnt[t] += k
        for a in rep:
            if rep[a] == c: rep[a] = t
    for y in range(H):
        for x in range(W):
            if P[x, y][3]: P[x, y] = rep[P[x, y][:3]] + (255,)
    return im


def POL_comps(im):
    P = im.load(); W, H = im.size; left = {(x, y) for y in range(H) for x in range(W) if P[x, y][3]}; out = []
    while left:
        st = [left.pop()]; c = set(st)
        while st:
            x, y = st.pop()
            for a in (-1, 0, 1):
                for b in (-1, 0, 1):
                    q = (x + a, y + b)
                    if q in left: left.discard(q); c.add(q); st.append(q)
        out.append(c)
    return out


def shrink64(name):
    """축소본 (로드맵 2026-10-17, 검사 계열 교훈: 시안이 46칸에서 이미 또렷하면 image-to-pixelart 가 손·표정을 지운다):
    원본을 공용 shrink_body 로 몸 키 46칸 도트로 줄여 정리본(64)과 같은 자리(발 y=60, 가운데 x=32)에 놓는다 → work/<cls>/<name>-sh-0.png"""
    from shrink import shrink_body
    cls, _ = parse(name)
    im = Image.open(os.path.join(RAW, name + '.png')).convert('RGB'); top, foot = body_bounds(im)
    o = shrink_body(im, top, foot, BODY, shadow=False).convert('RGBA'); bb = o.getbbox(); o = o.crop(bb)
    c = Image.new('RGBA', (OUTN, OUTN), (200, 200, 204, 255))       # 정리본처럼 단색 바탕 (unbg 가 뗀다)
    c.alpha_composite(o, (OUTN // 2 - o.width // 2, OUTN - 4 - o.height))
    c.save(os.path.join(HERE, 'work', cls, f'{name}-sh-0.png'))


def post(name, src='pl'):
    cls, sk = parse(name)
    if src == 'sh': shrink64(name)
    raw = Image.open(os.path.join(HERE, 'work', cls, f'{name}-{src}-0.png')).convert('RGBA')
    clean = POL.unbg(raw); bb = clean.getbbox(); clean = clean.crop(bb)
    # v11: 공용 polish 의 14색 줄이기가 작은 색 영역(녹색 서코트·빨간 볏·주황 천)을 회색에 섞어 지운다 → 20색으로 (공용 파일은 그대로)
    pol = POL.rim(POL.outline(POL.despeckle((reduce(clean.copy(), 22) if sk != cls else POL.quant(clean.copy(), 14)))))   # 손질 먼저 (무기 색이 14색 줄이기에 섞여 몸 색이 탁해지지 않게)
    import fix as FX                                     # 검수 fix 판정 수리 (스크립트) — 직업별
    for step in FIX.get(sk, FIX.get(cls, ())):
        pol = getattr(FX, step)(pol)
    pol, g = wpnfix(pol, name, (bb[0] - 1, bb[1] - 1))  # polish 의 외곽선 1칸 여백만큼 원점이 옮겨짐
    if cls in FIST: pol = FX.fist(pol, g)
    import design5 as D5
    wcols = {c for c in __import__('itertools').chain.from_iterable(D5.WCOL.values())}
    for step in (AFTER.get(cls, ()) if sk not in FIX or sk == cls or cls == 'dragonlord' else ()):     # v11 은 눈이 이미 있음
        pol = getattr(FX, step)(pol, wcols)
    from wpn import fill_holes  # noqa (무기 지운 자리 메우기는 wpnfix 안에서)
    P_ = pol.load(); comps = POL_comps(pol)                 # 떨어진 6칸 미만 조각 지우기 (검수: 자루 옆 '!' 부스러기)
    if comps:
        big = max(len(c) for c in comps)
        for c in comps:
            if len(c) < 6 and len(c) < big:
                for p_ in c: P_[p_] = (0, 0, 0, 0)
    pol = reduce(pol, 18) if sk != cls else POL.quant(pol, 20)   # 위 테 밝히기·무기 색으로 25~30색이 돼 색 경보(>24) → 마지막에 20색
    tag = '' if src == 'pl' else '-sh'
    clean.save(os.path.join(PL, f'{name}{tag}-clean.png')); pol.save(os.path.join(PL, f'{name}{tag}-polish.png'))
    print(name, 'clean', clean.size, 'polish', pol.size)


if __name__ == '__main__':
    fn = {'prep': prep, 'post': post, 'postsh': lambda n: post(n, 'sh')}[sys.argv[1]]
    for n in sys.argv[2:]: fn(n)
