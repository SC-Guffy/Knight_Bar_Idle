'use strict';
// 계정 저장소. DATABASE_URL 이 있으면 Postgres, 없으면 DATA_DIR 의 JSON 파일(로컬 개발용).
// 계정 = { key, nickname, tokenHash, state, profile, level, best, power, cls, rating, wins, losses, createdAt, updatedAt }
// key 는 닉네임을 소문자로 정규화한 값 (대소문자만 다른 닉네임은 같은 닉네임으로 본다)

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

// ───────────────────────── JSON 파일 ─────────────────────────
class FileStore {
  constructor(dir) {
    this.file = path.join(dir, 'accounts.json');
    fs.mkdirSync(dir, { recursive: true });
    try { this.db = JSON.parse(fs.readFileSync(this.file, 'utf8')); } catch { this.db = {}; }
    this.timer = null;
  }
  async init() {}
  flush() {
    clearTimeout(this.timer);
    this.timer = null;
    const tmp = this.file + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(this.db));
    fs.renameSync(tmp, this.file);
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
  async top(sort, limit) { return Object.values(this.db).sort(SORTS[sort]).slice(0, limit); }
  async rankOf(acc, sort) { return Object.values(this.db).filter(o => SORTS[sort](o, acc) < 0).length + 1; }
  async count() { return Object.keys(this.db).length; }
}

// ───────────────────────── Postgres ─────────────────────────
const COLS = ['key', 'nickname', 'tokenHash', 'state', 'profile', 'level', 'best', 'power', 'cls', 'rating', 'wins', 'losses', 'createdAt', 'updatedAt'];
const snake = (c) => c.replace(/[A-Z]/g, m => '_' + m.toLowerCase());

class PgStore {
  constructor(url) {
    const { Pool } = require('pg');
    this.pool = new Pool({ connectionString: url, ssl: /localhost|127\.0\.0\.1/.test(url) ? false : { rejectUnauthorized: false } });
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
      CREATE INDEX IF NOT EXISTS accounts_duel ON accounts (rating DESC, wins DESC);`);
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
  async top(sort, limit) {
    const r = await this.pool.query(
      `SELECT key,nickname,profile,level,best,power,cls,rating,wins,losses,created_at,updated_at,'' AS token_hash,NULL AS state
       FROM accounts ORDER BY ${SQL_ORDER[sort]} LIMIT $1`, [limit]);
    return r.rows.map(x => this.row(x));
  }
  async rankOf(acc, sort) {
    const where = sort === 'duel'
      ? '(rating, wins, best) > ($1, $2, $3)'
      : '(best, level, power) > ($1, $2, $3)';
    const args = sort === 'duel' ? [acc.rating, acc.wins, acc.best] : [acc.best, acc.level, acc.power];
    return Number((await this.pool.query(`SELECT count(*) FROM accounts WHERE ${where}`, args)).rows[0].count) + 1;
  }
  async count() { return Number((await this.pool.query('SELECT count(*) FROM accounts')).rows[0].count); }
}

function openStore() {
  if (process.env.DATABASE_URL) return new PgStore(process.env.DATABASE_URL);
  return new FileStore(process.env.DATA_DIR || path.join(__dirname, 'data'));
}

module.exports = { openStore, TakenError };
