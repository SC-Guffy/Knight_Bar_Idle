# 관절 애니 계획 (로드맵 2026-10-17: 1단계 = 성기사 평타 1회 먼저) — PixelLab 0, 계획서·막대 인형만 만든다.
#  흐름: 기준 그림(design/pl2/fix-paladin.png, 40×48) → 64칸 캔버스(발 (28,60)) → edit-image-pixen 으로 "팔 내린 중립 대기·빈손·칼 없음" 1회
#        → 3배(192) 첫 프레임 + 관절 15프레임 animate-with-skeleton-v3 1회 → 3칸 최빈색으로 64칸 → 손목 좌표에 성검 덧그리기(wpn.py)
#  레인저 교훈: 첫 프레임이 무기를 겨눈 자세면 팔이 관절을 안 따른다(→ 중립 대기), 첫 프레임 뼈 길이로 그리면 팔이 짧아진다(→ 손 목표에서 역산 ik).
#  python -I -B anim_plan.py → anim/paladin-atk-stick.png (15프레임 막대 인형, 기준 그림을 흐리게 깔고), anim/paladin-atk-stick.gif, anim/paladin-atk.json (관절·칼 각도)
import os, json, math
from PIL import Image, ImageDraw
HERE = os.path.dirname(os.path.abspath(__file__)); OUT = os.path.join(HERE, 'anim')
N, K = 192, 3                                   # skeleton 캔버스, 64칸의 배율
UA, FA = 18, 18                                 # 위팔·아래팔 (192 기준)
HEAD = {'NOSE': (14, -20), 'RIGHT EYE': (10, -27), 'LEFT EYE': (1, -27), 'RIGHT EAR': (2, -24), 'LEFT EAR': (-8, -24)}   # 목 기준 (큰 투구)
Z = {'LEFT ARM': 1, 'LEFT ELBOW': 1, 'LEFT SHOULDER': 2, 'LEFT HIP': 3, 'LEFT KNEE': 3, 'LEFT LEG': 3, 'NECK': 5, 'RIGHT HIP': 6, 'RIGHT KNEE': 6,
     'RIGHT LEG': 6, 'NOSE': 8, 'RIGHT EYE': 8, 'LEFT EYE': 8, 'RIGHT EAR': 7, 'LEFT EAR': 7, 'RIGHT SHOULDER': 9, 'RIGHT ELBOW': 10, 'RIGHT ARM': 11}


def ik(sh, target, elbow_up=True):
    """2관절 역산 (dev/bowsheets/skelgen.py 와 같은 식): 어깨에서 손을 target 에 두는 팔꿈치·손 좌표"""
    dx, dy = target[0] - sh[0], target[1] - sh[1]; D = max(1e-6, min(math.hypot(dx, dy), UA + FA - 1e-3))
    base = math.atan2(dy, dx); a = math.acos(max(-1, min(1, (UA * UA + D * D - FA * FA) / (2 * UA * D))))
    a1 = base - a if elbow_up else base + a
    e = (sh[0] + UA * math.cos(a1), sh[1] + UA * math.sin(a1))
    return e, (sh[0] + D * math.cos(base), sh[1] + D * math.sin(base))


# 설계 좌표 → 실제 첫 프레임(anim/paladin64-idle.png, pixen 중립 + 정강이 3줄 뺌) 좌표 (64칸 실측: 투구 x 23~40·목 33줄·엉덩이 50줄·발 59줄, ×3)
DX, DY = 8, -4


def pose(neck, hand, front_foot=(98, 178), lean=0, crouch=0, elbow_up=True, reach=None):
    """neck: 목, hand: 칼 손 목표, front_foot: 앞발 (모두 설계 좌표), crouch: 무릎 굽힘(px). 방패 팔은 가슴 앞에 붙여 몸을 따른다"""
    nx, ny = neck[0] + DX, neck[1] + DY; hand = (hand[0] + DX, hand[1] + DY); p = {'NECK': (nx, ny)}
    p['RIGHT SHOULDER'] = (nx + 15, ny + 6); p['LEFT SHOULDER'] = (nx - 14, ny + 6)
    if reach:                                   # 휘두름·타격: 손 방향은 두고 팔을 reach 배로 뻗음 (팔꿈치 접힘 방지)
        sh = p['RIGHT SHOULDER']; a = math.atan2(hand[1] - sh[1], hand[0] - sh[0])
        hand = (sh[0] + math.cos(a) * (UA + FA) * reach, sh[1] + math.sin(a) * (UA + FA) * reach)
    p['RIGHT ELBOW'], p['RIGHT ARM'] = ik(p['RIGHT SHOULDER'], hand, elbow_up)
    p['LEFT ELBOW'] = (nx - 14, ny + 20); p['LEFT ARM'] = (nx - 7, ny + 30)
    hy = 150 + crouch // 2; hx = nx - lean
    p['RIGHT HIP'] = (hx + 5, hy); p['LEFT HIP'] = (hx - 7, hy)
    ff = (front_foot[0] + 10, 177); bf = (84, 177)
    p['RIGHT KNEE'] = ((p['RIGHT HIP'][0] + ff[0]) / 2 + 3 + crouch // 3, (hy + 177) / 2); p['RIGHT LEG'] = ff
    p['LEFT KNEE'] = ((p['LEFT HIP'][0] + bf[0]) / 2 - 2 - crouch // 4, (hy + 177) / 2); p['LEFT LEG'] = bf
    for k, (dx, dy) in HEAD.items(): p[k] = (nx + dx, ny + dy)
    return p


V2 = os.environ.get('ANIM_V') == '2'
# 2차 (로드맵 A 승인): 192칸에 캐릭터 2배(키 약 98, 통과한 마법사·레인저는 키 92) + 몸 이동 2배. 설계 좌표 p → 192: (p + (DX, DY)) * 2/3 + OFF
SC, OFF, N0 = 2 / 3, (32, 62), (88, 104)


def T(p):
    return ((p[0] + DX) * SC + OFF[0], (p[1] + DY) * SC + OFF[1])


def pose2(neck, hand, front_foot=(98, 178), lean=0, crouch=0, elbow_up=True, reach=None):
    nb = T(N0); nx, ny = nb[0] + (neck[0] - N0[0]) * SC * 2, nb[1] + (neck[1] - N0[1]) * SC * 2
    hx_, hy_ = nx + (hand[0] - neck[0]) * SC, ny + (hand[1] - neck[1]) * SC
    p = {'NECK': (nx, ny)}
    p['RIGHT SHOULDER'] = (nx + 10, ny + 4); p['LEFT SHOULDER'] = (nx - 9, ny + 4)
    h = (hx_, hy_); sh = p['RIGHT SHOULDER']; L = (UA + FA) * SC
    if reach:
        a = math.atan2(h[1] - sh[1], h[0] - sh[0]); h = (sh[0] + math.cos(a) * L * reach, sh[1] + math.sin(a) * L * reach)
    dx, dy = h[0] - sh[0], h[1] - sh[1]; D_ = max(1e-6, min(math.hypot(dx, dy), L - 1e-3)); base = math.atan2(dy, dx); l = L / 2
    a = math.acos(max(-1, min(1, D_ / (2 * l)))); a1 = base - a if elbow_up else base + a
    p['RIGHT ELBOW'] = (sh[0] + l * math.cos(a1), sh[1] + l * math.sin(a1)); p['RIGHT ARM'] = (sh[0] + D_ * math.cos(base), sh[1] + D_ * math.sin(base))
    p['LEFT ELBOW'] = (nx - 9, ny + 13); p['LEFT ARM'] = (nx - 5, ny + 20)          # 방패 손: 가슴 앞 고정 (몸만 따라감)
    hy = 162 + crouch * SC; hx = nx - lean * SC * 2
    p['RIGHT HIP'] = (hx + 3, hy); p['LEFT HIP'] = (hx - 5, hy)
    ff = (104 + (front_foot[0] - 98) * SC * 2, 180); bf = (88, 180)
    p['RIGHT KNEE'] = ((p['RIGHT HIP'][0] + ff[0]) / 2 + 2 + crouch * SC * 2 / 3, (hy + 180) / 2); p['RIGHT LEG'] = ff
    p['LEFT KNEE'] = ((p['LEFT HIP'][0] + bf[0]) / 2 - 1 - crouch * SC / 2, (hy + 180) / 2); p['LEFT LEG'] = bf
    for k, (dx2, dy2) in HEAD.items(): p[k] = (nx + dx2 * SC, ny + dy2 * SC)
    return p


P_ = pose2 if V2 else pose


BASE = P_((88, 104), (119, 145), elbow_up=False)                     # 중립 대기 (pixen 편집 목표 자세, 첫 프레임 관절)
# 3등신이라 팔(31px)이 머리 위로 못 넘어간다 → 들어올림은 손을 머리 옆·뒤 어깨 높이에 두고 칼날이 위·뒤로 솟게 (치비식)
# 성기사 평타 = 크게 젖혀 내려베기 15프레임 (손 목표, 칼 각도 도: 0 = 앞, -90 = 위)
SEQ = [
    ('준비', P_((88, 104), (114, 138), elbow_up=False), -40),
    ('웅크림', P_((86, 108), (100, 116), crouch=6), -110),
    ('들어올림', P_((84, 110), (90, 106), crouch=8), -125),
    ('머리 뒤로', P_((82, 110), (70, 108), crouch=8), -140),
    ('버팀', P_((82, 109), (69, 107), crouch=8), -145),
    ('앞발 디딤', P_((90, 104), (86, 98), front_foot=(110, 178)), -105),
    ('휘두름 시작', P_((96, 106), (110, 98), front_foot=(114, 178), lean=-4), -60),
    ('휘두름', P_((100, 110), (124, 106), front_foot=(116, 178), lean=-6, crouch=4, elbow_up=False, reach=0.95), 0),
    ('타격', P_((103, 115), (128, 124), front_foot=(116, 178), lean=-8, crouch=10, elbow_up=False, reach=0.95), 35),
    ('끝까지', P_((103, 117), (124, 138), front_foot=(116, 178), lean=-8, crouch=12, elbow_up=False, reach=0.95), 62),
    ('멈춤', P_((103, 117), (124, 139), front_foot=(116, 178), lean=-8, crouch=12, elbow_up=False, reach=0.95), 64),
    ('회수 1', P_((98, 112), (118, 136), front_foot=(110, 178), lean=-4, crouch=6, elbow_up=False, reach=0.95), 40),
    ('회수 2', P_((94, 108), (112, 136), front_foot=(104, 178), crouch=2, elbow_up=False), 10),
    ('가라앉음', P_((90, 105), (106, 134), front_foot=(100, 178), elbow_up=False), -25),
    ('준비', P_((88, 104), (114, 138), elbow_up=False), -40),
]
BONES = [('NECK', 'RIGHT SHOULDER'), ('RIGHT SHOULDER', 'RIGHT ELBOW'), ('RIGHT ELBOW', 'RIGHT ARM'), ('NECK', 'LEFT SHOULDER'),
         ('LEFT SHOULDER', 'LEFT ELBOW'), ('LEFT ELBOW', 'LEFT ARM'), ('NECK', 'RIGHT HIP'), ('RIGHT HIP', 'RIGHT KNEE'),
         ('RIGHT KNEE', 'RIGHT LEG'), ('NECK', 'LEFT HIP'), ('LEFT HIP', 'LEFT KNEE'), ('LEFT KNEE', 'LEFT LEG')]


def ref192():
    if V2:
        c = Image.new('RGBA', (N, N)); c.alpha_composite(Image.open(os.path.join(OUT, 'paladin64-idle.png')).convert('RGBA').resize((128, 128), Image.NEAREST), OFF); return c
    return Image.open(os.path.join(OUT, 'paladin64-idle.png')).convert('RGBA').resize((N, N), Image.NEAREST)


def stick(p, ang, under=None, S=2):
    im = Image.new('RGBA', (N * S, N * S), (20, 22, 30, 255))
    if under is not None:
        u = under.resize((N * S, N * S), Image.NEAREST); u.putalpha(u.split()[3].point(lambda a: a // 4)); im.alpha_composite(u)
    d = ImageDraw.Draw(im)
    col = lambda a, b: (255, 120, 90) if 'RIGHT' in a + b else (90, 170, 255) if 'LEFT' in a + b else (230, 230, 230)
    for a, b in BONES: d.line([(p[a][0] * S, p[a][1] * S), (p[b][0] * S, p[b][1] * S)], fill=col(a, b), width=S + 1)
    r = 22 * (SC if V2 else 1); hx, hy = p['NECK'][0] + 3 * r / 22, p['NECK'][1] - r
    d.ellipse([(hx - r) * S, (hy - r - 2) * S, (hx + r) * S, (hy + r) * S], outline=(230, 230, 230), width=S)    # 큰 투구 (3등신)
    g = p['RIGHT ARM']; a = math.radians(ang)
    d.line([(g[0] * S, g[1] * S), ((g[0] + 40 * (SC if V2 else 1) * math.cos(a)) * S, (g[1] + 40 * (SC if V2 else 1) * math.sin(a)) * S)], fill=(255, 215, 80), width=S + 1)
    d.line([(40 * S, 178 * S), (160 * S, 178 * S)], fill=(80, 80, 100), width=1)
    return im.crop((40 * S, 20 * S, 186 * S, 186 * S))


def kp(p):
    return [{'x': round(x / N, 4), 'y': round(y / N, 4), 'label': k, 'z_index': Z.get(k, 5)} for k, (x, y) in p.items()]


if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True); tag = '2' if V2 else ''
    ref = ref192(); ref.save(os.path.join(OUT, f'paladin192-ref{tag}.png'))
    tiles = [stick(BASE, -40, ref)] + [stick(p, a) for _, p, a in SEQ]
    W, H = tiles[0].size; cols = 8; rows = (len(tiles) + cols - 1) // cols
    mont = Image.new('RGBA', ((W + 6) * cols, (H + 6) * rows), (40, 42, 52, 255))
    for i, t in enumerate(tiles): mont.paste(t, ((i % cols) * (W + 6), (i // cols) * (H + 6)))
    mont.save(os.path.join(OUT, f'paladin-atk{tag}-stick.png'))
    fr = [t.convert('RGB') for t in tiles[1:]]
    fr[0].save(os.path.join(OUT, f'paladin-atk{tag}-stick.gif'), save_all=True, append_images=fr[1:], duration=70, loop=0)
    json.dump({'base': kp(BASE), 'frames': [kp(p) for _, p, _ in SEQ], 'angles': [a for _, _, a in SEQ], 'names': [n for n, _, _ in SEQ]},
              open(os.path.join(OUT, f'paladin-atk{tag}.json'), 'w', encoding='utf-8'), ensure_ascii=False)
    print('frames', len(SEQ), 'montage', mont.size)
