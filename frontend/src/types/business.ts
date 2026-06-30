/**
 * 业务类型定义文档
 *
 * 本文件记录：
 * 1. 各模块的标准类型定义
 * 2. 现有代码中缺失的接口
 * 3. 需要规范化改造的结构
 *
 * 命名规范遵循 CONTEXT.md
 */

// ============================================================
// 一、人员模块 (Personnel / Employee)
// ============================================================

export namespace Personnel {
  /**
   * 员工状态枚举
   * @规范 - 使用英文枚举值，'正式' → 'formal'
   */
  export type EmployeeStatus = 'probation' | 'formal' | 'contract' | 'terminated'

  /**
   * 员工状态映射
   */
  export const STATUS_MAP: Record<EmployeeStatus, { text: string; color: string }> = {
    probation: { text: '试用期', color: 'orange' },
    formal: { text: '正式', color: 'green' },
    contract: { text: '合同工', color: 'arcoblue' },
    terminated: { text: '已离职', color: 'red' },
  }

  /**
   * 员工实体（标准格式）
   * @缺失 - 前端 types/index.ts 中缺少 birthday, resignationDate 等字段
   */
  export interface Employee {
    id: number
    /** 工号 */
    employeeNo: string
    /** 姓名 */
    name: string
    /** 部门 ID */
    departmentId?: number
    /** 部门名称 */
    departmentName?: string
    /** 职位 ID */
    positionId?: number
    /** 职位名称 */
    positionName?: string
    /** 手机号 */
    phone?: string
    /** 邮箱 */
    email?: string
    /** 入职日期 */
    hireDate?: string
    /** 状态 */
    status: EmployeeStatus
    /** 性别 */
    gender?: 'male' | 'female' | 'other'
    /** 出生日期 */
    birthDate?: string
    /** 身份证号 */
    idCardNo?: string
    /** 民族 */
    nationality?: string
    /** 婚姻状态 */
    maritalStatus?: 'single' | 'married' | 'divorced' | 'widowed'
    /** 银行卡号 */
    bankAccountNo?: string
    /** 银行名称 */
    bankName?: string
    /** 试用期结束日期 */
    probationEndDate?: string
    /** 转正日期 */
    formalDate?: string
    /** 离职日期 */
    terminationDate?: string
    /** 离职类型 */
    terminationType?: string
    /** 离职原因 */
    terminationReason?: string
    /** 紧急联系人 */
    emergencyContact?: string
    /** 紧急联系电话 */
    emergencyPhone?: string
    /** 住址 */
    address?: string
    /** 学历 */
    education?: string
    /** 技能 */
    skills?: string
    /** 备注 */
    remark?: string
    /** 创建时间 */
    createdAt?: string
    /** 更新时间 */
    updatedAt?: string
  }

  /**
   * 员工查询参数
   */
  export interface EmployeeQueryParams {
    page?: number
    pageSize?: number
    keyword?: string
    departmentId?: number
    positionId?: number
    status?: EmployeeStatus
    gender?: string
    startHireDate?: string
    endHireDate?: string
    sortBy?: string
    orderBy?: 'asc' | 'desc'
  }

  /**
   * 创建员工请求
   */
  export interface CreateEmployeeRequest {
    employeeNo: string
    name: string
    departmentId: number
    positionId: number
    phone: string
    email?: string
    hireDate: string
    gender?: string
    birthDate?: string
    idCardNo?: string
    salary?: number
  }

  /**
   * 更新员工请求
   */
  export type UpdateEmployeeRequest = Partial<CreateEmployeeRequest> & {
    status?: EmployeeStatus
  }

  /**
   * 紧急联系人
   */
  export interface EmergencyContact {
    id?: number
    name: string
    relationship: string
    phone: string
    /** @规范 - 使用 isPrimary 而非 primary */
    isPrimary?: boolean
  }
}

// ============================================================
// 二、组织架构模块 (Organization)
// ============================================================

export namespace Organization {
  /**
   * 部门状态
   */
  export type DepartmentStatus = 'active' | 'inactive'

  /**
   * 部门实体
   */
  export interface Department {
    id: number
    name: string
    code?: string
    parentId?: number
    managerId?: number
    managerName?: string
    sortOrder?: number
    status: DepartmentStatus
    children?: Department[]
    createdAt?: string
  }

  /**
   * 部门树节点
   */
  export interface DepartmentTreeNode {
    key: number
    title: string
    parentId?: number
    children?: DepartmentTreeNode[]
    isLeaf?: boolean
    status?: DepartmentStatus
  }

  /**
   * 职位实体
   */
  export interface Position {
    id: number
    name: string
    code?: string
    departmentId?: number
    level?: number
    status: 'active' | 'inactive'
    description?: string
    createdAt?: string
  }
}

// ============================================================
// 三、考勤模块 (Attendance)
// ============================================================

export namespace Attendance {
  /**
   * 请假类型
   */
  export type LeaveType = 'annual' | 'sick' | 'personal' | 'marital' | 'maternity' | 'paternity' | 'funeral' | 'other'

  /**
   * 请假申请状态
   */
  export type LeaveStatus = 'pending' | 'approved' | 'rejected' | 'cancelled'

  /**
   * 加班申请状态
   */
  export type OvertimeStatus = 'pending' | 'approved' | 'rejected' | 'cancelled'

  /**
   * 打卡状态
   */
  export type CheckinStatus = 'normal' | 'late' | 'early_leave' | 'absent' | 'missing'

  /**
   * 请假申请
   */
  export interface LeaveRequest {
    id: number
    employeeId: number
    employeeName?: string
    leaveType: string
    startDate: string
    endDate: string
    startTime?: string
    endTime?: string
    totalDays: number
    reason?: string
    status: LeaveStatus
    currentApprover?: {
      id: number
      name: string
    }
    approverHistory?: Array<{
      approverId: number
      approverName: string
      action: 'approve' | 'reject'
      comment?: string
      actionTime: string
    }>
    createdAt: string
    updatedAt?: string
  }

  /**
   * 加班申请
   */
  export interface OvertimeRequest {
    id: number
    employeeId: number
    employeeName?: string
    date: string
    startTime: string
    endTime: string
    duration: number
    type: 'weekday' | 'weekend' | 'holiday'
    reason?: string
    status: OvertimeStatus
    currentApprover?: {
      id: number
      name: string
    }
    createdAt: string
  }

  /**
   * 考勤打卡记录
   */
  export interface AttendanceCheckin {
    id: number
    employeeId: number
    employeeName?: string
    date: string
    checkinTime?: string
    checkinStatus?: CheckinStatus
    checkoutTime?: string
    checkoutStatus?: CheckinStatus
    workHours?: number
  }

  /**
   * 日考勤汇总
   */
  export interface AttendanceDaily {
    id: number
    employeeId: number
    date: string
    scheduleType: 'workday' | 'offday' | 'holiday'
    shouldWork: boolean
    actualWork: boolean
    workHours: number
    lateMinutes?: number
    earlyLeaveMinutes?: number
    overtimeHours?: number
    absentDays?: number
    status: 'normal' | 'late' | 'early_leave' | 'absent' | 'leave' | 'overtime'
  }

  /**
   * 月考勤汇总
   */
  export interface AttendanceMonthly {
    id: number
    employeeId: number
    year: number
    month: number
    workDays: number
    actualWorkDays: number
    lateDays: number
    earlyLeaveDays: number
    absentDays: number
    leaveDays: number
    overtimeDays: number
    attendanceRate: number
    isLocked: boolean
    lockedAt?: string
  }

  /**
   * 打卡状态映射
   */
  export const CHECKIN_STATUS_MAP: Record<CheckinStatus, { text: string; color: string }> = {
    normal: { text: '正常', color: 'green' },
    late: { text: '迟到', color: 'orange' },
    early_leave: { text: '早退', color: 'orange' },
    absent: { text: '缺勤', color: 'red' },
    missing: { text: '缺卡', color: 'gray' },
  }
}

// ============================================================
// 四、假期模块 (Vacation)
// ============================================================

export namespace Vacation {
  /**
   * 假期类型
   */
  export interface VacationType {
    id: number
    name: string
    code: string
    totalDays: number
    unit: 'day' | 'hour'
    isCarryOver: boolean
    carryOverDays: number
    isPaid: boolean
    sortOrder: number
    status: 'active' | 'inactive'
    description?: string | null
  }

  /**
   * 假期余额
   */
  export interface VacationBalance {
    id: number
    vacationTypeId: number
    typeName: string
    typeCode: string
    year: number
    total: number
    used: number
    balance: number
    unit: 'day' | 'hour'
  }

  /**
   * 假期申请
   */
  export interface VacationRequest {
    id: number
    employeeId: number
    employeeName?: string
    vacationTypeId: number
    vacationTypeName?: string
    startDate: string
    endDate: string
    totalDays: number
    reason?: string
    status: 'pending' | 'approved' | 'rejected' | 'cancelled'
    balance?: VacationBalance
    createdAt: string
  }
}

// ============================================================
// 五、报销模块 (Reimbursement)
// ============================================================

export namespace Reimbursement {
  /**
   * 报销类型
   */
  export type ReimbursementType = 'travel' | 'communication' | 'meal' | 'entertainment' | 'office' | 'training' | 'other'

  /**
   * 报销状态
   */
  export type ReimbursementStatus = 'pending' | 'approved' | 'rejected' | 'paid' | 'cancelled'

  /**
   * 报销单
   */
  export interface Reimbursement {
    id: number
    employeeId: number
    employeeName?: string
    type: ReimbursementType
    amount: number
    applyDate: string
    description?: string
    receiptCount?: number
    status: ReimbursementStatus
    currentApprover?: {
      id: number
      name: string
    }
    createdAt: string
    updatedAt?: string
  }

  /**
   * 报销类型映射
   */
  export const TYPE_MAP: Record<ReimbursementType, { text: string; color: string }> = {
    travel: { text: '差旅', color: 'blue' },
    communication: { text: '通讯', color: 'green' },
    meal: { text: '餐饮', color: 'orange' },
    entertainment: { text: '招待', color: 'purple' },
    office: { text: '办公', color: 'cyan' },
    training: { text: '培训', color: 'arcoblue' },
    other: { text: '其他', color: 'gray' },
  }
}

// ============================================================
// 六、薪资模块 (Payroll)
// ============================================================

export namespace Payroll {
  /**
   * 薪资组件类型
   */
  export type ComponentType = 'earning' | 'deduction' | 'allowance'

  /**
   * 金额类型
   */
  export type AmountType = 'fixed' | 'formula' | 'percent' | 'attendance_based' | 'manual'

  /**
   * 薪资组件状态
   * @规范 - 已从 enabled 迁移到 status
   */
  export type ComponentStatus = 'active' | 'inactive'

  /**
   * 薪资组件
   * @更新 - 已将 enabled 改为 status: 'active' | 'inactive'
   */
  export interface SalaryComponent {
    id: number
    name: string
    code: string
    type: ComponentType
    amountType: AmountType
    formula?: string | null
    taxable: boolean
    status: ComponentStatus
    sortOrder: number
    createdAt: string
  }

  /**
   * 薪资结构
   */
  export interface SalaryStructure {
    id: number
    name: string
    description?: string
    items: SalaryStructureItem[]
    status: 'active' | 'inactive'
    createdAt: string
  }

  /**
   * 薪资结构项
   */
  export interface SalaryStructureItem {
    id?: number
    componentId: number
    componentName?: string
    componentCode?: string
    amount?: number
    percent?: number
    formula?: string
    isActive?: boolean
  }

  /**
   * 工资单状态
   */
  export type PayslipStatus = 'draft' | 'calculated' | 'published' | 'confirmed' | 'disputed'

  /**
   * 工资单
   */
  export interface Payslip {
    id: number
    employeeId: number
    employeeName?: string
    yearMonth: string
    baseSalary: number
    totalEarnings: number
    totalDeductions: number
    netSalary: number
    status: PayslipStatus
    publishedAt?: string
    confirmedAt?: string
    items: PayslipItem[]
  }

  /**
   * 工资单明细项
   */
  export interface PayslipItem {
    id?: number
    componentName: string
    componentCode: string
    type: ComponentType
    amount: number
    isTaxable: boolean
  }

  /**
   * 薪资调整类型
   */
  export type AdjustmentType = 'bonus' | 'deduction' | 'correction' | 'allowance'

  /**
   * 薪资调整状态
   */
  export type AdjustmentStatus = 'pending' | 'approved' | 'rejected' | 'cancelled'
}

// ============================================================
// 七、绩效模块 (Performance)
// ============================================================

export namespace Performance {
  /**
   * 绩效周期类型
   */
  export type CycleType = 'monthly' | 'quarterly' | 'half_year' | 'yearly'

  /**
   * 绩效周期状态
   */
  export type CycleStatus = 'draft' | 'active' | 'closed'

  /**
   * 绩效周期
   */
  export interface PerformanceCycle {
    id: number
    name: string
    type: CycleType
    startDate: string
    endDate: string
    status: CycleStatus
    selfReviewDeadline?: string
    managerReviewDeadline?: string
    calibrationDeadline?: string
    createdAt: string
  }

  /**
   * 评估状态
   */
  export type ReviewStatus = 'not_started' | 'self_submitted' | 'manager_submitted' | 'completed'

  /**
   * 绩效评估
   */
  export interface PerformanceReview {
    id: number
    cycleId: number
    cycleName?: string
    employeeId: number
    employeeName?: string
    managerId: number
    managerName?: string
    overallRating?: number
    selfRating?: number
    managerRating?: number
    finalRating?: number
    selfReviewStatus: ReviewStatus
    managerReviewStatus: ReviewStatus
    developmentPlan?: string
    promotionRecommendation?: boolean
    createdAt: string
    updatedAt?: string
  }

  /**
   * 绩效目标
   */
  export interface PerformanceGoal {
    id: number
    cycleId: number
    employeeId: number
    title: string
    description?: string
    weight: number
    targetValue?: string
    actualValue?: string
    status: 'pending' | 'in_progress' | 'completed' | 'cancelled'
    progress?: number
    dueDate?: string
    createdAt: string
  }
}

// ============================================================
// 八、招聘模块 (Recruitment)
// ============================================================

export namespace Recruitment {
  /**
   * 招聘需求状态
   */
  export type RequestStatus = 'draft' | 'approved' | 'open' | 'closed' | 'cancelled'

  /**
   * 招聘需求
   */
  export interface RecruitmentRequest {
    id: number
    title: string
    departmentId: number
    departmentName?: string
    positionId: number
    positionName?: string
    headcount: number
    requestReason?: string
    requirements?: string
    salaryRange?: {
      min: number
      max: number
    }
    status: RequestStatus
    requesterId: number
    requesterName?: string
    createdAt: string
  }

  /**
   * 职位空缺状态
   */
  export type JobStatus = 'open' | 'closed' | 'on_hold' | 'filled'

  /**
   * 职位空缺
   */
  export interface JobOpening {
    id: number
    requestId?: number
    title: string
    departmentId: number
    departmentName?: string
    positionId: number
    positionName?: string
    description?: string
    requirements?: string
    salaryRange?: {
      min: number
      max: number
    }
    status: JobStatus
    publishedAt?: string
    closedAt?: string
    source?: string
    candidateCount?: number
  }

  /**
   * 候选人状态
   */
  export type CandidateStatus = 'new' | 'screening' | 'interviewing' | 'offer' | 'hired' | 'rejected' | 'withdrawn'

  /**
   * 候选人
   */
  export interface Candidate {
    id: number
    jobId?: number
    jobTitle?: string
    name: string
    email: string
    phone: string
    gender?: 'male' | 'female' | 'other'
    birthDate?: string
    idCardNo?: string
    nationality?: string
    maritalStatus?: 'single' | 'married' | 'divorced' | 'widowed'
    address?: string
    currentCompany?: string
    currentPosition?: string
    expectedSalary?: number
    currentSalary?: number
    noticePeriodDays?: number
    resumeUrl?: string
    source?: string
    status: CandidateStatus
    interviewerIds?: number[]
    createdAt: string
    updatedAt?: string
  }

  /**
   * 面试记录
   */
  export interface InterviewRound {
    id: number
    candidateId: number
    candidateName?: string
    round: number
    type: 'phone' | 'video' | 'onsite'
    interviewerId: number
    interviewerName?: string
    scheduledAt: string
    duration?: number
    location?: string
    result?: 'pass' | 'fail' | 'pending'
    feedback?: string
    rating?: number
  }
}

// ============================================================
// 九、资产管理模块 (Asset)
// ============================================================

export namespace Asset {
  /**
   * 资产分类状态
   */
  export type CategoryStatus = 'active' | 'inactive'

  /**
   * 资产状态
   */
  export type AssetStatus = 'available' | 'assigned' | 'maintenance' | 'retired' | 'lost'

  /**
   * 资产分类
   */
  export interface AssetCategory {
    id: number
    name: string
    code: string
    parentId?: number
    description?: string
    status: CategoryStatus
    sortOrder?: number
    assetCount?: number
  }

  /**
   * 资产
   */
  export interface AssetItem {
    id: number
    name: string
    code: string
    categoryId: number
    categoryName?: string
    brand?: string
    model?: string
    serialNumber?: string
    purchaseDate?: string
    warrantyEndDate?: string
    purchasePrice?: number
    currentValue?: number
    status: AssetStatus
    location?: string
    description?: string
    assignedTo?: number
    assignedToName?: string
    assignedAt?: string
    returnAt?: string
  }

  /**
   * 资产分配记录
   */
  export interface AssetAssignment {
    id: number
    assetId: number
    assetName?: string
    assetCode?: string
    employeeId: number
    employeeName?: string
    type: 'assign' | 'return' | 'transfer'
    assignedBy?: number
    assignedByName?: string
    assignedAt: string
    returnAt?: string
    note?: string
  }
}

// ============================================================
// 十、工单模块 (Helpdesk)
// ============================================================

export namespace Helpdesk {
  /**
   * 工单状态
   */
  export type TicketStatus = 'open' | 'processing' | 'resolved' | 'closed' | 'cancelled'

  /**
   * 工单优先级
   */
  export type TicketPriority = 'low' | 'normal' | 'high' | 'urgent'

  /**
   * 工单
   */
  export interface HelpdeskTicket {
    id: number
    title: string
    categoryId: number
    categoryName?: string
    employeeId: number
    employeeName?: string
    assigneeId?: number
    assigneeName?: string
    priority: TicketPriority
    status: TicketStatus
    description: string
    slaDeadline?: string
    resolution?: string
    feedbackRating?: number
    resolutionAt?: string
    closedAt?: string
    createdAt: string
    updatedAt?: string
  }

  /**
   * 工单评论
   */
  export interface TicketComment {
    id: number
    ticketId: number
    authorId: number
    authorName?: string
    authorType: 'employee' | 'assignee' | 'system'
    content: string
    isInternal: boolean
    createdAt: string
  }

  /**
   * 工单分类
   */
  export interface TicketCategory {
    id: number
    name: string
    parentId?: number
    priority: TicketPriority
    slaHours?: number
    isActive: boolean
    assigneeRoleId?: number
  }
}

// ============================================================
// 十一、审批流模块 (Approval)
// ============================================================

export namespace Approval {
  /**
   * 审批节点类型
   */
  export type NodeType = 'start' | 'approval' | 'cc' | 'condition' | 'end'

  /**
   * 审批节点
   */
  export interface ApprovalNode {
    id?: number
    type: NodeType
    name: string
    assigneeType: 'user' | 'role' | 'manager' | 'dynamic'
    assigneeId?: number
    assigneeName?: string
    assigneeRole?: string
    isRequired: boolean
    allowSelfApprove: boolean
    timeoutHours?: number
    timeoutAction?: 'auto_approve' | 'auto_reject' | 'remind'
  }

  /**
   * 审批流程定义
   */
  export interface ApprovalWorkflow {
    id: number
    name: string
    code: string
    description?: string
    resourceType: string
    nodes: ApprovalNode[]
    isActive: boolean
    version: number
    createdAt: string
    updatedAt?: string
  }

  /**
   * 审批记录
   */
  export interface ApprovalRecord {
    id: number
    workflowId: number
    resourceType: string
    resourceId: number
    nodeId: number
    nodeName?: string
    approverId: number
    approverName?: string
    action: 'approve' | 'reject' | 'withdraw' | 'transfer'
    comment?: string
    actionTime: string
    transferTo?: number
  }

  /**
   * 待我审批项
   */
  export interface PendingApproval {
    id: number
    resourceType: string
    resourceId: number
    resourceTitle: string
    requesterId: number
    requesterName: string
    nodeName: string
    workflowName?: string
    createdAt: string
    deadline?: string
    isOverdue: boolean
  }
}

// ============================================================
// 缺失接口清单
// ============================================================

/**
 * 缺失接口清单（待实现）
 *
 * 按模块列出现有代码中缺失的接口
 */
export const MISSING_APIS = {
  /** 说明：以下为最初识别出的缺失接口，目前均已实现
   *  - high 优先级：全部已实现
   *  - medium 优先级：全部已实现
   *  - 部分接口通过查询参数方式提供等效功能（如 /lifecycle/contracts?employeeId=:id）
   */

  /** 人员模块 */
  personnel: [
    { method: 'POST', path: '/employees/batch-delete', desc: '批量删除员工', priority: 'high', status: 'completed' },
    { method: 'POST', path: '/employees/batch-status', desc: '批量更新员工状态', priority: 'high', status: 'completed' },
    { method: 'POST', path: '/employees/export', desc: '导出员工列表', priority: 'medium', status: 'completed' },
    { method: 'GET', path: '/employees/:id/contracts', desc: '获取员工合同列表（等效：/lifecycle/contracts?employeeId=:id）', priority: 'medium', status: 'completed' },
    { method: 'GET', path: '/employees/:id/documents', desc: '获取员工文档列表（等效：/lifecycle/documents?employeeId=:id）', priority: 'medium', status: 'completed' },
    { method: 'GET', path: '/employees/:id/onboarding', desc: '获取员工入职任务（等效：/lifecycle/onboarding-tasks?employeeId=:id）', priority: 'medium', status: 'completed' },
    { method: 'GET', path: '/employees/:id/offboarding', desc: '获取员工离职任务（等效：/lifecycle/offboarding-tasks?employeeId=:id）', priority: 'medium', status: 'completed' },
  ],

  /** 考勤模块 */
  attendance: [
    { method: 'POST', path: '/attendance/corrections/batch-approve', desc: '批量审批补卡申请', priority: 'high', status: 'completed' },
    { method: 'GET', path: '/attendance/statistics', desc: '考勤统计报表', priority: 'medium', status: 'completed' },
    { method: 'POST', path: '/attendance/records/export', desc: '导出考勤记录', priority: 'medium', status: 'completed' },
    { method: 'POST', path: '/attendance/clock-in/repair', desc: '补打卡（等效：/attendance/corrections 提交补卡申请）', priority: 'medium', status: 'completed' },
  ],

  /** 假期模块 */
  vacation: [
    { method: 'POST', path: '/vacation/balance/adjust', desc: '调整假期余额', priority: 'high', status: 'completed' },
    { method: 'GET', path: '/vacation/balance/:employeeId/:year', desc: '获取员工年度假期余额（等效：/vacation/balance?employeeId=:id&year=:year）', priority: 'medium', status: 'completed' },
    { method: 'POST', path: '/adjustment/leave/batch-approve', desc: '批量审批假期申请', priority: 'high', status: 'completed' },
  ],

  /** 薪资模块 */
  payroll: [
    { method: 'POST', path: '/payroll/runs/:id/publish', desc: '发布薪资批次', priority: 'high', status: 'completed' },
    { method: 'GET', path: '/payroll/reports/summary', desc: '薪资汇总报表', priority: 'medium', status: 'completed' },
    { method: 'POST', path: '/payroll/payslips/export', desc: '导出工资单', priority: 'medium', status: 'completed' },
    { method: 'POST', path: '/payroll/payslips/:id/confirm', desc: '员工确认工资单', priority: 'high', status: 'completed' },
    { method: 'POST', path: '/payroll/payslips/:id/dispute', desc: '员工对工资单有异议', priority: 'high', status: 'completed' },
  ],

  /** 绩效模块 */
  performance: [
    { method: 'POST', path: '/performance/cycles/:id/activate', desc: '启用绩效周期', priority: 'high', status: 'completed' },
    { method: 'POST', path: '/performance/cycles/:id/close', desc: '关闭绩效周期', priority: 'high', status: 'completed' },
    { method: 'POST', path: '/performance/reviews/export', desc: '导出绩效结果', priority: 'medium', status: 'completed' },
  ],

  /** 招聘模块 */
  recruitment: [
    { method: 'POST', path: '/recruitment/requests/:id/open', desc: '开启招聘需求', priority: 'high', status: 'completed' },
    { method: 'POST', path: '/recruitment/requests/:id/close', desc: '关闭招聘需求', priority: 'high', status: 'completed' },
    { method: 'POST', path: '/recruitment/candidates/export', desc: '导出候选人列表', priority: 'medium', status: 'completed' },
  ],

  /** 资产模块 */
  asset: [
    { method: 'POST', path: '/assets/batch-assign', desc: '批量分配资产', priority: 'high', status: 'completed' },
    { method: 'POST', path: '/assets/batch-return', desc: '批量归还资产', priority: 'high', status: 'completed' },
    { method: 'POST', path: '/assets/assignments/export', desc: '导出资产分配记录', priority: 'medium', status: 'completed' },
  ],

  /** 工单模块 */
  helpdesk: [
    { method: 'POST', path: '/helpdesk/tickets/batch-assign', desc: '批量分配工单', priority: 'high', status: 'completed' },
    { method: 'POST', path: '/helpdesk/tickets/batch-resolve', desc: '批量解决工单', priority: 'high', status: 'completed' },
    { method: 'POST', path: '/helpdesk/tickets/batch-close', desc: '批量关闭工单', priority: 'high', status: 'completed' },
  ],
} as const

// ============================================================
// 不规范结构清单
// ============================================================

/**
 * 不规范结构清单
 *
 * 记录现有代码中需要规范化改造的结构
 */
export const IRREGULAR_STRUCTURES = [
  {
    file: 'frontend/src/types/index.ts',
    issue: 'User 类型同时存在 real_name 和 realName',
    current: '{ realName?: string; real_name: string }',
    suggestion: '统一为 realName: string',
    status: 'fixed',
  },
  {
    file: 'frontend/src/types/index.ts',
    issue: 'User 类型同时存在 department_id 和 departmentId',
    current: '{ department_id?: number; departmentId?: number }',
    suggestion: '统一为 departmentId?: number',
    status: 'fixed',
  },
  {
    file: 'frontend/src/api/personnel.ts',
    issue: 'EmployeeListResponse 结构与标准不一致',
    current: '{ code: 0; data: Employee[]; total, page, pageSize }',
    suggestion: '统一为 { code: 0; data: { list: Employee[]; total, page, pageSize } }',
    status: 'fixed',
  },
  {
    file: 'backend/src/routes/payroll/components.ts',
    issue: 'SalaryComponent 使用 enabled 布尔字段',
    current: 'enabled: boolean',
    suggestion: '改为 status: "active" | "inactive"',
    status: 'fixed',
  },
  {
    file: 'frontend/src/pages/payroll/components/index.tsx',
    issue: '薪资组件表单使用 Switch 而非 Select',
    current: 'field="enabled" with Switch',
    suggestion: '改为 field="status" with Select',
    status: 'fixed',
  },
  {
    file: 'frontend/src/api/shift.ts',
    issue: 'API 路径使用 /list 后缀',
    current: '/shift/list',
    suggestion: '改为 /shifts（RESTful 名词复数）',
    status: 'fixed',
  },
  {
    file: 'frontend/src/api/reimbursement.ts',
    issue: 'API 路径使用 /list 后缀',
    current: '/reimbursement/list',
    suggestion: '改为 /reimbursements',
    status: 'fixed',
  },
  {
    file: 'frontend/src/api/notification.ts',
    issue: 'API 路径使用 /list 后缀',
    current: '/notification/list',
    suggestion: '改为 /notifications',
    status: 'fixed',
  },
  {
    file: 'backend/src/routes/**',
    issue: '审计日志 action 使用 snake_case',
    current: 'leave_create, employee_update',
    suggestion: '改为点号分隔：leave.create, employee.update',
    status: 'fixed',
  },
  {
    file: 'backend/src/utils/schemas/status.ts',
    issue: '员工状态枚举中英文混用',
    current: "'probation' | '正式' | 'contract' | 'terminated'",
    suggestion: "改为 'probation' | 'formal' | 'contract' | 'terminated'",
    status: 'fixed',
  },
] as const
