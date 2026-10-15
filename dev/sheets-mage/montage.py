# 시트 몽타주 (검토용): python -I -B montage.py <시트 폴더> <출력.png> [gray]
#  직업마다 한 줄 — idle·walk 3장·atkA 2장·atkB 2장·cast 5장(키 자세 bowA −1.4·−0.7·−0.2·0.7·1.2)·hurt·death 끝
import sys, json
from PIL import Image
IDS = ['mage', 'pyromancer', 'cryomancer', 'electromancer', 'archmage', 'frostlord', 'thunderEmperor']
PICK = [('idle', 0), ('walk', 1), ('walk', 3), ('walk', 5), ('atkA', 1), ('atkA', 2), ('atkB', 1), ('atkB', 2),
        ('cast', 0), ('cast', 1), ('cast', 2), ('cast', 3), ('cast', 4), ('hurt', 0), ('death', 4)]
src, dst = sys.argv[1], sys.argv[2]; gray = len(sys.argv) > 3
S, C = 2, (8, 22, 88, 96); W, H = C[2] - C[0], C[3] - C[1]
out = Image.new('RGBA', (W * S * len(PICK), H * S * len(IDS)), (18, 20, 27, 255))
for r, c in enumerate(IDS):
    sh = Image.open(f'{src}/{c}.png').convert('RGBA'); m = json.load(open(f'{src}/{c}.json'))
    for i, (a, f) in enumerate(PICK):
        A = m['anims'][a]; f = min(f, A['frames'] - 1)
        fr = sh.crop((96 * f, 96 * A['row'], 96 * f + 96, 96 * A['row'] + 96)).crop(C)
        if gray: g = fr.convert('LA').convert('RGBA'); g.putalpha(fr.getchannel('A')); fr = g
        out.alpha_composite(fr.resize((W * S, H * S), Image.NEAREST), (W * S * i, H * S * r))
out.save(dst); print(dst, out.size)
