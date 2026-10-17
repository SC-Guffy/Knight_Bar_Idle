# 관절 애니 결과(anim_post.py → work/<cls>/anim-<묶음>-<i>.png, 128×96 발 y 88) → build.py 가 읽는 frames/<cls>/<줄>-<i>.png (128×128 발 y 112)
#  줄 배정은 PLAN[cls] = {줄: (묶음, [프레임 번호])}. 시전 줄은 평타 프레임 중 창 각도(anim-<묶음>.json 'used', 도)가
#  build.py CAST val(라디안, 0 = 앞, 음수 = 위)에 가장 가까운 것을 골라 cast.json 과 함께 쓴다 (유료 0, 로드맵: 평타 프레임 각도순 재배열).
#   python -I -B assemble.py <cls>   → frames/<cls>/ 를 비우고 다시 채움 (옛 입히기 방식 프레임은 frames/_old/<cls>/ 로 옮겨 둠)
import os, sys, json, math, shutil
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import build as B

PLAN = {
    'lancer': {'atkA': ('thrust', range(8)), 'atkB': ('slam8+idle4', range(1, 8)), 'idle': ('slam8+idle4', range(8, 12)), 'walk': ('walk', range(8))},
    'dragoon': {'atkA': ('thrust7+slam8', range(0, 7)), 'atkB': ('thrust7+slam8', range(8, 15)), 'walk': ('walk', range(8))},     # 7 = 찌르기→내리찍기 전환
    'halberdier': {'atkA': ('sweep7+chop8', range(0, 7)), 'atkB': ('sweep7+chop8', range(8, 15)), 'walk': ('walk', range(8))},
    'cavalier': {'atkA': ('thrust7+slam8', range(0, 7)), 'atkB': ('thrust7+slam8', range(8, 15)), 'walk': ('walk', range(8))},
}
IDLE_FROM = ('walk', 0)        # 대기 줄이 PLAN 에 없으면: 걷기 첫 프레임(창 세워 든 자세)을 들썩여 4f (유료 0)


def load(cls, bundle, i):
    im = Image.open(os.path.join(HERE, 'work', cls, f'anim-{bundle}-{i}.png')).convert('RGBA')
    o = Image.new('RGBA', (128, 128)); o.alpha_composite(im, (0, 112 - 88)); return o


def run(cls):
    dst = os.path.join(HERE, 'frames', cls)
    if os.path.isdir(dst) and not os.path.exists(os.path.join(dst, '.skel')):
        old = os.path.join(HERE, 'frames', '_old', cls); os.makedirs(os.path.dirname(old), exist_ok=True)
        if os.path.exists(old): shutil.rmtree(old)
        shutil.move(dst, old)
    if os.path.isdir(dst): shutil.rmtree(dst)
    os.makedirs(dst); open(os.path.join(dst, '.skel'), 'w').write('관절 애니 결과 (assemble.py)\n')
    cand = []                                                          # 시전 후보: (각도 라디안, 묶음, 번호)
    for row, (bundle, idx) in PLAN[cls].items():
        meta = json.load(open(os.path.join(HERE, 'work', cls, f'anim-{bundle}.json'), encoding='utf-8'))
        for k, i in enumerate(idx):
            load(cls, bundle, i).save(os.path.join(dst, f'{row}-{k}.png'))
            if row in ('atkA', 'atkB'): cand.append((math.radians(meta[i]['used']), bundle, i))
    if 'idle' not in PLAN[cls]:
        b0 = load(cls, *IDLE_FROM); up = B.bob(b0, 112 - 18, 1)
        for k, f in enumerate((b0, up, up, b0)): f.save(os.path.join(dst, f'idle-{k}.png'))
    k_ = B.KIND(cls); vals = B.CAST[k_]['val']; wrap = B.CAST[k_]['wrap']
    T = 2 * math.pi
    dist = (lambda a, v: abs((((a - v + math.pi) % T) + T) % T - math.pi)) if wrap else (lambda a, v: abs(a - v))
    picks = []
    for n, v in enumerate(vals):
        a, bundle, i = min(cand, key=lambda c: dist(c[0], v))
        load(cls, bundle, i).save(os.path.join(dst, f'cast-{n}.png')); picks.append((round(v, 2), bundle, i, round(a, 2)))
    # 직업 전체 프레임 공통 팔레트 22색 (묶음마다 따로 줄이면 시트 전체가 27~31색 → 색 경보)
    from pix import reduce
    fs = sorted(f for f in os.listdir(dst) if f.endswith('.png')); ims = [Image.open(os.path.join(dst, f)).convert('RGBA') for f in fs]
    st = Image.new('RGBA', (128 * len(ims), 128))
    for k, im in enumerate(ims): st.alpha_composite(im, (k * 128, 0))
    st = reduce(st, 22)
    for k, f in enumerate(fs): st.crop((k * 128, 0, (k + 1) * 128, 128)).save(os.path.join(dst, f))
    json.dump({'val': vals, 'wrap': wrap, 'picked': picks}, open(os.path.join(dst, 'cast.json'), 'w', encoding='utf-8'), ensure_ascii=False)
    print(cls, {r: len(list(ix)) for r, (_, ix) in PLAN[cls].items()}, 'cast', [(p[0], p[3]) for p in picks])


if __name__ == '__main__':
    run(sys.argv[1])
