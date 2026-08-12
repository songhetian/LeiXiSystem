/**
 * 智能调度中心 (Scheduling Hub)
 * 极致简约版：去除冗余标题与多重嵌套边框，实现视觉一体化
 */
import React, { useState } from 'react';
import { Tabs, ConfigProvider } from 'antd';
import { Calendar, Zap } from 'lucide-react';

// 动态导入子组件
import ScheduleManagement from './ScheduleManagement';
import SmartSchedule from './SmartSchedule';

const SchedulingHub = () => {
    // 默认展示全员排班表
    const [activeTab, setActiveTab] = useState('schedule');

    const items = [
        {
            key: 'schedule',
            label: (
                <div className="flex items-center gap-2 px-4">
                    <Calendar size={14} />
                    <span className="text-xs font-black uppercase tracking-widest">全员排班流水</span>
                </div>
            ),
            children: (
                <div className="animate-in fade-in duration-500">
                    <ScheduleManagement />
                </div>
            )
        },
        {
            key: 'smart',
            label: (
                <div className="flex items-center gap-2 px-4">
                    <Zap size={14} />
                    <span className="text-xs font-black uppercase tracking-widest">AI 智能算法</span>
                </div>
            ),
            children: (
                <div className="animate-in fade-in duration-500">
                    <SmartSchedule />
                </div>
            )
        }
    ];

    return (
        <ConfigProvider theme={{
            token: { colorPrimary: '#4f46e5', borderRadius: 8, controlHeight: 32, colorBorder: '#e2e8f0' },
            components: { 
                Tabs: {
                    titleFontSize: 12,
                    itemSelectedColor: '#1e293b',
                    itemHoverColor: '#4f46e5',
                    itemActiveColor: '#1e293b',
                    inkBarColor: '#1e293b',
                    horizontalMargin: '0 0 12px 0'
                }
            }
        }}>
        <div className="p-4 bg-gray-50/30 min-h-screen text-left">
            <div className="max-w-[1600px] mx-auto">
                <Tabs 
                    activeKey={activeTab} 
                    onChange={setActiveTab}
                    items={items} 
                    className="flagship-borderless-tabs"
                    size="small"
                    destroyOnHidden={true}
                />
            </div>
        </div>
        </ConfigProvider>
    );
};

export default SchedulingHub;
