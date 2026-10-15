# 시트 동작별 밀착 몽타주 (검토용): src/sprites/<직업>.png/.json → dev/review/sheets-bow/sheet-<직업>.png
#   줄 = 동작, 칸 = 프레임 (발 기준점 둘레를 잘라 3배). 칸 테두리 대신 발 기준 땅 줄만 긋는다
#   python -I -B dev/bowsheets/montage.py [직업,...]
import os, sys, json
from PIL import Image, ImageDraw
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(os.path.dirname(HERE))
SP = os.path.join(ROOT, 'src', 'sprites'); OUT = os.path.join(ROOT, 'dev', 'review', 'sheets-bow')
IDS = ['ranger', 'marksman', 'arcaneArcher', 'arbalest', 'deadeye', 'voidArcher', 'siegeMaster']


def montage(cls, S=3, L=70):
    m = json.load(open(os.path.join(SP, cls + '.json'), encoding='utf-8')); sh = Image.open(os.path.join(SP, cls + '.png')).convert('RGBA')
    W = m['w']; fx, fy = m['foot']; box = (fx - 30, fy - 62, fx + 46, fy + 6); cw, ch = box[2] - box[0], box[3] - box[1]
    names = list(m['anims']); n = max(a['frames'] for a in m['anims'].values())
    o = Image.new('RGBA', (L + n * cw * S, len(names) * ch * S), (20, 22, 29, 255)); d = ImageDraw.Draw(o)
    for r, a in enumerate(names):
        A = m['anims'][a]
        d.text((4, r * ch * S + 6), a, fill=(255, 220, 90))
        d.text((4, r * ch * S + 20), f"{A['frames']}f" + (f" hit{A['hit']}" if 'hit' in A else ''), fill=(170, 170, 190))
        if 'val' in A: d.text((4, r * ch * S + 34), 'pull ' + ','.join(str(v) for v in A['val']), fill=(140, 200, 255))
        for k in range(A['frames']):
            f = sh.crop((k * W, A['row'] * W, k * W + W, A['row'] * W + W)).crop(box)
            o.alpha_composite(f.resize((cw * S, ch * S), Image.NEAREST), (L + k * cw * S, r * ch * S))
            d.line([(L + k * cw * S, (r + 1) * ch * S - 6 * S), (L + (k + 1) * cw * S - 4, (r + 1) * ch * S - 6 * S)], fill=(50, 54, 70))
    os.makedirs(OUT, exist_ok=True); o.save(os.path.join(OUT, f'sheet-{cls}.png'))
    return o


if __name__ == '__main__':
    for c in (sys.argv[1].split(',') if len(sys.argv) > 1 else IDS):
        if os.path.exists(os.path.join(SP, c + '.json')): print(c, montage(c).size)
