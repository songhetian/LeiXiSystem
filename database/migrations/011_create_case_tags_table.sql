
CREATE TABLE IF NOT EXISTS case_tags (
    case_id INT NOT NULL COMMENT '案例ID',
    tag_id INT NOT NULL COMMENT '标签ID',
    PRIMARY KEY (case_id, tag_id),
    FOREIGN KEY (case_id) REFERENCES quality_cases(id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE -- Assuming a 'tags' table exists
);
