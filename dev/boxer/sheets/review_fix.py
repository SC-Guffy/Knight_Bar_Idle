# 모션 수정 검사 자료 (개발용): 바뀐 직업의 동작 GIF·미리보기 다시 만들기 + 원투 GIF·프레임 나열 + 템페스트 전후·킥복서 흑백 비교
#   python -I dev/boxer/sheets/review_fix.py
import os, sys, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import px
from PIL import Image, ImageDraw, ImageOps
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.join(HERE, '..', '..', '..')
OUT = os.path.join(ROOT, 'dev', 'boxer', 'review'); GIF = os.path.join(HERE, 'gif')
BG = (20, 22, 29, 255)

def fr(sh, m, a, f): A = m['anims'][a]; f = min(f, A['frames'] - 1); return sh.crop((f * 64, A['row'] * 64, f * 64 + 64, A['row'] * 64 + 64))

def gif(frames, path, ms, S=4, hold=400):
    ims = []
    for f in frames:
        b = Image.new('RGBA', (64, 64), BG); b.alpha_composite(f); ims.append(b.resize((64 * S, 64 * S), Image.NEAREST).convert('P', palette=Image.ADAPTIVE))
    durs = [ms] * len(ims); durs[-1] = hold
    ims[0].save(path, save_all=True, append_images=ims[1:], duration=durs, loop=0, disposal=1)

def strip(frames, labels, path, S=3):
    o = Image.new('RGBA', (64 * S * len(frames), 64 * S + 16), BG); d = ImageDraw.Draw(o)
    for i, f in enumerate(frames):
        o.alpha_composite(f.resize((64 * S, 64 * S), Image.NEAREST), (i * 64 * S, 16)); d.text((i * 64 * S + 3, 2), labels[i], fill=(255, 220, 120))
    o.convert('RGB').save(path); return o

for c in ['fighter', 'striker', 'champion', 'kickboxer', 'tempest']:
    sh = px.sheet(c); m = px.meta(c)
    for a, A in m['anims'].items():
        gif([fr(sh, m, a, f) for f in range(A['frames'])], os.path.join(GIF, f'{c}-{a}.gif'), int(1000 / (A.get('fps') or 8)), hold=400 if not A.get('loop') else int(1000 / (A.get('fps') or 8)))
    os.system(f'python -I "{os.path.join(HERE, "rows.py")}" "{os.path.join(HERE, c + "-preview.png")}" {c} {",".join(m["anims"].keys())} 3')

# 원투 = 잽(atkA) → 스트레이트(atkB), 스킬과 같은 빠르기 (프레임 70ms)
rows = []
for c in ['fighter', 'striker', 'champion']:
    sh = px.sheet(c); m = px.meta(c)
    seq = [('guard', 0), ('atkA', 0), ('atkA', 1), ('atkA', 2), ('atkB', 1), ('atkB', 2), ('atkB', 3), ('guard', 0)]
    frames = [fr(sh, m, a, f) for a, f in seq]
    gif(frames, os.path.join(OUT, f'onetwo-{c}.gif'), 70, hold=500)
    rows.append(strip(frames, ['guard', 'jab0', 'JAB', 'jab2', 'STRAIGHT', 'str2', 'str3', 'guard'], os.path.join(OUT, f'onetwo-{c}.png')))
    if c != 'fighter':
        sk = [fr(sh, m, 'skillA', f) for f in range(4)]
        gif(sk * 3, os.path.join(OUT, f'rush-{c}.gif'), 70, hold=70)
o = Image.new('RGBA', (rows[0].width, sum(r.height for r in rows)), BG); y = 0
for r in rows: o.alpha_composite(r, (0, y)); y += r.height
o.convert('RGB').save(os.path.join(OUT, 'onetwo-all.png'))

# 템페스트 전후 + 킥복서 (컬러·흑백·실루엣)
before = Image.open(os.path.join(HERE, 'orig', 'tempest.png')).convert('RGBA'); bm = json.load(open(os.path.join(HERE, 'orig', 'tempest.json')))
kb = px.sheet('kickboxer'); km = px.meta('kickboxer'); tp = px.sheet('tempest'); tm = px.meta('tempest')
cols = [('guard', 0), ('walk', 2), ('atkA', 1), ('atkB', 1), ('skillA', 2), ('skillB', 0), ('awaken', 3), ('hurt', 0), ('sit', 0)]
S = 3
def row(sh, m, label):
    r = Image.new('RGBA', (90 + 64 * S * len(cols), 64 * S), BG); ImageDraw.Draw(r).text((4, 4), label, fill=(240, 230, 200))
    for i, (a, f) in enumerate(cols):
        if a in m['anims']: r.alpha_composite(fr(sh, m, a, f).resize((64 * S, 64 * S), Image.NEAREST), (90 + i * 64 * S, 0))
    return r
rs = [row(kb, km, 'kickboxer'), row(before, bm, 'tempest before'), row(tp, tm, 'tempest after')]
o = Image.new('RGBA', (rs[0].width, 20 + sum(r.height for r in rs)), BG); d = ImageDraw.Draw(o)
for i, (a, f) in enumerate(cols): d.text((90 + i * 64 * S + 4, 4), a, fill=(255, 200, 100))
y = 20
for r in rs: o.alpha_composite(r, (0, y)); y += r.height
o.convert('RGB').save(os.path.join(OUT, 'tempest-before-after.png'))
ImageOps.grayscale(o.convert('RGB')).save(os.path.join(OUT, 'tempest-before-after-gray.png'))
sil = o.copy(); P = sil.load()
for yy in range(sil.height):
    for xx in range(sil.width):
        if P[xx, yy] != BG and yy >= 20 and xx >= 90: P[xx, yy] = (235, 235, 235, 255)
sil.convert('RGB').save(os.path.join(OUT, 'tempest-before-after-sil.png'))
print('ok')
