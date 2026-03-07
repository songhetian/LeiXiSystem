import logger from '@/utils/logger';
import React, { useState, useEffect } from 'react';
import { Card, Table, Input, Select, Button, Tag, Space, Tooltip, Modal, ConfigProvider } from 'antd';
import { SearchOutlined, ReloadOutlined, EyeOutlined } from '@ant-design/icons';
import { Users, Filter, Calendar, RefreshCcw, FileSearch } from 'lucide-react';
import { toast } from 'sonner';
import api from '../api';
import VacationDetailModal from './VacationDetailModal';

const { Option } = Select;

const VacationSummary = () => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [filters, setFilters] = useState({
    department_id: undefined,
    search: '',
    year: new Date().getFullYear()
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
  }, []);

  useEffect(() => {
    loadData();
  }, [filters.department_id, filters.year, pagination.current, pagination.pageSize]);

  // 防抖搜索
  useEffect(() => {
    const timer = setTimeout(() => {
      loadData();
    }, 500);
    return () => clearTimeout(timer);
  }, [filters.search]);

  const loadDepartments = async () => {
    try {
      const response = await api.get('/api/departments/list');
      if (response.data.success) {
        setDepartments(response.data.data.filter(d => d.status === 'active'));
      }
    } catch (error) { logger.error('加载部门失败:', error); }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const response = await api.get('/api/vacation/type-balances/all', {
        params: {
          year: filters.year,
          page: pagination.current,
          limit: pagination.pageSize,
          department_id: filters.department_id,
          search: filters.search
        }
      });

      if (response.data.success) {
        setData(response.data.data);
        setPagination(prev => ({ ...prev, total: response.data.pagination?.total || 0 }));
      }
    } catch (error) { toast.error('假务数据同步失败'); }
    finally { setLoading(false); }
  };

  const handleTableChange = (newPagination) => {
    setPagination(newPagination);
  };

  const handleViewDetails = (record) => {
    setSelectedEmployee(record);
    setDetailModalVisible(true);
  };

  const getAggregatedData = (balances) => {
    return (balances || []).reduce((acc, curr) => ({
      total: acc.total + parseFloat(curr.total || 0),
      used: acc.used + parseFloat(curr.used || 0),
      remaining: acc.remaining + parseFloat(curr.remaining || 0)
    }), { total: 0, used: 0, remaining: 0 });
  };

  const columns = [
    {
      title: '基本身份',
      key: 'identity',
      width: 180,
      fixed: 'left',
      render: (_, r) => (
        <div className="flex flex-col">
            <span className="text-xs font-black text-slate-800">{r.employee_name}</span>
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">#{r.employee_no}</span>
        </div>
      )
    },
    {
      title: '所属部门',
      dataIndex: 'department_name',
      key: 'dept',
      width: 120,
      render: (t) => <span className="text-[11px] font-bold text-slate-500">{t}</span>
    },
    {
      title: '年度总额度',
      key: 'total',
      width: 100,
      align: 'center',
      render: (_, record) => {
        const stats = getAggregatedData(record.vacation_balances);
        return <span className="text-xs font-black text-slate-700">{stats.total.toFixed(1)} <span className="text-[9px] opacity-40">天</span></span>;
      }
    },
    {
      title: '已核销使用',
      key: 'used',
      width: 100,
      align: 'center',
      render: (_, record) => {
        const stats = getAggregatedData(record.vacation_balances);
        return <span className="text-xs font-bold text-slate-400">{stats.used.toFixed(1)} <span className="text-[9px] opacity-40">天</span></span>;
      }
    },
    {
      title: '当前剩余余额',
      key: 'remaining',
      width: 120,
      align: 'center',
      render: (_, record) => {
        const stats = getAggregatedData(record.vacation_balances);
        const isLow = stats.remaining < 0;
        return (
          <span className={`text-sm font-black ${isLow ? 'text-rose-500' : 'text-emerald-500'}`}>
            {stats.remaining.toFixed(1)} <span className="text-[9px] opacity-40">天</span>
          </span>
        );
      }
    },
    {
      title: '管理',
      key: 'action',
      fixed: 'right',
      width: 80,
      align: 'center',
      render: (_, record) => (
        <button 
            onClick={() => handleViewDetails(record)}
            className="w-8 h-8 rounded-lg bg-slate-50 text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 flex items-center justify-center transition-all shadow-sm"
        >
            <EyeOutlined />
        </button>
      )
    }
  ];

  return (
    <ConfigProvider theme={{
        token: { colorPrimary: '#4f46e5', borderRadius: 10, controlHeight: 36, colorBorder: '#cbd5e1' },
        components: { 
            Table: { headerBg: '#f8fafc', headerColor: '#64748b', headerFontWeight: 900, fontSize: 12 }
        }
    }}>
    <div className="space-y-6 animate-in fade-in duration-500 text-left font-black">
      
      {/* 1. 物理缝合控制台 */}
      <div className="flex flex-wrap items-center gap-3 w-full bg-white p-2 rounded-xl shadow-sm border border-slate-200">
          <div className="flex items-center bg-slate-50 rounded-lg border border-slate-100 overflow-hidden h-[36px]">
            <div className="px-3 h-full border-r border-slate-100 flex items-center gap-2 bg-slate-100/50">
                <Calendar size={14} className="text-slate-400" />
            </div>
            <Select 
                value={filters.year} 
                onChange={val => setFilters({ ...filters, year: val })}
                className="w-24 !border-none flagship-select h-full"
                bordered={false}
                options={[0, 1, 2].map(i => {
                    const y = new Date().getFullYear() - 1 + i;
                    return { value: y, label: `${y}年` };
                })}
            />
          </div>

          <div className="flex items-center bg-slate-50 rounded-lg border border-slate-100 overflow-hidden h-[36px]">
            <div className="px-3 h-full border-r border-slate-100 flex items-center gap-2 bg-slate-100/50">
                <Users size={14} className="text-slate-400" />
            </div>
            <Select 
                placeholder="全部部门"
                allowClear
                value={filters.department_id} 
                onChange={val => setFilters({ ...filters, department_id: val })}
                className="w-40 !border-none flagship-select h-full"
                bordered={false}
                options={departments.map(d => ({ label: d.name, value: d.id }))}
            />
          </div>

          <div className="flex-1 flex items-center bg-slate-50 rounded-lg border border-slate-100 px-3 h-[36px] min-w-[150px]">
            <SearchOutlined className="text-slate-300 mr-2" />
            <input 
                placeholder="搜索姓名或工号..." 
                className="w-full bg-transparent outline-none text-[11px] font-black placeholder:text-slate-300"
                value={filters.search}
                onChange={e => setFilters({ ...filters, search: e.target.value })}
            />
          </div>

          <button onClick={loadData} className="h-9 w-9 flex items-center justify-center bg-slate-50 border border-slate-200 rounded-lg hover:bg-white transition-all ml-1 text-slate-400 hover:text-indigo-600"><RefreshCcw size={16}/></button>
      </div>

      {/* 2. 数据表格区 */}
      <Card className="rounded-2xl border-slate-200 shadow-sm overflow-hidden" styles={{ body: { padding: 0 } }}>
        <Table
          columns={columns}
          dataSource={data}
          rowKey="employee_id"
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            total: pagination.total,
            showSizeChanger: true,
            size: 'small',
            showTotal: (total) => <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-4">Audit Records: {total}</span>,
            onChange: (page, pageSize) => setPagination({ current: page, pageSize })
          }}
          loading={loading}
          scroll={{ x: 'max-content' }}
          className="flagship-table"
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
    </ConfigProvider>
  );
};

export default VacationSummary;
