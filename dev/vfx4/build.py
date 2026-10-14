# ⑤-4 원본(raw/) → 게임 시트(src/vfx/<id>.png). 시트마다 쓸 원본과 정리 옵션 (prep.py).
#  python -I build.py [id ...]   (없으면 원본이 다 있는 것 전부)
#  anim: 키 그림 + 애니 4프레임 = raw/<id>-anim-0..4 (0 = 키 그림). key: 키 그림 한 장
import sys, os, subprocess
HERE = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(HERE, 'raw'); OUT = os.path.join(HERE, '..', '..', 'src', 'vfx')
PREP = os.path.join(HERE, 'prep.py')
A = lambda n: [f'{n}-anim-{i}' for i in range(5)]
B = {
  # W (키 그림 한 장)
  'w1a': (['w1a-s7-0'], ['--bg', 'none']),
  'w3': (['w3-s7-0'], ['--bg', 'none']),
  'w3a': (['w3a-s11-0'], ['--bg', 'none']),
  'w4': (['w4-s11-0'], ['--bg', 'none']),
  'w4a': (['w4a-s7-0'], ['--bg', 'none']),
  # H
  'h06': (A('h06'), ['--bg', 'none']),
  'h07': (A('h07'), ['--bg', 'grey']),
  'h08': (A('h08'), ['--bg', 'none']),
  'h18': (A('h18'), ['--bg', 'grey', '--bright']),
  'h19': (A('h19'), ['--bg', 'none']),
  'h20': (A('h20'), ['--bg', 'none']),
  # 심판의 일격
  'e05': (['e05-s7-0'], ['--bg', 'none']),
  'e06': (A('e06'), ['--bg', 'none']),
  'e44': (A('e44'), ['--bg', 'both']),
  'k05': (A('k05'), ['--bright']),
  # 성역
  'e07': (['e07-s7-0'], ['--bright']),
  'e07b': (A('e07b'), ['--bg', 'both']),
  'e08': (['e08-s7-0'], ['--bg', 'none']),
  'k06': (A('k06'), ['--bg', 'dark']),
  # 질풍난무·일섬
  'e09': (A('e09'), ['--bright', '--trimy']),
  'k07': (A('k07'), ['--bg', 'both']),
  'e10': (['e10-s7-0'], ['--bg', 'none']),
  'e11': (A('e11'), ['--bright', '--trimy']),
  'k08': (A('k08'), ['--bright']),
  # 대검전사
  'e12': (A('e12'), ['--bg', 'both']),
  'e13': (['e13-s7-0'], ['--bg', 'none']),
  'k09': (A('k09'), ['--bg', 'both']),
  'e14': (A('e14'), ['--bg', 'both']),
  'k10': (A('k10'), ['--bg', 'both']),
  # 궁극기
  'f01': (['f01-s7-0'], ['--bg', 'none', '--min', '0']),
  'f02': (A('f02'), ['--bg', 'both']),
  # f02s 별 반짝임은 k29 키 그림 가운데 별을 잘라 만든다 (추가 생성 없음, 아래 설명은 스펙 ⑤-4)
  'f03': (A('f03'), ['--bg', 'both']),
  'k29': (A('k29'), ['--bg', 'both']),
  'f04': (A('f04'), ['--bright', '--lum', '150', '--keep', '1', '--trimy']),   # 꽃잎은 늘이면 막대가 되므로 지우고 선만 (꽃잎은 코드 불티가 대신)
  'k30': (A('k30'), ['--bg', 'both']),
  'f05': (['f05-s7-0'], ['--bg', 'none', '--min', '0']),
  'f06': (['f06-s7-0'], ['--bg', 'none']),
  'f07': (A('f07'), ['--bg', 'both']),
  'k31': (A('k31'), ['--bg', 'both']),
  'f22': (A('f22'), ['--bg', 'both']),
}
# 원본 바꿔 쓰기 (다시 뽑은 것 등): 이름 → 원본 접두어
ALT = {}
ids = sys.argv[1:] or list(B)
for i in ids:
    srcs, opts = B[i]
    fs = [os.path.join(RAW, (ALT.get(i, s)) + '.png') for s in srcs]
    if not all(os.path.exists(f) for f in fs):
        if sys.argv[1:]: print(i, 'missing', [os.path.basename(f) for f in fs if not os.path.exists(f)])
        continue
    r = subprocess.run([sys.executable, '-I', PREP, os.path.join(OUT, i + '.png'), *opts, *fs], capture_output=True, text=True)
    print(i, (r.stdout or r.stderr).strip())
