# 스켈레톤 애니 시험 (로드맵 승인 A): 성기사 내려베기 8프레임 관절 — 조립식 리그를 베끼지 않고 크게 과장해 손으로 설계.
#  192칸 (96칸 캡처를 2배), 발 = (96, 176). 얼굴은 오른쪽(east). RIGHT = 칼 든 앞팔(몸 앞, z 위), LEFT = 방패 든 뒷팔.
#  python -I -B skel.py  → skel/req-A.json (animate-with-skeleton-v3 본문), skel/stick-*.png 막대 인형, skel/paladin192-nowpn.png
import os, sys, json, base64, io
from PIL import Image, ImageDraw
HERE = os.path.dirname(os.path.abspath(__file__))
SK = os.path.join(HERE, 'skel')
N = 192

# 기준 자세 (전투 대기 그림에서 읽음)
BASE = {
    'NECK': (97.5, 134), 'RIGHT SHOULDER': (108.8, 139), 'RIGHT ELBOW': (112.5, 146), 'RIGHT ARM': (117.5, 151),
    'LEFT SHOULDER': (87.5, 139), 'LEFT ELBOW': (85, 142.5), 'LEFT ARM': (82.5, 146),
    'RIGHT HIP': (103.8, 159), 'RIGHT KNEE': (106, 166), 'RIGHT LEG': (106, 173),
    'LEFT HIP': (91.3, 159), 'LEFT KNEE': (90, 166), 'LEFT LEG': (87.5, 173),
}
HEAD = {'NOSE': (8.5, -5), 'RIGHT EYE': (6.5, -8), 'LEFT EYE': (-2.5, -8), 'RIGHT EAR': (0.5, -10), 'LEFT EAR': (-5.5, -10)}   # 목 기준
Z = {'LEFT ARM': 1, 'LEFT ELBOW': 1, 'LEFT SHOULDER': 2, 'LEFT HIP': 3, 'LEFT KNEE': 3, 'LEFT LEG': 3, 'NECK': 5, 'RIGHT HIP': 6, 'RIGHT KNEE': 6,
     'RIGHT LEG': 6, 'NOSE': 8, 'RIGHT EYE': 8, 'LEFT EYE': 8, 'RIGHT EAR': 7, 'LEFT EAR': 7, 'RIGHT SHOULDER': 9, 'RIGHT ELBOW': 10, 'RIGHT ARM': 11}


def pose(**o):
    """BASE 를 바꾼 자세. 키는 관절 이름에서 공백을 _ 로 (RIGHT_ARM=(x, y)). neck 을 옮기면 머리 관절이 같이 간다"""
    p = dict(BASE)
    for k, v in o.items(): p[k.replace('_', ' ')] = v
    nx, ny = p['NECK']
    for k, (dx, dy) in HEAD.items(): p[k] = (nx + dx, ny + dy)
    return p


# 8프레임 (칼 각도: 덧그리기용, 도, 0 = 앞, -90 = 위)
FRAMES = [
    # 1 웅크리며 뒤로 젖힘: 무릎 굽힘, 상체 뒤로, 칼손이 어깨 위로
    (pose(NECK=(95, 136), RIGHT_SHOULDER=(105, 141), RIGHT_ELBOW=(104, 131), RIGHT_ARM=(100, 123),
          LEFT_SHOULDER=(86, 141), LEFT_ARM=(86, 148), RIGHT_HIP=(102, 161), RIGHT_KNEE=(108, 167), LEFT_HIP=(90, 161), LEFT_KNEE=(88, 168)), -115),
    # 2 크게 젖혀 들기: 칼손이 머리 뒤, 상체 비틀어 뒤로, 앞발 들기
    (pose(NECK=(92, 135), RIGHT_SHOULDER=(100, 139), RIGHT_ELBOW=(94, 124), RIGHT_ARM=(86, 118),
          LEFT_SHOULDER=(84, 140), LEFT_ELBOW=(88, 146), LEFT_ARM=(94, 148),
          RIGHT_HIP=(101, 159), RIGHT_KNEE=(110, 162), RIGHT_LEG=(112, 169), LEFT_HIP=(90, 159), LEFT_KNEE=(88, 166), LEFT_LEG=(86, 173)), 160),
    # 3 앞발 디딤 + 머리 위로: 칼손 머리 위, 상체 곧게
    (pose(NECK=(100, 135), RIGHT_SHOULDER=(109, 139), RIGHT_ELBOW=(111, 124), RIGHT_ARM=(106, 112),
          LEFT_SHOULDER=(90, 140), LEFT_ELBOW=(92, 146), LEFT_ARM=(97, 149),
          RIGHT_HIP=(106, 159), RIGHT_KNEE=(116, 165), RIGHT_LEG=(120, 173), LEFT_HIP=(93, 159), LEFT_KNEE=(88, 166), LEFT_LEG=(84, 173)), -100),
    # 4 앞으로 휘두름: 상체 앞으로, 팔이 앞·위로 뻗음
    (pose(NECK=(106, 137), RIGHT_SHOULDER=(114, 141), RIGHT_ELBOW=(124, 133), RIGHT_ARM=(133, 127),
          LEFT_SHOULDER=(95, 142), LEFT_ELBOW=(93, 149), LEFT_ARM=(96, 154),
          RIGHT_HIP=(108, 160), RIGHT_KNEE=(118, 166), RIGHT_LEG=(122, 173), LEFT_HIP=(95, 160), LEFT_KNEE=(88, 167), LEFT_LEG=(82, 173)), -35),
    # 5 내려침: 상체 크게 숙임, 팔이 앞·아래로, 뒷다리 뻗음
    (pose(NECK=(111, 142), RIGHT_SHOULDER=(118, 146), RIGHT_ELBOW=(128, 150), RIGHT_ARM=(136, 156),
          LEFT_SHOULDER=(100, 146), LEFT_ELBOW=(98, 153), LEFT_ARM=(101, 158),
          RIGHT_HIP=(108, 162), RIGHT_KNEE=(120, 167), RIGHT_LEG=(123, 173), LEFT_HIP=(96, 162), LEFT_KNEE=(88, 168), LEFT_LEG=(80, 173)), 25),
    # 6 끝까지: 칼손이 앞무릎 아래로
    (pose(NECK=(110, 143), RIGHT_SHOULDER=(117, 147), RIGHT_ELBOW=(124, 155), RIGHT_ARM=(129, 163),
          LEFT_SHOULDER=(99, 147), LEFT_ELBOW=(97, 154), LEFT_ARM=(100, 159),
          RIGHT_HIP=(108, 162), RIGHT_KNEE=(120, 167), RIGHT_LEG=(123, 173), LEFT_HIP=(96, 162), LEFT_KNEE=(88, 168), LEFT_LEG=(80, 173)), 55),
    # 7 회수: 상체 세우며 칼손을 허리로
    (pose(NECK=(103, 137), RIGHT_SHOULDER=(112, 141), RIGHT_ELBOW=(117, 149), RIGHT_ARM=(122, 153),
          LEFT_SHOULDER=(92, 141), LEFT_ELBOW=(89, 146), LEFT_ARM=(89, 150),
          RIGHT_HIP=(106, 160), RIGHT_KNEE=(113, 166), RIGHT_LEG=(116, 173), LEFT_HIP=(93, 160), LEFT_KNEE=(89, 166), LEFT_LEG=(86, 173)), 15),
    # 8 가드로
    (pose(RIGHT_KNEE=(108, 166), RIGHT_LEG=(110, 173)), -55),
]


def kp(p):
    return [{'x': round(x / N, 4), 'y': round(y / N, 4), 'label': k, 'z_index': Z.get(k, 5)} for k, (x, y) in p.items()]


BONES = [('NECK', 'RIGHT SHOULDER'), ('RIGHT SHOULDER', 'RIGHT ELBOW'), ('RIGHT ELBOW', 'RIGHT ARM'), ('NECK', 'LEFT SHOULDER'),
         ('LEFT SHOULDER', 'LEFT ELBOW'), ('LEFT ELBOW', 'LEFT ARM'), ('NECK', 'RIGHT HIP'), ('RIGHT HIP', 'RIGHT KNEE'),
         ('RIGHT KNEE', 'RIGHT LEG'), ('NECK', 'LEFT HIP'), ('LEFT HIP', 'LEFT KNEE'), ('LEFT KNEE', 'LEFT LEG'), ('NECK', 'NOSE')]


def stick(p, ang=None, under=None, S=3):
    im = Image.new('RGBA', (N * S, N * S), (20, 22, 30, 255))
    if under is not None:
        u = under.resize((N * S, N * S), Image.NEAREST).copy(); u.putalpha(u.split()[3].point(lambda a: a // 3)); im.alpha_composite(u)
    d = ImageDraw.Draw(im)
    col = lambda a, b: (255, 120, 90) if 'RIGHT' in a + b else (90, 170, 255) if 'LEFT' in a + b else (230, 230, 230)
    for a, b in BONES:
        d.line([(p[a][0] * S, p[a][1] * S), (p[b][0] * S, p[b][1] * S)], fill=col(a, b), width=S + 1)
    hx, hy = p['NECK'][0] + 2, p['NECK'][1] - 9
    d.ellipse([(hx - 8) * S, (hy - 8) * S, (hx + 8) * S, (hy + 8) * S], outline=(230, 230, 230), width=S)
    if ang is not None:
        import math
        g = p['RIGHT ARM']; a = math.radians(ang)
        d.line([(g[0] * S, g[1] * S), ((g[0] + 30 * math.cos(a)) * S, (g[1] + 30 * math.sin(a)) * S)], fill=(255, 215, 80), width=S)
    d.line([(60 * S, 176 * S), (140 * S, 176 * S)], fill=(80, 80, 100), width=1)
    return im.crop((60 * S, 92 * S, 150 * S, 180 * S))


def b64(im):
    buf = io.BytesIO(); im.save(buf, 'PNG'); return {'type': 'base64', 'base64': base64.b64encode(buf.getvalue()).decode(), 'format': 'png'}


if __name__ == '__main__':
    os.makedirs(SK, exist_ok=True)
    base = Image.open(os.path.join(SK, 'paladin192.png')).convert('RGBA')
    # 칼 지운 기준 그림 (A: 손은 비우고 칼은 덧그린다) — 96칸 무기만 캡처로 지우고 2배
    g96 = Image.open(os.path.join(HERE, 'ref', 'paladin-guard.png')).convert('RGBA'); w96 = Image.open(os.path.join(HERE, 'ref', 'paladin-wpn.png')).convert('RGBA')
    b96 = Image.open(os.path.join(HERE, 'ref', 'paladin-body.png')).convert('RGBA')
    G, Wp, B = g96.load(), w96.load(), b96.load()
    for y in range(96):
        for x in range(96):
            if Wp[x, y][3] and not B[x, y][3]: G[x, y] = (0, 0, 0, 0)
    nowpn = g96.resize((N, N), Image.NEAREST); nowpn.save(os.path.join(SK, 'paladin192-nowpn.png'))
    tiles = [stick(BASE and pose(), -55, base)] + [stick(p, a) for p, a in FRAMES]
    for i, t in enumerate(tiles): t.save(os.path.join(SK, f'stick-{i}.png'))
    W_, H_ = tiles[0].size; mont = Image.new('RGBA', ((W_ + 6) * len(tiles), H_), (40, 42, 52, 255))
    for i, t in enumerate(tiles): mont.paste(t, (i * (W_ + 6), 0))
    mont.save(os.path.join(SK, 'stick-all.png'))
    body = {'description': 'small chibi holy paladin knight in cream and gold plate armor, golden halo above the crested helmet, gold cross shield on the left arm, right hand empty',
            'action': 'overhead attack', 'direction': 'east', 'view': 'side', 'first_frame': b64(nowpn),
            'first_frame_keypoints': kp(pose()), 'keypoints': [kp(p) for p, _ in FRAMES], 'template_id': 'mannequin', 'seed': 61, 'no_background': True}
    json.dump(body, open(os.path.join(SK, 'req-A.json'), 'w'), ensure_ascii=False)
    json.dump([a for _, a in FRAMES], open(os.path.join(SK, 'angles-A.json'), 'w'))
    print('frames', len(FRAMES), 'stick', mont.size)
