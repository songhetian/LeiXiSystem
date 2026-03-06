import { Job } from 'bullmq';
import { prisma } from '../app';
import { registerWorker, QueueNames } from './base';
import dayjs from 'dayjs';

/**
 * 考勤统计报表异步生成 Worker
 */
export const attendanceReportWorker = registerWorker(QueueNames.EXPORT_REPORT, async (job: Job) => {
  const { dateRange, departmentId, operatorId } = job.data;
  const [start, end] = dateRange;

  // 1. 获取目标员工范围
  const employees = await prisma.employees.findMany({
    where: {
      status: 'active',
      users: departmentId ? { department_id: departmentId } : undefined
    },
    include: {
      users: {
        include: { departments: true }
      }
    }
  });

  const reportData = [];
  let processed = 0;

  // 2. 核心逻辑对齐：多维数据对冲计算
  for (const emp of employees) {
    try {
      // 物理对齐旧版计算逻辑：获取该时间段内所有记录
      const [records, schedules, leaves] = await Promise.all([
        prisma.attendance_records.findMany({
          where: { employee_id: emp.id, record_date: { gte: new Date(start), lte: new Date(end) } }
        }),
        prisma.shift_schedules.findMany({
          where: { employee_id: emp.id, schedule_date: { gte: new Date(start), lte: new Date(end) }, is_rest_day: false }
        }),
        prisma.leave_records.findMany({
          where: { employee_id: emp.id, status: 'approved', start_date: { lte: new Date(end) }, end_date: { gte: new Date(start) } }
        })
      ]);

      const stats = {
        name: emp.users.real_name,
        department: emp.users.departments?.name,
        total_days: schedules.length,
        actual_days: records.filter(r => r.status === 'normal').length,
        late_count: records.filter(r => r.status === 'late' || r.status === 'late_early').length,
        early_count: records.filter(r => r.status === 'early' || r.status === 'late_early').length,
        absent_count: records.filter(r => r.status === 'absent').length,
        leave_days: leaves.reduce((sum, l) => sum + Number(l.days), 0)
      };

      reportData.push(stats);
      
      processed++;
      await job.updateProgress(Math.floor((processed / employees.length) * 100));
    } catch (e) {
      console.error(`Stats error for emp ${emp.id}:`, e);
    }
  }

  // 3. TODO: 这里可以集成 ExcelJS 生成真实文件并返回 URL
  // 目前先返回纯 JSON 结果供前端预览
  return { 
    generatedAt: new Date().toISOString(),
    operatorId,
    summary: { totalEmployees: employees.length },
    data: reportData 
  };
});
