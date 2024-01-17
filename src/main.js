// 存储副作用函数的桶
const bucket = new WeakMap();
// 当前激活的副作用函数
let activeEffect = null;

// 定义副作用函数
export function effect(fn) {
  // 设置当前激活的副作用函数
  activeEffect = fn;
  // 执行副作用函数
  fn();
  // 重置当前激活的副作用函数
  activeEffect = null;
}

function track(target, key) {
  // 没有 activeEffect，直接返回
  if (!activeEffect) return target[key];
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
}

function trigger(target, key) {
  // 根据 target 从桶中取得 depsMap，它是 key --> effects
  const depsMap = bucket.get(target);

  if (!depsMap) return;

  // 根据 key 取得所有副作用函数 effects
  const effects = depsMap.get(key);

  // 执行副作用函数
  effects && effects.forEach((fn) => fn());
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
