/**
 * 考勤审计与配置中心 (Attendance Audit Hub)
 * 物理缝合：审批待办、部门报表、考勤规则设置
 */
import React, { useState } from 'react';
import { Tabs, ConfigProvider } from 'antd';
import { 
    CheckCircleOutlined, 
    BarChartOutlined, 
    SettingOutlined 
} from '@ant-design/icons';
import { ShieldCheck, FileBarChart, Settings2 } from 'lucide-react';

// 动态导入子组件 (零缩水准则)
import ApprovalManagement from './ApprovalManagement';
import DepartmentStats from './DepartmentStats';
import AttendanceSettings from './AttendanceSettings';

const AttendanceAuditHub = () => {
    const [activeTab, setActiveTab] = useState('approval');

    const items = [
        {
            key: 'approval',
            label: (
                <div className="flex items-center gap-2 px-4">
                    <ShieldCheck size={16} />
                    <span className="font-black">审批待办</span>
                </div>
            ),
            children: (
                <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                    <ApprovalManagement />
                </div>
            )
        },
        {
            key: 'reports',
            label: (
                <div className="flex items-center gap-2 px-4">
                    <FileBarChart size={16} />
                    <span className="font-black">部门报表</span>
                </div>
            ),
            children: (
                <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                    <DepartmentStats />
                </div>
            )
        },
        {
            key: 'settings',
            label: (
                <div className="flex items-center gap-2 px-4">
                    <Settings2 size={16} />
                    <span className="font-black">考勤规则</span>
                </div>
            ),
            children: (
                <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                    <AttendanceSettings />
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
                    <h1 className="text-2xl font-black text-slate-900 tracking-tight uppercase">考勤审计与配置</h1>
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mt-1 opacity-70">
                        AUDIT & CONFIGURATION - 审批流转、部门效能与考勤逻辑定义中心
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
                        雷犀合规审计引擎 v2.2 - 逻辑闭环已就绪
                    </span>
                </div>
            </div>
        </div>
        </ConfigProvider>
    );
};

export default AttendanceAuditHub;
