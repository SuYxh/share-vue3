现vue3响应式系统核心-scheduler

## 简介

2023 年 12 月 31 日，vue2 已经停止维护了。你还不会 Vue3 的源码么？

手把手带你实现一个 vue3 响应式系统，你将获得：

- TDD 测试驱动开发
- 重构
- [vitest](https://cn.vitest.dev/) 的使用
- 如何使用  [ChatGPT](https://ask.vuejs.news/) 编写单元测试
- 响应式数据以及副作用函数
- 响应式系统基本实现
- Vue3 的响应式的数据结构是什么样？为什么是这样？如何形成的？
- Proxy 为什么要配合 Reflect 使用？如果不配合会有什么问题？
- Map 与  WeakMap的区别
- 依赖收集
- 派发更新
- 依赖清理
- 支持嵌套
- 实现执行调度
- 实现 computed
- 实现 watch
- excalidraw 画图工具

代码地址： https://github.com/SuYxh/share-vue3 

代码并没有按照源码的方式去进行组织，目的是学习、实现 vue3 响应式系统的核心，用最少的代码去实现最核心的能力，减少我们的学习负担，并且所有的流程都会有配套的图片，图文 + 代码，让我们学习更加轻松、快乐。

每一个功能都会提交一个 `commit` ，大家可以切换查看，也顺变练习练习 git 的使用。



## 调度执行

可调度性是响应系统非常重要的特性。首先我们需要明确什么是可调度性。所谓可调度，指的是当 `trigger` 动作触发副作用函数重新执行时，有能力决定副作用函数执行的时机、次数以及方式。

### 场景

```js
const obj = reactive({ foo: 1 })

effect(() => {
  console.log(obj.foo);
})

obj.foo ++

console.log('结束了');
```

当前代码执行顺序：

```
1
2
结束了
```

现在假设需求有变，输出顺序需要调整为：

```
1
结束了
2
```

根据打印结果我们很容易想到对策，即把语句` obj.foo++` 和语句` console.log('结束了')`位置互换即可。那么有没有什么办法能够在不调整代码的情况下实现需求呢？这时就需要响应系统支持调度。

我们可以为 `effect` 函数设计一个选项参数 `options`，允许用户指定调度器：

```js
effect(
  () => {
    console.log(obj.foo);
  },
  // options
  {
    // 调度器 scheduler 是一个函数
    scheduler(fn) {
      // ...
    }
  }
);
```



### 编写单元测试

```js
it('should follow the correct order', () => {
  // 保存原始的 console.log
  const originalConsoleLog = console.log;
  // 创建一个模拟的 console.log 函数
  const mockConsoleLog = vi.fn();
  global.console.log = mockConsoleLog; // 重定向 console.log 到 mock 函数

  const obj = reactive({ foo: 1 })

  effect(() => {
    mockConsoleLog(obj.foo);
  }, {
    scheduler: function (fn) {
      // 将副作用函数放到宏任务队列中执行
      setTimeout(fn, 0);
    }
  })

  obj.foo++;

  mockConsoleLog('结束了');

  // 检查调用顺序
  expect(mockConsoleLog.mock.calls[0][0]).toBe(1); // 第一次调用，参数应该是 1
  expect(mockConsoleLog.mock.calls[1][0]).toBe('结束了'); // 第二次调用，参数应该是 '结束了'

  // 清理模拟
  mockConsoleLog.mockClear();
  global.console.log = originalConsoleLog; // 恢复 console.log
});
```

这个单元测试有点难，如果看不明白，当代码实现后，直接使用这个代码去运行，也是可以

```js
effect(
  () => {
    console.log('effect', obj.foo);
  },
  // options
  {
    // 调度器 scheduler 是一个函数
    scheduler(fn) {
      console.log('scheduler');
      // 将副作用函数放到宏任务队列中执行
      setTimeout(fn);
    }
  }
);

obj.foo++;

console.log('结束了');
```



### 代码实现

1、首先保存一下用户传入的 `options` ，将其挂载到 `effectFn` 函数上

```js
export function effect(fn, options = {}) {
  // ...
  // 将 options 挂载到 effectFn 上
  effectFn.options = options; // 新增
  // effectFn.deps 用来存储所有与该副作用函数相关联的依赖集合
  effectFn.deps = [];
  // 执行副作用函数
  effectFn();
}
```



2、在 `trigger` 函数中触发副作用函数重新执行时，就可以直接调用用户传递的调度器函数，从而把控制权交给用户

```js
function trigger(target, key) {
  const depsMap = bucket.get(target);
  if (!depsMap) return;
  const effects = depsMap.get(key);

  const effectsToRun = new Set();
  effects && effects.forEach(effectFn => {
    // 如果 trigger 触发执行的副作用函数与当前正在执行的副作用函数相同，则不触发执行
    if (effectFn !== activeEffect) { 
      effectsToRun.add(effectFn);
    }
  });
  effectsToRun.forEach(effectFn => {
    if (effectFn.options.scheduler) {
      effectFn.options.scheduler(effectFn)
    } else {
      effectFn()
    }
  });
}
```



### 运行单测

![image-20240118155004753](https://qn.huat.xyz/mac/202401181550800.png)



### 执行 test

![image-20240118155042555](https://qn.huat.xyz/mac/202401181550595.png)

之前的 case 也没有问题！

相关代码在 `commit： (997ecd0)实现调度执行 ，`git checkout 997ecd0` 即可查看。 

### 流程图



![image-20240118154336393](https://qn.huat.xyz/mac/202401181543434.png)









