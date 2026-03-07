import logger from '@/utils/logger';
/**
 * 待办事务中心 (雷犀高级感 2.0 完美白话版)
 * 
 * 核心升级：
 * 1. 类型映射：翻译 annual -> 年假等所有技术性词汇。
 * 2. 编号脱敏：隐藏 LEAVE 等后端原始代码，显示友好文字。
 * 3. 全量居中：确保所有表格内容严格水平居中。
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Table, Button, Tag, Space, Card, Typography, Empty, Badge, Radio, Divider, Tooltip, Avatar } from 'antd';
import {
  RocketOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  ArrowRightOutlined,
  ContainerOutlined,
  UserAddOutlined,
  UserOutlined,
  CalendarOutlined,
  WalletOutlined,
  ReloadOutlined,
  DoubleRightOutlined,
  DatabaseOutlined
} from '@ant-design/icons';
import api from '../../api';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/zh-cn';
import { toast } from 'sonner';

dayjs.extend(relativeTime);
dayjs.locale('zh-cn');

const { Title, Text } = Typography;

// 请假类型映射表
const LEAVE_TYPE_MAP = {
  'annual': '年假申请',
  'sick': '病假申请',
  'casual': '事假申请',
  'maternity': '产假申请',
  'paternity': '陪产假申请',
  'marriage': '婚假申请',
  'bereavement': '丧假申请',
  'compensatory': '调休申请'
};

const TodoCenter = ({ onNavigate }) => {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filterType, setFilterType] = useState('all');

  useEffect(() => {
    fetchTasks();
  }, []);

  const fetchTasks = async () => {
    setLoading(true);
    try {
      const userData = JSON.parse(localStorage.getItem('user') || '{}');
      const userId = userData.id;
      const response = await api.get('/todo/list', {
        params: { user_id: userId }
      });
      if (response.data.success) {
        setTasks(response.data.data);
      }
    } catch (error) {
      logger.error('加载待办失败:', error);
      toast.error('任务同步失败');
    } finally {
      setLoading(false);
    }
  };

  const stats = useMemo(() => {
    return {
      reimbursement: tasks.filter(t => t.task_type === 'reimbursement').length,
      attendance: tasks.filter(t => ['leave', 'overtime', 'makeup', 'compensatory_leave'].includes(t.task_type)).length,
      audit: tasks.filter(t => t.task_type === 'user_audit').length
    };
  }, [tasks]);

  const filteredTasks = useMemo(() => {
    if (filterType === 'all') return tasks;
    if (filterType === 'reimbursement') return tasks.filter(t => t.task_type === 'reimbursement');
    if (filterType === 'attendance') return tasks.filter(t => ['leave', 'overtime', 'makeup', 'compensatory_leave'].includes(t.task_type));
    if (filterType === 'audit') return tasks.filter(t => t.task_type === 'user_audit');
    return tasks;
  }, [tasks, filterType]);

  const columns = [
    {
      title: '事项类型',
      dataIndex: 'type_label',
      key: 'type_label',
      width: 120,
      align: 'center',
      render: (text) => (
        <span className="bg-black text-white text-[10px] font-black px-2 py-0.5 rounded shadow-sm">
          {text}
        </span>
      )
    },
    {
      title: '任务详情',
      key: 'summary',
      align: 'center',
      render: (_, record) => {
        // 智能处理摘要文本 (白话化)
        let displaySummary = record.summary;
        Object.keys(LEAVE_TYPE_MAP).forEach(key => {
          if (displaySummary.toLowerCase().includes(key)) {
            displaySummary = displaySummary.replace(new RegExp(key, 'gi'), LEAVE_TYPE_MAP[key]);
          }
        });

        const isSystemNo = ['LEAVE', 'OVERTIME', 'MAKEUP', 'USER_AUDIT'].includes(record.no);
        
        return (
          <div className="flex flex-col items-center">
            <Text className="font-black text-slate-800 text-sm">{displaySummary}</Text>
            <div className="flex items-center gap-2 mt-1">
              <Tag className="m-0 border-none bg-slate-100 text-slate-400 text-[9px] font-bold">
                {isSystemNo ? '待处理申请' : `编号: ${record.no}`}
              </Tag>
            </div>
          </div>
        );
      }
    },
    {
      title: '谁发起的',
      dataIndex: 'applicant',
      key: 'applicant',
      width: 140,
      align: 'center',
      render: (text) => (
        <div className="flex items-center justify-center gap-2">
          <Avatar size={20} icon={<UserOutlined />} className="bg-slate-100 text-slate-400" />
          <span className="font-bold text-slate-700 text-xs">{text}</span>
        </div>
      )
    },
    {
      title: '金额或说明',
      dataIndex: 'extra_info',
      key: 'extra_info',
      width: 200,
      align: 'center',
      render: (val, record) => {
        if (record.task_type === 'reimbursement') {
          return <span className="font-mono font-black text-rose-600 text-base">¥{parseFloat(val).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>;
        }
        return <span className="text-slate-500 font-bold text-xs">{val}</span>;
      }
    },
    {
      title: '提交时长',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 150,
      align: 'center',
      render: (date) => (
        <Tooltip title={dayjs(date).format('YYYY-MM-DD HH:mm:ss')}>
          <span className="text-slate-400 text-[11px] font-bold italic">{dayjs(date).fromNow()}</span>
        </Tooltip>
      )
    },
    {
      title: '去处理',
      key: 'action',
      width: 100,
      align: 'center',
      render: (_, record) => (
        <Button
          type="link"
          className="font-black text-indigo-600 hover:text-indigo-700 flex items-center justify-center w-full gap-1"
          onClick={() => onNavigate(record.tab)}
        >
          <span className="text-xs">立即处理</span>
          <DoubleRightOutlined className="text-[10px]" />
        </Button>
      )
    }
  ];

  return (
    <div className="p-6 md:p-10 min-h-screen bg-slate-50/30">
      {/* 顶部标题栏 */}
      <div className="max-w-[1400px] mx-auto mb-8 flex justify-between items-end">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-black flex items-center justify-center shadow-lg">
              <RocketOutlined className="text-white text-xl" />
            </div>
            <h1 className="text-2xl font-black text-slate-900 !m-0">待办事务中心</h1>
          </div>
          <p className="text-slate-400 text-sm font-bold">您有 <span className="text-rose-500">{tasks.length}</span> 项任务正等着您去决定</p>
        </div>
        <button 
          onClick={fetchTasks}
          className="bg-black hover:bg-slate-800 text-white rounded-lg h-10 px-8 flex items-center justify-center gap-2 transition-all font-bold text-xs shadow-sm active:scale-95"
        >
          <ReloadOutlined className={loading ? 'animate-spin' : ''} />
          <span>刷新任务</span>
        </button>
      </div>

      {/* 统计大磁贴 */}
      <div className="max-w-[1400px] mx-auto grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        {[
          { key: 'all', label: '全部待办事项', count: tasks.length, icon: <ContainerOutlined />, color: 'text-slate-900' },
          { key: 'reimbursement', label: '收到报销申请', count: stats.reimbursement, icon: <WalletOutlined />, color: 'text-indigo-600' },
          { key: 'attendance', label: '收到考勤审批', count: stats.attendance, icon: <CalendarOutlined />, color: 'text-amber-600' },
          { key: 'audit', label: '新同事注册审核', count: stats.audit, icon: <UserAddOutlined />, color: 'text-emerald-600' }
        ].map(item => (
          <Card 
            key={item.key}
            hoverable 
            onClick={() => setFilterType(item.key)} 
            className={`rounded-2xl border-none shadow-sm transition-all ${filterType === item.key ? 'ring-2 ring-black scale-[1.02]' : ''}`}
            bodyStyle={{ padding: '24px' }}
          >
            <div className="flex justify-between items-start">
              <Space direction="vertical" size={0}>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  {item.icon} {item.label}
                </span>
                <div className={`text-3xl font-black mt-2 ${item.color}`}>{item.count}</div>
              </Space>
              <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-slate-200">
                {item.icon}
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* 任务列表列表 */}
      <div className="max-w-[1400px] mx-auto">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/30 flex items-center justify-between">
            <div className="flex items-center bg-white rounded-lg border border-slate-200 p-1">
              {[
                { key: 'all', label: '查看全部' },
                { key: 'reimbursement', label: '钱款报销' },
                { key: 'attendance', label: '考勤请假' },
                { key: 'audit', label: '入职审核' }
              ].map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setFilterType(tab.key)}
                  className={`px-5 py-1.5 rounded-md text-[11px] font-black transition-all ${filterType === tab.key ? 'bg-black text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 text-slate-400 text-[10px] font-bold uppercase tracking-widest">
              <DatabaseOutlined /> 实时流程同步中
            </div>
          </div>

          <Table
            columns={columns}
            dataSource={filteredTasks}
            rowKey={(record) => `${record.task_type}-${record.id}`}
            loading={loading}
            size="middle"
            className="compact-table"
            pagination={{
              pageSize: 10,
              showSizeChanger: false,
              showTotal: (total) => `共发现 ${total} 个待办事项`,
              className: "custom-pagination",
              position: ['bottomCenter']
            }}
            locale={{ emptyText: <Empty description={<span className="text-slate-400 font-bold">暂时没有待办任务，您可以先忙别的</span>} image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
          />
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .ant-table-thead > tr > th { 
          background: #fcfcfd !important; 
          color: #64748b !important; 
          font-weight: 900 !important; 
          text-transform: uppercase !important; 
          font-size: 10px !important;
          padding: 14px 16px !important;
          border-bottom: 1px solid #e2e8f0 !important;
          text-align: center !important;
        }
        .ant-table-tbody > tr > td { text-align: center !important; font-size: 13px !important; border-bottom: 1px solid #f1f5f9 !important; }
        .ant-card-body { transition: all 0.2s ease; }
        .ant-btn-link:hover { background: #f8fafc; border-radius: 6px; }
      `}} />
    </div>
  );
};

export default TodoCenter;
