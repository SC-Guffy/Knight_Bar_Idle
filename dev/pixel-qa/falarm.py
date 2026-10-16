# 오경보 시험 (스펙 docs/specs/pixel-qa.md 수용 기준): 확정 시트(취향 기록 verdict: pass, 다시 뽑기 6장 제외)에서 무작위 N장을
# 게임 배율·쓰임 그대로 검수 시트로 만든다. 비평에는 f01~ 폴더만 넘긴다(이름 지움). 정답표 key.json 은 채점 때만 연다.
#   python3 dev/pixel-qa/falarm.py <출력 폴더> [N=30] [seed=16]
#   채점: python3 dev/pixel-qa/falarm.py --score <출력 폴더>   (각 폴더의 verdict.json 을 읽는다. 목표: regen 3장 이하)
import sys, os, re, glob, json, random
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from qa import ROOT, run, sheet_opts, usage_raw

REGEN6 = {'k22', 'e18', 'e14', 'k36', 'k32', 'k37'}


def labels():
    """취향 기록에서 id 별 마지막 판정 (나중 줄이 앞 줄을 덮는다)"""
    last = {}
    for line in open(os.path.join(ROOT, 'dev/pixel-qa/labels.jsonl'), encoding='utf8'):
        if line.strip():
            d = json.loads(line)
            if d.get('file'): last[d['id']] = d
    return last


def src_texts():
    return {f: open(f, encoding='utf8').read() for f in glob.glob(os.path.join(ROOT, 'src/**/*.js'), recursive=True)}


def usage(sid, texts):
    """게임 배율(texFx/texHit 의 scale, 없으면 1)과 쓰임 문장(등록 줄 주석 + 쓰는 파일)"""
    scale, where, note = None, [], ''
    for f, t in texts.items():
        if re.search(r"['\"]%s['\"]" % sid, t): where.append(os.path.basename(f))
        for m in re.finditer(r"tex\w*\(\s*['\"]%s['\"][^;\n]*" % sid, t):
            s = re.search(r'scale: ?([0-9.]+)(?: ?/ ?([0-9.]+))?', m.group(0))
            if s and scale is None: scale = float(s.group(1)) / (float(s.group(2)) if s.group(2) else 1)
        c = re.search(r'^\s*%s: \{[^}]*\},?\s*//\s*(.+)$' % sid, t, re.M)
        if c and not note: note = c.group(1).strip()
    return scale or 1.0, note, where


def build(out, n=30, seed=16):
    lab, opts, raw, texts = labels(), sheet_opts(), usage_raw(), src_texts()
    ids = sorted(k for k, d in lab.items() if d['verdict'] == 'pass' and d['kind'] == 'vfx' and k not in REGEN6
                 and os.path.exists(os.path.join(ROOT, d['file'])))
    pick = random.Random(seed).sample(ids, n)
    key = {}
    for i, sid in enumerate(pick):
        fid = f'f{i + 1:02d}'; scale, note, where = usage(sid, texts)
        use = (note or '쓰임 주석 없음') + f" — 쓰는 곳: {', '.join(where[:4]) or '?'}. " + \
              ('원래 색 시트' if raw.get(sid) else '직업색 시트(대표색 #4da6ff 로 칠함)')
        run(os.path.join(ROOT, lab[sid]['file']), sid, None, None, False, use, os.path.join(out, fid), opts=opts.get(sid, {}), scale=scale)
        m = json.load(open(os.path.join(out, fid, 'metrics.json'), encoding='utf8'))
        m['id'] = fid; m['file'] = '(blind)'
        json.dump(m, open(os.path.join(out, fid, 'metrics.json'), 'w', encoding='utf8'), ensure_ascii=False, indent=1)
        key[fid] = {'id': sid, 'file': lab[sid]['file'], 'scale': scale, 'use': use}
    json.dump(key, open(os.path.join(out, 'key.json'), 'w', encoding='utf8'), ensure_ascii=False, indent=1)
    print('built', len(key), 'of', len(ids))


def score(out):
    key = json.load(open(os.path.join(out, 'key.json'), encoding='utf8'))
    rows, cnt = [], {}
    for fid, t in sorted(key.items()):
        p = os.path.join(out, fid, 'verdict.json')
        v = json.load(open(p, encoding='utf8')) if os.path.exists(p) else {}
        sc = v.get('scores', {}); verdict = v.get('verdict', '?')
        cnt[verdict] = cnt.get(verdict, 0) + 1
        m = json.load(open(os.path.join(out, fid, 'metrics.json'), encoding='utf8'))
        rows.append(dict(fid=fid, **t, verdict=verdict, avg=round(sum(sc.values()) / len(sc), 2) if sc else None, scores=sc,
                         summary=v.get('summary', ''), defects=v.get('defects', []), flags=m['flags'], gate=m['gate']))
    res = dict(n=len(rows), count=cnt, ok=cnt.get('regen', 0) <= 3, rows=rows)
    json.dump(res, open(os.path.join(out, 'score.json'), 'w', encoding='utf8'), ensure_ascii=False, indent=1)
    print('판정 수', cnt, '→ regen 3장 이하', '통과' if res['ok'] else '미달')
    for r in rows: print(r['fid'], r['id'], '→', r['verdict'], r['avg'], r['summary'])


if __name__ == '__main__':
    if sys.argv[1] == '--score': score(sys.argv[2])
    else: build(sys.argv[1], int(sys.argv[2]) if len(sys.argv) > 2 else 30, int(sys.argv[3]) if len(sys.argv) > 3 else 16)
