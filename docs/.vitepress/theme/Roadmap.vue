<script setup>
import { withBase } from 'vitepress'
import chapters from '../../../content/chapters.json'
const parts = [...new Set(chapters.map(chapter => chapter.part))]
</script>
<template>
  <section v-for="part in parts" :key="part" class="roadmap-part">
    <h2 :id="part">{{ part }}</h2>
    <div v-for="chapter in chapters.filter(item => item.part === part)" :key="chapter.id" class="roadmap-entry">
      <span class="chapter-number">{{ chapter.id }}</span>
      <div><h3><a v-if="chapter.status === 'published'" :href="withBase(`/${chapter.path || `chapters/${chapter.slug}`}.html`)">{{ chapter.title }}</a><template v-else>{{ chapter.title }}</template></h3><p>{{ chapter.question }}</p><p class="roadmap-outcome">学完能做：{{ chapter.outcome }}</p></div>
      <span class="chapter-state">{{ chapter.status === 'published' ? '已发布 · 阅读' : '计划中' }}</span>
    </div>
  </section>
</template>
