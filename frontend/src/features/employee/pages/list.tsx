'use client';

import { useState, useEffect, useRef } from 'react';
import { Message, Button, Space } from '@arco-design/web-react';
import PageContainer from '@/components/PageContainer';
import { notifyError } from '@/lib/request';
import ProTable, { ProTableColumn, ProTableToolbarAction } from '@/components/ProTable';
import StatusTag from '@/components/StatusTag';
import ModalForm, { FormFieldConfig } from '@/components/ModalForm';
import { employeeApi, Employee } from '@/services/employee';
import { systemApi } from '@/services/system';
import { SearchFieldConfig } from '@/components/SearchForm';
import { exportToExcel } from '@/lib/excel';

const searchFields: SearchFieldConfig[] = [
  { key: 'name', label: '姓名', type: 'input', placeholder: '请输入姓名' },
  { key: 'employeeNo', label: '工号', type: 'input', placeholder: '请输入工号' },
  {
    key: 'status',
    label: '状态',
    type: 'select',
    placeholder: '请选择状态',
    options: [
      { value: 'active', label: '在职' },
      { value: 'inactive', label: '离职' },
    ],
  },
];

function buildFormFields(
  departments: { id: number; name: string }[],
  positions: { id: number; name: string }[],
): FormFieldConfig[] {
  return [
    { key: 'employeeNo', label: '工号', type: 'input', required: true, placeholder: '请输入工号' },
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
  ];
}

export default function EmployeeListPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<Employee[]>([]);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [searchParams, setSearchParams] = useState<Record<string, any>>({});
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const [importing, setImporting] = useState(false);

  const [modalVisible, setModalVisible] = useState(false);
  const [modalType, setModalType] = useState<'add' | 'edit'>('add');
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [formFields, setFormFields] = useState<FormFieldConfig[]>(() => buildFormFields([], []));

  // 离职确认弹窗
  const [resignVisible, setResignVisible] = useState(false);
  const [resignEmployee, setResignEmployee] = useState<Employee | null>(null);
  const [resigning, setResigning] = useState(false);

  useEffect(() => {
    systemApi.listDepartments().then((res) => {
      const depts = res.code === 0 && res.data ? res.data : [];
      systemApi.listPositions().then((res2) => {
        const poss = res2.code === 0 && res2.data ? res2.data : [];
        setFormFields(buildFormFields(depts, poss));
      });
    });
  }, []);

  const fetchData = async (page = 1, pageSize = 20, params: Record<string, any> = {}) => {
    setLoading(true);
    setError(null);
    try {
      const result = await employeeApi.getList({
        page,
        pageSize,
        ...params,
      });
      if (result.code === 0 && result.data) {
        setData(result.data.list);
        setPagination({
          current: result.data.page,
          pageSize: result.data.pageSize,
          total: result.data.total,
        });
      }
    } catch (e: any) {
      setError(e?.message || '加载失败');
      notifyError(e, '加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(1, 20, searchParams);
  }, []);

  const handleSearch = (values: Record<string, any>) => {
    setSearchParams(values);
    fetchData(1, pagination.pageSize, values);
  };

  const handleReset = () => {
    setSearchParams({});
    fetchData(1, pagination.pageSize, {});
  };

  // 导出 Excel：拉取符合当前筛选条件的全部员工
  const handleExport = async () => {
    try {
      const res = await employeeApi.getList({ page: 1, pageSize: 10000, ...searchParams });
      const list = (res.data?.list ?? []) as Employee[];
      if (!exportToExcel(
        `员工列表_${new Date().toISOString().slice(0, 10)}.xlsx`,
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
        fetchData(pagination.current, pagination.pageSize, searchParams);
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
    fetchData(page, pageSize, searchParams);
  };

  const handleAdd = () => {
    setModalType('add');
    setEditingEmployee(null);
    setModalVisible(true);
  };

  const handleEdit = (employee: Employee) => {
    setModalType('edit');
    setEditingEmployee(employee);
    setModalVisible(true);
  };

  const handleResign = (employee: Employee) => {
    setResignEmployee(employee);
    setResignVisible(true);
  };

  const handleResignOk = async (values: Record<string, any>) => {
    if (!resignEmployee) return;
    setResigning(true);
    try {
      const result = await employeeApi.resign(resignEmployee.id, {
        resignDate: values.resignDate,
        reason: values.reason,
      });
      if (result.code === 0) {
        Message.success('离职操作成功');
        setResignVisible(false);
        setResignEmployee(null);
        fetchData(pagination.current, pagination.pageSize, searchParams);
      } else {
        Message.error(result.message || '操作失败');
      }
    } catch (e) {
      Message.error('操作失败');
    } finally {
      setResigning(false);
    }
  };

  const handleModalCancel = () => {
    setModalVisible(false);
    setEditingEmployee(null);
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
          salary: values.salary,
        });
      } else {
        result = await employeeApi.update(editingEmployee!.id, {
          name: values.name,
          departmentId: values.departmentId ? Number(values.departmentId) : undefined,
          positionId: values.positionId ? Number(values.positionId) : undefined,
          hireDate: values.hireDate,
          phone: values.phone,
          salary: values.salary,
        });
      }

      if (result.code === 0) {
        Message.success(modalType === 'add' ? '新增成功' : '修改成功');
        setModalVisible(false);
        fetchData(pagination.current, pagination.pageSize, searchParams);
      } else {
        Message.error(result.message || '操作失败');
      }
    } finally {
      setConfirmLoading(false);
    }
  };

  const columns: ProTableColumn[] = [
    { title: '工号', dataIndex: 'employeeNo', width: 120 },
    { title: '姓名', dataIndex: 'name', width: 100 },
    { title: '部门', dataIndex: 'departmentName', width: 120 },
    { title: '职位', dataIndex: 'positionName', width: 120 },
    { title: '入职日期', dataIndex: 'hireDate', width: 120 },
    { title: '手机号', dataIndex: 'phone', width: 140 },
    {
      title: '状态',
      dataIndex: 'status',
      width: 80,
      render: (value: string) => <StatusTag status={value} />,
    },
    {
      title: '操作',
      dataIndex: 'action',
      width: 160,
      render: (_: any, record: Employee) => (
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
        </Space>
      ),
    },
  ];

  const toolbar: ProTableToolbarAction[] = [
    { key: 'add', label: '新增员工', type: 'primary', onClick: handleAdd },
    { key: 'import', label: '导入', loading: importing, onClick: () => importInputRef.current?.click() },
    { key: 'template', label: '下载模板', onClick: handleDownloadTemplate },
    { key: 'export', label: '导出 Excel', onClick: handleExport },
  ];

  const modalTitle = modalType === 'add' ? '新增员工' : '编辑员工';
  const initialValues = editingEmployee
    ? {
        employeeNo: editingEmployee.employeeNo,
        name: editingEmployee.name,
        departmentId: editingEmployee.departmentId,
        positionId: editingEmployee.positionId,
        hireDate: editingEmployee.hireDate,
        phone: editingEmployee.phone,
        salary: editingEmployee.salary,
      }
    : undefined;

  return (
    <PageContainer title="员工管理">
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
        onRetry={() => fetchData(pagination.current, pagination.pageSize, searchParams)}
        searchFields={searchFields}
        onSearch={handleSearch}
        onReset={handleReset}
        toolbar={toolbar}
        pagination={pagination}
        onPageChange={handlePageChange}
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
      />

      <ModalForm
        visible={resignVisible}
        title={resignEmployee ? `办理离职：${resignEmployee.name}` : '办理离职'}
        fields={[
          {
            key: 'resignDate',
            label: '离职日期',
            type: 'date',
            required: true,
            placeholder: '请选择离职日期',
          },
          { key: 'reason', label: '离职原因', type: 'textarea', placeholder: '请输入离职原因（可选）' },
        ]}
        initialValues={{ resignDate: new Date().toISOString().split('T')[0] }}
        onOk={handleResignOk}
        onCancel={() => { setResignVisible(false); setResignEmployee(null); }}
        confirmLoading={resigning}
        okText="确认离职"
        cancelText="取消"
        width={460}
      />
    </PageContainer>
  );
}
