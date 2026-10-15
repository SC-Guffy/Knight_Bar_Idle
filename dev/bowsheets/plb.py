# 레인저 계열 시트용 PixelLab 호출 — 응답 usage 합계로 자기 사용량을 세고 상한(170)·계정 바닥(300)을 지킨다.
# 키는 dev/pixellab/pl.py 가 읽는다 (절대 출력하지 않는다).
#   python -I plb.py anim <cls> <name> <first.png> "<action>" [frames=4] [seed=0]   → work/<cls>/<name>-<i>.png
#   python -I plb.py edit <cls> <name> <src.png> "<description>" [seed=0]
#   python -I plb.py bal
import sys, os, json, time, base64
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', 'pixellab'))
from pl import call

CAP, FLOOR = 90, 300
APPROVED = os.path.join(HERE, "approved.txt")   # 로드맵 세션이 승인한 호출 이름 한 줄씩 — 없으면 호출 안 함 (2026-10-14 동결)
LOG = os.path.join(HERE, 'usage.md'); STATE = os.path.join(HERE, 'usage.json')


def bal():
    for _ in range(5):
        st, r = call('GET', '/balance')
        if st == 200: return r['subscription']['generations']
        time.sleep(5)


def state():
    return json.load(open(STATE, encoding='utf-8')) if os.path.exists(STATE) else {'used': 0.0, 'calls': []}


def b64(p):
    return {'type': 'base64', 'base64': base64.b64encode(open(p, 'rb').read()).decode(), 'format': 'png'}


def walk(o, f):
    if isinstance(o, dict):
        r = f(o)
        if r is not None: return r
        for v in o.values():
            r = walk(v, f)
            if r is not None: return r
    elif isinstance(o, list):
        for v in o:
            r = walk(v, f)
            if r is not None: return r


def images(o, out):
    if isinstance(o, dict):
        if isinstance(o.get('base64'), str) and len(o['base64']) > 100: out.append(o['base64']); return
        for v in o.values(): images(v, out)
    elif isinstance(o, list):
        for v in o: images(v, out)


def run(ep, body, cls, purpose, outpre):
    tag = f'{cls}/{os.path.basename(outpre)}'
    ok = set(open(APPROVED, encoding='utf-8').read().split()) if os.path.exists(APPROVED) else set()
    if tag not in ok: sys.exit(f'STOP: 승인 안 된 호출 {tag} (approved.txt)')
    s = state(); b0 = bal()
    if b0 is None: sys.exit('balance 조회 실패')
    if b0 < FLOOR: sys.exit(f'STOP: 계정 잔량 {b0} < {FLOOR}')
    if s['used'] + 1 > CAP: sys.exit(f'STOP: 자기 사용 {s["used"]} — 상한 {CAP}')
    for _ in range(4):
        st, r = call('POST', ep, body)
        if st in (200, 202): break
        print('HTTP', st, str(r)[:400])
        if st == 429 or st >= 500: time.sleep(20); continue
        sys.exit(1)
    else: sys.exit('retry 실패')
    u = walk(r, lambda d: d['usage'] if d.get('usage') else None)
    job = r.get('background_job_id') if isinstance(r, dict) else None
    if job:
        for _ in range(180):
            time.sleep(5)
            st, j = call('GET', f'/background-jobs/{job}')
            stt = j.get('status') if isinstance(j, dict) else None
            if stt == 'completed': r = j; break
            if stt == 'failed': print('FAILED', str(j)[:500]); r = None; break
        else: print('TIMEOUT', job); r = None
    if r is not None: u = walk(r, lambda d: d['usage'] if d.get('usage') else None) or u
    used = float(u.get('generations', 1)) if isinstance(u, dict) else 1.0
    imgs = []
    if r is not None: images(r, imgs)
    os.makedirs(os.path.dirname(outpre), exist_ok=True)
    for i, b in enumerate(imgs):
        if ',' in b[:40]: b = b.split(',', 1)[1]
        open(f'{outpre}-{i}.png', 'wb').write(base64.b64decode(b))
    s['used'] = round(s['used'] + used, 2)
    s['calls'].append({'cls': cls, 'ep': ep, 'purpose': purpose, 'usage': used, 'n': len(imgs), 'bal_before': b0})
    json.dump(s, open(STATE, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    new = not os.path.exists(LOG)
    with open(LOG, 'a', encoding='utf-8') as f:
        if new: f.write(f'# 레인저 계열 시트 — PixelLab 사용 기록\n\n상한: 응답 usage 합계 {CAP}회, 계정 잔량 {FLOOR} 아래면 멈춤\n\n'
                        '| # | 직업 | 엔드포인트 | 목적 | usage | 누적 | 호출 전 잔량 |\n|---|---|---|---|---|---|---|\n')
        f.write(f'| {len(s["calls"])} | {cls} | `{ep}` | {purpose} | {used} | {s["used"]} | {b0} |\n')
    print('saved', len(imgs), 'usage', used, 'self', s['used'], 'bal_before', b0)


if __name__ == '__main__':
    a = sys.argv
    if a[1] == 'anim':
        cls, name, first, action = a[2:6]
        fc = int(a[6]) if len(a) > 6 else 4; seed = int(a[7]) if len(a) > 7 else 0
        body = {'first_frame': b64(first), 'action': action, 'frame_count': fc, 'seed': seed, 'no_background': True}
        run('/animate-with-text-v3', body, cls, f'{name}: {action[:70]}', os.path.join(HERE, 'work', cls, name))
    elif a[1] == 'edit':
        cls, name, src, desc = a[2:6]; seed = int(a[6]) if len(a) > 6 else 0
        body = {'image': b64(src), 'description': desc, 'seed': seed, 'no_background': True}
        run('/edit-image-pixen', body, cls, f'{name}: {desc[:70]}', os.path.join(HERE, 'work', cls, name))
    elif a[1] == 'bal':
        print('balance', bal(), 'self', state()['used'])
