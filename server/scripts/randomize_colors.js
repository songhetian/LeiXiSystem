
const mysql = require('mysql2/promise');

const dbConfig = {
  host: 'localhost',
  user: 'tian',
  password: 'root',
  database: 'leixin_customer_service',
  port: 3306
};

const colors = [
  '#3B82F6', // blue
  '#10B981', // green
  '#8B5CF6', // purple
  '#F59E0B', // orange
  '#EC4899', // pink
  '#6366F1', // indigo
  '#14B8A6', // teal
  '#06B6D4', // cyan
  '#EF4444', // red
  '#F97316', // orange-600
  '#84CC16', // lime
  '#22C55E', // green-500
  '#0EA5E9', // sky
  '#A855F7', // purple-500
  '#D946EF', // fuchsia
  '#F43F5E'  // rose
];

async function randomizeColors() {
  let connection;
  try {
    console.log('Connecting to database...');
    connection = await mysql.createConnection(dbConfig);
    console.log('Connected.');

    // Get all shifts
    const [shifts] = await connection.query('SELECT id, name FROM work_shifts');
    console.log(`Found ${shifts.length} shifts.`);

    for (let i = 0; i < shifts.length; i++) {
      const shift = shifts[i];
      // Use modulo to cycle through colors
      const color = colors[i % colors.length];

      console.log(`Updating shift ${shift.id} (${shift.name}) with color ${color}`);
      await connection.query('UPDATE work_shifts SET color = ? WHERE id = ?', [color, shift.id]);
    }

    console.log('All shifts updated successfully.');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

randomizeColors();
