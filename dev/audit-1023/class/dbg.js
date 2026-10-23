process.stderr.write('start\n');
const vm=require('vm');
const {ctx}=require('./rt.js');
process.stderr.write('loaded '+typeof process.exit+'\n');
