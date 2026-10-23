/* Activity dates are distinct from entry-creation timestamps. Date-only values
   stay date-only so a plant's start day never shifts with a timezone change. */
function validCalendarDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(value + 'T12:00:00');
  return Number.isFinite(parsed.getTime()) && localCalendarDate(parsed) === value;
}
function localCalendarDate(value = new Date()) {
  const d = value instanceof Date ? value : new Date(value);
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function activityMillis(value) {
  return validCalendarDate(value) ? new Date(value + 'T00:00:00').getTime() : Date.parse(value);
}
function localActivityInput(value = new Date()) {
  const d = validCalendarDate(value) ? new Date(value + 'T00:00:00') : new Date(value);
  if (!Number.isFinite(d.getTime())) return '';
  return localCalendarDate(d) + 'T' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
}
function readActivityTime(form) {
  const value = form.get('occurredAt');
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value) || !validCalendarDate(value.slice(0, 10))) {
    throw Error('Enter the date and time this happened.');
  }
  const parsed = new Date(value);
  // Also rejects impossible times and DST gaps instead of silently moving them.
  if (!Number.isFinite(parsed.getTime()) || localActivityInput(parsed) !== value) throw Error('Choose a valid local date and time.');
  if(parsed.getTime()>Date.now()+60000)throw Error('Record completed care using a date that is not in the future.');
  return parsed.toISOString();
}
function sortActivityEvents(events) {
  return events.sort((a, b) => activityMillis(b.time) - activityMillis(a.time) || Date.parse(b.recordedAt || b.time) - Date.parse(a.recordedAt || a.time) || (b.historyOrder||0)-(a.historyOrder||0) || String(b.id).localeCompare(String(a.id)));
}
function isPlantStart(event) {
  return event.plantStart === true || (event.kind === 'plant' && ['A new beginning', 'Plant started'].includes(event.title));
}
function visibleTimelineEvents(events) {
  return sortActivityEvents(events.filter(e => !(e.kind === 'plant' && e.title === 'Plant details updated')));
}
function updatePlantStart(data, p) {
  if (!validCalendarDate(p.started)) throw Error('Enter a valid plant start date.');
  let event = data.events.find(e => isPlantStart(e) && e.plantIds.includes(p.id));
  if (!event) {
    event = {id: crypto.randomUUID(), kind: 'plant', containerId: p.containerId || null, plantIds: [p.id], recordedAt: new Date().toISOString()};
    data.events.push(event);
  }
  event.recordedAt ||= event.time || new Date().toISOString();
  if(event.time&&event.time!==p.started&&!event.originalRecord)event.originalRecord={...event};
  Object.assign(event, {plantStart: true, time: p.started});
  if(typeof event.title!=='string')event.title='Plant started';
  if(typeof event.detail!=='string')event.detail=p.name;
}
function normalizeTimeline(data) {
  for (const event of data.events) {
    event.recordedAt ||= event.time;
    if (typeof event.id !== 'string' || !/^[a-zA-Z0-9-]+$/.test(event.id)) event.id = crypto.randomUUID();
  }
  for (const p of data.plants) if (validCalendarDate(p.started)) updatePlantStart(data, p);
  sortActivityEvents(data.events);
  return data;
}
function formatActivityDate(value) {
  const onlyDay = validCalendarDate(value);
  return new Date(onlyDay ? value + 'T12:00:00' : value).toLocaleString(undefined, onlyDay
    ? {year: 'numeric', month: 'short', day: 'numeric'}
    : {year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'});
}
