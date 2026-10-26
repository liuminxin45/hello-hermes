<script setup>
import { withBase } from 'vitepress'
import chapters from '../../../content/chapters.json'
const published = chapters.filter(chapter => chapter.status === 'published')
</script>

<template>
  <main class="manual-home">
    <section class="book-intro" aria-labelledby="book-title">
      <div class="intro-copy">
        <p class="book-kicker">从会用聊天 AI，到理解 Agent 的完整系统</p>
        <h1 id="book-title">从 Hermes<br>理解 <span>Agent</span></h1>
        <p class="intro-description">看懂一次任务，画出系统关系，<br>再解释工具、记忆与协作背后的设计。</p>
        <div class="intro-actions"><a class="primary-link" :href="withBase(`/${published[0].path}.html`)">从第一章开始 <span aria-hidden="true">↗</span></a><a :href="withBase('/preface.html')">先读序言</a></div>
        <p class="intro-note">不要求编程。新版已发布 {{ published.length }} 个单元，按学习顺序继续更新。</p>
      </div>
      <figure class="intro-figure"><img :src="withBase('/images/ch01/three-approaches.webp')" width="1536" height="1024" alt="聊天回答、固定工作流与 Agent 的行动方式对照图" fetchpriority="high"><figcaption>从“给出回答”，走到“根据结果调整行动”。</figcaption></figure>
    </section>
    <section class="reading-start" aria-labelledby="reading-title">
      <div class="section-title"><h2 id="reading-title">从这里读起</h2><a :href="withBase('/roadmap.html')">查看完整学习路线 <span aria-hidden="true">→</span></a></div>
      <a v-for="chapter in published.slice(0, 2)" :key="chapter.id" class="chapter-entry" :href="withBase(`/${chapter.path}.html`)"><span class="chapter-number">{{ chapter.id }}</span><div><h3>{{ chapter.title }}</h3><p>{{ chapter.question }}</p></div><span class="chapter-arrow" aria-hidden="true">↗</span></a>
    </section>
    <section class="book-about"><h2>一个助手，逐步增加能力</h2><div><p>从一份消息简报开始，先看清目标、行动和反馈，再加入上下文、会话、记忆、技能和长期运行。每章留下可供下一章使用的成果。</p><p>两张统一主图连接全书；机制解释结合固定版本核对与标明范围的观察。最后用一个新需求，检验能否解释组件选择和取舍。</p><a :href="withBase('/casebook.html')">查看贯穿案例与观察材料 →</a></div></section>
  </main>
</template>
