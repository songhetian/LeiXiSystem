'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Tabs,
  Button,
  Message,
  Switch,
  Tag,
  Empty,
  Alert,
  Select,
  Space,
} from '@arco-design/web-react';
import PageContainer from '@/components/PageContainer';
import DataState from '@/components/DataState';
import {
  notificationSettingApi,
  NotificationSettingItem,
  TargetRoleOption,
} from '@/services/notification';
import { approvalApi, Workflow, WorkflowNode, ApprovalGroup } from '@/services/approval';
import { useCachedData } from '@/hooks/use-cached-data';
import { notifyError } from '@/lib/request';

/**
 * 通知设置 = 审批流程的「节点广播开关」。
 *
 * 设计要点（与旧版「事件 × 多选角色」的区别）：
 *   · 配置主体是流程节点，不是人名/角色名 —— 收件人由流程节点的处理方决定
 *     （角色审批 → 该角色、审批组 → 组成员、部门主管 → 申请人主管、申请人确认 → 本人）；
 *   · 每个节点只有一个开关，不需要也不允许「多选」；
 *   · 终态（通过/驳回）单独一个开关，固定通知申请人；
 *   · 迟到/早退/缺勤/资产领用没有审批流，退回「单接收件方」，仍然是单选。
 */

type GroupKey = 'attendance' | 'finance' | 'audit';

interface FlowCard {
  group: GroupKey;
  workflowCode: string;
  title: string;
  description: string;
  /** 节点到达时对应的事件类型（apply） */
  applyEvent: string;
  /** 终态事件；没有登记驳回事件时 rejected 缺省 */
  approvedEvent?: string;
  rejectedEvent?: string;
}

const FLOW_CARDS: FlowCard[] = [
  {
    group: 'attendance',
    workflowCode: 'leave',
    title: '请假审批',
    description: '申请提交后，按流程节点逐个通知当前处理人',
    applyEvent: 'leave_apply',
    approvedEvent: 'leave_approval',
    rejectedEvent: 'leave_rejection',
  },
  {
    group: 'attendance',
    workflowCode: 'overtime',
    title: '加班审批',
    description: '加班单流转过程中的节点通知',
    applyEvent: 'overtime_apply',
    approvedEvent: 'overtime_approval',
  },
  {
    group: 'attendance',
    workflowCode: 'punch_makeup',
    title: '补卡审批',
    description: '补卡单流转过程中的节点通知',
    applyEvent: 'makeup_apply',
    approvedEvent: 'makeup_approval',
  },
  {
    group: 'finance',
    workflowCode: 'reimbursement',
    title: '报销审批',
    description: '报销单每进入一个环节就通知对应审批人',
    applyEvent: 'reimbursement_progress',
    approvedEvent: 'reimbursement_pass',
    rejectedEvent: 'reimbursement_reject',
  },
];

interface StandaloneEvent {
  group: GroupKey;
  eventType: string;
  label: string;
  hint: string;
}

/** 无审批流可挂靠的事件：只能选一个收件方，不存在多选语义 */
const STANDALONE_EVENTS: StandaloneEvent[] = [
  {
    group: 'finance',
    eventType: 'asset_apply',
    label: '资产领用申请',
    hint: '没有关联审批流，直接推送给指定收件方',
  },
  {
    group: 'audit',
    eventType: 'late_notify',
    label: '迟到行为提醒',
    hint: '系统自动捕捉迟到后推送',
  },
  {
    group: 'audit',
    eventType: 'early_leave_notify',
    label: '早退行为提醒',
    hint: '系统自动捕捉早退后推送',
  },
  {
    group: 'audit',
    eventType: 'absent_notify',
    label: '缺勤自动告警',
    hint: '当日缺勤汇总后推送',
  },
];

const GROUPS: Array<{ key: GroupKey; title: string; description: string }> = [
  { key: 'attendance', title: '考勤流转', description: '请假、加班、补卡的流程节点通知' },
  { key: 'finance', title: '财务资产', description: '报销流程节点与资产领用提醒' },
  { key: 'audit', title: '异常告警', description: '迟到、早退、缺勤的自动提醒' },
];

const NODE_TYPE_LABEL: Record<string, string> = {
  role: '角色审批',
  group: '审批组',
  user: '指定人员',
  department_manager: '部门主管',
  initiator: '申请人确认',
};

/**
 * 流程里的 start / end 只是路由标记，路由引擎（routing-engine 第 193 行）直接跳过，
 * 永远不会给它们发通知。若渲染成开关，管理員会看到「开始节点到达时通知」这类
 * 无意义配置，而且它们会被算进 allKeys，影响「全开 → 存 null」的判定。
 */
const isNotifiableNode = (node: WorkflowNode): boolean =>
  node.type !== 'start' && node.type !== 'end';

const SETTINGS_KEY = 'config:notification:settings';
const ROLES_KEY = 'config:notification:target-roles';
const WORKFLOWS_KEY = 'config:approval:workflows';
const GROUPS_KEY = 'config:approval:groups';

export default function NotificationSettingsPage() {
  const {
    data: settingsList,
    loading,
    error,
    revalidate,
  } = useCachedData<NotificationSettingItem[]>(SETTINGS_KEY, async () => {
    const res = await notificationSettingApi.list();
    if (res.code !== 0) throw new Error(res.message || '通知策略读取失败');
    return res.data ?? [];
  });

  // 流程节点是这张页面的主数据源：拿不到就退化成「只剩终态开关」，
  // 必须显式告知，否则用户会以为流程没有节点。
  const {
    data: workflows,
    error: workflowsError,
    revalidate: revalidateWorkflows,
  } = useCachedData<Workflow[]>(WORKFLOWS_KEY, async () => {
    const res = await approvalApi.listWorkflows();
    if (res.code !== 0 || !res.data) throw new Error(res.message || '审批流程读取失败');
    return res.data;
  });

  const { data: groups } = useCachedData<ApprovalGroup[]>(GROUPS_KEY, async () => {
    const res = await approvalApi.listGroups({ page: 1, pageSize: 200 });
    if (res.code !== 0 || !res.data) return [];
    return res.data.list ?? [];
  });

  const { data: roles, error: rolesError } = useCachedData<TargetRoleOption[]>(
    ROLES_KEY,
    async () => {
      const res = await notificationSettingApi.listRoles();
      if (res.code !== 0 || !res.data) throw new Error(res.message || '收件方读取失败');
      return res.data;
    },
  );

  // 三个草稿分开存：节点开关、终态开关、非流程收件方。
  // null 表示「未配置 → 按默认（全通知）」，必须在保存时原样写回 null，
  // 这样流程以后新增节点才会自动继承通知。
  const [nodeDraft, setNodeDraft] = useState<Record<string, string[] | null>>({});
  const [resultDraft, setResultDraft] = useState<Record<string, string[] | null>>({});
  const [roleDraft, setRoleDraft] = useState<Record<string, string | undefined>>({});
  const [saving, setSaving] = useState('');

  useEffect(() => {
    if (!settingsList) return;
    const nodes: Record<string, string[] | null> = {};
    const results: Record<string, string[] | null> = {};
    const roleMap: Record<string, string | undefined> = {};
    for (const s of settingsList) {
      nodes[s.eventType] = s.targetNodes;
      results[s.eventType] = s.targetRoles;
      roleMap[s.eventType] = s.targetRoles?.[0];
    }
    setNodeDraft(nodes);
    setResultDraft(results);
    setRoleDraft(roleMap);
  }, [settingsList]);

  const workflowMap = useMemo(() => {
    const map = new Map<string, Workflow>();
    for (const w of workflows ?? []) map.set(w.code, w);
    return map;
  }, [workflows]);

  const groupNameMap = useMemo(() => {
    const map = new Map<number, string>();
    for (const g of groups ?? []) map.set(g.id, g.name);
    return map;
  }, [groups]);

  const roleOptions = useMemo(() => roles ?? [], [roles]);

  /** roleCode → 中文角色名：节点行只展中文，不再把 admin/manager 之类编码摊给用户 */
  const roleNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of roles ?? []) map.set(r.value, r.label);
    return map;
  }, [roles]);
  const isEmpty =
    settingsList != null &&
    settingsList.length === 0 &&
    (workflows ?? []).length === 0 &&
    roleOptions.length === 0;

  const nodeKeysOf = (card: FlowCard): string[] => {
    const wf = workflowMap.get(card.workflowCode);
    return (wf?.nodes ?? []).filter(isNotifiableNode).map((n) => n.nodeKey);
  };

  const isNodeOn = (eventType: string, nodeKey: string, allKeys: string[]): boolean => {
    const draft = nodeDraft[eventType];
    if (draft === null || draft === undefined) return true;
    return draft.includes(nodeKey);
  };

  const toggleNode = (
    eventType: string,
    nodeKey: string,
    allKeys: string[],
    checked: boolean,
  ) => {
    setNodeDraft((prev) => {
      const draft = prev[eventType];
      const current = draft === null || draft === undefined ? allKeys : draft;
      const next = checked
        ? Array.from(new Set([...current, nodeKey]))
        : current.filter((k) => k !== nodeKey);
      return { ...prev, [eventType]: next };
    });
  };

  const isResultOn = (eventType?: string): boolean => {
    if (!eventType) return false;
    const draft = resultDraft[eventType];
    if (draft === null || draft === undefined) return true;
    return draft.includes('applicant');
  };

  const toggleResult = (card: FlowCard, checked: boolean) => {
    const value = checked ? ['applicant'] : [];
    setResultDraft((prev) => {
      const next = { ...prev };
      if (card.approvedEvent) next[card.approvedEvent] = value;
      if (card.rejectedEvent) next[card.rejectedEvent] = value;
      return next;
    });
  };

  const saveFlow = async (card: FlowCard) => {
    const allKeys = nodeKeysOf(card);
    if (allKeys.length === 0) return;

    setSaving(card.workflowCode);
    try {
      const draft = nodeDraft[card.applyEvent];
      const current = draft === null || draft === undefined ? allKeys : draft;
      // 全开等价于「未配置」：写回 null，流程以后新增节点才会自动继承。
      const targetNodes = current.length === allKeys.length ? null : current;
      const resultOn = isResultOn(card.approvedEvent ?? card.rejectedEvent);

      const tasks: Array<Promise<unknown>> = [
        notificationSettingApi.setTargets(card.applyEvent, { targetNodes }),
      ];
      if (card.approvedEvent) {
        tasks.push(
          notificationSettingApi.setTargets(card.approvedEvent, {
            targetRoles: resultOn ? ['applicant'] : [],
          }),
        );
      }
      if (card.rejectedEvent) {
        tasks.push(
          notificationSettingApi.setTargets(card.rejectedEvent, {
            targetRoles: resultOn ? ['applicant'] : [],
          }),
        );
      }
      await Promise.all(tasks);
      Message.success(`${card.title} 通知策略已保存`);
      void revalidate();
    } catch (e) {
      notifyError(e, `${card.title} 保存失败`);
    } finally {
      setSaving('');
    }
  };

  const saveStandalone = async (item: StandaloneEvent) => {
    setSaving(item.eventType);
    try {
      const role = roleDraft[item.eventType];
      await notificationSettingApi.setTargets(item.eventType, {
        targetRoles: role ? [role] : [],
      });
      Message.success(`${item.label} 已保存`);
      void revalidate();
    } catch (e) {
      notifyError(e, `${item.label} 保存失败`);
    } finally {
      setSaving('');
    }
  };

  const resolveNodeTarget = (node: WorkflowNode): string => {
    if (node.type === 'role') {
      if (!node.roleCode) return '未指定角色';
      return `角色：${roleNameMap.get(node.roleCode) ?? node.roleCode}`;
    }
    if (node.type === 'user') return '指定人员';
    if (node.type === 'group') {
      const name = node.approvalGroupId ? groupNameMap.get(node.approvalGroupId) : undefined;
      return name ? `审批组：${name}` : '未指定审批组';
    }
    if (node.type === 'department_manager') return '申请人所属部门主管';
    if (node.type === 'initiator') return '申请人本人';
    return NODE_TYPE_LABEL[node.type] ?? node.type;
  };

  const renderFlowCard = (card: FlowCard) => {
    const wf = workflowMap.get(card.workflowCode);
    const allKeys = nodeKeysOf(card);
    const nodes = (wf?.nodes ?? []).filter(isNotifiableNode);

    return (
      <section key={card.workflowCode} className="lx-flow-notify-card">
        <header className="lx-flow-notify-head">
          <div className="lx-flow-notify-head-main">
            <div className="lx-flow-notify-title">
              {card.title}
              {wf && (
                <Tag size="small" color={wf.status === 'active' ? 'green' : 'gray'}>
                  {wf.status === 'active' ? '已启用' : wf.status === 'draft' ? '草稿' : '已停用'}
                </Tag>
              )}
            </div>
            <div className="lx-flow-notify-desc">{card.description}</div>
          </div>
          <Space>
            <a className="lx-flow-notify-link" href="/approval/settings">
              去流程设置
            </a>
            <Button
              type="primary"
              size="small"
              loading={saving === card.workflowCode}
              disabled={nodes.length === 0 || !!workflowsError}
              onClick={() => saveFlow(card)}
            >
              保存
            </Button>
          </Space>
        </header>

        {nodes.length === 0 ? (
          <Empty
            className="lx-flow-notify-empty"
            description={
              wf ? '该流程尚未配置节点，先在「流程设置」里添加审批节点' : '尚未创建该业务流程'
            }
          />
        ) : (
          <ol className="lx-flow-notify-nodes">
            {nodes.map((node, index) => (
              <li className="lx-flow-notify-node" key={node.nodeKey}>
                <span className="lx-flow-notify-node-index">{index + 1}</span>
                <div className="lx-flow-notify-node-main">
                  <div className="lx-flow-notify-node-name">{node.name}</div>
                  <div className="lx-flow-notify-node-role">
                    <span className="lx-flow-notify-node-type">
                      {NODE_TYPE_LABEL[node.type] ?? node.type}
                    </span>
                    {resolveNodeTarget(node)}
                  </div>
                </div>
                <Switch
                  size="small"
                  checked={isNodeOn(card.applyEvent, node.nodeKey, allKeys)}
                  onChange={(checked) =>
                    toggleNode(card.applyEvent, node.nodeKey, allKeys, checked)
                  }
                  aria-label={`${node.name} 到达时通知`}
                />
              </li>
            ))}
          </ol>
        )}

        <div className="lx-flow-notify-node lx-flow-notify-result">
          <span className="lx-flow-notify-node-index">终</span>
          <div className="lx-flow-notify-node-main">
            <div className="lx-flow-notify-node-name">审批结果通知</div>
            <div className="lx-flow-notify-node-role">通过或驳回时通知申请人本人</div>
          </div>
          <Switch
            size="small"
            checked={isResultOn(card.approvedEvent ?? card.rejectedEvent)}
            onChange={(checked) => toggleResult(card, checked)}
            aria-label={`${card.title} 结果通知申请人`}
          />
        </div>
      </section>
    );
  };

  const renderStandalone = (item: StandaloneEvent) => (
    <div className="lx-flow-notify-node lx-standalone-item" key={item.eventType}>
      <div className="lx-flow-notify-node-main">
        <div className="lx-flow-notify-node-name">{item.label}</div>
        <div className="lx-flow-notify-node-role">{item.hint}</div>
      </div>
      <Space>
        <Select
          className="lx-standalone-select"
          aria-label={`${item.label} 收件方`}
          value={roleDraft[item.eventType]}
          onChange={(val) =>
            setRoleDraft((prev) => ({ ...prev, [item.eventType]: val as string | undefined }))
          }
          options={roleOptions}
          placeholder={rolesError ? '收件方加载失败' : '选择收件方'}
          disabled={!!rolesError}
          allowClear
        />
        <Button
          size="small"
          loading={saving === item.eventType}
          disabled={!!rolesError}
          onClick={() => saveStandalone(item)}
        >
          保存
        </Button>
      </Space>
    </div>
  );

  const tabItems = GROUPS.map((group) => (
    <Tabs.TabPane key={group.key} title={group.title}>
      <div className="pro-section-head">
        <div>
          <div className="pro-section-title">{group.title}</div>
          <div className="pro-section-desc">{group.description}</div>
        </div>
      </div>

      {workflowsError && group.key !== 'audit' && (
        <Alert
          type="warning"
          className="mb-3"
          content={`审批流程读取失败，节点开关暂不可用：${workflowsError}`}
          action={
            <Button size="mini" onClick={() => void revalidateWorkflows()}>
              重试
            </Button>
          }
        />
      )}

      <div className="lx-flow-notify-list">
        {FLOW_CARDS.filter((c) => c.group === group.key).map(renderFlowCard)}
        {STANDALONE_EVENTS.filter((e) => e.group === group.key).map(renderStandalone)}
      </div>
    </Tabs.TabPane>
  ));

  return (
    <PageContainer>
      <div className="pro-card pro-card--tabs">
        <DataState
          loading={loading}
          error={error}
          onRetry={revalidate}
          isEmpty={isEmpty}
          emptyText="暂无通知策略"
        >
          <Tabs defaultActiveTab="attendance">{tabItems}</Tabs>
        </DataState>
      </div>
    </PageContainer>
  );
}
