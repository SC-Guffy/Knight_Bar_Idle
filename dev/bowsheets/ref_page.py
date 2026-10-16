# 기준 그림 정리본 검토 그림·검토 페이지 절 (C절): dev/review/sheets-bow/ref/
#   python -I -B dev/bowsheets/ref_page.py   (점수는 dev/bowsheets/qa/verdicts-ref.json — 비평 결과를 세션이 적어 둔 것)
import os, sys, json, shutil
from PIL import Image, ImageOps
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(os.path.dirname(HERE))
REF = os.path.join(HERE, 'design', 'ref'); QA = os.path.join(HERE, 'qa'); OUT = os.path.join(ROOT, 'dev', 'review', 'sheets-bow', 'ref'); os.makedirs(OUT, exist_ok=True)
SW = os.path.join(ROOT, 'dev', 'review', 'sheets-sword', 'design')
IDS = ['ranger', 'marksman', 'arcaneArcher', 'arbalest']
N = {'ranger': '레인저', 'marksman': '저격수', 'arcaneArcher': '마궁수', 'arbalest': '석궁사수'}
BG = (20, 22, 29, 255)


def line(ims, S=4, gap=12, m='color'):
    H = max(i.height for i in ims); o = Image.new('RGBA', (sum(i.width * S + gap for i in ims), H * S + 8), BG); x = 0
    for im in ims:
        if m == 'gray':
            g = ImageOps.grayscale(im.convert('RGB')).convert('RGBA'); g.putalpha(im.getchannel('A')); im = g
        elif m == 'sil':
            s = Image.new('RGBA', im.size, (230, 230, 236, 255)); s.putalpha(im.getchannel('A')); im = s
        o.alpha_composite(im.resize((im.width * S, im.height * S), Image.NEAREST), (x, (H - im.height) * S)); x += im.width * S + gap
    return o


if __name__ == '__main__':
    for c in IDS:
        for t in ('clean', 'polish'):
            shutil.copy(os.path.join(REF, f'{c}-{t}.png'), os.path.join(OUT, f'{c}-{t}.png'))
            shutil.copy(os.path.join(QA, f'ref-{c}-{t}', 'sheet.png'), os.path.join(OUT, f'sheet-{c}-{t}.png'))
        shutil.copy(os.path.join(HERE, 'work', c, 'ref64-0.png'), os.path.join(OUT, f'{c}-pl.png'))
    refs = [Image.open(os.path.join(SW, f)).convert('RGBA') for f in ('b46-swordsman.png', 'b46-paladin.png') if os.path.exists(os.path.join(SW, f))]
    refs = [r.crop(r.getbbox()) for r in refs]
    ims = [Image.open(os.path.join(REF, f'{c}-clean.png')).convert('RGBA') for c in IDS]
    for m in ('color', 'gray', 'sil'): line(refs + ims, m=m).save(os.path.join(OUT, f'line-{m}.png'))
    print('ok')
