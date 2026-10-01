'use strict';
// 계정 저장소. DATABASE_URL 이 있으면 Postgres, 없으면 DATA_DIR 의 JSON 파일(로컬 개발용).
// 계정 = { key, nickname, tokenHash, state, profile, level, best, power, cls, rating, wins, losses, season, attacks, createdAt, updatedAt }
// key 는 닉네임을 소문자로 정규화한 값 (대소문자만 다른 닉네임은 같은 닉네임으로 본다)
// rating·wins·losses·attacks 는 season 시즌의 결투 기록이다 (server/season.js).
// 결투 시즌 정산: 시즌 = { id, settledAt, players, top: [{ nickname, cls, level, rating, wins, losses }] },
//   시즌 보상 = { key, season, rank, total, rating, wins, losses } — 받아 가면(ack) 지운다

const fs = require('fs');
const path = require('path');

const SORTS = {
  stage: (x, y) => y.best - x.best || y.level - x.level || y.power - x.power,
  duel: (x, y) => y.rating - x.rating || y.wins - x.wins || y.best - x.best,
};
const SQL_ORDER = {
  stage: 'best DESC, level DESC, power DESC',
  duel: 'rating DESC, wins DESC, best DESC',
};

class TakenError extends Error {}

// 시즌 순위에 오르는 기사: 그 시즌에 직접 결투를 1번 이상 건 기사
const inSeason = (s) => (a) => a.season === s && a.attacks > 0;
const TOP_KEEP = 10;
const topView = (a) => ({ nickname: a.nickname, cls: a.cls, level: a.level, rating: a.rating, wins: a.wins, losses: a.losses });

// ───────────────────────── JSON 파일 ─────────────────────────
class FileStore {
  constructor(dir) {
    this.file = path.join(dir, 'accounts.json');
    this.seasonFile = path.join(dir, 'seasons.json');
    fs.mkdirSync(dir, { recursive: true });
    try { this.db = JSON.parse(fs.readFileSync(this.file, 'utf8')); } catch { this.db = {}; }
    try { this.sdb = JSON.parse(fs.readFileSync(this.seasonFile, 'utf8')); } catch { this.sdb = { seasons: [], rewards: [] }; }
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
  // season 을 주면 그 시즌 순위 대상만 (결투 순위)
  pool(season) { const all = Object.values(this.db); return season ? all.filter(inSeason(season)) : all; }
  async top(sort, limit, season) { return this.pool(season).sort(SORTS[sort]).slice(0, limit); }
  async rankOf(acc, sort, season) { return this.pool(season).filter(o => SORTS[sort](o, acc) < 0).length + 1; }
  async count(season) { return this.pool(season).length; }

  async settledThrough() { return this.sdb.seasons.reduce((m, x) => Math.max(m, x.id), 0); }
  async settleSeason(id, now) {
    if (this.sdb.seasons.some(x => x.id === id)) return;
    const list = this.pool(id).sort(SORTS.duel);
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
  // 전체 초기화: 계정·시즌 기록을 모두 지운다
  async wipe() {
    this.db = {};
    this.sdb = { seasons: [], rewards: [] };
    this.flush();
  }
}

// ───────────────────────── Postgres ─────────────────────────
const COLS = ['key', 'nickname', 'tokenHash', 'state', 'profile', 'level', 'best', 'power', 'cls', 'rating', 'wins', 'losses', 'season', 'attacks', 'createdAt', 'updatedAt'];
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
      );`);
  }
  row(r) {
    if (!r) return null;
    const o = {};
    for (const c of COLS) o[c] = r[snake(c)];
    o.power = Number(o.power); o.createdAt = Number(o.createdAt); o.updatedAt = Number(o.updatedAt);
    return o;
  }
  async create(acc) {
    const vals = COLS.map(c => acc[c]);
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
  // season 을 주면 그 시즌 순위 대상만 (결투 순위)
  async top(sort, limit, season) {
    const r = await this.pool.query(
      `SELECT key,nickname,profile,level,best,power,cls,rating,wins,losses,season,attacks,created_at,updated_at,'' AS token_hash,NULL AS state
       FROM accounts ${season ? 'WHERE season=$2 AND attacks>0' : ''} ORDER BY ${SQL_ORDER[sort]} LIMIT $1`, season ? [limit, season] : [limit]);
    return r.rows.map(x => this.row(x));
  }
  async rankOf(acc, sort, season) {
    let where = sort === 'duel'
      ? '(rating, wins, best) > ($1, $2, $3)'
      : '(best, level, power) > ($1, $2, $3)';
    const args = sort === 'duel' ? [acc.rating, acc.wins, acc.best] : [acc.best, acc.level, acc.power];
    if (season) { where += ' AND season=$4 AND attacks>0'; args.push(season); }
    return Number((await this.pool.query(`SELECT count(*) FROM accounts WHERE ${where}`, args)).rows[0].count) + 1;
  }
  async count(season) {
    const r = season
      ? await this.pool.query('SELECT count(*) FROM accounts WHERE season=$1 AND attacks>0', [season])
      : await this.pool.query('SELECT count(*) FROM accounts');
    return Number(r.rows[0].count);
  }

  async settledThrough() { return Number((await this.pool.query('SELECT coalesce(max(id), 0) AS m FROM duel_seasons')).rows[0].m); }
  // 한 트랜잭션에서 순위를 매겨 보상을 남긴다. 이미 정산한 시즌이면 아무것도 안 한다
  async settleSeason(id, now) {
    const c = await this.pool.connect();
    try {
      await c.query('BEGIN');
      const list = (await c.query(
        `SELECT key,nickname,cls,level,rating,wins,losses FROM accounts WHERE season=$1 AND attacks>0 ORDER BY ${SQL_ORDER.duel}`, [id])).rows;
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
  // 전체 초기화: 계정·시즌 기록을 모두 지운다
  async wipe() {
    await this.pool.query('TRUNCATE accounts, duel_seasons, season_rewards');
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
