"""통짜 시트를 파이터 키에 맞춰 줄이기 (2026-10-17 사용자: "크기는 작은 게 좋았다, 다른 애들도 줄이면?").

새 그림체 28종(키 ~46)을 파이터(키 ~37)와 같은 크기로. 칸마다 BOX 축소 → 원래 시트 팔레트로 색 맞춤 → 알파 문턱.
foot·pts 도 같은 비율로. 원본은 dev/sheets-common/full/ 에 보관(되돌리기 = 거기서 복사 후 sheet-meta).
  python -I -B dev/sheets-common/rescale.py [배율=0.78]
  node dev/boxer/sheet-meta.js
주의: 마법사 계열 5종(게임 지팡이)은 그다음 python -I -B dev/sheets-mage/restaff.py 로 지팡이를 1배 원본 도트로 다시 얹는다 (2026-10-18).
"""
import json, os, shutil, sys
from PIL import Image

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
SPR = os.path.join(ROOT, 'src', 'sprites')
FULL = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'full')
FIGHTER = {'fighter', 'striker', 'kickboxer', 'qigong', 'champion', 'tempest', 'grandmaster'}
S = float(sys.argv[1]) if len(sys.argv) > 1 else 0.78
A_MIN = 90  # 칸 덮임이 이보다 작으면 투명 (가는 무기가 사라지지 않게 낮게)


def palette_img(im):
    cols = sorted({c[:3] for c in im.getdata() if c[3] > 0})
    if len(cols) > 256:
        return im.convert('RGB').quantize(colors=256, dither=0)
    p = Image.new('P', (1, 1))
    flat = [v for c in cols for v in c]
    p.putpalette(flat + flat[:3] * (256 - len(cols)))
    return p


def down(cell, wn, hn, pal):
    sm = cell.resize((wn, hn), Image.BOX)
    a = sm.getchannel('A').point(lambda v: 255 if v >= A_MIN else 0)
    # 반투명 가장자리 색이 검게 섞이지 않게: 알파로 미리 곱한 뒤 나눠 되돌림
    pre = Image.new('RGBA', cell.size, (0, 0, 0, 0))
    pre.paste(cell, (0, 0), cell)
    rgb = sm.convert('RGB').quantize(palette=pal, dither=0).convert('RGB')
    out = Image.new('RGBA', (wn, hn), (0, 0, 0, 0))
    out.paste(rgb, (0, 0), a)
    return out


def main():
    os.makedirs(FULL, exist_ok=True)
    done = []
    for f in sorted(os.listdir(SPR)):
        if not f.endswith('.json'):
            continue
        cls = f[:-5]
        if cls in FIGHTER:
            continue
        jp, pp = os.path.join(SPR, f), os.path.join(SPR, cls + '.png')
        # 원본 보관 (이미 있으면 원본에서 다시 만든다 — 두 번 돌려도 같은 결과)
        for src in (jp, pp):
            dst = os.path.join(FULL, os.path.basename(src))
            if not os.path.exists(dst):
                shutil.copy2(src, dst)
        m = json.load(open(os.path.join(FULL, f), encoding='utf-8'))
        im = Image.open(os.path.join(FULL, cls + '.png')).convert('RGBA')
        W, H = m['w'], m['h']
        wn, hn = round(W * S), round(H * S)
        cols, rows = im.width // W, im.height // H
        pal = palette_img(im)
        out = Image.new('RGBA', (cols * wn, rows * hn), (0, 0, 0, 0))
        for r in range(rows):
            for c in range(cols):
                cell = im.crop((c * W, r * H, c * W + W, r * H + H))
                if cell.getbbox():
                    out.alpha_composite(down(cell, wn, hn, pal), (c * wn, r * hn))
        out.save(pp)
        m['w'], m['h'] = wn, hn
        m['foot'] = [round(m['foot'][0] * S), round(m['foot'][1] * S)]
        if 'pts' in m:
            m['pts'] = {k: [[round(v * S) for v in p] for p in fr] for k, fr in m['pts'].items()}
        m.pop('v', None)
        json.dump(m, open(jp, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
        done.append(cls)
    print('scaled', S, len(done), ' '.join(done))


main()
