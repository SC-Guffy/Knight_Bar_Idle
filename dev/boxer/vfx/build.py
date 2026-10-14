# 생성 프레임 → 게임 시트 src/vfx/<id>.png + manifest.json 갱신
#  python -I build.py <id> <fw> <h> [--anchor b] [--flip] [--min 3] [--levels] [--dedark] [--fit] [--note "..."] f0.png f1.png ...
#  - 알파 0/255, 테두리 배경판·작은 덩어리 지우기
#  - 밝기 0.2 미만 = 외곽선: 투명칸에 닿은 것만 #0b0d14, 안쪽 어두운 점은 가장 어두운 몸톤으로 올림
#  - 모든 프레임의 합집합 상자를 기준으로 fw×h 창을 잘라 냄 (anchor c = 가운데, b = 바닥 맞춤). 내용이 더 크면 --fit 이면 프레임을 내용 크기로 키움
#  - --levels: 밝기 늘이기 (가장 밝은 2% → 흰색)
import sys, os, json
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
a = sys.argv[1:]
sid, fw, fh = a.pop(0), int(a.pop(0)), int(a.pop(0))
def opt(k, d=None, flag=False):
    if k not in a: return d
    i = a.index(k)
    if flag: del a[i]; return True
    v = a[i + 1]; del a[i:i + 2]; return v
anchor = opt('--anchor', 'c'); flip = opt('--flip', False, True); mn = int(opt('--min', 3)); levels = opt('--levels', False, True)
dedark = opt('--dedark', False, True); fit = opt('--fit', False, True); note = opt('--note', ''); shift = opt('--shift', '0,0')
sx, sy = map(int, shift.split(','))
files = a
L = lambda c: (0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2]) / 255
N4 = ((1, 0), (-1, 0), (0, 1), (0, -1))

def clean(im):
    W, H = im.size; px = im.load()
    for y in range(H):
        for x in range(W):
            px[x, y] = (0, 0, 0, 0) if px[x, y][3] < 128 else px[x, y][:3] + (255,)
    edge = [(x, y) for x in range(W) for y in (0, H - 1)] + [(x, y) for y in range(H) for x in (0, W - 1)]
    bgc = {px[p][:3] for p in edge if px[p][3] and max(px[p][:3]) - min(px[p][:3]) < 12 and 70 < sum(px[p][:3]) / 3 < 200}
    near = lambda c: any(abs(c[0] - b[0]) + abs(c[1] - b[1]) + abs(c[2] - b[2]) <= 18 for b in bgc)
    st = [p for p in edge if px[p][3] and near(px[p])]; seen = set(st)
    while st:
        x, y = st.pop(); px[x, y] = (0, 0, 0, 0)
        for dx, dy in N4:
            n = (x + dx, y + dy)
            if 0 <= n[0] < W and 0 <= n[1] < H and n not in seen and px[n][3] and near(px[n]): seen.add(n); st.append(n)
    if dedark:
        rm = [(x, y) for y in range(H) for x in range(W) if px[x, y][3] and L(px[x, y]) < 0.35 and not any(
            0 <= x + dx < W and 0 <= y + dy < H and px[x + dx, y + dy][3] and L(px[x + dx, y + dy]) > 0.55 for dx in range(-2, 3) for dy in range(-2, 3))]
        for q in rm: px[q] = (0, 0, 0, 0)
    seen = set()
    for y in range(H):
        for x in range(W):
            if px[x, y][3] and (x, y) not in seen:
                st = [(x, y)]; seen.add((x, y)); c = []
                while st:
                    p, q = st.pop(); c.append((p, q))
                    for dx in (-1, 0, 1):
                        for dy in (-1, 0, 1):
                            n = (p + dx, q + dy)
                            if 0 <= n[0] < W and 0 <= n[1] < H and n not in seen and px[n][3]: seen.add(n); st.append(n)
                if len(c) < mn or all(L(px[p]) < 0.2 for p in c):
                    for p in c: px[p] = (0, 0, 0, 0)
    return im

def finish(im):
    W, H = im.size; px = im.load()
    if levels:
        ls = sorted(L(px[x, y]) for y in range(H) for x in range(W) if px[x, y][3] and L(px[x, y]) >= 0.2)
        if ls:
            hi = ls[int(len(ls) * 0.98) - 1 if len(ls) > 50 else -1]
            k = 1 / max(hi, 0.3)
            for y in range(H):
                for x in range(W):
                    c = px[x, y]
                    if c[3] and L(c) >= 0.2: px[x, y] = tuple(min(255, int(v * k)) for v in c[:3]) + (255,)
    out = []
    for y in range(H):
        for x in range(W):
            c = px[x, y]
            if c[3] and L(c) < 0.2:
                edge = any(not (0 <= x + dx < W and 0 <= y + dy < H) or not px[x + dx, y + dy][3] for dx, dy in N4)
                out.append(((x, y), (11, 13, 20, 255) if edge else (78, 78, 88, 255)))
    for p, c in out: px[p] = c
    return im

fr = [clean(Image.open(f).convert('RGBA')) for f in files]
if flip: fr = [f.transpose(Image.FLIP_LEFT_RIGHT) for f in fr]
boxes = [f.getbbox() for f in fr if f.getbbox()]
x0 = min(b[0] for b in boxes); y0 = min(b[1] for b in boxes); x1 = max(b[2] for b in boxes); y1 = max(b[3] for b in boxes)
bw, bh = x1 - x0, y1 - y0
if fit: fw, fh = max(fw, bw), max(fh, bh)
if bw > fw or bh > fh: print(f'WARN content {bw}x{bh} > frame {fw}x{fh} (cropped)')
cx = x0 + bw // 2 - fw // 2 - sx
cy = (y1 - fh if anchor == 'b' else y0 + bh // 2 - fh // 2) - sy
sheet = Image.new('RGBA', (fw * len(fr), fh), (0, 0, 0, 0))
for i, f in enumerate(fr):
    sheet.alpha_composite(f.crop((cx, cy, cx + fw, cy + fh)), (i * fw, 0))
sheet = finish(sheet)
dst = os.path.join(ROOT, 'src', 'vfx', sid + '.png'); sheet.save(dst)
mp = os.path.join(HERE, 'manifest.json')
man = json.load(open(mp, encoding='utf-8')) if os.path.exists(mp) else []
man = [m for m in man if m['id'] != sid]
man.append({'id': sid, 'frames': len(fr), 'fw': fw, 'h': fh, 'anchor': anchor, 'note': note})
order = lambda m: ({'xw': 0, 'xh': 1, 'xp': 2, 'xe': 3, 'xk': 4, 'xf': 5}.get(m['id'][:2], 9), m['id'])
man.sort(key=order)
json.dump(man, open(mp, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print('sheet', dst, len(fr), 'x', fw, fh, 'content', bw, bh)
# 게임 메타(src/vfx/xmeta.js) 갱신 — 조정 세션 지시
import subprocess
subprocess.run(['node', os.path.join(ROOT, 'dev', 'boxer', 'vfx-meta.js')], cwd=ROOT)
