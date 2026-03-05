import ExcelJS from 'exceljs';
import { Job } from 'bullmq';
import { prisma } from '../app';
import { registerWorker, QueueNames } from './base';
import bcrypt from 'bcryptjs';

export const batchHRWorker = registerWorker(QueueNames.SYSTEM_LOG, async (job: Job) => {
  const { fileBuffer, operatorId } = job.data;
  const buffer = Buffer.from(fileBuffer, 'base64');

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const sheet = workbook.getWorksheet(1);

  let successCount = 0;
  const rows: any[] = [];
  
  sheet?.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const vals = row.values as any[];
    rows.push({
      realName: vals[1],
      username: vals[2],
      employeeNo: vals[3],
      departmentId: Number(vals[4]),
      positionId: Number(vals[5]),
      hireDate: vals[6]
    });
  });

  for (const row of rows) {
    try {
      await prisma.$transaction(async (tx) => {
        // 1. 创建用户
        const user = await tx.users.create({
          data: {
            username: row.username,
            password_hash: await bcrypt.hash('123456', 10), // 物理还原：默认密码
            real_name: row.realName,
            department_id: row.departmentId,
            status: 'active'
          }
        });

        // 2. 创建员工档案
        const employee = await tx.employees.create({
          data: {
            user_id: user.id,
            employee_no: row.employeeNo,
            hire_date: new Date(row.hireDate),
            position_id: row.positionId,
            status: 'active'
          }
        });

        // 3. 物理还原：人事变动存证
        await tx.employee_changes.create({
          data: {
            employee_id: employee.id,
            user_id: user.id,
            change_type: 'hire',
            change_date: new Date(),
            new_department_id: row.departmentId,
            new_position_id: row.positionId,
            created_by: operatorId
          }
        });
      });
      successCount++;
      await job.updateProgress(Math.floor((successCount / rows.length) * 100));
    } catch (e) {
      console.error(`Batch HR Error for ${row.username}:`, e);
    }
  }

  return { successCount, total: rows.length };
});
