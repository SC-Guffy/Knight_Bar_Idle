# 블라인드 시험 (스펙 docs/specs/pixel-qa.md 수용 기준): 다시 뽑기 6쌍(탈락 dev/vfx5/old · 합격 src/vfx)을 이름을 지운 12장으로 섞어
# 검수 시트를 만든다. 비평에는 b01~b12 폴더만 넘기고, 정답표 key.json 은 채점 때만 연다.
#   python3 dev/pixel-qa/blind.py <출력 폴더> [seed]
#   채점: python3 dev/pixel-qa/blind.py --score <출력 폴더>   (각 폴더의 verdict.json 을 읽는다)
import sys, os, json, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from qa import ROOT, run

# 쓰임만 적는다 (다시 뽑기 때 정한 "목표 모습" 문장은 새 그림을 설명하므로 넣지 않는다). 색·배율은 게임 코드 그대로
CASES = {
    'k22': dict(color='raw', scale=2 / 3, use='다연장 사격(쇠뇌 연사) 명중 이펙트 — 화살이 맞은 자리에 짧게 터진다. 한 스킬에서 여러 번 겹쳐 나온다. 원래 색 시트'),
    'e18': dict(color='#b388ff', scale=4 / 3, tile=True, use='용의 숨결 광선 타일 — 입에서 화면 끝까지 가로로 이어 붙이는 광선 몸통, 프레임이 돌며 일렁이는 루프. 직업색(보라)'),
    'e14': dict(color='#c9b38a', scale=1, use='대검 돌진 격돌 시 땅이 파이는 이펙트 — 바닥 기준. 직업색(흙빛)'),
    'k36': dict(color='#ff4dff', scale=2, use='차원 붕괴(궁극기) 마지막 타격 — 공간이 무너지는 막타. 직업색(자홍)'),
    'k32': dict(color='#ff4dd2', scale=4 / 3, use='용황 강림(궁극기) 마지막 타격 — 분홍 용염 폭발, 바닥 기준. 직업색(분홍 불)'),
    'k37': dict(color='raw', scale=2, use='대공성포(궁극기) 포격 마지막 타격 — 바닥 기준 대폭발. 원래 색 시트'),
}


def build(out, seed=7):
    items = [(k, 'old', os.path.join(ROOT, 'dev/vfx5/old', k + '.png')) for k in CASES] + \
            [(k, 'new', os.path.join(ROOT, 'src/vfx', k + '.png')) for k in CASES]
    random.Random(seed).shuffle(items)
    key = {}
    for i, (k, which, png) in enumerate(items):
        bid = f'b{i + 1:02d}'; c = CASES[k]
        run(png, k, c['color'], 5, c.get('tile', False), c['use'], os.path.join(out, bid), scale=c['scale'])
        m = json.load(open(os.path.join(out, bid, 'metrics.json'), encoding='utf8'))
        m['id'] = bid; m['file'] = '(blind)'   # 이름·경로를 지운다
        json.dump(m, open(os.path.join(out, bid, 'metrics.json'), 'w', encoding='utf8'), ensure_ascii=False, indent=1)
        key[bid] = {'id': k, 'which': which, 'truth': 'fail' if which == 'old' else 'pass'}
    json.dump(key, open(os.path.join(out, 'key.json'), 'w', encoding='utf8'), ensure_ascii=False, indent=1)
    print('built', len(key))


def score(out):
    key = json.load(open(os.path.join(out, 'key.json'), encoding='utf8'))
    rows, hit_fail, false_fail = [], 0, 0
    for bid, t in sorted(key.items()):
        p = os.path.join(out, bid, 'verdict.json')
        v = json.load(open(p, encoding='utf8')) if os.path.exists(p) else None
        verdict = v['verdict'] if v else '?'
        sc = v['scores'] if v else {}
        avg = round(sum(sc.values()) / len(sc), 2) if sc else None
        said_fail = verdict in ('fix', 'regen')
        if t['truth'] == 'fail' and said_fail: hit_fail += 1
        if t['truth'] == 'pass' and said_fail: false_fail += 1
        rows.append(dict(bid=bid, **t, verdict=verdict, avg=avg, scores=sc, summary=v.get('summary') if v else '', defects=v.get('defects') if v else [],
                         flags=json.load(open(os.path.join(out, bid, 'metrics.json'), encoding='utf8'))['flags']))
    res = dict(caught=hit_fail, of=6, false_fail=false_fail, rows=rows)
    json.dump(res, open(os.path.join(out, 'score.json'), 'w', encoding='utf8'), ensure_ascii=False, indent=1)
    print(f'탈락작 잡음 {hit_fail}/6 · 합격작을 탈락시킴 {false_fail}/6')
    for r in rows: print(r['bid'], r['id'], r['which'], '→', r['verdict'], r['avg'], r['summary'])


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')   # Windows 콘솔(cp949)에 없는 '—' 등으로 죽지 않게
    if sys.argv[1] == '--score': score(sys.argv[2])
    else: build(sys.argv[1], int(sys.argv[2]) if len(sys.argv) > 2 else 7)
