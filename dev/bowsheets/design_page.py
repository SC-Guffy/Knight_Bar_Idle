# 디자인 시안 검토 그림: dev/review/sheets-bow/design/ 에
#   now-<cls>.png       지금 게임 대기 그림 (1배, 잘라서)
#   px-<판>-<cls>-<seed>.png 46px 후보 (1배) · t-<판>-<cls>-<seed>.jpg ComfyUI 원본 축소(256)
#   pick-<판>-line-{color,gray,sil}.png 고른 대표 줄 (3배, 맨 앞에 검사 계열 b46 검사·성기사 = 그림체 기준)
#   size-<판>.png 지금 키 35 와 새 키 46 을 같은 땅에 (3배) · gaps-<판>.json 팔·다리 틈 수치
#   python -I -B dev/bowsheets/design_page.py [판=B4]
import os, sys, json
from PIL import Image, ImageOps, ImageDraw
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(os.path.dirname(HERE))
RAW = os.path.join(HERE, 'design', 'raw'); PXD = os.path.join(HERE, 'design', 'px'); CAP = os.path.join(HERE, 'cap')
OUT = os.path.join(ROOT, 'dev', 'review', 'sheets-bow', 'design'); os.makedirs(OUT, exist_ok=True)
SWORD = os.path.join(ROOT, 'dev', 'review', 'sheets-sword', 'design')
IDS = ['ranger', 'marksman', 'arcaneArcher', 'arbalest']
SEEDS = [11, 23, 37, 51]
VER = sys.argv[1] if len(sys.argv) > 1 else 'B4'
PF = os.path.join(HERE, 'design', f'pick-{VER}.json') if VER != 'B' else os.path.join(HERE, 'design', 'pick.json')
PICK = json.load(open(PF)) if os.path.exists(PF) else {}
BG = (20, 22, 29, 255)


def crop(im):
    return im.crop(im.getbbox())


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


def gaps(im):
    """팔·다리 틈: 줄마다 불투명 덩어리(가로 연속) 수. 다리 = 아래 30% 줄 중 덩어리 2개 이상 비율, 팔 = 25~65% 높이 줄 중 2개 이상 비율 (무기 칸이 섞여 대략값)"""
    im = crop(im); A = im.getchannel('A').load(); W, H = im.size
    def runs(y):
        n, inside = 0, False
        for x in range(W):
            o = A[x, y] > 0
            if o and not inside: n += 1
            inside = o
        return n
    low = [runs(y) >= 2 for y in range(int(H * 0.7), H - 1)]; mid = [runs(y) >= 2 for y in range(int(H * 0.25), int(H * 0.65))]
    return {'legs': round(sum(low) / max(1, len(low)), 2), 'arms': round(sum(mid) / max(1, len(mid)), 2)}


if __name__ == '__main__':
    res = {}
    for c in IDS:
        crop(Image.open(os.path.join(CAP, f'c-{c}-full.png')).convert('RGBA')).save(os.path.join(OUT, f'now-{c}.png'))
        for s in SEEDS:
            p = os.path.join(PXD, f'{c}-{VER}-{s}-h46.png')
            if os.path.exists(p):
                im = Image.open(p).convert('RGBA'); im.save(os.path.join(OUT, f'px-{VER}-{c}-{s}.png')); res[f'{c}-{s}'] = gaps(im)
            r = os.path.join(RAW, f'{c}-{VER}-{s}.png')
            if os.path.exists(r): Image.open(r).convert('RGB').resize((256, 256), Image.LANCZOS).save(os.path.join(OUT, f't-{VER}-{c}-{s}.jpg'), quality=88)
    ref = [crop(Image.open(os.path.join(SWORD, f'b46-{c}.png')).convert('RGBA')) for c in ('swordsman', 'paladin') if os.path.exists(os.path.join(SWORD, f'b46-{c}.png'))]
    for c in ('swordsman', 'paladin'):
        if os.path.exists(os.path.join(SWORD, f'b46-{c}.png')): res['ref-' + c] = gaps(Image.open(os.path.join(SWORD, f'b46-{c}.png')).convert('RGBA'))
    picks = [Image.open(os.path.join(PXD, f'{c}-{VER}-{PICK[c]}-h46.png')).convert('RGBA') for c in IDS if c in PICK]
    if picks:
        for m in ('color', 'gray', 'sil'): line(ref + picks, m=m).save(os.path.join(OUT, f'pick-{VER}-line-{m}.png'))
        nows = [crop(Image.open(os.path.join(CAP, f'c-{c}-full.png')).convert('RGBA')) for c in IDS if c in PICK]
        S = 3; W = sum(n.width + p.width + 18 for n, p in zip(nows, picks)) * S; H = max(p.height for p in picks) * S + 20
        o = Image.new('RGBA', (W, H), (34, 40, 30, 255)); d = ImageDraw.Draw(o); x = 0
        d.rectangle([0, H - 14, W, H], fill=(60, 48, 32, 255))
        for n, p in zip(nows, picks):
            o.alpha_composite(n.resize((n.width * S, n.height * S), Image.NEAREST), (x, H - 14 - n.height * S)); x += n.width * S + 6
            o.alpha_composite(p.resize((p.width * S, p.height * S), Image.NEAREST), (x, H - 14 - p.height * S)); x += p.width * S + 12 * S
        o.save(os.path.join(OUT, f'size-{VER}.png'))
    json.dump(res, open(os.path.join(OUT, f'gaps-{VER}.json'), 'w'), indent=1)
    print('ok', VER, {k: v for k, v in res.items()})
