'use client';

import { useState, useMemo } from 'react';
import { Tabs, Button, Space, Modal, Form, Input, Select, DatePicker, InputNumber, Message, Popconfirm, Upload, Grid as ArcoGrid } from '@arco-design/web-react';
import { employeeApi } from '@/services/employee';
import StatusTag from '@/components/StatusTag';
import PageContainer from '@/components/PageContainer';
import ProTable, { ProTableColumn } from '@/components/ProTable';
import { PermissionGate } from '@/components/PermissionGate';
import { notifyError } from '@/lib/request';
import { formatDate } from '@/lib/format';
import { useCachedData } from '@/hooks/use-cached-data';
import { usePermission } from '@/hooks/use-permission';
import { useDepartments, usePositions } from '@/hooks/use-departments';
import { fetchAllPages } from '@/lib/fetch-all';
import { buildTxColumns, type TxKey } from '../lib/tx-columns';

const TX_TYPES: { key: TxKey; label: string }[] = [
  { key: 'onboardings', label: '入职办理' },
  { key: 'resignations', label: '离职申请' },
  { key: 'probations', label: '转正申请' },
  { key: 'contracts', label: '合同管理' },
  { key: 'attendance-appeals', label: '考勤申诉' },
  { key: 'certificates', label: '员工证书' },
  { key: 'rewards', label: '奖惩记录' },
  { key: 'trainings', label: '培训记录' },
  { key: 'transfers', label: '调动记录' },
];

/**
 * 各页签写操作（新建/编辑/删除/提交审批）对应的后端权限点，
 * 逐一对齐 employee-tx.controller.ts 的 @RequirePermission：
 * 离职页签后端用 resignation:apply，申诉页签用 attendance:appeal:apply。
 */
const TX_WRITE_CODE: Record<TxKey, string> = {
  onboardings: 'onboarding:manage',
  resignations: 'resignation:apply',
  probations: 'probation:manage',
  contracts: 'contract:manage',
  'attendance-appeals': 'attendance:appeal:apply',
  certificates: 'certificate:manage',
  rewards: 'reward:manage',
  trainings: 'training:manage',
  transfers: 'transfer:manage',
};

/** Arco Tabs 的 onChange 只给到 string，此处按白名单收窄，避免直接断言 */
function isTxKey(k: string): k is TxKey {
  return TX_TYPES.some((t) => t.key === k);
}

/** 通用状态文案：按英文 value 映射，杜绝英文状态直出 */
const STATUS_TEXT: Record<string, { text: string; color: string }> = {
  draft: { text: '草稿', color: 'default' },
  pending: { text: '审批中', color: 'warning' },
  approved: { text: '已通过', color: 'success' },
  rejected: { text: '已拒绝', color: 'danger' },
  cancelled: { text: '已取消', color: 'default' },
  completed: { text: '已完成', color: 'success' },
  success: { text: '已通过', color: 'success' },
  active: { text: '生效中', color: 'success' },
  expired: { text: '已到期', color: 'warning' },
  finished: { text: '已完成', color: 'success' },
  withdrawn: { text: '已撤回', color: 'default' },
  revoked: { text: '已作废', color: 'default' },
};

/** 各流程对通用状态的文案微调 */
const TYPE_LABEL: Record<string, Record<string, string>> = {
  onboardings: { approved: '已完成' },
  contracts: { approved: '已生效' },
  rewards: { approved: '已生效' },
  trainings: { pending: '进行中', approved: '已完成' },
};

// 交易状态标签统一走公共 StatusTag；为避免与导入的公共组件同名，本地包装命名为 TxStatusTag
function TxStatusTag({ type, status }: { type: string; status: string }) {
  const overridden = TYPE_LABEL[type]?.[status];
  const base = STATUS_TEXT[status] || { text: status, color: 'default' };
  return <StatusTag status={status} statusMap={{ [status]: { label: overridden ?? base.text, color: base.color } }} />;
}

/** 页签标题：待处理数大于 0 时显示圆形数字徽标 */
function TabTitle({ label, count }: { label: string; count: number }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span>{label}</span>
      {count > 0 && <span className="tx-count-badge">{count > 99 ? '99+' : count}</span>}
    </span>
  );
}

const FormInput = Form.Item;

export default function EmployeeTransactions() {
  const { can } = usePermission();
  const [activeKey, setActiveKey] = useState<TxKey>('onboardings');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form] = Form.useForm();
  // 合同续签/终止弹窗
  const [renewVisible, setRenewVisible] = useState(false);
  const [renewTarget, setRenewTarget] = useState<any>(null);
  const [renewForm] = Form.useForm();
  const [termVisible, setTermVisible] = useState(false);
  const [termTarget, setTermTarget] = useState<any>(null);
  const [termForm] = Form.useForm();

  // 员工下拉参考数据：共享缓存，跨组件去重；后端 pageSize 上限 100，翻页取全量避免缺人
  const { data: empRes } = useCachedData<{
    code: number;
    data?: { list: { id: number; name: string; employeeNo: string }[] };
  }>(
    'employee:all-options',
    async () => {
      let code = 0;
      const list = await fetchAllPages<{ id: number; name: string; employeeNo: string }>(
        async (page, pageSize) => {
          const result = await employeeApi.getList({ page, pageSize });
          code = result.code;
          return { list: result.data?.list ?? [], total: result.data?.total ?? 0 };
        },
      );
      return { code, data: { list } };
    },
    { staleTime: 60_000 },
  );
  const allList = empRes?.code === 0 && empRes.data ? empRes.data.list ?? [] : [];
  const employeeMap: Record<number, { name: string; employeeNo: string }> = {};
  allList.forEach((e) => { employeeMap[e.id] = { name: e.name, employeeNo: e.employeeNo }; });

  const employeeOptions = useMemo(
    () =>
      Object.entries(employeeMap)
        .map(([id, e]) => ({ value: Number(id), label: `${e.name}（${e.employeeNo}）` }))
        .sort((a, b) => String(a.label).localeCompare(String(b.label))),
    [employeeMap],
  );

  /** 员工姓名（含工号）解析，供弹窗标题等组件级使用 */
  const empLabel = (id: unknown) => {
    const e = employeeMap[Number(id)];
    return e ? `${e.name}（${e.employeeNo}）` : String(id ?? '-');
  };

  // 部门/岗位引用数据：用于入职栏目的部门/职位名称展示
  const { departments } = useDepartments();
  const { positions } = usePositions();
  const deptMap = useMemo(() => new Map(departments.map((d) => [d.id, d.name])), [departments]);
  const posMap = useMemo(() => new Map(positions.map((p) => [p.id, p.name])), [positions]);

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

  // SWR 缓存：切换页签/翻页即重新订阅；同参数复用缓存
  const cacheKey = `employee:tx:${activeKey}:${page}:${pageSize}`;
  const { data: res, loading, revalidate } = useCachedData<{
    code: number;
    data?: { list: any[]; total: number };
  }>(
    cacheKey,
    () => employeeApi.getTxList(activeKey, { page, pageSize }),
    { staleTime: 30_000 },
  );
  const data = res?.code === 0 && res.data ? res.data : { list: [], total: 0 };

  // 各页签待处理数（draft+pending）：一次请求拉全量，供页签徽标
  const { data: countsRes, revalidate: revalidateCounts } = useCachedData<{
    code: number;
    data?: Record<string, number>;
  }>(
    'employee:tx-pending-counts',
    () => employeeApi.getTxPendingCounts(),
    { staleTime: 30_000 },
  );
  const pendingCounts = countsRes?.code === 0 && countsRes.data ? countsRes.data : {};

  // 当前页签的写操作权限点：转正页签的「提交审批」后端单独要求 probation:apply
  const writeCode = TX_WRITE_CODE[activeKey];
  const submitCode = activeKey === 'probations' ? 'probation:apply' : writeCode;

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
      revalidate();
      revalidateCounts();
    } catch (e) {
      notifyError(e, '操作失败');
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await employeeApi.deleteTx(activeKey, id);
      Message.success('删除成功');
      revalidate();
      revalidateCounts();
    } catch (e) {
      notifyError(e, '删除失败');
    }
  };

  const openRenew = (row: any) => {
    setRenewTarget(row);
    renewForm.setFieldsValue({
      type: row.type ?? 'fixed_term',
      contractNo: '',
      startDate: row.endDate ? formatDate(row.endDate) : '',
      endDate: '',
      salary: row.salary ?? undefined,
      position: row.position ?? undefined,
    });
    setRenewVisible(true);
  };

  const handleRenew = async () => {
    if (!renewTarget) return;
    try {
      const values = await renewForm.validate();
      await employeeApi.renewContract(renewTarget.id, values);
      Message.success('续签成功');
      setRenewVisible(false);
      revalidate();
    } catch (e) {
      notifyError(e, '续签失败');
    }
  };

  const openTerminate = (row: any) => {
    setTermTarget(row);
    termForm.resetFields();
    termForm.setFieldsValue({ terminationDate: formatDate(new Date()) });
    setTermVisible(true);
  };

  const handleTerminate = async () => {
    if (!termTarget) return;
    try {
      const values = await termForm.validate();
      await employeeApi.terminateContract(termTarget.id, values);
      Message.success('已终止合同');
      setTermVisible(false);
      revalidate();
    } catch (e) {
      notifyError(e, '终止失败');
    }
  };

  const handleSubmitApproval = async (id: number) => {
    try {
      await employeeApi.submitTx(activeKey, id, `${activeKey}_workflow`);
      Message.success('已提交审批');
      revalidate();
      revalidateCounts();
    } catch (e) {
      notifyError(e, '提交失败');
    }
  };

  const columns = useMemo<ProTableColumn[]>(() => {
    const statusCol: ProTableColumn = {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (v: string) => <TxStatusTag type={activeKey} status={v} />,
    };

    const ctx = {
      empName: (id: unknown) => {
        const e = employeeMap[Number(id)];
        return e ? `${e.name}（${e.employeeNo}）` : String(id ?? '-');
      },
      deptName: (id: unknown) => deptMap.get(Number(id)) ?? '-',
      posName: (id: unknown) => posMap.get(Number(id)) ?? '-',
      fmtDate: (v: unknown) => formatDate(v as string),
    };

    return [
      ...buildTxColumns(activeKey, ctx),
      statusCol,
      {
        title: '操作',
        dataIndex: 'operation',
        key: 'operation',
        width: activeKey === 'contracts' ? 320 : 240,
        fixed: 'right',
        render: (_: any, row: any) => (
          <Space>
            {row.status === 'draft' && (
              <PermissionGate code={submitCode}>
                <Button type="text" size="small" onClick={() => handleSubmitApproval(row.id)}>
                  提交审批
                </Button>
              </PermissionGate>
            )}
            {activeKey === 'contracts' && row.status !== 'terminated' && row.status !== 'expired' && (
              <PermissionGate code="contract:manage">
                <>
                  <Button type="text" size="small" onClick={() => openRenew(row)}>
                    续签
                  </Button>
                  <Button type="text" size="small" status="danger" onClick={() => openTerminate(row)}>
                    终止
                  </Button>
                </>
              </PermissionGate>
            )}
            <PermissionGate code={writeCode}>
              <Button type="text" size="small" onClick={() => handleEdit(row)}>
                编辑
              </Button>
              <Popconfirm title="确定删除吗？" onOk={() => handleDelete(row.id)}>
                <Button type="text" size="small" status="danger">
                  删除
                </Button>
              </Popconfirm>
            </PermissionGate>
          </Space>
        ),
      },
    ];
  }, [activeKey, employeeMap, deptMap, posMap, openRenew, openTerminate, writeCode, submitCode]);

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
          <ArcoGrid.Row gutter={16}>
            <ArcoGrid.Col span={12}>
              <EmployeeSelectField />
            </ArcoGrid.Col>
            <ArcoGrid.Col span={12}>
              <FormInput label="合同类型" field="type" rules={[{ required: true }]}>
                <Select style={{ width: '100%' }} options={[
                  { label: '固定期限', value: 'fixed_term' },
                  { label: '无固定期限', value: 'open_ended' },
                  { label: '试用期', value: 'probation' },
                  { label: '实习', value: 'internship' },
                ]} />
              </FormInput>
            </ArcoGrid.Col>
            <ArcoGrid.Col span={12}>
              <FormInput
                label="合同编号"
                field="contractNo"
                extra="留空则按 CT-年月-序号 规则自动生成"
              >
                <Input placeholder="自动生成，如 CT-2026-0001" />
              </FormInput>
            </ArcoGrid.Col>
            <ArcoGrid.Col span={12}>
              <FormInput label="开始日期" field="startDate" rules={[{ required: true }]}>
                <DatePicker style={{ width: '100%' }} />
              </FormInput>
            </ArcoGrid.Col>
            <ArcoGrid.Col span={12}>
              <FormInput label="结束日期" field="endDate">
                <DatePicker style={{ width: '100%' }} />
              </FormInput>
            </ArcoGrid.Col>
            <ArcoGrid.Col span={12}>
              <FormInput label="合同薪资（元/月）" field="salary">
                <InputNumber style={{ width: '100%' }} min={0} />
              </FormInput>
            </ArcoGrid.Col>
            <ArcoGrid.Col span={12}>
              <FormInput label="岗位" field="position">
                <Input />
              </FormInput>
            </ArcoGrid.Col>
            <ArcoGrid.Col span={12}>
              <FormInput label="合同附件" field="attachmentUrl">
                <Upload
                  name="file"
                  autoUpload={false}
                  showUploadList={false}
                  beforeUpload={async (file: File) => {
                    try {
                      const res = await employeeApi.uploadContractFile(file);
                      if (res.code === 0 && res.data?.url) {
                        form.setFieldValue('attachmentUrl', res.data.url);
                        Message.success('附件上传成功');
                      } else {
                        notifyError(res, '附件上传失败');
                      }
                    } catch (e) {
                      notifyError(e, '附件上传失败');
                    }
                    return false;
                  }}
                >
                  <Button>选择附件</Button>
                </Upload>
                {form.getFieldValue('attachmentUrl') ? (
                  <div className="mt-1 text-xs text-text-3">
                    已上传：{String(form.getFieldValue('attachmentUrl')).split('/').pop()}
                  </div>
                ) : null}
              </FormInput>
            </ArcoGrid.Col>
          </ArcoGrid.Row>
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

  return (
    <PageContainer>
      <Tabs
        activeTab={activeKey}
        onChange={(k) => { if (isTxKey(k)) setActiveKey(k); }}
        className="mb-4"
      >
        {TX_TYPES.map((t) => (
          <Tabs.TabPane
            key={t.key}
            title={<TabTitle label={t.label} count={pendingCounts[t.key] ?? 0} />}
          />
        ))}
      </Tabs>

      <ProTable
        columns={columns}
        data={data.list ?? []}
        rowKey="id"
        loading={loading}
        // 新建为各页签的写操作入口，无对应权限点不渲染
        toolbar={
          can(writeCode)
            ? [
                { key: 'create', label: '新建', type: 'primary' as const, onClick: handleCreate },
              ]
            : []
        }
        pagination={{ current: page, pageSize, total: data.total ?? 0 }}
        onPageChange={(p, ps) => {
          setPage(p);
          setPageSize(ps);
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

      {/* 合同续签弹窗 */}
      <Modal
        title={`续签合同${renewTarget ? `：${empLabel(renewTarget.employeeId)}` : ''}`}
        visible={renewVisible}
        onOk={handleRenew}
        onCancel={() => setRenewVisible(false)}
      >
        <Form form={renewForm} layout="vertical">
          <ArcoGrid.Row gutter={16}>
            <ArcoGrid.Col span={12}>
              <FormInput label="合同类型" field="type" rules={[{ required: true }]}>
                <Select style={{ width: '100%' }} options={[
                  { label: '固定期限', value: 'fixed_term' },
                  { label: '无固定期限', value: 'open_ended' },
                  { label: '试用期', value: 'probation' },
                  { label: '实习', value: 'internship' },
                ]} />
              </FormInput>
            </ArcoGrid.Col>
            <ArcoGrid.Col span={12}>
              <FormInput label="合同编号" field="contractNo" extra="留空则自动生成">
                <Input placeholder="自动生成，如 CT-2026-0002" />
              </FormInput>
            </ArcoGrid.Col>
            <ArcoGrid.Col span={12}>
              <FormInput label="开始日期" field="startDate" rules={[{ required: true }]}>
                <DatePicker style={{ width: '100%' }} />
              </FormInput>
            </ArcoGrid.Col>
            <ArcoGrid.Col span={12}>
              <FormInput label="结束日期" field="endDate">
                <DatePicker style={{ width: '100%' }} />
              </FormInput>
            </ArcoGrid.Col>
            <ArcoGrid.Col span={12}>
              <FormInput label="合同薪资（元/月）" field="salary">
                <InputNumber style={{ width: '100%' }} min={0} />
              </FormInput>
            </ArcoGrid.Col>
            <ArcoGrid.Col span={12}>
              <FormInput label="岗位" field="position">
                <Input />
              </FormInput>
            </ArcoGrid.Col>
          </ArcoGrid.Row>
        </Form>
      </Modal>

      {/* 合同终止/解除弹窗 */}
      <Modal
        title={`终止合同${termTarget ? `：${empLabel(termTarget.employeeId)}` : ''}`}
        visible={termVisible}
        onOk={handleTerminate}
        onCancel={() => setTermVisible(false)}
      >
        <Form form={termForm} layout="vertical">
          <FormInput label="终止日期" field="terminationDate" rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} />
          </FormInput>
          <FormInput label="终止说明" field="remark">
            <Input.TextArea
              rows={3}
              placeholder="如：双方协商解除 / 合同到期不再续签"
            />
          </FormInput>
        </Form>
      </Modal>
    </PageContainer>
  );
}