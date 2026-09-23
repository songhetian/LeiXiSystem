import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';
import { buildApp } from './app';
import { createRedisSessionStore } from './modules/auth/redis.session-store';
import { createPrismaUserRepo } from './modules/auth/prisma-user.repo';
import { createPrismaPermissionLoader } from './modules/auth/prisma-permission-loader';
import { createPrismaRbacRepo } from './modules/rbac/prisma-rbac.repo';
import { createPrismaLeaveRepo } from './modules/leave/prisma-leave.repo';
import { createPrismaReimburseRepo } from './modules/reimburse/prisma-reimburse.repo';
import { createPrismaReimburseCategoryRepo } from './modules/reimburse/prisma-category.repo';
import { createPrismaAttendanceRepo } from './modules/attendance/prisma-attendance.repo';
import { createPrismaOvertimeRepo } from './modules/overtime/prisma-overtime.repo';
import { createPrismaMakeupRepo } from './modules/makeup/prisma-makeup.repo';
import { createPrismaAttSettingRepo } from './modules/attendance/prisma-attSetting.repo';
import { createPrismaHolidayRepo } from './modules/attendance/prisma-holiday.repo';
import { createPrismaExceptionRepo } from './modules/attendance/prisma-exception.repo';
import { createPrismaSalaryRepo } from './modules/salary/prisma-salary.repo';
import { createPrismaShiftRepo } from './modules/shift/prisma-shift.repo';
import { createPrismaLeaveTypeRepo } from './modules/vacation/prisma-leaveType.repo';
import { createPrismaQuotaRepo } from './modules/vacation/prisma-quota.repo';
import { createPrismaDepartmentRepo } from './modules/leave/prisma-department.repo';
import { setupNotificationSocket, setCurrentNotify, notify, type NotifyFn } from './modules/notify/socket';

const PORT = Number(process.env.PORT ?? 3001);
const HOST = process.env.HOST ?? '0.0.0.0';

const prisma = new PrismaClient();
const redis = new Redis(process.env.REDIS_URL ?? 'redis://127.0.0.1:6379');
const sessionStore = createRedisSessionStore(redis);

// 真实数据：Prisma 查询 users/user_roles/roles/permissions
const userRepo = createPrismaUserRepo(prisma);
const permissionLoader = createPrismaPermissionLoader(prisma);
const rbacRepo = createPrismaRbacRepo(prisma);
const leaveRepo = createPrismaLeaveRepo(prisma);
const departmentRepo = createPrismaDepartmentRepo(prisma);
const reimburseRepo = createPrismaReimburseRepo(prisma);
const categoryRepo = createPrismaReimburseCategoryRepo(prisma);
const attendanceRepo = createPrismaAttendanceRepo(prisma);
const overtimeRepo = createPrismaOvertimeRepo(prisma);
const makeupRepo = createPrismaMakeupRepo(prisma);
const attSettingRepo = createPrismaAttSettingRepo(prisma);
const holidayRepo = createPrismaHolidayRepo(prisma);
const exceptionRepo = createPrismaExceptionRepo(prisma);
const salaryRepo = createPrismaSalaryRepo(prisma);
const shiftRepo = createPrismaShiftRepo(prisma);
const leaveTypeRepo = createPrismaLeaveTypeRepo(prisma);
const quotaRepo = createPrismaQuotaRepo(prisma);

const jwtSecret = process.env.JWT_SECRET ?? 'dev-secret';

const app = buildApp({
  jwtSecret,
  sessionStore,
  userRepo,
  permissionLoader,
  rbacRepo,
  departmentRepo,
  leaveRepo,
  reimburseRepo,
  categoryRepo,
  attendanceRepo,
  overtimeRepo,
  makeupRepo,
  salaryRepo,
  shiftRepo,
  attSettingRepo,
  holidayRepo,
  exceptionRepo,
  leaveTypeRepo,
  quotaRepo,
  // 注入统一通知单例：函数引用稳定，调用时 currentNotify 早已就绪（时序安全）
  notify,
});

// socket 通知：须在 Fastify ready（拿到 server）后挂载，鉴权复用同一 JWT。
// setupNotificationSocket 返回 notify，写入单例供业务模块 import 使用。
await app.ready();
{
  const { notify: emit } = setupNotificationSocket(app.server, {
    jwtSecret,
    loadUser: async (userId) => {
      const u = await userRepo.findById(userId);
      if (!u) return null;
      return { id: u.id, departmentId: u.departmentId, roleIds: u.roleIds };
    },
    verifySid: async (userId, sid) => {
      const current = await sessionStore.get(userId);
      return current === sid;
    },
  });
  setCurrentNotify(emit as NotifyFn);
}

try {
  await app.listen({ port: PORT, host: HOST });
  console.log(`🚀 leixi-server listening on http://${HOST}:${PORT}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}