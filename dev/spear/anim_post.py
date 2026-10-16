# 관절 애니 결과 후처리 (창 계열): work/<cls>/skel-<act>-<i>.png (192) → 96칸(2×2 최빈색) → 모델이 그린 창 지우기 → 코드 창 얹기
#  창 위치·각도는 skelfit.py 가 남긴 skel/wpn-<cls>-<act>.json(앞손·뒷손, 192 좌표)에서. 모델 창은 프레임마다 모양이 달라(철퇴처럼 되기도) 쓰지 않는다.
#   python -I -B anim_post.py <cls> <act>  → work/<cls>/anim-<act>-<i>.png, out/anim-<cls>-<act>.png(줄), out/anim-<cls>-<act>.gif
import os, sys, json, math
from collections import Counter
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE); sys.path.insert(0, os.path.join(HERE, '..', 'sheets-common'))
import design5 as D5
from wpn import line_fit, near_line, fill_holes
WPN = {'lancer': 'spear', 'dragoon': 'dragon', 'halberdier': 'halberd', 'cavalier': 'lance'}


def half(im):
    """192 → 96: 2×2 칸 중 가장 많은 색 (투명이 2칸 이상이면 투명)"""
    W, H = im.width // 2, im.height // 2; P = im.load(); o = Image.new('RGBA', (W, H)); O = o.load()
    for y in range(H):
        for x in range(W):
            cs = [P[2 * x + a, 2 * y + b] for a in (0, 1) for b in (0, 1)]
            op = [c for c in cs if c[3] >= 128]
            if len(op) >= 2: O[x, y] = Counter(c[:3] for c in op).most_common(1)[0][0] + (255,)
    return o


def hands(im):
    """그림에서 손 찾기: 살색 덩어리 중 맨 위(얼굴)를 뺀 나머지 = 손 [(x, y, 칸들)] (x 큰 순 = 앞손 먼저)"""
    from pix import POL_comps
    P = im.load(); W, H = im.size; sk = Image.new('RGBA', im.size); S = sk.load()
    for y in range(H):
        for x in range(W):
            c = P[x, y]
            if c[3] and c[0] > 170 and c[0] - c[2] > 40 and c[1] > 90 and c[0] - c[1] < 90: S[x, y] = c
    cs = sorted(POL_comps(sk), key=lambda c: min(y for _, y in c))[1:]
    hs = [(sum(x for x, _ in c) / len(c), sum(y for _, y in c) / len(c), c) for c in cs if len(c) >= 4]
    return sorted(hs, key=lambda h: -h[0])


def swap_weapon(im, kind, front, back, design_ang):
    """모델이 그린 창을 지우고 코드 무기를 손에 얹는다 (검수 a2: 관절·갈색 직선에 맞추면 창이 손보다 3칸 위 턱 높이에 떴다).
    손 둘이 보이면 뒷손 → 앞손 직선, 하나면 그 손을 지나는 설계 각도. 그 직선을 따라 모델 창(자루 2.5·창날 4.0)을 지우되 손 칸은 남긴다"""
    P = im.load(); W, H = im.size
    hs = hands(im)
    if len(hs) >= 2:
        (fx, fy, fc), (bx, by, bc) = hs[0], hs[1]; a = math.atan2(fy - by, fx - bx); keep = fc | bc
        if abs(math.degrees(a) - design_ang) > 50: a = math.radians(design_ang)       # 두 손이 엇갈려 보이면 설계 각도
    elif hs:
        fx, fy, keep = hs[0]; a = math.radians(design_ang)
    else:
        fx, fy = front; keep = set(); a = math.radians(design_ang)
    dd = (math.cos(a), math.sin(a)); gx, gy = fx, fy
    pts = [(x, y) for y in range(H) for x in range(W) if P[x, y][3]]
    er = (set(near_line(pts, (gx, gy), dd, 2.5, -40, 80)) | set(near_line(pts, (gx, gy), dd, 4.0, 10, 80))) - keep
    body = set(near_line(pts, (gx, gy), dd, 2.5, -40, 6))
    import colorsys
    def wpnish(c):           # 몸 쪽 구간(손 뒤~손 앞 6칸)은 자루 색(갈색·어두운 선)만 지운다 — 갑옷·얼굴은 남김
        h, l, s_ = colorsys.rgb_to_hls(c[0] / 255, c[1] / 255, c[2] / 255)
        return (0.03 < h < 0.13 and 0.1 < l < 0.55 and s_ > 0.25) or l < 0.12
    er = {p for p in er if p not in body or wpnish(P[p])}
    # 2차: 모델 창이 손 직선과 다른 각도면(0·1·6·7 프레임) 남는다 → 갈색 자루 칸으로 모델 창 직선을 맞춰 한 번 더 지운다
    #  자루 색은 직선 전체, 창날(회색)은 얼굴에서 가로 12칸 밖에서만 (몸 갑옷 보호)
    br = [p for p in pts if wpnish(P[p]) and not (P[p][0] + P[p][1] + P[p][2] < 60)]
    if len(br) >= 10:
        c2, d2, inl = line_fit(br, tol=1.2)
        if len(inl) >= 10 and max(math.dist(u, v) for u in inl[:1] for v in inl) >= 14:
            face_x = sum(x for x, _ in pts) / len(pts)
            for p in near_line(pts, c2, d2, 2.5, -90, 90):
                if p in keep: continue
                if wpnish(P[p]) or abs(p[0] - face_x) > 12: er.add(p)
            for p in near_line(pts, c2, d2, 4.0, -90, 90):
                if p not in keep and abs(p[0] - face_x) > 14: er.add(p)
    for p in er: P[p] = (0, 0, 0, 0)
    fill_holes(im, er)
    M, Z = 40, 8
    big = Image.new('RGB', ((W + 2 * M) * Z, (H + 2 * M) * Z), (255, 0, 255))
    D5.draw_weapon(big, kind, ((gx + M + 0.5) * Z, (gy + M + 0.5) * Z), math.degrees(a), Z)
    BP = big.load(); o = Image.new('RGBA', (W + 2 * M, H + 2 * M)); o.alpha_composite(im, (M, M)); O = o.load()
    for y in range(H + 2 * M):
        for x in range(W + 2 * M):
            c_ = BP[x * Z + Z // 2, y * Z + Z // 2]
            if c_ != (255, 0, 255): O[x, y] = c_ + (255,)
    for (x, y) in keep:                 # 앞손은 창 위에 (쥔 손이 보이게)
        if hs and (x, y) in hs[0][2]: O[x + M, y + M] = P[x, y]
    return o.crop((M, M, M + W, M + H))


CW, FX = 128, 36          # 게임 칸: 창 계열 128, 발 x = 36 (src/sprites.js 창 발 (36, 112))


def place(im):
    """96칸(발 x 48) → 128 너비, 발 x 36 — 찌르기 창끝이 칸 밖으로 잘리지 않게"""
    o = Image.new('RGBA', (CW, im.height)); o.alpha_composite(im, (FX - 48, 0)); return o


def run(cls, act):
    wp = json.load(open(os.path.join(HERE, 'skel', f'wpn-{cls}-{act}.json'), encoding='utf-8'))
    out = []
    for i, w in enumerate(wp):
        im = place(half(Image.open(os.path.join(HERE, 'work', cls, f'skel-{act}-{i}.png')).convert('RGBA')))
        fr = (w['front'][0] / 2 + FX - 48, w['front'][1] / 2); bk = (w['back'][0] / 2 + FX - 48, w['back'][1] / 2)
        im = swap_weapon(im, WPN[cls], fr, bk, w['ang'])
        from pix import POL_comps
        cs = POL_comps(im); Q = im.load()
        for c_ in cs:
            if len(c_) < 6 and len(c_) < max(map(len, cs)):
                for q in c_: Q[q] = (0, 0, 0, 0)                   # 떨어진 6칸 미만 조각 (지운 창 부스러기)
        im.save(os.path.join(HERE, 'work', cls, f'anim-{act}-{i}.png')); out.append(im)
    # 프레임 공통 팔레트로 색 줄이기 (생성 결과 68색 → 경보) — pix.reduce (적게 쓰인 색부터 합치기·채도 벌점·살색 가중)
    from pix import reduce
    strip = Image.new('RGBA', (CW * len(out), 96))
    for k, im in enumerate(out): strip.alpha_composite(im, (k * CW, 0))
    strip = reduce(strip, 22)
    out = [strip.crop((k * CW, 0, (k + 1) * CW, 96)) for k in range(len(out))]
    for k, im in enumerate(out): im.save(os.path.join(HERE, 'work', cls, f'anim-{act}-{k}.png'))
    S = 4; row = Image.new('RGBA', (CW * len(out), 96), (36, 38, 48, 255))
    for k, im in enumerate(out): row.alpha_composite(im, (k * CW, 0))
    row.resize((row.width * S, row.height * S), Image.NEAREST).save(os.path.join(HERE, 'out', f'anim-{cls}-{act}.png'))
    fr = []
    for im in out:
        b = Image.new('RGBA', (CW, 96), (36, 38, 48, 255)); b.alpha_composite(im); fr.append(b.resize((CW * 3, 288), Image.NEAREST).convert('P'))
    fr[0].save(os.path.join(HERE, 'out', f'anim-{cls}-{act}.gif'), save_all=True, append_images=fr[1:], duration=90, loop=0)
    return len(out)


if __name__ == '__main__':
    print(run(sys.argv[1], sys.argv[2]))
