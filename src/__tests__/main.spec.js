import { describe, it, expect, vi } from "vitest";
import {
  effect,
  reactive,
  shallowReactive,
  readonly,
  shallowReadonly,
  ref
} from "../main";

describe("reactivity system", () => {
  it("should run the effect function when reactive properties change", async () => {
    const consoleSpy = vi.spyOn(console, "log"); // 捕获 console.log

    // 创建响应式对象
    const obj = reactive({ name: "dahuang", age: 18 });

    // 定义 effect 函数
    effect(() => {
      console.log(obj.age);
    });

    // 检查 effect 是否立即执行
    expect(consoleSpy).toHaveBeenCalledWith(18);

    // 更改 age 属性并等待
    setTimeout(() => {
      obj.age = 23;
    }, 1000);
    await new Promise((r) => setTimeout(r, 1100)); // 等待上述 setTimeout 完成

    // 检查 effect 是否在 age 改变时再次执行
    expect(consoleSpy).toHaveBeenCalledWith(23);

    // 更改 address 属性并等待
    setTimeout(() => {
      obj.address = "beijing";
    }, 2000);
    await new Promise((r) => setTimeout(r, 2100));

    // 验证 effect 没有因 address 改变而执行
    expect(consoleSpy).toHaveBeenCalledTimes(2);

    consoleSpy.mockRestore(); // 清除 mock
  });

  it("why use Reflect", () => {
    const consoleSpy = vi.spyOn(console, "log"); // 捕获 console.log
    const obj = reactive({
      foo: 1,
      get bar() {
        return this.foo;
      },
    });
    effect(() => {
      console.log(obj.bar);
    });
    expect(consoleSpy).toHaveBeenCalledTimes(1);
    obj.foo++;
    expect(consoleSpy).toHaveBeenCalledTimes(2);
  });

  it("Dependency cleanup", () => {
    const consoleSpy = vi.spyOn(console, "log"); // 捕获 console.log
    const obj = reactive({ name: "dahuang", age: 18, isStudent: true });

    effect(() => {
      const info = obj.isStudent ? obj.name : obj.age;
      console.log(info);
    });

    // effect 立即执行，执行一次，打印 'dahuang'
    expect(consoleSpy).toHaveBeenCalledTimes(1);
    expect(consoleSpy).toHaveBeenCalledWith("dahuang");

    // 修改 name --> jarvis,  effect的回调会再次执行，打印 'jarvis'
    obj.name = "jarvis";
    expect(consoleSpy).toHaveBeenCalledTimes(2);
    expect(consoleSpy).toHaveBeenCalledWith("jarvis");

    // 修改 isStudent --> false,  effect的回调会再次执行，打印 18
    obj.isStudent = false;
    expect(consoleSpy).toHaveBeenCalledTimes(3);
    expect(consoleSpy).toHaveBeenCalledWith(18);

    // 再次修改 name -->  iron man,  期待effect的回调不会执行
    obj.name = "iron man";
    expect(consoleSpy).toHaveBeenCalledTimes(3);
  });

  it("effecFn 被收集在多个依赖集合中", () => {
    const obj = reactive({ name: "dahuang", age: 18, isStudent: true });
    effect(function effectFn1() {
      const info = obj.name + obj.age;
      console.log(info);
    });
  });

  it("effectFn1 and effectFn2 should be triggered appropriately", () => {
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

  it("should follow the correct order", () => {
    // 保存原始的 console.log
    const originalConsoleLog = console.log;
    // 创建一个模拟的 console.log 函数
    const mockConsoleLog = vi.fn();
    global.console.log = mockConsoleLog; // 重定向 console.log 到 mock 函数

    const obj = reactive({ foo: 1 });

    effect(
      () => {
        mockConsoleLog(obj.foo);
      },
      {
        scheduler: function (fn) {
          setTimeout(fn, 0);
        },
      }
    );

    obj.foo++;

    mockConsoleLog("结束了");

    // 检查调用顺序
    expect(mockConsoleLog.mock.calls[0][0]).toBe(1); // 第一次调用，参数应该是 1
    expect(mockConsoleLog.mock.calls[1][0]).toBe("结束了"); // 第二次调用，参数应该是 '结束了'

    // 清理模拟
    mockConsoleLog.mockClear();
    global.console.log = originalConsoleLog; // 恢复 console.log
  });

  it("拦截 in 操作符", () => {
    const mockFn = vi.fn();

    // 创建响应式对象
    const obj = reactive({ foo: 100 });

    effect(function effectFn1() {
      mockFn();
      console.log("foo" in obj);
    });

    expect(mockFn).toHaveBeenCalledTimes(1);

    delete obj.foo;

    // debugger
    // obj.foo
    expect(mockFn).toHaveBeenCalledTimes(2);
  });

  it("拦截 for in", () => {
    // 创建响应式对象
    const obj = reactive({ foo: 100 });
    const mockFn = vi.fn();

    effect(function effectFn1() {
      mockFn();

      for (const key in obj) {
        console.log(key);
      }
    });
    expect(mockFn).toHaveBeenCalledTimes(1);

    obj.bar = 2;
    expect(mockFn).toHaveBeenCalledTimes(2);

    obj.foo = 100;
    expect(mockFn).toHaveBeenCalledTimes(2);
  });

  it("拦截对象删除操作", () => {
    const mockFn = vi.fn();

    // 创建响应式对象
    const obj = reactive({ foo: 100 });

    effect(function effectFn1() {
      mockFn();
      console.log(obj.foo);
    });

    expect(mockFn).toHaveBeenCalledTimes(1);

    delete obj.foo;

    expect(mockFn).toHaveBeenCalledTimes(2);
  });

  it("newValue === oldValue", () => {
    const mockFn = vi.fn();
    const obj = reactive({ foo: 1, bar: NaN });

    effect(function effectFn() {
      mockFn();
      console.log(obj.foo);
      console.log(obj.bar);
    });

    expect(mockFn).toHaveBeenCalledTimes(1);

    obj.foo = 1;
    expect(mockFn).toHaveBeenCalledTimes(1);

    obj.bar = NaN;
    expect(mockFn).toHaveBeenCalledTimes(1);
  });

  it("原型继承属性", () => {
    const mockFn = vi.fn();

    const obj = {};
    const proto = { bar: 1 };

    const child = reactive(obj);
    const parent = reactive(proto);

    // 使用 parent 作为 child 的原型
    Object.setPrototypeOf(child, parent);

    effect(() => {
      mockFn();
      console.log(child.bar); // 1
    });
    expect(mockFn).toHaveBeenCalledTimes(1);

    // 修改 child.bar 的值
    child.bar = 2; // 会导致副作用函数重新执行两次
    expect(mockFn).toHaveBeenCalledTimes(2);
  });

  it("深响应 reactive", () => {
    const mockFn = vi.fn();

    const obj = reactive({ foo: { bar: 1 } });

    effect(function effectFn() {
      mockFn();
      console.log(obj.foo.bar);
    });
    expect(mockFn).toHaveBeenCalledTimes(1);

    obj.foo.bar = 2;
    expect(mockFn).toHaveBeenCalledTimes(2);
  });

  it("浅响应 shallowReactive", () => {
    const mockFn = vi.fn();

    const obj = shallowReactive({ foo: { bar: 1 } });

    effect(function effectFn() {
      mockFn();
      console.log(obj.foo.bar);
    });
    expect(mockFn).toHaveBeenCalledTimes(1);

    obj.foo.bar = 2;
    expect(mockFn).toHaveBeenCalledTimes(1);
  });

  it("只读 readonly", () => {
    const consoleSpy = vi.spyOn(console, "warn"); // 捕获 console.warn

    const obj = readonly({ foo: { bar: 1 } });

    effect(function effectFn() {
      consoleSpy();
      console.log(obj.foo.bar);
    });
    expect(consoleSpy).toHaveBeenCalledTimes(1);

    obj.foo.bar = 2;
    expect(consoleSpy).toHaveBeenCalledTimes(2);
  });

  it("浅只读 shallowReadonly", () => {
    const consoleSpy = vi.spyOn(console, "warn"); // 捕获 console.warn

    const obj = shallowReadonly({ foo: { bar: 1 } });

    effect(function effectFn() {
      consoleSpy();
      console.log(obj.foo.bar);
    });

    expect(consoleSpy).toHaveBeenCalledTimes(1);

    obj.foo.bar = 2;
    expect(consoleSpy).toHaveBeenCalledTimes(1);
  });

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

  it("设置数组 length 大于当前数组长度", () => {
    const arr = reactive([1]);
    const mockFn = vi.fn();

    effect(function effectFn() {
      mockFn();
      console.log(arr.length);
    });

    expect(mockFn).toHaveBeenCalledTimes(1);

    arr[1] = 2;
    expect(mockFn).toHaveBeenCalledTimes(2);
  });

  it("设置数组 length 影响数组元素", () => {
    const arr = reactive([1]);
    const mockFn = vi.fn();

    effect(function effectFn() {
      mockFn();
      console.log(arr[0]);
    });

    expect(mockFn).toHaveBeenCalledTimes(1);

    arr.length = 0;
    expect(mockFn).toHaveBeenCalledTimes(2);
  });

  it("数组遍历 for in", () => {
    const arr = reactive([1, 2]);
    const mockFn = vi.fn();

    effect(function effectFn() {
      mockFn();
      for (const key in arr) {
        console.log(key);
      }
    });

    expect(mockFn).toHaveBeenCalledTimes(1);

    // arr.length = 1
    arr[2] = 100;
    expect(mockFn).toHaveBeenCalledTimes(2);
  });

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

    arr[2] = 100;
    expect(mockFn).toHaveBeenCalledTimes(2);
  });

  it("数组-1 includes", () => {
    const arr = reactive([1, 2]);
    let flag;

    effect(function effectFn() {
      flag = arr.includes(1);
      console.log(flag);
    });

    expect(flag).toBe(true);

    arr[0] = 100;
    expect(flag).toBe(false);
  });

  it("数组-2 includes", () => {
    const obj = {};
    const arr = reactive([obj]);
    let flag;

    effect(function effectFn() {
      flag = arr.includes(arr[0]);
      console.log(flag);
    });

    expect(flag).toBe(true);
  });

  it("数组-3 includes", () => {
    const obj = {};
    const arr = reactive([obj]);
    let flag;

    effect(function effectFn() {
      flag = arr.includes(obj);
      console.log(flag);
    });

    expect(flag).toBe(true);
  });

  it("数组 push", () => {
    const mockFn = vi.fn();
    const arr = reactive([]);

    try {
      effect(function effectFn1() {
        arr.push(1);
      });

      effect(function effectFn2() {
        arr.push(1);
      });
    } catch (error) {
      mockFn();
    }

    expect(mockFn).toHaveBeenCalledTimes(0);
  });

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
});
