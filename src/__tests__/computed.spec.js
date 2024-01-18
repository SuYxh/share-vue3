import { reactive, effect } from "../main";
import { computed } from '../computed';
import { describe, it, expect, vi } from "vitest";

describe("computed", () => {
  it("base computed", () => {
    // 创建响应式对象
    const obj = reactive({ price: 100, num: 10 });

    const allPrice = computed(() => obj.price * obj.num);

    expect(allPrice.value).toBe(1000);
  });

  it("should cache computed properties", () => {
    // 创建响应式对象
    const obj = reactive({ price: 100, num: 10 });

    // 创建计算属性
    const allPrice = computed(() => obj.price * obj.num);

    // 检查初始计算属性的值
    expect(allPrice.value).toBe(1000);

    // 更改一个依赖项并检查计算属性是否更新
    obj.num = 20;
    expect(allPrice.value).toBe(2000);

    // 记录当前计算属性的值
    const cachedValue = allPrice.value;

    // 不更改任何依赖项
    // 再次访问计算属性，检查其值是否与缓存值相同
    expect(allPrice.value).toBe(cachedValue);
  });

  it("computed track and trigger", () => {
    const mockFn = vi.fn();
    // 创建响应式对象
    const obj = reactive({ price: 100, num: 10 });

    // 创建计算属性
    const allPrice = computed(() => obj.price * obj.num);

    effect(() => {
      mockFn()
      console.log(allPrice.value);
    })
    
    expect(mockFn).toHaveBeenCalledTimes(1);

    obj.num = 20;
    expect(allPrice.value).toBe(2000);
    expect(mockFn).toHaveBeenCalledTimes(2);
  });
});



