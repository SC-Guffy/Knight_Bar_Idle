# 12단계 B 시트 조립 (새 디자인): newanim/<cls>-src.png (고른 디자인, 64칸 발 28,59) + pixen 키(work/<cls>/n{k1,k2,k3,c1,c2}-0.png, 칼까지 모델이 그림)
#  → 키마다 발 줄 59 맞춤·발 가운데 맞춤·원본 팔레트 고정 → src/sprites/<cls>.png + .json (행: idle 2 · walk 4 · atkA · cast · hurt 2)
#  walk: newanim/<cls>-walk-strip.png 가 있으면 그것(skeleton 걷기), 없으면 임시 들썩임.
#  python -I -B build_new.py [cls ...]   (끝나면 node dev/boxer/sheet-meta.js)
import os, sys, json
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(os.path.dirname(HERE))
NA = os.path.join(HERE, 'newanim'); OUT = os.path.join(ROOT, 'src', 'sprites')
FOOT = (28, 59)
CLS = ['squire', 'swordsman', 'paladin', 'blademaster', 'greatswordsman', 'archon', 'tyrant', 'swordsaint']
ATK = ['src', 'k1', 'k2', 'k3', 'k3', 'squat', 'src']       # 준비 → 젖힘 → 베기(타격) → 마무리 → 복귀
HIT = 2
CAST = ['src', 'c1', 'c1', 'c2', 'c2', 'c1']
# 비평 2차 (정면에 가까운 준비 그림 ↔ 옆모습 키가 섞여 모습이 끊김) → 대안(스크립트): 이 직업은 동작 줄의 처음·끝을 옆모습 키 c1(칼을 앞에 세워 듦)로
SIDE = {'paladin', 'archon', 'blademaster', 'tyrant'}
ATK_S = ['c1', 'k1', 'k2', 'k3', 'k3', 'c1']
CAST_S = ['c1', 'c1', 'c2', 'c2', 'c1', 'c1']
# 3차 비평 미달 → 대안 "짧은 판": 모습이 바뀌는 프레임을 뺀다 (성기사 평타: 방패 없는 젖힘 k1, 시전: 디자인이 바뀌는 c2)
ATK_SHORT = {'paladin': ['c1', 'k2', 'k3', 'k3', 'c1']}
CAST_SHORT = {'paladin', 'archon', 'tyrant'}           # c1 · 1칸 웅크림 · c1 · 2칸 웅크림 (숨 고르기)
FLIP = {'paladin': {'c1'}}     # 비평: 성기사 c1(대기·시전) 만 왼쪽을 봄 → 뒤집어 오른쪽 (방패 뒤·칼 앞, 서기·걷기와 같은 방향)
# 13단계 (시즌7 "개선해"): 대기 그림(c1) 자체를 pixen 원본으로 뽑은 키 n<k>s — 모습이 안 바뀜. 있으면 짧은 판 대신 씀
ATK_13 = {'paladin': ['c1', 'k0s', 'k2', 'k3', 'k3', 'c1']}
CAST_13 = ['c1', 'c1', 'c3s', 'c3s', 'c3s', 'c1']
WALK_I_OK = {'tyrant', 'blademaster'}      # 13단계 대기 그림 첫 프레임 걷기 비평 합격 (대검전사는 다리 잡점으로 미달 → 임시)
WALK_T_FAIL = {'blademaster', 'greatswordsman', 'tyrant'}     # 12단계 C 걷기 비평 미달 (대기와 모습이 다르거나 다리가 어둡게 뭉침) → 임시 들썩임
WALK_FAIL = {'blademaster', 'greatswordsman', 'archon', 'tyrant', 'swordsaint'}   # 걷기 비평 미달 → 임시 들썩임


def pal_of(im, n=24):
    cs = sorted({c for c in im.getdata() if c[3]})
    if len(cs) <= n: return cs
    q = im.convert('RGB').quantize(colors=n - 2, method=Image.Quantize.MEDIANCUT).convert('RGB'); P = im.load()
    return sorted({q.getpixel((x, y)) + (255,) for y in range(im.height) for x in range(im.width) if P[x, y][3]})


def lock(im, pal):
    o = im.copy(); O = o.load(); cache = {}
    for y in range(o.height):
        for x in range(o.width):
            c = O[x, y]
            if c[3] < 128: O[x, y] = (0, 0, 0, 0); continue
            k = c[:3]
            if k not in cache: cache[k] = min(pal, key=lambda q: sum((c[i] - q[i]) ** 2 for i in range(3)))[:3] + (255,)
            O[x, y] = cache[k]
    return o


def foot_align(im):
    P = im.load(); op = [(x, y) for y in range(64) for x in range(64) if P[x, y][3] >= 128]
    bot = max(y for _, y in op); feet = [x for x, y in op if y >= bot - 2]; fx = round(sum(feet) / len(feet))
    o = Image.new('RGBA', (64, 64)); o.alpha_composite(im, (0, FOOT[1] - bot)); return o, fx


def squat(im, n=1):
    o = Image.new('RGBA', (64, 64)); cut = FOOT[1] - 14
    o.alpha_composite(im.crop((0, cut + n, 64, 64)), (0, cut + n)); o.alpha_composite(im.crop((0, 0, 64, cut)), (0, n)); return o


def pts(im):
    P = im.load(); op = [(x, y) for y in range(64) for x in range(64) if P[x, y][3]]
    top = min(y for _, y in op); hx = round(sum(x for x, y in op if y <= top + 6) / max(1, sum(1 for x, y in op if y <= top + 6)))
    return [FOOT[0] + 9, FOOT[1] - 22, hx, top + 2]


LIFT = {'tyrant': 0.72}     # 비평 "전신 검정이라 명암 2점" → 어두운 색을 감마로 들어 올림 (팔레트 단계에서, 모든 프레임 같게)


def lift(pal, g):
    return [tuple(round(255 * (c[i] / 255) ** g) for i in range(3)) + (255,) for c in pal]


def build(cls):
    src0 = Image.open(os.path.join(NA, f'{cls}-src.png')).convert('RGBA'); pal = pal_of(src0)
    mp = dict(zip(pal, lift(pal, LIFT[cls]))) if cls in LIFT else None

    def fin(im):                                                            # 원본 팔레트 고정 → (파천검왕) 같은 표로 밝힘 — 모든 프레임 같은 색
        im = lock(im, pal)
        if mp:
            S = im.load()
            for y in range(im.height):
                for x in range(im.width):
                    if S[x, y][3]: S[x, y] = mp[S[x, y]]
        return im
    src = fin(src0)
    _, sfx = foot_align(src)
    keys = {'src': src, 'squat': squat(src)}
    for k in ('k1', 'k2', 'k3', 'c1', 'c2'):
        p = os.path.join(HERE, 'work', cls, f'n{k}r-0.png')                      # 수리 판(비평 미달 → 다시) 먼저
        if not os.path.exists(p): p = os.path.join(HERE, 'work', cls, f'n{k}-0.png')
        if not os.path.exists(p): print('skip', cls, k); return
        im, fx = foot_align(fin(Image.open(p).convert('RGBA')))
        o = Image.new('RGBA', (64, 64)); o.alpha_composite(im, (0, 0)) if fx == sfx else o.paste(im, (sfx - fx, 0), im)   # 발 가운데를 준비 그림에 맞춤
        if k in FLIP.get(cls, ()):                                           # 왼쪽을 보고 나온 키 → 발 가운데 기준 좌우 뒤집기
            f = o.transpose(Image.FLIP_LEFT_RIGHT); o = Image.new('RGBA', (64, 64)); o.paste(f, (2 * sfx - 63, 0), f)
        keys[k] = o
    for k in ('k0s', 'c3s'):                                                    # 13단계 키 (원본이 이미 c1 이라 뒤집기 없음)
        p = os.path.join(HERE, 'work', cls, f'n{k}-0.png')
        if os.path.exists(p):
            im, fx = foot_align(fin(Image.open(p).convert('RGBA'))); o = Image.new('RGBA', (64, 64)); o.paste(im, (sfx - fx, 0), im); keys[k] = o
    if cls in SIDE: src = keys['c1']; keys['src'] = src; keys['squat'] = squat(src)     # 대기·피격·임시 걷기도 옆모습 c1 (모습이 끊기지 않게)
    wp = os.path.join(NA, f'{cls}-walk-strip.png')
    wi = os.path.join(NA, f'{cls}-walkI4-strip.png')
    wt = os.path.join(NA, f'{cls}-walkT4-strip.png')                       # 12단계 C: 옆모습 서기 원본 skeleton 걷기
    if os.path.exists(wi) and (cls in WALK_I_OK or os.environ.get('TRY13')):
        w = Image.open(wi).convert('RGBA'); walk = [fin(w.crop((64 * i, 0, 64 * i + 64, 64))) for i in range(w.width // 64)]
    elif os.path.exists(wt) and cls not in WALK_T_FAIL:
        w = Image.open(wt).convert('RGBA'); walk = [fin(w.crop((64 * i, 0, 64 * i + 64, 64))) for i in range(w.width // 64)]
    elif os.path.exists(wp) and cls not in WALK_FAIL and cls not in SIDE:
        w = Image.open(wp).convert('RGBA'); walk = [fin(w.crop((64 * i, 0, 64 * i + 64, 64))) for i in range(w.width // 64)]
    else: walk = [src, squat(src), src, squat(src, 2)]
    hurt = [src.transform((64, 64), Image.AFFINE, (1, 0, 2, 0, 1, 0)), src.transform((64, 64), Image.AFFINE, (1, 0, 1, 0, 1, 0))]
    rows = {'idle': ([src, squat(src)], dict(fps=3, loop=True)), 'walk': (walk, dict(fps=8, loop=True)),
            'atkA': ([keys[k] for k in ATK_13[cls]], dict(fps=12, loop=False, hit=HIT)) if cls in ATK_13 and 'k0s' in keys else
                    ([keys[k] for k in ATK_SHORT.get(cls, ATK_S if cls in SIDE else ATK)], dict(fps=12, loop=False, hit=1 if cls in ATK_SHORT else HIT)),
            'cast': ([keys[k] for k in CAST_13], dict(fps=8, loop=True)) if cls in CAST_SHORT and 'c3s' in keys else
                    ([src, squat(src), src, squat(src, 2)] if cls in CAST_SHORT else [keys[k] for k in (CAST_S if cls in SIDE else CAST)], dict(fps=6 if cls in CAST_SHORT else 8, loop=True)),
            'hurt': (hurt, dict(fps=12, loop=False))}
    W = 64 * max(len(f) for f, _ in rows.values()); sheet = Image.new('RGBA', (W, 64 * len(rows)))
    meta = {'w': 64, 'h': 64, 'foot': list(FOOT), 'anims': {}, 'pts': {}}
    for r, (k, (frames, opt)) in enumerate(rows.items()):
        for i, f in enumerate(frames): sheet.alpha_composite(f, (64 * i, 64 * r))
        meta['anims'][k] = dict(row=r, frames=len(frames), **opt); meta['pts'][k] = [pts(f) for f in frames]
    sheet.save(os.path.join(OUT, f'{cls}.png')); json.dump(meta, open(os.path.join(OUT, f'{cls}.json'), 'w', encoding='utf-8'), ensure_ascii=False)
    for k, (frames, opt) in rows.items():                                  # 확인용 GIF (4배)
        g = []
        for f in frames:
            b = Image.new('RGBA', (64, 64), (38, 40, 50, 255)); b.alpha_composite(f); g.append(b.convert('RGB').resize((256, 256), Image.NEAREST))
        g[0].save(os.path.join(NA, f'{cls}-{k}-x4.gif'), save_all=True, append_images=g[1:], duration=int(1000 / opt['fps']), loop=0)
    print(cls, sheet.size, {k: v['frames'] for k, v in meta['anims'].items()}, 'pal', len(pal))


if __name__ == '__main__':
    for c in (sys.argv[1:] or CLS): build(c)
