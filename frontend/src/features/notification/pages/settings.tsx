'use client';

import { useEffect, useMemo, useState } from 'react';
import { Tabs, Select, Button, Message, Spin, Tooltip } from '@arco-design/web-react';
import PageContainer from '@/components/PageContainer';
import {
  notificationSettingApi,
  NotificationSettingItem,
  TargetRoleOption,
} from '@/services/notification';
import { notifyError } from '@/lib/request';

// 业务事件分组（剔除已排除的『学习考试』模块，对照参考 NotificationSettings 的信息层级）
interface EventGroup {
  key: string;
  title: string;
  description: string;
  items: Record<string, string>;
}

const GROUPS: EventGroup[] = [
  {
    key: 'attendance',
    title: '考勤流转',
    description: '请假、加班、补卡等审批流通知节点',
    items: {
      leave_apply: '请假申请触发',
      leave_approval: '请假审批通过',
      leave_rejection: '请假审批驳回',
      overtime_apply: '加班申请触发',
      overtime_approval: '加班审批通过',
      makeup_apply: '补卡申请触发',
      makeup_approval: '补卡审批通过',
    },
  },
  {
    key: 'finance',
    title: '财务资产',
    description: '监控报销进度、终审结果及资产领用确认',
    items: {
      reimbursement_pass: '报销终审通过',
      reimbursement_reject: '报销申请驳回',
      reimbursement_progress: '报销环节更新',
      asset_apply: '资产领用申请',
    },
  },
  {
    key: 'audit',
    title: '异常告警',
    description: '系统自动捕捉并分发的考勤异常审计提醒',
    items: {
      late_notify: '迟到行为提醒',
      early_leave_notify: '早退行为提醒',
      absent_notify: '缺勤自动告警',
    },
  },
];

// 伪角色推送目标高亮（本人/主管/待办/受众）
function isPseudoRole(label: string): boolean {
  return /本人|主管|待办|受众/.test(label);
}

export default function NotificationSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [roles, setRoles] = useState<TargetRoleOption[]>([]);
  // eventType -> 当前已选目标角色 token 列表
  const [targets, setTargets] = useState<Record<string, string[]>>({});
  const [savingGroup, setSavingGroup] = useState('');

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [settingsRes, rolesRes] = await Promise.all([
          notificationSettingApi.list(),
          notificationSettingApi.listRoles(),
        ]);
        if (!mounted) return;
        const map: Record<string, string[]> = {};
        if (settingsRes.code === 0) {
          for (const s of settingsRes.data ?? []) map[s.eventType] = s.targetRoles;
        }
        setTargets(map);
        if (rolesRes.code === 0 && rolesRes.data) setRoles(rolesRes.data);
      } catch (e) {
        notifyError(e, '推送配置读取失败');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const roleOptions = useMemo(() => roles, [roles]);

  const handleChange = (eventType: string, value: string[]) => {
    setTargets((prev) => ({ ...prev, [eventType]: value }));
  };

  const saveGroup = async (groupId: string) => {
    const group = GROUPS.find((g) => g.key === groupId);
    if (!group) return;
    const eventTypes = Object.keys(group.items);
    setSavingGroup(groupId);
    try {
      await Promise.all(
        eventTypes.map((type) =>
          notificationSettingApi.setTargetRoles(type, targets[type] ?? []),
        ),
      );
      Message.success(`${group.title} 配置保存成功`);
    } catch (e) {
      notifyError(e, `${group.title} 同步失败`);
    } finally {
      setSavingGroup('');
    }
  };

  const tabItems = GROUPS.map((group) => (
    <Tabs.TabPane key={group.key} title={group.title}>
      <div
        style={{
          background: 'var(--lx-bg-card)',
          borderRadius: 8,
          border: '1px solid var(--lx-border-2)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 20px',
            borderBottom: '1px solid var(--lx-border, #e5e6eb)',
          }}
        >
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--lx-text-1)' }}>{group.title}</div>
            <div style={{ fontSize: 12, color: 'var(--lx-text-3)', marginTop: 2 }}>{group.description}</div>
          </div>
          <Button
            type="primary"
            loading={savingGroup === group.key}
            onClick={() => saveGroup(group.key)}
          >
            {savingGroup === group.key ? '正在保存...' : '保存配置'}
          </Button>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
            gap: '18px 40px',
            padding: 20,
          }}
        >
          {Object.entries(group.items).map(([type, label]) => (
            <div key={type} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--lx-text-1)' }}>{label}</span>
                <Tooltip content={type}>
                  <span style={{ fontSize: 11, color: 'var(--lx-text-4)' }}>{type}</span>
                </Tooltip>
              </div>
              <Select
                mode="multiple"
                placeholder="选择推送目标"
                value={targets[type] ?? []}
                onChange={(val) => handleChange(type, val as string[])}
                options={roleOptions.map((r) => ({
                  ...r,
                  label: (
                    <span
                      style={
                        isPseudoRole(r.label) ? { color: 'var(--lx-primary)', fontWeight: 600 } : undefined
                      }
                    >
                      {r.label}
                    </span>
                  ),
                }))}
                allowClear
                maxTagCount={4}
              />
            </div>
          ))}
        </div>
      </div>
    </Tabs.TabPane>
  ));

  return (
    <PageContainer
      breadcrumbs={['系统设置', '通知设置']}
    >
      {loading ? (
        <div
          style={{
            height: 200,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Spin size={32} />
        </div>
      ) : (
        <Tabs defaultActiveTab="attendance">{tabItems}</Tabs>
      )}
    </PageContainer>
  );
}