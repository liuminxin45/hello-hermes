// Deterministic presentation samples. No task, store, network or learning writes.
const clamp=(value,min,max)=>Math.min(max,Math.max(min,Number.isFinite(value)?value:min));
const copy=value=>structuredClone(value);
const six=(focus,process,flow,options={})=>[
 {id:'arrive',start:0,end:1.2,nodes:[],flows:[],cue:options.arrive||'先看输入口和操作的位置。',action:'walk'},
 {id:'prepare',start:1.2,end:2.4,nodes:options.prepareNodes||[focus],flows:options.prepareFlows||[],cue:options.prepare||'资料卡已经到达输入口。',action:'receive'},
 {id:'process',start:2.4,end:4.7,nodes:[focus],flows:[],cue:process,action:options.action||'read'},
 {id:'handoff',start:4.7,end:6.3,nodes:options.handoffNodes||[focus,'loop'],flows:flow?[flow]:[],cue:options.handoff||'结果卡沿箭头交回工作台。',action:'return',marker:options.marker},
 {id:'result',start:6.3,end:7.3,nodes:[],flows:[],cue:options.result||'结果留在这里，可以核对后再继续。',action:'point',marker:options.marker},
 {id:'hold',start:7.3,end:8,nodes:[],flows:[],cue:options.result||'结果保留，可以继续、追问或重看。',action:'hold'}
];
export const ACTOR_BINDINGS={
 tool:{role:'tool-worker',lamp:'toolExit'},toolRequest:{role:'tool-worker',lamp:'toolEntry'},toolResult:{role:'tool-worker',lamp:'toolExit'},toolError:{role:'tool-worker',lamp:'toolError'},
 memory:{role:'archivist',lamp:'preference'},skill:{role:'archivist',lamp:'skill'},history:{role:'archivist',lamp:'history'},historyWrite:{role:'archivist',lamp:'history'},memoryWrite:{role:'archivist',lamp:'preference'},
 compress:{role:'organizer',lamp:'context'},input:{role:'reception',lamp:'intake'},planning:{role:'mentor',lamp:'loop'},analysis:{role:'analyst',lamp:'model'},delivery:{role:'courier',lamp:'delivery'},newSession:{role:'reception',lamp:'intake'},review:{role:'archivist',lamp:'history'},decision:{role:'mentor',lamp:null}
};
export const CONTEXT_DEMO={id:'context-long-v2',capacity:100,threshold:70,reserved:20,duration:26,stages:[
 {id:'base',start:0,end:2,from:25,to:25,cue:'这是当前一次工作输入，先保留要求与最近交接。',action:'point'},
 {id:'append1',start:2,end:4,from:25,to:35,cue:'又查回一份资料，先交给工作台。',action:'receive'},
 {id:'append2',start:4,end:6,from:35,to:45,cue:'上一轮交接移到过程区，新交接成为最近内容。',action:'receive'},
 {id:'append3',start:6,end:8,from:45,to:55,cue:'比对过程继续加入，资料占用逐步增加。',action:'receive'},
 {id:'append4',start:8,end:10,from:55,to:65,cue:'新的工具结果到达，最近交接再次更新。',action:'receive'},
 {id:'threshold',start:10,end:12,from:65,to:70,cue:'还没装满，但下一次回执和输出需要预留空间。',action:'receive'},
 {id:'protect',start:12,end:15,from:70,to:70,cue:'这一次先保护规则、起始要求与完整的最近交接。',action:'select'},
 {id:'summarize',start:15,end:20,from:70,to:70,cue:'整理员读中间过程，写出保留条件、来源与待办的新摘要。',action:'summarize'},
 {id:'replace',start:20,end:23,from:70,to:35,cue:'新摘要返回工作台，替换这一次选中的中间过程。',action:'return'},
 {id:'result',start:23,end:26,from:35,to:35,cue:'70格变成35格。原始档案还在，摘要仍可能漏掉细节。',action:'hold',marker:'compression-replaced'}
]};
const RAW_PACKETS=[
 {id:'rules-1',kind:'rules',text:'依据与范围；只做草稿，不发布'},
 {id:'head-1',kind:'head',text:'核查原始来源'}, {id:'head-2',kind:'head',text:'最多三条，区分未知'},
 ...Array.from({length:5},(_,i)=>[{id:'turn-'+i+'-request',pairId:'turn-'+i,kind:'tail',text:'第'+(i+1)+'轮读取请求'},{id:'turn-'+i+'-result',pairId:'turn-'+i,kind:'tail',text:i===4?'A1/A2需申请审核；D1限PDF/Markdown':'第'+(i+1)+'轮原文与比对'}]).flat(),
 {id:'comparison-5',kind:'middle',text:'待核地区；交付前保留条件与来源'}
].map((packet,slot)=>({...packet,slot,units:5}));
export function sampleContextDemo(time,config={}){
 const t=clamp(time,0,26),stage=CONTEXT_DEMO.stages.find(x=>t<x.end)||CONTEXT_DEMO.stages.at(-1),progress=clamp((t-stage.start)/(stage.end-stage.start),0,1);
 const completedBatches=t>=12?5:t>=10?4:t>=8?3:t>=6?2:t>=4?1:0;
 const tailTurn=Math.min(completedBatches,4),tailIds=['turn-'+tailTurn+'-request','turn-'+tailTurn+'-result'];
 const protectedIds=t>=12?['rules-1','head-1','head-2',...tailIds]:[];
 const visibleIds=new Set(['rules-1','head-1','head-2',...Array.from({length:tailTurn+1},(_,i)=>['turn-'+i+'-request','turn-'+i+'-result']).flat(),...(completedBatches===5?['comparison-5']:[])]);
 const growthIndex=stage.id.startsWith('append')?Number(stage.id.slice(-1)):stage.id==='threshold'?5:0;
 const incomingIds=growthIndex>0&&growthIndex<5?['turn-'+growthIndex+'-request','turn-'+growthIndex+'-result']:growthIndex===5?['comparison-5']:[];
 const replaced=t>=23,loss=!!config.loss;
 const summaryText=loss?'Atlas开放了，Delta能检索文档。':'A1/A2：Atlas仍需申请审核，地区未全；D1：支持PDF/Markdown。待交草稿，不发布。';
 const raw=RAW_PACKETS.map(packet=>{
  const visible=visibleIds.has(packet.id),isTail=tailIds.includes(packet.id),kind=packet.kind==='tail'?(isTail?'tail':'middle'):packet.kind;
  let location=visible?'container':'archive',counted=visible;
  if(incomingIds.includes(packet.id)&&!visible)location='incoming';
  if(visible&&kind==='middle'&&t>=15&&!replaced)location='summarizing';
  if(replaced&&kind==='middle'){location='archive';counted=false;}
  return {...packet,kind,location,progress:location==='incoming'?progress:location==='summarizing'?clamp((t-15)/5,0,1):1,counted,protected:protectedIds.includes(packet.id)};
 });
 const summary={id:'summary-A1-A2-D1',units:10,text:summaryText,sourceIds:['A1','A2','D1'],location:t<15?'pending':t<20?'machine':t<23?'returning':'container',progress:t<20?clamp((t-15)/5,0,1):clamp((t-20)/3,0,1),loss};
 const summaries=Array.from({length:2},(_,i)=>({id:summary.id+'-'+(i+1),kind:'summary',units:5,slot:3+i,text:summaryText,location:summary.location,progress:summary.progress,counted:replaced,protected:false,sourceIds:[...summary.sourceIds]}));
 const packets=[...raw,...summaries],units=packets.filter(x=>x.counted).reduce((sum,p)=>sum+p.units,0);
 return {id:CONTEXT_DEMO.id,phaseId:stage.id,time:t,duration:26,progress,units,capacity:100,threshold:70,reserved:20,thresholdReached:units>=70,protectedIds,tailIds,archiveIds:RAW_PACKETS.map(x=>x.id),packets,summary,occupancyBefore:70,occupancyAfter:35,freed:replaced?35:0,stageFrom:stage.from,stageTo:stage.to,rawFragments:['Atlas：仍需申请审核','Delta：PDF / Markdown','仅草稿，不发布'],cue:loss&&t>=15?'这份坏摘要省掉了申请审核与格式条件；来源没有改变。':stage.cue,actor:{role:'organizer',action:stage.action,progress},captureMarker:stage.marker||null,teachingOnly:true,finished:t>=26};
}
const descriptors={
 tool:{focus:'tools',phases:six('tools','工人查看目录，再读取这次请求对应的原始材料。','tool-result',{prepareFlows:['tool-call'],prepareNodes:['loop','tools'],result:'回执留在调度台；读取成功仍需判断是否适用。',marker:'tool-result-visible'})},
 toolRequest:{focus:'tools',phases:six('tools','工人接到请求，读取动作还没有完成。','tool-call',{prepareNodes:['loop'],result:'请求已经提出，下一步才是真正取资料。',handoff:'请求卡交到工具入口，等待执行。',action:'receive'})},
 toolResult:{focus:'tools',phases:six('tools','工人根据请求读取公告，再检查返回的来源编号。','tool-result',{prepareFlows:['tool-call'],prepareNodes:['loop','tools'],result:'原文留在这里；还要核对它能否支持本次草稿。',marker:'tool-result-visible'})},
 toolError:{focus:'tools',phases:six('tools','读取停在失败或不适用的位置，没有取得可用的新依据。','tool-error',{result:'错误回执保留，不能把它写成成功交付。',handoff:'工人交回错误回执，而不是成功来源卡。',action:'stop'})},
 memory:{focus:'memory',phases:six('memory','档案员打开偏好抽屉，只取本轮实际读取的条目。','memory-read',{result:'偏好已读入；当前明确要求仍然优先。',marker:'reuse-loaded',action:'open-drawer'})},
 skill:{focus:'memory',phases:six('memory','档案员翻开核查手册，将方法步骤放到工作台旁。','skill-read',{result:'读到了方法，还需要选择并执行本次工具动作。',marker:'reuse-loaded',action:'open-book'})},
 history:{focus:'archive',phases:six('archive','先查索引命中，再按编号取回相关原始记录。','history-result',{prepareFlows:['history-query'],prepareNodes:['loop','archive'],result:'只带回相关旧结论；它仍须重新核实。',marker:'reuse-loaded',action:'index'})},
 historyWrite:{focus:'archive',phases:six('archive','档案员把已发生的会话过程登记到档案柜。','history-write',{result:'过程已留档，但没有自动读进下一次会话。',action:'write'})},
 memoryWrite:{focus:'memory',phases:six('memory','按已经确认的选择登记条目，不代替用户同意。','memory-write',{result:'资料保存完成；没有改变模型权重。',action:'write'})},
 input:{focus:'intake',phases:six('intake','三张线索登记到同一个带编号的任务夹。','intake-loop',{result:'线索已经收下，尚未核实，也还没有成稿。',handoffNodes:['intake','loop'],action:'register'})},
 planning:{focus:'loop',phases:six('loop','调度台依据当前要求，准备下一次可观察动作。','loop-analysis',{result:'下一步由当前要求与已有反馈决定。',handoffNodes:['loop','analysis'],action:'arrange'})},
 analysis:{focus:'analysis',phases:six('analysis','同源转述合并，夸大的主张依据原文改写。','analysis-loop',{result:'反馈改变了下一步，而不是照原计划机械成稿。',action:'compare'})},
 delivery:{focus:'delivery',phases:six('delivery','两份草稿逐页展开，留下依据和未确认项。','deliver',{result:'有来源的草稿已经交付；没有获得发布授权。',handoffNodes:['loop','delivery'],action:'deliver'})},
 newSession:{focus:'context',phases:six('context','清空旧整段聊天，只把新委托摆到工作台。','intake-loop',{result:'新会话开始。旧资料还在，但尚未自动读入。',action:'clear'})},
 review:{focus:'review',phases:six('review','记录台展示已发生的事件，训练设备保持关闭。','trace-delivery',{result:'轨迹记录不是模型训练。',handoffNodes:['delivery','review'],action:'write'})},
 decision:{focus:'memory',phases:six('memory','保存门保留你刚才的选择，不自动补选条目。',null,{result:'选择已记录；未选中的长期条目不会凭空出现。',action:'point'}).map(phase=>({...phase,nodes:[],flows:[]}))},
 compress:{focus:'context',phases:CONTEXT_DEMO.stages.map(stage=>({...stage,nodes:['base','protect','result'].includes(stage.id)?[]:['context'],flows:stage.id.startsWith('append')||stage.id==='threshold'?['context-feed']:stage.id==='replace'?['context-input']:[],marker:stage.marker}))}
};
export const STORYBOARDS=Object.fromEntries(Object.entries(descriptors).map(([kind,value])=>[kind,{id:kind==='compress'?'context-long-v2':kind,duration:value.phases.at(-1).end,focus:value.focus,phases:value.phases,resultHold:'until-continue',repeatAs:'teaching-replay'}]));
export const OPERATION_PHASES=Object.fromEntries(Object.entries(STORYBOARDS).map(([kind,clip])=>[kind,clip.phases.map(phase=>({...phase,text:phase.cue}))]));
export function sampleStoryboard(kind,time=0,metadata={}){
 const clip=STORYBOARDS[kind];if(!clip)return {clipId:'static-result',phaseId:'result',cue:metadata.title||'这条记录没有动态分镜，保留静态结果。',elapsed:0,duration:0,progress:1,phaseProgress:1,activeNodeIds:[],activeFlowIds:[],actor:{role:'mentor',action:'hold',progress:1},lamps:{},captureMarker:null,finished:true};
 const elapsed=clamp(time,0,clip.duration),phase=clip.phases.find(p=>elapsed<p.end)||clip.phases.at(-1),phaseProgress=clamp((elapsed-phase.start)/(phase.end-phase.start),0,1),context=kind==='compress'?sampleContextDemo(elapsed,{loss:metadata.loss||metadata.event?.loss}):null;
 const binding=ACTOR_BINDINGS[kind],writingSkill=kind==='memoryWrite'&&(/skill/.test(metadata.event?.type||'')||metadata.cardLabel==='核查方法条目'),lamp=writingSkill?'skill':binding?.lamp;
 const lamps=Object.fromEntries(['toolEntry','toolExit','toolError','preference','skill','history','context','intake','loop','model','delivery'].map(id=>[id,false]));
 if(lamp&&!['arrive','hold'].includes(phase.id))lamps[lamp]=true;
 if(kind==='compress')lamps.context=!!phase.nodes.length;
 if(kind==='toolResult'||kind==='tool'){lamps.toolEntry=phase.id==='prepare';lamps.toolExit=['handoff','result'].includes(phase.id);}
 const actor=context?.actor||{role:binding?.role||'mentor',action:phase.action||'hold',progress:phaseProgress};
 let cue=context?.cue||phase.cue;
 if(kind==='analysis'&&phase.id==='process'&&metadata.event?.sessionId==='session-2')cue='对照最新公告与旧记录，区分这次新增的能力、仍有限制的条件。';
 if(kind==='delivery'&&phase.id==='process'){const count=metadata.event?.result?.draft?.length;cue=count===1?'一份草稿展开，留下最新依据和未确认项。':count>1?count+'份草稿逐页展开，留下依据和未确认项。':cue;}
 return {clipId:clip.id,kind,phaseId:phase.id,cue,elapsed,duration:clip.duration,progress:elapsed/clip.duration,phaseProgress,activeNodeIds:[...(phase.nodes||[])],activeFlowIds:[...(phase.flows||[])],actor,guide:{action:phase.id==='arrive'?'walk':'point',progress:phaseProgress},lamps,captureMarker:context?.captureMarker||phase.marker||null,context,finished:elapsed>=clip.duration};
}
export function validateStoryboards(nodes,flows){const errors=[],nodeSet=new Set(nodes),flowSet=new Set(flows.map(f=>f.id));for(const [kind,clip]of Object.entries(STORYBOARDS)){if(!ACTOR_BINDINGS[kind])errors.push(kind+':missing actor');let end=0;for(const phase of clip.phases){if(phase.start!==end||phase.end<=phase.start)errors.push(kind+':invalid time');end=phase.end;for(const node of phase.nodes||[])if(!nodeSet.has(node))errors.push(kind+':node '+node);for(const flow of phase.flows||[])if(!flowSet.has(flow))errors.push(kind+':flow '+flow);}if(end!==clip.duration)errors.push(kind+':duration');}return errors;}
