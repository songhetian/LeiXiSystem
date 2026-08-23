const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.$queryRawUnsafe(
  `SELECT DATE_FORMAT(work_date,'%Y-%m') AS ym, CAST(COUNT(*) AS UNSIGNED) AS c FROM schedules GROUP BY ym ORDER BY ym DESC LIMIT 12`,
)
  .then((r) => console.log(JSON.stringify(r, (_, v) => (typeof v === 'bigint' ? Number(v) : v), 2)))
  .catch((e) => console.error('ERR', e.message))
  .finally(() => p.$disconnect());