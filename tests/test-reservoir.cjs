const fs=require('fs'),vm=require('vm');
const elements={};const el=k=>elements[k]??={innerHTML:'',textContent:'',style:{},showModal(){this.open=true},close(){this.open=false},elements:{kind:{value:'reading'},container:{value:''}}};
const context=vm.createContext({document:{querySelector:el},localStorage:{getItem:()=>null,setItem(){}},crypto:require('crypto').webcrypto,console,setTimeout(){},window:{scrollTo(){}},FormData:class{constructor(values){this.values=values}get(k){return this.values[k]??''}}});
vm.runInContext(fs.readFileSync('../app/src/main/assets/www/timeline-dates.js','utf8'),context);vm.runInContext(fs.readFileSync('../app/src/main/assets/www/history.js','utf8'),context);vm.runInContext(fs.readFileSync('../app/src/main/assets/www/app.js','utf8'),context);
(async()=>{await vm.runInContext(`(async()=>{
const assert=(b,m)=>{if(!b)throw Error(m)},near=(a,b)=>Math.abs(a-b)<1e-9;
const tote=state.containers[0],jar=state.containers[1],soil=state.containers[3];
state.plants.push({id:'basil',name:'Basil',variety:'',stage:'Seedling',started:'2026-08-01',containerId:tote.id,slot:1});
async function submit(cid,values,expectError=false){logEntry(cid);await $('#form').onsubmit({preventDefault(){},target:{container:cid,occurredAt:'2026-10-20T10:00',...values}});const error=$('#error').textContent;if(expectError){assert(!!error,'Expected validation failure')}else if(error)throw Error(error)}
assert(near(convertVolume(3,'tsp','tbsp'),1),'three tsp per tablespoon');assert(near(convertVolume(16,'cup','gal'),1),'cups per gallon');assert(near(convertVolume(4,'qt','L'),3.785411784),'quart to liter');assert(near(convertVolume(1000,'mL','L'),1),'mL to liter');assert(near(convertVolume(128,'fl oz','gal'),1),'fluid ounces per gallon');
await submit(tote.id,{kind:'water',mode:'replace',amount:'4',unit:'qt',ph:'5.8',ec:'1.4',ppm:'700',scale:'500',temp:'68',tempUnit:'F',dose0:'0.5',doseUnit0:'tsp',dose1:'1',doseUnit1:'tbsp',dose2:'2',doseUnit2:'g',notes:'Fresh mix'});
const combined=state.events[0];assert(near(tote.volume,1),'replacement converts volume');assert(combined.kind==='water'&&combined.doses.length===3&&combined.readings.ec===1.4,'single combined water event');assert(combined.plantIds.includes('basil'),'shared plant history');assert(combined.detail.includes('0.5 tsp')&&combined.detail.includes('1 tbsp')&&combined.detail.includes('Fresh mix'),'original doses and notes retained');assert(latest(tote.id).ph===5.8,'combined measurement updates latest');
await submit(tote.id,{kind:'water',mode:'topup',amount:'2',unit:'cup',occurredAt:'2026-10-21T10:00'});assert(near(tote.volume,1.125),'topup converted');assert(latest(tote.id).ph===5.8,'no readings does not erase latest');
await submit(tote.id,{kind:'water',mode:'replace',amount:'1',unit:'gal',ph:'6.5',occurredAt:'2026-09-01T09:00'});assert(latest(tote.id).ph===5.8,'backdated reservoir reading is not newest');
let before=JSON.stringify(state);await submit(tote.id,{kind:'water',mode:'replace',amount:'120',unit:'qt',dose0:'1',doseUnit0:'tsp'},true);assert(JSON.stringify(state)===before,'overflow rolls back complete event');
before=JSON.stringify(state);await submit(tote.id,{kind:'water',mode:'replace',amount:'2',unit:'gal',ph:'15'},true);assert(JSON.stringify(state)===before,'invalid measurements roll back volume');
await submit(jar.id,{kind:'water',mode:'topup',amount:'100',unit:'mL'});assert(container(jar.id).volume===null,'unknown volume stays unknown');
await submit(jar.id,{kind:'water',mode:'replace',amount:'1',unit:'pt'});assert(near(container(jar.id).volume,0.125),'jar replacement in pints');
await submit(soil.id,{kind:'water',mode:'topup',amount:'500',unit:'mL'});assert(container(soil.id).volume===null,'soil remains without reservoir volume');
await submit(soil.id,{kind:'nutrients',dose0:'0.25',doseUnit0:'tsp',dose1:'100',doseUnit1:'mg',water:'2',waterUnit:'cup',occurredAt:'2026-10-21T11:00'});assert(state.events[0].feedUnit==='cup'&&state.events[0].doses[0].unit==='tsp','soil nutrient and feed units');assert(container(soil.id).volume===null,'feeding context never adds water twice');
before=JSON.stringify(state);await submit(soil.id,{kind:'nutrients',dose0:'-1',doseUnit0:'tsp'},true);assert(JSON.stringify(state)===before,'negative nutrient rejected');
const restored=JSON.parse(JSON.stringify(state));validateBackup(restored);assert(restored.events.find(e=>e.id===combined.id).doses[1].unit==='tbsp','backup preserves combined units');
$('#form').elements={kind:{value:'water'},container:{value:tote.id}};careFields();assert($('#care-fields').innerHTML.includes('Final solution measurements')&&$('#care-fields').innerHTML.includes('Nutrients added')&&$('#care-fields').innerHTML.includes('tbsp / tbs'),'reservoir fields shown');
$('#form').elements.container.value=soil.id;careFields();assert(!$('#care-fields').innerHTML.includes('Final solution measurements'),'soil watering remains clear');
console.log('PASS: combined reservoir care, unit conversions, fractional doses, latest/backdated readings, shared history, soil compatibility, atomic validation and backups.');
})()`,context)})().catch(e=>{console.error(e);process.exitCode=1});

