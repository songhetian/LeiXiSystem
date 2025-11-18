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

    console.log('\nDescribing users table:');
    const [fieldsUsers] = await connection.execute('DESCRIBE users');
    console.table(fieldsUsers);

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