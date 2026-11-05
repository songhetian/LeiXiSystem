'use client';

import { useState, useCallback, useMemo } from 'react';
import {
  Button,
  Space,
  Modal,
  Form,
  Input,
  Select,
  Message,
  Card,
  Tag,
  Empty,
  Divider,
  Typography,
} from '@arco-design/web-react';
import {
  IconPlus,
  IconArrowUp,
  IconArrowDown,
  IconDelete,
  IconSettings,
  IconEdit,
  IconTag,
  IconUser,
  IconUserGroup,
  IconApps,
  IconIdcard,
} from '@arco-design/web-react/icon';
import PageContainer from '@/components/PageContainer';
import ProTable, { ProTableColumn } from '@/components/ProTable';
import StatusTag from '@/components/StatusTag';
import { ConfirmButton } from '@/components/ConfirmButton';
import { PermissionGate } from '@/components/PermissionGate';
import {
  approvalApi,
  Workflow,
  WorkflowNode,
  ApprovalGroup,
  RoleWorkflowItem,
} from '@/services/approval';
import { notifyError } from '@/lib/request';
import { usePermission } from '@/hooks/use-permission';
import { useCachedData } from '@/hooks/use-cached-data';
import { fetchAllPages } from '@/lib/fetch-all';
import { systemApi, SysUser } from '@/services/system';
import {
  BUSINESS_WORKFLOWS,
  BUSINESS_MODULE_LABELS,
  businessModuleOf,
  businessNameOf,
} from '@/lib/workflow-codes';

const { Option } = Select;
const { Text } = Typography;

// 业务编码选项：流程设置页新建的流程只有使用登记的业务编码，
// 才会被对应业务流（请假/加班/报销/入职…）真正使用（ADR-0020）
const BUSINESS_OPTIONS = BUSINESS_WORKFLOWS.map((w) => ({
  label: `${w.name}（${w.code}）`,
  value: w.code,
}));

/**
 * 审批节点类型。
 *
 * 前三种是「点名到人」的三种粒度（单个用户 / 某个角色 / 某个审批组），
 * 后两种是「按组织关系动态解析」（部门主管、申请人本人）。
 * 下拉里保持这个顺序，与右栏「审批人」小节的说明一致。
 */
const NODE_TYPE_OPTIONS = [
  { label: '指定人员', value: 'user', icon: <IconIdcard />, desc: '由指定的某一位用户审批，不受角色变动影响' },
  { label: '角色审批', value: 'role', icon: <IconTag />, desc: '由所选角色下的所有用户审批' },
  { label: '审批组', value: 'group', icon: <IconApps />, desc: '由所选审批组内的成员审批' },
  { label: '部门主管', value: 'department_manager', icon: <IconUserGroup />, desc: '由申请人所在部门的主管审批' },
  { label: '申请人', value: 'initiator', icon: <IconUser />, desc: '由申请人本人确认' },
];

// 审批组下拉 / 成员姓名的数据源：只读接口，权限与「审批组管理」页一致
const GROUPS_KEY = 'config:approval:groups';
const USERS_KEY = 'config:system:users-approvers';
const ROLES_KEY = 'config:approval:roles';

/**
 * 生效条件字段。
 *
 * 这里的 value 是**各业务提交审批时 formData 的真实键名**（见后端
 * vacation.service「days / hours」、reimbursement.service「totalAmount / type」），
 * 写错键名不会报错、只会让条件永远不命中，因此必须给固定选项而不是让用户手打。
 * 未登记的业务流程才用「其他字段」自行填写。
 */
const CONDITION_FIELDS = [
  { label: '请假天数', value: 'days' },
  { label: '加班小时数', value: 'hours' },
  { label: '报销金额（元）', value: 'totalAmount' },
  { label: '报销类型', value: 'type' },
];
const CUSTOM_FIELD = '__custom__';

const CONDITION_OPERATORS = [
  { label: '大于', value: 'gt' },
  { label: '大于等于', value: 'gte' },
  { label: '小于', value: 'lt' },
  { label: '小于等于', value: 'lte' },
  { label: '等于', value: 'eq' },
  { label: '不等于', value: 'neq' },
];

/** 条件字段是否属于已登记的业务字段（否则是用户手填的「其他字段」） */
function isKnownConditionField(field: string): boolean {
  return CONDITION_FIELDS.some((f) => f.value === field);
}

/**
 * Arco Select 用 `options` 数组渲染时，内部 `extendChildren` 只透传
 * value / disabled / extra，自定义字段全被丢弃；`filterOption(input, option)`
 * 收到的 option 是 React 元素，搜索串只能从 `props.extra` 或 `props.children` 读。
 * 所有「按别名搜索」的下拉统一走这里。
 */
export function filterByExtra(input: string, option: unknown): boolean {
  const props = (option as { props?: { extra?: string; children?: string } })?.props;
  const hay = String(props?.extra ?? props?.children ?? '').toLowerCase();
  return hay.includes(String(input).toLowerCase());
}

/**
 * 节点的「谁审批」是否已配置完整。
 *
 * 只用于展示：未配置时摘要用警示色（角色未选 / 组未选 / 人未选），
 * 与保存前的 validateWorkflowNodes 是两套口径——后者会阻断提交。
 */
export function isApproverConfigured(node: WorkflowNode): boolean {
  if (node.type === 'role') return Boolean(node.roleCode);
  if (node.type === 'group') return Boolean(node.approvalGroupId);
  if (node.type === 'user') return Boolean(node.userId);
  return true;
}

/**
 * 保存前校验节点完整性（纯函数，便于单测）。
 *
 * 后端 resolveNextApprovers 的条件判定是「字段 + 运算符都要有才算条件」，缺一个
 * 就会整条条件被忽略（节点对所有人无条件生效）；而 operator 有值、value 为空时
 * Number('') = 0，会出现「大于 0」恒真的静默错误。这两类必须在前端拦下。
 */
export function validateWorkflowNodes(nodes: WorkflowNode[]): string | null {
  for (let i = 0; i < nodes.length; i += 1) {
    const node = nodes[i];
    const label = `第 ${i + 1} 个节点「${node.name || '未命名'}」`;
    if (!node.name?.trim()) return `${label}未填写名称`;
    if (node.type === 'role' && !node.roleCode) return `${label}未选择审批角色`;
    if (node.type === 'user' && !node.userId) return `${label}未选择审批人`;
    if (node.type === 'group' && !node.approvalGroupId) return `${label}未选择审批组`;

    const hasCondition = Boolean(
      node.conditionField || node.conditionOperator || node.conditionValue,
    );
    if (hasCondition) {
      if (!node.conditionField) return `${label}的生效条件缺少字段`;
      if (!node.conditionOperator) return `${label}的生效条件缺少运算符`;
      if (!String(node.conditionValue ?? '').trim()) return `${label}的生效条件缺少比较值`;
    }
  }
  return null;
}

// 审批流状态（StatusTag 色值规范：gray→default、green→success、red→danger）
const STATUS_MAP: Record<string, { label: string; color: string }> = {
  draft: { label: '草稿', color: 'default' },
  active: { label: '启用', color: 'success' },
  inactive: { label: '停用', color: 'danger' },
};

function getNodeTypeMeta(type: string) {
  return NODE_TYPE_OPTIONS.find((o) => o.value === type) || NODE_TYPE_OPTIONS[0];
}

export default function ApprovalSettingsPage() {
  const { can } = usePermission();
  const fetchList = useCallback(
    () =>
      approvalApi.listWorkflows().then((res) => {
        if (res.code === 0 && res.data) {
          return res.data;
        }
        throw new Error(res.message || '获取审批流程列表失败');
      }),
    [],
  );
  const { data, loading, error, revalidate: revalidateList } = useCachedData<Workflow[]>(
    'config:approval:workflows',
    fetchList,
  );

  // ===== 节点配置所需的参考数据 =====
  // 审批组读接口要 approval:manage，用户列表要 system:user:view，本页本身只要
  // approval:workflow:manage —— 三者不是包含关系，缺权限时若照常发请求，请求层会
  // 直接弹「没有权限执行此操作」，而用户在这个页面上明明是有权限的。
  // 因此按各自权限点决定是否发请求，无权限时退化为空集并给出说明。
  const canReadGroups = can('approval:manage');
  const canReadUsers = can('system:user:view');

  const { data: groups, loading: groupsLoading } = useCachedData<ApprovalGroup[]>(
    canReadGroups ? GROUPS_KEY : `${GROUPS_KEY}:denied`,
    async () => {
      if (!canReadGroups) return [];
      return fetchAllPages<ApprovalGroup>(async (page, pageSize) => {
        const res = await approvalApi.listGroups({ page, pageSize });
        if (res.code !== 0 || !res.data) throw new Error(res.message || '获取审批组失败');
        return { list: res.data.list, total: res.data.total };
      });
    },
  );

  const { data: users } = useCachedData<SysUser[]>(
    canReadUsers ? USERS_KEY : `${USERS_KEY}:denied`,
    async () => {
      if (!canReadUsers) return [];
      return fetchAllPages<SysUser>(async (page, pageSize) => {
        const res = await systemApi.listUsers({ page, pageSize });
        if (res.code !== 0 || !res.data) throw new Error(res.message || '获取用户列表失败');
        return { list: res.data.list, total: res.data.total };
      });
    },
  );

  // 角色下拉复用「职责授权」接口：权限同样是 approval:workflow:manage，必定可读
  const { data: roles } = useCachedData<RoleWorkflowItem[]>(ROLES_KEY, async () => {
    const res = await approvalApi.listRoleWorkflows();
    if (res.code !== 0 || !res.data) throw new Error(res.message || '获取角色列表失败');
    return res.data;
  });

  const userNameById = useMemo(() => {
    const map = new Map<number, string>();
    for (const u of users ?? []) map.set(u.id, u.name || u.username || `用户 ${u.id}`);
    return map;
  }, [users]);

  /** 审批组成员姓名（无用户列表权限时退化为「共 N 人」） */
  const memberNamesOf = useCallback(
    (group: ApprovalGroup) => {
      const ids = (group.members ?? []).map((m) => m.userId);
      const names = ids.map((id) => userNameById.get(id)).filter(Boolean) as string[];
      return { count: ids.length, names };
    },
    [userNameById],
  );

  const roleOptions = useMemo(
    () => (roles ?? []).map((r) => ({ label: r.name, value: r.code })),
    [roles],
  );

  const groupOptions = useMemo(
    () =>
      (groups ?? []).map((g) => {
        const { count, names } = memberNamesOf(g);
        return {
          label: count > 0 ? `${g.name}（${count} 人）` : `${g.name}（暂无成员）`,
          value: g.id,
          // 搜索口径：组名 + 成员姓名，便于「只知道谁审批、不知道组名」时也能选到。
          // 必须放在 extra 里：Arco 用 options 数组渲染时只透传 value/disabled/extra，
          // 其余自定义字段会被丢掉，filterOption 拿到的 option 是 React 元素。
          extra: `${g.name} ${g.code} ${names.join(' ')}`,
        };
      }),
    [groups, memberNamesOf],
  );

  /** userId → 账号，用于把节点上的 userId 还原成「姓名（登录名）」 */
  const userById = useMemo(() => {
    const map = new Map<number, SysUser>();
    for (const u of users ?? []) map.set(u.id, u);
    return map;
  }, [users]);

  /**
   * 指定人员候选。
   *
   * 停用账号不剔除：节点里已经存着它，剔除后下拉显示空、用户以为配置丢了，
   * 反而更容易误存成「未选择审批人」。因此保留并在 label 上标注「已停用」。
   */
  const userOptions = useMemo(
    () =>
      (users ?? []).map((u) => {
        const roleNames = (u.roles ?? []).map((r) => r.name).join(' ');
        return {
          label: `${u.name || u.username}（${u.username}）${u.status === 'active' ? '' : ' · 已停用'}`,
          value: u.id,
          // 搜索口径：姓名 + 登录名 + 角色名，任一项都能定位到人。
          // 必须放在 extra 里：Arco 用 options 数组渲染时只透传 value/disabled/extra，
          // 其余自定义字段会被丢弃，filterOption 收到的是 React 元素。
          extra: `${u.name ?? ''} ${u.username} ${roleNames}`,
        };
      }),
    [users],
  );

  /** 角色 → 在职人数（无用户列表权限时为空 Map，界面不展示人数） */
  const roleUserCount = useMemo(() => {
    const map = new Map<string, number>();
    for (const u of users ?? []) {
      if (u.status !== 'active') continue;
      for (const r of u.roles ?? []) map.set(r.code, (map.get(r.code) ?? 0) + 1);
    }
    return map;
  }, [users]);

  // ===== 审批流列表分页（数据整表返回，前端分页展示） =====
  const [listPage, setListPage] = useState(1);

  // 已被占用的业务编码：seed 会为 13 个登记业务各铺一条流程，若下拉不禁用，
  // 新建时选任何编码都会撞唯一键（6301「审批流编码已存在」），用户只能反复试错。
  const usedCodes = useMemo(
    () => new Set((data ?? []).map((w) => w.code)),
    [data],
  );
  // 列表还没回来（loading/error）时 usedCodes 是空集，此时若允许选择，用户会选中
  // 已占用的编码，提交必撞 6301。所以「编码是否可用」未知时一律禁用下拉。
  const codesReady = !loading && !error && Array.isArray(data);
  const allCodesUsed = codesReady && BUSINESS_OPTIONS.every((m) => usedCodes.has(m.value));

  // ===== 基本信息弹窗 =====
  const [baseModalVisible, setBaseModalVisible] = useState(false);
  const [editingBase, setEditingBase] = useState<Workflow | null>(null);
  const [baseForm] = Form.useForm();
  const [baseSaving, setBaseSaving] = useState(false);

  // ===== 节点配置弹窗 =====
  const [nodeModalVisible, setNodeModalVisible] = useState(false);
  const [currentWorkflow, setCurrentWorkflow] = useState<Workflow | null>(null);
  const [nodes, setNodes] = useState<WorkflowNode[]>([]);
  const [activeNodeKey, setActiveNodeKey] = useState<string | null>(null);
  const [nodeSaving, setNodeSaving] = useState(false);

  // ===== 基本信息操作 =====
  const openCreateBase = () => {
    setEditingBase(null);
    baseForm.resetFields();
    baseForm.setFieldsValue({ status: 'draft' });
    setBaseModalVisible(true);
  };

  const openEditBase = (record: Workflow) => {
    setEditingBase(record);
    baseForm.setFieldsValue({
      code: record.code,
      name: record.name,
      status: record.status,
    });
    setBaseModalVisible(true);
  };

  const handleBaseSubmit = async () => {
    try {
      const values = await baseForm.validate();
      setBaseSaving(true);

      // module 由业务编码推导：同一业务归属固定分组，避免手选模块与编码不一致
      const module = businessModuleOf(values.code) ?? 'general';

      let res;
      if (editingBase) {
        res = await approvalApi.updateWorkflow(editingBase.id, {
          name: values.name,
          module,
          status: values.status,
        });
      } else {
        res = await approvalApi.createWorkflow({
          code: values.code,
          name: values.name,
          module,
          status: values.status,
          nodes: [],
        });
      }

      if (res.code === 0) {
        Message.success(editingBase ? '更新成功' : '创建成功');
        setBaseModalVisible(false);
        revalidateList();
      } else {
        Message.error(res.message || '操作失败');
      }
    } catch (e) {
      notifyError(e, '参数校验失败');
    } finally {
      setBaseSaving(false);
    }
  };

  // ===== 节点配置操作 =====
  const openNodeConfig = async (record: Workflow) => {
    setCurrentWorkflow(record);
    setNodes(record.nodes || []);
    setActiveNodeKey(null);
    setNodeModalVisible(true);
  };

  const addNode = () => {
    const newOrder = nodes.length > 0 ? Math.max(...nodes.map((n) => n.order)) + 1 : 1;
    const newNode: WorkflowNode = {
      nodeKey: `node_${Date.now()}`,
      name: `审批节点 ${newOrder}`,
      type: 'role',
      order: newOrder,
    };
    setNodes([...nodes, newNode]);
    setActiveNodeKey(newNode.nodeKey);
  };

  const updateNode = (nodeKey: string, patch: Partial<WorkflowNode>) => {
    setNodes((prev) =>
      prev.map((n) => (n.nodeKey === nodeKey ? { ...n, ...patch } : n))
    );
  };

  /**
   * 切换审批类型时清掉其它类型的审批人字段。
   *
   * 不清的话库里会同时存在 role_code 与 user_id：节点语义只由 type 决定，
   * 剩下的字段是死数据，排查「为什么这个人能审」时极易看错，
   * 类型来回切换后也容易把旧配置误当成新配置保存。
   */
  const handleTypeChange = (nodeKey: string, type: string) => {
    updateNode(nodeKey, {
      type,
      ...(type !== 'role' ? { roleCode: undefined } : {}),
      ...(type !== 'group' ? { approvalGroupId: undefined } : {}),
      ...(type !== 'user' ? { userId: undefined } : {}),
    });
  };

  const removeNode = (nodeKey: string) => {
    const updated = nodes.filter((n) => n.nodeKey !== nodeKey);
    setNodes(updated.map((n, i) => ({ ...n, order: i + 1 })));
    if (activeNodeKey === nodeKey) {
      setActiveNodeKey(null);
    }
  };

  const moveNode = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === nodes.length - 1) return;
    const updated = [...nodes];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    [updated[index], updated[targetIndex]] = [updated[targetIndex], updated[index]];
    setNodes(updated.map((n, i) => ({ ...n, order: i + 1 })));
  };

  const handleNodeSubmit = async () => {
    if (!currentWorkflow) return;
    const invalid = validateNodes();
    if (invalid) {
      Message.warning(invalid);
      return;
    }
    try {
      setNodeSaving(true);
      const res = await approvalApi.updateWorkflow(currentWorkflow.id, {
        // 排序不能原地 sort：会改掉 state 里的数组，取消弹窗后列表顺序也被改掉
        nodes: [...nodes].sort((a, b) => a.order - b.order),
      });
      if (res.code === 0) {
        Message.success('节点配置保存成功');
        setNodeModalVisible(false);
        revalidateList();
      } else {
        Message.error(res.message || '保存失败');
      }
    } catch (e) {
      notifyError(e, '保存失败');
    } finally {
      setNodeSaving(false);
    }
  };

  const handleDelete = async (record: Workflow) => {
    const res = await approvalApi.deleteWorkflow(record.id);
    if (res.code === 0) {
      Message.success('删除成功');
      revalidateList();
    } else {
      Message.error(res.message || '删除失败');
    }
  };

  const activeNode = nodes.find((n) => n.nodeKey === activeNodeKey) || null;

  // 当前选中的审批组 + 成员姓名：选中即可看到「到底谁会审」，不必再去审批组页核对
  const selectedGroup =
    activeNode?.type === 'group'
      ? (groups ?? []).find((g) => g.id === activeNode.approvalGroupId)
      : undefined;
  const selectedMemberNames = selectedGroup
    ? (selectedGroup.members ?? [])
        .map((m) => userNameById.get(m.userId))
        .filter((n): n is string => Boolean(n))
    : [];

  // 指定人员节点的审批人：把 userId 还原成账号，渲染「人员卡片」
  const selectedUser =
    activeNode?.type === 'user' && activeNode.userId
      ? userById.get(activeNode.userId)
      : undefined;

  /** 节点审批人摘要：左侧列表与流程预览直接显示「谁来审」，避免只看得到节点类型 */
  const approverSummaryOf = useCallback(
    (node: WorkflowNode) => {
      switch (node.type) {
        case 'user': {
          if (!node.userId) return '未选择审批人';
          const user = userById.get(node.userId);
          // 账号被物理删除时仍要能读出来，否则节点摘要只剩「未选择」，容易被误改
          return user ? user.name || user.username : `用户 #${node.userId}`;
        }
        case 'role': {
          const role = (roles ?? []).find((r) => r.code === node.roleCode);
          return role?.name || '未选择角色';
        }
        case 'group': {
          const group = (groups ?? []).find((g) => g.id === node.approvalGroupId);
          if (!group) return '未选择审批组';
          const { count } = memberNamesOf(group);
          return count > 0 ? `${group.name} · ${count} 人` : `${group.name} · 暂无成员`;
        }
        case 'department_manager':
          return '申请人部门主管';
        case 'initiator':
          return '申请人本人';
        default:
          return '未配置';
      }
    },
    [roles, groups, memberNamesOf, userById],
  );

  /**
   * 保存前校验节点完整性，规则见模块级 validateWorkflowNodes
   * （条件字段/运算符/值三项要么全空、要么全填）。
   */
  const validateNodes = (): string | null => validateWorkflowNodes(nodes);

  const columns: ProTableColumn[] = [
    { title: '流程名称', dataIndex: 'name', width: 200 },
    {
      title: '业务编码',
      dataIndex: 'code',
      width: 220,
      render: (v: string) => `${businessNameOf(v)}（${v}）`,
    },
    {
      title: '业务分组',
      dataIndex: 'module',
      width: 120,
      render: (v: string) => BUSINESS_MODULE_LABELS[v] || v,
    },
    {
      title: '节点数',
      dataIndex: 'nodes',
      width: 80,
      render: (v: WorkflowNode[]) => v?.length || 0,
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (v: string) => <StatusTag status={v} statusMap={STATUS_MAP} />,
    },
    {
      title: '操作',
      dataIndex: 'action',
      width: 260,
      render: (_: any, record: Workflow) => (
        <PermissionGate code="approval:workflow:manage">
          <Space size="mini">
            <Button
              size="small"
              type="text"
              icon={<IconEdit />}
              onClick={() => openEditBase(record)}
            >
              编辑信息
            </Button>
            <Button
              size="small"
              type="text"
              icon={<IconSettings />}
              onClick={() => openNodeConfig(record)}
            >
              配置节点
            </Button>
            <ConfirmButton
              size="small"
              type="text"
              status="danger"
              title="确认删除"
              content={`确定要删除审批流程「${record.name}」吗？`}
              onConfirm={() => handleDelete(record)}
            >
              删除
            </ConfirmButton>
          </Space>
        </PermissionGate>
      ),
    },
  ];

  return (
    <PageContainer
    >
      <div className="pro-card">
        <div className="pro-toolbar pro-toolbar-wrap">
          <span className="text-sm font-medium text-text-1">审批流列表</span>
          <PermissionGate code="approval:workflow:manage">
            <Button
              type="primary"
              icon={<IconPlus />}
              onClick={openCreateBase}
            >
              新建审批流程
            </Button>
          </PermissionGate>
        </div>
        <ProTable
          columns={columns}
          data={data || []}
          rowKey="id"
          loading={loading}
          error={error}
          onRetry={revalidateList}
          pagination={{ current: listPage, pageSize: 20, total: (data || []).length }}
          onPageChange={setListPage}
        />
      </div>

      {/* ===== 基本信息弹窗 ===== */}
      <Modal
        title={editingBase ? '编辑基本信息' : '新建审批流程'}
        visible={baseModalVisible}
        onOk={handleBaseSubmit}
        onCancel={() => setBaseModalVisible(false)}
        confirmLoading={baseSaving}
        okText="保存"
        cancelText="取消"
        maskClosable={false}
        style={{ width: 520 }}
      >
        <Form form={baseForm} layout="vertical">
          <Form.Item label="流程名称" field="name" rules={[{ required: true, message: '请输入流程名称' }]}>
            <Input placeholder="请输入流程名称" />
          </Form.Item>
          <Form.Item
            label="业务编码"
            field="code"
            rules={[{ required: true, message: '请选择业务编码' }]}
            extra={
              editingBase
                ? '业务编码创建后不可修改'
                : allCodesUsed
                  ? '全部业务编码均已有流程，请直接在列表中编辑，或先删除不再使用的流程'
                  : !codesReady
                    ? '正在读取已配置的流程，请稍候…'
                    : '选择业务编码后，该流程才会被对应业务流使用；已配置的业务编码不可重复新建，请直接编辑列表中对应的流程'
            }
          >
            {editingBase ? (
              <Input disabled />
            ) : (
              <Select
                showSearch
                placeholder={allCodesUsed ? '全部业务编码均已有流程' : '请选择业务编码'}
                disabled={!codesReady || allCodesUsed}
              >
                {BUSINESS_OPTIONS.map((m) => (
                  <Option key={m.value} value={m.value} disabled={usedCodes.has(m.value)}>
                    {m.label}
                    {usedCodes.has(m.value) ? '（已配置）' : ''}
                  </Option>
                ))}
              </Select>
            )}
          </Form.Item>
          <Form.Item label="状态" field="status">
            <Select>
              <Option value="draft">草稿</Option>
              <Option value="active">启用</Option>
              <Option value="inactive">停用</Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      {/* ===== 节点配置弹窗 ===== */}
      <Modal
        title={
          <Space size="small">
            <IconSettings />
            <span>节点配置 - {currentWorkflow?.name || ''}</span>
            <Tag color="gray">{nodes.length} 个节点</Tag>
          </Space>
        }
        visible={nodeModalVisible}
        onOk={handleNodeSubmit}
        onCancel={() => setNodeModalVisible(false)}
        confirmLoading={nodeSaving}
        okText="保存配置"
        cancelText="取消"
        maskClosable={false}
        style={{ width: 1080, maxWidth: '96vw' }}
      >
        <div className="appr-flow-grid">
          {/* 左侧：节点列表 */}
          <div className="appr-flow-col appr-flow-col--left">
            <div className="appr-flow-col-head">
              <Text bold style={{ fontSize: 13 }}>节点列表</Text>
              <Button
                size="mini"
                type="primary"
                icon={<IconPlus />}
                onClick={addNode}
              />
            </div>
            {nodes.length === 0 ? (
              <Empty description="暂无节点" style={{ marginTop: 40 }} />
            ) : (
              <div className="appr-node-list">
                {nodes.map((node, index) => {
                  const meta = getNodeTypeMeta(node.type);
                  const isActive = activeNodeKey === node.nodeKey;
                  return (
                    <div
                      key={node.nodeKey}
                      className={`appr-node-item${isActive ? ' appr-node-item--active' : ''}`}
                    >
                      {/* 选中该节点用 <button> 承载，保证键盘可达（WCAG SC 2.1.1）；
                          不给整张卡加 role="button"，以免与下方操作按钮形成「可聚焦后代嵌套」 */}
                      <button
                        type="button"
                        className="lx-clickable appr-node-hit"
                        onClick={() => setActiveNodeKey(node.nodeKey)}
                      >
                      <div className="appr-node-row">
                        <span className="appr-node-num">{index + 1}</span>
                        <Text style={{ fontSize: 12, fontWeight: 500 }}>{node.name}</Text>
                      </div>
                      <div className="appr-node-sub">
                        <span className="appr-node-type">{meta.label}</span>
                        <span
                          className={`appr-node-approver${
                            isApproverConfigured(node) ? '' : ' appr-approver--warn'
                          }`}
                        >
                          {approverSummaryOf(node)}
                        </span>
                      </div>
                      </button>
                      <div className="appr-node-actions">
                        <Button
                          size="mini"
                          type="text"
                          icon={<IconArrowUp />}
                          disabled={index === 0}
                          onClick={(e) => {
                            e.stopPropagation();
                            moveNode(index, 'up');
                          }}
                          style={{ padding: '0 4px' }}
                        />
                        <Button
                          size="mini"
                          type="text"
                          icon={<IconArrowDown />}
                          disabled={index === nodes.length - 1}
                          onClick={(e) => {
                            e.stopPropagation();
                            moveNode(index, 'down');
                          }}
                          style={{ padding: '0 4px' }}
                        />
                        <Button
                          size="mini"
                          type="text"
                          status="danger"
                          icon={<IconDelete />}
                          onClick={(e) => {
                            e.stopPropagation();
                            removeNode(node.nodeKey);
                          }}
                          style={{ padding: '0 4px' }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 中间：流程预览 */}
          <div className="appr-flow-col">
            <Text bold className="appr-flow-col-title">流程预览</Text>
            <div className="appr-flow-stage">
              <div className="appr-flow-cap appr-flow-cap--start">开始</div>

              {nodes.length === 0 ? (
                <>
                  <div className="appr-flow-arrow">↓</div>
                  <Empty description="点击左侧 + 添加节点" style={{ marginTop: 20 }} />
                </>
              ) : (
                nodes.map((node, index) => {
                  const meta = getNodeTypeMeta(node.type);
                  return (
                    <div
                      key={node.nodeKey}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                      }}
                    >
                      <div className="appr-flow-arrow">↓</div>
                      <button
                        type="button"
                        className={`lx-clickable appr-flow-node${
                          activeNodeKey === node.nodeKey ? ' appr-flow-node--active' : ''
                        }`}
                        onClick={() => setActiveNodeKey(node.nodeKey)}
                      >
                        <div className="appr-flow-node-head">
                          <span className="appr-flow-node-icon">{meta.icon}</span>
                          <Text bold style={{ fontSize: 12 }}>
                            {node.name}
                          </Text>
                        </div>
                        <div className="appr-flow-node-approver">
                          <span className="appr-flow-node-type">{meta.label}</span>
                          <span
                            className={`appr-flow-node-approver-name${
                              isApproverConfigured(node) ? '' : ' appr-approver--warn'
                            }`}
                          >
                            {approverSummaryOf(node)}
                          </span>
                        </div>
                        <Text style={{ fontSize: 12, color: 'var(--lx-text-4)' }}>
                          第 {index + 1} 节点
                        </Text>
                      </button>
                    </div>
                  );
                })
              )}

              <div className="appr-flow-arrow">↓</div>
              <div className="appr-flow-cap appr-flow-cap--end">结束</div>
            </div>
          </div>

          {/* 右侧：节点配置 */}
          <div className="appr-flow-col appr-flow-col--right">
            <Text bold className="appr-flow-col-title">
              节点配置
            </Text>
            {!activeNode ? (
              <Empty description="选择左侧节点" style={{ marginTop: 60 }} />
            ) : (
              <div className="appr-flow-form">
                <Form.Item label="节点名称" layout="vertical" style={{ marginBottom: 12 }}>
                  <Input
                    value={activeNode.name}
                    onChange={(v) => updateNode(activeNode.nodeKey, { name: v })}
                    size="small"
                    placeholder="如：直属上级审批"
                  />
                </Form.Item>

                <Form.Item label="审批类型" layout="vertical" style={{ marginBottom: 6 }}>
                  <Select
                    value={activeNode.type}
                    onChange={(v) => handleTypeChange(activeNode.nodeKey, v)}
                    size="small"
                    style={{ width: '100%' }}
                    options={NODE_TYPE_OPTIONS.map((o) => ({ label: o.label, value: o.value }))}
                  />
                </Form.Item>
                <div className="appr-flow-hint">{getNodeTypeMeta(activeNode.type).desc}</div>

                {/* ---- 审批人：按类型给出可搜索、可定位到人的选择器 ---- */}
                <div className="appr-approver-block">
                  <div className="appr-flow-section-title">审批人</div>

                  {activeNode.type === 'user' && (
                    <>
                      <Select
                        showSearch
                        allowClear
                        size="small"
                        style={{ width: '100%' }}
                        placeholder="搜索姓名、登录名或角色"
                        value={activeNode.userId}
                        onChange={(v) =>
                          updateNode(activeNode.nodeKey, {
                            userId: typeof v === 'number' ? v : undefined,
                          })
                        }
                        options={userOptions}
                        filterOption={filterByExtra}
                        notFoundContent={
                          !canReadUsers ? '缺少「用户管理」查看权限' : '没有匹配的人员'
                        }
                      />
                      {selectedUser ? (
                        <div className="appr-approver-card">
                          <span className="appr-approver-avatar" aria-hidden>
                            {(selectedUser.name || selectedUser.username).slice(0, 1)}
                          </span>
                          <div className="appr-approver-info">
                            <span className="appr-approver-name">
                              {selectedUser.name || selectedUser.username}
                            </span>
                            <span className="appr-approver-meta">
                              {selectedUser.username}
                              {(selectedUser.roles ?? []).length > 0
                                ? ` · ${(selectedUser.roles ?? []).map((r) => r.name).join(' / ')}`
                                : ''}
                            </span>
                          </div>
                          {selectedUser.status !== 'active' && (
                            <Tag size="small" color="orange">
                              已停用
                            </Tag>
                          )}
                        </div>
                      ) : (
                        <div className="appr-approver-empty">
                          {!activeNode.userId
                            ? '尚未选择审批人'
                            : canReadUsers
                              ? `账号已不存在（ID ${activeNode.userId}），请重新选择`
                              : `已指定人员（ID ${activeNode.userId}），缺少「用户管理」查看权限，无法显示姓名`}
                        </div>
                      )}
                    </>
                  )}

                  {activeNode.type === 'role' && (
                    <>
                      <Select
                        showSearch
                        allowClear
                        size="small"
                        style={{ width: '100%' }}
                        placeholder="搜索角色名称"
                        value={activeNode.roleCode}
                        onChange={(v) => updateNode(activeNode.nodeKey, { roleCode: v })}
                        options={roleOptions}
                        filterOption={filterByExtra}
                        notFoundContent={roles?.length ? '没有匹配的角色' : '暂无可选角色'}
                      />
                      <div className="appr-approver-note">
                        {!activeNode.roleCode
                          ? '该角色下的所有用户都会收到审批待办'
                          : roleUserCount.has(activeNode.roleCode)
                            ? `该角色下有 ${roleUserCount.get(activeNode.roleCode)} 个在职账号，均会收到审批待办`
                            : '该角色下的所有用户都会收到审批待办'}
                      </div>
                    </>
                  )}

                  {activeNode.type === 'group' && (
                    <>
                      <Select
                        showSearch
                        allowClear
                        size="small"
                        style={{ width: '100%' }}
                        placeholder="搜索组名或成员姓名"
                        loading={groupsLoading}
                        value={activeNode.approvalGroupId}
                        onChange={(v) =>
                          updateNode(activeNode.nodeKey, {
                            approvalGroupId: typeof v === 'number' ? v : undefined,
                          })
                        }
                        options={groupOptions}
                        filterOption={filterByExtra}
                        notFoundContent={
                          canReadGroups ? '没有匹配的审批组' : '缺少「审批组管理」查看权限'
                        }
                      />
                      {selectedGroup && (
                        <div className="appr-flow-members">
                          <span className="appr-flow-members-label">组内成员</span>
                          {selectedMemberNames.length > 0 ? (
                            <Space size={4} wrap>
                              {selectedMemberNames.map((name) => (
                                <Tag key={name} size="small">
                                  {name}
                                </Tag>
                              ))}
                            </Space>
                          ) : (
                            <Text style={{ fontSize: 12, color: 'var(--lx-text-3)' }}>
                              共 {selectedGroup.members?.length ?? 0} 人
                              {!canReadUsers ? '（无成员姓名查看权限）' : '（尚未添加成员）'}
                            </Text>
                          )}
                        </div>
                      )}
                    </>
                  )}

                  {/* 按组织关系动态解析的两种类型没有可选项，用只读卡片说明「谁会审」 */}
                  {(activeNode.type === 'department_manager' || activeNode.type === 'initiator') && (
                    <div className="appr-approver-static">
                      <span className="appr-approver-static-icon" aria-hidden>
                        {getNodeTypeMeta(activeNode.type).icon}
                      </span>
                      <div className="appr-approver-info">
                        <span className="appr-approver-name">
                          {activeNode.type === 'department_manager' ? '申请人所属部门主管' : '申请人本人'}
                        </span>
                        <span className="appr-approver-meta">
                          {activeNode.type === 'department_manager'
                            ? '按申请提交时填写的部门动态解析；部门未设负责人时本节点会被跳过'
                            : '回到发起人确认，无需额外配置'}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                <Divider style={{ margin: '10px 0' }} />

                <div className="appr-flow-section-title">生效条件</div>
                <div className="appr-flow-hint">
                  申请数据满足条件时本节点才参与审批；三项都留空表示所有情况都走本节点。
                </div>

                <Form.Item label="条件字段" layout="vertical" style={{ marginBottom: 10 }}>
                  <Select
                    size="small"
                    style={{ width: '100%' }}
                    placeholder="不设置条件"
                    allowClear
                    value={
                      activeNode.conditionField
                        ? isKnownConditionField(activeNode.conditionField)
                          ? activeNode.conditionField
                          : CUSTOM_FIELD
                        : undefined
                    }
                    onChange={(v) =>
                      updateNode(activeNode.nodeKey, {
                        conditionField: v === CUSTOM_FIELD ? '' : (v as string | undefined),
                      })
                    }
                    options={[
                      ...CONDITION_FIELDS,
                      { label: '其他字段（手动输入）', value: CUSTOM_FIELD },
                    ]}
                  />
                </Form.Item>

                {activeNode.conditionField !== undefined &&
                  !isKnownConditionField(activeNode.conditionField) && (
                    <Form.Item label="字段键名" layout="vertical" style={{ marginBottom: 10 }}>
                      <Input
                        size="small"
                        value={activeNode.conditionField}
                        onChange={(v) => updateNode(activeNode.nodeKey, { conditionField: v })}
                        placeholder="该业务提交审批时使用的字段名"
                      />
                    </Form.Item>
                  )}

                <Form.Item label="比较方式" layout="vertical" style={{ marginBottom: 10 }}>
                  <Select
                    size="small"
                    style={{ width: '100%' }}
                    placeholder="不比较"
                    allowClear
                    value={activeNode.conditionOperator}
                    onChange={(v) => updateNode(activeNode.nodeKey, { conditionOperator: v })}
                    options={CONDITION_OPERATORS}
                  />
                </Form.Item>

                <Form.Item label="比较值" layout="vertical" style={{ marginBottom: 0 }}>
                  <Input
                    size="small"
                    value={activeNode.conditionValue}
                    onChange={(v) => updateNode(activeNode.nodeKey, { conditionValue: v })}
                    placeholder="填写用于比较的数值或文字"
                  />
                </Form.Item>
              </div>
            )}
          </div>
        </div>
      </Modal>
    </PageContainer>
  );
}
