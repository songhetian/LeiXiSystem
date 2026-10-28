'use client';

import { useState } from 'react';
import { Message, Select, Tag, Tooltip, Button } from '@arco-design/web-react';
import PageContainer from '@/components/PageContainer';
import ProTable, { ProTableColumn } from '@/components/ProTable';
import StatusTag from '@/components/StatusTag';
import { approvalApi, RoleWorkflowItem, Workflow } from '@/services/approval';
import { usePermission } from '@/hooks/use-permission';
import { useCachedData } from '@/hooks/use-cached-data';
import { notifyError } from '@/lib/request';

const ROLE_WORKFLOW_KEY = 'config:approval:role-workflows';
const WORKFLOW_KEY = 'config:approval:workflows-bind';

// 绑定状态（StatusTag 色值规范：green→success，未绑定用 default）
const bindStatusMap: Record<string, { label: string; color: string }> = {
  bound: { label: '已绑定', color: 'success' },
  general: { label: '通用流程', color: 'default' },
};

// 职责授权：为每个角色绑定一个已激活的审批流程。绑定后该角色用户在发起审批时
// 优先走所绑定的流程（RoleWorkflowConfig / role_workflows），未绑定角色走通用流程。
export default function RoleWorkflowPage() {
  const { can } = usePermission();
  const managePerm = can('approval:workflow:manage');

  const { data: list, loading, error, revalidate: revalidateList } = useCachedData<RoleWorkflowItem[]>(
    ROLE_WORKFLOW_KEY,
    () =>
      approvalApi.listRoleWorkflows().then((res) => {
        if (res.code === 0 && res.data) {
          return res.data;
        }
        throw new Error(res.message || '获取角色授权列表失败');
      }),
  );

  // 可选流程列表是绑定下拉的数据源：失败时不能静默留空，
  // 否则下拉里「一个流程都没有」，用户会以为系统里没有已激活流程。
  const { data: workflows, error: workflowsError, revalidate: revalidateWorkflows } = useCachedData<Workflow[]>(
    WORKFLOW_KEY,
    () =>
      approvalApi.listWorkflows().then((res) => {
        if (res.code === 0 && res.data) {
          return res.data.filter((w) => w.status === 'active');
        }
        throw new Error(res.message || '获取审批流程列表失败');
      }),
  );

  const handleChange = async (roleId: number, workflowId: number | undefined, roleName: string) => {
    try {
      const res = await approvalApi.setRoleWorkflow(roleId, workflowId ?? null);
      if (res.code === 0) {
        Message.success(workflowId ? `已为「${roleName}」绑定流程` : `「${roleName}」已恢复为通用流程`);
        await revalidateList();
      } else {
        // 受控 Select 值未变，失败时自动回显原值
        Message.error(res.message || '绑定失败');
      }
    } catch (e) {
      notifyError(e, '绑定失败');
    }
  };

  const workflowOptions = (workflows || []).map((w) => ({ label: `${w.name}（${w.module}）`, value: w.id }));

  const columns: ProTableColumn[] = [
    { title: '角色', dataIndex: 'name', width: 160, render: (v: string) => <span className="font-medium text-text-1">{v}</span> },
    { title: '编码', dataIndex: 'code', width: 140, render: (v: string) => <Tag color="arcoblue">{v}</Tag> },
    { title: '说明', dataIndex: 'description', ellipsis: true, render: (v: string) => <span className="text-text-3">{v || '-'}</span> },
    {
      title: '绑定的审批流程',
      dataIndex: 'workflowId',
      width: 280,
      render: (_: any, role: RoleWorkflowItem) =>
        managePerm ? (
          <Select
            placeholder={workflowsError ? '流程列表加载失败' : '默认（通用流程）'}
            allowClear
            showSearch
            style={{ width: '100%' }}
            options={workflowOptions}
            disabled={!!workflowsError}
            value={role.workflowId ?? undefined}
            onChange={(v) => handleChange(role.id, v as number | undefined, role.name)}
            filterOption={(input, option) =>
              (String(option.props?.children ?? '')).toLowerCase().includes(input.toLowerCase())
            }
          />
        ) : role.workflowName ? (
          <span>{role.workflowName}</span>
        ) : (
          <span className="text-text-3">默认（通用流程）</span>
        ),
    },
    {
      title: '当前状态',
      dataIndex: 'workflowIdState',
      width: 130,
      render: (_: any, role: RoleWorkflowItem) =>
        role.workflowId ? (
          <Tooltip content="已绑定专属流程，该角色用户审批优先走此流程">
            <StatusTag status="bound" statusMap={bindStatusMap} />
          </Tooltip>
        ) : (
          <Tooltip content="未绑定，该角色用户走通用流程">
            <StatusTag status="general" statusMap={bindStatusMap} />
          </Tooltip>
        ),
    },
  ];

  return (
    <PageContainer
      action={<span className="text-text-3 text-sm">未绑定角色的用户发起审批时走所选模块的通用流程</span>}
    >
      {managePerm && workflowsError && (
        <div
          role="alert"
          className="mb-3 flex items-center justify-between gap-3 rounded-md border border-danger bg-danger-light px-3 py-2 text-sm text-danger"
        >
          <span>审批流程列表加载失败，暂时无法绑定：{workflowsError}</span>
          <Button size="mini" onClick={() => revalidateWorkflows()}>
            重试
          </Button>
        </div>
      )}
      <ProTable
        columns={columns}
        data={list || []}
        rowKey="id"
        loading={loading}
        error={error}
        onRetry={revalidateList}
        pagination={false}
      />
    </PageContainer>
  );
}