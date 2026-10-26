<script setup>
import verification from '../../../content/verification.json'
import legacy from '../../../content/archive/verification-v1.json'
import { useData } from 'vitepress'
const { page } = useData()
const props = defineProps({ chapter: { type: String, required: true } })
</script>
<template><aside class="chapter-verification" aria-label="本章核对依据"><span v-for="source in Object.values((page.relativePath.startsWith('chapters/') ? legacy : verification).chapters[props.chapter]?.upstreams || {})" :key="source.repository">依据 <a :href="`https://github.com/${source.repository}/tree/${source.commit}`">{{ source.label }} {{ source.tag }}</a> · 核对于 {{ source.verifiedAt }}</span><span>案例为教学示意，源码依据见章末。</span></aside></template>
