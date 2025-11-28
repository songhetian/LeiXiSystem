import React, { useState, useEffect } from 'react';
import {
  Card, Row, Col, Input, Select, Button, Table, Tag,
  Statistic, Space, Tooltip, message, Modal, InputNumber
} from 'antd';
import {
  SearchOutlined, ReloadOutlined, SettingOutlined,
  SwapOutlined, ExportOutlined, EyeOutlined,
  TableOutlined, AppstoreOutlined, DownloadOutlined
} from '@ant-design/icons';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  Legend, ResponsiveContainer
} from 'recharts';
import { getApiBaseUrl } from '../utils/apiConfig';
import VacationQuotaWizard from './VacationQuotaWizard';
import VacationTypeManagement from './VacationTypeManagement';
import BalanceChangeHistory from './BalanceChangeHistory';
import VacationQuotaEditModal from './VacationQuotaEditModal';
import BatchVacationQuotaEditModal from './BatchVacationQuotaEditModal';
import VacationSearchBar from './VacationSearchBar';
import VacationDetailModal from './VacationDetailModal';
import VacationCard from './VacationCard';
import dayjs from 'dayjs';

const { Option } = Select;

const VacationManagement = () => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [year, setYear] = useState(dayjs().year());
  const [stats, setStats] = useState({
    totalVacationDays: 0,
    totalOvertimeHours: 0,
    avgUsage: 0
  });

  // Modals state
  const [wizardVisible, setWizardVisible] = useState(false);
  const [typesModalVisible, setTypesModalVisible] = useState(false);
  const [historyModalVisible, setHistoryModalVisible] = useState(false);
  const [quotaModalVisible, setQuotaModalVisible] = useState(false);
  const [batchQuotaModalVisible, setBatchQuotaModalVisible] = useState(false);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [convertModalVisible, setConvertModalVisible] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);

  // Search filters
  const [searchFilters, setSearchFilters] = useState({
    keyword: '',
    startDate: null,
    endDate: null
  });

  // Conversion state
  const [convertHours, setConvertHours] = useState(8);

  // Batch selection
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);

  // View mode: 'table' or 'card'
  const [viewMode, setViewMode] = useState('table');

  useEffect(() => {
    loadData();
  }, [year]);

  const loadData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${getApiBaseUrl()}/vacation/balance/all?year=${year}&limit=1000`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await response.json();

      if (result.success) {
        setData(result.data);
        calculateStats(result.data);
      } else {
        message.error(result.message || '加载数据失败');
      }
    } catch (error) {
      message.error('加载数据失败');
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (items) => {
    const totalVacation = items.reduce((sum, item) => sum + parseFloat(item.total_days || 0), 0);
    const totalOvertime = items.reduce((sum, item) => sum + parseFloat(item.overtime_hours_total || 0), 0);
    const totalUsed = items.reduce((sum, item) =>
      sum + parseFloat(item.annual_leave_used || 0) + parseFloat(item.overtime_leave_used || 0), 0);

    setStats({
      totalVacationDays: totalVacation.toFixed(1),
      totalOvertimeHours: totalOvertime.toFixed(1),
      avgUsage: items.length ? (totalUsed / items.length).toFixed(1) : 0
    });
  };

  // Expiring Soon Logic
  const [expiringQuotas, setExpiringQuotas] = useState([]);

  useEffect(() => {
    fetchExpiringQuotas();
  }, []);

  const fetchExpiringQuotas = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${getApiBaseUrl()}/vacation/expiring-soon?days=30`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await response.json();
      if (result.success) {
        setExpiringQuotas(result.data);
      }
    } catch (error) {
      console.error('Failed to fetch expiring quotas', error);
    }
  };

  const onConvertSubmit = async () => {
    if (!selectedEmployee) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${getApiBaseUrl()}/vacation/convert-overtime`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          employee_id: selectedEmployee.employee_id,
          hours: selectedEmployee.overtime_hours_total - (selectedEmployee.overtime_hours_converted || 0),
          year: year
        })
      });

      const result = await response.json();
      if (result.success) {
        message.success(result.message);
        setConvertModalVisible(false);
        loadData();
      } else {
        message.error(result.message);
      }
    } catch (error) {
      message.error('转换失败');
    }
  };

  const handleExport = async () => {
    try {
      const token = localStorage.getItem('token');
      const url = `${getApiBaseUrl()}/vacation/export/excel?year=${year}`;

      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const blob = await response.blob();
        const downloadUrl = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = `vacation_balances_${year}.xlsx`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(downloadUrl);
        message.success('导出成功');
      } else {
        message.error('导出失败');
      }
    } catch (error) {
      console.error('导出失败:', error);
      message.error('导出失败');
    }
  };

  const handleBatchExport = async () => {
    if (selectedRowKeys.length === 0) {
      message.warning('请先选择要导出的记录');
      return;
    }

    try {
      // Filter selected data
      const selectedData = data.filter(item => selectedRowKeys.includes(item.id));

      // Create CSV content
      const headers = ['工号', '姓名', '部门', '年假余额', '加班假余额', '病假余额', '加班时长'];
      const rows = selectedData.map(item => [
        item.employee_no,
        item.real_name,
        item.department_name,
        ((item.annual_leave_total || 0) - (item.annual_leave_used || 0)).toFixed(1),
        ((item.overtime_leave_total || 0) - (item.overtime_leave_used || 0)).toFixed(1),
        ((item.sick_leave_total || 0) - (item.sick_leave_used || 0)).toFixed(1),
        ((item.overtime_hours_total || 0) - (item.overtime_hours_converted || 0)).toFixed(1)
      ]);

      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.join(','))
      ].join('\n');

      // Add BOM for Excel UTF-8 support
      const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `vacation_selected_${selectedRowKeys.length}_records.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      message.success(`已导出 ${selectedRowKeys.length} 条记录`);
    } catch (error) {
      console.error('批量导出失败:', error);
      message.error('批量导出失败');
    }
  };

  const columns = [
    {
      title: '工号',
      dataIndex: 'employee_no',
      key: 'employee_no',
      width: 100,
    },
    {
      title: '姓名',
      dataIndex: 'real_name',
      key: 'real_name',
      width: 100,
    },
    {
      title: '部门',
      dataIndex: 'department_name',
      key: 'department_name',
      width: 120,
    },
    {
      title: '假期余额 (天)',
      key: 'vacation_balance',
      width: 150,
      sorter: (a, b) => a.total_days - b.total_days,
      render: (_, record) => {
        const annualRemaining = (record.annual_leave_total || 0) - (record.annual_leave_used || 0);
        const overtimeRemaining = (record.overtime_leave_total || 0) - (record.overtime_leave_used || 0);
        const totalRemaining = annualRemaining + overtimeRemaining;
        return (
          <Tooltip title={`年假: ${annualRemaining.toFixed(1)} | 加班假: ${overtimeRemaining.toFixed(1)}`}>
            <span className="font-bold text-blue-600">{totalRemaining.toFixed(1)}</span>
          </Tooltip>
        );
      }
    },
    {
      title: '加班时长 (小时)',
      key: 'overtime_hours',
      width: 150,
      render: (_, record) => {
        const converted = record.overtime_hours_converted || 0;
        const remaining = (record.overtime_hours_total || 0) - converted;
        return (
          <Tooltip title={`总计: ${record.overtime_hours_total || 0}h | 已转: ${converted}h`}>
            <span className={remaining > 0 ? 'text-green-600 font-semibold' : 'text-gray-500'}>
              {remaining.toFixed(1)}
            </span>
          </Tooltip>
        );
      }
    },
    {
      title: '操作',
      key: 'action',
      width: 280,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => {
              setSelectedEmployee(record);
              setDetailModalVisible(true);
            }}
          >
            详情
          </Button>
          <Button
            type="link"
            size="small"
            icon={<SwapOutlined />}
            onClick={() => {
              setSelectedEmployee(record);
              // 设置转换小时数为员工的剩余加班时长
              const remainingHours = record.overtime_hours_total - (record.overtime_hours_converted || 0);
              setConvertHours(remainingHours);
              setConvertModalVisible(true);
            }}
            disabled={!record.overtime_hours_total || (record.overtime_hours_total - (record.overtime_hours_converted || 0)) < 8}
          >
            转换
          </Button>
          <Button
            type="link"
            size="small"
            icon={<SettingOutlined />}
            onClick={() => {
              setSelectedEmployee(record);
              setQuotaModalVisible(true);
            }}
          >
            额度
          </Button>
        </Space>
      )
    }
  ];

  // Filter data based on search criteria
  const filteredData = data.filter(item => {
    const matchesKeyword = !searchFilters.keyword ||
      item.real_name?.toLowerCase().includes(searchFilters.keyword.toLowerCase()) ||
      item.employee_no?.toLowerCase().includes(searchFilters.keyword.toLowerCase()) ||
      item.department_name?.toLowerCase().includes(searchFilters.keyword.toLowerCase());

    return matchesKeyword;
  });

  // Chart Data Preparation
  const departmentStats = filteredData.reduce((acc, item) => {
    const dept = item.department_name || 'Unknown';
    if (!acc[dept]) {
      acc[dept] = { name: dept, total: 0, used: 0 };
    }
    acc[dept].total += parseFloat(item.total_days || 0);
    acc[dept].used += (parseFloat(item.annual_leave_used || 0) + parseFloat(item.overtime_leave_used || 0));
    return acc;
  }, {});

  const barChartData = Object.values(departmentStats);

  return (
    <div className="p-6 space-y-6 bg-gray-50 min-h-screen">
      {/* Header Actions */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <h1 className="text-2xl font-bold text-gray-800">假期管理</h1>
        <Space wrap>
          {/* View Mode Toggle */}
          <Button.Group>
            <Button
              icon={<TableOutlined />}
              type={viewMode === 'table' ? 'primary' : 'default'}
              onClick={() => setViewMode('table')}
            >
              表格
            </Button>
            <Button
              icon={<AppstoreOutlined />}
              type={viewMode === 'card' ? 'primary' : 'default'}
              onClick={() => setViewMode('card')}
            >
              卡片
            </Button>
          </Button.Group>

          {/* Batch Actions */}
          {selectedRowKeys.length > 0 && (
            <Button.Group>
              <Button
                icon={<DownloadOutlined />}
                onClick={handleBatchExport}
                type="primary"
              >
                导出选中 ({selectedRowKeys.length})
              </Button>
              <Button
                icon={<SettingOutlined />}
                onClick={() => setBatchQuotaModalVisible(true)}
              >
                批量额度
              </Button>
            </Button.Group>
          )}

          <Button icon={<SettingOutlined />} onClick={() => setWizardVisible(true)}>假期配置向导</Button>
          <Button icon={<SettingOutlined />} onClick={() => setTypesModalVisible(true)}>假期类型</Button>
          <Button icon={<ExportOutlined />} onClick={handleExport}>导出全部</Button>
        </Space>
      </div>

      {/* Expiring Soon Alert */}
      {expiringQuotas.length > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 flex items-start">
          <div className="text-orange-500 mr-3 mt-1">
            <span className="text-xl">⚠️</span>
          </div>
          <div>
            <h3 className="text-orange-800 font-medium mb-1">即将过期的假期额度 ({expiringQuotas.length})</h3>
            <div className="text-sm text-orange-700 max-h-24 overflow-y-auto">
              {expiringQuotas.map((item, index) => (
                <div key={index} className="mb-1">
                  {item.real_name} ({item.department_name}): {item.annual_leave_remaining}天年假, {item.overtime_leave_remaining}天加班假将于 {dayjs(item.expiry_date).format('YYYY-MM-DD')} 过期
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Statistics Cards */}
      <Row gutter={16}>
        <Col span={8}>
          <Card>
            <Statistic
              title="总假期余额 (天)"
              value={stats.totalVacationDays}
              precision={1}
              valueStyle={{ color: '#3f8600' }}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="总加班时长 (小时)"
              value={stats.totalOvertimeHours}
              precision={1}
              valueStyle={{ color: '#cf1322' }}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="平均已用假期 (天/人)"
              value={stats.avgUsage}
              precision={1}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Year Selector and Search */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700">年份:</span>
          <Select
            value={year}
            onChange={setYear}
            style={{ width: 120 }}
          >
            {[0, 1, 2, 3, 4].map(i => (
              <Option key={i} value={dayjs().year() - 2 + i}>
                {dayjs().year() - 2 + i}年
              </Option>
            ))}
          </Select>
        </div>
        <Button icon={<ReloadOutlined />} onClick={loadData}>刷新</Button>
      </div>

      {/* Advanced Search Bar */}
      <VacationSearchBar
        onSearch={setSearchFilters}
        loading={loading}
      />

      {/* Main Data Table */}
      {/* Main Data Content */}
      {viewMode === 'table' ? (
        <Card className="shadow-sm" title="员工假期明细">
          <Table
            rowSelection={{
              selectedRowKeys,
              onChange: setSelectedRowKeys,
              preserveSelectedRowKeys: true
            }}
            columns={columns}
            dataSource={filteredData}
            rowKey="id"
            loading={loading}
            pagination={{ pageSize: 10 }}
            scroll={{ x: 1200 }}
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredData.map(item => (
            <VacationCard
              key={item.id}
              employee={item}
              onViewDetail={(record) => {
                setSelectedEmployee(record);
                setDetailModalVisible(true);
              }}
              onConvert={(record) => {
                setSelectedEmployee(record);
                setConvertModalVisible(true);
              }}
              onEditQuota={(record) => {
                setSelectedEmployee(record);
                setQuotaModalVisible(true);
              }}
            />
          ))}
        </div>
      )}

      {/* Charts Section */}
      <Row gutter={16}>
        <Col span={24}>
          <Card title="各部门假期使用情况" className="shadow-sm">
            <div style={{ height: 300 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <RechartsTooltip />
                  <Legend />
                  <Bar dataKey="total" name="总额度" fill="#8884d8" />
                  <Bar dataKey="used" name="已使用" fill="#82ca9d" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </Col>
      </Row>

      {/* Modals */}
      <VacationQuotaWizard
        visible={wizardVisible}
        onClose={() => setWizardVisible(false)}
        onSuccess={loadData}
      />

      <VacationTypeManagement
        visible={typesModalVisible}
        onClose={() => setTypesModalVisible(false)}
      />

      <BalanceChangeHistory
        visible={historyModalVisible}
        onClose={() => setHistoryModalVisible(false)}
        employeeId={selectedEmployee?.employee_id}
        year={year}
      />

      <VacationQuotaEditModal
        visible={quotaModalVisible}
        onClose={() => setQuotaModalVisible(false)}
        employee={selectedEmployee ? { id: selectedEmployee.employee_id, real_name: selectedEmployee.real_name } : null}
        year={year}
        onSuccess={loadData}
      />

      <BatchVacationQuotaEditModal
        visible={batchQuotaModalVisible}
        onClose={() => setBatchQuotaModalVisible(false)}
        employees={data.filter(item => selectedRowKeys.includes(item.id))}
        year={year}
        onSuccess={() => {
          loadData();
          setSelectedRowKeys([]); // Clear selection after success
        }}
      />

      <VacationDetailModal
        visible={detailModalVisible}
        onClose={() => setDetailModalVisible(false)}
        employee={selectedEmployee}
        year={year}
      />

      <Modal
        title="加班转假期"
        open={convertModalVisible}
        onCancel={() => setConvertModalVisible(false)}
        onOk={onConvertSubmit}
      >
        <p>员工：{selectedEmployee?.real_name}</p>
        <p>当前剩余加班：{selectedEmployee ? (selectedEmployee.overtime_hours_total - (selectedEmployee.overtime_hours_converted || 0)).toFixed(1) : 0} 小时</p>
        <div className="mt-4">
          <span className="mr-2">转换小时数:</span>
          <Space.Compact>
            <InputNumber
              min={8}
              max={selectedEmployee ? (selectedEmployee.overtime_hours_total - (selectedEmployee.overtime_hours_converted || 0)) : 8}
              step={8}
              value={selectedEmployee ? (selectedEmployee.overtime_hours_total - (selectedEmployee.overtime_hours_converted || 0)) : 8}
              readOnly={true}
              disabled={true}
            />
            <Input defaultValue="小时" readOnly={true} disabled={true} />
          </Space.Compact>
          <p className="text-gray-500 text-sm mt-2">注：每8小时转换为1天加班假</p>
        </div>
      </Modal>
    </div>
  );
};

export default VacationManagement;
