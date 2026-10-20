# 스킬 카드 아이콘 생성 (docs/specs/skill-card-icons.md). 키는 pl.py 가 환경변수에서 읽고 출력하지 않는다.
#  python gen.py <ic> [<ic> ...] [--seed N] [--par K]   → raw/<ic>-s<seed>.png (create-image-pixen 32×32, 바탕 칠함)
#  호출마다 usage.md 에 한 줄. 이 작업 상한 150 (usage 합), 계정 잔량 74 아래면 멈춘다. K 개씩 동시에 (기본 4).
import sys, os, json, time, base64, io, threading
from concurrent.futures import ThreadPoolExecutor
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', 'pixellab')); sys.path.insert(0, HERE)
from pl import call
from PIL import Image
from prompts import prompt
RAW = os.path.join(HERE, 'raw'); os.makedirs(RAW, exist_ok=True)
USAGE = os.path.join(HERE, 'usage.md')
FLOOR, CAP = 74, 150

def spent():
    if not os.path.exists(USAGE): return 0.0
    t = 0.0
    for ln in open(USAGE, encoding='utf-8'):
        c = [x.strip() for x in ln.strip().strip('|').split('|')]
        if len(c) >= 4 and ln.startswith('| ') and c[0] != '이름' and not c[0].startswith('-'):
            try: t += float(c[3])
            except ValueError:
                a, b = c[2].split('→'); t += float(a) - float(b)
    return t

def bal():
    for _ in range(3):
        st, r = call('GET', '/balance')
        if st == 200: return r['subscription']['generations']
        time.sleep(3)
    return None

def find(o, key, out):
    if isinstance(o, dict):
        for k, v in o.items():
            if k == key: out.append(v)
            elif k != 'base64' or key == 'base64': find(v, key, out)
    elif isinstance(o, list):
        for v in o: find(v, key, out)

LOCK = threading.Lock()
class Stop(Exception): pass

def gen(rid, seed):
    with LOCK:
        b0 = bal()
        if b0 is None or b0 < FLOOR: raise Stop(f'balance {b0}')
        if spent() > CAP - 1: raise Stop(f'cap {spent()}')
    body = {'image_size': {'width': 32, 'height': 32}, 'outline': 'selective outline', 'detail': 'highly detailed',
            'view': 'side', 'no_background': False,
            'description': prompt(rid), 'seed': seed}
    for _ in range(20):
        st, r = call('POST', '/create-image-pixen', body)
        if st in (200, 202): break
        print('HTTP', st, str(r)[:300])
        if st == 429 or st >= 500: time.sleep(20); continue
        raise Stop('error ' + rid)
    else: raise Stop('error ' + rid)
    job = r.get('background_job_id') if isinstance(r, dict) else None
    if not job and isinstance(r, dict) and isinstance(r.get('data'), dict): job = r['data'].get('background_job_id')
    if job:
        for _ in range(150):
            time.sleep(4)
            st, j = call('GET', f'/background-jobs/{job}')
            s = j.get('status') if isinstance(j, dict) else None
            if s == 'completed': r = j; break
            if s == 'failed': print('FAILED', str(j)[:300]); raise Stop('error ' + rid)
        else: print('TIMEOUT'); raise Stop('error ' + rid)
    us = []; find(r, 'charged_generations', us)
    if not us: find(r, 'usage', us)
    used = None
    for u in us:
        if isinstance(u, (int, float)): used = max(used or 0, float(u))
        elif isinstance(u, dict):
            for k in ('generations', 'credits', 'total'):
                if isinstance(u.get(k), (int, float)): used = max(used or 0, float(u[k]))
    imgs = []; find(r, 'base64', imgs)
    imgs = [b for b in imgs if isinstance(b, str) and len(b) > 100]
    for i, b in enumerate(imgs):
        if ',' in b[:40]: b = b.split(',', 1)[1]
        Image.open(io.BytesIO(base64.b64decode(b))).convert('RGBA').save(os.path.join(RAW, f'{rid}-s{seed}' + (f'-{i}' if i else '') + '.png'))
    time.sleep(1); b1 = bal()
    with LOCK:
     new = not os.path.exists(USAGE)
     with open(USAGE, 'a', encoding='utf-8') as f:
         if new: f.write('# 스킬 카드 아이콘 PixelLab 사용 (상한 150)\n\n| 이름 | 엔드포인트 | 잔량 | usage |\n|---|---|---|---|\n')
         f.write(f'| {rid}-s{seed} | create-image-pixen | {b0} → {b1} | {used if used is not None else "?"} |\n')
    print(rid, seed, 'images', len(imgs), 'balance', b0, '->', b1, 'used', used, 'spent', spent(), flush=True)

args = sys.argv[1:]
seed, par = 11, 4
for flag in ('--seed', '--par'):
    if flag in args:
        i = args.index(flag); v = int(args[i + 1]); del args[i:i + 2]
        if flag == '--seed': seed = v
        else: par = v
def one(rid):
    try: gen(rid, seed)
    except Stop as e: print('STOP', rid, e, flush=True)
with ThreadPoolExecutor(par) as ex: list(ex.map(one, args))
