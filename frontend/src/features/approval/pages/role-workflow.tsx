'use client';

import { useState, useEffect } from 'react';
import { Message, Select, Tag, Tooltip, Space } from '@arco-design/web-react';
import PageContainer from '@/components/PageContainer';
import DataState from '@/components/DataState';
import { approvalApi, RoleWorkflowItem, Workflow } from '@/services/approval';
import { usePermission } from '@/hooks/use-permission';
import useFetchState from '@/hooks/use-fetch-state';
import { notifyError } from '@/lib/request';

// 职责授权：为每个角色绑定一个已激活的审批流程。绑定后该角色用户在发起审批时
// 优先走所绑定的流程（RoleWorkflowConfig / role_workflows），未绑定角色走通用流程。
export default function RoleWorkflowPage() {
  const { can } = usePermission();
  const managePerm = can('approval:workflow:manage');
  const { data: list, loading, error, run: runFetch } = useFetchState<RoleWorkflowItem[]>([]);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);

  const fetchData = async () => {
    await runFetch(async () => {
      const res = await approvalApi.listRoleWorkflows();
      if (res.code === 0 && res.data) {
        return res.data;
      }
      throw new Error(res.message || '获取角色授权列表失败');
    });
  };

  const fetchWorkflows = async () => {
    try {
      const res = await approvalApi.listWorkflows();
      if (res.code === 0 && res.data) {
        setWorkflows(res.data.filter((w) => w.status === 'active'));
      }
    } catch (e) {
      notifyError(e, '获取审批流程列表失败');
    }
  };

  useEffect(() => {
    fetchData();
    fetchWorkflows();
  }, []);

  const handleChange = async (roleId: number, workflowId: number | undefined, roleName: string) => {
    try {
      const res = await approvalApi.setRoleWorkflow(roleId, workflowId ?? null);
      if (res.code === 0) {
        Message.success(workflowId ? `已为「${roleName}」绑定流程` : `「${roleName}」已恢复为通用流程`);
        const next = (list || []).map((r) =>
          r.id === roleId
            ? {
                ...r,
                workflowId: workflowId ?? null,
                workflowName: workflowId
                  ? workflows.find((w) => w.id === workflowId)?.name ?? null
                  : null,
              }
            : r,
        );
        runFetch(() => Promise.resolve(next));
      } else {
        // 受控 Select 值未变，失败时自动回显原值
        Message.error(res.message || '绑定失败');
      }
    } catch (e) {
      notifyError(e, '绑定失败');
    }
  };

  const workflowOptions = workflows.map((w) => ({ label: `${w.name}（${w.module}）`, value: w.id }));

  return (
    <PageContainer title="职责授权" subTitle="按角色绑定审批流程，绑定后该角色用户的审批优先走此流程">
      <div className="bg-bg-secondary rounded-md p-4 border border-border-2">
        <div className="mb-4 flex justify-between items-center">
          <span className="font-medium text-text-1">角色流程绑定</span>
          <span className="text-text-3 text-sm">
            未绑定角色的用户发起审批时走所选模块的通用流程
          </span>
        </div>
        <DataState loading={loading} error={error} onRetry={fetchData} isEmpty={!list || list.length === 0}>
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-border-2">
                <th className="text-left py-2.5 px-3">角色</th>
                <th className="text-left py-2.5 px-3">编码</th>
                <th className="text-left py-2.5 px-3">说明</th>
                <th className="text-left py-2.5 px-3 w-72">绑定的审批流程</th>
                <th className="text-left py-2.5 px-3">当前状态</th>
              </tr>
            </thead>
            <tbody>
              {(list || []).map((role) => (
                <tr key={role.id} className="border-b border-border-2">
                  <td className="py-2.5 px-3 font-medium text-text-1">{role.name}</td>
                  <td className="py-2.5 px-3">
                    <Tag color="arcoblue">{role.code}</Tag>
                  </td>
                  <td className="py-2.5 px-3 text-text-3">{role.description || '-'}</td>
                  <td className="py-2.5 px-3">
                    {managePerm ? (
                      <Select
                        placeholder="默认（通用流程）"
                        allowClear
                        showSearch
                        style={{ width: '100%' }}
                        options={workflowOptions}
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
                    )}
                  </td>
                  <td className="py-2.5 px-3">
                    {role.workflowId ? (
                      <Tooltip content="已绑定专属流程，该角色用户审批优先走此流程">
                        <Tag color="green">已绑定</Tag>
                      </Tooltip>
                    ) : (
                      <Tooltip content="未绑定，该角色用户走通用流程">
                        <Tag>通用流程</Tag>
                      </Tooltip>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </DataState>
      </div>
    </PageContainer>
  );
}