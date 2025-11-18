CREATE TABLE IF NOT EXISTS platforms (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE COMMENT '平台名称',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS shops (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL COMMENT '店铺名称',
    platform_id INT NOT NULL COMMENT '所属平台ID',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (platform_id) REFERENCES platforms(id) ON DELETE CASCADE
);

-- Insert sample data
INSERT INTO platforms (name) VALUES ('天猫'), ('京东'), ('拼多多');

INSERT INTO shops (platform_id, name) VALUES
(1, '官方旗舰店'),
(1, '品牌专卖店'),
(2, '京东自营'),
(2, 'POP店铺'),
(3, '品牌官方店');
