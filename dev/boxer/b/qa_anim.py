# 동작 검수 준비: src/sprites/<cls>B 시트에서 평타(atkA+atkB 15f)·걷기+앉기 줄을 뽑아 qa.py --kind char 시트 (비평은 critic.md 서브에이전트)
#  C:\AI\ComfyUI\.venv\Scripts\python.exe -I -B dev/boxer/b/qa_anim.py [직업 ...] → dev/boxer/b/qa/anim-<cls>-<atk|walk>/
import os, sys, json
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
sys.path.insert(0, os.path.join(ROOT, 'dev', 'pixel-qa')); sys.path.insert(0, HERE)
import qa
from topix import INTENT
MOVE = {'punch': '평타 = 잽(먼 쪽 앞손, 짧고 어둡게) 7프레임 → 스트레이트(가까운 뒷손, 뒷발 뒤꿈치 들며 몸 숙여 길게) 8프레임. 두 주먹이 다른 손·다른 자세로 읽혀야 한다.',
        'kick': '평타 = 앞차기 7프레임 → 머리 높이 돌려차기 8프레임 (몸을 뒤로 젖힘).',
        'palm': '평타 = 앞굽이 한손 장타 7프레임 → 두 손을 허리로 모았다가 앞으로 미는 두손 장풍 8프레임.'}
KIND = {'fighter': 'punch', 'striker': 'punch', 'kickboxer': 'kick', 'tempest': 'kick', 'qigong': 'palm', 'grandmaster': 'palm'}
COMMON = ' 3등신 맨손 격투가, 칸 96, 게임 안 키 약 46칸, 오른쪽을 봄. 이펙트는 시트에 넣지 않는다(코드 텍스처가 맡음). 동작 중 디자인(머리·옷·색)이 바뀌지 않아야 한다.'


def strip(cls, rows):
    im = Image.open(os.path.join(ROOT, 'src', 'sprites', f'{cls}B.png')).convert('RGBA'); m = json.load(open(os.path.join(ROOT, 'src', 'sprites', f'{cls}B.json')))
    fr = [im.crop((f * 96, m['anims'][a]['row'] * 96, f * 96 + 96, m['anims'][a]['row'] * 96 + 96)) for a, fs in rows for f in fs(m['anims'][a]['frames'])]
    o = Image.new('RGBA', (96 * len(fr), 96))
    for i, f in enumerate(fr): o.alpha_composite(f, (i * 96, 0))
    return o, len(fr)


if __name__ == '__main__':
    for c in sys.argv[1:] or list(KIND):
        for tag, rows, what in (('atk', [('atkA', range), ('atkB', range)], MOVE[KIND[c]]),
                                ('walk', [('walk', range), ('sit', lambda n: [0]), ('idle', lambda n: [0])], '걷기 4프레임(왼발·오른발 앞 번갈아, 들썩임) + 앉기 1장 + 대기 1장. 걷기가 걷는 것으로 읽히고 앉기가 앉은 것으로 읽혀야 한다.')):
            im, n = strip(c, rows); d = os.path.join(HERE, 'qa', f'anim-{c}-{tag}'); os.makedirs(d, exist_ok=True)
            p = os.path.join(d, 'strip.png'); im.save(p)
            res, _ = qa.run(p, f'{c}-{tag}', None, n, False, INTENT[c] + what + COMMON, d, scale=1.0, kind='char')
            print(c, tag, n, res['gate']['pass'], [f['k'] for f in res['flags']])
