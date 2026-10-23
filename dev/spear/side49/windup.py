# 남은 31회 계획 5번 (사용자 10-23: 코드로): 평타A 1번 장을 "창을 뒤로 당긴 예비동작"으로 — 준비 그림(0번)의 허리 위(창 포함)를
#  허리 축으로 뒤로 젖히고(+deg) 뒤로 dx 칸 민다. 다리는 그대로. hit(2번)·프레임 수는 그대로.
#   python3 dev/spear/side49/windup.py <cls> [deg=9] [dx=-4] [--install]
import os, sys, json
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import walk
from thrust import rot_up
cls = sys.argv[1]; args = [a for a in sys.argv[2:] if not a.startswith('--')]
deg = float(args[0]) if args else 9; dx = int(args[1]) if len(args) > 1 else -4
m = walk.meta(cls); S = m['w']; fx, fy = m['foot']; waist = fy - 8; piv = (fx - 2, waist - 8)
base = walk.frame(cls, 'atkA', 0)
o = Image.new('RGBA', base.size); o.paste(base.crop((0, waist, S, S)), (0, waist))
o.alpha_composite(rot_up(base, deg, waist, piv), (dx, 0))
f = walk.outline(walk.palette_lock(o, base))
D = walk.D(cls); os.makedirs(D, exist_ok=True); f.save(os.path.join(D, 'windup.png'))
M = Image.new('RGBA', (S * 3 * 3, S * 3), (30, 32, 44, 255))
for i, g in enumerate([base, f, walk.frame(cls, 'atkA', 2)]): M.alpha_composite(g.resize((S * 3, S * 3), Image.NEAREST), (i * S * 3, 0))
M.crop((0, 40 * 3, M.width, S * 3)).save(os.path.join(D, 'windup-strip.png'))
if '--install' in sys.argv:
    p = os.path.join(walk.ROOT, 'src', 'sprites', f'{cls}.png'); sheet = Image.open(p).convert('RGBA'); r = m['anims']['atkA']['row'] * S
    sheet.paste(Image.new('RGBA', (S, S)), (S, r)); sheet.alpha_composite(f, (S, r)); sheet.save(p)
    m['pts']['atkA'][1] = walk.pts_of(f, (fx, fy))
    order = sorted(m['anims'], key=lambda a: m['anims'][a]['row'])
    with open(p[:-4] + '.json', 'w', encoding='utf-8') as fo:
        fo.write(f'{{"w": {S}, "h": {S}, "foot": {json.dumps(m["foot"])},\n "anims": {{\n')
        fo.write(',\n'.join(f'  "{a}": {json.dumps(m["anims"][a])}' for a in order))
        fo.write('\n },\n "pts": {\n')
        fo.write(',\n'.join(f'  "{a}": {json.dumps(m["pts"][a])}' for a in order))
        fo.write('\n }\n}\n')
    print('installed windup', cls)
print('ok')
