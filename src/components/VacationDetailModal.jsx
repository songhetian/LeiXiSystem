import React, { useState, useEffect } from 'react';
import { Modal, Descriptions, Tag, Table, Spin, Tabs, message } from 'antd';
import {
  UserOutlined, CalendarOutlined, ClockCircleOutlined,
  FileTextOutlined, HistoryOutlined
} from '@ant-design/icons';
import { getApiBaseUrl } from '../utils/apiConfig';
import { formatDate, formatDateTime } from '../utils/date';
import VacationTrendChart from './VacationTrendChart';
import VacationTypeComparisonChart from './VacationTypeComparisonChart';
import VacationMonthlyView from './VacationMonthlyView';
import VacationYearlyView from './VacationYearlyView';

const { TabPane } = Tabs;

const VacationDetailModal = ({ visible, onClose, employee, year }) => {
  const [loading, setLoading] = useState(false);
  const [balanceData, setBalanceData] = useState(null);
  const [historyData, setHistoryData] = useState([]);
  const [vacationTypes, setVacationTypes] = useState([]);

  useEffect(() => {
    if (visible && employee) {
      loadVacationTypes();
      loadData();
    }
  }, [visible, employee, year]);

  const loadVacationTypes = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${getApiBaseUrl()}/vacation/types`, {
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

      // 加载动态类型余额数据
      const balanceRes = await fetch(
        `${getApiBaseUrl()}/vacation/type-balances/${employee.employee_id}?year=${year}`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      const balanceResult = await balanceRes.json();

      if (balanceResult.success) {
        setBalanceData(balanceResult.data);
      }

      // 加载历史记录
      const historyRes = await fetch(
        `${getApiBaseUrl()}/vacation/balance/history?employee_id=${employee.employee_id}&page=1&limit=100`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      const historyResult = await historyRes.json();

      if (historyResult.success) {
        setHistoryData(historyResult.data);
      }
    } catch (error) {
      message.error('加载数据失败');
    } finally {
      setLoading(false);
    }
  };

  const getTypeColor = (typeCode) => {
    const colorMap = {
      'annual_leave': { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-600' },
      'sick_leave': { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-600' },
      'overtime_leave': { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-600' },
      'personal_leave': { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-600' },
      'marriage_leave': { bg: 'bg-pink-50', border: 'border-pink-200', text: 'text-pink-600' },
      'maternity_leave': { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-600' }
    };
    return colorMap[typeCode] || { bg: 'bg-gray-50', border: 'border-gray-200', text: 'text-gray-600' };
  };

  const getLeaveTypeTag = (type) => {
    const typeMap = {
      'annual_leave': { color: 'blue', text: '年假' },
      'sick_leave': { color: 'orange', text: '病假' },
      'overtime_leave': { color: 'green', text: '加班假' },
      'personal_leave': { color: 'default', text: '事假' },
      'marriage_leave': { color: 'pink', text: '婚假' },
      'maternity_leave': { color: 'purple', text: '产假' }
    };
    const config = typeMap[type] || { color: 'default', text: type };
    return <Tag color={config.color}>{config.text}</Tag>;
  };

  const getChangeTypeTag = (type) => {
    const typeMap = {
      'addition': { color: 'green', text: '增加' },
      'deduction': { color: 'red', text: '扣减' },
      'conversion': { color: 'blue', text: '转换' },
      'adjustment': { color: 'orange', text: '调整' }
    };
    const config = typeMap[type] || { color: 'default', text: type };
    return <Tag color={config.color}>{config.text}</Tag>;
  };

  const historyColumns = [
    {
      title: '时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (text) => formatDateTime(text)
    },
    {
      title: '类型',
      dataIndex: 'change_type',
      key: 'change_type',
      width: 100,
      render: (type) => getChangeTypeTag(type)
    },
    // 移除假期类型列，统一显示
    // {
    //   title: '假期类型',
    //   dataIndex: 'leave_type',
    //   key: 'leave_type',
    //   width: 100,
    //   render: (type) => getLeaveTypeTag(type)
    // },
    {
      title: '变更数量',
      dataIndex: 'amount',
      key: 'amount',
      width: 120,
      render: (amount) => (
        <span className={amount > 0 ? 'text-green-600 font-bold' : 'text-red-600 font-bold'}>
          {amount > 0 ? '+' : ''}{amount} 天
        </span>
      )
    },
    {
      title: '变更后余额',
      dataIndex: 'balance_after',
      key: 'balance_after',
      width: 120,
      render: (val) => val != null ? `${val} 天` : '-'
    },
    {
      title: '操作人',
      dataIndex: 'operator_name',
      key: 'operator_name',
      width: 100
    },
    {
      title: '审批单号',
      dataIndex: 'approval_no',
      key: 'approval_no',
      width: 120,
      render: (val) => val || '-'
    },
    {
      title: '原因',
      dataIndex: 'reason',
      key: 'reason',
      ellipsis: true
    }
  ];

  return (
    <Modal
      title={
        <div className="flex items-center gap-2">
          <UserOutlined className="text-primary-600" />
          <span>假期详情 - {employee?.real_name}</span>
        </div>
      }
      open={visible}
      onCancel={onClose}
      width={900}
      footer={null}
      className="vacation-detail-modal"
    >
      <Spin spinning={loading}>
        <Tabs defaultActiveKey="balance">
          {/* 余额详情 */}
          <TabPane
            tab={
              <span>
                <CalendarOutlined />
                余额详情
              </span>
            }
            key="balance"
          >
            {balanceData && (
              <div className="space-y-6">
                {/* 基本信息 */}
                <Descriptions bordered column={2} size="small">
                  <Descriptions.Item label="工号">{employee?.employee_no}</Descriptions.Item>
                  <Descriptions.Item label="部门">{employee?.department_name}</Descriptions.Item>
                  <Descriptions.Item label="年度">{year}</Descriptions.Item>
                  <Descriptions.Item label="最后更新">
                    {balanceData.last_updated ? formatDateTime(balanceData.last_updated) : '-'}
                  </Descriptions.Item>
                </Descriptions>

                {/* 假期余额概览 */}
                <div>
                  <h4 className="text-lg font-semibold mb-3 flex items-center gap-2">
                    <FileTextOutlined className="text-blue-600" />
                    假期余额概览
                  </h4>

                  {(() => {
                    const totalStats = balanceData?.balances?.reduce((acc, curr) => ({
                      total: acc.total + parseFloat(curr.total || 0),
                      used: acc.used + parseFloat(curr.used || 0),
                      remaining: acc.remaining + parseFloat(curr.remaining || 0)
                    }), { total: 0, used: 0, remaining: 0 });

                    return (
                      <div className="grid grid-cols-3 gap-6 bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
                        <div className="text-center p-4 bg-blue-50 rounded-lg">
                          <div className="text-gray-500 mb-1">总额度</div>
                          <div className="text-2xl font-bold text-blue-600">{totalStats?.total.toFixed(1)} <span className="text-sm font-normal text-gray-500">天</span></div>
                        </div>
                        <div className="text-center p-4 bg-orange-50 rounded-lg">
                          <div className="text-gray-500 mb-1">已使用</div>
                          <div className="text-2xl font-bold text-orange-600">{totalStats?.used.toFixed(1)} <span className="text-sm font-normal text-gray-500">天</span></div>
                        </div>
                        <div className="text-center p-4 bg-green-50 rounded-lg">
                          <div className="text-gray-500 mb-1">剩余</div>
                          <div className="text-2xl font-bold text-green-600">{totalStats?.remaining.toFixed(1)} <span className="text-sm font-normal text-gray-500">天</span></div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}
          </TabPane>

          {/* 变更历史 */}
          <TabPane
            tab={
              <span>
                <HistoryOutlined />
                变更历史
              </span>
            }
            key="history"
          >
            <Table
              columns={historyColumns}
              dataSource={historyData}
              rowKey="id"
              pagination={{ pageSize: 10 }}
              size="small"
            />
          </TabPane>

          {/* 趋势分析 */}
          <TabPane
            tab={
              <span>
                <ClockCircleOutlined />
                趋势分析
              </span>
            }
            key="trend"
          >
            <div className="space-y-6">
              <VacationTrendChart employeeId={employee?.employee_id} year={year} />
            </div>
          </TabPane>
        </Tabs>
      </Spin>
    </Modal>
  );
};

export default VacationDetailModal;
