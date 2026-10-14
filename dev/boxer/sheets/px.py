# 손 픽셀 편집 도구 (개발용, PixelLab 없이 시트 프레임을 고친다 — docs/specs/boxer-class.md "모션 수정")
#  frame(cls, anim, f) → RGBA 64×64 · grid(img, out, S) 좌표 격자 확대 · put(cls, anim, f, img) 시트에 되쓰기
import json, os
from PIL import Image, ImageDraw
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..')
SP = lambda c, e: os.path.join(ROOT, 'src', 'sprites', f'{c}.{e}')
OUTLINE = (11, 13, 20, 255)

def meta(c): return json.load(open(SP(c, 'json')))
def sheet(c): return Image.open(SP(c, 'png')).convert('RGBA')
def frame(c, a, f, im=None):
    m = meta(c); A = m['anims'][a]; im = im or sheet(c)
    return im.crop((f * 64, A['row'] * 64, f * 64 + 64, A['row'] * 64 + 64))

def grid(img, out, S=8, box=None):
    if box: img = img.crop(box)
    w, h = img.size; o = Image.new('RGBA', (w * S + 20, h * S + 20), (50, 52, 60, 255))
    o.alpha_composite(img.resize((w * S, h * S), Image.NEAREST), (20, 20)); d = ImageDraw.Draw(o)
    x0, y0 = (box[0], box[1]) if box else (0, 0)
    for i in range(0, w + 1):
        d.line((20 + i * S, 20, 20 + i * S, 20 + h * S), fill=(90, 90, 100) if (i + x0) % 4 else (150, 150, 170))
        if (i + x0) % 4 == 0 and i < w: d.text((20 + i * S + 1, 2), str(i + x0), fill=(255, 220, 120))
    for j in range(0, h + 1):
        d.line((20, 20 + j * S, 20 + w * S, 20 + j * S), fill=(90, 90, 100) if (j + y0) % 4 else (150, 150, 170))
        if (j + y0) % 4 == 0 and j < h: d.text((1, 20 + j * S + 1), str(j + y0), fill=(255, 220, 120))
    o.convert('RGB').save(out)

def palette(img):
    return sorted({p for p in img.getdata() if p[3] > 0}, key=lambda p: 0.3 * p[0] + 0.59 * p[1] + 0.11 * p[2])

def lum(p): return 0.3 * p[0] + 0.59 * p[1] + 0.11 * p[2]

def darker_map(pal):
    """색마다 같은 색 계열(색상이 가까운 것) 중 한 단 어두운 색. 없으면 0.75 배"""
    import colorsys
    out = {}
    hsv = {p: colorsys.rgb_to_hsv(p[0] / 255, p[1] / 255, p[2] / 255) for p in pal}
    for p in pal:
        if p == OUTLINE: out[p] = p; continue
        h, s, v = hsv[p]
        cands = [q for q in pal if q != OUTLINE and lum(p) - 70 < lum(q) < lum(p) - 6 and ((s >= 0.2 and hsv[q][1] >= 0.2 and (abs(hsv[q][0] - h) < 0.035 or abs(hsv[q][0] - h) > 0.965)) or (s < 0.2 and hsv[q][1] < 0.1))]
        out[p] = max(cands, key=lum) if cands else (int(p[0] * .75), int(p[1] * .75), int(p[2] * .78), 255)
    return out

def recolor(img, mask, mp):
    px = img.load()
    for (x, y) in mask:
        p = px[x, y]
        if p[3] and p in mp: px[x, y] = mp[p]

def region(img, test):
    """test(x, y, p) 가 참인 불투명 칸 목록"""
    px = img.load(); return [(x, y) for y in range(img.height) for x in range(img.width) if px[x, y][3] and test(x, y, px[x, y])]

def erase(img, pts):
    px = img.load()
    for (x, y) in pts: px[x, y] = (0, 0, 0, 0)

def paste(dst, src, box, at):
    """src 의 box 영역 불투명 칸을 dst 의 at 에 덮는다"""
    s = src.crop(box); dst.alpha_composite(s, at)

def outline(img):
    """바깥 테두리: 불투명 칸 바깥 1칸을 외곽선 색으로 (이미 있으면 그대로)"""
    px = img.load(); w, h = img.size; add = []
    for y in range(h):
        for x in range(w):
            if px[x, y][3]: continue
            if any(0 <= x + dx < w and 0 <= y + dy < h and px[x + dx, y + dy][3] and px[x + dx, y + dy] != OUTLINE for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                add.append((x, y))
    for (x, y) in add: px[x, y] = OUTLINE

def put(c, a, f, img, im=None):
    m = meta(c); A = m['anims'][a]; sh = im or sheet(c)
    sh.paste(Image.new('RGBA', (64, 64), (0, 0, 0, 0)), (f * 64, A['row'] * 64)); sh.alpha_composite(img, (f * 64, A['row'] * 64))
    return sh

def drop_specks(img, n=6):
    """n 칸 이하로 떨어진 작은 덩어리를 지운다"""
    px = img.load(); w, h = img.size; seen = set()
    for y in range(h):
        for x in range(w):
            if (x, y) in seen or not px[x, y][3]: continue
            st, comp = [(x, y)], []; seen.add((x, y))
            while st:
                a, b = st.pop(); comp.append((a, b))
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    q = (a + dx, b + dy)
                    if 0 <= q[0] < w and 0 <= q[1] < h and q not in seen and px[q][3]: seen.add(q); st.append(q)
            if len(comp) <= n:
                for q in comp: px[q] = (0, 0, 0, 0)

def clean_orphans(img):
    """다른 색과 닿지 않는 외곽선 덩어리(지운 팔의 테두리 찌꺼기)를 지운다"""
    px = img.load(); w, h = img.size
    changed = True
    while changed:
        changed = False
        for y in range(h):
            for x in range(w):
                if px[x, y] != OUTLINE: continue
                nb = [px[x + dx, y + dy] for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (-1, -1), (1, -1), (-1, 1)) if 0 <= x + dx < w and 0 <= y + dy < h]
                if not any(p[3] and p != OUTLINE for p in nb): px[x, y] = (0, 0, 0, 0); changed = True

def bbox_top(img):
    """머리 꼭대기 (y, 그 줄 가운데 x)"""
    px = img.load()
    for y in range(img.height):
        xs = [x for x in range(img.width) if px[x, y][3]]
        if xs: return y, (xs[0] + xs[-1]) // 2

def is_skin(p): return p[0] > 150 and p[1] > 80 and p[0] - p[2] > 50
def is_glove(p): return abs(p[0] - p[1]) < 18 and abs(p[1] - p[2]) < 22 and 60 < lum(p) < 200
def is_gold(p): return p[0] > 180 and p[1] > 140 and p[2] < 140
