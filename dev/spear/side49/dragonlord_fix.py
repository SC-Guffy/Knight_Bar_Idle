# 남은 31회 계획 3번 (용황 정면으로 돈 평타 장) — 유료 전에 무료로: 몸이 옆을 보는 장에서 코드로 만든다.
#  평타A 3·4번(끝까지 찌름·밀어붙임) = 평타A 2번(옆으로 찌름)의 창을 더 내지르고 윗몸 숙임
#  평타B 1·2번(머리 위로 듦) = 평타A 0번(창을 세워 든 준비)의 허리 위를 뒤로 젖혀 창을 머리 뒤로
#   python3 dev/spear/side49/dragonlord_fix.py [--install]
import os, sys, json
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import walk
from thrust import rot_up
cls = 'dragonlord'; m = walk.meta(cls); S = m['w']; fx, fy = m['foot']; WAIST = 76


def lunge(push, lean, dxb):
    b = walk.frame(cls, 'atkA', 2); P = b.load()
    body, sp = Image.new('RGBA', b.size), Image.new('RGBA', b.size)
    for y in range(S):
        for x in range(S):
            if P[x, y][3]: (sp if x >= 40 and 70 <= y <= 74 else body).putpixel((x, y), P[x, y])
    cols = sorted((p[:3] for p in sp.getdata() if p[3] and sum(p[:3]) > 90), key=sum); shaft = cols[len(cols) * 2 // 5] + (255,)
    o = Image.new('RGBA', b.size); o.paste(body.crop((0, WAIST, S, S)), (0, WAIST))
    o.alpha_composite(rot_up(body, lean, WAIST, (22, 70)), (dxb, 0))
    for y in (71, 72):
        for x in range(38, 40 + push): o.putpixel((x, y), shaft)
    o.alpha_composite(sp, (push, 0))
    return walk.outline(walk.palette_lock(o, b))


def raise_(deg, up):
    b = walk.frame(cls, 'atkA', 0)
    o = Image.new('RGBA', b.size); o.paste(b.crop((0, WAIST, S, S)), (0, WAIST))
    o.alpha_composite(rot_up(b, deg, WAIST, (fx - 2, WAIST - 8)), (-2, -up))
    return walk.outline(walk.palette_lock(o, b))


def key(name, up=0):                                  # 유료 편집 키(64칸) → 시트 칸. 10-23 '들기' 주문이 옆모습으로 창을 세워 든 그림으로 나옴
    import keys
    k = keys.to_sheet(cls, Image.open(os.path.join(walk.D(cls), f'raw-k-{name}.png')).convert('RGBA'))
    if up: o = Image.new('RGBA', k.size); o.alpha_composite(k, (0, -up)); k = o
    return k


# 평타A 3·4 = 코드(2번 장과 같은 방향), 평타B 1·2 = 옆모습 들기 키 (raise_ 코드판은 창 아랫부분이 발밑에 남아 안 씀)
new = {('atkA', 3): lunge(7, -7, 2), ('atkA', 4): lunge(8, -8, 3), ('atkB', 1): key('raise-0'), ('atkB', 2): key('raise-0', 2)}
D = walk.D(cls); os.makedirs(D, exist_ok=True)
rows = []
for a in ('atkA', 'atkB'):
    fr = [new.get((a, i)) or walk.frame(cls, a, i) for i in range(m['anims'][a]['frames'])]; rows.append(fr)
Z = 3; M = Image.new('RGBA', (S * Z * 6, S * Z * 2), (30, 32, 44, 255))
for r, fr in enumerate(rows):
    for i, f in enumerate(fr): M.alpha_composite(f.resize((S * Z, S * Z), Image.NEAREST), (i * S * Z, r * S * Z))
M.save(os.path.join(D, 'fix-strip.png'))
if '--install' in sys.argv:
    p = os.path.join(walk.ROOT, 'src', 'sprites', f'{cls}.png'); sheet = Image.open(p).convert('RGBA')
    for (a, i), f in new.items():
        r = m['anims'][a]['row'] * S; sheet.paste(Image.new('RGBA', (S, S)), (i * S, r)); sheet.alpha_composite(f, (i * S, r)); m['pts'][a][i] = walk.pts_of(f, (fx, fy))
    sheet.save(p); order = sorted(m['anims'], key=lambda a: m['anims'][a]['row'])
    with open(p[:-4] + '.json', 'w', encoding='utf-8') as fo:
        fo.write(f'{{"w": {S}, "h": {S}, "foot": {json.dumps(m["foot"])},\n "anims": {{\n')
        fo.write(',\n'.join(f'  "{a}": {json.dumps(m["anims"][a])}' for a in order))
        fo.write('\n },\n "pts": {\n')
        fo.write(',\n'.join(f'  "{a}": {json.dumps(m["pts"][a])}' for a in order))
        fo.write('\n }\n}\n')
    print('installed')
print('ok')
