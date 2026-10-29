import test from 'node:test';
import assert from 'node:assert/strict';
import {createNewsVisit,restoreNewsVisit,createLessonController,STEPS} from '../docs/public/factory/news-lesson.mjs';
import {createVisit} from '../docs/public/factory/engine.mjs';
import {compatibleVisit} from '../docs/public/factory/store.mjs';
import {newsReportHTML,canReceiveMemento} from '../docs/public/factory/news-report.mjs';
const seconds=(c,n)=>{for(let i=0;i<n*10;i++)c.tick(.1);};
function setup(reduced=false){const s=createNewsVisit('news-test'),c=createLessonController(s,{reduced});return {s,c};}
function enter(c,n){while(c.snapshot().index<n){if(c.snapshot().phase==='playing')c.skip();assert.equal(c.next({submitted:true}),true);}if(c.snapshot().phase==='playing')c.skip();}
test('no material exists before submitting and search is an actual separate action',()=>{
 const {s,c}=setup();assert.deepEqual(s.task.sessions[0].evidenceIds,[]);assert.equal(s.task.events.length,0);assert.equal(c.next(),false);
 c.next({submitted:true});assert.deepEqual(c.snapshot().visibleNodeIds,['intake','context']);assert.equal(s.task.events[0].type,'request-received');assert.deepEqual(s.task.sessions[0].evidenceIds,[]);
 enter(c,3);assert.equal(s.task.events.at(-1).type,'search-requested');assert.deepEqual(s.task.sessions[0].evidenceIds,[]);assert.ok(!c.snapshot().visibleNodeIds.includes('tools'));
 c.next();assert.equal(s.task.events.at(-1).type,'search-result');assert.deepEqual(s.task.sessions[0].evidenceIds,['S1','S2','S3']);assert.ok(!c.snapshot().lines.join('').includes('S1'));c.skip();assert.ok(c.snapshot().lines.join('').includes('S1'));
});
test('every step retains copy, focus, revealed nodes, events and current flow after 60 seconds',()=>{
 const {s,c}=setup();for(let target=2;target<STEPS.length;target++){
  if(c.snapshot().phase==='playing')c.skip();assert.equal(c.next({submitted:true}),true);const start=c.snapshot(),events=structuredClone(s.task.events);
  for(let i=0;i<61*10;i++){c.tick(.1);assert.equal(c.snapshot().index,target);assert.equal(c.snapshot().copy,start.copy);}
  const held=c.snapshot();assert.equal(held.phase,'holding');assert.deepEqual(held.visibleNodeIds,start.visibleNodeIds);assert.deepEqual(held.flow,start.flow);assert.equal(held.focusNodeId,start.focusNodeId);assert.deepEqual(s.task.events,events);
 }
 assert.equal(s.learning.mainComplete,true);assert.deepEqual(s.learning.deep,{context:false,reuse:false});assert.equal(s.task.sessions.length,1);assert.equal(s.task.published,false);
});
test('double clicks cannot enqueue progression; search and source results each return to context',()=>{
 const {s,c}=setup();c.next({submitted:true});for(let i=0;i<8;i++)assert.equal(c.next(),false);assert.equal(c.snapshot().index,2);
 enter(c,5);assert.deepEqual(c.snapshot().flow.slice(0,2),['tools','context']);assert.equal(s.task.events.filter(x=>x.type==='search-result').length,1);
 enter(c,8);assert.deepEqual(c.snapshot().flow.slice(0,2),['tools','context']);assert.equal(s.task.events.filter(x=>x.type==='tool-result').length,1);
});
test('previous, replay and pause reasons do not re-execute facts or expose later content',()=>{
 const {s,c}=setup();enter(c,10);const facts=structuredClone(s.task);while(c.snapshot().index>3)c.previous();assert.ok(!c.snapshot().lines.join('').includes('仍需审核'));assert.ok(!c.snapshot().visibleNodeIds.includes('tools'));
 c.replay();c.setPause('user',true);c.setPause('question',true);seconds(c,15);assert.equal(c.snapshot().elapsed,0);c.setPause('question',false);assert.equal(c.snapshot().paused,true);c.setPause('user',false);seconds(c,8);assert.equal(c.snapshot().phase,'holding');
 enter(c,10);assert.deepEqual(s.task,facts);const resumed=createLessonController(structuredClone(s));assert.equal(resumed.snapshot().phase,'holding');assert.equal(resumed.snapshot().index,10);
});
test('hidden page holds the teaching clock; resuming never advances to another step',()=>{
 const {c}=setup();enter(c,3);c.replay();c.setPause('hidden',true);seconds(c,70);assert.equal(c.snapshot().elapsed,0);c.setPause('hidden',false);seconds(c,20);assert.equal(c.snapshot().index,3);assert.equal(c.snapshot().phase,'holding');
});
test('reading failure masks success, stays put and returns to the exact main step',()=>{
 const {s,c}=setup();enter(c,7);const facts=structuredClone(s.task),before=c.snapshot();assert.ok(c.open('failure'));seconds(c,70);assert.equal(c.snapshot().branch.kind,'failure');assert.equal(c.snapshot().draft,null);assert.match(c.snapshot().lines.join(''),/没有成功草稿/);assert.deepEqual(s.task,facts);c.close();assert.equal(c.snapshot().index,before.index);assert.equal(c.snapshot().phase,before.phase);assert.deepEqual(c.snapshot().flow,before.flow);
});
test('context batches are manual, threshold holds, compression changes representation and keeps raw IDs',()=>{
 const {s,c}=setup();enter(c,11);assert.ok(c.open('context'));const counts=[c.snapshot().context.units];
 for(let i=0;i<5;i++){assert.ok(c.contextAction('add'));const copy=c.snapshot().copy;seconds(c,60);assert.equal(c.snapshot().copy,copy);counts.push(c.snapshot().context.units);}
 assert.deepEqual(counts,[25,35,45,55,65,70]);assert.equal(c.contextAction('add'),false);const raw=c.snapshot().context.archiveIds;
 c.contextAction('compress');const copy=c.snapshot().copy;seconds(c,60);assert.equal(c.snapshot().copy,copy);assert.equal(c.snapshot().context.units,35);assert.deepEqual(c.snapshot().context.archiveIds,raw);assert.match(c.snapshot().context.summary.text,/申请审核/);assert.equal(s.learning.deep.context,true);
 c.contextAction('compare');assert.ok(c.snapshot().branch.loss);assert.ok(!c.snapshot().context.summary.text.includes('审核'));c.contextAction('back');assert.equal(c.snapshot().context.units,70);
});
test('reuse records actual consent, native memory at session start, skills later and explicit new audience',()=>{
 const {s,c}=setup(true);enter(c,11);c.open('reuse');assert.equal(s.task.sessions.length,1);c.next({preference:true,skill:true});assert.equal(s.task.sessions.length,2);
 const a=s.task.sessions[1];assert.equal(a.readings.memoryIds.length,1);assert.equal(a.readings.skillIds.length,0);assert.equal(a.readings.historyIds.length,0);assert.ok(!c.snapshot().visibleNodeIds.includes('archive'));
 c.next();assert.equal(c.snapshot().branch.index,2);c.next();assert.equal(a.readings.skillIds.length,1);c.next();assert.equal(a.readings.historyIds.length,1);c.next();assert.equal(a.audience,'technical');
 while(c.snapshot().branch.index<9)c.next();assert.equal(s.learning.deep.reuse,true);assert.deepEqual(a.draft[0].sources,['A3']);const facts=structuredClone(s.task);c.close();c.open('reuse');while(c.snapshot().branch.index<9)c.next();assert.deepEqual(s.task,facts);
});
test('declined long-term saves yield 0/0/1; disabling reuse yields 0/0/0 even when stored',()=>{
 for(const [save,enabled,expected]of [[false,true,[0,0,1]],[true,false,[0,0,0]]]){
  const {s,c}=setup(true);enter(c,11);c.open('reuse');c.next({preference:save,skill:save,enabled});while(c.snapshot().branch.index<9)c.next();
  const r=s.task.sessions[1].readings;assert.deepEqual([r.memoryIds.length,r.skillIds.length,r.historyIds.length],expected);
 }
});
test('new scenario is isolated from old storage contracts; report does not grant unvisited completion',()=>{
 const {s,c}=setup(true);enter(c,11);assert.ok(restoreNewsVisit(s));assert.equal(compatibleVisit(s),null);assert.ok(compatibleVisit(createVisit({},undefined,'old-preserved')));
 const report=newsReportHTML(s);assert.match(report,/上下文整理：未完成/);assert.match(report,/下次复用：未完成/);assert.equal(canReceiveMemento(s),false);
 const broken=structuredClone(s);broken.tour.lesson.index=99;assert.equal(restoreNewsVisit(broken),null);
 assert.ok(s.learning.viewRecords.every(r=>r.method==='static'));
});
test('corrupt completion flags cannot inherit a new certificate or valid resume',()=>{
 const {s}=setup();s.learning.mainComplete=true;assert.equal(restoreNewsVisit(s),null);
 const {s:deep,c}=setup(true);enter(c,11);deep.learning.deep.context=true;assert.equal(restoreNewsVisit(deep),null);
});
test('method revisions are read on demand and past read evidence does not change with stored text',()=>{
 const {s,c}=setup(true);enter(c,11);c.open('reuse');c.next({skill:true});c.next();
 c.reviseMethod(['先查原始来源','核对版本，禁止凭旧公告写新变化']);c.next();assert.deepEqual(c.snapshot().lines,['先查原始来源','核对版本，禁止凭旧公告写新变化']);
 c.reviseMethod(['后来的新方法']);const read=s.task.events.find(e=>e.type==='skill-read');assert.equal(read.result.entry.steps[0],'先查原始来源');assert.equal(c.snapshot().lines[0],'先查原始来源');
});
