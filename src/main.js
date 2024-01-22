// 存储副作用函数的桶
const bucket = new WeakMap();
// 当前激活的副作用函数
let activeEffect = null;
// effect 栈
const effectStack = [];

const ITERATE_KEY = "iterate-key";

const symbolRaw = Symbol("raw");

const TriggerType = {
  SET: "SET",
  ADD: "ADD",
  DEL: "DEL",
};

// 定义一个 Map 实例，存储原始对象到代理对象的映射
const reactiveMap = new Map();

const originMethod = Array.prototype.includes;
const arrayInstrumentations = {
  includes: function (...args) {
    // this 是代理对象，先在代理对象中查找，将结果存储到 res 中
    let res = originMethod.apply(this, args);

    if (res === false) {
      // res 为 false 说明没找到，通过 this.raw 拿到原始数组，再去其中查找并更新 res 值
      res = originMethod.apply(this[symbolRaw], args);
    }
    // 返回最终结果
    return res;
  },
};

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

// 定义副作用函数
export function effect(fn, options = {}) {
  // 定义一个封装了用户传入函数的副作用函数
  const effectFn = () => {
    // 将 fn 挂载到 effectFn 方便调试观看区分函数，没有实际作用
    effectFn.fn = fn;
    // 在执行用户传入的函数之前调用 cleanup
    cleanup(effectFn);
    // 当 effectFn 执行时，将其设置为当前激活的副作用函数
    activeEffect = effectFn;
    // 在调用副作用函数之前将当前副作用函数压入栈中
    effectStack.push(effectFn);
    // 执行用户传入的函数
    const res = fn();
    // 在当前副作用函数执行完毕后，将当前副作用函数弹出栈，并把 activeEffect 还原为之前的值
    effectStack.pop();
    activeEffect = effectStack[effectStack.length - 1];
    return res;
  };
  // 将 options 挂载到 effectFn 上
  effectFn.options = options;
  // effectFn.deps 用来存储所有与该副作用函数相关联的依赖集合
  effectFn.deps = [];
  // 只有非 lazy 的时候，才执行
  if (!options.lazy) {
    // 执行副作用函数
    effectFn();
  }

  // 将副作用函数作为返回值返回
  return effectFn;
}

export function track(target, key) {
  // 没有 activeEffect，直接返回
  if (!activeEffect) return;
  // 根据 target 从“桶”中取得 depsMap，它也是一个 Map 类型：key --> effects
  let depsMap = bucket.get(target);

  // 如果不存在 depsMap，那么新建一个 Map 并与 target 关联
  if (!depsMap) {
    bucket.set(target, (depsMap = new Map()));
  }

  // 再根据 key 从 depsMap 中取得 deps，它是一个 Set 类型，
  // 里面存储着所有与当前 key 相关联的副作用函数：effects
  let deps = depsMap.get(key);

  // 如果 deps 不存在，同样新建一个 Set 并与 key 关联
  if (!deps) {
    depsMap.set(key, (deps = new Set()));
  }

  // 最后将当前激活的副作用函数添加到“桶”里
  deps.add(activeEffect);
  // deps就是当前副作用函数存在联系的依赖集合
  // 将其添加到activeEffect.deps数组中
  activeEffect.deps.push(deps);
}

export function trigger(target, key, type, newVal) {
  // 获取与目标对象相关联的依赖映射
  const depsMap = bucket.get(target);
  // 如果没有依赖映射，则直接返回
  if (!depsMap) return;
  // 获取与特定属性键相关联的所有副作用函数
  const effects = depsMap.get(key);
  // 这行代码有问题
  // effects && effects.forEach((effectFn) => effectFn());

  const effectsToRun = new Set();

  effects &&
    effects.forEach((effectFn) => {
      // 如果 trigger 触发执行的副作用函数与当前正在执行的副作用函数相同，则不触发执行
      if (effectFn !== activeEffect) {
        // 新增
        effectsToRun.add(effectFn);
      }
    });

  // 只有当操作类型为 'ADD' 时，才触发与 ITERATE_KEY 相关联的副作用函数重新执行
  if (type === TriggerType.ADD || type === TriggerType.DEL) {
    // 取得与 ITERATE_KEY 相关联的副作用函数
    const iterateEffects = depsMap.get(ITERATE_KEY);
    // 将与 ITERATE_KEY 相关联的副作用函数也添加到 effectsToRun
    iterateEffects &&
      iterateEffects.forEach((effectFn) => {
        if (effectFn !== activeEffect) {
          effectsToRun.add(effectFn);
        }
      });
  }

  // 当操作类型为 ADD 并且目标对象是数组时，应该取出并执行那些与 length 属性相关联的副作用函数
  if (type === "ADD" && Array.isArray(target)) {
    // 取出与 length 相关联的副作用函数
    const lengthEffects = depsMap.get("length");
    // 将这些副作用函数添加到 effectsToRun 中，待执行
    lengthEffects &&
      lengthEffects.forEach((effectFn) => {
        if (effectFn !== activeEffect) {
          effectsToRun.add(effectFn);
        }
      });
  }

  // 如果操作目标是数组，并且修改了数组的 length 属性
  if (Array.isArray(target) && key === "length") {
    // 对于索引大于或等于新的 length 值的元素，
    // 需要把所有相关联的副作用函数取出并添加到 effectsToRun 中待执行
    depsMap.forEach((effects, key) => {
      if (key >= newVal) {
        effects.forEach((effectFn) => {
          if (effectFn !== activeEffect) {
            effectsToRun.add(effectFn);
          }
        });
      }
    });
  }

  // 遍历并执行所有相关的副作用函数
  effectsToRun.forEach((effectFn) => {
    if (effectFn.options.scheduler) {
      effectFn.options.scheduler(effectFn);
    } else {
      effectFn();
    }
  });
}

export function createReactive(target, isShallow = false, isReadonly = false) {
  return new Proxy(target, {
    // 拦截读取操作
    get(target, key, receiver) {
      // 代理对象可以通过 raw 属性访问原始数据
      if (key === symbolRaw) {
        return target;
      }

      // 如果操作的目标对象是数组，并且 key 存在于 arrayInstrumentations 上，
      // 那么返回定义在 arrayInstrumentations 上的值
      if (Array.isArray(target) && arrayInstrumentations.hasOwnProperty(key)) {
        return Reflect.get(arrayInstrumentations, key, receiver);
      }

      const res = Reflect.get(target, key, receiver);

      //  如果是浅响应，则直接返回原始值
      if (isShallow) {
        return res;
      }

      if (typeof res === "object" && res !== null) {
        return isReadonly ? readonly(res) : reactive(res);
      }

      // 将副作用函数 activeEffect 添加到存储副作用函数的桶中
      if (!isReadonly && typeof key !== "symbol") {
        track(target, key);
      }

      return res;
    },
    // 拦截设置操作
    set(target, key, newVal, receiver) {
      // 如果是只读的，则打印警告信息并返回
      if (isReadonly) {
        console.warn(`属性 ${key} 是只读的`);
        return true;
      }

      // 先获取旧值
      const oldVal = target[key];
      // 如果属性不存在，则说明是在添加新的属性，否则是设置已有属性
      const type = Array.isArray(target)
        ? // 如果代理目标是数组，则检测被设置的索引值是否小于数组长度，
          // 如果是，则视作 SET 操作，否则是 ADD 操作
          Number(key) < target.length
          ? TriggerType.SET
          : TriggerType.ADD
        : Object.prototype.hasOwnProperty.call(target, key)
        ? TriggerType.SET
        : TriggerType.ADD;

      // 设置属性值
      const res = Reflect.set(target, key, newVal, receiver);

      // target === receiver.raw 说明 receiver 就是 target 的代理对象
      if (target === receiver[symbolRaw]) {
        // 较新值与旧值，只有当它们不全等，并且不都是 NaN 的时候才触发响应
        if (oldVal !== newVal && (oldVal === oldVal || newVal === newVal)) {
          trigger(target, key, type, newVal);
        }
      }

      return res;
    },
    // 拦截 in 操作符
    has(target, key) {
      track(target, key);
      return Reflect.has(target, key);
    },
    // 拦截 for in 循环
    ownKeys(target) {
      // track(target, Array.isArray(target) ? 'length' : ITERATE_KEY);
      track(target, ITERATE_KEY);
      return Reflect.ownKeys(target);
    },
    // 拦截删除
    deleteProperty(target, key) {
      // 如果是只读的，则打印警告信息并返回
      if (isReadonly) {
        console.warn(`属性 ${key} 是只读的`);
        return true;
      }

      // 检查被操作的属性是否是对象自己的属性
      const hadKey = Object.prototype.hasOwnProperty.call(target, key);
      // 使用 Reflect.deleteProperty 完成属性的删除
      const res = Reflect.deleteProperty(target, key);

      if (res && hadKey) {
        // 只有当被删除的属性是对象自己的属性并且成功删除时，才触发更新
        trigger(target, key, TriggerType.DEL);
      }

      return res;
    },
  });
}

// 对原始数据的代理
export function reactive(target) {
  // 优先通过原始对象 target 寻找之前创建的代理对象，如果找到了，直接返回已有的代理对象
  const existionProxy = reactiveMap.get(target);
  if (existionProxy) return existionProxy;

  // 否则，创建新的代理对象
  const proxy = createReactive(target);
  // 存储到 Map 中，从而避免重复创建
  reactiveMap.set(target, proxy);

  return proxy;
}

export function shallowReactive(target) {
  return createReactive(target, true);
}

export function readonly(target) {
  return createReactive(target, false, true);
}

export function shallowReadonly(target) {
  return createReactive(target, true, true);
}
