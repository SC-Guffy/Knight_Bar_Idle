# 대검전사 N8-97 46칸 축소본 수리 (스크립트, PixelLab 0): 비평 p4 "자루를 쥔 주먹·코등이가 안 보여 칼이 몸에 박힌 판처럼 읽힘"
#  칼날 아래 끝(가슴 앞)에 칼날과 직각인 어두운 코등이 한 줄, 그 아래 갈색 자루 위에 주먹(장갑 2단 + 외곽선)을 찍는다.
#  python -I -B fix_gs_hand.py → design/pl2/fix-greatswordsman-n8.png, design/_gs97-fix-x8.png
import os
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__)); D = os.path.join(HERE, 'design')
OUT = (11, 13, 20, 255); GUARD = (70, 76, 92, 255); GUARD_L = (130, 138, 156, 255)
GLOVE = (206, 150, 100, 255); GLOVE_L = (232, 186, 140, 255); GLOVE_D = (128, 80, 48, 255)

if __name__ == '__main__':
    im = Image.open(os.path.join(D, 'px', 'greatswordsman-N8-97-h46.png')).convert('RGBA'); P = im.load()
    # 코등이: 칼날 축(오른쪽 아래 45도)에 직각, 칼날 끝 (19,24) 중심
    for i, (x, y) in enumerate([(16, 27), (17, 26), (18, 25), (19, 24), (20, 23), (21, 22), (22, 21)]):
        P[x, y] = GUARD_L if i in (2, 3) else GUARD
        P[x + 1, y] = OUT if not P[x + 1, y][3] or i in (0, 6) else P[x + 1, y]
    # 주먹: 코등이 바로 아래 자루 위, 밝은 장갑 + 손가락 마디 어두운 줄, 바깥쪽(왼쪽·아래)만 외곽선
    for y in range(25, 28):
        for x in range(20, 23):
            P[x, y] = GLOVE_D if x == 22 else GLOVE
    P[21, 25] = GLOVE_L
    for y in range(25, 29): P[19, y] = OUT
    for x in range(19, 24): P[x, 28] = OUT
    # 얼굴 (비평 p4 g3-A·B: 찡그림 약함·볼 주황 얼룩·칼날과 얼굴 밝기 붙음)
    SKIN_D = (200, 152, 118, 255)
    for y in range(12, 21):                                    # 볼·눈 줄의 주황(204,127,74) → 어두운 살색
        for x in range(13, 31):
            if P[x, y][:3] == (204, 127, 74): P[x, y] = SKIN_D
    for x, y in ((25, 11), (26, 11), (27, 12), (28, 12), (29, 12), (30, 12), (26, 12)):   # 굵은 사선 눈썹 (안쪽이 내려감)
        P[x, y] = OUT
    for x in (27, 28, 29): P[x, 13] = (228, 192, 161, 255)    # 눈 줄 정리 → 피부
    P[27, 14] = OUT; P[30, 14] = OUT                           # 눈 두 점
    for x in (27, 28, 29): P[x, 17] = OUT                      # 꽉 다문 입
    P[26, 18] = OUT; P[30, 18] = OUT                           # 입꼬리 내려감
    # 칼날이 얼굴에 닿는 칸 → 어두운 강철 (흑백에서 칼날·얼굴 분리)
    face = lambda c: c[3] and c[0] > 190 and c[1] > 140 and c[2] < 170
    ch = [(x, y) for y in range(10, 22) for x in range(1, im.width - 1) if P[x, y][3] and P[x, y][:3] in ((224, 220, 226), (156, 167, 188), (160, 170, 189)) and face(P[x + 1, y])]
    for q in ch: P[q] = (96, 104, 124, 255)
    im.save(os.path.join(D, 'pl2', 'fix-greatswordsman-n8.png'))
    S = 8; b = Image.new('RGBA', (im.width * 2 * S + 8 * S, im.height * S), (38, 40, 50, 255))
    a = Image.open(os.path.join(D, 'px', 'greatswordsman-N8-97-h46.png')).convert('RGBA')
    b.alpha_composite(a.resize((a.width * S, a.height * S), Image.NEAREST)); b.alpha_composite(im.resize((im.width * S, im.height * S), Image.NEAREST), ((im.width + 8) * S, 0))
    b.save(os.path.join(D, '_gs97-fix-x8.png')); print('ok')
