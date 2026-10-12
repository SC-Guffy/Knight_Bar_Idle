"""UI 도트 아이콘 미리보기 PNG (개발용). node dev/make-icons.js 로 만든 src/skin/icons.png 를 읽어 크게 그린다.
  python -I dev/icon-preview.py <출력.png> [이름 ...]      이름을 빼면 전부. 배율 6, 한 줄 10개, 아래에 이름
배경은 창 바탕색(#1b1a2b). 결과는 dev/shots/ 같은 git 제외 폴더에 두고 Read 로 본다."""
import re, sys, os
from PIL import Image, ImageDraw

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
css = open(os.path.join(ROOT, 'src', 'skin', 'icons.css'), encoding='utf8').read()
names = re.findall(r'^\.pi-([\w-]+)[ ,]', css, re.M)
N, SC, COLS = 14, 6, 10
sheet = Image.open(os.path.join(ROOT, 'src', 'skin', 'icons.png')).convert('RGBA')
want = sys.argv[2:] or names
cell_w, cell_h = N * SC + 16, N * SC + 26
rows = (len(want) + COLS - 1) // COLS
out = Image.new('RGB', (COLS * cell_w, rows * cell_h), '#1b1a2b')
od = ImageDraw.Draw(out)
for i, n in enumerate(want):
  if n not in names:
    print('없는 이름', n); continue
  k = names.index(n)
  ic = sheet.crop((k * N, 0, k * N + N, N)).resize((N * SC, N * SC), Image.NEAREST)
  cx, cy = (i % COLS) * cell_w + 8, (i // COLS) * cell_h + 4
  out.paste(ic, (cx, cy), ic)
  # 1배 크기도 옆에 작게
  small = sheet.crop((k * N, 0, k * N + N, N))
  out.paste(small, (cx + N * SC - N, cy + N * SC + 2), small)
  od.text((cx, cy + N * SC + 4), n, fill='#9c98ad')
out.save(sys.argv[1])
print('saved', sys.argv[1], len(want))
