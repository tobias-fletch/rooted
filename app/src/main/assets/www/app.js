const KEY='rooted-v1', $=s=>document.querySelector(s), modal=$('#modal');
const uid=()=>crypto.randomUUID(), esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const types=['Aeroponics','DWC','Kratky','Soil','Custom'], stages=['Seed','Seedling','Vegetative','Flowering','Fruiting','Harvested','Archived'];
const initial=()=>({version:1,historyVersion:2,historySequence:0,containers:[{id:uid(),name:'The aeroponics bay',type:'Aeroponics',capacity:27,unit:'gal',slots:12,volume:null,location:'',notes:''},{id:uid(),name:'DWC jar 01',type:'DWC',capacity:.5,unit:'gal',slots:1,volume:null,location:'',notes:''},{id:uid(),name:'Kratky bucket 01',type:'Kratky',capacity:null,unit:'gal',slots:1,volume:null,location:'',notes:''},{id:uid(),name:'Soil pot 01',type:'Soil',capacity:null,unit:'gal',slots:1,volume:null,location:'',notes:''}],plants:[],events:[],nutrients:['FloraMicro','FloraGro','FloraBloom']});
let startupError='';let state;try{const stored=typeof RootedNative!=='undefined'?JSON.parse(RootedNative.readState()):{ok:true,value:localStorage.getItem(KEY)};if(!stored.ok)throw Error(stored.error);state=stored.value?JSON.parse(stored.value):initial();validateBackup(state)}catch(error){state=initial();startupError=error.message||'Your saved journal could not be opened.'}let page='Overview',selected=null,filter='All',search='';
function save(){validateBackup(state);if(startupError)throw Error(startupError+' Restart the app before making changes.');const json=JSON.stringify(state);if(typeof RootedNative!=='undefined'){const error=RootedNative.writeState(json);if(error)throw Error(error);return}try{localStorage.setItem(KEY,json)}catch(e){throw Error('Device storage is full or unavailable. Export a backup and try a smaller photo.')}}
function commit(fn){const before=JSON.stringify(state);try{fn();replayReservoirVolumes();sortActivityEvents(state.events);save();return true}catch(e){state=JSON.parse(before);throw e}}
function toast(t){$('#toast').textContent=t;$('#toast').style.display='block';setTimeout(()=>$('#toast').style.display='none',3000)}
const container=id=>state.containers.find(c=>c.id===id),plant=id=>state.plants.find(p=>p.id===id),members=id=>state.plants.filter(p=>p.containerId===id),active=id=>members(id).filter(p=>!['Archived','Harvested'].includes(p.stage));
const fmt=v=>v==null||v===''?'—':Number(v).toLocaleString(undefined,{maximumFractionDigits:2});
const date=formatActivityDate;
function addEvent(kind,title,detail,cid=null,pids=[],extra={}){state.events.unshift({id:uid(),historyOrder:state.historySequence=(state.historySequence||0)+1,kind,title,detail,containerId:cid,plantIds:[...new Set(pids)],time:new Date().toISOString(),recordedAt:new Date().toISOString(),...extra});sortActivityEvents(state.events)}
function navigate(p,id=null){page=p;selected=id;filter='All';search='';render();window.scrollTo(0,0)}
const icons={Overview:'▦',Containers:'▱',Plants:'♧',Timeline:'◷',Settings:'⚙'};
function sprout(x,y,s=1){return `<g transform="translate(${x} ${y}) scale(${s})"><path d="M0 0V-40" stroke="#527653" stroke-width="3"/><path d="M0-22C-26-20-30-43-25-47C-5-48 2-31 0-22" fill="#8fa963"/><path d="M0-34C0-56 20-65 27-58C29-38 12-29 0-34" fill="#527b46"/><path d="M0-12C4-31 23-34 30-28C28-12 12-8 0-12" fill="#aac47d"/></g>`}
function art(type,hero=false){if(hero)return `<svg viewBox="0 0 330 250" aria-hidden="true"><ellipse cx="180" cy="220" rx="145" ry="17" fill="#d4dec4"/><path d="M65 170h103l-14 72H78Z" fill="#d0b98a"/><path d="M57 167h118v17H57Z" fill="#e0cba6"/>${sprout(112,171,1.85)}<path d="M213 179h69l-9 61h-50Z" fill="#a0b18c"/>${sprout(245,181,1.4)}<path d="M162 206h44l-4 38h-36Z" fill="#f4f4df"/>${sprout(184,210,.7)}</svg>`;let base=type==='Aeroponics'?`<path d="M35 62h140l-8 51H43Z" fill="#52695a"/><rect x="27" y="56" width="156" height="12" rx="5" fill="#6d8370"/><path d="M50 78h110M49 85h113" stroke="#718674"/>${sprout(65,56,.65)}${sprout(108,56,.8)}${sprout(150,56,.6)}`:type==='DWC'?`<rect x="76" y="53" width="60" height="63" rx="13" fill="#e4eee4" stroke="#b7ccba"/><path d="M78 81h56v21q0 12-12 12H90q-12 0-12-12Z" fill="#bcd4c7"/><path d="M104 60v42m6-39 7 29m-15-18-10 21" stroke="#f9f6dc" fill="none"/><rect x="73" y="50" width="66" height="9" rx="4" fill="#5f7560"/>${sprout(106,51,.8)}`:`<path d="M68 56h76l-9 61H77Z" fill="${type==='Soil'?'#c5a183':'#9eaf8d'}"/><ellipse cx="106" cy="57" rx="39" ry="9" fill="${type==='Soil'?'#9a785a':'#7b926d'}"/>${sprout(106,56,.85)}`;return `<svg viewBox="0 0 210 130" aria-hidden="true"><ellipse cx="106" cy="119" rx="75" ry="6" fill="#edf0e6"/>${base}</svg>`}
function heading(title,sub,button=''){return `<div class="heading"><div><h1>${title}</h1><p>${sub}</p></div>${button}</div>`}
function btn(label,action,secondary=false){return `<button class="${secondary?'secondary':'primary'}" onclick="${action}">${label}</button>`}
function latestReadingEvent(cid){return sortActivityEvents(state.events).find(e=>e.containerId===cid&&e.readings&&Object.values(e.readings).some(v=>typeof v==='number'&&Number.isFinite(v)))}
function latest(cid){return latestReadingEvent(cid)?.readings}
function card(c){const ps=active(c.id),r=latest(c.id);return `<article class="card"><div class="card-top"><span class="tag ${c.type==='Soil'?'soil':''}">${esc(c.type.toUpperCase())}</span><button class="plain" onclick="editContainer('${c.id}')" aria-label="Edit ${esc(c.name)}">•••</button></div><div class="art">${art(c.type)}</div><div class="card-body"><h3><button onclick="navigate('Container','${c.id}')">${esc(c.name)} ↗</button></h3><p>${c.capacity?fmt(c.capacity)+' '+c.unit:'Capacity not set'} · ${c.slots} ${c.slots===1?'plant space':'plant spaces'}${c.location?' · '+esc(c.location):''}</p><div class="dots" aria-label="${ps.length} of ${c.slots} spaces occupied">${Array.from({length:Math.min(c.slots,24)},(_,i)=>`<span class="dot ${i<ps.length?'filled':''}"></span>`).join('')}${c.slots>24?'<small>…</small>':''}</div>${r?`<div class="measurements"><div>${fmt(r.ph)}<small>pH</small></div><div>${fmt(r.ec)}<small>EC · mS/cm</small></div><div>${fmt(r.temp)}°<small>${esc(r.tempUnit)}</small></div></div>`:''}<div class="card-bottom"><span>${ps.length} ${ps.length===1?'plant':'plants'} growing</span><button class="plain" onclick="logEntry('${c.id}')">＋ Log care</button></div></div></article>`}
function timeline(events){events=visibleTimelineEvents(events);return events.length?events.map(e=>`<article class="event"><h3>${esc(e.title)}</h3><p>${esc(e.detail)}</p><time>${date(e.time)}${container(e.containerId)?' · '+esc(container(e.containerId).name):''}</time><button class="plain edit-event-date" onclick="editEventDate('${esc(e.id)}')" aria-label="Edit date for ${esc(e.title)}">Edit date</button>${historyControls(e)}${e.photo?`<div><img src="${esc(e.photo)}" alt="Plant observation" loading="lazy"></div>`:''}</article>`).join(''):'<div class="empty"><span class="empty-icon">◷</span>Your story starts here.<br>Add a plant or log your first observation.</div>'}
function nutrientPanel(){return `<div class="nutrients">${state.nutrients.slice(0,3).map(n=>`<div class="nutrient"><div class="bottle"></div>${esc(n)}</div>`).join('')}</div>`}
function homePlants(){return state.plants.filter(p=>!['Archived','Harvested'].includes(p.stage))}
function homePlantCard(p){const c=container(p.containerId),last=visibleTimelineEvents(state.events).find(e=>e.plantIds?.includes(p.id)&&['reading','water','nutrients','note'].includes(e.kind));return `<article class="home-plant"><button class="plant-open" onclick="navigate('Plant','${p.id}')"><div class="plant-thumb">${p.photo?'<img src="'+esc(p.photo)+'" alt="">':art(c?.type||'Soil')}</div><div class="plant-summary"><span class="tag">${esc(p.stage)}</span><h2>${esc(p.name)}</h2><p>${esc(c?.name||'Nursery / unassigned')}</p><small>${last?'Last care · '+date(last.time):'No care recorded yet'}</small></div><span aria-hidden="true">›</span></button><div class="plant-quick">${btn('Log care',c?`logEntry('${c.id}')`:`plantNote('${p.id}')`,true)}${btn('Note / photo',`plantNote('${p.id}')`,true)}</div></article>`}
function overview(){const ps=homePlants();return '<div class="home-screen">'+heading('Your plants',ps.length?ps.length+' growing · ready for a little care':'Start your growing journal',btn('＋ Add plant','editPlant()'))+`<div class="home-plants">${ps.map(homePlantCard).join('')||'<div class="panel empty"><span class="empty-icon">♧</span><h2>Make room for your first plant.</h2><p>Add a seedling, a cutting, or a plant already growing.<br>You can set its original start date.</p>'+btn('Add your first plant','editPlant()')+'</div>'}</div><div class="home-all"><button class="plain" onclick="navigate('Plants')">All plants &amp; past grows →</button></div><div class="section-heading"><h2>Your containers</h2><button class="plain" onclick="editContainer()">＋ Add</button></div><div class="home-containers">${state.containers.map(c=>`<section class="container-strip"><button class="container-open" onclick="navigate('Container','${c.id}')"><strong>${esc(c.name)}</strong><span>${esc(c.type)} · ${active(c.id).length} / ${c.slots} spaces</span></button><div class="container-quick">${btn('Measure',`logEntry('${c.id}','reading')`,true)}${btn(c.type==='Soil'?'Water':'Reservoir',`logEntry('${c.id}','water')`,true)}${btn('Feed',`logEntry('${c.id}','nutrients')`,true)}</div></section>`).join('')}</div><section class="panel home-recent"><div class="section-heading"><h2>Recent activity</h2><button class="plain" onclick="navigate('Timeline')">View all →</button></div>${timeline(visibleTimelineEvents(state.events).slice(0,3))}</section></div>`}

function filters(){return `<div class="filters">${['All',...types].map(t=>`<button class="filter ${filter===t?'active':''}" onclick="filter='${t}';render()">${t==='All'?'All systems':t}</button>`).join('')}</div>`}
function detail(){const c=container(selected);if(!c)return '';const ps=active(c.id),r=latest(c.id);return heading(esc(c.name),`${esc(c.type)} · ${c.capacity?fmt(c.capacity)+' '+c.unit:'Capacity not set'} · ${ps.length} / ${c.slots} spaces occupied`,btn('Edit container',`editContainer('${c.id}')`,true))+`<div class="actions">${btn('＋ Log care',`logEntry('${c.id}')`)}${btn('＋ Add plant',`editPlant(null,'${c.id}')`,true)}</div><div class="detail-grid"><section class="panel"><div class="eyebrow">YOUR CONTAINER</div><div class="art">${art(c.type)}</div><p class="note">${c.type==='Soil'?'Watering amounts are recorded per event. Soil pot capacity is separate from water volume.':`Current solution: ${c.volume==null?'not recorded':fmt(c.volume)+' '+c.unit}. Container capacity and solution volume are tracked separately.`}</p>${c.notes?`<p>${esc(c.notes)}</p>`:''}<h3>Plant spaces</h3><div class="slots">${Array.from({length:c.slots},(_,i)=>{const p=ps.find(p=>p.slot===i+1);return `<button class="slot ${p?'occupied':''}" onclick="${p?`navigate('Plant','${p.id}')`:`editPlant(null,'${c.id}',${i+1})`}">${p?'♧ '+esc(p.name):'＋ Space '+(i+1)}</button>`}).join('')}</div></section><section class="panel"><button class="plain" onclick="reviewReservoirHistory('${c.id}')">Review solution history</button><h2>Latest measurements</h2>${r?`<div class="measurements"><div>${fmt(r.ph)}<small>pH</small></div><div>${fmt(r.ec)}<small>EC mS/cm</small></div><div>${fmt(r.ppm)}<small>PPM · ${esc(r.scale)}</small></div><div>${fmt(r.temp)}°<small>${esc(r.tempUnit)}</small></div></div><p class="note">Measured ${date(latestReadingEvent(c.id).time)}. Values are recorded as entered; PPM is not automatically converted.</p>`:'<div class="empty">No measurements yet.</div>'}<h2 style="margin-top:30px">Container timeline</h2>${timeline(state.events.filter(e=>e.containerId===c.id))}</section></div>`}
function plantsView(){return heading('Every plant has a story.','Follow the little things, from seed to harvest.',btn('＋ Add plant','editPlant()'))+`<div class="toolbar"><input aria-label="Search plants" placeholder="Search your plants…" value="${esc(search)}" oninput="search=this.value;renderPlants()"></div><div id="plant-list" class="grid">${plantCards()}</div>`}
function plantCards(){return state.plants.filter(p=>(p.name+' '+p.variety).toLowerCase().includes(search.toLowerCase())).map(p=>`<article class="card">${p.photo?`<img class="plant-photo" src="${esc(p.photo)}" alt="${esc(p.name)}">`:''}<div class="plant-card"><span class="tag">${esc(p.stage)}</span><h3 style="margin-top:18px">${esc(p.name)}</h3><p>${esc(p.variety||'Variety not set')} · ${esc(container(p.containerId)?.name||'Nursery / unassigned')}</p><button class="plain" onclick="navigate('Plant','${p.id}')">View plant story ↗</button></div></article>`).join('')||`<div class="panel empty"><span class="empty-icon">♧</span>Your next chapter starts with a seed.<br>Add your first plant to begin its story.<br><button class="plain" onclick="editPlant()">＋ Add a plant</button></div>`}
function renderPlants(){$('#plant-list').innerHTML=plantCards()}
function plantDetail(){const p=plant(selected);if(!p)return '';return heading(esc(p.name),`${esc(p.variety||'Plant')} · ${esc(p.stage)} · Started ${esc(p.started)}`,btn('Edit plant',`editPlant('${p.id}')`,true))+`<div class="actions">${btn('＋ Note or photo',`plantNote('${p.id}')`)}${btn('Move / repot',`movePlant('${p.id}')`,true)}${btn('Change stage',`changeStage('${p.id}')`,true)}${p.containerId?btn('Log container care',`logEntry('${p.containerId}')`,true):''}</div><div class="detail-grid"><div class="panel">${p.photo?`<img src="${esc(p.photo)}" class="plant-photo" style="height:260px;border-radius:8px" alt="${esc(p.name)}">`:`<div class="art">${art('Soil')}</div>`}<button class="plain" onclick="reviewPlantHistory('${p.id}')">Review current placement</button><h2 style="margin-top:20px">At home in</h2><p>${esc(container(p.containerId)?.name||'Nursery / unassigned')}${p.slot?' · Space '+p.slot:''}</p><p class="note">${esc(p.notes||'Add observations and photos as your plant grows. Reservoir care is included in this story while the plant lives there.')}</p></div><section class="panel"><h2>Plant timeline</h2>${timeline(state.events.filter(e=>e.plantIds.includes(p.id)))}</section></div>`}
function settings(){return heading('Your journal, on your phone.','No account. No cloud sync. Your plants stay with you.')+
'<section class="panel"><h2>Backup &amp; recovery</h2><p class="note">Plants, photos and care history are saved in Rooted’s private storage. Export a backup before uninstalling, clearing app storage or changing phones.</p><div class="actions">'+btn('Export backup','exportData()')+'<label class="secondary import-button">Import backup<input type="file" accept="application/json" hidden onchange="importData(this.files[0]);this.value=\'\'"></label></div><div class="actions">'+btn('Recovery copies','showRecovery()',true)+btn('Earlier saved journals','showLegacyJournals()',true)+'</div><p class="note">A previous save is kept on this phone for recovery. Before importing, Rooted also keeps a separate copy of the journal being replaced. These copies are removed if you uninstall or clear app data.</p><button class="plain" onclick="privacyInfo()">Privacy &amp; storage details →</button></section><section class="panel" style="margin-top:20px"><h2>Nutrient shelf</h2><p class="note">Record each product separately, including mL, tsp, tbsp and weight units. Amounts are your own records, not feeding recommendations.</p>'+
state.nutrients.map((n,i)=>'<div class="settings-row"><strong>'+esc(n)+'</strong><button class="plain" onclick="removeNutrient('+i+')">Remove</button></div>').join('')+
'<div class="actions">'+btn('＋ Add nutrient','addNutrient()')+'</div></section><p class="note">Rooted for Android · 0.5.0 · Stored on this phone</p>'}

function render(){$('#nav').innerHTML=Object.entries(icons).map(([p,i])=>`<button class="${page===p||(page==='Container'&&p==='Containers')||(page==='Plant'&&p==='Plants')?'active':''}" onclick="navigate('${p}')"><i>${i}</i>${p==='Overview'?'Home':p}</button>`).join('');$('#page-label').textContent=page==='Overview'?'Home':page;$('#app').innerHTML=page==='Overview'?overview():page==='Containers'?heading('A space for every root.','Shared reservoirs, single jars, and everything in between.',btn('＋ Add container','editContainer()'))+filters()+`<div class="grid">${state.containers.filter(c=>filter==='All'||c.type===filter).map(card).join('')||'<p class="empty">No containers of this type yet.</p>'}</div>`:page==='Plants'?plantsView():page==='Container'?detail():page==='Plant'?plantDetail():page==='Settings'?settings():heading('The growing journal.','Every measurement, move, and milestone.',btn('＋ Log care','logEntry()'))+`<section class="panel">${timeline(state.events)}</section>`}
function field(label,name,type='text',value='',attrs=''){return `<label class="field"><span>${label}</span><input name="${name}" type="${type}" value="${esc(value??'')}" ${attrs}></label>`}
function select(label,name,options,value,attrs=''){return `<label class="field"><span>${label}</span><select name="${name}" ${attrs}>${options.map(o=>{const [v,l]=Array.isArray(o)?o:[o,o];return `<option value="${esc(v)}" ${String(v)===String(value)?'selected':''}>${esc(l)}</option>`}).join('')}</select></label>`}
function area(label,name,value=''){return `<label class="field"><span>${label}</span><textarea name="${name}" maxlength="5000">${esc(value)}</textarea></label>`}
function show(title,html,handler){$('#form button[type=submit]').textContent='Save entry';$('#modal-title').textContent=title;$('#fields').innerHTML=html;$('#error').textContent='';$('#form').onsubmit=async e=>{e.preventDefault();const b=$('#form button[type=submit]');b.disabled=true;try{await handler(new FormData(e.target));modal.close();render();toast('Saved to your growing journal')}catch(err){$('#error').textContent=err.message}finally{b.disabled=false}};modal.showModal()}
const num=(f,n)=>f.get(n)===''||f.get(n)==null?null:Number(f.get(n));
function editContainer(id){const c=container(id)||{name:'',type:'Aeroponics',unit:'gal',slots:1};show(id?'Edit container':'A new growing space',activityField()+field('Container name','name','text',c.name,'required maxlength="80"')+select('Growing system','type',types,c.type)+`<div class="form-grid">${field('Nominal capacity (optional)','capacity','number',c.capacity,'min="0.01" step="any"')}${select('Volume unit','unit',['gal','L'],c.unit,'onchange="convertContainerInputs(this)" data-unit="'+c.unit+'"')}</div><div class="form-grid">${field('Plant spaces','slots','number',c.slots,'required min="1" max="120" step="1"')}${field('Current solution volume (optional)','volume','number',c.volume,'min="0" step="any"')}</div>`+field('Location (optional)','location','text',c.location,'maxlength="100"')+area('Container notes','notes',c.notes)+`<p class="note">Use gallons (US) or liters. For soil, leave solution volume empty. Empty spaces are welcome.</p>`,f=>commit(()=>{const slots=num(f,'slots'),capacity=num(f,'capacity'),volume=num(f,'volume');if(volume!=null&&capacity!=null&&volume>capacity)throw Error('Solution volume cannot exceed container capacity.');if(id&&active(id).some(p=>p.slot>slots))throw Error('Move plants out of the spaces you are removing first.');const data={id:id||uid(),name:f.get('name').trim(),type:f.get('type'),capacity,unit:f.get('unit'),slots,volume:f.get('type')==='Soil'?null:volume,location:f.get('location').trim(),notes:f.get('notes')};if(!data.name)throw Error('Enter a container name.');const volumeChanged=!id||c.type!==data.type||(c.volume==null)!==(data.volume==null)||c.volume!=null&&Math.abs(convertVolume(c.volume,c.unit,data.unit)-data.volume)>0.000001;if(id)Object.assign(c,data);else state.containers.push(data);addEvent('container',id?'Container updated':'Growing space created',data.name,data.id,active(data.id).map(p=>p.id),{time:readActivityTime(f),...(volumeChanged?{volumeSnapshot:{amount:data.volume,unit:data.unit}}:{})})}))}
function editPlant(id,cid='',slot){const p=plant(id)||{name:'',variety:'',stage:'Seedling',started:localCalendarDate(),containerId:cid,slot};show(id?'Edit plant':'Meet your newest plant',field('Plant name','name','text',p.name,'required maxlength="80"')+field('Variety / cultivar','variety','text',p.variety,'maxlength="100"')+`<div class="form-grid">${select('Growth stage','stage',stages,p.stage)}${field('Started on','started','date',p.started,'required')}</div>`+(id?'<p class="note">Use Move / repot on the plant page to change containers and preserve its history.</p>':select('Home','containerId',[['','Nursery / unassigned'],...state.containers.map(c=>[c.id,c.name])],p.containerId)+field('Preferred space (optional)','slot','number',p.slot,'min="1" max="120" step="1"'))+area('Notes','notes',p.notes),f=>commit(()=>{const cId=id?p.containerId:f.get('containerId'),stage=f.get('stage');let s=id?p.slot:num(f,'slot');if(cId&&!['Archived','Harvested'].includes(stage))s=assignSlot(cId,s,id);const data={id:id||uid(),name:f.get('name').trim(),variety:f.get('variety').trim(),stage,started:f.get('started'),containerId:cId||null,slot:s,notes:f.get('notes')};if(!data.name)throw Error('Enter a plant name.');if(data.started>localCalendarDate())throw Error('A plant start date cannot be in the future.');if(id){const oldStage=p.stage;Object.assign(p,data);if(oldStage!==data.stage)addEvent('stage','Growth milestone',p.name+': '+oldStage+' → '+data.stage,p.containerId,[p.id],{stageChange:{stage:data.stage}})}else {data.historyOrigin={time:data.started,containerId:data.containerId,slot:data.slot,stage:data.stage,known:true};state.plants.push(data)}if(id&&p.historyOrigin)p.historyOrigin.time=p.started;updatePlantStart(state,id?p:data)}))}
function assignSlot(cid,s,id){const c=container(cid);if(!c)throw Error('Choose a valid container.');const occupied=active(cid).filter(p=>p.id!==id).map(p=>p.slot);s=s||Array.from({length:c.slots},(_,i)=>i+1).find(i=>!occupied.includes(i));if(!s||s>c.slots||occupied.includes(s))throw Error('That space is unavailable. Choose an empty space or another container.');return s}
function movePlant(id){const p=plant(id);show('Move / repot '+p.name,activityField()+select('Destination','destination',[['','Nursery / unassigned'],...state.containers.map(c=>[c.id,c.name])],p.containerId)+field('Preferred space (optional)','slot','number','','min="1" max="120" step="1"')+area('What changed?','notes','')+'<p class="note">The move takes effect on the recorded date. Later moves remain in effect today. The space must be free on that date.</p>',f=>commit(()=>{
 const time=readActivityTime(f),dest=f.get('destination')||null,before=positionAt(state,p,time);
 if(!before)throw Error('A move cannot be before the plant start date.');
 const slot=dest?historicalSlot(dest,num(f,'slot'),id,time):null;
 addEvent('move','Moved / repotted',p.name+': '+(container(before.containerId)?.name||'Nursery')+' → '+(container(dest)?.name||'Nursery')+'\n'+f.get('notes'),dest,[id],{time,placement:{containerId:dest,slot}});
}))}


function changeStage(id){const p=plant(id);show('A new chapter',activityField()+select('Growth stage','stage',stages,p.stage)+area('Milestone notes','notes'),f=>commit(()=>{
 const time=readActivityTime(f),before=positionAt(state,p,time);if(!before)throw Error('A stage change cannot be before the plant start date.');
 const stage=f.get('stage');
 addEvent('stage','Growth milestone',p.name+': '+(before.stage||'Earlier stage unknown')+' → '+stage+'\n'+f.get('notes'),before.containerId,[id],{time,stageChange:{stage}});
}))}


async function photo(file){if(!file?.size)return null;if(!file.type.startsWith('image/'))throw Error('Choose an image file.');if(file.size>20000000)throw Error('Choose a photo smaller than 20 MB.');return new Promise((resolve,reject)=>{const img=new Image(),url=URL.createObjectURL(file);img.onload=()=>{const scale=Math.min(1,1000/Math.max(img.width,img.height)),canvas=document.createElement('canvas');canvas.width=img.width*scale;canvas.height=img.height*scale;canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);URL.revokeObjectURL(url);resolve(canvas.toDataURL('image/jpeg',.75))};img.onerror=()=>{URL.revokeObjectURL(url);reject(Error('This image format could not be opened. Try JPEG or PNG.'))};img.src=url})}
function plantNote(id){const p=plant(id);show('A moment with '+p.name,activityField()+area('Observation','notes')+'<label class="field"><span>Photo (optional)</span><input name="photo" type="file" accept="image/*"></label>',async f=>{const image=await photo(f.get('photo'));if(!image&&!f.get('notes').trim())throw Error('Add a note or photo.');commit(()=>{if(image)p.photo=image;const time=readActivityTime(f);addEvent('note','Plant observation',f.get('notes'),positionAt(state,p,time)?.containerId||null,[id],{photo:image,time})})})}
// US customary liquid units, based on the exact US gallon (3.785411784 L).
// Reference: https://www.nist.gov/pml/special-publication-811/nist-guide-si-appendix-b-conversion-factors/nist-guide-si-appendix-b8
const volumeML={mL:1,L:1000,tsp:4.92892159375,tbsp:14.78676478125,'fl oz':29.5735295625,cup:236.5882365,pt:473.176473,qt:946.352946,gal:3785.411784};
const volumeUnits=[['mL','mL'],['L','L'],['tsp','tsp · US teaspoon'],['tbsp','tbsp / tbs · US tablespoon'],['fl oz','fl oz · US fluid ounce'],['cup','cup · US'],['pt','pt · US pint'],['qt','qt · US quart'],['gal','gal · US gallon']];
const doseUnits=[...volumeUnits,['g','g · grams'],['mg','mg · milligrams'],['oz','oz · weight']];
function convertVolume(amount,from,to){if(!Object.hasOwn(volumeML,from)||!Object.hasOwn(volumeML,to)||!Number.isFinite(amount)||amount<0)throw Error('Choose a valid volume and unit.');return amount*volumeML[from]/volumeML[to]}
function careNumber(f,name,label,{min=-Infinity,max=Infinity}={}){const raw=f.get(name);if(raw==null||String(raw).trim()==='')return null;const n=Number(raw);if(!Number.isFinite(n)||n<min||n>max)throw Error('Enter a valid '+label+'.');return n}
function readCareMeasurements(f){
  const r={ph:careNumber(f,'ph','pH between 0 and 14',{min:0,max:14}),ec:careNumber(f,'ec','EC',{min:0}),ppm:careNumber(f,'ppm','PPM',{min:0}),scale:f.get('scale')||'Unknown',temp:careNumber(f,'temp','temperature'),tempUnit:f.get('tempUnit')||'F'};
  if(!['500','700','Unknown'].includes(r.scale)||!['F','C'].includes(r.tempUnit))throw Error('Choose a valid measurement scale and temperature unit.');
  return [r.ph,r.ec,r.ppm,r.temp].every(v=>v==null)?null:r;
}
function measurementText(r){return [r.ph!=null?`pH ${r.ph}`:'',r.ec!=null?`EC ${r.ec} mS/cm`:'',r.ppm!=null?`${r.ppm} ppm (${r.scale} scale)`:'',r.temp!=null?`${r.temp} °${r.tempUnit}`:''].filter(Boolean).join(' · ')}
function readCareDoses(f){return state.nutrients.map((name,i)=>{const amount=careNumber(f,'dose'+i,'dose for '+name,{min:0}),unit=f.get('doseUnit'+i)||'mL';if(!doseUnits.some(o=>o[0]===unit))throw Error('Choose a valid nutrient unit.');return {name,amount,unit}}).filter(d=>d.amount>0)}
function dosesText(doses){return doses.map(d=>`${d.name}: ${d.amount} ${d.unit}`).join(' · ')}
function measurementFields(){return `<div class="form-grid">${field('pH','ph','number','','min="0" max="14" step="0.01"')}${field('EC · mS/cm','ec','number','','min="0" step="0.01"')}${field('PPM','ppm','number','','min="0" step="any"')}${select('Meter PPM scale','scale',['500','700','Unknown'],'500')}${field('Temperature','temp','number','','step="0.1"')}${select('Temperature unit','tempUnit',['F','C'],'F')}</div>`}
function nutrientDoseFields(){return `<p class="date-help">Enter the actual amount of each product added. Fractional amounts such as 0.5 tsp are supported. Spoons and fluid units use US measures; grams and weight ounces are kept as weight.</p>`+state.nutrients.map((n,i)=>`<div class="form-grid">${field(esc(n),'dose'+i,'number','','min="0" step="any"')}${select('Dose unit','doseUnit'+i,doseUnits,'mL')}</div>`).join('')+(state.nutrients.length?'':'<p class="note">Add your nutrient products in Settings to record individual doses.</p>')}
function logEntry(cid,kind='reading'){
  if(!state.containers.length){editContainer();return}
  show('A little care goes a long way',select('Container','container',state.containers.map(c=>[c.id,c.name]),cid||state.containers[0].id,'onchange="careFields()"')+select('Entry type','kind',[['reading','Measurements'],['water','Water / reservoir change'],['nutrients','Nutrients / feeding'],['note','Note / photo']],['reading','water','nutrients','note'].includes(kind)?kind:'reading','onchange="careFields()"')+activityField()+'<div id="care-fields"></div>',async f=>{
    const c=container(f.get('container')),kind=f.get('kind');if(!c)throw Error('Choose a container.');
    const occurrence=readActivityTime(f),links=carePlantLinks(c.id,occurrence,f),pids=links.ids,image=kind==='note'?await photo(f.get('photo')):null;
    commit(()=>{
      const notes=f.get('notes')||'';let detail=notes,extra={time:occurrence,association:links.mode},title='Observation';
      if(kind==='reading'){
        const r=readCareMeasurements(f);if(!r)throw Error('Enter at least one measurement.');
        extra.readings=r;title='Measurements recorded';detail=[measurementText(r),notes].filter(Boolean).join('\n');
      }else if(kind==='water'){
        const amount=careNumber(f,'amount','water amount',{min:0}),mode=f.get('mode'),unit=f.get('unit');
        if(!(amount>0))throw Error('Enter a water amount greater than zero.');
        if(!['topup','replace'].includes(mode)||c.type==='Soil'&&mode!=='topup')throw Error('Choose a valid water action.');
        const converted=convertVolume(amount,unit,c.unit);let next=c.volume;
        if(c.type!=='Soil'){
          if(mode==='replace')next=converted;else if(c.volume!=null)next=c.volume+converted;
          if(mode==='replace'&&c.capacity!=null&&next>c.capacity+0.00001)throw Error('This would exceed the container capacity.');
          c.volume=next;
        }
        title=mode==='replace'?'Reservoir replaced':'Water added';
        const lines=[`${amount} ${unit}${c.type==='Soil'?' · soil watering':mode==='replace'?' · full replacement':' · top-up'}${c.type!=='Soil'&&next==null?' · total volume still unknown':''}`];
        extra.water={amount,unit,mode,resultVolume:c.volume,beforeVolume:mode==='replace'?null:(next==null?null:next-converted),containerUnit:c.unit};
        if(c.type!=='Soil'){
          const r=readCareMeasurements(f),doses=readCareDoses(f);
          if(r){extra.readings=r;lines.push('Final solution: '+measurementText(r));}
          if(doses.length){extra.doses=doses;lines.push('Nutrients added: '+dosesText(doses));}
        }
        detail=[...lines,notes].filter(Boolean).join('\n');
      }else if(kind==='nutrients'){
        const doses=readCareDoses(f);if(!doses.length)throw Error('Enter a dose for at least one nutrient.');
        const water=careNumber(f,'water','feed volume',{min:0}),unit=f.get('waterUnit')||c.unit;
        if(water!=null&&!(water>0))throw Error('Feed volume must be greater than zero.');
        if(!Object.hasOwn(volumeML,unit))throw Error('Choose a valid feed volume unit.');
        title='Nutrients added';detail=[dosesText(doses),water!=null?`Feed solution prepared: ${water} ${unit}`:'',notes].filter(Boolean).join('\n');
        extra.doses=doses;extra.feedVolume=water;extra.feedUnit=unit;
      }else if(kind==='note'){
        if(!notes.trim()&&!image)throw Error('Add a note or a photo.');extra.photo=image;
      }else throw Error('Choose a valid entry type.');
      addEvent(kind,title,detail,c.id,pids,extra);
    });
  });careFields();
}
function careFields(){
  const form=$('#form'),kind=form.elements.kind.value,c=container(form.elements.container.value);if(!c)return;
  let html='';
  if(kind==='reading')html=measurementFields()+area('Measurement notes','notes');
  else if(kind==='water'){
    html=select('Water action','mode',c.type==='Soil'?[['topup','Water soil']]:[['topup','Top up reservoir'],['replace','Full reservoir replacement']],'topup')+`<div class="form-grid">${field('Water amount','amount','number','','required min="0.000001" step="any"')}${select('Water unit','unit',volumeUnits,c.unit)}</div><p class="note">${c.type==='Soil'?'Recorded as a watering event.':c.volume==null?'For a full replacement, enter the final volume in the reservoir. For a top-up, enter only the amount added; total volume remains unknown until a replacement is logged.':`Current solution: ${fmt(c.volume)} ${c.unit}. For a replacement, enter the final reservoir volume. For a top-up, enter only the amount added.`} US customary units are used.</p>`;
    if(c.type!=='Soil')html+='<h3>Final solution measurements <small>· optional</small></h3><p class="date-help">Record the readings after adding water, mixing nutrients and making adjustments.</p>'+measurementFields()+'<h3>Nutrients added <small>· optional</small></h3>'+nutrientDoseFields();
    html+=area('Notes','notes');
  }else if(kind==='nutrients')html='<p class="note">Record each product independently. Feed volume is context only; log water separately to update reservoir volume.</p>'+nutrientDoseFields()+`<div class="form-grid">${field('Feed volume (optional)','water','number','','min="0.000001" step="any"')}${select('Water unit','waterUnit',volumeUnits,c.unit)}</div>`+area('Feeding notes','notes');
  else html=area('Observation','notes')+'<label class="field"><span>Photo (optional)</span><input type="file" name="photo" accept="image/*"></label>';
  $('#care-fields').innerHTML=html+plantLinkFields(c.id);
}

function addNutrient(){show('Add to your nutrient shelf',field('Product name','name','text','','required maxlength="100"'),f=>commit(()=>{const name=f.get('name').trim();if(!name)throw Error('Enter a product name.');if(state.nutrients.some(n=>n.toLowerCase()===name.toLowerCase()))throw Error('That product is already on your shelf.');state.nutrients.push(name)}))}
function removeNutrient(i){commit(()=>state.nutrients.splice(i,1));render();toast('Removed from shelf. Past doses are preserved.')}
function exportData(){if(typeof RootedNative!=='undefined'){RootedNative.exportBackup(JSON.stringify(state,null,2));return}const url=URL.createObjectURL(new Blob([JSON.stringify(state,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='rooted-backup-'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
async function importData(file){if(!file)return;try{if(file.size>40*1024*1024)throw Error('Choose a backup smaller than 40 MB.');offerRestore(JSON.parse(await file.text()),'Import backup')}catch(e){toast('Could not import: '+e.message)}}
function validateBackupBase(d){if(d.version!==1||!['containers','plants','events','nutrients'].every(k=>Array.isArray(d[k])))throw Error('Not a Rooted backup.');const ids=new Set();for(const c of d.containers){if(typeof c.id!=='string'||!/^[a-zA-Z0-9-]+$/.test(c.id)||ids.has(c.id)||typeof c.name!=='string'||!types.includes(c.type)||!['gal','L'].includes(c.unit)||!Number.isInteger(c.slots)||c.slots<1||c.slots>120||[c.capacity,c.volume].some(v=>v!=null&&(!Number.isFinite(v)||v<0)))throw Error('Invalid container data.');ids.add(c.id)}const pids=new Set();for(const p of d.plants){if(typeof p.id!=='string'||!/^[a-zA-Z0-9-]+$/.test(p.id)||pids.has(p.id)||typeof p.name!=='string'||typeof p.variety!=='string'||!stages.includes(p.stage)||(p.containerId&&!ids.has(p.containerId))||(p.photo&&!/^data:image\/(jpeg|png|webp);base64,/.test(p.photo)))throw Error('Invalid plant data.');pids.add(p.id)}for(const e of d.events){if(typeof e.title!=='string'||typeof e.detail!=='string'||!Array.isArray(e.plantIds)||!Number.isFinite(Date.parse(e.time))||(e.photo&&!/^data:image\/(jpeg|png|webp);base64,/.test(e.photo)))throw Error('Invalid timeline data.')}if(!d.nutrients.every(n=>typeof n==='string'&&n.length<=100))throw Error('Invalid nutrient data.');for(const c of d.containers){const occupied=d.plants.filter(p=>p.containerId===c.id&&!['Archived','Harvested'].includes(p.stage));if(occupied.some(p=>!Number.isInteger(p.slot)||p.slot<1||p.slot>c.slots)||new Set(occupied.map(p=>p.slot)).size!==occupied.length)throw Error('Invalid plant space assignments.')}}
if(!startupError){normalizeTimeline(state);initializeHistory(state)}
render();

function activityField(value=new Date()){return field('When did this happen?','occurredAt','datetime-local',localActivityInput(value),'required')+'<p class="date-help">This is the date shown in your timeline.</p>'}
function editEventDate(id){const event=state.events.find(e=>e.id===id);if(!event)return;const p=isPlantStart(event)?plant(event.plantIds[0]):null;show(p?'Correct plant start date':'Correct activity date',p?field('Started on','started','date',p.started,'required'):activityField(event.time),f=>commit(()=>{if(p){preserveOriginal(event);p.started=f.get('started');if(p.historyOrigin)p.historyOrigin.time=p.started;updatePlantStart(state,p)}else{preserveOriginal(event);event.time=readActivityTime(f)}}))}

function rootedHandleBack(){if(modal.open){modal.close();return true}if(page==='Plant'){navigate('Plants');return true}if(page==='Container'){navigate('Containers');return true}if(page!=='Overview'){navigate('Overview');return true}return false}
function privacyInfo(){show('Your privacy in Rooted','<div class="note"><p>Rooted 0.5.0 works entirely on this phone. No accounts, advertising, analytics or network access. Plants, care records, notes and compressed photos are saved in app-private storage.</p><p>Android automatic backup and device transfer are disabled. Rooted keeps a previous save and a pre-import recovery copy on this phone. Export backups regularly; uninstalling or clearing app storage removes all of these local copies.</p><p>You choose individual photos and backup files through Android’s document picker. Rooted has no broad photo-library or camera permission.</p><p>Exported backups contain your photos and notes and are not encrypted by Rooted. If you choose a cloud document provider in Android’s picker, that provider handles the file under its own terms.</p><p>Earlier versions may have saved records to a Firebase account. This offline update does not connect to or delete those remote records. Locally cached copies can be recovered from Earlier saved journals.</p></div>',()=>{});$('#form button[type=submit]').textContent='Done'}
function journalSummary(data){return data.plants.length+' plants · '+data.containers.length+' containers · '+data.events.length+' entries'}
function offerRestore(data,title='Restore journal'){
 validateBackup(data);const replacement=initializeHistory(normalizeTimeline(JSON.parse(JSON.stringify(data))));
 show(title,'<p class="note">'+esc(journalSummary(replacement))+'</p><p>This replaces the open journal on this phone. Rooted keeps a pre-import recovery copy. Export a backup for a permanent separate copy.</p>',()=>{
  const before=state,oldError=startupError;
  if(typeof RootedNative!=='undefined'){const error=RootedNative.checkpoint();if(error)throw Error(error)}
  try{state=replacement;startupError='';save();page='Overview';selected=null}
  catch(error){state=before;startupError=oldError;throw error}
 });$('#form button[type=submit]').textContent='Replace journal';
}
function savedLegacyJournals(){
 const copies=[];for(let i=0;i<localStorage.length;i++){
  const key=localStorage.key(i);if(key!==KEY&&!key?.startsWith('rooted-account-v1-'))continue;
  try{const raw=JSON.parse(localStorage.getItem(key)),data=key===KEY?raw:raw.data;validateBackup(data);copies.push({key,data})}catch{}
 }return copies;
}
function showLegacyJournals(){
 const copies=savedLegacyJournals();
 show('Earlier saved journals',copies.length?'<p class="note">These are copies already on this phone from earlier versions. They may not include changes made elsewhere. Nothing is downloaded or merged. Choose a copy to review before replacing your open journal.</p>'+copies.map((x,i)=>'<div class="settings-row"><div><strong>Saved journal '+(i+1)+'</strong><p>'+esc(journalSummary(x.data))+'</p></div><button type="button" class="secondary" onclick="reviewLegacy('+i+')">Review</button></div>').join(''):'<p>No earlier journal copies were found on this phone. You can still import an exported Rooted backup.</p>',()=>{});$('#form button[type=submit]').textContent='Done';
}
function reviewLegacy(index){const copy=savedLegacyJournals()[index];if(!copy)return;modal.close();offerRestore(copy.data,'Use earlier saved journal')}
function showRecovery(){
 const rows=[];for(const kind of ['previous','checkpoint','upgrade']){
  try{const r=JSON.parse(RootedNative.readRecovery(kind));if(r.ok&&r.value){const d=JSON.parse(r.value);validateBackup(d);rows.push({kind,data:d})}}catch{}
 }
 show('Recovery copies',rows.length?rows.map(r=>'<div class="settings-row"><div><strong>'+(r.kind==='previous'?'Previous save':r.kind==='upgrade'?'Before history upgrade':'Before last import')+'</strong><p>'+esc(journalSummary(r.data))+'</p></div><button type="button" class="secondary" onclick="reviewRecovery(\''+r.kind+'\')">Review</button></div>').join(''):'<p>No valid recovery copy is available yet. You can import an exported backup.</p>',()=>{});$('#form button[type=submit]').textContent='Done';
}
function reviewRecovery(kind){try{const r=JSON.parse(RootedNative.readRecovery(kind));if(!r.ok||!r.value)throw Error('Recovery copy unavailable.');const data=JSON.parse(r.value);modal.close();offerRestore(data,'Restore recovery copy')}catch(e){toast(e.message)}}
const renderLocal=render;
render=function(){renderLocal();if(startupError){$('#app').insertAdjacentHTML('afterbegin','<div class="note" role="alert">'+esc(startupError)+' Saving is disabled to protect existing files. Open Settings to import a backup or recover an earlier save. '+btn('Open recovery',"navigate('Settings')",true)+'</div>')}else if(page==='Overview'&&!localStorage.getItem('rooted-offline-migration-reviewed')&&savedLegacyJournals().some(x=>x.key.startsWith('rooted-account-v1-'))){$('#app').insertAdjacentHTML('afterbegin','<div class="note">An earlier account journal is saved on this phone. <button class="plain" onclick="showLegacyJournals()">Review saved journals</button><button class="plain" onclick="dismissLegacyNotice()">Dismiss</button></div>')}};
function dismissLegacyNotice(){localStorage.setItem('rooted-offline-migration-reviewed','1');render()}
render();

function replayReservoirVolumes(){recalculateHistory(state)}
function validateBackup(d){validateBackupBase(d);validateHistory(d)}
function carePlantLinks(cid,time,f){
 const mode=f.get('linkMode')==='manual'?'manual':'auto';
 if(mode==='manual'){
  const ids=f.getAll?f.getAll('linkedPlant'):[f.get('linkedPlant')].filter(Boolean);
  if(ids.some(id=>!plant(id)))throw Error('Choose valid plants.');
  return {mode,ids:[...new Set(ids)]};
 }
 const match=historicalMembers(state,cid,time);
 if(match.uncertain.length)throw Error('Earlier plant history is incomplete. Under Plant links, choose plants manually to confirm who received this care.');
 return {mode,ids:match.ids};
}
function plantLinkFields(cid,event){
 const chosen=new Set(event?.plantIds||active(cid).map(p=>p.id));
 return '<details class="link-details"><summary>Plant links'+(event?.historyNeedsReview?' · review needed':'')+'</summary><p class="note">Automatic links follow dated moves and growth stages. For older incomplete records, select the plants yourself. Manual choices are kept when dates change.</p>'+
 select('Link method','linkMode',[['auto','Automatic from dated history'],['manual','Choose plants manually']],event?event.association||'manual':'auto')+
 state.plants.map(p=>'<label class="plant-link"><input type="checkbox" name="linkedPlant" value="'+esc(p.id)+'" '+(chosen.has(p.id)?'checked':'')+'><span>'+esc(p.name)+'</span></label>').join('')+'</details>';
}
function historyControls(e){
 let out='';
 if(isPlantStart(e))out+='<button class="plain edit-event-date" onclick="editStartingPlacement(\''+e.plantIds[0]+'\')">Starting placement</button>';
 if(['reading','water','nutrients'].includes(e.kind)||e.association)out+='<button class="plain edit-event-date" onclick="editPlantLinks(\''+e.id+'\')">'+(e.historyNeedsReview?'Review plant links':'Plants included')+'</button>';
 if(['move','stage','water','container'].includes(e.kind))out+='<button class="plain edit-event-date" onclick="editHistoryDetails(\''+e.id+'\')">Edit history details</button>';
 if(e.placement)out+='<p>Recorded destination: '+esc(container(e.placement.containerId)?.name||'Nursery')+(e.placement.slot?' · Space '+e.placement.slot:'')+'</p>';
 if(e.stageChange)out+='<p>Recorded stage: '+esc(e.stageChange.stage)+'</p>';
 if(e.water)out+='<p>Recorded water: '+fmt(e.water.amount)+' '+esc(e.water.unit)+' · '+(e.water.mode==='replace'?'replacement':'top-up')+'</p>';
 return out;
}
function preserveOriginal(e){if(!e.originalRecord){const copy={...e};delete copy.originalRecord;e.originalRecord=copy}}
function editPlantLinks(id){
 const e=state.events.find(e=>e.id===id);if(!e)return;
 show('Plants included',plantLinkFields(e.containerId,e),f=>commit(()=>{const links=carePlantLinks(e.containerId,e.time,f);preserveOriginal(e);e.plantIds=links.ids;e.association=links.mode;e.historyNeedsReview=false}));
}
function editHistoryDetails(id){
 const e=state.events.find(e=>e.id===id);if(!e)return;
 let html=activityField(e.time);
 if(e.kind==='move')html+=select('Destination','destination',[['','Nursery / unassigned'],...state.containers.map(c=>[c.id,c.name])],e.placement?.containerId||e.containerId||'')+field('Space at that time (leave blank if unknown)','slot','number',e.placement?.slot||'','min="1" max="120" step="1"');
 else if(e.kind==='stage')html+=select('Growth stage','stage',[['','Choose the recorded stage'],...stages],e.stageChange?.stage||'','required');
 else if(e.kind==='water')html+=select('Water action','mode',[['','Choose the recorded action'],['topup','Top up / soil watering'],['replace','Full reservoir replacement']],e.water?.mode||'','required')+field('Amount','amount','number',e.water?.amount||'','required min="0.000001" step="any"')+select('Unit','unit',volumeUnits,e.water?.unit||container(e.containerId)?.unit||'gal');
 else if(e.kind==='container')html+=field('Solution volume at this time (empty = unknown)','amount','number',e.volumeSnapshot?.amount??'','min="0" step="any"')+select('Unit','unit',['gal','L'],e.volumeSnapshot?.unit||container(e.containerId)?.unit||'gal');
 html+='<p class="note">Your original text, notes and photos are kept. Older entries may not include enough information to reconstruct history; enter only values you know.</p>';
 show('Correct history details',html,f=>commit(()=>{
  preserveOriginal(e);e.time=readActivityTime(f);
  if(e.kind==='move'){const p=plant(e.plantIds[0]),dest=f.get('destination')||null;if(!p)throw Error('Choose a record with an existing plant.');e.placement={containerId:dest,slot:dest?(num(f,'slot')?historicalSlot(dest,num(f,'slot'),p.id,e.time):null):null};e.containerId=dest}
  else if(e.kind==='stage')e.stageChange={stage:f.get('stage')};
  else if(e.kind==='water'){const amount=careNumber(f,'amount','water amount',{min:0});if(!(amount>0))throw Error('Enter an amount greater than zero.');if(container(e.containerId)?.type==='Soil'&&f.get('mode')==='replace')throw Error('Soil watering is a top-up record, not a reservoir replacement.');e.water={...e.water,amount,unit:f.get('unit'),mode:f.get('mode')}}
  else e.volumeSnapshot={amount:careNumber(f,'amount','volume',{min:0}),unit:f.get('unit')};
 }));
}
function editStartingPlacement(id){
 const p=plant(id);if(!p)return;
 const origin=p.historyOrigin||{};
 show('Starting placement · '+p.name,field('Started on','started','date',p.started,'required')+select('Starting container','destination',[['','Nursery / unassigned'],...state.containers.map(c=>[c.id,c.name])],origin.containerId||'')+field('Starting space (leave blank if unknown)','slot','number',origin.slot||'','min="1" max="120" step="1"')+select('Starting stage','stage',[['','Choose the starting stage'],...stages],origin.stage||'','required')+'<p class="note">Enter the placement and growth stage at the start of this plant’s history. Later moves and stages take precedence. Existing current-state snapshots from older versions remain intact.</p>',f=>commit(()=>{
  const time=f.get('started');if(!validCalendarDate(time)||time>localCalendarDate())throw Error('Choose a valid start date that is not in the future.');
  const dest=f.get('destination')||null,slot=dest?(num(f,'slot')?historicalSlot(dest,num(f,'slot'),id,time):null):null;
  p.started=time;p.historyOrigin={time,containerId:dest,slot,stage:f.get('stage'),known:true};updatePlantStart(state,p);
 }));
}
function reviewReservoirHistory(cid){
 const c=container(cid);if(!c||c.type==='Soil'){toast('Soil watering is recorded per event.');return}
 const derived=volumeAt(state,{...c,historyVolumeAnchor:null},new Date().toISOString());
 const current=c.volume==null?'unknown':fmt(c.volume)+' '+c.unit,calculated=derived==null?'unknown':fmt(derived)+' '+c.unit;
 if(!c.historyVolumeAnchor){show('Solution history','<p>Current solution: '+esc(current)+'. This is calculated from dated replacements, top-ups and recorded solution-volume snapshots.</p><p class="note">Correct individual entries through Edit history details. Unknown starting volume stays unknown until a replacement or snapshot is recorded.</p>',()=>{});$('#form button[type=submit]').textContent='Done';return}
 show('Review protected solution snapshot','<p>Kept from your earlier journal: <strong>'+esc(current)+'</strong>.</p><p>Calculated from dated records: <strong>'+esc(calculated)+'</strong>.</p><p class="note">The upgrade preserved your earlier current volume because older records may be incomplete. After correcting those records, you can use their calculated total. The original journal remains in the upgrade recovery copy.</p>',()=>{
  if(derived==null)throw Error('Record a known replacement or solution-volume snapshot first.');
  commit(()=>{c.previousHistoryVolumeAnchor=c.historyVolumeAnchor;delete c.historyVolumeAnchor});
 });$('#form button[type=submit]').textContent='Use dated records';
}
function reviewPlantHistory(id){
 const p=plant(id);if(!p)return;
 if(!p.historyAnchor){show('Current placement','<p>Current container and growth stage follow the plant’s dated starting placement, moves and milestones. Correct individual entries in its timeline.</p>',()=>{});$('#form button[type=submit]').textContent='Done';return}
 const proposed=positionAt(state,{...p,historyAnchor:null},new Date().toISOString());
 const description=proposed?(container(proposed.containerId)?.name||'Nursery')+' · '+(proposed.stage||'stage unknown')+(proposed.slot?' · Space '+proposed.slot:''):'Not known';
 show('Review protected current placement','<p>Your current placement was preserved when upgrading. Dated history indicates: <strong>'+esc(description)+'</strong>.</p><p class="note">Correct Starting placement and missing move/stage details first. When the history is complete, use it to calculate the current placement. Your original journal stays in the upgrade recovery copy.</p>',()=>{
  if(!proposed?.known||!proposed.stage||proposed.containerId&&!['Archived','Harvested'].includes(proposed.stage)&&!Number.isInteger(proposed.slot))throw Error('Complete the starting placement and missing move/stage details first.');
  commit(()=>{p.previousHistoryAnchor=p.historyAnchor;delete p.historyAnchor});
 });$('#form button[type=submit]').textContent='Use dated records';
}

function convertContainerInputs(select){const from=select.getAttribute('data-unit'),to=select.value;for(const name of ['capacity','volume']){const input=$('#form').elements[name];if(input.value!==''&&Number.isFinite(Number(input.value)))input.value=Number(convertVolume(Number(input.value),from,to).toPrecision(12))}select.setAttribute('data-unit',to)}
