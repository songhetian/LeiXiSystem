'use client';

import { useState, useMemo, useRef } from 'react';
import { Message, Button, Space, Modal, Form, Input } from '@arco-design/web-react';
import PageContainer from '@/components/PageContainer';
import ProTable, { ProTableColumn, ProTableToolbarAction } from '@/components/ProTable';
import StatusTag from '@/components/StatusTag';
import ModalForm, { FormFieldConfig } from '@/components/ModalForm';
import EmployeeDetailModal from '@/features/employee/components/EmployeeDetailModal';
import EmployeeTagPill from '@/features/employee/components/EmployeeTagPill';
import { PermissionGate } from '@/components/PermissionGate';
import { employeeApi, employeeTagApi, Employee, EmployeeListParams, EmployeeTagLite } from '@/services/employee';
import { useDepartments, usePositions } from '@/hooks/use-departments';
import { usePermission } from '@/hooks/use-permission';
import { useCachedData } from '@/hooks/use-cached-data';
import { SearchFieldConfig } from '@/components/SearchForm';
import { exportToExcel } from '@/lib/excel';
import { fetchAllPages } from '@/lib/fetch-all';
import { formatDate, todayStr } from '@/lib/format';
import { getApiErrorMessage } from '@/lib/api-error';

const baseSearchFields: SearchFieldConfig[] = [
  { key: 'keyword', label: '姓名', type: 'employee', placeholder: '搜索员工姓名或工号' },
  {
    key: 'status',
    label: '状态',
    type: 'select',
    placeholder: '请选择状态',
    options: [
      { value: 'active', label: '在职' },
      { value: 'inactive', label: '离职' },
      { value: 'resigned', label: '已离职' },
    ],
  },
  {
    key: 'rating',
    label: '职级',
    type: 'select',
    placeholder: '请选择职级',
    options: [1, 2, 3, 4, 5].map((n) => ({ value: n, label: `${n} 星` })),
  },
  {
    key: 'departmentId',
    label: '部门',
    type: 'select',
    placeholder: '请选择部门',
    options: [],
  },
  {
    key: 'positionId',
    label: '岗位',
    type: 'select',
    placeholder: '请选择岗位',
    options: [],
  },
  { key: 'hireDate', label: '入职时间', type: 'range', placeholder: '请选择入职时间范围' },
];

/** 搜索表单值 → 列表接口参数（入职时间区间映射为 dateFrom/dateTo） */
export function toEmployeeListQuery(values: Record<string, any>): EmployeeListParams {
  const { hireDate, ...rest } = values;
  const query: EmployeeListParams = { ...rest };
  // 范围选择产出 [start, end]，两元素均为字符串时才映射为接口认识的 dateFrom/dateTo
  if (
    Array.isArray(hireDate) &&
    hireDate.length === 2 &&
    typeof hireDate[0] === 'string' &&
    typeof hireDate[1] === 'string'
  ) {
    query.dateFrom = hireDate[0];
    query.dateTo = hireDate[1];
  }
  return query;
}

function buildFormFields(
  departments: { id: number; name: string }[],
  positions: { id: number; name: string }[],
  tags: { id: number; name: string }[],
  isEdit: boolean,
): FormFieldConfig[] {
  return [
    // 工号可留空，由服务端自动生成（对齐老项目 EMP + 递增序号）
    { key: 'employeeNo', label: '工号', type: 'input', placeholder: '留空则自动生成' },
    { key: 'name', label: '姓名', type: 'input', required: true, placeholder: '请输入姓名' },
    {
      key: 'departmentId',
      label: '部门',
      type: 'select',
      required: true,
      placeholder: '请选择部门',
      options: departments.map((d) => ({ value: d.id, label: d.name })),
    },
    {
      key: 'positionId',
      label: '职位',
      type: 'select',
      required: true,
      placeholder: '请选择职位',
      options: positions.map((p) => ({ value: p.id, label: p.name })),
    },
    { key: 'hireDate', label: '入职日期', type: 'date', required: true, placeholder: '请选择入职日期' },
    { key: 'phone', label: '手机号', type: 'input', required: true, placeholder: '请输入手机号' },
    { key: 'salary', label: '基本工资', type: 'input', required: true, placeholder: '请输入基本工资' },
    // 薪资生效月：仅在编辑可指定（默认次月生效；新增时的薪资为初始工资，无需生效月）
    ...(isEdit
      ? [{
          key: 'effectiveMonth',
          label: '薪资生效月',
          type: 'month' as const,
          placeholder: '留空则默认次月生效',
        }]
      : []),
    {
      key: 'rating',
      label: '职级',
      type: 'select',
      placeholder: '请选择职级',
      options: [1, 2, 3, 4, 5].map((n) => ({ value: n, label: `${n} 星` })),
    },
    { key: 'emergencyContact', label: '紧急联系人', type: 'input', placeholder: '请输入紧急联系人' },
    { key: 'emergencyPhone', label: '紧急联系电话', type: 'input', placeholder: '请输入紧急联系电话' },
    {
      key: 'education',
      label: '学历',
      type: 'select',
      placeholder: '请选择学历',
      options: ['博士', '硕士', '本科', '大专', '高中', '其他'].map((v) => ({
        value: v,
        label: v,
      })),
    },
    { key: 'address', label: '通讯地址', type: 'input', placeholder: '请输入通讯地址' },
    { key: 'skills', label: '技能特长', type: 'input', placeholder: '请输入技能特长' },
    {
      key: 'tags',
      label: '标签',
      type: 'tags',
      placeholder: '请选择标签',
      options: tags.map((t) => ({ value: t.id, label: t.name })),
    },
    { key: 'remark', label: '备注', type: 'textarea', placeholder: '请输入备注' },
  ];
}

export default function EmployeeListPage() {
  const { can } = usePermission();
  // 写操作按钮统一 PermissionGate 控制：员工新增/编辑/离职/批量操作 → employee:manage
  const canManage = can('employee:manage');
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [searchParams, setSearchParams] = useState<Omit<EmployeeListParams, 'page' | 'pageSize'>>({});
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const [importing, setImporting] = useState(false);

  const [modalVisible, setModalVisible] = useState(false);
  const [modalType, setModalType] = useState<'add' | 'edit'>('add');
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const { departments } = useDepartments();
  const { positions } = usePositions();
  // 拉取所有标签供多选
  const { data: tagRes } = useCachedData(
    'employee-tags:all',
    () => employeeTagApi.list(),
    { staleTime: 300_000 },
  );
  const allTags = useMemo(
    () => (tagRes?.code === 0 && tagRes.data?.list ? tagRes.data.list : []),
    [tagRes],
  );

  // 批量选择
  const [selectedKeys, setSelectedKeys] = useState<(string | number)[]>([]);
  // 姓名 → 详情弹窗（含在职履历）
  const [detailId, setDetailId] = useState<number | null>(null);
  const [detailVisible, setDetailVisible] = useState(false);
  // 批量调整（部门/岗位/职级）
  const [batchVisible, setBatchVisible] = useState(false);
  const [batchSaving, setBatchSaving] = useState(false);
  // 离职确认：纯确认框 + 可选离职原因（日期默认今天）
  const [resignVisible, setResignVisible] = useState(false);
  const [resignEmployee, setResignEmployee] = useState<Employee | null>(null);
  const [resignReason, setResignReason] = useState('');
  const [resignSaving, setResignSaving] = useState(false);

  const formFields = useMemo<FormFieldConfig[]>(
    () => buildFormFields(departments, positions, allTags, modalType === 'edit'),
    [departments, positions, allTags, modalType],
  );

  // 多维度搜索：部门 + 岗位 + 入职时间范围（复用共享缓存的参考数据）
  const searchFields = useMemo<SearchFieldConfig[]>(
    () => baseSearchFields.map((f) => {
      if (f.key === 'departmentId') {
        return { ...f, options: departments.map((d) => ({ value: d.id, label: d.name })) };
      }
      if (f.key === 'positionId') {
        return { ...f, options: positions.map((p) => ({ value: p.id, label: p.name })) };
      }
      return f;
    }),
    [departments, positions],
  );

  // SWR 缓存：参数编入 cacheKey，搜索/翻页即重新订阅；同参数复用缓存
  const cacheKey = `employee:list:${pagination.current}:${pagination.pageSize}:${JSON.stringify(searchParams)}`;
  const { data: res, loading, error, revalidate } = useCachedData<{
    code: number;
    message?: string;
    data?: { list: Employee[]; page: number; pageSize: number; total: number };
  }>(
    cacheKey,
    () => employeeApi.getList({ page: pagination.current, pageSize: pagination.pageSize, ...searchParams }),
    { staleTime: 30_000 },
  );
  const data = res?.code === 0 && res.data ? res.data.list : [];
  const pageResult = res?.code === 0 && res.data
    ? { current: res.data.page, pageSize: res.data.pageSize, total: res.data.total }
    : pagination;

  const handleSearch = (values: Record<string, any>) => {
    setSearchParams(toEmployeeListQuery(values));
    setPagination((p) => ({ ...p, current: 1 }));
  };

  const handleReset = () => {
    setSearchParams({});
    setPagination((p) => ({ ...p, current: 1 }));
  };

  // 导出 Excel：拉取符合当前筛选条件的全部员工
  const handleExport = async () => {
    try {
      // 后端 pageSize 上限 100，写 10000 会被静默截断成第一页：必须翻页取全量
      const list = await fetchAllPages<Employee>(async (page, pageSize) => {
        const res = await employeeApi.getList({ page, pageSize, ...searchParams });
        return { list: (res.data?.list ?? []) as Employee[], total: res.data?.total ?? 0 };
      });
      if (!exportToExcel(
        `员工列表_${todayStr()}.xlsx`,
        '员工列表',
        [
          { title: '工号', dataIndex: 'employeeNo' },
          { title: '姓名', dataIndex: 'name' },
          { title: '部门', dataIndex: 'departmentName' },
          { title: '职位', dataIndex: 'positionName' },
          { title: '入职日期', dataIndex: 'hireDate' },
          { title: '手机号', dataIndex: 'phone' },
          { title: '状态', value: (r: Employee) => (r.status === 'active' ? '在职' : '离职') },
        ],
        list,
      )) {
        Message.info('当前没有可导出的员工数据');
      }
    } catch {
      Message.error('导出失败');
    }
  };

  // 下载导入模板
  const handleDownloadTemplate = async () => {
    try {
      const blob = await employeeApi.downloadImportTemplate();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = '员工导入模板.xlsx';
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      Message.error('模板下载失败');
    }
  };

  // 选择 Excel 文件后上传导入
  const handleImportFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!/\.(xlsx|xls)$/i.test(file.name)) {
      Message.error('请选择 .xlsx / .xls 文件');
      return;
    }
    setImporting(true);
    try {
      const res = await employeeApi.importExcel(file);
      if (res.code === 0) {
        const d = res.data;
        Message.success(`导入完成：成功 ${d?.success ?? 0} 条，失败 ${d?.failed ?? 0} 条`);
        if (d?.errors?.length) {
          Message.warning(`失败明细：${d.errors.slice(0, 3).join('；')}`);
        }
        revalidate();
      } else {
        Message.error(res.message || '导入失败');
      }
    } catch {
      Message.error('导入失败');
    } finally {
      setImporting(false);
    }
  };

  const handlePageChange = (page: number, pageSize: number) => {
    setPagination({ ...pageResult, current: page, pageSize });
  };

  const handleAdd = () => {
    setModalType('add');
    setEditingEmployee(null);
    setModalVisible(true);
  };

  const handleEdit = async (employee: Employee) => {
    setModalType('edit');
    // 列表接口为保护薪资等敏感字段不返回全部数据，编辑统一用 detail 接口取完整数据回显
    setEditingEmployee(null);
    try {
      const res = await employeeApi.getById(employee.id);
      setEditingEmployee(res?.code === 0 && res.data ? res.data : employee);
    } catch {
      setEditingEmployee(employee);
    }
    setModalVisible(true);
  };

  const handleResign = (employee: Employee) => {
    setResignEmployee(employee);
    setResignReason('');
    setResignVisible(true);
  };

  const handleResignCancel = () => {
    if (resignSaving) return;
    setResignVisible(false);
    setResignEmployee(null);
    setResignReason('');
  };

  // 离职确认提交：离职日期默认为今天，附可选离职原因
  const handleResignOk = async () => {
    if (!resignEmployee) return;
    setResignSaving(true);
    try {
      const result = await employeeApi.resign(resignEmployee.id, {
        resignDate: todayStr(),
        reason: resignReason.trim() || undefined,
      });
      if (result.code === 0) {
        Message.success('离职操作成功');
        setResignVisible(false);
        setResignEmployee(null);
        setResignReason('');
        revalidate();
        return;
      }
      Message.error(result.message || '操作失败');
    } catch (e) {
      Message.error(getApiErrorMessage(e, '离职失败'));
    } finally {
      setResignSaving(false);
    }
  };

  const handleModalCancel = () => {
    setModalVisible(false);
    setEditingEmployee(null);
  };

  // 批量状态更新（对齐老项目「一键离职 / 恢复在职」）
  const handleBatchStatus = async (status: 'active' | 'resigned') => {
    if (!selectedKeys.length) {
      Message.info('请先勾选要操作的员工');
      return;
    }
    const ids = selectedKeys.map(Number);
    try {
      const res = await employeeApi.batchUpdateStatus(ids, status);
      if (res.code === 0) {
        const succ = res.data?.success ?? ids.length;
        Message.success(status === 'resigned' ? `已批量离职 ${succ} 人` : `已恢复在职 ${succ} 人`);
        setSelectedKeys([]);
        revalidate();
      } else {
        Message.error(res.message || '操作失败');
      }
    } catch {
      Message.error('批量操作失败');
    }
  };

  // 批量调整部门/岗位/职级
  const handleBatchOpen = () => {
    if (!selectedKeys.length) {
      Message.info('请先勾选要操作的员工');
      return;
    }
    setBatchVisible(true);
  };

  const handleBatchOk = async (values: Record<string, any>) => {
    const data: { departmentId?: number; positionId?: number | null; rating?: number } = {};
    if (values.departmentId !== undefined && values.departmentId !== '') data.departmentId = Number(values.departmentId);
    if (values.positionId !== undefined && values.positionId !== '' && values.positionId !== null) data.positionId = Number(values.positionId);
    if (values.rating !== undefined && values.rating !== '') data.rating = Number(values.rating);
    if (Object.keys(data).length === 0) {
      Message.info('请至少选择一项要调整的信息');
      return;
    }
    const ids = selectedKeys.map(Number);
    setBatchSaving(true);
    try {
      const res = await employeeApi.batchUpdate(ids, data);
      if (res.code === 0) {
        const succ = res.data?.success ?? ids.length;
        Message.success(`已批量调整 ${succ} 人`);
        setBatchVisible(false);
        setSelectedKeys([]);
        revalidate();
      } else {
        Message.error(res.message || '批量调整失败');
      }
    } catch {
      Message.error('批量调整失败');
    } finally {
      setBatchSaving(false);
    }
  };

  const handleViewDetail = (id: number) => {
    setDetailId(id);
    setDetailVisible(true);
  };

  const handleRestore = async (employee: Employee) => {
    try {
      const res = await employeeApi.batchUpdateStatus([employee.id], 'active');
      if (res.code === 0) {
        Message.success('已恢复在职');
        revalidate();
      } else {
        Message.error(res.message || '操作失败');
      }
    } catch {
      Message.error('操作失败');
    }
  };

  const handleModalOk = async (values: Record<string, any>) => {
    setConfirmLoading(true);
    try {
      let result;
      if (modalType === 'add') {
        result = await employeeApi.create({
          employeeNo: values.employeeNo,
          name: values.name,
          departmentId: Number(values.departmentId),
          positionId: Number(values.positionId),
          hireDate: values.hireDate,
          phone: values.phone,
          salary: values.salary !== undefined && values.salary !== '' ? Number(values.salary) : undefined,
          rating: values.rating ? Number(values.rating) : undefined,
          emergencyContact: values.emergencyContact,
          emergencyPhone: values.emergencyPhone,
          address: values.address,
          education: values.education,
          skills: values.skills,
          remark: values.remark,
          tagIds: Array.isArray(values.tags) && values.tags.length ? (values.tags as number[]) : undefined,
        });
      } else {
        result = await employeeApi.update(editingEmployee!.id, {
          name: values.name,
          departmentId: values.departmentId ? Number(values.departmentId) : undefined,
          positionId: values.positionId ? Number(values.positionId) : undefined,
          hireDate: values.hireDate,
          phone: values.phone,
          salary: values.salary !== undefined && values.salary !== '' ? Number(values.salary) : undefined,
          // 薪资生效月：编辑时可选，留空由后端默认次月生效
          effectiveMonth: values.effectiveMonth ? String(values.effectiveMonth) : undefined,
          rating: values.rating ? Number(values.rating) : undefined,
          emergencyContact: values.emergencyContact || null,
          emergencyPhone: values.emergencyPhone || null,
          address: values.address || null,
          education: values.education || null,
          skills: values.skills || null,
          remark: values.remark || null,
          tagIds: Array.isArray(values.tags) ? (values.tags as number[]) : undefined,
        });
      }

      if (result.code === 0) {
        Message.success(modalType === 'add' ? '新增成功' : '修改成功');
        setModalVisible(false);
        revalidate();
      } else {
        Message.error(result.message || '操作失败');
      }
    } finally {
      setConfirmLoading(false);
    }
  };

  const columns: ProTableColumn[] = [
    {
      title: '姓名',
      dataIndex: 'name',
      width: 110,
      render: (value: string, record: Employee) => (
        <Button
          type="text"
          size="small"
          className="lx-link-name"
          data-testid={`btn-detail-${record.id}`}
          onClick={() => handleViewDetail(record.id)}
        >
          {value}
        </Button>
      ),
    },
    { title: '部门', dataIndex: 'departmentName', width: 120 },
    { title: '职位', dataIndex: 'positionName', width: 120 },
    {
      title: '职级',
      dataIndex: 'rating',
      width: 80,
      render: (value: number) => (value ? `${value} 星` : '-'),
    },
    { title: '入职日期', dataIndex: 'hireDate', width: 120, render: (v: string) => formatDate(v) },
    { title: '手机号', dataIndex: 'phone', width: 140 },
    {
      title: '标签',
      dataIndex: 'tags',
      width: 180,
      render: (tags: EmployeeTagLite[] | undefined) =>
        tags && tags.length ? (
          <Space size={4} wrap>
            {tags.map((t) => <EmployeeTagPill key={t.id} tag={t} />)}
          </Space>
        ) : (
          '-'
        ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 80,
      render: (value: string) => <StatusTag status={value} />,
    },
    {
      title: '操作',
      dataIndex: 'action',
      width: 170,
      render: (_: any, record: Employee) => (
        <PermissionGate code="employee:manage">
          <Space>
            <Button
              type="text"
              size="small"
              onClick={() => handleEdit(record)}
              data-testid={`btn-edit-${record.id}`}
            >
              编辑
            </Button>
            {record.status === 'active' && (
              <Button
                type="text"
                size="small"
                status="danger"
                onClick={() => handleResign(record)}
                data-testid={`btn-resign-${record.id}`}
              >
                离职
              </Button>
            )}
            {record.status === 'resigned' && (
              <Button
                type="text"
                size="small"
                onClick={() => handleRestore(record)}
                data-testid={`btn-restore-${record.id}`}
              >
                恢复
              </Button>
            )}
          </Space>
        </PermissionGate>
      ),
    },
  ];

  // 工具栏：写操作（新增/导入）仅对拥有 employee:manage 的用户渲染；模板下载/导出为查看类不控权。
  // 色彩纪律：只有「新增员工」一个主按钮，导入/模板/导出都是查看或次要动作，不做彩色按钮。
  const toolbar: ProTableToolbarAction[] = [
    ...(canManage
      ? [
          { key: 'add', label: '新增员工', type: 'primary' as const, onClick: handleAdd },
          {
            key: 'import',
            label: '导入',
            type: 'outline' as const,
            loading: importing,
            onClick: () => importInputRef.current?.click(),
          },
        ]
      : []),
    { key: 'template', label: '下载模板', type: 'outline', onClick: handleDownloadTemplate },
    {
      key: 'export',
      label: '导出 Excel',
      type: 'outline',
      onClick: handleExport,
    },
  ];

  const modalTitle = modalType === 'add' ? '新增员工' : '编辑员工';
  // 用 useMemo 冻结 initialValues 引用：仅在 editingEmployee 切换（如详情异步返回）时变化，
  // 避免父组件无关重渲染重建对象而清空用户在编辑弹窗中已输入的内容。
  const initialValues = useMemo(
    () =>
      editingEmployee
        ? {
            employeeNo: editingEmployee.employeeNo,
            name: editingEmployee.name,
            departmentId: editingEmployee.departmentId,
            positionId: editingEmployee.positionId,
            hireDate: editingEmployee.hireDate ? String(editingEmployee.hireDate).slice(0, 10) : editingEmployee.hireDate,
            phone: editingEmployee.phone,
            salary: editingEmployee.salary,
            rating: editingEmployee.rating,
            emergencyContact: editingEmployee.emergencyContact,
            emergencyPhone: editingEmployee.emergencyPhone,
            address: editingEmployee.address,
            education: editingEmployee.education,
            skills: editingEmployee.skills,
            remark: editingEmployee.remark,
            tags: (editingEmployee.tags ?? []).map((t) => t.id),
          }
        : undefined,
    [editingEmployee],
  );

  return (
    <PageContainer>
      <input
        ref={importInputRef}
        type="file"
        accept=".xlsx,.xls"
        className="hidden"
        data-testid="import-input"
        onChange={handleImportFileChange}
      />
      <ProTable
        columns={columns}
        data={data}
        rowKey="id"
        loading={loading}
        error={error}
        onRetry={revalidate}
        searchFields={searchFields}
        searchColumn={6}
        searchExpandable={false}
        searchInlineActions
        onSearch={handleSearch}
        onReset={handleReset}
        toolbar={toolbar}
        pagination={pageResult}
        onPageChange={handlePageChange}
        rowSelection={{
          selectedRowKeys: selectedKeys,
          onChange: (keys) => setSelectedKeys(keys),
        }}
        // 批量写操作（调整/恢复在职/批量离职）→ employee:manage，无权限不渲染
        batchActions={
          canManage
            ? [
                {
                  key: 'batch-adjust',
                  label: '批量调整',
                  type: 'primary',
                  onClick: handleBatchOpen,
                },
                {
                  key: 'batch-active',
                  label: '恢复在职',
                  type: 'secondary',
                  onClick: () => handleBatchStatus('active'),
                },
                {
                  key: 'batch-resign',
                  label: '批量离职',
                  type: 'secondary',
                  danger: true,
                  onClick: () => handleBatchStatus('resigned'),
                },
              ]
            : []
        }
      />
      <ModalForm
        visible={modalVisible}
        title={modalTitle}
        fields={formFields}
        initialValues={initialValues}
        onOk={handleModalOk}
        onCancel={handleModalCancel}
        confirmLoading={confirmLoading}
        okText="确定"
        cancelText="取消"
        columns={2}
        width={760}
      />

      {/* 办理离职：纯确认 + 可选离职原因，离职日期默认为今天 */}
      <Modal
        visible={resignVisible}
        title="办理离职"
        onCancel={handleResignCancel}
        onOk={handleResignOk}
        confirmLoading={resignSaving}
        okText="确认离职"
        cancelText="取消"
        style={{ width: 460 }}
      >
        {resignEmployee && (
          <div className="lx-resign-modal">
            <p className="lx-resign-tip">
              确认将「{resignEmployee.name}」（{resignEmployee.employeeNo}）办理离职吗？
              <br />
              离职日期默认为今天（{todayStr()}）。
            </p>
            <Form layout="vertical">
              <Form.Item label="离职原因（可选）">
                <Input.TextArea
                  data-testid="resign-reason-input"
                  value={resignReason}
                  onChange={(v) => setResignReason(v)}
                  placeholder="请输入离职原因，如：个人发展方向、薪酬调整等"
                  maxLength={255}
                  rows={3}
                  style={{ resize: 'none' }}
                />
              </Form.Item>
            </Form>
          </div>
        )}
      </Modal>

      {/* 批量调整：部门/岗位/职级（均可选，至少一项） */}
      <ModalForm
        visible={batchVisible}
        title="批量调整员工信息"
        fields={[
          {
            key: 'departmentId',
            label: '调整部门',
            type: 'select',
            placeholder: '不调整请留空',
            options: departments.map((d) => ({ value: d.id, label: d.name })),
          },
          {
            key: 'positionId',
            label: '调整岗位',
            type: 'select',
            placeholder: '不调整请留空',
            options: positions.map((p) => ({ value: p.id, label: p.name })),
          },
          {
            key: 'rating',
            label: '调整职级',
            type: 'select',
            placeholder: '不调整请留空',
            options: [1, 2, 3, 4, 5].map((n) => ({ value: n, label: `${n} 星` })),
          },
        ]}
        onOk={handleBatchOk}
        onCancel={() => setBatchVisible(false)}
        confirmLoading={batchSaving}
        okText="确定调整"
        cancelText="取消"
        width={460}
      />

      {/* 员工详情（含在职履历）：条件渲染，打开即挂载并按 detailId 拉取，关闭即卸载 */}
      {detailVisible && (
        <EmployeeDetailModal
          employeeId={detailId}
          visible
          onClose={() => { setDetailVisible(false); setDetailId(null); }}
        />
      )}
    </PageContainer>
  );
}
