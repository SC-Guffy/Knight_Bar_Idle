# 비평 판정 모으기: qa/<이름>/verdict.json → 표 (합격선: 전 항목 3+ · 평균 3.5+, docs/specs/pixel-qa.md)
#   python -I -B qa_sum.py [접두]   → stdout 표 + qa/summary.json
import os, sys, json, glob
HERE = os.path.dirname(os.path.abspath(__file__))
tag = sys.argv[1] if len(sys.argv) > 1 else ''
rows = []
for f in sorted(glob.glob(os.path.join(HERE, 'qa', f'*{tag}*', 'verdict.json'))):
    n = os.path.basename(os.path.dirname(f))
    try: v = json.load(open(f, encoding='utf-8'))
    except Exception as e: rows.append({'name': n, 'err': str(e)}); continue
    sc = v.get('scores', {}); vals = [x for x in sc.values() if isinstance(x, (int, float))]
    avg = round(sum(vals) / len(vals), 2) if vals else 0
    ok = bool(vals) and min(vals) >= 3 and avg >= 3.5
    rows.append({'name': n, 'scores': sc, 'avg': avg, 'pass': ok, 'verdict': v.get('verdict'), 'summary': v.get('summary', ''), 'fix': v.get('fix', {})})
json.dump(rows, open(os.path.join(HERE, 'qa', 'summary.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
for r in rows:
    if 'err' in r: print(r['name'], 'ERR', r['err']); continue
    s = r['scores']; print(f"{r['name']:16s} {'합격' if r['pass'] else '불합'} 평균 {r['avg']} {r['verdict']:6s} " + ' '.join(f"{k[:3]}{s[k]}" for k in s) + ' | ' + r['summary'])
