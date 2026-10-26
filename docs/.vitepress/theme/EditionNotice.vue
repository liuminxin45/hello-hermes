<script setup>
import { useData, withBase } from 'vitepress'
const { page } = useData()
</script>
<template>
  <aside v-if="page.relativePath.startsWith('chapters/')" class="edition-notice" aria-label="旧版章节提示">
    <strong>这是保留的旧版章节</strong>
    <p>新版按学习顺序逐章重构。原链接和本地批注记录继续保留，可从<a :href="withBase('/preface.html')">新版序言</a>开始，或查看<a :href="withBase('/roadmap.html')">学习路线与发布进度</a>。</p>
  </aside>
</template>
