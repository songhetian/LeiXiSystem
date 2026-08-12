/**
 * 缓存预热引擎 (CacheWarmer)
 * 理由：在系统启动时将高频访问的静态数据及复杂统计指标提前载入 Redis，实现毫秒级首屏响应
 */
class CacheWarmer {
    constructor(pool, redis) {
        this.pool = pool;
        this.redis = redis;
    }

    /**
     * 执行全量预热任务
     */
    async runAll() {
        if (!this.pool || !this.redis) {
            console.warn('⚠️ [CacheWarmer] 数据库或 Redis 连接未就绪，跳过预热');
            return;
        }

        console.log('🚀 [CacheWarmer] 启动全量缓存预热任务...');
        
        try {
            await Promise.all([
                this.warmUpTags(),
                this.warmUpKnowledgeCategories(),
                this.warmUpCommonConfigs()
            ]);
            console.log('✅ [CacheWarmer] 全量预热任务顺利完成');
        } catch (error) {
            console.error('❌ [CacheWarmer] 预热过程中发生错误:', error);
        }
    }

    /**
     * 预热质检标签池
     */
    async warmUpTags() {
        const [tags] = await this.pool.query('SELECT * FROM tags WHERE is_active = 1 ORDER BY usage_count DESC');
        await this.redis.set('cache:quality:all_tags', JSON.stringify(tags), 'EX', 86400); // 缓存24小时
    }

    /**
     * 预热知识库分类
     */
    async warmUpKnowledgeCategories() {
        const [categories] = await this.pool.query('SELECT * FROM knowledge_categories WHERE is_deleted = 0 AND type = "common"');
        await this.redis.set('cache:knowledge:common_categories', JSON.stringify(categories), 'EX', 86400);
    }

    /**
     * 预热系统通用配置
     */
    async warmUpCommonConfigs() {
        // 后续可扩展部门列表、职位列表等
        const [depts] = await this.pool.query('SELECT id, name FROM departments WHERE status = "active"');
        await this.redis.set('cache:system:depts', JSON.stringify(depts), 'EX', 86400);
    }
}

// 辅助函数，保持向后兼容
async function warmUp(fastify) {
    const instance = new CacheWarmer(fastify.mysql || global.pool, fastify.redis);
    return instance.runAll();
}

module.exports = CacheWarmer;
module.exports.warmUp = warmUp;
