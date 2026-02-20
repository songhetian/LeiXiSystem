const dayjs = require('dayjs');

/**
 * 缓存预热工具
 * 负责在系统启动时或定时任务中提前计算高频、耗时的统计数据并存入 Redis
 */
class CacheWarmer {
  constructor(pool, redis) {
    this.pool = pool;
    this.redis = redis;
  }

  /**
   * 预热全公司/关键部门的考勤统计
   */
  async warmAttendanceStats() {
    if (!this.redis) return;
    
    console.log('🔥 [CacheWarmer] 开始预热考勤统计缓存...');
    try {
      const year = dayjs().year();
      const month = dayjs().month() + 1;
      
      // 1. 获取所有活跃部门
      const [departments] = await this.pool.query('SELECT id, name FROM departments WHERE status != "deleted"');
      
      for (const dept of departments) {
        // 模拟调用统计逻辑（这里简化处理，实际可封装通用 Service）
        const cacheKey = `stats:attendance:dept:${dept.id}:${year}:${month}`;
        
        // 检查缓存是否已存在
        const exists = await this.redis.exists(cacheKey);
        if (!exists) {
          console.log(`   - 正在预热部门: ${dept.name} (${year}-${month})`);
          // 注意：此处可根据实际 routes/attendance-stats.js 逻辑进行计算，或发送内部 HTTP 请求
          // 为了演示，我们先建立预热框架，后续可将核心计算逻辑抽离复用
        }
      }
      console.log('✅ [CacheWarmer] 考勤统计预热完成');
    } catch (err) {
      console.error('❌ [CacheWarmer] 预热失败:', err.message);
    }
  }

  /**
   * 预热系统公告/常用配置
   */
  async warmCommonConfig() {
    // ... 预热常用且不常变动的数据
  }

  /**
   * 执行所有预热任务
   */
  async runAll() {
    await this.warmAttendanceStats();
    await this.warmCommonConfig();
  }
}

module.exports = CacheWarmer;