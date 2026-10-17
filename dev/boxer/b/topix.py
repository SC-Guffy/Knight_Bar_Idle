# 디자인 대표 → PixelLab image-to-pixelart 정리 (공용 to_pixel·polish·qa_char, 마법사 topix.py 와 같은 흐름. 로드맵 승인: 직업당 1회, 재시도 0)
#  python -I -B dev/boxer/b/topix.py prep [직업 ...]   → pl/req-<cls>.json
#  (호출) MSYS_NO_PATHCONV=1 python -I dev/boxer/b/plx.py raw <cls> ref64 /image-to-pixelart dev/boxer/b/pl/req-<cls>.json  → work/<cls>/ref64-<i>.png
#  python -I -B dev/boxer/b/topix.py post [직업 ...]   → pl/clean-<cls>.png · polish-<cls>.png + 검수 시트 qa/<clean|polish>-<cls>/
import os, sys, json, subprocess
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
sys.path.insert(0, os.path.join(ROOT, 'dev', 'sheets-common'))
PL = os.path.join(HERE, 'pl'); QA = os.path.join(HERE, 'qa')
PICK = {'fighter': 'fighter_v1-23', 'striker': 'striker_v1-23', 'kickboxer': 'kickboxer_v1-51', 'qigong': 'qigong_v1-23',
        'champion': 'champion_v2-101', 'tempest': 'tempest_v2-127', 'grandmaster': 'grandmaster_v1-37'}
COMMON = ('3등신(머리가 키의 약 1/3) 맨손 격투가 한 명의 전신 도트, 오른쪽을 본다(3/4 옆모습 허용), 게임 안 키 약 46칸, 팔을 내린 중립 대기(관절 애니 첫 프레임). '
          '명암이 한 덩어리로 뭉개지지 않고 얼굴(눈)이 보인다. 두 팔·두 다리가 따로 보인다. 바탕·글자·그림자 없음. 무기 없음(맨손).')
INTENT = {
    'fighter': '파이터(1차): 뾰족한 검은 머리 + 뒤로 날리는 긴 빨간 머리띠 꼬리, 흰 민소매, 팔뚝 흰 붕대, 금색 허리띠, 남색 반바지, 빨간 운동화. ',
    'striker': '스트라이커(2차): 근육질 헤비급 복서, 짧은 검은 머리, 검은 민소매, 양손 강철 판 건틀릿(금 리벳), 넓은 금 챔피언 벨트, 흰 줄 빨간 트렁크, 검은 복싱화. 파이터·챔피언과 실루엣이 달라야 한다. ',
    'kickboxer': '킥복서(2차): 날씬한 여성, 아주 높고 긴 갈색 포니테일, 흰 크롭 상의, 빨간 손 붕대, 흰 무에타이 반바지, 흰 정강이 보호대, 맨발. ',
    'qigong': '기공사(2차): 차분한 무도가, 짧은 검은 머리 + 흰 머리띠, 남색 쿵후 상의(짧은 넓은 소매로 팔뚝 보임)·흰 띠, 목에 큰 나무 염주, 헐렁한 남색 바지. ',
    'champion': '챔피언(3차, 스트라이커 다음): 커다란 금빛 사자 갈기 머리, 어깨의 짧은 검붉은 망토(금테), 큰 금 건틀릿, 맨 근육 가슴 + 거대한 금 챔피언 벨트, 금테 검붉은 트렁크. 스트라이커와 실루엣 틀이 달라야 한다(색만 다르면 감점). ',
    'tempest': '템페스트(3차, 킥복서 다음): 끝이 청록인 은백색 높은 쌍갈래 머리, 등 뒤 짧은 청록 바람 망토, 한쪽 강철 견갑, 청록·흰 민소매, 흰 반바지, 청록 테 강철 정강이 보호대, 맨발. 킥복서와 실루엣 틀이 달라야 한다. ',
    'grandmaster': '그랜드마스터(3차, 기공사 다음): 긴 흰 머리와 긴 흰 수염의 노사, 머리 뒤 금빛 후광 고리, 금테 남색 긴 장삼, 어깨에 걸친 큰 흰 염주, 흰 띠. 기공사와 실루엣 틀이 달라야 한다. ',
}


def prep(cls, h=184, seed=7, strength=200):
    import to_pixel as TP
    os.makedirs(PL, exist_ok=True)
    TP.prep(os.path.join(HERE, 'raw', PICK[cls] + '.png'), os.path.join(PL, f'req-{cls}.json'), h, 64, seed, strength, body=True)


def post(classes):
    from to_pixel import strip_ground
    for c in classes:
        src = os.path.join(HERE, 'work', c, 'ref64b-0.png')          # 2라운드 정리본이 있으면 그것 (챔피언·템페스트, 비평 r1 fix)
        if not os.path.exists(src): src = os.path.join(HERE, 'work', c, 'ref64-0.png')
        if not os.path.exists(src): continue
        f = os.path.join(PL, f'clean-{c}.png')
        subprocess.run([sys.executable, '-I', '-B', os.path.join(ROOT, 'dev', 'sheets-common', 'to_pixel.py'), 'clean', src, f, '--ground'], check=True, stdout=subprocess.DEVNULL)
        strip_ground(Image.open(f)).save(f)
        subprocess.run([sys.executable, '-I', '-B', os.path.join(ROOT, 'dev', 'sheets-common', 'polish.py'), f, os.path.join(PL, f'polish-{c}.png')], check=True, stdout=subprocess.DEVNULL)
        for t in ('clean', 'polish'):
            p = os.path.join(PL, f'{t}-{c}.png'); out = os.path.join(QA, f'{t}-{c}')
            subprocess.run([sys.executable, '-I', '-B', os.path.join(ROOT, 'dev', 'sheets-common', 'qa_char.py'), p, '--id', f'{t}-{c}',
                            '--intent', INTENT[c] + COMMON, '--out', out], check=True, stdout=subprocess.DEVNULL)
            m = json.load(open(os.path.join(out, 'metrics.json'), encoding='utf-8'))
            print(c, t, Image.open(p).size, 'gate', m['gate']['pass'], 'flags', [x['k'] for x in m['flags']])


if __name__ == '__main__':
    cl = sys.argv[2:] or list(PICK)
    if sys.argv[1] == 'prep':
        for c in cl: prep(c); print(c, 'req')
    elif sys.argv[1] == 'post': post(cl)
