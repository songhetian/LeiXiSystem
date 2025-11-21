import React, { useState } from 'react';
import { Tabs } from 'antd';
import { CalendarOutlined, SettingOutlined } from '@ant-design/icons';
import HolidayConfig from './HolidayConfig';
import SystemConfigPage from './SystemConfigPage';

const { TabPane } = Tabs;

const QuotaConfigLayout = () => {
  const [activeTab, setActiveTab] = useState('holiday');

  return (
    <div className="quota-config-layout">
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        type="card"
        size="large"
      >
        <TabPane
          tab={
            <span>
              <CalendarOutlined />
              节假日配置
            </span>
          }
          key="holiday"
        >
          <HolidayConfig />
        </TabPane>
        <TabPane
          tab={
            <span>
              <SettingOutlined />
              系统配置
            </span>
          }
          key="system"
        >
          <SystemConfigPage />
        </TabPane>
      </Tabs>
    </div>
  );
};

export default QuotaConfigLayout;
