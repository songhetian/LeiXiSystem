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
                    <h1 className="text-xl font-black text-slate-900 tracking-tight uppercase">考勤审计与配置</h1>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5 opacity-80">
                        AUDIT & CONFIGURATION - 审批流转、部门效能与考勤逻辑定义中心
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
                        雷犀合规审计引擎 v2.2 - 逻辑闭环已就绪
                    </span>
                </div>
            </div>
        </div>
        </ConfigProvider>
    );
};

export default AttendanceAuditHub;
