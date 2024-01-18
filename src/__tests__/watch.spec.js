import { reactive } from "../main";
import { watch } from '../watch';
import { describe, it, expect, vi } from "vitest";

describe("watch", () => {
  it("watch foo", () => {
    const mockFn = vi.fn();

    // 创建响应式对象
    const obj = reactive({ foo: 100 });

    watch(obj, () => {
      mockFn()
    });
    
    obj.foo ++

    expect(mockFn).toHaveBeenCalledTimes(1);
  });

  it("watch 多个属性", () => {
    const mockFn = vi.fn();

    // 创建响应式对象
    const obj = reactive({ foo: 100, bar: 200, age: 10 });

    watch(obj, () => {
      mockFn()
    });
    
    obj.bar ++

    obj.age ++

    expect(mockFn).toHaveBeenCalledTimes(2);
  });

  it('支持 getter 函数', () => {
    const mockFn = vi.fn();

    // 创建响应式对象
    const obj = reactive({ foo: 100, bar: 200, age: 10 });

    watch(() => obj.age, () => {
      mockFn()
    });
    

    obj.age ++

    expect(mockFn).toHaveBeenCalledTimes(1);
  })

  it('get newVal and oldVal', () => {
    // 创建响应式对象
    const obj = reactive({ foo: 100, bar: 200, age: 10 });

    let newValue = null
    let oldValue = null

    watch(() => obj.age, (newVal, oldVal) => {
      newValue = newVal
      oldValue = oldVal
    });

    obj.age ++

    expect(newValue).toBe(11);
    expect(oldValue).toBe(10);
  })

  it('支持 immediate', () => {
    const mockFn = vi.fn();

    // 创建响应式对象
    const obj = reactive({ foo: 100, bar: 200, age: 10 });

    let newValue = undefined
    let oldValue = undefined

    watch(() => obj.age, (newVal, oldVal) => {
      mockFn()
      newValue = newVal
      oldValue = oldVal
    }, {
      immediate: true
    });

    expect(mockFn).toHaveBeenCalledTimes(1);
    expect(newValue).toBe(10);
    expect(oldValue).toBe(undefined);


    obj.age ++
    expect(mockFn).toHaveBeenCalledTimes(2);
    expect(newValue).toBe(11);
    expect(oldValue).toBe(10);
  })
});



