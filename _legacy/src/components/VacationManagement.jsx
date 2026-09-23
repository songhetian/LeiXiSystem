import React, { useState, useEffect } from 'react';
import {
  Card, Row, Col, Input, Select, Button, Table, Tag,
  Statistic, Space, Tooltip, Modal, InputNumber, ConfigProvider, Avatar
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
import { Users, Filter, Calendar, RefreshCcw, FileSearch, ArrowRight, ShieldAlert, TrendingUp, PieChart } from 'lucide-react';
import { toast } from 'sonner';
import api from '../api';
import VacationTypeManagement from './VacationTypeManagement';
import VacationQuotaEditModal from './VacationQuotaEditModal';
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

  // 模态框状态
  const [typesModalVisible, setTypesModalVisible] = useState(false);
  const [quotaModalVisible, setQuotaModalVisible] = useState(false);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [convertModalVisible, setConvertModalVisible] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);

  // 搜索与视图
  const [keyword, setKeyword] = useState('');
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [viewMode, setViewMode] = useState('table');
  const [expiringQuotas, setExpiringQuotas] = useState([]);

  useEffect(() => { loadData(); fetchExpiringQuotas(); }, [year]);

  const loadData = async () => {
    setLoading(true);
    try {
      const response = await api.get('/vacation/balance/all', { params: { year, limit: 1000 } });
      if (response.data.success) {
        setData(response.data.data);
        calculateStats(response.data.data);
      }
    } catch (error) { toast.error('假务数据同步失败'); }
    finally { setLoading(false); }
  };

  const calculateStats = (items) => {
    const totalVacation = items.reduce((sum, item) => sum + parseFloat(item.total_days || 0), 0);
    const totalOvertime = items.reduce((sum, item) => sum + parseFloat(item.overtime_hours_total || 0), 0);
    const totalUsed = items.reduce((sum, item) => sum + parseFloat(item.annual_leave_used || 0) + parseFloat(item.overtime_leave_used || 0), 0);
    setStats({ totalVacationDays: totalVacation.toFixed(1), totalOvertimeHours: totalOvertime.toFixed(1), avgUsage: items.length ? (totalUsed / items.length).toFixed(1) : 0 });
  };

  const fetchExpiringQuotas = async () => {
    try {
      const res = await api.get('/vacation/expiring-soon', { params: { days: 30 } });
      if (res.data.success) setExpiringQuotas(res.data.data);
    } catch (e) {}
  };

  const onConvertSubmit = async () => {
    if (!selectedEmployee) return;
    try {
      const res = await api.post('/vacation/convert-overtime', {
        employee_id: selectedEmployee.employee_id,
        hours: selectedEmployee.overtime_hours_total - (selectedEmployee.overtime_hours_converted || 0),
        year: year
      });
      if (res.data.success) { toast.success('转换成功'); setConvertModalVisible(false); loadData(); }
    } catch (e) { toast.error('操作失败'); }
  };

  const handleExport = () => {
    window.open(api.defaults.baseURL + `/api/vacation/export/excel?year=${year}`, '_blank');
    toast.info('正在生成导出文件...');
  };

  const columns = [
    {
      title: '基本身份',
      key: 'identity',
      width: 180,
      fixed: 'left',
      render: (_, r) => (
        <div className="flex flex-col">
            <span className="text-xs font-black text-slate-800">{r.real_name}</span>
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">#{r.employee_no}</span>
        </div>
      )
    },
    {
      title: '所属部门',
      dataIndex: 'department_name',
      key: 'dept',
      width: 130,
      render: (t) => <span className="text-[11px] font-bold text-slate-500">{t}</span>
    },
    {
      title: '年度余额 (天)',
      key: 'balance',
      width: 130,
      align: 'center',
      render: (_, record) => {
        const annual = (record.annual_leave_total || 0) - (record.annual_leave_used || 0);
        const overtime = (record.overtime_leave_total || 0) - (record.overtime_leave_used || 0);
        return <span className="text-xs font-black text-blue-600">{(annual + overtime).toFixed(1)}</span>;
      }
    },
    {
      title: '待转加班 (h)',
      key: 'overtime',
      width: 130,
      align: 'center',
      render: (_, record) => {
        const rem = (record.overtime_hours_total || 0) - (record.overtime_hours_converted || 0);
        return <span className={`text-xs font-black ${rem > 0 ? 'text-amber-600' : 'text-slate-300'}`}>{rem.toFixed(1)}h</span>;
      }
    },
    {
      title: '管理',
      key: 'action',
      width: 120,
      fixed: 'right',
      align: 'center',
      render: (_, record) => (
        <Space size="small">
          <button onClick={() => { setSelectedEmployee(record); setDetailModalVisible(true); }} className="w-8 h-8 rounded-lg bg-slate-50 text-slate-400 hover:bg-blue-50 hover:text-blue-600 transition-all"><EyeOutlined /></button>
          <button onClick={() => { setSelectedEmployee(record); setConvertModalVisible(true); }} disabled={(record.overtime_hours_total - (record.overtime_hours_converted || 0)) < 8}
            className="w-8 h-8 rounded-lg bg-slate-50 text-slate-400 hover:bg-amber-50 hover:text-amber-600 transition-all disabled:opacity-20"><SwapOutlined /></button>
        </Space>
      )
    }
  ];

  const filteredData = data.filter(item => !keyword || item.real_name?.includes(keyword) || item.employee_no?.includes(keyword) || item.department_name?.includes(keyword));

  return (
    <ConfigProvider theme={{
        token: { colorPrimary: '#4f46e5', borderRadius: 10, controlHeight: 36, colorBorder: '#cbd5e1' },
        components: { Table: { headerBg: '#f8fafc', headerColor: '#64748b', headerFontWeight: 900, fontSize: 12 } }
    }}>
    <div className="space-y-6 animate-in fade-in duration-500 font-black text-left">
      
      {/* 1. 物理缝合控制台 */}
      <div className="flex flex-wrap items-center gap-3 w-full bg-white p-2 rounded-xl shadow-sm border border-slate-200">
          <div className="flex items-center bg-slate-50 rounded-lg border border-slate-100 overflow-hidden h-[36px]">
            <div className="px-3 h-full border-r border-slate-100 flex items-center gap-2 bg-slate-100/50">
                <Calendar size={14} className="text-slate-400" />
            </div>
            <Select value={year} onChange={setYear} className="w-24 !border-none flagship-select h-full" variant="borderless"
                options={[0, 1, 2, 3].map(i => { const y = dayjs().year() - 2 + i; return { value: y, label: `${y}年` }; })} />
          </div>

          <div className="flex-1 flex items-center bg-slate-50 rounded-lg border border-slate-100 px-3 h-[36px] min-w-[150px]">
            <SearchOutlined className="text-slate-300 mr-2" />
            <input placeholder="搜索姓名、工号或部门..." className="w-full bg-transparent outline-none text-[11px] font-black placeholder:text-slate-300"
                value={keyword} onChange={e => setKeyword(e.target.value)} />
          </div>

          <Space size="small">
            <button onClick={() => setViewMode(viewMode === 'table' ? 'card' : 'table')} className="h-9 px-4 bg-slate-100 text-slate-600 rounded-lg text-[10px] font-black hover:bg-slate-200 transition-all">
                {viewMode === 'table' ? <><AppstoreOutlined className="mr-1"/> 卡片模式</> : <><TableOutlined className="mr-1"/> 列表模式</>}
            </button>
            <button onClick={() => setTypesModalVisible(true)} className="h-9 px-4 bg-white border border-slate-200 text-slate-600 rounded-lg text-[10px] font-black hover:border-slate-400 transition-all">
                <SettingOutlined className="mr-1"/> 类型维护
            </button>
            <Button type="primary" icon={<ExportOutlined />} onClick={handleExport} className="h-[36px] bg-indigo-600 border-none rounded-lg text-[11px] font-black shadow-md px-6">导出全员</Button>
          </Space>
      </div>

      {/* 2. 即将过期告警 */}
      {expiringQuotas.length > 0 && (
        <div className="bg-amber-50/50 border border-amber-100 rounded-xl p-4 flex items-start gap-3 shadow-inner">
            <ShieldAlert size={18} className="text-amber-500 mt-0.5" />
            <div className="flex-1">
                <div className="text-[11px] font-black text-amber-800 uppercase tracking-widest mb-1">权益过期预警 - 未来30天</div>
                <div className="flex flex-wrap gap-x-6 gap-y-1">
                    {expiringQuotas.slice(0, 3).map((item, idx) => (
                        <span key={idx} className="text-[10px] font-bold text-amber-700/70">
                            {item.real_name}: {item.annual_leave_remaining}天年假即将在 {dayjs(item.expiry_date).format('MM-DD')} 物理失效
                        </span>
                    ))}
                    {expiringQuotas.length > 3 && <span className="text-[10px] font-black text-amber-500 underline cursor-pointer">等 {expiringQuotas.length} 项记录...</span>}
                </div>
            </div>
        </div>
      )}

      {/* 3. 核心统计指标 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
            { label: '年度总额度', value: stats.totalVacationDays, unit: '天', color: 'blue', icon: <PieChart size={18}/>, desc: '包含全部员工可用额度' },
            { label: '待处理加班', value: stats.totalOvertimeHours, unit: '小时', color: 'rose', icon: <RefreshCcw size={18}/>, desc: '未进行核销转换的总时长' },
            { label: '平均消耗率', value: stats.avgUsage, unit: '天/人', color: 'indigo', icon: <TrendingUp size={18}/>, desc: '本年度人均已休假时长' }
        ].map((s, i) => (
            <div key={i} className={`bg-white border border-slate-200 p-5 rounded-2xl shadow-sm group transition-all hover:border-${s.color}-400`}>
                <div className="flex items-center justify-between mb-3">
                    <div className={`w-9 h-9 rounded-xl bg-${s.color}-50 text-${s.color}-600 flex items-center justify-center`}>{s.icon}</div>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{s.label}</span>
                </div>
                <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-black text-slate-900 leading-none">{s.value}</span>
                    <span className="text-[10px] font-bold text-slate-400 uppercase">{s.unit}</span>
                </div>
                <div className="mt-3 pt-3 border-t border-slate-50 text-[9px] font-bold text-slate-400 truncate">{s.desc}</div>
            </div>
        ))}
      </div>

      {/* 4. 主数据展示区 */}
      {viewMode === 'table' ? (
        <Card className="rounded-2xl border-slate-200 shadow-sm overflow-hidden" styles={{ body: { padding: 0 } }}>
          <Table
            rowSelection={{ selectedRowKeys, onChange: setSelectedRowKeys, preserveSelectedRowKeys: true }}
            columns={columns}
            dataSource={filteredData}
            rowKey="id"
            loading={loading}
            size="small"
            pagination={{ pageSize: 12, size: 'small', showTotal: (t) => <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-4">Personnel Records: {t}</span> }}
            scroll={{ x: 'max-content' }}
            className="flagship-table"
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 animate-in slide-in-from-bottom-2 duration-500">
          {filteredData.map(item => (
            <VacationCard key={item.id} employee={item} 
                onViewDetail={(r) => { setSelectedEmployee(r); setDetailModalVisible(true); }}
                onConvert={(r) => { setSelectedEmployee(r); setConvertModalVisible(true); }}
            />
          ))}
        </div>
      )}

      {/* 5. 模态框组 */}
      <VacationTypeManagement visible={typesModalVisible} onClose={() => setTypesModalVisible(false)} />
      
      <VacationQuotaEditModal visible={quotaModalVisible} onClose={() => setQuotaModalVisible(false)}
        employee={selectedEmployee ? { id: selectedEmployee.employee_id, real_name: selectedEmployee.real_name } : null}
        year={year} onSuccess={loadData} />

      <VacationDetailModal visible={detailModalVisible} onClose={() => setDetailModalVisible(false)}
        employeeId={selectedEmployee?.employee_id} employeeName={selectedEmployee?.real_name} year={year} />

      <Modal title={<span className="font-black">物理转换审计</span>} open={convertModalVisible} onCancel={() => setConvertModalVisible(false)}
        footer={[
            <Button key="no" onClick={() => setConvertModalVisible(false)} className="font-black h-9 px-6 rounded-lg text-xs">取消</Button>,
            <Button key="yes" type="primary" className="h-9 px-8 bg-slate-900 border-none font-black rounded-lg text-xs shadow-md" onClick={onConvertSubmit}>执行物理转换</Button>
        ]}
        centered width={400}
      >
        <div className="py-4 space-y-4">
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                <div className="text-[10px] font-black text-slate-400 uppercase mb-1">目标对象</div>
                <div className="text-sm font-black text-slate-800">{selectedEmployee?.real_name}</div>
            </div>
            <div className="bg-amber-50 p-4 rounded-xl border border-amber-100">
                <div className="text-[10px] font-black text-amber-600 uppercase mb-1">可转换时长</div>
                <div className="text-sm font-black text-amber-700">{(selectedEmployee?.overtime_hours_total - (selectedEmployee?.overtime_hours_converted || 0)).toFixed(1)} 小时</div>
                <p className="text-[9px] text-amber-600/60 mt-2 font-bold italic"># 规则：每 8 小时加班时长物理转化为 1 天假期额度</p>
            </div>
        </div>
      </Modal>
    </div>
    </ConfigProvider>
  );
};

export default VacationManagement;
