import type { Prisma, PrismaClient } from '@prisma/client';
import type { WorkShiftView, ScheduleView, ScheduleTemplateView } from '@leixi/shared';
import type { DepartmentScope } from '../leave/department-scope';

type ShiftRow = Prisma.WorkShiftGetPayload<{
  include: { shiftDepartment: { select: { name: true } } };
}>;
type ScheduleRow = Prisma.ShiftScheduleGetPayload<{
  include: {
    scheduleUser: { select: { realName: true } };
    scheduleDepartment: { select: { id: true, name: true } };
    scheduleShift: { select: { name: true; startTime: true; endTime: true; color: true; workHours: true } };
  };
}>;

type ShiftPrisma = Pick<PrismaClient, 'workShift' | 'shiftSchedule' | 'user' | 'scheduleTemplate' | 'scheduleTemplateItem'>;

/** 班次作用于排班管理视图：通用班次(NULL) + 本部门/下属部门班次 */
function shiftScopeWhere(scope: DepartmentScope): Prisma.WorkShiftWhereInput {
  return scope.kind === 'all'
    ? {}
    : { OR: [{ departmentId: null }, { departmentId: { in: scope.departmentIds } }] };
}

/** 排班的数据隔离：按被排班用户的部门过滤（subtree 时排除未归类部门记录） */
function scheduleScopeWhere(scope: DepartmentScope): Prisma.ShiftScheduleWhereInput {
  return scope.kind === 'all' ? {} : { departmentId: { in: scope.departmentIds } };
}

function toShiftView(s: ShiftRow): WorkShiftView {
  return {
    id: s.id,
    name: s.name,
    startTime: s.startTime,
    endTime: s.endTime,
    workHours: s.workHours.toNumber(),
    restDuration: s.restDuration,
    lateThreshold: s.lateThreshold,
    earlyThreshold: s.earlyThreshold,
    useGlobalThreshold: s.useGlobalThreshold,
    isActive: s.isActive,
    departmentId: s.departmentId,
    description: s.description,
    color: s.color,
    departmentName: s.shiftDepartment?.name ?? null,
  };
}

function toScheduleView(sc: ScheduleRow): ScheduleView {
  return {
    id: sc.id,
    scheduleDate: sc.scheduleDate,
    isRestDay: sc.isRestDay,
    userId: sc.userId,
    userName: sc.scheduleUser.realName,
    departmentId: sc.departmentId ?? sc.scheduleDepartment?.id ?? 0,
    departmentName: sc.scheduleDepartment?.name ?? '',
    shiftId: sc.shiftId,
    shiftName: sc.isRestDay ? null : sc.scheduleShift?.name ?? null,
    startTime: sc.isRestDay ? null : sc.scheduleShift?.startTime ?? null,
    endTime: sc.isRestDay ? null : sc.scheduleShift?.endTime ?? null,
    color: sc.isRestDay ? null : sc.scheduleShift?.color ?? null,
    workHours: sc.isRestDay ? 0 : sc.scheduleShift?.workHours.toNumber() ?? 0,
  };
}

/** 自动计算工作时长（分钟→小时，含跨夜 22:00→06:00）：(end-start-rest)/60 */
export function computeWorkHours(start: string, end: string, rest: number): number {
  const sh = Number(start.split(':')[0]);
  const sm = Number(start.split(':')[1]);
  const eh = Number(end.split(':')[0]);
  const em = Number(end.split(':')[1]);
  let total = eh * 60 + em - (sh * 60 + sm);
  if (total < 0) total += 24 * 60;
  return Math.max(0, (total - rest) / 60);
}

export interface UpsertRow {
  userId: number;
  shiftId: number | null;
  scheduleDate: string; // YYYY-MM-DD
  isRestDay: boolean;
  departmentId: number; // 被排班用户部门
}

/**
 * Prisma 实现的排班仓库：班次管理 + 排班管理（含批量/复制/智能生成/请假自动置休）。
 * 班次为可复用模板；排班按用户部门做数据隔离，所有查询须先由路由层解析 scope。
 */
export function createPrismaShiftRepo(prisma: ShiftPrisma) {
  return {
    // ---------- 班次 ----------
    async listShifts(scope: DepartmentScope): Promise<WorkShiftView[]> {
      const rows = await prisma.workShift.findMany({
        where: shiftScopeWhere(scope),
        include: { shiftDepartment: { select: { name: true } } },
        orderBy: [{ isActive: 'desc' }, { id: 'asc' }],
      });
      return rows.map(toShiftView);
    },

    async createShift(data: {
      name: string;
      startTime: string;
      endTime: string;
      restDuration?: number;
      lateThreshold?: number | null;
      earlyThreshold?: number | null;
      useGlobalThreshold?: boolean;
      departmentId?: number | null;
      description?: string | null;
      color?: string;
    }): Promise<{ ok: true; id: number } | { ok: false; reason: 'dup' }> {
      const deptWhere = data.departmentId ? { departmentId: data.departmentId } : { departmentId: null };
      const dup = await prisma.workShift.findFirst({ where: { name: data.name, ...deptWhere }, select: { id: true } });
      if (dup) return { ok: false, reason: 'dup' };
      const workHours = computeWorkHours(data.startTime, data.endTime, data.restDuration ?? 0);
      const row = await prisma.workShift.create({
        data: {
          name: data.name,
          startTime: data.startTime,
          endTime: data.endTime,
          workHours,
          restDuration: data.restDuration ?? 0,
          lateThreshold: data.lateThreshold ?? null,
          earlyThreshold: data.earlyThreshold ?? null,
          useGlobalThreshold: data.useGlobalThreshold ?? false,
          departmentId: data.departmentId ?? null,
          description: data.description ?? null,
          color: data.color ?? '#3B82F6',
        },
      });
      return { ok: true, id: row.id };
    },

    async updateShift(
      id: number,
      data: {
        name?: string;
        startTime?: string;
        endTime?: string;
        restDuration?: number;
        lateThreshold?: number | null;
        earlyThreshold?: number | null;
        useGlobalThreshold?: boolean;
        isActive?: boolean;
        departmentId?: number | null;
        description?: string | null;
        color?: string;
      },
    ): Promise<{ ok: true } | { ok: false; reason: 'not_found' | 'dup' }> {
      const existing = await prisma.workShift.findUnique({ where: { id }, select: { id: true } });
      if (!existing) return { ok: false, reason: 'not_found' };
      if (data.name) {
        const deptWhere = data.departmentId
          ? { departmentId: data.departmentId }
          : { departmentId: null };
        const dup = await prisma.workShift.findFirst({
          where: { name: data.name, ...deptWhere, NOT: { id } },
          select: { id: true },
        });
        if (dup) return { ok: false, reason: 'dup' };
      }
      const cur = await prisma.workShift.findUnique({ where: { id } });
      const startTime = data.startTime ?? cur!.startTime;
      const endTime = data.endTime ?? cur!.endTime;
      const restDuration = data.restDuration ?? cur!.restDuration;
      await prisma.workShift.update({
        where: { id },
        data: {
          name: data.name,
          startTime,
          endTime,
          workHours: computeWorkHours(startTime, endTime, restDuration),
          restDuration,
          lateThreshold: data.lateThreshold === undefined ? undefined : data.lateThreshold,
          earlyThreshold: data.earlyThreshold === undefined ? undefined : data.earlyThreshold,
          useGlobalThreshold: data.useGlobalThreshold,
          isActive: data.isActive,
          departmentId: data.departmentId === undefined ? undefined : data.departmentId,
          description: data.description === undefined ? undefined : data.description,
          color: data.color,
        },
      });
      return { ok: true };
    },

    async deleteShift(id: number): Promise<'ok' | 'not_found' | 'in_use'> {
      const existing = await prisma.workShift.findUnique({ where: { id }, select: { id: true } });
      if (!existing) return 'not_found';
      const inUse = await prisma.shiftSchedule.count({ where: { shiftId: id } });
      if (inUse > 0) return 'in_use';
      await prisma.workShift.delete({ where: { id } });
      return 'ok';
    },

    async toggleShift(id: number): Promise<'ok' | 'not_found'> {
      const existing = await prisma.workShift.findUnique({ where: { id }, select: { isActive: true } });
      if (!existing) return 'not_found';
      await prisma.workShift.update({ where: { id }, data: { isActive: !existing.isActive } });
      return 'ok';
    },

    // 资源性的「休息」班次：不存在则自动创建，供请假自动置休等使用
    async getRestShift(): Promise<{ id: number; name: string }> {
      const found = await prisma.workShift.findFirst({ where: { name: '休息', departmentId: null } });
      if (found) return { id: found.id, name: found.name };
      const row = await prisma.workShift.create({
        data: {
          name: '休息',
          startTime: '00:00',
          endTime: '00:00',
          workHours: 0,
          restDuration: 0,
          departmentId: null,
          color: '#9CA3AF',
        },
      });
      return { id: row.id, name: row.name };
    },

    // ---------- 排班 ----------
    async listSchedules(
      scope: DepartmentScope,
      filters: { startDate?: string; endDate?: string; userId?: number } = {},
    ): Promise<ScheduleView[]> {
      const rows = await prisma.shiftSchedule.findMany({
        where: {
          ...scheduleScopeWhere(scope),
          ...(filters.userId ? { userId: filters.userId } : {}),
          ...(filters.startDate ? { scheduleDate: { gte: filters.startDate } } : {}),
          ...(filters.endDate ? { scheduleDate: { lte: filters.endDate } } : {}),
        },
        include: {
          scheduleUser: { select: { realName: true } },
          scheduleDepartment: { select: { id: true, name: true } },
          scheduleShift: { select: { name: true, startTime: true, endTime: true, color: true, workHours: true } },
        },
        orderBy: [{ scheduleDate: 'asc' }, { userId: 'asc' }],
      });
      return rows.map(toScheduleView);
    },

    // 我的排班：仅本人数据，无需 scope
    async listSchedulesByUser(
      userId: number,
      filters: { startDate?: string; endDate?: string } = {},
    ): Promise<ScheduleView[]> {
      return this.listSchedules({ kind: 'all' }, { ...filters, userId });
    },

    // 单条排班 upsert（一人一天一班）
    async upsertSchedule(row: UpsertRow): Promise<{ id: number }> {
      const existing = await prisma.shiftSchedule.findUnique({
        where: { userId_scheduleDate: { userId: row.userId, scheduleDate: row.scheduleDate } },
      });
      if (existing) {
        await prisma.shiftSchedule.update({
          where: { id: existing.id },
          data: { shiftId: row.shiftId, isRestDay: row.isRestDay, departmentId: row.departmentId },
        });
        return { id: existing.id };
      }
      const created = await prisma.shiftSchedule.create({
        data: { ...row },
      });
      return { id: created.id };
    },

    async batchUpsertSchedules(rows: UpsertRow[]): Promise<number> {
      let count = 0;
      for (const r of rows) {
        await this.upsertSchedule(r);
        count++;
      }
      return count;
    },

    // 复制排班模板：把 source 区间内每人每天的班次复制到以 targetStart 起始的对应偏移日期
    async copyScheduleTemplate(
      sourceStart: string,
      sourceEnd: string,
      targetStart: string,
      userIds?: number[],
    ): Promise<number> {
      const source = await prisma.shiftSchedule.findMany({
        where: {
          scheduleDate: { gte: sourceStart, lte: sourceEnd },
          ...(userIds && userIds.length > 0 ? { userId: { in: userIds } } : {}),
        },
      });
      let count = 0;
      for (const sc of source) {
        const offset = diffDays(sourceStart, sc.scheduleDate);
        if (offset < 0) continue;
        const targetDate = addDays(targetStart, offset);
        await this.upsertSchedule({
          userId: sc.userId,
          shiftId: sc.shiftId,
          scheduleDate: targetDate,
          isRestDay: sc.isRestDay,
          departmentId: sc.departmentId ?? 0,
        });
        count++;
      }
      return count;
    },

    // 智能生成：按「每人日期区间→某班次」的规则在目标日期内落地（同人同天覆盖为 upsert）
    async smartGenerate(rows: UpsertRow[]): Promise<number> {
      return this.batchUpsertSchedules(rows);
    },

    // 请假自动置休：把某员工 [startDate,endDate] 区间内每天置为休息（无排班则创建休息记录）
    async setRangeRest(data: {
      userId: number;
      departmentId: number | null;
      startDate: string;
      endDate: string;
    }): Promise<number> {
      const rows: UpsertRow[] = [];
      const cur = new Date(`${data.startDate}T00:00:00`);
      const last = new Date(`${data.endDate}T00:00:00`);
      for (; cur <= last; cur.setDate(cur.getDate() + 1)) {
        rows.push({
          userId: data.userId,
          shiftId: null,
          scheduleDate: `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}-${String(cur.getDate()).padStart(2, '0')}`,
          isRestDay: true,
          departmentId: data.departmentId ?? 0,
        });
      }
      return this.batchUpsertSchedules(rows);
    },

    async deleteSchedule(id: number): Promise<'ok' | 'not_found'> {
      const existing = await prisma.shiftSchedule.findUnique({ where: { id }, select: { id: true } });
      if (!existing) return 'not_found';
      await prisma.shiftSchedule.delete({ where: { id } });
      return 'ok';
    },

    // ---------- 周排班模板 ----------
    async listTemplates(): Promise<ScheduleTemplateView[]> {
      const rows = await prisma.scheduleTemplate.findMany({
        include: {
          items: {
            include: {
              itemUser: { select: { realName: true } },
              itemDepartment: { select: { id: true, name: true } },
              itemShift: { select: { name: true, color: true } },
            },
            orderBy: [{ userId: 'asc' }, { weekday: 'asc' }],
          },
        },
        orderBy: [{ id: 'asc' }],
      });
      return rows.map((t) => ({
        id: t.id,
        name: t.name,
        description: t.description,
        createdAt: t.createdAt.toISOString(),
        items: t.items.map((i) => ({
          id: i.id,
          userId: i.userId,
          userName: i.itemUser.realName,
          weekday: i.weekday,
          shiftId: i.shiftId,
          shiftName: i.isRestDay ? null : i.itemShift?.name ?? null,
          isRestDay: i.isRestDay,
          color: i.isRestDay ? null : i.itemShift?.color ?? null,
          departmentId: i.departmentId ?? i.itemDepartment?.id ?? 0,
          departmentName: i.itemDepartment?.name ?? null,
        })),
      }));
    },

    async createTemplate(data: {
      name: string;
      description?: string | null;
    }): Promise<{ ok: true; id: number } | { ok: false; reason: 'dup' }> {
      const dup = await prisma.scheduleTemplate.findFirst({
        where: { name: data.name },
        select: { id: true },
      });
      if (dup) return { ok: false, reason: 'dup' };
      const row = await prisma.scheduleTemplate.create({
        data: { name: data.name, description: data.description ?? null },
      });
      return { ok: true, id: row.id };
    },

    async updateTemplate(
      id: number,
      data: { name?: string; description?: string | null },
    ): Promise<'ok' | 'not_found' | 'dup'> {
      const existing = await prisma.scheduleTemplate.findUnique({ where: { id }, select: { id: true } });
      if (!existing) return 'not_found';
      if (data.name) {
        const dup = await prisma.scheduleTemplate.findFirst({
          where: { name: data.name, NOT: { id } },
          select: { id: true },
        });
        if (dup) return 'dup';
      }
      await prisma.scheduleTemplate.update({
        where: { id },
        data: {
          name: data.name,
          description: data.description === undefined ? undefined : data.description,
        },
      });
      return 'ok';
    },

    async deleteTemplate(id: number): Promise<'ok' | 'not_found'> {
      const existing = await prisma.scheduleTemplate.findUnique({ where: { id }, select: { id: true } });
      if (!existing) return 'not_found';
      await prisma.scheduleTemplate.delete({ where: { id } });
      return 'ok';
    },

    // 替换模板条目：先删后插，departmentId 冗余自被排班用户所属部门
    async setTemplateItems(
      templateId: number,
      items: { userId: number; weekday: number; shiftId: number | null; isRestDay?: boolean }[],
    ): Promise<{ ok: true } | { ok: false; reason: 'not_found' }> {
      const existing = await prisma.scheduleTemplate.findUnique({ where: { id: templateId }, select: { id: true } });
      if (!existing) return { ok: false, reason: 'not_found' };
      const userIds = [...new Set(items.map((i) => i.userId))];
      const users = await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, departmentId: true },
      });
      const deptOf = new Map<number, number | null>(users.map((u) => [u.id, u.departmentId]));
      await prisma.scheduleTemplateItem.deleteMany({ where: { templateId } });
      if (items.length > 0) {
        await prisma.scheduleTemplateItem.createMany({
          data: items.map((i) => ({
            templateId,
            userId: i.userId,
            weekday: i.weekday,
            shiftId: i.shiftId,
            isRestDay: i.isRestDay ?? false,
            departmentId: deptOf.get(i.userId) ?? null,
          })),
        });
      }
      return { ok: true };
    },

    // 一键应用模板到目标周：targetStart 为该周周一，逐条目落在 (周一+weekday-1) 日期上
    async applyTemplate(
      templateId: number,
      targetStart: string,
    ): Promise<{ ok: true; count: number } | { ok: false; reason: 'not_found' }> {
      const existing = await prisma.scheduleTemplate.findUnique({ where: { id: templateId }, select: { id: true } });
      if (!existing) return { ok: false, reason: 'not_found' };
      const items = await prisma.scheduleTemplateItem.findMany({ where: { templateId } });
      let count = 0;
      for (const i of items) {
        const date = addDays(targetStart, i.weekday - 1);
        await this.upsertSchedule({
          userId: i.userId,
          shiftId: i.shiftId,
          scheduleDate: date,
          isRestDay: i.isRestDay,
          departmentId: i.departmentId ?? 0,
        });
        count++;
      }
      return { ok: true, count };
    },
  };
}

function diffDays(start: string, date: string): number {
  const d1 = new Date(start);
  const d2 = new Date(date);
  return Math.round((d2.getTime() - d1.getTime()) / 86400000);
}

function addDays(date: string, offset: number): string {
  const d = new Date(date);
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}