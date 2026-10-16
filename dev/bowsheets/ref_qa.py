# 기준 그림 정리본 검수 준비: PixelLab image-to-pixelart 결과 work/<cls>/ref64-0.png →
#   design/ref/<cls>-clean.png (공용 polish.unbg: 바탕·잡점만 뗌) · design/ref/<cls>-polish.png (공용 polish 손질: 14색·외톨이 점·외곽선·위 하이라이트)
#   → 공용 qa_char.py 검수 시트 qa/ref-<cls>-{clean,polish}/  (공용 메모: 손질이 점수를 늘 올리지 않는다 — 둘 다 검수해 높은 쪽)
#   C:\AI\ComfyUI\.venv\Scripts\python.exe -I -B -X utf8 dev/bowsheets/ref_qa.py [직업 ...]
import os, sys, json, importlib.util
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(os.path.dirname(HERE))
CM = os.path.join(ROOT, 'dev', 'sheets-common')
load = lambda n: (lambda sp: (sp.loader.exec_module(m := importlib.util.module_from_spec(sp)), m)[1])(importlib.util.spec_from_file_location(n, os.path.join(CM, n + '.py')))
POL = load('polish')
sys.path.insert(0, CM); sys.path.insert(0, os.path.join(ROOT, 'dev', 'pixel-qa'))
QC = load('qa_char')
REF = os.path.join(HERE, 'design', 'ref'); QA = os.path.join(HERE, 'qa'); os.makedirs(REF, exist_ok=True)
IDS = ['ranger', 'marksman', 'arcaneArcher', 'arbalest']

if __name__ == '__main__':
    out = {}
    for c in (sys.argv[1:] or IDS):
        raw = Image.open(os.path.join(HERE, 'work', c, 'ref64-0.png'))
        clean = POL.unbg(raw); clean = clean.crop(clean.getbbox()); clean.save(os.path.join(REF, f'{c}-clean.png'))
        pol = POL.polish(clean.copy()); pol.save(os.path.join(REF, f'{c}-polish.png'))
        for tag in ('clean', 'polish'):
            res = QC.run(os.path.join(REF, f'{c}-{tag}.png'), f'ref-{c}-{tag}', c, os.path.join(QA, f'ref-{c}-{tag}'))
            r = res[0] if isinstance(res, tuple) else res
            out[f'{c}-{tag}'] = {'size': Image.open(os.path.join(REF, f'{c}-{tag}.png')).size, 'flags': [f['k'] for f in r.get('flags', [])],
                                 'colors': r.get('metrics', {}).get('colors'), 'lrange': r.get('metrics', {}).get('lrange')}
    for k, v in out.items(): print(k, json.dumps(v))
