# 권투가 VFX 텍스처 생성 도우미 (docs/specs/boxer-class.md 10절). 키는 pl.py 가 환경변수에서 읽고 출력하지 않는다.
#  python -I mk.py key  <name> <W> <H> <seed> "<description>"      → raw/<name>.png (create-image-pixen)
#  python -I mk.py anim <name> <key.png> <seed> "<action>" [pad]  → raw/<name>-0..4.png (animate-with-text-v3, 4프레임)
#       pad: 키 그림을 그 크기 정사각 캔버스 가운데 놓고 애니 (작은 그림용)
#  호출마다 usage.md 에 한 줄 (시트, 엔드포인트, 잔량 전→후). 잔량 1,340 아래면 거부.
import sys, os, json, time, base64, io
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', '..', 'pixellab'))
from pl import call
from PIL import Image
RAW = os.path.join(HERE, 'raw'); os.makedirs(RAW, exist_ok=True)
FLOOR = 1340

def bal():
    for _ in range(3):
        st, r = call('GET', '/balance')
        if st == 200: return r['subscription']['generations']
        time.sleep(3)
    return None

def images(o, out):
    if isinstance(o, dict):
        if o.get('type') == 'base64' and 'base64' in o: out.append(o['base64']); return
        for k, v in o.items():
            if k == 'base64' and isinstance(v, str) and len(v) > 100: out.append(v)
            else: images(v, out)
    elif isinstance(o, list):
        for v in o: images(v, out)

def run(ep, body, name):
    b0 = bal()
    if b0 is None or b0 < FLOOR: print('STOP balance', b0); sys.exit(2)
    for attempt in range(4):
        st, r = call('POST', ep, body)
        if st in (200, 202): break
        print('HTTP', st, str(r)[:300])
        if st == 429 or st >= 500: time.sleep(15); continue
        sys.exit(1)
    else: sys.exit(1)
    job = r.get('background_job_id') if isinstance(r, dict) else None
    if not job and isinstance(r, dict) and isinstance(r.get('data'), dict): job = r['data'].get('background_job_id')
    if job:
        for _ in range(150):
            time.sleep(4)
            st, j = call('GET', f'/background-jobs/{job}')
            s = j.get('status') if isinstance(j, dict) else None
            if s == 'completed': r = j; break
            if s == 'failed': print('FAILED', str(j)[:500]); sys.exit(1)
        else: print('TIMEOUT'); sys.exit(1)
    imgs = []; images(r, imgs)
    out = []
    for b in imgs:
        if ',' in b[:40]: b = b.split(',', 1)[1]
        out.append(Image.open(io.BytesIO(base64.b64decode(b))).convert('RGBA'))
    time.sleep(1)
    b1 = bal()
    with open(os.path.join(HERE, 'usage.md'), 'a', encoding='utf-8') as f:
        f.write(f'| {name} | {ep.split("/")[-1]} | 1 | {b0} → {b1} |\n')
    print('images', len(out), 'balance', b0, '->', b1)
    return out

cmd = sys.argv[1]
if cmd == 'key':
    name, W, H, seed, desc = sys.argv[2], int(sys.argv[3]), int(sys.argv[4]), int(sys.argv[5]), sys.argv[6]
    body = {'image_size': {'width': W, 'height': H}, 'outline': 'selective outline', 'detail': 'medium detail', 'view': 'side',
            'no_background': True, 'background_removal_task': 'remove_complex_background',
            'description': 'isolated pixel art VFX sprite on empty transparent background: ' + desc + ', nothing else, no character, no background shape, no text',
            'seed': seed}
    json.dump(body, open(os.path.join(RAW, name + '-key.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    ims = run('/create-image-pixen', body, name)
    for i, im in enumerate(ims): im.save(os.path.join(RAW, f'{name}.png' if i == 0 else f'{name}-alt{i}.png'))
elif cmd == 'anim':
    name, keyp, seed, action = sys.argv[2], sys.argv[3], int(sys.argv[4]), sys.argv[5]
    pad = int(sys.argv[6]) if len(sys.argv) > 6 else 0
    im = Image.open(keyp).convert('RGBA')
    if pad:
        c = Image.new('RGBA', (pad, pad), (0, 0, 0, 0)); c.alpha_composite(im, ((pad - im.width) // 2, (pad - im.height) // 2)); im = c
    buf = io.BytesIO(); im.save(buf, 'PNG')
    body = {'first_frame': {'type': 'base64', 'base64': base64.b64encode(buf.getvalue()).decode()}, 'action': action,
            'frame_count': 4, 'seed': seed, 'no_background': True}
    meta = dict(body); meta['first_frame'] = keyp
    json.dump(meta, open(os.path.join(RAW, name + '-anim.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    ims = run('/animate-with-text-v3', body, name)
    for i, f in enumerate(ims): f.save(os.path.join(RAW, f'{name}-{i}.png'))
