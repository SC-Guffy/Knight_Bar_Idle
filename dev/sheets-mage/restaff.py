# 게임 지팡이를 확대해 쓴 마법사 계열 5종의 지팡이 계단 없애기 (2026-10-18 로드맵 "개선해", PixelLab 0)
#  지금 시트 = 96칸 시트(지팡이 = 게임 캡처 1.5배 NEAREST)를 rescale.py 로 0.78 BOX 축소 → 지팡이가 1.17배로 뭉개져 계단·번짐.
#  여기서는 지팡이를 뺀 몸 프레임(skel/<cls>/<part>-body, skelgen post 가 저장)만 0.78 로 줄이고,
#  게임 지팡이를 1배 원본 도트 그대로 공용 wpn.overlay(RotSprite 회전)로 얹는다 → 확대 없이 또렷한 도트.
#  줄 구성은 build.py build_skel 과 같다 (fix3 프레임 교체 · 걷기 재생성 줄 · 시전 정지 프레임 빼기 · idle/guard/hurt/death 파생).
#  python -I -B dev/sheets-mage/restaff.py [cls ...]   → src/sprites/<cls>.png/.json (75칸) · 그다음 node dev/boxer/sheet-meta.js
import os, sys, json, math
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, os.path.join(ROOT, 'dev', 'sheets-common')); sys.path.insert(0, HERE)
from wpn import WeaponSprite, overlay
import build as BD, fix3

S = 0.78; N = 96; NS = round(N * S)
CLASSES = ['mage', 'electromancer', 'archmage', 'frostlord', 'thunderEmperor']
WALK = {'archmage': 'W', 'frostlord': 'W3', 'thunderEmperor': 'W2'}       # 걷기 줄 출처 (나머지 = B 7~14)
FULL = os.path.join(ROOT, 'dev', 'sheets-common', 'full')


def load_rescale():
    import importlib.util
    sp = importlib.util.spec_from_file_location('rescale_mod', os.path.join(ROOT, 'dev', 'sheets-common', 'rescale.py'))
    src = open(sp.origin, encoding='utf-8').read().replace('\nmain()\n', '\n')       # 함수만 (파일 끝 main() 실행 빼기)
    src = src.replace('S = float(sys.argv[1]) if len(sys.argv) > 1 else 0.78', 'S = 0.78')
    mod = {'__file__': sp.origin, '__name__': 'rescale_mod'}; exec(compile(src, sp.origin, 'exec'), mod); return mod


RS = load_rescale()


def staff(cls):
    import mannequin as MQ
    g0 = MQ.staff_sprite(cls, MQ.parts(cls)[1])          # 게임 지팡이 1배 원본
    W = g0.img.load()
    lt = max(((x - g0.grip[0]) * math.cos(g0.ang) + (y - g0.grip[1]) * math.sin(g0.ang)) for y in range(g0.img.height) for x in range(g0.img.width) if W[x, y][3])
    return g0, lt


def frames(cls):
    """(몸 96칸, 손 점, 각도) 줄별 목록 — build_skel 과 같은 구성"""
    d = os.path.join(HERE, 'skel', cls)
    def part(p, n=15):
        poses = json.load(open(os.path.join(d, f'{p}-pose.json')))
        return [(Image.open(os.path.join(d, f'{p}-body', f'{i}.png')).convert('RGBA'), poses[i]) for i in range(n)]
    A, B = part('A'), part('B')
    R = {'A': A, 'B': B}
    for (p, i), (q, j) in fix3.REPLACE.get(cls, {}).items(): R[p][i] = R[q][j]
    walk = part(WALK[cls], 8) if cls in WALK else B[7:15]
    cast = [f for k, f in enumerate(B[0:7]) if k not in BD.SKEL_CAST_DROP.get(cls, [])]
    return {'base': A[14], 'walk': walk, 'atkA': A[0:7], 'atkB': A[7:14], 'cast': cast}


def small(body, pose, ws, lt, pal):
    sb = RS['down'](body, NS, NS, pal)
    g = (pose['g'][0] * S, pose['g'][1] * S); a = pose['a']
    t = (g[0] + 20 * math.cos(a), g[1] + 20 * math.sin(a))
    B = sb.load(); front = [(x, y) for y in range(NS) for x in range(NS) if B[x, y][3] and (x - g[0]) ** 2 + (y - g[1]) ** 2 <= 2.3]
    o = overlay(sb, set(), g, t, ws, front=front)
    O = o.load(); bb = sb.getbbox(); foot = bb[3] - 1 if bb else NS - 1
    for y in range(foot + 1, NS):
        for x in range(NS):
            if O[x, y][3] and not B[x, y][3]: O[x, y] = (0, 0, 0, 0)
    return o, [round(g[0] + lt * math.cos(a)), round(g[1] + lt * math.sin(a))]


def build(cls):
    full = Image.open(os.path.join(FULL, f'{cls}.png')).convert('RGBA'); pal = RS['palette_img'](full)
    fm = json.load(open(os.path.join(FULL, f'{cls}.json'), encoding='utf-8'))
    ws, lt = staff(cls); F = frames(cls)
    core = {k: [small(b, p, ws, lt, pal) for b, p in (v if isinstance(v, list) else [v])] for k, v in F.items()}
    base, tb = core['base'][0]
    foot = (round(fm['foot'][0] * S), round(fm['foot'][1] * S)); waist = foot[1] - round(16 * S)
    A = {'idle': [base, base, BD.bob(base, waist, 1), BD.bob(base, waist, 1)], 'walk': [f for f, t in core['walk']],
         'atkA': [f for f, t in core['atkA']], 'atkB': [f for f, t in core['atkB']], 'cast': [f for f, t in core['cast']]}
    T = {'idle': [tb, tb, [tb[0], tb[1] + 1], [tb[0], tb[1] + 1]], 'walk': [t for f, t in core['walk']],
         'atkA': [t for f, t in core['atkA']], 'atkB': [t for f, t in core['atkB']], 'cast': [t for f, t in core['cast']]}
    A['guard'] = [BD.bob(f, waist, 1) for f in A['idle']]; T['guard'] = [[t[0], t[1] + 1] for t in T['idle']]
    A['hurt'] = [BD.shift(base, -2, 0), BD.shift(base, -1, 0)]; T['hurt'] = [[tb[0] - 2, tb[1]], [tb[0] - 1, tb[1]]]
    A['death'] = [A['hurt'][0]] + [BD.fall(A['hurt'][0], a, foot) for a in (25, 50, 75, 90)]; T['death'] = [T['hurt'][0]] * 5
    # 줄 구성·fps·key 는 지금 시트(full 메타)를 그대로 쓴다 — 프레임 수가 다르면 멈춘다
    for k, m in fm['anims'].items():
        if m['frames'] != len(A[k]): sys.exit(f'{cls} {k}: 프레임 수 {len(A[k])} != 메타 {m["frames"]}')
    n = max(len(v) for v in A.values()); order = sorted(fm['anims'], key=lambda k: fm['anims'][k]['row'])
    sheet = Image.new('RGBA', (NS * n, NS * len(order)))
    pts = {}
    for k in order:
        r = fm['anims'][k]['row']
        for i, f in enumerate(A[k]): sheet.alpha_composite(f, (NS * i, NS * r))
        pts[k] = [[max(0, min(NS - 1, t[0])), max(0, min(NS - 1, t[1]))] + BD.head_pt(f) for f, t in zip(A[k], T[k])]
    out = {'w': NS, 'h': NS, 'foot': list(foot), 'anims': fm['anims'], 'pts': pts}
    sheet.save(os.path.join(ROOT, 'src', 'sprites', f'{cls}.png'))
    json.dump(out, open(os.path.join(ROOT, 'src', 'sprites', f'{cls}.json'), 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    print('restaff', cls, sheet.size, 'foot', foot, 'staff', ws.img.size)


if __name__ == '__main__':
    for c in (sys.argv[1:] or CLASSES): build(c)
