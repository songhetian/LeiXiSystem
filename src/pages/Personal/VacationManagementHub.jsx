/**
 * 假期审计与管理中心 (Vacation Management Hub)
 * 物理缝合：调休审批、全员额度、配置中心
 */
import React, { useState } from 'react';
import { Tabs, ConfigProvider } from 'antd';
import { 
    CheckCircleOutlined, 
    DatabaseOutlined, 
    SettingOutlined,
    LockOutlined
} from '@ant-design/icons';
import { ShieldCheck, Layers, Cog, Key } from 'lucide-react';

// 动态导入子组件
import CompensatoryApproval from '../../components/CompensatoryApproval';
import VacationManagement from '../../components/VacationManagement';
import VacationQuotaSettings from '../../components/VacationQuotaSettings';
import VacationPermissions from '../../components/VacationPermissions';

const VacationManagementHub = () => {
    const [activeTab, setActiveTab] = useState('approval');

    const items = [
        {
            key: 'approval',
            label: (
                <div className="flex items-center gap-2 px-4">
                    <CheckCircleOutlined />
                    <span className="font-black">调休审批待办</span>
                </div>
            ),
            children: (
                <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                    <CompensatoryApproval />
                </div>
            )
        },
        {
            key: 'management',
            label: (
                <div className="flex items-center gap-2 px-4">
                    <DatabaseOutlined />
                    <span className="font-black">全员额度审计</span>
                </div>
            ),
            children: (
                <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                    <VacationManagement />
                </div>
            )
        },
        {
            key: 'settings',
            label: (
                <div className="flex items-center gap-2 px-4">
                    <SettingOutlined />
                    <span className="font-black">规则配置中心</span>
                </div>
            ),
            children: (
                <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                    <VacationQuotaSettings />
                </div>
            )
        },
        {
            key: 'permissions',
            label: (
                <div className="flex items-center gap-2 px-4">
                    <LockOutlined />
                    <span className="font-black">权限矩阵管理</span>
                </div>
            ),
            children: (
                <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                    <VacationPermissions />
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
                    inkBarColor: '#4f46e5',
                    horizontalMargin: '0 0 24px 0'
                }
            }
        }}>
        <div className="p-8 bg-[#f8fafc] min-h-screen font-black text-left">
            <div className="max-w-[1600px] mx-auto">
                <div className="flex flex-col mb-10">
                    <h1 className="text-2xl font-black text-slate-900 tracking-tight uppercase">假期审计与管理</h1>
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mt-1 opacity-70">
                        VACATION AUDIT HUB - 调休流转、权益存证与全系统假期规则管控中心
                    </p>
                </div>

                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-500 overflow-hidden">
                    <Tabs 
                        activeKey={activeTab} 
                        onChange={setActiveTab}
                        items={items} 
                        size="large"
                        destroyInactiveTabPane={false}
                    />
                </div>

                <div className="pt-12 text-center">
                    <span className="text-[10px] text-slate-400 font-black uppercase tracking-[0.5em] opacity-30">
                        雷犀合规审计引擎 v2.2 - 全量物理管控中
                    </span>
                </div>
            </div>
        </div>
        </ConfigProvider>
    );
};

export default VacationManagementHub;
