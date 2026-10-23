<script setup>
import { withBase } from 'vitepress'
import chapters from '../../../content/chapters.json'
const published = chapters.filter(chapter => chapter.status === 'published')
</script>

<template>
  <main class="manual-home">
    <section class="book-intro" aria-labelledby="book-title">
      <div class="intro-copy">
        <p class="book-kicker">一本逐章更新的中文图解手册</p>
        <h1 id="book-title">从 Hermes<br>理解 <span>Agent</span></h1>
        <p class="intro-description">一次任务怎样完成？经验怎样留下？<br>沿着这些问题，弄懂智能体的机制与取舍。</p>
        <div class="intro-actions"><a class="primary-link" :href="withBase('/chapters/01-from-chat-to-action.html')">从第一章开始 <span aria-hidden="true">↗</span></a><a :href="withBase('/preface.html')">先读序言</a></div>
        <p class="intro-note">了解大模型，就可以开始。正文不要求编程。</p>
      </div>
      <figure class="intro-figure"><img :src="withBase('/images/ch01/three-approaches.webp')" width="1536" height="1024" alt="聊天回答、固定工作流与 Agent 的行动方式对照图" fetchpriority="high"><figcaption>从“给出回答”，走到“根据结果调整行动”。</figcaption></figure>
    </section>
    <section class="reading-start" aria-labelledby="reading-title">
      <div class="section-title"><h2 id="reading-title">从这里读起</h2><a :href="withBase('/roadmap.html')">查看十四章路线 <span aria-hidden="true">→</span></a></div>
      <a v-for="chapter in published.slice(0, 2)" :key="chapter.id" class="chapter-entry" :href="withBase(`/chapters/${chapter.slug}.html`)"><span class="chapter-number">{{ chapter.id }}</span><div><h3>{{ chapter.title }}</h3><p>{{ chapter.question }}</p></div><span class="chapter-arrow" aria-hidden="true">↗</span></a>
    </section>
    <section class="book-about"><h2>沿着一个任务，拆开一个系统</h2><div><p>我们用“查资料、核对来源、形成技术简报”贯穿全书。先认识行动循环，再逐步加入上下文、记忆、技能和协作。</p><p>每个结论都尽量回到官方文档、对应版本的源码与测试。Hermes 和 OpenClaw 的比较也从具体机制出发，说明选择背后的代价。</p><a :href="withBase('/sources.html')">查看版本与来源 →</a></div></section>
  </main>
</template>
