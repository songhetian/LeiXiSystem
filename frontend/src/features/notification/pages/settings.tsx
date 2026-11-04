'use client';

import { useEffect, useMemo, useState } from 'react';
import { Tabs, Select, Button, Message, Tooltip } from '@arco-design/web-react';
import PageContainer from '@/components/PageContainer';
import DataState from '@/components/DataState';
import {
  notificationSettingApi,
  NotificationSettingItem,
  TargetRoleOption,
} from '@/services/notification';
import { useCachedData } from '@/hooks/use-cached-data';
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

const SETTINGS_KEY = 'config:notification:settings';
const ROLES_KEY = 'config:notification:target-roles';

export default function NotificationSettingsPage() {
  // 推送配置与可选目标角色均走共享缓存（AGENTS：列表/详情数据一律 useCachedData）
  const {
    data: settingsList,
    loading,
    error,
    revalidate,
  } = useCachedData<NotificationSettingItem[]>(SETTINGS_KEY, async () => {
    const res = await notificationSettingApi.list();
    if (res.code !== 0) throw new Error(res.message || '推送配置读取失败');
    return res.data ?? [];
  });

  // 目标角色是各事件下拉的唯一数据源：失败时下拉会一个选项都没有，
  // 用户会以为"系统里没有可推送角色"，必须明示失败 + 重试并禁用保存
  const {
    data: roles,
    error: rolesError,
    revalidate: revalidateRoles,
  } = useCachedData<TargetRoleOption[]>(ROLES_KEY, async () => {
    const res = await notificationSettingApi.listRoles();
    if (res.code !== 0 || !res.data) throw new Error(res.message || '目标角色读取失败');
    return res.data;
  });

  // 本地草稿：接口数据到达后初始化，保存前不污染缓存
  const [draft, setDraft] = useState<Record<string, string[]>>({});
  useEffect(() => {
    if (!settingsList) return;
    const map: Record<string, string[]> = {};
    for (const s of settingsList) map[s.eventType] = s.targetRoles;
    setDraft(map);
  }, [settingsList]);

  const [savingGroup, setSavingGroup] = useState('');

  const roleOptions = useMemo(() => roles ?? [], [roles]);
  const isEmpty = settingsList != null && settingsList.length === 0 && roleOptions.length === 0;

  const handleChange = (eventType: string, value: string[]) => {
    setDraft((prev) => ({ ...prev, [eventType]: value }));
  };

  const saveGroup = async (groupId: string) => {
    const group = GROUPS.find((g) => g.key === groupId);
    if (!group) return;
    const eventTypes = Object.keys(group.items);
    setSavingGroup(groupId);
    try {
      await Promise.all(
        eventTypes.map((type) =>
          notificationSettingApi.setTargetRoles(type, draft[type] ?? []),
        ),
      );
      Message.success(`${group.title} 配置保存成功`);
      void revalidate();
    } catch (e) {
      notifyError(e, `${group.title} 同步失败`);
    } finally {
      setSavingGroup('');
    }
  };

  const tabItems = GROUPS.map((group) => (
    <Tabs.TabPane key={group.key} title={group.title}>
      <div className="pro-section-head">
        <div>
          <div className="pro-section-title">{group.title}</div>
          <div className="pro-section-desc">{group.description}</div>
        </div>
        <Button
          type="primary"
          loading={savingGroup === group.key}
          disabled={!!rolesError}
          onClick={() => saveGroup(group.key)}
        >
          {savingGroup === group.key ? '正在保存...' : '保存配置'}
        </Button>
      </div>

      <div className="lx-notify-setting-grid">
        {Object.entries(group.items).map(([type, label]) => (
          <div key={type} className="lx-notify-setting-item">
            <div className="lx-notify-setting-item-head">
              <span className="lx-notify-setting-item-label">{label}</span>
              <Tooltip content={type}>
                <span className="lx-notify-setting-item-code">{type}</span>
              </Tooltip>
            </div>
            <Select
              mode="multiple"
              placeholder={rolesError ? '目标角色加载失败' : '选择推送目标'}
              value={draft[type] ?? []}
              onChange={(val) => handleChange(type, val as string[])}
              disabled={!!rolesError}
              options={roleOptions.map((r) => ({
                ...r,
                label: (
                  <span className={isPseudoRole(r.label) ? 'lx-notify-setting-pseudo' : undefined}>
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
    </Tabs.TabPane>
  ));

  return (
    <PageContainer>
      <div className="pro-card pro-card--tabs">
        <DataState loading={loading} error={error} onRetry={revalidate} isEmpty={isEmpty} emptyText="暂无推送配置">
          {rolesError && (
            <div
              role="alert"
              className="mb-3 flex items-center justify-between gap-3 rounded-md border border-danger bg-danger-light px-3 py-2 text-sm text-danger"
            >
              <span>推送目标角色加载失败，暂时无法修改配置：{rolesError}</span>
              <Button size="mini" onClick={() => revalidateRoles()}>
                重试
              </Button>
            </div>
          )}
          <Tabs defaultActiveTab="attendance">{tabItems}</Tabs>
        </DataState>
      </div>
    </PageContainer>
  );
}