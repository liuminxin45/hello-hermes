<script setup>
import { withBase } from 'vitepress'
import chapters from '../../../content/chapters.json'
import verification from '../../../content/verification.json'
const rows = chapters.filter(chapter => chapter.status === 'published').flatMap(chapter => Object.values(verification.chapters[chapter.id]?.upstreams || {}).map(source => ({ ...source, chapter })))
</script>
<template><div class="source-versions"><table><thead><tr><th>章节</th><th>核对依据</th><th>核对日期</th></tr></thead><tbody><tr v-for="row in rows" :key="`${row.chapter.id}-${row.repository}`"><td><a :href="withBase(`/${row.chapter.path || `chapters/${row.chapter.slug}`}.html`)">{{ row.chapter.id }} {{ row.chapter.title }}</a></td><td><a :href="`https://github.com/${row.repository}/tree/${row.commit}`">{{ row.label }} {{ row.tag }}</a></td><td>{{ row.verifiedAt }}</td></tr></tbody></table></div></template>
