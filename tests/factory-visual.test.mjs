import test from 'node:test';
import assert from 'node:assert/strict';
import {createDirector,NODES,FLOWS,attention,relatedFor,operationForEvent,SETTLE_SECONDS} from '../docs/public/factory/scene-state.mjs';
import {createVisit,requestSources,retrieveSources,verifySources,currentSession} from '../docs/public/factory/engine.mjs';

const toolEvent=(id='event-tool')=>({id,type:'tool-result',title:'公告A1返回',detail:'原文可用于核查',nodeId:'tools',operation:'tool',input:{sourceIds:['S1']},result:{sourceIds:['A1']},evidenceIds:['A1'],objectiveIds:['O1']});

test('focusing an idle device changes contrast but never starts a task or transfer',()=>{
  const d=createDirector();d.focus(1);d.advance(SETTLE_SECONDS);const s=d.snapshot();
  assert.equal(s.focusNodeId,'loop');assert.equal(s.nodeStates.loop,'Idle');assert.deepEqual(s.activeFlowIds,[]);
  assert.equal(attention(s,'loop'),1);assert.ok(s.relatedNodeIds.length<=2);
  for(const n of NODES.filter(n=>n!=='loop'))assert.equal(attention(s,n),s.relatedNodeIds.includes(n)?.82:.48);
});

test('a working background device retains its real state independently of the current focus',()=>{
  const d=createDirector();d.focus(0);d.advance(SETTLE_SECONDS);d.run('compress');d.advance(.2);const s=d.snapshot();
  assert.equal(s.focusNodeId,'intake');assert.equal(s.nodeStates.context,'Running');assert.equal(s.nodeStates.intake,'Idle');
  assert.equal(attention(s,'context'),.48);assert.ok(s.activeFlowIds.includes('persist'));
});

test('attention selects at most two directly related supporting devices for the active event',()=>{
  const d=createDirector();d.focus(1);d.advance(SETTLE_SECONDS);d.run('tool');d.advance(.2);const s=d.snapshot();
  assert.ok(s.relatedNodeIds.includes('tools'));assert.ok(s.relatedNodeIds.length<=2);
  for(const id of s.relatedNodeIds)assert.ok(FLOWS.some(f=>f.from===s.focusNodeId&&f.to===id||f.to===s.focusNodeId&&f.from===id));
  assert.deepEqual(relatedFor(s),s.relatedNodeIds);
});

test('request, execution and result use distinct directional phases',()=>{
  const d=createDirector();d.run('tool');d.advance(.3);assert.deepEqual(d.snapshot().activeFlowIds,['tool-call']);
  d.advance(.6);assert.equal(d.snapshot().nodeStates.tools,'Running');assert.deepEqual(d.snapshot().activeFlowIds,[]);
  d.advance(1.4);assert.deepEqual(d.snapshot().activeFlowIds,['tool-result']);
  const call=FLOWS.find(x=>x.id==='tool-call'),result=FLOWS.find(x=>x.id==='tool-result');assert.equal(call.from,result.to);assert.equal(call.to,result.from);
  d.advance(.8);assert.equal(d.finished().length,1);assert.equal(d.snapshot().nodeStates.tools,'Completed');d.advance(2);assert.equal(d.snapshot().nodeStates.tools,'Idle');
});

test('observing a recorded source event preserves stable card identity without changing task state',()=>{
  const task=createVisit();requestSources(task);const event=retrieveSources(task)[0],before=structuredClone(task.task),d=createDirector();
  const id=d.observeEvent(event);assert.ok(id);d.advance(.2);let s=d.snapshot();
  assert.equal(s.operation.kind,'toolResult');assert.equal(s.operation.eventId,event.id);assert.ok(s.operation.cardIds.includes('A1'));assert.deepEqual(task.task,before);
  assert.equal(d.observeEvent(event),null);assert.equal(d.snapshot().queueLength,0);
  d.observeEvent(event,{replay:true});d.advance(.2);s=d.snapshot();assert.equal(s.operation.replay,true);assert.deepEqual(task.task,before);
});

test('navigation settling can advance while an explicit paused simulation remains frozen',()=>{
  const d=createDirector();d.focus(6);d.run('compress');d.advance(SETTLE_SECONDS,false);assert.equal(d.snapshot().operation,null);
  d.advance(.4);const before=d.snapshot();d.advance(1,false);const after=d.snapshot();
  assert.equal(after.operation.elapsed,before.operation.elapsed);assert.deepEqual(after.activeFlowIds,before.activeFlowIds);
});

test('overview restores normal contrast; manual camera and question inspection are observational',()=>{
  const task=createVisit();requestSources(task);retrieveSources(task);verifySources(task);const before=structuredClone(task.task),d=createDirector();
  d.focus(6);d.inspect('head');assert.equal(d.snapshot().cameraMode,'inspect');assert.equal(d.snapshot().part,'head');
  d.inspect('sqlite','archive');assert.equal(d.snapshot().focusNodeId,'archive');d.manual();assert.equal(d.snapshot().cameraMode,'manual');d.advance(4);assert.equal(d.snapshot().cameraMode,'manual');
  d.overview();for(const n of NODES)assert.equal(attention(d.snapshot(),n),1);assert.equal(d.snapshot().focusNodeId,null);assert.equal(d.snapshot().showFullPath,false);assert.deepEqual(task.task,before);
});

test('new observations may change attention but cannot reclaim a manually controlled camera',()=>{
  const d=createDirector();d.focus(1);d.advance(SETTLE_SECONDS);d.manual();
  assert.equal(d.focus(3),false);assert.equal(d.snapshot().focusNodeId,'tools');
  assert.equal(d.snapshot().manual,true);assert.equal(d.snapshot().cameraMode,'manual');assert.equal(d.snapshot().tourTime,SETTLE_SECONDS);
  d.observeEvent(toolEvent('after-manual'));d.advance(.2);d.skipMotion();
  assert.equal(d.snapshot().manual,true);assert.equal(d.snapshot().cameraMode,'manual');assert.equal(d.snapshot().nodeStates.tools,'Completed');
  assert.equal(d.focus(6),false);assert.equal(d.snapshot().focusNodeId,'context');assert.equal(d.snapshot().cameraMode,'manual');
  assert.equal(d.focus(6,{resume:true}),true);assert.equal(d.snapshot().manual,false);assert.equal(d.snapshot().cameraMode,'guide');assert.equal(d.snapshot().tourTime,0);
});

test('question inspection restores the original manual mode and keeps new operation outcomes',()=>{
  const d=createDirector();d.focus(6);d.advance(SETTLE_SECONDS);d.fullPath(true);d.manual();const saved=d.viewState();
  d.inspect('sqlite','archive');assert.equal(d.snapshot().manual,false);assert.equal(d.snapshot().cameraMode,'inspect');
  d.observeEvent({id:'failed-in-inspection',type:'tool-failed',result:{ok:false,usable:false}});d.skipMotion();
  d.restoreView(saved);assert.deepEqual(d.viewState(),saved);assert.equal(d.snapshot().nodeStates.tools,'Error');
  assert.equal(d.focus(4),false);assert.equal(d.snapshot().manual,true);assert.equal(d.snapshot().cameraMode,'manual');
});

test('structural relationships never imply a transfer or a training operation',()=>{
  assert.equal(new Set(FLOWS.map(f=>f.id)).size,FLOWS.length);
  for(const f of FLOWS)assert.ok(NODES.includes(f.from)&&NODES.includes(f.to));
  assert.ok(FLOWS.filter(f=>f.to==='review').every(f=>f.type==='trace'));
  const d=createDirector();d.focus(8);d.advance(SETTLE_SECONDS);assert.deepEqual(d.snapshot().activeFlowIds,[]);assert.equal(d.snapshot().nodeStates.review,'Idle');
  assert.ok(!FLOWS.some(f=>/train|reinforcement|weight/i.test(f.id)));
});

test('a failed read returns an error flow rather than a successful source card',()=>{
  const d=createDirector();const id=d.observeEvent({id:'failed',type:'tool-failed',title:'读取失败',input:{request:'A1'},result:{ok:false,usable:false},evidenceIds:[]});
  assert.ok(id);d.advance(.2);assert.deepEqual(d.snapshot().activeFlowIds,['tool-error']);assert.equal(d.snapshot().operation.failed,true);
  assert.ok(!d.snapshot().operation.cardIds.includes('A1'));d.advance(2);assert.equal(d.snapshot().nodeStates.tools,'Error');assert.equal(d.snapshot().nodeStates.loop,'Idle');
  d.observeEvent(toolEvent('retry'));d.advance(.2);assert.equal(d.snapshot().nodeStates.tools,'Running');assert.equal(d.snapshot().errors.tools,undefined);
});

test('skipping a failed observation preserves an equivalent error outcome without executing a task',()=>{
  const d=createDirector();d.observeEvent({id:'failed-skip',type:'tool-failed',input:{},result:{ok:false,usable:false},evidenceIds:[]});
  d.advance(.2);d.skipMotion();const s=d.snapshot();
  assert.equal(s.operation,null);assert.deepEqual(s.activeFlowIds,[]);assert.equal(s.nodeStates.tools,'Error');assert.notEqual(s.nodeStates.tools,'Completed');
});

test('skipping animation finishes observation only and cannot retrieve evidence or deliver a draft',()=>{
  const s=createVisit(),event=requestSources(s)[0],task=structuredClone(s.task),d=createDirector();d.observeEvent(event);d.advance(.2);d.skipMotion();
  assert.equal(d.snapshot().operation,null);assert.equal(d.snapshot().queueLength,0);assert.deepEqual(s.task,task);assert.equal(currentSession(s).toolSucceeded,false);assert.equal(currentSession(s).delivered,false);
});

test('a captured visual snapshot stays immutable when the live scene and caller input change',()=>{
  const d=createDirector(),event=toolEvent();d.observeEvent(event);d.advance(.2);const picture=d.snapshot();
  event.title='mutated caller title';event.evidenceIds.push('S3');d.advance(2);d.error('tools');
  assert.equal(picture.operation.kind,'toolResult');assert.deepEqual(picture.operation.cardIds,['A1']);assert.equal(picture.observation.title,'公告A1返回');assert.equal(picture.errors.tools,undefined);assert.equal(picture.nodeStates.tools,'Running');
});

test('unsupported timing cannot accidentally advance a recorded operation',()=>{
  const d=createDirector();d.run('compress');d.advance(.2);const before=d.snapshot();for(const t of [-1,0,NaN,Infinity])d.advance(t);assert.deepEqual(d.snapshot(),before);
});

test('event aliases preserve tool errors and source-result semantics',()=>{
  assert.equal(operationForEvent({type:'tool-failed',operation:'tool'}),'toolError');assert.equal(operationForEvent({type:'tool-result',operation:'tool'}),'toolResult');
  assert.equal(operationForEvent({type:'skill-read',operation:'memory'}),'skill');assert.equal(operationForEvent({type:'not-a-demonstrated-operation'}),null);
});

test('a successful read of the wrong version returns a warning outcome rather than the usable-source flow',()=>{assert.equal(operationForEvent({type:'tool-wrong-version',result:{ok:true,usable:false}}),'toolError');});
