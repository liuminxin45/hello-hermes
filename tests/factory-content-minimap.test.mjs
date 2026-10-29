import test from 'node:test';
import assert from 'node:assert/strict';
import {GUIDE_CHAPTERS,GUIDE_EVENT_COPY,GUIDE_EVENT_PREPARATION,guidePresentation,reusePresentation} from '../docs/public/factory/content.mjs';
import {createVisit,requestSources,retrieveSources,verifySources,deliverDraft,saveExperience,startNewSession,loadReuse,currentSession} from '../docs/public/factory/engine.mjs';
import {NODES,FLOWS} from '../docs/public/factory/scene-state.mjs';
import {mapSnapshot,createMinimap} from '../docs/public/factory/minimap.mjs';

function secondSession(options={},enabled=true){
 const visit=createVisit({},undefined,'guide-read-test');
 requestSources(visit);retrieveSources(visit);verifySources(visit);deliverDraft(visit);
 saveExperience(visit,options);startNewSession(visit);loadReuse(visit,{enabled});
 return visit;
}

test('short guide copy reveals no result or read counts before the observed result beat',()=>{
 const hidden={memoryIds:['pending-preference'],skillIds:['pending-skill'],historyIds:['pending-history']};
 for(const eventType of Object.keys(GUIDE_EVENT_COPY)){
  const copy=guidePresentation({eventType,resultReady:false});
  assert.equal(copy.result,null,eventType);
  assert.equal(copy.cue,GUIDE_EVENT_PREPARATION[eventType],eventType);
  assert.ok([...copy.cue].length<=80,eventType);
 }
 for(const chapter of Object.values(GUIDE_CHAPTERS))for(const cue of [chapter.cue,chapter.afterCue])assert.ok([...cue].length<=80);
 for(const readStarted of [false,true]){
  const view=guidePresentation({chapterId:'reuse',eventType:'requirements-applied',readings:hidden,readStarted,resultReady:false});
  assert.equal(view.result,null);assert.equal(view.counts,null);
  assert.doesNotMatch(JSON.stringify(view),/pending-(preference|skill|history)/);
 }
 const notStarted=guidePresentation({chapterId:'reuse',eventType:'requirements-applied',readings:hidden,resultReady:true});
 assert.equal(notStarted.result,null);assert.equal(notStarted.counts,null);
});

test('reuse guide branches reflect actual engine reads, including 0 preference / 0 skill / 1 history',()=>{
 const cases=[
  [{},true,'history-only',{memory:0,skill:0,history:1}],
  [{preference:true},true,'preference-history',{memory:1,skill:0,history:1}],
  [{skill:true},true,'skill-history',{memory:0,skill:1,history:1}],
  [{preference:true,skill:true},true,'all-three',{memory:1,skill:1,history:1}],
  [{preference:true,skill:true},false,'disabled',{memory:0,skill:0,history:0}]
 ];
 for(const [options,enabled,branch,counts] of cases){
  const visit=secondSession(options,enabled),before=structuredClone(visit);
  const view=reusePresentation(currentSession(visit).readings,{enabled,started:true,settled:true});
  assert.equal(view.branch,branch);assert.deepEqual(view.counts,counts);assert.ok([...view.cue].length<=80);
  if(branch==='history-only')assert.doesNotMatch(view.cue,/已读入偏好|方法已读|你的习惯/);
  if(branch==='disabled')assert.match(view.cue,/仍然能工作/);
  assert.deepEqual(visit,before,'presentation must not change the task or learning record');
 }
});

test('the second verification guide describes the new announcement instead of merging the first clues again',()=>{
 const before=guidePresentation({chapterId:'reuse',sessionNumber:2,eventType:'source-verified'});
 const after=guidePresentation({chapterId:'reuse',sessionNumber:2,eventType:'source-verified',resultReady:true});
 assert.equal(before.result,null);assert.match(before.cue,/最新|这次读回/);
 assert.match(after.cue,/A3/);assert.match(after.cue,/审核/);
 assert.doesNotMatch(after.cue,/两份转述|合并/);assert.match(after.result.title,/A3/);
});

class FakeHost{
 constructor(){this.dataset={};this.mode={textContent:''};this.nodes=[];this.edges=[];}
 set innerHTML(value){
  this.markup=value;
  this.nodes=[...value.matchAll(/data-node="([^"]+)"/g)].map(match=>({dataset:{node:match[1]},attributes:{},setAttribute(name,value){this.attributes[name]=value;}}));
  this.edges=[...value.matchAll(/data-flow="([^"]+)"/g)].map(match=>({dataset:{flow:match[1]},active:false,classList:{toggle:(name,value)=>{this.edges.find(edge=>edge.dataset.flow===match[1]).active=value;}}}));
 }
 querySelectorAll(selector){return selector==='[data-node]'?this.nodes:selector==='[data-flow]'?this.edges:[];}
 querySelector(selector){return selector==='#map-mode'?this.mode:null;}
}

test('minimap snapshots expose only valid non-trajectory flows and do not mutate the source snapshot',()=>{
 const source={focusNodeId:'tools',activeFlowIds:['invalid','trace-tools','tool-call','tool-result','history-query','memory-read'],activeNodeIds:['tools'],waiting:['loop'],completed:{archive:true},presentation:{paused:true,mode:'teaching-replay'}};
 const before=structuredClone(source),snapshot=mapSnapshot(source);
 assert.deepEqual(snapshot.active,['tool-call','tool-result','history-query']);
 assert.equal(snapshot.paused,true);assert.equal(snapshot.mode,'教学回放');
 assert.deepEqual(snapshot.completed,['archive']);assert.deepEqual(source,before);
});

test('the SVG map derives every structural edge and its direction from FLOWS',()=>{
 const host=new FakeHost();createMinimap(host,()=>{});
 assert.deepEqual(host.nodes.map(node=>node.dataset.node),NODES);
 assert.deepEqual(host.edges.map(edge=>edge.dataset.flow),FLOWS.filter(flow=>flow.type!=='trace').map(flow=>flow.id));
 const positions=Object.fromEntries([...host.markup.matchAll(/data-node="([^"]+)" transform="translate\(([-\d.]+) ([-\d.]+)\)"/g)].map(match=>[match[1],[Number(match[2]),Number(match[3])]]));
 for(const match of host.markup.matchAll(/class="map-edge" data-flow="([^"]+)" data-type="[^"]+" d="([^"]+)"/g)){
  const flow=FLOWS.find(flow=>flow.id===match[1]),numbers=match[2].match(/-?\d+(?:\.\d+)?/g).map(Number);
  assert.deepEqual(numbers.slice(0,2),positions[flow.from],flow.id+' starts at source');
  assert.deepEqual(numbers.slice(-2),positions[flow.to],flow.id+' ends at target');
 }
 assert.match(host.markup,/marker-end="url\(#map-arrow\)"/);
});

test('map click and keyboard dispatch observation IDs without changing task facts or learning progress',()=>{
 const visit=secondSession({}),before=structuredClone(visit),selected=[],host=new FakeHost(),map=createMinimap(host,id=>selected.push(id));
 map.update({focusNodeId:'archive',activeFlowIds:['history-result'],frame:{activeNodeIds:['archive']},presentation:{paused:false,mode:'event-presentation'}});
 const node=host.nodes.find(node=>node.dataset.node==='memory');node.onclick();
 let prevented=0;node.onkeydown({key:'Enter',preventDefault(){prevented++;}});node.onkeydown({key:' ',preventDefault(){prevented++;}});node.onkeydown({key:'Escape',preventDefault(){throw Error('unrelated key');}});
 assert.deepEqual(selected,['memory','memory','memory']);assert.equal(prevented,2);
 assert.deepEqual(visit,before);assert.equal(host.edges.find(edge=>edge.dataset.flow==='history-result').active,true);
 assert.equal(host.nodes.find(node=>node.dataset.node==='archive').attributes['aria-pressed'],'true');
});
