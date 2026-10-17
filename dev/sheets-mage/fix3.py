# 3차 관절 애니 무료 수리 (2026-10-17 비평 미달분, 로드맵 대안 순서: 스크립트 수리 → 그래도 미달이면 대체)
#  skelgen.py post 다음에 돌린다: python -I -B fix3.py <cls>
#  ① 뒤돈 프레임(얼굴 사라짐) → 같은 동작의 이웃 프레임 또는 같은 자세의 다른 줄 프레임으로 바꾼다
#  ② 걷기(B 7~14) 몸 출렁임: 모델 걷기가 제자리에 가까워 디딤 프레임에 1칸 내리고 지나가는 프레임에 1칸 올린다 (지팡이·끝 점도 같이)
import os, sys, json, shutil
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__))

# (줄, 프레임) ← (줄, 프레임)
REPLACE = {
    'frostlord': {('B', 1): ('B', 0), ('A', 9): ('A', 8)},
    'thunderEmperor': {('A', 9): ('A', 8), ('B', 2): ('B', 1), ('B', 3): ('A', 8), ('B', 4): ('A', 8)},
    'archmage': {},
}
BOB = [1, 0, -1, 0, 1, 0, -1, 0]          # 걷기 8프레임 세로 이동 (아래 +)


def shift(im, dy):
    o = Image.new('RGBA', im.size); o.paste(im, (0, dy)); return o


def fix(cls):
    d = os.path.join(HERE, 'skel', cls)
    fr = {p: [Image.open(os.path.join(d, f'{p}-wpn', f'{i}.png')).convert('RGBA') for i in range(15)] for p in 'AB'}
    tp = {p: json.load(open(os.path.join(d, f'{p}-tips.json'))) for p in 'AB'}
    src = {k: (fr[v[0]][v[1]].copy(), list(tp[v[0]][v[1]])) for k, v in REPLACE.get(cls, {}).items()}
    for (p, i), (im, t) in src.items(): fr[p][i] = im; tp[p][i] = t
    for k, dy in enumerate(BOB):
        i = 7 + k; fr['B'][i] = shift(fr['B'][i], dy); tp['B'][i] = [tp['B'][i][0], tp['B'][i][1] + dy]
    for p in 'AB':
        for i, im in enumerate(fr[p]): im.save(os.path.join(d, f'{p}-wpn', f'{i}.png'))
        json.dump(tp[p], open(os.path.join(d, f'{p}-tips.json'), 'w'))
    print('fix3', cls, 'replace', sorted(REPLACE.get(cls, {})), 'bob', BOB)


if __name__ == '__main__':
    for c in sys.argv[1:]: fix(c)
