# 미리보기: 시트를 게임 로더(vfx-tex.js vfxQuantize·vfxSheet)와 같은 식으로 양자화·다시 칠해 4배로 나란히
#  python -I preview.py group <XW|XH|XP|XE|XK|XF>        → preview-<group>.png (시트마다: 회색조 + 직업색 7가지)
#  python -I preview.py ids <out.png> <scale> id1 id2 ... → 빠른 확인 (회색조 + 파이터색)
#  python -I preview.py family                           → family-gray.png
import sys, os, json
from PIL import Image, ImageDraw
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
COLORS = [('gray', None), ('fighter', '#ffb35c'), ('striker', '#ff5a3a'), ('kickboxer', '#5fe0a0'), ('qigong', '#a8b4ff'),
          ('champion', '#ffd257'), ('tempest', '#9ff0ff'), ('grandmaster', '#e8e0ff')]

def lv(im):
    W, H = im.size; px = im.load(); out = [[0] * W for _ in range(H)]
    for y in range(H):
        for x in range(W):
            c = px[x, y]
            if c[3] < 24: continue
            l = (0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2]) / 255
            out[y][x] = 1 if l < 0.2 else 2 + round((l - 0.2) / 0.8 * 4)
    return out

def ramp(col):
    if col is None: return [(11, 13, 20)] + [(int(v), int(v), int(v)) for v in (64, 112, 160, 208, 255)]
    rgb = [int(col[i:i + 2], 16) for i in (1, 3, 5)]
    dark = [rgb[0] * 0.38, rgb[1] * 0.38, rgb[2] * 0.45]; r = [(11, 13, 20)]
    for k in range(5):
        t = k / 4
        r.append(tuple(int(d + (rgb[j] - d) * t * 2) if t <= 0.5 else int(rgb[j] + (255 - rgb[j]) * (t - 0.5) * 2) for j, d in enumerate(dark)))
    return r

def tint(sid, col):
    im = Image.open(os.path.join(ROOT, 'src', 'vfx', sid + '.png')).convert('RGBA'); g = lv(im); rp = ramp(col)
    o = Image.new('RGBA', im.size, (0, 0, 0, 0)); px = o.load()
    for y, row in enumerate(g):
        for x, v in enumerate(row):
            if v: px[x, y] = rp[v - 1] + (255,)
    return o

def board(W, H):
    bg = Image.new('RGBA', (W, H), (40, 44, 56, 255)); px = bg.load()
    for y in range(H):
        for x in range(W):
            if (x // 8 + y // 8) % 2: px[x, y] = (54, 58, 72, 255)
    return bg

def stack(rows, sc, out, gap=6):
    # rows: [(label, [img, img, ...])]
    W = max(sum(i.width * sc + gap for i in r) for _, r in rows) + 110; H = sum(max(i.height for i in r) * sc + gap for _, r in rows) + gap
    bg = board(W, H); d = ImageDraw.Draw(bg); y = gap
    for lab, r in rows:
        d.text((4, y + 2), lab, fill=(230, 230, 230, 255)); x = 104
        for i in r:
            bg.alpha_composite(i.resize((i.width * sc, i.height * sc), Image.NEAREST), (x, y)); x += i.width * sc + gap
        y += max(i.height for i in r) * sc + gap
    bg.save(out); print('saved', out, bg.size)

man = {m['id']: m for m in json.load(open(os.path.join(HERE, 'manifest.json'), encoding='utf-8'))}
cmd = sys.argv[1]
if cmd == 'group':
    g = sys.argv[2].lower(); rows = []
    for sid in [k for k in man if k.startswith(g)]:
        for name, col in COLORS: rows.append((f'{sid} {name}', [tint(sid, col)]))
    stack(rows, 4, os.path.join(HERE, f'preview-{g.upper()}.png'))
elif cmd == 'ids':
    out, sc = sys.argv[2], int(sys.argv[3]); rows = []
    for sid in sys.argv[4:]:
        rows.append((sid, [tint(sid, None)])); rows.append((sid + ' col', [tint(sid, sys.argv[0] and '#ffb35c')]))
    stack(rows, sc, out)
elif cmd == 'family':
    def pair(w, h):
        ws = tint(w, None) if w else None; hs = tint(h, None)
        return [x for x in (ws, hs) if x]
    rows = [('XW2/XH2 striker', pair('xw2', 'xh2')), ('XW3/XH4 kick', pair('xw3', 'xh4')), ('XW4/XH6 qigong', pair('xw4', 'xh6'))]
    for lab, w, h in (('XW2a/XH3 champ', 'xw2a', 'xh3'), ('XW3a/XH5 tempest', 'xw3a', 'xh5'), ('XW4a/XH7 gm', 'xw4a', 'xh7')):
        if os.path.exists(os.path.join(ROOT, 'src', 'vfx', h + '.png')): rows.append((lab, pair(w if os.path.exists(os.path.join(ROOT, 'src', 'vfx', w + '.png')) else None, h)))
    stack(rows, 4, os.path.join(HERE, 'family-gray.png'))
