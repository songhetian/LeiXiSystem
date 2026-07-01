-- ============================================
-- v3 Module Seed Data
-- Insert default records for new modules
-- Safe to run on existing database (uses INSERT IGNORE)
-- ============================================

-- N1: 2026年中国法定节假日
INSERT IGNORE INTO holiday_lists (id, name, year, country, is_default, status) 
VALUES (1, '2026年中国法定节假日', 2026, 'CN', true, 'active');

-- 2026年节假日日期
INSERT IGNORE INTO holiday_dates (holiday_list_id, date, name, is_working_day, description) VALUES
  (1, '2026-01-01', '元旦', false, '元旦假期'),
  (1, '2026-01-02', '元旦', false, '元旦假期'),
  (1, '2026-01-03', '元旦', false, '元旦假期'),
  (1, '2026-02-07', '春节', false, '春节假期'),
  (1, '2026-02-08', '春节', false, '春节假期'),
  (1, '2026-02-09', '春节', false, '春节假期'),
  (1, '2026-02-10', '春节', false, '春节假期'),
  (1, '2026-02-11', '春节', false, '春节假期'),
  (1, '2026-02-12', '春节', false, '春节假期'),
  (1, '2026-02-13', '春节', false, '春节假期'),
  (1, '2026-04-04', '清明节', false, '清明节假期'),
  (1, '2026-04-05', '清明节', false, '清明节假期'),
  (1, '2026-04-06', '清明节', false, '清明节假期'),
  (1, '2026-05-01', '劳动节', false, '劳动节假期'),
  (1, '2026-05-02', '劳动节', false, '劳动节假期'),
  (1, '2026-05-03', '劳动节', false, '劳动节假期'),
  (1, '2026-06-10', '端午节', false, '端午节假期'),
  (1, '2026-06-11', '端午节', false, '端午节假期'),
  (1, '2026-06-12', '端午节', false, '端午节假期'),
  (1, '2026-09-25', '中秋节', false, '中秋节假期'),
  (1, '2026-09-26', '中秋节', false, '中秋节假期'),
  (1, '2026-09-27', '中秋节', false, '中秋节假期'),
  (1, '2026-10-01', '国庆节', false, '国庆节假期'),
  (1, '2026-10-02', '国庆节', false, '国庆节假期'),
  (1, '2026-10-03', '国庆节', false, '国庆节假期'),
  (1, '2026-10-04', '国庆节', false, '国庆节假期'),
  (1, '2026-10-05', '国庆节', false, '国庆节假期'),
  (1, '2026-10-06', '国庆节', false, '国庆节假期'),
  (1, '2026-10-07', '国庆节', false, '国庆节假期');

-- 调休工作日（补班日）
INSERT IGNORE INTO holiday_dates (holiday_list_id, date, name, is_working_day, description) VALUES
  (1, '2026-01-25', '春节调休', true, '补班：春节前周日调休'),
  (1, '2026-02-15', '春节调休', true, '补班：春节后周日调休'),
  (1, '2026-05-09', '劳动节调休', true, '补班：劳动节后周六调休'),
  (1, '2026-06-06', '端午节调休', true, '补班：端午节前周六调休'),
  (1, '2026-09-20', '中秋节调休', true, '补班：中秋节前周日调休'),
  (1, '2026-10-10', '国庆节调休', true, '补班：国庆节后周六调休');

-- G2: Default SLA Policies
INSERT IGNORE INTO helpdesk_slas (id, name, description, priority, customer_tier, response_time, resolution_time, workdays_only, holiday_list_id, escalation_enabled, status) VALUES
  (1, 'VIP-紧急响应', 'VIP客户紧急工单', 'urgent', 'vip', 5, 60, true, 1, true, 'active'),
  (2, 'VIP-标准响应', 'VIP客户标准工单', 'normal', 'vip', 15, 240, true, 1, true, 'active'),
  (3, '普通-紧急响应', '普通客户紧急工单', 'urgent', 'normal', 10, 120, true, 1, true, 'active'),
  (4, '普通-标准响应', '普通客户标准工单', 'normal', 'normal', 30, 480, true, 1, true, 'active'),
  (5, '默认SLA', '兜底策略', NULL, NULL, 60, 1440, true, 1, false, 'active');

-- N8: Default Canned Responses
INSERT IGNORE INTO canned_responses (id, title, content, category, is_global, usage_count, status, created_by) VALUES
  (1, '密码重置指引', '您好 {{customer_name}}，

关于密码重置，请按以下步骤操作：
1. 访问登录页面，点击"忘记密码"
2. 输入您的注册邮箱
3. 查收重置邮件（如未收到请检查垃圾邮件箱）
4. 点击邮件中的链接设置新密码

如有其他问题，请随时联系我们。

工单编号：{{ticket_id}}', '账号问题', true, 0, 'active', 1),
  (2, '工单进度查询回复', '您好 {{customer_name}}，

您的工单（{{ticket_id}}）当前状态为处理中，我们正在积极为您解决问题。预计将在 24 小时内给您答复。

感谢您的耐心等待！', '通用', true, 0, 'active', 1),
  (3, '退款处理中通知', '您好 {{customer_name}}，

您的退款申请已收到，财务部门将在 3-5 个工作日内处理。退款将原路返回到您的支付账户。

退款金额：请查看您的订单详情
如有疑问，请回复本工单。

工单编号：{{ticket_id}}', '退款', true, 0, 'active', 1),
  (4, '工单已解决确认', '您好 {{customer_name}}，

您的工单（{{ticket_id}}）已解决。请确认问题是否已得到妥善处理。

如果问题已解决，您可以关闭本工单。如有任何其他问题，欢迎随时联系我们。

感谢您的反馈！', '通用', true, 0, 'active', 1),
  (5, '需要补充信息', '您好 {{customer_name}}，

为了更好地帮您解决问题，我们需要您补充以下信息：

请提供相关截图或详细描述，以便我们更快定位问题。

感谢您的配合！

工单编号：{{ticket_id}}', '通用', true, 0, 'active', 1);

-- N10: Dashboard Alert Thresholds
INSERT IGNORE INTO dashboard_alert_configs (id, metric_key, metric_name, warn_threshold, critical_threshold, comparison_operator, enabled) VALUES
  (1, 'queue_length', '排队工单数', 10, 20, '>=', true),
  (2, 'sla_breach_rate', 'SLA违约率(%)', 10, 20, '>=', true),
  (3, 'absence_count', '缺勤人数', 5, 10, '>=', true),
  (4, 'deviation_rate', '排班偏差率(%)', 15, 30, '>=', true),
  (5, 'satisfaction_avg', '满意度均分', 3.5, 3.0, '<=', true);

-- N2: Default KB Categories
INSERT IGNORE INTO kb_categories (id, name, parent_id, sort_order, category_type, visibility) VALUES
  (1, '产品知识', NULL, 1, 'kb', 'all'),
  (2, '技术问题', NULL, 2, 'kb', 'all'),
  (3, '账号问题', NULL, 3, 'kb', 'all'),
  (4, '退款流程', NULL, 4, 'kb', 'all'),
  (5, '公司制度', NULL, 1, 'doc', 'all'),
  (6, '培训材料', NULL, 2, 'doc', 'all'),
  (7, 'SOP流程', NULL, 3, 'doc', 'all');

-- N2: Sample KB Articles
INSERT IGNORE INTO kb_articles (id, title, content, category_id, tags, status, author_id) VALUES
  (1, '如何重置账号密码', '## 密码重置步骤

### 自助重置
1. 访问登录页面
2. 点击"忘记密码"链接
3. 输入注册邮箱
4. 查收重置邮件并设置新密码

### 管理员重置
如果您无法通过自助方式重置，请联系系统管理员。管理员可以在后台用户管理页面重置您的密码。

### 常见问题
- **未收到重置邮件？** 请检查垃圾邮件箱
- **邮箱已停用？** 需要联系HR更新邮箱信息', 3, '密码,重置,账号', 'published', 1),
  (2, '退款政策和流程说明', '## 退款政策

### 适用范围
- 7天内未使用的服务可全额退款
- 服务未达承诺标准的可申请退款
- 特殊产品按具体条款执行

### 退款流程
1. 提交退款申请（需说明退款原因）
2. 客服审核（1-2个工作日）
3. 财务处理（3-5个工作日）
4. 款项原路返回

### 注意事项
- 退款金额以实际支付金额为准
- 优惠券部分不予退还
- 已开具发票的需退回发票原件', 4, '退款,流程,政策', 'published', 1),
  (3, '常见技术问题排查指南', '## 常见问题排查

### 页面加载缓慢
1. 清除浏览器缓存
2. 检查网络连接
3. 尝试使用无痕模式

### 登录失败
1. 确认账号密码正确
2. 检查大写锁定键
3. 如连续失败5次，账号将被锁定30分钟

### 数据未同步
1. 刷新页面
2. 重新登录
3. 如持续出现，请提交工单', 2, '技术,排查,常见问题', 'published', 1);

-- G7: Default Onboarding Flow Template
INSERT IGNORE INTO lifecycle_task_templates (id, name, type, status) VALUES
  (1, '标准入职流程', 'onboarding', 'active'),
  (2, '标准离职流程', 'offboarding', 'active');

INSERT IGNORE INTO lifecycle_template_tasks (id, template_id, task_name, assigned_role, sort_order, auto_trigger, deadline_days, description) VALUES
  (1, 1, '创建系统账号和邮箱', 'IT', 1, true, 1, '为新员工创建公司邮箱和系统账号'),
  (2, 1, '分配办公设备', 'IT', 2, true, 2, '分配电脑、显示器、键盘鼠标等办公设备'),
  (3, 1, '签署劳动合同', 'HR', 3, true, 1, '准备并签署劳动合同和相关协议'),
  (4, 1, '开通门禁和工牌', 'HR', 4, true, 2, '制作工牌并开通门禁权限'),
  (5, 1, '安排新员工培训', '直属主管', 5, true, 5, '安排岗位培训和公司制度培训'),
  (6, 2, '回收办公设备', 'IT', 1, true, 3, '回收电脑、显示器等公司设备'),
  (7, 2, '关闭系统账号', 'IT', 2, true, 1, '关闭邮箱和系统账号'),
  (8, 2, '结算工资', '财务', 3, true, 5, '计算并结算最后工资'),
  (9, 2, '离职面谈', 'HR', 4, true, 3, '进行离职面谈并记录原因'),
  (10, 2, '开具离职证明', 'HR', 5, true, 3, '开具离职证明文件'),
  (11, 2, '归档人事档案', 'HR', 6, true, 5, '归档所有人事档案和历史记录');
