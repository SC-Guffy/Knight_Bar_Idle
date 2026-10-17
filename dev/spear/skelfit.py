# 창 계열 관절 애니 요청 준비 (animate-with-skeleton-v3, 192칸) — 레인저 dev/bowsheets/skelgen.py 방식을 창 계열로.
#  첫 프레임 = pixen 중립 대기(무기 없음·팔 내림, 로드맵 교훈: 무기를 든 첫 프레임은 팔 관절을 안 따름) → skel/first-<cls>.png (발 96,176)
#  동작 = skel.py 설계 프레임(to_b46)의 뼈 '각도'를 쓰고, 뼈 '길이'는 첫 프레임 그림에서 눈으로 읽은 관절(BODY_KP)로.
#   몸통·팔: 각도 그대로(FK), 다리: 발 목표(땅 y=175)로 무릎 역산(IK, 무릎은 앞쪽) — 첫 프레임 뼈 길이로 맞춰도 발이 뜨거나 묻히지 않게.
#   python -I -B skelfit.py <cls> <act> [seed]  → skel/req-<cls>-<act>.json, skel/wpn-<cls>-<act>.json(프레임별 창 각도·손), skel/stick-fit-<cls>-<act>.png
import os, sys, json, math, base64, io
from PIL import Image, ImageDraw
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import skel as SK0
SK = os.path.join(HERE, 'skel'); N = 192; GROUND = 175

# first-<cls>-grid.png (원점 (68, 96), 1칸 = 5px, 격자 4칸) 에서 읽은 관절. RIGHT = 앞(보는 쪽) 팔·다리, LEFT = 뒤
BODY_KP = {
    'lancer': {'NECK': (100, 124), 'NOSE': (114, 118), 'RIGHT EYE': (108, 116), 'LEFT EYE': (104, 116), 'RIGHT EAR': (100, 116), 'LEFT EAR': (98, 117),
               'RIGHT SHOULDER': (110, 128), 'RIGHT ELBOW': (118, 140), 'RIGHT ARM': (120, 151),
               'LEFT SHOULDER': (92, 128), 'LEFT ELBOW': (90, 140), 'LEFT ARM': (91, 152),
               'RIGHT HIP': (106, 148), 'RIGHT KNEE': (110, 162), 'RIGHT LEG': (112, 175),
               'LEFT HIP': (96, 148), 'LEFT KNEE': (98, 162), 'LEFT LEG': (97, 175)},
    'dragoon': {'NECK': (96, 118), 'NOSE': (101, 110), 'RIGHT EYE': (98, 109), 'LEFT EYE': (95, 109), 'RIGHT EAR': (92, 109), 'LEFT EAR': (90, 110),
                'RIGHT SHOULDER': (106, 122), 'RIGHT ELBOW': (108, 134), 'RIGHT ARM': (110, 146),
                'LEFT SHOULDER': (86, 122), 'LEFT ELBOW': (84, 134), 'LEFT ARM': (82, 146),
                'RIGHT HIP': (101, 142), 'RIGHT KNEE': (103, 159), 'RIGHT LEG': (104, 175),
                'LEFT HIP': (91, 142), 'LEFT KNEE': (92, 159), 'LEFT LEG': (91, 175)},
    'halberdier': {'NECK': (103, 119), 'NOSE': (114, 111), 'RIGHT EYE': (110, 110), 'LEFT EYE': (104, 110), 'RIGHT EAR': (98, 110), 'LEFT EAR': (96, 111),
                   'RIGHT SHOULDER': (115, 124), 'RIGHT ELBOW': (119, 134), 'RIGHT ARM': (121, 145),
                   'LEFT SHOULDER': (90, 124), 'LEFT ELBOW': (86, 136), 'LEFT ARM': (87, 148),
                   'RIGHT HIP': (108, 146), 'RIGHT KNEE': (110, 161), 'RIGHT LEG': (111, 175),
                   'LEFT HIP': (98, 146), 'LEFT KNEE': (98, 161), 'LEFT LEG': (97, 175)},
    'cavalier': {'NECK': (100, 123), 'NOSE': (111, 116), 'RIGHT EYE': (106, 114), 'LEFT EYE': (102, 114), 'RIGHT EAR': (96, 114), 'LEFT EAR': (94, 115),
                 'RIGHT SHOULDER': (106, 128), 'RIGHT ELBOW': (108, 138), 'RIGHT ARM': (110, 149),
                 'LEFT SHOULDER': (90, 128), 'LEFT ELBOW': (88, 139), 'LEFT ARM': (88, 150),
                 'RIGHT HIP': (104, 150), 'RIGHT KNEE': (103, 163), 'RIGHT LEG': (104, 175),
                 'LEFT HIP': (95, 150), 'LEFT KNEE': (95, 163), 'LEFT LEG': (94, 175)},
    'dragonlord': {'NECK': (104, 115), 'NOSE': (115, 108), 'RIGHT EYE': (110, 107), 'LEFT EYE': (106, 107), 'RIGHT EAR': (101, 107), 'LEFT EAR': (99, 108),
                   'RIGHT SHOULDER': (115, 120), 'RIGHT ELBOW': (119, 133), 'RIGHT ARM': (121, 145),
                   'LEFT SHOULDER': (94, 120), 'LEFT ELBOW': (93, 133), 'LEFT ARM': (95, 145),
                   'RIGHT HIP': (110, 145), 'RIGHT KNEE': (112, 160), 'RIGHT LEG': (113, 175),
                   'LEFT HIP': (100, 145), 'LEFT KNEE': (101, 160), 'LEFT LEG': (100, 175)},
    'warlord': {'NECK': (104, 120), 'NOSE': (114, 110), 'RIGHT EYE': (109, 109), 'LEFT EYE': (104, 109), 'RIGHT EAR': (99, 109), 'LEFT EAR': (97, 110),
                'RIGHT SHOULDER': (115, 124), 'RIGHT ELBOW': (117, 132), 'RIGHT ARM': (118, 142),
                'LEFT SHOULDER': (91, 124), 'LEFT ELBOW': (88, 133), 'LEFT ARM': (89, 143),
                'RIGHT HIP': (110, 147), 'RIGHT KNEE': (111, 162), 'RIGHT LEG': (112, 175),
                'LEFT HIP': (98, 147), 'LEFT KNEE': (99, 162), 'LEFT LEG': (98, 175)},
    # 천마장군: 몸을 틀어 방패 팔(뒤, LEFT)이 오른쪽 앞에 보이고 맨손(앞, RIGHT)은 왼쪽에 있다
    'skyGeneral': {'NECK': (100, 118), 'NOSE': (111, 108), 'RIGHT EYE': (106, 107), 'LEFT EYE': (102, 107), 'RIGHT EAR': (97, 107), 'LEFT EAR': (95, 108),
                   'RIGHT SHOULDER': (110, 124), 'RIGHT ELBOW': (82, 135), 'RIGHT ARM': (84, 147),
                   'LEFT SHOULDER': (88, 124), 'LEFT ELBOW': (116, 134), 'LEFT ARM': (118, 145),
                   'RIGHT HIP': (104, 148), 'RIGHT KNEE': (104, 162), 'RIGHT LEG': (105, 175),
                   'LEFT HIP': (95, 148), 'LEFT KNEE': (94, 162), 'LEFT LEG': (93, 175)},
}
DESC = {'lancer': 'young chibi lancer knight, open-faced steel helmet with a small green plume, green tabard over silver plate armor, round pauldrons, '
                  'short green cape, empty hands (the spear is drawn later)',
        'dragoon': 'young chibi dragoon knight, dragon-shaped helmet with a snout brim over the forehead and two backward horns, human face visible, '
                   'plate armor, dark bat-wing shaped cloth cape, empty hands (the spear is drawn later)',
        'halberdier': 'young chibi heavy halberdier knight, steel bucket helmet with a horizontal eye slit, big square steel pauldrons, steel plate armor, '
                      'orange cloth tabard over the thighs, thick belt, light tan leather gloves, empty hands, no weapon, no polearm, no effects',
        'dragonlord': 'young chibi dragon lord knight king, golden dragon crown helmet with four backward horns, human face visible, lavender and gold plate armor, '
                      'large dark purple double bat-wing shaped cape, empty hands (the spear is drawn later)',
        'warlord': 'young chibi heavy warlord knight, iron helmet with two bull horns and a half mask, spiked pauldrons, grey iron plate armor, blood red cape, '
                   'light tan leather gloves, empty hands (the halberd is drawn later)',
        'skyGeneral': 'young chibi sky general knight, white and gold winged helmet with a small golden halo, white and gold plate armor, gray cape, '
                      'large round gold-rimmed shield on the far arm, light tan leather glove, empty hand (the lance is drawn later)',
        'cavalier': 'young chibi cavalry lancer knight, silver crested helmet with a tall red feather plume, royal blue surcoat and short blue cape over '
                    'silver plate armor, light tan leather gloves, empty hands (the lance is drawn later)'}
ACTION = {'thrust': 'lunge forward and thrust a spear with both hands, then recover', 'walk': 'walk cycle holding a long polearm upright',
          'slam': 'raise a spear overhead with both hands and slam it down in front', 'idle': 'stand ready holding a spear upright, breathing',
          'sweep': 'swing a halberd in a wide horizontal sweep', 'chop': 'raise a halberd overhead and chop down',
          'sweepE': 'swing both empty hands together in a wide horizontal sweeping motion with the whole body, empty hands, no weapon, no polearm, no effects',
          'chopupE': 'raise both empty hands together straight up overhead, pause at the top, then bring them down hard toward the ground in front, empty hands, no weapon, no polearm, no effects',
          'chopup': 'raise a halberd straight up overhead, pause at the top, then chop it down hard into the ground in front'}

d = math.dist
mid = lambda a, b: ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2)
ang = lambda a, b: math.atan2(b[1] - a[1], b[0] - a[0])
at = lambda p, a, L: (p[0] + math.cos(a) * L, p[1] + math.sin(a) * L)


def ik_knee(hip, foot, L1, L2):
    """무릎이 앞(+x)으로 꺾이는 해"""
    D = max(1e-6, min(d(hip, foot), L1 + L2 - 1e-3)); base = ang(hip, foot)
    a = math.acos(max(-1, min(1, (L1 * L1 + D * D - L2 * L2) / (2 * L1 * D))))
    k1, k2 = at(hip, base - a, L1), at(hip, base + a, L1)
    return k1 if k1[0] >= k2[0] else k2


def fit(cls, frames):
    kp = BODY_KP[cls]
    L = {'UA': (d(kp['RIGHT SHOULDER'], kp['RIGHT ELBOW']) + d(kp['LEFT SHOULDER'], kp['LEFT ELBOW'])) / 2,
         'FA': (d(kp['RIGHT ELBOW'], kp['RIGHT ARM']) + d(kp['LEFT ELBOW'], kp['LEFT ARM'])) / 2,
         'TH': (d(kp['RIGHT HIP'], kp['RIGHT KNEE']) + d(kp['LEFT HIP'], kp['LEFT KNEE'])) / 2,
         'SH': (d(kp['RIGHT KNEE'], kp['RIGHT LEG']) + d(kp['LEFT KNEE'], kp['LEFT LEG'])) / 2}
    hm0 = mid(kp['RIGHT HIP'], kp['LEFT HIP']); torso0 = d(hm0, kp['NECK'])
    ref = SK0.to_b46(SK0.pose()); href = mid(ref['RIGHT HIP'], ref['LEFT HIP'])
    s = torso0 / d(href, ref['NECK'])                              # 설계 → 그림 크기 비
    off = {k: (kp[k][0] - kp['NECK'][0], kp[k][1] - kp['NECK'][1]) for k in ('NOSE', 'RIGHT EYE', 'LEFT EYE', 'RIGHT EAR', 'LEFT EAR', 'RIGHT SHOULDER', 'LEFT SHOULDER')}
    hoff = {k: (kp[k][0] - hm0[0], kp[k][1] - hm0[1]) for k in ('RIGHT HIP', 'LEFT HIP')}
    out = []
    for p in frames:
        p = SK0.to_b46(p); hm = mid(p['RIGHT HIP'], p['LEFT HIP'])
        R = (hm0[0] + (hm[0] - href[0]) * s, hm0[1] + (hm[1] - href[1]) * s)
        q = {'NECK': at(R, ang(hm, p['NECK']), torso0)}
        for k, (ox, oy) in off.items(): q[k] = (q['NECK'][0] + ox, q['NECK'][1] + oy)
        for side in ('RIGHT', 'LEFT'):
            sh = q[f'{side} SHOULDER']
            q[f'{side} ELBOW'] = at(sh, ang(p[f'{side} SHOULDER'], p[f'{side} ELBOW']), L['UA'])
            q[f'{side} ARM'] = at(q[f'{side} ELBOW'], ang(p[f'{side} ELBOW'], p[f'{side} ARM']), L['FA'])
            q[f'{side} HIP'] = (R[0] + hoff[f'{side} HIP'][0], R[1] + hoff[f'{side} HIP'][1])
            foot = (kp[f'{side} LEG'][0] + (p[f'{side} LEG'][0] - ref[f'{side} LEG'][0]) * s, GROUND)
            q[f'{side} KNEE'] = ik_knee(q[f'{side} HIP'], foot, L['TH'], L['SH'])
            q[f'{side} LEG'] = at(q[f'{side} KNEE'], ang(q[f'{side} KNEE'], foot), L['SH'])
        out.append({k: (round(v[0], 2), round(v[1], 2)) for k, v in q.items()})
    return out, L, s


def pick(act, n):
    """동작 act 의 프레임 n 장 (8f → 7f 면 고르게 하나 뺀다)"""
    fr = SK0.ACTIONS[act]; m = len(fr)
    return [fr[round(i * (m - 1) / (n - 1))] for i in range(n)] if n < m else list(fr)


def req(cls, act, seed=7):
    """act = 'thrust' 처럼 동작 하나, 또는 'slam8+idle4' 처럼 묶음(동작이름+프레임수) — 한 호출에 이어 붙인다 (15f = usage 4)"""
    parts = [(a.rstrip('0123456789'), int(a[len(a.rstrip('0123456789')):] or len(SK0.ACTIONS[a]))) for a in act.split('+')]
    seq = [(fr, name) for name, n in parts for fr in pick(name, n)]
    acts = [name for _, name in seq]; SEQ = [fr for fr, _ in seq]
    frames = [p for p, _ in SEQ]
    fit_frames, L, s = fit(cls, frames)
    f = Image.open(os.path.join(SK, f'first-{cls}.png')).convert('RGBA'); buf = io.BytesIO(); f.save(buf, 'PNG')
    body = {'description': DESC[cls], 'action': ', then '.join(ACTION[n] for n, _ in parts), 'direction': 'east', 'view': 'side',
            'first_frame': {'type': 'base64', 'base64': base64.b64encode(buf.getvalue()).decode(), 'format': 'png'},
            'first_frame_keypoints': SK0.kp(BODY_KP[cls]), 'keypoints': [SK0.kp(q) for q in fit_frames],
            'template_id': 'mannequin', 'seed': seed, 'no_background': True}
    json.dump(body, open(os.path.join(SK, f'req-{cls}-{act}.json'), 'w', encoding='utf-8'), ensure_ascii=False)
    wp = [{'ang': round(math.degrees(ang(q['LEFT ARM'], q['RIGHT ARM']))) if a is None else a, 'front': q['RIGHT ARM'], 'back': q['LEFT ARM']}
          for q, (_, a) in zip(fit_frames, SEQ)]
    for w, n, q in zip(wp, acts, fit_frames): w['act'] = n; w['kp'] = q        # 관절 전체 (anim_post 몸 영역용)
    json.dump(wp, open(os.path.join(SK, f'wpn-{cls}-{act}.json'), 'w', encoding='utf-8'))
    # 확인 그림: 첫 프레임 + 읽은 관절, 그다음 맞춘 프레임 막대 인형 (흐린 회색 = 첫 프레임)
    S = 3; tiles = []
    for i, q in enumerate([BODY_KP[cls]] + fit_frames):
        t = Image.new('RGBA', (N * S, N * S), (20, 22, 30, 255))
        if i == 0: t.alpha_composite(f.resize((N * S, N * S), Image.NEAREST))
        dr = ImageDraw.Draw(t)
        dr.line([(0, (GROUND + 1) * S), (N * S, (GROUND + 1) * S)], fill=(90, 90, 100), width=1)
        if i:
            for a, b in SK0.BONES: dr.line([(BODY_KP[cls][a][0] * S, BODY_KP[cls][a][1] * S), (BODY_KP[cls][b][0] * S, BODY_KP[cls][b][1] * S)], fill=(70, 72, 84), width=2)
            w = wp[i - 1]; a_ = math.radians(w['ang']); g = w['front']
            dr.line([((g[0] - math.cos(a_) * 20) * S, (g[1] - math.sin(a_) * 20) * S), ((g[0] + math.cos(a_) * 40) * S, (g[1] + math.sin(a_) * 40) * S)], fill=(200, 150, 80), width=3)
        for a, b in SK0.BONES:
            col = (255, 220, 90) if 'RIGHT' in a + b else (120, 200, 255)
            dr.line([(q[a][0] * S, q[a][1] * S), (q[b][0] * S, q[b][1] * S)], fill=col, width=3)
        tiles.append(t.crop((50 * S, 90 * S, 170 * S, 184 * S)))
    W_, H_ = tiles[0].size; m = Image.new('RGBA', ((W_ + 6) * len(tiles), H_), (40, 42, 52, 255))
    for i, t in enumerate(tiles): m.paste(t, (i * (W_ + 6), 0))
    m.save(os.path.join(SK, f'stick-fit-{cls}-{act}.png'))
    return {k: round(v, 1) for k, v in L.items()}, round(s, 3)


def first(cls, src=None):
    """pixen 중립 대기 work/<cls>/neutral-0.png → 192칸 첫 프레임(발 96,176) + 관절 읽기 격자 skel/first-<cls>-grid.png (원점 (68, 96), 1칸 = 5px, 격자 4칸)"""
    im = Image.open(src or os.path.join(HERE, 'work', cls, 'neutral-0.png')).convert('RGBA'); im = im.crop(im.getbbox()); P = im.load()
    row = [x for x in range(im.width) if P[x, im.height - 1][3]]; fx = (min(row) + max(row)) // 2
    c = Image.new('RGBA', (96, 96)); c.alpha_composite(im, (48 - fx, 88 - (im.height - 1)))
    f = c.resize((N, N), Image.NEAREST); f.save(os.path.join(SK, f'first-{cls}.png'))
    S = 5; g = Image.new('RGBA', (N * S, N * S), (30, 32, 40, 255)); g.alpha_composite(f.resize((N * S, N * S), Image.NEAREST)); d = ImageDraw.Draw(g)
    for v in range(0, N, 4):
        al = 90 if v % 16 == 0 else (50 if v % 8 == 0 else 22)
        d.line([(v * S, 0), (v * S, N * S)], fill=(255, 255, 255, al)); d.line([(0, v * S), (N * S, v * S)], fill=(255, 255, 255, al))
        if v % 8 == 0: d.text((v * S + 2, 100 * S), str(v), fill=(255, 220, 90)); d.text((70 * S, v * S + 1), str(v), fill=(255, 220, 90))
    g.crop((68 * S, 96 * S, 128 * S, 180 * S)).save(os.path.join(SK, f'first-{cls}-grid.png'))


if __name__ == '__main__':
    if sys.argv[1] == 'first': first(sys.argv[2]); print('ok')
    else: print(req(sys.argv[1], sys.argv[2], int(sys.argv[3]) if len(sys.argv) > 3 else 7))
