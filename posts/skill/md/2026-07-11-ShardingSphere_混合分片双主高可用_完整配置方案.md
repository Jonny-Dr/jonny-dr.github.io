---
title: ShardingSphere
date: 2026-07-11
categories: [分库分表, 性能优化]
languages: [Java, ShardingSphere]
excerpt: 深入分析ShardingSphere分片流程。以及单表分库的实现
---

# ShardingSphere 混合分片 + 双主高可用 完整配置方案

## 一、方案概述

### 适用场景

- 现有业务库 `dev1`（双主高可用架构），假设一共20张表。
- 仅 `t_order`、`t_order_item` 2 张表需实现分库分表，其余 18 张表保持单库原逻辑运行。
- 技术栈：Spring Boot + ShardingSphere-JDBC 5.5.0 + MyBatis + MySQL 8.0。

### 核心设计

1.  **混合路由**: 未配置分片规则的表，自动路由到默认双主库 `dev1`，业务代码零改动。
2.  **分片规则**: 2 个分片库 (`ds0` / `ds1`)，每个库 10 张分表，总计 20 张物理分片表。
3.  **高可用保障**: `dev1` 原生双主故障转移，单节点宕机自动切换，分片逻辑完全无感知。

## 二、前置准备 (MySQL 侧)

### 2.1 dev1 双主库基础配置

#### 双主自增主键防冲突

分别在两个主库执行，避免主备切换时出现主键冲突：

```sql
-- 主库1 (localhost1) 执行
SET GLOBAL auto_increment_offset = 1;
SET GLOBAL auto_increment_increment = 2;

-- 主库2 (localhost2) 执行
SET GLOBAL auto_increment_offset = 2;
SET GLOBAL auto_increment_increment = 2;
```

#### 双主同步状态验证

两个节点分别执行，确认双向同步正常：

```sql
SHOW SLAVE STATUS\G
-- 需保证 Slave_IO_Running=Yes、 Slave_SQL_Running=Yes
```

### 2.2 分片库建库建表

创建 2 个分片库 `ds0`、`ds1`，每个库分别创建 10 张订单分表、10 张订单明细表。

#### 建库语句

```sql
CREATE DATABASE ds0 DEFAULT CHARACTER SET utf8mb4;
CREATE DATABASE ds1 DEFAULT CHARACTER SET utf8mb4;
```

#### 建表语句 (`ds0`、`ds1` 分别全量执行)

```sql
-- 订单分表 (0-9 共 10 张，表结构完全一致)
CREATE TABLE t_order_0 (
    order_id BIGINT PRIMARY KEY COMMENT '订单ID(雪花算法生成)',
    user_id BIGINT NOT NULL COMMENT '用户ID(分库键)',
    amount DECIMAL(10,2) NOT NULL COMMENT '订单金额',
    create_time DATETIME NOT NULL COMMENT '创建时间'
);
-- 重复创建 t_order_1 ~ t_order_9

-- 订单明细表 (0-9 共 10 张，表结构完全一致)
CREATE TABLE t_order_item_0 (
    item_id BIGINT PRIMARY KEY COMMENT '明细ID',
    order_id BIGINT NOT NULL COMMENT '订单ID(分表键)',
    user_id BIGINT NOT NULL COMMENT '用户ID(分库键)',
    goods_name VARCHAR(255) NOT NULL COMMENT '商品名称',
    quantity INT NOT NULL COMMENT '商品数量'
);
-- 重复创建 t_order_item_1 ~ t_order_item_9
```

## 三、完整配置文件 (`application.yml`)

```yaml
server:
  port: 8080

spring:
  shardingsphere:
    datasource:
      # 所有数据源名称: 默认双主库 dev1 + 2个分片库
      names: dev1, ds0, ds1

      # 1. 默认业务库 dev1 (双主高可用架构，所有普通表默认路由到此)
      dev1:
        type: com.zaxxer.hikari.HikariDataSource
        driver-class-name: com.mysql.cj.jdbc.Driver
        # 双主地址用逗号分隔，补充故障转移核心参数
        url: jdbc:mysql://localhost1:3306,localhost2:3306/dev1?useUnicode=true&characterEncoding=utf8&serverTimezone=GMT%2B8&useSSL=false&failOverReadOnly=false&autoReconnect=true&maxReconnects=3&initialTimeout=2
        username: root
        password: 你的MySQL密码
        # HikariCP连接池配置
        hikari:
          connection-timeout: 3000
          validation-timeout: 2000
          maximum-pool-size: 20
          connection-test-query: SELECT 1

      # 2. 分片库0
      ds0:
        type: com.zaxxer.hikari.HikariDataSource
        driver-class-name: com.mysql.cj.jdbc.Driver
        url: jdbc:mysql://localhost:3306/ds0?useUnicode=true&characterEncoding=utf8&serverTimezone=GMT%2B8&useSSL=false
        username: root
        password: 你的MySQL密码
        hikari:
          maximum-pool-size: 20

      # 3. 分片库1
      ds1:
        type: com.zaxxer.hikari.HikariDataSource
        driver-class-name: com.mysql.cj.jdbc.Driver
        url: jdbc:mysql://localhost:3306/ds1?useUnicode=true&characterEncoding=utf8&serverTimezone=GMT%2B8&useSSL=false
        username: root
        password: 你的MySQL密码
        hikari:
          maximum-pool-size: 20

    rules:
      sharding:
        # 核心配置: 默认数据源，所有未配置分片规则的表，自动路由到 dev1 双主库
        default-data-source-name: dev1

        # 分片表配置: 仅配置需要分库分表的 2 张表
        tables:
          # 订单表分片规则
          t_order:
            # 真实分片节点: 2库10表，共20个物理节点
            actual-data-nodes: ds$->{0..1}.t_order_$->{0..9}
            # 分库策略: 按 user_id 取模
            database-strategy:
              standard:
                sharding-column: user_id
                sharding-algorithm-name: database-mod
            # 分表策略: 按 order_id 取模
            table-strategy:
              standard:
                sharding-column: order_id
                sharding-algorithm-name: table-order-mod
            # 分布式主键: 雪花算法自动生成 order_id
            key-generate-strategy:
              column: order_id
              key-generator-name: snowflake

          # 订单明细表分片规则
          t_order_item:
            actual-data-nodes: ds$->{0..1}.t_order_item_$->{0..9}
            database-strategy:
              standard:
                sharding-column: user_id
                sharding-algorithm-name: database-mod
            table-strategy:
              standard:
                sharding-column: order_id
                sharding-algorithm-name: table-order-item-mod
            key-generate-strategy:
              column: item_id
              key-generator-name: snowflake

        # 分片算法定义
        sharding-algorithms:
          # 分库算法 (两张表共用): user_id 对 2 取模，路由到 ds0/ds1
          database-mod:
            type: INLINE
            props:
              algorithm-expression: ds$->{user_id % 2}

          # 订单表分表算法
          table-order-mod:
            type: INLINE
            props:
              algorithm-expression: t_order_$->{order_id % 10}

          # 订单明细表分表算法
          table-order-item-mod:
            type: INLINE
            props:
              algorithm-expression: t_order_item_$->{order_id % 10}

        # 分布式ID生成器
        key-generators:
          snowflake:
            type: SNOWFLAKE
            props:
              worker-id: 1  # 集群部署每个实例 worker-id 必须唯一

    props:
      sql-show: true  # 测试环境开启，打印路由详情；生产环境关闭

# MyBatis 基础配置
mybatis:
  configuration:
    map-underscore-to-camel-case: true  # 自动驼峰命名映射
```

## 四、核心配置说明

### 4.1 默认数据源机制

`default-data-source-name: dev1` 是混合分片架构的核心。

- 所有未在 `tables` 中声明分片规则的业务表，全部直接路由到 `dev1` 双主库。
- 业务代码无需任何修改，分片逻辑对普通表完全透明。

### 4.2 dev1 双主高可用参数说明

| URL 参数 | 作用 | 必要性 |
| :--- | :--- | :--- |
| 地址逗号分隔 | MySQL 驱动原生双主故障转移的标准格式 | 必须 |
| `failOverReadOnly=false` | 故障切换到备节点后，连接保持可写状态，避免写操作报只读错误 | 必须 |
| `autoReconnect=true` | 连接断开后自动重连备用节点 | 推荐 |
| `maxReconnects=3` | 最大重连次数，避免无限重试打爆数据库 | 推荐 |
| `initialTimeout=2` | 重连间隔时间 (秒) | 推荐 |

### 4.3 分片节点表达式说明

`ds$->{0..1}.t_order_$->{0..9}` 是 ShardingSphere 内置行表达式，自动生成所有物理分片节点：

- `ds$->{0..1}` 枚举生成 `ds0`、`ds1` 2 个库。
- `t_order_$->{0..9}` 枚举生成 `t_order_0` ~ `t_order_9` 10 张表。
- 自动做笛卡尔积，覆盖全部 20 个分片节点，无需手动枚举。

## 五、双主故障转移验证步骤

### 前置检查

1.  启动项目，调用普通表的增删改查接口，确认业务正常运行。
2.  确认双主同步正常，数据可双向同步无延迟。

### 验证步骤

1.  **模拟主库宕机**: 停止主库1 (`localhost1`) 的 MySQL 服务。
2.  **验证写操作**: 调用普通表新增接口，首次请求可能有短暂超时，后续自动恢复正常，说明已成功切换到主库2。
3.  **验证数据一致性**: 登录主库2，确认新写入的数据已正常落库。
4.  **主库恢复**: 重启主库1，等待双主同步追平数据；驱动默认不会自动回切，新连接会优先回到主库1。

## 六、注意事项与最佳实践

1.  **分片键携带要求**: 分片表的查询尽量携带分片键，不带分片键会触发全分片扫描，性能极差。
2.  **主键约束**: 分片表禁止使用 MySQL 自增主键，必须使用雪花算法等分布式 ID 方案。
3.  **跨表关联限制**: 避免普通表与分片表的跨库 JOIN 查询，建议业务层拆分查询。
4.  **事务边界**: 单库内事务原生支持；跨 `dev1` 与分片库的事务需集成分布式事务 (XA / Seata)。
5.  **表名唯一性**: `dev1` 库中不能存在与分片逻辑表同名的表，否则会优先匹配分片规则。
6.  **集群部署注意**: 多实例部署时，雪花算法的 `worker-id` 必须每个实例唯一，避免主键冲突。

## 七、可选扩展：主从读写分离方案

如果 `dev1` 是「一主多从、读多写少」场景，可替换为 ShardingSphere 原生读写分离规则，支持读负载均衡、事务读主保障，替换原有 `rules` 部分即可：

```yaml
rules:
  # 读写分离规则
  readwrite-splitting:
    data-sources:
      dev1:
        write-data-source-name: dev1-master
        read-data-source-names: dev1-slave1, dev1-slave2
        load-balancer-name: round_robin
    load-balancers:
      round_robin:
        type: ROUND_ROBIN

  # 分片规则保持不变，默认数据源引用读写分离逻辑名 dev1
  sharding:
    default-data-source-name: dev1
    # 其余分片配置保持不变
```

备注：

如果不需要分库，只需要实现读写分离的话，也可以使用该方法。

