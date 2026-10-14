# ⑤-3 레인저 계열 PixelLab 생성 도구. 키는 Windows 사용자 환경변수 PIXELLAB_API_KEY (출력·기록하지 않는다).
# 호출마다 dev/vfx3/log.jsonl 에 한 줄 남긴다 → `count` 로 이번 작업 사용 횟수 (상한 170회).
#   python -I dev/vfx3/pl3.py key  <id> <tag> <seed> <w> <h> "<설명>"         create-image-pixen 1회 → raw/<id><tag>.png
#   python -I dev/vfx3/pl3.py topix <id> <draft seed> <w> <h> [pseed]          ComfyUI 시안 → image-to-pixelart 1회 → raw/<id>-p<seed>.png
#   python -I dev/vfx3/pl3.py anim <id> <key.png> <seed> "<동작>"              animate-with-text-v3 1회 (4프레임) → raw/<id>-a<seed>-<n>.png
#   python -I dev/vfx3/pl3.py count
import sys, os, json, time, base64, io
from collections import deque
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', 'pixellab'))
from pl import call

RAW = os.path.join(HERE, 'raw'); REQ = os.path.join(HERE, 'req'); LOG = os.path.join(HERE, 'log.jsonl')
DRAFT_RAW = r'C:\AI\comfy-raw\vfx3'
os.makedirs(RAW, exist_ok=True); os.makedirs(REQ, exist_ok=True)
OUTLINE = (0x0b, 0x0d, 0x14, 255)
PREFIX = 'isolated pixel art VFX sprite on empty transparent background: '
SUFFIX = ', nothing else, no character, no background shape'


def log(**k):
    k['t'] = time.strftime('%Y-%m-%d %H:%M:%S')
    with open(LOG, 'a', encoding='utf-8') as f: f.write(json.dumps(k, ensure_ascii=False) + '\n')


def b64png(im):
    buf = io.BytesIO(); im.save(buf, 'PNG'); return base64.b64encode(buf.getvalue()).decode()


def run(ep, body, kind, tid):
    for _ in range(60):          # 다른 세션과 같은 계정이라 동시 작업 한도(429)에 자주 걸린다 → 기다렸다 다시
        st, r = call('POST', ep, body)
        if st != 429: break
        time.sleep(8)
    if st not in (200, 202):
        log(kind=kind, id=tid, ok=False, status=st); print('HTTP', st, str(r)[:600]); sys.exit(1)
    job = None
    if isinstance(r, dict):
        job = r.get('background_job_id') or (r['data'].get('background_job_id') if isinstance(r.get('data'), dict) else None)
    if job:
        s = None
        for _ in range(150):
            time.sleep(3); st, r = call('GET', f'/background-jobs/{job}')
            s = r.get('status') if isinstance(r, dict) else None
            if s in ('completed', 'failed'): break
        if s != 'completed':
            log(kind=kind, id=tid, ok=False, status=s); print('job', s, str(r)[:500]); sys.exit(1)
    log(kind=kind, id=tid, ok=True)
    out = []
    def find(o):
        if isinstance(o, dict):
            if isinstance(o.get('base64'), str) and len(o['base64']) > 100: out.append(o['base64']); return
            for v in o.values(): find(v)
        elif isinstance(o, list):
            for v in o: find(v)
    find(r)
    ims = []
    for b in out:
        if ',' in b[:40]: b = b.split(',', 1)[1]
        ims.append(Image.open(io.BytesIO(base64.b64decode(b))).convert('RGBA'))
    return ims


def strip_dark_bg(im, thr=40):
    """테두리에서 이어진 어두운 바탕을 지우고 바깥 1칸 외곽선을 다시 두른다."""
    im = im.convert('RGBA'); w, h = im.size; px = im.load()
    seen = bytearray(w * h); q = deque((x, y) for x in range(w) for y in (0, h - 1))
    q.extend((x, y) for y in range(h) for x in (0, w - 1))
    while q:
        x, y = q.popleft()
        if x < 0 or y < 0 or x >= w or y >= h or seen[y * w + x]: continue
        seen[y * w + x] = 1
        r, g, b, a = px[x, y]
        if a < 128 or 0.3 * r + 0.59 * g + 0.11 * b < thr:
            px[x, y] = (0, 0, 0, 0); q.extend(((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)))
    return outline(im)


def outline(im):
    w, h = im.size; px = im.load(); add = []
    for y in range(h):
        for x in range(w):
            if px[x, y][3]: continue
            if any(0 <= x + dx < w and 0 <= y + dy < h and px[x + dx, y + dy][3] > 0 and px[x + dx, y + dy][:3] != OUTLINE[:3] for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))): add.append((x, y))
    for p in add: px[p] = OUTLINE
    return im


def board(tid, seed, w, h):
    """시안(검은 바탕 1024px) → 그림 상자를 w:h 비율로 넓혀 (4w, 4h) 검은 판에."""
    src = Image.open(os.path.join(DRAFT_RAW, f'{tid}-s{seed}.png')).convert('RGB')
    g = src.convert('L').point(lambda v: 255 if v > 30 else 0)
    bb = g.getbbox() or (0, 0) + src.size
    x0, y0, x1, y1 = bb; bw, bh = x1 - x0, y1 - y0
    s = max(bw / (w * 0.92), bh / (h * 0.92)); cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    box = (round(cx - s * w / 2), round(cy - s * h / 2), round(cx + s * w / 2), round(cy + s * h / 2))
    crop = Image.new('RGB', (box[2] - box[0], box[3] - box[1]))
    crop.paste(src, (-box[0], -box[1]))
    return crop.resize((w * 4, h * 4), Image.LANCZOS)


def main(a):
    cmd = a[0]
    if cmd == 'count':
        n = sum(1 for l in open(LOG, encoding='utf-8') if json.loads(l).get('ok')) if os.path.exists(LOG) else 0
        print('PixelLab calls (ok):', n); return
    if cmd == 'key':
        tid, tag, seed, w, h, desc = a[1], a[2], int(a[3]), int(a[4]), int(a[5]), a[6]
        body = {'image_size': {'width': w, 'height': h}, 'outline': 'selective outline', 'detail': 'medium detail', 'view': 'side',
                'no_background': True, 'background_removal_task': 'remove_complex_background', 'description': PREFIX + desc + SUFFIX, 'seed': seed}
        json.dump(body, open(os.path.join(REQ, f'{tid}{tag}-key.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
        ims = run('/create-image-pixen', body, 'key', tid)
        for i, im in enumerate(ims): im.save(os.path.join(RAW, f'{tid}{tag}{"" if i == 0 else "-" + str(i)}.png'))
        print('saved', len(ims), f'{tid}{tag}')
    elif cmd == 'topix':
        tid, seed, w, h = a[1], int(a[2]), int(a[3]), int(a[4]); pseed = int(a[5]) if len(a) > 5 else 1
        b = board(tid, seed, w, h); b.save(os.path.join(RAW, f'{tid}-board{seed}.png'))
        body = {'image': {'type': 'base64', 'base64': b64png(b)}, 'image_size': {'width': b.width, 'height': b.height},
                'output_size': {'width': w, 'height': h}, 'seed': pseed}
        ims = run('/image-to-pixelart', body, 'topix', tid)
        ims[0].save(os.path.join(RAW, f'{tid}-p{seed}-raw.png'))
        strip_dark_bg(ims[0]).save(os.path.join(RAW, f'{tid}-p{seed}.png'))
        print('saved', f'{tid}-p{seed}.png')
    elif cmd == 'anim':
        tid, key, seed, action = a[1], a[2], int(a[3]), a[4]
        im = Image.open(key).convert('RGBA')
        body = {'first_frame': {'type': 'base64', 'base64': b64png(im)}, 'action': action, 'frame_count': 4, 'seed': seed, 'no_background': True}
        json.dump({k: v for k, v in body.items() if k != 'first_frame'} | {'first_frame': os.path.basename(key)}, open(os.path.join(REQ, f'{tid}-anim{seed}.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
        ims = run('/animate-with-text-v3', body, 'anim', tid)
        for i, f in enumerate(ims): f.save(os.path.join(RAW, f'{tid}-a{seed}-{i}.png'))
        print('saved', len(ims), 'frames', ims[0].size if ims else None)


if __name__ == '__main__':
    main(sys.argv[1:])
