import {REQUEST,LABELS,NEWS_ACTIVE,createNewsVisit,restoreNewsVisit,createLessonController,questionsFor} from './news-lesson.mjs';
import {createLessonStage} from './lesson-stage.mjs';
import {read,writeBatch,listRecords,listVisits,listLegacy} from './store.mjs';
import {QUIZ,REVIEW_QUIZ} from './content.mjs';
import {SOURCES,scoreQuiz} from './engine.mjs';
import {escapeHTML as e,download as saveBlob,reportHTML as oldReportHTML} from './report.mjs';
import {newsReportBody,newsReportHTML,newsCertificate,canReceiveMemento} from './news-report.mjs';
const $=q=>document.querySelector(q),panel=$('#panel'),body=$('#panel-body');
let visit=restoreNewsVisit(await read(NEWS_ACTIVE).catch(()=>null)),controller=null,active=false,scene=null,textOnly=false,last=performance.now(),signature='',storageWarned=false,saving=Promise.resolve(),toastTimer,modalKind='',lastFocus=null,starting=false;
let reduced=matchMedia('(prefers-reduced-motion: reduce)').matches,dark=false,draftChoices={preference:false,skill:false,enabled:true};
try{dark=localStorage.getItem('hh-factory-theme')==='dark';reduced||=localStorage.getItem('hh-factory-reduced')==='true';}catch{}
function theme(value){dark=value;document.body.classList.toggle('dark',value);scene?.theme(value);try{localStorage.setItem('hh-factory-theme',value?'dark':'light');}catch{}}
function toast(message){$('#toast').textContent=message;$('#toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').hidden=true,5000);}
function saveFile(name,content,type){try{saveBlob(content,type,name);}catch(error){toast('导出未完成：'+error.message);}}
theme(dark);$('#request').value=REQUEST;$('#resume').hidden=!visit;
try{scene=createLessonStage($('#stage'));scene.theme(dark);scene.setReduced(reduced);}catch{textOnly=true;document.body.classList.add('text-stage');}
async function persist(){if(!visit)return;const copy=structuredClone(visit);saving=saving.catch(()=>{}).then(()=>writeBatch([[NEWS_ACTIVE,copy],['newsroom-v1-history:'+copy.id,copy]])).catch(()=>{if(!storageWarned){storageWarned=true;toast('本机存档未成功，可以继续；请导出报告保留当前记录。');}});return saving;}
function show(screen){for(const id of ['brief','compose','lesson'])$('#'+id).hidden=id!==screen;active=screen==='lesson';$('#pause').hidden=!active;document.body.dataset.screen=screen;}
function attach(){controller=createLessonController(visit,{reduced:reduced||textOnly});controller.setPause('hidden',document.hidden);signature='';}
$('#start').onclick=async()=>{if(starting)return;starting=true;$('#start').disabled=true;try{if(visit)await persist();visit=createNewsVisit();draftChoices={preference:false,skill:false,enabled:true};attach();show('compose');persist();$('#request').focus();}finally{starting=false;$('#start').disabled=false;}};
$('#resume').onclick=()=>{attach();if(visit.tour.lesson.index===1)show('compose');else{show('lesson');render();$('#lesson-title').focus({preventScroll:true});}};
$('#compose-back').onclick=()=>{show('brief');$('#resume').hidden=!visit;};
$('#request-form').onsubmit=event=>{event.preventDefault();if(!controller||controller.snapshot().index!==1)return;controller.next({submitted:true});show('lesson');render();$('#lesson-title').focus({preventScroll:true});persist();};
function drawDraft(items){return (items||[]).map(item=>'<article class="draft-item"><h3>'+e(item.title)+'</h3><p>'+e(item.claim)+'</p><small>未知：'+e(item.unknown||'尚未说明')+'</small>'+item.sources.map(id=>'<button class="source-button" data-source="'+e(id)+'">来源 '+e(id)+'</button>').join('')+'</article>').join('');}
function bindSources(root){for(const b of root.querySelectorAll('[data-source]'))b.onclick=()=>{const src=SOURCES.find(x=>x.id===b.dataset.source);openPanel('source',src?.title||'原始材料');body.innerHTML='<p>'+e(src?.text||'未找到这份原文。')+'</p><p class="fine">编号 '+e(src?.id||'')+' · 固定虚构教材，不是实时公告。</p>';};}
function render(){
 if(!controller||!active)return;const x=controller.snapshot();document.body.dataset.context=String(!!x.context);document.body.dataset.step=x.stepId;document.body.dataset.phase=x.phase;document.body.dataset.events=String(visit.task.events.length);
 $('#lesson-title').textContent=x.title;$('#lesson-copy').textContent=x.copy;$('#window-title').textContent=x.windowTitle||'当前窗口';
 $('#window-status').textContent=x.phase==='playing'?'本步演示中':'停留阅读';
 $('#window-lines').innerHTML=x.branch?.kind==='reuse'&&x.branch.index===3&&visit.task.sessions[1]?.readings.skillIds.length?'<ol>'+x.lines.map(t=>'<li>'+e(t)+'</li>').join('')+'</ol>':x.lines.map(t=>'<p>'+e(t)+'</p>').join('');$('#draft').innerHTML=drawDraft(x.draft);bindSources($('#draft'));
 $('#scene-status').textContent=x.paused?'动态已暂停，当前步骤保留':x.phase==='playing'?'这一段演示结束后会停住，不会进入下一步':'停在这一步，读懂后再继续';
 $('#flow-caption').textContent=x.flow?x.flow[2]+' · 传递示意，不重复执行工具':x.context?'独立教学分支 · 原始记录不删除':'';
 $('#back').disabled=!x.canPrevious;$('#next').disabled=!x.canNext;$('#next').hidden=x.index===11&&!x.branch||!!x.branch&&x.branch.kind!=='reuse'||x.branch?.kind==='reuse'&&x.branch.index===9;
 $('#next').textContent=x.branch?.kind==='reuse'&&x.branch.index===0?'确认保存选择，开启新会话 →':'下一步 →';$('#skip').hidden=x.phase!=='playing';$('#branch-close').hidden=!x.branch;
 $('#why').textContent='为什么';$('#replay').hidden=!!x.branch&&x.branch.kind==='context';$('#pause').textContent=visit.tour.paused?'恢复动态':'暂停动态';$('#pause').setAttribute('aria-pressed',String(!!visit.tour.paused));
 $('#transfer').hidden=!(x.index===11&&!x.branch);$('#deeper').hidden=!(x.index===11&&!x.branch);$('#transfer-feedback').textContent=visit.learning.transferFeedback||'';
 for(const button of document.querySelectorAll('[data-deep]'))button.disabled=x.phase!=='holding'||x.paused;
 const controls=$('#branch-controls');controls.replaceChildren();
 if(x.index===7&&x.phase==='holding'&&!x.branch){controls.innerHTML='<button id="failure">如果这次读取失败呢？</button>';$('#failure').onclick=()=>{controller.open('failure');render();};}
 if(x.branch?.kind==='context'){
  controls.innerHTML='<button id="context-add">追加一批</button><button id="context-compress">整理中部</button><button id="context-back">回到阈值</button><button id="context-compare">'+(x.branch.loss?'恢复保留条件的摘要':'比较遗漏条件的摘要')+'</button>';
  for(const action of ['add','compress','back','compare'])$('#context-'+action).onclick=event=>{if(event.detail>1)return;controller.contextAction(action);render();if(controller.snapshot().phase==='holding')capture();persist();};
  $('#context-add').disabled=x.paused||x.phase!=='holding'||x.branch.time>=12;$('#context-compress').disabled=x.paused||x.phase!=='holding'||x.branch.time<12||x.branch.time>=23;$('#context-back').disabled=x.paused||x.phase!=='holding'||x.branch.time<12;$('#context-compare').disabled=x.paused||x.phase!=='holding'||x.branch.time<23;
 }
 if(x.branch?.kind==='reuse'&&x.branch.index===0){
  const choice=visit.task.sessions[0].experienceDecision;
  controls.innerHTML='<label><input id="save-preference" type="checkbox" '+((choice?.preference??draftChoices.preference)?'checked':'')+(choice?' disabled':'')+'>保存偏好：自媒体稿面向普通读者</label><label><input id="save-skill" type="checkbox" '+((choice?.skill??draftChoices.skill)?'checked':'')+(choice?' disabled':'')+'>保存来源核查方法</label><label><input id="reuse-enabled" type="checkbox" '+((choice?visit.task.reuseEnabled:draftChoices.enabled)?'checked':'')+(choice?' disabled':'')+'>本次使用跨会话资料</label><p class="branch-note">偏好与方法默认不保存。关闭本次读取后，按本案例的最小配置运行，不代表其他Agent的能力上限。历史单独留档。</p>'+(choice?.skill?'<button id="edit-method">检查或修订已保存的方法</button>':'');
  for(const [id,key]of [['save-preference','preference'],['save-skill','skill'],['reuse-enabled','enabled']])$('#'+id).onchange=event=>{draftChoices[key]=event.target.checked;};
  if($('#edit-method')){if(visit.task.sessions[1]?.readings.skillIds.length)$('#edit-method').hidden=true;else $('#edit-method').onclick=editMethod;}
 }
 if(x.branch?.kind==='reuse'&&x.branch.index===2&&visit.task.library.skills.length&&!visit.task.sessions[1]?.readings.skillIds.length){controls.innerHTML='<button id="edit-method">检查或修订即将读取的方法</button>';$('#edit-method').onclick=editMethod;}
 scene?.render(x);signature=key(x);
}
function key(x){return [x.index,x.phase,x.paused,x.branch?.kind,x.branch?.index,x.context?.units,x.branch?.loss,!!x.draft].join(':');}
function advance(event){if(!controller||event?.detail>1)return;const options={preference:!!$('#save-preference')?.checked,skill:!!$('#save-skill')?.checked,enabled:$('#reuse-enabled')?.checked!==false};if(controller.next(options)){render();if(controller.snapshot().phase==='holding')capture();persist();$('#lesson-title').focus({preventScroll:true});$('#lesson-title').scrollIntoView({block:'start',behavior:'instant'});}}
$('#next').onclick=advance;$('#back').onclick=()=>{controller.previous();render();$('#lesson-title').focus({preventScroll:true});persist();};$('#skip').onclick=()=>{controller.skip();render();capture();persist();};$('#replay').onclick=()=>{controller.replay();render();};
$('#branch-close').onclick=()=>{controller.close();render();$('#lesson-title').focus({preventScroll:true});persist();};
$('#pause').onclick=()=>{controller.setPause('user',!visit.tour.paused);render();persist();};
$('#theme').onclick=()=>theme(!dark);
for(const b of document.querySelectorAll('[data-deep]'))b.onclick=()=>{if(controller.open(b.dataset.deep)){render();$('#lesson-title').scrollIntoView({block:'start',behavior:'instant'});}};
for(const b of document.querySelectorAll('[data-answer]'))b.onclick=()=>{const good=b.dataset.answer==='no';visit.learning.transferFeedback=good?'对。读到了内容，不等于回答了这次的新变化。':'还需要核实新版本，或说明目前缺少依据。';visit.learning.notes.push('迁移判断：'+(good?'识别旧版本不足':'选择旧版本可交稿'));$('#transfer-feedback').textContent=visit.learning.transferFeedback;persist();};
$('#end').onclick=async()=>{await persist();show('brief');$('#resume').hidden=false;$('#start').focus();};
function openPanel(kind,title){modalKind=kind;lastFocus=document.activeElement;$('#panel-title').textContent=title;body.replaceChildren();controller?.setPause('panel',true);if(!panel.open)panel.showModal();render();}
function closePanel(){panel.close();controller?.setPause('panel',false);modalKind='';render();if(lastFocus?.isConnected)lastFocus.focus();else if(active)$('#lesson-title').focus({preventScroll:true});else if(!$('#compose').hidden)$('#request').focus();else $('#start').focus();}
$('#panel-close').onclick=closePanel;panel.addEventListener('cancel',event=>{event.preventDefault();closePanel();});
$('#why').onclick=()=>{
 const x=controller.snapshot(),focus=x.focusNodeId;openPanel('questions','为什么 · '+(LABELS[focus]||'这一步'));
 const items=questionsFor(x);
 body.innerHTML='<p class="fine">已编辑的问题，不是实时聊天。关闭后回到原步骤和原画面。</p><div class="question-list">'+items.slice(0,2).map(q=>'<button data-question="'+e(q.id)+'">'+e(q.q)+'</button>').join('')+'</div><details><summary>更多问题</summary><div class="question-list">'+items.slice(2).map(q=>'<button data-question="'+e(q.id)+'">'+e(q.q)+'</button>').join('')+'</div></details><div id="answer" class="answer" hidden></div>';
 for(const b of body.querySelectorAll('[data-question]'))b.onclick=()=>{const q=items.find(q=>q.id===b.dataset.question);$('#answer').hidden=false;$('#answer').innerHTML=[q.answer,q.evidence,q.boundary].map(v=>'<p>'+e(v)+'</p>').join('');if(!visit.learning.questions.some(t=>t.id===q.id))visit.learning.questions.push({id:q.id,question:q.q,answer:q.answer,stepId:x.stepId,at:new Date().toISOString()});persist();};
};
$('#more').onclick=()=>{
 openPanel('settings','观察与本机记录');body.innerHTML='<label class="setting"><input id="reduced" type="checkbox" '+(reduced?'checked':'')+'>减少动态效果</label><label class="setting"><input id="text-only" type="checkbox" '+(textOnly?'checked':'')+'>使用等价文字观察</label><p class="fine">只影响本机呈现；不会代替你点击下一步。数据与截图不上传。</p><div class="menu"><button id="records">历次本机记录</button><button id="take-record" '+(!visit?'disabled':'')+'>当前学习记录</button><button id="basis">原理与教学边界</button><a href="../library.html">十八章图文资料</a></div>';
 $('#reduced').onchange=event=>{reduced=event.target.checked;controller?.setReduced(reduced||textOnly);scene?.setReduced(reduced||textOnly);try{localStorage.setItem('hh-factory-reduced',String(reduced));}catch{}render();};
 $('#text-only').onchange=event=>{textOnly=event.target.checked;document.body.classList.toggle('text-stage',textOnly);controller?.setReduced(reduced||textOnly);scene?.setReduced(reduced||textOnly);render();};
 $('#records').onclick=records;$('#take-record').onclick=()=>report(visit);$('#basis').onclick=async()=>{openPanel('basis','原理与教学边界');body.innerHTML='<p>模型输出动作请求，运行时调度工具，回执回填上下文，再继续请求模型。本页是固定教学脚本，不是隐藏推理或真实模型回放。</p><p>素材、搜索结果和稿件均为虚构。上下文容量、阈值和保护范围是本次教学设置；保存资料与技能不是权重训练。</p>';try{const r=await fetch('./claims.json');if(!r.ok)return;const inventory=await r.json();body.insertAdjacentHTML('beforeend','<details><summary>沿用固定版本的维护依据</summary>'+inventory.claims.filter(c=>c.type==='implementation').map(c=>'<p>'+e(c.statement)+'<br><small>'+e(c.version?.tag||'')+' · '+e(c.reviewedAt||'未标核对日期')+'</small></p>').join('')+'</details>');}catch{body.insertAdjacentHTML('beforeend','<p>未能加载维护依据；不宣称本轮重新核对了官方实现。</p>');}};
};
function editMethod(){const skill=visit.task.library.skills.find(x=>x.name==='来源核验与简报');openPanel('method','修订核查方法');body.innerHTML='<p>修改可读的步骤，不是训练模型。每行一步，最多10步。</p><textarea id="method" rows="6">'+e(skill.steps.join('\n'))+'</textarea><p id="method-error" class="error" role="alert"></p><button id="method-save" class="primary">保存这次修订</button>';$('#method-save').onclick=()=>{try{controller.reviseMethod($('#method').value.split('\n').map(x=>x.trim()).filter(Boolean));persist();closePanel();}catch(error){$('#method-error').textContent=error.message;}};}
async function records(){
 openPanel('records','历次本机记录');body.innerHTML='<p>正在读取本机存档…</p>';
 const [raw,old,legacy]=await Promise.all([listRecords(),listVisits(),listLegacy()]).catch(()=>[[],[],[]]);if(modalKind!=='records')return;
 const map=new Map();for(const {key,value}of raw){const v=restoreNewsVisit(value);if(v&&(!map.has(v.id)||key===NEWS_ACTIVE))map.set(v.id,v);}const current=[...map.values()].sort((a,b)=>b.startedAt.localeCompare(a.startedAt)),past=legacy.filter(r=>!restoreNewsVisit(r.value));
 body.innerHTML='<p class="fine">旧记录只读保留，不继承新版完成状态。</p>'+current.map((v,i)=>'<article class="record"><strong>逐步新闻任务 · '+e(new Date(v.startedAt).toLocaleString('zh-CN'))+'</strong><p>'+(v.learning.mainComplete?'主线完成':'主线未完成')+'</p><button data-news="'+i+'">查看学习报告</button><button data-json="'+i+'">下载原始JSON</button></article>').join('')+old.map((v,i)=>'<article class="record"><strong>旧版观察记录 · '+e(v.profile.nickname)+'</strong><p>旧版五章报告，只读</p><button data-old="'+i+'">下载旧报告HTML</button></article>').join('')+past.map((r,i)=>'<article class="record"><strong>'+e(r.metadata.label)+'</strong><p>'+e(r.metadata.reason)+'</p><button data-legacy="'+i+'">下载原始JSON</button></article>').join('')||'<p>尚无本机记录。</p>';
 for(const b of body.querySelectorAll('[data-news]'))b.onclick=()=>report(current[Number(b.dataset.news)]);
 for(const b of body.querySelectorAll('[data-json]'))b.onclick=()=>saveFile('hello-hermes-'+current[Number(b.dataset.json)].id+'.json',JSON.stringify(current[Number(b.dataset.json)],null,2),'application/json');
 for(const b of body.querySelectorAll('[data-old]'))b.onclick=()=>{const v=old[Number(b.dataset.old)];saveFile('hello-hermes-legacy-'+v.id+'.html',oldReportHTML(v),'text/html');};
 for(const b of body.querySelectorAll('[data-legacy]'))b.onclick=()=>saveFile('hello-hermes-legacy-'+b.dataset.legacy+'.json',JSON.stringify(past[Number(b.dataset.legacy)].value,null,2),'application/json');
}
function report(record){
 openPanel('report','带走这次学习');body.innerHTML='<div class="menu"><button id="download-report">下载报告HTML</button><button id="print-report">打印 / PDF</button><button id="quiz-open" '+(record!==visit?'disabled':'')+'>可选：六题自测</button>'+(canReceiveMemento(record)?'<button id="certificate">学习纪念图</button>':'')+'</div><p class="fine">自测包含上下文与跨会话知识，可以先体验深入；不做也能结束。</p>'+newsReportBody(record);
 $('#download-report').onclick=()=>saveFile('hello-hermes-'+record.id+'.html',newsReportHTML(record),'text/html');$('#print-report').onclick=()=>window.print();$('#quiz-open').onclick=quiz;
 if($('#certificate'))$('#certificate').onclick=()=>{const url=newsCertificate(record),bytes=Uint8Array.from(atob(url.split(',')[1]),ch=>ch.charCodeAt(0));saveFile('hello-hermes-memento.png',bytes,'image/png');};
}
$('#report-open').onclick=()=>report(visit);
function quiz(){
 const bank=visit.learning.attempts.length?REVIEW_QUIZ:QUIZ;openPanel('quiz','可选自测 · 没有倒计时');body.innerHTML='<p class="fine">首次与复习成绩分别保存；本机纪念规则为主线完成且自测达到80分，不代表能力认证。</p><form id="quiz-form">'+bank.map((q,i)=>'<fieldset class="quiz-item"><legend>'+(i+1)+'. '+e(q.question)+'</legend>'+q.options.map((option,k)=>'<label><input type="radio" name="'+e(q.id)+'" value="'+k+'">'+e(option)+'</label>').join('')+'</fieldset>').join('')+'<p id="quiz-error" class="error" role="alert"></p><button class="primary" type="submit">提交这次自测</button></form>';
 $('#quiz-form').onsubmit=event=>{event.preventDefault();const answers={};for(const q of bank){const input=body.querySelector('input[name="'+q.id+'"]:checked');if(input)answers[q.id]=Number(input.value);}try{const result=scoreQuiz(visit,bank,answers,{review:visit.learning.attempts.length>0});persist();openPanel('quiz-result','这次作答结果');body.innerHTML='<h3>'+result.score+' / 100</h3>'+bank.map(q=>'<article class="record"><strong>'+e(q.question)+'</strong><p>'+(answers[q.id]===q.answer?'本题答对。':'本题需要复习。')+e(q.explanation)+'</p></article>').join('')+'<button id="back-report">回到学习记录</button>';$('#back-report').onclick=()=>report(visit);}catch(error){$('#quiz-error').textContent=error.message;}};
}
function capture(){
 if(!visit||!controller||!active)return;const x=controller.snapshot(),slot=x.branch?x.branch.kind==='context'&&x.context?.time>=23?'context':x.branch.kind==='reuse'&&x.branch.index===9?'reuse':null:[4,8,10].includes(x.index)?'main-'+x.index:null;
 if(!slot||visit.learning.photos.some(p=>p.slot===slot))return;
 if(textOnly||!scene){if(!visit.learning.photoFailures.some(p=>p.slot===slot))visit.learning.photoFailures.push({slot,reason:'文字模式未捕获实景，没有使用概念图替代。'});return;}
 try{scene.render(x);const image=scene.capture(),viewKey=x.branch?x.branch.kind+':'+(x.branch.index??Math.floor(x.branch.time||0)):'main:'+x.index,method=visit.learning.viewRecords.find(v=>v.key===viewKey)?.method;visit.learning.photos.push({slot,caption:x.title,at:new Date().toISOString(),method:method==='animated'?'慢速演示':method==='result-only'?'直接查看结果':'静态查看',...image});}catch(error){visit.learning.photoFailures.push({slot,reason:error.message});}
}
function frame(now){
 const dt=Math.min(.1,(now-last)/1000);last=now;
 if(controller&&active){const changed=controller.tick(dt),x=controller.snapshot();if(key(x)!==signature)render();scene?.render(x,dt);if(changed){capture();persist();}}
 requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
document.addEventListener('visibilitychange',()=>{last=performance.now();controller?.setPause('hidden',document.hidden);render();});
document.addEventListener('keydown',event=>{if(event.repeat&&['Enter',' '].includes(event.key)&&event.target.matches('button'))event.preventDefault();});
window.addEventListener('pagehide',()=>{persist();});show('brief');
