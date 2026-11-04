import { Injectable, OnModuleDestroy } from '@nestjs/common';

/**
 * Redis 故障时的进程内兜底存储（S23 / D2 / D3）。
 *
 * 只用于「短时效、丢失可接受」的鉴权标记：
 *   - 登录失败计数（A2）
 *   - JWT 黑名单 / 单设备会话镜像（A3）
 *   - 工资条二级密码通行证（B1）
 *
 * 语义刻意与 RedisService 对齐（get 未命中返回 null，incr 原子自增且不重置窗口），
 * 使调用方可以在「Redis 不可用」时无缝切换。注意：单进程内有效，多实例部署精度
 * 退化为单实例，但不会像 fail-open 那样完全失守。
 */
@Injectable()
export class LocalFallbackStore implements OnModuleDestroy {
  private readonly map = new Map<string, { value: string; expireAt: number }>();
  private readonly cleanupTimer: ReturnType<typeof setInterval>;

  constructor() {
    this.cleanupTimer = setInterval(() => this.sweep(), 60_000);
    if (this.cleanupTimer.unref) this.cleanupTimer.unref();
  }

  onModuleDestroy(): void {
    clearInterval(this.cleanupTimer);
    this.map.clear();
  }

  get(key: string): string | null {
    const entry = this.map.get(key);
    if (!entry) return null;
    if (entry.expireAt <= Date.now()) {
      this.map.delete(key);
      return null;
    }
    return entry.value;
  }

  set(key: string, value: string, ttlSeconds: number): void {
    if (ttlSeconds <= 0) return;
    this.map.set(key, { value, expireAt: Date.now() + ttlSeconds * 1000 });
  }

  /** 固定窗口自增：窗口内自增不重置过期时间（与 Redis INCR + 首次 EXPIRE 一致） */
  incr(key: string, ttlSeconds: number): number {
    const now = Date.now();
    const entry = this.map.get(key);
    if (!entry || entry.expireAt <= now) {
      this.map.set(key, { value: '1', expireAt: now + ttlSeconds * 1000 });
      return 1;
    }
    const next = Number(entry.value) + 1;
    entry.value = String(next);
    return next;
  }

  del(key: string): void {
    this.map.delete(key);
  }

  private sweep(): void {
    const now = Date.now();
    for (const [key, entry] of this.map) {
      if (entry.expireAt <= now) this.map.delete(key);
    }
  }
}
