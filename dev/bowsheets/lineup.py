# 검토용 줄 세우기: 기준 그림(ref) 7종을 컬러·흑백·실루엣으로, 칸 테두리·발 기준점과 함께 → dev/review/sheets-bow/*.png
#   python -I dev/bowsheets/lineup.py
import os
from PIL import Image, ImageDraw, ImageOps
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(os.path.dirname(HERE))
import sys; sys.path.insert(0, HERE)
from sheet import cell_of
OUT = os.path.join(ROOT, 'dev', 'review', 'sheets-bow'); os.makedirs(OUT, exist_ok=True)
IDS = ['ranger', 'marksman', 'arcaneArcher', 'arbalest', 'deadeye', 'voidArcher', 'siegeMaster']
BG = (20, 22, 29, 255)


def gray(im):
    g = ImageOps.grayscale(im.convert('RGB')).convert('RGBA'); g.putalpha(im.getchannel('A')); return g


def sil(im):
    s = Image.new('RGBA', im.size, (230, 230, 236, 255)); s.putalpha(im.getchannel('A')); return s


def cellshot(cls, mode, S=3, suffix=''):
    W, foot = cell_of(cls)
    im = Image.open(os.path.join(HERE, 'ref', f'{cls}{suffix}.png')).convert('RGBA')
    im = {'color': im, 'gray': gray(im), 'sil': sil(im)}[mode]
    o = Image.new('RGBA', (W, W), BG); o.alpha_composite(im)
    o = o.resize((W * S, W * S), Image.NEAREST); d = ImageDraw.Draw(o)
    d.rectangle([0, 0, W * S - 1, W * S - 1], outline=(70, 74, 92))
    fx, fy = foot; d.line([((fx - 4) * S, (fy + 1) * S), ((fx + 4) * S, (fy + 1) * S)], fill=(255, 90, 90), width=2)
    return o


for mode in ('color', 'gray', 'sil'):
    for suf in ('', '-fight'):
        cells = [cellshot(c, mode, suffix=suf) for c in IDS]
        H = max(c.height for c in cells)
        o = Image.new('RGBA', (sum(c.width for c in cells) + 8 * len(cells), H), BG); x = 0
        for c in cells: o.alpha_composite(c, (x, H - c.height)); x += c.width + 8
        o.save(os.path.join(OUT, f'ref{suf}-{mode}.png'))
# 개별 1배 (페이지에서 확대해 본다)
for c in IDS:
    for suf in ('', '-fight'):
        Image.open(os.path.join(HERE, 'ref', f'{c}{suf}.png')).save(os.path.join(OUT, f'{c}{suf}.png'))
print('ok', OUT)
