import { defineConfig } from 'vitepress'
import { readFileSync } from 'node:fs'

const catalog = JSON.parse(readFileSync(new URL('../../content/chapters.json', import.meta.url), 'utf8'))
const published = catalog.filter(chapter => chapter.status === 'published')
const chapterPath = chapter => chapter.path || `chapters/${chapter.slug}`
const groups = [...new Set(published.map(chapter => chapter.part))].map(part => ({
  text: part,
  items: published.filter(chapter => chapter.part === part).map(chapter => ({ text: `${chapter.id} ${chapter.title}`, link: `/${chapterPath(chapter)}` }))
}))

export default defineConfig({
  lang: 'zh-CN',
  title: 'hello-hermes',
  description: '从 Hermes 理解 Agent：核心机制、设计取舍与 OpenClaw 对照。一本逐章更新的中文图解手册。',
  base: '/hello-hermes/',
  cleanUrls: false,
  srcExclude: catalog.filter(chapter => chapter.status !== 'published').map(chapter => `${chapterPath(chapter)}.md`),
  transformPageData(pageData) {
    if (pageData.relativePath.startsWith('chapters/')) {
      pageData.frontmatter.search = false
      pageData.frontmatter.sidebar = false
      pageData.frontmatter.prev = false
      pageData.frontmatter.next = false
    }
  },
  lastUpdated: false,
  sitemap: { hostname: 'https://liuminxin45.github.io/hello-hermes/' },
  head: [['link', { rel: 'icon', href: '/hello-hermes/favicon.svg', type: 'image/svg+xml' }], ['meta', { name: 'theme-color', content: '#fdfdfb' }]],
  markdown: { image: { lazyLoading: true } },
  themeConfig: {
    logo: '/favicon.svg',
    siteTitle: 'hello-hermes',
    nav: [{ text: '开始阅读', link: '/preface' }, { text: '全书路线', link: '/roadmap' }, { text: '维护记录', link: '/updates' }],
    sidebar: [{ text: '阅读之前', items: [{ text: '序言 · 怎样读这本手册', link: '/preface' }, { text: '全书路线', link: '/roadmap' }, { text: '贯穿案例 · 资料与观察', link: '/casebook' }] }, ...groups, { text: '随手查阅', items: [{ text: '术语表', link: '/glossary' }, { text: '版本与来源', link: '/sources' }, { text: '维护记录', link: '/updates' }, { text: '贡献与本地维护', link: '/contributing' }, { text: '旧版十四章档案', link: '/legacy' }] }],
    outline: { level: [2, 3], label: '本章内容' },
    docFooter: { prev: '上一篇', next: '下一篇' },
    darkModeSwitchLabel: '主题', lightModeSwitchTitle: '切换浅色主题', darkModeSwitchTitle: '切换深色主题', sidebarMenuLabel: '章节目录', returnToTopLabel: '返回顶部', outlineTitle: '本章内容',
    search: { provider: 'local', options: {
      _render(source, env, md) {
        if (env.relativePath.startsWith('chapters/')) return ''
        const html = md.render(source, env)
        return env.frontmatter?.search === false ? '' : html
      },
      miniSearch: { options: { tokenize(text) { return Array.from(new Intl.Segmenter('zh-CN', { granularity: 'word' }).segment(text), item => item.segment).filter(word => /[\p{L}\p{N}]/u.test(word)) } } },
      translations: { button: { buttonText: '搜索手册', buttonAriaLabel: '搜索手册' }, modal: { noResultsText: '没有找到相关内容', resetButtonTitle: '清空', backButtonTitle: '返回', displayDetails: '显示详情', footer: { selectText: '选择', navigateText: '切换', closeText: '关闭' } } }
    } },
    socialLinks: [{ icon: 'github', link: 'https://github.com/liuminxin45/hello-hermes' }],
    editLink: { pattern: 'https://github.com/liuminxin45/hello-hermes/edit/main/docs/:path', text: '在 GitHub 上提出修改' },
    footer: { message: '社区学习手册 · 正文与原创图解 CC BY-SA 4.0 · 代码 MIT', copyright: 'hello-hermes' }
  }
})
