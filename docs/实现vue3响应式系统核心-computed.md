现vue3响应式系统核心-computed

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



## computed 实现

前文介绍了 `effect` 函数，它用来注册副作用函数，同时它也允许指定一些选项参数 `options`，例如指定 `scheduler`调度器来控制副作用函数的执行时机和方式；也介绍了用来追踪和收集依赖的` track`函数，以及用来触发副作用函数重新执行的 `trigger`函数。综合这些内容，我们就可以实现 Vue.js 中一个非常重要并且非常有特色的能力——计算属性。

### 增加 lazy 配置

在深入讲解计算属性之前，我们需要先来聊聊关于懒执行的` effect`，即` lazy`的 `effect`。这是什么意思呢？举个例子，现在我们所实现的 `effect`函数会立即执行传递给它的副作用函数。但在有些场景下，我们并不希望它立即执行，而是希望它在需要的时候才执行，例如计算属性。这时我们可以通过在 `options` 中添加`lazy` 属性来达到目的，如下面的代码所示：

```js
effect(
  // 指定了 lazy 选项，这个函数不会立即执行
  () => {
    console.log(obj.foo);
  },
  // options
  {
    lazy: true
  }
);
```

老套路，还通过配置项传入：

```js
function effect(fn, options = {}) {
    const effectFn = () => {
        cleanup(effectFn);
        activeEffect = effectFn;
        effectStack.push(effectFn);
        fn();
        effectStack.pop();
        activeEffect = effectStack[effectStack.length - 1];
    }
    effectFn.options = options;
    effectFn.deps = [];

    // 只有非 lazy 的时候，才执行
    if (!options.lazy) { // 新增
        // 执行副作用函数
        effectFn();
    }

    // 将副作用函数作为返回值返回
    return effectFn; // 新增
}
```

我们就可以手动去执行副作用函数，如果我们把传递给 effect 的函数看作一个 getter，那么这个 getter 函数可以返回任何值，这样我们在手动执行副作用函数时，就能够拿到其返回值：

```js
const effectFn = effect(
    // getter 返回 obj.foo 与 obj.bar 的和
    () => obj.foo + obj.bar,
    { lazy: true }
);

// value 是 getter 的返回值
const value = effectFn();
```

为了实现这个目标，我们需要再对 effect 函数做一些修改，如以下代码所示：

```js
function effect(fn, options = {}) {
    const effectFn = () => {
        // ...
        const res = fn();
       	// ...
      	return res
    }
    // ...
    return effectFn; 
}
```

通过新增的代码可以看到，传递给 `effect` 函数的参数 `fn` 才是真正的副作用函数，而 `effectFn`是我们包装后的副作用函数。为了通过`effectFn` 得到真正的副作用函数` fn `的执行结果，我们需要将其保存到` res `变量中，然后将其作为` effectFn `函数的返回值。



### 基础 computed

现在我们已经能够实现懒执行的副作用函数，并且能够拿到副作用函数的执行结果了，接下来就可以实现计算属性了，如下所示：

```js
function computed(getter) {
    // 把 getter 作为副作用函数，创建一个 lazy 的 effect
    const effectFn = effect(getter, {
        lazy: true
    });

    const obj = {
        // 当读取 value 时才执行 effectFn
        get value() {
            return effectFn();
        }
    };

    return obj;
}
```

首先我们定义一个 `computed` 函数，它接收一个 `getter` 函数作为参数，我们把 `getter` 函数作为副作用函数，用它创建一个` lazy `的`effect` 。`computed` 函数的执行会返回一个对象，该对象的 `value` 属性是一个访问器属性，只有当读取 `value` 的值时，才会执行 `effectFn` 并将其结果作为返回值返回。

#### 编写单测

新建一个 `computed.spec.js`

```js
it("base computed", () => {
  // 创建响应式对象
  const obj = reactive({ price: 100, num: 10 });

  const allPrice = computed(() => obj.price * obj.num)

  expect(allPrice.value).toBe(1000);
});
```



#### 执行一下

![image-20240118170122880](https://qn.huat.xyz/mac/202401181701923.png)





### 增加缓存

上面的代码多次访问 `allPrice.value` 的值，每次访问都会调用 `effectFn` 重新计算。所以我们需要进行修改：

```js
function computed(getter) {
  // value 用来缓存上一次计算的值
  let value;
  // dirty 标志，用来标识是否需要重新计算值，为 true 则意味着“脏”，需要计算
  let dirty = true;

  const effectFn = effect(getter, {
    lazy: true
  });

  const obj = {
    get value() {
      // 只有“脏”时才计算值，并将得到的值缓存到 value 中
      if (dirty) {
        value = effectFn();
        // 将 dirty 设置为 false，下一次访问直接使用缓存到 value 中的值
        dirty = false;
      }
      return value;
    }
  };

  return obj;
}
```

我们新增了两个变量 `value` 和 `dirty`，其中 `value` 用来缓存上一次计算的值，而`dirty` 是一个标识，代表是否需要重新计算。当我们通过 `allPrice.value` 访问值时，只有当` dirty` 为` true` 时才会调用` effectFn`重新计算值，否则直接使用上一次缓存在 `value` 中的值。这样无论我们访问多少次 `allPrice.value`，都只会在第一次访问时进行真正的计算，后续访问都会直接读取缓存的 `value` 值。

那么问题又来了，如果此时我们修改 `obj.num`或 `obj.price`的值，再访问 `allPrice.value`，会发现访问到的值没有发生变化。

问题就是 `dirty` 的状态我们只进行了关闭，并没有进行打开？那么什么时候打开呢？

```js
function computed(getter) {
  let value;
  let dirty = true;

  const effectFn = effect(getter, {
    lazy: true,
    // 添加调度器，在调度器中将 dirty 重置为 true
    scheduler() {
      dirty = true;
    }
  });

  const obj = {
    get value() {
      //...
      return value;
    }
  };

  return obj;
}
```

我们为 `effect` 添加了 `scheduler`调度器函数，它会在 `getter` 函数中所依赖的响应式数据变化时执行，这样我们在 `scheduler`函数内将 `dirty`重置为 `true`，当下一次访问` allPrice.value `时，就会重新调用 `effectFn` 计算值，这样就能够得到预期的结果了。



### 优化

现在，我们设计的计算属性已经趋于完美了，但还有一个缺陷，它体现在当我们在另外一个 effect 中读取计算属性的值时。

#### 编写单测

看看这个 case：

```js
it("computed track and trigger", () => {
  const mockFn = vi.fn();
  // 创建响应式对象
  const obj = reactive({ price: 100, num: 10 });

  // 创建计算属性
  const allPrice = computed(() => obj.price * obj.num);

  effect(() => {
    mockFn()
    console.log(allPrice.value);
  })

  expect(mockFn).toHaveBeenCalledTimes(1);

  obj.num = 20;
  expect(allPrice.value).toBe(2000);
  expect(mockFn).toHaveBeenCalledTimes(2);
});
```

如以上代码所示，`allPrice`是一个计算属性，并且在另一个 `effect` 的副作用函数中读取了 `allPrice.value` 的值。如果此时修改 `obj.num`的值，我们期望副作用函数重新执行，就像我们在 Vue.js 的模板中读取计算属性值的时候，一旦计算属性发生变化就会触发重新渲染一样。



#### 运行单测

运行 case 看看：

![image-20240118172427066](https://qn.huat.xyz/mac/202401181724117.png)

修改`obj.num` 的值， `mockFn`函数并没有被调用，也就是说修改值并不会触发副作用函数的渲染，因此我们说这是一个缺陷。

#### 问题分析

从本质上看这就是一个典型的` effect` 嵌套。一个计算属性内部拥有自己的 `effect`，并且它是懒执行的，只有当真正读取计算属性的值时才会执行。对于计算属性的 `getter`
函数来说，它里面访问的响应式数据只会把 `computed`内部的 `effect`收集为依赖。而当把计算属性用于另外一个 `effect`时，就会发生` effect`嵌套，外层的 `effect`不会被内层 `effect`中的响应式数据收集。

#### 解决

当读取计算属性的值时，我们可以手动调用 `track` 函数进行追踪；当计算属性依赖的响应式数据发生变化时，我们可以手动调用` trigger`函数触发响应：

```js
function computed(getter) {
  let value;
  let dirty = true;

  const effectFn = effect(getter, {
    lazy: true,
    // 添加调度器，在调度器中将 dirty 重置为 true
    scheduler() {
      dirty = true;
      trigger(obj, 'value')
    }
  });

  const obj = {
    get value() {
      if (dirty) {
        console.log('执行 effectFn');
        value = effectFn();
        dirty = false;
      }
      track(obj, 'value')
      return value;
    }
  };

  return obj;
}
```

> 修改 track 方法，if (!activeEffect) return  target[key]  改成 if (!activeEffect) return， 否则会出现死循环

再次运行 case

![image-20240118173918934](https://qn.huat.xyz/mac/202401181739992.png)

### 抽离代码

新建一个 `computed`文件，写入：

```js
import { effect, track, trigger } from "./main";
export function computed(getter) {
  let value;
  let dirty = true;

  const effectFn = effect(getter, {
    lazy: true,
    // 添加调度器，在调度器中将 dirty 重置为 true
    scheduler() {
      dirty = true;
      trigger(obj, "value");
    },
  });

  const obj = {
    get value() {
      if (dirty) {
        value = effectFn();
        dirty = false;
      }
      track(obj, "value");
      return value;
    },
  };

  return obj;
}
```



### 运行测试

```
pnpm test
```

![image-20240118174340233](https://qn.huat.xyz/mac/202401181743302.png)

看，我们忘了修改`track`、`trigger` 以及单测的导入，直接跑不通了。 修改后再次运行：

![image-20240118174635635](https://qn.huat.xyz/mac/202401181746695.png)

测试就通过了





### 流程图

![image-20240118181420641](https://qn.huat.xyz/mac/202401181814679.png)







