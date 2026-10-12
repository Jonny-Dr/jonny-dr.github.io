---
title: LongAdder 核心原理
date: 2026-10-05
category: Java 与 JVM
tags: [LongAdder, Striped64, CAS, 高并发]
languages: [Java]
excerpt: 解析 LongAdder 和 Striped64 的分段累加思想，以及它在高并发计数场景中的取舍。
---

# LongAdder 核心原理

> 目标：用尽量简单的语言理解 LongAdder，但不跳过底层关键细节。
>
> 本文以 **JDK 8 中 LongAdder / Striped64 的经典实现思路**为主进行讲解。不同 JDK 版本的源码在字段、内部实现细节上可能存在差异，但核心思想基本一致。

---

# 1. LongAdder 是干什么的？

先看一个最简单的问题：

假设有 100 个线程同时执行：

```java
counter++;
```

如果使用普通的：

```java
private long counter;
```

就会发生线程安全问题。

因此我们可能想到：

```java
AtomicLong counter = new AtomicLong();

counter.incrementAndGet();
```

`AtomicLong` 是线程安全的，因为底层使用 CAS。

但是，高并发下又出现了一个问题：

> 所有线程都在竞争同一个变量。

例如：

```text
Thread-1 ─┐
Thread-2 ─┤
Thread-3 ─┤
Thread-4 ─┼──> AtomicLong.value
Thread-5 ─┤
Thread-6 ─┘
```

虽然 CAS 不需要加锁，但是竞争非常激烈。

线程可能经历：

```text
读取 value = 100

Thread A：CAS(100 -> 101) 成功
Thread B：CAS(100 -> 101) 失败
Thread C：CAS(100 -> 101) 失败
Thread D：CAS(100 -> 101) 失败
```

失败的线程需要重新读取、再次 CAS。

线程越多，竞争越激烈。

---

# 2. LongAdder 的核心思想

LongAdder 的核心思想可以概括成一句话：

> **不要让所有线程竞争一个变量，把一个热点变量拆成多个变量。**
>
> **思想：分治 + 汇总**

原来的 AtomicLong：

```text
             value
               ↑
        ┌──────┼──────┐
        ↓      ↓      ↓
      Thread Thread Thread
```

LongAdder：

```text
                LongAdder
                    │
          ┌─────────┴─────────┐
          ↓                   ↓
        base                 cells
                              │
                   ┌──────────┼──────────┐
                   ↓          ↓          ↓
                 cell0      cell1      cell2
                   ↑          ↑          ↑
                Thread A   Thread B   Thread C
```

最终结果：

```text
sum = base + cell0 + cell1 + cell2 + ...
```

因此，LongAdder 的核心就是：

> **分散热点，降低 CAS 竞争。**

这也是原文所说的“分段 CAS / 分治思想”。

---

# 3. LongAdder 的基本使用

最简单的使用方式：

```java
import java.util.concurrent.atomic.LongAdder;

public class LongAdderDemo {

    public static void main(String[] args) {
        LongAdder counter = new LongAdder();

        counter.increment();
        counter.increment();
        counter.add(10);

        System.out.println(counter.sum());
    }
}
```

输出：

```text
12
```

其中：

```java
counter.increment();
```

本质上相当于：

```java
counter.add(1);
```

---

# 4. 为什么 AtomicLong 不够？

先写一个 AtomicLong Demo：

```java
import java.util.concurrent.atomic.AtomicLong;

public class AtomicLongDemo {

    private static final AtomicLong counter = new AtomicLong();

    public static void main(String[] args) throws Exception {

        int threadCount = 10;
        int loopCount = 100_000;

        Thread[] threads = new Thread[threadCount];

        for (int i = 0; i < threadCount; i++) {
            threads[i] = new Thread(() -> {
                for (int j = 0; j < loopCount; j++) {
                    counter.incrementAndGet();
                }
            });
        }

        for (Thread thread : threads) {
            thread.start();
        }

        for (Thread thread : threads) {
            thread.join();
        }

        System.out.println(counter.get());
    }
}
```

理论结果：

```text
1000000
```

结果是准确的。

但是问题在于：

```text
10 个线程
     ↓
同一个 AtomicLong
     ↓
同一个 value
     ↓
CAS 激烈竞争
```

如果线程数量继续增加，热点会越来越集中。

---

# 5. LongAdder 是怎么解决竞争的？

LongAdder 并不是简单地：

```text
所有线程 → 一个变量
```

而是：

```text
                 LongAdder
                     │
           ┌─────────┴─────────┐
           │                   │
          base              Cell[]
                               │
              ┌────────────────┼────────────────┐
              ↓                ↓                ↓
            cell0            cell1            cell2
```

不同线程尽量落到不同的 Cell 上。

例如：

```text
Thread A → cell0
Thread B → cell1
Thread C → cell2
Thread D → cell3
```

那么：

```text
Thread A 竞争 cell0
Thread B 竞争 cell1
Thread C 竞争 cell2
Thread D 竞争 cell3
```

竞争被分散了。

---

# 6. LongAdder 的核心继承关系

LongAdder 本身的实现并不复杂，真正复杂的代码主要在它的父类：

```text
LongAdder
    ↓
Striped64
    ↓
Cell[]
```

可以简单理解为：

```text
LongAdder
    │
    ├── add()
    ├── increment()
    ├── sum()
    └── reset()

Striped64
    │
    ├── base
    ├── cells
    ├── cellsBusy
    └── longAccumulate()

Cell
    │
    └── value
```

所以：

> **学习 LongAdder，本质上是在学习 Striped64。**

---

# 7. LongAdder 的核心字段

JDK 经典实现中，核心结构可以简化理解为：

```java
public class Striped64 extends Number {

    transient volatile Cell[] cells;

    transient volatile long base;

    transient volatile int cellsBusy;

    static final class Cell {
        volatile long value;
    }
}
```

三个关键变量：

```text
base
cells
cellsBusy
```

分别负责不同事情。

---

## 7.1 base

`base` 是一个基础计数器。

在低并发情况下：

```text
LongAdder
    ↓
base
```

甚至可以不创建 `cells`。

例如：

```text
base = 100
cells = null
```

此时 LongAdder 就非常简单。

---

## 7.2 cells

`cells` 是核心。

它本质上是：

```java
Cell[]
```

例如：

```text
cells
  ↓
┌────────┬────────┬────────┬────────┐
│ cell0  │ cell1  │ cell2  │ cell3  │
└────────┴────────┴────────┴────────┘
```

每个 Cell 保存一部分计数。

最终：

```text
sum = base
    + cell0.value
    + cell1.value
    + cell2.value
    + cell3.value
```

---

## 7.3 cellsBusy

`cellsBusy` 并不是计数器。

它主要用于：

> **控制 Cell 数组初始化和扩容过程。**

可以把它简单理解成一个非常轻量的自旋锁标志。

经典源码中类似：

```java
if (cellsBusy == 0 &&
    casCellsBusy()) {

    // 初始化或者扩容 cells
}
```

这里的 CAS 保证：

> 同一时间只有一个线程负责初始化/扩容 Cell 数组。

---

# 8. Cell 为什么要单独设计？

Cell 可以简单理解成：

```java
static final class Cell {

    volatile long value;

    Cell(long x) {
        value = x;
    }

    final boolean cas(long cmp, long val) {
        return VALUE.compareAndSet(this, cmp, val);
    }
}
```

也就是说：

```text
Cell
 └── value
```

本身也是通过 CAS 更新。

例如：

```java
cell.cas(100, 101);
```

表示：

```text
如果当前 value == 100
那么更新为 101
```

否则失败。

---

# 9. 为什么 LongAdder 不一开始就创建 cells？

这是一个非常重要的问题。

如果程序只有一个线程：

```text
Thread A
   ↓
LongAdder
   ↓
base
```

根本没有竞争。

此时如果一开始就创建：

```text
Cell[]
```

反而增加了对象创建、数组初始化等额外成本。

所以 LongAdder 采用一种非常典型的思想：

> **低并发时走简单路径，高并发时才逐渐扩展。**

也就是：

```text
低并发
   ↓
base

发生竞争
   ↓
创建 cells

竞争继续
   ↓
扩容 cells
```

这也是 LongAdder 的性能关键之一。

---

# 10. add() 的核心执行流程

调用：

```java
adder.add(1);
```

并不是直接：

```java
base++;
```

而是大致经过下面的逻辑：

```text
add(1)
  │
  ↓
cells 是否已经存在？
  │
  ├── 否 ──> 尝试 CAS 修改 base
  │
  │          ├── 成功 → 结束
  │          │
  │          └── 失败 → 发生竞争
  │
  └── 是 ──> 根据线程 probe 找到 cell
                 │
                 ├── cell 存在 + CAS 成功 → 结束
                 │
                 └── CAS 失败
                         ↓
                    继续处理竞争
                         ↓
                     初始化/扩容/重新定位
```

---

# 11. 第一次：直接更新 base

最开始：

```text
cells = null
base = 0
```

线程执行：

```java
adder.add(1);
```

可以理解成：

```java
CAS(base, 0, 1)
```

成功：

```text
base = 1
```

再次执行：

```java
adder.add(1);
```

变成：

```text
base = 2
```

这时候完全不需要 Cell。

---

# 12. 第二次：base 发生 CAS 竞争

假设两个线程同时执行：

```java
adder.add(1);
```

此时：

```text
base = 100
```

两个线程同时读取：

```text
Thread A：看到 100
Thread B：看到 100
```

然后：

```text
Thread A：CAS(100 -> 101)
Thread B：CAS(100 -> 101)
```

只能有一个成功。

例如：

```text
Thread A：成功

base = 101

Thread B：失败
```

这时候 LongAdder 会认为：

> 当前出现了竞争。

于是开始考虑使用 `cells`。

---

# 13. cells 初始化

经典实现中，第一次创建 Cell 数组时通常是：

```text
cells.length = 2
```

例如：

```text
cells
 ↓
┌────────┬────────┐
│ cell0  │ cell1  │
└────────┴────────┘
```

然后不同线程通过自己的 probe 选择不同位置。

例如：

```text
Thread A → cell0
Thread B → cell1
```

于是：

```text
Thread A CAS cell0
Thread B CAS cell1
```

两个线程就不再竞争同一个变量。

---

# 14. 一个非常重要的纠正：不是直接使用线程 ID

很多资料会简单说：

> LongAdder 根据线程 ID 找 Cell。

这个说法不够准确。

经典 Striped64 实现使用的是：

```java
ThreadLocalRandom.getProbe()
```

获取线程的 probe 值。

概念上可以理解成：

```text
Thread
  ↓
probe
  ↓
hash
  ↓
cells[index]
```

所以更准确的表述应该是：

> **LongAdder 使用线程的 probe 值进行哈希定位，而不是简单直接使用 Thread.getId()。**

这是理解源码时非常重要的细节。

---

# 15. probe 是什么？

可以把 probe 简单理解成：

> **线程用于竞争分散和哈希定位的一个伪随机探针值。**

例如：

```text
Thread A
probe = 123456

Thread B
probe = 987654

Thread C
probe = 456789
```

然后通过类似：

```java
index = (n - 1) & probe;
```

计算数组下标。

例如：

```text
cells.length = 4

n - 1 = 3

index = 3 & probe
```

因为数组长度通常是 2 的幂，所以使用位运算非常高效。

---

# 16. 为什么数组长度必须是 2 的幂？

例如：

```text
2
4
8
16
32
...
```

这样就可以使用：

```java
(n - 1) & hash
```

代替：

```java
hash % n
```

例如：

```text
n = 8

n - 1 = 7

index = hash & 7
```

得到：

```text
0 ~ 7
```

的数组下标。

这也是 Java 并发源码里非常常见的性能优化。

---

# 17. Cell 竞争怎么办？

假设：

```text
cells.length = 2
```

但是：

```text
Thread A → cell0
Thread B → cell0
Thread C → cell0
Thread D → cell0
```

那么即使有 Cell，仍然可能竞争。

例如：

```text
Thread A ─┐
Thread B ─┤
Thread C ─┼──> cell0
Thread D ─┘
```

这时 LongAdder 会尝试：

```text
扩容
```

---

# 18. cells 扩容

例如：

```text
第一次：

length = 2
```

竞争严重：

```text
length = 4
```

继续竞争：

```text
length = 8
```

继续：

```text
length = 16
```

也就是：

```text
2
 ↓
4
 ↓
8
 ↓
16
 ↓
32
```

每次：

```text
length = length * 2
```

所以数组长度一直是 2 的幂。

---

# 19. 为什么不能无限扩容？

因为 Cell 数量并不是越多越好。

Cell 越多：

```text
内存占用 ↑
缓存访问成本 ↑
遍历 sum 成本 ↑
```

所以经典实现会限制 cells 的最大长度。

一个重要的上限来源是：

```java
NCPU
```

也就是：

```java
Runtime.getRuntime().availableProcessors()
```

概念上可以理解为：

```text
cells.length <= CPU 核心数
```

这样可以避免无意义地创建大量 Cell。

> 注意：不同 JDK 版本实现细节可能不同，学习源码时应以对应 JDK 版本源码为准。

---

# 20. 完整的 LongAdder add 流程

把前面的内容全部串起来：

```text
                 add(x)
                   │
                   ↓
              cells 存在？
              /          \
            否            是
            │              │
            ↓              ↓
      CAS(base)       找到对应 Cell
        /     \           │
      成功    失败         ↓
       │       │       CAS(cell)
       │       │        /      \
       │       │      成功      失败
       │       │       │         │
       │       │       │         ↓
       │       │       │     竞争处理
       │       │       │      /      \
       │       │       │   扩容      重新定位
       │       │       │
       └───────┴───────┴──────> 完成
```

这就是 LongAdder 的核心。

---

# 21. 为什么 LongAdder 比 AtomicLong 更适合高并发计数？

AtomicLong：

```text
所有线程
    ↓
一个 value
    ↓
大量 CAS 竞争
```

LongAdder：

```text
所有线程
    ↓
多个 Cell
    ↓
把竞争分散
```

所以：

```text
AtomicLong：

T1 ─┐
T2 ─┤
T3 ─┼──> value
T4 ─┤
T5 ─┘
```

而 LongAdder 更像：

```text
T1 ──> cell0

T2 ──> cell1

T3 ──> cell2

T4 ──> cell3
```

竞争明显降低。

---

# 22. LongAdder 的 sum() 怎么实现？

LongAdder 的 `sum()` 非常简单：

```java
public long sum() {

    long sum = base;

    Cell[] cs = cells;

    if (cs != null) {
        for (Cell c : cs) {
            if (c != null) {
                sum += c.value;
            }
        }
    }

    return sum;
}
```

核心就是：

```text
sum = base

for every cell:
    sum += cell.value
```

最终：

```text
最终值 = base + cell0 + cell1 + cell2 + ...
```

原文对这一点的描述是正确的。

---

# 23. 为什么高并发下 sum() 可能不是一个“瞬间快照”？

这是理解 LongAdder 最重要的地方之一。

假设：

```text
base = 100

cell0 = 10
cell1 = 20
cell2 = 30
```

理论结果：

```text
160
```

但是 `sum()` 执行期间，其他线程可能正在修改：

```text
cell0
cell1
cell2
```

例如：

```text
sum() 读取 base = 100

线程 A：
cell0 = 11

sum() 读取 cell0 = 11

线程 B：
cell1 = 21

sum() 读取 cell1 = 21

线程 C：
cell2 = 31

sum() 读取 cell2 = 31
```

最终得到：

```text
100 + 11 + 21 + 31 = 163
```

但这个 163 并不一定对应某个真实的“同一瞬间”。

所以：

> **LongAdder 的 sum() 不提供一个原子的一致性快照。**

更准确地说：

- 如果没有并发更新，`sum()` 可以得到准确结果。
- 如果存在并发更新，`sum()` 可能观察到更新过程中的不同时间点。
- 因此不能把它当作严格线性一致的计数快照。

虽然说“高并发下返回近似值”方向是对的，但更准确的表达是“不保证与某个单一时刻严格一致”。

---

# 24. 一个 sum() 并发测试 Demo

下面这个 Demo 专门演示：

```java
import java.util.concurrent.atomic.LongAdder;

public class LongAdderSumDemo {

    public static void main(String[] args) throws Exception {

        LongAdder adder = new LongAdder();

        Thread writer = new Thread(() -> {
            for (int i = 0; i < 1_000_000; i++) {
                adder.increment();
            }
        });

        Thread reader = new Thread(() -> {
            for (int i = 0; i < 100; i++) {
                System.out.println("sum = " + adder.sum());
            }
        });

        writer.start();
        reader.start();

        writer.join();
        reader.join();

        System.out.println("最终结果 = " + adder.sum());
    }
}
```

最终：

```text
最终结果 = 1000000
```

但是中间读取到的：

```text
sum = 123
sum = 5234
sum = 82391
...
```

只是某个读取时刻观察到的结果。

---

# 25. 为什么 LongAdder 的 sum() 不能用于严格业务判断？

例如：

```java
if (adder.sum() >= 1000) {
    // 执行某个只允许一次的操作
}
```

这是危险的。

因为：

```text
线程 A：
读取 sum = 999

线程 B：
读取 sum = 999

线程 C：
继续增加
```

多个线程看到的值可能不是一个严格同步的状态。

所以：

> LongAdder 非常适合“统计”，但不适合拿来实现严格的并发状态判断。

---

# 26. LongAdder 最典型的应用场景

## 26.1 统计请求数量

例如：

```java
LongAdder requestCount = new LongAdder();

public void handleRequest() {

    requestCount.increment();

    // 处理请求
}
```

定时打印：

```java
System.out.println("requestCount = " + requestCount.sum());
```

这种场景非常适合。

因为我们通常关心：

```text
总请求量
```

而不是：

```text
某一个纳秒时刻绝对精确的请求量
```

---

# 27. Web 服务统计 Demo

```java
import java.util.concurrent.atomic.LongAdder;

public class RequestCounter {

    private final LongAdder counter = new LongAdder();

    public void request() {
        counter.increment();
    }

    public long getRequestCount() {
        return counter.sum();
    }
}
```

调用：

```java
RequestCounter counter = new RequestCounter();

counter.request();
counter.request();

System.out.println(counter.getRequestCount());
```

输出：

```text
2
```

---

# 28. LongAdder vs AtomicLong

| 对比项 | AtomicLong | LongAdder |
|---|---|---|
| 核心机制 | CAS | CAS + Cell 分散 |
| 数据结构 | 一个变量 | base + Cell[] |
| 低并发 | 很好 | 很好 |
| 高并发写 | 竞争一个变量 | 分散竞争 |
| sum/get | `get()` | `sum()` |
| 是否严格快照 | `get()` 是单变量读取 | `sum()` 非原子快照 |
| 适合统计 | 可以 | 非常适合 |
| 适合严格状态控制 | 更合适 | 不适合 |
| 内存占用 | 较小 | 更高 |
| 实现复杂度 | 相对简单 | 更复杂 |

一句话：

> **AtomicLong 更像“一个精确的共享计数器”，LongAdder 更像“为了高并发性能而拆开的计数器集合”。**

---

# 29. LongAdder 为什么不用锁？

LongAdder 的核心更新过程依赖：

```text
CAS
```

而不是：

```java
synchronized
```

或者：

```java
ReentrantLock
```

原因是：

> 对一个简单数值做原子更新，CAS 通常比线程阻塞/唤醒更加轻量。

但要注意：

> LongAdder 并不是“完全没有竞争”。

它仍然会发生：

```text
CAS 失败
```

只是：

> **通过 Cell 把竞争从一个热点变量分散成多个热点变量。**

---

# 30. CAS 的底层原理

CAS：

```text
Compare And Swap
```

可以理解为：

```java
if (当前值 == expected) {
    当前值 = newValue;
    return true;
}

return false;
```

例如：

```text
当前值 = 10

CAS(10, 11)
```

如果当前值仍然是：

```text
10
```

那么：

```text
10 → 11
```

成功。

如果已经被其他线程改成：

```text
12
```

那么：

```text
CAS(10, 11)
```

失败。

---

# 31. LongAdder 的 CAS 更新为什么线程安全？

假设：

```text
cell0.value = 100
```

线程 A：

```text
CAS(100, 101)
```

线程 B：

```text
CAS(100, 101)
```

最终只有一个成功。

例如：

```text
A：成功
B：失败
```

B 会重新读取：

```text
101
```

再尝试：

```text
CAS(101, 102)
```

因此不会发生：

```text
100 + 1
100 + 1
= 101
```

这种更新丢失。

---

# 32. LongAdder 源码核心：add()

为了理解源码，可以把复杂实现先简化成下面这样：

```java
public void add(long x) {

    Cell[] cs;
    long b;

    // 1. cells 还没初始化时，优先尝试更新 base
    if ((cs = cells) == null) {

        if (casBase(b = base, b + x)) {
            return;
        }
    }

    // 2. 如果 base 竞争失败，
    //    尝试把更新分散到 Cell
    longAccumulate(x, null, true);
}
```

真正源码会复杂很多，因为还需要处理：

```text
Cell 不存在
Cell CAS 失败
Cell 数组初始化
Cell 数组扩容
线程 probe 更新
cellsBusy
```

但核心逻辑就是：

```text
先 base
失败后 cells
竞争严重就扩容
```

---

# 33. LongAdder 源码核心：sum()

可以直接记住这个版本：

```java
public long sum() {

    long sum = base;

    Cell[] cs = cells;

    if (cs != null) {

        for (Cell c : cs) {

            if (c != null) {
                sum += c.value;
            }
        }
    }

    return sum;
}
```

这段代码基本就是理解 LongAdder 读取逻辑的钥匙。

---

# 34. Striped64.longAccumulate() 核心重点

如果你真正想深入 LongAdder：

> **一定要看 `Striped64.longAccumulate()`。**

这个方法负责处理：

```text
Cell 初始化
Cell CAS
竞争失败
扩容
重新定位
probe 变化
```

可以把它抽象成：

```text
longAccumulate(x)
        │
        ↓
   cells 存在？
    /       \
   否        是
   │          │
   ↓          ↓
初始化      定位 Cell
              │
              ↓
          CAS 更新
           /     \
        成功     失败
         │         │
         │         ↓
         │      是否继续竞争？
         │       /      \
         │     否        是
         │     │          │
         │     │          ↓
         │     │        扩容
         │     │
         └─────┴──→ 完成
```

---

# 35. cellsBusy 是怎么工作的？

初始化/扩容不是所有线程一起做。

否则会出现：

```text
Thread A → 扩容
Thread B → 扩容
Thread C → 扩容
```

大家同时修改数组就会产生新的竞争。

所以使用：

```java
cellsBusy
```

配合 CAS。

概念代码：

```java
if (cellsBusy == 0 && casCellsBusy()) {

    try {

        // 初始化 / 扩容 cells

    } finally {

        cellsBusy = 0;
    }
}
```

它类似于：

```text
轻量级自旋锁
```

但是不要简单认为：

```text
cellsBusy = synchronized
```

它的使用范围非常有限：

> 主要保护 Cell 数组结构变化，而不是保护每一次计数。

---

# 36. 为什么 Cell 不直接用数组锁？

如果写成：

```java
synchronized (cells) {
    cells[index].value++;
}
```

就失去了 LongAdder 的核心优势。

因为：

```text
所有线程
    ↓
同一个锁
    ↓
重新排队
```

LongAdder 真正希望做到的是：

```text
线程 A → CAS cell0
线程 B → CAS cell1
线程 C → CAS cell2
```

大家尽量互不影响。

---

# 37. false sharing（伪共享）问题

这是 LongAdder 源码中一个非常容易被忽略的底层细节。

CPU 并不是按照 Java `long` 一个一个读取内存。

现代 CPU 通常以：

```text
Cache Line
```

为基本单位进行缓存。

经典情况下 Cache Line 常见为：

```text
64 bytes
```

如果：

```text
cell0.value
cell1.value
cell2.value
```

恰好位于同一个 Cache Line。

那么：

```text
CPU Core 1 修改 cell0
CPU Core 2 修改 cell1
```

即使两个线程修改的是不同变量，也可能导致缓存行频繁失效。

这就是：

> **False Sharing（伪共享）**

---

# 38. LongAdder 为什么需要 Cell padding？

经典 JDK 实现中的 Cell 使用了类似：

```java
@sun.misc.Contended
static final class Cell {

    volatile long value;

}
```

目的之一就是：

> 尽量避免多个热点 Cell 发生伪共享。

因此 LongAdder 的性能优化不仅仅是：

```text
CAS 分散
```

还包括：

```text
Cell 分散
+
Cache Line 优化
```

这也是为什么 LongAdder 的实现比 AtomicLong 复杂很多。

---

# 39. LongAdder 的完整底层结构

可以把它总结成：

```text
                         LongAdder
                             │
                             ↓
                         Striped64
                             │
             ┌───────────────┼────────────────┐
             ↓               ↓                ↓
           base            cells          cellsBusy
                             │
              ┌──────────────┼──────────────┐
              ↓              ↓              ↓
           Cell[0]        Cell[1]         Cell[2]
              │              │              │
           value          value           value
              ↑              ↑              ↑
            CAS            CAS             CAS
              ↑              ↑              ↑
          Thread A       Thread B        Thread C
              │              │              │
              └────── probe/hash ──────────┘
```

---

# 40. 为什么 LongAdder 叫 LongAdder？

因为它的定位就是：

> **高并发场景下进行累加。**

例如：

```java
adder.increment();
adder.add(10);
```

而不是：

```java
adder.compareAndSet(...)
```

或者：

```java
adder.getAndSet(...)
```

LongAdder 的设计重点就是：

```text
大量线程
+
大量加法
+
允许 sum 非严格瞬时一致
```

---

# 41. LongAdder 最适合什么场景？

## 非常适合

### 1. QPS 统计

```text
请求 +1
请求 +1
请求 +1
```

---

### 2. 消息消费数量

```text
消费一条消息
    ↓
counter.increment()
```

---

### 3. 访问次数

```text
用户访问一次
    ↓
counter.increment()
```

---

### 4. 监控指标

例如：

```text
成功请求数
失败请求数
缓存命中数
消息消费数
```

---

# 42. LongAdder 不适合什么？

例如：

```java
if (balance.sum() >= 100) {
    balance.add(-100);
}
```

这种逻辑存在严重问题。

因为：

```text
判断
+
修改
```

不是一个原子操作。

可能出现：

```text
Thread A：看到 100
Thread B：也看到 100

Thread A：扣 100
Thread B：也扣 100
```

最终发生超扣。

因此：

> LongAdder 是计数器，不应该拿来实现复杂的原子状态机。

---

# 43. 一个并发测试 Demo

下面测试 LongAdder 的线程安全性：

```java
import java.util.concurrent.atomic.LongAdder;

public class LongAdderTest {

    public static void main(String[] args) throws Exception {

        LongAdder adder = new LongAdder();

        int threadCount = 20;
        int loopCount = 100_000;

        Thread[] threads = new Thread[threadCount];

        for (int i = 0; i < threadCount; i++) {

            threads[i] = new Thread(() -> {

                for (int j = 0; j < loopCount; j++) {
                    adder.increment();
                }

            });

            threads[i].start();
        }

        for (Thread thread : threads) {
            thread.join();
        }

        long expected = (long) threadCount * loopCount;

        System.out.println("expected = " + expected);
        System.out.println("actual   = " + adder.sum());
    }
}
```

预期：

```text
expected = 2000000
actual   = 2000000
```

这里可以证明：

> 在所有写线程结束之后，`sum()` 能正确汇总所有 Cell。

---

# 44. LongAdder 与普通 long 的区别

普通：

```java
long count;

count++;
```

实际上不是原子的：

```text
读取 count
    ↓
+1
    ↓
写回 count
```

多个线程可能覆盖彼此的更新。

而 LongAdder：

```text
读取 Cell
    ↓
CAS
    ↓
成功？
 ┌──┴──┐
是    否
│      │
结束   重试
```

因此更新不会因为普通读改写竞争而丢失。

---

# 45. LongAdder 与 synchronized 的区别

`synchronized`：

```text
线程 A
  ↓
获得锁
  ↓
修改
  ↓
释放锁

线程 B
  ↓
等待
```

LongAdder：

```text
Thread A → CAS cell0
Thread B → CAS cell1
Thread C → CAS cell2
```

如果线程能够分散到不同 Cell：

```text
几乎可以并行更新
```

所以 LongAdder 在高并发计数场景通常具有明显优势。

---

# 46. LongAdder 的核心设计思想总结

LongAdder 的整个设计可以归纳成五个关键词：

```text
1. CAS
2. 分散
3. Cell
4. 扩容
5. 最终汇总
```

完整过程：

```text
低并发
   ↓
base CAS
   ↓
发生竞争
   ↓
创建 Cell[]
   ↓
probe 定位
   ↓
Cell CAS
   ↓
继续竞争
   ↓
扩容
   ↓
更多 Cell
   ↓
sum()
   ↓
base + 所有 Cell
```

---

# 47. 最重要的源码阅读路线

如果准备深入 学习JUC 源码，建议按照下面顺序阅读：

```text
LongAdder.add()
       ↓
Striped64.longAccumulate()
       ↓
Cell.cas()
       ↓
ThreadLocalRandom.getProbe()
       ↓
cells 初始化
       ↓
cells 扩容
       ↓
LongAdder.sum()
```

不要一开始直接硬啃 `longAccumulate()`。

正确方式是：

```text
先理解数据结构
       ↓
再理解 add()
       ↓
再理解 CAS
       ↓
再理解 probe
       ↓
最后看 longAccumulate()
```

---

# 48. 一句话理解 LongAdder

问：

> LongAdder 为什么高并发下比 AtomicLong 更快？

答：

> AtomicLong 所有线程都竞争同一个变量，CAS 冲突比较严重。LongAdder 通过 Striped64 将计数分散到多个 Cell，不同线程通过 probe 定位到不同 Cell，减少热点竞争；竞争严重时还会扩容 Cell 数组。最终通过 `base + 所有 Cell` 汇总得到计数结果。因此它牺牲了 `sum()` 的严格瞬时一致性，换取了高并发写入性能。

---

# 49. 最终脑图

```text
                         LongAdder
                             │
                             ↓
                         Striped64
                             │
                ┌────────────┼─────────────┐
                ↓            ↓             ↓
              base         cells        cellsBusy
                │            │
                │       ┌────┼────┐
                │       ↓    ↓    ↓
                │     Cell Cell Cell
                │       │    │    │
                │       ↓    ↓    ↓
                │      CAS  CAS  CAS
                │       ↑    ↑    ↑
                │       └──probe───┘
                │
                └──────────┐
                           ↓
                     sum() 汇总
                           ↓
              base + cell0 + cell1 + ...
```

---

# 50. 最后记住三个关键问题

## 问题一：为什么 LongAdder 快？

因为：

```text
把一个热点变量
      ↓
拆成多个 Cell
      ↓
分散 CAS 竞争
```

---

## 问题二：为什么需要 probe？

因为：

```text
线程
 ↓
probe
 ↓
hash
 ↓
Cell 下标
```

让不同线程尽量落到不同 Cell。

---

## 问题三：为什么 sum() 不严格？

因为：

```text
sum()
 ↓
读取 base
 ↓
读取 cell0
 ↓
读取 cell1
 ↓
读取 cell2
```

读取期间其他线程仍然可能修改 Cell。

所以：

> **LongAdder 的核心取舍就是：用读取时的非严格瞬时一致性，换取高并发写入时更低的竞争。**

这也是理解 LongAdder 最核心的一句话。
