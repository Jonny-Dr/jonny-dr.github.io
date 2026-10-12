---
title: CompletableFuture 深度串讲
date: 2026-10-05
category: Java 与 JVM
tags: [CompletableFuture, 异步编程, 线程池, 并发编程]
languages: [Java]
excerpt: 从并发基础到任务编排、线程池隔离、异常处理和底层 Completion 机制，系统理解 CompletableFuture。
---

# CompletableFuture 深度串讲

> 本篇重点：**并发与并行的区别、Java 并发基础、CAS/AQS 与 CompletableFuture 的关系、CompletableFuture 核心 API、异步任务编排、自定义线程池、异常处理、超时以及部分底层实现原理。**
>
> 学习目标不是把 API 背下来，而是建立一条完整主线：
>
> **并发 → 同步控制 → CAS/AQS → 异步任务 → CompletableFuture → 任务编排 → 线程池隔离 → 底层 Completion 机制**

---

## 1. 先理解：什么是并发，什么是并行？

这是学习 `CompletableFuture` 之前最容易混淆、但又最重要的一组概念。

### 1.1 并发（Concurrency）

并发解决的是：

> **一段时间内，有多个任务需要推进，系统如何合理地交替执行这些任务。**

例如只有一个 CPU 核心，同时有三个任务：

```text
时间 →

线程A：████      ████
线程B：    ████      ███
线程C：        ████      ███
```

它们在时间上是交错推进的，看起来像“同时在做”，但某个时刻 CPU 可能实际上只执行其中一个。

所以：

> **并发强调的是“多个任务同时存在、交替推进”。**

Java 中常见的并发问题有：

- 多线程访问共享变量
- 线程安全
- 原子性
- 可见性
- 有序性
- 线程之间的同步与协作

这也是 `synchronized`、`volatile`、CAS、AQS、Lock 等技术主要解决的问题。

---

### 1.2 并行（Parallelism）

并行强调的是：

> **多个任务在同一时刻真正同时执行。**

比如有多个 CPU 核心：

```text
时间 →

CPU1：████████████
CPU2：████████████
CPU3：████████████
CPU4：████████████
```

多个任务可以同时占用不同核心：

```text
任务A → CPU1
任务B → CPU2
任务C → CPU3
任务D → CPU4
```

因此：

> **并行强调的是“真正同时执行”。**

---

### 1.3 并发和并行的区别

可以直接记成：

```text
并发：多个任务一起推进
并行：多个任务同时执行
```

一个很形象的例子：

```text
一个厨师 + 三道菜
    ↓
切菜 → 炒菜 → 装盘 → 再切下一道
    ↓
这是并发
```

而：

```text
三个厨师 + 三道菜
    ↓
三道菜同时制作
    ↓
这是并行
```

所以：

> **并行通常需要多个执行资源；并发即使只有一个 CPU 也可以成立。**

---

## 2. 为什么 Java 一直强调并发？

因为实际应用里，不可能只有一个任务。

例如一个接口请求到来以后，可能要：

```text
查询订单
查询用户
查询商品
查询库存
查询优惠券
调用推荐服务
```

这些任务之间存在不同关系：

### 串行依赖

```text
A → B → C
```

例如：

```text
查询用户 → 根据用户ID查询订单 → 根据订单计算优惠
```

### 相互独立

```text
    ┌→ B
A ──┼→ C
    └→ D
```

例如：

```text
查询商品
查询库存
查询推荐
```

彼此可以独立执行。

如果仍然全部串行，就会浪费大量等待时间。

这时候，**并发的组织能力**和**并行的执行能力**就需要结合起来。

---

## 3. Java 的第一条线：共享数据的并发安全

这一条线主要解决：

> **多个线程同时操作共享资源时，如何保证正确性。**

可以把它串起来理解：

```text
synchronized
    ↓
volatile
    ↓
CAS
    ↓
AQS
    ↓
ReentrantLock
    ↓
ReentrantReadWriteLock
    ↓
StampedLock
```

### 3.1 synchronized

解决的是：

> **互斥访问。**

多个线程同时进入临界区时，只允许一个线程执行。

```java
synchronized (lock) {
    count++;
}
```

---

### 3.2 volatile

主要解决：

> **可见性 + 一定程度的有序性。**

例如：

```java
private volatile boolean running = true;
```

一个线程修改：

```java
running = false;
```

其他线程可以及时观察到这个变化。

但是：

```java
count++;
```

并不是原子的，因此 `volatile` 不能替代锁或 CAS。

---

### 3.3 CAS

CAS 是很多高性能并发组件的基础。

它的思想是：

```text
我认为当前值是 A
如果内存里的值还是 A
    → 改成 B
否则
    → 失败并重试
```

例如逻辑上的：

```java
if (value == expected) {
    value = newValue;
}
```

真正执行时由原子 CPU 指令保证“比较 + 修改”的原子性。

这也是为什么你后面学习：

```text
ConcurrentHashMap
AtomicInteger
CompletableFuture
AQS
```

都会再次看到 CAS。

---

### 3.4 AQS

AQS（AbstractQueuedSynchronizer）可以理解成：

> **Java 并发同步器的基础框架。**

它主要解决：

```text
线程竞争
线程排队
线程阻塞
线程唤醒
同步状态管理
```

`ReentrantLock`、`CountDownLatch`、`Semaphore` 等都建立在类似的同步思想之上。

所以：

```text
CAS
    ↓
原子地修改状态

AQS
    ↓
进一步解决线程排队与阻塞
```

---

## 4. 第二条线：异步任务与并行执行

如果第一条线解决：

> “多个线程访问共享资源时怎么办？”

那么本篇重点的第二条线解决的是：

> **多个任务怎么异步执行、怎么串起来、怎么并起来、怎么处理结果。**

可以建立这条主线：

```text
Thread
   ↓
Executor
   ↓
Future
   ↓
CompletableFuture
   ↓
异步任务编排
```

其中：

- `Thread`：线程本身
- `Executor`：负责把任务交给执行资源
- `Future`：代表“未来可能拿到的结果”
- `CompletableFuture`：在 `Future` 的基础上进一步解决**异步任务之间的组合与编排**

---

## 5. Future 为什么不够？

先看传统 `Future`：

```java
ExecutorService executor = Executors.newFixedThreadPool(10);

Future<String> future = executor.submit(() -> {
    return "hello";
});

String result = future.get();
```

问题在于：

```java
future.get();
```

可能阻塞当前线程。

如果业务变成：

```text
A完成 → B
A完成 → C
B + C → D
```

使用传统 `Future` 会出现大量等待、嵌套和手动协调。

所以 `Future` 更像：

> **“我以后会有一个结果。”**

而 `CompletableFuture` 更进一步：

> **“我以后会有一个结果，而且结果出来以后可以继续触发下一步。”**

---

## 6. CompletableFuture 是什么？

可以把它简单理解成：

> **一个“未来会产生结果”的异步任务对象 + 一条后续任务链。**

例如：

```java
CompletableFuture<String> future =
        CompletableFuture.supplyAsync(() -> "hello");
```

此时可以脑补成：

```text
CompletableFuture<String>
        ↓
未来某个时刻得到 String
```

如果继续：

```java
future.thenApply(String::toUpperCase);
```

就变成：

```text
Future1
   ↓ 完成
Future2
   ↓ 完成
Future3
```

所以它最核心的价值不是“帮你创建线程”，而是：

> **把异步任务的依赖关系表达出来。**

---

## 7. 最基本的两个创建 API

### 7.1 runAsync：无返回值

```java
CompletableFuture<Void> future =
        CompletableFuture.runAsync(() -> {
            System.out.println("执行异步任务");
        });
```

适合：

```text
只关心任务执行，不关心返回值
```

---

### 7.2 supplyAsync：有返回值

```java
CompletableFuture<String> future =
        CompletableFuture.supplyAsync(() -> {
            return "hello";
        });
```

适合：

```text
异步执行 + 需要拿结果
```

可以简单记：

```text
runAsync     → Void
supplyAsync  → T
```

---

## 8. thenApply：拿到结果继续加工

```java
CompletableFuture<String> future =
        CompletableFuture
                .supplyAsync(() -> "hello")
                .thenApply(String::toUpperCase);
```

过程：

```text
"hello"
   ↓
"HELLO"
```

它表达的是：

```text
T → R
```

也就是：

> **拿到上一步结果，对结果做转换。**

---

## 9. thenAccept：消费结果

```java
CompletableFuture
        .supplyAsync(() -> "hello")
        .thenAccept(System.out::println);
```

它只消费结果，不再产生业务结果。

```text
T → Void
```

---

## 10. thenRun：只关心“完成了”

```java
CompletableFuture
        .supplyAsync(() -> "hello")
        .thenRun(() -> {
            System.out.println("任务完成");
        });
```

它既不关心上一个任务的结果，也不需要新的结果。

可以理解为：

```text
任务完成
   ↓
执行另一个动作
```

---

## 11. 最关键：thenApply 和 thenCompose

这是 `CompletableFuture` 中最容易混淆的一组 API。

假设：

```java
CompletableFuture<User> userFuture =
        CompletableFuture.supplyAsync(this::queryUser);
```

还有：

```java
CompletableFuture<List<Order>> queryOrders(User user) {
    // 异步查询订单
}
```

### 11.1 thenApply

```java
userFuture.thenApply(user -> queryOrders(user));
```

结果会变成：

```text
CompletableFuture<CompletableFuture<List<Order>>>
```

也就是：

```text
Future<User>
    ↓
Future<Future<List<Order>>>
```

产生了“异步套异步”。

---

### 11.2 thenCompose

```java
CompletableFuture<List<Order>> orderFuture =
        userFuture.thenCompose(this::queryOrders);
```

最终还是：

```text
CompletableFuture<List<Order>>
```

因此牢记：

```text
thenApply
    T → R

thenCompose
    T → CompletableFuture<R>
```

一句话记忆：

> **thenApply 是“加工结果”，thenCompose 是“继续下一个异步任务”。**

---

## 12. thenApply 和 thenApplyAsync

例如：

```java
future.thenApply(x -> process(x));
```

与：

```java
future.thenApplyAsync(x -> process(x));
```

最大的区别是：

```text
thenApply
    不强制把阶段重新提交到异步执行器

thenApplyAsync
    会把这个阶段提交给异步执行器执行
```

可以粗略理解为：

```text
thenApply：
完成Future的线程
      ↓
继续推进后续计算
```

```text
thenApplyAsync：
完成Future的线程
      ↓
提交Executor
      ↓
其他工作线程执行后续计算
```

### 为什么不能所有地方都用 Async？

因为 `Async` 不是“性能加速按钮”。

滥用会增加：

- 线程池任务提交
- 排队开销
- 线程切换
- 上下文切换
- 不必要的调度成本

所以：

> **是否使用 Async，应该根据执行边界和任务性质决定，而不是为了“看起来更异步”。**

---

## 13. CompletableFuture 最核心的能力：任务组合

实际项目一般不会只有一条链：

```text
A → B → C
```

更多的是：

```text
       ┌→ B ─┐
A ─────┤      ├→ D
       └→ C ─┘
```

也就是：

```text
先并发执行
再汇总结果
```

这正是 CompletableFuture 的核心价值。

---

## 14. thenCombine：两个异步结果合并

```java
CompletableFuture<User> userFuture =
        CompletableFuture.supplyAsync(this::queryUser);

CompletableFuture<Order> orderFuture =
        CompletableFuture.supplyAsync(this::queryOrder);

CompletableFuture<Result> resultFuture =
        userFuture.thenCombine(
                orderFuture,
                (user, order) -> buildResult(user, order)
        );
```

逻辑：

```text
User ──┐
       ├──→ Result
Order ─┘
```

也可以记成：

```text
A + B → C
```

---

## 15. allOf：等待多个任务全部完成

例如：

```java
CompletableFuture<User> userFuture = ...;
CompletableFuture<Order> orderFuture = ...;
CompletableFuture<Product> productFuture = ...;

CompletableFuture<Void> all =
        CompletableFuture.allOf(
                userFuture,
                orderFuture,
                productFuture
        );
```

它表达的是：

```text
User ──┐
Order ─┼──→ 全部完成
Product┘
```

注意：`allOf()` 的结果类型是：

```java
CompletableFuture<Void>
```

它本身主要负责告诉你：

> **这些任务是否已经全部完成。**

需要真正结果时，再拿各自 Future 的结果。

例如：

```java
CompletableFuture<Result> resultFuture =
        all.thenApply(v -> {
            User user = userFuture.join();
            Order order = orderFuture.join();
            Product product = productFuture.join();

            return buildResult(user, order, product);
        });
```

这里的 `join()` 放在 `all` 完成之后，相关 Future 已经完成，因此通常不会再经历前面的长时间等待。

---

## 16. anyOf：谁先完成用谁

```java
CompletableFuture<Object> result =
        CompletableFuture.anyOf(
                requestA(),
                requestB(),
                requestC()
        );
```

逻辑：

```text
A ─── 500ms
B ─── 100ms  ← 第一个完成
C ─── 300ms
          ↓
        使用B
```

所以：

```text
allOf → 全部完成
anyOf → 任意一个完成
```

这类能力适合：

- 多副本请求
- 多节点竞速
- 多机房兜底
- 允许“谁先返回就用谁”的场景

---

## 17. 异常处理：CompletableFuture 中异常去哪了？

同步代码：

```java
try {
    doSomething();
} catch (Exception e) {
    // 处理异常
}
```

异步代码则不一样。

例如：

```java
CompletableFuture<Integer> future =
        CompletableFuture.supplyAsync(() -> 10 / 0);
```

异常通常不会直接在提交任务的线程里抛出来，而是进入：

```text
CompletableFuture 的异常完成状态
```

因此应该在异步链中处理：

```java
future.exceptionally(ex -> {
    return 0;
});
```

---

## 18. exceptionally：异常兜底

```java
CompletableFuture<Integer> future =
        CompletableFuture
                .supplyAsync(() -> 10 / 0)
                .exceptionally(ex -> 0);
```

流程：

```text
任务
 ↓
异常
 ↓
exceptionally
 ↓
返回默认值
```

适合：

```text
失败 → 降级值
```

---

## 19. handle：成功失败都处理

```java
CompletableFuture<String> future =
        CompletableFuture
                .supplyAsync(() -> "hello")
                .handle((result, ex) -> {
                    if (ex != null) {
                        return "default";
                    }
                    return result.toUpperCase();
                });
```

它的特点是：

```text
成功 → 可以处理
失败 → 也可以处理
```

所以：

```text
exceptionally
    主要处理异常

handle
    成功、异常都处理，并可以产生新结果
```

---

## 20. whenComplete：监听结果，常用于日志和监控

```java
future.whenComplete((result, ex) -> {
    if (ex != null) {
        System.err.println("任务失败：" + ex.getMessage());
    }
});
```

更适合：

- 日志
- 埋点
- 监控
- 统计耗时
- 审计

它更像：

> **旁观者 / 完成监听器。**

---

## 21. get 和 join

两者都能获取结果：

```java
future.get();
future.join();
```

都可能阻塞。

区别可以简单记：

```text
get()
    需要处理受检异常

join()
    更偏向运行时异常封装
```

因此很多异步链内部会看到：

```java
future.join();
```

但必须记住：

> **join() 不是“永不阻塞”，Future 没完成时照样可能等待。**

---

## 22. CompletableFuture 为什么不能理解成“每一步都创建线程”？

这是学习时最容易产生的误解。

例如：

```java
CompletableFuture
        .supplyAsync(() -> "hello")
        .thenApply(String::toUpperCase)
        .thenApply(x -> x + "!");
```

不能简单理解为：

```text
线程1 → 线程2 → 线程3
```

更准确的理解是：

```text
异步任务
   ↓
Future完成
   ↓
触发后续Completion
   ↓
继续推进计算链
```

只有使用 `Async` 形式，才更明确地引入新的异步调度边界。

所以：

> **CompletableFuture 的核心是“任务编排”，不是“线程创建”。**

---

## 23. CompletableFuture 和线程池：到底是什么关系？

这两个概念一定要分开：

```text
CompletableFuture
    ↓
负责：任务如何连接、组合、传播结果

Executor / ThreadPool
    ↓
负责：任务由谁执行
```

例如：

```java
ExecutorService executor = ...;

CompletableFuture<User> future =
        CompletableFuture.supplyAsync(
                this::queryUser,
                executor
        );
```

这里：

```text
CompletableFuture = 编排层
Executor          = 执行层
```

---

## 24. 为什么不建议业务代码完全依赖默认线程池？

很多人第一次使用：

```java
CompletableFuture.supplyAsync(() -> query());
```

之后就不管线程池了。

这在简单 Demo 里没问题，但在生产环境需要特别谨慎。

默认异步执行器通常与 `ForkJoinPool.commonPool()` 有关，但具体行为应以当前 JDK 和运行环境为准。

真正需要关注的问题是：

> **你的业务任务，到底应该由哪个线程池执行？**

---

## 25. 默认线程池可能有什么问题？

### 25.1 线程池职责混杂

不同业务可能同时把任务丢进去：

```text
commonPool
├── 数据库查询
├── RPC调用
├── CPU计算
├── 文件操作
└── 其他异步任务
```

如果某一类任务大量阻塞，就可能影响其他任务。

---

### 25.2 阻塞任务占住线程

例如：

```java
CompletableFuture.supplyAsync(() -> {
    return jdbcQuery();
});
```

如果数据库查询很慢：

```text
线程
 ↓
执行SQL
 ↓
等待数据库
 ↓
线程一直被占用
```

如果线程池中的大量线程都在等待 I/O，就会出现：

```text
任务很多
   ↓
可用工作线程越来越少
   ↓
新任务排队
   ↓
延迟升高
```

---

### 25.3 无法针对业务进行隔离

假设：

```text
订单RPC突然变慢
```

如果订单、库存、推荐都共用同一个线程池：

```text
订单任务大量阻塞
        ↓
线程资源被占满
        ↓
库存、推荐也受到影响
```

这属于典型的：

> **资源相互污染。**

---

## 26. 为什么要使用自定义线程池？

自定义线程池最核心的意义不是：

> “我不喜欢默认线程池。”

而是：

> **让不同类型的任务拥有独立、可控、可监控的执行资源。**

比如：

```text
数据库查询 → dbExecutor
远程RPC     → rpcExecutor
CPU计算     → cpuExecutor
文件处理    → ioExecutor
```

这样某个业务出现波动时，不容易拖垮整个系统。

---

## 27. 示例：自定义线程池

```java
ThreadPoolExecutor rpcExecutor =
        new ThreadPoolExecutor(
                10,
                50,
                60,
                TimeUnit.SECONDS,
                new ArrayBlockingQueue<>(1000),
                new ThreadFactory() {
                    private final AtomicInteger index = new AtomicInteger();

                    @Override
                    public Thread newThread(Runnable r) {
                        return new Thread(
                                r,
                                "rpc-pool-" + index.incrementAndGet()
                        );
                    }
                },
                new ThreadPoolExecutor.CallerRunsPolicy()
        );
```

然后：

```java
CompletableFuture<User> future =
        CompletableFuture.supplyAsync(
                this::queryUser,
                rpcExecutor
        );
```

这样你就可以明确知道：

```text
这个异步任务 → rpc线程池
```

---

## 28. 自定义线程池到底要控制什么？

至少要关注这些东西：

```text
核心线程数
最大线程数
队列容量
线程存活时间
线程命名
拒绝策略
```

它们直接影响：

```text
吞吐量
延迟
资源消耗
突发流量下的稳定性
问题定位能力
```

例如线程名：

```text
rpc-pool-12
```

比：

```text
ForkJoinPool.commonPool-worker-5
```

更容易定位业务来源。

---

## 29. 线程池并不是越大越好

这是另一个常见误区。

如果线程池过大：

```text
线程过多
 ↓
上下文切换增加
 ↓
CPU资源竞争
 ↓
反而可能变慢
```

如果线程池过小：

```text
任务多
 ↓
线程不够
 ↓
排队变长
 ↓
延迟增加
```

所以线程池大小应该结合：

- CPU 核数
- 任务是 CPU 密集还是 I/O 密集
- 下游连接池容量
- 数据库承载能力
- RPC 超时
- 任务平均耗时
- 峰值流量

进行设计，而不是死记一个固定公式。

---

## 30. 一个典型场景：并行查询聚合

例如一个商品详情页需要：

```text
商品基础信息
库存
优惠券
推荐
```

这些任务彼此基本独立，可以并行发起：

```java
CompletableFuture<Product> productFuture =
        CompletableFuture.supplyAsync(
                this::queryProduct,
                productExecutor
        );

CompletableFuture<Stock> stockFuture =
        CompletableFuture.supplyAsync(
                this::queryStock,
                stockExecutor
        );

CompletableFuture<Coupon> couponFuture =
        CompletableFuture.supplyAsync(
                this::queryCoupon,
                couponExecutor
        );

CompletableFuture<Recommend> recommendFuture =
        CompletableFuture.supplyAsync(
                this::queryRecommend,
                recommendExecutor
        );
```

再聚合：

```java
CompletableFuture<DetailResponse> resultFuture =
        CompletableFuture
                .allOf(
                        productFuture,
                        stockFuture,
                        couponFuture,
                        recommendFuture
                )
                .thenApply(v -> {
                    Product product = productFuture.join();
                    Stock stock = stockFuture.join();
                    Coupon coupon = couponFuture.join();
                    Recommend recommend = recommendFuture.join();

                    return new DetailResponse(
                            product,
                            stock,
                            coupon,
                            recommend
                    );
                });
```

整体结构：

```text
                         ┌→ 商品
                         │
请求 → 异步并发发起 ─────┼→ 库存
                         │
                         ├→ 优惠券
                         │
                         └→ 推荐
                              ↓
                            allOf
                              ↓
                            聚合
                              ↓
                           返回结果
```

---

## 31. 为什么并行能降低整体耗时？

假设：

```text
商品：100ms
库存：100ms
优惠券：100ms
推荐：100ms
```

串行：

```text
100 + 100 + 100 + 100 = 400ms
```

并行发起后，理论上更接近：

```text
max(100, 100, 100, 100) = 100ms
```

实际还要加上：

```text
线程调度
网络传输
连接池等待
序列化
线程池排队
CPU开销
```

所以真实耗时一般不会严格等于 `100ms`。

但核心思想不变：

> **把原本可以互不等待的任务并行起来。**

---

## 32. 一个非常重要的前提：不要为了并行而并行

如果任务关系是：

```text
A → B → C → D
```

那么它们本身存在依赖关系。

即使都写成 `CompletableFuture`：

```text
也不能凭空消除依赖
```

所以：

> **真正的并行优化，首先来自任务依赖关系分析，而不是 API 写得多复杂。**

---

## 33. CompletableFuture 的底层核心：Result + Completion

如果开始看源码，不要一开始就钻进大量内部类。

先抓住两个最重要的概念：

```text
CompletableFuture
├── Result
└── Completion
```

### Result

表示：

```text
当前 Future 到底完成没有？
```

可以抽象理解为：

```text
未完成
   ↓
完成
   ├── 正常结果
   ├── 异常结果
   └── 取消
```

### Completion

表示：

> **当当前 Future 完成以后，接下来要做什么。**

比如：

```java
future.thenApply(x -> x + 1);
```

可以脑补为：

```text
Future
  ↓
挂一个 Completion
  ↓
Future 完成
  ↓
执行 Completion
  ↓
产生下一个 Future
```

---

## 34. 为什么 CompletableFuture 底层又能看到 CAS？

因为一个 Future 的完成状态不能被多个线程随意覆盖。

假设两个线程同时调用：

```java
future.complete("A");
future.complete("B");
```

必须保证只有一个线程能成功把它从：

```text
未完成
```

推进到：

```text
已完成
```

所以会使用原子状态更新思路：

```text
未完成
   ↓ CAS
已完成
```

第一个成功修改状态的线程获胜，后来的完成动作不会重新覆盖已经完成的结果。

这也是前面学过 CAS 后，再看 CompletableFuture 时非常值得关注的地方。

---

## 35. Completion Chain：真正的“链式异步”是怎么来的？

例如：

```java
future
    .thenApply(A)
    .thenApply(B)
    .thenApply(C);
```

逻辑上可以理解为：

```text
Future1
   ↓
Completion A
   ↓
Future2
   ↓
Completion B
   ↓
Future3
   ↓
Completion C
   ↓
Future4
```

所以：

> `thenApply()` 并不是简单地“把一个 Lambda 存起来”，而是在构建一个异步完成链。

---

## 36. Completion 是什么时候执行的？

当上一个 Future 完成时，就会开始推进后续 Completion。

可以粗略理解为：

```text
线程A
  ↓
完成 Future1
  ↓
发现后面挂了 Completion
  ↓
执行 / 推进 Completion
  ↓
完成 Future2
  ↓
继续推进下一层
```

而如果使用：

```java
thenApplyAsync(...)
```

则更明确地进入：

```text
完成 Future
   ↓
提交 Executor
   ↓
线程池工作线程执行下一阶段
```

---

## 37. CompletableFuture 的异常也是“状态”

可以把**正常结果**和**异常结果**都理解为一种完成状态。

所以：

```text
Future
  ↓
正常完成 / 异常完成 / 取消
  ↓
继续传播
```

于是就有了这些异常相关的 API。

```text
exceptionally
handle
whenComplete
```

这也是为什么 `CompletableFuture` 的异常可以沿着 Completion Chain 向后传播。

---

## 38. 超时处理

可以使用：

```java
future.orTimeout(2, TimeUnit.SECONDS);
```

超时后可以把 Future 置于异常完成状态。

也可以使用：

```java
future.completeOnTimeout(
        "default",
        2,
        TimeUnit.SECONDS
);
```

区别：

```text
orTimeout
    超时 → 异常

completeOnTimeout
    超时 → 默认值
```

很适合：

```text
远程调用超时
   ↓
快速失败 / 降级
```

---

## 39. CompletableFuture 和回调地狱

传统回调可能写成：

```java
queryUser(user -> {
    queryOrder(user, order -> {
        queryCoupon(order, coupon -> {
            // 继续嵌套
        });
    });
});
```

很容易形成：

```text
Callback Hell
```

而 CompletableFuture 更容易写成：

```java
queryUser()
        .thenCompose(this::queryOrder)
        .thenCompose(this::queryCoupon)
        .thenApply(this::buildResult);
```

所以它可以显著改善：

> **异步流程的可读性和可组合性。**

---

## 40. 一组非常容易记忆的 API 口诀

```text
runAsync
    → 异步执行，无结果

supplyAsync
    → 异步执行，有结果

thenApply
    → 拿结果加工

thenCompose
    → 继续执行异步任务

thenAccept
    → 消费结果

thenRun
    → 只关心完成

thenCombine
    → 两个结果合并

allOf
    → 全部完成

anyOf
    → 任意一个完成

exceptionally
    → 异常兜底

handle
    → 成功失败都处理

whenComplete
    → 完成监听

orTimeout
    → 超时转异常

completeOnTimeout
    → 超时给默认值
```

---

## 41. 最容易出现的几个问题

### 问题1：到处 join()

```java
User user = userFuture.join();
Order order = orderFuture.join();
Product product = productFuture.join();
```

这样虽然用了 CompletableFuture，但仍然可能形成大量同步等待。

应该优先考虑：

```text
thenCombine
allOf
thenCompose
```

去表达任务关系。

---

### 问题2：所有地方都用 Async

```java
thenApplyAsync(...)
thenApplyAsync(...)
thenApplyAsync(...)
```

可能只是增加调度成本，并不会自动提高性能。

---

### 问题3：I/O 任务全部放到同一公共线程池

大量：

```text
数据库
RPC
网络
文件
```

都阻塞等待，会放大线程池资源争用问题。

---

### 问题4：异常没人处理

异步任务失败后，如果没有：

```text
exceptionally
handle
whenComplete
get/join
```

进行合理观察与处理，问题可能被隐藏在异步链里。

---

### 问题5：以为 CompletableFuture = 不阻塞

错。

```java
join()
get()
```

都可能阻塞。

CompletableFuture 真正带来的价值是：

> **让等待关系尽可能被“任务完成回调”表达，而不是让当前线程傻等。**

---

## 42. 最终形成一张完整知识图

```text
Java 并发
│
├── 一、共享资源安全
│     │
│     ├── synchronized
│     ├── volatile
│     ├── CAS
│     ├── AQS
│     ├── ReentrantLock
│     ├── ReentrantReadWriteLock
│     └── StampedLock
│
└── 二、异步任务协作
      │
      ├── Thread
      ├── Executor
      ├── Future
      └── CompletableFuture
            │
            ├── supplyAsync / runAsync
            ├── thenApply / thenCompose
            ├── thenCombine
            ├── allOf / anyOf
            ├── exceptionally / handle
            ├── timeout
            └── Completion Chain
                  │
                  ├── Result
                  ├── CAS
                  ├── Completion
                  └── Executor
```

---

## 43. 最后用一句话彻底理解 CompletableFuture

如果前面的内容只保留一句话：

> **CompletableFuture 不是“创建更多线程”的工具，而是“把多个异步任务之间的依赖关系、执行关系、结果关系和异常关系组织起来”的工具。**

再进一步理解：

```text
并发
    → 多个任务一起推进

并行
    → 多个任务真正同时执行

CAS / AQS
    → 解决多个线程如何安全协作

线程池
    → 决定任务交给谁执行

CompletableFuture
    → 决定异步任务之间如何编排和组合
```

最终把它们放在一起：

```text
                 Java 并发体系
                      │
          ┌───────────┴───────────┐
          ↓                       ↓
    共享数据安全               异步任务协作
          │                       │
   synchronized               Executor
   volatile                       ↓
      CAS                       Future
      AQS                         ↓
      Lock               CompletableFuture
          │                       │
          └───────────┬───────────┘
                      ↓
                 完整并发系统
```

这也是学习 JUC 时非常重要的一条主线：

> **同步原语解决“线程安全”，异步编排解决“任务协作”，线程池负责“任务执行”，而 CompletableFuture 把这些执行单元组织成一张可组合的异步计算图。**

---

## 44. 推荐的学习顺序

结合这套知识体系，推荐按下面的顺序继续深入：

```text
1. synchronized
2. volatile
3. CAS
4. AQS
5. ReentrantLock
6. ReentrantReadWriteLock
7. StampedLock
8. Executor / ThreadPoolExecutor
9. Future
10. CompletableFuture
11. CompletableFuture 源码
12. 并发容器 / 原子类
13. ForkJoinPool
14. 虚拟线程与现代并发模型
```

其中 `CompletableFuture` 源码重点建议关注：

```text
result
Completion
UniCompletion
BiCompletion
postComplete
CAS
Executor
```

把这些吃透以后，再回头看 `thenApply`、`thenCompose`、`allOf`、`anyOf` 等 API，就不会再停留在“会调用”的层面，而是能够理解它们为什么这样设计、为什么这样执行。
