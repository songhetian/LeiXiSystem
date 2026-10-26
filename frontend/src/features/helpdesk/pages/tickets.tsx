'use client';

import { useState, useEffect, useCallback } from 'react';
import { Tabs, Button, Space, Select, Modal, Form, Input, Message, Tag } from '@arco-design/web-react';
import PageContainer from '@/components/PageContainer';
import ProTable from '@/components/ProTable';
import { PermissionGate } from '@/components/PermissionGate';
import type { ProTableColumn } from '@/components/ProTable';
import type { SearchFieldConfig } from '@/components/SearchForm';
import { helpdeskApi, HelpdeskTicket, HelpdeskSla, TicketPriority } from '@/services/helpdesk';
import { systemApi, type SysUser } from '@/services/system';
import { usePermission } from '@/hooks/use-permission';
import { useCachedData } from '@/hooks/use-cached-data';
import { exportToExcel } from '@/lib/excel';
import { todayStr, formatDateTime as formatDateTimeTz } from '@/lib/format';
import { notifyError } from '@/lib/request';

const TabPane = Tabs.TabPane;
const FormItem = Form.Item;

/** 优先级中文映射 */
const PRIORITY_MAP: Record<TicketPriority, { label: string; color: string }> = {
  low: { label: '低', color: 'arcoblue' },
  medium: { label: '中', color: 'gold' },
  high: { label: '高', color: 'orange' },
  urgent: { label: '紧急', color: 'red' },
};
const PRIORITY_OPTIONS: { value: TicketPriority; label: string }[] = [
  { value: 'low', label: '低' },
  { value: 'medium', label: '中' },
  { value: 'high', label: '高' },
  { value: 'urgent', label: '紧急' },
];

/** 状态中文映射 */
const STATUS_MAP: Record<string, { label: string; color: string }> = {
  open: { label: '处理中', color: 'arcoblue' },
  resolved: { label: '已关闭', color: 'green' },
};

/** 到期时间格式化：复用 lib/format 中的 formatDateTime，恒以北京时间渲染 */
function formatDateTime(v?: string | null): string {
  return formatDateTimeTz(v, '--');
}

export default function HelpdeskTicketsPage() {
  const { can } = usePermission();
  const canManage = can('helpdesk:manage');

  // ===== 工单 =====
  const [ticketPage, setTicketPage] = useState(1);
  const [ticketPageSize, setTicketPageSize] = useState(10);
  const [ticketFilters, setTicketFilters] = useState<{ status: string; priority: string }>({ status: '', priority: '' });

  // SWR 缓存：以 页码/大小/筛选条件 为 key，服务端分页
  const ticketCacheKey = `helpdesk:tickets:${JSON.stringify({ page: ticketPage, pageSize: ticketPageSize, ...ticketFilters })}`;
  const { data: ticketRes, loading: ticketLoading, error: ticketError, revalidate: revalidateTickets } =
    useCachedData<{ code: number; message?: string; data?: { list: HelpdeskTicket[]; total: number } }>(
      ticketCacheKey,
      () =>
        helpdeskApi.listTickets({
          page: ticketPage,
          pageSize: ticketPageSize,
          status: ticketFilters.status || undefined,
          priority: ticketFilters.priority || undefined,
        }),
      { staleTime: 30_000 },
    );
  const tickets = ticketRes?.data?.list ?? [];
  const ticketTotal = ticketRes?.data?.total ?? 0;
  const ticketErrorText = ticketError
    ? ticketError
    : ticketRes && ticketRes.code !== 0
      ? ticketRes.message || '获取工单列表失败'
      : null;

  // ===== 工单弹窗 =====
  const [ticketModalVisible, setTicketModalVisible] = useState(false);
  const [ticketModalLoading, setTicketModalLoading] = useState(false);
  const [editingTicket, setEditingTicket] = useState<HelpdeskTicket | null>(null);
  const [ticketForm] = Form.useForm();

  // ===== SLA =====
  const [slaModalVisible, setSlaModalVisible] = useState(false);
  const [slaModalLoading, setSlaModalLoading] = useState(false);
  const [editingSla, setEditingSla] = useState<HelpdeskSla | null>(null);
  const [slaForm] = Form.useForm();

  // 处理人候选（assigneeId 为系统用户 ID）
  const [users, setUsers] = useState<SysUser[]>([]);

  // 加载处理人用户列表
  const fetchUsers = useCallback(async () => {
    try {
      const res = await systemApi.listUsers({ page: 1, pageSize: 200 });
      if (res.code === 0 && res.data) setUsers(res.data.list);
    } catch {
      // 用户候选加载失败时忽略
    }
  }, []);
  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // 工单列表由 useCachedData 按 cacheKey（页码/大小/筛选）自动拉取，无需手写加载范式

  // SLA 列表：全量返回，走共享缓存
  const { data: slaRes, loading: slaLoading, error: slaErrorObj, revalidate: revalidateSlas } =
    useCachedData<{ code: number; message?: string; data?: { list: HelpdeskSla[]; total: number } }>(
      'helpdesk:slas',
      () => helpdeskApi.listSlas(),
      { staleTime: 60_000 },
    );
  const slas = slaRes?.data?.list ?? [];
  const slaErrorText = slaErrorObj
    ? slaErrorObj
    : slaRes && slaRes.code !== 0
      ? slaRes.message || '获取 SLA 列表失败'
      : null;

  // Select 清空（allowClear）时 Arco 回调 undefined，必须归一化为空串，否则会变成字符串 "undefined" 发给服务端
  // —— 该语义现由 SearchForm 统一承担（handleChange 对空值归一化）

  // ProTable 搜索区提交：字段变更即（防抖）触发过滤并回到第 1 页
  const handleTicketSearch = (values: Record<string, any>) => {
    setTicketFilters({
      status: values.status ? String(values.status) : '',
      priority: values.priority ? String(values.priority) : '',
    });
    setTicketPage(1);
  };

  const handleTicketReset = () => {
    setTicketFilters({ status: '', priority: '' });
    setTicketPage(1);
  };

  const ticketSearchFields: SearchFieldConfig[] = [
    {
      key: 'status',
      label: '状态',
      type: 'select',
      placeholder: '全部状态',
      options: [
        { value: 'open', label: '处理中' },
        { value: 'resolved', label: '已关闭' },
      ],
    },
    {
      key: 'priority',
      label: '优先级',
      type: 'select',
      placeholder: '全部优先级',
      options: PRIORITY_OPTIONS.map((o) => ({ value: o.value, label: o.label })),
    },
  ];

  // ===== 工单操作 =====
  const handleAddTicket = () => {
    if (!canManage) return;
    setEditingTicket(null);
    ticketForm.resetFields();
    setTicketModalVisible(true);
  };

  const handleEditTicket = (record: HelpdeskTicket) => {
    if (!canManage) return;
    setEditingTicket(record);
    ticketForm.setFieldsValue({
      title: record.title,
      category: record.category || '',
      priority: record.priority,
      status: record.status,
      assigneeId: record.assigneeId ?? undefined,
      description: record.description || '',
    });
    setTicketModalVisible(true);
  };

  const handleTicketModalOk = async () => {
    let values: any;
    try {
      values = await ticketForm.validate();
    } catch {
      return;
    }
    setTicketModalLoading(true);
    try {
      if (editingTicket) {
        const res = await helpdeskApi.updateTicket(editingTicket.id, {
          title: values.title,
          category: values.category || undefined,
          priority: values.priority,
          status: values.status || 'open',
          assigneeId: values.assigneeId ?? null,
          description: values.description || undefined,
        });
        if (res.code === 0) {
          Message.success('工单更新成功');
          setTicketModalVisible(false);
          revalidateTickets();
        } else {
          Message.error(res.message || '更新工单失败');
        }
      } else {
        const res = await helpdeskApi.createTicket({
          title: values.title,
          category: values.category || undefined,
          priority: (values.priority as TicketPriority) || 'medium',
          assigneeId: values.assigneeId ?? null,
          description: values.description || undefined,
        });
        if (res.code === 0) {
          Message.success('工单创建成功');
          setTicketModalVisible(false);
          setTicketPage(1); // 新建工单排在最前，回到第 1 页便于查看
          revalidateTickets();
        } else {
          Message.error(res.message || '创建工单失败');
        }
      }
    } catch (e) {
      notifyError(e, '操作失败');
    } finally {
      setTicketModalLoading(false);
    }
  };

  const handleResolveTicket = (record: HelpdeskTicket) => {
    if (!canManage) return;
    Modal.confirm({
      title: '确认关闭',
      content: `确定将工单「${record.ticketNo}」标记为已关闭吗？`,
      onOk: async () => {
        try {
          const res = await helpdeskApi.resolveTicket(record.id);
          if (res.code === 0) {
            Message.success('工单已关闭');
            revalidateTickets();
          } else {
            Message.error(res.message || '操作失败');
          }
        } catch {
          Message.error('操作失败');
        }
      },
    });
  };

  const handleDeleteTicket = (record: HelpdeskTicket) => {
    if (!canManage) return;
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除工单「${record.ticketNo}」吗？删除后不可恢复。`,
      onOk: async () => {
        try {
          const res = await helpdeskApi.deleteTicket(record.id);
          if (res.code === 0) {
            Message.success('删除成功');
            // 删除末页最后一条时回退到最后一个有效页，避免停留在空页
            const lastPage = Math.max(1, Math.ceil((ticketTotal - 1) / ticketPageSize));
            if (ticketPage > lastPage) {
              setTicketPage(lastPage); // 缓存 key 变化即自动重新拉取
            } else {
              revalidateTickets();
            }
          } else {
            Message.error(res.message || '删除失败');
          }
        } catch {
          Message.error('删除失败');
        }
      },
    });
  };

  // ===== SLA 操作 =====
  const handleAddSla = () => {
    if (!canManage) return;
    setEditingSla(null);
    slaForm.resetFields();
    slaForm.setFieldsValue({ priority: 'medium', enabled: 'true' });
    setSlaModalVisible(true);
  };

  const handleEditSla = (record: HelpdeskSla) => {
    if (!canManage) return;
    setEditingSla(record);
    slaForm.setFieldsValue({
      name: record.name,
      priority: record.priority,
      firstResponseMinutes: record.firstResponseMinutes,
      resolutionMinutes: record.resolutionMinutes,
      enabled: record.enabled ? 'true' : 'false',
    });
    setSlaModalVisible(true);
  };

  const handleSlaModalOk = async () => {
    let values: any;
    try {
      values = await slaForm.validate();
    } catch {
      return;
    }
    setSlaModalLoading(true);
    try {
      const dto = {
        name: values.name,
        priority: values.priority,
        firstResponseMinutes: Number(values.firstResponseMinutes) || 0,
        resolutionMinutes: Number(values.resolutionMinutes) || 0,
        enabled: values.enabled !== 'false',
      };
      let res;
      if (editingSla) {
        res = await helpdeskApi.updateSla(editingSla.id, dto);
      } else {
        res = await helpdeskApi.createSla(dto);
      }
      if (res.code === 0) {
        Message.success(editingSla ? 'SLA 更新成功' : 'SLA 创建成功');
        setSlaModalVisible(false);
        revalidateSlas();
      } else {
        Message.error(res.message || '操作失败');
      }
    } catch (e) {
      notifyError(e, '操作失败');
    } finally {
      setSlaModalLoading(false);
    }
  };

  const handleDeleteSla = (record: HelpdeskSla) => {
    if (!canManage) return;
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除 SLA「${record.name}」吗？`,
      onOk: async () => {
        try {
          const res = await helpdeskApi.deleteSla(record.id);
          if (res.code === 0) {
            Message.success('删除成功');
            revalidateSlas();
          } else {
            Message.error(res.message || '删除失败');
          }
        } catch (e) {
          notifyError(e, '删除失败');
        }
      },
    });
  };

  // 导出工单：拉取符合当前筛选条件的全部工单（不受分页限制）
  const handleExportTickets = async () => {
    let list: HelpdeskTicket[] = [];
    try {
      const res = await helpdeskApi.listTickets({
        page: 1,
        pageSize: 10000,
        status: ticketFilters.status || undefined,
        priority: ticketFilters.priority || undefined,
      });
      list = res.data?.list ?? [];
    } catch {
      Message.error('导出失败');
      return;
    }
    if (!exportToExcel(
      `工单列表_${todayStr()}.xlsx`,
      '工单',
      [
        { title: '工单号', dataIndex: 'ticketNo' },
        { title: '标题', dataIndex: 'title' },
        { title: '类别', value: (t: HelpdeskTicket) => t.category || '' },
        { title: '优先级', value: (t: HelpdeskTicket) => PRIORITY_MAP[t.priority as TicketPriority]?.label ?? t.priority },
        { title: '状态', value: (t: HelpdeskTicket) => STATUS_MAP[t.status]?.label ?? t.status },
        { title: '请求人', value: (t: HelpdeskTicket) => t.requester?.name || '' },
        { title: '处理人', value: (t: HelpdeskTicket) => t.assignee?.name || '' },
        { title: '到期时间', value: (t: HelpdeskTicket) => formatDateTime(t.dueAt) },
        { title: '创建时间', value: (t: HelpdeskTicket) => formatDateTime(t.createdAt) },
      ],
      list,
    )) {
      Message.info('当前没有可导出的工单数据');
    }
  };

  // ===== 表格列定义 =====
  const ticketColumns: ProTableColumn[] = [
    { title: '工单号', dataIndex: 'ticketNo', width: 140 },
    { title: '标题', dataIndex: 'title', width: 200, ellipsis: true },
    { title: '类别', dataIndex: 'category', width: 100, render: (v: string) => v || '--' },
    {
      title: '优先级',
      dataIndex: 'priority',
      width: 90,
      render: (v: string) => {
        const map = PRIORITY_MAP[v as TicketPriority];
        return map ? <Tag color={map.color}>{map.label}</Tag> : v;
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 90,
      render: (v: string) => {
        const map = STATUS_MAP[v];
        return map ? <Tag color={map.color}>{map.label}</Tag> : v;
      },
    },
    { title: '请求人', dataIndex: 'requesterName', width: 100, render: (_: any, r: HelpdeskTicket) => r.requester?.name || '--' },
    { title: '处理人', dataIndex: 'assigneeName', width: 100, render: (_: any, r: HelpdeskTicket) => r.assignee?.name || '--' },
    { title: '到期时间', dataIndex: 'dueAt', width: 150, render: (v: string) => formatDateTime(v) },
    {
      title: '操作',
      dataIndex: 'actions',
      width: 230,
      render: (_: any, record: HelpdeskTicket) => (
        <PermissionGate code="helpdesk:manage">
          <Space size={4}>
            <Button size="small" type="text" onClick={() => handleEditTicket(record)}>指派/更新</Button>
            {record.status !== 'resolved' && (
              <Button size="small" type="text" onClick={() => handleResolveTicket(record)}>解决</Button>
            )}
            <Button size="small" type="text" status="danger" onClick={() => handleDeleteTicket(record)}>删除</Button>
          </Space>
        </PermissionGate>
      ),
    },
  ];

  const slaColumns: ProTableColumn[] = [
    { title: 'SLA 名称', dataIndex: 'name', width: 180 },
    {
      title: '优先级',
      dataIndex: 'priority',
      width: 100,
      render: (v: string) => {
        const map = PRIORITY_MAP[v as TicketPriority];
        return map ? <Tag color={map.color}>{map.label}</Tag> : v;
      },
    },
    { title: '首次响应(分钟)', dataIndex: 'firstResponseMinutes', width: 140 },
    { title: '解决时限(分钟)', dataIndex: 'resolutionMinutes', width: 140 },
    {
      title: '启用',
      dataIndex: 'enabled',
      width: 90,
      render: (v: boolean) => <Tag color={v ? 'green' : 'gray'}>{v ? '启用' : '停用'}</Tag>,
    },
    {
      title: '操作',
      dataIndex: 'actions',
      width: 140,
      render: (_: any, record: HelpdeskSla) => (
        <PermissionGate code="helpdesk:manage">
          <Space size={4}>
            <Button size="small" type="text" onClick={() => handleEditSla(record)}>编辑</Button>
            <Button size="small" type="text" status="danger" onClick={() => handleDeleteSla(record)}>删除</Button>
          </Space>
        </PermissionGate>
      ),
    },
  ];

  const assigneeOptions = users.map((u) => ({ value: u.id, label: `${u.username} - ${u.name}` }));

  return (
    <PageContainer>
      <Tabs defaultActiveTab="tickets">
        <TabPane key="tickets" title="工单列表">
          <ProTable
            columns={ticketColumns}
            data={tickets}
            rowKey="id"
            loading={ticketLoading}
            error={ticketErrorText}
            onRetry={() => revalidateTickets()}
            searchFields={ticketSearchFields}
            onSearch={handleTicketSearch}
            onReset={handleTicketReset}
            searchDebounceMs={300}
            searchInlineActions
            toolbar={[
              {
                key: 'tickets-add',
                label: '新建工单',
                onClick: handleAddTicket,
                disabled: !canManage,
              },
            ]}
            showExport
            onExport={handleExportTickets}
            pagination={{
              current: ticketPage,
              pageSize: ticketPageSize,
              total: ticketTotal,
            }}
            onPageChange={(current, size) => {
              setTicketPage(current);
              setTicketPageSize(size);
            }}
            stripe
            emptyElement={<span className="text-text-3">暂无工单</span>}
          />
        </TabPane>

        <TabPane key="slas" title="SLA 规则">
          <ProTable
            columns={slaColumns}
            data={slas}
            rowKey="id"
            loading={slaLoading}
            error={slaErrorText}
            onRetry={() => revalidateSlas()}
            toolbar={[
              {
                key: 'slas-add',
                label: '新建 SLA',
                onClick: handleAddSla,
                disabled: !canManage,
              },
            ]}
            pagination={false}
            stripe
            emptyElement={<span className="text-text-3">暂无 SLA 规则</span>}
          />
        </TabPane>
      </Tabs>

      {/* 工单新建/编辑弹窗 */}
      <Modal
        title={editingTicket ? '指派/更新工单' : '新建工单'}
        visible={ticketModalVisible}
        onOk={handleTicketModalOk}
        onCancel={() => setTicketModalVisible(false)}
        confirmLoading={ticketModalLoading}
        okText="确定"
        cancelText="取消"
        style={{ width: 560 }}
        maskClosable={false}
      >
        <Form form={ticketForm} layout="vertical">
          <FormItem label="标题" field="title" required>
            <Input placeholder="请输入工单标题" />
          </FormItem>
          <FormItem label="类别" field="category">
            <Input placeholder="如：系统故障 / 账号问题 / 咨询" />
          </FormItem>
          <FormItem label="优先级" field="priority" required>
            <Select placeholder="请选择优先级" options={PRIORITY_OPTIONS} />
          </FormItem>
          {editingTicket && (
            <FormItem label="状态" field="status">
              <Select
                placeholder="请选择状态"
                options={[
                  { value: 'open', label: '处理中' },
                  { value: 'resolved', label: '已关闭' },
                ]}
              />
            </FormItem>
          )}
          <FormItem label="处理人" field="assigneeId">
            <Select
              placeholder="请选择处理人（系统用户）"
              options={assigneeOptions}
              allowClear
              showSearch
              filterOption={(input: string, option: any) =>
                String(option.props?.children ?? '').includes(input)
              }
              onSearch={undefined}
            />
          </FormItem>
          <FormItem label="描述" field="description">
            <Input.TextArea placeholder="请输入工单描述" autoSize={{ minRows: 3, maxRows: 6 }} />
          </FormItem>
        </Form>
      </Modal>

      {/* SLA 新建/编辑弹窗 */}
      <Modal
        title={editingSla ? '编辑 SLA' : '新建 SLA'}
        visible={slaModalVisible}
        onOk={handleSlaModalOk}
        onCancel={() => setSlaModalVisible(false)}
        confirmLoading={slaModalLoading}
        okText="确定"
        cancelText="取消"
        style={{ width: 520 }}
        maskClosable={false}
      >
        <Form form={slaForm} layout="vertical">
          <FormItem label="SLA 名称" field="name" required>
            <Input placeholder="如：紧急工单" />
          </FormItem>
          <FormItem label="优先级" field="priority" required>
            <Select
              placeholder="请选择优先级"
              options={PRIORITY_OPTIONS.map((o) => ({ ...o, label: `${o.label}（${o.value}）` }))}
            />
          </FormItem>
          <FormItem label="首次响应(分钟)" field="firstResponseMinutes">
            <Input placeholder="默认 60" type="number" />
          </FormItem>
          <FormItem label="解决时限(分钟)" field="resolutionMinutes">
            <Input placeholder="默认 480" type="number" />
          </FormItem>
          <FormItem label="启用" field="enabled">
            <Select
              placeholder="请选择"
              options={[
                { value: 'true', label: '启用' },
                { value: 'false', label: '停用' },
              ]}
            />
          </FormItem>
        </Form>
      </Modal>
    </PageContainer>
  );
}