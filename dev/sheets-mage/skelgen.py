# 관절 지정 애니 (animate-with-skeleton-v3) — 마법사 계열 (로드맵 승인 2026-10-17: 4직업 × 2회 15f, usage 최대 32, 재시도 0, 1단계 화염술사 A 먼저)
#  첫 프레임 = design/final/<cls>.png (키 46 기준 그림) 에서 지팡이를 지운 빈손 그림을 192칸에 2배로 (발 x FOOT_X, 땅 176).
#  관절 = skel.py MOVES_B (3등신 키 46 비율). 기준 관절(to_b(pose()))을 그림의 몸 상자에 맞춰 옮기고, 모든 프레임에 같은 이동을 준다.
#  A = 평타A 7 + 평타B 7 + 기준 1 (15f) · B = 시전 7 + 걷기 8 (15f)
#  python -I -B skelgen.py prep <cls> <A|B>   → skel/<cls>/req-<A|B>.json, first.png, staff.png(덧그릴 지팡이), fit.png(막대 인형 겹침)
#  (호출) MSYS_NO_PATHCONV=1 python -I plx.py raw <cls> skel<A|B> /animate-with-skeleton-v3 skel/<cls>/req-<A|B>.json
#  python -I -B skelgen.py post <cls> <A|B>   → skel/<cls>/<A|B>-raw/ (모델 프레임 96칸), <A|B>-wpn/ (지팡이 덧그림), 몽타주
import os, sys, json, base64, io, math
from PIL import Image, ImageDraw
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, os.path.join(ROOT, 'dev', 'sheets-common')); sys.path.insert(0, os.path.join(ROOT, 'dev', 'sheets-sword'))
import importlib.util
from skelpost import *        # 공용 후처리 (dev/sheets-common/skelpost.py)
_sp = importlib.util.spec_from_file_location('mskel', os.path.join(HERE, 'skel.py')); SK = importlib.util.module_from_spec(_sp); _sp.loader.exec_module(SK)
N, GROUND = 192, 176
DESC = {
    'pyromancer': 'small chibi young woman fire mage, 3 heads tall, very long orange ponytail streaming behind, red headband, sleeveless red top with bracers, short red skirt, boots, right hand empty',
    'mage': 'small chibi young woman apprentice wizard, 3 heads tall, big blue pointed hat bent back, long brown hair, blue tunic dress with belt, boots, right hand empty',
    'cryomancer': 'small chibi young woman ice mage, 3 heads tall, round light blue hood, white hair, white fur collar, blue cape, long white gloves, short blue skirt, white boots, right hand empty',
    'electromancer': 'small chibi young woman storm mage, 3 heads tall, spiky blonde hair, navy circlet with two light blue lightning horns, navy coat dress with gold buttons, navy stockings, boots, right hand empty, side view facing right the whole time, face always visible, never turns around',   # 2회차: 1회차가 몸을 뒤로 돌림 (로드맵 승인 2026-10-17)
    # 3차 (2026-10-17 안 A) — 뇌전술사 교훈: 끝까지 오른쪽 옆모습·얼굴 보임을 처음부터 넣는다
    'archmage': 'small chibi young woman archmage of fire, 3 heads tall, very long fiery orange-red ponytail streaming behind, small golden crown, broad golden pauldrons, long dark crimson robe open at the front, boots, right hand empty, side view facing right the whole time, face always visible, never turns around',
    'frostlord': 'small chibi young woman frost queen, 3 heads tall, spiky ice crystal crown, long straight white hair, long white cape behind her, ice-blue tunic, white gloves, ice-blue trousers, white fur boots, right hand empty, side view facing right the whole time, face always visible, never turns around',
    'thunderEmperor': 'small chibi young woman thunder empress, 3 heads tall, golden crown with two large golden horns, long white hair, navy cape with gold trim, navy coat with gold buttons, navy boots, right hand empty, side view facing right the whole time, face always visible, never turns around',
}
ACTION = {'A': 'magic staff attacks: thrust forward, then raise overhead and slam down', 'B': 'casting a spell with both hands then walking',
          'W3': 'walking forward with very long clear strides, the front knee lifting high, the back leg pushing far behind, a short knee-length white cape and long hair behind her, both legs clearly visible',
          'W2': 'walking forward with very long clear strides, the front knee lifting high, the back leg pushing far behind, the long robe or cape and long hair staying behind her so both legs in front are clearly separated',
          'W': 'walking forward with long clear strides, knees lifting, the long robe parting so both legs are clearly visible'}


# 지팡이가 굵거나 몸에 붙어 열기로 안 갈리는 기준 그림: 64칸 그림 좌표로 지팡이 영역을 직접 지정 (격자 확대본을 보고 정함)
_skin = lambda c: c[0] > 170 and c[1] > 110 and c[0] > c[2] + 30
MANUAL = {
    'cryomancer': lambda x, y, c: x >= 26,                                   # 오른쪽 얼음 지팡이 (망토 오른쪽 외곽선 = x 25)
    'mage': lambda x, y, c: x >= 22 and 19 <= y <= 38 and not _skin(c),     # 구슬 지팡이 (모자 챙 y 9~12 는 남김, 손 살색은 남김)
    'electromancer': lambda x, y, c: (x >= 22 and not _skin(c)) or (x >= 19 and y >= 37),   # 구슬 + 가는 자루 (손 살색 남김, 발치 자루 끝)
    # 3차 (2026-10-17): 지팡이가 모두 오른쪽 끝 세로줄 — 몸 오른쪽 끝(손) 바로 바깥부터
    'archmage': lambda x, y, c: x >= 31 and not _skin(c),
    'frostlord': lambda x, y, c: x >= 30,
    'thunderEmperor': lambda x, y, c: x >= 30 and not _skin(c),
}


CAP_STAFF = {'mage': 1.5, 'electromancer': 1.5, 'archmage': 1.5, 'frostlord': 1.5, 'thunderEmperor': 1.5}   # 3차도 게임 지팡이 (기준 그림 지팡이는 가늘고 몸에 붙음)      # 견습 지팡이 26칸 → 39칸 (기준 그림 쪽은 구슬 끝만 보임)


def staff_split_cls(cls, im):
    if cls not in MANUAL: return staff_split(im)
    im = im.convert('RGBA'); P = im.load(); body = Image.new('RGBA', im.size); B = body.load(); staff = set()
    for y in range(im.height):
        for x in range(im.width):
            c = P[x, y]
            if not c[3]: continue
            if MANUAL[cls](x, y, c): staff.add((x, y))
            else: B[x, y] = c
    return body, staff


def body_box(im):
    bb = im.getbbox(); return bb


def place(cls):
    """first.png (192칸, 빈손) · staff.png (지팡이만, 같은 좌표) · 기준 관절 이동량"""
    fin = Image.open(os.path.join(HERE, 'design', 'final', f'{cls}.png')).convert('RGBA')
    body, staff = staff_split_cls(cls, fin)
    W, H = fin.size
    # 2배로 192칸: 발 바닥(몸 맨 아래 줄) = 땅-1, 몸 가로 가운데(아래 1/3 의 가운데) = FOOT_X
    bb = body.getbbox(); ys = range(bb[1] + (bb[3] - bb[1]) * 2 // 3, bb[3]); P = body.load()
    xs = [x for y in ys for x in range(W) if P[x, y][3]]
    cx = (min(xs) + max(xs)) / 2
    ox, oy = round(SK.FOOT_X - cx * 2), (GROUND - 1) - (bb[3] - 1) * 2 - 1
    first = Image.new('RGBA', (N, N)); first.alpha_composite(body.resize((W * 2, H * 2), Image.NEAREST), (ox, oy))
    st = Image.new('RGBA', fin.size); S = st.load(); F = fin.load()
    for p in staff: S[p] = F[p]
    st2 = Image.new('RGBA', (N, N)); st2.alpha_composite(st.resize((W * 2, H * 2), Image.NEAREST), (ox, oy))
    return first, st2, (ox, oy), (W, H)


def fit_keys(first, staff):
    """설계 관절(to_b 기준) → 그림 좌표 변환 (x' = a·x + bx, y' = a·y + by). 그림에서 잰 기준점에 맞춘다:
    발바닥(몸 맨 아래 줄) · 목(정수리~발바닥의 37% — 3등신) · 다리 가운데 x. 첫 프레임의 앞손(RIGHT ARM)은 그림에서 지팡이를 쥔 자리.
    → (변환 함수, 첫 프레임 관절)"""
    base = SK.to_b(SK.pose())
    bb = first.getbbox(); P = first.load()
    foot_s = bb[3] - 1
    # 정수리: 몸 가운데 ±10칸 열의 가장 위 칸 (뒤로 흐르는 머리·모자 끝 제외)
    cols = range(int(SK.FOOT_X) - 10, int(SK.FOOT_X) + 12)
    top_s = min(y for x in cols for y in range(N) if 0 <= x < N and P[x, y][3])
    neck_s = top_s + 0.37 * (foot_s - top_s)
    foot_b = max(base['RIGHT LEG'][1], base['LEFT LEG'][1]); neck_b = base['NECK'][1]
    a = (foot_s - neck_s) / (foot_b - neck_b); by = foot_s - a * foot_b
    pel_b = (base['RIGHT HIP'][0] + base['LEFT HIP'][0]) / 2
    ys = range(foot_s - 6, foot_s + 1); xs = [x for y in ys for x in range(N) if P[x, y][3]]
    bx = (min(xs) + max(xs)) / 2 - a * pel_b
    T = lambda q: (round(a * q[0] + bx, 1), round(a * q[1] + by, 1))
    f0 = {k: T(v) for k, v in base.items()}
    # 앞손 = 지팡이 칸 중 몸 칸에 닿은 것들의 가운데 (쥔 손)
    S = staff.load(); grip = [(x, y) for y in range(N) for x in range(N) if S[x, y][3] and any(P[x + i, y + j][3] for i in (-1, 0, 1) for j in (-1, 0, 1) if 0 <= x + i < N and 0 <= y + j < N)]
    if grip:
        gx = sum(p[0] for p in grip) / len(grip); gy = sum(p[1] for p in grip) / len(grip)
        sh = f0['RIGHT SHOULDER']; f0['RIGHT ARM'] = (round(gx, 1), round(gy, 1)); f0['RIGHT ELBOW'] = (round((sh[0] + gx) / 2 + 2, 1), round((sh[1] + gy) / 2 + 2, 1))
    return T, f0, a


def keys_of(frames, T):
    return [SK.kp({k: T(v) for k, v in p.items()}) for p in frames]


def b64(im):
    buf = io.BytesIO(); im.save(buf, 'PNG')
    return {'type': 'base64', 'base64': base64.b64encode(buf.getvalue()).decode(), 'format': 'png'}


def walk_big(kx=1.5, lift=3, back=0):
    """걷기 과장 8f (3차 재생성, 로드맵 승인 2026-10-17): 긴 장포·망토가 다리를 가려 모델이 다리를 거의 안 움직였다 →
    보폭(골반 기준 무릎·발 x) 1.5배, 앞으로 나가는 무릎 3칸 들기, 몸(다리 밖) 위아래 ±2 (보폭 클 때 내림), 윗몸 앞기울기 +2"""
    out = []
    fr = SK.MOVES_B['walk'][:8]
    spread = [abs(p['RIGHT LEG'][0] - p['LEFT LEG'][0]) for p, a, b in fr]; lo, hi = min(spread), max(spread)
    for (p, a, b), sp in zip(fr, spread):
        q = dict(p); hx = (p['RIGHT HIP'][0] + p['LEFT HIP'][0]) / 2
        for side in ('RIGHT', 'LEFT'):
            for j in ('KNEE', 'LEG'):
                x, y = p[f'{side} {j}']; q[f'{side} {j}'] = (hx + (x - hx) * kx - (back if x < hx else 0), y)
            if p[f'{side} KNEE'][0] > hx + 1: q[f'{side} KNEE'] = (q[f'{side} KNEE'][0], q[f'{side} KNEE'][1] - lift)
        dy = 2 - 4 * (sp - lo) / max(1, hi - lo)          # 보폭 가장 클 때(디딤) +2... 아래, 가장 작을 때(지나감) -2 위
        dy = -dy
        for k in q:
            if 'KNEE' in k or 'LEG' in k: continue
            x, y = q[k]; q[k] = (x + (2 if k not in ('RIGHT HIP', 'LEFT HIP') else 0), y + dy)
        out.append((q, a, b))
    return out


def seq(part):
    M = SK.MOVES_B
    if part == 'W': return walk_big()
    if part in ('W2', 'W3'): return walk_big(1.8, 5, 3)   # W3: 빙결의 군주 망토를 무릎 위로 자른 기준 그림으로 (2026-10-17 재개)        # 걷기 다듬기 (로드맵 승인 2026-10-17): 보폭 1.8배·무릎 5칸·뒷다리 3칸 더 뒤
    if part == 'A': return M['atkA'][:7] + M['atkB'][:7] + [(SK.to_b(SK.pose()), -80, None)]
    return M['cast'][:7] + M['walk'][:8]


def prep(cls, part, seed=71):
    if cls == 'electromancer': seed = 97      # 2회차 시드
    if part == 'W2': seed = 131               # 걷기 다듬기 시드
    if part == 'W3': seed = 151
    d = os.path.join(HERE, 'skel', cls); os.makedirs(d, exist_ok=True)
    first, staff, off, sz = place(cls)
    first.save(os.path.join(d, 'first.png')); staff.save(os.path.join(d, 'staff.png'))
    T, base, scale = fit_keys(first, staff)
    fr = seq(part)
    body = {'description': DESC[cls], 'action': ACTION[part], 'direction': 'east', 'view': 'side', 'first_frame': b64(first),
            'first_frame_keypoints': SK.kp(base), 'keypoints': keys_of([p for p, a, b in fr], T), 'template_id': 'mannequin', 'seed': seed, 'no_background': True}
    json.dump(body, open(os.path.join(d, f'req-{part}.json'), 'w'), ensure_ascii=False)
    json.dump({'staff_deg': [a for p, a, b in fr], 'bowA': [b for p, a, b in fr], 'scale': scale, 'offset': off,
               'grip': [T(p['RIGHT ARM']) for p, a, b in fr]}, open(os.path.join(d, f'meta-{part}.json'), 'w'))
    # 겹침 확인: 첫 프레임 위에 기준 막대 인형
    S = 3; im = Image.new('RGBA', (N * S, N * S), (24, 26, 34, 255)); im.alpha_composite(first.resize((N * S, N * S), Image.NEAREST))
    dr = ImageDraw.Draw(im)
    for a_, b_ in SK.BONES:
        dr.line([(base[a_][0] * S, base[a_][1] * S), (base[b_][0] * S, base[b_][1] * S)], fill=(255, 120, 90) if 'RIGHT' in a_ + b_ else (90, 170, 255) if 'LEFT' in a_ + b_ else (240, 240, 240), width=3)
    for k, (x, y) in base.items(): dr.ellipse([x * S - 4, y * S - 4, x * S + 4, y * S + 4], outline=(255, 255, 0))
    im.crop((0, 40 * S, 150 * S, 185 * S)).save(os.path.join(d, 'fit.png'))
    tiles = [SK.stick({k: T(v) for k, v in p.items()}, a, S=2, staff=tuple(v * scale for v in SK.STAFF_B), head_r=15 * scale, crop=(0, 40, 192, 184)) for p, a, b in fr]
    mont = Image.new('RGBA', (tiles[0].width * len(tiles), tiles[0].height), (30, 32, 40, 255))
    for i, t in enumerate(tiles): mont.paste(t, (i * t.width, 0))
    mont.save(os.path.join(d, f'stick-{part}.png'))
    print(cls, part, 'frames', len(fr), 'offset', off, 'scale', round(scale, 2))


DARK_FILL = {'cryomancer': (24, 52, 112)}     # 망토 안쪽 검은 덩어리 → 직업색 어두운 단계 (비평 2026-10-17)


CAPE_TRIM = {'frostlord'}       # 기준 그림 망토를 무릎 위로 자름 (2026-10-17 재개) → 모델이 그린 긴 망토도 같은 길이로 (W3 는 이미 짧음)


def cape_trim(body, env, KP):
    """무릎 줄 아래에서 다리 뼈대 둘레 밖의 밝은 천(망토·머리끝) 칸을 지우고, 잘린 끝에 외곽선"""
    B = body.load(); W, H = body.size
    ky = (KP['RIGHT KNEE'][1] + KP['LEFT KNEE'][1]) / 2
    for y in range(int(ky) + 1, H):
        for x in range(W):
            c = B[x, y]
            if c[3] and (x, y) not in env and sum(c[:3]) / 3 > 90: B[x, y] = (0, 0, 0, 0)
    y = int(ky) + 1
    for x in range(W):
        if 0 <= y < H and not B[x, y][3] and B[x, y - 1][3] and sum(B[x, y - 1][:3]) / 3 > 90 and (x, y) not in env: B[x, y] = (11, 13, 20, 255)
    return body


DROP_GREY = {'frostlord'}       # 모델이 회색 철퇴 지팡이를 굵게 그림 (열기로 안 떨어짐)
BASE_FROM_FIRST = {'electromancer'}     # 평타 14번(=0번) 기준 자세를 기준 그림으로 (2회차에서 모델이 14번을 뒤돌린 모양으로 그림)


def post(cls, part):
    """모델 프레임 → 96칸: 줄이기 → 모델이 그린 지팡이·이펙트 지우기(가는 선·떨어진 덩어리, staff_split) → 원래 지팡이 덧그리기(설계 손 점·각도)"""
    from wpn import WeaponSprite, overlay
    d = os.path.join(HERE, 'skel', cls); meta = json.load(open(os.path.join(d, f'meta-{part}.json')))
    first = down2(Image.open(os.path.join(d, 'first.png'))); stf = keep_big(down2(Image.open(os.path.join(d, 'staff.png'))))
    full = first.copy(); full.alpha_composite(stf)
    wcol = full.copy(); W_ = wcol.load(); S_ = stf.load()
    for y in range(stf.height):
        for x in range(stf.width):
            if S_[x, y][3]: W_[x, y] = (255, 0, 255, 255)
    F_ = first.load()
    glove = [(x, y) for y in range(stf.height) for x in range(stf.width) if F_[x, y][3] and any(0 <= x + i < stf.width and 0 <= y + j < stf.height and S_[x + i, y + j][3] for i in (-1, 0, 1) for j in (-1, 0, 1))]
    ws = WeaponSprite.from_capture(full, wcol, glove)
    if cls in CAP_STAFF:      # 기준 그림 지팡이가 너무 작은 직업: 게임 지팡이 캡처를 키 46 비율로 키워 쓴다
        sys.path.insert(0, HERE); import mannequin as MQ
        g0 = MQ.staff_sprite(cls, MQ.parts(cls)[1]); k = CAP_STAFF[cls]
        ws = WeaponSprite(g0.img.resize((round(g0.img.width * k), round(g0.img.height * k)), Image.NEAREST), (g0.grip[0] * k, g0.grip[1] * k), g0.ang)
    raw_d, out_d = os.path.join(d, f'{part}-raw'), os.path.join(d, f'{part}-wpn'); os.makedirs(raw_d, exist_ok=True); os.makedirs(out_d, exist_ok=True)
    outs = []; log = []; req = json.load(open(os.path.join(d, f'req-{part}.json')))
    fb, _ = staff_split_cls(cls, Image.open(os.path.join(HERE, 'design', 'final', f'{cls}.png')))
    PAL = {c[:3] for c in fb.get_flattened_data() if c[3]}          # 몸 팔레트 = 지팡이를 뺀 기준 그림 색 (모델 지팡이의 회색·노랑은 빠진다)
    WI = ws.img.load()
    ltip = max(((x - ws.grip[0]) * math.cos(ws.ang) + (y - ws.grip[1]) * math.sin(ws.ang)) for y in range(ws.img.height) for x in range(ws.img.width) if WI[x, y][3])
    n = len(meta['staff_deg']); order = list(range(7, n)) + list(range(7)) if part == 'B' else list(range(n))
    res = {}; tips = {}; poses = {}; tip_off = None
    body_d = os.path.join(d, f'{part}-body'); os.makedirs(body_d, exist_ok=True)     # 걷기 지팡이 끝 높이 (몸 정수리 기준) — 첫 걷기 프레임 값으로 고정 (비평: 걷는 동안 불꽃이 얼굴 높이로 출렁임)
    for i in order:
        im = down2(Image.open(os.path.join(HERE, 'work', cls, f'skel{part}-{i}.png')))
        im.save(os.path.join(raw_d, f'{i}.png'))
        pal = PAL
        env, KP = envelope(req['keypoints'][i], 96)
        body = snap(keep_big(body_of(pal_filter(im, pal, 40), env, KP), 0.05), pal)
        if cls in DARK_FILL: body = dark_fill(body, DARK_FILL[cls])
        body = drop_fire_blobs(body, env)
        if cls in DROP_GREY: body = drop_grey_far(body, env)
        if cls in CAPE_TRIM and part != 'W3': body = cape_trim(body, env, KP)
        g = KP['RIGHT ARM']; a = math.radians(meta['staff_deg'][i])        # 손 = 설계 관절 손 점 (모델은 관절을 따른다)
        g = snap_hand(body, g, KP['RIGHT ELBOW'])                          # 모델 손이 설계보다 짧거나 어긋나면 실제 팔 끝 칸으로
        ms = model_staff(im, body, g, meta['staff_deg'][i])
        if ms and math.cos(math.radians(ms[1] - meta["staff_deg"][i])) < 0.8: ms = None     # 37° 넘게 어긋나면 이펙트를 잘못 잰 것 → 설계 각도
        walk = (part == 'B' and i >= 7) or part in ('W', 'W2', 'W3')
        if ms and not walk: a = math.radians(ms[1])                         # 각도만 모델 지팡이 축 (팔 자세와 맞게). 걷기는 설계 각도 고정 (비평: 걷기 중 지팡이 튐)
        if part == 'A' and i == 0: a = math.radians(meta['staff_deg'][-1])  # 14→0 이음새 (비평 2026-10-17)
        if walk or (part == 'B' and i <= 1):
            top = body.getbbox()[1]; ty = g[1] + ltip * math.sin(a)
            if tip_off is None: tip_off = ty - top
            elif abs(math.sin(a)) > 0.5:      # 손은 그대로, 쥔 자리만 자루 따라 밀어 끝 높이를 맞춘다
                dd = (top + tip_off - ty) / math.sin(a); g = (g[0] + dd * math.cos(a), g[1] + dd * math.sin(a))
        # 손 둘레의 뼈대 밖 불꽃색 = 모델 불덩이 잔재 (손 아래·뒤쪽 머리카락은 남긴다)
        Bq = body.load()
        for hk in ('RIGHT ARM', 'LEFT ARM'):
            hx, hy = KP[hk]
            for y in range(int(hy - 7), int(hy + 8)):
                for x in range(int(hx - 7), int(hx + 8)):
                    if 0 <= x < 96 and 0 <= y < 96 and (x, y) not in env and (x >= hx - 1 or y < hy - 1):
                        c = Bq[x, y]
                        if c[3] and c[0] > 200 and c[1] > 80 and c[2] < 120 and (x - hx) ** 2 + (y - hy) ** 2 <= 49: Bq[x, y] = (0, 0, 0, 0)
        log.append((i, ms and (round(ms[0][0]), round(ms[0][1]), round(ms[1])), round(meta['staff_deg'][i])))
        t = (g[0] + 20 * math.cos(a), g[1] + 20 * math.sin(a))
        B = body.load(); front = [(x, y) for y in range(body.height) for x in range(body.width) if B[x, y][3] and (x - g[0]) ** 2 + (y - g[1]) ** 2 <= 4]
        o = overlay(body, set(), g, t, ws, front=front)
        O = o.load(); B = body.load(); foot = body.getbbox()[3] - 1 if body.getbbox() else 88
        for y in range(int(foot) + 1, o.height):        # 지팡이가 땅(발바닥 선) 아래로 뚫지 않게
            for x in range(o.width):
                if O[x, y][3] and not B[x, y][3]: O[x, y] = (0, 0, 0, 0)
        o.save(os.path.join(out_d, f'{i}.png')); res[i] = (im, body, o)
        poses[i] = {'g': list(g), 'a': a, 'front': front}; body.save(os.path.join(body_d, f'{i}.png'))     # 3차 편집(tier3.py)이 몸·손·각도를 다시 쓴다
        tips[i] = [round(g[0] + ltip * math.cos(a)), round(g[1] + ltip * math.sin(a))]     # 지팡이 끝 (시트 hand 점 = 평타가 나가는 자리)
    outs = [res[i] for i in range(n)]
    if part == 'A' and cls in BASE_FROM_FIRST:
        im14, _, _ = res[n - 1]; bd = first.copy()
        bb = bd.getbbox(); B = bd.load(); KPb = {k['label']: (k['x'] * 96, k['y'] * 96) for k in req['first_frame_keypoints']} if 'first_frame_keypoints' in req else None
        g = snap_hand(bd, KPb['RIGHT ARM'], KPb['RIGHT ELBOW']) if KPb else (bb[2] - 2, (bb[1] + bb[3]) / 2)
        a = math.radians(meta['staff_deg'][-1]); t = (g[0] + 20 * math.cos(a), g[1] + 20 * math.sin(a))
        front = [(x, y) for y in range(96) for x in range(96) if B[x, y][3] and (x - g[0]) ** 2 + (y - g[1]) ** 2 <= 4]
        o = overlay(bd, set(), g, t, ws, front=front); o.save(os.path.join(out_d, f'{n - 1}.png')); outs[n - 1] = (im14, bd, o)
        poses[n - 1] = {'g': list(g), 'a': a, 'front': front}; bd.save(os.path.join(body_d, f'{n - 1}.png'))
        tips[n - 1] = [round(g[0] + ltip * math.cos(a)), round(g[1] + ltip * math.sin(a))]
    if part == 'A':        # 0번 = 14번 기준 자세 (반복 재생 이음새에서 지팡이가 튀지 않게, 비평 2026-10-17)
        outs[0] = (outs[0][0], outs[-1][1], outs[-1][2]); outs[-1][2].save(os.path.join(out_d, '0.png'))
        tips[0] = tips[n - 1]; poses[0] = poses[n - 1]; outs[-1][1].save(os.path.join(body_d, '0.png'))
    json.dump([tips[i] for i in range(n)], open(os.path.join(d, f'{part}-tips.json'), 'w'))
    json.dump([poses[i] for i in range(n)], open(os.path.join(d, f'{part}-pose.json'), 'w'))
    S = 3; W = 96 * S
    mont = Image.new('RGBA', (W * len(outs), W * 3), (24, 26, 34, 255))
    for i, row in enumerate(outs):
        for r, im in enumerate(row): mont.alpha_composite(im.resize((W, W), Image.NEAREST), (i * W, r * W))
    mont.save(os.path.join(d, f'post-{part}.png')); print('post', cls, part, len(outs)); [print(*r) for r in log]


if __name__ == '__main__':
    if sys.argv[1] == 'post': post(sys.argv[2], sys.argv[3]); sys.exit(0)
    cmd, cls, part = sys.argv[1], sys.argv[2], sys.argv[3]
    if cmd == 'prep': prep(cls, part)
