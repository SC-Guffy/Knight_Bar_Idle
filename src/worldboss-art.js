'use strict';
// 시즌5 월드 보스 넷: 거대 균사왕(포자) · 황금 미믹(보물) · 여왕벌(벌떼) · 망령선(유령선).
// 처음 셋(베헤모스·히드라·공허룡)은 src/data.js 의 WORLD_BOSSES 와 src/world.js 의 RAID_HIT·RAID_AOE 에 있고,
// 여기서는 같은 표에 이름·도트·평타·광역기를 덧붙인다 (data.js·world.js 다음에 읽어야 함).
// id·rage 는 server/worldboss.js 의 WORLD_BOSSES 와 같아야 한다. rage: 광폭화 시각(초) — 없으면 20초.
// 재생은 RAID_BOSSES 를 먼저 찾으므로(world.js raidDef) id·연출 키가 레이드 보스와 겹치면 안 된다

Object.assign(WORLD_BOSSES, {
  sporeking: { name: '거대 균사왕', icon: '🍄', spr: 'wb_sporeking', hit: 'sporepod', aoe: 'sporebloom', fx: ['#d9f27a', '#ff7a6b'], skill: '포자 만개', rage: 20,
    trait: '잠들면 오래 못 움직인다',
    pal: { c: '#c8433a', W: '#fff1e0', g: '#d8b98a', s: '#efe3c8', Y: '#9dff6a', K: '#1b1d27', k: '#4a2e1a', r: '#8a6a44' },
    desc: '숲 하나가 통째로 이 버섯의 뿌리다. 갓을 흔들 때마다 포자 구름이 골짜기를 덮는다.' },
  goldmimic: { name: '황금 미믹', icon: '💰', spr: 'wb_goldmimic', hit: 'chomp', aoe: 'coinrain', fx: ['#ffd257', '#ff3b3b'], skill: '탐욕의 금화비', rage: 15,
    trait: '일찍 광폭해지고 강타가 무겁다',
    pal: { b: '#7a4a22', B: '#a8692e', Y: '#ffd257', K: '#1b1d27', v: '#1a0f14', W: '#f4f1e8', E: '#ff3b3b', p: '#e0507a', P: '#ff8fb0', o: '#e8b93a', k: '#3b2a1a' },
    desc: '용의 보물 창고를 통째로 삼킨 상자. 열쇠 구멍 너머로 이빨이 번득인다.' },
  hivequeen: { name: '여왕벌', icon: '🐝', spr: 'wb_hivequeen', hit: 'stinger', aoe: 'swarm', fx: ['#f2b81f', '#fff3b0'], skill: '벌떼 습격', rage: 22,
    trait: '광역기가 잦지만 약하다',
    pal: { w: '#bfe6f0', W: '#eefaff', k: '#1b1d27', Y: '#ffd257', y: '#f2b81f', d: '#2e2416', E: '#b8322a', h: '#d9a03a', m: '#5a4020', S: '#e9e4d4' },
    desc: '왕국 하나만 한 벌집의 주인. 날갯짓 소리가 들리면 이미 늦었다.' },
  ghostship: { name: '망령선', icon: '⚓', spr: 'wb_ghostship', hit: 'anchor', aoe: 'phantoms', fx: ['#7dffb0', '#cfe8d8'], skill: '망령 선원 돌격', rage: 24,
    trait: '광역기가 드물지만 아프고 멀리 밀린다',
    pal: { k: '#2a2028', f: '#1b1d27', s: '#8fb8a0', S: '#cfe8d8', Z: '#e9e4d4', E: '#7dffb0', h: '#3a2e3a', H: '#55445a', g: '#7dffb0', q: '#4fbf8a' },
    desc: '백 년 전에 가라앉은 해적선. 안개 낀 밤이면 땅 위로도 항해한다.' },
});

// 도트 (모두 왼쪽 = 기사 쪽을 본다). 실루엣이 서로·기존 셋과 다르게:
// 균사왕은 넓은 갓을 인 기둥, 미믹은 비스듬히 열린 뚜껑과 늘어진 혀, 여왕벌은 위로 선 날개와 줄무늬 배·침, 망령선은 돛대와 선체
Object.assign(SPR, {
  wb_sporeking: [[
    '.......cccccccc.........',
    '....ccccWWccccccccc.....',
    '..cccWWWWcccccWWccccc...',
    '.ccccWWccccccWWWWcccccc.',
    'ccccccccccccccWWcccccccc',
    'cccWWcccccccccccccccWWcc',
    'cccccccccccccccccccccccc',
    '.gggggggggggggggggggggg.',
    '....ggsssssssssssgg.....',
    '......sssssssssss.......',
    '.....sYKssssYKsss.......',
    '..ss.ssssssssssss.ss....',
    '.s..sssskkkksssssss.s...',
    '.....sssssssssssss......',
    '.....ssssssssssssss.....',
    '....rssrsssssssrsssr....',
    '..rrr.rr..rrr...rr.rrr..',
  ]],
  wb_goldmimic: [[
    '...........bbb..........',
    '...........vbBb.........',
    '..........vvWbBb........',
    '.........vvvvWbBb.......',
    '.........vEvEvWbBb......',
    '........vvvvvvvWbBb.....',
    '.......vvvvvvvvvWbBb....',
    '......pvWvWvWvWvWvbBb...',
    '....ppYYYYYYYYYYYYYYYY..',
    '...pp.bBBBBBBBBBBBBBBb..',
    '..pp..bBBBBBBYYBBBBBBb..',
    '..pP..YYYYYYYYKYYYYYYY..',
    '.oo...bBBBBBBBBBBBBBBb..',
    'oYoo..bbbbbbbbbbbbbbbb..',
    '.......kk..........kk...',
    '......kkk.........kkk...',
  ]],
  wb_hivequeen: [[
    '...........ww...ww........',
    '..........wWWw.wWWw.......',
    '..k.......wWWw.wWWWw......',
    '...k......wWWw.wWWWw......',
    '....k..k...wWw..wWWw......',
    '.....kYYk..wWw..wWw.......',
    '....YyYyY...ww.ww.dddd....',
    '...dddddd.hhhhhhdyyyyyd...',
    '..dEEdddddhhhhhhddddddddd.',
    '..dEEdddddhhhhhhyyyyyyyyy.',
    '...ddddd.hhhhhhhddddddddd.',
    '....mm....hhhhh.yyyyyyyy..',
    '.........k.k.k...ddddddd..',
    '........k..k..k...ddddd...',
    '.......k...k...k....dSS...',
    '......kk..kk...kk.....S...',
  ]],
  wb_ghostship: [[
    '............k.............',
    '............kff...........',
    '............kfff..........',
    '.........ssskssss.........',
    '........sSSSkSSSSs........',
    '.......sSSS.kSSSSSs.......',
    '.......sSSSSkSS.SSs.......',
    '........sSSSkSSSSs...k....',
    '.........s.sks.s.s..sSs...',
    '............k.......sSSs..',
    '.ZZ.........k.......sSs...',
    'ZEZhhhhhhhhhhhhhhhhhhhhhhh',
    '.Zhhgghhgghhgghhgghhhhhhh.',
    '..hhHHHHHHHHHHHHHHHHHHhh..',
    '...hhhhhhhhhhhhhhhhhhhh...',
    '.....hhhhhhhhhhhhhhhhh....',
    '...qq.qqq.qq.qqqq.qqq.qq..',
  ]],
});

// ── 평타 ──
Object.assign(RAID_HIT, {
  // 균사왕: 부푼 포자 주머니를 던지면 기사 머리 위에서 터져 포자 구름이 퍼진다
  sporepod: (e, def) => {
    raidPlay.act = { kind: 'throw', at: clock, dur: 0.35 };
    raidShot(e.tg, 0.4, 34, (x, y, u) => {
      const r = 5 + Math.sin(clock * 30) * 1;
      ctx.fillStyle = '#c8433a'; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff1e0'; ctx.fillRect(Math.round(x) - 2, Math.round(y) - 3, 2, 2); ctx.fillRect(Math.round(x) + 1, Math.round(y), 2, 2);
      if (Math.random() < 0.5) px(x + rand(3, 8), y + rand(-3, 3), 2, '#d9f27a', 0.7);
    }, () => {
      const x = raidKnightX(e.tg) + 6, y = raidKnightY() - 8;
      raidStrike(e.tg, e.d, e.h[e.tg], ['#d9f27a', '#fff1e0', '#c8433a']);
      for (let k = 0; k < 14; k++) parts.push({ x, y, vx: rand(-70, 70), vy: rand(-60, 20), g: -10, size: rand(3, 5), color: k % 2 ? '#d9f27a' : '#b8d860', life: rand(0.5, 0.8), t: 0 });
    });
  },
  // 황금 미믹: 뚜껑을 쩍 벌리고 덮쳐 문다 — 이빨 사이로 금화가 튄다
  chomp: (e, def) => {
    raidPlay.act = { kind: 'lunge', at: clock, dur: 0.4 };
    raidLater(0.17, () => {
      const x = raidKnightX(e.tg) + 8;
      raidStrike(e.tg, e.d, e.h[e.tg], ['#ffd257', '#f4f1e8', '#e0507a']);
      effects.push({ type: 'bite', x, y: raidKnightY() + 2, t: 0, life: 0.35 });
      burst(x, raidKnightY() - 4, 8, ['#ffd257', '#e8b93a', '#fff3b0'], 120, 3, 380);
    });
  },
  // 여왕벌: 꽁무니의 독침을 곧게 쏜다
  stinger: (e, def) => {
    raidPlay.act = { kind: 'throw', at: clock, dur: 0.25 };
    const g = raidBossGeom(), sx = g.left + g.w * 0.9, sy = groundY() - g.h * 0.12;
    raidFx(0, 0.2, (u) => {
      const tx = raidKnightX(e.tg) + 8, ty = raidKnightY();
      const x = lerp(sx, tx, u), y = lerp(sy, ty, u), a = Math.atan2(ty - sy, tx - sx);
      ctx.save(); ctx.translate(Math.round(x), Math.round(y)); ctx.rotate(a);
      ctx.fillStyle = '#e9e4d4'; ctx.fillRect(-10, -1, 12, 2);
      ctx.fillStyle = '#9dff6a'; ctx.fillRect(-12, -1, 3, 2);         // 독
      ctx.restore();
      px(x - Math.cos(a) * 14, y - Math.sin(a) * 14, 2, '#fff3b0', 0.6);
    }, () => {
      raidStrike(e.tg, e.d, e.h[e.tg], ['#f2b81f', '#9dff6a', '#ffffff']);
      burst(raidKnightX(e.tg) + 8, raidKnightY(), 6, ['#9dff6a', '#f2b81f'], 90, 2, 200);
    });
  },
  // 망령선: 사슬 달린 닻을 던져 내리찍는다
  anchor: (e, def) => {
    raidPlay.act = { kind: 'throw', at: clock, dur: 0.35 };
    const g = raidBossGeom(), sx = g.left + g.w * 0.15, sy = groundY() - g.h * 0.35;
    raidFx(0, 0.38, (u) => {
      const tx = raidKnightX(e.tg) + 6, ty = raidKnightY() + 4;
      const x = lerp(sx, tx, u), y = lerp(sy, ty, u) - Math.sin(u * Math.PI) * 30;
      ctx.fillStyle = '#5d6470';
      for (let k = 1; k < 10; k++) { const v = k / 10; ctx.fillRect(Math.round(lerp(sx, x, v)) - 1, Math.round(lerp(sy, y, v) - Math.sin(v * Math.PI) * 6) - 1, 2, 2); }   // 사슬
      ctx.save(); ctx.translate(Math.round(x), Math.round(y)); ctx.rotate(-1.2 + u * 1.4);
      ctx.fillStyle = '#3b3f4c'; ctx.fillRect(-1, -9, 3, 16); ctx.fillRect(-5, -7, 11, 2);
      ctx.fillRect(-7, 4, 3, 3); ctx.fillRect(5, 4, 3, 3); ctx.fillRect(-5, 6, 11, 2);
      ctx.fillStyle = '#7dffb0'; ctx.globalAlpha = 0.35; ctx.fillRect(-8, -10, 17, 19); ctx.globalAlpha = 1;
      ctx.restore();
    }, () => {
      const x = raidKnightX(e.tg) + 6;
      raidStrike(e.tg, e.d, e.h[e.tg], ['#7dffb0', '#cfe8d8', '#3b3f4c'], true);
      effects.push({ type: 'ring', x, y: groundY(), t: 0, life: 0.4, size: 0.6, color: '#7dffb0' });
      burst(x, groundY() - 4, 10, ['#8a7a5a', '#cfe8d8'], 110, 3, 300);
    });
  },
});

// ── 광역기 ──
Object.assign(RAID_AOE, {
  // 포자 만개: 기사들 발밑에서 버섯이 솟아 포자를 뿜고, 맞은 기사는 잠든다 (기절이 길다)
  sporebloom: (e, def) => {
    raidPlay.act = { kind: 'land', at: clock, dur: 0.35 };
    shake = 0.35;
    const g = raidBossGeom(), gy = groundY();
    for (let k = 0; k < 20; k++) parts.push({ x: g.cx + rand(-g.w * 0.4, g.w * 0.4), y: gy - g.h * 0.8, vx: rand(-120, 20), vy: rand(-60, 10), g: -5, size: rand(3, 5), color: k % 2 ? '#d9f27a' : '#ff7a6b', life: rand(0.6, 1), t: 0 });
    const delayOf = (i) => Math.max(0, (g.left - raidKnightX(i)) / 450);
    for (const i of raidAlive()) {
      raidFx(delayOf(i), 0.9, (u) => {
        const x = raidKnightX(i), grow = Math.min(1, u * 5) * (1 - Math.max(0, u - 0.75) / 0.25);
        for (const [dx, hh, cw] of [[-12, 10, 7], [10, 13, 8], [-2, 18, 11]]) {
          const h = hh * grow, w = cw * grow;
          if (w < 0.5) continue;
          ctx.fillStyle = '#efe3c8'; ctx.fillRect(Math.round(x + dx - 1.5), Math.round(gy - h), 3, Math.round(h));
          ctx.fillStyle = '#c8433a'; ctx.beginPath(); ctx.ellipse(x + dx, gy - h, w, w * 0.55, 0, Math.PI, 0); ctx.fill();
          ctx.fillStyle = '#fff1e0'; ctx.fillRect(Math.round(x + dx - w * 0.4), Math.round(gy - h - w * 0.35), 2, 2);
        }
        if (u > 0.2 && u < 0.6 && Math.random() < 0.7) parts.push({ x: x + rand(-14, 14), y: gy - 16, vx: rand(-30, 30), vy: rand(-70, -30), g: -10, size: 4, color: Math.random() < 0.5 ? '#d9f27a' : '#b8d860', life: 0.7, t: 0 });
      });
      raidLater(delayOf(i) + 0.2, () => { if (raidPlay.dead[i] == null) addFloater('💤', raidKnightX(i) + 10, gy - 70, '#d9f27a', 14, true); });
    }
    raidAoeHits(e, def, (i) => delayOf(i) + 0.15, ['#d9f27a', '#b8d860', '#ffffff']);
  },
  // 탐욕의 금화비: 상자가 하늘로 금화를 뿜고, 금화 무더기가 기사들 위로 쏟아진다
  coinrain: (e, def) => {
    raidPlay.act = { kind: 'roar', at: clock, dur: 0.6 };
    const g = raidBossGeom(), gy = groundY(), mx = g.left + g.w * 0.45, my = gy - g.h * 0.7;
    for (let k = 0; k < 24; k++) parts.push({ x: mx, y: my, vx: rand(-80, 40), vy: rand(-320, -200), g: 400, size: 3, color: k % 3 ? '#ffd257' : '#e8b93a', life: rand(0.4, 0.7), t: 0 });
    raidAlive().forEach((i, n) => {
      raidFx(0.35 + n * 0.06, 0.45, (u) => {
        const x = raidKnightX(i);
        for (let k = 0; k < 9; k++) {
          const cx = x + ((k * 7) % 26) - 13, cy = lerp(-10 - k * 9, gy - 4, Math.min(1, u * 1.6 + k * 0.03));
          if (cy >= gy - 4) continue;
          ctx.fillStyle = '#ffd257'; ctx.fillRect(Math.round(cx) - 3, Math.round(cy) - 1, 6, 3);
          ctx.fillStyle = '#fff3b0'; ctx.fillRect(Math.round(cx) - 2, Math.round(cy) - 1, 2, 1);
        }
        const pile = Math.min(1, u * 2) * (1 - Math.max(0, u - 0.8) / 0.2);       // 발밑에 쌓이는 금화 더미
        if (pile > 0.05) { ctx.fillStyle = '#e8b93a'; ctx.beginPath(); ctx.ellipse(x, gy, 16 * pile, 6 * pile, 0, Math.PI, 0); ctx.fill(); }
      }, () => burst(raidKnightX(i), gy - 6, 10, ['#ffd257', '#e8b93a', '#ffffff'], 140, 3, 380));
    });
    raidAoeHits(e, def, (i) => 0.55 + raidAlive().indexOf(i) * 0.06, ['#ffd257', '#e8b93a', '#ffffff']);
  },
  // 벌떼 습격: 벌집에서 쏟아진 벌 떼가 구름처럼 파티를 휩쓸고 지나간다
  swarm: (e, def) => {
    raidPlay.act = { kind: 'roar', at: clock, dur: 0.5 };
    const g = raidBossGeom(), gy = groundY(), x0 = g.left + 6, end = raidKnightX(raidPlay.res.members.length - 1) - 60;
    const speed = 300, dur = Math.max(0.5, (x0 - end) / speed);
    const bees = Array.from({ length: 34 }, () => ({ dx: rand(-26, 26), y: rand(14, 60), ph: rand(0, 6), sp: rand(14, 24) }));
    raidFx(0, dur + 0.25, (u0) => {
      const u = Math.min(1, (u0 * (dur + 0.25)) / dur), front = lerp(x0, end, u);
      const fade = 1 - Math.max(0, (u0 * (dur + 0.25) - dur) / 0.25);
      for (const b of bees) {
        const x = front + b.dx + Math.sin(clock * b.sp + b.ph) * 6, y = gy - b.y + Math.cos(clock * b.sp * 1.3 + b.ph) * 4;
        px(x, y, 3, '#f2b81f', fade); px(x + 2, y, 2, '#2e2416', fade);
        if (Math.floor(clock * 30 + b.ph) % 2) px(x, y - 3, 2, '#eefaff', 0.8 * fade);     // 날갯짓
      }
    });
    raidAoeHits(e, def, (i) => Math.max(0, (x0 - raidKnightX(i)) / speed), ['#f2b81f', '#2e2416', '#fff3b0'], false);
  },
  // 망령 선원 돌격: 안개가 깔리고 반투명한 망령 선원들이 칼을 들고 파티를 꿰뚫고 달려 나간다 (멀리 쓸려 간다)
  phantoms: (e, def) => {
    raidPlay.act = { kind: 'roar', at: clock, dur: 0.6 };
    shake = 0.5;
    const g = raidBossGeom(), gy = groundY(), x0 = g.left + 10, end = raidKnightX(raidPlay.res.members.length - 1) - 90;
    const speed = 420, dur = Math.max(0.5, (x0 - end) / speed);
    raidFx(0, dur + 0.5, (u) => {        // 바닥 안개
      const a = 0.35 * Math.min(1, u * 4) * (1 - Math.max(0, u - 0.7) / 0.3);
      ctx.fillStyle = `rgba(125,255,176,${a})`;
      for (let k = 0; k < 16; k++) { const x = end + ((k * 37 + clock * 30) % Math.max(1, x0 - end)); ctx.beginPath(); ctx.ellipse(x, gy - 4, 26, 7, 0, 0, Math.PI * 2); ctx.fill(); }
    });
    for (let n = 0; n < 5; n++) {
      raidFx(n * 0.07, dur, (u) => {
        const x = lerp(x0, end, u) + n * 10, y = gy - 4 - (n % 2) * 6, bob = Math.sin(clock * 16 + n) * 2;
        ctx.globalAlpha = 0.6 * (1 - u * 0.4);
        ctx.fillStyle = '#cfe8d8';
        ctx.fillRect(Math.round(x) - 5, Math.round(y - 24 + bob), 10, 9);                 // 머리
        ctx.fillRect(Math.round(x) - 6, Math.round(y - 15 + bob), 12, 10);                // 몸
        for (let t = 0; t < 4; t++) ctx.fillRect(Math.round(x) - 6 + t * 3 + 2, Math.round(y - 5 + bob), 2, 3 + (t % 2) * 2);   // 너덜너덜한 자락
        ctx.fillStyle = '#7dffb0'; ctx.fillRect(Math.round(x) - 3, Math.round(y - 21 + bob), 2, 2);   // 눈
        ctx.fillStyle = '#e9e4d4'; ctx.fillRect(Math.round(x) - 14, Math.round(y - 13 + bob), 9, 2);   // 칼
        ctx.globalAlpha = 1;
        if (Math.random() < 0.3) px(x + rand(4, 10), y - rand(4, 20), 2, '#7dffb0', 0.6);
      });
    }
    raidAoeHits(e, def, (i) => Math.max(0, (x0 - raidKnightX(i)) / speed), ['#7dffb0', '#cfe8d8', '#ffffff']);
  },
});
