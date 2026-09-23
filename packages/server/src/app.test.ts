import { describe, expect, it } from 'vitest';
import { buildApp, type AppDeps } from './app';
import type { SessionStore } from './modules/auth/auth.service';

function memoryStore(): SessionStore {
  const map = new Map<number, string>();
  return {
    set: async (userId, sid) => void map.set(userId, sid),
    get: async (userId) => map.get(userId) ?? null,
    delete: async (userId) => void map.delete(userId),
  };
}

function testDeps(): AppDeps {
  return {
    jwtSecret: 'test-secret',
    sessionStore: memoryStore(),
    userRepo: { findByUsername: async () => null, findById: async () => null },
    permissionLoader: { loadPermissionCodes: async () => [] },
    rbacRepo: {
      listRoles: async () => [],
      listPermissions: async () => [],
      setRolePermissions: async () => {},
      listUsers: async () => [],
      setUserRoles: async () => {},
      createUser: async (d) => ({ id: 1 }),
      updateUser: async () => {},
      deleteUser: async () => {},
    },
    departmentRepo: {
      listTree: async () => [],
      listDepartments: async () => [],
      createDepartment: async () => ({ id: 1 }),
      updateDepartment: async () => {},
      deleteDepartment: async () => 'ok',
    },
    leaveRepo: {
      listLeaves: async () => [],
      createLeave: async () => ({ id: 1 }),
      getLeaveById: async () => null,
      setStatus: async () => {},
    },
    reimburseRepo: {
      listReimburses: async () => [],
      createReimburse: async () => ({ id: 1 }),
      getReimburseById: async () => null,
      setStatus: async () => {},
    },
    attendanceRepo: {
      listAttendances: async () => [],
      createAttendance: async () => ({ id: 1 }),
    },
    makeupRepo: {
      listMakeups: async () => [],
      createMakeup: async () => ({ id: 1 }),
      getMakeupById: async () => null,
      setStatus: async () => {},
    },
    salaryRepo: {
      listSalaries: async () => [],
      createSalary: async () => ({ id: 1 }),
    },
    overtimeRepo: {
      listOvertimes: async () => [],
      createOvertime: async () => ({ id: 1 }),
      getOvertimeById: async () => null,
      setStatus: async () => {},
      getStats: async () => ({ totalHours: 0, approvedCount: 0, pendingCount: 0, month: '' }) as never,
    },
    shiftRepo: {
      listShifts: async () => [],
      createShift: async () => ({ ok: true as const, id: 1 }),
      updateShift: async () => ({ ok: true as const }),
      deleteShift: async () => 'ok',
      toggleShift: async () => 'ok',
      getRestShift: async () => ({ id: 1, name: '休息' }),
      listSchedules: async () => [],
      listSchedulesByUser: async () => [],
      upsertSchedule: async () => ({ id: 1 }),
      batchUpsertSchedules: async () => 0,
      copyScheduleTemplate: async () => 0,
      smartGenerate: async () => 0,
      deleteSchedule: async () => 'ok',
      setRangeRest: async () => 0,
      listTemplates: async () => [],
      createTemplate: async () => ({ ok: true as const, id: 1 }),
      updateTemplate: async () => 'ok' as const,
      deleteTemplate: async () => 'ok' as const,
      setTemplateItems: async () => ({ ok: true as const }),
      applyTemplate: async () => ({ ok: true as const, count: 0 }),
    },
    attSettingRepo: {
      getSetting: async () => ({ earlyClockInMinutes: 5, lateClockOutMinutes: 5, lateMinutes: 0, earlyLeaveMinutes: 0, absentHours: 4, allowMakeup: true, makeupDeadlineDays: 7, requireApprovalForMakeup: true, notifyOnLate: true, notifyOnEarlyLeave: true, notifyOnAbsent: true, enableTimeCheck: true }),
      updateSetting: async (data) => data,
    },
    holidayRepo: {
      listHolidays: async () => [],
      createHoliday: async () => ({ ok: true as const, id: 1 }),
      updateHoliday: async () => ({ ok: true as const }),
      deleteHoliday: async () => 'ok' as const,
    },
    leaveTypeRepo: {
      listLeaveTypes: async () => [],
      createLeaveType: async () => ({ ok: true as const, id: 1 }),
      updateLeaveType: async () => ({ ok: true as const }),
      deleteLeaveType: async () => 'ok' as const,
    },
    quotaRepo: {
      listQuotas: async () => [],
      upsertQuota: async () => ({ ok: true as const }),
      batchUpsertQuotas: async () => 0,
      getTrend: async () => [],
    },
    exceptionRepo: {
      listExceptions: async () => [],
      scanUpsert: async () => ({ created: 0, updated: 0 }),
      setStatus: async () => 'ok' as const,
    },
    categoryRepo: {
      listCategories: async () => [],
      createCategory: async () => ({ ok: true as const, id: 1 }),
      updateCategory: async () => ({ ok: true as const }),
      deleteCategory: async () => 'ok' as const,
    },
  };
}

describe('health route', () => {
  it('GET /api/health 返回统一信封 success/data(status)', async () => {
    const app = buildApp(testDeps());
    const res = await app.inject({ method: 'GET', url: '/api/health' });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ success: true, data: { status: 'ok' }, message: '' });
    await app.close();
  });
});