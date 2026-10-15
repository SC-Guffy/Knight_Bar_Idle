# 덧그리기 각도 시험 (0회): 마네킹 지팡이만 손 점 둘레로 돌린 가짜 프레임을 만들어 7종을 입혀 본다 → mq/_angles.png
#  실제 원형 애니가 나오기 전에, 지팡이 각도가 바뀌어도 직업 지팡이가 손 점·방향을 따라가는지 본다 (팔 자세는 그대로라 어색한 것은 정상)
import os, sys, math
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE); sys.path.insert(0, os.path.join(HERE, '..', 'sheets-common'))
import mannequin as m
from wpn import WeaponSprite, rotsprite, grip_tip, diff_pts

M = Image.open(os.path.join(HERE, 'mq', 'staff.png')).convert('RGBA')
mp = m.classify(M)
mask = {p for p, (k, i) in mp.items() if k in m.STF}
glove = [p for p, (k, i) in mp.items() if k == 'hand' and any((p[0] + a, p[1] + b) in mask for a in (-1, 0, 1) for b in (-1, 0, 1))]
g, t = grip_tip(mask, glove)
# 마네킹 지팡이 그림 (외곽선 빼고)
st = Image.new('RGBA', M.size); S, MP = st.load(), M.load()
for p in mask: S[p] = MP[p]
bb = st.getbbox(); st = st.crop(bb); gp = (g[0] - bb[0], g[1] - bb[1])
base = math.degrees(math.atan2(t[1] - g[1], t[0] - g[0]))


def frame(deg):
    """마네킹 지팡이를 deg (화면 각도)로 돌린 프레임"""
    o = M.copy(); O = o.load()
    for p in mask: O[p] = (0, 0, 0, 0)
    rot, piv = rotsprite(st, deg - base, gp)
    x0, y0 = round(g[0] - piv[0]), round(g[1] - piv[1]); R = rot.load()
    for y in range(rot.height):
        for x in range(rot.width):
            if R[x, y][3] and 0 <= x0 + x < o.width and 0 <= y0 + y < o.height: O[x0 + x, y0 + y] = R[x, y]
    for p in glove: O[p] = MP[p]
    return o


ANG = [('raise', -150), ('base', base), ('aim', -10), ('down', 40)]
rows = []
for name, d in ANG:
    F = frame(d)
    rows.append([F] + [m.dress(c, F, head_img=m.electro_head() if c == 'electromancer' else None) for c in m.IDS])
W, H = 64, 62
out = Image.new('RGBA', (W * 4 * 8, H * 4 * len(rows)), (18, 20, 27, 255))
for r, ims in enumerate(rows):
    for i, im in enumerate(ims):
        out.alpha_composite(im.crop((14, 34, 78, 96)).resize((W * 4, H * 4), Image.NEAREST), (W * 4 * i, H * 4 * r))
out.save(os.path.join(HERE, 'mq', '_angles.png'))
print('angles', [(n, round(d)) for n, d in ANG])
