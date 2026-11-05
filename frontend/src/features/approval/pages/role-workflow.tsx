'use client';

import { useMemo, useState } from 'react';
import { Message, Select, Tag } from '@arco-design/web-react';
import PageContainer from '@/components/PageContainer';
import ProTable, { ProTableColumn } from '@/components/ProTable';
import StatusTag from '@/components/StatusTag';
import {
  approvalApi,
  RoleBrief,
  WorkflowRoleBinding,
  WorkflowRoleBindingList,
} from '@/services/approval';
import { BUSINESS_MODULE_LABELS } from '@/lib/workflow-codes';
import { usePermission } from '@/hooks/use-permission';
import { useCachedData } from '@/hooks/use-cached-data';
import { notifyError } from '@/lib/request';

const BINDINGS_KEY = 'config:approval:workflow-role-bindings';

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  draft: { label: '草稿', color: 'default' },
  active: { label: '启用', color: 'success' },
  inactive: { label: '停用', color: 'danger' },
};

/**
 * 职责授权：审批流程的适用角色。
 *
 * 方向是 **流程 → 角色**（一条流程适用哪些角色），不是「一个角色绑哪条流程」。
 * 后者受旧主键 (role_id) 限制，一个角色全局只能绑一条流程，请假绑了报销就没得绑，
 * 页面上就只能看到「每种角色只有一个流程」。
 *
 * 同一业务模块下，一个角色只允许出现在一条流程里 —— 否则发起审批时两条都「匹配」，
 * 走哪条取决于查询顺序。冲突由后端拦截并点名冲突的角色与流程。
 */
export default function RoleWorkflowPage() {
  const { can } = usePermission();
  const managePerm = can('approval:workflow:manage');

  const {
    data,
    loading,
    error,
    revalidate,
  } = useCachedData<WorkflowRoleBindingList>(BINDINGS_KEY, async () => {
    const res = await approvalApi.listWorkflowRoleBindings();
    if (res.code === 0 && res.data) return res.data;
    throw new Error(res.message || '获取流程角色配置失败');
  });

  // 保存失败时多选框里仍是用户点选的值（受控组件的内部态已经变了），
  // 用一个递增 token 让**那一行**重挂载，回到服务端的真实绑定；其它行的状态与焦点不动
  const [resetToken, setResetToken] = useState<{ id: number; tick: number } | null>(null);

  const roleOptions = useMemo(
    () =>
      (data?.roles ?? []).map((r) => ({
        label: r.name,
        value: r.id,
        // 搜索口径：姓名 + 编码。Arco 用 options 数组时只透传 value/disabled/extra，
        // 自定义字段会被丢掉，所以搜索串必须放在 extra 里
        extra: `${r.name} ${r.code}`,
      })),
    [data?.roles],
  );

  // 模块按业务顺序排（考勤 → 报销 → 员工事务 → 通用），而不是按英文 module 字母序：
  // 后端只能按内部值排，'reimbursement' 会排到 'employees'/'general' 后面，读起来是乱的
  const workflows = useMemo(() => {
    const order = Object.keys(BUSINESS_MODULE_LABELS);
    const rank = (m: string) => (order.includes(m) ? order.indexOf(m) : order.length);
    return [...(data?.workflows ?? [])].sort(
      (a, b) => rank(a.module) - rank(b.module) || a.id - b.id,
    );
  }, [data?.workflows]);
  const boundCount = workflows.filter((w) => w.roles.length > 0).length;

  const handleChange = async (workflow: WorkflowRoleBinding, roleIds: number[]) => {
    try {
      const res = await approvalApi.setWorkflowRoles(workflow.id, roleIds);
      if (res.code === 0) {
        Message.success(
          roleIds.length > 0
            ? `「${workflow.name}」已适用于 ${roleIds.length} 个角色`
            : `「${workflow.name}」已解除全部角色`,
        );
        await revalidate();
      } else {
        Message.error(res.message || '保存失败');
        setResetToken((prev) => ({ id: workflow.id, tick: (prev?.tick ?? 0) + 1 }));
      }
    } catch (e) {
      notifyError(e, '保存失败');
      setResetToken((prev) => ({ id: workflow.id, tick: (prev?.tick ?? 0) + 1 }));
    }
  };

  const columns: ProTableColumn[] = [
    {
      title: '审批流程',
      dataIndex: 'name',
      width: 240,
      render: (v: string, w: WorkflowRoleBinding) => (
        <div className="flex flex-col">
          <span className="font-medium text-text-1">{v}</span>
          <span className="text-text-3 text-xs">{w.code}</span>
        </div>
      ),
    },
    {
      title: '业务模块',
      dataIndex: 'module',
      width: 120,
      render: (v: string) => <span className="text-text-2">{BUSINESS_MODULE_LABELS[v] || v}</span>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 110,
      render: (v: string) =>
        v === 'active' ? (
          <StatusTag status={v} statusMap={STATUS_MAP} />
        ) : (
          <div className="flex flex-col gap-1">
            <StatusTag status={v} statusMap={STATUS_MAP} />
            {/* 停用流程不参与解析：绑定能存下来但不生效，必须在行内说清楚 */}
            <span className="text-text-3 text-xs">绑定暂不生效</span>
          </div>
        ),
    },
    {
      title: '适用角色',
      dataIndex: 'roles',
      render: (_: RoleBrief[], w: WorkflowRoleBinding) => {
        if (!managePerm) {
          return w.roles.length > 0 ? (
            <span className="flex flex-wrap gap-1">
              {w.roles.map((r) => (
                <Tag key={r.id}>{r.name}</Tag>
              ))}
            </span>
          ) : (
            <span className="text-text-3">未指定</span>
          );
        }
        return (
          <Select
            // 保存失败时只让这一行重挂载 → 回到服务端值，不打断其它行的编辑
            key={`${w.id}-${resetToken?.id === w.id ? resetToken.tick : 0}`}
            mode="multiple"
            allowClear
            showSearch
            placeholder="未指定角色"
            style={{ width: '100%' }}
            options={roleOptions}
            value={w.roles.map((r) => r.id)}
            onChange={(v) => handleChange(w, (v as number[]) ?? [])}
            filterOption={(input, option) => {
              const props = (option as unknown as { props?: Record<string, unknown> })?.props;
              const text = `${String(props?.children ?? '')} ${String(props?.extra ?? '')}`;
              return text.toLowerCase().includes(input.toLowerCase());
            }}
          />
        );
      },
    },
  ];

  return (
    <PageContainer
      action={
        <span className="text-text-3 text-sm">
          {workflows.length} 条流程 · {boundCount} 条已指定角色
        </span>
      }
    >
      <p className="mb-3 text-text-3 text-sm">
        一条流程可适用于多个角色；同一业务下，一个角色只能绑定一条流程。业务已在「流程设置」配好流程时以那里为准，
        这里的绑定用于该业务尚未配置流程时按申请人角色兜底。
      </p>
      <ProTable
        columns={columns}
        data={workflows}
        rowKey="id"
        loading={loading}
        error={error}
        onRetry={revalidate}
        pagination={false}
      />
    </PageContainer>
  );
}
