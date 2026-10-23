import DefaultTheme from 'vitepress/theme'
import { h } from 'vue'
import Home from './Home.vue'
import Roadmap from './Roadmap.vue'
import Verification from './Verification.vue'
import Figure from './Figure.vue'
import SourceVersions from './SourceVersions.vue'
import './style.css'

export default {
  extends: DefaultTheme,
  Layout: () => h(DefaultTheme.Layout),
  enhanceApp({ app }) {
    app.component('ManualHome', Home)
    app.component('ManualRoadmap', Roadmap)
    app.component('ChapterVerification', Verification)
    app.component('TeachingFigure', Figure)
    app.component('SourceVersions', SourceVersions)
  }
}
