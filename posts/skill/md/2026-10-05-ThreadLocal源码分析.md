---
title: ThreadLocal 源码分析与常见问题
date: 2026-10-05
category: Java 与 JVM
tags: [ThreadLocal, 内存泄漏, 线程池, 源码分析]
languages: [Java]
excerpt: 分析 ThreadLocal 的底层实现、内存泄漏风险、线程池使用场景和替代方案。
---

# ThreadLocal 的问题以及解决方案

> 本文围绕 Java `ThreadLocal` 的设计、底层实现、内存泄漏风险、线程池场景以及替代方案展开。每个主题都包含：**原理说明 → OpenJDK 源码关键点 → Demo → 测试 Demo → 实战建议**。全文共 8 个主题。
>
> 示例默认以 **JDK 17+、JUnit 5** 为基础；涉及 `ScopedValue` 的部分以 **JDK 25** 为准。

---

## 1、什么是 ThreadLocal？为什么要设计 ThreadLocal？

### 1.1 ThreadLocal 是什么

`ThreadLocal<T>` 用于保存“**线程本地变量**”。

它最大的特点不是“变量只有一个”，而是：

> **同一个 ThreadLocal 对象，被不同线程访问时，每个线程拥有独立的 value。**

例如：

```java
private static final ThreadLocal<String> USER_CONTEXT = new ThreadLocal<>();

public static void main(String[] args) throws InterruptedException {
    USER_CONTEXT.set("main-user");

    Thread t = new Thread(() -> {
        System.out.println("子线程第一次 get: " + USER_CONTEXT.get());
        USER_CONTEXT.set("child-user");
        System.out.println("子线程第二次 get: " + USER_CONTEXT.get());
    });

    t.start();
    t.join();

    System.out.println("主线程 get: " + USER_CONTEXT.get());

    USER_CONTEXT.remove();
}
```

输出效果：

```text
子线程第一次 get: null
子线程第二次 get: child-user
主线程 get: main-user
```

这里可以看到：

```text
Thread-1 -> USER_CONTEXT = child-user
main    -> USER_CONTEXT = main-user
```

两条线程访问的是**同一个 ThreadLocal 对象**，但拿到的是**不同线程自己的 value**。

### 1.2 为什么需要 ThreadLocal

假设一个 Web 请求需要贯穿 Controller → Service → DAO 传递 `traceId`：

```java
controller(traceId)
    -> service(traceId)
        -> dao(traceId)
```

如果调用链非常深，每一层都增加一个参数，会产生明显的“参数污染”：

```java
service(String traceId, User user, ...)
dao(String traceId, User user, ...)
repository(String traceId, ...)
```

`ThreadLocal` 提供了一种隐式上下文：

```java
TRACE_ID.set(traceId);

service();

String traceId = TRACE_ID.get();
```

因此它适合保存：

- 当前线程的请求上下文
- 当前用户标识
- TraceId / RequestId
- 数据库连接或会话上下文（使用时必须严格管理生命周期）
- 格式化器等线程隔离状态
- 一些不希望通过方法参数层层传递的数据

### 1.3 ThreadLocal 的核心 API

```java
ThreadLocal<String> local = new ThreadLocal<>();

local.set("hello");
String value = local.get();
local.remove();
```

也可以通过 `withInitial` 指定初始值：

```java
ThreadLocal<List<String>> local =
        ThreadLocal.withInitial(ArrayList::new);
```

注意：`remove()` 后再次 `get()`，会重新触发 `initialValue()` / `Supplier`。

### 1.4 OpenJDK 源码关键点

OpenJDK 的 `ThreadLocal#get()` 并不是直接从一个全局 Map 读取，而是先获得当前线程的 `ThreadLocalMap`：

```java
Thread t = Thread.currentThread();
ThreadLocalMap map = getMap(t);
```

随后：

```java
Entry e = map.getEntry(this);
```

如果当前线程还没有对应的 value，则初始化：

```java
T value = initialValue();
map.set(this, value);
return value;
```

核心逻辑可以理解为：

```text
ThreadLocal.get()
      ↓
Thread.currentThread()
      ↓
currentThread.threadLocals
      ↓
ThreadLocalMap
      ↓
找到当前 ThreadLocal 对应 Entry
      ↓
Entry.value
```

源码位置：

- OpenJDK `ThreadLocal.java`
- `ThreadLocal#get`
- `ThreadLocal#set`
- `ThreadLocal#remove`

参考：

- Oracle Java 25 ThreadLocal API: https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/lang/ThreadLocal.html
- OpenJDK ThreadLocal 源码: https://github.com/openjdk/jdk/blob/master/src/java.base/share/classes/java/lang/ThreadLocal.java

### 1.5 Demo：不同线程拥有不同副本

```java
import java.util.concurrent.CountDownLatch;

public class ThreadLocalDemo {

    private static final ThreadLocal<Integer> LOCAL =
            ThreadLocal.withInitial(() -> 0);

    public static void main(String[] args) throws InterruptedException {
        CountDownLatch latch = new CountDownLatch(2);

        Runnable task = () -> {
            try {
                System.out.println(Thread.currentThread().getName()
                        + " before = " + LOCAL.get());

                LOCAL.set(100);

                System.out.println(Thread.currentThread().getName()
                        + " after = " + LOCAL.get());
            } finally {
                LOCAL.remove();
                latch.countDown();
            }
        };

        new Thread(task, "thread-A").start();
        new Thread(task, "thread-B").start();

        latch.await();
    }
}
```

两个线程最终都得到 `100`，但它们的 `100` 并不是共享数据，而是两个线程各自保存的一份值。

### 1.6 JUnit 5 测试 Demo

```java
import org.junit.jupiter.api.Test;

import java.util.concurrent.*;

import static org.junit.jupiter.api.Assertions.*;

class ThreadLocalDemoTest {

    private final ThreadLocal<String> local = new ThreadLocal<>();

    @Test
    void eachThreadShouldHaveIndependentValue() throws Exception {
        local.set("main");

        ExecutorService executor = Executors.newSingleThreadExecutor();
        try {
            Future<String> future = executor.submit(() -> {
                assertNull(local.get());
                local.set("worker");
                return local.get();
            });

            assertEquals("worker", future.get(3, TimeUnit.SECONDS));
            assertEquals("main", local.get());
        } finally {
            local.remove();
            executor.shutdown();
        }
    }
}
```

---

## 2、ThreadLocal、Thread、ThreadLocalMap 三者是什么关系？

这是理解 ThreadLocal 的核心。

### 2.1 最重要的一张关系图

```text
                     ThreadLocal 实例
                           │
                           │ 作为 key
                           ▼
Thread ──────────────> ThreadLocalMap
  │                         │
  │                         ├── Entry(ThreadLocal -> value)
  │                         ├── Entry(ThreadLocal -> value)
  │                         └── Entry(ThreadLocal -> value)
  │
  └── 每一个 Thread 自己维护自己的 ThreadLocalMap
```

可以进一步理解成：

```text
Thread A
 └── ThreadLocalMap
      ├── ThreadLocal#1 -> A-value-1
      ├── ThreadLocal#2 -> A-value-2
      └── ThreadLocal#3 -> A-value-3

Thread B
 └── ThreadLocalMap
      ├── ThreadLocal#1 -> B-value-1
      ├── ThreadLocal#2 -> B-value-2
      └── ThreadLocal#3 -> B-value-3
```

也就是说：

> **ThreadLocal 本身并不直接保存每个线程的 value；真正保存 value 的地方是 Thread 对象内部的 ThreadLocalMap。**

### 2.2 Thread 类中的 ThreadLocalMap

OpenJDK 的 `Thread` 中存在与 ThreadLocal 相关的字段，核心结构可以概括为：

```java
ThreadLocal.ThreadLocalMap threadLocals = null;
```

所以：

```java
ThreadLocal
```

更像一个“访问入口 / key”。

真正的关系是：

```text
ThreadLocal
   ↓
当前 Thread
   ↓
ThreadLocalMap
   ↓
Entry
   ↓
value
```

### 2.3 ThreadLocalMap 为什么是 Thread 的成员

因为这样才能实现：

```java
threadLocal.set(value);
```

底层实际类似：

```java
Thread current = Thread.currentThread();
ThreadLocalMap map = current.threadLocals;
map.set(threadLocal, value);
```

于是不同线程天然隔离：

```text
Thread A -> Map A
Thread B -> Map B
Thread C -> Map C
```

完全没有必要让 `ThreadLocal` 自己维护一个：

```java
Map<Thread, T>
```

这种设计反而会造成线程生命周期与 Map 生命周期绑定、并带来额外并发和清理问题。

### 2.4 为什么 ThreadLocalMap 不是普通 HashMap

`ThreadLocalMap` 是 `ThreadLocal` 的内部实现类，专门服务于线程本地变量。

OpenJDK 源码注释明确说明，它是一个专门维护线程本地变量的定制 Map，而不是通用的 `HashMap`。

它内部使用数组：

```java
private Entry[] table;
```

而 Entry 是：

```java
static class Entry extends WeakReference<ThreadLocal<?>> {
    Object value;
}
```

这个设计直接引出了后面最关键的“弱引用问题”。

### 2.5 ThreadLocalMap 是怎么定位 Entry 的

每个 `ThreadLocal` 内部有自己的 hash 值，核心定位思想是：

```java
int i = key.threadLocalHashCode & (table.length - 1);
```

发生冲突时继续向后探测。

因此 ThreadLocalMap 属于一种**定制的开放地址法哈希表**。

### 2.6 Demo：证明 ThreadLocal 真正的数据存储在线程侧

下面这个 Demo 用反射查看当前线程内部的 `ThreadLocalMap`。

> 说明：这是 JVM 实现细节演示，不建议在业务代码中这样访问 JDK 私有字段。

```java
import java.lang.reflect.Field;

public class ThreadLocalMapInspectDemo {

    private static final ThreadLocal<String> LOCAL = new ThreadLocal<>();

    public static void main(String[] args) throws Exception {
        LOCAL.set("hello-thread-local");

        Thread current = Thread.currentThread();

        Field threadLocalsField = Thread.class.getDeclaredField("threadLocals");
        threadLocalsField.setAccessible(true);

        Object map = threadLocalsField.get(current);

        System.out.println("current thread = " + current.getName());
        System.out.println("threadLocalMap = " + map);

        LOCAL.remove();
    }
}
```

JDK 9+ 运行时如果遇到模块访问限制，可使用：

```bash
--add-opens java.base/java.lang=ALL-UNNAMED
```

---

## 3、ThreadLocal 为什么使用弱引用设计？

这是 ThreadLocal 最重要、也最容易被误解的一点。

### 3.1 Entry 为什么要继承 WeakReference

OpenJDK 当前实现中，核心结构是：

```java
static class Entry extends WeakReference<ThreadLocal<?>> {
    Object value;
}
```

意思是：

```text
key   = 弱引用 ThreadLocal
value = 强引用真正的数据
```

可以画成：

```text
Thread
  │
  ▼
ThreadLocalMap
  │
  ▼
Entry
 ├── key   ──weak──> ThreadLocal
 └── value ──strong─> UserContext
```

### 3.2 为什么 key 使用弱引用

假设：

```java
ThreadLocal<Object> local = new ThreadLocal<>();
local.set(new Object());
```

当业务代码后面不再持有 `local`：

```java
local = null;
```

如果 `Entry.key` 是强引用：

```text
ThreadLocalMap
  ↓
Entry
  ↓
ThreadLocal
```

那么只要线程一直存活，ThreadLocal 对象就一直不能被 GC。

尤其在线程池中，工作线程往往长期存在，这个问题会被无限放大。

使用弱引用后：

```text
ThreadLocalMap
  ↓
Entry
  ↓ weak
ThreadLocal  X   (可被 GC)
```

ThreadLocal 对象可以被 GC。

### 3.3 但是弱引用并不意味着“不会内存泄漏”

这是最关键的认知。

很多文章会说：

> ThreadLocal 使用弱引用，所以不会内存泄漏。

这句话是不完整的。

实际情况是：

```text
ThreadLocal 被 GC
        ↓
Entry.key 变成 null
        ↓
Entry 变成 stale entry
        ↓
但是 Entry.value 仍然是强引用
        ↓
value 继续被 ThreadLocalMap 持有
        ↓
线程长期存活
        ↓
value 可能长期无法回收
```

所以真正危险的是：

```text
弱 key + 强 value + 长生命周期 Thread
```

### 3.4 为什么 JDK 不直接用强引用 + 自动回收

ThreadLocal 很难知道“什么时候这个业务变量生命周期已经结束”。

JVM 可以判断：

```text
ThreadLocal 对象是否还有外部引用？
```

但 JVM 并不知道：

```text
ThreadLocal 对应的 value 是否已经不再被业务需要？
```

因此 JDK 采用了折中策略：

```text
key 使用弱引用
```

让 ThreadLocal 对象本身在失去外部引用时有机会被回收。

然后在 ThreadLocalMap 的访问过程中顺便清理 stale entry。

### 3.5 OpenJDK 源码如何处理 stale entry

当前 OpenJDK 的关键判断类似：

```java
if (e.refersTo(null)) {
    expungeStaleEntry(i);
}
```

清理过程会：

1. 将 stale entry 的 value 置空
2. 删除该数组槽位
3. 对后续可能受哈希冲突影响的 entry 进行重新定位
4. 继续清理其他 stale entry

这说明一个非常重要的事实：

> **ThreadLocalMap 的 stale entry 不是由 GC 直接从 Map 中删除的，而是 GC 清掉弱引用后，由后续 ThreadLocalMap 操作触发清理。**

### 3.6 Demo：观察弱引用

```java
import java.lang.ref.WeakReference;

public class WeakReferenceDemo {

    public static void main(String[] args) throws Exception {
        ThreadLocal<String> local = new ThreadLocal<>();

        WeakReference<ThreadLocal<String>> ref =
                new WeakReference<>(local);

        local.set("hello");

        local = null;

        // 仅用于演示，不保证一次 System.gc() 就立即回收。
        for (int i = 0; i < 20 && ref.get() != null; i++) {
            System.gc();
            Thread.sleep(50);
        }

        System.out.println("ThreadLocal ref = " + ref.get());
    }
}
```

注意：GC 由 JVM 决定，`System.gc()` 只是建议，因此这个 Demo 不应该写成“必须回收”的稳定单元测试。

### 3.7 实战结论

弱引用解决的是：

```text
ThreadLocal 对象本身的生命周期问题
```

弱引用没有完全解决：

```text
ThreadLocal value 的生命周期问题
```

因此最终仍然需要：

```java
try {
    LOCAL.set(value);
    // business logic
} finally {
    LOCAL.remove();
}
```

---

## 4、null key 的情况如何解决？为什么一定要调用 remove()？

这里必须先纠正一个非常常见的说法：

> `null key` 并不是指 `ThreadLocal.set(null)`。

这是两个完全不同的概念。

### 4.1 `set(null)` 不会让 key 变成 null

```java
ThreadLocal<String> local = new ThreadLocal<>();
local.set(null);
```

这里：

```text
key   = local 对象
value = null
```

key 并没有变成 null。

### 4.2 真正的 null key 是 stale entry

例如：

```java
ThreadLocal<String> local = new ThreadLocal<>();
local.set("hello");

local = null;
```

GC 之后可能发生：

```text
Entry
 ├── key   = null   ← WeakReference 被清理
 └── value = "hello"
```

这类 Entry 才是所谓的：

```text
stale entry
```

### 4.3 ThreadLocalMap 如何解决 stale entry

OpenJDK 在多个操作中都会尝试清理：

```text
get()
set()
remove()
rehash()
```

典型逻辑：

```java
if (e.refersTo(null)) {
    expungeStaleEntry(i);
}
```

清理函数的核心思想可以理解为：

```java
private int expungeStaleEntry(int staleSlot) {
    tab[staleSlot].value = null;
    tab[staleSlot] = null;
    size--;

    // 后续槽位可能因为 hash 冲突而依赖前面的槽位
    // 所以需要继续扫描并重新整理

    return nextNullSlot;
}
```

### 4.4 为什么不让 GC 自动把整个 Entry 一起删除

因为 GC 管的是 Java 对象可达性，而 ThreadLocalMap 数组本身仍然强引用着 Entry：

```text
Thread
  ↓
ThreadLocalMap
  ↓
Entry[]
  ↓
Entry
  ├── key   --weak--> ThreadLocal
  └── value --strong-> Value
```

GC 可以清掉：

```text
WeakReference 指向的 ThreadLocal
```

但不能因为 key 失效，就任意操作 `ThreadLocalMap` 的数组结构。

因为数组本身仍然是普通 Java 对象，删除 Entry、调整冲突链、维护 size 等属于应用级数据结构操作，所以这些工作由 ThreadLocalMap 自己完成。

### 4.5 为什么一定建议调用 remove()

因为 `remove()` 是最确定、最及时的清理方式。

调用：

```java
LOCAL.remove();
```

会直接把当前线程对应的 Entry 清理掉，而不是等待：

```text
GC
 ↓
stale entry
 ↓
下一次 get/set/remove/rehash
 ↓
触发清理
```

这就是为什么工程实践中经常看到：

```java
try {
    LOCAL.set(context);
    // 业务逻辑
} finally {
    LOCAL.remove();
}
```

### 4.6 最推荐的使用模板

```java
public void execute(RequestContext context) {
    try {
        REQUEST_CONTEXT.set(context);
        doBusiness();
    } finally {
        REQUEST_CONTEXT.remove();
    }
}
```

而不是：

```java
public void execute(RequestContext context) {
    REQUEST_CONTEXT.set(context);
    doBusiness();
    REQUEST_CONTEXT.remove(); // 不安全
}
```

因为 `doBusiness()` 一旦抛异常：

```text
set
 ↓
doBusiness
 ↓
Exception
 ↓
remove 根本执行不到
```

### 4.7 Demo：异常也必须 remove

```java
public class ThreadLocalRemoveDemo {

    private static final ThreadLocal<String> USER = new ThreadLocal<>();

    public static void main(String[] args) {
        try {
            USER.set("jack");
            System.out.println(USER.get());
            throw new RuntimeException("business error");
        } catch (RuntimeException e) {
            System.out.println("catch: " + e.getMessage());
        } finally {
            USER.remove();
        }

        System.out.println("after remove = " + USER.get());
    }
}
```

注意：最后一次 `get()` 会重新进入初始化逻辑；普通 `ThreadLocal` 的默认 `initialValue()` 是 `null`。

### 4.8 JUnit 5：验证 remove 会让数据重新初始化

```java
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class ThreadLocalRemoveTest {

    @Test
    void removeShouldClearCurrentThreadValue() {
        ThreadLocal<String> local =
                ThreadLocal.withInitial(() -> "initial");

        assertEquals("initial", local.get());

        local.set("changed");
        assertEquals("changed", local.get());

        local.remove();
        assertEquals("initial", local.get());

        local.remove();
    }
}
```

---

## 5、ThreadLocal 适用的场景

ThreadLocal 不是“所有线程共享数据问题”的解决方案，它更适合：

> **数据与当前线程天然绑定，并且调用链中多个方法需要读取这个数据。**

### 5.1 场景一：请求上下文

```java
public record RequestContext(String traceId, String userId) {
}
```

```java
public final class RequestContextHolder {

    private RequestContextHolder() {
    }

    private static final ThreadLocal<RequestContext> HOLDER =
            new ThreadLocal<>();

    public static void set(RequestContext context) {
        HOLDER.set(context);
    }

    public static RequestContext get() {
        return HOLDER.get();
    }

    public static void clear() {
        HOLDER.remove();
    }
}
```

业务：

```java
try {
    RequestContextHolder.set(
            new RequestContext("trace-001", "user-1001")
    );

    service();
} finally {
    RequestContextHolder.clear();
}
```

Service 内部：

```java
public void service() {
    RequestContext context = RequestContextHolder.get();
    System.out.println("traceId = " + context.traceId());
}
```

适合的关键条件是：

```text
一个线程内处理一个明确的执行上下文
```

### 5.2 场景二：日志 TraceId / MDC 类场景

业务代码可能不希望每一层都显式传 `traceId`：

```java
controller()
service()
repository()
```

可以在入口设置：

```java
TRACE_ID.set(traceId);
```

日志组件在当前线程中读取：

```java
TRACE_ID.get();
```

但进入线程池时一定要结合 `finally/remove`。

### 5.3 场景三：线程隔离的可复用对象

某些对象是：

- 非线程安全
- 创建成本较高
- 可以安全地“一线程一份”

例如一些格式化器、解析器或者中间状态对象。

现代 JDK 中很多 API 已经不需要通过 ThreadLocal 实现这一点，因此应先考虑更简单、无共享状态的方案。

### 5.4 场景四：避免显式参数层层传递

例如：

```java
public void a(Context context) {
    b(context);
}

public void b(Context context) {
    c(context);
}

public void c(Context context) {
    d(context);
}
```

当 `Context` 并不是每层业务逻辑真正关心的信息时，ThreadLocal 有一定价值：

```java
ContextHolder.get()
```

但应注意：

> ThreadLocal 是一种隐式依赖，过度使用会让代码的依赖关系变得不透明。

### 5.5 不适合的场景

不适合把 ThreadLocal 当成“全局变量”：

```java
ThreadLocal<List<Object>> GLOBAL = ...;
```

更不适合把真正需要跨线程共享的数据放到 ThreadLocal。

例如：

```text
缓存
业务数据
全局配置
共享计数器
线程间消息
```

这些通常有更明确的并发数据结构或上下文传递方式。

### 5.6 测试 Demo

```java
import org.junit.jupiter.api.Test;

import java.util.concurrent.*;

import static org.junit.jupiter.api.Assertions.*;

class RequestContextHolderTest {

    private static final ThreadLocal<String> CONTEXT =
            new ThreadLocal<>();

    @Test
    void contextShouldNotLeakAcrossIndependentThreads() throws Exception {
        ExecutorService executor = Executors.newFixedThreadPool(2);

        try {
            Future<String> f1 = executor.submit(() -> {
                try {
                    CONTEXT.set("request-A");
                    return CONTEXT.get();
                } finally {
                    CONTEXT.remove();
                }
            });

            Future<String> f2 = executor.submit(() -> {
                try {
                    CONTEXT.set("request-B");
                    return CONTEXT.get();
                } finally {
                    CONTEXT.remove();
                }
            });

            assertEquals("request-A", f1.get());
            assertEquals("request-B", f2.get());
        } finally {
            executor.shutdown();
        }
    }
}
```

---

## 6、为什么尽量不要在线程池中使用 ThreadLocal？如果一定要使用，要注意什么？还有哪些替代方案？

这一节是实际生产环境最重要的一部分。

### 6.1 普通线程与线程池的最大区别

普通线程：

```text
创建线程
   ↓
执行任务
   ↓
线程结束
   ↓
ThreadLocalMap 随 Thread 一起失去生命周期
```

线程池：

```text
创建 Worker Thread
   ↓
执行 Task A
   ↓
继续存活
   ↓
执行 Task B
   ↓
继续存活
   ↓
执行 Task C
```

因此：

> **线程池中的 Thread 是复用的，但 ThreadLocal 绑定的是 Thread，不是 Task。**

这就是 ThreadLocal 在线程池中最容易出问题的根源。

### 6.2 问题一：数据串请求 / 串任务

例如：

```java
static final ThreadLocal<String> USER = new ThreadLocal<>();
```

第一个任务：

```java
executor.submit(() -> {
    USER.set("Alice");
    // 忘记 remove()
});
```

线程执行完任务后不会销毁。

第二个任务可能复用相同 Worker：

```java
executor.submit(() -> {
    System.out.println(USER.get());
});
```

可能得到：

```text
Alice
```

但是当前任务实际上属于 Bob。

这是典型的：

```text
ThreadLocal 数据污染 / 上下文串线
```

### 6.3 Demo：线程池中的脏数据

```java
import java.util.concurrent.*;

public class ThreadPoolThreadLocalLeakDemo {

    private static final ThreadLocal<String> USER = new ThreadLocal<>();

    public static void main(String[] args) throws Exception {
        ExecutorService executor = Executors.newSingleThreadExecutor();

        try {
            executor.submit(() -> {
                USER.set("Alice");
                System.out.println("Task A = " + USER.get());
                // 故意不 remove
            }).get();

            executor.submit(() -> {
                System.out.println("Task B = " + USER.get());
                // 可能输出 Alice
            }).get();
        } finally {
            executor.shutdown();
        }
    }
}
```

这个 Demo 非常重要，它说明：

```text
ThreadLocal 的隔离单位 = Thread
线程池任务的隔离单位 = Task
```

两者不是一个维度。

### 6.4 问题二：value 长期占用内存

假如：

```java
ThreadLocal<byte[]> local = new ThreadLocal<>();
local.set(new byte[50 * 1024 * 1024]);
```

在线程池中：

```text
Worker Thread 长期存活
       ↓
ThreadLocalMap 长期存活
       ↓
value 仍然可能被持有
```

特别是下面这种模式风险很大：

```java
private static void execute() {
    ThreadLocal<byte[]> local = new ThreadLocal<>();
    local.set(new byte[50 * 1024 * 1024]);
}
```

方法执行结束后，`local` 变量没了，但在线程池 Worker 中，stale entry 的 `value` 可能仍然存在一段时间。

### 6.5 问题三：上下文传播问题

ThreadLocal 只绑定当前线程。

```java
USER.set("Alice");
```

之后：

```java
executor.submit(() -> {
    System.out.println(USER.get());
});
```

默认情况下不能认为能自动获得父线程中的值。

因此：

```text
主线程
  USER = Alice
      ↓
线程池 Worker
  USER = ?
```

二者没有天然的普通 ThreadLocal 继承关系。

### 6.6 为什么不推荐把 InheritableThreadLocal 当成线程池解决方案

`InheritableThreadLocal` 是另一套机制：创建子线程时可以把父线程中的值传给子线程。

但是线程池 Worker 往往在真正业务任务提交之前就已经创建好了，因此：

```text
提交任务时设置 Alice
        ↓
Worker 早就创建
        ↓
并不会因为这个任务提交自动复制 Alice
```

所以 `InheritableThreadLocal` 并不能自然解决线程池中的上下文传播问题。

此外，对于复杂异步模型，隐式继承还会让生命周期和覆盖关系更加难以管理。

### 6.7 如果一定要在线程池中使用 ThreadLocal

最重要的原则只有一句：

> **在线程池任务边界设置，在任务边界 finally 中清理。**

标准模板：

```java
executor.submit(() -> {
    try {
        USER.set("Alice");

        doBusiness();
    } finally {
        USER.remove();
    }
});
```

### 6.8 更推荐：封装任务边界

可以统一封装：

```java
public static Runnable wrap(String userId, Runnable task) {
    return () -> {
        try {
            USER.set(userId);
            task.run();
        } finally {
            USER.remove();
        }
    };
}
```

使用：

```java
executor.submit(
        wrap("Alice", () -> {
            System.out.println(USER.get());
        })
);
```

这种方式可以明显降低“忘记 remove”的概率。

### 6.9 JUnit 5：验证线程池任务之间不能残留上下文

```java
import org.junit.jupiter.api.Test;

import java.util.concurrent.*;

import static org.junit.jupiter.api.Assertions.*;

class ThreadPoolThreadLocalTest {

    private static final ThreadLocal<String> USER = new ThreadLocal<>();

    @Test
    void threadLocalShouldBeCleanedAtTaskBoundary() throws Exception {
        ExecutorService executor = Executors.newSingleThreadExecutor();

        try {
            executor.submit(() -> {
                try {
                    USER.set("Alice");
                    assertEquals("Alice", USER.get());
                } finally {
                    USER.remove();
                }
            }).get();

            Future<String> secondTask = executor.submit(USER::get);

            assertNull(secondTask.get());
        } finally {
            executor.shutdown();
        }
    }
}
```

### 6.10 方案一：显式参数传递

最简单、最透明：

```java
public void service(RequestContext context) {
    dao(context);
}
```

优点：

```text
依赖清晰
容易测试
容易理解
不依赖线程
```

缺点：

```text
调用链深时参数可能变多
```

如果 Context 本身就是明确的业务输入，这通常是非常值得优先考虑的方案。

### 6.11 方案二：任务上下文包装

异步执行时，把上下文作为任务的一部分：

```java
public record TaskContext(String traceId, String userId) {
}

public record ContextTask(TaskContext context, Runnable task)
        implements Runnable {

    @Override
    public void run() {
        task.run();
    }
}
```

这种设计比“让线程自己携带业务状态”更符合任务模型。

### 6.12 方案三：使用成熟的上下文传播机制

在实际项目中，如果项目已经使用日志 TraceId、异步上下文或框架级请求上下文，应优先使用框架提供的上下文传播能力，而不是多个团队各自手写 ThreadLocal。

核心原则：

```text
上下文在哪里创建
        ↓
如何跨线程传播
        ↓
在哪里恢复
        ↓
在哪里清理
```

这四件事必须明确。

### 6.13 方案四：JDK 25 的 ScopedValue

在 **JDK 25** 中，`ScopedValue` 已成为标准 API。Oracle 文档明确将其定位为一种无需方法参数即可向较深调用链传递值的机制，并指出在“单向传递数据、拥有明确作用域”的场景下可以优先考虑它。

示例：

```java
public class ScopedValueDemo {

    private static final ScopedValue<String> TRACE_ID =
            ScopedValue.newInstance();

    public static void main(String[] args) {
        ScopedValue.where(TRACE_ID, "trace-001")
                .run(() -> {
                    service();
                });
    }

    private static void service() {
        System.out.println(TRACE_ID.get());
    }
}
```

和 ThreadLocal 的生命周期区别非常直观：

```text
ThreadLocal
    set
      ↓
长期存在
      ↓
必须 remove

ScopedValue
    where(...).run(...)
      ↓
进入作用域
      ↓
退出作用域
      ↓
自动恢复之前的绑定
```

JDK 25 API 文档还指出，`ScopedValue` 的设计尤其适合需要把数据沿调用链向下传递、但不希望调用方法显式增加参数的情况；在结构化并发环境下还支持受限的跨线程继承。

官方文档：

- ScopedValue API: https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/lang/ScopedValue.html
- JDK 25 重大变化: https://docs.oracle.com/en/java/javase/25/migrate/significant-changes-jdk-25.html

### 6.14 ThreadLocal、显式参数、ScopedValue 对比

| 方案 | 生命周期 | 跨线程 | 是否需要显式清理 | 依赖是否透明 | 典型场景 |
|---|---|---:|---:|---:|---|
| ThreadLocal | 线程生命周期附近 | 默认不传播 | 是 | 一般 | 线程绑定状态 |
| 显式参数 | 方法/业务调用链 | 可以显式传 | 否 | 最透明 | 普通业务 Context |
| 任务包装 | Task 生命周期 | 可以设计传播 | 由包装器负责 | 较透明 | 线程池异步任务 |
| ScopedValue | 动态作用域 | 支持受限结构化继承 | 不需要手工 remove | 较透明 | 单向上下文传递、结构化并发 |

### 6.15 关于虚拟线程

虚拟线程同样支持 ThreadLocal，但它与传统线程池 Worker 的生命周期模型不同：虚拟线程通常对应单个任务而不是被多个任务复用。JDK 官方仍建议谨慎使用 ThreadLocal，尤其不要利用 ThreadLocal 把昂贵资源“池化”到多个任务之间。

参考：

- JEP 444 Virtual Threads: https://openjdk.org/jeps/444

---


## 7、Java 强引用、软引用、弱引用、虚引用详解

### 7.1 为什么 ThreadLocal 会涉及“引用类型”问题

前面讲过，`ThreadLocalMap.Entry` 的 key 并不是一个普通的强引用，而是：

```java
static class Entry extends WeakReference<ThreadLocal<?>> {
    Object value;

    Entry(ThreadLocal<?> k, Object v) {
        super(k);
        value = v;
    }
}
```

这段设计直接把 `ThreadLocal` 和 Java 的四类引用联系起来：

```text
强引用 Strong Reference
        ↓
软引用 Soft Reference
        ↓
弱引用 Weak Reference
        ↓
虚引用 Phantom Reference
```

它们的核心区别不是“引用变量的写法不同”，而是：

> **当垃圾回收器发现一个对象没有普通强引用继续存活时，不同类型的引用会影响这个对象还能存活多久，以及应用程序能否重新取得它。**

在 Java SE 中，`SoftReference`、`WeakReference`、`PhantomReference` 都是 `Reference<T>` 的子类；它们对应不同的可达性等级。官方 GC 文档把可达性从强到弱定义为：Strongly Reachable → Softly Reachable → Weakly Reachable → Phantom Reachable → Unreachable。

### 7.2 四种引用的核心对比

| 对比维度 | 强引用 Strong | 软引用 SoftReference | 弱引用 WeakReference | 虚引用 PhantomReference |
|---|---|---|---|---|
| Java 中典型写法 | `Object obj = new Object()` | `new SoftReference<>(obj)` | `new WeakReference<>(obj)` | `new PhantomReference<>(obj, queue)` |
| 对 GC 的约束 | 最强，只要强可达就不能回收 | 内存紧张时可被清理 | GC 发现仅弱可达后即可清理 | 对象已接近最终回收阶段，不能通过引用取回对象 |
| `get()` 是否能拿到对象 | 可以 | 可以，直到被清理 | 可以，直到被清理 | **永远返回 `null`** |
| 什么时候可能被清理 | 仍然强可达时通常不会 | 由 GC 根据内存需求决定 | GC 发现仅弱可达时处理 | GC 判断对象已经 phantom reachable 后处理 |
| 典型用途 | 普通业务对象、核心状态 | 对内存敏感的缓存 | 规范化映射、缓存辅助结构、避免强绑定 | 生命周期结束后的清理通知、`Cleaner` 底层机制相关场景 |
| 是否应该依赖它做业务正确性 | 可以作为业务对象正常持有 | **不应依赖其一定存在** | **不应依赖其一定存在** | **不能把它当作对象访问手段** |
| 是否经常与 `ReferenceQueue` 配合 | 一般不涉及 | 可以 | 很常见 | **通常需要** |
| 是否适合 ThreadLocal key | 否 | 通常否 | **是，ThreadLocalMap 就采用这种思路** | 否 |

官方文档指出：软引用主要用于内存敏感型缓存；弱引用不会阻止 referent 被回收；虚引用的 referent 不可通过 `get()` 获取，并通常配合 `ReferenceQueue` 用于对象回收后的处理。

### 7.3 强引用：最普通，也最容易理解

强引用就是我们平时最常写的引用：

```java
Object value = new Object();
```

只要 `value` 仍然可达：

```text
GC Root
  ↓
value
  ↓
Object
```

GC 就不能仅仅因为“内存紧张”把这个对象回收掉。

这也是为什么 ThreadLocal 的 `value` 必须高度重视生命周期：如果一个长期存活的线程持有一个很大的 value，那么这个 value 会因为 `ThreadLocalMap.Entry.value` 的**强引用**关系继续存活。

### 7.4 强引用源码解释

普通 Java 字段本质上就是强引用关系：

```java
class Holder {
    private Object value;

    void set(Object value) {
        this.value = value;
    }
}
```

`this.value = value` 建立的是普通对象引用，并没有经过 `java.lang.ref.Reference` 层。

从 ThreadLocal 的角度看，OpenJDK 中：

```java
static class Entry extends WeakReference<ThreadLocal<?>> {
    Object value;
}
```

这里恰好形成一个非常重要的组合：

```text
Entry
├── key   -> 弱引用
└── value -> 强引用
```

因此：

> **弱引用保护的是 ThreadLocal 对象本身，不是 ThreadLocal 保存的 value。**

### 7.5 强引用 Demo

```java
public class StrongReferenceDemo {

    public static void main(String[] args) {
        Object obj = new Object();

        System.out.println(obj != null); // true

        // 只要 obj 仍然指向对象，对象仍然有强引用。
        System.gc();

        System.out.println(obj != null); // 仍然是 true
    }
}
```

这里的关键并不是“`System.gc()` 不工作”，而是：

```text
对象仍然被 obj 强引用
        ↓
对象仍然是强可达
        ↓
GC 不应该因为普通回收而把它清掉
```

`System.gc()` 本身也不是“立即执行一次完整 GC”的强制命令，因此 Demo 不能把它理解为同步 GC API。

### 7.6 强引用测试 Demo

```java
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertNotNull;

class StrongReferenceDemoTest {

    @Test
    void strongReferenceKeepsObjectReachable() {
        Object obj = new Object();

        // 普通强引用：只要 obj 仍然存在，测试期间对象就在当前执行路径上保持可达。
        assertNotNull(obj);
    }
}
```

这个测试验证的是“强引用的程序语义”，而不是验证 GC 实现细节。

### 7.7 软引用：内存敏感型缓存

软引用的定位非常明确：

> **对象没有强引用后，GC 可以根据内存压力决定何时清理它。**

官方 Java API 明确指出，SoftReference 最常见的用途是 memory-sensitive caches（对内存敏感的缓存）。软引用什么时候被清理、不同对象之间的清理顺序，并没有保证一个可以让业务代码依赖的精确时点。

因此不应该写成：

```java
// 错误的心理预期：
// “SoftReference 一定能帮我缓存一段时间，所以对象一定在。”
```

正确理解应该是：

```text
有强引用
   ↓
一定不能仅凭“软引用策略”把对象回收

没有强引用
   ↓
对象变成软可达
   ↓
GC 根据内存需求决定是否清理
```

### 7.8 软引用源码解释

API 层面的核心关系：

```java
SoftReference<T> ref = new SoftReference<>(value);
T current = ref.get();
```

当 referent 还没有被清理时：

```java
ref.get() != null
```

被清理后：

```java
ref.get() == null
```

官方文档明确说明，软引用会在 GC 需要响应内存需求时由 GC 决定清除。（参考：[SoftReference API](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/lang/ref/SoftReference.html)）

### 7.9 软引用 Demo

```java
import java.lang.ref.SoftReference;

public class SoftReferenceDemo {

    public static void main(String[] args) {
        byte[] data = new byte[1024 * 1024];

        SoftReference<byte[]> ref = new SoftReference<>(data);

        // 仍然存在强引用 data，所以软引用不会成为唯一引用。
        System.out.println(ref.get() != null); // true

        data = null;

        // 这时对象只剩软引用可达。
        // 是否马上被清理，由 GC 根据内存需求决定。
        System.out.println(ref.get() != null);
    }
}
```

### 7.10 软引用测试 Demo

软引用最不适合写“必须经过 GC 后就一定变成 null”的单元测试，因为清理时机由 GC 决定。

因此测试时，建议验证确定性 API 语义，例如 `clear()`：

```java
import org.junit.jupiter.api.Test;

import java.lang.ref.SoftReference;

import static org.junit.jupiter.api.Assertions.*;

class SoftReferenceDemoTest {

    @Test
    void clearShouldMakeSoftReferenceReturnNull() {
        Object value = new Object();
        SoftReference<Object> ref = new SoftReference<>(value);

        assertSame(value, ref.get());

        ref.clear();

        assertNull(ref.get());
    }
}
```

这类测试稳定、可重复，并且不会把 JVM 的 GC 调度当成测试条件。

### 7.11 弱引用：对象一旦只剩弱可达，GC 就可以处理它

弱引用比软引用更弱。

官方文档定义：当对象既不是强可达，也不是软可达，而是仅通过弱引用到达时，它属于 weakly reachable；GC 可以在这一阶段原子性清除相关弱引用，并把注册到 `ReferenceQueue` 的引用加入队列。

可以把它简化理解成：

```text
强引用还存在
    ↓
不会因为 WeakReference 本身而被提前回收

强引用消失
    ↓
对象只剩 WeakReference
    ↓
对象进入 weakly reachable
    ↓
GC 可以清除弱引用
    ↓
WeakReference.get() == null
```

注意：

> **弱引用不是“GC 后 100% 立即变 null”的同步工具；它描述的是 GC 可处理该对象的可达性语义。**

### 7.12 弱引用源码解释

典型代码：

```java
WeakReference<Object> ref = new WeakReference<>(value);
```

它不会像普通字段那样建立一条“必须让 referent 活着”的强引用关系。

更重要的是，`Reference.get()` 在 referent 被清理后会返回 `null`；官方 API 也明确说明这一点。

这正是 ThreadLocalMap 选择弱引用 key 的基础。

### 7.13 弱引用 Demo：结合 ReferenceQueue 观察清理

```java
import java.lang.ref.ReferenceQueue;
import java.lang.ref.WeakReference;

public class WeakReferenceDemo {

    public static void main(String[] args) throws InterruptedException {
        ReferenceQueue<Object> queue = new ReferenceQueue<>();

        Object value = new Object();
        WeakReference<Object> ref = new WeakReference<>(value, queue);

        System.out.println("初始 get = " + (ref.get() != null));

        value = null;

        // GC 触发与处理时机由 JVM 决定，因此这里仅作为观察型 Demo。
        System.gc();

        for (int i = 0; i < 100 && ref.get() != null; i++) {
            Thread.sleep(10);
            System.gc();
        }

        System.out.println("清理后 get = " + (ref.get() != null));
        System.out.println("queue.poll = " + queue.poll());
    }
}
```

这个 Demo 不应该被当作“GC 一定会在第 N 次循环完成”的严格测试。它的价值在于观察：

```text
WeakReference.get()
ReferenceQueue.poll()
```

之间的关系。

### 7.14 弱引用测试 Demo：使用 clear 保证确定性

单元测试不要依赖真实 GC，可以这样：

```java
import org.junit.jupiter.api.Test;

import java.lang.ref.ReferenceQueue;
import java.lang.ref.WeakReference;

import static org.junit.jupiter.api.Assertions.*;

class WeakReferenceDemoTest {

    @Test
    void clearShouldClearWeakReference() {
        ReferenceQueue<Object> queue = new ReferenceQueue<>();
        Object value = new Object();

        WeakReference<Object> ref = new WeakReference<>(value, queue);

        assertSame(value, ref.get());

        ref.clear();

        assertNull(ref.get());
    }

    @Test
    void manuallyEnqueueShouldBeObservableFromQueue() {
        ReferenceQueue<Object> queue = new ReferenceQueue<>();
        Object value = new Object();

        WeakReference<Object> ref = new WeakReference<>(value, queue);

        assertTrue(ref.enqueue());
        assertSame(ref, queue.poll());
        assertNull(ref.get());
    }
}
```

### 7.15 虚引用：不是为了“拿对象”，而是为了感知对象接近回收后的阶段

虚引用是四类引用中最容易被误解的一种。

核心特点：

```java
PhantomReference<T>.get() == null
```

无论 referent 是否已经被清理，应用程序都不能通过 `get()` 把对象重新拿出来。Java SE API 明确规定虚引用的 `get()` 永远返回 `null`。（参考：[PhantomReference API](https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/lang/ref/PhantomReference.html)）

它通常需要一个 `ReferenceQueue`：

```text
对象
 ↓
phantom reachable
 ↓
GC 处理
 ↓
PhantomReference 入队
 ↓
后台线程从 ReferenceQueue 取出
 ↓
执行相应的清理/登记逻辑
```

### 7.16 虚引用源码解释

OpenJDK 当前实现中，`PhantomReference#get()` 的实现就是：

```java
public T get() {
    return null;
}
```

这并不是“实现偷懒”，而是虚引用的设计契约：不允许应用程序从 phantom reference 中重新取得 referent。OpenJDK 源码和 Java SE API 都明确体现了这一点。

### 7.17 虚引用 Demo

```java
import java.lang.ref.PhantomReference;
import java.lang.ref.ReferenceQueue;

public class PhantomReferenceDemo {

    public static void main(String[] args) {
        ReferenceQueue<Object> queue = new ReferenceQueue<>();
        Object value = new Object();

        PhantomReference<Object> ref =
                new PhantomReference<>(value, queue);

        // 虚引用不能通过 get() 取得 referent。
        System.out.println(ref.get()); // null

        // 为了演示队列机制，这里手动入队。
        ref.enqueue();

        System.out.println(queue.poll() == ref); // true
        System.out.println(ref.get());            // null
    }
}
```

真实 GC 场景下的入队时机由 JVM/GC 决定；手动 `enqueue()` 只是为了写一个稳定、可重复的 API Demo。

### 7.18 虚引用测试 Demo

```java
import org.junit.jupiter.api.Test;

import java.lang.ref.PhantomReference;
import java.lang.ref.ReferenceQueue;

import static org.junit.jupiter.api.Assertions.*;

class PhantomReferenceDemoTest {

    @Test
    void getShouldAlwaysReturnNull() {
        ReferenceQueue<Object> queue = new ReferenceQueue<>();
        Object value = new Object();

        PhantomReference<Object> ref =
                new PhantomReference<>(value, queue);

        assertNull(ref.get());
    }

    @Test
    void enqueueCanBeObservedFromReferenceQueue() {
        ReferenceQueue<Object> queue = new ReferenceQueue<>();
        Object value = new Object();

        PhantomReference<Object> ref =
                new PhantomReference<>(value, queue);

        assertTrue(ref.enqueue());
        assertSame(ref, queue.poll());
        assertNull(ref.get());
    }
}
```

### 7.19 ReferenceQueue 到底解决什么问题？

`ReferenceQueue` 本身不是另一种引用，它更像一个“通知队列”。

当 GC 根据对应引用类型处理 referent 后，如果这个 reference 注册了 `ReferenceQueue`，GC 可以把 reference 对象放入队列，应用程序随后通过：

```java
Reference<?> ref = queue.poll();
```

获取已处理的 reference。

Java SE 25 的 `ReferenceQueue` 文档明确说明：GC 检测到适当的可达性变化后，会把已经注册的 reference object 放入队列；`poll()` 可以取出这些 reference。

可以把关系画成：

```text
Referent Object
      │
      │ 被 Soft/Weak/Phantom Reference 观察
      ▼
    GC/引用处理
      │
      ▼
ReferenceQueue
      │
      ▼
Application cleanup / bookkeeping
```

### 7.20 四种引用和 ThreadLocal 的真正关系

理解到这里，就可以重新看 ThreadLocalMap：

```java
static class Entry extends WeakReference<ThreadLocal<?>> {
    Object value;

    Entry(ThreadLocal<?> k, Object v) {
        super(k);
        value = v;
    }
}
```

于是内存关系变成：

```text
Thread
  │
  ▼
ThreadLocalMap
  │
  ▼
Entry
├───────────────┐
│               │
│ key           │ value
│ WeakReference │ Strong Reference
│      │        │      │
│      ▼        │      ▼
│ ThreadLocal   │ 业务对象 / Context
```

这是理解 ThreadLocal 内存风险最重要的图。

### 7.21 为什么 ThreadLocal key 适合弱引用，而 value 不是弱引用？

设计目标不同：

```text
key = ThreadLocal
→ 更像“注册这个线程局部槽位的句柄”
→ ThreadLocal 本身不应该仅仅因为 ThreadLocalMap 长期存在而永久存活

value = 业务数据
→ 在 ThreadLocal 生命周期内必须可以正常 get()
→ 因此 value 必须是普通强引用
```

如果 value 也采用弱引用，那么：

```text
ThreadLocal.set(context)
       ↓
没有其他强引用
       ↓
GC 可能直接清理 context
       ↓
下一次 get() 得到 null
```

这就破坏了 ThreadLocal“线程内保存状态”的核心语义。

因此 ThreadLocalMap 的设计实际上是：

> **弱化 key 的生命周期依赖，保留 value 在 Entry 中的强持有能力，再通过 remove 和惰性清理机制解决 stale value 问题。**

### 7.22 一个非常容易记错的结论

不要把下面四句话混为一谈：

```text
① WeakReference 是弱引用
② ThreadLocalMap 的 key 是弱引用
③ ThreadLocalMap 的 value 是强引用
④ ThreadLocal 使用弱引用 ≠ ThreadLocal 不会内存泄漏
```

真正完整的链路是：

```text
ThreadLocal key
     │
     ▼
WeakReference<ThreadLocal<?>>
     │
     └── ThreadLocal 被 GC 后 → key 变成 null/stale
                                  │
                                  ▼
                         Entry 仍然存在
                                  │
                                  ▼
                           value 仍然强引用
                                  │
                                  ▼
                         value 可能继续存活
```

所以：

> **弱引用降低了 ThreadLocal key 导致的长期存活风险，但没有替你清理 value。**

这也是下一章 ThreadLocal `remove()` 原因的理论基础。

### 7.23 四种引用的记忆口诀

可以用一个非常实用的方式记忆：

```text
强：我自己还握着，你别回收

软：我没有强留着，内存紧张了可以丢

弱：我没有强、软留着，GC 处理时可以丢

虚：我连对象都不给你拿，主要通过队列感知回收阶段
```

再对应典型用途：

```text
StrongReference
    → 正常业务对象

SoftReference
    → 内存敏感缓存（是否使用还要结合现代缓存实现评估）

WeakReference
    → ThreadLocal key、弱键映射等

PhantomReference
    → 回收阶段通知 / 清理协调
```

### 7.24 一组统一的测试示例

下面的测试把四种引用的“确定性 API 行为”放在一起，便于做实验：

```java
import org.junit.jupiter.api.Test;

import java.lang.ref.PhantomReference;
import java.lang.ref.ReferenceQueue;
import java.lang.ref.SoftReference;
import java.lang.ref.WeakReference;

import static org.junit.jupiter.api.Assertions.*;

class ReferenceTypesDemoTest {

    @Test
    void strongReferenceCanReadObjectDirectly() {
        Object value = new Object();
        assertNotNull(value);
    }

    @Test
    void softReferenceCanReadObjectUntilCleared() {
        Object value = new Object();
        SoftReference<Object> ref = new SoftReference<>(value);

        assertSame(value, ref.get());

        ref.clear();
        assertNull(ref.get());
    }

    @Test
    void weakReferenceCanBeCleared() {
        Object value = new Object();
        WeakReference<Object> ref = new WeakReference<>(value);

        assertSame(value, ref.get());

        ref.clear();
        assertNull(ref.get());
    }

    @Test
    void phantomReferenceNeverExposesReferent() {
        ReferenceQueue<Object> queue = new ReferenceQueue<>();
        Object value = new Object();
        PhantomReference<Object> ref =
                new PhantomReference<>(value, queue);

        assertNull(ref.get());

        assertTrue(ref.enqueue());
        assertSame(ref, queue.poll());
    }
}
```

### 7.25 生产代码中的引用类型选择建议

可以按这个决策模型理解：

```text
你需要正常持有业务对象吗？
        │
        └── 是 → 强引用

你是在做“内存敏感型缓存”吗？
        │
        └── 是 → 才考虑 SoftReference，并先确认业务是否真的需要引用语义

你希望某个辅助结构不要强行延长 key/object 生命周期吗？
        │
        └── 是 → 考虑 WeakReference

你关注的是“对象已经接近回收之后”的通知/清理协调吗？
        │
        └── 是 → 考虑 PhantomReference + ReferenceQueue / Cleaner
```

不要为了“看起来高级”而主动把业务对象改成软/弱/虚引用。引用类型应该服务于生命周期语义，而不是作为普通内存优化开关。

### 7.26 本章和 ThreadLocal 的最终连接

前面 ThreadLocal 的弱引用问题，现在可以完整串起来：

```text
ThreadLocalMap.Entry
        │
        ├── key = WeakReference<ThreadLocal<?>>
        │              │
        │              └── ThreadLocal 不再被强引用后，可进入 GC 处理流程
        │
        └── value = Object 强引用
                       │
                       └── 如果 Entry 尚未被清理，value 仍可能继续存活

                    ↓

             remove() 的价值
                    ↓
          直接把 Entry / value 清掉
                    ↓
             生命周期彻底结束
```

所以理解四种引用，不是为了单独背 Java API，而是为了回答 ThreadLocal 最关键的问题：

> **为什么 key 用弱引用仍然需要 `remove()`？**

答案就是：

> **因为弱引用解决的是 key 的生命周期问题，而 `remove()` 解决的是 Entry/value 的生命周期问题。**

---


## 8、总结

### 8.1 一句话理解 ThreadLocal

> **ThreadLocal 是一个“访问入口”，真正的数据存储在当前 Thread 的 ThreadLocalMap 中，因此同一个 ThreadLocal 在不同线程中对应不同 value。**

### 8.2 一定要记住的底层关系

```text
ThreadLocal
   ↓
Thread
   ↓
ThreadLocalMap
   ↓
Entry
   ├── WeakReference<ThreadLocal<?>> key
   └── Object value
```

### 8.3 一定要理解弱引用的真正目的

不是：

```text
“用了弱引用，所以不会泄漏”
```

而是：

```text
“弱引用让 ThreadLocal key 在失去外部引用后具备被 GC 的可能，
然后 ThreadLocalMap 在后续操作中清理 stale entry。”
```

### 8.4 null key 的真正含义

这里的 `null key` 通常指：

```text
ThreadLocal 被 GC
       ↓
Entry.get()/refersTo() == null
       ↓
stale entry
```

不是：

```java
threadLocal.set(null);
```

### 8.5 为什么必须 remove

因为：

```text
ThreadLocalMap 的 value 是强引用
```

线程池中的线程又长期存活，所以：

```text
不 remove
   ↓
value 可能长期挂在线程上
   ↓
造成内存占用
   ↓
甚至造成数据串任务
```

因此最可靠的模板就是：

```java
try {
    THREAD_LOCAL.set(value);
    // do business
} finally {
    THREAD_LOCAL.remove();
}
```

### 8.6 ThreadLocal 最适合什么

可以用下面的判断快速判断：

```text
这个数据是不是“线程本地状态”？
        │
        ├── 是
        │    ↓
        │  ThreadLocal 可以考虑
        │
        └── 不是
             ↓
           不要为了省参数强行使用 ThreadLocal
```

再进一步问：

```text
是不是为了“隐式向下传递上下文”？
        │
        ├── JDK 25+
        │    → 可以研究 ScopedValue
        │
        ├── 普通业务调用链
        │    → 优先考虑显式参数
        │
        └── 线程池异步
             → 优先考虑 Task Context / Context Propagation
```

### 8.7 线程池里的黄金法则

> **ThreadLocal 的生命周期必须绑定 Task，而不是绑定 Worker Thread。**

也就是：

```java
executor.submit(() -> {
    try {
        CONTEXT.set(context);
        business();
    } finally {
        CONTEXT.remove();
    }
});
```

### 8.8 最终建议

生产代码中使用 ThreadLocal，可以遵循以下原则：

```text
1. 优先确认是否真的需要 ThreadLocal
2. ThreadLocal 尽量设计成 private static final
3. 明确 value 的生命周期
4. set 与 remove 尽量成对出现
5. remove 放在 finally
6. 不要把 ThreadLocal 当全局变量
7. 在线程池中尤其要防止上下文串任务
8. 不要认为弱引用可以自动解决所有内存泄漏
9. 不要把 InheritableThreadLocal 当成线程池上下文传播方案
10. JDK 25+ 可评估 ScopedValue
11. 能显式传参数时，显式传递通常更透明、更容易测试
```

---

# 附录 A：推荐 Demo 工程结构

```text
threadlocal-demo/
├── pom.xml
├── src/
│   ├── main/
│   │   └── java/
│   │       ├── ThreadLocalDemo.java
│   │       ├── ThreadLocalMapInspectDemo.java
│   │       ├── WeakReferenceDemo.java
│   │       ├── ThreadLocalRemoveDemo.java
│   │       ├── ThreadPoolThreadLocalLeakDemo.java
│   │       └── ScopedValueDemo.java
│   └── test/
│       └── java/
│           ├── ThreadLocalDemoTest.java
│           ├── ThreadLocalRemoveTest.java
│           ├── RequestContextHolderTest.java
│           └── ThreadPoolThreadLocalTest.java
```

---

# 附录 B：Maven JUnit 5 配置

```xml
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0
                             https://maven.apache.org/xsd/maven-4.0.0.xsd">

    <modelVersion>4.0.0</modelVersion>

    <groupId>demo</groupId>
    <artifactId>threadlocal-demo</artifactId>
    <version>1.0-SNAPSHOT</version>

    <properties>
        <maven.compiler.source>17</maven.compiler.source>
        <maven.compiler.target>17</maven.compiler.target>
        <project.build.sourceEncoding>UTF-8</project.build.sourceEncoding>
        <junit.version>5.11.3</junit.version>
    </properties>

    <dependencies>
        <dependency>
            <groupId>org.junit.jupiter</groupId>
            <artifactId>junit-jupiter</artifactId>
            <version>${junit.version}</version>
            <scope>test</scope>
        </dependency>
    </dependencies>

    <build>
        <plugins>
            <plugin>
                <groupId>org.apache.maven.plugins</groupId>
                <artifactId>maven-surefire-plugin</artifactId>
                <version>3.5.2</version>
            </plugin>
        </plugins>
    </build>
</project>
```

> `ScopedValue` Demo 需要将编译和运行环境切换到 JDK 25，并将 Maven 编译版本调整为 25。

---

# 附录 C：源码阅读重点清单

阅读 OpenJDK `ThreadLocal.java` 时，建议重点看这些方法：

```text
ThreadLocal.get()
    ↓
getMap(Thread)
    ↓
ThreadLocalMap.getEntry()

ThreadLocal.set()
    ↓
ThreadLocalMap.set()

ThreadLocal.remove()
    ↓
ThreadLocalMap.remove()
    ↓
expungeStaleEntry()
    ↓
cleanSomeSlots()
    ↓
rehash()
```

尤其关注：

```text
Entry extends WeakReference<ThreadLocal<?>>
Entry.value
getEntryAfterMiss()
replaceStaleEntry()
expungeStaleEntry()
cleanSomeSlots()
rehash()
remove()
```

这些源码基本串起了 ThreadLocal 的：

```text
设计原因
↓
弱引用
↓
stale entry
↓
惰性清理
↓
remove
↓
线程池风险
```

---

# 参考资料

1. Oracle Java SE 25 `ThreadLocal` API  
   https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/lang/ThreadLocal.html

2. OpenJDK `ThreadLocal.java` 源码  
   https://github.com/openjdk/jdk/blob/master/src/java.base/share/classes/java/lang/ThreadLocal.java

3. Oracle Java SE 25 `Thread` API  
   https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/lang/Thread.html

4. Oracle Java SE 25 `ScopedValue` API  
   https://docs.oracle.com/en/java/javase/25/docs/api/java.base/java/lang/ScopedValue.html

5. Oracle JDK 25 Significant Changes  
   https://docs.oracle.com/en/java/javase/25/migrate/significant-changes-jdk-25.html

6. OpenJDK JEP 444：Virtual Threads  
   https://openjdk.org/jeps/444
