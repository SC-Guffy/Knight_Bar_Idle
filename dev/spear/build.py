# 창기사 계열 통짜 시트 조립 (docs/specs/legacy-class-sheets.md). 프레임 소스와 상관없이 같은 규격으로 묶는다.
#   python -I build.py <cls> [--src rig|gen] [--install]
#     rig: shots/<cls>-<anim>-<i>.png (capture.js 로 뽑은 지금 게임 그림, 160칸 발 (80,140)) — 렌더러 연결 시험용 자리표시. 커밋하지 않는다
#     gen: frames/<cls>/<anim>-<i>.png (생성·수리 끝난 프레임, 칸 크기·발 기준점에 이미 맞춘 것)
#   --install 이면 src/sprites/<cls>.png/.json 으로, 아니면 out/ 으로. 미리보기·GIF·흑백 실루엣은 out/ 에.
#   설치 뒤 node dev/boxer/sheet-meta.js 로 src/sprites/meta.js 를 다시 묶는다.
# 파생 동작 (스펙 "사용량 줄이기"): guard = 평타A 첫 프레임(창을 앞으로 겨눈 자세) 들썩임, hurt = 대기 1장 뒤로 젖힘,
#   death = 대기 1장을 앞으로 넘어뜨림, sit = 지금 게임의 앉기 그대로(기존 앉기 유지).
import os, sys, json
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
OUT_C = (0x0b, 0x0d, 0x14, 255)

# 칸 크기·발 기준점 (스펙 "칸 크기"). 2026-10-16: 창 계열도 128 — 마네킹에 입히고 직업 무기를 덧그리면(dev/spear/dress.py)
#  용창·용황창이 마네킹 창보다 길어 찌르기 끝이 발 앞 +87, 용기병 날개꼴 망토가 뒤 −27 까지 나가 96 칸(발 24)에 안 들어간다.
#  할버드·도끼창은 휘두르기 뒤 −48 · 앞 +59. 넘어짐(death)은 앞으로 쓰러져 뒤가 잘리지 않는다
SPEAR, SWEEP = (128, (36, 112)), (128, (56, 112))
CELL = {'lancer': SPEAR, 'dragoon': SPEAR, 'dragonlord': SPEAR, 'cavalier': SPEAR, 'skyGeneral': SPEAR, 'halberdier': SWEEP, 'warlord': SWEEP}
# 시전 줄: 스킬 자세의 무기 각도 wa 와 가장 가까운 프레임 (src/sprites.js sheetFrame). 할버드는 한 바퀴 돌아 wrap
CAST = {
    'spear': {'val': [-1.57, -1.2, -0.8, -0.4, 0, 0.4, 0.8, 1.2, 1.57], 'wrap': False},
    'sweep': {'val': [-3.14, -2.36, -1.57, -0.79, 0, 0.79, 1.57, 2.36], 'wrap': True},
}
KIND = lambda cls: 'sweep' if CELL[cls] is SWEEP else 'spear'
ORDER = ['idle', 'guard', 'walk', 'atkA', 'atkB', 'cast', 'hurt', 'death', 'sit']


def solid(im):
    """반투명(빛번짐) 지우기 — 알파 0/255 만."""
    im = im.convert('RGBA'); px = im.load()
    for y in range(im.height):
        for x in range(im.width):
            c = px[x, y]; px[x, y] = c[:3] + (255,) if c[3] >= 160 else (0, 0, 0, 0)
    return im


def from_rig(cls, anim, i):
    S, (fx, fy) = CELL[cls]
    im = Image.open(os.path.join(HERE, 'shots', f'{cls}-{anim}-{i}.png'))
    return solid(im.crop((80 - fx, 140 - fy, 80 - fx + S, 140 - fy + S)))


def frames(cls, src, anim, n=None):
    out = []
    i = 0
    while n is None or i < n:
        p = os.path.join(HERE, 'shots', f'{cls}-{anim}-{i}.png') if src == 'rig' else os.path.join(HERE, 'frames', cls, f'{anim}-{i}.png')
        if not os.path.exists(p): break
        out.append(from_rig(cls, anim, i) if src == 'rig' else solid(Image.open(p)))
        i += 1
    return out


def outline(im):
    """회전으로 생긴 바깥 가장자리에 외곽선 #0b0d14 를 다시 두른다."""
    im = im.copy(); w, h = im.size; px = im.load(); add = []
    for y in range(h):
        for x in range(w):
            if px[x, y][3]: continue
            if any(0 <= x + dx < w and 0 <= y + dy < h and px[x + dx, y + dy][3] and px[x + dx, y + dy] != OUT_C for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                add.append((x, y))
    for p in add: px[p] = OUT_C
    return im


def lean(im, foot, deg, dx=0, ground=True):
    """발 기준점을 축으로 기울인다 (+ 뒤로, − 앞으로). ground 면 가장 낮은 칸을 다시 땅에 붙인다."""
    r = im.rotate(deg, resample=Image.NEAREST, center=foot)
    o = Image.new('RGBA', im.size); o.alpha_composite(r, (dx, 0))
    if ground and o.getbbox():
        d = foot[1] - (o.getbbox()[3] - 1)
        p = Image.new('RGBA', im.size); p.paste(o, (0, d)); o = p
    return outline(o)


def bob(im, cut, d):
    """cut 위쪽을 d 칸 아래로 (숨쉬기·무게중심 낮추기)."""
    o = Image.new('RGBA', im.size)
    o.paste(im.crop((0, cut, im.width, im.height)), (0, cut))
    o.alpha_composite(im.crop((0, 0, im.width, cut)), (0, d))
    return o


def pts_of(im, foot):
    """hand = 무기 끝 쪽(발보다 위에서 가장 앞 칸), head = 머리 위 가운데."""
    px = im.load(); bb = im.getbbox()
    if not bb: return [foot[0], foot[1], foot[0], foot[1]]
    top = bb[1]; xs = [x for x in range(im.width) if px[x, top][3]]
    hx, hy = foot
    for x in range(im.width - 1, -1, -1):
        ys = [y for y in range(0, foot[1] - 6) if px[x, y][3]]
        if ys: hx, hy = x, ys[len(ys) // 2]; break
    return [hx, hy, sum(xs) // len(xs), top]


def build(cls, src='rig'):
    S, foot = CELL[cls]; k = KIND(cls)
    idle = frames(cls, src, 'idle')
    atkA, atkB = frames(cls, src, 'atkA'), frames(cls, src, 'atkB')
    A = {}
    A['idle'] = dict(frames=idle, fps=6, loop=True)
    g0 = frames(cls, src, 'guard') or [atkA[0]]
    A['guard'] = dict(frames=g0 if len(g0) >= 4 else [g0[0], bob(g0[0], foot[1] - 18, 1), bob(g0[0], foot[1] - 18, 1), g0[0]], fps=8, loop=True)
    A['walk'] = dict(frames=frames(cls, src, 'walk'), fps=10, loop=True)
    A['atkA'] = dict(frames=atkA, fps=14, loop=False, hit=len(atkA) * 35 // 100)
    A['atkB'] = dict(frames=atkB, fps=14, loop=False, hit=len(atkB) * 35 // 100)
    cast = frames(cls, src, 'cast', len(CAST[k]['val']))
    A['cast'] = dict(frames=cast, fps=10, loop=True, key='wa', val=CAST[k]['val'][:len(cast)], wrap=CAST[k]['wrap'])
    base = idle[0]
    A['hurt'] = dict(frames=[lean(base, foot, 9, -2), lean(base, foot, 4, -1)], fps=12, loop=False)
    A['death'] = dict(frames=[lean(base, foot, a) for a in (-12, -30, -55, -78, -90)], fps=8, loop=False)
    A['sit'] = dict(frames=[from_rig(cls, 'sit', i) for i in (0, 1)] if src == 'rig' or not os.path.exists(os.path.join(HERE, 'frames', cls, 'sit-0.png')) else frames(cls, src, 'sit'), fps=2, loop=True)
    return A


def write(cls, A, install=False):
    S, foot = CELL[cls]
    n = max(len(A[a]['frames']) for a in ORDER)
    sheet = Image.new('RGBA', (S * n, S * len(ORDER)))
    meta = {'w': S, 'h': S, 'foot': list(foot), 'anims': {}, 'pts': {}}
    for r, a in enumerate(ORDER):
        F = A[a]
        for i, f in enumerate(F['frames']): sheet.alpha_composite(f, (S * i, S * r))
        m = {'row': r, 'frames': len(F['frames']), 'fps': F['fps'], 'loop': F['loop']}
        for key in ('hit', 'key', 'val', 'wrap'):
            if key in F: m[key] = F[key]
        meta['anims'][a] = m
        meta['pts'][a] = [pts_of(f, foot) for f in F['frames']]
    od = os.path.join(HERE, 'out'); os.makedirs(od, exist_ok=True)
    dst = os.path.join(ROOT, 'src', 'sprites') if install else od
    sheet.save(os.path.join(dst, f'{cls}.png'))
    with open(os.path.join(dst, f'{cls}.json'), 'w', encoding='utf-8') as f:
        f.write(f'{{"w": {S}, "h": {S}, "foot": {json.dumps(list(foot))},\n "anims": {{\n')
        f.write(',\n'.join(f'  "{a}": {json.dumps(meta["anims"][a])}' for a in ORDER))
        f.write('\n },\n "pts": {\n')
        f.write(',\n'.join(f'  "{a}": {json.dumps(meta["pts"][a])}' for a in ORDER))
        f.write('\n }\n}\n')
    # 동작별 프레임 몽타주 (3배, 칸 테두리·발 표시·hand 빨강·head 파랑) — 무기 끝이 칸에서 잘리는지 보는 용도
    Z, L = 3, 70
    pv = Image.new('RGBA', (L + S * n * Z, S * len(ORDER) * Z), (20, 22, 29, 255))
    d = ImageDraw.Draw(pv)
    for r, a in enumerate(ORDER):
        F = A[a]
        d.text((4, r * S * Z + 8), a, fill=(255, 220, 90))
        d.text((4, r * S * Z + 22), f"{len(F['frames'])}f", fill=(170, 170, 190))
        for i, f in enumerate(F['frames']):
            ox, oy = L + i * S * Z, r * S * Z
            d.rectangle([ox, oy, ox + S * Z - 1, oy + S * Z - 1], fill=(32, 34, 44), outline=(70, 72, 90))
            pv.alpha_composite(f.resize((S * Z, S * Z), Image.NEAREST), (ox, oy))
            d.line([(ox + (foot[0] - 4) * Z, oy + (foot[1] + 1) * Z), (ox + (foot[0] + 4) * Z, oy + (foot[1] + 1) * Z)], fill=(120, 200, 120))
            p = meta['pts'][a][i]
            d.rectangle([ox + p[0] * Z, oy + p[1] * Z, ox + p[0] * Z + 2, oy + p[1] * Z + 2], outline=(255, 60, 60))
            d.rectangle([ox + p[2] * Z, oy + p[3] * Z, ox + p[2] * Z + 2, oy + p[3] * Z + 2], outline=(80, 160, 255))
            # 칸 가장자리에 닿은 칸이 있으면 빨간 테두리 (잘림 의심)
            bb = f.getbbox()
            if bb and (bb[0] == 0 or bb[1] == 0 or bb[2] == S or bb[3] == S):
                d.rectangle([ox, oy, ox + S * Z - 1, oy + S * Z - 1], outline=(255, 60, 60), width=2)
    pv.save(os.path.join(od, f'{cls}-frames.png'))
    gd = os.path.join(od, 'gif'); os.makedirs(gd, exist_ok=True)
    for a in ORDER:
        F = A[a]; fr = []
        for f in F['frames']:
            b = Image.new('RGBA', (S, S), (0x14, 0x16, 0x1d, 255)); b.alpha_composite(f)
            fr.append(b.convert('RGB').resize((S * 3, S * 3), Image.NEAREST))
        dur = [round(1000 / F['fps'])] * len(fr)
        if not F['loop']: dur[-1] += 400
        fr[0].save(os.path.join(gd, f'{cls}-{a}.gif'), save_all=True, append_images=fr[1:], duration=dur, loop=0, disposal=2)
    clipped = [a for a in ORDER for f in A[a]['frames'] if (lambda b: b and (b[0] == 0 or b[1] == 0 or b[2] == S or b[3] == S))(f.getbbox())]
    print(cls, 'cell', S, 'foot', foot, 'frames', {a: len(A[a]['frames']) for a in ORDER}, 'clipped', sorted(set(clipped)) or 'none', '->', dst)


if __name__ == '__main__':
    a = sys.argv[1:]
    src = a[a.index('--src') + 1] if '--src' in a else 'rig'
    for cls in [x for x in a if x in CELL] or list(CELL):
        write(cls, build(cls, src), install='--install' in a)
