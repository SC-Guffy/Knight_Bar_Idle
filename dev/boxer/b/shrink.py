# 시안 1024 → 키 46 도트 (마법사 계열 design.shrink2 그대로: 14색 번호 → 칸마다 최빈, 외곽선 보존, 외톨이 점 정리)
#  C:\AI\ComfyUI\.venv\Scripts\python.exe -I -B dev/boxer/b/shrink.py [이름 접두 ...] → dev/boxer/b/px/<이름>.png
import os, sys, importlib.util
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__)); RAW = os.path.join(HERE, 'raw'); PX = os.path.join(HERE, 'px')
sp = importlib.util.spec_from_file_location('mage_design', os.path.join(HERE, '..', '..', 'sheets-mage', 'design.py'))
MD = importlib.util.module_from_spec(sp); sp.loader.exec_module(MD)

if __name__ == '__main__':
    os.makedirs(PX, exist_ok=True); pre = sys.argv[1:] or ['']
    for f in sorted(os.listdir(RAW)):
        if not f.endswith('.png') or not any(f.startswith(p) for p in pre): continue
        im = MD.shrink2(Image.open(os.path.join(RAW, f)), 46)
        if im is None: print('skip', f); continue
        im.save(os.path.join(PX, f)); print(f, im.size)
