CREATE TABLE IF NOT EXISTS knowledge_article_daily_stats (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    article_id BIGINT UNSIGNED NOT NULL,
    stat_date DATE NOT NULL,
    views_count INT DEFAULT 0,
    full_reads_count INT DEFAULT 0,
    total_duration_seconds BIGINT DEFAULT 0,
    total_active_seconds BIGINT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_article_date (article_id, stat_date),
    KEY idx_article_id (article_id),
    CONSTRAINT fk_daily_stats_article FOREIGN KEY (article_id) REFERENCES knowledge_articles(id) ON DELETE CASCADE
);