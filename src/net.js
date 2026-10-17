'use strict';
// 서버 통신: 계정(닉네임 + 토큰), 세이브 동기화, 랭킹, 결투. 화면은 모르고 ui.js 가 불러 쓴다.
// 세이브는 로컬(localStorage)에 먼저 쓰고, 바뀐 게 있으면 주기적으로 서버에 올린다. 오프라인이어도 게임은 계속된다.

const DEFAULT_SERVER = 'https://knight-bar.onrender.com';
const SERVER = (new URLSearchParams(location.search).get('server') || DEFAULT_SERVER).replace(/\/+$/, '');
const ACCOUNTS_KEY = 'knight-bar-accounts';
const SYNC_EVERY = 30000;

class ApiError extends Error {
  constructor(message, status, code) { super(message); this.status = status; this.code = code; }
}

// timeout: Render 무료 플랜은 잠들어 있다가 첫 요청에 깨어나느라 30~60초 걸릴 수 있다
async function api(method, path, body, { token, timeout = 20000, keepalive = false } = {}) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeout);
  try {
    const headers = { 'Content-Type': 'application/json', 'X-Game-Version': GAME_VERSION };   // 서버가 예전 버전 클라이언트를 막을 때 쓴다 (레이드 등)
    if (token) headers.Authorization = `Bearer ${token}`;
    // 기사단 토큰(docs/specs/guild.md 2단계): 어느 기사인지 X-Char, 어느 기기인지 X-Device (한 기사단은 한 기기에서만)
    if (token && token.startsWith('g.')) { headers['X-Char'] = encodeURIComponent(activeNick() || ''); headers['X-Device'] = guildDeviceId(); }
    const res = await fetch(SERVER + path, {
      method, headers, body: body ? JSON.stringify(body) : undefined, signal: ctl.signal, keepalive,
    });
    setServerTime(Number(res.headers.get('X-Server-Time')));   // 하루 기준·오프라인 시간은 서버 시각으로 (src/data.js gameNow)
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      // 지금 플레이 중인 기사가 서버에서 지워졌다 (전체 초기화) → ui.js 가 이 기기의 기사를 지우고 처음 화면으로 보낸다
      if (data.code === 'gone' && token && token === activeToken()) hooks.onAccountGone();
      // 서버가 이 버전을 더는 받지 않는다 (426, server/index.js requireClient) → ui.js 가 저장하고 새 버전으로 다시 불러온다
      if (res.status === 426) hooks.onOutdated();
      // 기사단: 다른 기기에서 접속(moved) · 기사단 토큰이 끝남(guild-auth) → 바깥 페이지(src/guild.js)가 멈추고 안내한다
      if (GUILD_HOST && GUILD_HOST.full && (data.code === 'moved' || data.code === 'guild-auth') && token && token.startsWith('g.')) GUILD_HOST.serverLost(data.code);
      throw new ApiError(data.error || `서버 오류 (${res.status})`, res.status, data.code);
    }
    return data;
  } catch (e) {
    if (e instanceof ApiError) throw e;
    throw new ApiError(e.name === 'AbortError' ? '서버가 응답하지 않아요' : '서버에 연결할 수 없어요', 0);
  } finally {
    clearTimeout(timer);
  }
}

// ───────────────────────── 이 기기의 계정 목록 ─────────────────────────
// { active: '닉네임', list: { '닉네임': 토큰 } }
let accounts = (() => {
  try { return Object.assign({ active: null, list: {} }, JSON.parse(localStorage.getItem(ACCOUNTS_KEY))); } catch { return { active: null, list: {} }; }
})();
function saveAccounts() {
  try {
    // 기사단 iframe: 같은 localStorage 를 여러 기사가 같이 쓰므로 active 는 건드리지 않고 토큰 목록만 더한다
    if (GUILD_CHAR) {
      const cur = Object.assign({ active: null, list: {} }, JSON.parse(localStorage.getItem(ACCOUNTS_KEY)));
      Object.assign(cur.list, accounts.list);
      localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(cur));
      return;
    }
    localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
  } catch {}
}
// 기사단: iframe 마다 ?char=닉네임 으로 자기 기사를 고른다 (같은 localStorage 를 같이 쓰므로 active 를 덮어쓰지 않는다)
const GUILD_CHAR = new URLSearchParams(location.search).get('char');
// '+new' = 기사단 회관의 "새 기사" — 닉네임 창부터 연다 (src/guild.js newKnight)
const GUILD_NEW = GUILD_CHAR === '+new';
if (GUILD_CHAR) accounts.active = GUILD_NEW ? null : GUILD_CHAR;
const activeNick = () => accounts.active;
// 기사단 모드에서 서버 기사단에 들어가 있으면(바깥 페이지가 저장한 기사단 토큰) 모든 기사가 그 토큰을 쓴다
const GUILD_TOKEN_KEY = 'knight-bar-guild-token';
const guildToken = () => { try { return GUILD_CHAR !== null && localStorage.getItem(GUILD_TOKEN_KEY) || null; } catch { return null; } };
const guildDeviceId = () => { try { return localStorage.getItem('knight-bar-device') || ''; } catch { return ''; } };
const activeToken = () => (accounts.active ? guildToken() || accounts.list[accounts.active] : null);
const accountSaveKey = (nick) => `${SAVE_KEY}:${nick.toLowerCase()}`;

function rememberAccount(nick, token) {
  accounts.list[nick] = token;
  accounts.active = nick;
  saveAccounts();
}
function setActiveAccount(nick) {
  accounts.active = nick;
  saveAccounts();
}
// 전체 초기화: 이 기기의 모든 기사(계정 목록과 세이브)를 지운다
function forgetAllAccounts() {
  accounts = { active: null, list: {} };
  try {
    for (const k of Object.keys(localStorage)) if (k === SAVE_KEY || k.startsWith(SAVE_KEY + ':')) localStorage.removeItem(k);
  } catch {}
  saveAccounts();
}

// ───────────────────────── 계정 API ─────────────────────────
const checkNickname = (name) => api('GET', `/api/nickname?name=${encodeURIComponent(name)}`, null, { timeout: 70000 });

async function createAccount(nickname, state, profile) {
  // 서버 기사단 안의 새 기사: 기사단 토큰으로 만들고, 개인 토큰은 없다 (이 기사도 기사단 토큰 + X-Char 로 움직인다)
  if (guildToken()) {
    const r = await api('POST', '/api/guilds/chars', { nickname, state, profile }, { token: guildToken(), timeout: 70000 });
    accounts.active = r.nickname;
    return r;
  }
  const r = await api('POST', '/api/accounts', { nickname, state, profile }, { timeout: 70000 });
  rememberAccount(r.nickname, r.token);
  return r;
}

// 다른 기기에서 쓰던 기사를 복구 코드(토큰)로 가져온다
async function importAccount(nickname, token) {
  const r = await api('GET', '/api/me', null, { token, timeout: 70000 });
  if (r.nickname.toLowerCase() !== String(nickname).trim().toLowerCase()) throw new ApiError('닉네임과 복구 코드가 맞지 않아요', 401);
  rememberAccount(r.nickname, token);
  return r;
}

const fetchMe = (token = activeToken()) => api('GET', '/api/me', null, { token, timeout: 70000 });

// 플레이 중인 기사의 닉네임 바꾸기 (하루 한 번). 토큰은 그대로라 이 기기의 계정 목록과 세이브 칸만 새 이름으로 옮긴다
async function renameAccount(nickname) {
  const old = accounts.active, token = activeToken();
  const r = await api('POST', '/api/me/nickname', { nickname }, { token, timeout: 70000 });
  const from = accountSaveKey(old), to = accountSaveKey(r.nickname);
  if (from !== to) {
    try {
      const v = localStorage.getItem(from);
      if (v != null) localStorage.setItem(to, v);
      localStorage.removeItem(from);
    } catch {}
  }
  accounts.list = Object.fromEntries(Object.entries(accounts.list).map(([n, t]) => [n === old ? r.nickname : n, t]));   // 목록 순서는 그대로
  setActiveAccount(r.nickname);
  return { ...r, saveKey: to };
}

// ───────────────────────── 세이브 동기화 ─────────────────────────
const sync = { dirty: false, busy: null, lastOk: 0, error: null };
hooks.onSave = () => { sync.dirty = true; };

// force=true 면 바뀐 게 없어도 올린다 (결투 직전처럼 서버 프로필이 최신이어야 할 때)
async function pushSave(force = false) {
  const token = activeToken();
  if (!token) return;
  if (sync.busy) { await sync.busy; if (!force && !sync.dirty) return; }
  if (!force && !sync.dirty) return;
  sync.dirty = false;
  const body = { state: S, profile: profile() };
  sync.busy = (async () => {
    try {
      const r = await api('PUT', '/api/me', body, { token, keepalive: true });
      sync.lastOk = Date.now();
      sync.error = null;
      if (r && r.penalties && token === activeToken()) applyPenalties(r.penalties, token);
    } catch (e) {
      if (token === activeToken()) sync.dirty = true;
      sync.error = e.message;
    }
  })();
  await sync.busy;
  sync.busy = null;
}
setInterval(() => pushSave(), SYNC_EVERY);

// 운영 차감(서버 /api/admin/penalty): 세이브에서 빼고 안내한 뒤 서버에 반영했다고 알린다. 이미 뺀 id 는 S.penDone 으로 건너뛴다
function applyPenalties(list, token) {
  const ids = [];
  for (const p of list) {
    if (applyPenalty(p)) hooks.onPenalty(p);
    ids.push(p.id);
  }
  save();
  api('POST', '/api/me/penalty/ack', { ids }, { token }).catch(() => {});
}

// ───────────────────────── 랭킹 / 결투 ─────────────────────────
const fetchRanking = (sort) => api('GET', `/api/ranking?sort=${sort}&limit=100`, null, { token: activeToken(), timeout: 70000 });

async function requestDuel(opponent) {
  await pushSave(true);                       // 내 최신 능력치로 싸우도록
  return api('POST', '/api/duels', { opponent }, { token: activeToken(), timeout: 70000 });
}

// 🎓 교관 승부 (2차 훈련 ★5): 미리보기(지금 내 레벨에서 교관 전투력) / 승부 (저장된 최신 능력치로 싸우도록 먼저 올린다)
const fetchMentor = (i) => api('GET', `/api/mentor?i=${i}`, null, { token: activeToken(), timeout: 70000 });
async function requestMentorDuel(i) {
  await pushSave(true);
  return api('POST', '/api/mentor/duel', { i }, { token: activeToken(), timeout: 70000 });
}

// 받은 결투(우편함): 다른 기사가 나에게 건 최근 결투들 (새 것부터)
const fetchDuelInbox = () => api('GET', '/api/duels/inbox', null, { token: activeToken(), timeout: 70000 });

// 결투 시즌: 이번 시즌 정보 · 내 기록 · 지난 시즌 결과 · 아직 안 받은 시즌 보상
const fetchSeason = () => api('GET', '/api/season', null, { token: activeToken(), timeout: 70000 });
const ackSeason = (seasons) => api('POST', '/api/season/ack', { seasons }, { token: activeToken() });

// 월드 보스: 오늘의 보스·내 피해·순위·아직 안 받은 지난 보상 / 도전 (저장된 최신 능력치로 싸우도록 먼저 올린다) / 보상 받음 표시
const fetchWorldBoss = () => api('GET', '/api/worldboss', null, { token: activeToken(), timeout: 70000 });
async function attackWorldBoss() {
  await pushSave(true);
  return api('POST', '/api/worldboss/attack', {}, { token: activeToken(), timeout: 70000 });
}
const ackWorldBoss = (days) => api('POST', '/api/worldboss/ack', { days }, { token: activeToken() });

// ───────────────────────── 보스 레이드 로비 ─────────────────────────
// 방 상태는 서버 메모리에 있고, 방에 있는 동안 주기적으로 물어봐서 파티원·준비·출정 결과를 받는다 (ui.js 의 raidPoll)
const raidCall = (method, path, body, timeout = 20000) => api(method, path, body, { token: activeToken(), timeout });
const fetchRaids = () => raidCall('GET', '/api/raids', null, 70000);
const fetchMyRaid = () => raidCall('GET', '/api/raids/me');
const createRaid = (boss) => raidCall('POST', '/api/raids', { boss }, 70000);
const joinRaid = (id) => raidCall('POST', '/api/raids/join', { id }, 70000);
const leaveRaid = () => raidCall('POST', '/api/raids/leave', {});
// 준비·출정 전에 세이브를 올린다 — 서버가 저장된 입장권 수를 확인한다
const readyRaid = async (ready) => { if (ready) await pushSave(true); return raidCall('POST', '/api/raids/ready', { ready }); };
const setRaidBoss = (boss) => raidCall('POST', '/api/raids/boss', { boss });
const kickRaid = (nickname) => raidCall('POST', '/api/raids/kick', { nickname });
const fillRaid = () => raidCall('POST', '/api/raids/fill', {}, 70000);   // 빈자리를 AI 기사로 (server/bots.js)
const startRaid = async () => { await pushSave(true); return raidCall('POST', '/api/raids/start', {}, 70000); };
const againRaid = () => raidCall('POST', '/api/raids/again', {});

// 서버 확성기: +20 이상 강화 성공 · 초기화를 모두에게 알린다 / after 이후 소식 받기 (ui.js 의 loadShouts)
const postShout = (body) => api('POST', '/api/shouts', body, { token: activeToken() });
const fetchShouts = (after) => api('GET', `/api/shouts?after=${after}`, null, { timeout: 70000 });
