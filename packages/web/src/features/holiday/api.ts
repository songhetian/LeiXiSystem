import type { HolidayView } from '@leixi/shared';
import { api } from '../../lib/api';

export interface HolidayList {
  holidays: HolidayView[];
}

export interface CreateHolidayInput {
  date: string; // YYYY-MM-DD
  name: string;
  type: string; // national | company | rest
}

export interface UpdateHolidayInput {
  date?: string;
  name?: string;
  type?: string;
}

export const holidayApi = {
  /** 按年拉取节假日；不传 year 返回全部 */
  async getHolidays(year?: number): Promise<HolidayList> {
    return api<HolidayList>(year ? `/api/holidays?year=${year}` : '/api/holidays');
  },
  /** 新建节假日：year 由 date 推导 */
  async createHoliday(data: CreateHolidayInput): Promise<{ id: number }> {
    return api<{ id: number }>('/api/holidays', { method: 'POST', body: JSON.stringify(data) });
  },
  /** 编辑节假日 */
  async updateHoliday(id: number, data: UpdateHolidayInput): Promise<null> {
    return api<null>(`/api/holidays/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  },
  /** 删除节假日 */
  async deleteHoliday(id: number): Promise<null> {
    return api<null>(`/api/holidays/${id}`, { method: 'DELETE' });
  },
};