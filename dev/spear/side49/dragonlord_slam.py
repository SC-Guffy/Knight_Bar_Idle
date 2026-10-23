# 용황 평타B 다시 (검수 10-23 fix 3.14: 들어 올림이 안 읽히고, 원래 내려찍기 장의 크기·색이 튐) — 유료 추가 없이:
#  옆모습 '창을 세워 든' 키(유료 편집 1회분, raw-k-raise-0) 하나를 몸·창으로 나눠 들어 올림 → 머리 위 → 내려찍기 → 밀어붙임을 모두 만든다.
#  창은 손(36.5, 66.5)을 축으로 돌리고, 윗몸은 허리 위만 젖히거나 숙인다(thrust.rot_up). 손은 윗몸과 같이 돈 자리로 옮긴다.
#   python3 dev/spear/side49/dragonlord_slam.py [--install]
import os, sys, json, math
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import walk
from thrust import rot_up
cls = 'dragonlord'; m = walk.meta(cls); S = m['w']; fx, fy = m['foot']
WAIST, BPIV, HAND = 76, (26, 70), (36.5, 66.5)
R = Image.open(os.path.join(walk.D(cls), 'raise-sheet.png')).convert('RGBA'); P = R.load()
body, spear = Image.new('RGBA', R.size), Image.new('RGBA', R.size)
for y in range(S):
    for x in range(S):
        if not P[x, y][3]: continue
        if x in (36, 37) and sum(P[x, y][:3]) >= 60: spear.putpixel((x, y), P[x, y])   # 창대 (손 줄 포함 — 빼면 돌린 창이 손에서 끊김). 외곽선은 빼고 돌린 뒤 다시 두른다
        if not (x >= 35 and not 63 <= y <= 70): body.putpixel((x, y), P[x, y])
# 창 색: 이 키의 창은 어두운 보라 → 준비 장(평타A 0번)의 창 색으로 밝기 순서대로 (평타A·대기와 같은 창)
_r = walk.frame(cls, 'atkA', 0); _q = _r.load(); _L = lambda c: 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2]
_pal = sorted({_q[x, y][:3] for x in range(36, 40) for y in range(40, 88) if _q[x, y][3] and sum(_q[x, y][:3]) >= 60}, key=_L)
_sp = [(x, y) for y in range(S) for x in range(S) if spear.getpixel((x, y))[3]]
_lo, _hi = min(_L(spear.getpixel(q)) for q in _sp), max(_L(spear.getpixel(q)) for q in _sp)
for q in _sp: spear.putpixel(q, _pal[min(len(_pal) - 1, int((_L(spear.getpixel(q)) - _lo) / max(1, _hi - _lo + 1) * len(_pal)))] + (255,))


def rot_pt(p, c, deg):                     # PIL rotate(deg) 와 같은 방향(화면에서 반시계 +)
    a = math.radians(deg); dx, dy = p[0] - c[0], p[1] - c[1]
    return (c[0] + dx * math.cos(a) + dy * math.sin(a), c[1] - dx * math.sin(a) + dy * math.cos(a))


def spear_at(deg, hand):
    K = 4; big = spear.resize((S * K, S * K), Image.NEAREST).rotate(deg, resample=Image.NEAREST, center=(HAND[0] * K, HAND[1] * K))
    Q = big.load(); o = Image.new('RGBA', R.size); O = o.load()
    for y in range(S):
        for x in range(S):
            cs = [Q[x * K + a, y * K + b] for a in range(K) for b in range(K) if Q[x * K + a, y * K + b][3] >= 128]
            if len(cs) >= 5: O[x, y] = max(set(cs), key=cs.count)[:3] + (255,)
    s = Image.new('RGBA', R.size); s.alpha_composite(o, (round(hand[0] - HAND[0]), round(hand[1] - HAND[1]))); return s


def frame(lean, sdeg, up=0):
    o = Image.new('RGBA', R.size); o.paste(body.crop((0, WAIST, S, S)), (0, WAIST))
    hand = rot_pt(HAND, BPIV, lean); hand = (hand[0], hand[1] - up)
    o.alpha_composite(spear_at(sdeg, hand))                       # 창은 몸 뒤 (손이 창 위에 오게)
    o.alpha_composite(rot_up(body, lean, WAIST, BPIV))            # 윗몸은 올리지 않는다 (올리면 허리가 떨어짐) — 들어 올림은 창만
    ref = Image.new('RGBA', (S * 2, S)); ref.alpha_composite(R); ref.alpha_composite(_r, (S, 0))   # 들기 키 + 준비 장 팔레트 (창 밝은 보라 살림)
    return walk.outline(walk.palette_lock(o, ref))


ready = walk.frame(cls, 'atkA', 0)
fr = [ready, frame(4, 12, 4), frame(10, 38, 9), frame(-11, -138), frame(-15, -146), ready]   # 검수(pass 3.57) 지적: 정점 더 젖힘, 내려찍기 각도 깊게, 4번은 더 숙임
D = walk.D(cls); Z = 3; M = Image.new('RGBA', (S * Z * len(fr), S * Z), (30, 32, 44, 255))
for i, f in enumerate(fr): M.alpha_composite(f.resize((S * Z, S * Z), Image.NEAREST), (i * S * Z, 0))
M.crop((0, 30 * Z, M.width, S * Z)).save(os.path.join(D, 'slam-strip.png'))
if '--install' in sys.argv:
    p = os.path.join(walk.ROOT, 'src', 'sprites', f'{cls}.png'); sheet = Image.open(p).convert('RGBA'); A = m['anims']['atkB']; r = A['row'] * S
    for i, f in enumerate(fr): sheet.paste(Image.new('RGBA', (S, S)), (i * S, r)); sheet.alpha_composite(f, (i * S, r))
    sheet.save(p); m['pts']['atkB'] = [walk.pts_of(f, (fx, fy)) for f in fr]; m['anims']['atkB']['frames'] = len(fr)
    order = sorted(m['anims'], key=lambda a: m['anims'][a]['row'])
    with open(p[:-4] + '.json', 'w', encoding='utf-8') as fo:
        fo.write(f'{{"w": {S}, "h": {S}, "foot": {json.dumps(m["foot"])},\n "anims": {{\n')
        fo.write(',\n'.join(f'  "{a}": {json.dumps(m["anims"][a])}' for a in order))
        fo.write('\n },\n "pts": {\n')
        fo.write(',\n'.join(f'  "{a}": {json.dumps(m["pts"][a])}' for a in order))
        fo.write('\n }\n}\n')
    print('installed atkB')
print('ok')
