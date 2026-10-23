---
title: 贡献与本地维护
prev: false
next: false
---

# 贡献与本地维护

发现解释不清或事实过期时，请指出章节、小节、疑问和依据。对机制的修正优先提供固定版本的官方文档、源码或可复现记录。

## 本地预览

安装 Node.js 22.12 或更新版本，在仓库根目录执行：

```sh
npm ci
npm run docs:dev
```

提交前执行 `npm test`、`npm run docs:build`。远程来源可运行 `npm run check:links` 检查；网络失败需要区分不可达和页面已失效。图片、布局或搜索变化还需浏览器检查。

## 在 Codex 中跟上官方最新

在 Codex 打开本仓库，输入：

```text
跟上官方最新，更新手册。
```

或显式使用 `$hello-hermes-sync`。技能位于 `.agents/skills/hello-hermes-sync/SKILL.md`，支持仓库技能的 Codex 可以自动发现它。界面暂未显示时，可直接让 Codex 读取这个文件；无需复制一份到全局目录。

流程先运行 `npm run sync:check` 收集只读报告，再核对差异、修改受影响章节和图片，完成验证后创建或更新 `codex/sync-upstream` 的维护 PR。GitHub 读写使用已登录的连接或 `gh`；不需要另配置内容生成 API。

报告脚本需要 Git 和已登录的 GitHub CLI（`gh`）；图解更新需要当前 Codex 环境提供 imagegen。缺少这些能力时，技能应说明具体缺口，保留已完成的草稿与证据，不能宣称维护已全部完成。

报告会标明脏工作区、现有 PR、比较是否完整、未发布变化及错误。工具不会自行宣布章节已核对，也不会自动合并 PR。图片工具不可用时保留待补图项，不将这次修订报告为完整完成。

## 内容与图解的约定

写作前读仓库中的 `editorial/writing.md`，配图前读 `editorial/visuals.md`。每章回答一个问题，保留例子、推理、代价和来源。图文一起审核，避免改了机制却留下旧箭头。

正文及原创图解采用 [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)，站点代码、维护脚本和 skill 采用 MIT。第三方资料保持原链接与归属。
