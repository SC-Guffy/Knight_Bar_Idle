const vm=require('vm');const {makeGame}=require('../../progress-bot.js');
const ctx=makeGame('.');const R=(s)=>vm.runInContext(s,ctx);
console.log(R('JSON.stringify({tb:MENTOR_TRY_BOOKS, odds:MENTOR_ODDS, pity:MENTOR_PITY, n:MENTORS.length})'));
console.log('castle up total', R('CASTLE_UP_IDS.length*Array.from({length:10},(_,n)=>castleUpCostAt(n)).reduce((a,b)=>a+b,0)'));
console.log('sweep bricks L', R('[1,10,20,30].map(L=>L+":"+castleBricksOf(L,CASTLE_FULL_PTS)+"/"+castleBooksEv(L,10).toFixed(2))'));
// castle fail vs sweep
console.log(R(`(()=>{const out=[];for(const best of [10,20,29]){const sw=castleBricksOf(best,CASTLE_FULL_PTS), swb=castleBooksEv(best,10);
 for(const held of [3,5,7,9]){let pts=0;for(let i=0;i<held;i++){pts+=CASTLE_WAVES[i].n+(CASTLE_WAVES[i].b?10:0)}; const L=best+1; out.push(best+'->'+L+' held'+held+': bricks '+castleBricksOf(L,pts)+' vs sweep '+sw+', books '+castleBooksEv(L,held).toFixed(2)+' vs '+swb.toFixed(2));}}return out.join('\\n')})()`));
