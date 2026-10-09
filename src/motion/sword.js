'use strict';
// 검 계열 평타 연속기 (장검·기사검·성검·성좌검) — 새 뼈대(두 마디 팔·관절 다리·머리/가슴/골반 분리·어깨선 비틀기)에 맞춰 잡은 첫 계열.
// 원칙: 무기는 손이 끄는 대로만 돈다. 손이 머리 뒤로 올라가면 팔꿈치가 꺾이며 검이 등 뒤로 넘어가고, 내려치면 팔·검이 한 호를 그린다.
//  몸은 예비동작에서 뒤로 젖혀 고개를 들고(hs 음수) 등이 보이게 살짝 돌며(sx < 1), 타격에 앞으로 숙이고 가슴을 열며(sx > 1) 고개를 떨군다(hs 양수).
//  다리는 예비동작에서 뒷발에 무게를 싣고, 타격에 앞발을 크게 내디뎌 런지(ff 앞으로, bf 뒤로), 올려베기 끝엔 뒷발이 들린다.
//  타격 판정은 s = 0.35 (world.js fightTick) — 그 순간 검이 앞을 지나도록 키를 잡는다.
//  키: s 진행도 · h 앞손 [x, y] 칸 · wa 검 각도(0 = 앞, 음수 = 위) · dx 디딤 · skew 몸 기울기 · sy 세로 · sx 비틀기 · lift 뜀 · hs 머리 기울기 · hd 머리 이동 [x, y] 칸 · ff/bf 앞발·뒷발 [앞 x, 위 y] 칸 · e 이징
//  연속기는 평타마다 차례로 돈다: 1 내려베기 → 2 올려베기 → 3 찌르기

// ── 컷 (절충안, 2026-10) ──
// 평타 한 번을 4~5컷으로 끊어 컷마다 자세를 든다(홀드). 팔·다리는 손도트 그림(limbs.js ARM_CUT·LEG_CUT)을 컷마다 골라 붙이고,
// 머리·몸통·망토는 지금처럼 코드가 기울기(skew)·비틀기(sx → 정면/옆/등 그림)·머리 숙임(hs·hd)·망토 펄럭임(cape)을 입힌다.
//  until: 이 컷이 끝나는 진행도 · fa/ba: 앞팔·뒷팔 그림 · legs: 다리 그림 · wa: 칼 각도(0 앞, 음수 위) · smear: 이 컷에 앞 컷에서부터 칼이 지나온 자리를 그린다
//  dx 디딤(px) · skew 몸 기울기 · sy 세로 · sx 비틀기(< 0.95 옆모습, < 0.86 등) · lift 뜀(px) · hs 머리 기울기 · hd 머리 이동 [x, y] 칸 · cape 망토가 뒤로 날리는 정도(0~1)
//  원칙: 예비동작은 두 컷(들기 → 끝까지 젖힘, 젖힌 컷을 가장 길게) → 타격 한 컷(스미어) → 팔로스루 한 컷 → 거두기 한 컷. 타격 판정 s = 0.35 는 늘 타격 컷 안
const SW_READY = { fa: 'rest', ba: 'bRest', legs: 'set', wa: -1.0, dx: 0, skew: 0.02, sy: 1, sx: 1, hs: 0, hd: [0, 0], cape: 0.1 };
const SW_RECOVER = { fa: 'recover', ba: 'bRecover', legs: 'recover', wa: -0.6, dx: 2, skew: 0.08, sy: 0.98, sx: 1, hs: 0.04, hd: [0.1, 0.15], cape: 0.35 };
const SW_DOWN_CUTS = [
  { until: 0.1,  fa: 'raise',   ba: 'bRest',      legs: 'set',       wa: -1.75, dx: -1, skew: -0.06, sy: 1.02, sx: 0.97, hs: -0.04, hd: [-0.1, -0.1],  cape: 0.15 },
  { until: 0.3,  fa: 'windup',  ba: 'bGuard',     legs: 'load',      wa: -2.5,  dx: -3, skew: -0.2,  sy: 1.05, sx: 0.9,  hs: -0.1,  hd: [-0.35, -0.3], cape: -0.05 },
  { until: 0.42, fa: 'strike',  ba: 'bFling',     legs: 'lunge',     wa: 0.55,  dx: 4,  skew: 0.32,  sy: 0.92, sx: 1.06, hs: 0.16,  hd: [0.4, 0.6],    cape: 0.95, smear: true },
  { until: 0.66, fa: 'follow',  ba: 'bFlingHigh', legs: 'lunge',     wa: 0.35,  dx: 4,  skew: 0.26,  sy: 0.93, sx: 1.03, hs: 0.12,  hd: [0.3, 0.5],    cape: 0.7 },
  { until: 1, ...SW_RECOVER },
];
const SW_UP_CUTS = [
  { until: 0.1,  fa: 'lowBack', ba: 'bGuard',     legs: 'crouch',    wa: 2.6,   dx: -2, skew: -0.08, sy: 0.95, sx: 0.93, hs: -0.02, hd: [-0.1, 0.2],   cape: 0.1 },
  { until: 0.3,  fa: 'lowBack', ba: 'bGuard',     legs: 'crouch',    wa: 2.85,  dx: -3, skew: -0.14, sy: 0.9,  sx: 0.9,  hs: -0.05, hd: [-0.25, 0.35], cape: 0.0 },
  { until: 0.42, fa: 'scoop',   ba: 'bFling',     legs: 'rise',      wa: -1.05, dx: 4,  skew: 0.2,   sy: 1.06, sx: 1.05, lift: 3, hs: 0, hd: [0.3, -0.3], cape: 0.9, smear: true },
  { until: 0.66, fa: 'high',    ba: 'bFling',     legs: 'rise',      wa: -1.95, dx: 4,  skew: 0.08,  sy: 1.05, sx: 1.02, lift: 2, hs: -0.04, hd: [0.1, -0.4], cape: 0.75 },
  { until: 1, ...SW_RECOVER },
];
const SW_THRUST_CUTS = [
  { until: 0.1,  fa: 'chamber', ba: 'bPoint',     legs: 'load',      wa: -0.05, dx: -2, skew: -0.12, sy: 0.97, sx: 0.92, hs: -0.03, hd: [-0.2, 0],    cape: 0.1 },
  { until: 0.32, fa: 'chamber', ba: 'bPoint',     legs: 'load',      wa: 0,     dx: -4, skew: -0.2,  sy: 0.95, sx: 0.88, hs: -0.05, hd: [-0.3, 0],    cape: 0.0 },
  { until: 0.44, fa: 'thrust',  ba: 'bBack',      legs: 'lungeDeep', wa: 0.02,  dx: 8,  skew: 0.38,  sy: 0.88, sx: 1.08, hs: -0.02, hd: [0.4, 0.1],   cape: 1.0, smear: 'tip' },
  { until: 0.64, fa: 'thrust',  ba: 'bBack',      legs: 'lungeDeep', wa: 0.05,  dx: 7,  skew: 0.32,  sy: 0.9,  sx: 1.05, hs: -0.02, hd: [0.3, 0.1],   cape: 0.8 },
  { until: 1, ...SW_RECOVER },
];

// 1 내려베기: 검을 머리 옆·위로 끌어 올리며 뒷발에 무게(고개 들림) → 앞발을 크게 내디디며 온몸으로 내리찍는다(고개 숙임·무릎 굽힘)
const SW_DOWN = (burst) => ({ cuts: SW_DOWN_CUTS, ready: SW_READY, trail: [0.27, 0.5], ...(burst ? { burst: [0.35, burst, 1.1] } : {}), keys: atkKeys(SWORD_REST,
  { s: 0.12, h: [-0.6, -5.4], wa: -2.1,  dx: -2, skew: -0.14, sy: 1.03, sx: 0.94, hs: -0.07, hd: [-0.2, -0.2],   ff: [-1, 0],    bf: [-1.5, 0], e: 'o' },
  { s: 0.22, h: [-1.2, -7.2], wa: -2.6,  dx: -3, skew: -0.2,  sy: 1.05, sx: 0.9,  hs: -0.1,  hd: [-0.35, -0.35], ff: [-1.5, 0.6], bf: [-2, 0] },
  { s: 0.28, h: [1.2, -6.2],  wa: -1.5,  dx: 0,  skew: 0.02,  sy: 1.02, sx: 1,    hs: 0.01,  hd: [0, 0],         ff: [1.5, 0.4],  bf: [-2, 0],   e: 'i' },
  { s: 0.35, h: [3.0, -0.8],  wa: 0.8,   dx: 6,  skew: 0.3,   sy: 0.9,  sx: 1.06, hs: 0.16,  hd: [0.4, 0.6],     ff: [3.5, 0],    bf: [-2.5, 0], e: 'l' },
  { s: 0.45, h: [2.4, 1.3],   wa: 1.28,  dx: 6,  skew: 0.26,  sy: 0.92, sx: 1.04, hs: 0.14,  hd: [0.3, 0.6],     ff: [3.5, 0],    bf: [-2.5, 0] },
  { s: 0.64, h: [1.4, 0.8],   wa: 1.0,   dx: 4,  skew: 0.14,  sy: 0.97, sx: 1,    hs: 0.06,  hd: [0.15, 0.2],    ff: [2, 0],      bf: [-1.5, 0], e: 'o' }) });
// 2 올려베기: 검을 허리 뒤로 내리고 웅크렸다가(등이 보이게 돌아감) 몸을 펴며 아래에서 위로 퍼올린다 (살짝 뜨고 뒷발이 들린다)
const SW_UP = (burst) => ({ cuts: SW_UP_CUTS, ready: SW_READY, trail: [0.27, 0.5], ...(burst ? { burst: [0.35, burst, 1.0] } : {}), keys: atkKeys(SWORD_REST,
  { s: 0.12, h: [-1.5, 1.0],  wa: 2.3,   dx: -2, skew: -0.1,  sy: 0.95, sx: 0.95, hs: -0.03, hd: [-0.15, 0.2],   ff: [1, 0],    bf: [-1.5, 0], e: 'o' },
  { s: 0.22, h: [-2.4, 1.8],  wa: 2.6,   dx: -3, skew: -0.16, sy: 0.9,  sx: 0.9,  hs: -0.05, hd: [-0.25, 0.35],  ff: [1.5, 0],  bf: [-2, 0] },
  { s: 0.28, h: [0.6, 1.6],   wa: 1.25,  dx: 1,  skew: 0,     sy: 0.98, sx: 1,    hs: 0,     hd: [0, 0.15],      ff: [2, 0],    bf: [-2, 0],   e: 'i' },
  { s: 0.35, h: [3.0, -2.6],  wa: -1.15, dx: 6,  skew: 0.22,  sy: 1.08, sx: 1.05, hs: 0.04,  hd: [0.3, -0.3],    ff: [2.5, 0],  bf: [-2.5, 1.5], lift: 3, e: 'l' },
  { s: 0.45, h: [2.0, -5.0],  wa: -1.9,  dx: 5,  skew: 0.1,   sy: 1.06, sx: 1.03, hs: -0.03, hd: [0.15, -0.5],   ff: [2.5, 0],  bf: [-2, 1],   lift: 2 },
  { s: 0.64, h: [1.0, -3.6],  wa: -1.6,  dx: 3,  skew: 0.05,  sy: 1.02, sx: 1,    hs: 0,     hd: [0, -0.15],     ff: [1.5, 0],  bf: [-1.5, 0], e: 'o' }) });
// 3 찌르기: 어깨를 비틀어 검을 뒤로 당겼다가(등이 보인다) 깊은 런지로 몸을 낮추며 쭉 찌른다 — 앞다리 굽히고 뒷다리는 쭉
const SW_THRUST = (burst) => ({ cuts: SW_THRUST_CUTS, ready: SW_READY, trail: [0.3, 0.42], ...(burst ? { burst: [0.35, burst, 0.9] } : {}), keys: atkKeys(SWORD_REST,
  { s: 0.14, h: [-2.4, -1.2], wa: -0.25, dx: -3, skew: -0.16, sy: 0.96, sx: 0.88, hs: -0.04, hd: [-0.25, 0],    ff: [-0.5, 0],  bf: [-1.5, 0], e: 'o' },
  { s: 0.24, h: [-3.0, -1.4], wa: -0.2,  dx: -4, skew: -0.2,  sy: 0.95, sx: 0.85, hs: -0.05, hd: [-0.3, 0],     ff: [-1, 0.5],  bf: [-2, 0] },
  { s: 0.35, h: [4.6, -1.5],  wa: 0.0,   dx: 9,  skew: 0.38,  sy: 0.86, sx: 1.1,  hs: -0.02, hd: [0.4, 0.1],    ff: [5, 0],     bf: [-3, 0],   e: 'i' },
  { s: 0.48, h: [4.0, -1.3],  wa: 0.05,  dx: 8,  skew: 0.32,  sy: 0.88, sx: 1.06, hs: -0.02, hd: [0.3, 0.1],    ff: [5, 0],     bf: [-3, 0],   e: 'l' },
  { s: 0.66, h: [2.0, -1.0],  wa: -0.3,  dx: 4,  skew: 0.15,  sy: 0.97, sx: 1,    hs: 0.05,  hd: [0.15, 0.15],  ff: [2.5, 0],   bf: [-2, 0],   e: 'o' }) });

Object.assign(HERO_ATK, {
  // 견습 기사: 투박한 내려베기 ↔ 짧은 찌르기 (두 동작)
  sword: [SW_DOWN(), SW_THRUST()],
  // 검사: 내려베기 → 올려베기 → 찌르기 세 동작 연속기
  knightSword: [SW_DOWN(), SW_UP(), SW_THRUST()],
  // 성기사·성좌기사: 같은 연속기에 타격마다 황금 섬광
  holySword: [SW_DOWN('255,215,90'), SW_UP('255,215,90'), SW_THRUST('255,215,90')],
  starBlade: [SW_DOWN('200,230,255'), SW_UP('200,230,255'), SW_THRUST('200,230,255')],
});
