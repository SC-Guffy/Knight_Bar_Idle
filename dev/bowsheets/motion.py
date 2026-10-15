# PixelLab 원형 마네킹 프레임(덧그리기 전)의 몸·팔 움직임 확인 → dev/review/sheets-bow/raw-<원형>-<동작>.png, motion.json
#   몸 = 무기 아닌 칸 (부위색으로 가름). 프레임마다 첫 프레임 대비:
#     body_diff  몸 칸 중 첫 프레임과 다른 칸 비율 (실루엣이 바뀐 정도)
#     glove_dx/dy 손(금색) 가운데가 움직인 도트
#     torso_dx/dy 몸통(빨강) 가운데가 움직인 도트
#   python -I -B dev/bowsheets/motion.py
import os, sys, json
from PIL import Image, ImageDraw
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, HERE)
from dress import classify
OUT = os.path.join(ROOT, 'dev', 'review', 'sheets-bow')
RUNS = [('mq-bow', 'walk', 9), ('mq-bow', 'shoot', 9), ('mq-bow', 'shootUp', 5), ('mq-xbow', 'walk', 9), ('mq-xbow', 'shoot', 5),
        ('mq-xbow', 'shootUp', 5), ('mq-siege', 'walk', 5), ('mq-siege', 'shoot', 9)]


def cen(pts):
    return (sum(p[0] for p in pts) / len(pts), sum(p[1] for p in pts) / len(pts)) if pts else None


def stats(ims):
    base = classify(ims[0]); bb = {p for p, (k, i) in base.items() if k not in ('weapon',)}
    g0 = cen([p for p, (k, i) in base.items() if k == 'glove']); t0 = cen([p for p, (k, i) in base.items() if k == 'torso'])
    out = []
    for im in ims:
        M = classify(im); b = {p for p, (k, i) in M.items() if k not in ('weapon',)}
        g = cen([p for p, (k, i) in M.items() if k == 'glove']); t = cen([p for p, (k, i) in M.items() if k == 'torso'])
        out.append({'body_diff': round(len(b ^ bb) / max(1, len(bb)), 2),
                    'glove': [round(g[0] - g0[0], 1), round(g[1] - g0[1], 1)] if g and g0 else None,
                    'torso': [round(t[0] - t0[0], 1), round(t[1] - t0[1], 1)] if t and t0 else None})
    return out


if __name__ == '__main__':
    res = {}
    for arch, act, n in RUNS:
        ims = [Image.open(os.path.join(HERE, 'work', arch, f'{act}-{i}.png')).convert('RGBA') for i in range(n)]
        st = stats(ims); res[f'{arch}/{act}'] = st
        W = ims[0].width; S = 3; fy = 116 if W == 128 else 86; box = (W // 2 - 40, fy - 60, W // 2 + 40, fy + 6)
        cw, ch = box[2] - box[0], box[3] - box[1]
        o = Image.new('RGBA', (n * cw * S, ch * S + 30), (24, 26, 34, 255)); d = ImageDraw.Draw(o)
        for k, im in enumerate(ims):
            o.alpha_composite(im.crop(box).resize((cw * S, ch * S), Image.NEAREST), (k * cw * S, 0))
            s = st[k]; d.text((k * cw * S + 4, ch * S + 4), f"body {int(s['body_diff'] * 100)}%  hand {s['glove']}", fill=(200, 210, 230))
        o.save(os.path.join(OUT, f'raw-{arch}-{act}.png'))
        mx = max(s['body_diff'] for s in st); gm = max((abs(s['glove'][0]) + abs(s['glove'][1])) for s in st if s['glove']) if any(s['glove'] for s in st) else 0
        print(f'{arch}/{act}: 몸 실루엣 변화 최대 {int(mx * 100)}%, 손 이동 최대 {gm:.1f} 도트')
    json.dump(res, open(os.path.join(OUT, 'motion.json'), 'w'), indent=1)
