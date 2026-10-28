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
  // 绑定的流程后来被停用/删除：后端 resolveWorkflowForUser 只认 active，
  // 实际走的仍是通用流程，这里必须如实标出来
  invalid: { label: '绑定已失效', color: 'danger' },
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

  // 可选流程只列「已激活」的；但已绑定却已停用的流程也要出现在选项里，
  // 否则下拉匹配不到选项，会直接显示成裸 ID（用户看不出绑的是哪个流程）
  const activeOptions = (workflows || []).map((w) => ({ label: `${w.name}（${w.module}）`, value: w.id }));
  const unavailableOptions = (list || [])
    .filter(
      (r) =>
        r.workflowId != null &&
        // 状态缺失（老接口/裁剪出参）时不臆断为失效，避免把正常绑定误标成红色
        !!r.workflowStatus &&
        r.workflowStatus !== 'active' &&
        !activeOptions.some((o) => o.value === r.workflowId),
    )
    .map((r) => ({
      label: `${r.workflowName ?? `流程 #${r.workflowId}`}（已停用）`,
      value: r.workflowId as number,
    }));
  const workflowOptions = [...activeOptions, ...unavailableOptions];

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
      render: (_: any, role: RoleWorkflowItem) => {
        if (!role.workflowId) {
          return (
            <Tooltip content="未绑定，该角色用户走通用流程">
              <StatusTag status="general" statusMap={bindStatusMap} />
            </Tooltip>
          );
        }
        // 绑定关系还在，但流程已停用 → 发起审批时后端会跳过它走通用流程
        if (role.workflowStatus && role.workflowStatus !== 'active') {
          return (
            <Tooltip content="绑定的流程已停用或删除，该角色用户实际走通用流程，请重新绑定">
              <StatusTag status="invalid" statusMap={bindStatusMap} />
            </Tooltip>
          );
        }
        return (
          <Tooltip content="已绑定专属流程，该角色用户审批优先走此流程">
            <StatusTag status="bound" statusMap={bindStatusMap} />
          </Tooltip>
        );
      },
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