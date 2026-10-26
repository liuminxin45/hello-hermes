# hello-hermes

**从 Hermes 理解 Agent**：一本从会用聊天 AI 出发，逐步走向系统关系和设计取舍的中文图解手册。围绕每周消息简报，逐步增加工具、上下文、状态、记忆、技能、调度和协作，最终分析一个新需求。

[在线阅读](https://liuminxin45.github.io/hello-hermes/) · [新版第一章](https://liuminxin45.github.io/hello-hermes/learn/01-one-complete-task.html) · [学习路线](https://liuminxin45.github.io/hello-hermes/roadmap.html) · [旧版档案](https://liuminxin45.github.io/hello-hermes/legacy.html)

## 阅读方式

正文不要求理解 API、安装 Hermes 或编程。新版按“全景 → 单次任务 → 信息与状态 → 完整运行 → 可靠性 → 综合迁移”逐批发布。正文不提供源码跳转，核对依据保留在内部。教学示意、受控模块观察与完整模型运行明确区分。

本批发布新版 01–04，增加统一地图、模型输入与工具职责链，以及真实注册表受控观察。17 章主线和 OpenClaw 对照专题的进度见 `content/chapters.json`；旧十四章保持原文件和 URL，不混入新版导航或搜索。

## 开发

需要 Node.js 22.12 或更新版本。

```sh
npm ci
npm run docs:dev
npm test
npm run docs:build
```

GitHub Pages 使用 `/hello-hermes/` 子路径；`main` 的通过检查的提交自动部署，PR 只执行校验。

公共构建会扫描并拒绝本地批注运行代码、接口与私有数据。审阅界面只由本地服务注入，GitHub Pages 只提供阅读。

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

## 版本与许可

新版本批依据 Hermes v0.22.5，维护者于 2026-10-26 查询稳定发布并重新核对相关内容。受控观察只执行固定版本的同步注册表路径，没有模型调用。旧版 OpenClaw v2026.10.6 对照保留在历史记录，新版专题另行审核。具体范围见[版本与来源](docs/sources.md)。

本项目是独立社区学习材料，非相关项目官方文档。正文和原创图解 [CC BY-SA 4.0](LICENSE-CONTENT.md)，站点代码、维护脚本及 skill [MIT](LICENSE)。
