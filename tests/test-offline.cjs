const fs=require('fs'),vm=require('vm'),elements={};let disk=null,previous=null,checkpoint=null,fail=false;
const el=k=>elements[k]??={innerHTML:'',textContent:'',style:{},showModal(){this.open=true},close(){this.open=false},insertAdjacentHTML(){},elements:{kind:{value:'reading'},container:{value:''}}};
const sandbox=vm.createContext({document:{querySelector:el},localStorage:{getItem:()=>null,setItem(){},length:0},RootedNative:{readState:()=>JSON.stringify({ok:true,value:disk}),writeState:s=>{if(fail)return 'Disk full';previous=disk;disk=s;return ''},checkpoint:()=>{checkpoint=disk;return ''},readRecovery:kind=>JSON.stringify({ok:true,value:kind==='previous'?previous:checkpoint})},crypto:require('crypto').webcrypto,console,setTimeout(){},window:{scrollTo(){}},FormData:class{constructor(v){this.v=v}get(k){return this.v[k]??''}}});
for(const f of ['timeline-dates.js','history.js','app.js'])vm.runInContext(fs.readFileSync('../app/src/main/assets/www/'+f,'utf8'),sandbox);
(async()=>{
await vm.runInContext('(async()=>{'+
"const assert=(b,m)=>{if(!b)throw Error(m)};const c=state.containers[0];"+
"async function water(amount,mode,time){logEntry(c.id);await $('#form').onsubmit({preventDefault(){},target:{container:c.id,kind:'water',amount,mode,unit:'gal',occurredAt:time}});if($('#error').textContent)throw Error($('#error').textContent)}"+
"await water('5','replace','2026-10-10T10:00');await water('2','topup','2026-10-12T10:00');await water('3','replace','2026-10-11T10:00');assert(container(c.id).volume===5,'Backdated replacement replays later top-up');"+
"const replacement=state.events.find(e=>e.water?.amount===3);editEventDate(replacement.id);await $('#form').onsubmit({preventDefault(){},target:{occurredAt:'2026-10-13T10:00'}});assert(container(c.id).volume===3,'Date correction recomputes volume');"+
"state.plants.push({id:'protected',name:'Keep me',variety:'',stage:'Seedling',started:'2026-01-01',containerId:c.id,slot:1});save();offerRestore(initial());assert(state.plants.length===1,'Import requires explicit confirmation');await $('#form').onsubmit({preventDefault(){},target:{}});assert(state.plants.length===0,'Confirmed import replaces');reviewRecovery('checkpoint');await $('#form').onsubmit({preventDefault(){},target:{}});assert(state.plants[0].name==='Keep me','Checkpoint restores');"+
"console.log('PASS: dated reservoir replay, date correction, confirmed restore and protected copy.');"+
'})()',sandbox);
const before=vm.runInContext('JSON.stringify(state)',sandbox);fail=true;try{vm.runInContext("commit(()=>{state.plants[0].name='Lost'})",sandbox)}catch{}
if(vm.runInContext('JSON.stringify(state)',sandbox)!==before)throw Error('Failure did not roll back');
console.log('PASS: failed disk save rolls back in-memory data.');
})();

