import type { SearchFieldConfig } from '@/components/SearchForm';
import type { ReferenceItem } from '@/hooks/use-departments';
import type { TimelineRecordType } from '@/services/employee';

/** 变动类型 → 中文标签/颜色（表格 Tag、导出、类型筛选共用） */
export const TYPE_META: Record<TimelineRecordType, { label: string; color: string }> = {
  hire: { label: '入职', color: 'green' },
  transfer: { label: '调动', color: 'blue' },
  promotion: { label: '晋升', color: 'arcoblue' },
  demotion: { label: '降职', color: 'orange' },
  salary_adjust: { label: '调薪', color: 'cyan' },
  resign: { label: '离职', color: 'red' },
};

/**
 * 构建人员履历搜索字段。第 2 个字段为「部门」下拉，选项来自跨页共享的部门参考数据；
 * 与传统列表页保持一致，避免手写裸 ID 输入。
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
    {
      key: 'type',
      label: '类型',
      type: 'select',
      placeholder: '全部类型',
      options: Object.entries(TYPE_META).map(([value, meta]) => ({ value, label: meta.label })),
    },
    { key: 'range', label: '变动日期', type: 'range', placeholder: '选择日期范围' },
  ];
}