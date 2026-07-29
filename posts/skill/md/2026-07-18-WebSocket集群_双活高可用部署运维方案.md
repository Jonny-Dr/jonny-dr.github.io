---
title: Websocket高可用解决方案
date: 2026-07-18
categories: [业务组件封装, 架构优化, 性能优化, 高可用]
languages: [Java, WebSocket, 微服务]
excerpt: 针对Java WebSocket单机本地SessionMap集群/双活失效问题!彻底解决两大核心痛点!
---

# WebSocket 集群/双活高可用部署运维方案

## 一、方案整体概述

***核心思路：Redis映射 + RocketMQ精准分发***

### 1\.1 解决的核心问题

针对Java WebSocket单机本地SessionMap集群/双活失效问题，彻底解决两大核心痛点：

- **集群路由错乱**：网关轮询负载均衡导致用户握手、消息请求落在不同节点，本地无连接、重复建连、资源浪费

- **跨节点消息无法推送**：业务服务任意节点触发推送，无法精准定位用户在线连接节点，造成消息丢失、错峰、重复推送

- **无故障转移能力**：单节点宕机，用户连接全部断开、消息中断，不支持双活容灾

### 1\.2 核心架构选型

采用**Redis全局连接映射 \+ RocketMQ精准消息分发 \+ 无粘性路由（兼容弹性扩容）\+ 前端自愈重连** 生产级架构，摒弃传统Nginx粘性路由的短板，支持节点弹性扩缩容、双机房双活、故障自动转移。

- **Redis**：存储用户长连接全局映射、会话元数据、离线消息缓存，实现全集群会话共享

- **RocketMQ**：实现跨节点精准消息投递、消息持久化、重试机制、有序推送，解决分布式WebSocket消息同步问题

- **业务服务**：多节点无状态部署，本地仅缓存临时WebSocket Session，不做全局会话存储

- **网关**：普通轮询/随机负载均衡，无需粘性会话，支持无感扩容

### 1\.3 架构优势（对比传统方案）

- 无网关粘性绑定，支持集群**无感扩容、缩容**，不会出现负载不均

- RocketMQ消息持久化，杜绝消息丢失，支持重试、幂等、离线补发

- 天然支持**多节点、双机房双活**，具备完整故障转移能力

- 彻底解决重复建连、资源占用、消息错峰问题

## 二、整体架构流程图

### 2\.1 核心架构层级

客户端 → Nginx负载 → 网关（轮询路由）→ WebSocket业务集群（多节点）→ Redis（会话映射）\+ RocketMQ（消息调度）

### 2\.2 核心流程拆解

1. **建连阶段**：客户端握手请求经网关路由至任意业务节点，节点完成WebSocket握手后，将「用户ID\-所在节点ID\-会话信息」写入Redis全局映射

2. **消息推送阶段**：任意业务节点接收推送请求，查询Redis获取用户在线节点，通过RocketMQ定向推送至目标节点，目标节点通过本地Session下发至客户端

3. **断连/故障阶段**：节点宕机/用户离线，Redis自动过期清理会话，前端触发自动重连，新节点接管连接，补发离线消息

## 三、核心数据设计（Redis存储规范）

所有全局会话数据统一存入Redis，本地Session仅作当前节点临时连接缓存，不具备全局权威性。

### 3\.1 Redis Key 设计规范

|Key名称|数据结构|过期时间|作用描述|
|---|---|---|---|
|ws:user:\{userId\}|String|90s（心跳续期）|存储用户当前在线节点ID、会话ID，核心路由映射|
|ws:node:\{nodeId\}:online|Set|永久（节点下线清空）|存储当前节点所有在线用户ID，用于节点运维、下线清算|
|ws:offline:\{userId\}|List|2h|存储用户离线期间未推送消息，重连后补发|
|ws:heartbeat:\{sessionId\}|String|90s|会话心跳兜底，超时自动判定离线|

### 3\.2 数据一致性规则

- 用户建连成功：写入`ws:user:{userId}`，新增至节点在线Set，初始化心跳Key

- 用户心跳上报：续期用户映射Key、心跳Key

- 用户主动断连：删除所有关联Key，清理节点在线列表

- 心跳超时：Redis自动过期，兜底判定离线，防止脏数据

## 四、RocketMQ消息模型设计（精准路由核心）

### 4\.1 主题与队列规划

采用**定点投递模式**，**摒弃广播模式**，实现精准推送到用户所在节点，避免无效消费。

- **全局推送主题**：ws\_push\_topic（统一接收所有WebSocket推送消息）

- **消息投递规则**：以「目标节点ID」为消息Tag，每个业务节点仅消费自身Tag的消息

- **重试机制**：开启RocketMQ重试队列，消息推送失败自动重试3次，失败后存入离线消息队列

### 4\.2 消息体标准格式

```json
{
  "msgId": "唯一消息ID（幂等key）",
  "userId": "目标用户ID",
  "targetNodeId": "目标推送节点ID",
  "msgType": "普通消息/系统通知/离线补发",
  "content": "消息内容",
  "createTime": "消息生成时间",
  "retryCount": "重试次数",
  "isOffline": "是否为离线补发消息"
}
```

### 4\.3 精准推送核心流程

1. 业务系统（任意节点）需要推送消息，传入目标用户ID

2. 查询Redis `ws:user:{userId}`，判断用户是否在线：
   
- 在线：获取用户所在**节点ID**，组装消息体，以节点ID为Tag发送至RocketMQ ws\_push\_topic
  
- 离线：将消息同步持久化，但是需要将消息标记为未读状态，以供后续消息待办业务作铺垫(同样可以支持消息队列异步操作)
  
3. 所有WebSocket节点监听ws\_push\_topic，仅消费**自身节点Tag**的消息

4. 消费成功后，通过本地WebSocket Session将消息下发至前端；消费失败进入重试队列

5. 前端接收消息后返回ACK，后端确认后清理冗余离线消息

## 五、核心代码落地实现（Java SpringBoot）

### 5\.1 节点ID全局配置

每个集群节点配置唯一NodeID，用于精准标识服务实例，推荐使用机器IP\+端口/服务实例UUID。

```yaml
# application.yml
ws:
  node-id: ${spring.cloud.client.ip-address}:${server.port}
  heartbeat-timeout: 90000
```

### 5\.2 WebSocket建连\&会话注册逻辑

```java
@Component
public class WsSessionHandler extends TextWebSocketHandler {

    @Value("${ws.node-id}")
    private String currentNodeId;

    @Autowired
    private RedisTemplate<String, String> redisTemplate;

    // 连接建立成功，注册全局会话
    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws Exception {
        // 从token/请求头解析用户ID
        String userId = getUserIdFromSession(session);
        String sessionId = session.getId();
        
        // 1. 写入用户-节点映射
        redisTemplate.opsForValue().set("ws:user:" + userId, currentNodeId, 90, TimeUnit.SECONDS);
        // 2. 加入当前节点在线用户列表
        redisTemplate.opsForSet().add("ws:node:" + currentNodeId + ":online", userId);
        // 3. 初始化心跳Key
        redisTemplate.opsForValue().set("ws:heartbeat:" + sessionId, userId, 90, TimeUnit.SECONDS);
        // 4. 本地缓存会话
        WsSessionLocalCache.put(userId, session);
    }

    // 连接关闭，清理全局会话
    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) throws Exception {
        String userId = getUserIdFromSession(session);
        String sessionId = session.getId();
        // 清理Redis数据
        redisTemplate.delete("ws:user:" + userId);
        redisTemplate.delete("ws:heartbeat:" + sessionId);
        redisTemplate.opsForSet().remove("ws:node:" + currentNodeId + ":online", userId);
        // 清理本地缓存
        WsSessionLocalCache.remove(userId);
    }
}
```

### 5\.3 心跳续期兜底逻辑

```java
// 前端每30s上报心跳，后端续期会话
public void heartbeat(String userId, String sessionId) {
    // 续期用户映射和心跳Key
    redisTemplate.expire("ws:user:" + userId, 90, TimeUnit.SECONDS);
    redisTemplate.expire("ws:heartbeat:" + sessionId, 90, TimeUnit.SECONDS);
}
```

### 5\.4 RocketMQ精准推送实现

```java
@Service
public class WsPushService {

    @Autowired
    private RocketMQTemplate rocketMQTemplate;

    @Autowired
    private RedisTemplate<String, String> redisTemplate;

    private static final String PUSH_TOPIC = "ws_push_topic";

    // 精准推送入口
    public void pushMessage(String userId, String content) {
        // 1. 查询用户在线节点
        String targetNodeId = redisTemplate.opsForValue().get("ws:user:" + userId);
        // 2. 用户离线，存入离线消息队列
        if (StringUtils.isEmpty(targetNodeId)) {
          	// 此处可以根据离线业务自定义处理
            redisTemplate.opsForList().rightPush("ws:offline:" + userId, content);
            redisTemplate.expire("ws:offline:" + userId, 2, TimeUnit.HOURS);
            return;
        }
        // 3. 组装消息体
        WsMessage message = new WsMessage();
        message.setMsgId(UUID.randomUUID().toString());
        message.setUserId(userId);
        message.setTargetNodeId(targetNodeId);
        message.setContent(content);
        message.setOffline(false);
        // 4. 按节点Tag精准投递
        rocketMQTemplate.syncSend(PUSH_TOPIC + ":" + targetNodeId, MessageBuilder.withPayload(message).build());
    }
}
```

### 5\.5 RocketMQ消费者监听（单节点精准消费）

```java
@RocketMQMessageListener(
        topic = "ws_push_topic",
        consumerGroup = "ws_push_consumer_group"
)
@Component
public class WsPushConsumer implements RocketMQListener<WsMessage> {

    @Value("${ws.node-id}")
    private String currentNodeId;

    @Autowired
    private WsSessionLocalCache sessionCache;

    @Override
    public void onMessage(WsMessage message) {
        // 只消费当前节点的消息，过滤其他节点消息
        if (!currentNodeId.equals(message.getTargetNodeId())) {
            return;
        }
        // 本地获取会话，下发消息
        WebSocketSession session = sessionCache.get(message.getUserId());
        if (session != null && session.isOpen()) {
            session.sendMessage(new TextMessage(message.getContent()));
        }
    }
}
```

## 六、多节点集群\&双活部署方案

### 6\.1 部署架构

采用**双机房双活架构**，机房A、机房B各部署一套完整服务，无主从区分，网关统一负载均衡，支持单机房故障整体容灾。

- 网关层：Spring Cloud Gateway/Nginx集群，轮询路由，无粘性会话

- 服务层：WebSocket业务服务多节点部署（至少2节点）

- 缓存层：Redis集群，跨机房同步，保障会话数据高可用

- 消息层：RocketMQ集群（NameServer\+Broker多节点），消息持久化存储

### 6\.2 扩缩容规范

- **扩容节点**：直接新增服务节点，接入集群即可，无需修改网关和中间件配置，新节点自动参与消息消费、连接承接

- **缩容/下线节点**：
  1. 网关先摘除待下线节点，停止新连接接入

    2. 查询Redis该节点在线用户列表，批量标记用户离线

    3. 前端检测断连后自动重连至存活节点

    4. 节点无在线用户后，正式下线销毁

## 七、故障转移机制（核心高可用能力）

### 7\.1 单节点宕机故障转移流程

1. **故障感知**：网关健康检测发现节点宕机，自动剔除集群列表，停止路由新请求

2. **会话失效**：宕机节点的用户心跳中断，90s后Redis会话Key自动过期，标记用户离线

3. **前端自愈**：前端监听WebSocket onclose事件，触发**指数退避重连**（1s、2s、4s、8s，最大30s）

4. **新节点接管**：重连请求被网关路由至健康节点，完成新握手，更新Redis用户映射

5. **消息补偿**：重连成功后，重新查询聊天记录即可。业务层面已完成补偿机制，另外提供消息未读提醒

6. **恢复正常**：后续所有消息通过新节点\+RocketMQ精准推送，业务无感知

### 7\.2 双机房容灾转移

- 单机房整体故障时，网关自动将全部流量切换至备用机房

- Redis跨机房同步，用户会话数据不丢失，消息队列数据持久化不丢失

- 前端统一重连至备用机房节点，快速恢复业务

## 八、运维监控\&兜底机制

### 8\.1 核心监控指标

- 在线用户数：单节点在线数、集群总在线数、各机房在线分布

- 连接状态：建连成功率、断连率、重连成功率

- 消息指标：消息推送成功率、重试次数、离线消息堆积量

- 中间件状态：Redis Key数量、过期率、RocketMQ消息堆积、消费延迟

### 8\.2 脏数据兜底清理

- 定时任务（1分钟）：遍历所有节点在线用户，校验Redis会话有效性，清理过期脏数据，同时清空本地失效的session避免内存溢出

- 节点重启自动清空本地残留会话，同步Redis全局状态


### 8\.3 消息幂等\&去重

- 基于消息唯一msgId做幂等控制，后端重复消费直接拦截

- 前端缓存已接收消息ID，避免重连后重复展示消息

## 九、方案优势总结

1. **彻底解决集群问题**：杜绝跨节点连接丢失、重复建连、消息错峰、资源浪费问题

2. **高可用故障转移**：支持单节点、单机房故障自动转移，用户无感知，消息不丢失

3. **弹性可扩展**：无网关粘性绑定，支持集群无感扩缩容，负载均衡均匀

4. **生产级可靠**：RocketMQ持久化\+重试机制、Redis会话兜底、离线消息补发、幂等去重

5. **支持双活部署**：天然适配多机房双活架构，满足企业级容灾需求

## 十、落地注意事项

- 禁止使用本地SessionMap做全局查询，所有路由、状态判断必须以Redis为准
- 心跳超时时间必须大于网络波动阈值，推荐90s，避免误判离线
- RocketMQ消费者必须做好Tag过滤，仅消费当前节点消息，避免消息乱推
- 双活部署需保证Redis跨机房同步延迟可控，避免读写不一致
- 前端必须实现指数退避重连，避免故障瞬间大量请求打垮网关
- 定时任务清理失效session，避免内存溢出（必要）

