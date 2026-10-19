# 앉기(sit) 줄 만들기 — 앉기 줄이 없는 직업 시트 29장 (스펙 docs/specs/legacy-class-sheets.md "동작", 진행 기록 2026-10-19)
#   python dev/sheets-sit/build.py preview   → dev/sheets-sit/out/ 에 미리보기만 (시트는 안 건드림)
#   python dev/sheets-sit/build.py install   → src/sprites/<직업>.png·json 에 sit 줄을 붙인다 (원본은 dev/sheets-sit/orig/ 에서 읽어 몇 번 돌려도 같다)
#   다음에 node dev/boxer/sheet-meta.js 로 meta.js 를 다시 묶는다.
# 방법 (유료 생성 0): 대기(idle) 프레임 0·1 의 하반신만 편집한다.
#   골반선(hip) 위 상체는 그대로 허벅지 길이만큼 내리고, 다리 기둥(발 둘레)의 허벅지 조각은 90° 눕혀 앞으로 뻗고,
#   정강이·신발 조각은 땅에 둔 채 무릎 밑으로 옮긴다 → 옆모습으로 걸터앉은 자세. 색·외곽선·도트는 원래 그림 픽셀 그대로.
import os, sys, json
import numpy as np
from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
ORIG = os.path.join(ROOT, 'dev/sheets-sit/orig')
SPR = os.path.join(ROOT, 'src/sprites')
OUT = os.path.join(ROOT, 'dev/sheets-sit/out')

NAMES = ('arbalest arcaneArcher archmage archon blademaster cavalier cryomancer deadeye dragonlord dragoon electromancer frostlord '
         'greatswordsman halberdier lancer mage marksman paladin pyromancer ranger siegeMaster skyGeneral squire swordsaint swordsman '
         'thunderEmperor tyrant voidArcher warlord').split()

# 직업별 조정: leg = 발~골반 비율(키 대비), r = 다리 기둥 반폭 비율, dx = 다리 기둥 가운데 보정(px), robe = 긴 옷자락(무릎 아래까지 덮음)
TUNE = {
    # 망토가 발까지 내려와 다리 기둥이 넓게 잡히는 직업: 기둥을 좁혀 망토는 상체와 함께 내린다 (검수 1차: 다리가 판자처럼 보임)
    'greatswordsman': {'r': 0.12, 'leg': 0.36}, 'tyrant': {'r': 0.12, 'leg': 0.36}, 'dragoon': {'r': 0.12, 'leg': 0.32, 'st': 1.1, 'hx': 0}, 'dragonlord': {'r': 0.12, 'leg': 0.32, 'st': 1.1, 'hx': 0},
    # 허리 앞치마(타바드)를 다리로 잘못 잡던 직업: 골반선을 내린다
    'halberdier': {'leg': 0.33, 'r': 0.14}, 'warlord': {'leg': 0.33, 'r': 0.14},
    'arcaneArcher': {'r': 0.14}, 'voidArcher': {'r': 0.14}, 'arbalest': {'r': 0.14},
    'archmage': {'robe': True}, 'cryomancer': {'robe': True}, 'electromancer': {'robe': True}, 'frostlord': {'robe': True},
    'mage': {'robe': True}, 'pyromancer': {'robe': True}, 'thunderEmperor': {'robe': True},
}
DEF = {'leg': 0.40, 'r': 0.20, 'dx': 0, 'robe': False, 'bx': -1, 'by': 1, 'hx': -1, 'st': 1.4}


def leg_cols(a, fy, x0, x1):
    """다리 기둥: 발 줄 근처(아래 3줄)에 있는 픽셀 열의 범위"""
    rows = a[fy - 3:fy + 1, x0:x1 + 1] > 0
    xs = np.where(rows.any(0))[0]
    if not len(xs): return x0, x1
    return x0 + xs.min(), x0 + xs.max()


def sit_frame(fr, foot, head_y, t):
    """fr: HxWx4 uint8 (오른쪽을 봄). 앉은 프레임과 내린 높이(drop)를 돌려준다"""
    H, W = fr.shape[:2]
    fx, fy = foot
    a = fr[..., 3]
    hc = fy - head_y                                   # 머리 가운데~발
    leg = max(6, round(hc * t['leg']))
    hip = fy - leg
    r = max(4, round(hc * t['r']))
    cx = fx + t['dx']
    lx0, lx1 = leg_cols(a, fy, cx - r, cx + r)
    lx0, lx1 = max(lx0 - 1, cx - r), min(lx1 + 1, cx + r)
    mid = (lx0 + lx1 + 1) // 2

    out = np.zeros_like(fr)

    def put(img, ox, oy):
        h, w = img.shape[:2]
        for yy in range(h):
            ty = oy + yy
            if ty < 0 or ty > fy or ty >= H: continue        # 땅 밑은 버림
            for xx in range(w):
                tx = ox + xx
                if 0 <= tx < W and img[yy, xx, 3] > 0: out[ty, tx] = img[yy, xx]

    def lay(c0, c1):
        """골반~발 한 다리 조각을 반시계로 눕힌다: 골반이 뒤(왼쪽), 발끝이 위로 선다"""
        L = Image.fromarray(fr[hip:fy + 1, c0:c1 + 1]).rotate(90, expand=True)
        n = round(L.width * t['st'])                      # 앉으면 다리가 몸 앞으로 나와 보이게 조금 늘인다 (허벅지 쪽 줄을 반복)
        return np.array(L.resize((n, L.height), Image.NEAREST))

    back, front = lay(lx0, mid - 1), lay(mid, lx1)
    th = front.shape[0]
    # ① 상체(골반 위 전부) + 다리 기둥 밖의 아래쪽(망토 자락·무기·방패)을 엉덩이가 땅에 닿게 내린다
    drop = leg - max(2, th - 1)
    U = fr.copy()
    U[hip:, lx0:lx1 + 1] = 0
    put(U, 0, drop)
    # ② 다리: 땅에 앉아 앞으로 뻗는다 (파이터 계열 앉기와 같은 구도) — 몸 아랫단(허리띠·손·방패 밑)보다 앞에. 뒷다리 먼저, 1도트 위·뒤로
    hx = mid + t['hx']                                   # 엉덩이(다리 시작) x — 몸 가운데쯤
    put(back, hx + t['bx'], fy - back.shape[0] + 1 - t['by'])
    put(front, hx, fy - th + 1)
    specks(out, fy - leg)
    outline(out)
    return out, drop


def specks(o, y0):
    """아래쪽(y0 아래)에 외톨이로 떨어진 8도트 이하 부스러기를 지운다 (망토 끝·무기 끝이 잘려 남은 조각)"""
    a = o[..., 3] > 0
    H, W = a.shape
    seen = np.zeros_like(a)
    for y in range(max(0, y0), H):
        for x in range(W):
            if not a[y, x] or seen[y, x]: continue
            st, comp = [(y, x)], []
            seen[y, x] = True
            while st:
                cy, cx = st.pop(); comp.append((cy, cx))
                for dy in (-1, 0, 1):
                    for dx in (-1, 0, 1):
                        ny, nx = cy + dy, cx + dx
                        if 0 <= ny < H and 0 <= nx < W and a[ny, nx] and not seen[ny, nx]:
                            seen[ny, nx] = True; st.append((ny, nx))
            if len(comp) <= 8:
                for cy, cx in comp: o[cy, cx] = 0


def outline(o):
    """잘리고 옮겨진 가장자리에 외곽선이 빠진 곳: 투명 칸에 닿은 밝은 픽셀 바깥에 짙은 1도트를 둘러 준다 (원래 외곽선색 = 가장 어두운 불투명색)"""
    a = o[..., 3] > 0
    if not a.any(): return
    px = o[a][:, :3].astype(int)
    ink = px[px.sum(1).argmin()]
    H, W = a.shape
    add = []
    for y in range(H):
        for x in range(W):
            if a[y, x]: continue
            n = [(y + dy, x + dx) for dy, dx in ((0, 1), (0, -1), (1, 0), (-1, 0)) if 0 <= y + dy < H and 0 <= x + dx < W and a[y + dy, x + dx]]
            if not n: continue
            # 이웃이 이미 어두우면(원래 외곽선) 그대로
            if all(o[yy, xx, :3].astype(int).sum() > ink.sum() + 120 for yy, xx in n):
                add.append((y, x))
    for y, x in add:
        o[y, x, :3] = ink; o[y, x, 3] = 255


def build(name):
    j = json.load(open(os.path.join(ORIG, name + '.json')))
    im = np.array(Image.open(os.path.join(ORIG, name + '.png')).convert('RGBA'))
    W, H = j['w'], j['h']
    t = dict(DEF, **TUNE.get(name, {}))
    idle = j['anims']['idle']
    frames, pts = [], []
    for f in range(2):
        f0 = f % idle['frames']
        fr = im[idle['row'] * H:(idle['row'] + 1) * H, f0 * W:(f0 + 1) * W]
        P = j['pts']['idle'][f0]
        o, drop = sit_frame(fr, j['foot'], P[3], t)
        frames.append(o)
        pts.append([P[0], P[1] + drop, P[2], P[3] + drop])
    return j, im, frames, pts


def main():
    mode = sys.argv[1] if len(sys.argv) > 1 else 'preview'
    only = sys.argv[2].split(',') if len(sys.argv) > 2 else NAMES
    os.makedirs(OUT, exist_ok=True)
    for name in only:
        j, im, frames, pts = build(name)
        W, H = j['w'], j['h']
        strip = np.zeros((H, W * 2, 4), np.uint8)
        for i, o in enumerate(frames): strip[:, i * W:(i + 1) * W] = o
        Image.fromarray(strip).save(os.path.join(OUT, name + '-sit.png'))
        if mode == 'install':
            row = max(a['row'] for a in j['anims'].values()) + 1
            sh = np.zeros((im.shape[0] + H, max(im.shape[1], W * 2), 4), np.uint8)
            sh[:im.shape[0], :im.shape[1]] = im
            sh[row * H:(row + 1) * H, :W * 2] = strip
            Image.fromarray(sh).save(os.path.join(SPR, name + '.png'))
            j['anims']['sit'] = {'row': row, 'frames': 2, 'fps': 2, 'loop': True}
            j['pts']['sit'] = pts
            json.dump(j, open(os.path.join(SPR, name + '.json'), 'w'))
    print(mode, len(only))


if __name__ == '__main__':
    main()
