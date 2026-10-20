# 고른 장면 + 차수 테두리 → src/skin/skill-icons.png (32×32 칸, 16열) + src/skin/skill-icons.css (.ski-<ic> 칸 위치)
# 고른 파일: picks.json {ic: "raw/…png"} (없으면 raw/<ic>-s11.png). docs/specs/skill-card-icons.md
import os, json
from PIL import Image
from prompts import SK, TIER
from frame import frame
HERE = os.path.dirname(os.path.abspath(__file__))
SKIN = os.path.join(HERE, '..', '..', 'src', 'skin')
COLS = 16
pp = os.path.join(HERE, 'picks.json')
picks = json.load(open(pp, encoding='utf-8')) if os.path.exists(pp) else {}
ics = [ic for ic in SK if os.path.exists(os.path.join(HERE, picks.get(ic, f'raw/{ic}-s11.png')))]
rows = (len(ics) + COLS - 1) // COLS
sheet = Image.new('RGBA', (COLS * 32, rows * 32), (0, 0, 0, 0))
css = ['/* 생성 파일 — dev/skill-icons/build.py. 스킬 카드·장착 칸 32×32 배지 (docs/specs/skill-card-icons.md) */',
       '.ski { display: block; flex: none; width: 32px; height: 32px; image-rendering: pixelated; background: no-repeat; }',
       '.ski > canvas { margin: 2px; }',
       '.t7card.lock .ski { filter: grayscale(1) brightness(.6); }']
for i, ic in enumerate(ics):
    im = frame(Image.open(os.path.join(HERE, picks.get(ic, f'raw/{ic}-s11.png'))).resize((32, 32), Image.NEAREST), TIER[SK[ic][1]])
    x, y = (i % COLS) * 32, (i // COLS) * 32
    sheet.alpha_composite(im, (x, y))
    css.append(f'.ski-{ic} {{ background-image: url(skill-icons.png); background-position: -{x}px -{y}px; }} .ski-{ic} > canvas {{ display: none; }}')
sheet.save(os.path.join(SKIN, 'skill-icons.png'))
open(os.path.join(SKIN, 'skill-icons.css'), 'w', encoding='utf-8', newline='\n').write('\n'.join(css) + '\n')
print('skill-icons', len(ics), 'of', len(SK))
