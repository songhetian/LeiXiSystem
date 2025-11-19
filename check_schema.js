const mysql = require('mysql2/promise');

async function checkSchema() {
  const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: 'root',
    database: 'leixin_customer_service'
  });

  try {
    const [rows] = await pool.query('DESCRIBE schedules');
    console.log('Schedules table schema:');
    console.log(JSON.stringify(rows, null, 2));
  } catch (error) {
    console.error('Error:', error.message);
  }
  process.exit();
}

checkSchema();
