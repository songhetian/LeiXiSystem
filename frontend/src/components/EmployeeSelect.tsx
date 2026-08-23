'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { Select, Spin } from '@arco-design/web-react';
import type { ComponentProps } from 'react';
import { employeeApi, type Employee } from '@/services/employee';

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
}

interface OptionData {
  label: string;
  value: number;
  raw: Employee;
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
}: EmployeeSelectProps) {
  const [options, setOptions] = useState<OptionData[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fetchedRef = useRef(false);

  const isMultiple = mode === 'multiple';

  // 将 Employee 转为 Arco Select option
  const toOption = (emp: Employee): OptionData => ({
    label: `${emp.employeeNo} - ${emp.name}${emp.departmentName ? ` (${emp.departmentName})` : ''}`,
    value: emp.id,
    raw: emp,
  });

  // 远程搜索
  const fetchEmployees = async (keyword: string) => {
    setLoading(true);
    try {
      const res = await employeeApi.getList({
        name: keyword || undefined,
        page: 1,
        pageSize: 50,
        departmentId,
      });
      const list = res.data?.list ?? [];
      setOptions(list.map(toOption));
    } catch {
      setOptions([]);
    } finally {
      setLoading(false);
    }
  };

  // 首次加载（无搜索词时取前 50 条）
  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    fetchEmployees('');
  }, []);

  // departmentId 变化时重新加载
  useEffect(() => {
    fetchEmployees('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [departmentId]);

  // 搜索防抖
  const handleSearch = (val: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchEmployees(val);
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
    value: selectedValues as any,
    onChange: handleChange as any,
    showSearch: true,
    filterOption: false,
    onSearch: handleSearch as any,
    placeholder,
    disabled,
    allowClear,
    style: { width: '100%', ...style },
    className,
    notFoundContent: loading ? <Spin /> : '暂无数据',
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
