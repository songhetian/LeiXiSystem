const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'root',
  port: process.env.DB_PORT || 3306,
  multipleStatements: true
};

async function resetDatabase() {
  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    console.log('Connected to MySQL server.');

    const dbName = process.env.DB_NAME || 'leixin_customer_service';

    // Drop database if exists
    console.log(`Dropping database ${dbName} if it exists...`);
    await connection.query(`DROP DATABASE IF EXISTS \`${dbName}\``);
    console.log(`Database ${dbName} dropped successfully.`);

    // Create database
    console.log(`Creating database ${dbName}...`);
    await connection.query(`CREATE DATABASE \`${dbName}\` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    console.log(`Database ${dbName} created successfully.`);

    console.log('\\nDatabase reset complete. You can now run migrations.');

  } catch (error) {
    console.error('Error resetting database:', error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('Database connection closed.');
    }
  }
}

resetDatabase();
