# 기준 그림(대기 1장, 시트 칸 크기·발 기준점) 7종 → dev/review/sheets-spear/ 에 컬러·흑백·실루엣 라인업과 직업별 기준 그림.
#   python -I lineup.py   (먼저 capture.js 로 shots/ 를 채운다)
import os, sys
from PIL import Image, ImageOps
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from build import CELL, from_rig
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(os.path.dirname(HERE), 'review', 'sheets-spear'); os.makedirs(OUT, exist_ok=True)
ORDER = ['lancer', 'dragoon', 'cavalier', 'halberdier', 'dragonlord', 'skyGeneral', 'warlord']
BG = (32, 34, 44, 255)


def tile(im, S, foot, mode):
    if mode == 'gray':
        a = im.split()[3]; g = ImageOps.grayscale(im.convert('RGB')).convert('RGBA'); g.putalpha(a); im = g
    elif mode == 'sil':
        a = im.split()[3]; im = Image.new('RGBA', im.size, (230, 232, 240, 255)); im.putalpha(a)
    b = Image.new('RGBA', (128, 128), BG); b.paste(im, (52 - foot[0], 112 - foot[1]), im)  # 발을 (52, 112) 에 맞춘다
    return b


for pose in ('idle', 'guard'):
    for mode in ('color', 'gray', 'sil'):
        row = Image.new('RGBA', (len(ORDER) * 130, 128), (20, 22, 29, 255))
        for i, c in enumerate(ORDER):
            S, foot = CELL[c]; im = from_rig(c, pose, 0)
            if mode == 'color' and pose == 'idle': im.save(os.path.join(OUT, f'ref-{c}.png'))
            row.alpha_composite(tile(im, S, foot, mode), (i * 130, 0))
        row.resize((row.width * 3, row.height * 3), Image.NEAREST).save(os.path.join(OUT, f'lineup-{pose}-{mode}.png'))
print('ok', OUT)
