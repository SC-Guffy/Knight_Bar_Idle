'use strict';
// 서버 통신: 계정(닉네임 + 토큰), 세이브 동기화, 랭킹, 결투. 화면은 모르고 ui.js 가 불러 쓴다.
// 세이브는 로컬(localStorage)에 먼저 쓰고, 바뀐 게 있으면 주기적으로 서버에 올린다. 오프라인이어도 게임은 계속된다.

const DEFAULT_SERVER = 'https://knight-bar.onrender.com';
const SERVER = (new URLSearchParams(location.search).get('server') || DEFAULT_SERVER).replace(/\/+$/, '');
const ACCOUNTS_KEY = 'knight-bar-accounts';
const SYNC_EVERY = 30000;

class ApiError extends Error {
  constructor(message, status) { super(message); this.status = status; }
}

// timeout: Render 무료 플랜은 잠들어 있다가 첫 요청에 깨어나느라 30~60초 걸릴 수 있다
async function api(method, path, body, { token, timeout = 20000, keepalive = false } = {}) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeout);
  try {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(SERVER + path, {
      method, headers, body: body ? JSON.stringify(body) : undefined, signal: ctl.signal, keepalive,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new ApiError(data.error || `서버 오류 (${res.status})`, res.status);
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
  try { localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts)); } catch {}
}
const activeNick = () => accounts.active;
const activeToken = () => (accounts.active ? accounts.list[accounts.active] : null);
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

// ───────────────────────── 계정 API ─────────────────────────
const checkNickname = (name) => api('GET', `/api/nickname?name=${encodeURIComponent(name)}`, null, { timeout: 70000 });

async function createAccount(nickname, state, profile) {
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
      await api('PUT', '/api/me', body, { token, keepalive: true });
      sync.lastOk = Date.now();
      sync.error = null;
    } catch (e) {
      if (token === activeToken()) sync.dirty = true;
      sync.error = e.message;
    }
  })();
  await sync.busy;
  sync.busy = null;
}
setInterval(() => pushSave(), SYNC_EVERY);

// ───────────────────────── 랭킹 / 결투 ─────────────────────────
const fetchRanking = (sort) => api('GET', `/api/ranking?sort=${sort}&limit=100`, null, { token: activeToken(), timeout: 70000 });

async function requestDuel(opponent) {
  await pushSave(true);                       // 내 최신 능력치로 싸우도록
  return api('POST', '/api/duels', { opponent }, { token: activeToken(), timeout: 70000 });
}
