# 캐릭터 정지 그림 검수 (도트 품질 검수 0~2단, docs/specs/pixel-qa.md — 캐릭터 적용): main 의 dev/pixel-qa/qa.py 를 그대로 쓰되
#  kind='char'(2026-10-17 main 에 들어옴 — 로더 단계를 건너뛴다). 이 감싸개는 꼭 맞게 자른 그림에 여백 4칸을 두는 일만 한다. 1 시트 칸 = 기사 1도트라 --scale 1.
#   python -I -B qa_char.py <그림.png> <id> "<목표 모습 문장>"   → dev/spear/qa/<id>/sheet.png · metrics.json
import os, sys, json
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', 'pixel-qa'))
import qa


def check(png, sid, intent):
    from PIL import Image
    out = os.path.join(HERE, 'qa', sid); os.makedirs(out, exist_ok=True)
    im = Image.open(png).convert('RGBA'); pad = Image.new('RGBA', (im.width + 8, im.height + 8)); pad.alpha_composite(im, (4, 4))
    src = os.path.join(out, 'in.png'); pad.save(src)                  # 꼭 맞게 자른 그림은 칸 가장자리 닿음 경고가 나와 4칸 띄운다
    res, _ = qa.run(src, sid, 'raw', 1, False, intent, out, scale=1.0, kind='char')     # 공식 캐릭터 모드 (로더 안 거침)
    return res


if __name__ == '__main__':
    print(json.dumps(check(sys.argv[1], sys.argv[2], sys.argv[3] if len(sys.argv) > 3 else ''), ensure_ascii=False, indent=1))
