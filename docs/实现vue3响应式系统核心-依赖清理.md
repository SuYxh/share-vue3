实现 vue3 响应式系统核心-依赖清理

## 简介

在[实现vue3响应式系统核心-MVP 模型](./实现vue3响应式系统核心-MVP 模型) 文章中我们介绍了一个最基础的响应式系统。今天的目标是实现依赖清理，依然使用 TDD 的模式进行，再利用 ChatGPT 进行高效学习。



代码地址： https://github.com/SuYxh/share-vue3 

代码并没有按照源码的方式去进行组织，目的是学习、实现 vue3 响应式系统的核心，用最少的代码去实现最核心的能力，减少我们的学习负担，并且所有的流程都会有配套的图片，图文 + 代码，让我们学习更加轻松、快乐。

每一个功能都会提交一个 `commit` ，大家可以切换查看，也顺变练习练习 git 的使用。

## 依赖清理

### 编写单测

在上篇文章中我们实现了一个响应式系统，但是仍有不足，接下来继续进行优化和增强。从一个 case看起：

```js
it('Dependency cleanup', () => {
  const consoleSpy = vi.spyOn(console, 'log'); // 捕获 console.log
  const obj = reactive({ name: 'dahuang', age: 18, isStudent: true })

  effect(() => {
    const info = obj.isStudent ? obj.name : obj.age
    console.log(info);
  })

  // effect 立即执行，执行一次，打印 'dahuang'
  expect(consoleSpy).toHaveBeenCalledTimes(1); 
  expect(consoleSpy).toHaveBeenCalledWith('dahuang');

  // 修改 name --> jarvis,  effect的回调会再次执行，打印 'jarvis'
  obj.name = 'jarvis'
  expect(consoleSpy).toHaveBeenCalledTimes(2); 
  expect(consoleSpy).toHaveBeenCalledWith('jarvis');

  // 修改 isStudent --> false,  effect的回调会再次执行，打印 18
  obj.isStudent = false
  expect(consoleSpy).toHaveBeenCalledTimes(3); 
  expect(consoleSpy).toHaveBeenCalledWith(18);

  // 再次修改 name -->  iron man,  期待effect的回调不会执行
  obj.name = 'iron man'
  expect(consoleSpy).toHaveBeenCalledTimes(3); 
})
```

直接跑这个 case 不会通过：

![image-20240117233100065](https://qn.huat.xyz/mac/202401172331199.png)

### 问题分析

看一下这个 case 的逻辑：

1、 effect 立即执行，执行一次，打印 'dahuang'，没问题

2、修改 name --> jarvis,  effect的回调会再次执行，打印 'jarvis'，数据更新，回调重新执行，没问题

3、修改 isStudent --> false,  effect的回调会再次执行，打印 18，数据更新，回调重新执行，没问题

4、再次修改 name -->  iron man，期待effect的回调不会执行， 此时副作用函数中的依赖应该是 age，并不是 name，所以这一次回调函数不应该执行，但是这里执行了。



### 原因分析

那么是什么造成的呢？之前收到的依赖没有清理。我们打个断点看一下当前的 `bucket` 的数据

![image-20240117233242648](https://qn.huat.xyz/mac/202401172332682.png)

然后进行 `单步调试 ` 直到进入 `trigger` 方法，我们可以看到 `name` 对应的 `Set`  这个数据结构中还有依赖，是**之前收集到的，并没有被删除**，当我们执行到 `effects && effects.forEach((fn) => fn());` 这行代码的时候，回调函数就会再次执行。

![image-20240117233427444](https://qn.huat.xyz/mac/202401172334484.png)

### 解决方式

**每次副作用函数执行时，我们可以先把它从所有与之关联的依赖集合中删除**，当副作用函数执行完毕后，会重新建立联系，但在新的联系中不会包含遗留的副作用函数。

> 副作用函数就是我们写的回调函数，副作用函数执行的时候，会进行取值操作，会走 track 方法，进行依赖构建，可以看上篇文章最后的流程图，非常的直观。

要将一个副作用函数从所有与之关联的依赖集合中移除，就需要明确知道哪些依赖集合中包含它，因此我们需要重新设计副作用函数。在 `effect` 内部我们定义了新的`effectFn`函数，并为其添加了` effectFn.deps`属性，该属性是一个数组，用来存储所有包含当前副作用函数的依赖集合：

```js
export function effect(fn) {
  const effectFn = () => {
    // 将 fn 挂载到 effectFn 方便调试观看区分函数，没有实际作用
    effectFn.fn = fn
    // 设置当前激活的副作用函数
    activeEffect = fn;
    // 执行副作用函数
    fn();
    // 重置当前激活的副作用函数
    activeEffect = null;
  };
  // activeEffect.deps 用来存储所有与该副作用函数相关联的依赖集合
  effectFn.deps = [];
  // 执行副作用函数
  effectFn();
}
```

> 思考🤔：这里我们在 `effectFn`身上挂了一个`deps`，这里能不能使用类的方式来重构这块代码？

#### 双向依赖构建

`effectFn.deps = []` 说通俗一点就是：当前副作用函数被收集在哪个 Set 的数据结构中，让我们来看图：

![image-20240117222558551](https://qn.huat.xyz/mac/202401172225592.png)

棕色的箭头是之前已经存在的，回忆一下这个联系是在哪里构建的呢？

```js
function track(target, key) {
  // ... 之前的代码

  // 最后将当前激活的副作用函数添加到“桶”里
  deps.add(activeEffect);
}
```

那么如何构建这个红色箭头的关系呢？

```js
function track(target, key) {
  // ... 之前的代码
	let deps = depsMap.get(key);

  // 如果 deps 不存在，同样新建一个 Set 并与 key 关联
  if (!deps) {
    depsMap.set(key, (deps = new Set()));
  }
  // 最后将当前激活的副作用函数添加到“桶”里
  deps.add(activeEffect);
  // deps就是当前副作用函数存在联系的依赖集合
  // 将其添加到activeEffect.deps数组中
  activeEffect.deps.push(deps); // 构建红色箭头的关系
}
```

红色箭头为什么会有交叉的情况？

我们来写一个 case 看看：

```js
it('effecFn 被收集在多个依赖集合中', () => {
  const obj = reactive({ name: 'dahuang', age: 18, isStudent: true })

  effect(function effectFn1() {
    const info = obj.name + obj.age
    console.log(info);
  })
}) 
```

调试结果如下：

![image-20240117234112420](https://qn.huat.xyz/mac/202401172341462.png)

我们可以看到 `effectFn1` 被收集到了 2 个集合中

#### 依赖删除

现在双向依赖已经构建完成，接下来进行删除，我们需要考虑：

- 什么时候删除？每次副作用函数执行时
- 如何删除？找到 `effectFn` 所在的依赖集合，然后在集合中删除 `effectFn`

代码如下：

```js
function cleanup(effectFn) {
  // 遍历 effectFn.deps 数组
  for (let i = 0; i < effectFn.deps.length; i++) {
    // deps 是依赖集合
    const deps = effectFn.deps[i];
    // 将 effectFn 从依赖集合中移除
    deps.delete(effectFn);
  }
  // 最后需要重置 effectFn.deps 数组
  effectFn.deps.length = 0;
}
```



#### 死循环问题

**先不要运行代码，会死循环！！！**

问题出在 `trigger`函数中:

```js
function trigger(target, key) {
  // 获取与目标对象相关联的依赖映射
  const depsMap = bucket.get(target);
  // 如果没有依赖映射，则直接返回
  if (!depsMap) return;
  // 获取与特定属性键相关联的所有副作用函数
  const effects = depsMap.get(key);
  // 这行代码有问题
  effects && effects.forEach((effectFn) => effectFn()); 
}
```

在` trigger` 函数内部，我们遍历 `effects` 集合，它是一个 `Set` 集合，里面存储着副作用函数。当副作用函数执行时，会调用`cleanup` 进行清除，实际上就是从 `effects` 集合中将当前执行的副作用函数剔除，但是副作用函数的执行会导致其重新被收集到集合中，而此时对于 `effects`集合的遍历仍在进行。这个行为可以用如下简短的代码来表达：

```js
const set = new Set([1])
set.forEach(item => {
  set.delete(1)
  set.add(1)
  console.log('遍历中...');
})
```

在上面这段代码中，我们创建了一个集合 `Set`，它里面有一个元素数字 1，接着我们调用 `forEach`遍历该集合。在遍历过程中，首先调用 `delete(1)`删除数字 1，紧接着调用 `add(1)`将数字 1加回，最后打印 '遍历中'。如果我们在浏览器中执行这段代码，就会发现它会无限执行下去。

在调用 `forEach`遍历 `Set` 集合时，如果一个值已经被访问过了，但该值被删除并重新添加到集合，如果此时 `forEach`遍历没有结束，那么该值会重新被访问。因此，上面的代码会无限执行。

解决办法很简单，我们可以构造另外一个`Set` 集合并遍历它：

```js
const set = new Set([1])
const newSet = new Set(set)
newSet.forEach(item => {
  set.delete(1)
  set.add(1)
  console.log('遍历中...');
})
```

回到 `trigger`函数，我们需要同样的手段来避免无限执行：

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

  // 创建一个新的 Set 来存储需要执行的副作用函数，避免在执行过程中的重复或无限循环
  const effectsToRun = new Set(effects);
  // 遍历并执行所有相关的副作用函数
  effectsToRun.forEach((effectFn) => effectFn());
}
```

我们新构造了 `effectsToRun` 集合并遍历它，代替直接遍历 `effects` 集合，从而避免了无限执行。

图解如下：

![image-20240118214456178](https://qn.huat.xyz/mac/202401182144236.png)



#### 运行单测

现在我们再去运行我们的单测，就可以看到可以通过了

![image-20240117235220666](https://qn.huat.xyz/mac/202401172352733.png)

### 流程图解

依赖清理整体流程图解：



![image-20240117235403408](https://qn.huat.xyz/mac/202401172354469.png)



相关代码在 `commit： (00fb4a2)`实现依赖清理 ，`git checkout 00fb4a2` 即可查看。 





