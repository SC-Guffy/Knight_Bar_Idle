# 다시 뽑기(2026-10-16): vfx_workbench 내보내기(격자 시트 + JSON) → 게임 시트(프레임을 가로로 이은 한 장)
#   python3 dev/vfx5/strip.py <export.png> <export.json> <out.png> [frames]   frames: 앞에서부터 몇 장 (기본 전부)
import sys, json
from PIL import Image
src, meta, out = sys.argv[1], sys.argv[2], sys.argv[3]
im = Image.open(src).convert('RGBA'); fr = json.load(open(meta))['frames']
if isinstance(fr, dict): fr = list(fr.values())
n = int(sys.argv[4]) if len(sys.argv) > 4 else len(fr)
fw, fh = fr[0]['frame']['w'], fr[0]['frame']['h']
sheet = Image.new('RGBA', (fw * n, fh))
for i, f in enumerate(fr[:n]):
    r = f['frame']; sheet.paste(im.crop((r['x'], r['y'], r['x'] + r['w'], r['y'] + r['h'])), (i * fw, 0))
sheet.save(out); print(out, sheet.size)
