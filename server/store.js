'use strict';
// 계정 저장소. DATABASE_URL 이 있으면 Postgres, 없으면 DATA_DIR 의 JSON 파일(로컬 개발용).
// 계정 = { key, nickname, tokenHash, state, profile, level, best, power, cls, rating, wins, losses, season, attacks, createdAt, updatedAt, isBot, tower }
// isBot: AI 기사(server/bots.js). 토큰은 아무도 모르는 무작위 해시라 로그인할 수 없고, state 에는 봇 설정({ bot })만 있다.
//   시즌 보상 순위·명예의 전당·월드 보스 보상 지분·서버 통계는 사람만 센다 (opt.humans). tower: 도전의 탑 최고 층
// key 는 닉네임을 소문자로 정규화한 값 (대소문자만 다른 닉네임은 같은 닉네임으로 본다)
// rating·wins·losses·attacks 는 season 시즌의 결투 기록이다 (server/season.js).
// 결투 시즌 정산: 시즌 = { id, settledAt, players, top: [{ nickname, cls, level, rating, wins, losses }] },
//   시즌 보상 = { key, season, rank, total, rating, wins, losses } — 받아 가면(ack) 지운다
// 명예의 전당: 전체 초기화 직전 순위 = { id, at, players, stage: [최고 스테이지 순 10명], duel: [이번 결투 시즌 3명] } — 초기화해도 지우지 않는다
// 월드 보스(server/worldboss.js): 하루 = { day, boss, maxHp, hp, diff, est, spawnedAt, killedAt },
//   기사별 피해 = { day, key, nickname, cls, dmg, tries, claimed, bot } — 날이 지나면 지분만큼 보상을 받아 가고(claimed) 남겨 둔다
// 받은 결투(우편함): { id, at, defender, attacker, nickname, cls, level, won(방어 성공), delta, rating(방어자의 결투 뒤 점수), bot(건 쪽이 AI 기사) }
//   — 도전받은 기사가 나중에 접속해서 누가 걸었고 어떻게 됐는지 본다. 기사마다 최근 것만 보여 주고 오래된 건 지운다

const fs = require('fs');
const path = require('path');

const SORTS = {
  stage: (x, y) => y.best - x.best || y.level - x.level || y.power - x.power,
  duel: (x, y) => y.rating - x.rating || y.wins - x.wins || y.best - x.best,
  tower: (x, y) => (y.tower || 0) - (x.tower || 0) || y.best - x.best || y.level - x.level,
};
const SQL_ORDER = {
  stage: 'best DESC, level DESC, power DESC',
  duel: 'rating DESC, wins DESC, best DESC',
  tower: 'tower DESC, best DESC, level DESC',
};

class TakenError extends Error {}

// 시즌 순위에 오르는 기사: 그 시즌에 직접 결투를 1번 이상 건 기사
const inSeason = (s) => (a) => a.season === s && a.attacks > 0;
const human = (a) => !a.isBot;
const TOP_KEEP = 10;
const DUEL_LOG_KEEP_MS = 14 * 24 * 3600 * 1000;
const DUEL_LOG_FILE_MAX = 3000;
const topView = (a) => ({ nickname: a.nickname, cls: a.cls, level: a.level, rating: a.rating, wins: a.wins, losses: a.losses });

// ───────────────────────── JSON 파일 ─────────────────────────
class FileStore {
  constructor(dir) {
    this.file = path.join(dir, 'accounts.json');
    this.seasonFile = path.join(dir, 'seasons.json');
    fs.mkdirSync(dir, { recursive: true });
    try { this.db = JSON.parse(fs.readFileSync(this.file, 'utf8')); } catch { this.db = {}; }
    try { this.sdb = JSON.parse(fs.readFileSync(this.seasonFile, 'utf8')); } catch { this.sdb = { seasons: [], rewards: [] }; }
    this.sdb.wb = this.sdb.wb || [];
    this.sdb.wbHits = this.sdb.wbHits || [];
    this.sdb.duelLog = this.sdb.duelLog || [];
    this.hallFile = path.join(dir, 'hall.json');
    try { this.hdb = JSON.parse(fs.readFileSync(this.hallFile, 'utf8')); } catch { this.hdb = []; }
    this.timer = null;
  }
  async init() {}
  flush() {
    clearTimeout(this.timer);
    this.timer = null;
    for (const [file, data] of [[this.file, this.db], [this.seasonFile, this.sdb]]) {
      fs.writeFileSync(file + '.tmp', JSON.stringify(data));
      fs.renameSync(file + '.tmp', file);
    }
  }
  persist() { if (!this.timer) this.timer = setTimeout(() => this.flush(), 500); }

  async create(acc) {
    if (this.db[acc.key]) throw new TakenError();
    this.db[acc.key] = acc;
    this.persist();
    return acc;
  }
  async get(key) { return this.db[key] || null; }
  async byToken(tokenHash) { return Object.values(this.db).find(a => a.tokenHash === tokenHash) || null; }
  async update(key, fields) {
    Object.assign(this.db[key], fields);
    this.persist();
  }
  // season 을 주면 그 시즌 순위 대상만 (결투 순위), opt.humans 면 AI 기사를 뺀다
  pool(season, opt = {}) {
    let all = Object.values(this.db);
    if (season) all = all.filter(inSeason(season));
    return opt.humans ? all.filter(human) : all;
  }
  async top(sort, limit, season, opt) { return this.pool(season, opt).sort(SORTS[sort]).slice(0, limit); }
  async rankOf(acc, sort, season, opt) { return this.pool(season, opt).filter(o => SORTS[sort](o, acc) < 0).length + 1; }
  async count(season, opt) { return this.pool(season, opt).length; }
  // ── AI 기사 ──
  async bots() { return Object.values(this.db).filter(a => a.isBot); }
  async removeBots(keys) { for (const k of keys) if (this.db[k] && this.db[k].isBot) delete this.db[k]; this.persist(); }
  // 최근 활동한 사람 기사 (봇 성장 기준·결투 상대 고르기)
  async humansSince(since) {
    return Object.values(this.db).filter(a => !a.isBot && a.updatedAt >= since)
      .map(({ key, nickname, best, level, rating, season, attacks, updatedAt }) => ({ key, nickname, best, level, rating, season, attacks, updatedAt }));
  }

  async settledThrough() { return this.sdb.seasons.reduce((m, x) => Math.max(m, x.id), 0); }
  async settleSeason(id, now) {
    if (this.sdb.seasons.some(x => x.id === id)) return;
    const list = this.pool(id, { humans: true }).sort(SORTS.duel);   // 시즌 보상은 사람끼리만 순위를 매긴다
    list.forEach((a, i) => this.sdb.rewards.push({ key: a.key, season: id, rank: i + 1, total: list.length, rating: a.rating, wins: a.wins, losses: a.losses }));
    this.sdb.seasons.push({ id, settledAt: now, players: list.length, top: list.slice(0, TOP_KEEP).map(topView) });
    this.persist();
  }
  async season(id) { return this.sdb.seasons.find(x => x.id === id) || null; }
  async pendingRewards(key) { return this.sdb.rewards.filter(r => r.key === key); }
  async ackRewards(key, seasons) {
    this.sdb.rewards = this.sdb.rewards.filter(r => !(r.key === key && seasons.includes(r.season)));
    this.persist();
  }

  // ── 명예의 전당 ──
  async hall() { return this.hdb; }
  async addHall(entry) {
    this.hdb.push({ ...entry, id: this.hdb.length + 1 });
    fs.writeFileSync(this.hallFile, JSON.stringify(this.hdb));
  }

  // ── 월드 보스 ──
  async activeProfiles(since, minBest) {
    return Object.values(this.db).filter(a => a.updatedAt >= since && a.best >= minBest).map(a => a.profile);
  }
  async wbGet(day) { return this.sdb.wb.find(x => x.day === day) || null; }
  async wbLatestBefore(day) { return this.sdb.wb.filter(x => x.day < day).sort((a, b) => b.day - a.day)[0] || null; }
  async wbCreate(row) {
    if (!this.sdb.wb.some(x => x.day === row.day)) { this.sdb.wb.push({ ...row }); this.persist(); }
    return this.wbGet(row.day);
  }
  async wbMine(day, key) { return this.sdb.wbHits.find(h => h.day === day && h.key === key) || null; }
  // 피해를 반영한다. 남은 체력보다 많이 넣을 수는 없고, 오늘 도전을 다 썼으면 null
  async wbHit(day, acc, dmg, maxTries, now) {
    const b = await this.wbGet(day);
    let h = await this.wbMine(day, acc.key);
    if (!b || b.hp <= 0 || (h && h.tries >= maxTries)) return null;
    const dealt = Math.min(dmg, b.hp);
    b.hp -= dealt;
    const kill = b.hp <= 0 && !b.killedAt;
    if (kill) { b.hp = 0; b.killedAt = now; }
    if (!h) { h = { day, key: acc.key, nickname: acc.nickname, cls: acc.cls, dmg: 0, tries: 0, claimed: false, bot: !!acc.bot }; this.sdb.wbHits.push(h); }
    h.dmg += dealt; h.tries++; h.nickname = acc.nickname; h.cls = acc.cls;
    this.persist();
    return { dealt, hp: b.hp, kill, dmg: h.dmg, tries: h.tries };
  }
  async wbTop(day, limit) {
    return this.sdb.wbHits.filter(h => h.day === day).sort((a, b) => b.dmg - a.dmg).slice(0, limit)
      .map(h => ({ nickname: h.nickname, cls: h.cls, dmg: h.dmg, tries: h.tries, ...(h.bot ? { bot: true } : {}) }));
  }
  // total·players 는 AI 기사 포함, humanTotal·humans 는 사람만 (보상 지분 평균은 사람끼리)
  async wbStats(day) {
    const hs = this.sdb.wbHits.filter(h => h.day === day), hu = hs.filter(h => !h.bot);
    return { total: hs.reduce((a, h) => a + h.dmg, 0), players: hs.length, humanTotal: hu.reduce((a, h) => a + h.dmg, 0), humans: hu.length };
  }
  // 아직 안 받아 간 지난 날의 보상 재료: 내 피해·순위와 그날 전체 피해·참가 인원·처치 여부.
  // 순위·전체 피해·인원은 사람만 센다 — AI 기사의 피해가 평균 지분을 끌어올리거나 내려서 사람 보상이 흔들리지 않게
  async wbPending(key, today) {
    const out = [];
    for (const h of this.sdb.wbHits.filter(x => x.key === key && x.day < today && !x.claimed && !x.bot)) {
      const b = await this.wbGet(h.day), st = await this.wbStats(h.day);
      const rank = this.sdb.wbHits.filter(x => x.day === h.day && !x.bot && x.dmg > h.dmg).length + 1;
      out.push({ day: h.day, boss: b ? b.boss : null, dmg: h.dmg, rank, total: st.humanTotal, players: st.humans, killed: !!(b && b.killedAt) });
    }
    return out.sort((a, b) => a.day - b.day);
  }
  async wbAck(key, days) {
    for (const h of this.sdb.wbHits) if (h.key === key && days.includes(h.day)) h.claimed = true;
    this.persist();
  }
  // ── 받은 결투 ──
  async addDuelLog(e) {
    const log = this.sdb.duelLog, id = (log.length ? log[log.length - 1].id : 0) + 1;
    log.push({ ...e, id });
    const old = Date.now() - DUEL_LOG_KEEP_MS;
    this.sdb.duelLog = log.filter(x => x.at >= old).slice(-DUEL_LOG_FILE_MAX);
    this.persist();
  }
  async duelInbox(key, limit) {
    return this.sdb.duelLog.filter(x => x.defender === key).slice(-limit).reverse();
  }

  // 전체 초기화: 계정·시즌 기록을 모두 지운다
  async wipe() {
    this.db = {};
    this.sdb = { seasons: [], rewards: [], wb: [], wbHits: [], duelLog: [] };
    this.flush();
  }
}

// ───────────────────────── Postgres ─────────────────────────
const COLS = ['key', 'nickname', 'tokenHash', 'state', 'profile', 'level', 'best', 'power', 'cls', 'rating', 'wins', 'losses', 'season', 'attacks', 'createdAt', 'updatedAt', 'isBot', 'tower'];
const snake = (c) => c.replace(/[A-Z]/g, m => '_' + m.toLowerCase());

class PgStore {
  constructor(url) {
    const { Pool } = require('pg');
    this.pool = new Pool({ connectionString: url, max: 5, ssl: /localhost|127\.0\.0\.1/.test(url) ? false : { rejectUnauthorized: false } });
  }
  async init() {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS accounts (
        key text PRIMARY KEY,
        nickname text NOT NULL,
        token_hash text NOT NULL UNIQUE,
        state jsonb,
        profile jsonb,
        level int NOT NULL DEFAULT 1,
        best int NOT NULL DEFAULT 1,
        power bigint NOT NULL DEFAULT 0,
        cls text NOT NULL DEFAULT 'squire',
        rating int NOT NULL DEFAULT 1000,
        wins int NOT NULL DEFAULT 0,
        losses int NOT NULL DEFAULT 0,
        created_at bigint NOT NULL,
        updated_at bigint NOT NULL
      );
      CREATE INDEX IF NOT EXISTS accounts_stage ON accounts (best DESC, level DESC, power DESC);
      CREATE INDEX IF NOT EXISTS accounts_duel ON accounts (rating DESC, wins DESC);
      ALTER TABLE accounts ADD COLUMN IF NOT EXISTS season int NOT NULL DEFAULT 0;
      ALTER TABLE accounts ADD COLUMN IF NOT EXISTS attacks int NOT NULL DEFAULT 0;
      ALTER TABLE accounts ADD COLUMN IF NOT EXISTS is_bot boolean NOT NULL DEFAULT false;
      ALTER TABLE accounts ADD COLUMN IF NOT EXISTS tower int NOT NULL DEFAULT 0;
      CREATE INDEX IF NOT EXISTS accounts_tower ON accounts (tower DESC, best DESC, level DESC);
      CREATE TABLE IF NOT EXISTS duel_seasons (
        id int PRIMARY KEY,
        settled_at bigint NOT NULL,
        players int NOT NULL,
        top jsonb NOT NULL
      );
      CREATE TABLE IF NOT EXISTS season_rewards (
        key text NOT NULL,
        season int NOT NULL,
        rank int NOT NULL,
        total int NOT NULL,
        rating int NOT NULL,
        wins int NOT NULL,
        losses int NOT NULL,
        PRIMARY KEY (key, season)
      );
      CREATE TABLE IF NOT EXISTS world_boss (
        day int PRIMARY KEY,
        boss text NOT NULL,
        max_hp double precision NOT NULL,
        hp double precision NOT NULL,
        diff double precision NOT NULL,
        est double precision NOT NULL,
        spawned_at bigint NOT NULL,
        killed_at bigint
      );
      CREATE TABLE IF NOT EXISTS world_boss_hits (
        day int NOT NULL,
        key text NOT NULL,
        nickname text NOT NULL,
        cls text NOT NULL DEFAULT 'squire',
        dmg double precision NOT NULL DEFAULT 0,
        tries int NOT NULL DEFAULT 0,
        claimed boolean NOT NULL DEFAULT false,
        PRIMARY KEY (day, key)
      );
      CREATE INDEX IF NOT EXISTS world_boss_hits_dmg ON world_boss_hits (day, dmg DESC);
      ALTER TABLE world_boss_hits ADD COLUMN IF NOT EXISTS bot boolean NOT NULL DEFAULT false;
      CREATE TABLE IF NOT EXISTS duel_log (
        id serial PRIMARY KEY,
        at bigint NOT NULL,
        defender text NOT NULL,
        attacker text NOT NULL,
        nickname text NOT NULL,
        cls text NOT NULL,
        level int NOT NULL,
        won boolean NOT NULL,
        delta int NOT NULL,
        rating int NOT NULL
      );
      CREATE INDEX IF NOT EXISTS duel_log_def ON duel_log (defender, id DESC);
      ALTER TABLE duel_log ADD COLUMN IF NOT EXISTS bot boolean NOT NULL DEFAULT false;
      CREATE TABLE IF NOT EXISTS hall_of_fame (
        id serial PRIMARY KEY,
        at bigint NOT NULL,
        players int NOT NULL,
        stage jsonb NOT NULL,
        duel jsonb NOT NULL
      );`);
  }
  row(r) {
    if (!r) return null;
    const o = {};
    for (const c of COLS) o[c] = r[snake(c)];
    o.power = Number(o.power); o.createdAt = Number(o.createdAt); o.updatedAt = Number(o.updatedAt);
    o.isBot = !!o.isBot; o.tower = Number(o.tower) || 0;
    return o;
  }
  async create(acc) {
    const vals = COLS.map(c => (c === 'isBot' ? !!acc[c] : c === 'tower' ? acc[c] || 0 : acc[c]));
    const r = await this.pool.query(
      `INSERT INTO accounts (${COLS.map(snake).join(',')}) VALUES (${COLS.map((_, i) => '$' + (i + 1)).join(',')})
       ON CONFLICT (key) DO NOTHING RETURNING key`, vals);
    if (!r.rowCount) throw new TakenError();
    return acc;
  }
  async get(key) { return this.row((await this.pool.query('SELECT * FROM accounts WHERE key=$1', [key])).rows[0]); }
  async byToken(h) { return this.row((await this.pool.query('SELECT * FROM accounts WHERE token_hash=$1', [h])).rows[0]); }
  async update(key, fields) {
    const ks = Object.keys(fields);
    await this.pool.query(
      `UPDATE accounts SET ${ks.map((k, i) => `${snake(k)}=$${i + 2}`).join(',')} WHERE key=$1`,
      [key, ...ks.map(k => fields[k])]);
  }
  // season 을 주면 그 시즌 순위 대상만 (결투 순위), opt.humans 면 AI 기사를 뺀다
  async top(sort, limit, season, opt = {}) {
    const where = [season ? 'season=$2 AND attacks>0' : '', opt.humans ? 'NOT is_bot' : ''].filter(Boolean).join(' AND ');
    const r = await this.pool.query(
      `SELECT key,nickname,profile,level,best,power,cls,rating,wins,losses,season,attacks,created_at,updated_at,is_bot,tower,'' AS token_hash,NULL AS state
       FROM accounts ${where ? 'WHERE ' + where : ''} ORDER BY ${SQL_ORDER[sort]} LIMIT $1`, season ? [limit, season] : [limit]);
    return r.rows.map(x => this.row(x));
  }
  async rankOf(acc, sort, season, opt = {}) {
    let where = sort === 'duel' ? '(rating, wins, best) > ($1, $2, $3)'
      : sort === 'tower' ? '(tower, best, level) > ($1, $2, $3)'
      : '(best, level, power) > ($1, $2, $3)';
    const args = sort === 'duel' ? [acc.rating, acc.wins, acc.best] : sort === 'tower' ? [acc.tower || 0, acc.best, acc.level] : [acc.best, acc.level, acc.power];
    if (season) { where += ' AND season=$4 AND attacks>0'; args.push(season); }
    if (opt.humans) where += ' AND NOT is_bot';
    return Number((await this.pool.query(`SELECT count(*) FROM accounts WHERE ${where}`, args)).rows[0].count) + 1;
  }
  async count(season, opt = {}) {
    const where = [season ? 'season=$1 AND attacks>0' : '', opt.humans ? 'NOT is_bot' : ''].filter(Boolean).join(' AND ');
    const r = await this.pool.query(`SELECT count(*) FROM accounts ${where ? 'WHERE ' + where : ''}`, season ? [season] : []);
    return Number(r.rows[0].count);
  }
  // ── AI 기사 ──
  async bots() { return (await this.pool.query('SELECT * FROM accounts WHERE is_bot')).rows.map(x => this.row(x)); }
  async removeBots(keys) { if (keys.length) await this.pool.query('DELETE FROM accounts WHERE is_bot AND key = ANY($1::text[])', [keys]); }
  // 최근 활동한 사람 기사 (봇 성장 기준·결투 상대 고르기)
  async humansSince(since) {
    return (await this.pool.query('SELECT key,nickname,best,level,rating,season,attacks,updated_at FROM accounts WHERE NOT is_bot AND updated_at >= $1', [since])).rows
      .map(r => ({ key: r.key, nickname: r.nickname, best: r.best, level: r.level, rating: r.rating, season: r.season, attacks: r.attacks, updatedAt: Number(r.updated_at) }));
  }

  async settledThrough() { return Number((await this.pool.query('SELECT coalesce(max(id), 0) AS m FROM duel_seasons')).rows[0].m); }
  // 한 트랜잭션에서 순위를 매겨 보상을 남긴다. 이미 정산한 시즌이면 아무것도 안 한다
  async settleSeason(id, now) {
    const c = await this.pool.connect();
    try {
      await c.query('BEGIN');
      const list = (await c.query(
        `SELECT key,nickname,cls,level,rating,wins,losses FROM accounts WHERE season=$1 AND attacks>0 AND NOT is_bot ORDER BY ${SQL_ORDER.duel}`, [id])).rows;   // 시즌 보상은 사람끼리만
      const ins = await c.query(
        'INSERT INTO duel_seasons (id, settled_at, players, top) VALUES ($1,$2,$3,$4) ON CONFLICT (id) DO NOTHING RETURNING id',
        [id, now, list.length, JSON.stringify(list.slice(0, TOP_KEEP).map(topView))]);
      if (!ins.rowCount) { await c.query('ROLLBACK'); return; }
      if (list.length) {
        await c.query(
          `INSERT INTO season_rewards (key, season, rank, total, rating, wins, losses)
           SELECT k, $1, r, $2, rt, w, l FROM unnest($3::text[], $4::int[], $5::int[], $6::int[], $7::int[]) AS t(k, r, rt, w, l)
           ON CONFLICT DO NOTHING`,
          [id, list.length, list.map(a => a.key), list.map((_, i) => i + 1), list.map(a => a.rating), list.map(a => a.wins), list.map(a => a.losses)]);
      }
      await c.query('COMMIT');
    } catch (e) {
      await c.query('ROLLBACK').catch(() => {});
      throw e;
    } finally {
      c.release();
    }
  }
  async season(id) {
    const r = (await this.pool.query('SELECT * FROM duel_seasons WHERE id=$1', [id])).rows[0];
    return r ? { id: r.id, settledAt: Number(r.settled_at), players: r.players, top: r.top } : null;
  }
  async pendingRewards(key) {
    return (await this.pool.query('SELECT season,rank,total,rating,wins,losses FROM season_rewards WHERE key=$1 ORDER BY season', [key])).rows;
  }
  async ackRewards(key, seasons) {
    await this.pool.query('DELETE FROM season_rewards WHERE key=$1 AND season = ANY($2::int[])', [key, seasons]);
  }

  // ── 명예의 전당 ──
  async hall() {
    return (await this.pool.query('SELECT * FROM hall_of_fame ORDER BY id')).rows.map(r => ({ id: r.id, at: Number(r.at), players: r.players, stage: r.stage, duel: r.duel }));
  }
  async addHall(e) {
    await this.pool.query('INSERT INTO hall_of_fame (at, players, stage, duel) VALUES ($1,$2,$3,$4)', [e.at, e.players, JSON.stringify(e.stage), JSON.stringify(e.duel)]);
  }

  // ── 월드 보스 ──
  async activeProfiles(since, minBest) {
    return (await this.pool.query('SELECT profile FROM accounts WHERE updated_at >= $1 AND best >= $2', [since, minBest])).rows.map(r => r.profile);
  }
  wbRow(r) {
    return r ? { day: r.day, boss: r.boss, maxHp: Number(r.max_hp), hp: Number(r.hp), diff: Number(r.diff), est: Number(r.est),
      spawnedAt: Number(r.spawned_at), killedAt: r.killed_at == null ? null : Number(r.killed_at) } : null;
  }
  async wbGet(day) { return this.wbRow((await this.pool.query('SELECT * FROM world_boss WHERE day=$1', [day])).rows[0]); }
  async wbLatestBefore(day) { return this.wbRow((await this.pool.query('SELECT * FROM world_boss WHERE day<$1 ORDER BY day DESC LIMIT 1', [day])).rows[0]); }
  async wbCreate(b) {
    await this.pool.query(
      `INSERT INTO world_boss (day, boss, max_hp, hp, diff, est, spawned_at, killed_at) VALUES ($1,$2,$3,$4,$5,$6,$7,NULL)
       ON CONFLICT (day) DO NOTHING`, [b.day, b.boss, b.maxHp, b.hp, b.diff, b.est, b.spawnedAt]);
    return this.wbGet(b.day);
  }
  async wbMine(day, key) {
    const r = (await this.pool.query('SELECT dmg, tries FROM world_boss_hits WHERE day=$1 AND key=$2', [day, key])).rows[0];
    return r ? { dmg: Number(r.dmg), tries: r.tries } : null;
  }
  // 한 트랜잭션에서 보스 체력을 잠그고 피해를 반영한다. 남은 체력보다 많이 넣을 수는 없고, 오늘 도전을 다 썼으면 null
  async wbHit(day, acc, dmg, maxTries, now) {
    const c = await this.pool.connect();
    try {
      await c.query('BEGIN');
      const b = this.wbRow((await c.query('SELECT * FROM world_boss WHERE day=$1 FOR UPDATE', [day])).rows[0]);
      const h = (await c.query('SELECT dmg, tries FROM world_boss_hits WHERE day=$1 AND key=$2 FOR UPDATE', [day, acc.key])).rows[0];
      if (!b || b.hp <= 0 || (h && h.tries >= maxTries)) { await c.query('ROLLBACK'); return null; }
      const dealt = Math.min(dmg, b.hp), hp = Math.max(0, b.hp - dealt), kill = hp <= 0 && !b.killedAt;
      await c.query('UPDATE world_boss SET hp=$2, killed_at=coalesce(killed_at, $3) WHERE day=$1', [day, hp, kill ? now : null]);
      const r = (await c.query(
        `INSERT INTO world_boss_hits (day, key, nickname, cls, dmg, tries, bot) VALUES ($1,$2,$3,$4,$5,1,$6)
         ON CONFLICT (day, key) DO UPDATE SET dmg = world_boss_hits.dmg + $5, tries = world_boss_hits.tries + 1, nickname = $3, cls = $4
         RETURNING dmg, tries`, [day, acc.key, acc.nickname, acc.cls, dealt, !!acc.bot])).rows[0];
      await c.query('COMMIT');
      return { dealt, hp, kill, dmg: Number(r.dmg), tries: r.tries };
    } catch (e) {
      await c.query('ROLLBACK').catch(() => {});
      throw e;
    } finally {
      c.release();
    }
  }
  async wbTop(day, limit) {
    return (await this.pool.query('SELECT nickname, cls, dmg, tries, bot FROM world_boss_hits WHERE day=$1 ORDER BY dmg DESC LIMIT $2', [day, limit]))
      .rows.map(r => ({ nickname: r.nickname, cls: r.cls, dmg: Number(r.dmg), tries: r.tries, ...(r.bot ? { bot: true } : {}) }));
  }
  // total·players 는 AI 기사 포함, humanTotal·humans 는 사람만 (보상 지분 평균은 사람끼리)
  async wbStats(day) {
    const r = (await this.pool.query(
      `SELECT coalesce(sum(dmg), 0) AS total, count(*) AS players,
         coalesce(sum(dmg) FILTER (WHERE NOT bot), 0) AS htotal, count(*) FILTER (WHERE NOT bot) AS humans
       FROM world_boss_hits WHERE day=$1`, [day])).rows[0];
    return { total: Number(r.total), players: Number(r.players), humanTotal: Number(r.htotal), humans: Number(r.humans) };
  }
  // 아직 안 받아 간 지난 날의 보상 재료: 내 피해·순위와 그날 전체 피해·참가 인원·처치 여부. 순위·전체 피해·인원은 사람만 센다 (FileStore 와 같음)
  async wbPending(key, today) {
    const r = await this.pool.query(
      `SELECT h.day, b.boss, h.dmg, b.killed_at,
         (SELECT count(*) FROM world_boss_hits x WHERE x.day = h.day AND NOT x.bot AND x.dmg > h.dmg) + 1 AS rank,
         (SELECT coalesce(sum(dmg), 0) FROM world_boss_hits x WHERE x.day = h.day AND NOT x.bot) AS total,
         (SELECT count(*) FROM world_boss_hits x WHERE x.day = h.day AND NOT x.bot) AS players
       FROM world_boss_hits h LEFT JOIN world_boss b ON b.day = h.day
       WHERE h.key = $1 AND h.day < $2 AND NOT h.claimed AND NOT h.bot ORDER BY h.day`, [key, today]);
    return r.rows.map(x => ({ day: x.day, boss: x.boss, dmg: Number(x.dmg), rank: Number(x.rank), total: Number(x.total), players: Number(x.players), killed: x.killed_at != null }));
  }
  async wbAck(key, days) {
    await this.pool.query('UPDATE world_boss_hits SET claimed = true WHERE key=$1 AND day = ANY($2::int[])', [key, days]);
  }
  // ── 받은 결투 ──
  async addDuelLog(e) {
    await this.pool.query(
      'INSERT INTO duel_log (at, defender, attacker, nickname, cls, level, won, delta, rating, bot) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',
      [e.at, e.defender, e.attacker, e.nickname, e.cls, e.level, e.won, e.delta, e.rating, !!e.bot]);
    // 오래된 기록은 가끔 한 번씩 지운다
    if (Math.random() < 0.02) await this.pool.query('DELETE FROM duel_log WHERE at < $1', [Date.now() - DUEL_LOG_KEEP_MS]);
  }
  async duelInbox(key, limit) {
    return (await this.pool.query('SELECT * FROM duel_log WHERE defender=$1 ORDER BY id DESC LIMIT $2', [key, limit])).rows
      .map(r => ({ id: r.id, at: Number(r.at), attacker: r.attacker, nickname: r.nickname, cls: r.cls, level: r.level, won: r.won, delta: r.delta, rating: r.rating, bot: r.bot }));
  }
  // 전체 초기화: 계정·시즌 기록을 모두 지운다 (명예의 전당은 남긴다)
  async wipe() {
    await this.pool.query('TRUNCATE accounts, duel_seasons, season_rewards, world_boss, world_boss_hits, duel_log');
  }
}

function openStore() {
  if (process.env.DATABASE_URL) return new PgStore(process.env.DATABASE_URL);
  // Render 무료 인스턴스의 디스크는 재시작마다 비워진다. DB 설정이 빠졌으면 데이터를 잃기 전에 시작을 멈춘다.
  if (process.env.RENDER && !process.env.DATA_DIR) {
    throw new Error('DATABASE_URL 이 설정되지 않았습니다 (Render → Environment 에서 Supabase 연결 문자열을 넣어 주세요)');
  }
  return new FileStore(process.env.DATA_DIR || path.join(__dirname, 'data'));
}

module.exports = { openStore, TakenError };
