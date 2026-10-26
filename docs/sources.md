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

新版基础材料为自编教学资料。第四章包含固定版本工具注册表的真实受控执行，调用请求由固定驱动提供，模型调用数为零；结果与限制见[案例页](./casebook.md)。它不等于完整 Hermes 回放，也不代表模型会选对工具。当前没有声称完成真实模型调用或性能基准测试。

第十五章另有投递队列的真实受控执行，使用临时数据库、本地回调和注入的零等待预算；没有实际外发，也未覆盖完整调度或死进程探测。范围与原始记录见案例页。

旧版的核对记录另行保留。新版 OpenClaw 对照重新核对 v2026.10.7，不继承旧版日期或完成状态。

## 一手资料

- [Hermes 固定版本源码](https://github.com/NousResearch/hermes-agent/tree/bf0203a794a07aac3ff764972ab9087baa4e4f4e)
- [Hermes 该版本官方文档源码](https://github.com/NousResearch/hermes-agent/tree/bf0203a794a07aac3ff764972ab9087baa4e4f4e/website/docs)
- [Hermes 该版本测试目录](https://github.com/NousResearch/hermes-agent/tree/bf0203a794a07aac3ff764972ab9087baa4e4f4e/tests)
- [OpenClaw 固定版本源码与文档](https://github.com/openclaw/openclaw/tree/157d8c2bc3ea2fa183afdc11088e69690bf8e64e)
- [Anthropic：Building effective agents](https://www.anthropic.com/research/building-effective-agents)，用于工作流与 Agent 的概念区分；这篇文章写于 2024 年，产品工具细节不作为当前版本依据。
- [ReAct 论文](https://arxiv.org/abs/2210.03629)，用于理解推理与行动交替的研究背景；不将论文中的提示结构视为所有现代 Agent 的统一实现。
- [MCP 规范](https://modelcontextprotocol.io/specification/2025-06-18)，用于理解协议与应用职责的边界。
- [Agent Skills 规范](https://agentskills.io/specification)，用于理解技能文档格式。

## 写法参考

[Hello Agents](https://hello-agents.datawhale.cc/) 提供由概念到实例的讲解参考；[Hermes Agent 完全学习手册](https://lucky7jia.github.io/hermes-agent-tutorial/)与[从 Hermes 学 Agent](https://jwzheng96.github.io/from-hermes-learn-agent/)帮助定位值得讨论的问题。技术事实仍回到官方资料核对，未复制这些手册的正文和图片。

## 版本怎样记录

每章的核对版本独立保存在 `content/verification.json`。上游检查报告保存在本地 `.cache/sync/`，不会直接改动章节核对信息。只有正文、来源和相关图解都完成审核后，才推进受影响章节的记录。

最新发现的版本可能高于某章已核实版本；两者不能互相代替。新版本若没有影响讲解，也可以经核实后保留正文，不为版本号制造无意义改写。
