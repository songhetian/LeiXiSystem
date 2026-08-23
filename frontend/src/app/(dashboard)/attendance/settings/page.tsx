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
  Switch,
  Grid,
} from '@arco-design/web-react';
import PageContainer from '@/components/PageContainer';
import { attendanceApi, AttendanceSettings } from '@/services/attendance';
import { usePermission } from '@/hooks/use-permission';

const FormItem = Form.Item;
const { Row, Col } = Grid;

// 默认值：在接口返回前作为占位，避免 InputNumber/Switch 出现 undefined
const DEFAULT_SETTINGS: AttendanceSettings = {
  lateThreshold: 5,
  earlyThreshold: 5,
  earlyClockInMinutes: 60,
  lateClockOutMinutes: 60,
  absentHours: 4,
  maxAnnualLeaveDays: 15,
  maxSickLeaveDays: 30,
  requireProofForSickLeave: false,
  requireApprovalForOvertime: true,
  minOvertimeHours: 0.5,
  maxOvertimeHoursPerDay: 4,
  allowMakeup: true,
  makeupDeadlineDays: 7,
  requireApprovalForMakeup: false,
  notifyOnLate: true,
  notifyOnEarlyLeave: true,
  notifyOnAbsent: true,
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

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [values, setValues] = useState<AttendanceSettings>(DEFAULT_SETTINGS);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const res = await attendanceApi.getSettings();
      if (res.code === 0 && res.data) {
        setValues(res.data);
      } else {
        Message.error(res.message || '加载考勤设置失败');
      }
    } catch (e) {
      Message.error('加载考勤设置失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const setNumber = (key: keyof AttendanceSettings, value: number | undefined) => {
    setValues((prev) => ({ ...prev, [key]: value ?? 0 }) as AttendanceSettings);
  };

  const setBoolean = (key: keyof AttendanceSettings, value: boolean) => {
    setValues((prev) => ({ ...prev, [key]: value }) as AttendanceSettings);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await attendanceApi.updateSettings(values);
      if (res.code === 0) {
        Message.success('保存成功');
        if (res.data) {
          setValues(res.data);
        }
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

  // 数值字段渲染
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

  // 开关字段渲染
  const switchField = (key: keyof AttendanceSettings, label: string, extra: string) => (
    <FormItem label={label} extra={extra}>
      <Switch checked={values[key] as boolean} disabled={disabled} onChange={(v) => setBoolean(key, v)} />
    </FormItem>
  );

  return (
      <PageContainer
        title="考勤设置"
        extra={
          <Button type="primary" loading={saving} disabled={!canManage || loading} onClick={handleSave}>
            保存设置
          </Button>
        }
      >
        {loading ? (
          <div style={{ textAlign: 'center', padding: 48 }}>
            <Spin />
          </div>
        ) : (
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            {/* 打卡规则 */}
            <Card title="打卡规则">
              <Form layout="vertical">
                <Row gutter={24}>
                  <Col span={12}>
                    {numberField('lateThreshold', '迟到阈值（分钟）', '超过该分钟数视为迟到', {
                      min: 0,
                      max: 120,
                      step: 1,
                      precision: 0,
                    })}
                  </Col>
                  <Col span={12}>
                    {numberField('earlyThreshold', '早退阈值（分钟）', '提前下班超过该分钟数视为早退', {
                      min: 0,
                      max: 120,
                      step: 1,
                      precision: 0,
                    })}
                  </Col>
                  <Col span={12}>
                    {numberField('earlyClockInMinutes', '提前打卡分钟数（分钟）', '允许在上班时间前多少分钟打卡', {
                      min: 0,
                      max: 240,
                      step: 5,
                      precision: 0,
                    })}
                  </Col>
                  <Col span={12}>
                    {numberField('lateClockOutMinutes', '延迟打卡分钟数（分钟）', '允许在下班时间后多少分钟打卡', {
                      min: 0,
                      max: 240,
                      step: 5,
                      precision: 0,
                    })}
                  </Col>
                  <Col span={12}>
                    {numberField('absentHours', '缺勤小时数（小时）', '单日工时不足该值视为缺勤', {
                      min: 0,
                      max: 24,
                      step: 0.5,
                      precision: 1,
                    })}
                  </Col>
                </Row>
              </Form>
            </Card>

            {/* 休假规则 */}
            <Card title="休假规则">
              <Form layout="vertical">
                <Row gutter={24}>
                  <Col span={12}>
                    {numberField('maxAnnualLeaveDays', '最大年假天数（天）', '员工每年可申请的年假上限', {
                      min: 0,
                      max: 365,
                      step: 0.5,
                      precision: 1,
                    })}
                  </Col>
                  <Col span={12}>
                    {numberField('maxSickLeaveDays', '最大病假天数（天）', '员工每年可申请的病假上限', {
                      min: 0,
                      max: 365,
                      step: 0.5,
                      precision: 1,
                    })}
                  </Col>
                  <Col span={24}>
                    {switchField('requireProofForSickLeave', '病假需要证明', '开启后，申请病假需上传医院证明')}
                  </Col>
                </Row>
              </Form>
            </Card>

            {/* 加班规则 */}
            <Card title="加班规则">
              <Form layout="vertical">
                <Row gutter={24}>
                  <Col span={24}>
                    {switchField('requireApprovalForOvertime', '加班需要审批', '开启后，加班申请需经审批通过才计入')}
                  </Col>
                  <Col span={12}>
                    {numberField('minOvertimeHours', '最小加班小时数（小时）', '单次加班时长低于该值不予记录', {
                      min: 0,
                      max: 24,
                      step: 0.5,
                      precision: 1,
                    })}
                  </Col>
                  <Col span={12}>
                    {numberField('maxOvertimeHoursPerDay', '每日最大加班小时数（小时）', '单日加班时长上限', {
                      min: 0,
                      max: 24,
                      step: 0.5,
                      precision: 1,
                    })}
                  </Col>
                </Row>
              </Form>
            </Card>

            {/* 补卡规则 */}
            <Card title="补卡规则">
              <Form layout="vertical">
                <Row gutter={24}>
                  <Col span={24}>
                    {switchField('allowMakeup', '允许补卡', '开启后，员工可对漏打卡进行补卡')}
                  </Col>
                  <Col span={12}>
                    {numberField('makeupDeadlineDays', '补卡截止天数（天）', '允许补卡的天数上限（自打卡日起）', {
                      min: 0,
                      max: 90,
                      step: 1,
                      precision: 0,
                    })}
                  </Col>
                  <Col span={12}>
                    {switchField('requireApprovalForMakeup', '补卡需要审批', '开启后，补卡申请需经审批通过才生效')}
                  </Col>
                </Row>
              </Form>
            </Card>

            {/* 通知设置 */}
            <Card title="通知设置">
              <Form layout="vertical">
                <Row gutter={24}>
                  <Col span={8}>
                    {switchField('notifyOnLate', '迟到通知', '检测到迟到时推送通知')}
                  </Col>
                  <Col span={8}>
                    {switchField('notifyOnEarlyLeave', '早退通知', '检测到早退时推送通知')}
                  </Col>
                  <Col span={8}>
                    {switchField('notifyOnAbsent', '缺勤通知', '检测到缺勤时推送通知')}
                  </Col>
                </Row>
              </Form>
            </Card>
          </Space>
        )}
      </PageContainer>
  );
}
