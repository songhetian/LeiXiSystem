/**
 * NotificationClientInterface — 跨模块通知投递边界（ADR-0013 第 3 条）。
 *
 * 业务模块（payroll / attendance / approval / system 等）需要发通知、
 * 或在业务撤销时清理历史通知，都必须注入本接口（token `NOTIFICATION_CLIENT`），
 * 禁止直接 import NotificationService 或直接写 notification 表。
 */
export interface NotificationClientInterface {
  /** 向单个用户投递通知 */
  create(params: {
    userId: number;
    title: string;
    content?: string;
    type?: string;
    relatedId?: number;
    relatedType?: string;
  }): Promise<{ id: number }>;

  /** 向多个用户批量投递通知 */
  createMany(
    users: number[],
    params: {
      title: string;
      content?: string;
      type?: string;
      relatedId?: number;
      relatedType?: string;
    },
  ): Promise<{ count: number }>;

  /**
   * 业务撤销/回滚时清理关联通知（如「算薪批次撤回」需撤销已发布的工资条通知，
   * 且工资条已被删除，遗留通知会指向不存在的单据）。
   */
  removeByRelated(
    relatedType: string,
    relatedId: number,
  ): Promise<{ count: number }>;
}

/**
 * 通知策略快照（只读边界，token `NOTIFICATION_POLICY`）。
 *
 * 审批流等业务模块在「节点到达」「终态」两个时点决定是否发通知时使用：
 *   targetNodes = null → 未配置，流程所有节点都通知；
 *   targetNodes = []   → 显式关闭，一个节点都不通知；
 *   targetNodes = [..] → 只通知数组内的 nodeKey。
 *   targetRoles 语义相同，用于终态/非流程事件的收件方。
 */
export interface NotificationPolicySnapshot {
  targetRoles: string[] | null;
  targetNodes: string[] | null;
}

export interface NotificationPolicyReader {
  getPolicy(eventType: string): Promise<NotificationPolicySnapshot>;
}