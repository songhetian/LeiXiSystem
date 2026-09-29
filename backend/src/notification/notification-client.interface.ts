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