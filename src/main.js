// 存储副作用函数的桶
const bucket = new Set();

// 原始数据
const data = { name: 'dahuang', age: 18 };

// 对原始数据的代理
const obj = new Proxy(data, {
  // 拦截读取操作
  get(target, key) {
    // 将 currentEffect 添加到存储副作用函数的桶中
    if (currentEffect) {
      bucket.add(currentEffect);
    }
    // 返回属性值
    return target[key];
  },
  // 拦截设置操作
  set(target, key, newVal) {
    target[key] = newVal;
    bucket.forEach(fn => fn());
    return true;
  }
});

// 当前激活的副作用函数
let currentEffect = null;

// 定义副作用函数
export function effect(fn) {
  // 设置当前激活的副作用函数
  currentEffect = fn;
  // 执行副作用函数
  fn();
  // 重置当前激活的副作用函数
  currentEffect = null;
}

effect(() => {
  console.log(obj.age);
})

// 1 秒后修改响应式数据
setTimeout(() => {
  obj.age = 23;

  setTimeout(() => {
    obj.address = 'beijing'
  }, 2000);
}, 1000);
