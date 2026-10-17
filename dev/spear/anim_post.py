# 관절 애니 결과 후처리 (창 계열): work/<cls>/skel-<act>-<i>.png (192) → 96칸(2×2 최빈색) → 모델이 그린 창 지우기 → 코드 창 얹기
#  창 위치·각도는 skelfit.py 가 남긴 skel/wpn-<cls>-<act>.json(앞손·뒷손, 192 좌표)에서. 모델 창은 프레임마다 모양이 달라(철퇴처럼 되기도) 쓰지 않는다.
#   python -I -B anim_post.py <cls> <act>  → work/<cls>/anim-<act>-<i>.png, out/anim-<cls>-<act>.png(줄), out/anim-<cls>-<act>.gif
import os, sys, json, math
from collections import Counter
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE); sys.path.insert(0, os.path.join(HERE, '..', 'sheets-common'))
import design5 as D5
from wpn import line_fit, near_line, fill_holes
WPN = {'lancer': 'spear', 'dragoon': 'dragon', 'halberdier': 'halberd', 'cavalier': 'lance', 'dragonlord': 'dragon', 'warlord': 'halberd', 'skyGeneral': 'glance'}


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


def body_region(kp, dx, r=6.5, rh=11):
    """설계 관절(192, 프레임별)로 몸 영역: 뼈 둘레 r 칸 + 머리 원 rh (96칸 좌표, 가로 dx 이동)"""
    import skel as SK0
    P = {k: (v[0] / 2 + dx, v[1] / 2) for k, v in kp.items()}
    hc = (sum(P[k][0] for k in ('NOSE', 'RIGHT EAR', 'LEFT EAR')) / 3, sum(P[k][1] for k in ('NOSE', 'RIGHT EAR', 'LEFT EAR')) / 3 - 2)
    def inside(x, y):
        if math.dist((x, y), hc) <= rh: return True
        for a, b in SK0.BONES:
            (x1, y1), (x2, y2) = P[a], P[b]; L2 = (x2 - x1) ** 2 + (y2 - y1) ** 2 or 1
            t = max(0, min(1, ((x - x1) * (x2 - x1) + (y - y1) * (y2 - y1)) / L2))
            if math.dist((x, y), (x1 + t * (x2 - x1), y1 + t * (y2 - y1))) <= r: return True
        return False
    inside.neck_y = P['NECK'][1]
    return inside


def swap_weapon(im, kind, front, back, design_ang, region=None, fixed=False):
    """모델이 그린 창을 지우고 코드 무기를 손에 얹는다 (검수 a2: 관절·갈색 직선에 맞추면 창이 손보다 3칸 위 턱 높이에 떴다).
    손 둘이 보이면 뒷손 → 앞손 직선, 하나면 그 손을 지나는 설계 각도. 그 직선을 따라 모델 창(자루 2.5·창날 4.0)을 지우되 손 칸은 남긴다"""
    P = im.load(); W, H = im.size
    hs = hands(im)
    # 설계 손 위치 14칸 안의 살색 덩어리만 손 (천마장군: 금 후광·방패테·랜스가 살색으로 걸려 머리 위를 앞손으로 잡았다)
    hs = [h for h in hs if min(math.dist(h[:2], front), math.dist(h[:2], back)) < 14]
    if len(hs) >= 2:
        (fx, fy, fc), (bx, by, bc) = hs[0], hs[1]; a = math.atan2(fy - by, fx - bx); keep = fc | bc
        if abs(math.degrees(a) - design_ang) > 50: a = math.radians(design_ang)       # 두 손이 엇갈려 보이면 설계 각도
    elif hs:
        fx, fy, keep = hs[0]; a = math.radians(design_ang)
    else:
        fx, fy = front; keep = set(); a = math.radians(design_ang)
    pts = [(x, y) for y in range(H) for x in range(W) if P[x, y][3]]
    # 모델 창 직선 우선 (로드맵 2026-10-17 창기사 내리찍기·걷기: 모델 창은 손과 맞는데 설계 각도로 그린 코드 창이 엇갈렸다)
    #  몸은 두껍고 창은 가늘다 → 5×5 안에 칠한 칸이 12개 미만인 '가는 칸'으로 직선을 맞추고, 손을 그 직선 위로 옮긴다
    #  (5×5 칸 수로 고르면 자루(외곽선 포함 3~4칸)가 안 걸리고 발끝만 걸렸다 → 실루엣 열기(반지름 2)로 두꺼운 몸을 남기고 그 나머지)
    M_ = {p_ for p_ in pts}
    ero = {(x, y) for (x, y) in M_ if all((x + u, y + v) in M_ for u in range(-2, 3) for v in range(-2, 3))}
    opened = {(x + u, y + v) for (x, y) in ero for u in range(-2, 3) for v in range(-2, 3)}
    fy0 = max(y for _, y in pts)
    thin = [p_ for p_ in pts if p_ not in opened and p_[1] < fy0 - 6]
    if len(thin) >= 10 and not fixed:
        c3, d3, inl3 = line_fit(thin, tol=1.2)
        span = max((abs((u[0] - c3[0]) * d3[0] + (u[1] - c3[1]) * d3[1]) for u in inl3), default=0) * 2 if inl3 else 0
        if len(inl3) >= 10 and span >= 16:
            if d3[0] * math.cos(a) + d3[1] * math.sin(a) < 0: d3 = (-d3[0], -d3[1])
            t = (fx - c3[0]) * d3[0] + (fy - c3[1]) * d3[1]
            # 창날 방향 = 직선 양 끝 6칸 중 금속색(갈색 자루가 아닌 밝은 회색) 칸이 많은 쪽 — 설계 각도로 정하면 내리찍기 준비 자세에서
            #  창날이 양쪽에 달렸고, '손에서 더 긴 쪽' 규칙은 찌르기 준비 자세에서 거꾸로 됐다
            ts = [((u[0] - c3[0]) * d3[0] + (u[1] - c3[1]) * d3[1], u) for u in near_line(pts, c3, d3, 3.0, -90, 90) if u not in opened]
            if ts:
                lo, hi = min(t_ for t_, _ in ts), max(t_ for t_, _ in ts)
                steel = lambda c: max(c[:3]) - min(c[:3]) < 40 and sum(c[:3]) > 300
                n_hi = sum(1 for t_, u in ts if t_ > hi - 6 and steel(P[u])); n_lo = sum(1 for t_, u in ts if t_ < lo + 6 and steel(P[u]))
                if n_lo >= n_hi + 4: d3 = (-d3[0], -d3[1]); t = -t          # 기본은 설계 각도 방향, 반대 끝에 금속이 확실히 많을 때만
            if abs((fx - c3[0]) * d3[1] - (fy - c3[1]) * d3[0]) <= 5:          # 손이 모델 창 직선 근처일 때만 (먼 직선 = 다른 것)
                fx, fy = c3[0] + d3[0] * t, c3[1] + d3[1] * t; a = math.atan2(d3[1], d3[0])
    dd = (math.cos(a), math.sin(a)); gx, gy = fx, fy
    hw = 7.0 if kind == 'halberd' else 4.0      # 할버드 도끼날은 창날보다 훨씬 넓다 (4칸이면 모델 도끼날이 남아 무기가 둘로 보였다)
    er = (set(near_line(pts, (gx, gy), dd, 2.5, -40, 80)) | set(near_line(pts, (gx, gy), dd, hw, 12, 80)) | set(near_line(pts, (gx, gy), dd, hw, -80, -12))) - keep   # 모델 창날이 뒤쪽에 있을 때도
    body = set(near_line(pts, (gx, gy), dd, 2.5, -40, 6))
    import colorsys
    def wpnish(c):           # 몸 쪽 구간(손 뒤~손 앞 6칸)은 자루 색(갈색·어두운 선)만 지운다 — 갑옷·얼굴은 남김
        h, l, s_ = colorsys.rgb_to_hls(c[0] / 255, c[1] / 255, c[2] / 255)
        if kind == 'dragon' and 0.68 < h < 0.82 and s_ > 0.45: return True      # 용기병: 모델이 그린 채도 높은 보라 창 (몸은 purple_split 의 낮은 채도)
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
            for p in near_line(pts, c2, d2, hw, -90, 90):
                if p not in keep and abs(p[0] - face_x) > 14: er.add(p)
    if region is not None:      # 할버드: 몸 영역 밖은 전부 모델 무기 → 지움 (도끼날이 넓고 모양이 매번 달라 직선 지우기로는 남았다)
        er |= {p for p in pts if p not in keep and not region(*p)}
        # 머리 쪽(목 위) 가는 구조 = 투구를 가로지른 모델 자루 잔해 (검수 b3: 내려찍기에서 회색 막대가 투구를 덮음). 팔·다리는 안 건드리게 목 위만
        er |= {p for p in thin if p not in keep and p[1] < region.neck_y}
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
    swap_weapon.last = math.degrees(a)
    return o.crop((M, M, M + W, M + H))


CW, FX = 128, 36          # 게임 칸: 창 계열 128, 발 x = 36 (build.py CELL), 할버드는 66
FXC = {'halberdier': 66, 'warlord': 66}
RECOLOR = {'dragoon': 'purple_split'}
REGION = {'halberdier', 'warlord'}
FIXED = {('dragoon', 'walk'), ('skyGeneral', 'walk')}     # 모델 창 직선을 따르지 않고 설계 각도(세움) — 용기병 걷기는 모델이 중간에 창을 눕혀 루프에서 90도 튀었다
# 방패: 중립 대기 편집에서 카이트 방패가 사라져(랜서) 합격 정지 그림에서 자른 방패를 뒷손 관절 자리에 몸 뒤로 깐다 (코드 무기와 같은 방식)
SHIELD = {'cavalier': ('skel/cavalier-shield.png', (-9, -12))}     # (그림, 뒷손에서 그림 왼쪽 위까지 오프셋)        # 몸 영역 밖 모델 무기 모두 지우기 (body_region)     # 정지 그림과 같은 색 입히기 (생성 원본은 회색 판금) — 코드 무기를 얹기 전에


def place(im, fx=FX):
    """96칸(발 x 48) → 128 너비, 발 x = fx — 찌르기 창끝이 칸 밖으로 잘리지 않게"""
    o = Image.new('RGBA', (CW, im.height)); o.alpha_composite(im, (fx - 48, 0)); return o


def run(cls, act):
    wp = json.load(open(os.path.join(HERE, 'skel', f'wpn-{cls}-{act}.json'), encoding='utf-8'))
    out = []
    for i, w in enumerate(wp):
        fx = FXC.get(cls, FX)
        im = place(half(Image.open(os.path.join(HERE, 'work', cls, f'skel-{act}-{i}.png')).convert('RGBA')), fx)
        if cls in RECOLOR:
            import fix as FX_; im = getattr(FX_, RECOLOR[cls])(im)
        fr = (w['front'][0] / 2 + fx - 48, w['front'][1] / 2); bk = (w['back'][0] / 2 + fx - 48, w['back'][1] / 2)
        if cls in SHIELD and 'kp' in w:
            sp, (ox, oy) = SHIELD[cls]; sh = Image.open(os.path.join(HERE, sp)).convert('RGBA')
            bx_, by_ = w['kp']['LEFT ARM'][0] / 2 + fx - 48, w['kp']['LEFT ARM'][1] / 2
            im.alpha_composite(sh, (round(bx_ + ox), round(by_ + oy)))      # 몸 위에 (몸 뒤에 깔면 망토·몸에 가려 안 보였다)
        reg = body_region(w['kp'], fx - 48) if cls in REGION and 'kp' in w else None
        im = swap_weapon(im, WPN[cls], fr, bk, w['ang'], reg, fixed=(cls, act) in FIXED); w['used'] = round(swap_weapon.last, 1)
        from pix import POL_comps
        cs = POL_comps(im); Q = im.load()
        for c_ in cs:
            if len(c_) < 40 and len(c_) < max(map(len, cs)):
                for q in c_: Q[q] = (0, 0, 0, 0)                   # 떨어진 40칸 미만 조각 (지운 창 부스러기 — 랜서 걷기 머리 위 랜스 끝)
        im.save(os.path.join(HERE, 'work', cls, f'anim-{act}-{i}.png')); out.append(im)
    # 프레임 공통 팔레트로 색 줄이기 (생성 결과 68색 → 경보) — pix.reduce (적게 쓰인 색부터 합치기·채도 벌점·살색 가중)
    from pix import reduce
    strip = Image.new('RGBA', (CW * len(out), 96))
    for k, im in enumerate(out): strip.alpha_composite(im, (k * CW, 0))
    strip = reduce(strip, 22)
    out = [strip.crop((k * CW, 0, (k + 1) * CW, 96)) for k in range(len(out))]
    for k, im in enumerate(out): im.save(os.path.join(HERE, 'work', cls, f'anim-{act}-{k}.png'))
    json.dump(wp, open(os.path.join(HERE, 'work', cls, f'anim-{act}.json'), 'w', encoding='utf-8'))     # 프레임별 동작·쓴 창 각도 (시전 줄 고르기용)
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
