/**
 * ApprovalClientInterface — minimal cross-module boundary for the approval
 * subsystem (ADR-0013: no cross-module service writes).
 *
 * Other modules (reimbursement, attendance, ...) should inject this interface
 * via the `APPROVAL_CLIENT` token instead of the full ApprovalService or
 * direct Prisma access to the approvalInstance table.
 */
export interface ApprovalClientInterface {
  startInstance(params: {
    workflowCode: string;
    title: string;
    formData?: Record<string, any>;
    userId: number;
    userName: string;
    departmentId?: number;
    ccEmployeeIds?: number[];
  }): Promise<{ id: number; status: string; [key: string]: any }>;

  approve(params: {
    instanceId: number;
    userId: number;
    userName: string;
    comment?: string;
  }): Promise<{ status: string; [key: string]: any }>;

  reject(params: {
    instanceId: number;
    userId: number;
    userName: string;
    comment?: string;
  }): Promise<void>;

  /**
   * Withdraws a pending approval instance on behalf of its applicant.
   * Needed by consumer modules (e.g. reimbursement) that cancel a business
   * document which is already attached to an in-flight approval instance.
   */
  withdraw(params: {
    instanceId: number;
    userId: number;
    reason?: string;
  }): Promise<void>;

  getInstanceStatus(
    instanceId: number,
  ): Promise<{ status: string; id: number; [key: string]: any } | null>;

  /**
   * Returns the IDs of pending approval instances for the given workflow code
   * where the supplied user is an approver on the current node.
   */
  listPendingForUser(
    userId: number,
    workflowCode: string,
  ): Promise<number[]>;

  /**
   * 与待办列表（listTodos）同口径的待办数量，供首页「待审批」徽标使用。
   * 不可改用 approvalRecord.approverId 直接计数：建实例时写入的记录不带
   * approverId（该字段只在加签/转交/实际处理时写入），按它统计恒为 0。
   */
  countPendingForUser(userId: number): Promise<number>;

  /**
   * 首页待办卡片：当前用户待办前 N 条（listTodos 同口径、createdAt 倒序），
   * 只返回前端渲染所需的最小字段集。
   */
  listTodoTop(userId: number, take: number): Promise<ApprovalTodoTopItem[]>;

  /**
   * 首页「我的申请」卡片：当前用户最近提交的 N 条审批单（listMySubmissions 同口径），
   * 只返回 title/status/createdAt 等最小字段集。
   */
  listMySubmissionsTop(userId: number, take: number): Promise<ApprovalSubmissionTopItem[]>;
}

/** 首页待办卡片条目（listTodos 条目的最小字段投影） */
export interface ApprovalTodoTopItem {
  id: number;
  instanceId: number;
  title: string;
  createdAt: Date;
}

/** 首页「我的申请」卡片条目（ApprovalInstance 的最小字段投影） */
export interface ApprovalSubmissionTopItem {
  id: number;
  title: string;
  status: string;
  createdAt: Date;
}
