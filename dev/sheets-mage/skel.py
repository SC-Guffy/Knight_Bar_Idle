# 마법사 계열 관절 시퀀스 설계 (animate-with-skeleton-v3, docs/specs/legacy-class-sheets.md "동작은 관절 지정 애니") — PixelLab·GPU 0, 설계만.
#  형식은 검사 세션 dev/sheets-sword/skel.py 와 같다: 192칸, 발 = (96, 176), 얼굴 오른쪽(east), 관절 13개 + 머리 5개(목 기준),
#  RIGHT = 지팡이 든 앞팔(몸 앞, z 위), LEFT = 빈 뒷팔. pose()·kp()·BASE·HEAD·Z 는 그 파일 것을 그대로 쓴다.
#  프레임마다 (자세, 지팡이 각도(도, 0 = 앞, -90 = 위), bowA) — 지팡이는 손목(RIGHT ARM)에 덧그린다(dev/sheets-common/wpn.py).
#  bowA 는 그 프레임을 cast 줄 키 자세로 쓸 때의 값(스킬 자세 bowA 와 가장 가까운 프레임을 고른다, src/sprites.js sheetFrame).
#  크게 과장한다: 지난 시도(마네킹)는 손만 2~12칸 움직여 품질 미달 — 이번엔 몸통 기울기·무릎·발 디딤·두 팔을 모두 크게.
#  python -I -B skel.py → skel/stick-<동작>.png (막대 인형 줄), skel/stick-all.png, skel/keys-<동작>.json (keypoints 시퀀스, 요청 본문 재료)
import os, sys, json, math
from PIL import Image, ImageDraw, ImageFont
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', 'sheets-sword'))
from skel import BASE, pose, kp, BONES, N        # 공용 형식 (검사 세션)

SK = os.path.join(HERE, 'skel')
try: FONT = ImageFont.truetype('malgun.ttf', 18)          # 한글 제목 (없으면 기본 글꼴)
except OSError: FONT = None
STAFF_FRONT, STAFF_BACK = 38, 12                 # 192칸 기준 손에서 지팡이 끝·물미까지 (96칸 지팡이 19+6칸의 2배)

P = pose     # 짧게

MOVES = {
    # ── 대기 4f: 지팡이를 앞에 세워 쥐고 숨쉬기 — 어깨·가슴이 오르내리고 뒷손이 살짝 흔들린다
    'idle': [
        (P(), -80, None),
        (P(NECK=(97.5, 132), RIGHT_SHOULDER=(108.8, 137), LEFT_SHOULDER=(87.5, 137), RIGHT_ELBOW=(112.5, 144), RIGHT_ARM=(117.5, 149), LEFT_ELBOW=(84, 141), LEFT_ARM=(81, 144)), -82, None),
        (P(NECK=(97.5, 131), RIGHT_SHOULDER=(108.8, 136), LEFT_SHOULDER=(87.5, 136), RIGHT_ELBOW=(112.5, 143), RIGHT_ARM=(117.5, 148), LEFT_ELBOW=(83, 140), LEFT_ARM=(80, 142)), -84, None),
        (P(NECK=(97.5, 133), RIGHT_SHOULDER=(108.8, 138), LEFT_SHOULDER=(87.5, 138), RIGHT_ELBOW=(112.5, 145), RIGHT_ARM=(117.5, 150), LEFT_ELBOW=(84.5, 142), LEFT_ARM=(82, 145)), -81, None),
    ],
    # ── 걷기 8f: 보폭을 크게(무릎 높이 들기), 몸이 위아래로 2칸, 뒷팔이 다리와 반대로 크게 흔들림, 지팡이는 짚듯이 앞뒤로 기울어짐
    'walk': [
        (P(RIGHT_HIP=(104, 159), RIGHT_KNEE=(113, 165), RIGHT_LEG=(118, 173), LEFT_HIP=(91, 159), LEFT_KNEE=(85, 166), LEFT_LEG=(78, 173),
           LEFT_ELBOW=(91, 146), LEFT_ARM=(97, 149)), -70, None),
        (P(NECK=(97.5, 132), RIGHT_HIP=(104, 157), RIGHT_KNEE=(110, 164), RIGHT_LEG=(113, 173), LEFT_HIP=(91, 157), LEFT_KNEE=(86, 163), LEFT_LEG=(82, 170),
           LEFT_ELBOW=(89, 145), LEFT_ARM=(93, 149)), -76, None),
        (P(NECK=(97.5, 131), RIGHT_HIP=(104, 156), RIGHT_KNEE=(106, 164), RIGHT_LEG=(106, 173), LEFT_HIP=(91, 156), LEFT_KNEE=(95, 160), LEFT_LEG=(92, 167),
           LEFT_ELBOW=(87, 143), LEFT_ARM=(86, 148)), -84, None),
        (P(NECK=(97.5, 133), RIGHT_HIP=(104, 158), RIGHT_KNEE=(102, 165), RIGHT_LEG=(99, 173), LEFT_HIP=(91, 158), LEFT_KNEE=(100, 162), LEFT_LEG=(104, 168),
           LEFT_ELBOW=(85, 143), LEFT_ARM=(80, 146), RIGHT_ARM=(115, 152)), -96, None),
        (P(RIGHT_HIP=(104, 159), RIGHT_KNEE=(98, 166), RIGHT_LEG=(91, 173), LEFT_HIP=(91, 159), LEFT_KNEE=(101, 165), LEFT_LEG=(108, 173),
           LEFT_ELBOW=(83, 143), LEFT_ARM=(77, 145), RIGHT_ARM=(114, 153)), -104, None),
        (P(NECK=(97.5, 132), RIGHT_HIP=(104, 157), RIGHT_KNEE=(100, 163), RIGHT_LEG=(95, 170), LEFT_HIP=(91, 157), LEFT_KNEE=(98, 164), LEFT_LEG=(103, 173),
           LEFT_ELBOW=(85, 144), LEFT_ARM=(80, 147), RIGHT_ARM=(116, 152)), -96, None),
        (P(NECK=(97.5, 131), RIGHT_HIP=(104, 156), RIGHT_KNEE=(108, 160), RIGHT_LEG=(105, 167), LEFT_HIP=(91, 156), LEFT_KNEE=(92, 164), LEFT_LEG=(91, 173),
           LEFT_ELBOW=(88, 145), LEFT_ARM=(90, 149)), -86, None),
        (P(NECK=(97.5, 133), RIGHT_HIP=(104, 158), RIGHT_KNEE=(111, 162), RIGHT_LEG=(114, 169), LEFT_HIP=(91, 158), LEFT_KNEE=(88, 165), LEFT_LEG=(83, 173),
           LEFT_ELBOW=(90, 146), LEFT_ARM=(95, 149)), -76, None),
    ],
    # ── 평타 A 지팡이 겨눠 쏘기 8f: 뒤로 젖혀 지팡이를 어깨 뒤로 당김(뒷손은 앞으로 뻗어 겨눔) → 앞발 크게 디딤 + 몸 앞으로 →
    #    지팡이 든 팔을 끝까지 앞으로 뻗어 수평 겨눔(타격) → 반동으로 몸이 뒤로 → 대기
    'atkA': [
        (P(NECK=(93, 136), RIGHT_SHOULDER=(102, 140), RIGHT_ELBOW=(97, 134), RIGHT_ARM=(92, 128), LEFT_SHOULDER=(85, 141), LEFT_ELBOW=(93, 141), LEFT_ARM=(102, 139),
           RIGHT_HIP=(102, 160), RIGHT_KNEE=(108, 167), LEFT_HIP=(90, 160), LEFT_KNEE=(86, 167), LEFT_LEG=(82, 173)), -150, -0.5),
        (P(NECK=(90, 137), RIGHT_SHOULDER=(98, 141), RIGHT_ELBOW=(90, 136), RIGHT_ARM=(83, 131), LEFT_SHOULDER=(83, 142), LEFT_ELBOW=(94, 141), LEFT_ARM=(106, 140),
           RIGHT_HIP=(101, 161), RIGHT_KNEE=(110, 165), RIGHT_LEG=(115, 170), LEFT_HIP=(89, 161), LEFT_KNEE=(84, 168), LEFT_LEG=(79, 173)), -165, -0.6),
        (P(NECK=(102, 136), RIGHT_SHOULDER=(111, 140), RIGHT_ELBOW=(118, 139), RIGHT_ARM=(126, 137), LEFT_SHOULDER=(92, 141), LEFT_ELBOW=(88, 148), LEFT_ARM=(84, 153),
           RIGHT_HIP=(106, 160), RIGHT_KNEE=(117, 165), RIGHT_LEG=(124, 173), LEFT_HIP=(93, 160), LEFT_KNEE=(86, 167), LEFT_LEG=(78, 173)), -20, 0.6),
        (P(NECK=(108, 138), RIGHT_SHOULDER=(117, 141), RIGHT_ELBOW=(128, 140), RIGHT_ARM=(139, 139), LEFT_SHOULDER=(97, 142), LEFT_ELBOW=(91, 148), LEFT_ARM=(85, 152),
           RIGHT_HIP=(108, 161), RIGHT_KNEE=(120, 166), RIGHT_LEG=(126, 173), LEFT_HIP=(95, 161), LEFT_KNEE=(86, 168), LEFT_LEG=(77, 173)), -2, 0.75),
        (P(NECK=(109, 138), RIGHT_SHOULDER=(118, 141), RIGHT_ELBOW=(129, 140), RIGHT_ARM=(140, 140), LEFT_SHOULDER=(98, 142), LEFT_ELBOW=(92, 148), LEFT_ARM=(86, 153),
           RIGHT_HIP=(108, 161), RIGHT_KNEE=(120, 166), RIGHT_LEG=(126, 173), LEFT_HIP=(95, 161), LEFT_KNEE=(86, 168), LEFT_LEG=(77, 173)), 0, 0.75),
        (P(NECK=(103, 136), RIGHT_SHOULDER=(112, 140), RIGHT_ELBOW=(121, 143), RIGHT_ARM=(128, 146), LEFT_SHOULDER=(93, 141), LEFT_ELBOW=(89, 147), LEFT_ARM=(87, 152),
           RIGHT_HIP=(106, 160), RIGHT_KNEE=(115, 166), RIGHT_LEG=(120, 173), LEFT_HIP=(93, 160), LEFT_KNEE=(87, 167), LEFT_LEG=(80, 173)), -30, 0.4),
        (P(NECK=(99, 135), RIGHT_SHOULDER=(109, 139), RIGHT_ELBOW=(115, 145), RIGHT_ARM=(120, 150), RIGHT_KNEE=(110, 166), RIGHT_LEG=(113, 173)), -60, None),
        (P(), -80, None),
    ],
    # ── 평타 B 치켜들어 내리꽂기 8f: 웅크림 → 두 손으로 지팡이를 머리 위로 높이(몸 쭉 펴고 발끝) → 공중에서 뒤로 젖힘 →
    #    앞으로 크게 숙이며 지팡이 끝을 앞 땅에 내리꽂음(무릎 깊이, 타격) → 꽂은 채 유지 → 일어남
    'atkB': [
        (P(NECK=(96, 142), RIGHT_SHOULDER=(106, 146), RIGHT_ELBOW=(111, 152), RIGHT_ARM=(114, 156), LEFT_SHOULDER=(87, 146), LEFT_ELBOW=(92, 152), LEFT_ARM=(105, 156),
           RIGHT_HIP=(103, 163), RIGHT_KNEE=(112, 167), RIGHT_LEG=(110, 173), LEFT_HIP=(91, 163), LEFT_KNEE=(84, 168), LEFT_LEG=(86, 173)), -60, None),
        (P(NECK=(97, 130), RIGHT_SHOULDER=(106, 134), RIGHT_ELBOW=(108, 122), RIGHT_ARM=(104, 111), LEFT_SHOULDER=(88, 134), LEFT_ELBOW=(93, 121), LEFT_ARM=(101, 112),
           RIGHT_HIP=(103, 155), RIGHT_KNEE=(105, 163), RIGHT_LEG=(106, 172), LEFT_HIP=(91, 155), LEFT_KNEE=(90, 163), LEFT_LEG=(89, 172)), -95, -1.4),
        (P(NECK=(94, 128), RIGHT_SHOULDER=(102, 132), RIGHT_ELBOW=(100, 119), RIGHT_ARM=(94, 108), LEFT_SHOULDER=(85, 132), LEFT_ELBOW=(87, 119), LEFT_ARM=(92, 109),
           RIGHT_HIP=(101, 153), RIGHT_KNEE=(108, 158), RIGHT_LEG=(110, 166), LEFT_HIP=(89, 153), LEFT_KNEE=(87, 160), LEFT_LEG=(86, 168)), -125, -1.4),
        (P(NECK=(108, 140), RIGHT_SHOULDER=(116, 144), RIGHT_ELBOW=(124, 140), RIGHT_ARM=(130, 136), LEFT_SHOULDER=(99, 144), LEFT_ELBOW=(110, 141), LEFT_ARM=(122, 138),
           RIGHT_HIP=(107, 161), RIGHT_KNEE=(119, 165), RIGHT_LEG=(125, 173), LEFT_HIP=(95, 161), LEFT_KNEE=(88, 168), LEFT_LEG=(80, 173)), 20, 0.9),
        (P(NECK=(114, 147), RIGHT_SHOULDER=(121, 151), RIGHT_ELBOW=(129, 153), RIGHT_ARM=(135, 151), LEFT_SHOULDER=(105, 151), LEFT_ELBOW=(116, 154), LEFT_ARM=(128, 151),
           RIGHT_HIP=(108, 164), RIGHT_KNEE=(121, 167), RIGHT_LEG=(124, 173), LEFT_HIP=(97, 164), LEFT_KNEE=(88, 169), LEFT_LEG=(78, 173)), 40, 1.2),
        (P(NECK=(113, 146), RIGHT_SHOULDER=(120, 150), RIGHT_ELBOW=(128, 153), RIGHT_ARM=(134, 151), LEFT_SHOULDER=(104, 150), LEFT_ELBOW=(115, 154), LEFT_ARM=(127, 151),
           RIGHT_HIP=(108, 164), RIGHT_KNEE=(121, 167), RIGHT_LEG=(124, 173), LEFT_HIP=(97, 164), LEFT_KNEE=(88, 169), LEFT_LEG=(78, 173)), 41, 1.2),
        (P(NECK=(104, 139), RIGHT_SHOULDER=(113, 143), RIGHT_ELBOW=(118, 150), RIGHT_ARM=(121, 156), LEFT_SHOULDER=(95, 143), LEFT_ELBOW=(93, 150), LEFT_ARM=(94, 155),
           RIGHT_HIP=(106, 161), RIGHT_KNEE=(115, 166), RIGHT_LEG=(119, 173), LEFT_HIP=(93, 161), LEFT_KNEE=(87, 167), LEFT_LEG=(81, 173)), -40, None),
        (P(), -80, None),
    ],
    # ── 시전 8f (스킬 자세의 cast 줄, bowA 키 5개를 모두 담는다): 두 손을 가슴 앞에 모아 지팡이를 세워 집중(−0.2) → 뒤로 젖히며 들어 올림(−0.7) →
    #    두 팔을 머리 위로 쭉 뻗어 지팡이를 하늘로(−1.4, 발끝) → 유지 → 앞으로 크게 겨눔(0.7, 앞발 디딤) → 앞 땅에 내리꽂음(1.2) → 일어남
    'cast': [
        (P(NECK=(96, 134), RIGHT_SHOULDER=(105, 139), RIGHT_ELBOW=(106, 147), RIGHT_ARM=(103, 146), LEFT_SHOULDER=(87, 139), LEFT_ELBOW=(91, 147), LEFT_ARM=(100, 147),
           RIGHT_HIP=(102, 159), RIGHT_KNEE=(107, 166), LEFT_HIP=(90, 159), LEFT_KNEE=(87, 166)), -88, -0.2),
        (P(NECK=(95, 133), RIGHT_SHOULDER=(104, 137), RIGHT_ELBOW=(106, 143), RIGHT_ARM=(102, 142), LEFT_SHOULDER=(86, 137), LEFT_ELBOW=(90, 144), LEFT_ARM=(99, 143),
           RIGHT_HIP=(102, 158), RIGHT_KNEE=(107, 165), LEFT_HIP=(90, 158), LEFT_KNEE=(87, 165)), -90, -0.2),
        (P(NECK=(93, 131), RIGHT_SHOULDER=(102, 135), RIGHT_ELBOW=(104, 126), RIGHT_ARM=(101, 118), LEFT_SHOULDER=(84, 135), LEFT_ELBOW=(88, 127), LEFT_ARM=(96, 120),
           RIGHT_HIP=(101, 157), RIGHT_KNEE=(108, 163), RIGHT_LEG=(110, 172), LEFT_HIP=(89, 157), LEFT_KNEE=(86, 165), LEFT_LEG=(85, 173)), -112, -0.7),
        (P(NECK=(96, 128), RIGHT_SHOULDER=(105, 132), RIGHT_ELBOW=(106, 119), RIGHT_ARM=(104, 106), LEFT_SHOULDER=(87, 132), LEFT_ELBOW=(91, 119), LEFT_ARM=(99, 107),
           RIGHT_HIP=(103, 154), RIGHT_KNEE=(105, 162), RIGHT_LEG=(106, 171), LEFT_HIP=(91, 154), LEFT_KNEE=(90, 162), LEFT_LEG=(89, 171)), -92, -1.4),
        (P(NECK=(96, 127), RIGHT_SHOULDER=(105, 131), RIGHT_ELBOW=(107, 118), RIGHT_ARM=(105, 105), LEFT_SHOULDER=(87, 131), LEFT_ELBOW=(91, 118), LEFT_ARM=(100, 106),
           RIGHT_HIP=(103, 153), RIGHT_KNEE=(105, 161), RIGHT_LEG=(106, 170), LEFT_HIP=(91, 153), LEFT_KNEE=(90, 161), LEFT_LEG=(89, 170)), -90, -1.4),
        (P(NECK=(106, 136), RIGHT_SHOULDER=(115, 140), RIGHT_ELBOW=(126, 138), RIGHT_ARM=(137, 136), LEFT_SHOULDER=(96, 141), LEFT_ELBOW=(106, 141), LEFT_ARM=(118, 139),
           RIGHT_HIP=(107, 160), RIGHT_KNEE=(118, 165), RIGHT_LEG=(124, 173), LEFT_HIP=(94, 160), LEFT_KNEE=(87, 167), LEFT_LEG=(79, 173)), -8, 0.7),
        (P(NECK=(112, 145), RIGHT_SHOULDER=(120, 149), RIGHT_ELBOW=(128, 152), RIGHT_ARM=(134, 150), LEFT_SHOULDER=(103, 149), LEFT_ELBOW=(114, 153), LEFT_ARM=(126, 150),
           RIGHT_HIP=(108, 163), RIGHT_KNEE=(120, 167), RIGHT_LEG=(123, 173), LEFT_HIP=(96, 163), LEFT_KNEE=(88, 168), LEFT_LEG=(79, 173)), 41, 1.2),
        (P(NECK=(101, 137), RIGHT_SHOULDER=(110, 141), RIGHT_ELBOW=(116, 147), RIGHT_ARM=(120, 151), RIGHT_KNEE=(110, 166), RIGHT_LEG=(113, 173)), -55, None),
    ],
}
FPS = {'idle': 6, 'walk': 10, 'atkA': 12, 'atkB': 12, 'cast': 10}
TITLE = {'idle': '대기 4f', 'walk': '걷기 8f', 'atkA': '평타A 지팡이 겨눠 쏘기 8f', 'atkB': '평타B 치켜들어 내리꽂기 8f', 'cast': '시전 8f (두 손 모아 집중 → 하늘로 → 겨눔 → 내리꽂기)'}


def stick(p, ang, S=3, ghost=None):
    """막대 인형 한 칸 (지팡이는 손에서 앞 STAFF_FRONT·뒤 STAFF_BACK, 끝에 구슬). ghost = 기준 자세(흐리게)"""
    im = Image.new('RGBA', (N * S, N * S), (20, 22, 30, 255)); d = ImageDraw.Draw(im)
    col = lambda a, b: (255, 120, 90) if 'RIGHT' in a + b else (90, 170, 255) if 'LEFT' in a + b else (230, 230, 230)
    if ghost is not None:
        for a, b in BONES: d.line([(ghost[a][0] * S, ghost[a][1] * S), (ghost[b][0] * S, ghost[b][1] * S)], fill=(60, 64, 80), width=S)
    # 뒷팔·뒷다리를 먼저 (몸 뒤)
    order = sorted(BONES, key=lambda ab: 0 if 'LEFT' in ab[0] + ab[1] else 1)
    for a, b in order:
        d.line([(p[a][0] * S, p[a][1] * S), (p[b][0] * S, p[b][1] * S)], fill=col(a, b), width=S + 1)
    hx, hy = p['NECK'][0] + 2, p['NECK'][1] - 9
    d.ellipse([(hx - 8) * S, (hy - 8) * S, (hx + 8) * S, (hy + 8) * S], outline=(230, 230, 230), width=S)
    d.ellipse([(p['NOSE'][0] - 1.5) * S, (p['NOSE'][1] - 1.5) * S, (p['NOSE'][0] + 1.5) * S, (p['NOSE'][1] + 1.5) * S], fill=(230, 230, 230))
    g = p['RIGHT ARM']; a = math.radians(ang); c, s = math.cos(a), math.sin(a)
    tip = (g[0] + STAFF_FRONT * c, g[1] + STAFF_FRONT * s); butt = (g[0] - STAFF_BACK * c, g[1] - STAFF_BACK * s)
    d.line([(butt[0] * S, butt[1] * S), (tip[0] * S, tip[1] * S)], fill=(200, 160, 90), width=S + 1)
    d.ellipse([(tip[0] - 3) * S, (tip[1] - 3) * S, (tip[0] + 3) * S, (tip[1] + 3) * S], fill=(120, 220, 255))
    d.line([(40 * S, 176 * S), (160 * S, 176 * S)], fill=(80, 80, 100), width=1)
    return im.crop((40 * S, 60 * S, 190 * S, 180 * S))


def staff_reach(p, ang):
    g = p['RIGHT ARM']; a = math.radians(ang)
    return [(g[0] + STAFF_FRONT * math.cos(a), g[1] + STAFF_FRONT * math.sin(a)), (g[0] - STAFF_BACK * math.cos(a), g[1] - STAFF_BACK * math.sin(a))]


if __name__ == '__main__':
    os.makedirs(SK, exist_ok=True)
    rows = []
    for name, fr in MOVES.items():
        tiles = [stick(p, a, ghost=pose()) for p, a, b in fr]
        W, H = tiles[0].size
        row = Image.new('RGBA', ((W + 6) * len(tiles), H + 28), (40, 42, 52, 255)); d = ImageDraw.Draw(row)
        for i, (t, (p, a, b)) in enumerate(zip(tiles, fr)):
            row.paste(t, (i * (W + 6), 28))
            d.text((i * (W + 6) + 6, 4), f'{i + 1}  staff {a}°' + (f'  bowA {b}' if b is not None else ''), fill=(220, 220, 230), font=FONT)
        row.save(os.path.join(SK, f'stick-{name}.png')); rows.append((name, row))
        # 요청 본문 재료: 프레임 keypoints 와 지팡이 각도·bowA (first_frame·first_frame_keypoints 는 새 기준 그림이 나온 뒤 채운다)
        json.dump({'action': TITLE[name], 'fps': FPS[name], 'keypoints': [kp(p) for p, a, b in fr], 'staff_deg': [a for p, a, b in fr],
                   'bowA': [b for p, a, b in fr]}, open(os.path.join(SK, f'keys-{name}.json'), 'w'), ensure_ascii=False)
        # 칸 검사: 지팡이 끝·물미가 192칸 안 (발 96,176 기준)
        out = [(i, round(x), round(y)) for i, (p, a, b) in enumerate(fr) for (x, y) in staff_reach(p, a) if not (4 <= x <= 188 and 4 <= y <= 177)]   # 땅(176) 아래로 안 들어가게
        print(name, len(fr), 'f', '칸 밖' if out else '칸 안', out)
    W = max(r.width for _, r in rows); H = sum(r.height + 30 for _, r in rows)
    allm = Image.new('RGBA', (W, H), (30, 32, 40, 255)); d = ImageDraw.Draw(allm); y = 0
    for name, r in rows:
        d.text((8, y + 4), TITLE[name], fill=(255, 220, 90), font=FONT); allm.paste(r, (0, y + 30)); y += r.height + 30
    allm.save(os.path.join(SK, 'stick-all.png')); print('stick-all', allm.size)
