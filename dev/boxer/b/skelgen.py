# 파이터 계열 관절 지정 애니 (animate-with-skeleton-v3) — 마법사 skelgen.py 축약판 (무기 없음, 맨손). 로드맵 승인 2026-10-17 (상한 80, 재시도 0).
#  첫 프레임 = final/<cls>.png (키 46 기준 그림, 팔 내린 중립·빈손) 를 192칸에 2배로. 관절 = bskel.py 설계를 그림 기준점(발바닥·목·다리 가운데)에 맞춘 변환.
#  A = 평타 묶음 15f (주먹: 잽 7 + 스트레이트 8 / 발: 앞차기 7 + 돌려차기 8 / 장: 한손 장타 7 + 두손 장풍 8) · W = 걷기 8f
#  python -I -B dev/boxer/b/skelgen.py prep <cls> <A|W>   → skel/<cls>/req-<part>.json, first.png, fit.png, stick-<part>.png
#  (호출) MSYS_NO_PATHCONV=1 python -I dev/boxer/b/plx.py raw <cls> skel<part> /animate-with-skeleton-v3 dev/boxer/b/skel/<cls>/req-<part>.json
#  python -I -B dev/boxer/b/skelgen.py post <cls> <A|W>   → skel/<cls>/<part>/<i>.png (96칸, 기준 그림 팔레트) + 몽타주 <part>.png·gif
import os, sys, json, base64, io
from PIL import Image, ImageDraw
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
sys.path.insert(0, HERE); sys.path.insert(0, os.path.join(ROOT, 'dev', 'sheets-common'))
import bskel as BK
from skelpost import down2, keep_big, pal_filter, snap, envelope, body_of
N = 192; GROUND = 176; FOOT_X = 66
SIDE = ', side view facing right the whole time, face always visible, never turns around, empty bare fists, no weapon, no effects, no motion lines'
DESC = {
    'fighter': 'small chibi young street brawler boy, 3 heads tall, spiky black hair, long red headband tails, white sleeveless shirt, bandaged forearms, navy shorts, red sneakers' + SIDE,
    'striker': 'small chibi muscular heavyweight boxer man, 3 heads tall, short black hair, black tank top, steel-plated boxing gauntlets, gold belt, red trunks, black boots' + SIDE,
    'kickboxer': 'small chibi young woman kickboxer, 3 heads tall, very high long brown ponytail, white crop top, red hand wraps, white shorts, white shin guards, barefoot' + SIDE,
    'qigong': 'small chibi young kung fu monk man, 3 heads tall, black hair, white headband, navy kung fu jacket, white sash, wooden prayer beads, navy trousers' + SIDE,
    'tempest': 'small chibi young woman storm kickboxer, 3 heads tall, silver-white twin tails with teal tips spread wide, teal mantle, steel shoulder pauldron, teal top, white shorts, steel shin guards' + SIDE,
    'grandmaster': 'small chibi old kung fu grandmaster, 3 heads tall, long white hair and long white beard, golden halo ring behind the head, long navy robe with gold trim, white beads' + SIDE,
}
ACTION = {
    'punch': 'boxing: a quick lead-hand jab, then a powerful rear-hand straight punch, rotating hips and shoulders forward and lifting the back heel',
    'kick': 'kickboxing: a front push kick with the lead leg, then a high roundhouse kick with the back leg, leaning back',
    'palm': 'kung fu: a one-hand palm strike in a deep forward stance, then drawing both hands to the hip and pushing a two-hand palm strike forward',
    'W': 'walking forward with clear long strides, knees lifting, arms swinging with loose fists, both legs clearly visible',
}


def place(cls):
    fin = Image.open(os.path.join(HERE, 'final', f'{cls}.png')).convert('RGBA')
    W, H = fin.size; P = fin.load()
    ys = range(H * 2 // 3, H); xs = [x for y in ys for x in range(W) if P[x, y][3]]
    cx = (min(xs) + max(xs)) / 2
    ox, oy = round(FOOT_X - cx * 2), (GROUND - 1) - (H - 1) * 2 - 1
    first = Image.new('RGBA', (N, N)); first.alpha_composite(fin.resize((W * 2, H * 2), Image.NEAREST), (ox, oy))
    return first, fin


def fit(first):
    """설계 관절 → 그림 좌표 (x' = a·x + bx, y' = a·y + by): 발바닥 · 목(정수리~발바닥 37%) · 다리 가운데 x"""
    base = BK.BASE; bb = first.getbbox(); P = first.load()
    foot_s = bb[3] - 1
    cols = range(FOOT_X - 10, FOOT_X + 12)
    top_s = min(y for x in cols for y in range(N) if P[x, y][3])
    neck_s = top_s + 0.37 * (foot_s - top_s)
    foot_b = max(base['RIGHT LEG'][1], base['LEFT LEG'][1]); neck_b = base['NECK'][1]
    a = (foot_s - neck_s) / (foot_b - neck_b); by = foot_s - a * foot_b
    pel_b = (base['RIGHT HIP'][0] + base['LEFT HIP'][0]) / 2
    xs = [x for y in range(foot_s - 6, foot_s + 1) for x in range(N) if P[x, y][3]]
    bx = (min(xs) + max(xs)) / 2 - a * pel_b
    return (lambda q: (round(a * q[0] + bx, 1), round(a * q[1] + by, 1))), a


def frames(cls, part):
    return BK.walk() if part == 'W' else BK.BUNDLE[BK.KIND[cls]]


def b64(im):
    buf = io.BytesIO(); im.save(buf, 'PNG')
    return {'type': 'base64', 'base64': base64.b64encode(buf.getvalue()).decode(), 'format': 'png'}


def prep(cls, part, seed=71):
    d = os.path.join(HERE, 'skel', cls); os.makedirs(d, exist_ok=True)
    first, _ = place(cls); first.save(os.path.join(d, 'first.png'))
    T, a = fit(first)
    tr = lambda p: {k: T(v) for k, v in p.items()}
    fr = [tr(p) for p in frames(cls, part)]
    body = {'description': DESC[cls], 'action': ACTION['W' if part == 'W' else BK.KIND[cls]], 'direction': 'east', 'view': 'side',
            'first_frame': b64(first), 'first_frame_keypoints': BK.kp(tr(BK.BASE)), 'keypoints': [BK.kp(p) for p in fr],
            'template_id': 'mannequin', 'seed': seed, 'no_background': True}
    assert len(body['description']) < 500 and len(body['action']) < 500
    json.dump(body, open(os.path.join(d, f'req-{part}.json'), 'w'), ensure_ascii=False)
    # 확인용: 첫 프레임 위 기준 관절, 막대 인형 줄
    S = 3; im = Image.new('RGBA', (N * S, N * S), (24, 26, 34, 255)); im.alpha_composite(first.resize((N * S, N * S), Image.NEAREST)); dr = ImageDraw.Draw(im)
    b = tr(BK.BASE)
    for u, w in BK.BONES: dr.line([(b[u][0] * S, b[u][1] * S), (b[w][0] * S, b[w][1] * S)], fill=(255, 200, 0), width=3)
    im.crop((0, 60 * S, 150 * S, 185 * S)).save(os.path.join(d, 'fit.png'))
    tiles = [BK.stick(p, S=1, crop=(0, 60, 150, 184)) for p in fr]
    m = Image.new('RGBA', (tiles[0].width * len(tiles), tiles[0].height))
    for i, t in enumerate(tiles): m.paste(t, (i * t.width, 0))
    m.save(os.path.join(d, f'stick-{part}.png'))
    print(cls, part, len(fr), 'frames, scale', round(a, 2))


def post(cls, part):
    d = os.path.join(HERE, 'skel', cls); req = json.load(open(os.path.join(d, f'req-{part}.json')))
    fin = Image.open(os.path.join(HERE, 'final', f'{cls}.png')).convert('RGBA')
    PAL = {c[:3] for c in fin.get_flattened_data() if c[3]}
    od = os.path.join(d, part); os.makedirs(od, exist_ok=True)
    outs = []
    n = len(req['keypoints']); off = 1 if os.path.exists(os.path.join(HERE, 'work', cls, f'skel{part}-{n}.png')) else 0   # 응답에 첫 프레임이 끼면 한 칸 밀림
    for i in range(n):
        src = os.path.join(HERE, 'work', cls, f'skel{part}-{i + off}.png')
        im = down2(Image.open(src))
        env, KP = envelope(req['keypoints'][i], 96)
        body = snap(keep_big(body_of(pal_filter(im, PAL, 40), env, KP), 0.05), PAL)
        body.save(os.path.join(od, f'{i}.png')); outs.append(body)
    S = 3; m = Image.new('RGBA', (96 * S * len(outs), 96 * S), (40, 42, 52, 255))
    for i, o in enumerate(outs): m.alpha_composite(o.resize((96 * S, 96 * S), Image.NEAREST), (i * 96 * S, 0))
    m.save(os.path.join(d, f'{part}.png'))
    g = [Image.alpha_composite(Image.new('RGBA', (96, 96), (40, 42, 52, 255)), o).resize((288, 288), Image.NEAREST).convert('P', palette=Image.ADAPTIVE) for o in outs]
    g[0].save(os.path.join(d, f'{part}.gif'), save_all=True, append_images=g[1:], duration=90, loop=0)
    print(cls, part, len(outs), 'frames →', od)


if __name__ == '__main__':
    {'prep': prep, 'post': post}[sys.argv[1]](sys.argv[2], sys.argv[3])
