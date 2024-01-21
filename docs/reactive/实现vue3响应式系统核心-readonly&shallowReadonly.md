![readonly&shallowReadonly](https://qn.huat.xyz/mac/202401220051603.png)




## 简介

今天来实现`readonly` 和 `shallowReadonly`。 我们希望一些数据是只读的，当用户尝试修改只读数据时，会收到一条警告信息。这样就实现了对数据的保护，例如组件接收到的 `props` 对象应该是一个只读数据。



代码地址： https://github.com/SuYxh/share-vue3 

代码并没有按照源码的方式去进行组织，目的是学习、实现 vue3 响应式系统的核心，用最少的代码去实现最核心的能力，减少我们的学习负担，并且所有的流程都会有配套的图片，图文 + 代码，让我们学习更加轻松、快乐。

每一个功能都会提交一个 `commit` ，大家可以切换查看，也顺变练习练习 git 的使用。



## 单元测试

```js
it('只读 readonly', () => {
  const consoleSpy = vi.spyOn(console, "warn"); // 捕获 console.warn

  const obj = readonly({ foo: { bar: 1 } })

  effect(function effectFn() {
    consoleSpy()
    console.log(obj.foo.bar);
  })
  expect(consoleSpy).toHaveBeenCalledTimes(1);

  obj.foo.bar = 2
  expect(mockFn).toHaveBeenCalledTimes(2);
})

it('浅只读 shallowReadonly', () => {
  const consoleSpy = vi.spyOn(console, "warn"); // 捕获 console.warn

  const obj = shallowReadonly({ foo: { bar: 1 } })

  effect(function effectFn() {
    consoleSpy()
    console.log(obj.foo.bar);
  })

  expect(consoleSpy).toHaveBeenCalledTimes(1);

  obj.foo.bar = 2
  expect(mockFn).toHaveBeenCalledTimes(1);
})
```



## 代码实现

只读本质上也是对数据对象的代理，我们同样可以使用 `createReactive` 函数来实现。如下面的代码所示，我们为 `createReactive` 函数增加第三个参数 `isReadonly`：

```js
// 增加第三个参数 isReadonly，代表是否只读，默认为 false，即非只读
function createReactive(obj, isShallow = false, isReadonly = false) {
  return new Proxy(obj, {
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
        return isReadonly ? readonly(res) : reactive(res);
      }

      // 将副作用函数 activeEffect 添加到存储副作用函数的桶中
      if (!isReadonly) {
        track(target, key);
      }

      return res;
    },
    // 拦截设置操作
    set(target, key, newVal, receiver) {
      // 如果是只读的，则打印警告信息并返回
      if (isReadonly) {
        console.warn(`属性 ${key} 是只读的`);
        return true;
      }
      const oldVal = target[key];
      const type = Object.prototype.hasOwnProperty.call(target, key) ? 'SET' : 'ADD';
      const res = Reflect.set(target, key, newVal, receiver);
      if (target === receiver.raw) {
        if (oldVal !== newVal && (oldVal === oldVal || newVal === newVal)) {
          trigger(target, key, type);
        }
      }

      return res;
    },
    deleteProperty(target, key) {
      // 如果是只读的，则打印警告信息并返回
      if (isReadonly) {
        console.warn(`属性 ${key} 是只读的`);
        return true;
      }
      const hadKey = Object.prototype.hasOwnProperty.call(target, key);
      const res = Reflect.deleteProperty(target, key);

      if (res && hadKey) {
        trigger(target, key, 'DELETE');
      }

      return res;
    }
    // 省略其他拦截函数
  });
}
```

通过第三个参数指定是否创建一个只读的代理对象。同时，我们还修改了`set`拦截函数和`deleteProperty`拦截函数的实现，因为对于一个对象来说，只读意味着既不可以设置对象的属性值，也不可以删除对象的属性。在这两个拦截函数中，我们分别添加了是否是只读的判断，一旦数据是只读的，则当这些操作发生时，会打印警告信息，提示用户这是一个非法操作。

如果一个数据是只读的，那就意味着任何方式都无法修改它。因此，没有必要为只读数据建立响应联系。所以，当在副作用函数中读取一个只读属性的值时，不需要调用 `track `函数追踪响应。

## 运行单测

只读 readonly：

![image-20240122010501633](https://qn.huat.xyz/mac/202401220105670.png)

浅只读 shallowReadonly：

![image-20240122010529934](https://qn.huat.xyz/mac/202401220105972.png)

都没有问题！



## 运行测试

```js
pnpm test
```

![image-20240122010653371](https://qn.huat.xyz/mac/202401220106407.png)

