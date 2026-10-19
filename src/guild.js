'use strict';
// 기사단 호스트 (docs/specs/guild.md 1단계 이 기기 안 기사단 + 2단계 서버 기사단·로그인·연결 코드·Electron 중계).
// 슬롯마다 같은 게임을 iframe(index.html?char=닉네임)으로 띄우고, 이 페이지가 매 프레임 모든 기사의 guildStep 을 부른다.
// 화면은 고른 기사 하나만 그린다. 공용 상태(골드·목재·철광석·마을 건물·창고·대장간 시설·건설)는 아래 guild.shared 하나를
// 각 기사의 S 에 getter/setter 로 걸어 같이 쓴다 (같은 origin 이라 동기 접근). 건설 시계는 여기서 한 번만 돌린다.

// 기사단 스위치 (src/data.js GUILD_OPEN 과 같게). 꺼져 있으면 배포 주소에서는 보통 게임으로 돌려보낸다 (로컬 개발 주소는 늘 열림)
const GUILD_OPEN = true;
if (!GUILD_OPEN && !/^(localhost|127\.0\.0\.1|\[::1\])$|\.localhost$|\.test$/.test(location.hostname)) {
  try { localStorage.removeItem('knight-bar-guild-on'); } catch {}
  location.replace('index.html');
  throw new Error('guild off');
}
const GUILD_KEY = 'knight-bar-guild';
const ACCOUNTS_KEY = 'knight-bar-accounts';
const SAVE_KEY = 'knight-bar-save-v1';
const GUILD_MAX = 10;                       // 보유 기사 최대
const GUILD_SLOT_LV = [1, 8, 12, 14];       // 슬롯 2·3·4·5칸이 열리는 회관 Lv (src/core.js 와 같게)
const slotsAt = (lv) => 1 + GUILD_SLOT_LV.filter((x) => lv >= x).length;
const NAME_RE = /^[가-힣a-zA-Z0-9_ ]{2,12}$/;
const NEW = '+new';                          // 새 기사 iframe (닉네임 창부터)
const $ = (id) => document.getElementById(id);
const esc = (v) => String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const readJSON = (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } };

// 게임 iframe 에 넘길 주소 인자 (server=·speed= 등). guild= 는 빼고
const PASS = (() => { const q = new URLSearchParams(location.search); q.delete('guild'); q.delete('char'); q.delete('fakegoogle'); const s = q.toString(); return s ? '&' + s : ''; })();

// ───────────────────────── 서버 기사단 (2단계) ─────────────────────────
// 기사단 토큰(localStorage knight-bar-guild-token)이 있으면 서버 기사단: 이름·기사·슬롯은 서버가 기준, 기사들은 기사단 토큰 + X-Char 로 움직인다 (src/net.js)
// Google 클라이언트 ID 는 공개값이다 (Google Cloud 콘솔 → OAuth 클라이언트 ID, 웹 애플리케이션). 비어 있으면 Google 버튼 대신 "준비 중"
const GOOGLE_CLIENT_ID = '155892908637-9qkfu1dksnvmc42jhpoakp1kepou28d0.apps.googleusercontent.com';
const QS = new URLSearchParams(location.search);
const SERVER = (QS.get('server') || 'https://knight-bar.onrender.com').replace(/\/+$/, '');
const FAKE_GOOGLE = QS.get('fakegoogle') === '1';
const TOKEN_KEY = 'knight-bar-guild-token';
const DEVICE = (() => {
  try {
    let d = localStorage.getItem('knight-bar-device');
    if (!d) { d = Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => b.toString(16).padStart(2, '0')).join(''); localStorage.setItem('knight-bar-device', d); }
    return d;
  } catch { return ''; }
})();
const account = { token: (() => { try { return localStorage.getItem(TOKEN_KEY); } catch { return null; } })(), online: false, google: false };
function setToken(t) {
  account.token = t;
  try { if (t) localStorage.setItem(TOKEN_KEY, t); else localStorage.removeItem(TOKEN_KEY); } catch {}
}
// 서버 시각 (3단계): 응답의 X-Server-Time 을 기준으로 performance.now 만큼 흐른 값 — 기기 시계를 돌려도 건설이 빨라지지 않는다
const srvClock = { base: 0, mono: 0 };
const srvNow = () => (srvClock.base ? srvClock.base + (performance.now() - srvClock.mono) : Date.now());
async function gapi(method, path, body, auth = true, { keepalive = false, char = null } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth && account.token) { headers.Authorization = `Bearer ${account.token}`; headers['X-Device'] = DEVICE; }
  if (char) headers['X-Char'] = encodeURIComponent(char);
  let res, data;
  try {
    res = await fetch(SERVER + path, { method, headers, body: body ? JSON.stringify(body) : undefined, keepalive });
    const t = Number(res.headers.get('X-Server-Time'));
    if (t) { srvClock.base = t; srvClock.mono = performance.now(); }
    data = await res.json().catch(() => ({}));
  } catch { throw Object.assign(new Error('서버에 연결할 수 없어요'), { code: 'offline' }); }
  if (!res.ok) throw Object.assign(new Error(data.error || `서버 오류 (${res.status})`), { code: data.code, data });
  return data;
}
// ── 공용 상태 서버 저장 (3단계): 바뀐 게 있으면 15초마다·닫을 때·앱 끄기 때 올린다. 옛 rev 면 서버 것으로 맞춘다 ──
const SHARED_EVERY = 15000;
let sharedSent = null, sharedBusy = false;
function replaceShared(o) {   // getter 들이 이 객체를 가리키므로 객체는 그대로 두고 내용만 바꾼다
  const f = freshShared();
  for (const k of Object.keys(f)) shared[k] = o && o[k] !== undefined ? o[k] : f[k];
  if (!shared.bld.hall) shared.bld.hall = 1;
}
async function pushShared({ force = false, keepalive = false } = {}) {
  if (!account.online || !account.token || stopped || sharedBusy) return;
  const json = JSON.stringify(shared);
  if (!force && json === sharedSent) return;
  sharedBusy = true;
  try {
    const r = await gapi('PUT', '/api/guilds/shared', { shared, rev: guild.sharedRev || 0 }, true, { keepalive });
    guild.sharedRev = r.rev;
    sharedSent = json;
    saveGuild();
  } catch (e) {
    if (e.code === 'stale' && e.data) {
      replaceShared(e.data.shared);
      guild.sharedRev = e.data.sharedRev;
      guild.at = e.data.sharedAt || srvNow();
      sharedSent = JSON.stringify(shared);
      saveGuild();
      hostToast('🏘️ 다른 기기의 마을 기록으로 맞췄어요');
      refreshHall();
    } else if (e.code === 'moved' || e.code === 'guild-auth') showMoved(e.code);
  } finally { sharedBusy = false; }
}
setInterval(() => pushShared(), SHARED_EVERY);
window.addEventListener('pagehide', () => { pushShared({ keepalive: true }); });

function pushSlots() {
  if (!account.online) return;
  gapi('PUT', '/api/guilds/slots', { slots: guild.slots }).catch((e) => { if (e.code === 'moved') showMoved(); });
}

// ───────────────────────── Electron 창 API 중계 (2단계) ─────────────────────────
// iframe 의 게임은 window.bar 대신 barFor(win) 대리 객체를 쓴다 (src/data.js 맨 위). 창 크기·클릭 영역 같은 요청은 보이는 기사 것만 앱으로 보내고,
// 숨은 기사의 요청은 기억해 뒀다가 그 기사로 바꿀 때 보낸다. 앱 → 게임 신호는 여기서 나눠 준다.
const BAR = window.bar || null;
const barRec = new Map();   // 게임 창 → { win: { key: spec }, interactive, camp, overlay, tray, account, cbs: { 신호: [콜백] } }
const recOf = (win) => { if (!barRec.has(win)) barRec.set(win, { win: {}, cbs: {} }); return barRec.get(win); };
const isShown = (win) => frames[active] && frames[active].el.contentWindow === win;
function barApply(win, on) {
  if (!BAR) return;
  const r = recOf(win);
  for (const [k, spec] of Object.entries(r.win)) BAR.setWindow && BAR.setWindow(k, on ? spec : null);
  if (!on) return;
  sendInteractive();
  if (r.camp !== undefined) BAR.setCampMode(r.camp);
  if (r.overlay !== undefined && BAR.setOverlay) BAR.setOverlay(r.overlay);
  if (r.tray !== undefined && BAR.setTrayTitle) BAR.setTrayTitle(r.tray);
  if (r.account !== undefined) BAR.setAccount(r.account);
}
// 앱 창이 클릭을 받을지: 보이는 기사가 원하거나(HUD 위) 마우스가 바깥의 슬롯 버튼 위에 있을 때
let overSlots = false;
function sendInteractive() {
  if (!BAR) return;
  const f = frames[active], r = f && barRec.get(f.el.contentWindow);
  BAR.setInteractive(overSlots || !!(r && r.interactive));
}
function setOverSlots(v) { if (overSlots !== v) { overSlots = v; sendInteractive(); } }
// 앱: 바깥 페이지는 투명하게(기사 뒤로 바탕화면·다른 창이 비쳐야 함). 로그인·이름 짓기 화면이 떠 있는 동안은
// 창을 화면 전체로 키우고 클릭·키보드를 받는다 — 하단바 150px 에 끼어 있으면 버튼도 못 누르고 입력도 안 된다
if (BAR) {
  document.documentElement.classList.add('app');
  const syncLogin = () => {
    const on = !$('naming').hidden;
    if (BAR.setWindow) BAR.setWindow('guild-login', on ? { height: 'full', focus: true, mouse: 'all' } : null);
    else BAR.setCampMode(on);   // 창 API v2 이전 앱: 크기는 못 바꿔도 클릭·키보드는 받게
  };
  new MutationObserver(syncLogin).observe($('naming'), { attributes: true, attributeFilter: ['hidden'] });
  syncLogin();
}
const each = (sig, ...a) => { for (const [win, r] of barRec) for (const cb of r.cbs[sig] || []) { try { cb(...a); } catch (e) { console.error(e); } } };
const activeCbs = (sig, ...a) => { const f = frames[active]; const r = f && barRec.get(f.el.contentWindow); for (const cb of (r && r.cbs[sig]) || []) cb(...a); };
let flushWait = 0, flushTimer = null;
if (BAR) {
  BAR.onSettings((s) => each('settings', s));
  if (BAR.onDisplay) BAR.onDisplay((d) => each('display', d));
  BAR.onReset(() => activeCbs('reset'));
  BAR.onSwitchAccount(() => { const f = frames[active]; if (f && f.win && f.win.guildApi) f.win.guildApi.openHall(); });
  // 앱을 끄기 전: 모든 기사가 저장·서버 올리기를 마치면(또는 5초) 한 번만 flushed
  BAR.onFlush(() => {
    saveGuild();
    pushShared({ keepalive: true });
    const n = [...barRec.values()].filter((r) => (r.cbs.flush || []).length).length;
    if (!n) { BAR.flushed(); return; }
    flushWait = n;
    const done = setTimeout(() => { if (flushWait > 0) { flushWait = 0; BAR.flushed(); } }, 5000);
    each('flush');
    flushTimer = done;
  });
}
function barFor(win) {
  if (!BAR) return null;
  const r = recOf(win);
  const rec = (k, v, send) => { r[k] = v; if (isShown(win)) send(); };
  const on = (sig) => (cb) => { (r.cbs[sig] = r.cbs[sig] || []).push(cb); };
  return {
    api: BAR.api,
    setWindow: (key, spec) => { r.win[key] = spec || null; if (isShown(win) && BAR.setWindow) BAR.setWindow(key, spec || null); },
    setInteractive: (v) => rec('interactive', v, sendInteractive),
    setCampMode: (v) => rec('camp', v, () => BAR.setCampMode(v)),
    setOverlay: BAR.setOverlay ? (v) => rec('overlay', v, () => BAR.setOverlay(v)) : undefined,
    setTrayTitle: BAR.setTrayTitle ? (v) => rec('tray', v, () => BAR.setTrayTitle(v)) : undefined,
    setAccount: (v) => rec('account', v, () => BAR.setAccount(v)),
    getDisplay: BAR.getDisplay, getCursor: BAR.getCursor,
    onDisplay: on('display'), onSettings: on('settings'), onReset: on('reset'), onSwitchAccount: on('switch'), onFlush: on('flush'),
    flushed: () => { if (flushWait > 0 && --flushWait === 0) { clearTimeout(flushTimer); BAR.flushed(); } },
    quit: () => BAR.quit(),
    reload: () => BAR.reload(),
  };
}

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
  const w = f.el.contentWindow;
  if (w && barRec.has(w)) { if (i === active) barApply(w, false); barRec.delete(w); }
  f.el.remove();
  frames[i] = null;
}
const frameOf = (win) => frames.findIndex((f) => f && f.el.contentWindow === win);
const slotOf = (nick) => guild.slots.findIndex((n) => n === nick);

function pick(i) {
  if (i === active && frames[i]) return;
  // 고르다 만 새 기사 iframe 은 다른 슬롯으로 가면 닫는다
  if (frames[active] && frames[active].nick === NEW && i !== active) kill(active);
  if (frames[active] && i !== active) barApply(frames[active].el.contentWindow, false);   // 앞 기사의 창 요청을 거두고
  active = i;
  if (frames[i]) barApply(frames[i].el.contentWindow, true);                               // 새 기사의 것을 보낸다
  guild.view = i;
  frames.forEach((f, j) => f && f.el.classList.toggle('on', j === i));
  if (frames[i]) frames[i].alert = false;
  hideTip();
  renderSlots();
  saveGuild();
}

// ───────────────────────── 게임 쪽에서 부르는 것 (src/core.js GUILD_HOST) ─────────────────────────
window.guildHost = {
  full: true,
  barFor,
  roster: () => roster,
  // 게임 쪽 서버 요청이 moved(다른 기기 접속) · guild-auth(토큰 끝남)를 받았다 (src/net.js api)
  serverLost(code) {
    if (stopped) return;
    showMoved(code);
  },
  linkGoogle() { showLogin('link'); },
  // ── 5단계: 기사 이름 바꾸기 · 기사 삭제 · 기사단 이름 바꾸기 (회관 화면에서 부른다, 결과는 토스트 글) ──
  async renameKnight(oldN, newN) {
    try {
      const r = await gapi('POST', '/api/me/nickname', { nickname: newN }, true, { char: oldN });
      const nn = r.nickname, i = slotOf(oldN), f = i >= 0 ? frames[i] : null;
      const oldKey = `${SAVE_KEY}:${oldN.toLowerCase()}`, newKey = `${SAVE_KEY}:${nn.toLowerCase()}`;
      if (f && f.win && f.win.guildApi) f.win.guildApi.renamed(nn);   // 돌고 있는 기사는 그 게임이 새 칸에 저장
      else if (oldKey !== newKey) { const v = localStorage.getItem(oldKey); if (v != null) localStorage.setItem(newKey, v); }
      if (oldKey !== newKey) localStorage.removeItem(oldKey);
      if (f) f.nick = nn;
      guild.chars = guild.chars.map((n) => (n === oldN ? nn : n));
      guild.slots = guild.slots.map((n) => (n === oldN ? nn : n));
      serverChars = serverChars.map((c) => (c.nickname === oldN ? { ...c, nickname: nn } : c));
      const acc = readJSON(ACCOUNTS_KEY);
      if (acc && acc.list && acc.list[oldN]) { acc.list[nn] = acc.list[oldN]; delete acc.list[oldN]; if (acc.active === oldN) acc.active = nn; localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(acc)); }
      saveGuild(); updateRoster(); renderSlots(); refreshHall();
      return `✏️ ${oldN} → ${nn}`;
    } catch (e) {
      if (e.code === 'moved' || e.code === 'guild-auth') showMoved(e.code);
      return `⚠️ ${e.message}`;
    }
  },
  async deleteKnight(nick, confirm) {
    if (confirm !== nick) return '⚠️ 이름을 그대로 입력해야 지워져요';
    try {
      const r = await gapi('POST', '/api/guilds/chars/delete', { nickname: nick, confirm });
      const i = slotOf(nick);
      if (i >= 0) {
        if (active === i) { const j = frames.findIndex((f, k) => f && k !== i); if (j >= 0) pick(j); }
        kill(i);
        guild.slots[i] = null;
      }
      localStorage.removeItem(`${SAVE_KEY}:${nick.toLowerCase()}`);
      const acc = readJSON(ACCOUNTS_KEY);
      if (acc && acc.list && acc.list[nick]) { delete acc.list[nick]; if (acc.active === nick) acc.active = null; localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(acc)); }
      guild.chars = guild.chars.filter((n) => n !== nick);
      serverChars = r.guild.chars;
      // 슬롯에 아무도 없게 됐으면 남은 첫 기사를 1번에
      if (!frames.some(Boolean) && guild.chars.length) { guild.slots[0] = guild.chars[0]; spawn(0, guild.chars[0]); active = -1; pick(0); pushSlots(); }
      saveGuild(); updateRoster(); renderSlots(); refreshHall();
      hostToast(`🗑️ <b>${esc(nick)}</b> 를 지웠어요`);   // 보던 기사를 지웠으면 그 화면은 이미 닫혀서 바깥에서 알린다
      return `🗑️ ${nick} 를 지웠어요`;
    } catch (e) {
      if (e.code === 'moved' || e.code === 'guild-auth') showMoved(e.code);
      return `⚠️ ${e.message}`;
    }
  },
  async renameGuild(name) {
    try {
      const r = await gapi('POST', '/api/guilds/name', { name });
      guild.name = r.name;
      saveGuild(); refreshHall();
      return `🛡️ 기사단 이름을 「${r.name}」 으로 바꿨어요`;
    } catch (e) {
      if (e.code === 'moved' || e.code === 'guild-auth') showMoved(e.code);
      return `⚠️ ${e.message}`;
    }
  },
  async linkConfirm(code) {
    try {
      await gapi('POST', '/api/link/confirm', { code });
      setTimeout(showMoved, 1500);
      return '📱 기기를 연결했어요 — 이제 그 기기에서 이어 해요';
    } catch (e) { return `⚠️ ${e.message}`; }
  },   // 시제품(dev/guild-spike.html)과 구별 — 건설 시계·회관·알림 모으기를 켠다
  bindShared(S) {
    // 열거 안 함(3단계): 기사 세이브(JSON)에는 기사별 값만 남고 공용 값은 기사단(guild.shared → 서버)에만 있다
    Object.defineProperty(S, 'gold', { get: () => shared.gold, set: (v) => { shared.gold = v; }, enumerable: false, configurable: true });
    for (const k of ['wood', 'ore']) Object.defineProperty(S.mats, k, { get: () => shared[k], set: (v) => { shared[k] = v; }, enumerable: false, configurable: true });
    for (const k of ['bld', 'stock', 'forge', 'build']) Object.defineProperty(S, k, { get: () => shared[k], set: (v) => { shared[k] = v; }, enumerable: false, configurable: true });
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
    pushSlots();
    renderSlots();
  },
  list() {
    return {
      name: guild.name || '기사단', max: GUILD_MAX, open: openSlots(), slots: guild.slots.slice(), online: account.online, google: account.google,
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
    pushSlots();
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
  if (stopped) return;
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
    const now = srvNow();
    try { ok = f.win.guildApi.tickBuild((now - guild.at) / 1000); } catch {}
    if (ok) { guild.at = now; break; }
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
  else if (r.top - bar.offsetHeight - 3 >= 0) { bar.style.left = `${Math.round(r.left)}px`; bar.style.top = `${Math.round(r.top - bar.offsetHeight - 3)}px`; }
  else {
    // 앱 하단바(150px 창)처럼 HUD 위에 자리가 없으면 창 밖으로 나가 안 보인다 — HUD 옆(왼쪽, 모자라면 오른쪽)에 붙인다
    const w = bar.offsetWidth, left = r.left - w - 6 >= 4 ? r.left - w - 6 : r.right + 6;
    bar.style.left = `${Math.round(left)}px`;
    bar.style.top = `${Math.round(Math.max(0, r.top + r.height - bar.offsetHeight))}px`;
  }
  bar.hidden = false;
}
function readInfo() {
  frames.forEach((f) => { if (f && f.win && f.win.guildApi) { try { f.info = f.win.guildApi.info(); } catch {} } });
  updateRoster();
}
// 기사단 명단 (4단계 기사단 효과): 서버 기사 목록(슬롯 밖 기사 포함)에 살아 있는 기사의 지금 직업·Lv 를 덮는다. 바뀔 때만 rev+1
const roster = { list: [], rev: 0, sig: '' };
let serverChars = [];
function updateRoster() {
  const m = new Map(serverChars.map((c) => [c.nickname, { nick: c.nickname, cls: c.cls, lv: c.level }]));
  frames.forEach((f) => { if (f && f.info && f.info.nick) m.set(f.info.nick, { nick: f.info.nick, cls: f.info.clsId, lv: f.info.lv }); });
  for (const n of m.keys()) if (!guild.chars.includes(n)) m.delete(n);
  const list = [...m.values()], sig = JSON.stringify(list);
  if (sig !== roster.sig) { roster.list = list; roster.sig = sig; roster.rev++; }
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
$('slots').addEventListener('mouseleave', () => { hideTip(); setOverSlots(false); });   // 버튼에서 벗어나면 보는 기사의 클릭 영역으로
$('slots').addEventListener('mouseenter', () => setOverSlots(true));   // Electron: 버튼 위에선 창이 클릭을 받게
// 어떤 Windows PC 는 클릭 통과 중인 창에 마우스 이동이 안 들어와서 mouseenter 가 안 온다 — 커서 위치를 직접 물어본다 (기사 iframe 의 ui.js 도 같은 방식)
if (BAR && BAR.getCursor && BAR.getDisplay) {
  BAR.getDisplay().then((d) => {
    if (!d || d.platform !== 'win32') return;
    let busy = false;
    setInterval(async () => {
      if (busy) return;
      if ($('slots').hidden) { setOverSlots(false); return; }
      busy = true;
      try {
        const c = await BAR.getCursor();
        const el = document.elementFromPoint(c.x, c.y);
        setOverSlots(!!(el && el.closest('#slots')));
      } catch {}
      busy = false;
    }, 100);
  }, () => {});
}
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

// ───────────────────────── 시작 · 로그인 (2단계) ─────────────────────────
function start() {
  if (started) return;
  started = true;
  if (!guild.chars.length) { spawn(0, NEW); active = 0; }
  guild.slots.forEach((nick, i) => { if (nick && i < openSlots()) spawn(i, nick); });
  if (!frames[active]) active = frames.findIndex(Boolean);
  frames.forEach((f, j) => f && f.el.classList.toggle('on', j === active));
  renderSlots();
  saveGuild();
  requestAnimationFrame(tick);
}
let started = false;

// 서버 기사단을 이 기기 기록에 덮는다: 이름·기사 목록·슬롯은 서버가 기준 (공용 상태는 3단계까지 이 기기)
function applyServer(v) {
  // 공용 상태: 서버 rev 가 더 크면 서버 것(다른 기기에서 이어 받기 — 건설은 서버가 저장한 시각부터 흐른다), 아니면 이 기기 것을 올린다
  if ((v.sharedRev || 0) > (guild.sharedRev || 0) && v.shared) {
    replaceShared(v.shared);
    guild.sharedRev = v.sharedRev;
    guild.at = v.sharedAt;
    sharedSent = JSON.stringify(shared);
  } else {
    if (guild.clock !== 'srv') guild.at = srvNow();   // 2단계까지의 기기 시계 기준 → 서버 시각 기준으로 한 번 옮긴다
    guild.sharedRev = v.sharedRev || 0;
    setTimeout(() => pushShared({ force: true }), 0);
  }
  guild.clock = 'srv';
  guild.name = v.name;
  account.google = !!v.google;
  const names = v.chars.map((c) => c.nickname);
  guild.chars = names;
  serverChars = v.chars;
  updateRoster();
  if (v.slots.some(Boolean)) guild.slots = v.slots.map((n) => (n && names.includes(n) ? n : null));
  else {
    // 서버 슬롯이 비어 있으면: 이 기기의 슬롯 중 서버 기사만 남기고, 그래도 비면 첫 기사를 1번에
    guild.slots = guild.slots.map((n) => (n && names.includes(n) ? n : null));
    if (!guild.slots.some(Boolean) && names.length) guild.slots[0] = names[0];
    pushSlots();
  }
  saveGuild();
}

async function boot() {
  if (!account.token) {
    // 서버 기사단이 없다: 1단계(이 기기 안 기사단)를 쓰던 기기도 로그인 화면부터 — 로그인하면 그 기사들을 서버 기사단에 넣는다
    return showLogin('choose');
  }
  try {
    applyServer(await gapi('GET', '/api/guilds/me'));
    account.online = true;
  } catch (e) {
    if (e.code === 'moved') return showMoved();
    if (e.code === 'guild-auth') return showMoved('guild-auth');
    // 서버가 안 닿는다 (잠들어 깨는 중·오프라인): 이 기기 기록으로 시작하고, 기사들은 지금처럼 나중에 동기화
    account.online = true;
    hostToast(`⚠️ ${esc(e.message)} — 이 기기의 기록으로 계속해요`);
  }
  start();
}

// 기사단 토큰을 받은 뒤: 이 기기에 있던 개인 토큰 기사(1단계 기사단·예전 계정)를 서버 기사단에 넣고 시작
async function enterGuild(token) {
  setToken(token);
  const acc = Object.assign({ list: {} }, readJSON(ACCOUNTS_KEY));
  const local = guild.chars.length ? guild.chars : acc.active ? [acc.active] : [];
  for (const n of local) {
    const t = acc.list[n];
    if (!t || t.startsWith('g.')) continue;
    // 시즌 리셋 뒤엔 예전 기사가 서버에 없어서 실패한다 — 알리지 않고 넘긴다
    try { await gapi('POST', '/api/guilds/adopt', { nickname: n, token: t }); } catch (e) { console.info('adopt 건너뜀', n, e.message); }
  }
  $('naming').hidden = true;
  return boot();
}

// 로그인 화면: Google · 손님 · 기기 연결 코드(앱). step: choose | name(이름 짓기) | code(연결 코드 표시) | link(손님에 Google 연결)
let loginTicket = null, linkPoll = null;
function showLogin(step, msg = '') {
  const box = $('naming').querySelector('.box');
  $('naming').hidden = false;
  clearInterval(linkPoll);
  if (step === 'choose') {
    box.innerHTML = `<h2>🛡️ 기사단</h2>
      <p>기사 여러 명을 한 기사단에서 함께 키워요. Google 로 시작하면 어느 기기에서든 이어 할 수 있어요.</p>
      <div id="gsi" class="gsi"></div>
      <div class="row"><button class="ghost" id="lgGuest">손님으로 시작</button><button class="ghost" id="lgCode">기기 연결 코드로 시작</button></div>
      <p class="tiny">손님도 나중에 🛡️ 기사단 회관에서 Google 을 연결할 수 있어요. 앱에서는 "기기 연결 코드" 로 웹에서 로그인한 기사단을 가져와요.</p>
      <div class="msg">${esc(msg)}</div>`;
    renderGoogle($('gsi'), async (idToken) => {
      try {
        const r = await gapi('POST', '/api/auth/google', { idToken, deviceId: DEVICE }, false);
        if (r.token) return enterGuild(r.token);
        loginTicket = r.ticket;
        showLogin('name');
      } catch (e) { showLogin('choose', e.message); }
    });
    $('lgGuest').onclick = () => { loginTicket = null; showLogin('name'); };
    $('lgCode').onclick = () => showLogin('code');
  } else if (step === 'name') {
    box.innerHTML = `<h2>🛡️ 기사단 이름을 지어 주세요</h2>
      <p>${loginTicket ? 'Google 계정에 새 기사단을 만들어요.' : '손님 기사단을 만들어요 — 이 기기에서만 이어지고, 나중에 Google 을 연결할 수 있어요.'} 이름은 다른 기사단과 겹칠 수 없어요.</p>
      <div class="row"><input id="gname" maxlength="12" placeholder="한글·영문·숫자 2~12자" autocomplete="off" spellcheck="false" value="${esc(guild.name || '')}"><button id="gnameGo">시작</button></div>
      <div class="row"><button class="ghost" id="lgBack">← 처음으로</button></div>
      <div class="msg" id="gnameMsg">${esc(msg)}</div>`;
    const go = async () => {
      const v = $('gname').value.trim();
      if (!NAME_RE.test(v)) { $('gnameMsg').textContent = '한글·영문·숫자 2~12자로 지어 주세요'; return; }
      $('gnameMsg').textContent = '⏳ 만드는 중… 서버가 잠들어 있었다면 1분쯤 걸려요';
      try {
        const r = await gapi('POST', '/api/guilds', { name: v, ticket: loginTicket, deviceId: DEVICE }, false);
        await enterGuild(r.token);
      } catch (e) { $('gnameMsg').textContent = e.message; }
    };
    $('gnameGo').onclick = go;
    $('gname').addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
    $('lgBack').onclick = () => showLogin('choose');
    setTimeout(() => $('gname').focus(), 50);
  } else if (step === 'code') {
    box.innerHTML = `<h2>📱 기기 연결</h2><p>코드를 받는 중…</p><div class="row"><button class="ghost" id="lgBack">← 처음으로</button></div><div class="msg">${esc(msg)}</div>`;
    $('lgBack').onclick = () => showLogin('choose');
    gapi('POST', '/api/link/start', { deviceId: DEVICE }, false).then((r) => {
      box.querySelector('p').innerHTML = `<b class="code">${r.code.slice(0, 3)} ${r.code.slice(3)}</b><br>
        아무 브라우저에서 게임 웹 주소를 열고 Google 로 로그인한 뒤, 🛡️ 기사단 회관 → <b>기기 연결</b> 에 이 코드를 넣어 주세요. (10분 동안 유효)`;
      linkPoll = setInterval(async () => {
        try {
          const p = await gapi('GET', `/api/link/poll?id=${encodeURIComponent(r.id)}`, null, false);
          if (p.token) { clearInterval(linkPoll); enterGuild(p.token); }
        } catch (e) { clearInterval(linkPoll); showLogin('choose', e.message); }
      }, 3000);
    }, (e) => showLogin('choose', e.message));
  } else if (step === 'link') {
    box.innerHTML = `<h2>🛡️ Google 연결</h2><p>이 손님 기사단에 Google 계정을 연결해요. 그다음부터는 어느 기기에서든 Google 로그인으로 이어 할 수 있어요.</p>
      <div id="gsi" class="gsi"></div><div class="row"><button class="ghost" id="lgBack">닫기</button></div><div class="msg">${esc(msg)}</div>`;
    $('lgBack').onclick = () => { $('naming').hidden = true; };
    renderGoogle($('gsi'), async (idToken) => {
      try {
        await gapi('POST', '/api/auth/google', { idToken });
        account.google = true;
        $('naming').hidden = true;
        hostToast('✅ Google 을 연결했어요');
        refreshHall();
      } catch (e) { showLogin('link', e.message); }
    });
  }
}

// Google 버튼: 클라이언트 ID 가 있으면 Google Identity Services, ?fakegoogle=1 이면 개발용 가짜 로그인(서버 GOOGLE_FAKE=1 일 때만 통과)
let gsiLoad = null;
function renderGoogle(el, onToken) {
  if (FAKE_GOOGLE) {
    el.innerHTML = '<div class="row"><input id="fakeSub" placeholder="가짜 Google 이름 (개발)" autocomplete="off"><button id="fakeGo">가짜 Google 로그인</button></div>';
    $('fakeGo').onclick = () => { const v = $('fakeSub').value.trim(); if (v) onToken(`fake:${v}`); };
    return;
  }
  if (!GOOGLE_CLIENT_ID) { el.innerHTML = '<p class="tiny">Google 로그인은 준비 중이에요 — 지금은 손님으로 시작할 수 있어요.</p>'; return; }
  gsiLoad = gsiLoad || new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.onload = res; s.onerror = () => rej(new Error('Google 로그인을 불러오지 못했어요'));
    document.head.appendChild(s);
  });
  gsiLoad.then(() => {
    google.accounts.id.initialize({ client_id: GOOGLE_CLIENT_ID, callback: (r) => onToken(r.credential) });
    google.accounts.id.renderButton(el, { theme: 'filled_black', size: 'large', text: 'continue_with', locale: 'ko', width: 280 });
  }, (e) => { el.innerHTML = `<p class="tiny">${esc(e.message)} — 게임 모음 사이트처럼 Google 이 막힌 곳이면 손님으로 시작하거나 기기 연결 코드를 써 주세요.</p>`; });
}

// 다른 기기에서 접속했다: 모두 멈추고(이 기기 기록은 저장) 안내.
// moved = 연결 코드·"이 기기에서 계속" 으로 기사단이 다른 기기로 갔다 (토큰은 그대로 → 이 기기에서 계속).
// guild-auth = 다른 기기에서 Google 로 다시 로그인해 이 기기 토큰이 끝났다 (→ 다시 로그인)
let stopped = false;
function showMoved(code = 'moved') {
  stopped = true;
  for (let i = 0; i < frames.length; i++) kill(i);
  saveGuild();
  $('slots').hidden = true;
  const box = $('naming').querySelector('.box');
  $('naming').hidden = false;
  box.innerHTML = `<h2>📱 다른 기기에서 기사단에 접속했어요</h2>
    <p>한 기사단은 한 기기에서만 진행돼요. 여기서 하던 건 저장했어요.${code === 'moved' ? '' : ' 다른 기기에서 다시 로그인해서 이 기기의 로그인은 끝났어요.'}</p>
    <div class="row"><button id="mvGo">${code === 'moved' ? '이 기기에서 계속' : '다시 로그인'}</button></div><div class="msg" id="mvMsg"></div>`;
  $('mvGo').onclick = async () => {
    if (code !== 'moved') { setToken(null); location.reload(); return; }
    try { await gapi('POST', '/api/guilds/device', { deviceId: DEVICE }); location.reload(); } catch (e) { $('mvMsg').textContent = e.message; }
  };
}

boot();
