// Deterministic teaching model. No model inference, external tools, or hidden reasoning.
export const stations = [
  {id:'entrance',name:'任务入口',short:'入口',pos:[-11,0,1],color:0xe9ab50,summary:'人在这里提出目标、提供材料，并划清可以做什么。',input:'目标、三份材料的索引、只写草稿的边界',output:'交给运行程序的一项任务',detail:'入口负责接收请求，不负责判断事实。换成聊天窗口、消息渠道或定时触发，入口可以不同；进入后仍需要任务执行与状态管理。渠道接入还涉及身份和权限，这个原型没有展开。'},
  {id:'runtime',name:'运行调度',short:'调度',pos:[-1,0,0],color:0x3878c8,summary:'程序接住模型的请求，调用工具，再把执行结果带回来。',input:'用户目标、模型返回的请求、工具结果',output:'下一轮模型请求、工具调用或交付结果',detail:'模型提出要做什么，运行程序负责把请求接到工具、保存结果并推进循环。把每一步交给人也能做，但人要反复复制材料、发起请求和整理返回值。自动化减少这部分重复介入，并不保证任务结论一定正确。'},
  {id:'context',name:'上下文工作台',short:'上下文',pos:[-1,0,-6],color:0x6fa9b2,summary:'每次请模型判断，都要带上它这一次能看到的材料。',input:'任务要求、相关历史、工具结果与需要的规则',output:'本轮发给模型的输入',detail:'保存过不等于本轮看得到。输入空间有限，历史变长时需要选择、整理或压缩。全部带上实现直观，但占用输入空间；筛选或压缩更节省，却可能丢失判断所需细节。工作台是教学职责，不表示 Hermes 中有一台独立服务器。'},
  {id:'model',name:'模型服务',short:'模型',pos:[7,0,-6],color:0x7885d2,summary:'根据本轮输入，生成回答，或提出下一步要调用的工具。',input:'本轮上下文与可用工具的说明',output:'文本回答，或结构化的工具调用请求',detail:'模型生成工具请求，不代表工具已经执行。运行程序还要解释请求并实际调用工具。模型服务可以在远端，图中的独立平台表示这个边界；小球和转动部件不表示真实的模型内部思考。'},
  {id:'tools',name:'工具车间',short:'工具',pos:[8,0,3],color:0xdd9964,summary:'工具把请求变成具体操作，返回材料或失败信息。',input:'已选定的工具名称与参数',output:'读取结果，或可供程序处理的错误',detail:'工具返回成功，只能说明这次操作完成，不能证明简报已经正确。工具失败后可以重试、换来源或向人说明缺口，取决于任务规则。这个演示选择返回失败信息，并生成待补材料说明，不编造新闻。'},
  {id:'archive',name:'会话档案',short:'档案',pos:[-7,0,6],color:0x7898a7,summary:'把这次任务发生过的对话与工具结果留作记录。',input:'任务中的消息、请求和工具结果',output:'可在后续使用的会话记录',detail:'完整记录便于继续任务和追查问题，但模型不会自动看到全部档案。本轮使用什么，仍由上下文组装决定。持久保存、恢复与压缩各有职责；这里仅展示留存关系，不模拟实际存储格式。'},
  {id:'memory',name:'记忆与技能库',short:'复用',pos:[-9,0,-6],color:0x7d9c71,summary:'在需要时取出长期偏好或可复用的做法。',input:'已经保存、与任务有关的偏好或技能',output:'本轮需要的规则与做法',detail:'记忆、技能和本次会话的全部历史并不是一回事。长期偏好与可复用做法要按需要进入当前输入；本原型仅展示这条读取路径，没有演示写入或检索算法。它们改变可用资料，不是训练模型权重。'},
  {id:'output',name:'交付出口',short:'交付',pos:[0,0,8],color:0x5d9b86,summary:'把任务结果交给人，并说清楚已经做到哪一步。',input:'模型生成的草稿，或缺口说明',output:'供人检查的结果；不会自动发送',detail:'这次委托要求草稿，生成后就应交给人。若要求发布，还需要目标渠道、相应权限和发布结果的检查。自动形成结果与获准对外发送，是两个不同的边界。'},
];
export function createEvents(scenario='normal') {
  const failure=scenario==='failure';
  return [
    {from:'entrance',to:'runtime',card:'任务',title:'目标进入运行程序',body:'整理三条候选消息；合并重复事件，区分已确认与未确认。只形成草稿，材料不足时说明。',kind:'用户目标'},
    {from:'memory',to:'context',card:'做法',title:'取出这次需要的做法',body:'教学设定：已保存一条简报做法——保留材料来源，遇到冲突先标记。只取相关内容，不搬来整个资料库。',kind:'读取复用资料'},
    {from:'runtime',to:'context',card:'要求',title:'组装第一次请求',body:'把任务要求、材料索引和可用工具说明放到上下文工作台。三份材料正文此时还没有读入。',kind:'准备输入'},
    {from:'context',to:'model',card:'输入',title:'模型接收本轮输入',body:'模型能依据这轮输入生成响应。它没有直接拿到档案柜里的所有历史，也没有直接执行读取。',kind:'模型请求'},
    {from:'model',to:'runtime',card:'读 A/B/C',title:'返回一项工具调用请求',body:'教学脚本预设的模型响应：请求读取 A、B、C。请求先回到运行程序，工具还未开始执行。',kind:'调用请求'},
    {from:'runtime',to:'tools',card:'读取',title:'运行程序调度工具',body:'程序把读取请求交给工具车间。由工具执行具体操作，不需要人复制粘贴每一份正文。',kind:'实际调度'},
    {from:'tools',to:'runtime',card:failure?'读取失败':'A · B · C',title:failure?'工具返回失败信息':'三份材料回到运行程序',body:failure?'故障注入：读取没有获得正文。错误也要返回，不能当作读取成功，更不能编造材料。':'A 与 B 说的是同一件事；B 声称支持图片，却与 A 冲突。C 是另一件事。材料到齐，判断还没完成。',kind:failure?'工具失败':'工具结果'},
    {from:'runtime',to:'archive',card:failure?'失败记录':'执行记录',title:'这一步被保存为会话记录',body:'运行程序记录请求与返回结果，便于后续继续或追查。存进档案不等于自动进入模型下一轮输入。',kind:'保存状态'},
    {from:'runtime',to:'context',card:failure?'错误说明':'新结果',title:'让下一轮看到执行结果',body:failure?'将失败信息加入下一轮输入。模型需要知道材料尚未取到，才可能据此说明缺口。':'把材料正文作为工具结果带入下一轮输入。模型现在才有条件比较事件与说法。',kind:'更新上下文'},
    {from:'context',to:'model',card:failure?'输入＋错误':'输入＋材料',title:'带着新信息，再请求一次模型',body:failure?'同一任务继续，但输入中没有材料正文。演示不会把失败结果伪装成一份完整简报。':'任务要求和工具结果一同进入模型。本轮可以基于 A、B、C 形成草稿；这不是把所有会话档案重新塞入。',kind:'下一轮请求'},
    {from:'model',to:'runtime',card:failure?'缺口说明':'草稿',title:failure?'返回待补材料说明':'返回两条消息与一处疑点',body:failure?'教学脚本预设响应：无法读取材料，暂不能核对消息。请补充正文或重试；没有伪造已完成的简报。':'教学脚本预设响应：合并 A/B 为一个事件；图片说法未确认。C 形成第二条。只有两件事，说明不足三条。',kind:'模型响应'},
    {from:'runtime',to:'output',card:failure?'需要补充':'2 条＋疑点',title:failure?'把缺口交给人':'交付草稿，停在授权边界内',body:failure?'本次没有完成消息整理，交付的是失败说明。人可以决定补材料或重试；工具失败没有被动画掩盖。':'交付两条不同事件及未确认说明。数量不足如实说明。没有发送动作：本次任务只授权形成草稿。',kind:failure?'任务未完成':'草稿完成'},
  ];
}
export function resultFor(scenario){return scenario==='failure'?{completed:false,uniqueEvents:0,sent:false,lines:['材料读取失败，尚未形成简报。','需要补充正文或重试，不能宣称已核对。']}:{completed:true,uniqueEvents:2,sent:false,lines:['① 笔记工具甲新增纯文本导出；暂不支持图片。','② 语音工具乙新增标点修正；没有准确率提升的依据。','待核实：B 的图片迁移说法与 A 冲突。','三份材料只涉及两件不同事件，不补造第三条。']};}
export function visibleHistory(events,index){return events.slice(0,Math.max(0,Math.min(index+1,events.length)));}
