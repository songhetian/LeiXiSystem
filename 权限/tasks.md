# Implementation Plan

- [ ] 1. 初始化权限数据和数据库结构
  - 创建权限数据初始化SQL脚本，包含所有12个功能模块的权限定义
  - 创建角色权限关联的初始化SQL脚本，为默认角色分配权限
  - 为permissions表的code和module字段添加索引
  - 为role_permissions表添加复合索引
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [ ] 2. 实现后端权限查询API
  - [ ] 2.1 创建GET /api/auth/permissions接口
    - 实现查询当前用户所有权限的SQL逻辑
    - 使用JOIN优化查询性能，避免N+1问题
    - 返回权限列表、角色列表和can_view_all_departments标识
    - _Requirements: 3.1, 2.3_

  - [ ] 2.2 添加权限查询缓存机制
    - 实现内存缓存，缓存时间5分钟
    - 在角色权限变更时清除相关用户的缓存
    - _Requirements: 8.1, 8.2, 8.4_

- [ ] 3. 实现权限验证中间件
  - [ ] 3.1 创建requirePermission中间件
    - 实现从请求中提取用户ID的逻辑
    - 实现权限验证逻辑，支持单个权限检查
    - 无权限时返回403状态码和友好错误信息
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

  - [ ] 3.2 为现有敏感API添加权限验证
    - 为员工管理相关API添加权限验证
    - 为部门、职位管理API添加权限验证
    - 为考勤、排班相关API添加权限验证
    - _Requirements: 5.1, 5.2_

- [ ] 4. 实现角色权限管理API
  - 创建GET /api/roles/:id/permissions接口获取角色权限列表
  - 创建PUT /api/roles/:id/permissions/batch接口批量更新角色权限
  - 实现权限变更时的缓存清除逻辑
  - 添加权限变更操作日志记录
  - _Requirements: 2.1, 2.2, 2.3_

- [ ] 5. 实现前端权限工具函数
  - [ ] 5.1 创建权限工具函数文件
    - 实现hasPermission函数检查单个权限
    - 实现hasAnyPermission函数检查任意权限（OR逻辑）
    - 实现hasAllPermissions函数检查所有权限（AND逻辑）
    - 实现hasMenuPermission函数检查菜单权限
    - 实现filterMenusByPermission函数过滤菜单列表
    - _Requirements: 6.1, 6.2, 6.3_

  - [ ] 5.2 定义菜单权限映射配置
    - 创建MENU_PERMISSIONS常量，映射菜单key到所需权限
    - 支持OR逻辑，有任一权限即可访问菜单
    - _Requirements: 3.2, 3.3_

- [ ] 6. 创建权限Context和Provider
  - 创建PermissionContext提供全局权限状态
  - 实现PermissionProvider组件
  - 提供permissions、roles、canViewAllDepartments状态
  - 提供hasPermission、hasAnyPermission、hasAllPermissions方法
  - 提供refreshPermissions方法用于刷新权限
  - _Requirements: 3.1, 3.4, 6.1, 6.2, 6.3_

- [ ] 7. 实现权限React Hooks
  - 创建usePermission Hook用于单个权限检查
  - 创建useHasAnyPermission Hook用于多个权限检查
  - 从PermissionContext获取权限数据
  - _Requirements: 6.4_

- [ ] 8. 实现权限控制组件
  - [ ] 8.1 创建HasPermission组件
    - 支持permission属性指定所需权限
    - 有权限时渲染children，无权限时不渲染
    - _Requirements: 6.5_

  - [ ] 8.2 创建PermissionRoute组件
    - 支持permission属性指定页面所需权限
    - 支持component属性指定要渲染的组件
    - 支持fallback属性指定无权限时的替代组件
    - 无权限时渲染fallback或重定向到403页面
    - _Requirements: 4.1, 4.2, 6.5_

  - [ ] 8.3 创建NoPermission无权限页面
    - 显示友好的403无权限提示
    - 提供返回首页按钮
    - 显示所需权限信息
    - _Requirements: 4.1, 4.2, 4.4_

- [ ] 9. 改造登录流程集成权限
  - [ ] 9.1 修改登录API响应
    - 登录成功后调用权限查询接口
    - 在响应中包含用户权限列表
    - _Requirements: 3.1_

  - [ ] 9.2 修改前端登录逻辑
    - 修改Login.jsx组件
    - 登录成功后获取权限数据
    - 将权限数据保存到localStorage
    - 初始化PermissionContext
    - _Requirements: 3.1, 3.4_

  - [ ] 9.3 在App.jsx中集成PermissionProvider
    - 用PermissionProvider包裹应用
    - 在应用启动时从localStorage恢复权限
    - _Requirements: 3.4_

- [ ] 10. 实现菜单权限过滤
  - 修改Sidebar.jsx组件
  - 导入filterMenusByPermission函数
  - 使用权限过滤菜单列表
  - 隐藏无权限的菜单项
  - 如果父菜单的所有子菜单都无权限，隐藏父菜单
  - _Requirements: 3.2, 3.3_

- [ ] 11. 实现页面路由权限控制
  - 修改App.jsx中的路由配置
  - 使用PermissionRoute包裹需要权限的页面
  - 为每个路由指定所需权限
  - 配置无权限时的fallback
  - _Requirements: 4.1, 4.2, 4.3_

- [ ] 12. 实现角色权限管理界面
  - [ ] 12.1 创建角色权限编辑表单
    - 在角色编辑页面添加权限选择区域
    - 按功能模块分组显示权限
    - 使用复选框展示权限列表
    - _Requirements: 7.1, 7.2_

  - [ ] 12.2 实现权限选择交互功能
    - 实现全选/取消全选功能
    - 实现按模块全选功能
    - 实现权限搜索过滤功能
    - _Requirements: 7.3, 7.4_

  - [ ] 12.3 实现权限预览功能
    - 显示角色拥有的所有权限列表
    - 显示角色可访问的菜单列表
    - 显示角色可访问的页面列表
    - _Requirements: 7.5_

  - [ ] 12.4 实现权限保存功能
    - 调用批量更新角色权限API
    - 显示保存成功提示
    - 刷新权限数据

- [ ]* 13. 编写测试用例
  - [ ]* 13.1 编写权限工具函数单元测试
    - 测试hasPermission各种场景
    - 测试hasAnyPermission逻辑
    - 测试hasAllPermissions逻辑
    - 测试菜单过滤逻辑

  - [ ]* 13.2 编写权限中间件单元测试
    - 测试有权限的情况
    - 测试无权限的情况
    - 测试未登录的情况

  - [ ]* 13.3 编写集成测试
    - 测试登录流程和权限获取
    - 测试不同角色的菜单过滤
    - 测试API权限验证

- [ ]* 14. 性能优化和测试
  - [ ]* 14.1 优化权限查询性能
    - 验证数据库索引效果
    - 测试缓存机制
    - 测试权限检查响应时间

  - [ ]* 14.2 进行端到端测试
    - 测试管理员账号完整流程
    - 测试部门经理账号权限范围
    - 测试普通员工账号权限限制
    - 测试无权限访问场景

- [ ]* 15. 编写文档
  - [ ]* 15.1 编写开发文档
    - 编写权限系统架构文档
    - 编写权限配置指南
    - 编写API使用文档

  - [ ]* 15.2 编写用户文档
    - 编写角色管理使用手册
    - 编写权限分配操作指南
    - 编写常见问题FAQ
