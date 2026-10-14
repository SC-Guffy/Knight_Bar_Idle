# 함수 몸통 통째로 바꾸기: python -I repfn.py <js 파일> <새 코드 파일>
#  새 코드 파일 = 'function 이름(' 으로 시작하는 블록들 (빈 줄 두 개로 나눔). 같은 이름의 원래 함수(끝 = 줄 첫머리 '}')를 바꾼다
import sys, re
p, q = sys.argv[1], sys.argv[2]
s = open(p, encoding='utf-8').read()
for blk in open(q, encoding='utf-8').read().split('\n\n\n'):
    blk = blk.strip('\n')
    if not blk: continue
    m = re.search(r'^function (\w+)\(', blk, re.M)
    name = m.group(1)
    i = s.index('\nfunction ' + name + '(') + 1
    k = s.index('\n}\n', i) + 3
    s = s[:i] + blk + '\n' + s[k:]
    print('replaced', name)
open(p, 'w', encoding='utf-8').write(s)
