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





