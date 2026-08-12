# ADR-0005: 功能删除边界

- 状态：已接受（Accepted）
- 日期：2026-08-12

## 背景

旧系统功能冗余（15+ 模块），大量功能使用率低且拖累主链路（考勤/算薪）。经与用户逐项确认删除与保留边界。

## 决策

**删除（连根删：前端页面 + 后端路由 + 数据表 + 依赖）**：

| 功能 | 范围 |
|---|---|
| 聊天 | Messaging 页面、chat/broadcast 路由、chat_* / conversation* / messages / groups 等表 |
| 质检 | Quality* 页面与路由、quality_* 全部表（约 15 张） |
| 资产管理 | Assets/Inventory/Logistics 页面、assets.js 等路由、asset_* / inventory_* / device_* / devices 表 |
| 案例库 | Case* 页面与路由、cases / case_* 表 |
| 库存/设备 | 随资产管理一并删除 |
| **考试/测评**（2026-08-12 追加） | Assessment/Exam 页面与路由、assessment_*/exam_*/answer_records/questions 表 |

**保留**：员工/部门/职位、考勤全家桶（班次/排班/打卡/请假/加班/调休/休假）、报销、工资条（升级为自动算薪）、**知识库（培训中心，考试已删）**、**公告**、通知/待办/个人中心、系统管理（RBAC/审批流/日志）。

## 后果

- 正向：删除后实际需移植的业务模块约剩一半，主链路（考勤 → 算薪）聚焦。
- 成本：删除前需 mysqldump 备份；删除表走迁移文件而非手动 DROP。
