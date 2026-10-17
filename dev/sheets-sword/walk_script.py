# 걷기 다른 방법 (로드맵 승인, PixelLab 0): pixen 걷기는 홀짝 프레임마다 무기·망토·명암이 바뀌어 미달 → 준비 자세 한 장을 원본으로
#  다리 구역(엉덩이 줄 아래)만 스크립트로 움직인다. 몸 중심선(맨 아래 6줄 칠한 칸의 가운데)으로 앞다리·뒷다리를 나눠
#  1 디딤(앞 +2, 뒤 -2, 몸 1칸 내림) · 2 통과(그대로) · 3 교차(앞 -1, 뒤 +1, 몸 1칸 내림) · 4 통과(그대로, 몸 1칸 올림).
#  위쪽(상체·무기·방패)은 모든 프레임 같은 그림이라 디자인이 튀지 않는다.
#  python -I -B walk_script.py [cls ...] → anim/<cls>-walkS-strip.png, anim/<cls>-walkS-x4.gif
import os, sys
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__)); A = os.path.join(HERE, 'anim')
SRC = {'paladin': 'paladin64-src.png', 'squire': 'squire-atk-strip.png', 'archon': 'archon64-src.png',
       'tyrant': 'tyrant64-src.png', 'swordsaint': 'swordsaint-atk-strip.png'}          # 시트의 준비 그림과 같은 것
FOOT_Y = 59


def first(name):
    im = Image.open(os.path.join(A, name)).convert('RGBA'); return im.crop((0, 0, 64, 64))


def legs_frame(im, front, back, body_dy, lift_f=0, lift_b=0):
    P = im.load(); bot = max(y for y in range(64) if any(P[x, y][3] for x in range(64)))
    feet = [x for y in range(bot - 5, bot + 1) for x in range(64) if P[x, y][3]]; cx = round(sum(feet) / len(feet))
    hip = bot - 12                                                             # 다리 구역 = 발에서 위로 12줄
    o = Image.new('RGBA', (64, 64))
    o.alpha_composite(im.crop((0, 0, 64, hip)), (0, body_dy))                    # 상체 (몸 오르내림)
    legs = im.crop((0, hip, 64, bot + 1))
    back_part = legs.crop((0, 0, cx, legs.height)); front_part = legs.crop((cx, 0, 64, legs.height))
    o.alpha_composite(back_part, (back, hip - lift_b)); o.alpha_composite(front_part, (cx + front, hip - lift_f))   # lift: 통과 자세에서 그 다리를 들어 올림
    return o


def walk(cls):
    im = first(SRC[cls])
    return [legs_frame(im, 3, -3, 1), legs_frame(im, 0, 0, -1, lift_b=2), legs_frame(im, -2, 2, 1), legs_frame(im, 0, 0, -1, lift_f=2)]   # 2차: 보폭 ±3, 통과 때 무릎 2칸 들기


if __name__ == '__main__':
    for cls in (sys.argv[1:] or SRC):
        fr = walk(cls)
        st = Image.new('RGBA', (256, 64)); [st.alpha_composite(f, (64 * i, 0)) for i, f in enumerate(fr)]
        st.save(os.path.join(A, f'{cls}-walkS-strip.png'))
        g = []
        for f in fr:
            b = Image.new('RGBA', (64, 64), (38, 40, 50, 255)); b.alpha_composite(f); g.append(b.convert('RGB').resize((256, 256), Image.NEAREST))
        g[0].save(os.path.join(A, f'{cls}-walkS-x4.gif'), save_all=True, append_images=g[1:], duration=125, loop=0)
        print(cls, 'ok')
