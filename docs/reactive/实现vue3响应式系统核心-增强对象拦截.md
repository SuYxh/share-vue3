![增强对象拦截](https://qn.huat.xyz/mac/202401212034998.png)

## 简介

在之前的文章中我们实现一个响应式系统的 MVP 模型，也实现了 `computed` 、`watch` 等。 今天再来看看对于对象的拦截，我们思考以下几个问题：

- 如何拦截 `in`操作符呢？
- 如何拦截 `for in` 循环呢？
- 如何拦截对象的删除操作呢？

接下来我们会一步步实现这些功能，进一步增强 MVP 模型。



代码地址： https://github.com/SuYxh/share-vue3 

代码并没有按照源码的方式去进行组织，目的是学习、实现 vue3 响应式系统的核心，用最少的代码去实现最核心的能力，减少我们的学习负担，并且所有的流程都会有配套的图片，图文 + 代码，让我们学习更加轻松、快乐。

每一个功能都会提交一个 `commit` ，大家可以切换查看，也顺变练习练习 git 的使用。



## 对象读取操作

先看看一个普通对象所有可能的读取操作有哪些？

- 访问属性：obj.foo
- 判断对象或原型上是否存在给定的 key：key in obj
- 使用 for...in  循环遍历对象：for (const key in obj){} 



## Proxy 内部方法

 Proxy对象部署的所有内部方法以及用来自定义内部方法和行为的拦截函数名字

![得到App_2024-01-21_21-43-48](https://qn.huat.xyz/mac/202401212144713.png)



## 拦截 `in` 操作符

现给出结论：我们可以通过 `has` 拦截函数实现对 `in` 操作符。

### 为什么是 `has` 呢？

在 ECMA-262 规范的 13.10.1 节中，明确定义了 `in` 操作符的运行时逻辑，如图所示：

![得到App_2024-01-21_21-47-31](https://qn.huat.xyz/mac/202401212207545.png)

关键点在第 6 步，可以发现，`in` 操作符的运算结果是通过调用一个叫作 `HasProperty`的抽象方法得到的。关于 `HasProperty`抽象方法，可以在 ECMA-262 规范的 7.3.11 节中找到，它的操作如图所示:

![得到App_2024-01-21_21-48-30](https://qn.huat.xyz/mac/202401212207574.png)

可以看到 `HasProperty` 抽象方法的返回值是通过调用对象的内部方法` [[HasProperty]]`得到的。而`[[HasProperty]]`内部方法可以在Proxy内部方法中找到，它对应的拦截函数名叫 `has`，因此我们可以通过` has`拦截函数实现对 `in` 操作符的代理。

> 看不懂也无所谓，只需要知道 has 可以拦截 in 操作。

### 单元测试

```js
it("拦截 in 操作符", () => {
  const mockFn = vi.fn();

  // 创建响应式对象
  const obj = reactive({ foo: 100 });

  effect(function effectFn1() {
    mockFn()
    console.log('foo' in obj);
  })

  expect(mockFn).toHaveBeenCalledTimes(1);

  delete obj.foo

  expect(mockFn).toHaveBeenCalledTimes(2);
});
```



### 代码实现

```js
// 拦截 in 操作符
has(target, key) {
  track(target, key);
  return Reflect.has(target, key);
},
```

按照以往，这里应该是运行 case 的时间，但是我们还并没有实现拦截删除，所以这里无法跑通，等到文末在运行单测。

但是可以通过调试看到，已经被收集到了。

![image-20240121221632115](https://qn.huat.xyz/mac/202401212216153.png)

接下来看一下 `for in`循环如何去拦截。





## 拦截 `for...in` 循环

这里直接给出答案：可以使用ownKeys拦截函数来拦截。

### 单元测试

```js
it("拦截 for in", () => {
  // 创建响应式对象
  const obj = reactive({ foo: 100 });
  const mockFn = vi.fn();

  effect(function effectFn1() {
    mockFn()

    for (const key in obj) {
      console.log(key);
    }
  })
  expect(mockFn).toHaveBeenCalledTimes(1);

  obj.bar = 2
  expect(mockFn).toHaveBeenCalledTimes(2);

  obj.foo = 100
  expect(mockFn).toHaveBeenCalledTimes(2);
});
```



### 代码实现

```js
const ITERATE_KEY = "iterate-key";


// 拦截 for in 循环
ownKeys(target) {
  track(target, ITERATE_KEY);
  return Reflect.ownKeys(target);
},
```

### 原因分析

将 `ITERATE_KEY` 作为追踪的` key` ，为什么这么做呢？

这是因为 `ownKeys` 拦截函数与` get/set` 拦截函数不同，在`set /get`中，我们可以得到具体操作的 `key`，但是在`ownKeys`中，我们只能拿到目标对象` target`。 `ownKeys` 用来获取一个对象的所有属于自己的键值，这个操作明显不与任何具体的键进行绑定，因此我们只能够构造唯一的 `key` 作为标识，即 `ITERATE_KEY`。

既然追踪的是 `ITERATE_KEY`，那么相应地，在触发响应的时候也应该触发它才行。但是在什么情况下，对数据的操作需要触发与` ITERATE_KEY` 相关联的副作用函数重新执行呢？

为对象添加了新属性。因为，当为对象添加新属性时，会对 `for...in` 循环产生影响，所以需要触发与`ITERATE_KEY`相关联的副作用函数重新执行。

在我们之前写的 `set`函数中，当为对象 `obj` 添加新的 `bar` 属性时，会触发 `set`拦截函数执行。此时 `set`拦截函数接收到的 `key`就是字符串 `bar`，因此最终调用 `trigger`函数时也只是触发了与 `bar`相关联的副作用函数重新执行。

我们知道` for...in`循环是在副作用函数与` ITERATE_KEY`之间建立联系，这和 `bar`一点儿关系都没有，因此当我们尝试执行 `obj.bar = 2`操作时，并不能正确地触发响应。

通过调试可以看到：

![image-20240121230921453](https://qn.huat.xyz/mac/202401212309493.png)

### 解决

当添加属性时，我们将那些与` ITERATE_KEY` 相关联的副作用函数也取出来执行就可以了：

```js
function trigger(target, key) {
  const depsMap = bucket.get(target);
  if (!depsMap) return;
  // 取得与 key 相关联的副作用函数
  const effects = depsMap.get(key);
  // 取得与 ITERATE_KEY 相关联的副作用函数
  const iterateEffects = depsMap.get(ITERATE_KEY);

  const effectsToRun = new Set();
  // 将与 key 相关联的副作用函数添加到 effectsToRun
  effects && effects.forEach(effectFn => {
    if (effectFn !== activeEffect) {
      effectsToRun.add(effectFn);
    }
  });
  // 将与 ITERATE_KEY 相关联的副作用函数也添加到 effectsToRun
  iterateEffects && iterateEffects.forEach(effectFn => {
    if (effectFn !== activeEffect) {
      effectsToRun.add(effectFn);
    }
  });

  effectsToRun.forEach(effectFn => {
    if (effectFn.options.scheduler) {
      effectFn.options.scheduler(effectFn);
    } else {
      effectFn();
    }
  });
}
```

### 运行单测

![image-20240121231759224](https://qn.huat.xyz/mac/202401212317267.png)

我们可以看到，单测并没有通过。从单测可以看出来，当我们修改值的时候，也触发了副作用函数的执行。

这又是怎么回事呢？

### 问题分析-修改 foo

与添加新属性不同，修改属性不会产生新的 `key` ，所以不会对 `for...in` 循环产生影响。所以在这种情况下，我们不需要触发副作用函数重新执行，否则会造成不必要的性能开销。

### 解决

那么我们在`set` 拦截函数内能够区分操作的类型，到底是添加新属性还是设置已有属性:

```js
// 拦截设置操作
set(target, key, newVal, receiver) {
  // 如果属性不存在，则说明是在添加新属性，否则是设置已有属性
  const type = Object.prototype.hasOwnProperty.call(target, key)
    ? TriggerType.SET
    : TriggerType.ADD;

  // 设置属性值
  const res = Reflect.set(target, key, newVal, receiver);
  // 派发更新
  trigger(target, key, type);
  return res;
},
```

我们优先使用`Object.prototype.hasOwnProperty`检查当前操作的属性是否已经存在于目标对象上，如果存在，则说明当前操作类型为 `SET`，即修改属性值；否则认为当前操作类型为 `ADD`，即添加新属性。

在 `trigger` 函数内就可以通过类型 `type`来区分当前的操作类型，并且只有当操作类型 `type`为 `ADD`时，才会触发与`ITERATE_KEY`相关联的副作用函数重新执行，这样就避免了不必要的性能损耗：

```js
function trigger (target, key, type) {
  
  // ... 
  
  // 只有当操作类型为 'ADD' 时，才触发与 ITERATE_KEY 相关联的副作用函数重新执行
  if (type === TriggerType.ADD) {
    // 取得与 ITERATE_KEY 相关联的副作用函数
    const iterateEffects = depsMap.get(ITERATE_KEY);

    iterateEffects &&
      iterateEffects.forEach((effectFn) => {
        if (effectFn !== activeEffect) {
          effectsToRun.add(effectFn);
        }
      });
  }
  
  // ...
}
```

再次运行单测

![image-20240121232707982](https://qn.huat.xyz/mac/202401212327042.png)

单测就已经通过！



