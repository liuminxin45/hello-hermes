import {STATIONS,QUIZ} from './content.mjs';
import {createVisit,enterStation,completeStation,askQuestion,startContextLab,compressContext,badSummary,injectCardFault,repairCards,checkQuality,acceptOrder,scoreQuiz,bestScore,isGraduate,restoreVisit,CATALOG} from './engine.mjs';
import {read,write,listVisits} from './store.mjs';
import {reportBody,reportHTML,download,certificateImage,escapeHTML as e,dateText} from './report.mjs';
const $=s=>document.querySelector(s);
let state=null,reportRecord=null,preferences=null,view=null,active=false,paused=false,elapsed=0,free=false,labOpen=false,photoTimer,toastTimer;
const recovered=await read('active').catch(()=>null);state=restoreVisit(recovered);preferences=await read('preferences').catch(()=>null);
function toast(text){$('#toast').textContent=text;$('#toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').hidden=true,4200);}
function save(){if(!state)return;$('#saved-dot').hidden=false;write('active',state).then(()=>$('#save-status').textContent='进度保存在本机').catch(()=>{$('#save-status').textContent='暂存失败，请导出报告';});}
function sync(){if(!state)return;view?.setState(state);save();document.body.dataset.station=String(state.station);document.body.dataset.visited=String(state.visited.length);document.body.dataset.orderState=state.accepted?'accepted':state.entered.includes(7)?'awaiting-acceptance':state.reserved?'assembled':'planning';}
function closeDialogs(){document.querySelectorAll('dialog[open]').forEach(d=>d.close());}
function modal(id){const d=$(id);if(!d.open)d.showModal();}
for(const b of document.querySelectorAll('[data-close]'))b.onclick=()=>b.closest('dialog').close();
for(const d of document.querySelectorAll('dialog'))d.addEventListener('click',event=>{if(event.target===d){const r=d.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)d.close();}});
try{const {createFactory}=await import('./scene.mjs');view=createFactory($('#world'),i=>visitExisting(i));document.body.dataset.webgl='ready';}
catch(error){console.warn('三维显示不可用，继续文字参观。',error.message);$('#webgl-fallback').hidden=false;document.body.dataset.webgl='unavailable';$('#free-walk').disabled=true;$('#take-photo').disabled=true;}
function setTheme(dark){document.body.classList.toggle('dark',dark);view?.theme(dark);$('#theme-toggle').setAttribute('aria-label',dark?'切换浅色主题':'切换深色主题');try{localStorage.setItem('hh-factory-theme',dark?'dark':'light');}catch{}}
let initialDark=false;try{initialDark=localStorage.getItem('hh-factory-theme')==='dark';}catch{}setTheme(initialDark);
$('.skip-link').onclick=event=>{event.preventDefault();$('#main-action').focus();};
$('#theme-toggle').onclick=()=>setTheme(!document.body.classList.contains('dark'));
if(state){$('#resume').hidden=false;$('#saved-dot').hidden=false;$('#order-open').textContent='再下一张订单 ↗';}
if(preferences?.color)$('#order-form').elements.color.value=preferences.color;
$('#order-open').onclick=()=>modal('#order-dialog');
$('#order-form').onsubmit=async event=>{
  event.preventDefault();const form=event.currentTarget,values=Object.fromEntries(new FormData(form));values.snack=form.elements.snack.checked;
  try{const next=createVisit(values);if(state)await write(`history-${state.id}`,state).catch(()=>{});state=next;active=true;paused=false;renderPause();elapsed=0;closeDialogs();sync();showTourUI();renderTour();modal('#welcome-dialog');view?.focus(0);$('#order-error').textContent='';}
  catch(error){$('#order-error').textContent=error.message;}
};
$('#look-around').onclick=()=>{view?.overview();toast('拖动可以环顾，滚轮缩放。准备好后，填写订单开始实习。');};
$('#resume').onclick=()=>{active=true;closeDialogs();showTourUI();if(state.phase==='exit'){state.phase='tour';}if(state.entered.length){runStation(state.station,false);}else modal('#welcome-dialog');};
$('#start-tour').onclick=()=>{closeDialogs();runStation(0);};
function showTourUI(){document.body.dataset.phase='tour';$('#arrival').hidden=true;$('#tour-hud').hidden=false;$('#webgl-fallback').hidden=true;}
function textFor(line){if(line!=='{inventory}')return line;return state.plan?.substituted?`库存单回来了：主题色盒子不足以做 ${state.order.quantity} 份同款。方案改成白盒加${state.order.color==='blue'?'蓝':'绿'}色腰封，每份 ${state.plan.unitCost} 元，仍符合订单。`:`库存单回来了：主题色盒体足够做 ${state.order.quantity} 份同款；每份 ${state.plan?.unitCost??0} 元。无需改包装，工厂也不编造一次缺货。`;}
const navButtons=STATIONS.map((s,i)=>{const b=document.createElement('button');b.type='button';b.textContent=String(i+1).padStart(2,'0');b.setAttribute('aria-label',`参观${s.name}`);b.title=s.name;b.onclick=()=>visitExisting(i);$('#station-nav').append(b);return b;});
function renderTour(){
  const s=STATIONS[state.station];$('#tour-section').textContent=`跟随导师 / ${String(state.station+1).padStart(2,'0')} OF 08`;
  $('#tour-title').textContent=s.name;$('#tour-subtitle').textContent=s.subtitle;
  $('#mentor-line').textContent=textFor(s.lines[state.line]);$('#line-index').textContent=`${state.line+1} / ${s.lines.length}`;
  $('#question-badge').textContent=`${s.questions.length}`;
  $('#order-summary').textContent=`${state.order.quantity} 份 · ${state.order.color==='blue'?'蓝':'绿'}色系 · ¥${state.order.budget}/份`;
  $('#order-status').textContent=state.accepted?'已验收 · 未发货':state.entered.includes(7)?'待验收 · 未发货':state.quality?.ok?'质检通过':state.quality&&!state.quality.ok?'需要补做':state.reserved?'装配完成':'正在处理';
  $('#next').textContent=state.line<s.lines.length-1?'下一段 →':state.station===7?'生成参观报告 →':'前往下一站 →';
  navButtons.forEach((b,i)=>{b.className=(i===state.station?'current ':'')+(state.visited.includes(i)?'completed':'');b.setAttribute('aria-current',i===state.station?'step':'false');b.disabled=!state.entered.includes(i);});
  renderActions();
}
function runStation(i,resetLine=true){
  if(!state)return;try{const oldLine=state.line;enterStation(state,i);if(!resetLine)state.line=Math.min(oldLine,STATIONS[i].lines.length-1);active=true;elapsed=0;closeLab(false);showTourUI();renderTour();view?.focus(i);view?.setPhase('tour');sync();clearTimeout(photoTimer);photoTimer=setTimeout(()=>capturePhoto(false),2800);}
  catch(error){paused=true;toast(error.message);renderPause();}
}
function visitExisting(i){if(!active||!state){toast('先提交一张订单，再跟导师进入车间。');return;}if(!state.entered.includes(i)){toast('这一站还没走到，先跟着订单向前参观。');return;}closeDialogs();paused=true;renderPause();runStation(i);}
function next(){
  if(!active||!state)return;
  if(state.phase==='briefing'){runStation(0);return;}
  const station=STATIONS[state.station];elapsed=0;
  if(state.line<station.lines.length-1){state.line++;renderTour();save();return;}
  if(state.station>=5&&state.cardFault){paused=true;renderPause();toast('这张卡片还没补好。先点击“补印欢迎卡”，再继续交付。');return;}
  completeStation(state,state.station);sync();
  if(state.station===7){state.phase='report';paused=true;renderPause();save();showReport();return;}
  runStation(state.station+1);
}
$('#next').onclick=next;
function renderPause(){$('#pause').textContent=paused?'继续导览':'暂停';$('#pause').setAttribute('aria-pressed',String(paused));}
$('#pause').onclick=()=>{paused=!paused;renderPause();};
$('#follow').onclick=()=>{free=false;$('#move-pad').hidden=true;$('#free-walk').setAttribute('aria-pressed','false');view?.setFree(false);view?.focus(state.station);};
$('#overview').onclick=()=>{view?.overview();free=false;$('#move-pad').hidden=true;$('#free-walk').setAttribute('aria-pressed','false');};
$('#free-walk').onclick=()=>{free=!free;view?.setFree(free);$('#move-pad').hidden=!free;$('#free-walk').setAttribute('aria-pressed',String(free));$('#free-walk').textContent=free?'退出漫游':'进入车间';if(free)toast('拖动环顾，W/A/S/D 或方向按钮移动。没有头显模式；可随时跟上导师。');};
for(const b of document.querySelectorAll('[data-move]'))b.onclick=()=>view?.move(b.dataset.move);
window.addEventListener('keydown',event=>{if(event.key==='Escape'&&free){free=false;view?.setFree(false);$('#move-pad').hidden=true;$('#free-walk').setAttribute('aria-pressed','false');}});
function capturePhoto(manual=true,title,caption){
  if(!active||!state||!view||!view.ready()){if(manual)toast('等镜头到达观察位，再拍一张。');return;}
  const s=STATIONS[state.station],key=`${state.station}-${title||'station'}`;if(!manual&&state.photos.some(p=>p.key===key))return;
  if(state.photos.length>=16){if(manual)toast('本次相册已保存 16 张，现有照片仍可导出。');return;}
  try{state.photos.push({key,title:title||s.name,caption:caption||s.photo,station:state.station,eventSeq:state.events.length,at:new Date().toISOString(),url:view.capture()});save();if(manual)toast('实景照片已放进你的参观相册。');}catch{if(manual)toast('本次没有捕获到照片，请换个角度再试。');}
}
$('#take-photo').onclick=()=>capturePhoto();
function renderActions(){
  const root=$('#station-actions');root.replaceChildren();const action=(label,fn,primary=false)=>{const b=document.createElement('button');b.type='button';b.textContent=label;if(primary)b.className='primary';b.onclick=fn;root.append(b);};
  if(state.station===2)action('打开长订单压缩实验',openLab,true);
  if(state.station===3)action('翻开本单档案',()=>info('本单会话档案',state.events.map(x=>`<div class="event-item"><b>${x.seq} / ${e(x.title)}</b><p>${e(x.detail)}</p></div>`).join('')));
  if(state.station===4){action(state.preferenceSaved?'已保存主题偏好':'为下次保存主题偏好',async()=>{preferences={color:state.order.color};try{await write('preferences',preferences);}catch{toast('偏好暂存未成功。');return;}state.preferenceSaved=true;save();renderActions();toast('主题色已保存。下次仍可在订单里明确选择其他颜色。');});action('查看装配手册',()=>info('欢迎礼盒装配手册','<ol><li>按工单领取原料，记录领取状态。</li><li>核对昵称与欢迎语，打印卡片。</li><li>装盒并返回结果。</li><li>按订单检查，再交付验收。</li></ol><p>这是本馆的固定教学技能，不是模型训练。</p>'));}
  if((state.station===5||state.station===6)&&!state.accepted){if(state.cardFault)action('补印欢迎卡，重新检查',()=>{repairCards(state);sync();renderTour();toast('只补做了卡片，没有重复扣原料。');},true);else action('模拟印卡失败',()=>{injectCardFault(state);paused=true;renderPause();sync();renderTour();toast('第一份欢迎卡缺失，质检会拦下这张订单。');});}
  if(state.station===6)action('查看本次质检',showQuality);
  if(state.station===7){action('打开礼盒看看',()=>{view?.openGifts();showDelivery();});action(state.accepted?'已确认验收':'确认验收',()=>{acceptOrder(state);sync();renderTour();toast('已确认验收；没有触发发货。');},!state.accepted);}
}
function info(title,html,eyebrow='工厂记录'){$('#info-title').textContent=title;$('#info-content').innerHTML=html;$('#info-eyebrow').textContent=eyebrow;modal('#info-dialog');}
$('#order-receipt').onclick=()=>{info('本次欢迎礼盒订单',`<p>${state.order.quantity} 份同款，${state.order.color==='blue'?'蓝':'绿'}色系，每份预算 ${state.order.budget} 元。</p><p>收件人：${state.order.names.map(e).join('、')}</p><p>欢迎语：${e(state.order.welcome)}</p><p>${state.order.snack?'包含点心':'不放食品'}；先验收，不发货。</p>${state.plan?`<p>当前方案每份 ${state.plan.unitCost} 元，合计 ${state.plan.total} 元。</p>`:''}`);};
function showQuality(){const q=checkQuality(state);info(q.ok?'本单质检通过':'还有项目需要补做',`<ul class="checks">${q.checks.map(c=>`<li>${e(c.name)}<span>${c.ok?'✓ 符合':'待补做'}</span></li>`).join('')}</ul>`);}
function showDelivery(){info('礼盒里的实际内容',`${state.gifts.map(g=>`<div class="event-item"><b>${e(g.name)}的欢迎礼盒</b><p>${g.items.map(id=>e(CATALOG[id].name)).join('、')}</p><p>欢迎卡：${e(g.card?.text||'缺失')}</p></div>`).join('')}<p>每份 ${state.plan.unitCost} 元，合计 ${state.plan.total} 元。出厂闸门保持关闭。</p>`,'交付物 / 实体模型与清单');}
$('#question-open').onclick=()=>{
  const s=STATIONS[state.station];$('#question-title').textContent=s.name;$('#question-list').replaceChildren();$('#question-answer').hidden=true;
  for(const q of s.questions){const b=document.createElement('button');b.type='button';b.textContent=q.q;b.onclick=()=>{askQuestion(state,state.station,q);save();$('#question-list').querySelectorAll('button').forEach(x=>x.classList.remove('active'));b.classList.add('active');$('#question-answer').textContent=q.a;$('#question-answer').hidden=false;};$('#question-list').append(b);}modal('#question-dialog');
};
function openLab(){startContextLab(state);state.context.viewing=true;state.context.view=state.context.after?'after':'before';labOpen=true;document.body.classList.add('lab-open');$('#context-lab').hidden=false;view?.focus(2);view?.setLab(true);renderLab();sync();setTimeout(()=>{if(labOpen&&state.context.view==='before')capturePhoto(false,'上下文实验 · 整理前','长订单教学分支占用 75 格，越过 70 格整理线；原订单未被改变。');},2700);}
function closeLab(persist=true){labOpen=false;document.body.classList.remove('lab-open');view?.setLab(false);$('#context-lab').hidden=true;if(state?.context){state.context.viewing=false;if(persist)sync();}}
$('#lab-close').onclick=()=>closeLab();
function renderLab(){const c=state.context,before=c.view==='before'||!c.after,parts=before?c.before:c.after,units=parts.reduce((sum,p)=>sum+p.units,0);$('#capacity-number').innerHTML=`${units} <small>/ 100 格</small>`;$('#capacity-state').textContent=units>70?'超过 70 格整理线':'工作摘要已提交，继续工作有余地';$('#capacity-used').style.width=`${units}%`;$('#context-parts').innerHTML=parts.map(p=>`<div class="context-part"><h3>${{rules:'常驻规则',head:'Head · 起始订单',middle:before?'中部 · 过程记录':'中部 · 工作摘要',tail:'Tail · 近期完整交接'}[p.kind]}<span>${p.units} 格</span></h3><p>${e(p.text)}</p></div>`).join('');$('#compress').disabled=!!c.after;$('#compress').textContent=c.after?'整理已完成':'整理中部记录';$('#context-before').hidden=!c.after;$('#context-before').textContent=before?'看整理后的工作台':'看整理前的工作台';}
$('#compress').onclick=()=>{capturePhoto(false,'上下文实验 · 整理前','整理前占用 75 格；Head 和 Tail 尚未改变。');compressContext(state);state.context.view='after';renderLab();sync();$('#lab-note').textContent='中部 40 格变为 10 格摘要，总占用 75 → 45。Head、Tail 原文保留；原始记录仍可回看。后续 Tail 会更新。';setTimeout(()=>{if(labOpen)capturePhoto(false,'上下文实验 · 整理后','整理后占用 45 格；压缩的是工作资料，实体原料与礼盒没有减少。');},1300);};
$('#context-before').onclick=()=>{state.context.view=state.context.view==='before'?'after':'before';renderLab();sync();};
$('#bad-summary').onclick=()=>{badSummary(state);save();info('短了，不代表足够用了',`<div class="qa-note"><h3>笼统摘要</h3><p>“包装已安排。”</p></div><div class="qa-note"><h3>现在无法回答</h3><p>采用了什么包装？为什么更换？依据是什么？哪些步骤还没完成？</p></div><p>工作摘要要保留下一步需要的条件、事实与进度。本实验只比较摘要，不会偷偷修改原订单。</p>`,'摘要丢失条件 / 对照实验');};
$('#report-open').onclick=()=>{if(!state){toast('提交订单并参观后，这里会保存报告和实景相册。');return;}showReport();};
function showReport(record=state){reportRecord=record;closeLab();$('#report-content').innerHTML=reportBody(record);$('#exam-open').disabled=record.id!==state.id||state.visited.length!==8;$('#exam-open').title=record.id!==state.id?'历史报告不改变当前实习的考核状态':state.visited.length===8?'开始十道实习题':'完成八站后开放实习测试';$('#report-certificate').hidden=record.id!==state.id||!isGraduate(state);modal('#report-dialog');}
$('#download-report').onclick=()=>download(reportHTML(reportRecord),'text/html;charset=utf-8',`Hermes-参观报告-${reportRecord.id.slice(0,8)}.html`);
$('#print-report').onclick=()=>{const tab=window.open('','_blank');if(!tab){toast('浏览器未打开打印页，可以先下载 HTML 报告再打印。');return;}tab.document.open();tab.document.write(reportHTML(reportRecord));tab.document.close();setTimeout(()=>tab.print(),350);};
$('#history-open').onclick=async()=>{const visits=await listVisits().catch(()=>[]);const records=new Map(visits.map(s=>[s.id,s]));records.set(state.id,state);info('保存在本机的历次实习',`<div id="history-list">${[...records.values()].sort((a,b)=>b.startedAt.localeCompare(a.startedAt)).map(s=>`<div class="event-item"><b>${e(s.order.nickname)} · ${e(dateText(s.startedAt))}</b><p>${s.order.quantity} 份礼盒 · 完成 ${s.visited.length}/8 站 · ${s.attempts.length?'最高 '+bestScore(s)+' 分':'未考核'}</p><button data-history="${e(s.id)}">查看这次报告</button></div>`).join('')}</div>`,'本机档案 / 仅此浏览器');for(const b of $('#history-list').querySelectorAll('button'))b.onclick=()=>{$('#info-dialog').close();showReport(records.get(b.dataset.history));};};
function quizOrder(){if(!state.quizOrder){let seed=[...state.id].reduce((n,c)=>(n*31+c.charCodeAt(0))>>>0,7);const ids=QUIZ.map(q=>q.id);for(let i=ids.length-1;i>0;i--){seed=(seed*1664525+1013904223)>>>0;const j=seed%(i+1);[ids[i],ids[j]]=[ids[j],ids[i]];}state.quizOrder=ids;}return state.quizOrder.map(id=>QUIZ.find(q=>q.id===id));}
function openExam(){if(state.visited.length!==8){toast('先走完八站，再来完成实习考核。');return;}closeDialogs();$('#exam-form').hidden=false;$('#exam-result').hidden=true;$('#exam-error').textContent='';$('#exam-questions').innerHTML=quizOrder().map((q,i)=>`<fieldset class="quiz-question"><legend>${String(i+1).padStart(2,'0')} / ${e(q.question)}</legend>${q.options.map((option,k)=>`<label><input type="radio" name="${q.id}" value="${k}" ${state.quizAnswers[q.id]===k?'checked':''}>${e(option)}</label>`).join('')}</fieldset>`).join('');modal('#exam-dialog');save();}
$('#exam-open').onclick=openExam;
$('#exam-form').onchange=event=>{const input=event.target;if(input.type==='radio'){state.quizAnswers[input.name]=Number(input.value);save();}};
$('#exam-form').onsubmit=event=>{event.preventDefault();const missing=QUIZ.filter(q=>!Number.isInteger(state.quizAnswers[q.id]));if(missing.length){$('#exam-error').textContent=`还有 ${missing.length} 道题未作答，请补充后提交。`;return;}const attempt=scoreQuiz(state,QUIZ,state.quizAnswers);save();$('#exam-form').hidden=true;$('#exam-result').hidden=false;$('#exam-result').innerHTML=`<div class="score-summary"><span class="eyebrow">本次完整成绩</span><strong>${attempt.score}<small> / 100</small></strong><p>${attempt.score>=80?'实习考核通过。你可以领取完成证明。':'还差一点。回到对应车间看看，再试一次。'}</p><p>最高成绩 ${bestScore(state)} 分 · 第 ${state.attempts.length} 次测试</p></div><div class="exam-result-actions">${isGraduate(state)?'<button id="claim-certificate" class="primary">领取实习完成证明 →</button>':''}<button id="retry-exam">再试一次</button><button id="updated-report">查看更新后的报告</button></div>${QUIZ.map(q=>{const r=attempt.details.find(x=>x.id===q.id);return `<div class="result-row"><h3>${r.correct?'✓':'○'} ${e(q.question)}</h3><p>正确答案：${e(q.options[q.answer])}</p><p>${e(q.explanation)}</p><button data-revisit="${q.station}">回访：${e(STATIONS[q.station].name)}</button></div>`;}).join('')}`;$('#claim-certificate')?.addEventListener('click',showCertificate);$('#retry-exam').onclick=()=>{state.quizAnswers={};openExam();};$('#updated-report').onclick=()=>{closeDialogs();showReport();};for(const b of $('#exam-result').querySelectorAll('[data-revisit]'))b.onclick=()=>{closeDialogs();visitExisting(Number(b.dataset.revisit));};};
function showCertificate(){if(!isGraduate(state))return;closeDialogs();$('#certificate-image').src=certificateImage(state);modal('#certificate-dialog');}
$('#report-certificate').onclick=showCertificate;
$('#download-certificate').onclick=()=>{const a=document.createElement('a');a.href=certificateImage(state);a.download=`Hermes-实习证明-${state.id.slice(0,8)}.png`;a.click();};
$('#goodbye').onclick=()=>{
  closeDialogs();closeLab();paused=true;active=false;state.phase='exit';save();$('#tour-hud').hidden=true;document.body.dataset.phase='exit';view?.arrival();$('#arrival').hidden=true;
  const old=$('.goodbye-message');old?.remove();const panel=document.createElement('section');panel.className='goodbye-message';panel.innerHTML='<p class="eyebrow">UNTIL NEXT TIME</p><h1>这次实习，<br>完成了。</h1><p>今天的礼盒交到了验收台。你也看到了目标怎样变成安排，工人怎样执行，结果怎样送回来。</p><p>谢谢你来参观。下次见。<br><small>—— 导师小赫</small></p><button id="exit-report" class="primary">带走参观报告</button><button id="another-order">再下一张订单</button>';$('#main-action').append(panel);$('#exit-report').onclick=()=>showReport();$('#another-order').onclick=()=>{panel.remove();$('#arrival').hidden=false;modal('#order-dialog');};
};
$('#about-open').onclick=()=>info('欢迎来到 Hermes Agent 工厂实习馆','<p>这里面向会用聊天 AI 的读者，用具象部件解释 Agent 的系统关系与设计取舍。无需安装 Hermes 或阅读代码。</p><p>工厂运行本地教学规则，订单、库存、工件和质量状态会实际改变。它没有连接真实模型、现实机器或物流；建筑和空间距离也不等于 Hermes 的源码分层或耗时。</p><p>压缩实验位于调度室，处理同一订单多轮沟通产生的资料。它采用独立的教学分支，不把基础礼盒制作强行变成一次上下文压缩。</p><p>实景照片、问题和成绩保存在本机。HTML 报告与 PNG 证明可导出保存。报告与原创文案 CC BY-SA 4.0；站点代码及 Three.js 为 MIT。</p><p><a href="../library.html" target="_top">阅读原图文资料 →</a></p>','关于 / 教学边界与许可');
let last=performance.now();function clock(now){requestAnimationFrame(clock);const dt=Math.min(.1,(now-last)/1000);last=now;if(active&&state&&!document.hidden)state.elapsedSeconds=(state.elapsedSeconds||0)+dt;const held=paused||labOpen||!!document.querySelector('dialog[open]')||document.hidden||!active||state?.phase!=='tour';view?.setPaused(held);$('#simulation-label').textContent=held?'教学暂停':'教学运行';if(!state||!active||held)return;elapsed+=dt*Number($('#speed').value);const line=textFor(STATIONS[state.station].lines[state.line]),duration=Math.min(36,Math.max(22,line.length/3.3));$('#reading-progress').style.transform=`scaleX(${Math.min(1,elapsed/duration)})`;if(elapsed>=duration)next();}requestAnimationFrame(clock);
window.addEventListener('pagehide',save);
