# 도트 품질 지표 보정 실험 (스펙 docs/specs/pixel-qa.md "보정") — 판정이 이미 난 그림으로 지표가 합격/탈락을 가르는지 본다.
#   python3 dev/pixel-qa/calib.py > dev/review/pixel-qa/calib.json
# 세트: old/<id> 다시 뽑기 탈락 6 · vfx/<id> 등록된 src/vfx 시트 전부 (확정). 지표는 게임 로더를 거친 모습(qa.render)에서 잰다.
import sys, os, json
import numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from qa import ROOT, CLASS, sheet_opts, usage_raw, render, metrics

REGEN = ('k22', 'e18', 'e14', 'k36', 'k32', 'k37')
OLD_RAW = {'k22': True, 'k37': True}
OPTS, USE = sheet_opts(), usage_raw()
items = []
for k in REGEN:
    items.append(('old/' + k, np.asarray(Image.open(os.path.join(ROOT, 'dev/vfx5/old', k + '.png')).convert('RGBA')), OPTS.get(k, {'frames': 5}), 'raw' if OLD_RAW.get(k) else CLASS))
for k, o in sorted(OPTS.items()):
    f = os.path.join(ROOT, 'src/vfx', k + '.png')
    if os.path.exists(f): items.append(('vfx/' + k, np.asarray(Image.open(f).convert('RGBA')), o, 'raw' if USE.get(k) else CLASS))
R = render(items, os.environ.get('QA_TMP'))
outdir = os.path.join(ROOT, 'dev/review/pixel-qa/rendered'); os.makedirs(outdir, exist_ok=True)
out = {}
for key, raw, o, _ in items:
    ren = R[key]; fr = o['frames']
    mr, mg = metrics(raw, fr), metrics(ren, fr)
    if not mr or not mg: continue
    mg['strip'] = round(1 - mg['_n'] / mr['_n'], 3)
    for m in (mr, mg): m.pop('_n'); m.pop('area')
    out[key] = dict(raw=mr, game=mg, frames=fr)
    if key.split('/')[1] in REGEN: Image.fromarray(ren).save(os.path.join(outdir, key.replace('/', '-') + '.png'))
json.dump(out, sys.stdout, ensure_ascii=False, indent=0)
