'use client';

import { useState, useEffect } from 'react';
import { Message, Button, Space } from '@arco-design/web-react';
import AppLayout from '@/components/AppLayout';
import PageContainer from '@/components/PageContainer';
import ProTable, { ProTableColumn, ProTableToolbarAction } from '@/components/ProTable';
import StatusTag from '@/components/StatusTag';
import ModalForm, { FormFieldConfig } from '@/components/ModalForm';
import { employeeApi, Employee } from '@/services/employee';
import { SearchFieldConfig } from '@/components/SearchForm';

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

const formFields: FormFieldConfig[] = [
  { key: 'employeeNo', label: '工号', type: 'input', required: true, placeholder: '请输入工号' },
  { key: 'name', label: '姓名', type: 'input', required: true, placeholder: '请输入姓名' },
  { key: 'departmentId', label: '部门', type: 'select', required: true, placeholder: '请选择部门', options: [] },
  { key: 'positionId', label: '职位', type: 'select', required: true, placeholder: '请选择职位', options: [] },
  { key: 'hireDate', label: '入职日期', type: 'input', required: true, placeholder: '请输入入职日期' },
  { key: 'phone', label: '手机号', type: 'input', required: true, placeholder: '请输入手机号' },
  { key: 'salary', label: '基本工资', type: 'input', required: true, placeholder: '请输入基本工资' },
];

export default function EmployeeListPage() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<Employee[]>([]);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [searchParams, setSearchParams] = useState<Record<string, any>>({});

  const [modalVisible, setModalVisible] = useState(false);
  const [modalType, setModalType] = useState<'add' | 'edit'>('add');
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);

  const fetchData = async (page = 1, pageSize = 20, params: Record<string, any> = {}) => {
    setLoading(true);
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

  const handleResign = async (employee: Employee) => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const result = await employeeApi.resign(employee.id, { resignDate: today });
      if (result.code === 0) {
        Message.success('离职操作成功');
        fetchData(pagination.current, pagination.pageSize, searchParams);
      } else {
        Message.error(result.message || '操作失败');
      }
    } catch (e) {
      Message.error('操作失败');
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
    <AppLayout title="员工管理" activeMenu="employee">
      <PageContainer title="员工管理">
        <ProTable
          columns={columns}
          data={data}
          rowKey="id"
          loading={loading}
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
      </PageContainer>
    </AppLayout>
  );
}
