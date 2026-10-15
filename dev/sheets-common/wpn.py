# 무기 덧그리기 (계열 공용, docs/specs/legacy-class-sheets.md — 2026-10-16 사용자 결정 "무기는 덧그리기, 0회").
#  원형 마네킹 프레임의 무기(마네킹 모양)를 지우고, 그 자리 손잡이 점·각도에 원래 직업 무기 그림을 돌려 얹는다.
#  돌리기는 RotSprite 식(크게 키워 nearest 회전 → 칸 가운데 표본으로 줄이기)이라 1px 선이 끊기지 않는다.
#
#  쓰는 법 (PIL RGBA, 알파 0/255):
#    from wpn import WeaponSprite, overlay
#    ws = WeaponSprite.from_capture(full, wcol, grip)       # 직업 그림 + 무기 색만 바꿔 찍은 그림 → 무기 그림, grip = 손 점 (x, y)
#    out = overlay(frame, frame_wpn_mask, grip_xy, tip_xy, ws, front=glove_pts)
#      frame_wpn_mask: 지울 무기 칸 집합 {(x,y)}, grip_xy: 프레임의 손 점, tip_xy: 무기 끝 쪽 아무 점 (방향만 쓴다)
#      front: 무기 위에 다시 그릴 칸 (손·장갑) 집합
#    ws 대신 WeaponTable([(그림, 각도, 손 점), …]) 을 주면 가장 가까운 각도 그림을 돌리지 않고 얹는다 (가는 장검용)
#  보조: axis(pts) 주축, grip_tip(wpn_pts, glove_pts) 손 점과 끝 점, diff_pts(a, b) 두 그림이 다른 칸
#  python -I -B wpn.py  → 자기 시험 (가짜 막대를 돌려 얹기)
import math
from PIL import Image

OUT_C = (0x0b, 0x0d, 0x14, 255)


def diff_pts(a, b):
    """두 그림이 다른 칸 (무기 색만 바꿔 찍은 캡처와 비교 → 무기 칸)"""
    A, B = a.load(), b.load()
    return {(x, y) for y in range(a.height) for x in range(a.width) if (A[x, y][3] or B[x, y][3]) and A[x, y] != B[x, y]}


def axis(pts):
    """점들의 가운데와 주축 단위벡터 (2×2 공분산의 큰 고유벡터)"""
    n = len(pts); cx = sum(p[0] for p in pts) / n; cy = sum(p[1] for p in pts) / n
    sxx = sum((p[0] - cx) ** 2 for p in pts) / n; syy = sum((p[1] - cy) ** 2 for p in pts) / n; sxy = sum((p[0] - cx) * (p[1] - cy) for p in pts) / n
    a = 0.5 * math.atan2(2 * sxy, sxx - syy)
    return (cx, cy), (math.cos(a), math.sin(a))


def grip_tip(wpn_pts, glove_pts):
    """무기 칸과 손(장갑) 칸 → (손 점, 끝 점). 손 점 = 손 가운데를 무기 축에 내린 발, 끝 = 손에서 먼 쪽 끝"""
    c, d = axis(list(wpn_pts))
    ts = [(p[0] - c[0]) * d[0] + (p[1] - c[1]) * d[1] for p in wpn_pts]
    t0, t1 = min(ts), max(ts)
    if glove_pts:
        gx = sum(p[0] for p in glove_pts) / len(glove_pts); gy = sum(p[1] for p in glove_pts) / len(glove_pts)
        tg = (gx - c[0]) * d[0] + (gy - c[1]) * d[1]
    else:
        tg = t0 + (t1 - t0) * 0.3
    tg = max(t0, min(t1, tg))
    tt = t1 if abs(t1 - tg) >= abs(t0 - tg) else t0
    P = lambda t: (c[0] + d[0] * t, c[1] + d[1] * t)
    return P(tg), P(tt)


class WeaponSprite:
    """무기 그림 한 장 + 손 점 + 손→끝 각도"""

    def __init__(self, img, grip, ang):
        self.img, self.grip, self.ang = img, grip, ang

    @classmethod
    def from_capture(cls, full, wcol, glove_pts):
        pts = diff_pts(full, wcol)
        F = full.load(); W, H = full.size
        img = Image.new('RGBA', (W, H)); O = img.load()
        for p in pts:
            if F[p][3]: O[p] = F[p]
        g, t = grip_tip(pts, glove_pts)
        bb = img.getbbox()
        img = img.crop(bb); g = (g[0] - bb[0], g[1] - bb[1]); t = (t[0] - bb[0], t[1] - bb[1])
        return cls(img, g, math.atan2(t[1] - g[1], t[0] - g[0]))


class WeaponTable:
    """각도별 무기 그림 표 (리그로 각도마다 찍은 그림). overlay 에 WeaponSprite 대신 주면 가장 가까운 각도 그림을 돌리지 않고 얹는다.
    가는 장검처럼 돌리면 칼날이 점선으로 끊기는 무기용. 만들기: WeaponTable([(그림, 각도 라디안, 손 점), …])"""

    def __init__(self, items):
        self.items = [WeaponSprite(img, grip, ang) for img, ang, grip in items]

    def pick(self, ang):
        e = min(self.items, key=lambda w: abs(math.remainder(w.ang - ang, 2 * math.pi)))
        return WeaponSprite(e.img, e.grip, ang)        # 각도를 목표로 바꿔 둔다 → overlay 가 돌리지 않음


def rotsprite(img, deg, pivot, S=8):
    """pivot 칸 둘레로 deg 도(화면 기준 시계 방향 +) 돌린 그림과 새 pivot 칸. 크게 키워 nearest 로 돌리고 칸 가운데를 표본"""
    if abs(deg) < 1e-6: return img, pivot           # 돌릴 것 없음 (WeaponTable)
    W, H = img.size; px, py = int(round(pivot[0])), int(round(pivot[1]))
    r = int(math.ceil(max(math.hypot(x - px, y - py) for x in (0, W) for y in (0, H)))) + 2
    D = 2 * r + 1                                  # pivot 칸이 정가운데 (r, r) 에 오는 정사각 캔버스
    pad = Image.new('RGBA', (D, D)); pad.paste(img, (r - px, r - py))
    big = pad.resize((D * S, D * S), Image.NEAREST)
    R = big.rotate(-deg, resample=Image.NEAREST, center=(D * S / 2, D * S / 2)); RP = R.load()
    out = Image.new('RGBA', (D, D)); O = out.load()
    for y in range(D):
        for x in range(D):
            c = RP[x * S + S // 2, y * S + S // 2]
            O[x, y] = c if c[3] >= 128 else (0, 0, 0, 0)
    return out, (r, r)


def fill_holes(im, holes):
    """지운 무기 자리 중 몸 안쪽(양쪽에 칠한 칸이 있는 곳)을 옆 색으로 메운다"""
    P = im.load(); W, H = im.size
    left = set(holes)
    for _ in range(3):
        done = set()
        for (x, y) in left:
            if P[x, y][3]: done.add((x, y)); continue
            nb = [(x + a, y + b) for a, b in ((1, 0), (-1, 0), (0, 1), (0, -1)) if 0 <= x + a < W and 0 <= y + b < H]
            opq = [q for q in nb if P[q][3] and q not in left]
            horiz = sum(1 for q in opq if q[1] == y) == 2; vert = sum(1 for q in opq if q[0] == x) == 2
            if horiz or vert or len(opq) >= 3:
                cs = [P[q] for q in opq if P[q] != OUT_C] or [P[q] for q in opq]
                P[x, y] = max(set(cs), key=cs.count); done.add((x, y))
        left -= done
        if not done: break
    return im


def outline(im, keep=()):
    """바깥 가장자리에 외곽선 (keep 칸은 건드리지 않음)"""
    P = im.load(); W, H = im.size; add = []
    for y in range(H):
        for x in range(W):
            if P[x, y][3]: continue
            if any(0 <= x + a < W and 0 <= y + b < H and P[x + a, y + b][3] and P[x + a, y + b] != OUT_C for a, b in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                add.append((x, y))
    for p in add: P[p] = OUT_C
    return im


def overlay(frame, wpn_mask, grip_xy, tip_xy, ws, front=(), line=True):
    """frame 의 무기 칸을 지우고 ws 를 grip_xy 에 tip_xy 방향으로 얹는다. front 칸(손)은 무기 위로 다시 그린다"""
    out = frame.copy(); O = out.load(); F = frame.load()
    for p in wpn_mask: O[p] = (0, 0, 0, 0)
    # 지운 칸에 붙은 외곽선 찌꺼기(무기 외곽선)도 지운다: 무기 칸 옆의 외곽선 중 몸 칸과 안 닿는 것
    W, H = out.size
    for (x, y) in list(wpn_mask):
        for a in (-1, 0, 1):
            for b in (-1, 0, 1):
                q = (x + a, y + b)
                if 0 <= q[0] < W and 0 <= q[1] < H and O[q] == OUT_C and q not in wpn_mask:
                    if not any(0 <= q[0] + c < W and 0 <= q[1] + d < H and O[q[0] + c, q[1] + d][3] and O[q[0] + c, q[1] + d] != OUT_C
                               and (q[0] + c, q[1] + d) not in wpn_mask for c, d in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                        O[q] = (0, 0, 0, 0)
    fill_holes(out, wpn_mask)
    ang = math.atan2(tip_xy[1] - grip_xy[1], tip_xy[0] - grip_xy[0])
    if hasattr(ws, 'pick'): ws = ws.pick(ang)
    rot, piv = rotsprite(ws.img, math.degrees(ang - ws.ang), ws.grip)
    x0, y0 = round(grip_xy[0] - piv[0]), round(grip_xy[1] - piv[1])
    R = rot.load()
    for y in range(rot.height):
        for x in range(rot.width):
            c = R[x, y]
            if c[3] and 0 <= x0 + x < W and 0 <= y0 + y < H: O[x0 + x, y0 + y] = c
    for p in front:
        if F[p][3]: O[p] = F[p]
    return outline(out) if line else out


if __name__ == '__main__':
    # 자기 시험: 가로 막대(손 점 왼쪽 끝 근처)를 만들고 45° 아래로 얹기
    full = Image.new('RGBA', (40, 20)); wcol = Image.new('RGBA', (40, 20))
    for x in range(4, 36):
        full.putpixel((x, 10), (200, 200, 220, 255)); wcol.putpixel((x, 10), (255, 0, 255, 255))
    for x in (34, 35): full.putpixel((x, 9), (255, 255, 255, 255)); wcol.putpixel((x, 9), (255, 0, 255, 255))
    ws = WeaponSprite.from_capture(full, wcol, [(8, 10)])
    fr = Image.new('RGBA', (48, 48)); fr.putpixel((10, 10), (255, 0, 0, 255))
    o = overlay(fr, set(), (10, 10), (30, 30), ws, front=[(10, 10)])
    print('grip', ws.grip, 'ang', round(math.degrees(ws.ang), 1), 'bbox', o.getbbox())
