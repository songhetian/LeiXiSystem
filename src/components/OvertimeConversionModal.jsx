import React, { useState, useEffect } from 'react';
import { Modal, Form, Select, InputNumber, Button, Alert, Statistic, Row, Col, Spin, Descriptions, Space, Input } from 'antd';
import { SwapOutlined, CalculatorOutlined, ClockCircleOutlined, CalendarOutlined } from '@ant-design/icons';
import { toast } from 'react-toastify';
import { getApiBaseUrl } from '../utils/apiConfig';

const { Option } = Select;

const OvertimeConversionModal = ({ visible, onClose, onSuccess, employeeId, overtimeHours, defaultLeaveType }) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [vacationTypes, setVacationTypes] = useState([]);
  const [conversionRules, setConversionRules] = useState([]);
  const [calculationResult, setCalculationResult] = useState(null);

  useEffect(() => {
    if (visible) {
      loadVacationTypes();
      loadConversionRules();
      form.setFieldsValue({
        overtime_hours: overtimeHours || 0,
        target_type_id: defaultLeaveType?.id // 默认选中加班假类型
      });
    }
  }, [visible, overtimeHours, defaultLeaveType]);

  const loadVacationTypes = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${getApiBaseUrl()}/vacation/types`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await response.json();
      if (result.success) {
        setVacationTypes(result.data);
      }
    } catch (error) {
      console.error('加载假期类型失败:', error);
    }
  };

  const loadConversionRules = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${getApiBaseUrl()}/conversion-rules?source_type=overtime&enabled=true`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      const result = await response.json();
      if (result.success) {
        setConversionRules(result.data);
      }
    } catch (error) {
      console.error('加载转换规则失败:', error);
    }
  };

  const handleCalculate = async () => {
    try {
      const values = await form.validateFields(['overtime_hours', 'target_type_id']);
      setCalculating(true);

      const selectedType = vacationTypes.find(t => t.id === values.target_type_id);
      const token = localStorage.getItem('token');

      const params = new URLSearchParams({
        source_hours: values.overtime_hours,
        target_type_code: selectedType?.code || ''
      });

      const response = await fetch(
        `${getApiBaseUrl()}/conversion-rules/calculate?${params}`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );

      const result = await response.json();
      if (result.success) {
        setCalculationResult(result.data);
      } else {
        toast.error(result.message || '计算失败');
      }
    } catch (error) {
      console.error('计算转换结果失败:', error);
      toast.error('计算失败');
    } finally {
      setCalculating(false);
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();

      Modal.confirm({
        title: '确认转换',
        content: (
          <div>
            <p>确定要将 <strong>{values.overtime_hours} 小时</strong> 的加班时长转换为 <strong>{calculationResult?.converted_days} 天</strong> 的假期吗?</p>
            <p style={{ color: '#8c8c8c', fontSize: '12px' }}>此操作不可撤销</p>
          </div>
        ),
        onOk: async () => {
          setLoading(true);
          try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${getApiBaseUrl()}/vacation/overtime/convert`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                employee_id: employeeId,
                overtime_hours: values.overtime_hours,
                target_type_id: values.target_type_id,
                conversion_rule_id: values.conversion_rule_id
              })
            });

            const result = await response.json();
            if (result.success) {
              toast.success(`成功转换 ${values.overtime_hours} 小时为 ${result.data.converted_days} 天假期!`);
              form.resetFields();
              setCalculationResult(null);
              onSuccess?.();
              onClose();
            } else {
              toast.error(result.message || '转换失败');
            }
          } catch (error) {
            console.error('转换失败:', error);
            toast.error('转换失败');
          } finally {
            setLoading(false);
          }
        }
      });
    } catch (error) {
      console.error('验证失败:', error);
    }
  };

  const handleCancel = () => {
    form.resetFields();
    setCalculationResult(null);
    onClose();
  };

  return (
    <Modal
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <SwapOutlined style={{ color: '#1890ff' }} />
          <span>加班时长转换为假期</span>
        </div>
      }
      open={visible}
      onCancel={handleCancel}
      footer={[
        <Button key="cancel" onClick={handleCancel}>
          取消
        </Button>,
        <Button
          key="calculate"
          icon={<CalculatorOutlined />}
          onClick={handleCalculate}
          loading={calculating}
        >
          计算
        </Button>,
        <Button
          key="submit"
          type="primary"
          onClick={handleSubmit}
          loading={loading}
          disabled={!calculationResult}
        >
          确认转换
        </Button>
      ]}
      width={600}
    >
      <Alert
        message="转换说明"
        description="将您的加班时长转换为假期额度。转换后,加班时长将被扣除,对应的假期额度将增加。"
        type="info"
        showIcon
        style={{ marginBottom: '24px' }}
      />

      <Form
        form={form}
        layout="vertical"
        initialValues={{
          overtime_hours: overtimeHours || 0,
          target_type_id: defaultLeaveType?.id // 默认选中加班假类型
        }}
      >
        <Form.Item
          label="加班时长"
          name="overtime_hours"
          rules={[
            { required: true, message: '请输入加班时长' },
            { type: 'number', min: 0, message: '加班时长必须大于0' }
          ]}
        >
          <Space.Compact style={{ width: '100%' }}>
            <InputNumber
              min={0}
              step={0.5}
              placeholder="请输入加班时长"
              style={{ width: '100%' }}
              readOnly={true}
              disabled={true}
            />
            <Input addonAfter="小时" readOnly={true} disabled={true} />
          </Space.Compact>
        </Form.Item>

        <Form.Item
          label="目标假期类型"
          name="target_type_id"
          rules={[{ required: true, message: '请选择目标假期类型' }]}
        >
          <Select
            placeholder="请选择目标假期类型"
            showSearch
            optionFilterProp="children"
            filterOption={(input, option) =>
              option.children.toLowerCase().indexOf(input.toLowerCase()) >= 0
            }
          >
            {vacationTypes
              .filter(type => type.code !== 'compensatory') // 过滤掉调休类型
              .map(type => (
                <Option key={type.id} value={type.id}>
                  {type.name}
                </Option>
              ))}
          </Select>
        </Form.Item>

        <Form.Item
          label="转换规则"
          name="conversion_rule_id"
          rules={[{ required: false }]}
        >
          <Select
            placeholder="请选择转换规则（可选）"
            showSearch
            optionFilterProp="children"
            filterOption={(input, option) =>
              option.children.toLowerCase().indexOf(input.toLowerCase()) >= 0
            }
            allowClear
          >
            {conversionRules.map(rule => (
              <Option key={rule.id} value={rule.id}>
                {rule.name || `规则-${rule.id}`} (比例: {rule.ratio || rule.conversion_rate})
              </Option>
            ))}
          </Select>
        </Form.Item>

        {calculationResult && (
          <div style={{ marginTop: '16px', padding: '16px', backgroundColor: '#f0f5ff', borderRadius: '4px' }}>
            <Row gutter={16}>
              <Col span={12}>
                <Statistic
                  title="转换天数"
                  value={calculationResult.converted_days}
                  suffix="天"
                  precision={2}
                />
              </Col>
              <Col span={12}>
                <Statistic
                  title="转换比例"
                  value={calculationResult.conversion_ratio}
                  precision={2}
                />
              </Col>
            </Row>
            <Descriptions size="small" column={1} style={{ marginTop: '8px' }}>
              <Descriptions.Item label="使用规则">
                {calculationResult.rule_name || '默认规则'}
              </Descriptions.Item>
            </Descriptions>
          </div>
        )}
      </Form>
    </Modal>
  );
};

export default OvertimeConversionModal;
