现vue3响应式系统核心-watch

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



## watch 实现

` watch`本质就是观测一个响应式数据，当数据发生变化时通知并执行相应的回调函数。实际上，`watch`的实现本质上就是利用了 `effect` 以及 `options.scheduler`选项。

### 编写单测

假设 obj是一个响应数据，使用 watch 函数观测它，并传递一个回调函数，当修改响应式数据的值时，会触发该回调函数执行。

```js
it("base watch", () => {
  const mockFn = vi.fn();

  // 创建响应式对象
  const obj = reactive({ foo: 100 });

  watch(obj, () => {
    mockFn()
  });

  obj.foo ++

  expect(mockFn).toHaveBeenCalledTimes(1);
});
```



### 代码实现

在一个副作用函数中访问响应式数据 `obj.foo`，通过前面的介绍，我们知道这会在副作用函数与响应式数据之间建立联系，当响应式数据变化时，会触发副作用函数重新执行。但有一个例外，即如果副作用函数存在 `scheduler`选项，当响应式数据发生变化时，会触发 `scheduler`调度函数执行，而非直接触发副作用函数执行。从这个角度来看，其实 `scheduler`调度函数就相当于一个回调函数，而 `watch`的实现就是利用了这个特点。下面是最简单的 watch 函数的实现：

```js
// watch 函数接收两个参数，source 是响应式数据，cb 是回调函数
function watch(source, cb) {
  effect(
    // 触发读取操作，从而建立联系
    () => source.foo,
    {
      scheduler() {
        // 当数据变化时，调用回调函数 cb
        cb();
      }
    }
  );
}
```



### 运行单测

![image-20240118183001505](https://qn.huat.xyz/mac/202401181830541.png)



### 支持所有属性监听

在来看一个 case

```js
 it("watch 多个属性", () => {
    const mockFn = vi.fn();

    // 创建响应式对象
    const obj = reactive({ foo: 100, bar: 200, age: 10 });

    watch(obj, () => {
      mockFn()
    });
    
    obj.bar ++

    obj.age ++

    expect(mockFn).toHaveBeenCalledTimes(2);
  });
```

执行一下

![image-20240118191155795](https://qn.huat.xyz/mac/202401181911825.png)

修改了 2 个属性值，回调函数应该执行 2 次，但是回调函数并没有执行，这是为什么呢？

前面的`watch`函数中写死了 `source.foo,` `source.bar`没有进行依赖收集，自然回调函数就不会执行了。那么 我们来封装一个通用的读取操作：

```js
function traverse(value, seen = new Set()) {
  // 如果要读取的数据是原始值，或者已经被读取过了，那么什么都不做
  if (typeof value !== 'object' || value === null || seen.has(value)) return;

  // 将数据添加到 seen 中，代表遍历地读取过了，避免循环引用引起的死循环
  seen.add(value);

  // 暂时不考虑数组等其他结构
  // 假设 value 就是一个对象，使用 for...in 读取对象的每一个值，并递归地调用 traverse 进行处理
  for (const k in value) {
    traverse(value[k], seen);
  }

  return value;
}
```

修改 `watch` 如下：

```js
function watch(source, cb) {
  effect(
    // 触发读取操作，从而建立联系
    () => traverse(source),
    {
      scheduler() {
        // 当数据变化时，调用回调函数 cb
        cb();
      }
    }
  );
}
```

`traverse` 方法的作用，读取传入对象的所有属性，然后构建依赖关系，任何一个属性值发生变化，都会执行回调函数。

再次执行单测：

![image-20240118191058109](https://qn.huat.xyz/mac/202401181910142.png)

相关代码在 `commit： (5063b6b)watch 基础实现 ，`git checkout 5063b6b  即可查看。 



### 支持函数参数

看一个 case

```js
it('支持 getter 函数', () => {
  const mockFn = vi.fn();

  // 创建响应式对象
  const obj = reactive({ foo: 100, bar: 200, age: 10 });

  watch(() => obj.age, () => {
    mockFn()
  });

  obj.age ++

  expect(mockFn).toHaveBeenCalledTimes(1);
})
```

运行一下

![image-20240118191803479](https://qn.huat.xyz/mac/202401181918515.png)

发现没有通过，因为我们之前也没有实现对函数的支持，在 watch 中增加一个对第一个参数的判断就好：

```js
export function watch(source, cb) {
  let getter;
  if (typeof source === 'function') {
    getter = source;
  } else {
    getter = () => traverse(source);
  }

  effect(
    // 触发读取操作，从而建立联系
    () => getter(),
    {
      scheduler() {
        // 当数据变化时，调用回调函数 cb
        cb();
      },
    }
  );
}
```

再次运行单测

![image-20240118192047176](https://qn.huat.xyz/mac/202401181920217.png)

发现就 ok 啦



### 获取新值与旧值

看这个 case

```js
it('get newVal and oldVal', () => {
  const mockFn = vi.fn();

  // 创建响应式对象
  const obj = reactive({ foo: 100, bar: 200, age: 10 });

  let newValue = null
  let oldValue = null

  watch(() => obj.age, (newVal, oldVal) => {
    newValue = newVal
    oldValue = oldVal
  });

  obj.age ++

  expect(newValue).toBe(11);
  expect(oldValue).toBe(10);
})
```

不用运行，肯定跑不过，因为我们都没有去实现。

那么如何获得新值与旧值呢？这需要充分利用 `effect` 函数的 `lazy` 选项，如以下代码所示：

```js
function watch(source, cb) {
  let getter;
  if (typeof source === 'function') {
    getter = source;
  } else {
    getter = () => traverse(source);
  }

  // 定义旧值与新值
  let oldValue, newValue;

  // 使用 effect 注册副作用函数时，开启 lazy 选项，并把返回值存储到 effectFn 中以便后续手动调用
  const effectFn = effect(
    () => getter(),
    {
      lazy: true,
      scheduler() {
        // 在 scheduler 中重新执行副作用函数，得到的是新值
        newValue = effectFn();
        // 将旧值和新值作为回调函数的参数
        cb(newValue, oldValue);
        // 更新旧值，不然下一次会得到错误的旧值
        oldValue = newValue;
      }
    }
  );

  // 手动调用副作用函数，拿到的值就是旧值
  oldValue = effectFn();
}
```

在这段代码中，最核心的改动是使用 `lazy` 选项创建了一个懒执行的 `effect `。注意上面代码中最下面的部分，我们手动调用 `effectFn` 函数得到的返回值就是旧值，即第一次执行得到的值。当变化发生并触发 `scheduler `调度函数执行时，会重新调用 `effectFn` 函数并得到新值，这样我们就拿到了旧值与新值，接着将它们作为参数传递给回调函数 `cb` 就可以了。最后一件非常重要的事情是，不要忘记使用新值更新旧值：`oldValue = newValue`，否则在下一次变更发生时会得到错误的旧值。

运行单测

![image-20240118192900720](https://qn.huat.xyz/mac/202401181929770.png)

















