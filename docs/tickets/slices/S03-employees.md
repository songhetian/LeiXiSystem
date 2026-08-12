# S03 · 员工档案（CRUD 端到端）

## What to build
员工档案的完整生命周期：列表（部门过滤+分页+搜索）→ 新增/编辑（工号唯一、手机号校验）→ 详情 → 离职；批量导入导出；部门数据隔离生效（经理只见本部门）。

## 五维清单
- **数据库**：employees/departments/positions（保留表迁移；employee_no 唯一约束）
- **后端接口**：GET/POST /employees、GET/PATCH /employees/:id、POST /employees/:id/resign、POST /employees/import、GET /employees/export；错误码 1001/1002/1003/1004
- **业务算法**：工号唯一性、离职状态机（在职→离职，离职后不可排班）、部门数据范围过滤（ADR-0010）
- **前端页面**：employee feature（列表 ProTable / 详情 Descriptions / 新增编辑 ModalForm / 导入导出按钮）
- **单元测试**：API e2e（CRUD/工号重复 1001/越权查他人 5003）

## Acceptance criteria
- [ ] 员工 CRUD + 离职全流程可用
- [ ] 经理只能看到本部门（含子部门）员工，越权返回 5003
- [ ] Excel 导入成功/失败（重复工号）提示明确
- [ ] 员工页符合第 11 章验收清单

## Blocked by
- S02 认证与权限
