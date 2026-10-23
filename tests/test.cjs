const fs=require('fs'),vm=require('vm'),assert=require('assert');const elements={};function el(k){return elements[k]??=( {innerHTML:'',textContent:'',style:{},showModal(){},close(){},elements:{kind:{value:'reading'},container:{value:''}}})}const sandbox={document:{querySelector:el},localStorage:{getItem:()=>null,setItem(){}},crypto:require('crypto').webcrypto,console,setTimeout:()=>0,window:{scrollTo(){}}};vm.createContext(sandbox);vm.runInContext(fs.readFileSync('../app/src/main/assets/www/timeline-dates.js','utf8'),sandbox);vm.runInContext(fs.readFileSync('../app/src/main/assets/www/history.js','utf8'),sandbox);vm.runInContext(fs.readFileSync('../app/src/main/assets/www/app.js','utf8'),sandbox);vm.runInContext(`
const assert=(b,m)=>{if(!b)throw Error(m)};
assert(state.containers[0].slots===12,'12 tote slots');assert(state.containers[1].capacity===.5,'jar capacity');
const c=state.containers[0];assert(assignSlot(c.id,null)===1,'first slot');state.plants.push({id:'test',name:'Basil',stage:'Seedling',containerId:c.id,slot:1,variety:'',started:'2026-10-21'});assert(assignSlot(c.id,null)===2,'next slot');let blocked=false;try{assignSlot(c.id,1)}catch{blocked=true}assert(blocked,'occupied slot blocked');
addEvent('reading','Test','pH 6',c.id,active(c.id).map(p=>p.id));state.plants[0].containerId=state.containers[1].id;assert(state.events[0].plantIds.includes('test'),'history retained after moving');
state.plants[0].stage='Archived';assert(active(state.containers[1].id).length===0,'archived frees slot');validateBackup(JSON.parse(JSON.stringify(state)));let broken=JSON.parse(JSON.stringify(state));broken.containers[0].slots=-1;blocked=false;try{validateBackup(broken)}catch{blocked=true}assert(blocked,'invalid backup rejected');
for(const p of ['Overview','Containers','Plants','Timeline','Settings'])navigate(p);navigate('Container',c.id);navigate('Plant','test');
console.log('PASS: slot allocation, occupied slot protection, movement history, archived occupancy, backup validation, all page rendering');
`,sandbox);


