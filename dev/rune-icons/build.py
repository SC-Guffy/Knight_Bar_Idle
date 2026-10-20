# 고른 룬 그림 → src/skin/runes.png (32×32 칸, 순서 = src/rune.js RUNE_CELLS). 고른 파일은 picks.json {id: "raw/…png"}
# 정리: 반투명 가장자리를 0/255 로 나눠 1배에서 번지지 않게 한다.
import os, json
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, '..', '..')
CELLS = ['exec', 'boss', 'first', 'solo', 'crowd', 'dot', 'double', 'stack', 'vuln', 'refund', 'haste', 'chain', 'range', 'overkill',
         'twin', 'after', 'burst', 'more', 'L-blade', 'L-frenzy', 'L-endless', 'L-echo', 'L-myriad', 'L-reach', 'L-zen']
picks = json.load(open(os.path.join(HERE, 'picks.json'), encoding='utf-8'))

def clean(im):
    im = im.convert('RGBA')
    px = im.load()
    for y in range(im.height):
        for x in range(im.width):
            r, g, b, a = px[x, y]
            px[x, y] = (r, g, b, 255) if a >= 128 else (0, 0, 0, 0)
    return im

sheet = Image.new('RGBA', (32 * len(CELLS), 32), (0, 0, 0, 0))
for i, c in enumerate(CELLS):
    sheet.alpha_composite(clean(Image.open(os.path.join(HERE, picks[c]))), (i * 32, 0))
sheet.save(os.path.join(ROOT, 'src', 'skin', 'runes.png'))
print('runes.png', len(CELLS), 'cells')
