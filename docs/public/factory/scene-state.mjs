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
export const OPERATION_PHASES={
 tool:[{end:.8,nodes:['loop'],flows:['tool-call'],text:'回放：读取请求交给工具。'},{end:2.2,nodes:['tools'],flows:[],text:'回放：工具读取原始来源。'},{end:3,nodes:['tools','loop'],flows:['tool-result'],text:'回放：来源回执返回，改变后续判断。'}],
 toolRequest:[{end:1.2,nodes:['loop'],flows:['tool-call'],text:'已有请求卡进入执行区。'}],
 toolResult:[{end:1.6,nodes:['tools','loop'],flows:['tool-result'],text:'已有来源回执返回；观察它带来了什么变化。'}],
 toolError:[{end:1.6,nodes:['tools','loop'],flows:['tool-error'],text:'错误回执返回，没有产生成功交付。'}],
 compress:[{end:.9,nodes:['context'],flows:['persist'],text:'回放：保护起始要求与近期交接，中部送去整理。'},{end:1.8,nodes:['context'],flows:[],text:'回放：中部过程整理为更短的工作摘要。'},{end:3,nodes:['context'],flows:['context-input'],text:'回放：精简输入回到工作台，原始记录仍在。'}],
 historyWrite:[{end:1.6,nodes:['archive'],flows:['history-write'],text:'观察已保存的会话记录，尚未表示下次已经读过。'}],
 newSession:[{end:1.5,nodes:['context','loop'],flows:['intake-loop'],text:'新会话只带新委托，旧整段上下文没有搬来。'}],
 history:[{end:.8,nodes:['loop','archive'],flows:['history-query'],text:'按事件查找过去的记录。'},{end:2,nodes:['archive','loop'],flows:['history-result'],text:'命中记录读回本轮输入；保存不等于已经读过。'}],
 memory:[{end:1.8,nodes:['memory','loop'],flows:['memory-read'],text:'读取已保存的用户资料；不搬入完整旧上下文。'}],
 skill:[{end:1.8,nodes:['memory','loop'],flows:['skill-read'],text:'按本次任务读取核查方法；手册不是执行器。'}],
 memoryWrite:[{end:1.6,nodes:['memory'],flows:['memory-write'],text:'保存可检查的长期条目，没有修改模型权重。'}],
 input:[{end:1.8,nodes:['intake','loop'],flows:['intake-loop','intake-persist'],text:'委托和不完整线索交给调度，原文保留。'}],
 planning:[{end:1.6,nodes:['loop','analysis'],flows:['loop-analysis'],text:'当前信息不足，需要获取原始依据。'}],
 analysis:[{end:1.8,nodes:['analysis','loop'],flows:['analysis-loop'],text:'来源比较的结果改变下一步安排。'}],
 delivery:[{end:1.8,nodes:['delivery','loop'],flows:['deliver'],text:'交付有来源的草稿；发布仍未授权。'}],
 review:[{end:1.6,nodes:['review'],flows:['trace-delivery'],text:'查看可观察的任务轨迹，没有模型训练。'}]
};
const aliases={request:'toolRequest','request-created':'toolRequest','history-written':'historyWrite','tool-request':'toolRequest','tool-requested':'toolRequest','tool-result':'toolResult','tool-succeeded':'toolResult','tool-read':'toolResult','tool-error':'toolError','tool-failed':'toolError','tool-wrong-version':'toolError','evidence-read':'toolResult','source-read':'toolResult','sources-read':'toolResult','context-compressed':'compress','context-compression':'compress',compression:'compress','history-read':'history','history-search':'history','history-loaded':'history','memory-read':'memory','memory-loaded':'memory','skill-read':'skill','skill-loaded':'skill','skill-saved':'memoryWrite','memory-write':'memoryWrite','memory-saved':'memoryWrite','experience-saved':'memoryWrite','task-received':'input','task-started':'input','task-created':'input',received:'input','plan-created':'planning','evidence-compared':'analysis','findings-created':'analysis','draft-created':'delivery','draft-delivered':'delivery','session-started':'newSession','session-created':'newSession'};
export function operationForEvent(event={}){
 const kind=String(event.type||event.kind||'').replace(/[._]/g,'-');
 if(aliases[kind])return aliases[kind];
 const explicit=event.operation;if(OPERATION_PHASES[explicit])return explicit;if(aliases[explicit])return aliases[explicit];
 return OPERATION_PHASES[kind]?kind:null;
}
export function relatedFor(snapshot){
 const focus=snapshot.focusNodeId;if(!focus)return [];
 const adjacent=FLOWS.filter(f=>f.from===focus||f.to===focus);
 const activeEdges=adjacent.filter(f=>snapshot.activeFlowIds?.includes(f.id));
 const candidates=[...activeEdges.flatMap(f=>[f.from,f.to]),...(snapshot.activeNodeIds||[]).filter(n=>adjacent.some(f=>f.from===n||f.to===n)),...adjacent.filter(f=>f.type!=='trace').flatMap(f=>[f.from,f.to])];
 return [...new Set(candidates.filter(n=>n!==focus))].slice(0,2);
}
export function createDirector(){
 const state={focusNodeId:null,relatedNodeIds:[],activeNodeIds:[],activeFlowIds:[],cameraMode:'overview',tourStep:-1,simulationState:'idle',tourTime:SETTLE_SECONDS,showFullPath:false,manual:false,part:null,operation:null,observation:null,completed:{},errors:{},waiting:[]};
 const queue=[],finished=[],seenEvents=new Set();let serial=0;
 function derive(){const op=state.operation,phase=op?OPERATION_PHASES[op.kind]?.find(p=>op.elapsed<p.end):null;state.activeNodeIds=phase?.nodes||[];state.activeFlowIds=phase?.flows||[];state.simulationState=phase?'running':state.waiting.length?'waiting':'idle';state.operationText=phase?.text||'';state.relatedNodeIds=relatedFor(state);}
 function focus(index,{resume=false}={}){if(!NODES[index])return false;const keepManual=state.manual&&!resume;state.focusNodeId=NODES[index];state.tourStep=index;state.part=null;state.showFullPath=false;if(keepManual){state.cameraMode='manual';state.tourTime=SETTLE_SECONDS;}else{state.cameraMode='guide';state.tourTime=0;state.manual=false;}derive();return !keepManual;}
 function viewState(){return {focusNodeId:state.focusNodeId,cameraMode:state.cameraMode,manual:state.manual,part:state.part,tourStep:state.tourStep,showFullPath:state.showFullPath};}
 function restoreView(view){state.focusNodeId=NODES.includes(view?.focusNodeId)?view.focusNodeId:null;state.cameraMode=view?.manual?'manual':view?.cameraMode||'overview';state.manual=!!view?.manual;state.part=view?.part??null;state.tourStep=Number.isInteger(view?.tourStep)?view.tourStep:-1;state.showFullPath=!!view?.showFullPath;state.tourTime=SETTLE_SECONDS;derive();}
 function run(kind,metadata={}){if(!OPERATION_PHASES[kind])throw Error('Unknown operation');const id=++serial;queue.push({kind,id,elapsed:0,...metadata});return id;}
 function observeEvent(event,{replay=false,animate=true}={}){
  const id=event?.id||event?.eventId||event?.seq;if(id==null)return null;
  if(!replay&&seenEvents.has(String(id)))return null;seenEvents.add(String(id));
  if(replay){queue.length=0;state.operation=null;}state.observation=structuredClone(event);const kind=operationForEvent(event);if(kind&&kind.startsWith('tool')&&kind!=='toolError')delete state.errors.tools;
  if(!animate||!kind){derive();return null;}
  const requested=event.result?.requestedIds||event.input?.requestedIds;
  const identity=requested?.length?requested:event.evidenceIds?.length?event.evidenceIds:event.result?.entry?[event.result.entry.id]:event.input?.entryId?[event.input.entryId]:event.result?.historyId?[event.result.historyId]:event.input?.sourceIds||[];
  const cardIds=[...new Set(identity.filter(Boolean).map(String))];
  const cardLabel=kind==='memoryWrite'?(String(event.type||event.kind).includes('skill')?'核查方法条目':'受众偏好条目'):kind==='memory'?'已保存的受众偏好':kind==='skill'?'来源核验手册':kind==='history'?'上次会话记录':kind==='historyWrite'?'会话存档':kind==='newSession'?'新的委托':kind==='toolError'?'错误回执':null;
  return run(kind,{eventId:String(id),replay,cardIds,cardLabel,title:event.title||event.detail||'',failed:kind==='toolError'});
 }
 function advance(dt,runOperations=true){if(!Number.isFinite(dt)||dt<=0)return;state.tourTime=Math.min(SETTLE_SECONDS,state.tourTime+dt);if(!runOperations||state.tourTime<SETTLE_SECONDS){derive();return;}
  for(const n of Object.keys(state.completed)){state.completed[n]-=dt;if(state.completed[n]<=0)delete state.completed[n];}
  if(!state.operation&&state.tourTime>=SETTLE_SECONDS&&queue.length)state.operation=queue.shift();
  if(state.operation){const op=state.operation;op.elapsed+=dt;const phases=OPERATION_PHASES[op.kind];if(op.elapsed>=phases.at(-1).end){for(const n of [...new Set(phases.flatMap(p=>p.nodes))]){if(op.failed){if(n==='tools')state.errors[n]=true;}else state.completed[n]=1.1;}finished.push(op.id);state.operation=null;}}
  derive();
 }
 function skipMotion(){const pending=[...(state.operation?[state.operation]:[]),...queue.splice(0)];for(const op of pending){const nodes=[...new Set(OPERATION_PHASES[op.kind].flatMap(p=>p.nodes))];for(const node of nodes){if(op.failed){if(node==='tools')state.errors.tools=true;}else state.completed[node]=1.1;}finished.push(op.id);}state.operation=null;state.tourTime=SETTLE_SECONDS;derive();}
 function snapshot(){derive();return {...state,completed:{...state.completed},errors:{...state.errors},waiting:[...state.waiting],relatedNodeIds:[...state.relatedNodeIds],activeNodeIds:[...state.activeNodeIds],activeFlowIds:[...state.activeFlowIds],nodeStates:Object.fromEntries(NODES.map(n=>[n,state.errors[n]?'Error':state.activeNodeIds.includes(n)?'Running':state.completed[n]?'Completed':state.waiting.includes(n)?'Waiting':'Idle'])),operation:state.operation?{...state.operation,cardIds:[...(state.operation.cardIds||[])]}:null,observation:state.observation?structuredClone(state.observation):null,queueLength:queue.length};}
 return {state,focus,viewState,restoreView,run,observeEvent,advance,skipMotion,snapshot,error:n=>state.errors[n]=true,clearError:n=>delete state.errors[n],finished:()=>finished.splice(0),waiting:n=>state.waiting=[...n],manual:()=>{state.manual=true;state.cameraMode='manual';},overview(){state.focusNodeId=null;state.relatedNodeIds=[];state.cameraMode='overview';state.manual=false;state.part=null;state.showFullPath=false;state.tourTime=SETTLE_SECONDS;},inspect(part,node=state.focusNodeId){if(!NODES.includes(node))return;state.focusNodeId=node;state.cameraMode='inspect';state.manual=false;state.part=part;derive();},trace(){state.cameraMode='trace';state.manual=false;state.showFullPath=true;},fullPath(v){state.showFullPath=v;},reset(){queue.length=0;finished.length=0;seenEvents.clear();state.operation=null;state.observation=null;state.completed={};state.errors={};state.waiting=[];derive();}};
}
// Attention controls contrast, not whole-scene transparency. Occlusion is separate.
export function attention(snapshot,id){if(!snapshot.focusNodeId||id===snapshot.focusNodeId)return 1;return snapshot.relatedNodeIds.includes(id)?.82:.48;}
