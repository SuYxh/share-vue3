![代理数组](https://qn.huat.xyz/mac/202401221918456.png)




## 简介

今天来实现使用`Proxy`对数组进行代理，在实现之前我们现回顾一下 `vue2` 中是如何实现的。



代码地址： https://github.com/SuYxh/share-vue3 

代码并没有按照源码的方式去进行组织，目的是学习、实现 vue3 响应式系统的核心，用最少的代码去实现最核心的能力，减少我们的学习负担，并且所有的流程都会有配套的图片，图文 + 代码，让我们学习更加轻松、快乐。

每一个功能都会提交一个 `commit` ，大家可以切换查看，也顺变练习练习 git 的使用。



## vue2 代理数组

通过修改数组实例的原型链来拦截数组的七个修改方法（`push`、`pop`、`shift`、`unshift`、`splice`、`sort` 和 `reverse`），以便在调用这些方法时触发视图的更新。代码实现如下：

```js
function render() {
  console.log('render');
}

// 保存原始的 Array 原型
const originProto = Array.prototype
// 创建一个新的原型对象，继承自 Array.prototype
const arrayPrototype = Object.create(originProto)
// 定义需要重写的方法
const methods = ['push', 'pop', 'unshift', 'shift', 'splice', 'sort', 'reverse']

methods.forEach(method => {
  arrayPrototype[method] = function (...params) {
    const result = originProto[method].apply(this, params)
    render()
    return result
  }
})

const arr = []
Object.setPrototypeOf(arr, arrayPrototype)

arr.push('1')
console.log(arr);
```

相信大家对于这个都很熟悉，接下来我们看看 vue3 代理数组。



## 数组的读取和操作

先写一个 case 看看我们目前的代码有哪些问题：

```js
it("测试数组代理", () => {
  const arr = reactive([1, 2, 3, 4]);
  const mockFn = vi.fn();

  effect(function effectFn() {
    mockFn();
    console.log(arr[0]);
  });

  expect(mockFn).toHaveBeenCalledTimes(1);

  arr[0] = "dahuang";
  expect(mockFn).toHaveBeenCalledTimes(2);
});
```

运行一下：

![image-20240122192916289](https://qn.huat.xyz/mac/202401221929341.png)

好像没有什么问题。那么来看看数组的读取和设置有哪些操作呢？

### 读取操作

- 通过索引访问数组元素值：`arr[0]`
- 访问数组的长度：`arr.length`
- 把数组作为对象，使用 `for...in`循环遍历
- 使用`for...of`迭代遍历数组
- 数组的原型方法，如 `concat/join/every/some/find/findIndex/includes`等，以及其他所有不改变原数组的原型方法。

### 设置操作

- 通过索引修改数组元素值：`arr[1] = 3`
- 修改数组长度：`arr.length = 0`
- 数组的栈方法：`push/pop/shift/unshift`
- 修改原数组的原型方法：`splice/fill/sort`等。



接下来，我们从通过索引读取或设置数组的元素值看起。

## 数组的索引与 length

### 设置的索引大于当前数组长度

当我们设置的索引大于当前的数组长度，会发生什么呢？

此时更新数组的`length`属性。所以当通过索引设置元素值时，可能会隐式地修改`length`的属性值。因此在触发响应时，也应该触发与`length`属性相关联的副作用函数重新执行。

看看这个 case：

```js
it("设置数组 length 大于当前数组长度", () => {
  const arr = reactive([1]);
  const mockFn = vi.fn();

  effect(function effectFn() {
    mockFn();
    console.log(arr.length);
  });

  expect(mockFn).toHaveBeenCalledTimes(1);

  arr[1] = 2
  expect(mockFn).toHaveBeenCalledTimes(2);
});
```

跑一下，

![image-20240122194328177](https://qn.huat.xyz/mac/202401221943209.png)

#### 问题分析

数组的原长度为 1，然后设置数组索引为 1 的元素值，这会导致数组的长度变为 2，理论上应该触发副作用函数重新执行，但是实际上并没有，因为我们没有处理这种情况。

#### 解决

1、我们在`set` 函数中增加一些逻辑：

判断操作类型时，增加对数组类型的判断。如果代理的目标对象是数组

- 被设置的索引值如果小于数组长度，就视作 `SET` 操作，因为它不会改变数组长度；
- 如果设置的索引值大于数组的当前长度，则视作 `ADD` 操作，因为这会隐式地改变数组的 `length` 属性值。

```js
function createReactive(obj, isShallow = false, isReadonly = false) {
  return new Proxy(obj, {
    // 拦截设置操作
    set(target, key, newVal, receiver) {
      if (isReadonly) {
        console.warn(`属性 ${key} 是只读的`);
        return true;
      }
      const oldVal = target[key];
      // 如果属性不存在，则说明是在添加新的属性，否则是设置已有属性
      const type = Array.isArray(target)
        // 如果代理目标是数组，则检测被设置的索引值是否小于数组长度，
        // 如果是，则视作 SET 操作，否则是 ADD 操作
        ? Number(key) < target.length ? 'SET' : 'ADD'
        : Object.prototype.hasOwnProperty.call(target, key) ? 'SET' : 'ADD';

      const res = Reflect.set(target, key, newVal, receiver);
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

2、在` trigger` 函数中触发与数组对象的` length` 属性相关的副作用函数 :

```js
function trigger(target, key, type) {
  const depsMap = bucket.get(target);
  if (!depsMap) return;
  // 省略部分内容

  // 当操作类型为 ADD 并且目标对象是数组时，应该取出并执行那些与 length 属性相关联的副作用函数
  if (type === 'ADD' && Array.isArray(target)) {
    // 取出与 length 相关联的副作用函数
    const lengthEffects = depsMap.get('length');
    // 将这些副作用函数添加到 effectsToRun 中，待执行
    lengthEffects && lengthEffects.forEach(effectFn => {
      if (effectFn !== activeEffect) {
        effectsToRun.add(effectFn);
      }
    });
  }

  effectsToRun.forEach(effectFn => {
    if (effectFn.options.scheduler) {
      effectFn.options.scheduler(effectFn);
    } else {
      effectFn();
    }
  });
}
```

#### 运行单测

![image-20240122195631321](https://qn.huat.xyz/mac/202401221956367.png)

好了



### 修改 length 影响数组元素

当我们修改数组的 `length` 属性也会隐式地影响数组元素，例如：

```js
it("设置数组 length 影响数组元素", () => {
  const arr = reactive([1]);
  const mockFn = vi.fn();

  effect(function effectFn() {
    mockFn();
    console.log(arr[0]);
  });

  expect(mockFn).toHaveBeenCalledTimes(1);

  arr.length = 0
  expect(mockFn).toHaveBeenCalledTimes(2);
});
```

失败了。

![image-20240122195913010](https://qn.huat.xyz/mac/202401222004570.png)

#### 问题分析

`arr.length = 0`这会隐式地影响数组元素，即所有元素都被删除，所以应该触发副作用函数重新执行，然而并没有执行。也并非所有对 `length`属性的修改都会影响数组中的已有元素，比如我们将 `length`属性设置为 100，这并不会影响第 0 个元素，所以就不需要触发副作用函数重新执行。

重新执行副作用函数的条件：当修改`length`属性值时，只有大于或等于新的` length`属性值的元素才需要触发响应。

#### 代码实现

1、需要修改 `set` 拦截函数

```js
function createReactive(obj, isShallow = false, isReadonly = false) {
  return new Proxy(obj, {
    // 拦截设置操作
    set(target, key, newVal, receiver) {
      if (isReadonly) {
        console.warn(`属性 ${key} 是只读的`);
        return true;
      }
      const oldVal = target[key];

      const type = Array.isArray(target)
        ? Number(key) < target.length ? 'SET' : 'ADD'
        : Object.prototype.hasOwnProperty.call(target, key) ? 'SET' : 'ADD';

      const res = Reflect.set(target, key, newVal, receiver);
      if (target === receiver.raw) {
        if (oldVal !== newVal && (oldVal === oldVal || newVal === newVal)) {
          // 增加第四个参数，即触发响应的新值
          trigger(target, key, type, newVal);
        }
      }

      return res;
    },
  });
}
```



2、在调用` trigger` 函数触发响应时，把新的属性值传递过去

> ⚠️ 如何判断大于或等于新的` length`属性值的元素？

```js
// 为 trigger 函数增加第四个参数，newVal，即新值
function trigger(target, key, type, newVal) {
  const depsMap = bucket.get(target);
  if (!depsMap) return;
  // 省略其他代码

  // 如果操作目标是数组，并且修改了数组的 length 属性
  if (Array.isArray(target) && key === 'length') {
    // 对于索引大于或等于新的 length 值的元素，
    // 需要把所有相关联的副作用函数取出并添加到 effectsToRun 中待执行
    depsMap.forEach((effects, key) => {
      if (key >= newVal) {
        effects.forEach(effectFn => {
          if (effectFn !== activeEffect) {
            effectsToRun.add(effectFn);
          }
        });
      }
    });
  }

  effectsToRun.forEach(effectFn => {
    if (effectFn.options.scheduler) {
      effectFn.options.scheduler(effectFn);
    } else {
      effectFn();
    }
  });
}
```

#### 运行单测

![image-20240122201442701](https://qn.huat.xyz/mac/202401222014764.png)

这样就好啦



## 遍历数组

### for in

数组也是对象，那么也可以使用 `for...in` 遍历，不过应该尽量避免使用` for...in `遍历数组。

对于普通对象，只有当添加或删除属性值时才会影响 `for...in` 循环的结果，所以当添加或删除属性操作发生时，我们需要取出与` ITERATE_KEY` 相关联的副作用函数重新执行。

对于数组来说情况有所不同，

- 添加新元素：`arr[100] = 'bar'`
- 修改数组长度：`arr.length = 0`

其实，无论是为数组添加新元素，还是直接修改数组的长度，本质上都是因为修改了数组的 `length`属性。一旦数组的` length` 属性被修改，那么` for...in `循环对数组的遍历结果就会改变，所以在这种情况下我们应该触发响应。

```js
function createReactive(obj, isShallow = false, isReadonly = false) {
  return new Proxy(obj, {
    // 省略其他拦截函数
    ownKeys(target) {
      // 如果操作目标 target 是数组，则使用 length 属性作为 key 并建立响应联系
      track(target, Array.isArray(target) ? 'length' : ITERATE_KEY);
      return Reflect.ownKeys(target);
    }
  });
}
```



### for of

```js
it("数组遍历 for of", () => {
  const arr = reactive([1, 2]);
  const mockFn = vi.fn();

  effect(function effectFn() {
    mockFn();
    for (const key of arr) {
      console.log(key);
    }
  });

  expect(mockFn).toHaveBeenCalledTimes(1);

  arr[2] = 100
  expect(mockFn).toHaveBeenCalledTimes(2);
})
```

![image-20240122203402582](https://qn.huat.xyz/mac/202401222034644.png)

可以看到，不需要增加任何代码就能够使其正确地工作。这是因为只要数组的长度和元素值发生改变，副作用函数自然会重新执行。



在使用` for...of` 循环时，会读取数组的 `Symbol.iterator`属性。该属性是一个 `symbol` 值，为了避免发生意外的错误，以及性能上的考虑，我们不应该在副作用函数与 `Symbol.iterator` 这类` symbol`值之间建立响应联系，因此需要修改 get 拦截函数，如以下代码所示：

```js
function createReactive(obj, isShallow = false, isReadonly = false) {
  return new Proxy(obj, {
    // 拦截读取操作
    get(target, key, receiver) {
      console.log('get: ', key);
      if (key === 'raw') {
        return target;
      }

      // 添加判断，如果 key 的类型是 symbol，则不进行追踪
      if (!isReadonly && typeof key !== 'symbol') {
        track(target, key);
      }

      const res = Reflect.get(target, key, receiver);

      if (isShallow) {
        return res;
      }

      if (typeof res === 'object' && res !== null) {
        return isReadonly ? readonly(res) : reactive(res);
      }

      return res;
    },
  });
}
```

