import { describe, it, expect, vi } from "vitest";
import { effect, reactive } from "../main";

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
});
