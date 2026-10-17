'use strict';
// 시즌7 스킬 빌드 트리 — 보스 벽 기믹의 게임 규칙 (4단계, docs/specs/skill-tree-swordsaint.md "보스 벽")
// 수치·배치는 src/tree7.js (T7_GIM·T7_WALLS·T7_GIM_RULE), 봇·오프라인 계산은 tree7.js 의 근사(t7WallDps…).
//  🛡️ 보호막: 8초마다 다음 4타를 완전히 막는다 (타격 수가 많은 스킬이 빨리 벗긴다)
//  👥 졸개: 10초마다 졸개 3마리(잡몹 체력 ×3)가 보스 앞에 선다 (보상 없음, 단일 대상 스킬은 졸개부터 맞는다)
//  🔥 광폭화: 20초 뒤 공격 ×3 (붉은 기운, 탑 광폭화와 같은 그림)
//  🩸 장판: 6초마다 3초간 최대 체력 3%/초 (장판만으로는 쓰러지지 않는다 — 1 남김)
// 이 파일은 world.js 가 부른다: spawnAhead → t7WallSpawn, updateExpedition → t7WallTick, hitMonster → t7WallBlock·t7WallKill, drawMonster → t7WallDraw

function t7WallSpawn(m) {
  if (!m.wall) return;
  m.wt = 0; m.shieldN = 0; m.nextSh = 2; m.nextAdd = 4; m.poolT = 0; m.nextPool = 3;
  const g = m.wall.gims.map((x) => T7_GIM[x].icon + ' ' + T7_GIM[x].name).join(' · ');
  showBanner(`${m.wall.kind === 'region' ? '지역 보스' : '중간 보스'} ${MONSTERS[m.type].name} — ${g}`, m.wall.kind === 'region' ? '#ff5a5a' : '#ff9f1c', 16, 3);
}

function t7WallTick(dt) {
  const st = stats(), R = T7_GIM_RULE;
  for (const m of monsters) {
    if (!m.wall || m.dying) continue;
    if (!m.engaged) continue;                       // 기사와 붙은 뒤부터 시계가 돈다
    m.wt += dt;
    const has = (g) => m.wall.gims.includes(g), sx = toScreen(m.x);
    if (has('shield') && m.wt >= m.nextSh) {
      m.nextSh += R.shieldEvery; m.shieldN = R.shieldHits;
      addFloater(`🛡️ 보호막 ×${R.shieldHits}`, sx, monsterTop(m) - 20, '#8fd8ff', 13, true);
    }
    if (has('adds') && m.wt >= m.nextAdd) {
      m.nextAdd += R.addsEvery;
      const mob = monsterStats(S.stage, false), pool = monsterPool(S.stage);
      for (let j = 0; j < R.addsN; j++) {
        const a = makeMonster(pool[j % pool.length], false, m.x - 34 - j * PACK_GAP, { ...mob, hp: mob.hp * R.addsHp, gold: 0, exp: 0 });
        a.add = true; a.engaged = true;
        monsters.push(a);
      }
      addFloater('👥 졸개 등장!', sx, monsterTop(m) - 20, '#ffb0b0', 13, true);
    }
    if (has('enrage') && !m.enraged && m.wt >= R.enrageAt) {
      m.enraged = true; m.rage = R.enrageAtk; m.atk *= R.enrageAtk;
      showBanner('🔥 광폭화! 공격 ×3', '#ff4a3a', 18, 1.6);
    }
    if (has('pool')) {
      if (m.poolT > 0) {
        m.poolT -= dt;
        S.hp = Math.max(1, S.hp - st.maxHp * R.poolPct * dt);
      } else if (m.wt >= m.nextPool) {
        m.nextPool += R.poolEvery; m.poolT = R.poolDur;
        addFloater('🩸 장판', toScreen(knight.x), groundY() - 70, '#ff6b6b', 12);
      }
    }
    t7WallNote(m, m.hp / m.maxHp);                  // 귀환 보고: 이번 원정에서 가장 깊이 깎은 체력
  }
}

// 보호막: 이 타격을 막았으면 true
function t7WallBlock(m) {
  if (!(m.shieldN > 0)) return false;
  m.shieldN--;
  m.flash = 0.05;
  addFloater(m.shieldN ? '🛡️' : '🛡️ 깨짐!', toScreen(m.x) + rand(-8, 8), monsterTop(m) - 6, '#8fd8ff', m.shieldN ? 11 : 13, !m.shieldN);
  return true;
}

// 벽 보스를 잡으면: 졸개 정리 + 벽 돌파 배너 · 졸개는 보상 없음
function t7WallKill(m) {
  if (m.add) return true;
  if (!m.wall) return false;
  for (const a of monsters) if (a.add && !a.dying) a.dying = 0.001;
  t7WallBreak(m);
  return false;
}

function t7WallDraw(m, x, top) {
  if (!m.wall || m.dying) return;
  if (m.shieldN > 0) {
    ctx.font = '11px Galmuri11, monospace'; ctx.textAlign = 'center';
    ctx.fillStyle = '#8fd8ff';
    ctx.fillText(`🛡️${m.shieldN}`, x, top - 22);
  }
  if (m.poolT > 0) {                                // 기사 발밑 장판 (바닥 띠)
    const a = 0.25 + 0.15 * Math.sin(clock * 12);
    ctx.fillStyle = `rgba(200, 30, 40, ${a})`;
    ctx.fillRect(Math.round(toScreen(knight.x) - 30), groundY() - 2, 60, 4);
  }
}
