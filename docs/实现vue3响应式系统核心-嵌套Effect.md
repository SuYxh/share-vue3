现vue3响应式系统核心-嵌套Effect

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



## 嵌套Effect

### 场景

什么场景下会出现嵌套的 `effect` 呢？ Vue.js 的渲染函数就是在一个 `effect` 中执行的。当组件发生嵌套时，例如 Foo 组件渲染了 Bar 组件：

```js
// Bar 组件
const Bar = {
  render() {
    // ...
  },
};

// Foo 组件渲染了 Bar 组件
const Foo = {
  render() {
    return <Bar />; // jsx 语法
  },
};
```

此时就发生了 `effect`嵌套，它相当于：

```js
effect(() => {
  Foo.render();
  // 嵌套
  effect(() => {
    Bar.render();
  });
});
```

这个例子说明了为什么 `effect`  要设计成可嵌套的。



### 编写单元测试

我们来看一个案例

```js
// 我想使用 vitest 进行单元测试，以下是测试代码是我的测试代码，请你帮我编写一个单元测试：

const obj = reactive({ foo: true, bar: true });
let temp1, temp2;

// effectFn1 嵌套了 effectFn2
effect(function effectFn1() {
  console.log("effectFn1 执行");

  effect(function effectFn2() {
    console.log("effectFn2 执行");
    // 在 effectFn2 中读取 obj.bar 属性
    temp2 = obj.bar;
  });

  // 在 effectFn1 中读取 obj.foo 属性
  temp1 = obj.foo;
});

// 期待 effectFn1 执行
obj.foo = false

// 期待 effectFn2 执行
obj.bar = false
```

我们将这个案例转换成单元测试，如果不会还是可以找 ChatGPT！

```js
it('effectFn1 and effectFn2 should be triggered appropriately', () => {
    const obj = reactive({ foo: true, bar: true });

    // 创建模拟函数来跟踪调用
    const mockEffectFn1 = vi.fn();
    const mockEffectFn2 = vi.fn();

    // 用模拟函数替换原来的 console.log
    effect(function effectFn1() {
      mockEffectFn1();
      effect(function effectFn2() {
        mockEffectFn2();
        // 读取 obj.bar 属性
        console.log(obj.bar);
      });
      // 读取 obj.foo 属性
      console.log(obj.foo);
    });

  	// 初始化 mockEffectFn1会被调用 1 次；  mockEffectFn2会被调用 1 次
    expect(mockEffectFn1).toHaveBeenCalledTimes(1);
    expect(mockEffectFn2).toHaveBeenCalledTimes(1);


    // 更改 obj.foo，预期 effectFn1 被触发， 
  	// mockEffectFn1会被调用 1 次； 加上之前的一次一共 2 次
  	// mockEffectFn2会被调用 1 次； 加上之前的一次一共 2 次
    obj.foo = false;
    expect(mockEffectFn1).toHaveBeenCalledTimes(2);

    // 更改 obj.bar，预期 effectFn2 被触发
  	// 更改 obj.bar 时，触发 trigger， 此时 bar 对应的 Set 集合中有 2 个 effectFn2，所以 effectFn2会被执行 2 次，一共 4 次
  
  	//  bar 对应的 Set 集合中有 2 个 effectFn2 为什么呢？
  	//  当 obj.foo 更新后，effectFn1 会调用，其中会调用 effectFn1 函数，再次触发依赖收集，加上之前的就是 2 个了
  	// set 不是去重吗？  deps.add(activeEffect);  activeEffect 是一个函数，每次函数的地址不一样
    obj.bar = false;
    expect(mockEffectFn2).toHaveBeenCalledTimes(4);
  });
```



### 运行测试

![image-20240118123814652](https://qn.huat.xyz/mac/202401181238736.png)

从 case 我们可以看到出来，当 `foo` 被修改的时候，回调函数没有执行，依赖可能没有收集到。



### 问题分析

![image-20240118100213736](https://qn.huat.xyz/mac/202401181002767.png)

通过调试我们可以看到，只有`bar`对应的依赖集合，`foo` 确实没有对应的依赖集合， 这是怎么回事呢？ 

分析一下代码执行：

```js
effect(function effectFn1() {
  console.log("effectFn1 执行");

  effect(function effectFn2() {
    console.log("effectFn2 执行");
    // 在 effectFn2 中读取 obj.bar 属性
    temp2 = obj.bar;
  });

  // 在 effectFn1 中读取 obj.foo 属性
  temp1 = obj.foo;
});
```

如下图：

![image-20240118102518394](https://qn.huat.xyz/mac/202401181025426.png)



我们可以发现问题出在： `effect` 函数中的 `effectFn`函数在 `fn`函数执行结束后，将全局的 `activeEffect`修改为 `null` ，当外层 `effect` 函数执行  `track` 方法进行依赖收集的时候，`activeEffect`不存在就直接退出了。 

那么我们把这行代码注释掉，再次执行 case

![image-20240118133115285](https://qn.huat.xyz/mac/202401181331352.png)

发现问题并没有解决，再来调试一下。

当我们执行这个嵌套的 effect 时，我们收集到的依赖到底是什么？ 

```js
effect(function effectFn1() {
  console.log("effectFn1 执行");

  effect(function effectFn2() {
    console.log("effectFn2 执行");
    // 在 effectFn2 中读取 obj.bar 属性
    temp2 = obj.bar;
  });

  // 在 effectFn1 中读取 obj.foo 属性
  temp1 = obj.foo;
});
```

![image-20240118103922107](https://qn.huat.xyz/mac/202401181039140.png)

我们在浏览器中可以看到依赖收集的结构，如上图。我们发现当我们去掉 `activeEffect = null;`  这行代码的时候，发现依赖收集了，但是收集错了！当改变 `foo` 的时，会执行 `effectFn2` ，上面的 case 自然也就跑不通了。



### 原因

我们用全局变量 `activeEffect` 来存储通过 `effect`函数注册的副作用函数，这意味着同一时刻 `activeEffect`所存储的副作用函数只能有一个。当副作用函数发生嵌套时，内层副作用函数的执行会覆盖 activeEffect的值，并且永远不会恢复到原来的值。这时如果再有响应式数据进行依赖收集，即使这个响应式数据是在外层副作用函数中读取的，它们收集到的副作用函数也都会是内层副作用函数，这就是问题所在。

### 解决

为了解决这个问题，我们需要一个副作用函数栈 `effectStack`，在副作用函数执行时，将当前副作用函数压入栈中，待副作用函数执行完毕后将其从栈中弹出，并始终让 `activeEffect` 指向栈顶的副作用函数。这样就能做到一个响应式数据只会收集直接读取其值的副作用函数，而不会出现互相影响的情况。

![image-20240118133756909](https://qn.huat.xyz/mac/202401181337967.png)



如以下代码所示：

```js
// effect 栈
const effectStack = []; 


// 定义副作用函数
export function effect(fn) {
  // 定义一个封装了用户传入函数的副作用函数
  const effectFn = () => {
    // 将 fn 挂载到 effectFn 方便调试观看区分函数，没有实际作用
    effectFn.fn = fn;
    // 在执行用户传入的函数之前调用 cleanup
    cleanup(effectFn);
    // 当 effectFn 执行时，将其设置为当前激活的副作用函数
    activeEffect = effectFn;
    // 在调用副作用函数之前将当前副作用函数压入栈中
    effectStack.push(effectFn); // 新增
    // 执行用户传入的函数
    fn();
    // 在当前副作用函数执行完毕后，将当前副作用函数弹出栈，并把 activeEffect 还原为之前的值
    effectStack.pop(); // 新增
    activeEffect = effectStack[effectStack.length - 1]; // 新增
  };
  // effectFn.deps 用来存储所有与该副作用函数相关联的依赖集合
  effectFn.deps = [];
  // 执行副作用函数
  effectFn();
}
```

再去执行case， 发现就可以通过了

![image-20240118133250604](https://qn.huat.xyz/mac/202401181332665.png)



### 执行 test

```
pnpm test
```

![image-20240118134037363](https://qn.huat.xyz/mac/202401181340431.png)

之前的 case 都能跑过， 可以提代码了。

相关代码在 `commit： (a813df8)`嵌套 effec ，`git checkout a813df8` 即可查看。 



### 流程图

![image-20240118141412503](https://qn.huat.xyz/mac/202401181414561.png)



## 支持自增运算符

### 场景

使用 `obj.counter++` 进行数据修改



### 编写单元测试

来看一个 case：

```js
it("支持自增运算符", () => {
  // 创建响应式对象
  const obj = reactive({ name: "dahuang", age: 18, counter: 1 });

  let errorOccurred = false;

  // 定义 effect 函数
  try {
    effect(() => {
      obj.counter++;
    });
  } catch (error) {
    errorOccurred = true;
  }

  // 断言不应该抛出错误
  expect(errorOccurred).toBe(false);
});
```

### 运行测试

![image-20240118142225856](https://qn.huat.xyz/mac/202401181422916.png)

RangeError: Maximum call stack size exceeded ！！！

### 问题分析

`obj.counter++;` 实际上等价于 `obj.counter = obj.counter + 1` ， 会先执行 getter 方法在执行 setter，

![image-20240118143412521](https://qn.huat.xyz/mac/202401181434586.png)



首先读取 `obj.counter`的值，这会触发` track`操作，将当前副作用函数收集到“桶”中，接着将其加 1后再赋值给 `obj.counter`，此时会触发`trigger`操作，即把“桶”中的副作用函数取出并执行。但问题是该副作用函数正在执行中，还没有执行完毕，就要开始下一次的执行。这样会导致无限递归地调用自己，于是就产生了栈溢出。



### 解决

在 `trigger` 动作发生时增加守卫条件：如果`trigger`触发执行的副作用函数与当前正在执行的副作用函数相同，则不触发执行 ，如以下代码所示：

```js
function trigger(target, key) {
  // 获取与目标对象相关联的依赖映射
  const depsMap = bucket.get(target);
  // 如果没有依赖映射，则直接返回
  if (!depsMap) return;
  // 获取与特定属性键相关联的所有副作用函数
  const effects = depsMap.get(key);
  // 这行代码有问题
  // effects && effects.forEach((effectFn) => effectFn());

  const effectsToRun = new Set();

  effects && effects.forEach(effectFn => {
    // 如果 trigger 触发执行的副作用函数与当前正在执行的副作用函数相同，则不触发执行
    if (effectFn !== activeEffect) {  // 新增
      effectsToRun.add(effectFn);
    }
  });

  // 遍历并执行所有相关的副作用函数
  effectsToRun.forEach(effectFn => effectFn());
}
```



### 执行 test

```
pnpm test
```

![image-20240118143951126](https://qn.huat.xyz/mac/202401181439196.png)





