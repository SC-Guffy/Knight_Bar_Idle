# 시트의 동작 줄을 크게 펼쳐 보기 (개발용): python -I dev/boxer/sheets/rows.py <출력.png> <직업> <동작,동작,...> [배율=4]
import sys, json, os
from PIL import Image, ImageDraw
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..')
out, cls, anims = sys.argv[1], sys.argv[2], sys.argv[3].split(',')
S = int(sys.argv[4]) if len(sys.argv) > 4 else 4
m = json.load(open(os.path.join(ROOT, 'src', 'sprites', cls + '.json')))
im = Image.open(os.path.join(ROOT, 'src', 'sprites', cls + '.png')).convert('RGBA')
n = max(m['anims'][a]['frames'] for a in anims if a in m['anims'])
o = Image.new('RGBA', (64 * S * n + 80, 64 * S * len(anims)), (30, 32, 40, 255)); d = ImageDraw.Draw(o)
for r, a in enumerate(anims):
    if a not in m['anims']: continue
    A = m['anims'][a]; d.text((4, r * 64 * S + 4), f"{a}\nhit {A.get('hit','')}", fill=(255, 220, 120))
    for f in range(A['frames']):
        fr = im.crop((f * 64, A['row'] * 64, f * 64 + 64, A['row'] * 64 + 64)).resize((64 * S, 64 * S), Image.NEAREST)
        o.alpha_composite(fr, (80 + f * 64 * S, r * 64 * S))
        d.rectangle((80 + f * 64 * S, r * 64 * S, 80 + (f + 1) * 64 * S - 1, (r + 1) * 64 * S - 1), outline=(60, 60, 70))
o.convert('RGB').save(out)
