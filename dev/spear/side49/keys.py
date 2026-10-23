# 남은 31회 계획 — 평타 키 자세 (10-18 방식: 합격 키를 원본으로 edit-image-pixen, 키 1장 = usage 1)
#   python3 dev/spear/side49/keys.py edit <cls> <name> <src.png> "<pose>" [seed]  → side49/<cls>/raw-<name>-<i>.png (approved.txt 에 <cls>/<name>)
#   python3 dev/spear/side49/keys.py row <cls> <atkA|atkB> <img,img,...>         → 64칸 키(발 32,60)를 시트 칸으로 (128칸 놓기 → 0.78 BOX 축소 → 시트 팔레트) 해당 줄 교체
import os, sys, json, base64
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(os.path.dirname(os.path.dirname(HERE)))
sys.path.insert(0, HERE); sys.path.insert(0, os.path.join(ROOT, 'dev', 'spear')); import walk
WHO = {'dragonlord': 'young chibi dragon lord knight king with golden hair and a golden dragon crown helmet, visible face, lavender and gold plate armor, big double bat-wing cape, holding the same long purple dragon spear',
       'cavalier': 'young chibi cavalry lancer knight with a red plume helmet, blue surcoat, red kite shield on the far arm, holding the same thick silver conical lance (a cone, not a sword, no crossguard)'}


def edit(cls, name, src, pose, seed=0):
    desc = f'same {WHO[cls]}, same face, same colors and outfit, facing right, side view, {pose}, single weapon, no effects'
    assert len(desc) <= 500, len(desc)
    b = {'image': {'type': 'base64', 'base64': base64.b64encode(open(src, 'rb').read()).decode(), 'format': 'png'}, 'description': desc, 'seed': seed, 'no_background': True}
    walk.call(cls, name, b, '/edit-image-pixen')


def palette_img(im):                       # dev/sheets-common/rescale.py 에서 옮김 — 그 파일은 불러오기만 해도 전체 축소(main)가 돈다 (10-23 사고)
    cols = sorted({c[:3] for c in im.getdata() if c[3] > 0})
    if len(cols) > 256: return im.convert('RGB').quantize(colors=256, dither=0)
    p = Image.new('P', (1, 1)); flat = [v for c in cols for v in c]; p.putpalette(flat + flat[:3] * (256 - len(cols))); return p


def down(cell, wn, hn, pal):
    sm = cell.resize((wn, hn), Image.BOX); a = sm.getchannel('A').point(lambda v: 255 if v >= 90 else 0)
    rgb = sm.convert('RGB').quantize(palette=pal, dither=0).convert('RGB')
    out = Image.new('RGBA', (wn, hn), (0, 0, 0, 0)); out.paste(rgb, (0, 0), a); return out


def to_sheet(cls, im64):
    import build as B
    S0, (fx, fy) = B.CELL[cls]; bb = im64.getbbox()
    c = Image.new('RGBA', (S0, S0)); c.alpha_composite(im64, (fx - 32, fy - (bb[3] - 1)))
    m = walk.meta(cls); S = m['w']; sheet = Image.open(os.path.join(ROOT, 'src', 'sprites', f'{cls}.png')).convert('RGBA')
    return down(c, S, S, palette_img(sheet))


def row(cls, atk, imgs):
    m = walk.meta(cls); S = m['w']; foot = tuple(m['foot'])
    p = os.path.join(ROOT, 'src', 'sprites', f'{cls}.png'); sheet = Image.open(p).convert('RGBA')
    fr = [to_sheet(cls, Image.open(i).convert('RGBA')) for i in imgs]
    A = m['anims'][atk]; assert len(fr) == A['frames'], (len(fr), A['frames'])
    for i, f in enumerate(fr):
        sheet.paste(Image.new('RGBA', (S, S)), (i * S, A['row'] * S)); sheet.alpha_composite(f, (i * S, A['row'] * S))
    sheet.save(p); m['pts'][atk] = [walk.pts_of(f, foot) for f in fr]
    order = sorted(m['anims'], key=lambda a: m['anims'][a]['row'])
    with open(p[:-4] + '.json', 'w', encoding='utf-8') as fo:
        fo.write(f'{{"w": {S}, "h": {S}, "foot": {json.dumps(m["foot"])},\n "anims": {{\n')
        fo.write(',\n'.join(f'  "{a}": {json.dumps(m["anims"][a])}' for a in order))
        fo.write('\n },\n "pts": {\n')
        fo.write(',\n'.join(f'  "{a}": {json.dumps(m["pts"][a])}' for a in order))
        fo.write('\n }\n}\n')
    print('row', cls, atk, len(fr))


if __name__ == '__main__':
    a = sys.argv
    if a[1] == 'edit': edit(a[2], a[3], a[4], a[5], int(a[6]) if len(a) > 6 else 0)
    elif a[1] == 'row': row(a[2], a[3], a[4].split(','))
