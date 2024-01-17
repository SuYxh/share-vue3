import { describe, it, expect, vi } from 'vitest';
import { effect, reactive } from '../main';

describe('reactivity system', () => {
  it('should run the effect function when reactive properties change', async () => {
    const consoleSpy = vi.spyOn(console, 'log'); // 捕获 console.log

    // 创建响应式对象
    const obj = reactive({ name: 'dahuang', age: 18 });

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
      obj.address = 'beijing';
    }, 2000);
    await new Promise((r) => setTimeout(r, 2100));

    // 验证 effect 没有因 address 改变而执行
    expect(consoleSpy).toHaveBeenCalledTimes(2); 

    consoleSpy.mockRestore(); // 清除 mock
  });

  it('why use Reflect', () => {
    const consoleSpy = vi.spyOn(console, 'log'); // 捕获 console.log
    const obj = reactive({
      foo: 1,
      get bar() {
        return this.foo
      }
    })
    effect(() => {
      console.log(obj.bar);
    })
    expect(consoleSpy).toHaveBeenCalledTimes(1); 
    obj.foo ++
    expect(consoleSpy).toHaveBeenCalledTimes(2); 
  })
});