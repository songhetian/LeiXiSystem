import React, { useState, useEffect } from 'react';
import { Modal, Form, InputNumber, message, Spin, Alert } from 'antd';
import { getApiBaseUrl } from '../utils/apiConfig';
import { Space } from 'antd';

const VacationQuotaEditModal = ({ visible, onClose, employee, year, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [types, setTypes] = useState([]);
  const [form] = Form.useForm();

  useEffect(() => {
    if (visible) {
      loadData();
    }
  }, [visible, employee, year]);

  const loadData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');

      // 1. Load vacation types
      const typesRes = await fetch(`${getApiBaseUrl()}/vacation-types`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const typesData = await typesRes.json();

      if (typesData.success) {
        const activeTypes = typesData.data.filter(t => t.enabled);
        setTypes(activeTypes);

        // 2. Load current balance for the employee
        if (employee) {
          // We might need a specific endpoint to get balance details or just use the list endpoint filtered
          // Since we don't have a direct single-balance endpoint, we use the list one
          const balanceRes = await fetch(`${getApiBaseUrl()}/vacation/balance?employee_id=${employee.id}&year=${year}`, {
             headers: { 'Authorization': `Bearer ${token}` }
          });
          const balanceData = await balanceRes.json();

          if (balanceData.success && balanceData.data.length > 0) {
             const balance = balanceData.data[0];
             // Map balance fields to form values
             const formValues = {};
             activeTypes.forEach(type => {
               // Mapping: annual_leave -> annual_leave_total
               // For now we only support editing specific hardcoded columns in DB unless we made it dynamic
               // The backend update logic handles: annual_leave, compensatory, sick_leave
               // We should map type.code to the expected form field name

               let fieldName = `${type.code}_total`;
               // Handle special cases if DB column names don't match pattern exactly
               if (type.code === 'compensatory') fieldName = 'compensatory_leave_total';

               // Check if balance object has this key
               if (balance[fieldName] !== undefined) {
                 formValues[type.code] = balance[fieldName];
               } else {
                 // If not found in balance (maybe new type not in DB columns yet), default to 0 or base_days
                 formValues[type.code] = 0;
               }
             });
             form.setFieldsValue(formValues);
          } else {
            // No balance record yet, set defaults from types
            const defaults = {};
            activeTypes.forEach(t => defaults[t.code] = t.base_days);
            form.setFieldsValue(defaults);
          }
        }
      }
    } catch (error) {
      console.error(error);
      message.error('加载数据失败');
    } finally {
      setLoading(false);
    }
  };

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);

      const token = localStorage.getItem('token');

      // Transform form values to the format expected by API
      // API expects: { year, quotas: [{ type: 'annual_leave', days: 10 }, ...] }
      const quotas = Object.keys(values).map(key => ({
        type: key,
        days: values[key]
      }));

      const response = await fetch(`${getApiBaseUrl()}/vacation/balance/${employee.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          year,
          quotas
        })
      });

      const data = await response.json();
      if (data.success) {
        message.success('额度更新成功');
        onSuccess();
        onClose();
      } else {
        message.error(data.message || '更新失败');
      }
    } catch (error) {
      console.error(error);
      message.error('更新失败');
    } finally {
      setLoading(false);
    }
  };

  // Filter types that we can actually edit (those that have corresponding columns in DB)
  // Currently DB has: annual_leave_total, compensatory_leave_total, sick_leave_total, overtime_leave_total
  // The backend `vacation-optimization.js` supports: annual_leave, compensatory, sick_leave, overtime_leave
  const supportedTypes = ['annual_leave', 'sick_leave', 'overtime_leave'];

  const leaveTypeNames = {
    'annual_leave': '年假',
    'sick_leave': '病假',
    'overtime_leave': '加班假'
  };

  return (
    <Modal
      title={`编辑假期额度 - ${employee?.real_name} (${year}年)`}
      open={visible}
      onCancel={onClose}
      onOk={handleOk}
      confirmLoading={loading}
      width={600}
    >
      <Spin spinning={loading}>
        <Alert
          message="注意"
          description="修改额度会直接更新员工的假期总额，并记录一条'调整'类型的变更历史。"
          type="warning"
          showIcon
          className="mb-4"
        />

        <Form
          form={form}
          layout="horizontal"
          labelCol={{ span: 8 }}
          wrapperCol={{ span: 16 }}
        >
          {types.filter(t => supportedTypes.includes(t.code)).map(type => (
            <Form.Item
              key={type.id}
              name={type.code}
              label={type.name}
              rules={[{ required: true, message: '请输入天数' }]}
            >
              <Space.Compact style={{ width: '100%' }}>
                <InputNumber min={0} precision={1} />
                <Input defaultValue="天" readOnly={true} disabled={true} />
              </Space.Compact>
            </Form.Item>
          ))}

          {types.some(t => !supportedTypes.includes(t.code)) && (
             <div className="text-gray-400 text-sm text-center mt-4">
               * 部分假期类型暂不支持在此编辑（需数据库字段支持）
             </div>
          )}
        </Form>
      </Spin>
    </Modal>
  );
};

export default VacationQuotaEditModal;
