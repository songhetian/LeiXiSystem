# S03 · 员工档案（CRUD 端到端）

## What to build
员工档案的完整生命周期：列表（部门过滤+分页+搜索）→ 新增/编辑（工号唯一、手机号校验）→ 详情 → 离职；批量导入导出；部门数据隔离生效（经理只见本部门）。

## 进度（2026-08-12 后端完成 ✅）
- [x] Prisma：departments/positions/employees/user_departments 四表（migrate add_org_employee）
- [x] **TDD 12 用例全绿**：创建（正常/工号重复 1001/手机号 1003）/ 列表分页 / 搜索 / 详情 404+1002 / 修改 / 离职状态机（离职后 409+1004）/ **数据隔离**（admin 全量、经理本部门+子部门、无权限 403+5003）
- [x] EmployeesService：CRUD + 离职状态机 + visibleScope（ADR-0010 递归子部门）
- [ ] 前端员工页（列表 ProTable/详情/ModalForm/导入导出）——待公共组件库就绪后接入（Step 3）

## 五维清单
- **数据库**：✅ departments/positions/employees/user_departments
- **后端接口**：✅ GET/POST /employees、GET/PATCH /employees/:id、POST /employees/:id/resign；错误码 1001/1002/1003/1004；POST /employees/import、GET /employees/export 待做
- **业务算法**：✅ 工号唯一、离职状态机、部门数据范围过滤（递归子部门）
- **前端页面**：employee feature（待做）
- **单元测试**：✅ 12 用例（jest e2e）

## Acceptance criteria
- [x] 员工 CRUD + 离职全流程可用
- [x] 经理只能看到本部门（含子部门）员工，越权返回 5003
- [ ] Excel 导入成功/失败（待做）
- [ ] 员工页符合第 11 章验收清单（待做）

## Blocked by
- S02 认证与权限
