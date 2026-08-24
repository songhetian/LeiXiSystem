'use client';

import { useState, useMemo } from 'react';
import {
  Message,
  Modal,
  Input,
  Button,
  Tag,
  Space,
  Descriptions,
  Avatar,
} from '@arco-design/web-react';
import PageContainer from '@/components/PageContainer';
import ProTable, { ProTableColumn, ProTableToolbarAction } from '@/components/ProTable';
import StatusTag from '@/components/StatusTag';
import { useCachedData } from '@/hooks/use-cached-data';
import {
  attendanceApi,
  AttendanceAuditRow,
  AttendanceAuditResult,
} from '@/services/attendance';
import { approvalApi, ApprovalActionParams } from '@/services/approval';
import { useDepartments } from '@/hooks/use-departments';
import { SearchFieldConfig } from '@/components/SearchForm';
import { usePermission } from '@/hooks/use-permission';
import { exportToExcel } from '@/lib/excel';

// 批次六 · 考勤申请聚合审计（对齐参考 CompensatoryApproval 的审批人审计信息层级）
const statusMap: Record<string, { label: string; color: string }> = {
  draft: { label: '草稿', color: 'gray' },
  pending: { label: '待提交', color: 'gray' },
  approving: { label: '审批中', color: 'arcoblue' },
  approved: { label: '已通过', color: 'green' },
  rejected: { label: '已拒绝', color: 'red' },
  cancelled: { label: '已取消', color: 'gray' },
};

const recordTypeMap: Record<string, string> = {
  leave: '请假',
  overtime: '加班',
};

const baseSearchFields: SearchFieldConfig[] = [
  {
    key: 'recordType',
    label: '申请类型',
    type: 'select',
    placeholder: '全部类型',
    options: [
      { value: 'all', label: '全部类型' },
      { value: 'leave', label: '请假' },
      { value: 'overtime', label: '加班' },
    ],
  },
  {
    key: 'status',
    label: '状态',
    type: 'select',
    placeholder: '全部状态',
    options: [
      { value: 'all', label: '全部状态' },
      { value: 'approving', label: '审批中' },
      { value: 'approved', label: '已通过' },
      { value: 'rejected', label: '已拒绝' },
      { value: 'cancelled', label: '已取消' },
    ],
  },
  { key: 'keyword', label: '姓名/工号', type: 'input', placeholder: '输入姓名或工号' },
  { key: 'startDate', label: '开始日期', type: 'date', placeholder: '请选择日期', span: 4 },
  { key: 'endDate', label: '结束日期', type: 'date', placeholder: '请选择日期', span: 4 },
];

export default function VacationAuditPage() {
  const { can } = usePermission();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [searchParams, setSearchParams] = useState<Record<string, any>>({});
  const { departments } = useDepartments();

  // 审计详情弹窗
  const [detailVisible, setDetailVisible] = useState(false);
  const [current, setCurrent] = useState<AttendanceAuditRow | null>(null);
  const [approvalNote, setApprovalNote] = useState('');
  const [processing, setProcessing] = useState<string | null>(null);

  const searchFields = useMemo<SearchFieldConfig[]>(
    () => [
      {
        key: 'departmentId',
        label: '部门',
        type: 'select',
        placeholder: '全部部门',
        options: departments.map((d) => ({ value: d.id, label: d.name })),
      },
      ...baseSearchFields,
    ],
    [departments],
  );

  const cacheKey = `attendance:audit:${JSON.stringify({ page, pageSize, search: searchParams })}`;
  const { data: result, loading, error, revalidate } = useCachedData<AttendanceAuditResult>(
    cacheKey,
    () => attendanceApi.getAuditList({ page, pageSize, ...searchParams }),
    { staleTime: 15_000 },
  );

  const data = (result?.data?.list ?? []).map((r) => ({ ...r, uid: `${r.recordType}-${r.id}` }));
  const pagination = { current: page, pageSize, total: result?.data?.total ?? 0 };

  const handleSearch = (values: Record<string, any>) => {
    setSearchParams(values);
    setPage(1);
  };
  const handleReset = () => {
    setSearchParams({});
    setPage(1);
  };
  const handlePageChange = (current: number, size: number) => {
    setPage(current);
    setPageSize(size);
  };

  // 打开审计弹窗
  const openDetail = (record: AttendanceAuditRow) => {
    setCurrent(record);
    setApprovalNote('');
    setDetailVisible(true);
  };

  // 审批决策：通过 / 驳回（复用审批实例端点）
  const handleAction = async (action: 'approve' | 'reject') => {
    if (!current) return;
    if (action === 'reject' && !approvalNote.trim()) {
      Message.error('请填写驳回理由');
      return;
    }
    const instanceId = current.approvalInstanceId;
    if (!instanceId) {
      Message.error('该记录未关联审批实例，无法审批');
      return;
    }
    setProcessing(action);
    try {
      const params: ApprovalActionParams = {
        comment: approvalNote || (action === 'approve' ? '批准' : '拒绝'),
      };
      const res =
        action === 'approve'
          ? await approvalApi.approve(instanceId, params)
          : await approvalApi.reject(instanceId, params);
      if (res.code === 0) {
        Message.success(`已${action === 'approve' ? '通过' : '驳回'}`);
        setDetailVisible(false);
        await revalidate();
      } else {
        Message.error(res.message || '操作失败');
      }
    } catch (e: any) {
      Message.error(e?.message || '操作失败');
    } finally {
      setProcessing(null);
    }
  };

  // 导出 Excel（前端本地导出当前筛选全量）
  const handleExport = async () => {
    try {
      const res = await attendanceApi.getAuditList({ page: 1, pageSize: 10000, ...searchParams });
      const list = (res.data?.list ?? []) as AttendanceAuditRow[];
      if (!exportToExcel(
        `考勤审计_${new Date().toISOString().slice(0, 10)}.xlsx`,
        '考勤审计',
        [
          { title: '类型', value: (r: AttendanceAuditRow) => recordTypeMap[r.recordType] ?? r.recordType },
          { title: '工号', dataIndex: 'employeeNo' },
          { title: '姓名', dataIndex: 'employeeName' },
          { title: '部门', dataIndex: 'departmentName' },
          {
            title: '业务内容',
            value: (r: AttendanceAuditRow) =>
              r.recordType === 'leave'
                ? `${r.businessTypeName} ${(r.startDate ?? '').slice(0, 10)}~${(r.endDate ?? '').slice(0, 10)} (${r.days}天)`
                : `加班 ${(r.overtimeDate ?? '').slice(0, 10)} (${r.hours}小时)`,
          },
          { title: '原因', dataIndex: 'reason' },
          { title: '提交时间', dataIndex: 'createdAt' },
          { title: '状态', value: (r: AttendanceAuditRow) => statusMap[r.status]?.label ?? r.status },
        ],
        list,
      )) {
        Message.info('当前没有可导出的审计记录');
      }
    } catch {
      Message.error('导出失败');
    }
  };

  const columns: ProTableColumn[] = [
    { title: '类型', dataIndex: 'recordType', width: 80, render: (v: string) => <Tag color={v === 'leave' ? 'arcoblue' : 'purple'}>{recordTypeMap[v] || v}</Tag> },
    { title: '姓名', dataIndex: 'employeeName', width: 100 },
    { title: '工号', dataIndex: 'employeeNo', width: 100 },
    { title: '部门', dataIndex: 'departmentName', width: 120 },
    {
      title: '业务内容',
      dataIndex: 'detail',
      width: 220,
      render: (_: any, r: AttendanceAuditRow) =>
        r.recordType === 'leave'
          ? `${r.businessTypeName || '请假'} ${(r.startDate ?? '').slice(0, 10)} ~ ${(r.endDate ?? '').slice(0, 10)} · ${r.days ?? '-'}天`
          : `加班 ${(r.overtimeDate ?? '').slice(0, 10)} · ${r.hours ?? '-'}小时`,
    },
    { title: '原因', dataIndex: 'reason', width: 180, ellipsis: true },
    { title: '提交时间', dataIndex: 'createdAt', width: 170 },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (value: string) => <StatusTag status={value} statusMap={statusMap} />,
    },
    {
      title: '操作',
      dataIndex: 'actions',
      width: 100,
      render: (_: any, record: AttendanceAuditRow) => (
        <Space>
          <Button size="small" type="text" onClick={() => openDetail(record)}>审计</Button>
        </Space>
      ),
    },
  ];

  const toolbar: ProTableToolbarAction[] = [
    { key: 'export', label: '导出 Excel', onClick: handleExport, disabled: !can('attendance:view') },
  ];

  const canDecide = current !== null && current.status === 'approving' && !!current.approvalInstanceId;

  return (
    <PageContainer title="考勤申请审计">
      <ProTable
        columns={columns}
        data={data}
        rowKey="uid"
        loading={loading}
        error={error}
        onRetry={revalidate}
        searchFields={searchFields}
        onSearch={handleSearch}
        onReset={handleReset}
        toolbar={toolbar}
        pagination={pagination}
        onPageChange={handlePageChange}
      />

      <Modal
        title="考勤申请审计"
        visible={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={null}
      >
        {current && (
          <div className="space-y-5">
            {/* 申请人基本身份 */}
            <div className="flex items-center gap-3 p-4 rounded-lg bg-gray-50">
              <Avatar size={40} style={{ backgroundColor: '#2455D9', color: '#fff' }}>
                {current.employeeName?.charAt(0) || '?'}
              </Avatar>
              <div>
                <div className="font-medium text-text-1">{current.employeeName}</div>
                <div className="text-xs text-text-3">
                  {current.departmentName} · #{current.employeeNo}
                </div>
              </div>
            </div>

            {/* 申请内容 */}
            <Descriptions
              column={2}
              title="申请内容"
              size="small"
              data={[
                { label: '申请类型', value: recordTypeMap[current.recordType] || current.recordType },
                { label: '业务类型', value: current.businessTypeName || '-' },
                ...(current.recordType === 'leave'
                  ? [
                      { label: '开始日期', value: current.startDate ? current.startDate.slice(0, 10) : '-' },
                      { label: '结束日期', value: current.endDate ? current.endDate.slice(0, 10) : '-' },
                      { label: '天数', value: `${current.days ?? '-'} 天` },
                    ]
                  : [
                      { label: '加班日期', value: current.overtimeDate ? current.overtimeDate.slice(0, 10) : '-' },
                      { label: '加班时长', value: `${current.hours ?? '-'} 小时` },
                    ]),
                { label: '申请原因', value: current.reason || '未填写' },
                { label: '提交时间', value: current.createdAt },
              ]}
            />

            {/* 审批决策 */}
            {canDecide ? (
              <div className="pt-2">
                <div className="mb-2 text-sm font-medium text-text-1">审计审批决策</div>
                <Input.TextArea
                  value={approvalNote}
                  onChange={setApprovalNote}
                  placeholder="请输入审批备注（驳回时必填）"
                  autoSize={{ minRows: 3, maxRows: 5 }}
                />
                <div className="flex justify-end gap-3 mt-4">
                  <Button
                    status="danger"
                    loading={processing === 'reject'}
                    onClick={() => handleAction('reject')}
                  >
                    驳回
                  </Button>
                  <Button
                    type="primary"
                    loading={processing === 'approve'}
                    onClick={() => handleAction('approve')}
                  >
                    通过
                  </Button>
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-lg bg-gray-50 flex items-center justify-between">
                <Tag color={current.status === 'approved' ? 'green' : 'red'} size="medium">
                  {statusMap[current.status]?.label || current.status}
                </Tag>
                <span className="text-xs text-text-3">{current.approvalNote || '无审批备注'}</span>
              </div>
            )}
          </div>
        )}
      </Modal>
    </PageContainer>
  );
}