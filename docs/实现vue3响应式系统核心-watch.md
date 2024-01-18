现vue3响应式系统核心-watch

## 简介

今天我们来看看 `watch` 的实现。` watch`本质就是观测一个响应式数据，当数据发生变化时通知并执行相应的回调函数。实际上，`watch`的实现本质上就是利用了 `effect` 以及 `options.scheduler`选项。



代码地址： https://github.com/SuYxh/share-vue3 

代码并没有按照源码的方式去进行组织，目的是学习、实现 vue3 响应式系统的核心，用最少的代码去实现最核心的能力，减少我们的学习负担，并且所有的流程都会有配套的图片，图文 + 代码，让我们学习更加轻松、快乐。

每一个功能都会提交一个 `commit` ，大家可以切换查看，也顺变练习练习 git 的使用。



## watch 实现

在一个副作用函数中访问响应式数据 `obj.foo`，通过前面的介绍，我们知道这会在副作用函数与响应式数据之间建立联系，当响应式数据变化时，会触发副作用函数重新执行。但有一个例外，即如果副作用函数存在 `scheduler`选项，当响应式数据发生变化时，会触发 `scheduler`调度函数执行，而非直接触发副作用函数执行。从这个角度来看，其实 `scheduler`调度函数就相当于一个回调函数，而 `watch`的实现就是利用了这个特点。

### 编写单测

假设`obj`是一个响应数据，使用` watch` 函数观测它，并传递一个回调函数，当修改响应式数据的值时，会触发该回调函数执行。

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

下面是最简单的 watch 函数的实现：

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

是不是很简单！



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

前面的`watch`函数中写死了 `source.foo,` `source.bar`没有进行依赖收集，自然回调函数就不会执行了。

那么就需要封装一个通用的读取操作：

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

发现没有通过，因为我们之前也没有实现对函数的支持，肯定不会通过。

在 watch 中增加一个对第一个参数的判断就好：

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

这样就通过了。

相关代码在 `commit： (0acd398)watch 支持函数参数 ，`git checkout 0acd398  即可查看。 

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

其中最核心的改动是使用 `lazy` 选项创建了一个懒执行的 `effect `。注意上面代码中最下面的部分，我们手动调用 `effectFn` 函数得到的返回值就是旧值，即第一次执行得到的值。当变化发生并触发 `scheduler `调度函数执行时，会重新调用 `effectFn` 函数并得到新值，这样我们就拿到了旧值与新值，接着将它们作为参数传递给回调函数 `cb` 就可以了。最后一件非常重要的事情是，不要忘记使用新值更新旧值：`oldValue = newValue`，否则在下一次变更发生时会得到错误的旧值。

运行单测

![image-20240118192900720](https://qn.huat.xyz/mac/202401181929770.png)

相关代码在 `commit： (5ac39a6)watch 获取新值与旧值 ，`git checkout 5ac39a6  即可查看。 



### 支持 immediate

看看这个 case

```js
it('支持 immediate', () => {
  const mockFn = vi.fn();

  // 创建响应式对象
  const obj = reactive({ foo: 100, bar: 200, age: 10 });

  let newValue = undefined
  let oldValue = undefined

  watch(() => obj.age, (newVal, oldVal) => {
    mockFn()
    newValue = newVal
    oldValue = oldVal
  }, {
    immediate: true
  });

  expect(mockFn).toHaveBeenCalledTimes(1);
  expect(newValue).toBe(10);
  expect(oldValue).toBe(undefined);


  obj.age ++
  expect(mockFn).toHaveBeenCalledTimes(2);
  expect(newValue).toBe(11);
  expect(oldValue).toBe(10);
})
```

又是熟悉的老套路，增加一个 `options`，代码如下：

```js
export function watch(source, cb, options) {
  let getter;
  if (typeof source === "function") {
    getter = source;
  } else {
    getter = () => traverse(source);
  }

  // 定义旧值与新值
  let oldValue, newValue;

  // 使用 effect 注册副作用函数时，开启 lazy 选项，并把返回值存储到 effectFn 中以便后续手动调用
  const effectFn = effect(() => getter(), {
    lazy: true,
    scheduler() {
      // 在 scheduler 中重新执行副作用函数，得到的是新值
      newValue = effectFn();
      // 将旧值和新值作为回调函数的参数
      cb(newValue, oldValue);
      // 更新旧值，不然下一次会得到错误的旧值
      oldValue = newValue;
    },
  });

  if (options.immediate) {
    // 当 immediate 为 true 时立即执行 effectFn，从而触发回调执行
    newValue = effectFn();
    cb(newValue, oldValue);
    oldValue = newValue;
  } else {
    // 手动调用副作用函数，拿到的值就是旧值
    oldValue = effectFn();
  }
}
```

再次运行单测：

![image-20240118194634966](https://qn.huat.xyz/mac/202401181946016.png)

相关代码在 `commit： (fd0e845)watch 支持 immediate ，`git checkout fd0e845  即可查看。 



### 重构

我们可以发现 `scheduler` 方法中的逻辑和 `options.immediate`  为 `true` 时执行的逻辑一样，那么就可以进行封装:

```js
export function watch(source, cb, options) {
  let getter;
  if (typeof source === "function") {
    getter = source;
  } else {
    getter = () => traverse(source);
  }

  // 定义旧值与新值
  let oldValue, newValue;

  // 提取 scheduler 调度函数为一个独立的 job 函数
  const job = () => {
    newValue = effectFn();
    cb(newValue, oldValue);
    oldValue = newValue;
  }

  // 使用 effect 注册副作用函数时，开启 lazy 选项，并把返回值存储到 effectFn 中以便后续手动调用
  const effectFn = effect(() => getter(), {
    lazy: true,
    scheduler: job,
  });

  if (options.immediate) {
    // 当 immediate 为 true 时立即执行 job，从而触发回调执行
    job()
  } else {
    // 手动调用副作用函数，拿到的值就是旧值
    oldValue = effectFn();
  }
}
```

### 执行测试命令

```
pnpm test
```

我们可以看到，我们修改了代码，之前的 case 出了问题

![image-20240118195124727](https://qn.huat.xyz/mac/202401181951780.png)

原因是当我们没有传 `options` 的时候，`options` 相当于是` undefined`， 取值自然会出错，我们添加一个默认值就好。

![image-20240118195319687](https://qn.huat.xyz/mac/202401181953742.png)

可以看到就全部通过了，单测为我们的代码保驾护航！

相关代码在 `commit： (c0721bd)watch 代码优化 ，`git checkout c0721bd  即可查看。 



### 流程图

整体流程图如下：

![image-20240118200856264](https://qn.huat.xyz/mac/202401182008322.png)













