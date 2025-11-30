const bcrypt = require('bcrypt');
const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'root',
    database: process.env.DB_NAME || 'leixin_customer_service',
    port: process.env.DB_PORT || 3306
};

async function resetPassword() {
    let connection;
    try {
        connection = await mysql.createConnection(dbConfig);
        console.log('✓ 已连接到数据库');

        // 1. 获取当前 admin 用户信息
        const [users] = await connection.query('SELECT * FROM users WHERE username = ?', ['admin']);

        if (users.length === 0) {
            console.error('❌ 未找到 admin 用户');
            return;
        }

        const admin = users[0];
        console.log('当前 admin 哈希:', admin.password_hash);

        // 2. 尝试验证密码 123456
        const password = '123456';
        const isValid = await bcrypt.compare(password, admin.password_hash);

        console.log(`密码 "${password}" 验证结果: ${isValid ? '✅ 通过' : '❌ 失败'}`);

        if (!isValid) {
            console.log('\n正在重置 admin 密码...');

            // 3. 生成新的哈希
            const newHash = await bcrypt.hash(password, 10);
            console.log('新哈希:', newHash);

            // 4. 更新数据库
            await connection.query('UPDATE users SET password_hash = ? WHERE id = ?', [newHash, admin.id]);
            console.log('✅ admin 密码已重置为: 123456');

            // 验证新密码
            const isNewValid = await bcrypt.compare(password, newHash);
            console.log(`新密码验证结果: ${isNewValid ? '✅ 通过' : '❌ 失败'}`);
        } else {
            console.log('密码已经是正确的，无需重置。');
        }

    } catch (error) {
        console.error('❌ 错误:', error);
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

resetPassword();
