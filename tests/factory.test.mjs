import test from 'node:test';
import assert from 'node:assert/strict';
import {
  VERSION,SCHEMA_VERSION,SCENARIO_VERSION,SOURCES,createVisit,emptyLibrary,currentSession,
  requestSources,retrieveSources,verifySources,deliverDraft,saveExperience,reviseSkill,startNewSession,loadReuse,
  chapterObservation,setChapter,observeEvent,eventById,inspectContext,contextReplay,recordReplay,chapterReady,completeChapter,
  askQuestion,scoreQuiz,firstScore,bestScore,isGraduate,restoreVisit,sceneModel
} from '../docs/public/factory/engine.mjs';

const clone=value=>structuredClone(value);
const BANK=Array.from({length:6},(_,i)=>({id:'core-'+i,q:'情境'+i,options:['有依据的操作','不受支持的操作'],answer:0,objectiveIds:['O'+(i+1)]}));
const correct=Object.fromEntries(BANK.map(q=>[q.id,0]));
function observe(s,events){for(const event of events)observeEvent(s,event.id);return events;}
function verifiedFirst(s=createVisit()){
  observe(s,requestSources(s));observe(s,retrieveSources(s));observe(s,verifySources(s));return s;
}
function deliveredFirst(s=createVisit()){verifiedFirst(s);observe(s,deliverDraft(s));return s;}
function withExperience(options={preference:true,skill:true},raw={}){const s=deliveredFirst(createVisit(raw));observe(s,saveExperience(s,options));return s;}
function finishBoth(s=withExperience()){
  inspectContext(s);for(let i=0;i<4;i++)completeChapter(s,i);
  observe(s,startNewSession(s));observe(s,loadReuse(s));observe(s,requestSources(s));observe(s,retrieveSources(s));observe(s,verifySources(s));observe(s,deliverDraft(s));completeChapter(s,4);return s;
}

test('five observation chapters and scene projection never execute or modify the task',()=>{
  const s=createVisit(),task=clone(s.task);
  for(const index of [0,4,2,1,3,0]){setChapter(s,index);sceneModel(s);}
  assert.deepEqual(s.task,task);assert.deepEqual(s.learning.observedEventIds,[]);
  assert.equal(s.tour.chapter,0);assert.throws(()=>setChapter(s,5),/章节/);assert.deepEqual(s.task,task);
});

test('source request precedes execution, and only returned original evidence becomes usable',()=>{
  const s=createVisit(),initial=clone(currentSession(s));
  assert.equal(initial.requestCreated,false);assert.equal(initial.toolSucceeded,false);
  assert.throws(()=>retrieveSources(s),/请求/);assert.deepEqual(currentSession(s),initial);
  const request=requestSources(s)[0];assert.equal(request.type,'request-created');
  assert.equal(currentSession(s).toolSucceeded,false);assert.deepEqual(currentSession(s).evidenceIds,['S1','S2','S3']);
  const result=retrieveSources(s)[0];assert.equal(result.type,'tool-result');assert.ok(request.seq<result.seq);
  assert.deepEqual(result.evidenceIds,['A1','A2','D1']);assert.equal(result.result.usable,true);
  assert.ok(currentSession(s).context.sourceIds.every(id=>result.evidenceIds.includes(id)));
});

test('failed and wrong-version reads cannot confirm facts or produce a successful draft',()=>{
  for(const options of [{fail:true},{wrongVersion:true}]){
    const s=createVisit();requestSources(s);const initial=clone(currentSession(s).evidenceIds);
    const returned=retrieveSources(s,options)[0];assert.equal(returned.result.usable,false);
    assert.deepEqual(currentSession(s).evidenceIds,initial);assert.equal(currentSession(s).toolSucceeded,false);
    assert.throws(()=>verifySources(s),/依据/);assert.throws(()=>deliverDraft(s),/核实/);
    assert.equal(currentSession(s).delivered,false);assert.deepEqual(currentSession(s).draft,[]);
    retrieveSources(s);verifySources(s);deliverDraft(s);assert.equal(currentSession(s).delivered,true);
  }
});

test('first draft contains two independent supported messages, not a forced third item',()=>{
  const s=deliveredFirst();const a=currentSession(s);
  assert.equal(a.draft.length,2);assert.equal(a.corrections.find(c=>c.id==='merge-atlas').to,'A1');
  assert.ok(a.draft[0].sources.includes('A1'));assert.ok(a.draft[1].sources.includes('D1'));
  assert.ok(a.draft.every(item=>item.sources.every(id=>a.evidenceIds.includes(id)&&SOURCES.some(x=>x.id===id))));
  assert.ok(a.draft[0].claim.includes('审核'));assert.ok(a.draft.every(item=>item.unknown));
  assert.equal(s.task.published,false);assert.ok(!s.task.events.some(e=>/publish|notification|training/.test(e.type)));
});

test('the optional audience choice has a real draft consequence',()=>{
  const business=currentSession(deliveredFirst(createVisit({audience:'business'}))).draft;
  const technical=currentSession(deliveredFirst(createVisit({audience:'technical'}))).draft;
  assert.notDeepEqual(business.map(x=>x.emphasis),technical.map(x=>x.emphasis));
  assert.deepEqual(business.map(x=>x.sources),technical.map(x=>x.sources));
});

test('refusing to save does not create preference or skill entries',()=>{
  const s=withExperience({preference:false,skill:false});
  assert.deepEqual(s.task.library.preferences,[]);assert.deepEqual(s.task.library.skills,[]);
  assert.equal(s.task.library.history.length,1);
  assert.ok(!s.task.events.some(e=>['preference-written','skill-written'].includes(e.type)));
  startNewSession(s);loadReuse(s);const a=currentSession(s);
  assert.deepEqual(a.readings.memoryIds,[]);assert.deepEqual(a.readings.skillIds,[]);
  assert.ok(!s.task.events.some(e=>e.sessionId===a.id&&['memory-read','skill-read'].includes(e.type)));
});

test('a save refusal preserves pre-existing long-term entries instead of erasing them',()=>{
  const old=withExperience().task.library,preferences=clone(old.preferences),skills=clone(old.skills);
  const s=deliveredFirst(createVisit({},old));saveExperience(s,{preference:false,skill:false});
  assert.deepEqual(s.task.library.preferences,preferences);assert.deepEqual(s.task.library.skills,skills);
});

test('saved entries and their later reads are linked by stable ids and source events',()=>{
  const s=withExperience();const lib=s.task.library;
  for(const entry of [...lib.preferences,...lib.skills]){
    const write=eventById(s,entry.sourceEventId);assert.ok(write);assert.equal(write.result.entry.id,entry.id);
    assert.equal(write.sessionId,entry.sourceSessionId);
  }
  startNewSession(s);loadReuse(s);const a=currentSession(s);
  for(const [type,key,entries] of [['memory-read','memoryIds',lib.preferences],['skill-read','skillIds',lib.skills]]){
    for(const id of a.readings[key]){const entry=entries.find(x=>x.id===id),read=s.task.events.find(e=>e.type===type&&e.input.entryId===id);assert.ok(entry&&read);assert.equal(read.result.entry.id,id);assert.equal(read.sessionId,a.id);}
  }
  const historyRead=s.task.events.find(e=>e.type==='history-read');assert.ok(historyRead);
  assert.ok(lib.history.some(x=>x.id===historyRead.result.historyId));
});

test('new session starts with no old full context or implicit long-term reads',()=>{
  const s=withExperience(),old=clone(currentSession(s).context);startNewSession(s);const a=currentSession(s);
  assert.equal(a.number,2);assert.notEqual(a.context.head,old.head);
  for(const key of ['sourceIds','memoryIds','skillIds','historyIds','middle','tail'])assert.deepEqual(a.context[key],[]);
  assert.deepEqual(a.evidenceIds,[]);assert.deepEqual(a.readings,{memoryIds:[],skillIds:[],historyIds:[]});
  assert.equal(a.reuseLoaded,false);assert.equal(s.task.sessions[0].context.middle.length,3);
  assert.ok(!s.task.events.some(e=>e.sessionId===a.id&&['memory-read','skill-read','history-read'].includes(e.type)));
});

test('entries that exist but were not loaded are never reported as used',()=>{
  const s=withExperience();startNewSession(s);const rawLibrary=clone(s.task.library);
  loadReuse(s,{enabled:false});const a=currentSession(s);
  assert.equal(a.reuseEnabled,false);assert.deepEqual(a.readings,{memoryIds:[],skillIds:[],historyIds:[]});
  assert.deepEqual(a.context.memoryIds,[]);assert.deepEqual(a.context.skillIds,[]);assert.deepEqual(a.context.historyIds,[]);
  assert.deepEqual(s.task.library,rawLibrary);
  const applied=s.task.events.find(e=>e.sessionId===a.id&&e.type==='requirements-applied');assert.equal(applied.result.baseline,true);
  assert.ok(!s.task.events.some(e=>e.sessionId===a.id&&['memory-read','skill-read','history-read'].includes(e.type)));
});

test('current technical request overrides old business preference without changing the stored preference',()=>{
  const s=withExperience({preference:true,skill:true},{audience:'business'});startNewSession(s);loadReuse(s);
  assert.equal(s.task.library.preferences[0].value,'business');assert.equal(currentSession(s).audience,'technical');
  requestSources(s);retrieveSources(s);verifySources(s);deliverDraft(s);
  const a=currentSession(s);assert.ok(a.draft.every(item=>item.emphasis.startsWith('技术')));
  assert.ok(a.draft[0].sources.includes('A3'));assert.ok(!a.draft[0].sources.includes('A1'));
});

test('old retrieved facts remain clues until the new task checks its latest original source',()=>{
  const s=withExperience();startNewSession(s);loadReuse(s);requestSources(s);
  assert.throws(()=>verifySources(s),/依据/);assert.throws(()=>deliverDraft(s),/核实/);
  retrieveSources(s,{wrongVersion:true});assert.equal(currentSession(s).verified,false);
  assert.throws(()=>deliverDraft(s),/核实/);retrieveSources(s);verifySources(s);deliverDraft(s);
  assert.equal(currentSession(s).draft.length,1);assert.deepEqual(currentSession(s).draft[0].sources,['A3']);
});

test('observing and replaying events never repeats a business effect or long-term write',()=>{
  const s=withExperience();const task=clone(s.task),event=s.task.events.find(e=>e.type==='preference-written');
  for(let i=0;i<3;i++){setChapter(s,3);observeEvent(s,event.id);sceneModel(s);recordReplay(s,'context-long');contextReplay(s);}
  assert.deepEqual(s.task,task);assert.equal(s.learning.observedEventIds.filter(x=>x===event.id).length,1);
  assert.throws(()=>observeEvent(s,'missing-event'),/事件/);assert.deepEqual(s.task,task);
});

test('repeated completed operations do not rewrite records or duplicate draft/history/reads',()=>{
  const s=withExperience(),first=clone(s.task);
  assert.deepEqual(requestSources(s),[]);assert.deepEqual(retrieveSources(s),[]);assert.deepEqual(verifySources(s),[]);assert.deepEqual(deliverDraft(s),[]);assert.deepEqual(saveExperience(s,{preference:true,skill:true}),[]);assert.deepEqual(s.task,first);
  startNewSession(s);loadReuse(s);const second=clone(s.task);
  assert.deepEqual(startNewSession(s),[]);assert.deepEqual(loadReuse(s),[]);assert.deepEqual(s.task,second);
});

test('a task can deliver with no compression and optional long replay only changes tour/learning state',()=>{
  const s=verifiedFirst(),task=clone(s.task);inspectContext(s);recordReplay(s,'summary-loss');
  const replay=contextReplay(s,{loss:true});assert.equal(replay.load,70);assert.equal(replay.units,35);
  for(const kind of ['rules','head','tail'])assert.deepEqual(replay.before.find(x=>x.kind===kind),replay.after.find(x=>x.kind===kind));
  assert.deepEqual(s.task,task);assert.ok(s.tour.replay);assert.ok(s.learning.experiments.some(x=>x.kind==='summary-loss'));
  deliverDraft(s);assert.equal(currentSession(s).delivered,true);assert.equal(currentSession(s).context.units,40);
  assert.ok(!Object.hasOwn(currentSession(s).context,'after'));
});

test('chapter completion requires observed causal evidence, not time spent or a changed room',()=>{
  const s=createVisit();setChapter(s,0);assert.equal(chapterReady(s,0),false);assert.throws(()=>completeChapter(s,0),/观察/);
  const event=requestSources(s)[0];assert.equal(chapterReady(s,0),false);observeEvent(s,event.id);completeChapter(s,0);
  const task=clone(s.task);completeChapter(s,0);assert.deepEqual(s.learning.completedChapters,[0]);assert.deepEqual(s.task,task);
  assert.throws(()=>completeChapter(s,4),/观察/);
});

test('one event has the causal fields shared by mentor, scene and report',()=>{
  const s=withExperience();startNewSession(s);loadReuse(s);requestSources(s);retrieveSources(s);verifySources(s);deliverDraft(s);
  assert.equal(new Set(s.task.events.map(x=>x.id)).size,s.task.events.length);
  for(const ev of s.task.events){assert.ok(ev.id&&ev.sessionId&&ev.title&&ev.detail&&ev.nodeId&&ev.at);assert.equal(typeof ev.input,'object');assert.equal(typeof ev.result,'object');assert.ok(Array.isArray(ev.evidenceIds)&&Array.isArray(ev.objectiveIds));assert.equal(eventById(s,ev.id),ev);}
});

test('first score remains visible when a reviewed equivalent assessment reaches a better score',()=>{
  const s=finishBoth();assert.equal(firstScore(s),null);assert.equal(isGraduate(s),false);
  assert.throws(()=>scoreQuiz(s,BANK,{}),/所有核心题/);assert.equal(s.learning.attempts.length,0);
  const first=scoreQuiz(s,BANK,Object.fromEntries(BANK.map(q=>[q.id,1])));assert.equal(first.score,0);assert.equal(first.review,false);assert.equal(isGraduate(s),false);
  const review=scoreQuiz(s,BANK,correct,{review:true});assert.equal(review.score,100);assert.equal(review.review,true);
  assert.equal(firstScore(s),0);assert.equal(bestScore(s),100);assert.equal(s.learning.attempts.length,2);assert.equal(isGraduate(s),true);
});

test('a passing quiz alone does not imply five chapters were observed or mastered',()=>{
  const s=createVisit();scoreQuiz(s,BANK,correct);assert.equal(bestScore(s),100);assert.equal(isGraduate(s),false);
  assert.deepEqual(s.learning.completedChapters,[]);assert.deepEqual(s.learning.observedEventIds,[]);
});

test('only actually selected questions are recorded and selection cannot change task state',()=>{
  const s=createVisit(),task=clone(s.task);assert.deepEqual(s.learning.questions,[]);
  const question={id:'why-tool',q:'谁真正执行读取？',a:{answer:'工具',evidence:'请求卡尚未执行',boundary:'模型不直接执行',return:'继续读原文'},claimIds:['generic-tool']};
  askQuestion(s,question);askQuestion(s,question);assert.equal(s.learning.questions.length,1);assert.equal(s.learning.questions[0].question,question.q);assert.deepEqual(s.task,task);
});

test('old or unknown scenario records are rejected without mutation or silent migration',()=>{
  for(const old of [{version:1,order:{quantity:3},photos:['keep']},{version:2,order:{nickname:'旧调查员'},events:[{id:'old'}]},{...createVisit(),scenarioVersion:'unrecognized-v3'}]){
    const snapshot=clone(old);assert.equal(restoreVisit(old),null);assert.deepEqual(old,snapshot);
  }
  const current=createVisit();assert.equal(current.version,VERSION);assert.equal(current.schemaVersion,SCHEMA_VERSION);assert.equal(current.scenarioVersion,SCENARIO_VERSION);assert.ok(restoreVisit(clone(current)));
});

test('malformed v3 records are rejected before a restored UI can dereference missing learning data',()=>{
  const malformed={schemaVersion:SCHEMA_VERSION,scenarioVersion:SCENARIO_VERSION,task:{sessions:[{}],events:[]},tour:{},learning:{observedEventIds:[]}};
  const snapshot=clone(malformed);assert.equal(restoreVisit(malformed),null);assert.deepEqual(malformed,snapshot);
});

test('creating a visit does not mutate the persisted library object supplied by the caller',()=>{
  const library=emptyLibrary(),snapshot=clone(library);const s=deliveredFirst(createVisit({},library));saveExperience(s,{preference:true,skill:true});assert.deepEqual(library,snapshot);assert.equal(s.task.library.preferences.length,1);
});

test('an explicit skill revision is a new write and the next session reads that revised method, without training or executing it',()=>{const s=withExperience();const id=s.task.library.skills[0].id,steps=['先检查公告版本','保留申请审核条件','按当前研发受众交付草稿'];const oldDraft=clone(currentSession(s).draft),ev=reviseSkill(s,id,steps)[0];assert.equal(ev.type,'skill-revised');assert.equal(s.task.library.skills[0].sourceEventId,ev.id);assert.deepEqual(currentSession(s).draft,oldDraft);assert.deepEqual(reviseSkill(s,id,steps),[]);const snapshot=clone(s.task);assert.throws(()=>reviseSkill(s,id,[]),/步骤/);assert.deepEqual(s.task,snapshot);startNewSession(s);const read=loadReuse(s).find(x=>x.type==='skill-read');assert.deepEqual(read.result.entry.steps,steps);assert.equal(read.result.entry.sourceEventId,ev.id);assert.equal(currentSession(s).toolSucceeded,false);assert.equal(currentSession(s).delivered,false);});

test('different visits retain distinct saved-history identity and reuse the most recent relevant record',()=>{const first=withExperience(),second=withExperience({preference:false,skill:false});second.task.library.history.unshift(clone(first.task.library.history[0]));startNewSession(second);const read=loadReuse(second).find(x=>x.type==='history-read');assert.equal(read.result.historyId,second.id+':history-1');assert.notEqual(first.id,second.id);assert.equal(second.task.library.history.at(-1).sourceVisitId,second.id);});

test('chapter revisits select their own observed causal evidence without replaying a later chapter event',()=>{const s=finishBoth(),task=clone(s.task);setChapter(s,0);assert.equal(chapterObservation(s).type,'request-created');assert.equal(chapterObservation(s).sessionId,'session-1');setChapter(s,1);assert.equal(chapterObservation(s).type,'source-verified');setChapter(s,2);assert.equal(chapterObservation(s).type,'context-selected');assert.deepEqual(chapterObservation(s).evidenceIds,['A1','A2','D1']);setChapter(s,3);assert.equal(chapterObservation(s).type,'experience-decision');setChapter(s,4);assert.equal(chapterObservation(s).type,'draft-delivered');assert.equal(chapterObservation(s).sessionId,'session-2');assert.deepEqual(s.task,task);});
