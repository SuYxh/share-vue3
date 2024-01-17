实现 vue3 响应式系统核心

## 简介

2023 年 12 月 31 日，vue2 已经停止维护了。你还不会 Vue3 的源码么？手把手带你实现一个 vue3 响应式系统。

你将获得：

- 思想
  - TDD 测试驱动开发
  - 重构
- 工程
  - [vitest](https://cn.vitest.dev/) 的使用
  - 如何使用  [ChatGPT](https://ask.vuejs.news/) 编写单元测试
- 原理
  - 响应式数据以及副作用函数
  - 响应式系统基本实现
  - Vue3 的响应式的数据结构是什么样？为什么是这样？如何形成的？
  - Proxy 为什么要配合 Reflect 使用？如果不配合会有什么问题？
  - 如何完善响应式系统
  - 依赖收集
  - 派发更新
  - 依赖清理
  - 支持嵌套
  - 实现执行调度
  - 实现 computed
  - 实现 watch
- 工具
  - typescript 的使用
  - ChatGPT 使用
  - excalidraw 画图工具
  - vitest runner

代码地址： https://github.com/SuYxh/share-vue3 

代码并没有按照源码的方式去进行组织，目的是学习、实现 vue3 响应式系统的核心，用最少的代码去实现最核心的能力，减少我们的学习负担，并且所有的流程都会有配套的图片，图文+代码，让我们学习更加轻松、快乐。

每一个功能都会提交一个 `commit` ，大家可以切换查看，也顺变练习练习 git 的使用。

## 环境搭建

1、使用 vite 创建一个空模板，

```
pnpm init vite
```

2、然后安装 vitest

```
pnpm add -D vitest
```

为什么要安装 vitest？

> 测试驱动开发(TDD) 是一种渐进的开发方法，它结合了测试优先的开发，即在编写足够的产品代码以完成测试和重构之前编写测试。目标是编写有效的干净代码

3、安装 vscode 插件  `Vitest Runner`

![image-20240117095404235](https://qn.huat.xyz/mac/202401170954339.png)

4、编写测试代码

在 mian.js 中编写

```typescript
export function add(a: number, b: number) {
  return a + b;
}
```

创建 `/src/__tests__/main.spec.ts`测试文件，写入：

```typescript
import { describe, it, expect } from 'vitest';
import { add } from '../main';

describe('add function', () => {
    it('adds two numbers', () => {
        expect(add(1, 2)).toBe(3);
    });
});
```

点击运行单测：

![image-20240117100044930](https://qn.huat.xyz/mac/202401171000982.png)

注意： 我这边因为还安装了 jest runner， 所有此处会有 2 对

运行结果：

![image-20240117100152032](https://qn.huat.xyz/mac/202401171001061.png)

到此，环境搭建结束！相关代码在 `commit： (3af5e60)环境搭建` ，`git checkout 3af5e60` 即可查看。



## 响应式数据以及副作用函数

副作用函数指的是会产生副作用的函数，如下：

```typescript
// 全局变量
let val = 1

function effect() {
	// 修改全局变量，产生副作用
	val = 2
}
```

当 `effect` 函数执行时，它会修改 `val` 的值，但除了 `effect` 函数之外的任何函数都可以修改 `val` 的值。也就是说，`effect`函数的执行会直接或间接影响其他函数的执行，这时我们说 `effect` 函数产生了副作用。

> 🤔 什么是纯函数？

假设在一个副作用函数中读取了某个对象的属性：

```typescript
const obj = { age: 18 }

function effect() {
	console.log(obj.age)
}
```

当 obj.age 的值发生变化时，我们希望副作用函数 `effect`  会重新执行，如果能实现这个目标，那么对象 obj 就是响应式数据。但很明显，以上面的代码来看，我们还做不到这一点，因为 obj是一个普通对象，当我们修改它的值时，除了值本身发生变化之外，不会有任何其他反应。



## 响应式系统基本实现

如何将 `obj` 变成一个响应式对象呢？大家肯定都想到了 `Object.defineProperty` 和 `Proxy` 。

- 当副作用函数 `effect` 执行时，会触发字段` obj.age` 的**读取**操作；
- 当修改 `obj.age` 的值时，会触发字段 `obj.age` 的**设置**操作。

我们可以把副作用函数` effect` 存储到一个“桶”里，如下图所示。

![image-20240117105714532](https://qn.huat.xyz/mac/202401171057575.png)

接着，当设置 `obj.age` 时，再把副作用函数 `effect` 从“桶”里取出并执行即可。

![image-20240117110913570](https://qn.huat.xyz/mac/202401171109611.png)

### 代码实现

```typescript
interface DataType {
  age: number;
  name: string
}

// 存储副作用函数的桶
const bucket: Set<() => void> = new Set();

// 原始数据
const data: DataType = { name: 'dahuang', age: 18 };

// 对原始数据的代理
const obj: DataType = new Proxy(data, {
  // 拦截读取操作
  get<T extends keyof DataType>(target: DataType, key: T) {
    // 将副作用函数 effect 添加到存储副作用函数的桶中
    bucket.add(effect);
    // 返回属性值
    return target[key];
  },
  // 拦截设置操作
  set<T extends keyof DataType>(target: DataType, key: T, newVal: DataType[T]): boolean {
    target[key] = newVal;
    bucket.forEach(fn => fn());
    return true;
  }
});

// 以下为测试代码
// 副作用函数
function effect(): void {
  console.log(obj.age);
}

// 执行副作用函数，触发读取
effect();

// 1 秒后修改响应式数据
setTimeout(() => {
  obj.age = 23;
}, 1000);
```

在浏览器中直接运行，我们可以得到期望的效果。

但目前的实现还存在一些缺陷：

- 直接通过名字`effect`来获取副作用函数，如果名称变了怎么办？
- 当我们在修改 `name` 的时候，副作用函数依然会执行

后续会逐步解决这些问题，这里大家只需要理解响应式数据的基本实现和工作原理即可。













