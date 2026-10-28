// A deterministic, executable teaching world. No model, purchasing, or shipping API.
export const VERSION=1;
export const CATALOG={
  blueBox:{name:'蓝色包装盒',price:18,stock:2,kind:'package'},greenBox:{name:'绿色包装盒',price:18,stock:6,kind:'package'},
  whiteBox:{name:'白色包装盒',price:12,stock:6,kind:'package'},blueBand:{name:'蓝色腰封',price:3,stock:6,kind:'wrap'},
  greenBand:{name:'绿色腰封',price:3,stock:6,kind:'wrap'},notebook:{name:'笔记本',price:24,stock:6,kind:'item'},
  pen:{name:'签字笔',price:8,stock:6,kind:'item'},card:{name:'欢迎卡',price:2,stock:6,kind:'card'},snack:{name:'点心',price:12,stock:6,kind:'food'}
};
export function planOrder(order,stock){
  const primary=order.color==='green'?'greenBox':'blueBox';
  const pack=stock[primary]>=order.quantity?[primary]:['whiteBox',order.color==='green'?'greenBand':'blueBand'];
  const items=[...pack,'notebook','pen','card',...(order.snack?['snack']:[])];
  const unitCost=items.reduce((sum,id)=>sum+CATALOG[id].price,0);
  return {items,unitCost,total:unitCost*order.quantity,substituted:!pack.includes(primary),available:items.every(id=>stock[id]>=order.quantity),withinBudget:unitCost<=order.budget};
}
export function normalizeOrder(raw={}){
  const quantity=Number(raw.quantity??3),budget=Number(raw.budget??120);
  if(!Number.isInteger(quantity)||quantity<1||quantity>6)throw Error('这座教学工厂一次接待 1–6 份礼盒。');
  if(!Number.isFinite(budget)||budget<=0||budget>10000)throw Error('请填写有效的每份预算。');
  const names=String(raw.names??'').split(/[\n,，]/u).map(s=>s.trim().slice(0,16)).filter(Boolean);
  const order={quantity,budget,color:raw.color==='green'?'green':'blue',snack:raw.snack===true,names:Array.from({length:quantity},(_,i)=>names[i]||`新同事 ${i+1}`),welcome:String(raw.welcome||'欢迎加入，一起把好事做成。').trim().slice(0,90),nickname:String(raw.nickname||'见习工程师').trim().slice(0,24)};
  const stock=Object.fromEntries(Object.entries(CATALOG).map(([id,item])=>[id,item.stock]));
  const plan=planOrder(order,stock);
  if(!plan.withinBudget)throw Error(`按这张订单，当前可用方案每份需要 ${plan.unitCost} 元。请调整预算或点心选项。`);
  return order;
}
export function addEvent(s,kind,title,detail,extra={}){
  const e={seq:s.events.length+1,at:new Date().toISOString(),kind,title,detail,...extra};s.events.push(e);return e;
}
export function createVisit(raw={},id){
  const order=normalizeOrder(raw),s={version:VERSION,id:id||globalThis.crypto.randomUUID(),startedAt:new Date().toISOString(),phase:'briefing',elapsedSeconds:0,station:0,line:0,order,stock:Object.fromEntries(Object.entries(CATALOG).map(([k,v])=>[k,v.stock])),events:[],visited:[],entered:[],questions:[],photos:[],experiments:[],attempts:[],quizAnswers:{},gifts:[],plan:null,reserved:false,cardFault:false,quality:null,accepted:false,preferenceSaved:false,context:null,certificateAt:null};
  addEvent(s,'order','收到欢迎礼盒订单',`${order.quantity} 份 · 每份预算 ${order.budget} 元 · ${order.color==='blue'?'蓝':'绿'}色系 · 先验收，不发货`);return s;
}
export function enterStation(s,index){
  if(!Number.isInteger(index)||index<0||index>7)throw Error('未知的参观站点。');
  s.station=index;s.line=0;s.phase='tour';
  if(s.entered.includes(index))return;
  // A guide may revisit any completed area, but cannot produce out of order.
  if(index>0&&!s.entered.includes(index-1))throw Error('请先完成前面的订单交接。');
  if(index===0)addEvent(s,'request','方案室提出库存查询请求','运行调度将请求交给仓库工人；请求本身没有执行领料。');
  if(index===1){s.plan=planOrder(s.order,s.stock);if(!s.plan.available||!s.plan.withinBudget)throw Error('当前方案无法满足订单，请调整订单。');addEvent(s,'tool','仓库返回实际库存',s.plan.substituted?'主色包装盒不足，改用白盒与同色腰封，维持整批同款要求。':'主色包装盒足够，直接采用同色盒体。');addEvent(s,'plan','根据反馈形成可执行方案',`每份 ${s.plan.unitCost} 元，合计 ${s.plan.total} 元；不超过单份预算。`);}
  if(index===2)addEvent(s,'observe','查看调度室当前工作资料','这笔简单订单不强制压缩；长订单实验独立于实际生产。');
  if(index===3)addEvent(s,'archive','回看会话档案','保留已经发生的请求、库存结果与安排；档案不等于当前全部输入。');
  if(index===4)addEvent(s,'skill','读取欢迎礼盒装配手册','按顺序核对物料、打印欢迎卡、装盒、检查。不预设任何个人长期偏好。');
  if(index===5){
    if(!s.plan)throw Error('尚未形成领料方案。');
    if(!s.reserved){for(const id of s.plan.items){if(s.stock[id]<s.order.quantity)throw Error('库存发生变化，需要重新安排。');}for(const id of s.plan.items)s.stock[id]-=s.order.quantity;s.reserved=true;addEvent(s,'execution','工人完成领料',`实际扣减 ${s.order.quantity} 套原料。重复参观不重复领料。`);}
    s.gifts=s.order.names.map((name,i)=>({id:`gift-${i+1}`,name,items:[...s.plan.items],card:s.cardFault&&i===0?null:{name,text:s.order.welcome},color:s.order.color}));
    addEvent(s,'execution','欢迎礼盒完成装配',`${s.gifts.length} 份实物模型，欢迎卡使用这张订单的名字与文字。`);
  }
  if(index===6){s.quality=checkQuality(s);addEvent(s,'quality',s.quality.ok?'质检通过':'质检发现需要补做',s.quality.checks.filter(c=>!c.ok).map(c=>c.name).join('、')||'数量、内容、配色、卡片和预算符合本单要求。');}
  if(index===7){if(!checkQuality(s).ok)throw Error('先补做缺失部分，再把礼盒交到验收台。');addEvent(s,'delivery','礼盒进入验收台','本次制作已完成，等待客户验收；没有执行发货。');}
  s.entered.push(index);
}
export function completeStation(s,index){if(!s.entered.includes(index))throw Error('尚未进入该站。');if(!s.visited.includes(index))s.visited.push(index);}
export function checkQuality(s){
  const gifts=s.gifts,plan=s.plan;
  const checks=[
    {name:'数量与订单一致',ok:gifts.length===s.order.quantity},
    {name:'包含笔记本与笔',ok:gifts.length>0&&gifts.every(g=>g.items.includes('notebook')&&g.items.includes('pen'))},
    {name:'排除项得到遵守',ok:gifts.length>0&&gifts.every(g=>s.order.snack||!g.items.includes('snack'))},
    {name:'主题色与同款要求',ok:gifts.length>0&&gifts.every(g=>g.color===s.order.color&&g.items.join('|')===gifts[0].items.join('|'))},
    {name:'欢迎卡完整且内容正确',ok:gifts.length>0&&gifts.every((g,i)=>g.card&&g.card.name===s.order.names[i]&&g.card.text===s.order.welcome)},
    {name:'费用在单份预算内',ok:!!plan&&plan.unitCost<=s.order.budget}
  ];return {ok:checks.every(c=>c.ok),checks};
}
export function injectCardFault(s){if(!s.gifts.length)throw Error('先看到装配完成的礼盒，再注入故障。');if(s.accepted)throw Error('验收后的订单不再注入故障，请新建一次实习。');s.gifts[0].card=null;s.cardFault=true;s.quality=checkQuality(s);addEvent(s,'experiment','教学故障：第一张欢迎卡缺失','仅影响本单的卡片；其他已完成部分保留。');}
export function repairCards(s){if(!s.gifts.length)throw Error('尚未生产礼盒。');s.gifts.forEach((g,i)=>g.card={name:s.order.names[i],text:s.order.welcome});s.cardFault=false;s.quality=checkQuality(s);addEvent(s,'execution','仅补印缺失的欢迎卡','原料库存没有再次扣减，礼盒没有重复装配。');}
export function acceptOrder(s){if(!s.entered.includes(7)||!checkQuality(s).ok)throw Error('请先完成生产并查看验收台。');if(!s.accepted){s.accepted=true;addEvent(s,'acceptance','客户确认验收','只完成验收；发货仍未获授权。');}}
export function askQuestion(s,station,q){if(!s.questions.some(x=>x.id===q.id))s.questions.push({id:q.id,station,question:q.q,answer:q.a,at:new Date().toISOString()});}
export function startContextLab(s){
  if(!s.context){s.context={scope:'同一订单经过多轮沟通的独立教学分支',status:'expanded',before:[{id:'rules',kind:'rules',units:10,text:'常驻规则和工具说明。'},{id:'head',kind:'head',units:10,text:`${s.order.quantity} 份同款礼盒；每份不超过 ${s.order.budget} 元；${s.order.color==='blue'?'蓝':'绿'}色系；${s.order.snack?'包含点心':'不放食品'}；先验收，不发货。`},{id:'middle',kind:'middle',units:40,text:'长订单实验追加：多轮包装比较、重复库存说明、被淘汰方案；记录包装方案与费用依据，尚未验收。'},{id:'tail',kind:'tail',units:15,text:'最新一组交接：工人返回包装信息，调度确认接收；保留完整请求与结果。'}],after:null};s.experiments.push({id:'context-long',title:'长订单上下文实验',detail:'在独立教学分支追加工作资料；原订单的生产和档案保持原状。',at:new Date().toISOString()});}
  return s.context;
}
export function compressContext(s){const c=startContextLab(s);if(!c.after)c.after=c.before.map(x=>x.kind==='middle'?{...x,units:10,text:`保留工作摘要：本单采用${s.plan?.substituted?'白盒搭配主题色腰封':'主题色包装盒'}；费用依据为库存报价；维持订单约束；仍需完成后续执行与验收。`}:{...x});c.status='compressed';return c;}
export function badSummary(s){startContextLab(s);if(!s.experiments.some(x=>x.id==='context-loss'))s.experiments.push({id:'context-loss',title:'摘要丢失条件的对照',detail:'“包装已安排”没有说明材料、费用依据和未完成事项，不能据此认定任务完成。',at:new Date().toISOString()});}
export function scoreQuiz(s,bank,answers){const details=bank.map(q=>({id:q.id,selected:answers[q.id]??null,correct:answers[q.id]===q.answer}));const score=details.filter(x=>x.correct).length*10;const attempt={at:new Date().toISOString(),score,details};s.attempts.push(attempt);s.quizAnswers={...answers};if(s.visited.length===8&&score>=80&&!s.certificateAt)s.certificateAt=attempt.at;return attempt;}
export function bestScore(s){return Math.max(0,...s.attempts.map(x=>x.score));}
export function isGraduate(s){return s.visited.length===8&&bestScore(s)>=80;}
export function restoreVisit(value){if(!value||value.version!==VERSION||!Array.isArray(value.events)||!Array.isArray(value.visited)||!Array.isArray(value.entered)||!Array.isArray(value.attempts)||!Array.isArray(value.gifts)||!Array.isArray(value.questions)||!Array.isArray(value.experiments)||!value.stock||!value.order||!Array.isArray(value.photos))return null;try{normalizeOrder(value.order);return value;}catch{return null;}}
