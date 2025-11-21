import React, { useState } from 'react';
import { Modal, Button, message, Spin, Descriptions, Alert } from 'antd';
import { SwapOutlined, ClockCircleOutlined, CalendarOutlined } from '@ant-design/icons';
import { getApiBaseUrl } from '../utils/apiConfig';

const OvertimeConversionModal = ({ visible, onClose, employeeId, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [conversionData, setConversionData] = useState(null);
  const [calculating, setCalculating] = useState(false);

  // Load conversion preview when modal opens
  React.useEffect(() => {
    if (visible && employeeId) {
      loadConversionPreview();
    }
  }, [visible, employeeId]);

  const loadConversionPreview = async () => {
    setCalculating(true);
    try {
      const token = localStorage.getItem('token');

      // Get active conversion rule
      const ruleResponse = await fetch(
        `${getApiBaseUrl()}/conversion-rules?source_type=overtime&target_type=overtime_leave&enabled=true`,
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );
      const ruleResult = await ruleResponse.json();

      if (!ruleResult.success || !ruleResult.data || ruleResult.data.length === 0) {
        message.error('未找到有效的加班转换规则');
        return;
      }

      const rule = ruleResult.data[0];

      // Get employee balance
      const balanceResponse = await fetch(
        `${getApiBaseUrl()}/vacation/balance/${employeeId}`,
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );
      const balanceResult = await balanceResponse.json();

      if (balanceResult.success) {
        const balance = balanceResult.data;
        const availableHours = (balance.overtime_hours_remaining || 0);
        const convertedDays = availableHours / rule.hours_per_day;

        setConversionData({
          rule,
          availableHours,
          convertedDays: convertedDays.toFixed(2),
          currentOvertimeLeave: balance.overtime_leave_remaining || 0,
          afterConversion: ((balance.overtime_leave_remaining || 0) + convertedDays).toFixed(2)
        });
      }
    } catch (error) {
      console.error('加载转换预览失败:', error);
      message.error('加载转换预览失败');
    } finally {
      setCalculating(false);
    }
  };

  const handleConvert = async () => {
    if (!conversionData || conversionData.availableHours <= 0) {
      message.warning('没有可转换的加班时长');
      return;
    }

    Modal.confirm({
      title: '确认转换',
      content: (
        <div>
          <p>确定要将 <strong>{conversionData.availableHours} 小时</strong> 的加班时长转换为 <strong>{conversionData.convertedDays} 天</strong> 的加班假吗？</p>
          <p className="text-gray-500 text-sm">此操作不可撤销</p>
        </div>
      ),
      onOk: async () => {
        setLoading(true);
        try {
          const token = localStorage.getItem('token');
          const response = await fetch(
            `${getApiBaseUrl()}/vacation/convert-overtime`,
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                employee_id: employeeId,
                hours: conversionData.availableHours
              })
            }
          );

          const result = await response.json();

          if (result.success) {
            message.success(`成功转换 ${conversionData.availableHours} 小时加班为 ${conversionData.convertedDays} 天假期`);
            onSuccess && onSuccess();
            onClose();
          } else {
            message.error(result.message || '转换失败');
          }
        } catch (error) {
          console.error('转换失败:', error);
          message.error('转换失败');
        } finally {
          setLoading(false);
        }
      }
    });
  };

  return (
    <Modal
      title={
        <div className="flex items-center gap-2">
          <SwapOutlined />
          <span>加班转假期</span>
        </div>
      }
      open={visible}
      onCancel={onClose}
      footer={[
        <Button key="cancel" onClick={onClose}>
          取消
        </Button>,
        <Button
          key="convert"
          type="primary"
          loading={loading}
          disabled={!conversionData || conversionData.availableHours <= 0}
          onClick={handleConvert}
        >
          确认转换
        </Button>
      ]}
      width={600}
    >
      <Spin spinning={calculating}>
        {conversionData ? (
          <div className="space-y-4">
            <Alert
              message="转换规则"
              description={`当前规则：${conversionData.rule.hours_per_day} 小时 = 1 天假期`}
              type="info"
              showIcon
            />

            <Descriptions bordered column={1} size="small">
              <Descriptions.Item
                label={
                  <span className="flex items-center gap-1">
                    <ClockCircleOutlined />
                    可用加班时长
                  </span>
                }
              >
                <span className="text-lg font-semibold text-blue-600">
                  {conversionData.availableHours} 小时
                </span>
              </Descriptions.Item>

              <Descriptions.Item
                label={
                  <span className="flex items-center gap-1">
                    <CalendarOutlined />
                    可转换天数
                  </span>
                }
              >
                <span className="text-lg font-semibold text-green-600">
                  {conversionData.convertedDays} 天
                </span>
              </Descriptions.Item>

              <Descriptions.Item label="当前加班假余额">
                {conversionData.currentOvertimeLeave} 天
              </Descriptions.Item>

              <Descriptions.Item label="转换后加班假余额">
                <span className="text-lg font-semibold text-purple-600">
                  {conversionData.afterConversion} 天
                </span>
              </Descriptions.Item>
            </Descriptions>

            {conversionData.availableHours <= 0 && (
              <Alert
                message="暂无可转换的加班时长"
                type="warning"
                showIcon
              />
            )}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-400">
            加载转换信息...
          </div>
        )}
      </Spin>
    </Modal>
  );
};

export default OvertimeConversionModal;
