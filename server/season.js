'use strict';
// 결투 시즌. 3일마다 자동으로 바뀐다 (한국 시간 2026-10-01 00:00 이 시즌 1의 시작).
// 결투 점수(rating)·승패는 시즌마다 1000 / 0승 0패에서 다시 시작한다. 계정에 season 이 지금 시즌이 아니면
// 그 값은 지난 시즌 것이므로, 결투할 때 새로 시작한 값으로 바꿔 쓴다 (fresh).
// 시즌이 끝나면 그 시즌에 직접 결투를 1번 이상 건(attacks > 0) 기사들만 점수순으로 줄 세워 보상 순위를 남긴다.
// 보상 내용(재화·상자)은 클라이언트가 순위로 계산한다 (src/season.js).

const SEASON_ANCHOR = Date.UTC(2026, 8, 30, 15);   // 2026-10-01 00:00 KST
const SEASON_MS = 3 * 24 * 3600 * 1000;
const START_RATING = 1000;

const seasonAt = (t = Date.now()) => Math.max(0, Math.floor((t - SEASON_ANCHOR) / SEASON_MS) + 1);
const seasonRange = (id) => ({ id, startsAt: SEASON_ANCHOR + (id - 1) * SEASON_MS, endsAt: SEASON_ANCHOR + id * SEASON_MS });

// 지난 시즌 값을 들고 있는 계정이면 이번 시즌 시작 값으로
function fresh(acc, season = seasonAt()) {
  if (acc.season === season) return acc;
  return { ...acc, season, rating: START_RATING, wins: 0, losses: 0, attacks: 0 };
}

module.exports = { SEASON_MS, START_RATING, seasonAt, seasonRange, fresh };
