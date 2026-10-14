# ⑤-2 창기사 계열 텍스처 생성 (PixelLab). 키는 Windows 사용자 환경변수에서 읽고 출력하지 않는다 (dev/pixellab/pl.py).
#  python -I dev/vfx2/run.py key <이름>[,<이름>...]           키 그림 (jobs.py KEYS) → dev/vfx2/raw/<이름>-0.png
#  python -I dev/vfx2/run.py anim <이름> <키 png> [seed]      키 그림 → animate-with-text-v3 4프레임 (jobs.py ANIMS) → raw/<이름>-anim-<n>.png
#  호출마다 dev/vfx2/usage.txt 에 한 줄 (몇 번 썼는지 세는 기준). 요청 본문(이미지 제외)은 dev/vfx2/req/<이름>.json
import sys, os, json, time, base64, threading
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', 'pixellab')); sys.path.insert(0, HERE)
from pl import call
from jobs import KEYS, ANIMS, BASE_KEY, PRE, POST

RAW = os.path.join(HERE, 'raw'); REQ = os.path.join(HERE, 'req')
os.makedirs(RAW, exist_ok=True); os.makedirs(REQ, exist_ok=True)
lock = threading.Lock()


def log(kind, name):
    with lock:
        open(os.path.join(HERE, 'usage.txt'), 'a', encoding='utf-8').write(f'{time.strftime("%H:%M:%S")} {kind} {name}\n')


def images(o, out):
    if isinstance(o, dict):
        if 'base64' in o and isinstance(o['base64'], str) and len(o['base64']) > 100: out.append(o['base64']); return
        for v in o.values(): images(v, out)
    elif isinstance(o, list):
        for v in o: images(v, out)


def post(ep, body, name, kind):
    for _ in range(60):                       # 동시 작업 한도(429, 같은 계정의 다른 세션과 공유)면 기다렸다 다시. 거절은 차감되지 않는다
        st, r = call('POST', ep, body)
        if st != 429: break
        time.sleep(10)
    if st in (200, 202): log(kind, name)
    if st not in (200, 202): return print(name, 'HTTP', st, str(r)[:300])
    job = isinstance(r, dict) and (r.get('background_job_id') or (r.get('data') or {}).get('background_job_id') if isinstance(r.get('data'), dict) else r.get('background_job_id'))
    if job:
        for _ in range(150):
            time.sleep(4)
            st, j = call('GET', f'/background-jobs/{job}')
            s = j.get('status') if isinstance(j, dict) else None
            if s == 'completed': r = j; break
            if s == 'failed': return print(name, 'FAILED', str(j)[:300])
        else: return print(name, 'TIMEOUT')
    out = []; images(r, out)
    return out


def key(name):
    k = KEYS[name]
    body = {**BASE_KEY, 'image_size': {'width': k['w'], 'height': k['h']}, 'description': PRE + k['d'] + POST, 'seed': k.get('seed', 1)}
    for x in ('outline', 'detail'):
        if x in k: body[x] = k[x]
    json.dump(body, open(os.path.join(REQ, name + '.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    out = post('/create-image-pixen', body, name, 'key')
    for i, b in enumerate(out or []):
        open(os.path.join(RAW, f'{name}-{i}.png'), 'wb').write(base64.b64decode(b.split(',', 1)[-1]))
    print(name, 'ok' if out else 'fail')


def anim(name, png, seed=None):
    a = ANIMS[name]
    body = {'first_frame': {'type': 'base64', 'base64': ''}, 'action': a['a'], 'frame_count': a.get('n', 4), 'seed': seed or a.get('seed', 3), 'no_background': True}
    json.dump(body, open(os.path.join(REQ, name + '-anim.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    body['first_frame']['base64'] = base64.b64encode(open(png, 'rb').read()).decode()
    out = post('/animate-with-text-v3', body, name, 'anim')
    for i, b in enumerate(out or []):
        open(os.path.join(RAW, f'{name}-anim-{i}.png'), 'wb').write(base64.b64decode(b.split(',', 1)[-1]))
    print(name, 'anim', len(out or []))


if __name__ == '__main__':
    if sys.argv[1] == 'key':
        from concurrent.futures import ThreadPoolExecutor
        names = list(KEYS) if sys.argv[2] == 'all' else sys.argv[2].split(',')
        with ThreadPoolExecutor(2) as ex: list(ex.map(key, names))
    else:
        anim(sys.argv[2], sys.argv[3], int(sys.argv[4]) if len(sys.argv) > 4 else None)
