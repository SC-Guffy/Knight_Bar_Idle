# 창기사 계열 디자인 시안 일괄 검수 0~2단: design/px/<직업>4-<시드>-h46.png → qa/<이름>/ (sheet.png · metrics.json)
#  목표 모습 문장은 qa_intent.json (사용자 지적을 실패 조건으로). 3단 비평은 세션이 서브에이전트에 sheet.png·metrics.json 을 넘긴다.
#   C:\AI\ComfyUI\.venv\Scripts\python.exe -I -B qa_batch.py [접두 4]
import os, sys, glob, json, re
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
from qa_char import check
INTENT = json.load(open(os.path.join(HERE, 'qa_intent.json'), encoding='utf-8'))
tag = sys.argv[1] if len(sys.argv) > 1 else '4'
for f in sorted(glob.glob(os.path.join(HERE, 'design', 'px', f'*{tag}-*-h46.png'))):
    name = os.path.basename(f)[:-8]; cls = re.match(r'[A-Za-z]+', name).group(0)
    r = check(f, name, INTENT[cls])
    print(name, 'gate', r['gate']['pass'], 'flags', [x['k'] for x in r['flags']], 'colors', r['metrics'].get('colors'), 'size', r['size'])
