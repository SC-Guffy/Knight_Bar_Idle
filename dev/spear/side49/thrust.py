# 남은 31회 계획 1번 대안 (무료): pixen 편집 키가 원본과 거의 같아(10-23, 6회) 찌르기 평타A 를 코드로 엮는다.
#  준비 그림(지금 평타A 0번)을 몸·랜스로 나누고: 뒤로 당김(윗몸 젖힘 + 랜스 뒤로) → 디딤(다리는 걷기의 가장 벌린 장) + 윗몸 숙임 + 랜스 앞으로
#  → 끝까지 찌름 → 밀어붙임 → 준비. 랜스를 앞으로 민 만큼 손~보호대 사이는 자루 색으로 잇는다.
#   python3 dev/spear/side49/thrust.py <cls> [--install]
import os, sys, json
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import walk, keys
CFG = {'cavalier': {'lance': lambda x, y: x >= 28 and 64 <= y <= 75, 'waist': 77, 'piv': (18, 72), 'shaft_y': (68, 70)},
       'skyGeneral': {'lance': lambda x, y: x >= 25 and 68 <= y <= 78, 'waist': 78, 'piv': (17, 72), 'shaft_y': (72, 74)}}   # 갈색 보호대(x25~31)부터 랜스


def rot_up(f, deg, waist, piv):
    S = f.width; K = 4
    up = Image.new('RGBA', f.size); up.paste(f.crop((0, 0, S, waist)), (0, 0))
    big = up.resize((S * K, S * K), Image.NEAREST).rotate(deg, resample=Image.NEAREST, center=(piv[0] * K, piv[1] * K))
    P = big.load(); r = Image.new('RGBA', f.size); R = r.load()
    for y in range(S):
        for x in range(S):
            cs = [P[x * K + a, y * K + b] for a in range(K) for b in range(K) if P[x * K + a, y * K + b][3] >= 128]
            if len(cs) >= 7: R[x, y] = max(set(cs), key=cs.count)[:3] + (255,)
    return r


def make(cls):
    c = CFG[cls]; base = walk.frame(cls, 'atkA', 0); S = base.width
    body, lance = Image.new('RGBA', base.size), Image.new('RGBA', base.size); P = base.load()
    for y in range(S):
        for x in range(S):
            if P[x, y][3]: (lance if c['lance'](x, y) else body).putpixel((x, y), P[x, y])
    lx = lance.getbbox()[0]
    cols = sorted((p[:3] for p in lance.getdata() if p[3] and sum(p[:3]) > 90), key=lambda q: sum(q))
    shaft = cols[len(cols) * 2 // 5] + (255,)                                          # 자루 색 = 랜스 색 중 조금 어두운 중간 (흰 막대로 튀지 않게)
    m = walk.meta(cls); W = m['anims']['walk']
    walks = [walk.frame(cls, 'walk', i) for i in range(W['frames'])]
    wide = max(walks, key=lambda f: (lambda b: b[2] - b[0] if b else 0)(f.crop((0, c['waist'], S, S)).getbbox()))

    def frame(lean, dx_body, dx_lance, legs=None):
        o = Image.new('RGBA', base.size)
        lo = (legs or body).crop((0, c['waist'], lx, S)); o.alpha_composite(lo, (0, c['waist']))     # 다리만 (빌린 걷기 장의 랜스 조각은 뺌)
        up = rot_up(body, lean, c['waist'], c['piv']); o.alpha_composite(up, (dx_body, 0))
        if dx_lance > 0:                                   # 손 ~ 옮긴 보호대 사이 자루
            for y in range(*[c['shaft_y'][0], c['shaft_y'][1] + 1]):
                for x in range(lx - 2, lx + dx_lance): o.putpixel((x, y), shaft)
        o.alpha_composite(lance, (dx_lance, 0))
        return walk.outline(walk.palette_lock(o, base))
    # 검수(10-23 pass 3.57) 지적 반영: 당기기 4 → 8칸 · 윗몸 젖힘 키움, 찌를 때 몸통을 앞으로 3~5칸, 밀어붙임은 한 칸 더
    fr = [base, frame(11, -2, -8), frame(-8, 3, 7, wide), frame(-12, 5, 13, wide), frame(-12, 6, 15, wide), base]
    return fr


if __name__ == '__main__':
    cls = sys.argv[1]; fr = make(cls); D = walk.D(cls); os.makedirs(D, exist_ok=True)
    for i, f in enumerate(fr): f.save(os.path.join(D, f'thrust-{i}.png'))
    S = fr[0].width; Z = 4; M = Image.new('RGBA', (S * Z * len(fr), S * Z), (30, 32, 44, 255))
    for i, f in enumerate(fr): M.alpha_composite(f.resize((S * Z, S * Z), Image.NEAREST), (i * S * Z, 0))
    M.crop((0, 40 * Z, M.width, S * Z)).save(os.path.join(D, 'thrust-strip.png'))
    if '--install' in sys.argv:
        tmp = [os.path.join(D, f'thrust-{i}.png') for i in range(len(fr))]
        m = walk.meta(cls); S = m['w']; foot = tuple(m['foot']); A = m['anims']['atkA']
        p = os.path.join(walk.ROOT, 'src', 'sprites', f'{cls}.png'); sheet = Image.open(p).convert('RGBA')
        for i, f in enumerate(fr):
            sheet.paste(Image.new('RGBA', (S, S)), (i * S, A['row'] * S)); sheet.alpha_composite(f, (i * S, A['row'] * S))
        sheet.save(p); m['pts']['atkA'] = [walk.pts_of(f, foot) for f in fr]; m['anims']['atkA']['frames'] = len(fr)
        order = sorted(m['anims'], key=lambda a: m['anims'][a]['row'])
        with open(p[:-4] + '.json', 'w', encoding='utf-8') as fo:
            fo.write(f'{{"w": {S}, "h": {S}, "foot": {json.dumps(m["foot"])},\n "anims": {{\n')
            fo.write(',\n'.join(f'  "{a}": {json.dumps(m["anims"][a])}' for a in order))
            fo.write('\n },\n "pts": {\n')
            fo.write(',\n'.join(f'  "{a}": {json.dumps(m["pts"][a])}' for a in order))
            fo.write('\n }\n}\n')
        print('installed atkA', cls)
    print('ok')
