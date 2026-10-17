# 중립 편집이 바꾼 색을 원래 기준 그림 팔레트로 되돌리기 (2026-10-17 로드맵 지시, 스크립트만)
#   edit-image-pixen 중립 대기가 다리 색을 바꿨다 (저격수: 원래 자줏빛 스타킹 (132,89,108) → 진회색 바지).
#   직업별 색 바꿈표(MAP)를 다리 구역(몸 아래쪽 y ≥ LEG_Y)에만 적용한다. 활대 남색 (35,35,45) 은 활과 겹쳐 그대로 둔다.
#   C:\AI\ComfyUI\.venv\Scripts\python.exe -I -B -X utf8 dev/bowsheets/recolor.py <cls> <act> <src판> → post-<act>-rc-<i>.png, strip, GIF
#   C:\AI\ComfyUI\.venv\Scripts\python.exe -I -B -X utf8 dev/bowsheets/recolor.py <cls> ref         → design/ref/<cls>-neutral-rc.png
import os, sys
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
from skelpost import strip, W96
MAP = {
    'marksman': {(55, 54, 54): (132, 89, 108), (65, 65, 63): (132, 89, 108), (48, 47, 45): (112, 72, 90)},
}
LEG_Y = 64          # 96칸 기준 (발 88, 몸 키 46~48 → 코트 끝 아래)


def apply(im, cls, leg_y):
    P = im.load(); m = MAP.get(cls, {})
    for y in range(max(0, leg_y), im.height):
        for x in range(im.width):
            c = P[x, y]
            if c[3] and c[:3] in m: P[x, y] = m[c[:3]] + (255,)
    return im


if __name__ == '__main__':
    cls, act = sys.argv[1], sys.argv[2]
    if act == 'ref':
        im = Image.open(os.path.join(HERE, 'design', 'ref', f'{cls}-neutral.png')).convert('RGBA')
        apply(im, cls, im.height - (88 - LEG_Y) - 1).save(os.path.join(HERE, 'design', 'ref', f'{cls}-neutral-rc.png')); print('ok'); sys.exit()
    src = sys.argv[3]; Wd = os.path.join(HERE, 'work', cls); fr = []; i = 0
    while os.path.exists(os.path.join(Wd, f'post-{act}-{src}-{i}.png')):
        f = apply(Image.open(os.path.join(Wd, f'post-{act}-{src}-{i}.png')).convert('RGBA'), cls, LEG_Y)
        f.save(os.path.join(Wd, f'post-{act}-rc-{i}.png')); fr.append(f); i += 1
    strip(fr).save(os.path.join(Wd, f'strip-{act}-rc.png'))
    big = []
    for f in fr:
        b = Image.new('RGBA', (W96, W96), (20, 22, 30, 255)); b.alpha_composite(f); big.append(b.resize((W96 * 4, W96 * 4), Image.NEAREST).convert('RGB'))
    big[0].save(os.path.join(Wd, f'anim-{act}-rc.gif'), save_all=True, append_images=big[1:], duration=110, loop=0)
    print(len(fr))
