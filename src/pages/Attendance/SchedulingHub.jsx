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
            token: { colorPrimary: '#4f46e5', borderRadius: 12, controlHeight: 40, colorBorder: '#cbd5e1' },
            components: { 
                Tabs: {
                    titleFontSize: 14,
                    itemSelectedColor: '#4f46e5',
                    itemHoverColor: '#4f46e5',
                    itemActiveColor: '#4f46e5',
                    inkBarColor: '#4f46e5',
                    horizontalMargin: '0 0 20px 0'
                }
            }
        }}>
        <div className="p-6 bg-[#f8fafc] min-h-screen text-left">
            <div className="max-w-[1500px] mx-auto">
                <div className="flex flex-col mb-6">
                    <h1 className="text-xl font-black text-slate-900 tracking-tight">智能调度中心</h1>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5 opacity-80">
                        SCHEDULING WORKBENCH - 班次排布与全员生产力调度平台
                    </p>
                </div>

                <div className="bg-white p-2 rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                    <Tabs 
                        activeKey={activeTab} 
                        onChange={setActiveTab}
                        items={items} 
                        className="flagship-main-tabs"
                        size="middle"
                        destroyInactiveTabPane={false}
                    />
                </div>

                <div className="pt-8 text-center">
                    <span className="text-[9px] text-slate-300 font-black uppercase tracking-[0.4em] opacity-60">
                        雷犀调度管理系统 v2.2 - 算法驱动物理排班
                    </span>
                </div>
            </div>
        </div>
        </ConfigProvider>
    );
};

export default SchedulingHub;
