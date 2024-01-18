---
# https://vitepress.dev/reference/default-theme-home-page
layout: home

hero:
  name: "实现Vue核心模块"
  text: "vue3学习与思考"
  tagline: Study hard
  actions:
    - theme: brand
      text: Go -->
      link: ./reactive/index
    # - theme: alt
    #   text: API Examples
    #   link: /api-examples

features:
  - title: Reactivity
    details: Vue 3 的响应式系统使用 ES6 的 Proxy 特性来追踪和响应数据状态的改变，为构建动态用户界面提供了高效的数据绑定和更新机制
  - title: Runtime
    details: Vue 3 的运行时环境负责处理模板到真实 DOM 的渲染，组件的生命周期管理，以及通过优化和 Tree-shaking 提供更快速、轻量级的应用性能
  - title: Compiler
    details: Vue 3 的编译器将模板代码转换成高效的 JavaScript 渲染函数，通过编译时优化提高应用运行时的性能和效率
---

