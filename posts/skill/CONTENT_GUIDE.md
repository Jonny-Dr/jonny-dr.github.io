# 技术文章分类规范

技术文章保留在 `posts/skill/md/` 中，文件名继续使用 `YYYY-MM-DD-标题.md`。不要因为分类而移动文章文件，以保持已有文章链接稳定。

每篇新文章在 Front Matter 中使用一个 `category` 作为主分类，并用 `tags` 补充具体主题：

```yaml
---
title: 文章标题
date: 2026-10-07
category: 缓存与中间件
tags: [Redis, 分布式锁, 高可用]
languages: [Java]
excerpt: 一句话说明文章解决的问题。
---
```

`categories` 是旧格式，生成器仍会兼容；新文章优先使用 `category`。`tags` 保持 2 到 5 个，使用已有名称，避免同义词分裂。

| 主分类 | 范围 | 常用标签示例 |
| --- | --- | --- |
| Java 与 JVM | Java 基础、并发、JVM、性能 | JUC、AQS、CAS、JMM、GC、IO |
| 数据库 | MySQL、SQL、分库分表 | MySQL、索引、主从复制、ShardingSphere |
| 缓存与中间件 | Redis、消息队列、缓存策略 | Redis、RocketMQ、RabbitMQ、分布式锁 |
| 分布式与微服务 | 服务治理、限流、通信与集群 | Spring Cloud、限流、WebSocket、微服务 |
| 架构与工程 | 系统设计、业务方案、工程治理 | 高可用、秒杀、设计模式、服务集成 |
| AI 工程 | RAG、智能体、模型与 AI 框架 | Spring AI、RAG、智能体、向量数据库 |
