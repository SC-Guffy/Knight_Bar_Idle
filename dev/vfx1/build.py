# ⑤-1 시트 굽기: 키 그림 + 애니 프레임 → src/vfx/<id>.png (가로로 이어 붙인 한 장)
#  python -I build.py [id ...]   (없으면 BUILD 전부)
#  프레임마다: 반투명(알파<128) 지우기 · 테두리에 닿은 배경판 지우기 · 작은 덩어리 지우기 (dev/pixellab/sheet.py 와 같은 정리)
#  그다음 모든 프레임의 불투명 영역을 합친 상자로 잘라 낸다 (바닥 기준 시트는 그림 아래 끝 = 시트 아래 끝이 된다)
#  애니가 아직 없으면 키 그림을 frames 만큼 되풀이한다 (임시)
import sys, os, glob
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', '..', 'src', 'vfx')

# id: (키 그림, 프레임 수, 옵션) — 키 그림은 keyc/ (정리본) 또는 raw/
#  opt: anim 애니 접두(기본 '<id>-anim-s7'), skip 애니에서 버릴 프레임 번호, gray 회색 바둑판 배경 지우기, squash (w, h) 최종 크기로 nearest,
#       rows (y0, y1) 키 그림의 가로 띠만, cols (x0, x1), min 작은 덩어리 기준, keep_box 자르지 않음
BUILD = {
  'w8': ('raw/w8-s11-0.png', 1, {}),
  'h05': ('keyc/h05.png', 5, {}), 'h15': ('keyc/h15.png', 5, {}), 'h16': ('keyc/h16.png', 5, {}), 'h17': ('keyc/h17.png', 5, {}),
  'h27': ('keyc/h27.png', 5, {}), 'h28': ('keyc/h28.png', 5, {}), 'h29': ('raw/h29-s11-0.png', 5, {}),
  'p4': ('keyc/p4.png', 3, {}), 'p7': ('keyc/p7.png', 3, {}), 'p8': ('keyc/p8.png', 3, {}),
  'p9': ('raw/p9-s3-0.png', 1, {}), 'p10': ('raw/p10-s11-0.png', 1, {}),
  'p11': ('raw/p11-s3-0.png', 3, {'anim': 'p11-anim-s7'}), 'p12': ('raw/p12-s11-0.png', 3, {'gray': True, 'anim': 'p12-anim-s7'}),
  'e04': ('keyc/e04.png', 7, {}), 'e04b': ('raw/e04b-s5-0.png', 5, {'rows': (0, 59)}), 'k04': ('keyc/k04.png', 4, {'skip': (4,)}), 'c9': ('keyc/c9.png', 5, {}),
  'e33': ('keyc/e33.png', 5, {}), 'e34': ('keyc/e34.png', 7, {}), 'k23': ('keyc/k23.png', 7, {}),
  'e35': ('keyc/e35.png', 5, {}), 'e36': ('keyc/e36.png', 5, {}), 'k24': ('keyc/k24.png', 5, {}),
  'e37': ('raw/e37-s11-0.png', 1, {}), 'e37b': ('raw/e37b-s11-0.png', 1, {}), 'k25': ('raw/k25-s11-0.png', 5, {}),
  'e38': ('keyc/e38.png', 5, {}), 'e39': ('keyc/e39.png', 7, {}), 'e39b': ('raw/e39b-s5-0.png', 1, {}), 'k26': ('raw/k26-s11-0.png', 5, {}),
  'e40': ('keyc/e40.png', 7, {}), 'e41': ('raw/e41-s11-0.png', 5, {'edgedark': True}), 'k27': ('raw/k27-s11-0.png', 5, {}),
  'e42': ('raw/e42-s11-0.png', 5, {}), 'k28': ('raw/k28-s11-0.png', 4, {'gray': True, 'skip': (4,)}),
  'c15': ('keyc/c15.png', 5, {}), 'c3': ('keyc/c3.png', 5, {}),
  'f16': ('raw/f16-s5-0.png', 5, {}), 'f17': ('keyc/f17.png', 7, {}), 'k38': ('keyc/k38.png', 7, {}),
  'f18': ('keyc/f18.png', 5, {'keep_box': True}), 'f19': ('keyc/f19.png', 7, {}), 'f19b': ('raw/f19b-s5-0.png', 1, {}), 'k39': ('keyc/k39.png', 7, {}),
  'f20': ('keyc/f20.png', 7, {}), 'f21': ('keyc/f21.png', 5, {}), 'k40': ('keyc/k40.png', 7, {}),
}

def clean(im, mn=3, gray=False):
    W, H = im.size; px = im.load()
    for y in range(H):
        for x in range(W):
            c = px[x, y]
            if c[3] < 128: px[x, y] = (0, 0, 0, 0); continue
            if gray and max(c[:3]) - min(c[:3]) < 22 and sum(c[:3]) / 3 < 150: px[x, y] = (0, 0, 0, 0)
    edge = [(x, y) for x in range(W) for y in (0, H - 1)] + [(x, y) for y in range(H) for x in (0, W - 1)]
    bgc = {px[p][:3] for p in edge if px[p][3] >= 128 and max(px[p][:3]) - min(px[p][:3]) < 12 and 70 < sum(px[p][:3]) / 3 < 200}
    near = lambda c: any(abs(c[0] - b[0]) + abs(c[1] - b[1]) + abs(c[2] - b[2]) <= 18 for b in bgc)
    st = [p for p in edge if px[p][3] and near(px[p])]; seen = set(st)
    while st:
        x, y = st.pop(); px[x, y] = (0, 0, 0, 0)
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            n = (x + dx, y + dy)
            if 0 <= n[0] < W and 0 <= n[1] < H and n not in seen and px[n][3] and near(px[n]): seen.add(n); st.append(n)
    seen = set()
    for y in range(H):
        for x in range(W):
            if px[x, y][3] and (x, y) not in seen:
                st = [(x, y)]; seen.add((x, y)); c = []
                while st:
                    a, b = st.pop(); c.append((a, b))
                    for dx in (-1, 0, 1):
                        for dy in (-1, 0, 1):
                            n = (a + dx, b + dy)
                            if 0 <= n[0] < W and 0 <= n[1] < H and n not in seen and px[n][3]: seen.add(n); st.append(n)
                if len(c) < mn:
                    for p in c: px[p] = (0, 0, 0, 0)
    return im

def edgedark(im):
    # 테두리에서부터 어두운(밝기 < 70) 픽셀을 따라 퍼지며 지운다 (어두운 배경판이 남은 키 그림)
    W, H = im.size; px = im.load()
    dark = lambda c: c[3] and sum(c[:3]) / 3 < 95
    st = [(x, y) for x in range(W) for y in (0, H - 1)] + [(x, y) for y in range(H) for x in (0, W - 1)]
    st = [p for p in st if dark(px[p])]; seen = set(st)
    while st:
        x, y = st.pop(); px[x, y] = (0, 0, 0, 0)
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            n = (x + dx, y + dy)
            if 0 <= n[0] < W and 0 <= n[1] < H and n not in seen and dark(px[n]): seen.add(n); st.append(n)
    return im

def build(id_):
    key, n, opt = BUILD[id_]
    k = Image.open(os.path.join(HERE, key)).convert('RGBA')
    pre = opt.get('anim', f'{id_}-anim-s7')
    anim = sorted(glob.glob(os.path.join(HERE, 'raw', pre + '-*.png')), key=lambda f: int(f.rsplit('-', 1)[1][:-4]))
    # 애니 결과의 0번 = 키 그림 그대로 (frame_count 4 → 5장, 6 → 7장)
    fr = [Image.open(f).convert('RGBA') for i, f in enumerate(anim) if i not in opt.get('skip', ())] or [k]
    tmp = len(fr) < n
    while len(fr) < n: fr.append(k.copy())
    fr = [f.resize(k.size, Image.NEAREST) if f.size != k.size else f for f in fr[:n]]
    fr = [clean(f, opt.get('min', 3), opt.get('gray', False)) for f in fr]
    if opt.get('edgedark'): fr = [edgedark(f) for f in fr]
    if 'rows' in opt or 'cols' in opt:
        y0, y1 = opt.get('rows', (0, k.height)); x0, x1 = opt.get('cols', (0, k.width))
        fr = [f.crop((x0, y0, x1, y1)) for f in fr]
    if not opt.get('keep_box'):
        box = None
        for f in fr:
            b = f.getbbox()
            if b: box = b if box is None else (min(box[0], b[0]), min(box[1], b[1]), max(box[2], b[2]), max(box[3], b[3]))
        if box: fr = [f.crop(box) for f in fr]
    if 'squash' in opt: fr = [f.resize(opt['squash'], Image.NEAREST) for f in fr]
    W, H = fr[0].size
    sh = Image.new('RGBA', (W * n, H), (0, 0, 0, 0))
    for i, f in enumerate(fr): sh.alpha_composite(f, (i * W, 0))
    sh.save(os.path.join(OUT, id_ + '.png'))
    print(f'{id_:5} {n} frames {W}x{H}{"  (임시: 애니 없음)" if tmp else ""}')

ids = sys.argv[1:] or list(BUILD)
for i in ids:
    try: build(i)
    except FileNotFoundError as e: print(i, 'missing', os.path.basename(str(e.filename)))
