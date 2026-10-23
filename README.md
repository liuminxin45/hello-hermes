# hello-hermes

**从 Hermes 理解 Agent**：一本面向懂大模型、初学 Agent 的中文图解手册。用一份技术简报的形成过程，解释行动循环、工具、上下文、记忆、技能、协作及设计取舍，并对照 OpenClaw。

[在线阅读](https://liuminxin45.github.io/hello-hermes/) · [第一章](https://liuminxin45.github.io/hello-hermes/chapters/01-from-chat-to-action.html) · [全书路线](https://liuminxin45.github.io/hello-hermes/roadmap.html)

## 阅读方式

正文不要求安装 Hermes 或编写代码。十四章从概念逐步进入机制与判断，每章提供图解、关键知识点、理解题及官方依据。教学示意和实际验证明确区分。写法参考 Hello Agents，文字和配图独立制作。

## 开发

需要 Node.js 22.12 或更新版本。

```sh
npm ci
npm run docs:dev
npm test
npm run docs:build
```

GitHub Pages 使用 `/hello-hermes/` 子路径；`main` 的通过检查的提交自动部署，PR 只执行校验。

## 在 Codex 中维护

在本仓库说“跟上官方最新，更新手册”，或调用 `$hello-hermes-sync`。仓库技能负责收集官方变化、核实受影响章节、更新图文、执行验证，再交付维护 PR。

`npm run sync:check` 只生成 `.cache/sync/report.json` 报告，不直接更改手册或核对记录。整个流程依靠当前 Codex 环境，不设置定时任务，不需要内容生成 API Key。详见 [.agents/skills/hello-hermes-sync/SKILL.md](.agents/skills/hello-hermes-sync/SKILL.md)。

## 版本与许可

首版依据 Hermes v0.22.5；OpenClaw 对照依据 v2026.10.6。每章保存独立核对记录，官方最新版与已核实版本分别记录。具体来源和验证边界见[版本与来源](docs/sources.md)。

本项目是独立社区学习材料，非相关项目官方文档。正文和原创图解 [CC BY-SA 4.0](LICENSE-CONTENT.md)，站点代码、维护脚本及 skill [MIT](LICENSE)。
