# 工厂视觉与动态教学优化：本轮交付记录

基线为 `40675c2f74ac1417ee5a53053c363451171ff497`。输入见[指导原件字节快照](2026-10-29-visual-interaction-source.md)，SHA256为 `a5b09f405f033189fdaadf16e539a93c9652382025c076ed20a0e9a794813724`。17项F均已实施，具体代码映射及45项验收的已验、部分与未验范围见[逐项清单](../visual-interaction-implementation.md)。本文是实施自检记录，不称独立盲审或真人教学效果研究。用户已明确授权提交、推送与部署，线上结果在末尾单独补。

## 发现与修复

| 原问题 | 本轮实现 |
|---|---|
| F01/F02：中央导师遮设备，收起导致暂停 | `index.html`/`study.css`使用真实场景列与右栏，手机上下分区；`app.mjs`折叠只重排，暂停原因独立。 |
| F03/F04/F13：动作太短，压缩直接70跳35 | 新`storyboard.mjs`提供六拍、结果保持、8秒常规片段和26秒上下文；25分批增长至70，再保护本次首尾、生成摘要并返回35。人物、字幕、地图同源，重播不执行业务。 |
| F05/F11/F12：背景抢焦点、长牌重复、设备相似 | `scene.mjs`按材质初值乘1/.6/.18，遮挡再弱化，保留玻璃初值；背景内件/标签/阴影降权。短牌与碰撞/视锥/安全区；工具、档案索引、偏好抽屉、方法册、工作台等有不同零件和动作。 |
| F06/F07：常见工具事件没工人，技能灯错绑 | 语义映射覆盖工具请求/结果/错误、记忆、技能、历史与压缩；两路灯与抽屉/翻书分开，角色有步行、转向和交接。 |
| F08/F10/F15：默认文案拥挤，零读取泛称复用 | 具体三条消息任务与一个入口；人工编写短cue、结论及实际读取分支，保留长原理/来源。0/0/1与1/1/1均有真实浏览器路径。 |
| F09/F14/F16：缺全局定位，点设备不深入，多问后返回有风险 | 新SVG地图只读同一NODES/FLOWS和导演快照；设备/地图点击只改观察，一键跟导师。问答只保存一次原位，关闭恢复一次。 |
| F17：性能与恢复证据不足 | 新画质与诊断计数、隐藏暂停、context loss/restored、初始化失败回退与文字关键帧；补真实样本、有界资源压力和恢复记录。 |

集成时还修正了第二会话误讲首次合并/两份草稿、截图实际回放标记被覆盖、WebGL丢失原因残留卡住文字播放器、文字导演跨新记录保留旧完成态、窄屏设置切页保留旧滚动位置等问题。报告新增完整播放/手动关键帧/直接结果/未知的区分；构建为完整静态和动态模块图加内容hash，避免缓存混用旧接口。

保留五章、49问、6道核心题与6道复习题、固定来源、第二会话、保存同意、本机记录和旧档只读保护。业务`engine.mjs`/`store.mjs`及schema、原18章、官方核对日期和固定Three.js版本未改。没有接真实模型或发布用户草稿。

## 实际证据

以下文件均在仓库忽略目录 `.cache/visual-interaction-qa/`，已核存在，不进入公共构建。

| 验证 | 结果与文件 |
|---|---|
| 桌面布局 | 1366×768为stage1006×698/rail360；1280×720为920/360。`before-desktop.png`、`after-landing.png`、`after-tool.png`。 |
| 上下文 | 阈值、摘要处理中、整理后：`context-threshold.png`、`context-summarize.png`、`context-after.png`。100/70/20是教学格，不是Hermes默认值。 |
| 三段真实录屏 | CDP连续捕获267/156/69源帧；`01-tool-cycle.mp4`39.733秒、`02-context-growth.mp4`29.267秒、`03-guide-controls-complete.mp4`36.933秒。均H264/1100×618，无空间缩放，按原timestamp编码，与源跨度误差小于一帧；ffprobe与ffmpeg整段解码通过，见`video-validation.json`。第三段真实执行折叠、暂停、地图观察/跟随、连问3题/关闭/继续；旧失败03片段不交付。 |
| 手机与等效窄空间 | 390×844：stage高457.03（58%），折叠canvas高788；320×568与844×390无横溢，主操作可见。`mobile-390.png`、`mobile-dark-map.png`、`mobile-320.png`、`short-landscape.png`。CDP683×384等效空间scrollWidth683、按钮底380、stage180.39，见`zoom-equivalent-683.png`；不是原生200%浏览器缩放。 |
| 两种完整主线 | 三维5章二会话0/0/1：`reuse-zero-zero-one.png`。新记录文字关键帧5章、显式保存偏好/方法，二会话实际1/1/1、研发要求优先并重查A3：`reuse-actual-skill.png`、`text-mode-complete.png`。键盘Enter选择地图档案可显示职责；减少动态保留3D、无文字遮罩，手动下一拍推进。 |
| 报告与下载 | 3槽真实1920×1080照片、3个实际不同问题、自测100、1600×1100 PNG证明生成，见`report-and-certificate.png`。系统下载真实HTML已落`actual-export-report.html`，记录完整播放2/手动关键帧15/直接0/未知0。 |
| 短时性能 | UHD630/i5-9400、balanced、1366×768，180个可见移动RAF样本mean16.8517ms，见`performance-before.json`。不是全流程稳定60fps。 |
| 有界资源与镜头压力 | 预热1轮加20轮真实scene replay/seek/3次inspect/1次restore，每步3 RAF；六类资源delta0，cameraError0、inspectionDepth0，见`resource-20-cycles.json`。不是20次实时完整影片；不同资产/预热基线不横比泄漏。 |
| 恢复 | `webgl-lost.json`、`webgl-restored.json`、`webgl-recovery-events.json`记录真实WEBGL_lose_context丢失/恢复；软件getContext阻断实际触发初始化失败，解除后重新init成功。 |
| 最终门禁 | `node --test --test-reporter=dot tests/*.test.mjs`：141项、exit0；完整docs:build与公共输出隔离exit0，资源hash `c7aa3792ab78494d`；43条远程链接无missing/unavailable。 |

录像是实际浏览器连续渲染，不是静态图伪造。30fps为按真实timestamp保持节奏的编码格式，不是渲染帧率。原帧、时间戳、concat与编码清单均保留在各录屏目录。

## 边界与后续优先级

P03实测是scene真实恢复；产品文字全链有独立证据，两者不能拼成“产品中途loss自动切文字完整E2E”。软件阻断初始化不等于真实无WebGL硬件。有界20轮不证明长期无泄漏，180 RAF不代表弱设备或全程帧率。

未测实体手机/触控性能、屏幕阅读器、原生浏览器200%缩放、1912/1920全部设备安全区、所有遮挡/恢复组合、后台切换各阶段、强制截图失败、损坏/配额/刷新等全部本机路径。只存偏好、只存技能及禁用分支有纯函数覆盖，尚未逐条完整浏览器复验。PNG生成不等于实际下载PNG，HTML下载不等于真实打印/PDF；自动化100分不证明真人掌握。

下一轮P1优先真实触控/大字号/屏幕阅读器、产品中途loss接续与异常存档路径；P2补跨设备持续性能和其余浏览器组合。真人形成性测试、无提示迁移与延迟复测继续等待真实读者。

## 线上发布实测

| 项目 | 实际结果 |
|---|---|
| 代码提交与GitHub推送 | 主实现 `83aa2a4`、线上回看修正 `c7e0f50126b9b6138786745331e75622d319e158` 均已推送main。本记录随后作为纯验收文档归档，前端资源不变。 |
| GitHub Actions部署 | [最终代码运行](https://github.com/liuminxin45/hello-hermes/actions/runs/40830024120) 的verify/deploy均success；首次运行40828445092也success。远端实际执行npm ci、npm test、npm run docs:build和Pages部署。 |
| 线上页面、资源及手机检查 | 首页HTTP200，提交标识`c7e0f50126b9`、资源`c7aa3792ab78494d`，WebGL ready；已实际恢复旧记录打开导览。线上390×844视口scrollWidth390，完整手机画面`online-c7e0f50-mobile-page.png`、桌面`online-c7e0f50-desktop.png`已保存，临时视口已恢复。 |

线上回看另外发现：避让背景时镜头绕到工具柜背面；已限制正面设备的观察方向，并排除实体内机位。浅色地面上的深色主题章名也增加底衬；`tool-front-and-dark-hud.png`与最终线上手机图确认抽屉、交接台和标题可见。首个工具柜背面截图保留为问题证据，不作为最终通过截图。最终手机首次缩略图不作为验收，以完整页面PNG为准；取证重试没有伪装成产品测试失败。

发布原始记录另存忽略目录`.cache/visual-interaction-qa/deployment-code.json`。源指导快照保留原始Markdown硬换行的两个尾空格，以维持已核SHA256。
