# 시즌7 트리 14줄기 연출 검토 페이지 만들기: dev/shots 의 T7SHOOT 띠(dev/tree7-shoot.js) → dev/review/t7-fx-all/*.jpg + dev/review/tree7-fx-all.html
#   python dev/tree7-fx-review.py <lines.json> [verdicts.json ...]   (lines.json: 줄기·칸·이름·바탕 — tree7-qa-sheet.py 와 같은 것)
import json, os, sys, html
from PIL import Image
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SH = os.path.join(ROOT, 'dev', 'shots')
OUT = os.path.join(ROOT, 'dev', 'review', 't7-fx-all')
os.makedirs(OUT, exist_ok=True)
lines = json.load(open(sys.argv[1], encoding='utf-8'))
verd = {}
for f in sys.argv[2:]:
    for v in json.load(open(f, encoding='utf-8')): verd[v['file'].replace('.png', '')] = v
SLOT = {'whirl': 'a 갈래 둘째 (주위 연타)', 'flash': 'b 갈래 둘째 (긴 줄 한 방)', 'wave': 'k 갈래 첫째 (투사체)', 'storm': 'k 갈래 둘째 (사방 광역)', 'f_ab': '융합 a+b', 'f_bk': '융합 b+k', 'f_ak': '융합 a+k'}
NAMES = {'swordsaint': '검신', 'tyrant': '파천검왕', 'archon': '성좌기사', 'skyGeneral': '천마장군', 'dragonlord': '용황', 'warlord': '전쟁군주', 'siegeMaster': '공성포수', 'deadeye': '신궁', 'voidArcher': '차원궁사', 'thunderEmperor': '뇌제', 'archmage': '대마도사', 'frostlord': '빙결의 군주', 'champion': '챔피언', 'tempest': '템페스트', 'grandmaster': '그랜드마스터'}

def strip(name, take=(1, 3, 5, 7, 9, 11), w=440, gap=4, scale=0.5):
    im = Image.open(os.path.join(SH, name)).convert('RGB')
    frames = [im.crop((i * (w + gap), 0, i * (w + gap) + w, im.height)) for i in take if (i * (w + gap) + w) <= im.width]
    out = Image.new('RGB', (len(frames) * w, im.height))
    for k, f in enumerate(frames): out.paste(f, (k * w, 0))
    return out.resize((int(out.width * scale), int(out.height * scale)), Image.NEAREST)

cards = []
for L in lines:
    if L['id'] == 'swordsaint': continue
    rows = []
    for slot, (base, name, bname) in L['base'].items():
        key = f"{L['id']}-{slot}"
        for st in (0, 3):
            strip(f't7-{key}-{st}.png').save(os.path.join(OUT, f'{key}-{st}.jpg'), quality=86)
        v = verd.get(key)
        badge = '' if not v else f'<span class="v {v["verdict"]}">{ {"pass": "검수 통과", "fix": "손볼 곳", "regen": "다시"}[v["verdict"]] } {v["mean"]}</span>'
        sim = f'../skills.html?cls={L["cls"][2]}&skill={L["sk"][slot]}&stage=3'
        rows.append(f'''<div class="sk"><h4>{html.escape(name)} <small>{SLOT[slot]} · 바탕 {html.escape(bname)}</small> {badge} <a href="{sim}">▶ ★★★</a> <a href="{sim[:-1]}0">▶ 1칸</a></h4>
<img src="t7-fx-all/{key}-3.jpg" alt=""><img class="s0" src="t7-fx-all/{key}-0.jpg" alt="">{'<p class="how">' + html.escape(v['how']) + '</p>' if v and v['verdict'] != 'pass' and v.get('how') else ''}</div>''')
    cards.append(f'<section id="{L["id"]}"><h2>{NAMES.get(L["id"], L["id"])} <small>{L["id"]}</small></h2>{"".join(rows)}</section>')

nav = ' · '.join(f'<a href="#{L["id"]}">{NAMES.get(L["id"], L["id"])}</a>' for L in lines if L['id'] != 'swordsaint')
page = f'''<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>트리 14줄기 연출</title>
<style>
@font-face {{ font-family: Galmuri11; src: url(../../src/skin/Galmuri11.woff2) format('woff2'); }}
:root {{ --bg:#17141f; --panel:#221e2d; --line:#3a3348; --ink:#ece6f6; --dim:#a59cb8; --gold:#ffd257; color-scheme: dark; }}
* {{ box-sizing: border-box; }} body {{ margin:0; background:var(--bg); color:var(--ink); font:13px/1.6 Galmuri11, sans-serif; }}
main {{ max-width:1400px; margin:0 auto; padding:16px; }} h1 {{ font-size:20px; margin:4px 0; }} h2 {{ font-size:16px; border-bottom:1px solid var(--line); padding-bottom:4px; margin-top:28px; }}
h4 {{ margin:10px 0 4px; font-size:13px; }} small {{ color:var(--dim); font-weight:normal; }} .sub {{ color:var(--dim); }}
.sk img {{ display:block; max-width:100%; image-rendering:pixelated; border-radius:4px; }} .sk img.s0 {{ opacity:.85; margin-top:2px; max-width:66%; }}
.v {{ font-size:11px; padding:1px 6px; border-radius:8px; }} .v.pass {{ background:#2f6a3a; }} .v.fix {{ background:#7a5a20; }} .v.regen {{ background:#7a2a2a; }}
.how {{ color:#ffcf8a; margin:2px 0; font-size:12px; }} a {{ color:#8fd8ff; }} nav {{ position:sticky; top:0; background:var(--bg); padding:6px 0; z-index:1; }}
.card {{ background:var(--panel); border:1px solid var(--line); border-radius:6px; padding:10px; margin:10px 0; }} .card img {{ max-width:100%; image-rendering:pixelated; }}
</style></head><body><main>
<h1>시즌7 스킬 트리 · 14줄기 새 스킬 연출</h1>
<p class="sub">검신 말고 14줄기의 새 스킬 7개씩(98종)을 지금 VFX 시트 재조합으로 만들었다 (유료 생성 0회). 큰 띠 = ★★★(5칸), 작은 띠 = 1칸, 0.44초 간격 6장. ▶ 는 스킬 시뮬레이터로 반복 재생 (처음 30초쯤 불러옴). 검수: 도트 비평(sonnet) 2회 — 배지는 마지막 판정.</p>
<nav>{nav} · <a href="#icons">아이콘</a> · <a href="#aura">상시 장식</a> · <a href="#duel">결투</a></nav>
{"".join(cards)}
<section id="icons"><h2>새 스킬 아이콘 105개 (검성 7 + 14줄기 98, 12×12 도트 → src/skin/icons.png)</h2><div class="card"><img src="t7-fx-all/icons.png" alt=""></div></section>
<section id="aura"><h2>상시 장식: 대마도사 머리 뒤 불꽃 고리 · 뇌제 등 뒤 번개 바퀴</h2><div class="card"><img src="t7-fx-all/aura.png" alt=""><p>시트에서 뺀 소품을 몸 뒤 VFX 로 (src/sprites.js SHEET_BACK_AURA — P7·P12·P11·H29 재배치, 유료 0). 게임·캠프·결투 재생 어디서나 몸보다 먼저 그린다.</p></div></section>
<section id="duel"><h2>결투 (15줄기 리그)</h2><div class="card"><p>줄기별 결투 배율(src/tree7.js T7_DUEL_TUNE)을 "15줄기 × 빌드 a·b·k 리그 승률 50%" + "줄기 안 맞대결 50%" 기준으로 다시 맞춤. 리그 38~59% · 근접 vs 원거리 48% · 줄기 안 맞대결 14~50/60판 (Lv130·170). 서버 배포 불필요 (결투 배율은 클라이언트 프로필 값).</p></div></section>
</main></body></html>'''
open(os.path.join(ROOT, 'dev', 'review', 'tree7-fx-all.html'), 'w', encoding='utf-8').write(page)
print('ok', len(cards))
