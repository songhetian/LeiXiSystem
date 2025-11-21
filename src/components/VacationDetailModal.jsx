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

  useEffect(() => {
    if (visible && employee) {
      loadData();
    }
  }, [visible, employee, year]);

  const loadData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');

      // 加载余额数据
      const balanceRes = await fetch(
        `${getApiBaseUrl()}/vacation/balance?employee_id=${employee.employee_id}&year=${year}`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      const balanceResult = await balanceRes.json();

      if (balanceResult.success) {
        setBalanceData(balanceResult.data);
      }

      // 加载历史记录
      const historyRes = await fetch(
        `${getApiBaseUrl()}/vacation/balance-changes?employee_id=${employee.employee_id}&year=${year}`,
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
    {
      title: '假期类型',
      dataIndex: 'leave_type',
      key: 'leave_type',
      width: 100,
      render: (type) => getLeaveTypeTag(type)
    },
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

                {/* 假期余额 */}
                <div>
                  <h4 className="text-lg font-semibold mb-3 flex items-center gap-2">
                    <FileTextOutlined className="text-blue-600" />
                    假期余额明细
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    {/* 年假 */}
                    <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                      <div className="text-sm text-gray-600 mb-1">年假</div>
                      <div className="text-2xl font-bold text-blue-600">
                        {(balanceData.annual_leave_total - balanceData.annual_leave_used).toFixed(1)}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        总额: {balanceData.annual_leave_total} | 已用: {balanceData.annual_leave_used}
                      </div>
                    </div>

                    {/* 加班假 */}
                    <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                      <div className="text-sm text-gray-600 mb-1">加班假</div>
                      <div className="text-2xl font-bold text-green-600">
                        {((balanceData.overtime_leave_total || 0) - (balanceData.overtime_leave_used || 0)).toFixed(1)}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        总额: {balanceData.overtime_leave_total || 0} | 已用: {balanceData.overtime_leave_used || 0}
                      </div>
                    </div>

                    {/* 病假 */}
                    <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
                      <div className="text-sm text-gray-600 mb-1">病假</div>
                      <div className="text-2xl font-bold text-orange-600">
                        {(balanceData.sick_leave_total - balanceData.sick_leave_used).toFixed(1)}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        总额: {balanceData.sick_leave_total} | 已用: {balanceData.sick_leave_used}
                      </div>
                    </div>

                    {/* 加班时长 */}
                    <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                      <div className="text-sm text-gray-600 mb-1">加班时长</div>
                      <div className="text-2xl font-bold text-purple-600">
                        {(balanceData.overtime_hours_total - balanceData.overtime_hours_converted).toFixed(1)}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        总计: {balanceData.overtime_hours_total}h | 已转: {balanceData.overtime_hours_converted}h
                      </div>
                    </div>
                  </div>
                </div>

                {/* 总假期额度 */}
                <div className="bg-gradient-to-r from-blue-500 to-purple-500 text-white p-6 rounded-lg">
                  <div className="text-sm opacity-90 mb-2">总假期额度 (不含调休)</div>
                  <div className="text-4xl font-bold">{balanceData.total_days || 0} 天</div>
                  <div className="text-sm opacity-75 mt-2">
                    包含: 年假 + 加班假 + 其他假期类型
                  </div>
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
              <VacationTrendChart employeeId={employee?.employee_id} />
              <VacationTypeComparisonChart data={balanceData} />
            </div>
          </TabPane>

          {/* 月度视图 */}
          <TabPane
            tab={
              <span>
                <CalendarOutlined />
                月度视图
              </span>
            }
            key="monthly"
          >
            <VacationMonthlyView employeeId={employee?.employee_id} year={year} />
          </TabPane>

          {/* 年度视图 */}
          <TabPane
            tab={
              <span>
                <CalendarOutlined />
                年度视图
              </span>
            }
            key="yearly"
          >
            <VacationYearlyView employeeId={employee?.employee_id} year={year} />
          </TabPane>
        </Tabs>
      </Spin>
    </Modal>
  );
};

export default VacationDetailModal;
