// 봇 우회 (수치 아님): 타격이 없는 스킬(hits = [])에 '한 번 더(twin)' 룬이 끼면 src/tree7.js t7Shape 의 big([]) 가 undefined 라 터진다
//  (lifespan-bot 21일 archon 시드에서 dpsOf → heroSkill → t7Shape). 게임 쪽 수정은 별건 — 여기선 터지면 룬 모양 없이 원래 스킬을 돌려준다
var _t7sG = t7Shape, t7GuardHits = 0;
t7Shape = function (sk, k) { try { return _t7sG(sk, k); } catch (e) { t7GuardHits++; return k; } };
