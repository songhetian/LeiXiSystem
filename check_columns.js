require('dotenv').config();
require('dotenv').config();
const mysql = require('mysql2/promise');
const config = require('./server/config');

(async () => {
  try {
    const conn = await mysql.createConnection(config.database);
    const [columns] = await conn.query('SHOW COLUMNS FROM vacation_balances');
    console.log('Columns in vacation_balances:');
    columns.forEach(row => console.log(row.Field));
    await conn.end();
  } catch (err) {
    console.error(err);
  }
})();
