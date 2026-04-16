# Spring Boot 常用注解手册

本文档基于提供的文章内容，提炼了其中涉及的40个Spring Boot常用注解的核心定义、主要用途、关键属性及用法示例。

------

## 一、Spring Web MVC 注解

### 1. @RequestMapping

- **用途**： 将Web请求（URL）映射到控制器类或处理方法上。是Spring MVC和WebFlux的核心注解。

- **关键属性**：

  - `value`/ `path`: 请求URL路径。
  - `method`: 请求方法（GET, POST, PUT等）。
  - `params`, `headers`: 根据请求参数或头信息过滤请求。
  - `consumes`, `produces`: 指定处理/产生的媒体类型。

- **用法示例**：

  ```
  // 类级别注解，为所有方法添加前缀
  @Controller
  @RequestMapping("/demo")
  public class DemoController {
      // 方法级别注解，完整路径为 /demo/home
      @RequestMapping(value = "/home", method = RequestMethod.GET)
      public String home() {
          return "/home";
      }
  }
  ```

### 2. @GetMapping, @PostMapping, @PutMapping, @DeleteMapping, @PatchMapping

- **用途**： 分别是 `@RequestMapping(method = RequestMethod.GET/POST/PUT/DELETE/PATCH)`的组合注解（快捷方式），用于处理特定类型的HTTP请求。

- **用法示例**：

  ```
  @RestController
  @RequestMapping("/api/v1")
  public class UserController {
      @GetMapping("/users/{id}") // 处理 GET 请求
      public User findUser(@PathVariable Long id) { ... }
  
      @PostMapping("/users") // 处理 POST 请求
      public User createUser(@RequestBody User user) { ... }
  
      @PutMapping("/users/{id}") // 处理 PUT 请求
      public User updateUser(...) { ... }
  
      @DeleteMapping("/users/{id}") // 处理 DELETE 请求
      public void deleteUser(...) { ... }
  }
  ```

### 3. @RequestBody

- **用途**： 将HTTP请求体（JSON/XML等）中的参数绑定到一个方法参数对象上，通常用于接收POST/PUT请求的JSON数据。

- **常与`@Valid`搭配**： 进行参数校验。

- **用法示例**：

  ```
  @PostMapping("/users")
  public User createUser(@Valid @RequestBody User user) {
      return userService.save(user);
  }
  ```

### 4. @PathVariable

- **用途**： 将URI模板变量（`{id}`）的值绑定到方法参数上。

- **属性**：

  - `value`/ `name`: 指定URI中的变量名（可省略，若参数名与变量名一致）。
  - `required`: 参数是否必须，默认为`true`。

- **用法示例**：

  ```
  @GetMapping("/users/{id}/roles/{roleId}")
  public Role getRole(@PathVariable("id") Long userId, 
                      @PathVariable Long roleId) { ... }
  ```

### 5. @RequestParam

- **用途**： 将HTTP请求参数（`?key=value`）绑定到方法参数上。

- **属性**：

  - `value`/ `name`: 请求参数名。
  - `required`: 是否必须。
  - `defaultValue`: 默认值。

- **用法示例**：

  ```
  @GetMapping("/search")
  public List<User> search(@RequestParam("keyword") String keyword,
                           @RequestParam(name = "page", defaultValue = "0") int page) { ... }
  ```

### 6. @ResponseBody

- **用途**： 将方法返回值直接写入HTTP响应体，通常用于返回JSON/XML数据。
- **注意**： 在`@RestController`标注的类中，所有方法默认添加了此注解。

### 7. @RestController

- **用途**： 是`@Controller`和`@ResponseBody`的组合注解。标注的类本身是控制器，且其中所有方法返回值均直接写入响应体。

### 8. @Controller

- **用途**： 标记一个类为Spring MVC控制器，配合视图解析器返回视图名称。需与`@ResponseBody`配合返回数据。

### 9. @ControllerAdvice

- **用途**： 标注一个类，用于全局控制器增强。常与`@ExceptionHandler`、`@InitBinder`、`@ModelAttribute`搭配使用，进行全局异常处理、数据绑定、模型属性设置。

- **用法示例**：

  ```
  @ControllerAdvice
  public class GlobalExceptionHandler {
      @ExceptionHandler(UserNotFoundException.class)
      public ResponseEntity<?> handleException(UserNotFoundException ex) {
          // 返回统一的错误响应
          return ResponseEntity.status(HttpStatus.NOT_FOUND).body(...);
      }
  }
  ```

### 10. @ExceptionHandler

- **用途**： 在控制器或`@ControllerAdvice`类中，标注处理特定异常的方法。

### 11. @ResponseStatus

- **用途**： 标注在方法或异常类上，定义HTTP响应的状态码。

- **用法示例**：

  ```
  @ResponseStatus(HttpStatus.NOT_FOUND)
  public class UserNotFoundException extends RuntimeException { ... }
  ```

### 12. @ModelAttribute

- **用途**：

  1. **方法参数上**： 从模型（Model）中获取已存在的属性，或将从请求参数绑定的对象添加到模型。
  2. **方法上**： 在执行控制器方法前，该方法的返回值会被自动添加到模型。

- **用法示例**：

  ```
  // 用在方法参数上
  @PostMapping("/users")
  public void create(@ModelAttribute User user) { ... }
  
  // 用在方法上
  @ModelAttribute("message")
  public String addMsg() {
      return "Hello";
  }
  ```

### 13. @CrossOrigin

- **用途**： 在类或方法上启用跨源资源共享（CORS），允许跨域请求。
- **属性**： 可微调`origins`（允许的源）、`methods`（允许的方法）等。

### 14. @InitBinder

- **用途**： 标注方法，用于初始化`WebDataBinder`，进行请求参数的预处理，如自定义日期格式、字符串过滤。

- **用法示例**：

  ```
  @InitBinder
  public void initBinder(WebDataBinder binder) {
      SimpleDateFormat format = new SimpleDateFormat("yyyy-MM-dd");
      binder.registerCustomEditor(Date.class, new CustomDateEditor(format, false));
  }
  ```

------

## 二、Spring Bean 注解

### 15. @ComponentScan

- **用途**： 在配置类上使用，指定Spring要扫描的基包路径，以发现被`@Component`及其衍生注解标记的Bean。
- **属性**： `basePackages`/ `value`。

### 16. @Component

- **用途**： 通用的原型注解，标记一个类为Spring容器管理的Bean（组件）。无明确的业务分层语义。

### 17. @Service

- **用途**： `@Component`的特化，用于标记业务逻辑层（Service层）的类。

### 18. @Repository

- **用途**： `@Component`的特化，用于标记数据访问层（DAO层）的类。其额外优势是能将平台特定的持久化异常转换为Spring统一的`DataAccessException`。

------

## 三、Spring Dependency Inject 与 Bean Scopes 注解

### 19. @Autowired

- **用途**： Spring的依赖注入注解，可自动装配Bean。可用于构造器、Setter方法、字段。

- **注入方式**：

  - **构造器注入**（推荐）：

    ```
    @RestController
    public class UserController {
        private final UserService userService;
        @Autowired
        public UserController(UserService userService) { this.userService = userService; }
    }
    ```

  - **Setter注入**：

    ```
    public void setUserService(@Autowired UserService userService) { ... }
    ```

  - **字段注入**：

    ```
    @Autowired
    private UserService userService;
    ```

### 20. @Qualifier

- **用途**： 当有多个同类型Bean时，与`@Autowired`配合使用，通过指定Bean的名称（`@Service(“name”)`）来消除歧义，明确注入哪一个。

- **用法示例**：

  ```
  @Service("emailService")
  public class EmailService implements MessageService { ... }
  
  @Service("smsService")
  public class SmsService implements MessageService { ... }
  
  @Component
  public class MyComponent {
      @Autowired
      @Qualifier("emailService") // 明确指定注入 emailService
      private MessageService messageService;
  }
  ```

### 21. @Primary

- **用途**： 当存在多个同类型Bean时，被`@Primary`标注的Bean将被优先注入（作为默认选择）。

### 22. @Bean

- **用途**： 在Java配置类（`@Configuration`）的方法上使用，声明该方法将返回一个由Spring IoC容器管理的Bean。

- **属性**：

  - `initMethod`: 指定Bean初始化后调用的方法名。
  - `destroyMethod`: 指定Bean销毁前调用的方法名。

- **用法示例**：

  ```
  @Configuration
  public class AppConfig {
      @Bean(initMethod = "init", destroyMethod = "cleanup")
      public DataSource dataSource() {
          return new HikariDataSource();
      }
  }
  ```

### 23. @Scope

- **用途**： 定义Bean的作用域。

- **常用值**：

  - `ConfigurableBeanFactory.SCOPE_SINGLETON`(默认)：单例，容器中只有一个实例。
  - `ConfigurableBeanFactory.SCOPE_PROTOTYPE`：原型，每次请求都创建新实例。
  - `WebApplicationContext.SCOPE_REQUEST`：一次请求一个实例。
  - `WebApplicationContext.SCOPE_SESSION`：一次会话一个实例。

- **用法示例**：

  ```
  @Component
  @Scope(ConfigurableBeanFactory.SCOPE_PROTOTYPE)
  public class ShoppingCart { ... }
  ```

### 24. @DependsOn

- **用途**： 强制Spring在初始化当前Bean之前，先初始化指定的其他Bean。

- **用法示例**：

  ```
  @Bean
  @DependsOn({"databaseInitializer", "cacheLoader"})
  public MyService myService() { ... }
  ```

### 25. @PostConstruct (JSR-250)

- **用途**： 标注在Bean的初始化方法上，在依赖注入完成后、Bean投入使用前，由Spring调用。

### 26. @PreDestroy (JSR-250)

- **用途**： 标注在Bean的销毁方法上，在Bean被容器销毁之前调用。

------

## 四、Spring Boot 核心与条件注解

### 27. @SpringBootApplication

- **用途**： Spring Boot应用的主入口注解，是`@Configuration`、`@EnableAutoConfiguration`和`@ComponentScan`三个注解的组合。

- **用法示例**：

  ```
  @SpringBootApplication
  public class MyApplication {
      public static void main(String[] args) {
          SpringApplication.run(MyApplication.class, args);
      }
  }
  ```

### 28. @EnableAutoConfiguration

- **用途**： 启用Spring Boot的自动配置机制。Spring Boot会根据类路径下的jar包依赖，自动配置Spring应用。

### 29. @Configuration

- **用途**： 标记一个类为配置类，其内部可定义多个`@Bean`方法，替代XML配置。

### 30. @ConditionalOnClass

- **用途**： 类路径下存在指定的类时，才生效配置。

### 31. @ConditionalOnMissingClass

- **用途**： 类路径下不存在指定的类时，才生效配置。

### 32. @ConditionalOnBean

- **用途**： 当容器中存在指定的Bean时，才生效配置。

### 33. @ConditionalOnMissingBean

- **用途**： 当容器中不存在指定的Bean时，才生效配置。常用于定义默认Bean。

### 34. @ConditionalOnProperty

- **用途**： 当指定的配置属性满足条件时，才生效配置。

- **用法示例**：

  ```
  @Bean
  @ConditionalOnProperty(name = "app.feature.enabled", havingValue = "true")
  public MyFeature myFeature() { ... }
  ```

### 35. @ConditionalOnResource

- **用途**： 当类路径下存在指定的资源文件时，才生效配置。

### 36. @ConditionalOnWebApplication

- **用途**： 当应用是Web应用时，才生效配置。

### 37. @ConditionalOnNotWebApplication

- **用途**： 当应用不是Web应用时，才生效配置。

### 38. @ConditionalOnExpression

- **用途**： 基于SpEL表达式的结果（`true`/`false`）来决定是否生效配置。

- **用法示例**：

  ```
  @Bean
  @ConditionalOnExpression("'${app.mode}' == 'cluster'")
  public ClusterService clusterService() { ... }
  ```

### 39. @Conditional

- **用途**： 最通用的条件注解，需要实现`Condition`接口，实现自定义的复杂条件判断逻辑。

### 40. @Value

- **用途**： 用于注入外部配置（如`application.properties`）的值到Bean的字段、构造器或方法参数。

- **用法示例**：

  ```
  @Component
  public class MyComponent {
      @Value("${app.name:DefaultApp}") // 冒号后为默认值
      private String appName;
  }
  ```

  *文档补充说明：此注解在原文“四、容器配置注解”部分的`@PutMapping`示例代码片段中被使用（`@Value @ResponseBody`），但未在正文中单独列出。基于通用知识，`@Value`是Spring核心的配置注入注解。*