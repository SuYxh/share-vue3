import { defineConfig } from 'vitepress'

// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: "实现Vue核心模块",
  description: "vue3学习与思考",
  themeConfig: {
    // https://vitepress.dev/reference/default-theme-config
    nav: [
      { text: 'Home', link: '/' },
      { text: 'reactive', link: '../reactive/index.md' }
    ],

    sidebar: [
      {
        text: 'Reactive',
        items: [
          { text: 'MVP模型', link: '../reactive/实现vue3响应式系统核心-MVP模型.md' },
          { text: '依赖清理', link: '../reactive/实现vue3响应式系统核心-依赖清理.md' },
          { text: '嵌套effect', link: '../reactive/实现vue3响应式系统核心-嵌套effect.md' },
          { text: 'scheduler', link: '../reactive/实现vue3响应式系统核心-scheduler.md' },
          { text: 'computed', link: '../reactive/实现vue3响应式系统核心-computed.md' },
          { text: 'watch', link: '../reactive/实现vue3响应式系统核心-watch.md' },
          { text: '增强对象拦截', link: '../reactive/实现vue3响应式系统核心-增强对象拦截.md' },
          { text: '合理触发响应', link: '../reactive/实现vue3响应式系统核心-合理触发响应.md' },
          { text: 'shallowReactive', link: '../reactive/实现vue3响应式系统核心-shallowReactive.md' },
          { text: 'readonly&shallowReadonly', link: '../reactive/实现vue3响应式系统核心-readonly&shallowReadonly.md' },
        ]
      }
    ],

    socialLinks: [
      { icon: 'github', link: 'https://github.com/SuYxh/share-vue3' }
    ]
  }
})
