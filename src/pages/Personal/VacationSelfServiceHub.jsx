/**
 * 假期自助中心 (Vacation Self-Service Hub)
 * 物理缝合：假期余额、调休申请、变动明细
 */
import React, { useState } from 'react';
import { Tabs, ConfigProvider } from 'antd';
import { 
    WalletOutlined, 
    FormOutlined, 
    HistoryOutlined 
} from '@ant-design/icons';
import { Plane, CalendarClock, History } from 'lucide-react';

// 动态导入子组件
import VacationDetailsNew from '../../components/VacationDetailsNew';
import CompensatoryApply from '../../components/CompensatoryApply';
import VacationSummary from '../../components/VacationSummary';

const VacationSelfServiceHub = () => {
    const [activeTab, setActiveTab] = useState('balance');

    const items = [
        {
            key: 'balance',
            label: (
                <div className="flex items-center gap-2 px-4">
                    <WalletOutlined />
                    <span className="font-black">我的假期余额</span>
                </div>
            ),
            children: (
                <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                    <VacationDetailsNew />
                </div>
            )
        },
        {
            key: 'apply',
            label: (
                <div className="flex items-center gap-2 px-4">
                    <FormOutlined />
                    <span className="font-black">调休申请办理</span>
                </div>
            ),
            children: (
                <div className="animate-in fade-in slide-in-from-bottom-2 duration-500 max-w-4xl mx-auto py-8">
                    <CompensatoryApply onSuccess={() => setActiveTab('history')} />
                </div>
            )
        },
        {
            key: 'history',
            label: (
                <div className="flex items-center gap-2 px-4">
                    <HistoryOutlined />
                    <span className="font-black">变动汇总审计</span>
                </div>
            ),
            children: (
                <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                    <VacationSummary />
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
            <div className="max-w-[1400px] mx-auto">
                <div className="flex flex-col mb-10">
                    <h1 className="text-2xl font-black text-slate-900 tracking-tight uppercase">假期自助中心</h1>
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mt-1 opacity-70">
                        VACATION SELF-SERVICE - 个人法定假、调休假与转换假一站式查验
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
                        雷犀权益保障引擎 v2.2 - 物理链路透明化
                    </span>
                </div>
            </div>
        </div>
        </ConfigProvider>
    );
};

export default VacationSelfServiceHub;
