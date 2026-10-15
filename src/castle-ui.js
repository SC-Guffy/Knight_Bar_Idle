'use strict';
// 🏰 성벽 지키기 캠프 화면(도전 탭 카드 안)과 하단바 위 상태 칩. ui.js 보다 먼저 불러오고, ui.js 의 도우미(ico·costChip·rd·esc·fmt)는 부를 때 쓴다.
// 규칙은 src/castle.js, 하단바 연출은 src/castle-view.js. 스펙: docs/specs/castle-defense.md "UI"
const CASTLE_REASON = { clear: '🎉 성벽 사수!', broken: '💥 성벽 붕괴', timeout: '⏱️ 시간 초과', retreat: '🏳️ 후퇴', offline: '🌙 앱이 꺼져서 멈췄어요' };
const castleUi = { sel: null };       // 펼친 업그레이드 칩
const castleResultPending = () => !!S.castle.last && S.castle.last.seen === false;
let castleResultViewed = false;

// 하단바 위 상태 칩 (#dgInfo 자리): 🏰 12단계 · 웨이브 4/10 · 🧱 78/100 · ⚔️ 포위 5 · 처치 41 · 💀 1 (+ ⏱️ 남은 시간) + 🔥 끓는 기름 버튼
//  버튼은 한 번만 만들고 글자·상태만 바꾼다 (innerHTML 을 다시 넣으면 누르는 도중 버튼이 바뀐다)
function renderCastleInfo() {
  const run = S.phase === 'castle' ? S.castle.run : null, info = $('dgInfo');
  if (!run || !castleInside()) return;
  info.hidden = false;
  if (!$('cdOil')) info.innerHTML = '<span id="cdChips" style="display:contents"></span><button id="cdOil" class="dchip cdoil" data-action="castle-oil" title="끓는 기름 — 성문 앞 무리에 큰 피해 + 화상 + 기절 (${CASTLE_OIL_CD}초마다)"></button>';
  const left = castleTimeLeft(run), pile = cdv ? cdv.pile : 0;
  const html = `<span class="dchip">🏰 ${run.lv}단계 · 웨이브 ${run.wave}/${CASTLE_WAVES.length}</span>
    <span class="dchip" title="성벽 내구도">${ico('wall')} ${Math.ceil(run.wallHp)}/${run.wallMax}</span>
    <span class="dchip" title="지금 기사에게 붙은 적"${pile >= 8 ? ' style="color:#ff8f8f;border-color:rgba(255,90,90,.6)"' : ''}>⚔️ 포위 ${pile}</span>
    <span class="dchip">처치 ${run.kills}${run.downs ? ` · 💀 ${run.downs}` : ''}</span>${left != null ? `<span class="dchip"${left < 20 ? ' style="color:#ff8f8f"' : ''}>⏱️ 남은 시간 ${Math.ceil(left)}초</span>` : ''}`;
  const chips = $('cdChips');
  if (chips.innerHTML !== html) chips.innerHTML = html;
  const btn = $('cdOil'), ready = castleOilReady(), txt = ready ? '🔥 끓는 기름' : `🔥 ${Math.ceil(Math.max(0, cdv ? cdv.oilCd : 0))}초`;
  if (btn.textContent !== txt) btn.textContent = txt;
  btn.disabled = !ready;
  btn.classList.toggle('ready', ready);
}

// 판정 칩: 지금 능력치로 도전 단계를 막을 수 있을지 (castle.js castleVerdict — 간이 시뮬 한계 단계와 견줌)
function castleVerdictChip(L) {
  const v = castleVerdict(L), col = { easy: '#9fd49a', even: '#ffd257', hard: '#ff8f8f' }[v.key];
  return `<span class="pchip static" title="간이 시뮬로 본 지금 한계: ${v.limit ? `${v.limit}단계` : '1단계 미만'}" style="color:${col}">${v.key === 'easy' ? '🟢' : v.key === 'even' ? '🟡' : '🔴'} ${v.text}</span>`;
}
function castleResultHtml(L) {
  return `
    <div class="treport" style="margin-bottom:10px">
      <div class="reason">${CASTLE_REASON[L.reason] || '도전 끝'} ${L.first ? '<span class="chip ok">첫 돌파 🧱 ×2</span>' : ''}${L.reason === 'clear' && L.first && L.lv < CASTLE_MAX_LV ? ` <span class="chip ok">🔓 ${L.lv + 1}단계</span>` : ''}</div>
      <div class="dgline">${L.lv}단계 · 막은 웨이브 <b>${L.waves}/${CASTLE_WAVES.length}</b> · 처치 ${L.kills} · 💀 쓰러짐 ${L.downs} · ${ico('wall')} <b>+${fmt(L.bricks)}</b> · 📕 <b>+${L.books}</b>${L.dur ? ` · ${fmtTime(L.dur)}` : ''}</div>
    </div>`;
}
// 입장권 구매 한 줄 — 탑·미궁과 같은 모양 (ui.js ticketBuyRow)
const castleBuyRow = () => ticketBuyRow('castle-ticket', castleTicketPrice(), castleTicketBlocker(), castleTicketsBoughtToday(), S.castle.tixExtra || 0);
function castleUpRow() {
  const chips = CASTLE_UPS.map((u) => {
    const lv = castleUp(u.id), max = lv >= CASTLE_UP_MAX, ok = !castleUpBlocker(u.id);
    return `<button class="skchip${castleUi.sel === u.id ? ' on' : ''}${rd(ok)}" data-action="castle-up" data-id="${u.id}">${u.icon} ${u.name} Lv${lv} <small>${max ? 'MAX' : `${ico('wall')} ${castleUpCost(u.id)}`}</small></button>`;
  }).join('');
  const u = castleUi.sel && CASTLE_UPS.find((x) => x.id === castleUi.sel);
  let detail = '';
  if (u) {
    const lv = castleUp(u.id), max = lv >= CASTLE_UP_MAX, b = castleUpBlocker(u.id);
    detail = `<div class="dgline">${u.icon} <b>${u.name}</b> (${u.per}) — ${u.fx(lv)}${max ? ' · <b>MAX</b>' : ` → <b>${u.fx(lv + 1)}</b>
      <button class="btn" data-action="castle-up-buy" data-id="${u.id}" ${b ? 'disabled' : ''}>올리기 ${ico('wall')} ${castleUpCost(u.id)}</button>${b ? ` <span class="blocker">${b}</span>` : ''}`}</div>`;
  }
  return `<div class="skchips">${chips}</div>${detail}`;
}
function viewCastle() {
  const c = S.castle;
  if (!castleUnlocked()) return `<div class="mhead"><div><h3>${ico('castle')} 성벽 지키기</h3><small>스테이지 ${CASTLE_UNLOCK_STAGE}에 열려요</small></div></div>
    <div class="hint">몰려오는 10웨이브를 성문 앞에서 막는 콘텐츠예요. ${ico('wall')} 성벽돌로 성벽을, 📕 수련의 서로 교관을 키워요.</div>`;
  const fresh = castleResultPending();
  if (fresh) castleResultViewed = true;
  const L = castleNextLv(), st = castleStage(L), z = zoneOf(st), blocker = castleBlocker();
  const sweep = castleSweepReady(), sb = c.best ? castleSweepBricks() : 0, so = c.best ? castleBooksEv(c.best, CASTLE_WAVES.length) : 0;
  const ms = castleMentors();
  return `
    <div class="mhead"><div><h3>${ico('castle')} 성벽 지키기</h3>
      <small>🎟 입장권 <b>${castleFreeTickets()}/${CASTLE_TICKETS}</b>${c.tixExtra ? ` + 구매 <b>${c.tixExtra}</b>` : ''} · 최고 <b>${c.best ? `${c.best}단계` : '기록 없음'}</b></small></div>
      <small>${ico('wall')} <b>${fmt(c.bricks)}</b> · 📕 <b>${fmt(S.books || 0)}</b></small></div>
    ${castleBuyRow()}
    ${fresh ? castleResultHtml(c.last) : ''}
    <div class="dgrow"><span class="lbl">다음</span><b>${L}단계</b> · 적 스테이지 ${st}급 (${z.icon} ${z.name}) ${castleVerdictChip(L)}</div>
    <div class="act" style="margin:6px 0 10px">
      <button class="go compact${rd(blocker === '')}" data-action="castle-start" ${blocker ? 'disabled' : ''}>${ico('castle')} 도전 <small>${ico('ticket')}1</small></button>
      ${c.best ? `<button class="go compact${rd(sweep)}" data-action="castle-sweep" ${sweep ? '' : 'disabled'}>${ico('broom')} 소탕 <small>${ico('ticket')}1 (${ico('wall')} +${fmt(sb)} · 📕 +${so.toFixed(1)})</small></button>` : ''}
      <span class="blocker">${blocker}</span></div>
    <div class="dgrow"><span class="lbl">업그레이드</span><small>${ico('wall')} 성벽돌로 영구 강화 · 각 Lv${CASTLE_UP_MAX}</small></div>
    ${castleUpRow()}
    ${ms.length ? `<div class="dgline">🎓 성벽 위 교관 ${ms.length}명 · 별 ${ms.reduce((a, m) => a + m.stars, 0)}/${MENTORS.length * MENTOR_STARS} — 10초마다 특기 (공격력 × 0.4 × 별)</div>` : ''}
    <div class="hint">오른쪽에서 10웨이브가 몰려와요 (5·10웨이브는 보스). 기사는 성문 앞에서 몸으로 막고, <b>기사가 쓰러진 ${CASTLE_RESPAWN_SEC}초 동안만 성벽이 맞아요</b>. 성벽이 무너지거나, 10웨이브가 나온 뒤 ${CASTLE_LIMIT_SEC}초 안에 다 못 잡으면 실패예요. 물약은 못 쓰고, 웨이브 사이에 체력이 조금씩 차요.
      보상은 끝날 때 — ${ico('wall')} 성벽돌(처치 점수 × (1 + 단계/100), 첫 돌파 ×2)과 📕 수련의 서(막은 웨이브마다). 깬 최고 단계는 입장권 1장으로 소탕할 수 있어요. 입장권은 하루 ${CASTLE_TICKETS}장, 모자라면 골드로 사요 (산 입장권은 ${CASTLE_TICKET_HOLD}장까지).</div>`;
}
// 도전 탭 카드 칩
function castleCardChips() {
  const c = S.castle, out = [];
  if (castleResultPending()) out.push(['📜 정산 보기', 'ok']);
  out.push([`🎟 ${castleTickets()}장`, castleTickets() ? '' : 'lack']);
  out.push([c.best ? `최고 ${c.best}단계` : '아직 기록 없음', '']);
  if (castleSweepReady()) out.push([`🧹 소탕 🧱 +${fmt(castleSweepBricks())} 📕 +${castleBooksEv(c.best, CASTLE_WAVES.length).toFixed(1)}`, 'ok']);
  return out;
}
// 레드닷: 입장권이 있을 때 · 결과 대기 · 처음 열렸는데 안 봤을 때 · 🧱 으로 올릴 수 있는 업그레이드가 있을 때
const castleDot = () => castleUnlocked() && (!S.guide.castleSeen || castleResultPending() || castleTickets() > 0 || castleUpReady());

// 카드 미리보기: 성벽 + 몰려오는 몬스터 실루엣
function drawSubCastle(g, w, h) {
  const gy = h - 8, L = castleNextLv(), z = zoneOf(castleStage(L)), gr = z.ground;
  g.fillStyle = '#1c1a28'; g.fillRect(0, 0, w, h);
  g.fillStyle = gr.line; g.fillRect(0, gy, w, 2); g.fillStyle = gr.soil; g.fillRect(0, gy + 2, w, h - gy - 2);
  const wx = 4, ww = 30, wt = gy - 38;
  g.fillStyle = '#5d5668'; g.fillRect(wx, wt, ww, gy - wt);
  g.fillStyle = '#4a4454'; for (let y = wt + 6; y < gy; y += 7) g.fillRect(wx, y, ww, 1);
  g.fillStyle = '#6e6779'; for (let x = wx; x < wx + ww; x += 8) g.fillRect(x, wt - 5, 5, 5);
  g.fillStyle = '#1a1620'; g.fillRect(wx + ww - 12, gy - 16, 9, 16);
  const pool = z.mobs, span = w - 60;
  for (let i = 0; i < 4; i++) {
    const x = 48 + ((i * 26 + (span - (clock * 22) % span)) % span);
    subMonster(g, pool[i % pool.length], Math.round(x), gy, 2, false);
  }
  subHero(g, wx + ww + 10, gy, 'fight');
  if (!castleUnlocked()) subLock(g, w, h);
}

// 행동 (ui.js ACTIONS 에 합쳐진다)
const CASTLE_ACTIONS = {
  'castle-start': () => {
    if (!startCastle()) return;
    closeCamp();
    beginCastleView();
    save();
    renderHud();
  },
  'castle-retreat': () => { castleRetreat(); renderHud(); },
  'castle-oil': () => { castleOil(); renderCastleInfo(); },
  'castle-sweep': () => {
    const r = sweepCastle();
    if (!r) return;
    toast(`🧹 ${r.lv}단계 소탕 — 🧱 +${fmt(r.bricks)} · 📕 +${r.books}`);
    save();
    renderCamp();
  },
  'castle-ticket': () => {
    if (!buyCastleTicket()) return;
    toast(`🎟 성벽 입장권을 샀어요 (지금 ${castleTickets()}장)`);
    save();
    renderCamp();
  },
  'castle-up': (el) => { castleUi.sel = castleUi.sel === el.dataset.id ? null : el.dataset.id; },
  'castle-up-buy': (el) => {
    if (!castleUpgrade(el.dataset.id)) return;
    const u = CASTLE_UPS.find((x) => x.id === el.dataset.id);
    toast(`${u.icon} ${u.name} Lv${castleUp(u.id)} — ${u.fx(castleUp(u.id))}`);
    save();
    renderCamp();
  },
};
