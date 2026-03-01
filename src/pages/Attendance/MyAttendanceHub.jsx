/**
 * 个人考勤自助中心 (Flagship Hub)
 * 物理缝合：打卡、补卡、请假、加班及统计
 */
import React, { useState } from 'react';
import { Tabs, ConfigProvider } from 'antd';
import { 
    CalendarOutlined, 
    FormOutlined, 
    HistoryOutlined, 
    BarChartOutlined 
} from '@ant-design/icons';
import { Calendar, ClipboardList, Clock, PieChart } from 'lucide-react';

// 动态导入子组件 (确保逻辑零缩水)
import AttendanceHome from './AttendanceHome';
import AttendanceRecords from './AttendanceRecords';
import LeaveApply from './LeaveApply';
import OvertimeApply from './OvertimeApply';
import MakeupApply from './MakeupApply';
import LeaveRecords from './LeaveRecords';
import OvertimeRecords from './OvertimeRecords';
import AttendanceStats from './AttendanceStats';

const MyAttendanceHub = () => {
    // 默认展示考勤大盘
    const [activeTab, setActiveTab] = useState('calendar');
    const [applyTab, setApplyTab] = useState('leave');
    const [historyTab, setHistoryTab] = useState('leave-history');

    // 快捷跳转处理
    const handleNavigate = (tab, subTab = null) => {
        setActiveTab(tab);
        if (subTab) {
            if (tab === 'apply') setApplyTab(subTab);
            if (tab === 'history') setHistoryTab(subTab);
        }
    };

    const items = [
        {
            key: 'calendar',
            label: (
                <div className="flex items-center gap-2 px-4">
                    <Calendar size={16} />
                    <span className="font-black">考勤主页</span>
                </div>
            ),
            children: (
                <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                    <AttendanceHome onNavigate={(target) => {
                        // 修正跳转映射
                        if (target === 'attendance-leave-apply') handleNavigate('apply', 'leave');
                        if (target === 'attendance-overtime-apply') handleNavigate('apply', 'overtime');
                        if (target === 'attendance-makeup') handleNavigate('apply', 'makeup');
                        if (target === 'attendance-records') handleNavigate('records');
                    }} />
                </div>
            )
        },
        {
            key: 'records',
            label: (
                <div className="flex items-center gap-2 px-4">
                    <Clock size={16} />
                    <span className="font-black">打卡明细</span>
                </div>
            ),
            children: (
                <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                    <AttendanceRecords />
                </div>
            )
        },
        {
            key: 'apply',
            label: (
                <div className="flex items-center gap-2 px-4">
                    <FormOutlined />
                    <span className="font-black">业务办理</span>
                </div>
            ),
            children: (
                <div className="p-2 animate-in fade-in slide-in-from-bottom-2 duration-500">
                    <Tabs 
                        activeKey={applyTab} 
                        onChange={setApplyTab}
                        type="card"
                        className="flagship-sub-tabs"
                        items={[
                            { key: 'leave', label: <span className="font-black px-6">🌴 请假申请</span>, children: <div className="bg-white p-8 border border-slate-500 rounded-b-xl rounded-tr-xl"><LeaveApply /></div> },
                            { key: 'overtime', label: <span className="font-black px-6">🌙 加班申请</span>, children: <div className="bg-white p-8 border border-slate-500 rounded-b-xl rounded-tr-xl"><OvertimeApply /></div> },
                            { key: 'makeup', label: <span className="font-black px-6">🔧 异常补卡</span>, children: <div className="bg-white p-8 border border-slate-500 rounded-b-xl rounded-tr-xl"><MakeupApply /></div> }
                        ]}
                    />
                </div>
            )
        },
        {
            key: 'history',
            label: (
                <div className="flex items-center gap-2 px-4">
                    <HistoryOutlined />
                    <span className="font-black">申请流水</span>
                </div>
            ),
            children: (
                <div className="p-2 animate-in fade-in slide-in-from-bottom-2 duration-500">
                    <Tabs 
                        activeKey={historyTab} 
                        onChange={setHistoryTab}
                        items={[
                            { key: 'leave-history', label: <span className="font-black px-6">请假流水清单</span>, children: <LeaveRecords /> },
                            { key: 'overtime-history', label: <span className="font-black px-6">加班流水清单</span>, children: <OvertimeRecords /> }
                        ]}
                    />
                </div>
            )
        },
        {
            key: 'stats',
            label: (
                <div className="flex items-center gap-2 px-4">
                    <PieChart size={16} />
                    <span className="font-black">效能分析</span>
                </div>
            ),
            children: (
                <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                    <AttendanceStats />
                </div>
            )
        }
    ];

    return (
        <ConfigProvider theme={{
            token: { colorPrimary: '#4f46e5', borderRadius: 8, controlHeight: 44, colorBorder: '#64748b' },
            components: { 
                Tabs: {
                    titleFontSize: 15,
                    itemSelectedColor: '#4f46e5',
                    itemHoverColor: '#4f46e5',
                    itemActiveColor: '#4f46e5',
                    inkBarColor: '#4f46e5',
                    horizontalMargin: '0 0 24px 0',
                    cardBg: '#f8fafc',
                    cardPadding: '12px 16px'
                }
            }
        }}>
        <div className="p-8 bg-[#f8fafc] min-h-screen font-black text-left">
            <div className="max-w-[1600px] mx-auto">
                <div className="flex flex-col mb-10">
                    <h1 className="text-2xl font-black text-slate-900 tracking-tight uppercase">个人考勤一站式工作台</h1>
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mt-1 opacity-70">
                        ATTENDANCE HUB - 物理缝合打卡、申请、审计与效能分析闭环
                    </p>
                </div>

                <div className="bg-white p-4 rounded-3xl shadow-sm border border-slate-500 overflow-hidden">
                    <Tabs 
                        activeKey={activeTab} 
                        onChange={setActiveTab}
                        items={items} 
                        className="flagship-main-tabs"
                        size="large"
                        destroyInactiveTabPane={false}
                    />
                </div>

                <div className="pt-12 text-center">
                    <span className="text-[10px] text-slate-400 font-black uppercase tracking-[0.5em] opacity-30">
                        雷犀考勤调度引擎 v2.2 - 物理链路已深度加固
                    </span>
                </div>
            </div>
        </div>
        </ConfigProvider>
    );
};

export default MyAttendanceHub;
