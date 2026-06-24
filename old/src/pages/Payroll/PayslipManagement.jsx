import api from '@/api';
import logger from '@/utils/logger';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import {
  BanknotesIcon,
  PlusIcon,
  PencilIcon,
  TrashIcon,
  DocumentArrowUpIcon,
  DocumentArrowDownIcon,
  PaperAirplaneIcon,
  ArrowDownTrayIcon
} from '@heroicons/react/24/outline';
import { Table, Button, Modal, Form, Input, DatePicker, Select, Upload, Tag, InputNumber, Space } from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';

export default function PayslipManagement() {
  const [payslips, setPayslips] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0 });
  const [filters, setFilters] = useState({ month: null, department: null, status: null, keyword: '' });
  const [departments, setDepartments] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editingPayslip, setEditingPayslip] = useState(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [selectAllPages, setSelectAllPages] = useState(false);
  const [showSelectMenu, setShowSelectMenu] = useState(false);
  const [sending, setSending] = useState(false);
  const [form] = Form.useForm();

  // --- 考勤数据自动同步逻辑 ---
  const selectedEmployeeId = Form.useWatch('employee_id', form);
  const selectedMonth = Form.useWatch('salary_month', form);

  useEffect(() => {
    const syncAttendance = async () => {
      if (selectedEmployeeId && selectedMonth && !editingPayslip) {
        try {
          const monthStr = selectedMonth.format('YYYY-MM');
          const response = await api.get('/admin/payslips/attendance-sync', {
            params: { employee_id: selectedEmployeeId, month: monthStr }
          });
          
          if (response.data.success) {
            const stats = response.data.data;
            form.setFieldsValue({
              attendance_days: stats.attendance_days,
              late_count: stats.late_count,
              early_leave_count: stats.early_leave_count,
              absent_days: stats.absent_days,
              leave_days: stats.leave_days,
              overtime_hours: stats.overtime_hours,
              remark: `${monthStr} 考勤数据已自动同步`
            });
            toast.success(`${monthStr} 考勤数据已同步`);
          }
        } catch (error) {
          logger.error('同步考勤失败:', error);
        }
      }
    };
    syncAttendance();
  }, [selectedEmployeeId, selectedMonth, editingPayslip, form]);

  useEffect(() => {
    fetchPayslips();
    fetchDepartments();
    fetchEmployees();
  }, [pagination.page, pagination.limit, filters]);

  const fetchPayslips = async () => {
    setLoading(true);
    try {
      const response = await api.get('/admin/payslips', {
        params: {
          page: pagination.page,
          limit: pagination.limit,
          ...filters
        }
      });

      if (response.data.success) {
        setPayslips(response.data.data);
        setPagination(prev => ({
          ...prev,
          total: response.data.total
        }));
      }
    } catch (error) {
      logger.error('获取工资条列表失败:', error);
      toast.error('获取工资条列表失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchDepartments = async () => {
    try {
      const result = await api.get('/departments/list');
      if (result.data.success) {
        setDepartments(result.data.data);
      }
    } catch (error) {
      logger.error('获取部门列表失败:', error);
    }
  };

  const fetchEmployees = async () => {
    try {
      const result = await api.get('/employees');
      if (Array.isArray(result.data)) {
        setEmployees(result.data);
      } else if (result.data.success && result.data.data) {
        setEmployees(result.data.data);
      }
    } catch (error) {
      logger.error('获取员工列表失败:', error);
    }
  };

  const handleAdd = () => {
    setEditingPayslip(null);
    form.resetFields();
    setShowModal(true);
  };

  const handleEdit = (record) => {
    setEditingPayslip(record);
    form.setFieldsValue({
      ...record,
      salary_month: record.salary_month ? dayjs(record.salary_month) : null,
      payment_date: record.payment_date ? dayjs(record.payment_date) : null
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    Modal.confirm({
      title: '确认删除',
      content: '确定要删除这条工资条吗？',
      onOk: async () => {
        try {
          const response = await api.delete(`/admin/payslips/${id}`);
          if (response.data.success) {
            toast.success('删除成功');
            fetchPayslips();
          }
        } catch (error) {
          logger.error('删除失败:', error);
          toast.error(error.response?.data?.message || '删除失败');
        }
      }
    });
  };

  const handleSubmit = async (values) => {
    try {
      const data = {
        ...values,
        salary_month: values.salary_month ? values.salary_month.format('YYYY-MM-01') : null,
        payment_date: values.payment_date ? values.payment_date.format('YYYY-MM-DD') : null
      };

      let response;
      if (editingPayslip) {
        response = await api.put(`/admin/payslips/${editingPayslip.id}`, data);
      } else {
        response = await api.post('/admin/payslips', data);
      }

      if (response.data.success) {
        toast.success(editingPayslip ? '更新成功' : '创建成功');
        setShowModal(false);
        form.resetFields();
        fetchPayslips();
      }
    } catch (error) {
      logger.error('保存失败:', error);
      toast.error(error.response?.data?.message || '保存失败');
    }
  };

  const handleSingleSend = async (record) => {
    Modal.confirm({
      title: '确认发放',
      content: `确定要发放 ${record.employee_name} 的工资条吗？`,
      okText: '确认发放',
      cancelText: '取消',
      onOk: async () => {
        setSending(true);
        try {
          toast.loading('正在发送工资条...', { id: 'sending' });
          const response = await api.post('/admin/payslips/batch-send', {
            payslip_ids: [record.id]
          });

          if (response.data.success) {
            toast.success(response.data.message, { id: 'sending' });
            fetchPayslips();
          } else {
            toast.error(response.data.message || '发送失败', { id: 'sending' });
          }
        } catch (error) {
          logger.error('发送失败:', error);
          toast.error('发送失败', { id: 'sending' });
        } finally {
          setSending(false);
        }
      }
    });
  };

  const handleBatchSend = async () => {
    if (selectedRowKeys.length === 0 && !selectAllPages) {
      toast.error('请选择要发放的工资条');
      return;
    }

    setSending(true);

    let payslipIds = selectedRowKeys;
    let message = `确定要发放选中的 ${selectedRowKeys.length} 条工资条吗？`;

    if (selectAllPages) {
      try {
        const response = await api.get('/admin/payslips', {
          params: {
            page: 1,
            limit: 10000,
            status: 'draft',
            ...filters
          }
        });

        if (response.data.success) {
          payslipIds = response.data.data.map(p => p.id);
          message = `确定要发放当前筛选条件下的所有 ${payslipIds.length} 条待发送工资条吗？`;
        }
      } catch (error) {
        logger.error('获取待发送工资条失败:', error);
        toast.error('获取工资条列表失败');
        setSending(false);
        return;
      }
    }

    Modal.confirm({
      title: '确认发放',
      content: message,
      okText: '确认发放',
      cancelText: '取消',
      onOk: async () => {
        try {
          toast.loading('正在发送工资条...', { id: 'sending' });
          const response = await api.post('/admin/payslips/batch-send', {
            payslip_ids: payslipIds
          });

          if (response.data.success) {
            const result = response.data;
            toast.success(result.message, { id: 'sending' });
            setSelectedRowKeys([]);
            setSelectAllPages(false);
            fetchPayslips();

            if (result.failed_count && result.failed_count > 0) {
              Modal.warning({
                title: '批量发放完成（部分成功）',
                content: (
                  <div>
                    <p className="text-lg mb-2">⚠️ 发送完成</p>
                    <p>成功发放 <strong className="text-green-600">{result.sent_count}</strong> 条工资条</p>
                    <p>失败 <strong className="text-red-600">{result.failed_count}</strong> 条</p>
                    {result.failed_payslips && result.failed_payslips.length > 0 && (
                      <div className="mt-4">
                        <p className="font-semibold mb-2">失败的工资条：</p>
                        <ul className="max-h-60 overflow-y-auto list-disc pl-5">
                          {result.failed_payslips.map((item, index) => (
                            <li key={index} className="text-red-600 text-sm">
                              {item.employee_name} - {item.reason || '未知错误'}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ),
                okText: '确定',
                width: 500
              });
            } else {
              Modal.success({
                title: '批量发放成功',
                content: (
                  <div>
                    <p className="text-lg mb-2">🎉 发送完成！</p>
                    <p>成功发放 <strong className="text-green-600">{result.sent_count}</strong> 条工资条</p>
                    <p className="text-gray-500 text-sm mt-2">员工已收到工资条发放通知</p>
                  </div>
                ),
                okText: '确定',
                width: 400
              });
            }
          } else {
            toast.error(response.data.message || '批量发放失败', { id: 'sending' });
          }
        } catch (error) {
          logger.error('批量发放失败:', error);
          toast.error('批量发放失败', { id: 'sending' });
        } finally {
          setSending(false);
        }
      },
      onCancel: () => {
        setSending(false);
      }
    });
  };

  const handleExport = async () => {
    try {
      const response = await api.get('/admin/payslips/export', {
        params: filters,
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `工资条导出_${dayjs().format('YYYY-MM-DD_HH-mm-ss')}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('导出成功');
    } catch (error) {
      logger.error('导出失败:', error);
      toast.error('导出失败');
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const response = await api.get('/admin/payslips/import-template', {
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', '工资条导入模板.xlsx');
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('模板下载成功');
    } catch (error) {
      logger.error('下载模板失败:', error);
      toast.error('下载模板失败');
    }
  };

  const handleImport = async (file) => {
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await api.post('/admin/payslips/import', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      if (response.data.success) {
        toast.success(response.data.message);
        fetchPayslips();

        if (response.data.data.errors && response.data.data.errors.length > 0) {
          Modal.warning({
            title: '导入结果',
            content: (
              <div>
                <p>成功: {response.data.data.success} 条</p>
                <p>失败: {response.data.data.failed} 条</p>
                {response.data.data.errors.length > 0 && (
                  <div className="mt-2">
                    <p className="font-semibold">错误详情：</p>
                    <ul className="max-h-40 overflow-y-auto">
                      {response.data.data.errors.slice(0, 10).map((err, idx) => (
                        <li key={idx} className="text-red-500 text-sm">
                          第{err.row}行: {err.message}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ),
            width: 500
          });
        }
      }
    } catch (error) {
      logger.error('导入失败:', error);
      toast.error('导入失败');
    }

    return false;
  };

  const getStatusTag = (status) => {
    const statusMap = {
      draft: { color: 'default', text: '待发送' },
      sent: { color: 'processing', text: '已发放' },
      viewed: { color: 'warning', text: '已查看' },
      confirmed: { color: 'success', text: '已确认' }
    };
    const config = statusMap[status] || { color: 'default', text: status };
    return <Tag color={config.color}>{config.text}</Tag>;
  };

  const columns = [
    {
      title: '工资条编号',
      dataIndex: 'payslip_no',
      key: 'payslip_no',
      width: 150,
      align: 'center'
    },
    {
      title: '员工姓名',
      dataIndex: 'employee_name',
      key: 'employee_name',
      align: 'center'
    },
    {
      title: '工号',
      dataIndex: 'employee_no',
      key: 'employee_no',
      align: 'center'
    },
    {
      title: '部门',
      dataIndex: 'department_name',
      key: 'department_name',
      align: 'center'
    },
    {
      title: '工资月份',
      dataIndex: 'salary_month',
      key: 'salary_month',
      align: 'center',
      render: (text) => dayjs(text).format('YYYY-MM')
    },
    {
      title: '实发工资',
      dataIndex: 'net_salary',
      key: 'net_salary',
      align: 'center',
      render: (text) => `¥${parseFloat(text).toFixed(2)}`
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      align: 'center',
      render: (status) => getStatusTag(status)
    },
    {
      title: '操作',
      key: 'action',
      width: 240,
      align: 'center',
      render: (_, record) => (
        <div className="flex gap-2 justify-center">
          {record.status === 'draft' && (
            <Button
              type="link"
              size="small"
              icon={<PaperAirplaneIcon className="w-4 h-4" />}
              onClick={() => handleSingleSend(record)}
            >
              发送
            </Button>
          )}
          <Button
            type="link"
            size="small"
            icon={<PencilIcon className="w-4 h-4" />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          <Button
            type="link"
            size="small"
            danger
            icon={<TrashIcon className="w-4 h-4" />}
            onClick={() => handleDelete(record.id)}
            disabled={record.status === 'confirmed'}
          >
            删除
          </Button>
        </div>
      )
    }
  ];

  const rowSelection = {
    selectedRowKeys,
    onChange: (keys) => {
      setSelectedRowKeys(keys);
      if (keys.length === 0) {
        setSelectAllPages(false);
      }
    },
    getCheckboxProps: (record) => ({
      disabled: record.status !== 'draft'
    }),
    onSelectAll: (selected) => {
      if (!selected) {
        setSelectAllPages(false);
      }
    }
  };

  const handleSelectCurrentPage = () => {
    const currentPageDraftIds = payslips
      .filter(p => p.status === 'draft')
      .map(p => p.id);
    setSelectedRowKeys(currentPageDraftIds);
    setSelectAllPages(false);
    setShowSelectMenu(false);
  };

  const handleSelectAllPages = () => {
    setSelectedRowKeys([]);
    setSelectAllPages(true);
    setShowSelectMenu(false);
  };

  const handleClearSelection = () => {
    setSelectedRowKeys([]);
    setSelectAllPages(false);
    setShowSelectMenu(false);
  };

  return (
    <div className="p-6">
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BanknotesIcon className="w-8 h-8 text-blue-500" />
            工资条管理
          </h1>
          <p className="text-gray-500 mt-1">管理员工工资条信息</p>
        </div>
        <div className="flex gap-2">
          <Button
            icon={<DocumentArrowDownIcon className="w-4 h-4" />}
            onClick={handleDownloadTemplate}
          >
            下载模板
          </Button>
          <Upload
            accept=".xlsx,.xls"
            showUploadList={false}
            beforeUpload={handleImport}
          >
            <Button icon={<DocumentArrowUpIcon className="w-4 h-4" />}>
              导入工资条
            </Button>
          </Upload>
          <Button
            icon={<ArrowDownTrayIcon className="w-4 h-4" />}
            onClick={handleExport}
          >
            导出Excel
          </Button>
          <Button
            type="primary"
            icon={<PlusIcon className="w-4 h-4" />}
            onClick={handleAdd}
          >
            新增工资条
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow mb-4 p-4">
        <div className="flex gap-4 flex-wrap">
          <DatePicker
            picker="month"
            placeholder="选择月份"
            onChange={(date) => setFilters(prev => ({ ...prev, month: date ? date.format('YYYY-MM') : null }))}
          />
          <Select
            placeholder="选择部门"
            style={{ width: 200 }}
            allowClear
            onChange={(value) => setFilters(prev => ({ ...prev, department: value }))}
            options={[
              { label: '全部部门', value: '' },
              ...departments.map(d => ({ label: d.name, value: d.id }))
            ]}
          />
          <Select
            placeholder="选择状态"
            style={{ width: 150 }}
            allowClear
            onChange={(value) => setFilters(prev => ({ ...prev, status: value }))}
            options={[
              { label: '全部状态', value: '' },
              { label: '待发送', value: 'draft' },
              { label: '已发放', value: 'sent' },
              { label: '已查看', value: 'viewed' },
              { label: '已确认', value: 'confirmed' }
            ]}
          />
          <Input
            placeholder="搜索员工姓名/工号"
            style={{ width: 200 }}
            onChange={(e) => setFilters(prev => ({ ...prev, keyword: e.target.value }))}
          />
          <Button type="primary" onClick={fetchPayslips}>
            查询
          </Button>
          <Select
            placeholder="全选/清除"
            style={{ width: 150 }}
            value={showSelectMenu ? 'select' : undefined}
            open={showSelectMenu}
            onOpenChange={(open) => setShowSelectMenu(open)}
            onChange={(value) => {
              if (value === 'current') handleSelectCurrentPage();
              else if (value === 'all') handleSelectAllPages();
              else if (value === 'clear') handleClearSelection();
            }}
            options={[
              { label: '全选当前页', value: 'current' },
              { label: '全选所有页', value: 'all' },
              { label: '清除选择', value: 'clear' }
            ]}
          />
          {(selectedRowKeys.length > 0 || selectAllPages) && (
            <Button
              type="primary"
              icon={<PaperAirplaneIcon className="w-4 h-4" />}
              onClick={handleBatchSend}
              loading={sending}
            >
              {sending ? '发送中...' : selectAllPages ? '批量发放 (全部)' : `批量发放 (${selectedRowKeys.length})`}
            </Button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow">
        <Table
          rowSelection={rowSelection}
          columns={columns}
          dataSource={payslips}
          rowKey="id"
          loading={loading}
          pagination={{
            current: pagination.page,
            pageSize: pagination.limit,
            total: pagination.total,
            onChange: (page, pageSize) => {
              setPagination(prev => ({ ...prev, page, limit: pageSize }));
            },
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 条记录`
          }}
        />
      </div>

      <Modal
        title={editingPayslip ? '编辑工资条' : '新增工资条'}
        open={showModal}
        onCancel={() => {
          setShowModal(false);
          form.resetFields();
        }}
        footer={null}
        width={800}
      >
        <Form
          form={form}
          onFinish={handleSubmit}
          layout="vertical"
          className="mt-4"
        >
          <div className="grid grid-cols-2 gap-4">
            <Form.Item
              name="employee_id"
              label="员工"
              rules={[{ required: true, message: '请选择员工' }]}
            >
              <Select
                showSearch
                placeholder="请选择员工（支持搜索姓名、工号、部门）"
                optionFilterProp="children"
                filterOption={(input, option) =>
                  (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                }
                disabled={!!editingPayslip}
                options={employees.map(e => ({
                  label: `${e.real_name} (${e.employee_no}) - ${e.department_name || '未分配部门'}`,
                  value: e.id
                }))}
              />
            </Form.Item>

            <Form.Item
              name="salary_month"
              label="工资月份"
              rules={[{ required: true, message: '请选择工资月份' }]}
            >
              <DatePicker picker="month" style={{ width: '100%' }} />
            </Form.Item>

            <Form.Item name="payment_date" label="发放日期">
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>

            <Form.Item name="attendance_days" label="出勤天数" initialValue={0}>
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>

            <Form.Item name="late_count" label="迟到次数" initialValue={0}>
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>

            <Form.Item name="early_leave_count" label="早退次数" initialValue={0}>
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>

            <Form.Item name="leave_days" label="请假天数" initialValue={0}>
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>

            <Form.Item name="overtime_hours" label="加班时长" initialValue={0}>
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>

            <Form.Item name="absent_days" label="缺勤天数" initialValue={0}>
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>

            <Form.Item name="basic_salary" label="基本工资" initialValue={0}>
              <InputNumber min={0} precision={2} style={{ width: '100%' }} />
            </Form.Item>

            <Form.Item name="position_salary" label="岗位工资" initialValue={0}>
              <InputNumber min={0} precision={2} style={{ width: '100%' }} />
            </Form.Item>

            <Form.Item name="performance_bonus" label="绩效奖金" initialValue={0}>
              <InputNumber min={0} precision={2} style={{ width: '100%' }} />
            </Form.Item>

            <Form.Item name="overtime_pay" label="加班费" initialValue={0}>
              <InputNumber min={0} precision={2} style={{ width: '100%' }} />
            </Form.Item>

            <Form.Item name="allowances" label="各类补贴" initialValue={0}>
              <InputNumber min={0} precision={2} style={{ width: '100%' }} />
            </Form.Item>

            <Form.Item name="deductions" label="各类扣款" initialValue={0}>
              <InputNumber min={0} precision={2} style={{ width: '100%' }} />
            </Form.Item>

            <Form.Item name="social_security" label="社保扣款" initialValue={0}>
              <InputNumber min={0} precision={2} style={{ width: '100%' }} />
            </Form.Item>

            <Form.Item name="housing_fund" label="公积金扣款" initialValue={0}>
              <InputNumber min={0} precision={2} style={{ width: '100%' }} />
            </Form.Item>

            <Form.Item name="tax" label="个人所得税" initialValue={0}>
              <InputNumber min={0} precision={2} style={{ width: '100%' }} />
            </Form.Item>

            <Form.Item name="other_deductions" label="其他扣款" initialValue={0}>
              <InputNumber min={0} precision={2} style={{ width: '100%' }} />
            </Form.Item>
          </div>

          <Form.Item name="remark" label="备注">
            <Input.TextArea rows={3} />
          </Form.Item>

          <Form.Item>
            <div className="flex gap-2 justify-end">
              <Button onClick={() => {
                setShowModal(false);
                form.resetFields();
              }}>
                取消
              </Button>
              <Button type="primary" htmlType="submit">
                {editingPayslip ? '更新' : '创建'}
              </Button>
            </div>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
