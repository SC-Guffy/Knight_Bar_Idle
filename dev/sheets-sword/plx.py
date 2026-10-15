# 검사 계열 시트용 PixelLab 호출 래퍼 (dev/boxer/sheets/plx.py 복사) — 응답 usage 로 자기 사용량을 세고 상한 170 을 지킨다. 키는 pl.py 가 읽고 절대 출력하지 않는다.
#   python -I plx.py anim <cls> <name> <first.png> "<action>" [frames=4] [seed=0] [last.png]
#     → work/<cls>/<name>-<i>.png, usage.md 에 한 줄
import sys, os, json, time, base64, io
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', 'pixellab'))
from pl import call

CAP = 90           # 이 계열 상한 (응답 usage 합계, 목표 40~60, docs/specs/legacy-class-sheets.md)
FLOOR = 300        # 계정 잔량 안전 바닥
LOG = os.path.join(HERE, 'usage.md')
STATE = os.path.join(HERE, 'work', 'usage.json')


def bal():
    for _ in range(5):
        st, r = call('GET', '/balance')
        if st == 200: return r['subscription']['generations']
        time.sleep(5)
    return None


def state():
    if os.path.exists(STATE): return json.load(open(STATE, encoding='utf-8'))
    return {'start': None, 'used': 0.0, 'calls': []}


def b64file(p):
    return {'type': 'base64', 'base64': base64.b64encode(open(p, 'rb').read()).decode(), 'format': 'png'}


def images(o, out):
    if isinstance(o, dict):
        if isinstance(o.get('base64'), str) and len(o['base64']) > 100: out.append(o['base64']); return
        for v in o.values(): images(v, out)
    elif isinstance(o, list):
        for v in o: images(v, out)


def run(ep, body, cls, purpose, outpre, est=1):
    s = state()
    b0 = bal()
    if s['start'] is None: s['start'] = b0
    if b0 is None: sys.exit('balance 조회 실패')
    if b0 - est < FLOOR: sys.exit(f'STOP: 잔량 {b0} — 하한 {FLOOR}')
    s.setdefault('nom', float(len(s['calls'])))
    if s['nom'] + est > CAP: sys.exit(f'STOP: 자기 사용(명목) {s["nom"]} + {est} > {CAP}')
    for attempt in range(4):
        st, r = call('POST', ep, body)
        if st in (200, 202): break
        print('HTTP', st, str(r)[:300])
        if st == 429 or st >= 500: time.sleep(20); continue
        sys.exit(1)
    else: sys.exit('retry 실패')
    job = r.get('background_job_id') if isinstance(r, dict) else None
    if job:
        for _ in range(150):
            time.sleep(5)
            st, j = call('GET', f'/background-jobs/{job}')
            stt = j.get('status') if isinstance(j, dict) else None
            if stt == 'completed': r = j; break
            if stt == 'failed': print('FAILED', str(j)[:500]); r = None; break
        else: print('TIMEOUT', job); r = None
    imgs = []
    if r is not None: images(r, imgs)
    def find_usage(o):
        if isinstance(o, dict):
            if 'usage' in o and o['usage']: return o['usage']
            for v in o.values():
                u = find_usage(v)
                if u: return u
        elif isinstance(o, list):
            for v in o:
                u = find_usage(v)
                if u: return u
    ru = find_usage(r); print('response usage:', ru)
    if isinstance(ru, dict) and ru.get('type') == 'generations': est = ru.get('generations', est)
    os.makedirs(os.path.dirname(outpre), exist_ok=True)
    for i, b in enumerate(imgs):
        if ',' in b[:40]: b = b.split(',', 1)[1]
        open(f'{outpre}-{i}.png', 'wb').write(base64.b64decode(b))
    time.sleep(3)
    b1 = bal()
    used = round(b0 - b1, 2) if b1 is not None else est
    s['used'] = round(s['used'] + used, 2); s['nom'] = round(s.get('nom', 0) + est, 2)
    s['calls'].append({'cls': cls, 'ep': ep, 'purpose': purpose, 'used': used, 'bal': b1})
    json.dump(s, open(STATE, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    new = not os.path.exists(LOG)
    with open(LOG, 'a', encoding='utf-8') as f:
        if new:
            f.write(f'# 검사 계열 + 견습 시트 — PixelLab 사용 기록 (명목 = 응답 usage)\n\n시작 잔량: {s["start"]} (상한: 자기 호출 {CAP}회, 계정 잔량 {FLOOR} 아래면 멈춤)\n\n'
                    '| # | 직업 | 엔드포인트 | 목적 | 사용 | 누적(자기) | 계정 잔량 |\n|---|---|---|---|---|---|---|\n')
        f.write(f'| {len(s["calls"])} | {cls} | `{ep}` | {purpose} | {used} / {est} | {s["used"]} / {s["nom"]} | {b1} |\n')
    print('saved', len(imgs), 'used', used, 'self', s['used'], 'nom', s['nom'], 'bal', b1)
    return len(imgs)


if __name__ == '__main__':
    a = sys.argv
    if a[1] == 'anim':
        cls, name, first, action = a[2], a[3], a[4], a[5]
        fc = int(a[6]) if len(a) > 6 else 4; seed = int(a[7]) if len(a) > 7 else 0
        body = {'first_frame': b64file(first), 'action': action, 'frame_count': fc, 'seed': seed, 'no_background': True}
        if len(a) > 8: body['last_frame'] = b64file(a[8])
        run('/animate-with-text-v3', body, cls, f'{name}: {action[:60]}', os.path.join(HERE, 'work', cls, name))
    elif a[1] == 'edit':  # plx.py edit <cls> <name> <src.png> "<description>" [seed]
        cls, name, src, desc = a[2], a[3], a[4], a[5]
        seed = int(a[6]) if len(a) > 6 else 0
        body = {'image': b64file(src), 'description': desc, 'seed': seed, 'no_background': True}
        run('/edit-image-pixen', body, cls, f'{name}: {desc[:60]}', os.path.join(HERE, 'work', cls, name))
    elif a[1] == 'bal':
        print(bal(), state()['used'])
