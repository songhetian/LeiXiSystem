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
            key: 'history',
            label: (
                <div className="flex items-center gap-2 px-4">
                    <HistoryOutlined />
                    <span className="font-black">假期变动审计</span>
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
            token: { colorPrimary: '#4f46e5', borderRadius: 12, controlHeight: 40, colorBorder: '#cbd5e1' },
            components: { 
                Tabs: {
                    titleFontSize: 14,
                    itemSelectedColor: '#4f46e5',
                    itemHoverColor: '#4f46e5',
                    inkBarColor: '#4f46e5',
                    horizontalMargin: '0 0 20px 0'
                }
            }
        }}>
        <div className="p-6 bg-[#f8fafc] min-h-screen text-left">
            <div className="max-w-[1400px] mx-auto">
                <div className="flex flex-col mb-6">
                    <h1 className="text-xl font-black text-slate-900 tracking-tight uppercase">假期自助中心</h1>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5 opacity-80">
                        VACATION SELF-SERVICE - 个人法定假、调休假与转换假一站式查验
                    </p>
                </div>

                <div className="bg-white p-2 rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                    <Tabs 
                        activeKey={activeTab} 
                        onChange={setActiveTab}
                        items={items} 
                        size="middle"
                        destroyInactiveTabPane={false}
                    />
                </div>

                <div className="pt-8 text-center">
                    <span className="text-[9px] text-slate-300 font-black uppercase tracking-[0.4em] opacity-60">
                        雷犀权益保障引擎 v2.2 - 核心通信模块
                    </span>
                </div>
            </div>
        </div>
        </ConfigProvider>
    );
};

export default VacationSelfServiceHub;
