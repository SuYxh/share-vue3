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











