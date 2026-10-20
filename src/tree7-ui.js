'use strict';
// 시즌7 스킬 탭 — 숙련 (docs/specs/skill-mastery-s7.md, 스킬 재기획 1단계). 트리 판은 없앴다.
// 캐릭터 → 스킬 서브탭이 이 화면이 된다 (ui.js viewSkill 첫 줄).
//  위: 장착 칸(1~4 + 궁극기, 칸 열기 — 순서 = 시전 순서) · 📖 남은 비전서
//  아래: 스킬 카드 줄 (가진 스킬 = 숙련 Lv 눈금 · ★ · 장착 · 📖 바치기 · ▶ 비주얼 확인 · 모습 고르기 / 아직 없는 스킬 = 여는 조건)
// 아이콘은 src/tree7-art.js 가 canvas 에 도트로 그린다 (CSP 가 data: 이미지를 막는다) — renderCamp 뒤 paintTree7 이 칠한다.

// id → { n 이름, d 설명, cost 키스톤 대가, looks 옛 칸마다 모습 이름(0·1·3·4 번째가 기본·★·★★·★★★), ic 아이콘(없으면 id 로 tree7-art 그림), new 새 스킬 }
const T7_UI = {
  slash: {"n":"강철 베기","d":"1차 스킬 (검사 계열 공용 줄기). 앞을 크게 내려벤다.","looks":["강철 베기","강철 검풍","강철 검풍 (범위 +20%)","강철 대검","천강검"],"ic":"sk-steelCleave","a":"지금 그림 (★ 진화 모습 그대로)"},
  s_twin: {"n":"2연참","d":"강철 베기가 한 번 더 반대로 벤다 (두 번째 타 60%)","a":"같은 궤적 좌우 반전"},
  k_blade: {"n":"검의 길","d":"평타 3타마다 칼날이 번쩍이며 모든 스킬 쿨 −0.5초.","cost":"스킬 피해 −10%"},
  gale: {"n":"질풍난무","d":"적 사이를 지그재그로 오가며 벤다 (지금 검성 스킬).","looks":["삼연참","질풍난무","질풍난무 (타격 이펙트 커짐)","질풍난무·분신","월하난무"],"ic":"sk-gale","a":"지금 그림"},
  a_more: {"n":"난무 +3타","d":"타수 +3 (타당 피해 −15%) — 보호막에 강함","a":"같은 궤적 반복"},
  a_bleed: {"n":"출혈","d":"베인 적이 3초간 피를 흘린다 (붉은 점멸 + 지속 피해 40%)","a":"맞은 적 붉은 램프 점멸"},
  whirl: {"n":"검무 회오리","d":"새 스킬. 칼날 회오리가 4초간 기사 주위를 돌며 벤다.","looks":["검무","쌍 회오리","쌍 회오리 (크기 +20%)","칼날 회오리","천검무"],"a":"화염 회오리 시트(E35)를 은색 램프로","new":1,"ref":["pyromancer","flameVortex"]},
  a_follow: {"n":"쫓는 칼날","d":"회오리가 가장 가까운 적에게 날아가 붙는다 — 졸개·먼 적","a":"같은 시트, 이동 궤적만"},
  a_grow: {"n":"제자리 폭풍","d":"회오리가 움직이지 않고 그 자리에서 2배로 커진다 — 붙어 있는 보스","a":"같은 시트 ×2 크기"},
  a_key: {"n":"광란","d":"스킬이 맞힐 때마다 공속 +4% (최대 +40%), 몸에 붉은 기운이 짙어진다. 3초 안 맞히면 초기화.","cost":"평타 피해 −15%"},
  a_k3: {"n":"무한검","d":"3차. 질풍난무가 끝나면 30% 확률로 한 번 더 (분신이 이어 받는다).","cost":"질풍난무 쿨 +25%"},
  uv_a: {"n":"천검: 만검","d":"궁극기 변형 (셋 중 하나). 천검이 작은 칼날 수십 개로 쏟아진다 — 보호막에 강함","a":"천검 그림 작게 × 반복"},
  iaido: {"n":"일섬","d":"한 줄기 섬광으로 지나가며 벤다, 반드시 치명 (지금 검성 스킬).","looks":["발도","일섬","일섬 (검선 길어짐)","일섬·납도","적월일섬"],"ic":"sk-iaido","a":"지금 그림"},
  b_reset: {"n":"잔영","d":"일섬으로 처치하면 잔상이 되돌아와 가장 가까운 적을 한 번 더 벤다 (50%)","a":"기사 잔상 (반투명) + 같은 궤적"},
  b_exec: {"n":"처형","d":"체력 25% 이하 적은 일섬에 두 동강 (붉은 섬광, 보스는 피해 +100%)","a":"명중 섬광 붉은 램프"},
  flash: {"n":"섬광 베기","d":"새 스킬. 잠깐 멈췄다가 화면 끝까지 한 줄로 베어 지나간다.","looks":["섬광","섬광 베기","섬광 베기 (화면 멈춤 길어짐)","뇌광","천섬"],"a":"일섬 궤적을 길게 + 화면 정지","new":1,"ref":["blademaster","iaido"]},
  b_after: {"n":"잔상 베기","d":"0.5초 뒤 잔상이 같은 줄을 한 번 더 벤다 (50%) — 한 줄 강하게","a":"같은 궤적 반투명"},
  b_triple: {"n":"삼중 섬광","d":"한 줄 대신 위·가운데·아래 세 줄 (줄마다 45%) — 넓게","a":"같은 궤적 ×3"},
  b_key: {"n":"발도술","d":"일섬·섬광 베기 치명 피해 +50%, 칼을 거둘 때 금빛 섬광.","cost":"두 스킬 쿨 +30%"},
  b_k3: {"n":"무념","d":"3차. 모든 피해 +160%, 화면이 흑백으로 가라앉았다가 벤다.","cost":"치명 확률 0 (확정 치명 스킬도 일반타)"},
  uv_b: {"n":"천검: 일도양단","d":"궁극기 변형 (셋 중 하나). 하나의 거대한 칼이 화면을 가른다 — 광폭화에 강함","a":"천검 그림 ×2 크기, 한 번만"},
  wave: {"n":"비검","d":"새 스킬. 초승달 검기를 부채꼴로 날린다.","looks":["비검","삼연 비검","삼연 비검 (사거리 +20%)","오연 비검","비검 난무"],"a":"E43 참격을 투사체로","new":1,"ref":["swordsman","steelCleave",1]},
  k_wave: {"n":"참격파","d":"강철 베기 끝에도 검기가 한 발 날아간다","a":"E43"},
  k_pierce: {"n":"관통","d":"검기가 적을 뚫고 지나간다 (뚫을 때마다 −20%)","a":"같은 시트, 충돌만 바뀜"},
  storm: {"n":"검기 폭풍","d":"새 스킬. 사방으로 검기를 뿜는다.","looks":["검기 방사","팔방 검기","팔방 검기 (크기 +20%)","검기 폭풍","검기 대폭풍"],"a":"E43 방사형","new":1,"ref":["swordsman","steelCleave",2]},
  k_split: {"n":"분열","d":"검기가 처음 맞힌 적에서 두 갈래로 갈라진다 — 졸개 무리","a":"같은 시트 작게 ×2"},
  k_homing: {"n":"유도 검기","d":"검기가 휘어 날아가 가장 강한 적(보스)에 꽂힌다 — 보스 집중","a":"같은 시트, 휘는 궤적"},
  k_key: {"n":"심검","d":"평타가 푸른 검기로 바뀐다 (사거리 3배).","cost":"평타 피해 −20%"},
  k_k3: {"n":"만검귀종","d":"3차. 검기 스킬이 맞힐 때마다 다른 검기 스킬 쿨 −0.3초, 칼날이 기사 주위로 모여든다.","cost":"검기가 아닌 스킬 피해 −20%"},
  uv_k: {"n":"천검: 검우","d":"궁극기 변형 (셋 중 하나). 먹구름에서 검기가 비처럼 넓게 — 졸개에 강함","a":"천검 그림 + E43 낙하"},
  ult: {"n":"천검","d":"검신 궁극기 (궁극기 칸). 갈래 변형 셋 중 하나를 붙일 수 있다.","looks":["천검","천검·만화","천검·만화 (검선 늘어남)","천검·벚꽃폭풍","무명검·천지개벽"],"ic":"sk-thousandCuts","a":"지금 궁극기 그림"},
  f_ab: {"n":"질풍 일섬","d":"융합. 난무 마지막 타가 일섬으로 돌진한다.","a":"두 스킬 그림 이어 붙이기"},
  f_bk: {"n":"섬광 검기","d":"융합. 일섬이 지나간 줄에 검기가 남아 터진다.","a":"일섬 궤적 + E43"},
  f_ak: {"n":"칼날 폭풍","d":"융합. 회오리가 돌며 검기를 흩뿌린다.","a":"회오리 + E43 방사"},
};

const T7_LANE = { a: { name: '⚡ 연타 갈래', sub: '🛡️ 보호막에 강함' }, b: { name: '🗡️ 발도 갈래', sub: '🔥 광폭화에 강함' }, k: { name: '🌙 검기 갈래', sub: '👥 졸개에 강함' } };
// 줄기별 글: 기본(T7_UI = 검성 글) ← 1차 줄기 글(T7_STEMS) ← 줄기 글(T7_LINES[].ui) (src/tree7-l-*.js)
const t7U = (id) => { const L = t7L(), st = L && T7_STEMS[L.cls[0]]; return { ...T7_UI[id], ...(st && st.ui[id]), ...(L && L.ui[id]) }; };
const t7Lane = () => { const L = t7L(), o = {}; for (const l of ['a', 'b', 'k']) o[l] = { ...T7_LANE[l], ...(L && L.lanes && L.lanes[l]) }; return o; };
const T7_LOOK_IDX = [0, 1, 3, 4];
function t7LookName(n, st) {
  const u = t7U(n.id), k = SKILLS[n.sk];
  if (n.t !== 'fusion' && u.looks && u.looks[T7_LOOK_IDX[st]]) return u.looks[T7_LOOK_IDX[st]].split(' (')[0];
  return (k && k.stageName && k.stageName[st]) || u.n;
}
const t7LookDesc = (n, st) => { const k = SKILLS[n.sk]; return k && !k.t7 && k.stageDesc ? k.stageDesc[st] : ''; };
const t7Icon = (id) => t7U(id).ic || id;
const t7Canvas = (attr, id, cls = '') => `<canvas class="t7c ${cls}" data-${attr}="${id}"></canvas>`;
// 지금 쓰는 모습 이름 (가진 스킬) · 아니면 스킬 이름
const t7Look = (n) => (n.slot && n.sk && t7Rank(n.id) > 0 ? t7LookName(n, t7Stage(n.sk)) : t7U(n.id).n);
const t7Ui = { sel: null, pick: null };   // pick: 룬을 끼우려고 고른 스킬
// 레드닷: 장착 칸을 열 수 있을 때 · 빈 장착 칸에 넣을 가진 스킬이 있을 때
const t7Dot = () => t7On() && (!t7SlotNeed() || (t7S().eq.length < t7Slots() && SKM_SLOTS.some((x) => x !== 'ult' && skmOwnedSlot(x) && !t7S().eq.includes(t7L().sk[x]))));
const T7_STARS = (n) => (n ? '★'.repeat(n) : '');

function viewTree7() {
  const s = t7S(), T = t7Tier(), L = t7L();
  const head = `<div class="mhead"><div><h3>${ico('glow')} 스킬</h3>
      <small>장착해서 데려간 스킬이 쓸수록 자라요 · 숙련 Lv 10·20·30 에 모습이 바뀌어요 · 📖 비전서로 끌어올릴 수 있어요 (Lv20 까지)</small></div>
    <span class="mchip${S.tomes ? '' : ' none'}" title="📖 비전서 — 스킬 숙련에 바쳐요 (1권 = 경험치 ${SKM_TOME})">📖 <b>${fmt(S.tomes || 0)}</b></span></div>`;
  // 장착 칸 (순서 = 시전 순서) + 궁극기 칸
  const slots = [];
  for (let i = 0; i < 4; i++) {
    const sk = s.eq[i], n = sk && t7NodeOf(sk);
    if (i >= t7Slots()) {
      const next = i === t7Slots(), need = next ? t7SlotNeed() : null, c = next ? t7SlotCost() : {}, r = T7_SLOTS[i + 1];
      const cost = c.gold ? `<i class="gc"></i> ${fmt(c.gold)}` : c.mana ? `${ico('mana')} ${fmt(c.mana)}` : '';
      const cond = r.tier ? '2차 전직' : `Lv ${r.lv}`;
      slots.push(next && !need
        ? `<button class="t7slot buy${rd(true)}" data-action="t7-slot">🔓 칸 열기 <small>${cost}</small></button>`
        : `<div class="t7slot lock">🔒 ${cond}${next && need ? ` <small>${need}</small>` : ''}${next && cost ? ` <small>${cost}</small>` : ''}</div>`);
    } else slots.push(n ? `<button class="t7slot full" data-action="t7-eq" data-sk="${sk}" title="누르면 빼요 (장착 순서 = 시전 순서)">${t7Canvas('t7icon', t7Icon(n.id))}<span>${t7Look(n)}</span><small>Lv${t7Rank(n.id)}</small></button>`
      : '<div class="t7slot">빈 칸 <small>아래 스킬의 장착</small></div>');
  }
  const ult = T >= 3 && L && L.sk.ult;
  slots.push(ult ? `<div class="t7slot ult full">${t7Canvas('t7icon', t7Icon('ult'))}<span>${t7Look(T7_BY.ult)}</span><small>Lv${t7Rank('ult')}</small></div>` : '<div class="t7slot lock">★ 궁극기 칸 (3차)</div>');
  const moved = s.moved === 'skm' ? '<div class="gtip big">🔄 스킬 트리가 숙련으로 바뀌었어요 — 찍어 둔 스킬 칸·모습만큼 숙련 Lv 으로 옮겼어요. 스탯은 전직하면 자동으로 붙어요. 이제 장착한 스킬이 원정에서 쓸수록 자라요.</div>' : '';
  // 스킬 카드
  const cards = SKM_SLOTS.filter((slot) => L && L.sk[slot] && (slot !== 'ult' || T >= 2)).map((slot) => {
    const n = T7_BY[slot], sk = L.sk[slot], u = t7U(slot), own = skmOwnedSlot(slot);
    if (!own) return `<div class="t7card skl lock" data-t7tip="${slot}">${t7Canvas('t7icon', t7Icon(slot))}<div><b>${u.n}</b><small>🔒 ${skmLockText(slot)}</small></div></div>`;
    const lv = skmLv(sk), st = skmStage(sk), use = t7Stage(sk), p = skmProg(sk), eq = s.eq.includes(sk), isUlt = slot === 'ult';
    const nextStar = lv < 30 ? `다음 ★ Lv${(Math.floor(lv / 10) + 1) * 10}` : '숙련 끝';
    const feedMax = skmFeedMax(sk), feed = Math.min(feedMax, S.tomes || 0);
    // 모습 고르기: 기본 · ★ · ★★ · ★★★ 칸을 바로 누른다 (연 단계까지, 위력·쿨은 그대로)
    const stageCtl = st ? `<div class="t7look" title="전투에 쓸 모습 — 연 단계 안에서 고르고, 위력·쿨은 그대로">${[0, 1, 2, 3].map((i) => i > st
      ? `<span class="lk lock" title="숙련 Lv${i * 10} 에 열려요">${i ? '★'.repeat(i) : '기본'}</span>`
      : `<button class="lk${i === use ? ' on' : ''}" data-action="t7-use" data-sk="${sk}" data-s="${i}" title="${t7LookName(n, i)}">${i ? '★'.repeat(i) : '기본'}</button>`).join('')}</div>` : '';
    return `<div class="t7card skl${eq || isUlt ? ' eq' : ''}${t7Ui.sel === slot ? ' sel' : ''}" data-t7tip="${slot}">
      ${t7Canvas('t7icon', t7Icon(slot))}
      <div class="t7cbody"><b>${t7Look(n)} <span class="t7st">${T7_STARS(st)}</span></b>
        <small>${u.n !== t7Look(n) ? u.n + ' · ' : ''}숙련 Lv ${lv}/30 · 위력 ×${(1 + SKM_POW * (lv - 1)).toFixed(2)} · 쿨 ×${(1 - SKM_CD * (lv - 1)).toFixed(2)}</small>
        ${runeSockHtml(sk)}
        <div class="t7xp"><i style="width:${Math.round(p * 100)}%"></i></div><small>${lv < 30 ? `다음 Lv ${Math.round(p * 100)}% · ${nextStar}` : '숙련 끝 (★★★)'}</small>
        <div class="t7act">
          ${isUlt ? '<small class="t7note">궁극기 칸 — 늘 장착</small>' : `<button class="btn${eq ? ' on' : ''}" data-action="t7-eq" data-sk="${sk}">${eq ? '✓ 장착' : '장착'}</button>`}
          <button class="btn" data-action="t7-feed" data-sk="${sk}" data-n="10" ${feed > 0 ? '' : 'disabled'} title="${feedMax ? `비전서 10권까지 (1권 = 경험치 ${SKM_TOME}, Lv20 까지)` : 'Lv20 부터는 써야 자라요'}">📖 바치기</button>
          <button class="btn mprev" data-action="preview" data-id="${sk}" ${S.phase === 'camp' ? '' : 'disabled'} title="아래 기사가 지금 모습으로 한 번 시전해요">▶</button>
        </div>${stageCtl}</div></div>`;
  }).join('');
  const tier1 = T < 2 ? '<div class="gtip">2차 전직하면 2차 스킬 둘이 생기고, 스킬을 ★ 까지 키우면 새 스킬이 열려요.</div>' : '';
  return `${head}${moved}${tier1}<div class="t7slots">${slots.join('')}</div><div class="t7cards skl">${cards}</div>${runeBagHtml()}`;
}
// 🔮 룬 칸 (스킬 카드 안): 숙련 ★ 1칸 · ★★★ 2칸. 빈 칸을 누르면 아래 주머니에서 고른다, 끼운 룬을 누르면 뺀다 (src/rune.js)
const runeChip = (r, extra = '') => `${runeArt(r)}<span style="color:${GRADES[r.g].color}">${runeName(r)}</span>${extra}`;
function runeSockHtml(sk) {
  const cap = runeCap(sk), on = runesOf(sk);
  return `<div class="rsocks">${[0, 1].map((j) => {
    if (j >= cap) return `<span class="rsock lock">${j === 0 ? '◇ ★ 에 열림' : '◇ ★★★ 에 열림'}</span>`;
    const r = on[j];
    return r ? `<button class="rsock full" data-action="t7-unsock" data-sk="${sk}" data-j="${j}" title="${esc(runeText(r))} — 누르면 빼요">${runeChip(r)}</button>`
      : `<button class="rsock${t7Ui.pick === sk ? ' pick' : ''}" data-action="t7-pick" data-sk="${sk}" title="누르고 아래 룬 주머니에서 골라요">◇ 빈 칸</button>`;
  }).join('')}</div>`;
}
// 🔮 룬 주머니: 등급 높은 것부터 · 고른 스킬에 못 끼우는 룬은 흐리게 · 같은 룬 3개 합치기
function runeBagHtml() {
  const bag = runeBag(), pick = t7Ui.pick;
  const idx = bag.map((r, i) => i).sort((a, b) => bag[b].g - bag[a].g || (bag[a].id < bag[b].id ? -1 : 1));
  const chips = idx.map((i) => { const r = bag[i], w = pick ? runeWhy(pick, r) : null;
    return `<button class="rchip${pick && !w ? ' can' : ''}${pick && w ? ' no' : ''}" data-action="t7-sock" data-i="${i}" title="${esc(runeText(r))}${w ? ' · ' + w : ''}">${runeChip(r)}</button>`; }).join('');
  const merges = runeMergeable().map((m) => `<button class="btn" data-action="t7-merge" data-id="${m.id}" data-g="${m.g}" title="같은 룬 3개 → ${m.g === 3 ? '전설 룬 하나 (무작위)' : GRADES[m.g + 1].name}">${runeArt(m)} ${RUNE_DEF[m.id].n} <span style="color:${GRADES[m.g].color}">${GRADES[m.g].name}</span> ×3 → <span style="color:${GRADES[m.g + 1].color}">${m.g === 3 ? '전설' : GRADES[m.g + 1].name}</span></button>`).join('');
  const pn = pick && t7NodeOf(pick) ? t7U(t7NodeOf(pick).id).n : '';
  return `<div class="rbag"><div class="rbagh"><b>🔮 룬 주머니</b> <small>${bag.length}/${RUNE_BAG_MAX} · ${pick ? `<b>${pn}</b> 에 끼울 룬을 누르세요 <button class="btn" data-action="t7-pick" data-sk="${pick}">취소</button>` : '스킬 카드의 빈 칸(◇)을 누른 뒤 룬을 고르세요 · 원정 상자·레이드·탑에서 나와요'}</small></div>
    ${chips ? `<div class="rchips">${chips}</div>` : '<small class="t7note">아직 룬이 없어요 — 원정 상자를 열면 가끔 나와요 (보물상자일수록 자주)</small>'}
    ${merges ? `<div class="rmerge"><small>합치기</small>${merges}</div>` : ''}</div>`;
}
// renderCamp 뒤: 아이콘 canvas 를 도트로 칠하고 설명창을 단다
function paintTree7(root) {
  if (!root || !window.TreeArt) return;
  const go = () => root.querySelectorAll('canvas[data-t7icon]').forEach((cv) => { TreeArt.paintIcon(cv, cv.dataset.t7icon); cv.style.width = cv.style.height = '28px'; });
  go();
  TreeArt.ready().then(go);   // 아이콘 시트를 처음 불러오는 중이면 다 받은 뒤 한 번 더
  const box = root.querySelector('.t7cards.skl');
  if (box) {
    box.onmouseover = (e) => { const c = e.target.closest('[data-t7tip]'); if (c) t7TipShow(c); };
    box.onmouseout = (e) => { if (!e.relatedTarget || !e.relatedTarget.closest || e.relatedTarget.closest('[data-t7tip]') !== e.target.closest('[data-t7tip]')) t7TipHide(); };
  }
  t7TipHide();
}
// 설명창: 스킬이 하는 일 · 지금 모습과 다음 모습 · 여는 조건
function t7TipShow(el) {
  const slot = el.dataset.t7tip, n = T7_BY[slot], L = t7L();
  if (!n || !L) return;
  const sk = L.sk[slot], u = t7U(slot), own = skmOwnedSlot(slot);
  let body;
  if (!own) body = `<p>${u.d || ''}</p><div class="t7tipact lock">🔒 ${skmLockText(slot)}</div>`;
  else {
    const lv = skmLv(sk), st = skmStage(sk), nx = Math.min(3, st + 1);
    body = `<p>${u.d || ''}</p><p>지금: ${st ? `${T7_STARS(st)} ` : '기본 · '}${t7LookName(n, st)}${st < 3 ? `<br>다음 (숙련 Lv${nx * 10}): ${T7_STARS(nx)} ${t7LookName(n, nx)}${t7LookDesc(n, nx) ? ` — ${t7LookDesc(n, nx)}` : ''}` : ''}</p>
      ${runesOf(sk).length ? `<p>🔮 ${runesOf(sk).map((r) => `${runeIcon(r)} ${runeName(r)}: ${runeText(r)}`).join('<br>🔮 ')}</p>` : ''}
      <div class="t7tipact">장착해서 원정에 데려가면 시전 1번에 경험치 +1 · 룬 칸 ${runeCap(sk)}/2</div>`;
  }
  let tip = document.getElementById('t7tip');
  if (!tip) { tip = document.createElement('div'); tip.id = 't7tip'; tip.className = 't7tip'; document.body.appendChild(tip); }
  tip.innerHTML = `<b>${u.n}</b><small>${slot === 'ult' ? '궁극기' : slot === 'slash' ? '메인 스킬' : u.new ? '새 스킬' : '스킬'}</small>${body}`;
  tip.style.display = 'block';
  const r = el.getBoundingClientRect(), w = tip.offsetWidth, h = tip.offsetHeight;
  let x = r.left + r.width / 2 - w / 2, y = r.top - h - 8;
  if (y < 4) y = r.bottom + 8;
  tip.style.left = Math.max(4, Math.min(innerWidth - w - 4, x)) + 'px'; tip.style.top = y + 'px';
}
function t7TipHide() { const el = document.getElementById('t7tip'); if (el) el.style.display = 'none'; }
// 버튼 동작 — ui.js 가 ACTIONS 를 만든 뒤 이어 붙인다 (이 파일은 ui.js 앞에 불러온다: ui.js 가 불러오자마자 부팅하며 t7Dot 을 부른다)
const T7_ACTIONS = ({
  't7-slot': () => { if (t7BuySlot()) toast(`🔓 장착 칸 ${t7Slots()}칸`, 3000); },
  't7-eq': (el) => { if (!t7Equip(el.dataset.sk)) toast('장착 칸이 다 찼어요 — 장착한 스킬을 눌러 먼저 빼세요'); },
  't7-use': (el) => { const s = t7S(); s.use[el.dataset.sk] = Number(el.dataset.s); },
  // 🔮 룬: 빈 칸 고르기(다시 누르면 취소) → 주머니에서 룬 누르기 = 끼우기 · 끼운 룬 누르기 = 빼기 · 합치기
  't7-pick': (el) => { t7Ui.pick = t7Ui.pick === el.dataset.sk ? null : el.dataset.sk; },
  't7-sock': (el) => {
    const sk = t7Ui.pick, r = runeBag()[Number(el.dataset.i)];
    if (!sk) { toast('먼저 스킬 카드의 빈 칸(◇)을 누르세요'); return; }
    const w = r && runeWhy(sk, r);
    if (w) { toast(w); return; }
    if (runeSocket(sk, Number(el.dataset.i))) { toast(`🔮 ${runeName(r)} → ${t7U(t7NodeOf(sk).id).n}`, 2500); t7Ui.pick = runesOf(sk).length < runeCap(sk) ? sk : null; }
  },
  't7-unsock': (el) => { runeUnsock(el.dataset.sk, Number(el.dataset.j)); },
  't7-merge': (el) => { const r = runeMerge(el.dataset.id, Number(el.dataset.g)); if (r) toast(`🔮 합치기 → ${runeIcon(r)} ${runeName(r)} (${GRADES[r.g].name})`, 3500); },
  't7-feed': (el) => {
    const sk = el.dataset.sk, lv0 = skmLv(sk), used = skmFeed(sk, Number(el.dataset.n) || 10);
    if (!used) { toast(skmFeedMax(sk) ? '📖 비전서가 없어요' : '숙련 Lv20 부터는 장착해서 써야 자라요'); return; }
    const lv1 = skmLv(sk), n = t7NodeOf(sk);
    toast(`📖 ${used}권 → ${t7U(n.id).n} 숙련 Lv${lv0}${lv1 > lv0 ? ` → ${lv1}` : ''}${Math.floor(lv1 / 10) > Math.floor(lv0 / 10) ? ` · ✨ ${T7_STARS(Math.floor(lv1 / 10))} ${t7LookName(n, Math.floor(lv1 / 10))}` : ''}`, 3500);
    t7FixEq();
  },
});

// 귀환 보고: 보스 벽 — 뚫었으면 큰 배너, 막혔으면 얼마나 깎았나 (답 안내는 하지 않는다 — 정답 강요 금지, docs/specs/skill-redesign.md)
function t7WallReport(r) {
  const out = [];
  for (const st of r.wallBreak || []) out.push(`<div class="reason t7-break">⚔️ 벽 돌파! ${st}스테이지 ${st % 20 ? '중간' : '지역'} 보스를 쓰러뜨렸습니다</div>`);
  const w = r.wall;
  if (w) {
    const g = w.gims.map((x) => T7_GIM[x].icon + ' ' + T7_GIM[x].name).join(' · ');
    out.push(`<div class="reason warn">👑 ${esc(MONSTERS[w.type] ? MONSTERS[w.type].name : '보스')} 체력 ${Math.round(w.left * 100)}% 까지 깎음 · ${g}</div>`);
  }
  return out.join('');
}
// 귀환 보고: ⚔️ 숙련 — 장착 스킬마다 오른 Lv(또는 다음 Lv 까지 %), ★ 해금·새 스킬은 강조 (src/skm.js skmTripLines)
function skmReport(r) {
  const ls = skmTripLines(r);
  if (!ls.length) return '';
  const row = (x) => {
    const n = t7NodeOf(x.sk), name = t7U(n.id).n;
    if (x.fresh) return `<div class="skmrow fresh">✨ 새 스킬: <b>${name}</b> <small>— 스킬 탭에서 장착</small></div>`;
    const up = x.lv1 > x.lv0 ? `Lv${x.lv0} → <b>${x.lv1}</b>` : `Lv${x.lv1} <small>(다음까지 ${Math.round(x.p0 * 100)}% → ${Math.round(x.p1 * 100)}%)</small>`;
    return `<div class="skmrow${x.star ? ' star' : ''}">${name} ${up}${x.star ? ` · ✨ ${T7_STARS(x.star)} <b>${t7LookName(n, x.star)}</b>` : ''}</div>`;
  };
  return `<div class="skmrep"><b>⚔️ 숙련</b>${ls.map(row).join('')}</div>`;
}
