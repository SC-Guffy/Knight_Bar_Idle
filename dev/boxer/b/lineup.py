# 전후 라인업: 위 = 지금 시트(키 35), 아래 = 새 그림체(키 46). 같은 배율·같은 땅. 컬러·흑백 실루엣. 챔피언은 새 시트 없음(디자인 미달 → 지금 시트 유지)
#  python -I -B dev/boxer/b/lineup.py → dev/boxer/b/preview/lineup.png · lineup-sil.png
import os, json
from PIL import Image, ImageDraw
HERE = os.path.dirname(os.path.abspath(__file__)); SP = os.path.join(HERE, '..', '..', '..', 'src', 'sprites')
CL = ['fighter', 'striker', 'kickboxer', 'qigong', 'champion', 'tempest', 'grandmaster']


def frame(id, anim='idle', f=0):
    p = os.path.join(SP, id + '.png')
    if not os.path.exists(p): return None, None
    im = Image.open(p).convert('RGBA'); m = json.load(open(os.path.join(SP, id + '.json'))); A = m['anims'][anim]; w = m['w']
    return im.crop((f * w, A['row'] * w, f * w + w, A['row'] * w + w)), m['foot']


def row(ids, anim, sil=False):
    o = Image.new('RGBA', (90 * len(ids), 76), (40, 42, 52, 255))
    for i, id in enumerate(ids):
        fr, ft = frame(id, anim)
        if fr is None: continue
        if sil: fr = Image.composite(Image.new('RGBA', fr.size, (230, 230, 235, 255)), Image.new('RGBA', fr.size), fr.split()[3])
        o.alpha_composite(fr, (i * 90 + 45 - ft[0], 70 - ft[1]))
    return o


if __name__ == '__main__':
    for sil in (False, True):
        rows = [row(CL, 'guard', sil), row([c + 'B' for c in CL], 'guard', sil), row([c + 'B' for c in CL], 'idle', sil)]
        o = Image.new('RGBA', (rows[0].width, 76 * 3 + 0)); 
        for i, r in enumerate(rows): o.alpha_composite(r, (0, i * 76))
        o = o.resize((o.width * 3, o.height * 3), Image.NEAREST); d = ImageDraw.Draw(o)
        for i, t in enumerate(['now (35px)', 'new B guard (46px)', 'new B idle']): d.text((6, i * 228 + 4), t, fill=(255, 220, 90))
        o.save(os.path.join(HERE, 'preview', 'lineup-sil.png' if sil else 'lineup.png'))
    print('ok')
