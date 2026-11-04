'use client';

import { useState, useRef, useMemo } from 'react';
import { Select } from '@arco-design/web-react';
import type { ComponentProps } from 'react';
import { employeeApi, type Employee } from '@/services/employee';
import LoaderDots from '@/components/LoaderDots';
import { useCachedData } from '@/hooks/use-cached-data';

type ArcoSelectProps = ComponentProps<typeof Select>;

export interface EmployeeSelectProps {
  /** 选中的员工 ID（单选）或 ID 数组（多选） */
  value?: number | number[];
  onChange?: (value: number | number[], employee?: Employee | Employee[]) => void;
  /** 模式：单选 / 多选 */
  mode?: 'single' | 'multiple';
  /** 按部门筛选 */
  departmentId?: number;
  /** 占位文本 */
  placeholder?: string;
  /** 是否禁用 */
  disabled?: boolean;
  /** 是否允许清空 */
  allowClear?: boolean;
  /** 自定义样式 */
  style?: React.CSSProperties;
  /** 自定义 className */
  className?: string;
  /** 原生 id：配合外层 <label htmlFor> 使用，保证屏幕阅读器可朗读字段名（WCAG SC 1.3.1 / 3.3.2） */
  id?: string;
}

interface OptionData {
  label: string;
  value: number;
  raw: Employee;
}

/** 将 Employee 转为 Arco Select option（模块级：保持引用稳定，便于 useMemo 依赖） */
function toOption(emp: Employee): OptionData {
  return {
    label: `${emp.employeeNo} - ${emp.name}${emp.departmentName ? ` (${emp.departmentName})` : ''}`,
    value: emp.id,
    raw: emp,
  };
}

export default function EmployeeSelect({
  value,
  onChange,
  mode = 'single',
  departmentId,
  placeholder = '搜索员工姓名或工号',
  disabled = false,
  allowClear = true,
  style,
  className,
  id,
}: EmployeeSelectProps) {
  // 搜索词（防抖后才进 cacheKey，避免每次按键都发请求）
  const [keyword, setKeyword] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isMultiple = mode === 'multiple';

  // 列表数据统一走 useCachedData：同一「部门 + 关键词」在不同表单间共享缓存
  const { data: res, loading, error } = useCachedData(
    `employees:select:${departmentId ?? 'all'}:${keyword || 'all'}`,
    async () => {
      const result = await employeeApi.getList({
        name: keyword || undefined,
        page: 1,
        pageSize: 50,
        departmentId,
      });
      // 业务码非 0 不是「没有员工」，必须走失败分支
      if (result.code !== 0) throw new Error(result.message || '员工列表加载失败');
      return result;
    },
    { staleTime: 30_000 },
  );

  const options = useMemo<OptionData[]>(
    () => (res?.code === 0 && res.data ? (res.data.list ?? []).map(toOption) : []),
    [res],
  );

  // 加载失败与「确实没有员工」是两件事：不区分会让用户以为库里查无此人
  const loadFailed = !!error;

  // 搜索防抖：300ms 内连续输入只保留最后一次
  const handleSearch = (val: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setKeyword(val);
    }, 300);
  };

  // 选中项变化
  const handleChange = (val: number | number[]) => {
    if (isMultiple) {
      const arr = val as number[];
      const emps = arr
        .map((id) => options.find((o) => o.value === id)?.raw)
        .filter(Boolean) as Employee[];
      onChange?.(val, emps);
    } else {
      const emp = options.find((o) => o.value === val)?.raw;
      onChange?.(val, emp);
    }
  };

  // 确保已选中的 value 对应的 option 存在（异步加载场景）
  const selectedValues = useMemo(() => {
    if (!value) return undefined;
    return isMultiple ? (value as number[]) : (value as number);
  }, [value, isMultiple]);

  const selectProps: ArcoSelectProps = {
    value: selectedValues,
    onChange: handleChange,
    showSearch: true,
    filterOption: false,
    onSearch: handleSearch,
    placeholder,
    disabled,
    allowClear,
    style: { width: '100%', ...style },
    className,
    notFoundContent: loading ? (
      <LoaderDots />
    ) : loadFailed ? (
      // 失败时说清是「加载失败」，用户还能重试（收起再展开触发重新搜索）
      '员工列表加载失败，请收起后重试'
    ) : (
      '暂无数据'
    ),
    mode: isMultiple ? 'multiple' : undefined,
  };

  return (
    <Select {...selectProps}>
      {options.map((opt) => (
        <Select.Option key={opt.value} value={opt.value}>
          {opt.label}
        </Select.Option>
      ))}
    </Select>
  );
}
