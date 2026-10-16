# 창기사 계열 관절 지정 애니(animate-with-skeleton-v3) 동작 설계 — 0회 준비 (docs/specs/legacy-class-sheets.md 2026-10-16 방향 전환).
#  형식은 검사 세션 dev/sheets-sword/skel.py 와 같다: 192칸, 발 = (96, 176), 얼굴은 오른쪽(east), 관절 18개 이름·z_index 동일.
#  창은 두 손으로 쥔다: RIGHT ARM = 앞손(몸 앞, z 위), LEFT ARM = 뒷손. 창 각도는 뒷손 → 앞손 방향(덧그리기용, 도, 0 = 앞, −90 = 위),
#  한 손으로 세워 든 자세(대기·걷기·머리 위)는 각도를 직접 적는다.
#  지금 리그를 베끼지 않고 크게 과장했다: 웅크림(무릎·엉덩이 내림) → 젖힘 → 디딤(앞발 크게) → 상체 숙여 뻗기 → 회수.
#  python -I -B skel.py  → skel/<동작>.json (프레임별 keypoints·창 각도), skel/stick-<동작>.png 막대 인형 몽타주, skel/stick-<동작>.gif
import os, sys, json, math
from PIL import Image, ImageDraw
HERE = os.path.dirname(os.path.abspath(__file__))
SK = os.path.join(HERE, 'skel')
N = 192
FOOT = (96, 176)

# 전투 대기 (창을 앞으로 겨눔, 넓은 자세). 창 계열 디자인이 나오면 그 그림에서 다시 읽어 맞춘다
BASE = {
    'NECK': (96, 134), 'RIGHT SHOULDER': (104, 139), 'RIGHT ELBOW': (110, 145), 'RIGHT ARM': (115, 146),
    'LEFT SHOULDER': (88, 139), 'LEFT ELBOW': (92, 147), 'LEFT ARM': (99, 151),
    'RIGHT HIP': (101, 159), 'RIGHT KNEE': (107, 166), 'RIGHT LEG': (111, 173),
    'LEFT HIP': (90, 159), 'LEFT KNEE': (88, 166), 'LEFT LEG': (83, 173),
}
HEAD = {'NOSE': (8.5, -5), 'RIGHT EYE': (6.5, -8), 'LEFT EYE': (-2.5, -8), 'RIGHT EAR': (0.5, -10), 'LEFT EAR': (-5.5, -10)}   # 목 기준 (검사와 같음)
Z = {'LEFT ARM': 1, 'LEFT ELBOW': 1, 'LEFT SHOULDER': 2, 'LEFT HIP': 3, 'LEFT KNEE': 3, 'LEFT LEG': 3, 'NECK': 5, 'RIGHT HIP': 6, 'RIGHT KNEE': 6,
     'RIGHT LEG': 6, 'NOSE': 8, 'RIGHT EYE': 8, 'LEFT EYE': 8, 'RIGHT EAR': 7, 'LEFT EAR': 7, 'RIGHT SHOULDER': 9, 'RIGHT ELBOW': 10, 'RIGHT ARM': 11}
BONES = [('NECK', 'RIGHT SHOULDER'), ('RIGHT SHOULDER', 'RIGHT ELBOW'), ('RIGHT ELBOW', 'RIGHT ARM'), ('NECK', 'LEFT SHOULDER'),
         ('LEFT SHOULDER', 'LEFT ELBOW'), ('LEFT ELBOW', 'LEFT ARM'), ('NECK', 'RIGHT HIP'), ('RIGHT HIP', 'RIGHT KNEE'),
         ('RIGHT KNEE', 'RIGHT LEG'), ('NECK', 'LEFT HIP'), ('LEFT HIP', 'LEFT KNEE'), ('LEFT KNEE', 'LEFT LEG'), ('NECK', 'NOSE')]


def pose(base=None, **o):
    """base(기본 BASE)를 바꾼 자세. 키는 관절 이름의 공백을 _ 로. NECK 을 옮기면 머리 관절이 같이 간다.
    dx·dy 를 주면 바꾸지 않은 관절까지 몸 전체를 옮긴다 (발 관절은 빼고 — 발은 땅에 붙어 있다)"""
    p = dict(base or BASE)
    dx, dy = o.pop('dx', 0), o.pop('dy', 0)
    if dx or dy:
        for k in p:
            if not k.endswith('LEG'): p[k] = (p[k][0] + dx, p[k][1] + dy)
    for k, v in o.items(): p[k.replace('_', ' ')] = v
    nx, ny = p['NECK']
    for k, (hx, hy) in HEAD.items(): p[k] = (nx + hx, ny + hy)
    return p


def spear_ang(p):
    """두 손으로 쥔 창 각도 = 뒷손 → 앞손"""
    a, b = p['LEFT ARM'], p['RIGHT ARM']
    return round(math.degrees(math.atan2(b[1] - a[1], b[0] - a[0])))


# 대기용 기본 자세: 창을 앞손으로 세워 든다 (발 모으고 선 자세)
STAND = pose(NECK=(95, 134), RIGHT_SHOULDER=(102, 139), RIGHT_ELBOW=(106, 146), RIGHT_ARM=(108, 151),
             LEFT_SHOULDER=(87, 139), LEFT_ELBOW=(86, 146), LEFT_ARM=(87, 152),
             RIGHT_HIP=(100, 159), RIGHT_KNEE=(102, 166), RIGHT_LEG=(103, 173), LEFT_HIP=(90, 159), LEFT_KNEE=(90, 166), LEFT_LEG=(89, 173))

# 동작: [(자세, 창 각도 또는 None(= 두 손 방향)), …]  — 주석은 그 프레임에서 몸이 하는 일
ACTIONS = {
    # 대기 4f: 숨쉬기 — 어깨·목이 1~2칸 내려갔다 올라옴, 창은 세운 채
    'idle': [
        (STAND, -85),
        (pose(STAND, NECK=(95, 135), RIGHT_SHOULDER=(102, 140), LEFT_SHOULDER=(87, 140), RIGHT_ELBOW=(106, 147), LEFT_ELBOW=(86, 147)), -85),
        (pose(STAND, NECK=(95, 136), RIGHT_SHOULDER=(102, 141), LEFT_SHOULDER=(87, 141), RIGHT_ELBOW=(106, 147), LEFT_ELBOW=(86, 148), RIGHT_ARM=(108, 152)), -84),
        (pose(STAND, NECK=(95, 135), RIGHT_SHOULDER=(102, 140), LEFT_SHOULDER=(87, 140), RIGHT_ELBOW=(106, 147), LEFT_ELBOW=(86, 147)), -85),
    ],
    # 걷기 8f: 보폭 크게(발 ±13칸), 무릎 높이 들기, 몸 2칸 오르내림, 뒷손 크게 흔들기, 창은 앞손에 세워 들고 살짝 앞뒤로
    'walk': [
        (pose(STAND, dy=1, RIGHT_KNEE=(108, 166), RIGHT_LEG=(112, 173), LEFT_KNEE=(85, 167), LEFT_LEG=(80, 173), LEFT_ARM=(98, 152), LEFT_ELBOW=(93, 147)), -80),
        (pose(STAND, dy=0, RIGHT_KNEE=(106, 166), RIGHT_LEG=(108, 173), LEFT_KNEE=(90, 164), LEFT_LEG=(85, 170), LEFT_ARM=(95, 151), LEFT_ELBOW=(91, 146)), -83),
        (pose(STAND, dy=-2, RIGHT_KNEE=(101, 166), RIGHT_LEG=(99, 173), LEFT_KNEE=(98, 162), LEFT_LEG=(95, 169), LEFT_ARM=(88, 151)), -86),
        (pose(STAND, dy=-1, RIGHT_KNEE=(96, 166), RIGHT_LEG=(91, 173), LEFT_KNEE=(104, 163), LEFT_LEG=(104, 170), LEFT_ARM=(81, 150), LEFT_ELBOW=(83, 146)), -89),
        (pose(STAND, dy=1, RIGHT_KNEE=(93, 167), RIGHT_LEG=(85, 173), LEFT_KNEE=(104, 166), LEFT_LEG=(109, 173), LEFT_ARM=(79, 149), LEFT_ELBOW=(82, 145)), -91),
        (pose(STAND, dy=0, RIGHT_KNEE=(96, 164), RIGHT_LEG=(92, 170), LEFT_KNEE=(103, 166), LEFT_LEG=(106, 173), LEFT_ARM=(83, 150), LEFT_ELBOW=(84, 146)), -88),
        (pose(STAND, dy=-2, RIGHT_KNEE=(103, 162), RIGHT_LEG=(100, 169), LEFT_KNEE=(95, 166), LEFT_LEG=(95, 173), LEFT_ARM=(90, 152)), -85),
        (pose(STAND, dy=-1, RIGHT_KNEE=(107, 163), RIGHT_LEG=(108, 170), LEFT_KNEE=(90, 166), LEFT_LEG=(87, 173), LEFT_ARM=(95, 152), LEFT_ELBOW=(91, 147)), -82),
    ],
    # 찌르기 8f (찌르기형 평타A): 웅크려 창을 뒤로 당김 → 앞발 들기 → 크게 디딤 → 상체 숙이며 두 팔 끝까지 뻗음 → 버팀 → 당겨 회수 → 가드
    'thrust': [
        (pose(dy=2, NECK=(91, 138), RIGHT_SHOULDER=(99, 143), RIGHT_ELBOW=(101, 150), RIGHT_ARM=(104, 150), LEFT_SHOULDER=(84, 143), LEFT_ELBOW=(83, 151), LEFT_ARM=(86, 155),
              RIGHT_KNEE=(108, 167), LEFT_KNEE=(86, 167)), None),
        (pose(dy=3, NECK=(88, 139), RIGHT_SHOULDER=(96, 144), RIGHT_ELBOW=(96, 152), RIGHT_ARM=(98, 152), LEFT_SHOULDER=(81, 144), LEFT_ELBOW=(79, 152), LEFT_ARM=(80, 157),
              RIGHT_KNEE=(110, 163), RIGHT_LEG=(114, 169), LEFT_KNEE=(85, 168)), None),
        (pose(dy=1, NECK=(99, 137), RIGHT_SHOULDER=(107, 142), RIGHT_ELBOW=(112, 147), RIGHT_ARM=(117, 147), LEFT_SHOULDER=(91, 142), LEFT_ELBOW=(95, 150), LEFT_ARM=(101, 151),
              RIGHT_HIP=(104, 160), RIGHT_KNEE=(116, 165), RIGHT_LEG=(124, 173), LEFT_KNEE=(87, 167), LEFT_LEG=(80, 173)), None),
        (pose(NECK=(110, 140), RIGHT_SHOULDER=(118, 144), RIGHT_ELBOW=(130, 145), RIGHT_ARM=(142, 145), LEFT_SHOULDER=(102, 143), LEFT_ELBOW=(112, 147), LEFT_ARM=(126, 146),
              RIGHT_HIP=(110, 161), RIGHT_KNEE=(124, 165), RIGHT_LEG=(130, 173), LEFT_HIP=(99, 161), LEFT_KNEE=(86, 167), LEFT_LEG=(74, 173)), None),
        (pose(NECK=(113, 141), RIGHT_SHOULDER=(121, 145), RIGHT_ELBOW=(134, 146), RIGHT_ARM=(147, 146), LEFT_SHOULDER=(105, 144), LEFT_ELBOW=(116, 147), LEFT_ARM=(130, 147),
              RIGHT_HIP=(112, 161), RIGHT_KNEE=(126, 165), RIGHT_LEG=(130, 173), LEFT_HIP=(101, 161), LEFT_KNEE=(87, 167), LEFT_LEG=(74, 173)), None),
        (pose(NECK=(106, 139), RIGHT_SHOULDER=(114, 143), RIGHT_ELBOW=(122, 147), RIGHT_ARM=(129, 148), LEFT_SHOULDER=(98, 142), LEFT_ELBOW=(104, 149), LEFT_ARM=(113, 150),
              RIGHT_HIP=(108, 160), RIGHT_KNEE=(122, 165), RIGHT_LEG=(128, 173), LEFT_HIP=(97, 160), LEFT_KNEE=(86, 167), LEFT_LEG=(76, 173)), None),
        (pose(NECK=(99, 136), RIGHT_SHOULDER=(107, 141), RIGHT_ELBOW=(113, 146), RIGHT_ARM=(118, 147), LEFT_SHOULDER=(91, 141), LEFT_ELBOW=(95, 148), LEFT_ARM=(102, 151),
              RIGHT_HIP=(104, 159), RIGHT_KNEE=(113, 165), RIGHT_LEG=(118, 173), LEFT_KNEE=(87, 166), LEFT_LEG=(80, 173)), None),
        (pose(), None),
    ],
    # 내리찍기 8f (찌르기형 평타B): 웅크림 → 창을 머리 위로 높이 듦(상체 뒤로 젖힘, 앞발 들기) → 디딤 → 상체를 크게 숙이며 창끝을 앞 땅으로 내리꽂음 → 회수
    'slam': [
        (pose(dy=3, NECK=(93, 138), RIGHT_ELBOW=(104, 150), RIGHT_ARM=(108, 152), LEFT_ELBOW=(88, 151), LEFT_ARM=(92, 156), RIGHT_KNEE=(108, 168), LEFT_KNEE=(86, 168)), None),
        (pose(NECK=(92, 133), RIGHT_SHOULDER=(100, 137), RIGHT_ELBOW=(104, 126), RIGHT_ARM=(103, 115), LEFT_SHOULDER=(85, 137), LEFT_ELBOW=(91, 128), LEFT_ARM=(97, 121)), -100),
        (pose(dy=-2, NECK=(91, 131), RIGHT_SHOULDER=(99, 136), RIGHT_ELBOW=(101, 123), RIGHT_ARM=(98, 110), LEFT_SHOULDER=(84, 136), LEFT_ELBOW=(88, 125), LEFT_ARM=(93, 117),
              RIGHT_KNEE=(111, 161), RIGHT_LEG=(116, 167)), -120),
        (pose(NECK=(102, 135), RIGHT_SHOULDER=(110, 139), RIGHT_ELBOW=(119, 130), RIGHT_ARM=(126, 121), LEFT_SHOULDER=(94, 139), LEFT_ELBOW=(103, 132), LEFT_ARM=(113, 127),
              RIGHT_HIP=(106, 159), RIGHT_KNEE=(118, 165), RIGHT_LEG=(124, 173), LEFT_KNEE=(87, 166), LEFT_LEG=(80, 173)), -45),
        (pose(dy=4, NECK=(112, 145), RIGHT_SHOULDER=(119, 149), RIGHT_ELBOW=(129, 153), RIGHT_ARM=(137, 158), LEFT_SHOULDER=(104, 149), LEFT_ELBOW=(113, 153), LEFT_ARM=(123, 155),
              RIGHT_HIP=(108, 163), RIGHT_KNEE=(121, 167), RIGHT_LEG=(125, 173), LEFT_HIP=(97, 163), LEFT_KNEE=(86, 169), LEFT_LEG=(78, 173)), 25),
        (pose(dy=5, NECK=(114, 147), RIGHT_SHOULDER=(121, 151), RIGHT_ELBOW=(130, 157), RIGHT_ARM=(137, 163), LEFT_SHOULDER=(106, 151), LEFT_ELBOW=(114, 157), LEFT_ARM=(124, 160),
              RIGHT_HIP=(108, 164), RIGHT_KNEE=(122, 168), RIGHT_LEG=(125, 173), LEFT_HIP=(97, 164), LEFT_KNEE=(86, 170), LEFT_LEG=(78, 173)), 35),
        (pose(dy=1, NECK=(104, 138), RIGHT_SHOULDER=(112, 142), RIGHT_ELBOW=(119, 148), RIGHT_ARM=(125, 151), LEFT_SHOULDER=(96, 142), LEFT_ELBOW=(102, 149), LEFT_ARM=(110, 153),
              RIGHT_HIP=(105, 160), RIGHT_KNEE=(116, 166), RIGHT_LEG=(121, 173), LEFT_KNEE=(87, 167), LEFT_LEG=(80, 173)), 5),
        (pose(), None),
    ],
    # 휩쓸기 8f (휩쓸기형 평타A): 허리를 뒤로 비틀며 할버드를 등 뒤로 (날이 뒤) → 웅크려 감음 → 머리 위로 크게 돌려 넘김 → 앞발 디딤 + 앞으로 수평 휩쓸기
    #  (팔을 끝까지 뻗음) → 몸 앞을 가로질러 아래로 따라감 → 회수
    'sweep': [
        (pose(dy=1, NECK=(91, 135), RIGHT_SHOULDER=(98, 140), RIGHT_ELBOW=(93, 145), RIGHT_ARM=(86, 146), LEFT_SHOULDER=(83, 140), LEFT_ELBOW=(78, 146), LEFT_ARM=(76, 151),
              RIGHT_KNEE=(108, 167), LEFT_KNEE=(85, 167), LEFT_LEG=(80, 173)), 172),      # 날이 등 뒤 (손 방향과 반대)
        (pose(dy=3, NECK=(88, 137), RIGHT_SHOULDER=(95, 142), RIGHT_ELBOW=(89, 145), RIGHT_ARM=(81, 144), LEFT_SHOULDER=(81, 142), LEFT_ELBOW=(76, 149), LEFT_ARM=(73, 154),
              RIGHT_KNEE=(109, 167), RIGHT_LEG=(112, 173), LEFT_KNEE=(84, 168), LEFT_LEG=(78, 173)), 165),
        (pose(dy=-1, NECK=(94, 133), RIGHT_SHOULDER=(102, 138), RIGHT_ELBOW=(104, 128), RIGHT_ARM=(100, 119), LEFT_SHOULDER=(86, 138), LEFT_ELBOW=(87, 129), LEFT_ARM=(89, 124),
              RIGHT_KNEE=(112, 162), RIGHT_LEG=(117, 168)), -110),
        (pose(NECK=(103, 136), RIGHT_SHOULDER=(111, 140), RIGHT_ELBOW=(120, 133), RIGHT_ARM=(127, 128), LEFT_SHOULDER=(95, 140), LEFT_ELBOW=(103, 136), LEFT_ARM=(112, 135),
              RIGHT_HIP=(106, 159), RIGHT_KNEE=(118, 165), RIGHT_LEG=(125, 173), LEFT_KNEE=(87, 166), LEFT_LEG=(80, 173)), -30),
        (pose(dy=1, NECK=(109, 139), RIGHT_SHOULDER=(117, 143), RIGHT_ELBOW=(129, 143), RIGHT_ARM=(141, 143), LEFT_SHOULDER=(101, 143), LEFT_ELBOW=(112, 145), LEFT_ARM=(125, 144),
              RIGHT_HIP=(110, 161), RIGHT_KNEE=(123, 165), RIGHT_LEG=(129, 173), LEFT_HIP=(99, 161), LEFT_KNEE=(87, 167), LEFT_LEG=(76, 173)), None),
        (pose(dy=2, NECK=(110, 141), RIGHT_SHOULDER=(117, 145), RIGHT_ELBOW=(126, 152), RIGHT_ARM=(132, 158), LEFT_SHOULDER=(102, 145), LEFT_ELBOW=(110, 151), LEFT_ARM=(118, 155),
              RIGHT_HIP=(110, 162), RIGHT_KNEE=(123, 166), RIGHT_LEG=(129, 173), LEFT_HIP=(99, 162), LEFT_KNEE=(87, 168), LEFT_LEG=(76, 173)), 40),
        (pose(dy=1, NECK=(102, 137), RIGHT_SHOULDER=(110, 141), RIGHT_ELBOW=(116, 148), RIGHT_ARM=(121, 152), LEFT_SHOULDER=(94, 141), LEFT_ELBOW=(98, 149), LEFT_ARM=(105, 153),
              RIGHT_HIP=(105, 160), RIGHT_KNEE=(116, 166), RIGHT_LEG=(122, 173), LEFT_KNEE=(87, 167), LEFT_LEG=(80, 173)), 20),
        (pose(), None),
    ],
    # 내려찍기 8f (휩쓸기형 평타B): 할버드를 머리 뒤로 높이 넘겨 듦(날이 등 뒤, 상체 뒤로 젖힘) → 발끝으로 서며 더 젖힘 → 크게 디디며 머리 위를 지나
    #  → 상체를 접으며 앞 땅까지 내려찍음(무릎 깊게) → 박힌 채 버팀 → 뽑아 올림 → 가드
    'chop': [
        (pose(dy=3, NECK=(92, 138), RIGHT_ELBOW=(103, 150), RIGHT_ARM=(106, 151), LEFT_ELBOW=(87, 150), LEFT_ARM=(91, 155), RIGHT_KNEE=(108, 168), LEFT_KNEE=(86, 168)), None),
        (pose(NECK=(90, 133), RIGHT_SHOULDER=(98, 137), RIGHT_ELBOW=(98, 125), RIGHT_ARM=(93, 116), LEFT_SHOULDER=(83, 137), LEFT_ELBOW=(84, 126), LEFT_ARM=(85, 119)), -150),
        (pose(dy=-3, NECK=(88, 130), RIGHT_SHOULDER=(96, 135), RIGHT_ELBOW=(95, 122), RIGHT_ARM=(89, 112), LEFT_SHOULDER=(81, 135), LEFT_ELBOW=(80, 123), LEFT_ARM=(80, 115),
              RIGHT_KNEE=(110, 160), RIGHT_LEG=(114, 166)), -165),
        (pose(NECK=(101, 134), RIGHT_SHOULDER=(109, 138), RIGHT_ELBOW=(116, 127), RIGHT_ARM=(119, 116), LEFT_SHOULDER=(93, 138), LEFT_ELBOW=(100, 129), LEFT_ARM=(107, 122),
              RIGHT_HIP=(106, 159), RIGHT_KNEE=(119, 164), RIGHT_LEG=(126, 173), LEFT_KNEE=(87, 166), LEFT_LEG=(80, 173)), -70),
        (pose(dy=5, NECK=(113, 146), RIGHT_SHOULDER=(120, 150), RIGHT_ELBOW=(130, 154), RIGHT_ARM=(138, 160), LEFT_SHOULDER=(105, 150), LEFT_ELBOW=(114, 155), LEFT_ARM=(124, 158),
              RIGHT_HIP=(109, 164), RIGHT_KNEE=(123, 168), RIGHT_LEG=(127, 173), LEFT_HIP=(98, 164), LEFT_KNEE=(85, 170), LEFT_LEG=(76, 173)), 40),
        (pose(dy=6, NECK=(114, 148), RIGHT_SHOULDER=(121, 152), RIGHT_ELBOW=(130, 158), RIGHT_ARM=(136, 165), LEFT_SHOULDER=(106, 152), LEFT_ELBOW=(114, 158), LEFT_ARM=(122, 162),
              RIGHT_HIP=(109, 165), RIGHT_KNEE=(123, 169), RIGHT_LEG=(127, 173), LEFT_HIP=(98, 165), LEFT_KNEE=(85, 171), LEFT_LEG=(76, 173)), 55),
        (pose(dy=2, NECK=(105, 139), RIGHT_SHOULDER=(113, 143), RIGHT_ELBOW=(121, 145), RIGHT_ARM=(128, 145), LEFT_SHOULDER=(97, 143), LEFT_ELBOW=(104, 148), LEFT_ARM=(112, 149),
              RIGHT_HIP=(106, 161), RIGHT_KNEE=(118, 166), RIGHT_LEG=(124, 173), LEFT_KNEE=(86, 167), LEFT_LEG=(78, 173)), None),
        (pose(), None),
    ],
}
LABEL = {'idle': '대기 4f', 'walk': '걷기 8f', 'thrust': '찌르기 8f (찌르기형 평타A)', 'slam': '내리찍기 8f (찌르기형 평타B)',
         'sweep': '휩쓸기 8f (휩쓸기형 평타A)', 'chop': '내려찍기 8f (휩쓸기형 평타B)'}


def kp(p):
    return [{'x': round(x / N, 4), 'y': round(y / N, 4), 'label': k, 'z_index': Z.get(k, 5)} for k, (x, y) in p.items()]


def stick(p, ang, S=3, ghost=None):
    """막대 인형 (검사 skel.py 색: 앞팔·앞다리 주황, 뒤 파랑) + 창(노랑, 뒷손에서 앞손 너머 앞쪽 44칸·뒤쪽 14칸)"""
    im = Image.new('RGBA', (N * S, N * S), (20, 22, 30, 255)); d = ImageDraw.Draw(im)
    if ghost is not None:
        for a, b in BONES: d.line([(ghost[a][0] * S, ghost[a][1] * S), (ghost[b][0] * S, ghost[b][1] * S)], fill=(60, 64, 80), width=S)
    a = math.radians(ang); g = p['RIGHT ARM']
    d.line([((g[0] - 30 * math.cos(a)) * S, (g[1] - 30 * math.sin(a)) * S), ((g[0] + 34 * math.cos(a)) * S, (g[1] + 34 * math.sin(a)) * S)], fill=(255, 215, 80), width=S)
    tip = (g[0] + 34 * math.cos(a), g[1] + 34 * math.sin(a))
    d.polygon([((tip[0] + 6 * math.cos(a)) * S, (tip[1] + 6 * math.sin(a)) * S), ((tip[0] - 3 * math.sin(a)) * S, (tip[1] + 3 * math.cos(a)) * S),
               ((tip[0] + 3 * math.sin(a)) * S, (tip[1] - 3 * math.cos(a)) * S)], fill=(255, 240, 160))
    col = lambda a_, b_: (255, 120, 90) if 'RIGHT' in a_ + b_ else (90, 170, 255) if 'LEFT' in a_ + b_ else (230, 230, 230)
    for a_, b_ in sorted(BONES, key=lambda e: 'RIGHT' in e[0] + e[1]):
        d.line([(p[a_][0] * S, p[a_][1] * S), (p[b_][0] * S, p[b_][1] * S)], fill=col(a_, b_), width=S + 1)
    hx, hy = p['NECK'][0] + 2, p['NECK'][1] - 9
    d.ellipse([(hx - 8) * S, (hy - 8) * S, (hx + 8) * S, (hy + 8) * S], outline=(230, 230, 230), width=S)
    d.line([(40 * S, FOOT[1] * S), (160 * S, FOOT[1] * S)], fill=(80, 80, 100), width=1)
    return im.crop((40 * S, 70 * S, 175 * S, 182 * S))


if __name__ == '__main__':
    os.makedirs(SK, exist_ok=True)
    for name, frames in ACTIONS.items():
        fr = [(p, a if a is not None else spear_ang(p)) for p, a in frames]
        base = STAND if name in ('idle', 'walk') else pose()      # 머리 관절까지 채운 기준 자세
        tiles = [stick(p, a, ghost=base) for p, a in fr]
        W_, H_ = tiles[0].size; mont = Image.new('RGBA', ((W_ + 6) * len(tiles), H_), (40, 42, 52, 255))
        for i, t in enumerate(tiles): mont.paste(t, (i * (W_ + 6), 0))
        mont.save(os.path.join(SK, f'stick-{name}.png'))
        g = [t.convert('RGB') for t in tiles]
        g[0].save(os.path.join(SK, f'stick-{name}.gif'), save_all=True, append_images=g[1:], duration=120 if name not in ('idle',) else 250, loop=0)
        json.dump({'action': name, 'label': LABEL[name], 'canvas': N, 'foot': FOOT, 'frames': [kp(p) for p, _ in fr], 'spear_deg': [a for _, a in fr],
                   'first_frame_keypoints': kp(base)}, open(os.path.join(SK, f'{name}.json'), 'w'), ensure_ascii=False)
        # 몸 움직임 크기 (막대 인형 기준): 목·앞손·앞발이 기준 자세에서 가장 멀리 간 거리
        far = lambda k: max(math.hypot(p[k][0] - base[k][0], p[k][1] - base[k][1]) for p, _ in fr)
        print(f'{name:6s} {len(fr)}f 목 {far("NECK"):.0f} 앞손 {far("RIGHT ARM"):.0f} 앞발 {far("RIGHT LEG"):.0f} 창 {min(a for _, a in fr)}~{max(a for _, a in fr)}도')
