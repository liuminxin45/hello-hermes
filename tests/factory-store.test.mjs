import test from 'node:test';
import assert from 'node:assert/strict';
import {createVisit,emptyLibrary,requestSources,retrieveSources,verifySources,deliverDraft,saveExperience} from '../docs/public/factory/engine.mjs';
import {ACTIVE_KEY,LIBRARY_KEY,compatibleVisit,validLibrary,selectVisits,selectLegacy,archiveKeyFor,write,writeBatch,read,listVisits,listLegacy,flush} from '../docs/public/factory/store.mjs';
import {createNewsVisit,NEWS_ACTIVE,NEWS_VERSION} from '../docs/public/factory/news-lesson.mjs';

const visit=(id='current')=>createVisit({nickname:'调查员'},emptyLibrary(),id);

test('current visit selection restores the current scenario and prefers the active copy',()=>{
 const current=visit(),history=structuredClone(current),oldScenario=visit('old-scenario'),broken=visit('broken');
 history.profile.nickname='历史副本';oldScenario.scenarioVersion='retired-scenario';delete broken.learning.photos;
 const rows=[{key:'factory-v3-history-current',value:history},{key:ACTIVE_KEY,value:current},{key:'old',value:oldScenario},{key:'broken',value:broken},{key:'order-only',value:{version:3,id:'order-only',task:{},order:{nickname:'旧访客'}}}];
 assert.deepEqual(selectVisits(rows),[current]);
 assert.equal(compatibleVisit(oldScenario),null);assert.equal(compatibleVisit(broken),null);
 const invalidDate=structuredClone(current);invalidDate.startedAt='yesterday';assert.equal(compatibleVisit(invalidDate),null);
});

test('legacy selection preserves all old/corrupt scenarios and exposes safe display metadata',()=>{
 const oldScenario=visit('retired');oldScenario.scenarioVersion='intel-investigation-v0';
 const rows=[{key:'v1',value:{version:1,id:'a'}},{key:'v2',value:{version:2,id:'b',order:{nickname:'旧访客'}}},{key:'schema-v2',value:{schemaVersion:2,id:'c'}},{key:'retired',value:oldScenario},{key:'bad-v3',value:{schemaVersion:3,id:'d'}},{key:'factory-v3-history-corrupt',value:null},{key:ACTIVE_KEY,value:'damaged'},{key:LIBRARY_KEY,value:emptyLibrary()},{key:'other-library',value:{schemaVersion:3,preferences:[],skills:[],history:[]}},{key:'current',value:visit()}];
 const legacy=selectLegacy(rows);
 assert.deepEqual(legacy.map(x=>x.key),['v1','v2','schema-v2','retired','bad-v3','factory-v3-history-corrupt',ACTIVE_KEY]);
 assert.equal(legacy[0].metadata.nickname,'访客');assert.equal(legacy[1].metadata.nickname,'旧访客');
 assert.equal(legacy[3].metadata.scenarioVersion,'intel-investigation-v0');
 assert.match(legacy[3].metadata.reason,/场景版本不兼容/);assert.match(legacy[4].metadata.reason,/无法安全恢复/);
 assert.equal(legacy[6].value,'damaged');assert.ok(legacy.every(x=>x.metadata.label&&x.metadata.reason));
});

test('archive identity is stable for retries and preserves changes to the same old ID',()=>{
 const value={schemaVersion:3,version:3,scenarioVersion:'retired',id:'same-id',profile:{nickname:'初始'}};
 assert.equal(archiveKeyFor(value),archiveKeyFor(structuredClone(value)));
 assert.notEqual(archiveKeyFor(value),archiveKeyFor({...value,profile:{nickname:'修改过'}}));
 assert.notEqual(archiveKeyFor(value),archiveKeyFor(value,LIBRARY_KEY));
 assert.equal(validLibrary(emptyLibrary()),true);assert.equal(validLibrary({schemaVersion:3}),false);
 assert.equal(validLibrary({schemaVersion:3,preferences:[null],skills:[],history:[]}),false);
});

test('saved entry shapes are validated before a visit can be resumed',()=>{
 const current=visit('with-library');requestSources(current);retrieveSources(current);verifySources(current);deliverDraft(current);saveExperience(current,{preference:true,skill:true});
 assert.equal(validLibrary(current.task.library),true);assert.equal(compatibleVisit(current),current);
 for(const alter of [
  lib=>lib.preferences.push(null),
  lib=>delete lib.preferences[0].value,
  lib=>lib.skills[0].steps.splice(0),
  lib=>lib.skills[0].steps.push(null),
  lib=>delete lib.history[0].eventIds,
  lib=>lib.history[0].draft.push(null),
  lib=>lib.history[0].draft[0].sources.push(null)
 ]){
  const bad=structuredClone(current);alter(bad.task.library);
  assert.equal(validLibrary(bad.task.library),false);assert.equal(compatibleVisit(bad),null);
  const legacy=selectLegacy([{key:ACTIVE_KEY,value:bad}]);assert.equal(legacy.length,1);assert.equal(legacy[0].value,bad);
 }
});

// A small transaction-level fake keeps a private working copy until commit. It exercises
// archive + replacement atomicity without introducing a runtime/test dependency.
function indexedDBFake(){
 const records=new Map();let failPutKey=null;
 const clone=x=>structuredClone(x);
 const db={objectStoreNames:{contains:name=>name==='records'},transaction(_name,mode){
  const work=new Map([...records].map(([k,v])=>[k,clone(v)]));let pending=0,ended=false,aborted=false;
  const tx={error:null,oncomplete:null,onerror:null,onabort:null,abort(error){if(ended||aborted)return;aborted=true;tx.error=error||Error('aborted');queueMicrotask(()=>tx.onabort?.());},objectStore(){return store;}};
  const settle=()=>{if(!pending&&!ended&&!aborted)queueMicrotask(()=>{if(pending||ended||aborted)return;ended=true;if(mode==='readwrite'){records.clear();for(const [k,v]of work)records.set(k,v);}tx.oncomplete?.();});};
  function schedule(req,fn){pending++;queueMicrotask(()=>{try{if(aborted)return;req.result=fn();req.onsuccess?.({target:req});}catch(error){req.error=error;req.onerror?.({target:req});tx.abort(error);}finally{pending--;settle();}});return req;}
  const store={get:key=>schedule({},()=>clone(work.get(key))),put(value,key){const saved=clone(value);return schedule({},()=>{if(key===failPutKey){failPutKey=null;throw Error('injected write failure');}work.set(key,saved);return key;});},openCursor(){const entries=[...work];let index=0;const req={};const advance=()=>schedule(req,()=>index<entries.length?{key:entries[index][0],value:clone(entries[index][1]),continue(){index++;advance();}}:null);return advance();}};
  settle();return tx;
 }};
 return {records,failNextPut(key){failPutKey=key;},api:{open(){const req={};queueMicrotask(()=>{req.result=db;req.onsuccess?.();});return req;}}};
}

test('incompatible active/library are atomically archived before replacement, with no deletion',async t=>{
 const fake=indexedDBFake();globalThis.indexedDB=fake.api;
 t.after(()=>{delete globalThis.indexedDB;});
 const old={version:3,schemaVersion:3,scenarioVersion:'retired',id:'old',profile:{nickname:'老朋友'}},oldLibrary={schemaVersion:2,preferences:[{text:'旧偏好'}]};
 fake.records.set(ACTIVE_KEY,structuredClone(old));fake.records.set(LIBRARY_KEY,structuredClone(oldLibrary));
 fake.records.set('active-investigation',{version:2,id:'kept',order:{nickname:'旧旅客'}});
 const current=visit('new');const outcome=await writeBatch([[ACTIVE_KEY,current],[LIBRARY_KEY,current.task.library]]);
 assert.equal(outcome.archives.length,2);assert.ok(outcome.archives.every(x=>x.created));
 assert.equal(outcome.archived.nickname,'老朋友');assert.equal(outcome.archived.originalKey,ACTIVE_KEY);
 const archiveKey=archiveKeyFor(old),libraryArchiveKey=archiveKeyFor(oldLibrary,LIBRARY_KEY);
 assert.deepEqual(fake.records.get(archiveKey).record,old);assert.deepEqual(fake.records.get(libraryArchiveKey).record,oldLibrary);
 assert.equal(fake.records.get(libraryArchiveKey).archiveKind,'readonly-library');
 assert.equal(fake.records.get('active-investigation').id,'kept');assert.deepEqual(await read(LIBRARY_KEY),emptyLibrary());
 assert.deepEqual((await listVisits()).map(x=>x.id),['new']);
 const legacy=await listLegacy();assert.equal(legacy.length,3);
 assert.equal(legacy.find(x=>x.key===archiveKey).metadata.originalKey,ACTIVE_KEY);
 assert.match(legacy.find(x=>x.key===libraryArchiveKey).metadata.label,/旧版资料库/);

 await t.test('retrying the identical old active reuses its archive and preserves the library',async()=>{
  fake.records.set(ACTIVE_KEY,structuredClone(old));
  const lib={schemaVersion:3,preferences:[{id:'saved-pref',kind:'audience',value:'technical'}],skills:[],history:[]};fake.records.set(LIBRARY_KEY,lib);
  const again=await write(ACTIVE_KEY,current);
  assert.equal(again.archived.key,archiveKey);assert.equal(again.archived.created,false);
  assert.deepEqual(await read(LIBRARY_KEY),lib);assert.equal([...fake.records.keys()].filter(x=>x.startsWith('factory-readonly-archive:')).length,2);
 });

 await t.test('archive and all replacements roll back together on write failure, then the queue recovers',async()=>{
  const changed={...old,profile:{nickname:'改名后的旧记录'}};fake.records.set(ACTIVE_KEY,changed);
  const originalLibrary=structuredClone(fake.records.get(LIBRARY_KEY)),beforeKeys=[...fake.records.keys()].sort();
  fake.failNextPut(LIBRARY_KEY);
  await assert.rejects(writeBatch([[ACTIVE_KEY,current],[LIBRARY_KEY,emptyLibrary()]]),/injected write failure|回滚|写入失败/);
  assert.deepEqual(fake.records.get(ACTIVE_KEY),changed);assert.deepEqual(fake.records.get(LIBRARY_KEY),originalLibrary);
  assert.deepEqual([...fake.records.keys()].sort(),beforeKeys);assert.equal(fake.records.has(archiveKeyFor(changed)),false);
  const recovered=await write(ACTIVE_KEY,current);assert.equal(recovered.archived.created,true);
  await flush();assert.equal((await read(ACTIVE_KEY)).id,'new');
 });

 await t.test('an unrelated value occupying an archive key is retained with a collision suffix',async()=>{
  const collision={version:1,id:'collision',order:{nickname:'撞键测试'}};const key=archiveKeyFor(collision);
  fake.records.set(ACTIVE_KEY,collision);fake.records.set(key,{unrelated:'keep me'});
  const saved=await write(ACTIVE_KEY,current);
  assert.equal(saved.archived.key,key+':collision-1');assert.deepEqual(fake.records.get(key),{unrelated:'keep me'});
  assert.deepEqual(fake.records.get(saved.archived.key).record,collision);
 });

 await t.test('a malformed v3 library is archived intact instead of silently discarded',async()=>{
  const badLibrary={schemaVersion:3,preferences:[null],skills:[{id:'bad-steps',name:'旧方法',steps:null}],history:[]};
  const badVisit=visit('bad-library');badVisit.task.library=structuredClone(badLibrary);
  fake.records.set(ACTIVE_KEY,badVisit);fake.records.set(LIBRARY_KEY,badLibrary);
  assert.equal((await listVisits()).length,0);
  const saved=await writeBatch([[ACTIVE_KEY,current],[LIBRARY_KEY,emptyLibrary()]]);
  assert.equal(saved.archives.length,2);
  assert.deepEqual(fake.records.get(archiveKeyFor(badLibrary,LIBRARY_KEY)).record,badLibrary);
  assert.deepEqual(fake.records.get(archiveKeyFor(badVisit)).record,badVisit);
 });
 await t.test('new scenario protects corrupt active data atomically without touching legacy active or library',async()=>{
  const corrupt={version:3,schemaVersion:3,scenarioVersion:NEWS_VERSION,id:'damaged-news',learning:{mainComplete:true}};
  const next=createNewsVisit('new-news'),legacyActive=structuredClone(fake.records.get(ACTIVE_KEY)),legacyLibrary=structuredClone(fake.records.get(LIBRARY_KEY));
  fake.records.set(NEWS_ACTIVE,corrupt);const historyKey='newsroom-v1-history:'+next.id;
  fake.failNextPut(historyKey);const keysBefore=[...fake.records.keys()].sort();
  await assert.rejects(writeBatch([[NEWS_ACTIVE,next],[historyKey,next]]));
  assert.deepEqual(fake.records.get(NEWS_ACTIVE),corrupt);assert.deepEqual([...fake.records.keys()].sort(),keysBefore);
  const saved=await writeBatch([[NEWS_ACTIVE,next],[historyKey,next]]);
  assert.equal(saved.archived.originalKey,NEWS_ACTIVE);assert.deepEqual(fake.records.get(archiveKeyFor(corrupt,NEWS_ACTIVE)).record,corrupt);
  assert.deepEqual(fake.records.get(ACTIVE_KEY),legacyActive);assert.deepEqual(fake.records.get(LIBRARY_KEY),legacyLibrary);assert.deepEqual(fake.records.get(historyKey),next);
 });
});
