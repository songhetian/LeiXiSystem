import type { SearchFieldConfig } from '@/components/SearchForm';
import type { ReferenceItem } from '@/hooks/use-departments';
import type { TimelineRecordType } from '@/services/employee';

/**
 * 变动类型 → 中文标签 / 标签色 / 图形色 / 文字色（表格 Tag、时间轴圆点、月度趋势、导出共用）。
 * tone 取「亮档」token：只用于 6~8px 圆点与柱段这类小面积色块；
 * text 取「文字态」深档，浅绿/浅黄作 12px 文字对比度不足 3:1（WCAG SC 1.4.3）。
 */
export const TYPE_META: Record<
  TimelineRecordType,
  { label: string; color: string; tone: string; text: string }
> = {
  hire: { label: '入职', color: 'green', tone: 'var(--lx-success)', text: 'var(--lx-success-text)' },
  transfer: { label: '调动', color: 'blue', tone: 'var(--lx-primary)', text: 'var(--lx-primary)' },
  promotion: { label: '晋升', color: 'arcoblue', tone: 'var(--lx-indigo)', text: 'var(--lx-indigo-text)' },
  demotion: { label: '降职', color: 'orange', tone: 'var(--lx-warning)', text: 'var(--lx-warning-text)' },
  salary_adjust: { label: '调薪', color: 'cyan', tone: 'var(--lx-teal)', text: 'var(--lx-teal-text)' },
  resign: { label: '离职', color: 'red', tone: 'var(--lx-danger)', text: 'var(--lx-danger-text)' },
};

/** 类型顺序：按职业生命周期排，而不是按数量（图例与页签顺序需稳定） */
export const TYPE_ORDER: TimelineRecordType[] = [
  'hire',
  'transfer',
  'promotion',
  'demotion',
  'salary_adjust',
  'resign',
];

/**
 * 构建人员履历搜索字段。
 * 「类型」不在这里：页面上方的类型计数本身就是可点的筛选器，
 * 两处同时控制同一条件会出现「表单显示全部、列表却只显示晋升」的错位。
 */
export function buildTimelineSearchFields(departments: ReferenceItem[]): SearchFieldConfig[] {
  return [
    { key: 'keyword', label: '姓名', type: 'input', placeholder: '姓名 / 工号' },
    {
      key: 'departmentId',
      label: '部门',
      type: 'select',
      placeholder: '全部部门',
      options: departments.map((d) => ({ value: d.id, label: d.name })),
    },
    { key: 'range', label: '变动日期', type: 'range', placeholder: '选择日期范围' },
  ];
}
