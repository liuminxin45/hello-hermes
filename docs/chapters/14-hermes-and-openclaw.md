---
title: 14 Hermes 与 OpenClaw 的设计差异
description: 对齐版本与任务，从架构、记忆、技能和身份边界比较两个系统，并走完一次完整判断。
---

# 第十四章：Hermes 与 OpenClaw 的设计差异

“Hermes 会学习，OpenClaw 不会”“一个是 Agent，另一个只是网关”，这些说法很容易记住，也很容易抹掉真实实现。前十三章建立的机制视角，正是为了让比较不止于口号。

本章对照 Hermes **v0.22.5** 与 OpenClaw **v2026.10.6** 的官方资料。比较的是具体设计与配置，未做两者真实模型调用的同任务性能实验，因此不提供速度、准确率或成本排名。

<ChapterVerification chapter="14" />

## 14.1 两者都具备哪些共同构件

两者都组织模型、工具、上下文、会话、记忆与技能。都有需要处理的权限、任务生命周期和结果投递问题。某一产品宣传中特别强调一项能力，不代表另一产品完全没有对应机制。

<TeachingFigure src="/images/shared/comparison.webp" alt="从相同的机制问题阅读 Hermes 与 OpenClaw 的设计" caption="图 14-1　对照官方架构的阅读入口。两者都需要连接入口、运行机制与状态，不能按有无 Agent 简单二分。" />

## 14.2 从架构入口看责任怎样组织

Hermes 的架构资料以多入口进入 `AIAgent` 核心为一条清楚主线，再展开提示准备、模型访问、工具和状态处理。OpenClaw 的架构资料突出长期运行的 Gateway：客户端与节点通过协议连接，消息与控制经过网关，再进入会话与 Agent 运行。

这是两份官方架构资料提供的不同阅读切口，不意味着 Hermes 没有网关，也不意味着 OpenClaw 没有行动循环。OpenClaw 的 loop 文档同样展开了上下文组装、推理、工具执行、流式输出与持久化。

对学习者而言，可以先沿 Hermes 的任务核心建立机制图，再用 OpenClaw 的控制面、消息路由和会话队列补充系统运行视角。这是本书的学习路径建议，不是性能结论。

## 14.3 记忆的文件相似，组织与边界仍需细看

| 问题 | Hermes 本版资料 | OpenClaw 本版资料 |
| --- | --- | --- |
| 精选长期信息放哪里 | 基础记忆中的 MEMORY.md 与 USER.md | 工作区的 MEMORY.md 与 USER.md |
| 详细过程怎样保留 | 会话历史、文件及检索相关机制 | 每日笔记、会话及记忆检索相关机制 |
| 当前请求怎样得到材料 | 基础记忆在会话开始时加载冻结快照 | 会话启动材料有预算，相关记忆另按规则加载或检索 |
| 材料太多怎么办 | 基础记忆写入受容量约束，需整理后再写 | 文件可保留在磁盘，启动注入受预算约束，超限部分可能被截断 |

最后一行尤其值得注意：**“文件完整存在”和“模型完整读到”仍然是第五章的两个问题。** 不能只看两边都有 `MEMORY.md`，就推断容量、注入和更新规则完全相同。

OpenClaw 该版本的官方记忆资料也介绍了后台 dreaming 整理。因此不能把两者差异概括为“只有一方会整理经验”。实际选择还要看材料来源、更新规则、可观察性与纠错方式。

## 14.4 技能与持久身份，比较生命周期

Hermes 的技能体系包含按需加载、Agent 管理的方法材料和 Curator；OpenClaw 也有 `SKILL.md` 技能、多来源加载优先级与 Skill Workshop 等机制。两者都需要解决来源、适用条件、版本和修改边界。

想比较它们，应该追问：哪些来源可以被自动修改？更新何时进入运行会话？怎样恢复旧版本？哪些默认开启，哪些需要显式配置？不能仅凭“会创建技能”就判断经验积累质量。

身份单位同样不能按名字一一替换。Hermes 用 Profile 组织 home 与持久状态，并通过 Bot Mode 提供具名持续交互；OpenClaw 的多 Agent 路由资料围绕各 Agent 的工作区、状态目录、会话存储与 binding，决定消息进入哪个 Agent。临时委托与这些长期身份又是另一层概念。

## 14.5 用同一份简报任务做实际判断

下面是可操作的**教学评估方案**，不是已完成的对比实验：

1. 给双方相同官方材料、目标版本与交付要求，固定模型条件和可访问工具。
2. 检查它们能否定位每个结论的来源，并正确排除未发布变化。
3. 开启新的适当会话，观察长期偏好和历史细节分别怎样被找回。
4. 加入读取失败、冲突资料与越权文本，检查限制与未完成项是否如实表达。
5. 再测试需要的定时或协作场景，记录整项任务的总开销和恢复过程。

<TeachingFigure src="/images/shared/verification.webp" alt="比较结果需要追回证据和交付标准，不能由宣传标签代替" caption="图 14-2　回到共同标准：相同问题、可追溯证据和真实限制，比一张没有条件的排名表更有用。" />

如果你关心的是理解一次行动如何组织，就追模型、工具与反馈；如果关心多入口长期运行，就追身份、消息路由和恢复；如果关心经验积累，就追记忆和技能的完整生命周期。选择从具体需要开始，再回到对应实现与实验结果。

## 不写代码的小练习

从记忆、技能或会话中任选一项，分别找双方固定版本的官方依据，写出一个共同点、一个具体差异和一个仍需实测的问题。不给总分，先检查比较条件是否一致。

## 本章要点

- 两者都有 Agent 的核心构件，能力名称不能代替机制比较。
- Hermes 的核心任务路径与 OpenClaw 的 Gateway 视角提供不同的架构阅读切口。
- 记忆文件相似，不代表容量、注入、检索与维护行为相同。
- 技能、身份和协作要比较生命周期与边界；优劣需要同条件证据。

## 理解题

::: details 1. 为什么“双方都支持 SKILL.md”还不足以说明技能系统相同？
格式只是一个接口。来源优先级、发现、加载、修改权限、会话快照、维护与回退规则都可能不同，需要对照具体版本核实。
:::

::: details 2. 不做性能实验，本章仍能得到什么有用结论？
可以建立真实的责任和机制对照，识别重要的配置差异，形成需要核实的问题与实验方案。但不能据此给出实际速度、成本或任务成功率排名。
:::

## 对照官方实现

- Hermes：[架构](https://github.com/NousResearch/hermes-agent/blob/bf0203a794a07aac3ff764972ab9087baa4e4f4e/website/docs/developer-guide/architecture.md)、[记忆](https://github.com/NousResearch/hermes-agent/blob/bf0203a794a07aac3ff764972ab9087baa4e4f4e/website/docs/user-guide/features/memory.md)、[技能维护](https://github.com/NousResearch/hermes-agent/blob/bf0203a794a07aac3ff764972ab9087baa4e4f4e/website/docs/user-guide/features/curator.md)。
- OpenClaw：[Gateway 架构](https://github.com/openclaw/openclaw/blob/fe06181dc5ecc01cf8904abbfc26925925efefbc/docs/concepts/architecture.md)、[Agent loop](https://github.com/openclaw/openclaw/blob/fe06181dc5ecc01cf8904abbfc26925925efefbc/docs/concepts/agent-loop.md)、[记忆](https://github.com/openclaw/openclaw/blob/fe06181dc5ecc01cf8904abbfc26925925efefbc/docs/concepts/memory.md)、[技能](https://github.com/openclaw/openclaw/blob/fe06181dc5ecc01cf8904abbfc26925925efefbc/docs/tools/skills.md)、[多 Agent 路由](https://github.com/openclaw/openclaw/blob/fe06181dc5ecc01cf8904abbfc26925925efefbc/docs/concepts/multi-agent.md)。

从第一章的一条简报要求走到这里，我们已经有了一套可重复的提问方式：信息怎样进入，行动怎样发生，经验怎样留下，边界怎样执行，结果怎样核实。遇到下一次机制变化时，仍然可以沿着这条线读懂它。
