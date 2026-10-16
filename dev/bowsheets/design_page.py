# 디자인 시안 검토 그림: dev/review/sheets-bow/design/ 에
#   now-<cls>.png      지금 게임 대기 그림 (1배, 잘라서)
#   px-<cls>-<seed>.png 46px 후보 (1배) · t-<cls>-<seed>.jpg ComfyUI 원본 축소(256)
#   pick-line-{color,gray,sil}.png  고른 대표 4종 줄 (3배) · size-<cls>.png 지금 키 35 와 새 키 46 을 같은 땅에 (3배)
#   python -I -B dev/bowsheets/design_page.py
import os, sys, json
from PIL import Image, ImageOps, ImageDraw
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(os.path.dirname(HERE))
RAW = os.path.join(HERE, 'design', 'raw'); PXD = os.path.join(HERE, 'design', 'px'); CAP = os.path.join(HERE, 'cap')
OUT = os.path.join(ROOT, 'dev', 'review', 'sheets-bow', 'design'); os.makedirs(OUT, exist_ok=True)
IDS = ['ranger', 'marksman', 'arcaneArcher', 'arbalest']
SEEDS = [11, 23, 37, 51]
# 대표로 고른 시드 (브리프에 가장 맞고 옆모습·활/석궁이 읽히는 것) — 바꾸면 다시 돌린다
PICK = json.load(open(os.path.join(HERE, 'design', 'pick.json'))) if os.path.exists(os.path.join(HERE, 'design', 'pick.json')) else {}
BG = (20, 22, 29, 255)


def crop(im):
    bb = im.getbbox(); return im.crop(bb)


def mode(im, m):
    if m == 'gray':
        g = ImageOps.grayscale(im.convert('RGB')).convert('RGBA'); g.putalpha(im.getchannel('A')); return g
    if m == 'sil':
        s = Image.new('RGBA', im.size, (230, 230, 236, 255)); s.putalpha(im.getchannel('A')); return s
    return im


def line(ims, S=3, gap=10, m='color'):
    H = max(i.height for i in ims); o = Image.new('RGBA', (sum(i.width * S + gap for i in ims), H * S + 8), BG); x = 0
    for im in ims:
        o.alpha_composite(mode(im, m).resize((im.width * S, im.height * S), Image.NEAREST), (x, (H - im.height) * S)); x += im.width * S + gap
    return o


if __name__ == '__main__':
    for c in IDS:
        crop(Image.open(os.path.join(CAP, f'c-{c}-full.png')).convert('RGBA')).save(os.path.join(OUT, f'now-{c}.png'))
        for s in SEEDS:
            p = os.path.join(PXD, f'{c}-B-{s}-h46.png')
            if os.path.exists(p): Image.open(p).save(os.path.join(OUT, f'px-{c}-{s}.png'))
            r = os.path.join(RAW, f'{c}-B-{s}.png')
            if os.path.exists(r): Image.open(r).convert('RGB').resize((256, 256), Image.LANCZOS).save(os.path.join(OUT, f't-{c}-{s}.jpg'), quality=88)
    picks = [Image.open(os.path.join(PXD, f'{c}-B-{PICK[c]}-h46.png')).convert('RGBA') for c in IDS if c in PICK]
    if picks:
        for m in ('color', 'gray', 'sil'): line(picks, m=m).save(os.path.join(OUT, f'pick-line-{m}.png'))
        nows = [crop(Image.open(os.path.join(CAP, f'c-{c}-full.png')).convert('RGBA')) for c in IDS if c in PICK]
        line(nows).save(os.path.join(OUT, 'now-line.png'))
        # 같은 땅에 지금(35) · 새(46) 나란히 — 3배
        S = 3; W = sum(n.width + p.width + 18 for n, p in zip(nows, picks)) * S; H = max(p.height for p in picks) * S + 20
        o = Image.new('RGBA', (W, H), (34, 40, 30, 255)); d = ImageDraw.Draw(o); x = 0
        d.rectangle([0, H - 14, W, H], fill=(60, 48, 32, 255))
        for n, p in zip(nows, picks):
            o.alpha_composite(n.resize((n.width * S, n.height * S), Image.NEAREST), (x, H - 14 - n.height * S)); x += n.width * S + 6
            o.alpha_composite(p.resize((p.width * S, p.height * S), Image.NEAREST), (x, H - 14 - p.height * S)); x += p.width * S + 12 * S
        o.save(os.path.join(OUT, 'size-compare.png'))
    print('ok', len(os.listdir(OUT)))
