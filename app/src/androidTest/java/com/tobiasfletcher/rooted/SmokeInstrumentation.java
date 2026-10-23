package com.tobiasfletcher.rooted;

import android.app.Activity;
import android.app.Instrumentation;
import android.content.Intent;
import android.os.Bundle;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;

/** Runs against a disposable emulator, never a user's existing journal. */
public class SmokeInstrumentation extends Instrumentation {
    private Bundle arguments;
    @Override public void onCreate(Bundle arguments) { super.onCreate(arguments); this.arguments = arguments; start(); }
    private String js(MainActivity activity, String script) throws Exception {
        CountDownLatch done = new CountDownLatch(1);
        AtomicReference<String> result = new AtomicReference<>();
        runOnMainSync(() -> activity.web.evaluateJavascript(script, value -> { result.set(value); done.countDown(); }));
        if (!done.await(10, TimeUnit.SECONDS)) throw new AssertionError("JavaScript timed out");
        return result.get();
    }
    private void check(MainActivity activity, String expression, String label) throws Exception {
        if (!"true".equals(js(activity, "(()=>{try{return !!(" + expression + ")}catch(e){return false}})()"))) throw new AssertionError(label);
    }
    private MainActivity launch() throws Exception {
        MainActivity activity = (MainActivity) startActivitySync(new Intent(getTargetContext(), MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
        for (int i=0; i<100; i++) {
            if ("true".equals(js(activity, "typeof state !== 'undefined' && typeof render === 'function'"))) return activity;
            Thread.sleep(100);
        }
        throw new AssertionError("App did not become ready");
    }
    @Override public void onStart() {
        Bundle results = new Bundle();
        try {
            MainActivity a = launch();
            if ("true".equals(arguments.getString("recovery"))) {
                js(a, "state=initial();state.plants.push({id:'recovery-plant',name:'Recovery basil',variety:'',stage:'Seedling',started:'2026-01-01',containerId:state.containers[0].id,slot:1});normalizeTimeline(state);save();commit(()=>{state.plants[0].notes='Later edit'})");
                runOnMainSync(a::finish);
                try (java.io.FileOutputStream broken = new java.io.FileOutputStream(new java.io.File(getTargetContext().getFilesDir(),"rooted-state.json"))) {
                    broken.write("broken JSON".getBytes(java.nio.charset.StandardCharsets.UTF_8));
                }
                MainActivity damaged = launch();
                check(damaged, "!!startupError && JSON.parse(RootedNative.readState()).value==='broken JSON'", "Corrupt primary remains untouched at startup");
                check(damaged, "(()=>{try{save();return false}catch{return true}})()", "Saving blocked while journal is unreadable");
                js(damaged, "reviewRecovery('previous');document.querySelector('#form').requestSubmit()");
                check(damaged, "!startupError && state.plants[0].name==='Recovery basil' && JSON.parse(JSON.parse(RootedNative.readState()).value).plants[0].name==='Recovery basil'", "Recovery restores corrupt primary");
                js(damaged, "state=initial();save();render()");
                results.putString("stream","PASS: corrupt primary protected, writes blocked, previous valid save restored.\n");
                finish(Activity.RESULT_OK,results);return;
            }

            if ("true".equals(arguments.getString("history"))) {
                js(a, "state=initial();save();editPlant(null,state.containers[0].id,1);document.querySelector('[name=name]').value='History basil';document.querySelector('[name=started]').value='2026-01-01';document.querySelector('#form').requestSubmit()");
                js(a, "movePlant(state.plants[0].id);document.querySelector('[name=destination]').value=state.containers[1].id;document.querySelector('[name=occurredAt]').value='2026-02-01T10:00';document.querySelector('#form').requestSubmit()");
                js(a, "movePlant(state.plants[0].id);document.querySelector('[name=destination]').value=state.containers[2].id;document.querySelector('[name=occurredAt]').value='2026-03-01T10:00';document.querySelector('#form').requestSubmit()");
                js(a, "movePlant(state.plants[0].id);document.querySelector('[name=destination]').value=state.containers[0].id;document.querySelector('[name=occurredAt]').value='2026-02-15T10:00';document.querySelector('#form').requestSubmit()");
                check(a,"state.plants[0].containerId===state.containers[2].id","Backdated move keeps latest placement");
                js(a, "logEntry(state.containers[1].id);document.querySelector('[name=ph]').value='6';document.querySelector('[name=occurredAt]').value='2026-02-10T10:00';document.querySelector('#form').requestSubmit()");
                check(a,"state.events.find(e=>e.kind==='reading').plantIds.includes(state.plants[0].id)","Historical care links to plant at that date");
                js(a,"window.historyReading=state.events.find(e=>e.kind==='reading');editEventDate(state.events.find(e=>e.placement?.containerId===state.containers[1].id).id);document.querySelector('[name=occurredAt]').value='2026-02-12T10:00';document.querySelector('#form').requestSubmit()");
                check(a,"historyReading.plantIds.length===0","Corrected move updates automatic links");
                js(a,"editPlantLinks(historyReading.id);document.querySelector('[name=linkMode]').value='manual';document.querySelector('[name=linkedPlant]').checked=true;document.querySelector('#form').requestSubmit()");
                check(a,"historyReading.association==='manual' && historyReading.plantIds.length===1","Manual historical correction through real form");
                js(a,"editHistoryDetails(state.events.find(e=>e.placement?.containerId===state.containers[1].id).id);document.querySelector('[name=slot]').value='1';document.querySelector('#form').requestSubmit()");
                check(a,"!modal.open && state.plants[0].containerId===state.containers[2].id","History details correction preserves later placement");
                js(a,"navigate('Plant',state.plants[0].id)");
                check(a,"document.documentElement.scrollWidth<=window.innerWidth && document.querySelector('#app').textContent.includes('Starting placement')","History controls render at phone width");
                js(a,"state=initial();save();render()");
                js(a,"logEntry(state.containers[0].id,'water');document.querySelector('[name=mode]').value='replace';document.querySelector('[name=amount]').value='2';document.querySelector('#form').requestSubmit();editContainer(state.containers[0].id);document.querySelector('[name=unit]').value='L';document.querySelector('[name=unit]').dispatchEvent(new Event('change'))");
                check(a,"Math.abs(Number(document.querySelector('[name=volume]').value)-7.570823568)<0.00001","Unit control converts physical solution amount");
                js(a,"document.querySelector('#form').requestSubmit()");
                check(a,"!modal.open && state.containers[0].unit==='L' && Math.abs(state.containers[0].volume-7.570823568)<0.00001 && !state.events.find(e=>e.kind==='container').volumeSnapshot","Unit-only edit preserves volume without inventing snapshot");
                js(a,"state=initial();save();render()");
                results.putString("stream","PASS: dated move UI, automatic care links, manual correction, history details and phone layout.\n");
                finish(Activity.RESULT_OK,results);return;
            }

            if ("true".equals(arguments.getString("seed"))) {
                js(a, "state=initial();state.plants.push({id:'upgrade-plant',name:'Keep my basil',variety:'Genovese',stage:'Seedling',started:'2026-08-01',containerId:state.containers[0].id,slot:1});normalizeTimeline(state);save();const cached=JSON.parse(JSON.stringify(state));cached.plants[0].name='Cached account basil';localStorage.setItem('rooted-account-v1-upgrade-test',JSON.stringify({data:cached,revision:2,dirty:true}))");
                check(a, "JSON.parse(localStorage.getItem(\u0027rooted-account-v1-upgrade-test\u0027)).data.plants[0].name===\u0027Cached account basil\u0027", "Seed cache written");
                Thread.sleep(2000);
                results.putString("stream", "PASS: old-version guest and cached account journal seeded.\n");
                finish(Activity.RESULT_OK,results);return;
            }
            if ("true".equals(arguments.getString("upgrade"))) {
                check(a, "state.plants[0].name==='Keep my basil' && state.events.some(e=>e.plantIds.includes('upgrade-plant'))", "Update preserves installed journal");
                check(a, "savedLegacyJournals().some(x=>x.data.plants[0].name==='Cached account basil')", "Update retains cached account journal");
                js(a, "offerRestore(savedLegacyJournals().find(x=>x.key==='rooted-account-v1-upgrade-test').data);document.querySelector('#form').requestSubmit()");
                check(a, "JSON.parse(JSON.parse(RootedNative.readRecovery('upgrade')).value).plants[0].name==='Keep my basil'", "Immutable pre-upgrade journal retained");
                check(a, "state.plants[0].name==='Cached account basil' && JSON.parse(JSON.parse(RootedNative.readRecovery('checkpoint')).value).plants[0].name==='Keep my basil'", "Offline account migration protects guest journal");
                js(a, "reviewRecovery('checkpoint');document.querySelector('#form').requestSubmit()");
                check(a, "state.plants[0].name==='Keep my basil'", "Protected copy can be restored");
                js(a, "localStorage.removeItem('rooted-account-v1-upgrade-test');state=initial();save();render()");
            }

            check(a, "!startupError && document.querySelector('h1').textContent === 'Your plants'", "Offline startup");
            check(a, "document.documentElement.scrollWidth <= window.innerWidth", "No horizontal overflow");
            check(a, "state.containers[0].capacity === 27 && state.containers[0].slots === 12", "Tote setup");
            check(a, "state.containers[1].capacity === 0.5", "DWC setup");
            js(a, "state=initial();save();editPlant(null,state.containers[0].id,1);document.querySelector('[name=name]').value='Android test basil';document.querySelector('[name=variety]').value='Genovese';document.querySelector('[name=started]').value='2026-08-01';document.querySelector('#form').requestSubmit()");
            check(a, "state.plants.length===1 && state.plants[0].slot===1 && !modal.open", "Plant form persists");
            check(a, "document.querySelector('.home-plant').getBoundingClientRect().top < 220 && document.querySelector('.plant-quick').getBoundingClientRect().bottom < window.innerHeight-70", "Plant and care actions visible immediately");
            check(a, "Array.from(document.querySelectorAll('.plant-quick button, nav button')).every(b=>b.getBoundingClientRect().height>=48)", "Android touch targets");
            try (java.io.FileOutputStream capture = new java.io.FileOutputStream(new java.io.File(getTargetContext().getExternalFilesDir(null), "home-preview.png"))) {
                getUiAutomation().takeScreenshot().compress(android.graphics.Bitmap.CompressFormat.PNG, 100, capture);
            }
            check(a, "typeof window.RootedCloud==='undefined' && !document.querySelector('[src=\"cloud.js\"]')", "No cloud loaded");
            js(a, "logEntry(state.containers[0].id,'nutrients')");
            check(a, "document.querySelector('[name=kind]').value==='nutrients' && !!document.querySelector('[name=dose0]')", "Direct feed shortcut");
            js(a, "modal.close()");
            check(a, "state.events.length===1 && state.events[0].time==='2026-08-01' && state.events[0].recordedAt!==state.events[0].time", "Plant start uses activity date, not log date");
            js(a, "window.originalBirthId=state.events[0].id;editPlant(state.plants[0].id);document.querySelector('[name=started]').value='2026-07-15';document.querySelector('#form').requestSubmit()");
            check(a, "state.events.length===1 && state.events[0].id===window.originalBirthId && state.events[0].time==='2026-07-15'", "Editing start corrects the original timeline entry");
            js(a, "editPlant(null,state.containers[0].id,1);document.querySelector('[name=name]').value='Duplicate';document.querySelector('#form').requestSubmit()");
            check(a, "state.plants.length===1 && document.querySelector('#error').textContent.includes('unavailable')", "Occupied space blocked");
            js(a, "modal.close();logEntry(state.containers[0].id);document.querySelector('[name=ph]').value='5.9';document.querySelector('[name=ec]').value='1.2';document.querySelector('[name=ppm]').value='600';document.querySelector('[name=temp]').value='70';document.querySelector('#form').requestSubmit()");
            check(a, "latest(state.containers[0].id).ph===5.9 && state.events[0].plantIds.includes(state.plants[0].id)", "Reservoir reading follows plant");
            js(a, "logEntry(state.containers[0].id);document.querySelector('[name=kind]').value='water';careFields();document.querySelector('[name=mode]').value='replace';document.querySelector('[name=amount]').value='40';document.querySelector('[name=unit]').value='qt';document.querySelector('[name=ph]').value='5.7';document.querySelector('[name=ec]').value='1.4';document.querySelector('[name=dose0]').value='0.5';document.querySelector('[name=doseUnit0]').value='tsp';document.querySelector('[name=dose1]').value='1';document.querySelector('[name=doseUnit1]').value='tbsp';document.querySelector('[name=dose2]').value='2';document.querySelector('[name=doseUnit2]').value='mL';document.querySelector('#form').requestSubmit()");
            check(a, "state.containers[0].volume===10 && latest(state.containers[0].id).ph===5.7 && state.events[0].doses.length===3 && state.events[0].doses[0].unit===\u0027tsp\u0027", "Combined reservoir replacement");
            js(a, "logEntry(state.containers[0].id);document.querySelector('[name=kind]').value='water';careFields();document.querySelector('[name=amount]').value='2';document.querySelector('#form').requestSubmit()");
            check(a, "state.containers[0].volume===12", "Top-up arithmetic");
            js(a, "logEntry(state.containers[0].id);document.querySelector('[name=kind]').value='water';careFields();document.querySelector('[name=amount]').value='20';document.querySelector('#form').requestSubmit()");
            check(a, "state.containers[0].volume===12 && document.querySelector('#error').textContent.includes('exceed')", "Overflow blocked and state rolled back");
            js(a, "modal.close();logEntry(state.containers[3].id);document.querySelector('[name=kind]').value='nutrients';careFields();document.querySelector('[name=dose0]').value='2';document.querySelector('[name=dose1]').value='3';document.querySelector('[name=dose2]').value='1';document.querySelector('#form').requestSubmit()");
            check(a, "state.events[0].doses.length===3 && state.containers[3].volume===null", "Three nutrient doses on soil");
            js(a, "movePlant(state.plants[0].id);document.querySelector('[name=destination]').value=state.containers[1].id;document.querySelector('#form').requestSubmit()");
            check(a, "state.plants[0].containerId===state.containers[1].id && state.events.filter(e=>e.plantIds.includes(state.plants[0].id)).some(e=>e.kind==='reading')", "Movement history retained");
            js(a, "navigate('Plant',state.plants[0].id);plantNote(state.plants[0].id)");
            check(a, "rootedHandleBack() && !modal.open && page==='Plant'", "Back closes modal");
            check(a, "rootedHandleBack() && page==='Plants'", "Back returns to plant list");
            check(a, "JSON.parse(JSON.parse(RootedNative.readState()).value).plants[0].name==='Android test basil'", "Native disk persistence");
            check(a, "RootedNative.writeState('not JSON').length>0 && JSON.parse(JSON.parse(RootedNative.readState()).value).plants.length===1", "Invalid write preserves data");
            check(a, "(()=>{validateBackup(JSON.parse(JSON.stringify(state)));return true})()", "Backup validation");
            js(a, "window.photoTest='pending';(()=>{const canvas=document.createElement('canvas');canvas.width=1200;canvas.height=600;const g=canvas.getContext('2d');g.fillStyle='#234c3b';g.fillRect(0,0,1200,600);canvas.toBlob(async b=>{try{const image=await photo(new File([b],'test.png',{type:'image/png'}));commit(()=>{state.plants[0].photo=image;addEvent('note','Photo test','Test image',state.plants[0].containerId,[state.plants[0].id],{photo:image})});navigate('Plant',state.plants[0].id);window.photoTest='done'}catch(e){window.photoTest=e.message}},'image/png')})()");
            for(int i=0;i<50 && !"\"done\"".equals(js(a,"window.photoTest"));i++) Thread.sleep(100);
            check(a, "state.plants[0].photo.startsWith('data:image/jpeg;') && document.querySelector('.plant-photo').naturalWidth===1000", "Photo compression and rendering");
            js(a, "logEntry(state.containers[1].id);document.querySelector('[name=occurredAt]').value='2026-09-15T09:30';document.querySelector('[name=ph]').value='6.2';document.querySelector('#form').requestSubmit()");
            js(a, "logEntry(state.containers[1].id);document.querySelector('[name=occurredAt]').value='2026-08-10T10:00';document.querySelector('[name=ph]').value='5.5';document.querySelector('#form').requestSubmit()");
            check(a, "latest(state.containers[1].id).ph===6.2", "Backdated measurement does not replace latest reading");
            js(a, "window.olderReading=state.events.find(e=>e.readings?.ph===5.5);window.olderRecordedAt=olderReading.recordedAt;editEventDate(olderReading.id);document.querySelector('[name=occurredAt]').value='2026-09-20T08:15';document.querySelector('#form').requestSubmit()");
            check(a, "latest(state.containers[1].id).ph===5.5 && olderReading.recordedAt===olderRecordedAt && localActivityInput(olderReading.time)==='2026-09-20T08:15'", "Correcting event date reorders readings without changing log timestamp");
            js(a, "editEventDate(window.originalBirthId);document.querySelector('[name=started]').value='2026-07-01';document.querySelector('#form').requestSubmit()");
            check(a, "state.plants[0].started==='2026-07-01' && state.events.find(e=>e.id===originalBirthId).time==='2026-07-01'", "Timeline start correction updates plant date");
            runOnMainSync(a::finish);
            waitForIdleSync();
            MainActivity reopened = launch();
            check(reopened, "state.plants[0].name==='Android test basil' && state.plants[0].started==='2026-07-01' && state.containers[0].volume===12 && state.plants[0].photo.startsWith('data:image/jpeg;') && latest(state.containers[1].id).ph===5.5", "Journal, corrected dates and photo survive activity restart");
            check(reopened, "typeof window.RootedCloud==='undefined'", "Offline app has no cloud service");
            js(reopened, "navigate('Settings')");
            check(reopened, "!document.querySelector('#cloud-panel') && document.querySelector('#app').textContent.includes('No account')", "Settings has no account controls");
            check(reopened, "JSON.parse(RootedNative.readRecovery('previous')).ok && !!JSON.parse(RootedNative.readRecovery('previous')).value", "Previous save is recoverable");
            js(reopened, "window.beforeImport=JSON.stringify(state);offerRestore(initial());document.querySelector('#form').requestSubmit()");
            check(reopened, "state.plants.length===0 && JSON.parse(JSON.parse(RootedNative.readRecovery('checkpoint')).value).plants.length===1", "Import checkpoints existing journal");
            js(reopened, "reviewRecovery('checkpoint');document.querySelector('#form').requestSubmit()");
            check(reopened, "state.plants[0].name==='Android test basil'", "Restore pre-import copy");
            js(reopened, "window.beforeInvalid=JSON.stringify(state);importData(new File(['{}'],'invalid.json',{type:'application/json'}))");
            check(reopened, "JSON.stringify(state)===window.beforeInvalid", "Invalid import cannot replace data");
            check(reopened, "RootedNative.writeState(JSON.stringify({version:1,containers:{},plants:[],events:[],nutrients:[]})).length>0", "Native rejects malformed storage");
            js(reopened, "window.networkTest='pending';fetch('https://example.com').then(()=>window.networkTest='unexpected').catch(()=>window.networkTest='blocked')");
            for(int i=0;i<50 && "\"pending\"".equals(js(reopened,"window.networkTest"));i++) Thread.sleep(100);
            check(reopened, "window.networkTest==='blocked'", "Network is blocked");
            js(reopened, "state=initial();save();render()");
            results.putString("stream", "PASS: offline startup, phone width, container setup, backdated plant start, start-date correction without duplicate entry, slot collision, EC/pH reading, reservoir replacement/top-up/overflow, soil feeding, movement history, Back navigation, atomic storage, backup validation, photo compression/rendering, backdated measurements, event-date corrections, activity restart with dates and photo.\n");
            results.putString("rooted_result", "PASS");
            finish(Activity.RESULT_OK, results);
        } catch (Throwable error) {
            results.putString("stream", "FAIL: " + error.toString() + "\n");
            results.putString("rooted_result", "FAIL");
            finish(Activity.RESULT_CANCELED, results);
        }
    }
}




