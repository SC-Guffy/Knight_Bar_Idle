# ⑤-3 전후 비교 한 장: 위 줄 = before-*, 아래 줄 = after-* (같은 칸 번호). 720×300 캔버스를 반으로 줄여 128색 양자화.
#   python -I dev/vfx3/montage.py            → dev/vfx-survey/vfx3/cmp-<id>-s<stage>.png, cmp-basic-<cls>.png
#   python -I dev/vfx3/montage.py gray       → 계열 흑백 비교 family-bow-after(-gray).png 도 만든다
import os, re, sys
from collections import defaultdict
from PIL import Image, ImageDraw, ImageOps
D = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'vfx-survey', 'vfx3')
files = [f for f in os.listdir(D) if re.match(r'(before|after)-.*-\d+\.png$', f)]
groups = defaultdict(dict)
for f in files:
    tag, rest = f.split('-', 1)
    key, k = rest[:-4].rsplit('-', 1)
    groups[key].setdefault(tag, {})[int(k)] = f
S = 0.5
for key, g in sorted(groups.items()):
    if 'before' not in g or 'after' not in g: continue
    n = max(len(g['before']), len(g['after']))
    w, h = 360, 150     # 게임 px 그대로 (캡처는 720×300 또는 화면 배율 2배면 1440×600)
    out = Image.new('RGB', (n * (w + 4) + 60, 2 * (h + 4) + 4), (20, 22, 30)); d = ImageDraw.Draw(out)
    for r, tag in enumerate(['before', 'after']):
        d.text((6, 4 + r * (h + 4) + h // 2 - 6), 'BEFORE' if r == 0 else 'AFTER', fill=(255, 230, 120))
        for k in range(n):
            f = g[tag].get(k)
            if not f: continue
            im = Image.open(os.path.join(D, f)).convert('RGB').resize((w, h), Image.LANCZOS)
            out.paste(im, (60 + k * (w + 4), 4 + r * (h + 4)))
    out = out.quantize(128).convert('RGB')
    out.save(os.path.join(D, f'cmp-{key}.png'))
print('montages', len(groups))

# 계열 비교 (후): 줄 = 2차 3종 + 3차 3종, 칸 = 스킬 2개(★★★ 가운데 칸) + 평타(명중 프레임). 흑백판도
ROWS = [('marksman', ['headshot', 'armorPiercer']), ('arcaneArcher', ['homingBolts', 'starfall']), ('arbalest', ['blastBolt', 'boltStorm']),
        ('deadeye', ['sunArrow']), ('voidArcher', ['dimensionCollapse']), ('siegeMaster', ['siegeBarrage'])]
FR = {'headshot': 4, 'armorPiercer': 2, 'homingBolts': 4, 'starfall': 4, 'blastBolt': 4, 'boltStorm': 4, 'sunArrow': 3, 'dimensionCollapse': 2, 'siegeBarrage': 4}
for tag in ['before', 'after']:
    w, h = 360, 150
    sheet = Image.new('RGB', (3 * (w + 4) + 4, len(ROWS) * (h + 4) + 4), (20, 22, 30))
    for r, (cls, sks) in enumerate(ROWS):
        cells = [f'{tag}-{s}-s3-{FR[s]}.png' for s in sks] + ([None] if len(sks) == 1 else []) + [f'{tag}-basic-{cls}-3.png']
        for c, f in enumerate(cells):
            if f and os.path.exists(os.path.join(D, f)):
                sheet.paste(Image.open(os.path.join(D, f)).convert('RGB').resize((w, h), Image.LANCZOS), (4 + c * (w + 4), 4 + r * (h + 4)))
    sheet = sheet.quantize(128).convert('RGB')
    sheet.save(os.path.join(D, f'family-bow-{tag}.png'))
    ImageOps.grayscale(sheet).save(os.path.join(D, f'family-bow-{tag}-gray.png'))
print('family')
