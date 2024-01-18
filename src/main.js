// 存储副作用函数的桶
const bucket = new WeakMap();
// 当前激活的副作用函数
let activeEffect = null;
// effect 栈
const effectStack = [];

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
  if (!activeEffect) return
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

export function trigger(target, key) {
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

  // 遍历并执行所有相关的副作用函数
  effectsToRun.forEach((effectFn) => {
    if (effectFn.options.scheduler) {
      effectFn.options.scheduler(effectFn);
    } else {
      effectFn();
    }
  });
}

// 对原始数据的代理
export function reactive(target) {
  return new Proxy(target, {
    // 拦截读取操作
    get(target, key, receiver) {
      const res = Reflect.get(target, key, receiver);
      // 依赖收集
      track(target, key);
      return res;
    },

    // 拦截设置操作
    set(target, key, newVal, receiver) {
      // 设置属性值
      const res = Reflect.set(target, key, newVal, receiver);
      // 派发更新
      trigger(target, key);
      return res;
    },
  });
}
