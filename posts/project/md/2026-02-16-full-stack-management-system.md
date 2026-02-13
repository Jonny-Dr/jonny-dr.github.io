---
title: 前后端分离管理系统实战
slug: full-stack-management-system
date: 2026-02-16
categories: [项目实战, 全栈开发]
languages: [Vue, Java, Spring Boot]
excerpt: 基于Vue 3 + Spring Boot的前后端分离管理系统完整实现，包括用户认证、权限管理、数据可视化等核心功能。
---

# 前后端分离管理系统实战

## 项目概述

本项目是一个基于Vue 3 + Spring Boot的前后端分离管理系统，旨在为企业提供一套完整的内部管理解决方案。系统实现了用户认证、权限管理、数据管理、数据可视化等核心功能，采用现代化的技术栈和架构设计，具有良好的可扩展性和维护性。

### 技术栈

| 分类 | 技术 | 版本 |
|------|------|------|
| 前端框架 | Vue | 3.3.4 |
| 构建工具 | Vite | 4.4.9 |
| 状态管理 | Pinia | 2.1.6 |
| UI框架 | Element Plus | 2.3.12 |
| 前端路由 | Vue Router | 4.2.4 |
| HTTP客户端 | Axios | 1.5.0 |
| 后端框架 | Spring Boot | 3.1.3 |
| 持久层框架 | MyBatis Plus | 3.5.3 |
| 数据库 | MySQL | 8.0 |
| 认证框架 | Spring Security | 6.1.3 |
| 缓存 | Redis | 7.0+ |
| 部署 | Docker | 20.10+ |

## 架构设计

### 目录结构

#### 前端项目结构

```
frontend/
├── public/              # 静态资源
├── src/
│   ├── api/             # API请求
│   ├── assets/          # 静态资源
│   ├── components/      # 公共组件
│   ├── views/           # 页面视图
│   ├── router/          # 路由配置
│   ├── store/           # 状态管理
│   ├── utils/           # 工具类
│   ├── constants/       # 常量定义
│   ├── App.vue          # 根组件
│   └── main.js          # 入口文件
├── .env.development     # 开发环境配置
├── .env.production      # 生产环境配置
├── vite.config.js       # Vite配置
├── package.json         # 依赖配置
└── index.html           # HTML模板
```

#### 后端项目结构

```
backend/
├── src/
│   ├── main/
│   │   ├── java/
│   │   │   └── com/
│   │   │       └── example/
│   │   │           ├── config/         # 配置类
│   │   │           ├── controller/      # 控制器
│   │   │           ├── dto/             # 数据传输对象
│   │   │           ├── entity/          # 实体类
│   │   │           ├── mapper/          # 数据访问层
│   │   │           ├── service/         # 业务逻辑层
│   │   │           ├── utils/           # 工具类
│   │   │           ├── security/        # 安全相关
│   │   │           └── Application.java # 应用入口
│   │   └── resources/
│   │       ├── mapper/                  # MyBatis映射文件
│   │       ├── application.yml          # 应用配置
│   │       └── application-dev.yml      # 开发环境配置
│   └── test/                            # 测试代码
├── pom.xml                              # Maven配置
└── Dockerfile                           # Docker构建文件
```

## 核心功能实现

### 1. 用户认证与授权

#### 前端实现

```vue
<!-- 登录组件 -->
<template>
  <div class="login-container">
    <el-form :model="loginForm" :rules="loginRules" ref="loginFormRef" label-width="80px">
      <el-form-item label="用户名" prop="username">
        <el-input v-model="loginForm.username" placeholder="请输入用户名" />
      </el-form-item>
      <el-form-item label="密码" prop="password">
        <el-input v-model="loginForm.password" type="password" placeholder="请输入密码" />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" @click="handleLogin" :loading="loading">登录</el-button>
      </el-form-item>
    </el-form>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '@/store/user'
import { ElMessage } from 'element-plus'

const router = useRouter()
const userStore = useUserStore()
const loginFormRef = ref()
const loading = ref(false)

const loginForm = reactive({
  username: '',
  password: ''
})

const loginRules = {
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }]
}

const handleLogin = async () => {
  if (!loginFormRef.value) return
  
  try {
    await loginFormRef.value.validate()
    loading.value = true
    
    const { username, password } = loginForm
    const result = await userStore.login({ username, password })
    
    if (result) {
      ElMessage.success('登录成功')
      router.push('/home')
    }
  } catch (error) {
    ElMessage.error(error.message || '登录失败')
  } finally {
    loading.value = false
  }
}
</script>
```

#### 后端实现

```java
// 登录控制器
@RestController
@RequestMapping("/api/auth")
public class AuthController {
    @Autowired
    private AuthService authService;
    
    @PostMapping("/login")
    public Result<?> login(@RequestBody LoginRequest request) {
        String token = authService.login(request.getUsername(), request.getPassword());
        return Result.success("登录成功", token);
    }
    
    @PostMapping("/logout")
    public Result<?> logout() {
        authService.logout();
        return Result.success("登出成功");
    }
}

// JWT认证过滤器
@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {
    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain) throws ServletException, IOException {
        // 实现JWT认证逻辑
    }
}
```

### 2. 权限管理

#### 前端实现

```javascript
// 路由权限控制
import { createRouter, createWebHistory } from 'vue-router'
import { useUserStore } from '@/store/user'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      redirect: '/login'
    },
    {
      path: '/login',
      component: () => import('@/views/Login.vue'),
      meta: { requiresAuth: false }
    },
    {
      path: '/home',
      component: () => import('@/views/Home.vue'),
      meta: { requiresAuth: true }
    },
    {
      path: '/user',
      component: () => import('@/views/user/Index.vue'),
      meta: { requiresAuth: true, roles: ['admin'] }
    }
  ]
})

// 路由守卫
router.beforeEach(async (to, from, next) => {
  const userStore = useUserStore()
  const requiresAuth = to.meta.requiresAuth !== false
  
  if (requiresAuth && !userStore.isLoggedIn) {
    next('/login')
  } else if (to.meta.roles && !to.meta.roles.includes(userStore.role)) {
    next('/403')
  } else {
    next()
  }
})
```

#### 后端实现

```java
// 权限注解
@Target({ ElementType.TYPE, ElementType.METHOD })
@Retention(RetentionPolicy.RUNTIME)
@Documented
@PreAuthorize("@permissionService.hasPermission(#permission)")
public @interface RequiresPermission {
    String value();
}

// 权限服务
@Service
public class PermissionService {
    public boolean hasPermission(String permission) {
        // 实现权限检查逻辑
    }
}

// 使用权限注解
@RestController
@RequestMapping("/api/user")
public class UserController {
    @RequiresPermission("user:list")
    @GetMapping("/list")
    public Result<?> list() {
        // 实现用户列表查询
    }
}
```

### 3. 数据可视化

#### 前端实现

```vue
<!-- 数据仪表盘 -->
<template>
  <div class="dashboard">
    <el-row :gutter="20">
      <el-col :span="8">
        <el-card shadow="hover">
          <template #header>
            <div class="card-header">
              <span>用户统计</span>
            </div>
          </template>
          <div class="stat-value">{{ userCount }}</div>
        </el-card>
      </el-col>
      <el-col :span="8">
        <el-card shadow="hover">
          <template #header>
            <div class="card-header">
              <span>订单统计</span>
            </div>
          </template>
          <div class="stat-value">{{ orderCount }}</div>
        </el-card>
      </el-col>
      <el-col :span="8">
        <el-card shadow="hover">
          <template #header>
            <div class="card-header">
              <span>销售额</span>
            </div>
          </template>
          <div class="stat-value">{{ salesAmount }}</div>
        </el-card>
      </el-col>
    </el-row>
    
    <!-- 图表 -->
    <el-row :gutter="20" style="margin-top: 20px">
      <el-col :span="12">
        <el-card shadow="hover">
          <template #header>
            <div class="card-header">
              <span>月度销售额</span>
            </div>
          </template>
          <div ref="salesChartRef" style="height: 300px"></div>
        </el-card>
      </el-col>
      <el-col :span="12">
        <el-card shadow="hover">
          <template #header>
            <div class="card-header">
              <span>用户增长</span>
            </div>
          </template>
          <div ref="userChartRef" style="height: 300px"></div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { ref, onMounted, reactive } from 'vue'
import * as echarts from 'echarts'
import { useDashboardStore } from '@/store/dashboard'

const dashboardStore = useDashboardStore()
const salesChartRef = ref()
const userChartRef = ref()
const userCount = ref(0)
const orderCount = ref(0)
const salesAmount = ref(0)

onMounted(async () => {
  await loadStats()
  initCharts()
})

const loadStats = async () => {
  const stats = await dashboardStore.getStats()
  userCount.value = stats.userCount
  orderCount.value = stats.orderCount
  salesAmount.value = stats.salesAmount
}

const initCharts = () => {
  // 初始化销售额图表
  const salesChart = echarts.init(salesChartRef.value)
  salesChart.setOption({
    xAxis: {
      type: 'category',
      data: ['1月', '2月', '3月', '4月', '5月', '6月']
    },
    yAxis: {
      type: 'value'
    },
    series: [{
      data: [120, 200, 150, 80, 70, 110],
      type: 'line'
    }]
  })
  
  // 初始化用户增长图表
  const userChart = echarts.init(userChartRef.value)
  userChart.setOption({
    xAxis: {
      type: 'category',
      data: ['1月', '2月', '3月', '4月', '5月', '6月']
    },
    yAxis: {
      type: 'value'
    },
    series: [{
      data: [1200, 1900, 3000, 4000, 4500, 5000],
      type: 'bar'
    }]
  })
  
  // 响应式调整
  window.addEventListener('resize', () => {
    salesChart.resize()
    userChart.resize()
  })
}
</script>
```

#### 后端实现

```java
// 数据统计服务
@Service
public class DashboardService {
    @Autowired
    private UserMapper userMapper;
    @Autowired
    private OrderMapper orderMapper;
    
    public DashboardStats getStats() {
        DashboardStats stats = new DashboardStats();
        
        // 获取用户数量
        stats.setUserCount(userMapper.selectCount(null));
        
        // 获取订单数量
        stats.setOrderCount(orderMapper.selectCount(null));
        
        // 获取销售额
        BigDecimal salesAmount = orderMapper.selectObjs(
            new QueryWrapper<Order>()
                .select("COALESCE(SUM(amount), 0) as total")
        ).stream()
         .findFirst()
         .map(o -> (BigDecimal) o)
         .orElse(BigDecimal.ZERO);
        stats.setSalesAmount(salesAmount);
        
        return stats;
    }
    
    public List<MonthlySales> getMonthlySales() {
        // 实现月度销售额统计
    }
}
```

### 3. 数据管理

#### 前端实现

```vue
<!-- 用户管理 -->
<template>
  <div class="user-management">
    <el-card>
      <template #header>
        <div class="card-header">
          <span>用户管理</span>
          <el-button type="primary" @click="handleAdd">添加用户</el-button>
        </div>
      </template>
      
      <!-- 搜索表单 -->
      <el-form :inline="true" :model="searchForm" class="mb-4">
        <el-form-item label="用户名">
          <el-input v-model="searchForm.username" placeholder="请输入用户名" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleSearch">搜索</el-button>
          <el-button @click="resetForm">重置</el-button>
        </el-form-item>
      </el-form>
      
      <!-- 数据表格 -->
      <el-table :data="userList" style="width: 100%">
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column prop="username" label="用户名" />
        <el-table-column prop="name" label="姓名" />
        <el-table-column prop="email" label="邮箱" />
        <el-table-column prop="role" label="角色" />
        <el-table-column prop="createTime" label="创建时间" />
        <el-table-column label="操作" width="180">
          <template #default="scope">
            <el-button type="primary" size="small" @click="handleEdit(scope.row)">编辑</el-button>
            <el-button type="danger" size="small" @click="handleDelete(scope.row.id)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
      
      <!-- 分页 -->
      <div class="pagination-container">
        <el-pagination
          v-model:current-page="pagination.currentPage"
          v-model:page-size="pagination.pageSize"
          :page-sizes="[10, 20, 50, 100]"
          layout="total, sizes, prev, pager, next, jumper"
          :total="pagination.total"
          @size-change="handleSizeChange"
          @current-change="handleCurrentChange"
        />
      </div>
    </el-card>
    
    <!-- 添加/编辑对话框 -->
    <el-dialog v-model="dialogVisible" :title="dialogTitle">
      <el-form :model="form" :rules="rules" ref="formRef">
        <el-form-item label="用户名" prop="username">
          <el-input v-model="form.username" />
        </el-form-item>
        <el-form-item label="姓名" prop="name">
          <el-input v-model="form.name" />
        </el-form-item>
        <el-form-item label="邮箱" prop="email">
          <el-input v-model="form.email" />
        </el-form-item>
        <el-form-item label="角色" prop="role">
          <el-select v-model="form.role">
            <el-option label="管理员" value="admin" />
            <el-option label="普通用户" value="user" />
          </el-select>
        </el-form-item>
        <el-form-item v-if="isAdd" label="密码" prop="password">
          <el-input v-model="form.password" type="password" />
        </el-form-item>
      </el-form>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="dialogVisible = false">取消</el-button>
          <el-button type="primary" @click="handleSubmit">确定</el-button>
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useUserStore } from '@/store/user'

const userStore = useUserStore()
const userList = ref([])
const searchForm = reactive({ username: '' })
const pagination = reactive({
  currentPage: 1,
  pageSize: 10,
  total: 0
})

const dialogVisible = ref(false)
const dialogTitle = ref('')
const isAdd = ref(false)
const form = reactive({})
const formRef = ref()
const rules = {
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  name: [{ required: true, message: '请输入姓名', trigger: 'blur' }],
  email: [{ required: true, message: '请输入邮箱', trigger: 'blur' }, { type: 'email', message: '请输入正确的邮箱格式', trigger: 'blur' }],
  role: [{ required: true, message: '请选择角色', trigger: 'change' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }]
}

onMounted(() => {
  loadUsers()
})

const loadUsers = async () => {
  const params = {
    page: pagination.currentPage,
    pageSize: pagination.pageSize,
    username: searchForm.username
  }
  const result = await userStore.getUsers(params)
  userList.value = result.list
  pagination.total = result.total
}

const handleSearch = () => {
  pagination.currentPage = 1
  loadUsers()
}

const resetForm = () => {
  Object.assign(searchForm, { username: '' })
  pagination.currentPage = 1
  loadUsers()
}

const handleSizeChange = (size) => {
  pagination.pageSize = size
  loadUsers()
}

const handleCurrentChange = (current) => {
  pagination.currentPage = current
  loadUsers()
}

const handleAdd = () => {
  dialogTitle.value = '添加用户'
  isAdd.value = true
  Object.assign(form, { username: '', name: '', email: '', role: 'user', password: '' })
  dialogVisible.value = true
}

const handleEdit = (row) => {
  dialogTitle.value = '编辑用户'
  isAdd.value = false
  Object.assign(form, { ...row })
  dialogVisible.value = true
}

const handleDelete = async (id) => {
  try {
    await ElMessageBox.confirm('确定要删除该用户吗？', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })
    await userStore.deleteUser(id)
    ElMessage.success('删除成功')
    loadUsers()
  } catch (error) {
    // 取消删除
  }
}

const handleSubmit = async () => {
  if (!formRef.value) return
  try {
    await formRef.value.validate()
    if (isAdd.value) {
      await userStore.addUser(form)
      ElMessage.success('添加成功')
    } else {
      await userStore.updateUser(form)
      ElMessage.success('更新成功')
    }
    dialogVisible.value = false
    loadUsers()
  } catch (error) {
    ElMessage.error('操作失败')
  }
}
</script>
```

#### 后端实现

```java
// 用户控制器
@RestController
@RequestMapping("/api/user")
public class UserController {
    @Autowired
    private UserService userService;
    
    @GetMapping("/list")
    public Result<?> list(@RequestParam(defaultValue = "1") Integer page,
                         @RequestParam(defaultValue = "10") Integer pageSize,
                         String username) {
        Page<User> userPage = userService.page(new Page<>(page, pageSize),
            new QueryWrapper<User>()
                .like(StringUtils.isNotBlank(username), "username", username)
        );
        return Result.success(userPage);
    }
    
    @PostMapping("/add")
    public Result<?> add(@RequestBody User user) {
        userService.save(user);
        return Result.success("添加成功");
    }
    
    @PutMapping("/update")
    public Result<?> update(@RequestBody User user) {
        userService.updateById(user);
        return Result.success("更新成功");
    }
    
    @DeleteMapping("/delete/{id}")
    public Result<?> delete(@PathVariable Long id) {
        userService.removeById(id);
        return Result.success("删除成功");
    }
}

// 用户服务
@Service
public class UserService extends ServiceImpl<UserMapper, User> {
    @Autowired
    private PasswordEncoder passwordEncoder;
    
    @Override
    public boolean save(User user) {
        // 加密密码
        user.setPassword(passwordEncoder.encode(user.getPassword()));
        user.setCreateTime(LocalDateTime.now());
        return super.save(user);
    }
    
    @Override
    public boolean updateById(User user) {
        // 如果更新密码，需要重新加密
        if (StringUtils.isNotBlank(user.getPassword())) {
            user.setPassword(passwordEncoder.encode(user.getPassword()));
        }
        return super.updateById(user);
    }
}
```

## 部署方案

### Docker Compose部署

```yaml
version: '3.8'
services:
  mysql:
    image: mysql:8.0
    container_name: mysql
    environment:
      MYSQL_ROOT_PASSWORD: root
      MYSQL_DATABASE: management_system
    ports:
      - "3306:3306"
    volumes:
      - mysql-data:/var/lib/mysql
    networks:
      - app-network
  
  redis:
    image: redis:7.0
    container_name: redis
    ports:
      - "6379:6379"
    networks:
      - app-network
  
  backend:
    build: ./backend
    container_name: backend
    ports:
      - "8080:8080"
    environment:
      SPRING_DATASOURCE_URL: jdbc:mysql://mysql:3306/management_system
      SPRING_DATASOURCE_USERNAME: root
      SPRING_DATASOURCE_PASSWORD: root
      SPRING_REDIS_HOST: redis
    depends_on:
      - mysql
      - redis
    networks:
      - app-network
  
  frontend:
    build: ./frontend
    container_name: frontend
    ports:
      - "80:80"
    depends_on:
      - backend
    networks:
      - app-network

volumes:
  mysql-data:

networks:
  app-network:
    driver: bridge
```

### CI/CD 配置

```yaml
# .github/workflows/deploy.yml
name: Deploy Management System

on:
  push:
    branches: [ main ]

jobs:
  build:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Set up JDK 17
      uses: actions/setup-java@v3
      with:
        java-version: '17'
        distribution: 'temurin'
    
    - name: Build backend
      run: |
        cd backend
        mvn clean package -DskipTests
    
    - name: Set up Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '16'
    
    - name: Build frontend
      run: |
        cd frontend
        npm install
        npm run build
    
    - name: Deploy to server
      uses: appleboy/ssh-action@v0.1.7
      with:
        host: ${{ secrets.SERVER_HOST }}
        username: ${{ secrets.SERVER_USER }}
        password: ${{ secrets.SERVER_PASSWORD }}
        script: |
          # 部署脚本
          cd /app/management-system
          git pull
          docker-compose up -d --build
```

## 性能优化

### 前端优化

1. **代码分割**：使用动态导入实现路由懒加载
2. **组件缓存**：使用Vue的keep-alive组件缓存常用页面
3. **图片优化**：使用WebP格式图片，实现图片懒加载
4. **HTTP缓存**：合理设置静态资源缓存策略
5. **减少HTTP请求**：合并CSS/JS文件，使用图标字体
6. **使用CDN**：将静态资源部署到CDN

### 后端优化

1. **数据库优化**：
   - 合理设计索引
   - 使用连接池
   - 优化SQL查询
   - 读写分离

2. **缓存优化**：
   - 使用Redis缓存热点数据
   - 实现缓存预热
   - 合理设置缓存过期时间

3. **代码优化**：
   - 使用Stream API和Lambda表达式
   - 避免重复计算
   - 使用局部变量减少方法调用

4. **并发优化**：
   - 使用线程池处理并发请求
   - 合理使用同步锁
   - 避免死锁

5. **JVM优化**：
   - 合理设置JVM参数
   - 使用G1垃圾收集器
   - 监控JVM运行状态

## 监控与告警

### 前端监控

1. **错误监控**：使用Sentry监控前端错误
2. **性能监控**：使用Web Vitals监控页面性能
3. **用户行为分析**：使用Google Analytics分析用户行为

### 后端监控

1. **应用监控**：使用Spring Boot Actuator暴露监控端点
2. **系统监控**：使用Prometheus + Grafana监控系统指标
3. **日志管理**：使用ELK Stack收集和分析日志
4. **告警机制**：配置邮件/短信告警

## 总结与展望

本项目实现了一个基于Vue 3 + Spring Boot的完整前后端分离管理系统，包含用户认证、权限管理、数据管理、数据可视化等核心功能。通过本项目的实践，我们掌握了以下技术点：

1. **前后端分离架构**的设计与实现
2. **Spring Boot 3**的核心特性和最佳实践
3. **Vue 3 Composition API**的使用
4. **Spring Security**的认证与授权
5. **MyBatis Plus**的高级用法
6. **Docker容器化**部署
7. **CI/CD**自动化部署

在未来的发展中，我们可以考虑：

1. **微服务架构**：将系统拆分为多个微服务
2. **API网关**：引入API网关统一管理API
3. **服务发现与配置中心**：使用Nacos实现服务管理
4. **分布式事务**：使用Seata处理分布式事务
5. **消息队列**：使用RocketMQ处理异步任务
6. **AI集成**：在系统中集成AI能力，如智能分析、预测等

前后端分离架构是现代Web应用的主流选择，本项目为我们提供了一个完整的实践案例，希望能为大家的学习和工作提供参考。