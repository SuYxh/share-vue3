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