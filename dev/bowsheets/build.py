# 레인저 계열 시트 조립: 원형 마네킹 동작 프레임 → 직업마다 입히기(dress2) → src/sprites/<직업>.png/.json (sheet.write_sheet)
#   python -I -B dev/bowsheets/build.py [pl|fake] [직업,...]
#     pl   = PixelLab 결과 work/<원형>/<동작>-<i>.png (0 = 첫 프레임, 1.. = 생성 프레임)
#     fake = 지금 리그로 찍은 시험 자세 mq/<원형>-<자세>.png (조립·게임 연결 시험용 — 커밋하지 않는다)
# 줄 (docs/specs/legacy-class-sheets.md 동작): idle · guard · walk · atkA · atkB · cast(pull) · castUp(pull) · hurt · death  — sit 은 없음(공용: 조립식 앉기)
#   idle  = 첫 프레임 입힌 것 + 숨쉬기(윗몸 1칸) · guard = idle 을 1칸 낮춤
#   walk  = walk 애니 · atkA = shoot · atkB = shootUp (석궁·공성은 shoot 을 반동 1칸 더 — 하늘 겨눔은 castUp 에만)
#   cast  = shoot 에서 시위가 가장 많이 당겨진 프레임까지, val = 그 프레임 당김(게임 pull 단위) — sheetFrame 이 스킬 자세 pull 에 가장 가까운 프레임을 고른다
#   castUp= shootUp 같은 식 (bowA ≤ -0.55 스킬)
#   hurt  = idle 뒤로 1·2칸 · death = idle 을 발 뒤꿈치 둘레로 뒤로 넘어뜨림(공용 rotsprite) — 마지막 프레임 유지
import os, sys, math, json
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, HERE); sys.path.insert(0, os.path.join(ROOT, 'dev', 'boxer', 'sheets')); sys.path.insert(0, os.path.join(ROOT, 'dev', 'sheets-common'))
from dress import dress2, classify, ARCH, XBOW, IDS, mannequin
from sheet import write_sheet, cell_of
from common import bob, shift
from wpn import grip_tip, rotsprite

ORDER = ['idle', 'guard', 'walk', 'atkA', 'atkB', 'cast', 'castUp', 'hurt', 'death']
WORK = os.path.join(HERE, 'work'); MQ = os.path.join(HERE, 'mq'); FIRST = os.path.join(HERE, 'first')
FAKE = {'walk': ['w0', 'stand', 'w1', 'stand'], 'shoot': ['stand', 'p6', 'p13', 'stand'], 'shootUp': ['stand', 'up', 'up', 'stand']}
PULL_PER_DOT = 1.5          # 게임 pull 은 화면 px (도트 1칸 = 1.5px)


def arch_of(cls):
    return 'mq-siege' if cls == 'siegeMaster' else ARCH[cls]


def frames(arch, act, src):
    """원형 arch 의 동작 act 프레임 목록 (마네킹 부위색 그림)"""
    if src == 'fake':
        a = 'mq-siege' if arch.startswith('mq-siege') else arch
        return [Image.open(os.path.join(MQ, f'{a}-{t}.png')).convert('RGBA') for t in FAKE[act]]
    d = os.path.join(WORK, arch); out = []; i = 1
    while os.path.exists(os.path.join(d, f'{act}-{i}.png')):
        out.append(Image.open(os.path.join(d, f'{act}-{i}.png')).convert('RGBA')); i += 1
    return out


def first(arch, src):
    if src == 'fake': return Image.open(os.path.join(MQ, f'{"mq-siege" if arch.startswith("mq-siege") else arch}-stand.png')).convert('RGBA')
    return Image.open(os.path.join(FIRST, ('mq-siege-sh' if arch == 'mq-siege' else arch) + '.png')).convert('RGBA')


def pull_of(M, xbow):
    """마네킹 프레임의 시위 당김(도트): 시위 칸(무기 밝은 단)이 활대 축에서 몸 쪽(뒤)으로 가장 멀리 간 거리"""
    MP = classify(M)
    limb = [p for p, (k, i) in MP.items() if k == 'weapon' and (i == 1 if xbow else i != 2)]
    string = [p for p, (k, i) in MP.items() if k == 'weapon' and i == 2]
    glove = [p for p, (k, i) in MP.items() if k == 'glove']
    if len(limb) < 6 or not string: return 0.0
    g, t = grip_tip(limb, glove, 'up')
    dx, dy = t[0] - g[0], t[1] - g[1]; L = math.hypot(dx, dy) or 1; nx, ny = -dy / L, dx / L     # 축에 수직
    if nx > 0: nx, ny = -nx, -ny                                                                  # 뒤(몸 쪽, -x)를 + 로
    return max(0.0, max((p[0] - g[0]) * nx + (p[1] - g[1]) * ny for p in string))


def cast_row(Fd, Fm, xbow):
    """(입힌 프레임, 마네킹 프레임) → 당김이 커지는 앞부분과 val"""
    ps = [pull_of(m, xbow) for m in Fm]; base = ps[0]
    k = max(range(len(ps)), key=lambda i: ps[i])
    fr = Fd[:k + 1]; val = [round(max(0.0, p - base) * PULL_PER_DOT, 1) for p in ps[:k + 1]]
    if len(fr) == 1: fr, val = fr * 2, [0, val[0]]
    return fr, val, k


def build(cls, src):
    arch = arch_of(cls); xbow = cls in XBOW; W, foot = cell_of(cls)
    cut = foot[1] - 10                                      # 숨쉬기: 이 줄 위가 1칸 내려간다
    s = dress2(cls, first(arch, src))
    A = {'idle': dict(frames=[s, bob(s, cut, 1), bob(s, cut, 1), s], fps=6, loop=True),
         'guard': dict(frames=[bob(s, cut, 1), bob(s, cut, 2), bob(s, cut, 2), bob(s, cut, 1)], fps=8, loop=True)}
    wm = frames(arch, 'walk', src); A['walk'] = dict(frames=[dress2(cls, m) for m in wm], fps=10, loop=True)
    sm = frames(arch, 'shoot', src); sd = [dress2(cls, m) for m in sm]
    cfr, cval, k = cast_row(sd, sm, xbow)
    A['atkA'] = dict(frames=sd, fps=14, loop=False, hit=min(len(sd) - 1, k + 1))
    if xbow:   # 석궁: 평타 B = 같은 쏘기, 발사 뒤 프레임을 1칸 더 뒤로 (큰 반동)
        A['atkB'] = dict(frames=[f if i <= k else shift(f, -1, 0) for i, f in enumerate(sd)], fps=12, loop=False, hit=min(len(sd) - 1, k + 1))
    um = frames(arch, 'shootUp', src) if os.path.exists(os.path.join(WORK, arch, 'shootUp-1.png')) or src == 'fake' else []
    if um:
        ud = [dress2(cls, m) for m in um]; ufr, uval, uk = cast_row(ud, um, xbow)
        if not xbow: A['atkB'] = dict(frames=ud, fps=12, loop=False, hit=min(len(ud) - 1, uk + 1))
        A['castUp'] = dict(frames=ufr, fps=10, loop=True, key='pull', val=uval)
    elif not xbow:
        A['atkB'] = dict(frames=sd, fps=14, loop=False, hit=min(len(sd) - 1, k + 1))
    A['cast'] = dict(frames=cfr, fps=10, loop=True, key='pull', val=cval)
    A['hurt'] = dict(frames=[shift(s, -2, 0), shift(s, -1, 0)], fps=12, loop=False)
    heel = (foot[0] - 4, foot[1])
    dth = []
    for deg in (0, -25, -55, -85, -90):          # 뒤로 넘어짐 (화면 반시계 = 뒤), 마지막은 누운 채
        if deg == 0: dth.append(shift(s, -1, 0)); continue
        r, rp = rotsprite(s, deg, heel); o = Image.new('RGBA', s.size); o.alpha_composite(r, (round(heel[0] - rp[0]), round(heel[1] - rp[1])) if False else (0, 0))
        o = Image.new('RGBA', s.size); o.paste(r, (round(heel[0] - rp[0]), round(heel[1] - rp[1])), r)
        dth.append(o)
    A['death'] = dict(frames=dth, fps=8, loop=False)
    order = [a for a in ORDER if a in A]
    return write_sheet(cls, A, order)


if __name__ == '__main__':
    src = sys.argv[1] if len(sys.argv) > 1 else 'pl'
    ids = sys.argv[2].split(',') if len(sys.argv) > 2 else IDS
    for c in ids:
        m = build(c, src)
        print(c, {a: (v['frames'], v.get('val')) for a, v in m['anims'].items() if a in ('cast', 'castUp', 'atkA', 'atkB')})
