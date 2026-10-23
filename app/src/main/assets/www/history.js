/* History v2: dated facts, explicit unknown legacy history, and immutable tie order.
   Migration is additive and never writes disk at startup. */
function historyOrder(a,b){
 return activityMillis(a.time)-activityMillis(b.time)
  || Date.parse(a.recordedAt||a.time)-Date.parse(b.recordedAt||b.time)
  || (a.historyOrder||0)-(b.historyOrder||0) || String(a.id).localeCompare(String(b.id));
}
function initializeHistory(d,now=new Date(Math.floor(Date.now()/60000)*60000).toISOString()){
 if(d.historyVersion===2)return d;
 if(d.historyVersion!=null)throw Error('This journal needs a newer version of Rooted.');
 d.historyVersion=2;d.historyMigratedAt=now;
 let order=0;for(const e of [...d.events].reverse().sort((a,b)=>activityMillis(a.time)-activityMillis(b.time)||Date.parse(a.recordedAt||a.time)-Date.parse(b.recordedAt||b.time)))e.historyOrder=++order;
 d.historySequence=order;
 for(const p of d.plants){
  const birth=d.events.find(e=>isPlantStart(e)&&e.plantIds.includes(p.id));
  p.historyOrigin={time:p.started,containerId:birth?birth.containerId||null:null,slot:null,stage:null,known:!!birth};
  p.historyAnchor={time:now,containerId:p.containerId||null,slot:p.slot??null,stage:p.stage,known:true};
 }
 for(const c of d.containers)c.historyVolumeAnchor={time:now,amount:c.volume??null,unit:c.unit};
 return d;
}
function buildHistoryIndex(d){
 const index=new Map(d.plants.map(p=>[p.id,[]]));
 for(const e of d.events)if(e.kind==='move'||e.kind==='stage')for(const id of e.plantIds)index.get(id)?.push(e);
 for(const p of d.plants)if(p.historyAnchor)index.get(p.id).push({...p.historyAnchor,id:'anchor-'+p.id,recordedAt:p.historyAnchor.time,historyAnchor:true});
 for(const list of index.values())list.sort(historyOrder);
 return index;
}
function positionAt(d,p,at,index){
 const time=typeof at==='string'?at:at.time;
 if(activityMillis(time)<activityMillis(p.started))return null;
 const base=p.historyOrigin||{time:p.started,containerId:p.containerId||null,slot:p.slot??null,stage:p.stage,known:true};
 let pos={...base};
 const events=index?.get(p.id)||buildHistoryIndex({...d,plants:d.plants.map(q=>q.id===p.id?p:q)}).get(p.id)||[];
 for(const e of events){
  if(activityMillis(e.time)>activityMillis(time))break;
  if(typeof at==='object'&&activityMillis(e.time)===activityMillis(time)&&historyOrder(e,at)>0)continue;
  if(e.historyAnchor){pos={...e};continue}
  if(e.kind==='move'){
   if(e.placement)pos={...pos,...e.placement,known:true};
   else pos={...pos,containerId:e.containerId||null,slot:null,known:true};
  }
  if(e.kind==='stage')pos={...pos,stage:e.stageChange?.stage||null};
 }
 return pos;
}
function historicalMembers(d,cid,at,index=buildHistoryIndex(d)){
 const ids=[],uncertain=[];
 for(const p of d.plants){
  const pos=positionAt(d,p,at,index);if(!pos)continue;
  if(pos.known===false){uncertain.push(p.id);continue}
  if(pos.containerId!==cid)continue;
  if(!pos.stage){uncertain.push(p.id);continue}
  if(!['Archived','Harvested'].includes(pos.stage))ids.push(p.id);
 }return {ids,uncertain};
}
function historicalSlot(cid,wanted,pid,time){
 const c=container(cid);if(!c)throw Error('Choose a valid container.');
 const taken=state.plants.filter(p=>p.id!==pid).map(p=>positionAt(state,p,time)).filter(p=>p&&p.containerId===cid&&!['Archived','Harvested'].includes(p.stage)).map(p=>p.slot).filter(Number.isInteger);
 const slot=wanted||Array.from({length:c.slots},(_,i)=>i+1).find(n=>!taken.includes(n));
 if(!Number.isInteger(slot)||slot<1||slot>c.slots||taken.includes(slot))throw Error('That space is unavailable on the recorded date. Choose another space.');
 return slot;
}
function volumeAt(d,c,at){
 if(c.type==='Soil')return null;
 const events=d.events.filter(e=>e.containerId===c.id&&(e.water||e.volumeSnapshot));
 if(c.historyVolumeAnchor)events.push({id:'volume-anchor-'+c.id,time:c.historyVolumeAnchor.time,recordedAt:c.historyVolumeAnchor.time,volumeSnapshot:c.historyVolumeAnchor});
 let volume=null;
 for(const e of events.sort(historyOrder)){
  if(activityMillis(e.time)>activityMillis(at))break;
  if(e.volumeSnapshot){volume=e.volumeSnapshot.amount==null?null:convertVolume(e.volumeSnapshot.amount,e.volumeSnapshot.unit,c.unit);continue}
  const w=e.water;
  if(!Number.isFinite(w.amount)||w.amount<=0||!['replace','topup'].includes(w.mode))throw Error('Invalid water entry.');
  const amount=convertVolume(w.amount,w.unit,c.unit);
  volume=w.mode==='replace'?amount:volume==null?null:volume+amount;
 }
 return volume;
}
function recalculateHistory(d,now=new Date().toISOString()){
 const index=buildHistoryIndex(d);
 for(const p of d.plants){
  const pos=positionAt(d,p,now,index);if(!pos)continue;
  if(pos.known){p.containerId=pos.containerId||null;p.slot=pos.slot??null}
  if(pos.stage)p.stage=pos.stage;
 }
 // Check every known occupancy boundary, not only today's slot assignment.
 const times=[now,...d.events.filter(e=>e.placement||e.stageChange).map(e=>e.time),...d.plants.map(p=>p.started)];
 for(const time of new Set(times)){
  if(activityMillis(time)>activityMillis(now))continue;
  const occupied=new Set();
  for(const p of d.plants){
   const pos=positionAt(d,p,time,index);
   if(!pos||!pos.containerId||!pos.stage||['Archived','Harvested'].includes(pos.stage)||!Number.isInteger(pos.slot))continue;
   const key=pos.containerId+':'+pos.slot;
   if(occupied.has(key))throw Error('Two plants occupy the same space on '+formatActivityDate(time)+'. Correct the move date or space.');
   occupied.add(key);
  }
 }
 for(const c of d.containers){
  if(!d.events.some(e=>e.containerId===c.id&&(e.water||e.volumeSnapshot))&&!c.historyVolumeAnchor)continue;
  const volume=volumeAt(d,c,now);
  if(volume!=null&&c.capacity!=null&&volume>c.capacity+0.00001)throw Error('The dated water entries would exceed the container capacity. Correct the amount or log a full replacement.');
  c.volume=volume;
 }
 for(const e of d.events){
  if(e.association!=='auto')continue;
  const match=historicalMembers(d,e.containerId,e,index);
  if(match.uncertain.length){e.historyNeedsReview=true;continue}
  e.plantIds=match.ids;e.historyNeedsReview=false;
 }
}
function validateHistory(d){
 if(d.historyVersion!=null&&d.historyVersion!==2)throw Error('This journal needs a newer version of Rooted.');
 const cids=new Set(d.containers.map(c=>c.id)),pids=new Set(d.plants.map(p=>p.id));
 const dateOK=t=>typeof t==='string'&&Number.isFinite(activityMillis(t));
 function pos(v){
  if(!v||v.containerId!=null&&!cids.has(v.containerId)||v.slot!=null&&(!Number.isInteger(v.slot)||v.slot<1||v.slot>120)||v.stage!=null&&!stages.includes(v.stage))throw Error('Invalid plant history.');
 }
 function vol(v){
  if(!v||!['gal','L'].includes(v.unit)||v.amount!=null&&(!Number.isFinite(v.amount)||v.amount<0))throw Error('Invalid solution history.');
 }
 for(const p of d.plants){for(const v of [p.historyOrigin,p.historyAnchor])if(v){pos(v);if(!dateOK(v.time))throw Error('Invalid history date.')}}
 for(const c of d.containers)if(c.historyVolumeAnchor){vol(c.historyVolumeAnchor);if(!dateOK(c.historyVolumeAnchor.time))throw Error('Invalid volume date.')}
 for(const e of d.events){
  if(e.placement){pos(e.placement);if(e.kind!=='move'||e.plantIds.length!==1)throw Error('Invalid move record.')}
  if(e.stageChange&&(!stages.includes(e.stageChange.stage)||e.kind!=='stage'||e.plantIds.length!==1))throw Error('Invalid growth record.');
  if(e.volumeSnapshot)vol(e.volumeSnapshot);
  if(e.water&&(!Number.isFinite(e.water.amount)||e.water.amount<=0||!['mL','L','tsp','tbsp','fl oz','cup','pt','qt','gal'].includes(e.water.unit)||!['replace','topup'].includes(e.water.mode)))throw Error('Invalid water record.');
  if(e.association&&!['auto','manual'].includes(e.association))throw Error('Invalid plant links.');
  if(e.historyOrder!=null&&(!Number.isInteger(e.historyOrder)||e.historyOrder<0))throw Error('Invalid history order.');
  if((e.placement||e.stageChange)&&e.plantIds.some(id=>!pids.has(id)))throw Error('History references a missing plant.');
  if((e.placement||e.stageChange)&&e.plantIds.some(id=>activityMillis(e.time)<activityMillis(d.plants.find(p=>p.id===id).started)))throw Error('A move or stage change cannot be before the plant start date.');
 }
}

