# 마법사 계열 시트용 PixelLab 호출 래퍼 (docs/specs/legacy-class-sheets.md). 키는 dev/pixellab/pl.py 가 읽고 여기서는 절대 출력하지 않는다.
#  자기 사용량 = 응답 usage 합계 (계정을 여러 세션이 같이 써서 잔량 차이로 세지 않는다). 상한 CAP, 계정 잔량 FLOOR 아래면 멈춘다.
#   python -I plx.py anim <cls> <name> <first.png> "<action>" [frames=8] [seed=0]   → work/<cls>/<name>-<i>.png
#   python -I plx.py edit <cls> <name> <src.png> "<description>" [seed=0]
#   python -I plx.py bal
#  승인 게이트: approved.txt 에 "<cls>/<name>" 줄이 있어야 호출한다 (CLAUDE.md "무작정 뽑지 않는다")
import sys, os, json, time, base64
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', 'pixellab'))
from pl import call

CAP = 105           # 이 계열 상한 (응답 usage 합계)   # 2026-10-17 로드맵: 계열 상한 90 → 105
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
    return {'used': 0.0, 'calls': []}


def b64file(p):
    return {'type': 'base64', 'base64': base64.b64encode(open(p, 'rb').read()).decode(), 'format': 'png'}


def images(o, out):
    if isinstance(o, dict):
        if isinstance(o.get('base64'), str) and len(o['base64']) > 100: out.append(o['base64']); return
        for v in o.values(): images(v, out)
    elif isinstance(o, list):
        for v in o: images(v, out)


def find_usage(o):
    if isinstance(o, dict):
        if o.get('usage'): return o['usage']
        for v in o.values():
            u = find_usage(v)
            if u: return u
    elif isinstance(o, list):
        for v in o:
            u = find_usage(v)
            if u: return u


APPROVED = os.path.join(HERE, 'approved.txt')     # 로드맵 세션이 승인한 호출 이름 (한 줄에 하나, "<cls>/<name>") — 없으면 호출하지 않는다


def approved(cls, name):
    if not os.path.exists(APPROVED): return False
    return f'{cls}/{name}' in {l.strip() for l in open(APPROVED, encoding='utf-8') if l.strip() and not l.startswith('#')}


def run(ep, body, cls, purpose, outpre):
    name = os.path.basename(outpre)
    if not approved(cls, name): sys.exit(f'STOP: {cls}/{name} 는 승인 목록(approved.txt)에 없다')
    s = state()
    b0 = bal()
    if b0 is None: sys.exit('balance 조회 실패')
    if b0 - 1 < FLOOR: sys.exit(f'STOP: 계정 잔량 {b0} — 바닥 {FLOOR}')
    if s['used'] + 1 > CAP: sys.exit(f'STOP: 자기 사용 {s["used"]} + 1 > 상한 {CAP}')
    for _ in range(4):
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
    ru = find_usage(r)
    used = ru.get('generations', 1.0) if isinstance(ru, dict) and ru.get('type') == 'generations' else 1.0
    print('response usage:', ru)
    os.makedirs(os.path.dirname(outpre), exist_ok=True)
    for i, b in enumerate(imgs):
        if ',' in b[:40]: b = b.split(',', 1)[1]
        open(f'{outpre}-{i}.png', 'wb').write(base64.b64decode(b))
    b1 = bal()
    s['used'] = round(s['used'] + used, 2)
    s['calls'].append({'cls': cls, 'ep': ep, 'purpose': purpose, 'used': used, 'bal': b1})
    os.makedirs(os.path.dirname(STATE), exist_ok=True)
    json.dump(s, open(STATE, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    new = not os.path.exists(LOG)
    with open(LOG, 'a', encoding='utf-8') as f:
        if new:
            f.write(f'# 마법사 계열 시트 — PixelLab 사용 기록\n\n상한: 응답 usage 합계 {CAP}, 계정 잔량 {FLOOR} 아래면 멈춤.\n\n'
                    '| # | 직업 | 엔드포인트 | 목적 | usage | 누적 | 계정 잔량 |\n|---|---|---|---|---|---|---|\n')
        f.write(f'| {len(s["calls"])} | {cls} | `{ep}` | {purpose} | {used} | {s["used"]} | {b1} |\n')
    print('saved', len(imgs), 'used', used, 'self', s['used'], 'bal', b1)
    return len(imgs)


if __name__ == '__main__':
    a = sys.argv
    if a[1] == 'anim':
        cls, name, first, action = a[2], a[3], a[4], a[5]
        fc = int(a[6]) if len(a) > 6 else 8; seed = int(a[7]) if len(a) > 7 else 0
        body = {'first_frame': b64file(first), 'action': action, 'frame_count': fc, 'seed': seed, 'no_background': True}
        run('/animate-with-text-v3', body, cls, f'{name}: {action[:70]}', os.path.join(HERE, 'work', cls, name))
    elif a[1] == 'edit':
        cls, name, src, desc = a[2], a[3], a[4], a[5]
        seed = int(a[6]) if len(a) > 6 else 0
        body = {'image': b64file(src), 'description': desc, 'seed': seed, 'no_background': True}
        run('/edit-image-pixen', body, cls, f'{name}: {desc[:70]}', os.path.join(HERE, 'work', cls, name))
    elif a[1] == 'raw':   # plx.py raw <cls> <name> <endpoint> <body.json> — 본문 파일을 그대로 (image-to-pixelart 정리 등)
        cls, name, ep, bf = a[2], a[3], a[4], a[5]
        run(ep, json.load(open(bf, encoding='utf-8')), cls, f'{name}: {ep}', os.path.join(HERE, 'work', cls, name))
    elif a[1] == 'bal':
        print('balance', bal(), 'self', state()['used'])
