# hello-hermes

**Hello Hermes｜看见 Agent 如何工作**：从老板的一条新闻采集委托开始，亲手发送要求，再逐步看模型请求工具、结果返回上下文、依据改变结论，最后得到待审稿件。无需编程、安装或模型密钥。

[进入交互讲解](https://liuminxin45.github.io/hello-hermes/) · [十八章图文资料](https://liuminxin45.github.io/hello-hermes/library.html)

首屏只显示老板的委托；发送前没有新闻、工具或架构全图。窗口逐个出现，已讲的缩成淡色摘要卡。每步一段固定说明，约5秒演示后无限停留，只有点击才进入下一步。当前部件轮廓与低速方向光点保持，不重复执行工具。可回看或直接看结果，不需要追着字幕阅读。

上下文整理是可选的长过程教学分支：逐批追加到70格，停在本次演示阈值；中部资料改写为新摘要，降到35格，原始记录仍在。可以倒回、比较遗漏条件的坏摘要。主线交付待审稿件后再按需进入第二次委托，分别呈现会话开始的记忆快照、按需加载的技能、查询得到的历史，旧偏好不能覆盖新要求。

“为什么”打开预编问题，关闭后回到原观察位置。结尾只有一个迁移判断；学习报告、实际舞台截图、测验和纪念证明均为可选。支持深浅主题、减少动态效果、文字关键帧和手机布局。首访理解效果与实体设备性能尚未经过真人测试。

新场景newsroom-walkthrough-v1保留任务、观察、学习状态分离，使用独立本机记录键；旧记录只读保留，不静默迁移或继承新完成态。保存偏好和方法需要明确选择，历史归档与长期偏好授权分别处理。数据与照片只在当前浏览器保存，不上传；清理浏览器数据可能导致丢失，可自行导出报告。

Atlas、Delta与全部任务材料都是虚构教材，不连接真实模型、实时搜索或外部发布。教学容量格不是实际Token；阈值和保护范围不是所有Agent通用配置。新的呈现使用Canvas卡片舞台，无需新增依赖。源码目录保留 docs/public/factory/ 以兼容旧路径。[当前蓝图](editorial/playable-explainer-blueprint.md)、[本次逐项实施与验证](editorial/reviews/2026-10-29-stepwise-news-review.md)与[旧工厂记录](editorial/factory-blueprint.md)分别留档。

## 阅读方式

正文不要求理解 API、安装 Hermes 或编程。新版按“全景 → 单次任务 → 信息与状态 → 完整运行 → 可靠性 → 综合迁移”逐批发布。正文不提供源码跳转，核对依据保留在内部。教学示意、受控模块观察与完整模型运行明确区分。

新版分批发布：从完整任务与统一地图出发，逐步深入工具、循环、信息、状态、协作和可靠性。17 章主线和 OpenClaw 对照专题的实时进度见 `content/chapters.json`；旧十四章保持原文件和 URL，不混入新版导航或搜索。真实注册表受控观察与教学推演分别说明范围。

## 开发

需要 Node.js 22.12 或更新版本。

```sh
npm ci
npm run docs:dev
npm test
npm run docs:build
```

GitHub Pages 使用 `/hello-hermes/` 子路径；`main` 的通过检查的提交自动部署，PR 只执行校验。

本次改造的测试、构建与实际浏览器证据见[实施记录](editorial/reviews/2026-10-29-stepwise-news-review.md)。本地验证与远程发布分别记录，不能据本地成功宣称线上已更新。

公共构建会扫描并拒绝本地批注运行代码、接口与私有数据。图文批注界面只由本地服务注入；实习馆的学习记录只保存在参观者自己的浏览器，不上传服务器。

## 在 Codex 中维护

### 本地选中文字批注

```sh
npm run review
```

打开返回的本机网址，选中正文后点“批注选中文字”，或在图注旁点“批注此图”。右下角“批注”可查看、编辑和定位意见。批注落到本地 `.review/`，公共站点不会显示这些控件或保存意见。

标完后在 Codex 说“按批注修改手册”，即可按冻结批次改原 Markdown，验证后记录处理结果。也可用面板的“复制给 Codex”生成指令。详见[批注与改稿流程](editorial/review-workflow.md)。

`node scripts/review.mjs status` 查询后台地址；`stop` 停止；`build` 在改稿后更新本地阅读页。

### 跟上官方最新

在本仓库说“跟上官方最新，更新手册”，或调用 `$hello-hermes-sync`。仓库技能负责收集官方变化、核实受影响章节、更新图文、执行验证，再交付维护 PR。

`npm run sync:check` 只生成 `.cache/sync/report.json` 报告，不直接更改手册或核对记录。整个流程依靠当前 Codex 环境，不设置定时任务，不需要内容生成 API Key。详见 [.agents/skills/hello-hermes-sync/SKILL.md](.agents/skills/hello-hermes-sync/SKILL.md)。

### 写作、盲审与意见处理

按任务选择入口。各阶段不绑定具体模型名称，也不会仅因调用一个 Skill 就自动进入下一阶段。

| 场景 | 使用入口 | 交付与边界 |
| --- | --- | --- |
| 阶段 A：批量优化当前成稿 | [`hello-hermes-editorial-review`](.agents/skills/hello-hermes-editorial-review/SKILL.md) 写作修订模式 | 通读、最小修订、作者自检、测试和构建，保存编辑报告。 |
| 阶段 B：另一模型独立盲审 | [`hello-hermes-blind-review`](.agents/skills/hello-hermes-blind-review/SKILL.md) | 不同于写作方的实际模型、全新上下文；只输出 P0/P1/P2 报告和优先五项问题，不修改文件。 |
| 阶段 C：处理指定审稿报告 | [`hello-hermes-editorial-review`](.agents/skills/hello-hermes-editorial-review/SKILL.md) 意见处理模式 | 逐项判断成立、部分成立、不成立、已失效或待核实，只修复确认成立的部分并验证。 |
| 官方稳定版变化 | [`hello-hermes-sync`](.agents/skills/hello-hermes-sync/SKILL.md) | 核实版本差异、更新受影响图文并验证，交付维护 PR。 |
| 本地选文批注 | [批注与改稿流程](editorial/review-workflow.md) | 冻结批次、核实意见、修订与验证后核销；不直接覆盖批注数据。 |

可直接复制以下阶段指令。

```text
阶段 A：使用 $hello-hermes-editorial-review，批量优化当前已发布成稿，完成最小必要修订、作者自检、测试与构建并保存报告。不自动进入盲审，不提交、不推送、不发布。
```

```text
阶段 B：使用 $hello-hermes-blind-review，由不同于写作方的实际模型在全新上下文盲审当前全部已发布成稿。不读历史审稿、修改理由或对话记录，只输出分级报告，不修改任何文件。
```

```text
阶段 C：使用 $hello-hermes-editorial-review，逐项核实下方提供或指定的审稿报告，只修复确认成立的部分。保留不成立、已失效和待核实项的依据，完成必要的自检、测试与构建，不扩大为全书重写，不提交、不推送、不发布。
```

阶段 B 仅接收成稿、课程约定、原始技术来源和必要的版本、写作模型身份等中性信息，不接收阶段 A 的问题清单、修改理由或自检报告。同一模型换角色或只清空上下文不能满足“另一模型”；无法确认实际模型差异时须说明限制。B 的输出报告留给阶段 C，写作方逐项验证后再决定是否修改。

只说“全书审稿”默认只审不改；要批量改稿请明确“审稿并修订”。A、C 的作者自检不等于 B 的独立盲审。仅完善 Skill 时不会执行上述内容任务；需要完整流程时明确要求 A → B → C。

## 可选的受控模块观察

普通读者无需运行。维护者可在 Python 3.11 或更新版本中复现两份局部观察：

```sh
python scripts/observe-tool-registry.py
python scripts/observe-delivery-queue.py
```

脚本下载固定提交的必要模块，并用 `examples/news-brief/*-source-lock.json` 校验摘要。输出默认放在忽略的 `.cache/`。队列观察使用临时数据库、固定驱动和本地回调，不启动完整调度、模型或平台发送；详细范围写在原始报告中。

## 版本与许可

新版依据 Hermes v0.22.5 与 OpenClaw v2026.10.7，维护者于 2026-10-26 查询稳定发布并核对相关内容。两份真实受控观察分别执行同步注册表和投递队列模块，没有模型调用或外部发送；不等于完整 Agent 基准。旧版 OpenClaw v2026.10.6 记录独立保留。具体范围见[版本与来源](docs/sources.md)。

本项目是独立社区学习材料，非相关项目官方文档。正文和原创图解 [CC BY-SA 4.0](LICENSE-CONTENT.md)，站点代码、维护脚本及 skill [MIT](LICENSE)。
