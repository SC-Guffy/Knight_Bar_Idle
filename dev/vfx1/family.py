# 마법사 계열 비교 그림 (조사 family-mage.png 와 같은 배치): 줄 = 2차 3종 + 3차 3종, 칸 = 스킬 둘(3차는 궁극기 b·c) + 평타
#  python -I family.py  → dev/vfx-survey/vfx1/family-mage-after.png, -gray.png
import os
from PIL import Image, ImageDraw, ImageOps
HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, '..', 'vfx-survey', 'vfx1')
OUT = os.path.join(HERE, '..', 'vfx-survey', 'vfx1')
ROWS = [('pyro', ['meteor-b', 'flameVortex-b', 'basic-pyromancer-b']), ('cryo', ['iceLance-b', 'blizzard-b', 'basic-cryomancer-b']),
        ('elec', ['chainLightning-b', 'thunderstorm-b', 'basic-electromancer-b']), ('archmage', ['apocalypse-b', 'apocalypse-c', 'basic-archmage-b']),
        ('frost', ['absoluteZero-b', 'absoluteZero-c', 'basic-frostlord-b']), ('thunder', ['thunderJudgment-b', 'thunderJudgment-c', 'basic-thunderEmperor-b'])]
TW, TH = 360, 150
sh = Image.new('RGB', (TW * 3 + 6, (TH + 2) * len(ROWS)), (40, 44, 56)); d = ImageDraw.Draw(sh)
for r, (lab, cols) in enumerate(ROWS):
    for c, name in enumerate(cols):
        p = os.path.join(SRC, name + '-after.png')
        x, y = c * (TW + 3), r * (TH + 2)
        if os.path.exists(p): sh.paste(Image.open(p).convert('RGB').resize((TW, TH), Image.LANCZOS), (x, y))
        d.text((x + 3, y + 2), f'{lab} {name}', fill=(255, 255, 0))
sh.save(os.path.join(OUT, 'family-mage-after.png'))
ImageOps.grayscale(sh).save(os.path.join(OUT, 'family-mage-after-gray.png'))
print('ok', sh.size)
