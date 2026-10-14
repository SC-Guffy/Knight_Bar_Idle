# PixelLab 생성 → PNG 저장. 사용: gen.py <endpoint> <request.json> <out_prefix>
# 응답 안의 base64 이미지를 모두 찾아 <out_prefix>-<n>.png 로 저장하고, 호출 전후 남은 횟수를 출력한다 (키는 출력하지 않는다).
import sys, json, time, base64, os
sys.path.insert(0, os.path.dirname(__file__))
from pl import call

def bal():
    st, r = call('GET', '/balance')
    return r['subscription']['generations'] if st == 200 else None

def images(o, out):
    if isinstance(o, dict):
        if o.get('type') == 'base64' and 'base64' in o: out.append(o['base64']); return
        for k, v in o.items():
            if k == 'base64' and isinstance(v, str) and len(v) > 100: out.append(v)
            else: images(v, out)
    elif isinstance(o, list):
        for v in o: images(v, out)

ep, req, pre = sys.argv[1], sys.argv[2], sys.argv[3]
body = json.load(open(req, encoding='utf-8'))
b0 = bal()
st, r = call('POST', ep, body)
if st not in (200, 202):
    print('HTTP', st, str(r)[:800]); sys.exit(1)
job = isinstance(r, dict) and (r.get('background_job_id') or (r.get('data') or {}).get('background_job_id') if isinstance(r.get('data'), dict) else r.get('background_job_id'))
if job:
    for _ in range(120):
        time.sleep(4)
        st, j = call('GET', f'/background-jobs/{job}')
        s = j.get('status') if isinstance(j, dict) else None
        if s == 'completed': r = j; break
        if s == 'failed': print('FAILED', str(j)[:800]); sys.exit(1)
    else:
        print('TIMEOUT', job); sys.exit(1)
imgs = []; images(r, imgs)
for i, b in enumerate(imgs):
    if ',' in b[:40]: b = b.split(',', 1)[1]
    open(f'{pre}-{i}.png', 'wb').write(base64.b64decode(b))
b1 = bal()
print('saved', len(imgs), 'images; generations', b0, '->', b1, f'(used {round(b0 - b1, 2) if b0 is not None and b1 is not None else "?"})')
