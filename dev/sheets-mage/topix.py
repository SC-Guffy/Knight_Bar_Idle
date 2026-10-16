# 디자인 대표 → PixelLab image-to-pixelart 정리 (공용 dev/sheets-common/to_pixel.py · polish.py · qa_char.py, 로드맵 승인 2026-10-17: 직업당 1회, 재시도 0, 계열 최대 7)
#  공용 prep 은 그림 전체(지팡이 포함) 높이를 184px 로 맞춘다 → 지팡이를 머리 위로 든 마법사는 몸이 작아진다.
#  여기서는 몸 키(공용 shrink.body_bounds, 지팡이 끝·모자 장식은 빠질 수 있음)를 184px(= 64 출력에서 46칸)로 맞추고, 판(256, 아래 여백 12)을 넘으면 줄인다.
#  python -I -B dev/sheets-mage/topix.py prep  → design/pl/req-<cls>.json (+ -in.png)
#  (호출) MSYS_NO_PATHCONV=1 python -I dev/sheets-mage/plx.py raw <cls> ref64 /image-to-pixelart dev/sheets-mage/design/pl/req-<cls>.json
#  python -I -B dev/sheets-mage/topix.py post  → design/pl/clean-<cls>.png · polish-<cls>.png, 검수 시트 design/qa/pl-<cls>/, pol-<cls>/
import os, sys, json, base64, io
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, os.path.join(ROOT, 'dev', 'sheets-common')); sys.path.insert(0, HERE)
PL = os.path.join(HERE, 'design', 'pl')
PICK = {'mage': 'mage_v2s-139', 'pyromancer': 'pyromancer_v3s-173', 'cryomancer': 'cryomancer_v4t-257', 'electromancer': 'electromancer_v4t-227'}


def prep(cls, h=184, seed=7, strength=200):
    """공용 to_pixel.prep(body=True) — 몸 키를 h 에 맞춘다 (2026-10-17 이 계열에서 만들어 공용으로 옮김)"""
    import to_pixel as TP
    os.makedirs(PL, exist_ok=True)
    TP.prep(os.path.join(HERE, 'design', 'raw', PICK[cls] + '.png'), os.path.join(PL, f'req-{cls}.json'), h, 64, seed, strength, body=True)
    print(cls, 'req', os.path.join(PL, f'req-{cls}.json'))


from to_pixel import strip_ground          # 공용으로 옮김 (dev/sheets-common/to_pixel.py)


INTENT = None


def post():
    """정리본·손질본에서 발밑 판을 지우고 검수 시트(qa_char) — 둘 다 비평에 넣어 높은 쪽을 쓴다 (공용 polish.py 주의 문구)"""
    import subprocess
    import qa_design as QD
    for c in PICK:
        # 순서: 정리본에서 발밑 판을 먼저 지우고 → 그 정리본으로 손질 (손질 뒤에 지우면 판 둘레 외곽선 때문에 안 걸린다)
        f = os.path.join(PL, f'clean-{c}.png'); strip_ground(Image.open(f)).save(f)
        subprocess.run([sys.executable, '-I', '-B', os.path.join(ROOT, 'dev', 'sheets-common', 'polish.py'), f, os.path.join(PL, f'polish-{c}.png')],
                       check=True, stdout=subprocess.DEVNULL)
        for t in ('clean', 'polish'):
            f = os.path.join(PL, f'{t}-{c}.png'); im = Image.open(f).convert('RGBA')
            out = os.path.join(HERE, 'design', 'qa', f'{t}-{c}')
            subprocess.run([sys.executable, '-I', '-B', os.path.join(ROOT, 'dev', 'sheets-common', 'qa_char.py'), f, '--id', f'{t}-{c}',
                            '--intent', QD.INTENT[c] + QD.COMMON, '--out', out], check=True, stdout=subprocess.DEVNULL)
            m = json.load(open(os.path.join(out, 'metrics.json'), encoding='utf-8'))
            print(c, t, im.size, 'gate', m['gate']['pass'], 'flags', [x['k'] for x in m['flags']], 'colors', m['metrics'].get('colors'))


if __name__ == '__main__':
    if sys.argv[1] == 'post': post(); sys.exit(0)
    if sys.argv[1] == 'prep':
        for c in (sys.argv[2:] or PICK): prep(c)
