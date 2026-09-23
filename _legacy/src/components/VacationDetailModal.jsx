import logger from '@/utils/logger';
import React, { useState, useEffect } from 'react';
import { Modal, Descriptions, Tag, Table, Spin, Tabs, ConfigProvider } from 'antd';
import { 
  User, 
  Calendar, 
  Clock, 
  FileText, 
  History, 
  TrendingUp, 
  X,
  ShieldCheck,
  CreditCard,
  Target,
  Award
} from 'lucide-react';
import api from '../api';
import { formatDate, formatDateTime } from '../utils/date';
import VacationTrendChart from './VacationTrendChart';

const VacationDetailModal = ({ visible, onClose, employeeId, employeeName, year }) => {
  const [loading, setLoading] = useState(false);
  const [balanceData, setBalanceData] = useState(null);
  const [historyData, setHistoryData] = useState([]);

  useEffect(() => {
    if (visible && employeeId) {
      loadData();
    }
  }, [visible, employeeId, year]);

  const loadData = async () => {
    setLoading(true);
    try {
      // 加载动态类型余额数据
      const balanceRes = await api.get(`/api/vacation/type-balances/${employeeId}`, { params: { year } });
      if (balanceRes.data.success) {
        setBalanceData(balanceRes.data.data);
      }

      // 加载历史记录
      const historyRes = await api.get(`/api/vacation/balance/history`, { 
        params: { employee_id: employeeId, page: 1, limit: 100 } 
      });
      if (historyRes.data.success) {
        setHistoryData(historyRes.data.data);
      }
    } catch (error) {
      logger.error('加载假期详情失败:', error);
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
    return <Tag color={config.color} className="m-0 border-none font-black text-[10px] rounded px-2">{config.text}</Tag>;
  };

  const historyColumns = [
    {
      title: '变动时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 160,
      render: (text) => <span className="text-[11px] font-bold text-slate-500">{formatDateTime(text)}</span>
    },
    {
      title: '操作类型',
      dataIndex: 'change_type',
      key: 'change_type',
      width: 90,
      align: 'center',
      render: (type) => getChangeTypeTag(type)
    },
    {
      title: '增减天数',
      dataIndex: 'amount',
      key: 'amount',
      width: 100,
      align: 'right',
      render: (amount) => (
        <span className={`text-xs font-black ${amount > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
          {amount > 0 ? '+' : ''}{amount} <span className="text-[9px] opacity-40">天</span>
        </span>
      )
    },
    {
      title: '变更后余额',
      dataIndex: 'balance_after',
      key: 'balance_after',
      width: 100,
      align: 'right',
      render: (val) => <span className="text-xs font-black text-slate-700">{val != null ? `${val}天` : '-'}</span>
    },
    {
      title: '审计备注',
      dataIndex: 'reason',
      key: 'reason',
      render: (t) => <span className="text-[11px] text-slate-400 font-bold truncate max-w-[200px] block">{t || '-'}</span>
    }
  ];

  return (
    <ConfigProvider theme={{
        token: { colorPrimary: '#4f46e5', borderRadius: 12 }
    }}>
    <Modal
      title={null}
      open={visible}
      onCancel={onClose}
      width={800}
      footer={null}
      centered
      closable={false}
      styles={{ 
          body: { padding: 0, overflowX: 'hidden', background: 'rgba(255, 255, 255, 0.75)', backdropFilter: 'blur(30px)' },
          mask: { backdropFilter: 'blur(4px)', background: 'rgba(0, 0, 0, 0.1)' }
      }}
    >
      <Spin spinning={loading}>
        <div className="flex flex-col">
            {/* 头部：旗舰级 */}
            <div className="px-8 py-6 border-b border-white/20 bg-white/40 flex justify-between items-center">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-xl shadow-indigo-100">
                        <Award size={24} />
                    </div>
                    <div>
                        <h2 className="text-lg font-black text-slate-900 tracking-tight">假务权益审计报告</h2>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">{employeeName} · {year}年度审计</p>
                    </div>
                </div>
                <button onClick={onClose} className="w-9 h-9 rounded-xl bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white flex items-center justify-center transition-all shadow-sm border border-rose-100"><X size={20}/></button>
            </div>

            <div className="p-8">
                <Tabs 
                    defaultActiveKey="balance" 
                    className="flagship-sub-tabs"
                    items={[
                        {
                            key: 'balance',
                            label: <div className="flex items-center gap-2 px-2"><FileText size={14}/><span>余额核销看板</span></div>,
                            children: (
                                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
                                    {/* 核心统计 */}
                                    {(() => {
                                        const stats = balanceData?.balances?.reduce((acc, curr) => ({
                                            total: acc.total + parseFloat(curr.total || 0),
                                            used: acc.used + parseFloat(curr.used || 0),
                                            remaining: acc.remaining + parseFloat(curr.remaining || 0)
                                        }), { total: 0, used: 0, remaining: 0 });

                                        return (
                                            <div className="grid grid-cols-3 gap-4">
                                                {[
                                                    { label: '年度总额度', value: stats?.total.toFixed(1), color: 'blue' },
                                                    { label: '已核销天数', value: stats?.used.toFixed(1), color: 'rose' },
                                                    { label: '当前可用余额', value: stats?.remaining.toFixed(1), color: 'emerald' }
                                                ].map((box, i) => (
                                                    <div key={i} className="bg-white/50 border border-white p-5 rounded-2xl shadow-sm text-center">
                                                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">{box.label}</div>
                                                        <div className={`text-2xl font-black text-${box.color}-600 leading-none`}>
                                                            {box.value} <span className="text-xs font-bold opacity-40">天</span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        );
                                    })()}

                                    <div className="bg-white/50 border border-white rounded-2xl p-6 shadow-sm">
                                        <h4 className="text-xs font-black text-slate-700 uppercase tracking-widest mb-4 flex items-center gap-2">
                                            <Target size={14} className="text-indigo-500"/> 假期类型分布明细
                                        </h4>
                                        <div className="grid grid-cols-2 gap-x-10 gap-y-4">
                                            {balanceData?.balances?.map((b, i) => (
                                                <div key={i} className="flex items-center justify-between py-2 border-b border-white/40">
                                                    <span className="text-[11px] font-bold text-slate-500">{b.type_name}</span>
                                                    <div className="flex items-center gap-3">
                                                        <span className="text-xs font-black text-slate-800">{b.remaining} <span className="text-[9px] opacity-30">天</span></span>
                                                        <Progress percent={(b.remaining / (b.total || 1)) * 100} showInfo={false} size={[40, 4]} strokeColor="#4f46e5" trailColor="rgba(0,0,0,0.05)"/>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )
                        },
                        {
                            key: 'history',
                            label: <div className="flex items-center gap-2 px-2"><History size={14}/><span>额度变更流水</span></div>,
                            children: (
                                <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                                    <Table
                                        columns={historyColumns}
                                        dataSource={historyData}
                                        rowKey="id"
                                        pagination={{ pageSize: 8, size: 'small' }}
                                        size="small"
                                        className="flagship-table"
                                    />
                                </div>
                            )
                        },
                        {
                            key: 'trend',
                            label: <div className="flex items-center gap-2 px-2"><TrendingUp size={14}/><span>使用趋势分析</span></div>,
                            children: (
                                <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                                    <div className="h-[300px] w-full bg-white/40 rounded-2xl border border-white p-4">
                                        <VacationTrendChart employeeId={employeeId} year={year} />
                                    </div>
                                </div>
                            )
                        }
                    ]}
                />
            </div>
        </div>
      </Spin>
    </Modal>
    </ConfigProvider>
  );
};

export default VacationDetailModal;
