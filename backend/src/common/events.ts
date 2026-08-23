/**
 * 全局领域事件统一事件名常量。
 * listener 的 @OnEvent 与业务侧 eventEmitter.emit 必须引用同一常量，
 * 避免两侧手写字面量不一致导致绑定失效（历史 bug 根因）。
 */
export const EVENT_PAYROLL_STATUS_CHANGED = 'payroll.status.changed';