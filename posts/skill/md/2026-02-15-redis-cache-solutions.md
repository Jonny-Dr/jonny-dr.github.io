---
title: Redis 缓存穿透/击穿/雪崩解决方案
date: 2026-02-15
categories: [缓存中间件, 性能优化]
languages: [Java, Redis]
excerpt: 深入分析Redis缓存的三大常见问题：缓存穿透、缓存击穿和缓存雪崩，并提供完整的解决方案和代码实现。
---

# Redis 缓存穿透/击穿/雪崩解决方案

## 问题背景

在高并发系统中，缓存是提升性能的关键组件，但同时也会面临各种缓存相关的问题。Redis作为最常用的缓存中间件，在使用过程中经常遇到以下三大问题：

1. **缓存穿透**：请求不存在的数据，导致请求直接穿透到数据库
2. **缓存击穿**：热点数据过期，导致大量请求同时穿透到数据库
3. **缓存雪崩**：大量缓存同时过期，导致数据库压力骤增

本文将深入分析这些问题的原因，并提供完整的解决方案。

## 缓存穿透

### 问题分析

缓存穿透是指用户请求的数据在缓存中不存在，且在数据库中也不存在，导致请求每次都会穿透缓存直接访问数据库。如果恶意攻击者大量发送这样的请求，会导致数据库压力过大，甚至崩溃。

### 解决方案

#### 1. 布隆过滤器

布隆过滤器是一种空间效率很高的概率型数据结构，用于判断一个元素是否在一个集合中。我们可以使用布隆过滤器来过滤掉不存在的数据请求。

```java
// 使用Guava的布隆过滤器
import com.google.common.hash.BloomFilter;
import com.google.common.hash.Funnels;

// 初始化布隆过滤器
BloomFilter<Long> bloomFilter = BloomFilter.create(
    Funnels.longFunnel(),
    1000000, // 预计元素数量
    0.01     // 误判率
);

// 将数据库中的id加入布隆过滤器
for (Long id : getAllIdsFromDatabase()) {
    bloomFilter.put(id);
}

// 在查询前使用布隆过滤器判断
public String getProductById(Long id) {
    // 先通过布隆过滤器判断id是否存在
    if (!bloomFilter.mightContain(id)) {
        return "商品不存在";
    }
    
    // 从缓存查询
    String product = redisTemplate.opsForValue().get("product:" + id);
    if (product != null) {
        return product;
    }
    
    // 从数据库查询
    product = productService.getProductById(id);
    if (product != null) {
        // 放入缓存
        redisTemplate.opsForValue().set("product:" + id, product, 30, TimeUnit.MINUTES);
    } else {
        // 对于不存在的数据，也放入缓存，设置较短的过期时间
        redisTemplate.opsForValue().set("product:" + id, "", 5, TimeUnit.MINUTES);
    }
    return product;
}
```

#### 2. 缓存空对象

对于不存在的数据，我们也可以将其缓存起来，设置一个较短的过期时间，这样后续的相同请求就会被缓存拦截。

```java
public String getProductById(Long id) {
    // 从缓存查询
    String product = redisTemplate.opsForValue().get("product:" + id);
    if (product != null) {
        // 如果是空字符串，说明是之前缓存的不存在的数据
        return product.equals("") ? "商品不存在" : product;
    }
    
    // 从数据库查询
    product = productService.getProductById(id);
    if (product != null) {
        // 放入缓存
        redisTemplate.opsForValue().set("product:" + id, product, 30, TimeUnit.MINUTES);
    } else {
        // 对于不存在的数据，也放入缓存，设置较短的过期时间
        redisTemplate.opsForValue().set("product:" + id, "", 5, TimeUnit.MINUTES);
        product = "商品不存在";
    }
    return product;
}
```

## 缓存击穿

### 问题分析

缓存击穿是指一个热点数据过期时，正好有大量请求同时访问该数据，导致所有请求都穿透到数据库，造成数据库瞬间压力过大。

### 解决方案

#### 1. 设置热点数据永不过期

对于特别热点的数据，我们可以设置其在缓存中永不过期，然后通过后台任务定期更新。

```java
// 设置热点数据永不过期
redisTemplate.opsForValue().set("hot:product:" + id, product);

// 后台任务定期更新
@Scheduled(fixedRate = 60000) // 每分钟执行一次
public void updateHotProducts() {
    List<Product> hotProducts = productService.getHotProducts();
    for (Product product : hotProducts) {
        redisTemplate.opsForValue().set("hot:product:" + product.getId(), product);
    }
}
```

#### 2. 使用互斥锁

当缓存过期时，只允许一个线程去数据库查询并更新缓存，其他线程等待。

```java
public String getProductById(Long id) {
    // 从缓存查询
    String product = redisTemplate.opsForValue().get("product:" + id);
    if (product != null) {
        return product;
    }
    
    // 缓存不存在，尝试获取锁
    String lockKey = "lock:product:" + id;
    Boolean locked = redisTemplate.opsForValue().setIfAbsent(lockKey, "1", 3, TimeUnit.SECONDS);
    
    if (locked != null && locked) {
        try {
            // 再次检查缓存，防止其他线程已经更新
            product = redisTemplate.opsForValue().get("product:" + id);
            if (product != null) {
                return product;
            }
            
            // 从数据库查询
            product = productService.getProductById(id);
            if (product != null) {
                // 放入缓存
                redisTemplate.opsForValue().set("product:" + id, product, 30, TimeUnit.MINUTES);
            }
        } finally {
            // 释放锁
            redisTemplate.delete(lockKey);
        }
    } else {
        // 其他线程正在更新缓存，等待一段时间后重试
        try {
            Thread.sleep(50);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
        // 重试
        return getProductById(id);
    }
    
    return product;
}
```

## 缓存雪崩

### 问题分析

缓存雪崩是指大量缓存数据在同一时间过期，导致大量请求同时穿透到数据库，造成数据库压力骤增，甚至崩溃。

### 解决方案

#### 1. 设置随机过期时间

为缓存设置随机的过期时间，避免大量缓存同时过期。

```java
// 设置随机过期时间
int expireTime = 30 + new Random().nextInt(60); // 30-90分钟
redisTemplate.opsForValue().set("product:" + id, product, expireTime, TimeUnit.MINUTES);
```

#### 2. 分层缓存策略

使用多层缓存，不同层级的缓存设置不同的过期时间。

```java
// 本地缓存（Caffeine）
private Cache<Long, String> localCache = Caffeine.newBuilder()
    .expireAfterWrite(5, TimeUnit.MINUTES)
    .maximumSize(1000)
    .build();

public String getProductById(Long id) {
    // 先从本地缓存查询
    String product = localCache.getIfPresent(id);
    if (product != null) {
        return product;
    }
    
    // 从Redis缓存查询
    product = redisTemplate.opsForValue().get("product:" + id);
    if (product != null) {
        // 更新本地缓存
        localCache.put(id, product);
        return product;
    }
    
    // 从数据库查询
    product = productService.getProductById(id);
    if (product != null) {
        // 设置Redis缓存，随机过期时间
        int expireTime = 30 + new Random().nextInt(60);
        redisTemplate.opsForValue().set("product:" + id, product, expireTime, TimeUnit.MINUTES);
        // 更新本地缓存
        localCache.put(id, product);
    }
    
    return product;
}
```

#### 3. 缓存预热

在系统启动时，主动将热点数据加载到缓存中。

```java
// 系统启动时预热缓存
@PostConstruct
public void warmupCache() {
    List<Product> hotProducts = productService.getHotProducts();
    for (Product product : hotProducts) {
        int expireTime = 30 + new Random().nextInt(60);
        redisTemplate.opsForValue().set("product:" + product.getId(), product, expireTime, TimeUnit.MINUTES);
    }
    System.out.println("缓存预热完成，共加载" + hotProducts.size() + "个热点商品");
}
```

#### 4. 降级与限流

当缓存失效时，使用降级策略，返回默认值或缓存快照，同时对数据库访问进行限流。

```java
// 使用Sentinel进行限流
@SentinelResource(value = "getProduct", fallback = "fallbackGetProduct")
public String getProductById(Long id) {
    // 缓存查询逻辑
    // ...
}

public String fallbackGetProduct(Long id) {
    // 返回缓存快照或默认值
    return getProductSnapshot(id);
}
```

## 代码优化建议

### 1. 使用RedisTemplate的最佳实践

```java
// 正确使用RedisTemplate
@Configuration
public class RedisConfig {
    @Bean
    public RedisTemplate<String, Object> redisTemplate(RedisConnectionFactory factory) {
        RedisTemplate<String, Object> template = new RedisTemplate<>();
        template.setConnectionFactory(factory);
        
        // 设置键的序列化方式
        template.setKeySerializer(new StringRedisSerializer());
        // 设置值的序列化方式
        template.setValueSerializer(new Jackson2JsonRedisSerializer<>(Object.class));
        
        template.afterPropertiesSet();
        return template;
    }
}
```

### 2. 使用Redis Pipeline提升性能

对于批量操作，使用Pipeline可以显著提升性能。

```java
// 使用Pipeline批量设置缓存
public void batchSetProducts(List<Product> products) {
    redisTemplate.executePipelined((RedisCallback<Object>) connection -> {
        StringRedisConnection stringRedisConnection = (StringRedisConnection) connection;
        for (Product product : products) {
            int expireTime = 30 + new Random().nextInt(60);
            stringRedisConnection.setEx(
                "product:" + product.getId(),
                expireTime * 60, // 转换为秒
                JSON.toJSONString(product)
            );
        }
        return null;
    });
}
```

### 3. 监控缓存命中率

定期监控缓存的命中率，及时发现问题。

```java
// 缓存监控
@Component
public class CacheMonitor {
    private AtomicLong totalRequests = new AtomicLong(0);
    private AtomicLong cacheHits = new AtomicLong(0);
    
    public void recordRequest() {
        totalRequests.incrementAndGet();
    }
    
    public void recordHit() {
        cacheHits.incrementAndGet();
    }
    
    @Scheduled(fixedRate = 60000) // 每分钟打印一次
    public void printStats() {
        long total = totalRequests.get();
        long hits = cacheHits.get();
        double hitRate = total > 0 ? (double) hits / total : 0;
        System.out.println("缓存命中率: " + String.format("%.2f%%", hitRate * 100));
        
        // 重置计数器
        totalRequests.set(0);
        cacheHits.set(0);
    }
}
```

## 总结

通过本文的分析和解决方案，我们可以有效地应对Redis缓存的三大问题：

| 问题 | 原因 | 解决方案 |
|------|------|----------|
| 缓存穿透 | 请求不存在的数据 | 布隆过滤器 + 缓存空对象 |
| 缓存击穿 | 热点数据过期 | 永不过期 + 互斥锁 |
| 缓存雪崩 | 大量缓存同时过期 | 随机过期时间 + 分层缓存 + 缓存预热 |

在实际应用中，我们应该根据具体的业务场景选择合适的解决方案，甚至组合使用多种方案，以达到最佳的缓存效果。

同时，我们还应该建立完善的缓存监控机制，及时发现和解决缓存相关的问题，确保系统的稳定运行。