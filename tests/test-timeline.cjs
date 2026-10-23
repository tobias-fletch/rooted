const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');const elements={};const el=k=>elements[k]??={innerHTML:'',textContent:'',style:{},showModal(){this.open=true},close(){this.open=false},elements:{kind:{value:'reading'},container:{value:''}}};let persisted=null;const context=vm.createContext({document:{querySelector:el},localStorage:{getItem:()=>null,setItem:(k,v)=>persisted=v},crypto:require('crypto').webcrypto,console,setTimeout(){},window:{scrollTo(){}},FormData:class{constructor(values){this.values=values}get(k){return this.values[k]??''}}});
vm.runInContext(fs.readFileSync('../app/src/main/assets/www/timeline-dates.js','utf8'),context);vm.runInContext(fs.readFileSync('../app/src/main/assets/www/history.js','utf8'),context);vm.runInContext(fs.readFileSync('../app/src/main/assets/www/app.js','utf8'),context);
(async()=>{await vm.runInContext(`(async()=>{
const assert=(b,m)=>{if(!b)throw Error(m)};
const c=state.containers[0];
async function submit(values){await $('#form').onsubmit({preventDefault(){},target:values});if($('#error').textContent)throw Error($('#error').textContent)}
editPlant(null,c.id,1);await submit({name:'Basil',variety:'Genovese',stage:'Seedling',started:'2026-09-04',containerId:c.id,slot:'1',notes:''});
assert(state.events[0].time==='2026-09-04','birth uses started date');const p=state.plants[0],birthId=state.events[0].id,birthRecorded=state.events[0].recordedAt;
editPlant(p.id);await submit({name:'Basil',variety:'Genovese',stage:'Seedling',started:'2026-08-20',notes:''});
assert(state.events.length===1 && state.events[0].id===birthId && state.events[0].time==='2026-08-20','edit start moves original event without metadata entry');
assert(state.events[0].recordedAt===birthRecorded,'creation timestamp retained privately');
addEvent('reading','Newer reading','',c.id,[p.id],{time:'2026-10-15T15:00:00Z',readings:{ph:6.1}});
addEvent('reading','Older reading entered later','',c.id,[p.id],{time:'2026-09-15T15:00:00Z',readings:{ph:5.7}});
assert(latest(c.id).ph===6.1,'latest uses activity time');
const older=state.events.find(e=>e.title==='Older reading entered later');const originalRecorded=older.recordedAt;
editEventDate(older.id);await submit({occurredAt:'2026-10-20T09:30'});
assert(state.events[0].id===older.id && older.recordedAt===originalRecorded && latest(c.id).ph===5.7,'date correction reorders and updates latest reading');
editEventDate(birthId);await submit({started:'2026-08-01'});assert(p.started==='2026-08-01' && state.events.find(e=>e.id===birthId).time==='2026-08-01','birth edit keeps plant in sync');
const html=timeline(state.events);assert(!html.includes('recordedAt'),'log timestamps not displayed');assert(html.indexOf('Older reading entered later')<html.indexOf('Newer reading'),'timeline sorts occurrence dates');
const backup=JSON.parse(JSON.stringify(state));validateBackup(backup);normalizeTimeline(backup);assert(backup.events.find(e=>e.id===birthId).time==='2026-08-01','backup retains corrected start');
const legacy={...backup,events:[{id:'legacy',kind:'plant',title:'A new beginning',detail:'Old',plantIds:[p.id],containerId:c.id,time:'2026-10-21T12:00:00Z'},{id:'metadata',kind:'plant',title:'Plant details updated',detail:'Updated',plantIds:[p.id],containerId:c.id,time:'2026-10-21T13:00:00Z'}]};normalizeTimeline(legacy);assert(legacy.events.find(e=>e.id==='legacy').time===p.started,'legacy migration');assert(visibleTimelineEvents(legacy.events).length===1,'metadata-only edits hidden');const once=JSON.stringify(legacy);normalizeTimeline(legacy);assert(JSON.stringify(legacy)===once,'migration idempotent');
assert(validCalendarDate('2024-02-29')&&!validCalendarDate('2026-02-29'),'calendar validation');let rejected=false;try{readActivityTime({get:()=> '2026-02-30T10:00'})}catch{rejected=true}assert(rejected,'invalid activity date rejected');assert(localActivityInput('2026-08-01')==='2026-08-01T00:00','date-only local midnight');assert(date('2026-08-01').includes('2026')&&!date('2026-08-01').includes(':'),'start displays day not artificial time');
for(const renderPage of ['Overview','Containers','Plants','Timeline','Settings'])navigate(renderPage);navigate('Container',c.id);navigate('Plant',p.id);
console.log('PASS: backdated plant start, editing start and event dates, latest readings by occurrence, stable migration, backup, date-only rendering, invalid dates, all views.');
})()`,context);assert.ok(persisted)} )().catch(e=>{console.error(e);process.exitCode=1});

