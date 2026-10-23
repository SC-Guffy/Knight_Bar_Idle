# 남은 31회 계획 6번 (무료): 평타 키3 이 두 번 들어간 자리(4번 장 = 3번 장)를 3번 장을 1칸 앞으로 민 "밀어붙임"으로 바꿔 명중 뒤 멈칫을 줄인다.
#   python3 dev/spear/side49/push.py <cls> [<cls> …]   (이미 바꾼 줄은 4번 ≠ 3번 이라 다시 돌려도 그대로)
import os, sys, json
from PIL import Image, ImageChops
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
for cls in sys.argv[1:]:
    p = os.path.join(ROOT, 'src', 'sprites', f'{cls}.png'); m = json.load(open(p[:-4] + '.json')); S = m['w']
    im = Image.open(p).convert('RGBA'); done = []
    for a in ('atkA', 'atkB'):
        r = m['anims'][a]['row'] * S
        f3, f4 = im.crop((3 * S, r, 4 * S, r + S)), im.crop((4 * S, r, 5 * S, r + S))
        if ImageChops.difference(f3, f4).getbbox() is not None: continue
        o = Image.new('RGBA', (S, S)); o.alpha_composite(f3, (1, 0))
        im.paste(Image.new('RGBA', (S, S)), (4 * S, r)); im.alpha_composite(o, (4 * S, r)); done.append(a)
        m['pts'][a][4] = [m['pts'][a][3][0] + 1, m['pts'][a][3][1], m['pts'][a][3][2] + 1, m['pts'][a][3][3]]
    im.save(p)
    order = sorted(m['anims'], key=lambda a: m['anims'][a]['row'])
    with open(p[:-4] + '.json', 'w', encoding='utf-8') as fo:
        fo.write(f'{{"w": {S}, "h": {S}, "foot": {json.dumps(m["foot"])},\n "anims": {{\n')
        fo.write(',\n'.join(f'  "{a}": {json.dumps(m["anims"][a])}' for a in order))
        fo.write('\n },\n "pts": {\n')
        fo.write(',\n'.join(f'  "{a}": {json.dumps(m["pts"][a])}' for a in order))
        fo.write('\n }\n}\n')
    print(cls, 'pushed', done)
