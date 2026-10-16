# 관절 지정 애니 요청 준비 (animate-with-skeleton-v3, 192칸): 정리본 기준 그림 → 무기 지우기 → 96칸 발 (48, 88) → 2배 = 192칸 첫 프레임
#  + 관절 시퀀스(skel.py)를 첫 프레임 그림의 실제 관절(눈으로 읽은 BODY_KP)에 맞춰 옮긴 요청 본문 → skel/req-<cls>-<act>.json
#   C:\AI\ComfyUI\.venv\Scripts\python.exe -I -B dev/bowsheets/skelgen.py first <cls>        → skel/first-<cls>.png (192), skel/first-<cls>-grid.png (관절 읽기용 격자)
#   ... skelgen.py req <cls> <act(walk|shoot|sky)> [seed]                                     → skel/req-<cls>-<act>.json, skel/stick-fit-<cls>-<act>.png
import os, sys, json, math
from PIL import Image, ImageDraw
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
SK = os.path.join(HERE, 'skel'); REF = os.path.join(HERE, 'design', 'ref')
N = 192


def thin_off(im, win=2, need=11):
    """1~2칸 두께 선(활대·시위·화살) 지우기: (2·win+1)² 창 안 칠한 칸이 need 개 미만이면 지운다. 몸은 두꺼워 남는다. 그다음 가장 큰 덩어리에 붙은 것만"""
    P = im.load(); W, H = im.size; o = im.copy(); O = o.load()
    for y in range(H):
        for x in range(W):
            if not P[x, y][3]: continue
            n = sum(1 for a in range(-win, win + 1) for b in range(-win, win + 1) if 0 <= x + a < W and 0 <= y + b < H and P[x + a, y + b][3] >= 128)
            if n < need: O[x, y] = (0, 0, 0, 0)
    pts = {(x, y) for y in range(H) for x in range(W) if O[x, y][3]}; comps = []
    while pts:
        st = [pts.pop()]; comp = {st[0]}
        while st:
            x, y = st.pop()
            for a in (-1, 0, 1):
                for b in (-1, 0, 1):
                    q = (x + a, y + b)
                    if q in pts: pts.discard(q); comp.add(q); st.append(q)
        comps.append(comp)
    keep = max(comps, key=len)
    for c in comps:
        if c is not keep and len(c) < 15:
            for p in c: O[p] = (0, 0, 0, 0)
    return o


def first(cls, nowpn=True):
    im = Image.open(os.path.join(REF, f'{cls}-clean.png')).convert('RGBA')
    if nowpn: im = thin_off(im)
    im = im.crop(im.getbbox()); P = im.load()
    row = [x for x in range(im.width) if P[x, im.height - 1][3]]; fx = (min(row) + max(row)) // 2 if row else im.width // 2
    c96 = Image.new('RGBA', (96, 96)); c96.alpha_composite(im, (48 - fx, 88 - (im.height - 1)))
    f = c96.resize((N, N), Image.NEAREST); f.save(os.path.join(SK, f'first-{cls}.png'))
    S = 4; g = Image.new('RGBA', (N * S, N * S), (30, 32, 40, 255)); g.alpha_composite(f.resize((N * S, N * S), Image.NEAREST)); d = ImageDraw.Draw(g)
    for v in range(0, N, 8):
        d.line([(v * S, 0), (v * S, N * S)], fill=(255, 255, 255, 40 if v % 16 else 90)); d.line([(0, v * S), (N * S, v * S)], fill=(255, 255, 255, 40 if v % 16 else 90))
        if v % 16 == 0: d.text((v * S + 2, 2), str(v), fill=(255, 220, 90)); d.text((2, v * S + 2), str(v), fill=(255, 220, 90))
    g.crop((40 * S, 60 * S, 160 * S, 184 * S)).save(os.path.join(SK, f'first-{cls}-grid.png'))
    return f


# 첫 프레임 그림에서 눈으로 읽은 관절 (192칸 좌표, first-<cls>-grid.png: 격자 8칸, 그림 원점 = (40, 60), 1칸 = 4px).
#  팔 역할은 skel.py 와 같다 — 활: LEFT = 앞으로 뻗은 활 든 팔, RIGHT = 시위 당기는 손(가까운 쪽)
BODY_KP = {
    'marksman': {'NECK': (96, 111), 'NOSE': (106, 102.5), 'RIGHT EYE': (101, 99), 'LEFT EYE': (97, 99.5), 'RIGHT EAR': (93, 100), 'LEFT EAR': (90, 101),
                 'LEFT SHOULDER': (107.5, 113.75), 'LEFT ELBOW': (116, 115.5), 'LEFT ARM': (125, 117),
                 'RIGHT SHOULDER': (90, 113.75), 'RIGHT ELBOW': (91.25, 121.25), 'RIGHT ARM': (100, 120),
                 'RIGHT HIP': (103.75, 135), 'RIGHT KNEE': (106.25, 153.75), 'RIGHT LEG': (108.75, 173.75),
                 'LEFT HIP': (91.25, 135), 'LEFT KNEE': (88.75, 153.75), 'LEFT LEG': (83.75, 173.75)},
}
ACT = {'walk': 'bow-walk', 'shoot': 'bow-shoot', 'sky': 'bow-sky'}
ACT_X = {'walk': 'xbow-walk', 'shoot': 'xbow-shoot', 'sky': 'xbow-sky'}
DESC = {
    'marksman': 'young chibi sniper archer, black hair tied back, yellow goggles on the forehead, short teal high-collared jacket with a belt, long red scarf fluttering behind, dark trousers and tall boots, hands empty (the bow is drawn later)',
}
ACTION = {'walk': 'walk cycle', 'shoot': 'draw a bowstring back to the ear and release', 'sky': 'aim upward and shoot an arrow into the sky'}


def fitted(cls):
    """skel.py 를 이 그림의 뼈 길이로 다시 계산한 모듈 (몸통·허벅지·정강이·위팔·아래팔·어깨 간격·머리 관절은 BODY_KP 에서)"""
    kp = BODY_KP[cls]; d = lambda a, b: math.dist(kp[a], kp[b])
    mid = lambda a, b: ((kp[a][0] + kp[b][0]) / 2, (kp[a][1] + kp[b][1]) / 2)
    hipm = mid('RIGHT HIP', 'LEFT HIP')
    L = {'TORSO': math.dist(kp['NECK'], hipm), 'TH': (d('RIGHT HIP', 'RIGHT KNEE') + d('LEFT HIP', 'LEFT KNEE')) / 2,
         'SH': (d('RIGHT KNEE', 'RIGHT LEG') + d('LEFT KNEE', 'LEFT LEG')) / 2,
         'UA': (d('RIGHT SHOULDER', 'RIGHT ELBOW') + d('LEFT SHOULDER', 'LEFT ELBOW')) / 2, 'FA': (d('RIGHT ELBOW', 'RIGHT ARM') + d('LEFT ELBOW', 'LEFT ARM')) / 2}
    KB = (kp['LEFT SHOULDER'][0] - kp['RIGHT SHOULDER'][0]) / 18          # turn=1 일 때 어깨 간격 = (10 + 8) * KB
    head = {k: (kp[k][0] - kp['NECK'][0], kp[k][1] - kp['NECK'][1]) for k in ('NOSE', 'RIGHT EYE', 'LEFT EYE', 'RIGHT EAR', 'LEFT EAR')}
    src = open(os.path.join(HERE, 'skel.py'), encoding='utf-8').read().split("if __name__ == '__main__':")[0]
    src = src.replace("UA, FA, TH, SH, TORSO = 11, 11, 12, 12, 30", f"UA, FA, TH, SH, TORSO = {L['UA']:.2f}, {L['FA']:.2f}, {L['TH']:.2f}, {L['SH']:.2f}, {L['TORSO']:.2f}")
    src = src.replace("KB = 1.3 ", f"KB = {KB:.3f} ")
    src = src.replace("def pose(x=97,", f"def pose(x={hipm[0]:.1f},")
    ns = {'__file__': os.path.join(HERE, 'skel.py'), '__name__': 'skel_fit'}; exec(src, ns)
    ns['HEAD'].clear(); ns['HEAD'].update(head)
    # 머리 관절을 바꿨으니 SEQ 를 다시 계산 (pose 가 HEAD 를 쓴다) — 모듈 본문을 한 번 더 돌리되 HEAD 고정
    src2 = src.replace("HEAD = {k: (v[0] * 1.45, v[1] * 1.45) for k, v in", "HEAD = HEAD_FIX or {k: (v[0] * 1.45, v[1] * 1.45) for k, v in")
    ns = {'__file__': os.path.join(HERE, 'skel.py'), '__name__': 'skel_fit', 'HEAD_FIX': head}; exec(src2, ns)
    return ns, L, KB


def req(cls, act, seed=7):
    from PIL import Image as I
    import base64, io
    ns, L, KB = fitted(cls); kind = 'xbow' if cls == 'arbalest' else 'bow'
    name = (ACT_X if kind == 'xbow' else ACT)[act]; frames = ns['SEQ'][name]
    kp0 = BODY_KP[cls]
    f = I.open(os.path.join(SK, f'first-{cls}.png')).convert('RGBA'); buf = io.BytesIO(); f.save(buf, 'PNG')
    body = {'description': DESC[cls], 'action': ACTION[act], 'direction': 'east', 'view': 'side',
            'first_frame': {'type': 'base64', 'base64': base64.b64encode(buf.getvalue()).decode(), 'format': 'png'},
            'first_frame_keypoints': ns['kp'](kp0), 'keypoints': [ns['kp'](p) for p, _ in frames], 'template_id': 'mannequin', 'seed': seed, 'no_background': True}
    json.dump(body, open(os.path.join(SK, f'req-{cls}-{act}.json'), 'w', encoding='utf-8'), ensure_ascii=False)
    json.dump([n for _, n in frames], open(os.path.join(SK, f'wpn-{cls}-{act}.json'), 'w', encoding='utf-8'))
    # 확인용: 첫 프레임 그림 위에 읽은 관절, 그다음 설계 프레임 막대 인형
    tiles = [ns['stick'](kp0, kind, {'draw': False}, ghost=None)]
    base = f.resize((N * 3, N * 3), I.NEAREST); t0 = I.new('RGBA', (N * 3, N * 3), (20, 22, 30, 255)); t0.alpha_composite(base)
    dr = ImageDraw.Draw(t0)
    for a, b in ns['BONES']: dr.line([(kp0[a][0] * 3, kp0[a][1] * 3), (kp0[b][0] * 3, kp0[b][1] * 3)], fill=(255, 220, 90), width=2)
    tiles = [t0.crop((30 * 3, 66 * 3, 166 * 3, 182 * 3))] + [ns['stick'](p, kind, n, ghost=kp0) for p, n in frames]
    W_, H_ = tiles[0].size; m = I.new('RGBA', ((W_ + 6) * len(tiles), H_), (40, 42, 52, 255))
    for i, t in enumerate(tiles): m.paste(t, (i * (W_ + 6), 0))
    m.save(os.path.join(SK, f'stick-fit-{cls}-{act}.png'))
    return {k: round(v, 1) for k, v in L.items()}, round(KB, 2)


if __name__ == '__main__':
    os.makedirs(SK, exist_ok=True)
    if sys.argv[1] == 'first': first(sys.argv[2]); print('ok')
    elif sys.argv[1] == 'req': print(req(sys.argv[2], sys.argv[3], int(sys.argv[4]) if len(sys.argv) > 4 else 7))
