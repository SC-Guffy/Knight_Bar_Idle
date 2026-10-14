'use strict';
// skill-vfx.html 의 "⑤-1 마법사 계열" 절 (다른 계열 세션과 html 충돌을 줄이려고 따로 둔다). <div id="vfx1Block"> 에 그린다.
(() => {
  const el = document.getElementById('vfx1Block');
  if (!el) return;
  const SV = '../vfx-survey/', AF = '../vfx-survey/vfx1/', SK = '../skills.html';
  const im = (src, cap) => `<img src="${src}" data-zoom="${cap}" style="width:100%;image-rendering:pixelated;cursor:zoom-in;border-radius:4px;background:#000;display:block" onerror="this.style.opacity=.25">`;
  const play = (cls, id, st) => `<a href="${SK}?cls=${cls}&skill=${id}&stage=${st}" target="_blank">${['Lv1', '★', '★★', '★★★'][st]}</a>`;
  const SKILLS = [
    ['mage', 'manaBurst', '마력 폭발', 'E04 마름모 노바 · E04b 마력 기둥 · C9 마법진(★★★ 는 셋을 기울여 자이로) · K04 겹 마름모 파열'],
    ['pyromancer', 'meteor', '메테오', 'E33 운석 · E34 돔 폭발 + 용암 웅덩이 · K23 용암 튐 · C3 열기 고리 · F16 땅불'],
    ['pyromancer', 'flameVortex', '화염 회오리', 'E35 불 회오리 루프 · E36 불꽃 꽃 · K24 소용돌이 불티 · Lv1 불기둥 = F16 토막 · 불구름 = C15 불빛 램프'],
    ['cryomancer', 'iceLance', '얼음창 (교체)', 'E37 얼음창 · E37b 거대 빙창 · K25 얼음 꽂힘 + 서리꽃 · 파편 P9 · 서리 E39b'],
    ['cryomancer', 'blizzard', '블리자드', 'E38 눈보라 타일 · E39 프리즘 결정 군 · E39b 영구 동토 빙판 · K26 서리 막 · C15 서리 구름'],
    ['electromancer', 'chainLightning', '연쇄 번개 (1점 → 교체)', '번개 줄 = P11 타일 · E41 구전 · E40 번개 손 · K27 연결 지점 방전. ★★★ 피니시 = 대상끼리 가로로 잇는 사슬 (위에서 꽂지 않는다)'],
    ['electromancer', 'thunderstorm', '낙뢰 (피니시 분리)', 'C15 먹구름 · E42 기둥 번개 · K28 착탄. ★★★ 피니시 = 하늘 균열 + 거대 기둥이 위에서 꽂힌다'],
    ['archmage', 'apocalypse', '종언의 겁화', 'F16 불바다 루프 · F17 붉은 태양 붕괴 · K38 하얀 불의 벽 · E33/P8 운석·겁화탄 · E34 폭발 · C9 하늘 마법진'],
    ['frostlord', 'absoluteZero', '절대영도', 'F18 빙하 산맥 + 오로라 · F19 거대 눈꽃(얼음 시계판) · F19b 유리 금 · K39 결빙 → 산산조각 · P10 빙하 파편'],
    ['thunderEmperor', 'thunderJudgment', '뇌제 강림 (1점 → 새 콘셉트)', 'F20 뇌신 거인 · F21 번개 왕좌 · K40 왕관 번개 · P12 금빛 번개 타일 · C15 먹구름. 낙뢰 부품은 쓰지 않는다'],
  ];
  const BASICS = [['mage', '마법사', 'W8 · P4 마력탄 · H05 마름모 파열'], ['pyromancer', '화염술사', 'P7 둥근 불덩이 · H15 불꽃 꽃'], ['archmage', '대마도사 (3차)', 'P8 길쭉한 겁화 혜성 · H27 땅에서 솟는 겁화 기둥'],
    ['cryomancer', '빙결술사', 'P9 짧은 결정 · H16 결정 파쇄'], ['frostlord', '빙결의 군주 (3차)', 'P10 긴 빙하 창끝 · H28 땅에서 솟는 빙하 가시'],
    ['electromancer', '뇌전술사', 'P11 가는 연보라 번개 · H17 가지 친 방전'], ['thunderEmperor', '뇌제 (3차)', 'P12 굵은 금빛 마디 번개 · H29 왕관 방전']];
  const SHEETS = ['w8', 'h05', 'h15', 'h16', 'h17', 'h27', 'h28', 'h29', 'p4', 'p7', 'p8', 'p9', 'p10', 'p11', 'p12', 'e04', 'e04b', 'k04', 'c9', 'e33', 'e34', 'k23', 'e35', 'e36', 'k24',
    'e37', 'e37b', 'k25', 'e38', 'e39', 'e39b', 'k26', 'e40', 'e41', 'k27', 'e42', 'k28', 'c15', 'c3', 'f16', 'f17', 'k38', 'f18', 'f19', 'f19b', 'k39', 'f20', 'f21', 'k40'];
  const N = { table: '<table class="md-table"><tr><th>10분 사냥 골드 (시드 48개 합)</th><th>전</th><th>후</th><th>차</th><th>게임 정지 초 (8시간)</th></tr><tr><td>마법사 ★★★</td><td>1,479,856</td><td>1,473,098</td><td>−0.46%</td><td>252.1 → 250.2</td></tr><tr><td>화염술사 ★★★</td><td>3,960,991</td><td>3,965,709</td><td>+0.12%</td><td>633.2 → 633.4</td></tr><tr><td>빙결술사 ★★★</td><td>4,203,136</td><td>4,133,665</td><td>−1.65%</td><td>968.3 → 969.6</td></tr><tr><td>뇌전술사 Lv1</td><td>3,347,041</td><td>3,344,543</td><td>−0.07%</td><td>261.4 → 260.8</td></tr><tr><td>뇌전술사 ★★★</td><td>4,050,783</td><td>3,985,326</td><td>−1.62%</td><td>1102.4 → 1103.1</td></tr><tr><td>대마도사 Lv1</td><td>5,692,101</td><td>5,815,393</td><td>+2.17%</td><td>366.6 → 366.7</td></tr><tr><td>대마도사 ★★★</td><td>5,573,290</td><td>5,583,090</td><td>+0.18%</td><td>1184.9 → 1193.4</td></tr><tr><td>빙결의 군주 ★★★</td><td>5,697,815</td><td>5,832,545</td><td>+2.36%</td><td>1652.3 → 1653.0</td></tr><tr><td>뇌제 Lv1</td><td>5,236,058</td><td>5,263,414</td><td>+0.52%</td><td>449.6 → 448.9</td></tr><tr><td>뇌제 ★★★</td><td>5,739,464</td><td>5,695,365</td><td>−0.77%</td><td>1611.5 → 1616.5</td></tr></table><div class="sub">진행을 정하는 게임 정지 시간은 전후가 같다(차 ≤ 0.03%, 타격 정지 값은 하나도 안 바꿨다). 골드 ±2.4% 는 VFX 가 난수를 쓰는 횟수가 달라져 같은 시드라도 사냥 내용이 갈라지는 잡음 (⑤-0 과 같은 현상).</div><table class="md-table"><tr><th>프레임 비용 (tick+render ms, 600프레임 평균, 같은 앞 탭)</th><th>전</th><th>후</th></tr><tr><td>마법사 평타</td><td>1.36</td><td>1.34</td></tr><tr><td>화염술사 평타</td><td>1.36</td><td>1.42</td></tr><tr><td>뇌전술사 평타</td><td>1.41</td><td>1.42</td></tr><tr><td>뇌제 평타</td><td>1.49</td><td>1.43</td></tr><tr><td>메테오 ★★★</td><td>1.48</td><td>1.32</td></tr><tr><td>블리자드 ★★★</td><td>1.46</td><td>1.38</td></tr><tr><td>연쇄 번개 ★★★</td><td>1.50</td><td>1.34</td></tr><tr><td>종언의 겁화 ★★★</td><td>2.29</td><td>1.54</td></tr><tr><td>절대영도 ★★★</td><td>1.76</td><td>1.52</td></tr><tr><td>뇌제 강림 ★★★</td><td>1.79</td><td>1.59</td></tr></table><table class="md-table"><tr><th>하단바 양 끝 40px 밝기 변화 최대 (Lv1 · ★★★, 기준 ±0.05)</th><th>전</th><th>후</th></tr><tr><td>마력 폭발</td><td>0.003 · 0.022</td><td>0.002 · 0.022</td></tr><tr><td>메테오</td><td>0.004 · 0.026</td><td>0.002 · 0.063</td></tr><tr><td>화염 회오리</td><td>0.004 · 0.024</td><td>0.004 · 0.076</td></tr><tr><td>얼음창</td><td>0.003 · 0.025</td><td>0.004 · 0.027</td></tr><tr><td>블리자드</td><td>0.004 · 0.032</td><td>0.005 · 0.050</td></tr><tr><td>연쇄 번개</td><td>0.004 · 0.209</td><td>0.004 · 0.139</td></tr><tr><td>낙뢰</td><td>0.066 · 0.353</td><td>0.013 · 0.263</td></tr></table><div class="sub">넘는 값은 모두 <b>오른쪽 끝만</b> 어두워진 것(왼쪽 끝 ≤ 0.021): 시뮬레이터 폭이 360px 라 대상이 오른쪽 끝 가까이 있고, 폭발 연기·불벽·옛 코드부터 있던 구간 어둡게(dimSpan)가 오른쪽 40px 에 걸친다. 하단바 전체 덮개는 없다. 연쇄 번개·낙뢰는 전보다 줄었다.</div>' };
  el.innerHTML = `
  <div class="sub">이번 패치(⑤-1)의 결과물입니다. 줄마다 <b>왼쪽 = 전(조사 캡처)</b>, <b>오른쪽 = 후</b>. ▶ 링크는 그 스킬만 반복 재생합니다 (속도 ×0.25 로 보면 잘 보입니다).
    시트는 PixelLab 원본(밝기 5단)을 직업 속성 램프로 다시 칠해 씁니다 — 아래 갤러리는 원본 시트.</div>
  <h3>스펙 ⑤-1 핵심 반영</h3>
  <ul>
    <li><b>1점 둘 교체</b>: 연쇄 번개(해파리 같던 뇌신의 손 → 도트 번개 손 E40 + 가로 사슬 피니시), 뇌제 강림(낙뢰 부품 재조립 → 뇌신 거인 F20·번개 왕좌 F21·왕관 번개 K40).</li>
    <li><b>얼음창 교체</b>: 벡터 다각형 + shadowBlur → E37 얼음창·E37b 거대 빙창·K25 명중.</li>
    <li><b>낙뢰 피니시 ≠ 연쇄 번개</b>: 낙뢰 ★★★ = 위에서 꽂는 하늘 균열 + 거대 기둥(E42), 연쇄 번개 ★★★ = 대상끼리 옆으로 잇는 사슬(K27 이음매).</li>
    <li><b>뇌전 색을 빙결과 띄움</b>: 뇌전술사 #b7e3ff(연청) → 연보라 + 연노랑 빛 램프, 뇌제 → 금빛 램프. 빙결은 청백 그대로.</li>
    <li><b>3차 평타 탄 ≠ 2차</b>: 대마도사 P8 길쭉한 혜성 + H27 솟는 기둥 / 빙결의 군주 P10 긴 창끝 + H28 빙하 가시 / 뇌제 P12 굵은 금빛 번개 + H29 왕관.</li>
  </ul>
  <h3>스킬 10종 — 전 / 후</h3>
  ${SKILLS.map(([cls, id, name, memo]) => `<div class="card" style="margin:0 0 12px"><div class="head"><b>${name}</b><span class="tag">${cls}</span><span class="play">▶ ${[0, 1, 2, 3].map((s) => play(cls, id, s)).join(' ')}</span></div>
    <div class="memo">${memo}</div>
    <div class="shots" style="grid-template-columns:repeat(2,1fr)">
      <figure>${im(SV + id + '-b.png', name + ' ★★★ 전')}<figcaption>★★★ 전</figcaption></figure><figure>${im(AF + id + '-b-after.png', name + ' ★★★ 후')}<figcaption>★★★ 후 (막타 3프레임 뒤)</figcaption></figure>
      <figure>${im(SV + id + '-l1.png', name + ' Lv1 전')}<figcaption>Lv1 전</figcaption></figure><figure>${im(AF + id + '-l1-after.png', name + ' Lv1 후')}<figcaption>Lv1 후</figcaption></figure>
    </div>
    <div class="shots">${['a', 'c', 's1', 's2'].map((k) => `<figure>${im(AF + id + '-' + k + '-after.png', name + ' ' + k)}<figcaption>${{ a: '★★★ 준비', c: '★★★ 여운', s1: '★ 막타', s2: '★★ 막타' }[k]}</figcaption></figure>`).join('')}</div></div>`).join('')}
  <h3>평타 7종 — 전 / 후</h3>
  ${BASICS.map(([cls, name, memo]) => `<div class="card" style="margin:0 0 12px"><div class="head"><b>${name}</b><span class="tag">${cls}</span><span class="play">▶ <a href="${SK}?mode=basic&cls=${cls}" target="_blank">평타</a></span></div>
    <div class="memo">${memo}</div>
    <div class="shots" style="grid-template-columns:repeat(4,1fr)"><figure>${im(SV + 'basic-' + cls + '-b.png', name + ' 전')}<figcaption>전 (명중)</figcaption></figure>
      ${['a', 'b', 'c'].map((k) => `<figure>${im(AF + 'basic-' + cls + '-' + k + '-after.png', name + ' 후 ' + k)}<figcaption>후 ${{ a: '날아가는 중', b: '명중', c: '명중 뒤' }[k]}</figcaption></figure>`).join('')}</div></div>`).join('')}
  <h3>계열 비교 — 컬러 · 흑백 (줄 = 2차 3종 + 3차 3종, 칸 = 스킬 둘 + 평타)</h3>
  <div class="fam">
    <figure>${im(SV + 'family-mage.png', '전 컬러')}<figcaption>전 — 컬러</figcaption></figure><figure>${im(AF + 'family-mage-after.png', '후 컬러')}<figcaption>후 — 컬러</figcaption></figure>
    <figure>${im(SV + 'family-mage-gray.png', '전 흑백')}<figcaption>전 — 흑백</figcaption></figure><figure>${im(AF + 'family-mage-after-gray.png', '후 흑백')}<figcaption>후 — 흑백</figcaption></figure>
  </div>
  <h3>측정</h3>
  <div>${N.table || '<span class="sub">측정 중</span>'}</div>
  <h3>시트 (PixelLab 원본, ${SHEETS.length}장)</h3>
  <div class="fam" style="grid-template-columns:repeat(auto-fill,minmax(150px,1fr))">${SHEETS.map((k) => `<figure><img src="../../src/vfx/${k}.png" data-zoom="${k.toUpperCase()}" style="width:100%;image-rendering:pixelated;background:#0b0d14;cursor:zoom-in"><figcaption>${k.toUpperCase()}</figcaption></figure>`).join('')}</div>`;
})();
