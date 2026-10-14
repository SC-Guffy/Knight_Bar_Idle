# ⑤-1 마법사 계열 텍스처 일괄 생성 (PixelLab). 키는 Windows 사용자 환경변수에서 읽고 출력하지 않는다.
#  키 그림: python -I genbatch.py key  <id[:seed]> ...   → req/<id>-key-s<seed>.json, raw/<id>-s<seed>-0.png
#  애니:    python -I genbatch.py anim <id> <키 그림 png> <frames> <seed> "<action>"   → raw/<id>-anim-<n>.png
#  호출마다 usage.tsv 에 한 줄 (사용량 = 호출 수로 센다: 같은 달 다른 세션과 잔량을 나눠 쓰므로)
import sys, os, json, time, base64, threading
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', 'pixellab'))
from pl import call
PLAN = json.load(open(os.path.join(HERE, 'plan.json'), encoding='utf-8'))
BASE = {"outline": "selective outline", "detail": "medium detail", "view": "side", "no_background": True,
        "background_removal_task": "remove_complex_background"}
PRE = "isolated pixel art VFX sprite on empty transparent background: "
POST = ", nothing else, no character, no person, no background shape"
lock = threading.Lock()
CONC = int(os.environ.get('CONC', '2'))

def log(*a):
    with lock:
        open(os.path.join(HERE, 'usage.tsv'), 'a', encoding='utf-8').write('\t'.join(map(str, a)) + '\n')

def images(o, out):
    if isinstance(o, dict):
        if o.get('type') == 'base64' and 'base64' in o: out.append(o['base64']); return
        for k, v in o.items():
            if k == 'base64' and isinstance(v, str) and len(v) > 100: out.append(v)
            else: images(v, out)
    elif isinstance(o, list):
        for v in o: images(v, out)

def run(ep, body, pre):
    for k in range(60):   # 동시 작업 한도(429, 다른 세션과 나눠 씀) → 기다렸다 다시
        st, r = call('POST', ep, body)
        if st != 429: break
        time.sleep(10 + k * 2)
    if st not in (200, 202): return f'HTTP {st} {str(r)[:300]}'
    job = r.get('background_job_id') if isinstance(r, dict) else None
    if not job and isinstance(r, dict) and isinstance(r.get('data'), dict): job = r['data'].get('background_job_id')
    if job:
        for _ in range(150):
            time.sleep(4)
            st, j = call('GET', f'/background-jobs/{job}')
            s = j.get('status') if isinstance(j, dict) else None
            if s == 'completed': r = j; break
            if s == 'failed': return 'FAILED ' + str(j)[:300]
        else: return 'TIMEOUT'
    imgs = []; images(r, imgs)
    for i, b in enumerate(imgs):
        if ',' in b[:40]: b = b.split(',', 1)[1]
        open(f'{pre}-{i}.png', 'wb').write(base64.b64decode(b))
    return f'saved {len(imgs)}'

def key(spec):
    id_, _, seed = spec.partition(':')
    p = PLAN[id_]; seed = int(seed or p.get('seed', 7))
    body = dict(BASE, description=PRE + p['desc'] + POST, image_size={"width": p['gen'][0], "height": p['gen'][1]}, seed=seed)
    json.dump(body, open(os.path.join(HERE, 'req', f'{id_}-key-s{seed}.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    res = run('/create-image-pixen', body, os.path.join(HERE, 'raw', f'{id_}-s{seed}'))
    log(time.strftime('%H:%M:%S'), id_, 'key', seed, res)
    print(id_, seed, res, flush=True)

def anim(id_, png, frames, seed, action):
    b64 = base64.b64encode(open(png, 'rb').read()).decode()
    body = {"first_frame": {"type": "base64", "base64": b64}, "action": action, "frame_count": int(frames), "seed": int(seed), "no_background": True}
    json.dump(dict(body, first_frame=os.path.relpath(png, HERE)), open(os.path.join(HERE, 'req', f'{id_}-anim-s{seed}.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    res = run('/animate-with-text-v3', body, os.path.join(HERE, 'raw', f'{id_}-anim-s{seed}'))
    log(time.strftime('%H:%M:%S'), id_, 'anim', seed, res)
    print(id_, 'anim', seed, res, flush=True)

if __name__ == '__main__':
    mode = sys.argv[1]
    if mode == 'key':
        ts = [threading.Thread(target=key, args=(s,)) for s in sys.argv[2:]]
        for i, t in enumerate(ts):
            t.start(); time.sleep(1.5)
            while sum(x.is_alive() for x in ts) >= CONC: time.sleep(1)
        for t in ts: t.join()
    elif mode == 'anim':
        anim(*sys.argv[2:7])
    elif mode == 'anims':   # 줄마다 id<TAB>png<TAB>frames<TAB>seed<TAB>action 인 파일
        rows = [l.rstrip('\n').split('\t') for l in open(sys.argv[2], encoding='utf-8') if l.strip()]
        ts = [threading.Thread(target=anim, args=r) for r in rows]
        for t in ts:
            t.start(); time.sleep(1.5)
            while sum(x.is_alive() for x in ts) >= CONC: time.sleep(1)
        for t in ts: t.join()
