import React, { useState } from 'react';
import { Button, Card } from 'antd';
import { SwapOutlined, TagsOutlined } from '@ant-design/icons';
import ConversionRulesSettings from './ConversionRulesSettings';
import VacationTypeManagement from './VacationTypeManagement';

const SystemConfigPage = () => {
  const [activeSection, setActiveSection] = useState('conversion');

  return (
    <div className="p-6">
      {/* 顶部切换按钮 */}
      <div className="mb-6 flex gap-4">
        <Button
          size="large"
          type={activeSection === 'conversion' ? 'primary' : 'default'}
          icon={<SwapOutlined />}
          onClick={() => setActiveSection('conversion')}
        >
          转换规则
        </Button>
        <Button
          size="large"
          type={activeSection === 'types' ? 'primary' : 'default'}
          icon={<TagsOutlined />}
          onClick={() => setActiveSection('types')}
        >
          假期类型
        </Button>
      </div>

      {/* 内容区域 */}
      <div className="system-config-content">
        {activeSection === 'conversion' && (
          <ConversionRulesSettings visible={true} onClose={() => {}} standalone={true} />
        )}
        {activeSection === 'types' && (
          <VacationTypeManagement visible={true} onClose={() => {}} standalone={true} />
        )}
      </div>
    </div>
  );
};

export default SystemConfigPage;
