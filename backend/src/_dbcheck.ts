import 'reflect-metadata';
import * as dotenv from 'dotenv';
dotenv.config({ path: '../.env' });
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const shifts = await prisma.shift.findMany({ select: { id: true, name: true, color: true } });
  console.log('SHIFTS:', JSON.stringify(shifts, null, 2));
  const scheds = await prisma.schedule.findMany({
    take: 10,
    select: { id: true, employeeId: true, shiftId: true, workDate: true },
    orderBy: { workDate: 'asc' },
  });
  console.log('SCHEDULES:', JSON.stringify(scheds, null, 2));
  const byMonth = await prisma.$queryRawUnsafe(
    `SELECT DATE_FORMAT(work_date, '%Y-%m') AS ym, COUNT(*) AS cnt
     FROM schedules GROUP BY ym ORDER BY ym`,
  );
  console.log('BY_MONTH:', JSON.stringify(byMonth, null, 2));
}

main().finally(() => prisma.$disconnect());