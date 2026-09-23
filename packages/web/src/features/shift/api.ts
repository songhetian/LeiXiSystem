import type { WorkShiftView, ScheduleView, ScheduleStatsRow, ScheduleTemplateView, ScheduleTemplateItemInput } from '@leixi/shared';
export type { ScheduleTemplateItemInput };
import { api, getToken } from '../../lib/api';

/** 模板名称/描述更新入参 */
export interface TemplateFormInput {
  name?: string;
  description?: string | null;
}

/** GET /api/shifts 响应 data */
export interface ShiftList {
  shifts: WorkShiftView[];
}

/** GET /api/schedules 响应 data */
export interface ScheduleList {
  schedules: ScheduleView[];
}

/** 创建/更新班次入参（可选字段视场景填写） */
export interface UpsertShiftInput {
  name: string;
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  restDuration: number;
  lateThreshold?: number | null;
  earlyThreshold?: number | null;
  useGlobalThreshold?: boolean;
  departmentId?: number | null;
  description?: string | null;
  color?: string;
}

/** 单条排班 upsert 入参 */
export interface UpsertScheduleInput {
  userId: number;
  shiftId: number | null;
  scheduleDate: string; // YYYY-MM-DD
  isRestDay?: boolean;
}

/** 批量排班入参 */
export interface BatchScheduleInput {
  schedules: UpsertScheduleInput[];
}

/** 模板复制入参 */
export interface CopyTemplateInput {
  sourceStart: string;
  sourceEnd: string;
  targetStart: string;
  userIds?: number[];
}

/** 智能生成：每行 员工+班次+日期 */
export interface SmartRow {
  userId: number;
  shiftId: number | null;
  scheduleDate: string;
  isRestDay?: boolean;
}

/** 智能生成入参 */
export interface SmartScheduleInput {
  rows: SmartRow[];
}

/** validate 预检问题项：index 指向 schedules 数组下标，field 指明问题字段 */
export interface ScheduleBatchIssue {
  index: number;
  field: 'scheduleDate' | 'shiftId' | 'duplicateUserDate';
  message: string;
}

/** validate 预检响应 data */
export interface ValidateScheduleResult {
  valid: boolean;
  issues: ScheduleBatchIssue[];
}

export const shiftApi = {
  /** 拉取班次列表（部门数据隔离） */
  async getShifts(): Promise<ShiftList> {
    return api<ShiftList>('/api/shifts');
  },
  /** 新建班次 */
  async createShift(data: UpsertShiftInput): Promise<{ id: number }> {
    return api<{ id: number }>('/api/shifts', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  /** 编辑班次 */
  async updateShift(id: number, data: UpsertShiftInput): Promise<void> {
    await api<void>(`/api/shifts/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },
  /** 删除班次：被引用时后端 409 */
  async deleteShift(id: number): Promise<void> {
    await api<void>(`/api/shifts/${id}`, { method: 'DELETE' });
  },
  /** 停用/启用 */
  async toggleShift(id: number): Promise<void> {
    await api<void>(`/api/shifts/${id}/toggle`, { method: 'POST' });
  },

  /** 拉取指定日期区间内的排班表 */
  async getSchedules(startDate: string, endDate: string): Promise<ScheduleList> {
    return api<ScheduleList>(`/api/schedules?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`);
  },
  /** 拉取当前用户排班 */
  async getSelfSchedules(startDate: string, endDate: string): Promise<ScheduleList> {
    return api<ScheduleList>(`/api/schedules/self?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`);
  },
  /** 当前用户自助排班/设休息（POST /api/schedules/self） */
  async setSelfSchedule(data: { scheduleDate: string; shiftId: number | null; isRestDay?: boolean }): Promise<{ id: number }> {
    return api<{ id: number }>('/api/schedules/self', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  /** 单个排班 upsert（shift_manage，会通知该员工） */
  async upsertSchedule(data: UpsertScheduleInput): Promise<{ id: number }> {
    return api<{ id: number }>('/api/schedules', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  /** 批量排班 */
  async batchSchedules(data: BatchScheduleInput): Promise<{ count: number }> {
    return api<{ count: number }>('/api/schedules/batch', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  /** 模板复制 */
  async copyTemplate(data: CopyTemplateInput): Promise<{ count: number }> {
    return api<{ count: number }>('/api/schedules/copy-template', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  /** 智能生成 */
  async smartSchedule(data: SmartScheduleInput): Promise<{ count: number }> {
    return api<{ count: number }>('/api/schedules/smart', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  /** 批量落地前静态预检：日期/班次/同员工同日重复问题 */
  async validateSchedules(data: BatchScheduleInput): Promise<ValidateScheduleResult> {
    return api<ValidateScheduleResult>('/api/schedules/validate', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  /** 删除一条排班 */
  async deleteSchedule(id: number): Promise<void> {
    await api<void>(`/api/schedules/${id}`, { method: 'DELETE' });
  },
  /** 排班统计报表（按月） */
  async getScheduleStats(month: string): Promise<{ stats: ScheduleStatsRow[] }> {
    return api<{ stats: ScheduleStatsRow[] }>(`/api/schedules/stats?month=${encodeURIComponent(month)}`);
  },
  /** 周排班模板列表 */
  async getTemplates(): Promise<{ templates: ScheduleTemplateView[] }> {
    return api<{ templates: ScheduleTemplateView[] }>('/api/schedule-templates');
  },
  /** 新建模板 */
  async createTemplate(data: { name: string; description?: string | null }): Promise<{ id: number }> {
    return api<{ id: number }>('/api/schedule-templates', { method: 'POST', body: JSON.stringify(data) });
  },
  /** 更新模板名称/描述 */
  async updateTemplate(id: number, data: { name?: string; description?: string | null }): Promise<void> {
    await api<void>(`/api/schedule-templates/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  },
  /** 替换模板条目 */
  async setTemplateItems(id: number, items: ScheduleTemplateItemInput[]): Promise<{ count: number }> {
    return api<{ count: number }>(`/api/schedule-templates/${id}/items`, { method: 'PUT', body: JSON.stringify({ items }) });
  },
  /** 删除模板 */
  async deleteTemplate(id: number): Promise<void> {
    await api<void>(`/api/schedule-templates/${id}`, { method: 'DELETE' });
  },
  /** 一键应用模板到指定周 */
  async applyTemplate(id: number, targetStart: string): Promise<{ count: number }> {
    return api<{ count: number }>(`/api/schedule-templates/${id}/apply`, { method: 'POST', body: JSON.stringify({ targetStart }) });
  },
};

/** 导出 Excel：二进制流，不能用 JSON 的 api()，需原生 fetch + Bearer token */
export async function exportSchedules(startDate: string, endDate: string): Promise<Blob> {
  const token = getToken();
  const res = await fetch(
    `/api/schedules/export?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`,
    {
      headers: token ? { authorization: `Bearer ${token}` } : {},
    },
  );
  if (!res.ok) {
    let msg = '导出失败';
    try {
      const body = (await res.json()) as { message?: string };
      if (body.message) msg = body.message;
    } catch {
      /* 非 JSON 错误体则用默认提示 */
    }
    throw new Error(msg);
  }
  return res.blob();
}

/** 导出排班统计 Excel（按月） */
export async function exportScheduleStats(month: string, format: 'csv' | 'xlsx' = 'xlsx'): Promise<Blob> {
  const token = getToken();
  const res = await fetch(`/api/export/schedule-stats?month=${encodeURIComponent(month)}&format=${format}`, {
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    let msg = '导出失败';
    try {
      const body = (await res.json()) as { message?: string };
      if (body.message) msg = body.message;
    } catch {
      /* 非 JSON 错误体则用默认提示 */
    }
    throw new Error(msg);
  }
  return res.blob();
}

/** 导入 Excel：本地文件读为 base64 后 POST（file 去掉 data:...;base64, 前缀） */
export async function importSchedules(file: File): Promise<{ count: number; skipped: number }> {
  const base64: string = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      const idx = result.indexOf(',');
      resolve(idx >= 0 ? result.slice(idx + 1) : result);
    };
    reader.onerror = () => reject(new Error('读取文件失败'));
    reader.readAsDataURL(file);
  });
  return api<{ count: number; skipped: number }>('/api/schedules/import', {
    method: 'POST',
    body: JSON.stringify({ file: base64 }),
  });
}