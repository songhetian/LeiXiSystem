import React, { useState } from 'react';
import { Tabs } from 'antd';
import { CalendarOutlined, SettingOutlined } from '@ant-design/icons';
import HolidayConfig from './HolidayConfig';
import SystemConfigPage from './SystemConfigPage';
import VacationQuotaSettings from './VacationQuotaSettings';

const QuotaConfigLayout = () => {
  const [activeTab, setActiveTab] = useState('quota');

  return (
    <div className="quota-config-layout">
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        type="card"
        size="large"
        items={[
          {
            key: 'quota',
            label: (
              <span>
                <CalendarOutlined />
                员工额度
              </span>
            ),
            children: <VacationQuotaSettings />,
          },
          {
            key: 'holiday',
            label: (
              <span>
                <CalendarOutlined />
                节假日配置
              </span>
            ),
            children: <HolidayConfig />,
          },
          {
            key: 'system',
            label: (
              <span>
                <SettingOutlined />
                系统配置
              </span>
            ),
            children: <SystemConfigPage />,
          },
        ]}
      />
    </div>
  );
};

export default QuotaConfigLayout;
