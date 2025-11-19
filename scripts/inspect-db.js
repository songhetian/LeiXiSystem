const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'root',
  database: process.env.DB_NAME || 'leixin_customer_service',
  port: process.env.DB_PORT || 3306,
};

async function inspectTables() {
  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    console.log('Connected to the database.');

    const showDescribe = async (table) => {
      try {
        const [rows] = await connection.execute('DESCRIBE ' + table);
        console.log(`\nDescribing ${table} table:`);
        console.table(rows);
      } catch (e) {
        console.log(`\nTable ${table} not found.`);
      }
    };

    const showExists = async (table) => {
      const [rows] = await connection.execute(
        'SELECT COUNT(*) as cnt FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?',
        [dbConfig.database, table]
      );
      console.log(`Table ${table} exists: ${rows[0].cnt > 0}`);
    };

    await showExists('users');
    await showExists('conversations');
    await showExists('conversation_members');
    await showExists('messages');
    await showExists('message_status');

    await showDescribe('users');
    await showDescribe('conversations');
    await showDescribe('conversation_members');
    await showDescribe('messages');
    await showDescribe('message_status');

    const showCreate = async (table) => {
      try {
        const [rows] = await connection.execute('SHOW CREATE TABLE ' + table);
        console.log(`\nShow create for ${table}:`);
        console.log(rows[0]['Create Table']);
      } catch (e) {
        console.log(`\nCannot show create for ${table}.`);
      }
    };

    await showCreate('conversations');
    await showCreate('conversation_members');

    console.log('\nChecking migrations_history table:');
    const [migrations] = await connection.execute('SELECT * FROM migrations_history');
    console.table(migrations);

  } catch (error) {
    console.error('Error inspecting database:', error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('Database connection closed.');
    }
  }
}

inspectTables();