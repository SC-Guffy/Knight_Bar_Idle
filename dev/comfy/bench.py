# 속도 측정: 같은 모델을 연속으로 돌린 안정 상태의 한 장 시간 (모델 교체·첫 로드 제외)
#   C:\AI\ComfyUI\.venv\Scripts\python.exe dev/comfy/bench.py
import os, sys, json, time
sys.path.insert(0, os.path.dirname(__file__))
from comfy import gen
from trial import TEX, prompt, LOG, log

desc = TEX['h1'][0]
res = {}
for model in ('sdxl', 'zimg'):
    pos, neg = prompt(model, desc)
    gen(model, pos, neg, seed=999)  # 데우기 (모델 로드)
    for label, kw in (('1024 1장', dict(w=1024, h=1024)), ('1024 4장 배치', dict(w=1024, h=1024, batch=4)),
                      ('768 1장', dict(w=768, h=768))):
        ts = []
        for s in range(3):
            ims, dt = gen(model, pos, neg, seed=1000 + s, **kw)
            ts.append(dt / len(ims))
        res[f'{model} {label}'] = round(sorted(ts)[1], 2)
        print(model, label, [round(t, 2) for t in ts], flush=True)
log(kind='bench', res=res)
print(json.dumps(res, ensure_ascii=False))
