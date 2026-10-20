'use strict';
// 연출 등급표 전후 비교 캡처 (docs/specs/skill-vfx.md "연출 등급표"). dev/skills.html?patch=vfx-tier-probe 로 불러온다.
//  await TIERSHOOT(TIERJOBS(), 'before'|'after', 포트) → 스킬마다 시전 띠 PNG (dev/review/vfx-tier/<tag>-<name>.png) + 측정값 배열
//  측정: 시전 동안 impact 가 남긴 게임 정지(hitstop)·흔들림(shake) 최대, 이름 띠(cutin)·궁극기 컷인이 떴는지
//  받는 쪽: dev/shot-recv.py 를 포트만 바꿔 띄운다 (python -I <복사본> dev/review/vfx-tier)
(() => {
  // impact 를 감싸 시전 중 최대 정지·흔들림을 잰다 (호출부는 전역 impact 를 부르므로 바꿔치기가 먹힌다)
  const rec = { stop: 0, shake: 0, cut: false };
  const imp0 = window.impact;
  window.impact = function (o) { const h0 = hitstop, s0 = shake; imp0(o); rec.stop = Math.max(rec.stop, hitstop - h0 > 0 ? hitstop : 0); rec.shake = Math.max(rec.shake, shake - s0 > 0 ? shake : 0); };
  window.TIERJOBS = () => {
    const J = [];
    const pairs = [
      ['swordsman', 'steelCleave', '검사 1차 강철 베기'], ['blademaster', 'gale', '검성 2차 질풍난무'],
      ['lancer', 'piercingThrust', '창기사 1차 관통 찌르기'], ['dragoon', 'dragonFall', '용기병 2차 용추락'],
      ['ranger', 'rapidFire', '레인저 1차 연사'], ['marksman', 'headshot', '저격수 2차 헤드샷'],
      ['mage', 'manaBurst', '마법사 1차 마력 폭발'], ['pyromancer', 'meteor', '화염술사 2차 메테오'],
      ['fighter', 'oneTwo', '파이터 1차 원투 스트레이트'], ['striker', 'ironRush', '스트라이커 2차 연타 러시'],
    ];
    for (const [cls, id, label] of pairs) for (const st of [2, 3]) J.push({ name: `${id}-${st}`, cls, id, st, label });
    const L = T7_LINES.swordsaint;
    for (const st of [1, 2]) J.push({ name: `fusion-${st + 1}`, cls: L.cls[2], id: L.sk.f_ab, st, label: '검신 융합 ' + SKILLS[L.sk.f_ab].name });
    return J;
  };
  window.TIERSHOOT = async (jobs, tag, port = 8835, { n = 8, dt = 0.14 } = {}) => {
    const t = window.skillTest, cv = document.getElementById('c'), out = [];
    for (const j of jobs) {
      try {
        t.setClass(j.cls); t.state.skill = j.id; t.state.lock = true; t.setStage(j.st);
        t.step(0.8);
        rec.stop = 0; rec.shake = 0; rec.cut = false;
        t.cast(j.id);
        // 기사 기준 게임 px 320×(전체 높이)를 잘라 2배로 담는다 (캔버스는 화면 배율만큼 크다)
        const z = cv.width / W, gw = Math.min(W, 320), kx = toScreen(knight.x);
        const sx = Math.max(0, Math.min(W - gw, kx - 110)) * z, sw = gw * z, sh = cv.height, w = gw * 2, h = Math.round(sh / z * 2);
        const strip = document.createElement('canvas'); strip.width = w * n + (n - 1) * 4; strip.height = h;
        const g = strip.getContext('2d'); g.imageSmoothingEnabled = false; g.fillStyle = '#111420'; g.fillRect(0, 0, strip.width, h);
        for (let i = 0; i < n; i++) {
          for (let f = 0; f < Math.round(dt * 60); f++) { t.step(1 / 60); if (cutin || ultIntro) rec.cut = true; }
          g.drawImage(cv, sx, 0, sw, sh, i * (w + 4), 0, w, h);
        }
        const r = await fetch(`http://127.0.0.1:${port}/save?name=${tag}-${j.name}`, { method: 'POST', body: strip.toDataURL('image/png') });
        out.push({ name: j.name, label: j.label, st: j.st, stop: +rec.stop.toFixed(3), shake: +rec.shake.toFixed(3), cutin: rec.cut, ok: r.ok });
      } catch (e) { out.push({ name: j.name, err: String(e).slice(0, 160) }); }
    }
    return out;
  };
})();
