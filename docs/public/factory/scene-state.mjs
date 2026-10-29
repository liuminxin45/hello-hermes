import {OPERATION_PHASES,STORYBOARDS,sampleStoryboard} from './storyboard.mjs';
export {OPERATION_PHASES} from './storyboard.mjs';
// Structural edges describe possible cooperation. Observing one never executes a task.
export const NODES=['intake','loop','analysis','tools','archive','memory','context','delivery','review'];
export const SETTLE_SECONDS=1.2;
export const FLOWS=[
 ['intake-loop','intake','loop','task','委托'],['intake-persist','intake','archive','persist','原文留档'],['loop-analysis','loop','analysis','task','判断请求'],['analysis-loop','analysis','loop','task','后续安排'],
 ['tool-call','loop','tools','tool','读取请求'],['tool-result','tools','loop','tool','来源回执'],['tool-error','tools','loop','error','读取错误'],
 ['history-write','loop','archive','persist','保存会话'],['history-query','loop','archive','history','查旧记录'],['history-result','archive','loop','history','命中记录'],
 ['memory-read','memory','loop','memory','读取用户资料'],['skill-read','memory','loop','memory','读取方法'],['memory-write','loop','memory','memory','保存资料'],
 ['context-feed','loop','context','task','本轮输入'],['context-input','context','analysis','task','精简输入'],['persist','context','archive','persist','笔记留档'],['deliver','loop','delivery','task','草稿'],
 ...['intake','loop','analysis','tools','archive','memory','context','delivery'].map(n=>['trace-'+n,n,'review','trace','轨迹'])
].map(([id,from,to,type,label])=>({id,from,to,type,label}));
const aliases={request:'toolRequest','request-created':'toolRequest','history-written':'historyWrite','tool-request':'toolRequest','tool-requested':'toolRequest','tool-result':'toolResult','tool-succeeded':'toolResult','tool-read':'toolResult','tool-error':'toolError','tool-failed':'toolError','tool-wrong-version':'toolError','evidence-read':'toolResult','source-read':'toolResult','sources-read':'toolResult','context-compressed':'compress','context-compression':'compress','context-replay':'compress',compression:'compress','history-read':'history','history-search':'history','history-loaded':'history','memory-read':'memory','memory-loaded':'memory','skill-read':'skill','skill-loaded':'skill','skill-saved':'memoryWrite','skill-written':'memoryWrite','skill-revised':'memoryWrite','preference-written':'memoryWrite','memory-write':'memoryWrite','memory-saved':'memoryWrite','experience-saved':'memoryWrite','experience-decision':'decision','requirements-applied':'planning','task-received':'input','task-started':'input','task-created':'input',received:'input','plan-created':'planning','evidence-compared':'analysis','source-verified':'analysis','findings-created':'analysis','draft-created':'delivery','draft-delivered':'delivery','session-started':'newSession','session-created':'newSession'};
export function operationForEvent(event={}){const kind=String(event.type||event.kind||'').replace(/[._]/g,'-');if(aliases[kind])return aliases[kind];const explicit=event.operation;if(OPERATION_PHASES[explicit])return explicit;if(aliases[explicit])return aliases[explicit];return OPERATION_PHASES[kind]?kind:null;}
export const PAUSE_REASONS=['user','question','report','exam','hidden','contextLost','legacy'];
export function relatedFor(snapshot){
 const focus=snapshot.focusNodeId;if(!focus)return [];
 const adjacent=FLOWS.filter(f=>f.from===focus||f.to===focus);
 const activeEdges=adjacent.filter(f=>snapshot.activeFlowIds?.includes(f.id));
 const candidates=[...activeEdges.flatMap(f=>[f.from,f.to]),...(snapshot.activeNodeIds||[]).filter(n=>adjacent.some(f=>f.from===n||f.to===n)),...adjacent.filter(f=>f.type!=='trace').flatMap(f=>[f.from,f.to])];
 return [...new Set(candidates.filter(n=>n!==focus))].slice(0,2);
}
export function createDirector(){
 const state={focusNodeId:null,relatedNodeIds:[],activeNodeIds:[],activeFlowIds:[],cameraMode:'overview',tourStep:-1,simulationState:'idle',tourTime:SETTLE_SECONDS,showFullPath:false,manual:false,part:null,operation:null,heldOperation:null,observation:null,completed:{},errors:{},waiting:[],speed:1,repeat:false,cycle:0,pauseReasons:[]};
 const queue=[],finished=[],seenEvents=new Set(),pauseReasons=new Set();let serial=0;
 const duration=op=>STORYBOARDS[op?.kind]?.duration||0;
 const sample=op=>op?sampleStoryboard(op.kind,op.elapsed,{event:op.event,title:op.title,cardLabel:op.cardLabel,loss:op.loss}):null;
 function derive(){
  const op=state.operation,source=op||queue[0]||state.heldOperation,frame=sample(source),paused=pauseReasons.size>0;
  state.activeNodeIds=op?(frame?.activeNodeIds||[]):[];state.activeFlowIds=op?(frame?.activeFlowIds||[]):[];
  state.simulationState=op?'running':state.waiting.length?'waiting':state.heldOperation?'completed':'idle';state.operationText=frame?.cue||'';state.relatedNodeIds=relatedFor(state);
  const holding=!op&&!queue.length&&!!state.heldOperation,replaying=!!source?.replay||!!source?.loopCycle;
  state.frame=frame;state.presentation={clipId:frame?.clipId||null,sourceEventIds:source?.eventId?[source.eventId]:[],mode:replaying?'teaching-replay':'event-presentation',status:paused?'paused':op?'playing':holding?'holding':queue.length?'preparing':'idle',phaseId:frame?.phaseId||null,cue:frame?.cue||'',elapsed:source?.elapsed||0,duration:duration(source),cycle:source?.loopCycle||0,speed:state.speed,repeat:state.repeat,paused,pauseReasons:[...pauseReasons],replaying,resultStatus:source?'recorded':'none',resultAcknowledged:!!source?.acknowledged,frame};
 }
 function focus(index,{resume=false,settle=true}={}){if(!NODES[index])return false;const keepManual=state.manual&&!resume;state.focusNodeId=NODES[index];state.tourStep=index;state.part=null;state.showFullPath=false;if(keepManual){state.cameraMode='manual';state.tourTime=SETTLE_SECONDS;}else{state.cameraMode='guide';state.tourTime=settle?0:SETTLE_SECONDS;state.manual=false;}derive();return !keepManual;}
 function viewState(){return {focusNodeId:state.focusNodeId,cameraMode:state.cameraMode,manual:state.manual,part:state.part,tourStep:state.tourStep,showFullPath:state.showFullPath};}
 function restoreView(view){state.focusNodeId=NODES.includes(view?.focusNodeId)?view.focusNodeId:null;state.cameraMode=view?.manual?'manual':view?.cameraMode||'overview';state.manual=!!view?.manual;state.part=view?.part??null;state.tourStep=Number.isInteger(view?.tourStep)?view.tourStep:-1;state.showFullPath=!!view?.showFullPath;state.tourTime=SETTLE_SECONDS;derive();}
 function run(kind,metadata={}){if(!OPERATION_PHASES[kind])throw Error('Unknown operation');const id=++serial;queue.push({kind,id,elapsed:0,notify:true,loopCycle:0,...structuredClone(metadata)});derive();return id;}
 function complete(op,{skipped=false}={}){
  const nodes=[...new Set(OPERATION_PHASES[op.kind]?.flatMap(p=>p.nodes)||[])];
  if(op.failed){state.errors.tools=true;delete state.completed.tools;state.waiting=state.waiting.filter(x=>x!=='tools');}
  else if(op.kind==='toolRequest'){state.completed.loop=true;if(!state.waiting.includes('tools'))state.waiting.push('tools');}
  else {for(const node of nodes)state.completed[node]=true;if(['tool','toolResult'].includes(op.kind)){delete state.errors.tools;state.waiting=state.waiting.filter(x=>x!=='tools');}}
  state.heldOperation={...op,elapsed:duration(op),skipped,acknowledged:false};
  if(op.notify!==false)finished.push(op.id);
  state.operation=null;
 }
 function makeReplay(op,{loop=false}={}){if(!op||!STORYBOARDS[op.kind])return null;return {...structuredClone(op),id:++serial,elapsed:0,replay:true,notify:false,loopCycle:loop?(op.loopCycle||0)+1:0,skipped:false,acknowledged:false};}
 function observeEvent(event,{replay=false,animate=true,repeat=false}={}){
  const id=event?.id||event?.eventId||event?.seq;if(id==null)return null;if(!replay&&seenEvents.has(String(id)))return null;seenEvents.add(String(id));
  if(replay||state.operation?.loopCycle){queue.length=0;state.operation=null;}state.repeat=!!repeat;state.cycle=0;state.observation=structuredClone(event);
  const kind=operationForEvent(event);if(kind&&kind.startsWith('tool')&&kind!=='toolError')delete state.errors.tools;
  const requested=event.result?.requestedIds||event.input?.requestedIds;
  const identity=requested?.length?requested:event.evidenceIds?.length?event.evidenceIds:event.result?.entry?[event.result.entry.id]:event.input?.entryId?[event.input.entryId]:event.result?.historyId?[event.result.historyId]:event.input?.sourceIds||[];
  const cardIds=[...new Set(identity.filter(Boolean).map(String))],cardLabel=kind==='memoryWrite'?(String(event.type||event.kind).includes('skill')?'核查方法条目':'受众偏好条目'):kind==='memory'?'已保存的受众偏好':kind==='skill'?'来源核验手册':kind==='history'?'上次会话记录':kind==='historyWrite'?'会话存档':kind==='newSession'?'新的委托':kind==='toolError'?'错误回执':null;
  if(!kind){queue.length=0;state.operation=null;state.heldOperation={kind:null,id:++serial,eventId:String(id),elapsed:0,replay,title:event.title||event.detail||'',cardIds,event:structuredClone(event),notify:false};derive();return null;}
  const operationId=run(kind,{eventId:String(id),replay,cardIds,cardLabel,title:event.title||event.detail||'',failed:kind==='toolError',loss:!!event.loss,event:structuredClone(event)});
  if(!animate){const op=queue.pop();complete(op,{skipped:true});derive();return null;}return operationId;
 }
 function advance(dt,runOperations=true){
  if(!Number.isFinite(dt)||dt<=0)return;const step=Math.min(dt,.1);state.tourTime=Math.min(SETTLE_SECONDS,state.tourTime+step);
  if(!runOperations||pauseReasons.size||state.tourTime<SETTLE_SECONDS){derive();return;}
  if(!state.operation&&queue.length)state.operation=queue.shift();
  if(state.operation){const op=state.operation;op.elapsed=Math.min(duration(op),op.elapsed+step*state.speed);if(op.elapsed>=duration(op)){complete(op);if(state.repeat&&!queue.length){state.operation=makeReplay(state.heldOperation,{loop:true});state.cycle=state.operation.loopCycle;}}}
  derive();
 }
 function skipMotion(){state.repeat=false;const pending=[...(state.operation?[state.operation]:[]),...queue.splice(0)];for(const op of pending)complete(op,{skipped:true});state.operation=null;state.tourTime=SETTLE_SECONDS;derive();}
 function setPauseReason(reason,enabled){if(!PAUSE_REASONS.includes(reason))throw Error('Unknown pause reason');if(enabled)pauseReasons.add(reason);else pauseReasons.delete(reason);state.pauseReasons=[...pauseReasons];derive();}
 function setSpeed(speed){if(!Number.isFinite(speed)||speed<=0||speed>4)throw Error('Playback speed must be between 0 and 4');state.speed=speed;derive();}
 function setRepeat(enabled){state.repeat=!!enabled;if(state.repeat&&!state.operation&&!queue.length&&state.heldOperation){state.operation=makeReplay(state.heldOperation,{loop:true});state.cycle=state.operation?.loopCycle||0;}derive();}
 function replay({repeat=false}={}){const source=state.operation||queue[0]||state.heldOperation;if(!source)return null;queue.length=0;state.repeat=!!repeat;state.operation=makeReplay(source,{loop:repeat});state.tourTime=SETTLE_SECONDS;state.cycle=state.operation?.loopCycle||0;derive();return state.operation?.id||null;}
 function ensureActive(){if(!state.operation&&queue.length)state.operation=queue.shift();if(!state.operation&&state.heldOperation)state.operation=makeReplay(state.heldOperation);state.tourTime=SETTLE_SECONDS;return state.operation;}
 function seek(time){if(!Number.isFinite(time))return null;const op=ensureActive();if(!op)return null;op.elapsed=Math.min(duration(op),Math.max(0,time));if(op.elapsed>=duration(op))complete(op,{skipped:false});derive();return state.frame;}
 function nextBeat(){const op=ensureActive();if(!op)return null;const phase=OPERATION_PHASES[op.kind].find(p=>p.start>op.elapsed+.001);return seek(phase?.start??duration(op));}
 function stopPresentation({clearResult=false}={}){queue.length=0;state.operation=null;state.repeat=false;if(clearResult)state.heldOperation=null;derive();}
 function snapshot(){derive();const replayingCycle=!!state.operation?.loopCycle,op=state.operation,resultStates={};
  if(op&&['result','hold'].includes(state.frame?.phaseId)){if(op.failed)resultStates.tools='Error';else if(op.kind==='toolRequest'){resultStates.loop='Completed';resultStates.tools='Waiting';}else for(const phase of OPERATION_PHASES[op.kind]||[])for(const node of phase.nodes)resultStates[node]='Completed';}
  const nodeStates=Object.fromEntries(NODES.map(n=>[n,resultStates[n]||(state.errors[n]?'Error':!replayingCycle&&state.activeNodeIds.includes(n)?'Running':state.waiting.includes(n)?'Waiting':state.completed[n]?'Completed':'Idle')]));
  return {...state,completed:{...state.completed},errors:{...state.errors},waiting:[...state.waiting],pauseReasons:[...pauseReasons],relatedNodeIds:[...state.relatedNodeIds],activeNodeIds:[...state.activeNodeIds],activeFlowIds:[...state.activeFlowIds],nodeStates,presentationNodeStates:Object.fromEntries(NODES.map(n=>[n,state.activeNodeIds.includes(n)?'Running':nodeStates[n]])),operation:state.operation?structuredClone(state.operation):null,heldOperation:state.heldOperation?structuredClone(state.heldOperation):null,observation:state.observation?structuredClone(state.observation):null,frame:state.frame?structuredClone(state.frame):null,presentation:structuredClone(state.presentation),queueLength:queue.length};
 }
 return {state,focus,viewState,restoreView,run,observeEvent,advance,skipMotion,snapshot,setPauseReason,setSpeed,setRepeat,replay,seek,nextBeat,stopPresentation,setStageReady(){state.tourTime=SETTLE_SECONDS;derive();},error:n=>{state.errors[n]=true;derive();},clearError:n=>{delete state.errors[n];derive();},finished:()=>finished.splice(0),waiting:n=>{state.waiting=[...n];derive();},manual:()=>{state.manual=true;state.cameraMode='manual';derive();},overview(){state.focusNodeId=null;state.relatedNodeIds=[];state.cameraMode='overview';state.manual=false;state.part=null;state.showFullPath=false;state.tourTime=SETTLE_SECONDS;derive();},inspect(part,node=state.focusNodeId){if(!NODES.includes(node))return;state.focusNodeId=node;state.cameraMode='inspect';state.manual=false;state.part=part;derive();},trace(){state.cameraMode='trace';state.manual=false;state.showFullPath=true;derive();},fullPath(v){state.showFullPath=v;derive();},reset(){queue.length=0;finished.length=0;seenEvents.clear();pauseReasons.clear();state.operation=null;state.heldOperation=null;state.observation=null;state.completed={};state.errors={};state.waiting=[];state.repeat=false;state.cycle=0;state.pauseReasons=[];derive();}};
}
// Attention is an opacity multiplier; original glass opacity remains a separate base value.
export function attention(snapshot,id){if(!snapshot.focusNodeId||id===snapshot.focusNodeId)return 1;return snapshot.relatedNodeIds.includes(id)?.60:.18;}
