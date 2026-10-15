# 검토 페이지 2-2절의 실루엣 겹침 표를 sil-iou.json 에서 다시 쓴다 (dress.py 다음에 돌린다)
#   python -I dev/bowsheets/page_iou.py
import os, json, re
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(os.path.dirname(HERE))
PAGE = os.path.join(ROOT, 'dev', 'review', 'sheets-bow.html')
R = json.load(open(os.path.join(ROOT, 'dev', 'review', 'sheets-bow', 'sil-iou.json')))
N = {'ranger': '레인저', 'marksman': '저격수', 'arcaneArcher': '마궁수', 'arbalest': '석궁사수', 'deadeye': '신궁', 'voidArcher': '차원궁사', 'siegeMaster': '공성포수'}
IDS = list(N)
LINE = {('marksman', 'deadeye'), ('arcaneArcher', 'voidArcher'), ('arbalest', 'siegeMaster')}   # 같은 계열 2→3차 짝


def tbl(kind):
    h = '<table class="iou"><tr><th></th>' + ''.join(f'<th>{N[i]}</th>' for i in IDS) + '</tr>'
    for a in IDS:
        h += f'<tr><th>{N[a]}</th>'
        for b in IDS:
            if a == b: h += '<td>—</td>'; continue
            v = R[kind].get(f'{a}|{b}', R[kind].get(f'{b}|{a}'))
            cls = 'hi' if v >= 0.9 else 'mid' if v >= 0.85 else ''
            if (a, b) in LINE or (b, a) in LINE: cls += ' pair'
            h += f'<td class="{cls.strip()}">{v:.2f}</td>'
        h += '</tr>'
    return h + '</table>'


blk = ('<!-- iou:begin -->\n<div class="grid3">'
       + f'<div><div class="sub">지금 원본</div>{tbl("orig")}</div>'
       + f'<div><div class="sub">첫 시안 v1 (무기도 마네킹 모양)</div>{tbl("v1")}</div>'
       + f'<div><div class="sub">v2 (무기 덧그리기 + 틀 바꾸기)</div>{tbl("v2")}</div>'
       + '</div>\n<!-- iou:end -->')
s = open(PAGE, encoding='utf-8').read()
s = re.sub(r'<!-- iou:begin -->.*?<!-- iou:end -->', lambda m: blk, s, flags=re.S)
open(PAGE, 'w', encoding='utf-8').write(s)
mx = max(R['v2'].values()); print('v2 max', mx, 'pairs', {f'{a}|{b}': R['v2'].get(f'{a}|{b}', R['v2'].get(f'{b}|{a}')) for a, b in LINE})
