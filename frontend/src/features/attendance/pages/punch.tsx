'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Card, Button, Empty, Tag, Message, Typography, Modal, Select,
} from '@arco-design/web-react';
import PageContainer from '@/components/PageContainer';
import DataState from '@/components/DataState';
import { attendanceApi, type PunchResult } from '@/services/attendance';
import { usePermission } from '@/hooks/use-permission';
import useFetchState from '@/hooks/use-fetch-state';

const { Title, Text } = Typography;
const Option = Select.Option;

function formatTime(iso?: string): string {
  if (!iso) return '--:--';
  try {
    const d = new Date(iso);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
  } catch {
    return iso;
  }
}

function formatDate(d: Date): string {
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

function getWeekday(d: Date): string {
  const names = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
  return names[d.getDay()];
}

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  normal: { label: '正常', color: 'green' },
  late: { label: '迟到', color: 'orange' },
  early: { label: '早退', color: 'gold' },
  late_early: { label: '迟到+早退', color: 'red' },
  absent: { label: '缺勤', color: 'red' },
};

interface Shift {
  id: number;
  name: string;
  startTime: string;
  endTime: string;
  isNextDay?: boolean;
  color?: string;
}

interface TodayPunchData {
  id: number;
  firstPunch?: string;
  lastPunch?: string;
  punchCount: number;
  lateMinutes: number;
  earlyMinutes: number;
  status: string;
  shift?: { id: number; name: string; startTime: string; endTime: string; isNextDay: boolean; color?: string };
}

export default function PunchPage() {
  const { can } = usePermission();
  const { data: todayData, loading, error, run: runFetch, setData: setTodayData } = useFetchState<TodayPunchData>();
  const [punching, setPunching] = useState(false);

  const [serverTime, setServerTime] = useState(new Date());
  const [scheduleModalVisible, setScheduleModalVisible] = useState(false);
  const [availableShifts, setAvailableShifts] = useState<Shift[]>([]);
  const [selectedShiftId, setSelectedShiftId] = useState<number | undefined>();
  const [scheduling, setScheduling] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setServerTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const fetchToday = useCallback(async () => {
    await runFetch(async () => {
      const res = await attendanceApi.getTodayPunch();
      if (res.code === 0) {
        return res.data ?? null;
      }
      throw new Error(res.message || '获取打卡数据失败');
    });
  }, [runFetch]);

  useEffect(() => {
    fetchToday();
  }, [fetchToday]);

  const fetchAvailableShifts = async () => {
    try {
      const res = await attendanceApi.getAvailableShifts();
      if (res.code === 0 && res.data) {
        setAvailableShifts(res.data);
      }
    } catch {
      // ignore
    }
  };

  const handleClockIn = async () => {
    setPunching(true);
    try {
      const res = await attendanceApi.clockIn();
      if (res.code === 0 && res.data) {
        Message.success(`打卡成功（${res.data.status === 'late' ? '迟到' : '正常'}）`);
        fetchToday();
      } else {
        Message.error(res.message || '打卡失败');
      }
    } catch (e: any) {
      const msg = e?.response?.data?.message || '打卡失败';
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
        const statusText = res.data.status === 'early' ? '早退' : res.data.status === 'normal' ? '正常' : '';
        Message.success(`下班打卡成功${statusText ? `（${statusText}）` : ''}`);
        fetchToday();
      } else {
        Message.error(res.message || '打卡失败');
      }
    } catch (e: any) {
      const msg = e?.response?.data?.message || '打卡失败';
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
      const msg = e?.response?.data?.message || '设置失败';
      Message.error(msg);
    } finally {
      setScheduling(false);
    }
  };

  const hasClockedIn = !!todayData?.firstPunch;
  const hasClockedOut = !!todayData?.lastPunch;
  const statusInfo = todayData ? STATUS_MAP[todayData.status] ?? { label: todayData.status, color: 'gray' } : null;
  const shift = todayData?.shift;

  return (
    <PageContainer title="考勤打卡">
      <DataState loading={loading} error={error} onRetry={fetchToday} isEmpty={!todayData}>
        <div className="max-w-[600px] mx-auto">
          <Card className="mb-4 text-center punch-clock-card" bodyStyle={{ paddingTop: 28, paddingBottom: 24 }}>
            <div className="text-sm text-text-3 mb-1">
              {formatDate(serverTime)} {getWeekday(serverTime)}
            </div>
            <div className="text-[52px] font-semibold font-mono my-2 tracking-tight lx-text-gradient">
              {String(serverTime.getHours()).padStart(2, '0')}:
              {String(serverTime.getMinutes()).padStart(2, '0')}:
              {String(serverTime.getSeconds()).padStart(2, '0')}
            </div>
          </Card>

          {shift ? (
            <Card
              title="今日排班"
              style={{ marginBottom: 16, borderTop: `3px solid ${shift.color || '#3B82F6'}` }}
              extra={
                <Button size="small" type="text" onClick={openScheduleModal}>
                  更换班次
                </Button>
              }
            >
              <div className="flex justify-between items-center">
                <div>
                  <Text className="text-base font-medium">{shift.name}</Text>
                  <div className="text-text-2 mt-1">
                    {shift.startTime} - {shift.endTime}{shift.isNextDay ? ' (次日)' : ''}
                  </div>
                </div>
                {statusInfo && (
                  <Tag color={statusInfo.color} className="text-sm">
                    {statusInfo.label}
                  </Tag>
                )}
              </div>
            </Card>
          ) : (
            <Card
              className="mb-4"
              title="今日排班"
              extra={
                <Button size="small" type="primary" onClick={openScheduleModal}>
                  设置排班
                </Button>
              }
            >
              <Empty description="今日未排班" />
              <div className="text-center text-text-3 text-sm mt-2">
                点击右上角"设置排班"选择今日班次，即可开始打卡
              </div>
            </Card>
          )}

          <Card title="打卡记录" className="mb-4">
            <div className="flex justify-around text-center">
              <div>
                <div className="text-text-3 text-sm">上班打卡</div>
                <div className="text-2xl font-medium font-mono my-2">
                  {formatTime(todayData?.firstPunch)}
                </div>
                {todayData?.lateMinutes ? (
                  <Tag color="orange">迟到 {todayData.lateMinutes} 分钟</Tag>
                ) : hasClockedIn ? (
                  <Tag color="green">正常</Tag>
                ) : null}
              </div>
              <div className="w-px bg-border-1 self-stretch" />
              <div>
                <div className="text-text-3 text-sm">下班打卡</div>
                <div className="text-2xl font-medium font-mono my-2">
                  {formatTime(todayData?.lastPunch)}
                </div>
                {todayData?.earlyMinutes ? (
                  <Tag color="gold">早退 {todayData.earlyMinutes} 分钟</Tag>
                ) : hasClockedOut ? (
                  <Tag color="green">正常</Tag>
                ) : null}
              </div>
            </div>
          </Card>

          <Card className="mb-4">
            {!shift && !hasClockedIn && (
              <div style={{ textAlign: 'center', marginBottom: 16, color: '#86909c', fontSize: 13 }}>
                未设置排班将按灵活打卡模式记录，不计算迟到早退
              </div>
            )}
            <div className="flex gap-4 justify-center" style={{ padding: '8px 0 4px' }}>
              <Button
                type="primary"
                size="large"
                className={hasClockedOut ? 'punch-btn' : 'punch-btn primary'}
                loading={punching}
                disabled={hasClockedIn}
                onClick={handleClockIn}
                style={{ minWidth: 168, height: 48, fontSize: 16 }}
              >
                {hasClockedIn ? '已打卡' : '上班打卡'}
              </Button>
              <Button
                type="outline"
                size="large"
                className="punch-btn outline"
                loading={punching}
                disabled={!hasClockedIn || hasClockedOut}
                onClick={handleClockOut}
                style={{ minWidth: 168, height: 48, fontSize: 16 }}
              >
                {hasClockedOut ? '已打卡' : '下班打卡'}
              </Button>
            </div>
            {!hasClockedIn && (
              <div className="text-center mt-3 text-text-3" style={{ fontSize: 12 }}>
                点击打卡即可记录上班时间
              </div>
            )}
          </Card>
        </div>
      </DataState>

      <Modal
        title="设置今日排班"
        visible={scheduleModalVisible}
        onOk={handleSelfSchedule}
        onCancel={() => setScheduleModalVisible(false)}
        confirmLoading={scheduling}
        okText="确认设置"
        cancelText="取消"
      >
        <div style={{ padding: '12px 0' }}>
          <div style={{ marginBottom: 8, color: '#4e5969' }}>选择今日班次：</div>
          <Select
            style={{ width: '100%' }}
            placeholder="请选择班次"
            value={selectedShiftId}
            onChange={(val) => setSelectedShiftId(val as number)}
          >
            {availableShifts.map((s) => (
              <Option key={s.id} value={s.id}>
                {s.name}（{s.startTime} - {s.endTime}）
              </Option>
            ))}
          </Select>
          <div style={{ marginTop: 12, fontSize: 13, color: '#86909c' }}>
            设置后将按照所选班次计算迟到、早退时间
          </div>
        </div>
      </Modal>
    </PageContainer>
  );
}
