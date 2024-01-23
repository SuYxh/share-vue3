### 响应式系统

#### 已实现

- [x] 响应式数据以及副作用函数
- [x] 响应式系统MVP模型
- [x] 依赖收集
- [x] 派发更新
- [x] 依赖清理
- [x] 嵌套 effect
- [x] scheduler
- [x] computed
- [x] watch



#### 系列文章

- [实现vue3响应式系统核心-MVP模型](./实现vue3响应式系统核心-MVP模型.md)
- [实现vue3响应式系统核心-依赖清理](./实现vue3响应式系统核心-依赖清理.md)
- [实现vue3响应式系统核心-嵌套effect](./实现vue3响应式系统核心-嵌套effect.md)
- [实现vue3响应式系统核心-scheduler](./实现vue3响应式系统核心-scheduler.md)
- [实现vue3响应式系统核心-computed](./实现vue3响应式系统核心-computed.md)
- [实现vue3响应式系统核心-watch](./实现vue3响应式系统核心-watch.md)
- [实现vue3响应式系统核心-增强对象拦截](./实现vue3响应式系统核心-增强对象拦截.md)
- [实现vue3响应式系统核心-合理触发响应](./实现vue3响应式系统核心-合理触发响应.md)
- [实现vue3响应式系统核心-shallowReactive](./实现vue3响应式系统核心-shallowReactive.md)
- [实现vue3响应式系统核心-readonly&shallowReadonly](./实现vue3响应式系统核心-readonly&shallowReadonly.md)
- [实现vue3响应式系统核心-代理数组](./实现vue3响应式系统核心-代理数组.md)
- [实现vue3响应式系统核心-ref相关](./实现vue3响应式系统核心-ref相关.md)

#### 流程图

##### 响应式数据结构

![image-20240118223902472](https://qn.huat.xyz/mac/202401182239504.png)





##### 响应式系统 MVP 模型

![image-20240118223949999](https://qn.huat.xyz/mac/202401182239017.png)



##### 依赖清理

![image-20240118224016622](https://qn.huat.xyz/mac/202401182240651.png)

##### 嵌套 effect

![image-20240118224141690](https://qn.huat.xyz/mac/202401182241712.png)

##### scheduler

![image-20240118224210357](https://qn.huat.xyz/mac/202401182242379.png)

##### computed

![image-20240118224353017](https://qn.huat.xyz/mac/202401182243042.png)



##### watch

![image-20240118224413560](https://qn.huat.xyz/mac/202401182244587.png)





### 参考

1、《vuejs 设计与实现》霍春阳