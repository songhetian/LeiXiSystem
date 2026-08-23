'use client';

import { useState, useCallback, useEffect } from 'react';
import { Tabs, Button, Space, Table, Tag, Modal, Form, Input, Select, DatePicker, InputNumber, Message, Popconfirm } from '@arco-design/web-react';
import { IconPlus } from '@arco-design/web-react/icon';
import { employeeApi } from '@/services/employee';
import PageContainer from '@/components/PageContainer';
import { notifyError } from '@/lib/request';

const TX_TYPES = [
  { key: 'onboardings', label: '入职办理', statusKey: 'onboardingStatus' },
  { key: 'resignations', label: '离职申请', statusKey: 'resignationStatus' },
  { key: 'probations', label: '转正申请', statusKey: 'probationStatus' },
  { key: 'contracts', label: '合同管理', statusKey: 'contractStatus' },
  { key: 'attendance-appeals', label: '考勤申诉', statusKey: 'appealStatus' },
  { key: 'certificates', label: '证明申请', statusKey: 'certificateStatus' },
  { key: 'rewards', label: '奖惩记录', statusKey: 'rewardStatus' },
  { key: 'trainings', label: '培训记录', statusKey: 'trainingStatus' },
  { key: 'transfers', label: '调动记录', statusKey: 'transferStatus' },
];

const STATUS_MAP: Record<string, { text: string; color: string }[]> = {
  onboardings: [
    { text: '草稿', color: 'gray' },
    { text: '审批中', color: 'gold' },
    { text: '已完成', color: 'green' },
    { text: '已拒绝', color: 'red' },
    { text: '已取消', color: 'gray' },
  ],
  resignations: [
    { text: '草稿', color: 'gray' },
    { text: '审批中', color: 'gold' },
    { text: '已通过', color: 'green' },
    { text: '已拒绝', color: 'red' },
    { text: '已取消', color: 'gray' },
  ],
  probations: [
    { text: '草稿', color: 'gray' },
    { text: '审批中', color: 'gold' },
    { text: '已通过', color: 'green' },
    { text: '已拒绝', color: 'red' },
    { text: '已取消', color: 'gray' },
  ],
  contracts: [
    { text: '草稿', color: 'gray' },
    { text: '生效中', color: 'green' },
    { text: '已到期', color: 'orange' },
    { text: '已终止', color: 'red' },
  ],
  'attendance-appeals': [
    { text: '草稿', color: 'gray' },
    { text: '审批中', color: 'gold' },
    { text: '已通过', color: 'green' },
    { text: '已拒绝', color: 'red' },
    { text: '已取消', color: 'gray' },
  ],
  certificates: [
    { text: '草稿', color: 'gray' },
    { text: '审批中', color: 'gold' },
    { text: '已通过', color: 'green' },
    { text: '已拒绝', color: 'red' },
    { text: '已取消', color: 'gray' },
  ],
  rewards: [
    { text: '草稿', color: 'gray' },
    { text: '审批中', color: 'gold' },
    { text: '已生效', color: 'green' },
    { text: '已拒绝', color: 'red' },
    { text: '已取消', color: 'gray' },
  ],
  trainings: [
    { text: '草稿', color: 'gray' },
    { text: '进行中', color: 'blue' },
    { text: '已完成', color: 'green' },
    { text: '已取消', color: 'gray' },
  ],
  transfers: [
    { text: '草稿', color: 'gray' },
    { text: '审批中', color: 'gold' },
    { text: '已生效', color: 'green' },
    { text: '已拒绝', color: 'red' },
    { text: '已取消', color: 'gray' },
  ],
};

function StatusTag({ type, status }: { type: string; status: string }) {
  const statuses = STATUS_MAP[type] || [];
  const index = ['draft', 'pending', 'approved', 'rejected', 'cancelled'].indexOf(status);
  const item = statuses[index] || { text: status, color: 'gray' };
  return <Tag color={item.color as any}>{item.text}</Tag>;
}

const FormInput = Form.Item;

export default function EmployeeTransactions() {
  const [activeKey, setActiveKey] = useState('onboardings');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form] = Form.useForm();
  const [data, setData] = useState<{ list: any[]; total: number }>({ list: [], total: 0 });
  const [loading, setLoading] = useState(false);
  const [employeeMap, setEmployeeMap] = useState<Record<number, { name: string; employeeNo: string }>>({});

  useEffect(() => {
    employeeApi.getList({ page: 1, pageSize: 10000 }).then((res) => {
      const list = (res.data?.list ?? []) as { id: number; name: string; employeeNo: string }[];
      const map: Record<number, { name: string; employeeNo: string }> = {};
      list.forEach((e) => { map[e.id] = { name: e.name, employeeNo: e.employeeNo }; });
      setEmployeeMap(map);
    }).catch(() => {});
  }, []);

  const employeeOptions = Object.entries(employeeMap)
    .map(([id, e]) => ({ value: Number(id), label: `${e.name}（${e.employeeNo}）` }))
    .sort((a, b) => String(a.label).localeCompare(String(b.label)));

  /** 员工选择器：替代裸员工ID输入，便于按姓名/工号检索 */
  const EmployeeSelectField = () => (
    <FormInput label="员工" field="employeeId" required>
      <Select
        showSearch
        allowClear
        style={{ width: '100%' }}
        placeholder="按姓名/工号选择员工"
        options={employeeOptions}
      />
    </FormInput>
  );

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await employeeApi.getTxList(activeKey, { page, pageSize });
      setData(res.data || { list: [], total: 0 });
    } finally {
      setLoading(false);
    }
  }, [activeKey, page, pageSize]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleCreate = () => {
    setEditingId(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (row: any) => {
    setEditingId(row.id);
    form.setFieldsValue(row);
    setModalVisible(true);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validate();
      if (editingId) {
        await employeeApi.updateTx(activeKey, editingId, values);
        Message.success('更新成功');
      } else {
        await employeeApi.createTx(activeKey, values);
        Message.success('创建成功');
      }
      setModalVisible(false);
      refresh();
    } catch (e: any) {
      notifyError(e, '操作失败');
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await employeeApi.deleteTx(activeKey, id);
      Message.success('删除成功');
      refresh();
    } catch (e: any) {
      notifyError(e, '删除失败');
    }
  };

  const handleSubmitApproval = async (id: number) => {
    try {
      await employeeApi.submitTx(activeKey, id, `${activeKey}_workflow`);
      Message.success('已提交审批');
      refresh();
    } catch (e: any) {
      notifyError(e, '提交失败');
    }
  };

  const renderColumns = () => {
    const baseCols = [
      { title: '员工', dataIndex: 'employeeId', width: 140, render: (v: number) => {
        const e = employeeMap[v];
        return e ? `${e.name}（${e.employeeNo}）` : (v ?? '-');
      } },
    ];

    switch (activeKey) {
      case 'onboardings':
        return [
          ...baseCols,
          { title: '姓名', dataIndex: 'name', width: 100 },
          { title: '部门', dataIndex: 'departmentName', width: 120 },
          { title: '职位', dataIndex: 'positionName', width: 120 },
          { title: '入职日期', dataIndex: 'hireDate', width: 120 },
          { title: '状态', dataIndex: 'status', width: 100, render: (v: string) => <StatusTag type={activeKey} status={v} /> },
        ];
      case 'resignations':
        return [
          ...baseCols,
          { title: '离职日期', dataIndex: 'resignDate', width: 120 },
          { title: '原因', dataIndex: 'reason', width: 200, ellipsis: true },
          { title: '状态', dataIndex: 'status', width: 100, render: (v: string) => <StatusTag type={activeKey} status={v} /> },
        ];
      case 'probations':
        return [
          ...baseCols,
          { title: '转正日期', dataIndex: 'regularDate', width: 120 },
          { title: '试用期评价', dataIndex: 'evaluation', width: 200, ellipsis: true },
          { title: '状态', dataIndex: 'status', width: 100, render: (v: string) => <StatusTag type={activeKey} status={v} /> },
        ];
      case 'contracts':
        return [
          ...baseCols,
          { title: '合同类型', dataIndex: 'contractType', width: 120 },
          { title: '开始日期', dataIndex: 'startDate', width: 120 },
          { title: '结束日期', dataIndex: 'endDate', width: 120 },
          { title: '状态', dataIndex: 'status', width: 100, render: (v: string) => <StatusTag type={activeKey} status={v} /> },
        ];
      case 'attendance-appeals':
        return [
          ...baseCols,
          { title: '申诉日期', dataIndex: 'appealDate', width: 120 },
          { title: '类型', dataIndex: 'appealType', width: 120 },
          { title: '原因', dataIndex: 'reason', width: 200, ellipsis: true },
          { title: '状态', dataIndex: 'status', width: 100, render: (v: string) => <StatusTag type={activeKey} status={v} /> },
        ];
      case 'certificates':
        return [
          ...baseCols,
          { title: '证明类型', dataIndex: 'certificateType', width: 120 },
          { title: '用途', dataIndex: 'purpose', width: 200, ellipsis: true },
          { title: '状态', dataIndex: 'status', width: 100, render: (v: string) => <StatusTag type={activeKey} status={v} /> },
        ];
      case 'rewards':
        return [
          ...baseCols,
          { title: '类型', dataIndex: 'rewardType', width: 100 },
          { title: '原因', dataIndex: 'reason', width: 200, ellipsis: true },
          { title: '金额', dataIndex: 'amount', width: 100 },
          { title: '状态', dataIndex: 'status', width: 100, render: (v: string) => <StatusTag type={activeKey} status={v} /> },
        ];
      case 'trainings':
        return [
          ...baseCols,
          { title: '培训名称', dataIndex: 'trainingName', width: 150 },
          { title: '开始日期', dataIndex: 'startDate', width: 120 },
          { title: '结束日期', dataIndex: 'endDate', width: 120 },
          { title: '状态', dataIndex: 'status', width: 100, render: (v: string) => <StatusTag type={activeKey} status={v} /> },
        ];
      case 'transfers':
        return [
          ...baseCols,
          { title: '调动类型', dataIndex: 'transferType', width: 120 },
          { title: '生效日期', dataIndex: 'effectiveDate', width: 120 },
          { title: '状态', dataIndex: 'status', width: 100, render: (v: string) => <StatusTag type={activeKey} status={v} /> },
        ];
      default:
        return baseCols;
    }
  };

  const renderFormFields = () => {
    switch (activeKey) {
      case 'onboardings':
        return (
          <>
            <EmployeeSelectField />
            <FormInput label="姓名" field="name" rules={[{ required: true }]}>
              <Input />
            </FormInput>
            <FormInput label="入职日期" field="hireDate" rules={[{ required: true }]}>
              <DatePicker style={{ width: '100%' }} />
            </FormInput>
            <FormInput label="部门ID" field="departmentId">
              <InputNumber style={{ width: '100%' }} />
            </FormInput>
            <FormInput label="职位ID" field="positionId">
              <InputNumber style={{ width: '100%' }} />
            </FormInput>
          </>
        );
      case 'resignations':
        return (
          <>
            <EmployeeSelectField />
            <FormInput label="离职日期" field="resignDate" rules={[{ required: true }]}>
              <DatePicker style={{ width: '100%' }} />
            </FormInput>
            <FormInput label="离职原因" field="reason" rules={[{ required: true }]}>
              <Input.TextArea rows={3} />
            </FormInput>
            <FormInput label="交接备注" field="handoverRemark">
              <Input.TextArea rows={2} />
            </FormInput>
          </>
        );
      case 'probations':
        return (
          <>
            <EmployeeSelectField />
            <FormInput label="转正日期" field="regularDate" rules={[{ required: true }]}>
              <DatePicker style={{ width: '100%' }} />
            </FormInput>
            <FormInput label="试用期评价" field="evaluation">
              <Input.TextArea rows={3} />
            </FormInput>
          </>
        );
      case 'contracts':
        return (
          <>
            <EmployeeSelectField />
            <FormInput label="合同类型" field="contractType" rules={[{ required: true }]}>
              <Select style={{ width: '100%' }} options={[
                { label: '固定期限', value: 'fixed_term' },
                { label: '无固定期限', value: 'open_ended' },
                { label: '试用期', value: 'probation' },
                { label: '实习', value: 'internship' },
              ]} />
            </FormInput>
            <FormInput label="开始日期" field="startDate" rules={[{ required: true }]}>
              <DatePicker style={{ width: '100%' }} />
            </FormInput>
            <FormInput label="结束日期" field="endDate">
              <DatePicker style={{ width: '100%' }} />
            </FormInput>
            <FormInput label="合同编号" field="contractNo">
              <Input />
            </FormInput>
          </>
        );
      case 'attendance-appeals':
        return (
          <>
            <EmployeeSelectField />
            <FormInput label="申诉日期" field="appealDate" rules={[{ required: true }]}>
              <DatePicker style={{ width: '100%' }} />
            </FormInput>
            <FormInput label="申诉类型" field="appealType" rules={[{ required: true }]}>
              <Select style={{ width: '100%' }} options={[
                { label: '漏打卡', value: 'miss_punch' },
                { label: '迟到', value: 'late' },
                { label: '早退', value: 'early_leave' },
                { label: '旷工', value: 'absent' },
                { label: '其他', value: 'other' },
              ]} />
            </FormInput>
            <FormInput label="原因" field="reason" rules={[{ required: true }]}>
              <Input.TextArea rows={3} />
            </FormInput>
          </>
        );
      case 'certificates':
        return (
          <>
            <EmployeeSelectField />
            <FormInput label="证明类型" field="certificateType" rules={[{ required: true }]}>
              <Select style={{ width: '100%' }} options={[
                { label: '在职证明', value: 'employment' },
                { label: '收入证明', value: 'income' },
                { label: '离职证明', value: 'resignation' },
                { label: '实习证明', value: 'internship' },
                { label: '其他', value: 'other' },
              ]} />
            </FormInput>
            <FormInput label="用途" field="purpose">
              <Input.TextArea rows={2} />
            </FormInput>
          </>
        );
      case 'rewards':
        return (
          <>
            <EmployeeSelectField />
            <FormInput label="奖惩类型" field="rewardType" rules={[{ required: true }]}>
              <Select style={{ width: '100%' }} options={[
                { label: '奖励', value: 'reward' },
                { label: '惩罚', value: 'penalty' },
              ]} />
            </FormInput>
            <FormInput label="原因" field="reason" rules={[{ required: true }]}>
              <Input.TextArea rows={3} />
            </FormInput>
            <FormInput label="金额" field="amount">
              <InputNumber style={{ width: '100%' }} />
            </FormInput>
          </>
        );
      case 'trainings':
        return (
          <>
            <EmployeeSelectField />
            <FormInput label="培训名称" field="trainingName" rules={[{ required: true }]}>
              <Input />
            </FormInput>
            <FormInput label="开始日期" field="startDate">
              <DatePicker style={{ width: '100%' }} />
            </FormInput>
            <FormInput label="结束日期" field="endDate">
              <DatePicker style={{ width: '100%' }} />
            </FormInput>
            <FormInput label="培训内容" field="content">
              <Input.TextArea rows={3} />
            </FormInput>
            <FormInput label="考核结果" field="result">
              <Input />
            </FormInput>
          </>
        );
      case 'transfers':
        return (
          <>
            <EmployeeSelectField />
            <FormInput label="调动类型" field="transferType" rules={[{ required: true }]}>
              <Select style={{ width: '100%' }} options={[
                { label: '部门调动', value: 'department' },
                { label: '岗位调动', value: 'position' },
                { label: '晋升', value: 'promotion' },
                { label: '降职', value: 'demotion' },
                { label: '其他', value: 'other' },
              ]} />
            </FormInput>
            <FormInput label="生效日期" field="effectiveDate">
              <DatePicker style={{ width: '100%' }} />
            </FormInput>
            <FormInput label="调动原因" field="reason">
              <Input.TextArea rows={2} />
            </FormInput>
          </>
        );
      default:
        return null;
    }
  };

  const columns = [
    ...renderColumns(),
    {
      title: '操作',
      width: 240,
      fixed: 'right',
      render: (_: any, row: any) => (
        <Space>
          {row.status === 'draft' && (
            <Button type="text" size="small" onClick={() => handleSubmitApproval(row.id)}>
              提交审批
            </Button>
          )}
          <Button type="text" size="small" onClick={() => handleEdit(row)}>
            编辑
          </Button>
          <Popconfirm
            title="确定删除吗？"
            onOk={() => handleDelete(row.id)}
          >
            <Button type="text" size="small" status="danger">
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
      <PageContainer title="员工事务">
        <div>
          <div className="flex justify-between mb-4">
            <div />
            <Space>
              <Button type="primary" icon={<IconPlus />} onClick={handleCreate}>
                新建
              </Button>
            </Space>
          </div>

      <Tabs activeTab={activeKey} onChange={setActiveKey}>
        {TX_TYPES.map((t) => (
          <Tabs.TabPane key={t.key} title={t.label} />
        ))}
      </Tabs>

      <Table
        rowKey="id"
        loading={loading}
        columns={columns as any}
        data={data?.list || []}
        pagination={{
          current: page,
          pageSize,
          total: data?.total || 0,
          showTotal: true,
          sizeCanChange: true,
          onChange: (p, ps) => {
            setPage(p);
            setPageSize(ps);
          },
        }}
      />

      <Modal
        title={editingId ? '编辑' : '新建'}
        visible={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
      >
        <Form form={form} layout="vertical">
          {renderFormFields()}
          <FormInput label="备注" field="remark">
            <Input.TextArea rows={2} />
          </FormInput>
        </Form>
      </Modal>
        </div>
      </PageContainer>
  );
}
