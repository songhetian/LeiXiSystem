'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Button, Message, Modal, Tag,
} from '@arco-design/web-react';
import {
  IconCalendar,
  IconFile,
  IconThunderbolt,
  IconDashboard,
  IconRight,
} from '@arco-design/web-react/icon';
import PageContainer from '@/components/PageContainer';
import DataState from '@/components/DataState';
import { attendanceApi } from '@/services/attendance';
import { usePermission } from '@/hooks/use-permission';
import useFetchState from '@/hooks/use-fetch-state';

// 状态 → 中文徽标（对齐旧项目 getStatusBadge 语义）
// 用语义色 token：-text 保证 WCAG AA 对比度、-bg 随明暗主题切换，
// 避免硬编码浅底（#ecfdf5 等）在暗色下失真、文字对比不足。
const STATUS_META: Record<string, { label: string; color: string; bg: string; border: string }> = {
  normal: { label: '正常', color: 'var(--lx-success-text)', bg: 'var(--lx-success-bg)', border: 'var(--lx-success)' },
  late: { label: '迟到', color: 'var(--lx-danger-text)', bg: 'var(--lx-danger-bg)', border: 'var(--lx-danger)' },
  early: { label: '早退', color: 'var(--lx-warning-text)', bg: 'var(--lx-warning-bg)', border: 'var(--lx-warning)' },
  late_early: { label: '迟到且早退', color: 'var(--lx-danger-text)', bg: 'var(--lx-danger-bg)', border: 'var(--lx-danger)' },
};

// 仅时分（HH:mm），用于打卡时间展示
function formatHM(iso?: string | null): string {
  if (!iso) return '--:--';
  try {
    const d = new Date(iso);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  } catch {
    return '--:--';
  }
}

// 计薪工时（小时）：有上下班卡时据实计算，否则占位
function workHoursOf(first?: string | null, last?: string | null): string {
  if (!first || !last) return '--';
  const diff = new Date(last).getTime() - new Date(first).getTime();
  if (diff <= 0) return '--';
  return `${(diff / 3600000).toFixed(1)}h`;
}

function formatDate(d: Date): string {
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

function getWeekday(d: Date): string {
  const names = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
  return names[d.getDay()];
}

interface TodayPunchData {
  id?: number;
  firstPunch?: string | null;
  lastPunch?: string | null;
  punchCount?: number;
  lateMinutes?: number;
  earlyMinutes?: number;
  status?: string;
  shift?: { id: number; name: string; startTime: string; endTime: string; isNextDay?: boolean; color?: string; isRest?: boolean } | null;
  hasSchedule?: boolean;
  isRestDay?: boolean;
  clockIn?: { allowed: boolean; message: string };
  clockOut?: { allowed: boolean; message: string };
}

export default function PunchPage() {
  usePermission();
  const { data: todayData, loading, error, run: runFetch } = useFetchState<TodayPunchData>();
  const [punching, setPunching] = useState(false);

  const [serverTime, setServerTime] = useState(new Date());
  const [scheduleModalVisible, setScheduleModalVisible] = useState(false);
  const [availableShifts, setAvailableShifts] = useState<{ id: number; name: string; startTime: string; endTime: string; isNextDay?: boolean; color?: string; description?: string }[]>([]);
  const [selectedShiftId, setSelectedShiftId] = useState<number | undefined>();
  const [scheduling, setScheduling] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setServerTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const fetchToday = useCallback(async () => {
    await runFetch(async () => {
      const res = await attendanceApi.getTodayPunch();
      if (res.code === 0) return res.data ?? null;
      throw new Error(res.message || '获取打卡数据失败');
    });
  }, [runFetch]);

  useEffect(() => {
    fetchToday();
  }, [fetchToday]);

  const fetchAvailableShifts = async () => {
    try {
      const res = await attendanceApi.getAvailableShifts();
      if (res.code === 0 && res.data) setAvailableShifts(res.data as any);
    } catch {
      // ignore
    }
  };

  const handleClockIn = async () => {
    setPunching(true);
    try {
      const res = await attendanceApi.clockIn();
      if (res.code === 0 && res.data) {
        Message.success(res.data.status === 'late' ? '打卡成功，但您迟到了' : '打卡成功');
        fetchToday();
      } else {
        Message.error(res.message || '打卡失败');
      }
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.response?.data?.data?.message || '打卡失败';
      Message.error(msg);
    } finally {
      setPunching(false);
    }
  };

  const handleClockOut = async () => {
    setPunching(true);
    try {
      const res = await attendanceApi.clockOut();
      if (res.code === 0 && res.data) {
        const late = res.data.earlyMinutes && res.data.earlyMinutes > 0;
        Message.success(late ? '打卡成功，但您早退了' : '打卡成功');
        fetchToday();
      } else {
        Message.error(res.message || '打卡失败');
      }
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.response?.data?.data?.message || '打卡失败';
      Message.error(msg);
    } finally {
      setPunching(false);
    }
  };

  const openScheduleModal = async () => {
    setScheduleModalVisible(true);
    setSelectedShiftId(todayData?.shift?.id);
    await fetchAvailableShifts();
  };

  const handleSelfSchedule = async () => {
    if (!selectedShiftId) {
      Message.warning('请选择班次');
      return;
    }
    setScheduling(true);
    try {
      const res = await attendanceApi.selfSchedule(selectedShiftId);
      if (res.code === 0) {
        Message.success('排班设置成功');
        setScheduleModalVisible(false);
        fetchToday();
      } else {
        Message.error(res.message || '设置失败');
      }
    } catch (e: any) {
      Message.error(e?.response?.data?.message || '设置失败');
    } finally {
      setScheduling(false);
    }
  };

  const hasClockedIn = !!todayData?.firstPunch;
  const hasClockedOut = !!todayData?.lastPunch;
  const shift = todayData?.shift || null;
  const isRestDay = !!todayData?.isRestDay;
  const hasSchedule = !!todayData?.hasSchedule;
  const statusMeta = todayData?.status ? STATUS_META[todayData.status] : null;

  const clockInAllowed = todayData?.clockIn?.allowed;
  const clockInMsg = todayData?.clockIn?.message || '';
  const clockOutAllowed = todayData?.clockOut?.allowed;
  const clockOutMsg = todayData?.clockOut?.message || '';

  // 上班按钮态
  const clockInBtn: { text: string; disabled: boolean; primary: boolean } = hasClockedIn
    ? { text: '已完成上班打卡', disabled: true, primary: false }
    : clockInAllowed === false
      ? { text: '上班签到', disabled: true, primary: false }
      : { text: punching ? '处理中...' : '上班签到', disabled: false, primary: true };

  // 下班按钮态
  const clockOutBtn: { text: string; disabled: boolean; primary: boolean } =
    !hasClockedIn
      ? { text: '等待上班签到', disabled: true, primary: false }
      : hasClockedOut
        ? { text: '已完成下班打卡', disabled: true, primary: false }
        : clockOutAllowed === false
          ? { text: '下班签退', disabled: true, primary: false }
          : { text: punching ? '处理中...' : '下班签退', disabled: false, primary: true };

  // 按钮下方提示文案
  const clockInHint = !hasClockedIn
    ? clockInAllowed === false
      ? clockInMsg
      : shift && hasSchedule
        ? `签到时段已开启（${shift.startTime}）`
        : ''
    : '';
  const clockOutHint =
    hasClockedIn && !hasClockedOut
      ? clockOutAllowed === false
        ? clockOutMsg
        : shift && hasSchedule
          ? `签退时段已开启（${shift.endTime}）`
          : ''
      : '';

  const hh = String(serverTime.getHours()).padStart(2, '0');
  const mm = String(serverTime.getMinutes()).padStart(2, '0');
  const ss = String(serverTime.getSeconds()).padStart(2, '0');

  return (
    <PageContainer>
      <DataState loading={loading} error={error} onRetry={fetchToday}>
        <div className="max-w-5xl mx-auto">
          {/* ─── 顶部信息卡：日期 + 服务器时间 ─── */}
          <div className="bg-surface rounded-xl shadow-sm border border-border-2 p-5 mb-4 flex justify-between items-center">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-semibold text-text-1">考勤打卡</span>
              </div>
              <p className="text-xs text-text-4 mt-1">{formatDate(serverTime)} {getWeekday(serverTime)}</p>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-brand font-mono leading-none tabular-nums">
                {hh}:{mm}:{ss}
              </div>
              <div className="text-xs text-text-4 mt-1">当前服务器时间</div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {/* ─── 今日考勤状态 ─── */}
            <div className="flex flex-col gap-4">
              <div className="bg-surface rounded-xl shadow-sm border border-border-2 p-6">
                <div className="flex justify-between items-center mb-6 pb-4 border-b border-border-2">
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-4 bg-brand rounded-full" />
                    <h2 className="text-sm font-semibold text-text-1">今日考勤状态</h2>
                  </div>
                  {shift && hasSchedule && !isRestDay ? (
                    <div className="flex items-center gap-2 text-xs">
                      <span
                        className="px-2 py-0.5 rounded text-white text-xs"
                        style={{ background: shift.color || 'var(--lx-primary)' }}
                      >
                        {shift.name}
                      </span>
                      <span className="text-text-3">
                        {shift.startTime} - {shift.endTime}{shift.isNextDay ? '（次日）' : ''}
                      </span>
                    </div>
                  ) : (!isRestDay && (
                    <Button size="small" type="primary" onClick={openScheduleModal}>
                      设置排班
                    </Button>
                  ))}
                </div>

                {/* 三卡统计：上班 / 下班 / 计薪工时（对齐旧项目顺序） */}
                <div className="grid grid-cols-3 gap-3 mb-6">
                  <div className="bg-bg-secondary rounded-xl p-4 text-center border border-border-2">
                    <div className="text-xs text-text-4 mb-2">上班打卡</div>
                    <div className={`text-lg font-bold tabular-nums ${hasClockedIn ? 'text-text-1' : 'text-text-4'}`}>
                      {formatHM(todayData?.firstPunch)}
                    </div>
                    {hasClockedIn && (
                      <div className="mt-2 flex justify-center">
                        {todayData?.lateMinutes ? (
                          <Tag color="red">迟到 {todayData.lateMinutes} 分钟</Tag>
                        ) : (
                          <Tag color="green">正常</Tag>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="bg-bg-secondary rounded-xl p-4 text-center border border-border-2">
                    <div className="text-xs text-text-4 mb-2">下班打卡</div>
                    <div className={`text-lg font-bold tabular-nums ${hasClockedOut ? 'text-text-1' : 'text-text-4'}`}>
                      {formatHM(todayData?.lastPunch)}
                    </div>
                    {hasClockedOut && (
                      <div className="mt-2 flex justify-center">
                        {todayData?.earlyMinutes ? (
                          <Tag color="gold">早退 {todayData.earlyMinutes} 分钟</Tag>
                        ) : (
                          <Tag color="green">正常</Tag>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="bg-bg-secondary rounded-xl p-4 text-center border border-border-2">
                    <div className="text-xs text-text-4 mb-2">计薪工时</div>
                    <div className="text-lg font-bold text-text-1 tabular-nums">
                      {hasClockedOut ? workHoursOf(todayData?.firstPunch, todayData?.lastPunch) : '--'}
                    </div>
                    {todayData?.status === 'normal' && (
                      <div className="mt-2 flex justify-center">
                        <Tag color="green">正常</Tag>
                      </div>
                    )}
                    {!hasClockedOut && (
                      <div className="mt-2 text-xs text-text-4">下班后统计</div>
                    )}
                  </div>
                </div>

                {/* 状态徽标（迟到/早退等） */}
                {statusMeta && statusMeta.label !== '正常' && (
                  <div className="mb-5 flex items-center gap-3 rounded-lg px-4 py-3 text-xs border" style={{ color: statusMeta.color, background: statusMeta.bg, borderColor: statusMeta.border }}>
                    <span className="w-2 h-2 rounded-full" style={{ background: statusMeta.color }} />
                    <span className="font-medium">系统提醒：您今日考勤状态为「{statusMeta.label}」</span>
                  </div>
                )}

                {/* 无排班 / 休息日 提示条 */}
                {!hasSchedule && (
                  <div className="mb-5 flex items-center gap-3 rounded-lg px-4 py-3 text-text-1 border border-warning bg-warning-light">
                    <span>⚠️</span>
                    <span className="font-medium">暂无排班，请先排班后再打卡</span>
                  </div>
                )}
                {isRestDay && (
                  <div className="mb-5 flex items-center gap-3 rounded-lg px-4 py-3 text-text-1 border border-success bg-success-light">
                    <span>🛌</span>
                    <span className="font-medium">休息日，无需打卡</span>
                  </div>
                )}

                {/* 打卡按钮区 */}
                {!isRestDay && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Button
                        type="primary"
                        size="large"
                        long
                        loading={punching}
                        disabled={clockInBtn.disabled}
                        onClick={hasClockedIn ? undefined : handleClockIn}
                        style={clockInBtn.disabled || hasClockedIn ? {} : { background: 'var(--lx-primary)', borderColor: 'var(--lx-primary)' }}
                      >
                        {clockInBtn.text}
                      </Button>
                      {clockInHint && (
                        <div className={`mt-2 text-center text-xs min-h-[16px] ${clockInAllowed === false ? 'text-text-4' : 'text-brand'}`}>
                          {clockInHint}
                        </div>
                      )}
                    </div>
                    <div>
                      <Button
                        type="primary"
                        size="large"
                        long
                        loading={punching}
                        disabled={clockOutBtn.disabled}
                        onClick={!hasClockedIn || hasClockedOut ? undefined : handleClockOut}
                        style={clockOutBtn.disabled || !hasClockedIn || hasClockedOut ? {} : { background: 'var(--lx-clock-out)', borderColor: 'var(--lx-clock-out)' }}
                      >
                        {clockOutBtn.text}
                      </Button>
                      {clockOutHint && (
                        <div className={`mt-2 text-center text-xs min-h-[16px] ${clockOutAllowed === false ? 'text-text-4' : 'text-clock-out'}`}>
                          {clockOutHint}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* ─── 快捷自助功能（位于今日考勤状态下方） ─── */}
                <div className="bg-surface rounded-xl shadow-sm border border-border-2 p-6">
                  <div className="flex items-center gap-2 mb-6 pb-4 border-b border-border-2">
                    <span className="w-1.5 h-4 bg-clock-out rounded-full" />
                    <h2 className="text-sm font-semibold text-text-1">快捷自助功能</h2>
                  </div>
                  <div className="flex flex-col gap-2.5">
                    {[
                      { icon: <IconCalendar />, label: '打卡月报', path: '/attendance/monthly', tone: 'bg-quick-monthly' },
                      { icon: <IconFile />, label: '在线请假', path: '/attendance/vacation/leave', tone: 'bg-quick-leave' },
                      { icon: <IconThunderbolt />, label: '加班申请', path: '/attendance/vacation/overtime', tone: 'bg-quick-overtime' },
                      { icon: <IconDashboard />, label: '数据统计', path: '/attendance/daily', tone: 'bg-quick-stats' },
                    ].map((item) => (
                      <Link
                        key={item.label}
                        href={item.path}
                        prefetch
                        className={`group flex items-center justify-between rounded-lg px-4 py-3 text-white transition-[filter] hover:brightness-95 active:brightness-90 ${item.tone}`}
                      >
                        <span className="flex items-center gap-2 text-sm font-medium">
                          <span className="text-base leading-none">{item.icon}</span>
                          {item.label}
                        </span>
                        <span className="transition-colors opacity-90">
                          <IconRight />
                        </span>
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="text-center text-text-4 mt-4 text-xs">
            打卡时间精确到秒，班次内打卡自动判定迟到 / 早退
          </div>
        </div>
      </DataState>

      <Modal
        title="设置今日排班"
        visible={scheduleModalVisible}
        onCancel={() => setScheduleModalVisible(false)}
        autoFocus={false}
        footer={null}
      >
        <div className="py-1">
          <div className="mb-4 text-xs text-text-4">
            请选择您今日的排班计划，提交后即可生效签到
          </div>
          {availableShifts.length === 0 ? (
            <div className="py-10 text-center text-sm text-text-4">
              📋 暂无可用的班次
            </div>
          ) : (
            <div className="flex flex-col gap-2 max-h-[280px] overflow-y-auto pr-1">
              {availableShifts.map((s) => {
                const active = selectedShiftId === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSelectedShiftId(s.id)}
                    className={`w-full text-left pl-3 pr-3 py-3 rounded-md border-l-[3px] transition-colors duration-200 flex items-center gap-3 ${
                      active
                        ? 'border-l-brand border-t border-b border-r border-brand-200 bg-brand-light'
                        : 'border-l-transparent border border-border-1 bg-surface hover:bg-bg-secondary'
                    }`}
                  >
                    <span
                      className="w-3 h-3 rounded-full shrink-0 mt-0.5"
                      style={{ background: s.color || 'var(--lx-primary)' }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2">
                        <span className="text-sm font-medium text-text-1">{s.name}</span>
                        {s.isNextDay && (
                          <span className="text-xs px-1.5 py-px rounded-full bg-bg-hover text-text-4 leading-none">
                            跨天
                          </span>
                        )}
                      </div>
                      {s.description && (
                        <div className="text-xs text-text-4 mt-1 truncate">{s.description}</div>
                      )}
                    </div>
                    <span className="shrink-0 text-sm tabular-nums font-medium text-brand">
                      {s.startTime} – {s.endTime}
                    </span>
                    <span
                      className={`w-5 h-5 shrink-0 rounded-full grid place-items-center text-sm leading-none ${
                        active ? 'bg-brand text-white' : 'bg-bg-hover text-transparent'
                      }`}
                    >
                      ✓
                    </span>
                  </button>
                );
              })}
            </div>
          )}
          <div className="mt-4 flex justify-end gap-3">
            <Button onClick={() => setScheduleModalVisible(false)}>
              取消
            </Button>
            <Button
              type="primary"
              loading={scheduling}
              disabled={!selectedShiftId}
              onClick={handleSelfSchedule}
            >
              {scheduling ? '提交中...' : '确认设置'}
            </Button>
          </div>
        </div>
      </Modal>
    </PageContainer>
  );
}