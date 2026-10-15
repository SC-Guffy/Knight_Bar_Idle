# 검사 계열 + 견습 시트 조립 (docs/specs/legacy-class-sheets.md): 원형 마네킹 PixelLab 프레임 → 직업 입히기 + 무기 덧그리기 → src/sprites/<cls>.png/.json
#  python -I -B build.py [직업 ...]   (없으면 8종 전부) → 끝나면 node dev/boxer/sheet-meta.js
#  대검 원형의 들기·젖히기는 PixelLab 이 팔을 회색으로 그려 팔이 지워져서, 같은 몸인 장검 마네킹 프레임에 대검을 덧그린다.
#  동작 = 원형 마네킹 프레임 + 손마다 칼 각도(도, 0 = 앞, -90 = 위, None = 마네킹 칼 그대로). PixelLab 칼은 믿지 않고 몸(팔) 자세만 쓴다.
#  guard = idle 윗몸 1칸 낮춤, hurt = idle 뒤로 밀기, death = idle 을 발 뒤축으로 넘어뜨림, sit 은 없음(게임이 예전 조립식 앉기를 쓴다).
import os, sys, json, math
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, HERE); sys.path.insert(0, os.path.join(HERE, '..', 'boxer', 'sheets'))
import dress as D
from common import tidy, bob, shift

W = lambda arch, anim, i: os.path.join(HERE, 'work', 'mq-' + arch, f'{anim}-{i}.png')
# 원형별 마네킹 칸(PixelLab 에 넣은 크기)과 최종 시트 칸
ARCH = {'sword': (96, 96), 'dual': (96, 96), 'great': (128, 128)}   # 장검·쌍검도 96: 머리 위로 든 칼이 64칸 위로 잘려서 (스펙 "칸만 키운다")
CLS = {'squire': 'sword', 'swordsman': 'sword', 'paladin': 'sword', 'archon': 'sword',
       'blademaster': 'dual', 'swordsaint': 'dual', 'greatswordsman': 'great', 'tyrant': 'great'}
# 걷기·대기는 장검 마네킹 것을 셋이 같이 쓴다 (몸이 같다). 쌍검 뒷손·대검은 각도를 정해 준다
WALK = range(3, 9)
SPEC = {
    'sword': {
        'idle': [('sword', 'idle', i, None) for i in (1, 2, 3, 4)],
        'walk': [('sword', 'walk', i, None) for i in WALK],
        'atkA': [('sword', 'atkA', 0, None), ('sword', 'atkA', 2, [-100]), ('sword', 'atkB', 4, [0]), ('sword', 'atkA', 4, [35])],
        'atkB': [('sword', 'atkB', 0, None), ('sword', 'atkB', 1, [-160]), ('sword', 'atkB', 4, [-5]), ('sword', 'atkB', 4, [20])],
        'hitA': 2, 'hitB': 2,
    },
    'dual': {
        'idle': [('sword', 'idle', i, [None, 165]) for i in (1, 2, 3, 4)],
        'walk': [('sword', 'walk', i, [None, 165]) for i in WALK],
        'atkA': [('dual', 'atkA', 0, None), ('dual', 'atkA', 3, [-60, 160]), ('dual', 'atkA', 4, [10, -150]), ('dual', 'atkA', 4, [30, -20])],
        'atkB': [('dual', 'atkB', 0, None), ('dual', 'atkB', 4, [-120, -60]), ('dual', 'atkB', 4, [-20, 20]), ('dual', 'atkB', 4, [40, 60])],
        'hitA': 2, 'hitB': 2,
    },
    'great': {
        'idle': [('sword', 'idle', i, [-62]) for i in (1, 2, 3, 4)],
        'walk': [('sword', 'walk', i, [-20]) for i in WALK],
        'atkA': [('great', 'atkA', 0, None), ('sword', 'atkA', 2, [-95]), ('great', 'atkA', 4, [10]), ('great', 'atkA', 4, [45])],
        'atkB': [('great', 'atkB', 0, None), ('sword', 'atkB', 1, [180]), ('great', 'atkB', 4, [0]), ('great', 'atkB', 4, [25])],
        'hitA': 2, 'hitB': 2,
    },
}
# cast: 스킬 자세(pose.wa, 라디안)가 가장 가까운 프레임 — 칼을 든 각도별로 몸을 고른다
CAST = {
    'sword': [(-150, ('sword', 'atkB', 1)), (-100, ('sword', 'atkA', 2)), (-60, ('sword', 'atkA', 2)), (-25, ('sword', 'atkB', 4)), (10, ('sword', 'atkB', 4)), (40, ('sword', 'atkA', 4))],
    'dual': [(-150, ('dual', 'atkA', 3)), (-100, ('dual', 'atkB', 4)), (-60, ('dual', 'atkB', 4)), (-25, ('dual', 'atkA', 4)), (10, ('dual', 'atkA', 4)), (40, ('dual', 'atkA', 4))],
    'great': [(-150, ('sword', 'atkB', 1)), (-100, ('sword', 'atkA', 2)), (-60, ('sword', 'atkA', 2)), (-25, ('great', 'atkB', 4)), (10, ('great', 'atkB', 4)), (40, ('great', 'atkA', 4))],
}


def frame(cls, arch, src, ang):
    """원형 프레임 하나 입히기 → (그림 Nm 칸, 손 점들)"""
    sa, anim, i = src
    M = Image.open(W(sa, anim, i)).convert('RGBA')
    Nm = ARCH[arch][0]
    if M.width != Nm:                      # 장검 마네킹(96)을 대검(128) 칸에 — 발 (48,90) → (64,122)
        b = Image.new('RGBA', (Nm, Nm)); b.alpha_composite(M, ((Nm - M.width) // 2, Nm - M.height)); M = b
    o, C, _ = D.dress(cls, M, arch, Nm, ang=ang)
    o = tidy(o, D.palette_of(C), minc=6)          # 몸에서 1칸 떨어진 칼도 남게 (가장 큰 덩어리만 남기지 않는다)
    return o, list(D.LAST.get('hands', []))


def to_cell(im, N):
    """마네킹 칸 → 시트 칸 (발 (N/2, N-6) 맞춤, 아래·가운데 기준)"""
    o = Image.new('RGBA', (N, N)); o.alpha_composite(im, ((N - im.width) // 2, N - im.height))
    return o


def head_top(im):
    bb = im.getbbox(); P = im.load()
    xs = [x for x in range(im.width) if P[x, bb[1]][3]]
    return [sum(xs) // len(xs), bb[1]]


def build(cls):
    arch = CLS[cls]; Nm, N = ARCH[arch]; S = SPEC[arch]
    anims, pts, clip = {}, {}, 0
    def run(key, items):
        nonlocal clip
        fr, pp = [], []
        for sa, an, i, ang in items:
            im, hands = frame(cls, arch, (sa, an, i), ang)
            c = to_cell(im, Nm)
            if Nm != N:
                off = ((Nm - N) // 2, Nm - N)
                bb = c.getbbox()
                if bb and (bb[0] < off[0] or bb[1] < off[1] or bb[2] > off[0] + N): clip += 1
                c = c.crop((off[0], off[1], off[0] + N, off[1] + N))
                hands = [((g[0] - off[0], g[1] - off[1]), a) for g, a in hands]
            fr.append(c)
            h = hands[0][0] if hands else (N // 2 + 6, N - 26)
            pp.append([round(h[0]), round(h[1])] + head_top(c))
        anims[key] = fr; pts[key] = pp
    run('idle', S['idle'])
    anims['guard'] = [bob(f, N - 20, 1) for f in anims['idle']]; pts['guard'] = [[p[0], p[1] + 1, p[2], p[3] + 1] for p in pts['idle']]
    run('walk', S['walk'])
    run('atkA', S['atkA']); run('atkB', S['atkB'])
    run('cast', [(sa, an, i, [a] + ([a + 140] if arch == 'dual' else [])) for a, (sa, an, i) in CAST[arch]])
    i0 = anims['idle'][0]
    anims['hurt'] = [shift(i0, -2, 0), shift(i0, -1, 0)]; pts['hurt'] = [[p[0] - 2, p[1], p[2] - 2, p[3]] for p in pts['idle'][:1]] + [[p[0] - 1, p[1], p[2] - 1, p[3]] for p in pts['idle'][:1]]
    # 쓰러짐: 발 뒤축(왼발 끝)을 축으로 뒤로 넘어간다
    fx, fy = N // 2 - 6, N - 6
    dd = []
    for deg in (12, 30, 55, 80, 90):
        big = i0.resize((N * 4, N * 4), Image.NEAREST).rotate(deg, resample=Image.NEAREST, center=(fx * 4 + 2, fy * 4 + 2))
        r = Image.new('RGBA', (N, N)); B = big.load(); R = r.load()
        for y in range(N):
            for x in range(N):
                c = B[x * 4 + 2, y * 4 + 2]
                if c[3] >= 128: R[x, y] = c
        bb = r.getbbox()
        if bb and bb[3] < N - 5: r = shift(r, 0, N - 5 - bb[3])      # 땅에 닿게
        dd.append(r)
    anims['death'] = dd; pts['death'] = [[N // 2, N - 10, N // 2 - 10, N - 14]] * 5
    order = ['idle', 'guard', 'walk', 'atkA', 'atkB', 'cast', 'hurt', 'death']
    meta = {'w': N, 'h': N, 'foot': [N // 2, N - 5], 'anims': {}, 'pts': {}}   # 발 = 외곽선 정리가 발밑에 1줄 더해서 N-6 → N-5 (예전 조립식과 같은 땅)
    FPS = {'idle': (6, True), 'guard': (8, True), 'walk': (10, True), 'atkA': (14, False), 'atkB': (14, False), 'cast': (8, True), 'hurt': (12, False), 'death': (8, False)}
    n = max(len(anims[a]) for a in order)
    sheet = Image.new('RGBA', (N * n, N * len(order)))
    for r, a in enumerate(order):
        for k, f in enumerate(anims[a]): sheet.alpha_composite(f, (N * k, N * r))
        m = {'row': r, 'frames': len(anims[a]), 'fps': FPS[a][0], 'loop': FPS[a][1]}
        if a in ('atkA', 'atkB'): m['hit'] = S['hit' + a[-1]]
        if a == 'cast': m['key'] = 'wa'; m['val'] = [round(math.radians(v), 3) for v, _ in CAST[arch]]
        meta['anims'][a] = m; meta['pts'][a] = pts[a]
    sp = os.path.join(ROOT, 'src', 'sprites')
    sheet.save(os.path.join(sp, f'{cls}.png'))
    with open(os.path.join(sp, f'{cls}.json'), 'w', encoding='utf-8') as f:
        f.write(json.dumps({k: meta[k] for k in ('w', 'h', 'foot')})[:-1] + ',\n "anims": {\n')
        f.write(',\n'.join(f'  "{a}": {json.dumps(meta["anims"][a])}' for a in order))
        f.write('\n },\n "pts": {\n')
        f.write(',\n'.join(f'  "{a}": {json.dumps(meta["pts"][a])}' for a in order))
        f.write('\n }\n}\n')
    # 미리보기 (검토 페이지)
    pv = os.path.join(ROOT, 'dev', 'review', 'sheets-sword'); os.makedirs(pv, exist_ok=True)
    big = Image.new('RGBA', sheet.size, (0x14, 0x16, 0x1d, 255)); big.alpha_composite(sheet)
    big.resize((sheet.width * 2, sheet.height * 2), Image.NEAREST).save(os.path.join(pv, f'sheet-{cls}.png'))
    for a in order:
        fr = [Image.new('RGBA', (N, N), (0x14, 0x16, 0x1d, 255)) for _ in anims[a]]
        for b, f in zip(fr, anims[a]): b.alpha_composite(f)
        fr = [b.convert('RGB').resize((N * 3, N * 3), Image.NEAREST) for b in fr]
        dur = [round(1000 / FPS[a][0])] * len(fr)
        if not FPS[a][1]: dur[-1] += 400
        fr[0].save(os.path.join(pv, f'g-{cls}-{a}.gif'), save_all=True, append_images=fr[1:], duration=dur, loop=0, disposal=1)
    cols = {c for c in (sheet.get_flattened_data() if hasattr(sheet, 'get_flattened_data') else sheet.getdata()) if c[3]}
    print(cls, arch, 'cell', N, 'sheet', sheet.size, 'colors', len(cols), 'clip-frames', clip)


if __name__ == '__main__':
    for c in (sys.argv[1:] or list(CLS)): build(c)
