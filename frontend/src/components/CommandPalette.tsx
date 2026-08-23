'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  IconDashboard,
  IconUser,
  IconCalendar,
  IconCheckCircle,
  IconIdcard,
  IconSafe,
  IconBook,
  IconNotification,
  IconFile,
  IconSettings,
  IconSearch,
  IconCommand,
  IconStar,
  IconTags,
  IconLocation,
  IconCustomerService,
} from '@arco-design/web-react/icon';

interface CommandItem {
  id: string;
  label: string;
  path: string;
  icon: React.ReactNode;
  group: string;
  keywords?: string;
}

const COMMANDS: CommandItem[] = [
  { id: 'dashboard', label: '工作台', path: '/', icon: <IconDashboard />, group: '常用', keywords: '首页 仪表盘 dashboard' },
  { id: 'employee-list', label: '员工列表', path: '/employees', icon: <IconUser />, group: '人事', keywords: '员工 人员 staff' },
  { id: 'employee-transactions', label: '员工事务', path: '/employees/transactions', icon: <IconUser />, group: '人事', keywords: '入职 离职 调动' },
  { id: 'employee-timeline', label: '人员履历', path: '/employees/timeline', icon: <IconUser />, group: '人事', keywords: '履历 入职 离职 调动 晋升' },
  { id: 'attendance-punch', label: '打卡', path: '/attendance/punch', icon: <IconCalendar />, group: '考勤', keywords: '签到 打卡 clock' },
  { id: 'attendance-daily', label: '考勤日报', path: '/attendance/daily', icon: <IconCalendar />, group: '考勤', keywords: '日报 daily' },
  { id: 'attendance-monthly', label: '考勤月报', path: '/attendance/monthly', icon: <IconCalendar />, group: '考勤', keywords: '月报 monthly' },
  { id: 'attendance-vacation-leave', label: '请假申请', path: '/attendance/vacation/leave', icon: <IconCalendar />, group: '考勤', keywords: '请假 休假 leave' },
  { id: 'attendance-vacation-overtime', label: '加班申请', path: '/attendance/vacation/overtime', icon: <IconCalendar />, group: '考勤', keywords: '加班 overtime' },
  { id: 'attendance-shifts', label: '班次管理', path: '/attendance/shifts', icon: <IconCalendar />, group: '考勤', keywords: '班次 shift' },
  { id: 'attendance-schedules', label: '排班管理', path: '/attendance/schedules', icon: <IconCalendar />, group: '考勤', keywords: '排班 schedule' },
  { id: 'approval-todo', label: '待办审批', path: '/approval/todo', icon: <IconCheckCircle />, group: '审批', keywords: '审批 待办 todo' },
  { id: 'approval-approved', label: '已办审批', path: '/approval/approved', icon: <IconCheckCircle />, group: '审批', keywords: '已办 approved' },
  { id: 'approval-submissions', label: '我的申请', path: '/approval/submissions', icon: <IconCheckCircle />, group: '审批', keywords: '申请 submissions' },
  { id: 'payroll-runs', label: '算薪批次', path: '/payroll/runs', icon: <IconIdcard />, group: '薪酬', keywords: '算薪 payroll' },
  { id: 'my-payslips', label: '我的工资条', path: '/payroll/my-payslips', icon: <IconIdcard />, group: '薪酬', keywords: '工资条 payslip' },
  { id: 'my-reimbursement', label: '我的报销', path: '/expense/my', icon: <IconSafe />, group: '薪酬', keywords: '报销 expense' },
  { id: 'expense-approval', label: '报销审批', path: '/expense/approval', icon: <IconSafe />, group: '薪酬', keywords: '报销审批' },
  { id: 'knowledge', label: '知识库', path: '/knowledge', icon: <IconBook />, group: '工具', keywords: '知识 knowledge' },
  { id: 'performance-cycles', label: '绩效管理', path: '/performance/cycles', icon: <IconStar />, group: '人事', keywords: '绩效 performance 周期' },
  { id: 'okr-objectives', label: 'OKR 目标', path: '/okr', icon: <IconStar />, group: '人事', keywords: 'okr 目标' },
  { id: 'finance-budgets', label: '财务预算', path: '/finance/budgets', icon: <IconSafe />, group: '薪酬', keywords: '预算 budget' },
  { id: 'finance-expense-standards', label: '费用标准', path: '/finance/expense-standards', icon: <IconSafe />, group: '薪酬', keywords: '费用 标准 expense' },
  { id: 'helpdesk', label: '工单客服', path: '/helpdesk', icon: <IconCustomerService />, group: '工具', keywords: '工单 ticket 客服 helpdesk' },
  { id: 'attendance-exception-rules', label: '考勤异常', path: '/attendance/exception-rules', icon: <IconCalendar />, group: '考勤', keywords: '异常 exception ' },
  { id: 'attendance-deduction-rules', label: '扣款规则', path: '/attendance/deduction-rules', icon: <IconCalendar />, group: '考勤', keywords: '扣款 deduction ' },
  { id: 'attendance-locations', label: '打卡定位', path: '/attendance/locations', icon: <IconLocation />, group: '考勤', keywords: '打卡 定位 location' },
  { id: 'employee-tags', label: '员工标签', path: '/employees/tags', icon: <IconTags />, group: '人事', keywords: '标签 tag' },
  { id: 'notifications', label: '我的通知', path: '/notifications', icon: <IconNotification />, group: '工具', keywords: '通知 notification' },
  { id: 'system-departments', label: '组织架构', path: '/system/departments', icon: <IconFile />, group: '系统', keywords: '部门 department' },
  { id: 'system-users', label: '用户管理', path: '/system/users', icon: <IconFile />, group: '系统', keywords: '用户 user' },
  { id: 'system-roles', label: '角色权限', path: '/system/roles', icon: <IconFile />, group: '系统', keywords: '角色 role' },
  { id: 'system-logs', label: '操作日志', path: '/system/logs', icon: <IconFile />, group: '系统', keywords: '日志 log' },
  { id: 'settings', label: '系统设置', path: '/settings', icon: <IconSettings />, group: '系统', keywords: '设置 settings' },
];

export default function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // 全局快捷键监听
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        e.stopPropagation();
        setOpen((prev) => !prev);
      }
      if (e.key === 'Escape' && open) {
        setOpen(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [open]);

  // 打开时聚焦输入框
  useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // 模糊匹配搜索
  const filteredCommands = useMemo(() => {
    if (!query.trim()) return COMMANDS;
    const q = query.toLowerCase().trim();
    return COMMANDS.filter((cmd) => {
      const text = `${cmd.label} ${cmd.group} ${cmd.keywords || ''}`.toLowerCase();
      return text.includes(q);
    });
  }, [query]);

  // 按分组组织结果
  const groupedResults = useMemo(() => {
    const groups = new Map<string, CommandItem[]>();
    for (const cmd of filteredCommands) {
      if (!groups.has(cmd.group)) groups.set(cmd.group, []);
      groups.get(cmd.group)!.push(cmd);
    }
    return Array.from(groups.entries());
  }, [filteredCommands]);

  // 扁平化用于键盘导航
  const flatList = useMemo(() => groupedResults.flatMap(([, items]) => items), [groupedResults]);

  // 选中项变化时滚动到可视区域
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${selectedIndex}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  const handleSelect = useCallback((cmd: CommandItem) => {
    router.push(cmd.path);
    setOpen(false);
  }, [router]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, flatList.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (flatList[selectedIndex]) {
        handleSelect(flatList[selectedIndex]);
      }
    }
  };

  let runningIndex = -1;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1100,
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'center',
            paddingTop: '12vh',
          }}
          onClick={() => setOpen(false)}
        >
          {/* 遮罩层 */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(15, 23, 42, 0.4)',
              backdropFilter: 'blur(6px)',
              WebkitBackdropFilter: 'blur(6px)',
            }}
          />

          {/* 面板主体 */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -10 }}
            transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={handleKeyDown}
            style={{
              position: 'relative',
              width: '560px',
              maxWidth: '92vw',
              maxHeight: '60vh',
              background: 'rgba(255, 255, 255, 0.95)',
              backdropFilter: 'blur(20px) saturate(180%)',
              WebkitBackdropFilter: 'blur(20px) saturate(180%)',
              borderRadius: '16px',
              border: '1px solid rgba(255, 255, 255, 0.8)',
              boxShadow: '0 20px 60px rgba(36, 85, 217, 0.15), 0 8px 24px rgba(0, 0, 0, 0.06)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {/* 搜索输入区 */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '16px 20px',
                borderBottom: '1px solid #e2e8f0',
                flexShrink: 0,
              }}
            >
              <IconSearch style={{ fontSize: 20, color: '#94a3b8', flexShrink: 0 }} />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setSelectedIndex(0);
                }}
                placeholder="搜索页面、功能..."
                style={{
                  flex: 1,
                  border: 'none',
                  outline: 'none',
                  background: 'transparent',
                  fontSize: '16px',
                  color: '#0f172a',
                  fontFamily: 'inherit',
                }}
              />
              <kbd
                style={{
                  fontSize: '11px',
                  color: '#94a3b8',
                  background: '#f1f5f9',
                  border: '1px solid #e2e8f0',
                  borderRadius: '4px',
                  padding: '2px 6px',
                  flexShrink: 0,
                  fontFamily: 'monospace',
                }}
              >
                ESC
              </kbd>
            </div>

            {/* 结果列表 */}
            <div
              ref={listRef}
              role="listbox"
              aria-label="命令结果"
              style={{
                overflowY: 'auto',
                padding: '8px',
                flex: 1,
                minHeight: 0,
              }}
            >
              {flatList.length === 0 ? (
                <div
                  style={{
                    padding: '40px 20px',
                    textAlign: 'center',
                    color: '#94a3b8',
                    fontSize: '14px',
                  }}
                >
                  未找到匹配结果
                </div>
              ) : (
                groupedResults.map(([group, items]) => (
                  <div key={group} style={{ marginBottom: '4px' }}>
                    <div
                      style={{
                        padding: '8px 12px 4px',
                        fontSize: '11px',
                        color: '#94a3b8',
                        fontWeight: 500,
                        textTransform: 'uppercase',
                        letterSpacing: '0.8px',
                      }}
                    >
                      {group}
                    </div>
                    {items.map((cmd) => {
                      runningIndex++;
                      const idx = runningIndex;
                      const isSelected = idx === selectedIndex;
                      return (
                        <div
                          key={cmd.id}
                          role="option"
                          aria-selected={isSelected}
                          data-idx={idx}
                          onClick={() => handleSelect(cmd)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            padding: '10px 12px',
                            borderRadius: '10px',
                            cursor: 'pointer',
                            transition: 'background 0.1s',
                            background: isSelected ? 'rgba(36, 85, 217, 0.08)' : 'transparent',
                          }}
                          onMouseEnter={() => setSelectedIndex(idx)}
                        >
                          <span
                            style={{
                              width: '32px',
                              height: '32px',
                              borderRadius: '8px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '16px',
                              flexShrink: 0,
                              color: isSelected ? '#2455D9' : '#64748b',
                              background: isSelected ? 'rgba(36, 85, 217, 0.1)' : '#f1f5f9',
                              transition: 'all 0.15s',
                            }}
                          >
                            {cmd.icon}
                          </span>
                          <span
                            style={{
                              flex: 1,
                              fontSize: '14px',
                              color: isSelected ? '#2455D9' : '#334155',
                              fontWeight: isSelected ? 500 : 400,
                            }}
                          >
                            {cmd.label}
                          </span>
                          {isSelected && (
                            <kbd
                              style={{
                                fontSize: '11px',
                                color: '#94a3b8',
                                fontFamily: 'monospace',
                              }}
                            >
                              ↵
                            </kbd>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))
              )}
            </div>

            {/* 底部提示栏 */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 16px',
                borderTop: '1px solid #e2e8f0',
                background: 'rgba(248, 250, 252, 0.6)',
                flexShrink: 0,
              }}
            >
              <div style={{ display: 'flex', gap: '12px', fontSize: '11px', color: '#94a3b8' }}>
                <span>
                  <kbd style={{ fontFamily: 'monospace' }}>↑↓</kbd> 导航
                </span>
                <span>
                  <kbd style={{ fontFamily: 'monospace' }}>↵</kbd> 选择
                </span>
                <span>
                  <kbd style={{ fontFamily: 'monospace' }}>ESC</kbd> 关闭
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#94a3b8' }}>
                <IconCommand style={{ fontSize: 12 }} />
                <span>K</span>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
