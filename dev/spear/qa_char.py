# 캐릭터 정지 그림 검수 (도트 품질 검수 0~2단, docs/specs/pixel-qa.md — 캐릭터 적용): main 의 dev/pixel-qa/qa.py 를 그대로 쓰되
#  ⓪ 게임 모습 단계만 건너뛴다. qa.py 의 render 는 VFX 로더(외곽선 벗기기·5단 양자화)를 돌리는데, 캐릭터 시트는 게임에서 원본 그대로
#  그린다(src/sprites.js drawImage). 1 시트 칸 = 기사 1도트라 --scale 1.
#   python -I -B qa_char.py <그림.png> <id> "<목표 모습 문장>"   → dev/spear/qa/<id>/sheet.png · metrics.json
import os, sys, json
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', 'pixel-qa'))
import qa
qa.render = lambda items, tmp=None: {k: im for k, im, o, c in items}          # 캐릭터: 로더 없음


def check(png, sid, intent):
    from PIL import Image
    out = os.path.join(HERE, 'qa', sid); os.makedirs(out, exist_ok=True)
    im = Image.open(png).convert('RGBA'); pad = Image.new('RGBA', (im.width + 8, im.height + 8)); pad.alpha_composite(im, (4, 4))
    src = os.path.join(out, 'in.png'); pad.save(src)                  # 꼭 맞게 자른 그림은 칸 가장자리 닿음 경고가 나와 4칸 띄운다
    res, _ = qa.run(src, sid, 'raw', 1, False, intent, out, scale=1.0)
    return res


if __name__ == '__main__':
    print(json.dumps(check(sys.argv[1], sys.argv[2], sys.argv[3] if len(sys.argv) > 3 else ''), ensure_ascii=False, indent=1))
