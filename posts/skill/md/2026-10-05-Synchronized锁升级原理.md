---
title: Synchronized 锁升级原理与实战
date: 2026-10-05
category: Java 与 JVM
tags: [synchronized, 锁升级, Monitor, JDK 8]
languages: [Java]
excerpt: 结合 JDK 8 HotSpot 实现，理解 synchronized 的锁升级、锁膨胀和现代 JDK 的差异。
---

# Synchronized 锁升级原理与实战

> 本文重点以 **JDK 8 HotSpot** 的经典实现为主，解释 `synchronized` 的对象头、偏向锁、轻量级锁、重量级锁、锁撤销、锁膨胀、JVM 参数、Demo 与调优。
>
> **重要版本说明：** 偏向锁属于历史性的 HotSpot 优化机制。JDK 15 开始偏向锁默认禁用并弃用相关参数，JDK 18 的迁移文档已将其列为移除/弃用组件。因此，本文中“无锁 → 偏向锁 → 轻量级锁 → 重量级锁”的完整链路主要用于理解 JDK 8 等历史版本；现代 JDK 应重点关注轻量级快速路径、Monitor、锁膨胀以及 JIT 对同步代码的优化。

---

## 1. synchronized 到底是什么？

`synchronized` 是 Java 提供的内置同步机制，用来保证同一时刻只有符合规则的线程进入某段临界区，同时提供与监视器锁相关的内存语义。

最简单的代码：

```java
public void increment() {
    synchronized (this) {
        count++;
    }
}
```

从源码角度看，我们看到的是：

```text
synchronized
    ↓
monitorenter
    ↓
临界区
    ↓
monitorexit
```

从 HotSpot 实现角度看，真正复杂的是：

```text
Object
  ↓
Object Header
  ↓
Mark Word
  ↓
不同锁状态
  ├── 偏向锁（JDK 8 经典实现）
  ├── 轻量级锁
  └── 重量级锁 / Monitor
```

所以，学习 `synchronized` 不能只停留在“加锁、解锁”四个字，还需要理解：

- 对象头中的 Mark Word 保存了什么。
- 为什么可以利用 CAS 实现轻量级竞争。
- 为什么需要线程栈中的 Lock Record。
- 为什么竞争激烈时要进行锁膨胀（inflate）。
- 为什么重量级锁会和阻塞/唤醒联系起来。

---

# 2. 先建立整体认知：经典 JDK 8 锁升级模型

经典 JDK 8 HotSpot 的学习模型可以记成：

```text
                    synchronized
                         │
                         ▼
                       无锁
                         │
                         ▼
                      偏向锁
                         │
                  其他线程开始竞争
                         │
                         ▼
                    偏向锁撤销
                         │
                         ▼
                     轻量级锁
                         │
                     CAS + 自旋
                         │
                ┌────────┴────────┐
                │                 │
             很快释放          长时间竞争
                │                 │
                ▼                 ▼
             获取成功          锁膨胀
                                  │
                                  ▼
                             重量级锁
                                  │
                             ObjectMonitor
                                  │
                               阻塞/唤醒
```

这里有一个非常重要的认识：

> **“锁升级”不是 `synchronized` 的语法层面升级，而是 HotSpot 为了降低同步成本，在运行时对对象锁状态采用不同实现路径。**

而且这个图是**学习模型**，不能理解成任何情况下都必须严格、机械地依次经过每一个状态。

---

# 3. 对象头：理解锁升级的入口

## 3.1 Java 对象的大致结构

一个对象可以粗略理解成：

```text
┌───────────────────────────────┐
│        Object Header          │
│                               │
│       ┌───────────────┐       │
│       │   Mark Word   │       │
│       └───────────────┘       │
│                               │
│       Klass Pointer           │
├───────────────────────────────┤
│        Instance Data          │
├───────────────────────────────┤
│        Alignment              │
└───────────────────────────────┘
```

不同 JVM、位数、压缩指针配置都会影响具体布局，所以不要把某一个 64 位二进制字符串当成永远不变的标准答案。

真正和锁升级最相关的是：

```text
Mark Word
```

---

## 3.2 Mark Word 保存什么？

在经典 64 位 JDK 8 HotSpot 中，可以用下面这张表帮助理解：

| 对象状态 | Mark Word 重点内容（抽象理解） |
|---|---|
| 无锁 | identity hash、GC age 等信息 |
| 偏向锁 | 线程 ID、epoch、age、biased 标志等 |
| 轻量级锁 | 指向线程栈中 Lock Record 的信息 |
| 重量级锁 | 指向 ObjectMonitor 的信息 |
| GC 标记 | GC 使用的标记状态 |

锁状态位常被简化为：

```text
01  → 无锁/偏向相关状态
00  → 轻量级锁
10  → 重量级锁
11  → GC 标记
```

注意：偏向状态不能只看最后两位，还需要结合 biased 标志判断。

---

# 4. 什么是偏向锁？

## 4.1 为什么需要偏向锁？

假设：

```java
for (int i = 0; i < 1_000_000; i++) {
    synchronized (lock) {
        // 很少量工作
    }
}
```

而整个过程中几乎都是同一个线程：

```text
Thread-1
  │
  ├── lock
  ├── unlock
  ├── lock
  ├── unlock
  └── ...
```

这时候并不存在真正的多线程竞争。

如果每一次都走完整的竞争路径，就会产生不必要的同步成本。

偏向锁的设计思路就是：

> **既然长期以来基本只有同一个线程来获取这把锁，那么我把锁“偏向”这个线程。**

---

## 4.2 偏向锁的本质

可以简单理解为：

```text
obj
 ↓
Mark Word
 ↓
偏向 Thread-1
```

第一次 Thread-1 获取锁后，JVM 会在对象头中记录与线程相关的信息。

后续如果还是 Thread-1：

```text
当前线程 == Mark Word 中记录的线程
                    │
                    ▼
                  直接进入
```

目标是尽量减少无竞争场景下的同步开销。

---

# 5. 偏向锁第一次加锁过程

假设：

```java
Object lock = new Object();

synchronized (lock) {
    System.out.println("hello");
}
```

### 第一步：对象刚创建

```text
lock
 ↓
Mark Word
 ↓
处于可偏向/初始状态
```

### 第二步：Thread-1 第一次进入 synchronized

JVM 判断：

```text
对象是否允许偏向？
        ↓
       是
        ↓
当前有没有已经偏向其他线程？
        ↓
       没有
        ↓
记录当前线程
```

得到：

```text
lock
 ↓
Mark Word
 ├── biased = 1
 ├── thread = Thread-1
 └── 其他锁状态信息
```

### 第三步：Thread-1 再次进入

```text
当前线程       = Thread-1
对象偏向线程   = Thread-1

结果：继续复用偏向状态
```

这就是偏向锁最典型的低竞争优化。

---

# 6. Demo：观察偏向锁

推荐使用 JOL（Java Object Layout）观察对象头。

## 6.1 Maven 依赖

```xml
<dependency>
    <groupId>org.openjdk.jol</groupId>
    <artifactId>jol-core</artifactId>
    <version>0.17</version>
</dependency>
```

## 6.2 Java Demo

```java
import org.openjdk.jol.info.ClassLayout;

public class BiasedLockDemo {

    public static void main(String[] args) {
        Object lock = new Object();

        System.out.println("========== 创建对象 ==========");
        System.out.println(
                ClassLayout.parseInstance(lock).toPrintable()
        );

        synchronized (lock) {
            System.out.println("========== 第一次加锁 ==========");
            System.out.println(
                    ClassLayout.parseInstance(lock).toPrintable()
            );
        }

        System.out.println("========== 第一次解锁 ==========");
        System.out.println(
                ClassLayout.parseInstance(lock).toPrintable()
        );

        synchronized (lock) {
            System.out.println("========== 同一线程再次加锁 ==========");
            System.out.println(
                    ClassLayout.parseInstance(lock).toPrintable()
            );
        }
    }
}
```

---

# 7. 做偏向锁 Demo 时必须注意 JVM 启动延迟

这是很多教程最容易忽略的地方。

## 7.1 JDK 8 经典情况

经典 JDK 8 HotSpot 中，偏向锁默认开启，同时存在一个启动延迟：

```text
JVM 启动
   │
   ├── 启动后的前一小段时间：偏向锁尚未生效
   │
   └── 延迟结束后：开始正常使用偏向锁
```

常见 JDK 8 实现中的默认延迟是 **4000ms（4 秒）**。

因此做实验时，不建议依赖默认延迟，直接显式指定：

```bash
-XX:+UseBiasedLocking
-XX:BiasedLockingStartupDelay=0
```

这样可以避免“程序启动太快导致没看到偏向锁”的实验偏差。

> 注意：这里讨论的是 JDK 8 及其相关 HotSpot 实现。后续 JDK 已经调整了这个参数的默认行为，并最终移除了偏向锁机制。

---

# 8. 偏向锁撤销

## 8.1 为什么需要撤销？

最开始：

```text
obj
 ↓
偏向 Thread-1
```

然后 Thread-2 也过来了：

```text
Thread-1 ────────┐
                 │
                 ▼
                obj
                 ▲
                 │
Thread-2 ────────┘
```

JVM 发现：

```text
对象偏向线程 = Thread-1
当前线程     = Thread-2
```

于是原来的“单线程偏向”假设被打破。

这时候需要：

```text
偏向锁撤销（revoke）
```

---

## 8.2 撤销偏向锁时 JVM 要解决什么问题？

最关键的问题是：

> **Thread-1 当前到底还持不持有这把锁？**

不能简单理解成：

```text
biased = 0
```

就结束了。

JVM 需要结合对象头、线程执行状态、锁记录等信息安全地确定当前同步状态。

---

## 8.3 情况一：Thread-1 已经退出 synchronized

例如：

```java
synchronized (lock) {
    // Thread-1
}

// Thread-1 已经退出临界区
```

此时 Thread-2 过来：

```text
obj
 ↓
原来偏向 Thread-1
 ↓
检查发现 Thread-1 已经没有持有锁
 ↓
撤销偏向
 ↓
恢复到可竞争的普通状态
 ↓
Thread-2 继续获取
```

---

## 8.4 情况二：Thread-1 仍然持有锁

例如：

```java
synchronized (lock) {
    Thread.sleep(10_000);
}
```

此时：

```text
Thread-1
  │
  └── 持有 lock

Thread-2
  │
  └── 想获取 lock
```

此时不能直接让 Thread-2 抢走锁。

需要进一步进入更适合竞争的同步路径，经典模型下可以理解为：

```text
偏向锁
   ↓
撤销偏向
   ↓
轻量级锁/竞争路径
```

---

# 9. 为什么偏向锁撤销是比较重的操作？

经典 HotSpot 的偏向锁实现需要安全地检查线程与锁记录之间的关系，撤销过程涉及安全点等 JVM 机制。

所以偏向锁是一种“无竞争非常便宜、发生撤销时反而更复杂”的优化。

这也解释了它后来为什么被淘汰：现代应用中线程池、异步任务、ForkJoinPool、RPC 等场景越来越普遍，同一对象被不同线程访问的情况比早期假设更常见。

---

# 10. 偏向锁升级到轻量级锁

现在进入经典并发场景：

```text
Thread-1
   │
   └── 持有 lock

Thread-2
   │
   └── 同时尝试 lock
```

此时 JVM 希望先避免让 Thread-2 立刻阻塞。

于是使用轻量级锁的核心策略：

```text
CAS + 自旋
```

---

# 11. 什么是轻量级锁？

轻量级锁主要针对这样的场景：

```text
线程之间存在竞争

但是：

持锁线程很快就会释放
```

例如：

```text
Thread-1
   │
   ├── 获取锁
   ├── 执行少量代码
   └── 很快释放

Thread-2
   │
   └── 稍等一会儿即可获取
```

这时候直接阻塞/唤醒，可能反而不划算。

---

# 12. Lock Record 是什么？

轻量级锁的一个核心概念是线程栈中的：

```text
Lock Record
```

可以抽象理解成：

```text
Thread-1 Stack

┌──────────────────────┐
│      Lock Record     │
├──────────────────────┤
│   displaced header   │
└──────────────────────┘
```

其中 `displaced header` 可以理解为：

> **保存对象原来的 Mark Word。**

因为轻量级锁要修改对象头，所以先把原来的对象头信息保存到线程的锁记录中。

---

# 13. 轻量级锁加锁过程

可以拆成几个步骤。

## 第一步：创建 Lock Record

```text
Thread-1 Stack
      │
      ▼
Lock Record
      │
      └── 保存对象原 Mark Word
```

## 第二步：CAS 修改对象 Mark Word

目标是让对象头指向当前线程的 Lock Record：

```text
obj Mark Word
      │
      ▼
Thread-1 的 Lock Record
```

抽象成：

```java
CAS(
    obj.markWord,
    expectedOldMarkWord,
    lockRecordAddress
)
```

CAS 成功：

```text
Thread-1
   │
   ▼
成功获得轻量级锁
```

---

# 14. Thread-2 为什么会 CAS 失败？

Thread-2 也想获取同一个对象：

```text
Thread-2
   │
   ▼
创建 Lock Record
   │
   ▼
CAS
```

但是现在：

```text
obj Mark Word
      │
      ▼
Thread-1 Lock Record
```

因此 Thread-2 的 CAS 期望值已经不匹配：

```text
CAS
 ↓
失败
```

于是进入竞争处理。

---

# 15. 自旋是什么？

简单理解：

```text
CAS 失败
   ↓
不要马上阻塞
   ↓
先原地等待一会儿
   ↓
再次尝试
```

伪代码可以理解成：

```java
while (true) {
    if (tryLock()) {
        break;
    }

    // 自旋一小段时间
}
```

如果 Thread-1 很快释放：

```text
Thread-2
   │
   ├── CAS 失败
   ├── 自旋
   ├── CAS 失败
   └── CAS 成功
```

整个过程不需要让 Thread-2 立刻进入阻塞。

---

# 16. 为什么自旋不是越久越好？

自旋的代价是 CPU。

假设：

```java
synchronized (lock) {
    Thread.sleep(10_000);
}
```

Thread-2 如果自旋 10 秒：

```text
Thread-2
   │
   ├── CAS
   ├── CAS
   ├── CAS
   ├── CAS
   └── ...
```

它一直占着 CPU 做无效等待。

因此一个非常重要的原则是：

```text
等待时间短
    ↓
自旋更划算

等待时间长
    ↓
自旋不划算
    ↓
阻塞更划算
```

---

# 17. 轻量级锁升级到重量级锁

当竞争持续加剧：

```text
CAS 失败
   ↓
自旋
   ↓
仍未释放
   ↓
继续竞争
   ↓
自旋成本开始不划算
   ↓
锁膨胀（inflate）
   ↓
重量级锁
```

这里最重要的单词就是：

> **Inflation：锁膨胀。**

HotSpot 的 `ObjectSynchronizer::inflate()` 会处理把对象原有的锁状态转换为 `ObjectMonitor` 的过程；经典 HotSpot 源码可以看到它处理 `Stack-locked -> inflated`、`Neutral -> inflated` 等路径。

---

# 18. 什么是重量级锁？

重量级锁可以抽象为：

```text
Object
  │
  ▼
ObjectMonitor
  │
  ├── Owner
  ├── EntryList
  └── WaitSet
```

### Owner

当前持有 Monitor 的线程。

### EntryList

竞争 Monitor、等待进入的线程。

### WaitSet

调用：

```java
obj.wait();
```

之后进入等待集合的线程。

因此必须区分：

```text
BLOCKED
```

和：

```text
WAITING
```

它们的原因并不一样。

---

# 19. 为什么重量级锁比较“重”？

竞争失败的线程可能进入：

```text
RUNNABLE
   ↓
BLOCKED
```

等锁释放以后，再被唤醒并重新竞争：

```text
BLOCKED
   ↓
被唤醒
   ↓
重新竞争
```

与单纯的：

```text
CAS + 短时间自旋
```

相比，阻塞/唤醒涉及更复杂的线程调度与同步路径，因此通常成本更高。

---

# 20. Demo：制造锁竞争

下面的 Demo 用多个线程同时争抢同一个锁，并且故意增加临界区持有时间。

```java
import org.openjdk.jol.info.ClassLayout;

import java.util.concurrent.CountDownLatch;

public class HeavyweightLockDemo {

    private static final Object LOCK = new Object();

    public static void main(String[] args) throws Exception {

        int threadCount = 20;

        CountDownLatch start = new CountDownLatch(1);
        CountDownLatch ready = new CountDownLatch(threadCount);

        for (int i = 0; i < threadCount; i++) {

            Thread t = new Thread(() -> {

                ready.countDown();

                try {
                    start.await();
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                }

                synchronized (LOCK) {

                    System.out.println(
                            Thread.currentThread().getName()
                                    + " 获取锁"
                    );

                    try {
                        // 故意延长持锁时间
                        Thread.sleep(100);
                    } catch (InterruptedException e) {
                        Thread.currentThread().interrupt();
                    }

                    System.out.println(
                            ClassLayout.parseInstance(LOCK)
                                    .toPrintable()
                    );
                }
            }, "Thread-" + i);

            t.start();
        }

        // 等所有线程就绪
        ready.await();

        System.out.println("开始制造锁竞争");

        // 让所有线程尽可能同时竞争
        start.countDown();
    }
}
```

启动时，如果使用 JDK 8 并希望把实验重点放在历史锁模型上，可以：

```bash
java \
  -XX:+UseBiasedLocking \
  -XX:BiasedLockingStartupDelay=0 \
  -cp your.jar \
  HeavyweightLockDemo
```

然后另开窗口查看线程状态：

```bash
jstack <PID>
```

或者：

```bash
jcmd <PID> Thread.print
```

竞争激烈时，可能看到多个线程处于：

```text
java.lang.Thread.State: BLOCKED
```

> Demo 的目标是制造“高竞争”，不是保证某一行 JOL 输出永远精确出现某一个 bit。锁实现受 JDK 版本、CPU、线程调度、JIT 编译等因素影响，因此 Demo 应观察整体行为，而不是死记单次输出。

---

# 21. JOL、jstack、JFR 分别看什么？

理解锁问题时可以把这些工具分工理解。

| 工具 | 更适合观察什么 |
|---|---|
| JOL | 对象头、Mark Word、对象布局 |
| jstack | 线程状态、BLOCKED/WAITING 等 |
| jcmd Thread.print | 线程栈与线程状态 |
| JFR | 生产环境里的锁竞争、线程、CPU、延迟等综合事件 |
| async-profiler | CPU、锁等待等性能热点分析 |

不要指望一个工具解决所有问题。

比如：

```text
JOL
  → 对象头是什么状态

jstack
  → 哪些线程被卡住

JFR / profiler
  → 为什么线上会产生大量锁竞争
```

---

# 22. 锁升级到底是不是严格一级一级走？

不应该机械地理解成：

```text
无锁
 ↓
偏向
 ↓
轻量
 ↓
重量
```

这更像是一张非常适合学习的“经典模型图”。

实际 HotSpot 会根据对象当前状态、线程竞争方式以及具体同步操作走不同路径。

例如：

- `wait()` / `notify()` 会直接涉及 Monitor 相关机制。
- 对象 identity hash code 与偏向对象头之间存在特殊关系，可能导致偏向撤销/锁膨胀路径。
- JIT 还可能做锁消除、锁粗化等优化。

所以真正严谨的理解应该是：

> **锁升级是 HotSpot 为了同步性能而选择不同实现路径的抽象描述，而不是 Java 语言规范规定的固定状态机。**

---

# 23. identityHashCode 为什么和偏向锁有关？

Java 代码：

```java
System.identityHashCode(lock);
```

需要对象维持 identity hash code 信息，而偏向锁状态下对象头的可用 bit 布局受到限制。

因此经典 HotSpot 的处理过程中，如果对象处于偏向状态又需要保存 identity hash code，可能会触发偏向撤销并进一步走到 Monitor 相关路径。

这也是为什么有时候看到：

```text
“为什么我没多线程竞争，只调用 hashCode，锁状态却发生变化？”
```

原因并不是 `hashCode()` 天生“会加重量级锁”，而是它与对象头信息布局发生了关系。

---

# 24. JVM 调优：偏向锁相关参数

## 24.1 开启偏向锁（JDK 8）

```bash
-XX:+UseBiasedLocking
```

经典 JDK 8 中，该选项默认开启。

## 24.2 关闭偏向锁（JDK 8）

```bash
-XX:-UseBiasedLocking
```

## 24.3 关闭启动延迟

做实验时推荐：

```bash
-XX:BiasedLockingStartupDelay=0
```

这不是为了线上“神奇调优”，而是为了让实验结果更稳定、更容易复现。

## 24.4 偏向锁统计

JDK 8 实验环境可以尝试：

```bash
-XX:+UnlockDiagnosticVMOptions \
-XX:+PrintBiasedLockingStatistics
```

它更适合诊断/实验，不建议没有目的地在线上长期开启大量诊断输出。

---

# 25. 一个非常重要的版本区别

## JDK 8

可以重点学习完整经典链路：

```text
无锁
 ↓
偏向锁
 ↓
轻量级锁
 ↓
重量级锁
```

并可用于实验：

```bash
-XX:+UseBiasedLocking
-XX:BiasedLockingStartupDelay=0
```

## JDK 15

偏向锁被禁用并弃用。

## JDK 18+

偏向锁相关实现已经移除，不应该再用 JDK 8 的完整偏向锁模型解释现代 JVM。

因此：

> **面试问“偏向锁”时，可以用 JDK 8 模型回答；实际排查现代 JDK 性能问题时，不要假定偏向锁仍然存在。**

---

# 26. JVM 调优不能只靠调锁参数

这是实际工作里非常重要的一点。

如果发现：

```text
大量 synchronized
```

第一反应不应该是：

```bash
-XX:+UseBiasedLocking
```

或：

```bash
-XX:-UseBiasedLocking
```

正确思路更接近：

```text
业务压测
   ↓
发现 synchronized 是热点
   ↓
JFR / profiler / 线程栈
   ↓
确认是不是锁竞争
   ↓
分析锁持有时间
   ↓
分析锁粒度
   ↓
优化代码结构
   ↓
最后再考虑 JVM 参数
```

---

# 27. 真正有效的锁优化通常发生在业务代码层

例如：

```java
public synchronized void process() {
    queryDatabase();
    callRpc();
    calculate();
    updateSharedState();
}
```

问题在于：

```text
数据库查询
RPC
计算
```

可能都不需要在锁里执行。

更合理的思路可能是：

```java
public void process() {

    queryDatabase();

    callRpc();

    calculate();

    synchronized (lock) {
        updateSharedState();
    }
}
```

这样：

```text
锁持有时间
   ↓
缩短

竞争概率
   ↓
降低

Monitor / BLOCKED
   ↓
减少
```

这通常比“调一个 JVM 参数”更有实际价值。

---

# 28. 锁粗化与锁消除

在分析 `synchronized` 时，还需要理解 JIT 的两个重要优化。

## 28.1 锁消除（Lock Elimination）

如果 JIT 经过逃逸分析判断某对象不会被其他线程看到，那么某些同步可能根本不需要保留。

例如某些只在方法内部创建、不会逃逸的对象。

```java
public void test() {
    Object lock = new Object();

    synchronized (lock) {
        // 如果 lock 不可能被别的线程访问
    }
}
```

编译器在满足条件时可能消除没有实际意义的同步。

## 28.2 锁粗化（Lock Coarsening）

如果非常短的多个同步区域连续出现，JIT 在满足条件时可能合并它们，减少频繁加锁解锁的开销。

因此：

> **源码中“看到 synchronized 很多”，不等于机器最终执行时“每一个 synchronized 都原样存在”。**

---

# 29. 为什么性能测试建议用 JMH？

下面这种：

```java
long start = System.currentTimeMillis();

for (...) {
    synchronized (lock) {
    }
}

long end = System.currentTimeMillis();
```

非常容易受到：

- JIT 编译
- 预热不足
- 常量折叠
- 死代码消除
- GC
- 操作系统调度
- CPU 频率变化

等因素干扰。

如果要严肃比较：

```text
偏向锁 vs 非偏向
CAS vs Monitor
不同锁竞争程度
```

推荐使用 **JMH** 做基准测试。

---

# 30. 推荐的实验方案

## 实验 1：单线程、低竞争

目标：理解偏向锁历史优化。

JDK 8 参数：

```bash
-XX:+UseBiasedLocking
-XX:BiasedLockingStartupDelay=0
```

观察：

```text
JOL
```

---

## 实验 2：关闭偏向锁进行对照

```bash
-XX:-UseBiasedLocking
```

与实验 1 对比：

```text
对象头状态

以及

性能结果
```

注意不能只跑一次，要做预热和多次重复。

---

## 实验 3：两个线程短竞争

制造：

```text
Thread-1
持锁很短

Thread-2
很快拿到锁
```

观察：

```text
CAS
自旋
线程没有长期 BLOCKED
```

---

## 实验 4：多个线程高竞争

制造：

```text
20+ 线程
+
持锁时间较长
```

观察：

```text
jstack
 ↓
BLOCKED
```

同时结合 JFR 分析锁竞争事件。

---

# 31. 整个流程最终怎么记？

可以把它浓缩成下面四句话。

### 偏向锁

```text
一个线程反复使用
→ 记住线程
→ 尽量不做复杂竞争
```

### 轻量级锁

```text
存在竞争但很短
→ CAS
→ 自旋
→ 尽量不阻塞
```

### 重量级锁

```text
竞争持续较久
→ 锁膨胀
→ ObjectMonitor
→ 线程可能 BLOCKED
```

### JVM 调优

```text
先确认竞争
→ 再分析持锁时间/锁粒度
→ 代码优化优先
→ 参数调优最后
```

---

# 32. 一张完整的锁升级图

```text
                                 synchronized
                                      │
                                      ▼
                                Object Header
                                      │
                                      ▼
                                   Mark Word
                                      │
                       ┌──────────────┴──────────────┐
                       │                             │
                     无锁                         特殊状态
                       │
               第一个线程进入
                       │
                       ▼
               ┌────────────────┐
               │     偏向锁      │
               │                │
               │ Thread ID      │
               └───────┬────────┘
                       │
                其他线程开始竞争
                       │
                       ▼
                  偏向锁撤销
                       │
                       ▼
               ┌────────────────┐
               │    轻量级锁     │
               │                │
               │ Lock Record    │
               │      +         │
               │     CAS        │
               │      +         │
               │     自旋        │
               └───────┬────────┘
                       │
               竞争持续时间较长
                       │
                       ▼
                Lock Inflation
                       │
                       ▼
               ┌────────────────┐
               │    重量级锁     │
               │                │
               │ ObjectMonitor  │
               │      +         │
               │  阻塞/唤醒     │
               └───────┬────────┘
                       │
                       ▼
                 线程可能 BLOCKED
```

---

# 33. 小总结

问：

> **“synchronized 的锁升级过程是什么？”**

答：

> 在经典 JDK 8 HotSpot 实现中，`synchronized` 的锁状态主要与对象头 Mark Word 有关。为了适应不同程度的线程竞争，JVM 会采用不同的同步路径。
>
> 在几乎没有竞争、而且长期由同一个线程使用时，可以采用偏向锁，在对象头中记录偏向线程的信息，同一个线程再次进入时可以快速通过。
>
> 当其他线程开始竞争时，需要撤销偏向。如果竞争不激烈，可以使用轻量级锁，通过线程栈中的 Lock Record 保存原对象头，并通过 CAS 尝试把对象头与锁记录关联；竞争线程失败后先自旋等待。
>
> 如果竞争持续较久，自旋的 CPU 成本就开始不划算，锁会进一步发生膨胀（inflate），关联到 ObjectMonitor，竞争线程可能进入 BLOCKED 状态，形成重量级锁路径。
>
> 所以经典模型可以概括为：
>
> ```text
> 无锁 → 偏向锁 → 轻量级锁 → 重量级锁
>       Thread ID   Lock Record     ObjectMonitor
>                   CAS + 自旋      阻塞/唤醒
> ```
>
> 但是偏向锁已经在 JDK 15 被禁用并弃用，在 JDK 18 相关实现已经移除，所以这套完整模型主要用于理解 JDK 8 等历史 HotSpot。现代 JDK 更应该关注轻量级锁、Monitor、锁膨胀以及 JIT 对同步代码的优化。

---

# 34. 常见误区

## 误区 1：偏向锁一出现就一定会升级到重量级锁

错误。

偏向撤销之后可能只是回到普通/可竞争状态，也可能进入轻量级竞争，并不是一次竞争就直接进入重量级锁。

## 误区 2：轻量级锁就是“没有阻塞”

不严谨。

轻量级锁倾向于先采用 CAS 和自旋减少阻塞，但竞争持续较久时仍可能膨胀为重量级 Monitor。

## 误区 3：自旋时间越长越好

错误。

自旋需要消耗 CPU。只有锁很可能马上释放时，自旋才更划算。

## 误区 4：JOL 看到一次输出就是 JVM 永远的锁状态

错误。

线程调度、JIT、JDK 版本、对象状态都会影响实验结果。

## 误区 5：线上锁竞争问题优先靠 JVM 参数解决

通常不是。

先分析：

```text
锁粒度
锁持有时间
竞争线程数
业务临界区内容
```

再决定是否需要 JVM 参数层面的调整。

---

# 35. 源码阅读入口

如果继续深入 HotSpot 源码，推荐从下面几个入口开始：

```text
ObjectSynchronizer
    ↓
fast_enter / fast_exit
    ↓
轻量级锁快速路径
    ↓
inflate()
    ↓
ObjectMonitor
```

偏向锁相关可以重点看：

```text
BiasedLocking
```

经典 JDK 8 HotSpot 中，`ObjectSynchronizer::inflate()` 会明确处理对象从栈锁状态到 inflated Monitor 状态的转换，这是理解“轻量级 → 重量级”的重要源码入口。

---

# 36. 学习路线建议

推荐按照下面的顺序继续深入：

```text
第一层：Java 语法层
synchronized / monitorenter / monitorexit

        ↓

第二层：对象模型
Object Header / Mark Word

        ↓

第三层：经典锁优化
偏向锁 / Lock Record / CAS / 自旋

        ↓

第四层：重量级锁
ObjectMonitor / inflate / BLOCKED

        ↓

第五层：JIT
锁消除 / 锁粗化 / 逃逸分析

        ↓

第六层：线上性能
JFR / jstack / async-profiler / JMH
```

看到这里，你就不再只是“知道 synchronized 有锁升级”，而是能够清晰的明白：

```text
为什么要升级？
为什么 CAS？
为什么自旋？
为什么还要 Monitor？
什么时候会 BLOCKED？
为什么现代 JDK 去掉偏向锁？
线上怎么定位锁竞争？
```

---

# 37. 参考资料

1. Oracle Java SE 8 `java` 命令文档（`UseBiasedLocking` 等）：
   https://docs.oracle.com/javase/8/docs/technotes/tools/windows/java.html

2. Oracle JDK 15 Migration Guide：偏向锁禁用并弃用相关参数：
   https://docs.oracle.com/en/java/javase/15/migrate/

3. Oracle JDK 18 Migration Guide：偏向锁相关组件/选项变化：
   https://docs.oracle.com/en/java/javase/18/migrate/removed-tools-and-components.html

4. OpenJDK HotSpot 经典 `ObjectSynchronizer::inflate()` 源码：
   https://cr.openjdk.org/~apetushkov/jfr8/hotspot/src/share/vm/runtime/synchronizer.cpp-.html

5. OpenJDK HotSpot 偏向锁相关源码：
   https://cr.openjdk.org/~apetushkov/aarch32jdk9.0.4%2B12/hotspot/src/share/vm/runtime/biasedLocking.cpp-.html

---

# 38. 一句话总结

> **经典 JDK 8 的 synchronized 锁优化，本质上是在“无竞争、短竞争、强竞争”三类场景之间选择不同成本的实现：偏向锁记录线程，轻量级锁使用 Lock Record + CAS + 自旋，竞争激烈后通过 inflate 进入 ObjectMonitor 和阻塞/唤醒路径。真正的性能优化重点通常不是“盲目调锁参数”，而是减少锁粒度、缩短持锁时间、降低竞争，并结合 JFR、jstack、profiler 与 JMH 做验证。**
