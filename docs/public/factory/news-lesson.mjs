import {createVisit,emptyLibrary,addEvent,requestSources,retrieveSources,verifySources,saveExperience,startNewSession,reviseSkill} from './engine.mjs';
import {sampleContextDemo} from './storyboard.mjs';
import {QUESTIONS} from './content.mjs';
export const NEWS_VERSION='newsroom-walkthrough-v1';
export const NEWS_ACTIVE='newsroom-v1-active';
export const REQUEST='帮我采集一下 AI 行业新闻，准备发到我们的自媒体。挑最多三条值得关注的，整理成简报，附上出处，不确定的地方标出来，先给我审阅。';
export const STEPS=[
 {id:'brief',title:'老板交来一个任务',node:'intake',copy:'今天，你负责准备自媒体稿件。老板没有给你整理好的资料，只说了想要什么。',action:null},
 {id:'compose',title:'把这一个要求，交给 Hermes',node:'intake',copy:'你只需要把要求发出去。找新闻、查出处和整理稿件，是接下来要观察的过程。',action:null},
 {id:'receive',title:'先把这次要求放在眼前',node:'context',copy:'Hermes 先收到你发来的要求。接下来提供给模型的工作资料，叫作上下文；现在这里还没有新闻。',flow:['intake','context','本次要求'],action:'receive'},
 {id:'search-request',title:'先出现的，是一张搜索请求',node:'analysis',copy:'模型，就是这里负责生成回答或动作请求的 AI。这次它输出搜索请求，要查找 AI 行业的候选新闻；提出请求还不等于搜到内容，下一步才交给工具执行。',flow:['context','analysis','本轮输入'],action:'search-request'},
 {id:'search-execute',title:'搜索工具，真正去找资料',node:'tools',copy:'搜索工具按请求查找候选新闻。返回的是三条线索，其中可能有转载，也可能有夸大的说法；它们还不是可以直接发布的结论。',flow:['analysis','tools','搜索请求'],action:'search'},
 {id:'search-return',title:'找到的线索，先回到工作资料里',node:'context',copy:'搜索结果沿返回线进入当前上下文。模型下一轮才能利用这些新资料，而不是让工具把搜索摘要直接当成稿件交出去。',flow:['tools','context','三条候选线索'],action:null},
 {id:'read-request',title:'有了线索，还得找原始出处',node:'analysis',copy:'接下来的模型输出换成了读取原始公告的请求。搜索摘要提供了方向，但只有转述，还不足以确认“全面开放”这样的结论。',flow:['context','analysis','候选线索'],action:'request'},
 {id:'read-execute',title:'工具读回公告，保留来源编号',node:'tools',copy:'这次工具执行的是读取原文。回执带着来源编号和实际内容，读取成功只说明拿到了材料，还没有说明原来的说法正确。',flow:['analysis','tools','读取原文请求'],action:'retrieve'},
 {id:'read-return',title:'原文也要回到这一轮输入',node:'context',copy:'原文回执进入上下文，与先前的搜索线索放在一起。它们仍有各自的出处，后面的判断必须能沿这些编号找回依据。',flow:['tools','context','原文回执'],action:null},
 {id:'verify',title:'新依据，改变了稿件该怎么写',node:'analysis',copy:'两条转载合并成同一件事，“全面开放”改为“开放申请，仍需审核”。资料只支持两条独立新闻，就写两条；未知的范围继续标出来。',flow:['context','analysis','核对原始依据'],action:'verify'},
 {id:'draft',title:'最后，才形成一份待审稿件',node:'delivery',copy:'核实后的结论组成稿件，每条都保留出处和未知项。这是一份交给你审阅的草稿，没有发布到自媒体，也没有发送通知。',flow:['analysis','delivery','有依据的草稿'],action:'deliver'},
 {id:'finish',title:'任务走完了，决定权交回给你',node:'delivery',copy:'你刚刚只提交了一个要求，却看到了请求、执行、返回和修正。工具结果会改变下一轮输入，模型才有机会继续请求工具，或交出回答。',flow:['analysis','delivery','刚才的交付方向'],action:'finish'}
];
export const LABELS={intake:'你的要求',context:'当前工作资料',analysis:'模型',tools:'工具',delivery:'待审稿件',archive:'原始档案',memory:'保存的资料与方法'};
export function questionsFor(x){
 const basic=[
  {id:'news-context-basic',q:'上下文是什么，为什么要先放要求？',answer:'模型每一轮依据收到的输入工作。把目标和限制放在这份输入里，后续工具返回的资料才能围绕同一个任务处理；尚未查回的新闻不会凭空出现在这里。',evidence:'眼前先只有要求，搜索之后才会出现线索。',boundary:'这是典型工具型Agent的教学示意，不是模型隐藏思维。'},
  {id:'news-return-basic',q:'为什么不能把工具结果直接当成稿件？',answer:'工具给的是候选线索或原文，不一定已经满足委托。结果返回上下文后，下一轮模型才能比较来源、发现重复或冲突，再输出下一项请求或稿件。',evidence:'眼前返回的仍是线索，还没有完成核实与稿件组织。',boundary:'工具执行成功和任务完成是两件事。'}
 ];
 const ids=x.branch?.kind==='context'?['summary-risk','head-tail','threshold','recover-original']:x.branch?.kind==='reuse'?['memory-skill','current-wins','hermes-memory-read','hermes-skill-loading','hermes-history-search','is-training']:x.branch?.kind==='failure'?['failed-tool','tool-success','retry-policy']:x.index===2?['news-context-basic','resident-tool-descriptions']:x.index===3||x.index===6?['who-executes','model-agent','scenario-route']:x.index===4||x.index===7?['who-executes','tool-success','tools-permission']:x.index===5||x.index===8?['news-return-basic','context-history','recover-original']:x.index===9?['duplicate-source','feedback-next','wrong-version']:['how-complete','tool-success','is-training'];
 return ids.map(id=>[...basic,...QUESTIONS].find(q=>q.id===id)).filter(Boolean).map(q=>q.id==='current-wins'?{...q,evidence:'如果上次保存了面向普通读者的偏好，这次明确面向研发同事的要求仍然优先。没有保存时不声称已经读到偏好。'}:q);
}
export const CANDIDATES=[
 {id:'S1',title:'资讯号：Atlas 接口测试有变化',text:'听说进入开发者预览，尚无公告全文。'},
 {id:'S2',title:'社区：转载 Atlas 的同一条消息',text:'内容来自 S1，不能算独立的新事件。'},
 {id:'S3',title:'周报：Atlas“全面开放”，Delta 更新检索',text:'只有摘要，没有申请条件、格式限制与原始出处。'}
];
const clone=x=>structuredClone(x),stamp=()=>new Date().toISOString();
export function createNewsVisit(id){
 const s=createVisit({nickname:'学习者'},emptyLibrary(),id);s.scenarioVersion=NEWS_VERSION;
 const a=s.task.sessions[0];a.request=REQUEST;a.audience='general';a.evidenceIds=[];a.phase='unsubmitted';a.context.head=REQUEST;a.context.sourceIds=[];a.context.middle=[];a.context.tail=[];a.context.units=5;
 a.context.toolDefinitions.unshift({name:'search_news',input:'主题与候选范围',output:'候选线索、编号与摘要',boundary:'固定虚构教材，不联网。'});
 s.tour.lesson={index:1};s.learning.mainComplete=false;s.learning.deep={context:false,reuse:false};s.learning.explainerVersion=2;s.learning.lessonSteps=[];s.learning.viewRecords=[];
 return s;
}
export function restoreNewsVisit(s){
 if(s?.version!==3||s.schemaVersion!==3||s.scenarioVersion!==NEWS_VERSION||typeof s.id!=='string'||!s.id||!Number.isFinite(Date.parse(s.startedAt)))return null;
 const strings=a=>Array.isArray(a)&&a.every(v=>typeof v==='string'&&v.trim()),drafts=a=>Array.isArray(a)&&a.every(d=>d&&typeof d.title==='string'&&typeof d.claim==='string'&&strings(d.sources));
 if(!s.task||!Array.isArray(s.task.sessions)||![1,2].includes(s.task.sessions.length)||!Number.isInteger(s.task.sessionIndex)||!s.task.sessions[s.task.sessionIndex])return null;
 if(!['events','applied'].every(k=>Array.isArray(s.task[k]))||!s.task.events.every((e,i)=>e&&typeof e.id==='string'&&e.seq===i+1))return null;
 if(!s.task.sessions.every(a=>a&&typeof a.request==='string'&&Array.isArray(a.evidenceIds)&&Array.isArray(a.draft)&&a.context&&['sourceIds','memoryIds','skillIds','historyIds','middle','tail'].every(k=>Array.isArray(a.context[k]))&&a.readings&&['memoryIds','skillIds','historyIds'].every(k=>Array.isArray(a.readings[k]))))return null;
 const l=s.learning,t=s.tour;
 if(!l||!t||!Number.isInteger(t.lesson?.index)||t.lesson.index<1||t.lesson.index>=STEPS.length||typeof l.mainComplete!=='boolean'||!l.deep||!['observedEventIds','experiments','questions','photos','photoFailures','attempts','notes'].every(k=>Array.isArray(l[k])))return null;
 if(!s.task.library||!['preferences','skills','history'].every(k=>Array.isArray(s.task.library[k])))return null;
 if(!s.profile||typeof s.profile.nickname!=='string'||s.task.published!==false||typeof l.deep.context!=='boolean'||typeof l.deep.reuse!=='boolean')return null;
 if(!s.task.sessions.every(a=>drafts(a.draft)&&strings(a.evidenceIds)))return null;
 const lib=s.task.library;if(lib.schemaVersion!==3||!lib.preferences.every(p=>p&&[p.id,p.kind,p.value].every(v=>typeof v==='string'&&v.trim()))||!lib.skills.every(k=>k&&typeof k.id==='string'&&typeof k.name==='string'&&strings(k.steps)&&k.steps.length)||!lib.history.every(h=>h&&typeof h.id==='string'&&typeof h.request==='string'&&drafts(h.draft)&&strings(h.eventIds)&&strings(h.evidenceIds)))return null;
 if(STEPS.slice(2,t.lesson.index+1).some(step=>step.action&&!s.task.applied.includes('news:'+step.action)))return null;
 if(l.mainComplete&&(!s.task.sessions[0].delivered||!s.task.sessions[0].verified||!s.task.applied.includes('news:finish')))return null;
 if(l.deep.context&&!l.experiments.some(x=>x.kind==='compression'))return null;
 if(l.deep.reuse&&(!s.task.sessions[1]?.delivered||!s.task.applied.includes('news:reuse-9')))return null;
 if(!l.observedEventIds.every(id=>s.task.events.some(e=>e.id===id)))return null;
 if(!l.attempts.every(a=>a&&Number.isFinite(a.score)&&a.score>=0&&a.score<=100&&Array.isArray(a.details)&&a.details.length===6&&a.details.every(d=>d&&typeof d.correct==='boolean'&&Number.isInteger(d.selected))&&a.score===Math.round(a.details.filter(d=>d.correct===true).length/6*100)))return null;
 return s;
}
function once(s,key,fn){const k='news:'+key;if(s.task.applied.includes(k))return [];const n=s.task.events.length;fn();s.task.applied.push(k);return s.task.events.slice(n);}
function effect(s,action){
 const a=s.task.sessions[0];if(!action)return [];
 return once(s,action,()=>{
  if(action==='receive'){addEvent(s,'request-received','收到这次用户要求','只有要求进入当前上下文，尚无候选材料。',{nodeId:'context',input:{request:REQUEST},result:{sourceIds:[]}});a.phase='received';}
  if(action==='search-request')addEvent(s,'search-requested','模型提出新闻搜索请求','提出动作，不是已经执行。',{nodeId:'analysis',result:{tool:'search_news',query:'AI 行业新闻，寻找原始出处'}});
  if(action==='search'){a.evidenceIds=CANDIDATES.map(x=>x.id);a.phase='searched';addEvent(s,'search-result','搜索工具取得候选新闻','候选线索不是已核实结论。',{nodeId:'tools',result:{ok:true,candidates:CANDIDATES},evidenceIds:a.evidenceIds});}
  if(action==='request')requestSources(s);
  if(action==='retrieve')retrieveSources(s);
  if(action==='verify')verifySources(s);
  if(action==='deliver'){
   if(!a.verified)throw Error('没有核实来源，不能交付成功稿件。');
   a.draft=[
    {title:'Atlas 开放开发者预览申请',claim:'Atlas 接口进入开发者预览，开发者可以提交试用申请，但仍需审核后获得权限。部分转述将其写成“全面开放”，原始公告并不支持这一说法。申请用途与准入条件仍需按说明核对。',sources:['A1','A2'],unknown:'完整地区名单尚未公布。'},
    {title:'Delta 增加 PDF 与 Markdown 检索',claim:'Delta 新增对 PDF 和 Markdown 文档的检索能力。更新说明没有承诺支持所有格式，也没有保证每次检索都能找全资料。选用时仍要结合自己的文档验证效果。',sources:['D1'],unknown:'在具体资料集上的检索效果仍需验证。'}
   ];a.delivered=true;a.phase='draft';addEvent(s,'draft-delivered','交付两条有来源的待审稿件','仅交草稿，不发布或通知。',{nodeId:'delivery',result:{draft:a.draft,published:false},evidenceIds:['A1','A2','D1']});
  }
  if(action==='finish')s.learning.mainComplete=true;
 });
}
export const REUSE_STEPS=[
 {title:'哪些经验，值得留给下次？',node:'memory',copy:'这次稿件已经交付。偏好和方法需要你明确选择才会保存；会话历史单独留档，不等于同意保存长期偏好。'},
 {title:'开启新会话，旧工作区收起来',node:'context',copy:'新委托要求面向研发同事，核对 Atlas 的后续更新。旧整段聊天不带入；保存过的偏好会作为会话开始的资料快照，而不是训练模型。'},
 {title:'偏好便签，不会覆盖这次要求',node:'memory',copy:'查看实际保存并带入的偏好。没有保存就没有这张便签；即使有旧偏好，也不能覆盖这次明确的研发受众要求。'},
 {title:'需要这种做法时，再展开技能',node:'memory',copy:'核查方法是一份可检查的步骤卡，需要时才加载。没有保存方法就不会出现已加载的方法，读到步骤也不等于完成执行。'},
 {title:'查询历史，只取相关旧记录',node:'archive',copy:'这里查询上次关于 Atlas 的结论，不搬回整段旧聊天。旧结论只能提供线索，新变化还要读最新公告。'},
 {title:'以这次明确要求为准',node:'analysis',copy:'这次面向研发同事，稿件要突出技术变化。旧偏好可以参考，当前明确要求优先。'},
 {title:'再次提出请求，查最新公告',node:'analysis',copy:'模型输出读取 A3 新公告的请求。上次查过 A1，不代表这次已经知道后续变化。'},
 {title:'工具读回最新版本',node:'tools',copy:'工具真正读取 A3，返回带来源编号的内容。请求成功和取得可用的新版本，仍然要分开看。'},
 {title:'用新依据，更新旧结论',node:'analysis',copy:'A3 支持新增审计日志和只读权限，但申请审核条件仍在。不能沿用旧传闻，也不能把更新写成全面开放。'},
 {title:'复用的是资料与做法，不是权重',node:'delivery',copy:'新草稿以 A3 为依据，按研发受众组织重点。这次读取了什么，都留下具体记录；没有自动发布，也没有模型训练。'}
];
function reuseEffect(s,index,options={}){
 if(index===0)return once(s,'reuse-save',()=>{s.task.reuseEnabled=options.enabled!==false;if(options.preference)s.task.sessions[0].audience='general';saveExperience(s,{preference:!!options.preference,skill:!!options.skill});});
 if(index===1)return once(s,'reuse-session',()=>{
  startNewSession(s);const a=s.task.sessions[1];a.request='这周继续，给研发同事看。核查 Atlas 现在的新变化，突出技术细节，仍先给我审阅。';
  const p=s.task.library.preferences.find(x=>x.kind==='audience');if(p&&s.task.reuseEnabled){a.readings.memoryIds.push(p.id);a.context.memoryIds.push(p.id);addEvent(s,'memory-read','会话开始时带入偏好快照','已保存资料进入新会话，不覆盖当前明确要求。',{nodeId:'memory',result:{entry:p}});}
 });
 if(index<3)return [];
 return once(s,'reuse-'+index,()=>{
  const a=s.task.sessions[1],lib=s.task.library;
  if(index===3){const item=lib.skills.find(x=>x.name==='来源核验与简报');if(item&&s.task.reuseEnabled){a.readings.skillIds.push(item.id);a.context.skillIds.push(item.id);addEvent(s,'skill-read','按需展开核查步骤','读取方法，不是已经执行。',{nodeId:'memory',result:{entry:item}});}}
  if(index===4){const item=[...lib.history].reverse().find(x=>x.draft.some(d=>d.sources.includes('A1')));if(item&&s.task.reuseEnabled){a.readings.historyIds.push(item.id);a.context.historyIds.push(item.id);addEvent(s,'history-read','查询相关旧结论','取回相关条目，不是整个旧上下文。',{nodeId:'archive',result:{historyId:item.id,excerpt:item.draft[0]}});}}
  if(index===5){a.audience='technical';a.reuseLoaded=true;addEvent(s,'requirements-applied','采用本次研发受众要求','当前明确要求优先于旧偏好。',{nodeId:'analysis'});}
  if(index===6)requestSources(s);
  if(index===7)retrieveSources(s);
  if(index===8)verifySources(s);
  if(index===9){if(!a.verified)throw Error('先核对最新公告。');a.draft=[{title:'Atlas 预览增加审计与只读权限',claim:'A3 公告说明新增审计日志与只读权限配置；仍需申请审核。面向研发读者，应核对接口范围、权限配置与适用条件。',sources:['A3'],unknown:'完整地区范围仍未公布。'}];a.delivered=true;addEvent(s,'draft-delivered','形成面向研发的新版草稿','复用资料与方法，重新核实新事实。',{nodeId:'delivery',result:{draft:a.draft},evidenceIds:['A3']});}
 });
}
const compact={intake:'要求已发送',context:'本轮提供给模型的资料',analysis:'输出请求，或输出回答',tools:'按请求执行，返回回执',delivery:'先审阅，不自动发布',archive:'保留原始过程',memory:'偏好、方法分别保存'};
function detailFor(index,s,phase){
 const ready=phase==='holding';
 if(index===2)return ['要求：采集 AI 行业新闻，最多三条，附出处。','现在还没有搜索结果。'];
 if(index===3)return ['工具：search_news','请求：寻找 AI 行业候选新闻与原始出处。','这是一张请求卡，工具还没有执行。'];
 if(index===4)return ready?CANDIDATES.map(x=>x.id+' · '+x.title+'：'+x.text):['搜索请求已交给工具，正在演示查找过程。'];
 if(index===5)return CANDIDATES.map(x=>x.id+' · '+x.title);
 if(index===6)return ['工具：read_source','请求：读取 A1、A2 与 D1 原始材料。','当前仍只有线索，尚未取得这些原文。'];
 if(index===7)return ready?['A1：开发者预览开放申请，仍需审核。','A2：须填写用途，地区名单未完整公布。','D1：支持 PDF 与 Markdown，不是全部格式。']:['工具正在读取 A1、A2 与 D1，等待原文回执。'];
 if(index===8)return ['加入 A1/A2：申请预览 ≠ 人人已可用。','加入 D1：PDF / Markdown ≠ 所有格式。','来源编号跟随内容进入上下文。'];
 if(index===9)return ['S1 + S2 → 合并同源转载。','S3“全面开放” → A1/A2“申请仍需审核”。','D1 → 保留格式限制，最终只有两条独立新闻。'];
 if(index>=10)return ['两条独立新闻，有出处与未知项。','状态：待你审阅；没有发布。'];
 return [];
}
export function createLessonController(s,{reduced=false}={}){
 if(!restoreNewsVisit(s))throw Error('无法恢复这份教学记录。');
 let index=s.tour.lesson.index,phase='holding',elapsed=0,branch=null,saved=null,branchMotion=null;
 const pauses=new Set(s.tour.paused?['user']:[]);let lastEvents=[];
 const duration=()=>branch?.kind==='context'?branchMotion?.duration||0:branch?.kind==='failure'?4:5;
 function acknowledge(method=reduced?'static':'animated'){
  const events=branch?.kind==='reuse'?lastEvents:branch?[]:s.task.events.filter(e=>e.type===({receive:'request-received','search-request':'search-requested',search:'search-result',request:'request-created',retrieve:'tool-result',verify:'source-verified',deliver:'draft-delivered'}[STEPS[index].action])&&e.sessionId==='session-1');
  for(const ev of events)if(!s.learning.observedEventIds.includes(ev.id))s.learning.observedEventIds.push(ev.id);
  const key=branch?branch.kind+':'+(branch.index??Math.floor(branch.time||0)):'main:'+index;
  s.learning.viewRecords||=[];if(!s.learning.viewRecords.some(x=>x.key===key))s.learning.viewRecords.push({key,method,at:stamp()});
  if(!branch){s.learning.lessonSteps||=[];if(!s.learning.lessonSteps.includes(index))s.learning.lessonSteps.push(index);}
  if(branch?.kind==='context'&&branch.time>=23){s.learning.deep.context=true;recordExperiment('compression','操作长过程整理，70格改写为35格；原始记录保留。');}
  if(branch?.kind==='failure')recordExperiment('read-failure','对照读取失败的回执，未生成成功稿件。');
  if(branch?.kind==='reuse'&&branch.index===9)s.learning.deep.reuse=true;
 }
 function recordExperiment(kind,detail){if(!s.learning.experiments.some(x=>x.kind===kind))s.learning.experiments.push({kind,detail,at:stamp()});}
 function begin(){elapsed=0;phase=reduced||index<2||!branch&&index===11?'holding':'playing';if(phase==='holding')acknowledge();}
 if(index>=2&&!s.learning.lessonSteps?.includes(index))begin();
 function next(options={}){
  if(phase!=='holding'||pauses.size)return false;
  if(branch){
   if(branch.kind!=='reuse'||branch.index>=9)return false;
   const dest=branch.index+1;lastEvents=[...reuseEffect(s,branch.index===0?0:dest,options)];
   if(branch.index===0)lastEvents.push(...reuseEffect(s,1));
   branch.index=dest;begin();return true;
  }
  if(index>=STEPS.length-1)return false;
  const dest=index+1;if(dest===2&&options.submitted!==true)return false;
  effect(s,STEPS[dest].action);index=dest;s.tour.lesson.index=index;begin();return true;
 }
 function previous(){
  if(branch||index<=2)return false;
  index--;s.tour.lesson.index=index;phase='holding';elapsed=5;return true;
 }
 function tick(dt){
  if(pauses.size||phase!=='playing')return false;
  elapsed=Math.min(duration(),elapsed+Math.max(0,Math.min(dt,.1)));
  if(branchMotion&&branch?.kind==='context')branch.time=branchMotion.from+(branchMotion.to-branchMotion.from)*Math.min(1,elapsed/branchMotion.duration);
  if(elapsed>=duration()){phase='holding';if(branchMotion)branch.time=branchMotion.to;branchMotion=null;acknowledge();return true;}
  return false;
 }
 function skip(){if(phase!=='playing')return false;if(branchMotion)branch.time=branchMotion.to;elapsed=duration();branchMotion=null;phase='holding';acknowledge('result-only');return true;}
 function open(kind){
  if(phase!=='holding'||branch||pauses.size)return false;
  if(kind!=='failure'&&!s.learning.mainComplete)return false;
  if(kind==='failure'&&index!==7)return false;
  saved={index,phase,elapsed};branch=kind==='context'?{kind,time:0,loss:false,explanation:{title:'继续调查多轮，工作资料越来越多',copy:'这是同一任务继续调查多轮的独立教学分支。每次只追加一批，由你决定下一批何时进入；这些容量格不是真实Token。'}}:kind==='reuse'?{kind,index:0}:{kind:'failure'};
  if(kind==='failure')begin();else{phase='holding';elapsed=0;}return true;
 }
 function close(){if(!branch)return false;({index,phase,elapsed}=saved);branch=null;saved=null;branchMotion=null;return true;}
 function contextAction(action){
  if(branch?.kind!=='context'||phase!=='holding'||pauses.size)return false;
  if(action==='back'){branch.time=12;branch.loss=false;branch.explanation={title:'停在本次演示的70格阈值',copy:'还没装满，但下一轮回执与输出也需要空间。任务约束与近期交接将按这次选定的规则保留；由你决定何时整理。'};return true;}
  if(action==='compare'&&branch.time>=23){branch.loss=!branch.loss;branch.explanation={title:'两份摘要，少掉的条件很重要',copy:'一份保留申请审核、格式限制与草稿边界，另一份省掉了这些条件。原文还在，不等于模型这一轮已经重新读到了它。'};recordExperiment('summary-loss','对比摘要遗漏申请审核与格式限制；原始依据仍在。');return true;}
  let to;if(action==='add')to=[4,6,8,10,12].find(t=>t>branch.time);if(action==='compress'&&branch.time>=12&&branch.time<23)to=26;if(to===undefined)return false;
  branch.explanation=action==='compress'?{title:'把中段历史，改写成新的摘要',copy:'整理过程读中段历史，写出一份更短的新摘要。任务约束与近期交接保持原位，原始记录不删除；看完这一段后会停住。'}:to===12?{title:'再来一批，就到了本次演示阈值',copy:'这批资料会把占用推到70格，在这里停住。还没装满，但下一轮回执与输出也需要预留空间；不会自动开始整理。'}:{title:'只追加这一批，之后停下来',copy:'新的查询结果加入当前工作资料。旧交接逐步成为历史，最近交接继续保留；下一批要等你点击才会进入。'};
  branchMotion={from:branch.time,to,duration:action==='compress'?6:4};elapsed=0;phase=reduced?'holding':'playing';
  if(reduced){branch.time=to;branchMotion=null;acknowledge();}return true;
 }
 function snapshot(){
  let step=STEPS[index],lines=detailFor(index,s,phase),focus=step.node,flow=step.flow,context=null,extra=null;
  const visible=[...new Set(['intake',...STEPS.slice(2,index+1).map(x=>x.node)])];
  if(branch?.kind==='failure'){step={title:'如果这次没有读到原文呢？',copy:'错误回执返回后，没有可用的新原文。可以换来源，或停止并说明缺口；不能沿用成功路径交付同样的稿件。',node:'tools'};focus='tools';flow=['tools','context','失败回执'];lines=['读取失败：没有取得可用原文。','本分支没有成功草稿。'];}
  if(branch?.kind==='context'){
   context=sampleContextDemo(branch.time,{loss:branch.loss});focus='context';flow=null;
   step=branch.explanation;
   lines=[context.time>=20?'新摘要：'+context.summary.text:'尚未整理：每张卡片代表一段工作资料。','原始记录：'+context.archiveIds.length+'片，来源编号保留。','100格容量、70格阈值是本次演示设置，不是Hermes默认值。'];
  }
  if(branch?.kind==='reuse'){
   step=REUSE_STEPS[branch.index];focus=step.node;if(!visible.includes('memory'))visible.push('memory');if(branch.index>=4&&!visible.includes('archive'))visible.push('archive');
   const a=s.task.sessions[1],lib=s.task.library,p=lib.preferences.find(x=>x.kind==='audience'),skill=lib.skills.find(x=>x.name==='来源核验与简报');
   const i=branch.index;flow=i===1?null:i===2&&a?.readings.memoryIds.length?['memory','context','会话开始的偏好快照']:i===3&&a?.readings.skillIds.length?['memory','context','按需加载方法']:i===4&&a?.readings.historyIds.length?['archive','context','历史查询回执']:i===6?['context','analysis','新要求']:i===7?['analysis','tools','读取 A3']:i===8?['tools','context','A3 经上下文回填']:i===9?['analysis','delivery','新的草稿']:null;
   lines=i===0?['偏好与方法默认不选。','不保存偏好和方法，仍可独立保存会话历史。']:i===1?['新委托：给研发同事看，核对 Atlas 最新变化。','旧整段聊天退出当前输入。']:i===2?[p?'实际带入偏好：'+(p.value==='technical'?'面向研发读者':p.value==='business'?'面向业务读者':'面向普通读者'):'未保存偏好：实际带入0条。']:i===3?skill?skill.steps:['未保存核查方法：实际加载0份。']:i===4?['只取回上次 Atlas 的相关结论，不带全部聊天。']:i===5?['当前要求：研发受众，优先于旧偏好。']:i===6?['请求：read_source(A3)，尚未实际读取。']:i===7?[phase==='holding'?'A3：新增审计日志和只读权限，仍需申请审核。':'工具正在读取 A3 新公告。']:i===8?['新依据：A3；不能只凭旧版 A1 回答本周变化。']:['新草稿已交付，依据 A3。','实际读取：偏好 '+(a?.readings.memoryIds.length||0)+' · 方法 '+(a?.readings.skillIds.length||0)+' · 历史 '+(a?.readings.historyIds.length||0)];
   if(i===2&&!a?.readings.memoryIds.length)lines=[p?'已保存偏好，但本次关闭跨会话读取，实际带入0条。':'未保存偏好：实际带入0条。'];
   if(i===3){const actual=s.task.events.find(e=>e.type==='skill-read'&&e.sessionId===a?.id)?.result.entry;lines=actual?actual.steps:[skill?'已保存方法，但本次关闭跨会话读取，实际加载0份。':'未保存核查方法：实际加载0份。'];}
   if(i===4){const actual=s.task.events.find(e=>e.type==='history-read'&&e.sessionId===a?.id)?.result.excerpt;lines=actual?['查询：上次 Atlas 申请预览。','取回旧结论：'+actual.claim,'旧依据：'+actual.sources.join('、')+'。这次仍需查最新版本。']:['本次关闭跨会话读取，实际检索0条旧记录。'];}
   extra=i===9?a?.draft:null;
  }
  const progress=phase==='holding'?1:Math.min(1,elapsed/Math.max(1,duration()));
  const windowTitle=branch?.kind==='reuse'&&branch.index===2?'记忆 · 偏好便签':branch?.kind==='reuse'&&branch.index===3?'技能 · 核查步骤卡':branch?.kind==='reuse'&&branch.index===4?'历史 · 查询回执':context?'当前上下文的变化':LABELS[focus];
  return {index,stepId:branch?.kind==='reuse'?'reuse-'+branch.index:branch?.kind==='context'?'context':branch?.kind==='failure'?'read-failure':step.id,title:step.title,windowTitle,copy:step.copy,phase,elapsed,progress,paused:pauses.size>0,pauseReasons:[...pauses],branch:clone(branch),visibleNodeIds:visible,focusNodeId:focus,flow:flow||null,lines,context,compact:clone(compact),draft:extra||(!branch&&index>=10?s.task.sessions[0].draft:null),mainComplete:s.learning.mainComplete,canNext:phase==='holding'&&!pauses.size&&(!branch?index<11:branch.kind==='reuse'&&branch.index<9),canPrevious:!branch&&index>2,flowMeaning:'本步传递方向示意，不代表重复执行'};
 }
 return {snapshot,next,previous,tick,skip,open,close,contextAction,replay(){if(index<2)return false;begin();return true;},setReduced(value){reduced=value;if(value)skip();},setPause(reason,value){value?pauses.add(reason):pauses.delete(reason);if(reason==='user')s.tour.paused=value;},reviseMethod(steps){const item=s.task.library.skills.find(x=>x.name==='来源核验与简报');if(!item)throw Error('这次没有保存方法。');return reviseSkill(s,item.id,steps);}};
}
