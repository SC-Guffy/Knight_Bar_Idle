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
# 검수 1차(정리본) fix 판정에 따른 수리 단계 (fix.py). 합격(랜서·할버디어)은 그대로
FIX = {'lancer': ('tidy', 'green'), 'dragoon': ('tidy', 'belly')}      # eye: 머리 자리를 창과 구분 못 해 뺌
FIST = {'lancer'}


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
    cls = name.split('5-')[0]; im, (x0, y0, S) = frame(name)
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
        erase = set(near_line(pts, (gx, gy), dd, 1.6, 3, 60))        # 모델 무기 (손 앞)
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


def post(name):
    cls = name.split('5-')[0].rstrip('0123456789')
    raw = Image.open(os.path.join(HERE, 'work', cls, f'{name}-pl-0.png')).convert('RGBA')
    clean = POL.unbg(raw); bb = clean.getbbox(); clean = clean.crop(bb)
    pol = POL.polish(clean.copy())                       # 손질 먼저 (무기 색이 14색 줄이기에 섞여 몸 색이 탁해지지 않게)
    import fix as FX                                     # 검수 fix 판정 수리 (스크립트) — 직업별
    for step in FIX.get(cls, ()):
        pol = getattr(FX, step)(pol)
    pol, g = wpnfix(pol, name, (bb[0] - 1, bb[1] - 1))  # polish 의 외곽선 1칸 여백만큼 원점이 옮겨짐
    if cls in FIST: pol = FX.fist(pol, g)
    pol = POL.quant(pol, 20)                             # 위 테 밝히기·무기 색으로 25~30색이 돼 색 경보(>24) → 마지막에 20색
    clean.save(os.path.join(PL, f'{name}-clean.png')); pol.save(os.path.join(PL, f'{name}-polish.png'))
    print(name, 'clean', clean.size, 'polish', pol.size)


if __name__ == '__main__':
    fn = {'prep': prep, 'post': post}[sys.argv[1]]
    for n in sys.argv[2:]: fn(n)
