'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Button, Message, Modal, Empty,
} from '@arco-design/web-react';
import {
  IconCalendar,
  IconFile,
  IconThunderbolt,
  IconDashboard,
  IconRight,
  IconExclamationCircle,
  IconMoon,
  IconCheckCircleFill,
  IconExclamation,
} from '@arco-design/web-react/icon';
import PageContainer from '@/components/PageContainer';
import StatusTag from '@/components/StatusTag';
import DataState from '@/components/DataState';
import { attendanceApi, type Shift } from '@/services/attendance';
import { useCachedData } from '@/hooks/use-cached-data';
import { getApiErrorMessage } from '@/lib/api-error';
import { usePermission } from '@/hooks/use-permission';
import { todayStr } from '@/lib/format';

// 状态 → 中文徽标（对齐旧项目 getStatusBadge 语义）
// 用语义色 token：-text 保证 WCAG AA 对比度、-bg 随明暗主题切换，
// 避免硬编码浅底（#ecfdf5 等）在暗色下失真、文字对比不足。
const STATUS_META: Record<string, { label: string; color: string; bg: string; border: string }> = {
  normal: { label: '正常', color: 'var(--lx-success-text)', bg: 'var(--lx-success-bg)', border: 'var(--lx-success)' },
  late: { label: '迟到', color: 'var(--lx-danger-text)', bg: 'var(--lx-danger-bg)', border: 'var(--lx-danger)' },
  early: { label: '早退', color: 'var(--lx-warning-text)', bg: 'var(--lx-warning-bg)', border: 'var(--lx-warning)' },
  late_early: { label: '迟到且早退', color: 'var(--lx-danger-text)', bg: 'var(--lx-danger-bg)', border: 'var(--lx-danger)' },
};

// 今日打卡状态徽标统一用公共 StatusTag（Arco Design Pro 标准）
const NORMAL_TAG_MAP: Record<string, { label: string; color: string }> = {
  normal: { label: '正常', color: 'success' },
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
  /** 账号未绑定员工档案时后端返回的状态标记（超级管理员等纯系统账号） */
  noEmployeeProfile?: boolean;
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

/**
 * 时钟显示：每秒自转的 state 隔离在本组件内。
 * 此前 serverTime 挂在页面顶层 state，一秒一次把整页（含表单/列表）全部重渲，
 * 打卡页越长越卡；现在只有这一小块数字在重渲染。
 */
function PunchClock() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');

  return (
    <div className="text-right">
      <div className="text-2xl font-bold text-brand font-mono leading-none tabular-nums">
        {hh}:{mm}:{ss}
      </div>
      <div className="text-xs text-text-4 mt-1">
        {formatDate(now)} {getWeekday(now)}
      </div>
    </div>
  );
}

export default function PunchPage() {
  const [punching, setPunching] = useState(false);
  const { can } = usePermission();
  const router = useRouter();

  const [scheduleModalVisible, setScheduleModalVisible] = useState(false);
  // 直接复用服务层 Shift 类型，避免再抄一份局部形状（抄的那份与真实返回不完全兼容，只能靠 as any 压过去）
  const [availableShifts, setAvailableShifts] = useState<Shift[]>([]);
  const [selectedShiftId, setSelectedShiftId] = useState<number | undefined>();
  const [scheduling, setScheduling] = useState(false);

  // SWR 缓存：cacheKey 编入当天日期防跨天串数据。原页面无轮询/定时刷新，
  // 实时性靠 revalidateOnFocus（默认开）+ 打卡/排班写操作后 revalidate() 强刷。
  const { data: todayData, loading, error, revalidate } = useCachedData<TodayPunchData>(
    `attendance:today-punch:${todayStr()}`,
    async () => {
      const res = await attendanceApi.getTodayPunch();
      if (res.code === 0) return (res.data ?? null) as unknown as TodayPunchData;
      throw new Error(res.message || '获取打卡数据失败');
    },
  );

  const fetchAvailableShifts = async () => {
    try {
      const res = await attendanceApi.getAvailableShifts();
      if (res.code === 0 && res.data) setAvailableShifts(res.data);
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
        await revalidate();
      } else {
        Message.error(res.message || '打卡失败');
      }
    } catch (e) {
      Message.error(getApiErrorMessage(e, '打卡失败'));
    } finally {
      setPunching(false);
    }
  };

  const handleClockOut = async () => {
    setPunching(true);
    try {
      const res = await attendanceApi.clockOut();
      if (res.code === 0 && res.data) {
        const early = res.data.earlyMinutes && res.data.earlyMinutes > 0;
        Message.success(early ? '打卡成功，但您早退了' : '打卡成功');
        await revalidate();
      } else {
        Message.error(res.message || '打卡失败');
      }
    } catch (e) {
      Message.error(getApiErrorMessage(e, '打卡失败'));
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
        await revalidate();
      } else {
        Message.error(res.message || '设置失败');
      }
    } catch (e) {
      Message.error(getApiErrorMessage(e, '设置失败'));
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

  // 上班按钮态：可用（主蓝） / 已完成（置灰） / 禁用（置灰 + 原因）
  const clockInBtn: { text: string; disabled: boolean; done: boolean } = hasClockedIn
    ? { text: '已完成上班打卡', disabled: true, done: true }
    : clockInAllowed === false
      ? { text: '上班签到', disabled: true, done: false }
      : { text: punching ? '处理中...' : '上班签到', disabled: false, done: false };

  // 下班按钮态：未上班禁用 / 已完成置灰 / 禁用 + 原因
  const clockOutBtn: { text: string; disabled: boolean; done: boolean } =
    !hasClockedIn
      ? { text: '等待上班签到', disabled: true, done: false }
      : hasClockedOut
        ? { text: '已完成下班打卡', disabled: true, done: true }
        : clockOutAllowed === false
          ? { text: '下班签退', disabled: true, done: false }
          : { text: punching ? '处理中...' : '下班签退', disabled: false, done: false };

  // 按钮下方提示文案：禁用给原因，可用给时段
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

  // 账号没有员工档案：打卡、排班、假期都基于员工档案，纯系统账号（如超级管理员）
  // 本来就可能没有。此时给「怎么绑定」的引导，而不是抛「员工不存在」的红色报错。
  if (todayData?.noEmployeeProfile) {
    return (
      <PageContainer title="打卡" subTitle="今日签到签退与个人考勤记录">
        <div className="punch-card max-w-3xl mx-auto">
          <Empty description="当前账号还没有绑定员工档案" />
          <div className="mx-auto mt-4 max-w-xl text-sm leading-6 text-text-2">
            <p className="mb-2">
              打卡、排班、假期余额、工资条这些个人功能都挂在员工档案上；系统账号
              （例如超级管理员）默认不关联档案，所以这里没有可打卡的对象。
            </p>
            <p className="mb-2">
              绑定方式：进入「员工列表」找到你本人的档案 → 编辑 → 把「关联账号」选成当前登录账号 →
              保存，然后刷新本页。
            </p>
            <p className="mb-0 text-text-3">
              如果列表里还没有你的档案，请先由人事创建员工档案，再按上面的步骤绑定。
            </p>
          </div>
          {can('employee:view') && (
            <div className="mt-5 text-center">
              <Button type="primary" onClick={() => router.push('/employees')}>
                前往员工列表
              </Button>
            </div>
          )}
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer title="打卡" subTitle="今日签到签退与个人考勤记录">
      <DataState loading={loading} error={error} onRetry={() => { void revalidate(); }}>
        <div className="max-w-5xl mx-auto">
          {/* ─── 顶部信息卡：标题 + 服务器时间（时钟独立子组件，避免整页每秒重渲） ─── */}
          <div className="punch-card mb-4 flex justify-between items-center">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-semibold text-text-1">考勤打卡</span>
              </div>
              <p className="text-xs text-text-4 mt-1">打卡时间精确到秒，班次内打卡自动判定迟到 / 早退</p>
            </div>
            <PunchClock />
          </div>

          {/* ─── 今日考勤状态 ─── */}
          <div className="punch-card p-6">
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

            {/* 四格统计：上班 / 下班 / 计薪工时 / 打卡次数 */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
              <div className="punch-stat">
                <div className="punch-stat-label">上班打卡</div>
                <div className={`punch-stat-value ${hasClockedIn ? '' : 'is-empty'}`}>
                  {formatHM(todayData?.firstPunch)}
                </div>
                {hasClockedIn && (
                  <div className="mt-2 flex justify-center">
                    {todayData?.lateMinutes ? (
                      <StatusTag
                        status="late"
                        statusMap={{ late: { label: `迟到 ${todayData.lateMinutes} 分钟`, color: 'danger' } }}
                      />
                    ) : (
                      <StatusTag status="normal" statusMap={NORMAL_TAG_MAP} />
                    )}
                  </div>
                )}
              </div>
              <div className="punch-stat">
                <div className="punch-stat-label">下班打卡</div>
                <div className={`punch-stat-value ${hasClockedOut ? '' : 'is-empty'}`}>
                  {formatHM(todayData?.lastPunch)}
                </div>
                {hasClockedOut && (
                  <div className="mt-2 flex justify-center">
                    {todayData?.earlyMinutes ? (
                      <StatusTag
                        status="early_leave"
                        statusMap={{ early_leave: { label: `早退 ${todayData.earlyMinutes} 分钟`, color: 'warning' } }}
                      />
                    ) : (
                      <StatusTag status="normal" statusMap={NORMAL_TAG_MAP} />
                    )}
                  </div>
                )}
              </div>
              <div className="punch-stat">
                <div className="punch-stat-label">计薪工时</div>
                <div className="punch-stat-value">
                  {hasClockedOut ? workHoursOf(todayData?.firstPunch, todayData?.lastPunch) : '--'}
                </div>
                <div className="mt-2 text-xs text-text-4 text-center">
                  {todayData?.status === 'normal' ? <StatusTag status="normal" statusMap={NORMAL_TAG_MAP} /> : '下班后统计'}
                </div>
              </div>
              <div className="punch-stat">
                <div className="punch-stat-label">今日打卡次数</div>
                <div className="punch-stat-value">
                  {todayData?.punchCount ?? 0}
                </div>
                <div className="mt-2 text-xs text-text-4 text-center">含重复补打</div>
              </div>
            </div>

            {/* 状态徽标（迟到/早退等） */}
            {statusMeta && statusMeta.label !== '正常' && (
              <div
                className="punch-alert mb-5"
                style={{ color: statusMeta.color, background: statusMeta.bg, borderColor: statusMeta.border }}
              >
                <IconExclamationCircle style={{ flexShrink: 0 }} />
                <span className="font-medium">系统提醒：您今日考勤状态为「{statusMeta.label}」</span>
              </div>
            )}

            {/* 无排班 / 休息日 提示条（emoji → Arco 语义图标） */}
            {!hasSchedule && (
              <div className="punch-alert mb-5 border-warning bg-warning-light">
                <IconExclamation className="text-warning" style={{ flexShrink: 0 }} />
                <span className="font-medium">暂无排班，请先排班后再打卡</span>
              </div>
            )}
            {isRestDay && (
              <div className="punch-alert mb-5 border-success bg-success-light">
                <IconMoon className="text-success" style={{ flexShrink: 0 }} />
                <span className="font-medium">休息日，无需打卡</span>
              </div>
            )}

            {/* 打卡按钮区：每个上下文一枚大按钮，完成/禁用置灰并在下方说明原因 */}
            {!isRestDay && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Button
                    type="primary"
                    size="large"
                    long
                    loading={punching && !hasClockedOut && !clockInBtn.disabled}
                    disabled={clockInBtn.disabled}
                    className={`punch-btn ${clockInBtn.done ? 'is-done' : ''}`}
                    onClick={hasClockedIn ? undefined : handleClockIn}
                  >
                    {clockInBtn.text}
                  </Button>
                  {clockInHint && (
                    <div className={`punch-hint ${clockInAllowed === false ? 'is-muted' : ''}`}>
                      {clockInHint}
                    </div>
                  )}
                </div>
                <div>
                  <Button
                    type="primary"
                    size="large"
                    long
                    loading={punching && hasClockedIn && !hasClockedOut}
                    disabled={clockOutBtn.disabled}
                    className={`punch-btn punch-btn-out ${clockOutBtn.done ? 'is-done' : ''}`}
                    onClick={!hasClockedIn || hasClockedOut ? undefined : handleClockOut}
                  >
                    {clockOutBtn.text}
                  </Button>
                  {clockOutHint && (
                    <div className={`punch-hint ${clockOutAllowed === false ? 'is-muted' : ''}`}>
                      {clockOutHint}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ─── 快捷自助功能（平面行样式，主题统一主蓝） ─── */}
            <div className="mt-6 pt-5 border-t border-border-2">
              <div className="flex items-center gap-2 mb-4">
                <span className="w-1.5 h-4 bg-brand rounded-full" />
                <h2 className="text-sm font-semibold text-text-1">快捷自助功能</h2>
              </div>
              <div className="flex flex-col gap-2">
                {[
                  { icon: <IconCalendar />, label: '打卡月报', path: '/attendance/monthly' },
                  { icon: <IconFile />, label: '在线请假', path: '/attendance/vacation/leave' },
                  { icon: <IconThunderbolt />, label: '加班申请', path: '/attendance/vacation/overtime' },
                  { icon: <IconDashboard />, label: '数据统计', path: '/attendance/daily' },
                ].map((item) => (
                  <Link
                    key={item.label}
                    href={item.path}
                    prefetch
                    className="punch-quick-item"
                  >
                    <span className="punch-quick-ic">{item.icon}</span>
                    <span className="flex-1 text-sm text-text-1 font-medium">{item.label}</span>
                    <span className="punch-quick-arrow text-text-4">
                      <IconRight style={{ fontSize: 14 }} />
                    </span>
                  </Link>
                ))}
              </div>
            </div>
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
              <IconFile style={{ fontSize: 20, marginBottom: 6 }} />
              <div>暂无可用的班次</div>
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
                    className={`w-full text-left px-3 py-3 rounded-md border-l-[3px] transition-colors duration-200 flex items-center gap-3 ${
                      active
                        ? 'border-l-brand border-t border-b border-r border-brand-200 bg-brand-light'
                        : 'border-l-transparent border border-border-1 bg-surface hover:bg-bg-secondary'
                    }`}
                  >
                    <span
                      className="w-2 h-2 rounded-full shrink-0 mt-1"
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
                      className={`w-5 h-5 shrink-0 rounded-full grid place-items-center leading-none ${
                        active ? 'bg-brand text-white' : 'bg-bg-hover text-transparent'
                      }`}
                    >
                      <IconCheckCircleFill style={{ fontSize: 14 }} />
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
              确认设置
            </Button>
          </div>
        </div>
      </Modal>
    </PageContainer>
  );
}
