![shallowReactive](https://qn.huat.xyz/mac/202401220033778.png)



## 简介

今天来实现一下 `shallowReactive` 这个 API。

`reactive`函数是一个深响应，当你取出的值为对象类型，需要再次调用 `reactive`进行响应式处理。很明显我们目前的代码是一个浅响应，即 只代理了对象的第一层，也就是 `shallowReactive`。



代码地址： https://github.com/SuYxh/share-vue3 

代码并没有按照源码的方式去进行组织，目的是学习、实现 vue3 响应式系统的核心，用最少的代码去实现最核心的能力，减少我们的学习负担，并且所有的流程都会有配套的图片，图文 + 代码，让我们学习更加轻松、快乐。

每一个功能都会提交一个 `commit` ，大家可以切换查看，也顺变练习练习 git 的使用。



## 单元测试

```js
it('深响应 reactive', () => {
  const mockFn = vi.fn();

  const obj = reactive({ foo: { bar: 1 } })

  effect(function effectFn() {
    console.log(obj.foo.bar);
  })
  expect(mockFn).toHaveBeenCalledTimes(1);


  obj.foo.bar = 2
  expect(mockFn).toHaveBeenCalledTimes(2);
})

it('浅响应 shallowReactive', () => {
  const mockFn = vi.fn();

  const obj = shallowReactive({ foo: { bar: 1 } })

  effect(function effectFn() {
    console.log(obj.foo.bar);
  })
  expect(mockFn).toHaveBeenCalledTimes(1);


  obj.foo.bar = 2
  expect(mockFn).toHaveBeenCalledTimes(1);
})
```



## 代码实现

在 `reactive`函数的`get`中，增加如下判断：

```
if (typeof res === 'object' && res !== null) {
  return reactive(res)
}
```

新增一个`shallowReactive` 函数并导出， 和之前的 `reactive`函数一样。



## 运行单测

深响应 reactive：

![image-20240122004441759](https://qn.huat.xyz/mac/202401220044802.png)

浅响应 shallowReactive：

![image-20240122004510851](https://qn.huat.xyz/mac/202401220045875.png)

都没有问题！



## 重构

我们看到 `shallowReactive`  和 `reactive`有极大的相似，需进行代码抽离:

```js
export function createReactive(target, isShallow = false) {
  return new Proxy(target, {
    // 拦截读取操作
    get(target, key, receiver) {
      // 代理对象可以通过 raw 属性访问原始数据
      if (key === symbolRaw) {
        return target;
      }

      const res = Reflect.get(target, key, receiver);

      //  如果是浅响应，则直接返回原始值
      if (isShallow) {
        return res;
      }

      if (typeof res === "object" && res !== null) {
        return reactive(res);
      }

      // 依赖收集
      track(target, key);
      return res;
    },
    // 拦截设置操作
    set(target, key, newVal, receiver) {
      // 先获取旧值
      const oldVal = target[key];
      // 如果属性不存在，则说明是在添加新属性，否则是设置已有属性
      const type = Object.prototype.hasOwnProperty.call(target, key)
        ? TriggerType.SET
        : TriggerType.ADD;

      // 设置属性值
      const res = Reflect.set(target, key, newVal, receiver);

      // target === receiver.raw 说明 receiver 就是 target 的代理对象
      if (target === receiver[symbolRaw]) {
        // 较新值与旧值，只有当它们不全等，并且不都是 NaN 的时候才触发响应
        if (oldVal !== newVal && (oldVal === oldVal || newVal === newVal)) {
          trigger(target, key, type);
        }
      }

      return res;
    },
    // 拦截 in 操作符
    has(target, key) {
      track(target, key);
      return Reflect.has(target, key);
    },
    // 拦截 for in 循环
    ownKeys(target) {
      track(target, ITERATE_KEY);
      return Reflect.ownKeys(target);
    },
    // 拦截删除
    deleteProperty(target, key) {
      // 检查被操作的属性是否是对象自己的属性
      const hadKey = Object.prototype.hasOwnProperty.call(target, key);
      // 使用 Reflect.deleteProperty 完成属性的删除
      const res = Reflect.deleteProperty(target, key);

      if (res && hadKey) {
        // 只有当被删除的属性是对象自己的属性并且成功删除时，才触发更新
        trigger(target, key, TriggerType.DEL);
      }

      return res;
    },
  });
}

// 对原始数据的代理
export function reactive(target) {
  return createReactive(target);
}

export function shallowReactive(target) {
  return createReactive(target, true);
}
```



## 运行测试

```js
pnpm test
```

![image-20240122004859928](https://qn.huat.xyz/mac/202401220048971.png)

重构后的代码也没有问题！
