# 관절 애니 B (로드맵 승인: pixen 키 자세 최대 4): 확정 그림(칼 든 성기사)을 edit-image-pixen 으로 젖힘·머리 위·타격·마무리 4자세로 편집
#  → 발 줄(59) 맞춤 → 평타 6프레임 [준비, 젖힘, 머리 위, 타격, 타격 유지, 마무리] (skeleton-v3 는 2번 다 미달: 몸이 안 움직이거나 칼 궤적·방패가 무너짐)
#  python -I -B anim_keys.py → anim/paladin-atkB-strip.png (64×6), anim/paladin-atkB-x4.gif
import os
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__)); A = os.path.join(HERE, 'anim'); W = os.path.join(HERE, 'work', 'paladin')
# C (로드맵 승인 pixen 재편집): 타격은 keyC3(머리 위 key2 에서 편집 → 투구 일관) 를 쓰되 방패가 몸 뒤로 숨어 사라져서
#  key2 의 방패(x 14~23, y 36~52)를 1칸 옮겨 빈칸에만 붙인다 (있는 그림 옮기기, 손그림 아님)
SEQ = ['src', 'key1', 'key2', 'keyC3s', 'keyC3s', 'key4']
# 비평 C-B 제안 (usage 0): 순서 바꿈 — 수직으로 들기(key2) → 앞위로 넘김(key1) → 타격, 마무리는 key4 대신 준비(src) (key4 는 몸이 커져 튐)
if os.environ.get('ATK_ORDER') == 'D':
    SEQ = ['src', 'key2', 'key1', 'keyC3s', 'keyC3s', 'src']   # (srcL 칼 늘리기는 방향이 틀어져 갈고리가 됨 → 안 씀)
DUR = [120, 90, 90, 70, 160, 140] if os.environ.get('ATK_ORDER') != 'D' else [120, 110, 70, 70, 160, 140]                 # ms: 젖힘·들기는 빠르게, 타격에서 멈칫


def longer(im, n):
    """준비 자세 칼이 다른 프레임보다 짧음(비평 D-B) → 칼날(금빛 밝은 칸) 방향으로 n칸 늘리고 외곽선"""
    P = im.load(); pts = [(x, y) for y in range(64) for x in range(36, 64) if P[x, y][3] and P[x, y][0] > 200 and P[x, y][1] > 150 and P[x, y][2] < 190]
    if len(pts) < 4: return im
    mx = sum(p[0] for p in pts) / len(pts); my = sum(p[1] for p in pts) / len(pts)
    tip = max(pts, key=lambda p: (p[0] - mx) + 0.6 * (p[1] - my)); base = min(pts, key=lambda p: (p[0] - mx) + 0.6 * (p[1] - my))
    dx, dy = tip[0] - base[0], tip[1] - base[1]; L = max(1, (dx * dx + dy * dy) ** 0.5); ux, uy = dx / L, dy / L
    add = []
    for t in range(1, n + 1):
        for s_, c in ((0, (248, 230, 145, 255)), (1, (229, 178, 60, 255))):
            x, y = round(tip[0] + ux * t - uy * s_ * 0.7), round(tip[1] + uy * t + ux * s_ * 0.7)
            if 0 <= x < 64 and 0 <= y < 64: P[x, y] = c; add.append((x, y))
    for x, y in add:
        for a, b in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            q = (x + a, y + b)
            if 0 <= q[0] < 64 and 0 <= q[1] < 64 and not P[q][3]: P[q] = (10, 13, 20, 255)
    return im


def load(k):
    if k == 'keyC3s':
        # 비평 D-A·B 공통: 타격 4·5번에 방패가 없음 → key1 의 방패 전체(x 16~28, y 36~52)를 왼쪽 1·아래 3 옮겨 덮어 붙임 (있는 그림 옮기기)
        o = load('keyC3'); sh = load('key1').crop((16, 36, 29, 53)); P = o.load(); S = sh.load()
        for y in range(sh.height):
            for x in range(sh.width):
                if S[x, y][3] and 0 <= 15 + x < 64 and 39 + y < 64: P[15 + x, 39 + y] = S[x, y]
        return o
    if k == 'srcL':
        return longer(load('src'), 4)
    im = Image.open(os.path.join(A, 'paladin64-src.png') if k == 'src' else os.path.join(W, f'{k}-0.png')).convert('RGBA')
    P = im.load(); yb = max(y for y in range(64) if any(P[x, y][3] for x in range(64)))
    o = Image.new('RGBA', (64, 64)); o.alpha_composite(im, (0, 59 - yb)); return o


def lock(im, pal):
    """확정 그림 팔레트로 고정 (pixen 이 프레임마다 색을 조금씩 바꿔 30색 넘음)"""
    P = im.load()
    for y in range(im.height):
        for x in range(im.width):
            c = P[x, y]
            if c[3]: P[x, y] = min(pal, key=lambda q: sum((c[i] - q[i]) ** 2 for i in range(3)))[:3] + (255,)
    return im


if __name__ == '__main__':
    src = load('src'); pal = sorted({c for c in src.get_flattened_data() if c[3]}) if hasattr(src, 'get_flattened_data') else sorted({c for c in src.getdata() if c[3]})
    fr = [lock(load(k), pal) for k in SEQ]
    strip = Image.new('RGBA', (64 * len(fr), 64))
    for i, f in enumerate(fr): strip.alpha_composite(f, (64 * i, 0))
    tag = 'D' if os.environ.get('ATK_ORDER') == 'D' else 'B'
    strip.save(os.path.join(A, f'paladin-atk{tag}-strip.png'))
    g = []
    for f in fr:
        b = Image.new('RGBA', (64, 64), (38, 40, 50, 255)); b.alpha_composite(f); g.append(b.convert('RGB').resize((256, 256), Image.NEAREST))
    g[0].save(os.path.join(A, f'paladin-atk{tag}-x4.gif'), save_all=True, append_images=g[1:], duration=DUR, loop=0)
    print('frames', len(fr))
