![合理触发响应](https://qn.huat.xyz/mac/202401212347556.png)



## 简介

在上一篇文章中，我们增强了对对象的拦截，解决了以下问题：

- 拦截 `in`操作符
- 拦截 `for in` 循环
- 拦截对象的删除操作

接下来我们在对响应式系统做一些优化，避免一些不必要的响应



代码地址： https://github.com/SuYxh/share-vue3 

代码并没有按照源码的方式去进行组织，目的是学习、实现 vue3 响应式系统的核心，用最少的代码去实现最核心的能力，减少我们的学习负担，并且所有的流程都会有配套的图片，图文 + 代码，让我们学习更加轻松、快乐。

每一个功能都会提交一个 `commit` ，大家可以切换查看，也顺变练习练习 git 的使用。



## 新值与旧值相等

### 单元测试

```js
it('newValue === oldValue', () => {
  const mockFn = vi.fn();
  const obj = reactive({ foo: 1, bar: NaN })

  effect(function effectFn() {
    mockFn()
    console.log(obj.foo);
    console.log(obj.bar);
  })

  expect(mockFn).toHaveBeenCalledTimes(1);

  obj.foo = 1
  expect(mockFn).toHaveBeenCalledTimes(1);

  obj.bar = NaN
  expect(mockFn).toHaveBeenCalledTimes(1);
})
```

### 代码实现

```js
// 拦截设置操作
set(target, key, newVal, receiver) {
  // 先获取旧值
  const oldVal = target[key]
  // 如果属性不存在，则说明是在添加新属性，否则是设置已有属性
  const type = Object.prototype.hasOwnProperty.call(target, key)
    ? TriggerType.SET
    : TriggerType.ADD;

  // 设置属性值
  const res = Reflect.set(target, key, newVal, receiver);
  // 较新值与旧值，只有当它们不全等，并且不都是 NaN 的时候才触发响应
  if (oldVal !== newVal && (oldVal === oldVal || newVal === newVal)) {
    trigger(target, key, type);
  }
  return res;
},
```

在 `set` 拦截函数内首先获取旧值 `oldVal` ，接着比较新值与旧值，只有当它们不全等的时候才触发响应。这里需要注意的是 `NaN`的问题：

```js
NaN === NaN  // false
NaN !== NaN  // true
```

所以，需要在新值和旧值不全等的情况下，要保证它们都不是 NaN 。



## 原型继承属性

### 单元测试

```js
it("原型继承属性", () => {
  const mockFn = vi.fn();

  const obj = {};
  const proto = { bar: 1 };

  const child = reactive(obj);
  const parent = reactive(proto);

  // 使用 parent 作为 child 的原型
  Object.setPrototypeOf(child, parent);

  effect(() => {
    mockFn()
    console.log(child.bar); // 1
  });
  expect(mockFn).toHaveBeenCalledTimes(1);

  // 修改 child.bar 的值
  child.bar = 2; // 会导致副作用函数重新执行两次
  expect(mockFn).toHaveBeenCalledTimes(2);

});
```

执行单测看看：

![image-20240122002711353](https://qn.huat.xyz/mac/202401220027395.png)

从单测可以看出：副作用函数不仅执行了，还执行了2次，这会造成不必要的更新。



### 问题分析

我们知道，如果对象自身不存在该属性，会往对象的原型上找。当读取`child.bar`属性值时，由于`child`代理的对象 `obj`自身没有`bar`属性，因此会获取对象`obj`的原型，也就是`parent`对象，所以最终得到的实际上是 `parent.bar`的值。

同时，`parent`本身也是响应式数据，因此在副作用函数中访问 `parent.bar`的值时，会导致副作用函数被收集，从而也建立响应联系。所以我们能够得出一个结论，即 `child.bar`和`parent.bar`都与副作用函数建立了响应联系。

如果设置的属性不存在于对象上，那么会取得其原型，并调用原型的` [[Set]]` 方法，也就是` parent`的` [[Set]]`内部方法。由于 `parent`是代理对象，所以这就相当于执行了它的 `set`拦截函数。换句话说，虽然我们操作的是 `child.bar`，但这也会导致 `parent`代理对象的 `set`拦截函数被执行。

所以当`parent`代理对象的 `set`拦截函数执行时，就会触发副作用函数重新执行，这就是为什么修改 `child.bar`的值会导致副作用函数重新执行两次。



### 解决

既然执行两次，那么只要屏蔽其中一次不就可以了吗？

屏蔽掉原型上的那次副作用函数的重新执行，即 `parent.bar`触发的那次。

如何屏蔽呢？

通过 `set`函数的第三个参数 `receiver` 来进行区分：

```js
// child 的 set 拦截函数
set(target, key, value, receiver) {
  // target 是原始对象 obj
  // receiver 是代理对象 child
}

// parent 的 set 拦截函数
set(target, key, value, receiver) {
  // target 是原始对象 proto
  // receiver 仍然是代理对象 child
}
```

当`parent`代理对象的`set`拦截函数执行时，此时`target`是原始对象`proto`，而`receiver`仍然是代理对象 `child`，而不再是`target`的代理对象。

### 代码实现

代理对象可以通过 `raw`属性读取原始数据：

> 其实这里最好我们应该通过 `Symbol('raw')` 的方式来进行定义，避免引起冲突。比如，`target` 中存在一个 `raw` 属性呢？

```js
function reactive(obj) {
  return new Proxy(obj, {
    get(target, key, receiver) {
      // 代理对象可以通过 raw 属性访问原始数据
      if (key === 'raw') {
        return target;
      }

      track(target, key);
      return Reflect.get(target, key, receiver);
    }
    // 省略其他拦截函数
  });
}

```

有了它，我们就能够在 `set` 拦截函数中判断 `receiver` 是不是` target` 的代理对象了：

```js
function reactive(obj) {
  
  return new Proxy(obj, {
    set(target, key, newVal, receiver) {
      const oldVal = target[key];
      const type = Object.prototype.hasOwnProperty.call(target, key) ? 'SET' : 'ADD';
      const res = Reflect.set(target, key, newVal, receiver);

      // target === receiver.raw 说明 receiver 就是 target 的代理对象
      if (target === receiver.raw) {
        if (oldVal !== newVal && (oldVal === oldVal || newVal === newVal)) {
          trigger(target, key, type);
        }
      }

      return res;
    }
    // 省略其他拦截函数
  });
}

```



### 运行单测

![image-20240122002759676](https://qn.huat.xyz/mac/202401220027717.png)



## 运行测试

```
pnpm test
```

![image-20240122002955600](https://qn.huat.xyz/mac/202401220029640.png)







