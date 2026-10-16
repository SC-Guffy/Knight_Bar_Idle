# 캐릭터 기준 그림 검수 (docs/specs/pixel-qa.md 를 캐릭터에 — 1단계는 VFX 용이라 게임 로더(외곽선 벗기기·5단)를 거치지만,
#  캐릭터 시트는 게임이 원래 색 그대로 그리므로 로더를 건너뛰고 그림 자체를 "게임 모습"으로 쓴다. 규격·지표·검수 시트는 qa.py 그대로)
#  python -I -B dev/sheets-sword/qa_char.py <그림.png> --id <이름> --intent "목표 모습" [--out 폴더]
#   → <out>/sheet.png (비평용 — 1배·4배·흑백·견습 기사 옆 장면), metrics.json. 비평은 pixel-critic 지침(dev/pixel-qa/critic.md)으로 서브에이전트가.
import os, sys, json, argparse
import numpy as np
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, os.path.join(ROOT, 'dev', 'pixel-qa'))
import qa as Q

# 캐릭터 경보 (VFX 기준값을 그대로 쓰지 않는다: 캐릭터는 외곽선·여러 재질이라 색이 더 많다. 확정 판정이 쌓이면 다시 잡는다)
FLAGS_CHAR = {
    'crumbs': (lambda g: g['crumbs'] > 6, '부스러기 덩어리가 많다 (> 6)'),
    'lrange': (lambda g: g['lrange'] < 0.3, '밝기 폭이 좁아 한 덩어리로 뭉개진다 (< 0.3)'),
    'colors': (lambda g: g['colors'] > 32, '색이 너무 많다 — AI 흐림 계조 (> 32)'),
    'lone': (lambda g: g['lone'] > 0.18, '외톨이 픽셀이 많다 — 뭉개짐·지글거림 (> 18%)'),
}


def run(png, sid, intent='', out=None):
    im = Image.open(png).convert('RGBA'); bb = im.getbbox(); im = im.crop(bb)
    pad = Image.new('RGBA', (im.width + 8, im.height + 8)); pad.alpha_composite(im, (4, 4))          # 바짝 자른 그림이 칸 가장자리 경고를 내지 않게 4칸 여백
    raw = np.asarray(pad).copy()
    a = raw[..., 3]; raw[..., 3] = np.where(a >= 128, 255, 0)          # 캐릭터는 알파 0/255
    game = raw
    fail, warn, _ = Q.gates(raw, game, 1)
    m = Q.metrics(game, 1) or {}
    m.pop('_n', None)
    flags = [{'k': k, 'why': why} for k, (f, why) in FLAGS_CHAR.items() if m and f(m)]
    res = dict(id=sid, file=os.path.relpath(os.path.abspath(png), ROOT), frames=1, color='raw', size=list(raw.shape[1::-1]), scale=1.0, intent=intent,
               kind='character', gate={'pass': not fail, 'fail': fail, 'warn': warn}, metrics=m, flags=flags)
    if out:
        os.makedirs(out, exist_ok=True)
        Image.fromarray(game).save(os.path.join(out, 'game.png'))
        Q.qa_sheet(game, 1, scale=1.0).save(os.path.join(out, 'sheet.png'))
        json.dump(res, open(os.path.join(out, 'metrics.json'), 'w'), ensure_ascii=False, indent=1)
    return res


if __name__ == '__main__':
    ap = argparse.ArgumentParser(); ap.add_argument('png'); ap.add_argument('--id', required=True); ap.add_argument('--intent', default=''); ap.add_argument('--out')
    a = ap.parse_args()
    r = run(a.png, a.id, a.intent, a.out or os.path.join(HERE, 'qa', a.id))
    print(json.dumps({k: r[k] for k in ('id', 'gate', 'metrics', 'flags')}, ensure_ascii=False))
