# hello-hermes

**Hermes Agent 工厂实习馆**：带着一张欢迎礼盒订单，跟导师走进三维工厂，观察目标怎样变成判断、派工、执行与交付。无需编程、安装 Hermes 或模型 API Key。

[进入工厂实习馆](https://liuminxin45.github.io/hello-hermes/) · [十八章图文资料](https://liuminxin45.github.io/hello-hermes/library.html) · [旧版档案](https://liuminxin45.github.io/hello-hermes/legacy.html)

## 一次完整实习

1. 在厂外提交订单，改变数量、预算、主题和欢迎卡内容。
2. 跟 3D 导师走过八个站点，观察库存反馈、方案调整、领料、装配与质检。
3. 到楼上调度室，使用独立长订单实验理解上下文、Head/Tail、摘要与阈值。
4. 点选提问，拍摄真实三维场景照片，导出包含个人记录的 HTML 报告或打印 PDF。
5. 完成十道情境题，达到 80 分领取 PNG 实习纪念证明，感谢导师并离场。

工厂由本地教学规则驱动：库存、工件和检查状态实际改变，重复参观不会重复扣料。没有连接真实模型、现实机器、购买或物流；不宣称演示是 Hermes 实测轨迹。上下文压缩处理工作资料，不把实体原料压成摘要。

进度、照片、提问、历次报告和成绩保存在本机 IndexedDB；导出文件可离线阅读。源码入口为 `docs/public/factory/`，Three.js 固定为 0.180.0，保留 MIT 许可。产品与教学设计见 [实习馆蓝图](editorial/factory-blueprint.md)。

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
