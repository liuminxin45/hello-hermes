# hello-hermes

本项目面向会用聊天 AI 的中文读者。学习终点是解释 Agent 的系统关系和核心设计取舍，并能迁移分析新需求；不以理解 API、安装 Hermes、编程或阅读 Python 为前提。

- 写作前读 `editorial/writing.md`，制作或修改图解前读 `editorial/visuals.md`。
- 新版目录是 `content/chapters.json`，章节路径由 `path` 指定。只将 published 章节加入阅读导航与搜索；规划中的章节只在路线图展示，不生成空页面。新版位于 `docs/learn/`；旧版 `docs/chapters/` 及 `content/archive/` 保留，不把旧版核对记录或完成态继承到新版。
- 来源、核对版本与图解验收在 `content/verification.json`。核对日期必须来自实际审核；生成报告、构建和部署不代表核对完成。
- 用户要求“跟上官方最新”“同步官方变更”“更新手册到最新版本”时，使用 `.agents/skills/hello-hermes-sync/SKILL.md`。只修订已发布章节；新章节另按大纲推进。
- 核实官方稳定版本源码和测试。新版正文不提供源码跳转和引用；固定提交与核对证据保存在内部记录。教学分层不冒充官方实现的严格分层，未发布变化单独记录。
- 重构依照 `editorial/curriculum-design.md`。两张主图贯穿全书，每章承接案例的已有成果，说明新增机制、交互、替代方案和限制。受控模块实验不冒充模型决策或完整 Agent 回放。
- 教学示意要明确标注，不能写成实测结果。不要将记忆或技能更新描述为模型权重训练。
- 维护 PR 使用 `codex/sync-upstream`；先查询现有 PR，复用未完成更新。保留用户修改，必要时在独立 worktree 工作。通过校验后交付 PR，由维护者审核合并。
- 用户说“按批注修改手册”“处理本地批注”时，先读 `editorial/review-workflow.md`，运行 `node scripts/review.mjs list` 和 `begin`。按冻结批次改 Markdown 与必要配图，验证后再核销；不要直接覆盖 `.review/annotations.json`，不要把原文定位失败当作已解决。
- `npm test`、`npm run docs:build` 是提交前检查；涉及图或界面时还需浏览器检查深浅主题和手机布局。远程链接用 `npm run check:links` 核实。
- GitHub Actions 只做校验和部署；本项目不配置定时内容生成或模型 API 凭据。
- 本地服务与批注代码随仓库发布；`.review/`、草稿、会话凭据均不提交。公共构建不得包含批注控件、接口脚本或数据，必须通过 `scripts/check-public-output.mjs`。

正文与原创图解 CC BY-SA 4.0；站点代码、脚本及 skill 为 MIT。第三方材料保留原链接与归属。
