# 레인저 계열 시트 조립 v2 (2026-10-17): 관절 애니(skeleton-v3) 후처리 프레임 → src/sprites/<직업>.png/.json (sheet.write_sheet)
#   C:\AI\ComfyUI\.venv\Scripts\python.exe -I -B -X utf8 dev/bowsheets/build2.py <직업> walk=<act>:<판> shoot=<act>:<판> sky=<act>:<판> [hit=5] [uphit=5]
#     프레임 = work/<직업>/post-<act>-<판>-<i>.png (96칸, 발 (48, 88)) — 칸 발 기준점(cell_of)으로 옮긴다
# 줄: idle · guard · walk · atkA · atkB · cast(pull) · castUp(pull) · hurt · death (sit 은 공용 조립식)
#   idle  = 쏘기 0번(활을 든 대기) + 숨쉬기 · guard = 1칸 낮춤
#   atkA  = 쏘기 8f (hit = 놓는 프레임) · atkB = 하늘 쏘기 8f
#   cast  = idle + 쏘기 당김 프레임 (pull 값) · castUp = 하늘 쏘기 당김 프레임 (bowA ≤ -0.55)
#   hurt·death = idle 에서 (build.py 와 같은 방식)
import os, sys
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, HERE); sys.path.insert(0, os.path.join(ROOT, 'dev', 'boxer', 'sheets')); sys.path.insert(0, os.path.join(ROOT, 'dev', 'sheets-common'))
from sheet import write_sheet, cell_of
from common import bob, shift
from wpn import rotsprite
ORDER = ['idle', 'guard', 'walk', 'atkA', 'atkB', 'cast', 'castUp', 'hurt', 'death']
SRC_FOOT = (48, 88)


def load(cls, spec, foot, W=96):
    act, tag = spec.split(':'); d = os.path.join(HERE, 'work', cls); out = []; i = 0
    while os.path.exists(os.path.join(d, f'post-{act}-{tag}-{i}.png')):
        f = Image.open(os.path.join(d, f'post-{act}-{tag}-{i}.png')).convert('RGBA')
        o = Image.new('RGBA', (W, W)); o.paste(f, (foot[0] - SRC_FOOT[0], foot[1] - SRC_FOOT[1])); out.append(o); i += 1   # 칸 크기(공성 128)로 옮겨 앉힘
    if not out: raise SystemExit(f'no frames {cls} {spec}')
    return out


def build(cls, spec, hit=5, uphit=5):
    W, foot = cell_of(cls); cut = foot[1] - 10
    wk, sh, sk = load(cls, spec['walk'], foot, W), load(cls, spec['shoot'], foot, W), load(cls, spec['sky'], foot, W)
    s = sh[0]
    A = {'idle': dict(frames=[s, bob(s, cut, 1), bob(s, cut, 1), s], fps=6, loop=True),
         'guard': dict(frames=[bob(s, cut, 1), bob(s, cut, 2), bob(s, cut, 2), bob(s, cut, 1)], fps=8, loop=True),
         'walk': dict(frames=wk, fps=10, loop=True),
         'atkA': dict(frames=sh, fps=14, loop=False, hit=hit),
         'atkB': dict(frames=sk, fps=14, loop=False, hit=uphit)}
    pk = [1, 2, hit - 1] if hit >= 4 else [1]
    A['cast'] = dict(frames=[s] + [sh[i] for i in pk], fps=10, loop=True, key='pull', val=[0, 4.5, 7.5, 12.0][:len(pk) + 1])
    A['castUp'] = dict(frames=[sk[max(1, uphit - 3)], sk[uphit - 1]], fps=10, loop=True, key='pull', val=[6.0, 12.0])
    A['hurt'] = dict(frames=[shift(s, -2, 0), shift(s, -1, 0)], fps=12, loop=False)
    heel = (foot[0] - 4, foot[1]); dth = [shift(s, -1, 0)]
    for deg in (-25, -55, -85, -90):
        r, rp = rotsprite(s, deg, heel); o = Image.new('RGBA', s.size)
        o.paste(r, (round(heel[0] - rp[0]), round(heel[1] - rp[1])), r)
        bb = o.getbbox()
        o = shift(o, max(0, 1 - bb[0]), (foot[1] - (bb[3] - 1)) if deg <= -55 else 0)
        dth.append(o)
    A['death'] = dict(frames=dth, fps=8, loop=False)
    return write_sheet(cls, A, [a for a in ORDER if a in A])


if __name__ == '__main__':
    cls = sys.argv[1]; kv = dict(a.split('=', 1) for a in sys.argv[2:])
    m = build(cls, kv, int(kv.get('hit', 5)), int(kv.get('uphit', 5)))
    print(cls, {a: (v['frames'], v.get('hit'), v.get('val')) for a, v in m['anims'].items()})
