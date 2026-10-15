# 레인저 계열 시트 쓰기 (칸 96/128 — 파이터 common.write_sheet 는 64 고정이라 따로 둔다)
#   from sheet import CELL, write_sheet
#   write_sheet(cls, anims, order) → src/sprites/<cls>.png/.json + dev/bowsheets/preview/<cls>.png
#   anims[name] = { frames: [PIL RGBA (칸 크기)], fps, loop, hit?, key?, val?, pts? }
#   cast 줄은 key='pull', val=[프레임마다 시위 당김 값] 을 주면 스킬 자세의 pull 에 가장 가까운 프레임을 고른다 (src/sprites.js sheetFrame).
#   castUp 은 하늘로 겨눈(bowA ≤ -0.55) 스킬 자세용 — 같은 key·val 규칙.
import os, json
from PIL import Image, ImageDraw
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(os.path.dirname(HERE))
# 칸 크기와 발 기준점 (기준 그림을 찍을 때 쓴 값과 같아야 기존 조립식과 같은 자리에 선다 — base.py, 브라우저 bigShot)
CELL = {'siegeMaster': (128, (58, 116))}
CELL_DEF = (96, (42, 86))
cell_of = lambda cls: CELL.get(cls, CELL_DEF)


def pts_of(im, foot):
    """hand = 앞쪽 끝(활·석궁 끝 = 화살이 나가는 자리) 세로 가운데, head = 맨 위 가운데."""
    px = im.load(); bb = im.getbbox()
    if not bb: return [foot[0], foot[1] - 20, foot[0], foot[1] - 36]
    top = bb[1]; xs = [x for x in range(im.width) if px[x, top][3]]
    x = bb[2] - 1; ys = [y for y in range(bb[1], foot[1] - 4) if px[x, y][3]] or [(bb[1] + bb[3]) // 2]
    return [x, (ys[0] + ys[-1]) // 2, sum(xs) // len(xs), top]


def write_sheet(cls, anims, order, out_dir=None):
    W, foot = cell_of(cls)
    n = max(len(anims[a]['frames']) for a in order)
    sheet = Image.new('RGBA', (W * n, W * len(order)))
    meta = {'w': W, 'h': W, 'foot': list(foot), 'anims': {}, 'pts': {}}
    for r, a in enumerate(order):
        A = anims[a]
        for k, f in enumerate(A['frames']): sheet.alpha_composite(f, (W * k, W * r))
        m = {'row': r, 'frames': len(A['frames']), 'fps': A['fps'], 'loop': A['loop']}
        for k in ('hit', 'key', 'val'):
            if k in A: m[k] = A[k]
        meta['anims'][a] = m
        auto = [pts_of(f, foot) for f in A['frames']]
        for k, p in (A.get('pts') or {}).items(): auto[k] = p
        meta['pts'][a] = auto
    sp = out_dir or os.path.join(ROOT, 'src', 'sprites'); os.makedirs(sp, exist_ok=True)
    sheet.save(os.path.join(sp, f'{cls}.png'))
    with open(os.path.join(sp, f'{cls}.json'), 'w', encoding='utf-8') as f:
        f.write(f'{{"w": {W}, "h": {W}, "foot": {json.dumps(list(foot))},\n "anims": {{\n')
        f.write(',\n'.join(f'  "{a}": {json.dumps(meta["anims"][a])}' for a in order))
        f.write('\n },\n "pts": {\n')
        f.write(',\n'.join(f'  "{a}": {json.dumps(meta["pts"][a])}' for a in order))
        f.write('\n }\n}\n')
    # 미리보기 3배: 칸 테두리(잘림 확인), hand 빨강·head 파랑, 발 기준점
    S, L = 3, 90
    pv = Image.new('RGBA', (L + W * n * S, W * len(order) * S), (20, 22, 29, 255))
    pv.alpha_composite(sheet.resize((sheet.width * S, sheet.height * S), Image.NEAREST), (L, 0))
    d = ImageDraw.Draw(pv)
    for r, a in enumerate(order):
        A = meta['anims'][a]
        d.text((4, r * W * S + 8), a, fill=(255, 220, 90))
        d.text((4, r * W * S + 22), f"{A['frames']}f {A['fps']}fps", fill=(170, 170, 190))
        for k in range(A['frames']):
            ox, oy = L + k * W * S, r * W * S
            d.rectangle([ox, oy, ox + W * S - 1, oy + W * S - 1], outline=(50, 52, 64))
            p = meta['pts'][a][k]
            d.rectangle([ox + p[0] * S, oy + p[1] * S, ox + p[0] * S + 3, oy + p[1] * S + 3], outline=(255, 60, 60))
            d.rectangle([ox + p[2] * S, oy + p[3] * S, ox + p[2] * S + 3, oy + p[3] * S + 3], outline=(80, 160, 255))
            d.line([(ox + (foot[0] - 3) * S, oy + (foot[1] + 1) * S), (ox + (foot[0] + 3) * S, oy + (foot[1] + 1) * S)], fill=(120, 120, 140))
    os.makedirs(os.path.join(HERE, 'preview'), exist_ok=True)
    pv.save(os.path.join(HERE, 'preview', f'{cls}.png'))
    # 잘림 검사: 칸 가장자리에 닿은 불투명 픽셀이 있으면 알린다
    cut = []
    for r, a in enumerate(order):
        for k, f in enumerate(anims[a]['frames']):
            bb = f.getbbox()
            if bb and (bb[0] == 0 or bb[1] == 0 or bb[2] == W or bb[3] == W): cut.append(f'{a}[{k}]')
    print(cls, 'sheet', sheet.size, 'cell', W, 'foot', foot, 'edge-touch', cut or 'none')
    return meta
