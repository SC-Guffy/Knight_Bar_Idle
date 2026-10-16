# 레인저 계열 디자인 후보 검수 0~2단 (docs/specs/pixel-qa.md): 46px 후보마다 dev/pixel-qa/qa.py → dev/bowsheets/qa/<판>-<직업>-<시드>/sheet.png·metrics.json
#  3단 비평은 세션이 서브에이전트(critic.md 지침)에 sheet.png·metrics.json·목표 모습(INTENT)을 넘겨서 한다 → verdict.json
#   C:\AI\ComfyUI\.venv\Scripts\python.exe -I -B -X utf8 dev/bowsheets/qa_run.py <판> [직업 ...]   (-X utf8: qa.py 가 json 을 기본 인코딩으로 쓴다)
import os, sys, json, subprocess
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(os.path.dirname(HERE))
PXD = os.path.join(HERE, 'design', 'px'); QA = os.path.join(HERE, 'qa')
COMMON = ('게임 캐릭터 기준 그림 1장(대기 자세, 오른쪽을 보는 옆모습, 무기는 나중에 원래 무기 그림을 덧그리므로 모양은 참고만). '
          '그림체: 3등신(머리가 키의 약 1/3), 젊은 얼굴, 밝은 색, 깔끔한 도트·또렷한 외곽선 — 같은 게임의 검사·성기사 B 시안과 같은 그림체. '
          '사용자 지적 반영 여부를 본다: ① "궁수는 몸이 왜 이렇게 통짜니" — 허리 벨트로 상·하체가 갈리고, 두 다리가 따로 보이고, 팔이 몸통과 떨어져 보여야 한다 '
          '(흑백 실루엣에서 다리 사이·팔과 몸 사이 틈) ② 뭉개짐(명암 덩어리·흐린 외곽선) 금지 ③ 노인 얼굴·실사 비율 금지.')
INTENT = {
    'ranger': '레인저(1차 궁수, 숲 초록): 넓은 챙의 초록 모자 + 뒤로 꽂힌 큰 흰 깃털, 적갈색 머리, 크림 셔츠·짧은 가죽 조끼, 허리 화살통, 바지·부츠, 짧은 활.',
    'marksman': '저격수(2차 궁수, 황금 노랑 + 짙은 초록): 검은 묶은 머리, 이마의 노란 고글, 짧은 초록 깃 재킷(뒤로 짧은 자락 둘), 가슴 보호대, 붉은 스카프가 뒤로 휘날림, 바지·긴 부츠, 키보다 큰 장궁.',
    'arcaneArcher': '마궁수(2차 마법 궁수, 마력 하늘색 + 남색): 끝이 뒤로 뾰족하게 꺾인 남색 후드, 하늘색 눈빛, 짧은 남색 튜닉(하늘색 룬 장식)·벨트, 바지·부츠, 빛나는 팔 보호대, 짧은 어깨 망토, 떠 있는 룬 조각, 빛나는 시위의 마력궁.',
    'arbalest': '석궁사수(2차, 주황 + 쇠·붉은 전포): 면갑을 올린 각진 투구, 흉갑·붉은 전포, 살 탄띠, 짧은 붉은 망토, 쇠 정강이·부츠, 허리 높이로 수평으로 든 중세 석궁(앞에 가로 활대 — 총 모양 금지).',
}


def load_qa():
    """dev/pixel-qa/qa.py 를 불러 캐릭터용으로: ⓪ 게임 모습 = 시트 그대로 (VFX 로더의 외곽선 벗기기·밝기 5단·직업색 칠하기는 캐릭터에 안 쓴다 —
    그대로 두면 14색 그림이 65색으로 바뀌어 색 경보가 잘못 뜬다). 규격·지표·검수 시트는 qa.py 그대로"""
    import importlib.util
    sp = importlib.util.spec_from_file_location('pixel_qa', os.path.join(ROOT, 'dev', 'pixel-qa', 'qa.py')); qa = importlib.util.module_from_spec(sp); sp.loader.exec_module(qa)
    qa.render = lambda items, tmp=None: {k: im for k, im, o, c in items}
    return qa


def run(ver, classes):
    qa = load_qa(); out = {}
    for c in classes:
        for f in sorted(os.listdir(PXD)):
            if not f.startswith(f'{c}-{ver}-'): continue
            sid = f[:-len('-h46.png')]
            res, _ = qa.run(os.path.join(PXD, f), sid, 'raw', 1, False, c, os.path.join(QA, sid))
            out[sid] = {'flags': [x['k'] for x in res['flags']], 'colors': res['metrics']['colors'], 'lrange': res['metrics']['lrange'], 'crumbs': res['metrics']['crumbs']}
    json.dump({'common': COMMON, 'intent': INTENT}, open(os.path.join(QA, 'intent.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    return out


if __name__ == '__main__':
    ver = sys.argv[1]; cl = sys.argv[2:] or list(INTENT)
    for k, v in run(ver, cl).items(): print(k, json.dumps(v))
