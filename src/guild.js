'use strict';
// 기사단 호스트 (docs/specs/guild.md 1단계 — 이 기기 안 기사단, 웹만).
// 슬롯마다 같은 게임을 iframe(index.html?char=닉네임)으로 띄우고, 이 페이지가 매 프레임 모든 기사의 guildStep 을 부른다.
// 화면은 고른 기사 하나만 그린다. 공용 상태(골드·목재·철광석·마을 건물·창고·대장간 시설·건설)는 아래 guild.shared 하나를
// 각 기사의 S 에 getter/setter 로 걸어 같이 쓴다 (같은 origin 이라 동기 접근). 건설 시계는 여기서 한 번만 돌린다.

const GUILD_KEY = 'knight-bar-guild';
const ACCOUNTS_KEY = 'knight-bar-accounts';
const SAVE_KEY = 'knight-bar-save-v1';
const GUILD_MAX = 10;                       // 보유 기사 최대
const GUILD_SLOT_LV = [1, 3, 6, 10];        // 슬롯 2·3·4·5칸이 열리는 회관 Lv (src/core.js 와 같게)
const slotsAt = (lv) => 1 + GUILD_SLOT_LV.filter((x) => lv >= x).length;
const NAME_RE = /^[가-힣a-zA-Z0-9_ ]{2,12}$/;
const NEW = '+new';                          // 새 기사 iframe (닉네임 창부터)
const $ = (id) => document.getElementById(id);
const esc = (v) => String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const readJSON = (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } };

// 게임 iframe 에 넘길 주소 인자 (server=·speed= 등). guild= 는 빼고
const PASS = (() => { const q = new URLSearchParams(location.search); q.delete('guild'); q.delete('char'); const s = q.toString(); return s ? '&' + s : ''; })();

// ───────────────────────── 기사단 저장 ─────────────────────────
function freshShared() {
  return { gold: 0, wood: 0, ore: 0, bld: { training: 1, inn: 1, storage: 1, forge: 1, hall: 1 },
    stock: { wood: 0, ore: 0, at: 0, tradeDay: '', trades: 0 }, forge: {}, build: null };
}
// 처음 켤 때: 지금 고른 계정을 기사1 로, 그 기사의 공용 항목을 기사단 출발점으로 옮긴다
function initGuild() {
  const acc = Object.assign({ active: null, list: {} }, readJSON(ACCOUNTS_KEY));
  const first = acc.active && acc.list[acc.active] ? acc.active : Object.keys(acc.list)[0] || null;
  const shared = freshShared();
  const st = first && readJSON(`${SAVE_KEY}:${first.toLowerCase()}`);
  if (st) {
    shared.gold = st.gold || 0;
    if (st.mats) { shared.wood = st.mats.wood || 0; shared.ore = st.mats.ore || 0; }
    if (st.bld) Object.assign(shared.bld, st.bld);
    if (st.stock) Object.assign(shared.stock, st.stock);
    if (st.forge) shared.forge = st.forge;
    if (st.build) shared.build = st.build;
  }
  return { v: 1, name: null, chars: first ? [first] : [], slots: [first, null, null, null, null], view: 0, shared, at: Date.now() };
}
const guild = (() => {
  const g = readJSON(GUILD_KEY) || initGuild();
  g.shared = Object.assign(freshShared(), g.shared);
  if (!g.shared.bld.hall) g.shared.bld.hall = 1;
  while (g.slots.length < 5) g.slots.push(null);
  return g;
})();
const shared = guild.shared;
const openSlots = () => slotsAt(shared.bld.hall);
function saveGuild() {
  try { localStorage.setItem(GUILD_KEY, JSON.stringify(guild)); } catch {}
}
setInterval(saveGuild, 10000);
window.addEventListener('pagehide', () => { frames.forEach((f) => f && f.win && f.win.guildApi && f.win.guildApi.save()); saveGuild(); });

// ───────────────────────── 기사 iframe ─────────────────────────
const frames = [null, null, null, null, null];   // 슬롯 i → { nick, el, win, info, alert }
let active = Math.min(guild.view || 0, 4);

function spawn(i, nick) {
  const el = document.createElement('iframe');
  el.src = `index.html?char=${encodeURIComponent(nick)}${PASS}`;
  $('frames').appendChild(el);
  frames[i] = { nick, el, win: null, info: null, alert: false };
}
function kill(i) {
  const f = frames[i];
  if (!f) return;
  try { if (f.win && f.win.guildApi) f.win.guildApi.save(); } catch {}
  f.el.remove();
  frames[i] = null;
}
const frameOf = (win) => frames.findIndex((f) => f && f.el.contentWindow === win);
const slotOf = (nick) => guild.slots.findIndex((n) => n === nick);

function pick(i) {
  if (i === active && frames[i]) return;
  // 고르다 만 새 기사 iframe 은 다른 슬롯으로 가면 닫는다
  if (frames[active] && frames[active].nick === NEW && i !== active) kill(active);
  active = i;
  guild.view = i;
  frames.forEach((f, j) => f && f.el.classList.toggle('on', j === i));
  if (frames[i]) frames[i].alert = false;
  hideTip();
  renderSlots();
  saveGuild();
}

// ───────────────────────── 게임 쪽에서 부르는 것 (src/core.js GUILD_HOST) ─────────────────────────
window.guildHost = {
  full: true,   // 시제품(dev/guild-spike.html)과 구별 — 건설 시계·회관·알림 모으기를 켠다
  bindShared(S) {
    Object.defineProperty(S, 'gold', { get: () => shared.gold, set: (v) => { shared.gold = v; }, enumerable: true, configurable: true });
    for (const k of ['wood', 'ore']) Object.defineProperty(S.mats, k, { get: () => shared[k], set: (v) => { shared[k] = v; }, enumerable: true, configurable: true });
    for (const k of ['bld', 'stock', 'forge', 'build']) Object.defineProperty(S, k, { get: () => shared[k], set: (v) => { shared[k] = v; }, enumerable: true, configurable: true });
  },
  ready(win) {
    const i = frameOf(win);
    if (i >= 0) frames[i].win = win;
  },
  // 숨은 기사의 토스트 → "닉네임: …" 로 모아 띄우고 그 슬롯에 레드닷
  toast(win, msg) {
    const i = frameOf(win);
    if (i < 0) return;
    frames[i].alert = true;
    hostToast(frames[i].nick === NEW ? msg : `<b>${esc(frames[i].nick)}</b> ${esc(msg)}`);
    renderSlots();
  },
  // 새 기사 iframe 에서 닉네임을 만들었다 (src/ui.js acctCreate)
  addKnight(win, nick) {
    const i = frameOf(win);
    if (i < 0) return;
    frames[i].nick = nick;
    if (!guild.chars.includes(nick)) guild.chars.push(nick);
    guild.slots[i] = nick;
    saveGuild();
    renderSlots();
  },
  list() {
    return {
      name: guild.name || '기사단', max: GUILD_MAX, open: openSlots(), slots: guild.slots.slice(),
      chars: guild.chars.map((nick) => { const s = slotOf(nick); return { nick, slot: s, info: s >= 0 && frames[s] ? frames[s].info : null }; }),
    };
  },
  view(nick) { const i = slotOf(nick); if (i >= 0) pick(i); },
  slot(nick, on) {
    if (on) {
      if (slotOf(nick) >= 0) return;
      const i = guild.slots.findIndex((n, j) => !n && j < openSlots() && !frames[j]);
      if (i < 0) return;
      guild.slots[i] = nick;
      spawn(i, nick);
    } else {
      const i = slotOf(nick), f = frames[i];
      if (i < 0 || (f && f.info && f.info.busy)) return;
      if (guild.slots.filter(Boolean).length <= 1) return;   // 적어도 한 명은 슬롯에
      kill(i);
      guild.slots[i] = null;
      if (active === i) pick(guild.slots.findIndex(Boolean));
    }
    saveGuild();
    renderSlots();
    refreshHall();
  },
  // 기사단에서 빼기 (1단계: 계정·세이브는 그대로 남는다)
  drop(nick) {
    if (slotOf(nick) >= 0) return;
    guild.chars = guild.chars.filter((n) => n !== nick);
    saveGuild();
    refreshHall();
  },
  newKnight() {
    if (guild.chars.length >= GUILD_MAX) return;
    const i = guild.slots.findIndex((n, j) => !n && j < openSlots() && !frames[j]);
    if (i < 0) return;
    spawn(i, NEW);
    pick(i);
  },
};
function refreshHall() {
  const f = frames[active];
  try { if (f && f.win && f.win.guildApi) f.win.guildApi.refresh(); } catch {}
}

// ───────────────────────── 프레임 구동 ─────────────────────────
// 모든 기사의 게임 시간을 한 rAF 에서 돌리고, 고른 기사만 그린다
function tick(now) {
  requestAnimationFrame(tick);
  frames.forEach((f, i) => {
    if (!f || !f.win || !f.win.guildStep) return;
    try { f.win.guildStep(now, i === active); } catch (e) { console.error(f.nick, e); }
  });
  // 건설 시계: 실제 경과 시간을 불러온 기사 하나에게만 (보고 있는 기사 우선). 탭이 쉬던 시간·꺼져 있던 시간도 여기서 한 번에
  const order = [active, ...frames.keys()].filter((i, k, a) => a.indexOf(i) === k);
  for (const i of order) {
    const f = frames[i];
    if (!f || !f.win || !f.win.guildApi) continue;
    let ok = false;
    try { ok = f.win.guildApi.tickBuild((Date.now() - guild.at) / 1000); } catch {}
    if (ok) { guild.at = Date.now(); break; }
  }
}

// ───────────────────────── 슬롯 버튼 (HUD 바로 위) ─────────────────────────
const iconHtml = (emoji) => {
  const n = ICON_OF[String(emoji).replace(/️/g, '')];
  return n ? `<i class="pi pi-${n}"></i>` : esc(emoji);
};
function renderSlots() {
  const open = openSlots();
  $('slots').innerHTML = guild.slots.map((nick, i) => {
    const f = frames[i];
    if (i >= open) return `<button class="gs lock" data-i="${i}"><span class="act"></span><b>${iconHtml('🔒')}</b></button>`;
    if (!f) return `<button class="gs empty" data-i="${i}"><span class="act"></span><b>${i + 1}</b></button>`;
    const inf = f.info, dot = i !== active && (f.alert || (inf && inf.dot));
    const act = f.nick === NEW ? iconHtml('🆕') : inf ? iconHtml(inf.icon) : '';
    return `<button class="gs${i === active ? ' on' : ''}" data-i="${i}"><span class="act">${act}</span><b>${i + 1}</b>${dot ? '<span class="dot"></span>' : ''}</button>`;
  }).join('');
  placeSlots();
}
// 보고 있는 기사의 HUD 위치를 읽어 버튼 줄을 그 위 왼쪽 끝에 붙인다 (iframe 이 창 전체라 좌표가 같다)
function placeSlots() {
  const f = frames[active], bar = $('slots');
  let r = null;
  try { const h = f && f.win && f.win.document.getElementById('hud'); r = h && h.offsetParent ? h.getBoundingClientRect() : null; } catch {}
  if (!r || !r.width) { bar.style.left = '10px'; bar.style.top = `${innerHeight - 150 - bar.offsetHeight - 2}px`; }
  else { bar.style.left = `${Math.round(r.left)}px`; bar.style.top = `${Math.round(r.top - bar.offsetHeight - 3)}px`; }
  bar.hidden = false;
}
function readInfo() {
  frames.forEach((f) => { if (f && f.win && f.win.guildApi) { try { f.info = f.win.guildApi.info(); } catch {} } });
}
setInterval(() => { readInfo(); renderSlots(); }, 1000);
setInterval(placeSlots, 250);
window.addEventListener('resize', placeSlots);

$('slots').addEventListener('click', (e) => {
  const b = e.target.closest('.gs');
  if (!b) return;
  const i = +b.dataset.i, f = frames[i];
  if (f) { pick(i); return; }
  const hall = frames[active] && frames[active].win && frames[active].win.guildApi;
  if (i >= openSlots()) {
    hostToast(`🔒 ${i + 1}번 슬롯은 🛡️ 기사단 회관 Lv ${GUILD_SLOT_LV[i - 1]} 에 열려요`);
    if (hall) hall.openHall();
  } else if (hall) hall.openHall();   // 빈 칸: 회관에서 새 기사·배정
});

// 말풍선: 마우스를 올리거나(데스크탑) 길게 누르면(터치) 이름·직업·Lv·진행
function tipFor(i) {
  const f = frames[i];
  if (i >= openSlots()) return `🔒 회관 Lv ${GUILD_SLOT_LV[i - 1]} 에 열려요`;
  if (!f) return '빈 슬롯 <small>· 눌러서 회관으로</small>';
  if (f.nick === NEW) return '새 기사 만드는 중';
  const inf = f.info;
  return inf ? `<b>${esc(inf.nick)}</b> <small>${esc(inf.cls)} Lv ${inf.lv}</small><br>${esc(inf.icon)} ${esc(inf.text)}` : `<b>${esc(f.nick)}</b> <small>불러오는 중</small>`;
}
function showTip(b) {
  const tip = $('tip'), r = b.getBoundingClientRect();
  tip.innerHTML = tipFor(+b.dataset.i);
  tip.hidden = false;
  tip.style.left = `${Math.max(4, Math.min(innerWidth - tip.offsetWidth - 4, r.left + r.width / 2 - tip.offsetWidth / 2))}px`;
  tip.style.top = `${Math.max(4, r.top - tip.offsetHeight - 4)}px`;
}
function hideTip() { $('tip').hidden = true; }
$('slots').addEventListener('mouseover', (e) => { const b = e.target.closest('.gs'); if (b) showTip(b); });
$('slots').addEventListener('mouseleave', hideTip);
let pressT = null;
$('slots').addEventListener('touchstart', (e) => { const b = e.target.closest('.gs'); if (b) pressT = setTimeout(() => showTip(b), 450); }, { passive: true });
$('slots').addEventListener('touchend', () => { clearTimeout(pressT); setTimeout(hideTip, 1500); });

// ───────────────────────── 바깥 토스트 ─────────────────────────
const toastQ = [];
let toastBusy = false;
function hostToast(html) {
  if (toastQ.length > 4) toastQ.shift();   // 너무 쌓이면 오래된 것부터 버린다
  toastQ.push(html);
  if (!toastBusy) nextToast();
}
function nextToast() {
  const el = $('gtoast'), html = toastQ.shift();
  if (html == null) { toastBusy = false; el.classList.remove('show'); return; }
  toastBusy = true;
  el.innerHTML = html;
  el.classList.add('show');
  setTimeout(() => { el.classList.remove('show'); setTimeout(nextToast, 250); }, 2600);
}

// ───────────────────────── 시작 ─────────────────────────
function start() {
  if (!guild.chars.length) { spawn(0, NEW); active = 0; }
  guild.slots.forEach((nick, i) => { if (nick && i < openSlots()) spawn(i, nick); });
  if (!frames[active]) active = frames.findIndex(Boolean);
  frames.forEach((f, j) => f && f.el.classList.toggle('on', j === active));
  renderSlots();
  saveGuild();
  requestAnimationFrame(tick);
}
if (guild.name) start();
else {
  $('naming').hidden = false;
  const go = () => {
    const v = $('gname').value.trim();
    if (!NAME_RE.test(v)) { $('gnameMsg').textContent = '한글·영문·숫자 2~12자로 지어 주세요'; return; }
    guild.name = v;
    $('naming').hidden = true;
    start();
  };
  $('gnameGo').addEventListener('click', go);
  $('gname').addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
  setTimeout(() => $('gname').focus(), 50);
}
