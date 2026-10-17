# 12단계 (사용자 2026-10-18 "그냥 아예 기존꺼 다 무시하고 새로그려 / 검사류 싹다"): 검사 계열 8종 디자인을 처음부터 새로.
#  그림체·크기 = 사용자가 좋다고 한 파이터 계열 현재 시트 (키 ~37, 1px 외곽선, 8~19색). 파이터 7:3 v2 방식(dev/boxer/style_gen.py)을 따른다:
#  PixelLab generate-with-style-v2, 스타일 참고 = 파이터 계열 시트 대기 그림 4장을 42×42 에 꽉 맞게 (옛 기사 그림은 안 넣음) → 한 번에 변형 64장.
#  3차는 참고 1장을 부모 2차의 고른 그림으로 바꾼다 (성기사→성좌기사, 대검전사→파천검왕, 검성→검신).
#  python -I -B new_gen.py refs                → new/_refs42.png (참고 확인)
#  python -I -B new_gen.py body <cls> [seed]   → new/<cls>-req.json  (호출은 plx.py raw <cls> new /generate-with-style-v2 new/<cls>-req.json)
#  python -I -B new_gen.py sheet <cls>         → work/<cls>/new-*.png 중복 거르기 → new/<cls>-<n>.png + new/_sheet-<cls>.png
import os, sys, io, json, base64, hashlib
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(os.path.dirname(HERE))
NEW = os.path.join(HERE, 'new'); os.makedirs(NEW, exist_ok=True)
S = 42
REFS = ['fighter', 'kickboxer', 'qigong', 'grandmaster']      # src/sprites/<cls>.png idle 첫 칸 (사용자가 좋다고 한 현재 파이터 시트)
PARENT = {'archon': 'paladin', 'tyrant': 'greatswordsman', 'swordsaint': 'blademaster'}
STYLE = ('tiny chibi side-scroller fantasy sprites: big head about one third of the body, short stubby limbs, 1 pixel dark navy outline around the whole figure, '
         'flat colors with 2 to 3 shades per material, simple dot eyes, facing right in side view, feet on the bottom, the weapon is part of the drawing and held firmly in the hand')
DESC = {
    'squire': 'a young squire boy, messy brown hair and no helmet, padded cream gambeson with a brown leather belt, small round wooden buckler on the back arm, '
              'a short plain iron sword held forward in the front hand, brown boots',
    'swordsman': 'a young swordsman knight, open-face steel helmet with a tall blue plume, short blue cape, steel breastplate over a blue tabard, '
                 'a straight steel longsword held forward with both hands in a ready stance, steel greaves',
    'paladin': 'a holy paladin in heavy white and gold full plate armor, closed great helm with a gold cross on the visor, big kite shield with a golden sun emblem '
               'on the back arm, a short golden holy sword raised in the front hand, small white tabard',
    'blademaster': 'a ronin swordmaster, long black hair in a high ponytail, red headband, dark indigo kimono with a red sash, wide hakama pants, sandals, '
                   'a slim curved katana held low and forward in a drawing stance, scabbard at the hip',
    'greatswordsman': 'a bulky greatsword warrior, short spiky red hair and a scarred face, heavy iron pauldrons with a brown fur mantle, leather armor, '
                      'a huge broad iron greatsword as long as his body resting on the shoulder with both hands, heavy boots',
    # 사용자 2026-10-18 "대검전사만 이전느낌으로 가츠 느낌나게": 이전 판(판금·망토·판 모양 대검)의 무게감 + 흑기사 검사
    'greatswordsman_g': 'a grim black swordsman, short spiky black hair, a scar across the nose, dark iron plate armor worn and battered, a long tattered black cape, '
                        'a dark iron prosthetic left arm, an enormous blunt slab of iron as a greatsword, far too big to be a sword, taller than him, '
                        'held on the shoulder with one hand, heavy iron boots',
    'archon': 'the same holy paladin as the reference but now a celestial archon: white and gold plate with star engravings, great helm with a ring of small gold stars above, '
              'small glowing wings of light on the back, a long deep blue cape with constellation dots, a radiant golden longsword held upright, star kite shield, more ornate',
    'tyrant': 'the same greatsword warrior as the reference but now a tyrant king: black iron armor with spiked pauldrons, a jagged dark crown on spiky red hair, '
              'a torn crimson cape, a giant black greatsword with glowing red runes held on the shoulder, more ornate and menacing',
    'swordsaint': 'the same ronin swordmaster as the reference but now a sword saint: long white hair in a high ponytail, a white and gold haori over the dark kimono, '
                  'a golden crescent hair ornament, three small spectral blue swords floating behind the back, a glowing blue katana held low, more ornate',
}


def fit42(im):
    bb = im.getbbox(); c = im.crop(bb)
    if c.width > S or c.height > S: c.thumbnail((S, S), Image.NEAREST)
    o = Image.new('RGBA', (S, S)); o.paste(c, (S // 2 - c.width // 2, S - 1 - c.height), c); return o


def ref(cls):
    if cls in DESC:                                                     # 3차 부모 = 고른 2차 새 디자인
        return fit42(Image.open(os.path.join(NEW, f'pick-{cls}.png')).convert('RGBA'))
    s = Image.open(os.path.join(ROOT, 'src', 'sprites', f'{cls}.png')).convert('RGBA')
    W = json.load(open(os.path.join(ROOT, 'src', 'sprites', f'{cls}.json')))['w']
    return fit42(s.crop((0, 0, W, W)))


def b64(im):
    buf = io.BytesIO(); im.save(buf, 'PNG'); return base64.b64encode(buf.getvalue()).decode()


def body(cls, seed=1):
    names = REFS[:3] + [PARENT[cls]] if cls in PARENT else REFS
    cls0 = cls
    refs = [{'image': {'type': 'base64', 'base64': b64(ref(n))}, 'width': S, 'height': S} for n in names]
    b = {'style_images': refs, 'description': DESC[cls], 'style_description': STYLE, 'seed': seed, 'no_background': True}
    json.dump(b, open(os.path.join(NEW, f'{cls}-req.json'), 'w')); print(cls, 'refs', names, 'desc', len(DESC[cls]))


def sheet(cls):
    d = os.path.join(HERE, 'work', cls); seen = set(); out = []
    for f in sorted(os.listdir(d), key=lambda f: (len(f), f)):
        if not f.startswith('new-'): continue
        im = Image.open(os.path.join(d, f)).convert('RGBA'); h = hashlib.md5(im.tobytes()).hexdigest()
        if h in seen or im.width > 128: continue                       # 응답에 그리드·같은 그림 두 벌
        seen.add(h); out.append(im)
    for i, im in enumerate(out): im.save(os.path.join(NEW, f'{cls}-{i}.png'))
    cols = 8; rows = (len(out) + cols - 1) // cols
    sh = Image.new('RGBA', (cols * (S + 4), rows * (S + 12)), (40, 42, 52, 255))
    from PIL import ImageDraw
    dr = ImageDraw.Draw(sh)
    for i, im in enumerate(out):
        x, y = (i % cols) * (S + 4), (i // cols) * (S + 12); sh.alpha_composite(im.resize((S, S), Image.NEAREST), (x, y)); dr.text((x + 1, y + S), str(i), fill=(200, 200, 210, 255))
    sh.resize((sh.width * 4, sh.height * 4), Image.NEAREST).save(os.path.join(NEW, f'_sheet-{cls}.png')); print(cls, len(out), 'unique')


if __name__ == '__main__':
    a = sys.argv
    if a[1] == 'refs':
        m = Image.new('RGBA', ((S + 4) * 4, S), (40, 42, 52, 255))
        for i, n in enumerate(REFS): m.alpha_composite(ref(n), (i * (S + 4), 0))
        m.resize((m.width * 4, m.height * 4), Image.NEAREST).save(os.path.join(NEW, '_refs42.png')); print('refs ok')
    elif a[1] == 'body': body(a[2], int(a[3]) if len(a) > 3 else 1)
    elif a[1] == 'sheet': sheet(a[2])
