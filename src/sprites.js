'use strict';
// 통짜 스프라이트 시트 직업 (파이터 계열, docs/specs/boxer-class.md 9절): 조립식 몸통·팔·다리 대신 PixelLab 시트 한 장.
//  시트: src/sprites/<cls>.png — 동작마다 한 줄, 프레임 64×64 가로. 기준점 (32, 58) = 발 가운데 = 땅. 오른쪽만 그렸고 왼쪽은 좌우 반전.
//  메타: src/sprites/<cls>.json 을 묶은 src/sprites/meta.js 의 SHEET_META[cls] = { anims: { key: { row, frames, fps, loop, hit } }, pts: { key: [[손x, 손y, 머리x, 머리y], …] } }
//        (Electron 이 file:// 로 열려 JSON 을 fetch 할 수 없어서 JS 로 묶는다 — node dev/boxer/sheet-meta.js)
//  1 시트 픽셀 = 고해상 도트 1칸 = 화면 PX/2 (1.5px). 지금 기사와 화면 크기가 같다.
//  drawHero 가 look.sheet 직업이면 여기로 온다 (world.js). 스킬 자세의 dx·lift·skew·sx·sy 는 그림 전체에 변형으로,
//  pose.sheet = { anim, frame } 또는 { anim, u 0~1 } 이면 그 동작을 그린다 (스킬 연출 SKILL_FX 의 pose 가 준다).
//  pose.tint 한 색 실루엣(잔상) · pose.onlyWeapon 아무것도 안 그림(무기가 그림 안에 있다) · pose.flash 흰색으로 덮기.

const SHEET_DOT = PX / 2;
const SHEETS = {};
// 기존 직업 시트 스위치 (docs/specs/legacy-class-sheets.md): 시트(SHEET_META)가 있어도 여기 true 인 직업만 시트로 그린다.
//  false·빠짐 = 예전 조립식 (body2·limbs·motion·cuts 는 지우지 않는다). 계열 세션마다 자기 직업 줄만 더한다. 실행 중 SHEET_ON.x = false 로 바로 비교.
//  주소에 ?sheets=0 이면 전부 끈다 (전후 비교). ?sheetsOn=직업,직업 이면 그 직업만 켠다 (켜기 전 게임에서 시험 — 오프라인 게임·스킬 시험장 모두)
const SHEET_ON = {
  // 레인저 계열 (칸 96 · 공성포수 128, dev/bowsheets) — 시트를 사용자가 승인하면 true
  ranger: true, marksman: true, arcaneArcher: true, arbalest: true, deadeye: true, voidArcher: true, siegeMaster: true,
  // 창기사 계열 (칸 128, 원형 마네킹 → 입히기·덧그리기 dev/spear/gen.py·build.py) — 시트 있음, 켤지 사용자 확인 (false)
  lancer: true, dragoon: true, halberdier: true, cavalier: true, dragonlord: true, warlord: true, skyGeneral: true,
  // 마법사 계열 (칸 96, dev/sheets-mage — 시험: dev/skills.html?patch=sheets-mage) — 시트를 사용자가 승인하면 true
  mage: true, pyromancer: true, cryomancer: true, electromancer: true, archmage: true, frostlord: true, thunderEmperor: true,
  // 검사 계열 + 견습 (칸 장검·쌍검 96 · 대검 128, 원형 마네킹 → 입히기·덧그리기 dev/sheets-sword/build.py) — 2026-10-16 검수 미달(몸·팔이 거의 안 움직이고 칼만 돎)로 다시 끔. 시트 파일은 남김
  squire: true, swordsman: true, paladin: true, blademaster: true, greatswordsman: true, archon: true, swordsaint: true, tyrant: true,
  // 파이터 계열 새 그림체 (그림체 B·키 46, 칸 96, dev/boxer/b) — <직업>B 시트. true 면 지금 시트(<직업>) 대신 그린다. 사용자 확인 전 false
  fighterB: false, strikerB: false, kickboxerB: false, qigongB: false, tempestB: false, grandmasterB: false,
};
if (typeof location !== 'undefined' && /[?&]sheets=0/.test(location.search || '')) for (const k in SHEET_ON) SHEET_ON[k] = false;
if (typeof location !== 'undefined') { const m = /[?&]sheetsOn=([\w,]+)/.exec(location.search || ''); if (m) for (const k of m[1].split(',')) SHEET_ON[k] = true; }
// 그릴 시트 이름: 파이터 계열은 새 그림체 <직업>B 가 켜져 있으면 그것 (SHEET_ON.fighterB 또는 ?sheetsOn=fighterB)
const sheetKey = (id) => (SHEET_ON[id + 'B'] && typeof SHEET_META !== 'undefined' && SHEET_META[id + 'B'] ? id + 'B' : id);
// 이 직업을 시트로 그리나 (파이터 계열 look.sheet 는 항상)
function heroSheetOn(id) {
  const c = CLASSES[id];
  return !!c && (!!c.look.sheet || (!!SHEET_ON[id] && typeof SHEET_META !== 'undefined' && !!SHEET_META[id]));
}
// 머리 위 이름표·체력바·스킬 아이콘 높이 (땅에서 위로, 화면 px). 조립식 = 58.
//  시트 직업은 대기 프레임의 머리 위(pts head y, 후광 포함)에서 6px 위 — 키를 키운 새 그림(1.3배, 스펙 legacy-class-sheets.md)도 머리와 안 겹친다
const HERO_TOP = 58;
function heroTop(cls) {
  if (!heroSheetOn(cls)) return HERO_TOP;
  const m = SHEET_META[sheetKey(cls)], hs = m.pts && m.pts.idle;
  if (!hs || !hs.length) return HERO_TOP;
  const ft = m.foot || [32, 58], top = Math.min(...hs.map((p) => p[3]));
  return Math.max(HERO_TOP, Math.round((ft[1] - top) * SHEET_DOT + 6));
}
const sheetBase = (() => {
  const s = typeof document !== 'undefined' && document.currentScript && document.currentScript.src;
  return s ? s.replace(/[^/]*$/, '') + 'sprites/' : 'src/sprites/';
})();
// 지연 생성·캐시 (zoneBg 처럼). 진행 봇 vm(가짜 document)에선 Image 가 없으니 아무것도 안 한다
function sheetOf(cls) {
  if (SHEETS[cls]) return SHEETS[cls];
  const meta = typeof SHEET_META !== 'undefined' && SHEET_META[cls];
  const s = (SHEETS[cls] = { meta, img: null, ok: false, tint: new Map() });
  if (meta && typeof Image !== 'undefined') {
    s.img = new Image();
    s.img.onload = () => { s.ok = true; };
    s.img.src = sheetBase + cls + '.png' + (meta.v ? '?v=' + meta.v : '');
  }
  return s;
}

// 지금 그릴 동작과 프레임 { anim, f }
function sheetFrame(meta, pose) {
  const A = meta.anims, has = (k) => !!A[k];
  const loopF = (k, t) => Math.floor(t * (A[k].fps || 8)) % A[k].frames;
  const onceF = (k, u) => Math.max(0, Math.min(A[k].frames - 1, Math.floor(u * A[k].frames)));
  if (pose.sheet && has(pose.sheet.anim)) {
    const k = pose.sheet.anim, sp = pose.sheet;
    return { anim: k, f: sp.frame != null ? Math.max(0, Math.min(A[k].frames - 1, sp.frame)) : sp.u != null ? onceF(k, sp.u) : loopF(k, pose.t || 0) };
  }
  // 기존 직업의 스킬 자세 (SKILL_FX pose 의 wa·pull 등): cast 줄에서 그 값이 가장 가까운 프레임 (cast.key = 자세 값 이름, cast.val = 프레임마다 값).
  //  key 가 없으면 cast 를 반복. 몸의 dx·lift·skew·sx·sy 는 drawHeroSheet 가 그림 전체에 준다
  //  활·석궁: 하늘로 겨눈 자세(bowA ≤ -0.55, 화살비·포격)는 castUp 줄이 있으면 그 줄에서 같은 식으로 고른다
  if (has('cast') && (pose.wa != null || pose.pull != null || pose.bowA != null)) {     // bowA: 지팡이·활 기울기 (마법사 계열은 cast.key = 'bowA')
    const k = has('castUp') && (pose.bowA || 0) <= -0.55 ? 'castUp' : 'cast', c = A[k];
    if (c.key && c.val && pose[c.key] != null) {
      // wrap: 값이 각도(라디안)라 한 바퀴 돌면 같은 자세 (할버드 대회전처럼 wa 가 ±2π 를 넘는 스킬)
      const v = pose[c.key], T = Math.PI * 2, dist = (a) => c.wrap ? Math.abs((((a - v + Math.PI) % T) + T) % T - Math.PI) : Math.abs(a - v);
      let best = 0;
      for (let i = 1; i < c.val.length; i++) if (dist(c.val[i]) < dist(c.val[best])) best = i;
      return { anim: k, f: Math.min(c.frames - 1, best) };
    }
    return { anim: k, f: loopF(k, pose.t || 0) };
  }
  if (pose.down > 0 && has('death')) {                    // 쓰러짐: 다시 일어설 때까지 마지막 프레임 유지
    const u = Math.min(1, (DEFEAT_DOWN_SEC - pose.down) / 0.7);
    return { anim: 'death', f: onceF('death', u) };
  }
  if (pose.mode === 'sit' && has('sit')) return { anim: 'sit', f: loopF('sit', pose.t || 0) };
  if (pose.dash && has('dash')) return { anim: 'dash', f: loopF('dash', pose.t || 0) };
  if (pose.mode === 'walk' && has('walk')) return { anim: 'walk', f: Math.floor((pose.walkT || 0) * (A.walk.fps || 10)) % A.walk.frames };
  if (pose.mode === 'stand' || pose.mode === 'idle') return { anim: 'idle', f: loopF('idle', pose.t || 0) };
  if (pose.recoil > 0.35 && has('hurt')) return { anim: 'hurt', f: pose.recoil > 0.7 ? 0 : 1 };
  if (pose.swing >= 0) {
    // 평타 2종 번갈아 (knight.combo). 타격 프레임(hit)이 평타 타격 시점(근접 35% · 원거리 45%)에 오게 나눈다
    const k = (pose.combo || 0) % 2 && has('atkB') ? 'atkB' : 'atkA', a = A[k], hit = a.hit != null ? a.hit : Math.floor(a.frames / 2);
    const hs = pose.ranged ? 0.45 : 0.35, s = pose.swing;
    const f = s < hs ? Math.floor(s / hs * hit) : hit + Math.floor((s - hs) / (1 - hs) * (a.frames - hit));
    return { anim: k, f: Math.max(0, Math.min(a.frames - 1, f)) };
  }
  return { anim: has('guard') ? 'guard' : 'idle', f: loopF(has('guard') ? 'guard' : 'idle', pose.t || 0) };
}

// 한 색으로 칠한 시트 (잔상·실루엣). 색마다 한 번 만든다
function sheetTinted(s, color) {
  if (s.tint.has(color)) return s.tint.get(color);
  const cv = document.createElement('canvas');
  cv.width = s.img.naturalWidth; cv.height = s.img.naturalHeight;
  const g = cv.getContext('2d');
  g.drawImage(s.img, 0, 0);
  g.globalCompositeOperation = 'source-in';
  g.fillStyle = color; g.fillRect(0, 0, cv.width, cv.height);
  s.tint.set(color, cv);
  return cv;
}

function drawHeroSheet(g, id, x, gy, pose) {
  if (pose.onlyWeapon) return;
  const s = sheetOf(sheetKey(id)), meta = s.meta, fx = CLASSES[id].look.fx;
  const facing = pose.facing < 0 ? -1 : 1, D = SHEET_DOT;
  if (!s.ok && s.img && s.img.complete && s.img.naturalWidth) s.ok = true;
  const sf = s.ok && meta ? sheetFrame(meta, pose) : null, lean = CLASSES[id].look.lean;
  // look.lean: 평타 뒷손 스트레이트(atkB) 타격 두 장에서 몸을 앞으로 더 숙인다 (허리·어깨 회전 — 잽과 구분)
  const leanOn = lean && sf && !meta.noLean && !pose.sheet && sf.anim === 'atkB' && Math.abs(sf.f - (meta.anims.atkB.hit || 1) - 0.5) <= 0.5;
  const dx = Math.round(pose.dx || 0) + (leanOn ? 3 : 0), lift = pose.lift || 0, sx = pose.sx || 1, sy = pose.sy || 1, skew = (pose.skew || 0) + (leanOn ? lean : 0);
  g.save();
  g.globalAlpha *= pose.alpha == null ? 1 : pose.alpha;
  g.imageSmoothingEnabled = false;
  g.translate(Math.round(x + dx * facing), Math.round(gy - lift));
  g.scale(facing, 1);
  if (skew) g.transform(1, 0, -skew, 1, 0, 0);          // 앞(+)으로 기울면 위쪽이 앞으로
  g.scale(sx, sy);
  if (!s.ok || !meta) {
    // 아직 못 불러왔다: 직업색 실루엣만 (몸 크기 대략)
    g.fillStyle = pose.tint || fx;
    g.globalAlpha *= 0.22;
    g.fillRect(-7 * D, -34 * D, 14 * D, 34 * D);
    g.restore();
    return;
  }
  // 앉기 줄이 없는 기존 직업 시트는 마을·캠프 앉기를 예전 조립식으로 (스펙: sit 는 기존 앉기 유지 가능)
  if (pose.mode === 'sit' && !meta.anims.sit && !CLASSES[id].look.sheet && typeof drawHeroRaw === 'function') { g.restore(); return drawHeroRaw(g, id, x, gy, pose); }
  const { anim, f } = sf, a = meta.anims[anim];
  const src = pose.tint ? sheetTinted(s, pose.tint) : s.img;
  const W = meta.w || 64, H = meta.h || 64, ft = meta.foot || [32, 58];
  g.drawImage(src, f * W, a.row * H, W, H, -ft[0] * D, -ft[1] * D, W * D, H * D);
  if (pose.flash) {
    // 피격 번쩍임: 흰 실루엣을 반투명으로 덮는다 (짧게 — 검흔·명중 그림이 묻히지 않게)
    g.globalAlpha *= 0.55;
    g.drawImage(sheetTinted(s, '#ffffff'), f * W, a.row * H, W, H, -ft[0] * D, -ft[1] * D, W * D, H * D);
  }
  if (!pose.tint) sheetStaffGlow(g, id, meta, anim, f, pose.pull || 0);
  g.restore();
}
// 지팡이 구슬 빛 (마법사 계열): 시트에는 구슬만 그리고 빛은 여기서 hand 점(= 구슬 가운데)에 얹는다.
//  pull(0~13, 스킬이 마력을 모은 정도)만큼 커지고 짙어진다 — 조립식 drawStaff 의 빛과 같은 크기·색
function sheetStaffGlow(g, id, meta, anim, f, pull) {
  const w = WEAPONS[CLASSES[id].weapon], st = w && w.staff, P = st && (meta.pts[anim] || [])[f];
  if (!P) return;
  const ft = meta.foot || [32, 58], D = SHEET_DOT, k = Math.min(1, pull / 12), R = PX * (1.1 + 0.9 * k);
  const ox = (P[0] - ft[0]) * D, oy = (P[1] - ft[1]) * D;
  g.fillStyle = `rgba(${st.glowRgb},${0.16 + 0.22 * k})`;
  g.beginPath(); g.arc(ox, oy, R * (1.8 + 0.8 * k), 0, Math.PI * 2); g.fill();
}

// 지금 그리는 프레임의 기준점(hand·head)을 화면 좌표로. pose 가 없으면 내 기사의 지금 모습
function sheetPoint(cls, which, x, gy, facing = 1, pose = null) {
  const s = sheetOf(sheetKey(cls)), meta = s.meta;
  if (!meta) return [x + facing * 6 * PX, gy - 6 * PX];
  pose = pose || { mode: knight.fighting ? 'fight' : 'walk', swing: knight.swing, combo: knight.combo, t: clock, walkT: knight.walkT, ranged: heroWeapon().kind === 'ranged', ...(castPose('hero') || {}) };
  const { anim, f } = sheetFrame(meta, pose), P = (meta.pts[anim] || [])[f], ft = meta.foot || [32, 58], D = SHEET_DOT;
  if (!P) return [x + facing * 6 * PX, gy - 6 * PX];
  const px = which === 'head' ? P[2] : P[0], py = which === 'head' ? P[3] : P[1];
  return [x + facing * ((pose.dx || 0) + (px - ft[0]) * D * (pose.sx || 1)), gy - (pose.lift || 0) + (py - ft[1]) * D * (pose.sy || 1)];
}
// 원거리(기공사) 평타가 나가는 자리 = 손바닥 끝 (world.js heroMuzzle)
const sheetMuzzle = (cls, x, gy, facing) => sheetPoint(cls, 'hand', x, gy, facing);
// 미리 받아 둔다 (처음 그릴 때 아직 없으면 실루엣만 보이므로)
if (typeof SHEET_META !== 'undefined') for (const id in SHEET_META) sheetOf(id);
