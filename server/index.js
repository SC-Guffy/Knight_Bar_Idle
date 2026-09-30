'use strict';
// Knight Bar 서버: 계정(닉네임) · 세이브 동기화 · 랭킹 · 결투.
// 의존성은 pg 하나뿐이라 http 모듈로 직접 라우팅한다.

const http = require('http');
const crypto = require('crypto');
const { openStore, TakenError } = require('./store');
const { simulateDuel, eloDelta } = require('./duel');

const PORT = Number(process.env.PORT) || 3000;
const MAX_BODY = 256 * 1024;
const DUEL_COOLDOWN_MS = 5000;
const START_RATING = 1000;

const store = openStore();

// ───────────────────────── 유틸 ─────────────────────────
class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

// 한글·영문·숫자·_ 2~12자. 대소문자만 다른 닉네임은 같은 닉네임으로 본다.
function nicknameKey(raw) {
  const nick = String(raw || '').normalize('NFC').trim();
  if (!/^[가-힣a-zA-Z0-9_]{2,12}$/.test(nick)) {
    throw new HttpError(400, '닉네임은 한글·영문·숫자·_ 2~12자로 지어 주세요');
  }
  return { nick, key: nick.toLowerCase() };
}

const hashToken = (t) => crypto.createHash('sha256').update(String(t)).digest('hex');

const num = (v, min, max, dflt) => {
  const n = v == null || v === '' ? NaN : Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : dflt;
};

// 클라이언트가 계산해서 올린 전투 프로필. 결투·랭킹에만 쓰므로 범위만 확인한다.
function sanitizeProfile(p = {}) {
  const leap = p.leap && typeof p.leap === 'object'
    ? { every: num(p.leap.every, 1, 60, 6), mult: num(p.leap.mult, 0, 20, 1) } : null;
  return {
    cls: typeof p.cls === 'string' ? p.cls.slice(0, 24) : 'squire',
    level: Math.floor(num(p.level, 1, 1e6, 1)),
    best: Math.floor(num(p.best, 1, 1e6, 1)),
    atk: num(p.atk, 0, 1e30, 5),
    maxHp: num(p.maxHp, 1, 1e30, 60),
    aspd: num(p.aspd, 0.1, 20, 0.9),
    crit: num(p.crit, 0, 1, 0.05),
    critMult: num(p.critMult, 1, 10, 2.5),
    range: num(p.range, 0, 400, 14),
    shots: Math.floor(num(p.shots, 1, 5, 1)),
    shotMult: num(p.shotMult, 0, 5, 1),
    guard: num(p.guard, 0, 0.9, 0),
    heal: num(p.heal, 0, 0.2, 0),
    leap,
    power: Math.floor(num(p.power, 0, 1e30, 0)),
  };
}

// 랭킹·결투 목록에 보여 줄 공개 정보
const publicInfo = (a) => ({
  nickname: a.nickname, cls: a.cls, level: a.level, best: a.best, power: a.power,
  rating: a.rating, wins: a.wins, losses: a.losses, updatedAt: a.updatedAt,
});

function send(res, status, body) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
  });
  res.end(body === undefined ? '' : JSON.stringify(body));
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY) { reject(new HttpError(413, '데이터가 너무 큽니다')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      if (!chunks.length) return resolve({});
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); } catch { reject(new HttpError(400, 'JSON 형식이 아닙니다')); }
    });
    req.on('error', reject);
  });
}

async function auth(req) {
  const m = /^Bearer (.+)$/.exec(req.headers.authorization || '');
  const acc = m && await store.byToken(hashToken(m[1]));
  if (!acc) throw new HttpError(401, '계정 인증에 실패했어요');
  return acc;
}

// ───────────────────────── 라우트 ─────────────────────────
const lastDuel = new Map();   // key → 마지막 결투 시각

const routes = {
  'GET /health': async () => ({ ok: true, players: await store.count() }),

  // 닉네임 사용 가능 여부
  'GET /api/nickname': async (_req, url) => {
    const { key } = nicknameKey(url.searchParams.get('name'));
    return { available: !(await store.get(key)) };
  },

  // 새 기사 만들기. state 를 같이 보내면 그 진행으로 시작한다 (기존 로컬 세이브 이전)
  'POST /api/accounts': async (req) => {
    const body = await readJson(req);
    const { nick, key } = nicknameKey(body.nickname);
    const token = crypto.randomBytes(24).toString('base64url');
    const now = Date.now();
    const profile = sanitizeProfile(body.profile);
    try {
      await store.create({
        key, nickname: nick, tokenHash: hashToken(token),
        state: body.state && typeof body.state === 'object' ? body.state : null, profile,
        level: profile.level, best: profile.best, power: profile.power, cls: profile.cls,
        rating: START_RATING, wins: 0, losses: 0, createdAt: now, updatedAt: now,
      });
    } catch (e) {
      if (e instanceof TakenError) throw new HttpError(409, '이미 사용 중인 닉네임이에요');
      throw e;
    }
    return { status: 201, body: { nickname: nick, token } };
  },

  // 내 세이브 불러오기
  'GET /api/me': async (req) => {
    const a = await auth(req);
    return { ...publicInfo(a), state: a.state };
  },

  // 세이브 올리기
  'PUT /api/me': async (req) => {
    const a = await auth(req);
    const body = await readJson(req);
    if (!body.state || typeof body.state !== 'object') throw new HttpError(400, 'state 가 없습니다');
    const profile = sanitizeProfile(body.profile);
    const now = Date.now();
    await store.update(a.key, {
      state: body.state, profile,
      level: profile.level, best: profile.best, power: profile.power, cls: profile.cls, updatedAt: now,
    });
    return { ok: true, updatedAt: now };
  },

  // 랭킹. 인증 헤더가 있으면 내 순위도 같이 준다
  'GET /api/ranking': async (req, url) => {
    const sort = url.searchParams.get('sort') === 'duel' ? 'duel' : 'stage';
    const limit = Math.floor(num(url.searchParams.get('limit'), 1, 200, 100));
    const players = (await store.top(sort, limit)).map(publicInfo);
    let me = null;
    if (req.headers.authorization) {
      try {
        const a = await auth(req);
        me = { ...publicInfo(a), rank: await store.rankOf(a, sort) };
      } catch {}
    }
    return { sort, players, me, total: await store.count() };
  },

  // 결투. 서버가 두 기사의 프로필로 싸움을 계산하고, 결과 기록을 돌려준다.
  'POST /api/duels': async (req) => {
    const me = await auth(req);
    const body = await readJson(req);
    const { key } = nicknameKey(body.opponent);
    if (key === me.key) throw new HttpError(400, '자기 자신과는 결투할 수 없어요');
    const op = await store.get(key);
    if (!op) throw new HttpError(404, '그런 기사는 없어요');
    const since = Date.now() - (lastDuel.get(me.key) || 0);
    if (since < DUEL_COOLDOWN_MS) throw new HttpError(429, `${Math.ceil((DUEL_COOLDOWN_MS - since) / 1000)}초 뒤에 다시 도전할 수 있어요`);
    lastDuel.set(me.key, Date.now());

    const pa = sanitizeProfile(me.profile), pb = sanitizeProfile(op.profile);
    const fight = simulateDuel(pa, pb);
    const won = fight.winner === 'a';
    const d = won ? eloDelta(me.rating, op.rating) : eloDelta(op.rating, me.rating);
    const myRating = Math.max(0, me.rating + (won ? d : -d));
    const opRating = Math.max(0, op.rating + (won ? -d : d));
    await store.update(me.key, { rating: myRating, wins: me.wins + (won ? 1 : 0), losses: me.losses + (won ? 0 : 1) });
    await store.update(op.key, { rating: opRating, wins: op.wins + (won ? 0 : 1), losses: op.losses + (won ? 1 : 0) });

    return {
      won, delta: d,
      me: { nickname: me.nickname, cls: pa.cls, level: pa.level, rating: myRating },
      opponent: { nickname: op.nickname, cls: pb.cls, level: pb.level, rating: opRating },
      fight,
    };
  },
};

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') return send(res, 204);
  const url = new URL(req.url, 'http://x');
  const handler = routes[`${req.method} ${url.pathname}`];
  if (!handler) return send(res, 404, { error: '없는 주소입니다' });
  try {
    const out = await handler(req, url);
    if (out && out.status) send(res, out.status, out.body);
    else send(res, 200, out);
  } catch (e) {
    if (e instanceof HttpError) return send(res, e.status, { error: e.message });
    console.error(e);
    send(res, 500, { error: '서버 오류가 났어요' });
  }
});

store.init().then(() => {
  server.listen(PORT, () => console.log(`knight-bar server :${PORT} (${process.env.DATABASE_URL ? 'postgres' : 'file'})`));
});

// 파일 저장소는 종료 직전에 한 번 더 쓴다
for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => { if (store.flush) store.flush(); process.exit(0); });
}
