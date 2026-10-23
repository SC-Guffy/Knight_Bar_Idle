const {makeGame}=require('../../progress-bot.js');const vm=require('vm');
const c=makeGame();console.log(vm.runInContext('JSON.stringify({cls:TREE7_CLS.length, slots:T7_SLOTS})',c));
