---
title: 版本与来源
prev: false
next: false
---

# 版本与来源

每章单独记录实际核对的稳定版本与日期。下表直接读取章节核对记录；点击版本可以查看固定提交，更新一章不会自动刷新其他章。

<SourceVersions />

## 什么算核对完成

章节中的机制、边界和示例解释，需要对照对应提交的官方文档及相关源码。测试链接用于定位项目对行为的约定；仅阅读测试不等于在本机运行过该测试。

书中技术简报、任务轨迹和故障均为明确标注的教学示意。本版没有声称完成 Hermes 或 OpenClaw 的真实模型调用、端到端任务回放或性能基准测试。站点与维护脚本的验证另见仓库检查结果。

## 一手资料

- [Hermes 固定版本源码](https://github.com/NousResearch/hermes-agent/tree/bf0203a794a07aac3ff764972ab9087baa4e4f4e)
- [Hermes 该版本官方文档源码](https://github.com/NousResearch/hermes-agent/tree/bf0203a794a07aac3ff764972ab9087baa4e4f4e/website/docs)
- [Hermes 该版本测试目录](https://github.com/NousResearch/hermes-agent/tree/bf0203a794a07aac3ff764972ab9087baa4e4f4e/tests)
- [OpenClaw 固定版本源码与文档](https://github.com/openclaw/openclaw/tree/fe06181dc5ecc01cf8904abbfc26925925efefbc)
- [Anthropic：Building effective agents](https://www.anthropic.com/research/building-effective-agents)，用于工作流与 Agent 的概念区分；这篇文章写于 2024 年，产品工具细节不作为当前版本依据。
- [ReAct 论文](https://arxiv.org/abs/2210.03629)，用于理解推理与行动交替的研究背景；不将论文中的提示结构视为所有现代 Agent 的统一实现。
- [MCP 规范](https://modelcontextprotocol.io/specification/2025-06-18)，用于理解协议与应用职责的边界。
- [Agent Skills 规范](https://agentskills.io/specification)，用于理解技能文档格式。

## 写法参考

[Hello Agents](https://hello-agents.datawhale.cc/) 提供由概念到实例的讲解参考；[Hermes Agent 完全学习手册](https://lucky7jia.github.io/hermes-agent-tutorial/)与[从 Hermes 学 Agent](https://jwzheng96.github.io/from-hermes-learn-agent/)帮助定位值得讨论的问题。技术事实仍回到官方资料核对，未复制这些手册的正文和图片。

## 版本怎样记录

每章的核对版本独立保存在 `content/verification.json`。上游检查报告保存在本地 `.cache/sync/`，不会直接改动章节核对信息。只有正文、来源和相关图解都完成审核后，才推进受影响章节的记录。

最新发现的版本可能高于某章已核实版本；两者不能互相代替。新版本若没有影响讲解，也可以经核实后保留正文，不为版本号制造无意义改写。
