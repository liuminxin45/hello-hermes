import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createVisit,requestSources,retrieveSources,verifySources,deliverDraft,saveExperience,
  startNewSession,loadReuse,observeEvent,inspectContext,completeChapter,askQuestion,scoreQuiz
} from '../docs/public/factory/engine.mjs';
import {CHAPTERS,CORE_OBJECTIVES,QUESTIONS,QUIZ,REFLECTION,CLAIM_INFO} from '../docs/public/factory/content.mjs';
import {escapeHTML,dateText,reportBody,reportHTML,download,certificateImage} from '../docs/public/factory/report.mjs';

const image='data:image/png;base64,AAAA';
const section=(html,title,next)=>html.split('<h2>'+title+'</h2>')[1].split('<h2>'+next+'</h2>')[0];
const watch=(s,events)=>{for(const event of events)observeEvent(s,event.id);};
function firstDraft(s=createVisit()){watch(s,requestSources(s));watch(s,retrieveSources(s));watch(s,verifySources(s));watch(s,deliverDraft(s));return s;}
function fullVisit(){const s=firstDraft();inspectContext(s);watch(s,saveExperience(s,{preference:true,skill:true}));for(let i=0;i<4;i++)completeChapter(s,i);watch(s,startNewSession(s));watch(s,loadReuse(s));watch(s,requestSources(s));watch(s,retrieveSources(s));watch(s,verifySources(s));watch(s,deliverDraft(s));completeChapter(s,4);return s;}
const answers=(correct=true)=>Object.fromEntries(QUIZ.map(q=>[q.id,correct?q.answer:(q.answer+1)%q.options.length]));

test('a partial visit reports three missing real-photo slots without inventing questions or completion',()=>{
  const s=createVisit(),before=structuredClone(s),html=reportBody(s);
  const photos=section(html,'三处关键实景','我实际问过的地方');
  assert.equal((photos.match(/data-photo-slot=/g)||[]).length,3);
  assert.equal((photos.match(/未捕获 3D 实景/g)||[]).length,3);
  assert.doesNotMatch(photos,/<img/);
  assert.match(html,/0 条已发生的任务事件/);assert.match(html,/0 \/ 5 章关键观察已完成/);
  assert.match(html,/尚未开启，没有本轮读取或交付记录/);
  assert.match(html,/没有实际提问记录/);assert.match(html,/首次完整成绩<\/span><strong>未作答/);
  assert.doesNotMatch(html,/九站|9站|已掌握本|已精通/);
  assert.deepEqual(s,before);
});

test('default photo section selects the newest captured image for each slot and retains the full album in details',()=>{
  const s=createVisit();
  s.learning.photos=[
    {id:'request-old',slot:'request',title:'较早请求实景',url:image,at:'2026-10-29T01:00:00Z'},
    {id:'request-new',slot:'request',title:'最新请求实景',url:image,at:'2026-10-29T02:00:00Z'},
    {id:'context-real',slot:'context',title:'实际回放实景',url:image,replay:true,at:'2026-10-29T01:00:00Z'},
    {id:'manual',slot:'manual',title:'手动照片',url:image,at:'2026-10-29T03:00:00Z'}
  ];
  const html=reportBody(s),main=section(html,'三处关键实景','我实际问过的地方');
  assert.match(main,/最新请求实景/);assert.doesNotMatch(main,/较早请求实景|手动照片/);
  assert.match(main,/教学回放的真实场景截图/);
  assert.equal((main.match(/未捕获 3D 实景/g)||[]).length,1);
  assert.match(html,/<details><summary>全部相册与截图缺失（4 条照片记录）/);
  assert.match(html,/较早请求实景/);assert.match(html,/手动照片/);
});

test('unsafe, external, malformed and empty photo data never becomes an image source',()=>{
  const s=createVisit();
  const bad=['https://example.invalid/a.jpg','data:image/svg+xml;base64,AAAA','data:image/png;base64,','data:image/png;base64,AAAA" onerror="alert(1)','data:image/png;base64,ABC','data:text/html;base64,AAAA'];
  s.learning.photos=bad.map((url,i)=>({id:'bad'+i,slot:['request','context','reuse'][i%3],url,title:'不可用照片'}));
  s.learning.photoFailures=[{slot:'context',reason:'画布已丢失 <script>alert(1)</script>',at:'2026-10-29'}];
  const html=reportHTML(s);assert.doesNotMatch(html,/<img/);assert.doesNotMatch(html,/<script|onerror=/);
  assert.match(html,/画布已丢失 &lt;script&gt;/);assert.match(html,/图片数据不可用，未嵌入报告/);
});

test('the short question section contains only the latest three actually asked questions, with all actual answers in the appendix',()=>{
  const s=createVisit();
  for(let i=0;i<4;i++)askQuestion(s,{id:'asked-'+i,q:'实际问过 '+i,a:'实际答复 '+i});
  const html=reportBody(s),main=section(html,'我实际问过的地方','我怎样解释这次参观');
  assert.doesNotMatch(main,/实际问过 0|实际答复 0/);
  for(let i=1;i<4;i++){assert.match(main,new RegExp('实际问过 '+i));assert.match(main,new RegExp('实际答复 '+i));}
  assert.match(html,/<details><summary>全部实际追问（4 条）/);assert.match(html,/实际答复 0/);
  assert.doesNotMatch(html,new RegExp(escapeHTML(QUESTIONS[0].q)));
});

test('both delivered session results and the actual read records are reported separately',()=>{
  const s=fullVisit(),html=reportBody(s),main=section(html,'两次委托的结果','三处关键实景');
  assert.equal((main.match(/已完成馆内草稿/g)||[]).length,2);
  assert.match(main,/Atlas开放开发者预览申请/);assert.match(main,/Delta新增两类文档检索/);
  assert.match(main,/Atlas预览新增审计与权限配置/);
  for(const event of s.task.events.filter(x=>['memory-read','skill-read','history-read'].includes(x.type)))assert.ok(main.includes(event.id));
  assert.match(main,/研发同事，按当前要求突出技术细节/);
  assert.match(html,/已观察/);assert.match(html,/已完成对照/);assert.match(html,/通过自测/);
});

test('rejecting optional saving produces no claimed preference or skill read in the next-session report',()=>{
  const s=firstDraft();watch(s,saveExperience(s,{preference:false,skill:false}));watch(s,startNewSession(s));watch(s,loadReuse(s));
  const html=reportBody(s),main=section(html,'两次委托的结果','三处关键实景');
  assert.match(main,/受众偏好未选择保存；核查方法未选择保存/);
  assert.doesNotMatch(main,/读取已保存的受众偏好|按需读取核查手册/);
  assert.match(main,/检索上次关于Atlas的记录/);
});

test('first score including zero is kept separately from a better review score',()=>{
  const s=fullVisit();scoreQuiz(s,QUIZ,answers(false));scoreQuiz(s,QUIZ,answers(),{review:true});
  const html=reportBody(s),main=section(html,'首次作答与复习结果','接下来可以读什么');
  assert.match(main,/首次完整成绩<\/span><strong>0 \/ 100/);
  assert.match(main,/含复习的最佳成绩<\/span><strong>100 \/ 100/);
  assert.match(main,/满足领取实习完成证明的条件/);
  assert.match(html,/首次完整作答 · 0 \/ 100/);assert.match(html,/第 2 次完整作答 · 100 \/ 100/);
});

test('personal reflection and self-assessment are preserved without turning self-reported checks into mastery',()=>{
  const s=createVisit();s.learning.reflection='我看到保存和读取分开；旧资料还需核查。';s.learning.selfAssessment=[0,REFLECTION.checklist[2]];
  const html=reportBody(s),main=section(html,'我怎样解释这次参观','首次作答与复习结果');
  assert.match(main,/我看到保存和读取分开/);
  assert.equal((main.match(/>已自评确认：/g)||[]).length,2);
  assert.equal((main.match(/>尚未自评确认：/g)||[]).length,1);
  assert.match(main,/不由模型自动判分/);
  s.learning.selfAssessment={selected:[1]};
  assert.equal((section(reportBody(s),'我怎样解释这次参观','首次作答与复习结果').match(/>已自评确认：/g)||[]).length,1);
});

test('export escapes nicknames, reflections, questions, event payloads and photo descriptions with no executable markup',()=>{
  const attack='</title><script>alert("x")</script><img src=x onerror=alert(1)>';
  const s=createVisit();s.profile.nickname=attack;s.learning.reflection=attack;
  askQuestion(s,{id:'evil',q:attack,a:attack});requestSources(s);s.task.events[0].input={raw:attack};
  s.learning.photos=[{id:'safe',slot:'request',url:image,title:attack,caption:attack}];
  const html=reportHTML(s);assert.doesNotMatch(html,/<script|<img src=x|<\/title><script/);
  assert.ok(html.includes(escapeHTML(attack)));assert.match(html,/&lt;script&gt;/);
  assert.equal((html.match(/<img src="data:image\/png;base64,AAAA"/g)||[]).length,2);
  assert.match(html,/<style>/);assert.doesNotMatch(html,/<link[^>]+stylesheet|<script[^>]+src|<img[^>]+src="https?:/);
});

test('the appendix records schema, scenario, claim types and the actual source versions',()=>{
  const s=createVisit(),html=reportBody(s);
  assert.match(html,/记录 schemaVersion<\/dt><dd>3/);assert.ok(html.includes(s.scenarioVersion));
  for(const type of ['通用原理','Hermes 实现','教学模拟'])assert.ok(html.includes(type));
  const version=Object.values(CLAIM_INFO).find(x=>x.type==='implementation').version;
  assert.ok(html.includes(version.tag));assert.ok(html.includes(version.commit));
  assert.match(html,/没有真实模型调用/);assert.match(html,/来源核对不代表游客学习效果已验证/);
  assert.match(html,/<details><summary>全部事件与资料流/);
});

test('next-reading suggestions refer to core objective links and distinguish missing observations from wrong answers',()=>{
  const s=createVisit(),html=reportBody(s),main=section(html,'接下来可以读什么','参观附录');
  assert.match(main,/尚无对应的观察记录/);
  for(const objective of CORE_OBJECTIVES.slice(0,3))assert.ok(main.includes('https://liuminxin45.github.io'+objective.nextReading));
  const finished=fullVisit();const wrong=answers();wrong[QUIZ[0].id]=(QUIZ[0].answer+1)%QUIZ[0].options.length;scoreQuiz(finished,QUIZ,wrong);
  assert.match(section(reportBody(finished),'接下来可以读什么','参观附录'),/最近一次作答在此有误/);
  const unobserved=createVisit(),lastWrong=answers();lastWrong[QUIZ.at(-1).id]=(QUIZ.at(-1).answer+1)%QUIZ.at(-1).options.length;scoreQuiz(unobserved,QUIZ,lastWrong);
  const suggested=section(reportBody(unobserved),'接下来可以读什么','参观附录');
  assert.ok(suggested.indexOf('O6 ·')<suggested.indexOf('O1 ·'),'an incorrect answer takes priority over unrelated unobserved objectives');
});

test('old and malformed records cannot silently receive a current report',()=>{
  const s=createVisit();for(const old of [{version:1},{version:2},{...s,scenarioVersion:'old-v3'},{...s,learning:{}}]){
    const before=structuredClone(old);assert.throws(()=>reportBody(old),/历史存档/);assert.throws(()=>reportHTML(old),/历史存档/);assert.deepEqual(old,before);
  }
});

test('certificate requires all five chapters and a passing core assessment; an empty nickname is allowed',()=>{
  const s=createVisit();scoreQuiz(s,QUIZ,answers());assert.throws(()=>certificateImage(s),/五章观察/);
  const ready=fullVisit();assert.throws(()=>certificateImage(ready),/80 分/);scoreQuiz(ready,QUIZ,answers());ready.profile.nickname='  ';
  const texts=[],ctx={fillRect(){},strokeRect(){},fillText(text){texts.push(text);}},canvas={getContext(){return ctx;},toDataURL(){return image;}};
  const previous=globalThis.document;globalThis.document={createElement(type){assert.equal(type,'canvas');return canvas;}};
  try{assert.equal(certificateImage(ready),image);assert.ok(texts.includes('访客'));assert.ok(texts.some(x=>x.includes('五章')));assert.ok(texts.some(x=>x.includes('不代表专业能力认证')));assert.doesNotMatch(texts.join(' '),/九站|9站/);}
  finally{if(previous===undefined)delete globalThis.document;else globalThis.document=previous;}
});

test('download failures propagate to the caller and release the created object URL for UI retry',()=>{
  const previousDocument=globalThis.document,previousCreate=URL.createObjectURL,previousRevoke=URL.revokeObjectURL;
  let revoked=null,removed=false;URL.createObjectURL=()=> 'blob:report';URL.revokeObjectURL=url=>{revoked=url;};
  globalThis.document={body:{appendChild(){}},createElement(){return {click(){throw Error('download blocked');},remove(){removed=true;}};}};
  try{assert.throws(()=>download('<p>报告</p>','text/html','report.html'),/download blocked/);assert.equal(revoked,'blob:report');assert.equal(removed,true);}
  finally{URL.createObjectURL=previousCreate;URL.revokeObjectURL=previousRevoke;if(previousDocument===undefined)delete globalThis.document;else globalThis.document=previousDocument;}
});

test('date formatting handles a missing invalid timestamp without generating a fictitious review date',()=>{
  for(const value of [null,undefined,'','not-a-date'])assert.equal(dateText(value),'时间未记录');
  assert.equal(escapeHTML('<>&"\''),'&lt;&gt;&amp;&quot;&#39;');assert.equal(CHAPTERS.length,5);
});
