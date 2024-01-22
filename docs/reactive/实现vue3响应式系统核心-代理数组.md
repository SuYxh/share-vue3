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





## 数组的查找方法

经过上面的内容，我们发现大多数情况下，我们不需要做特殊处理即可让这些方法按预期工作。那么我们在来看看一些查找的方法。

看看这个 `includes` 方法：

```js
it("数组-1 includes", () => {
    const arr = reactive([1, 2]);
    let flag;

    effect(function effectFn() {
      flag = arr.includes(1)
      console.log(flag);
    });

    expect(flag).toBe(true)

    arr[0] = 100
    expect(flag).toBe(false)
  })
```

运行一下，

![image-20240122212037551](https://qn.huat.xyz/mac/202401222120620.png)

没问题。



### includes(arr[0])

#### 单元测试

真的没问题吗？再看看这个：

```js
it("数组-2 includes", () => {
  const obj = {}
  const arr = reactive([obj]);
  let flag;

  effect(function effectFn() {
    flag = arr.includes(arr[0])
    console.log(flag);
  });

  expect(flag).toBe(true)
})
```

![image-20240122212240809](https://qn.huat.xyz/mac/202401222122883.png)

不科学啊，明明就有，为什么会失败呢？

#### 问题分析

在 `arr.includes(arr[0])` 语句中，`arr`是代理对象，所以` includes`函数执行时的` this`指向的是代理对象，即 `arr`。我们使用的是 `reactive` 方法创建的响应式对象，是一个深响应，之前有讲到过。`arr[0]` 是一个对象类型的数据，会再次使用 `reactive` 方法创建对象，得到的值就是新的代理对象而非原始对象。而在 `includes` 方法内部也会通过 `arr` 访问数组元素，从而也得到一个代理对象，问题是这两个代理对象是不同的。因为每次调用`reactive`函数时都会创建一个新的代理对象。



为了能够更好的理解，我们来模拟实现一个 `includes` 方法：

```js
Array.prototype.includes = function (element) {
  for (let i = 0; i < this.length; i++) {
    if (this[i] === element) {
      return true;
    }
  }
  return false;
};
```



再来解释一下这句话  `这两个代理对象是不同的` ：

-  `arr.includes(arr[0])` 语句中，`arr[0]` 取值时候发现是一个对象，会调用 `reactive` 方法，返回一个代理对象，这里叫做  `p1`

-  `arr.includes(arr[0])` 还是这语句中，使用 `includes`时，在上述模拟的代码中，可以看到 `this[i] === element`  也会去取值进行判断，取值的时候发现也是一个对象，会调用 `reactive` 方法，返回一个代理对象，这里叫做 `p2`

  这里大家应该都看出来了吧，一个函数以相同的入参执行 2 次，每次返回都是一个新的对象，肯定就不想等啦。



#### 解决

```js
// 定义一个 Map 实例，存储原始对象到代理对象的映射
const reactiveMap = new Map();

function reactive(obj) {
  // 优先通过原始对象 obj 寻找之前创建的代理对象，如果找到了，直接返回已有的代理对象
  const existionProxy = reactiveMap.get(obj);
  if (existionProxy) return existionProxy;

  // 否则，创建新的代理对象
  const proxy = createReactive(obj);
  // 存储到 Map 中，从而避免重复创建
  reactiveMap.set(obj, proxy);

  return proxy;
}
```

就是找个地记录一下，有没有被代理过，如果有代理过，就返回代理过的，如果没有就创建新的，然后记录一下。相当于建立一个缓存，缓存中有，就说明被代理过，直接返回就好。

#### 运行单测

![image-20240122214321901](https://qn.huat.xyz/mac/202401222143980.png)

这下就没有问题了。



### includes(obj)

#### 单元测试

将上面的单测简单的改动，将 `arr.includes(arr[0])` 改成 `arr.includes(obj)`

```js
it("数组-3 includes", () => {
  const obj = {}
  const arr = reactive([obj]);
  let flag;

  effect(function effectFn() {
    flag = arr.includes(obj)
    console.log(flag);
  });

  expect(flag).toBe(true)
})
```

再跑一下：

![image-20240122214718927](https://qn.huat.xyz/mac/202401222147003.png)

`reactive([obj]);` 里面明明有 `obj`，怎么又找不到了呢？

#### 问题分析

从代码中可以看到，这是很符合直觉的行为。明明把`obj`作为数组的第一个元素了，为什么在数组中却仍然找不到`obj`对象。

真正的原因是，因为`includes`内部的`this`指向的是代理对象 `arr`，并且在获取数组元素时得到的值也是代理对象，所以拿原始对象 `obj`去查找肯定找不到，因此返回 `false`。

为了更好理解，再看一下这个模拟方法：

```js
Array.prototype.includes = function (element) {
  for (let i = 0; i < this.length; i++) {
    if (this[i] === element) {
      return true;
    }
  }
  return false;
};
```

逐句解释：

- `includes`内部的`this`指向的是代理对象 `arr` ： 因为是 `arr`调用的 `includes(obj)` 方法，而 `arr`是`reactive` 方法返回的
- 并且在获取数组元素时得到的值也是代理对象： `this[i]` 会进行取值，取出的值为对象类型，会再次调用 `reactive` 方法，所以得到的值为代理对象
- 所以拿原始对象 `obj`去查找肯定找不到： 看看这句代码`this[i] === element`，`this[i]`是 `obj`的代理对象，`element`是 `obj`对象，肯定不想等



#### 解决

1、重写 `includes` !

```js
const originMethod = Array.prototype.includes;
const arrayInstrumentations = {
  includes: function(...args) {
    // this 是代理对象，先在代理对象中查找，将结果存储到 res 中
    let res = originMethod.apply(this, args);

    if (res === false) {
      // res 为 false 说明没找到，通过 this[symbolRaw] 拿到原始数组，再去其中查找并更新 res 值
      res = originMethod.apply(this[symbolRaw], args);
    }
    // 返回最终结果
    return res;
  }
};
```

> `symbolRaw` 其实就是`const symbolRaw = Symbol("raw");` 避免冲突

先在代理对象中进行查找，这其实是实现了 `arr.include(obj)`的默认行为。如果找不到，通过 `this[symbolRaw]`拿到原始数组，再去其中查找，最后返回结果。



2、拦截 `includes`等方法

```js
function createReactive(obj, isShallow = false, isReadonly = false) {
  return new Proxy(obj, {
    // 拦截读取操作
    get(target, key, receiver) {
      console.log('get: ', key);
      if (key === symbolRaw) {
        return target;
      }
      // 如果操作的目标对象是数组，并且 key 存在于 arrayInstrumentations 上，
      // 那么返回定义在 arrayInstrumentations 上的值
      if (Array.isArray(target) && arrayInstrumentations.hasOwnProperty(key)) {
        return Reflect.get(arrayInstrumentations, key, receiver);
      }

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

`arr.includes` 可以理解为读取代理对象 `arr`的`includes`属性，这就会触发 `get`拦截函数，在该函数内检查` target`是否是数组，如果是数组并且读取的键值存在于 `arrayInstrumentations`上，则返回定义在 `arrayInstrumentations`对象上相应的值。也就是说，当执行`arr.includes`时，实际执行的是定义在 `arrayInstrumentations`上的 `includes` 函数，这样就实现了重写。

#### 运行单测

![image-20240122220406105](https://qn.huat.xyz/mac/202401222204204.png)

这下就没有问题了。



### 优化完善

除了 `includes` 方法之外，还需要做类似处理的数组方法有` indexOf`和` lastIndexOf`，因为它们都属于根据给定的值返回查找结果的方法。所以我们还需要增加对这2 个方法的支持：

```js
const arrayInstrumentations = {};

['includes', 'indexOf', 'lastIndexOf'].forEach(method => {
  const originMethod = Array.prototype[method];
  arrayInstrumentations[method] = function(...args) {
    // this 是代理对象，先在代理对象中查找，将结果存储到 res 中
    let res = originMethod.apply(this, args);

    if (res === false || res === -1) {
      // res 为 false 或 -1 说明没找到，通过 this.raw 拿到原始数组，再去其中查找，并更新 res 值
      res = originMethod.apply(this.raw, args);
    }
    // 返回最终结果
    return res;
  };
});
```

### 运行测试

![image-20240122221112904](https://qn.huat.xyz/mac/202401222211005.png)



## 隐式修改数组长度的原型方法

会隐式修改数组长度的方法，主要指的是数组的栈方法，例如 `push/pop/shift/unshift` 除此之外，`splice`方法也会隐式地修改数组长度。

### 单元测试

```js
it("数组 push", () => {
  const mockFn = vi.fn();
  const arr = reactive([]);

  try {

    effect(function effectFn1() {
      arr.push(1)
    });

    effect(function effectFn2() {
      arr.push(1)
    });
  } catch (error) {
    mockFn();
  }

  expect(mockFn).toHaveBeenCalledTimes(0);
});
```

执行一下：

![image-20240122221610820](https://qn.huat.xyz/mac/202401222216921.png)

从测试可以看出这段代码报错。

在浏览器中运行上面这段代码，会得到栈溢出的错误（Maximum call stack size exceeded）



### 问题分析

第一个副作用函数执行。在该函数内，调用 `arr.push` 方法向数组中添加了一个元素。调用数组的 `push`方法会间接读取数组的` length`属性。所以，当第一个副作用函数执行完毕后，会与` length`属性建立响应联系。

第二个副作用函数执行。同样，它也会与` length` 属性建立响应联系。但不要忘记，调用` arr.push` 方法不仅会间接读取数组的 `length`属性，还会间接设置` length` 属性的值。

第二个函数内的 `arr.push` 方法的调用设置了数组的` length`属性值。于是，响应系统尝试把与` length `属性相关联的副作用函数全部取出并执行，其中就包括第一个副作用函数。问题就出在这里，可以发现，第二个副作用函数还未执行完毕，就要再次执行第一个副作用函数了。第一个副作用函数再次执行。同样，这会间接设置数组的` length`属性。于是，响应系统又要尝试把所有与` length `属性相关联的副作用函数取出并执行，其中就包含第二个副作用函数。

如此循环往复，最终导致调用栈溢出。

根本原因是 `push` 方法的调用会间接读取 `length` 属性。

### 解决

们“屏蔽”对 `length` 属性的读取，从而避免在它与副作用函数之间建立响应联系。

1、重写数组的 `push` 方法

```js
// 一个标记变量，代表是否进行追踪。默认值为 true，即允许追踪
let shouldTrack = true;

// 重写数组的 push 方法
['push'].forEach(method => {
  // 取得原始 push 方法
  const originMethod = Array.prototype[method];
  // 重写
  arrayInstrumentations[method] = function(...args) {
    // 在调用原始方法之前，禁止追踪
    shouldTrack = false;
    // push 方法的默认行为
    let res = originMethod.apply(this, args);
    // 在调用原始方法之后，恢复原来的行为，即允许追踪
    shouldTrack = true;
    return res;
  };
});
```

定义变量 `shouldTrack` 代表是否允许追踪。接着，我们重写了数组的 `push` 方法，在执行默认行为之前，先将标记变量 `shouldTrack` 的值设置为 `false`，即禁止追踪。当` push `方法的默认行为执行完毕后，再将标记变`shouldTrack`的值还原为` true`，代表允许追踪。



2、在 `track` 方法中设置开关

```js
function track(target, key) {
  // 当禁止追踪时，直接返回
  if (!activeEffect || !shouldTrack) return;
  // 省略部分代码
}
```

可以看到，当标记变量`shouldTrack `的值为` false`时，即禁止追踪时，`track`函数会直接返回。这样，当 `push`方法间接读取 `length`属性值时，由于此时是禁止追踪的状态，所以` length`属性与副作用函数之间不会建立响应联系。

### 运行单测

![image-20240122222611166](https://qn.huat.xyz/mac/202401222226273.png)



