'use client';

import { useState, useEffect } from 'react';
import {
  Message,
  Card,
  Button,
  Space,
  Spin,
  Form,
  InputNumber,
  Grid,
} from '@arco-design/web-react';
import PageContainer from '@/components/PageContainer';
import { attendanceApi, AttendanceSettings } from '@/services/attendance';
import { usePermission } from '@/hooks/use-permission';
import { useCachedData } from '@/hooks/use-cached-data';

const FormItem = Form.Item;
const { Row, Col } = Grid;

interface SettingsEnvelope {
  code: number;
  message?: string;
  data?: AttendanceSettings;
}

// 默认值：在接口返回前作为占位，避免 InputNumber 出现 undefined
// 仅含后端实际被业务消费的 5 项（打卡判定 + 补卡限制），其余预留项已清理
const DEFAULT_SETTINGS: AttendanceSettings = {
  lateThreshold: 30,
  earlyThreshold: 30,
  earlyClockInMinutes: 60,
  makeupDaysLimit: 30,
  makeupMonthlyLimit: 3,
};

interface NumberFieldOptions {
  min?: number;
  max?: number;
  step?: number;
  precision?: number;
}

export default function AttendanceSettingsPage() {
  const { can } = usePermission();
  const canManage = can('attendance:manage');

  const [saving, setSaving] = useState(false);
  const [values, setValues] = useState<AttendanceSettings>(DEFAULT_SETTINGS);

  // SWR 共享缓存。关闭聚焦重取：本页是可编辑表单，重取会覆盖用户未保存的改动。
  const { data: res, loading, error, revalidate } = useCachedData<SettingsEnvelope>(
    'attendance:settings',
    () => attendanceApi.getSettings(),
    { staleTime: 30_000, revalidateOnFocus: false },
  );
  // 业务错误/请求失败都不是空数据：必须显式报错，绝不能落到 DEFAULT_SETTINGS
  // 表单上 —— 否则用户一保存就把默认值写回真实配置。
  const errorText = error ?? (res && res.code !== 0 ? res.message || '加载考勤设置失败' : null);

  // 拉取成功后同步进可编辑副本
  useEffect(() => {
    if (res?.code === 0 && res.data) setValues(res.data);
  }, [res]);

  const setNumber = (key: keyof AttendanceSettings, value: number | undefined) => {
    setValues((prev) => ({ ...prev, [key]: value ?? 0 }) as AttendanceSettings);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await attendanceApi.updateSettings(values);
      if (res.code === 0) {
        Message.success('保存成功');
        // 重新拉取以刷新共享缓存，避免其他页面/切页后读到旧配置
        await revalidate();
      } else {
        Message.error(res.message || '保存失败');
      }
    } catch (e) {
      Message.error('保存失败');
    } finally {
      setSaving(false);
    }
  };

  const disabled = !canManage || saving;

  // 数值字段渲染（横向网格，避免竖向堆叠）
  const numberField = (
    key: keyof AttendanceSettings,
    label: string,
    extra: string,
    options: NumberFieldOptions = {},
  ) => (
    <FormItem label={label} extra={extra}>
      <InputNumber
        value={values[key] as number}
        min={options.min ?? 0}
        max={options.max}
        step={options.step ?? 1}
        precision={options.precision}
        disabled={disabled}
        onChange={(v) => setNumber(key, v)}
        style={{ width: '100%' }}
      />
    </FormItem>
  );

  return (
      <PageContainer extra={
          <Button type="primary" loading={saving} disabled={!canManage || loading || !!errorText} onClick={handleSave}>
            保存设置
          </Button>
        }
      >
        {loading ? (
          <div style={{ textAlign: 'center', padding: 48 }}>
            <Spin />
          </div>
        ) : errorText ? (
          <Card>
            <Space direction="vertical" size={12}>
              <span className="lx-settings-card-desc">{errorText}</span>
              <Button onClick={() => revalidate()}>重试</Button>
            </Space>
          </Card>
        ) : (
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            {/* 打卡规则 */}
            <Card title="打卡规则">
              <p className="lx-settings-card-desc">
                迟到 / 早退判定与提前打卡窗口，作用于每日打卡与签退。
              </p>
              <Form layout="vertical">
                <Row gutter={24}>
                  <Col span={8}>
                    {numberField('lateThreshold', '迟到阈值（分钟）', '超过该分钟数视为迟到', {
                      min: 0,
                      max: 120,
                      step: 1,
                      precision: 0,
                    })}
                  </Col>
                  <Col span={8}>
                    {numberField('earlyThreshold', '早退阈值（分钟）', '提前下班超过该分钟数视为早退', {
                      min: 0,
                      max: 120,
                      step: 1,
                      precision: 0,
                    })}
                  </Col>
                  <Col span={8}>
                    {numberField('earlyClockInMinutes', '提前打卡分钟数（分钟）', '允许在上班时间前多少分钟打卡', {
                      min: 0,
                      max: 240,
                      step: 5,
                      precision: 0,
                    })}
                  </Col>
                </Row>
              </Form>
            </Card>

            {/* 补卡规则 */}
            <Card title="补卡规则">
              <p className="lx-settings-card-desc">
                员工补漏打卡的日期范围与每月次数上限。
              </p>
              <Form layout="vertical">
                <Row gutter={24}>
                  <Col span={8}>
                    {numberField('makeupDaysLimit', '补卡截止天数（天）', '允许补卡自打卡日起的天数上限', {
                      min: 1,
                      max: 90,
                      step: 1,
                      precision: 0,
                    })}
                  </Col>
                  <Col span={8}>
                    {numberField('makeupMonthlyLimit', '每月补卡次数上限（次）', '单月可发起的补卡次数上限', {
                      min: 1,
                      max: 30,
                      step: 1,
                      precision: 0,
                    })}
                  </Col>
                </Row>
              </Form>
            </Card>
          </Space>
        )}
      </PageContainer>
  );
}
