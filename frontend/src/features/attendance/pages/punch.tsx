'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Button, Message, Modal, Tag,
} from '@arco-design/web-react';
import PageContainer from '@/components/PageContainer';
import DataState from '@/components/DataState';
import { attendanceApi } from '@/services/attendance';
import { usePermission } from '@/hooks/use-permission';
import useFetchState from '@/hooks/use-fetch-state';

// 状态 → 中文徽标（对齐旧项目 getStatusBadge 语义）
const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  normal: { label: '正常', color: '#16a34a', bg: '#ecfdf5' },
  late: { label: '迟到', color: '#dc2626', bg: '#fef2f2' },
  early: { label: '早退', color: '#ea580c', bg: '#fff7ed' },
  late_early: { label: '迟到且早退', color: '#e11d48', bg: '#fff1f2' },
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
  const router = useRouter();
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
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5 mb-4 flex justify-between items-center">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-semibold text-slate-800">考勤打卡</span>
              </div>
              <p className="text-xs text-slate-400 mt-1">{formatDate(serverTime)} {getWeekday(serverTime)}</p>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-[#2455D9] font-mono leading-none tabular-nums">
                {hh}:{mm}:{ss}
              </div>
              <div className="text-[10px] text-slate-400 mt-1">当前服务器时间</div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* ─── 今日考勤状态 ─── */}
            <div className="lg:col-span-2 space-y-4">
              <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
                <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-50">
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-4 bg-[#2455D9] rounded-full" />
                    <h2 className="text-sm font-semibold text-slate-800">今日考勤状态</h2>
                  </div>
                  {shift && hasSchedule && !isRestDay ? (
                    <div className="flex items-center gap-2 text-xs">
                      <span
                        className="px-2 py-0.5 rounded text-white text-[11px]"
                        style={{ background: shift.color || '#2455D9' }}
                      >
                        {shift.name}
                      </span>
                      <span className="text-slate-500">
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
                  <div className="bg-slate-50 rounded-xl p-4 text-center border border-slate-100">
                    <div className="text-[11px] text-slate-400 mb-2">上班打卡</div>
                    <div className={`text-lg font-bold tabular-nums ${hasClockedIn ? 'text-slate-800' : 'text-slate-300'}`}>
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
                  <div className="bg-slate-50 rounded-xl p-4 text-center border border-slate-100">
                    <div className="text-[11px] text-slate-400 mb-2">下班打卡</div>
                    <div className={`text-lg font-bold tabular-nums ${hasClockedOut ? 'text-slate-800' : 'text-slate-300'}`}>
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
                  <div className="bg-slate-50 rounded-xl p-4 text-center border border-slate-100">
                    <div className="text-[11px] text-slate-400 mb-2">计薪工时</div>
                    <div className="text-lg font-bold text-slate-800 tabular-nums">
                      {hasClockedOut ? workHoursOf(todayData?.firstPunch, todayData?.lastPunch) : '--'}
                    </div>
                    {todayData?.status === 'normal' && (
                      <div className="mt-2 flex justify-center">
                        <Tag color="green">正常</Tag>
                      </div>
                    )}
                    {!hasClockedOut && (
                      <div className="mt-2 text-[10px] text-slate-300">下班后统计</div>
                    )}
                  </div>
                </div>

                {/* 状态徽标（迟到/早退等） */}
                {statusMeta && statusMeta.label !== '正常' && (
                  <div className="mb-5 flex items-center gap-3 rounded-lg px-4 py-3 text-blue-600 text-xs border border-blue-100 bg-blue-50" style={{ color: statusMeta.color, background: statusMeta.bg, borderColor: `${statusMeta.color}22` }}>
                    <span className="w-2 h-2 rounded-full" style={{ background: statusMeta.color }} />
                    <span className="font-medium">系统提醒：您今日考勤状态为「{statusMeta.label}」</span>
                  </div>
                )}

                {/* 无排班 / 休息日 提示条 */}
                {!hasSchedule && (
                  <div className="mb-5 flex items-center gap-3 rounded-lg px-4 py-3 text-amber-700 border border-amber-200 bg-amber-50">
                    <span>⚠️</span>
                    <span className="font-medium">暂无排班，请先排班后再打卡</span>
                  </div>
                )}
                {isRestDay && (
                  <div className="mb-5 flex items-center gap-3 rounded-lg px-4 py-3 text-emerald-700 border border-emerald-200 bg-emerald-50">
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
                        style={clockInBtn.disabled || hasClockedIn ? {} : { background: '#2455D9', borderColor: '#2455D9' }}
                      >
                        {clockInBtn.text}
                      </Button>
                      {clockInHint && (
                        <div className={`mt-2 text-center text-[11px] min-h-[16px] ${clockInAllowed === false ? 'text-slate-400' : 'text-[#2455D9]'}`}>
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
                        style={clockOutBtn.disabled || !hasClockedIn || hasClockedOut ? {} : { background: '#4f46e5', borderColor: '#4f46e5' }}
                      >
                        {clockOutBtn.text}
                      </Button>
                      {clockOutHint && (
                        <div className={`mt-2 text-center text-[11px] min-h-[16px] ${clockOutAllowed === false ? 'text-slate-400' : 'text-[#4f46e5]'}`}>
                          {clockOutHint}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* ─── 快捷自助功能 ─── */}
            <div className="space-y-4">
              <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
                <div className="flex items-center gap-2 mb-6 pb-4 border-b border-slate-50">
                  <span className="w-1.5 h-4 bg-[#4f46e5] rounded-full" />
                  <h2 className="text-sm font-semibold text-slate-800">快捷自助功能</h2>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { icon: '📋', label: '打卡月报', path: '/attendance/monthly', bg: '#eef2ff', border: '#c7d2fe', text: '#3730a3' },
                    { icon: '🏖️', label: '在线请假', path: '/attendance/vacation/leave', bg: '#ecfdf5', border: '#a7f3d0', text: '#047857' },
                    { icon: '⏰', label: '加班申请', path: '/attendance/vacation/overtime', bg: '#fdf4ff', border: '#f5d0fe', text: '#86198f' },
                    { icon: '📊', label: '数据统计', path: '/attendance/daily', bg: '#fff7ed', border: '#fed7aa', text: '#9a3412' },
                  ].map((item) => (
                    <Button
                      key={item.label}
                      type="secondary"
                      long
                      onClick={() => router.push(item.path)}
                      style={{ background: item.bg, borderColor: item.border, color: item.text }}
                      className="!h-auto py-4 flex flex-col gap-2 items-center justify-center"
                    >
                      <span className="text-xl leading-none">{item.icon}</span>
                      <span className="text-xs font-medium" style={{ color: item.text }}>{item.label}</span>
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="text-center text-slate-400 mt-4 text-xs">
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
          <div className="mb-4 text-xs text-slate-400">
            请选择您今日的排班计划，提交后即可生效签到
          </div>
          {availableShifts.length === 0 ? (
            <div className="py-10 text-center text-sm text-slate-300">
              📋 暂无可用的班次
            </div>
          ) : (
            <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
              {availableShifts.map((s) => {
                const active = selectedShiftId === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSelectedShiftId(s.id)}
                    className={`w-full text-left pl-3 pr-3 py-3 rounded-md border-l-[3px] transition-colors duration-200 flex items-center gap-3 ${
                      active
                        ? 'border-l-[#2455D9] border-t border-b border-r border-[#bfdbfe] bg-[#eef2fc]'
                        : 'border-l-transparent border border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <span
                      className="w-3 h-3 rounded-full shrink-0 mt-0.5"
                      style={{ background: s.color || '#2455D9' }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2">
                        <span className="text-sm font-medium text-slate-800">{s.name}</span>
                        {s.isNextDay && (
                          <span className="text-[10px] px-1.5 py-px rounded-full bg-slate-100 text-slate-400 leading-none">
                            跨天
                          </span>
                        )}
                      </div>
                      {s.description && (
                        <div className="text-xs text-slate-400 mt-1 truncate">{s.description}</div>
                      )}
                    </div>
                    <span className="shrink-0 text-sm tabular-nums font-medium text-[#2455D9]">
                      {s.startTime} – {s.endTime}
                    </span>
                    <span
                      className={`w-5 h-5 shrink-0 rounded-full grid place-items-center text-[13px] leading-none ${
                        active ? 'bg-[#2455D9] text-white' : 'bg-slate-100 text-transparent'
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