(async()=>{
const assert=(v,m)=>{if(!v)throw Error(m)},clone=x=>JSON.parse(JSON.stringify(x));
async function submit(v,fail=false){await $('#form').onsubmit({preventDefault(){},target:v});const error=$('#error').textContent;if(fail){assert(!!error,'Expected rejected edit');return}if(error)throw Error(error)}
const a=state.containers[0],b=state.containers[1],c=state.containers[2];
editPlant(null,a.id,1);await submit({name:'Basil',variety:'',stage:'Seedling',started:'2026-01-01',containerId:a.id,slot:1,notes:'Keep these notes'});
const pid=state.plants[0].id;
async function move(cid,when){movePlant(pid);await submit({destination:cid,slot:1,occurredAt:when,notes:'Move notes'})}
await move(b.id,'2026-02-01T10:00');await move(c.id,'2026-03-01T10:00');await move(a.id,'2026-02-15T10:00');
assert(plant(pid).containerId===c.id,'Backdated move cannot override later move');
assert(positionAt(state,plant(pid),'2026-02-10T12:00').containerId===b.id,'Dated occupancy resolves earlier container');
async function reading(cid,time,manual=false){logEntry(cid);await submit({container:cid,kind:'reading',ph:5.8,occurredAt:time,linkMode:manual?'manual':'auto',linkedPlant:manual?[pid]:[]});return state.events.find(e=>e.kind==='reading'&&localActivityInput(e.time)===time)}
const early=await reading(a.id,'2026-01-10T10:00');assert(early.plantIds.includes(pid),'Backdated care follows original container');
const auto=await reading(b.id,'2026-02-10T10:00'),manual=await reading(b.id,'2026-02-11T10:00',true);
const firstMove=state.events.find(e=>e.kind==='move'&&e.placement.containerId===b.id);
editEventDate(firstMove.id);await submit({occurredAt:'2026-02-12T10:00'});
assert(!auto.plantIds.includes(pid),'Move date correction updates automatic care links');
assert(manual.plantIds.includes(pid),'Explicit manual links preserved');
changeStage(pid);await submit({stage:'Harvested',occurredAt:'2026-02-20T10:00',notes:'Harvest'});
const afterHarvest=await reading(a.id,'2026-02-25T10:00');assert(!afterHarvest.plantIds.includes(pid),'Harvested plants excluded on that date');
changeStage(pid);await submit({stage:'Vegetative',occurredAt:'2026-03-02T10:00',notes:'Regrowth'});
assert(plant(pid).stage==='Vegetative'&&plant(pid).containerId===c.id,'Later stage and location independent');
const beforeCollision=JSON.stringify(state);
editPlant(null,a.id,1);await submit({name:'Collision',variety:'',stage:'Seedling',started:'2026-01-05',containerId:a.id,slot:1},true);
assert(JSON.stringify(state)===beforeCollision,'Historical collision rolls back complete edit');
assert(plant(pid).notes==='Keep these notes','Plant notes preserved');
const legacy=clone(state);delete legacy.historyVersion;delete legacy.historySequence;
for(const p of legacy.plants){delete p.historyOrigin;delete p.historyAnchor}
for(const e of legacy.events){delete e.placement;delete e.stageChange;delete e.association}
legacy.containers[0].volume=17;const original=clone(legacy);
initializeHistory(legacy,'2026-10-01T12:00:00Z');const once=JSON.stringify(legacy);initializeHistory(legacy,'2026-10-02T12:00:00Z');assert(JSON.stringify(legacy)===once,'Migration idempotent');
for(let i=0;i<original.events.length;i++){assert(legacy.events[i].detail===original.events[i].detail,'Original notes retained');assert(JSON.stringify(legacy.events[i].plantIds)===JSON.stringify(original.events[i].plantIds),'Original associations retained')}
recalculateHistory(legacy,'2026-10-02T12:00:00Z');assert(legacy.containers[0].volume===17,'Legacy current volume retained');assert(legacy.plants[0].containerId===original.plants[0].containerId&&legacy.plants[0].stage===original.plants[0].stage,'Legacy current plant preserved');
assert(historicalMembers(legacy,b.id,'2026-02-13T10:00').uncertain.includes(pid),'Incomplete legacy stages explicitly unknown');
const fresh=initial(),v=fresh.containers[0];
fresh.events=[{id:'base',kind:'container',time:'2026-01-01',recordedAt:'2026-01-01',plantIds:[],containerId:v.id,volumeSnapshot:{amount:1,unit:'gal'}},{id:'one',kind:'water',time:'2026-01-03',recordedAt:'2026-01-03',plantIds:[],containerId:v.id,water:{amount:2,unit:'gal',mode:'topup',beforeVolume:1,resultVolume:3}},{id:'two',kind:'water',time:'2026-01-02',recordedAt:'2026-01-04',plantIds:[],containerId:v.id,water:{amount:3,unit:'gal',mode:'topup',beforeVolume:3,resultVolume:6}}];
recalculateHistory(fresh);assert(v.volume===6,'Reordered top-ups never double-count stale before/result values');
v.unit='L';v.capacity=100;recalculateHistory(fresh);assert(Math.abs(v.volume-22.712470704)<1e-8,'Container unit change preserves actual volume');
const noSnapshot=initial(),nc=noSnapshot.containers[0];noSnapshot.events=[{id:'old',kind:'water',title:'Old water',detail:'Unstructured original note',containerId:nc.id,plantIds:[],time:'2026-01-01'}];recalculateHistory(noSnapshot);assert(nc.volume===null,'Unstructured legacy text not guessed');
const tied=initial(),tc=tied.containers[0];tied.events=[{id:'t2',kind:'water',time:'2026-01-01',recordedAt:'2026-01-01',historyOrder:2,containerId:tc.id,plantIds:[],water:{amount:1,unit:'gal',mode:'topup'}},{id:'t1',kind:'water',time:'2026-01-01',recordedAt:'2026-01-01',historyOrder:1,containerId:tc.id,plantIds:[],water:{amount:3,unit:'gal',mode:'replace'}}];recalculateHistory(tied);assert(tc.volume===4,'Identical timestamps have deterministic order');
console.log('PASS: historical moves, stages, automatic/manual links, collisions, data-preserving legacy migration, unknown-history review, stable reservoir replay and units.');
})();
