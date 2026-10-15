# 레인저 계열 시트 조립: 원형 마네킹 동작 프레임 → 직업마다 입히기(dress2) → src/sprites/<직업>.png/.json (sheet.write_sheet)
#   python -I -B dev/bowsheets/build.py [pl|fake] [직업,...]
#     pl   = PixelLab 결과 work/<원형>/<동작>-<i>.png (0 = 첫 프레임, 1.. = 생성 프레임)
#     fake = 지금 리그로 찍은 시험 자세 mq/<원형>-<자세>.png (조립·게임 연결 시험용 — 커밋하지 않는다)
# 줄 (docs/specs/legacy-class-sheets.md 동작): idle · guard · walk · atkA · atkB · cast(pull) · castUp(pull) · hurt · death  — sit 은 없음(공용: 조립식 앉기)
#   idle  = 첫 프레임 입힌 것 + 숨쉬기(윗몸 1칸) · guard = idle 을 1칸 낮춤
#   walk  = walk 애니 · atkA = shoot · atkB = 활: shootUp, 석궁: shoot 의 발사 뒤를 1칸 더 뒤로(큰 반동)
#   cast  = 스킬 자세 pull 에 맞춘 프레임 (val = 게임 pull 값, sheetFrame 이 가장 가까운 것을 고른다) · castUp = 하늘 겨눔 (bowA ≤ -0.55)
#   hurt  = idle 뒤로 2·1칸 · death = idle 을 발 뒤꿈치 둘레로 뒤로 넘어뜨림(공용 rotsprite) — 마지막 프레임 유지
# 수리 (2026-10-16 PixelLab 결과, 재호출 없음):
#   - 무기가 빠진 프레임(가는 활대를 PixelLab 이 지움 등): 이웃 프레임의 "손 → 손 점·끝 점" 관계를 옮겨 쓴다. 손이 이웃보다 3칸 넘게 올라가 있으면 45° 위로 겨눈 것으로
#   - 활 시위: PixelLab 이 지우거나 흩뜨려서 코드로 그린다 (PULL 표의 당김 도트, 0 = 쉴 때 직선)
import os, sys, math
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, HERE); sys.path.insert(0, os.path.join(ROOT, 'dev', 'boxer', 'sheets')); sys.path.insert(0, os.path.join(ROOT, 'dev', 'sheets-common'))
from dress import dress2, ARCH, XBOW, IDS, geom, glove_c
from sheet import write_sheet, cell_of
from common import bob, shift
from wpn import rotsprite

ORDER = ['idle', 'guard', 'walk', 'atkA', 'atkB', 'cast', 'castUp', 'hurt', 'death']
WORK = os.path.join(HERE, 'work'); MQ = os.path.join(HERE, 'mq'); FIRST = os.path.join(HERE, 'first')
FAKE = {'walk': ['w0', 'stand', 'w1', 'stand'], 'shoot': ['stand', 'p6', 'p13', 'stand'], 'shootUp': ['stand', 'up', 'up', 'stand']}
PX_PER_DOT = 1.5            # 게임 pull 은 화면 px (도트 1칸 = 1.5px)
# 활 시위 당김(도트) — 프레임 순서대로. 쏘기 8프레임: 당김 → 끝까지 → 놓음(5번째부터 0), 하늘 쏘기 4프레임
PULL = {'shoot': [1, 3, 5, 8, 8, 0, 0, 0], 'shootUp': [4, 8, 0, 0], 'walk': None}


def arch_of(cls):
    return 'mq-siege' if cls == 'siegeMaster' else ARCH[cls]


def frames(arch, act, src):
    if src == 'fake':
        return [Image.open(os.path.join(MQ, f'{arch}-{t}.png')).convert('RGBA') for t in FAKE[act]]
    d = os.path.join(WORK, arch); out = []; i = 1
    while os.path.exists(os.path.join(d, f'{act}-{i}.png')):
        out.append(Image.open(os.path.join(d, f'{act}-{i}.png')).convert('RGBA')); i += 1
    return out


def first(arch, src):
    if src == 'fake': return Image.open(os.path.join(MQ, f'{arch}-stand.png')).convert('RGBA')
    return Image.open(os.path.join(FIRST, {'mq-siege': 'mq-siege-sh', 'mq-bow': 'mq-bow'}.get(arch, arch) + '.png')).convert('RGBA')


def ang_of(g):
    return math.degrees(math.atan2(g[1][1] - g[0][1], g[1][0] - g[0][0]))


def fill_geoms(cls, Ms, ref, steady=False):
    """프레임마다 (손 점, 끝 점). 빠진 프레임은 가장 가까운 이웃(없으면 첫 프레임 ref)의 손 기준 관계로.
    steady(걷기·평쏘기): 각도가 프레임들의 가운데값에서 40° 넘게 벗어나면 잘못 잰 것으로 보고 빠진 것처럼 메운다"""
    G = [geom(cls, m) for m in Ms]; C = [glove_c(m) for m in Ms]
    if steady:
        a = sorted(ang_of(g) for g in G if g)
        if a:
            med = a[len(a) // 2]
            G = [g if g and abs((ang_of(g) - med + 180) % 360 - 180) <= 40 else None for g in G]
    rg, rc = geom(cls, ref), glove_c(ref)
    out = []
    for i, g in enumerate(G):
        if g: out.append(g); continue
        js = sorted((j for j in range(len(G)) if G[j] and C[j]), key=lambda j: abs(j - i))
        sg, sc = (G[js[0]], C[js[0]]) if js else (rg, rc)
        c = C[i] or sc
        if not (sg and sc and c): out.append(None); continue
        gp = (c[0] + sg[0][0] - sc[0], c[1] + sg[0][1] - sc[1]); v = (sg[1][0] - sg[0][0], sg[1][1] - sg[0][1])
        if c[1] < sc[1] - 3:                     # 손을 들어 올렸다 → 45° 위로 겨눔 (끝 점 방향을 앞·위 대각선으로)
            L = math.hypot(*v); v = (L * 0.71, -L * 0.71) if cls in XBOW else (-L * 0.71, -L * 0.71)
        out.append((gp, (gp[0] + v[0], gp[1] + v[1])))
    return out


def dress_seq(cls, Ms, ref, act, shoulder):
    gs = fill_geoms(cls, Ms, ref, steady=act in ('walk', 'shoot')); pulls = PULL.get(act) if cls not in XBOW else None
    out = []
    for i, m in enumerate(Ms):
        wf = {}
        if gs[i]: wf['gp'], wf['tp'] = gs[i]
        if cls not in XBOW: wf['pull'] = pulls[i] if pulls and i < len(pulls) else 0
        out.append(dress2(cls, m, wfix=wf, shoulder=shoulder))
    return out


def build(cls, src):
    arch = arch_of(cls); xbow = cls in XBOW; W, foot = cell_of(cls); shoulder = src == 'fake'
    cut = foot[1] - 10                                      # 숨쉬기: 이 줄 위가 1칸 내려간다
    F0 = first(arch, src)
    s = dress2(cls, F0, wfix=None if xbow else {'pull': 0}, shoulder=shoulder)
    A = {'idle': dict(frames=[s, bob(s, cut, 1), bob(s, cut, 1), s], fps=6, loop=True),
         'guard': dict(frames=[bob(s, cut, 1), bob(s, cut, 2), bob(s, cut, 2), bob(s, cut, 1)], fps=8, loop=True)}
    A['walk'] = dict(frames=dress_seq(cls, frames(arch, 'walk', src), F0, 'walk', shoulder), fps=10, loop=True)
    sm = frames(arch, 'shoot', src); sd = dress_seq(cls, sm, F0, 'shoot', shoulder)
    if xbow:
        hit = 1 if len(sd) <= 5 else 3                     # 석궁 4프레임: 겨눔 → 발사(1) · 공성 8프레임: 반동 시작(3)
        A['atkA'] = dict(frames=sd, fps=12, loop=False, hit=hit)
        A['atkB'] = dict(frames=[f if i < hit else shift(f, -1, 0) for i, f in enumerate(sd)], fps=12, loop=False, hit=hit)
        A['cast'] = dict(frames=[sd[0], sd[min(len(sd) - 1, hit + 1)]], fps=10, loop=True, key='pull', val=[12, 0])   # 장전 겨눔 / 쏜 뒤
    else:
        P = PULL['shoot']; hit = next(i for i, p in enumerate(P) if i and p == 0 and P[i - 1] > 0)
        A['atkA'] = dict(frames=sd, fps=14, loop=False, hit=hit)
        pk = [i for i in range(hit) if P[i] in (3, 5, 8)][:3]
        A['cast'] = dict(frames=[s] + [sd[i] for i in pk], fps=10, loop=True, key='pull', val=[0] + [round(P[i] * PX_PER_DOT, 1) for i in pk])
    um = frames(arch, 'shootUp', src) if src == 'fake' or os.path.exists(os.path.join(WORK, arch, 'shootUp-1.png')) else []
    if um:
        ud = dress_seq(cls, um, F0, 'shootUp', shoulder)
        if not xbow:
            PU = PULL['shootUp']; uh = PU.index(0)
            A['atkB'] = dict(frames=ud, fps=12, loop=False, hit=uh)
            A['castUp'] = dict(frames=ud[:uh], fps=10, loop=True, key='pull', val=[round(p * PX_PER_DOT, 1) for p in PU[:uh]])
        else:
            A['castUp'] = dict(frames=ud, fps=10, loop=True, key='pull', val=[12, 12, 6, 0][:len(ud)])
    elif not xbow:
        A['atkB'] = A['atkA']
    A['hurt'] = dict(frames=[shift(s, -2, 0), shift(s, -1, 0)], fps=12, loop=False)
    heel = (foot[0] - 4, foot[1])
    dth = [shift(s, -1, 0)]
    for deg in (-25, -55, -85, -90):             # 뒤로 넘어짐 (화면 반시계 = 뒤), 마지막은 누운 채
        r, rp = rotsprite(s, deg, heel); o = Image.new('RGBA', s.size)
        o.paste(r, (round(heel[0] - rp[0]), round(heel[1] - rp[1])), r)
        bb = o.getbbox()          # 누운 몸(+ 등 뒤 원반·고리)이 칸 왼쪽을 넘지 않게 밀고, 바닥은 땅(발 기준점)에
        o = shift(o, max(0, 1 - bb[0]), (foot[1] - (bb[3] - 1)) if deg <= -55 else 0)
        dth.append(o)
    A['death'] = dict(frames=dth, fps=8, loop=False)
    order = [a for a in ORDER if a in A]
    return write_sheet(cls, A, order)


if __name__ == '__main__':
    src = sys.argv[1] if len(sys.argv) > 1 else 'pl'
    ids = sys.argv[2].split(',') if len(sys.argv) > 2 else IDS
    for c in ids:
        m = build(c, src)
        print(c, {a: (v['frames'], v.get('hit'), v.get('val')) for a, v in m['anims'].items()})
