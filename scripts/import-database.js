const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'root',
  port: process.env.DB_PORT || 3306,
  multipleStatements: true
};

async function importDatabase() {
  let connection;
  try {
    // Connect without specifying database (to drop and recreate it)
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ Connected to MySQL server.');

    // Read the complete SQL file
    const sqlFilePath = path.join(__dirname, '../database/leixin_customer_service_complete.sql');

    if (!fs.existsSync(sqlFilePath)) {
      throw new Error(`SQL file not found: ${sqlFilePath}`);
    }

    console.log('📖 Reading SQL file...');
    const sql = fs.readFileSync(sqlFilePath, 'utf8');

    console.log('🔄 Importing database...');
    console.log('   This may take a few moments...');

    // Execute the SQL file
    await connection.query(sql);

    console.log('✅ Database imported successfully!');
    console.log('📊 Database: leixin_customer_service');
    console.log('📝 All tables and data have been created.');

  } catch (error) {
    console.error('❌ Error importing database:', error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔌 Database connection closed.');
    }
  }
}

importDatabase();
