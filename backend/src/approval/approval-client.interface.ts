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
}
