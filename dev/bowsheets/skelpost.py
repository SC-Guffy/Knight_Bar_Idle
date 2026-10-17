# 관절 애니 결과 후처리: work/<cls>/skel-<act>-<i>.png (192칸) → 2×2 최빈색 96칸 →
#   own : 모델이 그린 활을 그대로 둔 판 (비교용)
#   ovl : 가는 선(모델이 그린 활대·시위·화살) 지우고 → 원래 무기 그림(지금 게임 무기 1.3배)을 설계 관절의 활 손(LEFT ARM)에 덧그림 (공용 wpn.py)
#         활 방향 = 당길 땐 당기는 손 → 활 손(화살 방향)에 수직, 쉴 땐 아래팔 방향. 시위 = 당길 땐 활 끝 → 당기는 손(RIGHT ARM) V, 아니면 직선
#   → work/<cls>/post-<act>-<판>-<i>.png, 줄 strip-<act>-<판>.png (검수 qa.py --kind char --frames 8), GIF
#   C:\AI\ComfyUI\.venv\Scripts\python.exe -I -B -X utf8 dev/bowsheets/skelpost.py <cls> <act>
import os, sys, json, math
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, HERE); sys.path.insert(0, os.path.join(ROOT, 'dev', 'sheets-common'))
from wpn import WeaponSprite, overlay, diff_pts, grip_tip
from skelgen import thin_off, fitted
from dress import load as cap_load, code_string, line_pts
W96 = 96
WSCALE = 1.3          # 무기 그림도 캐릭터와 같이 1.3배 (키 35 → 46)


def half(im):
    W, H = im.size[0] // 2, im.size[1] // 2; P = im.load(); o = Image.new('RGBA', (W, H)); O = o.load()
    for y in range(H):
        for x in range(W):
            cs = [P[2 * x + a, 2 * y + b] for a in (0, 1) for b in (0, 1) if P[2 * x + a, 2 * y + b][3] >= 128]
            if len(cs) >= 2: O[x, y] = max(set(cs), key=cs.count)[:3] + (255,)
    return o


def bow_sprite(cls):
    full, wc = cap_load(f'c-{cls}-full'), cap_load(f'c-{cls}-wcol')
    ws = WeaponSprite.from_capture(full, wc, [], 'up')
    img = ws.img.resize((round(ws.img.width * WSCALE), round(ws.img.height * WSCALE)), Image.NEAREST)
    # 시위 색: 원래 그림에서 무기 옆 밝은 칸 (빛 시위면 빛 색)
    return WeaponSprite(img, (ws.grip[0] * WSCALE, ws.grip[1] * WSCALE), ws.ang)


def crumbs_off(im, maxn=4):
    """검수 fix: 몸에서 떨어진 작은 덩어리(4칸 이하, 4방향 연결 기준 밝은 조각 — 지운 활 선 끝·화살 촉 찌꺼기) 지우기"""
    P = im.load(); W, H = im.size; seen = set()
    for y in range(H):
        for x in range(W):
            if not P[x, y][3] or (x, y) in seen: continue
            st = [(x, y)]; comp = {(x, y)}; seen.add((x, y))
            while st:
                a, b = st.pop()
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    q = (a + dx, b + dy)
                    if 0 <= q[0] < W and 0 <= q[1] < H and q not in seen and P[q][3]: seen.add(q); comp.add(q); st.append(q)
            if len(comp) <= maxn:
                for q in comp: P[q] = (0, 0, 0, 0)
    return im


def strip(frames):
    o = Image.new('RGBA', (W96 * len(frames), W96))
    for i, f in enumerate(frames): o.alpha_composite(f, (i * W96, 0))
    return o


def run(cls, act):
    ns, _, _ = fitted(cls); name = {'walk': 'bow-walk', 'shoot': 'bow-shoot', 'shoot2': 'bow-shoot', 'shoot3': 'bow-shoot', 'walk2': 'bow-walk', 'sky': 'bow-sky'}[act]
    seq = ns['SEQ'][name]; ws = bow_sprite(cls)
    scol = (217, 210, 192, 255)
    W = os.path.join(HERE, 'work', cls); own, ovl, ovl2 = [], [], []
    for i, (p, note) in enumerate(seq):
        f = half(Image.open(os.path.join(W, f'skel-{act}-{i}.png')).convert('RGBA'))
        own.append(f)
        g = thin_off(f)
        b = (p['LEFT ARM'][0] / 2, p['LEFT ARM'][1] / 2); d = (p['RIGHT ARM'][0] / 2, p['RIGHT ARM'][1] / 2)
        if note.get('draw'): ang = math.atan2(b[1] - d[1], b[0] - d[0])
        else: ang = math.atan2(p['LEFT ARM'][1] - p['LEFT ELBOW'][1], p['LEFT ARM'][0] - p['LEFT ELBOW'][0])
        up = (math.sin(ang), -math.cos(ang))            # 화살 방향에 수직, 위쪽
        R = ws.img.height * 0.45
        tip = (b[0] + up[0] * R, b[1] + up[1] * R); lo = (b[0] - up[0] * R, b[1] - up[1] * R)
        under = {q: scol for q in (line_pts(tip, d) | line_pts(d, lo))} if note.get('draw') else {q: scol for q in line_pts(tip, lo)}
        g1 = overlay(g, set(), b, tip, ws, front=(), line=False, under=under)
        ovl.append(g1)
        # ovl2: 그 프레임에서 실제로 지워진 가는 선(= 모델이 그린 활·시위)의 위치·각도로 덧그림, 밝은 선(시위·화살)은 원래 색 그대로
        F, G = f.load(), g.load(); Wp = [(x, y) for y in range(W96) for x in range(W96) if F[x, y][3] and not G[x, y][3]]
        Lm = lambda c: c[0] * .3 + c[1] * .59 + c[2] * .11
        if len(Wp) >= 6:
            gp, tp = grip_tip(Wp, [], 'up')
            und = {q: F[q] for q in Wp if Lm(F[q]) > 110}
            g2 = overlay(g, set(), gp, tp, ws, front=(), line=False, under=und)
        else:
            g2 = g1
        ovl2.append(crumbs_off(g2))
    for tag, fr in (('own', own), ('ovl', ovl), ('ovl2', ovl2)):
        for i, f in enumerate(fr): f.save(os.path.join(W, f'post-{act}-{tag}-{i}.png'))
        strip(fr).save(os.path.join(W, f'strip-{act}-{tag}.png'))
        big = [Image.new('RGBA', (W96, W96), (20, 22, 30, 255)) for _ in fr]
        for k, f in enumerate(fr): big[k].alpha_composite(f)
        big = [b_.resize((W96 * 3, W96 * 3), Image.NEAREST).convert('RGB') for b_ in big]
        big[0].save(os.path.join(W, f'anim-{act}-{tag}.gif'), save_all=True, append_images=big[1:], duration=110, loop=0)
    return len(own)


if __name__ == '__main__':
    print(run(sys.argv[1], sys.argv[2]))
