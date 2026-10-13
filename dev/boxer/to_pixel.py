# ComfyUI 시안(1024px) → PixelLab 도트 기준 그림(64×64, 발 가운데 (32, 58)).
#   1) 바탕 지우기: 테두리에서 비슷한 색을 flood fill 로 지운다 (바닥 그림자는 아래쪽 어두운 무채색 덩어리로 보고 지운다)
#   2) 캐릭터 키가 TARGET_H 도트가 되게 줄여 256×256(=64×4) 판에 발을 맞춰 놓는다
#   3) PixelLab /image-to-pixelart (256 → 64) 로 도트화한다
#   4) 결과의 바탕을 다시 지우고 외곽선을 정리해 dev/boxer/final-<직업>-<seed>.png 로 저장한다
# 사용: python -I dev/boxer/to_pixel.py prep <직업> <seed>       (PixelLab 호출 없이 입력판만 만들어 본다)
#       python -I dev/boxer/to_pixel.py run <직업> <seed> [pseed]  (PixelLab 1회)
import sys, os, json, base64, io
from collections import deque
from PIL import Image
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'pixellab'))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

HERE = os.path.dirname(os.path.abspath(__file__))
RAW = r'C:\AI\comfy-raw\boxer'
TARGET_H = 40          # 도트 키 (기존 기사 35~38 + 머리 장식 여유)
FOOT_Y = 58


def remove_bg(im, tol=34):
    im = im.convert('RGBA'); w, h = im.size; px = im.load()
    seen = bytearray(w * h); q = deque()
    for x in range(w):
        q.append((x, 0)); q.append((x, h - 1))
    for y in range(h):
        q.append((0, y)); q.append((w - 1, y))
    while q:
        x, y = q.popleft()
        if x < 0 or y < 0 or x >= w or y >= h or seen[y * w + x]: continue
        seen[y * w + x] = 1
        r, g, b, a = px[x, y]
        # 바탕: 밝고 채도가 낮은 회색 (판마다 회색 톤이 달라 절대값 대신 무채색·밝기로 본다)
        if max(r, g, b) - min(r, g, b) <= tol and (r + g + b) / 3 >= 110:
            px[x, y] = (0, 0, 0, 0)
            q.extend(((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)))
    return im


def drop_shadow(im):
    """발밑 그림자: 맨 아래 15% 안의 어두운 무채색 칸을 지운다."""
    w, h = im.size; px = im.load()
    bb = im.getbbox()
    if not bb: return im
    y0 = bb[3] - int((bb[3] - bb[1]) * 0.12)
    for y in range(y0, bb[3]):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a and max(r, g, b) - min(r, g, b) < 24 and max(r, g, b) < 90: px[x, y] = (0, 0, 0, 0)
    return im


def board(cls, seed, bg=(200, 200, 204), half=False):
    # half: 출력 32×32 (키 TARGET_H/2 도트) 용 128×128 판 — 7:3 판 (stylize.epx2 로 2배)
    src = drop_shadow(remove_bg(Image.open(os.path.join(RAW, f'{cls}-{seed}.png'))))
    bb = src.getbbox(); c = src.crop(bb)
    S, th, fy = (128, TARGET_H // 2, FOOT_Y // 2) if half else (256, TARGET_H, FOOT_Y)
    k = th * 4 / c.height
    c = c.resize((max(1, round(c.width * k)), th * 4), Image.LANCZOS)
    out = Image.new('RGBA', (S, S), bg + (255,))
    x = S // 2 - c.width // 2; y = fy * 4 - c.height
    out.alpha_composite(c, (max(0, x), y))
    return out


OUTLINE = (0x0b, 0x0d, 0x14, 255)


def clean(im64, foot=FOOT_Y):
    """PixelLab 결과 → 게임 규격: 바탕·발밑 회색 찌꺼기 제거 → 발 바닥을 y=58 에 → 바깥 1칸 외곽선 #0b0d14 (body2.js outline 과 같은 규칙)."""
    im = remove_bg(im64, tol=40); w, h = im.size; px = im.load()
    bb = im.getbbox()
    if not bb: return im
    # 발밑 4줄: 채도 낮은 중간 밝기(그림자·바탕 번짐)는 지운다 (신발 빨강·검정 외곽은 남는다)
    for y in range(max(0, bb[3] - 4), bb[3]):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a and max(r, g, b) - min(r, g, b) < 28 and 70 < (r + g + b) / 3 < 215: px[x, y] = (0, 0, 0, 0)
    # 발밑 그림자 줄: 맨 아래 3줄이 그 위 발목 줄보다 1.6배 넘게 넓으면 그 줄의 어두운 칸을 지운다
    bb = im.getbbox()
    cnt = lambda y: sum(1 for x in range(w) if px[x, y][3])
    ref = cnt(max(0, bb[3] - 6))
    for y in range(max(0, bb[3] - 3), bb[3]):
        if cnt(y) > max(6, ref * 1.6):
            for x in range(w):
                r, g, b, a = px[x, y]
                if a and (r + g + b) / 3 < 80: px[x, y] = (0, 0, 0, 0)
    # 외톨이 칸 (네 이웃이 모두 비었다) 지우기
    for y in range(h):
        for x in range(w):
            if px[x, y][3] and all(not (0 <= x + dx < w and 0 <= y + dy < h) or not px[x + dx, y + dy][3] for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                px[x, y] = (0, 0, 0, 0)
    bb = im.getbbox()
    out = Image.new('RGBA', (w, h)); out.paste(im, (0, foot - (bb[3] - 1)))
    po = out.load(); add = []
    for y in range(h):
        for x in range(w):
            if po[x, y][3]: continue
            if any(0 <= x + dx < w and 0 <= y + dy < h and po[x + dx, y + dy][3] for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))): add.append((x, y))
    for x, y in add: po[x, y] = OUTLINE
    return out


if __name__ == '__main__':
    mode, cls, seed = sys.argv[1], sys.argv[2], int(sys.argv[3])
    half = mode == 'run32'
    b = board(cls, seed, half=half)
    b.save(os.path.join(HERE, 'comfy', f'_board-{cls}-{seed}.png'))
    if mode == 'prep':
        print('board saved'); sys.exit(0)
    from pl import call
    import time
    buf = io.BytesIO(); b.convert('RGB').save(buf, 'PNG')
    pseed = int(sys.argv[4]) if len(sys.argv) > 4 else 1
    body = {'image': {'type': 'base64', 'base64': base64.b64encode(buf.getvalue()).decode()},
            'image_size': {'width': b.width, 'height': b.height}, 'output_size': {'width': b.width // 4, 'height': b.height // 4}, 'seed': pseed}
    st, r = call('POST', '/image-to-pixelart', body)
    if st not in (200, 202): print('HTTP', st, str(r)[:600]); sys.exit(1)
    job = isinstance(r, dict) and r.get('background_job_id')
    if job:
        for _ in range(120):
            time.sleep(3); st, r = call('GET', f'/background-jobs/{job}')
            if r.get('status') in ('completed', 'failed'): break
    def find(o):
        if isinstance(o, dict):
            if 'base64' in o and isinstance(o['base64'], str) and len(o['base64']) > 100: return o['base64']
            for v in o.values():
                f = find(v)
                if f: return f
        if isinstance(o, list):
            for v in o:
                f = find(v)
                if f: return f
    b64 = find(r)
    if not b64: print('no image', str(r)[:400]); sys.exit(1)
    if ',' in b64[:40]: b64 = b64.split(',', 1)[1]
    raw = Image.open(io.BytesIO(base64.b64decode(b64))).convert('RGBA')
    if half:
        raw.save(os.path.join(HERE, 'comfy', f'_pl32-{cls}-{seed}-{pseed}.png'))
        from stylize import epx2, outline_foot, strip_outline
        c32 = strip_outline(clean(raw, foot=29))
        outline_foot(epx2(c32)).save(os.path.join(HERE, f'pix-{cls}.png'))
    else:
        raw.save(os.path.join(HERE, 'comfy', f'_pl-{cls}-{seed}-{pseed}.png'))
        clean(raw).save(os.path.join(HERE, f'final-{cls}-{seed}-{pseed}.png'))
    print('saved', raw.size)
