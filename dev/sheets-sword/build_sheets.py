# 검사 계열 2차 4종 통짜 시트 조립 (PixelLab 0): 키 자세 애니(anim_keys.py·anim_build.py 결과) → src/sprites/<cls>.png + .json
#  행: idle(2f, 1칸 들썩임) · walk(4f, pixen 걷기 키 — anim/<cls>-walk-strip.png) · atkA(평타 + 복귀 보간 1f) · cast(시전 6f) · hurt(2f, 뒤로 밀림)
#  복귀 보간(로드맵 공통 흠 "타격→준비 한 번에 튐"): 준비 그림의 엉덩이 줄 하나를 빼서 1칸 웅크린 그림을 끼운다.
#  64칸, 발 = (28, 59). pts = 프레임마다 [손 x, 손 y, 머리 x, 머리 y] (heroTop·발사 위치). 끝나면 node dev/boxer/sheet-meta.js
#  python -I -B build_sheets.py [cls ...]
import os, sys, json
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(os.path.dirname(HERE))
A = os.path.join(HERE, 'anim'); OUT = os.path.join(ROOT, 'src', 'sprites')
FOOT = (28, 59)


def strip(name):
    im = Image.open(os.path.join(A, name)).convert('RGBA'); return [im.crop((64 * i, 0, 64 * i + 64, 64)) for i in range(im.width // 64)]


def shift(im, dx, dy):
    o = Image.new('RGBA', (64, 64)); o.alpha_composite(im, (dx, dy)) if dx >= 0 and dy >= 0 else o.paste(im, (dx, dy), im); return o


def squat(im, n=1):
    """엉덩이 근처 줄(발 위 14칸) n 개를 빼고 위를 내림 → 살짝 웅크린 그림"""
    o = Image.new('RGBA', (64, 64)); cut = FOOT[1] - 14
    o.alpha_composite(im.crop((0, cut + n, 64, 64)), (0, cut + n)); o.alpha_composite(im.crop((0, 0, 64, cut)), (0, n)); return o


def pts(im):
    P = im.load(); op = [(x, y) for y in range(64) for x in range(64) if P[x, y][3]]
    top = min(y for _, y in op); hx = round(sum(x for x, y in op if y <= top + 6) / max(1, sum(1 for x, y in op if y <= top + 6)))
    return [FOOT[0] + 9, FOOT[1] - 24, hx, top + 2]


JOBS = {
    'paladin': ('paladin64-src.png', 'paladin-atkD-strip.png', 'paladin-cast-strip.png'),
    'swordsman': ('swordsman64-src.png', 'swordsman-atk-strip.png', 'swordsman-cast-strip.png'),
    'blademaster': ('blademaster64-src.png', 'blademaster-atk-strip.png', 'blademaster-cast-strip.png'),
    'greatswordsman': ('greatswordsman64-src.png', 'greatswordsman-atk-strip.png', 'greatswordsman-cast-strip.png'),
}

if __name__ == '__main__':
    for cls in (sys.argv[1:] or JOBS):
        s, a, c = JOBS[cls]
        if not all(os.path.exists(os.path.join(A, f)) for f in (s, a, c)): print('skip', cls); continue
        src = strip(s)[0]; atk = strip(a); cast = strip(c)
        if atk[-1].tobytes() == atk[0].tobytes(): atk = atk[:-1] + [squat(atk[0]), atk[0]]      # 복귀 보간 (마지막 = 첫 준비 그림일 때)
        rows = {
            'idle': ([src, squat(src)], dict(fps=3, loop=True)),
            'walk': (strip(f'{cls}-walk-strip.png') if os.path.exists(os.path.join(A, f'{cls}-walk-strip.png')) else [src, squat(src), src, squat(src, 2)], dict(fps=8, loop=True)),   # 4단계: pixen 걷기 키 (없으면 임시 들썩임)
            'atkA': (atk, dict(fps=12, loop=False, hit=3)),
            'cast': (cast, dict(fps=8, loop=True)),
            'hurt': ([shift(src, 0, 0).transform((64, 64), Image.AFFINE, (1, 0, 2, 0, 1, 0)), shift(src, 0, 0).transform((64, 64), Image.AFFINE, (1, 0, 1, 0, 1, 0))], dict(fps=12, loop=False)),
        }
        W = 64 * max(len(f) for f, _ in rows.values()); sheet = Image.new('RGBA', (W, 64 * len(rows)))
        meta = {'w': 64, 'h': 64, 'foot': list(FOOT), 'anims': {}, 'pts': {}}
        for r, (k, (frames, opt)) in enumerate(rows.items()):
            for i, f in enumerate(frames): sheet.alpha_composite(f, (64 * i, 64 * r))
            meta['anims'][k] = dict(row=r, frames=len(frames), **opt); meta['pts'][k] = [pts(f) for f in frames]
        sheet.save(os.path.join(OUT, f'{cls}.png'))
        json.dump(meta, open(os.path.join(OUT, f'{cls}.json'), 'w', encoding='utf-8'), ensure_ascii=False)
        print(cls, sheet.size, {k: v['frames'] for k, v in meta['anims'].items()})
