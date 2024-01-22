![实现ref](https://qn.huat.xyz/mac/202401222311958.png)



## 简介

我们知道`Proxy`是用于拦截对象，那么针对原始值类型的数据应该怎么处理呢？

在 JavaScript 中，原始值是按值传递的，而非按引用传递。如果一个函数接收原始值作为参数，那么形参与实参之间没有引用关系，它们是两个完全独立的值，对形参的修改不会影响实参。

因此想要将原始值变成响应式数据，就必须对其做一层包裹，也就是我们接下来要介绍的 ref。




代码地址： https://github.com/SuYxh/share-vue3 

代码并没有按照源码的方式去进行组织，目的是学习、实现 vue3 响应式系统的核心，用最少的代码去实现最核心的能力，减少我们的学习负担，并且所有的流程都会有配套的图片，图文 + 代码，让我们学习更加轻松、快乐。

每一个功能都会提交一个 `commit` ，大家可以切换查看，也顺变练习练习 git 的使用。



## ref概念

由于 `Proxy` 的代理目标必须是非原始值，所以我们没有任何手段拦截对原始值的操作，只有使用一个非原始值去“包裹”原始值，例如使用一个对象包裹原始值：

```js
const wrapper = {
  value: 'vue'
};

// 可以使用 Proxy 代理 wrapper，间接实现对原始值的拦截
const name = reactive(wrapper);

name.value; // vue

// 修改值可以触发响应
name.value = 'vue3';
```

但这样做会导致两个问题：

- 用户为了创建一个响应式的原始值，不得不顺带创建一个包裹对象，比如 `wrapper`；
- 包裹对象由用户定义，而这意味着不规范。用户可以随意命名，例如 `wrapper.value`、`wrapper.val` 都是可以的。

所以 vue 做了一层封装，就算他不做，以后也会有人做，一旦各种方案都有，就会比较混乱，还是官方去做了这件事。

## 实现 ref

### 单元测试

```js
it("ref 基础能力", () => {
  const mockFn = vi.fn();

  // 创建原始值的响应式数据
  const refVal = ref(1);

  effect(() => {
    mockFn();
    // 在副作用函数内通过 value 属性读取原始值
    console.log(refVal.value);
  });
  expect(mockFn).toHaveBeenCalledTimes(1);

  // 修改值能够触发副作用函数重新执行
  refVal.value = 2;
  expect(mockFn).toHaveBeenCalledTimes(2);
});
```



### 代码实现

```js
// 封装一个 ref 函数
function ref(val) {
  // 在 ref 函数内部创建包裹对象
  const wrapper = {
    value: val
  };
  // 将包裹对象变成响应式数据
  return reactive(wrapper);
}
```

### 运行单测

![image-20240122232328263](https://qn.huat.xyz/mac/202401222323304.png)

没有任何问题。一个最基础的 ref 就实现了。



## 实现isRef

如何区分 `refVa` 到底是原始值的包裹对象，还是一个非原始值的响应式数据，如以下代码所示：

```js
const refVal1 = ref(1)
const refVal2 = reactive({ value: 1 })
```

这段代码中的 `refVal1` 和 `refVal2`有什么区别呢？

从我们的实现来看，它们没有任何区别。但是，我们有必要区分一个数据到底是不是 `ref`，因为后续会有自动脱 `ref` 能力。

### 单元测试

```js
it("is ref", () => {
  const refVal1 = ref(1)
  const refVal2 = reactive({ value: 1 })

  const flag1 = isRef(refVal1)
  const flag2 = isRef(refVal2)

  expect(flag1).toBe(true)
  expect(flag2).toBe(false)
})
```



### 实现

```js
function ref(val) {
  const wrapper = {
    value: val
  };

  // 使用 Object.defineProperty 在 wrapper 对象上定义一个不可枚举的属性 __v_isRef，并且值为 true
  Object.defineProperty(wrapper, '__v_isRef', {
    value: true
  });

  return reactive(wrapper);
}
```

使用 `Object.defineProperty` 为包裹对象 `wrapper` 定义了一个不可枚举且不可写的属性`__v_isRef`，它的值为`true`，代表这个对象是一个`ref`，而非普通对象。

在实现一下 `isRef` 函数：

```js
function isRef(refVal) {
  return !!refVal['__v_isRef']
}
```

### 运行单测

![image-20240122233701657](https://qn.huat.xyz/mac/202401222337704.png)



## 实现 toRef 

想必响应式丢失问题，大家都不陌生。这里介绍一下这个现象：

```js
export default {
  setup() {
    // 响应式数据
    const obj = reactive({ foo: 1, bar: 2 });

    // 将数据暴露到模板中
    return {
      ...obj
    };
  }
};
```

如果我们在模板中直接这样写： 

```html
<p>{{ foo }} / {{ bar }}</p>
```

那么当修改数据， `obj.foo = 100` 时，模板并不会发生变化。

为什么会导致响应丢失呢？这是由展开运算符（...）导致的。

```js
return {
	...obj
}

return {
	foo: 1,
	bar:2
}
```

这 2 种写法是等价的。这其实就是返回了一个普通对象，它不具有任何响应式能力。只有经过`reactive`代理过的才是响应式数据。

那么解构呢？

```js
const { foo, bar } = reactive({ foo: 1, bar: 2 });

return {
	foo, 
	bar
}
```

解构的本质： 创建新变量 -> 枚举属性 -> 复制属性并赋值。

一样也相当于是返回了一个普通对象。



### 单元测试

```js
it("toRef-1", () => {
  const mockFn = vi.fn();

  // obj 是响应式数据
  const obj = reactive({ foo: 1, bar: 2 });

  // 将响应式数据展开到一个新的对象 newObj
  const newObj = {
    ...obj,
  };

  effect(() => {
    mockFn()
    // 在副作用函数内通过新的对象 newObj 读取 foo 属性值
    console.log(newObj.foo);
  });
  expect(mockFn).toHaveBeenCalledTimes(1);


  // 很显然，此时修改 obj.foo 并不会触发响应
  obj.foo = 100;
  expect(mockFn).toHaveBeenCalledTimes(2);
});
```

### 问题分析

创建一个响应式的数据对象 `obj`，然后使用展开运算符得到一个新的普通对象 `newObj`。这里的关键点在于，副作用函数内访问的是普通对象 `newObj`，它没有任何响应能力，所以当我们尝试修改 `obj.foo`的值时，不会触发副作用函数重新执行。

### 解决

我们修改一下单测，

```js
it("toRef-2", () => {
  const mockFn = vi.fn();

  // obj 是响应式数据
  const obj = reactive({ foo: 1, bar: 2 });

  // 将响应式数据展开到一个新的对象 newObj
  const newObj = {
    foo: {
      get value() {
        return obj.foo
      }
    },
    bar: {
      get value() {
        return obj.bar
      }
    }
  };

  effect(() => {
    mockFn()
    // 在副作用函数内通过新的对象 newObj 读取 foo 属性值
    console.log(newObj.foo.value);
  });
  expect(mockFn).toHaveBeenCalledTimes(1);


  // 很显然，此时修改 obj.foo 并不会触发响应
  obj.foo = 100;
  expect(mockFn).toHaveBeenCalledTimes(2);
});
```

运行看看：

![image-20240122235350514](https://qn.huat.xyz/mac/202401222353570.png)

没有问题。

### 封装

根据上述 case 可以看出，当在副作用函数内读取`newObj.foo`时，等价于间接读取了`obj.foo`的值。这样响应式数据自然能够与副作用函数建立响应联系。于是，当我们尝试修改 `obj.foo`的值时，能够触发副作用函数重新执行。

于是我们可以进行一个简单的封装

```js
function toRef(obj, key) {
  const wrapper = {
    get value() {
      return obj[key];
    }
  };

  return wrapper;
}
```



### 运行单测

我们修改一下 case 如下：

```js
it("toRef-1", () => {
  const mockFn = vi.fn();

  // obj 是响应式数据
  const obj = reactive({ foo: 1, bar: 2 });

  // 将响应式数据展开到一个新的对象 newObj
  // const newObj = {
  //   ...obj,
  // };

  const newObj = {
    foo: toRef(obj, 'foo'),
    bar: toRef(obj, 'bar')
  }

  effect(() => {
    mockFn()
    // 在副作用函数内通过新的对象 newObj 读取 foo 属性值
    console.log(newObj.foo.value);
  });
  expect(mockFn).toHaveBeenCalledTimes(1);


  // 很显然，此时修改 obj.foo 并不会触发响应
  obj.foo = 100;
  expect(mockFn).toHaveBeenCalledTimes(2);
});
```

就可以通过了

![image-20240123000000075](https://qn.huat.xyz/mac/202401230000130.png)



### 优化

将通过 `toRef` 转换后得到的结果视为真正` ref`数据，为此我们需要为` toRef`函数增加一层拦截：

```js
function toRef(obj, key) {
  const wrapper = {
    get value() {
      return obj[key];
    },
  };

  // 定义 __v_isRef 属性
  Object.defineProperty(wrapper, "__v_isRef", {
    value: true,
  });

  return wrapper;
}
```



在编写一个单测

```js
it('toRef的数据是一个 ref', () => {
  const obj = reactive({ foo: 1, bar: 2 });
  const foo = toRef(obj, 'foo')
  const flag = isRef(foo)
  expect(flag).toBe(true)
})
```

运行一下

![image-20240123000631632](https://qn.huat.xyz/mac/202401230006700.png)

也是没有问题



## 实现toRefs

上文实现了`toRef`，但如果响应式数据 `obj` 的键非常多，我们还是要花费很大力气来做这一层转换。为此，我们可以封装 `toRefs` 函数，来批量地完成转换。

### 单元测试

```js
it('toRefs', () => {
  const obj = reactive({ foo: 1, bar: 2 });
  const refObj = toRefs(obj)
  const flag1 = isRef(refObj.foo)
  const flag2 = isRef(refObj.bar)

  expect(flag1).toBe(true)
  expect(flag2).toBe(true)
})
```



### 代码实现

```js
function toRefs(obj) {
  const ret = {};
  // 使用 for...in 循环遍历对象
  for (const key in obj) {
    // 逐个调用 toRef 完成转换
    ret[key] = toRef(obj, key);
  }
  return ret;
}
```



### 运行单测

![image-20240123001112684](https://qn.huat.xyz/mac/202401230011757.png)









