/**
 * 缓存预热工具类
 * 理由：在服务器启动时预先拉取高频数据，消除用户首个请求的数据库 IO 延迟感
 */
async function warmUp(fastify) {
    const pool = fastify.mysql || global.pool;
    const redis = fastify.redis;
    if (!pool || !redis) return;

    try {
        console.log('🚀 [Warm-up] 正在预热核心业务缓存...');
        
        // 1. 预热质检标签池 (常用标签)
        const [tags] = await pool.query('SELECT * FROM tags WHERE is_active = 1 ORDER BY usage_count DESC');
        await redis.set('cache:quality:all_tags', JSON.stringify(tags), 'EX', 3600);
        
        // 2. 预热知识库公共分类
        const [categories] = await pool.query('SELECT * FROM knowledge_categories WHERE is_deleted = 0 AND type = "common"');
        await redis.set('cache:knowledge:common_categories', JSON.stringify(categories), 'EX', 3600);

        console.log('✅ [Warm-up] 缓存预热完成，首屏响应已加速');
    } catch (error) {
        console.warn('⚠️ [Warm-up] 预热失败(但不影响运行):', error.message);
    }
}

module.exports = { warmUp };
