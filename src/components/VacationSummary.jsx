import React, { useState, useEffect } from 'react';
import { Card, Table, Input, Select, Button, Tag, Space, Tooltip, Modal } from 'antd';
import { SearchOutlined, ReloadOutlined, EyeOutlined } from '@ant-design/icons';
import { toast } from 'react-toastify';
import { getApiBaseUrl } from '../utils/apiConfig';
import VacationDetailModal from './VacationDetailModal';

const { Option } = Select;

const VacationSummary = () => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [vacationTypes, setVacationTypes] = useState([]);
  const [filters, setFilters] = useState(() => {
    return {
      department_id: undefined,
      search: '',
      year: new Date().getFullYear()
    };
  });
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0
  });

  // 详情模态框状态
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);

  useEffect(() => {
    loadDepartments();
    loadVacationTypes();
  }, []);

  useEffect(() => {
    loadData();
  }, [filters, pagination.current, pagination.pageSize]);

  const loadDepartments = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${getApiBaseUrl()}/departments`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await response.json();
      // 确保 ID 是数字类型
      const depts = result.filter(d => d.status === 'active').map(d => ({
        ...d,
        id: parseInt(d.id)
      }));
      setDepartments(depts);
    } catch (error) {
      console.error('加载部门失败:', error);
    }
  };

  // 调试功能：显示当前状态
  const showDebugInfo = () => {
    const userStr = localStorage.getItem('user');
    alert(`Filters: ${JSON.stringify(filters)}\nUser: ${userStr}\nDepts Count: ${departments.length}`);
  };

  const loadVacationTypes = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${getApiBaseUrl()}/vacation-types`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await response.json();
      if (result.success) {
        setVacationTypes(result.data);
      }
    } catch (error) {
      console.error('加载假期类型失败:', error);
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams({
        year: filters.year,
        page: pagination.current,
        limit: pagination.pageSize,
        ...(filters.department_id && { department_id: filters.department_id }),
        ...(filters.search && { search: filters.search })
      });

      const response = await fetch(`${getApiBaseUrl()}/vacation/type-balances/all?${params}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await response.json();

      if (result.success) {
        setData(result.data);
        setPagination(prev => ({
          ...prev,
          total: result.pagination.total
        }));
      } else {
        toast.error(result.message || '加载失败');
      }
    } catch (error) {
      console.error('加载数据失败:', error);
      toast.error('加载数据失败');
    } finally {
      setLoading(false);
    }
  };

  const handleTableChange = (newPagination) => {
    setPagination(newPagination);
  };

  const handleViewDetails = (record) => {
    setSelectedEmployee(record);
    setDetailModalVisible(true);
  };

  // 计算汇总数据
  const getAggregatedData = (balances) => {
    return balances.reduce((acc, curr) => ({
      total: acc.total + parseFloat(curr.total || 0),
      used: acc.used + parseFloat(curr.used || 0),
      remaining: acc.remaining + parseFloat(curr.remaining || 0)
    }), { total: 0, used: 0, remaining: 0 });
  };

  // 静态列定义
  const columns = [
    {
      title: '工号',
      dataIndex: 'employee_no',
      key: 'employee_no',
      width: 100,
      fixed: 'left',
    },
    {
      title: '姓名',
      dataIndex: 'employee_name',
      key: 'employee_name',
      width: 100,
      fixed: 'left',
    },
    {
      title: '部门',
      dataIndex: 'department_name',
      key: 'department_name',
      width: 120,
      fixed: 'left',
    },
    {
      title: '总额度 (天)',
      key: 'total_quota',
      width: 120,
      render: (_, record) => {
        const stats = getAggregatedData(record.vacation_balances);
        return <span className="font-medium">{stats.total.toFixed(1)}</span>;
      }
    },
    {
      title: '已使用 (天)',
      key: 'total_used',
      width: 120,
      render: (_, record) => {
        const stats = getAggregatedData(record.vacation_balances);
        return <span className="text-gray-600">{stats.used.toFixed(1)}</span>;
      }
    },
    {
      title: '剩余 (天)',
      key: 'total_remaining',
      width: 120,
      render: (_, record) => {
        const stats = getAggregatedData(record.vacation_balances);
        const isLow = stats.remaining < 0;
        return (
          <span style={{
            color: isLow ? '#ff4d4f' : '#52c41a',
            fontWeight: 'bold'
          }}>
            {stats.remaining.toFixed(1)}
          </span>
        );
      }
    },
    {
      title: '操作',
      key: 'action',
      fixed: 'right',
      width: 100,
      render: (_, record) => (
        <Button
          type="link"
          icon={<EyeOutlined />}
          onClick={() => handleViewDetails(record)}
        >
          详情
        </Button>
      )
    }
  ];

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">假期汇总</h1>
          <p className="text-gray-500">查看全员假期余额统计</p>
        </div>
        <Space>
          <Button
            icon={<ReloadOutlined />}
            onClick={loadData}
            loading={loading}
          >
            刷新
          </Button>
          <Button onClick={showDebugInfo} size="small" type="dashed">Debug</Button>
        </Space>
      </div>

      <Card className="mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Select
            placeholder="选择年份"
            value={filters.year}
            onChange={val => setFilters({ ...filters, year: val })}
            className="w-full"
          >
            {[0, 1, 2].map(i => {
              const y = new Date().getFullYear() - 1 + i;
              return <Option key={y} value={y}>{y}年</Option>;
            })}
          </Select>

          <Select
            placeholder="选择部门"
            allowClear
            value={filters.department_id}
            onChange={val => setFilters({ ...filters, department_id: val })}
            className="w-full"
          >
            <Option value={undefined}>全部部门</Option>
            {departments.map(d => (
              <Option key={d.id} value={d.id}>{d.name}</Option>
            ))}
          </Select>

          <Input
            placeholder="搜索姓名/工号"
            prefix={<SearchOutlined />}
            value={filters.search}
            onChange={e => setFilters({ ...filters, search: e.target.value })}
            onPressEnter={loadData}
            className="w-full"
          />

          <Button type="primary" onClick={loadData}>查询</Button>
        </div>
      </Card>

      <Card styles={{ body: { padding: 0 } }}>
        <Table
          columns={columns}
          dataSource={data}
          rowKey="employee_id"
          pagination={{
            ...pagination,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 条`
          }}
          loading={loading}
          onChange={handleTableChange}
          scroll={{ x: 'max-content' }}
          size="middle"
        />
      </Card>

      {selectedEmployee && (
        <VacationDetailModal
          visible={detailModalVisible}
          onClose={() => {
            setDetailModalVisible(false);
            setSelectedEmployee(null);
          }}
          employeeId={selectedEmployee.employee_id}
          employeeName={selectedEmployee.employee_name}
        />
      )}
    </div>
  );
};

export default VacationSummary;
