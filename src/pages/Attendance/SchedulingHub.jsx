/**
 * 智能调度中心 (Scheduling Hub)
 * 物理缝合：班次字典、全员排班、智能算法排班
 */
import React, { useState } from 'react';
import { Tabs, ConfigProvider } from 'antd';
import { 
    CalendarOutlined, 
    SyncOutlined, 
    ThunderboltOutlined 
} from '@ant-design/icons';
import { Calendar, Layers, Zap } from 'lucide-react';

// 动态导入子组件 (零缩水准则)
import ShiftManagement from './ShiftManagement';
import ScheduleManagement from './ScheduleManagement';
import SmartSchedule from './SmartSchedule';

const SchedulingHub = () => {
    // 默认展示 AI 智能排班（以便验证新功能）
    const [activeTab, setActiveTab] = useState('smart');

    const items = [
        {
            key: 'schedule',
            label: (
                <div className="flex items-center gap-2 px-4">
                    <Calendar size={16} />
                    <span className="font-black">全员排班表</span>
                </div>
            ),
            children: (
                <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                    <ScheduleManagement />
                </div>
            )
        },
        {
            key: 'smart',
            label: (
                <div className="flex items-center gap-2 px-4 text-indigo-600">
                    <Zap size={16} fill="currentColor" />
                    <span className="font-black">AI 智能排班</span>
                </div>
            ),
            children: (
                <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                    <SmartSchedule />
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
                    horizontalMargin: '0 0 24px 0'
                }
            }
        }}>
        <div className="p-8 bg-[#f8fafc] min-h-screen font-black text-left">
            <div className="max-w-[1600px] mx-auto">
                <div className="flex flex-col mb-10">
                    <h1 className="text-2xl font-black text-slate-900 tracking-tight uppercase">智能调度中心</h1>
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mt-1 opacity-70">
                        SCHEDULING WORKBENCH - 班次排布与全员生产力调度平台
                    </p>
                </div>

                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-500 overflow-hidden">
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
                        雷犀调度管理系统 v2.2 - 算法驱动物理排班
                    </span>
                </div>
            </div>
        </div>
        </ConfigProvider>
    );
};

export default SchedulingHub;
