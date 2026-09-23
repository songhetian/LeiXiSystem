/**
 * 考勤打卡中心 (Flagship Hub)
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
                <div className="p-1 animate-in fade-in slide-in-from-bottom-2 duration-500">
                    <Tabs 
                        activeKey={applyTab} 
                        onChange={setApplyTab}
                        type="card"
                        className="flagship-sub-tabs"
                        items={[
                            { key: 'leave', label: <span className="font-black px-6 text-xs">🌴 请假申请</span>, children: <div className="bg-white p-6 border border-slate-200 rounded-b-xl rounded-tr-xl"><LeaveApply /></div> },
                            { key: 'overtime', label: <span className="font-black px-6 text-xs">🌙 加班申请</span>, children: <div className="bg-white p-6 border border-slate-200 rounded-b-xl rounded-tr-xl"><OvertimeApply /></div> },
                            { key: 'makeup', label: <span className="font-black px-6 text-xs">🔧 异常补卡</span>, children: <div className="bg-white p-6 border border-slate-200 rounded-b-xl rounded-tr-xl"><MakeupApply /></div> }
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
                <div className="p-1 animate-in fade-in slide-in-from-bottom-2 duration-500">
                    <Tabs 
                        activeKey={historyTab} 
                        onChange={setHistoryTab}
                        items={[
                            { key: 'leave-history', label: <span className="font-black px-6 text-xs">请假流水清单</span>, children: <LeaveRecords /> },
                            { key: 'overtime-history', label: <span className="font-black px-6 text-xs">加班流水清单</span>, children: <OvertimeRecords /> }
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
            token: { colorPrimary: '#4f46e5', borderRadius: 12, controlHeight: 38, colorBorder: '#cbd5e1' },
            components: { 
                Tabs: {
                    titleFontSize: 14,
                    itemSelectedColor: '#4f46e5',
                    itemHoverColor: '#4f46e5',
                    itemActiveColor: '#4f46e5',
                    inkBarColor: '#4f46e5',
                    horizontalMargin: '0 0 20px 0',
                    cardBg: '#f8fafc',
                    cardPadding: '10px 14px'
                }
            }
        }}>
        <div className="p-6 bg-[#f8fafc] min-h-screen text-left">
            <div className="max-w-[1400px] mx-auto">
                <div className="flex flex-col mb-6">
                    <h1 className="text-lg font-black text-slate-900 tracking-tight">个人考勤一站式工作台</h1>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5 opacity-80">
                        ATTENDANCE HUB - 物理缝合打卡、申请、审计与效能分析闭环
                    </p>
                </div>

                <div className="bg-white p-2 rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                    <Tabs 
                        activeKey={activeTab} 
                        onChange={setActiveTab}
                        items={items} 
                        className="flagship-main-tabs"
                        size="middle"
                        destroyOnHidden={false}
                    />
                </div>

                <div className="pt-8 text-center">
                    <span className="text-[9px] text-slate-300 font-black uppercase tracking-[0.4em] opacity-60">
                        雷犀考勤调度引擎 v2.2 - 核心通信模块
                    </span>
                </div>
            </div>
        </div>
        </ConfigProvider>
    );
};

export default MyAttendanceHub;
