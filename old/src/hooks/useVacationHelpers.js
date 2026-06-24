import { useState, useEffect } from 'react';

/**
 * 防抖Hook - 延迟更新值直到用户停止输入
 * @param {any} value - 需要防抖的值
 * @param {number} delay - 延迟时间(毫秒)
 * @returns {any} 防抖后的值
 */
export function useDebounce(value, delay = 300) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

/**
 * 获取快捷日期范围
 * @param {string} type - 类型: 'today', 'week', 'month', 'quarter', 'year'
 * @returns {[string, string]} [开始日期, 结束日期] YYYY-MM-DD格式
 */
export function getQuickDateRange(type) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const date = now.getDate();

  let start, end;

  switch (type) {
    case 'today':
      start = end = new Date(year, month, date);
      break;

    case 'week':
      const day = now.getDay();
      start = new Date(year, month, date - day + 1); // 周一
      end = new Date(year, month, date + (7 - day)); // 周日
      break;

    case 'month':
      start = new Date(year, month, 1);
      end = new Date(year, month + 1, 0);
      break;

    case 'quarter':
      const quarterMonth = Math.floor(month / 3) * 3;
      start = new Date(year, quarterMonth, 1);
      end = new Date(year, quarterMonth + 3, 0);
      break;

    case 'year':
      start = new Date(year, 0, 1);
      end = new Date(year, 11, 31);
      break;

    default:
      return [null, null];
  }

  return [
    formatDateToString(start),
    formatDateToString(end)
  ];
}

/**
 * 格式化日期为 YYYY-MM-DD
 */
function formatDateToString(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * 计算两个日期之间的天数差
 */
export function daysBetween(start, end) {
  const startDate = new Date(start);
  const endDate = new Date(end);
  const diff = endDate - startDate;
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}
