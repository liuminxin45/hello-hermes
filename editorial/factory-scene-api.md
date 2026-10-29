# 工厂场景观察 API

适用于2026-10-29报告改造后的场景层。任务由engine提交，场景只观察已有事件；不把镜头到达当成执行成功。

## 九个几何节点

`intake / loop / analysis / tools / archive / memory / context / delivery / review`继续对应STATIONS九个几何位置。五个观察章节可以选择其中一个或多个对象，不要求按九个位置依次绕行。

## 数据与观察

- `view.setState(sceneModel)`：设置当前可视资料。模型至少含`id`，可含`events`和`context`。它只更新数据、登记可供观察的事件，不扫描新事件自动播放、不写入任务、不根据entered数组执行动作。换id会清理上一个场景的观察队列与错误。
- `view.setObservation({nodeId,eventId,mode='guide'})`：选择观察对象与已存在事件。只切换观察位。mode可为guide/inspect/trace/overview，不执行、重放或提交业务。
- `view.observeEvent(event,{replay=false,animate=true})`：观察已提交事件。有效动画返回数字操作ID；同id重复观察、无匹配operation、或animate=false返回null。即使不播放动画，已选事件仍保存在`status().observation`。
- 默认按event.id去重。`replay:true`允许重播，并替换之前未完成的观察动画；这只重置视觉位置，不重复写入长期资料、证据或任务历史。根app负责学习记录是否记为已观察。
- `view.status()`：独立快照，包含focusNodeId、最多两个relatedNodeIds、activeNodeIds、activeFlowIds、cameraMode、tourTime、nodeStates、operation、observation、queueLength。历史截图保留的快照不会被后续活动改写。

事件采用`{id,seq,type,kind,sessionId,at,nodeId,operation,title,detail,input,result,evidenceIds,objectiveIds}`。operation支持原有tool/compress/history/memory/memoryWrite/input/planning/analysis/delivery/review，增加toolRequest/toolResult/toolError/skill/historyWrite/newSession。特定type优先校正语义：例如tool-result只画回执，tool-failed画错误，history-written只画写入，不冒充检索。

来源卡优先使用请求目标、evidenceIds或实际长期条目id。可见卡标显示简短来源编号、已保存受众偏好、核查方法、上次记录等；稳定身份保留在operation.cardIds。一次交接有多份资料时以主卡加份数表示，不用十几个无语义粒子代替。

## 暂停、跳动画与回访

- `view.setPaused(true)`冻结观察时间线、设备动画与自动镜头。它不会暂停任何真实远程工具；本馆没有远程工具。
- 暂停后主动调用focus/inspectPart属于显式导航，允许相机到达所选观察位后停住。普通阅读没有持续环绕。
- `view.skipMotion()`把当前及队列观察跳到等价视觉终态，清除活动传输并到达预设观察位；`busy()`随即为false，`ready()`为true。成功事件短暂显示Completed；工具失败保持tools=Error，不能跳成成功。
- skipMotion不调用任务引擎。旧`operate(kind,done)`仅保留兼容的观察结束通知；v3调用方不得将业务副作用放进done。任务提交必须发生在观察之前。
- `view.ready()`以1.2秒转场稳定门槛与当前飞行为准，`view.busy()`仅表示视觉操作/队列未结束。
- `inspectPart(part,nodeId)`保留镜头栈，`restoreInspection()`恢复原位；不会更改任务、证据或事件。已有focus/overview/trace/fullPath/setFree/move接口保留。

## 注意力与遮挡

关注与运行仍独立。主焦点对比1.0，最多两个关联对象0.82，其余0.48；这组数值控制颜色/亮度与标签，不作为整机透明度。只对射线确实挡住主设备的非焦点对象做22%透明，其余背景保持结构不透明。材质在建场时独立克隆，淡化期间不创建新材质。

转场默认约1.2秒，到达后镜头稳定。工厂总览与关系追踪没有常驻环绕/漂移。手动拖动接管自动控制，只有主动选择观察位/跟上导师才恢复。减少动态设置保留等价的静态前后状态。

## 上下文回放

无sceneModel.context时仅显示40格短输入示意，不自动触发压缩。长过程回放兼容`{load:70,units:35,view:'before'|'after',before,after,viewing,loss}`。observeEvent中operation=compress播放Middle整理，Head/Tail保持；根app在观察结束后切换tour回放视图，任务原始资料不会因此改变。

## 实景截图

`view.capture()`返回1920×1080 JPEG data URL。它使用当前实际稳定相机、当前可见设备和真实渲染状态，中心裁成16:9；不会临时飞去另一个游客没见过的摄影机位。转场未稳定或没有焦点时抛错，由app记录缺失，不能补造照片。

照片中的运行状态是观察/回放状态，并不是重新执行Hermes。根app决定只保留请求反馈、上下文前后、经验读取三类关键帧。可选onMoment通知含`{kind,stage,eventId,cardIds,replay,caption}`；它本身不生成学习记录或任务事件。

## 本轮验证边界

已做模块语法与纯场景不变量检查：焦点不运行、事件去重、卡片身份、最多两个配角、暂停、跳过后的错误终态。Three.js浏览器视觉、移动端、键盘和真实截图由根任务统一验收；不能把本文件当作已完成真人可用性或帧率研究。
