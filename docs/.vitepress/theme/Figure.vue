<script setup>
import { ref } from 'vue'
import { withBase } from 'vitepress'
defineProps({ src: String, alt: String, caption: String })
const dialog = ref(null)
</script>
<template>
  <figure class="teaching-figure">
    <button class="figure-open" type="button" :aria-label="`${alt}，点击放大`" @click="dialog.showModal()">
      <img :src="withBase(src)" :alt="alt" width="1536" height="1024" loading="lazy">
    </button>
    <figcaption>{{ caption }} <span class="zoom-hint">点击图解可放大</span></figcaption>
    <dialog ref="dialog" class="figure-dialog" :aria-label="alt" @click="event => { if (event.target === dialog) dialog.close() }">
      <div class="figure-toolbar">
        <span class="figure-pan-hint">左右滑动查看图解细节</span>
        <button class="figure-close" type="button" aria-label="关闭图解" @click="dialog.close()">关闭 ×</button>
      </div>
      <div class="figure-detail" tabindex="0" role="region" aria-label="放大图解，可滚动查看">
        <img :src="withBase(src)" :alt="alt">
      </div>
      <p>{{ caption }}</p>
    </dialog>
  </figure>
</template>
