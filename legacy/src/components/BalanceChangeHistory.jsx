import React, { useState, useEffect } from 'react';
import { Table, Modal, Tag, message } from 'antd';
import { getApiBaseUrl } from '../utils/apiConfig';
import { formatDate } from '../utils/date';

const BalanceChangeHistory = ({ visible, onClose, employeeId, year }) => {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible && employeeId) {
      loadHistory();
    }
  }, [visible, employeeId, year]);

  const loadHistory = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      let url = `${getApiBaseUrl()}/vacation/balance-changes?employee_id=${employeeId}`;
      if (year) {
        url += `&year=${year}`;
      }

      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) {
        setHistory(data.data);
      } else {
        message.error(data.message || '加载历史记录失败');
      }
    } catch (error) {
      message.error('加载历史记录失败');
    } finally {
      setLoading(false);
    }
  };

  const getChangeTypeTag = (type) => {
    const map = {
      'addition': { color: 'green', text: '增加' },
      'deduction': { color: 'red', text: '扣减' },
      'conversion': { color: 'blue', text: '转换' },
      'adjustment': { color: 'orange', text: '调整' }
    };
    const config = map[type] || { color: 'default', text: type };
    return <Tag color={config.color}>{config.text}</Tag>;
  };

  const getLeaveTypeName = (type) => {
    const map = {
      'annual_leave': '年假',
      'compensatory': '调休假',
      'sick_leave': '病假',
      'personal_leave': '事假',
      'marriage_leave': '婚假',
      'maternity_leave': '产假',
      'paternity_leave': '陪产假',
      'bereavement_leave': '丧假'
    };
    return map[type] || type;
  };

  const columns = [
    {
      title: '时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (text) => formatDate(text, true) // Assuming formatDate handles datetime or add true for time
    },
    {
      title: '变更类型',
      dataIndex: 'change_type',
      key: 'change_type',
      render: (type) => getChangeTypeTag(type)
    },
    {
      title: '假期类型',
      dataIndex: 'leave_type',
      key: 'leave_type',
      render: (type) => getLeaveTypeName(type)
    },
    {
      title: '变更数量',
      dataIndex: 'amount',
      key: 'amount',
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
      render: (val) => val != null ? `${val} 天` : '-'
    },
    {
      title: '原因',
      dataIndex: 'reason',
      key: 'reason',
    }
  ];

  return (
    <Modal
      title="额度变更历史"
      open={visible}
      onCancel={onClose}
      width={900}
      footer={null}
    >
      <Table
        columns={columns}
        dataSource={history}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 10 }}
      />
    </Modal>
  );
};

export default BalanceChangeHistory;
