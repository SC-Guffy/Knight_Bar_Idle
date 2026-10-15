# 창기사 계열: 원형 마네킹 동작(PixelLab) → 7종 입히기 + 무기 덧그리기 + 실루엣 장식 → frames/<cls>/<anim>-<i>.png (build.py --src gen 이 묶는다)
#   python -I -B gen.py inputs     → work/mq-in/*.png (PixelLab 첫 프레임: 창 마네킹 대기·전투 대기, 할버드 마네킹 전투 대기)
#   python -I -B gen.py dress      → frames/<cls>/ (idle·walk·atkA·atkB·cast) + cast.json (프레임별 무기 각도)
#  PixelLab 결과 위치 (plx.py anim mq <이름> …): work/mq/<이름>-<i>.png, 0번은 넣은 첫 프레임이라 1번부터 쓴다.
#   이름: idle · walk (공용) · spearA · spearB (찌르기형) · halbA · halbB (휩쓸기형)
#  cast 줄은 따로 뽑지 않는다: 평타 두 줄의 마네킹 무기 각도(wpn.grip_tip)를 재 각도순으로 골라 만든다 (key wa, val = 잰 각도)
import os, sys, json, math, glob
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import dress as D          # dev/spear/dress.py (마네킹·입히기·장식)
from wpn import grip_tip, line_fit, near_line

WORK = os.path.join(HERE, 'work')
SRC = {'idle': 'idle', 'walk': 'walk', 'atkA': {'spear': 'spearA', 'halberd': 'halbA'}, 'atkB': {'spear': 'spearB', 'halberd': 'halbB'}}


def gen_frames(name):
    fs = sorted(glob.glob(os.path.join(WORK, 'mq', f'{name}-*.png')), key=lambda p: int(p.rsplit('-', 1)[1][:-4]))
    return [Image.open(f).convert('RGBA') for f in fs[1:]]          # 0 = 넣은 첫 프레임


def solid(im, N):
    im = im.convert('RGBA')
    if im.size != (N, N):
        o = Image.new('RGBA', (N, N)); o.paste(im, ((N - im.width) // 2, N - im.height)); im = o
    px = im.load()
    for y in range(N):
        for x in range(N):
            c = px[x, y]; px[x, y] = c[:3] + (255,) if c[3] >= 128 else (0, 0, 0, 0)
    return im


# 다시 뽑지 않고 고르기 (재시도 0): 대기 애니는 3·4번에서 창이 앞으로 눕고 하늘에 이펙트가 섞여 창이 선 1·2번만 왕복
PICK = {'idle': [0, 1, 1, 0]}
# 생성 원본의 발 x (넣은 첫 프레임 기준: 공용·창은 창 마네킹 36, 할버드는 그때 칸 발 56) → 직업 칸 발(dress.CELL)로 옮긴다
SRC_FX = {'idle': 36, 'walk': 36, 'spearA': 36, 'spearB': 36, 'halbA': 56, 'halbB': 56}


def despeck(im, keep=0.15):
    """몸에서 떨어진 조각(반짝이·이펙트 그림) 지우기: 가장 큰 덩어리의 keep 배보다 작은 덩어리"""
    from common import components
    cs = components(im)
    if not cs: return im
    big = max(len(c) for c in cs); P = im.load()
    for c in cs:
        if len(c) < big * keep:
            for p in c: P[p] = (0, 0, 0, 0)
    return im


def ground(im, foot_y):
    """가장 낮은 칸을 땅(발 y)에 붙인다 — 애니가 몸을 조금 띄우거나 내려도 발 기준점이 같게"""
    bb = im.getbbox()
    if not bb: return im
    o = Image.new('RGBA', im.size); o.paste(im, (0, foot_y - (bb[3] - 1))); return o


def wa_of(M):
    """마네킹 프레임 무기 각도 (0 = 앞 수평, −π/2 = 위) — dress.weapon_axis 와 같은 판단"""
    W = D.weapon_axis(D.classify(M))
    if not W: return None
    _, g, t, _ = W
    return math.atan2(t[1] - g[1], t[0] - g[0])


def pick_cast(cands, n=9, gap=0.12):
    """(각도, 그림) 들에서 각도가 고르게 퍼진 n 장"""
    cands = sorted([c for c in cands if c[0] is not None], key=lambda c: c[0]); out = []
    for c in cands:
        if not out or c[0] - out[-1][0] >= gap: out.append(c)
    while len(out) > n:              # 가장 촘촘한 곳부터 뺀다
        k = min(range(1, len(out) - 1), key=lambda i: out[i + 1][0] - out[i - 1][0]); out.pop(k)
    return out


if __name__ == '__main__':
    cmd = sys.argv[1]
    if cmd == 'inputs':
        od = os.path.join(WORK, 'mq-in'); os.makedirs(od, exist_ok=True)
        D.mannequin('spear', 'idle').save(os.path.join(od, 'idle.png'))
        D.mannequin('spear', 'guard').save(os.path.join(od, 'spear-guard.png'))
        D.mannequin('halberd', 'guard').save(os.path.join(od, 'halberd-guard.png'))
        print('ok', od)
    elif cmd == 'dress':
        pal_src = open(os.path.join(HERE, '..', '..', 'src', 'classes.js'), encoding='utf-8').read()
        import re
        def pal(cls):
            m = re.search(r'\n  ' + cls + r': \{.*?pal: \{([^}]*)\}', pal_src, re.S)
            return dict(re.findall(r"(\w): '(#[0-9a-fA-F]{6})'", m.group(1)))
        only = sys.argv[2:] or list(D.ARCH)
        for cls in only:
            arch = D.ARCH[cls]; N, (fx, fy) = D.CELL[arch]; P = pal(cls)
            od = os.path.join(HERE, 'frames', cls); os.makedirs(od, exist_ok=True)
            for f in glob.glob(os.path.join(od, '*.png')): os.remove(f)
            casts = []
            for anim, src in SRC.items():
                name = src if isinstance(src, str) else src[arch]
                fs = gen_frames(name)
                if anim in PICK: fs = [fs[k] for k in PICK[anim]]
                for i, M in enumerate(fs):
                    M = ground(despeck(solid(M, N)), fy)
                    if fx != SRC_FX[name]: S_ = Image.new('RGBA', M.size); S_.paste(M, (fx - SRC_FX[name], 0)); M = S_
                    o, MP, pl, _ = D.dress(cls, M)
                    o = D.tidy(o, pl, minc=6)
                    if cls in D.FEAT:
                        g = D.geo(MP); g['blade'] = D.wpn_now(o, cls, 'guard'); D.FEAT[cls](o, g, P); o = D.outline_out(o)
                    from common import components
                    P_ = o.load()
                    for cp in components(o):
                        if len(cp) < 5:                    # 남은 한두 칸 점
                            for q in cp: P_[q] = (0, 0, 0, 0)
                    o.save(os.path.join(od, f'{anim}-{i}.png'))
                    if anim in ('atkA', 'atkB'): casts.append((wa_of(M), o))
            cast = pick_cast(casts)
            for i, (a, im) in enumerate(cast): im.save(os.path.join(od, f'cast-{i}.png'))
            json.dump({'val': [round(a, 2) for a, _ in cast], 'wrap': arch == 'halberd'}, open(os.path.join(od, 'cast.json'), 'w'))
            print(cls, {a: len(glob.glob(os.path.join(od, a + '-*.png'))) for a in ('idle', 'walk', 'atkA', 'atkB', 'cast')}, 'cast wa', [round(a, 2) for a, _ in cast])
